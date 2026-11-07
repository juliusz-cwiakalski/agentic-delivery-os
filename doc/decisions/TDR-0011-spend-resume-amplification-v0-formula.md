---
id: TDR-0011
decision_type: tdr
status: Proposed
created: 2026-11-07
decision_date: null
last_updated: 2026-11-07
summary: "The spend v0 resume-amplification metric is a deterministic run-identity ratio over the closeout-captured event log: paid = the five-class token sum over all captured records for the ref; progress = the token sum of the latest record-bearing captured run (captured-at descending, run-id ascending tie-break); ratio = paid ÷ progress with a zero-progress null rule; one closed-vocabulary `restart-loop prefill re-pay` event per superseded record-bearing run carrying its window and tokensWasted; a healthy single-run delivery reads exactly 1 — with the honesty limits (run duplication proven, semantic duplication not; pre-closeout runs invisible) stated in the report's own terms. Amended 2026-11-07 (GH-236 spec v1.1 DEC-11): the amplification block gains the additive nullable `progressRun` field and the null rule covers paid = 0 ∧ progress = 0."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os learning plane (spend read side)"
decision_scope: repo
review_date: null
classification:
  domains: [operations, architecture]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: local
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-236 spec OQ-1)"
  decider: "Juliusz Ćwiąkalski (human acceptance pending at GH-236 PR review)"
  contributors:
    - "@spec-writer (GH-236 DEC-3/DM-3, AC-F5-1..3, OQ-1 framing)"
    - "@spec-writer (GH-236 v1.1 DEC-11 amendment instruction)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Owner (human final acceptance)"
  performers:
    - "@coder (GH-236 delivery)"
  informed:
    - "M1-S19 spend read side (GH-236)"
    - "M1-S21 model-profile routing (amplification consumer)"
    - "M2-S6 alarms and burn rates (amplification consumer)"
    - "M1-S16 lane economics (restart evidence enrichment)"
    - "M1-S12 / GH-240 capture composer (makes the substrate real)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "GH-240 (M1-S12) wires the production capture composer and real multi-run histories exist: validate the latest-record-bearing-run-is-progress assumption against real resume/reopen shapes; recalibrate, addendum, or supersede."
  - "M2-S6 needs cause vocabulary beyond the single v0 entry, cost-weighted amplification, or windowed/per-phase normalization: that is a deliberate contract change — addendum or superseding record, never a silent extension."
  - "M1-S16 lands restart evidence covering pre-closeout runs: the pre-closeout-invisibility honesty limit shrinks; decide whether amplification's supersession basis widens with it."
  - "Reopen-then-reclose deliveries prove common enough that `restart-loop prefill re-pay` misattributes deliberate rework: add a distinct cause or a capture-side rework marker through a reviewed change."
  - "Capture-side enrichment ever carries session-activity or content-overlap windows: the semantic-duplication honesty limit (NG-9) is redecided, not stretched."
links:
  related_changes: ["GH-236", "GH-233"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-07--GH-236--spend-read-side/chg-GH-236-spec.md"
    - "doc/spec/features/feature-state-layer.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/planning/oss-tooling/operator-requirements-2026-11.md"
  contracts:
    - "packages/core/src/contracts/harness-telemetry.ts"
  diagrams: []
  decisions: ["ADR-0008", "TDR-0004", "TDR-0005"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S19", "M1-S21", "M2-S6", "M1-S16", "M1-S12"]
---

# TDR-0011: Spend v0 Resume Amplification — Run-Identity Ratio, Latest-Run Progress, and Named Re-Pay Events

## Context

- **FACT:** The state layer (TDR-0004; GH-233 / M1-S11) delivers the substrate this decision folds: additive `harness.telemetry` session-group records (payload schema `delivery.harness.telemetry.v1`, store-scoped key prefix `harness.telemetry:<workItemRef>`) and run-scoped capture-outcome records (payload schema `delivery.harness.telemetry.capture.v1`, key `harness-telemetry-capture:<workItemRef>:<runId>`), appended fenced and verified at closeout capture; session-group capture is idempotent by (work item, run, session, agent, model) and the capture outcome by (work item, run) (`doc/spec/features/feature-state-layer.md`, read 2026-11-07).
- **FACT:** The captured records carry numeric statistics and identity references only: the five delivered token classes (`input`, `output`, `reasoning`, `cacheRead`, `cacheWrite`), call counts, bounded per-tool counts, agent and model identity, tree root, parent chain, work-item ref, run id, session id, harness kind and version, a cost that is null (never zero) when missing, the injected captured-at timestamp, and warnings from a closed reason set. They carry **no** phase field, no session-activity windows, no resume-chain accounting, and never any conversation content (`doc/spec/features/feature-harness-adapters.md` §5–6, read 2026-11-07).
- **FACT:** Phase truth exists in the same ledger: the delivery registry appends timestamped `phase.transition` records per change, from which ordered phase windows are folded (`doc/spec/features/feature-state-layer.md`; GH-236 spec DM-2/DEC-4).
- **FACT:** No production composer injects the capture capability yet — GH-240 (M1-S12) wires it — so no real closeout run has captured harness telemetry records to date; every reporting path is proven on fixture-seeded stores (`doc/spec/features/feature-harness-adapters.md` §6; GH-236 spec §12, NFR-7).
- **FACT:** Ticket GH-236 (M1-S19) pins the constraints this record formalizes: log-only reads with no harness re-query and no capture change (spec DEC-1), and binding AC 2 — "the resume-amplification metric reads approximately 1 for a healthy delivery and flags amplification events by name" — which rides directly on this decision (spec §17, AC-F5-1/AC-F5-2/AC-F5-3, Appendix A).
- **FACT:** The operator-requirements corpus names the waste classes this metric exists to surface: R5 — "Largest single token-waste class: resume loops re-paying prefill roughly ten times" — and R9 — "Per-ticket spend accounting, early: waste cannot be minimized if it cannot be seen" — with M1-S19 ranked early precisely so "waste classes become visible the moment telemetry exists" (`doc/planning/oss-tooling/operator-requirements-2026-11.md` §1/§2 tables; `doc/planning/oss-tooling/backlog-ranking.md`, read 2026-11-07).
- **FACT:** The GH-236 spec pins the formula as DEC-3 (with DM-3 as the contract row) and OQ-1 recommends exactly this standalone TDR because the definition is AC-bearing, novel, and consumed downstream by M1-S21 (model-profile routing consumes the amplification signal) and M2-S6 (alarms and burn rates; blocked until M1-S19 lands) — the GH-232 → TDR-0009 precedent for decision-worthy, cross-story, AC-oracle-stabilizing definitions.
- **Scope note:** this record covers spec DEC-3 (the amplification formula), its boundary with DEC-5 (restart counting), and — per the amendment of 2026-11-07 — the spec v1.1 DEC-11 additive refinement of the amplification block (see the Amendment section under Decision). Per-phase attribution (DEC-4), ref resolution (DEC-6), error identity (DEC-7), the digest flip (DEC-8/DEC-6), output-contract emphasis flags (DEC-9), and the brief boundary (DEC-10) stay change-scoped in the spec's decision log; none is precedent-diverging.
- **Branding note:** the event cause string is a machine vocabulary value rendered in both surfaces; operator-facing naming introduced by this work goes through the branding seam and the forbidden-literal registry per the spec's §16 obligations. Nothing here names a product or binary literal.

## Problem Framing (Clarified)

The operator's question is: **of everything I paid for this delivery, how much produced durable progress, and how much was re-paid waste?** Three linked sub-questions sit under spec DEC-3:

1. **Numerator (paid).** What counts as paid? Every captured record's tokens were billed, so paid must span all runs — anything narrower silently drops real spend.
2. **Denominator (unique progress).** What single quantity derivable from the log honestly represents *unique* progress? The log records spend per captured run, not per unit of work; "progress" is not a captured primitive and must be a derived proxy. The proxy choice determines whether ≈1 is true by construction and whether resume loops move the number.
3. **Attribution (events).** How does a ratio become a diagnosis? A single number cannot tell the operator *which* runs re-paid what over *which* window — the binding AC demands events flagged **by name**.

The root cause is not arithmetic — it is **proxy selection under an evidence-bounded log**: the log can prove run duplication (distinct run identities with captured spend) but cannot prove semantic duplication (content-level re-reading) or see runs that never reached closeout capture. Any formula that quietly claims more than that is dishonest, and any denominator that counts superseded work as progress hides exactly the R5/R9 waste the metric exists to make visible.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Log-only derivability: the formula is computable from the closeout-captured event log alone (both `harness.telemetry` record families plus `phase.transition` history); no harness re-query, no capture-side change, no new upstream primitive. | Ticket-pinned decision (GH-236 DEC-1; spec F-2, NFR-3) | AC-F2-1 harness-read count = 0 on every invocation path; code review | no |
| C-2 | Healthy ≈1 semantics: a delivery with exactly one record-bearing captured run reads **exactly 1** (paid = progress), deterministically. | Binding ticket AC 2 (spec AC-F5-1, DEC-3) | AC-F5-1 fixture test | no |
| C-3 | Named events: each superseded record-bearing run with positive spend flags exactly one named event carrying `cause`, derived `window`, and `tokensWasted` = that run's spend, sorted deterministically. | Binding ticket AC 2 (spec AC-F5-2, DM-3) | AC-F5-2 fixture tests | no |
| C-4 | Determinism / no-clock: byte-identical output for identical store content and injected clock/run-id; run ordering by captured-at descending with run-id ascending tie-break; no wall-clock reads in the computation; no run-id format property (time-sortability) assumed. | Spec NFR-2, §12 assumptions | NFR-2 double-render tests; review | no |
| C-5 | Honesty limits carried in-contract: the report itself states that run duplication is proven while semantic duplication is not, that runs never reaching closeout capture are invisible, and the zero-progress null rule (a zero-token progress run reports `ratio: null` naming the run — *amended 2026-11-07, GH-236 v1.1 DEC-11: generalized from "with paid > 0" to also cover paid = 0 ∧ progress = 0*). | Spec F-5, AC-F5-3, RSK-1; amendment source GH-236 v1.1 DEC-11 | AC-F5-3 tests; review of rendered output | no |
| C-6 | Stable machine surface: the amplification block (`ratio`, `events[]`, and — *added 2026-11-07, GH-236 v1.1 DEC-11* — the nullable `progressRun` run-id-or-null field) is always present in the `delivery.spend.v1` envelope regardless of human emphasis flags; M1-S21 and M2-S6 consume the envelope, and formula changes ride a reviewed change — never a silent redefinition; the reviewed-change discipline applies to `progressRun` as it does to the rest of the block. | Spec DEC-9, §13 consumed-by, §22; amendment source GH-236 v1.1 DEC-11 | Contract tests; review | no |

Table stakes (every alternative below satisfies these by being a pure fold over verified reads, so they eliminate nothing): read-only/zero-writes and zero fence acquisitions (NFR-3); privacy of output — statistics and identity references only (NFR-5); no new third-party dependency (ADR-0003 tier rules); bounded deterministic rendering (NFR-1).

## Decision Drivers

1. **Waste-class visibility (the metric's reason to exist).** Resume-loop prefill re-payment (R5) must move the number *and* be attributable by run; the ratio must be monotone in re-paid waste — never ≈1 for a genuine restart loop.
2. **One-sentence interpretability.** "Tokens paid ÷ tokens of the final run's complete pass" — an operator reads ≈1 as healthy with no knowledge of the machinery; the healthy anchor is exact, not estimated.
3. **Determinism and offline provability.** Pure computation over verified records: no clock, no network, no model calls; every path fixture-provable before real telemetry exists (NFR-2, NFR-7).
4. **Downstream stability for M1-S21 and M2-S6.** The ratio is thresholdable (alarms); the events are attributable evidence (routing); both live in the always-present machine envelope.
5. **Honesty-first semantics.** The metric claims only what the log proves; its limits ride the report's own terms (RSK-1 mitigation), in the house style of the audit-ledger caveat.
6. **Minimal ceremony.** No capture change, no schema change, no new primitives; one already-pinned error row (`spend.telemetry-absent`) covers the empty case.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-236 spec OQ-1 delegates this record).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-236 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (DEC-3/DM-3, AC-F5-1..3, OQ-1 framing); `@decision-advisor` (analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-236; the owner for final acceptance of this record.
- **Performers:** `@coder` (GH-236 delivery: contracts, fold, fixtures, digest flip).
- **Informed:** M1-S19 (GH-236) and the consumers M1-S21 (model-profile routing), M2-S6 (alarms/burn rates), M1-S16 (lane economics), and M1-S12/GH-240 (capture composer that makes the substrate real).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Both `harness.telemetry` record families exist with run ids, injected captured-at stamps, and the five token classes; appends are idempotent per their identity keys; reads are verified and presence-tolerant. | FACT | `doc/spec/features/feature-state-layer.md`; `doc/spec/features/feature-harness-adapters.md` §5–6 (read 2026-11-07) | The formula's inputs would not exist; the whole read side is unbuildable until GH-233-class substrate lands. | High |
| Records carry no phase field, no session-activity windows, and no resume-chain accounting — tree root and parent chain are identity references only. | FACT | `feature-harness-adapters.md` §5 | Chain- or activity-based alternatives (ALT-4) would become derivable; C-1 would not force their rejection. | High |
| No production capture composer exists until GH-240; real stores are telemetry-absent and all paths are fixture-proven. | FACT | `feature-harness-adapters.md` §6; GH-236 spec §12 | None to the formula; evidence model would strengthen if real captures existed. | High |
| Ticket GH-236 binding AC 2 (verbatim) and pinned decisions DEC-1 (log-only) and DEC-3 (this formula) are as quoted; the spec is the source this record formalizes. | FACT | GH-236 spec §17, §15, Appendix A | Constraint set C-1..C-6 would need re-derivation. | High |
| Run ids are opaque strings with no time-sortability property; ordering must come from captured-at with a run-id tie-break. | FACT | GH-236 spec §12 assumptions | A time-sortable run id would simplify ordering; no formula change. | High |
| For a closed (delivered) change, the latest record-bearing run's captured spend represents one complete pass over all durable context — the sessions that produced the landed result — so it is the defensible unique-progress proxy. | ASSUMPTION | GH-236 spec DEC-3 rationale ("by construction for a closed change") | A final run capturing only a slice of live sessions (bulk held by earlier runs) makes progress an underestimate and the ratio inflate without any restart loop; reopen-then-reclose deliveries misattribute deliberate rework. Revisit trigger 1. | Medium-High |
| Session-group granularity means a run's spend is exactly the sum of that run's records (opencode: one record per (session, agent, model) group; Claude Code: one per session). | FACT | `feature-harness-adapters.md` §5 | Per-run aggregation would need a different unit; formula unchanged in shape. | High |
| Real multi-run distributions and resume shapes (how often loops resume the same sessions vs abandon them; reopen-reclose frequency). | TO-CONFIRM | Unobservable until GH-240 wires production capture | The latest-run proxy's real-world fit is unvalidated; v0 honesty rests on fixtures plus disclosed limits. | — |
| Frequency with which a zero-token progress run co-occurs with paid > 0, and the degenerate paid = 0 ∧ progress = 0 case. *Update 2026-11-07: the degenerate case is now pinned by the Amendment (GH-236 v1.1 DEC-11); the real-world frequency observation remains open until GH-240.* | TO-CONFIRM | Fixture-constructed only today | The null rule (as amended) covers every zero-token progress run; only the real-world frequency stays open. | — |

## Mental Models & Techniques Used

- **First principles:** an append-only statistics log can prove *that* runs differ and *what* each cost; it cannot prove *what the tokens did*. Unique progress must therefore be a proxy with an inspectable definition, not an aspiration.
- **Inversion:** ask what would make the metric lie. A denominator counting superseded work as progress hides waste (reads ≈1 during a restart loop); a numerator narrower than all captured records hides spend; an unscoped claim of "duplication" overstates proof. The chosen formula closes the first two by construction and the third by the in-report honesty limits.
- **Second-order thinking:** M2-S6 will threshold alarms on this ratio and M1-S21 will route on its events; formula drift after those consumers lock in would silently recalibrate alarms — hence the stability contract (C-6) and reviewed-change discipline.
- **Systems thinking:** the metric is the fold + the honesty contract + the downstream envelope, not the division alone. The event decomposition is the bridge from signal to diagnosis; the ratio is the bridge from diagnosis to alarm.
- **Opportunity cost:** content-level duplication accounting would be more truthful but requires capture-side enrichment that the ticket pins out of scope; the run-identity ratio buys most of the operator value (R5 made visible) at zero upstream cost.
- **KISS:** paid ÷ latest-run, with a tie-break and a null rule, is explainable in one sentence — a property every alternative was checked against.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 log-only | C-2 healthy = 1 | C-3 named events | C-4 determinism | C-5 in-contract honesty | C-6 stable surface |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no amplification metric in v0 | ✅ (vacuous) | ❌ | ❌ | ✅ (vacuous) | ✅ (vacuous) | ❌ |
| ALT-1 aggregate ratio, no run decomposition | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| ALT-2 run-identity ratio, latest-run progress, per-run named events (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 sum-of-unsuperseded-runs (union-of-sessions) denominator | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| ALT-4 session-resume-chain amplification | ❌ | ❌ | ✅ | ⚠️ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via an accepted-risk exception (none taken; ALT-4's ⚠️ is moot because it is already eliminated by C-1). "(vacuous)" marks constraints that pass only because no metric exists to constrain them.

### Alternative 0 — Do Nothing / No Amplification Metric in v0

- **Eligibility:** Not eligible (fails C-2, C-3, C-6).
- **Summary:** Ship the spend breakdown (tokens, per-phase, per-agent, restarts) without any paid-versus-progress measure; defer amplification to M2.
- **Constraint compliance:** Fails C-2 and C-3 (no ratio, no events) and C-6 (no amplification block for M1-S21/M2-S6). Other constraints pass vacuously.
- **Driver fit:** Fails driver 1 outright — the R5 waste class stays invisible exactly as today, defeating R9's point of reading the side early.
- **Pros:** Zero additional design surface in v0.
- **Cons:** Binding ticket AC 2 unsatisfiable; M2-S6 remains blocked (spec §13) or consumes nothing; the status digest's spend section loses its headline signal.
- **Why rejected:** Fails the binding AC by construction.

### Alternative 1 — Aggregate Ratio Without Run Decomposition (naive paid ÷ single-run)

- **Eligibility:** Not eligible (fails C-3; and C-6 with it).
- **Summary:** Compute ratio = paid ÷ (the latest run's spend) and report the number alone — no supersession detection, no per-run events, no windows, no tokensWasted.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-5 (the honesty limits are statable). Fails C-3: the binding AC requires amplification events flagged **by name**; an undecomposed ratio cannot attribute a window or a token count to any run. Fails C-6 in consequence: there is no event surface to stabilize for M1-S21's routing signal.
- **Driver fit:** Partial on drivers 1 and 3 (the number moves), zero on driver 4's attributable-events half; the operator sees that waste happened but not where.
- **Pros:** Minimal fold; the arithmetic is identical to the chosen numerator/denominator.
- **Cons:** A ratio without attribution is an alarm without a cause — the operator cannot act, M1-S21 cannot route, and the ticket's own AC wording ("flags amplification events by name") is unmet.
- **Why rejected:** The decomposition is the diagnosis; the binding AC pins it.

### Alternative 2 — Run-Identity Ratio, Latest-Run Progress, Per-Run Named Events (chosen)

- **Eligibility:** Eligible.
- **Summary:** paid = the five-class token sum over all captured records for the ref; the progress run is the latest record-bearing captured run (captured-at descending, run-id ascending tie-break) and progress is its token sum; ratio = paid ÷ progress with the zero-progress null rule; each earlier record-bearing run with positive spend flags one named `restart-loop prefill re-pay` event carrying its window and `tokensWasted` = that run's spend. Full statement in Decision.
- **Constraint compliance:** Passes C-1 through C-6 (matrix above).
- **Driver fit:** Best on every driver: the R5 loop is visible and attributable (1); "paid ÷ the final run's complete pass" is one sentence (2); pure fold over verified records with pinned ordering keys (3); ratio and events both live in the always-present envelope (4); the limits ride the report (5); no upstream change (6).
- **Pros:** Healthy reads exactly 1 by construction (paid = progress — no estimation, no boundary cases); monotone in re-paid waste; every run's contribution is named, windowed, and quantified; the canonical R5 shape (a loop re-paying prefill across runs) grows the ratio with each superseded run.
- **Cons:** The denominator assumes the latest run's capture is a complete pass (see assumption table); supersession is proven at run granularity only; rework after a reopen is attributed to the restart-loop cause (Negative Outcomes).
- **Why chosen:** The only alternative that is eligible and dominant on drivers. See Decision.

### Alternative 3 — Sum-of-Unsuperseded-Runs / Union-of-Sessions Denominator

- **Eligibility:** Not eligible (fails C-3 and C-5).
- **Summary:** Define progress as the latest run **plus** every earlier run whose sessions never re-appear in a later capture (never-superseded runs count as progress, not waste); equivalently, progress = the spend of the union of distinct sessions, each taken at its latest capture.
- **Constraint compliance:** Passes C-1 (derivable from session ids and run ids in the records), C-2 (a single-run delivery still reads exactly 1), C-4 (deterministic), C-6 (envelope carries it). Fails C-3: `tokensWasted` per superseded run cannot be attributed consistently — under this denominator, a run's spend splits into re-captured (waste) and never-re-captured (progress) portions, and the log provides no mapping to divide them, so any per-run tokensWasted contradicts the ratio it accompanies. Fails C-5: the load-bearing claim — "sessions absent from the latest run were durable progress, not discarded work" — is precisely what the log cannot prove; stating it as a limit does not make the number honest, because the presumption biases the metric in the direction that hides waste.
- **Driver fit:** Fails driver 1 in the abandoned-session shape — exactly the shape crashed restart loops take — where discarded sessions count as progress and a genuine loop reads close to 1. Fails driver 2: the definition needs its caveat sentence to be interpretable, so it is not one-sentence honest.
- **Pros:** More charitable to legitimate handoff shapes (a final specialist run that legitimately builds on never-re-captured earlier sessions).
- **Cons:** The charitable reading is indistinguishable from the wasteful one in the log; the metric under-reports the operator's single largest waste class precisely when it occurs.
- **Why rejected:** An anti-conservative proxy: where the log cannot distinguish progress from discard, the metric must not default to the reading that hides waste. The chosen formula's latest-run denominator is the conservative (waste-maximal) reading, which matches the metric's purpose — surfacing waste for operator review — and its limits are stated rather than presumed.

### Alternative 4 — Session-Resume-Chain Amplification (capture-side enrichment)

- **Eligibility:** Not eligible (fails C-1; C-2 also not guaranteed by construction).
- **Summary:** Derive amplification from session resume lineage — count re-paid prefill as a function of resumed-session chains, using the tree-root and parent-chain references records already carry, with capture-side enrichment to make resume events first-class.
- **Constraint compliance:** Fails C-1: the delivered records carry tree root and parent chain as identity references only — there is no resume event, no cross-run linkage accounting, and no normalization across harness kinds (opencode session groups vs Claude Code one-record-per-session); producing a resume-chain accounting requires new capture-side primitives, which the ticket pins out (DEC-1, NG-3). Fails C-2: with chain-based semantics, healthy deliveries containing deep intra-run parent chains have no by-construction ≈1 guarantee. C-4 would additionally depend on harness-kind-specific semantics. The C-3/C-5/C-6 marks are moot given elimination.
- **Driver fit:** Would be strongest on truthfulness (driver 5) if it were derivable — it measures the actual mechanism (prefill re-send) rather than a run proxy.
- **Pros:** The most semantically faithful definition; distinguishes resume-re-pay from fresh work at the session level.
- **Cons:** Not derivable from today's log; requires capture changes the ticket forbids in this change; cross-harness semantics would make the metric harness-dependent.
- **Why rejected:** Out of evidence — the right answer to a different substrate. If capture-side enrichment ever carries resume or content-overlap accounting, revisit trigger 5 reopens this trade deliberately.

## Decision

- **Recommendation (tied to drivers):** Adopt ALT-2. The spec is the source of truth; the following pins restate GH-236 DEC-3 / DM-3 exactly, and this record must not diverge from them:
  1. **Paid (numerator).** `paid` = the five-class token sum over **all** captured records for the ref. A record's null token class is excluded from sums and never fabricated to zero; degraded records are disclosed in the `degradation` block (DM-1, DEC-2). Cost is never aggregated (NG-7).
  2. **Progress run (denominator).** The progress run is the **latest record-bearing captured run**, ordered by captured-at descending with run-id ascending tie-break (no run-id format property assumed); `progress` = that run's token sum under the same class rules.
  3. **Ratio and zero-progress rule.** `ratio` = paid ÷ progress. A delivery with exactly one record-bearing run reads **exactly 1** (paid = progress — the binding AC's "approximately 1" anchor, delivered as an exact deterministic value). **[Amended 2026-11-07 — spec GH-236 v1.1 DEC-11; supersedes the original "with paid > 0" scope:]** a zero-token progress run reports `ratio: null` — covering both paid > 0 and the degenerate paid = 0 ∧ progress = 0 case (every captured token class null, disclosed in the envelope's `degradation` block) — and the block carries `progressRun` naming that run in every null case where a record-bearing progress run exists; with no record-bearing run (capture-outcome-only store), `ratio` is `null` and `progressRun` is `null` (see the Amendment section below).
  4. **Named events.** One event per earlier record-bearing run with positive spend: `cause` = `restart-loop prefill re-pay` (a closed vocabulary with exactly this one v0 entry), `window` = `[previous record-bearing run's captured-at ‖ earliest transition timestamp ‖ point] → this run's captured-at` (the first run's window starts at the earliest transition timestamp; with no transitions it degenerates to a point), `tokensWasted` = that run's spend. Events sort by window start, then run id.
  5. **Honesty limits carried in the report's own terms.** The report states: run duplication is proven, semantic duplication is not; runs that never reached closeout capture are invisible; restart counts' capture-reached evidence basis is disclosed (AC-F5-3, RSK-1/RSK-3 mitigation).
  6. **Surface.** The machine envelope always carries the amplification block regardless of `--amplification`, which governs only the human digest section (DEC-9).
- **Worked shape (spec Appendix C, cited not restated as test data):** four record-bearing runs of 5.0M / 3.0M / 2.0M / 1.2M tokens → paid 11.2M, progress 1.2M, ratio ≈ 9.3, restarts 3, three named events — one per superseded run, each with its window and its spend as tokensWasted.
- **Reasoning — why the latest record-bearing run is the defensible progress proxy:** for a closed change, the final record-bearing run is by construction the pass that produced the landed state: its captured sessions carried the full accumulated context across the delivery, so its spend is one complete traversal of everything durable. Every earlier record-bearing run's spend was paid for work that a later run re-traversed — re-paid, superseded. In the canonical R5 shape (a resume loop re-paying prefill roughly ten times), each loop iteration is a record-bearing run and the ratio grows monotonically with each supersession. The proxy needs no estimation, no thresholds, and no clock — only an ordering key — so the healthy anchor is exact and the loop signal is monotone (drivers 1–3).
- **Reasoning — why conservative beats charitable where the log is silent (ALT-3):** when sessions vanish from later captures, the log cannot distinguish discarded work from completed-and-standing work. A metric whose purpose is to surface waste must take the waste-visible reading and disclose the choice; a metric that presumes the charitable reading under-reports the operator's largest waste class in exactly the crashed-loop shape that produces it. Where the log is silent, the bias direction is itself a decision — this one takes the conservative direction on purpose (driver 1, driver 5).
- **Boundary with DEC-5 (restart counting):** `restarts` = max(0, N − 1) over the **union** of run identities across **both** record families; the amplification progress/supersession basis is **record-bearing runs only**. A run present only as a capture outcome (no session-group records) counts toward restarts but holds no captured tokens, so it contributes zero paid tokens and raises no event — the two measures share the run-identity substrate, diverge only in evidence basis, and each discloses its basis in the flagging contract. They are consistent by construction: superseded record-bearing runs ≤ restarts.
- **Authorization:** Status `Proposed`. Human acceptance is recorded at GH-236 PR review; AI does not accept this R2 record.
- **Decider:** Juliusz Ćwiąkalski.
- **Conditions for revisit:** See `revisit_triggers`; the first GH-236 retrospective validates the formula's realized behavior against the fixture suite and (once GH-240 lands) real captures.

### Constraint Compliance Attestation

The chosen alternative (ALT-2) satisfies every constraint C-1 through C-6. No accepted-risk exceptions are taken. The honesty limits (semantic duplication unproven; pre-closeout runs invisible; latest-run completeness assumption) are disclosed limitations recorded under Trade-offs & Consequences and stated in the report's own output per C-5 — they are the boundary of the claim, not violations of it.

## Amendment (2026-11-07) — Spec GH-236 v1.1 DEC-11

> **Nature:** an additive refinement within this same decision — **not** a supersession. Source decision: GH-236 change spec v1.1, DEC-11 (applied verbatim in substance on `@spec-writer`'s instruction). The chosen alternative (ALT-2), the options matrix, the decision drivers, and the constraint set are unchanged apart from the two operative changes below and the noted C-6 applicability extension. Status remains `Proposed`; acceptance still rides GH-236 PR review.

**A-1 — Additive `progressRun` field.** The `delivery.spend.v1` amplification block gains one additive nullable field, `progressRun` (run-id-or-null), carrying the progress run's identity exactly when the progress run contributed zero tokens — the `ratio: null` case in which a progress run exists. It is `null` whenever progress > 0, and `null` when no record-bearing run exists. Grounding: a success envelope always carries at least one record — the no-records case is the classified `spend.telemetry-absent` outcome — but that guarantee is about record presence across **either** family (session-group or capture-outcome), not session-group presence: a capture-outcome-only store succeeds with zero captured session groups, hence no record-bearing run and no progress run to name. `progressRun` is therefore non-null exactly when `ratio` is `null` **and** a record-bearing progress run exists; when no record-bearing run exists, `ratio` is `null` and `progressRun` is `null` (spec v1.1 DM-3; test plan v1.1 §4.3/§8.2, TC-SPEND-019).

**A-2 — Null rule generalized.** The zero-progress null rule generalizes from "zero-token progress run with paid > 0" to cover paid = 0 ∧ progress = 0 (every captured token class null, disclosed in the envelope's `degradation` block). Governing statement: `ratio` is `null` whenever the progress run contributes zero tokens, whatever `paid` is.

**A-3 — Unchanged.** The block's pinned fields `ratio` (number-or-null) and `events[]` (`{cause, window, tokensWasted}`) are unchanged; there is no formula change, no cause-vocabulary change, and no event-rule change — pins 1, 2, 4, and 5 stand exactly as written, as do the DEC-5 restart boundary and every honesty limit.

**A-4 — C-6 applicability.** The stability contract's reviewed-change discipline applies to `progressRun` as it does to the rest of the block: changes ride a reviewed change plus a record addendum or supersession — never a silent redefinition.

**A-5 — Rejected alternative (on record per spec DEC-11).** Human-only run naming — naming the zero-progress run in the human digest only, keeping the machine block at `{ratio, events[]}`. Rejected because the machine-mode guarantee is AC-derived (AC-F5-3 requires the null case to name the run, and the envelope is the report's machine mode) and M2-S6 alarms consume run identities machine-readably.

**Editorial integration.** This amendment is marked in place at: the front-matter summary, the Context scope note, C-5 and C-6, the Evidence table's degenerate-case row, Decision pin 3, the Downstream stability contract, Unresolved Questions (item resolved), Implementation Plan items 1 and 3, and Verification Criteria (two added metrics).

## Trade-offs & Consequences

### Positive Outcomes

- **AC oracle stabilized.** AC-F5-1/2/3 are mechanically testable on fixture stores: the healthy anchor is exact (no "approximately" in the arithmetic), events are enumerable per superseded run, and ordering is pinned — downstream M1-S21/M2-S6 work proceeds against a frozen oracle.
- **Signal and diagnosis in one readout.** The ratio is alarm-thresholdable (M2-S6); the events give per-run, per-window, per-token attribution (M1-S21 routing, operator triage) — the decomposition ALT-1 lacked.
- **One substrate, two readouts.** Restarts (DEC-5) and amplification share run identity; the operator learns one model ("runs that reached closeout capture") and gets both the count and the economics of it.
- **Zero upstream cost.** No capture change, no schema bump, no new primitives, no new error rows beyond the pinned `spend.telemetry-absent`; the formula consumes only delivered vocabulary.
- **Bias direction chosen on purpose.** Where the log is silent, the metric prefers showing waste to hiding it — matching R9's reason for existing — and says so in-band.

### Negative Outcomes — what v0 cannot detect or may misread

- **Semantic duplication is invisible.** Re-reading files or re-reasoning within a continuing run (no new run id) reads 1; the metric proves run duplication only (NG-9, RSK-1 residual — a reader who skips the contract can still over-interpret).
- **Pre-closeout runs are invisible.** A run that crashed before closeout capture leaves no records; both restarts and amplification undercount (RSK-3; M1-S16's budget machinery may later enrich the evidence).
- **Rework is misattributed to the loop cause.** A change closed, reopened, and re-closed marks the earlier closeout's runs superseded: deliberate rework flags as `restart-loop prefill re-pay` and inflates the ratio. The v0 cause vocabulary has one entry and cannot distinguish rework from looping (revisit trigger 4).
- **The denominator assumes latest-run capture completeness.** Progress is the latest run's *captured* records; a final run capturing only a slice of live sessions (the bulk held by earlier runs) inflates the ratio without any restart loop (assumption table; revisit trigger 1).
- **Token parity, not cost.** All five classes count one token each, so cache-discounted re-pay (cacheRead at token parity with full-price input) understates *cost* amplification even where *token* amplification is visible; cost weighting is deliberately deferred (NG-7, M2-S6 family).
- **Event windows are capture-time derived.** Windows come from run captured-at stamps and phase transitions (earliest-transition fallback for the first run); they inherit capture-time attribution coarseness (DEC-4 boundary, RSK-2) and are intervals of ledger time, not of session activity.

### Downstream stability contract

`delivery.spend.v1`'s amplification block (`ratio`, `events[]`, and the additive `progressRun` — *amendment of 2026-11-07, GH-236 v1.1 DEC-11*) is the pinned machine surface. M1-S21 and M2-S6 consume the envelope, never the human digest. Any change to the formula, the cause vocabulary, the null rule, or `progressRun` (*per the amendment's C-6 applicability*) rides a reviewed change plus a decision-record addendum or supersession — never a silent redefinition (GH-236 spec §22 names the formula a contract surface).

### What M2-S6 may add without reopening this record

Alarm thresholds on the ratio; burn-rate normalization; additional closed causes (a deliberate vocabulary extension through a reviewed change); cost-weighted amplification once cost capture is reliable; per-phase or time-windowed amplification. None of these alters the v0 pins above; each extends beside them.

### Unresolved Questions

- [x] The degenerate case paid = 0 ∧ progress = 0 (records exist but every class is null/zero) is not separately pinned by the zero-progress rule, which covers paid > 0; resolve at plan/test-plan time inside the existing degradation disclosure — no formula change anticipated (owner: `@plan-writer` / `@coder`, GH-236). **Resolved 2026-11-07 by the Amendment (GH-236 v1.1 DEC-11): the null rule now covers this case, disclosed via `degradation`, with `progressRun` naming the run.**
- [ ] Real-world validation of the latest-run-is-progress assumption once GH-240 wires the production composer; the first retro compares fixture expectations against real multi-run histories (owner: Juliusz Ćwiąkalski; revisit trigger 1).
- [ ] Reopen-reclose frequency, and whether a distinct rework cause is warranted before M2-S6 thresholds lock in (owner: `@decision-advisor` with M2-S6 planning; revisit trigger 4).

## Implementation Plan

1. **Contracts:** the `delivery.spend.v1` data shape including the amplification block (`ratio` number-or-null, `events[]` of `{cause, window, tokensWasted}`, and `progressRun` run-id-or-null — *added by the 2026-11-07 amendment, GH-236 v1.1 DEC-11*) as types and `as const` data only, composing the delivered harness-telemetry vocabulary; no runtime API.
2. **Fold:** a pure deterministic read-side computation over verified reads of both `harness.telemetry` families plus `phase.transition` history; ordering keys captured-at / run-id; no clock, network, or model calls anywhere in the path (NFR-2/NFR-3).
3. **Fixtures:** single-run healthy (ratio exactly 1, empty events), multi-run loop (per-run events, windows, deterministic sort), zero-progress null case, degraded-record exclusion, no-transition window fallback, and telemetry-absent classification — the AC-F5 evidence set; *added by the 2026-11-07 amendment: the degenerate paid = 0 ∧ progress = 0 fixture (ratio null, `progressRun` naming the run, `degradation` disclosure) and the `progressRun`-null-when-progress > 0 assertion.*
4. **Error identity and exits:** the single pinned `spend.telemetry-absent` row and its exit projection per DM-5/DEC-7; no other rows move.
5. **Digest flip:** status digest section 8 fed by the same fold per DM-6, landing in the same change so pinned invariants never contradict output.
6. **Docs:** phase-7 system-spec update authors the spend feature page; this record joins the change spec's `links.decisions`; the man-page pack reconciles to the pinned contract (spec Appendix B).
- **Guardrails:** no capture-path change and zero harness-store reads on every path (C-1); the cause vocabulary stays closed at exactly one v0 entry; any formula change requires a reviewed change and a record addendum or supersession (C-6).

## Verification Criteria

- Metric: healthy single-run fixture → ratio exactly 1, events empty — Target: 100% — Window: GH-236 CI (AC-F5-1).
- Metric: multi-run fixture → one event per superseded record-bearing run with exact cause/window/tokensWasted and deterministic sort — Target: 100% — Window: GH-236 CI (AC-F5-2).
- Metric: zero-progress fixture → `ratio: null` with the run named — Target: 100% — Window: GH-236 CI (AC-F5-3).
- Metric: `progressRun` field — carries the progress run's identity exactly when `ratio` is `null` **and** a record-bearing progress run exists; `null` whenever progress > 0 or no record-bearing run exists — Target: 100% — Window: GH-236 CI (*Amendment 2026-11-07, GH-236 v1.1 DEC-11; TC-SPEND-019*).
- Metric: degenerate fixture (every captured class null; paid = 0 ∧ progress = 0) → `ratio: null`, `progressRun` naming the run, `degradation` disclosing the null classes — Target: 100% — Window: GH-236 CI (*Amendment 2026-11-07, GH-236 v1.1 DEC-11*).
- Metric: honesty-limit statements rendered in-band on successful amplification reports — Target: 100% — Window: GH-236 CI + review (AC-F5-3, RSK-1).
- Metric: byte-identical repeat renders in both modes with zero model calls — Target: 100% — Window: GH-236 CI (NFR-2).
- Metric: harness-store reads on any invocation path — Target: 0 — Window: GH-236 CI (AC-F2-1, C-1).

## Confidence Rating

**High** for derivability, determinism, and AC satisfiability: every input is a delivered primitive (record kinds, token classes, run ids, injected captured-at stamps, transition history), the healthy anchor is exact by construction, and the fold machinery has delivered precedent. **Medium** for real-world fit of the latest-run progress proxy until GH-240 produces real multi-run histories — v0's honesty rests on fixture proof plus disclosed limits, not on observed distributions (`TO-CONFIRM`). AI-generated confidence is not evidence; the fixture suites are.

## References

- GH-236 change spec (DEC-3/DM-3/DM-4/DM-5, F-5, AC-F5-1..3, NFR-2/NFR-3, RSK-1..RSK-3, §14 OQ-1, Appendix A/C): `doc/changes/2026-11/2026-11-07--GH-236--spend-read-side/chg-GH-236-spec.md`
- Ticket GH-236 (M1-S19, binding ACs and pinned decisions): https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/236
- State-layer current truth (harness.telemetry record kinds, idempotency, verified reads): `doc/spec/features/feature-state-layer.md`
- Harness adapters current truth (§5 telemetry extraction — what records carry; §6 closeout capture — composer absent until GH-240): `doc/spec/features/feature-harness-adapters.md`
- Operator requirements (R5 resume-loop prefill re-payment; R9 per-ticket spend accounting): `doc/planning/oss-tooling/operator-requirements-2026-11.md`
- Backlog ranking (M1-S19 "read side early" rationale): `doc/planning/oss-tooling/backlog-ranking.md`
- [ADR-0008](ADR-0008-harness-adapter-contract.md) — harness adapter contract owning the telemetry record vocabulary
- [TDR-0004](TDR-0004-state-storage-engine.md) — state storage engine (verified reads, presence tolerance)
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — exit taxonomy the `spend.telemetry-absent` (exit 1) outcome rides on
- [TDR-0009](TDR-0009-retro-evidence-sidecar-keyed-chain-construction.md) — the GH-232 spec-OQ-1 → standalone-TDR precedent this record follows
