---
id: chg-GH-176-test-plan
status: Updated
created: 2026-10-31T20:10:00Z
last_updated: 2026-11-01T12:20:00Z
owners: [engineering]
service: delivery-os CLI queue readiness
labels: [change, planning]
version_impact: minor
summary: "Queue ready M0-S7: a read-only `ados queue ready <workItemRef>...` that accepts 1..8 refs and only the global `--json` switch, evaluates exactly six closed tri-state conditions in fixed order (deps-satisfied, repo-free, tier-known, no-owner-gate, ci-healthy, provider-available), marks a candidate ready only when all six are satisfied, names every unsatisfied or unknown condition, and ranks close items (merge-ready, review-pending) above ready new starts, unknown close associations, and not-ready candidates. The plan proves grammar rejection before any read (`input.value.rejected` for zero/wrong/malformed/duplicate/9..32 refs; `fallback.invocation` for 33 refs (34 positionals) and unknown flags); the condition derivation matrix with unavailable/unobserved/failed sources never becoming satisfied; deps from normalized blocked-by relations with GitHub relations declared unavailable; repo-free from the local PM context; tier from exactly one priority label; owner gate from hand-back/human-input-needed only; CI where only succeeded satisfies; provider availability from the declared chain plus verified park fold with the engine never called and no provider evidence record or availability claim using `available` as a claim or state (the pinned condition id `provider-available` is exempt and every negative scan is scoped to provider evidence/details and the provider human-text segment); provider-agnostic candidate and `blocked-by`-target identity resolution (exact canonical match first, then a unique all-ASCII-digit provider `entityId` bridge with no numeric coercion; candidate observation is candidate-set-scoped, so a shared suffix leaves the item unobserved for every sharing candidate with no precedence or caller order, while `blocked-by` targets resolve against the observed work-item set); projected relation-target and pull-request identities that are `entityId`-only with `systemName` omitted; a deps state-count detail summing to the total `blocked-by` relation target count (observed + unobserved); nine provider-derived output caps with output-only `value-clamped` marking and the deterministic byte-budget reduction; branch-convention close association with observed-approval-only merge-ready and an explicit unknown association class never fabricated as new-start; deterministic 1-based ranking with numeric-aware ref ties; the bounded `delivery.queue-ready.v1` payload (<=64 KiB) and deterministic byte-aware human digest (<=16 lines/4096 UTF-8 bytes, 32-UTF-8-byte provider segments including a trailing `+`, 400-UTF-8-byte candidate lines, 620-UTF-8-byte header plus summary, and a reverse-rank line-drop fallback that never throws); zero writes, fences, state mutations, network writes, provider-engine calls, or child processes; byte-identical replay; no new error row, config key, state schema, package, subpath, runtime-API location, or secret-read allowlist entry; and a fixture-driven default suite plus an opt-in structural live smoke; spec v1.3/v1.4/v1.5/v1.6/v1.8 pins are asserted exactly (six-group top-level reason order with first-occurrence dedup and cap-6 overflow, group 2 = `source-truncated` then `value-clamped`, group 6 = exactly `pr-association-unknown` and last, two-record provider evidence with the engine-not-run companion, associatedCount 0..100 open-match semantics, command-level open-only association with evaluator-injected merged/closed exclusion and pr-not-open, the same-class selected-PR tie-break (`entityId` numeric-aware, then `sourceRef`, then `targetRef`, then raw `entityId`), the candidate-vs-payload truncation split with the CI at-limit payload-only marker, each CI unknown reason, canonical refs with preserved leading zeros and duplicate-after-canonicalization rejection, a 64-character canonical ref length bound, one-record deps evidence with state-count detail, unobserved-before-signal precedence, tests-only live-switch literal, title-free payload, blocked-by-only relation projection, the repo/tier proxy-source detail suffix, candidate-set-scoped identity observation, `entityId`-only projected identities with no `systemName`, the total `blocked-by` target count in the deps detail, and duplicate refs rejected rather than silently merged, and the byte-aware human renderer with 32-UTF-8-byte provider segments, 400-byte candidate lines, 620-byte header plus summary, and a reverse-rank line-drop fallback that never throws)."
links:
  change_spec: ./chg-GH-176-spec.md
  implementation_plan: ./chg-GH-176-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S7: queue ready (read-only)

## 1. Scope and Objectives

This change adds the one read-only ready-set command the coordinator calls when choosing the next change. The tests must prove three things at once: **the ready set is total and tri-state** (every candidate carries exactly six conditions in fixed order, each with one closed state and bounded evidence; `ready` is true only when all six are `satisfied`; every non-satisfied condition is named with its state), **truthfulness is structural, not prose** (an absent, failed, unavailable, unobserved, or unresolved source is `unknown`, never `satisfied`; `merge-ready` requires an observed approval on a non-draft open pull request; an unobservable close association is `unknown`, never `new-start`; no-run/pending/failed CI is never healthy; provider availability is never engine-verified and no provider evidence record or availability claim uses `available` as a claim or state, while the pinned condition id `provider-available` and its condition-id/`blocking:` references are exempt and every negative scan is scoped to provider evidence/details and the provider human-text segment), and **the read-only/tier contract holds** (zero writes, fences, state mutations, network writes, provider-engine calls, quota fetches, and child processes; injected reads and clock only; identical inputs yield byte-identical payload and human text; every provider-derived payload value is output-only clamped to its declared cap with `value-clamped`, and a clamp never changes a verdict; no new error row, config key, state schema, package, subpath, runtime-API location, or secret-read allowlist entry).

The plan is organized around the adversarial mechanisms the specification names. First, the **§8.3/Appendix A condition derivation matrix is executed cell by cell**, including the cases where absence and unobservability look identical to a naive implementation (relations unavailable with zero visible relations; an unobserved dependency target; a missing PM context; an unlabelled ticket; an unattempted check-runs read; an undeclared provider chain). Second, **close classification and ranking are tested as a closed decision table** (Appendix E), with every association state, review signal, draft state, and PR selection rule, and with the unknown-association class proved to rank between new-start and not-ready. Third, **bounds and truncation are measured, not sampled**: 8 candidates, 6 conditions, a 64-character canonical ref cap, 2 evidence records, 6 reasons, 160-character details, the 64 KiB serialized `data` bound, the 16-line/4096-UTF-8-byte human bound with 32-byte provider segments, 400-byte candidate lines, a 620-byte header-plus-summary budget, and the reverse-rank line-drop fallback, and the raw-page at-limit signals (100-item issues and pull-request pages, 20-run check-runs page) each have an under-cap control and an at-limit/over-cap control that must fail. Fourth, **the spec v1.3/v1.4/v1.5/v1.6/v1.8 output pins are asserted literally**: the six-group top-level reason order with first-occurrence dedup and cap-6 overflow, group 2 = `source-truncated` then `value-clamped`, group 6 = exactly `pr-association-unknown` and last (with `read-failed`/`credential-unavailable` never in group 6), the two-record provider evidence pairing, the one-record deps state-count evidence, the unobserved-before-signal precedence, the `associatedCount` open-match semantics, command-level open-only association with `pr-not-open` restricted to evaluator-injected merged/closed views, the same-class selected-PR tie-break (`entityId` numeric-aware, then `sourceRef`, then `targetRef`, then raw `entityId`), the candidate-vs-payload truncation flag split, the CI at-limit payload-only marker, each CI `unknown` reason, the tests-only live literal, the title-free payload, canonical refs with preserved leading zeros, the provider-agnostic identity bridge (exact canonical first, then a unique digit-only `entityId`, never numeric coercion), the nine provider-derived output caps whose output-only clamps add `value-clamped` and never change a verdict, candidate-set-scoped identity observation (a shared suffix leaves the item unobserved for every sharing candidate, never precedence or caller order), `entityId`-only projected relation-target and pull-request identities with no `systemName`, and a deps state-count detail that sums to the total `blocked-by` relation target count (observed + unobserved).

### 1.1 In Scope

- The `queue` command definition with the subcommand positional `ready`: 1..8 work-item refs each at most 64 canonical characters, only the global `--json` switch, parser positional bound 33 (1 subcommand + 32 refs; 33 refs = 34 positionals is parser-rejected), no command-specific flags; handler grammar rejection before any source read (F-1, DEC-1, DEC-15, AC-F1-1).
- Candidate set semantics: explicit caller-supplied refs only, case-normalized canonical refs, case-insensitive duplicate rejection, no discovery/enumeration/implicit active-change candidate, condition evaluation independent per candidate over shared facts with candidate-set-scoped identity observation, and **provider-agnostic identity resolution** of a candidate to an observed `identity.entityId` — exact case-insensitive canonical match first, then an all-ASCII-digit provider id bridged to the candidate's canonical numeric suffix only when exactly one requested candidate carries that suffix (so a shared suffix leaves the item unobserved for every sharing candidate, with no precedence and no caller-order tie-break), with no substring/prefix/numeric coercion (`"0176"` != suffix `176`, `GH-007` != `"7"`), always over the full value before any output clamp (F-2, §8.3, DEC-14, DEC-18, DM-2, AC-F1-1, AC-F2-3).
- Exactly six conditions in fixed order — `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available` — one state from `satisfied`/`unsatisfied`/`unknown`, 1..2 bounded evidence records, `ready` iff all six satisfied, and `blockingConditions` naming every non-satisfied condition in fixed order (F-3, DM-2, DM-3, AC-F2-1, AC-F3-1, NFR-1).
- The §8.3/Appendix A derivation matrix for all six conditions, including unobserved candidates, unavailable relation/label signals, unresolved HEAD, failed reads, invalid/unresolved provider config, and failed park folds (F-3, F-14, DM-3, AC-F2-2, NFR-1, NFR-3).
- `deps-satisfied` over normalized `blocked-by` relations: unobserved candidate unknown before any relation-signal check, then unavailable relations unknown even with zero visible relations, done/canceled satisfied, observed non-done unsatisfied, unobserved target unknown; exactly one evidence record with the state-count detail `done:<n>; open:<n>; unknown:<n>` summing to the total `blocked-by` relation target count (observed + unobserved) and no per-target record; **`blocked-by` targets resolve against the observed work-item set by the §8.3 target rule (the uniqueness domain is the observed work-item set, not the requested candidate set)** (exact full-value identity first, then the unambiguous all-ASCII-digit bridge), so a provider-shaped target `"179"` resolves for candidate `GH-179`, a canonical-shaped target whose exact identity matches an observed item that is not a requested candidate is observed by exact match, a target matching nothing or whose digit string is shared by more than one observed work item stays unobserved (`dependency-unobserved`) and is never assumed done, and a leading-zero mismatch (`"0179"` vs `"179"`) is no match (F-4, DEC-5, DEC-11, DEC-18, AC-F4-1, AC-F4-2).
- `repo-free` over the git-ignored local PM context: missing/malformed unknown, no active change satisfied with detail `repo:local-context`, candidate-as-active satisfied case-insensitively with detail `repo:local-context; candidate-is-active`, another active change unsatisfied with detail `repo:local-context; active-change:<ref>`, never "free" from absence, never written (F-5, DEC-4, AC-F5-1).
- `tier-known` from exactly one recognized `priority:high`/`priority:medium`/`priority:low` label (case-insensitive); zero recognized unknown with detail `tier:priority-label; none`; two or more distinct unsatisfied with detail `tier:priority-label; labels:<sorted labels>`; satisfied detail `tier:priority-label; label:<label>`; unrecognized labels inert; no default tier (F-6, DEC-3, AC-F6-1).
- `no-owner-gate` from `hand-back`/`human-input-needed` only: none satisfied, any unsatisfied with sorted labels, unobserved labels/item unknown, `assignee` never used (F-7, DEC-6, AC-F7-1).
- `ci-healthy` over the current checkout HEAD's single bounded check-runs page: only `succeeded` satisfies; `failed`/`pending`/`canceled`/`none` unsatisfied with matching reasons; unresolved SHA and failed reads unknown; no-run and all-skipped never green (F-8, DEC-7, AC-F8-1).
- `provider-available` from the resolved default chain plus the verified park fold: exactly two evidence records per condition — the F-9 case record first, then `{ source: "provider-config", reason: "engine-not-run" }` with no detail; at least one enabled unparked entry is satisfied with `{ source: "provider-parks", reason: "no-active-park", detail: "chain:<name>" }`; no enabled entry/all entries parked/active chain park unsatisfied with their exact case records; no declared chain/unresolved chain/config-invalid/state-unreadable unknown, with a config-read failure mapped by the read's own `reason` (`{ok:false, reason:"config-invalid"}` -> `config-invalid`; `{ok:false, reason:"provider-chain-unresolved"}` -> `provider-chain-unresolved`, mirroring `packages/core/src/domain/status.ts`) and a park-fold failure always `provider-parks`/`state-unreadable`; a config or park failure record carries the read's bounded failure identity in the pinned `failureCode:<code>`, `failureClass:<class>`, or both joined by `; ` detail form (or no `detail` when the read supplies neither), never a free-form detail, while the defensive `ok:true` view and `provider-chain-not-declared` carry no failure detail; engine, `provider resolve`, `provider quota`, and quota transport never invoked; no provider evidence record or availability claim uses `available` as a claim or state (the pinned condition id and condition-id/`blocking:` references are exempt; the scan is scoped to provider evidence/details and the provider human-text segment) (F-9, DEC-8, AC-F9-1, NFR-5).
- Close association by the `<type>/<workItemRef>/<slug>` branch convention (>=3 non-empty segments, any segment case-insensitively equal to the candidate ref), `merge-ready` only for a non-draft open PR with the review signal available and observed `approved`, every other associated open PR `review-pending`, `associatedCount` in `0..100` counting open matches only (exact below the limit, page-bounded at it, 0 on failed read/unavailable binding), deterministic same-class PR selection (the merge-ready set when non-empty, otherwise the associated set; then `entityId` ascending numeric-aware where equal all-digit values tie, then `sourceRef` ascending, then `targetRef` ascending, then the lexically smaller raw `entityId`, with API return order never deciding), and association `unknown` for failed reads/unavailable binding/at-limit no-match. The delivered command read is open-only, so a below-limit command-level no-match is always `not-associated`/`pr-not-associated`; merged/closed exclusion and `pr-not-open` are pure-evaluator rules over injected normalized views and never appear at command level (F-10, DEC-9, DEC-12, DM-5, DM-6, AC-F10-1).
- Top-level `reasons`: the unique union of six fixed groups in order (binding, group 2 = `source-truncated` then `value-clamped`, provider-config, park-fold, `QUEUE_READY_SOURCE_FAILURE_REASONS` in condition/evidence order, group 6 = exactly `pr-association-unknown` and last), first occurrence wins, cap 6, overflow sets the payload `truncated` only; verdict/observation reasons stay in condition or close evidence, and `read-failed`/`credential-unavailable` appear only in group 5 (F-12, DM-1, DM-10, DM-11, DEC-16, AC-F12-1).
- Truncation flag scope: evidence-cap overflow sets both the affected candidate and the payload `truncated`; reason-cap overflow, source-at-limit (issues/pulls/check-runs), and a provider-derived value clamp or byte-budget reduction set the payload `truncated` only (the affected candidate flag is unchanged because no evidence record was dropped); detail clamping sets neither and adds no `value-clamped`; every provider clamp adds `value-clamped` to group 2 of `reasons`; the evidence cap is reached only by the two-record `provider-available` (the delivered deps condition carries exactly one record, so its overflow is a synthetic defense); the 65 536-byte serialized `data` bound is a hard contract met by the deterministic byte-budget reduction (DM-11, DEC-17, DEC-19, AC-F8-1, AC-F12-1, AC-F12-2, NFR-2).
- Ranking: `merge-ready` (0) -> `review-pending` (1) -> `new-start` (2) -> `unknown` (3) -> `not-ready` (4), numeric-aware ref suffix ascending then canonical ref text ascending, 1-based `rank`, caller/API order never a tie-breaker (F-11, DM-7, AC-F11-1, NFR-4).
- Provider-derived projection caps (output-only): every projected provider-qualified identity is `entityId`-only with `systemName` omitted, so the whole projected identity object is the capped `entityId` (at most 128 characters); provider refs (`sourceRef`, `targetRef`) and labels at most 128 characters, at most 16 labels in provider order, at most 16 `blocked-by` relations in provider order (every other relation kind filtered out entirely, never clamped), repository owner and name at most 128, head branch at most 256, provider `updatedAt` at most 40; a clamp or reduction sets payload `truncated` and `value-clamped` in group 2 and never changes a condition state, `blockingConditions`, `closeClass`, `rank`, `associatedCount`, or `summary`; the deterministic byte-budget reduction drops trailing `workItem.relations` then trailing `workItem.labels` (last-ranked candidate first, highest index first, rechecking after each drop) until `data` fits 65 536 bytes (F-12, DM-1, DM-2, DM-6, DM-9, DM-11, DEC-19, AC-F12-2, NFR-2).
- The bounded `delivery.queue-ready.v1` machine payload in exactly one standard `CommandResult` envelope: `schemaVersion`, injected `generatedAt`, `repository`, `head`, ranked `candidates`, six conditions each, `close`, `blockingConditions`, `summary`, `reasons`, `truncated`; the observed `workItem` carries only normalized item state, at most 16 capped labels, a capped `updatedAt`, and at most 16 capped `blocked-by` relations (each target an `entityId`-only provider-qualified identity with no `systemName`; no title, body, comment, assignee, or other relation kind); serialized `data` <= 65 536 bytes; no `error` key on success; no raw payload, response body, credential, or free-form message (F-12, DM-1..DM-4, DM-8, DM-9, DM-11, DM-13, AC-F12-1, AC-F12-2, NFR-2, NFR-10).
- The deterministic human digest from the same payload: optional header, one summary line, one line per candidate in rank order, close evidence when associated, blocking conditions when not ready (both for a close item that is not ready), the fixed proxy-source suffix `[repo:local-context; tier:priority-label]` on every candidate line, `+more` on truncation or a defensive line drop, <=16 lines and <=4096 UTF-8 bytes, no titles/timestamps/raw payloads/secrets/LLM prose, zero extra reads. The renderer is byte-aware: each per-candidate provider segment (pull-request identity, source ref) is rendered to at most `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (32) UTF-8 bytes including a trailing `+` when shortened (the `+` counts toward the 32-byte cap and no code point is split), and the header renders owner and name to at most 128 UTF-8 bytes each and branch to at most 256 UTF-8 bytes, each with a trailing `+` when shortened. These are renderer rules only and change no payload field. A candidate line is at most 400 UTF-8 bytes and header plus summary at most 620 UTF-8 bytes, so eight candidate lines plus header/summary stay within 4 096 bytes; if a legal payload still renders above the bound, trailing candidate lines are dropped in reverse rank order (last-ranked first), the header (when present) and summary are kept, and the drop is marked `+more` after the summary without changing any payload field, setting the payload `truncated` flag, adding a reason token, throwing, or exiting non-zero (F-13, DM-12, AC-F13-1, NFR-2, NFR-6).
- Evidence and non-verdict rules, including the exhaustive AC-F14-1 negative-control matrix (22 named controls), asserted per control on its targeted condition/source: a targeted absent, failed, unattempted, unavailable, or unresolved readiness source never yields `satisfied`, and a non-satisfied readiness condition never yields a `ready` claim; when the targeted signal is close association, all six conditions may remain satisfied and `ready` may stay true while `closeClass` is `unknown`; no control yields a merge-ready claim without an observed approval on a non-draft open PR or an all-clear, and the PR-read-failure, binding-unavailable, and at-limit no-match controls never yield a `new-start` claim (F-14, DM-3, DM-10, AC-F14-1, NFR-3).
- Reuse of the delivered status read results and classifications (issues page, PRs page, check-runs page, repository binding and HEAD, provider config, verified park views, local PM context) with no new adapter operation (F-15, DEC-13, NFR-7).
- Read-only, deterministic, tier/brand-neutral execution: zero writes/fences/state mutations/network writes/provider-engine calls/child processes; injected clock; no ambient credential read; byte-identical replay (F-16, AC-F1-2, NFR-4, NFR-7, NFR-10).
- Error-identity reuse: no new row or domain kind; condition reasons are evidence vocabulary, never error-table identities; only `input.value.rejected` and `fallback.internal` fail the handler; the global parser keeps `fallback.invocation` (F-16, AC-F16-1, NFR-8).
- Fixture corpus, golden bytes, performance/read-cost bounds, and the opt-in structural live smoke outside default CI (F-17, AC-F17-1, NFR-6, NFR-9, NFR-11).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any queue, lane, dispatch, supervision, board, brief, merge, deploy, closeout, scheduling, per-repo single-flight, preemption, or build-weight engine (M2-S1). `queue ready` is the M0 ready set only (NG-1, DEC-14).
- [OUT] Automatic candidate discovery, open-issue enumeration as a candidate source, or a fleet-wide ready set (NG-2, DEC-14).
- [OUT] Provider-engine execution, chain resolution by the engine, quota evaluation/fetch, announcements, park writes/clears, telemetry, spawn selection (NG-3, DEC-8).
- [OUT] Any mutation: tracker/PR/CI writes, state appends, fences, park clears, projection rebuilds, pm-notes writes, PM-context writes (NG-4).
- [OUT] New GitHub reads, GraphQL review decisions/threads, structured issue-dependency reads, closed-issue pages, open-PR-head CI, or a full GitHub adapter (NG-5, DEC-13).
- [OUT] New configuration keys/branches for queue readiness, tier labels, candidate caps, repository addressing, or thresholds; any state-schema change (NG-6, NG-9).
- [OUT] A per-ticket `DeliveryTier` record or pm-notes-variant-derived tier (NG-10, DEC-3).
- [OUT] LLM summarization, semantic ranking, recommendations, prose generation, MCP/OpenCode surfaces, agent-prompt adoption, or replacing `status`/`verify`/`lint` (NG-7, NG-8).
- [OUT] New error-table rows/identities, result-envelope changes, new packages/subpaths/runtime-API locations, or new secret-read allowlist entries (NG-9, DEC-10).
- [GAP-1 — implementation plan present — RESOLVED] `chg-GH-176-plan.md` v1.7 (Delivery-Bound Resolutions RES-1..RES-8; aligned to spec v1.8) maps all 38 TCs (TC-QREADY-001..038, including the identity, relation-target, and provider-cap scenarios), all 23 ACs, and all 11 NFRs onto delivery phases and does not reshape behaviour, states, reasons, bounds, assertions, or AC/NFR mapping. It adopts the provider-config failure-by-reason rule (DoR iter-2 R-23) as RES-8 — `provider-chain-unresolved` vs `config-invalid` from the read's own reason, park fold `provider-parks`/`state-unreadable` — and adds the command-level `{ok:false, reason:"provider-chain-unresolved"}` fixture so that corpus row is reachable. OQ-T11 is closed; no existing TC behaviour is reopened.
- [GAP-2 — top-level `reasons` order — RESOLVED in spec v1.1; re-pinned by spec v1.3 R-26 (§8.3 DM-1/DM-11, Appendix C `QUEUE_READY_REASON_ORDER`/`QUEUE_READY_PAYLOAD_MARKER_REASONS`/`QUEUE_READY_SOURCE_FAILURE_REASONS`, DEC-16; AC-F12-1)] `reasons` is the unique union of six fixed groups in order: (1) repository binding, `addressing-unresolved` then `remote-unsupported`; (2) payload bounding markers, `source-truncated` then `value-clamped`; (3) provider config, `config-invalid`, `provider-chain-not-declared`, `provider-chain-unresolved`; (4) park fold, `state-unreadable`; (5) `QUEUE_READY_SOURCE_FAILURE_REASONS` appended by walking `QUEUE_READY_CONDITION_ORDER` and then each condition's evidence array, first occurrence only; (6) exactly `pr-association-unknown` and last. First occurrence wins, the cap is six, and overflow sets the payload `truncated` only. `read-failed`/`credential-unavailable` are group-5 only and never appear in group 6. Verdict/observation reasons (`ci-pending`, `tier-conflict`, `dependency-open`, `dependency-unobserved`, `pr-associated`, `pr-not-associated`, `pr-not-open`) never enter `reasons`; `source-truncated` and `value-clamped` are payload-level only and never condition/close evidence. Asserted by TC-QREADY-002, TC-QREADY-018, TC-QREADY-021, TC-QREADY-024, TC-QREADY-034, and TC-QREADY-035.
- [GAP-3 — provider evidence pairing — RESOLVED in spec v1.1 (F-9, DM-3/DM-4, DM-10, Appendix D, DEC-8; AC-F9-1)] Every `provider-available` condition carries exactly two evidence records: the case record first, then `{ source: "provider-config", reason: "engine-not-run" }` with no detail. The satisfied case record is `{ source: "provider-parks", reason: "no-active-park", detail: "chain:<name>" }`; the chain-park case record is `{ source: "provider-parks", reason: "chain-parked", detail: "chain:<name>; until:<expiry or none>; cause:<cause or none>" }`; the no-enabled-entry case record is `{ source: "provider-config", reason: "no-enabled-entry", detail: "chain:<name>" }`; the all-parked case record is `{ source: "provider-parks", reason: "all-entries-parked", detail: "chain:<name>" }`; the unknown case record is `{ source: "provider-config", reason: <reason> }`. `engine-not-run` is a reason token, never a detail. Asserted by TC-QREADY-003, TC-QREADY-011, TC-QREADY-012, and TC-QREADY-024.
- [GAP-4 — `associatedCount` semantics and bound — RESOLVED in spec v1.1 (§8.3 DM-6/DM-11, Appendix C `QUEUE_READY_ASSOCIATED_COUNT_RANGE`, Appendix E, DEC-9; AC-F10-1)] `associatedCount` is a non-negative integer in `0..QUEUE_READY_SOURCE_ITEM_LIMIT` (100) counting open matches only; it is exact below the page limit, a page-bounded lower bound at the limit, `0` when the pull-request read failed or the binding is unavailable, and not separately capped. A merged/closed match is never counted. Asserted by TC-QREADY-013, TC-QREADY-015, TC-QREADY-016, and TC-QREADY-018.
- [GAP-5 — `pr-not-open` trigger — RESOLVED in spec v1.1; re-scoped by spec v1.2 R-04 (§8.3 DM-5/DM-6/DM-10, F-10, Appendix D/E, DEC-9; AC-F10-1)] The delivered command read is open-only, so a below-limit command-level page with no open match is always `not-associated` with `pr-not-associated` and never `pr-not-open`. Merged/closed matches exist only in an evaluator-injected normalized view: they are never selected or counted, and below the limit with only matching merged/closed objects and no open match the evaluator yields `not-associated` with `pr-not-open` and the not-associated fallback class (`new-start` when ready, else `not-ready`). At the page limit with no open match the at-limit rule wins in both layers: `unknown` with `pr-association-unknown`, even when merged/closed matches were injected. Asserted by TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, and TC-QREADY-016.
- [GAP-6 — truncation flag scope — RESOLVED in spec v1.1; re-pinned by spec v1.2 R-06/R-18 and spec v1.3 R-24 (§8.3 DM-11, DEC-17, DEC-19; AC-F12-1, AC-F12-2)] Evidence-cap overflow retains the first two records in evaluation order and sets both the affected candidate `truncated` and the payload `truncated`; reason-cap overflow, source-at-limit, and a provider-derived value clamp or byte-budget reduction set the payload `truncated` only (the candidate flag is unchanged because no evidence record was dropped); detail clamping sets neither flag and adds no `value-clamped`. The delivered condition set reaches two records only in `provider-available`, so the overflow branch is a synthetic over-cap evaluator input, not a deps case. The payload carries no title, so there is no title cap. The 65 536-byte serialized `data` bound is a hard contract met by the deterministic byte-budget reduction (never silently truncated). Asserted by TC-QREADY-019, TC-QREADY-035, and TC-QREADY-038.
- [GAP-7 — check-runs at-limit — RESOLVED in spec v1.1 (§8.3 DM-1/DM-11, §8.4, F-8, DEC-17; AC-F8-1)] The check-runs read is one bounded page at `QUEUE_READY_SOURCE_PIPELINE_LIMIT` (20) with no pagination. A raw 20-run page adds payload-level `source-truncated` (top-level reason plus payload `truncated`), never a condition evidence record, and never changes the `ci-healthy` classification, state, evidence, or `blockingConditions`. Asserted by TC-QREADY-009 and TC-QREADY-035.
- [GAP-8 — live-smoke switch literal — RESOLVED in spec v1.1; corrected by spec v1.2 R-01 (F-17, DEC-17, §16; AC-F17-1)] The switch is the literal `ADOS_QUEUE_READY_LIVE`, bound only by the test harness at `tests/fixtures/queue-ready/harness.ts`, read only under `tests/**`, and enabled only when its value is exactly `1`. It is never a production or contract constant (`QUEUE_READY_LIVE_ENV` is removed from Appendix C and is not exported from `core ./contracts`), is absent from `packages/**` and every production edge, is not a configuration key, and never appears in the payload, evidence, or human text. Asserted by TC-QREADY-024, TC-QREADY-026, and TC-QREADY-031.
- [GAP-9 — CI `unknown` reasons — RESOLVED in spec v1.1 (§8.3 DM-10, F-8, Appendix A/D, DEC-7; AC-F8-1)] Each `unknown` mode maps to exactly one reason: unresolved SHA `commit-unresolved`; unattempted read from an unavailable binding `addressing-unresolved` (or `remote-unsupported` for an unsupported host); unattempted read with no resolvable credential `credential-unavailable`; attempted failure `read-failed` with a bounded existing `failureCode`/`failureClass`. No error row is added. Asserted by TC-QREADY-004 and TC-QREADY-010.
- [GAP-10 — canonical ref emission — RESOLVED in spec v1.1; extended by spec v1.2 R-02 (F-2, DM-2, Appendix C `QUEUE_READY_WORK_ITEM_REF_PATTERN`/`QUEUE_READY_MAX_WORK_ITEM_REF_CHARS`, DEC-15; AC-F1-1)] Input matching is case-insensitive with no whitespace acceptance or trimming; output uppercases the ASCII alphabetic prefix and preserves the hyphen and digit substring exactly, including leading zeros (`gh-176` -> `GH-176`, `gh-007` -> `GH-007`; `GH-007` and `GH-7` remain distinct). After canonicalization a ref of exactly 64 characters is accepted and a ref of 65 or more is rejected as `input.value.rejected` before duplicate detection and any read; the validation order is canonicalize -> length -> duplicate -> read. Duplicates are detected after canonicalization and rejected as `input.value.rejected` before any read; they are never silently merged. Asserted by TC-QREADY-001, TC-QREADY-024, and TC-QREADY-032.
- [GAP-11 — candidate/observed-item identity resolution — RESOLVED in spec v1.3 R-22; requalified by spec v1.4 R-31/R-33 (§8.3 identity rule, F-2/F-4, DM-2, Appendix C `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`, DEC-18; AC-F2-3, AC-F4-2)] A requested canonical ref matches an observed `identity.entityId` by exact case-insensitive canonical equality first; otherwise an all-ASCII-digit observed id bridges to the candidate's canonical numeric suffix only when exactly one requested candidate carries that suffix. Ambiguity leaves the item unobserved; `"0176"` never matches suffix `176` and suffix `007` never matches `"7"`; a non-digit provider id that is not the canonical ref never bridges. Candidate observation's uniqueness domain is the requested candidate set: a shared suffix leaves the item unobserved for every sharing candidate, never by precedence or caller order. `blocked-by` targets resolve against the observed work-item set (role-specific uniqueness domain): exact full-value identity first, then the unique digit-only bridge only when exactly one observed work item carries that suffix, with a canonical-shaped target matching an observed item that is not a requested candidate still observed by exact match. All matching uses the full value before any output clamp. Asserted at command level by TC-QREADY-036 and TC-QREADY-037, and structurally by TC-QREADY-031.
- [GAP-12 — provider-derived output caps — RESOLVED in spec v1.3 R-24/R-29; extended by spec v1.4 R-34 (§8.3 DM-1/DM-2/DM-6/DM-9/DM-10/DM-11, F-12/F-13, DEC-19, RSK-14; AC-F12-2)] Identity/ref/label values: every projected provider-qualified identity is `entityId`-only with no `systemName` (the whole identity object is the capped `entityId`, at most 128 characters); provider refs and labels are at most 128 characters, labels at most 16, `blocked-by` relations at most 16 (all other relation kinds filtered out entirely), owner/name at most 128, head branch at most 256, `updatedAt` at most 40, and human provider segments at most 32 UTF-8 bytes including a trailing `+`, the header owner/name at most 128 UTF-8 bytes each and branch at most 256 UTF-8 bytes, a candidate line at most 400 UTF-8 bytes, header plus summary at most 620 UTF-8 bytes, and the reverse-rank line-drop fallback marked `+more`. Every clamp or count reduction is output-only, sets payload `truncated`, and adds `value-clamped` after `source-truncated` in group 2; it never changes a condition state, `blockingConditions`, `closeClass`, `rank`, `associatedCount`, or `summary`. Oversize payloads are reduced deterministically (trailing relations, then trailing labels, last-ranked candidate first) until `data` fits 65 536 bytes. Asserted by TC-QREADY-019, TC-QREADY-020, TC-QREADY-024, TC-QREADY-029, TC-QREADY-035, and TC-QREADY-038.
- [GAP-13 — scoped `available` claim rule — RESOLVED in spec v1.3 R-21 (F-9, §4.1 KPI, §8.3 non-verdict rule, AC-F9-1, AC-F17-1, NFR-3)] No provider evidence record or availability claim uses `available` as a claim or state. The pinned condition id `provider-available`, the condition-id list, `blockingConditions`/human `blocking:` references, payload keys, summary tokens, and close classes are explicitly exempt, and every negative scan is scoped to provider evidence/details and the provider human-text segment — never the whole payload or digest. Asserted by TC-QREADY-011, TC-QREADY-012, TC-QREADY-021, TC-QREADY-031, and TC-QREADY-038.
- [GAP-14 — provider config failure mapping and group-6 membership — RESOLVED in spec v1.4 R-30 / spec v1.5 R-42 plus the `status.ts` precedent (§8.3 DM-1, F-9, Appendix C, DEC-16; AC-F9-1, AC-F12-1)] A provider config read failure is mapped by the read's own `reason`: `{ok:false, reason:"config-invalid"}` -> condition `unknown`/`config-invalid`, and `{ok:false, reason:"provider-chain-unresolved"}` -> condition `unknown`/`provider-chain-unresolved` (mirroring `packages/core/src/domain/status.ts`), so the command-level `not-ready-provider-unresolved` corpus row is reachable; a park-fold failure stays `provider-parks`/`state-unreadable`. A config or park failure record carries the read's bounded failure identity in the pinned `failureCode:<code>`, `failureClass:<class>`, or both joined by `; ` detail form (or no `detail` when the read supplies neither), never free-form; the command-level `not-ready-provider-unresolved` row carries `detail:"failureCode:config.value.invalid"`, and the defensive `ok:true` view plus `provider-chain-not-declared` carry no failure detail. Group 6 is exactly `pr-association-unknown` and last; `read-failed`/`credential-unavailable` never appear in group 6. Asserted by TC-QREADY-012, TC-QREADY-028, and TC-QREADY-034.

**DoR iteration-2 alignment (spec v1.3).** R-21/R-22/R-24/R-26/R-29 are applied from spec v1.3 and the test-plan findings R-25 (scoped all-clear scan; R-21 is its spec half) plus the test additions for R-22/R-24 (GitHub-shaped identity cases and the command-level over-long provider-field case) are corrected here. The plan-side R-23 (failure-by-reason mapping) is mirrored in the fixtures and adopted by `chg-GH-176-plan.md` (RES-8; v1.5). No gap is open: the corpus, coverage tables, automation map, and golden expectations are reconciled to the same pins. No AC or NFR lost coverage and no TC is orphaned.

**DoR iteration-3 alignment (spec v1.4).** R-30 (provider-config failure by the read's `reason`: `config-invalid` vs `provider-chain-unresolved`, park fold `provider-parks`/`state-unreadable`) is applied by correcting GAP-14's provenance while keeping the read-reason mapping in TC-QREADY-012 and the `not-ready-provider-unresolved` corpus row. R-31 qualifies per-candidate condition independence with candidate-set-scoped identity observation: a shared suffix leaves the item unobserved for every sharing candidate, with no precedence or caller order. R-32 replaces the deps "observed target count" reading with the total `blocked-by` relation target count (observed + unobserved). R-33 pins `blocked-by` target resolution to the observed work-item set, adds the canonical-shaped observed target that is not a requested candidate, and moves ambiguity to observed-set uniqueness. R-34 makes every projected provider-qualified identity `entityId`-only with `systemName` omitted and adds an over-long `systemName` fixture proving it never enters the payload; there is no tenth cap. R-35 states duplicate refs as detected after canonicalization and rejected, never silently merged. R-36 finds no 43-byte figure in this plan (the proxy suffix is not byte-counted here; spec Appendix F carries the corrected 41 bytes). Only wording, provenance, and fixture assertions change: the 38 TCs, 23 ACs, 11 NFRs, condition ids/order, rank order, and every existing expected verdict are unchanged. The gap/open-question register stays closed; plan-side R-32/R-34 alignment is a `delivery_planning` follow-up and does not reopen any TC.

## 2. References

- **Change specification**: [chg-GH-176-spec.md](./chg-GH-176-spec.md) — spec v1.8 (documented history §25); F-1..F-17, AC-F1-1..AC-F17-1 (**23 criteria** across F-1..F-17, including AC-F2-3 candidate identity, AC-F4-2 relation-target identity, and AC-F12-2 provider-derived output caps), NFR-1..NFR-11, DM-1..DM-13, RSK-1..RSK-14, DEC-1..DEC-19, OQ-1..OQ-8, §8.3 identity rule (candidate observation scoped to the requested candidate set, `blocked-by` targets scoped to the observed work-item set), Appendix A (condition matrix), Appendix B (payload shape), Appendix C (constants incl. `QUEUE_READY_REASON_ORDER`, `QUEUE_READY_PAYLOAD_MARKER_REASONS` = `source-truncated`/`value-clamped`, `QUEUE_READY_SOURCE_FAILURE_REASONS`, `QUEUE_READY_ASSOCIATED_COUNT_RANGE`, `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS`, the nine provider-derived caps and `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES`, and `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`; no live-switch constant), Appendix D (evidence vocabulary incl. `value-clamped`), Appendix E (close/rank matrix, identity-aware), Appendix F (human grammar with 32-UTF-8-byte provider segments, 400-UTF-8-byte candidate lines, a 620-UTF-8-byte header-plus-summary budget, and the reverse-rank line-drop fallback), Appendix G (worked examples, identity-aware), Appendix I (documentation impacts). Spec v1.1 closed GAP-2..GAP-10; spec v1.2 applied DoR iteration-1 R-01/R-02/R-04/R-06/R-07/R-10/R-16/R-18/R-19; spec v1.3 applies DoR iteration-2 R-21/R-22/R-24/R-26/R-29 (scoped `available` claim rule with the condition id exempt, provider-agnostic identity resolution, nine output-only provider caps with `value-clamped` and byte-budget reduction, group-5-only failure reasons with an exact group-6 token, and `blocked-by`-only relation projection) without changing scope, condition ids/order, rank order, AC/NFR intent, or boundaries. Spec v1.4 applies DoR iteration-3 R-30/R-31/R-32/R-33/R-34/R-35/R-36 (provider config failure by the read's `reason`, candidate-set-scoped identity observation with observed-set target uniqueness, the total `blocked-by` target count in the deps detail, `entityId`-only projected identities with `systemName` omitted, duplicate refs rejected rather than silently merged, and the 41-byte proxy suffix) under the same constraint. Spec v1.5 applies DoR iteration-4 R-40/R-41/R-42 (exact canonical target match and bare-digit-only bridge; exact canonical match defined as full-value ASCII case-insensitive equality; and the pinned provider config/park failure-identity detail form `failureCode:<code>`, `failureClass:<class>`, or both joined by `; `, never free-form) under the same constraint. Spec v1.6 applies DoR iteration-5 R-44/R-45/R-48/R-49 (AC-F9-1 carries `detail:"chain:<name>"` on the `no-enabled-entry` and `all-entries-parked` case records; the associated-PR same-class tie-break is `entityId` numeric-aware, then `sourceRef`, then `targetRef`, then raw `entityId`, independent of API order; input-grammar validation is separated from observed-identity matching; and AC-F2-1 states the exact evidence cardinality — one record for each of the five non-provider conditions and two for `provider-available`) under the same constraint. Spec v1.7 applies review iteration-1 F-8 as a documentation reconciliation (Appendix B shows each projected relation as `{ relationKind: "blocked-by", target: { entityId } }`). Spec v1.8 applies review iteration-2 F-9 and closes review iteration-1 F-2: `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS` becomes `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (32 UTF-8 bytes including a trailing `+`, no code point split), the header owner/name (128 bytes each) and branch (256 bytes) are byte-capped, a candidate line is at most 400 UTF-8 bytes and header plus summary at most 620 UTF-8 bytes, the machine 65 536-byte bound stays UTF-8, and a defensive reverse-rank line drop marked `+more` replaces any throw for a legal payload; no condition, order, rank, close class, error identity, or boundary changes.
- **Decision records**: [ADR-0003 — OSS Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) (package tiers, runtime-API allowlist); [ADR-0004 — WorkItem activity timestamp additive v1](../../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) and [ADR-0006 — WorkItem custom fields and comment omission representation](../../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) (absence semantics); [ADR-0007 — provider engine v1 placement, fail-loud parks, cost policy](../../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md); [ODR-0003 — CLI command naming v1 lock](../../../decisions/ODR-0003-cli-command-naming-v1-lock.md) (`queue ready` name lock).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden}`, `scripts/checks/*.ts` mutation tests, `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, runtime-API confinement, no ambient reads, `bun:test` authoring.
- **Result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope shape, documented error table, `{0,1,2}` projection, classification chain, sole redaction path, bidirectional sync.
- **Status digest**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — the six fixed sections, the declared signal availability (blocked dependencies and review state unavailable on the GitHub slice), CI classification, provider availability vocabulary, repository binding, HEAD facts, and the local PM-context projection reused by this command.
- **State layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — verified reads and the read-only provider park fold; no write on read.
- **Configuration layer**: [feature-config-layer.md](../../../spec/features/feature-config-layer.md) — the typed `provider` branch, `provider.defaultChain`/`chains`/`entries`, no new keys.
- **Provider client seeds**: [feature-provider-client-seeds.md](../../../spec/features/feature-provider-client-seeds.md) — normalized `WorkItem`/`DeliveryRequest`/`PipelineRun`, relation/label/ref/state fields, GitHub read slice, declared availability.
- **Provider engine**: [feature-provider-engine.md](../../../spec/features/feature-provider-engine.md) — parks, expiry, `parks list`; queue ready is a read-only consumer and never runs the engine.
- **Adapter ports**: [feature-adapter-ports.md](../../../spec/features/feature-adapter-ports.md) and [feature-monorepo-scaffold-toolchain.md](../../../spec/features/feature-monorepo-scaffold-toolchain.md) — subpath/runtime-API boundaries and the test/module inventory.
- **Command registry**: `doc/planning/oss-tooling/cli-command-registry.md` — the M0-S7 `ados queue ready` row, the `queue ready`-before-`queue` documentation note (no rendered help surface), and the M2-S1 extension boundary.
- **Ticket**: GH-176 — M0-S7: queue ready (read-only).
- **Existing mechanisms to reuse**: `tests/fixtures/status/harness.ts` (in-process fact builders, synthetic brand, fixed clock); `tests/golden/helpers.ts` (`runCli`, `SYNTHETIC_BRAND`, buffer sinks); `tests/behaviour/verify-support.ts` (`guardStore` mutation recorder); `tests/fixtures/state/harness.ts` (temp store and verified park-fold helpers); `tests/behaviour/providers/support.ts` (`createFixtureTransport`, throwing-fetch guard); `packages/testkit/src/result-conformance.ts` (`assertEnvelopeContract`); `tests/structure/{status-contract,status-imports,subpaths,content-inventory,cli-edge-seam,error-table}.test.ts`; `tests/structure/inventory.json`; `tests/checks/{error-table-sync,secret-read-boundary,forbidden-literals}.test.ts`; `tests/boundaries/**`; `scripts/checks/{error-table-sync,ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | 1..8 well-formed refs each at most 64 canonical characters return one success payload with canonical `workItemRef` (ASCII-uppercased prefix, digits preserved including leading zeros); a 64-character canonical ref is accepted; zero refs, wrong first positional, 9..32 refs, a malformed ref (including a whitespace-bearing ref, no trimming), an over-length canonical ref (65+), or a duplicate ref detected after canonicalization and rejected, never silently merged, fails as `input.value.rejected` (kind `input`, exit `1`) before any source read; unknown flag or 33 refs (34 positionals) is `fallback.invocation`, exit `1`; `--json` is the only switch and adds no behavior | TC-QREADY-001, TC-QREADY-032, TC-QREADY-033 | Covered |
| AC-F1-2 | Zero writes, fence acquisitions, state mutations, network writes, provider-engine calls, child processes; read-only reads; identical injected inputs yield identical payload and human bytes | TC-QREADY-022, TC-QREADY-023 | Covered |
| AC-F1-3 | A run with one or more failed sources still returns a success envelope with every candidate and exit `0`; source failures are condition evidence, not command failures; at the handler level only grammar rejection (`input.value.rejected`) or containment (`fallback.internal`) produces an error; separately, the existing global parser rejects an unknown flag or an invocation beyond its positional bound with its own `fallback.invocation` envelope (exit `1`), unchanged | TC-QREADY-002, TC-QREADY-033 | Covered |
| AC-F2-1 | Exactly six condition ids in fixed order; one state from the tri-state set; exactly one bounded evidence record for each non-provider condition and exactly two for `provider-available`; `ready` iff all six satisfied; every non-satisfied condition in `blockingConditions` in fixed order with state | TC-QREADY-003, TC-QREADY-024 | Covered |
| AC-F2-2 | Every §8.3/Appendix A condition-derivation cell matches; unobserved/unavailable/failed/unresolved is `unknown`, observed unmet is `unsatisfied`, nothing defaulted | TC-QREADY-004 | Covered |
| AC-F2-3 | A provider-shaped observed `identity.entityId: "176"` observes requested `GH-176` (label/relation conditions evaluated, never `work-item-unobserved`); any other number (`"177"`) leaves it unobserved with `deps-satisfied`/`tier-known`/`no-owner-gate` `unknown`/`work-item-unobserved`; `GH-7` + `PDEV-7` with `"7"` is ambiguous and unobserved for both; `GH-176` vs `"0176"` and `GH-007` vs `"7"` never match (no numeric coercion); an observed exact `gh-176` matches case-insensitively and the exact canonical match wins; matching uses the full value before any output clamp | TC-QREADY-036, TC-QREADY-031 | Covered |
| AC-F3-1 | A ready candidate has no blocking conditions and is `new-start` or `unknown` by association; a candidate with any non-satisfied condition is `ready: false` and names every blocking condition with its state | TC-QREADY-003, TC-QREADY-014, TC-QREADY-028 | Covered |
| AC-F4-1 | Unobserved candidate is `unknown`/`work-item-unobserved` before any relation-signal check, even when relations are also unavailable; observed candidate with relations unavailable is `unknown`/`signal-unavailable` even with zero visible relations; zero targets `satisfied`/`no-blocked-dependencies`; all done/canceled `satisfied`/`dependencies-done`; observed non-done `unsatisfied`/`dependency-open`; unobserved target `unknown`/`dependency-unobserved`; exactly one evidence record, target-derived detail `done:<n>; open:<n>; unknown:<n>` summing to the total `blocked-by` relation target count (observed + unobserved) with no target-ref list or per-target record | TC-QREADY-005 | Covered |
| AC-F4-2 | With relations available, a `blocked-by` target whose full `entityId` equals an observed item's identity (`"179"` vs `"179"`) is observed and its delivery state decides `dependencies-done`/`dependency-open`; a target matching no observed item stays unobserved (`dependency-unobserved`), never assumed done; a bare numeric target digit string carried by more than one observed work item with no exact observed match is ambiguous and unobserved; a canonical-shaped target whose exact identity matches an observed work item that is not a requested candidate (for example target `GH-179` observed as `GH-179` while `GH-179` is not a requested candidate) is observed by exact match; a canonical-shaped target with no matching observed item stays unobserved; a leading-zero mismatch (target `"0179"` vs observed `"179"`) is no match; the target predicate resolves against the observed work-item set, not the requested candidate set, and uses full identity values before any output clamp | TC-QREADY-037, TC-QREADY-005 | Covered |
| AC-F5-1 | PM context missing/malformed `unknown`; no active change `satisfied`/`no-active-change` with detail `repo:local-context`; candidate-as-active `satisfied`/`candidate-is-active` with detail `repo:local-context; candidate-is-active`; another active `unsatisfied`/`other-active-change` with detail `repo:local-context; active-change:<ref>`; never written | TC-QREADY-006 | Covered |
| AC-F6-1 | Exactly one distinct recognized priority label `satisfied` with detail `tier:priority-label; label:<label>`; zero recognized `unknown`/`tier-absent` with detail `tier:priority-label; none`; two or more distinct `unsatisfied`/`tier-conflict` with detail `tier:priority-label; labels:<sorted labels>`; unobserved item is `unknown`/`work-item-unobserved` before any label-signal check; observed item with unavailable labels `unknown`/`signal-unavailable`; no default tier | TC-QREADY-007 | Covered |
| AC-F7-1 | No `hand-back`/`human-input-needed` `satisfied`/`no-owner-labels`; any one or more `unsatisfied`/`owner-labels`; unobserved item is `unknown`/`work-item-unobserved` before any label-signal check; observed item with unavailable labels `unknown`/`signal-unavailable`; `assignee` never a gate signal | TC-QREADY-008 | Covered |
| AC-F8-1 | Only `succeeded` satisfies; `failed`/`pending`/`canceled`/`none` unsatisfied with matching reasons; each `unknown` mode carries exactly one reason — unresolved commit `commit-unresolved`, unattempted read from an unavailable binding `addressing-unresolved`/`remote-unsupported`, unattempted read with no resolvable credential `credential-unavailable`, attempted failure `read-failed` with the safe `failureCode`/`failureClass` and no error row; a raw 20-run page raises payload-level `source-truncated` without changing classification/state/evidence/blocking; no-run and all-skipped never `succeeded` | TC-QREADY-009, TC-QREADY-010, TC-QREADY-035 | Covered |
| AC-F9-1 | Every `provider-available` condition carries exactly two evidence records — the case record first, then `{ source: "provider-config", reason: "engine-not-run" }` with no detail; resolved chain with >=1 enabled unparked entry and no chain park `satisfied` with `{ source: "provider-parks", reason: "no-active-park", detail: "chain:<name>" }`; no enabled entry `unsatisfied` with `{ source: "provider-config", reason: "no-enabled-entry", detail: "chain:<name>" }`; every enabled entry parked `unsatisfied` with `{ source: "provider-parks", reason: "all-entries-parked", detail: "chain:<name>" }`; active chain park `unsatisfied` with `{ source: "provider-parks", reason: "chain-parked", detail: "chain:<name>; until:<expiry or none>; cause:<cause or none>" }`; no declared chain `unknown`/`provider-chain-not-declared`; an unresolved chain `unknown`/`provider-chain-unresolved`, including a config read `{ok:false, reason:"provider-chain-unresolved"}` mapped by the read's reason; a config read `{ok:false, reason:"config-invalid"}` `unknown`/`config-invalid`; park-fold failure `unknown` with `{ source: "provider-parks", reason: "state-unreadable" }`; a config or park failure record carries the read's bounded failure identity in the pinned `failureCode:<code>`, `failureClass:<class>`, or both joined by `; ` detail form (or no `detail` when the read supplies neither), never a free-form detail, while the defensive `ok:true` view and `provider-chain-not-declared` carry no failure detail; engine never called; **no provider evidence record or availability claim uses `available` as a claim or state — the pinned condition id `provider-available`, the condition-id list, `blockingConditions`/human `blocking:` references, payload keys, summary tokens, and close classes are exempt, and every negative scan is scoped to provider evidence/details and the provider human-text segment, never the whole payload or digest**; `engine-not-run` is a reason, not a detail | TC-QREADY-011, TC-QREADY-012, TC-QREADY-021, TC-QREADY-031 | Covered |
| AC-F10-1 | Source branch with >=3 segments and an exact case-insensitive ref segment is associated; `merge-ready` only for a non-draft associated PR with review signal available and observed `approved`; any other associated open PR `review-pending` (including draft/unknown review); the delivered command read is open-only, so below the page limit with no open match it yields `not-associated`/`pr-not-associated` (never `pr-not-open`), with the not-associated fallback class (`new-start` when ready, else `not-ready`); failed read/unavailable binding/at-limit no-match `unknown` with `pr-association-unknown`; in an evaluator-injected normalized view a matching merged/closed object is never selected, counted, or an open close item, and a below-limit view with only merged/closed matches yields `not-associated`/`pr-not-open` with the same fallback, while the at-limit rule still yields `unknown`; `associatedCount` is an integer in `0..100` counting open matches only, exact below the limit, page-bounded at the limit, 0 on failed read/unavailable binding; the selected PR is deterministic within one close class (the merge-ready set when non-empty, otherwise the associated set) by `entityId` ascending numeric-aware (equal all-digit values tie at this key, otherwise lexical), then `sourceRef` ascending, then `targetRef` ascending, then the lexically smaller raw `entityId` only when all three keys are equal, independent of API order | TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-016 | Covered |
| AC-F11-1 | Order is `merge-ready`, `review-pending`, `new-start`, `unknown`, `not-ready`; within a class numeric ref suffix ascending then canonical ref text ascending; no close item below a ready new start; `rank` is 1-based; caller/API order never affects the result | TC-QREADY-017 | Covered |
| AC-F12-1 | `--json` success is exactly one valid envelope whose `data` has `schemaVersion: delivery.queue-ready.v1`, `generatedAt`, `repository`, `head`, ranked candidates with six conditions and close data, `summary`, `reasons`, `truncated`; `reasons` is unique, follows `QUEUE_READY_REASON_ORDER` (six groups, group 2 = `source-truncated` then `value-clamped`, group 6 = exactly `pr-association-unknown` and last), and is at most six entries; serialized `data` <=64 KiB; no `error` key; no raw payload or secret | TC-QREADY-018, TC-QREADY-019, TC-QREADY-024, TC-QREADY-034 | Covered |
| AC-F12-2 | Over-cap provider-derived fields are projected within the caps: every projected provider-qualified identity is `entityId` only with no `systemName` (the whole identity object is the capped `entityId`), identity/ref/label <=128 chars, labels <=16 in provider order, `blocked-by` relations <=16 in provider order with every other relation kind absent (not clamped), owner/name <=128, head branch <=256, `updatedAt` <=40; payload `truncated: true` with `value-clamped` immediately after `source-truncated` when both are present and in the group-2 position otherwise; condition states, `blockingConditions`, `closeClass`, ranks, and summary counts equal the same full values without caps; `data` <=65 536 UTF-8 bytes (unchanged by the human rule) and human digest <=16 lines/4096 UTF-8 bytes; an over-budget capped projection drops trailing relations then labels in the pinned order with the same markers and no verdict change | TC-QREADY-038, TC-QREADY-019, TC-QREADY-020, TC-QREADY-024, TC-QREADY-029, TC-QREADY-035 | Covered |
| AC-F13-1 | Human mode is a deterministic digest: optional header, one summary line, one line per candidate in rank order, naming ref/close class/close evidence/blocking condition ids+states (both for a close item that is not ready), and ending every candidate line with the fixed proxy-source suffix `[repo:local-context; tier:priority-label]`; every per-candidate provider segment (`PR #<entityId>`, source ref) is at most 32 UTF-8 bytes including a trailing `+` when shortened (the `+` counts toward the cap and no code point is split); header owner/name render at most 128 UTF-8 bytes each and branch at most 256 UTF-8 bytes, each with a trailing `+` when shortened; a candidate line is at most 400 UTF-8 bytes and header plus summary at most 620 UTF-8 bytes; the digest is <=16 lines and 4096 UTF-8 bytes for every legal payload; an 8-candidate legal worst case (astral 256-code-point head branch plus in-cap multi-byte PR `entityId`/`sourceRef`) still exits `0` with no `fallback.internal` and no throw; a legal payload that would still exceed 4096 bytes after every renderer cap drops trailing candidate lines in reverse rank order (last-ranked first), keeps the header (when present) and summary, marks the drop `+more`, and adds no reason token or payload-field change; no titles/timestamps/raw payloads/secrets/LLM prose; zero extra reads | TC-QREADY-020, TC-QREADY-019, TC-QREADY-029, TC-QREADY-035, TC-QREADY-038 | Covered |
| AC-F14-1 | The full negative-control matrix (22 named controls) is asserted per control on its targeted condition/source: no targeted absent, failed, unattempted, unavailable, or unresolved readiness source yields `satisfied`; a non-satisfied readiness condition never yields a `ready` claim; the PR-read-failure and at-limit-no-match controls keep all six conditions satisfied and yield `ready: true` with close class `unknown` (never `new-start`); the binding-unavailable control yields unknown tracker/CI conditions and unknown close association and is not ready; no control yields `merge-ready` without an observed approval on a non-draft open PR or an all-clear; every control is reflected in the condition state and reason; the command still exits `0` | TC-QREADY-004, TC-QREADY-021 | Covered |
| AC-F15-1 | Structure/boundary/ambient/forbidden-literal/privacy/secret-read gates green; contracts/domain import only contracts; no new package/subpath/runtime-API location or secret-read entry; no product literal; delivered reads reused without a new operation; no writes/fences | TC-QREADY-022, TC-QREADY-025, TC-QREADY-026 | Covered |
| AC-F16-1 | No new error-table row or domain kind; evidence uses the closed readiness reason vocabulary and never an error identity as a failure class; handler failures only `input.value.rejected`/`fallback.internal`; two-way sync and classification tests green | TC-QREADY-027 | Covered |
| AC-F17-1 | Committed corpus produces every condition state, close class, rank rule, bound, identity-resolution cell, provider-cap/clamp case, pinned reason/flag/evidence rule, and Appendix G worked example with zero live calls; opt-in live smoke asserts structural invariants only (one payload, six conditions per candidate, at least one known candidate observed through the §8.3 identity rule, no ready-with-non-satisfied, no merge-ready without observed approval, no provider evidence record or availability claim using `available` beyond the exempt condition id, ordered reasons, bounds, no secrets), never pins volatile counts; artifact bounded and secret-free; the switch is the test-harness literal `ADOS_QUEUE_READY_LIVE`, bound only in `tests/fixtures/queue-ready/harness.ts`, read only under `tests/**`, enabled only when exactly `1`, never a production/contract constant (`QUEUE_READY_LIVE_ENV` is not declared), and absent from production edges/config/payload/human text | TC-QREADY-028, TC-QREADY-029, TC-QREADY-030, TC-QREADY-031, TC-QREADY-036, TC-QREADY-037, TC-QREADY-038 | Covered |

**Capability coverage** (no capability left unlinked): F-1 -> TC-QREADY-001, TC-QREADY-033; F-2 -> TC-QREADY-003, TC-QREADY-032, TC-QREADY-036; F-3 -> TC-QREADY-003, TC-QREADY-004; F-4 -> TC-QREADY-005, TC-QREADY-037; F-5 -> TC-QREADY-006; F-6 -> TC-QREADY-007; F-7 -> TC-QREADY-008; F-8 -> TC-QREADY-009, TC-QREADY-010, TC-QREADY-035; F-9 -> TC-QREADY-011, TC-QREADY-012; F-10 -> TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-016; F-11 -> TC-QREADY-017; F-12 -> TC-QREADY-018, TC-QREADY-019, TC-QREADY-034, TC-QREADY-038; F-13 -> TC-QREADY-020; F-14 -> TC-QREADY-004, TC-QREADY-021; F-15 -> TC-QREADY-002, TC-QREADY-025; F-16 -> TC-QREADY-022, TC-QREADY-023, TC-QREADY-025, TC-QREADY-026, TC-QREADY-027; F-17 -> TC-QREADY-028, TC-QREADY-029, TC-QREADY-030, TC-QREADY-031.

**TC -> AC traceability**: every scenario's `Related IDs` line and the Scenario Index (§5.1) carry the reverse direction; the table above carries the forward direction. All **23 AC criteria** are covered (AC-F1-1..AC-F17-1 across 17 capabilities) by **38 scenarios** (TC-QREADY-001..038); there is no deferred AC, no uncovered AC, and no orphan TC.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no `API-#` or `EVT-#` identifiers and no HTTP endpoint or event (Section 8.1/8.2). The machine data-model surface is DM-1..DM-13; each is mapped below.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| DM-1 — `QueueReadyPayload` | `schemaVersion`, injected `generatedAt`, `repository`, `head`, ranked `candidates`, `summary`, `reasons` (unique, six-group order with group 2 = `source-truncated` then `value-clamped` and group 6 = exactly `pr-association-unknown`, first occurrence, <=6, overflow sets payload `truncated`), `truncated`; success `data`; no `error` on success | TC-QREADY-018, TC-QREADY-019, TC-QREADY-034, TC-QREADY-038 | Covered |
| DM-2 — `QueueReadyCandidate` | `workItemRef` (canonical, <=64 chars), 1-based `rank`, `ready`, `closeClass`, `workItem` observation (observed only when the §8.3 identity rule matches; no title, body, comment, or assignee; <=16 capped labels, capped `updatedAt`, and only <=16 capped `blocked-by` relations whose target is an `entityId`-only provider-qualified identity with no `systemName` and the whole target object <=128 chars), `close`, six `conditions`, `blockingConditions`, `truncated` | TC-QREADY-003, TC-QREADY-018, TC-QREADY-036, TC-QREADY-038 | Covered |
| DM-3 — `QueueReadyCondition` | Six fixed ids/order, one tri-state state, exactly one evidence record for each non-provider condition and exactly two for `provider-available` (case record then the `engine-not-run` companion); the <=2 cap is a defensive bound | TC-QREADY-003, TC-QREADY-004, TC-QREADY-011, TC-QREADY-012, TC-QREADY-024 | Covered |
| DM-4 — `QueueReadyEvidence` | `{source, reason, detail?}` with closed source/reason vocabularies and <=160-character safe detail; `engine-not-run` is a reason, never a detail; no raw payload | TC-QREADY-011, TC-QREADY-019, TC-QREADY-021, TC-QREADY-034 | Covered |
| DM-5 — `QueueReadyCloseClass` | Closed five-value class and precedence; `merge-ready` only with observed approval on a non-draft PR | TC-QREADY-014 | Covered |
| DM-6 — `QueueReadyClose` | `association` (`associated`/`not-associated`/`unknown`), `associatedCount` (`0..100`, open matches only, exact below the limit, page-bounded at it, 0 on failed read/unavailable binding), optional selected PR (its projected identity is `entityId`-only with no `systemName`; `entityId` <=128, the whole identity object), `sourceRef`/`targetRef` <=128 projection caps while association/selection use the full refs, same-class selection within the merge-ready set when non-empty (otherwise the associated set) by `entityId` ascending numeric-aware (equal all-digit values tie), then `sourceRef`, then `targetRef`, then the lexically smaller raw `entityId`, never API order, `draft`, `reviewStateObserved`, `reviewState?`), reason (`pr-associated`/`pr-not-associated`/`pr-not-open`/`pr-association-unknown`); the command-level open-only read never emits `pr-not-open`, which is an evaluator-injected merged/closed-only rule | TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-016, TC-QREADY-038 | Covered |
| DM-7 — Ranking | Class rank 0..4; numeric suffix ascending then canonical ref text ascending; 1-based rank; order independence | TC-QREADY-017 | Covered |
| DM-8 — `QueueReadySummary` | `candidates`, `ready`, `notReady`, `mergeReady`, `reviewPending`, `newStart`, `unknownClose` computed from the rendered set | TC-QREADY-018 | Covered |
| DM-9 — `QueueReadyRepository` | observed `{host, owner, name, remoteName}` with owner/name <=128 projection caps (addressing uses the full values), or unavailable `{reason}`; no userinfo/credential/raw remote URL | TC-QREADY-018, TC-QREADY-021, TC-QREADY-038 | Covered |
| DM-10 — Readiness reasons | Closed evidence vocabulary (41 tokens, now including `value-clamped`); unique per condition; not an error table; `source-truncated`/`value-clamped` are payload-level only and never condition/close evidence; top-level membership/order per DM-1 | TC-QREADY-021, TC-QREADY-024, TC-QREADY-034, TC-QREADY-035 | Covered |
| DM-11 — Bounds | <=8 refs, each canonical ref <=64 chars, 6 conditions, <=2 evidence (delivered set: one per non-provider condition, two for `provider-available`), <=6 reasons, <=160 detail, <=64 KiB `data`, <=16 lines/4096 UTF-8 bytes human (<=400 UTF-8 bytes per candidate line, <=620 UTF-8 bytes header plus summary, and the reverse-rank line-drop fallback), `associatedCount` 0..100; **provider-derived caps** every projected identity is `entityId`-only with no `systemName` (the whole identity object <=128), ref/label/owner/name <=128, labels <=16, `blocked-by` relations <=16 (other kinds filtered), branch <=256, timestamp <=40, human segment <=32 UTF-8 bytes including a trailing `+`, header owner/name <=128 UTF-8 bytes each and branch <=256 UTF-8 bytes; every clamp/reduction sets payload `truncated` + `value-clamped` and never changes a verdict; the exact truncation-flag scope (evidence-cap: candidate+payload; reason-cap/source-at-limit/clamp/byte-budget: payload only; detail clamp: none); no title cap because no title is carried | TC-QREADY-019, TC-QREADY-020, TC-QREADY-035, TC-QREADY-038 | Covered |
| DM-12 — Human digest | Appendix F grammar; <=16 lines/4096 UTF-8 bytes for every legal payload; derived only from the payload; every candidate line ends with `[repo:local-context; tier:priority-label]`; each per-candidate provider segment (PR identity, source ref) is byte-capped at 32 UTF-8 bytes including a trailing `+` when shortened with no code point split; header owner/name are byte-capped at 128 UTF-8 bytes each and branch at 256 UTF-8 bytes; a candidate line is at most 400 UTF-8 bytes and header plus summary at most 620 UTF-8 bytes; if a legal payload still exceeds 4096 bytes the renderer drops trailing candidate lines in reverse rank order, keeps the header/summary, marks `+more`, and never throws or exits non-zero; no titles/timestamps/secrets/LLM; these are renderer rules only and change no payload field | TC-QREADY-020, TC-QREADY-029, TC-QREADY-038 | Covered |
| DM-13 — Schema version | `QUEUE_READY_SCHEMA_VERSION = "delivery.queue-ready.v1"`, additive within v1 | TC-QREADY-018, TC-QREADY-024 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Readiness totality: 6/6 conditions, 3/3 valid states, 100% evidence presence, 100% readiness equivalence, 100% blocking disclosure, 0 missing/extra; candidate observation and target resolution use the §8.3 identity rule so an observable item is never silently unobserved | TC-QREADY-003, TC-QREADY-004, TC-QREADY-024, TC-QREADY-036, TC-QREADY-037 | Covered |
| NFR-2 | Output bounds: <=8 refs (over-cap rejected), each canonical ref <=64 chars (over-length rejected), <=8 candidates, 6 conditions, <=2 evidence, <=160 detail, provider-derived identity `entityId`-only with no `systemName` (the whole identity object <=128) / ref <=128 / label <=128 / labels <=16 / `blocked-by` relations <=16 (other kinds filtered) / owner <=128 / repo name <=128 / branch <=256 / timestamp <=40 / human segment <=32 UTF-8 bytes including a trailing `+` / header owner/name <=128 UTF-8 bytes each / header branch <=256 UTF-8 bytes, <=64 KiB `data`, <=16 lines/4096 UTF-8 bytes (<=400 UTF-8 bytes per candidate line, <=620 UTF-8 bytes header plus summary, reverse-rank line-drop fallback never throwing), `associatedCount` 0..100, and 100% of drop/limit/clamp cases marked with the exact flag scope (evidence-cap: candidate+payload; reason-cap/source-at-limit/clamp/byte-budget: payload only; detail clamp: none) | TC-QREADY-018, TC-QREADY-019, TC-QREADY-020, TC-QREADY-034, TC-QREADY-035, TC-QREADY-038 | Covered |
| NFR-3 | Truthfulness: 0 false satisfied/ready, 0 merge-ready without observed approval, 0 close items below a ready new start, 0 unknown association as new-start, 0 deps satisfied from an unavailable/absent source, 0 provider evidence/availability claims using `available` (the pinned condition id and its condition-id/`blocking:` references are exempt; scans are scoped to provider evidence/details and the provider human-text segment), 0 engine-verified claims, 0 no-run/pending/failed-read CI satisfied | TC-QREADY-004, TC-QREADY-005, TC-QREADY-006, TC-QREADY-007, TC-QREADY-008, TC-QREADY-009, TC-QREADY-010, TC-QREADY-011, TC-QREADY-012, TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-021, TC-QREADY-036, TC-QREADY-037 | Covered |
| NFR-4 | Read-only/determinism: 0 writes, fences, state mutations, network writes, provider-engine calls, child processes; 0 payload/human drift on identical inputs | TC-QREADY-017, TC-QREADY-022, TC-QREADY-023 | Covered |
| NFR-5 | Read cost: <=3 outbound GitHub reads, exactly 1 logical park-fold read, <=1 config resolve, <=1 local-context read, 0 quota fetches, 0 retries/loops | TC-QREADY-011, TC-QREADY-030 | Covered |
| NFR-6 | Output contract: 100% one valid envelope for `--json`, 100% one summary line plus one line per candidate for human, 0 extra render reads, 0 handler-level command failures outside `input.value.rejected`/`fallback.internal`, and the existing global parser `fallback.invocation` envelope unchanged/separate | TC-QREADY-001, TC-QREADY-002, TC-QREADY-020, TC-QREADY-028, TC-QREADY-032, TC-QREADY-033 | Covered |
| NFR-7 | Boundaries/branding: 0 new packages, subpaths, runtime-API locations, secret-read allowlist entries, product literals; all boundary/ambient/literal gates green | TC-QREADY-025, TC-QREADY-026 | Covered |
| NFR-8 | Error-table stability: 0 new rows/domain kinds, 0 documented-table drift, 0 existing-row changes; sync/classification green | TC-QREADY-027 | Covered |
| NFR-9 | Performance: <=50 ms pure evaluation/ranking/rendering over cap-sized inputs; linear in candidates x conditions x evidence | TC-QREADY-030 | Covered |
| NFR-10 | Privacy: 0 secrets/raw provider payloads in payload/evidence/human; 0 ambient reads outside the allowlist; 0 planted-secret canary escapes | TC-QREADY-006, TC-QREADY-018, TC-QREADY-020, TC-QREADY-022, TC-QREADY-026 | Covered |
| NFR-11 | Real evidence: 100% expected fixture-corpus cases (including GitHub-shaped identity, ambiguous/leading-zero identity, relation-target resolution, and provider-cap/clamp cases), 0 default-CI live calls, 100% pass for opt-in structural live checks, no volatile count pinned | TC-QREADY-028, TC-QREADY-029, TC-QREADY-030, TC-QREADY-031, TC-QREADY-036, TC-QREADY-037, TC-QREADY-038 | Covered |

All eleven NFRs are covered. No NFR is marked TODO or deferred.

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Behaviour — command surface/grammar | `bun test tests/behaviour/queue-ready-command.test.ts` | `tests/behaviour/queue-ready-command.test.ts`, `tests/fixtures/queue-ready/harness.ts`, `tests/fixtures/queue-ready/refs/cases.ts` | TC-QREADY-001, TC-QREADY-002, TC-QREADY-032, TC-QREADY-033 |
| Behaviour — condition totality/matrix | `bun test tests/behaviour/queue-ready-conditions.test.ts` | `tests/behaviour/queue-ready-conditions.test.ts`, `tests/fixtures/queue-ready/matrix/cases.ts` | TC-QREADY-003, TC-QREADY-004 |
| Behaviour — deps | `bun test tests/behaviour/queue-ready-deps.test.ts` | `tests/behaviour/queue-ready-deps.test.ts`, `tests/fixtures/queue-ready/deps/cases.ts`, reused `tests/fixtures/providers/{github,jira}/**` | TC-QREADY-005 |
| Behaviour — identity resolution | `bun test tests/behaviour/queue-ready-identity.test.ts` | `tests/behaviour/queue-ready-identity.test.ts`, `tests/fixtures/queue-ready/identity/cases.ts` | TC-QREADY-036, TC-QREADY-037 |
| Behaviour — repo/tier/owner | `bun test tests/behaviour/queue-ready-repo-tier-owner.test.ts` | `tests/behaviour/queue-ready-repo-tier-owner.test.ts`, `tests/fixtures/queue-ready/{repo,tier,owner}/cases.ts`, `tests/fixtures/queue-ready/pm-context/*.yaml` | TC-QREADY-006, TC-QREADY-007, TC-QREADY-008 |
| Behaviour — CI | `bun test tests/behaviour/queue-ready-ci.test.ts` | `tests/behaviour/queue-ready-ci.test.ts`, `tests/fixtures/queue-ready/ci/cases.ts`, reused `tests/fixtures/providers/github/check-runs-per-sha.json` | TC-QREADY-009, TC-QREADY-010 |
| Behaviour — provider | `bun test tests/behaviour/queue-ready-provider.test.ts` | `tests/behaviour/queue-ready-provider.test.ts`, `tests/fixtures/queue-ready/providers/**`, `tests/fixtures/state/harness.ts` | TC-QREADY-011, TC-QREADY-012 |
| Behaviour — close classification | `bun test tests/behaviour/queue-ready-close.test.ts` | `tests/behaviour/queue-ready-close.test.ts`, `tests/fixtures/queue-ready/close/cases.ts` | TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-016 |
| Behaviour — ranking | `bun test tests/behaviour/queue-ready-ranking.test.ts` | `tests/behaviour/queue-ready-ranking.test.ts`, `tests/fixtures/queue-ready/ranking/cases.ts` | TC-QREADY-017 |
| Behaviour — output/bounds/reasons/truncation | `bun test tests/behaviour/queue-ready-output.test.ts` | `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/{reasons,bounds,caps}/**`, `packages/testkit/src/result-conformance.ts` | TC-QREADY-018, TC-QREADY-019, TC-QREADY-020, TC-QREADY-034, TC-QREADY-035, TC-QREADY-038 |
| Behaviour — negative controls | `bun test tests/behaviour/queue-ready-negative-controls.test.ts` | `tests/behaviour/queue-ready-negative-controls.test.ts`, `tests/fixtures/queue-ready/negative-controls/cases.ts` | TC-QREADY-021 |
| Behaviour — read-only/determinism | `bun test tests/behaviour/queue-ready-readonly-determinism.test.ts` | `tests/behaviour/queue-ready-readonly-determinism.test.ts`, `tests/fixtures/state/harness.ts`, `tests/behaviour/verify-support.ts`, `tests/golden/helpers.ts` | TC-QREADY-022, TC-QREADY-023 |
| Behaviour — corpus | `bun test tests/behaviour/queue-ready-corpus.test.ts` | `tests/behaviour/queue-ready-corpus.test.ts`, `tests/fixtures/queue-ready/corpus/**` | TC-QREADY-028 |
| Golden | `bun test tests/golden/queue-ready.test.ts` | `tests/golden/queue-ready.test.ts`, `tests/fixtures/queue-ready/golden/{payload.json,human.txt}` | TC-QREADY-029 |
| Behaviour — performance/read cost | `bun test tests/behaviour/queue-ready-performance.test.ts` | `tests/behaviour/queue-ready-performance.test.ts`, `tests/fixtures/queue-ready/bounds/cap-sized/**` | TC-QREADY-030 |
| Behaviour — opt-in live | `ADOS_QUEUE_READY_LIVE=1 bun test tests/behaviour/queue-ready-live.test.ts` | `tests/behaviour/queue-ready-live.test.ts` (skipped unless the switch is exactly `1`) | TC-QREADY-031 |
| Structure — contracts/constants | `bun test tests/structure/queue-ready-contract.test.ts` | `tests/structure/queue-ready-contract.test.ts`, `tests/structure/inventory.json` | TC-QREADY-024 |
| Structure — tier/purity/imports/composition | `bun test tests/structure/queue-ready-imports.test.ts` | `tests/structure/queue-ready-imports.test.ts` (pattern from `status-imports.test.ts`) | TC-QREADY-025, TC-QREADY-026 |
| Structure — subpaths/inventory/edge | `bun test tests/structure/subpaths.test.ts`; `bun test tests/structure/content-inventory.test.ts`; `bun test tests/structure/cli-edge-seam.test.ts` | existing suites extended | TC-QREADY-025 |
| Structure — error table | `bun test tests/structure/error-table.test.ts`; `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | existing suites/check | TC-QREADY-027 |
| Checks — secret/literals | `bun test tests/checks/secret-read-boundary.test.ts`; `bun test tests/checks/forbidden-literals.test.ts` | existing suites | TC-QREADY-026 |
| Boundaries / ambient / entrypoints | `bun test tests/boundaries`; `bun run scripts/checks/{ambient-globals,forbidden-literals,exit-code-literals,workspace-entrypoints}.ts` | existing harnesses; no new rule | TC-QREADY-025, TC-QREADY-026 |
| Aggregate and non-regression | `pnpm check`; `git diff --check`; `git status --porcelain` | repo root | all TCs |

### 4.1 In-Process Queue-Ready Harness Contract (binding for every behaviour TC)

1. **One harness, no spawned processes.** Every behaviour test builds the `queue` command definition with injected dependencies (`brand`, `clock`, `newRunId`, `secrets`, `program`, and the queue-ready read sources) and calls `runCli(argv, streams, deps)` in process, following `tests/golden/helpers.ts` and the `runCli` contract in `packages/cli/src/index.ts`. No queue-ready suite spawns a child process.
2. **Injected reads and time.** The repository binding/HEAD reader, issues reader, PR reader, check-runs reader, provider-config snapshot, verified park-view reader, and local PM-context reader are injected recording functions. The clock, run id, brand, streams, and edge behaviour are injected. No test reads `$HOME`, the wall clock, the real state directory, or the ambient environment where purity is asserted.
3. **Self-materializing fixtures.** Normalized facts are committed under `tests/fixtures/queue-ready/**` or built in a fresh `mkdtemp` root from the state harness; no test writes the live tree, `dist/`, or the real local PM context.
4. **One oracle per case.** Every matrix, close, ranking, corpus, and negative-control case asserts (a) the exact order and state of all six conditions, (b) the exact ordered evidence records (source, reason, and bounded detail — not just a token set), (c) `ready` and the exact `blockingConditions`, (d) `closeClass` and the close/PR fields including `associatedCount` and the association reason, (e) `rank`, (f) the summary counts, and (g) `truncated` on the candidate and payload with the exact flag combination. A case that merely asserts "not ready" is not sufficient.
5. **Recording seams.** Source readers record call order and arguments; the state-store wrapper (reuse `guardStore` from `tests/behaviour/verify-support.ts`) records `read` and throws on `append`/`replaceDocument`/`acquireFence`/`releaseFence`; the provider-engine, `provider resolve`, `provider quota`, and quota-transport seams are counting stubs that throw if called; the transport records every request and throws on an unfixtured URL or a non-`GET` method. A recorder that never observes a read is itself a failure (proved by a positive control).
6. **Fixed output facts.** Where byte equality is asserted, the harness injects a fixed `runId` (for example `run-queue-ready-fixture`), a fixed clock tick (for example `2026-10-31T20:10:00Z`), and a synthetic brand (`tests/golden/helpers.ts`), so the envelope and human text are comparable byte-for-byte.
7. **No handler stream writes.** The queue-ready handler returns data or a classified failure; the CLI edge is the only writer. Tests assert the handler is called through `runCli` and that no write occurs outside the edge's single serialization path.
8. **Grammar before reads.** The harness's recording readers are created with a counter; every grammar-rejection case asserts all source counters are `0` and no file/state read occurs, including the PM-context reader.

### 4.2 Non-Vacuity Contract (binding for every negative, matrix, close, boundary, and read-only scenario)

- Every negative fixture carries a distinctive `planted-queue-ready-*` canary in a provider item title, label, evidence detail, PM-context field, or provider payload; the fixture builder asserts the intended mutation/omission is present before the command runs, and the canary must not appear in stdout, stderr, evidence, or the human digest beyond the allowed bounded/sanitized field. The payload and digest carry no title field, so a title canary must never surface.
- Every negative is paired with a restored-or-valid control that reaches the expected positive state through the same invocation path (for example, the failed PR source restored yields `not-associated`/`new-start`).
- Every condition-`unknown` fixture is paired with a condition-`unsatisfied` fixture, so an implementation cannot collapse "no evidence" into "observed blocked".
- Every association-`unknown` fixture is paired with a below-limit `not-associated` fixture, so an at-limit page cannot be treated as complete.
- Every cap/truncation fixture has an under-cap control and an at-limit/over-cap control in the same test; the under-cap control must not be marked truncated, and the asserted flag combination is exact (evidence-cap: candidate+payload; reason-cap/source-at-limit: payload only; detail clamp: none).
- Every human-bound fixture measures UTF-8 bytes, never characters: the 8-candidate astral worst case (256-code-point head branch plus in-cap multi-byte PR `entityId`/`sourceRef`) must render at most 4096 UTF-8 bytes, exit `0`, and never throw or return `fallback.internal`; a synthetic over-budget payload must exercise the reverse-rank line drop with `+more`, keep the header/summary, and change no payload field or reason token. A test that expects `RangeError`/`fallback.internal` for a legal payload, assumes 32 characters, or assumes an ASCII-only 400-byte line is itself a failure.
- Every top-level reason-order case is evaluated with a scrambled read order, scrambled condition evidence order, and a duplicate outcome, so an implementation that emits first-seen or unordered reasons fails; a verdict reason (`ci-pending`, `tier-conflict`, `dependency-open`, `pr-not-open`, and friends) leaking into top-level `reasons` fails.
- Every all-clear/`available` negative scan is satisfiable and scoped: it inspects the affected condition's evidence records/details and the corresponding human segment, never the whole payload or digest; the pinned condition id `provider-available`, the condition-id list, `blockingConditions`/`blocking:` lines, payload keys, summary tokens, and close classes (`merge-ready`, `not-ready`) are explicitly allowed. A hand-planted forbidden claim in the scoped surface (for example a provider detail saying `provider available`) must fail by name; the unmutated control must pass.
- Every identity-resolution fixture uses a provider-shaped `identity.entityId` (`"176"`, `"179"`, `"7"`, `"0176"`) with a canonical requested ref (`GH-176`, `GH-179`, `GH-7`/`PDEV-7`, `GH-007`); a fixture that only succeeds with a GH-shaped `entityId` is a failure. Exact-match, bare-number, wrong-number, ambiguous-suffix, and leading-zero cases are asserted together, and the relation-target twin repeats them for `blocked-by`. Candidate observation is candidate-set-scoped: a bare numeric id whose suffix is carried by more than one requested candidate leaves the item unobserved for every sharing candidate, with no precedence and no caller-order tie-break; `blocked-by` target resolution uses the observed work-item set as its uniqueness domain, including a canonical-shaped target observed as an exact match even when that ref is not a requested candidate.
- Every provider case asserts the ordered two-record pairing (case record then `{ source: "provider-config", reason: "engine-not-run" }`) and fails on a missing companion, a reordered pair, or `engine-not-run` used as a detail.
- Every projected provider-qualified identity (each `blocked-by` relation target and the selected pull request) is asserted to be `entityId`-only with no `systemName` key, including an over-long `systemName` fixture whose value never enters the payload or human digest; the identity cap applies to the whole projected object (`entityId`).
- Every close-counter case asserts `associatedCount` against a hand-computed open-match count and against the page-limit lower bound, and asserts a merged/closed-only page yields `pr-not-open` below the limit and `pr-association-unknown` at the limit.
- Every read-only assertion is paired with a seeded-write control that the guarded store/transport detects; every no-engine/no-quota assertion is paired with a counting stub that is proven live by a deliberate call in the control.
- Every structure/mutation test runs on in-memory values or temp copies; the live tree is never written, and the unmutated control is green in the same test.

### 4.3 Default-CI vs Opt-In Live Split

| Suite | Runs in default CI / `pnpm check` | Network | Credential | Assertion style |
|-------|-----------------------------------|---------|------------|-----------------|
| All structure, behaviour, golden, matrix, close, ranking, bounds, negative-control, corpus, and performance suites | Yes | None (injected fixtures/transport recorder) | None | Exact states, reasons, bounds, bytes |
| `tests/behaviour/queue-ready-live.test.ts` | **No** — auto-skipped unless the switch is exactly `1` | One read-only run against this repository's GitHub slice | A resolvable GitHub credential through the injected port | Structural invariants only; no volatile counts pinned |
| `ADOS_QUEUE_READY_LIVE=1 bun test tests/behaviour/queue-ready-live.test.ts` | Opt-in, run once in the PR environment when a credential is available | Same | Same | Same |

The live switch is the test-harness literal `ADOS_QUEUE_READY_LIVE`, bound only by `tests/fixtures/queue-ready/harness.ts` and read only under `tests/**`; the suite is enabled only when its value is exactly `1`. It is not a production or contract constant (`QUEUE_READY_LIVE_ENV` is not declared), is not referenced from `packages/**`, is not a configuration key, and never appears in the payload, evidence, or human text (F-17, DEC-17). The live suite is intentionally outside `pnpm check` and default CI.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|-------|-------|------|--------|----------|----------|
| TC-QREADY-001 | Command grammar: 1..8 refs, rejection before reads, parser fallback, `--json` only | Happy Path | Critical | High | AC-F1-1 |
| TC-QREADY-002 | Source failures remain one success envelope and exit 0 | Corner Case | Critical | High | AC-F1-3 |
| TC-QREADY-003 | Six-condition totality, tri-state, ready equivalence, blocking disclosure | Happy Path | Critical | High | AC-F2-1, AC-F3-1, NFR-1 |
| TC-QREADY-004 | Condition derivation matrix cell-by-cell (provider-shaped observed ids) | Regression | Critical | High | AC-F2-2, AC-F14-1, NFR-1, NFR-3 |
| TC-QREADY-005 | `deps-satisfied`: unavailable/unobserved/done/open targets (provider-shaped target ids) | Corner Case | Critical | High | AC-F4-1, AC-F4-2, NFR-3 |
| TC-QREADY-006 | `repo-free`: local PM context, never "free" from absence | Corner Case | Critical | High | AC-F5-1, NFR-3, NFR-10 |
| TC-QREADY-007 | `tier-known`: exactly one priority label, absent/conflict | Corner Case | Critical | High | AC-F6-1, NFR-3 |
| TC-QREADY-008 | `no-owner-gate`: declared owner labels only, assignee ignored | Corner Case | Critical | High | AC-F7-1, NFR-3 |
| TC-QREADY-009 | `ci-healthy`: result classification, only `succeeded`, 20-run page verdict-neutral | Regression | Critical | High | AC-F8-1, NFR-3 |
| TC-QREADY-010 | `ci-healthy`: each `unknown` reason — unresolved, unattempted, credential, read-failed | Negative | Critical | High | AC-F8-1, NFR-3 |
| TC-QREADY-011 | `provider-available`: satisfied path, exact two-record evidence, no engine call, scoped `available` scan | Happy Path | Critical | High | AC-F9-1, NFR-3, NFR-5 |
| TC-QREADY-012 | `provider-available`: no entry/all parked/chain park/config-by-reason or fold failure, exact case record | Negative | Critical | High | AC-F9-1, NFR-3 |
| TC-QREADY-013 | Close association by branch convention, at-limit unknown, evaluator-injected `pr-not-open` | Corner Case | Critical | High | AC-F10-1, NFR-3 |
| TC-QREADY-014 | Close classification: merge-ready/review-pending/new-start/unknown/not-ready | Regression | Critical | High | AC-F10-1, NFR-3 |
| TC-QREADY-015 | Association unknown sources never become new-start | Negative | Critical | High | AC-F10-1, AC-F14-1, NFR-3 |
| TC-QREADY-016 | Deterministic PR selection (`entityId`→`sourceRef`→`targetRef`→raw `entityId`), merged/closed exclusion, `associatedCount` | Regression | Critical | High | AC-F10-1, NFR-3 |
| TC-QREADY-017 | Ranking and numeric-aware tie-breakers | Regression | Critical | High | AC-F11-1, NFR-4 |
| TC-QREADY-018 | Machine payload: one envelope, schema, closed vocabularies | Happy Path | Critical | High | AC-F12-1, NFR-2, NFR-5, NFR-10 |
| TC-QREADY-019 | Payload bounds, provider-derived caps, and truncation | Regression | Critical | High | AC-F12-1, AC-F12-2, NFR-2 |
| TC-QREADY-020 | Human digest grammar and byte-aware UTF-8 bounds (segments, header, line drop) | Happy Path | Critical | High | AC-F13-1, AC-F12-2, NFR-2, NFR-6 |
| TC-QREADY-021 | Exhaustive negative-control matrix | Negative | Critical | High | AC-F14-1, NFR-3 |
| TC-QREADY-022 | Read-only execution: zero writes/fences/mutations/network writes/spawns/engine | Regression | Critical | High | AC-F1-2, NFR-4, NFR-10 |
| TC-QREADY-023 | Determinism and byte-identical replay | Regression | Critical | High | AC-F1-2, NFR-4 |
| TC-QREADY-024 | Declared constants and closed vocabularies | Regression | Critical | High | AC-F2-1, AC-F12-1, NFR-1, NFR-2 |
| TC-QREADY-025 | Tier, purity, composition, no new package/subpath/runtime-API, exact public export surface | Regression | Critical | High | AC-F15-1, NFR-7 |
| TC-QREADY-026 | Brand neutrality, no product literals, secret-read allowlist | Regression | Critical | High | AC-F15-1, NFR-7, NFR-10 |
| TC-QREADY-027 | Error-table stability and evidence/identity discipline | Regression | Critical | High | AC-F16-1, NFR-8 |
| TC-QREADY-028 | Fixture corpus completeness and Appendix G worked examples | Regression | Critical | High | AC-F17-1, NFR-6, NFR-11 |
| TC-QREADY-029 | Golden payload and human bytes over the corpus, canonical DM-1/DM-2 validity | Regression | Important | High | AC-F17-1, NFR-2, NFR-11 |
| TC-QREADY-030 | Performance and read-cost bounds | Regression | Important | High | NFR-5, NFR-9, AC-F17-1, NFR-11 |
| TC-QREADY-031 | Opt-in live structural smoke | Regression | Important | Medium | AC-F17-1, AC-F2-3, AC-F9-1, NFR-11 |
| TC-QREADY-032 | Ref canonicalization, leading zeros, duplicate-after-canonicalization, no discovery | Corner Case | Important | High | AC-F1-1, NFR-6 |
| TC-QREADY-033 | Edge exit projection and stream discipline | Corner Case | Critical | High | AC-F1-1, AC-F1-3, NFR-6 |
| TC-QREADY-034 | Top-level `reasons`: six-group order, first-occurrence dedup, cap-6 overflow | Regression | Critical | High | AC-F12-1, NFR-2 |
| TC-QREADY-035 | Truncation flag scope, CI at-limit payload marker, pinned reduction order, inert human line drop | Regression | Critical | High | AC-F8-1, AC-F12-1, AC-F12-2, NFR-2 |
| TC-QREADY-036 | Candidate identity resolution: exact, bare-number bridge, wrong number, ambiguous suffix, leading zeros | Corner Case | Critical | High | AC-F2-3, AC-F17-1, NFR-1, NFR-3 |
| TC-QREADY-037 | `blocked-by` target resolution: exact, bare-number bridge, unobserved, ambiguous, leading zeros | Corner Case | Critical | High | AC-F4-2, AC-F17-1, NFR-3 |
| TC-QREADY-038 | Provider-derived caps: nine caps, output-only clamps, `value-clamped`, byte-budget reduction, `blocked-by`-only projection | Regression | Critical | High | AC-F12-2, AC-F13-1, AC-F17-1, NFR-2 |

All **38 TCs** are automated. TC-QREADY-031 is opt-in automated (skipped unless `ADOS_QUEUE_READY_LIVE` is exactly `1`) and manual-when-invoked. Every TC is non-vacuous per §4.2; the controls are named in each scenario.

### 5.2 Scenario Details

#### TC-QREADY-001 - Command grammar: 1..8 refs, rejection before reads, parser fallback, `--json` only

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DEC-1, DEC-15, AC-F1-1, NFR-6
**Test Type(s)**: Unit, Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-command.test.ts`, `tests/fixtures/queue-ready/harness.ts`, `tests/fixtures/queue-ready/refs/cases.ts`
**Tags**: @backend @cli

**Given** the composed program registers `queue` with the `ready` subcommand positional, `positionals.max = 33`, no command-specific flags, and a runtime whose every source reader increments a counter,
**When** `runCli` is invoked with valid, invalid, and parser-level malformed argument vectors,
**Then** the handler accepts 1..8 well-formed refs and rejects every other handler-level case as `input.value.rejected` before any source read, while the global parser keeps `fallback.invocation` for unknown flags and invocations beyond its hard positional bound.

**Preconditions**:

- The `queue` command definition is composed with injected recording readers (repository, issues, PRs, check-runs, provider config, parks, local context), a fixed brand/clock/run id, and buffer streams.
- A fully-satisfiable fixture reaches one success payload; the ref grammar is `QUEUE_READY_WORK_ITEM_REF_PATTERN` (`^[A-Za-z][A-Za-z0-9]*-[0-9]+$`), and the canonical ref cap is `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS` (64).
- The parser program includes `queue` with `ready` as the first positional and the global `--json` switch.

**Steps**:

1. Given `["queue","ready","GH-175"]`, when run, then assert exit `0`, exactly one success envelope, `data.schemaVersion === "delivery.queue-ready.v1"`, one candidate, and every source reader that the fixture declares was called exactly as expected.
2. Given ref lists of length 1, 2, 8 (the cap) with well-formed refs, when run, then assert success and `data.candidates.length` equals the ref count with the canonical refs present.
3. Given each handler-level invalid case — zero refs (`["queue","ready"]`), wrong first positional (`["queue","create","GH-1"]`, `["queue"]`), 9 refs, 32 refs, malformed refs (`gh`, `176`, `GH-`, `GH-17a`, `-GH-176`, `GH--176`, ` GH-176`, `GH-176 `, `GH 176`, `GH-176\t`), a canonical ref of 65 or more characters, and duplicate refs detected after canonicalization and rejected, never silently merged (`GH-176 GH-176`, `gh-176 GH-176`, `GH-176 gh-176`, `GH-007 gh-007`) — when run, then assert `error.kind === "input"`, `error.code === "input.value.rejected"`, exit `1`, no `data`, and every source-read counter (repository, issues, PRs, check-runs, config, parks, local context) is `0`. No whitespace is accepted or trimmed.
4. Given a canonical ref of exactly 64 characters (`A...A-1` with a 62-character prefix), when run against the fixture, then assert it is accepted, `data.candidates[0].workItemRef` is the same 64-character canonical ref, and the run succeeds; the neighbouring 63-character control also succeeds. The 65-character case in step 3 is rejected before any read.
5. Given 33 refs after the subcommand (34 positionals: `ready` + 33 refs, one beyond the parser maximum of 33) or an unknown flag (`["queue","ready","GH-1","--limit","2"]`, `["queue","ready","--json","--limit","2"]`), when run, then assert `error.code === "fallback.invocation"`, exit `1`, no `data`, and zero source reads.
6. Given `--json` placed before and after the refs (`["queue","ready","--json","GH-1"]`, `["queue","ready","GH-1","--json"]`), when run with the fixture, then assert both succeed and produce the same `data` (envelope timing aside) and no command-specific flag is declared; `--json` adds no command behavior. If the parser accepts only one placement, assert that placement and record it as delivery-bound (the spec pins the switch, not its position).
7. Given a handler invocation with throwing stdout/stderr sinks and a valid grammar, when the handler returns, then assert it returns `{data}` or `{error}` and performs no stream write and chooses no exit code; the edge is the only writer.
8. Given the command registry documentation and the command module doc comment, when reviewed, then assert they name `queue ready` as the M0-S7 ready-set and state that lanes/dispatch arrive in M2-S1 without presenting the partial family as a defect; the delivered CLI has no rendered help surface and this change adds none, so this is a documentation/registry assertion, not a rendered descriptor (spec §8.5).
9. Positive control: after every rejected invocation in the same test, when a valid invocation runs, then assert exit `0` and one payload, proving the rejections did not poison the harness.

**Expected Outcome**:

- 1..8 well-formed refs each at most 64 canonical characters return one payload with canonical refs; a 64-character canonical ref is accepted and 65 or more is rejected as `input.value.rejected` before any read; zero refs, wrong subcommand, 9..32 refs, malformed refs (including any whitespace-bearing ref), and duplicates after canonicalization are rejected, never silently merged, as `input.value.rejected` (kind `input`, exit `1`) with zero source reads; 33 refs (34 positionals) and unknown flags remain `fallback.invocation`; `--json` changes only serialization; the handler is write-free and exit-free; the command registry and module doc comment mark the partial `queue` family; the delivered CLI has no rendered help surface.

#### TC-QREADY-002 - Source failures remain one success envelope and exit 0

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, F-15, AC-F1-3, NFR-3, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-command.test.ts`, `tests/fixtures/queue-ready/corpus/source-failures-degraded/case.json`
**Tags**: @backend

**Given** a run in which the repository binding is unavailable, the provider config is invalid, and the park fold fails, while the local PM context is observed,
**When** `queue ready --json` evaluates one or more candidates,
**Then** it returns a success envelope with every candidate and exit `0`; the affected conditions are `unknown` with named evidence and the remaining conditions are as observed.

**Preconditions**:

- The `source-failures-degraded` fixture: binding unavailable, so issues/PRs/check-runs reads are unattempted (never a `read-failed`), config `config-invalid`, parks `state-unreadable`, local PM context observed with no active change.
- `assertEnvelopeContract` from `packages/testkit/src/result-conformance.ts`.
- A throwing-handler containment control and a fully-satisfiable control.

**Steps**:

1. Given the degraded fixture, when run with `--json`, then assert exit `0`, exactly one envelope, `assertEnvelopeContract` returns `[]`, no `error` key, and the candidate count equals the caller's ref count.
2. Assert `repo-free` is `satisfied` from the observed local context while `deps-satisfied`, `tier-known`, `no-owner-gate`, `ci-healthy`, and `provider-available` are `unknown` for the named causes; assert the candidate is `ready: false` and `blockingConditions` names all five in fixed order.
3. Assert the top-level `reasons` follows `QUEUE_READY_REASON_ORDER` for the observed groups: the binding outcome (`addressing-unresolved`, or `remote-unsupported` for an unsupported host) first, then `config-invalid`, then `state-unreadable`; assert every entry is unique and in the closed set. Assert the condition-source failures that reach `reasons` come from `QUEUE_READY_SOURCE_FAILURE_REASONS` in `QUEUE_READY_CONDITION_ORDER` then evidence order, and that verdict reasons (`ci-pending`, `tier-conflict`, `dependency-open`, `pr-not-associated`, and similar) are absent from top-level `reasons`. Assert none becomes a command failure.
4. Assert all six conditions are still present and evidence is non-empty for each; assert no condition is dropped because its source failed.
5. Given a wholly failing fixture with three candidates, when run, then assert all three candidates are rendered, each has six conditions, and exit is `0`.
6. Given a handler that throws an unclassifiable error, when run through the edge, then assert exit `2`, exactly one error envelope with `fallback.internal`, and no partial data.
7. Given an unknown-flag invocation (`["queue","ready","GH-1","--limit","2"]`), when run, then assert the existing global parser produces its `fallback.invocation` envelope with exit `1` without reaching the handler; assert this parser path is separate from the handler's only two failures (`input.value.rejected`, `fallback.internal`) and is unchanged.
8. Given the restored fixture (binding observed, config valid, parks readable), when run, then assert the affected conditions move to their Appendix A states, proving the negatives are not vacuous.
9. Assert the Appendix G all-unknown/degraded row is reproduced: `repo-free` satisfied, five conditions unknown, `ready: false`, `closeClass: not-ready`, and class rank 4 (the payload `rank` is the candidate's 1-based sorted position, not the class bucket).

**Expected Outcome**:

- Source failures are condition evidence, not command failures: every candidate is rendered, exit is `0`, and only handler grammar rejection or containment produces a handler error envelope; the existing global parser `fallback.invocation` path is separate and unchanged. The Appendix G degraded row is exact, and the top-level `reasons` follow the six-group order (binding, `source-truncated`, provider-config, park-fold, condition-source failures, `pr-association-unknown`) with first-occurrence dedup and no verdict reason leaking in.

#### TC-QREADY-003 - Six-condition totality, tri-state, ready equivalence, blocking disclosure

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, DM-2, DM-3, AC-F2-1, AC-F3-1, NFR-1
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-conditions.test.ts`, `tests/fixtures/queue-ready/matrix/cases.ts`
**Tags**: @backend

**Given** one fixture per condition state and per readiness outcome,
**When** the payload is produced,
**Then** every candidate carries exactly the six ids in fixed order with one tri-state state and bounded evidence, and `ready`/`blockingConditions` agree with the six states.

**Preconditions**:

- The fixed condition order from Appendix C: `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available`.
- The closed states `satisfied`, `unsatisfied`, `unknown` and the closed close classes.
- At least one all-satisfied fixture, one single-`unknown` fixture per condition, one single-`unsatisfied` fixture per condition, and combined fixtures.

**Steps**:

1. For every fixture, assert `data.candidates` length is 1..8 and every candidate has exactly `workItemRef`, `rank`, `ready`, `closeClass`, `workItem`, `close`, `conditions`, `blockingConditions`, `truncated`.
2. Assert `conditions.map(c => c.id)` equals the six ids exactly, in order, with no duplicate, missing, or extra condition.
3. Assert every condition `state` is a member of the closed tri-state set and every condition has 1..2 evidence records, each with a `source` from the closed source set and a `reason` from the closed reason set; assert `detail`, when present, is a string <=160 characters. Assert each of the five non-provider conditions (`deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`) carries exactly one record, and every `provider-available` condition has exactly two records: the F-9 case record first, then `{ source: "provider-config", reason: "engine-not-run" }` with no detail; assert no other condition exceeds two and no `engine-not-run` appears as a detail.
4. Assert `ready === conditions.every(c => c.state === "satisfied")` for every candidate.
5. Assert `blockingConditions` is exactly the ordered projection `{id, state}` of every non-satisfied condition; assert an all-satisfied candidate has `blockingConditions: []`; assert a not-ready candidate names at least one condition.
6. Assert `blockingConditions` order follows the fixed condition order even when the evidence arrays are permuted; assert caller order does not change condition order.
7. Assert `summary` equals counts derived from the rendered candidates (`candidates`, `ready`, `notReady`, `mergeReady`, `reviewPending`, `newStart`, `unknownClose`), and `ready + notReady === candidates`.
8. Negative controls: remove one condition from a fixture, duplicate one id, rename a state to `clear`, and set `ready: true` with one `unknown`; each mutation must fail the assertion by name. The unmutated control is green.

**Expected Outcome**:

- Totality and readiness equivalence are exact: six conditions, fixed order, one closed state each, bounded evidence, ready iff all six satisfied, and every blocking condition named in fixed order. `provider-available` always carries the ordered case-record-then-`engine-not-run` pair. All five close classes remain in their closed vocabulary.

#### TC-QREADY-004 - Condition derivation matrix cell-by-cell

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-14, DM-3, AC-F2-2, AC-F14-1, NFR-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-conditions.test.ts`, `tests/fixtures/queue-ready/matrix/cases.ts`
**Tags**: @backend @golden

**Given** one case per §8.3/Appendix A derivation cell for all six conditions, with provider-shaped observed ids,
**When** each case is evaluated,
**Then** the condition state and reason match the matrix exactly, and an unobserved/unavailable/failed/unresolved source never yields `satisfied`.

**Preconditions**:

- The normative §8.3 and Appendix A matrices, copied as test data, plus the Appendix D evidence vocabulary.
- A `matrix/cases.ts` table with one row per condition x state cell and explicit expected reason(s), including the combined states.
- Normalized views use provider-shaped `identity.entityId` values (`"176"`, `"179"`, `"7"`, `"0176"`) with canonical requested refs (`GH-176`, `GH-179`, `GH-7`/`PDEV-7`, `GH-007`); an exact-canonical row uses `identity.entityId: "GH-176"`/`"gh-176"`. No fixture may rely on a GH-shaped observed id to observe a canonical candidate (the §8.3 rule is asserted in TC-QREADY-036/037).
- The pure evaluator's fact injection (no live reads).

**Steps**:

1. For each `deps-satisfied` row, assert the state/reason: candidate unobserved while relations are also declared unavailable `unknown`/`work-item-unobserved` (unobserved wins before the relation-signal check); relations available and the candidate unobserved `unknown`/`work-item-unobserved`; observed candidate with unavailable relations `unknown`/`signal-unavailable`; zero targets `satisfied`/`no-blocked-dependencies`; all done/canceled `satisfied`/`dependencies-done` with detail `done:<n>; open:0; unknown:0`; observed non-done `unsatisfied`/`dependency-open` with detail `done:<n>; open:<n>; unknown:<n>`; unobserved target with no known open `unknown`/`dependency-unobserved` with the same state-count detail. For every target-derived reason assert exactly one evidence record and that the three counts sum to the total `blocked-by` relation target count (observed + unobserved).
2. For each `repo-free` row, assert: missing `unknown`/`local-context-missing` (no detail); malformed `unknown`/`local-context-malformed` (no detail); no active `satisfied`/`no-active-change` with detail `repo:local-context`; candidate-as-active `satisfied`/`candidate-is-active` with detail `repo:local-context; candidate-is-active`; another active `unsatisfied`/`other-active-change` with detail `repo:local-context; active-change:<ref>`.
3. For each `tier-known` row, assert: exactly one recognized `satisfied`/`tier-label` with detail `tier:priority-label; label:<label>`; zero recognized `unknown`/`tier-absent` with detail `tier:priority-label; none`; two or more distinct `unsatisfied`/`tier-conflict` with detail `tier:priority-label; labels:<sorted labels>`; candidate unobserved while the label signal is also unavailable `unknown`/`work-item-unobserved` (unobserved wins); observed candidate with unavailable labels `unknown`/`signal-unavailable`.
4. For each `no-owner-gate` row, assert: no owner label `satisfied`/`no-owner-labels`; any owner label `unsatisfied`/`owner-labels`; candidate unobserved while the label signal is also unavailable `unknown`/`work-item-unobserved` (unobserved wins); observed candidate with unavailable labels `unknown`/`signal-unavailable`.
5. For each `ci-healthy` row, assert: `succeeded` `satisfied`/`ci-succeeded`; `failed`/`pending`/`canceled`/`none` `unsatisfied` with `ci-failed`/`ci-pending`/`ci-canceled`/`ci-none`; and exactly one `unknown` reason per mode — unresolved SHA `unknown`/`commit-unresolved`; unattempted read from an unavailable binding `unknown`/`addressing-unresolved` (or `remote-unsupported` for an unsupported host); unattempted read with no resolvable credential `unknown`/`credential-unavailable`; attempted failure `unknown`/`read-failed` with a bounded existing `failureCode`/`failureClass` and no error-table row.
6. For each `provider-available` row, assert the state, the exact ordered two-record evidence, and the case record: resolved chain with >=1 enabled unparked `satisfied` with `{ source: "provider-parks", reason: "no-active-park", detail: "chain:<name>" }`; no enabled entry `unsatisfied` with `{ source: "provider-config", reason: "no-enabled-entry", detail: "chain:<name>" }`; all enabled parked `unsatisfied` with `{ source: "provider-parks", reason: "all-entries-parked", detail: "chain:<name>" }`; chain park `unsatisfied` with `{ source: "provider-parks", reason: "chain-parked", detail: "chain:<name>; until:<expiry or none>; cause:<cause or none>" }`; undeclared chain `unknown`/`provider-chain-not-declared`; unresolved chain `unknown`/`provider-chain-unresolved` from **either** the defensive `ok:true` missing-chain branch (pure evaluator) **or** a config read `{ok:false, reason:"provider-chain-unresolved"}` (command level; the read failure is mapped by its own reason, mirroring `packages/core/src/domain/status.ts`); config read `{ok:false, reason:"config-invalid"}` `unknown`/`config-invalid`; park fold failure `unknown`/`state-unreadable` with `{ source: "provider-parks", reason: "state-unreadable" }`; in every row the second record is exactly `{ source: "provider-config", reason: "engine-not-run" }` with no detail. Assert no `ok:false` case is remapped to a different reason than its read's `reason`.
7. Assert no matrix cell is reached by defaulting: for every `unknown` cell, a flip to an available/observed source changes the state to `satisfied` or `unsatisfied` as the matrix dictates; for every `satisfied` cell, an omission of the required source changes it to `unknown`.
8. Assert the `all-unknown` combined row and every single-`unknown` row produce `ready: false` and name the unknown condition(s); assert the `all-satisfied` row produces `ready: true`.
9. Meta-control: assert the case table has a row for every matrix cell; every Appendix D reason (including `value-clamped`) is classified as either a condition/close verdict reason or a payload-level marker with no evidence row; every Appendix D condition reason appears in at least one expected row, including all four CI `unknown` reasons (`commit-unresolved`, `addressing-unresolved`/`remote-unsupported`, `credential-unavailable`, `read-failed`), both unobserved-precedence combined rows, every deps state-count detail, every provider case record plus the `engine-not-run` companion, and the two provider-config failure reasons (`config-invalid`, `provider-chain-unresolved`); a removed row, removed reason, removed companion, or reordered provider pair fails the meta-check.

**Expected Outcome**:

- Every derivation cell is pinned and non-defaulting; the matrix is exhaustive for the condition x state space, and no unavailable/absent/failed source is ever `satisfied`. Provider config failures are mapped by the read's own reason (`config-invalid` vs `provider-chain-unresolved`), so the command-level unresolved-chain case is reachable rather than an `ok:true`-only fiction.

#### TC-QREADY-005 - `deps-satisfied`: unavailable/unobserved/done/open targets

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DEC-5, DEC-11, DEC-18, DM-3, AC-F4-1, AC-F4-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-deps.test.ts`, `tests/fixtures/queue-ready/deps/cases.ts`, reused `tests/fixtures/providers/{github,jira}/**`
**Tags**: @backend

**Given** a normalized candidate work item with a declared blocked-dependency availability and zero or more `blocked-by` relations, where the observed candidate and every target carry provider-shaped numeric `identity.entityId` values,
**When** `deps-satisfied` is evaluated against the same bounded open page,
**Then** only an available relation source with all targets observed done/canceled (including zero targets) is satisfied; unavailable relations and unobserved targets are unknown; an observed non-done target is unsatisfied; a target resolves only by the §8.3 identity rule.

**Preconditions**:

- `deps/cases.ts` cases: relations unavailable with zero visible relations; candidate unobserved while relations are also declared unavailable (combined precedence); relations available with zero targets; all targets done; all targets canceled; one done + one canceled; one observed `in-progress`/`open` target; a mix of open + unobserved; an unobserved target with no known open; a done target outside the observed page; a duplicate/removed relation control.
- Observed candidate `identity.entityId: "176"` for requested `GH-176` (provider-shaped; the §8.3 numeric bridge), and relation targets with `entityId` `"179"`, `"180"`, and `"999"` (a target absent from the page). A separate exact-canonical control uses `entityId: "GH-176"`; no fixture may rely on a GH-shaped observed id for a canonical candidate.
- The GitHub-shaped availability fixture (`blockedDependencies: "unavailable"`) and a relation-capable fixture.
- The bounded open page's observed `WorkItem` set.

**Steps**:

1. Given relations declared unavailable and a candidate with zero visible `blocked-by` relations, when evaluated, then assert `deps-satisfied === "unknown"` with `signal-unavailable` and no `no-blocked-dependencies` reason; assert the candidate is not ready.
2. Given relations unavailable and a candidate with visible relations, when evaluated, then assert `unknown`/`signal-unavailable` (relations are not trusted at all); the visible relations do not produce `dependency-open`.
3. Given relations declared unavailable and the candidate unobserved, when evaluated, then assert `unknown`/`work-item-unobserved` (unobserved wins before the relation-signal check), not `signal-unavailable`; given relations available and the candidate unobserved, assert the same. This combined case is the R-07 precedence control.
4. Given relations available, the candidate observed, and zero `blocked-by` relations, when evaluated, then assert `satisfied`/`no-blocked-dependencies`.
5. Given every target observed `done`, or every target observed `canceled`, or one done + one canceled, when evaluated, then assert `satisfied`/`dependencies-done`, exactly one evidence record, and detail `done:<n>; open:0; unknown:0` where the `done` count covers observed done/canceled targets and equals the total `blocked-by` relation target count (all targets are observed in this case); assert done and canceled are equivalent and no target ref appears. The targets resolve because the observed provider-shaped `"179"`/`"180"` equals the observed item's full `identity.entityId` (§8.3 step 1); the exact-canonical control resolves `"GH-179"` only by the same exact rule.
6. Given at least one target observed with a non-done, non-canceled delivery state, when evaluated, then assert `unsatisfied`/`dependency-open`, exactly one evidence record, and detail `done:<n>; open:<n>; unknown:<n>` where `done` covers observed done/canceled, `open` covers observed non-terminal targets, `unknown` covers unobserved targets, and the three counts sum to the total `blocked-by` relation target count (observed + unobserved); assert no target-ref list or per-target record appears.
7. Given one observed open target plus one unobserved target (`entityId: "999"` absent from the page), when evaluated, then assert `unsatisfied`/`dependency-open` (the open target wins) with exactly one record and detail `done:0; open:1; unknown:1`.
8. Given only unobserved targets (`entityId: "999"`) and no known open target, when evaluated, then assert `unknown`/`dependency-unobserved` with exactly one record and detail `done:0; open:0; unknown:<n>`.
9. Given a target that is done but outside the bounded observed page, when evaluated, then assert it remains unobserved (`unknown`/`dependency-unobserved`, counted under `unknown`) and no second page or per-target read occurs. Full identity/target resolution cases (bare-number bridge, ambiguous suffix, leading-zero mismatch, no-match) are asserted in TC-QREADY-037; here the single-target exact/bridge outcome is spot-checked so the matrix is not vacuous.
10. Assert every deps state carries exactly one evidence record from source `tracker`; a second record or a per-target record fails by name. The delivered set never emits three deps records, so the evidence cap is not reachable through deps.
11. Controls: restore the relation source and the target items and assert the state becomes `satisfied`/`unsatisfied` as expected; remove the relation source declaration and assert `unknown`, proving the source declaration is live.

**Expected Outcome**:

- `deps-satisfied` never reports satisfied from an absent, unavailable, or unobserved relation source; an unobserved candidate wins before the relation-signal check; done/canceled satisfy, observed open fails, and unobserved targets stay unknown without speculative reads; every state carries exactly one evidence record with the state-count detail `done:<n>; open:<n>; unknown:<n>` and no per-target record; provider-shaped candidate/target ids resolve by exact full identity before any output clamp.

#### TC-QREADY-006 - `repo-free`: local PM context, never "free" from absence

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DEC-4, DM-3, DM-9, AC-F5-1, NFR-3, NFR-10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-repo-tier-owner.test.ts`, `tests/fixtures/queue-ready/pm-context/*.yaml`, `tests/fixtures/queue-ready/repo/cases.ts`
**Tags**: @backend @security

**Given** a git-ignored local PM context that is absent, malformed, empty of `active_change`, equal to the candidate, or equal to another ref,
**When** `repo-free` is evaluated,
**Then** missing/malformed is unknown, no active change is satisfied, the candidate itself is satisfied case-insensitively, and another active change is unsatisfied with a bounded detail; the file is never written.

**Preconditions**:

- `pm-context/*.yaml` fixtures: absent file (temp root without the file), no-active-change (`active_change` omitted with `parked_changes: []`), candidate-active (`GH-176`), other-active (`GH-179`), malformed YAML, wrong shape (scalar, an object without `workItemRef`, or `active_change: null`), and a notes-canary file with free-form `notes`.
- A temp PM-context root created with `mkdtemp`; bytes and mtime captured before the run.
- The same bounded projection status uses (only `active_change`/`parked_changes`).

**Steps**:

1. Given the file is absent, when evaluated, then assert `repo-free === "unknown"` with `local-context-missing`; assert the candidate is not ready and no condition claims "free".
2. Given malformed YAML, when evaluated, then assert `unknown`/`local-context-malformed`.
3. Given a wrong-shape context (for example `active_change: true`, an object without `workItemRef`, or `active_change: null`), when evaluated, then assert `unknown`/`local-context-malformed`. A present `active_change: null` is malformed, not the "no active change" case, and requires `parked_changes` to be an array.
4. Given an observed context with `active_change` omitted and `parked_changes: []`, when evaluated, then assert `satisfied`/`no-active-change` with detail exactly `repo:local-context`.
5. Given `active_change.workItemRef` equal to the candidate exactly, when evaluated, then assert `satisfied`/`candidate-is-active` with detail exactly `repo:local-context; candidate-is-active`.
6. Given `active_change.workItemRef` equal to the candidate differing only in case (`gh-176` for candidate `GH-176`), when evaluated, then assert `satisfied`/`candidate-is-active`.
7. Given another active change (`GH-179`), when evaluated, then assert `unsatisfied`/`other-active-change` and detail exactly `repo:local-context; active-change:GH-179`; assert the other candidate in a multi-candidate run is unaffected.
8. Given the notes-canary context, when run, then assert the `notes` value does not appear in the payload, evidence, or human text; assert only the allowed fields are projected.
9. After every run, assert the PM-context file bytes and mtime are unchanged and no file was created or removed under the temp root; assert the guarded file adapter threw on any write attempt in a seeded control.

**Expected Outcome**:

- `repo-free` is truthful across absent/malformed/no-active-change/candidate/other states; a missing context is never "free"; `active_change: null` is malformed, not "no active change"; the candidate does not block itself; observed states carry the `repo:local-context` proxy detail; the context is never written and only the bounded projection is read.

#### TC-QREADY-007 - `tier-known`: exactly one priority label, absent/conflict

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DEC-3, DM-3, AC-F6-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-repo-tier-owner.test.ts`, `tests/fixtures/queue-ready/tier/cases.ts`
**Tags**: @backend

**Given** an observed candidate work item with a label list,
**When** `tier-known` is evaluated,
**Then** exactly one distinct recognized priority label satisfies, zero recognized is unknown, two or more distinct recognized labels are unsatisfied with a sorted detail, and no default is invented.

**Preconditions**:

- The declared tier labels `priority:high`, `priority:medium`, `priority:low` (case-insensitive).
- Cases: one high; one medium; one low; mixed-case `PRIORITY:HIGH`; empty labels; only `bug`/`feature`; high + low; all three; duplicate identical label twice; high + `bug`; work item unobserved; label signal unavailable; work item unobserved while the label signal is also unavailable (combined precedence).

**Steps**:

1. Given exactly one `priority:high`, when evaluated, then assert `satisfied`/`tier-label` and detail exactly `tier:priority-label; label:priority:high`.
2. Given exactly one `priority:medium` or one `priority:low`, when evaluated, then assert `satisfied` with the matching detail `tier:priority-label; label:priority:<level>`.
3. Given `PRIORITY:HIGH`, when evaluated, then assert `satisfied` and case-insensitive matching; assert the emitted detail is canonical.
4. Given no labels, or only unrecognized labels (`bug`, `feature`, `needs-triage`), when evaluated, then assert `unknown`/`tier-absent` with detail exactly `tier:priority-label; none`; assert the candidate is not ready and no default tier appears.
5. Given `priority:high` + `priority:low`, when evaluated, then assert `unsatisfied`/`tier-conflict` and detail exactly `tier:priority-label; labels:priority:high,priority:low` (sorted deterministically).
6. Given all three priority labels, when evaluated, then assert `unsatisfied`/`tier-conflict` with all three labels sorted.
7. Given the same recognized label repeated (`priority:high`, `priority:high`), when evaluated, then assert `satisfied` (one distinct label).
8. Given `priority:high` + `bug`, when evaluated, then assert `satisfied` (unrecognized labels neither satisfy nor conflict).
9. Given the work item is unobserved while the label signal is also declared unavailable, when evaluated, then assert `unknown`/`work-item-unobserved` (unobserved wins before the label-signal check); given an observed work item with an unavailable label signal, assert `unknown`/`signal-unavailable`.
10. Controls: remove the only priority label -> `unknown`; add a second distinct priority label -> `unsatisfied`; restore -> `satisfied`.

**Expected Outcome**:

- Tier is exactly one recognized priority label with the `tier:priority-label` proxy detail; absence is unknown (never a fabricated default), conflict is unsatisfied, duplicates do not conflict, unrecognized labels are inert, and an unobserved candidate wins before the label-signal check.

#### TC-QREADY-008 - `no-owner-gate`: declared owner labels only, assignee ignored

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DEC-6, DM-3, AC-F7-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-repo-tier-owner.test.ts`, `tests/fixtures/queue-ready/owner/cases.ts`
**Tags**: @backend

**Given** an observed candidate work item with labels and an optional assignee,
**When** `no-owner-gate` is evaluated,
**Then** none of `hand-back`/`human-input-needed` satisfies, any one or more is unsatisfied with sorted labels, unobserved labels/item is unknown, and `assignee` is never used.

**Preconditions**:

- Cases: empty labels; `bug` + `priority:high`; `hand-back`; `human-input-needed`; both; mixed-case `HAND-BACK`; unobserved item; label signal unavailable; unobserved item while the label signal is also unavailable (combined precedence); assignee set with no owner labels; assignee absent with `hand-back`; unobserved item with assignee set.

**Steps**:

1. Given labels `[]`, when evaluated, then assert `satisfied`/`no-owner-labels`.
2. Given `bug` + `priority:high`, when evaluated, then assert `satisfied`/`no-owner-labels`.
3. Given `hand-back`, when evaluated, then assert `unsatisfied`/`owner-labels` and a detail containing `hand-back`.
4. Given `human-input-needed`, when evaluated, then assert `unsatisfied`/`owner-labels`.
5. Given both owner labels, when evaluated, then assert `unsatisfied`/`owner-labels` with a deterministic sorted label detail.
6. Given `HAND-BACK`, when evaluated, then assert `unsatisfied` and case-insensitive matching.
7. Given the work item is unobserved while the label signal is also unavailable, when evaluated, then assert `unknown`/`work-item-unobserved` (unobserved wins before the label-signal check); given an observed work item with an unavailable label signal, assert `unknown`/`signal-unavailable`.
8. Given `assignee` is set and no owner label is present, when evaluated, then assert `satisfied` (assignee is ignored).
9. Given `assignee` is absent and `hand-back` is present, when evaluated, then assert `unsatisfied`; assert the evidence does not mention the assignee.
10. Given an unobserved item with an assignee, when evaluated, then assert `unknown`, proving the assignee cannot fabricate an observed item.

**Expected Outcome**:

- The owner gate is exactly the two declared labels; an unobserved candidate wins before the label-signal check; unobserved label signals are unknown; the optional `assignee` field is never a gate signal.

#### TC-QREADY-009 - `ci-healthy`: result classification, only `succeeded`

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DEC-7, DM-3, AC-F8-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-ci.test.ts`, `tests/fixtures/queue-ready/ci/cases.ts`, reused `tests/fixtures/providers/github/check-runs-per-sha.json`
**Tags**: @backend

**Given** a resolved checkout HEAD and one bounded check-runs page,
**When** `ci-healthy` is evaluated over the status CI classification,
**Then** only `succeeded` satisfies; `failed`, `pending`, `canceled`, and `none` are unsatisfied with matching reasons; all-skipped is never satisfied.

**Preconditions**:

- Cases: one succeeded run; one failed; one pending; one canceled; zero runs (`none`); a page of all-skipped runs; a mixed page whose precedence matches the status classifier; a raw page of 19 and 20 runs.
- The same CI classification the status collector uses (no second classifier in queue ready).

**Steps**:

1. Given the status classification `succeeded`, when evaluated, then assert `satisfied`/`ci-succeeded`.
2. Given `failed`, when evaluated, then assert `unsatisfied`/`ci-failed`.
3. Given `pending`, when evaluated, then assert `unsatisfied`/`ci-pending`.
4. Given `canceled`, when evaluated, then assert `unsatisfied`/`ci-canceled`.
5. Given no runs (`none`), when evaluated, then assert `unsatisfied`/`ci-none`; assert the condition never becomes `satisfied` and never prints a green claim.
6. Given a page of all-skipped runs, when evaluated, then assert `state === "unsatisfied"` with reason `ci-none` (the delivered status classifier pins an all-skipped page to `none`); assert the condition is never `succeeded` and never prints a green claim.
7. Given a raw check-runs page of exactly 20, when evaluated, then assert exactly one read was made with `per_page = 20` and no second page; assert the payload-level `reasons` contains `source-truncated` exactly once and the payload `truncated` is true; assert the `ci-healthy` classification, state, ordered evidence records, and the candidate's `blockingConditions` are identical to the 19-run control; assert no condition evidence record carries `source-truncated` (it is payload-level only).
8. Given 19 runs, when evaluated, then assert one bounded read, the same classification behavior, no `source-truncated` reason, and payload `truncated: false`.
9. Controls: change the run conclusion to success -> `satisfied`; change it to failure -> `unsatisfied`; remove all runs -> `unsatisfied`/`ci-none`. The control proves the classifier is live.

**Expected Outcome**:

- CI health is exactly "observed success"; no-run, pending, canceled, failed, and all-skipped (`ci-none`) are never green; the read is one bounded page with no pagination; a raw 20-run page raises the payload-level `source-truncated` marker and payload `truncated` only, leaving the CI verdict, evidence, and blocking list unchanged.

#### TC-QREADY-010 - `ci-healthy`: each `unknown` reason — unresolved, unattempted, credential, read-failed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-14, DM-3, DM-10, AC-F8-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-ci.test.ts`, `tests/fixtures/queue-ready/ci/cases.ts`
**Tags**: @backend

**Given** a checkout with no resolved SHA, a failed check-runs read, a credential failure, or a repository binding that prevents the read,
**When** `ci-healthy` is evaluated,
**Then** it is `unknown` with the safe reason and no `succeeded`, `failed`, or `none` claim; the command still succeeds.

**Preconditions**:

- Cases: `head.sha === undefined`; check-runs read `ok: false` with `reason: "read-failed"` and a safe `failureCode`/`failureClass`; `reason: "credential-unavailable"`; binding unavailable so the read is unattempted; a restored read that returns a succeeded run.
- A transport recorder that proves zero requests in the unresolved-SHA and unavailable-binding cases.

**Steps**:

1. Given `head.sha` is absent, when evaluated, then assert `unknown`/`commit-unresolved`; assert zero check-runs requests.
2. Given a failed check-runs read with a safe code/class, when evaluated, then assert `unknown`/`read-failed`; assert the evidence carries the bounded existing `failureCode`/`failureClass` and no raw response; assert the reason appears once in group 5 of the payload `reasons` and no error-table row is added.
3. Given an unattempted read with no resolvable credential, when evaluated, then assert `unknown`/`credential-unavailable`, zero check-runs requests, and the reason appears once in group 5; assert it is not an error identity. At command level the credential refusal makes all three GitHub reads return `credential-unavailable` (`packages/cli/src/edge.ts` refusal path), so the tracker-derived conditions are also `unknown`/`work-item-unobserved`.
4. Given an unavailable repository binding (read unattempted), when evaluated, then assert `unknown`/`addressing-unresolved` (or `remote-unsupported` for an unsupported host) and zero check-runs requests; assert the payload-level `reasons` carries that same reason once in group 1 (repository-binding outcome) and not in group 5. At command level `packages/cli/src/commands/status.ts` skips all three GitHub reads when the binding is not observed, so the tracker-derived conditions are also `unknown`/`work-item-unobserved`.
5. Given each unknown case, assert `ready: false` and `blockingConditions` includes `ci-healthy` with its state.
6. Given the restored fixture with a succeeded run, when evaluated, then assert `satisfied`/`ci-succeeded`, proving the negative is not vacuous.
7. Assert no unknown case prints `ci-none` or any green token; assert the human line names `ci-healthy=unknown` for the affected candidate.
8. Assert exactly one read attempt per invocation when a SHA exists; assert no retry (`readPipelineRuns` call count is exactly `1`).

**Expected Outcome**:

- Unresolved/unattempted/failed CI reads are `unknown` with exactly one reason each (`commit-unresolved`, `addressing-unresolved`/`remote-unsupported` in group 1, `credential-unavailable` in group 5, `read-failed` with a bounded existing code/class); no-read is never healthy; no error row is added; the command still exits `0`.

#### TC-QREADY-011 - `provider-available`: satisfied path, exact two-record evidence, no engine call

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DEC-8, DM-3, DM-4, AC-F9-1, NFR-3, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-provider.test.ts`, `tests/fixtures/queue-ready/providers/**`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @security

**Given** a resolved provider configuration with a declared default chain and verified active park views,
**When** `provider-available` is evaluated,
**Then** at least one enabled chain entry with no active provider park and no active chain park is `satisfied` with exactly two evidence records — the case record `{ source: "provider-parks", reason: "no-active-park", detail: "chain:<name>" }` first, then `{ source: "provider-config", reason: "engine-not-run" }` with no detail; no engine/quota call is made, and no provider evidence record or availability claim uses `available` as a claim or state (the pinned condition id `provider-available`, the condition-id list, `blockingConditions`/human `blocking:` references, payload keys, summary tokens, and close classes are exempt).

**Preconditions**:

- Provider config fixtures: `chain-default` (default chain resolves to entries `alpha`, `beta`, both enabled), `chain-partial-park` (one enabled unparked, one parked), and a state-harness park ledger.
- Counting stubs for the provider engine, `provider resolve`, `provider quota`, and the quota transport that throw if called.
- A normalized park view `{name, subjectKind: "provider", subjectName, cause, conditions, expiresAt}`.

**Steps**:

1. Given `chain-default` with no parks, when evaluated, then assert `satisfied`; assert the condition has exactly two evidence records in order: `{ source: "provider-parks", reason: "no-active-park", detail: "chain:default" }` first, then `{ source: "provider-config", reason: "engine-not-run" }` with no `detail` key.
2. Given one enabled entry parked and one enabled entry unparked, when evaluated, then assert `satisfied` (at least one unparked enabled entry suffices).
3. Given a provider park whose `subjectKind` is `provider` but `subjectName` differs from every chain entry, when evaluated, then assert it does not match and the condition is `satisfied`.
4. Given a chain park whose `subjectKind` is `chain` but `subjectName` is another chain, when evaluated, then assert it does not match and the condition is `satisfied`.
5. Assert every evidence source is drawn from `{provider-config, provider-parks}` and every reason from the closed set; assert `engine-not-run` appears only as the second record's `reason`, never as a `detail`; assert **the provider evidence records/details and the provider human-text segment** contain no `available` claim and no `engine-verified`/`verified capacity` claim, while the pinned condition id `provider-available` in `conditions[].id`, the `QUEUE_READY_CONDITION_ORDER` list, `blocking: provider-available=<state>` lines, payload keys (`ready`, `notReady`, `mergeReady`, `reviewPending`, `newStart`, `unknownClose`), summary tokens, and close classes (`merge-ready`, `not-ready`) are explicitly allowed and excluded from the scan. The scan must be scoped to those surfaces, never the whole payload or digest, so it is satisfiable. Negative control: a hand-planted `provider available` claim in a provider detail must fail by name; the unmutated control passes.
6. Assert the engine, `provider resolve`, `provider quota`, and quota transport stubs recorded `0` calls; assert the state store recorded a read of the verified park fold and no write/fence.
7. Assert exactly one logical park-fold read and at most one config resolve; a seeded deliberate engine call in the control must trip the stub.
8. Assert the `no-active-park` and `engine-not-run` tokens survive a `JSON.stringify`/human render and are not swallowed by truncation at cap size.

**Expected Outcome**:

- The satisfied provider condition is evidence-backed by config + verified parks only with the exact two-record pairing; the engine is never run; availability is never claimed engine-verified; no provider evidence record or availability claim uses `available` as a claim or state (the pinned condition id and its condition-id/`blocking:` references are exempt and the scan is scoped to provider evidence/details and the provider human-text segment).

#### TC-QREADY-012 - `provider-available`: no entry/all parked/chain park/config or fold failure

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, DEC-8, DM-3, DM-10, AC-F9-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-provider.test.ts`, `tests/fixtures/queue-ready/providers/**`, `tests/fixtures/state/harness.ts`
**Tags**: @backend @security

**Given** provider config/park fixtures that remove or degrade the resolved chain,
**When** `provider-available` is evaluated,
**Then** each unmet case is `unsatisfied` and each unavailable/unresolved/failed case is `unknown` with the exact reason and the exact ordered case-record-then-`engine-not-run` pair; none is satisfied and the engine is never called.

**Preconditions**:

- Fixtures: `no-enabled-entry` (all entries disabled), `chain-all-parked` (every enabled entry parked), `chain-parked` (active chain park with cause and expiry), `no-chain` (no default chain), `unresolved-chain` (a defensive pure-evaluator `ok:true` view whose default chain is absent from `chains`), `unresolved-chain-command` (command-level config read `{ok:false, reason:"provider-chain-unresolved"}`, the shape the delivered validator/edge actually produces), `config-invalid` (config read `{ok:false, reason:"config-invalid"}`), `park-fold-torn` (state `state-unreadable`).
- The `packages/core/src/domain/status.ts` provider-config mapping (`ok:false` reason -> same condition reason) as the behavioral oracle.
- Counting engine/quota stubs and a transport recorder.
- An expiry boundary fixture (T-1, T, T+1) for the chain-park detail.

**Steps**:

1. Given no enabled entry, when evaluated, then assert `unsatisfied`/`no-enabled-entry` with the case record `{ source: "provider-config", reason: "no-enabled-entry", detail: "chain:<name>" }` first and the `engine-not-run` companion second.
2. Given every enabled entry parked, when evaluated, then assert `unsatisfied`/`all-entries-parked` with the case record `{ source: "provider-parks", reason: "all-entries-parked", detail: "chain:<name>" }` first and the companion second.
3. Given an active chain park for the declared chain, when evaluated, then assert `unsatisfied`/`chain-parked` with the case record `{ source: "provider-parks", reason: "chain-parked", detail: "chain:<name>; until:<expiry or none>; cause:<cause or none>" }` first and the companion second; assert it is not forced through the per-entry predicate and is not reported available.
4. Given no declared default chain, when evaluated, then assert `unknown`/`provider-chain-not-declared` (not unsatisfied, not an empty chain) with a `{ source: "provider-config", reason: "provider-chain-not-declared" }` case record plus the companion.
5. Given a declared default chain absent from `chains`, when evaluated in the defensive pure-evaluator view (`ok:true`), then assert `unknown`/`provider-chain-unresolved` with the matching config case record plus the companion and no failure `detail` on the case record. Given the command-level config read `{ok:false, reason:"provider-chain-unresolved"}`, when run through `runCli`, then assert the same `unknown`/`provider-chain-unresolved` with `{ source: "provider-config", reason: "provider-chain-unresolved", detail: "failureCode:<code>" }` first (the delivered edge supplies `failureCode:config.value.invalid` in the fixture) and the companion second; assert the failure is mapped by the read's own `reason` (not `config-invalid`), mirroring `packages/core/src/domain/status.ts`, so the command-level corpus row is reachable; assert the `detail` is exactly the pinned `failureCode:<code>` form with no free-form text.
6. Given the config read fails with `{ok:false, reason:"config-invalid"}`, when evaluated, then assert `unknown`/`config-invalid` with a `{ source: "provider-config", reason: "config-invalid" }` case record whose `detail`, when supplied, is exactly the pinned `failureCode:<code>`, `failureClass:<class>`, or both joined by `; ` (never a raw payload or free-form message), the companion with no detail, and no `ok:false` reason remapped to a different condition reason.
7. Given the park fold fails with `state-unreadable`, when evaluated, then assert `unknown`/`state-unreadable`; assert the case record is `{ source: "provider-parks", reason: "state-unreadable" }` (the park-fold source, not `provider-config`), with the park read's `failureCode`/`failureClass` in the pinned `failureCode:<code>`, `failureClass:<class>`, or both joined by `; ` detail form where supplied and no `detail` where neither is supplied; assert no free-form detail and the `engine-not-run` companion is present; assert no "no parks" claim.
8. Assert every case carries exactly two evidence records in fixed order — the case record first, then `{ source: "provider-config", reason: "engine-not-run" }` with no detail — and that no case omits, reorders, or duplicates the pair; a hand-planted free-form provider failure detail (for example a human sentence in a config or park case record) must fail by name, while the unmutated pinned-form case record passes.
9. Given an expiry boundary, assert the chain-park detail includes the bounded expiry and remains <=160 characters; assert expired parks do not count as active; assert the `until:none` form when no expiry is present.
10. Assert the engine/quota stubs recorded `0` calls in every case; assert the state store recorded a read where a fold was available and no mutation; assert **the provider evidence records/details and the provider human-text segment** contain no `available` claim (the pinned condition id `provider-available`, condition-id list, `blocking: provider-available=<state>` lines, payload keys, summary tokens, and close classes are exempt), and the scan is scoped to those surfaces rather than the whole payload/digest. A hand-planted `provider available` claim in a provider detail must fail by name.
11. Controls: restore the chain/entries and assert `satisfied`; remove one park at a time and assert the state flips to `satisfied`, proving the negative fixtures are live.

**Expected Outcome**:

- Every provider degradation maps to the exact closed reason and exact ordered two-record evidence (case record then `{ source: "provider-config", reason: "engine-not-run" }`); a config read failure is `config-invalid` or `provider-chain-unresolved` according to its own `reason` (so `{ok:false, reason:"provider-chain-unresolved"}` is reachable at command level and carries the pinned `failureCode:<code>` detail supplied by the edge), and a park-fold failure uses `{ source: "provider-parks", reason: "state-unreadable" }` with the park read's `failureCode`/`failureClass` in the pinned form where supplied; no config/park failure record carries a free-form detail, and the defensive `ok:true` view and `provider-chain-not-declared` carry no failure detail; no chain/config/park failure yields satisfied or an `available` availability claim; the engine is never called; chain parks are unsatisfied with the pinned `chain:<name>; until:<expiry or none>; cause:<cause or none>` detail.

#### TC-QREADY-013 - Close association by branch convention

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DEC-9, DEC-12, DM-6, AC-F10-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-close.test.ts`, `tests/fixtures/queue-ready/close/cases.ts`
**Tags**: @backend

**Given** the bounded open-pull-request page bound to the `origin` repository (command level) and, separately, a pure-evaluator injected normalized view that may contain merged/closed objects,
**When** association is evaluated for a candidate ref,
**Then** a source branch with at least three non-empty segments and any segment exactly equal to the ref case-insensitively is associated; substring, prefix, and short refs are not; below-limit command-level absence is always `not-associated` with `pr-not-associated` (never `pr-not-open`); in the evaluator-injected view a below-limit page whose only matches are merged/closed yields `not-associated` with `pr-not-open` and the merged/closed object is never selected or counted; an at-limit page with no open match is `unknown`/`pr-association-unknown` in both layers.

**Preconditions**:

- `close/cases.ts` source refs: `feat/GH-176/queue-ready`; `fix/GH-176/x`; `refs/heads/feat/gh-176/y` (segment `gh-176`); `feat/GH-1760/x`; `feat/GH-176` (two segments); `feat/x/GH-176y`; `feat/x/queue-ready`; `feature/GH-176/a/b` (four segments).
- The candidate refs `GH-176`, `GH-1760`, `GH-17`.
- A PR page below the limit (fewer than 100 raw items) and a page of exactly 100.

**Steps**:

1. Given `feat/GH-176/queue-ready`, when evaluated for `GH-176`, then assert `close.association === "associated"` and the selected `sourceRef` matches.
2. Given `fix/GH-176/x` and `feature/GH-176/a/b`, when evaluated, then assert associated (any type, >=3 segments, exact segment).
3. Given `refs/heads/feat/gh-176/y`, when evaluated, then assert associated via case-insensitive exact segment equality.
4. Given `feat/GH-1760/x` for `GH-176`, when evaluated, then assert not associated (exact segment, no substring/prefix match).
5. Given `feat/GH-176` (two segments) for `GH-176`, when evaluated, then assert not associated (`QUEUE_READY_BRANCH_SEGMENT_MIN = 3`).
6. Given `feat/x/GH-176y`, when evaluated, then assert not associated.
7. At command level, given a below-limit open-only page with no match of any state, when evaluated, then assert `close.association === "not-associated"` with `pr-not-associated` (never `pr-not-open`), `close.pullRequest` absent, `associatedCount === 0`, and the fallback class (`new-start` when ready, `not-ready` when not ready).
8. At the pure-evaluator level, given an injected normalized view whose below-limit page contains only matching merged/closed objects and no open match, when evaluated, then assert `close.association === "not-associated"` with `pr-not-open`, `close.pullRequest` absent, `associatedCount === 0`, and the same fallback class; assert the merged/closed object is never selected or counted. This case is unreachable through the open-only command read and is asserted only over the injected view.
9. Given an at-limit page (exactly 100 raw items) with no open match, when evaluated at command level, then assert `close.association === "unknown"` (not `not-associated`) with `pr-association-unknown`, the payload-level `source-truncated` reason, payload `truncated: true`, and `associatedCount` as a page-bounded lower bound in `0..100`. Repeat at the pure-evaluator level with injected merged/closed matches and assert the at-limit rule still wins (`unknown`/`pr-association-unknown`), never `pr-not-open`.
10. Assert only `sourceRef` is used for association; `targetRef` differences do not create or remove a match.
11. Controls: remove the ref segment -> not associated; add the exact segment -> associated; shrink the command page from 100 to 99 with the same no-match -> association flips from `unknown` to `not-associated`; in the evaluator view, change a merged object to open -> `pr-not-open` flips to `pr-associated`.

**Expected Outcome**:

- Branch association is exactly the declared segment rule, no substring/prefix matching, and command-level absence is only `not-associated` below the page limit with `pr-not-associated` and an exact `associatedCount`; `pr-not-open` and merged/closed exclusion are pure-evaluator rules over injected views; the at-limit page stays `unknown` with `pr-association-unknown` and a page-bounded lower bound in both layers.

#### TC-QREADY-014 - Close classification: merge-ready/review-pending/new-start/unknown/not-ready

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DEC-9, DM-5, DM-6, AC-F10-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-close.test.ts`, `tests/fixtures/queue-ready/close/cases.ts`
**Tags**: @backend @golden

**Given** a combination of association state, review-signal availability, observed review state, draft state, and readiness,
**When** `closeClass` is derived,
**Then** Appendix E is reproduced exactly: `merge-ready` only with observed approval on a non-draft associated PR, `review-pending` for every other associated open PR, a command-level below-limit no-match is `pr-not-associated`, an evaluator-injected below-limit merged/closed-only page is `pr-not-open` with the not-associated fallback, `new-start`/`unknown` only for ready candidates, and `not-ready` otherwise.

**Preconditions**:

- Appendix E rows: associated + observed approved + non-draft; associated + observed approved + draft; associated + observed `changes-requested`/`open` + any draft; associated + review unavailable + any draft; not associated + ready + `pr-not-associated` (command level); not associated + not ready + `pr-not-associated`; not associated + merged/closed-only + ready + `pr-not-open` (evaluator-injected view only); not associated + merged/closed-only + not ready + `pr-not-open`; unknown + ready; unknown + not ready.
- `reviewStateObserved` true/false fixtures and `reviewState` values from the closed review vocabulary.

**Steps**:

1. Given an associated non-draft PR with `reviewStateObserved: true` and `reviewState: "approved"`, when evaluated, then assert `closeClass === "merge-ready"` and class rank 0 (the payload `rank` is the 1-based sorted position, not the class bucket).
2. Given the same PR as a draft, when evaluated, then assert `closeClass === "review-pending"` (draft can never be merge-ready).
3. Given an associated non-draft PR with `reviewStateObserved: false` (review signal unavailable), when evaluated, then assert `closeClass === "review-pending"` and `reviewState` is absent/unknown; assert no approval is fabricated.
4. Given an associated non-draft PR with observed `changes-requested` or `open`, when evaluated, then assert `review-pending`.
5. Given an associated PR and `ready: false` for any reason, when evaluated, then assert the close class remains `merge-ready` or `review-pending` (close beats start); assert the human line can print both close evidence and blocking conditions.
6. Given no associated PR, `association: "not-associated"`, `reason: "pr-not-associated"`, and all six conditions satisfied, when evaluated, then assert `closeClass === "new-start"`.
7. Given `not-associated`/`pr-not-associated` and at least one non-satisfied condition, when evaluated, then assert `closeClass === "not-ready"`.
8. At the pure-evaluator level, given an injected normalized view whose below-limit page has only matching merged/closed objects (`not-associated`/`pr-not-open`), when evaluated, then assert the same fallback (`new-start` when ready, `not-ready` when not ready); assert no `merge-ready` or `review-pending` is produced from a merged/closed object. At command level the open-only read can never produce `pr-not-open`; it yields `pr-not-associated`.
9. Given association `unknown` with `pr-association-unknown` and `ready: true`, when evaluated, then assert `closeClass === "unknown"` (never `new-start`).
10. Given association `unknown` and `ready: false`, when evaluated, then assert `closeClass === "not-ready"`.
11. Controls: flip `reviewStateObserved` from false to true with `approved` -> `merge-ready`; flip `draft` true -> `review-pending`; remove the only matching PR below the limit -> `new-start`/`not-ready`; in the evaluator view, turn a merged/closed-only page into an at-limit page -> `unknown`/`not-ready`.

**Expected Outcome**:

- Appendix E is exact: merge-ready is reachable only from an observed approval on a non-draft open PR; unknown review is at most review-pending; a command-level below-limit no-match is `pr-not-associated`, while an evaluator-injected merged/closed-only page is `pr-not-open` with the not-associated fallback and never a close class; unknown association is never fabricated as a new start; not-ready never outranks its close class.

#### TC-QREADY-015 - Association unknown sources never become new-start

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DEC-12, DM-6, AC-F10-1, AC-F14-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-close.test.ts`, `tests/fixtures/queue-ready/close/cases.ts`, `tests/fixtures/queue-ready/negative-controls/cases.ts`
**Tags**: @backend

**Given** an unavailable repository binding, a failed pull-request read, or a page at its declared limit with no open match, for a candidate whose six conditions are satisfied,
**When** association is evaluated,
**Then** association is `unknown`, the close class is `unknown` (class rank 3; the payload `rank` is the 1-based sorted position), and the candidate is never reported as `new-start`.

**Preconditions**:

- Three unknown-association sources: binding unavailable (zero PR reads), PR read `ok: false` (`read-failed` or `credential-unavailable`), and a 100-item page with no match.
- A below-limit no-match control and a restored associated control.
- A ready candidate fixture and a not-ready candidate fixture.

**Steps**:

1. Given a ready candidate and an unavailable binding, when evaluated, then assert `close.association === "unknown"`, `closeClass === "unknown"`, `ready: true`, and no PR read occurred; assert `new-start` is absent.
2. Given a ready candidate and a failed PR read, when evaluated, then assert `unknown`/`unknown` and `new-start` absent; assert the top-level reasons include the read failure.
3. Given a ready candidate and a command-level 100-item open-only page with no open match, when evaluated, then assert `close.association === "unknown"` with `pr-association-unknown`, the payload-level `source-truncated` reason, payload `truncated: true`, and `associatedCount` as a page-bounded lower bound in `0..100`; assert the candidate is not `new-start`. Repeat at the pure-evaluator level with injected merged/closed matches and assert the at-limit rule still wins (`unknown`/`pr-association-unknown`), never `pr-not-open`.
4. Given a not-ready candidate for each unknown source, when evaluated, then assert `closeClass === "not-ready"` (the unknown association class applies only to ready candidates).
5. Given the command-level below-limit open-only no-match control, when evaluated, then assert `not-associated` with `pr-not-associated` (never `pr-not-open`) and `new-start`/`not-ready`; given an evaluator-injected below-limit merged/closed-only control, assert `not-associated` with `pr-not-open` and the same fallback class; the contrast proves the at-limit/failed cases are not treated as absence.
6. Assert the human line prints `close association unknown` for the unknown class and never `all six readiness conditions satisfied` (which is the new-start line).
7. Assert no control fabricates `merge-ready` or `review-pending` from an unavailable association.
8. Controls: restore the binding/read and an associated PR, then assert association becomes `associated` and the class becomes a close class.

**Expected Outcome**:

- Unknown association is explicit at class rank 3; it is never rendered as `new-start` or as absence; failed reads and at-limit pages are not treated as complete; command-level below-limit no-match is `pr-not-associated`, while `pr-not-open` is evaluator-only.

#### TC-QREADY-016 - Deterministic PR selection and merged/closed exclusion

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-6, Appendix E, AC-F10-1, NFR-3, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-close.test.ts`, `tests/fixtures/queue-ready/close/cases.ts`
**Tags**: @backend @golden

**Given** multiple open pull requests associated with the same candidate, in varying API orders, plus (at the pure-evaluator level) injected merged/closed objects,
**When** the close item is selected and rendered,
**Then** selection happens within one close class (the merge-ready set when it is non-empty, otherwise the full associated set), then by `entityId` ascending with a numeric-aware comparison (when both values are all-ASCII-digit, compare unsigned integer values and treat equal numeric values as a tie at this key; otherwise compare lexically), then `sourceRef` ascending, then `targetRef` ascending, then the lexically smaller raw `entityId` string only when all three keys are equal; API return order never decides; `associatedCount` counts open matches only (`0..100`, exact below the limit, page-bounded at it, 0 on failed read/unavailable binding); in an evaluator-injected view merged/closed objects are never selected or counted; the result is order-independent.

**Preconditions**:

- Cases: two associated non-draft non-approved PRs with entityIds `10` and `9`; two merge-ready PRs with entityIds `12` and `10` plus a review-pending PR with a lower entityId to prove the merge-ready set is preferred; numeric-tie pairs (`7` and `007`) with (a) different `sourceRef`, (b) equal `sourceRef` and different `targetRef`, and (c) equal `sourceRef` and equal `targetRef`; at the pure-evaluator level, a matching merged PR and a matching open PR and a page with only matching merged/closed objects; reversed API orders.
- The raw page size below the limit so association is observed. Merged/closed cases are asserted only over an injected normalized view, never through the open-only command read.

**Steps**:

1. Given associated open PRs with entityIds `10` and `9` (neither merge-ready), when evaluated, then assert the selected PR is `9` (numeric, not lexical).
2. Given two merge-ready PRs with entityIds `12` and `10` plus a review-pending PR with a lower entityId (for example `1`), when evaluated, then assert a merge-ready PR is selected (the lower numeric merge-ready PR `10`), never the lower-ranked review-pending PR.
3. Given a numeric tie (`7` and `007`) with different `sourceRef`, when evaluated, then assert the tie breaks on lexical `sourceRef` ascending.
4. Given a numeric tie (`7` and `007`) with equal `sourceRef` and different `targetRef`, when evaluated, then assert the tie breaks on lexical `targetRef` ascending.
5. Given a numeric tie (`7` and `007`) with equal `sourceRef` and equal `targetRef`, when evaluated, then assert the final defensive key selects the lexically smaller raw `entityId` string (`007`).
6. Assert `close.associatedCount` is an integer in `0..100` that equals the hand-computed number of matching open PRs (for example 2 or 3) even though only one PR is rendered; assert it is exact below the page limit and not separately capped.
7. At the pure-evaluator level, given an injected view with a matching merged PR and a matching open PR, when evaluated, then assert the merged object is not selected and the open one is; assert `associatedCount` counts only the open match. The open-only command read cannot contain the merged object.
8. At the pure-evaluator level, given an injected view with only matching merged/closed objects below the limit, when evaluated, then assert association is `not-associated` with `pr-not-open`, `associatedCount === 0`, and the not-associated fallback class; assert no close class is fabricated from the merged object.
9. Given the same fixture with the PR array reversed and shuffled, when evaluated, then assert the selected `entityId`, `sourceRef`, `targetRef`, `closeClass`, `associatedCount`, and `rank` are identical.
10. Given two candidates whose PR matches overlap (for example a shared segment), when evaluated, then assert each candidate's association/selection/count is independent and deterministic.
11. Given an at-limit PR page, when evaluated, then assert `associatedCount` is a page-bounded lower bound in `0..100` (not an exact total and not separately capped); given a failed read or an unavailable binding, assert `associatedCount === 0`.
12. Controls: change one PR from `approved` to `changes-requested` and assert selection/class change as Appendix E dictates; remove the merge-ready candidate PR and assert the next rule (the associated-set order) applies; in the evaluator view, turn a merged/closed-only page into an at-limit page and assert the association flips to `unknown`/`pr-association-unknown`.

**Expected Outcome**:

- PR selection is deterministic and independent of API order within one close class (merge-ready set first when non-empty, otherwise the associated set); the same-class order is `entityId` numeric-aware (equal all-digit values tie), then `sourceRef`, then `targetRef`, then the raw `entityId` string lexically, after which API order still never decides; merged/closed PRs are never open close items (evaluator-injected view only); `associatedCount` counts open matches only, is exact below the limit, page-bounded at it, and `0` on a failed read or unavailable binding.

#### TC-QREADY-017 - Ranking and numeric-aware tie-breakers

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, DEC-9, DM-7, AC-F11-1, NFR-4
**Test Type(s)**: Integration, Contract, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-ranking.test.ts`, `tests/fixtures/queue-ready/ranking/cases.ts`
**Tags**: @backend @golden

**Given** candidates spanning all five close classes, with numeric and textual ref ties,
**When** the ranked set is produced,
**Then** the order is `merge-ready` -> `review-pending` -> `new-start` -> `unknown` -> `not-ready`; ties break on the numeric suffix ascending then canonical ref text ascending; `rank` is 1-based; caller and API order never affect the result.

**Preconditions**:

- A five-candidate fixture with one candidate per class, and a same-class fixture with refs `GH-9`, `GH-10`, `GH-100`, `GH-7`, `GH-007` (canonical ascending: `GH-007`, `GH-7`, `GH-9`, `GH-10`, `GH-100`).
- A caller-order permutation matrix (at least forward, reverse, and shuffled) and a PR-order permutation twin.
- A cap-sized 8-candidate fixture.

**Steps**:

1. Given one candidate per class, when ranked, then assert the class order is exactly `merge-ready`, `review-pending`, `new-start`, `unknown`, `not-ready` and the ranks are `1..5`.
2. Given a ready new start and a review-pending close item that is not ready, when ranked, then assert the close item ranks above the new start.
3. Given a not-ready candidate and any close item, when ranked, then assert the close item ranks above the not-ready candidate.
4. Given same-class refs `GH-9`, `GH-10`, `GH-100`, when ranked, then assert the numeric order `GH-9`, `GH-10`, `GH-100` (not lexical `GH-10`, `GH-100`, `GH-9`).
5. Given `GH-7` and `GH-007` (numeric suffix equal at 7), when ranked, then assert the canonical text ascending order `GH-007` before `GH-7` (never `GH-7` before `GH-007`) and record that the numeric comparison parses digits after the final hyphen; a numeric-equal pair therefore falls through to canonical text ascending.
6. Given the caller-order permutations, when ranked, then assert the payload candidate order, ranks, and summary are identical; the caller order is not a tie-breaker.
7. Given the PR-array permutations, when ranked, then assert the selected PR and the rank are identical.
8. Given 8 cap-sized candidates, when ranked, then assert ranks are the contiguous integers `1..8`, no duplicate rank, and every `rank` equals its 1-based position.
9. Assert `rank` is never 0, never negative, and never > candidate count; assert `summary` class counts match the ranked set.
10. Control: change one candidate's class and assert the expected rank movement; a stale rank fails.

**Expected Outcome**:

- Ranking is a total, deterministic order with close items above ready new starts, numeric-aware ref ties, canonical-text tie-breaks, and 1-based contiguous ranks independent of caller/API order.

#### TC-QREADY-018 - Machine payload: one envelope, schema, closed vocabularies

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, DM-1, DM-2, DM-3, DM-4, DM-8, DM-9, DM-13, AC-F12-1, AC-F12-2, NFR-2, NFR-5, NFR-10
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/corpus/**`, `packages/testkit/src/result-conformance.ts`
**Tags**: @backend @golden

**Given** a successful `queue ready --json` run over the corpus,
**When** stdout is parsed,
**Then** there is exactly one valid `CommandResult` envelope whose `data` is the full `delivery.queue-ready.v1` payload with the required fields, closed vocabularies, derived summary, and no `error` key or raw payload.

**Preconditions**:

- A corpus fixture with three candidates spanning `new-start`, `review-pending`, and `not-ready`.
- `assertEnvelopeContract` from `packages/testkit/src/result-conformance.ts`.
- A forbidden-key/native-key scanner (`reviewDecision`, `check_suite`, `check_runs`, `issue_links`, `updated_at`, `review_threads`, raw URL, token-like canary).

**Steps**:

1. Given the corpus fixture, when run with `--json`, then assert stdout parses as exactly one object, `assertEnvelopeContract` returns `[]`, exit `0`, and no `error` key.
2. Assert `data.schemaVersion === "delivery.queue-ready.v1"` and `data.generatedAt` equals the injected fixed clock in ISO-8601 UTC.
3. Assert `data.repository` is an observed `{state, host: "github.com", owner, name, remoteName: "origin"}` or an unavailable `{state, reason}` with reason in `{addressing-unresolved, remote-unsupported}`; assert no userinfo, credential, or raw remote URL.
4. Assert `data.head` has only `branch?`/`sha?`; assert the observed branch/SHA equal the injected facts.
5. Assert `data.candidates` is in rank order; each candidate has `workItemRef` (canonical uppercase prefix, digits preserved, <=64 chars), `rank` (1-based integer), `ready` (boolean), `closeClass` (closed set), `workItem` (observed with item state, at most 16 labels of at most 128 chars, `updatedAt` of at most 40 chars, and only the at most 16 `blocked-by` relations whose projected target is `entityId`-only (no `systemName`) with `entityId` at most 128 chars — no other relation kind, no title, body, comment, or assignee — or unknown with a reason), `close` (DM-6 shape whose selected-PR identity is `entityId`-only with no `systemName`, `entityId`/`sourceRef`/`targetRef` capped at 128 chars), exactly six `conditions` in fixed order, `blockingConditions`, and `truncated`. Assert every observed `repository.owner`/`repository.name` is <=128 chars and `head.branch` <=256 chars.
6. Assert each condition has one closed state and 1..2 evidence records; each evidence has a closed `source` and `reason`; `detail`, when present, is a string <=160 characters; assert no raw provider payload, response body, comment, credential, or free-form message.
7. Assert `data.summary` has exactly `{candidates, ready, notReady, mergeReady, reviewPending, newStart, unknownClose}`, each a non-negative integer, computed from the rendered candidates.
8. Assert `data.reasons` is unique, <=6, follows the `QUEUE_READY_REASON_ORDER` six-group order with first-occurrence wins, and every entry is in the closed readiness reason set; assert verdict/observation reasons never appear; assert the payload-level `truncated` is a boolean and that an over-cap reason list sets it (exact order/cap matrix in TC-QREADY-034).
9. Assert the payload contains no `error`, no provider-native keys, no token-like canary, no `workItem.title` key, and no title/notes canary anywhere.
10. Negative controls: remove a required field, rename `schemaVersion`, add an `error` key on success, and inject a raw provider key; each must fail by name; the unmutated control is green.
11. Given the cap-sized over-long provider fixture (over-long identity/ref/label/owner/name/branch/timestamp and an over-long `systemName` (200 characters) on relation targets and pull-request identities, more than 16 labels and relations), when run in human mode, then assert each per-candidate provider PR segment (`PR #<entityId>` and `<sourceRef>`) is at most 32 UTF-8 bytes including a trailing `+` when shortened with no split code point, the header owner/name is <=128 UTF-8 bytes each and branch <=256 UTF-8 bytes, the digest is <=16 lines and <=4096 UTF-8 bytes (candidate line <=400, header plus summary <=620), the payload remains <=65 536 bytes, and neither the payload nor the digest contains a `systemName` key or the over-long `systemName` value; the detailed cap matrix is TC-QREADY-038.

**Expected Outcome**:

- Exactly one valid envelope carries the complete bounded `delivery.queue-ready.v1` payload with closed vocabularies, derived summary, and no forbidden material; provider-derived values stay inside their nine caps, every projected relation-target and pull-request identity is `entityId`-only with no `systemName` (even when the source `systemName` is over-long), only `blocked-by` relations are carried, the cap-sized human digest stays <=16 lines/4096 UTF-8 bytes with 32-UTF-8-byte provider segments (including a trailing `+`, no split code point), <=400-UTF-8-byte candidate lines, <=620-UTF-8-byte header plus summary, and the byte-aware renderer never throws for a legal payload; missing required fields fail.

#### TC-QREADY-019 - Payload bounds, caps, and truncation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, DM-11, DM-4, DM-1, AC-F12-1, AC-F12-2, NFR-2
**Test Type(s)**: Contract, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/bounds/{under-cap,at-cap,cap-sized,over-cap,at-limit}/**`, `tests/fixtures/queue-ready/caps/**`
**Tags**: @backend @golden

**Given** under-cap, at-cap, cap-sized, over-cap, and source-at-limit fixtures,
**When** the payload is serialized,
**Then** every declared cap and character bound is enforced or rejected — including the nine provider-derived projection caps — the 65 536-byte `data` bound is a hard contract met by the byte-budget reduction, a provider-derived clamp sets payload `truncated` + `value-clamped` while a derived-detail clamp sets no flag, and the per-drop-cause flag matrix is asserted by TC-QREADY-035; the full cap matrix and output-only equality are asserted by TC-QREADY-038.

**Preconditions**:

- `bounds/under-cap` (2 candidates, short details), `bounds/at-cap` (8 candidates), `bounds/cap-sized` (8 candidates, maximal conditions/evidence/details, no title field), `bounds/at-limit` (100-item issues and PR pages; 20-run check-runs page), `bounds/over-cap` (a 9th candidate injected in memory and a payload whose serialized `data` would exceed 65 536 bytes after every field cap), and `caps/over-long` (provider-derived fields above each declared cap).
- The constants from Appendix C: 8 candidates, 64-char canonical ref cap, 6 conditions, 2 evidence, 6 reasons, 160 detail chars, 65 536 bytes, 100-source item limit, 20-run pipeline limit, identity 128, provider ref 128, label 128, labels 16, `blocked-by` relations 16, owner 128, repo name 128, branch 256, timestamp 40, human segment 32 UTF-8 bytes including a trailing `+`, plus the derived human budgets (400 UTF-8 bytes per candidate line, 620 UTF-8 bytes header plus summary, 4096 UTF-8 bytes total). There is no title cap.

**Steps**:

1. Given 1 and 8 candidates, when serialized, then assert success; measure `Buffer.byteLength(JSON.stringify(data))` and assert <=65 536; record the byte count in the test output.
2. Given the cap-sized fixture, when serialized, then assert 8 candidates, 6 conditions each, <=2 evidence each, <=6 reasons, every detail <=160 chars, no `workItem.title` key, and the total `data` <=65 536 bytes.
3. Given an over-160-character derived `detail` in the injected fact, when serialized, then assert the emitted detail is clamped to 160 characters and the raw oversized string is absent; assert a derived-detail clamp alone sets neither the candidate nor the payload `truncated`, emits no `source-truncated` and no `value-clamped` (it is not a provider-derived payload value; the clamp row of the TC-QREADY-035 matrix). A title in the raw provider fact never enters the payload, so there is no title-clamp case.
4. Given the over-cap 9th candidate injected in memory (bypassing the handler), when the contract assertion runs, then assert it fails by name; assert the handler rejects 9 refs as `input.value.rejected` (TC-QREADY-001).
5. Given a legal cap-sized candidate whose provider-derived fields exceed every declared cap, when serialized, then assert every projected relation-target and pull-request identity is `entityId`-only with no `systemName` and the whole identity object (`entityId`) <=128, each ref/label/owner/name <=128, labels <=16 in provider order, `blocked-by` relations <=16 in provider order with every other kind absent, branch <=256, timestamp <=40; assert payload `truncated: true` and `reasons` carries `value-clamped`; assert no field is silently dropped and no verdict changes (full matrix in TC-QREADY-038).
6. Given a payload whose serialized `data` would exceed 65 536 bytes after every field cap, when the projection runs, then assert it drops trailing relations then trailing labels (last-ranked candidate first) to fit <=65 536 bytes, with `truncated: true` + `value-clamped` and no verdict change; the pre-reduction over-budget shape injected directly into the serializer must fail by name as a contract failure (never silently truncated).
7. Negative controls: remove `truncated` from a drop case and assert failure; set `truncated: false` on a drop case and assert failure; the under-cap control must be `truncated: false` with no `source-truncated`/`value-clamped`.
8. Record the measured byte counts and cap margins in the test output for the PR evidence; do not relax the 65 536-byte bound.
9. Assert the drop-cause flag matrix (evidence-cap, reason-cap, source-at-limit, CI at-limit, provider clamp/byte-budget, derived-detail clamp) is covered end-to-end by TC-QREADY-035, so no truncation rule is left untested by this scenario's narrower byte/character focus.
10. Given the cap-sized provider fixture in human mode, then assert each per-candidate provider PR segment is <=32 UTF-8 bytes including a trailing `+` when shortened with no split code point and the digest is <=16 lines/4096 UTF-8 bytes with a <=400-byte candidate line and <=620-byte header plus summary (the human goldens are updated in TC-QREADY-029).

**Expected Outcome**:

- All caps and character bounds are measured and enforced at the contract level; the canonical ref cap is 64 and the payload carries no title field; the nine provider-derived caps are enforced with `value-clamped` + payload `truncated`, and every projected identity is `entityId`-only with no `systemName`; the serialized `data` bound is met at cap size by the deterministic byte-budget reduction (an unreduced over-budget payload is a contract failure); a derived-detail clamp is inert on the truncation flags; the cap-sized human digest is <=16 lines/4096 UTF-8 bytes with 32-UTF-8-byte provider segments, <=400-UTF-8-byte candidate lines, and <=620-UTF-8-byte header plus summary; the drop-cause flag matrix lives in TC-QREADY-035 and is not silently weakened here.

#### TC-QREADY-020 - Human digest grammar and bounds

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, DM-12, AC-F13-1, AC-F12-2, NFR-2, NFR-6
**Test Type(s)**: Contract, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/golden/human.txt`, `tests/fixtures/queue-ready/caps/{human-astral-8,human-over-budget}/**`, `tests/golden/helpers.ts`
**Tags**: @backend @golden

**Given** a successful human-mode run over candidates spanning every close class,
**When** the digest is rendered,
**Then** it is the Appendix F grammar with the DM-12 byte budgets: an optional header, exactly one summary line, exactly one line per candidate in rank order, close evidence and blocking conditions as applicable, every rendered provider segment at most 32 UTF-8 bytes including a trailing `+` (no split code point), header owner/name at most 128 UTF-8 bytes each and branch at most 256 UTF-8 bytes, each candidate line at most 400 UTF-8 bytes, header plus summary at most 620 UTF-8 bytes, and the whole digest <=16 lines and <=4096 UTF-8 bytes; an 8-candidate astral worst case still exits `0` with no throw and no `fallback.internal`; a synthetic over-budget payload drops trailing candidate lines in reverse rank order with `+more` and changes no payload field or reason; there are no titles/timestamps/raw payloads/secrets/LLM prose and zero extra reads.

**Preconditions**:

- A fixture with 5 candidates: merge-ready (ready), review-pending (not ready), new-start (ready), unknown (ready), not-ready.
- A fixture with an associated close item that is also not ready (must print close evidence + blocking).
- A truncated payload fixture and a binding-unavailable fixture (no header).
- A read-count parity harness: the same fixture run with `--json` and human mode.
- `caps/human-astral-8/**`: 8 candidates, a 256-code-point astral head branch, and in-cap multi-byte (astral/CJK) PR `entityId`/`sourceRef` values, so only byte-aware renderer caps keep the digest within 4096 bytes.
- `caps/human-over-budget/**`: a synthetic legal payload whose fully byte-capped render (retaining the `+more` marker) would still exceed 4096 bytes, used only to exercise the defensive reverse-rank line drop.

**Steps**:

1. Given the five-class fixture, when rendered, then assert exactly one summary line matching `ready <n> | not-ready <n> | merge-ready <n> | review-pending <n> | unknown-close <n>` with counts equal to `data.summary`.
2. Assert exactly one candidate line per candidate, in rank order, each starting with `<rank>. <ref>`, naming the close class, and ending with the fixed proxy-source suffix `[repo:local-context; tier:priority-label]` after its detail and any `blocking:` segment.
3. Given the merge-ready candidate, assert the line contains a `PR #<entityId> <sourceRef>` provider segment where each segment (`PR #<entityId>` as one segment, `<sourceRef>` as the other) is rendered to at most 32 **UTF-8 bytes** including the trailing `+` when shortened (the `+` counts toward the 32-byte cap), and assert the rendered bytes are a code-point-preserving prefix: no split code point and no lone surrogate. Given the review-pending candidate, assert the same close evidence form; given the new-start candidate, assert `all six readiness conditions satisfied`; given the unknown-close candidate, assert `close association unknown`; given the not-ready candidate, assert `blocking: <id>=<state>, ...` in fixed order. In every case the fixed suffix follows the detail. The over-long and astral provider fixtures prove the 32-UTF-8-byte segment rule; the payload keeps its own capped values and is not shortened to the render cap.
4. Given a close item that is also not ready, assert the line carries the close evidence followed by ` | blocking: ...` (both), and then the fixed suffix.
5. Given a truncated payload, assert `+more` follows the summary line; given an untruncated payload, assert `+more` is absent.
6. Given a binding-observed, SHA-resolved fixture, assert the optional header appears and contains the injected binary name, `owner/name`, the branch or `detached`, and the 7-character SHA prefix; assert owner/name are rendered at most 128 UTF-8 bytes each and branch at most 256 UTF-8 bytes with a trailing `+` when shortened, using the multi-byte owner/name/branch fixture so a character-count-only renderer would exceed the byte budget; given binding unavailable or SHA unresolved, assert no header.
7. Assert the digest is <=16 lines (split on newline) and `Buffer.byteLength(stdout, "utf8") <= 4096`; measure every candidate line and assert <=400 UTF-8 bytes; measure header plus summary and assert <=620 UTF-8 bytes; include the fixed suffix in every byte count. Given the cap-sized fixture (six blocking conditions, maximal refs, over-long provider values), assert the same bounds with every provider segment at most 32 UTF-8 bytes including `+`.
8. Given `caps/human-astral-8` (8 candidates, astral 256-code-point head branch, in-cap multi-byte PR `entityId`/`sourceRef`), when run in human mode through `runCli`, then assert the digest is at most 4096 UTF-8 bytes, the exit code is `0`, stdout is non-empty, no `RangeError` escapes the renderer, and the result contains no `fallback.internal`; assert the payload's machine `data` is still <=65 536 UTF-8 bytes and byte-identical to the `--json` run of the same fixture.
9. Given `caps/human-over-budget`, when rendered, then assert the defensive line drop: trailing candidate lines are removed in reverse rank order (last-ranked candidate first, then the next-highest rank), the header (when present) and the summary line are kept, and `+more` follows the summary; assert the surviving lines are exactly the highest-ranked candidates; assert the payload machine bytes, `data.truncated`, `reasons`, and `summary` are identical to the same payload rendered without the drop (no new reason token, no payload `truncated` flip), the digest is <=16 lines/4096 UTF-8 bytes, and the command exits `0` with no `fallback.internal`.
10. Assert the digest contains no candidate title, no timestamp other than the injected header SHA/branch, no raw JSON, no secret/token canary, and no LLM-style prose; assert truncation does not leak a dropped detail and a reverse-rank line drop does not leak a dropped candidate's title or evidence.
11. Assert human mode performs zero extra source reads: compare every reader counter with the `--json` run over the same fixture; assert equality.
12. Negative controls: inject a title canary and a secret canary into the raw facts; assert neither appears in the human text (the payload has no title field, so a title can never surface); assert the provider segments carry no `available` claim (the pinned condition id, condition-id list, `blocking:` lines, summary tokens, and close classes are exempt; the scan is scoped to the provider segment); add an extra candidate line and assert the line-count assertion fails; a line missing the fixed suffix fails by name; a renderer forced to character-count a multi-byte segment fails the 32-byte assertion by name; a renderer that throws instead of dropping trailing lines fails the `caps/human-over-budget` case by name; the golden control is byte-identical (TC-QREADY-029).

**Expected Outcome**:

- The human digest is deterministic, bounded, and derived only from the payload; one line per candidate in rank order; both close evidence and blocking conditions appear for a close item that is not ready; every candidate line ends with `[repo:local-context; tier:priority-label]`; each provider segment is <=32 UTF-8 bytes including a trailing `+` with no split code point; header owner/name and branch are byte-capped at 128/256 UTF-8 bytes; candidate lines are <=400 UTF-8 bytes and header plus summary <=620 UTF-8 bytes; the 8-candidate astral worst case stays <=4096 UTF-8 bytes and exits `0` with no `fallback.internal`; a synthetic over-budget payload exercises the reverse-rank line drop with `+more` while leaving every payload field and reason unchanged; no titles, timestamps, secrets, or extra reads.

#### TC-QREADY-021 - Exhaustive negative-control matrix

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-14, F-15, DM-3, DM-9, DM-10, AC-F14-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-negative-controls.test.ts`, `tests/fixtures/queue-ready/negative-controls/cases.ts`
**Tags**: @backend @golden

**Given** the twenty-two AC-F14-1 controls, each with a restored control,
**When** `queue ready` runs on each,
**Then** each control is asserted on its targeted surface: the targeted readiness condition/source is `unknown` or `unsatisfied` (never `satisfied`) when the targeted source is absent, failed, unattempted, unavailable, or unresolved, and a non-satisfied readiness condition never yields a `ready` claim; when the targeted signal is close association the candidate may remain `ready` with all six conditions satisfied and `closeClass` is `unknown`; no control yields a `merge-ready` claim without an observed approval on a non-draft open PR or an all-clear, and the PR-read-failure, binding-unavailable, and at-limit no-match controls never yield a `new-start` claim; every control is reflected in the condition state and reason, and the command exits `0`.

**Preconditions**:

- The twenty-two controls and their per-control targeted expectations (the negative-control matrix in `negative-controls/cases.ts`). Each row is asserted on its targeted surface; a row is never required to make the whole candidate not-ready. The count is 22 everywhere (spec AC-F14-1 and the plan reference the same 22).

  | # | Control | Targeted surface | Expected targeted outcome |
  |---|---|---|---|
  | 1 | deps relations unavailable | `deps-satisfied` source | `unknown`/`signal-unavailable`; not ready |
  | 2 | candidate work item unobserved | `deps-satisfied`, `tier-known`, `no-owner-gate` observation | `unknown`/`work-item-unobserved` on each; not ready |
  | 3 | PM context missing | `repo-free` source | `unknown`/`local-context-missing`; not ready |
  | 4 | PM context malformed | `repo-free` source | `unknown`/`local-context-malformed`; not ready |
  | 5 | another active change | `repo-free` predicate | `unsatisfied`/`other-active-change`; not ready |
  | 6 | tier absent | `tier-known` predicate | `unknown`/`tier-absent`; not ready |
  | 7 | tier conflict | `tier-known` predicate | `unsatisfied`/`tier-conflict`; not ready |
  | 8 | owner label present | `no-owner-gate` predicate | `unsatisfied`/`owner-labels`; not ready |
  | 9 | CI `none` | `ci-healthy` predicate | `unsatisfied`/`ci-none`; not ready |
  | 10 | CI `pending` | `ci-healthy` predicate | `unsatisfied`/`ci-pending`; not ready |
  | 11 | CI `canceled` | `ci-healthy` predicate | `unsatisfied`/`ci-canceled`; not ready |
  | 12 | CI `failed` | `ci-healthy` predicate | `unsatisfied`/`ci-failed`; not ready |
  | 13 | unresolved SHA | `ci-healthy` source | `unknown`/`commit-unresolved`; not ready |
  | 14 | failed check-runs read | `ci-healthy` source | `unknown`/`read-failed` with the pinned failure detail; not ready |
  | 15 | no default provider chain | `provider-available` source | `unknown`/`provider-chain-not-declared`, no failure detail; not ready |
  | 16 | unresolved provider chain | `provider-available` source | `unknown`/`provider-chain-unresolved`; command-level case carries `failureCode:<code>`, defensive `ok:true` twin carries no failure detail; not ready |
  | 17 | provider park-fold failure | `provider-available` source | `unknown`/`state-unreadable` from `provider-parks`, with the park read's code/class in the pinned form where supplied; not ready |
  | 18 | active provider park | `provider-available` predicate | `unsatisfied`/`all-entries-parked`; not ready |
  | 19 | active chain park | `provider-available` predicate | `unsatisfied`/`chain-parked`; not ready |
  | 20 | PR read failure | close association | all six conditions satisfied; close `unknown`/`pr-association-unknown`; `ready: true`; never `new-start` |
  | 21 | binding unavailable | tracker/CI/close sources | deps/tier/owner `unknown`/`work-item-unobserved`, CI `unknown`/`addressing-unresolved` or `remote-unsupported`, close `unknown`/`pr-association-unknown`; not ready; never `new-start` |
  | 22 | at-limit PR page with no match | close association | all six conditions satisfied; close `unknown`/`pr-association-unknown`; payload `source-truncated`; `ready: true`; never `new-start` |
- A restored control for every control, and a fully-satisfiable baseline.
- The `planted-queue-ready-*` canary rule from §4.2.

**Steps**:

1. For each control, when run, then assert the targeted surface from the matrix: for a readiness condition/source, the affected condition is `unknown` or `unsatisfied` (never `satisfied`) with its specific reason and bounded evidence; for the close-association controls (20/22, and 21's binding), the close association is `unknown` with `pr-association-unknown` and the readiness conditions remain whatever the source state dictates (all six satisfied for 20/22; deps/tier/owner/CI unknown for 21).
2. Assert `ready: true` only when all six conditions are satisfied — the PR-read-failure and at-limit-no-match controls are ready with all six satisfied and close `unknown`; for every not-ready control, assert `blockingConditions` names the affected condition(s) in fixed order (the binding-unavailable control names deps/tier/owner/CI).
3. Assert no control yields `merge-ready` without `reviewStateObserved: true` and observed `approved` on a non-draft PR; assert no control yields `new-start` from an unknown association.
4. Assert every control still produces a success envelope with exit `0`, six conditions per candidate, and every candidate rendered.
5. Assert the targeted condition's (or close surface's) evidence records/details and the corresponding human segment contain no all-clear token (`clear`, `green`, `nothing blocks`, `all good`) in a context that implies the affected condition is satisfied, and specifically that the **provider evidence/details and the provider human-text segment** never use `available` as a claim or state. The pinned condition id `provider-available` (in `conditions[].id`, the condition-id list, and `blocking: provider-available=<state>` lines), payload keys (`ready`, `notReady`, `mergeReady`, `reviewPending`, `newStart`, `unknownClose`), summary tokens (`ready`, `not-ready`, `merge-ready`, `review-pending`, `unknown-close`), and close classes (`merge-ready`, `not-ready`) are explicitly allowed and excluded from the scan. The scan is scoped to the affected condition's evidence/details and human segment, never the whole payload or digest, so the assertion is satisfiable. Negative control: a hand-planted `provider available` claim in a provider detail must fail by name; the unmutated control passes.
6. Assert the planted canary for each control is absent from stdout, stderr, evidence, and the human digest; the fixture builder asserts the canary was planted.
7. For every control, run the restored fixture and assert the targeted surface reaches its positive state (the affected condition, or the close association for controls 20/22), proving the negative is not vacuous.
8. Assert the matrix meta-check fails if any of the twenty-two named controls is missing from `negative-controls/cases.ts` (the expected cardinality is exactly 22).
9. Assert no control fails the command: the only error envelopes in this suite come from deliberate grammar/containment controls, not from source conditions.

**Expected Outcome**:

- The full negative-control matrix is covered and non-vacuous, asserted per control on its targeted condition/source: a targeted absent, failed, unattempted, unavailable, or unresolved readiness source never yields `satisfied`; a non-satisfied readiness condition never yields a `ready` claim; the PR-read-failure and at-limit-no-match controls keep all six conditions satisfied and yield `ready: true` with `closeClass: unknown` (never `new-start`), the binding-unavailable control is not ready, and no control yields `merge-ready` without observed approval or an all-clear; all controls remain success payloads with named evidence; every all-clear/`available` scan is scoped to the affected condition's evidence/details and human segment (the pinned condition id, condition-id list, `blocking:` lines, payload keys, summary tokens, and close classes are exempt), so it passes truthfully; the matrix meta-check fails on a missing control.

#### TC-QREADY-022 - Read-only execution: zero writes/fences/mutations/network writes/spawns/engine

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F1-2, NFR-4, NFR-7, NFR-10
**Test Type(s)**: Integration, Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-readonly-determinism.test.ts`, `tests/fixtures/state/harness.ts`, `tests/behaviour/verify-support.ts`, `tests/structure/queue-ready-imports.test.ts`
**Tags**: @backend @security

**Given** a guarded state store, a recording transport, a temp PM context, a child-process sentinel, and counting provider-engine/quota stubs,
**When** a fully-observed `queue ready` run and a degraded run execute,
**Then** the command performs zero writes, fence acquisitions, state mutations, network writes, provider-engine calls, quota fetches, and child processes; every seam is proven live by a seeded control.

**Preconditions**:

- A guarded store wrapping a real temp store: records `read`; throws on `append`/`replaceDocument`/`acquireFence`/`releaseFence`.
- A recording transport that throws on non-`GET` and unfixtured URLs.
- A child-process sentinel (module-level spy/guard) and an AST scan of queue-ready modules for `node:child_process`/`Bun.spawn`.
- A temp PM-context file with bytes/mtime captured; counting engine/`provider resolve`/`provider quota`/quota-transport stubs.

**Steps**:

1. Given a fully-observed run, when executed, then assert the store recorder saw `read` (proving the seam is live) and no mutation/fence call.
2. Assert the transport recorded only `GET` requests to the three declared endpoints (issues, pulls, check-runs) and zero `POST`/`PUT`/`PATCH`/`DELETE`; assert zero requests to quota/announcement/park-write endpoints.
3. Assert the PM-context file bytes and mtime are unchanged and no file was created under the temp root beyond the pre-existing fixtures.
4. Assert the child-process sentinel count is `0` and no queue-ready module imports `node:child_process`/`Bun.spawn`/`execSync` (AST).
5. Assert the engine, `provider resolve`, `provider quota`, and quota-transport stubs recorded `0` calls.
6. Assert the queue-ready domain/evaluator contains no `writeFileSync`, `appendFileSync`, `replaceDocument`, `acquireFence`, or network-write path (AST/grep).
7. Seeded controls: a deliberate append trips the store guard; a deliberate `POST` trips the transport; a deliberate spawn trips the sentinel; a deliberate engine call trips the stub. Each must fail, proving non-vacuity.
8. Assert `git status --porcelain` is unchanged for the live tree after the suite (the suite writes only under temp roots).
9. Assert the degraded run also performs zero writes/fences/engine calls and still returns a payload.

**Expected Outcome**:

- Queue ready is read-only by construction: zero writes, fences, mutations, network writes, engine calls, quota fetches, and child processes; every guard is proven live by a seeded control.

#### TC-QREADY-023 - Determinism and byte-identical replay

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F1-2, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-readonly-determinism.test.ts`, `tests/golden/helpers.ts`
**Tags**: @backend @golden

**Given** fixed run id, clock, brand, streams, and injected facts,
**When** the same invocation runs twice and a reversed-order twin runs,
**Then** machine and human output are byte-identical, ordering is input-order independent, and no ambient clock/randomness/environment enters the pure tiers.

**Preconditions**:

- A fixture spanning all five close classes, a cap-sized fixture, and a reversed caller/PR-order twin.
- `runCli` with fixed `runId` and clock; buffer sinks.
- AST scan of the pure evaluator/ranker/renderer for `Date.now`, `Math.random`, `process.env`, `Bun.env`, `performance.now`, `globalThis[...]`.

**Steps**:

1. Given identical injected inputs, when run twice with `--json`, then assert byte-identical stdout including whitespace/newline.
2. Given the same inputs, when run twice in human mode, then assert byte-identical stdout.
3. Given a fresh invocation with new stream objects and the same facts, when run, then assert identical bytes.
4. Given the reversed-order twin, when run, then assert candidate order, ranks, summary, and selected PR are identical; assert the only permitted differences are driven by a changed input fact.
5. Given one controllable fact change (for example one run conclusion from `succeeded` to `pending`), when run, then assert the payload changes in the expected bounded field, proving the equality is live.
6. Assert the pure evaluator/ranker/renderer contain no clock/randomness/ambient reads (AST); assert the clock is injected and used only for `generatedAt`.
7. Assert human text is derived from the same payload: compare the rendered summary/class counts/refs to the JSON digest; assert no second data path.
8. Assert the serialized `data` key order is stable across runs (the payload is assembled deterministically, not from map iteration).
9. Negative control: introduce a nondeterministic fact (unordered array input) and assert the ranker still produces the canonical order, proving the ranker sorts rather than preserves input order.

**Expected Outcome**:

- Identical injected inputs produce byte-identical payload and human text; caller/API order does not affect the result; no ambient clock, randomness, or environment enters the pure tiers.

#### TC-QREADY-024 - Declared constants and closed vocabularies

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-12, DM-3, DM-10, DM-13, AC-F2-1, AC-F12-1, NFR-1, NFR-2
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-ready-contract.test.ts`, `tests/structure/inventory.json`
**Tags**: @backend

**Given** the declared `QUEUE_READY_*` constants and the closed vocabularies,
**When** the structure suite runs,
**Then** every constant equals Appendix C, every condition id/order and state/class/reason/source set is closed and exact, and a mutation of any value fails by name.

**Preconditions**:

- Appendix C constants: `QUEUE_READY_SCHEMA_VERSION`, `QUEUE_READY_CONDITION_ORDER`, `QUEUE_READY_CONDITION_STATES`, `QUEUE_READY_CLOSE_CLASSES`, `QUEUE_READY_MAX_CANDIDATES` (8), `QUEUE_READY_MAX_POSITIONALS` (33), `QUEUE_READY_MAX_EVIDENCE_PER_CONDITION` (2), `QUEUE_READY_MAX_REASONS` (6), `QUEUE_READY_REASON_ORDER`, `QUEUE_READY_PAYLOAD_MARKER_REASONS` (`source-truncated`, `value-clamped`), `QUEUE_READY_SOURCE_FAILURE_REASONS`, `QUEUE_READY_ASSOCIATED_COUNT_RANGE`, `QUEUE_READY_MAX_DETAIL_CHARS` (160), `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS` (64), `QUEUE_READY_MAX_MACHINE_BYTES` (65536), `QUEUE_READY_MAX_HUMAN_LINES` (16), `QUEUE_READY_MAX_HUMAN_BYTES` (4096), `QUEUE_READY_SOURCE_ITEM_LIMIT` (100), `QUEUE_READY_SOURCE_PIPELINE_LIMIT` (20), `QUEUE_READY_MAX_IDENTITY_CHARS` (128), `QUEUE_READY_MAX_REF_CHARS` (128), `QUEUE_READY_MAX_LABEL_CHARS` (128), `QUEUE_READY_MAX_LABELS` (16), `QUEUE_READY_MAX_RELATIONS` (16), `QUEUE_READY_MAX_OWNER_CHARS` (128), `QUEUE_READY_MAX_REPO_NAME_CHARS` (128), `QUEUE_READY_MAX_BRANCH_CHARS` (256), `QUEUE_READY_MAX_TIMESTAMP_CHARS` (40), `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (32), `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN` (`^[0-9]+$`), `QUEUE_READY_TIER_LABELS`, `QUEUE_READY_OWNER_ATTENTION_LABELS`, `QUEUE_READY_WORK_ITEM_REF_PATTERN`, `QUEUE_READY_BRANCH_SEGMENT_MIN` (3), `QUEUE_READY_RANK_CLASS_ORDER`. There is no live-switch constant and no title constant.
- The closed reason set from DM-10 (41 tokens, including `value-clamped`) and the closed source set from DM-4, plus the `QUEUE_READY_REASON_ORDER` group sequence (group 2 = `source-truncated` then `value-clamped`; group 6 = exactly `pr-association-unknown`) and the seven-token `QUEUE_READY_SOURCE_FAILURE_REASONS` subset.

**Steps**:

1. Assert `QUEUE_READY_SCHEMA_VERSION === "delivery.queue-ready.v1"` and the contract type is exported from `core ./contracts`.
2. Assert `QUEUE_READY_CONDITION_ORDER` equals the six ids in order and no other condition id is declared.
3. Assert `QUEUE_READY_CONDITION_STATES` is exactly `["satisfied","unsatisfied","unknown"]` and `QUEUE_READY_CLOSE_CLASSES` is exactly `["merge-ready","review-pending","new-start","unknown","not-ready"]`.
4. Assert the numeric caps equal Appendix C: 8, 33, 2, 6, 160, 65536, 16, 4096, 100, 20, 3, and `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS` is `64`; assert the nine provider-derived caps (`QUEUE_READY_MAX_IDENTITY_CHARS` 128, `QUEUE_READY_MAX_REF_CHARS` 128, `QUEUE_READY_MAX_LABEL_CHARS` 128, `QUEUE_READY_MAX_LABELS` 16, `QUEUE_READY_MAX_RELATIONS` 16, `QUEUE_READY_MAX_OWNER_CHARS` 128, `QUEUE_READY_MAX_REPO_NAME_CHARS` 128, `QUEUE_READY_MAX_BRANCH_CHARS` 256, `QUEUE_READY_MAX_TIMESTAMP_CHARS` 40), `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (32), and `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN` (`^[0-9]+$`); assert the human-bound constants are measured in **UTF-8 bytes**: the segment cap (32, including the trailing `+`), the human digest (`QUEUE_READY_MAX_HUMAN_BYTES` 4096), the derived candidate-line budget (400), the derived header-plus-summary budget (620), and the machine `QUEUE_READY_MAX_MACHINE_BYTES` (65 536) unchanged at UTF-8 bytes; assert no constant is named or documented as a character cap for the human renderer; assert `QUEUE_READY_ASSOCIATED_COUNT_RANGE` is exactly `0..QUEUE_READY_SOURCE_ITEM_LIMIT` (100) with no separate cap.
5. Assert the tier labels and owner-attention labels equal the spec sets (case-insensitive matching is a predicate rule, not a different constant).
6. Assert the ref pattern accepts `GH-176`, `gh-176`, `PDEV-1`, `ABC-000`, `gh-007` and rejects the malformed cases from TC-QREADY-001 (including ` GH-176`, `GH-176 `, `GH 176`, and `GH-176\t`); assert canonical emission is uppercase prefix + preserved digits (`gh-176` -> `GH-176`, `gh-007` -> `GH-007`) and that `GH-007` and `GH-7` remain distinct. Assert a 64-character canonical ref is at the cap (accepted) and a 65-character ref is over the cap (rejected as `input.value.rejected` before any read); the length check runs after canonicalization and before duplicate detection.
7. Assert the rank class order equals the specified list and the schema version is additive within v1 (a breaking shape change would bump it); the test reads the constant rather than hardcoding a second copy where possible.
8. Assert every readiness reason in DM-10 (including `value-clamped`) is present in the contract's reason union and no error-table identity appears among them; assert the evidence source set is exactly `{tracker, changes, ci, provider-config, provider-parks, local-context, repository-binding}`. Assert `QUEUE_READY_REASON_ORDER` is exactly the six groups in order — (1) `addressing-unresolved`, `remote-unsupported`; (2) `QUEUE_READY_PAYLOAD_MARKER_REASONS` = `source-truncated` then `value-clamped`; (3) `config-invalid`, `provider-chain-not-declared`, `provider-chain-unresolved`; (4) `state-unreadable`; (5) `QUEUE_READY_SOURCE_FAILURE_REASONS`; (6) exactly `pr-association-unknown` — and that `QUEUE_READY_SOURCE_FAILURE_REASONS` is exactly the seven-token subset `read-failed`, `credential-unavailable`, `signal-unavailable`, `work-item-unobserved`, `commit-unresolved`, `local-context-missing`, `local-context-malformed` in that order. Assert `source-truncated`/`value-clamped` are never members of a condition's evidence reason set and that `value-clamped` never replaces a verdict reason.
9. Assert the modules that declare these constants are registered in `tests/structure/inventory.json` with the correct executable allowances; an unregistered or wrongly-allowlisted module fails.
10. Assert no live-switch constant is declared in `core ./contracts` or anywhere under `packages/**` (`QUEUE_READY_LIVE_ENV` must not exist and must not be exported); assert the test harness `tests/fixtures/queue-ready/harness.ts` binds the literal `ADOS_QUEUE_READY_LIVE` and enables the live suite only when its value is exactly `1`; assert the literal appears only under `tests/**`, is absent from every production edge, and is not a configuration key, payload field, evidence value, or human-text token.
11. Mutation controls: change one cap (including a provider-derived cap, the human segment byte cap, and the numeric-identity pattern), rename `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` to a character-named constant (or document it as a character cap), rename one condition id, reorder a reason group, move `value-clamped` out of group 2, add a reason, remove a state, add a live-switch constant to the contracts; each in-memory mutation must fail by name; the unmutated control is green.

**Expected Outcome**:

- Every constant and closed vocabulary is pinned to Appendix C/DM-4/DM-10/DM-13, including the reason order (group 2 = `source-truncated` then `value-clamped`; group 6 exact), the source-failure subset, the `associatedCount` range, the 64-character canonical ref cap, the nine provider-derived caps, the 32-UTF-8-byte human segment cap (including the trailing `+`), the derived renderer budgets (400-byte candidate line, 620-byte header plus summary, 4096-byte total), and `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`; the live-switch literal is tests-only (no `QUEUE_READY_LIVE_ENV` constant) and exactly-`1` gated; the new contracts are registered in the inventory; a drift fails by name.

#### TC-QREADY-025 - Tier, purity, composition, no new package/subpath/runtime-API, exact public export surface

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-15, F-16, AC-F15-1, NFR-7
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/queue-ready-imports.test.ts`, `tests/structure/subpaths.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/port-contract-inventory.test.ts`
**Tags**: @backend

**Given** the queue-ready contracts under `core/src/contracts`, the pure evaluator/ranker/renderer under `core/src/domain`, and the command under `cli/src/commands`,
**When** the structure suite runs,
**Then** the contracts are data-only, the domain tier is pure, the CLI composes at the edge, no new package/subpath/runtime-API location or adapter operation is added, every new module is inventory-registered, and the domain public surface re-exports exactly the two planned functions (`evaluateQueueReady`, `renderQueueReadyHuman`) with `classifyPipelineRuns` kept module-internal and never publicly re-exported from `domain/index.ts` or the package root.

**Preconditions**:

- The delivered status composition and adapter subpaths (`github`, `repo`, `file`, `credentials`); the queue-ready reuses their read results.
- The existing `verify-imports.test.ts`/`status-imports.test.ts` detectors (contracts data-only, domain pure, spawn/network scan).
- `tests/structure/inventory.json`, the `content-inventory` allowlist rules, and `tests/fixtures/ports/v1-contract-inventory.json`.
- The planned domain public surface: `packages/core/src/domain/index.ts` and `packages/core/src/index.ts` export only `evaluateQueueReady` and `renderQueueReadyHuman` from the queue-ready domain; `classifyPipelineRuns` stays internal to `domain/ci-result.ts` and is imported by relative module path only.

**Steps**:

1. Assert the queue-ready contracts module is data-only: only type/interface/import/export/`as const` declarations; no runtime import; no executable statement.
2. Assert the pure queue-ready domain module imports only `#contracts`/`#domain/*`/relative; no `node:*`/`bun:*`, no state/config/provider implementation import, no I/O call (`readFileSync`, `parseDocument`, `Date.now`, `Math.random`, `process.env`).
3. Assert the CLI command module imports only the contracts and the domain, the sibling `status` command module for `collectStatusFacts`, and local types; no direct adapter/state import; the composition happens at the edge. The sibling `status` import is allowed because the queue module reuses `collectStatusFacts` rather than duplicating the read composition.
4. Assert the domain public surface is exactly the planned one: `packages/core/src/domain/index.ts` exports `evaluateQueueReady` and `renderQueueReadyHuman` and **does not** export `classifyPipelineRuns`; `packages/core/src/index.ts` re-exports only those two queue-ready functions; `classifyPipelineRuns` remains exported from `domain/ci-result.ts` for module-internal/relative imports and is absent from both public barrels; `tests/fixtures/ports/v1-contract-inventory.json` records the same two-function public surface. A negative control adds `export { classifyPipelineRuns }` to `domain/index.ts` (and separately to `core/src/index.ts`) and asserts the test fails by name; the unmutated control is green.
5. Assert the queue-ready code calls only the delivered read operations (issues, pulls, check-runs, repository binding/HEAD, provider config, verified park views, local context) and adds no adapter operation, page, or trap change; assert `ADAPTER_OPERATIONS` and the capability declaration are unchanged.
6. Assert no new package, `package.json` subpath, or runtime-API location is added; assert `tests/structure/subpaths.test.ts` passes with the unchanged expected subpath set.
7. Assert the queue-ready modules are registered in `tests/structure/inventory.json` with the correct executable allowances; an unregistered or wrongly-allowlisted module fails.
8. Assert `tests/structure/cli-edge-seam.test.ts` sees `queue` composed beside `status`/`verify`/`lint`/`phase`/`provider`/`config` with injected dependencies and a read-only command definition.
9. Assert new test files are auto-discovered by `bun test` and require no inventory entry; assert no fixture is named `*.test.ts`; assert the new `tests/fixtures/queue-ready/**` tree is not executable source.
10. Negative controls: add a `node:fs` import to the domain, add a new `./queue-ready` subpath, add a new adapter operation, unregister a module, and publicly re-export `classifyPipelineRuns` from either barrel; each mutation must fail by name; the unmutated control is green.

**Expected Outcome**:

- Queue ready is contracts/domain pure at the core tiers, reuses the delivered reads without adding an operation, composes at the CLI edge (allowing the sibling `status` module's `collectStatusFacts`), adds no package/subpath/runtime-API location, and exposes exactly `evaluateQueueReady` and `renderQueueReadyHuman` from the domain public surface with `classifyPipelineRuns` not publicly re-exported; inventory registration is exact.

#### TC-QREADY-026 - Brand neutrality, no product literals, secret-read allowlist

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F15-1, NFR-7, NFR-10
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/secret-read-boundary.test.ts`, `tests/checks/forbidden-literals.test.ts`, `tests/structure/queue-ready-imports.test.ts`, `tests/fixtures/queue-ready/literals/**`
**Tags**: @backend @security

**Given** the secret-read allowlist (four entries), the forbidden-literal registry (`packages/**` and registered `doc/**`; `tests/**` excluded), and the queue-ready source,
**When** the checks run,
**Then** the allowlist stays at four, the queue-ready code reads no ambient environment, no product/binary literal is committed, the human header uses the injected brand, and the live-smoke literal appears only under `tests/**`.

**Preconditions**:

- `SECRET_READ_ALLOWLIST` (four entries) and the forbidden-literal registry.
- The queue-ready contracts/domain/command modules and the synthetic brand from `tests/golden/helpers.ts`.
- The live-smoke harness under `tests/behaviour/queue-ready-live.test.ts`.

**Steps**:

1. Assert `SECRET_READ_ALLOWLIST` length is exactly `4`; assert no queue-ready file appears in the allowlist; assert queue-ready source contains no ambient env read (`process.env`/`Bun.env`/`globalThis[...]`).
2. Assert the forbidden-literal scan over `packages/**` and registered `doc/**` reports zero product/binary-literal violations; assert the queue-ready source and the new feature doc have no product literal.
3. Assert the human header uses the injected brand `binaryName` (the synthetic brand) and never a hardcoded product.
4. Assert `ADOS_QUEUE_READY_LIVE` is bound only by `tests/fixtures/queue-ready/harness.ts` and appears only under `tests/**`; assert no `QUEUE_READY_LIVE_ENV` constant is declared in `packages/**`, no production edge references it, and it is not a configuration key, payload field, evidence value, or human-text token; assert the live suite enables only when the value is exactly `1` (not `true`, `0`, empty, or whitespace-padded).
5. Assert the secret-read allowlist mutation control (add a queue-ready file) fails; assert the forbidden-literal mutation control (add a product literal to a queue-ready source) fails.
6. Assert no secret canary appears in the payload/evidence/human text in the TC-QREADY-018 and TC-QREADY-020 fixtures; assert the serialization redaction chokepoint is the only path.
7. Assert the new current-truth feature doc `doc/spec/features/feature-queue-ready.md` declares `ados_distribution: internal` and passes the doc-distribution check when present.
8. Assert the human header derives the binary name from the injected brand in every fixture, including a brand whose `binaryName` differs from the repository's; the delivered CLI has no rendered help surface and this change adds none.

**Expected Outcome**:

- The secret-read allowlist stays at four; queue ready has no product literal or ambient env read; the header is brand-derived; the live switch literal is test-harness-only (no `QUEUE_READY_LIVE_ENV` constant), exactly-`1` gated, and absent from production/config/payload/human text; the new doc is distribution-marked.

#### TC-QREADY-027 - Error-table stability and evidence/identity discipline

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-16, AC-F16-1, NFR-8
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/queue-ready-contract.test.ts`, `scripts/checks/error-table-sync.ts`
**Tags**: @backend

**Given** the delivered `ERROR_TABLE`, `DOMAIN_KINDS`, and the documented table in `doc/spec/features/feature-result-contract.md`,
**When** the queue-ready change lands,
**Then** no row/domain kind is added or changed, the two-way sync is green, and queue-ready evidence reasons are never error-table identities or failure classes.

**Preconditions**:

- The pre-change error rows/kinds captured as the baseline.
- The closed readiness reason set from DM-10 and the documented table.
- The queue-ready command's failure surface: only `input.value.rejected` and `fallback.internal`.

**Steps**:

1. Assert `DOMAIN_KINDS` is unchanged and no `queue.*` row/kind exists; assert `ERROR_TABLE` has no new row and no existing row's code/kind/exit behavior changed.
2. Run `bun run scripts/checks/error-table-sync.ts` and assert exit `0` (documented table matches the machine table in both directions).
3. Assert the queue-ready handler can return only `input.value.rejected` (grammar) and `fallback.internal` (containment); assert no other error code appears in the command's return paths (AST/grep).
4. Assert every evidence `reason` is from the closed readiness set and none equals an error-table code; assert no `failureClass` is taken from the error table for a source condition.
5. Assert the `provider.chain.invalid`/`config.*` codes are not repurposed as queue-ready evidence reasons; where a safe failure code/class is included, it is the existing code from the source read, not a new identity.
6. Assert the documented result-contract table has no queue-ready row and no queue-ready reason is presented as an error identity.
7. Mutation controls: add an error row, change an existing row's code, and add a queue-ready reason to the error table; each must fail sync/classification by name; the unmutated control is green.
8. Assert the error-table sync check is wired into the aggregate gate and remains read-only (no writes to the live tree).

**Expected Outcome**:

- No new error row or domain kind; sync and classification are green; queue-ready reasons are evidence vocabulary, not error identities; only the two existing handler failures are possible.

#### TC-QREADY-028 - Fixture corpus completeness and Appendix G worked examples

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-17, AC-F3-1, AC-F2-3, AC-F4-2, AC-F12-2, AC-F17-1, NFR-6, NFR-11
**Test Type(s)**: Integration, Contract, Corpus
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-corpus.test.ts`, `tests/fixtures/queue-ready/corpus/**`
**Tags**: @backend @golden

**Given** the committed fixture corpus under `tests/fixtures/queue-ready/corpus/**`,
**When** the default suite runs,
**Then** every condition state, close class, source failure, at-limit/truncation case, duplicate/cap case, and Appendix G worked example is produced exactly as declared, with zero live network calls.

**Preconditions**:

- The corpus inventory in §6.2 (one case per condition x state, per close class, per source failure, at-limit/truncation, duplicate/cap, selection, secret canary).
- The Appendix G worked-example table (11 rows).
- A transport recorder that fails on any live request and counts requests.

**Steps**:

1. For every command-level corpus `case.json`, when run through `runCli`, then assert the exact six condition states/reasons, `ready`, `closeClass`, the 1-based `rank`, `blockingConditions`, close fields (including the association reason), and `truncated` equal the case's expected verdict. For the rows marked evaluator-injected (the merged/closed-only close cases), run the pure evaluator with the injected normalized view, never `runCli`.
2. Assert the corpus meta-check covers every condition x state cell: for each of the six conditions, at least one `satisfied`, one `unsatisfied`, and one `unknown` case exists; a missing cell fails by name.
3. Assert the corpus meta-check covers every close class at least once (`merge-ready`, `review-pending`, `new-start`, `unknown`, `not-ready`).
4. Assert the corpus meta-check covers every source failure at least once: issues read failed, pulls read failed, check-runs read failed, credential unavailable, binding unavailable, unresolved SHA, config invalid, chain unresolved (command level with `{ok:false, reason:"provider-chain-unresolved"}`), chain not declared, park fold failed, PM context missing, PM context malformed. For the binding/credential rows assert the true composed outcome: the tracker-derived conditions are `unknown`/`work-item-unobserved` because the same binding/credential posture skips or fails all GitHub reads. Assert every provider config/park failure record uses the pinned `failureCode`/`failureClass` detail form (or no `detail` when the read supplies neither) and that a hand-planted free-form provider failure detail fails the meta-check by name.
5. Assert the corpus meta-check covers at-limit/truncation/source-clamp: a 100-item issues page, a 100-item open-PR page (with no match), reasons >6 (retained-first), detail >160, `+more`, and an over-long provider-field case that yields `value-clamped` + payload `truncated` with unchanged verdicts. The evidence-cap overflow is a synthetic over-cap evaluator input exercised by TC-QREADY-035, not a deps or command corpus case. There is no title clamp and no title field.
6. Assert the fixture suite covers duplicate/cap: `refs/cases.ts` has a duplicate-ref case (rejected), a 9-ref case (rejected in the handler), a 64-character accepted ref, a 65-character rejected ref, and the 32-refs (33 positionals) handler boundary vs 33-refs (34 positionals) parser boundary; the corpus has the 8-ref `cap-sized-8` success case and the `ref-length-max-64` accepted case.
7. Assert the Appendix G eleven rows are produced exactly (S/U/? pattern, `ready`, `closeClass`, class rank, named blocking conditions), including the merge-ready and review-pending fixtures and the all-unknown degraded row. A single-candidate corpus case has payload `rank: 1`; class rank is the separate DM-7 bucket.
8. Assert the transport recorder saw zero live requests across the entire corpus; a single request fails the suite.
9. Assert no corpus case has an orphan expectation: every case is referenced by name in the meta-check and every meta-check key has a case; a removal/duplication fails.
10. Assert the corpus/constant completeness meta-check names every Appendix C constant introduced or re-pinned by this change — `QUEUE_READY_MAX_IDENTITY_CHARS`, `QUEUE_READY_MAX_REF_CHARS`, `QUEUE_READY_MAX_LABEL_CHARS`, `QUEUE_READY_MAX_LABELS`, `QUEUE_READY_MAX_RELATIONS`, `QUEUE_READY_MAX_OWNER_CHARS`, `QUEUE_READY_MAX_REPO_NAME_CHARS`, `QUEUE_READY_MAX_BRANCH_CHARS`, `QUEUE_READY_MAX_TIMESTAMP_CHARS`, `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES`, `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`, and `QUEUE_READY_PAYLOAD_MARKER_REASONS` with `value-clamped` — and fails if a constant has neither a constant-inventory assertion (TC-QREADY-024) nor a corpus/behaviour case. Assert the non-ASCII byte-budget case (`caps/non-ascii-byte-budget.ts`) is present with its exact reduction-order oracle and the human worst-case/over-budget cases (`caps/human-astral-8`, `caps/human-over-budget`) are present, so no byte-bound dimension is sampled. A missing identity-resolution row (`identity-github-shape`, `identity-wrong-number`, `identity-ambiguous-suffix`, `identity-leading-zero`, `relation-target-*`), a missing provider-cap row (`provider-over-cap-fields`), a missing byte-budget/reduction-order or human-bound row, or a missing command-level provider-failure row (`not-ready-provider-unresolved`, fixture `unresolved-chain-command`) fails by name.

**Expected Outcome**:

- The corpus is complete and non-vacuous for every condition state, close class, identity-resolution case, source failure, provider-cap/clamp case, bound, and Appendix G row; command-level cases never claim `pr-not-open`; the command-level `provider-chain-unresolved` row is reachable through a config read whose `reason` is `provider-chain-unresolved` and carries the pinned `failureCode:<code>` detail (the delivered edge supplies `config.value.invalid`), while a free-form provider failure detail fails the meta-check by name; the constant-inventory meta-check names every new cap and `value-clamped`; the meta-check fails on a missing or orphaned case; default CI performs zero live calls.

#### TC-QREADY-029 - Golden payload and human bytes over the corpus

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-17, DM-12, AC-F17-1, NFR-2, NFR-11
**Test Type(s)**: Golden, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/queue-ready.test.ts`, `tests/fixtures/queue-ready/golden/{payload.json,human.txt}`
**Tags**: @backend @golden

**Given** a committed golden fixture at a fixed run id, clock, and synthetic brand,
**When** the corpus canonical case runs with `--json` and in human mode,
**Then** the serialized payload and the human text are byte-identical to the committed goldens, within the declared bounds, the canonical golden is a contract-valid `delivery.queue-ready.v1` DM-1/DM-2 payload produced by the evaluator from a reachable canonical fact set (not a hand-constructed impossible shape), and a changed-fact control changes only the expected bytes.

**Preconditions**:

- `golden/payload.json` and `golden/human.txt` generated deliberately by evaluating the canonical normalized fact set; read-only at test time.
- The canonical case: five candidates spanning every close class, one associated merge-ready PR, one review-pending not-ready candidate, one unknown association, one not-ready; every candidate's `workItem` observation is consistent with its six condition states and `ready` (an observed item that makes deps/tier/owner known, or an explicitly unobserved item whose observation-dependent conditions are `unknown`), and `reasons` includes `pr-association-unknown` whenever any candidate's close association is `unknown`.
- The synthetic brand and fixed run id/clock from `tests/golden/helpers.ts`.

**Steps**:

1. Given the canonical case, when run with `--json`, then assert the `data` serialization equals `golden/payload.json` byte-for-byte (stable key order); assert <=65 536 UTF-8 bytes.
2. Given the same case in human mode, then assert stdout equals `golden/human.txt` byte-for-byte; assert every candidate line ends with `[repo:local-context; tier:priority-label]`; assert each per-candidate provider segment is <=32 UTF-8 bytes including a trailing `+` when shortened with no split code point (the goldens carry a long multi-byte provider identity/sourceRef case at cap size); assert the header owner/name are <=128 UTF-8 bytes each and branch <=256 UTF-8 bytes, candidate lines <=400 UTF-8 bytes, header plus summary <=620 UTF-8 bytes, and the digest <=16 lines and <=4096 UTF-8 bytes.
3. Assert the golden contains no `workItem.title` key, no title/notes/secret/token canary, and no provider-native key; assert the observed repo/tier evidence details carry `repo:local-context`/`tier:priority-label`; assert the human golden's provider segments carry no `available` claim (the pinned condition id `provider-available`, condition-id list, `blocking:` lines, summary tokens, and close classes are exempt; the scan is scoped to the provider segments, not the whole digest).
4. Given one changed fact (for example CI `succeeded` -> `pending`), when run, then assert the bytes change only in the expected bounded fields and the diff matches the expected reason/state transition; assert the test fails if the golden is stale.
5. Assert the golden files are read-only at test time; corruption/mutation controls run on temp copies, and the unmutated control is green.
6. Assert re-running the suite twice produces identical bytes (no run-id/clock drift).
7. Assert the human golden is derived from the payload golden (same refs/classes/counts), not a separate data path.
8. Assert a deliberate golden rewrite (one character) fails by name, proving the comparison is live.
9. Record the deliberate golden regeneration for this version: the cap-sized over-long provider fixture and the 32-UTF-8-byte segment/trailing-`+` rendering update both `golden/payload.json` (capped provider values, `truncated: true`, `value-clamped`) and `golden/human.txt`; regenerate them explicitly, never by blanket rewrite, and assert the human golden is still derived from the payload golden.
10. Validate the canonical golden against DM-1/DM-2 (F-10): assert `schemaVersion`, `generatedAt`, `repository`, `head`, ranked `candidates`, `summary`, `reasons`, and `truncated` are present with the exact envelope shape; assert every candidate's `workItem.state` is consistent with its six condition states and `ready` (an unobserved item cannot carry six `satisfied` conditions or `ready: true`, and an observed item's observation-dependent conditions are not `unknown`/`work-item-unobserved`); assert `reasons` includes `pr-association-unknown` whenever the candidate's `close.association` is `unknown` and that the six-group order/cap holds; assert the golden was produced by the evaluator (poll the fixture through `evaluateQueueReady` and assert `data` equality) rather than hand-written; a deliberately corrupted twin (unobserved item with all-satisfied conditions, or `unknown` association without `pr-association-unknown`) must fail by name; the unmutated control is green.

**Expected Outcome**:

- The canonical payload and human digest are pinned byte-for-byte within the declared bounds, the canonical golden is a contract-valid DM-1/DM-2 payload whose `workItem.state`/condition/`ready` shape and `pr-association-unknown` membership are consistent, the payload carries no title field and only capped provider-derived values (`value-clamped` where clamped), every candidate line carries the fixed proxy-source suffix and 32-UTF-8-byte provider segments with the 400/620/4096 byte budgets, and a stale, impossible, or nondeterministic golden fails the suite.

#### TC-QREADY-030 - Performance and read-cost bounds

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-5, NFR-9, AC-F17-1, NFR-11
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-performance.test.ts`, `tests/fixtures/queue-ready/bounds/cap-sized/**`
**Tags**: @backend @perf

**Given** cap-sized inputs (8 candidates, 6 conditions, 2 evidence each) and counting read seams,
**When** the pure evaluator/ranker/renderer runs and the command executes,
**Then** pure evaluation is <=50 ms on the reference environment, the command makes <=3 GitHub reads, exactly 1 logical park-fold read, <=1 config resolve, <=1 local-context read, 0 quota fetches, and 0 retries/loops.

**Preconditions**:

- The cap-sized fixture; a warm-up run and a measured median over repeated pure evaluations.
- Counting readers for issues, pulls, check-runs, repository binding/HEAD, config, parks, local context; counting engine/quota stubs.
- The reference environment recorded in the test output (Bun version, CPU class).

**Steps**:

1. Given the cap-sized facts, when the pure evaluator/ranker/renderer runs after a warm-up, then assert the median wall time is <=50 ms; record the environment and the measured median.
2. Assert the pure evaluation is linear in candidates x conditions x evidence: double the candidates/evidence within the cap and assert the time grows sub-quadratically (no nested candidate re-reads or repeated sorting per candidate).
3. Given a full command run, then assert the issues reader was called at most once with limit 100, the pulls reader at most once with limit 100, and the check-runs reader at most once with limit 20; total GitHub reads <=3.
4. Assert exactly one logical park-fold read (`readProviderParkViews` invocation count `1`); the fold's internal verified reads are not multiplied by queue ready.
5. Assert at most one config resolve and at most one local-context read; assert 0 quota fetches and 0 retries/loops (call counts exactly 0/1 as declared).
6. Given an unavailable repository binding, when run, then assert zero GitHub reads (the reads are skipped) while config/parks/local context still follow the declared counts.
7. Assert the engine/`provider resolve`/`provider quota`/quota-transport stubs recorded 0 calls.
8. Control: a deliberate second issues read or a deliberate retry must trip the counter and fail the bound; the unmodified control is green.
9. Record the measured median and read counts in the test output for the PR evidence; do not silently relax the 50 ms bound (the NFR-9 bound is not relaxed).

**Expected Outcome**:

- The pure evaluation meets the 50 ms bound at cap size; the command stays within 3 GitHub reads, 1 park-fold read, 1 config resolve, 1 local-context read, and 0 quota/retries.

#### TC-QREADY-031 - Opt-in live structural smoke

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-17, AC-F2-3, AC-F9-1, AC-F17-1, NFR-11
**Test Type(s)**: Integration, Live
**Automation Level**: Automated (opt-in)
**Target Layer / Location**: `tests/behaviour/queue-ready-live.test.ts` (skipped unless `ADOS_QUEUE_READY_LIVE` is exactly `1`)
**Tags**: @backend @live

**Given** an opt-in run with a resolvable GitHub credential against this repository,
**When** `queue ready` executes on one or more explicit refs,
**Then** it produces one valid payload that satisfies only structural invariants and never pins volatile counts; without the switch the suite is skipped and default CI performs zero live calls.

**Preconditions**:

- `ADOS_QUEUE_READY_LIVE=1` and a credential resolvable through the injected port; without either, the suite is skipped (`test.skipIf`). Any other value of the switch (`true`, `0`, empty, `01`, whitespace-padded) also skips.
- This repository's `origin` binding and checkout HEAD; explicit candidate refs (for example `GH-176`).
- A structural assertion helper for schema/conditions/bounds/secrets.

**Steps**:

1. Given the switch is absent or set to any value other than exactly `1`, when `bun test` runs, then assert the live suite is skipped and the default aggregate makes zero live requests.
2. Given the switch and a credential, when run, then assert exactly one valid `CommandResult` envelope with `schemaVersion: "delivery.queue-ready.v1"`.
3. Assert every rendered candidate has exactly six conditions in fixed order, each with a closed state and bounded evidence; assert **at least one known candidate is observed** through the §8.3 identity rule — use the current change ref `GH-176` when it is on the observed open-issue page, otherwise derive a candidate from an observed page item's provider id (no count pinned), and assert its `workItem` state is `observed` with at least one label-derived condition evaluated rather than `work-item-unobserved`. Fail with a clear message if no explicit candidate observes; do not pass vacuously.
4. Assert no candidate has `ready: true` with any non-satisfied condition; assert every not-ready candidate names at least one blocking condition.
5. Assert no `merge-ready` claim exists without `reviewStateObserved: true` and observed `approved` on a non-draft PR; on the current GitHub slice, assert no `merge-ready` is produced (review state unavailable) and any associated PR is `review-pending`.
6. Assert `deps-satisfied` is `unknown` on the GitHub slice (relations unavailable) and is not rendered satisfied; assert **the provider evidence records/details and the provider human-text segment** contain no `available` claim and no engine-verification claim, while the pinned condition id `provider-available`, the condition-id list, `blocking: provider-available=<state>` lines, payload keys, summary tokens, and close classes are exempt (the scan is scoped, never whole-payload).
7. Assert the payload is <=65 536 UTF-8 bytes, the human digest <=16 lines/4096 UTF-8 bytes with 32-UTF-8-byte provider segments, <=400-byte candidate lines, and <=620-byte header plus summary, every reason is in the closed set, and no secret/token/raw payload appears.
8. Assert no volatile count is pinned (candidate/PR/issue counts are read from the payload, not hardcoded); assert the run does not fail on a different open-item population.
9. If an evidence artifact is produced, assert it is bounded, secret-free, and not committed; record its path in the PR evidence only.
10. Assert the literal `ADOS_QUEUE_READY_LIVE` never appears in the payload, evidence, or human text, and that `data.reasons` is unique and ordered by `QUEUE_READY_REASON_ORDER` with no verdict reason.

**Expected Outcome**:

- The live smoke is opt-in (exactly-`1` gated) and structural: one valid payload, six conditions per candidate, at least one known candidate observed through the §8.3 identity rule, no false ready, no fabricated merge-ready, no provider `available` claim (scoped scan with the condition id exempt), ordered reasons, bounds and secret checks hold, the switch token never leaks, and no volatile count is pinned; default CI stays offline.

#### TC-QREADY-032 - Ref canonicalization, condition independence and candidate-set-scoped observation, no discovery

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-2, DEC-14, DM-2, AC-F1-1, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-command.test.ts`, `tests/fixtures/queue-ready/refs/cases.ts`
**Tags**: @backend

**Given** caller-supplied refs with mixed case, leading zeros, whitespace, over-length text, and multiple candidates,
**When** the candidate set is built,
**Then** refs are canonicalized to an uppercase ASCII prefix with the hyphen and digits preserved exactly; the validation order is canonicalize -> length (<=64) -> duplicate -> any read; duplicates are detected after canonicalization and rejected before any read, never silently merged; no whitespace is accepted or trimmed; the command never discovers/invents candidates; and condition evaluation is independent per candidate over the same facts, while identity observation is candidate-set-scoped through the unique-suffix bridge (adding a candidate with a shared suffix leaves the item unobserved for every sharing candidate, and caller order never resolves it).

**Preconditions**:

- Refs: `gh-176`, `GH-176`, `Pdev-1`, `ABC-000`, `gh-007`, `GH-007`, `GH-7`, `GH-0176` (distinct from `GH-176` as text, equal numerically), a 63-character ref, a 64-character ref (at the cap), a 65-character ref (over the cap), and whitespace-bearing refs ` GH-176`, `GH-176 `, `GH 176`, `GH-176\t`.
- A multi-candidate fixture with one candidate observed and one unobserved.
- A runtime whose readers record the candidate refs they are asked for and a counter that proves no read occurred on rejection.

**Steps**:

1. Given `gh-176`, when run, then assert the emitted `workItemRef` is `GH-176` (uppercase ASCII prefix, hyphen and digits preserved).
2. Given `Pdev-1`, when run, then assert `PDEV-1`; given `ABC-000`, then assert `ABC-000`; given `gh-007`, then assert `GH-007` (leading zeros preserved exactly, not stripped).
3. Given `GH-176` and `gh-176` in one invocation, when run, then assert `input.value.rejected` before any read (duplicate detected after canonicalization and rejected, never silently merged); given `GH-007` and `gh-007`, assert the same.
4. Given `GH-007` and `GH-7`, when run, then assert both are accepted as distinct refs (different text, equal numeric suffix) and ranked by numeric suffix then canonical text; no false duplicate rejection and no leading-zero stripping.
5. Given any whitespace-bearing ref (` GH-176`, `GH-176 `, `GH 176`, `GH-176\t`), when run, then assert `input.value.rejected` before any read; assert the input is neither trimmed nor accepted.
6. Given a 63- and a 64-character canonical ref, when run, then assert both are accepted; given a 65-character canonical ref, assert `input.value.rejected` before any read. Assert the handler's validation order is canonicalize -> length -> duplicate -> read: the 65-character ref is rejected for length before duplicate detection and before any read, and two refs that are duplicates only after canonicalization are rejected for duplication before any read and never silently merged. Every rejection leaves every source-read counter at `0`; a malformed 65+ ref fails at grammar before the length check.
7. Given a multi-candidate fixture with one observed and one unobserved candidate, when run, then assert the unobserved candidate's label/relation conditions are `unknown` and do not affect the observed candidate's conditions or rank.
8. Assert the command does not enumerate open issues to invent candidates: the number of candidates equals the caller's ref count, and the issues reader returns items used only as evidence, not as a candidate source.
9. Assert the command does not infer a candidate from the active change or parked work: a PM context active change `GH-999` not in the refs adds no candidate and only affects `repo-free`.
10. Assert no repository/path/label/filter argument is accepted; such an invocation is rejected as `fallback.invocation` (unknown flag) or `input.value.rejected` (extra malformed positional), per the parser rules.
11. Control: pass the same refs in a different caller order and assert the canonical set is identical and the ranked output is identical.

**Expected Outcome**:

- Refs are canonicalized exactly (uppercase prefix, hyphen and digits preserved including leading zeros), the validation order is canonicalize -> length -> duplicate -> read, a 64-character canonical ref is accepted and 65+ is rejected before any read, duplicates are detected after canonicalization and rejected before any read and never silently merged, whitespace is never accepted or trimmed, distinct numeric-equal refs remain distinct, condition evaluation is independent per candidate while candidate observation is candidate-set-scoped through the unique-suffix rule (a shared suffix leaves the item unobserved for every sharing candidate, with no precedence or caller order), and no candidate is discovered or inferred.

#### TC-QREADY-033 - Edge exit projection and stream discipline

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-14, AC-F1-1, AC-F1-3, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-command.test.ts`, `tests/golden/helpers.ts`
**Tags**: @backend @cli

**Given** the CLI edge that serializes the handler result,
**When** the handler returns success, grammar rejection, or containment failure,
**Then** the edge projects exit `0`, `1`, or `2` respectively, writes exactly one serialization of the result, and never emits partial data.

**Preconditions**:

- `runCli` with buffer streams and the delivered exit projection (`{0,1,2}` taxonomy).
- A valid run, a grammar-rejected run, and a throwing-handler run.
- A stream recorder that counts writes.

**Steps**:

1. Given a successful run, when executed, then assert exit `0`, exactly one stdout serialization, no `error`, and the same `data` in `--json` and human modes (different rendering, same payload).
2. Given a grammar-rejected run (`input.value.rejected`), when executed, then assert exit `1`, exactly one error envelope, no `data`, and no partial candidate output.
3. Given a containment failure (`fallback.internal`), when executed, then assert exit `2`, exactly one error envelope, and no partial data.
4. Given a not-ready run (all candidates blocked but sources successful), when executed, then assert exit `0` (not-ready is data, not a command failure) and every candidate rendered.
5. Given a run with failed sources, when executed, then assert exit `0` and no error envelope (TC-QREADY-002).
6. Assert the edge writes exactly one serialization per invocation (no double-write, no debug line on stdout); assert stderr is empty on success and on not-ready.
7. Assert the handler itself never writes to the streams (throwing sinks control) and the edge owns the single write.
8. Assert the exit projection never emits any code outside `{0,1,2}` for queue ready, and no exit literal is introduced outside the edge (AST scan of the command module).

**Expected Outcome**:

- Exit projection is `0` for success and not-ready, `1` for handler grammar rejection, `2` for containment; the existing global parser `fallback.invocation` envelope is separate and unchanged; exactly one serialization per run; no partial output; the handler stays write-free/exit-free.

#### TC-QREADY-034 - Top-level `reasons`: six-group order, first-occurrence dedup, cap-6 overflow

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, DM-1, DM-10, DM-11, DEC-16, AC-F12-1, AC-F12-2, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/reasons/cases.ts`
**Tags**: @backend @golden

**Given** a run with one or more triggers from every reason group, presented with scrambled read order, scrambled condition order, and duplicate outcomes,
**When** the payload-level `reasons` array is assembled,
**Then** it is the unique union of the six fixed groups in `QUEUE_READY_REASON_ORDER` with first occurrence wins, a cap of six, and overflow setting the payload `truncated` only.

**Preconditions**:

- Group triggers: (1) both binding outcomes `addressing-unresolved` and `remote-unsupported`; (2) a raw page at its declared limit (`source-truncated`) **and** a provider-derived value clamp (`value-clamped`), both present and separately present; (3) all three provider-config reasons; (4) park-fold `state-unreadable`; (5) every `QUEUE_READY_SOURCE_FAILURE_REASONS` token observed on different conditions; (6) a close association `unknown` with no condition-source failure from the PR read (the un-deduplicated case).
- Scrambled read/condition/evidence-order twins, an under-cap fixture (5 triggers), an exactly-6 fixture, and a 7-trigger over-cap fixture.
- The closed `QUEUE_READY_REASON_ORDER`, `QUEUE_READY_PAYLOAD_MARKER_REASONS` (`source-truncated`, `value-clamped`), `QUEUE_READY_SOURCE_FAILURE_REASONS`, `QUEUE_READY_CONDITION_ORDER`, and `QUEUE_READY_MAX_REASONS` (6); `packages/core/src/domain/status.ts` as the provider-failure oracle.

**Steps**:

1. Given all six groups triggered, when assembled, then assert `data.reasons` equals the exact expected array and contains no duplicate entry.
2. At the reason-assembler level, given both binding outcomes, when assembled, then assert `addressing-unresolved` precedes `remote-unsupported` and neither is repeated; at the command level, assert a single run emits at most one binding outcome and places it first.
3. Assert group 2 is exactly `QUEUE_READY_PAYLOAD_MARKER_REASONS` in order: when both are present, `source-truncated` immediately precedes `value-clamped`, once each, positioned after group 1 and before any provider-config reason; when only `value-clamped` is present, it sits in the group-2 position after group 1; assert neither token ever appears as a condition or close evidence record.
4. Assert group 3 emits `config-invalid`, then `provider-chain-not-declared`, then `provider-chain-unresolved` when all are present.
5. Assert group 4 emits `state-unreadable` after group 3 and before any condition-source failure.
6. Assert group 5 walks `QUEUE_READY_CONDITION_ORDER` and then each condition's evidence array; assert only `QUEUE_READY_SOURCE_FAILURE_REASONS` enter, that the first occurrence wins, and that a duplicated reason across two conditions appears once at the first position.
7. Assert group 6 is exactly the single token `pr-association-unknown` and is last. Assert the un-deduplicated case (PR read fails while CI succeeds, so no condition source emits `read-failed`/`credential-unavailable`) yields `pr-association-unknown` as the only group-6 entry, with no `read-failed`/`credential-unavailable` appended after it; assert the deduplicated case (the same reasons already emitted in group 5) also yields exactly one group-6 token and no duplicate. Assert `read-failed`/`credential-unavailable` never appear in group 6 in any case.
8. Assert verdict/observation reasons (`ci-pending`, `ci-failed`, `tier-conflict`, `tier-absent`, `dependency-open`, `dependency-unobserved`, `other-active-change`, `no-owner-labels`, `ci-none`, `pr-associated`, `pr-not-associated`, `pr-not-open`) never appear in top-level `reasons`; assert `source-truncated`/`value-clamped` appear only as payload markers and never as a condition or close evidence record.
9. Given the scrambled-order twin, when assembled, then assert the `reasons` array is byte-identical to the canonical run, proving order comes from the declared groups and not from read order.
10. Given 5 and 6 triggers, assert payload `truncated: false`; given 7, assert the first six in `QUEUE_READY_REASON_ORDER` are retained (group 2's `source-truncated` then `value-clamped` are retained when present because group 2 precedes groups 3–6 and at most two group-1 reasons precede them), the seventh is dropped, payload `truncated: true`, and every candidate's own `truncated` flag is unchanged (no candidate-local record was dropped).
11. Controls: remove one trigger and assert its reason disappears; add a duplicate and assert it is deduped; reorder the declared groups in an in-memory mutation and assert the assertion fails by name.

**Expected Outcome**:

- Top-level `reasons` is a deterministic, unique, six-group-ordered list with first-occurrence dedup; group 2 is exactly `source-truncated` then `value-clamped` and group 6 is exactly `pr-association-unknown` and last (`read-failed`/`credential-unavailable` are group-5 only); the cap drops the seventh and sets the payload flag only; verdict reasons never leak in; the array is independent of read/condition order.

#### TC-QREADY-035 - Truncation flag scope, CI at-limit payload marker, pinned reduction order, inert human line drop

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-12, F-13, DM-1, DM-11, DM-12, DEC-17, DEC-19, DEC-20, AC-F8-1, AC-F12-1, AC-F12-2, AC-F13-1, NFR-2
**Test Type(s)**: Contract, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/bounds/{under-cap,at-limit,over-cap}/**`, `tests/fixtures/queue-ready/{reasons,caps}/**`
**Tags**: @backend @golden

**Given** each drop/limit/clamp cause — synthetic evidence-cap overflow, reason-cap overflow, issues source-at-limit, pull-request source-at-limit, check-runs at-limit, provider-derived value clamp/byte-budget reduction, derived-detail clamping, and the human reverse-rank line drop — with an under-cap control,
**When** the payload is assembled and the digest rendered,
**Then** the exact flag combination holds per cause (evidence-cap: candidate + payload; reason-cap/source-at-limit/CI at-limit/provider clamp/byte-budget: payload only, with `value-clamped` for a clamp; detail clamp: none; human line drop: no payload field or reason change), the non-ASCII byte-budget reduction follows the exact pinned order (relations before labels; last-ranked candidate first, highest index first), and neither the CI at-limit marker, a value clamp, nor the human line drop changes a verdict.

**Preconditions**:

- A `bounds/flag-matrix` table with one row per cause and its expected candidate/payload `truncated` pair plus the 19-run and 99-item under-limit controls and an under-cap provider-field control.
- A **synthetic over-cap evaluator input** whose condition would emit three evidence records (not a deps case and not a command corpus case; the delivered deps condition carries exactly one record, and `provider-available`'s two records are the only reachable multi-record case), a fixture with seven unique reasons, 100-item issues and pull-request pages, a 20-run check-runs page at 19 and 20, an over-160-character derived detail, and an over-long provider-field fixture (`caps/over-long`) that exceeds each of the nine caps and a serialized-`data` over-budget shape for the byte-budget reduction. There is no title string or title cap.
- `caps/non-ascii-byte-budget.ts`: the CJK fixture that is under the UTF-16 cap but over the 65 536-UTF-8-byte cap, with per-candidate rank/index sentinels on labels and relations so the drop order is directly observable.
- `caps/human-over-budget/**`: the synthetic legal payload that would still render above 4096 UTF-8 bytes after every renderer cap, used to exercise the reverse-rank line drop without changing the payload.
- `ci-healthy` facts that classify the 19-run and 20-run pages identically (for example one succeeded run plus filler runs), so the only permitted delta is the payload marker; the over-long provider fixture's conditions/`closeClass`/ranks/`associatedCount`/`summary` are identical with and without caps.

**Steps**:

1. Given a synthetic over-cap evaluator input whose condition would produce three evidence records, when assembled, then assert the first two are retained in evaluation order and that both `candidate.truncated` and payload `truncated` are `true`; assert the human digest shows `+more`. Assert the delivered deps condition never triggers this branch and `provider-available` remains exactly two records.
2. Given seven unique top-level reasons, when assembled, then assert the first six in `QUEUE_READY_REASON_ORDER` are retained, payload `truncated` is `true`, and the affected candidates' `truncated` flags are unchanged because no candidate-local record was dropped.
3. Given a raw issues page of exactly 100 items, when evaluated, then assert the payload-level `source-truncated` reason appears once and payload `truncated` is `true`, while every candidate `truncated` flag stays `false` and no condition state changes; given 99, assert no `source-truncated` and no flag.
4. Given a raw pull-request page of exactly 100 items, when evaluated, then assert the same payload-only marker and payload flag; assert a command-level at-limit open-only page with no open match stays `unknown`/`pr-association-unknown`; given 99, assert `not-associated` with `pr-not-associated` and no marker.
5. Given a raw check-runs page of exactly 20 runs, when evaluated, then assert the payload-level `source-truncated` reason appears once and payload `truncated` is `true`; assert the `ci-healthy` classification, state, ordered evidence records, and `blockingConditions` are identical to the 19-run control; assert no condition evidence record carries `source-truncated`.
6. Given the 19-run control, when evaluated, then assert no `source-truncated` reason and payload `truncated: false`; a changed fact still changes the expected bounded field (the equality is live).
7. Given an over-160-character **derived detail**, when serialized, then assert the value is clamped to 160 characters and neither the candidate nor the payload `truncated` flag is set by the clamp (with no other drop cause), and neither `source-truncated` nor `value-clamped` is emitted (a detail is not a provider-derived payload value).
8. Given the `caps/over-long` provider fixture, when assembled, then assert payload `truncated: true` and `reasons` carries `value-clamped` (after `source-truncated` when both are present, in the group-2 position otherwise); assert the affected candidate's `truncated` stays `false` because no evidence record was dropped; assert every condition state, `blockingConditions`, `closeClass`, `rank`, `associatedCount`, and `summary` is identical to the same fixture with the caps removed.
9. Given `caps/non-ascii-byte-budget.ts` (CJK; under the UTF-16 cap, over the 65 536-UTF-8-byte cap) whose fully capped serialized `data` still exceeds 65 536 bytes, when the byte-budget reduction runs, then assert the exact pinned order, not merely "some dropped": (a) no label entry is dropped before every trailing relation drop that is needed has occurred; (b) `workItem.relations` are dropped before `workItem.labels`; (c) candidates are processed in reverse rank order (last-ranked/largest `rank` first) and within a candidate the highest array index is dropped first, proven by per-candidate rank/index sentinels; (d) after each drop the budget is rechecked, so the first fitting state is minimal for that order; (e) every drop sets payload `truncated: true` + `value-clamped` and leaves `conditions`, `blockingConditions`, `closeClass`, `rank`, `associatedCount`, and `summary` identical to the pre-reduction run; (f) no condition, evidence, close field, summary count, `reasons` entry, or `rank` is ever dropped. A reversed-order twin (labels first, or first-ranked candidate first) must fail by name. Assert an unreduced over-budget payload injected directly into the serializer fails by name as a contract failure.
10. Given combined causes (evidence-cap plus source-at-limit; reason-cap plus evidence-cap; provider clamp plus source-at-limit), assert the exact combination: the candidate flag is `true` only from the evidence drop and the payload flag is `true` from any cause; `value-clamped` is present exactly once in group 2.
11. Controls: remove the payload flag from a source-at-limit case and fail; set a candidate flag on a source-at-limit or provider-clamp case and fail; clear the evidence-cap candidate flag and fail; clear `value-clamped` on a clamp and fail; assert `+more` never appears without payload `truncated: true` **or a defensive human line drop** (the latter leaves the payload flag unchanged but still renders `+more`).
12. Given `caps/human-over-budget`, when rendered, then assert the human line drop is renderer-only: trailing candidate lines are dropped in reverse rank order (last-ranked first, then the next-highest), the header (when present) and summary line remain, and `+more` follows the summary; assert `data` is byte-identical to the same payload rendered without the drop (no payload-field change, no `data.truncated` flip, no new reason token, no `value-clamped` added), the digest is <=16 lines/4096 UTF-8 bytes, and the command exits `0` with no `fallback.internal`. A control that sets payload `truncated` or adds a reason because of the line drop must fail by name.

**Expected Outcome**:

- Every drop/limit/clamp cause sets exactly the declared flag combination; the evidence-cap overflow is exercised only by a synthetic over-cap evaluator input (deps is single-record and provider is the only reachable two-record case); the check-runs at-limit marker is payload-level only and leaves the CI verdict, evidence, and blocking list byte-identical; a provider-derived value clamp or byte-budget reduction is payload-only with `value-clamped` and leaves every verdict field identical; the CJK byte-budget reduction follows the exact pinned order (relations before labels; last-ranked candidate first; highest index first) and a reversed-order twin fails; derived-detail clamping is inert; the human reverse-rank line drop is inert on the payload and reasons and never throws; there is no title field or title cap; the byte-budget reduction keeps `data` <=65 536 UTF-8 bytes and an unreduced over-budget payload is a contract failure.

#### TC-QREADY-036 - Candidate identity resolution: exact, bare-number bridge, wrong number, ambiguous suffix, leading zeros

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, §8.3, DM-2, DM-11, DEC-18, AC-F2-3, AC-F17-1, NFR-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-identity.test.ts`, `tests/fixtures/queue-ready/identity/cases.ts`
**Tags**: @backend @golden

**Given** a normalized open-issue page whose observed work items carry provider-native `identity.entityId` values (`"176"`, `"177"`, `"7"`, `"0176"`, `"GH-176"`, `"gh-176"`) and explicit canonical requested refs (`GH-176`, `GH-7`, `PDEV-7`, `GH-007`),
**When** `queue ready --json` runs through `runCli`,
**Then** the §8.3 identity rule observes exactly the intended item — exact case-insensitive canonical match first, otherwise the all-ASCII-digit bridge only when the observed id equals exactly one requested candidate's canonical numeric suffix — and every wrong-number, ambiguous-suffix, leading-zero, or non-digit non-canonical case leaves the item unobserved with `deps-satisfied`, `tier-known`, and `no-owner-gate` `unknown`/`work-item-unobserved`.

**Preconditions**:

- `identity/cases.ts` table (one row per case) covering: exact canonical (`"GH-176"` for `GH-176`); exact case-insensitive (`"gh-176"` for `GH-176`); bare-number bridge (`"176"` for `GH-176`); wrong number (`"177"` for `GH-176`); ambiguous suffix (`GH-7` + `PDEV-7` with observed `"7"`); leading-zero mismatch (`"0176"` for `GH-176`; `"7"` for `GH-007`); preserved leading zero (`"007"` for `GH-007`); non-digit non-canonical provider id (`"issue-176"`, `"GH-176-extra"`) for `GH-176`; exact-beats-ambiguity (observed `"GH-7"` with both `GH-7` and `PDEV-7` requested); and a multi-candidate observed/unobserved pair.
- A command-level harness that injects the normalized page (provider-shaped ids only; no observed GH-shaped id for a bare-number case), the label signal available, and `blocked-by` relations available.
- The condition oracle: an observed item evaluates label-derived `tier-known`/`no-owner-gate` and relation-derived `deps-satisfied` from its labels/relations; an unobserved item yields `deps-satisfied`, `tier-known`, and `no-owner-gate` `unknown`/`work-item-unobserved` (one record each) before any signal check.

**Steps**:

1. Given observed `identity.entityId: "GH-176"` and requested `GH-176`, when run, then assert `workItem.state === "observed"`, `tier-known` reflects exactly one `priority:*` label, `no-owner-gate` reflects its labels, and `deps-satisfied` reflects its `blocked-by` relations; assert no `work-item-unobserved` on those conditions.
2. Given observed `identity.entityId: "gh-176"` and requested `GH-176`, when run, then assert the exact case-insensitive canonical match observes the item (same outcome as step 1).
3. Given observed `identity.entityId: "176"` and requested `GH-176`, when run, then assert the item is observed through the unique all-ASCII-digit bridge and all label/relation-derived conditions are evaluated; assert the payload `workItemRef` stays canonical `GH-176`.
4. Given observed `identity.entityId: "177"` and requested `GH-176`, when run, then assert the item is unobserved; assert `deps-satisfied`, `tier-known`, and `no-owner-gate` are each `unknown` with exactly one `{ source: "tracker", reason: "work-item-unobserved" }` record; assert no label/relation is borrowed from `"177"`.
5. Given requested `GH-7` and `PDEV-7` with observed `identity.entityId: "7"`, when run, then assert the suffix is ambiguous and, because candidate observation is candidate-set-scoped through the unique-suffix bridge, the item is unobserved for **both** sharing candidates; assert neither wins by precedence or caller order and both name `work-item-unobserved`.
6. Given requested `GH-176` with observed `"0176"`, and requested `GH-007` with observed `"7"`, when run, then assert no match occurs in either case (no numeric coercion); given requested `GH-007` with observed `"007"`, assert it matches (the suffix text is preserved exactly).
7. Given observed exact `"GH-7"` with both `GH-7` and `PDEV-7` requested (the ambiguous suffix is also present), when run, then assert the exact canonical match observes `GH-7` while `PDEV-7` stays unobserved; exact match precedes and resolves the bridge ambiguity.
8. Given an observed `identity.entityId` of a non-digit form that is not the canonical ref (`"issue-176"`, `"GH-176-extra"`) and requested `GH-176`, when run, then assert the item is unobserved (a non-digit provider id never bridges).
9. Given an observed `entityId` longer than `QUEUE_READY_MAX_IDENTITY_CHARS` (128) that matches no candidate, when run, then assert it is unobserved and no projected identity appears; given a 64-character exact canonical match (legal at both the ref cap and the identity cap), assert it is observed, proving matching uses the full normalized value and the output clamp is not applied before matching.
10. Given the multi-candidate pair (one observed `"176"`, one absent from the page), when run, then assert the observed candidate's conditions are evaluated while the unobserved candidate's are `work-item-unobserved`, condition evaluation is independent per candidate, and identity observation is candidate-set-scoped through the unique-suffix bridge, so neither candidate's conditions or rank change the other's.
11. Negative controls: change `"176"` to exact `"GH-176"` and assert the item stays observed (the exact path); change `"176"` to `"177"` and assert it flips to unobserved; delete the requested candidate and assert the page item is never inferred as a candidate. Assert no fixture in the suite observes a canonical candidate through a GH-shaped provider id except the explicit exact rows.

**Expected Outcome**:

- Candidate observation follows the §8.3 rule exactly: exact case-insensitive canonical match wins; a unique all-ASCII-digit `entityId` bridges to the canonical numeric suffix; a wrong number, a shared suffix, a leading-zero difference, and a non-digit non-canonical id all leave the item unobserved with `work-item-unobserved` on every label/relation-derived condition. A shared suffix leaves the item unobserved for every sharing candidate, never by precedence or caller order; condition evaluation is otherwise independent per candidate. Matching runs on the full normalized value before any output clamp, so the live GitHub slice observes `GH-176` from `"176"` instead of silently degrading.

#### TC-QREADY-037 - `blocked-by` target resolution: exact, bare-number bridge, unobserved, ambiguous, leading zeros

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, §8.3, DM-2, DM-3, DM-11, DEC-18, AC-F4-2, AC-F17-1, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-identity.test.ts`, `tests/fixtures/queue-ready/identity/cases.ts`, `tests/fixtures/queue-ready/deps/cases.ts`
**Tags**: @backend @golden

**Given** an observed candidate (provider-shaped `"176"` for `GH-176`) with relations available and one or more `blocked-by` targets whose full `identity.entityId` is provider-shaped (`"179"`, `"180"`, `"0179"`, `"7"`, `"GH-179"`), while the observed page contains items with ids `"179"`, `"180"`, `"7"`, and `"GH-179"` (`GH-179` is not a requested candidate), with `GH-7` and `PDEV-7` observed in the ambiguous row,
**When** `deps-satisfied` is evaluated through `runCli`,
**Then** each target resolves by the same §8.3 rule symmetrically — exact full-value identity first, otherwise the unique digit-only bridge — and a no-match, ambiguous, or leading-zero-mismatch target is unobserved (`dependency-unobserved`), never assumed done.

**Preconditions**:

- `identity/cases.ts` relation-target rows: exact (`target "179"` vs observed item `"179"`); exact-canonical (`target "GH-179"` vs observed item `"GH-179"`, including the observed item not being a requested candidate); bare-number bridge (`target "179"` vs a canonical-shaped observed item only when exactly one observed work item carries suffix `179`); no-match (`target "999"` absent from the page); ambiguous (bare numeric target `"7"` with two observed work items carrying suffix `7` and no exact observed match); leading-zero mismatch (`target "0179"` vs observed `"179"`); target done/canceled; target `in-progress`/`open`; mixed open + unobserved; all targets unobserved; an over-cap target identity (>128 chars) that exactly equals an observed item id. The target uniqueness domain is the observed work-item set, never the requested candidate set.
- The observed candidate's relation signal available and exactly one `tracker` evidence record per state; the state-count detail `done:<n>; open:<n>; unknown:<n>` sums to the total `blocked-by` relation target count (observed + unobserved).

**Steps**:

1. Given `target.entityId: "179"` and an observed item with the same full identity `"179"` whose delivery state is `done`, when evaluated, then assert `satisfied`/`dependencies-done` with detail `done:1; open:0; unknown:0`; assert the target is observed by the exact full-value rule.
2. Given `target.entityId: "180"` observed with a non-done, non-canceled state, when evaluated, then assert `unsatisfied`/`dependency-open` with detail `done:0; open:1; unknown:0`.
3. Given `target.entityId: "GH-179"` and an observed item whose full identity is `"GH-179"` while `GH-179` is **not** a requested candidate, when evaluated, then assert the exact canonical match observes the target against the observed work-item set and its state decides the condition (no bridge needed and no requested-candidate requirement).
4. Given `target.entityId: "999"` with no observed item, when evaluated, then assert `unknown`/`dependency-unobserved` with detail `done:0; open:0; unknown:1`; assert the target is never assumed done.
5. Given `target.entityId: "7"` with two observed work items carrying suffix `7` and no exact observed match, when evaluated, then assert the target is ambiguous and unobserved (`dependency-unobserved`), never assigned to one observed work item by precedence or caller order.
6. Given `target.entityId: "0179"` and an observed item `"179"`, when evaluated, then assert no match occurs (no leading-zero coercion) and the target counts under `unknown`.
7. Given a target digit string that matches a canonical-shaped observed item only through the unique bridge (exactly one observed work item carries the suffix), when evaluated, then assert the target resolves and its state decides `dependencies-done`/`dependency-open`; assert the count detail includes it.
8. Given a target identity longer than `QUEUE_READY_MAX_IDENTITY_CHARS` that exactly equals an observed item's full identity, when evaluated, then assert it resolves before projection (the clamp is output-only); given the same target projected, assert the payload target is the capped `entityId` only (no `systemName`, the whole identity object at 128) with `value-clamped` while the verdict is unchanged.
9. Given mixed targets (one open + one unobserved), when evaluated, then assert `dependency-open` wins with detail `done:0; open:1; unknown:1`; given all targets unobserved, assert `dependency-unobserved` with the correct three counts.
10. Controls: change the resolved target's state from `done` to `open` and assert the condition flips to `dependency-open`; change `"179"` to `"0179"` and assert the target flips to unobserved; add a second observed work item carrying the same suffix and assert the bridge becomes ambiguous. Every state still carries exactly one `tracker` record and no per-target record.

**Expected Outcome**:

- `blocked-by` targets resolve against the observed work-item set: exact full-value identity first, then the unique digit-only bridge whose uniqueness domain is the observed set (not the requested candidates); an unresolvable or ambiguous target is `dependency-unobserved` and never assumed done; a canonical-shaped target observed by exact match is resolved even when that ref is not a requested candidate; leading-zero mismatches never coerce; matching uses the full value before any output clamp; `deps-satisfied` still carries exactly one state-count record whose counts sum to the total `blocked-by` relation target count (observed + unobserved).

#### TC-QREADY-038 - Provider-derived caps: nine caps, output-only clamps, `value-clamped`, byte-budget reduction, `blocked-by`-only projection, byte-aware human render

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, F-13, DM-1, DM-2, DM-6, DM-9, DM-10, DM-11, DM-12, DEC-19, DEC-20, RSK-14, AC-F12-2, AC-F13-1, AC-F17-1, NFR-2
**Test Type(s)**: Integration, Contract, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-ready-output.test.ts`, `tests/fixtures/queue-ready/caps/over-long/**`, `tests/fixtures/queue-ready/caps/non-ascii-byte-budget.ts`, `tests/fixtures/queue-ready/identity/cases.ts`
**Tags**: @backend @golden

**Given** a legal normalized view whose provider-derived fields exceed every declared cap (over-long labels, more than 16 labels, more than 16 relations of mixed kinds, over-long repository owner and name, head branch, pull-request `entityId`/`sourceRef`/`targetRef`, an over-long `systemName` on relation targets and pull-request identities, and `updatedAt`), run at command level through `runCli`,
**When** `queue ready --json` projects the payload (and the same data is rendered in human mode),
**Then** every projected provider-qualified identity (each `blocked-by` relation target and the selected pull request) is `entityId`-only with no `systemName` in the payload, and that `entityId` is at most 128 characters (the whole projected identity object), every ref/label is <=128 characters, labels <=16 in provider order, `blocked-by` relations <=16 in provider order, owner/name <=128, branch <=256, `updatedAt` <=40, non-`blocked-by` relations are absent (not clamped), payload `truncated: true` with `value-clamped` after `source-truncated` (or in the group-2 position), `data` <=65 536 UTF-8 bytes, and the human digest is <=16 lines/4096 UTF-8 bytes with 32-UTF-8-byte provider segments, a 400-UTF-8-byte candidate line, and a 620-UTF-8-byte header plus summary; every verdict field is identical to the same view without the caps and the renderer never throws for a legal payload.

**Preconditions**:

- `caps/over-long` fixtures: one work item with 20 labels (each 200 chars, including one `priority:high` beyond index 16 and one `hand-back` beyond index 16) and 20 `blocked-by` relations plus `blocks`/`parent`/`child`/`relates-to` relations, targets with 200-character identities, 200-character `systemName` values, and `updatedAt` of 60 chars; a repository binding with 200-character owner and name; a head branch of 300 chars; 3 associated open PRs with 200-character `entityId`/`sourceRef`/`targetRef` and a 200-character `systemName`.
- A twin fixture with the same values truncated only in the output projection removed (the "no caps" oracle) so verdicts can be compared field by field.
- `caps/non-ascii-byte-budget.ts` (CJK, over the 65 536-UTF-8-byte cap) for the exact reduction-order assertions, and `caps/human-astral-8/**` for the byte-aware renderer worst case.
- `assertEnvelopeContract`, a JSON UTF-8 byte-length probe, and a human line/UTF-8-byte/segment parser.

**Steps**:

1. Given the over-long fixture, when run with `--json`, then assert every `workItem.labels[]` is <=128 chars and `labels.length <= 16`, in provider order (the first 16 retained, the tail dropped); assert the dropped `priority:high`/`hand-back` beyond index 16 did **not** change `tier-known`/`no-owner-gate` from the full-value verdict.
2. Assert every `workItem.relations[]` is a `blocked-by` relation, `relations.length <= 16`, and each target is `entityId`-only (no `systemName` key) with `entityId` <=128 chars; assert `JSON.stringify(data)` contains no `systemName` key and the over-long `systemName` fixture value appears nowhere in the payload or human digest; assert no `blocks`/`parent`/`child`/`relates-to` relation object appears anywhere in the payload (filtered out entirely, not clamped).
3. Assert `close.pullRequest` carries only an `entityId`-only projected identity (no `systemName` key) and every `close.pullRequest.entityId`, `sourceRef`, and `targetRef` is <=128 chars; assert `repository.owner`/`repository.name` <=128 and `head.branch` <=256; assert `workItem.updatedAt` <=40.
4. Assert each provider value is a prefix of the full value (a clamp, not a substitution) and that the full over-long value appears nowhere in the payload or human digest.
5. Assert payload `truncated: true` and `reasons` contains `value-clamped`; assert it is immediately after `source-truncated` when both are present, and otherwise in the group-2 position (after group 1, before any provider-config reason); assert `value-clamped` never appears in condition or close evidence.
6. Compare the over-long run against the no-caps oracle: assert `conditions[]` (`id`/`state`), `blockingConditions`, `closeClass`, every `rank`, `close.associatedCount`, and all `summary` counts are identical; assert the only `reasons` delta is `value-clamped` (and `source-truncated` if a page was at limit), the only `truncated` delta is the payload flag, and the only projection deltas are capped values and the omitted `systemName`.
7. Assert `Buffer.byteLength(JSON.stringify(data), "utf8") <= 65536`; assert the same run in human mode is <=16 lines and `Buffer.byteLength(stdout, "utf8") <= 4096`; assert each provider PR segment (`PR #<entityId>` and `<sourceRef>`) is at most 32 UTF-8 bytes including a trailing `+` when shortened with no split code point, each candidate line is <=400 UTF-8 bytes, header plus summary is <=620 UTF-8 bytes, and the payload still carries its own capped (not 32-byte) values; assert the renderer exits `0` and never throws for the legal fixture.
8. Given `caps/non-ascii-byte-budget.ts` (the fully capped projection still exceeds 65 536 UTF-8 bytes), when projected, then assert the deterministic reduction in the exact pinned order: `workItem.relations` entries are dropped before any `workItem.labels` entry; candidates are processed in reverse rank order (last-ranked first); within a candidate the highest index is dropped first; the budget is rechecked after each drop; every drop keeps `truncated: true` + `value-clamped`; and no condition, evidence, close field, summary count, `rank`, or `reasons` entry is dropped. A reversed-order twin (labels first or first-ranked first) must fail by name.
9. Assert the `value-clamped` marker is emitted once per payload (not once per clamp) and is idempotent across replays; assert rerunning the same over-long fixture produces byte-identical output.
10. Negative controls: raise one provider value one character above its cap with the projection disabled and assert the contract assertion fails by name; remove `value-clamped` from a clamped payload and fail; force a clamp to change one label-derived verdict and fail; drop a condition to fit the byte budget and fail; character-count a multi-byte human segment and fail the 32-byte assertion. The unmutated control is green.
11. Assert the human digest's over-long provider segments are the only shortened fields and that no `value-clamped` token is rendered as a condition reason; assert the digest still ends every candidate line with `[repo:local-context; tier:priority-label]`.

**Expected Outcome**:

- All nine provider-derived caps are enforced end-to-end through `runCli`; every projected relation-target and pull-request identity carries `entityId` only with `systemName` omitted, including when the source `systemName` is over-long (no tenth cap); clamping is output-only (a beyond-cap label still counts for the tier/owner predicate, an over-long target still resolves, ranking/selection still use the full refs); every clamp marks payload `truncated` and adds exactly one `value-clamped` in group 2; non-`blocked-by` relations are absent rather than clamped; the serialized `data` stays <=65 536 UTF-8 bytes via the exact-order deterministic reduction and the human digest stays <=16 lines/4096 UTF-8 bytes with 32-UTF-8-byte provider segments, 400-byte candidate lines, and a 620-byte header plus summary, never throwing for a legal payload; no verdict, rank, count, or summary changes.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager` | All queue-ready suites are hermetic and in-process |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; existing `ts-*` jobs | Authoritative for structure, checks, boundary, corpus, golden, and aggregate gates |
| Temp fixture roots | `mkdtemp` under the OS temp directory | PM-context, state-park, repository, and mutation fixtures never write the live tree |
| Opt-in live environment | `ADOS_QUEUE_READY_LIVE=1` plus a resolvable `GITHUB_TOKEN` (through the injected port) | Not part of `pnpm check` or default CI; structural assertions only |
| In-process test process | Bun runtime; injected brand, clock, run id, sources, state, and streams | No child processes for any queue-ready suite; fixed output facts for byte assertions |

### 6.2 Queue-Ready Fixture Corpus

The corpus lives under `tests/fixtures/queue-ready/**`. Every case is a committed `case.json` or a typed case in `cases.ts` with an explicit expected verdict; fixtures are never named `*.test.ts`.

**Directory map**

```
tests/fixtures/queue-ready/
  harness.ts                       # fact builders, run helper, fixed clock/brand
  refs/cases.ts                    # grammar/canonicalization/duplicate/cap cases
  matrix/cases.ts                  # one row per condition x state cell (Appendix A)
  identity/cases.ts                # candidate identity + blocked-by target resolution (§8.3)
  deps/cases.ts                    # blocked-by relation cases
  repo/cases.ts                    # PM-context projection cases
  tier/cases.ts                    # priority-label cases
  owner/cases.ts                   # owner-attention label cases
  ci/cases.ts                      # CI classification/unresolved/failed cases
  provider/cases.ts                # chain/entry/park/config/fold cases
  close/cases.ts                   # association/classification/selection/count cases
  ranking/cases.ts                 # class order and tie-break cases
  reasons/cases.ts                 # six-group top-level reason order/dedup/cap cases
  negative-controls/cases.ts       # the 22 AC-F14-1 controls + restored controls
  pm-context/*.yaml                # absent/no-active-change/candidate/other/malformed/wrong-shape/notes-canary
  providers/*.json                 # chain-default/partial/all-parked/chain-parked/no-chain/unresolved/unresolved-chain-command/config-invalid/park-fold-torn
  bounds/{under-cap,at-cap,cap-sized,over-cap,at-limit}/**
  caps/over-long/**                # provider-derived over-cap fields + byte-budget fixture
  caps/non-ascii-byte-budget.ts    # CJK under UTF-16 cap / over UTF-8 cap; exact reduction-order sentinels
  caps/human-astral-8/**           # 8 candidates + astral 256-code-point branch + multi-byte PR refs
  caps/human-over-budget/**        # synthetic legal payload that triggers the reverse-rank line drop
  corpus/<case>/case.json          # expected-verdict corpus
  golden/{payload.json,human.txt}  # byte-for-byte golden (evaluator-produced, DM-1/DM-2 valid)
  literals/secret-canary.txt       # planted-secret canary (test data only)
```

**Corpus cases and expected verdicts** (condition order: deps / repo / tier / owner / CI / provider; `S` = satisfied, `U` = unsatisfied, `?` = unknown). The `rank` column is the payload's 1-based position after sorting (DM-7): a single-candidate case has `rank: 1`; the DM-7 class rank (0–4) is a separate bucket and is never the `rank` field. Multi-candidate rows use the actual 1-based position. Rows marked *evaluator-injected view* are exercised only by the pure evaluator over an injected normalized view and are never produced by `runCli`, because the delivered command read is open-only.

| Corpus case | Planted facts / delta | Expected conditions | ready / closeClass / rank (1-based) | Asserted evidence |
|-------------|----------------------|---------------------|--------------------------------------|-------------------|
| `ready-new-start` | All six satisfiable; deps available zero targets; no active change; one `priority:high`; no owner label; CI succeeded; chain with enabled unparked entry; PR page below limit no match | S S S S S S | true / `new-start` / 1 | `no-blocked-dependencies`, `no-active-change` with detail `repo:local-context`, `tier-label` with detail `tier:priority-label; label:priority:high`, `no-owner-labels`, `ci-succeeded`, then provider pair `{provider-parks, no-active-park, chain:<name>}` + `{provider-config, engine-not-run}`; `associatedCount: 0`; `pr-not-associated` |
| `ready-unknown-association` | As above; PR read fails | S S S S S S | true / `unknown` / 1 | `pr-association-unknown`; top-level read failure |
| `ready-candidate-active` | Active change equals `GH-176` | S S S S S S | true / `new-start` / 1 | `candidate-is-active` with detail `repo:local-context; candidate-is-active` |
| `ref-length-max-64` | A 64-character canonical ref, all six satisfiable | S S S S S S | true / `new-start` / 1 | accepted at the `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS` (64) cap; emitted `workItemRef` is the 64-character ref; no rejection |
| `identity-github-shape` | Requested `GH-176`; observed work item `identity.entityId: "176"` with one `priority:high`, no owner label, and a `blocked-by` target `"179"` observed done | S S S S S S | true / `new-start` / 1 | `tier-label`, `no-owner-labels`, `dependencies-done`; never `work-item-unobserved`; provider-shaped id bridged by the §8.3 unique-suffix rule |
| `identity-exact-canonical` | Requested `GH-176`; observed `identity.entityId: "gh-176"` (exact, case-insensitive) | S S S S S S | true / `new-start` / 1 | exact canonical match wins and evaluates the label/relation conditions |
| `identity-wrong-number` | Requested `GH-176`; observed `identity.entityId: "177"` | ? S ? ? S S | false / `not-ready` / 1 | `work-item-unobserved` on deps/tier/owner (one record each); no borrowed label/relation |
| `identity-ambiguous-suffix` | Requested `GH-7` and `PDEV-7`; observed `identity.entityId: "7"` (no exact match) | ? S ? ? S S (both candidates) | false / `not-ready` / ranks 1..2 | candidate observation is candidate-set-scoped: the shared suffix leaves the item unobserved for both sharing candidates (never precedence or caller order); an exact `"GH-7"` control observes only `GH-7`; neither candidate's conditions change the other's |
| `identity-leading-zero` | Requested `GH-176` with observed `"0176"`; requested `GH-007` with observed `"7"` | ? S ? ? S S | false / `not-ready` / 1 | no match (no numeric coercion); the `"007"` preserved-suffix control is in TC-QREADY-036 |
| `relation-target-github-shape` | Observed candidate `"176"` for `GH-176`; relations available; target `"179"` observed `in-progress` | U S S S S S | false / `not-ready` / 1 | `dependency-open` with detail `done:0; open:1; unknown:0`; target resolved by full identity `"179"` == `"179"` |
| `relation-target-unobserved` | Target `"999"` absent from the observed page; no known open target | ? S S S S S | false / `not-ready` / 1 | `dependency-unobserved` with `done:0; open:0; unknown:1`; never assumed done |
| `relation-target-leading-zero` | Target `"0179"` with observed item `"179"` | ? S S S S S | false / `not-ready` / 1 | no match (leading-zero mismatch); `dependency-unobserved` |
| `relation-target-canonical-unrequested` | Observed candidate `"176"` for `GH-176`; relations available; target `GH-179` observed as `GH-179` while `GH-179` is **not** a requested candidate | U S S S S S | false / `not-ready` / 1 | `dependency-open` with detail `done:0; open:1; unknown:0`; the exact observed match wins against the observed work-item set (no requested-candidate requirement, no bridge) |
| `not-ready-deps-unavailable` | GitHub-shaped relations unavailable, zero visible relations, candidate observed | ? S S S S S | false / `not-ready` / 1 | `signal-unavailable` |
| `not-ready-deps-open` | Relations available; target in progress | U S S S S S | false / `not-ready` / 1 | `dependency-open` with state-count detail `done:0; open:1; unknown:0` (no target ref) |
| `not-ready-deps-target-unobserved` | Done target outside the observed page | ? S S S S S | false / `not-ready` / 1 | `dependency-unobserved` with state-count detail `done:0; open:0; unknown:<n>` |
| `not-ready-candidate-unobserved` | Candidate absent from the issues page | ? S ? ? S S | false / `not-ready` / 1 | `work-item-unobserved` on deps/tier/owner (one record each; unobserved wins before any signal check) |
| `not-ready-repo-other-active` | Active change `GH-179` | S U S S S S | false / `not-ready` / 1 | `other-active-change` with detail `repo:local-context; active-change:GH-179` |
| `not-ready-repo-context-missing` | PM context absent | S ? S S S S | false / `not-ready` / 1 | `local-context-missing` (no detail) |
| `not-ready-repo-context-malformed` | Malformed YAML/wrong shape (including `active_change: null`) | S ? S S S S | false / `not-ready` / 1 | `local-context-malformed` (no detail) |
| `not-ready-tier-absent` | No recognized priority label | S S ? S S S | false / `not-ready` / 1 | `tier-absent` with detail `tier:priority-label; none` |
| `not-ready-tier-conflict` | `priority:high` + `priority:low` | S S U S S S | false / `not-ready` / 1 | `tier-conflict` with detail `tier:priority-label; labels:priority:high,priority:low` |
| `not-ready-owner-gate` | `hand-back` | S S S U S S | false / `not-ready` / 1 | `owner-labels:hand-back` |
| `not-ready-ci-none` | Zero runs | S S S S U S | false / `not-ready` / 1 | `ci-none` |
| `not-ready-ci-pending` | Pending run | S S S S U S | false / `not-ready` / 1 | `ci-pending` |
| `not-ready-ci-failed` | Failed run | S S S S U S | false / `not-ready` / 1 | `ci-failed` |
| `not-ready-ci-canceled` | Canceled run | S S S S U S | false / `not-ready` / 1 | `ci-canceled` |
| `not-ready-ci-unresolved` | HEAD without SHA (binding observed, tracker/pulls read succeeded) | S S S S ? S | false / `not-ready` / 1 | `commit-unresolved` |
| `not-ready-ci-read-failed` | Check-runs read fails (tracker/pulls succeeded) | S S S S ? S | false / `not-ready` / 1 | `read-failed` + bounded `failureCode`/`failureClass`; group-5 reason |
| `not-ready-ci-credential-unavailable` | No resolvable credential; the `edge` refusal makes all three GitHub reads return `credential-unavailable` | ? S ? ? ? S | false / `not-ready` / 1 | CI `credential-unavailable`; deps/tier/owner `work-item-unobserved`; close association unknown; no `new-start` |
| `not-ready-ci-addressing-unresolved` | Binding unavailable; `status.ts` skips all three GitHub reads | ? S ? ? ? S | false / `not-ready` / 1 | CI `addressing-unresolved` (group 1 binding reason); deps/tier/owner `work-item-unobserved`; zero GitHub reads; close association unknown |
| `not-ready-ci-remote-unsupported` | Unsupported host; `status.ts` skips all three GitHub reads | ? S ? ? ? S | false / `not-ready` / 1 | CI `remote-unsupported` (group 1 binding reason); deps/tier/owner `work-item-unobserved`; zero GitHub reads; close association unknown |
| `not-ready-ci-at-limit-neutral` | Raw check-runs page of exactly 20, classification `succeeded` | S S S S S S | true / `new-start` / 1 | payload reason `source-truncated` + payload `truncated: true`; `ci-healthy` state/evidence/blocking identical to the 19-run control; no condition evidence `source-truncated` |
| `not-ready-provider-undeclared` | No default chain | S S S S S ? | false / `not-ready` / 1 | `provider-chain-not-declared` |
| `not-ready-provider-unresolved` | Provider config read fails with `{ok:false, reason:"provider-chain-unresolved"}` (the delivered validator/edge shape; a defensive `ok:true` missing-chain evaluator twin is also asserted) | S S S S S ? | false / `not-ready` / 1 | `provider-chain-unresolved` with `{ source: "provider-config", reason: "provider-chain-unresolved", detail: "failureCode:config.value.invalid" }` first + `{ provider-config, engine-not-run }` (no detail); failure mapped by the read's `reason`, not `config-invalid`; the defensive `ok:true` twin carries no failure detail |
| `not-ready-provider-config-invalid` | Config read fails | S S S S S ? | false / `not-ready` / 1 | `config-invalid` (source `provider-config`) with the pinned `failureCode`/`failureClass` detail form when the read supplies it; never free-form |
| `not-ready-provider-park-fold-failed` | Park fold `state-unreadable` | S S S S S ? | false / `not-ready` / 1 | `state-unreadable` (source `provider-parks`) with the park read's `failureCode`/`failureClass` in the pinned form where supplied; never free-form |
| `not-ready-provider-no-enabled` | All chain entries disabled | S S S S S U | false / `not-ready` / 1 | `no-enabled-entry` |
| `not-ready-provider-all-parked` | Every enabled entry parked | S S S S S U | false / `not-ready` / 1 | `all-entries-parked` |
| `not-ready-provider-chain-parked` | Active chain park (cause + expiry) | S S S S S U | false / `not-ready` / 1 | `{provider-parks, chain-parked, chain:<name>; until:<expiry or none>; cause:<cause or none>}` + `{provider-config, engine-not-run}` |
| `merge-ready` | All S; associated non-draft PR, review observed `approved` | S S S S S S | true / `merge-ready` / 1 | `pr-associated`; selected `entityId`/`sourceRef` |
| `review-pending-unknown-review` | All S; associated non-draft PR, review signal unavailable | S S S S S S | true / `review-pending` / 1 | `pr-associated`; `reviewStateObserved: false` |
| `review-pending-not-ready` | Repo U + CI U; associated draft PR | S U S S U S | false / `review-pending` / 1 | `other-active-change`, `ci-*`; `blockingConditions` names both |
| `all-unknown-degraded` | Binding unavailable (no remote reads attempted); config invalid; park fold failed; PM context no active change | ? S ? ? ? ? | false / `not-ready` / 1 | binding reason `addressing-unresolved`/`remote-unsupported`; deps/tier/owner each carry exactly one `{ source: "tracker", reason: "work-item-unobserved" }` record; `config-invalid`; `state-unreadable`; no `read-failed` (no remote read attempted) |
| `at-limit-pr-no-match` | PR page exactly 100, no open match; all S | S S S S S S | true / `unknown` / 1 | `pr-association-unknown`; payload reason `source-truncated`; payload `truncated: true`; candidate `truncated: false`; `associatedCount` page-bounded lower bound in `0..100` |
| `at-limit-pr-no-match-merged` (*evaluator-injected view*) | PR page exactly 100; only matching objects are merged/closed | S S S S S S | true / `unknown` / 1 | `pr-association-unknown` (at-limit rule wins over `pr-not-open`); payload `truncated: true`; `associatedCount` lower bound |
| `source-truncated-issues` | Issues page exactly 100 with the candidate observed | S S S S S S | true / `new-start` / 1 | payload reason `source-truncated`; payload `truncated: true`; candidate `truncated: false`; no condition state change |
| `close-selected-merge-ready` | Two associated open PRs; merge-ready present plus lower entityId non-merge-ready | S S S S S S | true / `merge-ready` / 1 | selected merge-ready PR; `associatedCount: 2` (open matches only) |
| `close-selection-numeric` | Associated non-approved open PRs `entityId` 10 and 9 | S S S S S S | true / `review-pending` / 1 | selected `9`; `associatedCount: 2` |
| `close-selection-text-tie` | Numeric-equal entityIds with different `sourceRef` | S S S S S S | true / `review-pending` / 1 | lexical `sourceRef` tie-break; `associatedCount` exact |
| `close-selection-target-tie` | Numeric-equal entityIds (`7`/`007`) with equal `sourceRef` and different `targetRef` | S S S S S S | true / `review-pending` / 1 | lexical `targetRef` tie-break; `associatedCount` exact |
| `close-selection-raw-entity-tie` | Numeric-equal entityIds (`7`/`007`) with equal `sourceRef` and equal `targetRef` | S S S S S S | true / `review-pending` / 1 | final raw-`entityId` lexical tie-break selects `007`; `associatedCount` exact |
| `close-associated-count-three` | Three associated open PRs plus one merged match | S S S S S S | true / `review-pending` / 1 | `associatedCount: 3` (merged not counted); deterministic selection |
| `close-merged-excluded` (*evaluator-injected view*) | Only matching PR objects are merged/closed, below limit, all six satisfied | S S S S S S | true / `new-start` / 1 | merged/closed not selected; `not-associated` with `pr-not-open`; `associatedCount: 0` |
| `close-merged-only-not-ready` (*evaluator-injected view*) | Only matching PR objects are merged/closed, below limit, one condition unsatisfied | S U S S S S | false / `not-ready` / 1 | `pr-not-open`; fallback class `not-ready` (not `review-pending`/`merge-ready`); `associatedCount: 0` |
| `cap-sized-8` | 8 candidates across classes | per candidate | ranks 1..8 | payload <=65 536 UTF-8 bytes; human <=16 lines/4096 UTF-8 bytes with byte-aware segments, 400-byte candidate lines, 620-byte header plus summary |
| `human-astral-8-cap` | 8 candidates; astral 256-code-point head branch; in-cap multi-byte (astral/CJK) PR `entityId`/`sourceRef`; human mode | per candidate | ranks 1..8 | digest <=4096 UTF-8 bytes; exit `0`; no `fallback.internal`/throw; segment <=32 UTF-8 bytes including `+`; header owner/name <=128 and branch <=256 UTF-8 bytes; payload still <=65 536 UTF-8 bytes |
| `human-over-budget-line-drop` | Synthetic legal payload whose byte-capped render still exceeds 4096 UTF-8 bytes; human mode | payload-level | unchanged | trailing candidate lines dropped in reverse rank order (last-ranked first); header (when present) + summary retained; `+more` after the summary; payload `data`, `truncated`, `reasons`, and `summary` byte-identical; no new reason token; exit `0` |
| `provider-over-cap-fields` | All provider-derived fields above their caps (20 labels of 200 chars incl. a beyond-cap `priority:high`, 20 mixed relations, 200-char owner/name, 300-char branch, 60-char `updatedAt`, 200-char PR `entityId`/`sourceRef`/`targetRef`, and a 200-char `systemName` on targets/PR identities) through `runCli` | per candidate | unchanged verdict / 1 | caps: every projected identity `entityId`-only with no `systemName` (absent key and value), identity/ref/label/owner/name <=128, labels <=16, `blocked-by` relations <=16, branch <=256, timestamp <=40; non-`blocked-by` kinds absent; payload `truncated: true` + `value-clamped`; condition states/`closeClass`/ranks/`associatedCount`/summary identical to the no-caps oracle; `data` <=65 536 UTF-8 bytes; human <=16 lines/4096 UTF-8 bytes with <=32-UTF-8-byte provider segments, <=400-byte candidate lines, and <=620-byte header plus summary |
| `provider-over-cap-byte-budget` | `caps/non-ascii-byte-budget.ts`: CJK, under the UTF-16 cap but over the 65 536-UTF-8-byte cap; per-candidate rank/index sentinels | per candidate | unchanged verdict / 1 | exact pinned order: relations before labels; last-ranked candidate/largest `rank` first; highest index first; recheck after each drop; payload `truncated: true` + `value-clamped`; no condition/evidence/close/summary/rank/reason dropped; reversed-order twin fails by name |
| `reasons-cap-7` | Seven unique global reasons across all groups | per candidate | unaffected verdict / 1 | first six retained in `QUEUE_READY_REASON_ORDER`; payload `truncated: true` only; candidate flags unaffected |
| `reasons-six-group-order` | One trigger from each of the six groups, scrambled read/evidence order | per candidate | unaffected verdict / 1 | exact six-group order: binding, `source-truncated`, provider-config, park-fold, source-failure subset, `pr-association-unknown`; first occurrence wins; no verdict reason |
| `detail-clamp` | Detail >160 | per candidate | unaffected verdict / 1 | clamped to 160 chars; raw value absent; neither candidate nor payload `truncated` set by clamping; no `source-truncated`; no title field |
| `canonical-leading-zeros` | Refs `gh-176`, `gh-007`, `GH-7` in one invocation | per candidate | ranks 1..3 | emitted `GH-176`, `GH-007`, `GH-7`; leading zeros preserved; `GH-007` before `GH-7` (canonical text ascending) |
| `ranking-numeric-ties` | Same class `GH-9`, `GH-10`, `GH-100`, `GH-7`, `GH-007` | per candidate | ranks 1..5; order `GH-007`, `GH-7`, `GH-9`, `GH-10`, `GH-100` | numeric suffix then canonical text |
| `secret-canary` | Planted secret in the provider item title/labels/provider payload/PM `notes` | per candidate | unaffected verdict / 1 | canary absent from payload/evidence/human; the payload has no title field |

The synthetic over-cap contract case that would emit three evidence records is not a corpus row; it lives in `bounds/flag-matrix/**` and is exercised by TC-QREADY-035. The delivered `deps-satisfied` condition carries exactly one record, and `provider-available`'s two records are the only reachable multi-record case.

**Completeness meta-check** (enforced by TC-QREADY-028):

| Dimension | Required coverage | Corpus cases |
|-----------|-------------------|--------------|
| `deps-satisfied` S/U/? | all three; exactly one record per state; state-count detail summing to the total `blocked-by` relation target count (observed + unobserved) | `ready-new-start` / `not-ready-deps-open` / `not-ready-deps-unavailable`, `not-ready-candidate-unobserved`, `not-ready-deps-target-unobserved` |
| `repo-free` S/U/? | all three; observed states carry the `repo:local-context` proxy detail | `ready-new-start`, `ready-candidate-active` / `not-ready-repo-other-active` / `not-ready-repo-context-missing`, `not-ready-repo-context-malformed` |
| `tier-known` S/U/? | all three; each state carries the `tier:priority-label` detail | `ready-new-start` / `not-ready-tier-conflict` / `not-ready-tier-absent`, `not-ready-candidate-unobserved` |
| `no-owner-gate` S/U/? | all three | `ready-new-start` / `not-ready-owner-gate` / `not-ready-candidate-unobserved` |
| `ci-healthy` S/U/? | all three plus each `unknown` reason | `ready-new-start` / `not-ready-ci-{none,pending,failed,canceled}` / `not-ready-ci-unresolved` (`commit-unresolved`), `not-ready-ci-addressing-unresolved` (`addressing-unresolved`), `not-ready-ci-remote-unsupported` (`remote-unsupported`), `not-ready-ci-credential-unavailable` (`credential-unavailable`), `not-ready-ci-read-failed` (`read-failed` + bounded code/class) |
| `provider-available` S/U/? | all three plus exact two-record pairing; park-fold failure source is `provider-parks`; config failures mapped by the read's `reason`; config/park failure details use the pinned `failureCode:<code>`, `failureClass:<class>`, or both joined by `; ` form (or no `detail` when neither is supplied), never free-form; `provider-chain-not-declared` and the defensive `ok:true` view carry no failure detail | `ready-new-start` (satisfied pair) / `not-ready-provider-{no-enabled,all-parked,chain-parked}` (case record + `engine-not-run`) / `not-ready-provider-{undeclared,unresolved,config-invalid}` (config case record + `engine-not-run`; `unresolved` uses command-level `{ok:false, reason:"provider-chain-unresolved"}` with `detail:"failureCode:config.value.invalid"` plus a defensive `ok:true` twin with no failure detail) / `not-ready-provider-park-fold-failed` (`{provider-parks, state-unreadable}` with the park read's code/class detail where supplied + `engine-not-run`) |
| Close classes | all five | `merge-ready` / `review-pending-unknown-review`, `review-pending-not-ready` / `ready-new-start` / `ready-unknown-association`, `at-limit-pr-no-match` / `not-ready-*`, `close-merged-only-not-ready` (evaluator-injected) |
| Associated count | exact below limit, lower bound at limit, 0 on failed read/unavailable binding, open matches only, `0..100` | `close-selected-merge-ready` (2), `close-selection-numeric` (2), `close-associated-count-three` (3), `close-merged-excluded` (0), `at-limit-pr-no-match` (lower bound) |
| `pr-not-open` / merged-closed exclusion | command level never yields `pr-not-open` (always `pr-not-associated`); evaluator-injected below-limit merged/closed-only yields `pr-not-open` with the fallback class; at-limit rule wins; never selected/counted | `close-merged-excluded` (evaluator), `close-merged-only-not-ready` (evaluator), `at-limit-pr-no-match-merged` (evaluator), `close-associated-count-three` (open-only count) |
| Source failures | all named; binding/credential rows show the true composed state; provider config failures mapped by the read's `reason`; provider config/park failure details use the pinned `failureCode`/`failureClass` form (never free-form), and a hand-planted free-form provider failure detail fails by name | issues (`all-unknown-degraded`), pulls (`ready-unknown-association`), check-runs (`not-ready-ci-read-failed`), credential (`not-ready-ci-credential-unavailable`), binding (`all-unknown-degraded`, `not-ready-ci-addressing-unresolved`), unsupported host (`not-ready-ci-remote-unsupported`), SHA (`not-ready-ci-unresolved`), config (`not-ready-provider-config-invalid`), chain unresolved (`not-ready-provider-unresolved`, `{ok:false, reason:"provider-chain-unresolved"}` with `failureCode:config.value.invalid`), chain not declared (`not-ready-provider-undeclared`), park fold (`not-ready-provider-park-fold-failed`), PM missing/malformed (`not-ready-repo-context-*`) |
| Identity resolution | exact canonical + case-insensitive, bare-number bridge, wrong number, candidate-set-scoped ambiguous suffix (no precedence/caller order), leading-zero mismatch, preserved leading zeros, non-digit non-canonical, exact-beats-ambiguity, full-value-before-clamp; target resolution uses observed-set uniqueness incl. a canonical observed target that is not a requested candidate | `identity-github-shape`, `identity-exact-canonical`, `identity-wrong-number`, `identity-ambiguous-suffix`, `identity-leading-zero`; relation twins `relation-target-github-shape`, `relation-target-canonical-unrequested`, `relation-target-unobserved`, `relation-target-leading-zero` |
| Provider-derived caps | all nine caps, `entityId`-only projected identities (no `systemName`, incl. an over-long `systemName` fixture), output-only equality, `value-clamped` in group 2, `blocked-by`-only projection, byte-budget reduction, both byte bounds | `provider-over-cap-fields`, `provider-over-cap-byte-budget`; the cap-sized human golden |
| Declared constants | every new/re-pinned Appendix C constant and `value-clamped` has an inventory assertion and a behaviour/corpus case | TC-QREADY-024 constant inventory + TC-QREADY-028 meta-check over `QUEUE_READY_MAX_IDENTITY_CHARS`, `_REF_CHARS`, `_LABEL_CHARS`, `_LABELS`, `_RELATIONS`, `_OWNER_CHARS`, `_REPO_NAME_CHARS`, `_BRANCH_CHARS`, `_TIMESTAMP_CHARS`, `_HUMAN_SEGMENT_CHARS`, `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`, `QUEUE_READY_PAYLOAD_MARKER_REASONS` |
| Top-level reasons | six-group order, first occurrence, dedup, cap 6 | `reasons-six-group-order`, `reasons-cap-7`, `all-unknown-degraded`, `ready-unknown-association` |
| At-limit/truncation | issues 100, pulls 100, check-runs 20, evidence >2 (synthetic), reasons >6, provider value clamp, byte-budget reduction, derived-detail clamp, `+more` | `source-truncated-issues`, `at-limit-pr-no-match`, `at-limit-pr-no-match-merged`, `not-ready-ci-at-limit-neutral`, `reasons-cap-7`, `detail-clamp`, `provider-over-cap-fields`, `provider-over-cap-byte-budget`, `cap-sized-8`; evidence-cap overflow is the synthetic `bounds/flag-matrix` case in TC-QREADY-035 |
| Truncation flag scope | evidence-cap (synthetic): candidate+payload; reason-cap/source-at-limit/CI at-limit/provider clamp/byte-budget: payload only; derived-detail clamp: none | synthetic `bounds/flag-matrix` evidence-cap case, `reasons-cap-7`, `source-truncated-issues`, `at-limit-pr-no-match`, `not-ready-ci-at-limit-neutral`, `detail-clamp`, `provider-over-cap-fields`, `provider-over-cap-byte-budget` |
| Duplicate/cap | duplicate refs after canonicalization (detected and rejected, never silently merged), 9-ref handler reject, 8-ref cap, 64-char accepted / 65-char rejected, 32 refs (33 positionals) vs 33 refs (34 positionals) parser boundary | `refs/cases.ts` (not corpus); `cap-sized-8` for the 8-ref success; `ref-length-max-64` for the accepted cap; handler/parser cases in TC-QREADY-001/032 |
| Canonical refs | case-insensitive input, no whitespace trimming, uppercase prefix, preserved digits incl. leading zeros, duplicate-after-canonicalization rejected (never silently merged), canonicalize -> length -> duplicate -> read | `refs/cases.ts`, `canonical-leading-zeros`, TC-QREADY-001/032 |
| Deterministic bytes | golden payload + human; no title field; fixed proxy-source suffix on every candidate line | `golden/payload.json`, `golden/human.txt` |
| Appendix G | all 11 rows; class rank is separate from payload `rank` | `ready-new-start`, the six single-unknown/unmet rows, `merge-ready`, `review-pending-not-ready`, `all-unknown-degraded`, `ready-unknown-association` |

### 6.3 Isolation Strategy

- Every synthetic fixture and mutation test uses a fresh `mkdtemp` root; no test writes the live repository tree, `dist/`, the real local PM context, or the user's real state directory. A clean-tree assertion after the suite is part of the aggregate gate.
- Queue-ready suites inject brand, paths, clock, run id, source facts, state store, transport, and streams; they never read `$HOME`, the wall clock, the ambient environment where purity is asserted, or the network.
- The real `origin`/HEAD is read only by the opt-in live smoke; the default suite uses injected repository facts and temp git-shaped dirs.
- Provider park fixtures are built from verified bytes with the real state harness and mutated by a named operation; a detection-disabled control must expose the planted value, proving the fixture is live.
- Corpus and golden fixtures are read-only at test time; corruption/mutation controls run on in-memory values or temp copies, and the unmutated control runs in the same suite.
- The closed constant/vocabulary baselines and the adapter operation/capability sets are read-only; mutations run on deep copies.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except TC-QREADY-031, which is opt-in automated. Locations follow the spec's affected-components table and the repository testing strategy; delivery planning may rename helper files but must preserve each TC's behaviour, states, reasons, bounds, assertions, and AC/NFR mapping.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-QREADY-001 | `tests/behaviour/queue-ready-command.test.ts` + `tests/fixtures/queue-ready/{harness.ts,refs/cases.ts}` | `bun test tests/behaviour/queue-ready-command.test.ts` | 1..8 refs; 64-char accepted; zero/wrong/9..32/malformed/over-length/duplicate; 33 refs (34 positionals)/unknown flag; `--json` placements; zero-read recorder; write-free handler; docs/registry note (no rendered help) | To Implement |
| TC-QREADY-002 | same + `corpus/source-failures-degraded/case.json` | same | degraded fixture; all candidates rendered; containment; parser `fallback.invocation` separation; restored control; Appendix G all-unknown | To Implement |
| TC-QREADY-003 | `tests/behaviour/queue-ready-conditions.test.ts` + `matrix/cases.ts` | `bun test tests/behaviour/queue-ready-conditions.test.ts` | six-id totality; ready equivalence; blocking order; one-record deps/provider two-record evidence; remove/duplicate/rename/ready-true controls | To Implement |
| TC-QREADY-004 | same + matrix | same | one case per Appendix A cell; unobserved-before-signal combined rows; deps state-count details; flip controls; cell/reason meta-check | To Implement |
| TC-QREADY-005 | `tests/behaviour/queue-ready-deps.test.ts` + `deps/cases.ts` | `bun test tests/behaviour/queue-ready-deps.test.ts` | provider-shaped `entityId` "176"/"179"/"180"/"999"; unavailable zero-relation; unobserved (combined precedence); done/canceled; open; unobserved target; out-of-page done; exactly one record + state counts; source declaration control | To Implement |
| TC-QREADY-006 | `tests/behaviour/queue-ready-repo-tier-owner.test.ts` + `repo/cases.ts` + `pm-context/*.yaml` | `bun test tests/behaviour/queue-ready-repo-tier-owner.test.ts` | missing/malformed/wrong-shape (incl. `active_change: null`)/no-active-change (omitted)/candidate/other; proxy details; case-insensitive; notes canary; bytes/mtime | To Implement |
| TC-QREADY-007 | same + `tier/cases.ts` | same | one/medium/low/mixed-case/empty/unrecognized/conflict/duplicate/unobserved/unavailable; `tier:priority-label` details; unobserved precedence | To Implement |
| TC-QREADY-008 | same + `owner/cases.ts` | same | none/one/both/mixed-case/unobserved/unavailable; unobserved precedence; assignee ignored controls | To Implement |
| TC-QREADY-009 | `tests/behaviour/queue-ready-ci.test.ts` + `ci/cases.ts` | `bun test tests/behaviour/queue-ready-ci.test.ts` | succeeded/failed/pending/canceled/none/all-skipped (`ci-none`); 19/20 page; 20-run payload `source-truncated` with unchanged verdict/evidence/blocking; classification controls | To Implement |
| TC-QREADY-010 | same + CI failure cases | same | unresolved SHA; failed read; credential; binding unavailable; unsupported host; exact reason each; binding reason group 1 vs group 5; no error row; restored control; one attempt | To Implement |
| TC-QREADY-011 | `tests/behaviour/queue-ready-provider.test.ts` + `providers/**` + state harness | `bun test tests/behaviour/queue-ready-provider.test.ts` | resolved chain; one unparked; exact two-record pairing; non-matching parks; no engine/quota; scoped `available` scan (condition id exempt); one fold/config read | To Implement |
| TC-QREADY-012 | same + provider fixtures | same | no enabled/all parked/chain park/no chain/unresolved (command-level `ok:false` + defensive `ok:true`)/config-invalid/park-fold; failure mapped by read `reason`; exact case record + companion; park-fold source `provider-parks`; expiry T-1/T/T+1; restored controls | To Implement |
| TC-QREADY-013 | `tests/behaviour/queue-ready-close.test.ts` + `close/cases.ts` | `bun test tests/behaviour/queue-ready-close.test.ts` | 3+ segments; exact segment; case-insensitive; substring/short refs; command-level `pr-not-associated`; evaluator-injected `pr-not-open`; at-limit unknown; `associatedCount`; targetRef ignored | To Implement |
| TC-QREADY-014 | same + close cases | same | Appendix E rows; draft/unknown review/changes-requested; ready+unknown; not-ready+unknown; evaluator-injected merged/closed fallback; controls | To Implement |
| TC-QREADY-015 | same + negative-control cases | same | binding unavailable/PR failed/at-limit no match; ready vs not-ready; command below-limit vs evaluator merged/closed control; no new-start | To Implement |
| TC-QREADY-016 | same + close cases | same | merge-ready set first; numeric-aware entityId; lexical sourceRef; lexical targetRef; raw-entityId final tie; `associatedCount` exact/lower-bound/0; evaluator-injected merged/closed exclusion; reversed orders | To Implement |
| TC-QREADY-017 | `tests/behaviour/queue-ready-ranking.test.ts` + `ranking/cases.ts` | `bun test tests/behaviour/queue-ready-ranking.test.ts` | five classes; numeric `GH-9/10/100`; `GH-007` before `GH-7`; caller/PR permutations; 1..8 ranks; class rank vs payload rank | To Implement |
| TC-QREADY-018 | `tests/behaviour/queue-ready-output.test.ts` + corpus + `assertEnvelopeContract` | `bun test tests/behaviour/queue-ready-output.test.ts` | exact envelope/data keys; schema; closed vocabularies; summary; reasons; nine caps + `entityId`-only identities (no `systemName`) + `blocked-by`-only shape; no title field; no error/native/secret; cap-sized human segment/bounds; missing-field controls | To Implement |
| TC-QREADY-019 | same + `bounds/**` + `caps/**` | same | under/at/cap-sized/over-cap/at-limit; 64-char ref cap; nine provider caps; `value-clamped`; byte-budget reduction; detail clamp sets no flag; no title cap; cap/byte controls | To Implement |
| TC-QREADY-020 | same + `golden/human.txt` + `tests/golden/helpers.ts` | same | summary + per-candidate lines; fixed proxy suffix on every line; 32-char provider segments with trailing `+`; detail forms; close+blocking; `+more`; header; 16/4096 at cap size; title/secret canary; read parity | To Implement |
| TC-QREADY-021 | `tests/behaviour/queue-ready-negative-controls.test.ts` + cases | `bun test tests/behaviour/queue-ready-negative-controls.test.ts` | 22 AC-F14-1 controls; restored controls; scoped all-clear/`available` scan (condition id and payload/summary/close tokens exempt); matrix meta-check with cardinality 22 | To Implement |
| TC-QREADY-022 | `tests/behaviour/queue-ready-readonly-determinism.test.ts` + state harness + verify-support + imports | `bun test tests/behaviour/queue-ready-readonly-determinism.test.ts` | guarded store; GET-only transport; PM bytes/mtime; spawn sentinel; engine/quota stubs; seeded controls | To Implement |
| TC-QREADY-023 | same + `tests/golden/helpers.ts` | same | byte-identical replays; reversed twin; changed-fact control; AST purity scan; stable key order | To Implement |
| TC-QREADY-024 | `tests/structure/queue-ready-contract.test.ts` + `inventory.json` | `bun test tests/structure/queue-ready-contract.test.ts` | constant/vocabulary binding; reason order; source-failure subset; `associatedCount` range; 64-char ref cap; tests-only live literal (no `QUEUE_READY_LIVE_ENV`); no title constant; ref pattern; inventory registration; mutation controls | To Implement |
| TC-QREADY-025 | `tests/structure/queue-ready-imports.test.ts`, `subpaths.test.ts`, `content-inventory.test.ts`, `cli-edge-seam.test.ts` | corresponding `bun test` | contracts data-only; domain purity; sibling `status` `collectStatusFacts` import allowed; adapter operation set; subpaths; inventory; edge composition; seeded violations | To Implement (new suite) + Existing - Update |
| TC-QREADY-026 | `tests/checks/secret-read-boundary.test.ts`, `forbidden-literals.test.ts`, `queue-ready-imports.test.ts` | corresponding `bun test` | allowlist length 4; no queue-ready file; no product literal; brand-derived header (no help surface); live literal test-only and exactly-`1` gated; doc distribution | Existing - Update |
| TC-QREADY-027 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts` | `bun run scripts/checks/error-table-sync.ts`; corresponding `bun test` | no new row/kind; documented sync; only two handler failures; reasons not identities; mutation controls | Existing - Update |
| TC-QREADY-028 | `tests/behaviour/queue-ready-corpus.test.ts` + `corpus/**` | `bun test tests/behaviour/queue-ready-corpus.test.ts` | command corpus verdicts; evaluator-injected rows via pure evaluator; identity/target-resolution and provider-cap/clamp rows; condition/class/source/bound/constant/Appendix G meta-check; zero-live guard; orphan/removal controls | To Implement |
| TC-QREADY-029 | `tests/golden/queue-ready.test.ts` + `golden/{payload.json,human.txt}` | `bun test tests/golden/queue-ready.test.ts` | byte-for-byte payload/human; proxy suffix; 32-char provider segments; capped values + `value-clamped`; no title field; bounds; deliberate regeneration; changed-fact control; stale-golden control | To Implement |
| TC-QREADY-030 | `tests/behaviour/queue-ready-performance.test.ts` + `bounds/cap-sized/**` | `bun test tests/behaviour/queue-ready-performance.test.ts` | warm-up + median <=50 ms; 3 GitHub reads; 1 fold; 1 config; 1 local context; 0 quota/retries; live-control | To Implement |
| TC-QREADY-031 | `tests/behaviour/queue-ready-live.test.ts` | `ADOS_QUEUE_READY_LIVE=1 bun test tests/behaviour/queue-ready-live.test.ts` | skipped unless exactly `1`; structural-only; at least one known candidate observed via §8.3; no volatile counts; no merge-ready on GitHub slice; scoped `available` scan (condition id exempt); ordered reasons; switch token absent; bounds/secrets | To Implement (opt-in) |
| TC-QREADY-032 | `tests/behaviour/queue-ready-command.test.ts` + `refs/cases.ts` | `bun test tests/behaviour/queue-ready-command.test.ts` | uppercase prefix; leading zeros preserved; canonicalize -> length -> duplicate -> read; 64 accepted / 65 rejected; whitespace rejected/not trimmed; numeric-equal distinct; condition independence + candidate-set-scoped identity observation; no discovery; no filter args | To Implement |
| TC-QREADY-033 | same + `tests/golden/helpers.ts` | same | exit 0/1/2; exactly one serialization; no partial output; not-ready exit 0; handler write-free; no exit literals; parser envelope separate | To Implement |
| TC-QREADY-034 | `tests/behaviour/queue-ready-output.test.ts` + `reasons/cases.ts` | `bun test tests/behaviour/queue-ready-output.test.ts` | six-group order; group 2 `source-truncated`→`value-clamped`; group 6 exact `pr-association-unknown`; un-deduplicated and deduplicated cases; first-occurrence dedup; scrambled read/evidence order; cap 6 + payload flag only; verdict reasons excluded; binding reason in group 1; mutation controls | To Implement |
| TC-QREADY-035 | same + `bounds/{under-cap,at-limit,over-cap}/**` + `{reasons,caps}/**` | same | flag matrix per drop/limit/clamp cause; synthetic evidence-cap over-cap input; provider clamp/byte-budget payload-only + `value-clamped`; CI 19/20 verdict-identical; derived-detail clamp inert; byte-budget reduction; `+more` pairing; seeded flag controls | To Implement |
| TC-QREADY-036 | `tests/behaviour/queue-ready-identity.test.ts` + `identity/cases.ts` | `bun test tests/behaviour/queue-ready-identity.test.ts` | provider-shaped `entityId` "176"/"177"/"7"/"0176"/"007"; exact and case-insensitive match; bare-number bridge; wrong number; candidate-set-scoped ambiguous suffix (no precedence/caller order); leading-zero no-coercion; non-digit non-canonical; exact-beats-ambiguity; full-value-before-clamp; multi-candidate condition independence + candidate-set-scoped observation; restored/removed-item controls | To Implement |
| TC-QREADY-037 | same + `identity/cases.ts` + `deps/cases.ts` | same | target resolution "179"/"GH-179"/"999"/"7"/"0179"; observed-set uniqueness; canonical observed target not among requested candidates; done/canceled/open; ambiguous; over-cap target identity matching before projection; state-count detail summing to the total target count; one `tracker` record; flip controls | To Implement |
| TC-QREADY-038 | `tests/behaviour/queue-ready-output.test.ts` + `caps/over-long/**` + `identity/cases.ts` | `bun test tests/behaviour/queue-ready-output.test.ts` | nine caps through `runCli`; `entityId`-only identities (no `systemName`, over-long-`systemName` fixture); output-only equality vs no-caps oracle; `value-clamped` once in group 2; `blocked-by`-only; deterministic relations-then-labels drop; both byte bounds; 32-char human segments; mutation controls | To Implement |

**Execution order.**

1. Structure, constants, and error-table baselines: TC-QREADY-024, TC-QREADY-025, TC-QREADY-026, TC-QREADY-027.
2. Command surface, candidate set, and edge: TC-QREADY-001, TC-QREADY-032, TC-QREADY-033, TC-QREADY-002.
3. Condition totality and matrix: TC-QREADY-003, TC-QREADY-004.
4. Condition predicates: TC-QREADY-005, TC-QREADY-036, TC-QREADY-037, TC-QREADY-006, TC-QREADY-007, TC-QREADY-008, TC-QREADY-009, TC-QREADY-010.
5. Provider: TC-QREADY-011, TC-QREADY-012.
6. Close classification and selection: TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-016.
7. Ranking: TC-QREADY-017.
8. Output, bounds, caps, reasons, truncation, negative controls, read-only, determinism: TC-QREADY-018, TC-QREADY-019, TC-QREADY-020, TC-QREADY-021, TC-QREADY-022, TC-QREADY-023, TC-QREADY-034, TC-QREADY-035, TC-QREADY-038.
9. Corpus, golden, performance: TC-QREADY-028, TC-QREADY-029, TC-QREADY-030.
10. Opt-in live and aggregate: TC-QREADY-031; `pnpm check`; `git diff --check`; `git status --porcelain`.

**Wiring.** The new behaviour suites are discovered by root `bun test`; no new CI job topology is introduced. The new structure suite is discovered by `bun test tests/structure`. The error-table sync check stays in the existing `ts-invariants` wiring. The boundary rules and the secret-read/forbidden-literal checks extend to the new modules automatically; no rule is added or weakened. The opt-in live smoke is intentionally outside `pnpm check` and default CI. Documentation reconciliation gates run in phase 7: `git diff --check`, YAML parse for changed `.yaml` files, markdown/link review, the error-table sync check for the unchanged result-contract table, forbidden-literal registration for the new current-truth feature doc, and `bash scripts/.tests/test-doc-distribution.sh` for any changed redistributable guide/template and the new internal feature doc.

**Evidence commands** (run and record in the change/PR; never record unrun results as passing):

```
pnpm install --frozen-lockfile
bun test tests/structure/queue-ready-contract.test.ts
bun test tests/structure/queue-ready-imports.test.ts
bun test tests/structure/subpaths.test.ts
bun test tests/structure/content-inventory.test.ts
bun test tests/structure/cli-edge-seam.test.ts
bun test tests/structure/error-table.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/secret-read-boundary.test.ts
bun test tests/checks/forbidden-literals.test.ts
bun test tests/behaviour/queue-ready-command.test.ts
bun test tests/behaviour/queue-ready-conditions.test.ts
bun test tests/behaviour/queue-ready-deps.test.ts
bun test tests/behaviour/queue-ready-identity.test.ts
bun test tests/behaviour/queue-ready-repo-tier-owner.test.ts
bun test tests/behaviour/queue-ready-ci.test.ts
bun test tests/behaviour/queue-ready-provider.test.ts
bun test tests/behaviour/queue-ready-close.test.ts
bun test tests/behaviour/queue-ready-ranking.test.ts
bun test tests/behaviour/queue-ready-output.test.ts
bun test tests/behaviour/queue-ready-negative-controls.test.ts
bun test tests/behaviour/queue-ready-readonly-determinism.test.ts
bun test tests/behaviour/queue-ready-corpus.test.ts
bun test tests/golden/queue-ready.test.ts
bun test tests/behaviour/queue-ready-performance.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/exit-code-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
pnpm check
bash scripts/.tests/test-doc-distribution.sh
git diff --check
git status --porcelain
ADOS_QUEUE_READY_LIVE=1 bun test tests/behaviour/queue-ready-live.test.ts   # opt-in, credentialed, not default CI
```

**Open-PR DoD evidence checklist.** All **23 AC criteria** have a passing traceable TC (**38 TCs total**) and all 11 NFRs are measured; the six conditions and three states are total with one bounded evidence record per non-provider condition and the ordered two-record `provider-available` pairing; `ready` is exactly all-six-satisfied and every blocking condition is named in fixed order; the Appendix A matrix and the 22-control negative matrix are exhaustive and non-vacuous with restored controls, each control being asserted on its targeted source (the PR-read-failure and at-limit-no-match controls are ready with unknown close, and no global "no control is ready" claim is made); candidate observation and `blocked-by` target resolution follow the §8.3 identity rule over full values (GitHub-shaped `"176"` observes `GH-176`, wrong/ambiguous/leading-zero cases stay unobserved with a shared suffix leaving the item unobserved for every sharing candidate and no precedence or caller order, no numeric coercion; `blocked-by` targets resolve against the observed work-item set, including a canonical observed target that is not a requested candidate); deps unavailable/unobserved stays unknown, an unobserved candidate wins before any signal check, and the state-count detail sums to the total `blocked-by` relation target count (observed + unobserved); repo-free never treats a missing context as free and observed states carry `repo:local-context`; tier requires exactly one priority label and carries `tier:priority-label`; owner gate uses only the two labels; CI only `succeeded` is green and every `unknown` mode carries its pinned reason (binding reasons in group 1); provider availability never calls the engine, no provider evidence record or availability claim uses `available` (the pinned condition id, condition-id list, `blocking:` lines, payload keys, summary tokens, and close classes are exempt and every scan is scoped to provider evidence/details and the provider human-text segment), every config failure is mapped by the read's own `reason` (`config-invalid` vs `provider-chain-unresolved`), always carries the ordered two-record pairing, and a park-fold failure uses `provider-parks`; close association is command-level open-only with observed-approval-only merge-ready, the explicit unknown class, `pr-not-associated` at command level and evaluator-only `pr-not-open` for injected merged/closed-only views, and an `associatedCount` in `0..100`; ranking puts close items above ready starts with numeric-aware ties and `GH-007` before `GH-7`; top-level `reasons` follow the six-group order with group 2 = `source-truncated` then `value-clamped` and group 6 = exactly `pr-association-unknown` and last (`read-failed`/`credential-unavailable` group-5 only), first-occurrence dedup, and cap-6 overflow; the truncation flag scope is exact (evidence-cap synthetic: candidate+payload; reason-cap/source-at-limit/CI at-limit/provider clamp/byte-budget: payload only; derived-detail clamp: none) and the 64 KiB/16-line/4096-byte bounds are met at cap size; the nine provider-derived caps are output-only with one `value-clamped`, every projected provider-qualified identity is `entityId`-only with no `systemName` (an over-long `systemName` never enters the payload), the `blocked-by`-only projection, and the deterministic relations-then-labels byte-budget reduction leaving every verdict unchanged; refs are canonicalized with preserved leading zeros, validated canonicalize -> length -> duplicate -> read, capped at 64 characters, and canonical duplicates rejected, never silently merged; every candidate line carries the fixed `[repo:local-context; tier:priority-label]` suffix and <=32-character provider segments with a trailing `+`, and the payload carries no title field; zero writes/fences/mutations/network-writes/spawns/engine calls and byte-identical replays; no new error row/kind, config key, state schema, package, subpath, runtime-API location, or secret-read entry; the fixture corpus and golden snapshot are deterministic with zero live calls; the live smoke is opt-in, test-harness-literal exactly-`1` gated, and structural (including at least one known candidate observed); the new feature doc and reconciled docs are registered; a minor changeset is recorded; an open unmerged PR targets `main-tools`. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

**Specification risk coverage (RSK-1..RSK-14).** Every spec risk is exercised by at least one TC; the mapping is the forward trace from the spec.

| Spec risk | Mitigating TC(s) |
|-----------|------------------|
| RSK-1 — unknown/unsatisfied read as ready/nothing blocks | TC-QREADY-003, TC-QREADY-004, TC-QREADY-020, TC-QREADY-021 |
| RSK-2 — close item missed, candidate reported as new start | TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, TC-QREADY-016, TC-QREADY-021 |
| RSK-3 — merge-ready fabricated from unavailable review or draft | TC-QREADY-014, TC-QREADY-016, TC-QREADY-021 |
| RSK-4 — deps satisfied from absent relations/unobserved target | TC-QREADY-005, TC-QREADY-021 |
| RSK-5 — untriaged/conflicting tier started under invented tier | TC-QREADY-007, TC-QREADY-021 |
| RSK-6 — provider availability claimed engine-verified | TC-QREADY-011, TC-QREADY-012, TC-QREADY-021 |
| RSK-7 — no-run/pending/failed-read CI treated as healthy | TC-QREADY-009, TC-QREADY-010, TC-QREADY-021, TC-QREADY-035 |
| RSK-8 — output unbounded or API-order dependent | TC-QREADY-017, TC-QREADY-018, TC-QREADY-019, TC-QREADY-020, TC-QREADY-034, TC-QREADY-035 |
| RSK-9 — scope creep into queue engine/closed-issue reads/GraphQL | §1.2 non-goals; TC-QREADY-025, TC-QREADY-030 |
| RSK-10 — credential/payload/PM-notes leak | TC-QREADY-006, TC-QREADY-018, TC-QREADY-020, TC-QREADY-026 |
| RSK-11 — docs drift from delivered behavior | TC-QREADY-024, TC-QREADY-026, TC-QREADY-027; phase-7 doc checks |
| RSK-12 — absent PM context in CI makes every candidate not-ready | TC-QREADY-006, TC-QREADY-021; documented environment fact |
| RSK-13 — no candidate observed on the live slice because the canonical ref never equals the provider-native `entityId` | TC-QREADY-036, TC-QREADY-037, TC-QREADY-031 (structural live observation) |
| RSK-14 — a projection clamp silently changes a verdict, hides a distinguishing provider value, or pushes the payload past its byte cap | TC-QREADY-019, TC-QREADY-020, TC-QREADY-029, TC-QREADY-035, TC-QREADY-038 |

**Testing risks.**

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | A negative fixture is inert, so a false ready/all-clear passes | H | M | Every negative/matrix/corpus case asserts the exact state/reason/counts/details and has a restored control (§4.2) |
| RSK-T2 | A "not ready" assertion is vacuous because the run failed elsewhere | H | M | One oracle per case asserts six states + evidence + ready + class + rank + summary + truncation, plus a restored control |
| RSK-T3 | Unknown association is collapsed into not-associated or new-start, or a merged/closed-only page is misclassified | H | M | TC-QREADY-015 pairs binding-unavailable/failed-read/at-limit cases with a below-limit control; TC-QREADY-013 flips 100->99 and merged-only->open; TC-QREADY-016 asserts `pr-not-open` and the open-only count |
| RSK-T4 | A cap/truncation case is asserted by sampling and misses a flag-scope rule | M | M | TC-QREADY-035 asserts the exact candidate/payload flag pair per drop cause with under-cap controls; TC-QREADY-019 asserts the 64 KiB hard bound |
| RSK-T5 | Read-only proof is vacuous because a seam never fires | H | L | Every recorder/stub is proven live by a seeded deliberate call; a recorder that never observes a read fails (TC-QREADY-022) |
| RSK-T6 | Provider park fixtures do not exercise the real verified fold | H | M | Park views are built from verified bytes with the state harness; a detection-disabled control exposes the planted value (TC-QREADY-011/012) |
| RSK-T7 | The live smoke becomes flaky or pins volatile counts | M | M | Live assertions are structural only; no counts pinned; the suite is opt-in and outside `pnpm check` (TC-QREADY-031) |
| RSK-T8 | The 50 ms performance assertion is flaky on slow CI | M | M | Measure the pure evaluator only, warm up, take a median, and record the environment; the spec bound is not silently relaxed (TC-QREADY-030) |
| RSK-T9 | A fixture corpus grows without a completeness check | M | M | TC-QREADY-028 meta-checks every condition state, close class, source failure, bound, and Appendix G row; orphan/removal controls fail |
| RSK-T10 | Constants/vocabularies drift from Appendix C/DM-10 | M | L | TC-QREADY-024 binds every constant and closed set and mutation-controls each; the phase-7 doc is reconciled separately |
| RSK-T11 | Top-level `reasons` drift into first-seen or read order, or a verdict reason leaks in | H | M | TC-QREADY-034 asserts the six-group order with scrambled read/evidence twins, first-occurrence dedup, cap overflow, and a verdict-reason exclusion list |
| RSK-T12 | A truncation flag is set on the wrong surface (candidate vs payload) or the CI at-limit marker changes the verdict | H | M | TC-QREADY-035 asserts the flag matrix per cause and compares the 19-run and 20-run payloads field by field for the CI condition |
| RSK-T13 | Identity fixtures use GH-shaped observed ids, so the live GitHub slice silently observes no candidate and the suite passes | H | M | TC-QREADY-036/037 inject only provider-shaped `entityId` values (`"176"`, `"179"`, `"7"`, `"0176"`) and assert wrong/ambiguous/leading-zero cases stay unobserved; §4.2 forbids a GH-shaped observed id outside the explicit exact rows; TC-QREADY-031 asserts a known candidate is observed live |
| RSK-T14 | A provider cap is asserted by sampling, so a clamp changes a verdict or the byte budget is exceeded at cap size | M | M | TC-QREADY-038 compares every verdict field against a no-caps oracle, asserts each cap end-to-end through `runCli`, and exercises the deterministic relations-then-labels drop; TC-QREADY-029 pins the cap-sized golden bytes |

### 8.2 Assumptions

- **A-T1 — Spec binding.** The spec is the single source of truth for condition ids/order, states, close classes, reasons, sources, bounds, schema version, and non-verdict semantics. Delivery planning may choose helper/file names but may not rebind a pinned value.
- **A-T2 — In-process harness.** Every queue-ready behaviour test uses `runCli` with injected dependencies and source readers; no queue-ready suite spawns a child process or reads the ambient environment/network in default CI.
- **A-T3 — Plan mapping (resolved).** `chg-GH-176-plan.md` v1.5 (aligned to spec v1.6) maps all 38 TCs (TC-QREADY-001..038), all 23 ACs, and all 11 NFRs onto its phases and adopts the delivery-side provider-failure-by-reason rule (DoR iter-2 R-23 / RES-8), without reshaping any TC behaviour, state, reason, bound, or AC/NFR mapping; OQ-T11 is closed. Any later plan or implementation that alters a TC's behaviour, state, reason, or AC/NFR mapping reopens this test plan.
- **A-T4 — Delivery-bound spellings.** Contract export names, runtime type names, helper names, human line labels, and header wording are delivery-bound. The six condition ids/order, tri-state vocabulary, close classes, reasons and their top-level order, sources, caps, flag-scope rules, schema version, ref-length bound, and the fixed proxy-source suffix are pinned; the payload carries no title field, so no title string is part of the contract.
- **A-T5 — Reasons order (resolved).** GAP-2 is closed by spec v1.1: the top-level `reasons` follows `QUEUE_READY_REASON_ORDER`, first occurrence wins, cap 6, overflow sets payload `truncated` only. Asserted by TC-QREADY-002, TC-QREADY-018, TC-QREADY-021, TC-QREADY-024, and TC-QREADY-034.
- **A-T6 — Provider evidence pairing (resolved).** GAP-3 is closed by spec v1.1: every `provider-available` condition carries exactly two records, the case record first then `{ source: "provider-config", reason: "engine-not-run" }`; `engine-not-run` is never a detail. Asserted by TC-QREADY-003, TC-QREADY-011, TC-QREADY-012, and TC-QREADY-024.
- **A-T7 — `associatedCount` (resolved).** GAP-4 is closed by spec v1.1: `0..100`, open matches only, exact below the limit, page-bounded at it, 0 on failed read/unavailable binding, not separately capped. Asserted by TC-QREADY-013, TC-QREADY-015, TC-QREADY-016, and TC-QREADY-018.
- **A-T8 — `pr-not-open` (resolved; re-scoped by spec v1.2 R-04).** GAP-5 is closed: the command-level open-only read never emits `pr-not-open`; an evaluator-injected view emits it only below the limit when at least one matching merged/closed object and no open match exist, and the at-limit rule wins with `pr-association-unknown`. Asserted by TC-QREADY-013, TC-QREADY-014, TC-QREADY-015, and TC-QREADY-016.
- **A-T9 — Truncation and clamp flags.** GAP-6 is closed: evidence-cap overflow sets candidate + payload (synthetic; deps is single-record and provider is the only reachable two-record case); reason-cap, source-at-limit, provider value clamp, and byte-budget reduction set payload only; derived-detail clamping sets neither and adds no `value-clamped`; 64 KiB is guaranteed by the deterministic reduction. Asserted by TC-QREADY-019, TC-QREADY-035, and TC-QREADY-038.
- **A-T10 — CI at-limit (resolved).** GAP-7 is closed by spec v1.1: a raw 20-run page adds payload-level `source-truncated` + payload `truncated` only and leaves the CI verdict/state/evidence/blocking unchanged. Asserted by TC-QREADY-009 and TC-QREADY-035.
- **A-T11 — Live switch (resolved; corrected by spec v1.2 R-01).** GAP-8 is closed: the literal `ADOS_QUEUE_READY_LIVE` is bound only in `tests/fixtures/queue-ready/harness.ts`, tests-only, enabled only when exactly `1`, never a production/contract constant (`QUEUE_READY_LIVE_ENV` is not declared), and absent from production/config/payload/human text. Asserted by TC-QREADY-024, TC-QREADY-026, and TC-QREADY-031.
- **A-T12 — CI `unknown` reasons (resolved).** GAP-9 is closed: `commit-unresolved`, `addressing-unresolved`/`remote-unsupported` (group 1), `credential-unavailable` (group 5), or `read-failed` with a bounded existing code/class. Asserted by TC-QREADY-004 and TC-QREADY-010.
- **A-T13 — Canonical refs (resolved; extended by spec v1.2 R-02).** GAP-10 is closed: case-insensitive input, no whitespace trimming, uppercase ASCII prefix, digits preserved including leading zeros, validation order canonicalize -> length (<=64) -> duplicate -> read, 64-char accepted and 65+ rejected, duplicates rejected after canonicalization. Asserted by TC-QREADY-001, TC-QREADY-024, and TC-QREADY-032.
- **A-T15 — DoR iteration-1 reconciliation (resolved).** The spec v1.2 corrections R-01/R-02/R-04/R-06/R-07/R-10/R-16/R-18/R-19 and the test-plan findings R-03/R-05/R-08/R-09/R-11/R-12/R-13/R-14/R-20 are applied here; no AC/NFR coverage or TC identity changed.
- **A-T16 — Identity resolution (resolved; spec v1.3 R-22, requalified by spec v1.4 R-31/R-33).** GAP-11 is closed: candidate observation and `blocked-by` target resolution use exact full-value canonical equality first, then a unique all-ASCII-digit bridge, with no prefix/substring/numeric coercion and no ambiguity precedence; the uniqueness domain is role-specific — the requested candidate set for candidate observation (a shared suffix leaves the item unobserved for every sharing candidate, no precedence or caller order) and the observed work-item set for `blocked-by` targets (including a canonical observed target that is not a requested candidate); matching runs before any output clamp. Asserted by TC-QREADY-036, TC-QREADY-037, TC-QREADY-005, and the structural live check.
- **A-T17 — Provider-derived caps (resolved; spec v1.3 R-24/R-29, extended by spec v1.4 R-34).** GAP-12 is closed: nine output-only caps, every projected provider-qualified identity `entityId`-only with `systemName` omitted (the whole identity object bounded by the identity cap), `value-clamped` in group 2, `blocked-by`-only relation projection, and the deterministic relations-then-labels byte-budget reduction; a clamp never changes a verdict. Asserted by TC-QREADY-019, TC-QREADY-020, TC-QREADY-024, TC-QREADY-029, TC-QREADY-035, and TC-QREADY-038.
- **A-T18 — DoR iteration-2 reconciliation (resolved).** The spec v1.3 corrections R-21/R-22/R-24/R-26/R-29 and the test-plan finding R-25 are applied here; the plan-side R-23 is mirrored in the fixtures and adopted by `chg-GH-176-plan.md` v1.5 (RES-8). No AC/NFR coverage or existing TC identity was removed; TC-QREADY-036..038 were added.
- **A-T19 — DoR iteration-3 reconciliation (resolved).** Spec v1.4 R-30..R-36 are applied here as provenance/wording corrections plus fixture assertions: provider config failure by the read's `reason` with corrected GAP-14 provenance; candidate-set-scoped identity observation alongside per-candidate condition independence; total `blocked-by` target count in the deps detail; observed-set target uniqueness plus the canonical-observed-but-unrequested target; `entityId`-only projected identities with no `systemName` (no tenth cap) and an over-long `systemName` fixture; duplicate refs rejected, never silently merged; and the 41-byte proxy suffix (no 43-byte figure exists in this plan). Counts, condition ids/order, rank order, states, reasons, bounds, and existing expected verdicts are unchanged.
- **A-T20 — DoR iteration-4 reconciliation (resolved).** Spec v1.5 R-40/R-41 are spec-only wording pins; R-42 pins the provider config/park failure-identity detail form. This plan applies R-42 to AC-F9-1, TC-QREADY-012, the `not-ready-provider-*` corpus rows, and the TC-QREADY-028 meta-check. R-37 scopes the AC-F14-1/TC-QREADY-021 negative-control assertion per control: a targeted readiness source is not satisfied and a non-satisfied readiness condition is not ready, while a close-only control (PR-read-failure, at-limit no-match) may be ready with `closeClass: unknown`; there is no global "no control is ready" claim. R-38 points the corpus meta-check at the actual `not-ready-provider-unresolved` row and `unresolved-chain-command` fixture. Counts, condition ids/order, rank order, states, reasons, bounds, and existing expected verdicts are unchanged.
- **A-T21 — DoR iteration-5 reconciliation (resolved).** Spec v1.6 R-44/R-45/R-48/R-49 are applied. R-44 is verified present: AC-F9-1 pins `detail:"chain:<name>"` on `no-enabled-entry` and `all-entries-parked`, matching F-9/DM-4/Appendix D. R-45 is applied to TC-QREADY-016, its Scenario Index row, the §1.1 close bullet, and the AC-F10-1 coverage row: selection is within one close class (merge-ready set when non-empty, otherwise the associated set), then `entityId` ascending numeric-aware (equal all-digit values tie), then `sourceRef`, then `targetRef`, then the lexically smaller raw `entityId`, independent of API order. R-49 is verified present: AC-F2-1 pins exactly one evidence record for each non-provider condition and exactly two for `provider-available`. R-48 (input-grammar versus observed-identity separation) is spec-only here and changes no assertion. R-46 completes the Scenario Index and AC-F9-1 reverse links (TC-QREADY-020 -> AC-F12-2; TC-QREADY-031 -> AC-F2-3/AC-F9-1; AC-F9-1 -> TC-QREADY-031). R-47 updates the plan/spec references (plan v1.5, spec v1.6) and the fixture directory map (`unresolved-chain-command`). Counts, condition ids/order, rank order, states, reasons, bounds, and all other expected verdicts are unchanged; the gap/question register stays closed.
- **A-T14 — Corpus preconditions.** The committed fixture corpus is the deterministic oracle for default CI; a corpus change is a deliberate test-plan event, not a silent update.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Does an implementation plan need to exist before delivery, and does it map every TC without reshaping them? | GAP-1. | Resolved by `chg-GH-176-plan.md` v1.5, which maps all 38 TCs / 23 ACs / 11 NFRs; OQ-T11 closed | — |
| OQ-T2 | Is the top-level `reasons` order contractual, and if so what is it? | GAP-2, DM-1/DM-11. | Resolved by spec v1.1 and re-pinned by v1.3 (`QUEUE_READY_REASON_ORDER`, group 2 = `source-truncated`→`value-clamped`, group 6 exact); asserted by TC-QREADY-034/035 | — |
| OQ-T3 | Is `engine-not-run` a second evidence record or a detail, and which source carries it? | GAP-3, DM-3/DM-4/Appendix D. | Resolved by spec v1.1 (second `provider-config` record, never a detail); asserted by TC-QREADY-011/012 | — |
| OQ-T4 | What is the numeric bound for `associatedCount`? | GAP-4, DM-6/DM-11/Appendix C. | Resolved by spec v1.1 (`0..100`, open matches only); asserted by TC-QREADY-016 | — |
| OQ-T5 | When is `pr-not-open` emitted? | GAP-5, DM-10/F-10/Appendix D. | Resolved by spec v1.2 R-04: never at command level (open-only); evaluator-injected below-limit merged/closed-only only; at-limit rule wins; asserted by TC-QREADY-013/014/016 | — |
| OQ-T6 | Does an evidence-cap overflow set the candidate flag, the payload flag, or both? | GAP-6, DM-11. | Resolved by spec v1.1 (both for evidence-cap; payload only for reason-cap/source-at-limit; neither for clamp); asserted by TC-QREADY-035 | — |
| OQ-T7 | Does a raw 20-run check-runs page signal source truncation? | GAP-7, DM-11/§8.4. | Resolved by spec v1.1 (payload-level `source-truncated` + payload flag only, verdict unchanged); asserted by TC-QREADY-009/035 | — |
| OQ-T8 | Is `ADOS_QUEUE_READY_LIVE` the accepted test-only switch, and will a production edge exist? | GAP-8, F-17. | Resolved by spec v1.2 R-01: test-harness literal bound only in `tests/fixtures/queue-ready/harness.ts`, exactly `1`, no production/contract constant or edge; asserted by TC-QREADY-024/026/031 | — |
| OQ-T9 | What exact reason does an unattempted CI read carry? | GAP-9, F-8/F-14/DM-10. | Resolved: `addressing-unresolved`/`remote-unsupported` (group 1) for binding, `credential-unavailable` (group 5) for no credential; asserted by TC-QREADY-010 | — |
| OQ-T10 | Is uppercase-prefix canonicalization the final ref spelling? | GAP-10, F-2/DM-2. | Resolved by spec v1.1 (case-insensitive input, no whitespace trim, uppercase prefix, digits incl. leading zeros preserved, duplicate-after-canonicalization rejected); asserted by TC-QREADY-032 | — |
| OQ-T11 | Will the implementation plan map the three new TCs and adopt the provider-failure-by-reason rule? | GAP-1, DoR iter-2 R-23/R-24. | Resolved by `chg-GH-176-plan.md` v1.5: it maps TC-QREADY-036/037 to task 3.2 and TC-QREADY-038 to task 5.3 inside the 38-TC / 23-AC / 11-NFR coverage, and adopts the failure-by-reason rule as RES-8 (`provider-chain-unresolved` vs `config-invalid` from the read's own reason; park fold stays `provider-parks`/`state-unreadable`) with the command-level `{ok:false, reason:"provider-chain-unresolved"}` fixture. No TC, AC, NFR, or assertion was reshaped | — |
| OQ-T12 | Do the nine provider caps and the 32-character human segment ever change a verdict? | GAP-12, DEC-19, RSK-14. | Resolved by TC-QREADY-038's no-caps oracle equality and TC-QREADY-029's cap-sized golden; the caps are output-only | — |

**No open gap or open question remains.** GAP-1/A-T3/OQ-T1/OQ-T11 are closed by `chg-GH-176-plan.md` v1.5, which maps all 38 TCs (TC-QREADY-001..038), all 23 ACs, and all 11 NFRs and adopts R-23 as RES-8; the test-plan fixtures and assertions are mapped without reshaping, the spec v1.4 R-30..R-36 alignment adds no open item, the spec v1.5 R-40/R-41/R-42 plus DoR iteration-4 R-37/R-38 alignment adds no open item, and the spec v1.6 R-44/R-45/R-48/R-49 plus DoR iteration-5 R-46/R-47 alignment adds no open item, so the register holds no open gap or question.

**Resolved by spec v1.1/v1.2/v1.3/v1.4/v1.5/v1.6 and plan v1.5 (GAP-1..GAP-14), no coverage weakened:**

1. **Top-level reasons order** — GAP-2/A-T5/OQ-T2; six groups, first occurrence, cap 6, payload-only overflow.
2. **Provider evidence pairing** — GAP-3/A-T6/OQ-T3; exact two-record case-then-companion pairing.
3. **`associatedCount` semantics** — GAP-4/A-T7/OQ-T4; `0..100`, open matches, exact/lower-bound/0 rules.
4. **`pr-not-open` trigger** — GAP-5/A-T8/OQ-T5; never at command level (open-only, `pr-not-associated`); evaluator-injected below-limit merged/closed-only with not-associated fallback; at-limit rule wins.
5. **Truncation flag scope** — GAP-6/A-T9/OQ-T6; candidate+payload for the synthetic evidence-cap override, payload-only for the other drops, none for detail clamp; no title cap.
6. **Check-runs at-limit** — GAP-7/A-T10/OQ-T7; payload-only marker, verdict unchanged.
7. **Live switch literal** — GAP-8/A-T11/OQ-T8; `ADOS_QUEUE_READY_LIVE`, bound only in the test harness, exactly `1`, no `QUEUE_READY_LIVE_ENV` constant.
8. **CI `unknown` reasons** — GAP-9/A-T12/OQ-T9; one reason per mode with a bounded existing code/class; binding reasons in group 1, credential/read-failed in group 5.
9. **Canonical ref emission** — GAP-10/A-T13/OQ-T10; uppercase prefix, digits incl. leading zeros preserved, 64-char cap with 65+ rejected, validation order canonicalize -> length -> duplicate -> read, canonical duplicates rejected.
10. **Candidate/target identity resolution** — GAP-11/A-T16/OQ-T12; exact canonical first, unique digit-only bridge, no ambiguity precedence or numeric coercion, full value before clamp; asserted by TC-QREADY-036/037.
11. **Provider-derived output caps** — GAP-12/A-T17/OQ-T12; nine caps, `value-clamped` in group 2, `blocked-by`-only projection, deterministic relations-then-labels byte-budget reduction, verdict-neutral; asserted by TC-QREADY-038 and the cap-sized golden.
12. **Scoped `available` claim rule** — GAP-13; no provider evidence/availability claim uses it, the pinned condition id and vocabulary tokens are exempt, scans are scoped; asserted by TC-QREADY-011/012/021/031.
13. **Provider config failure by reason and exact group-6 membership** — GAP-14; `config-invalid` vs `provider-chain-unresolved` mapped from the read's `reason`, group 6 exactly `pr-association-unknown`, failure tokens group-5 only; asserted by TC-QREADY-012/028/034.
14. **Plan mapping and provider-failure-by-reason adoption** — GAP-1/A-T3/OQ-T1/OQ-T11; `chg-GH-176-plan.md` v1.5 maps TC-QREADY-036/037 to task 3.2 and TC-QREADY-038 to task 5.3 inside all 38 TCs / 23 ACs / 11 NFRs and adopts RES-8; no TC, AC, NFR, or assertion changed.
15. **DoR iteration-3 pins** — A-T19; R-30 corrects GAP-14's provenance to spec v1.4 while the read-reason mapping stays in TC-QREADY-012 and the `not-ready-provider-unresolved` corpus row; R-31/R-33 scope identity observation and target uniqueness correctly; R-32 fixes the deps count wording; R-34 makes projected identities `entityId`-only; R-35 states duplicate rejection; R-36 has no 43-byte figure here. Asserted by TC-QREADY-001/004/005/012/018/032/036/037/038 and the corpus/meta-check rows.
16. **DoR iteration-4 pins and spec v1.5 alignment** — A-T20; R-37 scopes AC-F14-1/TC-QREADY-021 per control (targeted source not satisfied, non-satisfied readiness condition not ready, close-only controls may be ready with `unknown` close) and removes the global "no control is ready" claim; R-38 points the meta-check at `not-ready-provider-unresolved`/`unresolved-chain-command`; R-42 pins the provider config/park failure-identity detail form and adds a free-form-detail negative check. Asserted by TC-QREADY-012/021/028 and the corpus/meta-check rows.
17. **DoR iteration-5 pins and spec v1.6 alignment** — A-T21; R-44 and R-49 are verified present in AC-F9-1 and AC-F2-1; R-45 pins the same-class associated-PR tie-break (`entityId` numeric-aware, `sourceRef`, `targetRef`, raw `entityId`, API-order-independent) in TC-QREADY-016 and its index/coverage rows with added `targetRef` and raw-`entityId` cases; R-46 completes the index/forward-row links; R-47 updates the plan/spec references and the fixture map. R-48 is spec-only here. Asserted by TC-QREADY-016/020/031 and the AC-F9-1/AC-F10-1 rows; no other expected verdict changed.

**DoR iteration-1, iteration-2, iteration-3, iteration-4, and iteration-5 test-plan corrections (R-03, R-05, R-08, R-09, R-11, R-12, R-13, R-14, R-20; R-25 plus the R-22/R-24 test additions; R-30..R-36 alignment; R-37, R-38, and R-42 alignment; R-44/R-45/R-46/R-47/R-48/R-49 alignment) are folded into the assertions above; no item remains open (OQ-T11 is closed by plan v1.5).**

No AC and no NFR is left without a TC.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T20:10:00Z | Change Test Plan Writer | Initial plan: 33 TCs (TC-QREADY-001..033). All 20 AC criteria (AC-F1-1..AC-F17-1 across 17 capabilities), all 11 NFRs, all 13 DMs, and all 12 spec risks mapped; grammar 1..8 refs with pre-read rejection and parser fallback; six-condition totality and the Appendix A matrix; deps unavailable/unobserved semantics; repo-free from the PM context; tier exactly one priority label; owner gate from the two declared labels; CI only `succeeded`; provider from chain + verified parks with no engine call and no `available`; branch-convention close association, observed-approval-only merge-ready, and the explicit unknown class; deterministic ranking with numeric-aware ties; the bounded payload and human digest; the exhaustive 20-control negative matrix; zero writes/fences/mutations/network-writes/spawns/engine calls; byte-identical replay; boundaries/tier/branding/secret-read gates; error-table stability; committed corpus + golden + opt-in structural live smoke; performance/read-cost bounds. Ten recorded gaps (implementation plan absent, top-level reasons order, provider evidence pairing, `associatedCount` bound, `pr-not-open` trigger, evidence-cap truncation flags, check-runs at-limit, live switch literal, unattempted CI reason, canonical ref emission) with chosen readings and open questions; no coverage silently weakened. |
| 1.1 | 2026-10-31T22:05:00Z | Change Test Plan Writer | Rebased on spec v1.1 and closed GAP-2..GAP-10; GAP-1 (implementation plan absent) is the only remaining gap. Pinned assertions added: six-group top-level `reasons` order with first-occurrence dedup, cap-6 overflow, and verdict-reason exclusion (TC-QREADY-002, 018, 021, 024, 034); exact ordered two-record `provider-available` evidence with the `engine-not-run` companion (TC-QREADY-003, 011, 012, 024); `associatedCount` `0..100` open-match semantics with exact/lower-bound/0 rules (TC-QREADY-013, 015, 016, 018); `pr-not-open` for below-limit merged/closed-only pages and the at-limit `pr-association-unknown` override (TC-QREADY-013, 014, 015, 016); the candidate-vs-payload truncation flag split and the CI at-limit payload-only marker (TC-QREADY-009, 019, 035); each CI `unknown` reason (TC-QREADY-004, 010); canonical refs with preserved leading zeros, no whitespace trimming, and duplicate-after-canonicalization rejection (TC-QREADY-001, 024, 032); the exactly-`1` `ADOS_QUEUE_READY_LIVE` gate (TC-QREADY-026, 031). Added TC-QREADY-034 (top-level reasons) and TC-QREADY-035 (truncation flag scope); 35 TCs total (TC-QREADY-001..035). Corpus table and completeness meta-check extended with reasons-order, provider-pairing, associated-count, merged/closed-only, CI at-limit, each CI unknown reason, truncation-flag, and canonical-ref dimensions. All 20 AC criteria and all 11 NFRs remain covered; every affected given/when/then now asserts the spec v1.1 pin instead of the former delivery-bound hedge. |
| 1.2 | 2026-10-31T23:58:00Z | Change Test Plan Writer | PM-NOTE-1 correction against spec v1.1 and `chg-GH-176-plan.md` (2026-10-31T23:55:00Z): the `all-unknown-degraded` corpus row and the TC-QREADY-002 fixture precondition no longer claim a remote `read-failed`. With the repository binding unavailable no remote read is attempted, so the descriptive evidence is the binding reason (`addressing-unresolved`/`remote-unsupported`) plus `work-item-unobserved` on the tracker-derived conditions, with `config-invalid` and `state-unreadable` in top-level `reasons`; `read-failed` remains only for attempted reads that fail. GAP-1 is marked resolved by the implementation plan. No TC id, assertion outcome, condition state, close class, reason vocabulary, bound, or AC/NFR coverage mapping changed. |
| 1.3 | 2026-10-31T23:59:00Z | Change Test Plan Writer | DoR iteration-1 (readiness-iter-1) fixes aligned to spec v1.2. **Test-plan findings:** R-03 corrected the three binding/credential corpus rows to the true composed outcome `? S ? ? ? S` (all GitHub reads skipped/refused, so deps/tier/owner are `work-item-unobserved`, close association unknown, CI reason as pinned), with the status `status.ts` handler and `edge.ts` refusal composition cited; R-05 relabeled the corpus rank column as 1-based `rank` (single-candidate cases are `rank: 1`; class rank is a separate 0–4 bucket) and kept `GH-007` before `GH-7`; R-08 fixed the park-fold evidence source to `provider-parks` in the AC-F9-1 row and TC-QREADY-012; R-09 moved the binding reason to group 1 in TC-QREADY-010; R-11 rewrote `33 refs (34 positionals)`; R-12 allowed the sibling `status` `collectStatusFacts` import in TC-QREADY-025; R-13 replaced the malformed `active_change: null` "no active change" fixture with omitted `active_change` + `parked_changes: []` and kept `null` as malformed; R-14 set the negative-control matrix to 22 everywhere; R-20 pinned all-skipped CI to `ci-none`. **Spec v1.2 alignment:** R-01 made `ADOS_QUEUE_READY_LIVE` a `tests/fixtures/queue-ready/harness.ts`-only literal (no `QUEUE_READY_LIVE_ENV` constant, exactly `1`); R-02 added `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS = 64` with 64 accepted / 65+ rejected before any read, the canonicalize -> length -> duplicate -> read order, and the `ref-length-max-64` corpus case; R-04 re-scoped command-level association to open-only (`pr-not-associated`, never `pr-not-open`) and merged/closed exclusion plus `pr-not-open` to evaluator-injected views, with at-limit `unknown` winning; R-06 pinned one deps evidence record with `done:<n>; open:<n>; unknown:<n>` and moved `evidence-cap-3` to a synthetic over-cap contract case in TC-QREADY-035; R-07 added unobserved-before-signal precedence to deps/tier/owner; R-10 replaced the rendered-help assertion with a documentation/registry assertion; R-16 separated handler `input.value.rejected`/`fallback.internal` from the parser `fallback.invocation` envelope; R-18 removed the title field, title clamp, and title constant; R-19 added the `repo:local-context`/`tier:priority-label` details and the fixed `[repo:local-context; tier:priority-label]` human suffix to the goldens. No TC id added or removed (35 TCs, TC-QREADY-001..035); all 20 AC criteria and all 11 NFRs remain covered with no orphan TC. |
| 1.4 | 2026-10-31T23:59:30Z | Change Test Plan Writer | DoR iteration-2 (readiness-iter-2) fixes aligned to spec v1.3; 38 TCs (TC-QREADY-001..038) and all 23 AC criteria. **R-21/R-25 (critical):** every `available`/all-clear scan is rescoped to the affected condition's evidence/details and the provider human-text segment, never the whole payload/digest; the pinned condition id `provider-available`, condition-id list, `blocking:` lines, payload keys, summary tokens, and close classes are explicitly allowed (AC-F9-1/AC-F17-1 rows, TC-QREADY-011 step 5, TC-QREADY-012 step 10, TC-QREADY-021 step 5, TC-QREADY-031 steps 5–6, TC-QREADY-020/029). **R-22 (critical):** provider-shaped `entityId` fixtures (`"176"`, `"179"`) replace GH-shaped observed ids in TC-QREADY-004/005/028; new TC-QREADY-036 (exact/case-insensitive, bare-number bridge, wrong number, ambiguous `GH-7`+`PDEV-7`/`"7"`, leading-zero `"0176"`/`"7"`, preserved `"007"`, non-digit non-canonical, exact-beats-ambiguity, full-value-before-clamp) and TC-QREADY-037 (`blocked-by` target resolution, unobserved/ambiguous/leading-zero); AC-F2-3 and AC-F4-2 added to the matrix and corpus. **R-23 (major):** provider config failure mapped by the read's `reason` (`config-invalid` -> `config-invalid`; `provider-chain-unresolved` -> `provider-chain-unresolved`, mirroring `packages/core/src/domain/status.ts`), park-fold stays `provider-parks`/`state-unreadable`; added the command-level `{ok:false, reason:"provider-chain-unresolved"}` fixture so `not-ready-provider-unresolved` is reachable (TC-QREADY-004/012/028, corpus row). **R-24 (major):** AC-F12-2 coverage via new TC-QREADY-038 — nine caps, output-only clamps vs a no-caps oracle (identical verdicts/`closeClass`/`rank`/`associatedCount`/`summary`), `value-clamped` after `source-truncated`, payload `truncated: true`, 64 KiB/4096-byte bounds, deterministic relations-then-labels byte-budget reduction, `blocked-by`-only projection; TC-QREADY-018/019/020/029 assert the 32-char provider segment with trailing `+` and the cap-sized digest bound, and the goldens are deliberately regenerated. **R-26 (minor):** group 2 is exactly `source-truncated` then `value-clamped`; group 6 is exactly `pr-association-unknown` and last; `read-failed`/`credential-unavailable` are group-5 only, with the un-deduplicated PR-read-failure case (TC-QREADY-034). New constants (`QUEUE_READY_MAX_IDENTITY_CHARS`, `_REF_CHARS`, `_LABEL_CHARS`, `_LABELS`, `_RELATIONS`, `_OWNER_CHARS`, `_REPO_NAME_CHARS`, `_BRANCH_CHARS`, `_TIMESTAMP_CHARS`, `QUEUE_READY_MAX_HUMAN_SEGMENT_CHARS`, `QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN`, `QUEUE_READY_PAYLOAD_MARKER_REASONS`, `value-clamped`) added to the constant-inventory and corpus-completeness meta-checks. TC-QREADY-031 adds the structural live assertion that a known candidate is observed. Scenario Index, AC/NFR/DM coverage, corpus table, automation map, execution order, evidence commands, risks, assumptions, and open questions reconciled; no existing TC id removed and no orphan TC. |
| 1.4.1 | 2026-10-31T23:59:59Z | Change Test Plan Writer | OQ-T11 closed by `chg-GH-176-plan.md` v1.2 (RES-8; TC-QREADY-036/037/038 mapped to tasks 3.2/5.3); the gap/open-question register now holds no open item; no TC, AC, NFR, or assertion changed. |
| 1.5 | 2026-11-01T00:10:00Z | Change Test Plan Writer | DoR iteration-3 alignment to spec v1.4 (R-30..R-36); 38 TCs / 23 ACs / 11 NFRs unchanged. **R-30:** GAP-14 provenance corrected to spec v1.4 R-30 (it cited v1.3 R-26, the group-6 ordering pin); the read-reason mapping in TC-QREADY-012 (`config-invalid` vs `provider-chain-unresolved`, park fold `provider-parks`/`state-unreadable`) and the `not-ready-provider-unresolved` corpus row are unchanged. **R-31:** "candidates evaluated independently" is qualified wherever stated (summary, §1.1, §4.2, TC-QREADY-032/036 and corpus `identity-ambiguous-suffix`) with candidate-set-scoped identity observation: a shared suffix leaves the item unobserved for every sharing candidate, never by precedence or caller order; condition evaluation stays independent. **R-32:** "sums to the observed target count" replaced by "sums to the total `blocked-by` relation target count (observed + unobserved)" in AC-F4-1, §1.1, TC-QREADY-004/005/037, the corpus completeness meta-check, and the DoD checklist. **R-33:** AC-F4-2 ambiguity moved from "two requested candidates" to two observed work items; TC-QREADY-037 pins the observed work-item set as the target uniqueness domain and adds the canonical observed target `GH-179` that is not a requested candidate (observed by exact match), with a matching corpus row. **R-34:** AC-F12-2/DM-2/DM-6/DM-11/NFR-2 and TC-QREADY-018/019/038 assert every projected relation-target and pull-request identity is `entityId`-only with no `systemName`, plus a 200-character `systemName` fixture proving the key and value never enter the payload or digest; still nine caps. **R-35:** AC-F1-1, TC-QREADY-001/032, and the corpus meta-check state duplicates detected after canonicalization and rejected, never silently merged. **R-36:** no 43-byte figure exists in this plan; the proxy suffix is not byte-counted here (spec Appendix F carries the 41-byte figure). No condition id/order, state, reason, bound, rank, close class, AC/NFR mapping, or existing expected verdict changed. |
| 1.6 | 2026-11-01T00:40:00Z | Change Test Plan Writer | DoR iteration-4 (readiness-iter-4) fixes aligned to spec v1.5; 38 TCs / 23 ACs / 11 NFRs unchanged. **R-37 (major):** the over-broad AC-F14-1 row, TC-QREADY-021 `Then`/steps/expected outcome, the 22-control matrix table, and the DoD clause no longer claim that no negative control becomes ready or satisfied. Each control is asserted on its targeted condition/source: a targeted absent/failed/unattempted/unavailable/unresolved readiness source is not `satisfied`, and a non-satisfied readiness condition never yields a `ready` claim; the PR-read-failure (20) and at-limit-no-match (22) controls keep all six conditions satisfied and yield `ready: true` with `closeClass: unknown` (never `new-start`), and the binding-unavailable (21) control is not ready; no control yields `merge-ready` without observed approval or an all-clear. **R-38 (minor):** TC-QREADY-028 step 10 now names the actual corpus row `not-ready-provider-unresolved` and fixture `unresolved-chain-command` instead of the undefined `provider-chain-unresolved-command`. **R-42 (nit):** AC-F9-1, TC-QREADY-012 steps 5-8/expected outcome, the §1.1 provider summary, GAP-14, the `not-ready-provider-*` corpus rows, and the TC-QREADY-028 corpus/meta-check now pin the config/park failure-identity `detail` form (`failureCode:<code>`, `failureClass:<class>`, or both joined by `; `; no `detail` when neither is supplied; never free-form); the command-level `provider-chain-unresolved` case carries `detail:"failureCode:config.value.invalid"`, the defensive `ok:true` view and `provider-chain-not-declared` carry none, and `state-unreadable` carries the park read's code/class where supplied; a hand-planted free-form provider failure detail must fail. Spec v1.5 R-40/R-41 are documentation-only here. No condition id/order, state, reason, bound, rank, close class, AC/NFR mapping, or existing expected verdict changed; the gap/open-question register stays closed. |
| 1.7 | 2026-11-01T01:20:00Z | Change Test Plan Writer | DoR iteration-5 (readiness-iter-5) fixes aligned to spec v1.6 and plan v1.5; 38 TCs / 23 ACs / 11 NFRs unchanged. **R-46 (nit):** completed traceability links — TC-QREADY-020's Scenario Index row now carries AC-F12-2, TC-QREADY-031's row now carries AC-F2-3/AC-F9-1, and the AC-F9-1 forward row now carries TC-QREADY-031. **R-47 (nit):** updated stale references — GAP-1, A-T3, A-T18, OQ-T1/OQ-T11, the resolved-gap list, and the §8 closeout now cite plan v1.5; the change-spec reference and summary/intro cite spec v1.6 with the R-44/R-45/R-48/R-49 history; the fixture directory map now lists `unresolved-chain-command`. **R-45 (minor alignment):** TC-QREADY-016 `Then`/preconditions/steps/expected outcome, its Scenario Index row, the §1.1 close bullet, and the AC-F10-1 coverage row now pin the full same-class associated-PR tie-break — merge-ready set when non-empty, otherwise the associated set; `entityId` ascending numeric-aware (both all-digit compare unsigned integer; equal numeric values tie), `sourceRef` ascending, `targetRef` ascending, then the lexically smaller raw `entityId` as the final defensive key; API return order never decides — with an added `targetRef` tie-break case (`7`/`007` with equal `sourceRef`, different `targetRef`) and a raw-`entityId` case (`7`/`007` with equal `sourceRef` and `targetRef` -> `007`). **R-44/R-49 verified:** AC-F9-1 already carries `detail:"chain:<name>"` on `no-enabled-entry` and `all-entries-parked`, and AC-F2-1 already pins exactly one evidence record per non-provider condition and exactly two for `provider-available`; no change was needed. R-48 is spec-only here. No other assertion, condition id/order, state, reason, bound, rank, close class, or AC/NFR mapping changed; the gap/open-question register stays closed. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD, and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
