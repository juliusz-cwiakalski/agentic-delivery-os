# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-279
Date: 2026-11-10
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [major] ac_quality — `chg-GH-279-spec.md` §17 AC-F2-6 and §5 F-2.4; `chg-GH-279-test-plan.md` §6 and §8.2
   Gap: AC-F2-6 requires "two admission reads that both fail without a transport status — one a malformed 2xx payload and one a thrown or timed-out request" and calls them "the two status-absent outcomes". The chosen discriminator is the opposite: TDR-0019 decision point 4, plan Phase 3, and TC-READMAP-004 all stamp the received `2xx` status onto the malformed decode failure, so the malformed payload is status-present (`httpStatus: 200`) and only the transport throw is status-absent. The AC is unsatisfiable as written, and test-plan §6 ("malformed `2xx` → without status but with the received status stamped") and §8.2 repeat the contradiction.
   Suggested remediation target phase: specification
   Suggested fix: Reword AC-F2-6 and F-2.4 to "a malformed 2xx carries the received 2xx status stamped on the payload failure; a transport throw carries no status", and align test-plan §6/§8.2 to that wording. Keep the requirement that the two outcomes stay distinguishable.

2. [major] plan_coverage — `chg-GH-279-plan.yaml` Phase 1 `verification` (lines 186-189)
   Gap: Both Phase 1 verification commands are false against the current tree. (a) `grep -c 'Amendment (GH-279'` returns 5 because the TDR-0015 preamble also contains that phrase, while the plan asserts "exactly four additive notes"; the four blockquote notes are matched by `^  > \*\*Amendment (GH-279`. (b) The `git status --porcelain` assertion expects "the untracked TDRs", but TDR-0019/TDR-0020 and the 00-index rows are already committed (HEAD `ca4aa1a8`), so the command cannot produce the expected state. Structurally, Phase 1 is `kind: planning`, and the commit primitive's `delivery` lifecycle unions only `kind: delivery` phases (2-8), so Phase 1's planning scope is not reachable for staging during delivery.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Anchor the grep to the four blockquote notes (or assert 5 and separately verify the preamble names four assertions); replace the untracked-TDR expectation with `git ls-files --error-unmatch` assertions and state that the decision material landed before delivery; either make Phase 1 verification-only or move any still-untracked decision material into a `kind: delivery` phase's scope.

3. [major] test_traceability — `chg-GH-279-test-plan.md` §5.2 TC-READMAP-004/007 and §7; `chg-GH-279-plan.yaml` Phase 3
   Gap: The load-bearing malformed-2xx/transport-throw distinction is tested only through a read double that *already* stamps `httpStatus` (TC-READMAP-004 precondition). The suite would therefore pass even if `packages/adapters/src/github/client.ts`/`normalize.ts` never implemented the Phase 3 stamp. The real adapter behavior is exercised only by `github-inputs.test.ts`/`github-trap.test.ts` in the plan's Phase 3 verification, and neither suite is mapped in test-plan §7 or tied to a TC.
   Suggested remediation target phase: test_planning
   Suggested fix: Add a TC (for example TC-READMAP-011) that drives the real GitHub client with an injected transport and asserts: 200 + malformed body -> `provider.payload.invalid` with `httpStatus: 200`; transport throw -> no `httpStatus`; 404 -> `provider.not-found`; other non-2xx -> status preserved. Map `tests/behaviour/providers/github-inputs.test.ts` and `github-trap.test.ts` in §7 and assign the TC to plan Phase 3.

4. [major] test_traceability — `chg-GH-279-plan.yaml` Phase 4 delivery pin (lines 84-92) and verification (line 318); `chg-GH-279-test-plan.md` §7
   Gap: The plan adds a security-relevant "trusted-refusal marker" because `packages/cli/src/index.ts` suppresses every config-shaped `summary`/`remediationHint`. The marker is not in the spec and has no TC in the test plan; `tests/behaviour/error-classification.test.ts` is run by plan verification but is absent from test-plan §7. Without a negative control, a change could reopen untrusted-config summary forwarding.
   Suggested remediation target phase: test_planning
   Suggested fix: Add a TC (or extend TC-CREDNAME-001) asserting the marker is required for `config.credential.missing` and that an unmarked config failure still suppresses `summary`/`remediationHint`; map `error-classification.test.ts` in §7; add the classifier-summary path to spec §16/§16.1 (or state it as a delivery choice under F-2.6).

5. [major] test_traceability — `chg-GH-279-test-plan.md` §5.2 TC-DIVREC-008
   Gap: TC-DIVREC-008 expects `data.error` to carry the underlying `state.write.failed` "with its declared row (kind `state`, its category, retryable, consequence, remediation, projection)". `CommandResultError` (`packages/core/src/contracts/result.ts`) has only `code`, `category`, `retryable`, `consequence`, `remediationHint`, `summary` — no `kind` and no `projection`. As written the test cannot pass without an unplanned envelope-contract change, and spec D6 only requires the underlying identity in `data.error`.
   Suggested remediation target phase: test_planning
   Suggested fix: Align the test to spec D6: assert `data.error.code === "state.write.failed"` plus the existing row fields the envelope already carries, and assert kind/projection only through the classification path. If the full row is genuinely required in the envelope, raise it as a spec/contract change rather than smuggling it in through a test.

6. [major] cross_artifact_consistency — `chg-GH-279-spec.md` F-4.2/F-4.4 and D6; `chg-GH-279-plan.yaml` Phase 6 delivery pin (lines 100-104); test-plan TC-DIVREC-008
   Gap: Append-failure semantics cover only a failed *divergence* append. The delivered order appends the divergence before the attempt (current `dispatch.ts` does this for mismatch). If the divergence append succeeds and the attempt append then fails, the ledger keeps an open divergence whose `attempt:<id>` evidence ref does not exist; the per-work-item dedupe then blocks a new divergence for that pair until the orphan is attested closed. No TC covers this direction.
   Suggested remediation target phase: specification
   Suggested fix: State the intended order and the attempt-append-failure behavior explicitly (accept and document a resolvable orphan, or add a compensation/ordering that prevents it), add a TC (for example TC-DIVREC-011) for attempt-append failure, and state whether the orphan counts as unresolved.

7. [major] cross_artifact_consistency — `chg-GH-279-spec.md` front matter `links.decisions` (line 28); TDR-0015 line 335; TDR-0020 line 180
   Gap: The spec omits TDR-0019 — the primary admission-preflight decision — from `links.decisions` even though the spec and test plan depend on it. Separately, both TDR-0015 and TDR-0020 claim the spec's F-4.9/DEC-3 "summarizes this as two changed gate behaviours", while spec v1.2 says four assertions. The durable records therefore contain a stale statement about the spec.
   Suggested remediation target phase: specification
   Suggested fix: Add `TDR-0019` to the spec's `links.decisions`; correct the "two gate behaviours" sentences in TDR-0015 and TDR-0020 to point at the spec's four-assertion wording (or remove the claim).

8. [minor] cross_artifact_consistency — `chg-GH-279-plan.yaml` Phase 7 scope (line 418) and verification (line 440); test-plan §6 "Contracts pinned"
   Gap: Phase 7 lists `tests/fixtures/ports/v1-contract-inventory.json` as a changed file and says `port-contract-inventory.test.ts` proves "the status contract delta is exactly the additive optional prerequisite declaration". The inventory records exported names only; an optional field on `StatusEvidence` does not change it. Test-plan §6 also says the inventory moves only for the additive preflight declarations.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Remove the inventory from Phase 7 unless a new exported type is introduced; if one is, state that and update test-plan §6/§7. Re-word the Phase 7 verification to assert the field through the status contract/type check, not the name-level inventory.

9. [minor] cross_artifact_consistency — `chg-GH-279-spec.md` F-2.5, NFR-8, AC-F2-5; plan Phase 2 delivery pin (lines 60-62); test-plan TC-ADMIT-001/TC-REG-004
   Gap: The spec says the engine result error-kind union is widened to admit `provider` only, while the plan and TC-ADMIT-001 require `config` as well (the credential refusal must be carried under `kind: "config"`). `config` is an existing `DOMAIN_KINDS` member, so this is an additive clarification, not a new kind — but the artifacts disagree.
   Suggested remediation target phase: specification
   Suggested fix: State in F-2.5/NFR-8/AC-F2-5 that the union admits the existing `provider` and `config` kinds additively, and include `config` in the port-contract coverage note.

10. [minor] cross_artifact_consistency — `chg-GH-279-plan.yaml` delivery pin lines 80-83; `chg-GH-279-spec.md` Appendix A
    Gap: The plan adds an "unaddressable admission read" branch (`input.value.rejected` before any request when no repository target resolves) that is not in the spec's admission table and has no AC/TC. It may be existing composition behavior, but as written it is a new refusal path with no traceability.
    Suggested remediation target phase: specification
    Suggested fix: Add the branch to the admission decision table with an AC/TC, or state that it is the delivered composition refusal and cover it with a test.

11. [minor] plan_coverage — `chg-GH-279-plan.yaml` Phase 8 `acCoverage` vs test-plan AC-F5-4
    Gap: AC-F5-4 is declared only in Phase 7, but its guide-content half (the guide records the least-privilege expectation and the registration-by-this-change fact) is delivered by TC-DOCS-001 in Phase 8. Phase 8's `acCoverage` omits AC-F5-4.
    Suggested remediation target phase: delivery_planning
    Suggested fix: Add AC-F5-4 to Phase 8's `acCoverage` and note the split (redaction in Phase 7, guide content in Phase 8).

12. [minor] plan_doc_update_coverage — `chg-GH-279-spec.md` §16.1 "Change record for this change"; `chg-GH-279-plan.yaml` Phase 8
    Gap: The spec lists a "change record for this change" that records the live evidence and the real credentialed dispatch, but no phase owns creating or updating it; the plan records MV-1 only in the PR description. The ticket's "corroborated by artifact + tracker + CI" evidence is also not explicitly captured by MV-1 (it says only "a verdict other than `state-unverified`").
    Suggested remediation target phase: test_planning
    Suggested fix: Either assign the change-record obligation to Phase 8 or state that the PR description is the record; extend MV-1 to name the artifact, tracker, and CI corroboration facts.

13. [nit] test_traceability — `chg-GH-279-test-plan.md` front matter
    Gap: `implementation_plan: pending (./chg-GH-279-plan.yaml, authored in phase 4)` is stale; the plan exists and has been through Phase 4 planning.
    Suggested remediation target phase: test_planning
    Suggested fix: Point the front matter at the actual plan artifact.

14. [minor] spec_completeness — `chg-GH-279-spec.md` §4.2 NG-1 / DEC-5; ticket requirement 4
    Gap: The ticket says "Surface the same check in `doctor`/`status`". The change ships the `status` surface and keeps doctor parity by test only, with doctor unshipped. This is a recorded PM scope decision (D5), not a silent gap, but the PR/guide must say so explicitly so the ticket reading is not mistaken for an unmet requirement.
    Suggested remediation target phase: specification
    Suggested fix: State in the guide and PR description that doctor remains unshipped in this change and that the operator-facing prerequisite surface is the dispatch preflight plus the status `credentialPrerequisite` evidence.

## Verdict Basis

The artifact set is unusually strong on architecture, decision capture, and forward/backward traceability: all 30 ACs and all 58 TCs are assigned to phases, the composition inversion has both a positive and a no-preflight control, the resolve path is correctly kept local-evidence-only, and the divergence record shape fits the delivered ledger. The gate is nevertheless NOT_READY because three blocking classes remain: an acceptance criterion (AC-F2-6) that contradicts the chosen `httpStatus` discriminator and is therefore not testable as written; a Phase 1 plan verification that cannot pass against the current tree and a planning-phase scope the delivery commit path cannot reach; and test-plan gaps where the behavior-critical adapter stamping and classifier trusted-marker paths are simulated or omitted rather than traced. TC-DIVREC-008 additionally asserts envelope fields the delivered `CommandResultError` does not carry, and the append-failure contract covers only one of the two append directions. These are cheap to fix before delivery and expensive to discover in review.
