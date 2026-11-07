---
id: TDR-0014
decision_type: tdr
status: Proposed
created: 2026-11-07
decision_date: null
last_updated: 2026-11-07
summary: "A stuck coordinator is detected from three read-only artifact classes — a bounded digest-input fingerprint that advanced plus a sourced new turn (`digest-consumed`), a landed terminal `merge.transaction` (`merge`), and a landed `blocker.answer` (`answer`) — with positive sourced session progress as a prefill-safety corroborator that vetoes the verdict, verified-empty stores counting as legitimate zero, unknown classes disclosed and never fabricated as stale, all-unknown or unreadable state resolving to `unevaluable` with no kill, and CPU never read; restart exhaustion escalates through exactly one owner-audience `decision-needed` question over the delivered blocker channel with a reserved escalation slot in the digest `typed-questions` section and the brief `blocker-questions` anchor, idempotent per coordinator-and-epoch, with publish failure loud at exit 2."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os coordinator supervision (M1-S23)"
decision_scope: repo
review_date: null
business_impact: "Turns the two silent failure modes of the coordinator loop — an undetected wedge and an unescalated restart exhaustion — into classified, recorded, owner-visible outcomes, without adding a new question type, brief anchor, or digest section."
classification:
  domains: [operations, architecture]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: high
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@pm (delegated the change-scoped decisions in autonomous mode to unblock GH-241 specification)"
  decider: "Juliusz Ćwiąkalski — acceptance pending at the GH-241 PR review; positions are spec-fixed under that delegation for delivery unblocking (TDR-0012 precedent)"
  contributors:
    - "@spec-writer (GH-241 DEC-4, DEC-5 and §5.1 F-3, F-6)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-241 PR review — the reserved escalation slot changes an owner-facing surface)"
  performers:
    - "@coder (GH-241 domain, state reads, status-digest and brief render rule)"
    - "@doc-syncer (phase-7 reconciliation: status-digest and brief reserved-slot notes)"
  informed:
    - "M1-S18 resident dispatch daemon (may later drive the cycle and consume the owner answer)"
    - "M2-S4 shared board state source (owner-question rendering)"
    - "Owners relying on the brief as the escalation surface"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The audit ledger's `audit.invocation` record proves to be the coordinator's exclusive digest-read path (M1-S20 standardizes the read command, or measured practice shows `status` is always the read): tighten `digest-consumed` to an audited invocation plus the fingerprint (Alternative 2 becomes preferred) rather than replacing the artifact classes."
  - "A `stuck` verdict terminates a session that was in fact progressing: the corroborator and window are strengthened before anything else is loosened; this record and TDR-0013's kill path are reopened together."
  - "A required evidence store is unreadable often enough that `unevaluable` becomes the common verdict: revisit the store set or add a degraded-but-safe path; never collapse unreadable into stale."
  - "The harness progress sourcing changes (new sourced kinds, new absence reasons, or a harness that cannot source progress at all): revisit the `unknown` mapping and the corroborator's role."
  - "The owner-question render cap changes (M1-S18 daemon surfaces, M2-S4 board, or a cap revision): revisit the reserved escalation slot so it stays exactly one slot inside the declared render bound."
  - "M1-S18 or M2-S4 proposes a coordinator digest section or a new coordinator question type: reopen DC-4/DC-5 rather than extending them; the smallest-contract-change argument in this record is the reason to say no."
  - "M1-S18 auto-applies the owner's exhaustion answer: the deliberate `parked until an owner acts` boundary is re-decided, not silently inherited."
links:
  related_changes: ["GH-241", "GH-230", "GH-235", "GH-223"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-spec.md"
    - "doc/spec/features/feature-blockers.md"
    - "doc/spec/features/feature-status-digest.md"
    - "doc/spec/features/feature-brief.md"
    - "doc/spec/features/feature-audit-ledger.md"
    - "doc/spec/features/feature-session-lifecycle-economics.md"
    - "doc/planning/oss-tooling/milestones/m1/test-scenarios.md"
  contracts:
    - "packages/core/src/contracts/blockers.ts"
    - "packages/core/src/contracts/merge.ts"
    - "packages/core/src/contracts/status.ts"
    - "packages/core/src/contracts/brief.ts"
    - "packages/core/src/contracts/audit.ts"
    - "packages/core/src/contracts/state.ts"
  diagrams: []
  decisions: ["TDR-0012", "TDR-0013", "TDR-0005"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S23", "M1-S18", "M2-S4"]
---

# TDR-0014: Coordinator Artifact-Evidence Stuck Detection and Owner-Brief Exhaustion Escalation

## Context

- **FACT:** The status digest is a read-only surface with nine fixed sections; its `typed-questions` section is one verified blocker-ledger read, rendered under the shared ranking, capped at eight, with the omitted count reported (`doc/spec/features/feature-status-digest.md` §Typed questions, §Evidence, counts, truncation, and bounds; `packages/core/src/contracts/blockers.ts:110` re-uses `STATUS_MAX_ITEMS_PER_SECTION` as `BLOCKERS_MAX_QUESTIONS`).
- **FACT:** The brief mirrors the digest's open questions into a real `blocker-questions` anchored-action group; it performs no brief-specific read and reuses the digest's vocabulary and bounds (`doc/spec/features/feature-brief.md` §Nine render surfaces, §Anchored actions).
- **FACT:** The blocker channel delivers what this decision needs to reuse: the closed four-type question set where `decision-needed` is priority class `1` (`packages/core/src/contracts/blockers.ts:53`); the `owner` / `coordinator` audience set consumed from the owner-gate seam; question records carrying `id`, `type`, `audience`, `lane`, `ref`, and `askedAt` (`packages/core/src/contracts/blockers.ts:200-210`); `blocker.answer` as the durable answer record kind (line 121); the ranking (priority, then oldest `askedAt`, then id) with contiguous `1..N` ranks assigned before any cap (`packages/core/src/domain/blockers.ts:490-535`); and `isCoordinatorPickup` over rank 1 + open + coordinator audience (`packages/core/src/domain/blockers.ts:537-552`). The channel records answers with `applied: false` in v0 and documents the applying actors as later consumers (`doc/spec/features/feature-blockers.md` §Shared ranking, §v0 recorded-versus-applied posture).
- **FACT:** `merge.transaction` is a delivered durable record kind (`packages/core/src/contracts/merge.ts:126`), and the coordinator is the merge authority in Mode A (`scripts/ceo-loop.sh:91`: `deliver-ticket.sh` "does NOT merge — you are the merge authority in Mode A"). A merge that matters therefore has a record to observe.
- **FACT:** The coordinator's progress signals are delivered: adapter-sourced heartbeat age, session traffic, and token delta are projected into the watchdog signal shape, a fully corroborated stall requires heartbeat age at/over the bound **and** zero token delta **and** zero traffic, and "there is no CPU field in the shape, no CPU-derived value in the evaluation, and no CPU signal source" (`doc/spec/features/feature-session-lifecycle-economics.md` §3.2).
- **FACT:** The command audit ledger (M1-S22, GH-223) is **delivered** — `audit.invocation` records every audited invocation with `command`, `arguments`, `exitCode`, `timing`, and claimed identity, and the production edge composes the audit seam whenever a state directory resolves (`doc/spec/features/feature-audit-ledger.md`; `packages/cli/src/edge.ts:1053-1079`). The GH-241 spec's DEC-4 rationale states "the audit ledger is absent"; that premise is stale at this HEAD, so this record defends the artifact-proxy choice as a deliberate proxy decision rather than as a necessity imposed by absence, and treats the audit read as an available-but-unused corroborator (Alternative 2).
- **FACT:** The bash baseline detects "stuck" from session-message traffic plus delivery health, with a degraded probe falling back to "not stuck" — i.e., it is already partly fail-closed, but it is artifact-blind and has no window, no classified reason, and no owner escalation (`scripts/ceo-loop.sh:359-434`).
- **Why now:** SC-M1-25 pins artifact-evidence stuck detection and "exhaustion escalates to the owner brief (never silent)" as acceptance for this story (`doc/planning/oss-tooling/milestones/m1/test-scenarios.md:271`), and the delivered channel makes the escalation surface reachable without widening the question contract.

## Problem Framing (Clarified)

Two decisions, one shared substrate:

1. **What does "the coordinator consumed the digest" mean, observably?** The digest is read-only; there is no write-side consumption record. The old probe inferred "alive" from session traffic, which cannot distinguish a wedged-but-chatty session from a working one, and it never asked whether the *world* advanced. The question is which read-only artifacts, combined, are strong enough to justify a destructive action.
2. **How does exhaustion reach the owner without widening the contract?** The channel already renders open owner-audience questions in the digest and the brief. The risk is not reachability but *crowding*: at the eight-question cap a high-priority owner question can still be displaced, and "usually visible" is not "never silent".

The tension is asymmetric and drives everything: a false positive kills a working session and re-pays its full context; a false negative costs at most one stuck window. Therefore the rule must be allowed to say "I don't know" and must never manufacture certainty from absence. "Verified empty" and "unreadable" are different facts, and the delivered evidence discipline (a verified-empty store is a legitimate zero; a failed read is unknown) is the correct model here too.

Out of scope: the restart budget and the kill path (TDR-0013 DC-4), a coordinator digest section, a new question type or brief anchor, and any automatic application of the owner's answer.

## Constraints (Hard Requirements)

### C-1: Stuck detection reads only read-only artifact evidence plus sourced progress

- **Statement:** The verdict is computed from the three artifact classes and sourced session progress; no CPU read, no CPU-derived threshold, and no model call exists anywhere in the evaluation.
- **Source:** AC (GH-241 NFR-2, NFR-3, AC-F3-4)
- **Verification:** test (determinism and no-CPU controls) + audit
- **Negotiable:** no

### C-2: Absence is never fabricated as staleness

- **Statement:** An unsourced or unsupported class is `unknown` and disclosed; it is never counted as `stale`. When every class is `unknown`, or any required store is unreadable or torn, the verdict is `unevaluable`, no kill or restart occurs, and the command exits `2` with the delivered state identity.
- **Source:** AC (GH-241 AC-F3-3, AC-F10-3, NFR-13)
- **Verification:** test (unknown-class and unreadable-store matrices)
- **Negotiable:** no

### C-3: Positive sourced progress vetoes a stuck verdict

- **Statement:** Positive sourced session progress within the declared liveness bound prevents a `stuck` verdict regardless of artifact staleness, so a large working session is never killed mid-flight.
- **Source:** AC (GH-241 AC-F3-2, RSK-1) + prior decision (the delivered prefill-safety discipline)
- **Verification:** test (progress-present negative control)
- **Negotiable:** no

### C-4: Escalation uses exactly one delivered question, type, and channel

- **Statement:** Exhaustion publishes exactly one owner-audience `decision-needed` question through the delivered blocker channel, carrying the coordinator-and-epoch `ref`, the restart count and bound, the durable history reference, and the declared recovery options. No new question type, no new answer channel, and no new brief anchor is introduced.
- **Source:** AC (GH-241 NG-7, AC-F6-1, EVT-6)
- **Verification:** test (exact record count and field assertions) + code review
- **Negotiable:** no

### C-5: The escalation renders inside the declared render bound, even at the cap

- **Statement:** The digest `typed-questions` section and the brief `blocker-questions` anchor reserve exactly one slot for an open owner-audience `decision-needed` question whose `ref` names a coordinator exhaustion; the reserved question renders when the normal cap is reached, other dropped questions are still counted as omitted, and no other section, anchor, ordering rule, or bound changes.
- **Source:** AC (GH-241 AC-F6-1, NFR-15, NG-10)
- **Verification:** test (cap-saturated fixture with a reserved escalation present)
- **Negotiable:** no

### C-6: An unlanded escalation is loud

- **Statement:** If the question cannot be published, the command returns `coordinator.escalation.publish-failed` at exit `2` with consequence `unknown`; no exit-`0` result is returned without an escalation receipt, and `coordinator status` still derives the exhausted state from the restart records.
- **Source:** AC (GH-241 AC-F6-2, NFR-13)
- **Verification:** test (publish-failure injection)
- **Negotiable:** no

### C-7: Evaluation is idempotent

- **Statement:** Repeated evaluation over unchanged state appends no duplicate stuck or exhaustion record, publishes no second question, and performs no destructive action; exhaustion dedupe is per `(coordinatorId, budgetEpochId)`.
- **Source:** AC (GH-241 AC-F6-3, NFR-6)
- **Verification:** test (repeat-run byte and append-count controls)
- **Negotiable:** no

### C-8: Evidence is bounded and content-free

- **Statement:** Every stuck record and error evidence is bounded `key=value` at ≤ 512 UTF-8 bytes carrying counts, identities, references, and closed-vocabulary values only — no prompt, transcript, secret, credential value, or question body text.
- **Source:** AC (GH-241 NFR-11, AC-NFR-2) + prior decision (TDR-0012 content discipline)
- **Verification:** test (evidence-shape and secret-absence assertions)
- **Negotiable:** no

**Table stakes** (every alternative already satisfies them, acknowledged once): the local same-user trust model; one verified read per store per evaluation; deterministic, ANSI-free, bounded output.

## Decision Drivers

Ranked; the ordered list is authoritative.

1. **Precision on the destructive path** — a false stuck verdict kills a working session and re-pays prefill; a false negative costs one window. Every rule is shaped by this asymmetry.
2. **Truthful absence** — the system's evidence model distinguishes verified-empty from unknown, and a stuck rule that coerces absence to zero would be the first place that discipline breaks.
3. **Smallest contract widening for "never silent"** — reuse the question type, the audience, the priority class, the channel, and the anchor; only the cap rule is new.
4. **Determinism and testability** — a bounded fingerprint plus injected facts yields an identical verdict for identical state, including in CI without a real coordinator.
5. **Privacy and secret safety** — the fingerprint is an opaque identity over counts and a cursor, never question text; evidence is bounded and content-free.
6. **Idempotency** — an escalation storm or a duplicate terminal receipt would be worse than a delayed escalation.
7. **Post-hoc explainability** — the recorded verdict and evidence must answer "why was it killed or escalated?" without the session transcript.
8. **Implementation cost** — reuse the delivered reads: one verified blocker-ledger read serves both ranking, the wake decision, and the `answer` class.

## Decision Rights (DACI)

- **Driver:** `@pm` — delegated the change-scoped decisions in autonomous mode to unblock GH-241 specification; `@decision-advisor` analysed and authored this record.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. **Acceptance is pending at the GH-241 PR review**; the record stays `Proposed` with `decision_date: null` until the owner accepts. The reserved escalation slot changes an owner-facing surface, so its acceptance is explicitly human-owned.
- **Contributors:** `@spec-writer` (DEC-4, DEC-5; F-3, F-6); `@decision-advisor` (analysis, record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` during delivery; the human owner at PR review.
- **Performers:** `@coder` (the pure verdict, the verified reads, and the digest/brief reserved-slot render rule); `@doc-syncer` (phase-7 reconciliation of the digest and brief specs).
- **Informed:** M1-S18 (may later drive the cycle and consume the answer), M2-S4 (owner-question rendering), owners who depend on the brief.
- **Timing and escalation:** recorded during GH-241 specification, before delivery tasks execute; implementation may proceed with acceptance pending. Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The digest is read-only, has no write-side consumption record, and exposes the blocker ledger as one verified read. | FACT | `doc/spec/features/feature-status-digest.md` §Typed questions; `doc/spec/features/feature-blockers.md` §Cost and read cost | "Digest consumed" would have a direct write-side signal and the artifact proxy would be unnecessary. | High |
| The brief mirrors open questions into a real `blocker-questions` anchor with no brief-specific read. | FACT | `doc/spec/features/feature-brief.md` | The escalation would need a new surface, contradicting NG-7/NG-10. | High |
| The rendered-question cap is eight, shared with the digest item cap, and `decision-needed` is priority class 1. | FACT | `packages/core/src/contracts/blockers.ts:53,110` | Crowding risk is different, and the reserved-slot argument weakens or strengthens accordingly. | High |
| Question records carry `id`, `audience`, `lane`, `ref`, `askedAt`, so a coordinator-and-epoch reference and a question-lifetime dedupe key are expressible without a schema change. | FACT | `packages/core/src/contracts/blockers.ts:200-210` | A new field or record shape would be needed, plus a schema decision. | High |
| `merge.transaction` is a durable record kind and the coordinator is the merge authority in Mode A. | FACT | `packages/core/src/contracts/merge.ts:126`; `scripts/ceo-loop.sh:91` | The `merge` class would under-report, and the verdict would lean on the fingerprint and answers. | High |
| Sourced progress facts exist (heartbeat age, traffic, token delta) with a declared absence mapping and no CPU field. | FACT | `doc/spec/features/feature-session-lifecycle-economics.md` §3.2; `packages/core/src/contracts/harness.ts:350-358` | The corroborator would be unavailable and the verdict would be artifact-only, raising false-positive risk. | High |
| The command audit ledger is delivered and records `command`, `arguments`, `exitCode`, `timing`, and claimed identity per audited invocation, with the production edge composing the seam. | FACT | `doc/spec/features/feature-audit-ledger.md`; `packages/cli/src/edge.ts:1053-1079` | Alternative 2 would rank higher and the spec's "audit ledger is absent" premise would be correct. | High |
| A bounded fingerprint over the state event-log cursor, the open coordinator-question count, and the ready-to-merge count is a sufficient proxy for "the world moved". | ASSUMPTION | GH-241 DEC-4/F-3; the counts are read from delivered folds | A wedged coordinator could satisfy the proxy by unrelated activity; the sourced-turn component and the corroborator bound that. | Medium |
| An `audit.invocation` of the digest command would prove *consumption* rather than invocation. | ASSUMPTION — believed false | Reasoning over the ledger's field set (no read/comprehension evidence) | If it were true, Alternative 2 dominates on precision; revisit trigger 1 covers the discovery. | Medium |
| Every coordinator-audience question that becomes rank 1 arrives through the audited/served channel the supervisor reads at collection time. | ASSUMPTION | GH-241 F-7; the channel is the single question surface | A question published outside the ledger would not wake; no such surface is declared today. | High |
| An owner-audience `decision-needed` question is answerable only by the owner under the delivered delegation policy. | FACT | `doc/spec/features/feature-blockers.md` delegation policy-as-data | A coordinator could answer its own escalation, which would defeat the escalation's purpose. | High |

## Mental Models & Techniques Used

- **Inversion ("how does this kill a healthy session?"):** progress present but stale artifacts; a fingerprint that advances for unrelated reasons; a torn store read as zero; a harness without progress signals. Each yields a rule: the corroborator (C-3), the sourced-turn component of the digest class, `unevaluable` on unreadable state (C-2), and `unknown` rather than `stale` for unsourced classes.
- **Type I / Type II error asymmetry:** the rule is deliberately biased toward "keep working and wait" on the destructive path, which is why the verdict requires the window, no advanced class, no progress, **and** at least one evaluable stale class.
- **Second-order thinking (escalation crowding):** raising the cap would grow every surface; lowering priority would make exhaustion quieter. Reserving one slot inside the existing bound is the only change that adds no surface and no ordering rule.
- **Least mechanism (KISS):** three read-only classes and one corroborator beat a fourth "understanding" heuristic; one reserved slot beats a new section or a new anchor.
- **Systems thinking:** the same verified blocker-ledger read feeds ranking, wake eligibility, and the `answer` class, so the evidence model and the wake model cannot drift apart.
- **Reference-class forecasting:** the bash baseline's degraded probe already fails closed ("degraded with a known session ⇒ don't kill"), which is the precedent this rule makes explicit and typed.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 read-only/no-CPU | C-2 absence truthful | C-3 progress veto | C-4 one delivered question | C-5 in-bound reserved slot | C-6 loud failure | C-7 idempotent | C-8 bounded content-free |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the bash heuristic | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| ALT-1 three artifact classes + corroborator + reserved-slot escalation (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 audit-invocation-attributed digest read as the `digest-consumed` class | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 liveness-only stuck detection (heartbeat/traffic threshold) | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 escalate via a new coordinator digest section and question type | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken).

### Alternative 0 — Keep the Bash Heuristic and Add Nothing

- **Eligibility:** Not eligible (fails C-3 — the traffic heuristic cannot honour a rising progress signal as a veto — C-4/C-5/C-6 because no owner escalation exists at all).
- **Summary:** Leave `ceo_is_stuck` in bash; no window, no classified evidence, no escalation.
- **Constraint compliance:** Fails C-3, C-4, C-5, C-6; C-1 passes only because the probe is not the domain.
- **Driver fit:** Best on D8 (zero cost); worst on D1, D3, D4, D6, D7.
- **Pros:** No new code; no new render rule.
- **Cons:** Artifact-blind; no reason to explain a kill; exhaustion silent; the story's escalation AC unmet.
- **Why rejected:** It leaves both silent failure modes in place and cannot satisfy the pinned acceptance criteria.

### Alternative 1 — Three Artifact Classes, One Corroborator, Reserved-Slot Escalation (selected)

- **Eligibility:** Eligible (C-1…C-8 all pass).
- **Summary:** `digest-consumed` = bounded fingerprint advanced **and** a sourced new turn; `merge` = a `merge.transaction` after the expectation; `answer` = a `blocker.answer` after the expectation. Positive sourced progress vetoes a `stuck` verdict. Verified-empty is a legitimate zero; unknown is disclosed; all-unknown or unreadable is `unevaluable` with no kill. Exhaustion publishes one owner-audience `decision-needed` question, idempotent per coordinator-and-epoch, with one reserved render slot inside the existing eight-question bound.
- **Constraint compliance:** Passes every constraint; see the attestation.
- **Driver fit:** Best on D1 (multiple independent signals, each cheap and read-only), D2 (explicit three-valued class states), D3 (one slot, no new surface), D4/D8 (bounded fingerprint, one shared read), D5 (no content in the fingerprint), D6 (dedupe keys already exist), D7 (bounded evidence recorded with the verdict).
- **Pros:** Fails closed in every ambiguous case; the veto makes the destructive path conservative; the escalation cannot be crowded out and adds no surface; the artifact classes are stable under harness changes.
- **Cons:** The fingerprint is a proxy, not proof of comprehension; an escalation occupying the reserved slot displaces one other question from the rendered list (bounded by the omitted count).
- **Why chosen:** See Decision.

### Alternative 2 — Audit-Invocation-Attributed Digest Read

- **Eligibility:** Eligible (C-1…C-8 all pass) — and materially more available than the change spec assumed, because the audit ledger (M1-S22) is delivered.
- **Summary:** Treat an `audit.invocation` of the coordinator's digest-read command landing after the expectation as the `digest-consumed` evidence (optionally combined with the fingerprint).
- **Constraint compliance:** Passes all constraints; the record set is already additive state.
- **Driver fit:** Best on D1 in one narrow sense (it witnesses the actor, not just the world); weaker on D4 (it couples the verdict to the audit seam's injection and to the agent's choice of read surface) and indifferent on D5.
- **Pros:** Directly attributes the read to the coordinator; uses delivered, keyed, tamper-evident records; would be cheap to add as a corroborator.
- **Cons:** It proves an invocation, not consumption — the field set carries `command`, `arguments`, `exitCode`, `timing`, and identity, with no evidence that the digest was read or acted on. Its coverage depends on the coordinator reading through the audited command surface rather than a harness prompt or an MCP path. Making it the primary class would let a coordinator satisfy the stuck rule by re-running a command while wedged on the same decision.
- **Why rejected now, recorded permanently:** The artifact fingerprint plus sourced progress is harness- and surface-agnostic and requires no assumption about which read path the agent chose. Alternative 2 is recorded here as an **available additive corroborator** (not a future one), with revisit trigger 1 naming the evidence that would promote it.

### Alternative 3 — Liveness-Only Stuck Detection

- **Eligibility:** Not eligible (fails C-3: a liveness threshold that ignores a rising token delta or traffic classes a working session as stuck, which is exactly the prefill-kill failure RSK-1 names).
- **Summary:** Declare "stuck" whenever heartbeat age exceeds the bound, as the bash probe effectively does with session traffic.
- **Constraint compliance:** Fails C-3; passes C-1 (no CPU) but not the spirit of artifact evidence.
- **Driver fit:** Best on D8 (a threshold and a key); worst on D1.
- **Pros:** Trivial to implement; a single bounded number to tune.
- **Cons:** Blind to a session that is thinking hard without producing traffic; kills the largest working session first; contradicts the delivered prefill-safety rule.
- **Why rejected:** It reintroduces the exact failure the delivered economics work exists to prevent, and it is artifact-blind.

### Alternative 4 — Escalate Through a New Coordinator Digest Section and Question Type

- **Eligibility:** Not eligible (fails C-4 — a new question type — and C-5 — a new section/anchor).
- **Summary:** Add a coordinator-supervision digest section and a dedicated `coordinator-exhausted` question type with its own answer channel and brief anchor.
- **Constraint compliance:** Fails C-4 and C-5; passes the rest.
- **Driver fit:** Good on D3 for reachability (a first-class surface cannot be crowded out), bad on D3's contract-widening cost and on D8.
- **Pros:** Maximum visibility; a purpose-built vocabulary; no reserved-slot special case.
- **Cons:** Widens every surface and consumer for one event; a second answer channel to govern; preempts the daemon and board surfaces that M1-S18/M2-S4 will design; contradicts NG-7/NG-10.
- **Why rejected:** It pays a permanent contract cost to solve a crowding problem that one reserved slot solves inside the existing bound. Its genuine concern — that "usually visible" is not "never silent" — is preserved as C-5 and verified by a cap-saturated fixture.

## Decision

- **Decision:** **ALT-1.** Stuck detection uses the three read-only artifact classes over a bounded digest-input fingerprint plus a sourced-turn requirement, with positive sourced session progress as a prefill-safety corroborator; absence is `unknown`, verified-empty is a legitimate zero, and all-unknown or unreadable state is `unevaluable` with no kill. Restart exhaustion escalates through exactly one owner-audience `decision-needed` question over the delivered blocker channel, with one reserved escalation slot inside the existing render bound, idempotent per coordinator-and-epoch, and loud on publish failure.
- **Rationale (tied to drivers):** ALT-1 is the only eligible alternative that is simultaneously conservative on the destructive path (D1, C-3) and honest about what it does not know (D2, C-2). The three classes are independent and cheap: a world-signal fingerprint paired with a sourced turn, a merge record, and an answer record — none of which requires a new read, a new store, or a model call. ALT-2 is the strongest challenger and was rejected for a precise reason, not a vague one: an invocation record proves a command ran, not that the digest was understood, and it would let a wedged coordinator satisfy the rule by re-running a command. It remains available as a corroborator. ALT-3 would kill the largest working session first, which is the failure the delivered economics work exists to prevent. ALT-4 solves crowding by widening the contract permanently, while one reserved slot inside the existing bound solves it additively (D3) and verifiably (C-5).
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-241 PR review; not claimed by this record.
- **Conditions for revisit:** See `revisit_triggers`; the load-bearing ones are evidence that the audit invocation is the coordinator's exclusive read path, any false-kill incident, and any change to the render cap.

### DC-1 — Expectation model: at most one active expectation

An iteration expectation is created on a start, a wake, a restart, or an actionable digest change while the coordinator is live. At most one expectation is active per coordinator; a new trigger refreshes the window and records a new iteration rather than opening a second expectation. A quiet world with no actionable change is `idle`, not `stuck` — the rule never manufactures an expectation out of silence.

### DC-2 — Evidence classes and the bounded fingerprint

- `digest-consumed` — the digest-input fingerprint advanced after the expectation **and** the coordinator session produced a new sourced turn. The fingerprint is a bounded, opaque identity over the state event-log cursor, the count of open coordinator-audience questions, and the count of ready-to-merge candidates; it contains no question text and no payload content.
- `merge` — a terminal `merge.transaction` record landed after the expectation.
- `answer` — a `blocker.answer` record landed after the expectation, read from the same verified blocker-ledger read used for ranking.

Each class resolves to `advanced`, `stale`, or `unknown`. A verified-empty store is a legitimate count of zero and yields `stale` when nothing landed after the expectation; only an unreadable, torn, or unsourced store is `unknown`.

### DC-3 — Verdict rule, with the corroborator as veto

A `stuck` verdict requires **all** of: the `coordinator.stuck-window` elapsed; no class advanced; no positive sourced session progress within the declared liveness bound; and at least one class evaluable and stale. Positive sourced progress vetoes the verdict even when all three classes are stale, so a large working session is never killed. If every class is `unknown`, or a required store is unreadable, the verdict is `unevaluable`, and no kill or restart occurs (exit `2` with the delivered state identity). CPU is never read. The verdict and its bounded `key=value` evidence are recorded; only `stuck` and `unevaluable` persist as records.

### DC-4 — Exhaustion escalation: one question, idempotent, loud

On exhaustion the supervisor publishes exactly one owner-audience `decision-needed` question carrying `ref = <coordinatorId>#<budgetEpochId>`, `lane = coordinator`, the restart count and bound, the durable history reference, and the declared recovery options (`restart-fresh-budget`, `park-owner-review`). Before publishing it re-reads the verified ledger and reuses an existing open owner question carrying the same coordinator ref; dedupe is per `(coordinatorId, budgetEpochId)`. The terminal `coordinator.exhaustion` receipt lands **only after** the question lands. A repeated tick in the exhausted state is an idempotent success that reuses the existing escalation and appends nothing. If the question cannot be published, the command returns `coordinator.escalation.publish-failed` at exit `2` with consequence `unknown`, and `status` still derives the exhausted state from the restart records. The owner's answer is never applied automatically by this change.

### DC-5 — Reserved escalation slot inside the existing render bound

The digest `typed-questions` section and the brief `blocker-questions` anchor keep one reserved slot for an open owner-audience `decision-needed` question whose `ref` names a coordinator exhaustion. The reserved question renders even when the normal cap is reached, and every other dropped question is still counted as omitted. The slot lives **inside** the declared rendered-question bound (NFR-4: at most eight rendered questions), so with an escalation pending at most seven other questions render; no other section, anchor, ordering rule, or bound changes.

### Constraint Compliance Attestation

The chosen alternative satisfies every constraint. C-1: the evaluation reads only the three artifact classes and sourced progress, with no CPU read and no model call (NFR-2/NFR-3, AC-F3-4). C-2: unsourced classes are `unknown`, verified-empty is `stale` by legitimate zero, and all-unknown or unreadable state is `unevaluable` with no destructive action (AC-F3-3, AC-F10-3). C-3: positive sourced progress vetoes the verdict (AC-F3-2). C-4: exactly one delivered `decision-needed` owner question, no new type or channel (AC-F6-1, EVT-6). C-5: one reserved slot inside the existing bound, other drops still counted (AC-F6-1, NFR-15). C-6: publish failure is `coordinator.escalation.publish-failed` exit `2`, never exit `0` without a receipt (AC-F6-2). C-7: repeated evaluation is idempotent per coordinator-and-epoch (AC-F6-3). C-8: evidence is bounded `key=value`, content-free, and secret-free (NFR-11, AC-NFR-2). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- A wedged coordinator is detected from artifacts the system already trusts, with a declared window, a classed reason, and bounded evidence — an auditable verdict instead of a heuristic.
- The prefill-safety veto makes the destructive path conservative by construction: progress wins over staleness.
- Absence semantics stay honest: `unknown` is disclosed, `unevaluable` refuses to act, and neither is ever converted into "zero evidence of progress".
- "Never silent" becomes structural rather than hopeful: the reserved slot means the exhaustion question survives the cap, and a failed publish is a loud exit-`2`.
- No surface was widened: no new question type, no new brief anchor, no new digest section, no new answer channel.
- Idempotency is keyed on identities the records already carry, so a supervisor crash cannot duplicate the escalation or the receipt.
- The same verified blocker-ledger read serves ranking, wake eligibility, and the `answer` class, preventing the evidence model from drifting away from the wake model.

### Negative Outcomes

- The digest-input fingerprint is a **proxy** for consumption, not proof of it: a coordinator can satisfy the world-signal half without understanding anything (the sourced-turn requirement and the progress veto bound the damage, but do not eliminate it).
- The reserved slot displaces one ordinary question from the rendered list while an escalation is pending; the omitted count keeps that honest, but it is a real visibility trade.
- A harness that cannot source progress shifts weight onto the artifact classes; if a required store is also unreadable, the verdict degrades to `unevaluable`, which is safe but operationally noisy.
- An exhausted coordinator stays parked until the owner acts; this is deliberate, but it means exhaustion is a stop, not a self-healing loop.
- The rule adds two config keys' worth of tuning surface (`stuck-window`, and the liveness bound it borrows) whose defaults mirror the bash baseline rather than being measured.

### Unresolved Questions

- [ ] The spec's DEC-4 rationale and §7.3 deferral rest on "the audit ledger is absent"; at this HEAD the ledger (M1-S22) is delivered. The spec text needs correcting so the record and the spec do not disagree about the evidence base (owner: `@spec-writer`).
- [ ] The reserved-slot wording must state that the slot sits inside the eight-question bound (at most seven other questions render while an escalation is pending); as written it can be read as a ninth rendered question, which would contradict NFR-4 (owner: `@spec-writer`).
- [ ] Whether the fingerprint should include the audit cursor as an *additional* corroborator is deferred to revisit trigger 1; no change is made now (owner: `@pm` at M1-S20/M1-S18).
- [ ] The `stuck-window` default (600 s) is a policy value inherited from the bash baseline, not a measured optimum; the first retrospective should compare realized stuck-detection latency and false-kill count against it (owner: `@coder`/owner at retro).
- [ ] The escalation's rendered position within the reserved slot (whether it sorts first or occupies its ranking position) is a render detail the implementation must pin deterministically and the digest/brief specs must record (owner: `@coder`, reconciled by `@doc-syncer`).

## Implementation Plan

1. **Domain (pure).** Implement the expectation model, the three class evaluations over injected facts, the fingerprint projection, the verdict rule with the progress veto and the `unevaluable` outcome, and the escalation projection (state, dedupe key, option set). No I/O, no clock, no ambient reads.
2. **State reads.** Consume the delivered verified reads: state event-log cursor and folds for the fingerprint, `merge.transaction` for the merge class, and the single blocker-ledger read for ranking and the `answer` class. Treat torn/unknown as `unknown`/`unevaluable`, never zero.
3. **Escalation.** Publish through the delivered blocker channel with `type: decision-needed`, `audience: owner`, `lane: coordinator`, the coordinator-and-epoch `ref`, the declared options, and bounded question text; re-read and reuse an existing open question for the same ref; append the terminal receipt only after the question lands.
4. **Render rule.** Add the reserved escalation slot to the digest `typed-questions` section and the brief `blocker-questions` anchor inside the existing bound; keep the omitted count truthful for every displaced question; change nothing else about ordering, vocabulary, or bounds.
5. **Errors and evidence.** Use `coordinator.escalation.publish-failed` for an unlanded question and the delivered `state.*` identities for torn/unreadable stores; keep evidence bounded `key=value` and content-free.
6. **Tests.** Cover: each class advanced/stale/unknown; verified-empty versus unreadable; the progress veto; window-not-elapsed; cap-saturated render with a reserved escalation; publish-failure injection; duplicate-tick idempotency; determinism over identical injected facts; and the SC-M1-25 stuck and exhaustion assertions.
7. **Documentation.** Record the reserved escalation slot in the status-digest and brief feature specs, the enforcement-arm note in the blockers feature spec, and the analytics/verdict vocabulary in the coordinator-supervision feature spec; update the decision index.

## Verification Criteria

- Metric: stuck-detection latency after an expectation — Target: ≤ `coordinator.stuck-window` + one `coordinator.collection-interval` — Window: delivery suite and first supervised releases.
- Metric: CPU reads and model calls in the verdict path — Target: 0 and 0 — Window: GH-241 audit.
- Metric: exhaustion events visible in the owner brief — Target: 100%, including cap-saturated fixtures — Window: delivery suite.
- Metric: exit-`0` results without an escalation receipt — Target: 0 — Window: publish-failure injection suite.
- Metric: duplicate stuck/exhaustion records or duplicate questions across repeated ticks — Target: 0 — Window: idempotency suite.
- Metric: evidence size and content — Target: ≤ 512 UTF-8 bytes, zero prompt/transcript/secret/question-body content — Window: evidence-shape assertions.
- Metric: determinism — Target: byte-identical verdict and evidence for identical injected facts — Window: repeat-run controls.
- Process checkpoints: the first retrospective after GH-241 implementation sets `review_date`; the false-kill count and stuck-verdict distribution are reviewed there against this record's bias toward waiting.

## Confidence Rating

**Medium-high.** The escalation half rests on delivered, read code (the question record shape, priority classes, ranking, cap, and the real brief anchor), and the render change is one bounded rule that a cap-saturated fixture can prove. The detection half rests on delivered sourced-progress facts and delivered record kinds, but its central mechanism — the digest-input fingerprint as a proxy for consumption — is an analytical judgement, not a measured one, and it is recorded as an assumption with the audit-corroborator option kept live. One spec premise was found to be stale (the audit ledger is present), which is itself a reason to treat the change's evidence narrative as needing correction rather than as settled. AI-generated confidence is not evidence; the owner's acceptance at PR review is the authoritative signal.

## References

- Change spec: `doc/changes/2026-11/2026-11-07--GH-241--coordinator-supervision/chg-GH-241-spec.md` — DEC-4, DEC-5; §5.1 F-3 and F-6; §8.2 EVT-3/EVT-4/EVT-6; §17.3 and §17.6; Appendix B (evidence-class states), Appendix E (stuck and exhaustion record shapes), Appendix F (exit matrix).
- Delivered blocker channel: `doc/spec/features/feature-blockers.md` — question/answer records, ranking, audiences, delegation policy, the eight-question cap, and the statement that M1-S23 is the future applying actor.
- Delivered status digest: `doc/spec/features/feature-status-digest.md` — the read-only `typed-questions` section, its verified read, and its bound.
- Delivered brief: `doc/spec/features/feature-brief.md` — the mirrored `blocker-questions` anchored-action group.
- Delivered economics: `doc/spec/features/feature-session-lifecycle-economics.md` §3.2 — sourced signals, the full-corroboration stall rule, and the explicit absence of any CPU field.
- Delivered audit ledger: `doc/spec/features/feature-audit-ledger.md` — `audit.invocation` field set and the production composition of the audit seam (the evidence that corrects the spec's "audit ledger is absent" premise).
- Contracts read: `packages/core/src/contracts/blockers.ts`, `packages/core/src/contracts/merge.ts`, `packages/core/src/contracts/status.ts`, `packages/core/src/contracts/brief.ts`, `packages/core/src/contracts/audit.ts`, `packages/core/src/contracts/state.ts`; ranking and predicate in `packages/core/src/domain/blockers.ts`.
- Bash baseline being replaced: `scripts/ceo-loop.sh` (stuck heuristic, kill, restart bound, Mode-A merge authority).
- Seed scenario: `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` SC-M1-25.
- [TDR-0013](TDR-0013-coordinator-supervision-architecture.md) — the supervision architecture whose restart budget, kill path, and collection cycle this record's verdict and escalation ride on.
- [TDR-0012](TDR-0012-blockers-credential-guard-pattern-deferral.md) — the channel's content and credential discipline this record's bounded evidence inherits; [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the exit and error-identity projection.
