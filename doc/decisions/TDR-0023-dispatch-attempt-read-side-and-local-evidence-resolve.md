---
id: TDR-0023
decision_type: tdr
status: Proposed
created: 2026-11-11
decision_date: null
last_updated: 2026-11-11
summary: "Read the durable dispatch evidence through one rule — a consumer surface may declare only what the durable record can supply, and where it cannot know it discloses instead of refusing or inventing: the attempt read side adds no error identity and reuses `input.value.rejected` (`kind: input`, exit 1) and the failing `state.*` identity (`kind: state`, exit 2) inside a closed 124-row registry with four `dispatch` rows; a verified empty history is success (exit 0, `attempts: []`, `matched: 0`, `hasMore: false`); the projection carries `divergenceRef` singular (identifier or explicit `null`) because the stored attempt holds at most one reference; `mode: \"local-evidence\"` is unconditional on every successful resolve because resolve resolves no credential, performs no network call, and reads no truth source outside the local store; `unresolved` is the exact folded open count for the reported repository on both the resolve result and the summary — the delivered count is already exact but store-wide, so the change's count effect is the repository scope plus a summary `unresolvedIds` list that narrows to its documented 20 with an `idsTruncated` marker; repository scope is enforced physically by the project state root and logically by filtering each record on its own `repository`, with excluded records disclosed as a count only; and a divergence whose repository differs from the invoking checkout's is disclosed, not prevented, naming the divergence's own repository in the result."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os dispatch evidence read side and divergence resolution result
decision_scope: repo
review_date: null
classification:
  domains: [tooling, architecture, operations, security]
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
  driver: "@pm (GH-289 DEC-16 routes the curated record through @decision-advisor; spec §15.1 names the rulings to graduate)"
  decider: "Juliusz Ćwiąkalski (owner; acceptance pending at the GH-289 PR review; the AI does not accept this R2 record)"
  contributors:
    - "@spec-writer (chg-GH-289-spec F-1..F-9, DM-1..DM-6, §8.3, §8.5, §15 DEC-1..DEC-16, §15.1, §17, Appendix B/C/D)"
    - "@decision-advisor (repository analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "@decision-critic (independent challenge recommended: the rulings fix taxonomy-closure and cross-repository disclosure posture that later read sides will copy)"
    - "Owner (human final acceptance at the GH-289 PR review)"
  performers:
    - "@test-plan-writer (identity-reuse, empty-history, projection-cardinality, count-agreement, and isolation oracles)"
    - "@plan-writer (delivery ordering for contracts, read runtime, resolve enrichment, and gates)"
    - "@coder (delivery per spec and plan)"
    - "@doc-syncer (dispatch feature spec, M2 attempts page, contracts page, and corpus reconciliation)"
  informed:
    - "Operators who inspect attempt history before a handover argument"
    - "Retro and evidence passes that cite dispatch attempts"
    - "M2-S16 engine-first delivery operations (the per-repository handover evidence narrative)"
    - "Consumers of `dispatch dual-run summary` and its divergence block"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A failure cell on a read surface has no delivered identity to reuse (a malformed request, an unresolvable context, an unresolvable identity, a store fault are the covered four): the closed-registry ruling needs re-deriving rather than a convenient new row."
  - "The error registry stops being closed or row-pinned (the count pin, the domain-kind pin, the two-segment allowlist, or the bidirectional documentation sync is relaxed): the reason for reusing delivered identities disappears and the taxonomy question reopens."
  - "A consumer needs to distinguish 'this reference has no attempts' from 'this reference's attempts were not recorded yet', which the ledger's attempt-identifier keying cannot express: the empty-history ruling and the keying both reopen."
  - "The durable attempt record grows a second divergence reference, or a divergence stops being keyed per (repository, reference): the singular `divergenceRef` projection must follow the record."
  - "Resolve acquires a credential port, a transport, or any live truth read: the unconditional `local-evidence` mode becomes a false statement and must become a condition or disappear."
  - "A surface reports an unresolved count that is not the exact folded open count, or derives it from a bounded identifier list again: the one-count-rule is bypassed."
  - "A record's `repository` field proves unreliable (a corrupt or missing field), so a logical filter would attribute a record to the wrong reader: the double-enforcement ruling needs a provenance rule rather than a filter."
  - "An operator story for cross-repository resolution exists (a repository input on resolve, or a refusal), or a cross-repository resolution is performed and surprises an operator: the disclose-not-prevent posture in D-7 is superseded."
links:
  related_changes: ["GH-289", "GH-288", "GH-279", "GH-239"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-11--GH-289--evidence-inspection/chg-GH-289-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/planning/oss-tooling/milestones/m2/contracts.md"
    - "doc/planning/oss-tooling/milestones/m2/commands/attempts.md"
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/app/dispatch-ledger.ts"
    - "packages/core/src/app/dispatch-gate.ts"
    - "packages/core/src/domain/dispatch-gate.ts"
    - "packages/cli/src/commands/dispatch.ts"
    - "packages/cli/src/help.ts"
  diagrams: []
  decisions: ["TDR-0005", "TDR-0015", "TDR-0020", "TDR-0022"]
  experiments: []
  metrics: []
  roadmap_items: ["M2-S12", "M2-S16"]
---

# TDR-0023: Dispatch Attempt Read Side and Local-Evidence Resolve — Closed-Taxonomy Reuse, Empty-History Success, Record-Bounded Projection Cardinality, Unconditional Evidence Mode, One Exact Divergence Count, and Twice-Enforced Repository Scope

## Context

- **FACT:** The durable attempt record already carries everything a consumer surface projects: `attemptId`, the normalized `host/owner/name` `repository`, `ref`, `harness`, `evidenceClass`, `startedAt`, `finishedAt`, `handoverState`, `outcome`, `token`, the `comparison` record, an **optional singular** `divergenceRef`, `falseSuccess`, the tri-state `corroboration` triple, an optional `resumeMode`, an optional `prefillCostAcknowledged`, at most sixteen `evidenceRefs`, and `recordedAt` (`packages/core/src/contracts/dispatch.ts`, `DispatchAttemptRecord`, read 2026-11-11).
- **FACT:** A bounded verified reader exists and is keyed by attempt identifier, not by reference: `readDispatchAttempts` retains the newest `DISPATCH_MAX_ATTEMPT_RECORDS` (5,000) and returns a declared truncation, and the record key is `dispatch.attempt.<attemptId>` (`packages/core/src/app/dispatch-ledger.ts`, read 2026-11-11).
- **FACT:** No CLI read surface over that record exists. The `dispatch` family accepts `dispatch <ref>`, `dispatch dual-run summary --repo <repo>`, `dispatch dual-run resolve <divergence-id> --note <text>`, and `dispatch handover <repo> [--revert]`; the static help inventory carries exactly four `dispatch` entries and no `--ref` or `--limit` option on the family (`packages/cli/src/commands/dispatch.ts`; `packages/cli/src/help.ts`, read 2026-11-11).
- **FACT:** The resolve success payload carries exactly five keys — `divergenceId`, `state`, `resolved`, `note`, `principal` — and nothing else: no mode, no repository, no counts (`packages/core/src/app/dispatch-gate.ts`, `resolveDispatchDivergenceEvidence`, read 2026-11-11). It declares neither that it ran from local evidence nor what it left unresolved.
- **FACT:** Resolve is composed with the store, the fence token, the principal, and the clock only — there is no credential port, no transport, and no truth read in its input shape, so "local evidence" is a property of the composition rather than a policy it chooses (`packages/core/src/app/dispatch-gate.ts`, read 2026-11-11).
- **FACT:** Resolve already maps an identifier absent from the ledger to an app-local `divergence-not-found` sentinel surfaced as `input.value.rejected` under `kind: "input"`, and keeps a genuine store fault under its own `state.*` code with `kind: "state"` (`packages/core/src/app/dispatch-gate.ts` lines 113–119, read 2026-11-11). The note is clamped to `DISPATCH_MAX_NOTE_CHARS` (240) before the record is built (`packages/core/src/app/dispatch-ledger.ts`, `resolveDispatchDivergence`, read 2026-11-11).
- **FACT:** The error registry is closed and row-pinned: `ERROR_TABLE` holds 124 identities with exactly four `dispatch` rows, the result-contract spec documents 124 rows, and a bidirectional sync gate asserts 124/124 plus the documented string "124 identities" (`packages/core/src/contracts/error-table.ts`; `tests/checks/error-table-sync.test.ts` lines 1783–1798; `tests/structure/dispatch-error-identity.test.ts` line 73, read 2026-11-11).
- **FACT:** Two divergence folds exist, and only one of them is live. `foldEvidenceWindow` (`packages/core/src/domain/dispatch-gate.ts` lines 146–153) folds every divergence record read from the store **without a repository filter**, sets `unresolvedIds` to every open identifier **without a cap**, and derives `unresolved` and `resolved` from that list — so the delivered summary's count is already **exact**, and exact about the **store** rather than about `--repo`. `summarizeDispatchDivergences` (`packages/core/src/app/dispatch-ledger.ts` lines 282–296) is the capped one: it truncates `unresolvedIds` to `DISPATCH_MAX_DIVERGENCE_IDS` (20) and derives `resolved` as `folded.length - unresolvedIds.length`, so its `unresolved` reports the capped list length and its `resolved` over-reports by however many identifiers were omitted; it has **no caller** (grep over `packages/**` and `tests/**` finds only the two barrel re-exports and one content-inventory allowance row), and GH-289 deletes it. The documented bound is "Unresolved divergence ids in a summary — 20" (`doc/spec/features/feature-dispatch-engine.md`, bounds table), which the live fold does not enforce: `packages/cli/src/output/dispatch-text.ts:67` prints every open identifier (read 2026-11-11; corroborated by GH-289 readiness review iteration 1, finding B3).
- **FACT:** The live divergence block therefore carries two defects and one unenforced bound: it counts the whole store rather than one repository's divergences — which after the per-repository split and the wholesale migration is not the same thing (TDR-0022 D-1; GH-289 spec §2.1) — and it returns every open identifier although the feature spec bounds the summary's identifier list at 20. The count arithmetic itself is already exact.
- **FACT:** The active change reference is a delivered seam: `.ai/local/pm-context.yaml` carries `active_change.workItemRef` and is already read by the spend read side (`packages/cli/src/production.ts` line 597, read 2026-11-11).
- **FACT:** The M2 pack proposes a different contract: `attempts.v1` declares `divergenceRefs[]` as a list, a per-ref read side, and a resolve that declares `local-evidence` mode "when live tracker truth is unreachable"; the `attempts(1)` page proposes `attempts.ref-unknown`, `attempts.limit-invalid`, and `attempts.ledger-unavailable`, states exit `0` covers "an empty history" and exit `1` means "the ref has no attempt history", prints `command: "dispatch attempts"`, and shows a text example whose token (`success`) is not in the eleven-token vocabulary (`doc/planning/oss-tooling/milestones/m2/contracts.md` § `attempts.v1`; `.../m2/commands/attempts.md`, read 2026-11-11).
- **FACT:** GH-289 §15 fixes the rulings this record carries (DEC-1, DEC-2, DEC-4, DEC-5, DEC-8, DEC-9, DEC-15) and §15.1 requires them graduated into `doc/decisions/**` at the next free identifier after TDR-0022, drafted by the PM through `@decision-advisor` (spec §15, §15.1, read 2026-11-11).
- **Trigger:** GH-289 (M2-S12). Handover decisions and retro evidence passes must cite recorded dispatch evidence, and the only reader is a text editor over state files; the resolve result records a decision without saying what it rested on or what it left behind.

## Problem Framing (Clarified)

The symptoms look like five separate contract nits. They are one question asked five times: **when a consumer surface is built over evidence that was written by someone else, what may it claim?**

Three conflations sit behind the symptoms, and every ruling in this record removes one of them.

1. **Vocabulary invented where identity already exists.** A read side over a ledger can fail in exactly four ways — a malformed request, an unresolvable context or identity, an unreadable store, and a verified read that matched nothing. The first two are already `input.value.rejected` under `kind: "input"`, the third already keeps its own `state.*` identity under `kind: "state"`, and the fourth is not a failure. Adding `attempts.*` rows would create identities for cells that already have owners, and the cost is not cosmetic: the registry is closed by row count, by domain-kind count, by a two-segment allowlist, and by a bidirectional documentation sync, so a new row makes classification less total (a code whose kind does not match its row is contained as `fallback.internal`, losing the identity) while adding a documentation obligation for a capability nothing needs.

2. **Capability declared that the evidence cannot supply.** A list field that can never hold two elements, a mode field that appears only when an input the command never consults takes one value, and a count derived from an identifier list's length each declare a branch that does not exist in the data. The consumer then reasons about a shape with no cases, or reads a truncated list length as a population. This is the same defect in three costumes: the surface reports more structure than the record holds. On the count it is a live defect only in the uncalled helper this change deletes — the live summary's arithmetic is already exact — so the count ruling (D-5) is about the repository the number describes and the identifier bound the spec already declares, not about repairing arithmetic.

3. **Scope borrowed from the wrong subject.** A store is not a repository after the wholesale migration: one project root can hold attempt and divergence records whose `repository` field names another repository. Physically opening the right root is therefore necessary but not sufficient — without a logical filter on each record's own `repository`, a read presents foreign evidence as the operator's own, and a summary `--repo` count includes another repository's open divergences. The converse error is refusing where the surface cannot distinguish: an absent ref history is indistinguishable from a ref whose attempts are not yet recorded (the ledger is keyed by attempt id), so refusing makes the first inspection of a fresh ticket fail for no informational gain.

The decision question is: **what may the attempt read side and the extended resolve result declare — about failures, cardinality, mode, counts, and scope — given a closed taxonomy, an attempt record that carries at most one divergence reference, and a state root that can hold more than one repository's history?** The answer has to keep classification total, keep the projection no wider than the record, keep the counts true for the repository they describe, and keep every unknown disclosed rather than refused or invented.

Out of scope: the attempt record's fields, the comparison and corroboration models, the evidence classes, the window, the floor, the handover predicate, the divergence record kind, and the resolve write path — all unchanged. Also out of scope: backfilling, re-attributing, or rewriting historical records, and adding any state record, schema version, configuration key, or dependency.

## Constraints (Hard Requirements)

> **Table stakes:** the TDR-0005 token vocabulary, projection classes, and exit derivation; the TDR-0015 gate semantics; the TDR-0020 divergence shapes and local-only resolve; the TDR-0022 root and identity rules; determinism and the declared bounds; the delivered ledger read and its record validators; the redaction path. Every alternative satisfies them and they are not scored again.

### C-1: The taxonomy stays closed

- **Statement:** The read side adds 0 error identities. `ERROR_TABLE` stays at 124 identities with exactly 4 `dispatch` rows; no `attempts.*` string is declared, emitted, or documented anywhere; 0 new delivery-result tokens, projection classes, or exit literals appear. Malformed input and unresolvable context or identity are `input.value.rejected` under `kind: "input"` at exit `1`; an unreadable store keeps its own `state.*` identity under `kind: "state"` at exit `2`.
- **Source:** AC (GH-289 AC-F4-4, F-4, DM-6, NFR-5, DEC-1) + internal standard (bidirectional error-table/documentation sync gate; `classifyDomainKind` exact-code classification)
- **Verification:** test (row-count and domain-kind pins; a per-identity case asserting kind, code, projection, and exit; a classification test proving a state code under the wrong kind falls to `fallback.internal`) + audit (no `attempts.*` string in table, docs, help, or output)
- **Negotiable:** no

### C-2: An unknown is not a failure

- **Statement:** A verified read that matches no record exits `0` with `attempts: []`, `matched: 0`, and `hasMore: false`, and is never reported as a refusal. Conversely, a store that cannot be read honestly is never reported as an empty history at exit `0`. The two directions are asserted together, in one place per direction, so neither can regress into the other.
- **Source:** AC (AC-F4-2, AC-F4-3, DEC-2, NFR-5)
- **Verification:** test (empty-history exit and payload; torn, unreadable, and permission-denied cases each exit `2` with their own identity)
- **Negotiable:** no

### C-3: The projection is no wider than the record

- **Statement:** Every projected field exists on the durable attempt record and maps one-to-one; `divergenceRef` is one identifier or explicit `null`; no projected field is an array the record cannot fill; no projected field declares an optional branch the record cannot take. The projection carries no field the record does not have and renames no stored field.
- **Source:** AC (AC-F2-1, AC-F2-2, AC-F2-3, DEC-4, DEC-6) + prior decision (the attempt record contract; the state layer's schema version)
- **Verification:** test (exact field set per row, explicit `null` for an absent reference, no undeclared key, `endedAt` equal to the stored finish timestamp)
- **Negotiable:** no

### C-4: The evidence mode is a fact, not a condition

- **Statement:** Every successful resolution — including a replay — declares `mode: "local-evidence"`, and resolve performs 0 credential resolutions, 0 network requests, 0 harness spawns, and 0 model calls. The mode is never conditional on an input resolve consults, because no such input exists.
- **Source:** AC (AC-F5-2, F-5, DEC-5, NFR-6) + prior decision (TDR-0020 C-1: resolution is local-only)
- **Verification:** test (spy credential and transport ports assert zero invocations on every resolve path; the mode is asserted on the first resolution and on a replay; an unreachable-tracker composition still reports the mode)
- **Negotiable:** no

### C-5: One exact count rule on every surface that reports counts

- **Statement:** `unresolved` is the exact number of folded records still `open` for the reported repository on both the resolve result and `dispatch dual-run summary`; `unresolvedIds` carries at most 20 identifiers with `idsTruncated` true exactly when identifiers were omitted; 0 surfaces derive a count from an identifier list's length, and 0 surfaces hold a second definition of the count.
- **Source:** AC (AC-F5-5, F-7, DM-3, NFR-8, DEC-15)
- **Verification:** test (25 folded open divergences: both surfaces report `unresolved: 25`, at most 20 identifiers, `idsTruncated: true`; a resolution decreases the count by exactly one and removes the identifier)
- **Negotiable:** no

### C-6: Scope is enforced twice and disclosure is count-only

- **Statement:** 0 returned attempts carry a `repository` other than `data.repository`, and 0 foreign identifiers (attempt id, ref, divergence reference, harness, timestamp) appear in the envelope, its warnings, or the text digest. The physical project state root plus a logical filter on each record's own `repository` are both required. Excluded records are disclosed as `excluded.foreignRepository`, a count independent of `--ref`. Repository identity resolves with persistence disabled, and an invocation outside a checkout refuses rather than reading the host-scoped `unbound` store.
- **Source:** AC (AC-F3-1, AC-F3-2, AC-F3-3, F-3, DEC-8, NFR-4) + prior decision (TDR-0022 D-1, D-2, D-3)
- **Verification:** test (two projects on one host root; one project root holding two repositories' records; a non-checkout invocation; a spy asserting the identity marker is neither created nor repaired by a read)
- **Negotiable:** no

### C-7: Additive and read-only with respect to evidence

- **Statement:** The run envelope, the summary envelope, the handover result, and the five delivered resolve keys keep their names, types, and order, and their meanings apart from the summary divergence block's one declared narrowing (`unresolvedIds` to the documented at most 20 identifiers, with `idsTruncated` added on both blocks); the dispatch grammar gains one verb and two declared flags; the read appends 0 attempt, divergence, handover, or authority records and acquires 0 fences; no state record kind, schema version, configuration key, workspace package, or external dependency is added.
- **Source:** AC (AC-F9-1, AC-F4-1, AC-F9-2, NFR-3, NFR-9)
- **Verification:** test (store bytes, modes, and mtimes unchanged; fence spy at zero; delivered shapes asserted unchanged apart from the declared narrowing) + review (the additive-only half against the merge base)
- **Negotiable:** no

### C-8: The resolve reports its subject, not the caller

- **Statement:** The resolve result names the repository recorded on the resolved divergence and scopes its counts to that repository; the delivered resolve grammar is unchanged — no repository input is required or added — and a resolution of a divergence belonging to another repository is visible in the result rather than silent or refused.
- **Source:** AC (AC-F5-1, F-5, DEC-9, OQ-1) + prior decision (TDR-0020 resolution semantics)
- **Verification:** test (the result's repository equals the divergence record's repository under a checkout of a different repository; a replay reports the same repository and unchanged counts)
- **Negotiable:** no

## Decision Drivers

1. **Truthful evidence (the reason the surface exists).** A read side is cited by handover arguments and retros; a surface that overstates what it read, or reports a count derived from an identifier list's length, corrupts the argument it was built to support.
2. **Taxonomy integrity.** Exact-code classification is total only while every emitted code carries its own row's domain kind; a new identity invented for a covered cell costs a row, a documentation sync, a pin, and a class of silent fallbacks.
3. **Least invention.** Cardinality, mode, and count must come from the record. A declared branch with no cases is a maintenance liability and a misreading waiting to happen.
4. **Scope honesty.** A store is not a repository; a read must neither present foreign evidence as the operator's own nor refuse where it cannot distinguish. Both errors are failures of the same honesty.
5. **One rule per question.** One active-context rule, one projection, one count rule, one disclosure shape — because the delivered tree already carries two divergence folds with two different behaviours (one live and store-wide, one capped and uncalled), and a third would settle nothing.
6. **Reachability and gate health.** A subfamily that cannot be reached from `--help` or is absent from the coverage inventory is not delivered; the parity pin exists to make the addition deliberate.
7. **Solo-maintainer cost.** No new row, token, package, subpath, configuration key, or dependency — the change is one verb, one projection, one shared count helper, and gate wiring.

## Decision Rights (DACI)

- **Driver:** `@pm` — change owner for GH-289; DEC-16 routes the curated record through `@decision-advisor` and §15.1 names the rulings to graduate.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. **Acceptance is pending at the GH-289 PR review**; this record stays `Proposed` with `decision_date: null` and grants no authority in the interim. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (F-1…F-9, DM-1…DM-6, §8.3, §8.5, §15 DEC-1…DEC-16, §15.1, Appendix B/C/D); `@decision-advisor` (repository analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` during delivery; independent challenge by `@decision-critic` is recommended because later read sides over the same ledger will copy these rulings; the owner decides at PR review.
- **Performers:** `@test-plan-writer` (identity-reuse, empty-history, cardinality, count-agreement, and isolation oracles), `@plan-writer` (delivery ordering), `@coder` (delivery), `@doc-syncer` (dispatch feature spec, M2 pages, corpus).
- **Informed:** operators who read attempt history before a handover argument; retro and evidence passes; M2-S16; consumers of the summary's divergence block.
- **Timing and escalation:** recorded during GH-289 specification, before dependent code. Implementation may proceed with acceptance pending (TDR-0005/TDR-0015/TDR-0020/TDR-0022 precedent). Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The attempt record carries every projected field, including a singular optional `divergenceRef` and a `finishedAt` the projection maps to `endedAt`. | FACT | `packages/core/src/contracts/dispatch.ts` (`DispatchAttemptRecord`, read 2026-11-11) | The projection would have to invent a field or a cardinality, and C-3 would be unachievable as scoped | High |
| The attempt ledger is keyed by attempt identifier and retains the newest 5,000 with a declared truncation. | FACT | `packages/core/src/app/dispatch-ledger.ts` (`readDispatchAttempts`, `DISPATCH_MAX_ATTEMPT_RECORDS`, read 2026-11-11) | "No attempts for this reference" would be a distinct, knowable state and the empty-history ruling would be a choice rather than a necessity | High |
| The dispatch family has four grammar forms and four help entries, with no `attempts` verb and no `--ref`/`--limit` flag. | FACT | `packages/cli/src/commands/dispatch.ts`; `packages/cli/src/help.ts` (read 2026-11-11) | The read side might already exist in another shape | High |
| The resolve success payload carries exactly `divergenceId`, `state`, `resolved`, `note`, `principal`. | FACT | `packages/core/src/app/dispatch-gate.ts` (read 2026-11-11) | The additive change would be smaller or would collide with an existing key | High |
| Resolve's composition carries no credential port, no transport, and no truth read. | FACT | `packages/core/src/app/dispatch-gate.ts` (input shape, read 2026-11-11); TDR-0020 C-1 | `local-evidence` would be a policy claim, and a conditional mode would be the honest shape | High |
| Absent identifiers map to an app-local `divergence-not-found` sentinel surfaced as `input.value.rejected` under `kind: "input"`; store faults keep their own `state.*` identity under `kind: "state"`. | FACT | `packages/core/src/app/dispatch-gate.ts` lines 113–119 (read 2026-11-11) | The read side's refusal mapping would have no delivered precedent and C-1 would need a row | High |
| The registry holds 124 identities with exactly four `dispatch` rows, and a bidirectional sync gate pins both the count and the 124-row documented table. | FACT | `packages/core/src/contracts/error-table.ts`; `tests/checks/error-table-sync.test.ts` 1783–1798; `tests/structure/dispatch-error-identity.test.ts` 73 (read 2026-11-11) | Adding rows would be cheap and C-1 would be a preference rather than a gate | High |
| Two divergence folds exist: a live fold with no repository filter and an uncapped identifier list, and an uncalled helper that caps the list at 20 and derives the count from the capped length. | FACT | `packages/core/src/domain/dispatch-gate.ts` 146–153; `packages/core/src/app/dispatch-ledger.ts` 282–296 (read 2026-11-11; B3) | If the capped derivation had a caller, D-5 would correct a delivered surface's arithmetic; because it has none, D-5's load-bearing half is the repository scope of the count and the declared identifier bound | High |
| The summary's divergence block is computed over the whole store rather than over `--repo`. | FACT | `packages/core/src/app/dispatch-gate.ts` `readDispatchGate` passes every divergence record to `foldEvidenceWindow` (read 2026-11-11) | The scope defect would be confined to the read side and D-6 would cover less | High |
| The local PM context already exposes `active_change.workItemRef` to the spend read side. | FACT | `packages/cli/src/production.ts` 597 (read 2026-11-11) | The omitted-`--ref` case would need a new context mechanism, which NG-8 forbids | High |
| The M2 pack declares `divergenceRefs[]`, a conditional local-evidence mode, three `attempts.*` rows, and a self-contradicting exit table. | FACT | `doc/planning/oss-tooling/milestones/m2/contracts.md` § `attempts.v1`; `.../m2/commands/attempts.md` (read 2026-11-11) | The rulings would have no counterpart to correct, and the pack could stay as written | High |
| A repository's normalized `host/owner/name` recorded on a record is rename-invariant and is the authority for whose evidence it is. | ASSUMPTION | GH-289 §12; TDR-0015 repository-identity semantics | A record with a corrupt `repository` field would be excluded from its owner's read and counted as foreign — the safe direction, but not the true one | Medium-High |
| An absent ref history is genuinely indistinguishable from a ref whose attempts are not yet recorded, because nothing records a per-ref presence marker. | ASSUMPTION | `packages/core/src/app/dispatch-ledger.ts` key shape | If a presence marker existed, refusing would become available and the empty-history ruling would be a policy choice | High |
| Consumers honour `hasMore` and `truncation` rather than treating a returned page as the whole history. | ASSUMPTION | GH-289 RSK-4 | A consumer that ignores the bound reads a prefix as a population; the fields are present on every response but cannot enforce reading | Medium-High |
| A cross-repository resolution is rare enough that disclosing it suffices until an operator story exists. | TO-CONFIRM | GH-289 OQ-1; §7.3 deferred guard | A routine cross-repository resolution would make disclosure insufficient and D-7 would need a guard sooner | Medium |

## Mental Models & Techniques Used

- **First principles:** separate what the ledger *knows* (an attempt record, its own repository, at most one divergence reference), what it *can know* (whether the read verified, whether any record matched), and what it *cannot know* (whether a ref has no history or merely none yet, and whose divergences belong to a store after a wholesale migration). Every ruling is a consequence of not claiming the third.
- **Inversion:** how would this surface lie? Invent a failure identity for a covered cell, so classification loses an identity to a fallback; project a list that can hold at most one element, so a consumer loops over a shape with no cases; declare `local-evidence` only when some input says so, implying a live branch that does not exist; report the length of a capped list as a population; and read a store as if it were a repository. Each inversion is one constraint (C-1, C-3, C-4, C-5, C-6).
- **Second-order thinking:** the read side becomes the pattern for later evidence projections (spend, retro, telemetry). A precedent that tolerates invented identities or invented cardinality will be copied; a precedent that reuses delivered identities and counts honestly costs one shared helper. The repository-scoped count also makes the summary's number move **down** on a migrated root and adds a new count to the resolve result, while the summary's identifier list narrows to the bound the feature spec already documents — which is why both consequences are stated rather than discovered later.
- **Systems thinking:** identity resolution, store scope, record filter, projection, count fold, and resolve enrichment form one chain. The physical root is only as good as the record's own repository field; the count is only as good as the fold it comes from; the mode is only as good as the composition that makes it true. A ruling at one link that ignores another produces a surface that is right about one thing and wrong about the rest.
- **Opportunity cost:** three new error rows buy clearer *names* for cells that already have owners, at the price of a registry change, a documentation sync, two pin updates, and a class of silent fallbacks. A `divergenceRefs[]` array buys nothing the record can fill. A conditional mode buys an implication of a live-truth branch that resolve does not have.
- **Least vocabulary / KISS:** one verb, one projection of sixteen fields, one shared count helper, one disclosure shape (a count), one refusal identity family (`input`), one state-fault family (`state`).
- **Kepner-Tregoe style distinction:** the read side's four failure cells are distinguished by *is it distinguishable at all* before *what should it be called* — which is why the empty history resolves to success and not to a refusal before any naming question is asked.
- **Constraint-first elimination:** the six alternatives are screened against C-1…C-8 before any driver ranking, so no attractive option (for example, richer error names) wins while violating a `negotiable: no` gate.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 taxonomy closed | C-2 unknown ≠ failure | C-3 record-bounded | C-4 mode is fact | C-5 one exact count | C-6 double scope | C-7 additive/read-only | C-8 subject scope |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 ship nothing | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| ALT-1 adopt the M2 pack literally | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| ALT-2 add the three `attempts.*` rows deliberately | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 physical-root isolation only | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-4 prevent cross-repository resolution | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-5 selected composite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Ship Nothing; Keep File Inspection

- **Eligibility:** Not eligible (fails C-4, C-5, C-6, C-8).
- **Summary:** Add no read surface and leave the resolve result with its five keys, so operators continue to open state files and handover arguments continue to cite nothing.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-7 trivially by changing nothing. Fails C-4 and C-8 (no successful resolve declares a mode, a repository, or counts), C-5 in substance (no surface reports the divergence count of the repository the gate describes: the delivered summary's `unresolved` is exact but store-wide, the resolve result reports no count at all, and the summary's identifier list is unbounded while the feature spec declares a bound of 20), and C-6 in substance for that same block.
- **Driver fit:** Worst on drivers 1, 4, and 5; neutral on the rest because nothing is added.
- **Pros:** Zero change, zero new surface, zero risk of a wrong projection.
- **Cons:** The change's reason to exist is unserved: evidence stays unreadable from the CLI, the resolve result keeps recording a decision without its basis, and two derivations of the count keep coexisting — one store-wide and live, one uncalled.
- **Why rejected:** It preserves every defect the change was opened to remove.

### Alternative 1 — Adopt the M2 Pack Literally

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-4, C-5, C-6, C-8).
- **Summary:** Implement `attempts.v1` as written: `divergenceRefs[]`, a per-ref read side, three `attempts.*` error rows, exit `1` for "the ref has no attempt history", a resolve that declares `local-evidence` mode when live tracker truth is unreachable, and a divergence count as the pack describes it.
- **Constraint compliance:** Fails C-1 (three new identities in a closed, row-pinned registry), C-2 (the pack's own exit table makes an empty history both exit `0` and exit `1`, and only the success reading is consistent with a ledger keyed by attempt id), C-3 (`divergenceRefs[]` declares a list the record cannot fill beyond one element), C-4 (a mode conditioned on "tracker truth unreachable" implies a live-truth branch resolve does not have), C-5 (no exact count rule is declared), C-6 (no logical repository filter), and C-8 (no repository in the result). Passes C-7 only because it changes no delivered key.
- **Driver fit:** Serves driver 6 superficially (the documents already exist) and fails drivers 2, 3, 4, and 5 outright.
- **Pros:** Nothing to decide; the pack and the product would agree with each other.
- **Cons:** The agreement would be about a contract the delivered registry and record cannot satisfy: three unusable identities, a list with no second element, a mode with no branch, an exit table that contradicts itself, and a read that presents foreign evidence as the operator's own.
- **Why rejected:** It is internally inconsistent with the delivered evidence model on six of eight constraints; adopting it would make the product wrong in order to make the document right.

### Alternative 2 — Add the Three `attempts.*` Rows Deliberately

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Keep the refined semantics (empty history as success, singular reference, unconditional mode, exact counts, double scope) but give the read side its own three identities, widening the registry and syncing its documentation.
- **Constraint compliance:** Passes C-2…C-8. Fails C-1: three identities for a malformed limit, an unreadable store, and an unknown ref are the `input` and `state` cells under new names, and the widening costs a row count pin, a domain-kind pin, a two-segment allowlist entry, a bidirectional documentation sync, and a new way for a code to be paired with the wrong kind and be contained as `fallback.internal`.
- **Driver fit:** Best on driver 2's surface reading ("the read side has its own names") and worst on driver 2's substance (classification total only while codes match their rows), and on driver 3 (least invention) and driver 7 (cost).
- **Pros:** The most legible refusal vocabulary for this one command; no reliance on a general identity to describe a specific malformed flag.
- **Cons:** Three new rows plus a documentation sync plus three pins, for cells whose delivered identities already carry the correct category, retryability, consequence, remediation, and exit; a domain-specific identity for a generic malformed request invites the same request in every future surface.
- **Why rejected:** It buys legibility with permanent registry surface and a class of silent misclassification, and the delivered resolve path already proves the reuse is adequate.

### Alternative 3 — Physical-Root Isolation Only

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** Rely on the two-layer state layout alone: open the project root derived from the checkout identity, return every attempt record found there, and skip both the logical filter and the excluded count.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-4, C-5, C-7, C-8. Fails C-6: the wholesale migration moves a populated pre-migration store — the history of whatever repositories shared it — into one designated project root without re-attribution, so the physical root can hold another repository's attempts; the read would present them as the operator's own and disclose nothing.
- **Driver fit:** Cheap on driver 7 and fatal on driver 4; driver 1 is undermined because the evidence would be someone else's.
- **Pros:** One fewer filter, one fewer envelope field, and no count to explain.
- **Cons:** A cross-repository evidence leak, silent by construction, on exactly the installs the migration produced; no way for an operator to notice; a retro could cite another repository's attempt.
- **Why rejected:** A store is not a repository, and the migration guarantees the difference will be observable.

### Alternative 4 — Prevent Cross-Repository Resolution

- **Eligibility:** Not eligible (fails C-8).
- **Summary:** Refuse to resolve a divergence whose recorded repository differs from the invoking checkout's, or require an explicit `--repo` on resolve so the subject is stated.
- **Constraint compliance:** Passes C-1…C-7. Fails C-8: prevention needs a repository input the delivered resolve grammar does not have, and the delivered grammar's only input is the divergence identifier — so either a refusal (which silently blocks a legitimate close of an inherited divergence) or a new flag (which changes the grammar and the exit projection) is required.
- **Driver fit:** Strongest on driver 4 read literally ("never act on another repository's record") and weak on driver 1 (an obligation whose truth condition moved cannot be closed), driver 5 (a second scoping rule beside the read's), and driver 7 (a grammar change for a case with no operator story).
- **Pros:** No cross-repository write is possible; the isolation property is total on both the read and the write path.
- **Cons:** An operator whose project root inherited another repository's open divergence cannot close it, so the gate stays blocked with no remedy; the refusal names a condition the operator cannot change from where they are; the grammar and its exit projection change for a deferred story.
- **Why rejected:** Refusing an action the operator has a legitimate reason to take, with no way to satisfy the refusal, trades a visible limitation for an invisible block. Disclosure is the bounded step, and the guard is recorded as deferred with its precondition.

### Alternative 5 — Selected: Closed-Taxonomy Read Side and Disclosed-Scope Resolve

- **Eligibility:** Eligible.
- **Summary:** Ship the read side with delivered identities only, empty history as success, a projection no wider than the record, and a twice-enforced repository scope with count-only disclosure; extend the resolve result additively with an unconditional `local-evidence` mode, the divergence's own repository, and the exact unresolved counts under one shared rule; disclose cross-repository resolution and record the guard as deferred.
- **Constraint compliance:** Passes all eight — no identity added (C-1); an unknown ref is success and a store fault keeps its own identity (C-2); sixteen fields, singular `divergenceRef`, one-to-one `endedAt` (C-3); `local-evidence` on every success because resolve has no other branch (C-4); one exact count, repository-scoped, with the documented at-most-20 identifier list and a truncation marker (C-5); physical root plus logical filter plus a count (C-6); additive keys, no evidence writes, no new record or dependency (C-7); the result reports its subject and adds no grammar (C-8).
- **Driver fit:** Best overall: the projection cannot lie about what it read (1), the taxonomy stays total (2), nothing is invented (3), the scope error and the refusal error are both avoided (4), one rule answers each question (5), the surface is reachable through the existing gates (6), and the cost is one verb, one projection, one helper, and gate wiring (7).
- **Pros:** Closed-registry compatibility with zero new rows; a first inspection of a fresh ticket succeeds; the projection cannot promise cardinality or a branch the evidence lacks; both count surfaces report the same exact number; a migrated root cannot leak foreign evidence; the resolve result is citable as evidence of what moved.
- **Cons:** The summary's divergence number moves down on a migrated root and its identifier list narrows to the documented 20 where the store holds more than one repository's records or more than 20 open divergences; a blank note becomes a refusal; the additive resolve keys oblige a consumer that pins an exact key set to accept them; cross-repository resolution stays possible and only disclosed.
- **Why chosen:** See Decision.

## Decision

- **Decision:** Adopt **ALT-5**, recorded as seven rulings that bind together. They share one rule: **a consumer surface may declare only what the durable evidence can supply, and where it cannot know it discloses instead of refusing or inventing.**

1. **D-1 — The read side reuses delivered identities; no row is added (DEC-1).** The proposed `attempts.ref-unknown`, `attempts.limit-invalid`, and `attempts.ledger-unavailable` identities do not exist. A malformed request (a non-canonical ref, an invalid limit, an unknown flag, an unexpected positional), an unresolvable active reference, and an unresolvable repository identity are `input.value.rejected` under `kind: "input"` at exit `1`, with a bounded summary naming the value and its remedy. A store that cannot be read honestly keeps its own `state.*` identity under `kind: "state"` with that row's category, retryability, consequence, remediation, and exit `2`, so a state code is never paired with a domain kind (a wrong pairing classifies to `fallback.internal` and loses the identity). The registry stays at 124 identities and four `dispatch` rows, and no `attempts.*` string is declared, emitted, or documented.
   - **Consequence for later changes:** a read surface over the same ledger inherits this mapping. A new read side that needs a failure identity the delivered registry does not cover is a registry question decided at milestone level, not a story-level addition.

2. **D-2 — A verified empty history is success (DEC-2).** A read that verifies and matches no record exits `0` with `attempts: []`, `matched: 0`, and `hasMore: false`. The ledger is keyed by attempt identifier, so "this reference has no attempts" and "no attempt has been recorded for this reference yet" are the same observation; refusing would make the first inspection of a freshly dispatched ticket fail and would encode a distinction the data cannot support. The converse is equally binding: a torn, unreadable, schema-mismatched, or permission-denied store is never reported as an empty history.
   - **Consequence for later changes:** a surface may only turn an unknown into a refusal when the ledger can distinguish the unknown from the absent. Where it cannot, the honest answer is a success with an empty payload.

3. **D-3 — The projection declares the cardinality and the naming the record supplies (DEC-4, DEC-6).** Each row projects exactly sixteen fields — `attemptId`, `repository`, `ref`, `harness`, `evidenceClass`, `outcome`, `token`, `startedAt`, `endedAt`, `divergenceRef`, `corroboration`, `falseSuccess`, `comparison`, `resumeMode`, `evidenceRefs`, `recordedAt`. `divergenceRef` is **one identifier or explicit `null`**, never a list, because the stored attempt carries at most one reference: an array that can never hold a second element declares a capability the evidence cannot supply and invites a consumer loop over a shape that cannot vary. `endedAt` is the consumer-facing name for the record's finish timestamp and maps one-to-one; `prefillCostAcknowledged` is not projected because it is a run-envelope fact already surfaced there. The projection carries no prompt, transcript, diff, credential, or provider payload.
   - **Consequence for later changes:** a projection field is added only when the durable record carries it. A surface that needs a field the record lacks decides a state-contract change, not a projection widening.

4. **D-4 — `mode: "local-evidence"` is unconditional (DEC-5).** Every successful resolution, including an idempotent replay, declares it. Resolve resolves no credential, performs no network call, and reads no truth source outside the local store and the divergence ledger, so there is no live-truth branch for the field to describe. A condition on the field — for example "when tracker truth is unreachable" — would make the declared mode depend on an input the command never consults and would imply a capability the command does not have.
   - **Consequence for later changes:** if resolve ever acquires a credential port or a truth read, the unconditional mode becomes a false statement and must become a condition or disappear. That is a reopening trigger, not a routine extension.

5. **D-5 — One repository-scoped divergence-count rule, exact on every surface that reports counts (DEC-15).** `unresolved` is the exact number of folded records still `open` **for the reported repository** on both the resolve result and `dispatch dual-run summary`; `resolved` and `reported` derive from the same fold, and the two surfaces consume the same computation, so they cannot disagree. The delivered summary's arithmetic is already exact and must be described as such: `foldEvidenceWindow` folds store-wide with no cap, so `unresolved` is the exact open count and `unresolvedIds` holds every open identifier. What is wrong with it is its **subject**, not its arithmetic — it is exact about the store, not about the repository whose gate the number describes — so the one rule this change creates is a shared **repository-scoped** computation: on a root holding one repository's records the number is unchanged, and it moves only downwards where a migrated root still holds another repository's open divergences. The one delivered list-length derivation — `summarizeDispatchDivergences` deriving `unresolved` and `resolved` from a list it caps at 20 — has no caller and is retired with the change rather than aligned, so no second definition of the count survives for a later surface to copy. On the identifier list the change narrows a delivered field deliberately: `unresolvedIds` now honours the bound the feature spec already documents — "Unresolved divergence ids in a summary — 20" (`doc/spec/features/feature-dispatch-engine.md`, bounds table) — and carries `idsTruncated` true exactly when identifiers were omitted, so a 25-open store returns `unresolved: 25` with 20 identifiers and `idsTruncated: true`, and the human `unresolved_divergences=` line stops printing every identifier. The gate is unaffected: the eligibility predicate tests for zero unresolved, which no exact count changes.
   - **Consequence for later changes:** a new surface that reports divergence counts consumes the shared repository-scoped computation rather than folding the ledger again, and a list bound is declared beside the count rather than used to compute it. The delivered tree shows both ways to get this wrong — a live fold exact about the wrong subject, and an uncalled helper whose list length computes the count — and a third would settle nothing.

6. **D-6 — Repository scope is enforced twice, and exclusion is disclosed as a count (DEC-8).** The read opens the project state root derived from the checkout identity **and** filters each record on its own `repository` against the repository resolved for the invoking checkout. Both rules are required: the wholesale migration can leave one repository's history inside another repository's project root, so the physical root alone would present foreign evidence as the operator's own. Records failing the filter are excluded from `attempts[]` and counted in `excluded.foreignRepository` — a count of records in the ledger read whose repository differs, independent of `--ref`, because it is a statement about the root rather than about the query. Their identifiers never appear in the envelope, its warnings, or the text digest: a count is honest about the root, an identifier discloses another repository's work. Repository identity resolves through the delivered resolver with persistence disabled — a read neither creates nor repairs the first-use marker — and an invocation outside a checkout refuses at exit `1` rather than reporting the host-scoped `unbound` store as some repository's history.
   - **Consequence for later changes:** any new read over per-repository state carries both rules and the count-only disclosure. A surface that filters only on the physical root is a leak; a surface that names excluded records is a disclosure channel.

7. **D-7 — The resolve result reports its subject, and cross-repository resolution is disclosed, not prevented (DEC-9, OQ-1).** The resolve result adds `repository` — the repository recorded on the resolved divergence — and scopes its counts to that repository, because a resolve is an action whose subject is the named divergence and whose only input is its identifier. It adds `divergences` (the shared four-field block plus `idsTruncated`) and `mode`, and it adds one deterministic human line so the counts and the mode are visible without `--json`. When the divergence's repository differs from the invoking checkout's — a case the per-repository split and the wholesale migration can produce — the resolution still runs and the result names the repository it acted on. Prevention is **not** adopted: it needs a repository input the delivered grammar does not have, and refusing would block a legitimate close of an inherited divergence that is holding the gate, with no remedy available from where the operator stands.
   - **Known limitation, recorded:** a cross-repository resolution is visible but not prevented, and the counts it reports describe the divergence's repository, not the invoking checkout's. A guard — a refusal, or an explicit repository input on resolve — requires an operator story that does not exist yet: which repository an operator intends when both are present, and what the remedy is when the intended one is not the invoking one. The guard is deferred (GH-289 §7.3, NG-7) with that precondition as its entry condition.
   - **Consequence for later changes:** a write surface whose subject is a record belonging to another repository states that repository in its result before any guard exists. Prevention is added only with the operator story, and it changes the grammar, so it is a decision of its own.

- **Rationale (tied to drivers):** The read side exists to make handover arguments and retros citable (driver 1), which is only possible if what it reports is exact: exact identity (D-1), exact emptiness (D-2), exact cardinality (D-3), exact mode (D-4), exact count for its stated repository (D-5), exact scope (D-6). Each of the six is cheaper than the alternative it replaces — reuse over three new rows and a documentation sync (driver 2, 7), a singular field over an array with one element (driver 3), an unconditional constant over a conditional field with no branch (driver 3), one shared fold over a live store-wide fold plus an uncalled capped one (driver 5), a filter plus a count over a leak (driver 4). D-7 is the one place the record accepts less than completeness, and it does so deliberately: the alternative is a grammar change with no operator story, and disclosure keeps the action visible in the meantime (driver 7). The whole set reuses the delivered `input`/`state` identities, the delivered local-context seam, the delivered projection conventions, and the delivered gates (driver 6), so the change is one verb, one projection of sixteen fields, one shared helper, and inventory wiring.
- **Record type:** TDR, per GH-289 DEC-16, which routes the curated record as a technical one. The guide's ADR/TDR tie-breaker defaults to ADR when `reversibility: hard` or `blast_radius ≥ team`; the classification records `blast_radius: team` and `reversibility: easy`, so the tie is real. It is resolved toward TDR because the record fixes implementation shape and consumer vocabulary inside an already-decided architecture — the TDR-0005 token and exit taxonomy, the TDR-0015 gate, the TDR-0020 divergence semantics, and the TDR-0022 state root — and changes no delivered interface contract except by declared additive keys on one result. The owner may re-route it at PR review if the blast radius reads as architecture-defining.
- **Decider:** Juliusz Ćwiąkalski (owner). **Authorization:** status `Proposed`; human acceptance is recorded at the GH-289 PR review, `decision_date` is set only then, and a `review_date` is fixed for the first post-implementation retrospective. AI does not accept this R2 record and grants no authority until acceptance.
- **Conditions for revisit:** See `revisit_triggers`; the primary ones are a failure cell with no delivered identity, a relaxed registry, a record that grows a second divergence reference, resolve acquiring a credential or transport, a surface that re-derives a count, an unreliable `repository` field, and an operator story that makes a cross-repository guard affordable.

### Constraint Compliance Attestation

ALT-5 satisfies every constraint C-1 through C-8. No accepted-risk exceptions are taken; no `negotiable: no` constraint is violated. The two accepted consequences below are consequences, not exceptions: D-7's disclosure-only posture is what C-8 *requires*, and the count rule's declared movement — down on a migrated root, plus the summary's identifier list narrowing to its documented 20 — is what C-5 *requires*.

| Constraint | Attestation |
|---|---|
| C-1 | 0 new identities: malformed request, unresolvable context, and unresolvable identity map to `input.value.rejected` under `kind: "input"`; store faults keep their own `state.*` code under `kind: "state"`; the table stays at 124 with 4 `dispatch` rows and no `attempts.*` string exists in code, docs, help, or output. |
| C-2 | An empty verified read exits `0` with `attempts: []`, `matched: 0`, `hasMore: false`; torn, unreadable, and permission-denied reads each exit `2` with their own identity and are never reported as empty. |
| C-3 | Sixteen fields, each present on every row; `divergenceRef` is one identifier or explicit `null`; `endedAt` maps `finishedAt` one-to-one; no undeclared key and no field absent from the record. |
| C-4 | `mode: "local-evidence"` on every success including a replay; spy credential and transport ports assert zero invocations; an unreachable tracker changes nothing because nothing is read. |
| C-5 | One shared repository-scoped computation produces `reported`, `resolved`, `unresolved` (exact folded open count for the repository, which the delivered summary already computed exactly but store-wide), and `unresolvedIds` bounded to the documented 20 with `idsTruncated`; both the resolve result and the summary consume it; 0 count derives from a list length; the summary's identifier list narrowing is a declared change. |
| C-6 | Physical project root plus a logical filter on each record's `repository`; `excluded.foreignRepository` is a count independent of `--ref`; 0 foreign identifiers appear anywhere; identity resolves with persistence disabled; a non-checkout invocation refuses. |
| C-7 | Delivered keys, grammar forms, and exit projections unchanged apart from one verb, two flags, three additive `data` keys, one additive human line, and the summary's one declared narrowing (`unresolvedIds` to the documented 20 with `idsTruncated`); 0 evidence records appended and 0 fences acquired by the read; 0 new record kind, schema version, configuration key, package, or dependency. |
| C-8 | The result names the divergence's recorded repository and scopes its counts to it; the resolve grammar and exit projection are unchanged; a cross-repository resolution is visible in the result and is recorded as a known limitation with its guard deferred. |

## Trade-offs & Consequences

### Positive Outcomes

- Attempt evidence becomes citable from the CLI: a handover argument or a retro can point at a bounded, deterministic, machine-readable history instead of a state file, and every row carries the token, the corroboration triple, the comparison, the divergence reference, and the timestamps the argument turns on.
- The resolve result becomes evidence of what moved: it states that it ran from local evidence, names the repository whose truth condition changed, and reports the counts it left behind — so "unresolved went from 3 to 2" is a quote from the command rather than an inference from the store.
- Classification stays total and the registry stays closed: no reader has to learn a command-specific failure vocabulary, and no code can be paired with a foreign domain kind and silently become `fallback.internal`.
- The taxonomy question is answered once for read surfaces: a future evidence projection inherits "reuse `input` and `state`", "unknown is not failure", "declare only what the record supplies", and "count exactly, disclose as a count".
- A migrated project root stops being a cross-repository evidence channel: the read presents only the invoking repository's attempts, and the summary's `--repo` count finally describes one repository.
- Two derivations of the count collapse into one live rule, and on an unmigrated root the number does not change, so the resolve result and the summary cannot disagree about the number the gate turns on and no second derivation survives for a later surface to copy.

### Negative Outcomes

- **The summary's divergence number moves down on a migrated root and a delivered identifier field narrows — and neither was stated in the change's risk table as first drafted.** The delivered `unresolved` is already exact, but it counts every divergence in the store, so on a root that inherited another repository's records the repository-scoped computation reports a **smaller** number; on an unmigrated root the number does not move at all. Separately, `unresolvedIds` — and the human `unresolved_divergences=` line that prints it — narrows from every open identifier to the documented at-most-20 list with `idsTruncated`, so an operator on a root with more than 20 open divergences sees fewer identifiers than the delivered text printed. GH-289 RSK-6 as drafted in spec v1.2 named an upward movement the delivered code cannot produce; v1.3 corrects it to this downward movement plus the narrowing (B3), and the reconciliation notes should state both.
- **A blank note is a refusal.** A caller must supply a non-blank rationale; the refusal is deliberate (a resolution without a rationale is not evidence), and it is a declared behaviour change on a delivered command.
- **Cross-repository resolution remains possible.** It is visible, not prevented; an operator can still move another repository's truth condition from the wrong checkout, and the only guard is the repository name in the result. This is recorded as a known limitation with a deferred guard, not as a solved problem.
- **Additive keys oblige strict consumers.** A consumer that pins the exact resolve key set must accept three additions; a consumer that requires empty human output on resolve must accept one declared line.
- **Truncation is a contract consumers must honour.** `hasMore` and `truncation` state that a page is a prefix; a consumer that ignores them reads a prefix as a population, and no surface can enforce reading.
- **The projection is a fixed allowlist that must move with the record.** Every future attempt-record field is a projection decision, and the contract test that pins the sixteen-field set is the guard against accidental widening.
- **The identifier list narrows where the delivered output printed every identifier.** `unresolvedIds` is bounded at the documented 20 with `idsTruncated`, so on a root with more than 20 open divergences the summary returns fewer identifiers than the delivered code did and a consumer that needs every identifier has no single-call path to it; the count stays exact, the list does not. This is a declared narrowing of a delivered field rather than a purely additive change, and the marker is what makes the narrowing visible instead of silent.

### Unresolved Questions

- [ ] Whether a guard on cross-repository resolution should be a refusal or an explicit repository input on resolve, and what the operator story is that makes either affordable (owner: Juliusz Ćwiąkalski; GH-289 OQ-1, §7.3).
- [ ] Whether the reconciliation notes and the dispatch reference page should state the summary count's downward movement on migrated roots and the `unresolvedIds` narrowing alongside the resolve result's new block — carrying the corrected statement B3 established, in place of the upward-movement sentence spec v1.2 carried and v1.3 removed (owner: `@doc-syncer`, the GH-289 doc-update phase that owns the feature spec).
- [ ] Whether a repository-level history across all refs is needed by retros, which the per-ref read side does not provide (owner: `@pm`, GH-289 OQ-2, deferred).
- [ ] Whether a cursor or `--before <instant>` form is needed to reach history beyond the 100-row page ceiling without widening the limit (owner: `@pm`, GH-289 §7.3, deferred).

## Implementation Plan

1. **Contracts:** declare the `attempts.v1` data and projection types and the read bounds beside the delivered dispatch constants — page default 20, minimum 1, maximum 100; the machine byte budget 65,536; the human digest budget 40 lines and 8,192 bytes; the retained attempt bound 5,000; the identifier bound 20; the evidence-reference bound 16. Types and constants only; no new record kind, schema version, or product literal.
2. **Pure projection and page helper:** map each stored attempt to the sixteen declared fields (`divergenceRef` singular-or-`null`, `endedAt` from the finish timestamp), order by `startedAt` descending then `recordedAt` descending then `attemptId` ascending, apply the page bound and `hasMore`, apply the byte bound with a declared page omission, and compute the corroboration cell as a closed three-value derivation. Pure functions over already-read records, so determinism is structural.
3. **One divergence-count helper:** replace the summary's live store-wide fold consumption and retire the uncalled `summarizeDispatchDivergences` with a single repository-scoped computation returning the exact folded open count, the exact resolved count, and at most 20 identifiers plus `idsTruncated`. Consume it from the resolve enrichment and from the summary's divergence block, so the two surfaces share one definition and no second derivation survives.
4. **Read runtime:** compose the read over the resolved store and the delivered identity resolver with persistence disabled, resolve the active reference from `.ai/local/pm-context.yaml` when `--ref` is omitted, apply the logical repository filter, and produce the count-only excluded disclosure. Grammar runs before any store open, so a malformed request performs no read.
5. **Command branch, flags, and renderers:** add the `attempts` verb, declare `--ref` and `--limit` as value-taking flags, add the attempts text selector and the bounded digest with its truncation line and coverage/floor pointer, and add the one-line resolve digest. The attempts payload is discriminated by its `attempts` array so no existing selector can mistake it for another form.
6. **Resolve enrichment:** add `mode`, `repository`, and the four-field divergence block (plus `idsTruncated`) to the success payload, preserve the five delivered keys and replay idempotency, and keep the blank-note refusal and the 240-character clamp in their delivered order (clamp before the record is built; refuse before anything is written).
7. **Help, inventory, and pins as one unit:** the family entry gains its usage line, both options, and an example; a fifth help entry is added; the coverage inventory registers the M2 attempts page; the parity pin moves from four to five. Landing them together keeps no intermediate state red.
8. **Documentation:** the M2 attempts page becomes the delivered reference page (resolved exit table, empty-history rule, `command: "dispatch"`, singular `divergenceRef`, declared digest and pointer, stated bounds); the `attempts.v1` contract statement is refined to the singular reference, the unconditional mode, and the count rule; the dispatch feature spec gains the grammar, the read-side section, the resolve fields, the error paragraph's reuse statement, and the bounds; the planning corpus records the delivery.

## Verification Criteria

- **Taxonomy closure:** 0 new error identities; `ERROR_TABLE` at 124 with 4 `dispatch` rows; 0 `attempts.*` strings in the table, the documented table, the specs, the help text, or any output; 0 emitted codes with a kind that does not match their row (Target: 0 / exact counts; Window: AC-F4-4, NFR-5, DEC-1).
- **Empty versus unreadable:** 1 of 1 empty histories exits `0` with `attempts: []`, `matched: 0`, `hasMore: false`; 3 of 3 store faults exit `2` with their own identity and 0 are reported as empty (Target: 100% both directions; Window: AC-F4-2, AC-F4-3).
- **Projection cardinality:** 100% of rows carry exactly the sixteen declared fields with declared types; 100% of absent references are explicit `null`; 0 rows carry an undeclared key; 0 rows carry a divergence reference list (Target: 100% / 0; Window: AC-F2-1, AC-F2-2, AC-F2-3).
- **Mode:** 100% of successful resolutions — first and replay — declare `mode: "local-evidence"`; 0 credential resolutions, 0 network requests, 0 harness spawns, and 0 model calls on any resolve path (Target: 100% / 0; Window: AC-F5-2, NFR-6).
- **Count agreement:** with 25 folded open divergences for one repository, both the resolve result and the summary report `unresolved: 25`, both carry at most 20 identifiers with `idsTruncated: true`, and 0 surfaces derive the count from a list length; the delivered summary already reported 25 and printed all 25 identifiers, so this assertion also pins the declared narrowing rather than a change in the number; one resolution decreases the count by exactly one; on a root holding two repositories' open divergences the reported `unresolved` equals the repository's own open count and not the store's (Target: 25 = 25, exact; Window: AC-F5-5, F-7, NFR-8).
- **Read isolation:** 0 returned attempts whose `repository` differs from `data.repository` across the two-project and migrated-root scenarios; 0 foreign identifiers in the envelope, the warnings, or the text; the excluded count equals the excluded records; 0 identity markers created or repaired by a read (Target: 0 / exact; Window: AC-F3-1, AC-F3-2, AC-F3-3, NFR-4).
- **Read-only posture:** 0 attempt, divergence, handover, or authority records appended; 0 fence acquisitions; store bytes, modes, and mtimes unchanged (Target: 0; Window: AC-F4-1, NFR-3).
- **Additive stability:** 100% of delivered keys in the run envelope, the summary envelope, the handover result, and the five delivered resolve keys keep their name, type, meaning, and order, with one declared exception on the summary's divergence block — `unresolvedIds` narrows to the documented at most 20 identifiers and `idsTruncated` is added on both blocks; 0 new configuration keys, dependencies, packages, tokens, projection classes, or exit literals (Target: 100% / 0; Window: AC-F9-1, AC-F9-2).
- **Reachability:** both help gates green, `dispatch` pinned at 5 entries, the M2 attempts page registered, the see-also target resolving, and the root listing still at seventeen families (Target: exact; Window: AC-F8-1, AC-F8-2).
- **Determinism and bounds:** 2 of 2 repeated runs byte-identical in text and structurally identical in machine data; serialized `data` at most 65,536 bytes; digest at most 40 lines and 8,192 bytes with at most 37 rows beside a truncation line; every bound that binds is declared (Target: exact; Window: AC-F1-4, AC-F2-4, AC-F2-5, AC-F6-3, AC-F6-4).

## Confidence Rating

**High** on the seven rulings. Every load-bearing claim is repo-local and read directly: the singular `divergenceRef` on the attempt record, the attempt-identifier keying and the 5,000-record bound, the resolve's five-key payload and credential-free composition, the delivered `input`/`state` refusal mapping, the 124-row registry with its four `dispatch` rows and its bidirectional sync, the two divergence folds (a live store-wide fold with an uncapped identifier list and an uncalled helper that caps it), the summary's store-wide divergence fold, the delivered active-context seam, and the M2 pack's own contradiction. The rulings are corrections of facts, or declarations about them, not preferences.

**Medium** on two consequences, both named. First, the count becomes repository-scoped, so a migrated root reports a smaller number than the delivered summary and the summary's identifier list narrows to the documented 20; the magnitude depends on how many installs carry multi-repository roots, which no repository artefact measures, and there is no upward movement to declare because the delivered arithmetic is already exact. Second, disclosure-only cross-repository resolution assumes an operator who reads the repository name in the result; that assumption is recorded as `TO-CONFIRM` and is the precondition for the deferred guard. AI-generated confidence is not evidence; the owner's decision at the GH-289 PR review is authoritative, and this record stays `Proposed` until then.

## References

- [GH-289 change specification](../changes/2026-11/2026-11-11--GH-289--evidence-inspection/chg-GH-289-spec.md) — F-1…F-9, DM-1…DM-6, §8.3, §8.5, §15 DEC-1…DEC-16, §15.1, §17 AC-F1…AC-F9, Appendix B (scenario reconciliation), Appendix C (M2 page corrections), Appendix D (normative read-side field set).
- M2 contract statement for the read side: [`attempts.v1`](../planning/oss-tooling/milestones/m2/contracts.md) — the proposal this record refines (§ `divergenceRefs[]` → singular; conditional `local-evidence` mode → unconditional; per-ref read side retained).
- M2 reference-page proposal: [`attempts(1)`](../planning/oss-tooling/milestones/m2/commands/attempts.md) — its three proposed error rows, its self-contradicting exit table, and its envelope and text examples are superseded by D-1, D-2, and D-3.
- [Dispatch engine feature spec](../spec/features/feature-dispatch-engine.md) — the grammar, the attempt/divergence/handover record contract, the local-only resolve paragraph, the gate conditions, the bounds table, and the error paragraph the read side extends.
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the token vocabulary, projection classes, and exit derivation reused unchanged.
- [TDR-0015](TDR-0015-dispatch-handover-gate-operational-semantics.md) — the gate's truth, coverage, floor, and corroboration conditions; the unresolved count this record reports exactly is the count that gate turns on.
- [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md) — the delivered-evidence divergence shape, the local-only resolve guarantee, the note clamp, and the `input`/`state` refusal mapping this record reuses.
- [TDR-0022](TDR-0022-multi-repository-workstation-state-scope.md) — the host and project root layout, the marker-minted identity, and the rule that a store is not a repository; the wholesale migration is why D-6 needs both enforcement layers.
- Delivered seams: `packages/core/src/contracts/dispatch.ts`, `packages/core/src/contracts/error-table.ts`, `packages/core/src/app/dispatch-ledger.ts`, `packages/core/src/app/dispatch-gate.ts`, `packages/core/src/domain/dispatch-gate.ts`, `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/help.ts`.
- Delivered gates: `tests/checks/error-table-sync.test.ts`, `tests/structure/dispatch-error-identity.test.ts`, the help-coverage gate, and the reference-page parity pin.

## Revision

### 2026-11-11 — alignment with verified delivered behaviour (readiness finding B3)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-289 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-289 readiness review iteration 1, finding **B3** (`doc/changes/2026-11/2026-11-11--GH-289--evidence-inspection/readiness-review/readiness-iter-1.md`), which re-derived the delivered summary's divergence computation from source rather than from the change artifacts.
- **What this record had wrong:** the first draft's D-5 justified the count rule as if the delivered summary derived its count from a 20-capped identifier list. It does not. `foldEvidenceWindow` (`packages/core/src/domain/dispatch-gate.ts` lines 141–153) folds divergences store-wide with no cap: `unresolved` is already the exact open count, `unresolvedIds` is every open identifier, and `packages/cli/src/output/dispatch-text.ts:67` prints all of them. The capped list-length derivation — `unresolved` as list length and `resolved` as `folded.length - list.length` — exists only in `summarizeDispatchDivergences` (`packages/core/src/app/dispatch-ledger.ts` lines 282–296), which has no caller and which GH-289 deletes.
- **Corrected statement now carried by D-5:** the delivered `unresolved` is already exact and store-wide; the one rule this change creates is a shared **repository-scoped** computation; the summary's `unresolvedIds` and its human `unresolved_divergences=` line narrow to the at-most-20 list the feature spec already documents, with `idsTruncated`; and the uncalled capped-list helper is retired rather than aligned, so no second derivation survives. The change's real effects on reported numbers are therefore three: the count moves **down** on a migrated root (the store-wide subject is corrected), the resolve result gains a divergence block, and a delivered identifier field narrows to its documented bound while the count stays exact.
- **Sections amended in this revision:** Context (the two divergence-fold facts), Problem Framing item 2, driver 1 and driver 5 wording, the two-folds evidence row, Mental Models (second-order thinking), Alternative 0 and Alternative 5, the Rationale, C-7's statement and verification (the narrowing is now named there as an exception), the C-5 and C-7 attestation rows, **D-5** (rationale rewritten; the ruling itself is unchanged), Trade-offs (the positive count sentence and both negative bullets), Implementation Plan item 3, Verification Criteria (count agreement and additive stability), the Confidence Rating, and the third unresolved question. **D-1, D-2, D-3, D-4, D-6, and D-7 are unchanged**; the remaining constraint text (C-1…C-6, C-8), the alternative set, the DACI assignment, and the status are unchanged.
- **Spec alignment:** readiness finding B3's remediation of `chg-GH-289-spec` **v1.3** (§8.5, RSK-6, AC-F7-1, F-7, F-9) states the same three movements — the counts are already exact and store-wide, so on an unmigrated root they do not move; they narrow to the declared repository's records on a migrated root; and `unresolvedIds` narrows to the documented 20 with `idsTruncated` — and retires the uncalled helper's derivation in the same terms. This note is B3 remediation item 5 and makes this record and spec v1.3 say the same thing. The bound the summary now honours is the one already documented in `doc/spec/features/feature-dispatch-engine.md` (bounds table, "Unresolved divergence ids in a summary — 20"). No source, spec, plan, or test file was changed by this alignment.
