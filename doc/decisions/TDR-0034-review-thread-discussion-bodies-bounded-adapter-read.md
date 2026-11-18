---
id: TDR-0034
decision_type: tdr
status: Proposed
created: 2026-11-17
decision_date: null
last_updated: 2026-11-17
summary: "Review-thread discussion bodies are evidence, not lifecycle truth: they stay out of the normalized core contract and are served by one bounded, adapter-local GitHub read (per-thread, 50 comments, 4096 bytes per body, explicit truncation), exactly as log excerpts are — so DeliveryThread stays body-free, no closed operation is added, and no conformance projection widens."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider adapters (GitHub reference adapter) and core adapter contracts"
decision_scope: repo
review_date: null
business_impact: "The GitHub reference adapter can show what a review discussion actually said without widening the lifecycle contract that every adapter and every consumer must satisfy, so M3 parity stays comparable on lifecycle facts and evidence stays bounded."
customer_impact: "Operators and review-feedback tooling can read the discussion behind a review thread through one declared, bounded surface instead of scraping platform output, while the normalized PR view still never carries arbitrary discussion text."
classification:
  domains: [architecture, contracts, privacy, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-338: TDR-0033 recorded this as an unrouted decision and the GH-338 specification cannot start until it is settled)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis and this record)"
    - "@pm (GH-338 clarify_scope: thread reads exist over GraphQL, per-thread bodies and pagination absent)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-338 PR review — this record fixes reference behavior GitLab and Jira will be compared against)"
  performers:
    - "@coder (GH-338 delivery: the bounded reader, its closed shape, fixtures, and the new behaviour tests)"
    - "@doc-syncer (provider-client-seeds reference behavior, adapter-ports evidence note, conformance scope note)"
  informed:
    - "M3-S3 GitLab code-host adapter (GH-337) — the same reference behavior, or a declared absence"
    - "M3-S5 adapter conformance and parity suite (GH-339)"
    - "@review-feedback-applier flow owners (the agent that consumes review comment bodies today through the platform CLI)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A lifecycle engine (not a tooling flow) needs discussion bodies to make or gate a decision: that is a new additive core decision with a named consumer, and it must not be inferred from this record."
  - "Review-feedback application moves from the platform-CLI Operations Reference onto the adapter ports: re-derive the needed shape (bodies, replies, diff hunks, review summaries) as one consumer-driven decision rather than growing this read piecemeal."
  - "Truncation at 50 comments or 4096 bytes per body is observed to lose material review content often enough to matter: raise the bound deliberately, or add per-thread pagination as its own decision, never as a caller override."
  - "A provider's thread read exposes author identity fields this shape does not carry: add them only with the delivered fail-closed author-kind discipline."
links:
  related_changes: ["GH-338"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml"
    - "doc/spec/features/feature-adapter-ports.md"
    - "doc/spec/features/feature-provider-client-seeds.md"
    - "doc/spec/features/feature-adapter-conformance.md"
    - "doc/spec/features/feature-closeout.md"
  contracts:
    - "packages/core/src/contracts/ports.ts"
    - "packages/adapters/src/github/client.ts"
    - "packages/adapters/src/github/deploy-trace.ts"
  diagrams: []
  decisions: ["ADR-0004", "ADR-0006", "TDR-0033"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S4", "M3-S3", "M3-S5"]
---

# TDR-0034: Review-Thread Discussion Bodies — A Bounded Adapter-Local Read with the Core Contract Left Body-Free

## Context

- **FACT:** `DeliveryThread` is exactly `{ threadId, resolved, commentCount, authorLogin?, authorKind?, authorAssociation? }` — no comment text, no replies (`packages/core/src/contracts/ports.ts`, read 2026-11-17).
- **FACT:** The delivered GitHub thread read is one GraphQL query that requests `reviewThreads(first: 100) { nodes { id isResolved comments(first: 1) { totalCount nodes { author { login __typename } authorAssociation } } } }` — it deliberately fetches one comment *node* for the root author and never requests `body` (`packages/adapters/src/github/client.ts`, read 2026-11-17).
- **FACT:** GitLab's thread normalization reads its `notes` array only to derive a count (`Array.isArray(notes) ? notes.length : comment_count`) and discards the note bodies it already receives (`packages/adapters/src/gitlab/normalize.ts`, read 2026-11-17).
- **FACT:** The closeout thread policy is body-free by construction: it resolves only non-human threads and leaves human threads as identity-only residue; `TC-CAP-031` asserts with a `SECRET-REVIEW-BODY-CANARY` that the plan residue carries a thread id and author but no review body (`packages/core/src/domain/closeout-thread-policy.ts`, `tests/behaviour/providers/github-closeout-thread-privacy.test.ts`, read 2026-11-17).
- **FACT:** `createGitHubDeployTraceReader` is the delivered precedent for a bounded, adapter-local read behind the existing ports: one bounded read, a closed provider-neutral shape, no new closed operation, no schema bump, and explicitly "No log bodies" (`packages/adapters/src/github/deploy-trace.ts`, read 2026-11-17).
- **FACT:** `@review-feedback-applier` reads review comments today through the platform Operations Reference in `.ai/agent/pr-instructions.md` (platform CLI/MCP commands) and merges inline comments, issue comments, and reviews into a local `threads-snapshot.json` — not through the adapter ports (`.opencode/agent/review-feedback-applier.md`, read 2026-11-17).
- **FACT:** ADR-0006 C-2 requires a *named consumer cited in the record* before a new or reshaped core contract element is added; the same record rejected an untyped custom-field bag for exactly this reason (`doc/decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md`, read 2026-11-17).
- **FACT:** The adapter conformance suite pins its registry to the closed operation set and executes supported writes through the client's write members; the deploy-trace and merge reads sit outside the three-flow registry today, and expected projections are exact-equality fixtures (`doc/spec/features/feature-adapter-conformance.md`, `packages/testkit/src/conformance/flows.ts`, read 2026-11-17).
- **FACT:** The provider subpaths export an exact, test-pinned surface: `tests/structure/provider-surface.test.ts` holds `EXPECTED_SURFACE` per provider, and `tests/structure/content-inventory.test.ts` holds a per-file executable-export allowlist (read 2026-11-17).
- **FACT:** The single serialization/redaction chokepoint every human-facing payload passes is `packages/cli/src/output/serialize.ts` (`doc/spec/features/feature-audit-ledger.md`, read 2026-11-17).
- **FACT:** TDR-0033 recorded this question as an explicit non-decision with an unrouted item, recommending either an additive optional `comments?` array with a per-thread cap or a bounded adapter-local read (`doc/decisions/TDR-0033-github-adapter-completion-contract-extensions.md` §5, Unresolved Questions, read 2026-11-17).
- **FACT:** GH-338's scope line names "PRs with threaded discussions and resolution"; resolution and thread metadata are delivered, and thread bodies were never named as an acceptance criterion (`doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml`, read 2026-11-17).

## Problem Framing (Clarified)

The question is not "can we read comment bodies" — the provider already hands GitLab the notes and would hand GitHub the bodies for one more GraphQL field. The question is **which tier discussion text belongs to**, because that choice decides who must honor it forever:

1. **Lifecycle truth tier (core contracts).** Everything in `DeliveryRequest` is consumed by closeout, status, brief, verify, and the conformance projections. Text placed there becomes an obligation for every adapter, every consumer, every fixture, and every future provider — including providers that cannot supply it.
2. **Evidence tier (adapter-local bounded read).** Log excerpts already live here. The read is per-invocation, bounded, non-persisted, never part of the parity registry, and explicitly not a lifecycle fact.

Thread *metadata* is lifecycle truth: resolution state gates closeout's write, the author kind gates whether a human's thread may be auto-resolved, and the comment count is a fact consumers can truncate against. Thread *bodies* are evidence: no delivered engine decides anything from them, and the one flow that consumes them today (review-feedback application) reaches them through the platform CLI, not through the ports.

The second-order consequence decides the matter. If bodies enter the contract, then either every adapter populates them (Jira has no review-thread surface at all; GitLab could, GitHub could) or the field is systematically absent for one provider — and an absent-by-policy field is indistinguishable, by construction, from an omitted-for-pagination one. The absence rule that makes `WorkItem.comments` honest (absent = unknown) becomes a permanent ambiguity. An adapter-local read has no such obligation: it exists for the provider that has the surface, and its absence elsewhere is a documented reference-behavior gap rather than a contract-wide unknown.

## Constraints (Hard Requirements)

### C-1: No new or reshaped core contract element without a named consumer

- **Statement:** Adding or reshaping a core contract element requires a consumer named in this record that reads it through the adapter ports; a tooling flow reading through the platform CLI does not qualify.
- **Source:** ADR-0006 C-2 (prior decision); adapter-ports bounded-catalogue discipline.
- **Verification:** Design review of the record's named-consumer citation; contract-inventory diff shows no core field added.
- **Negotiable:** no.

### C-2: Truthful absence and measurable truncation

- **Statement:** Any discussion read must distinguish "not fetched" from "provider-asserted empty", and must make truncation measurable by the consumer; it never returns an empty collection to mean "unknown", and never presents a truncated set as complete.
- **Source:** ADR-0004 / ADR-0006 absence rule; TDR-0033 C-7.
- **Verification:** Paired present/absent/empty/truncated fixtures; type-level optionality; assertions on the truncation signal.
- **Negotiable:** no.

### C-3: Bounded evidence, never persisted, never captured

- **Statement:** Comment text is bounded by one declared fixed cap with no caller override, is never written to persisted state, never written into the conformance artifact, never paginated in a follow loop, and passes the single redaction chokepoint before any human surface.
- **Source:** Deploy-trace precedent ("No log bodies"); TDR-0033 C-6; redaction chokepoint (result contract).
- **Verification:** Test — bound and truncation assertions, no-persistence assertion, no-artifact assertion, redaction assertion.
- **Negotiable:** no.

### C-4: No new transport, credential, or network location

- **Statement:** The read rides the existing injected `ProviderTransport` and `CredentialPort`; no secret-read allowlist entry is added and no new network edge exists.
- **Source:** ADR-0005; provider-client-seeds construction rules.
- **Verification:** Test — secret-read invariant count unchanged; no new transport module; boundary review.
- **Negotiable:** no.

### C-5: No provider-native type crosses the subpath

- **Statement:** The returned shape is a closed, provider-neutral type; no raw GraphQL/response type, `any` escape, or parallel view type is exported.
- **Source:** ADR-0005; `tests/structure/provider-surface.test.ts` (TC-SURFACE-001).
- **Verification:** Test — pinned surface equality; native-shape name scan.
- **Negotiable:** no.

### C-6: Body text carries no write authority

- **Statement:** No resolution, transition, label, merge, or closeout write may be decided from discussion text; write decisions keep using the delivered normalized metadata (resolution flag, author kind, association) and the delivered policies.
- **Source:** Closeout human-thread policy; TC-CAP-031; fail-closed authorship normalization.
- **Verification:** Code review of every write path; a test asserting the thread-resolution decision ignores bodies when a body contradicts the author kind.
- **Negotiable:** no.

### C-7: Story and parity obligations remain satisfiable

- **Statement:** The reference behavior must be documentable in the adapter contract and comparable across adapters, and GH-338's acceptance criteria must remain achievable without widening the contract.
- **Source:** GH-338 AC; M3 EC-2/EC-4.
- **Verification:** Reference-behavior document plus offline fixtures executing the new read through the production reader.
- **Negotiable:** no.

### C-8: Pinned structural surfaces update in the same change

- **Statement:** Any new executable export updates the content-inventory allowlist and the provider-surface expectation list in the same change; the suite must never pass by being vacuous.
- **Source:** `tests/structure/content-inventory.test.ts`; `tests/structure/provider-surface.test.ts`.
- **Verification:** Test — exact-name equality in both suites.
- **Negotiable:** no.

## Decision Drivers

1. **Evidence value per byte.** A reader exists to answer "what did the reviewer actually say" with the least payload that answers it.
2. **Contract surface discipline.** The normalized view is lifecycle truth; every field added there is a permanent obligation for every adapter and consumer.
3. **Consumer proximity.** The only current consumer of bodies reaches them through the platform CLI; a future adapter-mediated consumer should find a surface it can adopt, not a half-populated contract field.
4. **Paved road.** The deploy-trace bounded read is delivered, reviewed, and outside the parity registry; novelty must justify itself.
5. **Parity honesty.** GitLab and Jira must be able to take an explicit position (same behavior, or declared absence) rather than inherit an unkeepable contract field.
6. **Truncation and absence clarity.** A consumer must be able to tell "provider said nothing" from "we stopped reading".
7. **Reversibility and cost.** An adapter-local read can be changed or withdrawn; a contract field cannot.

*(Overlap check: boundedness, non-persistence, absence truthfulness, and no-write-authority are gates (C-2, C-3, C-6) and appear here only as ranking values — "how much evidence per byte" and "how clearly truncation is signalled". The gates decide eligibility; the drivers rank survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-338: the specification is blocked on this question).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (scope and the delivered thread-read findings); `@decision-advisor` (analysis and record); `@spec-writer` (carry the shape into the change spec).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-338; the owner for final acceptance.
- **Performers:** `@coder` (reader, fixtures, tests, structural-surface updates); `@doc-syncer` (reference behavior and adapter-conformance scope note).
- **Informed:** M3-S3 GitLab adapter (GH-337), M3-S5 conformance suite (GH-339), and the review-feedback flow owners.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| `DeliveryThread` carries no comment text and no replies. | FACT | `packages/core/src/contracts/ports.ts` (read 2026-11-17) | The additive-contract option would be unnecessary. | High |
| The delivered GitHub thread query requests one comment node for author facts and never requests `body`. | FACT | `packages/adapters/src/github/client.ts` (read 2026-11-17) | Bodies might already be available without a new surface. | High |
| GitLab already receives note bodies and deliberately keeps only a count. | FACT | `packages/adapters/src/gitlab/normalize.ts` (read 2026-11-17) | Body-free is a stance, not a provider limitation. | High |
| Closeout's thread residue is body-free and canary-tested. | FACT | `github-closeout-thread-privacy.test.ts`; `closeout-thread-policy.ts` (read 2026-11-17) | A body-free core would contradict a delivered privacy invariant. | High |
| The deploy-trace reader is a delivered bounded, adapter-local, non-registry read. | FACT | `packages/adapters/src/github/deploy-trace.ts` (read 2026-11-17) | The evidence-tier option would need a different precedent. | High |
| No delivered lifecycle engine reads discussion bodies; the one body consumer is the platform-CLI-mediated review-feedback flow. | FACT | Consumer scan of `packages/core/src`, `packages/cli/src`, `.opencode/agent/review-feedback-applier.md` (read 2026-11-17) | A named core consumer would make the additive contract option eligible. | High |
| The conformance registry executes the closed operation set and expected projections are exact-equality. | FACT | `doc/spec/features/feature-adapter-conformance.md`; `packages/testkit/src/conformance/flows.ts` (read 2026-11-17) | A core field would not widen fixtures, and this record would overstate its cost. | High |
| GraphQL exposes one review thread's comments with bodies, author, actor type, association, and a total count, reachable either by node id or by filtering the pull request's threads. | ASSUMPTION (documented surface; proven by fixture at implementation) | GitHub GraphQL documentation | If no per-thread surface exists, the read falls back to the request-scoped variant (ALT-3) without reopening the decision — the shape, the caps, and the classification are unchanged. | Medium-High |
| Provider thread comments are returned oldest-first and stably enough that a bounded prefix is a faithful prefix. | ASSUMPTION (proven by fixture) | Provider behaviour | A different order would make "the first N" less useful but not untruthful, because the returned count and truncation signal are explicit. | Medium |
| A 50-comment / 4096-byte-per-body bound covers ordinary reviews without material loss. | ASSUMPTION | Delivery-review norms in this repository | Under-provisioned bounds show up as visible truncation, not as silent loss; the revisit trigger raises them deliberately. | Medium |

## Mental Models & Techniques Used

- **First principles:** What is a review body *for*, and who must honor it? It explains a human's intent; only the flow that applies feedback consumes it. That is an evidence consumer, not a lifecycle engine, which is the same test log excerpts failed.
- **Inversion:** How does this change fail? Arbitrary text in the most widely consumed contract, a required field one provider can never populate, a silent truncation, a resolution decided from body content, and fixtures that capture review text. C-1, C-2, C-3, and C-6 exclude each.
- **Second-order thinking:** A core field makes absence permanently ambiguous across three adapters and freezes the shape before its consumer exists. An adapter-local read keeps the shape changeable until a real consumer names what it needs.
- **Systems thinking:** Bodies sit beside the thread metadata they annotate; the metadata stays in the contract because closeout's write path reads it, and the text stays outside because nothing writes from it.
- **Least privilege:** one read, one thread at a time, two fixed caps, no caller knobs.
- **Paved road:** deploy-trace for bounded evidence; ADR-0006 for the named-consumer rule; ADR-0004 for truthful absence.
- **Reversibility:** the reader can be withdrawn or reshaped additively; a core field cannot be removed once adapters populate it.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 named consumer | C-2 absence/truncation | C-3 bounded evidence | C-4 no new edge | C-5 no native type | C-6 no write authority | C-7 AC satisfiable | C-8 surfaces updated |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 count-only, bodies out of scope | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 per-thread bounded adapter-local read (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 additive optional `comments?` on `DeliveryThread` | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 request-scoped adapter-local read (all threads) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails. ALT-3 is eligible but ranks below ALT-1 on drivers 1 and 6 (see below); ALT-2 is eliminated before ranking.

### Alternative 0 — Do Nothing / Keep Count-Only and Declare Bodies Out of Scope

- **Eligibility:** Eligible (passes C-1…C-8).
- **Summary:** `DeliveryThread` keeps `commentCount` and author facts; the story is read as "threaded discussions *with resolution*", which is delivered; bodies are declared out of scope for this story and for the reference adapter.
- **Driver fit:** Fails drivers 1, 3, and 5: the reference adapter cannot show what a discussion said, a future adapter-mediated consumer has nothing to adopt, and parity on "threaded discussions" is reduced to counts.
- **Pros:** Zero new surface, zero new bound, zero new secret-leak surface.
- **Cons:** The reference implementation for "threaded discussions" is metadata-only, which is a weaker reference than the story's wording suggests; the question would reopen at the next parity round.
- **Why rejected:** It is honest but under-delivers the reference implementation this story exists to establish, at a cost that is one bounded read.

### Alternative 1 — Per-Thread Bounded Adapter-Local Read (chosen)

- **Eligibility:** Eligible.
- **Summary:** Add `createGitHubThreadDiscussionReader` beside the deploy-trace reader in `./github`: one read per thread, a closed provider-neutral shape, fixed caps, explicit truncation, no operation, no contract change.
- **Constraint compliance:** Passes C-1 (no core element added), C-2 (provider-asserted count plus explicit truncation), C-3 (fixed caps, non-persisted, redacted), C-4 (injected transport and credentials), C-5 (closed shape), C-6 (no write path reads it), C-7 (documentable + fixture-tested), C-8 (surface and inventory lists updated in the change).
- **Driver fit:** Best on 1 (consumer fetches only the threads it needs), 2 (no contract field), 3 (adoptable by a future adapter-mediated consumer), 4 (delivered precedent), 5 (GitLab can match it; Jira declares absence), 6 (explicit count + truncation), 7 (withdrawable).
- **Pros:** Smallest payload that answers the question; a consumer can skip resolved threads; no registry, capability, or projection ripple; the shape can change until a real consumer names its needs.
- **Cons:** N reads for N threads (bounded by the delivered 100-thread read); parity is documented rather than machine-enforced; the parity suite cannot see the surface, so behaviour tests are the only guard.
- **Why chosen:** It is the only eligible option that delivers the evidence value the story implies without making every adapter honor arbitrary text.

### Alternative 2 — Additive Optional `comments?` on `DeliveryThread`

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** `comments?: readonly DeliveryThreadComment[]` with the delivered absence rule (absent = not fetched/unknown, present including `[]` = provider-asserted) and a declared per-thread cap, so `comments.length < commentCount` makes truncation visible.
- **Constraint compliance:** Fails C-1 — no adapter-mediated consumer is named: the body consumer today is `@review-feedback-applier`, which reaches comments through the platform CLI. Fails C-3 — the field would appear in every delivery-request conformance expected projection (exact-equality), so review text would be captured in the conformance artifact, and any future persistence of the request view would carry it too.
- **Driver fit:** Strong on 1 and 6; weak on 2 and 5, because the field is a permanent obligation for Jira (no thread surface) and for any provider that cannot supply text.
- **Pros:** One read instead of N; truncation visible against the delivered `commentCount`.
- **Cons:** A permanently ambiguous absent-by-policy field; a widened conformance projection for every provider; review text in the most widely rendered tier; the shape freezes before its consumer exists.
- **Why rejected:** It is the speculative-contract-surface ADR-0006 C-2 rejects, and its cost lands on every adapter while its benefit lands on one flow that does not use the ports.

### Alternative 3 — Request-Scoped Adapter-Local Read (All Threads in One Call)

- **Eligibility:** Eligible.
- **Summary:** One read per delivery request returning every thread with its bounded comment set, so a feedback-classification consumer makes one call.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-5, C-6, C-7, C-8. It can satisfy C-3 with two declared caps, but the effective payload becomes the product of the thread bound and the per-thread bound (up to 100 × 50 comments), so the cap stops being a single number a reviewer can reason about and truncation becomes two-dimensional.
- **Driver fit:** Best on 3 (one call), weaker on 1 and 6 (payload fan-out for a consumer that needs two threads; two-level truncation to explain).
- **Pros:** Fewer round trips for the whole-request consumer.
- **Cons:** Unpredictable payload size; two truncation dimensions; duplicates the delivered thread-list read for consumers that already have thread ids.
- **Why rejected:** It buys round trips with a weaker bound story, and the delivered thread read already gives consumers the ids needed to scope a per-thread read.

## Decision

- **Decision:** Adopt ALT-1. Review-thread discussion bodies are evidence and are served by one bounded, adapter-local GitHub read. The normalized core contract stays body-free; `DeliveryThread` is unchanged.

### 1. New read (adapter-local, outside the closed operation set)

- **Home:** `packages/adapters/src/github/`, beside `deploy-trace.ts`, following its pattern exactly: one bounded read, a closed provider-neutral shape, no new closed operation, no schema-version bump, no capability declaration.
- **Factory:** `createGitHubThreadDiscussionReader({ instance, credentials, repository, transport, timeoutMs? })`.
- **Call:** `readThreadDiscussion({ pullNumber, threadId })` — `threadId` is the opaque identity already carried on `DeliveryThread.threadId`; `pullNumber` is the scoping input a request-scoped provider surface needs. The returned discussion is the provider's truth for that thread id; a caller that supplies a non-matching pull number gets the provider's thread, not a fabricated not-found.
- **Shape (closed):**
  - `threadId: string`
  - `resolved: boolean`
  - `commentCount: number` — the provider-asserted total for the thread (re-asserted here so a consumer can reconcile it with `DeliveryThread.commentCount`; a disagreement is a provider anomaly, not something the reader repairs)
  - `comments: readonly { commentId: string; authorLogin?: string; authorKind?: "human" | "non-human" | "unknown"; authorAssociation?: string; body: string; bodyTruncated: boolean }[]` — provider order, oldest first
  - `truncated: boolean` — the authority: true when `comments.length < commentCount` or any `bodyTruncated` is true
- **Bounds:** at most 50 comments per thread and at most 4096 bytes per body, both declared fixed caps with no caller override. No pagination loop, no retry, no tail-follow, no archive download.
- **Author facts:** reused normalization — `User` → `human`, `Bot`/`App` → `non-human`, `Mannequin` or absent/unrecognized → `unknown`, which is never inferred from body text.
- **Classification:** an explicit provider 404, or a provider-asserted "no such thread", is the adapter-local not-found read result; any other non-2xx and any transport failure is `provider.payload.invalid`; a malformed 2xx payload is `provider.payload.invalid`; a thread with `commentCount === 0` and `comments: []` is an observed empty discussion, never an unknown.
- **Secret discipline:** bodies never enter persisted state, never enter the conformance artifact, and are redacted at the single rendering chokepoint before any human surface.
- **No write authority:** nothing in the delivered or new write paths may read this surface. Resolution keeps using `resolved` plus root-author facts; a body that says "resolve me" changes nothing (C-6).

### 2. Explicit non-decisions

- **The core contract does not change.** No `comments?` on `DeliveryThread`, no `DeliveryRequest` reshape, no closed-operation member, no capability declaration.
- **The review-feedback flow does not migrate.** `@review-feedback-applier` keeps its platform-CLI Operations Reference; this read is the surface a future migration would adopt, not a migration (revisit trigger).
- **Issue comments are not this surface.** Work-item comment sets are `WorkItem.comments` under ADR-0006 and stay untouched.
- **GitLab and Jira are not decided here.** GitLab can implement the same reference behavior (its payload already carries notes) in M3-S3; Jira declares the reference behavior absent (no review-thread surface). Neither inherits an obligation from this record.

- **Rationale (tied to drivers):** Bodies answer a question that only an evidence consumer asks, so they go where evidence goes (drivers 1–4, with C-1 and C-3 as gates). The normalized view keeps exactly the facts a write path reads (C-6). The read is small enough to withdraw and precise enough to signal its own limits (drivers 6–7). And it leaves GitLab and Jira an explicit position instead of a field one of them can never fill (driver 5).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review; this record stays `Proposed` until then.
- **Conditions for revisit:** See `revisit_triggers`, notably a lifecycle consumer that needs bodies, a migration of the review-feedback flow onto the ports, and observed material truncation.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-8. No accepted-risk exceptions are taken.

Three consequences are recorded rather than treated as exceptions:

- Parity for this surface is documented and behaviour-tested, not registry-enforced, because it sits outside the closed operation set — the same posture the deploy-trace read already has (C-7).
- The read introduces a review-text secret-leak surface; bounding, non-persistence, and redaction reduce it but do not remove it (C-3).
- A consumer that needs a whole request's discussion pays N bounded reads (≤ the delivered 100-thread bound); that is the cost of keeping the bound single-dimensional (C-3).

## Trade-offs & Consequences

### Positive Outcomes

- The reference adapter can show what a review discussion said, with a shape a reviewer can reason about in one sentence: one thread, 50 comments, 4 KiB per body, explicit truncation.
- The normalized contract stays body-free, so the delivered privacy invariant (TC-CAP-031) and the closeout authorship gate keep their footing.
- No closed-operation change, no capability change, no conformance projection change, no persisted-state change.
- Jira's lack of a review-thread surface costs it a documented reference-behavior gap, not a permanently ambiguous contract field.
- The read is withdrawable or reshapeable until a real port-side consumer names its needs.

### Negative Outcomes

- N reads for N threads; a whole-request consumer pays a round trip per thread.
- The parity suite cannot see the surface, so a GitLab/Jira divergence is caught by documentation and behaviour tests, not by the registry gate.
- The per-thread and per-body caps will truncate long discussions; the truncation is visible, but the content is gone.
- The `./github` surface and the two structural inventories must be updated in the same change, widening a pinned surface list that has been stable.
- Bodies are untrusted text; any consumer that renders them inherits the redaction and injection surface.

### Unresolved Questions

- [ ] The exact GraphQL entry point for one thread's comments (node lookup versus filtering the pull request's thread list), and whether the payload exposes the owning pull request for a scoping check (owner: `@coder`, GH-338 delivery; proven by fixture).
- [ ] Whether a thread's comment list is reliably provider-ordered oldest-first, and whether a truncated prefix ever splits a reply from the comment it answers (owner: `@coder`; the truncation signal, not the ordering, is what the contract guarantees).
- [ ] Whether 50 comments and 4096 bytes per body are the right caps once real review data is observed (owner: `@decision-advisor` on the first revisit trigger).
- [ ] Whether GitLab implements the same reference behavior in M3-S3 or declares an absence (owner: M3-S3).

## Implementation Plan

1. **Reader.** Add the bounded thread-discussion reader beside the deploy-trace reader: one read, closed shape, fixed caps, classification above, injected transport and credential port, default operation timeout.
2. **Surface.** Export the factory, its options, its reader, and its closed types additively from `./github`; update `EXPECTED_SURFACE` and the content-inventory allowlist in the same change.
3. **Fixtures and tests.** Present/absent/empty/truncated-comment-set/truncated-body/not-found/non-2xx/malformed fixtures; assertions on the caps; a no-persistence assertion; a redaction assertion; an assertion that the thread-resolution decision is unchanged when a body contradicts the author kind.
4. **Docs.** Add the reference-behavior section the story's AC requires (shape, caps, classification, secret discipline, and what is deliberately absent), and note in the conformance spec that this surface sits outside the registry exactly as the deploy-trace read does.

## Verification Criteria

- Metric: contract inventory — `DeliveryThread` field set unchanged; `ADAPTER_OPERATIONS` unchanged; no capability declaration changed — Target: exact — Window: GH-338 CI.
- Metric: bounds — no response exceeds 50 comments or 4096 bytes per body; `truncated` is true exactly when the provider text exceeded a cap; empty discussions are observed-empty — Target: 100% — Window: GH-338 CI.
- Metric: classification — 404/absent-thread is not-found; non-2xx, transport failure, and malformed payload are `provider.payload.invalid` — Target: ≥1 case each — Window: GH-338 CI.
- Metric: evidence discipline — no body text appears in persisted state or the conformance artifact; a rendering test shows redaction applies — Target: 100% — Window: GH-338 CI.
- Metric: no write authority — resolution outcomes are identical when bodies are present, absent, or contradictory — Target: exact — Window: GH-338 CI.
- Metric: pinned surfaces — provider-surface equality and content-inventory agreement hold with the new exports — Target: exact — Window: GH-338 CI.

## Confidence Rating

**High** for the tier choice and its consequences: the delivered contract, the delivered thread query, the body-free closeout invariant, the deploy-trace precedent, and the absence of any port-side consumer are all verified in the repository. **Medium** for the provider's exact per-thread surface and ordering, which remain `TO-CONFIRM` against fixtures; the decision is shaped so an unavailable per-thread surface degrades to the request-scoped variant without changing the shape, the caps, or the classification.

## References

- GH-338 change workspace (clarify-scope decisions, current-state facts, doc-impact risks): `doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml`
- Predecessor record and the unrouted question this answers: [TDR-0033](TDR-0033-github-adapter-completion-contract-extensions.md) §5 and Unresolved Questions
- M3 blueprint — M3-S4 tasks/AC, EC-2/EC-4: `doc/planning/oss-tooling/milestones/m3/README.md`
- Delivered contract and normalization: `packages/core/src/contracts/ports.ts`, `packages/adapters/src/github/normalize.ts`, `packages/adapters/src/gitlab/normalize.ts`
- Delivered bounded-read precedent: `packages/adapters/src/github/deploy-trace.ts`
- Body-free closeout invariant: `packages/core/src/domain/closeout-thread-policy.ts`, `tests/behaviour/providers/github-closeout-thread-privacy.test.ts`
- Conformance scope: `doc/spec/features/feature-adapter-conformance.md`, `packages/testkit/src/conformance/flows.ts`
- Pinned surfaces: `tests/structure/provider-surface.test.ts`, `tests/structure/content-inventory.test.ts`
- [ADR-0004](ADR-0004-workitem-activity-timestamp-additive-v1.md) — additive optional field, absent-means-unknown
- [ADR-0006](ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) — named-consumer rule and comment-set absence
