# Readiness Review Iteration 5

Verdict: NOT_READY
Work Item: GH-176
Date: 2026-10-31
Pause Required: yes

## Gate Summary

- Findings: 7 new — **1 major, 2 minor, 4 nit**. No critical.
- Blocking finding: **R-43** — `chg-GH-176-plan.md` pins a `collectStatusFacts` read sequence that gates the issues and pulls reads on SHA resolution, contradicting the delivered `status` handler and the test plan's `not-ready-ci-unresolved` row.
- **R-37, R-38, R-39, R-40, R-41, R-42 are all independently verified closed** (see the closure table below).
- R-30..R-36 remain closed from iteration 4; the provider-mapping, identity, count, cap, duplicate, and 41-byte rules were spot-checked again and did not regress.
- Facets failing: `plan_coverage`, `cross_artifact_consistency`, `system_spec_consistency`.
- Primary remediation targets: `delivery_planning` (R-43, R-45, R-47), `specification` (R-44, R-48, R-49), `test_planning` (R-46). Do not reopen `delivery`.
- **Human process decision required:** R-43 is a new major outside the PM's R-37..R-42 authorization. Under the PM's recorded rule ("If iteration 5 is not READY or surfaces a substantive new finding, delivery stops for human input"), the workflow pauses. The Definition-of-Ready override is **not** available: the change alters behavior and contracts.

## Facet Summary

- spec_completeness: PASS (complete vs. the ticket; R-44/R-48/R-49 are precision nits, not gaps)
- ac_quality: PASS (all 23 ACs are clear and testable; R-44 is an evidence-detail omission, not an AC-intent defect)
- plan_coverage: FAIL (R-43: the plan's Phase 2 extraction instruction specifies a read gate that contradicts the requirements and test plan)
- test_traceability: PASS (38 TCs / 23 ACs / 11 NFRs, zero orphan; R-46 is a reverse-index nit)
- cross_artifact_consistency: FAIL (R-43, R-44, R-45)
- decision_capture: PASS (PM D1..D10 in pm-notes and DEC-1..DEC-19; ODR-0003/ADR links; no new system decision needed)
- system_spec_consistency: FAIL (R-43 would silently drift `status` from its delivered behavior and `feature-status-digest.md`)
- plan_doc_update_coverage: PASS (Phase 7 lists every system doc, the new feature spec, registry, glossary, index, and the distribution/forbidden-literal guards)
- plan_code_area_coverage: PASS (every phase lists files/modules; the behavior inside one listed area is R-43)
- dod_defined: PASS (plan Definition of Done plus 23 ACs / 11 NFRs are explicit and testable)

## R-37..R-42 Closure Status

| Iter-4 finding | Status | Independent verification |
|---|---|---|
| R-37 AC-F14-1 row / TC-QREADY-021 over-broad negative-control claim | **Closed** | `chg-GH-176-test-plan.md` AC-F14-1 row (line 122) now scopes each control to its targeted condition/source; TC-QREADY-021 `Then` (line 1044), steps 1-9 (lines 1079-1087), the 22-row matrix (lines 1050-1073), and the Expected Outcome (line 1091) assert: readiness-condition controls are not ready; controls 20 (PR read failure) and 22 (at-limit no match) keep all six conditions satisfied and are `ready: true` with `closeClass: unknown`/`pr-association-unknown`, never `new-start`; control 21 (binding unavailable) is not ready and never `new-start`; no global "no control is ready" claim remains. The plan mirrors this in task 5.4 (line 551) and the DoD (line 693). |
| R-38 dangling `provider-chain-unresolved-command` fixture id | **Closed** | TC-QREADY-028 step 10 (line 1347) now names the real corpus row `not-ready-provider-unresolved` and fixture `unresolved-chain-command`; the fixture list (line 705) defines `unresolved-chain-command`; a repository-wide search finds no `provider-chain-unresolved-command`. The plan's fixture list (line 530) and task 6.1 (line 581) agree. |
| R-39 plan PM-NOTE-1 `all-unknown-degraded` provider state | **Closed** | Plan PM-NOTE-1 (line 121) scopes `? S ? ? ? S` to the three binding/credential rows and states `all-unknown-degraded` is `? S ? ? ? ?`; the test plan row (line 1823) and spec Appendix G (line 740) agree. |
| R-40 §8.3 canonical-target bridge wording | **Closed** | Spec §8.3 (line 289) now states that only a bare all-ASCII-digit target `entityId` bridges against the observed work-item set; a canonical-shaped target is resolved only by exact case-insensitive full-value identity and, if unobserved, stays `dependency-unobserved` and never bridges. F-4 (line 162), AC-F4-2 (line 476), plan line 391, test plan GAP-11 (line 71), AC-F4-2 row (line 111), and corpus `relation-target-canonical-unrequested` (line 1792) agree. |
| R-41 F-2 exact vs case-insensitive wording | **Closed** | Spec F-2 (line 160) defines exact canonical matching as full normalized value equality under ASCII case-insensitive comparison (not substring/prefix); DEC-15 (line 420), §8.3, plan line 391, test plan lines 28/108/1785 agree. Residual readability nit: R-48. |
| R-42 provider config/park failure evidence detail | **Closed** | Spec F-9 (line 167), DM-4 (line 244), AC-F9-1 (line 481), and Appendix D (line 685) pin `{source, reason, detail?}` with `failureCode:<code>`, `failureClass:<class>`, or both `; `-joined, no free-form detail; command-level unresolved carries `failureCode:config.value.invalid`; defensive `ok:true` and `provider-chain-not-declared` carry none; `state-unreadable` carries park code/class where supplied. Plan RES-5 (line 117), RES-8 (line 120), the condition table (line 218), task 4.1 (line 518), Phase 4 acceptance (line 525), and DoD (line 694) agree; test plan TC-QREADY-012 steps 5-8 (lines 716-719), corpus `not-ready-provider-unresolved` (line 1814), and meta-check (line 1854) agree. Delivered code matches: `packages/cli/src/edge.ts:618-623` (config failure code `config.value.invalid`) and `:354-358` (park failure code). |

## Claims Checked (verification notes, not findings)

- **Counts.** 38 TCs (TC-QREADY-001..038), 23 ACs (AC-F1-1..AC-F17-1), 11 NFRs, 7 phases / 39 tasks; the spec, test plan, and plan agree. All 38 TCs have scenario details, all 23 ACs have coverage rows, all 11 NFRs are traced, and the plan maps 38/23/11 with zero orphans.
- **Ticket coverage.** GH-176's six readiness checks map to F-4..F-9; "prints why a ticket is not ready" maps to AC-F3-1/AC-F13-1/AC-F14-1; "close items (merge-ready, review-pending) rank above new starts" maps to F-10/F-11, AC-F10-1/AC-F11-1; M0-S6 dependence and M2-S1 unblocking are recorded. No ticket requirement is missed.
- **Provider mapping.** `config-invalid` vs `provider-chain-unresolved` is mapped by the read's `reason`, park fold stays `provider-parks`/`state-unreadable`, and the delivered `packages/core/src/domain/status.ts` / `packages/cli/src/edge.ts` behavior is consistent. `StatusProviderConfigRead` and `StatusParkRead` carry the referenced failure fields.
- **Identity rule.** Candidate observation is candidate-set-scoped; `blocked-by` targets use the observed work-item set; exact match is case-insensitive full-value; only a bare all-digit `entityId` bridges; no substring/prefix/coercion; leading zeros preserved; full values are used before projection.
- **Reason groups.** Group 2 is `source-truncated` then `value-clamped`; group 6 is exactly `pr-association-unknown` and last; `read-failed`/`credential-unavailable` are group-5 only; `source-truncated`/`value-clamped` are payload-level only; verdict reasons stay in evidence.
- **Bounds.** 8 candidates, 64-character canonical ref cap (64 accepted, 65+ rejected), 6 conditions, ≤2 evidence (one per non-provider, two for `provider-available`), 6 reasons, 160-character detail, 64 KiB `data`, 16 lines/4096 bytes human, `associatedCount` 0..100, nine provider caps, 32-character human segment, 41-byte proxy suffix, deterministic byte-budget reduction. The human-digest arithmetic (8 candidates + header + summary = 10 lines; 8 × 400 + 620 = 3 820 bytes + ≤276-byte binary name = ≤4 096) holds.
- **Read-only and boundaries.** No writes, fences, state mutations, network writes, provider-engine calls, quota fetches, child processes, or ambient environment reads are planned. No new error row/domain kind, configuration key, state schema, adapter read, package, subpath, runtime-API location, secret-read allowlist entry, or product literal. The forbidden-literal allowlist has five entries and the secret-read allowlist has four; the plan keeps both unchanged.
- **Scope.** Six conditions, close ranking, read-only posture, identity/cap rules, fixture corpus, and live smoke trace to the ticket and PM decisions. The queue/lane/dispatch engine, discovery, provider engine, closed-issue/GraphQL reads, and MCP surfaces remain out of scope. No scope creep.
- **System spec.** `doc/spec/features/feature-status-digest.md` keeps lanes-or-queue `not-delivered` and explicitly leaves `queue ready` to M0-S7; the registry row and ODR-0003 lock the name. The spec and test plan agree with the current system spec. The plan's R-43 extraction instruction is the outlier (see finding 1).
- **Feasibility.** `StatusCommandRuntime` already exposes repository, issues, pulls, check-runs, provider-config, park-fold, local-context, and clock reads (`packages/cli/src/commands/status.ts:27-43`); `StatusFacts` carries the raw normalized reads (`packages/core/src/contracts/status.ts:351-361`); the delivered GitHub normalizer emits bare numeric `identity.entityId`; the park fold and config failure fields exist. Extracting `collectStatusFacts` and `classifyPipelineRuns` adds no adapter read.
- **Label-signal proxy.** The plan maps the label-signal availability to `tracker.availability.ownerHandBacks` (the only label-derived availability in the delivered read). This is a delivery-bound proxy consistent with the spec's "label signal" wording and the GitHub slice; it is not a new read or config key.

## Findings

1. **[major] cross_artifact_consistency / system_spec_consistency — `chg-GH-176-plan.md` line 285 (Pinned Delivery Spellings, `collectStatusFacts`) and line 457 (task 2.2), versus `chg-GH-176-test-plan.md` line 1807 (`not-ready-ci-unresolved`) and `packages/cli/src/commands/status.ts:63-78`.**
   Gap: The plan says "if binding observed and SHA resolved read the issues page ..., the pulls page ..., and the check-runs page; otherwise pass the pinned `not-configured`/`commit-unresolved` reads" (line 285) and "binding-observed + SHA-resolved gate; issues page ...; pulls page ...; check-runs page ..." (line 457). The delivered status handler reads the issues and pulls pages whenever the binding is observed (`status.ts:63-73`) and gates only the check-runs read on `head.sha` (`status.ts:74-77`). The test plan's `not-ready-ci-unresolved` row requires `S S S S ? S` with "binding observed, tracker/pulls read succeeded" (line 1807). A literal implementation of the plan's gate would set tracker/changes to `not-configured`/`commit-unresolved` when the binding is observed and the SHA is absent, making `deps-satisfied`/`tier-known`/`no-owner-gate` unknown and failing that corpus row; it would also change `status` behavior and contradict `doc/spec/features/feature-status-digest.md`. The plan's own D5 (line 303) and "exact current read sequence" phrase conflict with the parenthetical.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Replace both pins with two independent gates: (a) if `repository.binding.state === "observed"`, read the issues page and the pulls page; otherwise set both to the pinned `{ok:false, reason:"not-configured"}` read; (b) if the binding is observed and `repository.head.sha !== undefined`, read the check-runs page for the SHA; otherwise use `commit-unresolved` when the binding is observed and the SHA is missing, and `not-configured` when the binding is not observed. Keep the provider-config resolve, park fold, local-context read, and injected clock once. The status handler must remain byte-identical, and the Phase 2 gate must include `tests/golden/status-digest.test.ts` and the `not-ready-ci-unresolved` corpus row.

2. **[minor] cross_artifact_consistency — `chg-GH-176-spec.md` AC-F9-1 (line 481) versus F-9 (line 167), plan condition table (line 218), and test plan AC-F9-1 row (line 116) / TC-QREADY-012 steps 1-2 (lines 712-713).**
   Gap: AC-F9-1 lists the `no-enabled-entry` and `all-entries-parked` case records without the `detail:"chain:<name>"` that F-9, the plan, and the test plan require. A coder implementing only AC-F9-1 could omit the detail and fail TC-QREADY-012.
   Suggested remediation target phase: specification
   Suggested fix: Add `detail:"chain:<name>"` to both case-record examples in AC-F9-1; no other change.

3. **[minor] cross_artifact_consistency — `chg-GH-176-plan.md` line 239 (selection) and spec F-10 (line 168) versus `chg-GH-176-test-plan.md` TC-QREADY-016 step 2 (line 864).**
   Gap: The plan says "prefer one merge-ready PR; otherwise the lowest numeric `entityId`, then lexical `sourceRef`". It does not pin the tie-break among multiple merge-ready PRs; TC-QREADY-016 step 2 requires the lower-numeric merge-ready PR to be selected. A coder could implement "first merge-ready in API order" and pass the other selection tests while violating determinism for this case.
   Suggested remediation target phase: delivery_planning
   Suggested fix: State "among merge-ready PRs, select the lowest numeric `entityId`, then lexical `sourceRef`; otherwise apply the same numeric/lexical keys"; align F-10 with the same wording. TC-QREADY-016 already covers the behavior.

4. **[nit] test_traceability — `chg-GH-176-test-plan.md` Scenario Index lines 259 and 270, and AC-F9-1 forward row line 116.**
   Gap: TC-QREADY-020's index row omits AC-F12-2; TC-QREADY-031's index row omits AC-F2-3/AC-F9-1; the AC-F9-1 forward row omits TC-QREADY-031. The Related IDs lines (lines 997 and 1432) and the AC coverage tables carry the links, so no AC is uncovered; the claim at line 129 that the Scenario Index carries the reverse direction is slightly overstated.
   Suggested remediation target phase: test_planning
   Suggested fix: Add AC-F12-2 to the TC-020 index row, add AC-F2-3/AC-F9-1 to the TC-031 row, and add TC-031 to the AC-F9-1 coverage row (or remove AC-F9-1 from TC-031's Related IDs if the live smoke is intended as AC-F17-1 only).

5. **[nit] cross_artifact_consistency — `chg-GH-176-test-plan.md` GAP-1 (line 61) and fixture directory map (line 1768); `chg-GH-176-plan.md` status line (line 100).**
   Gap: GAP-1 cites plan v1.2 while the current plan is v1.4; the fixture directory map lists `unresolved` but not `unresolved-chain-command`; the plan's status line enumerates R-37/R-39/R-40/R-42 but omits R-38/R-41. These are stale references with no behavior impact.
   Suggested remediation target phase: test_planning (lines 61/1768), delivery_planning (line 100)
   Suggested fix: Update GAP-1 to plan v1.4, add `unresolved-chain-command` to the directory-map comment, and add R-38/R-41 to the plan status enumeration.

6. **[nit] spec_completeness — `chg-GH-176-spec.md` F-2 (line 160).**
   Gap: "Each input ref must match `QUEUE_READY_WORK_ITEM_REF_PATTERN` exactly — exact canonical match means the full normalized value equals the canonical ref under ASCII case-insensitive comparison" conflates input-pattern validation with observed-identity matching. DEC-15 and §8.3 make the intent clear, but the sentence reads as applying the identity rule to input.
   Suggested remediation target phase: specification
   Suggested fix: Split the sentence: input refs match the declared pattern case-insensitively with no whitespace trimming; exact canonical identity matching is the §8.3 full-value rule.

7. **[nit] spec_completeness — `chg-GH-176-spec.md` AC-F2-1 (line 471).**
   Gap: AC-F2-1 says "at least one bounded evidence record"; DM-3 (line 243) and the test plan AC-F2-1 row (line 106) require exactly one record for each non-provider condition and exactly two for `provider-available`. The AC is less precise than the normative DM.
   Suggested remediation target phase: specification
   Suggested fix: State the exact cardinality in AC-F2-1 (one per non-provider condition, two for `provider-available`).

## Open Decision / Human Escalation

R-37..R-42 are all closed; the PM-authorized correction pass succeeded. However, the full critique surfaced a new **major** (R-43) outside that authorization. Under the PM's recorded process decision, delivery stops for human input. The only compliant path is a human-authorized, scoped `delivery_planning` correction for R-43 (optionally plus R-45/R-47 and the specification/test-plan nits) followed by a re-gate. The Definition-of-Ready override is not available because this change alters behavior and contracts.

## Next Remediation Targets

1. `delivery_planning`: R-43 (two read gates in `collectStatusFacts`, lines 285/457), R-45 (merge-ready tie-break, line 239), R-47 (stale status enumeration, line 100).
2. `specification`: R-44 (AC-F9-1 details), R-48 (F-2 wording), R-49 (AC-F2-1 cardinality).
3. `test_planning`: R-46 (Scenario Index/forward-row links), R-47 (GAP-1 version and fixture map, lines 61/1768).

Do not reopen `delivery`. Re-run this gate after the correction pass; if R-43 persists unchanged, escalate to the human rather than looping.

## Delivery Statement

**Delivery may not proceed.** R-37..R-42 are independently verified closed, and the identity, provider-mapping, reason-group, bounds, read-only, boundary, and system-spec posture is otherwise consistent. The blocker is R-43: the plan's pinned `collectStatusFacts` read sequence gates the issues/pulls reads on SHA resolution, contradicting the delivered `status` handler and the test plan's `not-ready-ci-unresolved` row; a literal implementation would fail the status golden and that corpus row and would change current `status` behavior. Because R-43 is a new major outside the PM's R-37..R-42 authorization, and the DoR override is not available, the workflow pauses for a human process decision before any further correction pass.
