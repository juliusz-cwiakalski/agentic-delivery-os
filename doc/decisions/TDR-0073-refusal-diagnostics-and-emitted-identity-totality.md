---
id: TDR-0073
decision_type: tdr
status: Proposed
created: 2026-11-20
decision_date: null
last_updated: 2026-11-20
summary: "Every merge refusal becomes a contract: it names the command, its code, at least one cause in operator terms and an actionable-or-absent remediation, with a credential condition naming the reference, the environment variable and the operation, a read fault naming the failed operation, and an unresolvable tracker object naming its own identity; `merge.transaction-aborted` keeps its code, category, consequence and projection but is narrowed so it carries no credential condition, unresolvable request or unresolvable work item, and its declared `retryable` plus remediation must be true of every cause it still reaches (declared `false` with no convergence claim for the residual set); `retryable` is a row property that is never a per-instance value and no row may declare `true` over a cause that needs an operator act before a re-run converges, with act-free convergence carried by the named reason and remediation instead; and emitted-identity totality is proven over a runtime family declaration beside the composition's exact-member list — the contract's own prefix, suffix, template and a slot rule validated against the effective declared gate set at emission — while the classifier's delivered family resolution stays untouched, no second resolver or vocabulary is added, the gate-id pattern is never widened, and a live mismatch control keeps reaching the containment identity so the proof cannot pass vacuously."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os merge primitive (refusal diagnostics contract, merge refusal row set, composition emittable declaration and its totality proof)"
decision_scope: repo
review_date: null
business_impact: "A blocked merge stops being an opaque abort: the refusal names the object to repair, the code separates causes that used to share one identity, and an operator no longer spends a build cycle inferring which condition fired from a hint that names nothing. The cost is three additive rows, a narrowed abort row, and a proof whose mechanism moves from source text to a runtime declaration."
customer_impact: "An operator whose merge refuses sees `merge.branch-unresolved`, `merge.request-unresolved`, `merge.work-item-unresolved` or the gate family instance with the object, the reason and a remediation that applies — and a pending check reads as a condition that clears without an act rather than as a run to repair. No command that does not emit a merge refusal changes its behaviour."
classification:
  domains: [contracts, operations, cli, diagnostics]
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
  driver: "@decision-advisor (GH-366 spec §15 routes DEC-5, DEC-6 and DEC-7 here as precedent-setting, and §24-C reserves TDR-0073 for exactly this scope)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-366 PR review; AI does not accept this R3 record, so status stays `Proposed` with `decision_date: null` until that review accepts it"
  contributors:
    - "@spec-writer (chg-GH-366-spec §2.1 diagnostics facts, §5.1 F-3/F-4, §8.1 API-3, §8.5, §15 DEC-5/DEC-6/DEC-7, §17.3/§17.4, Appendix B, §21, §24-C)"
    - "@decision-advisor (repository analysis of the error table, the classifier's family resolution, the composition's emittable declaration and credential resolution, the containment proof, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "@decision-critic — R3 independent challenge NOT yet performed; the verification surface it must cover is listed under Independent Challenge Status"
    - "Human owner (GH-366 PR review — this record decides what every merge refusal must say, which row owns which cause, and what one static `retryable` field is allowed to claim)"
  performers:
    - "@coder (GH-366 phase 2: the three additive rows, the narrowed abort row, the named-cause and credential/read-fault naming, the exact-member list; phase 5: the runtime family declaration, the slot rule at emission, and the totality proof ranging over it)"
    - "@spec-writer / @pm (the statements this record refines, listed in DC-8)"
    - "@doc-syncer (GH-366 documentation phase: the documented error table, the `merge` reference page's exit-status causes and refusal examples, the feature spec, and the test specification's counts)"
  informed:
    - "Consumers that branch on `merge` refusals: the coordinator and CEO loop, `@pm`, `@fixer`, and operator runbooks. Each currently distinguishes causes by code; the three additive rows make causes separable that today share `merge.transaction-aborted`, so any consumer that keys on that row's presence must be read once against the new vocabulary."
    - "The owners of the rows whose text moves: the `merge.transaction-aborted` row's declared `retryable` and remediation, the `config.credential.missing` summary and remediation on the merge path, and the family row's remediation — the same text appears in the documented table, the reference page, the feature spec and the test specification, and all four move in one change (170 → 173 identities, 169 → 172 delivered rows, 68 → 71 allowlisted two-segment codes, `BASELINE_ROWS.length + 136` → `+ 139`, merge rows 9 → 12)."
    - "The sibling record owners: TDR-0071 (branch resolution and head binding — its refusals adopt this contract and this record decides nothing about the resolution) and TDR-0072 (required-check authority — its default-on gate makes the family row and its `retryable` load-bearing, and `merge.gate.ci-green.failed` becomes this record's live proof case)."
    - "Repositories and operators upgrading the installed tooling: an in-flight change whose record declares no branch now refuses `merge.branch-unresolved` instead of an opaque abort (RSK-1), and a refusal whose remediation used to promise convergence now states the act it needs."
    - "@pr-manager (unchanged: it never merges and emits no merge refusal)."
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers:
    - "@decision-critic — NOT yet performed. No PASS, PASS_WITH_RISKS, or REWORK verdict has been issued for this record"
revisit_triggers:
  - "A consumer needs to distinguish two causes that share one row's `retryable` value: the moment a cause-specific action depends on something `retryable` cannot express, the row is the wrong unit and the envelope question reopens (rejected here as ALT-2, not as a permanent answer)."
  - "A fourth merge cause has no honest existing row: the additive rule is three rows for three named causes, not an open licence to keep adding identity for every condition, and a fourth row is a new decision rather than a patch."
  - "A second open-slot family is proposed without a runtime declaration: the precedent this record sets is that a family's admissibility is declared beside the exact members, so a family declared only as a type reopens the proof-shape question."
  - "A gate id is proposed outside the declared slot shape (uppercase, a dot, an empty slot, a wildcard): the slot rule admits exactly the effective declared gate ids, and widening the pattern to admit one is a different decision with a false-accept risk."
  - "`merge.transaction-aborted` regains a named cause it was narrowed away from: the narrowing is the decision, and re-adding a credential, request or work-item cause re-opens both the row's honesty and the operator's repair."
  - "A row's remediation is found to promise convergence for a cause that needs an act: that is a regression against AC-F3-6 rather than a wording preference, and the row is repaired or its cause set narrows."
  - "The documented and machine tables diverge, or a pinned count (170 → 173 identities, 169 → 172 delivered rows, 68 → 71 allowlisted two-segment codes, `+ 136` → `+ 139`, merge rows 9 → 12) is restated in one place and not the others: the sync gate is the contract, and a split delivery fails it."
links:
  related_changes: ["GH-366"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-spec.md"
    - "doc/spec/features/feature-merge-verify-deploy.md"
    - "doc/spec/features/feature-result-contract.md"
  contracts:
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/merge.ts"
    - "packages/cli/src/classify.ts"
    - "packages/cli/src/production.ts"
    - "packages/cli/src/output/merge-text.ts"
    - "tests/structure/defect-f1-merge-refusal-containment.test.ts"
    - "tests/structure/merge-refusal-rows.test.ts"
    - "tests/checks/error-table-sync.ts"
  diagrams: []
  decisions: ["ADR-0012", "TDR-0031", "TDR-0071", "TDR-0072"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S3"]
---

# TDR-0073: Refusal Diagnostics and Emitted-Identity Totality — Named Causes, Three Additive Rows, Row-Level `retryable`, and a Runtime Family Declaration

> **Traceability.** Spec §15 **DEC-5** (diagnostics is a contract: command, breached contract, offending object, actionable-or-absent remediation, row-level `retryable`), **DEC-6** (`merge.transaction-aborted` narrowed; three additive rows carry the causes it used to swallow) and **DEC-7** (totality closed by a runtime family declaration beside the exact-member list, with the slot validated against the effective gate set); §24-C reserves this record. Detail: §2.1 "Diagnostics", §5.1 **F-3**/**F-4**, §8.1 **API-3**, §8.5, §9 NFR-5/NFR-7/NFR-8/NFR-9, §17.3 **AC-F3-1…AC-F3-6**, §17.4 **AC-F4-1**/**AC-F4-2** (the specification's inventory is 25 ids: the 24 already tracked — the 22 carried forward plus **AC-F2-8**, the merged report's evaluated projection, and **AC-F4-2**, the runtime-declaration negative control — plus **AC-F1-6**, the converged re-run, which is F-1 scope and changes none of this record's obligations), the test plan's 22-cell refusal matrix derived from the spec's Appendix B rows by declared expansions, Appendix C. Sibling records own the adjacent decisions: **TDR-0071** (change-branch resolution and the request head as the verified head) and **TDR-0072** (required-check authority and gate membership, which makes the gate family and its `retryable` load-bearing by default).

## Context

`merge` refuses at exit 1 through the shared command error envelope. The envelope carries one code, one summary, one bounded evidence set, one `retryable` flag and one remediation hint, and every one of those values is declared **per row** in the error table. A refusal is therefore not a message a command composes freely: it is the projection of a declared row, resolved by the classifier, rendered by one text writer.

The merge slice's refusals were built incrementally under that model, and three of its surfaces did not keep up with what the merge path had grown into:

- **FACT:** `merge.transaction-aborted` is declared `category: user`, `retryable: true`, `consequence: not_landed`, `projectionClass: user-validation`, with the remediation "Clear the named pre-mutation condition and retry; nothing landed and a re-run converges." (`packages/core/src/contracts/error-table.ts:960-969`, read 2026-11-20). The remediation instructs clearing "the named pre-mutation condition" while the row's own summary names no condition, and the convergence claim is static.
- **FACT:** The merge composition routes every provider `provider.not-found` read failure to that abort (`packages/cli/src/production.ts:2444-2461`), returns the same code when a work-item ref does not parse (`:2468-2471`), and returns it when the request target is undefined (`:2495`) or when no open and no merged request matches (`:2518`). The transaction itself also emits it for a waiver-append failure (`packages/core/src/domain/merge-transaction.ts:838-844`), a refused landing (`:966-974`) and a declared landing gap (`:1067-1076`). So one row is reachable from conditions with different operators, different repairs and different convergence properties. (DC-4 keeps the waiver-append failure and the declared landing gap in the narrowed set and routes a refused landing to a provider identity instead of the abort.)
- **FACT:** A credential condition is forwarded as the declared `config.credential.missing` identity (`production.ts:2448`) but the row's summary and remediation are generic — "A required credential was not resolvable from its source." / "Supply the credential through its declared environment source and retry." (`error-table.ts:396-404`) — so the merge rendering names neither the credential reference nor the environment variable. The delivered precedent for the shape this contract requires already exists: the declared truth read is `referenceName: "github-read"` with `sourceKey: { name: "GITHUB_TOKEN" }` (`production.ts:549-556`), the harness spawn environment builds a credential refusal whose summary is `declared credential reference ${reference} did not resolve for ${variable}` (`packages/core/src/domain/harness-spawn-env.ts:22-29`), and the installed-binary path refuses with "credential key … is unset (reference …); export …" (`production.ts:3276-3280`). Three delivered surfaces already name both halves; the merge rendering does not.
- **FACT:** The one declared open-slot family is `merge.gate.<gate-id>.failed` with `domainKind: merge`, `category: user`, `retryable: false`, `consequence: not_landed`, `projectionClass: user-validation`, `slotPrefix: "merge.gate."`, `slotSuffix: ".failed"` and a remediation that names resolving the gate evidence (`error-table.ts:102-116`). The contract also exports the template and its prefix/suffix (`packages/core/src/contracts/merge.ts:364-368`).
- **FACT:** The classifier already resolves a family emission: `mergeGateFamilyEntry` requires the declared kind (`merge`), the declared prefix and suffix, and a slot matching the declared gate-id pattern, then returns the declared family row with the emitted code preserved (`packages/cli/src/classify.ts:60-97`, wired at `:134-140`). A live gate refusal therefore renders as its own declared row today; there is no live escape to the containment identity.
- **FACT:** The composition's declared emittable set is an exact-member list plus a **type** — `MERGE_COMPOSITION_EMITTABLE_CODES` enumerates codes (`production.ts:417-431`), `MergeCompositionEmittableFamily` is a template-literal type over the contract's prefix/suffix (`:433-445`), and `MergeCompositionEmittableCode` unions them (`:447-453`). A type is erased at runtime, so the runtime vocabulary declares no family emission.
- **FACT:** The totality proof compensates by reading the composition's source text: `productionDeclaration()` asserts the file contains `"MergeCompositionEmittableFamily"`, `"MERGE_GATE_ERROR_PREFIX"` and `"MERGE_GATE_ERROR_SUFFIX"`, then returns the exact-member list with `family: true` hardcoded (`tests/structure/defect-f1-merge-refusal-containment.test.ts:108-117`). The rest of the suite derives the emission set, covers family instances per effective gate id, and keeps a live mismatch control (`:100-106`, `:197-235`, `:287-...`).
- **FACT:** The change's own test plan records the consequence of that proof shape as an open question: the tree already declares the family type and the containment suite already passes, so F-4's remaining work is the runtime declaration and the slot rule rather than a re-implementation (test plan OQ-TP-1, §"Open questions").
- **FACT:** The pinned identity arithmetic at the change's base (`origin/main-tools` @ `e1ebc76c`, GH-350 merged) is **170 machine identities / 170 documented rows / 169 delivered rows / 68 allowlisted two-segment codes / `BASELINE_ROWS.length + 136`**, with the `merge` kind holding **9** concrete rows beside its one open-slot family row. This change's three additive rows move that to **173 / 173 / 172 / 71 / `+ 139`**, taking the `merge` kind to **12** concrete rows, and move the machine table, the documented table, the reference page, the feature spec, the test specification and the phrase-table authority together (spec §9 NFR-8, §16, §18; plan phase 2; `tests/checks/error-table-sync.test.ts`'s GH-350 block; `doc/spec/features/feature-result-contract.md`). `167` is a banned stale total in the repository's phrase table (`tests/checks/doc-conformance.test.ts`, `GH350_PHASE1_ROWS`), so no restatement of this arithmetic may use it.

**Why now.** The owner's evidence is that two consecutive builds produced two different identities for one failure — an operator cannot tell from the refusal which condition fired, and cannot tell whether re-running is the repair. The cause of that is not one bad string. It is that the vocabulary has a single catch-all row whose static `retryable` value cannot be true of every cause it reaches, and a totality proof that is satisfied by the presence of identifiers in a text file rather than by a declaration the runtime holds. The change that repairs the merge slice (GH-366) is the only place both can be corrected without a second delivery touching the same rows and the same proof.

## Problem Framing (Clarified)

The symptom is "the refusals are opaque and the totality proof is weak". The cause is that the refusal surface has **no rule binding a cause to the row that owns it**, and the proof has no **runtime object** to range over. Three questions follow, and the first two turn out to be one question:

- **Q1 — What must a refusal say?** Not "more detail": a refusal must name the command, the code, at least one cause in the operator's vocabulary, and a remediation that applies to that cause or none at all. A remediation that says "clear the named condition" without naming it is worse than silence, because it implies the refusal already told the operator what to fix.
- **Q2 — Which row owns which cause, and what may one static `retryable` mean?** The envelope's retryability field is per row, not per instance. Naming a credential condition, an unresolvable request and an unresolvable work item under one row with `retryable: true` produces a value that is false for most of the row's own causes. So the cause set and the retryability claim are the same question: either the row's causes all converge without an act, or the row must not say they do.
- **Q3 — What makes totality a proof rather than a text match?** The family is already resolvable at classification, so the live risk is not an escape to containment. The risk is that the composition's vocabulary cannot state a family emission, and that the proof passes on a comment and fails on a behaviour-preserving refactor. A proof should fail when a behaviour disappears, not when an identifier moves.

**The non-obvious part, stated because it is the whole decision.** Q1 and Q2 cannot be answered by richer strings alone, and Q2 cannot be answered by adding a field. A per-instance `retryable` would make one row honest by changing the result contract for every command that emits a refusal — the row is the declared unit, and the envelope is shared. Conversely, splitting the abort into cause-specific rows without a naming rule produces three rows whose remediations still narrate nothing. The additive rows and the naming contract are one act: the rows are what makes a cause-specific remediation possible, and the remediation requirement is what forces the rows. Q3 is deliberately separate and is answered without touching the classifier, precisely so the proof change carries no behavioural risk.

**Deliberately out of scope, so the boundary is reviewable.** No branch source or head binding (TDR-0071): this record states the shape those refusals must take, not how the branch or the head is resolved. No gate membership, required-check authority or fail-closed outcome table (TDR-0072): this record consumes the family row and decides only its honesty and its declaration. No waiver-class change, no landing-mechanism change (ADR-0012), no new record kind, event, schema version, configuration key or provider capability. No per-instance envelope field (rejected as ALT-2). No new family for another namespace.

## Constraints (Hard Requirements)

These are the gates an alternative must pass to be *eligible*. Each is independently sourced from the change's acceptance criteria, NFRs and non-goals. The runtime-declaration *design* appears later as a decision-derived rule; only the requirement it serves is a gate.

### C-1: Every refusal names the command, the code and at least one cause, with an actionable-or-absent remediation

- **Statement:** Every refusal the merge command emits carries the command name (`merge`), its declared code, at least one cause in operator terms (the record and key, the resolved branch, the request, the work item, the gate and job, the failed operation, the credential reference and environment variable), and a remediation that is actionable for that cause or absent. No refusal instructs an operator to clear a condition the refusal does not name, and no refusal reaches the containment identity.
- **Source:** AC (spec §5.1 F-3, AC-F3-1, §8.1 API-3, §9 NFR-5)
- **Verification:** test (the test plan's 22-cell refusal matrix, derived from the spec's Appendix B rows by declared expansions, plus its control) + review of every rendered refusal
- **Negotiable:** no

### C-2: Credential, read-fault and tracker-object refusals are named by their own identity and shape

- **Statement:** A credential condition names the credential reference, the environment variable **and** the operation that required it, and is never reported as `merge.transaction-aborted`. A provider read fault names the failed read operation. A tracker object that does not resolve is reported by its own identity naming the object and the read operation. The reference shape is the one the tracker/harness family already delivers.
- **Source:** AC (spec §5.1 F-3, AC-F3-2, AC-F3-3, AC-F3-4, AC-F2-5's vocabulary half, §8.4)
- **Verification:** test (absent-token, rejected-auth, unreadable-work-item and read-fault cells) + review
- **Negotiable:** no

### C-3: `retryable` is a row property, never a per-instance value, and no row overstates convergence

- **Statement:** The emitted `retryable` equals the declared row value of the emitted code (or its family projection) in every case; no refusal carries an instance-specific value. No declared row may declare `retryable: true` while any cause reachable for that row requires an operator act before a re-run can converge. A cause that converges without an act (a pending required check) is expressed by the named reason and an accurate remediation, not by a different `retryable`. A row that reaches an act-requiring cause declares `retryable: false` with a remediation true of every cause it still reaches — or its cause set narrows until the row's declaration is true.
- **Source:** AC (spec §5.1 F-3 requitability paragraph, §8.1 API-3, AC-F3-5, AC-F3-6; §8.5)
- **Verification:** test (row-value comparison across every matrix cell; the act-requiring-cause rule with a substituted pre-change row that must fail by name; the pending-versus-failing rendering pair) + code review for any per-instance assignment
- **Negotiable:** no

### C-4: Additive within v1 — three rows only, existing projections fixed, both tables move together

- **Statement:** Exactly three rows are added (`merge.branch-unresolved`, `merge.request-unresolved` with the closed reasons `no-open-request` | `ambiguous-open-request` | `head-unresolved`, `merge.work-item-unresolved`). Every existing code keeps its category, consequence and projection class; `merge.transaction-aborted` keeps its code, category, consequence and projection. The machine table and the documented table move in the same change, with the pinned totals 170 → 173 identities, 169 → 172 delivered rows, 68 → 71 allowlisted two-segment codes, `BASELINE_ROWS.length + 136` → `+ 139` and 9 → 12 merge rows restated everywhere they appear — and no restatement of this arithmetic may reuse the phrase table's banned stale total 167. No record kind, event, schema version, configuration key or provider capability is added.
- **Source:** AC (spec §8.5, §9 NFR-8, §15 DEC-9, §16, §18; plan phase 2)
- **Verification:** test (machine/documented sync gate; the identity delta is exactly the three codes; exit/category/consequence/projection assertions per existing row) + review
- **Negotiable:** no

### C-5: No pattern widening, and one resolver with one family vocabulary

- **Statement:** The gate-id slot stays validated against the effective declared gate set at emission, and the slot pattern is never widened (no wildcard, alternation, optional slot, empty slot, uppercase or dotted slot). The runtime declaration reuses the contract's own prefix, suffix and template; it adds no second resolver, no second matcher, and no second family vocabulary. The classifier's delivered family resolution is unchanged.
- **Source:** AC (spec §9 NFR-7, §11 RSK-6, §5.1 F-4, AC-F4-1)
- **Verification:** test (slot-rule cells, the effective-gate-id derivation, a source scan for a second matcher) + code review
- **Negotiable:** no

### C-6: Totality is proven over a runtime declaration, not over source text

- **Statement:** The composition declares the gate family at runtime beside its exact-member list — the family expression and its slot rule — and the totality proof ranges over that declaration, so a family emission that loses its declaration fails the proof and a behaviour-preserving refactor that keeps the declaration passes it. A match on a type name or a constant in a file's text is not the proof.
- **Source:** AC (spec §5.1 F-4, §4 G-5, AC-F4-1, §9 NFR-7)
- **Verification:** test (the production declaration is read as a value; a declaration without the family fails; a declaration with the family passes irrespective of source text) + code review
- **Negotiable:** no

### C-7: The proof keeps a live mismatch control that still reaches containment

- **Statement:** The containment identity remains reachable by an undeclared code, proven by a live case — a family code under a mismatched kind, or a slot outside the effective gate set — so the totality assertion cannot pass vacuously. A family instance with a valid kind and a declared slot resolves to the declared family row with the gate id preserved.
- **Source:** AC (spec §17.4 AC-F4-1, §9 NFR-7)
- **Verification:** test (the live mismatch control and the resolving counterpart in one case)
- **Negotiable:** no

### C-8: Bounded, secret-free evidence

- **Statement:** Every cause is carried by bounded evidence members and the declared summary/remediation — never a raw payload, title, body, comment or log line. The credential reference **name** and the environment-variable **name** are reported; the value never is. The delivered output bounds (machine data ≤ 65 536 UTF-8 bytes, human summary ≤ 24 lines and ≤ 4 096 bytes, dropped items marked `+N`) are unchanged.
- **Source:** AC (spec §9 NFR-3, NFR-9, AC-F3-2, §21)
- **Verification:** test (canary credential value and canary title/body never appear in output or records; the names do appear; bounds assertions) + review
- **Negotiable:** no

**Table stakes.** Every alternative below keeps zero landing calls on every refusal, the delivered exit taxonomy, determinism, offline execution, and the classifier's delivered entry resolution for codes other than the ones this record touches. None of these eliminates an alternative.

## Decision Drivers

1. **A refusal exists to be acted on.** The operator's next action is the product of the refusal: a name they can search for and a repair they can perform. A refusal that only proves something was wrong has failed at its job.
2. **One static field must not lie.** The envelope's `retryable` is declared per row and shared by every command; the row's cause set is the only lever that can make the value true, so the vocabulary must be shaped to the field rather than the field stretched to the vocabulary.
3. **Cause separation is what makes aggregation and triage work.** Consumers branch on codes; two causes under one code are indistinguishable in metrics, in runbooks and in an agent's decision to retry.
4. **Additivity protects every existing consumer.** Existing codes, exits and projections are the contract other commands and runbooks already key on; changing one to fix another is the wrong trade.
5. **A proof must fail on behaviour.** A test that passes on a comment and fails on a refactor teaches the team to edit the test, not to trust it.
6. **A false accept is worse than a false refusal.** In an identity proof, admitting an undeclared slot to gain coverage converts a loud containment into a silent misclassification.
7. **Operational legibility beats prose richness.** Bounded evidence plus a declared reason is what makes a refusal both stable and readable; raw payloads are neither.
8. **The narrowing must not simply relocate the opacity.** Removing causes from the abort is only an improvement if the new rows name more than the abort did — the naming contract is the point, not the row count.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-366 spec §15 routes DEC-5, DEC-6 and DEC-7 here as precedent-setting, and §24-C reserves TDR-0073 for this scope.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-366 PR review. AI does not accept this R3 record.
- **Contributors:** `@spec-writer` (§2.1, F-3/F-4, API-3, §8.5, NFR-5/7/8/9, §17.3/§17.4, Appendix B/C); `@decision-advisor` (error table, classifier family resolution, composition declaration and credential resolution, containment proof, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, `@decision-critic` (R3 independent challenge — **not yet performed**; its surface is listed under Independent Challenge Status), and the human owner.
- **Performers:** `@coder` (the three rows, the narrowed abort, named-cause and credential/read-fault naming, the exact-member list, the runtime family declaration, the slot rule at emission, the totality proof); `@spec-writer` / `@pm` (the statements listed in DC-8); `@doc-syncer` (documented table, reference page, feature spec, test specification and the pinned counts).
- **Informed:** the consumers that branch on `merge` refusals (coordinator/CEO loop, `@pm`, `@fixer`, operator runbooks); the owners of the rows whose text moves; the TDR-0071/TDR-0072 owners; repositories upgrading the installed tooling; `@pr-manager`.

**Rigor note.** Classified **R3**, not R2. The decision sets the contract for *every* refusal on a command surface whose failures are lifecycle-blocking, decides what a shared envelope field is allowed to claim for a whole family of causes, and establishes the declaration shape that future families must copy. That is precedent, not a local repair. Reversibility is `easy` (row text, three additive rows and a declaration shape; no stored state migrates) and uncertainty is `low` (every cited fact was read in the tree on 2026-11-20) — but the assurance this needs is an independent challenge and a human decision, not a faster record. `@decision-critic` has **not** run; no verdict is claimed.

**Type note.** Authored as a **TDR** because the caller reserved TDR-0073 and the decision is an error-identity and proof-shape contract inside the established result-contract architecture: it adds no component boundary, no resolver, and no mechanism other than a runtime value beside an existing export. The tie-breaker would prefer an ADR at `blast_radius >= team`, and `team` is declared honestly (every consumer that branches on merge refusals, plus every operator runbook). If the owner reads the refusal contract as architecture-defining, the record is **re-typed as an ADR at acceptance** — the classification changes, not the decision.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| `merge.transaction-aborted` declares `retryable: true` with a remediation that names no condition and promises a re-run converges. | FACT | `packages/core/src/contracts/error-table.ts:960-969` (read 2026-11-20) | The central honesty defect would be mischaracterised; the row-level rule and the narrowed row would lose their justification. | High |
| The abort is reachable from provider not-found, an unparseable work-item ref, an undefined request target and a no-match request resolution in the composition. | FACT | `packages/cli/src/production.ts:2444-2461,2468-2471,2495,2518` (read 2026-11-20) | If those causes already had their own rows, only the naming rule would remain — and the three additive rows would be redundant. | High |
| The abort is also emitted by the transaction for a waiver-append failure, a refused landing and a declared landing gap. | FACT | `packages/core/src/domain/merge-transaction.ts:838-844,966-974,1067-1076` (read 2026-11-20) | Without those emissions the narrowing would have no subject; this delivered mapping is the starting point DC-4 narrows, and the shipped value is pinned independently by the spec (v2.1 AC-F3-3, AC-F3-6, §8.5). | High |
| `config.credential.missing`'s row is generic, and the merge path forwards it without naming the reference or the variable. | FACT | `error-table.ts:396-404`; `production.ts:2448` (read 2026-11-20) | The credential half of the contract would be documentation only. | High |
| Three delivered surfaces already name a credential reference and an environment variable in one refusal. | FACT | `production.ts:549-556,3276-3280`; `packages/core/src/domain/harness-spawn-env.ts:22-29` (read 2026-11-20) | Without a delivered precedent the shape would be new design rather than reuse. | High |
| The classifier resolves a `merge`-kind, declared-slot family emission to the declared family row with the emitted code preserved. | FACT | `packages/cli/src/classify.ts:60-97,134-140` (read 2026-11-20) | If it did not, F-4 would be a behavioural repair and not a proof-shape change. | High |
| The composition's runtime emittable vocabulary is an exact-member list plus an erased type; the family has no runtime declaration. | FACT | `production.ts:417-453` (read 2026-11-20) | The totality gap would already be closed and ALT-4 would be a valid as-is baseline. | High |
| The totality proof asserts the type name and the prefix/suffix constants in the composition's source text, then hardcodes family coverage. | FACT | `tests/structure/defect-f1-merge-refusal-containment.test.ts:108-117` (read 2026-11-20) | The "passes on a comment, fails on a refactor" claim would not hold. | High |
| The family row is `retryable: false` with a gate-evidence remediation, and its slot pair is the contract's declared prefix/suffix. | FACT | `error-table.ts:102-116`; `contracts/merge.ts:364-368` (read 2026-11-20) | The family's single `retryable` value and the declaration's reuse claim would need restating. | High |
| The pinned identity arithmetic is 170 → 173 machine identities, 169 → 172 delivered rows, 68 → 71 allowlisted two-segment codes and `BASELINE_ROWS.length + 136` → `+ 139`, with merge rows 9 → 12, moving machine and documented tables together. | FACT | Spec §9 NFR-8, §16, §18; plan phase 2; `scripts/checks/error-table-sync.ts` and `tests/checks/error-table-sync.test.ts` at `e1ebc76c` (read 2026-11-20) | A wrong count would fail the sync gate; the decision itself is unaffected. | High |
| The change's test plan already records that the family type and containment suite exist, so F-4's remaining work is the runtime declaration and slot rule. | FACT | Test plan OQ-TP-1 (read 2026-11-20) | If F-4 were a re-implementation, the record would be describing churn as a decision. | High |
| The two-different-identities-for-one-failure observation is the owner's evidence for the change. | FACT (owner report) | Spec §2.1 "Diagnostics", §2.2 P-4/P-5, restating the GH-366 ticket evidence | Without it, ALT-0's "document the abort" would be a defensible cost choice rather than a rejected one. | Medium-High |
| The three new rows are `category: user`, non-retryable, `consequence: not_landed`, `projectionClass: user-validation`, exit 1. | ASSUMPTION | Plan phase 2 states each row's category, retryability, consequence and projection; this record does not author the row text | If delivery finds a cause whose repair converges without an act, that row's `retryable` would need the opposite value — and the rule, not the value, is the decision. | Medium-High |
| Which causes remain reachable for the narrowed abort after the three rows land. | FACT (resolved 2026-11-20) | Delivered abort sites `packages/core/src/domain/merge-transaction.ts:838-844` (waiver append), `:966-974` (refused landing) and `:1067-1076` (declared landing gap); the narrowed set is pinned by spec v2.1 AC-F3-3, AC-F3-6 and §8.5 — the waiver-append failure and the declared landing gap stay, and the refused-landing cause leaves the abort for `provider.outage`, `provider.auth.rejected` or `merge.landing-unverified` (read 2026-11-20) | If a cause the abort keeps were act-free, the pinned `false` would overstate it and AC-F3-6 would fail by name; the spec pins the value, so the set may not grow an act-free cause. | High |
| `merge.request-unresolved`'s closed reason vocabulary is exactly the three declared reasons. | ASSUMPTION | Spec §5.1 F-1, Appendix B, AC-F1-4; plan phase 2 | A fourth reason would widen a closed vocabulary and reopen C-4's additivity. | High |
| A consumer that keys on `merge.transaction-aborted` can be read once against the new rows without a behavioural regression. | TO-CONFIRM | `grep` finds no runtime consumer branching on the literal outside the error table and sync check; prompts and runbooks are prose | A consumer that treats the abort as the generic "merge blocked" signal would lose that signal for three causes and must adopt the new codes. (owner: `@pm` at the GH-366 PR review, over the informed list) | Medium |

## Mental Models & Techniques Used

- **First principles:** What must be true for an operator to act on a refusal? (i) the cause is named in their vocabulary, (ii) the code distinguishes causes that need different actions, (iii) the retryability claim is true for the cause they received, (iv) the remediation applies, (v) the evidence is safe to paste. Five requirements produce three additive rows, one narrowed abort, one row-level rule, and a naming contract — and rule out richer strings over one catch-all row.
- **Inversion:** How could this change make diagnostics worse? Name a cause but route it to a row whose `retryable` lies (the defect reproduced with better prose); split rows so far that the family's count explodes per gate (the classification hole widened); add a per-instance field that every command now has to honour (a contract change to fix one row); declare the family by pattern so an undeclared slot resolves as a pass (a false accept); keep the source-text proof and call it a declaration (the same proof with a new comment). Each inversion is answered by a stated gate.
- **Second-order thinking:** Two consequences are not obvious. First, narrowing the abort is what makes `retryable` honest, not the other way round: while the abort carried a credential condition, no value of the field was true, and a per-instance field would have been the only way out — which is why ALT-2 is a coherent alternative and is rejected on the unit of declaration, not on taste. Second, a runtime family declaration makes the *proof* independent of the composition's code layout, so the next refactor of `production.ts` cannot silently weaken totality; the declaration becomes the contract's own statement rather than a comment about it.
- **Systems thinking:** The chain is: emitted code → classifier resolution (exact row, then family) → declared row's projection (exit, envelope) → rendered summary, evidence and remediation → consumer decision → operator act. The decision pins every join: the code by the naming contract, the row by the additive split, the projection by the existing row, the rendering by the remediation rule, and the totality of the first join by the runtime declaration.
- **Opportunity cost:** A per-instance `retryable` buys honesty for one family and costs a result-contract change for every emitting command plus a new invariant per renderer. Enumerating a row per gate buys exact rows and costs a table that grows with each declared gate and reopens the hole TDR-0072's default creates. Keeping the abort and documenting it costs nothing and leaves the owner's observed failure intact.
- **KISS / OODA:** Read the declaration, resolve the code, name the cause, state the repair or say nothing. No inference, no per-instance computation, no second resolver.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails (a `negotiable: no` gate) · ⚠️ passes only with an extra safeguard that is not counted as a pass. C-5, C-7 and C-8 are satisfied by every alternative listed and are acknowledged once below rather than scored per row.

| | C-1 named cause | C-2 own identity and shape | C-3 row-level honesty | C-4 additive v1 | C-6 runtime declaration |
|---|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the opaque abort and document it | ❌ | ❌ | ❌ | ✅ | ❌ |
| ALT-1 keep the abort for all causes, improve the hint | ❌ | ❌ | ❌ | ✅ | ❌ |
| ALT-2 add a per-instance `retryable` to the envelope | ✅ | ✅ | ❌ | ✅ | ❌ |
| ALT-3 enumerate a row per gate for required-check refusals | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| ALT-4 declare the family only in the type, keep the source-text assertion | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-5 selected: naming contract + three rows + narrowed abort + runtime declaration | ✅ | ✅ | ✅ | ✅ | ✅ |

**C-5 (no widening, one resolver), C-7 (live mismatch control) and C-8 (bounded, secret-free evidence)** are satisfied by every listed alternative; none is eliminated by them. C-5 and C-7 are the gates that disqualify *variants* of ALT-3 and ALT-5 rather than the alternatives as stated, which is why the decision-derived rules below pin them.

### Alternative 0 — Baseline: Keep the Opaque Abort and Document It

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-6).
- **Summary:** Change no row and no proof. Document that `merge.transaction-aborted` means "the transaction stopped before landing" and that operators should inspect logs or re-run with more verbosity to find the cause.
- **Constraint compliance:** Fails C-1: the summary names no cause and the remediation instructs clearing an unnamed condition. Fails C-2: a credential condition still reaches the abort from the composition and is still rendered generically. Fails C-3: `retryable: true` is declared over act-requiring causes (a work item that does not resolve needs a repaired ref or tracker). Fails C-6: the proof stays a source-text match.
- **Driver fit:** Serves "zero change" only; fails drivers 1, 2, 3, 5.
- **Pros:** Zero risk, zero churn, no consumer re-read.
- **Cons:** The owner's observed failure persists — two builds, two identities, one cause; the documentation would describe opacity as the contract; the `retryable` claim stays false for part of the row's own cause set.
- **Why rejected:** Documentation cannot make an unnamed condition nameable, and the evidence that motivated the change is precisely that the abort is not actionable.

### Alternative 1 — Keep the Abort for Every Cause and Improve Its Hint Text

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-6).
- **Summary:** Leave the routing as it is. Rewrite the abort's summary and remediation so they describe the class of conditions ("a pre-mutation condition such as a missing credential, an unmatched request or an unreadable work item"), and leave `retryable: true`.
- **Constraint compliance:** Fails C-1: a remediation that enumerates three possible causes instructs the operator to clear a condition the refusal does not name for *this* run — the exact prohibition. Fails C-2: the credential condition is still reported as the abort rather than its own identity, and still names neither the reference nor the variable. Fails C-3: one static `true` still spans causes that need acts. Fails C-6.
- **Driver fit:** Serves driver 7 (prose) and driver 8 partially; fails 1, 2, 3.
- **Pros:** One row's text changes; no additive identity; no consumer re-read.
- **Cons:** The operator still cannot tell which cause fired, so the repair is still a guess; the summary grows to describe a class the code cannot separate; aggregation still sees one code for three causes.
- **Why rejected:** It makes the prose more accurate about being unhelpful. The cause must reach the operator as a value, and the envelope's only cause value is the code.

### Alternative 2 — Add a Per-Instance `retryable` Field to the Envelope

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Keep the abort's routes, add a per-instance `retryable` computed at the refusal site, and let one row carry both converging and non-converging causes honestly.
- **Constraint compliance:** Fails C-3 directly: `retryable` must be the emitted code's declared row value and never a per-instance value. It would also make the honesty rule unprovable at the row level, since the row would no longer be the declared unit. Passes C-1/C-2 only if combined with the naming contract — which is why the option is not absurd, merely mis-aimed.
- **Driver fit:** Serves driver 2 strongly and driver 1 weakly; violates driver 4 (a result-contract change for every command) and driver 5 (the proof of honesty moves into untested per-site logic).
- **Pros:** One row could span mixed causes without lying; no new row, no consumer code churn on codes.
- **Cons:** Every emitting command, renderer, golden and envelope consumer inherits a new field; every refusal site becomes a place where the value can be wrong; the shared result contract changes to fix one family.
- **Why rejected:** The row is the declared unit. If one row cannot carry an honest value for its causes, the cause set is wrong — not the envelope.

### Alternative 3 — Enumerate a Declared Row per Gate for Required-Check Refusals Instead of the Family

- **Eligibility:** Not eligible (fails C-4; passes C-6 only with a safeguard).
- **Summary:** Replace the family with exact rows — one per declared gate id — so each gate's refusal is a declared identity with its own text.
- **Constraint compliance:** Fails C-4: more than three rows are added, the identity delta exceeds the three rows this change pins (the register moves past 173), and the merge row count grows with the declared gate set. The next declared gate re-opens the classification hole unless a family (or a text-level proof) covers it, so C-6 is satisfied only by keeping the very mechanism this alternative removes.
- **Driver fit:** Serves driver 1 for a fixed gate set; fails drivers 3 and 4 at the next gate; neutral on 2.
- **Pros:** Each gate's refusal is a literal row a reader can find; no slot resolution is involved.
- **Cons:** The table grows per gate id; every adoption of a new gate needs a code change plus a row; the additivity budget breaks on the first additional gate; the family's slot validation disappears, so a mis-typed gate id in emission becomes unimplementable rather than refused.
- **Why rejected:** It trades one family for a table that must be edited every time a gate is declared — and it does not survive the next gate, which is the exact failure TDR-0072's default makes imminent.

### Alternative 4 — Declare the Family Only in the Type and Keep the Source-Text Assertion

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** The as-is state: `MergeCompositionEmittableFamily` exists as a type, `productionDeclaration()` asserts the type name and the prefix/suffix constants appear in the composition's source, and the proof returns `family: true`. Meanwhile the behavioural half of F-4 (the classifier resolution, the live mismatch control) is already delivered.
- **Constraint compliance:** Passes C-1, C-2, C-3 and C-4 (with the three rows added independently), and passes C-5/C-7/C-8. Fails C-6: the runtime vocabulary declares no family emission, and the proof is a text match.
- **Driver fit:** Serves driver 4 (no behavioural change); fails driver 5 outright.
- **Pros:** Zero production change; the suite already passes; the classifier is untouched.
- **Cons:** The proof passes on a file containing only a comment with the identifier in it, and fails on a refactor that preserves behaviour; the composition's vocabulary still does not state that a family emission is admissible; the next family inherits the same shape.
- **Why rejected:** A proof satisfied by text is a proof of text. The gap F-4 names is exactly this shape, and leaving it is the defect.

### Alternative 5 — Selected: The Naming Contract, Three Additive Rows, a Narrowed Abort, and a Runtime Family Declaration

- **Eligibility:** Eligible.
- **Summary:** Make the refusal cause part of the contract (command, code, at least one named cause, actionable-or-absent remediation; credential names reference + variable + operation; read fault names the operation; an unresolvable tracker object names its own identity). Add three rows — `merge.branch-unresolved`, `merge.request-unresolved` (closed reasons `no-open-request` | `ambiguous-open-request` | `head-unresolved`), `merge.work-item-unresolved` — and narrow `merge.transaction-aborted` so it carries none of those causes, with a declared `retryable` and remediation true of every cause it still reaches. Make `retryable` a row property that is never per-instance and never `true` over an act-requiring cause, with act-free convergence carried by the named reason. Give the composition a runtime family declaration beside its exact-member list — the contract's prefix, suffix, template and a slot rule validated against the effective declared gate set at emission — and range the totality proof over it, leaving the classifier untouched and the pattern unwidened, with the live mismatch control retained.
- **Constraint compliance:** Passes C-1…C-8 (matrix above). Table stakes satisfied. The decision-derived rules below are the consequences it commits to.
- **Driver fit:** Best on net: every refusal is actionable (1), the one static field is made true rather than stretched (2), causes become separable in codes and metrics (3), the change is additive in identity (4), the proof fails on behaviour (5), the slot is never widened and one resolver remains (6), evidence stays bounded and secret-free (7), and the narrowing is paired with naming so nothing is merely relocated (8).
- **Pros:** A blocked merge names the object to repair; three causes stop sharing one identity; one row's `retryable` no longer contradicts part of its own cause set; the family declaration becomes runtime data the proof can range over; the classifier, the family row, the gate-id pattern and every non-merge refusal are unchanged; the identity delta is exactly three declared rows moving with their documented counterpart.
- **Cons:** Three additive rows move the pinned counts and every page that restates them; consumers that keyed on the abort as a generic blocked-merge signal must adopt the new codes; the narrowed abort's residual causes still exist and must be described honestly; the runtime declaration adds one exported value that export inventories must register.
- **Why chosen:** It is the only eligible alternative that answers all three questions at once, keeps the change additive and the resolver single, and converts the totality proof from a text match into a declaration.

## Decision

- **Decision:** Adopt **ALT-5**.

  1. **DC-1 — The refusal cause is part of the contract.** Every refusal the merge command emits names the command (`merge`), its declared code, at least one cause in operator terms, and a remediation that is actionable for that cause or absent. No refusal instructs an operator to clear a condition the refusal does not name, and no refusal reaches the containment identity. Evidence members are bounded and secret-free: no raw payload, title, body, comment or log line. (Spec §5.1 F-3, §8.1 API-3, AC-F3-1, NFR-5.)
  2. **DC-2 — Credential, read-fault and tracker-object causes are named by their own shape.** A credential condition names the credential reference **and** the environment variable **and** the operation that required it (`github-read`, `GITHUB_TOKEN`, the read), reusing the delivered shape the harness and installed-binary surfaces already produce; it is never reported as `merge.transaction-aborted`. A provider read fault names the failed read operation. A tracker object that does not resolve is named by its own identity, naming the object (its ref) and the read operation. (AC-F3-2, AC-F3-3, AC-F3-4, AC-F2-5's vocabulary half; §8.4.)
  3. **DC-3 — Three additive rows carry the causes the abort used to swallow.** `merge.branch-unresolved` (the change-record path and the missing key), `merge.request-unresolved` with the **closed** reason vocabulary `no-open-request` | `ambiguous-open-request` | `head-unresolved` (the resolved branch, the source, the open or match count, the request identity), and `merge.work-item-unresolved` (the work-item ref and the read operation). Each row declares `category: user`, a non-retryable value, `consequence: not_landed`, `projectionClass: user-validation`, and exits 1 with a remediation naming the object to repair. Every other code keeps its category, consequence and projection class. (Spec §8.5, AC-F3-4, AC-F1-3, AC-F1-4; plan phase 2.)
  4. **DC-4 — `merge.transaction-aborted` is narrowed, not removed.** It keeps its code, category (`user`), consequence (`not_landed`) and projection (`user-validation`), and no longer carries a credential condition, an unresolvable request or an unresolvable work item. Its cause set is narrowed to the pre-mutation causes that genuinely require an operator act — a waiver-append failure and a declared landing gap — and for that set the row declares `retryable: false` with a remediation that names the aborted pre-mutation condition and promises no convergence. A **refused landing no longer reaches the abort**: it reports the provider identity the composition already computes — `provider.outage` for a transient or transport fault, `provider.auth.rejected` for a rejected credential, and `merge.landing-unverified` when the landing fired but merged truth was not observed. That routing is the consequence that makes the pinned value true: every cause the abort still reaches needs an act before a re-run converges, so the row's single static `false` overstates nothing. (Spec v2.1 §5.1 F-3, §8.5, AC-F3-3, AC-F3-6; the abort cell of the test plan's refusal matrix.)
  5. **DC-5 — `retryable` is a row property, and the row's reason carries act-free convergence.** The emitted `retryable` is always the declared row value of the emitted code, or the family projection's value for a family instance; no refusal carries a per-instance value and no code path assigns one outside the row/family projection. No declared row may declare `retryable: true` while any cause reachable for that row requires an operator act before a re-run can converge. A pending required check — which converges without an act — is carried by the named reason `ci-pending` and a remediation that says waiting is the convergence, and it carries the family row's single value (`false`) like every other family cause. (Spec §5.1 F-3, §8.1 API-3, AC-F3-5, AC-F3-6; TDR-0072 DR-7.)
  6. **DC-6 — Emitted-identity totality is proven over a runtime declaration.** The composition gains a **runtime** family declaration beside `MERGE_COMPOSITION_EMITTABLE_CODES`: the contract's own prefix, suffix and template, plus the slot rule (the slot must name an id in the effective declared gate set, validated at emission). The exact-member list stays exact. The totality proof ranges over the runtime declaration together with the exact-member list, so a family emission that loses its declaration fails the proof and a behaviour-preserving refactor that keeps it passes. The classifier's delivered family resolution is untouched: no second resolver, no second matcher, no second family vocabulary, and the gate-id pattern is never widened. (Spec §5.1 F-4, §4 G-5, AC-F4-1, NFR-7, RSK-6.)
  7. **DC-7 — The proof stays non-vacuous, and the default makes it live.** A live mismatch control still reaches the containment identity (a family code under a mismatched kind, or a slot outside the effective gate set), and the resolving counterpart resolves to the declared family row with the gate id preserved. `merge.gate.ci-green.failed` becomes the live proof case once TDR-0072 makes `ci-green` merge-applicable, so the family-instance population the proof ranges over is the widened one. (Spec AC-F4-1, NFR-7; TDR-0072 DC-1.)
  8. **DC-8 — Identity arithmetic, and what this record does not decide.** The change adds exactly three identities and moves the machine and documented tables together (170 → 173 identities, 169 → 172 delivered rows, 68 → 71 allowlisted two-segment codes, `BASELINE_ROWS.length + 136` → `+ 139`, merge rows 9 → 12), with the reference page, feature spec, test specification and phrase-table authority restated in the same change. This record decides the refusal contract, the merge refusal row set, the row-level retryability rule and the declaration shape — and nothing about branch resolution or head binding (TDR-0071), gate membership or required-check authority (TDR-0072), waiver classes, the landing mechanism, record kinds, events, schema versions, configuration keys or provider capabilities. **The statements this record refines, for `@pm` to apply:** the merge feature spec's error-identity and diagnostics paragraphs; the merge reference page's exit-status causes and refusal examples; the documented error table and its pinned counts; and the test specification's "Classification fidelity", "Emittable-code totality" and "Error-identity stability" rows.

### Decision-Derived Rules (consequences, not gates)

- **DR-1 — The closed reason vocabularies are declared data, not prose.** `merge.request-unresolved`'s three reasons are a closed declared set, carried in machine data so a consumer can branch without parsing a summary; a fourth reason is a new decision under C-4.
- **DR-2 — The evidence member set stays closed and bounded.** A named cause is conveyed by the declared summary plus bounded evidence members (an object ref, an operation token, a gate id, a job name, a reason token, both SHAs where two exist, a count). A cause is never conveyed by pasting a payload, a title, a body or a log line.
- **DR-3 — The exact-member list and the runtime declaration move in their own phases, and neither regresses the other.** Phase 2 adds the three codes to the exact-member list so the containment proof does not regress at that boundary; phase 5 adds the runtime family declaration and rewires the proof. A delivery that lands the declaration without the three members, or the members without the declaration, fails its own phase gate.
- **DR-4 — The row whose text moves is replaced, not copied.** The abort's "clear the named pre-mutation condition … a re-run converges" text is removed rather than retained beside a new hint; the family row's remediation continues to name resolving the named gate evidence; the credential row's summary on the merge path names the reference, the variable and the operation. No row's remediation is reused across causes it does not name.
- **DR-5 — The naming contract is proven over the whole matrix, not a sample.** The test plan's 22-cell refusal matrix — the spec's Appendix B rows expanded as the test plan declares — is the proof population, and its control fails by name when a compliant cell loses the command, the code or the named cause. A new refusal added to the merge surface joins the matrix in the same change.
- **DR-6 — Secret hygiene is proven with canaries at the refusal boundary.** A canary credential value and a canary title/body are present in the fixture environment; the refusal names the reference and the variable and contains neither the value nor the canary text. The proof covers output and records.
- **DR-7 — The narrow-abort pairing is atomic.** The three rows and the abort's narrowing land together: a delivery that routes a cause to a new code while the abort still carries it produces two identities for one condition, which is the defect this decision removes.

### Constraint Compliance Attestation

ALT-5 satisfies C-1 through C-8. **C-1:** every emitted refusal carries the command, its code, at least one cause in operator terms and an actionable-or-absent remediation, proven over the 22-cell matrix with a control. **C-2:** a credential condition names the reference, the variable and the operation and never the abort; a read fault names the operation; an unresolvable tracker object names its ref and read operation under its own identity. **C-3:** `retryable` is the emitted code's declared row value in every cell; no per-instance assignment exists; no row declares `true` over an act-requiring cause; the pending cause is carried by its reason and remediation at the family's single value. **C-4:** exactly three rows are added, every existing code keeps its category, consequence and projection, the abort keeps its four properties, and machine and documented tables move together at 170 → 173 (169 → 172 delivered, 68 → 71 allowlisted two-segment codes, `+ 136` → `+ 139`, merge rows 9 → 12) with no record kind, event, schema version, configuration key or provider capability added. **C-5:** the slot stays validated against the effective declared gate set at emission; the declaration reuses the contract's prefix, suffix and template; no second matcher, resolver or vocabulary exists; the classifier is unchanged; the pattern is unwidened. **C-6:** the proof ranges over a runtime declaration beside the exact-member list, so it fails on a lost declaration and passes a behaviour-preserving refactor. **C-7:** the live mismatch control still reaches the containment identity, and the resolving counterpart preserves the gate id. **C-8:** evidence is bounded and closed-set, and the credential value never appears while its name does, proven with canaries at the delivered output bounds. DR-1…DR-7 are accepted as consequences. No accepted-risk exception is claimed against any gate; the accepted risks are recorded separately below.

### Accepted Risks

| Risk | Why accepted | Acceptor | Severity | Revisit trigger |
|---|---|---|---|---|
| Consumers that keyed on `merge.transaction-aborted` as a generic "merge blocked" signal lose that signal for three causes. | The signal was only ever "something aborted"; the three new codes are the same signal with the cause attached. A consumer that needs a generic signal can range over the declared merge rows. | Human owner, GH-366 PR review | Medium | A consumer is found discarding a new code because it only looked for the abort |
| The narrowed abort's residual causes (a waiver-append failure and a declared landing gap) are described by a row whose text is necessarily more general than the three new rows. | The residual causes share one pre-mutation abort and neither has a distinct operator repair worth a fourth identity under the additivity rule; the row declares `retryable: false` and names the aborted condition instead of promising convergence. | Human owner, GH-366 PR review | Medium | A residual cause becomes common enough to deserve its own identity |
| A fourth additive row is likely to be argued for soon, and each one moves the pinned counts. | The three rows are the causes the abort actually swallowed; an open licence to add rows would make the additivity claim meaningless, so a fourth row is a new decision. | Human owner, GH-366 PR review | Low | A refusal is emitted for a cause with no honest existing row |
| The runtime family declaration is one more exported value that export inventories and scans must register. | The alternative is a proof over text; a runtime value is the smallest object that makes the composition's admissibility statement real. | Human owner, GH-366 PR review | Low | The declaration drifts from the contract's template or the slot rule |
| The slot rule is enforced at emission rather than at classification, so an undeclared slot remains a programming error rather than a rendered refusal. | That is the delivered architecture and the reason no live escape exists today; moving the check into classification would duplicate the gate-set knowledge the transaction already holds (C-5). | Human owner, GH-366 PR review | Low | An emitted slot outside the effective set is observed in production |
| `blast_radius` is declared `team` for a decision authored as a TDR. | The tie-breaker would prefer an ADR at `blast_radius >= team`; the caller reserved TDR-0073 and the decision changes no architecture boundary or mechanism. | Human owner, GH-366 PR review — who re-types the record as an ADR if that judgement is rejected | Low | The owner reads the refusal contract as architecture-defining |

### Independent Challenge Status (R3 — pending)

`@decision-critic` has **not** reviewed this record. No `PASS`, `PASS_WITH_RISKS`, or `REWORK` verdict exists, and this record claims none. The challenge, when performed, must verify at least:

1. **That the defect is measured, not asserted.** Against the tree: that `merge.transaction-aborted` declares `retryable: true` with an unnamed-condition remediation, that the composition routes `provider.not-found`, an unparseable work-item ref, an undefined target and a no-match resolution to it, and that the transaction emits it for the three residual internal aborts — with the residual set stated accurately and the pinned `retryable: false` consistent with it rather than assumed (DC-4, spec v2.1 AC-F3-3, AC-F3-6, §8.5).
2. **That the row split covers exactly the swallowed causes.** That the three added codes are the causes the abort actually carried, that every existing code keeps its category, consequence and projection, that no fourth cause is left in the abort that a new row should own, and that the abort is narrowed atomically with the rows (DR-7).
3. **That the naming contract is total over the matrix.** That all 22 cells of the test plan's refusal matrix (the spec's Appendix B rows by declared expansions) name the command, the code and at least one cause; that the credential cell names `github-read`, `GITHUB_TOKEN` and the operation; that the read-fault cell names the operation; that no cell's remediation instructs clearing an unnamed condition; and that the control fails by name when a dimension is removed.
4. **That `retryable` is genuinely a row property.** That every cell's emitted value equals its resolved row's (or family's) declared value; that no per-instance assignment exists anywhere on the merge path (with a planted control); that no row declares `true` over an act-requiring cause; and that the pending cause is expressed by reason and remediation rather than by a different value.
5. **That the totality claim is proven over a declaration.** That the runtime declaration exists as a value beside the exact-member list, carries the contract's own prefix/suffix/template and the slot rule, that the proof reads it rather than the source text, that a declaration without the family fails, and that a refactor which keeps the declaration passes.
6. **That no widening occurred and no second resolver exists.** That the gate-id pattern is unchanged, that the slot is validated against the effective declared gate set at emission, that the classifier's family resolution is byte-unchanged, and that no second matcher, family vocabulary or emission-time reconciliation was introduced.
7. **That the mismatch control is live.** That a family code under a mismatched kind reaches `fallback.internal`, that the same code on its own kind resolves, and that a slot outside the effective set never resolves to a pass — so the totality assertion cannot pass vacuously.
8. **That the identity arithmetic is exact and atomic.** That the machine and documented tables move together, that the delta is exactly the three codes (170 → 173 identities, 169 → 172 delivered rows, 68 → 71 allowlisted two-segment codes, `+ 136` → `+ 139`, merge rows 9 → 12), that every pinned-count page and the phrase-table authority agree without the banned stale total `167`, and that no record kind, event, schema version, configuration key or provider capability moved.
9. **That secret hygiene is proven at the boundary.** That a canary credential value and canary payload text never appear in output or records, that the reference and variable names do, and that the delivered output bounds are unchanged.
10. **That the consumer consequence was surfaced.** That `governance.informed` names the consumers that branch on merge refusals, that the generic-signal risk is recorded, and that no consumer's contract was silently redefined by the three new codes.
11. **That scope held.** That no branch/head decision (TDR-0071), no gate membership or required-set decision (TDR-0072), no waiver-class change, and no new family for another namespace entered under this record's authority.

## Trade-offs & Consequences

### Positive Outcomes

- A blocked merge names the object to repair: the change record and key, the resolved branch and why no request matched, the work-item ref and read operation, the gate and job, the failed read operation, or the credential reference, variable and operation.
- Three causes that shared one identity become separable in codes, metrics and runbooks, so aggregation can count them and an agent can decide differently on each.
- The abort row's `retryable` value stops contradicting part of its own cause set: either the row is honest about needing an act, or its cause set is narrow enough to be.
- A pending required check reads as a condition that clears by waiting, without a per-instance retryability exception that would change the envelope for every command.
- The composition's vocabulary now states that a family emission is admissible, and the totality proof fails on a lost declaration rather than on a moved identifier.
- The classifier, the family row, the slot pattern and every non-merge refusal are unchanged, so the change is additive in identity and in mechanism.
- Secret hygiene is a proven property of the refusal boundary rather than a review convention.

### Negative Outcomes

- **The pinned counts move, and every page that restates them must move in one change.** A split delivery fails the sync gate, which is the intended cost.
- **Consumers that keyed on the abort as a generic blocked-merge signal must be read once.** The codes they now receive are more precise but different, and prose consumers (prompts, runbooks) do not fail a test when they are stale.
- **The narrowed abort still exists and its residual causes are described more generally than the three new ones.** A waiver-append failure and a declared landing gap are not the same event, and one row must speak for both.
- **A fourth cause will eventually want a row.** The additivity budget is a deliberate constraint, not an accident, and the next request reopens the identity decision.
- **The runtime declaration is a new exported contract value.** Export inventories and scans must register it, and it can drift from the contract's template if a future edit duplicates the constants instead of importing them.
- **The proof remains a structure test.** It proves the declaration covers the emitted vocabulary; it does not prove that every emission path is reachable, which is what the live refusal case and the behaviour suites are for.

### Unresolved Questions

- [ ] Does any runtime consumer (as opposed to prompt prose or a runbook) treat `merge.transaction-aborted` as the generic blocked-merge signal the three new codes split? (owner: `@pm` at the GH-366 PR review, over the informed list)
- [ ] Should `merge.request-unresolved`'s reason be a declared closed vocabulary in the contract module or a token carried only in evidence? This record requires it to be machine-readable and closed; where it is declared is a delivery choice with an export-inventory consequence. (owner: `@coder` at phase 2)
- [ ] Is the runtime family declaration a new export on the composition or a value derived from the contract's constants at module load? Both satisfy C-6; the choice affects the export inventory and the scan that guards against a second vocabulary. (owner: `@coder` at phase 5)
- [ ] Does the next open-slot family (another namespace) adopt the runtime-declaration shape in the same change or in its own? This record sets the precedent and does not schedule other families. (owner: `@decision-advisor` when such a family is proposed)

## Implementation Plan

1. **Rows first (phase 2).** Add `merge.branch-unresolved`, `merge.request-unresolved` (with its closed reasons) and `merge.work-item-unresolved` to the machine table with `category: user`, a non-retryable value, `consequence: not_landed`, `projectionClass: user-validation` and a remediation naming the object to repair. Narrow the abort's declared causes in the composition's mapping and in the transaction's refusal sites, route a refused landing to the provider identity the composition computes (`provider.outage`, `provider.auth.rejected`, or `merge.landing-unverified` when the landing fired but merged truth was not observed), and set the row's `retryable: false` with its no-convergence remediation (DC-4).
2. **Naming at the refusal sites (phase 2).** Make the credential refusal name `github-read`, `GITHUB_TOKEN` and the operation through the delivered evidence members; make the read-fault refusal name the failed operation; route the unresolvable work item and request to their own identities with the object and the read operation; remove every unnamed-condition remediation.
3. **Exact-member list (phase 2).** Add exactly the three new codes to `MERGE_COMPOSITION_EMITTABLE_CODES` so the containment proof does not regress at the phase boundary (DR-3).
4. **Identity arithmetic (phase 2, one atomic commit).** Move the machine and documented tables, the pinned-count pages, the merge row count and the phrase-table authority together (170 → 173 identities, 169 → 172 delivered rows, 68 → 71 allowlisted two-segment codes, `+ 136` → `+ 139`, merge rows 9 → 12).
5. **Runtime family declaration and the slot rule (phase 5).** Declare the family at runtime beside the exact-member list — the contract's own prefix, suffix and template plus the rule that the slot names an id in the effective declared gate set, validated at emission. Register any new export in the export inventories.
6. **Totality proof (phase 5).** Rewire the containment proof to range over the exact-member list **and** the runtime declaration, remove the source-text assertions, keep the live mismatch control and its resolving counterpart, and derive the family-instance population from the effective gate ids so `merge.gate.ci-green.failed` is the live case under TDR-0072's default.
7. **Rows-level structure proof (phase 2).** Add the row/act-requiring-cause rule over the declared rows and the Appendix B "act required" column, with the substituted pre-change abort row as the mutation control.
8. **Documentation and handoff (phase 7).** Reconcile the documented error table, the merge reference page's exit-status causes and refusal examples, the feature spec's diagnostics and error identities, and the test specification's fidelity/totality/stability rows. Hand the DC-8 statements to `@pm`, and the consumer re-read to `@pm` over the informed list.

**Plan-pinned implementation obligations** (deliberately not decided here; each carries its pinning test):

1. The exact evidence member names for the credential reference, the environment variable and the operation, within the delivered closed envelope — test `merge-refusal-surface`: the three tokens appear in the rendered refusal and the canary value does not.
2. Where the closed request-reason vocabulary is declared (contract module versus evidence token) and how a consumer reads it without prose parsing — test `merge-refusal-taxonomy`: the reason is machine-readable and exactly one of the three.
3. The shape of the runtime family declaration (a frozen value beside the members versus a derived value) and its slot predicate's signature — test `emittable-declaration`: the proof fails when the declaration loses the family and passes when it keeps it, independent of source text.
4. The abort's residual cause enumeration as declared data next to the matrix's "act required" column — test `merge-refusal-rows`: one asserted shape, with the pre-change row as the failing control.

## Rollback / Reversal

- **Revert steps:** revert the delivery commits as a unit. The rows are additive table entries and the abort's narrowing is a routing and text change, so reverting restores the previous refusal vocabulary with no stored-state migration: no record kind, event, schema version, configuration key or provider capability moved, and no persisted refusal is archived. Reverting the phase-5 declaration restores the exact-member list plus the type and the source-text proof, which is behaviourally inert — the classifier resolution was never changed, so no refusal changes meaning under either shape.
- **Stop conditions that trigger rollback:** (a) a consumer is found treating a new code as an internal failure and refusing to proceed, which makes the split worse than the abort it replaced; (b) the credential naming cannot be produced without exposing material at some renderer, which violates C-8 and forbids shipping the naming at all; (c) the runtime declaration cannot be made without a second resolver or a widened slot (C-5), which means the shape was wrong rather than the implementation; (d) the identity arithmetic cannot be landed atomically with the rows, leaving the machine and documented tables divergent — the pair ships together or not at all.
- **Irrecoverable state:** a refusal already emitted in a pipeline log or captured in an operator report is historical evidence and cannot be rewritten; consumers re-reading old logs will see the old codes. Nothing else is irrecoverable: no refusal is persisted as a record of its own, and an in-flight merge refused under the old abort is re-runnable under either vocabulary.

## Communication Plan

- **Audiences (map to `governance.informed`):** consumers that branch on `merge` refusals (coordinator/CEO loop, `@pm`, `@fixer`, operator runbooks); the owners of the rows whose text moves; the TDR-0071/TDR-0072 owners; repositories upgrading the installed tooling; `@pr-manager`.
- **Message (one line):** "A merge refusal now names what to repair — the change record and key, the branch and why no request matched, the work item and read operation, the gate and job, the failed operation, or the credential reference and variable — and a re-run is only called convergent when it is; the gate family is declared at runtime, so the totality proof fails on behaviour, not on text."
- **Channel:** GH-366 PR body (scope held and scope not claimed); the release note (the three new codes, the narrowed abort, the changed `retryable` value); the merge reference page (exit-status causes and refusal examples); the documented error table and the feature spec (identities and counts); the test specification (fidelity, totality, stability rows).
- **Timing:** pre-rollout for the vocabulary and the consumer re-read; at rollout with the delivery; post-rollout for the first consumers that report seeing a new code where they previously saw the abort — that report is the measure of whether the split was legible.

## Verification Criteria

| Criterion | What proves it | Bound |
|---|---|---|
| AC-F3-1 — every matrix refusal names the command, the code and at least one cause, with an actionable-or-absent remediation | TC-MRG-023 over the 22 cells of the test plan's refusal matrix (the spec's Appendix B rows by declared expansions), plus TC-MRG-024's control that fails by name when a dimension is removed | DC-1, DR-5 |
| AC-F3-2 — an absent token refuses `config.credential.missing` naming the reference, the variable and the operation | TC-MRG-020 (`github-read`, `GITHUB_TOKEN`, the read) | DC-2 |
| AC-F3-3 — no credential condition is reported as `merge.transaction-aborted` | TC-MRG-021 over the credential cells | DC-2, DC-4 |
| AC-F3-4 — an unresolvable work item refuses `merge.work-item-unresolved` naming its ref and read operation | TC-MRG-022 (`github-work-item`) | DC-3 |
| AC-F3-5 — `retryable` is the declared row value and never per-instance; remediations are accurate per cause | TC-MRG-025 across all 22 cells (row/family comparison; no per-instance assignment with a planted control) and TC-MRG-027 (pending versus failing on one row) | DC-5 |
| AC-F3-6 — no row declares `true` over an act-requiring cause; the abort's narrowed set carries a true value and remediation | TC-MRG-026 with the substituted pre-change abort row as the mutation control, including the asserted shape of the shipped abort | DC-4, DC-5 |
| AC-F4-1 — a family refusal resolves to the declared family row with the gate id preserved; containment is reached only by an undeclared code | TC-MRG-028 (widened gate-id population, live refusal) and TC-MRG-029 (mismatched kind reaches containment; undeclared slot never passes; no pattern widening) | DC-6, DC-7 |
| AC-F4-2 — totality is proven over a runtime declaration, and its negative control fails by name | The containment proof reads the declaration as a value: deleting the declaration (or replacing it with the bare exact-member list) fails by name rather than as a source-text mismatch, a behaviour-preserving refactor that keeps the declaration passes, and no source-text assertion remains in its place that could pass | DC-6, C-6 |
| The test plan's 22-cell refusal matrix is the naming population | TC-MRG-023/024/025 run over the same 22 cells, derived from the spec's Appendix B rows by declared expansions; a new refusal joins the matrix in its own change | DR-5 |
| Identity arithmetic | Machine/documented sync gate; the delta is exactly the three codes; 170 → 173 identities, 169 → 172 delivered rows, 68 → 71 allowlisted two-segment codes, `+ 136` → `+ 139`, merge rows 9 → 12; every pinned-count page and the phrase-table authority agree, with the banned stale total `167` absent | C-4, DC-8 |
| Secret hygiene and bounds | TC-MRG-039: canary credential value and canary payload text absent from output and records; the names present; delivered output bounds unchanged | C-8, DR-6 |
| No second resolver or vocabulary | The classifier's family resolution is unchanged; a source scan finds no second matcher over the family; the gate-id pattern is byte-identical | C-5, DC-6 |

**Metrics (this decision's share of spec §4.1 and §10):** refusals across the enumerated matrix carrying a named cause — 100 % (22/22 cells); refusals carrying an instruction to clear an unnamed condition — 0; rows declaring `true` over an act-requiring cause — 0; emitted codes resolving to a declared row or the declared family — 100 %; family emissions covered by a runtime declaration rather than a source-text match — 100 %; credential values or payload text in any refusal — 0.

**Review date proposal:** the first retrospective after implementation, once GH-366 has landed and at least one further change has merged through the new refusal vocabulary; then a longer horizon (roughly 90 days) to judge whether the three new codes are being consumed as causes or collapsed back into a generic blocked-merge signal. `review_date` stays `null` until the owner accepts the record, per the record lifecycle.

## Confidence Rating

**Medium-High.** Every cited fact was read in the delivered tree on 2026-11-20 — the abort row and its remediation, the composition's routing of `provider.not-found`, an unparseable ref and an undefined target, the transaction's three residual abort sites, the credential row and the three delivered surfaces that already name a reference and a variable, the family row and the contract's template constants, the classifier's family resolution, the exact-member list and the erased type, and the source-text assertions in the containment proof — so the current-state account is direct evidence rather than inference. The open weaknesses are three: whether any runtime consumer treats the abort as a generic blocked-merge signal was checked by `grep` over the tree and not by observing a consumer; the three rows' declared values are the plan's, not this record's authorship; and the R3 independent challenge has not happened. The narrowed abort's residual set is no longer an open weakness: spec v2.1 pins `retryable: false` and the causes the row still reaches (AC-F3-3, AC-F3-6, §8.5), and TC-MRG-026 asserts that shape. AI-generated confidence is not evidence; the rating states the analyst's read, not a verdict.

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

- **A missing credential.** The environment has no `GITHUB_TOKEN` and no configured reference. The merge refuses `config.credential.missing` at exit 1 naming `github-read`, `GITHUB_TOKEN` and the read operation that needed it, with a remediation to supply it through the declared source — never `merge.transaction-aborted`, and never a hint that says "clear the named condition" without naming it.
- **A request that does not match.** The change record declares a branch, the provider lists no open request whose source ref is that branch. The merge refuses `merge.request-unresolved` with reason `no-open-request`, naming the resolved branch, the read source and the open count `0`, and a remediation to open the delivery request. Two matches instead produce `ambiguous-open-request` with the match count; a match with no asserted head produces `head-unresolved` with the request identity.
- **A work item that does not resolve.** The ref parses but the tracker read returns not-found. The merge refuses `merge.work-item-unresolved` naming the ref and `github-work-item`, with a remediation to repair the ref or the tracker — not the generic abort.
- **A failing required check.** Under TDR-0072's default, `merge.gate.ci-green.failed` names the gate, the job, `ci-failed` and the `probe` attribution. The family row's single `retryable: false` is honest: the job's owner must repair CI, or the repository declares the surface opt-out.
- **A pending required check.** The same family code names `ci-pending` and the pending job, and its remediation says waiting is the convergence. The value is still the family's `false` — the act-free property is carried by the reason and the remediation, not by a per-instance exception.
- **The narrowed abort.** A declared landing gap refuses `merge.transaction-aborted` naming the aborted pre-mutation condition, with `retryable: false` and no promise that a re-run converges; the operator composes the missing capability or changes the mode, then re-runs.
- **The mismatch control.** A code of the family's shape is classified under kind `provider`: it reaches `fallback.internal`, and the same code on kind `merge` resolves to the declared family row. The runtime declaration is what the proof reads, so deleting the family from the declaration fails the proof even though the type name still appears in the file.

## Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-11-20 | Every occurrence of the pinned identity arithmetic now states the synced base and the full five-number set: base **170** machine identities / **170** documented rows / **169** delivered rows / **68** allowlisted two-segment codes / `BASELINE_ROWS.length + 136` at `origin/main-tools` @ `e1ebc76c` (GH-350 merged), moving to **173 / 173 / 172 / 71 / `+ 139`** with the `merge` kind at **9 → 12** concrete rows. Edited: `governance.informed`, the arithmetic revisit trigger, §Context's FACT, C-4's statement, the evidence table row, ALT-3's eligibility line, DC-8, the C-4 attestation, challenge item 8, implementation step 4, and the identity-arithmetic verification row. `167` is recorded as a banned stale total in the repository's phrase table (`tests/checks/doc-conformance.test.ts`, `GH350_PHASE1_ROWS`). | The record carried 167-based arithmetic from before GH-350's merge; the base moved, and a 167-based total is exactly what the phrase table rejects. Verified at `e1ebc76c`: `bun run scripts/checks/error-table-sync.ts` reports `entries=170 documented=170`; the GH-350 block in `tests/checks/error-table-sync.test.ts` pins **169** delivered rows, **68** allowlisted codes and `+ 136`; and the `merge` kind holds **9** concrete rows (`packages/core/src/contracts/error-table.ts`). The delta is unchanged at exactly three rows. |
| 2026-11-20 | Confirmed against the tree that the three added codes are two-segment identities, so they join the closed exact allowlist and move it **68 → 71**, and that the gate-set identity string is unchanged by this change. | The allowlist's `merge` block is nine two-segment codes and a further two-segment `merge.*` code joins that exact allowlist with no widening (`scripts/checks/error-table-sync.ts`, the GH-225/GH-349 comments); `merge.branch-unresolved`, `merge.request-unresolved` and `merge.work-item-unresolved` each carry one dot. The gate-set identity is the schema version plus the entry-id sequence (`packages/core/src/contracts/merge.ts:112`; `packages/core/src/domain/merge-gate-set.ts:58-61`), and three additive error rows are not gate-set entries, so `<schemaVersion>:<id,id,...>` does not move. |
| 2026-11-20 | Named the specification's two added acceptance criteria: the traceability line and the totality verification row now cite **AC-F4-2** (the runtime-declaration negative control), and the amendment records that the inventory is **24** ids — the 22 carried forward plus **AC-F2-8** (the merged report's evaluated projection, F-2 scope and not this record's) and **AC-F4-2**. | The sibling specification's DoR-remediated revision grew the inventory from 22 to 24 ids; a record that cites the §17 inventory must cite the current one. The verification table enumerated no count of 22 acceptance criteria to restate — its `22` references are Appendix B matrix cells, which are unchanged — so the count is restated here and the two ids are named. No criterion this record proves changed. |
| 2026-11-20 | Confirmed, rather than restated: this record makes no claim about the merge path's read budget or about a zero-provider-read branch refusal. Under TDR-0071's correction the branch refusal performs exactly one provider read (the bounded open-request list read, which is also the request-detail read). | The record was checked for the withdrawn property and carries none: its refusal statements name the operation, never a read count. Keeping a stale "zero provider reads" claim beside a TDR-0071 citation would be the same drift class as the arithmetic, and leaving the record silent on the count is the accurate position. |
| 2026-11-20 | Pinned DC-4's shape and closed the residual-cause question. (1) DC-4 is restated as a decided shape rather than an either-or: `merge.transaction-aborted` declares `retryable: false` with a no-convergence remediation; its cause set is the pre-mutation causes that genuinely require an operator act (a waiver-append failure and a declared landing gap); and a refused landing is stated to leave the abort for the provider identity the composition already computes (`provider.outage`, `provider.auth.rejected`, `merge.landing-unverified`), which is what makes the pinned value true for every remaining cause. The superseded clause "if delivery narrows the residual cause set to act-free causes only, the row may instead keep `true` with a convergence claim restricted to that set" is removed; the accepted-risk row, the negative-outcomes list and the context FACT now track the two-cause narrowed set, and the implementation step pins the value instead of deriving it from a residual set. (2) The evidence-table `TO-CONFIRM` row is closed as a resolved `FACT` against the three delivered abort sites (`packages/core/src/domain/merge-transaction.ts:838-844,966-974,1067-1076`) and the spec v2.1 pin (AC-F3-3, AC-F3-6, §8.5), its `@coder`-at-phase-2 ownership is removed, and the duplicate open item in Unresolved Questions is closed with it. (3) The record no longer attributes the 22-cell enumeration to the spec: the 22 cells are the test plan's refusal matrix, derived from the spec's 21 Appendix B data rows (which state "≥ 18 cases") by declared expansions, and the expansion arithmetic stays the test plan's to own. Re-confirmed: the record's AC citations hold at the specification's **25** ids — the 24 it already tracked plus **AC-F1-6**, the converged re-run, which is F-1 scope and adds no obligation here — and the identity arithmetic is unchanged at **173 / 173 / 172 / 71 / `+ 139`** with the `merge` kind at **12**. | The specification's DoR-remediated v2.1 revision pins the abort's value unconditionally and routes a refused landing to a provider identity, so DC-4's either-or is superseded rather than left as a delivery-time choice; leaving the residual set as a `TO-CONFIRM` would let delivery decide a value the spec now decides. The 22-cell attribution was wrong in this record, not in the test plan: the spec's Appendix B has 21 data rows and a `≥ 18` floor, and the 22-cell enumeration is the test plan's declared expansion of them. No constraint statement, accepted risk (severity or acceptor), decision-derived rule or verification criterion changed; the narrowing of the risk row's cause enumeration tracks DC-4 and does not reduce the risk. |

**What this amendment does not change (stated, not inferred).** The decision (ALT-5), its decision-derived rules (DR-1…DR-7), every constraint statement (C-1…C-8) and every accepted risk in substance are unchanged — no risk row is added or withdrawn, no severity or acceptor moves, and the one risk row that enumerated the residual set now names the two causes DC-4 keeps, which does not reduce the risk. The identity delta remains exactly three additive rows. `@decision-critic` has still not reviewed this record: no `PASS`, `PASS_WITH_RISKS` or `REWORK` verdict is claimed. `status` stays `Proposed` with `decision_date: null`, and acceptance remains the human owner's at the GH-366 PR review. No other file was edited by this amendment.


## References

- Change specification: `doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-spec.md` (§2.1 "Diagnostics", §2.2 P-4/P-5, §4 G-3/G-4/G-5, §5.1 F-3/F-4, §8.1 API-3, §8.5, §9 NFR-3/NFR-5/NFR-7/NFR-8/NFR-9, §11 RSK-5/RSK-6, §15 DEC-5/DEC-6/DEC-7/DEC-9, §17.3/§17.4, §18, §21, Appendix B, Appendix C).
- Change test plan: `doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-test-plan.md` (TC-MRG-020…TC-MRG-029, TC-MRG-039, OQ-TP-1, OQ-TP-4).
- Change plan: `doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-plan.yaml` (phase 1 pins this record's path and its index row; phase 2 delivers the rows and the diagnostics contract; phase 5 delivers the runtime declaration and the proof).
- Delivered contracts and code: `packages/core/src/contracts/error-table.ts` · `packages/core/src/contracts/merge.ts` · `packages/cli/src/classify.ts` · `packages/cli/src/production.ts` · `packages/cli/src/output/merge-text.ts` · `packages/core/src/domain/merge-transaction.ts` · `packages/core/src/domain/harness-spawn-env.ts`.
- Proofs and sync gates: `tests/structure/defect-f1-merge-refusal-containment.test.ts` · `tests/structure/merge-refusal-rows.test.ts` · `tests/checks/error-table-sync.ts`.
- System specs: [Merge and Verify-Deploy](../spec/features/feature-merge-verify-deploy.md) · [Result Contract](../spec/features/feature-result-contract.md).
- Related decisions: [ADR-0012 — Provider-side landing path](ADR-0012-provider-side-merge-landing-path.md) · [TDR-0031 — Engine-first evaluation surfaces](TDR-0031-engine-first-evaluation-surfaces.md) · [TDR-0071 — Change-branch resolution and the resolved head](TDR-0071-merge-change-branch-and-resolved-head-authority.md) · [TDR-0072 — Required-check authority and gate membership](TDR-0072-required-check-authority-and-gate-membership.md).
- Change process: [Decision-Making Guide](../guides/decision-making.md) · [Decision Records Management](../guides/decision-records-management.md).
