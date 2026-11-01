---
id: chg-GH-176-queue-ready
status: Updated
created: 2026-10-31T23:55:00Z
last_updated: 2026-11-01T12:20:00Z
owners: [engineering]
service: delivery-os CLI queue readiness
labels: [change, planning]
links:
  change_spec: ./chg-GH-176-spec.md
  test_plan: ./chg-GH-176-test-plan.md
  code_review: ./code-review/review-iter-1.yaml
  code_review_iter2: ./code-review/review-iter-2.yaml
  decision_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
    - ../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md
    - ../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md
    - ../../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md
    - ../../../decisions/ODR-0003-cli-command-naming-v1-lock.md
  related:
    - ../../../spec/features/feature-status-digest.md
    - ../../../spec/features/feature-provider-engine.md
    - ../../../spec/features/feature-state-layer.md
    - ../../../spec/features/feature-config-layer.md
    - ../../../spec/features/feature-result-contract.md
    - ../../../spec/features/feature-provider-client-seeds.md
    - ../../../spec/features/feature-monorepo-scaffold-toolchain.md
    - ../../../planning/oss-tooling/cli-command-registry.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
summary: >-
  Deliver M0-S7 per spec v1.8 and test plan v1.8 (38 TCs, 23 ACs, 11 NFRs): one
  read-only `queue ready` command composed as `queue` with the subcommand
  positional `ready`, accepting 1..8 work-item refs and only the global `--json`.
  The handler rejects zero refs, a wrong subcommand, 9..32 refs, a malformed ref
  (no whitespace trimming), a canonical ref longer than 64 characters, or a
  duplicate ref after canonicalization as `input.value.rejected` before any
  source read; the validation order is canonicalize -> length -> duplicate ->
  read, and canonical duplicates are rejected, never silently merged. 33 refs
  and unknown flags stay `fallback.invocation` in the existing parser. Condition
  evaluation is independent per candidate over the same shared facts, but
  identity observation is candidate-set-scoped: candidate observation and
  `blocked-by` target resolution use the spec §8.3 identity rule over full
  normalized values — exact case-insensitive full-value canonical match first,
  then an all-ASCII-digit `identity.entityId` bridged to the canonical numeric suffix
  only when exactly one requested candidate carries it (candidate observation),
  or only when exactly one observed work item carries that numeric suffix
  (`blocked-by` targets, whose uniqueness domain is the observed work-item set,
  so a canonical-shaped observed target that is not a requested candidate is
  observed by exact match). A shared bare-numeric suffix leaves the item
  unobserved for every sharing candidate with no precedence or caller order;
  there is no substring, prefix-only, or numeric coercion. The pure evaluator
  returns a bounded `delivery.queue-ready.v1` payload with exactly six closed
  tri-state conditions in fixed order (deps-satisfied, repo-free, tier-known,
  no-owner-gate, ci-healthy, provider-available), every non-satisfied condition
  named, provider config failures mapped by the read's own reason
  (`config-invalid` -> `config-invalid`; `provider-chain-unresolved` ->
  `provider-chain-unresolved`; park fold `provider-parks`/`state-unreadable`),
  branch-convention close association (merge-ready only from an observed
  approval on a non-draft open PR, otherwise review-pending, with an explicit
  unknown association class never fabricated as new-start), deterministic
  class/numeric-ref ranking, a bounded machine payload (<=64 KiB) whose
  provider-derived fields are projected only within nine declared output caps —
  every projected provider-qualified identity is `entityId`-only with
  `systemName` omitted, so the whole identity object is bounded by the identity
  cap — marked once with `value-clamped` in reason group 2, verdict-neutral, with
  a deterministic trailing-relation-then-label byte-budget reduction, and a
  deterministic brand-derived human digest (<=16 lines/4096 UTF-8 bytes) ending
  every candidate line with `[repo:local-context; tier:priority-label]` and
  shortening each provider segment to 32 UTF-8 bytes with a trailing `+`
  (header owner/name 128 and branch 256 UTF-8 bytes, candidate line <=400 and
  header plus summary <=620 UTF-8 bytes), with a reverse-rank candidate-line
  drop marked `+more` instead of a throw. The payload and
  digest carry no title. It reuses the delivered status reads (issues/pulls/
  check-runs pages, provider config, verified park fold, local PM context,
  origin/HEAD) with no new adapter read, no new error row, configuration key,
  state schema, package, subpath, runtime-API location, or secret-read allowlist
  entry; source failures are condition evidence and the command exits 0.
  `deps-satisfied` carries one evidence record with the state-count detail
  `done:<n>; open:<n>; unknown:<n>` whose counts sum to the total `blocked-by`
  relation target count (observed + unobserved); `provider-available` is the only
  reachable two-record case. The live smoke is enabled only by the test-harness
  literal `ADOS_QUEUE_READY_LIVE`, bound only under `tests/**` and only at
  exactly `1`.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-176: M0-S7 queue ready (read-only)

## Context and Goals

- **Work item**: GH-176 — M0-S7: queue ready (read-only).
- **Inputs (authoritative, read in full by this pass)**:
  - [chg-GH-176-spec.md](./chg-GH-176-spec.md) — **v1.8** (2026-11-01; DoR iteration-1 corrections R-01/R-02/R-04/R-06/R-07/R-10/R-16/R-18/R-19, iteration-2 corrections R-21/R-22/R-24/R-26/R-29, iteration-3 corrections R-30/R-31/R-32/R-33/R-34/R-35/R-36, iteration-4 corrections R-40/R-41/R-42, iteration-5 corrections R-44/R-45/R-48/R-49, and review iteration-2 corrections in v1.8 — `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (32 UTF-8 bytes), the 400-byte candidate line and 620-byte header-plus-summary budgets, DEC-20, and the defensive reverse-rank line-drop fallback — applied as pins with no scope, AC/NFR identity or intent, condition id, rank order, or boundary change): F-1..F-17, AC-F1-1..AC-F17-1 (23 criteria, including AC-F2-3, AC-F4-2, AC-F12-2), NFR-1..NFR-11, DM-1..DM-13, RSK-1..RSK-14, DEC-1..DEC-20, OQ-1..OQ-8, §8.3 identity resolution (candidate observation scoped to the requested candidate set; `blocked-by` targets scoped to the observed work-item set), Appendix A (condition matrix), Appendix B (payload shape, projected identities `entityId`-only), Appendix C (declared constants, including the nine provider-derived projection caps, the numeric entity-id pattern, the human segment byte cap, and the payload marker reasons; no live-switch constant), Appendix D (evidence vocabulary, including `value-clamped`), Appendix E (close/rank matrix), Appendix F (human grammar with 32-UTF-8-byte provider segments, 400-byte candidate lines, a 620-byte header-plus-summary budget, the defensive reverse-rank line-drop fallback, and the 41-byte proxy suffix), Appendix G (worked examples), Appendix I (documentation impacts).
  - [chg-GH-176-test-plan.md](./chg-GH-176-test-plan.md) — **v1.8** (2026-11-01; 38 TCs, TC-QREADY-001..038; DoR iteration-1 findings R-03/R-05/R-08/R-09/R-11/R-12/R-13/R-14/R-20, iteration-2 findings R-25 plus the R-22/R-24 test additions, iteration-3 alignments R-30/R-31/R-32/R-33/R-34/R-35/R-36, iteration-4 alignments R-37/R-38/R-41/R-42, iteration-5 alignments R-45/R-46/R-47, and the review-iteration-2 human-bound revision folded in — TC-QREADY-020 byte-aware provider segments/header/line budgets with the `caps/human-astral-8` worst case and the `caps/human-over-budget` line drop, the TC-QREADY-035 exact reduction order, and the TC-QREADY-038 `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` constant; GAP register closed except the OQ-T11 delivery-planning hand-off this plan closes): §3 AC/NFR/DM coverage (23 ACs, 38 TCs), §4 test layers and the harness/non-vacuity contracts, §5.2 scenario details (including the 22-row negative-control matrix), §6.2 fixture corpus (including `relation-target-canonical-unrequested` and the over-long `systemName` fixture) and the completeness meta-check, §7 automation/execution order and evidence commands.
  - [readiness-iter-1.md](./readiness-review/readiness-iter-1.md) — DoR iteration 1 (NOT_READY): the plan-only findings (R-15, R-17) and the spec/test-plan findings this plan revision aligns to (R-01, R-02, R-04, R-05, R-06, R-07, R-10, R-16, R-18, R-19).
  - [readiness-iter-2.md](./readiness-review/readiness-iter-2.md) — DoR iteration 2 (NOT_READY): the plan findings this revision closes (R-23, R-27, R-28, R-29), the spec/test-plan findings it aligns to (R-21, R-22, R-24, R-25, R-26), and the carried-forward R-15 DoD split.
  - [readiness-iter-3.md](./readiness-review/readiness-iter-3.md) — DoR iteration 3 (NOT_READY): spec findings R-30 (provider-config failure by the read's `reason`), R-31 (per-candidate condition independence vs candidate-set-scoped identity observation), R-32 (deps state-count wording), R-33 (`blocked-by` target uniqueness domain), R-34 (`systemName` bound), R-35 (duplicate refs rejected, not silently merged), R-36 (proxy-suffix byte count), and the `delivery_planning` alignments this revision closes (RES-2/condition-table/task-3.1 wording, the projected relation shape/cap, the plan revision log, the DoD).
  - [readiness-iter-4.md](./readiness-review/readiness-iter-4.md) — DoR iteration 4 (NOT_READY; 0 critical + 1 major + 2 minor + 3 nit; R-30..R-36 all independently closed): the plan finding this revision closes is R-39 (PM-NOTE-1 `all-unknown-degraded` provider state), and the spec/test-plan findings it aligns to are R-40 (§8.3 target-bridge wording), R-41 (exact canonical match wording) and R-42 (provider config/park failure evidence detail). R-37 (the over-broad negative-control assertion) and R-38 (the dangling corpus fixture id) are test-plan findings whose corrected 22-row matrix this plan mirrors in task 5.4 and the DoD.
  - [readiness-iter-5.md](./readiness-review/readiness-iter-5.md) — DoR iteration 5 (NOT_READY; 0 critical + 1 major + 2 minor + 4 nit; R-37..R-42 all independently closed): the plan finding this revision closes is **R-43** (the `collectStatusFacts` read gate contradicted the delivered status handler and the `not-ready-ci-unresolved` row), plus the plan-side **R-45** (same-class associated-PR tie-break) and **R-47** (stale status enumeration/version references); the spec findings R-44/R-48/R-49 and the test-plan findings R-46/R-47 are aligned here only where they touch this plan.
  - **Authorization**: after the iteration-5 NOT_READY verdict (R-43 is a new major outside the R-37..R-42 authorization) the human authorized a scoped `delivery_planning` correction for R-43, R-45, and R-47 plus a re-gate; this plan revision is that correction and changes no behaviour, count, or mapping.
  - Ticket/backlog M0-S7 (GH-176 body; `doc/planning/oss-tooling/backlog.md` §M0-S7) and the `ados queue ready` row of `doc/planning/oss-tooling/cli-command-registry.md`.
  - [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) (tiers/runtime-API confinement), [ADR-0004](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) (`updatedAt` absence = unknown), [ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) (absent custom field/label signal = unknown), [ADR-0007](../../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) (parks are availability pauses; the engine is not run), [ODR-0003](../../../decisions/ODR-0003-cli-command-naming-v1-lock.md) (`queue ready` name lock).
  - Baseline code read: `packages/cli/src/{index,edge}.ts`, `packages/cli/src/commands/{status,verify,index}.ts`, `packages/cli/src/output/serialize.ts`; `packages/core/src/contracts/{status,ports,provider,index,result}.ts`; `packages/core/src/domain/{status,index}.ts`; `packages/core/src/index.ts`; `packages/core/src/provider/parks.ts`; `packages/core/src/config/index.ts`; `packages/adapters/src/github/{client,normalize}.ts`; `packages/adapters/src/file/pm-context.ts`; `packages/adapters/src/repo/index.ts`; `tests/structure/{inventory.json,content-inventory.test.ts,cli-edge-seam.test.ts,status-imports.test.ts,port-contract-inventory.test.ts,subpaths.test.ts}`; `tests/fixtures/{status/harness.ts,ports/v1-contract-inventory.json}`; `tests/golden/helpers.ts`; `.changeset/config.json`; the GH-175 plan exemplar.
- **Baseline**: branch `feat/GH-176/queue-ready`; the change folder holds spec v1.8, test plan v1.8, pm-notes, and this plan v1.7. The PR targets `main-tools`. M0-S6 (GH-175 status v1) is delivered on `main-tools`.
- **Status**: Updated (DoR iteration-1 plan findings R-15/R-17, DoR iteration-2 findings R-21..R-29, DoR iteration-3 alignments R-30..R-36, DoR iteration-4 alignments R-37/R-38/R-39/R-40/R-41/R-42, and DoR iteration-5 corrections R-43/R-45/R-47 fixed; spec v1.8 and test plan v1.8 alignment folded in; review iteration-1 FAIL remediations F-1..F-6 appended as R2.1..R2.7 in the "Remediation Iteration 2 (review FAIL)" section; review iteration-2 FAIL remediations F-9..F-13 appended as R3.1..R3.6 in the "Remediation Iteration 3 (review iter-2 FAIL)" section, with F-7 still accepted and F-8 already fixed; R3.1–R3.5 executed on `b8292a6`/`0f0000f`/`02207ce`/`e83baf6`/`ca53a68`, and R3.6 closed the battery on `ca53a68`-plus-docs; no completed Phase 1–7 or R2.x task text changed).
- **GAP-1/OQ-T11 closeout**: the test plan's only remaining gap (an implementation plan that maps every TC) is closed. This v1.7 plan maps all 38 TCs (including TC-QREADY-036/037/038), all 23 ACs (including AC-F2-3, AC-F4-2, AC-F12-2), and all 11 NFRs to phases and tasks, and adopts the provider-failure-by-reason rule (plan R-23 / spec v1.4 R-30) plus the spec v1.5 R-42 failure-detail form, so OQ-T11 is resolved in the plan. It changes no TC behaviour, state, reason, bound, assertion, condition id, rank order, or AC/NFR mapping.
- **No plan blocker**: every read `queue ready` needs already exists on the delivered status composition (`readRepositoryFacts`, `parseGitHubRemote`, `listWorkItems`, `listDeliveryRequests`, `readPipelineRun`, provider config resolve/validate, `readProviderParkViews`, `readLocalPmContext`). The plan adds no adapter read, GraphQL/closed-issue read, provider-engine call, quota transport, package, subpath, or runtime-API location.
- **Delivery model**: `@coder` executes Phases 1–6 in order, each ending in exactly one Conventional Commit and a green phase gate. Phase 7 is the documentation/spec reconciliation handoff to `@doc-syncer`; `@coder` must not perform it or mark it complete. Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7**. Phase 1 lands the full contract vocabulary and the complete pure evaluator/renderer so every later phase proves one fixed behaviour; Phases 3–4 add the deep predicate/close/ranking proof suites, they do not re-open the domain shape.

**Goals** (spec §4): one read-only `queue ready` command (G-1); exactly six closed tri-state conditions in fixed order with bounded evidence (G-2, G-3); truthful per-condition derivation from the delivered status inputs (G-4..G-9); close association/classification with observed-approval-only `merge-ready` and an explicit unknown class (G-10); deterministic close-above-new-start ranking with numeric-aware ties (G-11); a bounded `delivery.queue-ready.v1` payload plus a deterministic human digest from the same data (G-12); no new read, package, subpath, runtime-API location, error row, config key, or state schema (G-13, G-16); read-only/deterministic/brand-neutral execution (G-14); fixture corpus plus opt-in structural live smoke (G-15).

**Open questions**: OQ-1..OQ-8 from spec §14 remain non-blocking and are not delivery decisions. OQ-5 (eight-candidate cap) and OQ-7 (title-free payload and digest) are encoded as contract data; raising them later is an additive contract change, not part of this delivery.

## Delivery-Bound Resolutions and Plan Notes

These are delivery spellings/interpretations the plan must pin because the spec and test plan leave them to implementation. None changes a TC, AC, NFR, condition id, state, reason, rank order, bound, or error identity. If the DoR gate rejects one, escalate to PM — do not reshape a TC silently.

- **RES-1 — tracker-read-failure, unobserved-candidate, and unmatched-identity evidence shape.** A tracker read that failed or was not attempted, a successful page that contains no item the §8.3 identity rule matches to the candidate, and an ambiguous shared suffix all leave `deps-satisfied`, `tier-known`, and `no-owner-gate` `unknown`. Each condition carries exactly one record, `{ source: "tracker", reason: "work-item-unobserved" }`, because candidate observation is evaluated before relation- or label-signal availability (F-4/F-6/F-7, R-07). No synthetic source-failure-first record and no second record is added; a tracker `read-failed`/`credential-unavailable` enters top-level `reasons` only when some condition evidence actually carries it (for example CI for a failed check-runs read), never through a planner-invented tracker record. An observed candidate with an unavailable relation/label signal is `unknown` with `signal-unavailable`.
- **RES-2 — `deps-satisfied` carries one state-count evidence record.** Irrespective of the target set, `deps-satisfied` emits exactly one `tracker` record: `no-blocked-dependencies` (no detail) for zero targets, and `dependencies-done`/`dependency-open`/`dependency-unobserved` with detail `done:<n>; open:<n>; unknown:<n>` for a non-empty target set. The three counts sum to the **total `blocked-by` relation target count (observed + unobserved)** — not the observed-target count, which would contradict the `unknown` bucket (spec v1.4 R-32, F-4, AC-F4-1, Appendix A/D); done and canceled both count under `done`; there is no target-ref list, no comma-joined refs, and no per-target or per-state record. The evidence cap is not reachable through deps: `provider-available`'s ordered two records are the only reachable multi-record case, and any over-cap test is a synthetic evaluator input (TC-QREADY-035).
- **RES-3 — no live-switch constant; the literal is tests-only.** No live-switch constant is declared in contracts or anywhere under `packages/**`. The literal `ADOS_QUEUE_READY_LIVE` is bound only by `tests/fixtures/queue-ready/harness.ts`, read only under `tests/**`, and enables the live suite only when its value is exactly `1`. It is never a production or contract constant, configuration key, payload or evidence field, or human-digest token. TC-QREADY-024/026/031 assert the tests-only binding and exactly-`1` gate.
- **RES-4 — parser positional boundary off-by-one.** `positionals.max = 33` (1 subcommand + 32 refs). A 32-ref invocation sends 33 positionals to the handler and is rejected there as `input.value.rejected`; a 33-ref invocation sends 34 positionals and is rejected by the parser as `fallback.invocation`. Tests must use 32 refs for the handler control and 33 refs for the parser control (TC-QREADY-001, TC-QREADY-032).
- **RES-5 — provider evidence is always exactly two records.** The case record from F-9 first, then `{ source: "provider-config", reason: "engine-not-run" }` with no detail. Park-fold failure uses case record `{ source: "provider-parks", reason: "state-unreadable" }` carrying the park read's bounded `failureCode`/`failureClass` in the pinned detail form where supplied (spec v1.5 R-42). Evaluation precedence is config resolution → chain declaration/resolution → park fold → per-entry predicate, so the case record is deterministic when several sources fail; the park fold is still read once and its failure still appears in top-level `reasons`. (Former RES-5, close-source failure placement, is deleted: group 6 is now exactly the single token `pr-association-unknown`, and `read-failed`/`credential-unavailable` live only in group 5.)
- **RES-6 — §8.3 identity resolution is a projection input, not an output clamp, and its uniqueness domain is role-specific.** Condition evaluation is independent per candidate over the same shared facts, but **identity observation is candidate-set-scoped** (spec v1.4 R-31): one candidate's observation never depends on another candidate's condition verdicts, only on the deterministic shared-suffix rule below, with no precedence and no caller-order tie-break. Candidate observation and `blocked-by` target resolution compare the full normalized identity value before any output projection: (1) exact canonical match (the observed full `identity.entityId` equals the candidate's canonical ref — or the target's full ref — as a case-insensitive full-value comparison); (2) otherwise an observed non-empty all-ASCII-digit value matching `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN` bridges to the canonical numeric suffix (the digits after the final hyphen, leading zeros preserved as text) that equals that value exactly, applied over a role-specific uniqueness domain: **candidate observation** bridges only when exactly one *requested candidate* carries the suffix (a shared suffix is ambiguous and leaves the item unobserved for every sharing candidate), while **`blocked-by` targets** bridge only when exactly one *observed work item* carries that suffix (spec v1.4 R-33); (3) no other match exists: `0176` does not match suffix `176`, `007` does not match `7`, an exact `GH-007` does not match `"7"`, and a non-digit provider id never bridges. Because the target domain is the observed work-item set, a canonical-shaped target whose exact identity matches an observed item that is **not** a requested candidate is observed by exact match; a target matching no observed item, or whose digit string is shared by more than one observed work item with no exact match, is unobserved (`dependency-unobserved`), never assumed done. Only a bare all-ASCII-digit target value bridges; a canonical-shaped target that is not observed never bridges on its numeric suffix, and exact canonical target matching is a case-insensitive full-value comparison. Ambiguity and mismatch surface as `work-item-unobserved` (candidate) or `dependency-unobserved` (target), never as a defaulted label/relation set.
- **RES-7 — provider-derived projection caps and the deterministic byte budget.** The nine provider-derived output caps (`QUEUE_READY_MAX_IDENTITY_CHARS` 128, `_REF_CHARS` 128, `_LABEL_CHARS` 128, `_LABELS` 16, `_RELATIONS` 16, `_OWNER_CHARS` 128, `_REPO_NAME_CHARS` 128, `_BRANCH_CHARS` 256, `_TIMESTAMP_CHARS` 40) plus `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` 32 are applied only in the output projection, after every predicate, association, and ranking decision. Labels and `blocked-by` relations keep provider order and are reduced from the end; every other relation kind is filtered out entirely (never clamped). One clamp sets the payload `truncated` and adds `value-clamped` once in group 2; the affected candidate's `truncated` is unchanged because no evidence record was dropped. If the fully capped serialized `data` would still exceed `QUEUE_READY_MAX_MACHINE_BYTES`, trailing `workItem.relations` are dropped first, then trailing `workItem.labels`, last-ranked candidate first and highest index first, rechecking after each drop; conditions, evidence, close data, summary, `reasons`, and `rank` are never dropped, and no verdict changes. The renderer shortens each per-candidate provider segment (pull-request identity, source ref) to 32 characters with a trailing `+`; this is a renderer rule only, not a `value-clamped` clamp, and the payload keeps its own capped values.
- **RES-8 — provider config failures are mapped by the read's own `reason` (spec v1.4 R-30).** A `StatusProviderConfigRead` failure is never blanket-mapped by `!config.ok`: the read's `reason` decides the condition reason — `{ ok: false, reason: "config-invalid" }` → `config-invalid`, `{ ok: false, reason: "provider-chain-unresolved" }` → `provider-chain-unresolved` — mirroring `packages/core/src/domain/status.ts` (`configRead.reason === "provider-chain-unresolved" ? "provider-chain-unresolved" : "config-invalid"`). A park-fold failure always stays `provider-parks`/`state-unreadable` and is never folded into either config reason. The `ok:true` view whose declared default chain is absent from `chains` remains a defensive pure-evaluator case only; the command-level corpus row uses `{ ok: false, reason: "provider-chain-unresolved" }`, the shape the delivered validator/edge actually produces, so the row is reachable through `runCli`, and a separate `{ ok: false, reason: "config-invalid" }` fixture covers the other branch. **Failure evidence (spec v1.5 R-42):** a provider config or park failure record carries the read's bounded failure identity in the pinned `failureCode:<code>` form when the read supplies a code, `failureClass:<class>` when it supplies only a class, or both joined by `; ` when it supplies both, and carries no `detail` when it supplies neither; it never carries a free-form detail, and apart from this pinned failure identity a condition `detail` is only a pinned state/count/case token. The command-level `{ ok: false, reason: "provider-chain-unresolved" }` fixture carries `detail:"failureCode:config.value.invalid"` (the delivered edge's code), the defensive `ok:true` view and `provider-chain-not-declared` carry no failure `detail`, and `state-unreadable` carries the park read's code/class in the same pinned form where supplied. DoR iteration 3 escalated the mapping as R-30 (spec v1.4) and DoR iteration 4 escalated the detail ambiguity as R-42 (spec v1.5); spec v1.5 F-9/AC-F9-1/DM-4 state the same rules.
- **PM-NOTE-1 — binding/credential degraded rows are truthful (resolved in test plan v1.3; the `all-unknown-degraded` provider state corrected in test plan v1.6).** With an unavailable binding, `status.ts` skips all three GitHub reads; with an unresolvable credential, the edge refusal makes all three readers return `credential-unavailable`. In both cases the tracker-derived conditions are `unknown`/`work-item-unobserved`, only `repo-free` can stay satisfied from the local PM context, the close association is `unknown`, and no `read-failed` appears because no remote read was attempted. The corpus rows `not-ready-ci-addressing-unresolved`, `not-ready-ci-remote-unsupported`, and `not-ready-ci-credential-unavailable` assert this composed outcome (`? S ? ? ? S`); the `all-unknown-degraded` row (binding unavailable with a config-invalid read and a failed park fold) is `? S ? ? ? ?` because `provider-available` is also unknown. `read-failed` remains only for an attempted read that fails.

## Pinned Delivery Spellings (binding)

The spec fixes vocabulary, order, states, reasons, bounds, ranks, and schema version; the test plan leaves export names and helper files delivery-bound. This section pins them. Changing one later reopens this plan.

### Contract module — `packages/core/src/contracts/queue-ready.ts` (new, data and types only)

Imports types from `./status.js` and `./ports.js`; no functions, no I/O, no clock, no environment, no executable statement beyond `as const` data and declarations.

Exported constants (exact names and values):

| Constant | Value |
|---|---|
| `QUEUE_READY_SCHEMA_VERSION` | `delivery.queue-ready.v1` |
| `QUEUE_READY_CONDITION_ORDER` | `["deps-satisfied", "repo-free", "tier-known", "no-owner-gate", "ci-healthy", "provider-available"]` |
| `QUEUE_READY_CONDITION_STATES` | `["satisfied", "unsatisfied", "unknown"]` |
| `QUEUE_READY_CLOSE_CLASSES` | `["merge-ready", "review-pending", "new-start", "unknown", "not-ready"]` |
| `QUEUE_READY_RANK_CLASS_ORDER` | `["merge-ready", "review-pending", "new-start", "unknown", "not-ready"]` (class ranks 0..4 in this order) |
| `QUEUE_READY_EVIDENCE_SOURCES` | `["tracker", "changes", "ci", "provider-config", "provider-parks", "local-context", "repository-binding"]` |
| `QUEUE_READY_EVIDENCE_REASONS` | the 41 tokens of DM-10 in DM-10 order: `read-failed`, `signal-unavailable`, `work-item-unobserved`, `addressing-unresolved`, `remote-unsupported`, `credential-unavailable`, `config-invalid`, `provider-chain-not-declared`, `provider-chain-unresolved`, `state-unreadable`, `commit-unresolved`, `local-context-missing`, `local-context-malformed`, `source-truncated`, `value-clamped`, `no-blocked-dependencies`, `dependencies-done`, `dependency-open`, `dependency-unobserved`, `no-active-change`, `candidate-is-active`, `other-active-change`, `tier-absent`, `tier-conflict`, `tier-label`, `no-owner-labels`, `owner-labels`, `ci-succeeded`, `ci-failed`, `ci-pending`, `ci-canceled`, `ci-none`, `no-enabled-entry`, `no-active-park`, `all-entries-parked`, `chain-parked`, `engine-not-run`, `pr-associated`, `pr-not-associated`, `pr-association-unknown`, `pr-not-open` |
| `QUEUE_READY_SOURCE_FAILURE_REASONS` | `["read-failed", "credential-unavailable", "signal-unavailable", "work-item-unobserved", "commit-unresolved", "local-context-missing", "local-context-malformed"]` |
| `QUEUE_READY_PAYLOAD_MARKER_REASONS` | `["source-truncated", "value-clamped"]` — group-2 payload markers in fixed order; never a condition or close evidence record |
| `QUEUE_READY_REASON_ORDER` | six fixed groups: `[{ group: "binding", reasons: ["addressing-unresolved", "remote-unsupported"] }, { group: "payload-markers", reasons: QUEUE_READY_PAYLOAD_MARKER_REASONS }, { group: "provider-config", reasons: ["config-invalid", "provider-chain-not-declared", "provider-chain-unresolved"] }, { group: "park-fold", reasons: ["state-unreadable"] }, { group: "condition-source-failure", reasons: QUEUE_READY_SOURCE_FAILURE_REASONS }, { group: "close-association", reasons: ["pr-association-unknown"] }]`. Group 5 is the only home of `read-failed`/`credential-unavailable`; group 6 is the exact single token `pr-association-unknown` and is last. Group 5 membership follows the condition/evidence walk (DM-1), not the array order. |
| `QUEUE_READY_MAX_CANDIDATES` | `8` |
| `QUEUE_READY_MAX_POSITIONALS` | `33` (1 subcommand + 32 refs; 9–32 refs are rejected in the handler, 33 refs by the parser) |
| `QUEUE_READY_MAX_EVIDENCE_PER_CONDITION` | `2` |
| `QUEUE_READY_MAX_REASONS` | `6` |
| `QUEUE_READY_ASSOCIATED_COUNT_RANGE` | `{ min: 0, max: 100 }` where `max` is `QUEUE_READY_SOURCE_ITEM_LIMIT` |
| `QUEUE_READY_MAX_DETAIL_CHARS` | `160` |
| `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS` | `64` (canonical ref; exactly 64 accepted, 65+ rejected after canonicalization and before duplicate detection and any read) |
| `QUEUE_READY_MAX_IDENTITY_CHARS` | `128` (the whole projected provider-qualified identity for a relation target or pull request: `entityId` only, `systemName` never carried; matching uses the full value) |
| `QUEUE_READY_MAX_REF_CHARS` | `128` (projected `sourceRef`/`targetRef`; association and selection use the full refs) |
| `QUEUE_READY_MAX_LABEL_CHARS` | `128` (projected label; the tier/owner predicates use the full label) |
| `QUEUE_READY_MAX_LABELS` | `16` (projected labels per observation, provider order retained, end dropped) |
| `QUEUE_READY_MAX_RELATIONS` | `16` (projected `blocked-by` relations per observation; every other relation kind is filtered out entirely) |
| `QUEUE_READY_MAX_OWNER_CHARS` | `128` (projected repository owner) |
| `QUEUE_READY_MAX_REPO_NAME_CHARS` | `128` (projected repository name) |
| `QUEUE_READY_MAX_BRANCH_CHARS` | `256` (projected head branch) |
| `QUEUE_READY_MAX_TIMESTAMP_CHARS` | `40` (projected provider `updatedAt`) |
| `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` | `32` (renderer-only per-candidate provider segment; shortened values carry a trailing `+`) |
| `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN` | `^[0-9]+$` (full-value all-ASCII-digit test for the §8.3 numeric bridge) |
| `QUEUE_READY_MAX_MACHINE_BYTES` | `65536` |
| `QUEUE_READY_MAX_HUMAN_LINES` | `16` |
| `QUEUE_READY_MAX_HUMAN_BYTES` | `4096` |
| `QUEUE_READY_SOURCE_ITEM_LIMIT` | `100` (must equal the delivered `STATUS_SOURCE_ITEM_LIMIT`) |
| `QUEUE_READY_SOURCE_PIPELINE_LIMIT` | `20` (must equal the delivered `STATUS_SOURCE_PIPELINE_LIMIT`) |
| `QUEUE_READY_TIER_LABELS` | `["priority:high", "priority:medium", "priority:low"]` |
| `QUEUE_READY_OWNER_ATTENTION_LABELS` | `["hand-back", "human-input-needed"]` |
| `QUEUE_READY_WORK_ITEM_REF_PATTERN` | `^[A-Za-z][A-Za-z0-9]*-[0-9]+$` |
| `QUEUE_READY_BRANCH_SEGMENT_MIN` | `3` |

No live-switch constant is declared. `ADOS_QUEUE_READY_LIVE` is bound only by `tests/fixtures/queue-ready/harness.ts`, read only under `tests/**`, and enables the live suite only at exactly `1`; it is never a production or contract constant, configuration key, payload/evidence field, or human token (RES-3). There is no title constant and no title field.

Exported types (exact names): `QueueReadyConditionId`, `QueueReadyConditionState`, `QueueReadyCloseClass`, `QueueReadyAssociation`, `QueueReadyEvidenceSource`, `QueueReadyReason`, `QueueReadyEvidence`, `QueueReadyCondition`, `QueueReadyBlockingCondition`, `QueueReadyWorkItemObservation`, `QueueReadyWorkItemRelation`, `QueueReadyPullRequest`, `QueueReadyClose`, `QueueReadyCandidate`, `QueueReadyHead`, `QueueReadyRepository`, `QueueReadySummary`, `QueueReadyPayload`, `QueueReadyFacts`.

Shapes:

- `QueueReadyEvidence` = `{ source: QueueReadyEvidenceSource; reason: QueueReadyReason; detail?: string }` (spec v1.5 R-42); no `failureCode`/`failureClass` fields — a provider config or park failure carries the read's bounded failure identity as `failureCode:<code>` when a code is supplied, `failureClass:<class>` when only a class is supplied, or both joined by `; ` when both are supplied, and no `detail` when neither is supplied; it never carries a free-form detail. Every other `detail` is one of the pinned state/count/case tokens (for example `tier:priority-label; label:<label>`, `done:<n>; open:<n>; unknown:<n>`, `chain:<name>`, `result:<classified>`).
- `QueueReadyCondition` = `{ id: QueueReadyConditionId; state: QueueReadyConditionState; evidence: readonly QueueReadyEvidence[] }` (exactly 1 record for each non-provider condition; `provider-available` always exactly 2; the ≤2 cap is a defensive bound).
- `QueueReadyWorkItemRelation` = `{ relationKind: "blocked-by"; target: { entityId: string } }` — the projected relation shape: only `blocked-by` relations reach the payload (other kinds are filtered out before projection, never clamped), at most `QUEUE_READY_MAX_RELATIONS` in provider order, and the target is a provider-qualified identity projected as `entityId` only with `systemName` omitted (spec v1.4 R-34), so the whole projected target object is the capped `entityId` (`≤ QUEUE_READY_MAX_IDENTITY_CHARS`); predicates and target resolution run on the full normalized relations first.
- `QueueReadyWorkItemObservation` = `{ state: "observed"; itemState: DeliveryStateAlias; labels?: readonly string[]; updatedAt?: string; relations?: readonly QueueReadyWorkItemRelation[] } | { state: "unknown"; reason: "work-item-unobserved" }` — the normalized fields the conditions consume, projected per DM-11 (labels ≤16 × ≤128 chars in provider order, `updatedAt` ≤40 chars, at most 16 `blocked-by` relations). Observation itself is decided by the §8.3 identity rule (RES-6) over the full `identity.entityId`: an unmatched item, a wrong number, a non-digit non-canonical id, or an ambiguous shared suffix yields the `unknown` arm. No title, body, comment, assignee, or raw payload.
- `QueueReadyPullRequest` = `{ entityId: string; sourceRef: string; targetRef: string; draft: boolean; reviewStateObserved: boolean; reviewState?: DeliveryRequestReviewState }` — the pull-request provider-qualified identity is projected as `entityId` only with `systemName` omitted (spec v1.4 R-34), and `reviewState` is present only when `reviewStateObserved` is true; the three provider-derived strings are projection-clamped to `QUEUE_READY_MAX_IDENTITY_CHARS`/`QUEUE_READY_MAX_REF_CHARS` after association and selection use the full values.
- `QueueReadyClose` = `{ association: QueueReadyAssociation; associatedCount: number; pullRequest?: QueueReadyPullRequest; reason: "pr-associated" | "pr-not-associated" | "pr-not-open" | "pr-association-unknown" }`.
- `QueueReadyCandidate` = `{ workItemRef: string; rank: number; ready: boolean; closeClass: QueueReadyCloseClass; workItem: QueueReadyWorkItemObservation; close: QueueReadyClose; conditions: readonly QueueReadyCondition[] (six, fixed order); blockingConditions: readonly QueueReadyBlockingCondition[]; truncated: boolean }` (`truncated` is true only when this candidate's evidence cap dropped records; a value clamp does not set it).
- `QueueReadyHead` = `{ branch?: string; sha?: string }` (projected from `StatusHeadFacts`; `branch` clamped to `QUEUE_READY_MAX_BRANCH_CHARS`; `detached` is not emitted; the renderer derives `detached` from the missing branch).
- `QueueReadyRepository` = `{ state: "observed"; host: "github.com"; owner: string; name: string; remoteName: "origin" } | { state: "unavailable"; reason: "addressing-unresolved" | "remote-unsupported" }` — projected from `StatusRepositoryBinding`; `owner`/`name` clamped to `QUEUE_READY_MAX_OWNER_CHARS`/`_REPO_NAME_CHARS` after addressing uses the full values; no userinfo, credential, or raw remote URL.
- `QueueReadyPayload` = `{ schemaVersion: typeof QUEUE_READY_SCHEMA_VERSION; generatedAt: string; repository: QueueReadyRepository; head: QueueReadyHead; candidates: readonly QueueReadyCandidate[]; summary: QueueReadySummary; reasons: readonly QueueReadyReason[]; truncated: boolean }`.
- `QueueReadySummary` = `{ candidates: number; ready: number; notReady: number; mergeReady: number; reviewPending: number; newStart: number; unknownClose: number }`.
- `QueueReadyFacts` = `StatusFacts & { readonly candidates: readonly string[] }` — the delivered read-result types are reused verbatim; the evaluator adds no reader.

JSON key insertion order is fixed for byte-stable output: payload `schemaVersion, generatedAt, repository, head, candidates, summary, reasons, truncated`; candidate `workItemRef, rank, ready, closeClass, workItem, close, conditions, blockingConditions, truncated`; condition `id, state, evidence`; evidence `source, reason, detail?`; close `association, associatedCount, pullRequest?, reason`; summary `candidates, ready, notReady, mergeReady, reviewPending, newStart, unknownClose`.

### Pure domain module — `packages/core/src/domain/queue-ready.ts` (new)

Exported functions only:

- `evaluateQueueReady(facts: QueueReadyFacts): QueueReadyPayload` — pure; no I/O, clock, randomness, or environment. Resolves candidate identities (candidate-set-scoped, RES-6/spec v1.4 R-31) and `blocked-by` target identities (observed-work-item-set-scoped, RES-6/spec v1.4 R-33) by the §8.3 rule, evaluates the six conditions per candidate, the close association/classification, ranking, evidence assembly/capping, top-level reasons, the provider-derived output projection with its caps (projected identities `entityId`-only, no `systemName`) and the deterministic byte-budget reduction, the summary, and the payload truncation flags.
- `renderQueueReadyHuman(payload: QueueReadyPayload, brand: BrandIdentity): string` — pure; derives the digest only from the payload and the injected brand; no extra reads, clock, environment, or randomness. Shortens each per-candidate provider segment to `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` with a trailing `+`.

Internal (not exported) helpers own canonical refs, the canonical-ref length check, the §8.3 identity comparator with its role-specific uniqueness domains (unique requested-candidate suffix for candidate observation; unique observed-work-item suffix for `blocked-by` targets) and its ambiguity rule, the numeric-aware comparator, the `blocked-by`-only relation projection (target `entityId` only, no `systemName`), the provider-derived value/count clamps, the byte-budget reduction, detail clamping, the evidence cap, and the human line assembly. No title is projected or clamped. No additional exported executable names are added to the domain module.

### Shared pure CI classification — `packages/core/src/domain/ci-result.ts` (new)

`classifyPipelineRuns(runs: readonly PipelineRun[]): StatusCiResult` — the exact delivered status classification, extracted verbatim: any `failed` → `failed`; any `running`/`queued` → `pending`; any `canceled` → `canceled`; any `succeeded` and every state `succeeded`/`skipped` → `succeeded`; otherwise `none`. `domain/status.ts` imports it and drops its private duplicate so `status` and `queue ready` cannot diverge. The existing status suites and golden digest prove the extraction is behaviour-preserving.

### Condition evaluation rules (pinned)

Evaluation order is always `QUEUE_READY_CONDITION_ORDER`. Each non-provider condition carries exactly one evidence record and `provider-available` always emits exactly two (RES-5); the `QUEUE_READY_MAX_EVIDENCE_PER_CONDITION` cap is a defensive bound exercised only by a synthetic evaluator input (RES-2).

| Condition | `satisfied` | `unsatisfied` | `unknown` | Evidence (source · reason · detail) |
|---|---|---|---|---|
| `deps-satisfied` | relations signal available; every `blocked-by` target observed `done`/`canceled` (zero targets included), with each target resolved by the §8.3 identity rule | at least one target observed with a non-done, non-canceled delivery state | candidate unobserved (failed/unattempted tracker read, no §8.3 candidate match, or ambiguous shared suffix) first → `work-item-unobserved`; otherwise relations signal unavailable → `signal-unavailable`; otherwise at least one target unobserved (no §8.3 target match or an ambiguous target) and none known open → `dependency-unobserved` | exactly one `tracker` record: `no-blocked-dependencies` (no detail) / `dependencies-done`, `dependency-open`, or `dependency-unobserved` with detail `done:<n>; open:<n>; unknown:<n>` (the three counts sum to the total `blocked-by` relation target count, observed + unobserved — spec v1.4 R-32; no target refs) / `signal-unavailable` (no detail) / `work-item-unobserved` (no detail) |
| `repo-free` | local PM context observed and no `active_change`, or the active change equals the candidate (case-insensitive) | another active change is recorded | context missing or malformed | `local-context` · `no-active-change` detail `repo:local-context` / `candidate-is-active` detail `repo:local-context; candidate-is-active` / `other-active-change` detail `repo:local-context; active-change:{ref}` / `local-context-missing` (no detail) / `local-context-malformed` (no detail) |
| `tier-known` | labels observed and exactly one distinct recognized tier label | two or more distinct recognized tier labels | work item/labels unobserved (candidate unobserved first → `work-item-unobserved`), label signal declared unavailable (`signal-unavailable`), or zero recognized labels (`tier-absent`) | `tracker` · `tier-label` detail `tier:priority-label; label:{declared label}` / `tier-conflict` detail `tier:priority-label; labels:{sorted declared labels}` / `tier-absent` detail `tier:priority-label; none` / `work-item-unobserved` / `signal-unavailable` |
| `no-owner-gate` | labels observed and none of `hand-back`/`human-input-needed` | one or more declared owner-attention labels | work item/labels unobserved (candidate unobserved first → `work-item-unobserved`) or the label signal declared unavailable (`signal-unavailable`) | `tracker` · `no-owner-labels` (no detail) / `owner-labels` detail `owner-labels:{sorted declared labels}` / `work-item-unobserved` / `signal-unavailable` |
| `ci-healthy` | binding observed, HEAD SHA resolved, check-runs read succeeded, classification `succeeded` | classification `failed`/`pending`/`canceled`/`none` | binding unavailable (`addressing-unresolved`/`remote-unsupported`, read not attempted); HEAD SHA unresolved (`commit-unresolved`, read not attempted); credential unavailable; read failed (`read-failed` + bounded code/class) | `ci` · `ci-succeeded`/`ci-failed`/`ci-pending`/`ci-canceled`/`ci-none` detail `result:{classified}`; unknowns as named; `repository-binding` · binding reason with no detail |
| `provider-available` | config and park fold observed, default chain declared and resolved, no active chain park, at least one enabled chain entry with no active provider park | no enabled entry, every enabled entry parked, or an active chain park for the declared chain | config read failed mapped by the read's own `reason` (`config-invalid` or `provider-chain-unresolved`, RES-8/spec v1.4 R-30), no default chain (`provider-chain-not-declared`), declared chain absent from `chains` in the defensive pure-evaluator `ok:true` view (`provider-chain-unresolved`), or park fold failed (`provider-parks`/`state-unreadable`) | case record then `{ provider-config · engine-not-run }`; case: `provider-parks` · `no-active-park`/`all-entries-parked` detail `chain:{name}`; `provider-parks` · `chain-parked` detail `chain:{name}; until:{expiresAt\|none}; cause:{cause\|none}`; `provider-config` · `no-enabled-entry` detail `chain:{name}`; `provider-config` · `config-invalid`/`provider-chain-unresolved` with the pinned `failureCode`/`failureClass` detail form when supplied (the command-level unresolved case carries `detail:"failureCode:config.value.invalid"`); `provider-config` · `provider-chain-not-declared` (no failure detail); `provider-parks` · `state-unreadable` with the park read's code/class in the same pinned form where supplied |

Pinned sub-rules:

- **Candidate observation (§8.3 identity rule, spec v1.4 R-31)**: condition evaluation stays independent per candidate over the same shared facts, while identity observation is candidate-set-scoped. A candidate is observed only when the observed page contains an item matched by RES-6 — an exact case-insensitive full-value `identity.entityId` equal to the canonical ref, or an all-ASCII-digit `identity.entityId` equal to the canonical numeric suffix of exactly one requested candidate. Matching runs per candidate over the same page on the full normalized value, before any output clamp; when a bare all-ASCII-digit value matches the suffix of more than one requested candidate, that item is unobserved for **every** sharing candidate, assigned by no precedence and independent of caller order. One candidate's observation never changes because of another candidate's condition verdicts. There is no substring, prefix, or numeric coercion (`0176` ≠ `176`, `007` ≠ `7`, exact `GH-007` does not match `"7"`, `issue-176`/`GH-176-extra` never bridge).
- **Unobserved work item** (read failed/unattempted, no §8.3 identity match, or an ambiguous shared suffix) makes the three tracker-derived conditions `unknown` with exactly one `{ source: "tracker", reason: "work-item-unobserved" }` record, evaluated before relation/label-signal availability; it never becomes an empty label set, an untriaged default, or "no dependencies". Label-signal availability is the delivered `tracker.availability.ownerHandBacks` (the only label-derived availability in the read); `deps-satisfied` uses `tracker.availability.blockedDependencies`.
- **Deps precedence**: candidate unobserved first, then relations-signal-unavailable, then the target predicate. Each `blocked-by` target is resolved by the same §8.3 rule with the target's own uniqueness domain — the **observed work-item set**, not the requested candidate set (spec v1.4 R-33): exact case-insensitive full-value identity first, then the unique all-ASCII-digit bridge only when exactly one observed work item carries that numeric suffix. A canonical-shaped target whose exact identity matches an observed item that is not a requested candidate is observed by exact match; a target that matches nothing, or whose digit string is shared by more than one observed work item with no exact match, is unobserved (`dependency-unobserved`), never assumed done. No target refs are emitted; the single evidence detail is the state-count summary, whose three counts sum to the total `blocked-by` relation target count (observed + unobserved). An observed candidate with unavailable relations is `signal-unavailable` even when zero relations are visible.
- **Tier**: matching is case-insensitive over the declared set; duplicate spellings of the same declared label count once; the detail uses the declared lowercase token and always names the proxy source `tier:priority-label`; conflict labels are sorted ascending. The predicate runs over the full label set before any projection cap, so a beyond-cap tier label still decides the condition (TC-QREADY-038).
- **Owner gate**: `assignee` is never read (ADR-0006); a satisfied condition carries no detail and an unmet one carries `owner-labels:{sorted declared labels}`. As with tier, the predicate runs over the full labels before projection.
- **CI**: binding failure is checked before SHA resolution (the read was not attempted), SHA resolution before the read result. The classification runs over the whole delivered page. `none` never satisfies. An all-skipped page classifies as `none`/`ci-none` through the delivered classifier (skipped jobs are not failures and never make it `succeeded`).
- **Provider**: entry names come from `config.chains[defaultChain].entries`; enabled means `config.entries[name]?.enabled === true`; an active park is `state === "active"`; chain park matches `subjectKind === "chain" && subjectName === chain.name`; provider park matches `subjectKind === "provider" && subjectName === entryName`. A failed config read is mapped by its own `reason` (`!config.ok` is never blanket-mapped): `{ok:false, reason:"config-invalid"}` → `config-invalid`, `{ok:false, reason:"provider-chain-unresolved"}` → `provider-chain-unresolved`, mirroring `packages/core/src/domain/status.ts` (RES-8, spec v1.4 R-30); the `ok:true` declared-chain-missing view is a defensive pure-evaluator branch that also yields `provider-chain-unresolved`. A park-fold failure is always `provider-parks`/`state-unreadable`, never a config reason; a config or park failure record carries the read's bounded failure identity in the pinned `failureCode:<code>` / `failureClass:<class>` / both `; `-joined form when supplied and no `detail` otherwise, never a free-form detail (spec v1.5 R-42). The engine is never called. No provider evidence record and no availability claim uses `available` as a claim or state; the pinned condition id `provider-available`, the `QUEUE_READY_CONDITION_ORDER` list, `blockingConditions`/human `blocking:` references, payload keys, summary tokens, and close classes are exempt, and every negative `available` scan is scoped to the provider evidence records/details and the provider human-text segment — never the whole payload or digest (R-21).
- **Provider-derived projection (output-only)**: the nine caps plus the 32-character human segment cap are applied only when building the payload and the digest, after every predicate, association, and ranking decision (RES-7). Only `blocked-by` relations are projected; every other relation kind is filtered out entirely, never clamped or carried. Every projected provider-qualified identity (each relation target and the selected pull request) is projected as its `entityId` only with `systemName` omitted, so the whole identity object is the capped `entityId` (spec v1.4 R-34); there is no tenth cap. Labels and relations keep provider order and are reduced from the end at the count cap; identity/ref/label/owner/name/branch/timestamp values are prefix-clamped, never substituted. Any clamp sets payload `truncated` and adds `value-clamped` once in group 2 and never changes a condition state, `blockingConditions`, `closeClass`, `rank`, `associatedCount`, or `summary`.

### Close association, classification, and selection (pinned)

- **Association match**: `sourceRef` split on `/`; require at least `QUEUE_READY_BRANCH_SEGMENT_MIN` (3) segments, every segment non-empty, and at least one segment equal to the canonical candidate ref case-insensitively. `targetRef` is ignored.
- **Open match**: an observed or evaluator-injected object whose normalized state is neither `merged` nor `closed` (draft is an open match).
- **Merged/closed match (evaluator-injected views only)**: the delivered command read is open-only (`?state=open`) and cannot contain such an object. In a pure-evaluator injected normalized view, a matching `merged`/`closed` object is never an associated open close item — never selected, never counted, never `merge-ready`/`review-pending`.
- **Command-level read outcome**: binding unavailable or `changes` read failed → `association: "unknown"`, `associatedCount: 0`, reason `pr-association-unknown`. Successful open-only read with at least one open match → `associated`. Successful open-only read below the page limit with no open match → `not-associated` with `pr-not-associated` (never `pr-not-open`). Successful open-only read at or above `QUEUE_READY_SOURCE_ITEM_LIMIT` with no open match → `unknown` with `pr-association-unknown` (the at-limit rule wins).
- **Pure-evaluator injected-view outcome**: below the page limit, no open match, and at least one matching merged/closed object → `not-associated` with `pr-not-open` and the not-associated fallback class; otherwise the command-level rules above apply. At the page limit with no open match, `unknown`/`pr-association-unknown` wins over `pr-not-open`.
- **Count**: open matches only; exact below the page limit; the observed page count (a lower bound) at the limit; `0` on failed read/unavailable binding; always in `0..100`; never separately capped.
- **Selection**: selection happens within one close class: the merge-ready set when non-empty (open matches with `reviewStateObserved === true`, `reviewState === "approved"`, and `draft === false`), otherwise the full associated open set. Within the selected set, order by `entityId` ascending with a numeric-aware comparison — when both raw values are all-ASCII-digit, compare their unsigned integer values and treat equal numeric values as a tie at this key (so `7` and `007` tie); otherwise compare the values lexically — then `sourceRef` ascending, then `targetRef` ascending, then, only when all three keys are equal, the lexically smaller raw `entityId` string. API return order never decides. `reviewStateObserved = changes.availability.reviewState === "available"`; `draft = reviewState === "draft"`.
- **Class**: selected merge-ready → `merge-ready`; else any open match → `review-pending`; else candidate ready and association `not-associated` → `new-start`; else candidate ready and association `unknown` → `unknown`; else `not-ready`.

### Ranking (pinned)

Class rank `merge-ready` 0, `review-pending` 1, `new-start` 2, `unknown` 3, `not-ready` 4. Within a class, ascending numeric suffix of the work-item ref, then ascending canonical ref text. The numeric suffix is the base-10 digits after the final hyphen; refs with equal numeric value compare by canonical text, so `GH-007` sorts before `GH-7` (canonical text ascending). Caller order and API return order are never tie-breakers. `rank` is the 1-based position after sorting.

### Top-level reasons and truncation (pinned)

`reasons` is the unique union of the six `QUEUE_READY_REASON_ORDER` groups, first occurrence wins, capped at `QUEUE_READY_MAX_REASONS` (6). Group 1 is the binding outcome. Group 2 is exactly `QUEUE_READY_PAYLOAD_MARKER_REASONS`: `source-truncated` then `value-clamped`, each at most once and both always retained when emitted (group 2 precedes groups 3–6 and at most two group-1 reasons can precede them inside the six-entry cap). Group 5 walks `QUEUE_READY_CONDITION_ORDER` and each condition's evidence array, appending only `QUEUE_READY_SOURCE_FAILURE_REASONS`; `read-failed` and `credential-unavailable` live only there. Group 6 is exactly the single token `pr-association-unknown` and is last: a pull-request read failure that produced no condition evidence is represented by `pr-association-unknown` alone, and the same failure that did produce a condition record appears once, in group 5. `source-truncated`/`value-clamped` are payload markers only and never condition or close evidence. A tracker read failure is represented only by the condition records it actually produces; no synthetic `read-failed` is added when the tracker-derived conditions carry only `work-item-unobserved`. Verdict/observation reasons (`ci-pending`, `tier-conflict`, `dependency-open`, `dependency-unobserved`, `pr-associated`, `pr-not-associated`, `pr-not-open`, `no-active-park`, …) never enter `reasons`.

Truncation flags:

- Evidence-cap overflow (a condition produced more than two records): retain the first two in evaluation order; set the affected candidate `truncated` **and** the payload `truncated`. The delivered condition set reaches two records only in `provider-available`, so this branch is a defensive contract rule exercised only by a synthetic over-cap evaluator input.
- Reason-cap overflow (more than six unique reasons): retain the first six; set the payload `truncated` only.
- Source-at-limit (`tracker.pageItemCount >= 100`, or `changes.pageItemCount >= 100`, or `ci.pageItemCount >= 20` on a successful read): append payload-level `source-truncated`; set the payload `truncated` only; never change a condition state/evidence/blocking list (the CI 20-run case is verdict-neutral).
- Provider-derived value/count clamp or byte-budget reduction: append payload-level `value-clamped` after `source-truncated` when both are present; set the payload `truncated` only; the affected candidate's `truncated` stays unchanged because no evidence record was dropped; no verdict changes.
- Detail (>160) clamping: no flag. There is no title field and no title clamp.
- The 65 536-byte serialized `data` bound is a hard contract. The evaluator clamps provider-derived values/counts, drops trailing relations then trailing labels (last-ranked candidate first, highest index first, rechecking after each drop) until the payload fits, and caps evidence/reasons; it never silently truncates bytes. An over-budget payload that reaches the serializer without that reduction is a contract failure, not a runtime path. Conditions, evidence, close data, summary, `reasons`, and `rank` are never dropped.

### Payload and human digest (pinned)

Machine data is the `QueueReadyPayload` above inside exactly one standard `CommandResult` envelope; a success envelope carries no `error` key; no raw provider payload, response body, credential, comment, or free-form message appears anywhere.

Human digest (Appendix F, pinned grammar; braces are metavariables):

```text
{binary} queue ready {owner}/{name} @ {branch|detached} {sha7}
ready {n} | not-ready {n} | merge-ready {n} | review-pending {n} | unknown-close {n}{+more}
{rank}. {ref}  {closeClass}  {detail}  [repo:local-context; tier:priority-label]
```

- The header is emitted only when the repository binding is `observed` and the SHA is resolved; it uses `brand.binaryName`, the binding owner/name, the attached branch or `detached`, and the first seven SHA characters. Otherwise the header is omitted.
- `+more` follows the summary only when the payload-level `truncated` is true.
- Exactly one summary line and exactly one line per candidate in rank order.
- `{detail}`: `PR #{entityId} {sourceRef}` for an associated close item (`merge-ready` or `review-pending`); `all six readiness conditions satisfied` for `new-start`; `close association unknown` for `unknown`; `blocking: {id}={state}, …` for `not-ready` in condition order. An associated close item that is not ready prints the close evidence, then ` | blocking: …`.
- Each per-candidate provider segment — `PR #{entityId}` as one segment and `{sourceRef}` as the other — is rendered to at most `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` (32) characters and marked with a trailing `+` when shortened. This is a renderer rule only: the payload keeps its own `QUEUE_READY_MAX_IDENTITY_CHARS`/`_REF_CHARS` capped values, and shortening adds no `value-clamped` marker.
- Every candidate line ends with the fixed proxy-source suffix `[repo:local-context; tier:priority-label]` after its detail and any `blocking:` segment, so the local-context and priority-label proxies are visible in human output.
- No titles, timestamps, raw payloads, secrets, or LLM prose. At most 16 lines and 4096 bytes. Per DM-12, a candidate line is at most 400 bytes at the declared caps (ref 64, close class 14, two ≤32-character provider segments, six `id=state` pairs, the 41-byte proxy suffix) and the header (excluding the injected binary name) plus the summary line at most 620 bytes, so the capped digest stays inside 4096 bytes for a binary name of at most 276 characters; an over-cap render is a test failure.

### CLI and composition spellings

- `packages/cli/src/commands/queue.ts` (new): `QueueReadyCommandRuntime` (type alias of `StatusCommandRuntime` — the delivered reader set; no new reader) and `createQueueReadyCommandDefinition(runtime: QueueReadyCommandRuntime): CommandDefinition`.
  - `flags: []`; `positionals: { max: QUEUE_READY_MAX_POSITIONALS }` (33); `humanText: (data, brand) => renderQueueReadyHuman(data as QueueReadyPayload, brand)`.
  - Handler: run the pure grammar first (no reads): `positionals[0] === "ready"`, 1..`QUEUE_READY_MAX_CANDIDATES` refs, each matching `QUEUE_READY_WORK_ITEM_REF_PATTERN`, then canonicalize, then enforce `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS` (64), then reject duplicates after canonicalization (rejected as `input.value.rejected`, never silently merged). The exact order is canonicalize → length → duplicate → any read. On rejection return `{ error: { kind: "input", code: "input.value.rejected", summary: "result=failed; reason=grammar" } }`. Only after a clean grammar call `collectStatusFacts(runtime)` once and return `{ data: evaluateQueueReady({ ...facts, candidates: canonicalRefs }) }`. No stream write, no exit code, no error envelope for a source failure.
  - Canonicalization: prefix = the substring before the final hyphen, uppercased (ASCII only); digits preserved exactly, including leading zeros; the canonical ref must be at most 64 characters (a 64-character ref is accepted, 65+ rejected) before duplicate detection and any read; duplicate detection compares canonical strings.
- `packages/cli/src/commands/status.ts` (updated): extract `collectStatusFacts(runtime: StatusCommandRuntime): Promise<StatusFacts>` — the exact read sequence now inside the status handler, preserving its **two independent gates**: (a) repository facts first, then, if `repository.binding.state === "observed"`, read the issues page at `STATUS_SOURCE_ITEM_LIMIT` and the pulls page at `STATUS_SOURCE_ITEM_LIMIT`, otherwise pass the pinned `{ ok: false, reason: "not-configured" }` read for both; (b) if the binding is observed **and** `repository.head.sha !== undefined`, read the check-runs page at `STATUS_SOURCE_PIPELINE_LIMIT`, otherwise pass `{ ok: false, reason: "commit-unresolved" }` when the binding is observed and `{ ok: false, reason: "not-configured" }` when it is not. Then one provider-config resolve, one park fold, one local-context read, and injected `nowIso`/`nowMs`. The issues/pulls reads are never gated on SHA resolution, so a binding-observed, SHA-absent run still observes issues/pulls and only CI is `commit-unresolved` (making the `not-ready-ci-unresolved` row — `S S S S ? S` — reachable). The status handler becomes `aggregateStatus(await collectStatusFacts(runtime))`; status behaviour is unchanged (the delivered handler already uses these two gates) and the status suites plus `tests/golden/status-digest.test.ts` prove it. `queue.ts` consumes the same function, so the read sequence is not duplicated and no adapter read is added.
- `packages/cli/src/commands/index.ts` (updated): export `QueueReadyCommandRuntime` and `createQueueReadyCommandDefinition`.
- `packages/cli/src/edge.ts` (updated): add `readonly queueReady?: StatusComposition` to `ConfigProgramOptions`; hoist the existing provider-config resolver closure into one local `resolveProviderConfig` used by both commands; compose `commands.queue = createQueueReadyCommandDefinition(createStatusCommandRuntime(options.queueReady, resolveProviderConfig))` when `options.queueReady` is supplied. No new edge executable export and no change to the status composition.
- The `queue` partial-family note ("the M0 ready-set; lanes/dispatch arrive in M2-S1") lives only in the module doc comment and the command-registry doc (Phase 7). The delivered CLI has no help command or rendered descriptor for commands, and this change adds none; no help test step exists.

### Exact error-identity reuse

- **No new error-table row or domain kind.** The queue handler can fail only through `input.value.rejected` (handler grammar, kind `input`, exit `1`) and `fallback.internal` (containment). The global parser keeps `fallback.invocation` for unknown flags and the 34th positional. A source read failure is condition/close evidence and the command returns a success envelope with exit `0`.
- **No error-table identity is used as an evidence reason.** Condition reasons come only from `QUEUE_READY_EVIDENCE_REASONS`. Failure details reuse existing `config.*`/`state.*` codes and adapter-local classes as bounded text in the pinned `failureCode:<code>` / `failureClass:<class>` / both `; `-joined form, never as identities and never as a free-form detail (spec v1.5 R-42).

## Delivery Bindings (D1..D11)

Binding for delivery; behaviour, pinned identities, tokens, and AC mappings come from the spec/test plan and may not change.

- **D1 — Module layout**: new `packages/core/src/contracts/queue-ready.ts`, `packages/core/src/domain/queue-ready.ts`, `packages/core/src/domain/ci-result.ts`, `packages/cli/src/commands/queue.ts`; extended `contracts/index.ts`, `domain/index.ts`, `domain/status.ts`, `core/src/index.ts`, `cli/src/commands/status.ts`, `cli/src/commands/index.ts`, `cli/src/edge.ts`. No new package, subpath, package export, or runtime-API location; no adapter/state/config/provider code change.
- **D2 — Single vocabulary home**: every condition id/state/order, evidence source/reason (including `value-clamped`), close class, rank class, reason group, payload marker group, cap, limit, provider-derived projection cap, numeric-entity-id pattern, human segment cap, label set, ref pattern, canonical-ref length bound, and schema version is declared once in `contracts/queue-ready.ts`; the domain and command consume it. Tests may hold independent oracles.
- **D3 — Domain purity**: `domain/queue-ready.ts` and `domain/ci-result.ts` import only `#contracts`/relative domain types; no `node:*`/`bun:*`, adapter, state, config, provider-implementation, parser, file, clock, randomness, or environment access. All variable facts arrive through `QueueReadyFacts`; the brand arrives as a renderer argument. Pure work owned here: the §8.3 identity resolution, the `blocked-by`-only relation projection, the provider-derived output projection and byte-budget reduction, and the human segment shortening.
- **D4 — Command purity and composition**: the queue handler owns no stream writes and no exit codes; grammar (including the canonical length check) runs before any read; all reads are injected through `StatusCommandRuntime`; the edge is the only composition point; the parser bound is `QUEUE_READY_MAX_POSITIONALS` and there are no command flags (`--json` is global).
- **D5 — Read reuse**: `queue ready` calls the delivered status readers exactly as `status` does, through the shared `collectStatusFacts`; one bounded issues page, one bounded pulls page, one bounded check-runs page for the checkout HEAD, one provider-config resolve, one logical park fold, one local-context read. No new adapter operation, closed-issue read, per-issue detail read, GraphQL review read, quota fetch, retry, pagination, or provider-engine call. Credentials resolve only through the delivered credential port; no ambient environment read.
- **D6 — Truthfulness**: an absent, failed, unattempted, unavailable, unobserved, or unresolved source is `unknown`; only an observed value meeting the predicate is `satisfied`. Candidate and `blocked-by` target identities resolve by the §8.3 rule over full values with role-specific uniqueness domains (requested candidate set for observation, observed work-item set for targets), so an observable GitHub-shaped item is never silently unobserved while a shared bare-numeric suffix leaves the item unobserved for every sharing candidate. `merge-ready` requires an observed approval on a non-draft open PR. Unknown association is never `new-start`. No-run/none CI is never healthy. Provider availability is never engine-verified: no provider evidence record and no availability claim uses `available` as a claim or state, while the pinned condition id `provider-available` and its condition-id/`blocking:` references are exempt and every scan is scoped to provider evidence/details and the provider human-text segment. The delivered command read is open-only; merged/closed exclusion and `pr-not-open` are provider-agnostic pure-evaluator rules over injected normalized views. A raw page at its limit is coverage evidence only and never a verdict.
- **D7 — Determinism and bounds**: fixed condition order, fixed close matrix, fixed rank keys, fixed reason order, fixed JSON key order, injected clock, no randomness/environment. Exact caps from Appendix C (including the nine provider-derived caps, the numeric-entity-id pattern, and the 32-character human segment). Every projected provider-qualified identity is `entityId`-only with `systemName` omitted, so the whole projected identity object is bounded by `QUEUE_READY_MAX_IDENTITY_CHARS`. Provider-derived clamping and the trailing-relation-then-label byte-budget reduction are output-only, set payload `truncated` plus one `value-clamped` in group 2, and never change a verdict; evidence overflow sets candidate+payload (synthetic, because only `provider-available` reaches two records); reason overflow and source-at-limit set payload only; detail clamping sets nothing; there is no title field or title cap; byte bounds are hard contracts.
- **D8 — Error-identity reuse**: no error-table, domain-kind, envelope, exit-taxonomy, or sync-table change; only `input.value.rejected` and `fallback.internal` can fail the handler; the parser keeps `fallback.invocation`. `scripts/checks/error-table-sync.ts` stays green with byte-identical tables.
- **D9 — Fixture hygiene and non-vacuity**: committed fixtures read-only; derived/mutated fixtures self-materialize under fresh `mkdtemp` roots and are removed in teardown; every negative/matrix/cap fixture carries a distinctive planted canary and a restored/valid control; every recorder/stub is proven live by a seeded deliberate call; the live tree is clean after every suite. A raw provider title may appear only as a privacy canary on the input facts, never as a payload or digest field. Provider park fixtures are built from verified bytes with the real state harness. Identity fixtures use provider-shaped `identity.entityId` values (`"176"`, `"179"`, `"7"`, `"0176"`) with canonical requested refs and assert the exact/bridge/wrong-number/ambiguous/leading-zero rows together, including the relation-target twin and the canonical-observed-target-not-requested row (`GH-179` observed while not requested resolves by exact match); provider-cap fixtures ship a no-caps oracle twin so output-only equality can be asserted field by field, and include an over-long `systemName` (200 characters) on relation targets and pull-request identities proving the key and value never enter the payload or digest.
- **D10 — Inline committer protocol for `@coder`**: exactly one Conventional Commit per phase with the completion signal below; explicit `git add` of exactly the phase's files; verify the staged set with `git status --porcelain` before committing; never stage `.ai/local/**`, `tmp/**`, or untracked scratch; `pnpm check` green before every commit with the log captured under `.ai/local/` (never staged); no push, no amend; a red gate blocks the commit. PM owns `@doc-syncer` for Phase 7.
- **D11 — Changeset, evidence, and no new surface**: one minor changeset for the lockstep fixed group (`.changeset/queue-ready-minor.md`, `.changeset/config.json` `fixed`), brand-neutral summary text, no hand-bumped versions; `chg-GH-176-evidence.md` in this folder; the opt-in live smoke stays outside `pnpm check` and default CI; no title field; no new CI job, check, configuration key, state-schema change, package/subpath, runtime-API location, or secret-read allowlist entry.

## Scope

### In Scope

- The `queue` command with the `ready` subcommand positional, handler grammar, canonicalization/length/duplicate rejection, parser bound, and edge composition (F-1, F-2, AC-F1-1, AC-F1-3; Phase 2).
- The complete `delivery.queue-ready.v1` vocabulary as data/types: condition ids/order, tri-state states, evidence sources/reasons (41 tokens including `value-clamped`), close classes, rank classes, the six reason groups with the group-2 payload marker list and the exact group-6 token, caps/limits (64-character canonical ref bound, nine provider-derived projection caps, numeric-entity-id pattern, 32-character human segment), tier/owner label sets, ref pattern, schema version (F-3, F-12, DM-1..DM-13, Appendix C; Phase 1).
- The pure evaluator, §8.3 identity resolution, close classifier, ranker, provider-derived output projection (clamps plus byte-budget reduction), and human renderer over injected facts (F-3..F-14; Phase 1, proven in Phases 3–5).
- Candidate observation and `blocked-by` target resolution over provider-shaped identities with the exact-canonical, unique-numeric-suffix, ambiguity, and no-coercion rules: condition evaluation independent per candidate over shared facts but identity observation candidate-set-scoped (a shared bare-numeric suffix leaves the item unobserved for every sharing candidate, no precedence or caller order), and target uniqueness over the observed work-item set including a canonical-shaped observed target that is not a requested candidate (F-2, F-4, §8.3, AC-F2-3, AC-F4-2; Phases 1, 3).
- `deps-satisfied` from normalized `blocked-by` relations with unavailable/unobserved = unknown, candidate-unobserved precedence, observed-set target resolution, and one state-count evidence record whose three counts sum to the total `blocked-by` relation target count (observed + unobserved) (F-4, DEC-5, DEC-11; Phase 3).
- `repo-free` from the local PM context with `repo:local-context` proxy details (F-5, DEC-4; Phase 3).
- `tier-known` from exactly one recognized triage label with `tier:priority-label` proxy details, and `no-owner-gate` from the declared owner-attention labels (F-6, F-7, DEC-3, DEC-6; Phase 3).
- `ci-healthy` from the current checkout HEAD's one bounded check-runs page, only `succeeded` satisfying, all `unknown` modes named (F-8, DEC-7; Phase 3).
- `provider-available` from the declared chain plus the verified park fold, exactly two evidence records, engine never run, config failures mapped by the read's own reason, and no provider claim using `available` (the pinned condition id is exempt) (F-9, DEC-8; Phase 4).
- Close association by the branch convention, `merge-ready`/`review-pending`, command-level open-only association (`pr-not-associated`), evaluator-only merged/closed exclusion and `pr-not-open`, `associatedCount`, deterministic selection, and the explicit unknown class (F-10, DEC-9, DEC-12; Phase 4).
- Ranking with close items above new starts and numeric-aware ref ties (`GH-007` before `GH-7`) (F-11, DEC-9; Phase 4).
- Bounded machine payload and deterministic human digest (including the fixed proxy-source suffix on every candidate line and the 32-character provider segments with trailing `+`), the nine provider-derived output caps with `entityId`-only projected identities (`systemName` omitted), the `value-clamped` marker and the deterministic byte-budget reduction, exact truncation-flag scope, 64-character ref cap, 64 KiB/16-line/4096-byte bounds, and no title field (F-12, F-13, DM-11, DM-12; Phase 5).
- Evidence/non-verdict discipline and the exhaustive AC-F14-1 negative-control matrix (F-14; Phase 5).
- Reuse of the delivered status reads with no new adapter read; read-only/deterministic/brand-neutral execution; error-identity reuse (F-15, F-16; Phases 1–5).
- The committed fixture corpus, golden bytes, performance/read-cost proof, and opt-in structural live smoke (F-17; Phase 6).
- The minor changeset, delivery evidence, and final local battery (Phase 6).
- The new current-truth feature doc and the surrounding doc reconciliation (Phase 7, `@doc-syncer`).

### Out of Scope

- NG-1: any queue, lane, dispatch, supervision, board, brief, merge, deploy, closeout, scheduling, per-repo single-flight, preemption, or build-weight engine (M2-S1); a merge-gate battery (`verify gates`, M0-S9) is not evaluated.
- NG-2: automatic candidate discovery, open-issue enumeration as a candidate source, implicit active-change candidates, or fleet-wide ready sets.
- NG-3: provider-engine execution, engine chain resolution, quota evaluation/fetch, announcements, park writes/clears, provider telemetry, spawn selection.
- NG-4: any mutation — tracker/PR/CI writes, state appends, fences, park clears, projection rebuilds, pm-notes writes, PM-context writes.
- NG-5: new GitHub reads, closed-issue pages, GraphQL review decisions/threads, structured issue-dependency reads, open-PR-head CI, or a full GitHub adapter.
- NG-6: new configuration keys or branches for queue readiness, tier/owner label sets, candidate caps, repository addressing, or thresholds; any state-schema change.
- NG-7/NG-8: LLM summarization, semantic ranking, recommendations, prose, MCP/OpenCode surfaces, agent-prompt adoption, or replacing `status`/`verify`/`lint`.
- NG-9: new error-table rows/identities, result-envelope changes, new packages/subpaths/runtime-API locations, new secret-read allowlist entries.
- NG-10: reading pm-notes phase ledgers, a per-ticket `DeliveryTier` field, or a pm-notes-`variant`-derived tier.
- Publishing, merge, or owner acceptance; any new CI job/check; any cloud-product content.

### Constraints

- D1..D11 are binding (module layout, single vocabulary home, domain purity, command purity, read reuse, truthfulness, determinism/bounds, error-identity reuse, fixture hygiene, committer protocol, changeset/no new surface).
- **Commit strategy**: exactly one Conventional Commit per phase with the completion signals below; explicit `git add` of the phase's files; never stage `.ai/local/**` or `tmp/**`; no push during delivery; no amend; `pnpm check` green before every commit (D10).
- Strict TypeScript, injected time/randomness/environment, runtime-API confinement, and `bun:test` authoring per [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md); suite layout and the gate battery per [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md).
- The forbidden-literal scanner matches `ados`, `ADOS_`, and `~/.ados` in `packages/**` and registered `doc/**`; no production constant carries a live-switch name. `ADOS_QUEUE_READY_LIVE` is bound only by `tests/fixtures/queue-ready/harness.ts`, read only under `tests/**`, and enabled only at exactly `1` (RES-3).
- The user-facing human header must derive from `brand.binaryName`; no product/binary literal is committed. The payload and digest carry no title field; a provider title may appear only as a raw-fact privacy canary.
- `GITHUB_TOKEN` resolves only through the delivered credential port; no package reads ambient environment outside the four-entry secret-read allowlist. The queue modules add no allowlist entry.
- **Identity and cap invariants**: candidate and `blocked-by` target matching always uses the full normalized identity (never the projected value) with role-specific uniqueness domains — the requested candidate set for observation (candidate-set-scoped; a shared suffix leaves the item unobserved for every sharing candidate) and the observed work-item set for targets (a canonical-shaped observed target that is not a requested candidate resolves by exact match) — and the nine provider-derived caps plus the 32-character human segment are output-only, with every projected provider-qualified identity `entityId`-only and no `systemName`; any implementation that matches on a clamped value, resolves a target against the requested candidate set, emits a non-`blocked-by` relation or a `systemName`, or lets a clamp change a verdict fails TC-QREADY-036/037/038 by name.
- The GitHub slice declares blocked-dependency relations and review state unavailable; `deps-satisfied` is `unknown` and `merge-ready` is unreachable there. These are truthful declared gaps, not failures.
- No file system/clock/environment access in the pure domain; `queue ready` performs no child process, network write, or quota fetch.
- Phase gate = the phase's focused suites green plus the named invariant checks plus `pnpm check` exit 0.
- **Rollback and failure handling**: the change is fully additive — a single-PR revert removes the contracts/domain/command/tests/fixtures/changeset/evidence/docs together, with no data cleanup (`queue ready` wrote nothing). Never roll back one side of an inventory or documented-table change without the other. A failing phase stops at its last green task boundary and reports; any discovered spec/test-plan inconsistency escalates to PM — the plan never reshapes a TC.

### Risks

| ID | Risk | Impact | Probability | Mitigation (plan anchor) |
|---|---|---|---|---|
| RSK-1 | A consumer reads `unknown`/`unsatisfied` as ready or "nothing blocks it" (spec RSK-1) | H | M | Fixed six-condition order, explicit tri-state, `ready` derived only from six satisfied, `blockingConditions` names every non-satisfied condition; AC-F3-1/AC-F14-1 matrices (Phases 1, 5) |
| RSK-2 | A close item is missed and reported as a new start (spec RSK-2) | H | M | Association is `unknown` on binding unavailable, PR read failure, or at-limit no-match; class matrix never fabricates `new-start` (Phase 4) |
| RSK-3 | `merge-ready` fabricated from an unavailable review signal or a draft PR (spec RSK-3) | H | L | Requires `reviewStateObserved`, observed `approved`, non-draft; GitHub slice is unreachable (Phase 4) |
| RSK-4 | `deps-satisfied` satisfied from an absent/unavailable relation source or an unobserved target (spec RSK-4) | H | M | Candidate-unobserved and relations-unavailable precedence; only observed done/canceled satisfies (Phase 3) |
| RSK-5 | Untriaged/conflicting tier defaulted (spec RSK-5) | M | M | Exactly one recognized label; absent = unknown; conflict = unsatisfied; no default (Phase 3) |
| RSK-6 | Provider availability claimed as engine-verified (spec RSK-6) | H | L | Config + verified park fold only; engine/quota never called; `engine-not-run` companion; no provider evidence record or availability claim uses `available` (condition id exempt, scans scoped) (Phase 4) |
| RSK-7 | No-run/pending/failed-read CI treated as healthy (spec RSK-7) | H | L | Only `succeeded` satisfies; each `unknown` mode has one reason (Phase 3) |
| RSK-8 | Output grows unbounded or varies with API order (spec RSK-8) | M | M | Exact caps (including the nine provider-derived caps), the deterministic byte-budget reduction with `value-clamped`, fixed rank keys, fixed JSON key order, truncation markers, cap-sized/over-cap/golden fixtures (Phases 1, 5, 6) |
| RSK-9 | Scope creep into the queue/provider engine/closed-issue/GraphQL reads (spec RSK-9) | M | M | Non-goals explicit; `collectStatusFacts` reuse; adapter operation set unchanged (Phases 1–5) |
| RSK-10 | Credential/provider payload/PM notes leak into evidence or human text (spec RSK-10) | H | L | Credential port only; bounded code/reason details; PM context projects `active_change` only; redaction chokepoint; secret canaries (Phases 3, 5) |
| RSK-11 | Docs drift or contradict the status queue-gap statement (spec RSK-11) | M | M | New feature doc + Phase 7 reconciliation; literal/distribution checks |
| RSK-12 | Local PM context absent in CI makes `repo-free` unknown (spec RSK-12) | L | M | Truthful `local-context-missing`; documented; fixture-covered (Phases 3, 6) |
| RSK-13 | A canonical candidate ref never equals the provider-native `identity.entityId`, so every label/relation condition silently degrades to `work-item-unobserved` on the live slice (spec RSK-13) | H | L | The §8.3 identity rule (exact canonical match, then the unique all-digit suffix bridge) with command-level GitHub-shaped fixtures (`"176"` vs `GH-176`, wrong number, ambiguous `GH-7`+`PDEV-7` vs `"7"`, leading zeros), the relation-target twin, and the live assertion that a known candidate is observed (Phases 1, 3, 6) |
| RSK-14 | A projection clamp silently changes a verdict, hides a distinguishing provider value, or pushes the payload past its byte cap (spec RSK-14) | M | L | Clamps applied only after evaluation; predicates/association/ranking use full values; every projected provider-qualified identity is `entityId`-only with no `systemName`; one `value-clamped` + payload `truncated`; no-caps oracle equality and both byte bounds asserted; deterministic relation-then-label reduction (Phases 1, 5) |
| RSK-P1 | A phase overruns its delegation window | M | M | Stop at the last green task boundary and report; never enlarge or split the phase commit (D10) |
| RSK-P2 | Existing suites or contract inventories regress | M | M | `pnpm check` every phase; inventory/allowances/`v1-contract-inventory.json` updated in the same phase as the module (D1, Phases 1–2) |
| RSK-P3 | The `collectStatusFacts`/`classifyPipelineRuns` extraction changes status behaviour | M | L | Mechanical extraction only with the two independent read gates pinned (issues/pulls on binding observed; check-runs only on a resolved HEAD SHA); status suites, `tests/behaviour/status-changes-ci.test.ts`, and the status golden digest are in every affected phase gate (Phases 1, 2) |
| RSK-P4 | The live smoke becomes flaky or pins volatile counts | M | M | Structural assertions only, opt-in, outside `pnpm check` (Phase 6) |
| RSK-P5 | The 50 ms pure-evaluation bound is flaky on slow CI | M | M | Pure evaluator only, warm-up + median of five, record runtime/machine/median; never relax the bound; escalate if needed (Phase 6) |

### Implementation risk analysis (tricky points)

- **Reuse of status reads without duplicating code.** The read sequence is extracted once as `collectStatusFacts(StatusCommandRuntime)` in `commands/status.ts`; both commands call it, preserving the delivered two independent gates (issues/pulls when the binding is observed; check-runs when the binding is observed and the HEAD SHA is resolved). The runtime type is `StatusCommandRuntime`, so the edge composes one reader set and no adapter read is added. The status suites (`status-command`, `status-changes-ci`) plus `tests/golden/status-digest.test.ts` are in the Phase 1/2 gates; any behavioural drift is a red gate, not a silent rebinding.
- **Deterministic ranking and ties.** Class rank, then numeric suffix, then canonical text are pinned; the comparator is total and stable, and the suite feeds reversed caller/API permutations plus `GH-7`/`GH-007`/`GH-9`/`GH-10`/`GH-100`. The evaluator never sorts by insertion order or object key order.
- **Canonical refs.** Canonicalization is a pure string function: uppercase the ASCII prefix, preserve digits (including leading zeros); no trimming, no whitespace acceptance. Validation order is canonicalize → length (≤64) → duplicate → any read: a 64-character canonical ref is accepted, 65+ is rejected before duplicate detection and before any read, and duplicates are detected after canonicalization and rejected before any read. `gh-176`→`GH-176`, `gh-007`→`GH-007`; `GH-007` and `GH-7` stay distinct.
- **Unknown association.** Binding unavailable, PR read failure, and at-limit no-match all yield `association: "unknown"`, `pr-association-unknown`, and class `unknown` for a ready candidate / `not-ready` otherwise — never `new-start`. The delivered command read is open-only, so a below-limit no-match is `not-associated`/`pr-not-associated` and never `pr-not-open`. Only a pure-evaluator injected view whose below-limit page has a matching merged/closed object and no open match yields `not-associated`/`pr-not-open` with the not-associated fallback class; the at-limit rule wins in both layers.
- **At-limit pages.** Three raw pages are checked independently (issues 100, pulls 100, check-runs 20) on successful reads; `source-truncated` is payload-level, sets payload `truncated` only, and leaves every condition state/evidence/blocking list unchanged. The CI at-limit case is verdict-neutral and the class of a 20-run `succeeded` page equals the 19-run control.
- **Identity resolution.** Candidate observation and `blocked-by` target resolution use one provider-agnostic rule over the full normalized `identity.entityId`, with role-specific uniqueness domains: candidate observation is candidate-set-scoped (exact case-insensitive canonical match first, then an all-ASCII-digit value bridged only when exactly one *requested candidate* carries the suffix), while `blocked-by` targets resolve against the *observed work-item set* (exact case-insensitive full-value identity first, then a bare all-digit value bridged only when exactly one observed work item carries that suffix). The comparator is per candidate (a shared suffix is ambiguous for every sharing candidate, never assigned by precedence or caller order), has no substring/prefix/numeric coercion (`0176` ≠ `176`, `007` ≠ `7`, exact `GH-007` does not match `"7"`), and runs before any output projection. Because the target domain is the observed set, a canonical-shaped observed target resolves even when its ref is not a requested candidate, while a canonical-shaped target with no observed item stays `dependency-unobserved`. The GitHub slice uses provider-native numbers on both sides, so the exact path resolves targets there. Only a bare all-ASCII-digit target `entityId` bridges against the observed work-item set; a canonical-shaped target that is not observed stays `dependency-unobserved` and never bridges on its numeric suffix, and exact canonical target matching is a case-insensitive full-value match.
- **Provider-derived projection.** The nine caps are applied in one projection pass after evaluation: every projected provider-qualified identity (relation target, selected pull request) is `entityId`-only with `systemName` omitted, so the whole identity object is the capped `entityId`; labels and `blocked-by` relations keep provider order and are cut from the end at their count caps, non-`blocked-by` kinds are filtered before projection, and string caps are prefix cuts (never substitutions). One clamp sets payload `truncated` and emits `value-clamped` once in group 2; the candidate flag is untouched because no evidence record is dropped. The byte-budget reduction drops trailing relations then trailing labels (last-ranked candidate first, highest index first, rechecking after each drop) and never touches conditions, evidence, close data, summary, `reasons`, or `rank`. A field-by-field comparison against a no-caps oracle fixture proves verdict neutrality.
- **64 KiB and human bounds.** Detail/evidence/candidate/reason caps and the provider-derived projection keep the cap-sized payload inside 65 536 bytes; there is no title field or title cap. The human digest additionally shortens each provider segment to 32 characters with a trailing `+`, so the capped digest stays inside 16 lines/4096 bytes; the payload keeps its own capped (not 32-character) values. The bounds are measured on the serialized `data` (not the envelope), and an unreduced over-budget payload fails the suite rather than being silently truncated.
- **PM-context absence.** CI and a clean checkout have no `.ai/local/pm-context.yaml`; the condition is `unknown`/`local-context-missing`, never "free". A malformed/wrong-shape context is `local-context-malformed`. Observed states carry the `repo:local-context` proxy detail. The file is never written; `notes` never enters the payload.
- **Content-inventory registration.** Every new TS file is added to `tests/structure/inventory.json` and every exported executable name to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` in the same phase that adds it. The `contracts/index.ts` re-export surface and the new contract module entry are both added to `tests/fixtures/ports/v1-contract-inventory.json`, and `tests/structure/port-contract-inventory.test.ts` plus `subpaths.test.ts` stay green.
- **Parser positional bound.** `positionals.max = 33`; 32 refs (33 positionals) reach the handler and are rejected as `input.value.rejected`; 33 refs (34 positionals) are rejected by the parser as `fallback.invocation`. Tests must exercise both boundaries (RES-4).
- **Human digest grammar.** The renderer emits an optional header, exactly one summary line, and exactly one line per candidate in rank order; `+more` only on payload truncation; associated close items print `PR #id sourceRef` with each provider segment shortened to ≤32 characters plus a trailing `+`; not-ready candidates print `blocking: id=state, …`; a not-ready `review-pending` prints both; every candidate line ends with `[repo:local-context; tier:priority-label]`; no titles/timestamps/secrets; ≤16 lines/4096 bytes with zero extra reads.
- **Live literal.** No live-switch constant is declared in `packages/**`. `ADOS_QUEUE_READY_LIVE` is bound only by `tests/fixtures/queue-ready/harness.ts`, read only under `tests/**`, enabled only when exactly `1`, and never in the payload/evidence/human text; the forbidden-literal and secret-read gates prove it (RES-3).

### Success Metrics

- NFR-1: 6/6 conditions per candidate in fixed order, 3/3 valid states, 100% evidence presence, `ready` iff all six satisfied, every not-ready candidate names its blocking conditions; condition evaluation is independent per candidate over shared facts while identity observation is candidate-set-scoped and `blocked-by` targets resolve against the observed work-item set by the §8.3 rule, so an observable item is never silently unobserved and a shared bare-numeric suffix never observes by precedence or caller order; the deps state-count detail sums to the total `blocked-by` relation target count (observed + unobserved); 0 missing/extra.
- NFR-2: ≤8 refs (over-cap rejected), each canonical ref ≤64 characters (65+ rejected after canonicalization and before duplicate detection/read), ≤8 candidates, 6 conditions, ≤2 evidence records (the delivered set uses one per non-provider condition and two for `provider-available`), ≤160 detail chars, provider-derived identities `entityId`-only with no `systemName` so the whole identity object ≤128, refs/labels/owner/name ≤128, labels ≤16, `blocked-by` relations ≤16 (other kinds filtered out), branch ≤256, timestamp ≤40, human segment ≤32, serialized `data` ≤65 536 bytes, human ≤16 lines/4096 bytes, `associatedCount` 0..100, 100% of drop/limit/clamp cases marked with the exact flag scope (evidence-cap: candidate+payload; reason-cap/source-at-limit/clamp/byte-budget: payload only; detail clamp: none); no title field or title cap.
- NFR-3: 0 false satisfied/ready, 0 merge-ready without observed approval, 0 close items below a ready new start, 0 unknown association as new-start, 0 deps satisfied from an unavailable/absent source, 0 provider evidence records or availability claims using `available` (the pinned condition id and its condition-id/`blocking:` references are exempt; scans scoped to provider evidence/details and the provider human-text segment), 0 engine-verified claims, 0 no-run/pending/failed-read CI satisfied.
- NFR-4: 0 writes, fences, state mutations, network writes, provider-engine calls, child processes; 0 payload/human drift on identical injected inputs.
- NFR-5: ≤3 outbound GitHub reads (issues/pulls/check-runs), exactly 1 logical park-fold read, ≤1 config resolve, ≤1 local-context read, 0 quota fetches, 0 retries/loops.
- NFR-6: 100% one valid envelope under `--json`; 100% one summary line plus one line per candidate in human mode; 0 extra render reads; 0 handler failures outside `input.value.rejected`/`fallback.internal`; the existing global parser `fallback.invocation` envelope is unchanged and separate.
- NFR-7: 0 new packages, subpaths, runtime-API locations, secret-read allowlist entries, product literals; all boundary/ambient/literal gates green.
- NFR-8: 0 new error rows/domain kinds, 0 documented-table drift, 0 existing-row changes; sync/classification green.
- NFR-9: ≤50 ms pure evaluation/ranking/rendering over cap-sized inputs; linear in candidates × conditions × evidence.
- NFR-10: 0 secrets/raw payloads in payload/evidence/human text; 0 ambient reads outside the allowlist; 0 canary escapes.
- NFR-11: 100% expected fixture-corpus cases; 0 default-CI live calls; 100% opt-in structural live checks; no volatile count pinned.
- Aggregate: 37 TCs green by default (TC-QREADY-001..030 and TC-QREADY-032..038); TC-QREADY-031 green when `ADOS_QUEUE_READY_LIVE` is exactly `1` and a credential is present, otherwise skipped; `pnpm check` exit 0; clean tree after every suite.

## Phases

### Phase 1: Queue-ready contracts, pure evaluator/renderer, shared CI classification, and the contract baseline

**Goal**: Land the complete `delivery.queue-ready.v1` vocabulary and the complete pure evaluator/ranker/renderer in one commit boundary, with the shared CI classifier extracted from status and the constants, purity, and matrix baselines proven (D1, D2, D3, D5).

**Tasks**:

- [x] **1.1** Author `packages/core/src/contracts/queue-ready.ts` (D1, D2) with exactly the constants, `as const` data, and exported types pinned in "Pinned Delivery Spellings": condition order/states, close classes, rank class order, evidence sources, the 41-reason vocabulary (including `value-clamped`), the source-failure subset, `QUEUE_READY_PAYLOAD_MARKER_REASONS`, the six-group `QUEUE_READY_REASON_ORDER` (group 2 = payload markers, group 6 = exactly `pr-association-unknown`), all Appendix C caps/limits/labels/pattern/schema version (including `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS = 64`, the nine provider-derived projection caps, `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS = 32`, and `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`), and the payload/candidate/condition/evidence/close/work-item/relation/head/repository/summary/facts types. Types and `as const` data only: no functions, no runtime imports, no executable statements. Re-export everything from `contracts/index.ts` in the existing style. Do **not** declare a live-switch constant or any title-length constant; payload types carry no title (RES-3).
- [x] **1.2** Author `packages/core/src/domain/queue-ready.ts` (D1, D3): `evaluateQueueReady(facts)` performing canonical candidate handling (canonicalize → length → duplicate is the command's job; the evaluator receives canonical refs), §8.3 identity resolution for candidates (candidate-set-scoped, spec v1.4 R-31) and `blocked-by` targets (observed-work-item-set-scoped, spec v1.4 R-33) — RES-6: exact case-insensitive canonical match, role-specific unique all-ASCII-digit suffix bridge, ambiguity unobserved, no coercion, full values before clamping — the six condition predicates with the pinned precedence/evidence rules (RES-1 one-record unobserved precedence, RES-2 one state-count deps record summing to the total `blocked-by` target count, RES-5 provider pairing, RES-8 provider-config failure mapped by the read's reason), close association/selection/classification (command-level open-only plus evaluator-injected merged/closed handling), ranking, defensive evidence capping, top-level reason assembly with the exact group-2 markers and group-6 token, summary, the provider-derived output projection (nine caps, `blocked-by`-only relations, `entityId`-only identities with no `systemName`, one `value-clamped`, RES-7) with the deterministic trailing-relation-then-label byte-budget reduction, and payload truncation flags; `renderQueueReadyHuman(payload, brand)` implementing the pinned grammar and bounds (including the fixed suffix, 32-character provider segments with trailing `+`, and no title) from the same payload. No I/O, clock, randomness, environment, adapter import, or `status.ts` import (the shared classifier is a separate module). Export only the two functions from `domain/index.ts` and `core/src/index.ts`.
- [x] **1.3** Extract the delivered CI classification (D5, RSK-P3): author `packages/core/src/domain/ci-result.ts` with `classifyPipelineRuns(runs)` copied verbatim from the existing private `ciResultOf`, and replace the private copy in `domain/status.ts` with an import. No change to status output; `tests/behaviour/status-section-states.test.ts` and `tests/golden/status-digest.test.ts` are in the phase gate.
- [x] **1.4** Register the new modules and surfaces (D1, RSK-P2): add `contracts/queue-ready.ts`, `domain/queue-ready.ts`, and `domain/ci-result.ts` to `tests/structure/inventory.json`; add `QUEUE_READY_*` constants — including the nine provider-derived projection caps, `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS`, `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`, and `QUEUE_READY_PAYLOAD_MARKER_REASONS` — to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` for `core/src/contracts/queue-ready.ts`, `evaluateQueueReady`/`renderQueueReadyHuman` for the domain module, and `classifyPipelineRuns` for `ci-result.ts`. Update `tests/fixtures/ports/v1-contract-inventory.json` with **both** the new `queue-ready.ts` export surface (including the new `QueueReadyRepository`/`QueueReadyWorkItemRelation` types and the `value-clamped` reason) **and** the changed `contracts/index.ts` module entry caused by the new re-exports; `tests/structure/port-contract-inventory.test.ts` must stay green with the updated inventory. No package manifest or subpath change.
- [x] **1.5** Author `tests/structure/queue-ready-contract.test.ts` (TC-QREADY-024): bind every constant to Appendix C (values, order, labels, pattern, schema version, `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS = 64`, the nine provider-derived caps, `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS = 32`, `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN = ^[0-9]+$`), the closed 41-reason set (including `value-clamped`) and the 7-source set to DM-10/DM-4, the six reason groups to DM-1 with group 2 exactly `QUEUE_READY_PAYLOAD_MARKER_REASONS` and group 6 exactly `pr-association-unknown`, `QUEUE_READY_SOURCE_ITEM_LIMIT`/`_PIPELINE_LIMIT` equality with the delivered `STATUS_SOURCE_*`, the `associatedCount` range, the module to data-only, the inventory registration, and the tests-only live literal (RES-3). Mutation controls (reorder conditions, rename a state, drop a reason, change a cap including a provider-derived cap and the numeric pattern, move `value-clamped` out of group 2, change the schema version, add a production live-switch constant) fail by name; the unmutated control is green. Assert no live-switch constant and no title-length constant exist in `packages/**`. Read the change spec read-only following the status precedent (`tests/structure/status-contract.test.ts:267-275`): assert the pinned Appendix C token presence and that the file's `mtime` is unchanged, with **no whole-file digest**, so a legitimate change-doc edit cannot fail the suite.
- [x] **1.6** Author `tests/fixtures/queue-ready/harness.ts` (fact builders, `runQueueReadyCli`, fixed clock/brand, provider-shaped identity builders, and the tests-only live switch bound to the literal `ADOS_QUEUE_READY_LIVE`) and `tests/behaviour/queue-ready-conditions.test.ts` + `tests/fixtures/queue-ready/matrix/cases.ts` (TC-QREADY-003, TC-QREADY-004): six-condition totality/order, one tri-state state and exactly one evidence record per non-provider condition plus the ordered two-record provider pair, `ready` equivalence, blocking order, and the Appendix A matrix cell by cell (including the unobserved-candidate-before-signal twins, the one-record deps state-count details, the provider two-record pairing, the config-failure-by-reason rows, and the CI at-limit verdict-neutral twin); matrix rows observe candidates through provider-shaped `identity.entityId` values (for example `"176"` for `GH-176`) so the identity bridge is exercised from the first suite. Negative controls remove a condition, duplicate/rename one, force `ready: true` with a non-satisfied condition, and drop evidence; each fails by name.
- [x] **1.7** Author the core halves of `tests/structure/queue-ready-imports.test.ts` (TC-QREADY-025/026 partial; pattern from `status-imports.test.ts`): contracts data-only, domain purity (imports only `#contracts`/relative; no `node:*`/`bun:*`, I/O, clock, randomness, env), single-vocabulary-home scan (no redeclared condition/reason/class/cap list outside `contracts/queue-ready.ts`), brand-literal absence, no title projection, and a tests-only live literal check. Every detector has a failing temp-copy fixture and a clean control. Phase gate: `bun test tests/structure/queue-ready-contract.test.ts tests/structure/queue-ready-imports.test.ts tests/structure/port-contract-inventory.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/behaviour/queue-ready-conditions.test.ts tests/behaviour/status-section-states.test.ts tests/golden/status-digest.test.ts`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-F2-1 and AC-F2-2 measurable and green at this boundary (six ids/order, three states, evidence on every condition, Appendix A cells exact); AC-F12-1 structural half (payload keys/types/order, `schemaVersion`); the AC-F2-3/AC-F4-2 identity comparator and the AC-F12-2 projection caps are implemented here and proven in Phases 3 and 5; TC-QREADY-003/004/024 green; NFR-1 thresholds met; contracts data-only and domain pure; no new runtime-API location; mutation controls fail by name; status suites/golden unchanged by the classifier extraction.
- Should: the constant comparer normalizes backticks/emphasis and reports the diverging constant by name; record in the execution log any matrix cell that needed a new fixture shape.

**Files and modules**:

- Code areas: `packages/core/src/contracts/queue-ready.ts` (new), `packages/core/src/contracts/index.ts` (updated), `packages/core/src/domain/queue-ready.ts` (new), `packages/core/src/domain/ci-result.ts` (new), `packages/core/src/domain/status.ts` (updated — shared classifier import only), `packages/core/src/domain/index.ts` (updated), `packages/core/src/index.ts` (updated), `tests/structure/queue-ready-contract.test.ts` (new), `tests/structure/queue-ready-imports.test.ts` (new — core halves), `tests/behaviour/queue-ready-conditions.test.ts` (new), `tests/fixtures/queue-ready/harness.ts` (new), `tests/fixtures/queue-ready/matrix/cases.ts` (new), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/fixtures/ports/v1-contract-inventory.json` (updated).
- System docs: none (Phase 7 owns reconciliation).

**Tests**:

- TCs implemented: TC-QREADY-003, TC-QREADY-004, TC-QREADY-024; TC-QREADY-025/026 core halves (completed in Phase 5).
- Verification: the focused `bun test` list in task 1.7; the four invariant checks in task 1.7; `pnpm check` exit 0.

**Completion signal**: `feat(GH-176): add queue-ready contract with pure evaluator and renderer`

---

### Phase 2: The `queue ready` command, grammar, and status-read composition

**Goal**: Compose the read-only command end to end — parser bound, handler grammar before any read, canonical candidate set, shared status fact collection, edge wiring beside the existing commands, and the command/ref/edge/output-contract TCs (F-1, F-2, F-16; AC-F1-1, AC-F1-3).

**Tasks**:

- [x] **2.1** Author `packages/cli/src/commands/queue.ts` (D1, D4): `QueueReadyCommandRuntime` (alias of `StatusCommandRuntime`) and `createQueueReadyCommandDefinition(runtime)` exactly as pinned. The pure grammar helper runs first (no reads): subcommand `ready`, 1..8 refs, `QUEUE_READY_WORK_ITEM_REF_PATTERN`, no whitespace acceptance/trimming, canonical uppercase prefix with digits preserved, canonical length ≤64, duplicate detection after canonicalization (rejected, never silently merged); the exact validation order is canonicalize → length → duplicate → read. Rejection returns `{ error: { kind: "input", code: "input.value.rejected", summary: "result=failed; reason=grammar" } }`. Only after a clean grammar it calls `collectStatusFacts(runtime)` once and returns `{ data: evaluateQueueReady({ ...facts, candidates }) }`. No stream write, exit literal, adapter import, or error envelope for a source failure; `humanText` renders the digest from the same payload and the injected brand.
- [x] **2.2** Refactor `packages/cli/src/commands/status.ts` (D5, RSK-P3): extract `collectStatusFacts(runtime): Promise<StatusFacts>` with the exact current read sequence and its **two independent gates** (repository facts; if `repository.binding.state === "observed"` read the issues page at `STATUS_SOURCE_ITEM_LIMIT` and the pulls page at `STATUS_SOURCE_ITEM_LIMIT`, else the pinned `{ ok: false, reason: "not-configured" }` read for both; if the binding is observed and `repository.head.sha !== undefined` read the check-runs page at `STATUS_SOURCE_PIPELINE_LIMIT`, else `{ ok: false, reason: "commit-unresolved" }` when observed and `{ ok: false, reason: "not-configured" }` when not; then one provider-config resolve; one park fold; one local-context read; `nowIso`/`nowMs`). Issues/pulls are never gated on SHA resolution, so a binding-observed, SHA-absent run keeps tracker/pulls observed and only CI `commit-unresolved` (the `not-ready-ci-unresolved` shape `S S S S ? S`). The status handler calls it and `aggregateStatus` exactly as before. Add `collectStatusFacts` to the `cli/src/commands/status.ts` executable allowance.
- [x] **2.3** Wire the command (D4, D5): export `QueueReadyCommandRuntime` and `createQueueReadyCommandDefinition` from `commands/index.ts`; add `readonly queueReady?: StatusComposition` to `ConfigProgramOptions`; hoist the provider-config resolver closure into one local `resolveProviderConfig`; compose `commands.queue = createQueueReadyCommandDefinition(createStatusCommandRuntime(options.queueReady, resolveProviderConfig))` when supplied. No new edge export, no status composition change. Record the `queue`-before-the-family note in the module doc comment only; the CLI has no help command or rendered descriptor and this change adds none.
- [x] **2.4** Author `tests/behaviour/queue-ready-command.test.ts` + `tests/fixtures/queue-ready/refs/cases.ts` and extend `tests/fixtures/queue-ready/harness.ts` with `runQueueReadyCli` (TC-QREADY-001, TC-QREADY-002, TC-QREADY-032, TC-QREADY-033): 1..8 well-formed refs return one success payload with canonical refs; zero refs / wrong first positional / 9..32 refs / malformed (including whitespace-bearing) / over-length (65+) / duplicate-after-canonicalization (rejected, never silently merged) fail `input.value.rejected` (kind `input`, exit `1`) with a zero-source-read recorder; a 64-character canonical ref is accepted; the validation order is canonicalize → length → duplicate → read; 33 refs and an unknown flag fail `fallback.invocation` (exit `1`); `--json` placements behave as a global switch; `positionals.max` is 33 and the definition has no flags; handler write-free and no exit literal; ref canonicalization/leading zeros/numeric-equal distinct refs; candidate independence; no discovery, no filter args; a degraded fixture renders every candidate with exit `0` and containment restores; edge exit projection `0`/`1`/`2` with exactly one serialization and no partial output. The command-registry/module-doc note is a documentation assertion only; no rendered help descriptor or help test step is added. Add `tests/fixtures/queue-ready/corpus/source-failures-degraded/case.json` for the Appendix G all-unknown degraded case. Also assert the two independent status read gates through `runQueueReadyCli` with a binding-observed, SHA-absent runtime: `readWorkItems`/`readDeliveryRequests` are called exactly once each, `readPipelineRuns` zero times, and the payload shows the `not-ready-ci-unresolved` shape (`S S S S ? S`, `ci-healthy` `unknown`/`commit-unresolved`) with deps/tier/owner observed; a binding-unobserved runtime instead performs none of the three GitHub reads.
- [x] **2.5** Extend `tests/structure/cli-edge-seam.test.ts` (queue composed beside the other commands, additive option, no other declarer), the command half of `tests/structure/queue-ready-imports.test.ts` (command imports only core/contracts and the sibling status module; no direct adapter/state/config), `tests/structure/content-inventory.test.ts` (`EXECUTABLE_ALLOWANCES` for `createQueueReadyCommandDefinition` and `collectStatusFacts`) and `tests/structure/inventory.json` (queue module file set). Phase gate: `bun test tests/behaviour/queue-ready-command.test.ts tests/structure/cli-edge-seam.test.ts tests/structure/queue-ready-imports.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/behaviour/status-command.test.ts tests/behaviour/status-changes-ci.test.ts tests/golden/status-digest.test.ts`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-F1-1 and AC-F1-3 complete and green; TC-QREADY-001/002/032/033 green; the handler performs zero reads on a grammar rejection and is write-free/exit-free; 1..8 refs produce one success payload with canonical refs; a 64-character canonical ref is accepted and 65+ is rejected before any read; only `input.value.rejected`/`fallback.internal` fail the handler and the parser keeps `fallback.invocation`; the command is composed beside `status`/`verify`/`lint`/`phase`/`provider`/`config`; status suites/golden stay green after `collectStatusFacts` extraction; `collectStatusFacts` keeps two independent gates — issues/pulls read whenever the binding is observed, check-runs read only when the binding is observed and the HEAD SHA is resolved, with the pinned `not-configured`/`commit-unresolved` reads otherwise — so `status` output is byte-identical and the `not-ready-ci-unresolved` shape (`S S S S ? S`) stays reachable.
- Should: the command suite reuses the Phase 1 harness; record in the execution log the exact boundary ref counts used for the handler/parser controls (RES-4).

**Files and modules**:

- Code areas: `packages/cli/src/commands/queue.ts` (new), `packages/cli/src/commands/status.ts` (updated — `collectStatusFacts`), `packages/cli/src/commands/index.ts` (updated), `packages/cli/src/edge.ts` (updated), `tests/behaviour/queue-ready-command.test.ts` (new), `tests/fixtures/queue-ready/harness.ts` (updated), `tests/fixtures/queue-ready/refs/cases.ts` (new), `tests/fixtures/queue-ready/corpus/source-failures-degraded/case.json` (new), `tests/structure/cli-edge-seam.test.ts` (updated), `tests/structure/queue-ready-imports.test.ts` (updated — command half), `tests/structure/content-inventory.test.ts` (updated), `tests/structure/inventory.json` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-QREADY-001, TC-QREADY-002, TC-QREADY-032, TC-QREADY-033; TC-QREADY-025/026 command halves (completed in Phase 5); TC-QREADY-025 edge composition.
- Verification: the focused `bun test` list in task 2.5; the four invariant checks in task 2.5; `pnpm check` exit 0.

**Completion signal**: `feat(GH-176): add queue ready command with grammar and status-read composition`

---

### Phase 3: Readiness predicates and identity resolution — deps, identity, repo-free, tier, owner gate, and CI

**Goal**: Prove the five non-provider conditions and the §8.3 identity rule against the Appendix A matrix with non-vacuous fixtures, provider-shaped identities, restored controls, and the exact unknown/failed/unobserved reasons (F-4..F-8; AC-F4-1, AC-F4-2, AC-F5-1, AC-F6-1, AC-F7-1, AC-F8-1, AC-F2-3).

**Tasks**:

- [x] **3.1** Author `tests/behaviour/queue-ready-deps.test.ts` + `tests/fixtures/queue-ready/deps/cases.ts` (TC-QREADY-005): unobserved candidate is `unknown`/`work-item-unobserved` with exactly one record, even when relations are also unavailable (R-07 precedence); an observed candidate with relations unavailable and zero visible relations is `unknown`/`signal-unavailable`; zero targets `satisfied`/`no-blocked-dependencies`; every target done/canceled `satisfied`/`dependencies-done`; an observed non-done target `unsatisfied`/`dependency-open`; an unobserved target (including a done target outside the page) `unknown`/`dependency-unobserved`; every state carries exactly one record with the state-count detail `done:<n>; open:<n>; unknown:<n>` whose three counts sum to the **total `blocked-by` relation target count (observed + unobserved)** (spec v1.4 R-32), with no target refs or per-target records; `done:0; open:0; unknown:1` is asserted for one unobserved target so the oracle cannot be read as an observed-target count; a second record or a per-target record fails by name; `blocked-by` targets resolve against the observed work-item set (spec v1.4 R-33), including an exact canonical observed target that is not a requested candidate (owned in full by task 3.2); the tracker read-failure/absent-candidate one-record shape (RES-1), the single-record deps shape (RES-2), and a restored control. Use provider-shaped candidate and target ids (`"176"`/`"179"`/`"180"`/`"999"`), with the full identity-resolution matrix owned by task 3.2 (TC-QREADY-037). Do not assert or construct an evidence-cap-overflow deps case.
- [x] **3.2** Author `tests/behaviour/queue-ready-identity.test.ts` + `tests/fixtures/queue-ready/identity/cases.ts` (TC-QREADY-036, TC-QREADY-037): candidate observation and `blocked-by` target resolution by the §8.3 rule over the full normalized `identity.entityId` with role-specific uniqueness domains (spec v1.4 R-31/R-33) — exact canonical (`"GH-176"`), exact case-insensitive (`"gh-176"`), unique bare-number bridge (`"176"` → `GH-176`), wrong number (`"177"`), ambiguous shared suffix (`GH-7` + `PDEV-7` with `"7"`, unobserved for every sharing candidate, no precedence/caller-order win, proving identity observation is candidate-set-scoped while condition evaluation stays independent per candidate), leading-zero mismatch (`"0176"` vs `GH-176`, `"7"` vs `GH-007`), preserved leading zero (`"007"` vs `GH-007`), non-digit non-canonical ids (`"issue-176"`, `"GH-176-extra"`), exact-beats-ambiguity (`"GH-7"` with both refs requested), multi-candidate independence, and a 64-character exact canonical match; the relation twin covers exact (`"179"`), exact-canonical (`"GH-179"`), **canonical-observed-target-not-requested** (`GH-179` observed as `GH-179` while not a requested candidate — resolved by exact match against the observed work-item set), canonical-shaped target with no observed item (stays `dependency-unobserved`), no-match (`"999"`), ambiguity over the observed item set, leading-zero, done/canceled/open, mixed open+unobserved, all-unobserved, and an over-cap target identity that still resolves before projection. Assert `work-item-unobserved`/`dependency-unobserved` with exactly one record per tracker condition and no borrowed label/relation; controls flip `"176"`→`"GH-176"`/`"177"` and a resolved target `done`→`open`, and adding a second candidate with the same suffix makes the bridge ambiguous. No row may observe a canonical candidate through a GH-shaped provider id except the explicit exact rows.
- [x] **3.3** Author `tests/behaviour/queue-ready-repo-tier-owner.test.ts` + `tests/fixtures/queue-ready/{repo,tier,owner}/cases.ts` + `tests/fixtures/queue-ready/pm-context/*.yaml` (TC-QREADY-006, TC-QREADY-007, TC-QREADY-008): PM context missing/malformed/wrong-shape/empty/candidate (case-insensitive)/other active change; details exactly `repo:local-context`, `repo:local-context; candidate-is-active`, or `repo:local-context; active-change:<ref>`; PM bytes/mtime unchanged and a `notes` canary never entering evidence; tier one/medium/low/mixed-case/empty/unrecognized/conflict/duplicate spelling/unobserved/unavailable with `tier:priority-label; …` details, sorted conflict labels, no default; unobserved-before-signal precedence; owner none/one/both/mixed-case/unobserved/unavailable and `assignee`-ignored controls.
- [x] **3.4** Author `tests/behaviour/queue-ready-ci.test.ts` + `tests/fixtures/queue-ready/ci/cases.ts` (TC-QREADY-009, TC-QREADY-010): classification `succeeded`/`failed`/`pending`/`canceled`/`none` and all-skipped pinned to `ci-none`; 19-run vs raw 20-run page: identical verdict/evidence/blocking with payload-level `source-truncated` + payload `truncated` only; each `unknown` mode's exact reason — unresolved SHA `commit-unresolved`, binding unavailable `addressing-unresolved`/`remote-unsupported` with zero check-runs requests and the reason in group 1, credential unavailable `credential-unavailable` with zero requests and the reason in group 5, attempted failure `read-failed` with bounded `failureCode`/`failureClass`; one attempt, no retry; no new error row; restored controls.
- [x] **3.5** Phase gate: `bun test tests/behaviour/queue-ready-deps.test.ts tests/behaviour/queue-ready-identity.test.ts tests/behaviour/queue-ready-repo-tier-owner.test.ts tests/behaviour/queue-ready-ci.test.ts tests/behaviour/queue-ready-conditions.test.ts`; `bun run scripts/checks/{forbidden-literals,ambient-globals}.ts`; `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-F4-1, AC-F4-2, AC-F5-1, AC-F6-1, AC-F7-1, AC-F8-1 and the AC-F2-3 command-level half complete with non-vacuous fixtures and restored controls; TC-QREADY-005..010, TC-QREADY-036, TC-QREADY-037 green; no condition is defaulted; no failed/absent source satisfies; no PM-context write; no error identity emitted; an observable provider-shaped item is never reported unobserved, a shared bare-numeric suffix never observes by precedence or caller order, a `blocked-by` target resolves against the observed work-item set (including a canonical observed target that is not a requested candidate), and the deps state-count detail sums to the total `blocked-by` target count.
- Should: the suites share `tests/fixtures/queue-ready/harness.ts` builders; record any new fixture shape in the execution log.

**Files and modules**:

- Code areas: `tests/behaviour/queue-ready-deps.test.ts` (new), `tests/behaviour/queue-ready-identity.test.ts` (new), `tests/behaviour/queue-ready-repo-tier-owner.test.ts` (new), `tests/behaviour/queue-ready-ci.test.ts` (new), `tests/fixtures/queue-ready/{deps,identity,repo,tier,owner,ci}/cases.ts` (new), `tests/fixtures/queue-ready/pm-context/*.yaml` (new), `tests/fixtures/queue-ready/harness.ts` (updated).
- System docs: none.

**Tests**:

- TCs implemented: TC-QREADY-005, TC-QREADY-006, TC-QREADY-007, TC-QREADY-008, TC-QREADY-009, TC-QREADY-010, TC-QREADY-036, TC-QREADY-037.
- Verification: the focused `bun test` list in task 3.5; the two invariant checks in task 3.5; `pnpm check` exit 0.

**Completion signal**: `test(GH-176): prove readiness conditions and work-item identity resolution`

---

### Phase 4: Provider availability, close classification, and ranking

**Goal**: Prove `provider-available` (declared chain + verified park fold, never the engine), the branch-convention close association/classification/selection, and the deterministic rank order (F-9, F-10, F-11; AC-F9-1, AC-F10-1, AC-F11-1).

**Tasks**:

- [x] **4.1** Author `tests/behaviour/queue-ready-provider.test.ts` + `tests/fixtures/queue-ready/provider/cases.ts` + `tests/fixtures/queue-ready/providers/*.json`, using the real state harness for park views (TC-QREADY-011, TC-QREADY-012): resolved chain with one enabled unparked entry satisfied with the exact case record + `engine-not-run` companion; non-matching provider/chain parks inert; no enabled entry, all enabled parked, active chain park (cause/expiry, T−1/T/T+1), no declared chain, unresolved chain, park-fold `state-unreadable`; provider config failures mapped by the read's own `reason` (RES-8, spec v1.4 R-30) — a command-level `{ ok: false, reason: "provider-chain-unresolved" }` fixture and a `{ ok: false, reason: "config-invalid" }` fixture (never a blanket `!config.ok` mapping), plus the defensive `ok: true` view whose default chain is absent from `chains` — so the corpus `not-ready-provider-unresolved` row is reachable through `runCli`; the command-level unresolved case record is exactly `{ source: "provider-config", reason: "provider-chain-unresolved", detail: "failureCode:config.value.invalid" }` (the delivered edge's code) followed by the `engine-not-run` companion, the config-invalid case carries the pinned `failureCode:<code>` / `failureClass:<class>` / both `; `-joined form when supplied, the defensive `ok:true` view and `provider-chain-not-declared` carry no failure `detail`, and the park-fold failure case asserts `provider-parks`/`state-unreadable` with the park read's code/class in that pinned form where supplied and never a config reason; a hand-planted free-form provider failure detail fails by name (spec v1.5 R-42); exact two-record pairing and precedence (RES-5); exactly one config resolve and one park fold; zero engine/`resolve`/`quota`/quota-HTTP/announcement/park-write calls; the negative `available` scan scoped to the provider evidence records/details and the provider human-text segment, with the pinned condition id, condition-id list, `blocking:` lines, payload keys, summary tokens, and close classes exempt and a hand-planted `provider available` detail failing by name (R-21); restored controls.
- [x] **4.2** Author `tests/behaviour/queue-ready-close.test.ts` + `tests/fixtures/queue-ready/close/cases.ts` (TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-016): 3+ non-empty segments, exact case-insensitive segment, substring/short-ref rejected, `targetRef` ignored; Appendix E rows including draft/unknown review/changes-requested; **command-level** below-limit open-only no-match is `not-associated`/`pr-not-associated` (never `pr-not-open`) and at-limit no-match is `unknown`/`pr-association-unknown`; **pure-evaluator injected views** assert merged/closed exclusion, below-limit merged/closed-only `not-associated`/`pr-not-open` with the fallback class, and the at-limit rule winning over `pr-not-open`; merged/closed never selected/counted; `associatedCount` exact below the limit, page-bounded at the limit, `0` on failed read/unavailable binding; deterministic same-class selection (merge-ready set when non-empty, otherwise the associated set; `entityId` ascending with a numeric-aware comparison — equal all-digit numeric values tie at that key — then `sourceRef` ascending, then `targetRef` ascending, then the lexically smaller raw `entityId` only when all three keys are equal; API order never decides); reversed API orders; binding-unavailable/PR-failure controls never become `new-start`.
- [x] **4.3** Author `tests/behaviour/queue-ready-ranking.test.ts` + `tests/fixtures/queue-ready/ranking/cases.ts` (TC-QREADY-017): all five classes in order; `GH-9`/`GH-10`/`GH-100` numeric order; `GH-007` before `GH-7` (equal numeric suffix falls through to canonical text ascending); caller/API permutations never change the result; 1..8 ranks; no close item below a ready new start.
- [x] **4.4** Phase gate: `bun test tests/behaviour/queue-ready-provider.test.ts tests/behaviour/queue-ready-close.test.ts tests/behaviour/queue-ready-ranking.test.ts tests/behaviour/queue-ready-conditions.test.ts`; `bun run scripts/checks/{forbidden-literals,ambient-globals}.ts`; `pnpm check` exit 0.

**Acceptance Criteria**:

- Must: AC-F9-1, AC-F10-1, AC-F11-1 complete with non-vacuous fixtures and restored controls; TC-QREADY-011..017 green; exactly two provider evidence records per state with the case record first and `engine-not-run` second; provider config failures mapped by the read's own reason (`config-invalid` vs `provider-chain-unresolved`, never blanket `!config.ok`) and the park fold always `provider-parks`/`state-unreadable`; a config or park failure record carries the pinned `failureCode:<code>` / `failureClass:<class>` / both `; `-joined detail form when supplied and no `detail` otherwise (the command-level unresolved case carries `failureCode:config.value.invalid`, the defensive `ok:true` view and `provider-chain-not-declared` carry none, and `state-unreadable` carries the park code/class where supplied), never a free-form detail (spec v1.5 R-42); engine/quota never invoked; no provider evidence record or availability claim uses `available` (scoped scan, condition id exempt); command-level association is open-only with `pr-not-associated` below the limit, while merged/closed objects and `pr-not-open` are evaluator-injected-only and never become close items; unknown association never `new-start`; rank is 1-based and order-independent (`GH-007` before `GH-7`).
- Should: the close suite builds one shared association oracle table (Appendix E) so every row is asserted once; record the provider fixture provenance in the execution log.

**Files and modules**:

- Code areas: `tests/behaviour/queue-ready-provider.test.ts` (new), `tests/behaviour/queue-ready-close.test.ts` (new), `tests/behaviour/queue-ready-ranking.test.ts` (new), `tests/fixtures/queue-ready/{provider,close,ranking}/cases.ts` (new), `tests/fixtures/queue-ready/providers/{chain-default,chain-partial-park,chain-all-parked,chain-parked,no-chain,unresolved-chain,unresolved-chain-command,config-invalid,park-fold-torn}.json` (new), `tests/fixtures/queue-ready/harness.ts` (updated), `tests/fixtures/state/harness.ts` (consumed, unchanged).
- System docs: none.

**Tests**:

- TCs implemented: TC-QREADY-011, TC-QREADY-012, TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-016, TC-QREADY-017.
- Verification: the focused `bun test` list in task 4.4; the two invariant checks in task 4.4; `pnpm check` exit 0.

**Completion signal**: `test(GH-176): prove provider availability, close classification, and ranking`

---

### Phase 5: Output, provider caps, reasons, truncation, negative controls, read-only/determinism, and the gate battery

**Goal**: Prove the machine payload, the human digest, the exact cap/truncation/clamp matrix, the exhaustive AC-F14-1 negative-control matrix, the read-only/deterministic contract, and the tier/brand/error-table/boundary gates (F-12..F-16; AC-F12-1, AC-F12-2, AC-F13-1, AC-F14-1, AC-F15-1, AC-F16-1).

**Tasks**:

- [x] **5.1** Author `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/{reasons,bounds}/**` (TC-QREADY-018, TC-QREADY-034, TC-QREADY-035): exactly one `CommandResult` envelope and the exact `data` key set/order with `schemaVersion: delivery.queue-ready.v1`, closed vocabularies, summary, no `error` key, no raw payload/secrets, no `workItem.title` key, and every projected provider-qualified identity (relation target and selected pull request) `entityId`-only with no `systemName` key; under/at/cap-sized/over-cap/at-limit bounds including the 64-character ref cap and the nine provider-derived caps; serialized `data` ≤65 536 bytes at cap size with the deterministic byte-budget reduction and a contract failure for an unreduced over-budget payload; detail clamping (no flag); `associatedCount` 0..100; six-group reason order with first-occurrence dedup and scrambled read/evidence order, group 2 exactly `source-truncated` then `value-clamped`, group 6 exactly `pr-association-unknown` and last, `read-failed`/`credential-unavailable` group-5 only (a repeated-reason case and its already-unique control), verdict reasons excluded, cap-6 overflow sets payload `truncated` only; the full truncation-flag matrix per drop cause (evidence-cap overflow only from a synthetic evaluator input) and the CI 19/20 verdict-identical pair.
- [x] **5.2** Author the human-digest half of `tests/behaviour/queue-ready-output.test.ts` and `tests/fixtures/queue-ready/golden/human.txt` (TC-QREADY-020): header/summary/candidate lines, all detail forms, close+blocking, `+more`, the fixed suffix `[repo:local-context; tier:priority-label]` on every candidate line, each provider segment (`PR #<entityId>`, `<sourceRef>`) ≤32 characters with a trailing `+` when shortened while the payload keeps its own capped values, ≤16 lines/4096 bytes at cap size, a raw-fact title canary that never surfaces, a scoped provider-segment `available` scan with the condition id and vocabulary tokens exempt, zero extra reads and the same payload as `--json`.
- [x] **5.3** Author `tests/behaviour/queue-ready-output.test.ts` caps coverage plus `tests/fixtures/queue-ready/caps/{over-long,byte-budget}/**` (TC-QREADY-038): the over-long fixture (20 labels of 200 chars including a beyond-cap `priority:high`/`hand-back`, 20 mixed-kind relations, 200-character target identities, 200-character `systemName` values on relation targets and pull-request identities, 200-character owner/name, a 300-character branch, a 60-character `updatedAt`, three associated PRs with 200-character `entityId`/`sourceRef`/`targetRef`) run through `runCli`; assert every projected provider-qualified identity is `entityId`-only with `systemName` omitted — the `systemName` key is absent and its over-long value appears nowhere in the payload or digest (spec v1.4 R-34; no tenth cap) — every `entityId`/ref/label ≤128, labels ≤16 in provider order, only `blocked-by` relations ≤16 with every other kind absent (filtered, not clamped), owner/name ≤128, branch ≤256, `updatedAt` ≤40; payload `truncated: true` and exactly one `value-clamped` in the group-2 position, never in condition/close evidence; byte-identical verdicts against a no-caps oracle twin (`conditions`, `blockingConditions`, `closeClass`, ranks, `associatedCount`, summary); `data` ≤65 536 bytes and the human digest ≤16 lines/4096 bytes; the deterministic relation-then-label drop order (last-ranked candidate first, highest index first, rechecking) with no fixed-vocabulary field dropped; mutation controls (cap disabled, marker removed, verdict changed by a clamp, condition dropped to fit) fail by name.
- [x] **5.4** Author `tests/behaviour/queue-ready-negative-controls.test.ts` + `tests/fixtures/queue-ready/negative-controls/cases.ts` (TC-QREADY-021): all 22 AC-F14-1 controls (deps relations unavailable, candidate unobserved, PM context missing/malformed, another active change, tier absent/conflict, owner label present, CI `none`/`pending`/`canceled`/`failed`, unresolved SHA, failed check-runs read, no default provider chain, unresolved provider chain, park-fold failure, active provider park, active chain park, PR read failure, binding unavailable, at-limit PR page no match) each with its targeted condition state/reason and a restored control; assert each control on its targeted surface, matching the test plan's 22-row matrix: a targeted absent/failed/unattempted/unavailable/unresolved readiness source never yields `satisfied`, and a non-satisfied readiness condition never yields a `ready` claim; the PR-read-failure control (20) and the at-limit PR-page-no-match control (22) keep all six conditions satisfied and yield `ready: true` with `closeClass: unknown`/`pr-association-unknown`, never `new-start`; the binding-unavailable control (21) is not ready (deps/tier/owner/CI `unknown`) and never `new-start`; no control yields `merge-ready` without observed approval or an all-clear; there is no global not-ready requirement for the matrix; the all-clear scan is scoped to the affected condition's evidence/details and the corresponding human segment and explicitly allows the pinned payload keys, summary tokens, close classes, and condition ids (the provider `available` scan is scoped to provider evidence/details and the provider human segment); a hand-planted forbidden claim fails by name; exit `0`; a meta-assertion fails if any of the 22 named controls is missing (cardinality exactly 22).
- [x] **5.5** Author `tests/behaviour/queue-ready-readonly-determinism.test.ts` (TC-QREADY-022, TC-QREADY-023): guarded store (read recorded; append/fence/replace throws), recording transport (GET only, the three declared endpoints, no quota/announcement), PM-context bytes/mtime unchanged, no child process/sentinel and no `node:child_process` import, seeded write/POST/spawn controls trip; byte-identical `--json`/human replays including an over-cap provider fixture (one `value-clamped`, idempotent across replays), reversed twin invariance, changed-fact control, AST purity scan for `Date.now`/`Math.random`/`process.env`/`Bun.env`/`performance.now`, and human text derived from the same payload.
- [x] **5.6** Complete the tier/brand/error gates: `tests/structure/queue-ready-imports.test.ts` over the final module set (contracts data-only, domain pure, command core/status-only, single vocabulary home, brand absence, every detector with a failing fixture and clean control); `tests/checks/secret-read-boundary.test.ts` (allowlist length 4, no queue-ready file, no ambient env) and `tests/checks/forbidden-literals.test.ts` (no product literal; `ADOS_QUEUE_READY_LIVE` only under `tests/**`; seeded violation); `tests/boundaries` plus `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`; TC-QREADY-027 via `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, and `bun run scripts/checks/error-table-sync.ts` (no new row/kind, evidence reasons are not identities, only two handler failures, both drift directions fail); register the final file set/allowances and confirm `subpaths.test.ts`/`content-inventory.test.ts`/`port-contract-inventory.test.ts`.
- [x] **5.7** Phase gate: every focused queue-ready suite plus `bun test tests/structure tests/checks tests/boundaries`; the five invariant checks; `pnpm check` exit 0; `git diff --check`; `git status --porcelain` clean after the suites.

**Acceptance Criteria**:

- Must: AC-F12-1, AC-F12-2, AC-F13-1, AC-F14-1, AC-F15-1, AC-F16-1 complete; TC-QREADY-018..027 and TC-QREADY-034/035/038 green (TC-QREADY-025/026 completed here); exact flag scope with one `value-clamped` in group 2; 64 KiB/16-line/4096-byte bounds measured at cap size; nine provider caps output-only with `entityId`-only identities (no `systemName`) and no verdict change; no title field or title cap; 0 writes/fences/network writes/spawns/provider-engine calls; 0 new error rows/kinds; secret allowlist still four entries; every dependency/domain/command gate green.
- Should: the output suite reuses the Phase 1 harness; record the measured byte/line maxima and cap margins in the execution log.

**Files and modules**:

- Code areas: `tests/behaviour/queue-ready-output.test.ts` (new), `tests/behaviour/queue-ready-negative-controls.test.ts` (new), `tests/behaviour/queue-ready-readonly-determinism.test.ts` (new), `tests/fixtures/queue-ready/{reasons,bounds,caps,negative-controls}/**` (new), `tests/fixtures/queue-ready/golden/human.txt` (new), `tests/fixtures/queue-ready/harness.ts` (updated), `tests/checks/{secret-read-boundary,forbidden-literals}.test.ts` (updated), `tests/checks/error-table-sync.test.ts` (updated), `tests/structure/{queue-ready-imports,error-table,content-inventory,subpaths}.test.ts` (updated), `tests/structure/inventory.json` (updated), `tests/fixtures/ports/v1-contract-inventory.json` (updated if the surface changed).
- System docs: none.

**Tests**:

- TCs implemented: TC-QREADY-018, TC-QREADY-019, TC-QREADY-020, TC-QREADY-021, TC-QREADY-022, TC-QREADY-023, TC-QREADY-025, TC-QREADY-026, TC-QREADY-027, TC-QREADY-034, TC-QREADY-035, TC-QREADY-038.
- Verification: the focused suites and `bun test tests/structure tests/checks tests/boundaries` in task 5.7; the five invariant checks; `pnpm check` exit 0.

**Completion signal**: `test(GH-176): prove output bounds, provider caps, negative controls, and read-only determinism`

---

### Phase 6: Corpus, golden, performance, live smoke, changeset, evidence, and final local battery

**Goal**: Pin the committed corpus and golden payload, measure the NFR-5/NFR-9 bounds, record the release intent and delivery evidence, and run the full local battery to a clean tree — the `@coder`-executed completion of implementation (no push, no PR).

**Tasks**:

- [x] **6.1** Author `tests/behaviour/queue-ready-corpus.test.ts` and `tests/fixtures/queue-ready/corpus/{case}/case.json` (TC-QREADY-028): the §6.2 corpus (every condition state, close class, rank rule, source failure, identity-resolution case including `identity-github-shape`/`identity-wrong-number`/`identity-ambiguous-suffix`/`identity-leading-zero` and the `relation-target-*` twins including `relation-target-canonical-unrequested`, provider cap/clamp cases `provider-over-cap-fields` (with the 200-character `systemName` on targets and PR identities)/`provider-over-cap-byte-budget`, the command-level `not-ready-ci-unresolved` row (binding observed, tracker/pulls read succeeded, CI `commit-unresolved`, `S S S S ? S`), the command-level `not-ready-provider-unresolved` row (`{ ok: false, reason: "provider-chain-unresolved" }` with case detail `failureCode:config.value.invalid`) and the `not-ready-provider-config-invalid` row (pinned `failureCode`/`failureClass` detail form when supplied), reasons/truncation cases, canonical refs including the 64-character accepted case, a `value-clamped` case, secret canary, at-limit cases, Appendix G rows); command-level corpus rows run through `runCli`, evaluator-injected merged/closed rows run only through the pure evaluator; one-record deps state-count details summing to the total `blocked-by` target count; no title field and no `systemName` key anywhere in the payload; a throwing `fetch` guard proves zero live calls; expected states/reasons/close/rank/`truncated`/`value-clamped`; run twice for bytes; corruption/removal controls fail; the completeness meta-check (dimension → required coverage, including every new Appendix C constant, `value-clamped`, the canonical-observed-unrequested target row, and the over-long-`systemName` fixture) fails when a dimension, an identity row, or a cap row is removed; the live tree stays clean.
- [x] **6.2** Author `tests/golden/queue-ready.test.ts` and `tests/fixtures/queue-ready/golden/payload.json` (TC-QREADY-029): byte-for-byte `--json` payload and `human.txt` at a fixed run id, fixed clock `2026-10-31T00:00:00Z`, and the synthetic brand; the golden corpus includes the capped provider fixture so the payload carries its capped values (every projected identity `entityId`-only, no `systemName`) and `value-clamped` while every candidate line renders ≤32-character provider segments with a trailing `+` and the fixed `[repo:local-context; tier:priority-label]` suffix; ≤65 536/16/4096 bounds; no `error`; no `workItem.title` key; no `systemName` key; observed repo/tier evidence details carry `repo:local-context`/`tier:priority-label`; the goldens are deliberately regenerated for this revision; a changed-fact control changes the bytes and a stale-golden control fails; golden files read-only at test time.
- [x] **6.3** Author `tests/behaviour/queue-ready-performance.test.ts` and `tests/fixtures/queue-ready/bounds/cap-sized/**` (TC-QREADY-030): exactly three GitHub reads (issues 100, pulls 100, check-runs 20), one attempt each with no duplicate URL/retry/second page; exactly one logical park-fold read and ≤1 config resolve and ≤1 local-context read; zero quota fetches/engine calls; unavailable binding short-circuits to zero network reads with the payload still rendered; warm up once, median of five `evaluateQueueReady` runs, assert ≤50 ms with `performance.now()`; record the runtime version, machine class, and measured median; a deliberately expensive control keeps the timing assertion live; the bound is never relaxed.
- [x] **6.4** Author `tests/behaviour/queue-ready-live.test.ts` (TC-QREADY-031): skipped unless the tests-only literal `ADOS_QUEUE_READY_LIVE` (bound only in `tests/fixtures/queue-ready/harness.ts`, read only under `tests/**`) is exactly `1` and a resolvable `GITHUB_TOKEN` exists; compose the production-shaped edge over `nodeRepositoryIo`, `nodeFileSystemFacts`, a temp state root, the process credential port, and the GitHub client with native `fetch`; assert only structural invariants (one payload, six conditions per candidate, at least one known candidate observed through the §8.3 identity rule — the change ref when present, otherwise a candidate derived from an observed provider id, failing with a clear message rather than passing vacuously — no ready-with-non-satisfied, no merge-ready without observed approval, `deps-satisfied` unknown on the GitHub slice, a scoped provider `available` scan with the condition id exempt, ordered/deduped reasons, bounds, no secrets); never pin volatile counts; assert no live-switch constant exists in `packages/**` and the token is absent from the payload/evidence/human text; the suite is outside `pnpm check`/default CI.
- [x] **6.5** Author `.changeset/queue-ready-minor.md` (D11): `minor` for the lockstep fixed group (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`); brand-neutral summary naming the `queue ready` command, the `delivery.queue-ready.v1` contract, the six readiness conditions, close ranking, the identity-resolution rule, the provider-derived output caps, and the human digest; no hand-bumped versions; nothing publishes. Author `chg-GH-176-evidence.md`: per-phase commits/criteria, the 38-TC coverage map (37 default-green plus the opt-in TC-QREADY-031), gate consolidation with commands + HEAD, the delivery-bound resolutions (RES-1..RES-8), rollback instructions, and the performance environment. Never record unrun evidence as passing.
- [x] **6.6** Final local battery (record only executed evidence): `pnpm install --frozen-lockfile`; every focused queue-ready/golden suite; `bun test` (all layers); `pnpm check`; `bun run scripts/checks/{error-table-sync,forbidden-literals,ambient-globals,exit-code-literals,workspace-entrypoints}.ts`; `bash scripts/.tests/test-doc-distribution.sh`; `git diff --check`; `git status --porcelain` clean. No push; Phase 7 and PR handoff remain.

**Acceptance Criteria**:

- Must: AC-F17-1 complete (fixture corpus exact including the identity-resolution and provider-cap/clamp rows, opt-in structural live smoke that observes a known candidate, no volatile counts, tests-only switch); NFR-2/NFR-5/NFR-9/NFR-11 measured; TC-QREADY-028/029/030 green by default and TC-QREADY-031 green when `ADOS_QUEUE_READY_LIVE` is exactly `1` with a credential, otherwise skipped; the changeset recorded per conventions; the evidence artifact honest and complete; the full battery green on the working HEAD; clean tree; every phase commit's staged set matched its explicit list.
- Should: the evidence artifact links each TC to its exact execution command and phase; the performance record names the environment.

**Files and modules**:

- Code areas: `tests/behaviour/queue-ready-corpus.test.ts` (new), `tests/golden/queue-ready.test.ts` (new), `tests/behaviour/queue-ready-performance.test.ts` (new), `tests/behaviour/queue-ready-live.test.ts` (new), `tests/fixtures/queue-ready/{corpus,golden/payload.json,bounds/cap-sized,caps,literals}/**` (new), `.changeset/queue-ready-minor.md` (new), `chg-GH-176-evidence.md` (new).
- System docs: none (Phase 7 owns reconciliation).

**Tests**:

- TCs implemented: TC-QREADY-028, TC-QREADY-029, TC-QREADY-030, TC-QREADY-031.
- Verification: `bun test tests/behaviour/queue-ready-corpus.test.ts tests/golden/queue-ready.test.ts tests/behaviour/queue-ready-performance.test.ts`; `ADOS_QUEUE_READY_LIVE=1 bun test tests/behaviour/queue-ready-live.test.ts` only with a credential (otherwise it must skip); task 6.6 battery; `pnpm check` exit 0.

**Completion signal**: `docs(GH-176): record queue-ready changeset and delivery evidence with final battery`

---

### Phase 7: Documentation and spec synchronization (lifecycle phase 7 — `@doc-syncer`; handoff, NOT `@coder`)

**Goal**: Reconcile the current-truth docs with the delivered `queue ready` surface and register the new feature doc in the required scans. This phase is a handoff to `@doc-syncer`; `@coder` stops after Phase 6.

**Tasks**:

- [x] **7.1** Author `doc/spec/features/feature-queue-ready.md` with `ados_distribution: internal`: the command surface/grammar (including the 64-character canonical ref bound and the canonicalize → length → duplicate → read order), the six-condition tri-state contract and Appendix A derivation, the §8.3 identity-resolution rule (exact canonical match, unique all-digit suffix bridge, ambiguity unobserved, no coercion, full values before clamping), the `repo-free`/`tier-known` proxy caveats and their `repo:local-context`/`tier:priority-label` evidence details, the read-reuse posture (no new adapter read), command-level open-only close association with the evaluator-only merged/closed exclusion and `pr-not-open`, the one-record deps state-count evidence, the bounded title-free `delivery.queue-ready.v1` payload, the nine provider-derived output caps with the single `value-clamped` marker in reason group 2 and the deterministic byte-budget reduction, the human digest grammar with the fixed suffix, the 32-character provider segments with trailing `+`, and no rendered help surface, the exact truncation-flag scope, the evidence/reason vocabulary (group 2 markers, group-6 token), the engine-not-run provider posture with the scoped `available` claim rule, error-identity reuse, and the fixture/live-smoke evidence model described generically as "the test-harness-only live switch, enabled only at exactly `1`" — never by the environment-variable literal. Brand-neutral wording; no product literal.
- [x] **7.2** Reconcile `feature-status-digest.md` (cross-link `queue ready` as the separate ready-set command; the lanes-or-queue section stays `not-delivered`; the two commands share inputs and do not duplicate), `feature-provider-engine.md` (read-only consumer of the declared chain and verified park fold; never runs the engine or quota), `feature-state-layer.md` (read-only park-fold consumer, no writes), `feature-config-layer.md` (provider-branch consumer, no new keys), `feature-result-contract.md` (no new rows; `input.value.rejected` reused for grammar; source failures are evidence), and `feature-monorepo-scaffold-toolchain.md` (new queue-ready modules/tests; no new package, subpath, or runtime-API location).
- [x] **7.3** Reconcile `doc/planning/oss-tooling/cli-command-registry.md` (M0-S7 row semantics and the `queue ready`-before-`queue` documentation note; no rendered help surface exists or is added; M2-S1 remains the family/dispatch boundary), `doc/overview/glossary.md` (ready set, candidate, readiness condition, condition state, ready, blocking condition, close item, merge-ready, review-pending, new start, unknown close association, association, tier label, repo-free, owner gate, provider availability, engine not run, source at limit, truncation), and `doc/00-index.md` (new feature-spec link).
- [x] **7.4** Register `doc/spec/features/feature-queue-ready.md` by adding one entry to the `registered` list of `scripts/checks/forbidden-literals.registry.json` in the same change; the `allowlist` block and its five fixed entries must not change (cardinality stays five — never add a queue-ready or live-literal exception). Confirm the new doc contains no product literal, no `ADOS_`/`ados` string (describe the live smoke generically as the test-harness-only switch), and carries `ados_distribution: internal`.
- [x] **7.5** Cross-reference sweep: every link touched by 7.1–7.3 resolves; no other `doc/spec/**` page claims queue-ready behaviour that no longer holds; `bun run scripts/checks/{forbidden-literals,error-table-sync}.ts`, `bash scripts/.tests/test-doc-distribution.sh`, and `pnpm check` green after the edits.

**Acceptance Criteria**:

- Must: every Appendix I touchpoint reconciled or explicitly recorded unchanged; the new feature doc registered in the required scan with the forbidden-literal allowlist still at exactly five entries; the live smoke described generically without the `ADOS_`/`ados` literal in `doc/spec/**`; the result-contract documented table remains byte-untouched; the literal, distribution, sync, and aggregate checks green.
- Should: glossary entries stay one-sentence definitions in the existing table style.

**Files and modules**:

- Code areas: none.
- System docs: `doc/spec/features/feature-queue-ready.md` (new), `doc/spec/features/{feature-status-digest,feature-provider-engine,feature-state-layer,feature-config-layer,feature-result-contract,feature-monorepo-scaffold-toolchain}.md` (updated), `doc/planning/oss-tooling/cli-command-registry.md` (updated), `doc/overview/glossary.md` (updated), `doc/00-index.md` (updated), `scripts/checks/forbidden-literals.registry.json` (updated).

**Tests**:

- Verification: `bun run scripts/checks/forbidden-literals.ts` → exit 0; `bun run scripts/checks/error-table-sync.ts` → exit 0; `bash scripts/.tests/test-doc-distribution.sh` → green; `pnpm check` → exit 0.

**Completion signal**: `docs(GH-176): reconcile queue-ready system spec, registry, glossary, and index` (`@doc-syncer`; PM-scheduled)

---

## Remediation Iteration 2 (review FAIL)

**Trigger**: [code-review/review-iter-1.yaml](./code-review/review-iter-1.yaml) — local review of `feat/GH-176/queue-ready` with verdict `FAIL` (0 blocker / 2 major / 3 minor / 3 info; F-1..F-8). This section is appended after Phase 7; **no Phase 1–7 task text, check state, acceptance, or behaviour is rewritten here**. Phase 1–6 remain `@coder`-complete and Phase 7 remains the `@doc-syncer` handoff this remediation only records (R2.6).

**Scope**: F-1..F-6 only. F-7 (info) is a no-action acknowledgement; F-8 (info) is spec-only and PM-owned, so `@coder` must not edit `chg-GH-176-spec.md`.

| Finding | Severity | Task | Disposition |
|---|---|---|---|
| F-1 — group-5 reasons emitted in constant-array order | major | R2.1 | Fix `assembleReasons` to the documented candidate → condition → evidence walk; correct the `reasons-cap-7` corpus/golden expectation; add a walk-order assertion |
| F-2 — machine bound measured in UTF-16 code units | major | R2.2 | Pure UTF-8 byte helper used for the 65 536-byte machine budget and the 4096-byte human bound; CJK cap-sized fixture |
| F-3 — `Number` suffix ranking loses precision >2^53 | minor | R2.3 | BigInt (or length-then-lex) suffix comparator; large-suffix fixture with `compareNumericAware` consistency |
| F-4 — Phase 7 status/checkboxes stale vs `be722b2` | minor | R2.6 | Mark tasks 7.1–7.5 and the phase-status row complete; reconcile `chg-GH-176-evidence.md` |
| F-5 — UTF-16 slicing can split astral surrogate pairs | minor | R2.4 | Code-point-safe `clampValue`/`clampDetail`/`shortenSegment`; astral fixture |
| F-6 — `not-configured` CI read falls through to `read-failed` | info | R2.5 | Explicit defensive branch mapped to `signal-unavailable`, never `read-failed`; test |
| F-7 — dead defensive candidate evidence-cap branch | info | — | **No action.** Keep the branch; it is the authorized contract branch if a future condition can emit >2 records. Note retained in the evidence doc, not re-litigated. |
| F-8 — spec Appendix B omits `relationKind` | info | — | **No coder action.** Spec-only and PM-owned; `@pm` reconciles Appendix B or records the decision. Code and plan already agree (`relationKind: "blocked-by"`). |

**Execution order**: R2.1 → R2.2 → R2.3 → R2.4 → R2.5 → R2.6 → R2.7. One Conventional Commit per task under D10: explicit `git add` of exactly the task's files, staged-set check with `git status --porcelain`, `pnpm check` green, no push, no amend. A red gate blocks the commit; a moved spec constant, inventory drift, or spec/test-plan inconsistency is a STOP-and-report to PM — never a test weakening.

**Commit checkpoints**:

| Checkpoint | After | Conventional Commit | Staged set |
|---|---|---|---|
| CP-R2.1 | R2.1 | `fix(GH-176): emit group-5 reasons in documented walk order` | `packages/core/src/domain/queue-ready.ts`, `tests/fixtures/queue-ready/corpus/cases.ts`, `tests/behaviour/queue-ready-output.test.ts`, `tests/behaviour/queue-ready-corpus.test.ts`, golden files only if regenerated |
| CP-R2.2 | R2.2 | `fix(GH-176): measure machine and human bounds in UTF-8 bytes` | `packages/core/src/domain/queue-ready.ts`, `tests/fixtures/queue-ready/caps/non-ascii-byte-budget.ts`, `tests/behaviour/queue-ready-output.test.ts`, golden files only if bytes changed |
| CP-R2.3 | R2.3 | `fix(GH-176): rank large numeric suffixes without Number precision loss` | `packages/core/src/domain/queue-ready.ts`, `tests/fixtures/queue-ready/ranking/cases.ts`, `tests/behaviour/queue-ready-ranking.test.ts` |
| CP-R2.4 | R2.4 | `fix(GH-176): slice capped text on code points` | `packages/core/src/domain/queue-ready.ts`, `tests/fixtures/queue-ready/caps/astral.ts`, `tests/behaviour/queue-ready-output.test.ts` |
| CP-R2.5 | R2.5 | `fix(GH-176): map not-configured CI reads distinctly` | `packages/core/src/domain/queue-ready.ts`, `tests/behaviour/queue-ready-ci.test.ts` |
| CP-R2.6 | R2.6 | `docs(GH-176): record phase 7 doc sync completion` | `chg-GH-176-plan.md`, `chg-GH-176-evidence.md` |
| CP-R2.7 | R2.7 | none when the tree is clean; otherwise exactly one `chore(GH-176): close remediation iteration 2 battery` | residual files only; gate logs stay under `.ai/local/` and are never staged |

---

### R2.1 — Group-5 reasons follow the documented walk (F-1, major)

- [x] **R2.1** Rebuild reason group 5 (`condition-source-failure`) from the documented walk instead of the constant `QUEUE_READY_SOURCE_FAILURE_REASONS` array order, and make the corpus/golden expectations assert that walk.

**Files (exact)**:

- `packages/core/src/domain/queue-ready.ts` — `assembleReasons` (group-5 assembly; currently iterates the constant array inside the `QUEUE_READY_REASON_ORDER` loop). Pinned candidate traversal: the rank-sorted `candidates` array passed to `assembleReasons` after `drafts.sort(compareCandidates)` — i.e. ascending `rank`, never caller order.
- `tests/fixtures/queue-ready/corpus/cases.ts` — `reasons-cap-7.expected[0].reasons` order (currently `signal-unavailable` before `local-context-missing`).
- `tests/behaviour/queue-ready-output.test.ts` — new focused assertion that the emitted group-5 order is the walk, not the constant-array order.
- `tests/behaviour/queue-ready-corpus.test.ts` — exact ordered `reasons` assertion for `reasons-cap-7` (tighten any order-insensitive comparison).
- `tests/fixtures/queue-ready/golden/{payload.json,human.txt}` and `tests/golden/queue-ready.test.ts` — only if the golden fixture emits a group-5 reason; regenerate deliberately and record the diff.

**Implementation**:

- Walk `candidates` in rank order → `QUEUE_READY_CONDITION_ORDER` → each condition's `evidence` array in stored order; append `record.reason` iff it is in `QUEUE_READY_SOURCE_FAILURE_REASONS` and not already appended to group 5 (first occurrence wins).
- `QUEUE_READY_SOURCE_FAILURE_REASONS` remains only the membership set; it must not drive emission order.
- Groups 1–4 and 6, first-occurrence dedup, and the overall `QUEUE_READY_MAX_REASONS` (6) cap are unchanged; `read-failed`/`credential-unavailable` stay group-5 only.
- `reasons-cap-7` expectation becomes exactly `["source-truncated","value-clamped","config-invalid","state-unreadable","local-context-missing","signal-unavailable"]` (repo-free carries `local-context-missing` at condition 2; tier-known/no-owner-gate carry `signal-unavailable` at conditions 3–4).

**Verification**:

```bash
bun test tests/behaviour/queue-ready-output.test.ts tests/behaviour/queue-ready-corpus.test.ts
bun test tests/golden/queue-ready.test.ts
```

**Acceptance**:

- Must: for `reasons-cap-7`, group 5 emits `local-context-missing` before `signal-unavailable`, and the full list equals the pinned six-token order above.
- Must: a new test builds a candidate whose condition evidence order is the reverse of `QUEUE_READY_SOURCE_FAILURE_REASONS` and asserts walk order; a shuffled candidate input that sorts to the same rank order emits byte-identical `reasons`.
- Must: every other corpus row and the golden bytes are unchanged (except deliberate golden regeneration if a group-5 reason is present).
- Should: a comment in `assembleReasons` cites DM-1 and the rank-order traversal.

**Commit checkpoint**: `fix(GH-176): emit group-5 reasons in documented walk order` (CP-R2.1).

---

### R2.2 — Measure machine and human bounds in UTF-8 bytes (F-2, major)

- [x] **R2.2** Replace UTF-16 `.length` byte checks with a pure UTF-8 byte-length helper, enforce both the 65 536-byte machine and 4096-byte human bounds, and add a non-ASCII cap-sized fixture.

**Files (exact)**:

- `packages/core/src/domain/queue-ready.ts` — new `utf8ByteLength`; the initial machine budget and every `fits()` recheck (currently `JSON.stringify(payload).length`); the human renderer's line/byte enforcement.
- `tests/fixtures/queue-ready/caps/non-ascii-byte-budget.ts` — new pure builder: 8 candidates, 16 CJK labels and 16 CJK relation targets per candidate (plus CJK owner/name/branch/PR refs), sized so serialized `.length` stays ≤65 536 while UTF-8 bytes exceed 65 536 before reduction (the review's reproduction was 50 351 code units / 115 887 bytes).
- `tests/behaviour/queue-ready-output.test.ts` — new non-ASCII cap-sized bounds test.
- `tests/fixtures/queue-ready/golden/{payload.json,human.txt}`, `tests/golden/queue-ready.test.ts` — only if bytes change (expected unchanged: goldens are ASCII).
- `tests/behaviour/queue-ready-corpus.test.ts` — only if the `provider-over-cap-byte-budget` row is extended (not required).

**Implementation**:

- `utf8ByteLength(value: string): number` — pure and exported, code-point based (`for (const ch of value)`, 1/2/3/4 bytes per code point), with no `node:*`/`bun:*` import and no `Buffer`/`TextEncoder` dependency, so the domain stays runtime-neutral. An ASCII fast path is allowed only if results are identical.
- Replace `.length` **only** where a byte bound is intended: the hard machine bound, the `fits()` relation/label recheck, and the human bound. Character caps (`clampValue`, `clampDetail`, `shortenSegment`, ref/label counts) remain character semantics and are not byte counts.
- Human bound: after rendering, enforce `lines.length <= QUEUE_READY_MAX_HUMAN_LINES` and `utf8ByteLength(text) <= QUEUE_READY_MAX_HUMAN_BYTES`. No human reduction is authorized, so an over-cap render is a hard contract failure; pin a plain defensive `RangeError("queue-ready human digest exceeds its UTF-8 bound")` (no new error-table identity or error-table row). It is unreachable for a payload produced by `evaluateQueueReady` with a ≤276-character brand name. If the DoR/PM rejects a defensive throw, enforcement stays in the tests measured with the same exported helper; do not weaken the fixture or the bound.
- Fixture assertions: before reduction, `utf8ByteLength(JSON.stringify(payloadFromFixtureInputs)) > 65536` while `JSON.stringify(...).length <= 65536` (proves the fixture reaches the defect); after `evaluateQueueReady`, `utf8ByteLength(JSON.stringify(payload)) <= 65536`, `payload.truncated === true`, exactly one `value-clamped` in group 2, and trailing relations then labels dropped last-rank/highest-index first in the pinned order; the human digest `utf8ByteLength(human) <= 4096` and `≤16` lines; the test's independent `Buffer.byteLength`/`TextEncoder` oracle agrees with `utf8ByteLength`.
- The ASCII cap-sized cases (1 and 8 candidates) and the existing over-long/byte-budget cases stay green; no verdict, rank, close class, or reason changes on ASCII input.

**Verification**:

```bash
bun test tests/behaviour/queue-ready-output.test.ts tests/behaviour/queue-ready-corpus.test.ts
bun test tests/golden/queue-ready.test.ts
```

**Acceptance**:

- Must: no machine or human byte decision uses UTF-16 `.length`; the CJK fixture that was under 64 KiB in code units is reduced to ≤65 536 UTF-8 bytes with the pinned markers and no verdict change.
- Must: a non-ASCII human digest is ≤4096 UTF-8 bytes (the existing `Buffer.byteLength` assertion keeps passing and the renderer's guard is exercised by an oversized-brand control that fails by message).
- Must: the helper has no Node/Bun import and the domain purity/import tests stay green.
- Should: record the pre/post UTF-16-length vs UTF-8-byte margins in the execution log.

**Commit checkpoint**: `fix(GH-176): measure machine and human bounds in UTF-8 bytes` (CP-R2.2).

---

### R2.3 — Arbitrary-precision numeric suffix ranking (F-3, minor)

- [x] **R2.3** Replace `Number` suffix ranking with BigInt (or a length-then-lex comparator) so suffixes larger than 2^53 sort correctly, and add a large-suffix fixture with `compareNumericAware` consistency.

**Files (exact)**:

- `packages/core/src/domain/queue-ready.ts` — `refNumber` and `compareCandidates` (class rank, numeric suffix, canonical text).
- `tests/fixtures/queue-ready/ranking/cases.ts` — new `largeSuffixCandidates` and `largeSuffixOrder` exports.
- `tests/behaviour/queue-ready-ranking.test.ts` — order and pairwise-consistency assertions.

**Implementation**:

- Remove `refNumber`'s `Number(...)` path. Extract the suffix (`SUFFIX_PATTERN`), and when both suffixes are all-digits compare them as arbitrary-precision integers — BigInt, or strip leading zeros then compare length then lexicographically; equal numeric values tie at this key and canonical text decides.
- A ref without a numeric suffix ranks after every numeric suffix and ties with other suffix-less refs at this key.
- Keep class rank first, numeric suffix second, canonical text last; caller/API order never decides.
- Fixture: `["GH-9999999999999999","GH-10000000000000000","GH-10000000000000001"]` sorts in that numeric order (the current `Number` path inverts the first pair); add a ≥20-digit pair to force the length-then-lex branch; assert the implemented order equals `largeSuffixOrder` and pairwise sign agreement with `compareNumericAware`; `numericOrder` (`GH-007` before `GH-7`) and the class-order cases stay unchanged.

**Verification**:

```bash
bun test tests/behaviour/queue-ready-ranking.test.ts
```

**Acceptance**:

- Must: `GH-9999999999999999` sorts before `GH-10000000000000000` (and both before `GH-10000000000000001`); no `Number` conversion remains on the ranking path.
- Must: equal numeric values still tie and fall to canonical text (`GH-007` before `GH-7`); caller-order and reversed-input invariance still hold.
- Must: the fixture's expected order agrees pairwise with `compareNumericAware`.

**Commit checkpoint**: `fix(GH-176): rank large numeric suffixes without Number precision loss` (CP-R2.3).

---

### R2.4 — Code-point-safe cap and segment slicing (F-5, minor)

- [x] **R2.4** Make `clampValue`, `clampDetail`, and `shortenSegment` slice on code points so an astral surrogate pair is never split, and add an astral fixture.

**Files (exact)**:

- `packages/core/src/domain/queue-ready.ts` — `clampValue` (line ~99), `clampDetail` (~105), `shortenSegment` (~948).
- `tests/fixtures/queue-ready/caps/astral.ts` — new pure builder with astral labels, relations, owner/name, branch, timestamps, and pull-request `entityId`/`sourceRef` values at, below, and above the declared caps.
- `tests/behaviour/queue-ready-output.test.ts` — astral validity and bounds test.

**Implementation**:

- Slice with `Array.from(value)` (code points): `const points = Array.from(value); if (points.length <= cap) return value; return points.slice(0, cap).join("");`; for `shortenSegment`, `points.slice(0, QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS - 1).join("") + "+"`.
- The fast path must use code-point count, not `.length`, so an astral value with 20 code points / 40 code units at cap 32 is not falsely marked `value-clamped`.
- Never emit a lone surrogate; the declared caps keep their character (code-point) meaning.

**Verification**:

```bash
bun test tests/behaviour/queue-ready-output.test.ts
```

**Acceptance**:

- Must: no emitted projected value or human segment contains a lone surrogate (`/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/` and `/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/` both absent); every string round-trips through `TextEncoder`/`TextDecoder` unchanged.
- Must: an astral value at/below cap is unchanged and not `value-clamped`; an over-cap astral value is truncated to exactly the cap in code points with valid text; human segments are ≤32 code points with a trailing `+` when shortened.
- Must: ASCII caps and all existing cap fixtures stay green; no verdict/rank change.

**Commit checkpoint**: `fix(GH-176): slice capped text on code points` (CP-R2.4).

---

### R2.5 — Distinct defensive `not-configured` CI evidence (F-6, info)

- [x] **R2.5** Map a CI `StatusReadFailure` reason `not-configured` to a distinct evidence case instead of the `read-failed` fallback, and test it.

**Files (exact)**:

- `packages/core/src/domain/queue-ready.ts` — `ciCondition` (the `!facts.ci.ok` branch at ~380–397).
- `tests/behaviour/queue-ready-ci.test.ts` — defensive-branch test (constructed inline; no new fixture file).

**Implementation**:

- Add an explicit branch before the `read-failed` fallback: `facts.ci.reason === "not-configured"` → `{ id: "ci-healthy", state: "unknown", evidence: [{ source: "ci", reason: "signal-unavailable", ...(bounded failure detail when the read supplies a code/class) }] }`. `signal-unavailable` is an existing vocabulary token, so `QUEUE_READY_EVIDENCE_REASONS` stays at 41 and no error row is added. Do not add a `not-configured` reason token: that would be a spec/DM-10 vocabulary change outside this remediation.
- Keep the `credential-unavailable` and `commit-unresolved` branches and the `read-failed` fallback for actual attempted failures.
- The composed command short-circuits on an unavailable binding, so this is defensive pure-evaluator handling only: no corpus row is added or changed; record that reachability in a code comment.
- Test: observed binding + resolved SHA + `ci: { ok: false, reason: "not-configured" }` → `ci-healthy` unknown with `{ source: "ci", reason: "signal-unavailable" }` and never `read-failed`; top-level group 5 contains `signal-unavailable`, not `read-failed`; a companion `read-failed` control still maps to `read-failed`.

**Verification**:

```bash
bun test tests/behaviour/queue-ready-ci.test.ts
```

**Acceptance**:

- Must: `not-configured` never produces `read-failed`; the evidence reason is `signal-unavailable` and the condition stays `unknown`.
- Must: credential, unresolved-SHA, and attempted-failure mappings are unchanged; no new vocabulary token, error row, corpus row, or read.
- Should: the defensive comment states why the branch is unreachable through the composed command.

**Commit checkpoint**: `fix(GH-176): map not-configured CI reads distinctly` (CP-R2.5).

---

### R2.6 — Reconcile Phase 7 completion with `be722b2` (F-4, minor)

- [x] **R2.6** Mark Phase 7 complete in this plan and in `chg-GH-176-evidence.md` to match the delivered doc-sync commit `be722b2`, and remove the stale "Phase 7 not started / remain for `@doc-syncer`" text.

**Files (exact)**:

- `doc/changes/2026-10/2026-10-31--GH-176--queue-ready/chg-GH-176-plan.md` — Phase 7 task checkboxes 7.1–7.5 → `[x]`; the phase-status table row `7` → `Complete` with commit `be722b2` and a note that `@doc-syncer` performed the handoff; remove "Not started (`@doc-syncer`)"; change no other task text.
- `doc/changes/2026-10/2026-10-31--GH-176--queue-ready/chg-GH-176-evidence.md` — replace the "Phase 7 … intentionally not performed here" header text and the "remain for `@doc-syncer`" handoff lines with the completed record at `be722b2` (feature doc, reconciled docs, forbidden-literals registry entry, checks run).

**Verification**:

```bash
git log --oneline -1 be722b2
rg -n 'Not started|remain for .?@doc-syncer|intentionally not performed' doc/changes/2026-10/2026-10-31--GH-176--queue-ready/chg-GH-176-plan.md doc/changes/2026-10/2026-10-31--GH-176--queue-ready/chg-GH-176-evidence.md
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/error-table-sync.ts
bash scripts/.tests/test-doc-distribution.sh
```

Expect no `rg` matches after the edit; every check exits 0.

**Acceptance**:

- Must: `git log -1 --format=%s be722b2` names the queue-ready system-spec/doc reconciliation; Phase 7 tasks 7.1–7.5 are checked and the status row records `Complete`/`be722b2`; the evidence doc records completion; no "Phase 7 not started" or "remain for `@doc-syncer`" text remains; plan, evidence, and pm-notes agree.
- Must: no Phase 1–6 task, AC/TC mapping, behaviour, or implementation file changes in this task.
- Should: cite `be722b2` in both artifacts.

**Commit checkpoint**: `docs(GH-176): record phase 7 doc sync completion` (CP-R2.6).

---

### R2.7 — Final remediation battery (checkpoint)

- [x] **R2.7** Run the full remediation battery and record only executed evidence; no push.

**Commands (in order)**:

```bash
pnpm install --frozen-lockfile
bun test tests/behaviour/queue-ready-output.test.ts tests/behaviour/queue-ready-corpus.test.ts tests/behaviour/queue-ready-ranking.test.ts tests/behaviour/queue-ready-ci.test.ts tests/golden/queue-ready.test.ts
bun test
pnpm check
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
bash scripts/.tests/test-doc-distribution.sh
git diff --check
git status --porcelain
```

**Acceptance**:

- Must: every command exits 0 (the opt-in TC-QREADY-031 live suite may remain skipped without `ADOS_QUEUE_READY_LIVE=1` + credential); focused suites green; `pnpm check` green; the ASCII cap-sized case still produces no unintended marker, and the CJK/astral cases are green; all five invariant checks and doc-distribution green; `git diff --check` clean; `git status --porcelain` clean; no push; commands and HEAD recorded under `.ai/local/` (never staged).
- Must: no test weakening, skipped remediation test, or relaxed bound; any residual failure is fixed and the battery re-run.
- Should: record the measured byte margins (UTF-16 length vs UTF-8 bytes before/after reduction) and the `be722b2` doc-sync confirmation in the execution log/evidence.
- **Commit checkpoint**: no commit when the tree is clean. If residual golden/test updates from earlier tasks remain, fix them, re-run, and make exactly one `chore(GH-176): close remediation iteration 2 battery` commit staging only those residual files; never amend an earlier task commit (CP-R2.7).

---

## Remediation Iteration 3 (review iter-2 FAIL)

**Trigger**: [code-review/review-iter-2.yaml](./code-review/review-iter-2.yaml) — local re-review of `feat/GH-176/queue-ready` with verdict `FAIL` (0 blocker / 1 major / 3 minor / 1 info; F-9..F-13). This section is appended after Phase 7 and after the Iteration-2 section; **no Phase 1–7 task text, check state, acceptance, R2.x task text, or delivered behaviour is rewritten here**. Iteration-2 tasks R2.1–R2.7 stay `[x]` and remain the record of that remediation.

**Scope**: F-9..F-13 only, plus the closing battery (R3.6). No TC id, AC, NFR, condition id/order, reason, state, close class, rank, machine bound, error identity, package, subpath, or runtime-API location changes. The delivered default suite is green (1786 pass / 3 skip / 0 fail per the review); every finding below is reachable only through contract-level probes, so these tasks add the probes *and* the fixes.

| Finding | Severity | Task | Disposition |
|---|---|---|---|
| F-9 — human renderer throws for a legal multi-byte payload (F-2 human half) | major | R3.1 | Byte-aware, total renderer: `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` 32 (including `+`), header owner/name 128 and branch 256 UTF-8 bytes, candidate line ≤400 and header+summary ≤620 UTF-8 bytes, and a reverse-rank candidate-line drop marked `+more` instead of a throw; 8-candidate astral and synthetic over-budget fixtures |
| F-10 — canonical golden is hand-built and not a valid DM-1/DM-2 payload | minor | R3.2 | Evaluator-produced canonical golden (split rather than hand-build where shapes cannot coexist), consistent GH-180 observation, `pr-association-unknown` in group 6, DM-1/DM-2 validity assertions and corrupted-twin controls |
| F-11 — CJK byte-budget case does not assert the pinned reduction order | minor | R3.3 | Sentinel-encoded relations/labels and an exact survivor-set oracle for relations-before-labels, last-ranked-first, highest-index-first, stop-at-first-fit |
| F-12 — unplanned public `classifyPipelineRuns` re-export | minor | R3.4 | Remove both re-exports; keep the classifier module-internal (the delivered consumers already import `./ci-result.js`) |
| F-13 — stale artifact version references | info | R3.5 | Evidence and plan status/revision references to spec v1.8 / test plan v1.8 / plan v1.7; drop any "Pending doc-syncer re-run" statement |

**Prior findings**: **F-7 remains accepted, no action** (the defensive candidate evidence-cap branch is authorized and retained; see the Iteration-2 table). **F-8 is already fixed** (spec v1.7 Appendix B shows `{ relationKind: "blocked-by", target: { entityId } }`, independently verified closed by review iteration 2); R3.4's export cleanup is a different concern and does not reopen F-8. F-1, F-3, F-4, F-5, F-6 and the machine half of F-2 are verified closed and must stay closed; a regression is a STOP-and-report to PM.

**Pin supersession (authoritative for the executor)**: this section is the current requirement for the human renderer and it supersedes, without rewriting, every earlier plan statement of `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS`, "32 characters"/"32-character provider segments", the ASCII-only 400-byte/620-byte derivation, "an over-cap render is a test failure", the `RangeError("queue-ready human digest exceeds its UTF-8 bound")` guard, and the R2.2 text that declares the human throw unreachable — wherever those appear (RES-7, the "Pinned Delivery Spellings" constant table and renderer bullets, D7, the Scope/Constraints/Risks bullets, the completed Phase 1/5/6/7 task texts 1.1/1.2/1.4/1.5/5.2/5.3/6.2/7.1, and R2.2/R2.4). Those lines stay verbatim as delivered history and are read through spec v1.8 DM-12/DEC-20 and this section. The machine `QUEUE_READY_MAX_MACHINE_BYTES` (65 536 UTF-8 bytes) rule is unchanged.

**Execution order**: R3.1 → R3.2 → R3.3 → R3.4 → R3.5 → R3.6. One Conventional Commit per task under D10: explicit `git add` of exactly the task's files, staged-set check with `git status --porcelain`, `pnpm check` green, no push, no amend. A red gate blocks the commit; a moved spec constant, inventory drift, or spec/test-plan inconsistency is a STOP-and-report to PM — never a test weakening.

**Commit checkpoints**:

| Checkpoint | After | Conventional Commit | Staged set |
|---|---|---|---|
| CP-R3.1 | R3.1 | `fix(GH-176): render a byte-aware total human digest` | `packages/core/src/contracts/{queue-ready,index}.ts`, `packages/core/src/domain/queue-ready.ts`, `tests/fixtures/queue-ready/caps/{human-astral-8,human-over-budget}/**`, `tests/behaviour/queue-ready-output.test.ts`, `tests/behaviour/queue-ready-corpus.test.ts`, `tests/golden/queue-ready.test.ts`, `tests/structure/queue-ready-contract.test.ts`, golden payload/human only if the bytes changed |
| CP-R3.2 | R3.2 | `test(GH-176): make the canonical golden a valid evaluator payload` | `tests/fixtures/queue-ready/golden/canonical.ts`, `tests/fixtures/queue-ready/golden/{payload.json,human.txt}`, `tests/golden/queue-ready.test.ts` |
| CP-R3.3 | R3.3 | `test(GH-176): assert the pinned byte-budget reduction order` | `tests/fixtures/queue-ready/caps/non-ascii-byte-budget.ts`, `tests/behaviour/queue-ready-corpus.test.ts` |
| CP-R3.4 | R3.4 | `fix(GH-176): keep the CI classifier module-internal` | `packages/core/src/domain/index.ts`, `packages/core/src/index.ts`, `tests/structure/queue-ready-contract.test.ts` and exports-parity/inventory files only if they name the removed export |
| CP-R3.5 | R3.5 | `docs(GH-176): record plan v1.7 and spec v1.8 references` | `chg-GH-176-evidence.md`, `chg-GH-176-plan.md` |
| CP-R3.6 | R3.6 | none when the tree is clean; otherwise exactly one `chore(GH-176): close remediation iteration 3 battery` | residual files only; gate logs stay under `.ai/local/` and are never staged |

---

### R3.1 — Byte-aware, total human renderer (F-9, major)

- [x] **R3.1** Make `renderQueueReadyHuman` byte-aware and total: rename the segment cap to UTF-8 bytes, byte-cap the header fields, enforce the 400-byte candidate-line and 620-byte header-plus-summary budgets, and replace the over-bound throw with a deterministic reverse-rank candidate-line drop marked `+more`. (commit b8292a6; focused suites 60 pass; `pnpm check` 2059 pass / 3 skip / 0 fail; old `..._CHARS` grep zero in `packages/**`/`tests/**`)

**Files (exact)**:

- `packages/core/src/contracts/queue-ready.ts` — rename `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` to `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (value stays `32`, now UTF-8 bytes of a per-candidate provider segment including a trailing `+`); update the doc comment. No other constant changes.
- `packages/core/src/contracts/index.ts` — rename the entry in the named `queue-ready.js` export list (line ~256).
- `packages/core/src/domain/queue-ready.ts` — `shortenSegment` (~1020), `humanDetail` (~1027), `renderQueueReadyHuman` (~1049, header line and the post-render guard at ~1064). No other module.
- `tests/fixtures/queue-ready/caps/human-astral-8/facts.ts` (new; directory name matches the test plan's `caps/human-astral-8/**`) — 8 candidates, a 256-code-point astral head branch, and in-cap astral `entityId`/`sourceRef` values on the associated close items, plus not-ready candidates carrying six blocking conditions, so the payload is legal (`data` ≤65 536 UTF-8 bytes) while only byte-aware renderer caps keep the digest within 4 096 bytes.
- `tests/fixtures/queue-ready/caps/human-over-budget/facts.ts` (new; `caps/human-over-budget/**`) — a legal cap-sized payload plus an over-long synthetic brand value whose fully byte-capped render (header + summary + 8 candidate lines) still exceeds 4 096 bytes, used only to exercise the reverse-rank line drop.
- `tests/behaviour/queue-ready-output.test.ts` — TC-QREADY-020 assertions (replaces the R2.2 "rejects a digest over its UTF-8 bound by message" control).
- `tests/behaviour/queue-ready-corpus.test.ts` — the constant token meta-check (`QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` → `..._BYTES` and `.toBe(32)`).
- `tests/golden/queue-ready.test.ts` — the "provider segments are at most 32 characters" assertion becomes 32 UTF-8 bytes.
- `tests/structure/queue-ready-contract.test.ts` — constant name/value binding (lines ~25, ~163, ~252, ~333) and an assertion that the old `..._CHARS` export no longer exists.
- `tests/fixtures/queue-ready/golden/{payload.json,human.txt}` — only if the rendered bytes change (the golden provider values are ASCII, so no change is expected; if they do change, regenerate deliberately and record the diff).

**Implementation**:

- Export exactly one new name `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES = 32`; delete `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` everywhere under `packages/**` and `tests/**` (a repository-wide grep must return zero hits afterwards).
- Add one pure helper `truncateToBytes(value: string, maxBytes: number): string`: walk `Array.from(value)` code points, accumulate `utf8ByteLength(codePoint)`; if the total is ≤ `maxBytes` return the value unchanged and unmarked; otherwise keep the longest code-point prefix whose bytes fit `maxBytes - 1` and append `+`, so the result is ≤ `maxBytes` UTF-8 bytes, the `+` counts toward the cap, and no code point or surrogate pair is split. An all-astral prefix at the cap is 8 code points; an all-CJK prefix is 10; an ASCII prefix is 31.
- `shortenSegment(value)` = `truncateToBytes(value, QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES)`; apply it to `PR #<entityId>` as one segment and `<sourceRef>` as the other (unchanged composition in `humanDetail`).
- Header: render owner with `truncateToBytes(owner, 128)`, name with `truncateToBytes(name, 128)`, branch with `truncateToBytes(branch, 256)`; each carries a trailing `+` only when shortened. These are renderer rules: no payload field changes and no `value-clamped` marker.
- Enforce the derived budgets as invariants and keep the renderer total: after composing a candidate line, if `utf8ByteLength(line) > 400` treat it as an over-budget line and enter the drop path below starting with that (lowest-ranked) line; assert in tests that a line at every declared cap is ≤400 bytes (DM-12 worst case 366).
- Replace the `RangeError` guard with: while (`lines.length > QUEUE_READY_MAX_HUMAN_LINES` or `utf8ByteLength(text) > QUEUE_READY_MAX_HUMAN_BYTES`), drop the last candidate line (candidates are rank-ascending, so this is the last-ranked remaining candidate) and set `dropped = true`; keep the header (when present) and the summary line. If the digest is still over after every candidate line is dropped (only possible through an over-long injected brand), shorten the header's binary-name token to the largest prefix that fits while keeping the summary line, and set `dropped = true`. Never throw, never return an unbounded digest.
- `+more`: append it to the summary when `payload.truncated || dropped` (the existing marker already covers payload truncation so a defensive line drop keeps the same convention). The drop is renderer-only: no payload field changes, the payload `truncated` flag and `reasons` are unchanged (no new token), and the summary line keeps reporting the payload-level counts.
- Out of scope for `@coder`: `doc/spec/features/feature-queue-ready.md` line 182 still claims the ASCII-only derivation; its reconciliation is a Phase-7 `@doc-syncer` follow-up after this task lands. Do not edit `doc/spec/**` or `doc/changes/**/chg-GH-176-spec.md` here.

**Tests**:

- `tests/behaviour/queue-ready-output.test.ts` (TC-QREADY-020):
  1. `human-astral-8` through `runQueueReadyCli` human mode: exit code `0`, stdout non-empty, no `fallback.internal`, no `RangeError` escapes, digest ≤16 lines and ≤4 096 UTF-8 bytes, and the `--json` payload is byte-identical to the payload used for the human render.
  2. Fixture-reaches-the-defect proof: a local character-capped oracle (slice each segment to 32 code points) produces >4 096 UTF-8 bytes for the same payload, so the fixture exercises the reported defect rather than a benign case.
  3. Per-segment byte rule: every rendered `PR #<entityId>` and `<sourceRef>` segment is ≤32 UTF-8 bytes, shortened segments end with `+`, every value round-trips through `TextEncoder`/`TextDecoder` unchanged, and no lone surrogate appears.
  4. Header rule: owner ≤128 and name ≤128 and branch ≤256 UTF-8 bytes with `+` when shortened; header plus summary ≤620 UTF-8 bytes excluding the injected binary name; every candidate line ≤400 UTF-8 bytes; all counts include the suffix and separators.
  5. `human-over-budget`: trailing candidate lines are dropped in reverse rank order (last-ranked first, then the next-highest), the surviving lines are exactly the highest-ranked candidates, the header and summary survive, `+more` follows the summary, and `data.truncated`, `data.reasons`, `data.summary`, and every candidate object are identical to the same payload rendered without the drop; exit `0`; digest ≤16 lines/4 096 bytes.
  6. Boundary cases: ASCII at 32/33 bytes, CJK at the 3-byte boundary, an 8-code-point astral value (32 bytes, unmarked) and a 9-code-point astral value (7 code points retained, 28 bytes, plus `+` = 29 bytes ≤32), and a 4-byte code point that would cross the cap (dropped whole, never split).
  7. Replace the old oversized-brand control: a 5 000-character synthetic brand no longer throws — the header shortens, the summary survives, the digest is ≤4 096 bytes, and the exit path stays `0`.
- `tests/structure/queue-ready-contract.test.ts` (TC-QREADY-024): `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES === 32`; `QUEUE_READY_MAX_HUMAN_LINES === 16`; `QUEUE_READY_MAX_HUMAN_BYTES === 4096`; a mutation that restores the `..._CHARS` name or changes the value fails by name.
- `tests/behaviour/queue-ready-corpus.test.ts`: the Appendix C constant-completeness token list names `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES`.
- `tests/golden/queue-ready.test.ts` (TC-QREADY-029): the segment assertion measures UTF-8 bytes, not code points; the golden bytes stay unchanged.

**Verification**:

```bash
rg -n 'QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS' packages tests || true   # expect zero hits
bun test tests/behaviour/queue-ready-output.test.ts tests/behaviour/queue-ready-corpus.test.ts
bun test tests/golden/queue-ready.test.ts tests/structure/queue-ready-contract.test.ts
```

**Acceptance**:

- Must: `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES = 32` exists and `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` exists nowhere in `packages/**` or `tests/**`; the contract test and the constant-completeness meta-check are green.
- Must: the 8-candidate astral worst case renders ≤4 096 UTF-8 bytes and ≤16 lines, exits `0`, and never yields `fallback.internal` or any throw; the same payload is legal (`data` ≤65 536 UTF-8 bytes) and all six conditions/close fields are unchanged.
- Must: every per-candidate provider segment is ≤32 UTF-8 bytes including a trailing `+`, with no split code point and no lone surrogate; header owner/name ≤128 and branch ≤256 UTF-8 bytes; a candidate line ≤400 and header plus summary ≤620 UTF-8 bytes at the declared caps.
- Must: the synthetic over-budget payload drops trailing candidate lines in reverse rank order, keeps the header and summary, marks `+more`, changes no payload field, sets no `truncated` flag, adds no reason token, and exits `0`.
- Must: no payload field, condition verdict, close class, rank, `associatedCount`, `summary`, `reasons`, error identity, or machine bound changes; no `doc/spec/**` or spec/test-plan file is edited.
- Should: record the measured pre/post byte maxima (character-capped vs byte-capped render, candidate line, header plus summary) in the execution log.

**Commit checkpoint**: `fix(GH-176): render a byte-aware total human digest` (CP-R3.1).

---

### R3.2 — Contract-valid, evaluator-produced canonical golden (F-10, minor)

- [x] **R3.2** Make the canonical golden a payload the evaluator can actually produce and assert DM-1/DM-2 validity, fixing the impossible GH-180 shape and the missing `pr-association-unknown` reason. (commit 0f0000f; payload 9 920 bytes / human 609 bytes regenerated from `evaluateQueueReady`; DM-1/DM-2 validator with 8 corrupted twins; focused suites 68 pass)

**Files (exact)**:

- `tests/fixtures/queue-ready/golden/canonical.ts` — replace the hand-constructed `QueueReadyCandidate[]` with a canonical fact set evaluated through `evaluateQueueReady` (import the pure evaluator from `packages/core/src/domain/queue-ready.ts`, as the other fixtures import pure test-side code); export the fact builder and the derived payload. If all five close classes cannot coexist in one evaluator payload, split into additional evaluator-produced fact sets (see Implementation) instead of restoring a hand-built array.
- `tests/golden/queue-ready.test.ts` — DM-1/DM-2 validity assertion plus corrupted-twin controls; the byte-for-byte assertions stay.
- `tests/fixtures/queue-ready/golden/payload.json`, `tests/fixtures/queue-ready/golden/human.txt` — regenerated exactly once from the evaluator-produced payload and `renderQueueReadyHuman(payload, SYNTHETIC_BRAND)`; the diff is committed and recorded.

**Implementation**:

- **Evaluator-produced.** `canonicalPayload()` returns `evaluateQueueReady(canonicalFacts())`. Pick the canonical fact set so one payload carries `merge-ready`, `review-pending`, `new-start`, and `not-ready` with the capped/clamped provider values and the truncated payload the golden already proves (`value-clamped` in group 2). The `unknown` close association is read/page-scoped in the pure evaluator (a failed pull read yields `unknown` for every candidate; an at-limit page yields `unknown` for a candidate with no open match), so it cannot coexist with an observed association in one payload: add a second evaluator-produced fact set `canonicalUnknownCloseFacts()` whose pulls read fails, and assert its payload's `unknown` class, `pr-association-unknown` group-6 reason, and validity in the golden test (a second byte pair is optional and must be evaluator-generated if added).
- **GH-180 fix.** No payload may carry `workItem.state: "unknown"` together with `ready: true`, with all six conditions `satisfied`, or with a satisfied deps/tier/owner triple: an unobserved candidate makes `deps-satisfied`, `tier-known`, and `no-owner-gate` `unknown` and `ready` false. In the `canonicalUnknownCloseFacts()` payload every candidate is therefore **observed** (state, labels, `updatedAt`, relations) with all six conditions satisfied and `ready: true` — the legal AC-F14-1 control-20/22 shape — and each close is `{ association: "unknown", associatedCount: 0, reason: "pr-association-unknown" }`; the byte-golden canonical payload carries no `unknown`-close candidate at all.
- **Reasons.** `reasons` is the evaluator's output, not a literal: group 6 carries exactly `pr-association-unknown` and last whenever any candidate association is `unknown`; group 2 carries `value-clamped` after `source-truncated` when the projection clamped; no `read-failed`/`credential-unavailable` enters group 6.
- **DM-1/DM-2 validation (in `tests/golden/queue-ready.test.ts`).** Assert on the canonical payload and on every evaluator-produced extra payload: `schemaVersion === "delivery.queue-ready.v1"`; exact payload/candidate/condition/close/evidence key sets and order; six conditions in `QUEUE_READY_CONDITION_ORDER`; each condition 1..2 records with `source` in `QUEUE_READY_EVIDENCE_SOURCES` and `reason` in `QUEUE_READY_EVIDENCE_REASONS`; `provider-available` exactly 2 records; `ready === (all six satisfied)`; `blockingConditions` equals the non-satisfied ids in fixed order; `closeClass` consistent with association/draft/review (merge-ready only for an observed approval on a non-draft associated PR, `unknown` never rendered as `new-start`); `rank` the contiguous 1..n sequence ascending by the pinned keys; `summary` derived from the candidates; `associatedCount` in `0..100`; `reasons` in the six-group order with first-occurrence dedup, group 2 = `source-truncated` then `value-clamped`, group 6 = exactly `pr-association-unknown` and last and present iff some association is `unknown`; `truncated` true iff a clamp/reduction/source-at-limit occurred; no `title` key and no `systemName` key or value anywhere.
- **Corrupted twins (must fail by name).** At least: unknown work item with all conditions satisfied/`ready: true`; unknown association with `reasons` missing `pr-association-unknown`; `ready: true` with one `unsatisfied` condition; `blockingConditions` missing a non-satisfied id; a summary count off by one; a rank gap or duplicate rank; a `systemName` key planted in a projected identity; `value-clamped` outside group 2.
- No production code change; no behaviour, reason, bound, or rank change.

**Verification**:

```bash
bun test tests/golden/queue-ready.test.ts
bun test tests/behaviour/queue-ready-negative-controls.test.ts tests/behaviour/queue-ready-output.test.ts
git diff --stat -- tests/fixtures/queue-ready/golden
```

**Acceptance**:

- Must: `canonicalPayload()` is produced by `evaluateQueueReady` (no hand-constructed candidate array remains at `tests/fixtures/queue-ready/golden/canonical.ts:140`); if a shape cannot be evaluator-produced it is split into an evaluator-produced extra fact set, not hand-built.
- Must: the canonical payload and the `canonicalUnknownCloseFacts()` payload pass every DM-1/DM-2 assertion above; the unknown-close candidate is observed with `ready: true` and `pr-association-unknown` last in `reasons`; no impossible `workItem.state: "unknown"` with satisfied conditions or `ready: true` remains anywhere in the fixtures.
- Must: the corrupted-twin controls fail by name and the unmutated payload is green; `human.txt` is derived from the same payload through `renderQueueReadyHuman` and byte-equal.
- Must: TC-QREADY-029 stays green, the payload/human goldens are regenerated exactly once, and no production file, TC id, AC, NFR, or mapping changes.
- Should: record the regenerated golden diff (line counts, bytes) in the execution log.

**Commit checkpoint**: `test(GH-176): make the canonical golden a valid evaluator payload` (CP-R3.2).

---

### R3.3 — Assert the pinned byte-budget reduction order (F-11, minor)

- [x] **R3.3** Make the CJK byte-budget case assert the exact reduction order — relations before labels, last-ranked candidate first, highest index first, stop at the first fit — instead of only that some entries were dropped. (commit 02207ce; reduced 65 376 bytes / `value-clamped`; drops: rank 8→3 lose all 16 relations, rank 2 loses 5, rank 1 and all labels survive; pinned-oracle exact survivors + labels-first/rank-asc/index-asc mutations fail by name)

**Files (exact)**:

- `tests/fixtures/queue-ready/caps/non-ascii-byte-budget.ts` — encode rank/index sentinels into the multi-byte relation targets and labels so survivors are observable, and export the fact sets plus the sentinel helpers (keep the existing `nonAsciiByteBudgetFacts`/`nonAsciiByteBudgetControlFacts` exports and the UTF-16-under/UTF-8-over sizing).
- `tests/behaviour/queue-ready-corpus.test.ts` — the exact-order oracle for TC-QREADY-035 (the existing loose assertion in `tests/behaviour/queue-ready-output.test.ts:194` may stay; it is not the order proof).

**Implementation**:

- Relation target `entityId` = 120 CJK characters + `r<rank><index>` (≤128 characters, unique per candidate/index, still 3-byte multi-byte safe); label = 120 CJK characters + `l<rank><index:02>`; keep `priority:high` at label index 0 in every candidate so tier stays satisfied and the control verdicts are identical.
- Oracle: simulate the pinned algorithm in the test — drop trailing relations from the last-ranked candidate, highest index first, then trailing labels the same way, rechecking `Buffer.byteLength(JSON.stringify(candidateProjection))`/the serialized payload after each drop — and assert the payload's surviving relation and label sets are **exactly** the oracle's survivors per candidate (not just "fewer").
- Structural assertions that name the failure mode: every surviving collection is a prefix (no interior gap); for each candidate, no label is dropped while any relation remains in that candidate or in any lower-ranked candidate (relations strictly before labels); drop counts are non-decreasing as rank increases (rank 8 drops at least as much as rank 1); the first dropped element is the smallest additional drop that would not fit — rebuilding the payload with that one element restored exceeds 65 536 bytes (proves the recheck stops at the first fit and does not over-reduce).
- Keep: `payload.truncated === true`, exactly one `value-clamped` in group 2, and `verdictOf(payload)` equal to `verdictOf(evaluateQueueReady(nonAsciiByteBudgetControlFacts()))` (no verdict, rank, or close change from the reduction).

**Verification**:

```bash
bun test tests/behaviour/queue-ready-corpus.test.ts
bun test tests/behaviour/queue-ready-output.test.ts
```

**Acceptance**:

- Must: the test asserts exact survivor sets; a mutation that drops labels before relations, reduces rank 1 before rank 8, or drops relations in ascending index order fails by name.
- Must: survivors are prefixes, the relation-before-label ordering holds, and the stop-at-first-fit assertion holds (restoring one dropped element exceeds the byte bound).
- Must: `truncated` plus exactly one `value-clamped` and verdict identity with the ASCII control are still asserted; the machine 65 536-byte bound and the human 4 096-byte bound stay green; no production file changes.
- Should: record the measured pre/post UTF-8 bytes and the per-candidate drop counts in the execution log.

**Commit checkpoint**: `test(GH-176): assert the pinned byte-budget reduction order` (CP-R3.3).

---

### R3.4 — Keep the CI classifier module-internal (F-12, minor)

- [x] **R3.4** Remove the unplanned public `classifyPipelineRuns` re-export from the domain barrel and the package root, restoring the plan's export discipline (only `evaluateQueueReady` and `renderQueueReadyHuman` are the queue-ready additions). (commit e83baf6; both barrel grep hits removed; `ci-result.ts` and the direct `./ci-result.js` imports unchanged; focused 71 pass; `pnpm check` 2065 pass / 3 skip / 0 fail)

**Files (exact)**:

- `packages/core/src/domain/index.ts` — delete `export { classifyPipelineRuns } from "./ci-result.js";` (line 9); keep every other re-export unchanged.
- `packages/core/src/index.ts` — delete the `classifyPipelineRuns,` entry from the `./domain/index.js` re-export block (line 49).
- `tests/structure/queue-ready-contract.test.ts` — assert the queue-ready additions on the public surface are exactly `evaluateQueueReady`/`renderQueueReadyHuman` and that `classifyPipelineRuns` is not importable from `packages/core/src/index.ts` or `packages/core/src/domain/index.ts`.
- Exports-parity/inventory files only if they name the removed export: `tests/structure/{content-inventory,subpaths,port-contract-inventory}.test.ts`, `tests/structure/inventory.json`, `tests/fixtures/ports/v1-contract-inventory.json`. `content-inventory.test.ts:116` keeps the `core/src/domain/ci-result.ts: ["classifyPipelineRuns"]` module entry — the module still exports the function; only the barrels stop re-exporting it.

**Implementation**:

- Delete the two re-exports. `packages/core/src/domain/ci-result.ts` keeps `export const classifyPipelineRuns`, and `domain/status.ts`/`domain/queue-ready.ts` keep importing `./ci-result.js` directly — no consumer imports it from a barrel (verify by grep).
- Do not add a replacement export, alias, or deprecation shim; do not change `ci-result.ts`, the classifier behaviour, or `checkPipeline` consumers.
- The feature doc's component table already states only the two functions are re-exported from `domain/index.ts`, so removing the extra surface makes the delivered doc true; no doc edit is needed here.

**Verification**:

```bash
rg -n 'classifyPipelineRuns' packages/core/src/index.ts packages/core/src/domain/index.ts || true   # expect zero hits
rg -n 'from "@delivery-os/core"' tests packages | head
bun test tests/structure/queue-ready-contract.test.ts tests/structure/content-inventory.test.ts tests/structure/subpaths.test.ts tests/structure/port-contract-inventory.test.ts
bun test tests/behaviour/queue-ready-ci.test.ts tests/behaviour/status-*
```

**Acceptance**:

- Must: neither barrel re-exports `classifyPipelineRuns`; `ci-result.ts` still exports it and `status.ts`/`queue-ready.ts` still import it from `./ci-result.js`; no runtime behaviour or CI classification changes.
- Must: the contract test pins the queue-ready public additions to the two functions, and the inventory/subpath/import checks are green with no unrelated export diff.
- Must: no new subpath, package manifest change, or doc edit.
- Should: record the removed export names and the grep result in the execution log.

**Commit checkpoint**: `fix(GH-176): keep the CI classifier module-internal` (CP-R3.4).

---

### R3.5 — Reconcile stale artifact version references (F-13, info)

- [x] **R3.5** Reconcile the current-state version references in the delivery evidence (and verify the plan side) to spec v1.8 / test plan v1.8 / plan v1.7 and remove any stale "Pending doc-syncer re-run" statement from the evidence. (commit ca53a68; evidence baseline plan v1.7 / spec v1.8 / test plan v1.8; R3.1–R3.6 record added; doc-sync `58319b1` recorded (R2 doc-sync `b8809d6`); stale-version grep zero; pm-notes untouched)

**Files (exact)**:

- `doc/changes/2026-10/2026-10-31--GH-176--queue-ready/chg-GH-176-evidence.md` — baseline block (lines 8–9) now reads plan v1.7 (review remediation iterations 2–3), spec v1.8, test plan v1.8; add the R3.1–R3.6 remediation record with its commits; replace the deviation-6 wording that calls the old golden "structurally valid" with the F-10 correction (the canonical golden is evaluator-produced and DM-1/DM-2 valid after R3.2); remove any "Pending doc-syncer re-run" line and record the completed doc-sync commit `58319b1` (R2 doc-sync `b8809d6`; do not invent a new hash — confirm with `git log`).
- `doc/changes/2026-10/2026-10-31--GH-176--queue-ready/chg-GH-176-plan.md` — verification only: the v1.7 authoring pass already moved the front-matter summary, inputs, baseline, status, GAP-1 closeout, artifacts table, revision log, and execution log to spec v1.8 / test plan v1.8 / plan v1.7. Stage this file only if the R3 task rows change.
- **Not this task**: `chg-GH-176-pm-notes.yaml` is PM-owned; the PM updates it (the `review_fix` entry's "Pending doc-syncer re-run" and the v1.6 reference). Do not edit it.

**Implementation**:

- Update only current-state references; keep the historical revision logs untouched. The evidence must not claim a version it was not produced from, and must not describe an unrun check as passing.
- Add one short "Review iteration-2 remediation" paragraph naming F-9..F-13 → R3.1..R3.6, the state of F-7 (accepted) and F-8 (fixed), and the final battery outcome recorded by R3.6.
- Verify with `rg` that no `spec v1.6`, `test plan v1.7`, `plan v1.6`, or "Pending doc-syncer re-run" string remains in the evidence (historical revision-log rows in the spec/test plan/plan are exempt).

**Verification**:

```bash
rg -n 'spec v1\.6|test plan v1\.7|plan v1\.6|Pending doc-syncer re-run' doc/changes/2026-10/2026-10-31--GH-176--queue-ready/chg-GH-176-evidence.md || true   # expect zero hits
git log --oneline --all | rg '58319b1' | head -1
bun test tests/structure/queue-ready-contract.test.ts
```

**Acceptance**:

- Must: the evidence baseline cites plan v1.7, spec v1.8, and test plan v1.8; no stale version string or "Pending doc-syncer re-run" statement remains in the evidence; the doc-sync completion is recorded against the real commit.
- Must: the evidence records F-9..F-13 → R3.1..R3.6, F-7 accepted, F-8 fixed, and only executed results (no unrun claim).
- Must: `chg-GH-176-pm-notes.yaml` is untouched by `@coder`; no code or test behaviour changes in this task.
- Should: keep the evidence diff limited to the version/remediation lines so the historical record stays readable.

**Commit checkpoint**: `docs(GH-176): record plan v1.7 and spec v1.8 references` (CP-R3.5).

---

### R3.6 — Final remediation battery (checkpoint)

- [x] **R3.6** Run the full remediation battery, record only executed evidence, and leave a clean tree; no push. (focused core 66 pass; focused queue-ready 177 pass / 1 skip; `bun test` 2065 pass / 3 skip / 0 fail; `pnpm check` 2065 pass / 3 skip / 0 fail; five invariant checks + doc-distribution OK; `git diff --check` clean; tree clean at ca53a68)

**Commands (in order)**:

```bash
bun test tests/behaviour/queue-ready-output.test.ts tests/behaviour/queue-ready-corpus.test.ts tests/golden/queue-ready.test.ts tests/structure/queue-ready-contract.test.ts
bun test tests/behaviour/queue-ready-*.test.ts tests/structure/queue-ready-*.test.ts
bun test
pnpm check
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
bash scripts/.tests/test-doc-distribution.sh
git diff --check
git status --porcelain
```

**Acceptance**:

- Must: every command exits 0 (the opt-in TC-QREADY-031 live suite may remain skipped without the harness switch); the focused suites and `pnpm check` are green; the five invariant checks and doc-distribution report no drift; `git diff --check` and `git status --porcelain` are clean; no push, no amend.
- Must: no test weakening, skipped remediation test, relaxed bound, or removed assertion; no `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` residue; the astral-8 and over-budget cases are green; F-1..F-8 stay closed.
- Must: HEAD and the measured maxima (astral render bytes, candidate-line/header-plus-summary maxima, CJK reduced bytes, dropped-line counts) are recorded under `.ai/local/` (never staged) and summarised in the execution log and evidence.
- Should: confirm `git log -1 --format=%s` per task commit matches CP-R3.1..CP-R3.5.
- **Commit checkpoint**: no commit when the tree is clean. If residual golden/test/doc updates remain, fix them, re-run, and make exactly one `chore(GH-176): close remediation iteration 3 battery` commit staging only those residual files; never amend an earlier task commit (CP-R3.6).

---

## Test Scenarios

All 38 TCs map to concrete tasks; no TC is reshaped, no TC is orphaned, and no AC/NFR is left without a TC. The test plan's §5.2 scenario steps, §6.2 corpus table, and §7 automation table remain authoritative; the per-phase Tests blocks name the focused commands.

| TC ID | Scenario (abbreviated) | AC / NFR | Phase(s) · task(s) | Target layer / file |
|---|---|---|---|---|
| TC-QREADY-001 | Command grammar: 1..8 refs, 64-char cap, rejection before reads, parser fallback, `--json` only | AC-F1-1, NFR-6 | **2** (2.1, 2.4) | `tests/behaviour/queue-ready-command.test.ts`, `tests/fixtures/queue-ready/refs/cases.ts` |
| TC-QREADY-002 | Source failures remain one success envelope and exit 0 | AC-F1-3, NFR-3, NFR-6 | **2** (2.4) | same + `corpus/source-failures-degraded/case.json` |
| TC-QREADY-003 | Six-condition totality, tri-state, ready equivalence, blocking disclosure | AC-F2-1, AC-F3-1, NFR-1 | **1** (1.2, 1.6) | `tests/behaviour/queue-ready-conditions.test.ts`, `tests/fixtures/queue-ready/matrix/cases.ts` |
| TC-QREADY-004 | Condition derivation matrix cell-by-cell (provider-shaped observed ids) | AC-F2-2, AC-F14-1, NFR-1, NFR-3 | **1** (1.2, 1.6) | same |
| TC-QREADY-005 | `deps-satisfied`: unavailable/unobserved/done/open targets, one state-count evidence record (provider-shaped target ids) | AC-F4-1, AC-F4-2, NFR-3 | **3** (3.1) | `tests/behaviour/queue-ready-deps.test.ts`, `tests/fixtures/queue-ready/deps/cases.ts` |
| TC-QREADY-006 | `repo-free`: local PM context, never "free" from absence | AC-F5-1, NFR-3, NFR-10 | **3** (3.3) | `tests/behaviour/queue-ready-repo-tier-owner.test.ts`, `tests/fixtures/queue-ready/{repo,pm-context}` |
| TC-QREADY-007 | `tier-known`: exactly one priority label, absent/conflict | AC-F6-1, NFR-3 | **3** (3.3) | same + `tier/cases.ts` |
| TC-QREADY-008 | `no-owner-gate`: declared owner labels only, assignee ignored | AC-F7-1, NFR-3 | **3** (3.3) | same + `owner/cases.ts` |
| TC-QREADY-009 | `ci-healthy`: result classification, only `succeeded`, 20-run page verdict-neutral | AC-F8-1, NFR-3 | **3** (3.4) | `tests/behaviour/queue-ready-ci.test.ts`, `tests/fixtures/queue-ready/ci/cases.ts` |
| TC-QREADY-010 | `ci-healthy`: each `unknown` reason — unresolved, unattempted, credential, read-failed | AC-F8-1, NFR-3 | **3** (3.4) | same |
| TC-QREADY-011 | `provider-available`: satisfied path, exact two-record evidence, no engine call, scoped `available` scan | AC-F9-1, NFR-3, NFR-5 | **4** (4.1) | `tests/behaviour/queue-ready-provider.test.ts`, `tests/fixtures/queue-ready/provider/cases.ts` |
| TC-QREADY-012 | `provider-available`: no entry/all parked/chain park/config-by-reason or fold failure, exact case record | AC-F9-1, NFR-3 | **4** (4.1) | same + `providers/*.json` |
| TC-QREADY-013 | Close association by branch convention: command-level open-only, at-limit unknown, evaluator-injected `pr-not-open` | AC-F10-1, NFR-3 | **4** (4.2) | `tests/behaviour/queue-ready-close.test.ts`, `tests/fixtures/queue-ready/close/cases.ts` |
| TC-QREADY-014 | Close classification: merge-ready/review-pending/new-start/unknown/not-ready | AC-F10-1, NFR-3 | **4** (4.2) | same |
| TC-QREADY-015 | Association unknown sources never become new-start | AC-F10-1, AC-F14-1, NFR-3 | **4** (4.2) | same |
| TC-QREADY-016 | Deterministic PR selection, merged/closed exclusion, `associatedCount` | AC-F10-1, NFR-3 | **4** (4.2) | same |
| TC-QREADY-017 | Ranking and numeric-aware tie-breakers | AC-F11-1, NFR-4 | **4** (4.3) | `tests/behaviour/queue-ready-ranking.test.ts`, `tests/fixtures/queue-ready/ranking/cases.ts` |
| TC-QREADY-018 | Machine payload: one envelope, schema, closed vocabularies, `entityId`-only identities (no `systemName`) | AC-F12-1, NFR-2, NFR-5, NFR-10 | **5** (5.1) | `tests/behaviour/queue-ready-output.test.ts` |
| TC-QREADY-019 | Payload bounds, provider-derived caps, and truncation | AC-F12-1, AC-F12-2, NFR-2 | **5** (5.1, 5.3) | same + `bounds/**`, `caps/**` |
| TC-QREADY-020 | Human digest grammar and bounds (32-char provider segments) | AC-F12-2, AC-F13-1, NFR-2, NFR-6 | **5** (5.2) | same + `golden/human.txt`, `tests/golden/helpers.ts` |
| TC-QREADY-021 | Exhaustive 22-control negative matrix asserted per targeted condition/source (close-only controls may be ready with `unknown` close; no global not-ready claim), with scoped all-clear/`available` scans | AC-F14-1, NFR-3 | **5** (5.4) | `tests/behaviour/queue-ready-negative-controls.test.ts`, `negative-controls/cases.ts` |
| TC-QREADY-022 | Read-only execution: zero writes/fences/mutations/network writes/spawns/engine | AC-F1-2, NFR-4, NFR-10 | **5** (5.5) | `tests/behaviour/queue-ready-readonly-determinism.test.ts` |
| TC-QREADY-023 | Determinism and byte-identical replay | AC-F1-2, NFR-4 | **5** (5.5) | same + `tests/golden/helpers.ts` |
| TC-QREADY-024 | Declared constants and closed vocabularies (incl. 64-char ref bound, nine provider caps, human segment, numeric pattern, marker reasons; no live-switch/title constant) | AC-F2-1, AC-F12-1, NFR-1, NFR-2 | **1** (1.1, 1.4, 1.5) | `tests/structure/queue-ready-contract.test.ts`, `inventory.json`, `content-inventory.test.ts` |
| TC-QREADY-025 | Tier, purity, composition, no new package/subpath/runtime-API | AC-F15-1, NFR-7 | **1** (1.7) → **2** (2.5) → **5** (5.6) | `tests/structure/queue-ready-imports.test.ts`, `subpaths.test.ts`, `content-inventory.test.ts`, `cli-edge-seam.test.ts` |
| TC-QREADY-026 | Brand neutrality, no product literals, secret-read allowlist, live literal test-only | AC-F15-1, NFR-7, NFR-10 | **1** (1.7 partial) → **5** (5.6) | `tests/checks/secret-read-boundary.test.ts`, `forbidden-literals.test.ts`, `queue-ready-imports.test.ts` |
| TC-QREADY-027 | Error-table stability and evidence/identity discipline | AC-F16-1, NFR-8 | **5** (5.6) | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts` |
| TC-QREADY-028 | Fixture corpus completeness and Appendix G worked examples (incl. identity and provider-cap rows) | AC-F2-3, AC-F4-2, AC-F12-2, AC-F17-1, NFR-6, NFR-11 | **6** (6.1) | `tests/behaviour/queue-ready-corpus.test.ts`, `corpus/**` |
| TC-QREADY-029 | Golden payload and human bytes over the corpus (capped values, `value-clamped`, 32-char segments) | AC-F12-2, AC-F17-1, NFR-2, NFR-11 | **6** (6.2) | `tests/golden/queue-ready.test.ts`, `golden/payload.json` |
| TC-QREADY-030 | Performance and read-cost bounds | NFR-5, NFR-9, AC-F17-1, NFR-11 | **6** (6.3) | `tests/behaviour/queue-ready-performance.test.ts` |
| TC-QREADY-031 | Opt-in live structural smoke (exactly-`1` switch; observes a known candidate) | AC-F2-3, AC-F9-1, AC-F17-1, NFR-11 | **6** (6.4) | `tests/behaviour/queue-ready-live.test.ts` (skipped unless exactly `1` and credentialed) |
| TC-QREADY-032 | Ref canonicalization, 64-char cap/validation order, leading zeros, duplicate-after-canonicalization, no discovery | AC-F1-1, NFR-6 | **2** (2.4) | `tests/behaviour/queue-ready-command.test.ts`, `refs/cases.ts` |
| TC-QREADY-033 | Edge exit projection and stream discipline | AC-F1-1, AC-F1-3, NFR-6 | **2** (2.4) | same + `tests/golden/helpers.ts` |
| TC-QREADY-034 | Top-level `reasons`: six-group order, group-2 markers, exact group 6, first-occurrence dedup, cap-6 overflow | AC-F12-1, NFR-2 | **5** (5.1) | `tests/behaviour/queue-ready-output.test.ts`, `reasons/cases.ts` |
| TC-QREADY-035 | Truncation flag scope (synthetic evidence-cap, provider clamp/byte-budget) and CI at-limit payload marker | AC-F8-1, AC-F12-1, AC-F12-2, NFR-2 | **5** (5.1) | same + `bounds/{under-cap,at-limit,over-cap}/**`, `caps/**`, `reasons/cases.ts` |
| TC-QREADY-036 | Candidate identity resolution: exact, bare-number bridge, wrong number, ambiguous suffix, leading zeros | AC-F2-3, AC-F17-1, NFR-1, NFR-3 | **3** (3.2) → **6** (6.1, 6.4) | `tests/behaviour/queue-ready-identity.test.ts`, `tests/fixtures/queue-ready/identity/cases.ts` |
| TC-QREADY-037 | `blocked-by` target resolution against the observed work-item set: exact, canonical-observed-unrequested, bare-number bridge, unobserved, ambiguous, leading zeros | AC-F4-2, AC-F17-1, NFR-3 | **3** (3.2) → **6** (6.1) | same + `deps/cases.ts`, `identity/cases.ts`, corpus `relation-target-*` |
| TC-QREADY-038 | Provider-derived caps: nine caps, `entityId`-only projected identities (no `systemName`, over-long-`systemName` fixture), output-only clamps, `value-clamped`, byte-budget reduction, `blocked-by`-only projection | AC-F12-2, AC-F13-1, AC-F17-1, NFR-2 | **5** (5.3) → **6** (6.1, 6.2) | `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/caps/over-long/**`, `identity/cases.ts` |

**AC coverage** (test plan §3.1 is authoritative; every AC lands green by Phase 6): AC-F1-1 → TC-001/032/033 (Ph 2) · AC-F1-2 → TC-022/023 (Ph 5) · AC-F1-3 → TC-002/033 (Ph 2) · AC-F2-1 → TC-003/024 (Ph 1) · AC-F2-2 → TC-004 (Ph 1) · AC-F2-3 → TC-036/031 (Ph 3/6) · AC-F3-1 → TC-003/014/028 (Ph 1/4/6) · AC-F4-1 → TC-005 (Ph 3) · AC-F4-2 → TC-037/005 (Ph 3) · AC-F5-1 → TC-006 (Ph 3) · AC-F6-1 → TC-007 (Ph 3) · AC-F7-1 → TC-008 (Ph 3) · AC-F8-1 → TC-009/010/035 (Ph 3/5) · AC-F9-1 → TC-011/012/021/031 (Ph 4/5/6) · AC-F10-1 → TC-013/014/015/016 (Ph 4) · AC-F11-1 → TC-017 (Ph 4) · AC-F12-1 → TC-018/019/024/034 (Ph 1/5) · AC-F12-2 → TC-038/019/020/024/029/035 (Ph 1/5/6) · AC-F13-1 → TC-020/038 (Ph 5) · AC-F14-1 (22 controls) → TC-004/021 (Ph 1/5) · AC-F15-1 → TC-022/025/026 (Ph 5) · AC-F16-1 → TC-027 (Ph 5) · AC-F17-1 → TC-028/029/030/031/036/037/038 (Ph 3/5/6). Twenty-three of twenty-three ACs covered; zero deferred.

**NFR coverage**: NFR-1 → TC-003/004/024/036/037 (Ph 1/3) · NFR-2 → TC-018/019/020/034/035/038 (Ph 5) · NFR-3 → TC-004..015/021/036/037 (Ph 1/3/4/5) · NFR-4 → TC-017/022/023 (Ph 4/5) · NFR-5 → TC-011/030 (Ph 4/6) · NFR-6 → TC-001/002/020/028/032/033 (Ph 2/5/6) · NFR-7 → TC-025/026 (Ph 5) · NFR-8 → TC-027 (Ph 5) · NFR-9 → TC-030 (Ph 6) · NFR-10 → TC-006/018/020/022/026 (Ph 3/5) · NFR-11 → TC-028/029/030/031/036/037/038 (Ph 3/5/6). Eleven of eleven NFRs covered; zero deferred.

**Execution order** maps the test plan's §7 order onto the phases: step 1 (structure/constants/error-table baselines) → Phase 1 (contract) with completion in Phase 5; step 2 (command surface/candidate set/edge) → Phase 2; step 3 (condition totality/matrix) → Phase 1; step 4 (condition predicates and identity resolution: TC-005, TC-036, TC-037, TC-006..010) → Phase 3; step 5 (provider) → Phase 4; step 6 (close classification/selection) → Phase 4; step 7 (ranking) → Phase 4; step 8 (output/bounds/caps/reasons/truncation/negative controls/read-only/determinism: TC-018..023, TC-034, TC-035, TC-038) → Phase 5; step 9 (corpus/golden/performance) → Phase 6; step 10 (opt-in live and aggregate) → Phase 6.

## Definition of Done

- 37 TCs (TC-QREADY-001..030 and TC-QREADY-032..038) are implemented at their pinned locations and green by default; TC-QREADY-031 is green when `ADOS_QUEUE_READY_LIVE` is exactly `1` and a credential is present, otherwise skipped (never counted as green in a default run). 38 TCs total.
- All 23 ACs (AC-F1-1..AC-F17-1, including AC-F2-3, AC-F4-2, and AC-F12-2) and all 11 NFRs are demonstrated by the named TCs; no AC/NFR is deferred, orphaned, or weakened.
- Exactly six conditions per candidate in fixed order, tri-state, bounded evidence (one record per non-provider condition, two for `provider-available`), `ready` iff all six satisfied, and every non-satisfied condition named; the `deps-satisfied` state-count detail `done:<n>; open:<n>; unknown:<n>` sums to the total `blocked-by` relation target count (observed + unobserved).
- The 22-control AC-F14-1 matrix is asserted per control on its targeted condition/source and matches the test plan's 22-row matrix: a targeted absent/failed/unattempted/unavailable/unresolved readiness source never yields `satisfied`, a non-satisfied readiness condition never yields a `ready` claim, the PR-read-failure control (20) and the at-limit-no-match control (22) are `ready: true` with `closeClass: unknown` (never `new-start`), the binding-unavailable control (21) is not ready and never `new-start`, no control yields `merge-ready` without observed approval or an all-clear, and no global not-ready requirement applies to the matrix.
- Provider `config-invalid`/`provider-chain-unresolved`/`state-unreadable` failure evidence carries the read's bounded failure identity only in the pinned `failureCode:<code>`, `failureClass:<class>`, or both `; `-joined detail form (the command-level unresolved case carries `failureCode:config.value.invalid`, the defensive `ok:true` view and `provider-chain-not-declared` carry none, and `state-unreadable` carries the park code/class where supplied); no provider failure record carries a free-form detail.
- Close items rank above ready new starts; `merge-ready` is unreachable without an observed approval on a non-draft open PR; the selected associated PR is deterministic within one close class (the merge-ready set when non-empty, otherwise the associated set) by `entityId` ascending numeric-aware (equal all-digit numeric values tie at that key), then `sourceRef`, then `targetRef`, then the lexically smaller raw `entityId` only when all three keys are equal, never API order; unknown association is never `new-start`; command-level association is open-only, while merged/closed exclusion and `pr-not-open` are evaluator-injected-only; a 20-run check-runs page is verdict-neutral.
- Canonical refs are ≤64 characters (65+ rejected before duplicate detection/read), validation order is canonicalize → length → duplicate → read, canonical duplicates are rejected rather than silently merged, and `GH-007` ranks before `GH-7`.
- Candidate observation is candidate-set-scoped and `blocked-by` target resolution is observed-set-scoped, both by the §8.3 rule over full normalized values: exact case-insensitive full-value canonical match, then a unique all-digit suffix bridge over the role-specific domain; wrong numbers, ambiguous shared suffixes (unobserved for every sharing candidate, no precedence or caller order), and leading-zero mismatches stay unobserved; a canonical-shaped target observed as an exact match resolves even when that ref is not a requested candidate, while a canonical-shaped target that is not observed never bridges on its numeric suffix; and no substring/prefix/numeric coercion exists. The live smoke observes at least one known candidate.
- The nine provider-derived output caps are enforced end-to-end with a single `value-clamped` in reason group 2 and payload `truncated`; every projected provider-qualified identity is `entityId`-only with `systemName` omitted, so the whole identity object is bounded and an over-long `systemName` never enters the payload; clamps are verdict-neutral (identical conditions, `blockingConditions`, `closeClass`, ranks, `associatedCount`, and summary against a no-caps oracle), only `blocked-by` relations are projected, and the deterministic trailing-relation-then-label reduction keeps `data` ≤65 536 bytes.
- Top-level `reasons` follow the six groups with group 2 exactly `source-truncated` then `value-clamped` and group 6 exactly `pr-association-unknown` and last; `read-failed`/`credential-unavailable` appear only in group 5.
- Serialized `data` ≤65 536 bytes; human ≤16 lines/4096 bytes with the fixed `[repo:local-context; tier:priority-label]` suffix; the exact truncation-flag scope is asserted per drop cause; there is no title field or title cap.
- Zero writes, fences, state mutations, network writes, provider-engine calls, quota fetches, child processes, or ambient environment reads; byte-identical replay over identical injected inputs.
- No new error-table row/kind, configuration key, state-schema change, package, subpath, runtime-API location, or secret-read allowlist entry; the documented error table is byte-identical.
- `collectStatusFacts` preserves the delivered `status` read semantics with two independent gates — issues/pulls whenever the binding is observed, check-runs only when the binding is observed and the HEAD SHA is resolved, with the pinned `not-configured`/`commit-unresolved` reads otherwise — so `status` output stays byte-identical, no adapter read is added, and the `not-ready-ci-unresolved` row (`S S S S ? S`) remains reachable.
- `tests/structure/inventory.json`, `EXECUTABLE_ALLOWANCES`, and `tests/fixtures/ports/v1-contract-inventory.json` are current; `pnpm check`, the five invariant checks, `bash scripts/.tests/test-doc-distribution.sh`, and `git diff --check` are green on the delivery HEAD.
- One minor changeset and `chg-GH-176-evidence.md` are committed; Phase 7 docs are reconciled and the new feature doc is registered.
- The working tree is clean after every suite; no push during delivery; PR creation remains the lifecycle step after Phase 7.

## File Inventory

**New — production**

- `packages/core/src/contracts/queue-ready.ts`
- `packages/core/src/domain/queue-ready.ts`
- `packages/core/src/domain/ci-result.ts`
- `packages/cli/src/commands/queue.ts`

**Modified — production**

- `packages/core/src/contracts/index.ts`
- `packages/core/src/domain/index.ts`
- `packages/core/src/domain/status.ts` (shared classifier import only)
- `packages/core/src/index.ts`
- `packages/cli/src/commands/status.ts` (`collectStatusFacts` extraction)
- `packages/cli/src/commands/index.ts`
- `packages/cli/src/edge.ts`

**New — tests, fixtures, change artifacts**

- `tests/structure/queue-ready-contract.test.ts`
- `tests/structure/queue-ready-imports.test.ts`
- `tests/behaviour/queue-ready-command.test.ts`
- `tests/behaviour/queue-ready-conditions.test.ts`
- `tests/behaviour/queue-ready-deps.test.ts`
- `tests/behaviour/queue-ready-identity.test.ts`
- `tests/behaviour/queue-ready-repo-tier-owner.test.ts`
- `tests/behaviour/queue-ready-ci.test.ts`
- `tests/behaviour/queue-ready-provider.test.ts`
- `tests/behaviour/queue-ready-close.test.ts`
- `tests/behaviour/queue-ready-ranking.test.ts`
- `tests/behaviour/queue-ready-output.test.ts`
- `tests/behaviour/queue-ready-negative-controls.test.ts`
- `tests/behaviour/queue-ready-readonly-determinism.test.ts`
- `tests/behaviour/queue-ready-corpus.test.ts`
- `tests/golden/queue-ready.test.ts`
- `tests/behaviour/queue-ready-performance.test.ts`
- `tests/behaviour/queue-ready-live.test.ts` (opt-in)
- `tests/fixtures/queue-ready/harness.ts`
- `tests/fixtures/queue-ready/refs/cases.ts`
- `tests/fixtures/queue-ready/matrix/cases.ts`
- `tests/fixtures/queue-ready/deps/cases.ts`
- `tests/fixtures/queue-ready/identity/cases.ts` (includes the canonical-observed-target-not-requested row: `GH-179` observed as `GH-179` while not a requested candidate)
- `tests/fixtures/queue-ready/repo/cases.ts`
- `tests/fixtures/queue-ready/tier/cases.ts`
- `tests/fixtures/queue-ready/owner/cases.ts`
- `tests/fixtures/queue-ready/ci/cases.ts`
- `tests/fixtures/queue-ready/provider/cases.ts`
- `tests/fixtures/queue-ready/close/cases.ts`
- `tests/fixtures/queue-ready/ranking/cases.ts`
- `tests/fixtures/queue-ready/reasons/cases.ts`
- `tests/fixtures/queue-ready/negative-controls/cases.ts`
- `tests/fixtures/queue-ready/pm-context/*.yaml`
- `tests/fixtures/queue-ready/providers/*.json`
- `tests/fixtures/queue-ready/bounds/{under-cap,at-cap,cap-sized,over-cap,at-limit,flag-matrix}/**`
- `tests/fixtures/queue-ready/caps/{over-long,byte-budget}/**` (over-long includes the 200-character `systemName` fixture on relation targets and pull-request identities)
- `tests/fixtures/queue-ready/caps/{human-astral-8,human-over-budget}/**` (new in R3.1: the 8-candidate astral worst case and the synthetic over-budget line-drop case)
- `tests/fixtures/queue-ready/golden/canonical.ts` (evaluator-produced in R3.2; the `unknown` close class uses a separate evaluator-produced fact set)
- `tests/fixtures/queue-ready/corpus/{case}/case.json` (includes `relation-target-canonical-unrequested` and the over-long-`systemName` cap row)
- `tests/fixtures/queue-ready/golden/{payload.json,human.txt}`
- `tests/fixtures/queue-ready/literals/secret-canary.txt`
- `.changeset/queue-ready-minor.md`
- `chg-GH-176-evidence.md`

**Modified — tests/checks/inventories**

- `tests/structure/inventory.json`
- `tests/structure/content-inventory.test.ts`
- `tests/structure/cli-edge-seam.test.ts`
- `tests/fixtures/ports/v1-contract-inventory.json`
- `tests/checks/secret-read-boundary.test.ts`
- `tests/checks/forbidden-literals.test.ts`
- `tests/checks/error-table-sync.test.ts`
- `tests/structure/error-table.test.ts`
- `tests/structure/subpaths.test.ts` (only if an expected-surface list must name the new modules; no subpath change)

**New — Phase 7 docs (handoff)**

- `doc/spec/features/feature-queue-ready.md`

**Modified — Phase 7 docs (handoff)**

- `doc/spec/features/feature-status-digest.md`
- `doc/spec/features/feature-provider-engine.md`
- `doc/spec/features/feature-state-layer.md`
- `doc/spec/features/feature-config-layer.md`
- `doc/spec/features/feature-result-contract.md`
- `doc/spec/features/feature-monorepo-scaffold-toolchain.md`
- `doc/planning/oss-tooling/cli-command-registry.md`
- `doc/overview/glossary.md`
- `doc/00-index.md`
- `scripts/checks/forbidden-literals.registry.json`

## Artifacts and Links

| Artifact | Location | Type / role |
|---|---|---|
| Change specification (v1.8) | [chg-GH-176-spec.md](./chg-GH-176-spec.md) | Source of requirements: F-1..F-17, AC-F1-1..AC-F17-1 (23), NFR-1..NFR-11, DM-1..DM-13, DEC-1..DEC-20, §8.3 identity resolution (role-specific uniqueness domains; exact canonical match is a case-insensitive full-value match and only a bare all-ASCII-digit target bridges), the R-42 provider failure-identity detail form, the R-45 same-class associated-PR tie-break, the v1.8 human-bound rule (`QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` 32 UTF-8 bytes, 400-byte candidate lines, 620-byte header plus summary, the reverse-rank line-drop fallback, DEC-20), Appendix A–I |
| Test plan (v1.8, 38 TCs) | [chg-GH-176-test-plan.md](./chg-GH-176-test-plan.md) | Source of TC IDs, §5.2 steps (including the 22-row negative-control matrix and TC-QREADY-016's same-class tie-break), §6.2 corpus (incl. `relation-target-canonical-unrequested`, `not-ready-ci-unresolved`, the over-long `systemName` fixture, `caps/human-astral-8`, `caps/human-over-budget`, and the exact reduction-order oracle), §7 execution order |
| Readiness review (DoR iteration 3) | [readiness-iter-3.md](./readiness-review/readiness-iter-3.md) | NOT_READY findings R-30..R-36 aligned by the prior revision under the PM-authorized scoped re-gate |
| Readiness review (DoR iteration 4) | [readiness-iter-4.md](./readiness-review/readiness-iter-4.md) | NOT_READY: plan finding R-39 and spec/test-plan alignments R-40/R-41/R-42; the test-plan R-37/R-38 corrected 22-row matrix is mirrored here; PM-authorized final scoped correction pass and final re-gate |
| Readiness review (DoR iteration 5) | [readiness-iter-5.md](./readiness-review/readiness-iter-5.md) | NOT_READY: plan findings R-43/R-45/R-47 closed by this revision (R-43 the independent status read gates, R-45 the same-class PR tie-break, R-47 the stale enumeration/version references); R-37..R-42 independently verified closed; human-authorized scoped correction pass |
| Review iteration 1 | [code-review/review-iter-1.yaml](./code-review/review-iter-1.yaml) | FAIL (0 blocker / 2 major / 3 minor / 3 info). F-1..F-6 remediated by R2.1..R2.7 in the "Remediation Iteration 2 (review FAIL)" section; F-7 no action; F-8 spec-only/PM-owned and fixed in spec v1.7 |
| Review iteration 2 | [code-review/review-iter-2.yaml](./code-review/review-iter-2.yaml) | FAIL (0 blocker / 1 major / 3 minor / 1 info). F-9..F-13 remediated by R3.1..R3.6 in the "Remediation Iteration 3 (review iter-2 FAIL)" section; F-1/F-3/F-4/F-5/F-6 and the machine half of F-2 verified closed; F-7 still accepted; F-8 already fixed |
| This plan (v1.7) | `./chg-GH-176-plan.md` | The only file written by this authoring pass; includes the appended review-iteration-1 and review-iteration-2 remediation sections |
| PM notes | `./chg-GH-176-pm-notes.yaml` | Delivery tracker state; not a queue fixture |
| Decision records | [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md), [ADR-0004](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md), [ADR-0006](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md), [ADR-0007](../../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md), [ODR-0003](../../../decisions/ODR-0003-cli-command-naming-v1-lock.md) | Tier/runtime confinement; absence semantics; park semantics; name lock |
| Contract vocabulary | `packages/core/src/contracts/queue-ready.ts` | New; all constants, vocabularies, and public types (Phase 1) |
| Pure evaluator/renderer | `packages/core/src/domain/queue-ready.ts` | New; `evaluateQueueReady`, `renderQueueReadyHuman` (Phase 1) |
| Shared CI classifier | `packages/core/src/domain/ci-result.ts` | New; `classifyPipelineRuns` (Phase 1) |
| Command / composition | `packages/cli/src/commands/queue.ts`, `commands/status.ts`, `commands/index.ts`, `edge.ts` | New/extended; grammar, handler, `collectStatusFacts`, edge wiring (Phase 2) |
| Queue-ready suites and fixtures | `tests/behaviour/queue-ready-*.test.ts`, `tests/structure/queue-ready-*.test.ts`, `tests/golden/queue-ready.test.ts`, `tests/fixtures/queue-ready/**` | All 38 TCs at their pinned locations (Phases 1–6) |
| Contract inventories | `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/fixtures/ports/v1-contract-inventory.json` | Exact module/export surfaces (Phases 1–5) |
| Release intent | `.changeset/queue-ready-minor.md` | New in Phase 6; lockstep fixed group |
| Delivery evidence | `./chg-GH-176-evidence.md` | New in Phase 6 |
| Current-truth feature doc | `doc/spec/features/feature-queue-ready.md` | New in Phase 7 (`@doc-syncer`) + forbidden-literals registration |
| Reconciled docs | `doc/spec/features/{feature-status-digest,feature-provider-engine,feature-state-layer,feature-config-layer,feature-result-contract,feature-monorepo-scaffold-toolchain}.md`, `doc/planning/oss-tooling/cli-command-registry.md`, `doc/overview/glossary.md`, `doc/00-index.md` | Updated in Phase 7 |
| Referenced specs & rules | [feature-status-digest.md](../../../spec/features/feature-status-digest.md), [feature-provider-engine.md](../../../spec/features/feature-provider-engine.md), [feature-state-layer.md](../../../spec/features/feature-state-layer.md), [feature-config-layer.md](../../../spec/features/feature-config-layer.md), [feature-result-contract.md](../../../spec/features/feature-result-contract.md), [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md), [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Consumed contracts and rules; referenced, not rewritten |

No new standalone delivery-infrastructure check or CI job is planned (D11). If execution genuinely needs one, escalate to PM — no such addition is pre-authorized here.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T23:55:00Z | Implementation Plan Writer | Initial seven-phase plan. Read the completed spec v1.1, test plan v1.1 (35 TCs), the M0-S7 backlog story and command-registry row, ODR-0003/ADR-0003/0004/0006/0007, the GH-175 plan exemplar, the delivery template, and the baseline code seams (CLI index/edge/status/verify, status contracts/domain, GitHub/repo/file adapters, provider parks, config, inventories, checks, changeset config). Pinned the contract export names/constants/vocabularies/shapes, the pure evaluator/renderer and shared CI classifier, the condition/close/rank/reason/truncation rules, the command and composition spellings, and exact error-identity reuse. 7 phases / 36 tasks (31 `@coder`, 5 `@doc-syncer` handoff); 35/35 TCs, 20/20 ACs, 11/11 NFRs traceable with zero orphan TCs. Closed test-plan GAP-1; recorded six delivery-bound resolutions (RES-1..RES-6) and two PM-visible notes later resolved by DoR iteration-1 (the Appendix C live-switch wording and the test plan's descriptive degraded-row wording); no plan blocker; no behavioural spec/test-plan correction proposed. |
| 1.1 | 2026-10-31T23:59:00Z | Implementation Plan Writer | DoR iteration-1 plan revision aligned to spec v1.2 and test plan v1.3. **Plan findings:** R-15 makes the DoD precise — 34 TCs green by default (TC-QREADY-001..030, 032..035) and TC-QREADY-031 green only when `ADOS_QUEUE_READY_LIVE` is exactly `1` with a credential, otherwise skipped; R-17 adds the `contracts/index.ts` re-export and the matching `tests/fixtures/ports/v1-contract-inventory.json` module-entry update to task 1.4 and the registration risk note (with `port-contract-inventory.test.ts` green). R-05's corrected ordering (`GH-007` before `GH-7` when numeric suffixes tie) is pinned. **Spec v1.2 alignment:** R-01 removes every production live-switch constant and binds the literal only in `tests/fixtures/queue-ready/harness.ts` (tests-only, exactly `1`); R-02 adds `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS = 64` and the canonicalize → length → duplicate → read order (65+ rejected before reads); R-04 makes command-level association open-only (`pr-not-associated`, never `pr-not-open`) with merged/closed exclusion and `pr-not-open` as pure-evaluator rules over injected views and the at-limit `unknown` override; R-06 replaces RES-2's multi-record deps evidence with exactly one record whose detail is `done:<n>; open:<n>; unknown:<n>`, making the evidence-cap overflow a synthetic evaluator case; R-07 pins unobserved-candidate precedence before signal availability for deps/tier/owner and rewrites RES-1 to the one-record `work-item-unobserved` shape; R-10 removes the rendered-help claim and help test step (documentation/registry only); R-16 separates handler failures from the existing parser `fallback.invocation` envelope; R-18 removes `workItem.title`, the title constant, and title clamping/assertions (title canaries remain raw-fact privacy checks only); R-19 adds the fixed human suffix `[repo:local-context; tier:priority-label]` and the `repo:local-context`/`tier:priority-label` evidence details. Re-checked all task file lists, RES-1..RES-6, the file inventory, verification commands, and the DoD; 7 phases / 36 tasks preserved; 35/35 TCs, 20/20 ACs, 11/11 NFRs remain mapped with zero orphans. |
| 1.2 | 2026-10-31T23:59:59Z | Implementation Plan Writer | DoR iteration-2 revision aligned to spec v1.3 (23 ACs) and test plan v1.4 (38 TCs). **Plan findings closed:** **R-23** provider config failures are now mapped by the read's own `reason` (`config-invalid` vs `provider-chain-unresolved`, mirroring `packages/core/src/domain/status.ts`) with the park fold staying `provider-parks`/`state-unreadable`, and a command-level `{ok:false, reason:"provider-chain-unresolved"}` fixture plus a defensive `ok:true` twin make the corpus row reachable (RES-8, provider row, task 4.1). **R-27** task 1.5 replaces the whole-change-doc digest with the status precedent: pinned Appendix C token presence plus an unchanged `mtime`, no digest. **R-28** Phase 7 describes the live smoke generically ("the test-harness-only live switch, enabled only at exactly `1`") so the new `doc/spec/**` page carries no `ADOS_`/`ados` literal, and task 7.4 fixes the forbidden-literal allowlist cardinality at five (only a `registered` entry is added); `value-clamped` joins the reason union and the contract tests. **R-29** the candidate observation carries only `blocked-by` relations (≤16, target identity ≤128), with every other kind filtered out entirely (never clamped), and the projected relation type is pinned. **R-21** every provider sub-rule/task/risk/metric now states the scoped claim rule: no provider evidence record or availability claim uses `available`; the condition id `provider-available`, condition-id list, `blocking:` lines, payload keys, summary tokens, and close classes are exempt; negative scans are scoped to provider evidence/details and the provider human segment. **R-22** the identity rule is pinned per spec §8.3 (exact case-insensitive canonical match first, then a unique all-ASCII-digit suffix bridge, ambiguity unobserved, no substring/prefix/numeric coercion, full values before clamping) as a work-item projection input (RES-6), with new task 3.2, `tests/behaviour/queue-ready-identity.test.ts`, `identity/cases.ts`, and TC-036/037 mapped. **R-24** adds the nine provider caps plus `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` (32), `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`, and `QUEUE_READY_PAYLOAD_MARKER_REASONS` to the constant table and contract module, the output-only clamp rule, the single `value-clamped` marker, the deterministic trailing-relation-then-label byte-budget reduction, the 64 KiB/4096-byte/16-line bounds, the over-long provider-field command-level case, the 32-character human provider segments with trailing `+` and regenerated goldens, and TC-038 (task 5.3). **R-26** deletes former RES-5: group 2 is exactly `source-truncated` then `value-clamped`, group 6 is exactly `pr-association-unknown` and last, and `read-failed`/`credential-unavailable` are group-5 only. **R-15 carried forward:** DoD is 37 default-green TCs plus opt-in TC-QREADY-031 (38 total). Counts reconciled everywhere to 38 TCs / 23 ACs / 11 NFRs; file inventory, phase tasks, gates, corpus/golden, and evidence updated; 7 phases / 39 tasks (34 `@coder`, 5 `@doc-syncer` handoff); zero orphan TCs, ACs, or NFRs. Wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| 1.3 | 2026-11-01T00:30:00Z | Implementation Plan Writer | DoR iteration-3 revision aligned to spec v1.4 and test plan v1.5 (38 TCs / 23 ACs / 11 NFRs unchanged) under the **PM-authorized scoped re-gate** that follows the iteration-3 NOT_READY verdict. Pins only; no behaviour, condition id/order, reason, rank, AC/NFR intent, mapping, or boundary change; 7 phases / 39 tasks preserved (34 `@coder`, 5 `@doc-syncer` handoff). **R-30** RES-8 and the provider sub-rules/table row/task 4.1 now map a `StatusProviderConfigRead` failure by the read's own `reason` — `{ok:false, reason:"config-invalid"}` → `config-invalid`, `{ok:false, reason:"provider-chain-unresolved"}` → `provider-chain-unresolved`, park fold `provider-parks`/`state-unreadable` — never a blanket `!config.ok`, citing spec v1.4 R-30; the command-level `unresolved-chain-command` fixture and the `not-ready-provider-unresolved` corpus row stay, joined by a `config-invalid` fixture. **R-31** RES-6, the candidate-observation sub-rule, the identity risk note, task 3.2 and the constraints state that condition evaluation is independent per candidate over shared facts while identity observation is candidate-set-scoped: a shared bare-numeric suffix leaves the item unobserved for **every** sharing candidate, with no precedence and no caller order. **R-32** the deps state-count detail now sums to the **total `blocked-by` relation target count (observed + unobserved)** in RES-2, the condition table, task 3.1 (with the `done:0; open:0; unknown:1` oracle), NFR-1 and the DoD. **R-33** the target uniqueness domain is pinned to the observed work-item set — exact canonical match wins, a bare numeric target bridges only when exactly one observed item carries that suffix, ambiguity/no match is `dependency-unobserved`, and a canonical-shaped target that is not observed stays `dependency-unobserved` even when it equals a requested candidate; the canonical-observed-target-not-requested row is added to tasks 3.1/3.2, D9, TC-037 provenance, the corpus row list, and the file inventory. **R-34** `systemName` is removed from `QueueReadyWorkItemRelation` and from every projected provider-qualified identity: the projection carries `{ target: { entityId } }` only (≤128), so "target identity ≤128" holds for the whole object; the payload shape, tasks 1.2/5.1/5.3/6.1/6.2, tests, TC-018/TC-038 rows, NFR-2, D7/D9, RSK-14 and the DoD all assert the omitted key and the never-projected over-long `systemName` fixture (no tenth cap). **R-35** the candidate-set/validation-order wording now states duplicates are detected after canonicalization and rejected, never silently merged (command handler, tasks 2.1/2.4, DoD), and no "de-duplicated" phrasing remains for the candidate refs. **R-36** the human-digest bound states the 41-byte proxy suffix instead of 43. Artifacts table, revision log, and execution log updated to spec v1.4 / test plan v1.5 / plan v1.3. Wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| 1.4 | 2026-11-01T01:00:00Z | Implementation Plan Writer | DoR iteration-4 final scoped correction pass aligned to spec v1.5 and test plan v1.6 (38 TCs / 23 ACs / 11 NFRs unchanged) under the PM-authorized final re-gate. Pins/wording only; no behaviour, condition id/order, reason, state, close class, rank, bound, AC/NFR intent, or mapping change; 7 phases / 39 tasks preserved (34 `@coder`, 5 `@doc-syncer` handoff). **R-39** PM-NOTE-1 now scopes `? S ? ? ? S` to the three binding/credential rows and states `all-unknown-degraded` is `? S ? ? ? ?` because `provider-available` is also unknown. **R-40** the identity risk note and the DoD now state that only a bare all-ASCII-digit target `entityId` bridges against the observed work-item set, a canonical-shaped target that is not observed stays `dependency-unobserved` and never bridges on its numeric suffix, and exact canonical target matching is a case-insensitive full-value match. **R-42** RES-5/RES-8, the condition-table provider row, the provider sub-rule, the evidence shape note, task 4.1 fixtures, task 6.1, the Phase 4 acceptance criteria, and the DoD now pin `{source, reason, detail?}` with `failureCode:<code>`, `failureClass:<class>`, or both `; `-joined when supplied, no `detail` when neither is supplied, and never a free-form detail; the command-level unresolved case carries `failureCode:config.value.invalid`, the defensive `ok:true` view and `provider-chain-not-declared` carry none, and `state-unreadable` carries the park code/class where supplied. **R-37** task 5.4 and the DoD mirror the test plan's 22-row matrix: each control is asserted on its targeted condition/source, a targeted absent/failed/unattempted/unavailable/unresolved source is never `satisfied` and a non-satisfied condition never yields `ready`, close-only controls 20/22 are `ready: true` with `closeClass: unknown` and never `new-start`, control 21 is not ready, and there is no global not-ready requirement. Artifacts table, revision log, and execution log updated to spec v1.5 / test plan v1.6 / plan v1.4. Wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| 1.5 | 2026-11-01T01:40:00Z | Implementation Plan Writer | DoR iteration-5 scoped correction aligned to spec v1.6 and test plan v1.7 (38 TCs / 23 ACs / 11 NFRs unchanged) under the human-authorized pass that follows the iteration-5 NOT_READY verdict (R-43 is a new major outside the PM's R-37..R-42 authorization). Plan correction only; no behaviour, condition id/order, state, reason, close class, rank, bound, AC/NFR intent, or mapping change beyond the R-43 code-behaviour correction (which restores the delivered `status` behaviour the plan had mis-pinned). 7 phases / 39 tasks preserved (34 `@coder`, 5 `@doc-syncer` handoff). **R-43 (major):** both `collectStatusFacts` pins (Pinned Delivery Spellings and task 2.2) now state **two independent gates** — (a) issues and pulls read whenever `repository.binding.state === "observed"`, else the pinned `{ok:false, reason:"not-configured"}` read for both; (b) check-runs read only when the binding is observed **and** `repository.head.sha !== undefined`, else `{ok:false, reason:"commit-unresolved"}` when observed and `not-configured` when not — matching `packages/cli/src/commands/status.ts:63-78`; the `not-ready-ci-unresolved` row (`S S S S ? S`) is stated reachable, `status` output stays byte-identical, no adapter read is added, task 2.4 asserts the gate behaviour through `runQueueReadyCli` (issues/pulls called once, check-runs zero times on a SHA-less HEAD), task 2.5 adds `tests/behaviour/status-changes-ci.test.ts` to the Phase 2 gate, task 6.1 lists the `not-ready-ci-unresolved` corpus row explicitly, and the Phase 2 acceptance criteria, RSK-P3, the read-reuse note, and the DoD carry the same pin. **R-45 (minor):** the close selection rule and task 4.2 now pin selection within one close class (the merge-ready set when non-empty, otherwise the associated set), then `entityId` ascending numeric-aware (both all-digit compare unsigned integer; equal numeric values tie at that key), then `sourceRef` ascending, then `targetRef` ascending, then the lexically smaller raw `entityId` only when all three keys are equal, with API order never deciding, aligned with spec F-10/DM-6 and TC-QREADY-016; the DoD close bullet carries the same tie-break. **R-47 (nit):** the plan's iteration-4 enumeration now includes R-38/R-41, the input list adds `readiness-iter-5.md`, the status/baseline/GAP-1/artifacts references move to spec v1.6, test plan v1.7, and plan v1.5, and a DoR-iteration-5 artifacts row is added (historical rows preserved). Verified the provider `no-enabled-entry`/`all-entries-parked` evidence detail already carries `chain:<name>` (condition table, evidence-shape note); no change needed. Wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| 1.6 | 2026-11-01T02:20:00Z | Implementation Plan Writer | Review iteration-1 remediation appended from [review-iter-1.yaml](./code-review/review-iter-1.yaml) (verdict FAIL: 0 blocker / 2 major / 3 minor / 3 info). No completed Phase 1–7 task text, check state, acceptance, or behaviour is rewritten; the new "Remediation Iteration 2 (review FAIL)" section adds R2.1..R2.7 with exact files, verification commands, acceptance, and commit checkpoints, plus the F-7/F-8 no-action dispositions. **F-1 (major)** R2.1 rebuilds group 5 from the rank-ordered candidate walk → `QUEUE_READY_CONDITION_ORDER` → each condition's evidence order, corrects the `reasons-cap-7` expectation to `local-context-missing` before `signal-unavailable`, and adds a walk-order-not-array-order assertion. **F-2 (major)** R2.2 adds a pure runtime-neutral `utf8ByteLength` helper, uses it for the 65 536-byte machine initial/recheck budget and the 4096-byte human bound, and adds a CJK cap-sized fixture that exceeds 64 KiB in UTF-8 while under it in `.length`. **F-3 (minor)** R2.3 replaces `Number` suffix ranking with BigInt/length-then-lex and adds a >2^53 suffix fixture with `compareNumericAware` consistency. **F-4 (minor)** R2.6 marks Phase 7 tasks 7.1–7.5 and the phase-status row complete at `be722b2` and reconciles `chg-GH-176-evidence.md`. **F-5 (minor)** R2.4 makes `clampValue`/`clampDetail`/`shortenSegment` code-point-safe and adds an astral fixture. **F-6 (info)** R2.5 maps a defensive `not-configured` CI read to `signal-unavailable`, never `read-failed`. **F-7 (info)** no action (dead defensive evidence-cap branch retained and noted); **F-8 (info)** no coder action (spec Appendix B `relationKind` is spec-only/PM-owned). R2.7 is the final battery (`pnpm check` + focused suites + five invariant checks + doc-distribution + clean tree). Baseline/status/artifacts references move to plan v1.6. Wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| 1.7 | 2026-11-01T12:20:00Z | Implementation Plan Writer | Review iteration-2 remediation appended from [review-iter-2.yaml](./code-review/review-iter-2.yaml) (verdict FAIL: 0 blocker / 1 major / 3 minor / 1 info; F-9..F-13) and aligned to spec v1.8 / test plan v1.8. No completed Phase 1–7 or R2.x task text, check state, acceptance, or behaviour is rewritten; the new "Remediation Iteration 3 (review iter-2 FAIL)" section adds R3.1..R3.6 with exact files, verification commands, acceptance, commit checkpoints (CP-R3.1..CP-R3.6), a finding table, and an explicit pin-supersession note. **F-9 (major)** R3.1 renames `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` to `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES = 32`, caps each provider segment at 32 UTF-8 bytes including a trailing `+` with no code-point split, byte-caps the header owner/name (128) and branch (256), enforces ≤400-byte candidate lines and ≤620-byte header plus summary, and replaces the over-bound `RangeError` with a reverse-rank candidate-line drop marked `+more` that never throws, exits non-zero, changes a payload field, or adds a reason token; adds the `caps/human-astral-8` 8-candidate astral worst case and the `caps/human-over-budget` defensive line-drop case, and retires the oversized-brand throw control. **F-10 (minor)** R3.2 makes the canonical golden evaluator-produced (splitting the read-scoped `unknown` close class into a second evaluator fact set rather than hand-building it), fixes the impossible GH-180 `workItem.state: unknown` with all-satisfied/ready by observing the item, adds `pr-association-unknown` as the group-6 reason, and adds a DM-1/DM-2 validity assertion with corrupted-twin controls. **F-11 (minor)** R3.3 encodes rank/index sentinels into the CJK byte-budget fixture and asserts the exact survivor set and order (relations before labels, last-ranked candidate first, highest index first, stop at the first fit) instead of "some were dropped". **F-12 (minor)** R3.4 removes the `classifyPipelineRuns` re-exports from `domain/index.ts` and `core/src/index.ts`, keeping it module-internal for `status.ts`/`queue-ready.ts` and pinning the two-function queue-ready public surface. **F-13 (info)** R3.5 reconciles the evidence (and verifies the plan) to plan v1.7 / spec v1.8 / test plan v1.8 and removes the stale "Pending doc-syncer re-run" statement; pm-notes stays PM-owned. **F-7 remains accepted, no action; F-8 is already fixed.** R3.6 is the final battery (focused suites + `bun test` + `pnpm check` + five invariant checks + doc-distribution + `git diff --check` + clean tree). Front-matter summary, inputs, baseline, status, GAP-1 closeout, artifacts table, file inventory, revision log, and execution log move to spec v1.8 / test plan v1.8 / plan v1.7. Wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |

## Execution Log

Execution notes for `@coder` (binding, from D9/D10):

- **No subagent dispatch**: `@coder` executes Phases 1–6 with inline committer discipline; Phase 7 is a `@doc-syncer` handoff — never mark it complete by finishing implementation alone.
- **One Conventional Commit per phase** with the phase's completion signal; explicit `git add` of exactly the phase's files; verify the staged set before committing; never stage `.ai/local/**`, `tmp/**`, or untracked scratch; no push during delivery; no amend.
- **Inline gates**: `pnpm check` before every commit with the log captured under `.ai/local/` (never staged); a red gate blocks the commit — fix it or stop at the last green task boundary and report.
- **Fixture hygiene**: committed fixtures read-only; derived/mutated fixtures under fresh `mkdtemp` siblings in the OS temp directory, removed in teardown; corpus/golden files read in place with digest guards; the live tree clean after every suite.
- **Evidence honesty**: record only executed evidence with command + HEAD; unrun results are never recorded as passing (test plan §7).
- **Fail-closed escalations**: a moved spec constant, inventory drift, a spec/test-plan inconsistency, or a 50 ms measurement failure is a STOP-and-report to PM — never a test weakening or a silent reinterpretation.

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| Authoring | Complete | 2026-10-31T23:55:00Z | 2026-10-31T23:55:00Z | none | Initial authoring pass; read the spec v1.1, test plan v1.1 (35 TCs), ticket/backlog/registry, decision records, the GH-175 plan exemplar, and the baseline code seams; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. Executors record per-phase evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
| Authoring (v1.1) | Complete | 2026-10-31T23:59:00Z | 2026-10-31T23:59:00Z | none | DoR iteration-1 revision pass; read readiness-iter-1.md, spec v1.2, and test plan v1.3 in full; applied the plan findings R-15/R-17 and the spec v1.2 alignments R-01/R-02/R-04/R-06/R-07/R-10/R-16/R-18/R-19, plus the R-05 ordering correction; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| Authoring (v1.2) | Complete | 2026-10-31T23:59:59Z | 2026-10-31T23:59:59Z | none | DoR iteration-2 revision pass; read readiness-iter-2.md, spec v1.3, and test plan v1.4 in full; applied R-21 (scoped `available` claim rule), R-22 (§8.3 identity rule + task 3.2 + TC-036/037), R-23 (provider config failure by read reason + command-level fixture), R-24 (nine caps, human segment, numeric pattern, marker reasons, `value-clamped`, byte-budget reduction, TC-038), R-25 (scoped scans in tasks 5.2/5.4), R-26 (RES-5 deleted; exact group 2/group 6), R-27 (mtime/token read instead of a digest), R-28 (generic live wording; allowlist cardinality five), R-29 (`blocked-by`-only projection), and the carried-forward R-15 DoD split; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| Authoring (v1.3) | Complete | 2026-11-01T00:30:00Z | 2026-11-01T00:30:00Z | none | DoR iteration-3 revision pass under the PM-authorized scoped re-gate; read readiness-iter-3.md, spec v1.4, and test plan v1.5 in full; applied R-30 (provider config failure by the read's `reason`; RES-8 + provider sub-rules + task 4.1), R-31 (candidate-set-scoped identity observation vs per-candidate condition independence), R-32 (deps state-count detail = total `blocked-by` relation target count), R-33 (observed-work-item uniqueness domain for targets + canonical-observed-unrequested row), R-34 (`systemName` removed from projected identities; over-long fixture), R-35 (duplicates rejected, never silently merged), and R-36 (41-byte proxy suffix); preserved 7 phases / 39 tasks and the 38 TC / 23 AC / 11 NFR mapping; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| Authoring (v1.4) | Complete | 2026-11-01T01:00:00Z | 2026-11-01T01:00:00Z | none | DoR iteration-4 final scoped correction pass under the PM-authorized final re-gate; read readiness-iter-4.md, spec v1.5, and test plan v1.6 in full; applied R-39 (PM-NOTE-1 scopes `? S ? ? ? S` to the three binding/credential rows and states `all-unknown-degraded` is `? S ? ? ? ?`), R-40 (only a bare all-ASCII-digit target bridges against the observed work-item set; a canonical-shaped target not observed stays `dependency-unobserved` and never bridges on its numeric suffix; exact canonical target match is a case-insensitive full-value match), R-42 (provider config/park failure evidence uses the pinned `failureCode`/`failureClass` detail form only; command-level unresolved carries `failureCode:config.value.invalid`, defensive `ok:true` and `provider-chain-not-declared` carry none, `state-unreadable` carries the park code/class where supplied), and R-37 alignment (the 22-control matrix is asserted per targeted condition/source, close-only controls 20/22 may be ready with `unknown` close and never `new-start`, control 21 is not ready, no global not-ready claim); preserved 7 phases / 39 tasks and the 38 TC / 23 AC / 11 NFR mapping; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| Authoring (v1.5) | Complete | 2026-11-01T01:40:00Z | 2026-11-01T01:40:00Z | none | DoR iteration-5 scoped correction pass under the human-authorized re-gate; read readiness-iter-5.md, spec v1.6, and test plan v1.7 in full, plus the delivered `packages/cli/src/commands/status.ts:63-78`; applied R-43 (two independent `collectStatusFacts` read gates — issues/pulls on binding observed, check-runs additionally on resolved HEAD SHA — with the `not-ready-ci-unresolved` row reachable and `status` bytes unchanged; tasks 2.2/2.4/2.5, Phase 2 acceptance, RSK-P3, the read-reuse note, task 6.1, and the DoD), R-45 (same-class associated-PR tie-break pinned in the close section, task 4.2, and the DoD; aligned with F-10/DM-6/TC-QREADY-016), and R-47 (R-38/R-41 added to the iteration-4 enumeration; status/baseline/GAP-1/artifacts references moved to spec v1.6, test plan v1.7, plan v1.5; DoR-iteration-5 artifacts row and revision-log row added); verified the provider `no-enabled-entry`/`all-entries-parked` evidence detail already carries `chain:<name>`; preserved 7 phases / 39 tasks and the 38 TC / 23 AC / 11 NFR mapping; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| Authoring (v1.6) | Complete | 2026-11-01T02:20:00Z | 2026-11-01T02:20:00Z | none | Review iteration-1 remediation pass; read `code-review/review-iter-1.yaml` in full plus the delivered `packages/core/src/domain/queue-ready.ts` (`assembleReasons`, `refNumber`/`compareCandidates`, `clampValue`/`clampDetail`/`shortenSegment`, `ciCondition`, the machine budget and `fits()` recheck), the `reasons-cap-7` corpus row, the ranking/caps/CI fixtures, and the `chg-GH-176-evidence.md` Phase 7 handoff text; appended the "Remediation Iteration 2 (review FAIL)" section with R2.1..R2.7 (exact files, commands, acceptance, commit checkpoints) for F-1..F-6, recorded F-7 as no action and F-8 as spec-only/PM-owned, and moved the status/baseline/artifacts/version references to plan v1.6; did not modify any completed Phase 1–7 task text; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| Authoring (v1.7) | Complete | 2026-11-01T12:20:00Z | 2026-11-01T12:20:00Z | none | Review iteration-2 remediation pass; read `code-review/review-iter-2.yaml` in full plus spec v1.8 (DM-11/DM-12, DEC-20, Appendix C/F), test plan v1.8 (TC-QREADY-020/029/035/038), the delivered `packages/core/src/{contracts,domain}/queue-ready.ts` (`shortenSegment`, `humanDetail`, `renderQueueReadyHuman`, the constants), `packages/core/src/{contracts,domain}/index.ts`, `packages/core/src/index.ts`, the golden canonical fixture/test, the CJK byte-budget fixture/test, and the evidence baseline; appended the "Remediation Iteration 3 (review iter-2 FAIL)" section with R3.1..R3.6 (exact files, commands, acceptance, commit checkpoints) for F-9..F-13, recorded F-7 as still accepted and F-8 as already fixed, and moved the summary/inputs/baseline/status/artifacts/revision/execution references to spec v1.8, test plan v1.8, and plan v1.7; did not modify any completed Phase 1–7 or R2.x task text; wrote only this plan file; implemented no code; ran no builds, tests, or git operations. |
| 1 | Complete | 2026-11-01T03:00:00Z | 2026-11-01T03:40:00Z | see git log | Contracts (incl. nine caps, numeric pattern, marker reasons, projected types) + pure evaluator/renderer + identity comparator + shared CI classifier + TC-003/004/024; focused gate 82 pass / 0 fail; invariant checks green; `pnpm check` 1638 pass / 2 skip / 0 fail. |
| 2 | Complete | 2026-11-01T03:40:00Z | 2026-11-01T04:20:00Z | see git log | `queue ready` command/grammar + `collectStatusFacts` + edge + TC-001/002/032/033; focused gate 95 pass / 0 fail; `pnpm check` green after adding the planned minor changeset early (documented deviation; phase-6 artifact landed in phase 2 so the release invariant is green at every phase). |
| 3 | Complete | 2026-11-01T04:20:00Z | 2026-11-01T05:05:00Z | see git log | Deps/identity/repo/tier/owner/CI suites + TC-005..010/036/037; focused gate 36 pass / 0 fail; `pnpm check` 1690 pass / 2 skip / 0 fail. Malformed YAML fixture shipped as `malformed.yaml.txt` (repo precedent) so the formatter does not parse intentionally invalid YAML. |
| 4 | Complete | 2026-11-01T05:05:00Z | 2026-11-01T05:50:00Z | see git log | Provider (config-by-reason, scoped `available` scan)/close/ranking suites + TC-011..017; focused gate 35 pass / 0 fail; `pnpm check` 1720 pass / 2 skip / 0 fail. Provider fixtures are committed JSON snapshots; park states are injected as verified park views. |
| 5 | Complete | 2026-11-01T05:50:00Z | 2026-11-01T06:45:00Z | see git log | Output/human digest/caps/reasons/truncation/negative controls/read-only + TC-018..027/034/035/038; focused gate 164 pass / 0 fail; `pnpm check` 1758 pass / 2 skip / 0 fail. Existing secret-read/forbidden-literal/error-table suites confirmed unchanged and green. Synthetic evidence-cap/byte-budget contract cases are asserted against the renderer/contract checker because the delivered cap set cannot reach them; the evaluator branches remain implemented defensively. |
| 6 | Complete | 2026-11-01T06:45:00Z | 2026-11-01T07:40:00Z | see git log | Corpus (identity + cap rows)/golden (32-char segments, `value-clamped`)/performance/live + changeset + evidence + final battery + TC-028..031. Focused 165 pass / 1 skip; full `pnpm check` 1778 pass / 3 skip / 0 fail; five invariant checks, doc-distribution, `git diff --check`, clean tree. Changeset landed in Phase 2 (deviation recorded in evidence). |
| 7 | Complete | 2026-11-01T08:00:00Z | 2026-11-01T08:30:00Z | `be722b2` | `@doc-syncer` performed the handoff: authored and registered `doc/spec/features/feature-queue-ready.md`, reconciled the status/provider/state/config/result/monorepo/registry/glossary/index docs, and added the forbidden-literals registered entry. |
| R2.1 | Complete | 2026-11-01T09:00:00Z | 2026-11-01T09:20:00Z | `38ce051` | Group 5 now walks rank order → `QUEUE_READY_CONDITION_ORDER` → evidence order; `reasons-cap-7` emits `local-context-missing` before `signal-unavailable`; added walk-order and exact corpus assertions; focused 44 pass / 0 fail; `pnpm check` 1780 pass / 3 skip / 0 fail. |
| R2.2 | Complete | 2026-11-01T09:20:00Z | 2026-11-01T09:50:00Z | `293b235` | Runtime-neutral code-point `utf8ByteLength` now drives the 65 536-byte machine budget, every `fits()` recheck, and the 4 096-byte human bound (defensive `RangeError`); CJK fixture measured 31 265 UTF-16 units / 90 785 UTF-8 bytes before reduction and 29 919 units / 65 439 bytes after; focused 44 pass / 0 fail; `pnpm check` 1782 pass / 3 skip / 0 fail. |
| R2.3 | Complete | 2026-11-01T09:50:00Z | 2026-11-01T10:05:00Z | `ab6c910` | Candidate suffix ranking uses a BigInt comparator (no `Number` on the path); `GH-9999999999999999` < `GH-10000000000000000` < `GH-10000000000000001` plus a ≥20-digit pair; `GH-007` before `GH-7` preserved; focused ranking 9 pass / 0 fail; `pnpm check` 1783 pass / 3 skip / 0 fail. |
| R2.4 | Complete | 2026-11-01T10:05:00Z | 2026-11-01T10:25:00Z | `bb126a6` | `clampValue`/`clampDetail`/`shortenSegment` slice code points; astral at/over-cap fixture covers labels, relations, owner/name, branch, timestamp, PR refs, and the 32-code-point human segment with lone-surrogate and TextEncoder round-trip checks; focused output 29 pass / 0 fail; `pnpm check` 1788 pass / 3 skip / 0 fail. |
| R2.5 | Complete | 2026-11-01T10:25:00Z | 2026-11-01T10:40:00Z | `2c8e4e9` | Explicit defensive `not-configured` → `signal-unavailable` branch, never `read-failed`; attempted `read-failed` control unchanged; no new vocabulary token/error row/corpus row; focused CI 8 pass / 0 fail; `pnpm check` 1789 pass / 3 skip / 0 fail. |
| R2.6 | Complete | 2026-11-01T10:40:00Z | 2026-11-01T10:50:00Z | `89cdfc6` | Phase 7 tasks 7.1–7.5 and the status row reconciled to `be722b2`; `chg-GH-176-evidence.md` records the completed doc sync. |
| R2.7 | Complete | 2026-11-01T11:00:00Z | 2026-11-01T11:25:00Z | this commit | Final battery on `89cdfc6` (clean tree): `pnpm install --frozen-lockfile` OK; focused 5 suites 63 pass / 0 fail; `bun test` 1786 pass / 3 skip / 0 fail; `pnpm check` 1786 pass / 3 skip / 0 fail; five invariant checks OK; doc-distribution no drift (81 docs); `git diff --check` and `git status --porcelain` clean. CJK raw 31 265 UTF-16 units / 90 785 UTF-8 bytes → 29 919 units / 65 439 bytes after reduction. `be722b2` doc sync confirmed. No push. |
| R3.1 | Complete | 2026-11-01T13:00:00Z | 2026-11-01T13:45:00Z | `b8292a6` | Byte-aware total human renderer: `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` 32 UTF-8 bytes, header owner/name 128 and branch 256 bytes, ≤400-byte candidate lines, reverse-rank line drop marked `+more`; astral-8 payload renders ≤4 096 bytes/10 lines with exit 0 and no `value-clamped`, character-capped oracle >4 096; over-budget brand drops 5 of 8 lines in reverse rank order. Focused 60 pass / 0 fail; `pnpm check` 2059 pass / 3 skip / 0 fail. |
| R3.2 | Complete | 2026-11-01T13:45:00Z | 2026-11-01T14:10:00Z | `0f0000f` | Canonical golden is `evaluateQueueReady(canonicalFacts())`; separate `canonicalUnknownCloseFacts()` payload is observed/ready with `pr-association-unknown` last; DM-1/DM-2 validator plus 8 corrupted twins fail by name; payload 9 920 bytes and human 609 bytes regenerated. Focused 68 pass / 0 fail; `pnpm check` 2062 pass / 3 skip / 0 fail. |
| R3.3 | Complete | 2026-11-01T14:10:00Z | 2026-11-01T14:40:00Z | `02207ce` | Rank/index sentinels in the CJK fixture; exact pinned survivor oracle and stop-at-first-fit proof. Reduced payload 65 376 bytes; rank 8→3 drop all 16 relations, rank 2 drops 5, rank 1 and every label survive; labels-first/rank-asc/index-asc mutations fail the oracle by name. Focused 13 pass / 0 fail; `pnpm check` 2064 pass / 3 skip / 0 fail. |
| R3.4 | Complete | 2026-11-01T14:40:00Z | 2026-11-01T15:00:00Z | `e83baf6` | Both barrel re-exports removed; `ci-result.ts` still exports the classifier and `status.ts`/`queue-ready.ts` still import `./ci-result.js`; public queue-ready surface pinned to `evaluateQueueReady`/`renderQueueReadyHuman`. Focused 71 pass / 0 fail; `pnpm check` 2065 pass / 3 skip / 0 fail. |
| R3.5 | Complete | 2026-11-01T15:00:00Z | 2026-11-01T15:15:00Z | `ca53a68` | Evidence baseline moved to plan v1.7 / spec v1.8 / test plan v1.8; R3.1–R3.6 record added; golden measured bounds updated; deviation 6 corrected to the evaluator-produced, DM-1/DM-2-valid golden; doc sync recorded at `58319b1` (R2 doc-sync `b8809d6`); stale version strings verified absent. |
| R3.6 | Complete | 2026-11-01T15:15:00Z | 2026-11-01T15:40:00Z | `0eb97da` | Final battery (logs under `.ai/local/gh-176-r3.6-*.log`, never staged): focused core 66 pass / 0 fail; focused queue-ready 177 pass / 1 skip / 0 fail; `bun test` 2065 pass / 3 skip / 0 fail; `pnpm check` 2065 pass / 3 skip / 0 fail; five invariant checks OK (`error-table-sync` 35/35, `forbidden-literals` 18 user-facing docs, `ambient-globals` 42 files, `exit-code-literals` 104 files, `workspace-entrypoints`); doc-distribution no drift (81 docs); `git diff --check` clean; tree clean at `ca53a68` before this evidence update. Astral-8 render 2 891 bytes / 10 lines (payload 22 108 bytes, header+summary 603 bytes, max candidate line 283 bytes, max segment 29 bytes); over-budget render 3 989 bytes / 5 lines (3 survivors, 5 dropped, payload untouched, `truncated:false`). |

