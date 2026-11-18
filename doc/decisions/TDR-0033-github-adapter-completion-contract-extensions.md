---
id: TDR-0033
decision_type: tdr
status: Proposed
created: 2026-11-17
decision_date: null
last_updated: 2026-11-17
summary: "Complete the GitHub reference adapter's contract additively: a new closed operation `merge-delivery-request` (one provider-side squash landing with crafted commit title/message and an optional head guard; GitLab and Jira declare gaps; `write-delivery-request` stays a content write), additive optional `PipelineJob.startedAt`/`completedAt` copied verbatim with absent-means-unknown, and a bounded adapter-local log-excerpt read whose closed shape and 8 KiB cap are fixed here while log text never enters a core contract, is never persisted, and is never paginated — plus the explicit non-decision that this record does not rewire the delivered local-git merge transaction."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider adapters (GitHub reference adapter) and core adapter contracts"
decision_scope: repo
review_date: null
business_impact: "The reference adapter gains the three capabilities M3 EC-2 names — a crafted squash landing, failure-job timing, and bounded failure evidence — as declared, parity-testable surface instead of adapter-specific improvisation, so GitLab and Jira can be held to the same contract."
customer_impact: "Operators get a merge that produces the commit message they wrote, checks that name the failing job with its start/end times and a bounded log excerpt, and an honest gap when a provider cannot do one of those — instead of a status colour and a prose explanation."
classification:
  domains: [architecture, contracts, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-338: @pm routed the merge-representation question to a record during clarify_scope)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-338 clarify_scope: pm-notes decision that merge has no destination in the closed operation set)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-338 PR review — this record widens a closed operation set)"
  performers:
    - "@coder (GH-338 delivery: contract fields, capability declarations, merge write, timing normalization, log reader, conformance registry and fixtures)"
    - "@doc-syncer (adapter-ports / client-seeds / conformance / merge-verify specs)"
  informed:
    - "M3-S3 GitLab code-host adapter (GH-337) — merge and timing parity"
    - "M3-S5 adapter conformance and parity suite (GH-339)"
    - "Merge transaction, verify, status, and closeout consumers of `PipelineRun` and `DeliveryRequest`"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A provider supplies a native job duration (GitLab CI jobs do): add optional `durationMs` in its own additive round with the provider-asserted-only rule; never back-fill it by deriving from the GitHub timestamps."
  - "The merge transaction is next revised: decide deliberately whether provider-side squash merge replaces, composes with, or sits beside the delivered local-git `squashLand` + push path; this record does not rewire it and must not be read as doing so."
  - "A lifecycle consumer needs review-thread comment bodies or replies in the normalized view: review-thread bodies were routed to TDR-0034 and kept out of core; a port-side need is a new additive decision with a named consumer, not an extension of this record."
  - "Log excerpts prove to carry secret material often enough to matter: tighten to a narrower excerpt, a redaction-before-return rule, or a declared opt-in, rather than growing the bound."
  - "A provider's merge needs force/bypass/merge-queue semantics: decide those as separate operations with their own safety story; never widen `merge-delivery-request`."
  - "The v1→v2 contract boundary is ever opened: restate the absence semantics and the closed-operation gap discipline deliberately at that boundary."
links:
  related_changes: ["GH-338"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml"
    - "doc/spec/features/feature-adapter-ports.md"
    - "doc/spec/features/feature-provider-client-seeds.md"
    - "doc/spec/features/feature-adapter-conformance.md"
  contracts:
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/core/src/contracts/ports.ts"
    - "packages/testkit/src/conformance/flows.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0004", "ADR-0006", "TDR-0008", "TDR-0034"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S4", "M3-S3", "M3-S5"]
---

# TDR-0033: GitHub Adapter Completion Contract Extensions — `merge-delivery-request`, Pipeline-Job Timings, and a Bounded Log-Excerpt Read

## Context

- **FACT:** `ADAPTER_OPERATIONS` is a closed set of eight operations — `read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `write-comment`, `resolve-delivery-thread` — and contains nothing that means "land this delivery request" (`packages/core/src/contracts/adapter-capabilities.ts`, read 2026-11-17).
- **FACT:** `GITHUB_ADAPTER_CONTRACT` declares `write-comment` and `write-delivery-request` as `adapter-not-implemented` gaps and supports the other six; the conformance suite therefore records both as declared-gap skips today (`packages/adapters/src/github/capabilities.ts`, `doc/spec/features/feature-adapter-conformance.md`, read 2026-11-17).
- **FACT:** The delivered merge transaction lands a squash commit through the **local** git seam (`composition.git.squashLand` + `git push`) and verifies the landing by reading the provider's request state; it never calls a provider merge endpoint (`packages/core/src/domain/merge-transaction.ts`, read 2026-11-17; GH-338 clarify-scope note). Provider-side squash merge is genuinely new surface.
- **FACT:** M3 EC-2 requires GitHub and GitLab as code hosts with "checks/pipelines with failure job/log/timing access" and "squash merge with crafted metadata"; M3-S4 names "squash merge with crafted title/description and squash commit message" and "checks with failure job/log/timing access"; the M3 contracts proposal names `review.create`, `review.update`, and `review.merge` (`doc/planning/oss-tooling/milestones/m3/README.md`, `contracts.md`, read 2026-11-17).
- **FACT:** GH-338's applied default for pipeline analytics depth (Q-07) is "status + failed job/task name + bounded log excerpt + durations", with full log archives explicitly out of scope (GH-338 pm-notes, 2026-11-17).
- **FACT:** `PipelineJob` is exactly `{ jobName, jobState }` and `PipelineRun.traceEvidence` is `{ evidenceName, location }`; no timing and no log surface exists (`packages/core/src/contracts/ports.ts`, read 2026-11-17).
- **FACT:** Check runs normalize to one `PipelineRun` per run carrying one job, so per-job timing attaches at the right granularity without changing the per-run normalization (`doc/spec/features/feature-provider-client-seeds.md`, read 2026-11-17).
- **FACT:** `createGitHubDeployTraceReader` is the delivered precedent for a bounded, adapter-local read behind the existing ports: one GET, a closed provider-neutral shape, no new closed operation, no schema bump, and explicitly "log bodies never cross the boundary" (`packages/adapters/src/github/deploy-trace.ts`, read 2026-11-17).
- **FACT:** `tests/structure/conformance-coverage.test.ts` pins the registry to the closed operation set exactly, and the coverage gates require every supported operation to execute and every declared gap to be encountered; the conformance spec states that "merge and the deploy-trace read sit outside the three-flow registry" today (`doc/spec/features/feature-adapter-conformance.md`, `packages/testkit/src/conformance/flows.ts`, read 2026-11-17).
- **FACT:** Adapter-contract evolution is additive-within-v1 and decision-record governed; the prior rounds executed under ADR-0004 (optional `WorkItem.updatedAt`), ADR-0006 (optional `WorkItem.comments`), and TDR-0008 (optional `headSha` plus the `resolve-delivery-thread` operation member) (`doc/spec/features/feature-adapter-ports.md`, read 2026-11-17).
- **FACT:** The provider subpaths are admitted runtime-API edges with an exactly-five-entry secret-read allowlist; no provider subpath adds ambient reads (`doc/spec/features/feature-adapter-ports.md`, read 2026-11-17).

## Problem Framing (Clarified)

Three superficially different questions are one decision class: **how provider truth enters the normalized contract additively, without implied parity, without a parallel surface, and without dragging bulk payloads into the contract.**

1. **A destructive provider-side landing has no vocabulary.** Folding it into `write-delivery-request` would make one operation mean "create a review", "edit its text", and "irreversibly land it". That is the model TDR-0008 explicitly rejected for thread resolution ("a lying capability declaration; the operation's arguments would become a union of unrelated writes"), and it is worse here because the action is destructive. But adding an operation to a closed set is not free either: every adapter must declare support or a gap, and the registry and coverage gates ripple in the same change.

2. **Small provider-asserted timing facts belong in the normalized view.** "Duration" is load-bearing for failure triage, and a normalizer is exactly where a provider timestamp becomes a stable, provider-neutral fact. The failure mode to avoid is *derivation*: a `durationMs` the provider never asserted would be a fabricated fact under the contract's absence rule.

3. **Log text does not belong in the normalized view.** Logs are unbounded, opaque, and the single richest secret-leak surface in the whole adapter. The delivered precedent already says log bodies never cross the boundary; Q-07 asks for a *bounded excerpt*, which is evidence, not lifecycle truth.

The unifying principle this record adopts: **lifecycle facts normalize into core with explicit absence semantics; bulk evidence stays adapter-local behind a bounded read.** It is not a new rule — it is the rule the delivered contract already follows — but stating it makes the three sub-decisions checkable against one another, and it is what makes "bounded log excerpt" and "timing fields" land in different places on purpose rather than by accident.

A fourth question was routed separately and is settled by a companion record: threaded-discussion *bodies* and replies. `DeliveryThread` carries `threadId`, `resolved`, `commentCount`, and optional root-author facts — no comment text. This record does not change that shape; [TDR-0034](TDR-0034-review-thread-discussion-bodies-bounded-adapter-read.md) decides the bodies as a bounded adapter-local evidence read and keeps the normalized contract body-free.

## Constraints (Hard Requirements)

### C-1: Additive within v1, with no schema-version bump or migration

- **Statement:** No delivered field is removed, retyped, or made required; new fields are optional; no operation is removed or renamed; no persisted-state migration is introduced.
- **Source:** Prior decisions (ADR-0004, ADR-0006, TDR-0008 C-1); adapter-ports evolution discipline.
- **Verification:** Contract-inventory/field-shape probes and `pnpm typecheck` in the same change; review of the state-schema surface.
- **Negotiable:** no.

### C-2: Capability honesty — no implied parity

- **Statement:** Every operation an adapter cannot perform must be declarable as a gap with a valid reason; no adapter may report an undeclared destructive capability, and no operation's presence in the enum may imply support.
- **Source:** Adapter-ports capability/gap rule; TDR-0008 C-4; M3 EC-2/EC-4.
- **Verification:** Capability-parity tests (supported plus declared gaps cover the closed set exactly); gap fixtures; conformance capability-gated skips.
- **Negotiable:** no.

### C-3: A destructive landing has its own named operation

- **Statement:** A provider-side merge must be a distinctly named closed operation; it must not be folded into a content-write operation, and `write-delivery-request` must not acquire landing semantics.
- **Source:** TDR-0008 ALT-4 rejection (overload of a write operation); M3 `contracts.md` `review.merge`; GH-338 task list.
- **Verification:** Review of the operation semantics; capability tables showing a provider can support create/update without merge and vice versa.
- **Negotiable:** no.

### C-4: Conformance integrity in the same change

- **Statement:** Any change to the closed operation set or to an executed step's expectations must land with the flow registry, structural and runtime coverage gates, mock-tenant routes, and expected projections updated together; the suite must never pass by becoming vacuous.
- **Source:** `tests/structure/conformance-coverage.test.ts` invariant; adapter-conformance coverage-gate rules.
- **Verification:** Test — exact set equality between the registry's operation set and `ADAPTER_OPERATIONS`; runtime coverage proof (every supported operation executed, every declared gap encountered).
- **Negotiable:** no.

### C-5: No new transport, credential, or network location

- **Statement:** Every new read and write rides the existing injected `ProviderTransport` and `CredentialPort`; no new secret-read allowlist entry and no new network edge.
- **Source:** ADR-0005; secret-read boundary; provider-client-seeds construction rules.
- **Verification:** Test — secret-read invariant count unchanged; no new transport module; boundary review.
- **Negotiable:** no.

### C-6: Bulk evidence stays bounded and out of the contract

- **Statement:** Log text never enters a core contract type, is never persisted in state, is never paginated, is bounded to one declared excerpt size, and is redacted at the rendering chokepoint before it reaches a human surface.
- **Source:** Deploy-trace precedent ("log bodies never cross the boundary"); Q-07 ("full log archives out of scope"); redaction chokepoint (result contract).
- **Verification:** Test — excerpt bound and truncation assertions, no-persistence assertion, redaction assertion, category/boundary tests.
- **Negotiable:** no.

### C-7: Truthful absence — no derivation, no defaults

- **Statement:** Optional timing facts are provider-asserted and copied verbatim; absent means unknown and is never derived, defaulted, or collapsed to zero; a consumer cannot mistake absence for "instantaneous" or "not run".
- **Source:** ADR-0004/ADR-0006 absence rule; provider-client-seeds absence semantics.
- **Verification:** Paired present/absent fixtures; type-level optionality; consumer refusal tests where a decision depends on the value.
- **Negotiable:** no.

### C-8: Provider-neutral consumption

- **Statement:** A core consumer must be able to read the merge outcome and job timing without branching on the provider kind; behavior differences are declared in capability data, never in core conditionals.
- **Source:** M3 architecture boundary invariant 1; ADR-0003 DEC-6.
- **Verification:** Code review of the consuming engines; boundary/structure tests forbidding provider-kind conditionals in core.
- **Negotiable:** no.

### C-9: The story's acceptance criteria are satisfiable

- **Statement:** The parity suite must be able to exercise the three capabilities through the production client, and the reference behavior must be documentable in the adapter contract.
- **Source:** GH-338 AC ("parity suite green; reference behavior documented in the adapter contract"); M3 EC-2/EC-4.
- **Verification:** Offline fixtures executing all three surfaces through the production client, plus the reference-behavior document.
- **Negotiable:** no.

## Decision Drivers

1. **Capability granularity.** The vocabulary should describe exactly the capabilities that differ across providers — no coarser (which hides a real difference and forces a misreported gap) and no finer (which fragments parity into provider-specific dialects).
2. **Reference-implementation completeness and parity.** GitHub is the shape GitLab and Jira are held to; whatever is decided here becomes the parity bar.
3. **Destructive-action safety.** A merge is unrecoverable; its arguments, guards, and replay semantics must be narrow and read-back-verified.
4. **Minimal additive surface (least privilege).** Add only what a named consumer needs; no speculative fields and no second read for a subset of facts.
5. **Conformance cost.** A closed-set change is cheap once, expensive forever; the ripple must be paid deliberately and in one change.
6. **Triage value per byte of evidence.** Failure triage should get the signal that actually explains a red job — which job failed, when, and what it said — for the least evidence volume and the least new payload surface.
7. **Paved road.** Additive-within-v1 plus a bounded adapter-local read are both delivered precedents; novelty must justify itself.

*(Overlap check: each driver above is a continuous ranking preference; none duplicates a gate. Boundedness, non-persistence, and redaction of evidence are gates (C-6) and appear here only as the ranking value "how much triage signal per byte" — the gate decides eligibility, the driver ranks survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-338 clarify_scope routed this call here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (scope, applied defaults, the "no destination in the closed set" finding); `@decision-advisor` (analysis and record); `@spec-writer` (carry the shapes into the change spec once written).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-338; the owner for final acceptance of this record.
- **Performers:** `@coder` (contracts, capabilities, adapter writes and normalization, conformance registry and fixtures); `@doc-syncer` (four spec surfaces plus the reference-behavior document).
- **Informed:** M3-S3 GitLab adapter (GH-337), M3-S5 conformance suite (GH-339), and the merge, verify, status, and closeout consumers.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The closed operation set is eight members and has no merge operation. | FACT | `packages/core/src/contracts/adapter-capabilities.ts` (read 2026-11-17) | The operation addition would be unnecessary. | High |
| GitHub declares `write-comment` and `write-delivery-request` as `adapter-not-implemented` gaps today. | FACT | `packages/adapters/src/github/capabilities.ts` (read 2026-11-17) | The reference adapter's starting posture would differ. | High |
| The delivered merge transaction lands through the local git seam and never calls a provider merge endpoint. | FACT | `packages/core/src/domain/merge-transaction.ts` (read 2026-11-17); GH-338 pm-notes | Provider-side merge would not be new surface. | High |
| `PipelineJob` has no timing and `traceEvidence` carries no log body. | FACT | `packages/core/src/contracts/ports.ts` (read 2026-11-17) | The additive extension would be unnecessary. | High |
| The conformance registry/coverage gates pin the closed set exactly and require gap encounters. | FACT | `tests/structure/conformance-coverage.test.ts`; adapter-conformance spec (read 2026-11-17) | Adding an operation would not ripple; it does. | High |
| The deploy-trace read is the delivered bounded adapter-local precedent and excludes log bodies. | FACT | `packages/adapters/src/github/deploy-trace.ts` (read 2026-11-17) | The log-excerpt home would need a different precedent. | High |
| GitHub's `PUT /repos/{owner}/{repo}/pulls/{number}/merge` accepts `merge_method`, `commit_title`, `commit_message`, and an expected-head `sha`. | ASSUMPTION (documented REST surface; proven by fixture at implementation) | GitHub REST documentation | If a parameter is unavailable, the crafted-message AC degrades to a declared limitation rather than a silent loss. | Medium-High |
| GitHub check runs expose provider-asserted start and completion timestamps (`started_at`, `completed_at`) for completed runs. | ASSUMPTION (documented payload; proven by fixture) | GitHub REST check-runs documentation | If absent, the fields stay absent (truthful) and only the log excerpt survives Q-07's timing clause — the extension loses most of its value, so this is verified first. | Medium |
| GitHub reports "already merged" as a non-2xx refusal rather than a success body. | TO-CONFIRM | Provider behaviour; proven by fixture | The adapter's read-back rule makes the outcome safe either way: a refusal is never treated as success without provider-asserted merged truth. | Low-Medium |
| The exact provider surface for a check's log text (check-run `output` fields versus an Actions job log endpoint) is not settled. | TO-CONFIRM | Provider surfaces | This record fixes the bounded shape and bound, not the surface; the fixture proves which surface the reference adapter reads. | Low-Medium |
| A bounded excerpt is sufficient for failure triage; full archives are out of scope. | FACT (decision input) | GH-338 applied default Q-07 | A need for full archives would require a separate read, not a wider excerpt. | High |
| No delivered port-side consumer reads thread comment bodies; the one body consumer is the platform-CLI-mediated review-feedback flow. | FACT | Consumer scan (read 2026-11-17); routed to [TDR-0034](TDR-0034-review-thread-discussion-bodies-bounded-adapter-read.md) | A named port-side consumer would make an additive core field eligible, which TDR-0034 keeps open as a revisit trigger. | High |

## Mental Models & Techniques Used

- **First principles:** What must be true for a provider-side landing to be safe and honest? It must be declareable, separately nameable, guarded against a moved head, and replay-safe. All four are operation-level properties, which is why merge cannot be a field or a variant of a content write.
- **Inversion:** What makes this change fail? Log text in the contract, a derived duration, an overloaded write operation, an undeclared destructive capability, and a conformance suite that passes vacuously. Each is excluded by C-2, C-3, C-6, C-7, and C-4.
- **Second-order thinking:** Adding one operation forces every adapter to take a position, the registry to grow a step, the coverage gates to update, and every future adapter to declare or gap it. That cost is paid once here and is cheaper than a per-adapter side channel that the parity suite cannot see.
- **Systems thinking:** The timing fields land in `PipelineRun`, which verify, merge, status, and doctor already read; putting them elsewhere would force four consumers to learn a provider-specific detail.
- **Least privilege / minimal surface:** two optional timestamps, one operation, one bounded read — no `PipelineJobDetail` type, no new read operation, no caller-tunable excerpt bound.
- **Paved road:** ADR-0004/ADR-0006/TDR-0008 for additive contract shape; deploy-trace for bounded adapter-local evidence.
- **Reversibility:** the two optional timestamps are removable until a consumer relies on them; the operation member is effectively permanent once adapters declare it, so its semantics are stated narrowly now.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 additive | C-2 capability honesty | C-3 distinct landing | C-4 conformance | C-5 no new transport | C-6 evidence bounded | C-7 truthful absence | C-8 provider-neutral | C-9 AC satisfiable |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-1 new operation + timing fields + bounded local log read (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 fold merge into `write-delivery-request` | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 adapter-local merge writer outside the closed set | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 new operation + core `PipelineJobDetail` with inline log excerpt | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-5 new operation + adapter-local timing only | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception.

### Alternative 0 — Do Nothing / Keep Both Gaps and No Timing or Log Surface

- **Eligibility:** Not eligible (fails C-9).
- **Summary:** Leave `ADAPTER_OPERATIONS` at eight, keep provider-side merge undeclared, keep `PipelineJob` as `{ jobName, jobState }`, and treat failure evidence as the existing `traceEvidence` link.
- **Constraint compliance:** Passes C-1…C-8 trivially; fails C-9 because a crafted squash landing, failure-job timing, and bounded log evidence cannot be delivered or parity-tested.
- **Driver fit:** Fails drivers 2 and 6: the adapter stays a read-mostly reference and offers no failure-triage evidence.
- **Pros:** Zero contract change, zero ripple, zero new secret surface.
- **Cons:** EC-2 unmet; the reference adapter stops being the reference; Q-07's depth default is unachievable.
- **Why rejected:** It fails the story's own acceptance criteria.

### Alternative 1 — New `merge-delivery-request` Operation + Additive Timing Fields + Bounded Adapter-Local Log Read (chosen)

- **Eligibility:** Eligible.
- **Summary:** Add `merge-delivery-request` to the closed set (squash only, crafted commit title/message, optional expected-head guard, already-merged treated as observed success after a read-back); add optional `startedAt`/`completedAt` to `PipelineJob`; add one bounded adapter-local log-excerpt read with a fixed declared cap.
- **Constraint compliance:** Passes all of C-1…C-9 (matrix above).
- **Driver fit:** Best on every driver: one honest destructive operation (1), a complete reference bar (2), narrow guarded semantics (3), two optional scalars plus one bounded read (4), one deliberate ripple (5), bounded and non-persisted evidence (6), paved-road precedent (7).
- **Pros:** Each capability lands where its consumer already reads; the conformance suite can exercise all three; GitLab/Jira can declare precise gaps; no bulk text in the contract.
- **Cons:** The closed set grows to nine and the registry gains a step; the conformance runner must learn three new write mappings; one provider implements merge first; the excerpt adds a redaction obligation.
- **Why chosen:** It is the only eligible option that satisfies C-9 without overloading a content write, hiding a destructive capability, or putting log text in the contract.

### Alternative 2 — Fold Merge into `write-delivery-request`

- **Eligibility:** Not eligible (fails C-2 and C-3).
- **Summary:** `write-delivery-request` would mean create/update/land; no new closed operation; GitHub implements all three; the two remaining GitHub gaps close with one operation.
- **Constraint compliance:** Fails C-3 (a content write acquires destructive landing semantics) and C-2 (a provider that can create but cannot merge can no longer express the difference: it must either lose create or misreport merge).
- **Driver fit:** Fails drivers 1 and 3 outright; attractive only on driver 5 (no closed-set growth).
- **Pros:** No closed-set change; no registry step.
- **Cons:** A lying capability declaration; arguments become a union of unrelated intents; the destructive path loses its own guard/replay story; GitLab and Jira gap reasons become ambiguous.
- **Why rejected:** It is the exact overload TDR-0008 rejected for a non-destructive write; it is worse for a destructive one.

### Alternative 3 — Adapter-Local `createGitHubMergeWriter` Outside the Closed Set

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Follow the deploy-trace pattern: export a GitHub-only merge writer beside the client and document it as reference behavior, leaving `ADAPTER_OPERATIONS` untouched.
- **Constraint compliance:** Fails C-2 — a destructive capability that no capability declaration can express is invisible to the conformance suite and to every consumer's gap handling; the deploy-trace precedent covers a supplemental *read*, not a write.
- **Driver fit:** Fails drivers 1, 2, and 5's intent (no ripple, but at the cost of unprovable parity).
- **Pros:** Smallest contract footprint; no registry churn; fast.
- **Cons:** Parity suite cannot see merge; GitLab's later merge lands on a different footing; consumers must branch on provider to discover the capability (also against C-8).
- **Why rejected:** It converts the reference implementation's most important capability into an undeclared side channel.

### Alternative 4 — New Operation Plus a Core `PipelineJobDetail` Type with an Inline Bounded Log Excerpt

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** Introduce a richer core job-detail contract carrying timing and the excerpt, returned by a new read, so consumers get everything in one shape.
- **Constraint compliance:** Fails C-6 — log text enters a core contract; fetching it per job turns a bounded read into a fan-out of unbounded reads; persisted or cached copies would carry log text into state.
- **Driver fit:** Good on drivers 4 and 6 (one shape; the excerpt arrives inline) but fails C-6 decisively, and serves driver 2 only superficially.
- **Pros:** One type to consume; timing and evidence arrive together.
- **Cons:** Bulk text in the normalized contract; read amplification per job; a much larger redaction and persistence surface; a new read surface that duplicates `read-pipeline-run`.
- **Why rejected:** It puts the highest-risk payload in the most widely consumed tier.

### Alternative 5 — New Operation Plus Adapter-Local Timing Only (Zero Core Change Beyond Merge)

- **Eligibility:** Not eligible (fails C-8).
- **Summary:** Keep `PipelineJob` unchanged; expose timing through a GitHub-only closed shape.
- **Constraint compliance:** Fails C-8 — verify, merge, status, and doctor would each need provider-aware code to render a duration, and GitLab parity would be adapter-specific.
- **Driver fit:** Strong on drivers 4 and 5; fails driver 2, because parity becomes adapter-specific.
- **Pros:** Smallest possible contract change for timing.
- **Cons:** Consumer branching on provider kind; parity unprovable in a provider-neutral way.
- **Why rejected:** The ports exist precisely so consumers do not learn provider identities.

## Decision

- **Decision:** Adopt ALT-1. Three additive elements, no schema-version bump, no migration, plus two explicit non-decisions.

### 1. New closed operation `merge-delivery-request`

- **Added to `ADAPTER_OPERATIONS`:** `"merge-delivery-request"` — "land one delivery request on the provider with a squash strategy and caller-supplied commit metadata".
- **Canonical arguments:** `{ deliveryRequest: ProviderQualifiedIdentity, strategy: "squash", commitTitle?: string, commitMessage?: string, expectedHeadSha?: string }`.
- **Outcome:** `ProviderWriteResult<{ readonly mergeCommitSha?: string }>`. Absent `mergeCommitSha` means the provider did not supply the landing commit (unknown) — never derived, never defaulted.
- **Semantics (narrow by construction):**
  - `strategy` is `"squash"` only in v1; rebase/merge-commit strategies, force, branch-protection bypass, auto-merge, and merge queues are not representable.
  - `commitTitle` / `commitMessage` are the squash commit's title and message. The delivery request's own title/body remain `write-delivery-request`'s business: that operation stays a **content** write and never lands.
  - `expectedHeadSha` is a guard: when supplied, a provider that rejects the guard is a classified refusal and the adapter never overrides it. Callers that land a request SHOULD supply it.
  - **Already-merged is an observed success, determined by read-back.** A provider refusal that says "already merged" is never trusted on its own: the adapter re-reads the delivery request and returns success only when the provider asserts merged truth; otherwise the classified failure stands. This mirrors the delivered landing-verification discipline.
  - No retry: a merge is at-most-once per invocation and a failed call is a classified failure, never a re-issue.
- **Adapter posture:** GitHub supports it (one provider merge call over the existing injected transport). GitLab declares `adapter-not-implemented` (M3-S3 delivers it). Jira declares `provider-unsupported`. GitHub's two remaining gaps (`write-comment`, `write-delivery-request`) close in the same change, leaving the reference adapter at nine supported operations and zero gaps.

### 2. Additive optional job timings on `PipelineJob`

- **Added:** `readonly startedAt?: string` and `readonly completedAt?: string`, each the provider-native timestamp copied verbatim as an ISO-8601 UTC string; absent means the provider did not supply the signal, so the value is unknown.
- **Not added:** `durationMs`. GitHub supplies no provider-asserted duration, so a `durationMs` field would be derived for the only adapter that could populate it — a fabricated fact under C-7. A span is computable by a consumer from two provider-asserted timestamps; a provider that supplies a native duration adds `durationMs` later in its own additive round (revisit trigger).
- **No temporal logic enters the contracts tier:** the fields are types only; no clock, no arithmetic, no derivation.

### 3. Bounded adapter-local log-excerpt read

- **Home:** the `./github` subpath, beside the delivered deploy-trace reader, following its pattern exactly (one bounded read, closed provider-neutral shape, no new closed operation, no schema bump).
- **Shape:** `{ jobId: string; excerpt: string; truncated: boolean; byteLength: number }`. `excerpt` is a faithful byte prefix of the provider's log text — no inserted marker (the renderer adds the visible marker), so `truncated` is the authority. `byteLength` is the returned excerpt's byte length, making the evidence measurable.
- **Bound:** one declared fixed cap of 8192 bytes, with no caller override (the bound is a property of the reference behavior, not a call-site choice). No pagination, no retry, no archive download, no tail-follow.
- **Classification:** 404 is the adapter-local not-found read result; any other non-2xx and any transport failure is `provider.payload.invalid`; a 2xx with empty text is an observed empty excerpt, not a failure.
- **Secret discipline:** the excerpt is never persisted in state, never written into the conformance artifact, and is redacted at the existing rendering chokepoint before any human surface. Full log archives stay out of scope.
- **Surface choice is open:** whether the reference adapter reads a check run's `output` text or an Actions job log endpoint is `TO-CONFIRM`; the closed shape, the cap, and the classification above are fixed here so the surface can be chosen against a fixture without reopening the decision.

### 4. Explicit non-decision — the merge transaction is not rewired

This record adds the provider-side capability; it does **not** change `packages/core/domain/merge-transaction.ts`, which keeps landing through the local git seam. Two merge mechanisms therefore coexist temporarily. Reconciling them is a separate decision (revisit trigger), and no part of this record may be read as authorizing a silent switch of the lifecycle merge path.

### 5. Explicit non-decision — review-thread comment bodies

Threaded-discussion *bodies* and replies are not added to the normalized contract by this record. `DeliveryThread` stays as delivered, and [TDR-0034](TDR-0034-review-thread-discussion-bodies-bounded-adapter-read.md) decides the content as a bounded adapter-local evidence read alongside the log-excerpt read — evidence, not lifecycle truth.

- **Rationale (tied to drivers):** Each element lands where its consumer already reads, so no consumer learns a provider identity (driver 2, C-8). Capability granularity is preserved — one honest name per capability that actually differs (driver 1, with C-2 and C-3 as the gates). The destructive action gets its own name, guard, and read-back rule (driver 3). The additive surface is two optional scalars plus one bounded read (driver 4). The closed-set ripple is paid once, in this change, with the registry (driver 5, C-4). Evidence buys the most triage signal per byte (driver 6) while the highest-risk payload stays out of the contract (C-6). Every element follows a delivered precedent (driver 7).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review; this record stays `Proposed` until then.
- **Conditions for revisit:** See `revisit_triggers`; notably a provider-native duration, a merge-transaction revision, and any need for thread bodies.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-9. No accepted-risk exceptions are taken.

Three consequences are recorded rather than treated as exceptions:

- Adding a member to a closed union intentionally fails exhaustive consumers at compile time; the registry, coverage gates, capability declarations, mock routes, and expected projections are updated in the same change (C-4).
- The reference adapter becomes capable of a destructive provider-side landing while the lifecycle merge path still uses the local git seam; the coexistence is stated, bounded, and carries its own revisit trigger rather than being left implicit.
- `write-comment` becoming supported with empty carrier arrays turns the comment-provenance carrier-roundtrip step into a `capability-absent` skip (the delivered runner behaviour) instead of a `declared-gap` skip; envelope carriers remain out of scope here.

## Trade-offs & Consequences

### Positive Outcomes

- The reference adapter's destructive capability is declareable, parity-testable, and visible to consumers' gap handling.
- `write-delivery-request` keeps one meaning (content), so a provider that creates but cannot merge stays honestly representable.
- Failure triage gets provider-neutral timing at the granularity the normalization already uses (one run, one job) and bounded log evidence without dragging logs into the contract.
- GitLab and Jira can take precise positions on all three surfaces the day they land.
- No schema-version bump, no migration, and no new transport, credential, or network location.

### Negative Outcomes

- The closed operation set grows to nine, so every adapter takes a position, the registry gains a step, coverage gates change, and the conformance runner must learn three new write mappings.
- The operation member is effectively permanent once adapters declare it; only the narrow semantics stated here keep it honest.
- Two merge mechanisms coexist until a deliberate reconciliation decision.
- The log excerpt introduces a new secret-leak surface; bounding, non-persistence, and redaction reduce but do not eliminate it.
- `durationMs` is deliberately absent, so a consumer that wants a single number must compute it, and GitLab's native duration will need a later additive round.
- Timing adds two fields to every conformance expected projection for pipeline-run steps, widening fixtures that were exact-equality before.

### Unresolved Questions

- [ ] Exact GitHub merge response shape, the status code used for an already-merged refusal, and the guard-rejection shape — proven by fixtures; the read-back rule makes the outcome safe in every variant (owner: `@coder`, GH-338 delivery).
- [ ] Exact check-run timing field names and whether an incomplete run ever carries a completion timestamp (owner: `@coder`; absence stays truthful).
- [ ] Which provider surface supplies the bounded log text for a check (check-run `output` versus an Actions job log endpoint), and whether that surface exists for every check run (owner: `@coder`; an absent surface is `provider.not-found`, never an empty success).
- [x] **Review-thread comment bodies and replies — decided in [TDR-0034](TDR-0034-review-thread-discussion-bodies-bounded-adapter-read.md).** Bodies stay out of the core contract and are served by one bounded per-thread adapter-local read (50 comments, 4096 bytes per body, explicit truncation), matching this record's evidence-tier principle. Consequences: no closed-operation change, no `DeliveryThread` reshape, no conformance projection re-widening, and GitLab/Jira take an explicit parity position on the reference behavior.
- [ ] When, and whether, the lifecycle merge path adopts provider-side merge (owner: the merge-capability change; a separate record).

## Implementation Plan

1. **Contracts.** Add `"merge-delivery-request"` to `ADAPTER_OPERATIONS`; add optional `startedAt`/`completedAt` to `PipelineJob`. Keep the tier types-plus-`as const` only; no derivation, clock, or I/O.
2. **Capability declarations.** GitHub adds `merge-delivery-request`, `write-comment`, and `write-delivery-request` to `supportedOperations` and leaves no gaps; GitLab declares `merge-delivery-request` as `adapter-not-implemented`; Jira declares it `provider-unsupported`. Preserve every other declaration.
3. **Adapter writes.** GitHub implements `writeComment` (carrier-free human text in v1 — no envelope carrier is claimed), `createDeliveryRequest`/`updateDeliveryRequest` (content only), and `mergeDeliveryRequest` (squash, crafted commit title/message, optional head guard, already-merged read-back, no retry) over the existing injected transport and credential port.
4. **Normalization.** Populate `startedAt`/`completedAt` verbatim when the payload supplies them; omit otherwise; never synthesize.
5. **Log excerpt read.** Add the bounded reader beside the deploy-trace reader with the fixed 8192-byte cap, the closed shape, and the classification above; export it additively from `./github`.
6. **Conformance.** Append a `merge-delivery-request` step to the change-lifecycle flow so the registry still represents the whole closed set; add the merge route and expected projection to the GitHub tenant; extend the structural and runtime coverage gates to nine operations; add the three new write mappings to the runner's operation-to-member dispatch; keep the live tier's read-only posture (a supported non-read step stays a `live-read-only` deferral).
7. **Tests.** Merge round-trip, crafted title/message pass-through, guard rejection, already-merged replay, non-2xx classification; timing present/absent pairs; excerpt bound, truncation, empty, 404, non-2xx, redaction, and no-persistence; capability-parity and gap-reason tests; conformance re-run determinism.
8. **Docs.** Reconcile `feature-adapter-ports.md` (closed set, `PipelineJob` row, additive-extension section), `feature-provider-client-seeds.md` (capability table, operation list, GitHub normalization, trap catalog minima, QA table), `feature-adapter-conformance.md` (flow table and operation set), and `feature-merge-verify-deploy.md` (the coexistence statement); add the reference-behavior section the story's AC requires; update the decision index.

## Verification Criteria

- Metric: contract inventory — `ADAPTER_OPERATIONS` is exactly nine members including `merge-delivery-request`; `PipelineJob` carries exactly two new optional fields; `pnpm typecheck` green — Target: exact — Window: GH-338 CI.
- Metric: conformance coverage — the registry's operation set equals the closed set exactly, every supported operation executes against the mock tenant, and every declared gap is encountered with its reason — Target: 100% — Window: GH-338 CI, offline.
- Metric: capability parity — GitHub: nine supported, zero gaps; GitLab and Jira: `merge-delivery-request` declared with the stated reason; supported plus gaps cover the closed set for all three — Target: exact — Window: GH-338 CI.
- Metric: merge semantics — crafted commit title/message survive the round-trip; a guard rejection refuses without landing; an already-merged replay returns success only when provider-asserted merged truth is read back; no call is retried — Target: ≥1 case per behaviour — Window: GH-338 CI.
- Metric: truthful timing — present timestamps round-trip verbatim; absent stays absent in the normalized view and in the fixture projection; no derived duration appears — Target: 100% — Window: GH-338 CI.
- Metric: bounded evidence — excerpt never exceeds the declared cap, `truncated` is set exactly when the provider text exceeded it, empty text is an observed empty excerpt, and the excerpt never appears in persisted state or the conformance artifact — Target: 100% — Window: GH-338 CI.
- Metric: boundary and secret invariants — no new secret-read allowlist entry, no new transport or network location, no provider-native type crossing a subpath — Target: unchanged — Window: GH-338 CI.

## Confidence Rating

**High** for the additive shape, the closed-set mechanics, and the conformance ripple: the current contract, capabilities, registry invariant, and coverage rules are verified in the delivered source, and two prior records establish the additive precedent. **Medium** for the provider's exact merge and timing payloads and for the log surface, all of which are `TO-CONFIRM` against fixtures; the decision is shaped so each unknown degrades truthfully (absent timing, declared gap, not-found log read) rather than fabricating a value.

## References

- GH-338 change workspace (clarify-scope decisions, applied defaults Q-03/Q-04/Q-07, current-state facts, doc-impact risks): `doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml`
- M3 blueprint — EC-2/EC-4, M3-S4 tasks and AC, M3-S5 parity suite: `doc/planning/oss-tooling/milestones/m3/README.md`
- M3 contracts proposal — `TrackerPort` primitives `review.create`/`review.update`/`review.merge`, capability matrix, conformance: `doc/planning/oss-tooling/milestones/m3/contracts.md`
- M3 answered questions — OQ-M3-04, OQ-M3-05 (threaded discussions, squash merge with crafted metadata, checks/log/timing), OQ-M3-09 (offline CI): `doc/planning/oss-tooling/milestones/m3/open-questions.md`
- Delivered contracts: `packages/core/src/contracts/adapter-capabilities.ts`, `packages/core/src/contracts/ports.ts`
- Delivered GitHub slice and bounded-read precedent: `packages/adapters/src/github/capabilities.ts`, `packages/adapters/src/github/deploy-trace.ts`
- Conformance registry and gates: `packages/testkit/src/conformance/flows.ts`, `tests/structure/conformance-coverage.test.ts`
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier rules, contracts neutrality, no parallel adapter surface
- [ADR-0004](ADR-0004-workitem-activity-timestamp-additive-v1.md) — additive optional timestamp, absent-means-unknown
- [ADR-0006](ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) — optional field representation and comment-set absence
- [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive operation member precedent and the rejection of overloading a write operation
