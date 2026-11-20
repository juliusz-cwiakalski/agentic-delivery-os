---
id: TDR-0071
decision_type: tdr
status: Proposed
created: 2026-11-20
decision_date: null
last_updated: 2026-11-20
summary: "`merge` takes the change branch from exactly one declared source — an optional top-level `branch` key on the change's committed pm-notes document, read through the delivered pm-notes text read — matches exactly one open delivery request whose provider-asserted source ref equals that value as an exact string, and binds the fresh-head comparison, the check-run page read, the landing's expected head, the reported head, and the dry run's appended verification record to that request's asserted full-SHA head; absence, an unusable value, zero or multiple matches, a saturated bounded page, or a match without a full-SHA head refuses `merge.branch-unresolved` or `merge.request-unresolved` with a closed reason naming the cause (the branch refusal with zero provider reads and zero landing calls), and the checkout's own branch and head are never candidates, so a verdict describes the object the merge would land."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os merge primitive (change-branch resolution, delivery-request identity, resolved-head binding)"
decision_scope: repo
review_date: null
business_impact: "Every repository that installs the delivery tooling acquires one authored obligation per change: the change branch is declared on the change record instead of being implied by the operator's checkout. The return is that a merge verdict is about the change's delivery request, which is the object the landing mutates."
customer_impact: "A coordinator may run `merge` from the integration base and obtain a verdict about the request, or a refusal naming the missing declaration or the unresolved request. A change whose record declares no branch cannot merge until the one-line declaration is authored and committed; there is no fallback, by design."
classification:
  domains: [architecture, contracts, operations]
  archetype: design
  environment: complicated
  rigor: R3
  reversibility: easy
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-366 spec §15 DEC-1 and DEC-2 route the branch source and the head binding here as precedent-setting; §24-C reserves TDR-0071 for exactly this scope)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-366 PR review; AI does not accept this R3 record, so status stays `Proposed` with `decision_date: null` until that review accepts it"
  contributors:
    - "@spec-writer (chg-GH-366-spec §5.1 F-1, §8.1 API-1/API-2, §8.3 DM-1/DM-2, §8.4, §8.5, §9 NFR-2/NFR-6/NFR-10, §15 DEC-1/DEC-2/DEC-8/DEC-9, §17.1, §19, §24-A, §24-B)"
    - "@decision-advisor (repository analysis of the merge composition, the merge transaction's head and freshness path, the delivered pm-notes read, the delivered open-request resolution rule, the error table, the merge feature spec, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "@decision-critic — R3 independent challenge NOT yet performed; the verification surface it must cover is listed under Independent Challenge Status"
    - "Human owner (GH-366 PR review — this record fixes which object a merge verdict is about and what refusal a repository inherits)"
  performers:
    - "@coder (GH-366: the one local change-record read, the branch declaration resolution and its refusal, the exact-match request resolution with the saturation and head guards, the head binding across the transaction, the deletion of the branch-name parse)"
    - "@spec-writer / @pm (the statements this record refines, listed in DC-7)"
    - "@doc-syncer (GH-366 documentation phase: `feature-merge-verify-deploy.md`, the change-lifecycle guidance for change records, the `merge` reference page, and the machine plus documented error tables)"
  informed:
    - "Every coordinator and operator who runs `merge` (the declaration is an authored obligation; the two refusals are new causes to recognise)"
    - "Every in-flight change owner (one line must be authored and committed before the change can merge; spec §19, RSK-1)"
    - "Adopters of the delivery tooling (the same obligation arrives with the release note)"
    - "The `verify gates` battery follow-on owner (OQ-3) — this record binds the merge path, not the battery's resolution"
    - "@pr-manager (unchanged: it never merges; the platform merge command remains not the primary path)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers:
    - "@decision-critic — NOT yet performed. No PASS, PASS_WITH_RISKS, or REWORK verdict has been issued for this record"
revisit_triggers:
  - "A second source for the change branch is proposed (a configuration key, a spec front-matter key, a folder-name or `change.type` derivation, or a provider-list authority): reject by this record, or re-open it as a new decision. Two authorities make a run unable to say which branch the verdict describes."
  - "A fork-origin delivery request is a supported flow: exact equality on the provider-asserted source ref (for GitHub a `owner:branch` head ref) is then no longer the declared branch string, and the matching rule plus the declaration's meaning are re-decided rather than patched with a prefix rule."
  - "The open-request page saturates in normal operation (100 open requests under the delivered limit): the ambiguity refusal becomes routine and the bounded list read needs its own policy decision."
  - "An already-merged change must converge without a branch declaration: convergence currently sits behind the declaration refusal, and moving it earlier costs a provider read on the refusal path — a decision, not a reorder."
  - "A delivery command is asked to author the declaration (OQ-1): that is a change-lifecycle writer decision, and it must keep the declaration a reviewed change fact rather than a run-time inference."
  - "`verify gates` is asked to resolve its branch from the change record (OQ-3): this record explicitly does not bind the battery, whose record-producing path still keys on the checkout, so a merge record produced from a base checkout remains the operator's step."
  - "The declared branch cap is contested or a repository needs a longer value: the cap is a declared constant, and changing it is a constant change with a determinism and refusal test, not a configuration key."
  - "The checkout's head is re-introduced anywhere on the merge path (for example to resolve containment or to shorten a read): the ambient-head absence proof is part of this decision's contract and a new consumer re-opens it."
links:
  related_changes: ["GH-366"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-spec.md"
    - "doc/spec/features/feature-merge-verify-deploy.md"
    - "doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md"
    - "doc/spec/features/feature-verify-gates.md"
  contracts:
    - "packages/cli/src/production.ts"
    - "packages/cli/src/edge.ts"
    - "packages/core/src/domain/merge-transaction.ts"
    - "packages/core/src/domain/verify-gates.ts"
    - "packages/core/src/contracts/verify-gates.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/adapters/src/file/pm-notes-parser.ts"
  diagrams: []
  decisions: ["ADR-0012", "TDR-0031", "TDR-0055"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S3"]
---

# TDR-0071: Change-Branch Resolution from the Change Record and the Delivery Request's Head as the Verified Head

> **Traceability.** Spec §15 **DEC-1** (one declared branch source, no derived fallback) and **DEC-2** (the resolved request's asserted head is the resolved head); §24-C reserves this record; §5.1 F-1; §8.1 API-1/API-2; §8.3 DM-1/DM-2; §9 NFR-2/NFR-6/NFR-10; §17.1 AC-F1-1…AC-F1-5, AC-F5-1/AC-F5-2, AC-F3-2; §19 seeding; §24-A the normative resolution order. Sibling records own the adjacent decisions: TDR-0072 (required-check authority and default gate membership) and TDR-0073 (refusal diagnostics contract and emitted-identity totality).

## Context

`merge` is the lifecycle landing path: it consumes a gate-verification record, enforces a freshness envelope, probes the tracker and CI, and lands through exactly one provider-side call. Every one of those steps needs two identities — *which change branch* and *which head commit* — and today both identities come from the operator's checkout rather than from the change.

- **FACT:** The production composition assigns the merge branch from the checkout's own git facts: `const mergeBranch = resolvedRepositoryFacts.head.branch;` under the doc comment "The checkout's own current branch, read from its git facts" (`packages/cli/src/production.ts:2394-2395`, read 2026-11-20). The merge composition holds no change-record branch source at all; the only change-record read in that composition obtains the pm-notes `milestone` (`production.ts:2620-2625`).
- **FACT:** The transaction's only head source is the `readHead` port (`packages/core/src/domain/merge-transaction.ts:135`), wired to the checkout: `readHead: () => composition.git.head()` (`packages/cli/src/edge.ts:1566`, read 2026-11-20). One value feeds the freshness comparison (`merge-transaction.ts:575-587`), the check-run page read (`:596`), the landing's expected head (`:867-873`), the checks posture comparison (`:993`), and the appended verification record's identity (`:1273`); this change's API contract adds the reported resolved head as one more consumer.
- **FACT:** Request identity is resolved by listing open requests with gate facts (`production.ts:2496-2499`) and taking the first entry whose `sourceRef` equals that checkout branch (`:2500-2503`); the bounded list page doubles as the request-detail read (`:2504-2507`). When no entry matches, the composition recovers a change ref by parsing the branch name (`changeRefInBranch`, `:475`, called at `:2510`) and looks for a merged request (`:2512-2516`); otherwise it returns `merge.transaction-aborted` (`:2518`).
- **FACT:** The delivered `branch` value reaches the transaction only as `MergeTransactionConfig.branch` (`merge-transaction.ts:162`), passed conditionally from the composition (`production.ts:2582`), and its sole consumer is post-landing branch deletion, which first restores the checkout to the base and then deletes that branch (`merge-transaction.ts:884-887`; `edge.ts:1571-1578`). A merge invoked from the integration base therefore names the integration base for deletion after a successful landing.
- **FACT:** The pm-notes document has no closed key set: "Every extra top-level key, phase key, or entry key is opaque: it is preserved and never inspected" (`doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md:36`), and every document-writing branch preserves extras value-faithfully (`:77`).
- **FACT:** The committed change record is already read by a production composition through one delivered local read: `readPmNotesText({ changeRef, changesDirectory, fs })` returns the located path, the text, and the parsed value (`packages/adapters/src/file/pm-notes-parser.ts:198-210`), and the closeout composition consumes the `milestone` key from it (`production.ts:2620-2625`). An absent record answers `{ ok: false, reason: "missing" }`; an unreadable or malformed one carries the located path.
- **FACT:** An exact-equality resolution rule with a bounded page already exists on the battery side: `resolveOpenPr` filters `item.sourceRef === branch` with no prefix or substring matching, treats a saturated bounded page as ambiguous, and answers `branch-unresolved`, `no-open-pr`, `branch-mismatch`, `ambiguous-open-pr`, or `resolved` (`packages/core/src/domain/verify-gates.ts:186-229`; page saturation at `:98-99`; open-request limit 100 at `packages/core/src/contracts/verify-gates.ts:146`). It keys on the checkout branch and a detached-HEAD fact, which is exactly what the merge path may not do.
- **FACT:** The merge error table carries no branch-resolution or request-resolution row today (`grep "branch-unresolved|request-unresolved"` over `packages/core/src` finds only battery-side gate reasons), and `merge.transaction-aborted` declares `retryable: true` with the remediation "Clear the named pre-mutation condition and retry" while receiving request and work-item not-found reads (`packages/core/src/contracts/error-table.ts:960-968`; `production.ts:2456-2460`).
- **FACT:** GH-366 authors its own declaration so the change is mergeable by its own contract: `branch: fix/GH-366/merge-command-conformance` (`chg-GH-366-pm-notes.yaml:5-8`).
- **Why now:** The observed failures are one defect seen twice. A run started from the integration base reproduced evidence about the base tip and could report `result=verified` for a head unrelated to the change; and a run whose request could not be matched from that branch surfaced as an opaque abort. Both follow from the same root cause: the merge path's identity inputs are ambient checkout facts, so the verified object and the merged object can differ without any code being "wrong" relative to its own contract. That contract is written down and has to move with the behaviour: the merge feature spec states the branch comes "from the checkout's git facts" (`doc/spec/features/feature-merge-verify-deploy.md:36-45`) and that the recorded head must equal "the current head" (`:160-165`).

## Problem Framing (Clarified)

The symptom is "a merge run verified the base". The cause is that `merge` resolves the two identities that decide what it verifies and what it lands from the invocation's environment:

1. **Which branch is the change branch?** Today: whichever branch the checkout happens to be on. That value then selects the delivery request. So the selection is circular — the request is chosen to match the checkout rather than to match the change.
2. **Which head is the verified head?** Today: the checkout's `HEAD`. The freshness envelope compares a record against it, the check-run page is read for it, and the landing's expected head is it. If the checkout is on the base, all three are about the base — and the run is internally consistent while being externally wrong.
3. **What happens when the environment cannot answer?** Today: a name parse guesses a change ref, and when the guess also fails the operator receives a generic abort that names no condition.

Stated as decision questions:

- **Q1 — Authority.** Which committed artifact is the one place a change declares its branch, and what does its absence mean? *(A declaration that governs, or a value that is inferred?)*
- **Q2 — Identity.** How does one declared branch become exactly one delivery request, and what happens when it becomes zero or several? *(Exact match with a refusal, or a ranking/heuristic?)*
- **Q3 — Binding.** How far does the matched request's head reach? *(Only the report, or the freshness comparison, the probe, the expected head, and the dry run as well?)*

**The non-obvious part, stated because it is the whole decision.** Q1 and Q3 are one question wearing two hats. Removing the checkout branch assignment while leaving `readHead` on the checkout head changes the *label* on the verdict and nothing else: the run would resolve the right request, then compare the record to the checkout's `HEAD`, read the check-run page for the checkout's `HEAD`, and land with the checkout's `HEAD` as the expected head. That is the same defect with a better-looking report. Deciding the branch source without binding the head is a partial delivery that is worse than neither, because the report now claims the change while the evidence is still about the base. This record therefore decides them together, and §Implementation Plan forbids a mixed state.

**Deliberately out of scope, so the boundary is reviewable.** No required-check authority or gate membership (TDR-0072). No refusal-diagnostics contract, retryability rule, or `merge.work-item-unresolved` row (TDR-0073); this record decides only the two rows its own causes reach. No automatic writer for the declaration (spec NG-5, OQ-1). No battery-side resolution (OQ-3): `verify gates` keeps its delivered resolution, so a base-checkout dry run produces a record about the *request* head while the battery's own records still describe the checkout it ran in. No convergence-before-resolution policy. No branch-naming grammar.

## Constraints (Hard Requirements)

These are the gates an alternative must pass to be *eligible*. Each is independently sourced from the change's acceptance criteria, NFRs, and non-goals; requirements that merely restate this record's chosen design are stated later as decision-derived rules and are **not** used to eliminate alternatives.

### C-1: No new configuration key, state record kind, schema version, or provider capability

- **Statement:** The branch declaration is an additive top-level key on the existing committed change artifact. The configuration key set is unchanged (no `merge.<something>` key names a branch), no state record kind or payload schema version is added, and no new provider operation, capability, scope, or credential reference appears. The two new refusal rows introduce no capability.
- **Source:** AC (spec §8.5, §7.1, NFR-2/NFR-6, DEC-9, DM-1; NG-1, NG-3)
- **Verification:** test (configuration key-set equality with its pin; record-kind and schema-version inventories equal their pins; adapter capability and operation sets equal their pins) + code review
- **Negotiable:** no

### C-2: Fail closed, never fall back to ambient state

- **Statement:** A change record that declares no branch, or declares an unusable value (empty, whitespace-bearing, control-character-bearing, or over the declared cap), refuses `merge.branch-unresolved` naming the change-record path and the key, with zero provider reads and zero landing calls. The checkout's branch is never a candidate, the checkout's head is never the verified head, and no run-time derivation (change-folder slug, spec `change.type`, ref arithmetic, provider list) supplies a substitute.
- **Source:** AC (spec F-1 steps 1–2, AC-F1-1, AC-F1-3, AC-F5-2, NFR-6; DEC-1)
- **Verification:** test (the refusal is observed against a provider double that fails the test if any provider read occurs; a production-source scan for the checkout branch and checkout head reads on the merge path, with a mandatory failing control) + code review
- **Negotiable:** no

### C-3: Additive within v1, and exactly the two error rows this decision owns

- **Statement:** `merge.branch-unresolved` and `merge.request-unresolved` are the only identities this record adds, and both are additive: no existing code changes identity, exit, category, consequence, or projection. `merge.work-item-unresolved` is the sibling record's scope and is not decided here. `merge.transaction-aborted` no longer receives the two causes these rows now carry, while its code, category, consequence, and projection are unchanged.
- **Source:** AC (spec §7.1, §8.5, AC-F1-3, AC-F1-4, Appendix B; DEC-6; §24-C)
- **Verification:** test (the error-row inventory delta equals exactly these two codes; every pre-existing merge row's fields are byte-identical to their pin; the machine and documented tables move together) + code review
- **Negotiable:** no

### C-4: Bounded reads, no retry, no pagination

- **Statement:** Per invocation the resolution uses one local change-record read, one bounded open-request list read, and one request-detail read — and, in the delivered composition, the list read *is* the detail read (`production.ts:2504-2507`), so no read is added. Zero retries and zero pagination anywhere on the path. The branch refusal performs zero provider reads. The invocation's total stays within the spec's read budget.
- **Source:** AC (spec NFR-2, NFR-10, AC-F1-3)
- **Verification:** test (per-invocation read counts on the success, branch-refusal, request-refusal, and stale paths; the branch-refusal path asserts zero provider reads) + code review
- **Negotiable:** no

### C-5: The verification surface is the spec's 22 acceptance criteria

- **Statement:** The change's acceptance criteria (spec §17: AC-F1-1…AC-F1-5, AC-F2-1…AC-F2-7, AC-F3-1…AC-F3-6, AC-F4-1, AC-F5-1…AC-F5-3) are the verification surface. **This decision binds:** AC-F1-1, AC-F1-2, AC-F1-3, AC-F1-4, AC-F1-5, AC-F5-1, AC-F5-2, and AC-F3-2 (the credential refusal reached on the resolution's request-list read names the reference, the environment variable, and the operation). It touches AC-F3-1 and AC-F3-6 only to the extent that the two rows it owns must name their cause and must not overstate retryability; their wording and the row-level honesty rule are TDR-0073's.
- **Source:** AC (spec §17.1, §17.5, §17.3)
- **Verification:** test (the planned cases for those criteria, including the prefix-collision control and the both-SHAs stale refusal) + review
- **Negotiable:** no

### C-6: The branch is a declared change fact, not invocation state

- **Statement:** The value is authored with the change and committed with it, so it is reviewed in the change's diff and read from the artifact at run time. It is not derived, not inferred from a naming convention, and not taken from the provider's list. The declaration carries no schema version and no other surface may read it.
- **Source:** internal standard (the system's declared-sources rule) + AC (spec §8.5, DEC-1, DM-1)
- **Verification:** code review (the only reader is the merge resolution) + test (a changed declaration changes the resolved branch; a stale or absent one refuses)
- **Negotiable:** no

### C-7: Exact equality only for request identity

- **Statement:** Exactly one open delivery request whose provider-asserted source ref equals the declared branch, compared as an exact string. No prefix, suffix, glob, or change-ref-substring matching exists. A bounded list page that saturates cannot establish uniqueness and is therefore ambiguous. A matched request whose asserted head is absent or not a full hex SHA is a head-unresolved condition. No branch-name grammar is validated beyond usability.
- **Source:** AC (spec F-1 steps 3–4, AC-F1-4, AC-F2-4 delivered full-SHA rule)
- **Verification:** test (a prefix-colliding branch does not match; a saturated page refuses as ambiguous; a short or absent head refuses `head-unresolved`; a valid full-SHA head resolves) + code review
- **Negotiable:** no

### C-8: One resolution for the dry run and the real merge

- **Statement:** Both invocations resolve the branch, the request, and the head through the same resolution and report the same resolved object (branch, resolution source, request identity, resolved head). The dry run's appended verification record carries the resolved head as its identity; the dry run still writes no waiver, no transaction, no git mutation, and never reports `result=merged` or `squash=`.
- **Source:** AC (spec F-5, AC-F5-1, AC-F5-2, API-2)
- **Verification:** test (one fixture, one context: the two reports' resolved objects are equal; the dry run's record head equals the resolved head; zero mutation assertions stay green) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below keeps the delivered determinism and offline guarantees (NFR-1, NFR-4), the declared output bounds (NFR-3), secret hygiene (NFR-9), the unchanged effective gate-set identity (NFR-8), and zero landing calls on any refusal. None of these eliminates an alternative.

## Decision Drivers

1. **The verdict must describe the object that lands.** This is the change's reason to exist; a pre-flight or verification verdict about a different object is actively worse than no verdict.
2. **One declared authority, reviewable before the run.** A branch that appears in the change's diff can be reviewed, blamed, and corrected; a value inferred at run time can only be explained.
3. **Fail closed over convenience.** A named refusal that says "this change declares no branch" costs one authoring act; a fallback silently reintroduces exactly the ambient coupling being removed.
4. **No new surface.** The cheapest correct mechanism adds no configuration key, no schema, no record kind, no capability, and no read.
5. **Paved road.** Reuse the delivered pm-notes read, the delivered exact-match resolution shape, the delivered request list/detail read, and the delivered error table rather than inventing a parallel mechanism.
6. **Determinism and offline provability.** A local artifact read plus a pure exact match is testable with no provider and no clock; the ambient checkout is a hidden input that makes the same fixture behave differently in two directories.
7. **Operator legibility.** The refusal names the path, the key, the branch, its resolution source, and the counts observed, so the repair is obvious and the run is diagnosable.
8. **The pre-flight must be true.** A dry run is worth running only if it describes the object the merge would land.
9. **Adopter cost is stated, not hidden.** The new obligation is one line per change; it must be documented where a change is authored, not discovered at merge time.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-366 spec §15 routes DEC-1 and DEC-2 here as precedent-setting, and §24-C reserves TDR-0071 for this scope.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-366 PR review. AI does not accept this R3 record.
- **Contributors:** `@spec-writer` (F-1, API-1/2, DM-1/2, §8.4, §8.5, NFR-2/6/10, DEC-1/2/8/9, §17.1, §19, §24-A/B); `@decision-advisor` (merge composition and transaction analysis, delivered pm-notes read, delivered resolution rule, error table, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, `@decision-critic` (R3 independent challenge — **not yet performed**; its surface is listed under Independent Challenge Status), and the human owner.
- **Performers:** `@coder` (the change-record read and declaration resolution, the exact-match request resolution with its saturation and head guards, the head binding, the deletion of the branch-name parse); `@spec-writer` / `@pm` (the statements listed in DC-7); `@doc-syncer` (merge feature spec, change-lifecycle guidance, merge reference page, machine and documented error tables).
- **Informed:** every coordinator and operator who runs `merge`; every in-flight change owner; adopters; the `verify gates` follow-on owner (OQ-3); `@pr-manager`.

**Rigor note.** Classified **R3**, not R2: the decision changes what a `verified` verdict means for the landing authority, ships a fail-closed refusal that every in-flight change and every adopter must satisfy before merging, and sets a precedent the battery side is expected to inherit. Reversibility is `easy` and uncertainty `low`, which is why the record is short on speculation — but the assurance this needs is a challenge and a human decision, not a lighter record. `@decision-critic` has **not** run; no verdict is claimed.

**Type note.** Authored as a **TDR** because the caller reserved TDR-0071 and the decision is a resolution-authority contract inside the established landing architecture ([ADR-0012](ADR-0012-provider-side-merge-landing-path.md)): no component boundary, no new mechanism, no interface family, no protocol change. The tie-breaker would prefer an ADR at `blast_radius >= team`, and `team` is declared honestly here (every in-flight change, every adopter). If the owner reads the resolution authority as architecture-defining, the record is **re-typed as an ADR at acceptance** — the classification changes, not the decision.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The merge branch is assigned from the checkout's git facts, with no change-record branch source in the composition. | FACT | `packages/cli/src/production.ts:2394-2395`; the only change-record read is `:2620-2625` (read 2026-11-20) | If a change-record branch source already existed, C-1's cost claim and ALT-0's characterisation would be wrong. | High |
| The transaction's head is the checkout's `HEAD`: `readHead` is wired to `composition.git.head()`, and the transaction uses that one value for the envelope, the check-run page, the expected head, the checks posture, and the appended verification record's identity. | FACT | `packages/core/src/domain/merge-transaction.ts:135,575-587,596,867-873,993,1273`; `packages/cli/src/edge.ts:1566` (read 2026-11-20) | If any of those consumers read a different head, head binding would be partial and the defect would survive. | High |
| Request identity is resolved by an exact `sourceRef` match on the checkout branch, then a branch-name parse, then the generic abort. | FACT | `production.ts:2496-2518,475` (read 2026-11-20) | If a declaration already drove the match, the branch authority would be a rename rather than a decision. | High |
| The delivered `branch` config value is consumed only by post-landing branch deletion, which first restores the checkout to the base. | FACT | `merge-transaction.ts:884-887`; `edge.ts:1571-1578` (read 2026-11-20) | If the branch already fed verification, the binding would be partly delivered and the blast radius smaller. | High |
| The pm-notes document has no closed key set and preserves every extra top-level key value-faithfully through every document-writing branch. | FACT | `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md:36,77` (read 2026-11-20) | A closed key set would make the declaration a lint change, which C-1 forbids. | High |
| The committed pm-notes document is readable through one delivered local read that returns the located path and the parsed value, and a production composition already consumes it. | FACT | `packages/adapters/src/file/pm-notes-parser.ts:198-210`; `production.ts:2620-2625` (read 2026-11-20) | A new parser or a second change artifact would be needed, raising cost and drift risk. | High |
| The delivered battery resolution uses exact `sourceRef` equality, treats a saturated bounded page as ambiguous, and has no prefix or substring matching. | FACT | `packages/core/src/domain/verify-gates.ts:98-99,186-229`; `packages/core/src/contracts/verify-gates.ts:146` (read 2026-11-20) | The merge path would need its own novelty to justify a different rule, which driver 5 disfavours. | High |
| No merge row named `merge.branch-unresolved` or `merge.request-unresolved` exists today; `merge.transaction-aborted` declares `retryable: true` and receives request not-found reads. | FACT | `packages/core/src/contracts/error-table.ts:960-968`; `production.ts:2456-2460`; repository grep (read 2026-11-20) | If a row already existed, C-3's "exactly two" would be wrong and the change's count pins would move differently. | High |
| In a healthy flow exactly one open delivery request has the change branch as its provider-asserted source ref. | ASSUMPTION | Spec §12; a second match is declared an anomaly the change refuses rather than ranks | If duplicates are normal, `ambiguous-open-request` becomes routine and the change needs a ranking policy it deliberately does not have. | Medium |
| A change being merged has a readable committed change record at the path the delivered read targets. | ASSUMPTION | The change lifecycle requires the change folder and its pm-notes; `readPmNotesText` answers `missing` when it cannot locate one | If a mergeable change can lack a record, the branch refusal has no path to name and the row reaches a second cause (see DR-3 and Unresolved Questions). | Medium-High |
| The provider returns the branch name verbatim as the request's source ref for same-repository requests, with no normalization. | ASSUMPTION | The delivered battery rule compares `sourceRef` exactly and the merge composition already does the same | Exact equality would produce a false `no-open-request` for a fork-origin request (GitHub asserts `owner:branch`), which the revisit triggers address. | Medium-High |
| A repository has fewer open delivery requests than the bounded page limit, so the bounded read can establish uniqueness. | ASSUMPTION | The delivered limit is 100 (`contracts/verify-gates.ts:146`); saturation is treated as ambiguity | If saturation is normal, the request resolution refuses routinely and the list read needs its own policy. | Medium-High |
| Whether the declared branch cap should carry a specific numeric constant, and what the refusal's exact summary and remediation wording is. | TO-CONFIRM | Spec F-1 step 2 names "the declared cap" without a value; wording is the change's | A missing cap makes the over-cap condition undecidable; the record requires a declared constant, the value is plan-pinned. (owner: `@spec-writer` / `@coder` at plan time) | Medium |
| Whether an absent change record deserves its own closed reason or row rather than riding the branch refusal. | TO-CONFIRM | Spec F-1 covers a record that declares no branch, not a record that is absent | If the owner wants them separable, that is a fourth reason or a third row — outside this record's two-row scope. (owner: the human owner at the GH-366 PR review) | Medium |

## Mental Models & Techniques Used

- **First principles:** What must be true for "the verdict is about the object that lands" to hold? (i) one branch identity, (ii) one head identity, (iii) one equality that ties the evidence to that head, (iv) one landing at that head, (v) an honest refusal at every join. Five requirements produce one declared key, one exact match, and one head value — and rule out every mechanism that buys convenience by re-admitting ambient state.
- **Inversion:** How could this change make the system worse than before? Reintroduce a fallback "just for this one case"; match on a prefix so a same-family branch resolves; bind the branch but not the head; read the provider before deciding the branch is missing (turning a zero-read refusal into a network operation); let a bounded, saturated page prove a negative; name a refusal whose remediation does not apply to it. Each inversion is answered by a gate or a decision-derived rule below.
- **Second-order thinking:** Two consequences are not obvious from the goal. First, removing the branch read while keeping the head port leaves the defect intact behind a better report — which is why the two bindings are decided and delivered together. Second, the `branch` value already feeds post-landing deletion, so a base-checkout run names the *base* for deletion after a successful landing; the same declaration that fixes verification also fixes what gets deleted, and that is a safety improvement nobody asked for but everyone gets.
- **Systems thinking:** The chain is: change ref → change-record read → declaration → bounded open-request list → exact match → asserted head → freshness comparison → check-run page → gate verdicts → expected head → landing → report. Each join is a place where an ambient fact can be substituted for a declared one. The decision pins every join, and the read budget pins the cost of doing so.
- **Opportunity cost:** A fallback buys a run that succeeds from a badly-authored change and costs the property the change exists to establish: that a merge verdict is about the change. A configuration key buys per-repository convenience and costs the correct semantics, because a change branch is per change.
- **OODA / KISS:** Observe the declared record, orient on one exact match, decide on one head, act at most once. One authority, one comparison, one refusal per join, no retry, no pagination.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. The matrix scores the independently sourced gates C-1…C-8 only. An option can pass every gate and still be rejected on drivers; the eligibility line under each alternative says which.

| | C-1 no new surface | C-2 fail closed | C-3 two additive rows | C-4 bounded reads | C-5 AC surface | C-6 declared fact | C-7 exact match | C-8 one resolution |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the checkout branch | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| ALT-1 derive from the change-folder slug plus `change.type` | ✅ | ❌ | ✅ | ⚠️ | ❌ | ❌ | ✅ | ⚠️ |
| ALT-2 add a configuration key | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| ALT-3 resolve purely from the open-request list | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| ALT-4 declare on the change-spec front matter | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 selected: declare on the pm-notes document | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

⚠️ marks a gate that is satisfiable only with an extra safeguard or an extra read, and is not counted as a pass.

### Alternative 0 — Baseline: Keep the Checkout-Branch Resolution and Document It

- **Eligibility:** Not eligible (fails C-2, C-5, C-6, C-8).
- **Summary:** Change nothing; state plainly in the reference page and the feature spec that `merge` must be run from the change branch, and that a run from the integration base verifies the base.
- **Constraint compliance:** Passes C-1, C-3, C-4, C-7 trivially. Fails C-2: the checkout branch and head remain the identity inputs, so a run that cannot answer falls back to whatever directory it is in. Fails C-6: no declared fact exists. Fails C-8: a dry run and a merge from different directories describe different objects. Fails C-5: AC-F1-1, AC-F1-2, AC-F1-5, AC-F5-2 are unsatisfiable by documentation.
- **Driver fit:** Fails drivers 1, 2, 3, 6, 8; serves only "no authoring obligation".
- **Pros:** Zero change; zero new obligation; no adopter cost.
- **Cons:** The observed defect stays: a base-checkout run verifies the base tip and reports a vacuous all-pass; the opaque abort stays; the dry run keeps describing a different object from the merge; and the feature spec would be documenting a known-wrong contract as intended.
- **Why rejected:** Documentation cannot make a verdict about an object the run did not examine. This is the defect the change exists to remove.

### Alternative 1 — Derive the Branch from the Change-Folder Slug and the Spec's `change.type`

- **Eligibility:** Not eligible (fails C-2, C-5, C-6).
- **Summary:** Read the change folder name and the spec front matter's `change.type`, and compose `<type>/<ref>/<slug>` as the branch.
- **Constraint compliance:** Fails C-2: the value is derived at run time, so a naming-convention change silently re-points the merge and no artifact states which branch was intended. Fails C-6: nothing declares the branch. Fails C-5: with no declaration, AC-F1-3's "declares no usable branch" refusal has no subject — the AC presupposes a declaration to be absent. C-4 at risk: it adds a second change-artifact parse (markdown front matter) beyond the one bounded change-record read.
- **Driver fit:** Fails drivers 2, 3, 5, 6; the derivation is testable but its correctness depends on an unwritten convention.
- **Pros:** No authoring obligation; the branch "already follows" a convention in practice.
- **Cons:** Adds a parser for a document the merge path does not otherwise read; assumes a branch-prefix convention that the repository never declared; a change whose branch deviates from the convention resolves to the wrong branch and then refuses `no-open-request` with a true-but-useless message; the authority for the branch becomes a filename.
- **Why rejected:** It swaps an ambient fact (the checkout) for an inferred one (the folder name) and calls that a fix. Both fail the same gate.

### Alternative 2 — Add a Configuration Key

- **Eligibility:** Not eligible (fails C-1, C-5, C-6).
- **Summary:** Add a `merge.branch`-style key (or a per-change mapping in the configuration document) and resolve the branch from it.
- **Constraint compliance:** Fails C-1 outright: no new configuration key is admissible. Fails C-6: a configuration document is repository-scoped, so a per-change branch cannot be truthfully expressed there without a mapping table — which is a second source of change facts. Fails C-5: AC-F1-3's premise is a change record that declares no branch, so a mechanism without a change-record declaration satisfies neither the refusal nor the AC.
- **Driver fit:** Fails drivers 2, 4, 6; serves "one obvious place to look" at the cost of the wrong scope.
- **Pros:** Familiar mechanism; validated at configuration resolution; one place for an operator to edit.
- **Cons:** Makes a per-change fact a per-repository setting; every change's branch would collide in one document or need a map keyed by ref, which is a change artifact inside a config file; adds a key to a pinned key set and a validation surface.
- **Why rejected:** The change branch is a property of the change, not of the repository. Encoding it as configuration is a category error with a permanent schema cost.

### Alternative 3 — Resolve the Branch Purely from the Open-Request List

- **Eligibility:** Not eligible (fails C-2, C-5, C-6, C-7).
- **Summary:** Read the bounded open-request list and choose the request that belongs to the invocation's change ref — by title, by head position, or by the sole open request — and take its source ref as the branch.
- **Constraint compliance:** Fails C-6: the provider list becomes the branch authority. Fails C-2: with no declared expectation there is no way to detect the absent or ambiguous case — "the only open request" is a fallback dressed as a rule. Fails C-7: relating a request to a ref without an exact declared value requires substring, title, or ordering inference. Fails C-5: AC-F1-3 and AC-F1-4 have no declared branch to be absent or to count matches against.
- **Driver fit:** Fails drivers 1, 2, 3, 6, 7; it inverts the authority, so the run cannot say which object it intended to merge, only which one it found.
- **Pros:** No authoring obligation; no local artifact read; one provider read.
- **Cons:** With two open requests the selection is arbitrary or needs a heuristic; a base-checkout run would confidently merge whichever request the heuristic picked; the operator cannot pre-declare intent; the ambiguity that the change exists to name becomes undetectable by construction.
- **Why rejected:** It removes the declaration and therefore removes the ability to be wrong out loud — the opposite of a fail-closed contract.

### Alternative 4 — Declare the Branch on the Change Spec's Front Matter

- **Eligibility:** Eligible.
- **Summary:** Add the declaration to the change specification's YAML front matter (`change.branch`) and read it from there.
- **Constraint compliance:** Passes C-1…C-3 and C-5…C-8. C-4 is at risk, not failed: the spec is a markdown document with a front-matter block, so reading it needs a parse the merge path does not have today, while the pm-notes document is already parsed by a delivered read.
- **Driver fit:** Satisfies drivers 1, 2, 3, 4, 7, 8; weaker on drivers 5 and 6 — a new artifact parse for a value the merge path would read exactly once, and a second change document whose extras are not declared opaque.
- **Pros:** The spec is the change's most-read document; the declaration would sit beside the change's type and title where an author already works.
- **Cons:** New front-matter parsing on the merge path; the spec document's extra-key tolerance is not a declared contract (the pm-notes one is); the closeout composition would still read the pm-notes, so a change's facts stay split across two documents read by two parsers.
- **Why rejected:** It is correct but costs a parser and splits change facts across two documents, when the document the lifecycle already reads offers an open key set, value-faithful preservation, and a delivered reader.

### Alternative 5 — Selected: Declare the Branch on the Committed pm-notes Document, Match the Request Exactly, Bind the Head

- **Eligibility:** Eligible.
- **Summary:** One additive top-level `branch` key on the committed pm-notes document, read through the delivered pm-notes text read; exactly one open delivery request whose provider-asserted source ref equals it; that request's asserted head is the resolved head for the envelope, the probe, the landing, the report, and the dry run; absence or ambiguity refuses by name with zero provider reads on the branch path.
- **Constraint compliance:** Passes C-1…C-8 (matrix above). Table stakes satisfied. The decision-derived rules below are the consequences it commits to.
- **Driver fit:** Best on net across every driver: the verdict is about the merged object (1), the authority is in the change's diff (2), absence refuses rather than falls back (3), no key/schema/record/capability is added (4), the delivered read, matching shape, and error table are reused (5), a local read plus a pure match is offline-deterministic (6), the refusal names path, key, branch, source and counts (7), the dry run is true (8), and the adopter obligation is one documented line (9).
- **Pros:** One declared authority with a one-line adoption cost; zero provider reads on the branch refusal; exact matching with no inference; a head that is the same value everywhere, so no consumer can disagree; the base-checkout merge becomes safe, including the deletion target; the branch-name parse is deleted with its failure mode; no schema, record, capability, or configuration change.
- **Cons:** Every in-flight change and every adopter must author one line before merging; the declaration is opaque to lint, so a typo is caught at merge time rather than at authoring time; exact equality is brittle for fork-origin requests; the request resolution must precede the freshness envelope, reordering the transaction's reads.
- **Why chosen:** It is the only eligible alternative that satisfies every independently sourced gate at the lowest net cost across the drivers, and the only one whose failure mode is a named refusal rather than a plausible-looking verdict about the wrong object.

## Decision

- **Decision:** Adopt **ALT-5**.

  1. **DC-1 — One authority: the change record's `branch` declaration.** The change branch is read from one additive top-level `branch` key on the change's committed pm-notes document, through the one delivered pm-notes text read (one local read). The declaration is a change fact: authored with the change, reviewed in its diff, preserved value-faithfully by every document-writing branch, and opaque to lint. It is not configuration, carries no schema version, is read by no other surface, and its located path is the refusal's evidence. (Spec DM-1, F-1 step 1, DEC-1, DEC-9.)
  2. **DC-2 — No fallback, and a bounded meaning for "unusable".** A change record that declares no branch, or declares an empty value, a value containing whitespace or a control character, or a value over the declared cap, refuses `merge.branch-unresolved` at exit 1 with `domainKind: merge`, `consequence: not_landed`, `retryable: false` (an operator act — authoring the declaration — is required before a re-run can converge), naming the command, the change ref, the change-record path, the `branch` key, and the cause. The refusal performs zero provider reads and zero landing calls. The checkout's branch is never a candidate; the change-folder slug plus `change.type` derivation and every other run-time derivation are rejected. No branch-naming grammar is validated: a value that is otherwise unusual is compared exactly and will refuse `merge.request-unresolved` rather than be second-guessed, because a grammar would assume the very convention this record refuses to rely on. (Spec F-1 step 2, AC-F1-3, §24-A steps 1–2; DR-3.)
  3. **DC-3 — Request identity by exact match, with a closed reason set.** After the declaration resolves, one bounded open-request list read (the delivered read, with gate facts, which also carries the request detail) selects entries whose provider-asserted source ref equals the declared branch as an exact string. Exactly one match with an asserted full-SHA head is the delivery request. Zero matches refuse `merge.request-unresolved` with `no-open-request`; more than one matching entry refuses it with `ambiguous-open-request`; a saturated bounded page refuses it with `ambiguous-open-request` (DR-2); a match whose asserted head is absent or not a full SHA refuses it with `head-unresolved` (DR-4). Every instance is exit 1, `domainKind: merge`, `consequence: not_landed`, `retryable: false`, and names the resolved branch, its resolution source (`declared`), the observed open-request count and match count, and the closed reason. No prefix, suffix, glob, or ref-substring matching exists. An absent token at this read refuses the delivered `config.credential.missing` naming the credential reference, the environment variable, and the operation — never `merge.transaction-aborted` (AC-F3-2). (Spec F-1 steps 3–4, AC-F1-4, Appendix B.)
  4. **DC-4 — Head binding: one head value, five consumers.** The matched request's asserted head is the **resolved head**, and it is the value of the transaction's head port for the whole run: the freshness envelope's current head, the check-run page read, the landing's expected head, every reported head, and the dry run's appended record identity. A verification record whose head differs — the integration base, for instance — refuses `merge.gates-stale` at exit 1 recording both SHAs, with zero landing calls; this is the only guard that catches a base-tip record, because such a record can be age-fresh and gate-set-identical. The checkout head is never read on this path, and the absence is proven by the extended source scan (DR-5). Because the resolved head replaces the checkout head everywhere, no second head notion exists for a consumer to disagree with. (Spec F-1 step 5, AC-F1-1, AC-F1-2, AC-F1-5, DEC-2.)
  5. **DC-5 — One resolution for both surfaces.** The dry run and the real merge call the same resolution and report the same resolved branch, resolution source, request identity, and resolved head. The dry run appends exactly one verification record whose identity is the resolved head, appends no waiver, transaction, or git mutation, and never reports `result=merged` or `squash=`. A pre-flight verdict therefore describes the object the merge would land. (Spec F-5, API-2, AC-F5-1, AC-F5-2, DEC-8.)
  6. **DC-6 — Already-merged convergence, with the parse deleted.** The convergence case is matched by the invocation's change ref against merged delivery requests, after the open-request read finds no open match. `changeRefInBranch` and its failure mode are deleted; no branch-name parsing remains on any merge path. Convergence still sits behind the declaration refusal, so a converged re-run for a change whose record declares no branch refuses `merge.branch-unresolved`: that is a declared consequence of the zero-provider-read refusal (a convergence-first order would need a provider read before the refusal), and it is recorded rather than smoothed over. (Spec F-1 step 6, AC-F1-3.)
  7. **DC-7 — What this record does not decide, and what it refines.** Required-check authority, membership, and the default gate set are TDR-0072's. The refusal-diagnostics contract, the row-level retryability rule, and `merge.work-item-unresolved` are TDR-0073's; this record decides only the two rows its own causes reach, and their exact summary and remediation wording is the change's. The numeric cap on the declaration is a declared constant fixed at plan time, not a decision of this record. The battery's own branch resolution is unchanged (OQ-3), a declaration writer is out of scope (OQ-1, NG-5), and convergence-before-resolution is rejected within this record's gates rather than deferred. **The spec statements this record refines, for `@pm` to apply:** `doc/spec/features/feature-merge-verify-deploy.md:36-45` (the branch comes from the checkout's git facts → the change record's declaration) and `:160-165` (the recorded head equals "the current head" → the resolved request head); the change-lifecycle guidance for change records gains the authored declaration; the merge reference page gains the two refusals and the resolution order. This record does not edit the change artifact.

### Decision-Derived Rules (consequences, not gates)

These follow from adopting ALT-5. They are stated so a reviewer can check that the decision was implemented as decided; they are not eligibility tests.

- **DR-1 — The request resolution precedes the freshness envelope.** The resolved head must exist before the envelope compares against it, so the change-record read, the branch resolution, and the request resolution run before the verification read and the envelope. The read budget is unchanged (one local read, one bounded list read that is also the detail read); only the order moves. The zero-provider-read property of `merge.branch-unresolved` depends on this order.
- **DR-2 — A saturated bounded page is ambiguous, not empty.** A bounded list page that reached its limit cannot establish that no other open request matches, so it refuses `merge.request-unresolved` with `ambiguous-open-request` even when exactly one entry on the page matches. This reuses the delivered battery rule (`resolveOpenPr` treats `pageItemCount >= limit` as ambiguous) rather than inventing a second convention, and it keeps the closed reason set at three.
- **DR-3 — An absent or unreadable change record rides the branch refusal.** When the delivered read cannot locate or parse the change record, the run refuses `merge.branch-unresolved` naming the change-record location it attempted and the `branch` key, with zero provider reads. The alternative — a fourth reason or a third row — is outside this record's two-row scope, and a silent state failure would breach the "every refusal names its cause" contract. The mapped cause is recorded in the refusal, and whether the owner wants it separable is an Unresolved Question.
- **DR-4 — An asserted head is a full hex SHA.** A matched request whose asserted head is absent, empty, or not a full 40- or 64-hex SHA refuses `merge.request-unresolved` with `head-unresolved`. This reuses the delivered full-SHA predicate (`isFullHexSha`, `verify-gates.ts:180-181`) rather than inventing a second validation, and it keeps the exact-head guard meaningful: the envelope compares SHAs for equality, and a non-SHA cannot be compared.
- **DR-5 — The no-ambient-read proof covers the head as well as the branch.** The spec's NFR-6 requires zero reads of the checkout's branch on the merge path. This record extends the same production-source scan, with its mandatory failing control, to the checkout's head, because a removed branch read beside a retained head read reproduces the defect with a better label. A new consumer of the checkout head on the merge path re-opens this record (revisit trigger).

### Constraint Compliance Attestation

ALT-5 satisfies C-1 through C-8. **C-1:** the declaration is one additive key on an existing committed artifact; the configuration key set, record kinds, schema versions, adapter operations, capabilities, and credential references are unchanged, and neither refusal row introduces a capability. **C-2:** absence and unusability refuse by name with zero provider reads and zero landing calls; the checkout's branch and head are never candidates; no derivation exists. **C-3:** exactly two additive rows (`merge.branch-unresolved`, `merge.request-unresolved`), both exit 1, `not_landed`, `retryable: false`; no existing row's identity, exit, category, consequence, or projection moves; `merge.work-item-unresolved` stays outside this record. **C-4:** one local change-record read, one bounded open-request list read that is also the detail read, zero retries, zero pagination, and zero provider reads on the branch refusal. **C-5:** the binding surface is AC-F1-1…AC-F1-5, AC-F5-1, AC-F5-2, and AC-F3-2, with AC-F3-1/AC-F3-6 touched only for the two rows this record owns. **C-6:** the branch is an authored, reviewed, committed change fact read from the artifact. **C-7:** exact string equality only, saturation as ambiguity, full-SHA head required, no naming grammar. **C-8:** one resolution shared by the dry run and the merge, with the dry run's record identity bound to the resolved head and its zero-mutation contract intact. DR-1…DR-5 are accepted as consequences. No accepted-risk exception is claimed against any gate; the accepted risks are recorded separately below.

### Accepted Risks

| Risk | Why accepted | Acceptor | Severity | Revisit trigger |
|---|---|---|---|---|
| Every in-flight change must author one line on its change record before it can merge. | This is the decision, not a side effect: a fail-closed authority that silently tolerated absence would be the fallback being removed. The refusal names the exact path and key, and the change authors its own declaration so it is mergeable by its own contract (spec §19, RSK-1). | Human owner, GH-366 PR review | Medium | More than a handful of in-flight changes stall, or an authoring act is repeatedly forgotten |
| The obligation ships to adopters, who inherit refusals in their repositories. | The tooling is installed into other projects, so a contract change is an adoption cost; the release note and the change-lifecycle guidance state it. | Human owner, GH-366 PR review | Medium | An adopter reports that the obligation arrives without a documented path |
| The declaration is opaque to lint, so a typo surfaces at merge time as `no-open-request` rather than at authoring time. | Lint's open key set is the property that makes the declaration additive with no schema change; making lint inspect it would be a lint contract change with its own decision. | Human owner, GH-366 PR review | Low | A typo-caused refusal is reported more than once |
| Exact equality is brittle for fork-origin requests, whose provider-asserted source ref may be `owner:branch`. | The delivered battery rule and the merge composition both compare exactly; the declared value is the provider-asserted value, and same-repository requests are the supported flow. | Human owner, GH-366 PR review | Medium | A fork-origin merge flow is adopted |
| A saturated bounded page refuses as ambiguous even when the branch matched on the page. | A truncated page cannot prove uniqueness; treating saturation as a negative would be the inference C-2 forbids. The delivered limit is 100 open requests. | Human owner, GH-366 PR review | Low | Open-request counts approach the limit in normal operation |
| An absent or unreadable change record rides `merge.branch-unresolved` rather than a distinct identity. | The two-row scope is fixed, a silent state failure would breach the diagnostics contract, and the row's cause is named in the refusal. | Human owner, GH-366 PR review | Low | The owner wants the causes separable, which becomes a third row or a fourth reason |
| A converged re-run for a change without a declaration refuses instead of replaying. | Convergence sits behind the declaration refusal to keep the refusal at zero provider reads; a convergence-first order would put a provider read on the refusal path. | Human owner, GH-366 PR review | Low | A converged change must be replayable without its change record |
| `blast_radius` is declared `team` for a decision authored as a TDR. | The tie-breaker would prefer an ADR at `blast_radius >= team`; the caller reserved TDR-0071 and the decision changes no architecture boundary or mechanism. | Human owner, GH-366 PR review — who re-types the record as an ADR if that judgement is rejected | Low | The owner reads the resolution authority as architecture-defining |

### Independent Challenge Status (R3 — pending)

`@decision-critic` has **not** reviewed this record. No `PASS`, `PASS_WITH_RISKS`, or `REWORK` verdict exists, and this record claims none. The challenge, when performed, must verify at least:

1. **That one authority is actually one.** Against the tree, that the merge path resolves the branch from the declaration and from nothing else — no checkout branch, no folder-slug or `change.type` composition, no configuration key, no provider-list authority, no leftover name parse — and that ALT-0…ALT-3's rejection grounds hold against the delivered code rather than against the spec's description of it.
2. **That the head binding is complete.** That every consumer of a head SHA on the merge path — the freshness comparison, the check-run page read, the landing's expected head, the reported head, the dry run's record identity — is enumerated and bound to the resolved head, with no second head notion and no consumer left on the checkout `HEAD`.
3. **That the two rows tell the truth.** That `retryable: false` is accurate for every cause each row reaches (including the absent-record cause of the branch row and the saturated-page cause of the request row), that neither row's remediation promises convergence it cannot deliver, and that `merge.transaction-aborted` no longer reaches these causes.
4. **That the read budget survives the reorder.** That resolution-before-envelope adds no read, that the list read doubling as the detail read is a truthful account, and that the branch refusal's zero-provider-read property is testable against a double that fails on any call.
5. **That the operational consequence is disclosed, not buried.** That spec §19 and RSK-1, this record, the feature spec, the reference page, and the release note all state the one-line obligation and its refusal, in the same change.
6. **That scope held.** That no third row, schema version, record kind, configuration key, capability, or battery-side behaviour change entered under this record's authority — and that `merge.work-item-unresolved` is argued in the sibling record, not here.
7. **That assumptions are labelled as assumptions.** That exact source-ref equality and same-repository requests are stated with their revisit triggers rather than presented as facts, and that the saturation and full-SHA rules are declared as decision-derived rather than smuggled in as gates.

## Trade-offs & Consequences

### Positive Outcomes

- A merge verdict is about the delivery request, which is the object the landing mutates: a base-checkout run verifies the request head or refuses by name, and can no longer report `verified` about the base tip.
- The verified head is one value with five consumers, so the envelope, the probe, the expected head, the report, and the dry run cannot disagree.
- The branch is reviewable before the run: it appears in the change's diff, and a wrong branch is a review finding rather than a run-time surprise.
- The branch refusal costs nothing external: no provider read, no landing call, and a remediation naming the exact path and key.
- The branch-name parse and its failure mode are deleted, and the already-merged convergence case becomes exact (the invocation's change ref) rather than reconstructed from a string.
- Post-landing branch deletion now targets the change branch; previously a base-checkout run named the base for deletion.
- Exact matching keeps the resolution explainable in one sentence: one declared value, one equality, closed reasons. There is no heuristic to tune and no ranking to justify.
- A saturated page is refused as ambiguous rather than silently proving a negative, reusing the delivered battery rule.
- No configuration key, schema version, record kind, capability, or provider operation is added, and only two additive rows appear.

### Negative Outcomes

- **A one-line authoring obligation becomes a delivery prerequisite.** Every in-flight change and every adopter must declare its branch before merging, and a change that forgets stalls at `merge.branch-unresolved` — by design, but it is a real interruption.
- **The obligation is unaudited at authoring time.** Lint treats the key as opaque, so a typo is caught at merge as `no-open-request`; the repair is cheap but arrives late.
- **Exact equality is unforgiving.** A fork-origin request whose asserted source ref carries a prefix will not match, and the refusal will be truthful and unhelpful until the flow is decided.
- **The transaction's read order changes.** Resolution must precede the freshness envelope, so an implementation that keeps the delivered read order has no resolved head to compare against when the envelope runs — and the cheapest way to make that compile is to reach for the checkout head again.
- **The ambiguity refusal can fire on a healthy-looking page.** A saturated bounded list refuses even when the intended request is on it.
- **Convergence inherits the declaration requirement.** A converged re-run for a change with no declaration refuses rather than replaying.
- **A partial delivery is dangerous.** Binding the branch without the head produces a report that names the change while the evidence is about the checkout — the original defect with a misleading label. The two must land together.

### Unresolved Questions

- [ ] Does the owner want an absent or unreadable change record to carry its own closed reason (or third row) instead of riding `merge.branch-unresolved`? (owner: the human owner at the GH-366 PR review; the answer is a scope change, not an implementation detail)
- [ ] Is the declared branch cap a spec constant or a plan-pinned constant, and what value? The condition is required by the decision; the number is not decided here. (owner: `@spec-writer` / `@coder` at plan time)
- [ ] Does a fork-origin delivery request belong to the supported flow? If yes, the matching rule and the declaration's meaning must be re-decided rather than patched. (owner: `@decision-advisor` when a fork flow is adopted)
- [ ] Should the `verify gates` battery resolve its branch from the change record so a merge record can be produced from a base checkout (OQ-3)? This record explicitly leaves the battery unchanged. (owner: `@decision-advisor` in the follow-on decision)
- [ ] Should a delivery command author the declaration (OQ-1)? This record requires the declaration and adds no writer. (owner: `@decision-advisor` in the writer decision)

## Implementation Plan

1. **Change-record read and branch resolution.** In the merge composition, perform the one local pm-notes read for the invocation's change ref through the delivered text read, resolve the top-level `branch` value, apply the usability rules (non-empty string, no whitespace or control characters, at or under the declared cap), and refuse `merge.branch-unresolved` naming the located path and the key when it does not resolve. Add no parser, no second document read, and no provider call.
2. **Request resolution.** Resolve the delivery request from the one bounded open-request list read by exact `sourceRef` equality, add the saturation guard and the full-SHA head guard, and refuse `merge.request-unresolved` with the closed reason and the named counts. Keep the list read as the detail read; add no read, retry, or pagination.
3. **Head binding.** Supply the resolved head as the transaction's head for the whole run — the freshness comparison, the check-run page, the landing's expected head, the reported head, and the dry-run record identity — and remove the checkout head from the merge path. The exact-head guard and the stale refusal keep their delivered shapes and evidence fields, now carrying the resolved head and the recorded head.
4. **Delete the fallback.** Remove the branch-name parse and its convergence path; match merged requests by the invocation's change ref. Remove the checkout branch assignment and the conditional branch passthrough's old source.
   **The branch binding and the head binding are delivered as one unit.** A state in which the branch resolves from the declaration while the head still comes from the checkout (or the reverse) is a stop-and-revert condition, not an intermediate step: it produces a verdict that names the change while the evidence is about the checkout.
5. **Rows and classification.** Add `merge.branch-unresolved` and `merge.request-unresolved` to the machine and documented tables together (exit 1, `not_landed`, `retryable: false`), wire classification to the declared rows, and narrow `merge.transaction-aborted`'s cause set without changing its code, category, consequence, or projection. Leave `merge.work-item-unresolved` to the sibling record.
6. **Proofs.** Extend the merge suite with: the both-surfaces object-equality case; the base-checkout stale refusal naming both SHAs; the branch refusal against a provider double that fails on any call; the prefix-collision control (a branch that is a prefix of the declared one must not match); the saturated-page ambiguity case; the short-head case; the exact-match convergence case; and the production-source scan for the absence of the checkout branch and head reads on the merge path, with its mandatory failing control. Keep determinism (20 identical runs) and offline (zero network, zero child process) assertions green.
7. **Documentation.** Reconcile the merge feature spec (resolution order, branch source, head meaning in the freshness envelope, the read budget, the invariants, the two refusals), the change-lifecycle guidance for change records (the authored declaration and its refusal), and the merge reference page (resolution order, refusal examples, exit-status causes). Hand the statements listed in DC-7 to `@pm`.

**Plan-pinned implementation obligations** (deliberately not decided here; each carries its pinning test):

1. The numeric cap on the declaration and the exact usability predicate's expression — test `branch-usability`: empty, whitespace, control-character, and over-cap values each refuse; a value at the cap resolves.
2. The exact summary and remediation wording of the two rows, and the evidence member names beyond those the spec fixes — test `refusal-rendering`: both rows name the command, the code, and their named cause; `retryable` equals the declared row value.
3. The location of the resolution logic and whether the head is supplied by a resolved-head port or a transaction input — test `head-binding`: every head consumer observes one value, and no consumer observes the checkout `HEAD`.

## Rollback / Reversal

- **Revert steps:** revert the delivery commit(s) as a unit. The two additive rows become unreachable and are then inert (they may remain declared without effect; removing them restores the exact prior inventory). The `branch` declaration stays on change records and stays harmless, because it is an opaque extra key that no other surface reads. No stored state migrates and no historical record is read, so nothing needs backfilling in either direction.
- **Stop conditions that trigger rollback:** (a) a change cannot merge because its record cannot be authored — no committed change folder, or an artifact the delivered read cannot locate; (b) the provider's asserted source ref does not equal the declared branch for the supported same-repository flow, making exact equality unusable; (c) a delivery that leaves a **mixed state** — the new branch resolution with the checkout head still bound, or the reverse. Case (c) is the serious one: it produces a verdict that names the change while the evidence is about the checkout, which is the original defect plus a misleading label. The branch and head bindings therefore land together or not at all.
- **Irrecoverable state:** a landing that has fired is provider truth and cannot be un-landed by a local revert. That is exactly why the head binding is part of this decision: the guard against landing the wrong head is the refusal, not a rollback. A verification record appended by a dry run is inert evidence and is superseded by the next verification; nothing depends on deleting it.

## Communication Plan

- **Audiences (map to `governance.informed`):** coordinators and operators who run `merge`; every in-flight change owner; adopters of the installed tooling; the `verify gates` follow-on owner; `@pr-manager`.
- **Message (one line):** "`merge` now reads the change branch from the change record's `branch` declaration and the head from the open delivery request; a change with no declaration refuses by name, with zero provider reads."
- **Channel:** GH-366 PR body (scope held and scope not claimed); the change's release note (adopters); the merge reference page and the merge feature spec (behaviour and refusals); the change-lifecycle guidance (where a change is authored); the dry-run and merged report data (the resolved object).
- **Timing:** pre-rollout for the authored declaration and the two refusals (documentation and the change's own record); at rollout with the delivery; post-rollout for the first operator reports of a base-checkout merge, which is the intended gain.

## Verification Criteria

| Criterion | What proves it | Bound |
|---|---|---|
| AC-F1-1 — a base-checkout invocation reports and verifies the request head, never the base tip | The both-surfaces object-equality case plus the stale refusal naming both SHAs; a provider double that records the SHA each read was issued for | DC-4, C-8 |
| AC-F1-2 — a change-branch invocation verifies the request head and lands once at it | The exact-head landing case with one landing call and `result=merged` only after the provider's read-back | DC-4 |
| AC-F1-3 — no usable declaration refuses `merge.branch-unresolved` naming path and key | The refusal case against a double that fails the test on any provider call; the usability cases (empty, whitespace, control character, over cap); the absent-record case (DR-3) | DC-2, C-2, C-4 |
| AC-F1-4 — zero, several, saturated, or headless matches refuse `merge.request-unresolved` with the closed reason | Four refusal cases, each asserting the reason, the resolved branch, and the counts | DC-3, DR-2, DR-4 |
| AC-F1-5 — a fresh base-tip record refuses `merge.gates-stale` with both SHAs and zero landing calls | A record fixture whose head is the base tip and whose age and gate-set identity are valid; zero landing calls asserted | DC-4 |
| AC-F5-1 — the dry run and the merge report the same resolved object | One fixture, one context, two invocations, equality over branch, source, request identity, head | DC-5, C-8 |
| AC-F5-2 — a base-checkout dry run records the resolved head and mutates nothing | The appended record's identity equals the resolved head; no waiver, transaction, or git mutation; no `result=merged`, no `squash=` | DC-5 |
| AC-F3-2 — an absent token on the resolution read names reference, variable, and operation | The credential fixture on the request-list read; the row is the delivered `config.credential.missing` | DC-3 |
| Exact matching has no inference | The prefix-collision control: a branch that extends the declared value by a suffix must not match and must refuse `no-open-request` | C-7 |
| No ambient identity remains | The production-source scan for checkout branch and checkout head reads on the merge path, with its mandatory failing control | DR-5, C-2 |

**Metrics (this decision's share of spec §4.1):** base-checkout invocations reporting the base tip as the verified head — 0; refusals on the two rows missing a named cause — 0; credential refusals naming reference and environment variable — 100 %; declared rows overstating convergence for a cause they reach — 0; in-flight changes forced to re-verify because of this change — 0 (the gate-set identity is untouched by this decision).

**Review date proposal:** the first retrospective after implementation, once GH-366 has landed and at least one further change has merged through the new path; then a longer horizon (roughly 90 days) to judge whether the authoring obligation was absorbed or is being forgotten. `review_date` stays `null` until the owner accepts the record, per the record lifecycle.

## Confidence Rating

**Medium-High.** Every cited fact was read in the delivered tree on 2026-11-20 — the checkout-branch assignment, the checkout-head wiring, the request resolution with its name parse, the pm-notes read and its open key set, the delivered exact-match rule, and the error table's current rows — so the current-state account is direct evidence rather than inference. The open weaknesses are three: exact equality depends on the provider's asserted ref for same-repository requests (no live provider sample was taken), the authoring obligation's real cost is estimated rather than measured, and the R3 independent challenge has not happened. AI-generated confidence is not evidence; the rating states the analyst's read, not a verdict.

## Structured Retrospective

TODO: First retro after implementation (then set `review_date` per the record lifecycle).

### Process quality

Pending.

### Evidence quality

Pending.

### Execution quality

Pending.

### Realized outcome

Pending.

### Luck & variance

Pending.

## Examples & Usage

- **Coordinator on the integration base.** `merge GH-366` reads the change record, resolves `fix/GH-366/merge-command-conformance`, matches the one open request whose source ref equals it, takes that request's head, compares the verification record against that head, reads the check-run page for that head, and lands once with that head as the expected head — or refuses `merge.gates-stale` naming the base-tip recorded SHA and the request head.
- **A change with no declaration.** `merge GH-999` reads the change record, finds no `branch` key, and refuses `merge.branch-unresolved` at exit 1 naming the change-record path and the key, with zero provider reads and zero landing calls. The repair is one line, committed with the change.
- **Two open requests for one branch.** `merge GH-366` resolves the branch, finds two entries whose source ref equals it, and refuses `merge.request-unresolved` with `ambiguous-open-request`, naming the branch and both counts. It does not rank, prefer the newer, or pick the one whose title looks right.
- **A dry run as pre-flight.** `merge GH-366 --dry-run` from the base resolves the same object the real merge would land and appends one verification record for the request head, so the coordinator's pre-flight is a statement about the request rather than about the directory they happened to be in.

## References

- Change specification: `doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-spec.md` (§5.1 F-1, §8.1 API-1/API-2, §8.3 DM-1/DM-2, §9, §15 DEC-1/DEC-2/DEC-8/DEC-9, §17.1, §19, §24-A/B/C).
- Change record: `doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-pm-notes.yaml` (`branch` declaration; the reservation of TDR-0071…TDR-0073).
- System specs: [Merge and Verify-Deploy](../spec/features/feature-merge-verify-deploy.md) · [pm-notes Lint and Phase Transitions](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) · [Verify Gates](../spec/features/feature-verify-gates.md).
- Delivered composition and contracts: `packages/cli/src/production.ts` · `packages/cli/src/edge.ts` · `packages/core/src/domain/merge-transaction.ts` · `packages/core/src/domain/verify-gates.ts` · `packages/core/src/contracts/verify-gates.ts` · `packages/core/src/contracts/error-table.ts` · `packages/adapters/src/file/pm-notes-parser.ts`.
- Related decisions: [ADR-0012 — Provider-side landing path](ADR-0012-provider-side-merge-landing-path.md) · [TDR-0031 — Engine-first evaluation surfaces](TDR-0031-engine-first-evaluation-surfaces.md) · [TDR-0055 — One phase truth source](TDR-0055-phase-truth-registry-fold-mirror.md) · TDR-0072 (required-check authority, reserved) · TDR-0073 (refusal diagnostics contract, reserved).
- Change process: [Decision-Making Guide](../guides/decision-making.md) · [Decision Records Management](../guides/decision-records-management.md).
