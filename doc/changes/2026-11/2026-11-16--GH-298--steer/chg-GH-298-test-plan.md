---
id: chg-GH-298-test-plan
status: Proposed
version: 1.0
created: 2026-11-16
last_updated: 2026-11-16T14:45:00Z
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, cli, steering, typed-message-contract]
version_impact: minor
summary: "Pin steer as comparisons a suite runs: four subcommands (send, list, read, complete) over one shared typed message record declared once as contract data, with drawn filing defaults (kind request, priority normal, ttl 24 h, ref null) and a derived origin block (bound ref, repository key, owner; bare null when unbound); value and grammar refusals before any state read or write; the boundary read derived from the delivered phase-state records (open with no record or with every entry completed, closed with an entry in progress) landing due notes in one batch in the shared rank order with a non-null receipt each (SC-M2-S5-01), recording ttl-elapsed as a classified non-applied outcome (SC-M2-S5-02), declining without a write at a closed boundary, and landing nothing on a repeat read; the asks batch composing the delivered open-question view and PDR-0003 drawn-default join read-only with measured age, coordinator questions excluded; artifact-ref completion where the first completion is authoritative and artifact-less completion is never recorded; a registered-secret-value guard on every content and identifier path with no pattern layer; mounting as the next prompt-required family with root and family help, reference page, coverage-inventory row and moved family-count assertions; the three steer identities registered by exact two-segment declaration (allowlist 56 → 59) with every Appendix D count pin moved in the same commit and four-way agreement; purity with no session operation, determinism with injected-clock aging, and bounds with every drop counted; and the aggregate gate TMPDIR=$PWD/tmp/tmpdir pnpm check."
links:
  change_spec: ./chg-GH-298-spec.md
  implementation_plan: ./chg-GH-298-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S5: Steer (M2)

## 1. Scope and Objectives

Steer is the first consumer of the shared typed message record, and it is the only surface in this milestone that both **writes durable owner intent** and **decides when that intent becomes operative**. The risk this plan is built around is not a missing subcommand — it is a steering channel that *looks* correct while one of its independent truths is false. A note reported `landed` whose outcome record never appended is a receipt for a course change that did not happen, and the worst possible failure on this surface: the delivery believes it was steered. A note that expires silently, or a read that renders an empty queue because the store was unreadable, is a lost correction the owner will never learn about. A note that lands while a phase is in progress is the interruption this change exists to remove, reintroduced as a feature. A receipt whose `origin`, `readReceipt`, or `ttl` is null is not evidence. A completion without a proving artifact turns a lint rule into a fiction. An owner-specific field or vocabulary fork breaks the second consumer (agent-to-agent messaging) before it exists. An error identity added by family matching instead of exact declaration turns the closed allowlist into a convention, and one stale count pin lets an undeclared row in. A command composed but not prompt-required is unreachable — the board's delivered lesson.

Every one of those is therefore asserted as a comparison over payload bytes, appended-record counts, tree snapshots, counters, and exit codes — never as a prose claim. Absence is proven three ways, per house discipline: an armed recording seam, a zero counter, and a byte-or-record-count assertion on the durable tree.

The plan composes delivered seams rather than inventing new ones: the delivered phase-state fold for the boundary condition, the delivered open-question view and PDR-0003 join for `asks[]`, the delivered blockers ranking shape for the shared rank, the delivered credential-guard registered-secrets record, the delivered result envelope and error table, and the delivered mounting unit (prompt set, composition, help inventory, reference page, coverage row). A new in-process steer harness supplies the only new seams: the injected clock, the id factory, the steering state port, and the invoking-checkout origin source.

Two specification defects are recorded here rather than papered over, because each makes one criterion untestable as written: the family-count arithmetic in `AC-F8-1` is stale against the delivery base (§8.3 `OQ-TP-1`), and `AC-F9-1`'s "read targeting an id" branch contradicts the command grammar (§8.3 `OQ-TP-2`). `TC-STEER-060` and `TC-STEER-071` assert the *tree-invariant* form of each so a correct implementation is still gated, and the affected spec sections are named for reopening. Two further ambiguities (the `--ttl` duration grammar, and the >20-due-note batch) are declared in §3.5 as measurement substitutions, not contract questions.

This document is a verification map, not an execution claim. No case has been run against a new implementation at authoring time. Phase ownership belongs to `chg-GH-298-plan.yaml` (phase 4). Every case is authored **failing-first** against the phase that owns it: committed red — missing command, missing `data` key, or a declared count mismatch — before the implementation that makes it green, so no case can be satisfied by an implementation that never existed.

### 1.1 In Scope

- Filing: the drawn-defaults matrix (kind `request`, priority `normal`, ttl 24 h, ref `null`), the derived origin block (`change` bound ref or bare `null`, repository key, `agent: owner`), `created` from the injected clock, `expiresAt` derivation, the queued projection, and `lifecycle: "queued"` at exit `0` (F-1; AC-F1-1; DM-1; DEC-6).
- Value refusals before any state read or write — empty/over-cap text, bad ttl, priority outside the filing set, kind outside the filing subset, over-cap `--ref` — as `input.value.rejected` at exit `1` with `not_landed` and zero persisted bytes (F-1, F-9; AC-F1-2; DM-8; NFR-5).
- Grammar refusals as `fallback.invocation` at exit `1` before any state read (F-9; §8.3 grammar).
- The shared typed message record: one schema, the four closed shared vocabularies, no owner-specific field, and the filing subset declared as a restriction so a non-owner message validates without an owner branch (F-2; AC-F2-1; DM-1; DEC-2).
- Boundary delivery: the three boundary-open routes and the closed decline, batched landing in the shared rank order with one receipt per landed note (non-null `origin`, `readReceipt`, `ttl`), `ttl-elapsed` expiry as a classified non-applied outcome, exactly one outcome per transitioning note, and idempotence in effect (F-3; AC-F3-1..AC-F3-5; DM-2, DM-3; DEC-5, DEC-7; `SC-M2-S5-01`, `SC-M2-S5-02`).
- Measured aging on every surface and the shared derived rank (priority class, oldest `created`, `id` ascending) with contiguous ranks over the fully ranked set before any cap, never stored (F-5; AC-F5-1; DM-5; DEC-11; NFR-2, NFR-3, NFR-7).
- The queue view: `queued[]`, `landed[]`, `expired[]` side by side with receipts, `completedWith`, expiry reasons, ages, and ranks; ≤ 8 rows per group with counted omissions (F-5; AC-F5-2; DM-4; DEC-1).
- The asks batch: the delivered open-question view with the delivered PDR-0003 join (`drawnDefault`, `defaultState`), measured `age`, delivered rank and bounds, coordinator questions excluded, no ledger write, no second ranking (F-4; AC-F4-1; DM-6; NG-8).
- Artifact-ref completion: exactly one completion record, derived `completed`, the list row under landed with `completedWith`; repeat completion, never-landed, expired, and artifact-less completion refused before any write (F-6; AC-F6-1, AC-F6-2; DM-2; NFR-5).
- The no-secrets guard on note text, `--ref`, and derived origin values — the registered-value match only, with a positive twin proving no pattern layer, and a refusal payload that leaks nothing (F-7; AC-F7-1; TDR-0012).
- Mounting: prompt-required membership, unconditional production composition, root and family help, `--version`, the reference page, the coverage-inventory row, the moved family-count assertions, and isolation from the other families (F-8; AC-F8-1, AC-F8-2; DEC-9).
- Classified outcomes: `steer.unknown-id`, `steer.credential-value-rejected`, `steer.queue-unavailable` with their categories, exit rows, and `not_landed` consequences; the five-field envelope and the exact `0`/`1`/`2` projection; the error-table rows, the exact two-segment allowlist (`56 → 59`), **every count-pinning site enumerated in spec Appendix D (D-1..D-13) moved in the same commit**, the repo-wide no-leftover scan, and four-way agreement between classifier, sync check, structural mirror, and carrier (F-9; AC-F9-1..AC-F9-4; DM-7; C-7; DEC-8).
- Purity and no-session-operation, determinism and identity uniqueness, bounds with counted drops and the declared byte-guard order (`asks` → `notes`, tail-first by rank, boundary block never dropped), and read cost (F-10; AC-F10-1..AC-F10-3; NFR-1..NFR-8; DEC-12).
- The aggregate quality gate `TMPDIR=$PWD/tmp/tmpdir pnpm check` (AC-NFR9-1; NFR-9).
- Non-vacuity controls: unreceipted landing, silent outcome, mid-phase landing, artifact-less completion, schema fork, mounting gap — each with a paired positive twin and, where the pre-change code already exhibits the guarded behaviour, a named mutation.

### 1.2 Out of Scope & Known Gaps

- [OUT] Board surfacing of steering notes — no fifth section, no board payload key, no board row change (NG-1, DEC-1). `AC-F5-2`'s side-by-side auditability is asserted on `steer list` only; no case reads a board payload for steering data.
- [OUT] Agent-to-agent messaging: no agent send path, no per-agent inbox, threads, group addressing, or remote backend (NG-2). `TC-STEER-007`/`TC-STEER-008` assert only that a non-owner record *validates against the same schema*; no case writes one through a CLI surface.
- [OUT] Dispatch-as-wake, urgency-driven session start, push channel, resident listener, daemon, timer (NG-3). `TC-STEER-080` asserts their *absence*; no case builds one.
- [OUT] Any session operation — spawn, attach, resume, harness steer, control socket (NG-4, DEC-12). `TC-STEER-080` and `TC-STEER-093` assert the absence; no case drives a session.
- [OUT] New event topics, subscription surfaces, telemetry exports, counters, metrics, or traces (NG-5, DEC-10, §10). The only observability assertion is that the delivered command-audit ledger records the invocation; no new event is consumed.
- [OUT] Automatic aging-based priority promotion of stored notes (NG-6, DEC-11). `TC-STEER-022` asserts that order is derived and nothing is rewritten; no case asserts a mutation-based resequencing.
- [OUT] Message kinds beyond `request | escalate` on the filing path, and change-/session-/fleet-scoped queues (§7.2). `notify` appears only as a *refused* filing value (`TC-STEER-004`), never as an accepted one.
- [OUT] Phase-7 current-truth reconciliation of the new feature spec and the surrounding prose; the one in-boundary documentation write is the error-table carrier (C-7), asserted for row presence, counts, and the allowlist paragraph in `TC-STEER-076`.
- [OUT] Commit hygiene and PR posture as permanent assertions (NFR-10, DoD-18). Recorded as gate/review evidence (`TC-STEER-090`, §10), never asserted by a suite.
- [GAP-T1 — the bound/unbound filing cells need a real checkout] `AC-F1-1`'s origin block is derived from the invoking checkout's local PM context, so the bound and unbound cells are executed over real temporary git checkouts plus a real PM-context file, never over an injected fake key (`TC-STEER-001`, `TC-STEER-002`). A synthetic scope would prove nothing about derivation.
- [GAP-T2 — no pre-change byte baseline exists for a steering screen] Determinism is asserted by paired runs plus a committed golden for all four human forms, and the goldens are created (not regenerated) in this change (`TC-STEER-081`).
- [GAP-T3 — harness seam shapes are delivery-bound] The state port, id factory, clock, and origin source are consumed through injected seams the specification does not name. Cases assert payload, exit, and evidence; a case that cannot resolve its seam **fails naming the missing contract** rather than skipping (`AMB-TP-2`).
- [GAP-T4 — the >20-due-note batch has two declared readings] `AC-F3-4` ("all due notes land in one batch") and `DM-8` ("read batch ≤ 20 notes per read with counted overflow") do not compose above 20 due notes. `TC-STEER-083` asserts the no-loss invariant plus the exhaustive ≤ 20 population and names the >20 cell as `OQ-TP-3`; no case asserts a resolution the specification has not made.
- [GAP-T5 — the `--ttl` duration grammar is undeclared] `DM-1` declares "positive duration ≤ 30 days" and a 24 h drawn default but no textual form, so the "non-positive ttl" cell of `AC-F1-2` cannot be written without inventing syntax (`AMB-TP-3`). Cases assert the declared outcomes (over-cap refused, drawn default applied) and the delivery-bound grammar's zero/negative refusal; the accepted spellings are delivery-bound, not AC-bound.
- [GAP-T6 — the family-count pin is stale in the spec] See `OQ-TP-1`. `TC-STEER-060` asserts the tree-invariant form ("the delivered set plus exactly `steer`, root help family line count equal to the registered set") so the gate is sound in either arithmetic; the spec's literal "22 families" is unsatisfiable and is reported for reopening.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-298-spec.md`](./chg-GH-298-spec.md) v1.0 | Binding source: F-1..F-10, **24 ACs** (`AC-F1-1`, `AC-F1-2`, `AC-F2-1`, `AC-F3-1..5`, `AC-F4-1`, `AC-F5-1..2`, `AC-F6-1..2`, `AC-F7-1`, `AC-F8-1..2`, `AC-F9-1..4`, `AC-F10-1..3`, `AC-NFR9-1`), DM-1..DM-8, NFR-1..NFR-10, DEC-1..DEC-12, NG-1..NG-8, §6 flows 1–7, §8.3 grammar / contract shape / ordering invariants / boundary resolution / exit projection, §14 (all planning questions closed), §17.1 DoD-1..DoD-18, Appendix B (ticket AC decomposition), Appendix C (seed paths), **Appendix D (D-1..D-13 count-pinning sites, the binding locator list)**. |
| [`chg-GH-298-pm-notes.yaml`](./chg-GH-298-pm-notes.yaml) | Delivery state, the ticket AC restatement, the three canonical ticket ACs (Appendix B maps them), the delivered-dependency verification (GH-296 ceremony and GH-297 board both in the base), and the delivery conventions (gate command, PR target, commit body width). |
| [`chg-GH-298-plan.yaml`](./chg-GH-298-plan.yaml) | To be authored in phase 4. Phase ownership of these cases is declared there, not here. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Test layers, module-to-test mapping, invariant-test authoring (no moving-base diffs; goldens regenerate only by explicit command; assert the value's meaning), and the aggregate gate. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict types, injected clock and environment, data-only contracts, pure domain, adapters own I/O, injected fakes over `mock.module`. |
| [M2 test scenarios](../../../planning/oss-tooling/milestones/m2/test-scenarios.md) | `SC-M2-S5-01` and `SC-M2-S5-02`, inherited by name and mapped below; neither body is restated. |
| [M2 journeys](../../../planning/oss-tooling/milestones/m2/journeys.md) | "Steering a running delivery": queue with origin/receipt/ttl, land at the boundary, expiry with the course unchanged, side-by-side auditability (step 4 → DEC-1 → `AC-F5-2`). |
| [M2 contracts](../../../planning/oss-tooling/milestones/m2/contracts.md) | The `phase.state` topic named as steer's advisory surface; S5 declares the boundary-open derivation as its edge, no publisher or subscriber. |
| [Inter-agent communication concept](../../../planning/concepts/inter-agent-communication.md) | The typed message record model, pull-at-read-points semantics, ack→complete with artifact ref, the no-secrets rule, the untrusted-input posture, tooling-hides-the-format. |
| [`feature-blockers.md`](../../../spec/features/feature-blockers.md) | The typed-channel prior art: closed vocabularies, append-only immutable records with derived closure, shared ranking, credential guard, bounds, exit matrix. |
| [`feature-board.md`](../../../spec/features/feature-board.md) | The delivered `ASKS` projection (`drawnDefault`, `defaultState`, `age`) the asks batch composes, and the explicit NG-1 that scoped steering out of the board. |
| [`feature-result-contract.md`](../../../spec/features/feature-result-contract.md) | The in-boundary error-table carrier (C-7): the `steer` kind, its three rows, the `143` documented identities, and the `56 → 59` allowlist paragraph (`TC-STEER-076`). |
| [`feature-cli-entrypoint.md`](../../../spec/features/feature-cli-entrypoint.md) | The prompt-required set and the "composed but not advertised is dropped" rule the mount changes. |
| [`feature-delivery-lifecycle.md`](../../../spec/features/feature-delivery-lifecycle.md) | The delivered phase-state records and the phase fold the boundary-open condition reads. |
| **Delivered suites consumed as anchors** | `tests/structure/error-table.test.ts`, `tests/structure/dispatch-attempts-taxonomy.test.ts`, `tests/structure/verify-gates-suite-map-contract.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/structure/entrypoint-bin.test.ts`, `tests/structure/board-mounting.test.ts`, `tests/behaviour/entrypoint-help.test.ts`, `tests/behaviour/blockers-record-integrity.test.ts`, `tests/behaviour/blockers-ranking.test.ts`, `tests/behaviour/blockers-records.test.ts`, `tests/behaviour/blockers-credential.test.ts`, `tests/behaviour/blockers-bounds.test.ts`, `tests/behaviour/brief-*.test.ts`, `tests/golden/envelope-*.test.ts`, `tests/checks/privacy-literals.test.ts`, `tests/checks/forbidden-literals.test.ts`. |
| **Delivered harness seams reused** | `tests/fixtures/blockers/{harness,records,ranking}.ts` and `tests/fixtures/blockers/{cases,matrix,policy,bounds}/**`; `tests/fixtures/phase/**`; `tests/fixtures/state/harness.ts`; `tests/fixtures/credentials/cases.ts`; `tests/fixtures/projects/{production,state-scope,temp-repos,host-root}.ts`; `tests/fixtures/entrypoint/programs.ts`; `tests/fixtures/help-guide/coverage.json`; `tests/golden/helpers.ts`; `tests/behaviour/verify-support.ts` (`guardStore`, `VerifyCallRecorder`). |

**Inherited scenario seeds.** Both planning seeds are inherited by name and mapped onto the criteria they already assert; neither body is restated. Both map to declared payload paths per spec Appendix C (OQ-2, OQ-3 closed).

| Seed | Inherited as | Mapping to the spec's criteria | Cases |
|---|---|---|---|
| `SC-M2-S5-01` — a landed note's `data.receipt` carries non-null `origin`, `readReceipt`, `ttl` | The single-due-note landing cell at a boundary-open read | The seed's `data.receipt` path maps to `notes[].receipt` on the landed note (`{origin, readReceipt: {at, boundary}, ttl, expiresAt}`) in the single-note fixture; the seed is satisfied by `AC-F3-1` holding on that fixture, which also requires exactly one outcome record and an untouched session/branch/evidence trail. `TC-STEER-091` is the seed's completeness control: it fails if any landed note anywhere carries a null receipt member. | `TC-STEER-010` (seed), `TC-STEER-091` (completeness control) |
| `SC-M2-S5-02` — TTL elapsed: exit `0`, `data.applied == false`, `data.expiry.reason == "ttl-elapsed"` | The single-elapsed-note cell at a boundary-open read | The seed asserts exactly `AC-F3-2`: payload-level `data.applied` and `data.expiry.reason` per DM-3/DEC-7, the note's own `applied: false` and `expiry {reason, recordedAt}`, exactly one expiry outcome appended, and nothing else mutating. `TC-STEER-018` is the totals case that keeps the seed's two payload-level fields total over empty, all-expired, mixed, and pending reads. | `TC-STEER-012` (seed), `TC-STEER-018` (totals) |

Reconciliation note: the seeds are the *minimum*. They do not cover filing, the shared schema, the closed-boundary decline, batch ordering, idempotence, aging/rank, the list view, asks, completion, the credential guard, mounting, classification, registration, purity, determinism, bounds, or read cost. Those arrive as new cases and are marked as such in §3.4.

## 3. Coverage Overview

Evidence classes used below: **Suite** (a committed assertion in `pnpm check`), **Suite + mutation** (a suite assertion whose detection power is proven by a named in-place mutation, used where the guarded property is already partially exhibited or where a count pin could agree by accident), **Golden** (a byte-exact committed artifact), **Quality gate** (an execution record, not a permanent assertion), **Review-verified** (a diff/content inspection recorded in §10).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | Bare `steer send "<text>"` in a bound checkout appends exactly one record with `from: owner`, `to: delivery`, `scope: repo`, `kind: request`, the bounded text, the derived origin block (`change` = bound ref, `repo` = repository key, `agent: owner`), `priority: normal`, injected-clock `created`, the 24 h `ttl` with derived `expiresAt`, the record projection and `lifecycle: queued` at exit `0`; an unbound checkout records the bare `null` origin change and still succeeds. | TC-STEER-001, TC-STEER-002, TC-STEER-003 | Suite | Covered |
| AC-F1-2 | Empty/over-cap text, non-positive or over-cap ttl, out-of-set priority or kind, or over-cap `--ref` is refused as `input.value.rejected` at exit `1`, `not_landed`, before any state read or write, with zero persisted bytes. | TC-STEER-004, TC-STEER-005 | Suite | Covered |
| AC-F2-1 | Every appended record conforms to the one shared message schema: no owner-specific field, every vocabulary member from the shared closed sets declared once, the filing subset a declared restriction rather than a separate schema, so a non-owner-issued message validates without an owner branch. | TC-STEER-007, TC-STEER-008, TC-STEER-095 | Suite + mutation | Covered |
| AC-F5-1 | Every row carries `age` in ms from the injected clock; rows order by the shared rank (priority class, oldest `created`, `id` ascending); ranks are contiguous `1..N` assigned before any render cap; a repeat run reproduces identical order and ages. | TC-STEER-020, TC-STEER-021, TC-STEER-022 | Suite | Covered |
| AC-F5-2 | Queued, landed, and expired groups render side by side in declared order, landed rows carrying receipts (`origin`, `readReceipt`, `ttl`) and `completedWith` where completed, expired rows carrying the `ttl-elapsed` reason and timestamp, ≤ 8 rows per group with every omission counted. (Journey step 4 outcome; DEC-1.) | TC-STEER-023, TC-STEER-024, TC-STEER-025 | Suite | Covered |
| AC-F3-1 | A due note at a boundary-open read (no phase record, or every recorded entry completed) lands: exit `0`, `applied: true`, `lifecycle: landed`, a receipt with non-null `origin`, `readReceipt`, `ttl`, exactly one outcome record, session/branch/evidence untouched. (`SC-M2-S5-01`.) | TC-STEER-010, TC-STEER-011, TC-STEER-091 | Suite | Covered |
| AC-F3-2 | A note whose ttl elapsed (`now >= created + ttl` on the injected clock) at a boundary-open read is not applied: exit `0`, `data.applied == false`, `data.expiry.reason == "ttl-elapsed"`, the note's own `applied: false` and `expiry {reason, recordedAt}`, exactly one expiry outcome, nothing else mutates. (`SC-M2-S5-02`.) | TC-STEER-012, TC-STEER-017, TC-STEER-018 | Suite | Covered |
| AC-F3-3 | With a lifecycle entry in progress the read declines: exit `0`, `boundary.open` false, every note `applied: false` with `pendingReason: "phase-in-progress"`, no receipt or expiry record appends, nothing lands mid-phase. | TC-STEER-013, TC-STEER-093 | Suite + mutation | Covered |
| AC-F3-4 | Multiple due notes land in one batch ordered by the shared rank, each with its own receipt, payload `data.applied` true — one batched landing per boundary, never one-at-a-time. | TC-STEER-014, TC-STEER-083 | Suite | Covered |
| AC-F3-5 | An immediate repeat read lands nothing new, appends no record, returns the empty batch with `data.applied == false`, exit `0`. | TC-STEER-015, TC-STEER-016 | Suite | Covered |
| AC-F4-1 | `asks[]` carries the open owner-audience questions through the delivered open-question view (id, delivered type, `ref` or bare `null`, lane, bounded text, `askedAt`, measured `age`) each with the delivered PDR-0003 join (`drawnDefault` or bare `null`, `defaultState` `none`/`pending`/`applied`) under the delivered ranking and bounds; coordinator-audience questions are never asks; no ledger write, no second ranking or default mechanism. (Ticket AC-1.) | TC-STEER-030, TC-STEER-031, TC-STEER-032 | Suite | Covered |
| AC-F6-1 | A landed note completes with `--ref`: exactly one completion record with the artifact and timestamp, `lifecycle: "completed"` at exit `0`, the list row under landed with `completedWith` set; a repeat completion is refused at exit `1` — the first completion is never replaced. | TC-STEER-040, TC-STEER-041, TC-STEER-025, TC-STEER-094 | Suite + mutation | Covered |
| AC-F6-2 | A never-landed note, an expired note, or `complete` without `--ref` is refused as `input.value.rejected` at exit `1` before any write — completion without a receipt or without a proving artifact is never recorded. | TC-STEER-042, TC-STEER-094 | Suite + mutation | Covered |
| AC-F7-1 | A registered secret value in the note text, `--ref`, or a derived origin value is refused as `steer.credential-value-rejected` at exit `1`, `not_landed`, zero persisted bytes; an unregistered value produces no pattern-scan refusal (the TDR-0012 boundary holds). | TC-STEER-050, TC-STEER-051, TC-STEER-052, TC-STEER-053 | Suite | Covered |
| AC-F8-1 | Root `--help` lists `steer` as a registered family and the family count equals the registered prompt-required set; `steer --help` answers at exit `0` with summary, usage, options, examples, exit codes, and a see-also pointer. (`OQ-TP-1`: the spec's literal "among 22 families" is stale against the delivery base; the case asserts the tree-invariant form.) | TC-STEER-060, TC-STEER-061, TC-STEER-063, TC-STEER-096 | Suite + mutation | Covered (arithmetic reopened: `OQ-TP-1`) |
| AC-F8-2 | The steer reference page exists, mentions `--help` and `--version`, the coverage inventory carries the steer row, and the coverage check reports zero failures. | TC-STEER-062, TC-STEER-096 | Suite + mutation | Covered |
| AC-F9-1 | A `complete` target that is not a steering record of the repository is refused as `steer.unknown-id` at exit `1`, `not_landed`. (`OQ-TP-2`: the criterion's second branch — "or a read targeting an id" — has no grammar to execute; `TC-STEER-071` asserts the grammar refusal and the branch is reported for reopening.) | TC-STEER-070, TC-STEER-071 | Suite | Covered (read-target branch reopened: `OQ-TP-2`) |
| AC-F9-2 | An unreadable store, an unwritable store, or an unverifiable post-append verification withholds the command as `steer.queue-unavailable` at exit `2`, nothing reported landed or completed, no partial result. | TC-STEER-072, TC-STEER-084 | Suite + mutation | Covered |
| AC-F9-3 | Every invocation uses the five-field `delivery.result.v1` envelope with all new keys under `data`, an exit of exactly `0`, `1`, or `2` per §8.3, and every refusal names its classified identity. | TC-STEER-073 | Suite | Covered |
| AC-F9-4 | (a) The closed two-segment allowlist contains exactly the three steer codes and no other `steer.*` code (56 → 59, exact declaration, no pattern or family widening); (b) every Appendix D site (D-1..D-13) moves to its declared post-change value in the same commit as the rows (140 → 143 entries, 139 → 142 delivered, 56 → 59 allowlist, 140 → 143 documented, `+106` → `+109`, 3 steer rows); (c) the repo-wide no-leftover scan over the named files, with the legacy-token list extended by 140, 139, 56, and `+106`, finds none; (d) classifier, sync check, structural mirror, and carrier agree on the same post-change numbers and a near-miss `steer.*` code is rejected rather than accepted by family matching. | TC-STEER-074, TC-STEER-075, TC-STEER-076 | Suite + mutation | Covered |
| AC-F10-1 | No LLM call, no network request, no tracker or provider read or write, no timer/daemon/listener, no control socket, no session spawn/attach/resume/steer operation, and no hardcoded product or binary name. | TC-STEER-080, TC-STEER-093 | Suite | Covered |
| AC-F10-2 | Two runs over unchanged facts produce byte-identical human text and machine `data` (timing and run id aside), every array follows its declared order, and record ids are unique per store. | TC-STEER-081, TC-STEER-006, TC-STEER-022 | Suite + Golden | Covered |
| AC-F10-3 | The 65 536-byte `data` cap, 32-line/6 144-byte human cap, 160-char text and ref caps, 30-day ttl cap, 8-row group caps, and 20-note read-batch cap hold; every drop sets `truncated` and increments `omitted` in the declared order (`asks` → `notes`, tail-first by rank) with the boundary block never dropped. | TC-STEER-082, TC-STEER-083, TC-STEER-024 | Suite + mutation | Covered |
| AC-NFR9-1 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens. | TC-STEER-090 | Quality gate | Covered |

All 24 acceptance criteria are mapped; none is unmapped, `TODO`, or AC-less. Two carry a declared reopening note (`AC-F8-1` → `OQ-TP-1`, `AC-F9-1` → `OQ-TP-2`) where the spec text is unsatisfiable as written but the underlying property is still gated by a tree-invariant case. Capability coverage is transitive and complete: F-1 → 001–005, 042; F-2 → 007, 008, 095; F-3 → 010–018, 083, 091; F-4 → 030–032; F-5 → 020–025; F-6 → 040–042, 094; F-7 → 050–053; F-8 → 060–063, 096; F-9 → 004, 005, 070–076, 084; F-10 → 022, 080–085.

### 3.2 Interface Coverage (DM-#, command surface, registries)

The spec declares no `API-` or `EVT-` identifiers (§8.1: no HTTP surface; §8.2: no new event topic, kind, or payload). The interfaces under test are the machine payloads, the command grammar, the three state record kinds, the help and coverage registries, and the error table.

| Interface element | Observable contract | TC ID(s) |
|-------------------|---------------------|----------|
| DM-1 shared message record | Exactly 11 declared keys (`id`, `from`, `to`, `scope`, `kind`, `subject`, `ref`, `origin`, `priority`, `created`, `ttl`); no owner-specific field; shared closed vocabularies declared once; filing subset a restriction; `id` = `msg-` + per-store-unique opaque suffix; `subject` ≤ 160; `ref` string or bare `null` ≤ 160; `ttl` positive ≤ 30 days. | TC-STEER-001, TC-STEER-003, TC-STEER-006, TC-STEER-007, TC-STEER-008, TC-STEER-095 |
| DM-2 lifecycle records and derived state | Three additive append-only kinds (`steering.message`, `steering.outcome`, `steering.completion`); lifecycle derived at read time as `queued`/`landed`/`expired`/`completed`; exactly one outcome per note; first completion authoritative; no stored lifecycle flag. | TC-STEER-006, TC-STEER-016, TC-STEER-040, TC-STEER-084 |
| DM-3 read-point outcome | Per note `applied`, `receipt` (`{origin, readReceipt: {at, boundary}, ttl, expiresAt}` — all non-null when landed), `expiry` (`{reason: "ttl-elapsed", recordedAt}`, present exactly on expiry), `pendingReason` (`"phase-in-progress"`, present exactly on a closed decline); payload `data.applied` true iff ≥ 1 landed; `data.expiry.reason` present exactly when ≥ 1 expired. | TC-STEER-010, TC-STEER-012, TC-STEER-013, TC-STEER-014, TC-STEER-018, TC-STEER-091 |
| DM-4 queue view | `queued[]`, `landed[]`, `expired[]` in declared order; shared note fields plus `age`, `rank`; landed rows carry the receipt and `completedWith`; expired rows carry reason and timestamp; ≤ 8 rows per group with counted omissions. | TC-STEER-023, TC-STEER-024, TC-STEER-025 |
| DM-5 shared rank and aging | Priority class map `urgent=1 … low=4`; rank key `(class asc, created asc, id asc)`; contiguous `1..N` before caps; `age` = clock now − `created` in ms on every surface; order derived, never stored. | TC-STEER-020, TC-STEER-021, TC-STEER-022 |
| DM-6 boundary asks batch | `asks[]` carries the delivered open-question fields plus `age`, `drawnDefault`, `defaultState`, `rank`; bounds and ordering exactly as delivered; coordinator questions excluded; no ledger write; single shared ledger read. | TC-STEER-030, TC-STEER-031, TC-STEER-032, TC-STEER-085 |
| DM-7 error identities | One `steer` domain kind with exactly three rows: `steer.unknown-id` (user, exit 1), `steer.credential-value-rejected` (user, exit 1), `steer.queue-unavailable` (platform, exit 2), all `not_landed`; value violations reuse `input.value.rejected`; grammar refusals reuse `fallback.invocation`. | TC-STEER-070, TC-STEER-072, TC-STEER-074, TC-STEER-075 |
| DM-8 bounds and caps | Text ≤ 160; ref ≤ 160; list ≤ 8 per group; read batch ≤ 20 with counted overflow; `data` ≤ 65 536 UTF-8 bytes; human ≤ 32 lines / 6 144 bytes; byte-guard order `asks` → `notes`, tail-first by rank; boundary block never dropped. | TC-STEER-004, TC-STEER-024, TC-STEER-042, TC-STEER-082, TC-STEER-083 |
| Command grammar | `send "<text>" [--kind request\|escalate] [--priority …] [--ttl <duration>] [--ref <artifact>]`; `list`; `read`; `complete <id> --ref <artifact>`; exactly one positional for `send`/`complete`, none for `list`/`read`; `--json` is the delivered machine switch; violations are `fallback.invocation` at exit `1` before any state read. | TC-STEER-005, TC-STEER-071, TC-STEER-073 |
| Exit projection (§8.3) | Six declared rows: produced → success envelope exit `0`; value violation → `input.value.rejected` exit `1`; unknown target id → `steer.unknown-id` exit `1`; registered secret → `steer.credential-value-rejected` exit `1`; grammar → `fallback.invocation` exit `1`; store unreadable/unwritable/unverified append → `steer.queue-unavailable` exit `2`. | TC-STEER-073, TC-STEER-072, TC-STEER-070 |
| Payload identity | One identity `delivery.steer.v1` across all four subcommands with per-form `data` shapes (DEC-3); no second schemaVersion; envelope untouched. | TC-STEER-073, TC-STEER-081 |
| Boundary resolution | No phase record → open, `phase: null` + `phaseUnknownReason: "phase-unrecorded"`; every recorded entry completed → open with `phase` = the latest completed entry; an entry in progress → closed; TTL judged `now >= created + ttl` only at a read. | TC-STEER-010, TC-STEER-011, TC-STEER-013, TC-STEER-017 |
| Prompt-required composition | `steer` is a member of the exact set the entrypoint composes, unconditionally, with the registered count moved and every other family's composition unchanged. | TC-STEER-060, TC-STEER-063, TC-STEER-096 |
| `steer --help`, `--version` | Served from the static help inventory at exit `0` with the five declared sections and no state, store, git, network, or configuration read. | TC-STEER-061 |
| Coverage inventory and reference page | `tests/fixtures/help-guide/coverage.json` carries the steer command row and page path; the page exists and mentions `--help` and `--version`. | TC-STEER-062, TC-STEER-096 |
| Error-table registration and the closed allowlist | `ERROR_TABLE` gains the three rows (140 → 143 entries; 139 → 142 delivered rows; exactly 3 steer rows and still exactly 2 board rows); `RESERVED_TWO_SEGMENT_CODES` holds exactly 59 members in the sync check **and** its structural mirror, of which exactly 3 are `steer.*`; **all D-1..D-13 sites move in the same commit**; no-leftover scan and four-way agreement 143 / 142 / 59 / 2 / 3 / 143. | TC-STEER-074, TC-STEER-075, TC-STEER-076 |
| Read cost | ≤ 1 verified steering-store read + ≤ 1 delivered phase-state read + ≤ 1 blocker-ledger read per `read`; ≤ 1 store read per `list`/`complete`; 0 reads beyond the local state scope. | TC-STEER-085, TC-STEER-032 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Notes |
|--------|-------------------------|----------|-------|
| NFR-1 | 0 new top-level envelope keys; 0 `ok`/`command` fields anywhere. | TC-STEER-073 | Envelope contract validator plus an explicit key-set diff per subcommand. |
| NFR-2 | 2 of 2 runs byte-identical in human text and JSON `data` (timing/run id excluded); 0 undeclared order sources. | TC-STEER-022, TC-STEER-081 | Permutation cells: store return order, readdir order, ledger row order, ask order. |
| NFR-3 | 0 duplicate ids; ranks exactly `1..N` over the fully ranked set before caps. | TC-STEER-006, TC-STEER-021, TC-STEER-081 | 100-filing uniqueness cell; rank matrix with an id-ascending tie. |
| NFR-4 | `data` ≤ 65 536 bytes; human ≤ 32 lines / 6 144 bytes; text/ref ≤ 160; ttl ≤ 30 days; list ≤ 8 per group; read batch ≤ 20; every drop counted with `truncated`. | TC-STEER-024, TC-STEER-082, TC-STEER-083 | Byte measurement on the serialized `data`, not the envelope; at-cap twin for every over-cap cell. |
| NFR-5 | `send` appends exactly 1 message record; `read` appends ≤ 1 outcome per note and only for transitioning notes; `complete` appends exactly 1, a second 0; 0 edits/deletes/prunes; an unverified append leaves no reported landing. | TC-STEER-006, TC-STEER-016, TC-STEER-040, TC-STEER-041, TC-STEER-084 | Tree snapshot plus appended-record counts plus the fence recorder. |
| NFR-6 | 0 LLM calls; 0 network requests; 0 provider/tracker reads or writes; 0 timers/loops/sockets; 0 session operations; 0 hardcoded product or binary names. | TC-STEER-080 | Recording ports, transport assertion, module scan, brand-seam swap. |
| NFR-7 | 0 ambient wall-clock reads in the pure domain; every `age`/expiry/boundary value reproducible from a fixed clock. | TC-STEER-017, TC-STEER-020 | Fixed clock advanced by stated deltas; a bogus stored age/timestamp cannot influence a derived value. |
| NFR-8 | ≤ 1 steering-store read + ≤ 1 phase-state read + ≤ 1 ledger read per `read`; ≤ 1 store read per `list`/`complete`; 0 reads beyond the local state scope. | TC-STEER-085, TC-STEER-032 | Counting wrappers on every read seam; the asks join reuses the single ledger read. |
| NFR-9 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens. | TC-STEER-090 | Recorded in §10 and pm-notes `notes:`. |
| NFR-10 | Conventional subjects via the commit primitive; every body/footer line ≤ 100 characters. | TC-STEER-090 (recorded) | Verified by the phase-9 range lint gate and CI `ts-commitlint`; PM-owned, not a permanent assertion here. |

### 3.4 Coverage-Matrix Integrity

- **Counts.** 24 ACs → 57 cases. Every AC appears in at least one row of §3.1; every case appears in at least one row (no orphan). Every case id appears exactly once in §5.1, exactly once in §5.2, and exactly once in §7.
- **Seed-derived cases** carry their seed id in `Related IDs`: `TC-STEER-010` and `TC-STEER-091` (`SC-M2-S5-01`); `TC-STEER-012` and `TC-STEER-018` (`SC-M2-S5-02`). All other cases are new in this plan and are marked so in §9.
- **Ticket-AC binding.** Appendix B maps ticket AC-1 → `AC-F4-1` (`TC-STEER-030`..`032`, with batching in `014`/`083` and aging in `020`), AC-2 → `AC-F1-1`/`AC-F3-1`/`AC-F3-2` (`001`..`003`, `010`..`012`, `017`, `018`), AC-3 → `AC-F2-1` (`007`, `008`, `095`). A ticket AC with no green case in its row is a red DoD row, not a partial pass.
- **DoD binding.** DoD-1 → 001–003, 007, 008; DoD-2 → 004, 005, 042, 070; DoD-3 → 007, 008, 095; DoD-4 → 010, 011, 091; DoD-5 → 012, 017, 018; DoD-6 → 013, 014, 015, 016, 083, 093; DoD-7 → 030, 031, 032; DoD-8 → 020, 021, 022; DoD-9 → 023, 024, 025; DoD-10 → 040, 041, 042, 094; DoD-11 → 050–053; DoD-12 → 060–063, 096; DoD-13 → 074, 075, 076; DoD-14 → 072, 084; DoD-15 → 080–085; DoD-16 → this section; DoD-17 → 090; DoD-18 → §10 (PR record, PM-owned).
- **No moving-base assertions.** No case asserts a diff against `origin/main-tools`. Where the spec asks for "unchanged" (other families' composition, the delivered ledger, the delivered envelope) the case asserts a tree invariant: a committed golden, a closed key set, or a set-equality against a declared constant.
- **Negative controls are first-class.** Every block carries at least one paired control: a readable twin for each store-failure cell, a positive twin for each fabricated-value cell, an at-cap twin beside every over-cap cell, a registered-secret cell beside every pattern-shaped-but-unregistered cell, and a registered-family twin beside every mounting mutant. Block J cases are mutant proofs; they are not duplicates of block A–I cases because they assert *detection power* rather than the property itself.
- **Failing-first discipline.** Each case names the observable that is red before its owning phase exists (missing subcommand → `fallback.invocation`; missing `data` key → key-set mismatch; missing row → count mismatch at 140/56). A case that is green before its phase is a non-vacuity defect and is recorded as such.

### 3.5 Declared test-methodology substitutions

No contract question is open in the specification: §14 records OQ-1..OQ-4 closed, and every AC names its verification path. The substitutions below are about **how a property is measured**, plus two spec-text defects reported for reopening; none blocks delivery of the properties themselves.

| ID | Substitution | Where handled |
|----|--------------|---------------|
| `AMB-TP-1` | **The human render is asserted as a maximum plus marker arithmetic, not as a fixed line layout.** `DM-8` declares ≤ 32 lines / 6 144 bytes; the case asserts the cap, the marker arithmetic for counted omissions, and a golden for the four forms. It does not pin a line-by-line layout, so a future layout change that keeps the budget and the counts passes. | `TC-STEER-082`, `TC-STEER-081` |
| `AMB-TP-2` | **Harness seam shapes are delivery-bound.** The state port, id factory, injected clock, and origin source are consumed through injected seams the specification does not name. Cases assert payload, exit, exit code, and evidence; a case that cannot resolve its seam **fails naming the missing contract** rather than skipping. Behaviours, identities, closed vocabularies, bounds, and AC traceability are not delivery-bound. | all behaviour cases |
| `AMB-TP-3` | **The `--ttl` duration grammar is delivery-bound** (`GAP-T5`). `DM-1` declares a positive duration ≤ 30 days and a 24 h default but no textual form, so `AC-F1-2`'s "non-positive ttl" cell is written against the delivery-bound parser: the case asserts the refusal *outcome* (`input.value.rejected`, exit `1`, zero bytes) for the zero/negative form the parser accepts, plus the over-cap refusal, and never asserts an accepted spelling the spec does not declare. | `TC-STEER-004` |
| `OQ-TP-1` | **The family-count arithmetic in `AC-F8-1` is stale against the delivery base.** Base `cfb0ce8d` already carries **22** prompt-required families — `PROMPT_REQUIRED_COMMANDS` has 22 members (`board` at index 20, `ceremony` at index 21, merged as GH-296 in the base) and `tests/structure/entrypoint-bin.test.ts:544` asserts that exact list; `board-mounting`, `events-production-composition`, `dispatch-attempts-composition`, and `daemon-production-composition` all assert 22. A correct steer mount therefore yields **23**, so "among 22 families" and §8.5's "21 → 22" cannot both be satisfied. `TC-STEER-060` asserts the tree-invariant form (registered set = delivered set plus exactly `steer`; root help family-line count equals the registered set; every existing family still present) so the gate is sound under either arithmetic. **Reported for spec reopening:** §4.1 "Mounting completeness" ("22 registered root families"), §8.5 "Family count" ("21 → 22"), DEC-9 ("twenty-second prompt-required family"), §16.1 planning row ("CLI command registry row (22 families)"), AC-F8-1, DoD-12. | `TC-STEER-060`, §8.3 |
| `OQ-TP-2` | **`AC-F9-1`'s read-target branch has no executable grammar.** The criterion and the §8.3 exit-projection row both say "`complete` or `read` target id", but the §8.3 grammar gives `read` no positional ("`list` and `read` accept none") and F-3 defines `read` as the all-notes batch read point. Inventing an id positional on `read` would contradict F-3. `TC-STEER-070` covers the `complete` branch exhaustively; `TC-STEER-071` asserts the declared grammar (`steer read <id>` → `fallback.invocation`, exit `1`, zero reads) so the contradiction cannot be silently implemented as a second read form. **Reported for spec reopening:** §17 AC-F9-1, §8.3 exit-projection row 3. | `TC-STEER-070`, `TC-STEER-071`, §8.3 |
| `OQ-TP-3` | **`AC-F3-4` and `DM-8` do not compose above 20 due notes.** "All due notes land in one batch" versus "read batch ≤ 20 notes per read with counted overflow" read as a landing cap, a render cap, or a deferred second batch. `TC-STEER-083` asserts the properties that hold under every reading (no note is lost; every landed note has a receipt; every omit is counted; `truncated` set consistently) and exhausts the ≤ 20 population, where all three readings agree. **Reported as a spec tension** (not blocking): §17 AC-F3-4 / DM-8 / §8.3 contract shape. | `TC-STEER-083`, §8.3 |

## 4. Test Types and Layers

- **Structure / boundary (contract-level), `bun:test` under `tests/structure/`** — the exact DM-1 key set and no owner-specific field, the four closed vocabularies declared once, the filing subset as a strict restriction, payload key sets per subcommand against the §8.3 shape, `delivery.steer.v1` as the single identity, the `steer` domain kind and its exactly-three rows, the closed two-segment allowlist as an exact 59-member set with exactly three `steer.*` members, all D-1..D-13 pins moved (including the dispatch-taxonomy and verify-suite-map suites and the sync suite's `+106 → +109` arithmetic), the no-leftover scan, four-way agreement, `PROMPT_REQUIRED_COMMANDS` membership and count, help-inventory entry, and module inventory registration. No I/O beyond the committed tree and exported predicates. Cases: `TC-STEER-007` (structure half), `008`, `060`, `063`, `074`, `075`, `076`, `082` (constants half), `084` (state-kind half).
- **Behaviour (in-process CLI composition), `bun:test` under `tests/behaviour/`** — the majority of the plan over `runCli` with the injected steer harness: filing, defaults, refusals, grammar, landing, expiry, decline, idempotence, aging/rank, the list view, asks composition, completion, the credential guard, the error matrix, determinism, bounds, write audit, purity, and read cost. Cases: `001`–`006`, `010`–`018`, `020`–`025`, `030`–`032`, `040`–`042`, `050`–`053`, `061`, `070`–`073`, `080`–`085`.
- **Behaviour over the real production composition, `bun:test` under `tests/behaviour/`** — creates real temporary git checkouts plus a real local PM-context file and the real production composer; the only injected facts are the clock, the id factory, the registered-secrets record, and the recording seams. Mandatory wherever the assertion depends on the invoking checkout (`AC-F1-1`'s origin derivation, bound and unbound), because a synthetic scope would prove nothing. Cases: `001`, `002`, `052`, `060`, `084`.
- **Golden, `bun:test` under `tests/golden/` with artifacts in `tests/fixtures/steer/golden/**`** — the four human forms (`send`, `list` with all three groups populated, `read` with a landed and an expired note, `complete`) and their machine envelopes + `data`. New artifacts in this change; each has a `regenerate.ts` beside it and the regeneration diff must show only the declared delta. Cases: `TC-STEER-081`, `023` (list golden half).
- **Checks (guards), `bun:test` under `tests/checks/`** — help/guide coverage, reference-page parity, error-table doc sync, prompt conformance, privacy/forbidden literals, and the content inventory, all run inside `pnpm check`. Cases: `062`, `074`–`076` (sync half), `080` (literal-registry half), `096`.
- **Measured bounds and read cost, `bun:test` with counters and printed context** — byte sizes, line counts, row counts, note counts, and per-seam read counters. Every measurement prints the fixture size and the samples so an over-budget run is diagnosable rather than merely red. Cases: `024`, `082`, `083`, `085`.
- **Mutation / non-vacuity controls** — in-place mutations executed in a temporary copy of the tree (the delivered `error-table-sync` and boundary-fixture pattern): omit `ttl` from a receipt, land without appending an outcome, land while a phase is in progress, record a completion without `--ref`, add an owner-specific field to the schema, widen the filing subset to a shared-vocabulary member, drop the prompt-set entry, drop the coverage-inventory row, plant a two-segment `steer.*` near miss in a scanned corpus, omit the widening from the checker copy, widen the checker to a `steer.` prefix, leave a non-mirror count site stale (dispatch-taxonomy header/name/length; verify-map reads; sync `+109` arithmetic), and report a landing on an unverified append. Cases: `008`, `063`, `076`, `084`, `091`–`096`, `093`.
- **Not used:** `mock.module` substitution of the modules under test; live network; live credentials; real sleeps or timers; the live tree or `$HOME` as state; child-process CLI invocations where an in-process `runCli` composition proves the same property. Fakes are injected ports (clock, id factory, state store, phase read, ledger view, secrets record, spawn recorder) — never a mock of the validation, rank, expiry, or lifecycle derivation.
- **Boundaries:** no new cross-package edge is expected beyond the existing `cli` command family and the existing `core` contract/domain/state tiers (ADR-0003). `check:boundaries` runs inside the aggregate gate; if delivery declares a new `workspaceImports` edge, the fixture-coverage meta-check requires its negative fixture in the same change.

## 5. Test Scenarios

TC IDs use the `STEER` feature prefix and follow the specification's capability blocks: `001`–`008` filing and the shared record; `010`–`018` boundary delivery, receipts, and expiry; `020`–`025` aging, rank, and the queue view; `030`–`032` the asks batch; `040`–`042` completion; `050`–`053` the no-secrets guard; `060`–`063` mounting; `070`–`076` classification and error-table registration; `080`–`085` purity, determinism, bounds, write discipline, and read cost; `090`–`096` quality gate and non-vacuity controls. A new sequence appends at the end of its block; an id is never reused.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-STEER-001 | Bare filing draws every default and derives the origin block in a bound checkout | Happy Path | Critical | High | AC-F1-1; F-1, F-2; DM-1; DEC-6 |
| TC-STEER-002 | An unbound checkout records the bare `null` origin change and still files | Corner Case | Critical | High | AC-F1-1; F-1; DM-1 |
| TC-STEER-003 | Explicit flags override every drawn default and derive `expiresAt` from `created` + `ttl` | Happy Path | Important | High | AC-F1-1; F-1; DM-1; DEC-6 |
| TC-STEER-004 | Value violations are refused before any state read or write with zero persisted bytes | Negative | Critical | High | AC-F1-2; F-1, F-9; DM-8; NFR-5; `AMB-TP-3` |
| TC-STEER-005 | Grammar violations refuse before any state read as `fallback.invocation` | Negative | Critical | High | AC-F1-2, AC-F9-3; F-9; §8.3 grammar |
| TC-STEER-006 | Filing appends exactly one immutable record and ids are unique per store | Contract | Critical | High | NFR-3, NFR-5; DM-2; AC-F10-2 |
| TC-STEER-007 | Every record conforms to the one shared message schema with no owner-specific field | Contract | Critical | High | AC-F2-1; F-2; DM-1; DEC-2 |
| TC-STEER-008 | The filing subset is a declared restriction of the shared vocabularies, not a fork | Contract | Critical | High | AC-F2-1; F-2; DM-1; DEC-2 |
| TC-STEER-010 | A due note lands at a boundary-open read with a complete receipt (`SC-M2-S5-01`) | Happy Path | Critical | High | AC-F3-1; F-3; DM-2, DM-3; DEC-5; `SC-M2-S5-01` |
| TC-STEER-011 | The second boundary-open route: every recorded entry completed, `phase` = latest completed | Corner Case | Critical | High | AC-F3-1; F-3; DM-3; DEC-5 |
| TC-STEER-012 | TTL elapsed before a boundary records a classified non-applied outcome (`SC-M2-S5-02`) | Happy Path | Critical | High | AC-F3-2; F-3; DM-3; DEC-7; `SC-M2-S5-02` |
| TC-STEER-013 | A boundary-closed read declines without applying or appending anything | Negative | Critical | High | AC-F3-3; F-3; DM-3; DEC-5 |
| TC-STEER-014 | Due notes land in one batch in the shared rank order, one receipt each | Happy Path | Critical | High | AC-F3-4; F-3, F-5; DM-3, DM-5 |
| TC-STEER-015 | An immediate repeat read lands nothing, appends nothing, and reports `applied: false` | Corner Case | Critical | High | AC-F3-5; F-3; NFR-5 |
| TC-STEER-016 | A resolved note is never re-resolved; at most one outcome record per note | Contract | Critical | High | AC-F3-5; NFR-5; DM-2 |
| TC-STEER-017 | TTL judgement is exactly `now >= created + ttl` on the injected clock | Corner Case | Critical | High | AC-F3-2; NFR-7; DM-5 |
| TC-STEER-018 | The payload totals are total over empty, all-expired, mixed, and pending reads | Corner Case | Critical | High | AC-F3-2; DM-3; DEC-7; `SC-M2-S5-02` |
| TC-STEER-020 | `age` is computed from the injected clock on every surface and never read from storage | Contract | Critical | High | AC-F5-1; NFR-7; DM-5 |
| TC-STEER-021 | The shared rank orders rows and assigns contiguous `1..N` ranks before caps | Happy Path | Critical | High | AC-F5-1; NFR-3; DM-5; DEC-11 |
| TC-STEER-022 | Order is derived at every read, never stored, and immune to store order | Corner Case | Critical | High | AC-F5-1, AC-F10-2; NFR-2; DEC-11 |
| TC-STEER-023 | The list view renders queued, landed, and expired side by side with receipts and reasons | Happy Path | Critical | High | AC-F5-2; F-5; DM-4; DEC-1 |
| TC-STEER-024 | The list caps each group at 8 rows with every omission counted | Corner Case | Critical | High | AC-F5-2, AC-F10-3; DM-8; NFR-4 |
| TC-STEER-025 | A completed note stays under landed with `completedWith` and never duplicates into queued | Corner Case | Important | High | AC-F5-2, AC-F6-1; DM-2, DM-4 |
| TC-STEER-030 | `asks[]` is the delivered open-question view verbatim with age and the drawn-default join | Happy Path | Critical | High | AC-F4-1; F-4; DM-6; NG-8 |
| TC-STEER-031 | The join is declared for `none`, `pending`, and `applied`, and a bare default is `null` | Corner Case | Critical | High | AC-F4-1; F-4; DM-6; PDR-0003 |
| TC-STEER-032 | Coordinator questions are excluded, the asks cap holds, and the join writes no ledger row | Negative | Critical | High | AC-F4-1; F-4; DM-6; NG-8; NFR-8 |
| TC-STEER-040 | A landed note completes against an artifact ref and the completion is append-only | Happy Path | Critical | High | AC-F6-1; F-6; DM-2; NFR-5 |
| TC-STEER-041 | The first completion is authoritative and a repeat completion appends nothing | Corner Case | Critical | High | AC-F6-1; F-6; NFR-5 |
| TC-STEER-042 | Never-landed, expired, artifact-less, and over-cap-ref completions are refused before any write | Negative | Critical | High | AC-F6-2; F-6, F-9; DM-8 |
| TC-STEER-050 | A registered secret value in the note text is refused with zero persisted bytes | Negative | Critical | High | AC-F7-1; F-7; DM-7; TDR-0012 |
| TC-STEER-051 | A registered secret value in `--ref` is refused with zero persisted bytes | Negative | Critical | High | AC-F7-1; F-7; DM-7 |
| TC-STEER-052 | A registered secret value in a derived origin value is refused on the identifier path | Negative | Critical | High | AC-F7-1; F-7; DM-7 |
| TC-STEER-053 | An unregistered token-shaped value is accepted, and no refusal payload leaks a secret | Negative | Critical | High | AC-F7-1; F-7; TDR-0012 |
| TC-STEER-060 | `steer` joins the prompt-required set, is composed unconditionally, and appears in root help | Happy Path | Critical | High | AC-F8-1; F-8; DEC-9; `OQ-TP-1` |
| TC-STEER-061 | `steer --help` and `--version` answer at exit 0 with the five declared sections and no side effect | Happy Path | Important | High | AC-F8-1; F-8 |
| TC-STEER-062 | The reference page and the coverage-inventory row satisfy the help coverage check | Contract | Critical | High | AC-F8-2; F-8 |
| TC-STEER-063 | Mounting changes no other family, and the unmounted mutant is detected | Regression | Critical | High | AC-F8-1; F-8; RSK-8; `OQ-TP-1` |
| TC-STEER-070 | An unknown completion id is `steer.unknown-id` at exit 1 with no write | Negative | Critical | High | AC-F9-1; F-9; DM-7 |
| TC-STEER-071 | `steer read <id>` is a grammar refusal, not a second read form (`OQ-TP-2`) | Negative | Critical | High | AC-F9-1, AC-F9-3; F-9; §8.3 grammar; `OQ-TP-2` |
| TC-STEER-072 | Store failures withhold every subcommand as `steer.queue-unavailable` at exit 2 | Negative | Critical | High | AC-F9-2; F-9; DM-7; NFR-5; RSK-3 |
| TC-STEER-073 | Every outcome projects the five-field envelope and the exact 0/1/2 exit row | Contract | Critical | High | AC-F9-3; NFR-1; DM-7, DM-3 |
| TC-STEER-074 | The `steer` kind and its three rows land with the entries and delivered-row counts moved | Contract | Critical | High | AC-F9-4(a); DM-7; DEC-8; C-7 |
| TC-STEER-075 | The closed allowlist is widened to exactly 59 members by declaration, and near misses fail | Contract | Critical | High | AC-F9-4(a),(d); DM-7; DEC-8 |
| TC-STEER-076 | All 13 Appendix D count pins move, the no-leftover scan is clean, and four surfaces agree | Contract | Critical | High | AC-F9-4(b),(c),(d); DM-7; C-7, C-16; Appendix D |
| TC-STEER-080 | No LLM, network, tracker, provider, timer, socket, session operation, or product literal | Negative | Critical | High | AC-F10-1; NFR-6; DEC-12; NG-4 |
| TC-STEER-081 | Two runs are byte-identical on all four forms; order and identity are permutation-proof | Corner Case | Critical | High | AC-F10-2; NFR-2, NFR-3; DM-3 |
| TC-STEER-082 | The machine and human bounds hold, and every drop is counted in the declared order | Corner Case | Critical | High | AC-F10-3; DM-8; NFR-4; `AMB-TP-1` |
| TC-STEER-083 | The 20-note read batch never loses a note and counts every overflow | Corner Case | Critical | High | AC-F10-3, AC-F3-4; DM-8; NFR-4; `OQ-TP-3` |
| TC-STEER-084 | Write discipline: exactly the declared appends, no edits, and no landing on an unverified append | Contract | Critical | High | AC-F9-2; NFR-5; DM-2; RSK-3 |
| TC-STEER-085 | The declared read set holds per subcommand, with the asks join reusing one ledger read | Corner Case | Critical | High | NFR-8; DM-6; AC-F4-1 |
| TC-STEER-090 | The aggregate quality gate is green before the PR opens | Quality gate | Critical | High | AC-NFR9-1; NFR-9, NFR-10 |
| TC-STEER-091 | Unreceipted-landing control: a landed note with a null receipt member is detected | Negative | Critical | High | AC-F3-1; DM-3; RSK-5; `SC-M2-S5-01` |
| TC-STEER-092 | Silent-outcome control: no note can be queued and invisible, and no unreadable store renders empty | Negative | Critical | High | AC-F3-1, AC-F9-2; DM-2; RSK-3 |
| TC-STEER-093 | Mid-phase interruption control: landing during an open phase fails, and no session op occurs | Negative | Critical | High | AC-F3-3, AC-F10-1; DEC-5, DEC-12; RSK-2 |
| TC-STEER-094 | Artifact-less completion control: a completion recorded without a proving artifact fails | Negative | Critical | High | AC-F6-1, AC-F6-2; F-6; RSK-4 |
| TC-STEER-095 | Schema-fork control: an owner-specific field or an owner-only vocabulary member fails | Negative | Critical | High | AC-F2-1; DM-1; RSK-1 |
| TC-STEER-096 | Mounting-gap control: a missing inventory row, page, or help entry is detected | Negative | Critical | High | AC-F8-1, AC-F8-2; F-8; RSK-8 |

### 5.2 Scenario Details

#### TC-STEER-001 - Bare filing draws every default and derives the origin block in a bound checkout

**Objective**: Prove that a single bare `send` produces one complete, receipt-ready record whose every omitted field was drawn and whose origin was derived from the invoking checkout — asserted field-by-field against the record the store actually holds.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, F-2, DM-1, DEC-6, `SC-M2-S5-01` (origin half)
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-send.test.ts` (new); `tests/fixtures/steer/harness.ts` (new) over `tests/fixtures/projects/production.ts`
**Tags**: @backend, @behaviour

**Preconditions**:
- A real temporary git checkout under a per-test host root with a local PM context binding `GH-298`; injected clock fixed at `T0`; injected id factory returning a deterministic `msg-…` sequence; synthetic brand identity.
- An empty steering store in the checkout's local state scope.

**Steps**:
1. Run `steer send "prefer smaller diffs; split the refactor"` (no flags).
2. Assert the store holds exactly one `steering.message` record; assert its key set is exactly DM-1's eleven keys and no others.
3. Assert `from: "owner"`, `to: "delivery"`, `scope: "repo"`, `kind: "request"`, `priority: "normal"`, `ref: null`, `subject` equal to the filed text, `created` equal to the injected clock.
4. Assert `origin` equals `{change: "GH-298", repo: <invoking repoKey>, agent: "owner"}`.
5. Assert `ttl` is the drawn 24-hour duration and `expiresAt` equals `created + ttl` exactly.
6. Assert `data.schemaVersion` is `delivery.steer.v1`, `data.record` is the record projection including `expiresAt`, `data.lifecycle` is `"queued"`, exit `0`, envelope `ok: true`.

**Expected Outcome**:
- One record, complete on every field, with a derived origin and a drawn default for each omitted field; the answer is the queued projection at exit `0`.
- No second record, no directory other than the steering store touched (tree snapshot compared pre/post within the state scope).

**Notes / Clarifications**:
- Real-checkout cell (`GAP-T1`): a synthetic repo key would not prove derivation.
- The origin half of `SC-M2-S5-01`; the receipt half is `TC-STEER-010`.

#### TC-STEER-002 - An unbound checkout records the bare `null` origin change and still files

**Objective**: Prove the classified absence is recorded rather than refused, so filing outside a bound checkout is still durable evidence.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-1, §12 assumption
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-send.test.ts` (unbound cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A real temporary git checkout with **no** local PM context binding, plus a second cell whose PM context exists but names no work item.

**Steps**:
1. Run `steer send "note from outside a bound change"` in each cell.
2. Assert exit `0` and `data.lifecycle: "queued"` in both.
3. Assert `origin.change` is exactly `null` — not `""`, not `"unknown"`, not the branch name, not the git user; `origin.repo` and `origin.agent` remain populated.
4. Assert the key set still contains `origin.change` (declared absence, never an omitted key and never a reason field such as `changeUnknownReason`).
5. Assert the same run against a **bound** twin yields the bound ref, so the null is attributable to the state and not to a broken derivation.

**Expected Outcome**:
- Filing succeeds with a declared `null`, and the bound twin proves the derivation is live.

#### TC-STEER-003 - Explicit flags override every drawn default and derive `expiresAt` from `created` + `ttl`

**Objective**: Prove the drawn defaults are defaults rather than fixed values, and that `expiresAt` is derived from the stored `created` and `ttl` rather than from wall-clock time.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-1, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-send.test.ts` (override cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A bound checkout; injected clock fixed at `T0`.
- Cells: `--kind escalate`; `--priority urgent`; a non-default `--ttl` within the 30-day cap; `--ref` a 160-char artifact reference; and all four flags together.

**Steps**:
1. Run each cell and assert the stored record carries the supplied value verbatim and the omitted fields still draw their defaults.
2. In the `--ttl` cell assert `expiresAt == created + ttl` and that `expiresAt` does not move when the harness clock is advanced after filing (it is derived, not re-read).
3. In the `--ref` cell assert `ref` is the string (not wrapped, not truncated) at exactly 160 chars.
4. In the all-flags cell assert `kind: "escalate"`, `priority: "urgent"`, the supplied `ttl`/`ref`, `from`/`to`/`scope`/`origin` unchanged.

**Expected Outcome**:
- Every explicit value lands verbatim; every omitted value draws; `expiresAt` is a pure function of the stored record.

#### TC-STEER-004 - Value violations are refused before any state read or write with zero persisted bytes

**Objective**: Prove the validation order is real and the consequence is `not_landed`: a refused filing leaves the store byte-identical and performs no read.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, F-9, DM-8, NFR-5
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-refusals.test.ts` (new); `tests/behaviour/steer-send.test.ts`; `tests/fixtures/steer/cases.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A bound checkout with one pre-existing queued note (so a write would be visible as a second record); a read counter armed on the store seam; a tree snapshot of the state scope.
- Case table: empty text `""`; 161-char text; whitespace-only text; over-cap ttl (> 30 days); the parser's zero/negative ttl form; `--priority critical` (not a member); `--kind notify` (a shared member *outside* the filing subset); `--kind ask` (outside the subset); `--ref` of 161 chars.

**Steps**:
1. Run each case independently against a fresh snapshot.
2. Assert exit `1`, `data.error.code == "input.value.rejected"`, `data.error.category == "user"`, and consequence `not_landed`.
3. Assert the store record count is unchanged, the tree snapshot is byte-identical, and the store **read counter is 0** (the refusal precedes any read).
4. Assert each cell reports exactly one identity (no aggregate or partial identity) and that the failure summary names the offending field without echoing an unbounded value.
5. Assert a valid at-cap twin for each bound (text exactly 160, `--ref` exactly 160, `ttl` exactly 30 days) is **accepted**, so each refusal is attributable to the cap and not to the parser.

**Expected Outcome**:
- Every out-of-range value is refused pre-read, pre-write, with zero persisted bytes; every at-cap twin is accepted.

**Notes / Clarifications**:
- `--ttl` grammar is undeclared (`AMB-TP-3`, `GAP-T5`): the zero/negative cell uses the parser's accepted spelling and asserts the outcome, not the syntax.
- `--kind notify` is the sharpest cell: it is vocabulary-legal and filing-illegal, so it also proves the subset is enforced rather than the vocabulary alone.

#### TC-STEER-005 - Grammar violations refuse before any state read as `fallback.invocation`

**Objective**: Prove broken invocations are classified by the delivered containment identity and never reach the store.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, AC-F9-3, F-9, §8.3 grammar
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-refusals.test.ts` (grammar cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A bound checkout with one queued note; read and append counters armed; a state-scope tree snapshot.

**Steps**:
1. Run each cell: unknown subcommand (`steer collect`); unknown flag (`steer send "x" --urgent`); zero positionals (`steer send`); two positionals (`steer send "a" "b"`); a positional on `list` (`steer list extra`); a positional on `read`; `steer complete` with no id; `steer complete a b --ref r`; a valueless `--ttl`; a valueless `--ref` on `complete`.
2. Assert exit `1`, `data.error.code == "fallback.invocation"`, and that the message names the offending token.
3. Assert store read counter `0`, append counter `0`, tree snapshot byte-identical.
4. Assert no `steer.*` grammar identity exists — the classification is the delivered containment identity (a scan of the emitted code and of the error table).
5. Assert `steer --help` still answers at exit `0` in the same fixture (a grammar refusal must not break the help path).

**Expected Outcome**:
- Grammar refusals are uniform, pre-read, and reuse the delivered identity; refusals never produce an LLM-style free-text diagnosis.

#### TC-STEER-006 - Filing appends exactly one immutable record and ids are unique per store

**Objective**: Prove write minimality and identity: one append per filing, no store rewrite, and per-store-unique `msg-` ids across a burst.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, NFR-5, DM-2, AC-F10-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-records.test.ts` (new); `tests/structure/steer-contract.test.ts` (new) for the id shape
**Tags**: @backend, @behaviour

**Preconditions**:
- A bound checkout; injected clock; id factory that (a) returns a scripted sequence and (b) is exercised with a colliding candidate to prove the store rejects a duplicate rather than overwriting.

**Steps**:
1. Record the store's full byte content and file inventory before filing; file one note; compare after: exactly one file/record added, no other file modified, no line rewritten in an existing record.
2. Run 100 filings with distinct texts and assert 100 records, 100 distinct ids, all matching `msg-` + opaque suffix, and that no pre-existing id was rewritten.
3. Force the id factory to return an already-used id for one filing and assert the append refuses (a store identity collision is never a silent overwrite) with no partial write.
4. Assert a repeated filing of the **same text** appends a second record (idempotence is per note, not per text) and both are independently addressable.
5. Assert the record body contains no `lifecycle`, `rank`, or `age` field (derived values are never stored).

**Expected Outcome**:
- Append-only, one record per filing, unique ids, no derived state stored, and a collision is an error rather than a replacement.

#### TC-STEER-007 - Every record conforms to the one shared message schema with no owner-specific field

**Objective**: Prove the schema is shared rather than owner-shaped: the key set is closed, the vocabularies are the shared closed sets, and a non-owner message validates through the same validator with no owner branch.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DM-1, DEC-2
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/steer-contract.test.ts` (new); `tests/behaviour/steer-records.test.ts` (non-owner cell)
**Tags**: @backend, @contract

**Preconditions**:
- The exported schema/validator and the four exported closed-vocabulary constants imported directly from the contracts tier.

**Steps**:
1. Assert the schema declares exactly the eleven DM-1 fields with declared types, and that no field name matches an owner-specific shape (`ownerNote`, `steeredBy`, `steeringText`, `sessionId`, `steeringPriority`).
2. Assert the four vocabularies equal the shared closed sets exactly, in both directions: `scope` = `session|change|repo|fleet`; `kind` = `ask|answer|notify|request|escalate|report|heartbeat`; `priority` = `low|normal|high|urgent`; and the origin `agent` axis is open-ended but the S5 value is the declared `owner`.
3. Assert each closed set is declared **once** in contract data (imported by the validator, the CLI and the tests from the same module — no second literal copy).
4. Feed the validator a non-owner-issued record — `from: "coordinator"`, `to: "delivery"`, `scope: "change"`, `kind: "ask"`, with an origin whose `agent` is not `owner` — and assert it **validates**, and that the accepted record carries no field the owner record lacks (same key set).
5. Feed the validator malformed variants (missing `ttl`, `ttl` non-positive, unknown `priority`, unknown `scope`, `subject` of 161 chars) and assert each is rejected naming the field.

**Expected Outcome**:
- One schema, one set of vocabularies, a non-owner record accepted with no branch, and malformed records rejected by name.

**Notes / Clarifications**:
- This is ticket AC-3's executable form; no case **writes** a non-owner record through a CLI surface (NG-2).

#### TC-STEER-008 - The filing subset is a declared restriction of the shared vocabularies, not a fork

**Objective**: Prove the S5 admission set is data derived from shared vocabularies, so removing a shared member breaks the subset rather than silently creating a second schema.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DM-1, DEC-2
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/steer-contract.test.ts`; `tests/checks/steer-mutants.test.ts` (new) for the mutation arm
**Tags**: @backend, @contract

**Preconditions**:
- Exported filing-subset declaration and the shared vocabularies.

**Steps**:
1. Assert the subset is exactly `kind ∈ {request, escalate}`, `scope = repo`, `from = owner`, `to = delivery`, and that it is declared as a *selection* over the shared sets (every member's value is present in its parent vocabulary — asserted by set inclusion, both directions where the parent is enumerated).
2. Assert no second schema object exists: the appended record validates against the **shared** validator, not a filing-only validator (grep/AST-level import assertion plus a runtime validation of a filed record through the shared entry point).
3. Mutation arm (temporary tree copy): add an owner-only vocabulary member (`kind: "steer"`) to the filing subset without adding it to the shared vocabulary → the structure test fails naming the illegal member.
4. Mutation arm: add an owner-specific field to the record type → validation fails naming the field (paired with `TC-STEER-095`).
5. Mutation arm: add a member to the shared `kind` vocabulary → the subset test still passes (the subset is a restriction, so shared growth is legal) while a filing of the new kind is still refused — proving the two sets are related but not conflated.

**Expected Outcome**:
- The subset is a restriction over shared data; illegal narrowing and illegal field additions fail, and legal shared growth does not accidentally widen filing.

#### TC-STEER-010 - A due note lands at a boundary-open read with a complete receipt (`SC-M2-S5-01`)

**Objective**: Prove the seed's receipt: a due note at a boundary-open read lands with non-null `origin`, `readReceipt`, and `ttl`, and exactly one outcome record appends.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DM-2, DM-3, DEC-5, DEC-12, `SC-M2-S5-01`
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-landing.test.ts` (new); `tests/fixtures/steer/phase-boundary.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A bound checkout with one queued note (`created = T0`, ttl 24 h, clock at `T0 + 1h`), **no phase record**; a spawned-process/session recorder armed; `.git` ref state and branch name captured; a state-scope tree snapshot.

**Steps**:
1. Run `steer read`.
2. Assert exit `0`, `data.schemaVersion == "delivery.steer.v1"`, `data.boundary.open == true`, `data.boundary.phase == null`, `data.boundary.phaseUnknownReason == "phase-unrecorded"`.
3. Assert `data.applied == true`, `data.notes` has exactly one row with `lifecycle: "landed"`, `applied: true`.
4. Assert `notes[0].receipt` is present and `receipt.origin`, `receipt.readReceipt` (with `at` and `boundary` both non-null), `receipt.ttl`, and `receipt.expiresAt` are all non-null (`SC-M2-S5-01`'s `data.receipt` path per Appendix C).
5. Assert exactly one `steering.outcome` record appended, carrying the read timestamp, boundary context, and recorded ttl; the message record is unchanged byte-for-byte.
6. Assert the session recorder has zero entries, the branch and refs are unchanged, and the pre-existing evidence files are byte-identical.

**Expected Outcome**:
- A landed note with a complete receipt, one outcome record, and an untouched session, branch, and evidence trail.

**Notes / Clarifications**:
- Seed case: `SC-M2-S5-01` is satisfied only together with `TC-STEER-091`'s completeness control (no landed note anywhere carries a null member).

#### TC-STEER-011 - The second boundary-open route: every recorded entry completed, `phase` = latest completed

**Objective**: Prove the boundary condition is derived from the delivered phase fold in both open routes, and that the reported `phase` is the latest completed entry rather than any completed entry.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DM-3, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-landing.test.ts` (open-route cells); `tests/fixtures/steer/phase-boundary.ts`
**Tags**: @backend, @behaviour

**Preconditions**:
- Delivered phase-state fixtures: (a) a record with three completed entries in lifecycle order; (b) a record with completed entries interspersed with a reopened-then-completed entry; (c) the same record with the *last* entry in progress (closed — asserted in `TC-STEER-013`).

**Steps**:
1. Run `steer read` in cell (a): assert `boundary.open == true`, `boundary.phase` equals the **latest** completed entry's id, no `phaseUnknownReason` key present.
2. Assert the due note lands and one outcome record appends.
3. In cell (b) assert the reopened-then-completed entry is treated as completed (the delivered fold's semantics, not a naive max) and `phase` is still the latest completed entry.
4. Assert reordering the delivered fixture's file entries does not change the derived `phase` (the fold is semantic, not file-order dependent).
5. Assert a read with **no** due notes in cell (a) still reports the same `boundary` block with `applied: false` and no outcome record.

**Expected Outcome**:
- Both open routes derive from the delivered fold; `phase` names the latest completed entry; file order is irrelevant.

#### TC-STEER-012 - TTL elapsed before a boundary records a classified non-applied outcome (`SC-M2-S5-02`)

**Objective**: Prove the seed: an elapsed note is not applied, the payload reports `applied: false` and the `ttl-elapsed` reason, one expiry record appends, and nothing else mutates.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, F-3, DM-3, DEC-7, `SC-M2-S5-02`
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-expiry.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- One queued note (`created = T0`, ttl 24 h) and the injected clock at `T0 + 24h` (exact boundary); another cell at `T0 + 25h`.
- Boundary-open (no phase record); full state-scope tree snapshot; session recorder armed.

**Steps**:
1. Run `steer read`.
2. Assert exit `0`, `data.applied == false`, `data.expiry.reason == "ttl-elapsed"` (`SC-M2-S5-02`).
3. Assert `notes[0].applied == false`, `notes[0].lifecycle == "expired"`, `notes[0].expiry` present with `reason: "ttl-elapsed"` and a `recordedAt` equal to the injected clock, and **no** `receipt` key.
4. Assert exactly one `steering.outcome` record of the expiry kind appended; the message record unchanged; no completion record.
5. Assert nothing else in the state scope mutated, the branch is unchanged, and the session recorder is empty (course unchanged).
6. Repeat the read and assert no second outcome record appends and the displayed expiry is stable.

**Expected Outcome**:
- The note is classified non-applied with a recorded reason, exactly once, and the delivery continues on its previous course.

#### TC-STEER-013 - A boundary-closed read declines without applying or appending anything

**Objective**: Prove the read point cannot interrupt: with a phase in progress, every note reads pending and the store is untouched.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, DM-3, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-boundary-closed.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A phase record with one entry `began` and not completed; three queued notes (one due, one near expiry, one `escalate`); state-scope tree snapshot; session recorder armed; store append counter armed.

**Steps**:
1. Run `steer read`.
2. Assert exit `0`, `data.boundary.open == false`, `data.boundary.phase` equal to the in-progress entry's id.
3. Assert every note carries `applied: false`, `lifecycle: "queued"`, `pendingReason: "phase-in-progress"`, and no `receipt` and no `expiry` key.
4. Assert `data.applied == false`, no `data.expiry` key, append counter `0`, tree snapshot byte-identical.
5. Advance the clock past every note's ttl and repeat: still `open == false`, still no append — a closed boundary takes precedence over expiry (nothing is resolved off-boundary).
6. Assert `asks[]` is still present and populated (the decision-point view survives the decline).

**Expected Outcome**:
- The read declines, renders the pending reason per note, writes nothing, and resolves nothing off-boundary.

#### TC-STEER-014 - Due notes land in one batch in the shared rank order, one receipt each

**Objective**: Prove batched landing in rank order — not one-at-a-time, not store order — with a receipt per note and `data.applied` true.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, F-3, F-5, DM-3, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-landing.test.ts` (batch cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Five due notes with a deliberate priority/time/id matrix: `urgent` newest, `high` two, `normal` oldest, `escalate` kind mixed in; store return order and directory order deliberately reversed relative to rank.

**Steps**:
1. Run `steer read` **once** and assert all five notes appear in a single `data.notes` array with `applied: true` and `data.applied == true`.
2. Assert the array order equals the expected rank permutation (priority class, then `created` ascending, then `id` ascending), not the store's returned order.
3. Assert each row carries its own `receipt` with non-null `origin`, `readReceipt`, `ttl`; assert receipts are distinct (different `at`/boundary rows are allowed to share a timestamp but not a note identity).
4. Assert exactly five outcome records append, one per note, and the batch is not split across invocations (no second `read` is needed to complete the batch).
5. Assert the payload reports no `omitted`/`truncated` for a five-note population (well inside the 20-note cap).

**Expected Outcome**:
- One batched landing, rank-ordered, receipted per note, with one outcome record each.

#### TC-STEER-015 - An immediate repeat read lands nothing, appends nothing, and reports `applied: false`

**Objective**: Prove idempotence in effect: the read point is safe to call repeatedly, so a delivery can call it at every boundary without double-applying.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-5, F-3, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-idempotency.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A fixture where a first read lands two due notes and expires one (three outcomes appended in total); clock, clock unchanged afterwards.

**Steps**:
1. Capture the store record count and bytes after the first read.
2. Run `steer read` again immediately.
3. Assert exit `0`, `data.applied == false`, `data.notes` is empty (no due notes), no `data.expiry` key, append counter `0`, record count and bytes unchanged.
4. Run a third time and assert byte-identical output to the second run (determinism over unchanged facts, `NFR-2`).
5. Advance the clock past a **new** note's ttl, file nothing, and assert the second read still lands nothing (there is nothing new to transition).

**Expected Outcome**:
- Repeat reads are inert and byte-stable; a landing is never repeated.

#### TC-STEER-016 - A resolved note is never re-resolved; at most one outcome record per note

**Objective**: Prove the per-note outcome cardinality: one outcome per note ever, only for notes transitioning in that read, so mixed reads append exactly the transitions.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-5, NFR-5, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-idempotency.test.ts` (cardinality cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Five notes: two already landed (pre-seeded outcomes), one already expired (pre-seeded), one due, one elapsed.

**Steps**:
1. Run `steer read` and assert exactly **two** outcome records append (the due one applied, the elapsed one expired) — the three pre-resolved notes append nothing.
2. Assert the pre-resolved notes are still visible in the payload (as landed/expired rows) without a second outcome.
3. Run again and assert zero appends.
4. Assert that no note holds two outcomes of the same kind by scanning the store: `outcomeCount(noteId)` ∈ {0, 1} for every note.
5. Test the sharp edge: a note whose outcome exists but whose message is *also* still due-shaped (a hand-seeded inconsistency) is treated as resolved by the derived fold, not re-landed, and the case reports the inconsistency rather than silently re-applying.

**Expected Outcome**:
- Transitions only, one outcome per note ever, and an inconsistent store resolves conservatively rather than double-applying.

#### TC-STEER-017 - TTL judgement is exactly `now >= created + ttl` on the injected clock

**Objective**: Prove the inclusive boundary is the delivered convention and that it is evaluated only at a read, on the injected clock.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, NFR-7, DM-5
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-expiry.test.ts` (boundary cells); `tests/structure/steer-contract.test.ts` for the pure predicate
**Tags**: @backend, @unit

**Preconditions**:
- A fixed clock and a note with `created = T0`, `ttl = 24h`.
- Cells: `now = T0 + 24h − 1ms`; `now = T0 + 24h`; `now = T0 + 24h + 1ms`.

**Steps**:
1. Assert the pure TTL predicate returns "not elapsed" at `−1ms`, "elapsed" exactly at `+0`, and "elapsed" at `+1ms` (inclusive lower edge).
2. Run `steer read` in each cell and assert the resulting classification matches the predicate (landed / expired / expired).
3. Assert the judgement uses the injected clock: run the same fixture twice with the harness clock unchanged and assert identical classification, then shift the clock only and assert the classification changes.
4. Assert filing does **not** judge TTL (a filing at `now > created + ttl` — impossible for a fresh record but exercised by a hand-seeded stale record — still appends: expiry is a read-time classification, not a write-time refusal).
5. Assert no ambient `Date.now()` is consulted by the pure domain (injected-clock lint/AST assertion shared with `TC-STEER-020`).

**Expected Outcome**:
- One inclusive boundary, evaluated at read time only, reproducible from a fixed clock.

#### TC-STEER-018 - The payload totals are total over empty, all-expired, mixed, and pending reads

**Objective**: Prove `data.applied` and `data.expiry.reason` are total functions of the batch (DEC-7), so a mixed read is unambiguous and the seed's fields cannot be satisfied by accident.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, DM-3, DEC-7, `SC-M2-S5-02`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-expiry.test.ts` (totals matrix)
**Tags**: @backend, @behaviour

**Preconditions**:
- Four fixtures: empty queue; one elapsed note; one due + one elapsed; a closed boundary with one due and one elapsed (no phase record / in-progress phase record respectively).

**Steps**:
1. Empty queue: `applied == false`, `notes == []`, **no** `data.expiry` key, boundary block present, exit `0`.
2. All-expired: `applied == false`, `data.expiry.reason == "ttl-elapsed"`, one row with `applied: false`.
3. Mixed: `applied == true` (at least one landed) **and** `data.expiry.reason == "ttl-elapsed"` present, with per-note `applied` `true`/`false` respectively — the exact case DEC-7 says must be unambiguous.
4. Pending (closed boundary): `applied == false`, no `data.expiry` key, every row carries `pendingReason`.
5. Assert the presence rule as a set: `data.expiry` is present ⟺ at least one note expired, across all four fixtures (a table-driven assertion over the collected fixtures).

**Expected Outcome**:
- Both payload-level fields are total and unambiguous over all four shapes; the mixed case is `applied: true` with a payload expiry.

#### TC-STEER-020 - `age` is computed from the injected clock on every surface and never read from storage

**Objective**: Prove aging is measured, not recorded: every surface derives `age` from the injected clock and a planted stored age cannot influence it.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, NFR-7, DM-5
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-aging-rank.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A note with `created = T0`; clock at `T0 + 90_000` ms.
- A hand-seeded store variant in which the message record carries an extra `age: 1` field (the "bogus stored age" bait — accepted on read as inert data, ignored by derivation).

**Steps**:
1. Assert `send`'s answer carries `age` for the just-filed note as `0` (clock equal to `created`) and `notes`/`rows` on `list`, `read`, and `complete` carry `age == 90_000` for the same note at `T0 + 90s`.
2. Advance the injected clock by 30 s and assert every surface's `age` moves by exactly 30 000 with the store untouched (byte-identical store, append counter 0).
3. Assert the bogus stored `age: 1` changes nothing: the rendered `age` is still `90_000`, and the store's extra field is neither trusted nor re-written.
4. Assert `age` is a non-negative integer of milliseconds and never a formatted duration on the machine surface (human text may format; `data` stays numeric).
5. Assert the pure aging function takes `(now, created)` and imports no clock (AST/injected-clock assertion).

**Expected Outcome**:
- One derivation, four surfaces, clock-driven, storage-independent.

#### TC-STEER-021 - The shared rank orders rows and assigns contiguous `1..N` ranks before caps

**Objective**: Prove the rank is the declared key with the declared tie-breaks and that ranks are contiguous over the full set, not per group or per page.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, NFR-3, DM-5, DEC-11
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-aging-rank.test.ts` (rank matrix); `tests/structure/steer-contract.test.ts` for the class map
**Tags**: @backend, @behaviour

**Preconditions**:
- A matrix fixture: 4 priorities × 3 creation times, plus two notes with identical class and identical `created` and near-identical ids (id-ascending tie-break).

**Steps**:
1. Assert the exported class map is exactly `urgent=1, high=2, normal=3, low=4` (both directions).
2. Assert the emitted order equals the expected permutation for the 12-note matrix (computed independently in the fixture, not from the implementation's comparator).
3. Assert the id tie-break: the two identical-timestamp notes order by `id` ascending, and swapping their store order does not change the emitted order.
4. Assert `rank` values are exactly `1..N` with no gap and no duplicate, over the **full** ranked set (12).
5. Assert ranks are assigned before any cap: with 12 notes and a group cap of 8 (`TC-STEER-024`), the visible rows keep their full-set ranks rather than being renumbered `1..8`.

**Expected Outcome**:
- The declared order, the declared tie-breaks, and contiguous full-set ranks.

#### TC-STEER-022 - Order is derived at every read, never stored, and immune to store order

**Objective**: Prove resequencing is a view property: no record carries a rank, and permuting every input order source cannot change the output.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, AC-F10-2, NFR-2, DEC-11
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-aging-rank.test.ts` (permutation cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- One canonical fixture (six notes, three asks, three lifecycle groups) and its permutations: reversed store rows, reversed directory read order, reversed ledger order, reversed ask order.

**Steps**:
1. Assert no stored record carries `rank`, `age`, or a stored lifecycle field (byte scan of every record in the store).
2. Run all four permutations and assert byte-identical human text and byte-identical `data` (timing/run id excluded) against the canonical run.
3. Assert the store is byte-identical after every run (no materialisation of the derived order).
4. Mutation arm (temporary tree copy): make the comparator fall back to store index → the permutation case fails, proving the assertion is load-bearing.
5. Mutation arm: write the computed `rank` into the record on append → the "no stored rank" scan fails.

**Expected Outcome**:
- Derived order only; permutations are invisible; two mutants are detected.

#### TC-STEER-023 - The list view renders queued, landed, and expired side by side with receipts and reasons

**Objective**: Prove the journey's step-4 outcome on the steering surface: one view where a queued, a landed, and an expired note are all auditable together.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DM-4, DEC-1
**Test Type(s)**: Integration, Contract, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-list.test.ts` (new); `tests/golden/steer.test.ts` (new) + `tests/fixtures/steer/golden/list.txt|list.json`
**Tags**: @backend, @behaviour

**Preconditions**:
- Three notes in three lifecycles: one queued, one landed with a receipt, one expired with a `ttl-elapsed` reason; a fourth landed-and-completed note.

**Steps**:
1. Run `steer list` and assert the three groups exist in the declared order `queued`, `landed`, `expired`, each with its rows.
2. Assert the landed row carries `receipt.origin`, `receipt.readReceipt`, `receipt.ttl`, and `completedWith` (`null` for the uncompleted one, the artifact string for the completed one).
3. Assert the expired row carries `expiry.reason: "ttl-elapsed"` and `expiry.recordedAt`, and **no** `receipt`.
4. Assert each row carries the shared note fields plus `age` and `rank`; assert the completed note appears **only** under landed.
5. Assert the human text keeps the group labels and shows, per row, the lifecycle marker plus reason/`completedWith` where applicable; compare against the committed golden (new artifact, created in this change).
6. Assert exit `0`, `schemaVersion` `delivery.steer.v1`, and `omitted: 0`, `truncated: false`.

**Expected Outcome**:
- An auditable side-by-side record with receipts, expiry reasons, completion markers, ages, and ranks.

#### TC-STEER-024 - The list caps each group at 8 rows with every omission counted

**Objective**: Prove the view is bounded without implying completeness: 8 rows per group, `omitted` counted, `truncated` set, and the human marker agrees with the machine count.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-2, AC-F10-3, DM-8, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-bounds.test.ts` (new) or `steer-list.test.ts` (cap cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- 9 queued, 9 landed, 9 expired (27 notes); plus an 8/8/8 at-cap twin.

**Steps**:
1. At-cap twin: `queued.length == 8`, `landed.length == 8`, `expired.length == 8`, `omitted == 0`, `truncated == false`.
2. Over-cap: each group renders exactly 8 rows (the first 8 by rank), `omitted == 3`, `truncated == true`.
3. Assert the visible rows keep their full-set ranks (`1..8` here, with rank 9 dropped — ranks are not renumbered).
4. Assert the human text's `+N more` marker per group equals the machine omission split (a per-group cross-check, so a silent drop is not hidden behind a total).
5. Mutation arm: drop a row without incrementing `omitted` → the omission-arithmetic assertion fails.

**Expected Outcome**:
- A bounded, counted view; a silent drop is red.

#### TC-STEER-025 - A completed note stays under landed with `completedWith` and never duplicates into queued

**Objective**: Prove derived lifecycle: completion adds a marker, not a state, so a completed note is not a fourth group and not a queued row.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-2, AC-F6-1, DM-2, DM-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-list.test.ts` (completion cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A landed note with one completion record; a landed note without one.

**Steps**:
1. Assert both rows are in `landed[]`; the completed one carries `completedWith: <artifact>`, the other `completedWith: null`.
2. Assert `queued[]` does not contain the completed note and no fourth group exists (`Object.keys(data)` contains exactly the declared row groups plus `schemaVersion`, `omitted`, `truncated`).
3. Assert the completed row's `receipt` is unchanged by completion (the completion is additive, not a re-landing).
4. Assert a completion of an expired note is impossible (`TC-STEER-042`) and therefore no expired row ever carries `completedWith`.

**Expected Outcome**:
- Three groups, completion as a derived marker, no duplication.

#### TC-STEER-030 - `asks[]` is the delivered open-question view verbatim with age and the drawn-default join

**Objective**: Prove the read point is a decision point: the payload carries the delivered ask projection with measured age and the delivered PDR-0003 join, composed rather than re-derived.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-6, PDR-0003, NG-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-asks.test.ts` (new); reuses `tests/fixtures/blockers/{harness,ranking}.ts`
**Tags**: @backend, @behaviour

**Preconditions**:
- The delivered blocker ledger seeded with two open `owner`-audience questions on refs with defaultable gates, one 26 h old and one 3 h old; injected clock fixed.
- A boundary-open read with one due note (so notes and asks appear in one payload).

**Steps**:
1. Run `steer read` and assert `data.asks` has exactly the two owner asks.
2. Assert each ask carries `id`, the delivered closed `type`, `ref` (string or bare `null`), `lane`, bounded `question`, `askedAt`, measured `age`, `drawnDefault`, `defaultState`, and `rank`.
3. Assert `age == clockNow − askedAt` for each, and that ages differ exactly by the seeded delta.
4. Assert the ask values are **equal** to the delivered open-question view's output for the same fixture (same-process comparison, field by field) — no second ranking and no re-derived default.
5. Assert the delivered rank order holds and that a note and an ask in the same payload are independently ordered (notes by DM-5, asks by the delivered rank).
6. Assert the read appended no decision/ledger record and `asks` is present on a boundary-**closed** read too (the §8.3 shape declares `asks` unconditionally).

**Expected Outcome**:
- One payload where course corrections and open asks meet, with the delivered projection reproduced verbatim plus measured age.

#### TC-STEER-031 - The join is declared for `none`, `pending`, and `applied`, and a bare default is `null`

**Objective**: Prove the join is total: every `defaultState` is declared, an undefaultable ref is a declared `null`, and no default is fabricated.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-6, PDR-0003
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-asks.test.ts` (join cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Three owner asks: (a) on a ref with a defaultable `waiver` gate and no decision record → `pending`; (b) on the same ref with a pre-seeded decision record → `applied`; (c) on a ref with no defaultable gate → `none` with `drawnDefault: null`.

**Steps**:
1. Assert cell (a) `defaultState: "pending"` with `drawnDefault` equal to the PDR-0003 policy default for that gate.
2. Assert cell (b) `defaultState: "applied"` with the same `drawnDefault`.
3. Assert cell (c) `defaultState: "none"` **and** `drawnDefault: null` — the key present, never omitted, never a `""`, never an invented default.
4. Assert a ref-less question carries the delivered bare `ref: null` with no absence-reason field invented by steer.
5. Assert the payload contains no second default mechanism: no steer-specific default table is imported by the read path (module/AST assertion), and changing the PDR-0003 map in the fixture changes `drawnDefault` (the map is the only source).

**Expected Outcome**:
- Three declared join states, a declared `null`, and one policy source.

#### TC-STEER-032 - Coordinator questions are excluded, the asks cap holds, and the join writes no ledger row

**Objective**: Prove the join is read-only and audience-scoped: coordinator questions never become asks, the cap is the delivered one, and no write occurs.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-6, NG-8, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-asks.test.ts` (exclusion + write-audit cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Ledger seeded with 3 `coordinator`-audience questions, 2 `owner` questions, 1 answered owner question, and 10 further open owner questions (12 owner-audience open total).
- A tree snapshot of the ledger store and a write-recorder on the ledger port.

**Steps**:
1. Assert no `coordinator` question appears in `asks[]` (matched by id), and no answered/closed question appears.
2. Assert `asks.length == 8` (the delivered cap) with the delivered ranking's first 8, and the omission surfaced per the delivered bounds contract.
3. Assert the ledger write recorder has zero appends and the ledger store is byte-identical after the read.
4. Assert the ledger is read **once** (counter `1`) for the whole payload — no second history read for the join.
5. Assert `data.asks` carries no steer-specific key (no `steerPriority`, no `appliedBySteer`) — the row shape is the delivered one plus `age`/`drawnDefault`/`defaultState`/`rank`.

**Expected Outcome**:
- Owner-audience only, delivered cap and order, zero writes, one read.

#### TC-STEER-040 - A landed note completes against an artifact ref and the completion is append-only

**Objective**: Prove the ack→complete workflow: one completion record carrying the proving artifact, a derived `completed` lifecycle, and no rewrite of the landed evidence.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-2, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-complete.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A landed note (receipt present); clock at `T1`; the receipt's recorded ttl/at values captured; a state-scope snapshot.

**Steps**:
1. Run `steer complete <id> --ref "doc/changes/.../chg-GH-298-plan.yaml"`.
2. Assert exit `0`, `data.record.id == <id>`, `data.record.lifecycle == "completed"`, `data.record.completedAt ==` injected clock, `data.record.artifact` == the supplied ref.
3. Assert exactly one `steering.completion` record appended, carrying the artifact and timestamp, and that the message and outcome records are byte-identical to before.
4. Assert `steer list` shows the row under `landed[]` with `completedWith` set (`TC-STEER-025`).
5. Assert the completed note still reads as landed (not expired, not queued) and that its receipt is unchanged.

**Expected Outcome**:
- One append, a derived completed lifecycle, and unchanged evidence.

#### TC-STEER-041 - The first completion is authoritative and a repeat completion appends nothing

**Objective**: Prove completion is final: a second attempt is refused at exit `1` and the original artifact is never replaced.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-complete.test.ts` (repeat cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A note completed with artifact `A`; store record count and bytes captured.

**Steps**:
1. Run `steer complete <id> --ref "B"`.
2. Assert exit `1`, `data.error.code == "input.value.rejected"`, consequence `not_landed`, and a failure summary naming the already-completed condition.
3. Assert record count and bytes are unchanged and the artifact remains `A` on the list surface.
4. Assert the same refusal for an immediate identical retry (`--ref A`) — idempotence is a refusal, not a silent success that would hide a caller bug.
5. Assert a completion of a **different** landed note still succeeds in the same run (the refusal is scoped to the note).

**Expected Outcome**:
- Refused, unchanged, first-completion-authoritative, and scoped.

#### TC-STEER-042 - Never-landed, expired, artifact-less, and over-cap-ref completions are refused before any write

**Objective**: Prove completion cannot manufacture evidence: no read receipt or no proving artifact means no record.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, F-9, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-complete.test.ts` (refusal matrix)
**Tags**: @backend, @behaviour

**Preconditions**:
- Four notes: one queued (never landed), one expired, one landed, plus a landed cell used twice for the `--ref` cases; append counter and tree snapshot armed.

**Steps**:
1. `complete` a queued note → exit `1`, `input.value.rejected`, `not_landed`, append `0`.
2. `complete` an expired note → same refusal; assert the note remains expired on `list` and never gains `completedWith`.
3. `complete` a landed note **without** `--ref` → exit `1`, `input.value.rejected`, append `0`.
4. `complete` a landed note with a 161-char `--ref` → exit `1`, `input.value.rejected`, append `0` (the DM-8 ref cap applies on this path too).
5. `complete` a landed note with an empty `--ref ""` → refused identically.
6. Assert the tree snapshot is byte-identical across all five cells, and assert a valid twin (`landed` + 160-char ref) **succeeds**, so each refusal is attributable to its stated condition.

**Expected Outcome**:
- Zero artifact-less or receipt-less completions recorded; every refusal pre-write; each cell has an accepting twin.

#### TC-STEER-050 - A registered secret value in the note text is refused with zero persisted bytes

**Objective**: Prove the content path is guarded before any byte lands, with the classified identity and no partial write.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DM-7, TDR-0012
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-credentials.test.ts` (new); reuses `tests/fixtures/credentials/cases.ts`
**Tags**: @backend, @security

**Preconditions**:
- The delivered registered-secrets record seeded with a sentinel value (`S3CR3T-SENTINEL-...#` style from the delivered fixture table, exact value read from the fixture, not restated here).
- A store read/append counter and a state-scope tree snapshot.

**Steps**:
1. Run `steer send "<text containing the registered value>"`.
2. Assert exit `1`, `data.error.code == "steer.credential-value-rejected"`, category `user`, consequence `not_landed`.
3. Assert the store record count and bytes are unchanged: zero persisted bytes.
4. Assert the refusal payload contains neither the sentinel nor any fragment of it (a substring scan of the serialized envelope and of the human text).
5. Assert a benign twin with the same shape but an unregistered value is **accepted** (proving the guard is value-based, not shape-based; sharpened in `TC-STEER-053`).

**Expected Outcome**:
- The registered value cannot enter the store, the refusal is classified, zero bytes persist, and the payload leaks nothing.

#### TC-STEER-051 - A registered secret value in `--ref` is refused with zero persisted bytes

**Objective**: Prove the identifier path (the artifact ref) is guarded exactly like the content path.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-credentials.test.ts` (ref cells)
**Tags**: @backend, @security

**Preconditions**:
- Registered-secrets record seeded; a landed note for the completion path; counters and snapshot armed.

**Steps**:
1. `send "<benign>" --ref "<registered value>"` → exit `1`, `steer.credential-value-rejected`, `not_landed`, zero bytes persisted.
2. `complete <landed-id> --ref "<registered value>"` → the same identity and exit; assert **no** completion record appended and the landed receipt unchanged.
3. Assert a completion with a benign ref still succeeds immediately afterwards (the guard did not poison the note).
4. Assert neither refusal payload echoes the value (substring scan).

**Expected Outcome**:
- The ref path is guarded on both subcommands that accept it, with zero persisted bytes and no side effects.

#### TC-STEER-052 - A registered secret value in a derived origin value is refused on the identifier path

**Objective**: Prove the guard covers values the owner never typed — a repository key or bound ref containing a registered value — so derivation cannot become a leak path.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-credentials.test.ts` (origin cells); real-checkout harness
**Tags**: @backend, @security

**Preconditions**:
- A real temporary checkout whose repository key (directory-derived key) contains the registered sentinel, and a second cell whose local PM context binds a change ref containing the sentinel.
- Registered-secrets record seeded; snapshot armed.

**Steps**:
1. `steer send "<benign text>"` in each cell → exit `1`, `steer.credential-value-rejected`, `not_landed`, zero persisted bytes.
2. Assert the refusal names the origin path as the offending field (in the failure detail) without echoing the value.
3. Assert the guard runs **before** the append (append counter `0`) and after derivation (i.e. the derived value is what is matched, not the pre-derivation input).
4. Assert a twin checkout with a benign key files successfully — proving the refusal is attributable to the derived value.

**Expected Outcome**:
- Derived values are guarded; derivation is not a bypass; the benign twin proves attribution.

#### TC-STEER-053 - An unregistered token-shaped value is accepted, and no refusal payload leaks a secret

**Objective**: Prove the TDR-0012 boundary exactly: registered-value matching and no pattern layer, with a positive twin that would fail if a pattern scan existed.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, TDR-0012
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-credentials.test.ts` (boundary cells); `tests/structure/steer-contract.test.ts` (no-pattern assertion)
**Tags**: @backend, @security

**Preconditions**:
- Registered-secrets record seeded with exactly one sentinel; a table of token-shaped but **unregistered** values (an `ghp_`-prefixed string, an AWS-style key id, a JWT-shaped triple, a `sk-`-prefixed string), all synthetic.

**Steps**:
1. File each token-shaped unregistered value in the note text and in `--ref`; assert every one is **accepted** (exit `0`, record appended) — the positive twin that proves no pattern layer.
2. Assert the registered sentinel in the same positions is still refused (the guard is live in the same fixture).
3. Assert the refusal path emits no redaction marker for a value that was never registered, and that the success payload echoes the unregistered value verbatim (no silent redaction).
4. Structural: assert the guard module's dependency set contains the registered-secrets record and **no** token-pattern table, regex registry, or entropy heuristic.
5. Assert the guard consumes the same registered-secrets record the serialization redaction chokepoint consumes (one source, asserted by identity of the injected record, not by a second copy).

**Expected Outcome**:
- Value-based guard only; a pattern-scan implementation fails this case; the payload never leaks the registered value.

#### TC-STEER-060 - `steer` joins the prompt-required set, is composed unconditionally, and appears in root help

**Objective**: Prove the family is reachable: registered, composed without a test-supplied runtime, and advertised — asserted as a tree invariant so the assertion is correct regardless of the family-count arithmetic.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, DEC-9, `OQ-TP-1`
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/steer-mounting.test.ts` (new); `tests/behaviour/steer-help.test.ts` (new); extends `tests/structure/board-mounting.test.ts`, `tests/structure/events-production-composition.test.ts`, `tests/structure/dispatch-attempts-composition.test.ts`, `tests/structure/daemon-production-composition.test.ts`, `tests/structure/entrypoint-bin.test.ts`
**Tags**: @backend, @contract

**Preconditions**:
- The production composer over a temp host root, with **no** test-supplied steer runtime.

**Steps**:
1. Assert `PROMPT_REQUIRED_COMMANDS` contains exactly one `steer` entry and that the set equals `[...deliveredSet, "steer"]` where `deliveredSet` is captured as the pre-change list constant in the fixture (so the assertion states *the delta*, not a hardcoded total).
2. Assert the registered count equals `PROMPT_REQUIRED_COMMANDS.length` (self-consistent) and that the count assertions in the five composition suites are moved to that same value — a single declared expectation, not five independent literals.
3. Assert `createProductionComposer` produces a `steer` handler with no runtime injected, and that the handler answers (a `steer list` over an empty store returns exit `0` with empty groups).
4. Assert root `--help` lists `steer` and that the rendered family-line count equals `PROMPT_REQUIRED_COMMANDS.length`.
5. Assert every previously delivered family is still present, in order, with `steer` appended (no reordering of the delivered list).

**Expected Outcome**:
- `steer` is registered, composed, and advertised; the count is asserted as the delivered set plus one.

**Notes / Clarifications**:
- `OQ-TP-1`: base `cfb0ce8d` already has 22 families (GH-296 ceremony), so a literal "22 families" assertion would fail on a correct mount. This case asserts the tree-invariant delta; the spec's arithmetic (§4.1, §8.5, DEC-9, §16.1, AC-F8-1, DoD-12) is reported for reopening.

#### TC-STEER-061 - `steer --help` and `--version` answer at exit 0 with the five declared sections and no side effect

**Objective**: Prove the family's help is complete and inert: it reads no store, git, config, or network.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F8-1, F-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-help.test.ts`
**Tags**: @backend, @behaviour

**Preconditions**:
- An environment with **no** state directory, no git repository, no credentials, and counters armed on store, git, transport, and spawn seams.

**Steps**:
1. Run `steer --help`; assert exit `0`, and that the text contains the command summary, usage line, options (all four subcommands and the five flags), at least one example per subcommand, the exit-code table (`0`/`1`/`2` with meanings), and a see-also pointer.
2. Run `steer --version`; assert exit `0` and the brand-seam version token (no hardcoded product name).
3. Assert every counter is `0` and nothing was created on disk.
4. Run `steer help send`-style subcommand help if the delivered help inventory serves per-subcommand forms; assert it answers at exit `0` with that subcommand's usage (skip-with-failure-naming rather than silently if the delivered pattern has no such form).
5. Assert the help text names no subcommand outside the four (`collect`, `poll`, `deliver`, `ack` must not appear as commands).

**Expected Outcome**:
- Complete, inert, brand-neutral help with the five declared sections and no invented verbs.

#### TC-STEER-062 - The reference page and the coverage-inventory row satisfy the help coverage check

**Objective**: Prove the documentation half of the mount: the page exists, mentions the two flags the check requires, and the inventory carries the row.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-2, F-8
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/help-guide-coverage.test.ts` + `tests/checks/reference-page-parity.test.ts` (Existing – Update); `tests/checks/steer-mutants.test.ts` (new) for the mutation arm
**Tags**: @checks, @docs

**Preconditions**:
- The delivered coverage inventory fixture `tests/fixtures/help-guide/coverage.json` updated with the steer command row and page path.

**Steps**:
1. Assert `coverage.json` `commands` contains `steer` exactly once and `referencePages` contains the steer page path exactly once.
2. Assert the page file exists at the inventory path and mentions `--help` and `--version` (the delivered check's requirements).
3. Run the coverage check and assert zero failures, and that its failure count is not reduced by the new row masking a previously failing row (compare the reported row count before/after).
4. Assert the page states the four subcommands, the exit codes, the drawn defaults, and the no-session-operation posture (content review asserted as presence of the declared terms).
5. Mutation arm: delete the inventory row → the check fails naming the missing command; mutation arm: remove `--version` from the page → the parity check fails.

**Expected Outcome**:
- The page and row exist and the check gates them; two mutants are detected.

#### TC-STEER-063 - Mounting changes no other family, and the unmounted mutant is detected

**Objective**: Prove mounting is additive and that the mount is load-bearing: no other family's composition or help changes, and dropping the entry is red.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, RSK-8, `OQ-TP-1`
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/steer-mounting.test.ts` (isolation cells); `tests/structure/entrypoint-bin.test.ts`; `tests/checks/steer-mutants.test.ts`
**Tags**: @backend, @contract

**Preconditions**:
- Committed help goldens for the other 22 families; the delivered pre-change prompt-required list captured as a fixture constant.

**Steps**:
1. Assert the composed command set equals the delivered set plus `steer` with no other member added, removed, or reordered.
2. Assert every other family's rendered help block is byte-identical to its committed golden (a per-family loop, so a shared-help regression is localised).
3. Assert the entrypoint's dispatch for a delivered family is unchanged (spot-check three families' handler identity and behaviour on one call each).
4. Mutation arm (temporary tree copy): remove `steer` from `PROMPT_REQUIRED_COMMANDS` → the mounting test fails naming the missing family; the coverage check also fails (the inventory row names an unmounted command).
5. Mutation arm: add `steer` to the prompt set but not to the production composer → the composition assertion fails naming the uncomposed command.

**Expected Outcome**:
- Additive mount, zero delivered drift, and two mutants prove the mount is enforced in both directions.

#### TC-STEER-070 - An unknown completion id is `steer.unknown-id` at exit 1 with no write

**Objective**: Prove a miss is classified rather than silently successful, across the id shapes an operator can plausibly supply.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-1, F-9, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-errors.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- One landed note in this repository's store; another repository's store (different checkout) holding a landed note with a known id; append counter and snapshot armed.

**Steps**:
1. `complete msg-doesnotexist --ref <artifact>` → exit `1`, `data.error.code == "steer.unknown-id"`, category `user`, consequence `not_landed`.
2. `complete <other-repository's-id> --ref <artifact>` → the **same** refusal in this checkout (identity is per repository; a foreign id is not a steering record of this repository).
3. `complete "" --ref <artifact>` → grammar or value refusal per the delivered classification; assert the run is refused at exit `1` and never treated as a lookup of an empty id succeeding.
4. Assert append counter `0` and the tree snapshot byte-identical in all cells.
5. Assert a valid id in the same fixture succeeds immediately afterwards (the refusal is scoped to the id).

**Expected Outcome**:
- Unknown, foreign, and empty ids are all classified refusals with zero writes, and the store still works.

**Notes / Clarifications**:
- `AC-F9-1`'s read-target branch is not executable (`OQ-TP-2`); it is covered by `TC-STEER-071` as a grammar assertion.

#### TC-STEER-071 - `steer read <id>` is a grammar refusal, not a second read form (`OQ-TP-2`)

**Objective**: Pin the declared grammar so `AC-F9-1`'s "read targeting an id" cannot be implemented as an undeclared second read form, and record the spec contradiction executably.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-1, AC-F9-3, F-9, §8.3 grammar, `OQ-TP-2`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-errors.test.ts` (grammar cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A store with one landed and one queued note; store read counter armed.

**Steps**:
1. Run `steer read <landed-id>` → assert exit `1`, `data.error.code == "fallback.invocation"`, store read counter `0`.
2. Run `steer read <unknown-id>` → the same grammar refusal, **not** `steer.unknown-id` (there is no id argument on this verb).
3. Run a plain `steer read` in the same fixture → exit `0` with the full batch, proving the refusal is attributable to the extra positional.
4. Assert the help text documents `read` with zero positionals (consistent with the grammar) and does not advertise an id form.
5. Record in the case's assertion message the spec sections that disagree (§17 AC-F9-1, §8.3 exit-projection row 3) so the reopening is visible in a red test rather than a review comment.

**Expected Outcome**:
- One read form only; the contradiction is executable and named, not silently resolved.

#### TC-STEER-072 - Store failures withhold every subcommand as `steer.queue-unavailable` at exit 2

**Objective**: Prove fail-closed across the whole family: no subcommand renders a partial or empty result when the store is unusable, and no landing is reported that did not durably land.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-2, F-9, DM-7, NFR-5, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-errors.test.ts` (store-failure matrix); `tests/behaviour/steer-read-landing.test.ts` (unverified-append cell)
**Tags**: @backend, @behaviour

**Preconditions**:
- A `guardStore`-style degenerate store with four failure modes: unreadable (permissions/IO error on read), unwritable (append rejects), corrupt (unparseable record), and "unverified append" (append succeeds but the post-append read-back does not contain the record).
- A healthy readable twin for each subcommand.

**Steps**:
1. For each of the four modes × four subcommands, run and assert exit `2`, `data.error.code == "steer.queue-unavailable"`, category `platform`, consequence `not_landed`.
2. Assert the payload contains **no** `notes`/`rows`/`record` rendering (no partial result, no empty group masquerading as an empty queue) and no `applied: true` anywhere.
3. For the unverified-append cell specifically: assert `send` and `read` report the failure, no record is reported queued/landed, and the (unverified) bytes are not silently treated as success — the reported answer must be the exit-`2` failure.
4. Assert the healthy twin for each subcommand answers at exit `0` with real content in the same test (so the failure is attributable to the mode, not to the fixture).
5. Mutation arm: swallow the unverified-append check and return success → the case fails.

**Expected Outcome**:
- Every store failure withholds with the platform identity at exit `2`; success is never claimed without a verified append.

#### TC-STEER-073 - Every outcome projects the five-field envelope and the exact 0/1/2 exit row

**Objective**: Prove the projection table is total: one fixture per §8.3 row, the five-field envelope everywhere, and no partial payload on a failure.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-3, NFR-1, DM-7, DM-3
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-envelope.test.ts` (new); `tests/golden/envelope-failure.test.ts` (reuse helper)
**Tags**: @backend, @contract

**Preconditions**:
- One fixture per §8.3 row: success (`send`), success (`list`, empty store), success (`read`, closed decline), value violation, unknown id, registered secret, grammar violation, store failure.

**Steps**:
1. Assert every envelope's key set is exactly the five delivered fields (no sixth top-level key) and that `data` carries every new key (`schemaVersion`, `record`/`notes`/`asks`/`boundary`/groups/`omitted`/`truncated` per form).
2. Assert `ok`/`command` never appear anywhere in the payload (explicit key scan incl. nested objects).
3. Assert exit codes: success rows `0`; value/unknown/secret/grammar rows `1`; store-failure row `2` — no row off by one, and no success path exits non-zero.
4. Assert every failure row carries an `error.code` equal to its declared identity and a non-empty summary naming the failing condition; assert no failure row carries a partial `notes`/`record`/groups payload.
5. Assert `data.schemaVersion == "delivery.steer.v1"` on every row (one identity, DEC-3), and that the human form of each failure names the same identity as the machine form.

**Expected Outcome**:
- Six declared rows, one identity, exact exits, no partial payloads, no envelope drift.

#### TC-STEER-074 - The `steer` kind and its three rows land with the entries and delivered-row counts moved

**Objective**: Prove the rows exist with the declared shape and that the table counts moved exactly once.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-4(a), DM-7, DEC-8, C-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (Existing – Update, D-4/D-5)
**Tags**: @contract, @checks

**Preconditions**:
- `ERROR_TABLE` imported directly; the delivered spend-exclusion selector available.

**Steps**:
1. Assert the table contains exactly three rows under a `steer` domain kind: `steer.unknown-id` (user, exit `1`, `not_landed`), `steer.credential-value-rejected` (user, exit `1`, `not_landed`), `steer.queue-unavailable` (platform, exit `2`, `not_landed`), each with category, retryability, consequence, remediation hint, and projection class resolved.
2. Assert the entry count is `143` at every entry-count site (6 sites in the suite, D-4) and the delivered (spend-exclusion) count is `142` at its 2 sites (D-5).
3. Assert the `board` kind still holds exactly 2 rows and the `ceremony` kind exactly 2 — the steer registration widened nothing else.
4. Assert no delivered row changed identity, category, retryability, or exit projection (compare the delivered rows against a captured pre-change constant).
5. Assert the classifier resolves each new identity to its declared exit and that a `steer.*` code **absent** from the table resolves to no row (it is not synthesized).

**Expected Outcome**:
- Three rows, moved counts, no collateral change, and a classifier that resolves only declared identities.

#### TC-STEER-075 - The closed allowlist is widened to exactly 59 members by declaration, and near misses fail

**Objective**: Prove the allowlist grew by exact declaration and that neither a near miss nor a family pattern can enter.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-4(a), AC-F9-4(d), DM-7, DEC-8
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (D-3, D-6) + `scripts/checks/error-table-sync.ts` (D-2) + `tests/checks/error-table-sync.test.ts` (D-12)
**Tags**: @contract, @checks

**Preconditions**:
- Both allowlist copies imported (the sync check's set and the structural mirror's set).

**Steps**:
1. Assert each set has exactly `59` members, and that the two sets are equal element-wise (no mirror drift).
2. Assert the `steer` members are exactly `{steer.unknown-id, steer.credential-value-rejected, steer.queue-unavailable}` — three, no fourth.
3. Assert every other domain's member count is unchanged from the captured pre-change truth (56 members, minus nothing, plus exactly three).
4. Near-miss probes on the scan/classification path: `steer.unknown-ids`, `steer.queue`, `steer.state-unavailable`, `steer.credential-value-rejected.extra`, `steer.a.b` — each must be **rejected** by the allowlist check (for two-segment forms) or resolve to no table row (for three-segment forms); assert none is accepted by a `steer.` prefix rule.
5. Mutation arms: omit one steer code from the checker copy → the sync check fails naming the disagreement; widen the checker to a `steer.` prefix → the near-miss probe fails; add a fourth `steer.*` code to the table without an allowlist entry → the check fails.

**Expected Outcome**:
- An exact, mirrored 59-member set; three steer members; near misses and family matching both rejected; three mutants detected.

#### TC-STEER-076 - All 13 Appendix D count pins move, the no-leftover scan is clean, and four surfaces agree

**Objective**: Prove the registration boundary moved as one unit: every D-1..D-13 site at its declared post-change value, no stale pin anywhere in the named files, and classifier / sync check / structural mirror / carrier agreeing.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-4(b), AC-F9-4(c), AC-F9-4(d), DM-7, C-7, C-16, Appendix D
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/structure/dispatch-attempts-taxonomy.test.ts`, `tests/structure/verify-gates-suite-map-contract.test.ts`, `tests/checks/error-table-sync.test.ts` (all Existing – Update); `tests/checks/steer-mutants.test.ts` (new)
**Tags**: @contract, @checks

**Preconditions**:
- One tree; the Appendix D site list read from the spec as the locator authority (this plan references it, never copies it).

**Steps**:
1. **D-1** `packages/core/src/contracts/error-table.ts`: three `steer` rows under a GH-298 declaration comment; entry count `143`.
2. **D-2/D-3** both allowlist copies at `59` with the same three steer members (shared with `TC-STEER-075`).
3. **D-4** the 6 entry-count assertions read `143`; **D-5** the 2 delivered-row assertions read `142`; **D-6** the 4 allowlist assertions read `59` and the test name no longer pins "56 members".
4. **D-7** the four-surfaces agreement test name reads "143 entries / 142 delivered / 59 allowlist / 2 board / 3 steer / 143 documented".
5. **D-8** the carrier/doc pins in the structural suite read the `143` wording at all 4 sites; **D-10** the dispatch-taxonomy header comment reads `142`, its test name and length assertion `143`; **D-11** the verify-suite-map `sourceEntries` and `documentedRows` read `143`; **D-12** the sync suite's arithmetic reads `BASELINE_ROWS.length + 109` at all three sites (length, failure message, counts assertion).
6. **D-9** the legacy-token list gains `140`, `139`, `56`, and `+106`, and the no-leftover scan over the five named files returns **no** occurrence of any pre-change value as an identity-count pin (a small declared residual list is permitted and asserted, not assumed).
7. **D-13** the carrier `doc/spec/features/feature-result-contract.md` declares `143 machine identities` at both mentions, its kind inventory names the three `steer` rows, and its allowlist paragraph enumerates `59` codes including the three steer codes.
8. **Four-way agreement** read from one tree: classifier → 143/142/59/3 rows; sync check → same; structural mirror → same; carrier → 143 documented + 3 steer rows + 59 codes. Assert equality as a tuple, not as four independent claims.
9. Make the sync check green end to end (exit `0`), and assert it reports zero failures rather than merely not throwing.

**Expected Outcome**:
- Thirteen sites moved in one commit, one clean scan, one agreeing tuple, one green check.

**Notes / Clarifications**:
- Appendix D-9's "and the +102 arithmetic string" is the delivered list's prior generation; the current pre-change token is `+106` per the spec's opening paragraph, and the scan's legacy list is extended with `140`, `139`, `56`, `+106`.
- A site discovered beyond D-1..D-13 during delivery joins the same commit and the spec's Appendix D is amended — the case's scan is the enforcement, not the list's length.

#### TC-STEER-080 - No LLM, network, tracker, provider, timer, socket, session operation, or product literal

**Objective**: Prove the family is pure and inert: nothing outside the repository's local state scope is read, written, spawned, or listened to.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, NFR-6, DEC-12, NG-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-purity.test.ts` (new); `tests/checks/privacy-literals.test.ts` + `tests/checks/forbidden-literals.test.ts` (Existing – Update)
**Tags**: @backend, @security

**Preconditions**:
- A fixture that runs all four subcommands over a populated store; recording seams for transport, tracker, provider, spawn, timers, and sockets; a synthetic brand identity distinct from the real product name.

**Steps**:
1. Run `send`, `list`, `read`, and `complete`; assert every recorder is empty (0 network requests, 0 tracker/provider calls, 0 spawn/attach/resume/steer session operations, 0 timers created, 0 sockets opened, 0 LLM transports touched).
2. Assert no control-socket path is constructed or opened (path-construction recorder and a filesystem scan of the state root).
3. Assert the human output of all four forms contains the synthetic brand token and **no** hardcoded product or binary literal (a forbidden-literal scan over the four renders and over the module sources of the family).
4. Assert the state root is the invoking repository's local scope: no write outside it (a temp-host tree diff), and 0 reads of `$HOME`-derived state.
5. Assert the module graph of the family contains no network, tracker, credential-resolution, or session-port dependency (dependency assertion on the family's import set), while the **registered-secrets record** is present (the one allowed credential-adjacent input).

**Expected Outcome**:
- Zero external effects, zero session operations, zero product literals, one local state scope.

#### TC-STEER-081 - Two runs are byte-identical on all four forms; order and identity are permutation-proof

**Objective**: Prove determinism as a byte comparison, not a structural claim, and pin the four human forms plus their `data` as goldens.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-2, NFR-2, NFR-3, DM-3
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-determinism.test.ts` (new); `tests/golden/steer.test.ts` (new) + `tests/fixtures/steer/golden/{send,list,read,complete}.{txt,json}`
**Tags**: @backend, @behaviour

**Preconditions**:
- One canonical populated fixture (queued, landed, completed, expired notes; three owner asks); a permutation harness that reverses store order, directory order, ledger order, and ask order; fixed clock and id factory.

**Steps**:
1. Run each of the four forms twice consecutively; assert byte-identical human text and byte-identical `data` (timing/run id fields excluded by the delivered envelope helper).
2. Run each form against each permutation; assert byte-identical output to the canonical run.
3. Compare each form against its committed golden; assert the golden files are **created** in this change (no prior artifact is regenerated) and that a `regenerate.ts` exists beside each.
4. Assert unique identities: no duplicate note `id` in any array, no duplicate ask `id`, and `notes ∪ listGroups` has no id appearing in two lifecycle groups.
5. Assert the store is byte-identical after all runs (no run materialised a derived value), and that a mutation that stamps a timestamp from the wall clock into `data` breaks run-to-run equality.

**Expected Outcome**:
- Byte-stable across repeats and permutations, four new goldens, unique identities, no store drift.

#### TC-STEER-082 - The machine and human bounds hold, and every drop is counted in the declared order

**Objective**: Prove the bounds matrix and the byte guard: caps hold, drops are counted, the boundary block survives, and the order is `asks` → `notes` tail-first by rank.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-3, DM-8, NFR-4, `AMB-TP-1`
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-bounds.test.ts` (new); `tests/fixtures/steer/bounds.ts` (new); `tests/structure/steer-contract.test.ts` (constants)
**Tags**: @backend, @behaviour

**Preconditions**:
- Sized fixtures: at-cap and over-cap for text (160/161), ref (160/161), ttl (30 d / 30 d + 1 ms), list group (8/9), read batch (20/21 — see `TC-STEER-083`), a `data` payload driven to 65 536 bytes and past it by long subjects at 160 chars and many notes, and a human render driven past 32 lines / 6 144 bytes.

**Steps**:
1. Assert the declared constants are exactly the spec's values (text 160, ref 160, ttl 30 days, list 8, batch 20, `data` 65 536, human 32 lines / 6 144 bytes) — one declaration each, no second literal.
2. At-cap twin: every bound value accepted/rendered with `omitted: 0`, `truncated: false`.
3. Over-cap machine cell: `data` serialized size ≤ 65 536 bytes; `omitted` equals the number of rows actually dropped; `truncated: true`.
4. Over-cap human cell: the render is ≤ 32 lines and ≤ 6 144 bytes; the `+N more` marker count equals the machine omission count (the `AMB-TP-1` arithmetic).
5. Byte-guard order: with a payload over the cap, assert `asks` rows drop before any `notes` row, notes drop tail-first by rank, the lowest-ranked notes survive, the `boundary` block is **never** dropped, and the drop counts sum to `omitted`.
6. Mutation arms: drop a `notes` row before an `asks` row → fails; drop head-first by rank → fails; drop the `boundary` block → fails; drop without counting → fails.

**Expected Outcome**:
- Every cap holds, every drop is counted, the declared order is enforced, and four mutants are detected.

#### TC-STEER-083 - The 20-note read batch never loses a note and counts every overflow

**Objective**: Prove the batch cap is bounded without silent loss, and exhaust the population where every reading of `AC-F3-4`/`DM-8` agrees.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-3, AC-F3-4, DM-8, NFR-4, `OQ-TP-3`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-bounds.test.ts` (batch cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- Fixtures: 1 due; 20 due; 25 due (all boundary-open, all within ttl); a 25-due fixture whose notes are ranked so the overflow is unambiguous.

**Steps**:
1. Exhaustive ≤ 20 population: 1 due → 1 landed, 0 omitted; 20 due → 20 landed, 0 omitted, `truncated: false`, 20 outcome records, `data.applied: true`.
2. > 20 cell: assert the **no-loss invariant** — no note is ever in a state that is neither queued, landed, nor expired after the read; every count reported (`omitted` and any deferred count implied by the payload) is consistent with the store; every landed note carries a receipt.
3. Assert the batch is drained by repeated reads: run `read` until it returns an empty batch, then assert every note from the 25-fixture has exactly one outcome and `data.applied` was `true` for at least one read and `false` for the terminating read.
4. Assert the read cap is never exceeded per invocation (`landed rows per read ≤ 20`) **and** the total landed across reads equals the due population — so neither a render-cap nor a landing-cap implementation can lose a note.
5. Assert the payload never reports `truncated: false` while it omitted or deferred anything.

**Expected Outcome**:
- No note is lost above the cap under either reading; the ≤ 20 population is exhaustively proven; the ambiguity is named for the spec rather than resolved in code.

**Notes / Clarifications**:
- `OQ-TP-3`: whether the 20-cap applies to landing or to rendering is a spec-level question; this case fails any implementation that loses a note and does not prejudge the mechanism.

#### TC-STEER-084 - Write discipline: exactly the declared appends, no edits, and no landing on an unverified append

**Objective**: Prove the write matrix as a matrix: per-subcommand append counts, no edit/delete/prune, and post-append verification on every append.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-2, NFR-5, DM-2, RSK-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-write-discipline.test.ts` (new); reuses `tests/behaviour/verify-support.ts` (`guardStore`)
**Tags**: @backend, @behaviour

**Preconditions**:
- A populated fixture covering all four transition kinds; a store wrapper that records every append, every read-back, and every mutating call; a full state-scope tree snapshot with per-file hashes.

**Steps**:
1. `send` → exactly 1 append; `read` (2 due, 1 elapsed, 3 pre-resolved) → exactly 3 appends (2 applied, 1 expired) and 0 for the resolved notes; `complete` → exactly 1; second `complete` → 0.
2. Assert every append is followed by a read-back verification (recorded call order: append → verify), and that a verification failure raises `steer.queue-unavailable` (`TC-STEER-072`).
3. Assert zero edits, zero deletes, zero renames, zero truncations of existing records: every pre-existing file is byte-identical (hash comparison) and no file's size decreased.
4. Assert exactly three record kinds are written (`steering.message`, `steering.outcome`, `steering.completion`) and that no other state kind in the scope changed (the delivered phase, ledger, and other stores are untouched).
5. Mutation arms: drop the verification read-back → the "reported landing on an unverified append" cell fails; rewrite an outcome record in place instead of appending → the hash comparison fails; append two outcomes for one note → the cardinality assertion fails.

**Expected Outcome**:
- Append-only and verified; the matrix is exactly as declared; three mutants are detected.

#### TC-STEER-085 - The declared read set holds per subcommand, with the asks join reusing one ledger read

**Objective**: Prove the read cost is a bound, not a description: one store read, one phase read, one ledger read per `read`, and no reads beyond the local scope.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-8, DM-6, AC-F4-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-read-cost.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- Counting wrappers on the steering store, the delivered phase read, the blocker ledger, the git/config readers, and any transport.

**Steps**:
1. `read` over a populated fixture: assert steering-store reads `== 1`, phase-state reads `== 1`, blocker-ledger reads `== 1`, transport/tracker calls `== 0`, and git/config reads limited to the invoking-checkout identity (assert 0 git reads beyond the single identity resolution).
2. `list`: steering-store reads `== 1`, phase reads `== 0`, ledger reads `== 0`.
3. `complete`: steering-store reads `== 1` (plus the append's read-back), phase reads `== 0`, ledger reads `== 0`.
4. `send`: steering-store reads `== 0` before the append (a filing needs no queue read), and the origin resolution performs no tracker or network read.
5. Assert the asks join performs **no second** ledger read (the count stays `1` with 0 and with 12 owner questions), and that no subcommand reads outside the invoking repository's state scope (path-audit on the read wrappers).

**Expected Outcome**:
- The declared bound holds per subcommand, the join reuses one read, and nothing outside the local scope is read.

#### TC-STEER-090 - The aggregate quality gate is green before the PR opens

**Objective**: Record the gate that closes the change: the full battery at the delivered HEAD.
**Scenario Type**: Quality gate (execution record)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR9-1, NFR-9, NFR-10, DoD-17
**Test Type(s)**: Manual (recorded)
**Automation Level**: Manual
**Target Layer / Location**: — (execution record; §10 and pm-notes `notes:`)
**Tags**: @gate

**Preconditions**:
- `tmp/tmpdir` exists (the repo-local `TMPDIR` lesson); a clean working tree at the delivered HEAD.

**Steps**:
1. Run `TMPDIR=$PWD/tmp/tmpdir pnpm check` (lint → format:check → typecheck → test → check:boundaries) and capture the exit code and the tail of the log.
2. Run `git diff --check` and record the result.
3. Record the phase-9 range lint verdict (`./scripts/lint-commit-range.sh --base <base>`: PASS / FAIL / SKIP / ERROR) as reported by `@pm`.
4. Record all three results in §10 of this plan and as pm-notes `notes:` entries; escalate with `blockers publish` rather than editing any state by hand.

**Expected Outcome**:
- One recorded green battery at the delivered HEAD, or a recorded red with the failing stage named — never an unrecorded "should be green".

#### TC-STEER-091 - Unreceipted-landing control: a landed note with a null receipt member is detected

**Objective**: Prove the receipt assertion has detection power: the seed's property must fail if any landed note ever carries a null `origin`, `readReceipt`, or `ttl`.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, DM-3, RSK-5, `SC-M2-S5-01`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-controls.test.ts` (new)
**Tags**: @backend, @behaviour

**Preconditions**:
- A completeness sweep helper that walks every payload produced in the suite's fixture matrix and asserts the receipt invariant on every landed row; two mutation arms in temporary tree copies (omit `receipt.ttl`; omit the outcome append but still report landed).

**Steps**:
1. Sweep the whole fixture matrix: for every landed row, `receipt.origin`, `receipt.readReceipt.at`, `receipt.readReceipt.boundary`, `receipt.ttl`, `receipt.expiresAt` are all non-null and non-empty; assert the sweep covered ≥ 1 landed row (non-vacuity floor).
2. Assert the same for the human render's receipt line (no `null`, `-`, or blank in the receipt position).
3. Mutation arm: omit `ttl` from the receipt → the sweep fails naming the note id and the member.
4. Mutation arm: report `applied: true` without appending an outcome → the sweep's "landed ⟺ outcome exists" cross-check fails.
5. Record the metric form: "unreceipted landings == 0" is asserted as a count over the sweep, not as prose.

**Expected Outcome**:
- The seed's property is proven load-bearing; a null receipt member or a receipt without an outcome is red.

#### TC-STEER-092 - Silent-outcome control: no note can be queued and invisible, and no unreadable store renders empty

**Objective**: Prove every note is accounted for on some surface and that "empty" is distinguishable from "unreadable" — the change's headline metric (silent outcomes == 0).
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F9-2, DM-2, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-controls.test.ts` (silence cells)
**Tags**: @backend, @behaviour

**Preconditions**:
- A fixture with (a) an orphan message record (message, no outcome), (b) a message with an outcome, (c) a message with an outcome and a completion, (d) a store made unreadable.

**Steps**:
1. Assert the orphan message renders as `queued` on `list` (never dropped for lacking an outcome) and is landed by a boundary-open `read`.
2. Assert the resolved notes render in their derived group and that the union of the three groups equals the store's message population exactly (a set equality, so nothing is invisible).
3. Assert the unreadable-store cell (`d`) withholds at exit `2` with no groups rendered — and that the empty-store twin renders exit `0` with three empty groups; assert the two payloads are distinguishable by an explicit marker (exit code and error identity), so "empty queue" can never be an unreadable store.
4. Assert a note that transitions in a read appears in that same response's `notes[]` (no note consumes an outcome without being reported).
5. Mutation arm: filter orphan messages out of the queue view → the set equality fails.

**Expected Outcome**:
- Zero silent outcomes; empty and unreadable are distinguishable; one mutant detected.

#### TC-STEER-093 - Mid-phase interruption control: landing during an open phase fails, and no session op occurs

**Objective**: Prove the boundary guard is load-bearing and that the surface cannot steer a live session even when it would be convenient.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, AC-F10-1, DEC-5, DEC-12, RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-controls.test.ts` (boundary mutants)
**Tags**: @backend, @behaviour

**Preconditions**:
- The closed-boundary fixture from `TC-STEER-013`; two mutation arms in temporary tree copies (treat "entry in progress" as open; land and also invoke a session operation).

**Steps**:
1. Mutation arm 1: make the boundary derivation treat an in-progress entry as open → `TC-STEER-013`'s assertions fail on `boundary.open`, on the appended outcome, and on the pending reason — proving all three halves are enforced, not just the flag.
2. Mutation arm 2: add a session `resume`/`steer` call on the landing path → `TC-STEER-080`'s spawn recorder assertion fails naming the operation.
3. In the unmutated tree, run `read` at a closed boundary with a *due* note and assert the note remains queued across three reads with the clock advancing — no drift toward landing by patience.
4. Assert the boundary decision reads only the delivered phase-state records: swap in a fixture whose phase records are absent and assert the read becomes open (the derivation is from records, not from a cached flag).

**Expected Outcome**:
- The guard and the no-session-operation posture are load-bearing; both mutants are detected.

#### TC-STEER-094 - Artifact-less completion control: a completion recorded without a proving artifact fails

**Objective**: Prove the concept's lint rule is enforced as a refusal: no completion record can exist without an artifact ref.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, AC-F6-2, F-6, RSK-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-controls.test.ts` (completion mutants)
**Tags**: @backend, @behaviour

**Preconditions**:
- A landed note; a mutation arm that records a completion with an empty or absent artifact.

**Steps**:
1. Mutation arm: relax the completion check so `--ref` is optional → `TC-STEER-042`'s missing-ref cell fails, and the store gains a completion record with `artifact: null` → the sweep in step 2 fails.
2. Sweep every completion record in every fixture: `artifact` is a non-empty string, `completedAt` is present, and the referenced note has an applied outcome (receipt-first). Assert the sweep covered ≥ 1 completion (non-vacuity floor).
3. Mutation arm: allow completion of a queued note → `TC-STEER-042` fails and the sweep's receipt-first check fails.
4. Record the metric form: "artifact-less completions == 0 recorded, 0 accepted".

**Expected Outcome**:
- Completion without evidence is impossible in the store and refused at the surface; both mutants detected.

#### TC-STEER-095 - Schema-fork control: an owner-specific field or an owner-only vocabulary member fails

**Objective**: Prove the shared-schema claim is load-bearing: a fork is red, not merely discouraged.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, DM-1, RSK-1
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/steer-controls.test.ts` (schema mutants); `tests/structure/steer-contract.test.ts`
**Tags**: @contract, @behaviour

**Preconditions**:
- Two mutation arms in temporary tree copies: (M1) add `ownerNoteId` to the record schema and write it on filing; (M2) add an owner-only vocabulary member (`kind: "steer"`) to the shared `kind` set.

**Steps**:
1. M1: the key-set assertion in `TC-STEER-007` fails naming the extra field, and the non-owner validation cell fails because the non-owner record lacks the owner-only field (a fork is immediately asymmetric).
2. M2: the closed-vocabulary equality assertion fails (the shared set no longer equals the concept's set), and the "filing subset ⊆ shared set" assertion still holds — proving the two assertions guard different things.
3. Assert the unmutated tree passes both, and that the shared vocabulary is declared exactly once (a duplicate-literal scan across packages).
4. Assert the fork detector itself is non-vacuous: both mutants are constructed, detected, and reported with the offending name.

**Expected Outcome**:
- A schema fork is a red gate in both directions, and the paired assertions are independently load-bearing.

#### TC-STEER-096 - Mounting-gap control: a missing inventory row, page, or help entry is detected

**Objective**: Prove the mounting unit cannot be partially satisfied: each half is independently enforced, and the coverage check is the gate.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, AC-F8-2, F-8, RSK-8
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/steer-mutants.test.ts` (mounting mutants)
**Tags**: @checks

**Preconditions**:
- Five mutation arms in temporary tree copies: (M1) prompt-set entry present, production composition absent; (M2) composition present, root help entry absent; (M3) reference page absent; (M4) coverage-inventory row absent; (M5) `steer --help` output missing the exit-code section.

**Steps**:
1. M1 → the composition assertion fails naming the uncomposed command.
2. M2 → the root-help assertion fails naming the missing family line.
3. M3 → the coverage check fails naming the missing page path.
4. M4 → the coverage check fails naming the missing inventory row.
5. M5 → the family-help assertion fails naming the missing section; assert the unmutated tree passes all five in the same suite run.

**Expected Outcome**:
- Every half of the mount is independently enforced; five mutants detected; no partial mount passes.

## 6. Environments and Test Data

- **Environments.** One hermetic local environment: `bun test` over per-test temporary roots. No staging, no external system. Every dependency is an in-process injected port, except the real git checkouts the origin-derivation cases require (`git init` plus a local PM-context file under `mkdtemp` in the repo-local temp base).
- **State isolation.** Host roots, homes, and repository state scopes are created under the approved temp base, never `$HOME` and never the live tree; the delivered fixture guard rejects the live workspace and the real home-derived state directory before anything is written.
- **Clock and identifiers.** Injected clock, deterministic id factory, run id, and fence tokens throughout; no wall-clock reads and no real sleeps. Ages, TTL boundaries, `expiresAt`, and boundary conditions are computed from the fixture clock so a case states only its delta.
- **Fixtures.** Live under `tests/fixtures/**` and are never named `*.test.ts`. New: `tests/fixtures/steer/harness.ts` (in-process composition over an injected clock, id factory, state port, phase read, ledger view, secrets record, and origin source), `tests/fixtures/steer/cases.ts` (record fixtures: bound/unbound origin, ttl deltas, the lifecycle matrix, the value-refusal table), `tests/fixtures/steer/phase-boundary.ts` (the three boundary routes plus the closed form, with the delivered phase vocabulary), `tests/fixtures/steer/bounds.ts` (at-cap/over-cap payloads sized against 65 536 bytes and the human budget), `tests/fixtures/steer/credentials.ts` (the registered sentinel plus the unregistered token-shaped table), `tests/fixtures/steer/ask-matrix.ts` (owner/coordinator/answered populations and the three join states), and `tests/fixtures/steer/golden/**` (the four human forms and their `data`, with `regenerate.ts`).
- **Reused delivered fixtures.** `tests/fixtures/blockers/{harness,records,ranking}.ts` and `tests/fixtures/blockers/{cases,matrix,policy,bounds}/**` for asks and the ledger; `tests/fixtures/phase/**` and `tests/fixtures/state/harness.ts` for the boundary read; `tests/fixtures/credentials/cases.ts` for the registered-secret table; `tests/fixtures/projects/{production,state-scope,temp-repos,host-root}.ts` for real checkouts; `tests/fixtures/entrypoint/programs.ts`; `tests/fixtures/help-guide/coverage.json`; `tests/golden/helpers.ts`; `tests/behaviour/verify-support.ts` (`guardStore`, `VerifyCallRecorder`).
- **Real-checkout discipline.** Only the origin-derivation, guard-on-derived-value, mounting-composition, and write-discipline cases use real checkouts; every other case uses the synthetic harness. The invoking checkout in those cases is real so the derived key is not a fixture constant.
- **Goldens.** Committed artifacts for the four human forms (`tests/fixtures/steer/golden/{send,list,read,complete}.txt`) and their envelopes (`…/{send,list,read,complete}.json`), plus the existing help goldens for the other families used by `TC-STEER-063`. Each has a `regenerate.ts`; regeneration is explicit and its diff must show only the declared delta. These are **new** artifacts — no delivered golden is regenerated by this change.
- **Determinism data.** Permutation fixtures are derived from one canonical fixture by reversing store rows, directory-read order, ledger rows, and ask order, so byte equality is the only assertion.
- **Isolation and cleanliness.** Every suite constructs its own store, host root, and checkouts and disposes them in `finally`; no cross-suite shared state; mutation copies are temp-tree copies, never in-place edits of the live tree.
- **Aggregate gate.** `TMPDIR=$PWD/tmp/tmpdir pnpm check` with `tmp/tmpdir` present (the repo-local `TMPDIR` lesson). Narrow while iterating: `bun test tests/behaviour/steer-*.test.ts tests/structure/steer-*.test.ts tests/checks/steer-*.test.ts tests/golden/steer.test.ts`.

## 7. Automation Plan and Implementation Mapping

Every case is automated under `bun test` except `TC-STEER-090`, which is an execution record. All new suites are **To Implement**; rows marked **Existing – Update** extend delivered suites or goldens in place. Delivery owns exact module paths and seam shapes (`AMB-TP-2`); the files below follow repo convention, and a case that cannot resolve its seam **fails naming the missing contract** rather than skipping. Aggregate verification: `TMPDIR=$PWD/tmp/tmpdir pnpm check`.

| TC ID | Suite / file | Command | Injection / fixture requirements | Status |
|---|---|---|---|---|
| TC-STEER-001 | `tests/behaviour/steer-send.test.ts` | `bun test tests/behaviour/steer-send.test.ts` | Real checkout + PM context; injected clock/id factory; empty store; record key set | To Implement |
| TC-STEER-002 | `tests/behaviour/steer-send.test.ts` (unbound cells) | `bun test … --filter unbound-origin` | Real checkout without PM context; no-binding twin; bound twin control | To Implement |
| TC-STEER-003 | `tests/behaviour/steer-send.test.ts` (override cells) | `bun test … --filter drawn-defaults` | Flag matrix; clock advance after filing; 160-char ref | To Implement |
| TC-STEER-004 | `tests/behaviour/steer-refusals.test.ts` + `tests/fixtures/steer/cases.ts` | `bun test tests/behaviour/steer-refusals.test.ts` | Refusal table with at-cap twins; store read counter `0`; tree snapshot | To Implement |
| TC-STEER-005 | `tests/behaviour/steer-refusals.test.ts` (grammar cells) | `bun test … --filter grammar` | 10 grammar cells; zero-read counter; help-path control | To Implement |
| TC-STEER-006 | `tests/behaviour/steer-records.test.ts` + `tests/structure/steer-contract.test.ts` | `bun test tests/behaviour/steer-records.test.ts tests/structure/steer-contract.test.ts` | Byte-diff store, 100 filings, forced id collision, no derived-field scan | To Implement |
| TC-STEER-007 | `tests/structure/steer-contract.test.ts` + `tests/behaviour/steer-records.test.ts` | `bun test tests/structure/steer-contract.test.ts` | Exported schema/vocabularies; non-owner record; malformed variants | To Implement |
| TC-STEER-008 | `tests/structure/steer-contract.test.ts` + `tests/checks/steer-mutants.test.ts` | `bun test tests/structure/steer-contract.test.ts tests/checks/steer-mutants.test.ts` | Subset inclusion; three mutation arms (owner-only member, extra field, legitimate shared growth) | To Implement |
| TC-STEER-010 | `tests/behaviour/steer-read-landing.test.ts` | `bun test tests/behaviour/steer-read-landing.test.ts` | No phase record; receipt shape; outcome count; refs/branch snapshot; spawn recorder | To Implement |
| TC-STEER-011 | `tests/behaviour/steer-read-landing.test.ts` (open routes) | `bun test … --filter boundary-open` | `tests/fixtures/steer/phase-boundary.ts`; latest-completed-entry cell; reordered fixture | To Implement |
| TC-STEER-012 | `tests/behaviour/steer-read-expiry.test.ts` | `bun test tests/behaviour/steer-read-expiry.test.ts` | Elapsed note at `>=` boundary; expiry record count; snapshot; repeat read | To Implement |
| TC-STEER-013 | `tests/behaviour/steer-read-boundary-closed.test.ts` | `bun test tests/behaviour/steer-read-boundary-closed.test.ts` | In-progress phase record; three notes; append counter `0`; asks presence cell | To Implement |
| TC-STEER-014 | `tests/behaviour/steer-read-landing.test.ts` (batch cells) | `bun test … --filter batched-landing` | Five-note rank matrix with reversed store order; five outcome records | To Implement |
| TC-STEER-015 | `tests/behaviour/steer-read-idempotency.test.ts` | `bun test tests/behaviour/steer-read-idempotency.test.ts` | Land+expire then re-read; byte comparison across two repeats; append counter | To Implement |
| TC-STEER-016 | `tests/behaviour/steer-read-idempotency.test.ts` (cardinality cells) | `bun test … --filter outcome-cardinality` | Five notes with three pre-resolved; store scan for per-note outcome count; inconsistent-store cell | To Implement |
| TC-STEER-017 | `tests/behaviour/steer-read-expiry.test.ts` + `tests/structure/steer-contract.test.ts` | `bun test … --filter ttl-boundary` | Pure predicate at −1 ms / +0 / +1 ms; clock-shift pair; no-ambient-clock assertion | To Implement |
| TC-STEER-018 | `tests/behaviour/steer-read-expiry.test.ts` (totals matrix) | `bun test … --filter payload-totals` | Four fixtures (empty/all-expired/mixed/pending); presence-rule table | To Implement |
| TC-STEER-020 | `tests/behaviour/steer-aging-rank.test.ts` | `bun test tests/behaviour/steer-aging-rank.test.ts` | Four surfaces; planted stored `age`; clock advance; pure aging signature | To Implement |
| TC-STEER-021 | `tests/behaviour/steer-aging-rank.test.ts` (rank matrix) | `bun test … --filter rank-order` | 12-note matrix with independently computed expectation; id tie-break; rank contiguity | To Implement |
| TC-STEER-022 | `tests/behaviour/steer-aging-rank.test.ts` (permutation cells) | `bun test … --filter derived-order` | Four permutations; no-stored-derivative scan; two mutation arms | To Implement |
| TC-STEER-023 | `tests/behaviour/steer-list.test.ts` + `tests/golden/steer.test.ts` | `bun test tests/behaviour/steer-list.test.ts tests/golden/steer.test.ts` | Three lifecycle groups + completed row; group label and marker assertions; list golden | To Implement |
| TC-STEER-024 | `tests/behaviour/steer-bounds.test.ts` (list caps) | `bun test tests/behaviour/steer-bounds.test.ts --filter list-caps` | 8/8/8 and 9/9/9 fixtures; per-group omission cross-check; mutation arm | To Implement |
| TC-STEER-025 | `tests/behaviour/steer-list.test.ts` (completion cells) | `bun test … --filter completed-row` | Completed and uncompleted landed rows; key-set check for a fourth group | To Implement |
| TC-STEER-030 | `tests/behaviour/steer-asks.test.ts` | `bun test tests/behaviour/steer-asks.test.ts` | Delivered ledger fixtures; same-process comparison against the delivered view; closed-boundary asks cell | To Implement |
| TC-STEER-031 | `tests/behaviour/steer-asks.test.ts` (join cells) | `bun test … --filter drawn-default-join` | Three join states; ref-less question; PDR-0003 map swap; no-second-default assertion | To Implement |
| TC-STEER-032 | `tests/behaviour/steer-asks.test.ts` (exclusion + write audit) | `bun test … --filter asks-audience` | 3 coordinator + 2 owner + 1 answered + 10 owner; ledger write recorder; read counter | To Implement |
| TC-STEER-040 | `tests/behaviour/steer-complete.test.ts` | `bun test tests/behaviour/steer-complete.test.ts` | Landed note; completion record count; message/outcome byte identity; list cross-check | To Implement |
| TC-STEER-041 | `tests/behaviour/steer-complete.test.ts` (repeat cells) | `bun test … --filter repeat-completion` | Pre-completed note; artifact-`B` attempt; identical retry; other-note control | To Implement |
| TC-STEER-042 | `tests/behaviour/steer-complete.test.ts` (refusal matrix) | `bun test … --filter completion-refusals` | Queued/expired/landed notes; missing/empty/161-char ref; 160-char accepting twin | To Implement |
| TC-STEER-050 | `tests/behaviour/steer-credentials.test.ts` | `bun test tests/behaviour/steer-credentials.test.ts` | Registered sentinel from `tests/fixtures/credentials/cases.ts`; byte-count; payload substring scan | To Implement |
| TC-STEER-051 | `tests/behaviour/steer-credentials.test.ts` (ref cells) | `bun test … --filter ref-path` | Sentinel in `--ref` on `send` and `complete`; landed note; benign-ref continuation | To Implement |
| TC-STEER-052 | `tests/behaviour/steer-credentials.test.ts` (origin cells) | `bun test … --filter origin-path` | Real checkout with sentinel-bearing key and PM-context ref; benign twin | To Implement |
| TC-STEER-053 | `tests/behaviour/steer-credentials.test.ts` + `tests/structure/steer-contract.test.ts` | `bun test … --filter no-pattern-layer` | Unregistered token-shaped table; registered control; guard dependency set; single secrets record | To Implement |
| TC-STEER-060 | `tests/structure/steer-mounting.test.ts` + extends five composition suites | `bun test tests/structure/steer-mounting.test.ts tests/structure/entrypoint-bin.test.ts tests/structure/board-mounting.test.ts tests/structure/events-production-composition.test.ts tests/structure/dispatch-attempts-composition.test.ts tests/structure/daemon-production-composition.test.ts` | Delivered set captured as a fixture constant; production composer without steer runtime; root help capture | To Implement + Existing – Update (five count assertions) |
| TC-STEER-061 | `tests/behaviour/steer-help.test.ts` | `bun test tests/behaviour/steer-help.test.ts` | Empty environment; store/git/transport/spawn counters; brand swap | To Implement |
| TC-STEER-062 | `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/checks/steer-mutants.test.ts` | `bun test tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts` | Inventory row + page; row-count comparison; two mutation arms | Existing – Update + To Implement |
| TC-STEER-063 | `tests/structure/steer-mounting.test.ts` (isolation) + `tests/structure/entrypoint-bin.test.ts` + `tests/checks/steer-mutants.test.ts` | `bun test tests/structure/steer-mounting.test.ts tests/structure/entrypoint-bin.test.ts` | Per-family help goldens; delivered set constant; two mutation arms | To Implement + Existing – Update |
| TC-STEER-070 | `tests/behaviour/steer-errors.test.ts` | `bun test tests/behaviour/steer-errors.test.ts` | Landed note; foreign-store id; empty id; append counter and snapshot | To Implement |
| TC-STEER-071 | `tests/behaviour/steer-errors.test.ts` (grammar cells) | `bun test … --filter read-positional` | `read <id>` cells; store read counter `0`; plain-read control; help consistency | To Implement |
| TC-STEER-072 | `tests/behaviour/steer-errors.test.ts` (store matrix) + `steer-read-landing.test.ts` | `bun test … --filter queue-unavailable` | `guardStore` four modes × four subcommands; readable twins; unverified-append mutation | To Implement |
| TC-STEER-073 | `tests/behaviour/steer-envelope.test.ts` | `bun test tests/behaviour/steer-envelope.test.ts` | Six §8.3 rows; envelope key-set diff; `ok`/`command` scan; exit table | To Implement |
| TC-STEER-074 | `tests/structure/error-table.test.ts` (D-1, D-4, D-5, D-7) | `bun test tests/structure/error-table.test.ts` | `ERROR_TABLE` rows; 6 entry pins at 143; 2 delivered pins at 142; board/ceremony controls; delivered-row constant | Existing – Update |
| TC-STEER-075 | `tests/structure/error-table.test.ts` (D-3, D-6) + `scripts/checks/error-table-sync.ts` (D-2) + `tests/checks/error-table-sync.test.ts` | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` | Both allowlist copies at 59; exact steer members; near-miss probes; three mutation arms | Existing – Update |
| TC-STEER-076 | `tests/structure/error-table.test.ts`, `tests/structure/dispatch-attempts-taxonomy.test.ts`, `tests/structure/verify-gates-suite-map-contract.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/steer-mutants.test.ts` | `bun test tests/structure/error-table.test.ts tests/structure/dispatch-attempts-taxonomy.test.ts tests/structure/verify-gates-suite-map-contract.test.ts tests/checks/error-table-sync.test.ts` | All D-1..D-13 pins per file group; no-leftover scan for 140/139/56/+106; four-way tuple 143/142/59/143; carrier assertions; non-mirror stale-site mutant | Existing – Update |
| TC-STEER-080 | `tests/behaviour/steer-purity.test.ts` + `tests/checks/privacy-literals.test.ts` + `forbidden-literals.test.ts` | `bun test tests/behaviour/steer-purity.test.ts tests/checks/privacy-literals.test.ts tests/checks/forbidden-literals.test.ts` | Transport/tracker/provider/spawn/timer/socket recorders; brand swap; import-set assertion; state-root diff | To Implement + Existing – Update |
| TC-STEER-081 | `tests/behaviour/steer-determinism.test.ts` + `tests/golden/steer.test.ts` | `bun test tests/behaviour/steer-determinism.test.ts tests/golden/steer.test.ts` | Four forms × two runs; four permutations; new goldens + `regenerate.ts`; identity uniqueness | To Implement |
| TC-STEER-082 | `tests/behaviour/steer-bounds.test.ts` + `tests/structure/steer-contract.test.ts` | `bun test tests/behaviour/steer-bounds.test.ts` | At-cap/over-cap sized fixtures; byte measurement on serialized `data`; four guard mutants | To Implement |
| TC-STEER-083 | `tests/behaviour/steer-bounds.test.ts` (batch cells) | `bun test … --filter read-batch` | 1/20/25-due fixtures; drain-to-empty loop; per-read cap + total-landed equality | To Implement |
| TC-STEER-084 | `tests/behaviour/steer-write-discipline.test.ts` | `bun test tests/behaviour/steer-write-discipline.test.ts` | Append/read-back call order; per-file hashes; three mutation arms; real checkout | To Implement |
| TC-STEER-085 | `tests/behaviour/steer-read-cost.test.ts` | `bun test tests/behaviour/steer-read-cost.test.ts` | Counting wrappers on every seam; 0/12-ask cells; path audit | To Implement |
| TC-STEER-090 | — (execution record) | `TMPDIR=$PWD/tmp/tmpdir pnpm check`; `git diff --check`; `./scripts/lint-commit-range.sh --base <base>` | `tmp/tmpdir` present; results recorded in §10 and pm-notes | Manual (recorded) |
| TC-STEER-091 | `tests/behaviour/steer-controls.test.ts` (receipt sweep) | `bun test tests/behaviour/steer-controls.test.ts --filter receipt-sweep` | Matrix-wide sweep + non-vacuity floor; two mutation arms (null `ttl`, landed-without-outcome) | To Implement |
| TC-STEER-092 | `tests/behaviour/steer-controls.test.ts` (silence cells) | `bun test … --filter silent-outcome` | Orphan message, resolved, completed, unreadable store, empty twin; set equality; mutation arm | To Implement |
| TC-STEER-093 | `tests/behaviour/steer-controls.test.ts` (boundary mutants) | `bun test … --filter boundary-control` | Two boundary mutants; three-read drift cell; phase-record-absence cell | To Implement |
| TC-STEER-094 | `tests/behaviour/steer-controls.test.ts` (completion mutants) | `bun test … --filter completion-control` | Artifact sweep + non-vacuity floor; two mutation arms | To Implement |
| TC-STEER-095 | `tests/behaviour/steer-controls.test.ts` + `tests/structure/steer-contract.test.ts` | `bun test … --filter schema-fork` | Two schema mutants (owner field, owner-only vocabulary member); duplicate-literal scan | To Implement |
| TC-STEER-096 | `tests/checks/steer-mutants.test.ts` (mounting mutants) | `bun test tests/checks/steer-mutants.test.ts --filter mounting-mutants` | Five mounting mutants; unmutated pass control | To Implement |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation in this plan |
|---|---|
| **R-TP-1 — A reported landing did not durably land (RSK-3).** The single most damaging failure: the delivery believes it was steered. | The landing cases assert the *store's* outcome count, not the payload alone (`TC-STEER-010`, `014`), the unverified-append cell withholds at exit `2` (`TC-STEER-072`), and the write matrix asserts append → verify ordering (`TC-STEER-084`), with a mutant that drops the read-back. `TC-STEER-091` fails if a landed row exists without an outcome. |
| **R-TP-2 — A silent outcome (RSK-3):** a note queued, expired, or landed without appearing on any surface. | `TC-STEER-092` asserts a set equality between the store's message population and the union of the three lifecycle groups, plus the empty-vs-unreadable distinction; `TC-STEER-016` bounds outcomes to one per note; `TC-STEER-083` proves no note is lost above the batch cap. |
| **R-TP-3 — Mid-phase interruption creep (RSK-2).** A guard that passes on the flag but still applies. | `TC-STEER-013` asserts the flag, the per-note pending reason, the zero append, and the tree snapshot together; `TC-STEER-093` mutates the derivation and proves all three halves fail. |
| **R-TP-4 — A receipt that is not evidence (RSK-5, the change's headline metric).** | `TC-STEER-010` pins the seed's members; `TC-STEER-091` sweeps the whole matrix with a non-vacuity floor and two mutants. A null member anywhere is red. |
| **R-TP-5 — Schema fork (RSK-1).** | `TC-STEER-007` asserts the closed key set and shared vocabularies declared once; `TC-STEER-008` proves the subset is a restriction; `TC-STEER-095` mutates both fork directions. |
| **R-TP-6 — Credential leak through a note (RSK-5).** | Three path cases (`TC-STEER-050`..`052`) plus the no-pattern boundary twin (`TC-STEER-053`), each asserting zero persisted bytes and a payload substring scan. A pattern layer would fail `053`'s positive twin. |
| **R-TP-7 — The allowlist is widened by convenience, or one count pin is left stale (RSK-6).** A two-segment identity accepted by family matching turns the sync gate into a convention; one stale pin — in the mirror, the dispatch-taxonomy suite, the verify-map suite, the sync suite's `+109` arithmetic, or the carrier — lets an undeclared row in or makes prose contradict the table. | Exact-set assertions on both sides (`59` members, exactly `3` `steer.*`), **all D-1..D-13 sites asserted per file group** (`TC-STEER-076`), a no-leftover scan for `140`/`139`/`56`/`+106`, a four-way tuple read from one tree, and three mutants including a reverted non-mirror site (`TC-STEER-075`, `076`). |
| **R-TP-8 — Mounting that advertises a command which cannot answer (RSK-8).** | The mount is one unit: prompt-set membership and the moved count assertion, composition without a test-supplied runtime, root help, family help, page, inventory row, and five mutants (`TC-STEER-060`..`063`, `096`). |
| **R-TP-9 — The asks join drifts into a second projection (RSK-7).** | `TC-STEER-030` compares against the delivered view's own output in the same process; `TC-STEER-031` proves the PDR-0003 map is the only default source; `TC-STEER-032` proves no ledger write and one ledger read. |
| **R-TP-10 — Determinism claimed from a single run.** | `TC-STEER-081` compares two runs byte-for-byte on all four forms plus four permutations with new committed goldens; `TC-STEER-022` proves the derived-order property by mutation. |
| **R-TP-11 — The family-count arithmetic is stale and the mount is pinned to a wrong literal (RSK-8, `OQ-TP-1`).** A literal `22` assertion would make a correct mount red, and an implementer "fixing" it to `23` in one place leaves five suites disagreeing. | `TC-STEER-060` asserts the delivered set plus exactly one, with the count expectation derived from one constant, and asserts all five composition suites moved together. The spec sections are reported for reopening rather than silently corrected here. |

### 8.2 Assumptions

- The delivered phase-state records and phase fold (M0-S10) are stable and expose the lifecycle vocabulary the boundary derivation reads; the derivation adds no phase record kind.
- The delivered typed-question ledger, open-question view, and PDR-0003 policy map (GH-230, GH-297) are stable and compose read-only; the steer read performs no ledger write.
- The delivered result contract, error-table conventions, state-layer record conventions, and branding seam are stable; the three record kinds and three error rows join them additively.
- The delivered prompt-required set, production composer, help inventory, and coverage check are reusable without redesign; the mount is a membership addition plus one page and one row.
- `git` is available to the origin, purge, and write-audit cells (spec §12); a missing `git` fails those suites loudly rather than skipping.
- The registered-secrets record is injectable in tests and is the same object the serialization redaction chokepoint consumes (asserted in `TC-STEER-053`).
- Exact suite file names, seam shapes, and helper names are delivery-bound (`AMB-TP-2`); behaviours, identities, closed vocabularies, bounds, and AC traceability are not.
- `delivery.steer.v1` is one payload identity across four forms (DEC-3), asserted by a single `schemaVersion` and four per-form key sets (`TC-STEER-073`).

### 8.3 Open Questions

**Two spec-text defects and one ambiguity are open and reported to the spec phase; none blocks delivery of the properties, because each has a tree-invariant or exhaustive case behind it.**

| ID | Question | Blocking? | Owner / routing |
|---|---|---|---|
| `OQ-TP-1` | **The family-count arithmetic in `AC-F8-1` is stale.** Base `cfb0ce8d` already carries 22 prompt-required families (`PROMPT_REQUIRED_COMMANDS` = 22; `board` at index 20, `ceremony` at index 21 merged as GH-296 in the base; `tests/structure/entrypoint-bin.test.ts:544` pins that list, and `board-mounting`, `events-production-composition`, `dispatch-attempts-composition`, `daemon-production-composition` all assert 22). Steer therefore becomes the **23rd** family, so "among 22 families", §4.1's "22 registered root families", §8.5's "21 → 22", DEC-9's "twenty-second", §16.1's "CLI command registry row (22 families)", and DoD-12 cannot be satisfied by a correct mount. | No — `TC-STEER-060`/`063` assert the tree-invariant delta and every suite's count moves from one constant. | `@pm` → reopen spec phase (§4.1, §8.5, DEC-9, §16.1, §17 AC-F8-1, §17.1 DoD-12) and restate as 22 → 23 / twenty-third. |
| `OQ-TP-2` | **`AC-F9-1`'s read-target branch has no grammar.** `AC-F9-1` and the §8.3 exit-projection row 3 say "`complete` or `read` target id", but the §8.3 grammar gives `read` no positional ("`list` and `read` accept none") and F-3 defines `read` as the all-notes batch read point. Adding an id positional to `read` would contradict F-3. | No — `TC-STEER-070` covers `complete` exhaustively; `TC-STEER-071` pins the declared grammar and makes the contradiction visible. | `@pm` → reopen spec phase (§17 AC-F9-1, §8.3 exit projection) and either narrow the criterion to `complete` or declare the read-target form explicitly. |
| `OQ-TP-3` | **`AC-F3-4` and `DM-8` do not compose above 20 due notes.** "All due notes land in one batch" versus "read batch ≤ 20 notes per read with counted overflow" admits three readings (landing cap, render cap, deferred batch). | No — `TC-STEER-083` asserts the no-loss invariant plus the exhaustive ≤ 20 population, where all readings agree. | `@pm` → decide at plan authoring or reopen as a spec clarification (§17 AC-F3-4, DM-8, §8.3 contract shape); no test asserts an unstated resolution. |
| `AMB-TP-3` | **The `--ttl` duration grammar is undeclared** (`DM-1`). The non-positive cell of `AC-F1-2` cannot be written without inventing syntax. | No — delivery binds the parser; `TC-STEER-004` asserts the refusal *outcome* and the at-cap twin. | Delivery-bound; recorded here so a grammar change is a deliberate decision, not a test workaround. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @test-plan-writer | Initial test plan against spec v1.0. All 24 ACs of §17 bound to 57 cases in ten blocks: filing and the shared record 001–008; boundary delivery, receipts, and expiry 010–018; aging, rank, and the queue view 020–025; asks 030–032; completion 040–042; the no-secrets guard 050–053; mounting 060–063; classification and error-table registration 070–076; purity, determinism, bounds, write discipline, and read cost 080–085; quality gate and non-vacuity controls 090–096. Inherited `SC-M2-S5-01` (→ 010, 091) and `SC-M2-S5-02` (→ 012, 018) by name with their mapping stated and their `data.receipt` path reconciled per spec Appendix C. Two spec-text defects reported for reopening — the stale family-count arithmetic (`OQ-TP-1`, affecting §4.1 / §8.5 / DEC-9 / §16.1 / AC-F8-1 / DoD-12) and `AC-F9-1`'s ungrammatical read-target branch (`OQ-TP-2`) — each backed by a tree-invariant case rather than a TODO. One spec tension recorded (`OQ-TP-3`, `AC-F3-4` vs `DM-8` above 20 due notes) and one delivery-bound ambiguity (`AMB-TP-3`, the `--ttl` grammar), plus two methodology declarations (`AMB-TP-1` human allocation, `AMB-TP-2` seam shapes). Every case names a test file under `tests/**`, its injection requirements, its status, and a failing-first observable. No TODO row, no unmapped AC, no orphan case; §5.1, §5.2 and §7 id sets identical. |

## 10. Test Execution Log

No case has been executed against a new implementation at authoring time; this plan is a verification map. Results are recorded here as delivery proceeds.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | No executions yet. |
| TC-STEER-090 | — | Pending | `TMPDIR=$PWD/tmp/tmpdir pnpm check`, `git diff --check`, and the phase-9 range lint verdict are recorded here and in pm-notes `notes:` at the final delivery phase. |
| TC-STEER-076 | — | Pending | The four-way tuple (143 / 142 / 59 / 2 / 3 / 143) is recorded here with the sync check's exit code when the classification phase closes. |
