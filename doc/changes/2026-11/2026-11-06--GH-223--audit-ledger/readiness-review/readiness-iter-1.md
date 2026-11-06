# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-223
Date: 2026-11-06
Pause Required: no

Reviewer: @readiness-reviewer (adversarial DoR gate). Source ticket GH-223 loaded
directly from GitHub (juliusz-cwiakalski/agentic-delivery-os#223) and cross-checked
against spec v1.3 (a0109171), test plan 49 TCs reconciled to v1.3 (472fa0d5), plan
chg-GH-223-plan.yaml delivery.plan.v1 (03da3591), pm-notes, and current system truth
(`doc/spec/features/feature-{state-layer,result-contract,branding-seam}.md`) plus the
actual public-port/CLI/testkit code in `packages/**` and `tests/**`.

## Facet Summary
- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Verified before findings (mechanism realism — the class that failed twice)

Confirmed against code, not just prose: `StateStorePort` supports the two-phase
append exactly as specified (`append(handle, request)` per call; `readRecords()`
fold view; single store fence `fence.<workspace>.lock`; `StateEdgeFaultPoint`
already carries `append-before-flush`, enabling first/second-append fault
wrappers); `createArtifactBoundary` declares plural `kinds[]` under one
`recordKeyPrefix`, so both audit kinds under `audit.invocations` is directly
supported; salvage is documented truncate-to-last-valid-frame (the surviving-tail
reservation corollary is mechanically forced, as PM accepted); `runCli` already
computes `startedAt = deps.clock.now()` at the top-level outcome assembly (capture
point for all outcome classes incl. broken invocations); `redact()` is exported
from the single chokepoint; `BrandIdentity.environmentPrefix` exists; the
StateStorePort indeed has NO store-managed artifact method and plan task 2.1
carries the flagged design step with a STOP-and-escalate trigger; store layout
family (`header.`, `fence.`) is real, so `chain-key.<workspace>.json` naming is
accurate. Ticket AC1..AC6 and all three pinned decisions trace to spec
AC-F1..F6 with no coverage gap; SC-M1-23 is inherited verbatim in TC-022;
`--verbose`/`--pretty` semantics match the M1 contracts pack; plan traceability
15/15 ACs and 49/49 TCs checks out; all per-phase verification commands reference
existing suites/scripts.

## Findings

1. [critical] cross_artifact_consistency — chg-GH-223-spec.md#AC-F3-1/AC-F3-2/G-3/F-3/§1/DEC-1/Flow-2 vs DM-1/EVT-1/DEC-5/OQ-7; mirrored in chg-GH-223-test-plan.md#TC-001/TC-014 vs TC-005/§1.1; chg-GH-223-plan.yaml#task-1.1
   Gap: The spec repeatedly requires the audit record to RETAIN the envelope's `schemaVersion` ("schemaVersion, runId, and timing live in the audit record" — §1, G-3, DEC-1, Flow 2; "the audit record retains all of them" — AC-F3-1; "retains schemaVersion, runId, and timing" — AC-F3-2), and the test plan encodes it concretely (TC-001: "and the envelope's schemaVersion (retained as context)"; TC-014: "the audit record retains all four trimmed context fields … (schemaVersion, runId, timing, exit code)"). But the pinned payload field enumeration — DM-1, EVT-1, DEC-5, OQ-7, test plan §1.1, TC-005's exact-field-set assertion, plan task 1.1 — is the 12-field set (runId, command, arguments, exitCode, timing, outcomeClass, scope, repo, startedAt, auditSeq, agentIdentity, chainValue) with NO field for the envelope's schemaVersion (`delivery.result.v1`); the record's boundary-required `schemaId` is `delivery.audit.invocation.v1`, a different value. Ticket AC3 says "the audit record retains them" for schemaVersion/runId/timing, so ticket coverage is implicated too. TC-001/TC-014 (Critical priority, tracing AC-F3-1/2) cannot pass as written against the TC-005/plan-1.1 pinned set, and the coder cannot resolve it without an unpinned contract decision that changes the delivered payload schema. Same class as MR-1 (F/AC vs DM/EVT consistency) that drove iteration 4; the v1.3 consistency sweep covered only the reservation payload enumeration.
   Suggested remediation target phase: specification
   Suggested fix: PM decision, then spec pin (record in pm-notes): EITHER add an explicit retention field (e.g. `envelopeSchemaVersion`) to DM-1/EVT-1/DEC-5/OQ-7/Appendix B and consequential updates to test-plan §1.1, TC-005, plan task 1.1 (and the Phase-1 boundary declaration task), OR pin the interpretation that retention covers runId/timing/exitCode while the envelope schemaVersion is a schema-generation constant of the result contract, and reword AC-F3-1/AC-F3-2/G-3/F-3/§1/DEC-1/Flow-2/glossary-Trim plus TC-001/TC-014 accordingly, explicitly addressing the ticket AC3 wording. Consequential test-plan touch-up rides the same reopen loop.

2. [major] plan_code_area_coverage — chg-GH-223-plan.yaml#Phase-4 (task 4.1 scope.files)
   Gap: The scripted trim renderer must be implemented at the single stream-write site: `packages/cli/src/output/serialize.ts` is "the only module in the delivered surface that writes to a stream" (module header), owns `writeOutput`/`serializeEnvelope` (which currently hardcodes pretty JSON, `null, 2`), and its export surface is pinned by an executable-allowance inventory (`tests/structure/content-inventory.test.ts:359` lists exactly `["redact","serializeEnvelope","writeOutput"]`). Emitting the minified `{"data":...}` / `{"error":...,"runId":...}` lines therefore requires Phase-4 changes to `packages/cli/src/output/serialize.ts` (and the content-inventory allowance for any new export; plus `packages/cli/src/output/index.ts` if the barrel changes). Phase 4's declared scope omits all three files (task 4.1 names only `index.ts` + `edge.ts`); implementing the renderer in `index.ts` instead would violate the single-write-site invariant that TC-032/§21 and `cli-edge-seam.test.ts` structurally enforce, while touching the file undeclared would classify as `plan.scope.undeclared-paths` at plan-diff/review time. Blast radius of the phase is not explicit — exactly the "phase scope paths omitting files the TCs require" class (TC-014/016/021 are P4 TCs requiring the renderer).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `packages/cli/src/output/serialize.ts`, `packages/cli/src/output/index.ts` (if re-exports change), and `tests/structure/content-inventory.test.ts` to Phase 4 `scope.files`, and name the single write site in task 4.1's text. No spec/test-plan change required.

3. [nit] cross_artifact_consistency — chg-GH-223-test-plan.md#frontmatter `links.implementation_plan`
   Gap: Still `null` although `chg-GH-223-plan.yaml` now exists (authored after the test plan's last update).
   Suggested remediation target phase: test_planning
   Suggested fix: Set the link to `./chg-GH-223-plan.yaml` in the next touch-up (can ride finding 1's consequential edit).

4. [nit] plan_coverage — chg-GH-223-plan.yaml#Phase-1 verification
   Gap: `tests/structure/port-contract-inventory.test.ts` is declared in Phase-1 scope (task 1.3 registers the contract inventory) but the Phase-1 verification command block does not execute it (only audit-contract, state-contract, content-inventory). Covered later by the Phase-5 sweep, so non-blocking.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add the suite to the Phase-1 verification command list (or note the Phase-5 sweep as the verifier).

5. [nit] system_spec_consistency — chg-GH-223-spec.md#F-5 ("reads … write nothing")
   Gap: The state layer's documented behavior permits a verified indexed read to rebuild a divergent/missing derived index (a reported write) — the absolute "write nothing" wording in F-5 could mislead delivery into suppressing rebuilds. The test plan already reconciles this (TR-12; TC-028 note; TC-046 treats index rebuild as a reported derived write), so this is wording only.
   Suggested remediation target phase: specification
   Suggested fix: Qualify F-5 (and AC-F5-1's "writes nothing") as "no ledger writes / no fence acquisition; a reported derived-index rebuild per the state layer is not an audit write" — can ride finding 1's spec iteration.

6. [nit] ac_quality — chg-GH-223-spec.md#F-5 (command filter semantics vs broken invocations)
   Gap: The read surface's command filter is exact-match against the record's `command`, but broken-invocation records carry raw argv tokens in that field; whether/how repo-constrained-style exclusion applies to command-filtered broken-invocation records is unpinned. No TC probes it (TC-028 fixtures use resolving commands).
   Suggested remediation target phase: specification
   Suggested fix: Pin the match rule (e.g. command filter matches the resolved command name; raw-token records are excluded from command-constrained results, mirroring the repo-null rule) — can ride finding 1's spec iteration or be pinned at delivery via the Phase-1 closed vocabulary.

## Decision routing

- Finding 1 surfaces a `change`-level decision (add a retention field vs pin the
  constant-schemaVersion interpretation against ticket AC3's wording). It is
  PM-decidable within the ticket pins — no human input required; record the
  decision in pm-notes and the spec decision log. No `needs_human_input`.

## Notes

- No prior readiness records existed; this is iteration 1 (no persistent findings).
- Known accepted notes were not re-flagged: test-plan §7.1 driver ambiguity
  (resolved in-plan across P2/P3), test-plan §2 stale "v1.2" reference (cosmetic,
  §1.2 convergence note covers), doc-sync obligations declared scope-only in P6.
- `plan validate` could not be executed in this worktree (workspace `dist/` not
  built); structural conformance to `delivery.plan.v1` was verified by inspection
  against `packages/core/src/contracts/plan.ts`, and the validator verdict
  (`valid`, `readyForDevelopment=true`) is recorded in pm-notes. Not a finding.
