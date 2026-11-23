---
id: TDR-0076
decision_type: tdr
status: Proposed
created: 2026-11-23
decision_date: null
last_updated: 2026-11-23
summary: "GH-386 DEC-1: the dispatch engine performs one bounded, fast-forward-only ensure-push of the change branch to its configured upstream before it classifies `pr-open`, reusing the verify gates parity definition — the local checkout head SHA compared for equality against the open delivery request's head SHA, both full-hex. The act runs on the delivered adapters-layer child-runner pattern (fixed argv, literal non-shell child, 60 000 ms injectable timeout, single attempt, no force variant, change branch's upstream only) and is the typed stack's first remote-write operation: every existing git mutation seam is declared local-only, no-network, no-remotes, so this record authorizes the engine's first write that leaves the checkout. A rejected, failing, timed-out, or still-unmet push is a typed non-`pr-open` failure through one new row in the pinned failure-token mapping (`failed` / `failed` / exit 1, comparison reason `push-parity-unmet`, PR URL retained); parity evidence rides the bounded `push:<verdict>` reference family and an additive optional machine-envelope block; text mode stays byte-identical. Session-side push convention, the commit primitive's never-push rule, the closed vocabularies, the corroboration map, and the shell fallback's behavior are unchanged, and the parked git-operations-centralization work is explicitly not a dependency."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os dispatch engine: `pr-open` derivation and git write seams"
decision_scope: repo
review_date: null
business_impact: "A delivered lane can no longer close `pr-open` with the lifecycle's evidence commit existing only locally: the merged artifact carries the delivered change's own evidence, CI validates the head that actually merges, and no delivery pays a second CI cycle for a late manual push. The cost is one bounded push plus one parity read on the classifications that need it, and one new honest failure mode (a rejected push) that resolves by the next dispatch or an operator resume."
customer_impact: "An operator reading the attempts digest sees the parity outcome per attempt (`push:clean`, `push:pushed`, `push:failed`) with both compared heads in the machine envelope, and a push rejection is a typed `failed` result that keeps the PR URL instead of a silent divergence detectable only by manual head comparison."
classification:
  domains: [dispatch, delivery-lifecycle, git-seams, security, operations]
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
  driver: "@decision-advisor (GH-386 DEC-1: the companion record mandated by the change specification for the precedent-setting engine write-I/O extension)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-386 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-386 clarify-scope and the intake cross-check)"
    - "@spec-writer (GH-386 DEC-1, F-1/F-2/F-3, NFR-1..NFR-5, RSK-1/RSK-2, §21, and Appendix A — the code-truth basis)"
    - "@decision-advisor (repository analysis, option analysis, and this record)"
  reviewers:
    - "@reviewer"
    - "Human owner (GH-386 PR review — this record authorizes the engine's first remote-write act)"
  performers:
    - "@coder (implement the ensure-push seam and the derivation arm 8 parity precondition)"
    - "@test-plan-writer (the parity-before-`pr-open`, rejected-push, and defect-pin fixture arms)"
    - "@doc-syncer (phase-7 reconciliation of the dispatch-engine, quality-gates, verify-gates, and autonomous-delivery pages and the engine-first operations guide)"
  informed:
    - "Operators of native deliveries reading the attempts digest and the machine envelope"
    - "Future authors proposing additional engine write seams"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, option-generator, critic, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A second remote-write seam is proposed for the engine (a merge, a tag, a release publication). This record's pattern — bounded, fast-forward-only, single-attempt, change-branch-scoped, typed failure, declared divergence — is the baseline every new write seam is measured against; a less-bounded seam reopens this record rather than inheriting it."
  - "The parked git-operations-centralization work unpauses. If it lands, the push seam either migrates to the centralized git family or this record records why it did not; the seam must not fork the engine's git surface in two directions."
  - "The 60 000 ms timeout budget or the single-attempt rule proves wrong in practice (chronically slow pushes, or repeated failure-looping across dispatches). Both bounds are deliberate design, not accidents; changing either reopens this record."
  - "A lane's remote history is rewritten underneath it, so a fast-forward push is rejected by design. If operators then need more than the typed failure and re-dispatch, that is a new decision — this act never grows a force variant."
  - "Pull-request URL resolution improves enough to give `pr-open-unverified` a head fact. Extending the parity precondition to that token reopens the change specification's DEC-5 and this record's boundary together."
links:
  related_changes: ["GH-386"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-23--GH-386--push-pr-evidence-before-pr-open/chg-GH-386-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-verify-gates.md"
    - "doc/spec/features/feature-quality-gates-and-pr.md"
    - "doc/spec/features/feature-autonomous-delivery.md"
    - "doc/guides/engine-first-operations.md"
  contracts: []
  diagrams: []
  decisions: ["TDR-0005", "TDR-0053", "TDR-0071", "TDR-0019"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S23"]
---

# TDR-0076: The Engine-Side Ensure-Push Is the Dispatch Engine's First Remote-Write Act — One Bounded Fast-Forward Push Before `pr-open` Derives

## Context

- **FACT:** The dispatch engine derives `pr-open` from pull-request truth alone. The total derivation ladder reaches arm 8 on an open pull request with a resolved URL, and nothing in that arm compares the local branch head against the pull request's head or performs any push: no push act exists anywhere in the engine (`doc/spec/features/feature-dispatch-engine.md`; the GH-386 change specification §2.1 and Appendix A).
- **FACT:** The push of delivery commits is session-side convention. In the lifecycle's `pr_creation` slice, the PR-creation workflow's retained git writes are exactly the push and PR creation; the commit primitive never pushes; nothing in the typed lane verifies that the push happened (GH-386 spec §2.1, Appendix A).
- **FACT:** The current path demonstrably permits both outcomes. The unpushed-evidence commit at `pr-open` was observed on two consecutive native deliveries and did not reproduce on a third (ticket GH-386; GH-386 spec §1). The delivered artifact and the merged artifact then differ by exactly the evidence the lifecycle promises, and the later manual push invalidates CI on the pull request's head, costing every affected delivery a second CI cycle.
- **FACT:** The repository already owns the parity property this decision needs. The verify gates `push-parity` gate compares the checkout's local head SHA against the open delivery request's head SHA, requiring equal full-hex SHAs, computed from bounded local reads and the provider's delivery-request detail (GH-386 spec §2.1; `doc/spec/features/feature-verify-gates.md`). TDR-0071 fixes the delivery request's head as the verified head authority for the lane.
- **FACT:** The adapters layer owns bounded git child-process seams with fixed argv, injected runners, and declared timeouts — bounded reads, the commit primitive, and the merge transaction's local act set, which is declared no-network and no-remotes. No remote-write operation exists anywhere in the typed stack (GH-386 spec §2.1 and Appendix A). The engine-side push is therefore genuinely new write I/O: feasible on the delivered child-runner pattern, and precedent-setting.
- **FACT:** Dispatch has no merge port and no merge code path; a push is not a merge, so the act contradicts nothing — but it is declared and decided as its own extension, not smuggled through a merge concept (GH-386 spec Appendix A).
- **FACT:** The work on centralizing git operations is parked and is not a dependency of this change; the delivered child-runner pattern is sufficient as it stands (GH-386 spec §2.1, NG-6).
- **Why now:** GH-386 is the defect fix for the unpushed-evidence commit, and its specification (DEC-1) mandates this record through `@decision-advisor` because the mechanism it selects is a precedent-setting write-I/O extension for the dispatch engine. The choice of mechanism is a technical decision about the engine's write posture — record type TDR.

## Problem Framing (Clarified)

The question is not "should the lifecycle push the evidence commit?" — it already says it does, as session-side convention, and that convention stays. The question is narrower:

> When the typed engine is about to classify a delivery `pr-open`, what makes that token's parity claim true — and which component is allowed to make it true?

First principles: `pr-open` is a claim. It says a delivered lane's work sits on an open pull request. A delivery whose final evidence commit — the `pr_creation` completion and the PR URL — exists only locally makes that claim false in exactly the dimension the lifecycle cares about: the artifact a human reviews and merges is missing the record of its own delivery. A token that can derive while its claim is false is misreporting, so the claim must become a precondition of the token rather than an expectation of a different layer.

Three sub-questions decide the mechanism:

1. **Which layer enforces the claim?** The demonstrated failure lives in the conformance layer: a session-side convention that two deliveries ignored and one honored. Enforcement placed in the same layer inherits the same failure mode. The layer that cannot conformance-fail is the derivation itself — deterministic code with a total order and a closed vocabulary.
2. **What may the enforcement do?** It may reconcile: perform the missing push itself, bounded and fast-forward-only, when the local head is ahead. Detection without reconciliation converts the defect into a standing operator tax; reconciliation without bounds converts a verification engine into an unbounded remote writer.
3. **What must not move?** The closed eleven-token vocabulary, the pinned failure-token mapping's shape, the corroboration requirement map, the attempt-record schema, the commit primitive's never-push rule, the session-side conventions, the shell fallback's behavior, and the no-merge posture of dispatch. The act is scoped so that all of these hold.

The decision, then: the engine reconciles parity at the derivation and records the parity facts as evidence; a push it cannot reconcile is a typed failure that keeps the PR URL; and the first remote-write seam enters the stack as a declared, bounded, reviewed pattern rather than an accident.

## Constraints (Hard Requirements)

### C-1: `pr-open` is parity-backed by construction

- **Statement:** Before the `pr-open` token derives, the change branch's local head equals the pull request's head (full-hex equality, the verify gates parity definition); a local-ahead state is reconciled by the classification path itself — one bounded push and a parity re-read — never by operator remediation, and a divergent `pr-open` classification is impossible by construction and pinned by fixture as a defect definition.
- **Source:** AC (ticket GH-386 behaviours 1 and 4; GH-386 G-1, G-4, AC-F1-1, AC-F1-2)
- **Verification:** test (parity-before-`pr-open` fixture; the divergent-`pr-open` defect pin)
- **Negotiable:** no

### C-2: Enforcement is structural, not behavioral

- **Statement:** The push of the final commit(s) before the `pr-open` classification is performed by the engine as code; enforcement must not depend on prompt or session conformance, because the demonstrated defect is exactly a session-side conformance gap (observed twice, absent once) — a mechanism that relies on the convention being followed re-creates the defect one layer over.
- **Source:** AC (GH-386 F-1 rationale, ticket behaviour 1); prior decision (GH-386 spec DEC-1 basis)
- **Verification:** code review (the act lives in the engine flow, not in any prompt) + test
- **Negotiable:** no

### C-3: The act is bounded and single-attempt

- **Statement:** At most one push per classification with no retry ladder; fixed argv with a literal non-shell child process; bounded child timeout of 60 000 ms, injectable, with no new configuration key; the added classification cost is at most one extra bounded parity read plus the push budget — no new provider read class.
- **Source:** AC (GH-386 NFR-1, NFR-2)
- **Verification:** test (single-act assertion under injected runner; timeout behavior; no-retry assertion across classifications)
- **Negotiable:** no

### C-4: The remote write is force-free and change-branch-scoped

- **Statement:** The push is fast-forward-only, targets only the change branch's configured upstream remote, and never the base branch or any other ref; no force-capable variant exists in the seam; the existing merge-transaction seam's local-only declaration is unchanged.
- **Source:** AC (GH-386 NG-5, §21 security highlights)
- **Verification:** test (refspec and argument assertion; force-variant absence) + code review
- **Negotiable:** no

### C-5: Closed vocabularies and stable output surfaces

- **Statement:** No new result token, error identity, error-table row, domain kind, derivation arm, or attempt-record field; the push failure maps through exactly one new row in the pinned failure-token mapping; parity evidence rides the bounded evidence-reference budget, reserved ahead of the slice, and the additive optional machine-envelope block within the delivered bounds; text mode stays the byte-identical four-key contract.
- **Source:** AC (GH-386 NG-2, NG-7, DM-1..DM-3, NFR-4, NFR-5)
- **Verification:** test (set-equality inventory over each closed set; four-key text golden; envelope bounding)
- **Negotiable:** no

### C-6: No merge capability and no new credential boundary

- **Statement:** The act is not a merge — dispatch keeps no merge port and no merge code path, and a merge-ready pull request stays `pr-open` for the coordinator; the engine resolves, reads, and stores no credential beyond the checkout's ambient git credential chain that session-side pushes already use.
- **Source:** AC (GH-386 NG-1, §8.4, §21); prior decision (the delivered dispatch posture)
- **Verification:** code review (no merge path; no credential handling) + test
- **Negotiable:** no

### C-7: Independent of parked work

- **Statement:** The act has no dependency on the parked git-operations-centralization work; the push seam extends the delivered adapters-layer child-runner pattern as it stands, and the delivered verify-gates parity computation is reused rather than reinvented.
- **Source:** AC (GH-386 NG-6); prior decision (TDR-0071 head authority; the delivered verify-gates parity definition)
- **Verification:** code review (the seam composes the delivered child-runner pattern only)
- **Negotiable:** no

> **Table stakes:** the delivered provider delivery-request read remains the remote-head fact source, the ambient credential chain remains the only credential path, the corroboration requirement map stays closed with `pr-open` still requiring the tracker source only, the shell fallback keeps its delivered behavior with the divergence declared rather than silent, and the undecidable-parity-read case resolves `state-unverified` — never a false success. Every alternative below already satisfies these; they are acknowledged, not re-scored.

## Decision Drivers

**Technical drivers (ranked):**

1. **Determinism** — classification is a total derivation over a closed vocabulary; the parity claim must be a precondition of the token, evaluated by code, not an expectation of a different layer.
2. **Fail-loud truthfulness** — an unmet push is a typed failure that retains the PR URL and names the cause class; a false `pr-open` success is the one forbidden outcome.
3. **Reuse of delivered seams** — the adapters child-runner pattern and the verify-gates parity definition are the mechanism; no parallel push mechanism, no parallel parity arithmetic, no new configuration.
4. **Evidence legibility** — the attempt names the parity outcome (`push:<verdict>`) and the machine envelope names both compared heads, so an operator diagnoses without reading git state.

**Operational drivers:**

5. **Zero wasted CI cycles** — the evidence commit rides the pull request from the start; no delivery pays a second cycle for a late manual push.
6. **Bounded cost** — one push plus one parity read, wall-clock inside the delivered 60 000 ms budget; the common case (parity already holds) performs no act at all.
7. **Idempotent recovery** — the next dispatch or an operator resume re-evaluates the precondition; a failed act consumes no restart ordinal and starts no second session.

**Precedent drivers:**

8. **Declared write posture** — the first remote-write seam must enter the stack as a reviewed, bounded declaration so future write seams inherit a pattern with named bounds, not an unexamined permission.
9. **Honest scope** — the typed lane and the bash fallback differ after this change; the difference is declared in the feature pages and the operations guide, never silent.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-386 DEC-1, the mandated companion record).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-386 PR review; the AI does not accept this record, and `decision_date` stays null until that acceptance.
- **Contributors:** `@pm` (clarify-scope), `@spec-writer` (the change specification's DEC-1, F-1/F-3, NFRs, §21, and Appendix A code-truth basis), `@decision-advisor` (analysis and this record).
- **Required reviewers:** `@reviewer`, human owner.
- **Performers:** `@coder` (ensure-push seam, arm-8 precondition), `@test-plan-writer` (fixture arms), `@doc-syncer` (phase-7 reconciliation).
- **Informed:** operators of native deliveries; future authors proposing engine write seams.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The engine derives `pr-open` from pull-request truth alone; no push act or head comparison exists at classification | FACT | GH-386 spec §2.1, Appendix A; `feature-dispatch-engine.md` | The act would amend an existing capability, not introduce a first one — the precedent framing would weaken | High |
| Verify gates computes parity as local head SHA vs the open delivery request's head SHA, full-hex equality | FACT | GH-386 spec §2.1; `feature-verify-gates.md`; TDR-0071 | A parallel parity definition would be needed, risking two truths | High |
| The delivered git mutation seams are local-only by declaration (no-network, no-remotes); no remote-write operation exists in the typed stack | FACT | GH-386 spec Appendix A | The act would not be a genuine precedent and this record's mandate would be moot | High |
| The commit primitive never pushes; the PR-creation workflow's retained git writes are exactly the push and PR creation | FACT | GH-386 spec §2.1, Appendix A | Push would already be structural elsewhere, changing the option space | High |
| The unpushed-evidence outcome was observed on two consecutive native deliveries and did not reproduce on a third — the path permits both outcomes | FACT | ticket GH-386; GH-386 spec §1 | A deterministic-only defect would weaken the structural-enforcement argument but not reverse it | High |
| Dispatch has no merge port and no merge code path | FACT | GH-386 spec Appendix A | The push act could conflate with a merge capability | High |
| The git-operations-centralization work is parked and is not a dependency of this change | FACT | GH-386 spec §2.1, NG-6 | Deferral would become viable and reopen the deferred alternative | High |
| A pull request open for the change branch implies that branch has a configured upstream remote | ASSUMPTION | GH-386 spec §12 | The act would need upstream discovery or fail readably as the typed failure | Medium |
| The ambient credential chain available to sessions is available to the engine's child process in the same checkout and environment | ASSUMPTION | GH-386 spec §12 | Pushes reject; the typed failure retains the PR URL and the next dispatch or resume resolves | Medium |
| GitHub's delivery-request head reflects a landed push in time for the single bounded parity re-read | TO-CONFIRM | GH-386 spec §12, RSK-4 | A stale read type-fails honestly and the next dispatch reconciles — degraded, never wrong | Medium |
| The full act behaves end-to-end under a real remote on two consecutive natural dispatches | TO-CONFIRM | GH-386 spec F-4 — the declared post-merge live-verification contract | Fixtures prove the logic; the live contract is the residual proof and cannot pass silently (a divergence there is the typed failure) | Medium |

## Mental Models & Techniques Used

- **First principles:** `pr-open` is a claim, and a claim that can be false while the token derives is misreporting. The claim is made a precondition of the token.
- **Structural vs behavioral enforcement (systems thinking):** the defect lives in the conformance layer; enforcement placed there inherits its failure mode. The derivation is the one layer that cannot conformance-fail.
- **Inversion:** how does each alternative leave the defect alive? Do nothing permits it; session-side enforcement re-creates it one layer over; verify-only converts it into a standing operator tax; deferral schedules the fix behind parked work with no owner momentum.
- **Second-order thinking:** an unpushed evidence commit invalidates CI on the pull request's head when pushed later — the second-order cost is a recurring CI tax on every affected delivery, which one bounded push removes.
- **Expected value (fail-loud dominance):** at any realistic rejection rate, a typed failure with the retained PR URL dominates a silent false success, because the false success is discovered later at higher cost.
- **KISS:** one bounded act, one attempt, no retry ladder, no new vocabulary — the smallest mechanism that makes the claim true by construction.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 parity-backed `pr-open` | C-2 structural enforcement | C-3 bounded act | C-4 force-free scope | C-5 closed vocab | C-6 no merge / no new credentials | C-7 no parked dependency |
|---|---|---|---|---|---|---|---|
| ALT-0 keep session-side convention only | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 session-side push + dispatch-side verification | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 verify-only — typed failure on divergence | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 defer until git-operations centralization | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-4 engine-side ensure-push (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails. All constraints are `Negotiable: no`, so no accepted-risk exceptions are claimed and any ❌ is disqualifying.

### Alternative 0 — Do Nothing: Keep Session-Side Push Convention as the Only Mechanism

- **Eligibility:** Not eligible (fails C-1 and C-2).
- **Summary:** Leave `pr-open` derived from pull-request truth alone, with the push of the evidence commit resting entirely on the lifecycle's session-side convention.
- **Constraint compliance:** C-1 fails — nothing establishes parity before the token derives, and the divergent `pr-open` remains possible. C-2 fails — the only enforcement is behavioral, and the current path demonstrably permits both outcomes.
- **Driver fit:** Fails drivers 1, 2, 5, and 8.
- **Pros:** Zero change; no new write seam; no new failure mode.
- **Cons:** The defect stands: delivered artifacts lack their own evidence, CI is invalidated by late pushes, and detection remains an operator comparing heads.
- **Why rejected:** It is the defect under decision, and the ticket's required behaviours cannot be met by convention that two consecutive deliveries did not follow.

### Alternative 1 — Session-Side Push (Lifecycle Prompt) with Dispatch-Side Verification and Typed Failure

- **Eligibility:** Not eligible (fails C-1 and C-2).
- **Summary:** Keep the push in the session's hands (the lifecycle prompt instructs it), and add engine-side verification at classification: compare heads, and type-fail when parity is unmet.
- **Constraint compliance:** C-2 fails — the mechanism that must produce the pushed commit remains prompt-driven, and the demonstrated defect is exactly a prompt-conformance gap; the fix would depend on the very discipline that failed twice. C-1 fails — when the session does not push, nothing reconciles: the delivery type-fails with the branch still local-ahead, so the lane's evidence still reaches the remote only through operator or re-dispatch action, not through the classification path.
- **Driver fit:** Partial on driver 2 (the verification is fail-loud) but fails drivers 1 and 5; the failure mode it adds is the one the defect already demonstrated.
- **Pros:** No engine write I/O; the engine stays read-only; a divergent state at least fails loudly.
- **Cons:** `pr-open` parity remains hostage to prompt discipline; every conformance gap becomes a failed delivery rather than a reconciled one; the non-reproducing third run shows the flaw is intermittent, so the failure would be intermittent too.
- **Why rejected:** Enforcement must not rely on the layer that failed. The spec's DEC-1 basis states this directly: the demonstrated defect is a conformance gap, so the enforcement mechanism may not be a conformance mechanism.

### Alternative 2 — Verify-Only: Typed Failure on Divergence, No Engine Push

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** The engine gains the parity comparison but no push act: a divergent state at arm 8 is a typed non-`pr-open` failure; an operator (or the session, on resume) must push before re-dispatch.
- **Constraint compliance:** C-1 fails — reconciliation never happens inside the classification path; ticket behaviour 1 ("the lifecycle pushes the final commit(s) before the attempt is classified `pr-open`") is unmet because nothing pushes: every divergent delivery ends `failed` and needs operator remediation, even though the engine could have reconciled it with one bounded push.
- **Driver fit:** Strong on drivers 1 and 2, fails driver 5 and imposes a recurring operational tax (driver 7 weakens: recovery is manual, not idempotent re-evaluation).
- **Pros:** The engine stays read-only — no precedent to set; the failure is typed and honest.
- **Cons:** The common, recoverable case (local ahead, remote ready) becomes a human task; the M4 goal of one person running an autonomous delivery factory is contradicted by a failure class that exists only to summon that person.
- **Why rejected:** It satisfies the honesty half of the problem while abandoning the autonomy half. A typed failure is the right answer for a push the engine cannot perform — not for one it can.

### Alternative 3 — Defer Until the Parked Git-Operations-Centralization Work

- **Eligibility:** Not eligible (fails C-1 and C-7).
- **Summary:** Do not add the push seam now; wait for the centralization of git operations to land, then implement the ensure-push on the centralized family.
- **Constraint compliance:** C-1 fails for the deferral's entire duration — the defect stays live, blocking clean end-to-end native delivery and M4 handover confidence. C-7 fails — deferral creates exactly the dependency on parked work the change declares it does not have.
- **Driver fit:** Fails drivers 1 and 5 for the deferral period; driver 3 (reuse) is already satisfied by the delivered child-runner pattern, so the centralization premise buys nothing this act needs.
- **Pros:** One git seam family instead of two, eventually; no new seam that might need migration.
- **Cons:** The parked work is unverified and has no owner momentum; the defect is live now; the delivered pattern is sufficient, so deferral trades a present fix for a future refactor that may never reshape this seam.
- **Why rejected:** Sequencing a defect fix behind an unrelated parked refactor inverts the priority order — the ticket blocks M4 confidence, and the refactor does not block the ticket.

### Alternative 4 — Engine-Side Ensure-Push Before Classification (selected)

- **Eligibility:** Eligible (passes C-1 … C-7).
- **Summary:** At derivation arm 8 (open pull request, URL resolved), the engine evaluates the verify-gates parity definition — local checkout head SHA vs the open delivery request's head SHA, full-hex equality. When the local head is ahead, it performs one bounded ensure-push: a fast-forward-only push of the change branch to its configured upstream, through the delivered adapters child-runner pattern (fixed argv, literal non-shell child, 60 000 ms injectable timeout, single attempt, no force variant), then re-reads parity. `pr-open` derives only when the heads are equal. A rejected, failing, timed-out, or still-unmet push is a typed non-`pr-open` failure inside the closed vocabulary, retaining the PR URL. Parity evidence rides bounded `push:<verdict>` references and an additive optional machine-envelope block; text mode is unchanged.
- **Constraint compliance:** C-1 by making parity a precondition of the token with engine-side reconciliation and a fixture-pinned defect definition; C-2 by placing the act in the derivation, which cannot conformance-fail; C-3 by the bounded single-attempt act contract with the delivered timeout budget and no new configuration key; C-4 by fast-forward-only scoping to the change branch's upstream with no force variant; C-5 by the one new failure-token-mapping row, the reserved evidence references, and the byte-identical text mode; C-6 by leaving dispatch merge-free and using only the ambient credential chain; C-7 by composing the delivered child-runner pattern and the delivered parity definition with no dependency on parked work.
- **Driver fit:** Best on all nine drivers.
- **Pros:** Deterministic parity-backed `pr-open`; no second CI cycle; typed honest failure; idempotent recovery; the common case performs no act; evidence names the parity facts; the first write seam enters bounded and declared.
- **Cons:** The engine gains its first remote write — a posture change that must be guarded by this record; push rejections become new (honest) failure modes; a stale provider head-read can fail one good delivery until the next dispatch.
- **Why chosen:** It is the only alternative that satisfies every constraint, and it is the smallest mechanism that makes the `pr-open` claim true by construction rather than by convention.

## Decision

- **Decision:** Adopt **ALT-4**.

### D1 — The act: parity precondition with a bounded ensure-push at arm 8

The derivation's open-pull-request arm (arm 8, URL resolved) gains a parity precondition evaluated with the delivered verify-gates computation: the checkout's local branch head compared for full-hex equality against the pull request's head SHA. Declared behaviours:

- **Parity already holds** (the session pushed, or nothing to push): no push act is performed; the classification proceeds with `push:clean` evidence.
- **Local head ahead**: one bounded ensure-push — fast-forward-only, change branch's configured upstream only — through the delivered child-runner pattern as an injected engine capability, then one parity re-read, then `pr-open` with `push:pushed` evidence.
- **Push rejected, failed, timed out, or parity still unmet after the act**: the typed failure of D2; `pr-open` never derives.
- **Remote head ahead of local** (unresolvable by a fast-forward push): the typed failure of D2.
- **Parity read unreadable**: the delivered undecidable-truth semantics — `state-unverified` at exit 2 — not the push-failure row.
- **`pr-open-unverified`**: the precondition is inapplicable (no pull-request head fact to compare); the token's delivered semantics are unchanged.
- **Resume**: the precondition binds every classification reaching arm 8, including the terminal classification of a resumed lane; the act is idempotent on an already-parity branch.

**Act contract:** fixed argv; literal non-shell child process; bounded child timeout of 60 000 ms (the delivered git-mutation-seam budget, injectable, no new configuration key); one attempt per classification with no retry ladder — the next dispatch or an operator resume resolves a failed act; no force-capable variant; the session posture is post-session and pre-classification, consuming no restart ordinal and starting no second session.

### D2 — The failure: typed, inside the closed vocabulary

The pinned failure-token mapping gains exactly one row: a lifecycle push failure — the ensure-push act rejected, failed, timed out, or parity unmet after it — mapped to result token `failed`, outcome `failed`, exit 1, exactly one attempt record, comparison not-applicable with the new declared reason literal `push-parity-unmet`. The row adds no error identity, no result token, no domain kind, and no error-table row; it counts for class coverage as exposure, makes no success claim, creates no divergence, and blocks nothing. The PR URL is retained — `pr_url` in text mode and `prUrl` in the machine data — so the operator holds everything needed to resolve and resume.

### D3 — The evidence: bounded parity facts in the delivered styles

The attempt's evidence references record the parity outcome as `push:<verdict>` with the closed verdict set `clean`, `pushed`, `failed` — identifiers only, no provider payload, no credential, no diff — joining the reserved-ahead-of-slice set within the delivered 16-reference budget so a disclosure is never truncated away. The machine envelope carries an additive optional `push` block, present together-or-absent-together exactly when the parity precondition evaluated, with bounded single-line members `verdict`, `localHead`, `remoteHead`, `parity`, whole-block within the delivered 256-character bound. Human text mode stays the four-key contract. The corroboration requirement map stays closed; `pr-open` still requires the tracker source only — parity is enforced at derivation, not added as a corroboration source.

### D4 — The boundaries that do not move

- Dispatch keeps **no merge port and no merge code path**; a push is not a merge, and a merge-ready pull request stays `pr-open` for the coordinator.
- **Session-side conventions are unchanged**: the lifecycle's push behavior, the PR-creation workflow's retained git writes, and the commit primitive's never-push rule stand; the ensure-push is a reconciliation backstop, not a replacement instruction.
- **The shell fallback is unchanged** and gains no parity enforcement; the typed lane and the fallback diverge, and the divergence is declared in the feature pages' fallback rows and the engine-first operations guide — documented, never silent.
- The existing merge-transaction seam's **local-only declaration is unchanged**; this record authorizes one new seam, not a general remote-write permission.
- The **standing lockstep changeset invariant** (five fixed-group packages, all minor) applies to the implementing change.

### D5 — The precedent: the pattern this record sets

This is the typed stack's first remote-write operation, and its entry is the pattern future write seams are measured against: **bounded** (one act, one attempt, declared timeout, no new configuration), **narrow** (fast-forward-only, one ref, one remote), **safe by construction** (no force variant exists to misuse), **honest in failure** (typed, cause-naming, PR URL retained, no silent shape), and **declared** (documented in the feature pages, not discovered). A future seam that cannot state all five properties does not inherit this precedent — it needs its own record.

**Authority and acceptance:** this is an R2 design record. Status is `Proposed`; `decision_date` is `null`. The human owner (Juliusz Ćwiąkalski) accepts it at the GH-386 PR review. AI assistance designed, analysed, and wrote the record; the AI does not accept it. Until acceptance, the GH-386 specification may cite this record as the authority for the engine's write posture, and the record itself must not be described as settled.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 … C-7: parity is a precondition of the `pr-open` token with engine-side reconciliation and the divergent classification pinned as a defect (C-1); the act lives in the derivation, not in any prompt or session convention (C-2); the act is bounded — one attempt, fixed argv, literal non-shell child, 60 000 ms injectable timeout, no new configuration key, no new provider read class (C-3); the write is fast-forward-only and scoped to the change branch's configured upstream with no force variant (C-4); every closed set is unchanged, the failure rides one new mapping row, evidence stays bounded and reserved, and text mode is byte-identical (C-5); dispatch remains merge-free and no credential beyond the checkout's ambient chain is touched (C-6); and the seam composes only delivered patterns — the child-runner family and the verify-gates parity definition — with no dependency on parked work (C-7). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- `pr-open` is a parity-backed claim by construction: a classification with the local head ahead of the pull request's head is impossible, and the fixture pins it as a defect definition rather than an operator discovery.
- The lifecycle's evidence commit rides the pull request from the start: the reviewed and merged artifact carries the delivered change's own evidence, and no delivery pays a second CI cycle for a late manual push.
- Push failure is typed and honest: the attempts digest names `push:failed` with the comparison reason `push-parity-unmet` and keeps the PR URL, so diagnosis needs no git archaeology.
- The mechanism reuses what the repository already owns — the child-runner pattern, the verify-gates parity definition, the failure-row semantics — so no parallel push mechanism or parity arithmetic exists to drift.
- Recovery is idempotent and cheap: the next dispatch or an operator resume re-evaluates the precondition; a failed act consumes no restart ordinal; the common case performs no act at all.

### Negative Outcomes

- The engine's write posture changes: the typed stack gains its first operation that leaves the checkout, and every future write proposal now argues against this precedent rather than in an unexamined space.
- Push rejections surface as new delivery failures at exit 1 — non-fast-forward states, protected-branch rules, credential rejections. Each is honest and resumable, but each is operator-visible work that did not exist before.
- A provider head-read stale immediately after a successful push can misclassify one good delivery as failed; the next dispatch reconciles, but the single false failure is real (RSK-4).
- The typed lane and the bash fallback drift further apart: the fallback gains no parity enforcement, and the difference is carried as declared documentation rather than shared code.
- The residual stands: a `pr-open-unverified` lane can still end with the local head ahead, because no pull-request head fact exists to compare — unchanged from today and declared, not fixed.

### Unresolved Questions

- [ ] Does the single `push:failed` verdict suffice for operator diagnosis, or does a real rejection mix (authentication vs non-fast-forward) justify richer cause disclosure? (owner: `@pm`; the change spec declares this deferred until operator evidence shows the need)
- [ ] Should the shell fallback gain parity enforcement, at or before its retirement? (owner: the owner lane; the fallback's retirement is a separate owner act, and this record deliberately does not widen into it)
- [ ] Does improved pull-request URL resolution justify extending the parity precondition to `pr-open-unverified`? (owner: `@pm`; reopens the change spec's DEC-5 and this record's boundary together)

## Implementation Plan

1. **Specification:** GH-386's F-1 (precondition and act), F-2 (evidence), F-3 (typed failure), DM-1..DM-3, and NFR-1..NFR-5 are the implementing statements; the change spec cites this record at its DEC-1 as the authority for the engine's write posture.
2. **Adapters seam:** the push operation joins the delivered git child-runner family — fixed argv, literal non-shell spawn, injected runner, injectable 60 000 ms timeout, single attempt, fast-forward-only refspec scoped to the change branch's configured upstream.
3. **Engine composition:** the push capability is injected into the dispatch flow like the delivered spawn identity, delay, and terminate bindings; the parity precondition evaluates at arm 8 before the token resolves; the failure maps through the one new failure-token-mapping row with the `push-parity-unmet` comparison reason.
4. **Evidence wiring:** `push:<verdict>` references reserved ahead of the evidence slice; the additive optional envelope block bounded at the delivered 256-character bound; text mode untouched.
5. **Tests:** the parity-before-`pr-open` fixture and the rejected-push typed-failure fixture gate the merge, with the divergent-`pr-open` defect pin; boundary arms cover already-equal (no act), local-ahead (one act + re-read), unmet-after-act, unreadable read (`state-unverified`), remote-ahead, and resume idempotence; set-equality inventories cover every closed vocabulary.
6. **Documentation (phase 7):** reconcile the dispatch-engine feature page (primary), the quality-gates page (`pr_creation` tail cross-reference), the verify-gates page (the shared parity seam), the autonomous-delivery page (fallback rows), the engine-first operations guide, and the dispatch-engine test-spec coverage map.
7. **Post-merge:** the first two consecutive natural dispatches are the live verification per the change spec's declared contract, recorded by the CEO/owner lane; a divergence there surfaces as the typed failure, never silently.

## Verification Criteria

- Metric: natural dispatches ending `pr-open` with the local head ahead of the pull request's head — Target: 0 — Window: the post-merge live verification (first two consecutive natural dispatches), then ongoing.
- Metric: `pr-open` classifications carrying parity evidence (reference + envelope block) — Target: 100% — Window: from merge forward.
- Metric: deliveries paying a second CI cycle for an unpushed evidence commit — Target: 0 — Window: from merge forward.
- Metric: push acts performed per classification — Target: ≤ 1 (no retry) — Window: GH-386 CI (injected-runner assertions).
- Metric: new members in any closed set (result tokens, error identities, error-table rows, domain kinds, derivation arms, attempt-record fields, corroboration sources) — Target: 0 — Window: GH-386 CI (set-equality inventory).
- Metric: text-mode byte differences — Target: 0 — Window: GH-386 CI (four-key golden).
- Metric: classifications resolving `pr-open` while a performed push left parity unmet — Target: 0 — Window: GH-386 CI (fixture-pinned as a defect).

## Confidence Rating

**Medium–high.** Every mechanism element is delivered and individually proven: the child-runner pattern runs the git binary today under declared timeouts, the verify-gates parity computation is the shipped definition, the failure-token mapping's row semantics are delivered, and the evidence-reference and additive-envelope precedents are established. The in-change fixtures gate the merge. The medium component is honesty about the live-remote surface: credential availability to the engine's child process, provider head-read freshness after a push, and end-to-end behaviour on real remotes are labelled ASSUMPTION/TO-CONFIRM above and are confirmed only by the post-merge live verification — which is designed so that a wrong assumption surfaces as the typed failure, never as a false `pr-open`.

## References

- Change specification: `doc/changes/2026-11/2026-11-23--GH-386--push-pr-evidence-before-pr-open/chg-GH-386-spec.md` — DEC-1 (this record's mandate), F-1/F-2/F-3, NFR-1..NFR-5, RSK-1..RSK-6, §21 security highlights, Appendix A (code-truth basis), Appendix B (the pinned failure-token-mapping row).
- Ticket: GH-386 (juliusz-cwiakalski/agentic-delivery-os) — the problem statement and acceptance criteria.
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the closed delivery result enum and CLI exit taxonomy the typed failure rides.
- [TDR-0053](TDR-0053-total-derivation-ladder-and-corroboration.md) — the total derivation ladder and arm-aware corroboration this record's precondition binds.
- [TDR-0071](TDR-0071-merge-change-branch-and-resolved-head-authority.md) — the delivery request's head as the verified head authority for the lane.
- [TDR-0019](TDR-0019-dispatch-admission-credential-preflight.md) — the delivered provider delivery-request read that supplies the remote-head fact.
- Feature specs: [Dispatch Engine](../spec/features/feature-dispatch-engine.md), [Verify Gates](../spec/features/feature-verify-gates.md) (the shared parity definition), [Quality Gates and PR](../spec/features/feature-quality-gates-and-pr.md) (the `pr_creation` push convention), [Autonomous Delivery](../spec/features/feature-autonomous-delivery.md) (the fallback divergence).
- Guide: [Engine-First Operations](../guides/engine-first-operations.md).
