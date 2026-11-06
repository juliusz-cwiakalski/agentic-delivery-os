---
id: chg-GH-230-typed-blockers
status: Proposed
created: 2026-11-06T16:00:00Z
last_updated: 2026-11-06T16:00:00Z
owners: [engineering]
service: delivery-os
labels: [m1, blockers, coordinator, attention-plane]
links:
  change_spec: ./chg-GH-230-spec.md
  change_test_plan: ./chg-GH-230-test-plan.md
  machine_plan: ./chg-GH-230-plan.yaml
summary: >
  M1-S16 typed blocker and question channel: a blocked lane publishes a typed,
  audience-routed, credential-safe question as a durable state record
  (decision-needed with options, spec-ambiguity, credential-missing with the
  variable name only, external-wait); answers land as intent records with a
  recorded laneResume projection (applied:false in v0); one shared pure ranking
  (priority class -> oldest -> id) drives the blockers list, the new digest
  typed-questions section, and the brief's real blocker-questions anchor
  (placeholder catalog 3->2, anchors 2->3, surfaces stay 9); the four-row
  blockers error family joins the error table through the exact two-segment
  reserved-code allowlist in both the sync check and the structure test.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-230: M1-S16: Typed blocker and question channel

## Context and Goals

This plan delivers GH-230 per the change specification (F-1..F-7, 21 ACs AC-F1-1..AC-F7-3, NFR-1..NFR-7, EVT-1/EVT-2, DM-1..DM-6, DEC-1..DEC-11, RSK-1..RSK-8, Appendix A exit semantics) and the committed test plan (43 TCs, TC-BLK-001..043). The delivery order follows spec §18: **contract vocabulary and the error family with its binding sync first** (the error-table gate blocks everything downstream — the four two-segment codes must be allowlisted exactly before any later phase's rows validate), **then the pure domain** (validation, layered credential guard, audience routing, shared ranking, `laneResume` projection — fixture-testable with zero I/O), **then the two additive state record kinds**, **then the `blockers` command surface**, **then the guard/routing and answer-as-data behaviour pinning**, **then the digest/brief integration as one atomic contract edit** (section, surfaces, catalog, anchors move together), **and finally bounds/determinism/cost/privacy/corpus/non-regression pinning and release**.

**Companion machine plan:** this markdown plan is the execution document (phased tasks, AC/TC links, verification commands); `chg-GH-230-plan.yaml` in this folder is the schema-valid `delivery.plan.v1` projection of the same phases (GH-226 format flip; when both files exist the YAML wins for `plan validate`). The two agree on phase ids, titles, and scope.

Placement per ADR-0003, mirroring the delivered owner-gate SLA pattern (GH-229):

- **Contracts** (`packages/core/src/contracts/blockers.ts`): the closed four-type set with per-type answer channels, the audience set (consumed from the delivered owner-gate seam, no parallel vocabulary), the type-derived priority map, the four-row delegation policy (DM-4), the variable-name shape datum, the `laneResume` modes and capability sources, content/render bounds (render bounds reusing `STATUS_*` constants by reference), the two record kinds and payload schemas (`delivery.blocker.question.v1` / `delivery.blocker.answer.v1`), and the list/answer/publish payload types — all `as const` data and types only, data-only per the `status-contract` detector.
- **Domain** (`packages/core/src/domain/blockers.ts`): the pure publish/answer validation, the layered credential guard (layer 1 registered-secret match on every content path plus the `lane`/`ref` identifier fields; layer 2 name-shape on `credential-missing` question text; no pattern-based detection — TDR-0009), the audience/delegation resolver, the one shared ranking, the `laneResume` projection, and the human/machine renderers. No I/O, clock, randomness, or environment access.
- **State** (`packages/core/src/state/blockers.ts`): the two additive record kinds over the injected `StateStorePort` through the delivered validated artifact boundary (the `state/owner-gate-sla.ts` precedent): fenced append with post-append coverage verification, verified reads, derived open/answered fold, torn/duplicate classification. No schema bump.
- **CLI** (`packages/cli/src/commands/blockers.ts` + `commands/index.ts` + `edge.ts`): the `blockers` command definition over an injected runtime (`list [--open]`, `answer <id> [--choice <n>] [--text <text>]`, `publish <type> --lane <id> "<question>" [--options a,b] [--audience owner|coordinator]`); the edge composes real adapters, resolves the caller-audience environment fact through the branding seam, and is the only stream writer and exit projector. `status`/`brief` compositions gain one blockers state read each (spec §16).
- **Branding**: no product or binary literals; every user-visible name derives from the injected `BrandIdentity`; the caller-audience variable name derives from `brand.environmentPrefix` + the declared suffix (DEC-4).

### Pinned non-negotiables (from spec + test plan; binding on every phase)

1. **Error-gate allowlist first and exact**: add exactly `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch` to `RESERVED_TWO_SEGMENT_CODES` in BOTH `scripts/checks/error-table-sync.ts` (line ~72) and `tests/structure/error-table.test.ts` (its mirror Set) — no wildcard, no generic two-segment widening, no `blockers.*` pattern; a fifth/near-miss code still fails (spec §15 GAP-17 constraint, DEC-9, TC-BLK-007 step 4).
2. **Credential guard layered exactly**: layer 1 registered-secret-value refusal on question text, option values, free-text answers, AND the `lane`/`ref` identifier fields (GAP-15/AC-F3-4), evaluated before any record lands (zero persisted bytes, `not_landed`); layer 2 variable-name shape on `credential-missing` question text only; NO token-shape pattern layer anywhere (TDR-0009; negative controls TC-BLK-020 are permanent).
3. **v0 recorded-vs-applied boundary (DEC-5)**: answers are `DM-2` intent records with `applied: false`; the `laneResume` mode (`boundary-note` | `attach-continue` | `resume-prompt-reentry` + visible prefill cost) is recorded, never executed; application actors are downstream (M1-S18/M1-S23/M1-S9).
4. **One shared pure ranking** (priority class -> oldest `askedAt` -> id ascending; answered records in a resolved group after, never interleaved) consumed identically by the blockers list, the digest `typed-questions` section, and the brief `blocker-questions` anchor — no forked comparator (DEC-6/DEC-7, RSK-1).
5. **Answering identity from the environment fact with `owner` default (DEC-4)**; audience routing per the DM-4 delegation map; `blockers.audience-mismatch` exit 1 pinned by SC-M1-24.
6. **Byte-stability**: every existing command's behaviour, exits, and payload shapes stay byte-stable with exactly two declared exceptions — `status` gains the seventh fixed `typed-questions` section; `brief`'s `typed-questions` surface becomes a real section mirror (catalog 3 -> 2, anchors 2 -> 3, surfaces stay 9) — and `board` is explicitly untouched (DEC-10).
7. **Brand neutrality**: no binary/product literal is committed; injected brand binary name; `<binary>` placeholder discipline in docs/fixtures.
8. **Test wiring per test plan §7**: suite files, fixture strategy (fixed clock/run id, synthetic brand, registered-secrets via `deps.secrets`), golden fixtures read-only with mutation controls and an explicit regeneration script; aggregate `pnpm check` as the final gate.

### GAP-1..GAP-17 readings — confirmed or corrected by this plan

The test plan's seventeen recorded gaps were reviewed against spec v1.2 §5.1/§8.3/§8.5/§15, DEC-1..DEC-11, and TDR-0009. All resolved readings are **confirmed**; none is corrected. The delivery-bound readings are pinned here as follows (spellings may still be refined at delivery within the pinned behaviour — A-T8):

| GAP | Reading confirmed and pinned by this plan | Where encoded |
|-----|-------------------------------------------|---------------|
| GAP-1 | This plan maps all 43 TCs onto Phases 1–9 without reshaping any TC's behaviour, states, reasons, bounds, assertions, or AC/NFR mapping. Note: the test plan's §7 execution order lists TC-BLK-006 (CLI seam) in group 1, but the seam under test only exists once the command lands — this plan maps it to Phase 4 (behaviour unchanged; same pattern as GH-229's TC-SLA-026 note). | This document; §Test Scenarios |
| GAP-2 | Non-regression asserts the declared invariants, not full byte-equality of the two changed goldens: board and every non-`status`/`brief` command byte-stable; `status`/`brief` differ only by the declared section/surface/catalog/anchor edits (field-by-field diff). | Phase 7–8; TC-BLK-041 |
| GAP-3 | KPI read as "policy-refused cross-audience answers applied: 0"; owner->coordinator allowed per DEC-3/AC-F4-2 and not counted. | Phase 5; TC-BLK-022/023 |
| GAP-4 | Digest section order is contract data: the six existing ids keep their relative order, `typed-questions` appears exactly once (seven total). **Chosen index (delivery-bound, pinned by the golden): appended after `parked-work`** — the last position, the least disruptive to the existing mirror, with `BRIEF_SURFACE_ORDER` deriving automatically from `STATUS_SECTION_ORDER`. | Phase 7; TC-BLK-031 step 4 |
| GAP-5 | Over-cap/empty/missing publish and answer content, and malformed `decision-needed` options (no `--options`, empty element, >4 options, >60 chars, `--options` on a non-options type), are refused with the delivered `input.value.rejected` (exit 1, `not_landed`), never silently clamped; `blockers.invalid-type` stays type-only. | Phase 2; TC-BLK-016 |
| GAP-6 | `age` is integer milliseconds (`now − askedAt` from the injected clock — GH-229 parity), human compact form (`26h`, `2d`); `rank` an integer 1..N over open questions (answered carry none); status discriminator spelled `status: "open" \| "answered"`; answer substance fields `choice` (option value) / `text`. | Phase 2; TC-BLK-029/034 |
| GAP-7 | Semantic duplicate answer for one question id and integrity-torn ledgers fail closed `state.store.torn`; undeclared record kind/payload schema fails `state.store.unknown`; commands exit 2; digest/brief render `state-unreadable` at exit 0. | Phase 3–4; TC-BLK-011/012 |
| GAP-8 | The injected capability fact may name a preferred mode; when absent, the recorded mode is the declared stable default **`boundary-note`** — tests assert membership, determinism, and mutation-liveness, never the choice. | Phase 2; TC-BLK-026 step 3 |
| GAP-9 | Prefill-cost marker: a declared field (proposed spelling `prefillCost`) present exactly on `resume-prompt-reentry` and visibly rendered on the human answer line; absent on the other two modes. | Phase 2/6; TC-BLK-027 |
| GAP-10 | Variable = `brand.environmentPrefix` + declared suffix **`CALLER_AUDIENCE`** (upper snake); exact values `owner`/`coordinator`; absent, empty, or unrecognized values behave as absent -> `owner`; never a committed literal. | Phase 1 contract datum; Phase 4 edge; TC-BLK-024 |
| GAP-11 | Publish `data` exposes the created question id and its DM-1 fields through a declared shape (the ledger/verified read is the authoritative oracle); `ref` is `null` in v0 (no synopsis flag); the list payload always carries `options` as an array (empty for non-option types). | Phase 2/4; TC-BLK-009/034 |
| GAP-12 | No new input cap for `lane`/`ref`: the renderers clamp or truncate any unbounded rendered field so the machine ≤ 65 536-byte and human ≤ 24-line/4 096-byte bounds hold, with an explicit clamp/omission marker. | Phase 2/8; TC-BLK-035 step 4 |
| GAP-13 | `counts.total` = open-question count (answered excluded), `omitted` = dropped count, `truncated` true iff items were dropped, `observed + unknown = total`; verified read -> `observed = openCount, unknown = 0`; failed/torn read -> section state `unknown`, total 0, reason `state-unreadable`. | Phase 7; TC-BLK-031/033 |
| GAP-14 | One-cycle bound is structural: sequential invocations over one temp store root (publish, then the next `status`/`brief`/`blockers list`); no timer, daemon, or cache. | Phase 7; TC-BLK-031 |
| GAP-15 | Layer 1 guards the three content paths AND the `lane`/`ref` identifier fields (AC-F3-4); the answer-path half evaluates the referenced question's `lane`/`ref` (seeded-record case) before appending; legitimate `L2`/`GH-230`/`PDEV-123` identifiers accepted; no shape-based refusal implied. | Phase 2/5; TC-BLK-043 |
| GAP-16 | Platform-fault exits defer to the delivered machine table: `state.permission.denied` exit 1; `state.store.torn`/`state.lock.busy` exit 2; the `blockers` family adds no exit-2 row. | Phase 4/6; TC-BLK-040 step 5 |
| GAP-17 | The exact four-code allowlist addition in both files (pinned non-negotiable 1); the S1/S3 scanner recognizes the four codes; the collector family recognizer stays unchanged. | Phase 1; TC-BLK-007 |

One additional confirmation (not a GAP): the pack's worked `applied: true` example and its `--text` publish form are illustrative only (spec Appendix A caveats); fixtures and goldens follow the pinned v0 posture (`applied: false`) and the synopsis positional question text.

### Open questions

- **OQ-T5 (GAP-8)** — resume-mode default when the capability declares injection without a preferred mode: working default `boundary-note` (declared stable, deterministic); tests assert membership/stability/liveness. Route to review at plan review; a different default is a spelling change, not a behaviour change.
- **OQ-T7 (GAP-4)** — the absolute index of the digest `typed-questions` section and the brief mirror: chosen after `parked-work` (pinned by the golden at Phase 7); totality, id stability, and the six existing sections' relative order are asserted regardless.
- **OQ-T10 (RSK-T13)** — CI tolerance for the 50 ms pure-path measurement: warm-up + median, pure path only, environment recorded; the spec bound is not silently relaxed. Record the measured value in the PR.
- **TDR-0009 security-residual acceptance** (and the GAP-15 identifier-field extension flag): both ride the GH-230 PR review — surface the TDR-0009 status and the GAP-15 PR flag in the PR description; a veto reopens the guard scope in-change before merge. No `@decision-advisor` consult needed for delivery: TDR-0009 already resolves OQ-1.

No other open questions. All spec OQs are resolved (OQ-1 by TDR-0009; the remaining test-plan OQs are the delivery-bound readings pinned above).

## Scope

### In Scope

- F-1 typed question records via the state layer: closed four-type vocabulary, validated publish, generated `q-` ids, derived open/answered closure, torn/wrong-kind/malformed/verified-empty classification.
- F-2 type validation and per-type answer channels; one authoritative answer per question id; `input.value.rejected` for channel/bounds violations (GAP-5).
- F-3 the layered credential guard: layer 1 on question text, option values, free-text answers, and the `lane`/`ref` identifier fields; layer 2 name-shape on `credential-missing` question text; TDR-0009 negative controls; zero persisted bytes on refusal.
- F-4 audience routing: closed audience on every question, publish default `coordinator`, caller-audience environment fact (owner default), DM-4 delegation policy-as-data, the confused-deputy refusal (`blockers.audience-mismatch`, "delegation policy: none", SC-M1-24).
- F-5 answer-as-data: `DM-2` intent records with the `laneResume` projection (three modes, two capability sources, prefill cost on the fallback), `applied: false` in v0, zero session touch.
- F-6 the shared ranking plus digest/brief integration: seventh digest section, brief mirror with stable id, placeholder catalog 3 -> 2, `blocker-questions` real anchor (anchors 2 -> 3, decision-first), surfaces stay 9, declared truncation, pickup predicate payload-determinable (DEC-8 declaration only).
- F-7 the `blockers` command surface (list/answer/publish) with the standard envelope, `{0,1,2}` projection, bounds, determinism, brand neutrality.
- The four-row `blockers` error family in one new domain kind, the exact two-segment allowlist in both owning files, the documented S2 rows, corpora, and sync mutations.
- Read cost (one verified read per surface, one fenced append + coverage per mutation), the 50 ms measurement, privacy, corpus + goldens with mutation controls, non-regression.
- One minor changeset per repo conventions; the docs-adjacent repo invariants this change owns (command-registry row assertion, man-page anchor consistency).

### Out of Scope

- [OUT] Daemon application of answers and control-socket wake — M1-S18 (GH-238).
- [OUT] Coordinator supervision and pickup-contract enforcement — M1-S23 (GH-241).
- [OUT] The one-shot `dispatch --resume` path — M1-S9 (GH-239).
- [OUT] Real harness adapters / resume-injection capability delivery — M1-S11 (GH-233); the capability is consumed as an injected fact.
- [OUT] Invocation audit ledger and caller-identity authentication — M1-S22 (GH-223); claimed-not-proven attribution only.
- [OUT] Out-of-band delivery, MCP/host mirrors, configuration keys, owner-gate->question conversion, board changes — NG-6..NG-9, DEC-10.
- [OUT] Authoring `doc/spec/**` feature documentation — lifecycle phase 7 (`@doc-syncer`). Single exception: the four documented error-table rows in `doc/spec/features/feature-result-contract.md`, the binding S2 sync surface (GH-229 precedent — contract-sync, not doc authoring).
- [OUT] Editing the planning pack or the command registry — verified planning truth (asserted, never authored).

### Constraints

- **Spec and test plan are binding** (A-T1/A-T2): no pinned value may be rebound; TC behaviour/states/reasons/bounds/assertions/AC-NFR mapping are fixed; delivery chooses only delivery-bound spellings (A-T8).
- **Tier discipline** (ADR-0003, `.ai/rules/typescript.md`): contracts data-only; domain imports `#contracts` and sibling domain modules only; the state module touches only the state port/artifact boundary; runtime/I/O only at the CLI edge; no new package, subpath, or runtime-API location; no ambient clock/randomness/env in neutral tiers (the caller-audience env fact is resolved at the composition edge and injected as data).
- **Error contract**: the family is exactly four user-validation rows (`category: "user"`, `retryable: false`, `consequence: "not_landed"`, `projectionClass: "user-validation"`) in exactly one new `blockers` domain kind; malformed answers reuse `input.value.rejected`; state faults reuse the delivered `state.*` rows at their delivered projections (GAP-16); no `blockers.*` exit-2 row; no classifier change is needed — the four codes resolve through the table's `blockers` kind (unlike GH-229's collector family, there is no family recognizer to add; the only check-script edit is the exact allowlist).
- **Registered-secrets record is shared**: layer 1 consumes the same injected record as the serialization redaction chokepoint; no new secret-read allowlist entry (`tests/checks/secret-read-boundary.test.ts` stays green).
- **Documented error table is a binding sync surface**: `doc/spec/features/feature-result-contract.md` (S2) gains the four rows in Phase 1 together with the machine rows or `bun test` fails.
- **Command registry and man page are planning truth**: `doc/planning/oss-tooling/cli-command-registry.md` already declares the `blockers` row (verified, line 173); the blockers man page names `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected` (ERRORS) plus `blockers.audience-mismatch` (worked example). No in-change authoring; Phase 9 adds tree invariants (registry row exactly once; every pack-named `blockers.*` code resolves through the delivered machine table — subset direction, the pack is non-exhaustive by design).
- **Doc-distribution guard**: `doc/spec/**` is outside the `ados_distribution` marker set (GH-229 verified); the single S2 sync edit does not trigger `scripts/.tests/test-doc-distribution.sh` — run it only if a redistributable doc unexpectedly changes.
- **Byte-stability**: `board`, `queue`, `verify`, `closeout`, `plan`, `config`, and every other existing command stay byte-stable; `status`/`brief` change only through the declared §8.5 edits, executed atomically in Phase 7.
- **Branding seam**: no product/binary literals; `tests/structure/branding-seam.test.ts` and the forbidden-literals scanner extend to the new modules automatically.
- **Commits**: one Conventional Commit per phase (commitlint config-conventional), staged by `@committer` during delivery; per-phase plan checkbox/execution-log and pm-notes updates ride each phase's commit (delivery bookkeeping).
- **Versioning**: lockstep `fixed` group via `.changeset/`; one minor changeset (naming per the `gh-229-owner-gate-sla-minor.md` precedent); no new dependencies, so no license-registry verdict.

### Risks

From spec §11, with the owning phase's mitigation:

- **RSK-1** (forked ranking): one shared pure domain function from Phase 2; Phase 7's TC-BLK-030 asserts identical order/rank on all three surfaces plus a forked-comparator structure mutation.
- **RSK-2** (credential boundary too narrow/too broad): layered guard from Phase 2; Phase 5 pins layer 1 (all paths + identifiers, zero bytes), layer 2 (path-scoped), and the TDR-0009 negative controls (unregistered token-like prose accepted).
- **RSK-3** (claimed identity): DEC-4 declared posture; Phase 5 pins exact/absent/unrecognized resolution and no audit/env persistence.
- **RSK-4** (error-table drift): exact four rows + exact allowlist + both-direction corpora + mutations from Phase 1; the sync gate runs in CI.
- **RSK-5** (digest/brief ripple): the closed-set evolution moves atomically in Phase 7 (section order, surface set, catalog, anchors, bounds, corpus, goldens together); non-regression pinned in Phase 8.
- **RSK-6** (v0 posture misread): `applied: false` pinned on envelope, record, and golden (Phase 6/8, TC-BLK-028).
- **RSK-7** (literal leaks): brand neutrality pinned in Phase 1 (checks) and Phase 5 (behaviour, two brands).
- **RSK-8** (daemon wait misread): per-invocation collection pinned structurally in Phase 7 (TC-BLK-031/037).
- Delivery risks: RSK-T14 (drift from plan-local readings) mitigated by the GAP table above; any change to a pinned reading reopens the test plan per A-T2.

### Success Metrics

From spec §4.1: 100% of published blockers visible in the digest/brief ranking on the first collection after publish; 100% of questions carrying a valid audience; 0 policy-refused cross-audience answers applied; 0 credential values persisted or rendered; 100% of answers recorded with a `laneResume` mode from the closed set; 0 surface disagreements on question order; 0 invalid types accepted. Aggregate gate: `pnpm check` green plus the test plan §7 evidence commands.

## Phases

### Phase 1: Blockers contract vocabulary and the four-row error family with the exact two-segment allowlist

**Goal**: Land every pinned datum as inspectable contract data (DM-1..DM-6 vocabulary) and the `blockers` error family with its binding sync — including the exact four-code `RESERVED_TWO_SEGMENT_CODES` addition in BOTH owning files — before any behaviour exists, because the error-table sync gate blocks every later phase's prose/code references to the four codes (spec §15 constraint).

**Tasks**:

- [ ] **1.1** Create `packages/core/src/contracts/blockers.ts` (data-only, `as const` + types): `BLOCKER_QUESTION_TYPES = ["decision-needed","spec-ambiguity","credential-missing","external-wait"]` in declared order; the per-type answer-channel map (`decision-needed -> choice`; the other three -> `text`); `BLOCKER_AUDIENCES = ["owner","coordinator"]` consumed from the delivered owner-gate seam (re-export or value equality — no parallel literal drift); the type-derived priority map (`decision-needed: 1`, `credential-missing: 1`, `spec-ambiguity: 2`, `external-wait: 3`); `BLOCKER_RESUME_MODES = ["boundary-note","attach-continue","resume-prompt-reentry"]`; `BLOCKER_CAPABILITY_SOURCES = ["adapter-declared","capability-absent"]`; the projection-rule datum (only `resume-prompt-reentry` carries `sessionReentry: true`); the variable-name shape as a data pattern; content caps `120`/`4`/`60`/`160`; render caps by reference to `STATUS_MAX_MACHINE_BYTES`, `STATUS_MAX_HUMAN_LINES`, `STATUS_MAX_HUMAN_BYTES`, and the 8-question cap (`STATUS_MAX_ITEMS_PER_SECTION` — no parallel numeric literal); the record kinds and payload schemas `delivery.blocker.question.v1` / `delivery.blocker.answer.v1` inside `delivery.state.v1` (no schema-version bump declared); the DM-4 delegation map (four rows: owner->owner allowed, owner->coordinator allowed, coordinator->coordinator allowed, coordinator->owner refused with policy label `none`); the caller-audience suffix datum (GAP-10: `CALLER_AUDIENCE`); `BLOCKERS_ERROR_CODES` (the four codes, consistency-checked against the table by TC-BLK-007); `BLOCKERS_SCHEMA_VERSION` (`"delivery.blockers.v1"`) for list/answer/publish `data`. (evidence: `bun test tests/structure/blockers-contract.test.ts`)
- [ ] **1.2** In the same contracts module, declare the types: the DM-1 question payload (`id`, `type`, `audience`, `lane`, `ref` null-when-absent, `question`, `options[]` ordered options-bearing-only, `askedAt` — no stored status/age/rank); the DM-2 answer payload (`questionId`, `answeringAudience`, `choice`-or-`text` substance, `answeredAt`, `applied`, embedded `laneResume`); the DM-3 projection type (`mode`, `sessionReentry`, `capabilitySource`, prefill marker on the fallback only); publish/answer input types; the list item type (`id`, `type`, `audience`, `lane`, `ref`, `question`, `options[]` always-array, `askedAt`, `age`, `rank`, `status` discriminator — GAP-6/11); the runtime-dependency types (clock, id generator, secrets record, caller-audience fact, adapter capability fact, delegation snapshot). Re-export from `packages/core/src/contracts/index.ts`; register in `tests/structure/inventory.json` with data-only allowances. (evidence: `pnpm typecheck`; `bun test tests/structure/content-inventory.test.ts`)
- [ ] **1.3** Error family, machine side: `packages/core/src/contracts/error-table.ts` — `DOMAIN_KINDS` gains exactly `"blockers"` (one new kind, no other); `ERROR_TABLE` gains exactly four rows (`blockers.invalid-type` hint naming the closed set; `blockers.unknown-id` naming the id and next action; `blockers.credential-value-rejected` hint stating that credential questions carry the variable name only and the value comes from the environment; `blockers.audience-mismatch` hint naming the question's audience and the consulted policy row — including the exact token `delegation policy: none` on that path) — all `user` / `retryable: false` / `not_landed` / `user-validation`. No classifier change: the codes resolve through the table's `blockers` kind via `resolveAppErrorCode`/`classifyDomainKind`. (evidence: `bun test tests/structure/error-table.test.ts`)
- [ ] **1.4** **Exact allowlist (non-negotiable)**: add exactly `blockers.invalid-type`, `blockers.unknown-id`, `blockers.credential-value-rejected`, `blockers.audience-mismatch` to `RESERVED_TWO_SEGMENT_CODES` in BOTH `scripts/checks/error-table-sync.ts` AND `tests/structure/error-table.test.ts` (each file owns its own Set; today `provider.outage` + the three `watchdog.*` codes). No wildcard, no pattern relaxation, no family recognizer for `blockers`; the collector family recognizer stays unchanged. Assert the S1/S3 scanner now recognizes the four codes. (evidence: `bun run scripts/checks/error-table-sync.ts`)
- [ ] **1.5** Documented table (binding S2 sync surface, in-change): add exactly the four rows with matching columns to `doc/spec/features/feature-result-contract.md`. No other doc/spec prose (phase 7 lifecycle owns the rest). (evidence: `bun run scripts/checks/error-table-sync.ts` — zero failures, expected counts recorded)
- [ ] **1.6** Corpora and sync mutations: add true-positive corpus rows for the four codes and false-positive rows for near-miss spellings (`blockers.invalid_type`, `blockers.unknown`, `blocker.invalid-type`, `blockers.extra-code`) under `tests/fixtures/result/code-corpora`; extend `tests/checks/error-table-sync.test.ts` mutation coverage (remove a documented row, add an undocumented `blockers.*` code, change a row's category/consequence/projection, add a fifth family row, widen the reserved set generically — each must fail by name). (evidence: `bun test tests/checks/error-table-sync.test.ts`)
- [ ] **1.7** Create `tests/structure/blockers-contract.test.ts` (TC-BLK-001 all steps; TC-BLK-002 steps 1–4 data totality; TC-BLK-003 contract half): per-datum deep-copy mutation controls (fifth type, second channel, moved priority, third audience, fourth mode, widened name pattern, changed cap, renamed schema, flipped/missing/fifth delegation row); declaration-only detector; subpath export; inventory registration. (evidence: suite green)

**Acceptance Criteria**:

- Must: the closed vocabulary (four types/channels, two audiences from the seam, three priority classes, three modes, two sources, name shape, caps by reference, two payload schemas, four-row delegation map) is pinned as data and fails by name on drift (TC-BLK-001, TC-BLK-002 data half). 
- Must: `bun run scripts/checks/error-table-sync.ts`, `bun test tests/checks/error-table-sync.test.ts`, and `bun test tests/structure/error-table.test.ts` are green with exactly +1 domain kind and +4 rows, both-direction agreement, and the exact four-code reserved allowlist in both files; near-misses are not recognized (TC-BLK-007, GAP-17).
- Should: export spellings follow repo precedents so later phases need no renames.

**Files and modules**:

- Code areas: `packages/core/src/contracts/blockers.ts` (new), `packages/core/src/contracts/error-table.ts` (updated), `packages/core/src/contracts/index.ts` (updated), `scripts/checks/error-table-sync.ts` (updated — exact allowlist only), `tests/structure/error-table.test.ts` (updated — exact mirror allowlist), `tests/checks/error-table-sync.test.ts` (updated), `tests/fixtures/result/code-corpora/**` (updated), `tests/structure/blockers-contract.test.ts` (new), `tests/structure/inventory.json` (updated).
- System docs: `doc/spec/features/feature-result-contract.md` (updated — the four documented rows only).

**Tests**: TC-BLK-001, TC-BLK-002 (steps 1–4), TC-BLK-003 (contract half), TC-BLK-007, TC-BLK-008 (structure/checks half). Iteration gates: `pnpm typecheck`, `bun run scripts/checks/error-table-sync.ts`, `bun test tests/structure/blockers-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts`.

**Completion signal**: `feat(GH-230): add blockers contract vocabulary and the four-row error family`

---

### Phase 2: Pure blockers domain — validation, layered credential guard, audience routing, shared ranking, laneResume projection, renderers

**Goal**: Deliver the pure, fixture-testable core (F-2/F-3/F-4/F-5/F-6 evaluation halves, DEC-2/DEC-5/DEC-7, TDR-0009, GAP-5/6/8/9/10/12) with purity/tier structure suites and the ranking unit suite — zero I/O, everything over injected facts.

**Tasks**:

- [ ] **2.1** Create `packages/core/src/domain/blockers.ts`: publish validation — unknown type -> `blockers.invalid-type` (before any content/audience/option guard); invalid audience / empty lane / over-cap or empty question / malformed options -> `input.value.rejected` (GAP-5); audience default `coordinator`; options order preserved verbatim. Answer validation — channel per type (`--choice` value recorded as the option value, not the index), out-of-range/`0`/negative/non-numeric index, wrong channel, both/neither, empty text, answer-to-answered -> `input.value.rejected`. (evidence: `pnpm typecheck` + suites in 2.6)
- [ ] **2.2** Credential guard (pure, evaluated before any append): layer 1 — registered-secret-value match (the injected secrets record) over question text, every option value, answer text, and the `lane`/`ref` identifier fields (GAP-15) -> `blockers.credential-value-rejected` with the name-only/environment hint; layer 2 — `credential-missing` question text must match the declared variable-name shape (pattern datum from contracts) -> same identity; layer 2 applies to that path only; NO token-shape pattern scan anywhere else (TDR-0009 — assert no pattern set beyond the name-shape datum). (evidence: unit cases in the Phase 5 suites; purity via TC-BLK-004)
- [ ] **2.3** Audience routing: `resolveAnsweringAudience` (exact `owner`/`coordinator`; absent/empty/unrecognized -> `owner` — GAP-10) and the delegation resolver reading the DM-4 map (no audience literal branch; missing row = declared refusal, never implicit allow) -> allow, or `blockers.audience-mismatch` naming the question's audience and the policy row (`delegation policy: none` on the shipped map). (evidence: TC-BLK-002 steps 5–6 extension; Phase 5 suites)
- [ ] **2.4** The shared ranking: `rankOpenQuestions` — priority class (type-derived map) -> oldest `askedAt` -> id ascending; contiguous ranks 1..N over open questions; answered records excluded from the open ranking and returned as a resolved group after all open ones (age order, then id); pure and stable under input permutation. This is the ONLY ranking in the change (DEC-6/DEC-7); digest/brief/list consume it, never a second comparator. (evidence: `bun test tests/behaviour/blockers-ranking.test.ts` — unit half)
- [ ] **2.5** `laneResume` projection + renderers: projection from the injected capability fact (declared preferred mode honoured; no preferred mode -> the stable default `boundary-note`, GAP-8; `resumeInjection: false`/absent -> `resume-prompt-reentry`, `sessionReentry: true`, source `capability-absent`, prefill-cost marker present — GAP-9; declared -> source `adapter-declared`, no marker); `applied: false` posture. Renderers: the human list renderer (one ranked line per question naming id/type/audience/lane/age/rank, visibly separate resolved group, declared truncation with exact omitted count, brand-derived header, compact age form); the answer human line (recorded mode; prefill cost only on the fallback; never claims the lane was resumed); machine `data` projection (`questions[]` with the declared fields incl. always-array `options` and null `ref`; `age` integer ms from the injected clock; clamping of unbounded rendered fields per GAP-12). (evidence: `pnpm typecheck` + Phase 4/6 suites)
- [ ] **2.6** Update `packages/core/src/domain/index.ts` (re-export); register in `tests/structure/inventory.json`. Create `tests/structure/blockers-imports.test.ts` (TC-BLK-004: `#contracts`/sibling-domain imports only; AST purity over `Date.now`/`new Date`/`Math.random`/`process`/`Bun`/`fetch`/timers/`node:*`; runtime sentinels; determinism under changed wall-clock/env; planted-`process.env` control fails by name) and extend `tests/structure/blockers-contract.test.ts` with TC-BLK-002 steps 5–6 (resolver liveness on deep copies; no audience literal in the resolver). (evidence: `bun test tests/structure/blockers-imports.test.ts tests/structure/blockers-contract.test.ts`)
- [ ] **2.7** Create the shared fixture builders under `tests/fixtures/blockers/{matrix,policy,identity,capabilities,ranking,credentials,bounds}/**` (TypeScript builders per the GH-229 delivery-note precedent: facts + deep-copy variants for mutation controls; synthetic secrets only; never named `*.test.ts`) and the ranking unit half of `tests/behaviour/blockers-ranking.test.ts` (TC-BLK-029 steps 1–3/6–7 on the pure function: class-before-age, oldest-then-id ties incl. reverse-of-insertion id order, contiguous ranks, answered-after-open, permutation invariance, priority-map liveness). (evidence: `bun test tests/behaviour/blockers-ranking.test.ts`)

**Acceptance Criteria**:

- Must: the domain is pure and tier-confined (TC-BLK-004); the closed sets drive validation, the guard, routing, and ranking (mutation-live); the shared ranking satisfies DEC-7 exactly at the unit seam (TC-BLK-029 unit half).
- Must: the guard's refusal identities and order (type before content; guard before append) match DEC-2/GAP-5 (unit-level; end-to-end pinned in Phase 5).
- Should: evaluation of the cap-sized fixture is comfortably inside the 50 ms budget (formally measured in Phase 8).

**Files and modules**:

- Code areas: `packages/core/src/domain/blockers.ts` (new), `packages/core/src/domain/index.ts` (updated), `tests/structure/blockers-imports.test.ts` (new), `tests/structure/blockers-contract.test.ts` (updated), `tests/behaviour/blockers-ranking.test.ts` (new — unit half), `tests/fixtures/blockers/**` (new builders), `tests/structure/inventory.json` (updated).
- System docs: none (phase 7 lifecycle owns feature-spec reconciliation).

**Tests**: TC-BLK-002 (completes), TC-BLK-004, TC-BLK-024 (resolver unit half), TC-BLK-029 (unit half). Iteration gates: `pnpm typecheck`, `bun test tests/structure/blockers-imports.test.ts tests/structure/blockers-contract.test.ts tests/behaviour/blockers-ranking.test.ts`.

**Completion signal**: `feat(GH-230): add pure blockers domain (validation, guard, routing, ranking, resume)`

---

### Phase 3: State record kinds — EVT-1/EVT-2 over the injected port

**Goal**: Persist the two additive record kinds (DM-1/DM-2, DEC-11, NFR-2/NFR-7) through the delivered validated artifact boundary: fenced appends with post-append coverage verification, verified reads, derived closure, torn/duplicate fail-closed classification — no schema bump, no existing kind touched.

**Tasks**:

- [ ] **3.1** Create `packages/core/src/state/blockers.ts` (the `state/owner-gate-sla.ts` precedent, over `createArtifactBoundary`): declare the two artifact kinds (`delivery.blocker.question.v1` / `delivery.blocker.answer.v1`) with their closed fields and vocabularies; key prefixes (proposed spellings `blockers.questions:<id>` / `blockers.answers:<questionId>`); `appendBlockerQuestion` / `appendBlockerAnswer` — one `acquireFence`, one `append`, one coverage read verifying exactly +1 record, `releaseFence`, payload validated against the declared kind before any byte lands; `readBlockerQuestions`/`readBlockerAnswers` — verified reads folding sequence order into the derived open/answered view (answer presence by question id, never a stored flag, never a ledger-position fold); verified-empty evidence for absent stores; a duplicated answer history for one question id classifies `state.store.torn`; undeclared kind/payload `state.store.unknown`; no `STATE_SCHEMA_VERSION` change, no existing record kind or derived document touched. Export from `packages/core/src/state/index.ts`; register in `tests/structure/inventory.json`. (evidence: `bun test tests/behaviour/blockers-records.test.ts` — port-level half)
- [ ] **3.2** Create `tests/behaviour/blockers-records.test.ts` (port-level cases, TC-BLK-005 complete + the state-seam halves of TC-BLK-009..013): over `tests/fixtures/state/harness.ts` temp roots and the `guardStore` recorder — exactly one fence/append/coverage per publish/answer over the injected port; append-only byte-prefix proof; durable reopen through a verified read; verified-empty -> empty ranking, not a zeroed record; undeclared field/vocabulary value -> `state.store.unknown` with zero bytes; injected second answer record -> `state.store.torn`, no derived last-answer-wins; fence-busy -> `state.lock.busy`, no append; structure half in `tests/structure/blockers-imports.test.ts` (state consumer imports only the contracts/state boundary; no `node:*`/`fs`/`process`; the fake port is the only channel). (evidence: `bun test tests/behaviour/blockers-records.test.ts tests/structure/blockers-imports.test.ts`)

**Acceptance Criteria**:

- Must: TC-BLK-005 green — the state consumer is a validated, port-injected layer: one fenced append + coverage per mutation, declared-kind validation before landing, verified reads, no direct runtime I/O.
- Must: `STATE_SCHEMA_VERSION` unchanged; existing record kinds/reads/derived documents untouched (additive inside `delivery.state.v1`); duplicate/torn histories fail closed (GAP-7).
- Must: the read folds by record identity and derives closure; question bytes are never rewritten.

**Files and modules**:

- Code areas: `packages/core/src/state/blockers.ts` (new), `packages/core/src/state/index.ts` (updated), `tests/behaviour/blockers-records.test.ts` (new — port-level half), `tests/structure/blockers-imports.test.ts` (updated — state-consumer half), `tests/fixtures/state/harness.ts` (extended only if a blocker-record seeding helper is needed), `tests/structure/inventory.json` (updated).
- System docs: none (state-layer spec reconciliation is lifecycle phase 7; the kinds are additive).

**Tests**: TC-BLK-005; state-seam halves of TC-BLK-009/010/012/013. Iteration gates: `pnpm typecheck`, `bun test tests/behaviour/blockers-records.test.ts tests/structure/blockers-imports.test.ts`.

**Completion signal**: `feat(GH-230): add blocker question and answer record kinds to the state layer`

---

### Phase 4: `blockers` command surface — list, answer, publish

**Goal**: Ship the F-7 surface (DEC-1/DEC-3/DEC-9, GAP-16): the three-subcommand grammar over an injected runtime, edge composition with the caller-audience fact, the in-process harness, and the publish/records/types behaviour suites through `runCli`.

**Tasks**:

- [ ] **4.1** Create `packages/cli/src/commands/blockers.ts`: `BlockersCommandRuntime` — every dependency injected (brand, clock, run-id factory, registered-secrets record, id generator, state store port, caller-audience resolved fact, adapter capability fact, delegation policy snapshot, optional session port used by nothing in v0); `createBlockersCommandDefinition(runtime): CommandDefinition` with exactly `list [--open]`, `answer <id> [--choice <n>] [--text <text>]`, `publish <type> --lane <id> <question> [--options a,b] [--audience owner|coordinator]`; missing/extra subcommands, unknown flags, missing `--lane`/question -> `fallback.invocation` exit 1 before any state read; the handler validates (type -> audience -> content/options -> guard), reads once, appends once through the Phase-3 module, and returns data or one classified failure — no stream writes, no `console.*`, no `process.exit`, no exit literal. Update `packages/cli/src/commands/index.ts`. (evidence: `bun test tests/structure/blockers-cli-seam.test.ts`)
- [ ] **4.2** Compose the edge (`packages/cli/src/edge.ts`, `packages/cli/src/index.ts` if deps widen): register `commands.blockers` beside the other top-level commands; the blockers runtime resolves the caller-audience environment fact through the branding seam (`environmentPrefix` + the declared suffix — GAP-10) at this composition point only; real state driver, clock, secrets from the delivered injection, fence tokens; registered in `tests/structure/inventory.json`. The human text path uses the Phase-2 renderer; serialization and exit projection stay at the edge. (evidence: CLI build + content-inventory suite)
- [ ] **4.3** Create `tests/fixtures/blockers/harness.ts` (the §4.1 binding harness contract): `runCli` in process with buffer sinks; injected fixed clock (`2026-11-06T12:00:00Z` form), fixed run id, synthetic brand, synthetic registered secrets via `deps.secrets`, deterministic id generator; the `guardStore` recorder (throws on forbidden mutations); a throwing session-port spy (`spawn`/`attach`/`resume`/`steer` — RSK-T10 non-vacuity); a throwing `fetch` guard; an ambient-environment probe (the caller-audience fact is the only environment input). (evidence: suites below)
- [ ] **4.4** Create `tests/structure/blockers-cli-seam.test.ts` (TC-BLK-006): write-free/exit-literal-free handler source scan; exactly the three declared subcommands with the exact flag grammar; every malformed invocation -> `fallback.invocation` before any read; human mode's only text producer is the renderer; planted `console.log`/`process.exit` control fails by name. (evidence: suite green)
- [ ] **4.5** Create the integration suites over the harness: `tests/behaviour/blockers-publish.test.ts` (TC-BLK-009: exactly one DM-1 record, verified read, all fields, ordered options, injected `askedAt`, `ref: null`, LF-terminated append, before-bytes-prefix, durable reopen, second publish control); extend `tests/behaviour/blockers-records.test.ts` (TC-BLK-010/013 runCli halves: unique `q-` ids, no stored status fields, derived closure, DM-2 field set incl. `applied: false` and embedded projection, choice-value vs text substance, no session-actuation fields); `tests/behaviour/blockers-record-integrity.test.ts` (TC-BLK-011/012: torn/corrupt/checksum/wrong-kind/malformed/undeclared-vocabulary -> exit 2 classified `state.*` with zero appends and no fabricated question; verified-empty -> exit 0 explicit; second answer -> `input.value.rejected` with the first authoritative; injected duplicate -> `state.store.torn`; coverage +1; schema baseline unchanged); `tests/behaviour/blockers-types.test.ts` (TC-BLK-014); `tests/behaviour/blockers-answer-channels.test.ts` (TC-BLK-015); `tests/behaviour/blockers-options.test.ts` (TC-BLK-016, at-cap accepted / over-cap refused / multibyte). (evidence: the six suites green)

**Acceptance Criteria**:

- Must: TC-BLK-006 green — the handler is a pure data/failure producer; the grammar is exactly the man-page surface plus the audience refinement; rejections happen before any state read.
- Must: TC-BLK-009..016 green through `runCli` — publish/answer/list behave per F-1/F-2 with exact envelopes, exits, zero-byte refusals, and append-only integrity.
- Must: state faults surface at their delivered projections (`state.permission.denied` exit 1; `state.store.torn`/`state.lock.busy`/`state.store.unknown` exit 2 — GAP-16).
- Should: the CLI registration diff is minimal and mirror-imaged on the existing commands.

**Files and modules**:

- Code areas: `packages/cli/src/commands/blockers.ts` (new), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `packages/cli/src/index.ts` (updated only if the run-time deps type widens), `tests/structure/blockers-cli-seam.test.ts` (new), `tests/fixtures/blockers/harness.ts` (new), `tests/behaviour/blockers-{publish,record-integrity,types,answer-channels,options}.test.ts` (new), `tests/behaviour/blockers-records.test.ts` (updated), `tests/structure/inventory.json` (updated).
- System docs: none in-change. The command-registry row already exists (planning truth, verified).

**Tests**: TC-BLK-003 (completes — the CLI module is the last inventory registration), TC-BLK-006, TC-BLK-009, TC-BLK-010, TC-BLK-011, TC-BLK-012, TC-BLK-013, TC-BLK-014, TC-BLK-015, TC-BLK-016. Iteration gates: `pnpm typecheck`, `bun test tests/structure/blockers-cli-seam.test.ts tests/behaviour/blockers-{publish,records,record-integrity,types,answer-channels,options}.test.ts`.

**Completion signal**: `feat(GH-230): add blockers command surface (list, answer, publish)`

---

### Phase 5: Credential-guard and audience-routing behaviour — layered guard, identifiers, TDR-0009 controls, delegation, identity

**Goal**: Pin F-3/F-4 end-to-end (AC-F3-1..AC-F3-4, AC-F4-1..AC-F4-3, SC-M1-24, NFR-6, RSK-2/RSK-3): every guarded path with zero-byte refusals and no-leak assertions, the TDR-0009 negative controls, the confused-deputy refusal and the policy-as-data exception, and the identity resolution — all through the harness, with targeted guard/routing fixes where a pin fails.

**Tasks**:

- [ ] **5.1** Create `tests/fixtures/blockers/credentials/**` (synthetic registered secrets incl. `blocker-test-secret-0001`; clearly-fake unregistered token-like strings; name-shaped variables; prose/value-shaped refusals; identifier-field cases; `L2`/`GH-230`/`PDEV-123` legitimate controls) and `tests/behaviour/blockers-credential.test.ts` (TC-BLK-017: layer-1 refusal with the exact identity, exit 1, `not_landed`, zero ledger bytes on question text / option value / answer `--text`; the secret absent from stdout/stderr/envelope/human line; the name-only hint; refusal-before-append; clean control succeeds after each refusal; plus TC-BLK-018: `deps.secrets` swap proves the injected record is the oracle; chokepoint parity; `tests/checks/secret-read-boundary.test.ts` green with the blockers modules registered — no new allowlist entry). (evidence: `bun test tests/behaviour/blockers-credential.test.ts tests/checks/secret-read-boundary.test.ts`)
- [ ] **5.2** Create `tests/behaviour/blockers-credential-shape.test.ts` (TC-BLK-019: name-shaped texts accepted and rendered name-only on all ranked surfaces; prose/value forms refused `blockers.credential-value-rejected` with zero bytes; the rule is path-scoped — the same prose accepted on `spec-ambiguity`/`external-wait`; pattern-datum mutation liveness; layer 1 wins over layer 2 when a name-shaped text contains a registered value). (evidence: suite green)
- [ ] **5.3** Create `tests/behaviour/blockers-credential-negative-controls.test.ts` (TC-BLK-020, permanent regression): unregistered token-like prose accepted on every non-`credential-missing` content path; the same string as a `credential-missing` question refused by layer 2; registered values refused by layer 1 on every path; no pattern layer exists (no pattern set declared beyond the name-shape datum; no privacy-guard import). This suite is TDR-0009's executable residual — it flips only in a reviewed change. (evidence: suite green)
- [ ] **5.4** Create `tests/behaviour/blockers-credential-identifiers.test.ts` (TC-BLK-043, permanent regression): registered secret as/in `--lane` refused with zero bytes and no leak; the `ref` path exercised through a seeded question record on the answer path (the answer-path half evaluates the referenced question's `lane`/`ref` and any identifiers carried into the answer record before appending — GAP-15 reading); legitimate `L2`/`GH-230`/`PDEV-123` accepted verbatim; unregistered token-like identifier accepted (no shape refusal implied); `deps.secrets` swap liveness; guard-narrowing mutation (content-only copy) fails steps by name. (evidence: suite green)
- [ ] **5.5** Create `tests/fixtures/blockers/{policy,identity}/**` and `tests/behaviour/blockers-audience.test.ts` (TC-BLK-021 explicit/default/invalid audiences with zero-byte refusals and every render carrying an audience; TC-BLK-022 — `SC-M1-24` pinned exactly: exit 1, `blockers.audience-mismatch`, `user`/`not_landed`/`user-validation`, hint containing the audience and the exact token `delegation policy: none`, zero answer records, ledger unchanged, question still open at its rank, zero session-spy calls, owner-identity control succeeds); `tests/behaviour/blockers-identity.test.ts` (TC-BLK-024: variable derived from `brand.environmentPrefix` + suffix, changes with the brand; exact `owner`/`coordinator` honoured; absent/empty/case-variant/unrecognized -> `owner`, deterministic, never elevated; no audit record, no raw variable persisted; claimed-not-proven — no verification call; plus the TC-BLK-008 behaviour half: two synthetic brands, output prefix follows the brand, no residual literal, `bun run scripts/checks/forbidden-literals.ts` clean over the new files); `tests/behaviour/blockers-delegation.test.ts` (TC-BLK-023: shipped owner->coordinator exception records `answeringAudience: "owner"`; coordinator->owner refused on the shipped map; flipped deep copy accepts coordinator->owner; same-audience allowed under both maps; no runtime invention — missing row is a declared refusal; the production map is never mutated). (evidence: the three suites green)
- [ ] **5.6** Fix any guard/routing defects the pinning suites surface (guard order, hint text, identity resolution) inside `packages/core/src/domain/blockers.ts` / `packages/cli/src/commands/blockers.ts` / `packages/cli/src/edge.ts` — no assertion weakening; any pinned-reading change reopens the test plan (A-T2). (evidence: all Phase 5 suites green)

**Acceptance Criteria**:

- Must: AC-F3-1..AC-F3-4 green — layer 1 refuses registered values on question text, option values, answer text, and the `lane`/`ref` identifier fields with zero persisted bytes and no leak; layer 2 makes `credential-missing` questions structurally value-free; legitimate identifiers are accepted; the TDR-0009 residual is executable and green (NFR-6).
- Must: AC-F4-1..AC-F4-3 green — the confused-deputy refusal is pinned exactly (SC-M1-24), the policy-as-data exception is mutation-live, identity resolution follows DEC-4/GAP-10, and every rendered question carries its audience.
- Must: `bun run scripts/checks/forbidden-literals.ts` and the branding suites are green (TC-BLK-008 completes).

**Files and modules**:

- Code areas: `tests/behaviour/blockers-credential.test.ts`, `tests/behaviour/blockers-credential-shape.test.ts`, `tests/behaviour/blockers-credential-negative-controls.test.ts`, `tests/behaviour/blockers-credential-identifiers.test.ts`, `tests/behaviour/blockers-audience.test.ts`, `tests/behaviour/blockers-identity.test.ts`, `tests/behaviour/blockers-delegation.test.ts` (new), `tests/fixtures/blockers/{credentials,policy,identity}/**` (new), plus targeted fixes in `packages/core/src/domain/blockers.ts`, `packages/cli/src/commands/blockers.ts`, `packages/cli/src/edge.ts` where a pinned assertion fails.
- System docs: none in-change.

**Tests**: TC-BLK-008 (completes), TC-BLK-017, TC-BLK-018, TC-BLK-019, TC-BLK-020, TC-BLK-021, TC-BLK-022, TC-BLK-023, TC-BLK-024 (completes), TC-BLK-043. Iteration gates: `pnpm typecheck`, the seven new suites, `bun run scripts/checks/forbidden-literals.ts`.

**Completion signal**: `test(GH-230): pin credential guard layers and audience routing`

---

### Phase 6: Answer-as-data and the `laneResume` projection — list and error surfaces

**Goal**: Pin F-5 end-to-end (AC-F5-1..AC-F5-3, SC-M1-13, DEC-5, RSK-6) — answer as data with the recorded projection, zero session touch, the v0 `applied: false` posture — plus the F-7 list surface and the full exit-projection matrix.

**Tasks**:

- [ ] **6.1** Create `tests/fixtures/blockers/capabilities/**` (`resumeInjection: true` + mode `boundary-note`; + `attach-continue`; declared-but-no-mode; `resumeInjection: false`; absent) and `tests/behaviour/blockers-lane-resume.test.ts` (TC-BLK-025 — `SC-M1-13` pinned exactly: exit 0, one `DM-2` record keyed by question id, substance = the option value, question bytes unchanged, `applied: false`, mode/sessionReentry/capabilitySource per fact, embedded projection with no orphan, zero `spawn`/`attach`/`resume`/`steer`, session id unchanged; TC-BLK-026 — both declared modes, no-mode determinism + mode-naming liveness (GAP-8), projection independent of question type; TC-BLK-027 — fallback with `sessionReentry: true`, source `capability-absent`, prefill marker present on machine `data.laneResume` and visible on the human line, absent on declared modes, still zero session touch; TC-BLK-028 — `applied: false` on envelope, record, and human line; `applied: true` mutation control fails by name; the pack's example is not asserted). (evidence: suite green)
- [ ] **6.2** Create `tests/behaviour/blockers-list.test.ts` (TC-BLK-034): default vs `--open`; `questions[]` with every declared field (always-array `options`, null `ref`, integer `age`, integer `rank`, status discriminator); open ranked first, answered in the resolved group after, never interleaved; text-mode parity (one ranked line per question, visibly separate answered group, no ANSI, TTY-independent); verified-empty store exits 0 with `questions: []` and an explicit empty line; malformed invocations `fallback.invocation` before any read. (evidence: suite green)
- [ ] **6.3** Create `tests/behaviour/blockers-errors.test.ts` (TC-BLK-040): `blockers.unknown-id` exit 1 `not_landed` with the set unchanged; all four `blockers.*` rows user-validation exit 1; already-answered -> `input.value.rejected` with no new record; torn -> exit 2 `state.store.torn`; fence-busy -> exit 2 `state.lock.busy`; permission-denied -> the delivered exit-1 row (GAP-16); valid list/answer exit 0; malformed invocations `fallback.invocation`; no `blockers.*` code outside the four; envelope is exactly one document with `runId`/`timing` (`assertEnvelopeContract`). (evidence: suite green)
- [ ] **6.4** Fix any projection/renderer defects the suites surface — no assertion weakening. (evidence: Phase 6 suites green)

**Acceptance Criteria**:

- Must: AC-F5-1/AC-F5-2/AC-F5-3 green — capability-declared answers record `boundary-note`/`attach-continue` with `sessionReentry: false` and source `adapter-declared`; the absent-capability fallback records `resume-prompt-reentry` with `sessionReentry: true` and a visible prefill cost; every answer declares `applied: false`; no session is spawned, attached, resumed, or steered (NFR-7 shape, RSK-6).
- Must: AC-F7-1/AC-F7-2 green — the list payload contract and the full exit projection hold through `runCli`.
- Should: the answer human line states the recorded mode only — never a claim that the lane resumed.

**Files and modules**:

- Code areas: `tests/behaviour/blockers-lane-resume.test.ts`, `tests/behaviour/blockers-list.test.ts`, `tests/behaviour/blockers-errors.test.ts` (new), `tests/fixtures/blockers/capabilities/**` (new), plus targeted fixes in `packages/core/src/domain/blockers.ts`, `packages/core/src/state/blockers.ts`, `packages/cli/src/commands/blockers.ts` where a pinned assertion fails.
- System docs: none in-change.

**Tests**: TC-BLK-025, TC-BLK-026, TC-BLK-027, TC-BLK-028 (behaviour halves; golden halves in Phase 8), TC-BLK-034, TC-BLK-040. Iteration gates: `pnpm typecheck`, the three new suites.

**Completion signal**: `test(GH-230): pin answer-as-data laneResume and list/error surfaces`

---

### Phase 7: Digest and brief integration — the atomic contract edit

**Goal**: Execute the DM-6 closed-set evolution as one atomic edit (DEC-6, RSK-5): the seventh digest section over the shared ranking, the brief mirror with the stable id, placeholder retirement (3 -> 2), the real `blocker-questions` anchor (2 -> 3, decision-first), surfaces staying 9 — section order, surface set, catalog, anchors, bounds, structure suites, and goldens move together, and every other section/surface/anchor stays byte-stable.

**Tasks**:

- [ ] **7.1** Update `packages/core/src/contracts/status.ts`: `STATUS_SECTION_ORDER` gains `"typed-questions"` as the seventh id (chosen index after `parked-work` — GAP-4; the six existing ids keep their relative order); the `typed-questions` section item and counts types (per-item `id`, `type`, `audience`, `lane`, `ref`, `question`, `options`, `askedAt`, `age`, `rank` — audience + rank make the DEC-8 pickup predicate machine-determinable; counts per GAP-13; state vocabulary and the closed reason set reused, `state-unreadable` for failed/torn reads; open questions only). (evidence: `bun test tests/structure/status-contract.test.ts`)
- [ ] **7.2** Update `packages/core/src/contracts/brief.ts`: `typed-questions` retires from `BRIEF_PLACEHOLDER_CATALOG` and `BRIEF_PLACEHOLDER_SURFACE_IDS` (3 -> 2: `gate-sla-states`, `lane-queue-engine` remain); `BRIEF_SURFACE_ORDER` stays nine automatically (seven section mirrors + two placeholders — it derives from `STATUS_SECTION_ORDER`); `BRIEF_ANCHOR_GROUPS` becomes `["ready-to-merge","blocker-questions","owner-gate-ages"]` (decision-first); placeholder titles adjusted so the `typed-questions` title serves the mirror/anchor. (evidence: `bun test tests/structure/brief-contract.test.ts`)
- [ ] **7.3** Update `packages/core/src/domain/status.ts`: derive the `typed-questions` section from one blockers state read as part of the status collection — the SHARED Phase-2 ranking (no second comparator); five-value section state; `observed` with open-only counts on a verified read (verified-empty -> explicit empty reason); `unknown` + `state-unreadable` on a failed/torn read (section failures are payload data — never an exit-2 command failure, never a fabricated question); the 8-item cap with exact `omitted`/`truncated`. (evidence: `bun test tests/behaviour/blockers-digest.test.ts`)
- [ ] **7.4** Update `packages/core/src/domain/brief.ts`: the `typed-questions` surface mirrors the digest section's state/counts/truncated/reason by id (derive the mirror, never hard-code it — RSK-T5); the `blocker-questions` anchored group consumes the section items (identity, state, evidence, audience, rank per item); an empty open set renders an explicit empty group, never a placeholder line. (evidence: `bun test tests/behaviour/blockers-brief.test.ts`)
- [ ] **7.5** Wire the CLI compositions (`packages/cli/src/commands/status.ts`, `packages/cli/src/commands/brief.ts`, `packages/cli/src/edge.ts`): the status composition gains exactly one blockers state read; the brief reuses the status collection facts and adds no second blockers read (NFR-2, TC-BLK-037 step 2). No other command's composition changes. (evidence: `bun test tests/behaviour/blockers-read-cost.test.ts` in Phase 8; interim `pnpm typecheck`)
- [ ] **7.6** Create `tests/behaviour/blockers-shared-ranking.test.ts` (TC-BLK-030, permanent regression): one store, a mixed open/answered population (>=8 open, ties, all four types) — `blockers list --json`, `status --json`, `brief --json` produce identical id order and identical ranks 1..N; audience + rank rendered on all three; answered absent from digest/brief and resolved-only on the list; truncation parity (same first 8, same omitted count); structure scan — the list, digest section, and brief anchor consume the same domain ranking and no second sort/priority table exists; forked-comparator mutation fails by name; reversed ledger order changes nothing. Extend `tests/behaviour/blockers-ranking.test.ts` with the surface-integration half (TC-BLK-029 completes). (evidence: both suites green)
- [ ] **7.7** Create `tests/behaviour/blockers-digest.test.ts` (TC-BLK-031: first-subsequent-invocation surfacing, fields/age/rank, seven-section order with the six existing ids relative-stable, pickup predicate pure over the payload — coordinator at rank 1 true / owner at rank 1 false / coordinator at rank 2 false, no wake/timer/socket/process; TC-BLK-033: torn/wrong-kind/malformed -> section `unknown` + `state-unreadable` at exit 0 with zero fabricated questions and the other sections unaffected; verified-empty -> `observed` with an explicit empty reason; `blockers list` on the same store exits 2) and `tests/behaviour/blockers-brief.test.ts` (TC-BLK-032: nine surfaces, exactly one `typed-questions` surface mirroring the digest values, placeholders exactly the two ids, three anchors in decision-first order, the real ranked group with audience/rank per item and items equal to the shared ranking, the human brief renders real blocker-questions lines and no placeholder line, the other eight surfaces and the two existing anchors unchanged, `gate-sla-states` still renders immediately after the owner-gate age anchor). Update the existing `tests/structure/status-contract.test.ts` / `brief-contract.test.ts` / `brief-imports.test.ts` assertions for the declared closed-set evolution (seven sections, two placeholders, three anchors — updated deliberately, reviewed as a diff). (evidence: suites green)
- [ ] **7.8** Regenerate the status and brief goldens deliberately for the declared edits only (`tests/golden/status-digest.test.ts`, `tests/golden/brief.test.ts` fixtures, via their explicit regeneration path); review the diff field-by-field (six existing sections byte-stable; only the seventh section, the mirror, the catalog, and the anchor differ). Board/queue/verify goldens untouched. (evidence: golden suites green; diff reviewed in the phase commit)

**Acceptance Criteria**:

- Must: AC-F6-1..AC-F6-4 green — a published blocker surfaces on the next `status` invocation with type/audience/lane/age/rank; the brief mirrors with the stable id, two placeholders, three decision-first anchors, nine surfaces; one shared ranking orders all three surfaces identically with answered never interleaved; the pickup predicate is determinable from the digest payload alone.
- Must: AC-F1-2 surface postures green — torn reads degrade the digest/brief section to `unknown`/`state-unreadable` at exit 0 while `blockers` commands classify `state.*` and exit 2; verified-empty is explicit.
- Must: the digest/brief structure suites and goldens reflect exactly the declared evolution; `board` output is untouched.
- Must: NFR-2 shape — one blockers read per status invocation; the brief adds none.

**Files and modules**:

- Code areas: `packages/core/src/contracts/status.ts` (updated), `packages/core/src/contracts/brief.ts` (updated), `packages/core/src/domain/status.ts` (updated), `packages/core/src/domain/brief.ts` (updated), `packages/cli/src/commands/status.ts` (updated), `packages/cli/src/commands/brief.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/behaviour/blockers-{shared-ranking,digest,brief,ranking}.test.ts` (new/updated), `tests/structure/{status-contract,brief-contract,brief-imports}.test.ts` (updated), `tests/golden/{status-digest,brief}.test.ts` + their fixture files (deliberately regenerated).
- System docs: none authored in-change (digest/brief/state/result feature docs are lifecycle phase 7 via `@doc-syncer`).

**Tests**: TC-BLK-029 (completes), TC-BLK-030, TC-BLK-031, TC-BLK-032, TC-BLK-033. Iteration gates: `pnpm typecheck`, `bun test tests/behaviour/blockers-{shared-ranking,digest,brief,ranking}.test.ts tests/structure/{status-contract,brief-contract}.test.ts tests/golden/{status-digest,brief}.test.ts`.

**Completion signal**: `feat(GH-230): integrate typed questions into the digest section and brief surfaces`

---

### Phase 8: Bounds, determinism, read cost, performance, privacy, non-regression, corpus, goldens

**Goal**: Pin NFR-1..NFR-7 and the §8.5 non-regression with the committed corpus, the byte-exact goldens with mutation controls, and the measured 50 ms bound — the full output contract of the change.

**Tasks**:

- [ ] **8.1** Create `tests/fixtures/blockers/bounds/{under-cap,at-cap,over-cap,cap-sized,hostile-length,multibyte}/**` and `tests/behaviour/blockers-bounds.test.ts` (TC-BLK-035): 8 render fully unmarked, 9+ render exactly 8 with exact `omitted`/`truncated` and rank 1..8 retained on all three surfaces (the over-cap fixture puts the coordinator question last in ledger order — RSK-T7); human 24-line/4 096-byte caps with the declared omission marker as the final line; machine `data` <= 65 536 bytes for every fixture incl. hostile-length lane/ref clamped with an explicit marker (GAP-12); content caps at the boundary (120/4x60/160 accepted; 121/61/161 refused per TC-BLK-016); multibyte counts as characters for content, bytes for machine. (evidence: suite green)
- [ ] **8.2** Create `tests/behaviour/blockers-determinism.test.ts` (TC-BLK-036): 20 identical runs byte-identical in both modes on all three surfaces; injected `runId`/`timing`/`generatedAt`; reversed-append-order stores produce identical renders; no ANSI, TTY-independent; changed-fact controls (type/askedAt/id, caller audience, capability, brand) change the bytes. (evidence: suite green)
- [ ] **8.3** Create `tests/behaviour/blockers-read-cost.test.ts` (TC-BLK-037): one verified blockers read per `list`/`status`/`brief` invocation (the brief adds no second read); one read + one fence + one append + one coverage per publish/answer; refusals append nothing and stay within one read; zero `fetch`/network/retry/pagination (throwing guard + no retry-loop source scan); a deliberate-second-read control fails the count. (evidence: suite green)
- [ ] **8.4** Create `tests/behaviour/blockers-performance.test.ts` (TC-BLK-038): pure path only (validation + guard + ranking + rendering) over the cap-sized and over-cap fixtures; warm-up, median of the declared iterations <= 50 ms; guard and ranking measured separately; environment recorded; expensive-comparator control proves liveness; the bound is not silently relaxed (OQ-T10 — record the median in the execution log). (evidence: suite green; median recorded)
- [ ] **8.5** Create `tests/fixtures/blockers/privacy/**` and `tests/behaviour/blockers-privacy.test.ts` (TC-BLK-039): registered secret + unrelated synthetic ambient value + content canary; success control renders legitimate content; refusal cases leave the secret absent from ledger/stdout/stderr/envelope/human line/hints; no environment dump, no raw provider payload, no tracker title/body/comment, no authentication evidence in the ledger; the caller-audience variable name/value never persisted (only the resolved audience); privacy scanner control fails by name. (evidence: suite green)
- [ ] **8.6** Create `tests/behaviour/blockers-nonregression.test.ts` (TC-BLK-041): board suites/golden byte-identical with no blocker record created by the board and no owner-gate->question conversion (DEC-10); the six existing digest sections keep relative order/state/counts/evidence/behaviour and the status golden differs only by the declared section (field-by-field); the brief's other eight surfaces and the two existing anchors unchanged; `queue ready`, `verify gates`, `closeout`, `plan`, `config`, and the envelope/state contract suites unchanged; no new config key, no envelope schema change, no new package/subpath, `STATE_SCHEMA_VERSION` unchanged; no `blockers.*` code in board output; the TDR-0009 accepted-residual doc assertion per the chosen reading — assert `doc/decisions/TDR-0009-blockers-credential-guard-pattern-deferral.md` exists and names the residual (the feature-spec residual prose rides the phase-7 doc-sync handoff; if delivery prefers asserting the feature spec, that assertion lands with doc-sync, never before). (evidence: suite green + the existing suites green in the aggregate)
- [ ] **8.7** Create `tests/fixtures/blockers/corpus/cases.ts` (facts + expected output + expected records covering every declared behaviour and edge — all four types, both audiences, three priority classes, both channels, both guard layers + non-refusal, mismatch + delegation, both capability sources + all three modes, open/answered, empty/1/8/9+, torn/wrong-kind/malformed/verified-empty, under/at/over bounds, `applied: false`) and `tests/behaviour/blockers-corpus.test.ts` (TC-BLK-042: per-case exact expectations, completeness meta-check naming a removed category, corruption fails by name, zero live calls across the corpus). (evidence: suite green)
- [ ] **8.8** Create `tests/fixtures/blockers/golden/{envelope.json,human.txt}` at the fixed run id/clock/brand plus `tests/fixtures/blockers/golden/regenerate.ts` (the only regeneration path; suites assert `mtimeMs` unchanged) and `tests/golden/blockers.test.ts` (list + answer goldens byte-identical, read-only, one-byte mutation fails by name, changed clock/run-id fails, TC-BLK-028/036/042 golden halves). (evidence: suite green)
- [ ] **8.9** Fix any defects the pinning suites surface (rank instability, bound misses, marker leaks) — no assertion weakening. (evidence: all Phase 8 suites green)

**Acceptance Criteria**:

- Must: NFR-1..NFR-7 all measured and green: determinism (TC-BLK-036), bounds with marks (TC-BLK-035), read cost (TC-BLK-037), 50 ms median (TC-BLK-038), privacy (TC-BLK-039), corpus completeness (TC-BLK-042), non-regression (TC-BLK-041).
- Must: goldens are committed, read-only at test time, regenerated only by the explicit script, and mutation-controlled.
- Should: measured medians recorded in the execution log for the PR.

**Files and modules**:

- Code areas: `tests/behaviour/blockers-{bounds,determinism,read-cost,performance,privacy,nonregression,corpus}.test.ts`, `tests/golden/blockers.test.ts` (new), `tests/fixtures/blockers/{bounds,privacy,corpus,golden}/**` (new), plus targeted fixes in `packages/core/src/domain/blockers.ts`, `packages/core/src/domain/{status,brief}.ts`, `packages/core/src/state/blockers.ts`, `packages/cli/src/commands/blockers.ts` where a pinned assertion fails.
- System docs: none in-change.

**Tests**: TC-BLK-028 (completes), TC-BLK-035, TC-BLK-036, TC-BLK-037, TC-BLK-038, TC-BLK-039, TC-BLK-041, TC-BLK-042 (completes). Iteration gates: `pnpm typecheck`, the seven new suites + `tests/golden/blockers.test.ts`.

**Completion signal**: `test(GH-230): pin bounds, determinism, cost, privacy, corpus, goldens, non-regression`

---

### Phase 9: Finalize — changeset, docs-adjacent repo invariants, spec handoff, aggregate gates

**Goal**: Close the change: the minor changeset, the docs-adjacent repo invariants this change owns (command-registry row, man-page anchor consistency), the spec-reconciliation handoff (recorded, not authored — feature-spec authoring is the doc-syncer phase's), the aggregate gate battery, and PR readiness (TDR-0009 + GAP-15 owner-review flags).

**Tasks**:

- [ ] **9.1** Version bump: add one minor changeset at `.changeset/gh-230-typed-blockers-minor.md` (naming per the `gh-229-owner-gate-sla-minor.md` precedent) covering the lockstep `fixed` group bump triggered by the `@delivery-os/core` + `@delivery-os/cli` changes; no dependency additions, so no license-registry verdict. (evidence: changeset file in tree; changesets-group check green)
- [ ] **9.2** Docs-adjacent repo invariants (tree assertions, no planning-truth authoring): extend `tests/behaviour/blockers-nonregression.test.ts` with (a) the command-registry cross-reference — `doc/planning/oss-tooling/cli-command-registry.md` declares the `blockers` row exactly once (the GH-229 `board`-row precedent), and (b) man-page anchor consistency with the delivered table — every `blockers.*` code named in `doc/planning/oss-tooling/milestones/m1/commands/blockers.md` (the three ERRORS entries and the `blockers.audience-mismatch` worked example) resolves through the delivered machine `ERROR_TABLE` (subset direction; the pack's list is non-exhaustive by design — DEC-9). A removed registry row or an unresolved pack code fails by name. (evidence: suite green)
- [ ] **9.3** Spec-reconciliation handoff (lifecycle phase 7 input, `@doc-syncer`; this plan authors none of it): new current-truth feature spec `doc/spec/features/feature-blockers.md` (first-spec-only always-resolve) recording the channel, the TDR-0009 accepted residual with its revisit triggers, and the pickup-contract declaration; `doc/spec/features/feature-result-contract.md` gains the `blockers` family prose beyond the Phase-1 rows; `doc/spec/features/feature-status-digest.md` gains the seventh section; `doc/spec/features/feature-brief.md` gains the catalog/surface/anchor evolution; `doc/spec/features/feature-state-layer.md` gains the two additive record kinds. The command-registry row and the man page are planning truth (asserted in 9.2, not edited). (evidence: handoff note below and in the PR)
- [ ] **9.4** Aggregate gates: run and record `pnpm check` (lint, format:check, typecheck, the full test battery, boundaries, exports parity), `bun run scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`, `bun test tests/boundaries`, `git diff --check`, `git status --porcelain`; run `bash scripts/.tests/test-doc-distribution.sh` only if a redistributable doc changed (none is planned). Record the Open-PR DoD evidence checklist from test plan §7 (all 21 ACs traceable and passing, all 7 NFRs measured, `SC-M1-13`/`SC-M1-24` green with exact expectations, the four-row family + exact allowlist synced, byte-stability outside the two declared exceptions, changeset recorded, PR targets `main-tools`). Surface the TDR-0009 ratification note and the GAP-15 identifier-extension flag in the PR description for owner review. PR creation is the orchestrator's step. (evidence: gate commands + results in the execution log)

**Acceptance Criteria**:

- Must: `pnpm check` green in a clean checkout (pre-existing stale-base failures, if any, are identified and attributed, never silenced); no undocumented error identity; exactly one changeset added.
- Must: the registry-row and man-page-anchor invariants are permanent tree assertions and green.
- Must: every AC and every TC in §Test Scenarios maps to at least one completed phase task with recorded evidence (unrun evidence is never recorded as passing); the phase-7 doc-sync handoff list and the two owner-review flags are recorded for the PR.
- Should: measured 50 ms median recorded in the PR alongside the environment.

**Files and modules**:

- Code areas: `.changeset/gh-230-typed-blockers-minor.md` (new), `tests/behaviour/blockers-nonregression.test.ts` (updated — the two invariants), `doc/changes/2026-11/2026-11-06--GH-230--typed-blockers/**` (plan execution log / pm-notes bookkeeping).
- System docs: none authored in-change; the handoff list is recorded in the PR/change notes.

**Tests**: TC-BLK-041 (invariant extension); the full battery per test plan §7 evidence commands. Completion gate: `pnpm check` + `git diff --check` + `git status --porcelain`.

**Completion signal**: `chore(GH-230): finalize typed blocker delivery with changeset and invariants`

---

## Test Scenarios

All 43 TCs from `chg-GH-230-test-plan.md` mapped onto phases (GAP-1/A-T2: no TC reshaped; TC-BLK-006 supplied with Phase 4 by this plan because the seam under test exists only once the command lands — behaviour unchanged).

| TC ID | Scenario (abbreviated) | Phase(s) | AC / NFR |
|-------|------------------------|----------|----------|
| TC-BLK-001 | Contract vocabulary pinned: types, channels, audiences, priorities, modes, sources, name shape, bounds, schemas | 1 | DM-1..DM-6, DEC-1/2/3/7, NFR-4/5 |
| TC-BLK-002 | Delegation policy-as-data closed, total, mutation-live | 1 (data) + 2 (resolver) | DM-4, AC-F4-2, DEC-3 |
| TC-BLK-003 | Contracts declaration-only, subpath-exported, inventory-registered | 1 (contracts) -> completes 4 (CLI module) | DM-1..DM-6, ADR-0003 |
| TC-BLK-004 | Pure domain confinement: no I/O/clock/randomness/env | 2 (+ state half 3) | NFR-1, §16, ADR-0007 |
| TC-BLK-005 | State consumer behind the injected port: fence, coverage, no runtime API | 3 | F-1, EVT-1/2, DEC-11, NFR-2/7 |
| TC-BLK-006 | CLI handler purity and grammar (supplied Phase 4 by this plan) | 4 | F-7, AC-F7-1 |
| TC-BLK-007 | Error family: four rows, one kind, sync both directions, exact allowlist | 1 | NFR-5, DEC-9, GAP-17 |
| TC-BLK-008 | Brand neutrality + caller-audience env-fact naming | 1 (checks) + 5 (behaviour) | AC-F7-3, DEC-4, RSK-7 |
| TC-BLK-009 | Publish happy path: one DM-1 record, verified read, all fields, exit 0 | 4 | AC-F1-1, EVT-1, DM-1 |
| TC-BLK-010 | Unique `q-` ids, no stored status, derived closure | 3 (port) + 4 (runCli) | F-1, DM-1, NFR-7 |
| TC-BLK-011 | Torn/wrong-kind/malformed/verified-empty classified across surfaces | 4 (command) + 7 (digest/brief) | AC-F1-2, NFR-7 |
| TC-BLK-012 | One authoritative answer; duplicate history fails closed; coverage +1 | 3 (port) + 4 (runCli) | AC-F2-2, NFR-7, DEC-11 |
| TC-BLK-013 | Answer intent record content, durability, append-only history | 3 (port) + 4 (runCli) | AC-F5-3, EVT-2, DM-2 |
| TC-BLK-014 | Closed four-type set: valid accepted, unknown/case variants refused | 4 | AC-F2-1, DEC-1 |
| TC-BLK-015 | Per-type answer channels and channel violations | 4 | AC-F2-2, DEC-1 |
| TC-BLK-016 | `decision-needed` option contract and input content bounds | 4 | AC-F2-2, NFR-4, GAP-5 |
| TC-BLK-017 | Layer 1 registered-secret refusal on every content path, zero bytes | 5 | AC-F3-1, NFR-6 |
| TC-BLK-018 | Layer 1 shares the redaction secrets record; no secret in any output | 5 | AC-F3-1, NFR-6, RSK-2 |
| TC-BLK-019 | Layer 2 variable-name shape on `credential-missing` text | 5 | AC-F3-2, DEC-2 |
| TC-BLK-020 | TDR-0009 negative controls: no shape refusal beyond the name-shape path | 5 (permanent) | AC-F3-3, TDR-0009 |
| TC-BLK-021 | Audience closed set, default `coordinator`, invalid refused | 5 | AC-F4-3, DEC-3 |
| TC-BLK-022 | `SC-M1-24` cross-audience refusal pinned exactly | 5 (permanent) | AC-F4-1, DM-4 |
| TC-BLK-023 | Policy-as-data delegation exception, mutation-live | 5 | AC-F4-2, DM-4 |
| TC-BLK-024 | Identity resolution: exact/absent/unrecognized -> owner, claimed-not-proven | 2 (resolver) + 5 (behaviour) | DEC-4, RSK-3 |
| TC-BLK-025 | `SC-M1-13` round-trip without session re-entry | 6 (permanent) | AC-F5-1, AC-F5-3, DM-2/3 |
| TC-BLK-026 | Capability-declared modes, `sessionReentry: false`, source declared | 6 | AC-F5-1, DM-3, GAP-8 |
| TC-BLK-027 | Capability absent: fallback with visible prefill cost | 6 | AC-F5-2, DM-3, GAP-9 |
| TC-BLK-028 | v0 `applied: false` everywhere; pack example not asserted | 6 (behaviour) + 8 (golden) | AC-F5-3, DEC-5, RSK-6 |
| TC-BLK-029 | Ranking key and resolved group | 2 (unit) + 7 (completes) | AC-F6-3, DEC-7, NFR-1 |
| TC-BLK-030 | One shared ranking across list/digest/brief | 7 (permanent) | AC-F6-3, DEC-6/7, RSK-1 |
| TC-BLK-031 | Digest `typed-questions` section and pickup predicate | 7 | AC-F6-1, AC-F6-4, DEC-6/8 |
| TC-BLK-032 | Brief mirror, placeholder retirement, anchors 2->3, nine surfaces | 7 | AC-F6-2, DM-6 |
| TC-BLK-033 | Digest/brief degradation: `state-unreadable`, exit 0, no fabrication | 7 | AC-F1-2, F-6, §12 |
| TC-BLK-034 | `blockers list` surface: default vs `--open`, fields, text parity | 6 | AC-F7-1, NFR-1/4 |
| TC-BLK-035 | Bounds and declared truncation on every surface | 8 | NFR-4, GAP-12 |
| TC-BLK-036 | Determinism: byte-identical, permutation invariance, TTY independence | 8 | NFR-1 |
| TC-BLK-037 | Read cost: one read, one fenced append + coverage, zero network | 8 | NFR-2 |
| TC-BLK-038 | Performance: <= 50 ms pure path, median, environment recorded | 8 | NFR-3, OQ-T10 |
| TC-BLK-039 | Privacy: no credential values/payloads/titles/bodies anywhere | 8 | NFR-6, §20/§21 |
| TC-BLK-040 | Error surface and exit projection incl. delivered `state.*` rows | 6 | AC-F7-2, NFR-5, GAP-16 |
| TC-BLK-041 | Non-regression and declared evolution; board byte-stable | 8 (+ invariant extension 9) | §8.5, RSK-5, DEC-10 |
| TC-BLK-042 | Committed corpus and byte-exact goldens with mutation controls | 8 | all ACs, NFR-1/4/7 |
| TC-BLK-043 | Identifier-field guard: `lane`/`ref` refused on registered values; legitimate ids accepted | 5 (permanent) | AC-F3-4, DEC-2, NFR-6 |

Coverage cross-check: all 21 ACs (AC-F1-1..AC-F7-3), all 7 NFRs, EVT-1/EVT-2, DM-1..DM-6, and all 8 spec risks (RSK-1..RSK-8 per test plan §8.1) map to at least one task above; the aggregate gate (`pnpm check` + the §7 evidence commands) covers all TCs.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-230-spec.md` | Spec (source of truth, v1.2) |
| Change test plan | `./chg-GH-230-test-plan.md` | Test plan (43 TCs, GAP-1..17, OQ-T1..T14) |
| Machine-readable plan | `./chg-GH-230-plan.yaml` | `delivery.plan.v1` projection of these phases (authoritative for `plan validate`) |
| Credential-guard deferral | `doc/decisions/TDR-0009-blockers-credential-guard-pattern-deferral.md` | Decision record (Proposed; owner acceptance at GH-230 PR review) |
| Placement decision | `doc/decisions/ADR-0003-oss-monorepo-structure.md` | ADR (tiers, runtime-API locations) |
| Pure-core-over-injected-facts | `doc/decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md` | ADR |
| Harness-adapter capability | `doc/decisions/ADR-0008-harness-adapter-contract.md` | ADR (the resume-injection fact consumed here) |
| Policy-as-data precedent | `doc/decisions/PDR-0003-owner-gate-sla-default-map.md` | PDR (delegation-map pattern) |
| TypeScript rules | `.ai/rules/typescript.md` | Binding rules |
| Testing strategy | `.ai/rules/testing-strategy.md` | Binding rules |
| Planning-pack blockers page | `doc/planning/oss-tooling/milestones/m1/commands/blockers.md` | Planning truth (proposed contract; asserted, not edited) |
| Command registry | `doc/planning/oss-tooling/cli-command-registry.md` | Planning truth (`blockers` row exists at line 173; asserted, not edited) |
| Documented error table (sync surface) | `doc/spec/features/feature-result-contract.md` | doc/spec — the four binding sync rows in-change (Phase 1); the rest at lifecycle phase 7 |
| Sibling v0-posture precedent | `../2026-11-06--GH-229--owner-gate-sla/chg-GH-229-plan.md` | Plan convention reference |
| Changeset | `.changeset/gh-230-typed-blockers-minor.md` | Release (Phase 9) |

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------------|--------|---------|
| 1.0 | 2026-11-06T16:00:00Z | plan-writer | Initial plan. Nine phases per spec §18 order: (1) contract vocabulary + four-row error family with the exact two-segment allowlist in both `RESERVED_TWO_SEGMENT_CODES` owners; (2) pure domain (validation, layered guard, routing, shared ranking, resume projection, renderers); (3) the two additive state record kinds; (4) the `blockers` command surface + publish/records/types integration; (5) credential-guard + audience/identity/delegation pinning incl. TDR-0009 controls and identifier-field guard; (6) answer-as-data/`laneResume` + list/errors; (7) the atomic digest/brief contract edit with the shared-ranking proof; (8) bounds/determinism/cost/performance/privacy/non-regression/corpus/goldens; (9) changeset, docs-adjacent invariants (registry row, man-page anchor consistency), spec handoff, aggregate gates. All 43 TCs mapped without reshaping (TC-BLK-006 supplied with Phase 4); GAP-1..17 readings confirmed with delivery-bound spellings pinned (age ms, `boundary-note` default, `CALLER_AUDIENCE` suffix, section index after `parked-work`); authored alongside the schema-valid `chg-GH-230-plan.yaml` machine projection (GH-226 format flip). Verified: command registry + man page are planning truth; documented error table is the binding S2 surface; `BRIEF_SURFACE_ORDER` derives from `STATUS_SECTION_ORDER` (surfaces stay 9 mechanically). |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 — contracts + error family | Completed | 2026-11-06 | 2026-11-06 | (phase commit) | Contract vocabulary pinned as data; four-row `blockers` family + one new domain kind; exact four-code `RESERVED_TWO_SEGMENT_CODES` in both owners (no wildcard); documented S2 rows; corpora + near-miss controls. Green: `bun run scripts/checks/error-table-sync.ts`, `bun test tests/structure/blockers-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts`, `pnpm typecheck`. |
| 2 — pure domain | Not started | — | — | — | |
| 3 — state record kinds | Not started | — | — | — | |
| 4 — command surface | Not started | — | — | — | |
| 5 — guard + routing pinning | Not started | — | — | — | |
| 6 — answer-as-data + list/errors | Not started | — | — | — | |
| 7 — digest/brief integration | Not started | — | — | — | |
| 8 — pinning + corpus + goldens | Not started | — | — | — | |
| 9 — finalize + invariants | Not started | — | — | — | |

The executor records per-phase evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing.
