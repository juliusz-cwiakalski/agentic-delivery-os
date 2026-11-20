---
id: TDR-0072
decision_type: tdr
status: Proposed
created: 2026-11-20
decision_date: null
last_updated: 2026-11-20
summary: "The shipped merge-applicable gate set stops being vacuous: the reserved built-in `ci-green` becomes merge-applicable in the shipped default (effective merge projection `ci-green` + `tracker-freshness`), and the merge-applicable required-check set becomes the union of every merge-applicable `required-ci-job` entry's `job ?? id` and the repository-declared expected job set read through the same delivered CI-workflow read the battery's `ci-green` uses — each name evaluated per job on the resolved head through the single delivered mapping (`evaluateRequiredJobGate`) with `recorded`/`probe` attribution, fail-closed and not waivable, so failing, pending, canceled, skipped, missing and page-not-head checks each refuse by name; the authored remedy is declaring `ci-green` on the `battery` surface, and reserved built-ins gain declared admitted surface sets (`ci-green`: `battery` or `both`; the other four: `battery` only) with recipe and class immutable and an omitted class adopting the shipped class — no new gate id, recipe, configuration key, provider capability, error identity, schema version, or gate-set identity change."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os merge primitive (default gate-set membership, required-check authority, admitted surfaces)"
decision_scope: repo
review_date: null
business_impact: "Every repository that installs the delivery tooling starts evaluating its own CI workflow's job set on the resolved head at merge instead of inheriting the last verification's verdict, and no longer needs hand-authored `required-ci-job` entries to get a merge-time CI evaluation at all. The return is a merge verdict that reflects the head being landed, not the head as it was when it was verified; the cost is one reviewed configuration act for a repository whose CI legitimately skips jobs at merge time."
customer_impact: "A merge over a request with a failing, pending, canceled, skipped or missing required check refuses at exit 1 naming the gate and the job, and a fully green request lands once. A repository that cannot satisfy the gate declares the `ci-green` entry on the `battery` surface and keeps the previous behaviour explicitly rather than silently."
classification:
  domains: [architecture, contracts, operations, ci]
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
  driver: "@decision-advisor (GH-366 spec §15 routes DEC-3 and DEC-4 here as precedent-setting, and §24-C reserves TDR-0072 for exactly this scope)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-366 PR review; AI does not accept this R3 record, so status stays `Proposed` with `decision_date: null` until that review accepts it"
  contributors:
    - "@spec-writer (chg-GH-366-spec §2.1 gate-set facts, §5.1 F-2, §8.3 DM-3, §9 NFR-2/NFR-4/NFR-10, §11 RSK-2/RSK-3/RSK-7, §15 DEC-3/DEC-4/DEC-9, §17.2, §22, §24-B, §24-C)"
    - "@decision-advisor (repository analysis of the merge gate contract, the gate-set resolver, the merge transaction's gate sweep and dry-run loop, the merge probe mapping, the battery's CI gate and its expected-set validity rule, the single-evaluator scan, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "@decision-critic — R3 independent challenge NOT yet performed; the verification surface it must cover is listed under Independent Challenge Status"
    - "Human owner (GH-366 PR review — this record decides what a merge `verified` verdict means for CI by default, and what refusal a repository inherits on upgrade)"
  performers:
    - "@coder (GH-366: the default-set surface change, the declared admitted-surface rule and the class-adoption rule, the required-check set derivation, the merge-surface `ci-green` recipe evaluation on both the dry-run and live paths, and the fail-closed outcome mapping)"
    - "@spec-writer / @pm (the statements this record refines, listed in DC-9)"
    - "@doc-syncer (GH-366 documentation phase: `feature-merge-verify-deploy.md`, the `merge` reference page, the gate-registry defaults, and the release note)"
  informed:
    - "Every in-flight change owner whose delivery lands after this default ships (the merge now evaluates the repository-declared expected job set; a change with a legitimately skipped or conditional job must satisfy the gate or the repository must declare the `battery` surface — spec §19, RSK-2). GH-366 is the first consumer; `@pm` holds the set of in-flight changes at landing time."
    - "Every repository whose CI workflow legitimately skips, conditionally runs, or gates jobs by path or event (RSK-2), and every repository that declares CI in a workflow file other than the one the delivered expected-job read targets (RSK-3) — those repositories must decide between accepting enforcement and declaring the `battery` surface, and the second group is not covered at all by this decision (OQ-2)."
    - "Adopters of the installed delivery tooling (the default arrives with the release note; the opt-out is a configuration declaration, not a flag)"
    - "Coordinators and operators who run `merge` (one refusal family now reaches the default set, and its causes are new in practice: skipped, missing and page-not-head checks)"
    - "The sibling record owners: TDR-0071 (branch resolution and resolved head — this record consumes its resolved head and decides nothing about it) and TDR-0073 (the gate family row's `retryable` and remediation wording, which this record's default-on gate makes load-bearing)"
    - "The OQ-2 follow-on owner (multi-workflow expected-job union), which this record explicitly does not decide"
    - "@pr-manager (unchanged: it never merges)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers:
    - "@decision-critic — NOT yet performed. No PASS, PASS_WITH_RISKS, or REWORK verdict has been issued for this record"
revisit_triggers:
  - "A provider capability for branch-protection required status contexts becomes exercisable (NG-1): the membership authority would have a third candidate source, and whether the provider's declared contexts outrank the repository workflow's job set is a new decision, not a patch."
  - "A repository declares CI across more than one workflow file (OQ-2): the expected-job read targets one declared path, so the union, the precedence between files, and the staleness of a per-file set all need deciding."
  - "Skipped or conditional jobs become the normal case rather than the exception: the declared remedy is a whole-gate opt-out, so if most repositories must opt out, the gate's shape is wrong and the job-level admission question must be decided rather than worked around."
  - "A job that exists only on the request head is missed in normal operation (RSK-3): the expected set is read from the checkout's workflow while the verified object is the request head, and a head-only requirement would need the workflow read moved to the head's content."
  - "A per-invocation or per-job override for the check gate is proposed: this record's answer is that the only remedy is a reviewed configuration act, and a waiver class or `--waive` extension re-opens the fail-closed decision."
  - "`ci-green` is proposed on the `merge` surface for a declared built-in entry: that removes it from the battery projection (NG-2), which this record refuses; the admission set is `battery` or `both` precisely to keep the battery evaluation unchanged."
  - "The expected-set validity rule diverges between the battery and the merge path: one rule shared by both call sites is a decision-derived rule here, and a second copy re-opens it."
  - "An in-flight verification record is invalidated by a gate-set change: the identity is schema version plus entry-id sequence, which this decision does not move; a change that moves either re-opens the compatibility claim."
links:
  related_changes: ["GH-366"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-spec.md"
    - "doc/spec/features/feature-merge-verify-deploy.md"
    - "doc/spec/features/feature-verify-gates.md"
  contracts:
    - "packages/core/src/contracts/merge.ts"
    - "packages/core/src/domain/merge-gate-set.ts"
    - "packages/core/src/domain/merge-transaction.ts"
    - "packages/core/src/domain/merge-probe.ts"
    - "packages/core/src/domain/verify-gates.ts"
    - "tests/checks/merge-check-path-scan.test.ts"
  diagrams: []
  decisions: ["ADR-0012", "TDR-0031", "TDR-0071", "TDR-0073"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S3"]
---

# TDR-0072: Required-Check Authority and Gate Membership — The Shipped Default Enforces the Repository-Declared Expected Job Set on the Resolved Head

> **Traceability.** Spec §15 **DEC-3** (the shipped default makes `ci-green` merge-applicable and the required-check set is the declared `required-ci-job` entries plus the CI entry's repository-declared expected job set) and **DEC-4** (fail-closed, no waivability, the admitted-surface rule as contract data); §24-C reserves this record; §2.1 (gate-set and delivered-required-check facts); §5.1 F-2; §8.3 DM-3; §9 NFR-2/NFR-10; §11 RSK-2/RSK-3/RSK-7; §17.2 AC-F2-1…AC-F2-7; §17.3 AC-F3-5/AC-F3-6; §22; §24-B. Sibling records own the adjacent decisions: **TDR-0071** (change-branch resolution and the resolved head as the verified head) and **TDR-0073** (the refusal-diagnostics contract, row-level retryability, and emitted-identity totality).

## Context

`merge` is the lifecycle landing path. It consumes a gate-verification record, enforces a freshness envelope, reads the tracker and one check-run page on the verified head, and lands through exactly one provider-side call. The gate set is config-declared versioned data shared with `verify gates`: six shipped entries of which five are reserved built-ins. The shipped default projects **one** entry onto the merge surface, and that entry is a tracker gate. The consequence is not a missing capability — both the persisted-verdict check and the per-job machinery are delivered — but **two** facts about the shipped default: the merge projection carries no check gate, and the check-run page is never consulted for the built-in CI gate on the merge path. What the default does enforce is a CI verdict the **battery** persisted for the same head; what it never does is read the page at merge time.

- **FACT:** The shipped default set declares the five built-ins on the `battery` surface — `lifecycle-finalization`, `ci-green`, `push-parity`, `owner-gate`, `squash-preflight` — plus `tracker-freshness` on the `merge` surface, in that order (`packages/core/src/contracts/merge.ts:72-92`, read 2026-11-20; `ci-green` at `:78`).
- **FACT:** The three-value surface dimension is `battery | merge | both` (`contracts/merge.ts:36-38`); the battery projection is `battery | both` and the fresh merge projection is `merge | both` (`packages/core/src/domain/merge-gate-set.ts:92-96`). The enforced merge set adds **every built-in regardless of surface** (`:82-86`).
- **FACT:** `merge --dry-run` evaluates exactly the fresh merge projection, and its loop knows two recipes: `required-ci-job` and `tracker-freshness`. Any other recipe — including the built-in `ci-green` — receives `verdict: unknown, reason: read-failed` (`packages/core/src/domain/merge-transaction.ts:1219-1269`, the fallback at `:1263-1268`). With the shipped default the dry-run projection is one entry, so the recorded dry-run verdict is `gates=1/1` whether the head is green or red (spec §2.1).
- **FACT:** The live gate sweep skips `ci-green` explicitly (`merge-transaction.ts:755-757`) and evaluates only `required-ci-job` entries — recorded verdict first (`:760-775`), then the fresh page (`:777-796`). The post-refusal checks posture reads the same narrowed set (`:468-471` `declaredCiJobsOf`, `:487-504` `checksPostureOf`, consumed at `:990-1006`). So the fresh page is never consulted for the built-in CI gate, and a persisted green CI verdict is never contradicted by the page.
- **FACT:** The recorded half of the path is **delivered and reachable**. A persisted non-pass `ci-green` verdict is converted into a refusal whenever a `ci-green` entry is found in the enforced merge set (`merge-transaction.ts:690-708`), and every built-in is unconditionally in that set regardless of its declared surface (`merge-gate-set.ts:81-86`; the type comment at `:46-52` states exactly this). The shipped default therefore **does** refuse a merge when the newest verification record for the resolved head carries a failing, pending, canceled or skipped `ci-green` verdict, and the freshness envelope binds that record to the head being merged (`merge-transaction.ts:569-590`; the delivered bound is 1800 s, `contracts/merge.ts:104`).
- **FACT:** Stated precisely, the pre-change defect is: **the recorded verdict is consulted, the fresh check-run page is not, and the fresh merge projection is one gate.** Under the shipped default the merge's own evaluation contributes no CI evidence and reports `gates=1/1`; a CI verdict recorded for the resolved head is honored either way; a check that turns red after `verify gates` but inside the freshness bound is invisible; and a page that is not the head is skipped rather than refused. The change's own success metrics confirm the intended repair is the fresh half: two merge-applicable gates under the shipped default (§4.1), not merely "some CI enforcement".
- **FACT:** The single per-job mapping is `evaluateRequiredJobGate` (`packages/core/src/domain/merge-probe.ts:163-233`): a page for another SHA is `unknown`/`head-unresolved`; an absent job is `fail`/`ci-missing-jobs`; `failed`, `pending`, `canceled`, `skipped` keep `ci-failed`, `ci-pending`, `ci-canceled`, `ci-all-skipped`; otherwise `pass`/`ci-green`. It is the one evaluator shared by the battery's declared-battery evaluation and the merge probe, and a scan enforces that exactly one exported required-check evaluator exists in product source, with a planted-second-evaluator failing control (`tests/checks/merge-check-path-scan.test.ts:100-114`).
- **FACT:** A page whose SHA is not the verified head is treated as **no finding**, not as a refusal, on both delivered query paths: the live sweep `continue`s before evaluating (`merge-transaction.ts:737,776`) and the posture helper returns `undefined` (`:493`). The dry run, which has no skip, would surface the mapping's `unknown`/`head-unresolved`.
- **FACT:** The battery's `ci-green` gate reads the repository's own CI workflow job set through the delivered read and cites the source `repository-ci-workflow` (`packages/core/src/domain/verify-gates.ts:398-430`, source at `:404-410`, names at `:430`). Its validity rule is one predicate (`expectedSetValid`, `:231-241`): the read outcome must be `read`, the set must be non-empty and within the declared cap, each name non-empty and within the name cap, and no duplicate. An invalid set fails the battery gate with the delivered reason `ci-expected-jobs-invalid` (`:412-428`).
- **FACT:** A declared set replaces the shipped default wholesale and must reproduce every built-in **exactly — recipe, surface, and class** — or it is refused (`merge-gate-set.ts:227-245`). A declared entry may therefore not move `ci-green` to `both` today, and an omitted `class` on `owner-gate` is refused rather than adopting the shipped class (`parseEntry` already tolerates an absent class at `:135-144`; `sameEntry` at `:103-108` is what rejects it).
- **FACT:** The effective gate-set identity is the schema version plus the entry-id sequence (`merge-gate-set.ts:58-61`; separator `contracts/merge.ts:113`). Changing only an entry's `surface` value leaves that identity byte-identical, and `ci-green` is already an entry in the sequence, so this record's change moves no identity at all.
- **FACT:** The delivered error-register arithmetic at the change's base (`origin/main-tools` @ `e1ebc76c`, GH-350 merged) is **170 machine identities / 170 documented rows / 169 delivered rows / 68 allowlisted two-segment codes / `BASELINE_ROWS.length + 136`**, with the `merge` kind holding **9** concrete rows beside its one open-slot family row (`tests/checks/error-table-sync.test.ts:1841-1888`; `tests/structure/error-table.test.ts:3379-3423`; `packages/core/src/contracts/error-table.ts`). The change's three declared diagnostic rows — TDR-0073's, not this record's — move that arithmetic to **173 / 173 / 172 / 71 / `+ 139`**, taking the `merge` kind to **12** concrete rows. The gate-set identity is not part of that arithmetic and does not move.
- **FACT:** The change's success metrics require two merge-applicable gates under the shipped default (§4.1) and **zero** in-flight changes forced to re-verify because of this change.
- **Why now:** The observed failure is `gates=1/1 passed` over a request with failing CI. Two requests — one green at verification time, one red at merge time — receive the same verdict, because the merge consumes **one persisted CI verdict for the resolved head and never reads the page**: a check that turns red after `verify gates` within the delivered 1800 s freshness bound is invisible to the merge, and a page that is not the head is skipped rather than refused. The gap this decision closes is therefore **fresh evaluation at merge time plus merge-projection membership**, not the existence of CI enforcement — the persisted-verdict half is delivered, is a safeguard, and stays. The change that repairs the merge slice's identity defects (GH-366) is the only place this can be fixed without a second delivery touching the same default, and the fix is a membership-and-authority decision rather than a new capability.

## Problem Framing (Clarified)

The symptom is "the merge projection is vacuous on CI". The cause is not that CI evaluation is missing from the product — the per-job mapping, the battery's evaluation, and the persisted-verdict refusal all exist — but that **three separate authorities decide which checks are required, and the shipped default elects none of them for the merge's own CI evaluation**:

1. **Membership.** Which gates does a merge *freshly* evaluate? Today: whichever entries carry `merge` or `both` — one tracker gate. A built-in whose recipe is CI sits on `battery` only, so the merge projection has no CI member; the enforced set does carry it, but only for the persisted-verdict check, never for a fresh evaluation.
2. **The required set.** Which checks must be green? For the merge's own evaluation today: only authored `required-ci-job` entries. A repository that authors nothing requires nothing *of the merge*, even though the battery reads its workflow's declaration for its CI gate — so the same repository has a battery verdict that enforces its jobs and a merge projection that enforces none. That battery verdict does reach the merge as a persisted fact, which is why the gap is one of **fresh authority at merge time**, not of authority in the product.
3. **State.** Which job states are green? Today: the delivered mapping, which is correct and single — but it is fed only from authored entries on the merge path, and a page that is not the head is skipped rather than refused on the live path.

Stated as decision questions:

- **Q1 — Authority.** Which declared source says which checks a merge must see, given that the product has no branch-protection required-contexts read and will not gain one?
- **Q2 — Membership.** How does the built-in CI gate become merge-applicable without adding an id, a recipe, a configuration key, or a schema version — and without changing what the battery evaluates?
- **Q3 — Enforcement shape.** Is a non-green check a refusal, a waiver, or a skip — and what is the authored remedy when a repository genuinely cannot satisfy it?

**The non-obvious part, stated because it is the whole decision.** Q1 and Q2 are one question wearing two hats. Moving `ci-green` onto the merge surface while leaving the required set to authoring produces either a universal refusal (the dry run has no evaluation for the recipe, so the entry is `unknown`/`read-failed`) or a silent pass (the live sweep skips the built-in id, so the entry is admitted to the projection and then never evaluated). Flipping the default without deciding the required set therefore trades a check-blind projection for a broken one. Conversely, deciding the required set without moving the membership changes nothing at merge time, because no merge-applicable entry would consume it. The default membership and the required-set derivation are decided together, and the implementation plan forbids shipping one without the other.

**Deliberately out of scope, so the boundary is reviewable.** No branch-binding decision (TDR-0071): this record consumes the resolved head as given. No refusal-diagnostics contract, row wording, or `retryable` policy (TDR-0073); this record states only the fail-closed outcomes its own gate produces, and requires that the family row it reuses stay honest under them. No multi-workflow union (OQ-2). No branch-protection read (NG-1). No battery evaluation change, no `verify gates` output or golden change (NG-2). No waiver-policy change, new waiver class, or `--waive` extension (NG-6).

## Constraints (Hard Requirements)

These are the gates an alternative must pass to be *eligible*. Each is independently sourced from the change's acceptance criteria, NFRs, and non-goals; requirements that merely restate this record's chosen design appear later as decision-derived rules and are **not** used to eliminate alternatives.

### C-1: No new provider operation, credential reference, or network location

- **Statement:** The required-check authority is derived from sources the product already reads: the repository's declared CI workflow (a local read through the delivered expected-job read) and the delivered commit check-runs page. No new provider operation, capability, scope, credential reference, endpoint, or network location is introduced, and no branch-protection required-status-contexts read exists or is added.
- **Source:** AC (spec §8.4, §7.2 [OUT], NG-1, NFR-2); §21
- **Verification:** test (adapter operation, capability, and credential-reference inventories equal their pins; the new suite performs zero network calls and spawns zero child processes) + code review
- **Negotiable:** no

### C-2: Additive within v1 — no new gate id, recipe, configuration key, schema version, or identity change

- **Statement:** The effective gate set keeps exactly its delivered ids, recipes, surfaces, schema versions, entry fields, and identity construction (schema version plus entry-id sequence). No configuration key is added, no record kind or payload schema moves, and the identity string produced by the shipped default equals the pre-change string, so no in-flight verification is invalidated and no authored declaration becomes invalid.
- **Source:** AC (spec §8.3 DM-3, §8.5, §9 NFR-8, §15 DEC-9, §19; §4.1 "In-flight changes forced to re-verify: 0")
- **Verification:** test (id/recipe/key/schema inventories and pins; the exact identity string before and after; every delivered authored-set fixture still resolves) + code review
- **Negotiable:** no

### C-3: One required-check evaluator, no second mapping and no prose classification

- **Statement:** Every required check, on every path (dry run, live gate sweep, post-refusal posture), is evaluated through the one delivered per-job mapping. No second evaluator, no parallel scoring, and no classification from a check's name or message text is introduced. The single-evaluator scan and its planted-control case stay green.
- **Source:** internal standard (the delivered single-evaluator contract, `doc/spec/features/feature-merge-verify-deploy.md:195-199`) + AC (spec §5.1 F-2, AC-F2-1)
- **Verification:** test (`tests/checks/merge-check-path-scan.test.ts` unchanged and green, including its failing control; every path's evaluation traced to the one entry point) + code review
- **Negotiable:** no

### C-4: Bounded reads — one expected-job read and one check-run page per invocation

- **Statement:** Per invocation the merge path performs at most one repository-CI-workflow expected-job read (a provider-independent local read) and one check-run page read on the resolved head. Zero pagination, zero retries, zero waiting or polling, and no second workflow read. An expected set that cannot be read or is invalid refuses without an additional read.
- **Source:** AC (spec §9 NFR-2, NFR-10, §7.2 [OUT])
- **Verification:** test (per-invocation read counts on the all-green, failing, pending, skipped, missing, page-not-head, and invalid-expected-set paths; zero retry/pagination assertions) + code review
- **Negotiable:** no

### C-5: The verification surface is AC-F2-1…AC-F2-7 and AC-F3-5/AC-F3-6

- **Statement:** The binding verification surface is spec §17.2 (AC-F2-1 failing check refuses with the check and gate named and zero landing calls; AC-F2-2 pending refuses with the pending reason; AC-F2-3 green dry run verifies and the merge lands once, so green and failing never share a verdict; AC-F2-4 a page for another SHA is never head evidence and never a pass; AC-F2-5 a CI read fault refuses with the declared provider identity naming the operation; AC-F2-6 a declared job is enforced while an undeclared, non-expected job is not evidence; AC-F2-7 built-ins reserved and mandatory, recipe and class immutable, omitted class adopts the shipped class, `ci-green` admitted on `battery`/`both`, the other four on `battery` only) plus §17.3 AC-F3-5/AC-F3-6 (the emitted `retryable` is the declared row value and no remediation instructs an operator to clear an unnamed condition; no row declares `retryable: true` while a cause it reaches needs an operator act before a re-run converges).
- **Source:** AC (spec §17.2, §17.3)
- **Verification:** test (the planned cases TC-MRG-010 … TC-MRG-019 and TC-MRG-025/TC-MRG-027/TC-MRG-028) + review
- **Negotiable:** no

### C-6: Fail closed and not waivable — the remedy is a reviewed configuration act

- **Statement:** Every condition in which a required check is not affirmatively green — failing, queued or running, canceled, skipped, absent from the page, a page for another SHA, an unreadable or invalid expected set, a read fault — refuses by name and never passes. The check gate gains no waiver class and no per-invocation override; `--waive` keeps its delivered semantics for the gates that carry a class binding. The declared remedy for a repository that cannot satisfy the gate is declaring the `ci-green` entry on the `battery` surface: a reviewed configuration act, not a run-time bypass.
- **Source:** AC (spec §5.1 F-2 outcomes table, §7.2 [OUT] waiver scope, AC-F2-1…AC-F2-5, AC-F3-5; NG-6); §15 DEC-4
- **Verification:** test (each non-green and each unreadable condition refuses at exit 1 with the named cause and zero landing calls; a `--waive` attempt on the CI gate is refused as an unwaivable gate; the surface opt-out removes the gate from the merge projection) + code review
- **Negotiable:** no

### C-7: Membership from the gate set, state from the page

- **Statement:** Which checks are required is decided by the effective gate set alone (its declared entries plus the built-in CI entry's repository-declared expected set). Which state a required check is in is decided by the check-run page for the resolved head alone. No third authority exists: the page never supplies membership, and the gate set never supplies state. A job neither declared nor expected is never gate evidence.
- **Source:** internal standard (the declared-sources rule) + AC (spec §5.1 F-2 "Where those two sources disagree the page wins on state and the gate set wins on membership", AC-F2-6)
- **Verification:** test (an undeclared red job on the page produces no refusal; a declared job absent from a green page refuses; a page for another SHA never becomes evidence) + code review
- **Negotiable:** no

### C-8: Existing authored sets and in-flight verification remain valid

- **Statement:** A set authored under the delivered rule stays accepted: every built-in on its shipped surface, including `ci-green` on `battery`, remains valid and is the documented opt-out. No stored verification or transaction record becomes unreadable, no change is forced to re-verify, and the admission rule only widens what is accepted (`ci-green` on `both`) without narrowing what was accepted.
- **Source:** AC (spec §8.5, §9 NFR-8, §4.1, §19; AC-F2-7)
- **Verification:** test (every delivered authored-set fixture still resolves; the identity string is unchanged; the existing verification-record fixtures stay consumable; a `ci-green`-on-`battery` declaration produces a one-entry merge projection) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below keeps the delivered determinism and offline guarantees (NFR-1, NFR-4), the declared output bounds (NFR-3, including the evaluated-count disclosure), secret hygiene (NFR-9), and zero landing calls on every refusal. None of these eliminates an alternative.

## Decision Drivers

1. **The shipped default must evaluate CI freshly, not inherit a verdict.** A default whose only CI evidence is a persisted verdict cannot distinguish a request that is green *now* from one that was green when it was verified, and it cannot refuse a page that is not the head. That is a defect in the default, not a configuration choice for each repository; a repository that authors nothing should still get the CI enforcement its own workflow declares, evaluated on the head it is about to land.
2. **Reuse the owner's reserved surface.** The defect is membership, and the reserved id, the recipe, and the delivered evaluator already exist. A new id or recipe buys no semantic gain and costs a wider reserved surface.
3. **One evaluator, one mapping.** Two evaluations of the same page would drift; the deliverable is a wider **input** to the one mapping, not a second one.
4. **Membership and state must not cross.** A page-as-membership rule inverts the declared-set contract and lets an unrelated red job block a merge; a gate-set-as-state rule fabricates a verdict no page supports.
5. **Fail closed, and name the cause.** A check the merge cannot affirm is a refusal with a job name, not a skip and not an inference from prose.
6. **The remedy must be reviewable.** An in-band waiver on CI would let a failing pipeline land silently-by-policy; a surface declaration appears in the reviewed configuration diff, and it removes the gate visibly rather than overriding it invisibly.
7. **No invalidation.** A default-membership change must not force in-flight changes to re-verify or invalidate stored records; the gate-set identity is the contract that makes this provable.
8. **Bounded cost.** The authority must be readable once per invocation with no pagination, retry, waiting, or second workflow file.
9. **Adopter legibility.** The default arrives in every installed repository; the operational consequence (skipped or conditional jobs, and the checkout-versus-head fidelity gap) must be stated in the same change, and the opt-out must be visible where configuration is reviewed.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-366 spec §15 routes DEC-3 and DEC-4 here as precedent-setting, and §24-C reserves TDR-0072 for this scope.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-366 PR review. AI does not accept this R3 record.
- **Contributors:** `@spec-writer` (§2.1, F-2, DM-3, NFR-2/10, RSK-2/3/7, DEC-3/4/9, §17.2, §22, §24-B/C); `@decision-advisor` (gate contract, gate-set resolver, transaction gate sweep and dry-run loop, probe mapping, battery CI gate and validity rule, single-evaluator scan, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, `@decision-critic` (R3 independent challenge — **not yet performed**; its surface is listed under Independent Challenge Status), and the human owner.
- **Performers:** `@coder` (default membership, admitted-surface and class-adoption rules, required-check set derivation, merge-surface CI evaluation on the dry-run and live paths, fail-closed outcome mapping); `@spec-writer` / `@pm` (the statements listed in DC-9); `@doc-syncer` (merge feature spec, reference page, gate-registry defaults, release note).
- **Informed:** every in-flight change owner and every coordinator/operator who runs `merge`; repositories with legitimately skipped or conditional jobs and repositories that declare CI outside the targeted workflow file; adopters; the sibling record owners TDR-0071/TDR-0073; the OQ-2 follow-on owner; `@pr-manager`.

**Rigor note.** Classified **R3**, not R2: the decision changes what a merge `verified` verdict means by default, ships a fail-closed refusal that every adopter inherits on upgrade, and sets the membership precedent the battery side is already built on. Reversibility is `easy` (a shipped constant plus documentation, with no stored-state migration) and uncertainty is `low` (every cited fact was read in the tree on 2026-11-20) — but the assurance this needs is a challenge and a human decision, not a lighter record. `@decision-critic` has **not** run; no verdict is claimed.

**Type note.** Authored as a **TDR** because the caller reserved TDR-0072 and the decision is a membership-and-authority contract inside the established landing architecture ([ADR-0012](ADR-0012-provider-side-merge-landing-path.md)): it changes no component boundary, introduces no new mechanism, and reuses the delivered evaluator and read. The tie-breaker would prefer an ADR at `blast_radius >= team`, and `team` is declared honestly here (every in-flight change, every adopter). If the owner reads the default-enforcement contract as architecture-defining, the record is **re-typed as an ADR at acceptance** — the classification changes, not the decision.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The shipped default declares five built-ins on `battery` plus `tracker-freshness` on `merge`, in that order. | FACT | `packages/core/src/contracts/merge.ts:72-92` (read 2026-11-20) | The fresh-projection claim, the one-gate dry-run verdict, and C-2's identity arithmetic would be wrong. | High |
| The fresh merge projection is `merge` or `both`, and the enforced merge set adds every built-in regardless of surface. | FACT | `packages/core/src/domain/merge-gate-set.ts:82-96` (read 2026-11-20) | If enforced membership already keyed on the merge projection, the recorded-verdict reachability analysis would change. | High |
| The dry-run loop evaluates only `required-ci-job` and `tracker-freshness` and yields `unknown`/`read-failed` for any other recipe, so the default's one-entry projection never consults CI. | FACT | `packages/core/src/domain/merge-transaction.ts:1219-1269` (read 2026-11-20) | A CI evaluation would already exist on the dry-run path and the defect would be smaller. | High |
| The live gate sweep skips `ci-green` and evaluates only `required-ci-job` entries; the post-refusal posture reads the same narrowed set. | FACT | `merge-transaction.ts:468-471,487-504,755-802,990-1006` (read 2026-11-20) | If the built-in were already probed, the fresh half would be delivered and only membership would be missing. | High |
| A persisted non-pass `ci-green` verdict **does** refuse at merge today: the enforced merge set contains every built-in regardless of its declared surface, and the freshness envelope binds the consumed record to the resolved head. | FACT | `merge-transaction.ts:690-708,569-590`; `merge-gate-set.ts:81-86,46-52` (read 2026-11-20) | If the recorded half were unreachable, the defect would be wider (no CI enforcement at merge at all) and the decision's necessity stronger, not different. | High |
| One per-job mapping exists, it is shared by the battery and the merge probe, and a scan enforces exactly one exported evaluator with a failing control. | FACT | `packages/core/src/domain/merge-probe.ts:163-233`; `tests/checks/merge-check-path-scan.test.ts:100-114` (read 2026-11-20) | A second mapping would be needed, contradicting C-3. | High |
| A page for another SHA is skipped rather than refused on both delivered query paths, while the mapping itself answers `unknown`/`head-unresolved`. | FACT | `merge-transaction.ts:737,776,493`; `merge-probe.ts:178-185` (read 2026-11-20) | If the live path already refused, AC-F2-4's live half would be delivered and DR-5 would be a no-op. | High |
| The battery's CI gate reads the repository CI workflow through the delivered expected-job read, cites `repository-ci-workflow`, and applies one validity predicate with the `ci-expected-jobs-invalid` reason. | FACT | `packages/core/src/domain/verify-gates.ts:231-241,398-430` (read 2026-11-20) | The reuse claim would need a new read, contradicting C-1/C-4. | High |
| A declared set must reproduce every built-in exactly (recipe, surface, class), so `ci-green` on `both` and an omitted built-in class are refused today. | FACT | `merge-gate-set.ts:103-108,135-144,227-245` (read 2026-11-20) | If the admission set were already open, DM-3 would be documentation only. | High |
| The effective identity is the schema version plus the entry-id sequence. | FACT | `merge-gate-set.ts:58-61`; `contracts/merge.ts:113` (read 2026-11-20) | NFR-8's "zero re-verify" claim would not be provable from a surface-only change. | High |
| A repository's CI workflow declares the job names the delivered expected-job read yields, in the one declared workflow path. | ASSUMPTION | Spec §12; the delivered read targets one declared path (OQ-2 defers the multi-file union) | A repository with no such workflow fails the gate explicitly and must opt out; a repository with a second workflow file is not fully covered (RSK-3). | Medium-High |
| The provider's check-run page names a repository job by the same job name the workflow declares. | ASSUMPTION | The mapping matches a job name or a pipeline name (`merge-probe.ts:128-150`); the battery already compares these two sources | If the naming conventions differ, every expected job would read as missing and refuse; the gate would be unusable rather than unsafe. | Medium-High |
| The pre-change reach, stated exactly and resolved on 2026-11-20 against `e1ebc76c`: the persisted `ci-green` verdict for the resolved head **is** consulted and refuses on non-pass; the fresh page **is not** consulted for the built-in (the sweep skips it; the dry run yields `unknown`/`read-failed`); the fresh merge projection is one gate. | FACT | `merge-transaction.ts:569-590,690-708,755-757,1220-1268`; `merge-gate-set.ts:81-86,92-96` (read 2026-11-20) | If a fresh CI evaluation existed on the merge path, half of this decision would already be delivered and only membership would remain. | High |
| The **required-check path adds no provider read of its own**: the merge-applicable expected-job set is supplied by the composition from the already-delivered CI-workflow read, wired **once** at composition time, and the dry-run path consumes that supplied fact rather than reading it again. The run's provider-read budget is **at most two reads** (the PM's DoR iteration-3 ruling), and neither read belongs to this record's authority: one bounded open-request list read on the resolution path (which also supplies the request detail), plus at most one bounded closed-list read on the convergence path — no pagination, no retry, no fetch — whose merged matches are filtered by the declared branch convention, with the merged-match count observed as `0`, `1` or `2+` and `2+` refused (`merge.request-unresolved` / `ambiguous-merged-request`) rather than ranked. The closed-list read is the **convergence path's**: this record's required-check authority neither performs it nor depends on it, so DC-8's cost is unchanged. | FACT (wiring and delivered surfaces) + ruling (the two-read budget) | `packages/adapters/src/github/client.ts:462-475` (`listDeliveryRequests` is `?state=open`) and `:478-499` (`findMergedDeliveryRequest` is the separate `?state=closed` read) (read 2026-11-20); PM read-budget ruling, GH-366 DoR iteration 3 critical finding 1 (`readiness-review/readiness-iter-3.md`; `chg-GH-366-pm-notes.yaml` notes, 2026-11-20); `chg-GH-366-plan.yaml` phase 4 (the composition-wired CI-workflow read and the one-per-invocation required-set derivation) | A third provider read on the run, or a per-path re-read of the workflow, would contradict the two-read budget and C-4; a required-check path that read the closed list itself would make this gate depend on a convergence read and exceed its declared cost. | High |
| Whether `cyaml`-style conditional jobs in the repository workflow should be modelled as jobs at all. | TO-CONFIRM | The expected set is exact job names, not a conditional evaluation; a conditionally-skipped job is `skipped` in the mapping | A skipped job refuses under this decision; the declared remedy is the surface opt-out, and job-level admission is out of scope (revisit trigger). (owner: the human owner at the GH-366 PR review) | Medium |

## Mental Models & Techniques Used

- **First principles:** What must be true for "a merge refuses a red request by default"? (i) a merge-applicable CI member, (ii) a required set derived from declared sources the repository already maintains, (iii) one per-job state mapping, (iv) a fail-closed outcome for every non-green and every unreadable state, (v) an authored remedy that is visible. Five requirements produce one surface value, one union, one evaluator, one outcome table, and one admission rule — and rule out every mechanism that adds an authority.
- **Inversion:** How could this change make merges worse than the recorded-only default? Enforce every job on the page (unrelated red jobs block); enforce no job because the workflow read failed (a silent pass); treat a page for another SHA as "no finding" (the delivered skip, reproduced at a larger blast radius); require `surface` not equal to the shipped value (invalidates every authored set); let a waiver carry the failing pipeline. Each inversion is answered by a stated gate or decision-derived rule.
- **Second-order thinking:** Two consequences are not obvious. First, `both` — not `merge` — is the required surface value for `ci-green`: `merge` alone would drop it from the battery projection and change `verify gates` and its goldens, which NG-2 forbids. Second, the dry-run record becomes the merge path's CI evidence: once the merge projection carries the gate, a `merge --dry-run` record contains a CI verdict, so the recorded attribution has a producer on the merge path for the first time and the probe is the only way to contradict a stale pass.
- **Systems thinking:** The chain is: effective gate set → merge projection → required-check union → expected-job read → check-run page on the resolved head → per-job mapping → family refusal or pass → landing. Each join has exactly one declared authority; the decision pins every join and forbids a second source at any of them.
- **Opportunity cost:** Adding a new reserved built-in buys a clearer name and costs a wider reserved surface, a moved battery/golden surface (NG-2), and a second id every author must reason about — for a semantic that the reserved `ci-green` already names. Reading the provider's protection contexts buys "exactly what the provider requires" and costs a capability the product does not have (NG-1).
- **KISS / OODA:** Observe the declared set and the declared workflow, orient on the page for one SHA, decide with one mapping, refuse by name or land once. No ranking, no inference, no waiting.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails · ⚠️ passes only with an extra safeguard that is not counted as a pass. The matrix scores the independently sourced gates C-1…C-8 only. An option can pass every gate and still be rejected on drivers; the eligibility line under each alternative says which.

| | C-1 no new capability | C-2 additive v1 | C-3 one evaluator | C-4 bounded reads | C-5 AC surface | C-6 fail closed | C-7 one authority per axis | C-8 existing valid |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the default recorded-only | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| ALT-1 add a reserved built-in (`all-checks-green`) | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-2 read provider required contexts | ❌ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ✅ |
| ALT-3 treat every page check as required | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| ALT-4 flip the surface only, required set authored | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| ALT-5 selected: default membership + declared union + admitted surfaces | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Baseline: Keep the Default's CI Enforcement Recorded-Only and Require Every Repository to Author `required-ci-job` Entries

- **Eligibility:** Not eligible (fails C-5, C-6).
- **Summary:** Change nothing in the shipped default. A merge keeps enforcing CI only through the battery's persisted verdict for the resolved head; document that a repository wanting the merge to **evaluate** its checks itself — rather than inherit that verdict — must author `required-ci-job` entries (an authored `both` declaration is impossible today, so authored `required-ci-job` entries on the `merge` surface are the only path).
- **Constraint compliance:** Passes C-1…C-4, C-7 and C-8 trivially. Fails C-5: AC-F2-1, AC-F2-2 and AC-F2-3 are all phrased over **no `merge.gates` declaration** — the "given" is the shipped default, so a repository that authors nothing must still have the CI gate in its merge-applicable set and refuse a failing or pending check there. Fails C-6: the merge's own evaluation has no check condition to fail closed on, and a request that turns red after verification shares a verdict with a green one.
- **Driver fit:** Fails drivers 1, 2, 5, 9; serves only "zero new obligation".
- **Pros:** Zero change; no adopter surprise; no documentation sweep; the persisted-verdict safeguard keeps working exactly as it does today.
- **Cons:** The observed defect persists by default; the delivered per-job machinery keeps a merge-side consumer that authors must construct by hand; the repository's own workflow declares jobs the merge never evaluates itself; the change spec's primary metric (two merge-applicable gates) is unmet.
- **Why rejected:** Documentation cannot make a check-blind projection evaluate a check. The persisted-verdict path this baseline leaves in place cannot see a head that turned red after verification, cannot refuse a page that is not the head, and does not satisfy AC-F2-1…AC-F2-3, which are phrased over the merge-applicable set — under this baseline it has no CI member.

### Alternative 1 — Add a New Reserved Built-in (e.g. `all-checks-green`)

- **Eligibility:** Not eligible (fails C-2, C-8).
- **Summary:** Introduce a sixth reserved built-in whose recipe reads the expected job set, and put it on the merge surface by default.
- **Constraint compliance:** Fails C-2: the reserved id set, the recipe vocabulary, the entry-field pins, and the gate-set identity all move, so every in-flight verification becomes identity-incompatible — which also fails C-8. The battery's five-gate surface and its goldens move, against NG-2.
- **Driver fit:** Serves driver 1 and is neutral on 3–8; fails driver 2 outright.
- **Pros:** A name that reads clearly ("all checks green") and leaves `ci-green` untouched.
- **Cons:** A wider reserved surface for every author; a recipe that duplicates `ci-green`'s semantics; a moved battery surface and goldens; an identity change forcing re-verification of in-flight changes.
- **Why rejected:** It buys naming clarity with a schema, golden, and identity cost for a semantic the reserved `ci-green` already carries.

### Alternative 2 — Read the Provider's Branch-Protection Required Status Contexts

- **Eligibility:** Not eligible (fails C-1, C-5, C-7).
- **Summary:** Read the provider's required status contexts for the target branch and treat exactly those as the required set.
- **Constraint compliance:** Fails C-1: no such capability exists in the product, and adding it is a new provider operation, scope, and credential surface (NG-1). Fails C-7: the provider becomes the membership authority, so the effective gate set no longer decides what a merge must see. Fails C-5: the ACs are stated over declared sources the product reads today, and this option cannot be verified offline.
- **Driver fit:** The best possible fidelity (driver 1) at the cost of drivers 2, 4, 8; it also cannot be tested without a live provider, breaking determinism.
- **Pros:** Exactly what the provider protects; no local workflow parse; no drift between declaration and protection.
- **Cons:** Requires a capability that does not exist; adds a credential and a read to a path whose budget is one page; makes the merge verdict depend on a repository setting the operator cannot review in the change; untestable offline.
- **Why rejected:** It is the right long-term authority only if the capability ever exists (revisit trigger); today it is unimplementable and would break the declared-sources rule if it did.

### Alternative 3 — Treat Every Check on the Page as Required

- **Eligibility:** Not eligible (fails C-5, C-6, C-7).
- **Summary:** Skip the declared set entirely; evaluate every check run on the resolved head and refuse if any is not green.
- **Constraint compliance:** Fails C-7: the page supplies membership, inverting the declared-set rule. Fails C-6: an unrelated advisory job, a documentation-only workflow, or a transient environment check would block a merge with no declared repair. Fails C-5: AC-F2-6 requires an undeclared, non-expected job to be no evidence.
- **Driver fit:** Strong on driver 1 by accident; fails drivers 4, 5, 6, 9.
- **Pros:** Zero declared configuration; catches every red job.
- **Cons:** Every red job blocks, including jobs the repository does not require; the refusal names a job the repository never declared as required; the remedy would be to fix unrelated CI or stop merging.
- **Why rejected:** It makes the page the authority and turns unrelated failures into merge blockers — the declared-set contract inverted.

### Alternative 4 — Flip the Reserved `ci-green` Entry's Shipped Surface to `both` and Leave the Required Set to Authoring

- **Eligibility:** Not eligible **as stated** (fails C-5, C-6); folded into ALT-5.
- **Summary:** Change only the shipped surface value (`battery` → `both`) and keep the required-check set sourced exclusively from authored `required-ci-job` entries.
- **Constraint compliance:** Passes C-1…C-4, C-7 and C-8. Fails C-5: the merge projection gains a `ci-green` member for which the merge path has no evaluation, so the entry resolves to `unknown`/`read-failed` and refuses every merge, or (if the entry is skipped) enforces nothing — in neither case do AC-F2-1…AC-F2-3 hold. Fails C-6: a universal refusal is not fail-closed, it is broken; a skipped entry is a silent pass.
- **Driver fit:** Correct on drivers 2, 7; incomplete on 1, 5, 6.
- **Pros:** The smallest possible default change; correct surface value; no admission-rule work.
- **Cons:** Membership without authority. The surface flip is a necessary half of the answer, which is why it is folded into ALT-5 rather than discarded — and why the two halves ship together.
- **Why rejected as a standalone:** It moves the gate into the merge projection without deciding what the gate evaluates.

### Alternative 5 — Selected: Default Membership, the Declared Union of Required Checks, and Admitted Surface Sets

- **Eligibility:** Eligible.
- **Summary:** Ship `ci-green` merge-applicable in the shipped default by declaring it on `both`; derive the merge-applicable required-check set as the union of every merge-applicable `required-ci-job` entry's `job ?? id` and the repository-declared expected job set read through the delivered CI-workflow read; evaluate each name per job on the resolved head through `evaluateRequiredJobGate` with `recorded`/`probe` attribution; refuse fail-closed for every non-green, missing, page-not-head, invalid-set, and read-fault condition; make the authored `ci-green`-on-`battery` declaration the remedy; and turn the reserved built-ins' admitted surface sets into contract data (`ci-green`: `battery` or `both`; the other four: `battery` only) with recipe and class immutable and an omitted class adopting the shipped class.
- **Constraint compliance:** Passes C-1…C-8 (matrix above). Table stakes satisfied. The decision-derived rules below are the consequences it commits to.
- **Driver fit:** Best on net: the default enforces (1), the reserved surface and the delivered evaluator are reused (2, 3), membership and state stay uncrossed (4), every non-green condition refuses by name (5), the remedy is a reviewed declaration (6), the identity is untouched so nothing re-verifies (7), the cost is one local read and one page (8), and the adopter consequence is documented with a visible opt-out (9).
- **Pros:** The defect is removed in the default rather than in each repository; no id, recipe, configuration key, capability, error identity, schema version, or identity change; the battery's evaluation and goldens are untouched because `both` keeps battery membership; one evaluator fed a wider set; every refusal names the gate and the job; an existing authored set stays valid; the opt-out is a configuration diff a reviewer sees.
- **Cons:** Every adopter inherits enforcement on upgrade; a repository with legitimately skipped or conditional jobs must satisfy the gate or opt out; the expected set is read from the checkout's workflow while the verified object is the request head, so a head-only job is not enforced (RSK-3); pending checks add merge latency; the family row now reaches act-requiring causes by default, which constrains its `retryable` and remediation (TDR-0073).
- **Why chosen:** It is the only eligible alternative that removes the vacuity, keeps one authority per axis, preserves the battery surface and the gate-set identity, and gives every refusal a name and a reviewed remedy.

## Decision

- **Decision:** Adopt **ALT-5**.

  1. **DC-1 — The shipped default's fresh merge projection stops being check-vacuous.** The reserved built-in `ci-green` is declared on the `both` surface in the shipped default, so the effective merge projection is exactly two entries — `ci-green` and `tracker-freshness` — in the shipped order. The surface value is `both` and not `merge`: `both` keeps the entry in the battery projection, so `verify gates`, its verdicts, its citations, and its goldens are unchanged (NG-2), while `merge` would silently remove the battery's CI gate. The entry's id, recipe, and class are unchanged, and the entry-id sequence is unchanged, so the gate-set identity is byte-identical. (Spec F-2 first paragraph, DM-3, DEC-3; §4.1 metric 1.)
  2. **DC-2 — One required-check authority, derived once per invocation.** The **merge-applicable required-check set** is the union of two declared sources: (a) every merge-applicable `required-ci-job` entry contributes `job ?? id`; (b) the merge-applicable `ci-green` entry contributes the repository-declared expected job set — the job names the repository's own CI workflow declares, read through the same delivered expected-job read the battery's `ci-green` gate uses. The union is deduplicated by name (a name contributed by both sources is one requirement), and it is derived once per invocation, before evaluation. Any check name outside that union is never gate evidence. (Spec F-2 "The merge-applicable required-check set is derived once per invocation", AC-F2-6.)
  3. **DC-3 — One evaluator, per job, on the resolved head, with the delivered attribution.** Every name in the set is evaluated against the check-run page of the resolved head through the single delivered per-job mapping. A persisted non-pass `ci-green` verdict refuses with `recorded` attribution naming the gate id, the job(s), and the persisted reason; a persisted pass that the fresh page contradicts refuses with `probe`. Those two attributions remain the whole vocabulary, and no second evaluator, scoring, or prose classification exists on any path — the dry run, the live gate sweep, and the post-refusal posture all feed the one mapping. (Spec F-2 "through the single delivered per-job mapping"; §5.1 F-2 attribution paragraph; AC-F2-1, AC-F2-6.)
  4. **DC-4 — Fail closed over the whole outcome space, with a named cause for each.** Each condition refuses on the existing `merge.gate.<gate-id>.failed` family at exit 1, naming the gate id, the offending job name(s) where the condition has a job, and the delivered reason; none passes and none is a skip: a failing, canceled or skipped check (`ci-failed`, `ci-canceled`, `ci-all-skipped`); a queued or running check (`ci-pending` — pending is not green); a required check absent from the page (`ci-missing-jobs`, naming the missing job); a page whose SHA is not the resolved head (the delivered `head-unresolved` reason naming both SHAs); an expected set that cannot be read or is invalid under the delivered validity rule (`ci-expected-jobs-invalid`, naming the gate and the condition); a CI read fault (the declared provider identity naming the failed operation); an unavailable or rejected credential (the declared credential or auth identity naming the reference, the environment variable, and the operation). **A page for another SHA is a refusal, not "no finding"**: the delivered skip on the live query paths is closed for this gate, because a check the merge cannot affirm is not a check the merge may ignore. (Spec §5.1 F-2 outcomes table, AC-F2-1…AC-F2-5, Appendix B; DR-5.)
  5. **DC-5 — Not waivable; the remedy is a reviewed configuration act.** The check gate gains no waiver class, no `--waive` behavior, and no per-invocation override. `--waive` keeps its delivered meaning for gates that carry a class binding. The recorded remedy for a repository whose CI legitimately skips or conditionally runs a job, or whose workflow declares jobs the merge cannot satisfy, is to declare the `ci-green` entry on the `battery` surface — an explicit, reviewed opt-out that removes the gate from the merge projection while keeping the battery evaluation. A failing check is repaired by its owner; a pending check converges by waiting, and the refusal says so rather than pretending the run is retryable. (Spec §5.1 F-2 opt-out paragraph, §22, AC-F3-5, AC-F3-6; DEC-4; NG-6.)
  6. **DC-6 — Admitted surface sets are contract data.** Each reserved built-in gains a declared **admitted surface set**: `ci-green` may be declared on `battery` or `both`; `lifecycle-finalization`, `push-parity`, `owner-gate`, and `squash-preflight` on `battery` only. A declared built-in's **recipe and class may not change**, and an omitted `class` on a built-in adopts the shipped class (so a declared `owner-gate` without `class` resolves to `owner-review` rather than being refused). `ci-green` on `merge` is refused by name, because that value is not in its admitted set and would drop the battery gate. The rule is an **admission** rule, not a removal: every declaration accepted before this decision is still accepted. (Spec §5.1 F-2, DM-3, AC-F2-7, RSK-7.)
  7. **DC-7 — Identity stability, proven rather than asserted.** The effective gate-set identity remains the schema version plus the entry-id sequence; a surface value is not part of it. The shipped default's id sequence and identity string are therefore unchanged by DC-1, no stored verification or transaction record moves schema, no configuration key is added, and no in-flight change is forced to re-verify. (Spec §8.5, §9 NFR-8, §19; AC-F2-7; C-2, C-8.)
  8. **DC-8 — Bounded and read-once.** The authority costs one provider-independent expected-job read plus the one check-run page the merge path already reads for the resolved head. No pagination, retry, waiting, polling, or second workflow read exists; an invalid or unreadable expected set refuses without another read. (Spec §9 NFR-2, NFR-10; C-4.)
  9. **DC-9 — What this record does not decide, and what it refines.** The branch source and the resolved head are TDR-0071's; this record consumes the resolved head and decides nothing about it. The refusal-diagnostics contract, the exact summary and remediation wording, the row-level retryability rule, and every error identity are TDR-0073's: this record adds **no** error row and moves **no** identity count. The change's three declared rows and their arithmetic are TDR-0073's, stated here only so the claim is checkable: the base at `origin/main-tools` @ `e1ebc76c` reads 170 machine / 170 documented / 169 delivered / 68 allowlisted / `BASELINE_ROWS.length + 136`, and the change moves it to 173 / 173 / 172 / 71 / `+ 139`, with the `merge` kind at 12 concrete rows (up from 9) — while this record's own surface change leaves the gate-set identity byte-identical, because `ci-green` is already in the entry-id sequence and only its `surface` value moves. The multi-workflow union is OQ-2 and is not decided here. The battery's own evaluations, output, and goldens are unchanged (NG-2). The numeric expected-job cap and name cap are delivered constants, not decisions of this record. **The spec statements this record refines, for `@pm` to apply:** `doc/spec/features/feature-merge-verify-deploy.md:130-131` (the default set's surface description) and `:172-182` (the probe's declared set, which gains the CI entry's expected set and the page-not-head refusal); the gate-registry conflict list at `:133-136` gains the admitted-surface refusal and class adoption; the merge reference page gains the two-entry default and the surface opt-out; the release note states the default-enforcement consequence. **The change spec's own current-state text needs the same correction:** §2.1's "Recorded CI verdict" paragraph and **P-3** state that "a persisted failing CI verdict can never reach the merge refusal", which the delivered enforced set contradicts (`merge-gate-set.ts:81-86`; `merge-transaction.ts:690-708`); the accurate statement is the one recorded in §Context here — recorded verdict consulted, fresh page never consulted, one fresh merge-applicable gate. This record does not edit the change artifact.

### Decision-Derived Rules (consequences, not gates)

These follow from adopting ALT-5. They are stated so a reviewer can check that the decision was implemented as decided; they are not eligibility tests.

- **DR-1 — One expected-set validity rule, shared.** The merge path applies the delivered validity rule (`read` outcome, non-empty, at or under the cap, non-empty names within the name cap, no duplicates) and shares the predicate with the battery rather than restating it. Two copies would let the same workflow be valid for `verify gates` and invalid for `merge`.
- **DR-2 — Membership is the merge projection, not every declared entry.** A `required-ci-job` entry declared on the `battery` surface alone is a battery declaration and is **not** merge evidence. This narrows the delivered post-refusal posture helper, which today ranges over every declared entry; the narrowing is the declared-set rule applied to the merge surface, and it is what makes C-7 provable.
- **DR-3 — The dry-run CI entry cites both sources.** A `merge --dry-run` record's `ci-green` entry declares the sources it actually read — the repository CI workflow and the check-run page — so a reader can distinguish a merge-surface CI evaluation from a battery one. The record's schema and kind are unchanged, and `verify gates` records stay byte-identical (EVT-1).
- **DR-4 — The evaluated posture is disclosed.** The dry run reports the evaluated required-check count and set size, including an explicit `0` when an authored set declares no required-check entry. An authored check posture must be visible, not silent (DM-2, AC-F2-7).
- **DR-5 — "Not the head" refuses; "not evaluated" is never a pass.** On every path, a page whose SHA is not the resolved head produces a refusal naming both SHAs; the delivered pre-evaluation skip on the live query paths is closed for this gate rather than reproduced. An `unknown` verdict is never treated as satisfied.
- **DR-6 — The union is a set.** Duplicate names collapse; the evaluated count is the deduplicated size; the bounded evidence lists keep their delivered caps and `+N` drop markers, so a repository with many jobs cannot exceed the output bounds.
- **DR-7 — The family row's honesty is load-bearing for the default.** Because the default now reaches act-requiring causes (a failing or missing job), the `merge.gate.<gate-id>.failed` row's `retryable` and remediation must be true of every cause it reaches; a pending-only remediation would be false for the default set. The wording is TDR-0073's; this record requires only that the row not overstate (AC-F3-5, AC-F3-6).

### Constraint Compliance Attestation

ALT-5 satisfies C-1 through C-8. **C-1:** the authority reuses the delivered local CI-workflow read and the delivered check-run page; no provider operation, capability, credential reference, endpoint, or network location is added, and no branch-protection read exists. **C-2:** the gate ids, recipes, surfaces vocabulary, schema version, entry fields, configuration keys, record kinds, and identity construction are unchanged; only the shipped `surface` value of one existing entry moves, which the identity does not encode. **C-3:** every path routes through the one delivered mapping, and the single-evaluator scan plus its planted control stay green and unchanged. **C-4:** one expected-job read and one check-run page per invocation, with zero pagination, retry, waiting, or second workflow read. **C-5:** the binding surface is AC-F2-1…AC-F2-7 and AC-F3-5/AC-F3-6, with the planned cases named in Verification Criteria. **C-6:** every non-green and unreadable condition refuses by name and none is a skip; no waiver class or per-invocation override exists; the remedy is the reviewed `battery` declaration. **C-7:** membership comes from the effective gate set alone and state from the page alone, with a declared job absent from the page refusing and an undeclared job never being evidence. **C-8:** every previously accepted authored set stays accepted, the identity is unchanged, and no stored record or in-flight verification is invalidated. DR-1…DR-7 are accepted as consequences. No accepted-risk exception is claimed against any gate; the accepted risks are recorded separately below.

### Accepted Risks

| Risk | Why accepted | Acceptor | Severity | Revisit trigger |
|---|---|---|---|---|
| Enforcing the repository-declared expected job set blocks merges in repositories with permanently conditional or skipped jobs. | This is the decision: a gate that silently tolerated a skipped required job would be the vacuity being removed. The checked remedy is the authored `battery` surface opt-out, the dry run discloses the evaluated count, and the refusal names the skipped job (RSK-2). | Human owner, GH-366 PR review | Medium | Skipped or conditional jobs become the normal case rather than the exception |
| The expected-job set is read from the checkout's workflow while the verified object is the request head, so a job that exists only on the head is not required evidence. | The delivered read targets one declared local path; reading the head's workflow content is a different capability with its own fidelity questions. The page-versus-expected comparison surfaces the gap as a named missing-job condition, and the docs state that a change-branch checkout gives exact fidelity (RSK-3). | Human owner, GH-366 PR review | Medium | A head-only job is missed in normal operation |
| A repository can opt out of merge-surface CI enforcement by declaring `ci-green` on `battery`. | The alternative is an in-band waiver that lands a failing pipeline silently-by-policy; a configuration declaration is visible in a reviewed diff and is the operator's explicit act (RSK-7). | Human owner, GH-366 PR review | Low | An opt-out appears in a repository that did not intend to weaken its merge gate |
| Blocking on pending checks increases merge latency and may push operators toward unrelated overrides. | Pending is not green; the refusal names the pending job, states that the condition converges without an act, and offers no override (RSK-4). | Human owner, GH-366 PR review | Low | Repeated waiting becomes a reported cost |
| Adopters inherit enforcement on upgrade without having authored anything. | The defect is in the shipped default, so the fix must be too; the release note and the reference page state the consequence and the opt-out, and no stored declaration becomes invalid. | Human owner, GH-366 PR review | Medium | An adopter reports a blocked merge whose only remedy they cannot author |
| `blast_radius` is declared `team` for a decision authored as a TDR. | The tie-breaker would prefer an ADR at `blast_radius >= team`; the caller reserved TDR-0072 and the decision changes no architecture boundary or mechanism. | Human owner, GH-366 PR review — who re-types the record as an ADR if that judgement is rejected | Low | The owner reads the default-enforcement contract as architecture-defining |
| The pre-change reach is established from code reading (the recorded half refuses, the fresh half is absent) rather than from an observed pre-change refusal. | Every cited line was read on 2026-11-20; the reach is a deterministic consequence of the enforced-set predicate, the id skip and the dry-run switch, and AC-F2-1's regression case observes the post-change behaviour directly. The decision does not depend on the pre-change reach — it supplies the fresh half either way. | Human owner, GH-366 PR review | Low | An observed pre-change run shows a fresh failing check refusing, which would mean the fresh half is wider than read here |

### Independent Challenge Status (R3 — pending)

`@decision-critic` has **not** reviewed this record. No `PASS`, `PASS_WITH_RISKS`, or `REWORK` verdict exists, and this record claims none. The challenge, when performed, must verify at least:

1. **That the gap is measured, not asserted.** Against the tree: that the shipped default's fresh merge projection is one entry, that the dry-run loop has no `ci-green` evaluation, that the live sweep skips `ci-green`, and that the pre-change reach is stated exactly — the recorded half **is** reachable and refuses a persisted non-pass `ci-green` for the resolved head, while the fresh page is never consulted for the built-in (recorded 2026-11-20; the critic should re-derive both halves rather than accept them).
2. **That membership and state are actually separated.** That the required set is derived from the effective gate set alone (declared merge-surface entries plus the CI entry's expected set), that the page supplies no membership, that a red undeclared job cannot refuse, and that no third source (a provider protection read, a page heuristic, a name pattern) exists.
3. **That the expected-job read is the delivered one.** Same read, same declared workflow path, same validity predicate shared rather than copied, one read per invocation, no pagination or retry, and the checkout-versus-head fidelity gap stated as a limitation rather than papered over.
4. **That the evaluator is still single.** That the single-evaluator scan is unchanged and green with its failing control, that the dry run, the live sweep and the post-refusal posture all route through `evaluateRequiredJobGate`, and that no prose matching or second ranking appeared.
5. **That fail-closed is total and honest.** Each of failing, pending, canceled, skipped, missing, page-not-head, invalid expected set, read fault, and credential condition refuses by name; none is a skip; the delivered page-not-head skip on the live paths is closed; `retryable` and the remediation are true of every cause the reused family row reaches (AC-F3-5/AC-F3-6), with no unnamed-condition instruction anywhere.
6. **That the admission rule is an admission, not a removal.** `ci-green` on `battery` stays accepted and produces a one-entry merge projection; `both` newly resolves; `merge` alone is refused; the other four are `battery`-only; recipe and class are immutable; an omitted built-in class adopts the shipped class; and no previously accepted authored declaration became invalid.
7. **That the identity claim is arithmetic, not optimism.** That the entry-id sequence and the exact identity string are unchanged by the surface value change, that no schema version, record kind, configuration key, or error identity moved, and that the identity-stability test asserts the exact string rather than a shape.
8. **That the operational consequence is disclosed in the same change.** RSK-2 (skipped/conditional jobs and the surface remedy), RSK-3 (the checkout-versus-head fidelity gap), and the new default are stated in the feature spec, the reference page, the gate-registry defaults, and the release note — and this record claims no count change that belongs to TDR-0073.
9. **That scope held.** That no new gate id, recipe, configuration key, provider operation, credential reference, schema version, error row, waiver class, or battery output change entered under this record's authority, and that the multi-workflow union (OQ-2) and the branch resolution (TDR-0071) were left to their own decisions.
10. **That the assumptions are labelled as assumptions.** That the workflow-declared-names and job-naming-convention assumptions carry their impact-if-false and revisit triggers, and that DR-5/DR-2 are recorded as decision-derived consequences rather than smuggled in as gates.

## Trade-offs & Consequences

### Positive Outcomes

- A merge over a request whose resolved head carries a failing, pending, canceled, skipped or missing required check refuses at exit 1 naming the gate and the job, and a fully green head lands once — a head that is red *now* and a head that is green no longer share a verdict (the change's primary metric: two merge-applicable gates, up from one).
- A repository that authors nothing gets the CI enforcement its own workflow already declares, evaluated on the head it is about to land rather than inherited from the last verification, so the battery and the merge stop disagreeing about what is required in the same repository.
- No new id, recipe, configuration key, schema version, record kind, error identity, or provider capability is introduced, and the gate-set identity is unchanged, so nothing in flight re-verifies and no stored record moves.
- The battery's evaluation, output, and goldens are untouched because `both` keeps battery membership — the surface value was chosen for exactly that property.
- One evaluator is fed a wider input rather than duplicated, so the battery and the merge cannot disagree about a job's state.
- The override is a reviewed configuration declaration that removes the gate visibly, instead of a waiver that lands a failing pipeline silently-by-policy.
- The dry run discloses the evaluated required-check count, so an authored check posture is visible before the run rather than inferred after a refusal.
- Every refusal names a gate and, where one exists, a job, so a blocked merge has an obvious owner and an obvious repair.

### Negative Outcomes

- **Every adopter inherits enforcement on upgrade.** The default is the contract, and a repository whose CI legitimately skips jobs now blocks by default until it declares the opt-out.
- **Conditional and path-filtered jobs become a configuration decision.** A job that runs only for some changes is `skipped` for the others, and skipped refuses; the repository must either restructure its workflow or opt out of merge-surface CI enforcement entirely.
- **The expected set and the verified object can describe different trees.** A job declared only on the request head is not in the checkout's workflow, so it is not required evidence until the checkout contains it (RSK-3); the refusal surfaces the gap, it does not close it.
- **Pending checks add merge latency.** Waiting is the only convergence path, and there is no override.
- **A head-only or renamed job can produce a truthful but surprising refusal.** The message names a job the operator may not see in the checkout they are running from.
- **The reused family row now reaches act-requiring causes by default.** If its `retryable` or remediation were written for the pending case alone, the default set would make that wording false — which is why TDR-0073's rule is load-bearing here.
- **An opt-out is a real loss of enforcement.** A repository that declares `battery` keeps its previous behaviour: the merge enforces only the persisted verdict, so a head that turns red after verification can still merge.

### Unresolved Questions

- [x] Which half of the CI enforcement was reachable under the shipped default before this change? **Resolved 2026-11-20 against `e1ebc76c`:** the recorded half is delivered and reachable — a persisted non-pass `ci-green` for the resolved head refuses — and the fresh half is absent — the live sweep skips the built-in and the dry run yields `unknown`/`read-failed`, so the fresh merge projection is one gate. The decision is unchanged; §Context and driver 1 now state the fresh-evaluation gap. (owner: `@decision-advisor`, recorded in the amendments table)
- [x] Does the merge path share the composition's already-read workflow facts, or read the expected set itself? **Resolved at plan time (2026-11-20), read budget restated at DoR iteration 3 (2026-11-20):** the composition supplies the expected-job set from the already-delivered CI-workflow read, wired once at composition time, and the dry-run path consumes that fact rather than re-reading it, so the **required-check path adds no provider read of its own**. The run's provider budget is at most two reads — the bounded open-list read on the resolution path plus at most one bounded closed-list read on the convergence path — and the closed-list read is the convergence path's, which this record's required-check authority neither performs nor depends on. (PM ruling, GH-366 DoR iteration 3; `packages/adapters/src/github/client.ts:462-475,478-499`; `chg-GH-366-plan.yaml` phase 4; recorded in the amendments table)
- [ ] Is `ci-expected-jobs-invalid` the right identity for the merge path's invalid-expected-set refusal, given that it is a battery-declared reason today? This record requires the refusal to reuse the delivered reason and name the gate; whether the merge family carries it as the reason or a new reason is a diagnostics question for TDR-0073. (owner: `@decision-advisor` in TDR-0073, or the human owner at the GH-366 PR review)
- [ ] Should a conditionally-skipped job be modelled as not-required rather than as not-green? This record answers "skipped refuses" and points the repository at the gate-level opt-out; a job-level admission rule is a different decision. (owner: `@decision-advisor` when the revisit trigger fires)
- [ ] Is the multi-workflow expected-job union wanted (OQ-2)? This record reads the one declared workflow path. (owner: `@decision-advisor` in the OQ-2 decision)

## Implementation Plan

1. **Default membership.** Declare the built-in `ci-green` entry on the `both` surface in the shipped default set, keeping the shipped order and every other entry unchanged. Add a contract assertion that the shipped default's fresh merge projection is exactly `ci-green` and `tracker-freshness`, that its battery projection still contains all five built-ins, and that its identity string is unchanged.
2. **Admission rule.** Replace the exact `sameEntry` comparison for built-ins with the declared admission rule: recipe must equal the shipped recipe; a declared `class` must equal the shipped class and an omitted class adopts it; the `surface` must lie in the built-in's declared admitted set (`ci-green`: `battery` or `both`; the other four: `battery`). Publish the admitted sets as contract data beside the built-in ids, and refuse any other surface by name.
3. **Required-set derivation.** Implement one derivation that unions the merge-applicable `required-ci-job` entries' `job ?? id` with the merge-applicable `ci-green` entry's expected job set, deduplicated, and use it on the live gate sweep, the post-refusal posture, and the dry run. Do not widen the delivered post-refusal helper's range beyond the merge projection (DR-2).
4. **Merge-surface CI evaluation.** Add the `ci-green` recipe's evaluation to the dry-run loop and the live gate sweep: evaluate every name through the one mapping, honour the persisted verdict with `recorded` attribution and the page with `probe`, and produce the `merge.gate.ci-green.failed` family instance with the delivered reason and the job name(s). The dry-run entry's citation declares the workflow and page sources (DR-3), and the dry run discloses the evaluated count (DR-4).
5. **Fail-closed outcomes.** Map every condition in DC-4 to its refusal, including page-not-head as a refusal naming both SHAs on the live paths (DR-5), and an invalid/unreadable expected set as `ci-expected-jobs-invalid` naming the gate and the condition without an extra read. Keep zero landing calls on every refusal.
6. **Budget and wiring.** Supply the expected-job fact once per invocation from the composition's local read; assert the read budget and the zero-retry/zero-pagination properties in the suite.
7. **Documentation and handoff.** Reconcile the merge feature spec's gate-registry defaults and probe description, the merge reference page (two-entry default, surface opt-out, refusal examples, exit-status causes), and the release note. Hand the DC-9 statements to `@pm`, and the family-row wording question to TDR-0073's author.

**Plan-pinned implementation obligations** (deliberately not decided here; each carries its pinning test):

1. Where the admitted-surface sets and the class-adoption rule live in the contract module, and the exact refusal detail text — test `admitted-surfaces`: the accepted and refused cells per built-in, plus the omitted-class case.
2. The exact merge-path citation shape for the dry-run `ci-green` entry (counts and name lists) within the delivered bounds — test `merge-ci-citation`: both sources named, counts bounded, battery records byte-identical.
3. Whether the expected-job fact is a transaction input or a composition-supplied port — test `read-budget`: one expected-job read per invocation on every path, including the refusal paths.

## Rollback / Reversal

- **Revert steps:** revert the delivery commit(s) as a unit. Restoring the shipped `ci-green` entry's `surface` to `battery` restores the previous default in one constant, and the prior admission rule (exact match) accepts every set the new one accepts except `ci-green` on `both`, so a repository that adopted `both` must return to `battery` when the rule reverts — the release note states this pair. No stored state migrates in either direction: no schema version, record kind, registry key, or configuration key changes, and the identity string is unchanged, so existing verification and transaction records stay readable and valid under both the reverted and the delivered default.
- **Stop conditions that trigger rollback:** (a) a repository that legitimately skips a conditionally-run job cannot express its workflow in a way the gate accepts and the gate-level opt-out is unacceptable to the owner; (b) the expected-job names the workflow declares do not match the provider's check names for the supported flow, so every expected job reads as missing and the gate refuses universally; (c) a delivery leaves the **mixed state** — the default membership moved without the required-set derivation, so the merge projection gains a gate that every merge resolves to `unknown`/`read-failed` (a universal refusal), or the derivation landed without the membership (the merge projection still one gate while the docs claim enforcement). Case (c) is the serious one and is forbidden: the two halves ship together or not at all.
- **Irrecoverable state:** a landing that has fired is provider truth and cannot be un-landed by a local revert; the guard against landing a request with a red required check is the refusal, not a rollback. Verification records appended under the new default remain readable after a revert because their identity is unchanged; nothing depends on deleting them.

## Communication Plan

- **Audiences (map to `governance.informed`):** in-flight change owners; coordinators and operators who run `merge`; repositories with skipped/conditional jobs or CI outside the targeted workflow file; adopters of the installed tooling; the TDR-0071/TDR-0073 owners; the OQ-2 follow-on owner; `@pr-manager`.
- **Message (one line):** "By default, `merge` now enforces the job set your own CI workflow declares, evaluated per job on the request head — a failing, pending, canceled, skipped or missing required check refuses by name; a repository that needs the old behaviour declares `ci-green` on the `battery` surface."
- **Channel:** GH-366 PR body (scope held and scope not claimed); the release note (adopters and the default change); the merge feature spec and reference page (behaviour, refusals, the surface opt-out); the gate-registry defaults (the admitted surface sets); the dry-run and merged report data (the evaluated required-check count).
- **Timing:** pre-rollout for the default change, the opt-out, and the RSK-2/RSK-3 limitations (documentation and the change's own records); at rollout with the delivery; post-rollout for the first reports from repositories whose CI legitimately skips jobs, which is the operational cost this decision accepts.

## Verification Criteria

| Criterion | What proves it | Bound |
|---|---|---|
| AC-F2-1 — one failing required check refuses naming the check, the gate and the reason, with zero landing calls | TC-MRG-010 over the shipped default set with a workflow-declared expected job; the case proves the fresh evaluation that was missing (the pre-change reach is recorded as FACT in §Context) | DC-1, DC-3, DC-4 |
| AC-F2-2 — one queued or running required check refuses with the pending reason | TC-MRG-012 (extended) plus TC-MRG-027 for the pending remediation | DC-4, DR-7 |
| AC-F2-3 — an all-green dry run verifies and the merge lands once, so green and failing never share a verdict | TC-MRG-011 over the default set; the pair of cases (red refuses, green lands) is the metric's proof | DC-1, DC-3 |
| AC-F2-4 — a page for another SHA is never head evidence and never a pass | TC-MRG-013 extended to the widened set: refusal naming both SHAs on the live path, not a skip | DC-4, DR-5 |
| AC-F2-5 — a CI read fault refuses with the declared provider identity naming the operation | TC-MRG-014 | DC-4 |
| AC-F2-6 — a declared job is enforced while an undeclared, non-expected job is not evidence | TC-MRG-015: a red undeclared job produces no refusal; a declared job is enforced | DC-2, C-7, DR-2 |
| AC-F2-7 — built-ins reserved and mandatory, recipe/class immutable, omitted class adopts the shipped class, `ci-green` admitted on `battery`/`both` | TC-MRG-016 and TC-MRG-017: the admission matrix, the class-adoption cell, the two-entry default projection, the one-entry opt-out, and the unchanged identity | DC-6, DC-1, DC-7 |
| Invalid or unreadable expected set refuses and never passes | TC-MRG-018's five cells: unreadable, empty, malformed, duplicated, over cap — each refuses with `ci-expected-jobs-invalid` and zero landing calls | DC-4, DR-1 |
| The dry run discloses the evaluated required-check posture | TC-MRG-019: three expected jobs report a count of 3; an authored set with no required-check entry reports `0` explicitly | DR-4 |
| AC-F3-5 / AC-F3-6 — `retryable` is the row's declared value; no row overstates convergence; no unnamed-condition remediation | TC-MRG-025, TC-MRG-027, TC-MRG-028 over the widened family population, including the skipped and missing causes the default now reaches | DR-7 |
| One evaluator, unchanged | `tests/checks/merge-check-path-scan.test.ts` green and unmodified, including its planted-second-evaluator failing control | C-3 |
| Bounded reads | Per-invocation read counts on the all-green, failing, pending, skipped, missing, page-not-head and invalid-set paths: one expected-job read, one check-run page, zero retries, zero pagination | C-4, DC-8 |
| Identity stability | The exact identity string before and after; the id sequence; no record/schema/key delta; every delivered authored-set fixture still resolves | C-2, C-8, DC-7 |
| No invalidation | Existing verification-record fixtures remain consumable and a `ci-green`-on-`battery` declaration yields a one-entry merge projection | C-8 |

**Metrics (this decision's share of spec §4.1):** merge-applicable gates under the shipped default — 2 (CI gate + tracker gate), up from 1; named-checks refusals — 100 % of failing, pending, canceled and skipped required checks refuse at exit 1 with the check name in evidence; in-flight changes forced to re-verify because of this change — 0.

**Review date proposal:** the first retrospective after implementation, once GH-366 has landed and at least one further change has merged through the new default; then a longer horizon (roughly 90 days) to judge whether the default enforcement was absorbed or is being opted out of wholesale. `review_date` stays `null` until the owner accepts the record, per the record lifecycle.

## Confidence Rating

**Medium-High.** Every cited fact was re-read in the delivered tree at `e1ebc76c` on 2026-11-20 — the shipped default set, the surface projections, the enforced-set predicate and the built-in admission rule, the dry-run loop and its recipe fallback, the live sweep, its `ci-green` skip and the recorded-verdict refusal, the required-set helper and the posture helper, the freshness envelope, the single mapping and its scan, the battery's CI gate and its validity predicate, the identity construction, and the error-register arithmetic — so the current-state account is direct evidence rather than inference. The open weaknesses are two: the expected-job-names-must-match-check-names assumption was not sampled against a live provider, and the R3 independent challenge has not happened. The pre-change reach is no longer an open question; it is recorded as FACT above. AI-generated confidence is not evidence; the rating states the analyst's read, not a verdict.

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

- **Default set, one failing declared job.** A repository authors nothing. Its workflow declares `CI / test`. `merge GH-366` resolves the request head, reads the workflow's expected set (`CI / test`), reads the check-run page for that head, and finds `CI / test` failed: it refuses `merge.gate.ci-green.failed` at exit 1 naming the gate, `CI / test`, `ci-failed`, and `probe`, with zero landing calls. The repair is the job's owner; the alternative is declaring `ci-green` on `battery`.
- **Default set, every expected job green.** The same repository, a green page, a fresh tracker gate: the dry run reports `verified` with the CI entry counting the evaluated jobs, and `merge GH-366` lands once at the resolved head.
- **Deliberate opt-out.** A repository whose workflow runs integration jobs only on certain paths declares `merge.gates` with `ci-green` on `battery` and every other built-in on its shipped surface. The battery keeps evaluating its CI gate; the merge projection is `tracker-freshness` alone, and the dry run discloses an evaluated required-check count of 0, so the posture is visible rather than silent.
- **A page for another SHA.** The check-run read returns a page for a commit that is not the resolved head. The merge refuses naming both SHAs rather than proceeding on the assumption that nothing was wrong.
- **An undeclared red job.** The page also carries an unrelated advisory job that failed. It is not in the union, so it produces no refusal and the refusal names only the declared cause (AC-F2-6).
- **A malformed workflow.** The workflow's job set cannot be read or contains duplicate names. The merge refuses `ci-expected-jobs-invalid` naming the gate and the condition, with no landing call and no fallback to the authored entries alone.

## Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-11-20 | §Context's defect narrative, the problem framing, driver 1, three evidence rows (one `TO-CONFIRM` promoted to `FACT`), DC-1's heading, DC-9's arithmetic sentence, the accepted-risk row on pre-change reach, the resolved question, the confidence rating, and challenge item 1 now state the pre-change reach as it is at `e1ebc76c`: the persisted-verdict half is **delivered and reachable** (a non-pass `ci-green` recorded for the resolved head refuses), and the missing half is **fresh evaluation** (the live sweep skips the built-in and the dry run yields `unknown`/`read-failed`), so the fresh merge projection is one gate. The withdrawn claims are "a persisted failing `ci-green` verdict can never reach the merge refusal" and "no check run can influence a merge verdict". | GH-366 DoR gate: the record carried a factual error a critic would reject. Verified against the tree at `e1ebc76c` — `merge-gate-set.ts:46-52,81-86` (every built-in enters `enforcedMergeEntries` regardless of surface), `merge-transaction.ts:569-590` (the envelope binds the record to the head), `:690-708` (a recorded non-pass refuses), `:755-757` (the sweep skips `ci-green`), `:1220-1268` (the dry run's fall-through). |
| 2026-11-20 | Recorded the change's error-register arithmetic in §Context and DC-9: base 170 machine / 170 documented / 169 delivered / 68 allowlisted / `BASELINE_ROWS.length + 136` at `e1ebc76c`, moving to 173 / 173 / 172 / 71 / `+ 139` with the `merge` kind at 12 concrete rows (up from 9), gate-set identity unchanged. | The consequences depend on the arithmetic; the record claims it adds no row and moves no identity, so the change's three rows must be attributed to TDR-0073 explicitly and the gate-set identity separated from the error-register counts. |
| 2026-11-20 | DC-9 gained a correction handoff: the change spec's §2.1 "Recorded CI verdict" paragraph and P-3 carry the same withdrawn characterisation and need `@spec-writer` / `@pm` to restate them. | The record already routes spec statements it refines to `@pm`; leaving the change artifact asserting the opposite of the tree would keep the contradiction the amendment removes. No other file was edited by this amendment. |
| 2026-11-20 | The expected-set-read row of **§Evidence, Assumptions & Unknowns** is promoted `TO-CONFIRM` → `FACT`, its `@coder` plan-time ownership is removed, and the matching open question is closed as resolved: per invocation the merge path spends **one** provider read (the bounded open-request list read, which also supplies the request detail) plus the bounded local reads (at most three change-record reads), and the merge-applicable expected-job set is supplied by the composition from the already-delivered CI-workflow read, wired **once** at composition time — the dry-run path consumes that fact rather than reading it again, so the merge path adds **no second provider read** and DC-8's cost is unchanged. Re-confirmed in the same amendment, with no other change: the error-register arithmetic remains **173 / 173 / 172 / 71 / `+ 139`** with the `merge` kind at **12** concrete rows, and the change's AC inventory this record is written against is **25** ids (24 plus `AC-F1-6`, which belongs to F-1 and adds **no** obligation to this record's binding surface, AC-F2-1…AC-F2-7 and AC-F3-5/AC-F3-6). | GH-366 DoR gate (readiness iter-2): the Unknowns table still carried a plan-time `TO-CONFIRM` after the plan's phase 4 settled the wiring. Verified against spec §9 NFR-2/NFR-10 (one provider read; bounded local change-record reads; no added polling or waiting) and `chg-GH-366-plan.yaml` phase 4 (the one-per-invocation required-set derivation, the composition's CI-workflow expected-job read wiring, the read-budget close, and TC-MRG-034's exact per-invocation read multiset). No decision, constraint, admitted surface, risk, challenge claim, or acceptance state changed. |
| 2026-11-20 | The expected-set-read row of **§Evidence, Assumptions & Unknowns** and its matching closed question are restated on the run's **two-read** provider budget: one bounded open-list read on the resolution path, plus at most one bounded closed-list read on the convergence path (no pagination, no retry, no fetch), with merged matches filtered by the declared branch convention, the merged-match count observed as `0`, `1` or `2+`, and `2+` refused (`merge.request-unresolved` / `ambiguous-merged-request`) rather than ranked. The **required-check path** still adds **no provider read of its own** — the expected-job set comes from the composition's already-delivered CI-workflow read, wired once — and the only additional provider read on the merge path is the convergence path's closed-list read, which this record's required-check authority neither performs nor depends on. This supersedes the read-budget premise of the 2026-11-20 amendment immediately above; that row stands as the record of what was asserted then. | GH-366 DoR iteration 3, critical finding 1: the delivered surface cannot obtain merged requests from the open list — `listDeliveryRequests` is `?state=open` (`packages/adapters/src/github/client.ts:462-475`) and merged truth is a separate `?state=closed` read (`findMergedDeliveryRequest`, `:478-499`) — so the one-read premise the row was promoted on was false for the convergence path. The PM's ruling sets the two-read budget (`chg-GH-366-pm-notes.yaml` notes, 2026-11-20). Re-confirmed in the same amendment, with no other change: the error-register arithmetic remains **173 / 173 / 172 / 71 / `+ 139`** with the `merge` kind at **12** concrete rows; the change's AC inventory remains **25** ids (24 plus `AC-F1-6`); and the decision, constraints C-1…C-8, admitted surface sets, accepted risks, challenge status and acceptance state are unchanged. The spec's §9 NFR-2/NFR-10 and AC-F1-6 read statements carry the same restatement in the same remediation (owner: `@spec-writer` / `@pm`); this amendment edits no other file. |

**Necessity after the correction (stated, not inferred).** The decision, its constraints (C-1…C-8), and the accepted-risk set are unchanged — one risk row is re-worded to the residual risk that remains true, and no new risk is introduced. The necessity is **narrowed, not altered**: the load-bearing gap is fresh evaluation of the required checks on the resolved head plus the merge projection's membership, because the persisted-verdict half already refuses a recorded non-pass. Every constraint that screened the alternatives still does: AC-F2-1…AC-F2-3 are phrased over the merge-applicable set, AC-F2-4 requires the fresh page-not-head refusal, AC-F2-6 requires the declared union to bound what is fresh evidence, and §4.1 requires two merge-applicable gates. ALT-4 remains ineligible for the same reason it was: a surface flip alone yields `unknown`/`read-failed` on the dry run and a skipped, never-evaluated entry on the live sweep.

## References

- Change specification: `doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-spec.md` (§2.1, §5.1 F-2, §8.3 DM-3, §8.4, §8.5, §9 NFR-2/NFR-4/NFR-10, §11 RSK-2/RSK-3/RSK-7, §15 DEC-3/DEC-4/DEC-9, §17.2, §17.3, §19, §22, §24-B/C).
- Change test plan: `doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-test-plan.md` (TC-MRG-010…TC-MRG-019, TC-MRG-025/027/028).
- Change plan: `doc/changes/2026-11/2026-11-20--GH-366--merge-command-conformance/chg-GH-366-plan.yaml` (phase 1 pins this record's path and its index row).
- System specs: [Merge and Verify-Deploy](../spec/features/feature-merge-verify-deploy.md) · [Verify Gates](../spec/features/feature-verify-gates.md).
- Delivered contracts and domain: `packages/core/src/contracts/merge.ts` · `packages/core/src/domain/merge-gate-set.ts` · `packages/core/src/domain/merge-transaction.ts` · `packages/core/src/domain/merge-probe.ts` · `packages/core/src/domain/verify-gates.ts` · `tests/checks/merge-check-path-scan.test.ts`.
- Related decisions: [ADR-0012 — Provider-side landing path](ADR-0012-provider-side-merge-landing-path.md) · [TDR-0031 — Engine-first evaluation surfaces](TDR-0031-engine-first-evaluation-surfaces.md) · [TDR-0071 — Change-branch resolution and the resolved head](TDR-0071-merge-change-branch-and-resolved-head-authority.md) · TDR-0073 (refusal diagnostics and emitted-identity totality, reserved).
- Change process: [Decision-Making Guide](../guides/decision-making.md) · [Decision Records Management](../guides/decision-records-management.md).
