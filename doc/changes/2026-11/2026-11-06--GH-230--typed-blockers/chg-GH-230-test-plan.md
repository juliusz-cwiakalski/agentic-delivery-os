---
id: chg-GH-230-test-plan
status: Updated
created: 2026-11-06T07:15:00Z
last_updated: 2026-11-06T09:30:00Z
owners: [engineering]
service: delivery-os
labels: [m1, blockers, coordinator, attention-plane]
version_impact: minor
summary: "M1-S16 typed blocker and question channel: prove that a blocked lane publishes a durable, typed, audience-routed question instead of stalling in prose; that a cross-audience answer is refused with the delegation policy named while the question stays open (SC-M1-24); that an accepted answer is recorded as data with a laneResume projection that resumes at the phase boundary without a new session spawn or a session touch (SC-M1-13); that credential values are structurally refused on every content path and on the lane/ref identifier fields (AC-F3-4) with zero persisted bytes while arbitrary unregistered token-like prose is not shape-refused (TDR-0011); that the four closed types and their per-type answer channels validate deterministically; that one shared pure ranking (priority class -> oldest asked-at -> id) drives the blockers list, the new digest typed-questions section, and the real brief blocker-questions anchor with answered records never interleaved; that the brief placeholder retires (catalog 3 -> 2, anchors 2 -> 3, surfaces stay 9); that v0 records applied:false and the resume-prompt-reentry fallback with its prefill cost visible; and that the new four-row blockers error family, purity/tier confinement, bounds, determinism, privacy, read cost, and 50 ms performance all hold. 43 named TCs cover all 21 acceptance criteria, all 7 NFRs, both seeded milestone scenarios, EVT-1/EVT-2, DM-1..DM-6, and all 8 spec risks."
links:
  change_spec: ./chg-GH-230-spec.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S16: Typed blocker and question channel

## 1. Scope and Objectives

This change turns lane blockers from prose and silence into a typed, ranked, answerable channel. The tests must prove six properties at once. **First, the question survives the session that raised it:** publish validates a closed four-value type, a closed audience, a non-empty lane, and bounded content, then appends exactly one immutable `DM-1` record under a store-scoped key; open/answered status is derived from answer presence, never stored; a torn, wrong-kind, malformed, or duplicated history is classified and never served as truth, while an absent store is explicit verified-empty evidence (`AC-F1-1`, `AC-F1-2`, `NFR-7`). **Second, the wrong answerer is structurally refused:** every question carries `owner` or `coordinator`, publish defaults to `coordinator`, the answering audience is resolved from an injected environment fact, and a coordinator answering an owner question is refused with `blockers.audience-mismatch`, exit 1, `not_landed`, the audience named, and the exact policy token `delegation policy: none`; the question remains open and no answer record lands (`SC-M1-24`, `AC-F4-1`). Policy-as-data may explicitly delegate, and nothing else may (`AC-F4-2`). **Third, credential values never transit the channel:** layer 1 refuses any content path — and, per spec v1.2, the `lane`/`ref` identifier fields — containing a registered secret value before any record lands, with zero persisted bytes and the name-only remediation hint; layer 2 restricts `credential-missing` question text to the declared variable-name shape; and negative controls prove that unregistered token-like prose is *not* shape-refused, which is TDR-0011's documented accepted residual (`AC-F3-1`, `AC-F3-2`, `AC-F3-3`, `AC-F3-4`, `NFR-6`). **Fourth, an answer is data, not a session action:** the accepted answer is one authoritative `DM-2` intent record with a recorded `laneResume` projection; a capability-declaring adapter projects `boundary-note` or `attach-continue` with `sessionReentry: false` and no new session spawn; an absent capability projects `resume-prompt-reentry` with `sessionReentry: true` and the prefill cost visibly marked; v0 records `applied: false` and touches no session (`SC-M1-13`, `AC-F5-1`, `AC-F5-2`, `AC-F5-3`, `DEC-5`). **Fifth, attention is one ranking, not three:** the blockers list, the new digest `typed-questions` section, and the brief's real `blocker-questions` anchor consume one shared pure ordering (type-derived priority class, then oldest asked-at, then id ascending), expose audience and rank per question, never interleave answered records among open ones, and declare truncation with omitted counts; a published question surfaces on the first subsequent `status`, `brief`, or `blockers list` invocation because v0 reads the store directly (`AC-F6-1`..`AC-F6-4`, `DEC-6`..`DEC-8`). **Sixth, the surface is safe and boring:** the four-row `blockers` error family is the only new identity family; malformed answer bodies reuse `input.value.rejected`; state faults keep their delivered exit projections (platform-class exit 2, `state.permission.denied` exit 1); text and machine output are bounded, deterministic, brand-neutral, and free of credential values; the pure domain has no I/O, clock, randomness, environment, or network; and `status`, `brief` change only through the declared section/surface/catalog/anchor edits while every other command and the owner-gate board stay byte-stable (`NFR-1`..`NFR-5`, `§8.5`, `RSK-5`).

The plan is deliberately adversarial about the failure modes this story exists to prevent. The first is **silent stalling**: a published question that does not surface, a ranking that the digest and brief fork, a truncation that hides the top-ranked coordinator question, or a torn store that renders as an empty all-clear. Every positive is paired with a restored control, and the three-surface order is asserted over one store with a changed-fact control. The second is **secret transit**: a layer-1 miss on an option value, a layer-2 overreach that refuses legitimate prose, a refusal that still appends a byte, or a secret echoed in an error hint. Every credential negative asserts zero ledger bytes and the absence of the secret in every output, and every shape refusal is paired with a non-refusal negative control that pins TDR-0011's accepted residual. The third is **misread application**: a fixture or golden that follows the pack's illustrative `applied: true` instead of the pinned v0 `applied: false`, a "resume" that spawns or attaches a session, or an answer record mistaken for an executed action. The session-touch spy and the explicit v0-posture TC make that misread fail loudly.

The plan also pins the seams later stories depend on: the audience dimension is consumed from the delivered owner-gate seam rather than re-invented; the delegation map, type-priority map, answer-channel map, variable-name shape, bounds, and error rows are contract data; the ranking is one pure function; the answer record is the durable intent `M1-S18`, `M1-S23`, `M1-S9`, and `M1-S20` will consume; and the digest section is the stable fact `M1-S10` will expand around. No wake, daemon application, session resume, MCP mirror, out-of-band delivery, or owner-gate conversion is tested here, because none ships here.

### 1.1 In Scope

- Contract vocabulary as data: the closed four-type set with per-type answer channels, the closed audience set reused from the owner-gate seam, the type-derived priority classes, the four-row delegation policy, the variable-name shape, the three `laneResume` modes and two capability sources, the record kinds/payload schemas, the content and render bounds, and the four `blockers` error rows (`F-1`..`F-7`, `DM-1`..`DM-6`, `NFR-4`, `NFR-5`).
- Publish: valid typed question append, validated type/audience/lane/content, generated `q-` id, optional `ref` (null in v0), ordered options for `decision-needed`, injected clock `askedAt`, exit 0, one fenced append with post-append coverage verification (`AC-F1-1`, `AC-F2-1`, `DEC-11`, `NFR-2`, `NFR-7`).
- Derived closure and immutable records: open/answered derived at read time, question bytes never rewritten, one authoritative answer per question id, second answer refused, duplicate/torn/wrong-kind/malformed history classified (`AC-F1-2`, `AC-F2-2`, `NFR-7`).
- Type and answer-channel validation: all four types accepted; unknown/case-variant type refused `blockers.invalid-type`; choice only for options-bearing `decision-needed`; text for the other three; out-of-range index, wrong channel, both/neither channel, empty text, and answer-to-answered refused `input.value.rejected`; option count/length and content caps enforced (`AC-F2-1`, `AC-F2-2`, `NFR-4`).
- Credential guard: layer 1 registered-secret-value refusal on question text, option values, free-text answers, and the `lane`/`ref` identifier fields (spec v1.2, AC-F3-4) with `blockers.credential-value-rejected`, exit 1, `not_landed`, zero persisted bytes, and the name-only/environment hint; layer 2 variable-name-shape refusal on `credential-missing` question text; the same registered-secrets record as the serialization redaction chokepoint; legitimate system-generated identifiers (`L2`, `GH-230`-style refs) accepted; and TDR-0011 negative controls proving no shape-based refusal of unregistered token-like prose outside the `credential-missing` question text (`AC-F3-1`..`AC-F3-4`, `NFR-6`, `RSK-2`).
- Audience routing: closed audience on every question, publish default `coordinator`, invalid explicit audience refused, caller-audience environment fact resolved through the branding seam, absent fact defaults to `owner`, the four-row delegation map total and policy-driven, the confused-deputy refusal pinned by `SC-M1-24`, and the policy-as-data delegation exception (`AC-F4-1`..`AC-F4-3`, `DEC-3`, `DEC-4`, `RSK-3`).
- Answer-as-data and `laneResume`: one `DM-2` record with question id, answering audience, choice option value or bounded text, `answeredAt`, `applied: false`, and the `laneResume` projection; capability-declared `boundary-note`/`attach-continue` with `sessionReentry: false` and source `adapter-declared`; capability-absent `resume-prompt-reentry` with `sessionReentry: true`, source `capability-absent`, and the prefill cost visible on the machine payload and human line; zero session spawn/attach/resume/steer calls; the `SC-M1-13` round-trip pinned (`AC-F5-1`..`AC-F5-3`, `DEC-5`, `RSK-6`).
- Shared ranking and attention surfaces: priority class -> oldest asked-at -> id ascending; answered group after all open, age order; identical order and rank on the list, digest section, and brief anchor; digest `typed-questions` section with type/audience/lane/age/rank and the pickup predicate determinable from the payload; brief surface id stable as a section mirror, placeholder catalog 3 -> 2, anchors 2 -> 3 in decision-first order, surfaces stay 9; first-subsequent-invocation surfacing in v0 (`AC-F6-1`..`AC-F6-4`, `DEC-6`..`DEC-8`).
- Degradation: torn/wrong-kind/malformed store yields the digest/brief `state-unreadable` section state at exit 0 with zero fabricated questions, and the blockers command's classified `state.*` exit 2; an absent store is explicit verified-empty, never a silent zero (`AC-F1-2`, `F-6`, `§12`).
- Error surface and exit projection: `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch` all user-validation, exit 1, `not_landed`; malformed answer bodies reuse `input.value.rejected`; state faults reuse the delivered `state.*` rows at their declared exit projections; exit 0 listed/answered; documented/machine/fixture sync stays green (`NFR-5`, `DEC-9`, `§8.5`).
- Structure and confinement: contracts declaration-only, pure domain imports only `#contracts` and sibling domain modules with no I/O/clock/randomness/env/network/child process, state consumer behind the injected port, CLI handler returns data/failure and writes no stream and chooses no exit literal, inventory/subpath/boundary registration (`ADR-0003`, `ADR-0007`, `§16`).
- Non-functional: bounds and explicit truncation, byte-identical determinism, privacy/no-secret persistence, one read + one fenced append per mutation, zero outbound requests, and ≤ 50 ms pure validation/guard/ranking/rendering (`NFR-1`..`NFR-4`, `§20`, `§21`).
- Committed fixtures, corpus, and golden evidence with a fixed fixture clock, a fixed run id, a synthetic brand, synthetic secrets only, and zero live calls in default CI (testing strategy).
- The two seeded milestone scenarios by ID: `SC-M1-13` (TC-BLK-025) and `SC-M1-24` (TC-BLK-022). Their exact expectations are pinned in §4.3; divergence after delivery is a defect.

### 1.2 Out of Scope & Known Gaps

- [OUT] Daemon application of answers and control-socket wake — M1-S18 (GH-238). This plan tests recorded intent, not application.
- [OUT] Coordinator supervision and wake enforcement of the pickup contract — M1-S23 (GH-241). This plan tests that the predicate is determinable from the digest payload, not that anything wakes.
- [OUT] The one-shot `dispatch --resume` path — M1-S9 (GH-239). No resume is executed.
- [OUT] Real harness adapters and their resume-injection capability — M1-S11 (GH-233). The capability is consumed as an injected fact; the v0 production composition records the fallback with `applied: false`.
- [OUT] The invocation audit ledger and caller-identity authentication — M1-S22 (GH-223). The caller audience is claimed-not-proven; no audit record is written.
- [OUT] Out-of-band question delivery (push, email, chat) or any notification broadcast.
- [OUT] MCP or host-integration mirrors of the channel — M1-S7.
- [OUT] Configuration keys for types, priorities, delegation, audiences, or bounds — contract data only.
- [OUT] Owner-gate→question conversion or joint owner-ask rendering — the board remains the owner-gate SLA surface (`DEC-10`); this plan asserts the board is unchanged.
- [OUT] Question expiry/TTL, closure sweeps, supersession, re-opening, per-lane quotas, and deduplication of identical questions — no consumer exists.
- [OUT] Live GitHub/E2E testing. Every blockers suite is hermetic and in-process; no default-CI live call is made.
- [GAP-1 — implementation-plan mapping — PENDING] The implementation plan is authored in `delivery_planning` (phase 4) and does not exist yet. It must map all 43 TCs onto delivery phases without reshaping any TC's behaviour, states, reasons, bounds, assertions, or AC/NFR mapping. Any later plan or implementation that changes a pinned contract reopens this test plan.
- [GAP-2 — §8.5 non-regression wording — RESOLVED BY SPEC v1.2, two declared exceptions] Spec v1.2 §8.5 now declares exactly two exceptions: `status` gains the seventh fixed `typed-questions` section, and `brief`'s `typed-questions` surface gains real ranked questions (placeholder catalog 3 -> 2, anchors 2 -> 3, surfaces stay 9). Every other command — including `board` — stays byte-stable. Tests assert those invariants, not full byte-equality of the two changed goldens.
- [GAP-3 — KPI wording — RESOLVED BY SPEC v1.2, KPI reworded] Spec v1.2 §4.1 now reads "Policy-refused cross-audience answers applied: 0", explicitly noting that the owner→coordinator combination is allowed per `DEC-3`/`AC-F4-2` and is not counted. Tests follow `AC-F4-1`/`AC-F4-2` and `DEC-3`; the previous reading is now the spec's own wording.
- [GAP-4 — digest section and brief surface position — delivery-bound] The spec pins that the digest gains a `typed-questions` section "in the fixed section order" and the brief surface keeps its id, but not the absolute index. Chosen reading: the order is contract data; the six existing digest ids retain their relative order and `typed-questions` appears exactly once (seven total); the brief's `typed-questions` surface appears exactly once among seven section mirrors plus two placeholders (nine total); tests assert totality, id stability, and the existing relative order, not an absolute index. The chosen index is pinned by the golden (OQ-T7).
- [GAP-5 — input bound violations — RESOLVED IN THIS PLAN, family stays closed] The spec declares content caps (question ≤ 120 characters, options ≤ 4 × 60, answer ≤ 160) and says every drop/clamp is marked, but does not name the error for an over-cap *input*. Chosen reading: over-cap or empty publish/answer content is refused with the delivered `input.value.rejected` identity (exit 1, `not_landed`), never silently clamped; render-side truncation is separate and marked. A `decision-needed` publish with missing/empty/over-count/over-length options is likewise `input.value.rejected`; an `--options` flag on a non-options type is `input.value.rejected`. This keeps the four-row family closed (`DEC-9`) and makes the malformed-option case testable.
- [GAP-6 — age, rank, status, and substance representations — delivery-bound] The spec pins the *behaviour* (age derived from `askedAt` and the injected clock, never stored; rank derived from the shared ordering; open/answered derived from answer presence; answer substance is the selected option value or bounded text) but not every field spelling. Chosen reading: `age` is a non-negative declared-unit value equal to the declared conversion of `now − askedAt` and is monotonic with the clock; `rank` is an integer 1..N for open questions; a declared status discriminator distinguishes open/answered; the answer payload uses `choice` for the selected option value and `text` for free text. Answered entries carry no numeric open rank and render after all open ones. Tests read the declared data rather than hard-coding a spelling.
- [GAP-7 — duplicate/unservable answer history — RESOLVED IN THIS PLAN, fail-closed] `NFR-7` requires duplicated histories to be classified, but does not name the code. Chosen reading: a semantic duplicate answer for one question id, and an integrity-torn ledger, fail closed with `state.store.torn`; an undeclared record kind or payload schema fails with `state.store.unknown`. Blockers commands exit 2; the digest/brief render `state-unreadable` at exit 0. Neither is served as truth, and no second answer is applied.
- [GAP-8 — resume-mode selection within a capability-declaring adapter — delivery-bound] `AC-F5-1` accepts `boundary-note` or `attach-continue` when resume injection is declared, without a selector rule. Chosen reading: the injected capability fact may name the preferred mode; when it does, the recorded mode equals it; when it does not, the recorded mode must still be one of the two, stable for identical facts, and never `resume-prompt-reentry`. Tests assert membership, source, determinism, and the mutation-liveness of the declared mode, not a hard-coded default (OQ-T5).
- [GAP-9 — prefill-cost marker — delivery-bound] `DM-3` requires a "declared prefill-cost marker visible on the fallback" without a field name or value. Chosen reading: a declared marker/estimate field is present exactly on `resume-prompt-reentry`, and the human line visibly names the cost; it is absent on `boundary-note`/`attach-continue`. Tests assert presence/absence and human visibility, not a numeric value.
- [GAP-10 — caller-audience environment fact name and unrecognized values — delivery-bound] `DEC-4` names the fact's provenance and the absent default (`owner`) but not the variable spelling or the treatment of an unrecognized value. Chosen reading: the variable name derives from `brand.environmentPrefix` plus a declared suffix and is never a committed literal; only the exact value `coordinator` selects the coordinator audience; `owner` selects owner; an absent fact defaults to `owner`; an unrecognized value behaves as absent (owner) under the claimed-not-proven model. Tests derive the variable from the synthetic brand and never hard-code a product prefix (OQ-T6).
- [GAP-11 — publish payload shape, `ref` supply, and options shape — delivery-bound] The man page pins `questions[]` on list and answer fields on answer, but not the publish payload; the publish synopsis has no `--ref` flag; `options[]` is "options-bearing types only". Chosen reading: publish's `data` exposes the created question id and its DM-1 fields through a declared shape (the ledger/verified read is the authoritative oracle); `ref` is `null` in v0 because no synopsis flag supplies it; the list payload always carries `options` as an array, empty for non-option types, so the shape is stable. If delivery adds `--ref` or changes the array shape, this plan and the golden reopen.
- [GAP-12 — lane/ref length and machine/human clamping — RESOLVED IN THIS PLAN, by the declared bound] The spec bounds question text, options, answers, rendered questions, machine bytes, and human lines/bytes, but not lane or ref length. Chosen reading: no new input cap is invented; the renderer must clamp or truncate lane/ref (and any other unbounded rendered field) so the machine ≤ 65 536-byte and human ≤ 24-line/4 096-byte bounds hold, with an explicit clamp/omission marker. A hostile-length fact must not produce an over-bound payload or a silent drop.
- [GAP-13 — digest question counts semantics — delivery-bound] `DM-6` says the section carries "standard five-value state and counts", but not what each count means for questions. Chosen reading: `counts.total` is the open-question count (answered excluded), `counts.omitted` is the dropped count, `truncated` is true iff items were dropped, and `observed + unknown = total`; the exact observed/unknown split is delivery-bound but internally consistent. Tests assert open-only counting and the omitted/truncated relationship, not a hard-coded split.
- [GAP-14 — one collection cycle in v0 — structural] `DEC-6` pins v0 collection as per-invocation; the daemon interval does not exist. Chosen reading: the one-cycle bound is proven by sequential invocations over one temp store root (publish, then the next `status`/`brief`/`blockers list`), with no timer, daemon, or cache. The daemon-interval preservation is M1-S18's and is not tested here.
- [GAP-15 — layer-1 scope and identifier fields — RESOLVED BY SPEC v1.2, new AC-F3-4] Spec v1.2 extends layer 1 to the `lane` and `ref` identifier fields by a PM-decided change-scoped scope extension (flagged for owner review in the PR): a registered secret value in either field is refused `blockers.credential-value-rejected`, exit 1, `not_landed`, zero persisted bytes; legitimate system-generated identifiers (`L2`, `GH-230`-style refs) are accepted, and no shape-based refusal is implied. The previous residual note is superseded. AC-F3-4 is mapped to TC-BLK-043, with the shared registered-secrets record still covered by TC-BLK-018.
- [GAP-16 — man-page exit shorthand vs delivered state projections — RESOLVED BY SPEC v1.2, Appendix A clarification] Spec v1.2 Appendix A now declares that the man page's "2 platform faults" is shorthand: platform-fault exits defer to the delivered error-table rows — `state.permission.denied` is user-validation exit 1, `state.store.torn`/`state.lock.busy` are platform-provider exit 2 — and the `blockers` family adds no exit-2 row (all four are user-validation exit 1). Tests follow the machine table; the previous reading is now the spec's own semantics.
- [GAP-17 — two-segment `blockers.*` codes vs the delivered error-table format gate — RESOLVED BY SPEC v1.2, exact allowlist constraint in DEC-9] All four pinned codes (`blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch`) are *two-segment* codes. The delivered `scripts/checks/error-table-sync.ts` `CODE_FORMAT` requires at least three segments unless the exact code is in `RESERVED_TWO_SEGMENT_CODES` (currently `provider.outage` plus the three `watchdog.*` codes); `tests/structure/error-table.test.ts` carries the same exact set. Spec v1.2 §15 (DEC-9 implementation constraint) now pins the delivery requirement: add exactly these four codes to the *exact* `RESERVED_TWO_SEGMENT_CODES` set in both the check and the structure test — no generic two-segment widening, no namespace wildcard — so the rows validate, the S1/S3 scanner recognizes them, and a fifth/near-miss `blockers.*` code still fails. The plan's pinned reading is now the spec's constraint; TC-BLK-007 asserts it.

## 2. References

- **Change specification**: [chg-GH-230-spec.md](./chg-GH-230-spec.md) — F-1..F-7, AC-F1-1..AC-F7-3 (20), NFR-1..NFR-7, EVT-1/EVT-2, DM-1..DM-6, RSK-1..RSK-8, DEC-1..DEC-11, OQ-1 (resolved), Appendix A (pack anchors and caveats), Appendix C (v0 recorded-versus-applied matrix).
- **Decision record**: [TDR-0011 — blockers credential-guard pattern deferral](../../../decisions/TDR-0011-blockers-credential-guard-pattern-deferral.md) — the guard stays two-layer (registered-secret-value match on every content path plus variable-name shape on `credential-missing` question text), no token-shape pattern layer, the unregistered-value residual is documented and owned, and any future pattern adoption takes a system-level shared-content-policy shape. This plan's TC-BLK-020 is the executable statement of that residual.
- **Architecture decisions**: [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (package tiers, contracts/domain/state/CLI placement, no new runtime-API location); [ADR-0007](../../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) (pure core over injected facts); [ADR-0008](../../../decisions/ADR-0008-harness-adapter-contract.md) (harness capability flags and explicit gaps — the resume-injection fact consumed here); [ADR-0005](../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) (runtime confinement).
- **Owner-gate precedent**: [PDR-0003](../../../decisions/PDR-0003-owner-gate-sla-default-map.md) — policy-as-data, closed maps, owner-signed rows; the audience seam, rank-key discipline, bounds, and truncation precedent reused here.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden,types}`, `scripts/checks/*.ts` mutation tests, `pnpm check`, permanent-suite rules, fixture conventions.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, the error contract, `bun:test` authoring, golden-file discipline.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — append-only schema-versioned JSONL ledger, verified reads, verified-empty evidence, single-writer fences, torn-state classification, validated artifact boundaries, additive record kinds, append/coverage-verify precedent.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — `CommandResult` envelope, `DOMAIN_KINDS`, documented/machine/fixture sync gate, `{0,1,2}` projection, single redaction chokepoint over the registered-secrets record, fallback containment.
- **Status digest**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — fixed section order, five-value section state, closed reason set (`state-unreadable`), counts/evidence/truncation model, section failures are payload data, bounds.
- **Brief**: [feature-brief.md](../../../spec/features/feature-brief.md) — nine-surface totality, closed placeholder catalog, decision-first anchor order (`ready-to-merge`, blocker questions, owner-gate ages), stable `typed-questions` surface id, human grammar, goldens.
- **Owner-gate SLA**: [feature-owner-gate-sla.md](../../../spec/features/feature-owner-gate-sla.md) — the `owner \| coordinator` audience seam, policy-as-data, severity-class ranking, bounds/truncation, board as the SLA surface.
- **Watchdog and lane contracts**: [feature-watchdog-lane-contracts.md](../../../spec/features/feature-watchdog-lane-contracts.md) — lane vocabulary and the injected lane reader behind `--lane <id>`.
- **Branding seam**: [feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) — injected binary name and environment-prefix naming discipline for the caller-audience fact.
- **Privacy guard**: [feature-privacy-guard.md](../../../spec/features/feature-privacy-guard.md) — the system's pattern-detection precedent and the rule-governance discipline TDR-0011 defers to.
- **Planning pack**: `doc/planning/oss-tooling/milestones/m1/commands/blockers.md` (proposed command contract, output, exit status, errors, worked examples); `doc/planning/oss-tooling/milestones/m1/contracts.md` (§`blockers`); `doc/planning/oss-tooling/milestones/m1/test-scenarios.md` (`SC-M1-13`, `SC-M1-24`); `doc/planning/oss-tooling/milestones/m1/interactions.md` (Session C); `doc/planning/oss-tooling/backlog.md` (M1-S16); `doc/planning/oss-tooling/cli-command-registry.md` (`blockers` row). The pack's worked `applied: true` answer and its `--text` publish form are illustrative and are not asserted; the pinned v0 posture (`applied: false`) and the synopsis positional question text are authoritative (`Appendix A` caveats).
- **Existing mechanisms**: `tests/fixtures/state/harness.ts` (temp store, identity, faults, ledger inspection, fence); `tests/fixtures/brief/harness.ts` and `tests/fixtures/status/harness.ts` (injected facts, fixed clocks); `tests/golden/helpers.ts` (`runCli`, synthetic brand, fixed run id, buffer sinks); `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/behaviour/{state-torn,state-evidence,closeout-idempotency,closeout-credential}.test.ts` (classification, verified-empty, exactly-once, credential-identity patterns); `tests/behaviour/{brief-*,status-*}.test.ts` (surface, corpus, determinism, bounds patterns); `tests/structure/{error-table,brief-contract,status-contract,owner-gate-sla-*,branding-seam,subpaths,content-inventory}.test.ts`; `tests/checks/{error-table-sync,secret-read-boundary,forbidden-literals}.test.ts`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; `tests/boundaries/**`.
- **Ticket**: GH-230 — M1-S16: Typed blocker and question channel.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | A valid publish appends exactly one `DM-1` question record under its store-scoped key, returned by a verified read with all fields intact, exit 0 | TC-BLK-009, TC-BLK-010 | Covered |
| AC-F1-2 | Torn, wrong-kind, or malformed blocker history is classified (`state.store.torn` family or digest `state-unreadable`), never served as truth, never a silent zero; an absent store is explicit verified-empty | TC-BLK-011, TC-BLK-033 | Covered |
| AC-F2-1 | A publish with a type outside the closed four-value set is refused `blockers.invalid-type`, exit 1, `not_landed`, nothing persisted | TC-BLK-014 | Covered |
| AC-F2-2 | Channel mismatch (choice on options-less, text where choice required, out-of-range index) or an answer to an already-answered question is refused `input.value.rejected`, exit 1, `not_landed`, authoritative answer unchanged | TC-BLK-015, TC-BLK-016, TC-BLK-012 | Covered |
| AC-F3-1 | A publish or answer whose content contains a registered secret value is refused `blockers.credential-value-rejected`, exit 1, `not_landed`, zero bytes persisted, with the name-only/environment hint | TC-BLK-017, TC-BLK-018 | Covered |
| AC-F3-2 | A `credential-missing` publish whose text is a variable-name-shaped reference is accepted carrying the name and no value, and renders the name only | TC-BLK-019 | Covered |
| AC-F3-3 | A `credential-missing` answer carrying the variable name and no value is accepted; free text containing a registered value is refused by that match, never by shape alone | TC-BLK-020, TC-BLK-018 | Covered |
| AC-F3-4 | A publish or answer whose `lane` or `ref` identifier field contains a registered secret value is refused `blockers.credential-value-rejected`, exit 1, `not_landed`, zero bytes persisted; legitimate system-generated identifiers are accepted and no shape-based refusal is implied | TC-BLK-043, TC-BLK-018 | Covered |
| AC-F4-1 | An owner-audience question answered by a coordinator identity is refused `blockers.audience-mismatch`, exit 1, `not_landed`, hint naming the audience and the policy ("none"), question remains open, no answer record applied (`SC-M1-24`) | TC-BLK-022, TC-BLK-024 | Covered |
| AC-F4-2 | A delegation-policy row that explicitly allows the answering audience accepts the answer and records the answering audience — the policy-as-data exception, never a runtime invention | TC-BLK-023 | Covered |
| AC-F4-3 | Every rendered question carries an audience from the closed set; a question without a valid audience cannot exist; publish defaults to `coordinator` | TC-BLK-021 | Covered |
| AC-F5-1 | With a capability fact declaring resume injection, the `laneResume` projection records `boundary-note` or `attach-continue` with `sessionReentry: false`, resumes at the phase boundary without a new session spawn (`SC-M1-13`) | TC-BLK-025, TC-BLK-026 | Covered |
| AC-F5-2 | With the capability declaring no resume injection (or absent), the projection records the declared fallback `resume-prompt-reentry` with `sessionReentry: true` and the prefill cost visibly marked on machine and human output | TC-BLK-027 | Covered |
| AC-F5-3 | Any recorded answer declares its `applied` posture (`false` in v0), the `DM-2` record is the durable data later actors consume, and no session is spawned, attached, or resumed | TC-BLK-025, TC-BLK-028 | Covered |
| AC-F6-1 | A published blocker surfaces in the digest `typed-questions` section (and the brief ranking) with type, audience, lane, age, and rank on the next invocation — one collection cycle in v0 | TC-BLK-031 | Covered |
| AC-F6-2 | The brief's `typed-questions` surface mirrors the digest section (id stable), the placeholder has retired (2 entries remain), the `blocker-questions` anchor is a real ranked group, nine surfaces total, anchors decision-first | TC-BLK-032 | Covered |
| AC-F6-3 | Identical question facts produce the identical order (priority class -> oldest -> id) on the blockers list, digest section, and brief anchor from one shared ranking, with answered questions never interleaved | TC-BLK-029, TC-BLK-030 | Covered |
| AC-F6-4 | The digest machine payload exposes audience and rank per question so the top-of-digest coordinator-audience pickup predicate is determinable from the payload alone; no wake/iteration behavior ships | TC-BLK-031 | Covered |
| AC-F7-1 | `blockers list` (default and `--open`) returns `questions[]` with id, type, audience, lane, ref, question, options[], askedAt, age, rank, exit 0, declared truncation, deterministic output | TC-BLK-034, TC-BLK-035, TC-BLK-036 | Covered |
| AC-F7-2 | An answer to a non-existent question id is refused `blockers.unknown-id`, exit 1, `not_landed` | TC-BLK-040 | Covered |
| AC-F7-3 | Any rendered output uses the binary name from the injected brand configuration; no product or binary literal is committed; the `<binary>` placeholder discipline holds | TC-BLK-008 | Covered |

**Capability coverage** (no capability left unlinked): F-1 -> TC-BLK-009, TC-BLK-010, TC-BLK-011; F-2 -> TC-BLK-014, TC-BLK-015, TC-BLK-016; F-3 -> TC-BLK-017, TC-BLK-018, TC-BLK-019, TC-BLK-020, TC-BLK-043; F-4 -> TC-BLK-021, TC-BLK-022, TC-BLK-023, TC-BLK-024; F-5 -> TC-BLK-025, TC-BLK-026, TC-BLK-027, TC-BLK-028; F-6 -> TC-BLK-029, TC-BLK-030, TC-BLK-031, TC-BLK-032, TC-BLK-033; F-7 -> TC-BLK-034, TC-BLK-035, TC-BLK-036, TC-BLK-040, TC-BLK-041.

**TC -> AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction; this table carries the forward direction. All 21 ACs are covered; no AC is deferred and no AC is TODO. `SC-M1-13` is pinned by TC-BLK-025; `SC-M1-24` is pinned by TC-BLK-022; `AC-F3-4` is pinned by TC-BLK-043.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no `API-#` and no HTTP endpoint (`§8.1`). The machine interfaces are EVT-1/EVT-2, DM-1..DM-6, the `blockers` error family, and the two additive state record kinds.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| EVT-1 — blocker question published | Append-only `DM-1` record keyed per question id; immutable; verified-readable; open/answered derived | TC-BLK-009, TC-BLK-010, TC-BLK-011 | Covered |
| EVT-2 — blocker answer intent recorded | Append-only `DM-2` record keyed by question id; one authoritative answer; embedded `laneResume`; `applied: false` in v0 | TC-BLK-012, TC-BLK-013, TC-BLK-025, TC-BLK-026, TC-BLK-027, TC-BLK-028 | Covered |
| DM-1 — typed question record | `id` (`q-` + opaque suffix), `type`, `audience`, `lane`, `ref` (null when absent), `question`, `options[]`, `askedAt`; no stored status/age/rank; `lane`/`ref` are layer-1 guarded identifier fields (AC-F3-4) | TC-BLK-009, TC-BLK-010, TC-BLK-031, TC-BLK-034, TC-BLK-043 | Covered |
| DM-2 — answer intent record | `questionId`, `answeringAudience`, substance (`choice` option value or bounded `text`), `answeredAt`, embedded `laneResume`, declared `applied` | TC-BLK-012, TC-BLK-013, TC-BLK-025 | Covered |
| DM-3 — `laneResume` projection | `mode` (`boundary-note` / `attach-continue` / `resume-prompt-reentry`), `sessionReentry`, declared prefill-cost marker on the fallback, capability source (`adapter-declared` / `capability-absent`) | TC-BLK-001, TC-BLK-025, TC-BLK-026, TC-BLK-027, TC-BLK-028 | Covered |
| DM-4 — delegation policy-as-data | Closed four-row map of {question audience, answering audience} -> allowed/refused; owner answering coordinator allowed; coordinator answering owner refused ("delegation policy: none"); owner-signed, never runtime-invented | TC-BLK-001, TC-BLK-002, TC-BLK-021, TC-BLK-022, TC-BLK-023, TC-BLK-024 | Covered |
| DM-5 — vocabulary and bounds | Closed four-type set with per-type channel; closed audience set; type-derived priority classes (decision-needed 1, credential-missing 1, spec-ambiguity 2, external-wait 3); variable-name shape; content/render bounds | TC-BLK-001, TC-BLK-014, TC-BLK-015, TC-BLK-016, TC-BLK-021, TC-BLK-029 | Covered |
| DM-6 — digest section and brief surfaces | Fixed-order `typed-questions` digest section over the open ranking; five-value state and counts; `state-unreadable` on failed/torn reads; brief surface id stable as a section mirror; placeholder catalog 3 -> 2; `blocker-questions` real anchor; anchors 2 -> 3; surfaces stay 9 | TC-BLK-031, TC-BLK-032, TC-BLK-033, TC-BLK-041 | Covered |
| `blockers` error family | `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch`; one new domain kind; documented/machine/fixture sync; `{0,1,2}` projection | TC-BLK-007, TC-BLK-040 | Covered |
| State record kinds | Two additive kinds inside `delivery.state.v1`; payload schemas `delivery.blocker.question.v1` / `delivery.blocker.answer.v1`; no schema bump, no migration | TC-BLK-005, TC-BLK-009, TC-BLK-012, TC-BLK-013 | Covered |
| Digest/brief contract surfaces | Seventh digest section; nine brief surfaces (seven mirrors + two placeholders); three anchors in decision-first order | TC-BLK-031, TC-BLK-032, TC-BLK-033, TC-BLK-041 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Determinism: identical injected facts (records, caller audience, adapter capability, clock, brand, run id) produce byte-identical output in text and machine modes on all three surfaces | TC-BLK-036, TC-BLK-029, TC-BLK-030, TC-BLK-042 | Covered |
| NFR-2 | Read/write cost: one verified state read per surface invocation; one fenced append with post-append coverage verification per publish or answer; zero outbound network, retries, or pagination | TC-BLK-037, TC-BLK-005 | Covered |
| NFR-3 | Latency: pure validation, guard evaluation, ranking, and rendering <= 50 ms on the reference environment | TC-BLK-038 | Covered |
| NFR-4 | Bounds: <= 8 rendered questions per surface; question <= 120 chars; <= 4 options each <= 60 chars; answer <= 160 chars; machine `data` <= 65 536 UTF-8 bytes; human <= 24 lines / 4 096 UTF-8 bytes; every drop or clamp explicitly marked | TC-BLK-016, TC-BLK-035, TC-BLK-042 | Covered |
| NFR-5 | Error-identity stability: exactly four new rows in one new domain kind; documented/machine/fixture agreement both ways; `audience-mismatch` exit 1; all other failures reuse existing rows or fallbacks; sync green | TC-BLK-007, TC-BLK-040 | Covered |
| NFR-6 | Credential-guard coverage: every content-admitting path (question text, option values, free-text answer) and the `lane`/`ref` identifier fields are guarded before any record lands; a refusal persists zero bytes and reports `not_landed` | TC-BLK-017, TC-BLK-018, TC-BLK-019, TC-BLK-039, TC-BLK-043 | Covered |
| NFR-7 | State integrity: exactly one authoritative answer per question id; fenced appends with a verified post-append record-count increase of exactly one; torn, wrong-kind, malformed, or duplicated histories classified, never served | TC-BLK-011, TC-BLK-012, TC-BLK-013 | Covered |

All seven NFRs are covered. No NFR is marked TODO or deferred.

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Structure — contract vocabulary and delegation | `bun test tests/structure/blockers-contract.test.ts` | `tests/structure/blockers-contract.test.ts`, `tests/structure/inventory.json` | TC-BLK-001, TC-BLK-002, TC-BLK-003 |
| Structure — purity, tier, and state-port confinement | `bun test tests/structure/blockers-imports.test.ts` | `tests/structure/blockers-imports.test.ts` (pattern from `owner-gate-sla-imports.test.ts`, `state-imports.test.ts`) | TC-BLK-004, TC-BLK-005 |
| Structure — CLI handler seam | `bun test tests/structure/blockers-cli-seam.test.ts` | `tests/structure/blockers-cli-seam.test.ts` (pattern from `cli-edge-seam.test.ts`, `exit-code-literals` check) | TC-BLK-006 |
| Structure — error table and exit projection | `bun test tests/structure/error-table.test.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | existing suites plus the new `blockers` corpus rows | TC-BLK-007, TC-BLK-040 |
| Structure — branding seam | `bun test tests/structure/branding-seam.test.ts`; `bun run scripts/checks/forbidden-literals.ts` | existing suites/checks | TC-BLK-008 |
| Behaviour — publish and records | `bun test tests/behaviour/blockers-publish.test.ts`; `bun test tests/behaviour/blockers-records.test.ts` | `tests/behaviour/**`, `tests/fixtures/blockers/**`, `tests/fixtures/state/harness.ts` | TC-BLK-009, TC-BLK-010, TC-BLK-013 |
| Behaviour — state integrity | `bun test tests/behaviour/blockers-record-integrity.test.ts` | `tests/behaviour/blockers-record-integrity.test.ts`, `tests/fixtures/state/harness.ts` | TC-BLK-011, TC-BLK-012 |
| Behaviour — types, channels, options | `bun test tests/behaviour/blockers-types.test.ts`; `bun test tests/behaviour/blockers-answer-channels.test.ts`; `bun test tests/behaviour/blockers-options.test.ts` | `tests/fixtures/blockers/matrix/**` | TC-BLK-014, TC-BLK-015, TC-BLK-016 |
| Behaviour — credential guard | `bun test tests/behaviour/blockers-credential.test.ts`; `bun test tests/behaviour/blockers-credential-shape.test.ts`; `bun test tests/behaviour/blockers-credential-negative-controls.test.ts`; `bun test tests/behaviour/blockers-credential-identifiers.test.ts` | `tests/fixtures/blockers/credentials/**` | TC-BLK-017, TC-BLK-018, TC-BLK-019, TC-BLK-020, TC-BLK-043 |
| Behaviour — audience, identity, delegation | `bun test tests/behaviour/blockers-audience.test.ts`; `bun test tests/behaviour/blockers-identity.test.ts`; `bun test tests/behaviour/blockers-delegation.test.ts` | `tests/fixtures/blockers/policy/**`, `tests/fixtures/blockers/identity/**` | TC-BLK-021, TC-BLK-022, TC-BLK-023, TC-BLK-024 |
| Behaviour — answer and `laneResume` | `bun test tests/behaviour/blockers-lane-resume.test.ts` | `tests/fixtures/blockers/capabilities/**` | TC-BLK-025, TC-BLK-026, TC-BLK-027, TC-BLK-028 |
| Behaviour — ranking and shared ranking | `bun test tests/behaviour/blockers-ranking.test.ts`; `bun test tests/behaviour/blockers-shared-ranking.test.ts` | `tests/fixtures/blockers/ranking/**` | TC-BLK-029, TC-BLK-030 |
| Behaviour — digest and brief integration | `bun test tests/behaviour/blockers-digest.test.ts`; `bun test tests/behaviour/blockers-brief.test.ts` | `tests/fixtures/blockers/**`, existing status/brief harnesses | TC-BLK-031, TC-BLK-032, TC-BLK-033 |
| Behaviour — list, bounds, determinism | `bun test tests/behaviour/blockers-list.test.ts`; `bun test tests/behaviour/blockers-bounds.test.ts`; `bun test tests/behaviour/blockers-determinism.test.ts` | `tests/fixtures/blockers/bounds/**` | TC-BLK-034, TC-BLK-035, TC-BLK-036 |
| Behaviour — read cost, performance, privacy, errors, non-regression | `bun test tests/behaviour/blockers-read-cost.test.ts`; `bun test tests/behaviour/blockers-performance.test.ts`; `bun test tests/behaviour/blockers-privacy.test.ts`; `bun test tests/behaviour/blockers-errors.test.ts`; `bun test tests/behaviour/blockers-nonregression.test.ts` | `tests/fixtures/blockers/**`, existing board/status/brief/queue/verify fixtures | TC-BLK-037, TC-BLK-038, TC-BLK-039, TC-BLK-040, TC-BLK-041 |
| Behaviour — corpus | `bun test tests/behaviour/blockers-corpus.test.ts` | `tests/fixtures/blockers/corpus/**` | TC-BLK-042 |
| Golden — blockers | `bun test tests/golden/blockers.test.ts` | `tests/golden/blockers.test.ts`, `tests/fixtures/blockers/golden/**` | TC-BLK-028, TC-BLK-036, TC-BLK-042 |
| Golden — status and brief declared edits | `bun test tests/golden/status-digest.test.ts`; `bun test tests/golden/brief.test.ts` | existing golden fixtures, deliberately regenerated for the declared edits only | TC-BLK-032, TC-BLK-041 |
| Checks — error table, secrets, literals | `bun test tests/checks/{error-table-sync,secret-read-boundary,forbidden-literals}.test.ts`; `bun run scripts/checks/{error-table-sync,forbidden-literals}.ts` | existing suites/checks plus the new family corpus | TC-BLK-007, TC-BLK-008, TC-BLK-018, TC-BLK-039 |
| Boundaries / ambient / entrypoints | `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,exit-code-literals,workspace-entrypoints}.ts` | existing harnesses; no new rule | TC-BLK-004, TC-BLK-005, TC-BLK-006 |
| Aggregate and non-regression | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 In-Process Blockers Harness Contract (binding for every blockers behaviour TC)

1. **One harness, no spawned processes.** Every behaviour test builds the `blockers` command definition with injected dependencies (brand, clock, run-id factory, secrets, id generator, state store, caller-audience environment fact, adapter capability fact, delegation policy snapshot, program, streams) and calls `runCli(argv, streams, deps)` in process, following `tests/golden/helpers.ts` and the `runCli` contract in `packages/cli/src/index.ts`. No blockers suite spawns a child process.
2. **Injected facts and time.** The clock, run id, brand, registered secrets, id generator, caller-audience fact, capability fact, policy snapshot, state store, and streams are injected. No test reads `$HOME`, the wall clock, the real state directory, the network, or the ambient environment where purity is asserted. `askedAt`/`answeredAt`/`generatedAt` and `age` all derive from the injected clock.
3. **Self-materializing fixtures.** State ledgers are built in a fresh `mkdtemp` root with `tests/fixtures/state/harness.ts`; question/answer matrices live under `tests/fixtures/blockers/**`; no test writes the live tree, `dist/`, or the real local state directory.
4. **One oracle per case.** Every case asserts (a) the exit code, (b) the envelope shape or human lines, (c) the question/answer identity and every declared field (type, audience, lane, ref, question, options, askedAt, age, rank, status; answer substance, answeredAt, applied, laneResume), (d) the ledger byte delta and record count, and (e) the declared truncation mark where applicable. A case that asserts only "rendered" is not sufficient.
5. **Recording seams.** The state-store wrapper (reuse the `guardStore` pattern from `tests/behaviour/verify-support.ts`) records `readRecords`/`read`/`append`/`acquireFence`/`releaseFence` and throws on a mutation a read-only case forbids. A session port spy records `spawn`/`attach`/`resume`/`steer` and throws if called; a throwing `fetch` guard proves zero live calls; an ambient-environment probe proves the caller-audience fact is the only environment input.
6. **Fixed output facts.** Where byte equality is asserted, the harness injects a fixed run id (for example `run-blockers-fixture`), a fixed clock tick (for example `2026-11-06T12:00:00Z` in the declared UTC form), and a synthetic brand (`tests/golden/helpers.ts`), so the envelope and human text are comparable byte-for-byte.
7. **No handler stream writes.** The blockers handler returns data or a classified failure; the CLI edge is the only writer and the only chooser of the exit projection. Tests assert no write occurs outside the edge's single serialization path and no exit literal exists in the handler.
8. **Policy and capability snapshots, not ambient reads.** The delegation map, type-priority map, answer-channel map, variable-name shape, bounds, and adapter capability are injected data. A test that needs a different map or capability passes a deep copy; the production contract is never mutated.

### 4.2 Non-Vacuity Contract (binding for every negative, matrix, boundary, and bound scenario)

- Every negative fixture carries a distinctive `planted-blocker-*` canary in the rejected content, option, answer, or record; the builder asserts the intended fact is present before the command runs, and the canary must not appear in stdout, stderr, the envelope's `data`, or the ledger where the case forbids it.
- Every negative is paired with a restored-or-valid control that reaches the expected success shape through the same invocation path (same type, same audience, same content length, clean secret record).
- Every credential refusal asserts three things together: the exact error identity, zero ledger bytes/append, and the secret's absence from stdout, stderr, the envelope, and the human line. The paired control uses the same content with a non-registered token-like string and must succeed (TC-BLK-020).
- Every shape refusal (layer 2) is paired with a non-refusal of the same text on a non-`credential-missing` type, proving the guard is path-scoped and not a global pattern scan (TC-BLK-020).
- Every cap/truncation fixture has an under-cap, at-cap, and over-cap/over-limit control in the same suite; the under-cap control must not be marked truncated, and the at-cap control must be accepted.
- Every contract-binding test mutation-controls each pinned datum (type, audience, priority, channel, delegation row, name pattern, mode, capability source, bound, error row) in a temp deep copy and asserts the mutation fails by name; the unmutated control is green.
- Every policy-as-data and capability-as-data assertion is proven live: mutating the temp map/capability changes the observed outcome, proving the test reads data rather than a hard-coded expectation.
- Every read-only assertion is paired with a seeded-write control that the guarded store detects; every no-live-call assertion is paired with a spy/guard that would throw; every no-session assertion is paired with a session spy that would record a call.
- Every determinism assertion is paired with a changed-fact control that produces different bytes, proving the equality is not a constant; every ranking assertion is paired with a reversed-input/permuted-fact control.
- Every golden is read-only at test time (assert its `mtimeMs` is unchanged), is regenerated only by the explicit script `bun run tests/fixtures/blockers/golden/regenerate.ts`, and has a mutation control that changes one byte and fails the golden by name.

### 4.3 Milestone Scenario Pins (SC-M1-13 and SC-M1-24)

These two seeded scenarios are binding. Their exact expectations are pinned here; a delivery that diverges is a defect, not an alternative reading.

**SC-M1-13 — blocker round-trip without session re-entry (pinned by TC-BLK-025).**

- **Given** lane `L2` is blocked and a `decision-needed` question with ordered options has been published, **when** `<binary> blockers answer q-... --choice 2 --json` runs with a capability fact declaring resume injection, **then** the answer is recorded as data, the lane's recorded resume path is a no-re-entry path (`boundary-note` or `attach-continue`; for `boundary-note` that is the next phase boundary, for `attach-continue` the existing-session semantics are recorded), and no new session is spawned.
- Pinned assertions: exit 0; exactly one `DM-2` answer record in state, keyed by the question id; the answer substance is the selected option value (not the index); the question record bytes are unchanged and the question is answered by derivation; `data.applied === false` (v0); `data.laneResume.mode` is `boundary-note` or `attach-continue`, `sessionReentry === false`, `capabilitySource === "adapter-declared"`; the `laneResume` projection is embedded in the answer record and references the same question/answer identity (no orphan resume event); the harness session id is unchanged; the session spy records zero `spawn`, zero `attach`, zero `resume`, zero `steer` calls; no new session id is generated. The phase-boundary resume is a recorded projection in v0, not an executed attach (AC-F5-3); if the mode is `attach-continue`, the attach semantics are *recorded*, not executed.
- **Divergence is a defect**: a spawn, an attach, a resumed session, an `applied: true`, a `sessionReentry: true`, or a missing answer record fails TC-BLK-025.

**SC-M1-24 — cross-audience answer refused (pinned by TC-BLK-022).**

- **Given** question `q-9043` is addressed to audience `owner` and the answering identity is `coordinator`, **when** `<binary> blockers answer q-9043 --choice 1 --json` runs, **then** it is refused with `blockers.audience-mismatch`, naming the audience and the delegation policy (`none`).
- Pinned assertions: exit 1 (not 0, not 2); `error.code === "blockers.audience-mismatch"`; category `user`; retryable `false`; consequence `not_landed`; projection `user-validation`; the remediation hint contains the question's audience (`owner`) and the exact policy token `delegation policy: none`; zero answer records appended and the ledger bytes are unchanged; the question record is unchanged and remains open; a subsequent `blockers list --open` still includes `q-9043` at its rank; the default list does not show it as answered; no session spy call occurs. Controls: the same question answered by an `owner` identity succeeds (exit 0, one answer record); a temp policy copy that allows coordinator->owner succeeds (TC-BLK-023).
- **Divergence is a defect**: exit 0, exit 2, an applied answer record, a closed question, a missing policy token, or a missing audience name fails TC-BLK-022.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-BLK-001 | Blocker contract vocabulary pinned: four types, audiences, priorities, channels, modes, sources, name shape, bounds | Regression | Critical | High | DM-1..DM-6, DEC-1/2/3/7, NFR-4/5 |
| TC-BLK-002 | Delegation policy-as-data is closed, total, and mutation-live | Regression | Critical | High | DM-4, AC-F4-2, DEC-3 |
| TC-BLK-003 | Contracts are declaration-only, subpath-exported, and inventory-registered | Regression | Important | High | DM-1..DM-6, ADR-0003 |
| TC-BLK-004 | Pure domain confinement: contracts/sibling-domain imports only, no I/O, clock, randomness, or environment | Regression | Critical | High | NFR-1, §16, ADR-0007 |
| TC-BLK-005 | State consumer behind the injected port: fenced append, coverage verification, no runtime API | Regression | Critical | High | F-1, EVT-1/2, DEC-11, NFR-2/7 |
| TC-BLK-006 | CLI handler purity and grammar: no stream writes, no exit literals, data/failure return | Regression | Critical | High | F-7, AC-F7-1 |
| TC-BLK-007 | Error family: four rows, one domain kind, documented/machine/fixture sync, exit projection | Regression | Critical | High | NFR-5, DEC-9, AC-F2-1, AC-F3-1, AC-F4-1, AC-F7-2 |
| TC-BLK-008 | Brand neutrality and caller-audience environment-fact naming through the branding seam | Regression | Important | High | AC-F7-3, DEC-4, RSK-7 |
| TC-BLK-009 | Publish happy path: exactly one `DM-1` record, verified read, all fields, exit 0 | Happy Path | Critical | High | AC-F1-1, F-1, EVT-1, DM-1 |
| TC-BLK-010 | Question identity and immutable derived closure: unique `q-` ids, no stored status, answered derived | Regression | Critical | High | F-1, DM-1, NFR-7 |
| TC-BLK-011 | Torn, wrong-kind, malformed, and verified-empty histories classified across surfaces | Negative | Critical | High | AC-F1-2, NFR-7, §21 |
| TC-BLK-012 | Exactly one authoritative answer; duplicate history fails closed; coverage +1; no schema bump | Regression | Critical | High | AC-F2-2, NFR-7, DEC-11, EVT-2 |
| TC-BLK-013 | Answer intent record content, durability, and append-only history | Happy Path | Critical | High | AC-F5-3, EVT-2, DM-2, DEC-11 |
| TC-BLK-014 | Closed four-type set: all four valid, unknown/case-variant refused `blockers.invalid-type` | Happy Path, Negative | Critical | High | AC-F2-1, F-2, DEC-1 |
| TC-BLK-015 | Per-type answer channels and channel violations | Regression | Critical | High | AC-F2-2, F-2, DEC-1 |
| TC-BLK-016 | `decision-needed` option contract and input content bounds | Corner Case | Critical | High | AC-F2-2, F-2, NFR-4, DEC-1 |
| TC-BLK-017 | Layer 1 registered-secret refusal on every content path with zero persisted bytes | Negative | Critical | High | AC-F3-1, F-3, NFR-6, DEC-2 |
| TC-BLK-018 | Layer 1 shares the redaction registered-secrets record; no secret reaches any output or record | Regression | Critical | High | AC-F3-1, NFR-6, §20, RSK-2 |
| TC-BLK-019 | Layer 2 variable-name shape on `credential-missing` question text | Negative, Happy Path | Critical | High | AC-F3-2, F-3, DEC-2 |
| TC-BLK-020 | TDR-0011 negative controls: no shape-based refusal beyond the `credential-missing` question text | Negative | Critical | High | AC-F3-3, RSK-2, TDR-0011 |
| TC-BLK-021 | Audience closed set, publish default `coordinator`, invalid audience refused | Happy Path, Negative | Critical | High | AC-F4-3, F-4, DEC-3 |
| TC-BLK-022 | `SC-M1-24` cross-audience refusal pinned exactly | Negative | Critical | High | AC-F4-1, F-4, DM-4, DEC-3 |
| TC-BLK-023 | Policy-as-data delegation exception: owner->coordinator allowed, mutated map accepts coordinator->owner | Regression | Critical | High | AC-F4-2, DM-4, DEC-3 |
| TC-BLK-024 | Answering identity resolution from the environment fact: exact values, absent -> owner, claimed-not-proven | Regression | Critical | High | DEC-4, RSK-3, AC-F4-1 |
| TC-BLK-025 | `SC-M1-13` round-trip without session re-entry: answer as data, boundary resume recorded, no session touch | Happy Path | Critical | High | AC-F5-1, AC-F5-3, DM-2/3, DEC-5 |
| TC-BLK-026 | Capability-declared resume injection: `boundary-note`/`attach-continue`, `sessionReentry: false`, source declared | Happy Path | Critical | High | AC-F5-1, DM-3, DEC-5 |
| TC-BLK-027 | Capability absent: `resume-prompt-reentry` fallback with visible prefill cost | Corner Case | Critical | High | AC-F5-2, DM-3, DEC-5 |
| TC-BLK-028 | v0 recorded-versus-applied posture: `applied: false` everywhere; the pack's `applied: true` is not asserted | Regression | Critical | High | AC-F5-3, DEC-5, RSK-6 |
| TC-BLK-029 | Ranking key and resolved group: priority class -> oldest -> id, answered after open | Regression | Critical | High | AC-F6-3, F-6, DEC-7, NFR-1 |
| TC-BLK-030 | One shared ranking across list, digest, and brief: identical order and rank | Regression | Critical | High | AC-F6-3, F-6, DEC-6/7, RSK-1 |
| TC-BLK-031 | Digest `typed-questions` section and pickup predicate | Happy Path | Critical | High | AC-F6-1, AC-F6-4, DM-6, DEC-6/8 |
| TC-BLK-032 | Brief integration: section mirror, placeholder retirement, anchors 2 -> 3, nine surfaces | Regression | Critical | High | AC-F6-2, DM-6, DEC-6 |
| TC-BLK-033 | Digest/brief degradation: `state-unreadable`, no fabricated questions, exit 0 | Negative | Critical | High | AC-F1-2, F-6, §12 |
| TC-BLK-034 | `blockers list` surface: default vs `--open`, `questions[]` fields, text lines, exit 0 | Happy Path | Critical | High | AC-F7-1, F-7, DM-1, NFR-1 |
| TC-BLK-035 | Bounds and declared truncation on every surface | Corner Case | Critical | High | NFR-4, AC-F7-1 |
| TC-BLK-036 | Determinism: byte-identical output, permutation invariance, TTY independence | Regression | Critical | High | NFR-1, AC-F7-1, AC-F6-3 |
| TC-BLK-037 | Read cost: one verified read per surface, one fenced append + coverage per mutation, zero network | Regression | Important | High | NFR-2 |
| TC-BLK-038 | Performance: <= 50 ms pure validation, guard, ranking, and rendering | Regression | Important | Medium | NFR-3 |
| TC-BLK-039 | Privacy: no credential values, raw payloads, titles, or bodies in records or renders | Negative | Critical | High | NFR-6, §20, §21 |
| TC-BLK-040 | Error surface and exit projection: unknown id, four user errors exit 1, state faults keep their delivered exits, exit 0 | Regression | Critical | High | AC-F7-2, NFR-5, DEC-9 |
| TC-BLK-041 | Non-regression and declared evolution: board/SLA unchanged, other commands byte-stable, status/brief only declared edits | Regression | Critical | High | §8.5, RSK-5, F-7 |
| TC-BLK-042 | Committed corpus and byte-exact goldens with mutation controls | Regression | Critical | High | all ACs (corpus oracle), NFR-1/4 |
| TC-BLK-043 | Identifier-field credential guard: registered secret in `lane`/`ref` refused; legitimate identifiers accepted | Negative | Critical | High | AC-F3-4, AC-F3-1, F-3, DEC-2, NFR-6 |

All forty-three TCs are automated. TC-BLK-028, TC-BLK-036, and TC-BLK-042 include golden evidence; TC-BLK-038 is a measured performance suite. Every TC is non-vacuous per §4.2; the controls are named in each scenario.

### 5.2 Scenario Details

#### TC-BLK-001 - Blocker contract vocabulary pinned: four types, audiences, priorities, channels, modes, sources, name shape, bounds

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-1, DM-3, DM-4, DM-5, DM-6, DEC-1, DEC-2, DEC-3, DEC-7, NFR-4, NFR-5
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/blockers-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend @golden

**Given/When/Then**: **Given** the blockers contract module exports its vocabulary as `as const` data, **when** the structure suite inspects it, **then** every closed set, map, bound, and error row is exactly the declared value and any drift fails by name.

**Preconditions**:

- The blockers vocabulary is declared in the contracts tier as types plus `as const` data (module/export names delivery-bound).
- The change spec §5.1/§8.3/§9, `DEC-1`..`DEC-3`, `DEC-7`, `DEC-9`, and `TDR-0011` are the read-only oracles.
- A deep-copy harness for mutation controls; the live contract is never mutated.

**Steps**:

1. Assert the question-type set is exactly `["decision-needed","spec-ambiguity","credential-missing","external-wait"]` in declared order; assert it is closed (no fifth type).
2. Assert the per-type answer-channel map is exactly `decision-needed -> choice` and `spec-ambiguity|credential-missing|external-wait -> text`; assert no type has two channels.
3. Assert the audience set is exactly `["owner","coordinator"]` and is the same vocabulary consumed from the delivered owner-gate seam (re-export or value equality; no parallel literal drift).
4. Assert the priority map is exactly `decision-needed: 1`, `credential-missing: 1`, `spec-ambiguity: 2`, `external-wait: 3`; assert every type has a priority and no other type does.
5. Assert the `laneResume` mode set is exactly `["boundary-note","attach-continue","resume-prompt-reentry"]` in declared order; assert the capability-source set is exactly `["adapter-declared","capability-absent"]`; assert only `resume-prompt-reentry` carries `sessionReentry: true` in the declared projection rules data.
6. Assert the variable-name shape is declared as a data pattern (not a function literal in the domain), the content caps are `120`/`4`/`60`/`160`, and the render caps reuse `STATUS_MAX_MACHINE_BYTES`, `STATUS_MAX_HUMAN_LINES`, `STATUS_MAX_HUMAN_BYTES`, and the 8-question cap by reference (no parallel numeric literal).
7. Assert the record kinds and payload schemas are `delivery.blocker.question.v1` / `delivery.blocker.answer.v1` inside `delivery.state.v1`; assert no schema-version bump is declared.
8. Mutation controls on a deep copy: add a fifth type, add a second channel to a type, move a priority, add a third audience, add a fourth mode, widen the name pattern, change a cap, rename a schema; each mutation must fail the corresponding assertion by name; the unmutated control is green.

**Expected Outcome**:

- The closed blocker vocabulary is pinned as data: four types, one channel each, two audiences, three priority classes, three resume modes, two capability sources, one name-shape datum, the declared content/render caps, and two additive payload schemas. Any drift fails by name.

#### TC-BLK-002 - Delegation policy-as-data is closed, total, and mutation-live

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-4, AC-F4-2, AC-F4-1, DEC-3, PDR-0003
**Test Type(s)**: Unit, Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/blockers-contract.test.ts`, `tests/fixtures/blockers/policy/**`
**Tags**: @backend

**Given/When/Then**: **Given** the delegation policy is a closed data map of {question audience, answering audience} -> allowed/refused, **when** the suite enumerates it, **then** all four combinations are declared, the shipped rows match `DEC-3`, and a mutated copy changes the observed routing decision.

**Preconditions**:

- The policy is injected data, not a runtime-computed rule; the shipped map is a deep-copyable value.
- The four combinations: owner->owner, owner->coordinator, coordinator->coordinator, coordinator->owner.

**Steps**:

1. Assert the map is total over the four combinations; assert no combination is missing and no extra key exists.
2. Assert the shipped rows: owner->owner allowed; owner->coordinator allowed; coordinator->coordinator allowed; coordinator->owner refused with the policy label `none`.
3. Assert the refusal row is the only `none` row; assert no row delegates coordinator->owner in the shipped map.
4. Assert the map carries no runtime invention hook (no callback, no environment read, no clock, no "if" rule): the module is data-only and the pure resolver reads the datum.
5. Mutation controls: flip coordinator->owner to allowed in a deep copy and assert the resolver accepts (proving data-driven); remove a row and assert the resolver treats it as a declared failure, not an implicit allow; add a fifth key and assert validation rejects it.
6. Structure: assert the domain resolver contains no audience literal branch (AST/string detector) and imports the map from contracts; the unmutated production map is untouched.

**Expected Outcome**:

- The delegation map is closed, total, owner-signed data: the shipped policy allows owner->coordinator and same-audience answers and refuses coordinator->owner with `none`; the routing decision is read from the map, and mutating the map changes the outcome.

#### TC-BLK-003 - Contracts are declaration-only, subpath-exported, and inventory-registered

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: DM-1..DM-6, ADR-0003, §16
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/blockers-contract.test.ts`, `tests/structure/subpaths.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend

**Given/When/Then**: **Given** the new contracts module and domain/state/CLI modules, **when** the structure suites inspect declarations and exports, **then** contracts contain no executable logic, the public subpaths expose the new types, and every module is registered in the inventory.

**Preconditions**:

- The repository's contracts declaration detector from `tests/structure/status-contract.test.ts` and the subpath inventory from `tests/structure/subpaths.test.ts`.
- The new modules exist under the delivered package tiers.

**Steps**:

1. Assert the blockers contracts module contains only type/interface/import/export/`as const` variable declarations; fail on any function, class, control flow, or side effect.
2. Assert the module is exported through the declared `@delivery-os/core/contracts` subpath and no new package or runtime-API location is introduced.
3. Assert every new module is registered in `tests/structure/inventory.json` with the correct executable allowances (contracts: none; domain: no runtime APIs; state: port only; CLI: handler).
4. Assert `tests/structure/content-inventory.test.ts` accepts the new files and no undeclared file appears.
5. Control: an intentionally malformed temp copy with a function in contracts fails the detector by name; the production copy passes.

**Expected Outcome**:

- The new contract vocabulary is declaration-only and publicly exported through the existing subpath, and every new module is inventoried with the correct tier allowance.

#### TC-BLK-004 - Pure domain confinement: contracts/sibling-domain imports only, no I/O, clock, randomness, or environment

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, §16, §21, ADR-0007
**Test Type(s)**: Structure, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/blockers-imports.test.ts`
**Tags**: @backend

**Given/When/Then**: **Given** the pure blockers domain modules (validation, guard, routing, ranking, resume projection, renderers), **when** the AST/purity suite inspects them, **then** they import only the contracts tier and sibling domain modules and contain no I/O, clock, randomness, environment, network, child process, or timer access.

**Preconditions**:

- The domain module list is declared in the test.
- The AST purity detector pattern from `tests/structure/owner-gate-sla-imports.test.ts`; the ambient-globals check covers the same files.

**Steps**:

1. Assert every domain import specifier is `#contracts` or a sibling domain module (`#domain/*` or the declared intra-domain relative form); fail on `node:*`, `bun:*`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/core/state`, or any concrete adapter/runtime module.
2. Assert no `Date.now`, `new Date`, `Math.random`, `process.env`, `process`, `Bun`, `fetch`, `setTimeout`, `setInterval`, `setImmediate`, `child_process`, `fs`, or `crypto` identifier/property access exists.
3. Run the pure functions with runtime sentinels that would record a clock/random/environment read; assert they never fire.
4. Assert the ranking/validation/guard functions produce the same result twice with the same injected facts and different wall-clock/environment values; a changed injected clock changes only the derived age, never the ranking key.
5. Control: a temp copy with a planted `Date.now`/`process.env` fails the detector by name; the production copy passes.

**Expected Outcome**:

- The blockers domain is a pure function of injected facts: contracts/sibling-domain imports only, no runtime API, no ambient read, no timer, no side effect, and deterministic output for identical facts.

#### TC-BLK-005 - State consumer behind the injected port: fenced append, coverage verification, no runtime API

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, EVT-1, EVT-2, DM-1, DM-2, DEC-11, NFR-2, NFR-7
**Test Type(s)**: Structure, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/blockers-imports.test.ts`, `tests/behaviour/blockers-records.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Given/When/Then**: **Given** the blockers state consumer (question/answer keys, payload validation, append/read fold), **when** it is inspected and exercised over the injected `StateStorePort`, **then** it uses no runtime API directly, validates through the declared boundary, and performs one fenced append with post-append coverage.

**Preconditions**:

- A temp store root with `makeIdentity`/`openStore`; a `guardStore` recorder; a fake port that throws on unexpected operations.
- Two additive artifact-kind declarations for the question/answer payloads.

**Steps**:

1. Structure: assert the state consumer imports only the contracts/state boundary surface and no `node:*`/`bun:*`/`fs`/`process`; assert the runtime driver remains the only I/O location.
2. Exercise publish/answer over the injected port; assert exactly one `acquireFence`, exactly one `append`, exactly one `releaseFence`, and one coverage read per mutation.
3. Assert the payload is validated against the declared kind/schema before append; an undeclared field type or vocabulary value is `state.store.unknown` and no bytes land.
4. Assert the read folds verified records in sequence order; a fake port returns `verified-empty` and the consumer yields an empty ranking, not a zeroed record.
5. Assert no direct filesystem write/read occurs in the consumer (the fake port is the only channel); a planted direct `fs` call fails the structure test.
6. Control: a valid append through the real state harness succeeds; a store with a fence-busy fault returns `state.lock.busy` and no append.

**Expected Outcome**:

- The state consumer is a validated, port-injected layer: one fenced append plus coverage per mutation, declared-kind validation before landing, verified reads, and no direct runtime I/O.

#### TC-BLK-006 - CLI handler purity and grammar: no stream writes, no exit literals, data/failure return

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-5, §21
**Test Type(s)**: Structure, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/blockers-cli-seam.test.ts`, `tests/behaviour/blockers-list.test.ts`
**Tags**: @backend

**Given/When/Then**: **Given** the `blockers` command definition and its three subcommand handlers, **when** the handler seam is inspected and invoked through `runCli`, **then** the handler returns data or a classified failure and never writes a stream or chooses an exit literal.

**Preconditions**:

- The `runCli` in-process harness with buffer sinks; the command program built with the blockers composition.
- The `exit-code-literals` check and the `phase-write-path-lint` pattern.

**Steps**:

1. Assert the blockers handler source contains no `stdout`/`stderr`/stream write, no `console.*`, no `process.exit`, and no numeric/`exit` literal; only the CLI edge serializes and projects.
2. Invoke `blockers list --json` through `runCli`; assert exactly one JSON document on stdout, empty stderr, and the exit code derived by the edge.
3. Invoke human mode; assert the human renderer is the only text producer and the handler returns the same data.
4. Assert the parser accepts exactly `list [--open]`, `answer <id> [--choice <n>] [--text <t>]`, and `publish <type> --lane <id> <question> [--options a,b] [--audience owner|coordinator]`; reject a missing subcommand, an extra positional, an unknown flag, and an unknown command with `fallback.invocation` (exit 1) before any state read.
5. Control: a valid invocation reaches the handler; a temp copy with a planted `console.log`/`process.exit` fails the structure test by name.

**Expected Outcome**:

- The blockers handler is a pure data/failure producer; the CLI edge is the only writer and exit chooser; the grammar is exactly the three declared subcommands and rejects everything else before reading state.

#### TC-BLK-007 - Error family: four rows, one domain kind, documented/machine/fixture sync, exit projection

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, DEC-9, AC-F2-1, AC-F3-1, AC-F4-1, AC-F7-2, §8.5
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, `doc/spec/features/feature-result-contract.md`, `tests/fixtures/result/code-corpora`
**Tags**: @backend @golden

**Given/When/Then**: **Given** the delivered error table and documented table, **when** the `blockers` family is added, **then** exactly four rows join exactly one new domain kind, the documented/machine/fixture surfaces agree in both directions, and every row projects exit 1.

**Preconditions**:

- The pre-change table snapshot (row count, `DOMAIN_KINDS` list, documented rows) and the existing sync check.
- The four codes: `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch`.

**Steps**:

1. Assert `DOMAIN_KINDS` gains exactly `blockers` and no other kind; assert the delta is +1.
2. Assert `ERROR_TABLE` gains exactly the four codes and no other row; assert each row has `domainKind: "blockers"`, `category: "user"`, `retryable: false`, `consequence: "not_landed"`, `projectionClass: "user-validation"`, a non-empty remediation hint, and a summary; assert the family is closed (no fifth row).
3. Assert each code resolves through `classifyDomainKind`/`resolveAppErrorCode`; assert a typo or an unknown `blockers.*` code is not recognized.
4. Assert the four exact codes are admitted as reserved two-segment codes by the check and by `tests/structure/error-table.test.ts`; assert the reserved set is exact (no generic two-segment or `blockers.*` wildcard), and a fifth/near-miss two-segment code is still rejected (GAP-17/OQ-T14). Assert the S1/S3 scanner now recognizes the four codes rather than ignoring them.
5. Assert the documented table in `feature-result-contract.md` has exactly the four new rows with matching columns; run `bun run scripts/checks/error-table-sync.ts` and assert zero failures and the expected counts.
6. Add true-positive corpus rows for the four codes and false-positive rows for near-miss spellings (`blockers.invalid_type`, `blockers.unknown`, `blocker.invalid-type`, `blockers.extra-code`); assert the sync check's verdicts.
7. Mutation controls: remove a documented row, add an undocumented `blockers.*` code, change a row's category/consequence/projection, and add a fifth family row; each mutation must fail the sync check by name; the unmutated check is green.
8. Assert the four codes project to exit 1 and no code is reused as a `failureClass`; assert the fallback containment entries are unchanged.

**Expected Outcome**:

- One new `blockers` domain kind with exactly four user-validation rows; the four two-segment codes are admitted by an exact reserved-code allowlist (no wildcard); documented, machine, and fixture tables agree in both directions; every row projects exit 1; near-misses are not recognized; the unmutated sync check is green.

#### TC-BLK-008 - Brand neutrality and caller-audience environment-fact naming through the branding seam

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-3, F-7, DEC-4, RSK-7, §21
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/branding-seam.test.ts`, `tests/structure/blockers-imports.test.ts`, `tests/checks/forbidden-literals.test.ts`, `scripts/checks/forbidden-literals.ts`
**Tags**: @backend

**Given/When/Then**: **Given** the blockers command, docs, fixtures, and error hints, **when** the branding and literal checks run, **then** every binary name comes from the injected brand, the caller-audience variable derives from the brand environment prefix, and no product or binary literal is committed.

**Preconditions**:

- Two synthetic brands with different `binaryName`, `environmentPrefix`, and `productName`.
- The `forbidden-literals` scanner and the branding-seam suite.

**Steps**:

1. Run the blockers command under synthetic brand A; assert every human header/line and error hint uses brand A's `binaryName`; run under brand B; assert the output prefix changes and no residual brand A string remains.
2. Assert the caller-audience environment variable name is derived from `brand.environmentPrefix` plus the declared suffix; change the brand and assert the resolved variable name changes; assert no committed literal spells the variable.
3. Assert docs and fixtures use `<binary>` or the synthetic brand, never a product literal; run `bun run scripts/checks/forbidden-literals.ts` and assert zero failures over the new/changed files.
4. Assert the command output contains no product name, package scope, or repository URL beyond the injected brand.
5. Control: a temp fixture with a planted product literal fails the scanner by name; the production fixture passes.

**Expected Outcome**:

- The blockers surface is brand-neutral: the binary name and the caller-audience environment fact are branding-seam derivations, and no product/binary literal is committed in code, docs, fixtures, or hints.

#### TC-BLK-009 - Publish happy path: exactly one `DM-1` record, verified read, all fields, exit 0

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, EVT-1, DM-1, DEC-11, NFR-2, NFR-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-publish.test.ts`, `tests/fixtures/blockers/harness.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a valid publish request (closed type, valid audience, non-empty lane, bounded content), **when** `blockers publish` runs, **then** exactly one typed question record is appended under its store-scoped key, a verified read returns every field intact, and the exit code is 0.

**Preconditions**:

- A temp store root with an injected identity and a verified-empty baseline; a guarded store recorder.
- A fixed injected clock (`2026-11-06T12:00:00Z`), a fixed run id, and a synthetic brand.
- The publish request: `decision-needed`, lane `L5`, audience `coordinator`, question `"closeout residue sweep: full or lite?"`, options `full,lite+escalation`.

**Steps**:

1. Run the publish with `--json`; assert exit 0, one success envelope, `data` exposes the created question id and the DM-1 fields through the declared shape, and stderr is empty.
2. Assert exactly one ledger line was appended, LF-terminated; the before bytes are an exact prefix of the after bytes; exactly one fence/append; the post-append coverage read sees exactly one new record.
3. Read the record through the verified read and assert: `id` matches `q-` + a non-empty opaque suffix; `type` is `decision-needed`; `audience` is `coordinator`; `lane` is `L5`; `ref` is `null`; `question` is the exact text; `options` is `["full","lite+escalation"]` in order; `askedAt` equals the injected clock; no `open`/`status`/`age`/`rank` field is stored.
4. Assert the payload schema is `delivery.blocker.question.v1` and the record kind is the declared additive kind; assert `STATE_SCHEMA_VERSION` is unchanged and no migration/derived-document replace occurred.
5. Reopen the store with a new store instance and the same identity; assert the record is durable and identical.
6. Control: a second publish with different content appends a second distinct record; the first record bytes are unchanged.

**Expected Outcome**:

- A valid publish appends exactly one complete, durable, immutable `DM-1` record with the declared fields, the exact injected timestamp, ordered options, and a null ref; the verified read and coverage agree; exit 0.

#### TC-BLK-010 - Question identity and immutable derived closure: unique `q-` ids, no stored status, answered derived

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-7
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-records.test.ts`, `tests/fixtures/blockers/harness.ts`
**Tags**: @backend

**Given/When/Then**: **Given** published questions and later answers, **when** the records and reads are inspected, **then** every question id is unique per store, no stored open/answered flag exists, and closure is derived from answer presence without rewriting the question.

**Preconditions**:

- A temp store root; an injected deterministic id generator that returns a known sequence; a fixed clock.
- Two publishes with different content, then one answer to the first question.

**Steps**:

1. Assert every id matches the declared `q-` prefix plus a non-empty opaque suffix; assert the two publishes produced distinct ids; assert the id generator was called once per publish and no `Math.random`/clock-derived id exists (AST purity covers the latter).
2. Serialize the question records and assert no `open`, `answered`, `status`, `age`, or `rank` field exists in the stored payload.
3. Answer the first question; assert the first question record bytes are unchanged (append-only prefix) and a separate answer record appears under the answer key.
4. Read the list/derived view; assert the first question is answered and the second remains open, with no rewrite of either question record.
5. Assert the answer record is keyed by the question id and the read folds it by identity, not by ledger position.
6. Control: a store with two questions and no answers reads both open; a store with one answer reads exactly one answered and one open.

**Expected Outcome**:

- Question ids are unique, deterministic under the injected generator, and opaque; open/answered status is derived at read time from answer presence; publishing is immutable and answering never rewrites the question.

#### TC-BLK-011 - Torn, wrong-kind, malformed, and verified-empty histories classified across surfaces

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, NFR-7, §21
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-record-integrity.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a state store whose blocker records are torn, wrong-kind, or malformed, **when** any surface reads the ranking, **then** the corruption is classified and never served as truth, and an absent store is explicit verified-empty evidence.

**Preconditions**:

- Temp roots with: a truncated final line, a corrupted line, a checksum mismatch, a wrong-kind record under a blocker key, a payload missing a required field, a payload with an undeclared type/audience vocabulary value, and a valid control.
- A verified-empty store (no ledger or no blocker records).
- Guarded stores recording reads/appends/fences.

**Steps**:

1. For each torn/malformed case, run `blockers list --json`; assert exit 2, a declared `state.*` error (the `state.store.torn` family for integrity/torn, `state.store.unknown` for undeclared kind/payload), no `data`, and zero appends.
2. Assert the same cases on `blockers publish`/`blockers answer` produce exit 2 and zero appends; assert the command never treats the failed read as an empty ranking or a zeroed record.
3. Assert the digest/brief path for the same cases produces the `typed-questions` section state `unknown` with reason `state-unreadable`, exit 0, zero questions, and no fabricated question (TC-BLK-033 pins the surface detail).
4. Verified-empty: run `blockers list --json` on an absent store; assert exit 0, zero questions, a verified-empty read evidence (record count 0, `verifiedEmpty: true`), and no fabricated question; assert the digest section is `observed` with an explicit empty reason, not `unknown`/`unavailable`/`not-delivered`.
5. Assert the valid control reads its questions and exits 0.
6. Non-vacuity: build the corrupted bytes with the state harness, then disable detection in a test-only copy and assert the planted corruption becomes observable; the production path classifies it.

**Expected Outcome**:

- Torn, wrong-kind, and malformed histories are classified (`state.store.torn`/`state.store.unknown` for commands, `state-unreadable` for digest/brief), exit as declared, append nothing, and never render as an empty all-clear; an absent store is explicit verified-empty, never a silent zero.

#### TC-BLK-012 - Exactly one authoritative answer; duplicate history fails closed; coverage +1; no schema bump

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, NFR-7, DEC-11, EVT-2, DM-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-record-integrity.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Given/When/Then**: **Given** a question and a first accepted answer, **when** a second answer or a duplicated answer history is present, **then** exactly one authoritative answer is served, the second answer is refused, and the duplicate history is classified rather than resolved.

**Preconditions**:

- A temp store with one open question; a guarded store with append/fence/coverage counters.
- A test-only path that appends a second answer record for the same question id (the negative control).
- Baseline `STATE_SCHEMA_VERSION`, record kinds, and ledger prefix.

**Steps**:

1. Answer once; assert exit 0, exactly one answer record, one fence/append, and coverage sees exactly +1.
2. Re-run the same answer (identical substance); assert exit 1 with `input.value.rejected`, zero appends, and the first answer unchanged; assert the question is still answered by the first record.
3. Inject a second answer record for the same question id through the test-only path; read the list/digest; assert the read fails closed with `state.store.torn`, exit 2 for the command, no answer served, and no derived "last answer wins".
4. Assert no schema bump: `STATE_SCHEMA_VERSION` unchanged; the two record kinds are additive; no existing kind/read/derived document changed; the ledger before bytes remain a prefix.
5. Assert the answer record payload validates against `delivery.blocker.answer.v1`; an undeclared field type/vocabulary is `state.store.unknown`.
6. Control: two different questions each answered once yield two answer records, one per question, and both reads succeed.

**Expected Outcome**:

- Exactly one authoritative answer exists per question id in normal operation; a second answer is refused; a duplicated history fails closed as `state.store.torn`; coverage verifies exactly +1; the state schema and existing kinds are untouched.

#### TC-BLK-013 - Answer intent record content, durability, and append-only history

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, EVT-2, DM-2, DEC-11, DEC-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-records.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @golden

**Given/When/Then**: **Given** an accepted answer, **when** the `DM-2` record is read, **then** it carries the question id, answering audience, the selected option value or bounded text, the injected answered-at time, the declared `applied` posture, and the embedded `laneResume` projection, and it is durable and append-only.

**Preconditions**:

- A published `decision-needed` question; an accepted `--choice 2` answer by `coordinator`; a fixed clock.
- A controlled capability fact (TC-BLK-026 covers the mode variants; this TC uses a deterministic mode).

**Steps**:

1. Answer and assert the ledger appends exactly one answer line; the question line is unchanged and remains an exact prefix.
2. Assert the decoded answer payload keys are the declared `DM-2` set: `questionId`, `answeringAudience`, `choice` (the option value, not the index) or `text` (bounded), `answeredAt` (injected clock), `applied: false`, and the embedded `laneResume` (`mode`, `sessionReentry`, `capabilitySource`, and the prefill marker only on the fallback). Assert no session-actuation field (`sessionId`, `spawned`, `attached`, `resumed`) exists.
3. Assert the answer record is keyed by the question id and the answer payload schema is `delivery.blocker.answer.v1`.
4. Reopen the store with a new instance; assert the answer record is durable and identical.
5. Assert the answer appears in the list's answered group and the question is excluded from `--open`; the question record bytes are unchanged.
6. Control: a text answer to a `spec-ambiguity` question records `text`, not `choice`; the two records are distinguishable by the declared substance field.

**Expected Outcome**:

- The answer is one durable, append-only `DM-2` record with the declared substance, audience, time, `applied: false`, and `laneResume`; no session-actuation field exists; the question is unchanged and derived answered.

#### TC-BLK-014 - Closed four-type set: all four valid, unknown/case-variant refused `blockers.invalid-type`

**Scenario Type**: Happy Path, Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DEC-1, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-types.test.ts`, `tests/fixtures/blockers/matrix/**`
**Tags**: @backend

**Given/When/Then**: **Given** the closed four-value type set, **when** publish runs for each valid type and for unknown variants, **then** the four valid types are accepted and every unknown/case/whitespace variant is refused with `blockers.invalid-type`, exit 1, `not_landed`, and nothing persisted.

**Preconditions**:

- A temp store; a fixed clock; synthetic brand; guarded store.
- Valid publishes: `decision-needed` with options, `spec-ambiguity`, `credential-missing` with a name-shaped text, `external-wait`.

**Steps**:

1. Publish each valid type with an appropriate payload; assert exit 0 and exactly one record per publish with the exact type value; assert the four records coexist.
2. For each invalid variant (`unknown`, `Decision-Needed`, `decision_needed`, `decision needed`, empty string, a trailing space, a numeric-looking type), run publish; assert exit 1, `blockers.invalid-type`, `not_landed`, zero appended bytes/records, and a remediation hint naming the closed set.
3. Assert the invalid type is rejected before any content/audience/option guard and before any append; the store state is unchanged.
4. Assert a valid publish after each refusal still succeeds (the refusal did not poison the store or the id generator).
5. Control: the unmutated valid set is accepted; a temp contract copy with a fifth type accepts it, proving the test reads the closed data (then the production contract is untouched).

**Expected Outcome**:

- All four closed types publish successfully; every unknown or case/format variant is refused `blockers.invalid-type`, exit 1, `not_landed`, with zero persisted bytes; the closed set is data-driven.

#### TC-BLK-015 - Per-type answer channels and channel violations

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, DEC-1, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-answer-channels.test.ts`, `tests/fixtures/blockers/matrix/**`
**Tags**: @backend

**Given/When/Then**: **Given** a published question of each type, **when** it is answered through the wrong channel, out of range, with both/neither flag, or after it is already answered, **then** the answer is refused `input.value.rejected`, exit 1, `not_landed`, and the authoritative answer is unchanged.

**Preconditions**:

- One open question of each type; `decision-needed` has three ordered options.
- A temp store; a guarded store; a fixed clock.

**Steps**:

1. Answer `decision-needed` with `--choice 1`, `--choice 3`, and the middle index; assert each is accepted and records the selected *option value*, not the index/1-based number.
2. Answer `spec-ambiguity`, `credential-missing`, and `external-wait` with `--text`; assert each is accepted and records the bounded text.
3. Refuse: `--text` on `decision-needed`; `--choice` on each options-less type; `--choice 0`, `--choice 4`, `--choice -1`, `--choice nope`; both `--choice` and `--text`; neither flag; empty `--text`; an answer to an already-answered question. Assert exit 1, `input.value.rejected`, `not_landed`, zero appended bytes, and the first answer unchanged.
4. Assert the refusal hint names the failing input (type/channel/index/id) and the next action; it never echoes a credential value.
5. Assert a valid answer after each refusal still succeeds (the question remains open after a refusal).
6. Control: the same question answered once with the correct channel succeeds; a second answer is refused.

**Expected Outcome**:

- Each type admits exactly its declared channel; choice answers record option values; every violation is `input.value.rejected`, exit 1, `not_landed`, with zero appends and the authoritative answer unchanged.

#### TC-BLK-016 - `decision-needed` option contract and input content bounds

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, NFR-4, DEC-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-options.test.ts`, `tests/fixtures/blockers/bounds/**`
**Tags**: @backend

**Given/When/Then**: **Given** a `decision-needed` publish and the declared content caps, **when** options are missing/empty/too many/too long and question or answer content is over-cap, **then** the publish/answer is refused `input.value.rejected` with zero bytes, while the at-cap forms are accepted.

**Preconditions**:

- A temp store; a fixed clock; guarded store.
- Boundary fixtures: 4 options of 60 chars; 5 options; empty option; 61-char option; 120-char question; 121-char question; 160-char answer; 161-char answer; multibyte twins.

**Steps**:

1. Accept `decision-needed` with 4 options each exactly 60 chars and a question exactly 120 chars; assert exit 0 and the options are recorded in order.
2. Refuse `decision-needed` with no `--options`, `--options ""`, an empty element (`a,,b`), 5 options, any option 61 chars, and a question of 121 chars or empty; assert `input.value.rejected`, exit 1, `not_landed`, zero appended bytes.
3. Refuse `--options` on a non-`decision-needed` type; assert `input.value.rejected` and zero bytes.
4. Accept a 160-char text answer and a 120-char question in a multibyte script; refuse 161 chars and 121 chars respectively; assert the cap counts characters, not bytes, while the machine byte cap is checked in TC-BLK-035.
5. Assert option order is preserved verbatim in the record, payload, and render; assert option values are not trimmed/reordered/deduplicated by the test's facts.
6. Control: the at-cap forms are accepted; the over-cap forms are refused; a temp contract copy with a widened cap accepts the over-cap form (liveness), and the production contract is untouched.

**Expected Outcome**:

- `decision-needed` requires 1..4 non-empty options, each ≤ 60 chars; question ≤ 120 chars; answer ≤ 160 chars; at-cap inputs are accepted, over-cap/empty/missing inputs are `input.value.rejected` with zero persisted bytes, and option order is preserved.

#### TC-BLK-017 - Layer 1 registered-secret refusal on every content path with zero persisted bytes

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, NFR-6, DEC-2, §20
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-credential.test.ts`, `tests/fixtures/blockers/credentials/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a publish or answer whose content contains a registered secret value, **when** the credential guard evaluates, **then** the operation is refused `blockers.credential-value-rejected`, exit 1, `not_landed`, with zero bytes persisted and the name-only/environment hint, on every content path.

**Preconditions**:

- A synthetic registered-secrets record containing `blocker-test-secret-0001` (never a real credential) injected through `deps.secrets`.
- A temp store with a verified baseline; a guarded store; a fixed clock.
- Content paths: publish question text, publish option value, answer `--text`.

**Steps**:

1. Publish a `spec-ambiguity` question whose text embeds the registered secret in prose; assert exit 1, `blockers.credential-value-rejected`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`; assert zero ledger bytes/append and the record count unchanged.
2. Publish a `decision-needed` question whose option value embeds the registered secret; assert the same refusal and zero bytes.
3. Answer a legitimate question with `--text` embedding the registered secret; assert the same refusal, zero answer record, and the question remains open.
4. For each refusal, assert the secret string is absent from stdout, stderr, the envelope's `data`/`error` fields, and the human line; assert the remediation hint states that credential questions carry the variable name only and the value comes from the environment.
5. Assert the guard runs before any append (zero bytes) and that a valid publish/answer immediately after the refusal still succeeds.
6. Controls: the same content with a non-registered token-like string is accepted (TC-BLK-020); an empty secrets record does not trigger layer 1. Assert the guard covers the three declared content paths and, per spec v1.2, the `lane`/`ref` identifier fields (AC-F3-4, TC-BLK-043); a registered secret in any of them is refused, not silently persisted.

**Expected Outcome**:

- Layer 1 refuses every content path containing a registered secret value with the exact identity, exit 1, `not_landed`, zero persisted bytes, no secret in any output, and the name-only/environment hint; the store remains usable.

#### TC-BLK-018 - Layer 1 shares the redaction registered-secrets record; no secret reaches any output or record

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, NFR-6, §20, RSK-2, DEC-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-credential.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `tests/golden/helpers.ts`
**Tags**: @backend

**Given/When/Then**: **Given** the registered-secrets record injected at the runtime-aware edge, **when** the blockers guard evaluates, **then** it uses the same record as the serialization redaction chokepoint, and a secret never reaches the ledger, envelope, human render, or diagnostics.

**Preconditions**:

- The `runCli` dependencies carry `secrets`; the redaction chokepoint is the delivered one.
- Two registered values (synthetic) and a control value not registered.
- A test-only mutation that changes `deps.secrets` between runs.

**Steps**:

1. Inject secret A and attempt a publish/answer containing A; assert refusal. Inject secret B instead and attempt the same content; assert acceptance (A is no longer registered, B is). This proves the guard reads the injected record, not a separate hard-coded list.
2. Register A and B; assert a content containing either is refused; assert a content containing neither is accepted.
3. Assert the serialization redaction chokepoint and the guard agree: a secret that would be redacted from an envelope is refused by the guard when supplied as content; a value the chokepoint would not redact is not refused.
4. Assert the ledger bytes, stdout, stderr, envelope, human line, and error hint never contain any registered value across success and refusal cases.
5. Assert `tests/checks/secret-read-boundary.test.ts` still passes with the blockers modules registered (the guard adds no new secret-read allowlist entry).
6. Control: a clean run with no registered value produces no refusal and no redaction.

**Expected Outcome**:

- The blockers guard and the redaction chokepoint consume the same injected registered-secrets record; changing the record changes the guard; no registered value appears in any persisted record, render, or diagnostic.

#### TC-BLK-019 - Layer 2 variable-name shape on `credential-missing` question text

**Scenario Type**: Negative, Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, F-3, DEC-2, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-credential-shape.test.ts`, `tests/fixtures/blockers/credentials/**`
**Tags**: @backend

**Given/When/Then**: **Given** a `credential-missing` publish whose question text is a variable-name-shaped reference, **when** it runs, **then** it is accepted carrying the name and no value; a text that goes beyond the name shape is refused `blockers.credential-value-rejected` with zero bytes.

**Preconditions**:

- A temp store; a fixed clock; guarded store; a synthetic registered-secrets record (for the layer-1 control).
- Valid names: `EXAMPLE_PRODUCT_GITHUB_TOKEN`, `GITHUB_TOKEN`.
- Invalid texts: `Set EXAMPLE_PRODUCT_GITHUB_TOKEN=abc123 in the environment`; `GITHUB_TOKEN=abc123`; `token: abc123`; `the value is hunter2`; a raw value-shaped string; prose with a name plus punctuation.

**Steps**:

1. Publish each valid name-shaped text; assert exit 0, the record's `question` is exactly the name, and the name appears on the ranked surfaces (blockers list, digest `typed-questions` section, brief `blocker-questions` anchor) with no value attached.
2. Publish each invalid text; assert exit 1, `blockers.credential-value-rejected`, `not_landed`, zero appended bytes, and the remediation hint states the name-only/environment contract.
3. Assert layer 2 applies only to `credential-missing` question text: the same invalid prose on `spec-ambiguity`/`external-wait` is accepted (TC-BLK-020), and a `credential-missing` *answer* text is judged by layer 1, not shape (TC-BLK-020/018). Assert the layer-1 scope is the three declared content paths plus the `lane`/`ref` identifier fields (AC-F3-4, TC-BLK-043); a registered secret in any of them is refused.
4. Assert the variable-name shape is contract data: mutate the declared pattern in a temp copy and assert a previously valid name is refused and a previously invalid name is accepted; the production pattern is untouched.
5. Assert a `credential-missing` question also passes layer 1: if the name-shaped text happens to contain a registered secret value, it is refused by layer 1 (the stronger rule wins).
6. Control: the name-only forms are accepted and rendered; the prose/value forms are refused.

**Expected Outcome**:

- Layer 2 makes `credential-missing` question text value-free by construction: name-shaped text is accepted with the name only; anything beyond the name shape is refused `blockers.credential-value-rejected`, exit 1, `not_landed`, zero bytes; the rule is path-scoped and data-driven.

#### TC-BLK-020 - TDR-0011 negative controls: no shape-based refusal beyond the `credential-missing` question text

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, RSK-2, TDR-0011, OQ-1, §7.3, §12
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-credential-negative-controls.test.ts`, `tests/fixtures/blockers/credentials/**`
**Tags**: @backend

**Given/When/Then**: **Given** unregistered token-like prose on a content path other than `credential-missing` question text, **when** the guard evaluates, **then** the content is accepted (no shape-based refusal) — the documented TDR-0011 accepted residual — while a registered value is still refused by layer 1 and an unregistered value-shaped `credential-missing` question is refused by layer 2.

**Preconditions**:

- A synthetic unregistered token-like string (for example `unregistered-token-like-0000`, clearly fake) that is *not* in `deps.secrets`.
- A registered secret (synthetic) for the layer-1 control.
- Content paths: `spec-ambiguity` question text, `decision-needed` option value, `external-wait`/`spec-ambiguity` free-text answer, and `credential-missing` question text.

**Steps**:

1. Publish a `spec-ambiguity` question whose text contains the unregistered token-like string; assert exit 0 and the text persists/renders (no shape refusal). Repeat for a `decision-needed` option value and a free-text answer. Answer a `credential-missing` question with `--text` carrying the variable name and no value; assert exit 0 and the name-only answer is recorded (the AC-F3-3 acceptance clause).
2. Publish a `credential-missing` question with the same unregistered value-shaped string; assert exit 1 `blockers.credential-value-rejected` (layer 2 shape), proving the path distinction.
3. Publish/answer with a *registered* value on each path; assert exit 1 `blockers.credential-value-rejected` (layer 1), proving the refusal is by registered match, not by shape.
4. Assert the guard does not run a generic token-shape scan: no pattern set is declared, no privacy-guard rule is imported, and the only pattern datum is the `credential-missing` variable-name shape.
5. Assert the accepted residual is documented at the delivered feature spec/decision record (the test suite references TDR-0011; the doc check is part of TC-BLK-041's doc reconciliation, not a runtime assertion).
6. Control: if a future pattern layer is introduced, this test flips in a reviewed change; here the assertion is explicitly "accepted, not refused", with the synthetic string and no registered match.

**Expected Outcome**:

- Unregistered token-like prose on non-`credential-missing` content paths is accepted, not shape-refused; a registered value is refused by layer 1 on every path; an unregistered value-shaped `credential-missing` question is refused by layer 2. This is TDR-0011's accepted residual made executable, not a silent gap.

#### TC-BLK-021 - Audience closed set, publish default `coordinator`, invalid audience refused

**Scenario Type**: Happy Path, Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-3, F-4, DEC-3, DM-4, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-audience.test.ts`, `tests/fixtures/blockers/matrix/**`
**Tags**: @backend

**Given/When/Then**: **Given** the closed `owner`/`coordinator` audience set, **when** publish runs with an explicit valid audience, no audience, and an invalid audience, **then** every valid question carries an audience, the absent flag defaults to `coordinator`, and an invalid value is refused with zero bytes.

**Preconditions**:

- A temp store; a fixed clock; guarded store.
- Publishes: `--audience owner`, `--audience coordinator`, no flag, `--audience Owner`, `--audience human`, `--audience ""`.

**Steps**:

1. Publish with `--audience owner` and with `--audience coordinator`; assert the record/payload audience is exactly the supplied value.
2. Publish with no `--audience`; assert the record/payload audience is `coordinator`.
3. Publish with each invalid value; assert exit 1, `input.value.rejected`, `not_landed`, zero bytes, and a hint naming the closed set.
4. Assert every question rendered on the list/digest/brief carries an audience from the closed set; assert no question can be read/rendered without one (a malformed record missing audience is classified per TC-BLK-011).
5. Assert the audience vocabulary is the delivered owner-gate seam value, not a parallel set; a temp contract copy that adds a third audience fails validation (liveness).
6. Control: the default and explicit valid values are accepted; the invalid values are refused.

**Expected Outcome**:

- Every question carries exactly `owner` or `coordinator`; publish defaults to `coordinator`; invalid explicit audiences are `input.value.rejected` with zero bytes; the audience set is the delivered seam vocabulary.

#### TC-BLK-022 - `SC-M1-24` cross-audience refusal pinned exactly

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-4, DEC-3, SC-M1-24
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-audience.test.ts`, `tests/fixtures/blockers/policy/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a question addressed to audience `owner` and an answering identity resolved as `coordinator`, **when** `blockers answer` runs, **then** it is refused `blockers.audience-mismatch`, exit 1, `not_landed`, with the audience and the policy (`none`) named, and the question remains open with no answer record applied.

**Preconditions**:

- A published `decision-needed` question `q-9043` with audience `owner` and at least one option.
- The caller-audience environment fact set to `coordinator`; the shipped delegation policy; a temp store with a verified baseline; a session spy.
- A fixed clock; a guarded store; a fixed run id/brand for the golden assertion.

**Steps**:

1. Run `blockers answer q-9043 --choice 1 --json`; assert exit 1 (not 0, not 2), one error envelope, no `data`, `error.code === "blockers.audience-mismatch"`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`.
2. Assert the remediation hint contains the question's audience (`owner`) and the exact policy token `delegation policy: none`; assert it names the question id and the refusal reason.
3. Assert zero answer records appended, the ledger bytes unchanged, and the question record bytes unchanged.
4. Run `blockers list --open --json`; assert `q-9043` is still present/open at its rank; run the default list; assert it is not shown as answered.
5. Assert the session spy recorded zero `spawn`/`attach`/`resume`/`steer` calls.
6. Controls: the same question answered with the caller fact `owner` succeeds (exit 0, one answer record); a temp policy copy adding coordinator->owner allowed succeeds (TC-BLK-023); an owner-audience question answered by owner never triggers the mismatch.

**Expected Outcome**:

- `SC-M1-24` is pinned exactly: `blockers.audience-mismatch`, exit 1, `not_landed`, the audience and `delegation policy: none` named, zero answer records, the question still open, and no session touch. Any divergence is a defect.

#### TC-BLK-023 - Policy-as-data delegation exception: owner->coordinator allowed, mutated map accepts coordinator->owner

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, DM-4, DEC-3, AC-F4-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-delegation.test.ts`, `tests/fixtures/blockers/policy/**`
**Tags**: @backend

**Given/When/Then**: **Given** a delegation-policy row that explicitly allows the answering audience for the question's audience, **when** the answer runs, **then** it is accepted and records the answering audience; the answerer is never invented at runtime.

**Preconditions**:

- The shipped policy: owner->coordinator allowed; coordinator->owner refused.
- A deep-copy policy variant that flips coordinator->owner to allowed.
- Questions addressed to owner and to coordinator; caller facts owner and coordinator.

**Steps**:

1. With the shipped policy, answer a coordinator-audience question as `owner`; assert exit 0, the answer records `answeringAudience: "owner"`, and the question becomes answered. This is the shipped delegation exception (owner may answer coordinator questions).
2. With the shipped policy, answer an owner-audience question as `coordinator`; assert `blockers.audience-mismatch` (TC-BLK-022).
3. With the mutated policy copy (coordinator->owner allowed), answer the owner-audience question as `coordinator`; assert exit 0, `answeringAudience: "coordinator"`, and the answer record lands; this proves the policy is data-driven, not hard-coded.
4. Assert same-audience answers (owner->owner, coordinator->coordinator) are allowed under both maps.
5. Assert no runtime invention: the resolver never adds a row, never infers delegation from the question text/type/priority, and never treats an unknown combination as allowed; a missing row is a declared refusal/failure.
6. Control: the unmutated production map remains unchanged after the test; a deep copy is the only mutated value.

**Expected Outcome**:

- The shipped policy allows owner->coordinator and same-audience answers and refuses coordinator->owner; a policy row that explicitly delegates changes the outcome and records the answering audience; authority is never invented at runtime.

#### TC-BLK-024 - Answering identity resolution from the environment fact: exact values, absent -> owner, claimed-not-proven

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DEC-4, RSK-3, AC-F4-1, AC-F4-3, §20
**Test Type(s)**: Integration, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-identity.test.ts`, `tests/structure/blockers-imports.test.ts`, `tests/fixtures/blockers/identity/**`
**Tags**: @backend

**Given/When/Then**: **Given** the caller-audience environment fact, **when** it is exactly `owner`, exactly `coordinator`, absent, or unrecognized, **then** the resolver selects the declared audience (absent -> `owner`), treats the attribution as claimed-not-proven, and persists no authentication evidence.

**Preconditions**:

- A synthetic brand with a known `environmentPrefix`.
- Injected environments: `{ <prefix>...: "coordinator" }`, `{ ...: "owner" }`, `{}`, `{ ...: "Coordinator" }`, `{ ...: "admin" }`, `{ ...: "" }`.
- A question addressed to each audience; a temp store; a session spy.

**Steps**:

1. Assert the variable name is derived from `brand.environmentPrefix` + the declared suffix; no committed literal; changing the brand changes the resolved name (TC-BLK-008 covers the branding half).
2. Resolve exact `coordinator` -> `coordinator`; exact `owner` -> `owner`; assert the answer routing follows (coordinator->owner refused; owner->coordinator allowed).
3. Resolve an absent fact -> `owner`; assert an owner-audience question is answerable and a coordinator-audience question is answerable by owner (the default human at the terminal).
4. Resolve an unrecognized value (`Coordinator`, `admin`, empty string) -> the declared absent behavior (`owner`); assert it is deterministic and never silently elevated to `coordinator`; record this as the documented reading (OQ-T6).
5. Assert no audit record is written: the ledger gains only the answer record; the raw environment variable name/value is not persisted; the answer's `answeringAudience` is the resolved closed value, not the raw fact.
6. Assert the model is claimed-not-proven: the resolver has no verification call, no network, no signature; the fact value is authoritative for routing (the documented residual, not an authentication claim).
7. Control: a question answered with the same fact twice resolves identically; changing the fact between runs changes the routing decision, proving it is read.

**Expected Outcome**:

- The answering audience resolves from the branding-named environment fact: exact `owner`/`coordinator` are honored, absent/unrecognized defaults to `owner`, the attribution is claimed-not-proven, and no authentication evidence or audit record is persisted.

#### TC-BLK-025 - `SC-M1-13` round-trip without session re-entry: answer as data, boundary resume recorded, no session touch

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, AC-F5-3, F-5, DM-2, DM-3, DEC-5, SC-M1-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-lane-resume.test.ts`, `tests/fixtures/blockers/capabilities/**`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a lane blocked on a published `decision-needed` question and a capability fact declaring resume injection, **when** the question is answered, **then** the answer is recorded as data, the lane's recorded resume path is the phase boundary, and no session is spawned, attached, or resumed.

**Preconditions**:

- A published `decision-needed` question on lane `L2` with options `["full","lite+escalation"]`, audience `coordinator`.
- A capability fact declaring resume injection with mode `boundary-note` (and a twin with `attach-continue`).
- A session spy with an existing session id `sess-1`; a fixed clock; a temp store; a guarded store; a fixed run id/brand.

**Steps**:

1. Run `blockers answer q-... --choice 2 --json`; assert exit 0, one success envelope, `data.answered` is the question id, `data.audience === "coordinator"`, `data.choice === "lite+escalation"`, `data.applied === false`.
2. Assert `data.laneResume.mode` is `boundary-note` (or the twin's `attach-continue`), `sessionReentry === false`, `capabilitySource === "adapter-declared"`, and the prefill marker is absent.
3. Assert exactly one `DM-2` answer record; the question record bytes are unchanged; the question is answered by derivation; the answer record embeds the `laneResume` and references the same question/answer identity (no orphan resume event).
4. Assert the session spy recorded zero `spawn`, zero `attach`, zero `resume`, zero `steer` calls; the session id remains `sess-1`; no new session id was generated; no control socket/wake call occurred.
5. Assert the phase-boundary resume is a recorded projection, not an executed attach: even for `attach-continue`, the attach semantics are recorded and no attach call is made.
6. Re-run `blockers list --json`; assert the question is answered and appears in the resolved group; `--open` excludes it.
7. Control: without the answer, the question is open and no answer record exists; with `applied` mutated to `true` in a test-only fixture, the v0 assertion fails (TC-BLK-028).

**Expected Outcome**:

- `SC-M1-13` is pinned exactly: the answer is durable data; the recorded resume path is `boundary-note`/`attach-continue` with `sessionReentry: false` and source `adapter-declared`; `applied` is false; no session is spawned, attached, resumed, or steered; the session id is unchanged; the lane resumes at the next phase boundary by projection. A spawn/attach/resume or `applied: true` is a defect.

**Notes / Clarifications**:

- `M1-S16` records the resume projection inside the `DM-2` answer record (`F-5`, `DM-2`); there is no separate resume-event record. `SC-M1-13`'s "resume event references the answer id" is satisfied by the embedded projection being addressable by the answer/question identity, with no orphan projection. If a separate resume event is later required, the spec and this TC reopen together.

#### TC-BLK-026 - Capability-declared resume injection: `boundary-note`/`attach-continue`, `sessionReentry: false`, source declared

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, DM-3, DEC-5, F-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-lane-resume.test.ts`, `tests/fixtures/blockers/capabilities/**`
**Tags**: @backend

**Given/When/Then**: **Given** a capability fact declaring resume injection, **when** the answer's `laneResume` is projected, **then** the mode is one of `boundary-note`/`attach-continue`, `sessionReentry` is false, the source is `adapter-declared`, and the projection is deterministic for identical facts.

**Preconditions**:

- Capability fixtures: `{ resumeInjection: true, mode: "boundary-note" }`, `{ resumeInjection: true, mode: "attach-continue" }`, `{ resumeInjection: true }` (no preferred mode), and a declared-gap twin (`{ resumeInjection: false }` for TC-BLK-027).
- Two accepted answers over the same question facts; a fixed clock.

**Steps**:

1. With the `boundary-note` capability, answer and assert `mode === "boundary-note"`, `sessionReentry === false`, `capabilitySource === "adapter-declared"`; the prefill marker is absent.
2. With the `attach-continue` capability, answer and assert `mode === "attach-continue"`, `sessionReentry === false`, source declared; no attach call is made (TC-BLK-025 step 4).
3. With a capability that only declares `resumeInjection: true` and no preferred mode, assert the recorded mode is one of the two, stable across two identical runs, and never `resume-prompt-reentry`; a temp capability mutation that names a mode changes the recorded mode (liveness) (GAP-8).
4. Assert the projection is computed from the injected fact, not from the question type/audience/lane; two questions of different types under the same capability record the same mode.
5. Assert the machine payload and human line both name the mode and the non-reentry posture; no prefill cost is rendered on these modes.
6. Control: the absent/false capability twin records the fallback (TC-BLK-027), proving the branch is real.

**Expected Outcome**:

- A capability-declaring adapter yields `boundary-note` or `attach-continue` with `sessionReentry: false` and source `adapter-declared`; the mode is deterministic and data-driven; no session re-entry or prefill cost is recorded on these paths.

#### TC-BLK-027 - Capability absent: `resume-prompt-reentry` fallback with visible prefill cost

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, DM-3, DEC-5, F-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-lane-resume.test.ts`, `tests/fixtures/blockers/capabilities/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a capability fact declaring no resume injection (or an absent capability), **when** an answer is recorded, **then** the projection records the fallback `resume-prompt-reentry` with `sessionReentry: true`, source `capability-absent`, and the prefill cost visibly marked on the machine payload and human line.

**Preconditions**:

- Capability fixtures: `{ resumeInjection: false }`, an absent capability fact, and a declared-gap record naming the reason.
- An accepted answer; a fixed clock; a fixed run id/brand for the golden.

**Steps**:

1. With `resumeInjection: false`, answer and assert `mode === "resume-prompt-reentry"`, `sessionReentry === true`, `capabilitySource === "capability-absent"`.
2. With an absent capability fact, assert the same fallback and source; the projection never silently claims `boundary-note`/`attach-continue`.
3. Assert the declared prefill-cost marker is present on the machine `data.laneResume` (a declared field/estimate) and visibly rendered on the human answer line; assert it names the re-entry cost (for example a prefill token estimate or a declared cost label), not a generic warning.
4. Assert the prefill marker is absent on the capability-declared modes (TC-BLK-026), proving it marks the fallback specifically.
5. Assert the fallback still touches no session: `applied: false`, zero spawn/attach/resume/steer calls, session id unchanged; the cost is acknowledged, not paid by this change.
6. Control: the declared-capability twin records a non-fallback mode and no prefill marker.

**Expected Outcome**:

- The capability-absent path records the declared fallback `resume-prompt-reentry` with `sessionReentry: true`, source `capability-absent`, and a visible prefill cost on machine and human output; no session is touched; the cost is acknowledged, not executed.

#### TC-BLK-028 - v0 recorded-versus-applied posture: `applied: false` everywhere; the pack's `applied: true` is not asserted

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, DEC-5, RSK-6, Appendix A, Appendix C
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-lane-resume.test.ts`, `tests/golden/blockers.test.ts`, `tests/fixtures/blockers/golden/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** any recorded answer in v0, **when** its envelope, record, or golden is inspected, **then** `applied` is explicitly `false`, no actor is claimed to have applied it, and the pack's illustrative `applied: true` is not asserted as the v0 posture.

**Preconditions**:

- A recorded answer over a declared-capability and an absent-capability fact.
- The committed answer golden and its mutation control.
- The pack's worked example (`applied: true`) as a read-only reference, not an oracle.

**Steps**:

1. Assert the answer envelope carries `applied: false`; assert the `DM-2` intent record also carries `applied: false` (the prompt's v0 recorded posture); assert no field claims a spawned/attached/resumed session.
2. Assert the golden answer payload has `applied: false`; assert the golden's `laneResume` follows the pinned v0 mode/source/cost, not the pack's illustrative `applied: true` example.
3. Assert a mutation control that sets `applied: true` in a temp fixture fails the v0 assertion by name; the unmutated golden passes.
4. Assert the human answer line does not claim the lane was resumed/applied; it states the recorded mode and, on the fallback, the prefill cost.
5. Assert `DEC-5`'s recorded-versus-applied boundary is visible on both the answer payload and the answer record; a downstream actor is not simulated.
6. Control: the documented post-M1-S18 posture (`applied: true`) is not exercised here; a test-only fixture that sets it is rejected by the v0 suite, proving the boundary is enforced.

**Expected Outcome**:

- v0 records `applied: false` on the answer envelope and the intent record; the pack's `applied: true` example is explicitly not asserted; the recorded-versus-applied boundary is visible and mutation-tested.

#### TC-BLK-029 - Ranking key and resolved group: priority class -> oldest -> id, answered after open

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, F-6, DEC-7, NFR-1, DM-5
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-ranking.test.ts`, `tests/fixtures/blockers/ranking/**`
**Tags**: @backend

**Given/When/Then**: **Given** open questions with mixed types, ages, and ids, and answered questions, **when** the shared ranking runs, **then** open questions order by priority class, then oldest asked-at, then id ascending, and answered questions render after all open ones in age order, never interleaved.

**Preconditions**:

- A fixed clock; questions with deterministic ids.
- A matrix: a newer `decision-needed` (class 1) vs an older `external-wait` (class 3); two class-1 types (`decision-needed`, `credential-missing`) tied on age with ids out of order; two questions with the same `askedAt`; a `spec-ambiguity` (class 2) between; answered questions with ages older than the oldest open.
- A guarded store; a pure ranking function.

**Steps**:

1. Assert the priority classes are applied first: the class-1 questions precede class-2, which precede class-3, regardless of age; a newer class-1 beats an older class-3.
2. Within a class, assert oldest `askedAt` first; for an exact tie, assert id ascending (lexical), including a case where the id order is the reverse of insertion order.
3. Assert the rank values are a contiguous 1..N over open questions; assert no two open questions share a rank.
4. Assert answered questions are excluded from the open ranking and appended in the resolved group after all open ones, in age order (oldest asked-at first), then id; assert no answered question appears between open ones.
5. Assert `--open` includes only the open ranking and no resolved group.
6. Mutation/permutation controls: reverse the input record order and assert the ranked order is unchanged (ranking is not ledger order); change one type/askedAt/id and assert the order changes as predicted; change the priority map in a temp copy and assert the order follows the new map (liveness).
7. Assert the ranking is pure and deterministic: two calls with the same facts produce identical id/rank arrays; no clock read beyond the injected `now`.

**Expected Outcome**:

- Open questions rank by type-derived priority class, then oldest asked-at, then id ascending; ranks are contiguous; answered questions form a resolved group after all open ones and never interleave; the ranking is pure, deterministic, and data-driven.

#### TC-BLK-030 - One shared ranking across list, digest, and brief: identical order and rank

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, F-6, DEC-6, DEC-7, RSK-1, NFR-1
**Test Type(s)**: Integration, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-shared-ranking.test.ts`, `tests/fixtures/blockers/ranking/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** identical question facts in one store, **when** the blockers list, the digest section, and the brief anchor rank them, **then** all three produce the identical id order and rank numbers from one shared ranking, with answered questions absent from digest/brief and resolved-only on the list.

**Preconditions**:

- One temp store with a mixed open/answered population (at least 8 open, including ties and all four types), a fixed clock, and a fixed run id/brand.
- The status and brief compositions wired to the same state read; the blockers list wired to the same store.

**Steps**:

1. Run `blockers list --json`, `status --json`, and `brief --json` in sequence over the same store; extract the open question ids/ranks from the list `questions[]`, the digest `typed-questions` section items, and the brief `blocker-questions` anchor items.
2. Assert the three id sequences are identical and the rank values are identical 1..N; assert every rendered question carries `audience` and `rank` on all three surfaces.
3. Assert answered questions are absent from the digest/brief (open-only) and appear only in the list's resolved group after all open ones; assert no interleaving on the list.
4. Assert the surfaces agree on truncation: with more than 8 open questions, the same first 8 ids/ranks are rendered on all three, and each declares the same omitted count.
5. Structure: assert the blockers list and the digest section consume the same ranking function from the domain, and the brief anchor mirrors the digest section's items/ranks without an independent comparator; assert no second sort or priority table exists (source/AST scan).
6. Mutation/permutation controls: reverse ledger order and assert all three orders are unchanged; change one type/askedAt and assert all three change identically; a test-only copy that forks the brief comparator fails the structure check by name.

**Expected Outcome**:

- One shared pure ranking drives the list, the digest section, and the brief anchor; all three expose identical order and rank, with answered records resolved only on the list and never interleaved; truncation and audience/rank rendering agree; no forked comparator exists.

#### TC-BLK-031 - Digest `typed-questions` section and pickup predicate

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, AC-F6-4, F-6, DM-6, DEC-6, DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-digest.test.ts`, `tests/fixtures/blockers/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a published blocker, **when** the next `status` invocation runs, **then** the question surfaces in the digest `typed-questions` section with type, audience, lane, age, and rank, and the top-of-digest coordinator predicate is determinable from the payload alone.

**Preconditions**:

- A temp store; a fixed clock; a question published 2 hours before the clock; a second question published after; a status composition over the same store.
- The existing status harness/fixtures for the other six sections.

**Steps**:

1. Publish one `decision-needed` question (audience `coordinator`); run `status --json` as the first subsequent invocation; assert exit 0 and exactly one `typed-questions` section with state `observed`.
2. Assert the section item carries `id`, `type`, `audience`, `lane`, `ref` (null), `question`, `options`, `askedAt`, `age` (derived from the fixed clock), and `rank` (1); assert the section's counts are open-only and `truncated` is false.
3. Publish a second question; run `status` again; assert both appear, ranks 1..2, and the first question's age increased by the clock advance; assert no cache (a second identical run is byte-identical).
4. Assert the section order: `STATUS_SECTION_ORDER` has exactly 7 ids, the six existing ids retain their relative order, and `typed-questions` appears exactly once; the digest sections match the declared order and `summary.sections === 7`.
5. Pickup predicate: with the coordinator question at rank 1, assert the payload alone yields `audience: "coordinator"` and `rank: 1`; a pure predicate function over the payload returns true. With an owner-audience question at rank 1, assert false. With a coordinator question at rank 2, assert the rank-1 predicate is false (no out-of-order pickup).
6. Assert no wake/iteration behavior: zero session spy calls, no timer, no control socket, no new process; the predicate is data only.
7. Control: a verified-empty store yields `observed` with total 0 and no question (TC-BLK-033); a torn store yields `unknown`/`state-unreadable` (TC-BLK-033).

**Expected Outcome**:

- A published blocker surfaces on the next `status` invocation in the `typed-questions` section with type, audience, lane, age, and rank; the section is one of seven in the declared order; the pickup predicate is determinable from the payload alone; no wake behavior ships.

#### TC-BLK-032 - Brief integration: section mirror, placeholder retirement, anchors 2 -> 3, nine surfaces

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DM-6, DEC-6, RSK-5
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-brief.test.ts`, `tests/golden/brief.test.ts`, `tests/fixtures/brief/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** the brief payload after this change, **when** it is inspected, **then** the `typed-questions` surface mirrors the digest section (id stable), the placeholder catalog has two entries, `blocker-questions` is a real ranked anchor, nine surfaces remain, and anchors are decision-first.

**Preconditions**:

- The status/brief shared facts with at least one open question and one answered question; a fixed clock/run id/brand.
- The pre-change brief fixture baseline (nine surfaces, three placeholders, two anchors) and the decision-first order from `feature-brief.md`.

**Steps**:

1. Run `brief --json`; assert `surfaces.length === 9` and exactly one surface with id `typed-questions`; assert its `state`, `counts`, `truncated`, and `reason` equal the digest section's values (mirror), and its id is unchanged.
2. Assert `placeholders.length === 2` and the ids are exactly `gate-sla-states`, `lane-queue-engine`; assert `typed-questions` is absent from the catalog; assert a structure mutation re-adding it fails by name.
3. Assert `anchors.length === 3` and the order is exactly `["ready-to-merge","blocker-questions","owner-gate-ages"]` (decision-first); assert the `blocker-questions` group is a real ranked group with `state`, `items`, `truncated`, `omitted`, and each item carries `identity`, `state`, `evidence`, `audience`, and `rank`; assert it is not a placeholder line.
4. Assert the group's id order/ranks equal the shared ranking (TC-BLK-030); assert answered questions are absent; assert an empty open set renders an explicit empty group, not a placeholder.
5. Assert the human brief renders the real blocker-questions lines (with question id/type/audience/rank) under the ready-to-merge group and before the owner-gate ages; assert the `typed-questions` placeholder line is gone.
6. Assert the other eight surfaces and the ready-to-merge/owner-gate-ages anchors are unchanged for identical facts; assert `gate-sla-states` still renders immediately after the owner-gate age anchor.
7. Golden: assert the brief golden reflects the declared edits (nine surfaces, two placeholders, three anchors, mirror section); a temp mutation that restores the placeholder or drops the anchor fails by name; the golden is read-only and regenerated only by the explicit script.

**Expected Outcome**:

- The brief keeps nine surfaces and mirrors the digest `typed-questions` section by id; the placeholder catalog drops to two; `blocker-questions` becomes a real ranked anchor with audience and rank; anchors are decision-first (`ready-to-merge`, `blocker-questions`, `owner-gate-ages`); the other surfaces/anchors are unchanged except the declared edits.

#### TC-BLK-033 - Digest/brief degradation: `state-unreadable`, no fabricated questions, exit 0

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-6, DM-6, §12, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-digest.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a torn or unreadable blocker store, **when** `status` or `brief` runs, **then** the `typed-questions` section is `unknown` with `state-unreadable`, no question is fabricated, and the command still exits 0.

**Preconditions**:

- Temp roots with a torn ledger, a wrong-kind record, a malformed payload, and a verified-empty store.
- The status/brief compositions over the same store; a fixed clock; a guarded store.

**Steps**:

1. For each torn/wrong-kind/malformed case, run `status --json`; assert exit 0, the `typed-questions` section state is `unknown`, `evidence.reasons` contains `state-unreadable`, the item list is empty, counts total 0, and no question object is fabricated.
2. Run `brief --json` on the same store; assert exit 0, the `typed-questions` surface mirrors `unknown`/`state-unreadable`, the `blocker-questions` anchor group state matches, and its items are empty; no placeholder and no fabricated question.
3. Assert the section is never `degraded`, `unavailable`, or `not-delivered` for this failure (the spec's single required local read); assert the other digest sections are unaffected.
4. Assert `blockers list` on the same store exits 2 with a classified `state.*` identity (TC-BLK-011), proving the command and the attention surface use different, declared postures.
5. Verified-empty: assert the digest section is `observed` with an explicit empty reason (for example `observed-empty`), total 0, no `state-unreadable`; the brief mirrors it; `blockers list` exits 0 empty.
6. Control: a valid store with one question is `observed` with one item; a torn store never renders an all-clear zero without the `state-unreadable` evidence.

**Expected Outcome**:

- Failed/torn state reads degrade the digest/brief section to `unknown` + `state-unreadable` at exit 0, never fabricate a question and never fail the command; an absent store is explicit verified-empty; the blockers command uses its classified exit-2 posture.

#### TC-BLK-034 - `blockers list` surface: default vs `--open`, `questions[]` fields, text lines, exit 0

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DM-1, NFR-1, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-list.test.ts`, `tests/fixtures/blockers/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** open and answered questions in the store, **when** `blockers list` runs (default and `--open`), **then** the machine envelope carries `questions[]` with every declared field, exit 0, and the text mode renders the same ranked lines deterministically.

**Preconditions**:

- A temp store with 3 open and 2 answered questions of mixed types/audiences/ages; a fixed clock; a fixed run id/brand.
- The existing `CommandResult` conformance helper.

**Steps**:

1. Run `blockers list --json`; assert exit 0, one valid envelope, `data.questions[]` is present, and each question carries `id`, `type`, `audience`, `lane`, `ref`, `question`, `options[]` (empty for non-option types), `askedAt`, `age`, `rank`, and the declared status discriminator.
2. Assert the open questions are ranked first by the shared key, the answered ones follow in the resolved group in age order, and no answered question interleaves; assert `--open` removes the resolved group and keeps the same open ranks.
3. Run human mode; assert one ranked line per rendered question, each naming the id/type/audience/lane/age/rank and the question text; assert the answered group is visibly separate; assert no timestamps beyond the declared age and no raw payload.
4. Assert the machine `data` and the human text agree on order, ranks, and truncation; assert the output is TTY-independent (no ANSI).
5. Assert `ref` is `null` for a publish without a ref; `options` is `[]` for non-option types; `age` is derived from the fixed clock; `rank` is an integer 1..N.
6. Control: a verified-empty store exits 0 with `questions: []` and an explicit empty line, not an error; an invalid flag/positional is `fallback.invocation` exit 1 before a read.

**Expected Outcome**:

- `blockers list` returns the declared `questions[]` shape with open questions ranked and answered questions resolved after, honors `--open`, renders the same order in text mode, exits 0, and never invents a field or a question.

#### TC-BLK-035 - Bounds and declared truncation on every surface

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, AC-F7-1, AC-F6-1, AC-F6-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-bounds.test.ts`, `tests/fixtures/blockers/bounds/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** under-cap, at-cap, and over-cap question populations and hostile-length facts, **when** each surface renders, **then** every declared bound holds and every drop or clamp is explicitly marked with an omitted count, with the highest-ranked question never hidden.

**Preconditions**:

- Under-cap (7 questions), at-cap (8), over-cap (9..20) fixtures; 120-char question, 4×60 options, 160-char answer; multibyte twins; hostile-length lane/ref (for example 2 000 chars); a fixed clock.
- The status/brief renderers and the blockers list renderer.

**Steps**:

1. Assert 8 questions render fully with `truncated: false`/`omitted: 0`; 9+ questions render exactly 8, `truncated: true`, `omitted: n` where n is exact, and the 9th+ absent; assert rank 1..8 and the highest-priority/oldest question is retained.
2. Assert the digest section and brief anchor use the same 8-item cap and the same omitted count as the list; assert the brief's `truncation[]` marker names the group/surface.
3. Assert the human mode caps at 24 non-empty lines and 4 096 UTF-8 bytes; when content exceeds the bound, assert the final line is the declared omission marker with the exact omitted count, and assert the rank-1 question is never dropped.
4. Assert the machine `data` is ≤ 65 536 UTF-8 bytes for every fixture; with hostile-length lane/ref, assert the renderer clamps or omits with an explicit marker and never exceeds the cap (GAP-12).
5. Assert content caps at the boundary: 120-char question, 4×60 options, 160-char answer accepted; 121/61/161 refused per TC-BLK-016; multibyte characters count as characters for content caps and bytes for the machine cap.
6. Controls: under-cap is not marked truncated; at-cap is not marked truncated; over-cap is marked with the exact count; a mutation that removes the marker fails by name.

**Expected Outcome**:

- The 8-question, 120/4×60/160-content, 65 536-byte machine, and 24-line/4 096-byte human bounds are enforced on every surface; every drop/clamp is explicit with an exact omitted count; the top-ranked question survives truncation; no silent drop exists.

#### TC-BLK-036 - Determinism: byte-identical output, permutation invariance, TTY independence

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, AC-F7-1, AC-F6-3, AC-F6-1
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-determinism.test.ts`, `tests/golden/helpers.ts`, `tests/fixtures/blockers/golden/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** identical injected facts (records, caller audience, capability, clock, brand, run id), **when** each surface runs repeatedly and with permuted record order, **then** the output is byte-identical and a changed fact produces different bytes.

**Preconditions**:

- A fixed clock/run id/brand; a mixed question population; two temp stores with the same records appended in different orders.
- The list, digest, and brief commands.

**Steps**:

1. Run each surface 20 times with identical facts; assert stdout, stderr, and exit code are byte-identical across runs, in both text and machine modes.
2. Assert the `runId`, `timing`, and `generatedAt` are the injected values; assert no wall-clock/random value leaks.
3. Run the list against two stores whose records were appended in reverse order; assert the rendered order/ranks are identical (ranking is facts-driven, not ledger-order-driven); repeat for digest/brief.
4. Assert no ANSI escape/color codes and no TTY-dependent branch; assert the same bytes with buffer sinks representing different TTY states.
5. Changed-fact controls: change one question's type/askedAt/id, the caller audience, the capability fact, or the brand; assert the relevant output changes (equality is not a constant).
6. Golden: assert the list/answer goldens are byte-identical to the committed files and read-only (mtime unchanged); a one-byte mutation fails by name.

**Expected Outcome**:

- Identical facts produce byte-identical list/digest/brief output in both modes; record-order permutations do not change the ranking; a changed fact changes the bytes; output is TTY-independent; goldens are stable and read-only.

#### TC-BLK-037 - Read cost: one verified read per surface, one fenced append + coverage per mutation, zero network

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-2, NFR-7, §21
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-read-cost.test.ts`, `tests/fixtures/state/harness.ts`
**Tags**: @backend

**Given/When/Then**: **Given** a blockers invocation, **when** the guarded store and network guard record calls, **then** a read-only surface performs one verified state read, a mutation performs one fenced append with coverage, and no outbound network/retry/pagination occurs.

**Preconditions**:

- A guarded store recording `readRecords`/`read`/`append`/`acquireFence`/`releaseFence`; a throwing `fetch` guard; a fixed clock.
- A temp store with one question for `list`; an empty store for a first publish; an answered question for `answer`.

**Steps**:

1. Run `blockers list --json`; assert at most one verified blocker-state read, zero appends/fences, and zero `fetch`/network calls.
2. Run `status --json`/`brief --json`; assert the blockers read is part of the status collection (one read) and the brief adds no second blockers read beyond the shared status facts; assert zero network.
3. Run `publish`; assert one verified read (for id/store state), one fence acquisition, one append, one coverage verification, and zero network/retries.
4. Run `answer`; assert the same one-read/one-append/coverage shape and zero network.
5. Assert a refusal (invalid type, unknown id, credential value, audience mismatch) performs no append/fence and no retry; assert the read (if any) is bounded to one.
6. Assert no pagination/retry loop exists (source/AST check for `while`/retry around the state read); a test-only second read control is detected and fails the count assertion.

**Expected Outcome**:

- One verified blocker-state read per surface invocation; one fenced append plus coverage per publish/answer; zero network, retries, or pagination; refusals append nothing; the brief reuses the status collection rather than adding a parallel read.

#### TC-BLK-038 - Performance: <= 50 ms pure validation, guard, ranking, and rendering

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-3, NFR-1
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-performance.test.ts`, `tests/fixtures/blockers/bounds/cap-sized/**`
**Tags**: @backend @perf

**Given/When/Then**: **Given** a cap-sized question population, **when** the pure validation, guard, ranking, and rendering path runs, **then** the median measured time is ≤ 50 ms on the reference environment.

**Preconditions**:

- A cap-sized fixture (8 questions, each at the 120-char/4×60 content caps, mixed types/audiences/ages) and an over-cap population for the ranking-only measurement.
- A warm-up run and a median over a declared number of iterations; record the environment (Bun version, CPU) in the test output.

**Steps**:

1. Warm up the pure path; run the declared iteration count; assert the median is ≤ 50 ms for validation + guard + ranking + rendering.
2. Measure the guard separately with a registered-secret refusal and a clean pass; assert both are within the bound.
3. Measure ranking with the cap-sized and over-cap populations; assert it is within the bound and scales predictably (no accidental O(n²) blow-up).
4. Assert the measurement uses the pure functions, not the CLI/state I/O; record environment facts; do not silently relax the 50 ms bound on slow CI (OQ-T10).
5. Control: an artificially expensive comparator (in a temp copy) exceeds the bound, proving the measurement is live.

**Expected Outcome**:

- The pure blockers path meets the 50 ms bound on the reference environment with a recorded measurement method; the bound is not silently relaxed; the measurement is live.

#### TC-BLK-039 - Privacy: no credential values, raw payloads, titles, or bodies in records or renders

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, §20, §21, RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-privacy.test.ts`, `tests/fixtures/blockers/privacy/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a registered secret, unrelated ambient secret-like values, and valid question content, **when** the channel persists and renders, **then** no credential value or unrelated environment value appears in any record, envelope, human line, or diagnostic, while legitimate question content does.

**Preconditions**:

- A synthetic registered secret in `deps.secrets`; an unrelated ambient environment value (synthetic) not supplied as content; a valid question/answer text with a `planted-blocker-*` canary.
- A temp store; a fixed clock/brand; a throwing `fetch` guard.

**Steps**:

1. Publish/answer valid content; assert the question/answer text is persisted and rendered (the success control), and the unrelated ambient value is absent from the ledger/stdout/stderr/envelope.
2. Attempt a publish/answer with the registered secret; assert refusal, zero bytes, and the secret absent everywhere (TC-BLK-017).
3. Assert the ledger contains no environment dump, no raw provider payload, no tracker title/body/comment, and no authentication evidence; only the declared record fields.
4. Assert the error hints never echo the rejected secret; the credential hint names the variable/environment contract, and the audience hint names the audience/policy.
5. Assert the caller-audience environment variable's name/value is not persisted (only the resolved audience is).
6. Control: the success case renders the legitimate question text; a privacy scanner over the ledger/output finds none of the planted secrets/ambient values; a test-only planted ambient value fails the scan by name.

**Expected Outcome**:

- No registered or unrelated credential value, raw provider payload, title, body, comment, or authentication evidence appears on the guarded content paths or in any render for the test's facts; legitimate question/answer content is persisted and rendered; error hints never echo secrets.

**Notes / Clarifications**:

- Layer 1's scope is the three content paths plus the `lane`/`ref` identifier fields (AC-F3-4, TC-BLK-043). This TC focuses on content/render privacy; the identifier-field refusal is TC-BLK-043. A registered secret in `lane`/`ref` is refused, not rendered.
- The unrelated ambient value is synthetic and never supplied as content; the test proves the channel does not dump the environment, not that it scans every environment variable.

#### TC-BLK-040 - Error surface and exit projection: unknown id, four user errors exit 1, state faults keep their delivered exits, exit 0

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, NFR-5, DEC-9, F-7, §8.5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-errors.test.ts`, `tests/fixtures/result/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** the closed blockers error family and the delivered state identities, **when** each failure mode runs, **then** the exact code, consequence, and exit projection are produced (0 listed/answered; 1 user validation; 2 platform/state), with no undocumented code and no handler-chosen literal.

**Preconditions**:

- A temp store with an open owner question, an answered question, and a valid question; a torn store; a fence-busy fault; a permission-denied fault.
- The `CommandResult` conformance helper; the error-table definitions.

**Steps**:

1. `blockers answer q-does-not-exist --text "x"` -> exit 1, `blockers.unknown-id`, `not_landed`, no `data`; assert the question set is unchanged.
2. `blockers publish unknown-type ...` -> exit 1, `blockers.invalid-type`; `blockers publish credential-missing ... <registered value>` -> exit 1, `blockers.credential-value-rejected`; `blockers answer <owner-question> --choice 1` as coordinator -> exit 1, `blockers.audience-mismatch`; assert each has category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`.
3. `blockers answer <answered> --text "x"` -> exit 1, `input.value.rejected`; assert no new answer record.
4. Valid `blockers list`/`blockers answer` -> exit 0 with one success envelope; assert no `error` key.
5. Torn store -> exit 2, `state.store.torn`; fence busy -> exit 2, `state.lock.busy`; permission denied -> the delivered row's projection (user-validation, exit 1). Assert the exact code and no `data`; the man page's "2 platform faults" is read as platform-class rows only (GAP-16/OQ-T13), not a re-projection of the whole `state.*` family.
6. Malformed invocations (`blockers`, `blockers list extra`, unknown flag, missing `--lane`, missing question) -> `fallback.invocation`, exit 1, before any state read.
7. Assert no `blockers.*` code outside the four; assert the handler contains no exit literal (TC-BLK-006); assert the exit is projected from the table; assert the envelope is exactly one document with `runId`/`timing`.

**Expected Outcome**:

- Every blockers failure projects through the delivered table: the four `blockers.*` user errors exit 1 `not_landed`; malformed answers are `input.value.rejected`; state faults use their declared `state.*` exit; valid list/answer exits 0; malformed invocations are `fallback.invocation`; no undocumented code or handler-chosen exit exists.

#### TC-BLK-041 - Non-regression and declared evolution: board/SLA unchanged, other commands byte-stable, status/brief only declared edits

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: §8.5, RSK-5, F-7, DEC-10, AC-F6-2
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-nonregression.test.ts`, existing board/status/brief/queue/verify suites and goldens
**Tags**: @backend @golden

**Given/When/Then**: **Given** the additive blockers change, **when** the existing commands and goldens run, **then** the owner-gate board and every non-`status`/`brief` command are byte-stable, while `status`/`brief` change only through the declared section/surface/catalog/anchor edits.

**Preconditions**:

- The pre-change goldens/fixtures for `board`, `status`, `brief`, `queue ready`, `verify gates`, `closeout`, `plan`, `config`, and the envelope/state contracts.
- The declared edits: status seventh section, brief `typed-questions` mirror, placeholder catalog 3 -> 2, anchors 2 -> 3, surfaces stay 9.

**Steps**:

1. Run the board suites and golden; assert the owner-gate SLA output is byte-identical for identical facts; assert no blocker record is created by the board and no owner-gate→question conversion exists (`DEC-10`).
2. Run status; assert the six existing section ids retain relative order, state, counts, evidence, and behaviour for identical facts; assert only the declared `typed-questions` section is added; assert the status exit codes are unchanged; assert the status golden differs only by the declared section (a field-by-field diff, not a blanket update).
3. Run brief; assert the other eight surfaces and the ready-to-merge/owner-gate-ages anchors are unchanged for identical facts; assert only the declared `typed-questions` mirror, placeholder retirement, and third anchor differ; assert the brief golden is deliberately regenerated for those edits only.
4. Run `queue ready`, `verify gates`, `closeout`, `plan`, `config`, and the envelope/state contract suites; assert no behaviour, exit code, payload shape, schema, or golden changes.
5. Assert no new configuration key exists (`config-contract`/`config-restrictions`), no `CommandResult` envelope schema change, no new package/subpath (`subpaths`), and `STATE_SCHEMA_VERSION` is unchanged.
6. Assert no owner-gate SLA policy/board change; the board's audience seam is reused, not modified; no `blockers` error code appears in board output.
7. Docs: assert the blockers feature spec records TDR-0011's accepted residual and revisit triggers (the doc-sync phase owns the reconciliation; this test asserts the delivered doc exists and names the residual).

**Expected Outcome**:

- The owner-gate board and all non-`status`/`brief` commands are byte-stable; status/brief change only through the declared section/surface/catalog/anchor edits; no config key, envelope shape, subpath, state schema, or SLA mechanic changes; the accepted residual is documented.

#### TC-BLK-042 - Committed corpus and byte-exact goldens with mutation controls

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: all ACs (corpus oracle), NFR-1, NFR-4, NFR-7
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-corpus.test.ts`, `tests/golden/blockers.test.ts`, `tests/fixtures/blockers/{corpus,golden}/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** the committed blockers corpus and goldens, **when** the corpus suite and golden suite run, **then** every declared type, audience, priority, channel, guard, state edge, ranking edge, bound, and v0 posture is represented by a committed case whose corruption fails by name, and the golden bytes are exact and read-only.

**Preconditions**:

- `tests/fixtures/blockers/corpus/cases.ts` (facts + expected output + expected records) and `tests/fixtures/blockers/golden/{envelope.json,human.txt}` at a fixed run id/clock/brand.
- The corpus completeness meta-check and the golden regeneration script `tests/fixtures/blockers/golden/regenerate.ts`.

**Steps**:

1. Assert the corpus is non-empty and covers: all four types; both audiences; all three priority classes; both answer channels; the layer-1/layer-2 refusals and the TDR-0011 non-refusal; the audience mismatch and delegation exception; both capability sources and all three modes; open/answered/resolved; the empty/1/8/9+ populations; the torn/wrong-kind/malformed/verified-empty histories; the under/at/over bounds; and the v0 `applied: false` posture.
2. Run each corpus case and assert the exact exit, envelope/human output, record count/fields, rank/age/audience, `laneResume`, and truncation against its declared expectation; assert no case asserts only "rendered".
3. Completeness meta-check: remove a case and assert the meta-check names the missing category; corrupt one expected value and assert the case fails by name; the unmodified corpus passes.
4. Golden: assert the list and answer envelopes and human text are byte-identical to the committed golden; assert the golden files' `mtimeMs` is unchanged (read-only); regenerate only via the explicit script and review the diff.
5. Mutation controls: change one golden byte and assert failure by name; change the fixed clock/run id and assert the golden fails (proving the facts are injected); restore and pass.
6. Assert zero live calls: the throwing `fetch` guard and the session spy record nothing across the corpus.

**Expected Outcome**:

- The committed corpus covers every declared blocker behaviour and edge; each case's expected exit/output/records are exact; the completeness meta-check fails on a missing or corrupted case; the list/answer goldens are byte-exact, read-only, deterministically regenerated, and mutation-tested; no live call occurs.

#### TC-BLK-043 - Identifier-field credential guard: registered secret in `lane`/`ref` refused; legitimate identifiers accepted

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, AC-F3-1, F-3, DEC-2, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-credential-identifiers.test.ts`, `tests/fixtures/blockers/credentials/**`
**Tags**: @backend @golden

**Given/When/Then**: **Given** a publish or answer whose `lane` or `ref` identifier field contains a registered secret value, **when** the credential guard evaluates, **then** the operation is refused `blockers.credential-value-rejected`, exit 1, `not_landed`, with zero persisted bytes; **and given** legitimate system-generated identifiers (`L2`, `GH-230`-style refs), **then** they are accepted with no shape-based refusal implied.

**Preconditions**:

- A synthetic registered-secrets record containing `blocker-test-secret-0001` (never a real credential) injected through `deps.secrets`; a temp store with a verified baseline; a guarded store; a fixed clock.
- Publish inputs: `--lane L2` (always supplied) and the declared optional `ref` input (the DM-1 field; if the publish synopsis exposes no `--ref` flag in v0, the ref path is exercised through a seeded question record on the answer path, per GAP-11/OQ-T9).
- A seeded question record carrying a registered secret in its `lane` or `ref` (built with the state harness, simulating a legacy/bypassed record) for the answer-path half.
- Legitimate identifiers: lane `L2`, ref `GH-230`, ref `PDEV-123`.

**Steps**:

1. Publish with `--lane <registered-secret>` (a registered value as the whole lane or embedded in it); assert exit 1, `blockers.credential-value-rejected`, category `user`, retryable `false`, consequence `not_landed`, projection `user-validation`, zero ledger bytes/append, and no record.
2. Publish with the `ref` input carrying the registered secret (or, if v0 exposes no ref flag, seed the record and exercise the answer path in step 3); assert the same refusal and zero bytes.
3. Answer a question whose referenced `lane` or `ref` carries the registered secret (the seeded record); assert exit 1 with the same identity, zero answer records appended, the question unchanged/open, and no session spy call.
4. Assert the secret is absent from stdout, stderr, the envelope, the human line, and the ledger; assert the remediation hint states the variable-name-only/environment contract.
5. Legitimate-identifier control: publish with `--lane L2` and refs `GH-230` and `PDEV-123`; assert exit 0, the identifiers are recorded verbatim, and no refusal/redaction occurs. Assert a clearly token-like but *unregistered* string in lane/ref is also accepted (layer 1 only; no shape-based refusal is implied by AC-F3-4).
6. Assert the guard uses the same injected registered-secrets record as TC-BLK-018: swap `deps.secrets` and assert the previously refused identifier is accepted and the newly registered one is refused.
7. Assert the identifier guard is evaluated before any append; a valid publish/answer immediately after a refusal still succeeds.
8. Mutation control: a temp copy that guards only the three content paths (not lane/ref) fails steps 1–3 by name; the production guard passes.

**Expected Outcome**:

- A registered secret value in `lane` or `ref` is refused `blockers.credential-value-rejected`, exit 1, `not_landed`, zero persisted bytes, on both the publish and answer paths, with no secret in any output; legitimate system-generated identifiers are accepted and no shape-based refusal is implied; the shared registered-secrets record drives the decision.

**Notes / Clarifications**:

- AC-F3-4 names "publish or answer"; the answer command's own inputs are the question id and substance, so the answer-path half evaluates the referenced question's `lane`/`ref` (and any identifiers carried into the answer record) before appending. The seeded-record case is the executable form of that reading.
- This TC supersedes the earlier GAP-15 residual note: spec v1.2 extends layer 1 to identifiers by a PM-decided change-scoped extension (owner review at PR), with no shape-based refusal implied.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager` | All blockers suites are hermetic and in-process |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; existing `ts-*` jobs | Authoritative for structure, checks, boundary, corpus, golden, and aggregate gates |
| Temp fixture roots | `mkdtemp` under the OS temp directory (state harness) | Ledgers, torn copies, and mutation fixtures never write the live tree |
| In-process test process | Bun runtime; injected brand, clock, run id, secrets, id generator, caller audience, capability, policy, state store, and streams | No child processes for any blockers suite; fixed output facts for byte assertions |
| Default CI | No credentials, no live switch, no network | Zero live calls; the throwing `fetch` guard proves it; all secrets are synthetic |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Question matrix | `tests/fixtures/blockers/matrix/**` — all four types, both audiences, all priority classes, mixed ages, open/answered, ties | Read-only; each case carries its expected rank/fields |
| Credential fixtures | `tests/fixtures/blockers/credentials/**` — synthetic registered secrets, clearly fake unregistered token-like prose, name-shaped variables, prose/value-shaped refusals, and identifier-field cases (`lane`/`ref` carrying a registered value, plus `L2`/`GH-230`/`PDEV-123` controls) | Read-only; never real credentials |
| Capability fixtures | `tests/fixtures/blockers/capabilities/**` — `boundary-note`, `attach-continue`, declared-but-no-mode, `resumeInjection: false`, absent capability | Read-only; deep copies only for mutation controls |
| Delegation fixtures | `tests/fixtures/blockers/policy/**` — the shipped four-row map and deep-copy variants (coordinator->owner allowed, missing row, fifth key) | Read-only; the production map is never mutated |
| Identity fixtures | `tests/fixtures/blockers/identity/**` — exact `owner`/`coordinator`, absent, case/unknown/empty values, two synthetic brands | Read-only; the variable name is derived from the brand |
| State fixtures | Temp roots from `tests/fixtures/state/harness.ts`; verified-empty, valid, torn, wrong-kind, malformed, duplicate-answer, fence-busy, permission-denied | Created and removed per test; never the live state directory |
| Bounds fixtures | `tests/fixtures/blockers/bounds/{under-cap,at-cap,over-cap,cap-sized,hostile-length,multibyte}/**` | Read-only; reversed and mutated twins built in memory |
| Ranking fixtures | `tests/fixtures/blockers/ranking/**` — mixed classes, exact age ties, reverse-id ties, answered older than open | Read-only; permutation twins built in memory |
| Corpus | `tests/fixtures/blockers/corpus/cases.ts` (facts + expected output + expected records) | Read-only; completeness meta-checked |
| Golden | `tests/fixtures/blockers/golden/{envelope.json,human.txt}` at a fixed run id/clock/brand | Read-only; regenerated only by `bun run tests/fixtures/blockers/golden/regenerate.ts` |
| Status/brief/board baselines | Existing `tests/fixtures/{status,brief,board}/**` and goldens | Read-only; status/brief goldens updated only for the declared edits; board unchanged |
| Error-table corpus | `tests/fixtures/result/code-corpora` plus the `blockers` true/false positives | Read-only; drift fails sync |
| Privacy canaries | `tests/fixtures/blockers/privacy/**` — synthetic registered secret, unrelated ambient value, content canary | Read-only, synthetic; never real secrets |

### 6.3 Isolation Strategy

- Every synthetic fixture and mutation test uses a fresh `mkdtemp` root; no test writes the live repository tree, `dist/`, the real local state directory, or the user's home. A clean-tree assertion after the suite is part of the aggregate gate.
- Blockers suites inject brand, clock, run id, secrets, id generator, caller audience, capability, policy, state store, and streams; they never read `$HOME`, the wall clock, the ambient environment where purity is asserted, or the network.
- State ledgers are built from verified bytes with the real state harness and mutated by a named operation; a detection-disabled control exposes the planted value, proving the fixture is live.
- The delegation map, priority map, answer-channel map, name shape, bounds, and capability facts are injected data; mutation controls use deep copies and never touch the production contract.
- Golden files are read-only at test time; corruption/mutation controls run on in-memory values or temp copies, and the unmutated control runs in the same suite. Goldens are regenerated only by the explicit script, never by a test side effect.
- The existing board/status/brief/queue/verify goldens and corpora are the non-regression oracle; the board is unchanged, and status/brief are updated only for the declared edits and reviewed as a diff.

## 7. Automation Plan and Implementation Mapping

All TCs are automated. Locations follow the spec's affected-components table and the repository testing strategy; delivery planning may rename helper files but must preserve each TC's behaviour, states, reasons, bounds, assertions, and AC/NFR mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-BLK-001 | `tests/structure/blockers-contract.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure/blockers-contract.test.ts` | per-datum deep-copy mutations; closed-set checks; inventory registration | To Implement |
| TC-BLK-002 | `tests/structure/blockers-contract.test.ts`, `tests/fixtures/blockers/policy/**` | same | four-row totality; shipped rows; flipped/missing/fifth-key mutations; no audience literal | To Implement |
| TC-BLK-003 | `tests/structure/blockers-contract.test.ts`, `tests/structure/subpaths.test.ts`, `tests/structure/inventory.json` | `bun test tests/structure` | declaration-only detector; subpath export; inventory allowance; malformed temp copy | To Implement |
| TC-BLK-004 | `tests/structure/blockers-imports.test.ts` | `bun test tests/structure/blockers-imports.test.ts` | contracts/sibling-domain imports; AST purity; runtime sentinels; planted `Date.now`/`process.env` | To Implement |
| TC-BLK-005 | `tests/structure/blockers-imports.test.ts`, `tests/behaviour/blockers-records.test.ts` | corresponding `bun test` | injected port; fence/append/coverage counts; undeclared payload; fence-busy | To Implement |
| TC-BLK-006 | `tests/structure/blockers-cli-seam.test.ts`, `tests/behaviour/blockers-list.test.ts` | corresponding `bun test` | no stream writes/exit literals; grammar rejections; planted `console.log` | To Implement |
| TC-BLK-007 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts`, corpus | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun test tests/structure/error-table.test.ts` | +4 rows/+1 kind; documented/machine/fixture; near-miss mutations | Existing - Update |
| TC-BLK-008 | `tests/structure/branding-seam.test.ts`, `tests/checks/forbidden-literals.test.ts` | corresponding `bun test`; `bun run scripts/checks/forbidden-literals.ts` | two brands; env-prefix derivation; planted literal | Existing - Update |
| TC-BLK-009 | `tests/behaviour/blockers-publish.test.ts`, fixtures | `bun test tests/behaviour/blockers-publish.test.ts` | one record/append/coverage; field set; durable reopen; second publish | To Implement |
| TC-BLK-010 | `tests/behaviour/blockers-records.test.ts` | `bun test tests/behaviour/blockers-records.test.ts` | unique ids; no stored status; question bytes unchanged; derived answered | To Implement |
| TC-BLK-011 | `tests/behaviour/blockers-record-integrity.test.ts`, state harness | `bun test tests/behaviour/blockers-record-integrity.test.ts` | torn/corrupt/checksum/wrong-kind/malformed/verified-empty; detection-disabled control | To Implement |
| TC-BLK-012 | same + state harness | same | second answer; injected duplicate; coverage +1; schema baseline; two-question control | To Implement |
| TC-BLK-013 | `tests/behaviour/blockers-records.test.ts` | `bun test tests/behaviour/blockers-records.test.ts` | DM-2 field set; durable reopen; choice vs text; no session fields | To Implement |
| TC-BLK-014 | `tests/behaviour/blockers-types.test.ts`, `matrix/**` | `bun test tests/behaviour/blockers-types.test.ts` | four valid types; unknown/case/format variants; fifth-type mutation | To Implement |
| TC-BLK-015 | `tests/behaviour/blockers-answer-channels.test.ts`, `matrix/**` | `bun test tests/behaviour/blockers-answer-channels.test.ts` | choice value vs text; wrong channel; range; both/neither; already answered | To Implement |
| TC-BLK-016 | `tests/behaviour/blockers-options.test.ts`, `bounds/**` | `bun test tests/behaviour/blockers-options.test.ts` | 4x60/5/empty/61; 120/121; 160/161; multibyte; cap mutation | To Implement |
| TC-BLK-017 | `tests/behaviour/blockers-credential.test.ts`, `credentials/**` | `bun test tests/behaviour/blockers-credential.test.ts` | question/option/answer paths; zero bytes; no leak; hint; clean control | To Implement |
| TC-BLK-018 | same + `tests/checks/secret-read-boundary.test.ts` | corresponding `bun test` | injected secrets swap; chokepoint parity; ledger/output scan; allowlist count | To Implement + Existing - Update |
| TC-BLK-019 | `tests/behaviour/blockers-credential-shape.test.ts`, `credentials/**` | `bun test tests/behaviour/blockers-credential-shape.test.ts` | valid names; prose/value refusals; pattern mutation; layer-1 stronger rule | To Implement |
| TC-BLK-020 | `tests/behaviour/blockers-credential-negative-controls.test.ts`, `credentials/**` | `bun test tests/behaviour/blockers-credential-negative-controls.test.ts` | unregistered token accepted on non-credential paths; credential-missing refused; registered refused; no pattern layer | To Implement (permanent regression) |
| TC-BLK-021 | `tests/behaviour/blockers-audience.test.ts`, `matrix/**` | `bun test tests/behaviour/blockers-audience.test.ts` | owner/coordinator/default/invalid; every render carries audience; third-audience mutation | To Implement |
| TC-BLK-022 | `tests/behaviour/blockers-audience.test.ts`, `policy/**` | same | SC-M1-24 exact; open-after-refusal; owner control; policy mutation control | To Implement (permanent regression) |
| TC-BLK-023 | `tests/behaviour/blockers-delegation.test.ts`, `policy/**` | `bun test tests/behaviour/blockers-delegation.test.ts` | shipped rows; flipped/missing row; same-audience; no runtime invention | To Implement |
| TC-BLK-024 | `tests/behaviour/blockers-identity.test.ts`, `identity/**` | `bun test tests/behaviour/blockers-identity.test.ts` | exact/absent/unrecognized; brand derivation; no audit/env persistence; claimed-not-proven | To Implement |
| TC-BLK-025 | `tests/behaviour/blockers-lane-resume.test.ts`, `capabilities/**` | `bun test tests/behaviour/blockers-lane-resume.test.ts` | SC-M1-13 exact; answer record; session spy zero; session id unchanged; applied false | To Implement (permanent regression) |
| TC-BLK-026 | same + `capabilities/**` | same | boundary-note/attach-continue; no-mode determinism; mode mutation; human/machine parity | To Implement |
| TC-BLK-027 | same + `capabilities/**` | same | false/absent capability; fallback; source; prefill marker present; non-fallback absent | To Implement |
| TC-BLK-028 | `tests/behaviour/blockers-lane-resume.test.ts`, `tests/golden/blockers.test.ts`, `golden/**` | corresponding `bun test` | applied false on envelope/record/golden; applied-true mutation fails; pack example not asserted | To Implement |
| TC-BLK-029 | `tests/behaviour/blockers-ranking.test.ts`, `ranking/**` | `bun test tests/behaviour/blockers-ranking.test.ts` | priority->age->id; ties; answered group; reverse input; priority mutation | To Implement |
| TC-BLK-030 | `tests/behaviour/blockers-shared-ranking.test.ts`, `ranking/**` | `bun test tests/behaviour/blockers-shared-ranking.test.ts` | list/digest/brief equality; truncation parity; forked comparator mutation; reverse order | To Implement (permanent regression) |
| TC-BLK-031 | `tests/behaviour/blockers-digest.test.ts` | `bun test tests/behaviour/blockers-digest.test.ts` | first subsequent invocation; fields/age/rank; seven-section order; pickup predicate; no wake | To Implement |
| TC-BLK-032 | `tests/behaviour/blockers-brief.test.ts`, `tests/golden/brief.test.ts` | corresponding `bun test` | nine surfaces; mirror; 2 placeholders; 3 anchors; decision-first; mutation controls | To Implement + Existing - Update |
| TC-BLK-033 | `tests/behaviour/blockers-digest.test.ts`, state harness | `bun test tests/behaviour/blockers-digest.test.ts` | torn/wrong-kind/malformed -> unknown/state-unreadable/exit 0; verified-empty observed; never fabricated | To Implement |
| TC-BLK-034 | `tests/behaviour/blockers-list.test.ts` | `bun test tests/behaviour/blockers-list.test.ts` | questions[] fields; default vs --open; resolved group; text parity; empty store | To Implement |
| TC-BLK-035 | `tests/behaviour/blockers-bounds.test.ts`, `bounds/**` | `bun test tests/behaviour/blockers-bounds.test.ts` | 8/9+; under/at/over; 65536/24/4096; hostile length; multibyte; top-rank survival | To Implement |
| TC-BLK-036 | `tests/behaviour/blockers-determinism.test.ts`, `tests/golden/helpers.ts` | `bun test tests/behaviour/blockers-determinism.test.ts` | 20 runs; reverse append; TTY; changed-fact; golden read-only/mutation | To Implement |
| TC-BLK-037 | `tests/behaviour/blockers-read-cost.test.ts` | `bun test tests/behaviour/blockers-read-cost.test.ts` | one read; one append+coverage; zero network; refusal no append; deliberate second read | To Implement |
| TC-BLK-038 | `tests/behaviour/blockers-performance.test.ts`, `bounds/cap-sized/**` | `bun test tests/behaviour/blockers-performance.test.ts` | warm-up + median; guard/ranking/render; expensive comparator control; env recorded | To Implement |
| TC-BLK-039 | `tests/behaviour/blockers-privacy.test.ts`, `privacy/**` | `bun test tests/behaviour/blockers-privacy.test.ts` | registered secret; ambient value; content success control; no secret in hints; no env dump | To Implement |
| TC-BLK-040 | `tests/behaviour/blockers-errors.test.ts` | `bun test tests/behaviour/blockers-errors.test.ts` | unknown id; four user errors; state faults; exit 0; malformed invocations; no undocumented code | To Implement |
| TC-BLK-041 | `tests/behaviour/blockers-nonregression.test.ts`, existing board/status/brief/queue/verify suites | corresponding `bun test` | board byte-stable; status nine sections with the other eight relative-stable; brief nine surfaces/three anchors with the other eight surfaces and the two existing anchors stable; no config/envelope/subpath/schema change; doc residual | Existing - No Change (verified) |
| TC-BLK-042 | `tests/behaviour/blockers-corpus.test.ts`, `tests/golden/blockers.test.ts`, `corpus/**`, `golden/**` | corresponding `bun test` | completeness meta-check; per-case expectations; golden byte/mutation; zero live calls | To Implement |
| TC-BLK-043 | `tests/behaviour/blockers-credential-identifiers.test.ts`, `credentials/**` | `bun test tests/behaviour/blockers-credential-identifiers.test.ts` | lane/ref registered-value refusal; legitimate `L2`/`GH-230`/`PDEV-123` controls; unregistered token accepted; secrets swap; guard-narrowing mutation | To Implement |

**Execution order.**

1. Contracts, structure, purity, CLI seam, error family, branding: TC-BLK-001..TC-BLK-008.
2. Publish, records, state integrity, answer record: TC-BLK-009..TC-BLK-013.
3. Types, channels, options, input bounds: TC-BLK-014..TC-BLK-016.
4. Credential guard layers, identifier-field guard, and TDR-0011 controls: TC-BLK-017..TC-BLK-020, TC-BLK-043.
5. Audience, identity, delegation, `SC-M1-24`: TC-BLK-021..TC-BLK-024.
6. Answer-as-data, `laneResume`, `SC-M1-13`, v0 posture: TC-BLK-025..TC-BLK-028.
7. Ranking and attention surfaces: TC-BLK-029..TC-BLK-035.
8. Determinism, read cost, performance, privacy, errors, non-regression: TC-BLK-036..TC-BLK-041.
9. Corpus, goldens, aggregate: TC-BLK-042; `pnpm check`; `git diff --check`; `git status --porcelain`.

All 43 TCs (TC-BLK-001..043) appear exactly once in the order above. The delivery plan must map them without reshaping any TC.

**Wiring.** The new behaviour suites are discovered by root `bun test`; no new CI job topology is introduced. The new structure suites are discovered by `bun test tests/structure`; the type probes are compiled by the existing typecheck. The error-table sync check stays in the existing `ts-invariants` wiring with the four new exact rows and the exact four-code `RESERVED_TWO_SEGMENT_CODES` addition in both `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts` (no family recognizer or wildcard for `blockers`; the collector family recognizer is unchanged). The boundary, ambient, forbidden-literal, secret-read, exit-code, and entrypoint gates extend to the new modules automatically; no rule is added or weakened. Documentation reconciliation runs in phase 7: `git diff --check`, YAML parse for changed `.yaml` files, markdown/link review, the error-table sync check for the four rows, forbidden-literal registration for the new current-truth doc, and `bash scripts/.tests/test-doc-distribution.sh` for any changed redistributable guide or template.

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
pnpm install --frozen-lockfile
bun test tests/structure/blockers-contract.test.ts
bun test tests/structure/blockers-imports.test.ts
bun test tests/structure/blockers-cli-seam.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/structure/branding-seam.test.ts
bun test tests/structure/brief-contract.test.ts
bun test tests/structure/status-contract.test.ts
bun test tests/structure/subpaths.test.ts
bun test tests/structure/content-inventory.test.ts
bun test tests/behaviour/blockers-publish.test.ts
bun test tests/behaviour/blockers-records.test.ts
bun test tests/behaviour/blockers-record-integrity.test.ts
bun test tests/behaviour/blockers-types.test.ts
bun test tests/behaviour/blockers-answer-channels.test.ts
bun test tests/behaviour/blockers-options.test.ts
bun test tests/behaviour/blockers-credential.test.ts
bun test tests/behaviour/blockers-credential-shape.test.ts
bun test tests/behaviour/blockers-credential-negative-controls.test.ts
bun test tests/behaviour/blockers-credential-identifiers.test.ts
bun test tests/behaviour/blockers-audience.test.ts
bun test tests/behaviour/blockers-identity.test.ts
bun test tests/behaviour/blockers-delegation.test.ts
bun test tests/behaviour/blockers-lane-resume.test.ts
bun test tests/behaviour/blockers-ranking.test.ts
bun test tests/behaviour/blockers-shared-ranking.test.ts
bun test tests/behaviour/blockers-digest.test.ts
bun test tests/behaviour/blockers-brief.test.ts
bun test tests/behaviour/blockers-list.test.ts
bun test tests/behaviour/blockers-bounds.test.ts
bun test tests/behaviour/blockers-determinism.test.ts
bun test tests/behaviour/blockers-read-cost.test.ts
bun test tests/behaviour/blockers-performance.test.ts
bun test tests/behaviour/blockers-privacy.test.ts
bun test tests/behaviour/blockers-errors.test.ts
bun test tests/behaviour/blockers-nonregression.test.ts
bun test tests/behaviour/blockers-corpus.test.ts
bun test tests/golden/blockers.test.ts
bun test tests/golden/status-digest.test.ts
bun test tests/golden/brief.test.ts
bun test tests/golden/board-grid.test.ts
bun test tests/golden/queue-ready.test.ts
bun test tests/golden/verify-gates.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/secret-read-boundary.test.ts
bun test tests/checks/forbidden-literals.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
pnpm check
git diff --check
git status --porcelain
```

**Open-PR DoD evidence checklist.** All 21 ACs have a passing traceable TC and all 7 NFRs are measured; `SC-M1-13` and `SC-M1-24` are green with their exact pinned expectations; the four-row `blockers` family and the one new domain kind are documented/machine/fixture-synced, the four two-segment codes are admitted by the exact reserved allowlist, and the sync check is green; the closed four types and their channels validate; layer 1 refuses registered values on question text, option values, answer text, and the `lane`/`ref` identifier fields (AC-F3-4) with zero persisted bytes and no leak, while legitimate `L2`/`GH-230` identifiers are accepted; layer 2 refuses non-name-shaped `credential-missing` text; TDR-0011's negative controls prove unregistered token-like prose is not shape-refused and the residual is documented; the confused-deputy guard refuses coordinator->owner with `delegation policy: none` and keeps the question open; the policy-as-data exception is mutation-tested; the answer is one durable `DM-2` record with `applied: false` and a `laneResume` projection; capability-declared modes record `sessionReentry: false` and no session touch; the absent-capability fallback records `resume-prompt-reentry` with a visible prefill cost; the shared ranking orders all three surfaces identically and answered records never interleave; the digest `typed-questions` section and the brief mirror/placeholder retirement/third anchor are in place with nine surfaces and decision-first anchors; bounds (8 questions, 120/4x60/160 content, 65 536 bytes, 24 lines/4 096 bytes) are live with every drop/clamp marked; output is byte-identical across repeated and permuted runs; the domain is pure and tier-clean; read cost and 50 ms performance are measured; no credential value, raw payload, title, body, or product literal escapes; the owner-gate board and all non-`status`/`brief` commands are unchanged; status/brief differ only through the declared edits; the feature spec records TDR-0011's residual and revisit triggers; `pnpm check` is green; a minor changeset is recorded; an open unmerged PR targets `main-tools`. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

**Specification risk coverage (RSK-1..RSK-8).** Every spec risk is exercised by at least one TC.

| Spec risk | Mitigating TC(s) |
|-----------|------------------|
| RSK-1 — the digest/brief integration forks the ranking | TC-BLK-029, TC-BLK-030, TC-BLK-031, TC-BLK-032 |
| RSK-2 — the credential boundary is too narrow or too broad | TC-BLK-017, TC-BLK-018, TC-BLK-019, TC-BLK-020, TC-BLK-039, TC-BLK-043 |
| RSK-3 — the confused-deputy guard is bypassed by claimed identity | TC-BLK-022, TC-BLK-023, TC-BLK-024, TC-BLK-040 |
| RSK-4 — the documented/machine/fixture error tables drift | TC-BLK-007, TC-BLK-040 |
| RSK-5 — the digest/brief contract ripple breaks consumers or corpora | TC-BLK-031, TC-BLK-032, TC-BLK-041, TC-BLK-042 |
| RSK-6 — the v0 posture is misread as the pack's `applied: true` example | TC-BLK-025, TC-BLK-027, TC-BLK-028, TC-BLK-042 |
| RSK-7 — product/binary literals leak | TC-BLK-008, TC-BLK-042 |
| RSK-8 — "within one collection cycle" is implemented as a daemon wait | TC-BLK-031, TC-BLK-037 |

**Testing risks.**

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A negative fixture is inert, so a false success passes | H | M | Every negative asserts the exact exit/code/zero-record shape plus a restored/valid control (§4.2) |
| RSK-T2 | The TDR-0011 negative control is misread and the suite starts asserting a false positive/refusal | H | M | The test explicitly asserts acceptance of an unregistered token-like string on non-`credential-missing` paths, paired with a registered-value refusal and a `credential-missing` shape refusal (TC-BLK-020) |
| RSK-T3 | The registered-secret fixture is too short/generic and matches legitimate prose, making the guard test vacuous or over-broad | H | M | Use a distinctive synthetic value; assert the exact-value/embedded-prose match; pair with a clean control; never a real credential |
| RSK-T4 | The shared-ranking test passes because one surface is stubbed or reads a different store | H | M | All three surfaces read one temp store; the test asserts exact id/rank equality and a forked-comparator structure mutation (TC-BLK-030) |
| RSK-T5 | The digest/brief mirror test hard-codes the expected section instead of deriving the mirror | H | M | Compare the brief surface's state/counts/truncated/reason to the digest section's actual values; mutate the digest facts and assert the mirror follows (TC-BLK-032) |
| RSK-T6 | Bounds are asserted by sampling and miss a drop/clamp path | M | M | Under/at/over-cap, hostile-length, multibyte, and top-rank-survival fixtures run together in both modes (TC-BLK-035) |
| RSK-T7 | Truncation hides the top-ranked coordinator question | H | M | The over-cap fixture puts the coordinator question last in ledger order; assert it is rank 1 and retained on all three surfaces (TC-BLK-030/035) |
| RSK-T8 | The determinism test passes because the fixture is constant | M | L | Changed-fact controls and a 20-run hash set (TC-BLK-036) |
| RSK-T9 | The new error family widens the table/sync or a near-miss code is recognized | M | M | Exact four rows, +1 kind, true/false-positive corpus, and mutation controls for undocumented/fifth codes (TC-BLK-007) |
| RSK-T10 | The session spy is not wired, so "no spawn/attach" is vacuous | H | M | The spy throws/records on every call; assert zero calls and the unchanged session id; a test-only spawn control must be detected (TC-BLK-025) |
| RSK-T11 | The policy-as-data test hard-codes the shipped map | M | M | A flipped deep copy must change the outcome; the production map is untouched (TC-BLK-023) |
| RSK-T12 | The identity test reads the wrong environment variable or hard-codes a product prefix | M | M | Derive the variable from the synthetic brand; two-brand control; no literal scan (TC-BLK-008/024) |
| RSK-T13 | The 50 ms measurement is flaky on slow CI | M | M | Measure the pure path only, warm up, take a median, record the environment; the spec bound is not silently relaxed (OQ-T10) |
| RSK-T14 | The delivery drifts from the pinned readings (SC-M1-13/24, `applied: false`, four error codes, rank key) | M | M | Each pinned reading has a permanent regression TC and a mutation control; any change updates the assertion deliberately |
| RSK-T15 | A golden is accidentally regenerated by a test side effect | M | M | Goldens are read-only, `mtimeMs`-checked, and regenerated only by the explicit script (TC-BLK-042) |
| RSK-T16 | The status/brief non-regression is over-asserted (full golden equality), which necessarily changes, or under-asserted (no check) | M | M | Assert the declared edits field-by-field and the unchanged parts by identity; the board and other commands are byte-stable (TC-BLK-041) |

### 8.2 Assumptions

- **A-T1 — Spec binding.** The spec is the single source of truth for capabilities, ACs, NFRs, DM-1..DM-6, EVT-1/EVT-2, the vocabulary, and the v0 posture. Delivery planning may choose helper/file/spelling names but may not rebind a pinned value.
- **A-T2 — Plan mapping.** GAP-1: the implementation plan is authored in phase 4 and must map all 43 TCs onto phases without reshaping them. If it alters a TC's behaviour, state, or AC/NFR mapping, this test plan reopens.
- **A-T3 — In-process harness.** Every blockers behaviour test uses `runCli` with injected dependencies; no blockers suite spawns a child process or reads the ambient environment/network in default CI.
- **A-T4 — Policy and capability snapshots.** The delegation map, priority map, answer-channel map, name shape, bounds, and adapter capability are injected data; tests mutate deep copies only. The shipped maps are contract data and are not operator-tunable at runtime.
- **A-T5 — State substrate.** The delivered state layer's verified reads, fences, checksums, artifact boundaries, and torn-state classification are the substrate; the change adds two record kinds and no schema bump.
- **A-T6 — Single-host, local-first.** The state layer's local filesystem authorization is accepted for M1; no multi-host or network behavior is tested.
- **A-T7 — v0 production composition.** With no delivered harness adapters, the recorded `laneResume` mode is the `resume-prompt-reentry` fallback and `applied` is `false`; the other modes are exercised over injected capability facts. This mirrors the GH-229 v0-posture precedent.
- **A-T8 — Delivery-bound spellings.** Export names, module/file names, field spellings (`age`, `rank`, status discriminator, prefill marker), schema strings, record kind/key strings, and human labels are delivery-bound (GAP-6, GAP-9, GAP-11). The vocabulary, values, caps, exits, and assertions are pinned.
- **A-T9 — No live evidence.** This plan requires no live GitHub run; the committed corpus and goldens are the deterministic oracle. Any future live smoke is a separate, opt-in, structural check.
- **A-T10 — Non-regression oracle.** Existing board/status/brief/queue/verify goldens and corpora are the oracle; the board is unchanged, and status/brief are deliberately updated only for the declared edits and reviewed as a diff.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Is the KPI "Cross-audience answers applied: 0" meant to exclude the policy-allowed owner->coordinator case? | GAP-3. Resolved by spec v1.2: §4.1 reworded to "Policy-refused cross-audience answers applied: 0", explicitly noting owner->coordinator is allowed per DEC-3/AC-F4-2 and not counted. Tests follow AC-F4-1/2. | Resolved — spec v1.2 §4.1 | @spec-writer |
| OQ-T2 | Does §8.5's "no existing command's payload shapes change" intend `status`/`brief` as the two declared exceptions? | GAP-2. Resolved by spec v1.2: §8.5 declares exactly two exceptions (`status` seventh section; `brief` real questions, catalog 3 -> 2, anchors 2 -> 3, surfaces stay 9); every other command, including `board`, is byte-stable. | Resolved — spec v1.2 §8.5 | @spec-writer |
| OQ-T3 | Which error identity applies to over-cap/empty input and malformed `decision-needed` options? | GAP-5. This plan pins `input.value.rejected` (exit 1, `not_landed`) to keep the four-row family closed; `blockers.invalid-type` remains type-only. | Resolved in this plan; confirm at plan review | @plan-writer / @spec-writer |
| OQ-T4 | Which `state.*` code classifies a duplicated answer history? | GAP-7. This plan pins fail-closed `state.store.torn` for integrity/duplicate history and `state.store.unknown` for undeclared kind/payload. | Resolved in this plan; implementation detail at delivery | @plan-writer / @coder |
| OQ-T5 | How is `boundary-note` vs `attach-continue` selected when the adapter only declares "resume injection"? | GAP-8. This plan pins a declared optional preferred mode; when absent, the mode must be one of the two and stable; no hard-coded default is asserted. | Open — non-blocking; delivery-bound contract detail | @plan-writer / @coder |
| OQ-T6 | How is an unrecognized caller-audience environment value treated? | GAP-10. This plan pins "behaves as absent -> owner", consistent with DEC-4's claimed-not-proven default; the security residual is RSK-3. | Open — non-blocking; confirm at plan review | @spec-writer / @decision-advisor |
| OQ-T7 | Where exactly do the digest `typed-questions` section and the brief `typed-questions` surface sit in the fixed orders? | GAP-4. This plan asserts totality, id stability, and the six existing sections' relative order; the chosen index is pinned by the golden. | Open — non-blocking; delivery-bound order | @plan-writer / @coder |
| OQ-T8 | What do the digest section's `observed`/`unknown` counts mean for questions? | GAP-13. This plan pins `total` = open questions, `omitted` = dropped, `truncated` iff dropped, `observed + unknown = total`, answered excluded; the split is delivery-bound. | Resolved in this plan; confirm at plan review | @plan-writer |
| OQ-T9 | Does publish return the created question in `data`, and is `ref` always null in v0? | GAP-11. This plan pins the ledger/verified read as the authoritative oracle, a declared publish payload shape exposing the id/fields, `ref: null` because the synopsis has no `--ref`, and `options: []` for non-option types. | Open — non-blocking; delivery-bound shape | @plan-writer / @coder |
| OQ-T10 | What CI tolerance applies to the 50 ms pure-path measurement? | RSK-T13. This plan measures the pure path with a warm-up and median and records the environment; the spec bound is not silently relaxed. | Open — non-blocking | @plan-writer |
| OQ-T11 | Does the implementation plan map every TC without reshaping it? | GAP-1/A-T2. The plan is authored in phase 4. | Open — pending phase 4 | @plan-writer |
| OQ-T12 | Should layer 1 also guard identifier fields (`lane`, `ref`), or only the three declared content paths? | GAP-15. Resolved by spec v1.2: F-3/DEC-2/NFR-6 extend layer-1 matching to `lane`/`ref` (PM-decided change-scoped extension, owner review at PR), with new AC-F3-4; legitimate system-generated identifiers are accepted. The previous residual note is superseded. | Resolved — spec v1.2 F-3/DEC-2/NFR-6; AC-F3-4 -> TC-BLK-043 | @spec-writer / @decision-advisor |
| OQ-T13 | Does the man page's "2 platform faults" re-project `state.permission.denied` to exit 2, or does the delivered exit-1 row stand? | GAP-16. Resolved by spec v1.2 Appendix A: platform-fault exits defer to the delivered rows — `state.permission.denied` exit 1, `state.store.torn`/`state.lock.busy` exit 2 — and the `blockers` family adds no exit-2 row. | Resolved — spec v1.2 Appendix A | @plan-writer / @spec-writer |
| OQ-T14 | Do the four two-segment `blockers.*` codes join the exact reserved-code allowlist, or does the repo change its code format? | GAP-17. Resolved by spec v1.2 §15 (DEC-9 implementation constraint): add the exact four codes to `RESERVED_TWO_SEGMENT_CODES` in both `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts`, no wildcard. The plan's pinned reading is now the spec's constraint; TC-BLK-007 asserts it. | Resolved — spec v1.2 §15/DEC-9 | @plan-writer / @coder |

**Recorded gaps, not silently adjusted:**

1. **Implementation-plan mapping** — GAP-1/A-T2/OQ-T11; pending phase 4; the plan must map all 43 TCs without reshaping them.
2. **§8.5 non-regression scope** — GAP-2/OQ-T2; resolved by spec v1.2: exactly two exceptions (status seventh section; brief real questions/catalog/anchors), all other commands byte-stable including board.
3. **KPI cross-audience wording** — GAP-3/OQ-T1; resolved by spec v1.2: "Policy-refused cross-audience answers applied: 0"; owner->coordinator allowed.
4. **Digest/brief position** — GAP-4/OQ-T7; order is contract data; existing relative order and totality pinned; absolute index delivery-bound.
5. **Input bound violations and malformed options** — GAP-5/OQ-T3; `input.value.rejected`, family closed.
6. **Age/rank/status/substance representations** — GAP-6/A-T8; behaviour pinned, spellings delivery-bound.
7. **Duplicate/unservable history code** — GAP-7/OQ-T4; fail-closed state family.
8. **Resume-mode selection** — GAP-8/OQ-T5; membership/determinism/liveness pinned, default delivery-bound.
9. **Prefill-cost marker** — GAP-9/A-T8; presence/absence and human visibility pinned, spelling delivery-bound.
10. **Caller-audience variable and unrecognized values** — GAP-10/OQ-T6; branding-seam derivation and owner default pinned.
11. **Publish payload, `ref`, options shape** — GAP-11/OQ-T9; ledger is the oracle; shapes delivery-bound.
12. **Lane/ref clamping** — GAP-12; the declared machine/human bounds hold with explicit marks.
13. **Digest question counts** — GAP-13/OQ-T8; open-only counting and the omitted/truncated relationship pinned.
14. **One collection cycle** — GAP-14; per-invocation in v0, sequential invocations are the proof; the daemon interval is M1-S18's.
15. **Layer-1 identifier scope** — GAP-15/OQ-T12; resolved by spec v1.2: layer 1 now guards `lane`/`ref` (AC-F3-4 -> TC-BLK-043); legitimate identifiers accepted; no shape refusal implied.
16. **Man-page exit shorthand vs delivered state projections** — GAP-16/OQ-T13; resolved by spec v1.2 Appendix A: follow the delivered machine table; `state.permission.denied` exit 1, torn/lock exit 2; blockers adds no exit-2 row.
17. **Two-segment `blockers.*` codes vs the error-table format gate** — GAP-17/OQ-T14; resolved by spec v1.2 §15/DEC-9: the four exact codes join the reserved allowlist in both the check and the structure test; no wildcard; near-misses still fail.

No AC and no NFR is left without a TC.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-06T07:15:00Z | Change Test Plan Writer | Initial plan: 42 TCs (TC-BLK-001..042). All 20 ACs (AC-F1-1..AC-F7-3), all 7 NFRs, EVT-1/EVT-2, DM-1..DM-6, and all 8 spec risks mapped. Pins the closed four-type set and per-type channels, the two-layer credential guard with TDR-0011's negative controls (registered-value refusal everywhere, name-shape on `credential-missing` only, no pattern layer), the audience/delegation confused-deputy guard with `SC-M1-24` exact expectations, the answer-as-data `DM-2` record with the `laneResume` projection and `SC-M1-13` exact expectations, the v0 `applied: false` posture, the shared priority->age->id ranking across the list/digest/brief, the digest `typed-questions` section and pickup predicate, the brief mirror/placeholder retirement/third anchor/nine surfaces, the four-row `blockers` error family and sync gate, purity/tier confinement, bounds/truncation, determinism, privacy, read cost, and 50 ms performance. Seventeen recorded gaps with chosen readings (implementation-plan pending, §8.5 scope, KPI wording, section/surface position, input bounds, representations, duplicate history, mode selection, prefill marker, identity variable, publish shape, lane/ref clamping, digest counts, one-cycle proof, layer-1 identifier scope, man-page exit shorthand, two-segment error codes) and fourteen open questions; no coverage silently weakened. |
| 1.1 | 2026-11-06T09:30:00Z | Change Test Plan Writer | Synced to spec v1.2 (test-plan gap remediation): added AC-F3-4 (identifier-field layer-1 guard) and mapped it to TC-BLK-043 (with TC-BLK-018 for the shared registered-secrets record); added the `lane`/`ref` scope to the credential-guard in-scope/AC/NFR/DM/test-data/automation/DoD coverage; coverage is now 43 TCs and 21 ACs. Resolved OQ-T1 (spec §4.1 KPI reworded to "Policy-refused cross-audience answers applied"), OQ-T2 (spec §8.5 declares exactly two exceptions, all other commands byte-stable), OQ-T12 (spec F-3/DEC-2/NFR-6 extend layer 1 to `lane`/`ref`; new AC-F3-4), OQ-T13 (spec Appendix A defers platform-fault exits to the delivered rows), and OQ-T14 (spec §15/DEC-9 pins the exact four-code `RESERVED_TWO_SEGMENT_CODES` allowlist in both the check and the structure test). Updated GAP-2/GAP-3/GAP-15/GAP-16/GAP-17 to spec-resolved; TC-BLK-017/019 notes and TC-BLK-039 no longer treat identifiers as unguarded. No other TC behaviour changed. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
