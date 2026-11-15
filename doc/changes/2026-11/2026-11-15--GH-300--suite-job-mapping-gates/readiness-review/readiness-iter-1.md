# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-300
Date: 2026-11-15
Pause Required: no

Reviewer stance: adversarial, independent. The delivered code and current-truth
specs were read directly; the artifacts' claims about delivered behaviour were
not trusted.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

Supporting counts that do pass: 25/25 ACs cited by 31/31 TCs, 31/31 TCs owned by
exactly one plan phase, 8/8 DM rows covered, `delivery-os plan validate GH-300`
→ `verdict=valid`, `readyForDevelopment=true`.

## Findings

1. [critical] cross_artifact_consistency — `chg-GH-300-plan.yaml` §P-1 / Phase 5
   obligation 5.4 (`acquireFileConfig` → `resolveConfig` → "whole-document
   resolution failure falls back to the empty snapshot")
   Gap: this pin silently swallows the defect class AC-F1-2 and TC-SMAP-002
   require to *refuse*. The catalog schema is strict
   (`packages/core/src/config/schema.ts`: `additionalProperties: false` at every
   object level, `required` enforced), so a map carrying an undeclared key, a
   non-list `jobs`/`local`, a missing `schemaVersion`/`local`, or a non-string
   `job` fails `resolveConfig` as a whole-document failure — which §5.4 then
   converts to "undeclared + shipped gate set". Result: exit 0 with no refusal
   for most of TC-SMAP-002's own defect table, and AC-F1-2 ("`config.value.invalid`
   at exit `1` with no `data`") fails. Only defects the schema cannot see
   (caps, identifier grammar, duplicates, empty lists) would reach the pure
   resolver; TC-SMAP-002's note ("the catalog schema may refuse some shapes
   before the pure resolver") is exactly the case this plan handles the wrong
   way. The plan's two sentences — "whole-document resolution failure falls back
   to the empty snapshot" and "only a READABLE document carrying an invalid
   `verify.suite-map` node refuses" — cannot both hold under the delivered
   resolver.
   Suggested remediation target phase: delivery_planning
   Suggested fix: classify the resolution failure by the failure's declared key
   path — a failure inside `verify.suite-map` becomes the map refusal
   (`config.value.invalid`, before any source read); only a failure outside it
   (or an acquisition failure) takes the documented fallback. Alternatively drop
   the map's closed shape from the catalog schema and validate it purely in the
   resolver. State which layer refuses so TC-SMAP-002 has one deterministic
   identity.

2. [major] spec_completeness — `chg-GH-300-spec.md` §8.5 / §9 NFR-5 / §21
   (no statement of what an unreadable or unresolvable configuration *document*
   does)
   Gap: DEC-2/DM-1 pin "every map defect refuses before any read", which presumes
   a readable document. Nothing in the spec states the posture when the document
   itself is missing-unparseable or fails resolution. The plan invents the
   answer in a YAML comment (fail-open → undeclared → delivered behaviour) and
   admits "this is the only point where the plan adds a decision the spec leaves
   open". That pin is not neutral: it makes the *only* enforcement of the story's
   AC silently disappear for a repository whose committed configuration is
   malformed, and it contradicts §21's "Fail-closed by construction. Every
   unresolvable state ends in a refusal or a delivered failure". No AC and no TC
   cover the state, so a delivery could choose either posture and still be
   "green".
   Suggested remediation target phase: specification
   Suggested fix: add one DEC (and one AC) pinning the document-level posture —
   refuse `config.value.invalid` when a present document fails resolution, and
   reserve the silent parity path for an absent document only — or, if policy
   data is deliberately tolerant of an unreadable document, say so in §21 and
   name the resulting risk explicitly. If the tolerant posture is chosen as the
   precedent for all policy-as-code declarations, route it to
   `@decision-advisor` as a decision record instead of a plan comment.

3. [major] cross_artifact_consistency — spec §17 (AC-F2-2 only), test plan §3.1
   (no member-mode narrowing TC), plan Phase 4 obligation 4.2 (member-less
   handler order only)
   Gap: breadth is resolved per invocation and F-3/DEC-7 state the narrowed
   refusal for `verify gates` generally, but every narrowed criterion and TC is
   stated for the member-less path. The delivered member path appends inside
   `crossRepositoryEvaluation` (`packages/cli/src/commands/verify-gates.ts`, the
   `runtime.appendVerification(record)` call before the report is assembled), and
   the plan's ordering obligation (4.2) never mentions it. Consequence: a
   narrowed declaration on a member-declaring change can still append a fresh
   full-green `merge.gate-verification` record and capsule event — the exact
   masquerade DEC-7 exists to prevent — while no AC, no TC and no plan obligation
   would catch it. DEC-6's precedence list also omits the cross-repository
   data-bearing negative verdict (`overall: "fail"` at exit 1), which is a fourth
   outcome the refusal order must beat.
   Suggested remediation target phase: specification
   Suggested fix: extend AC-F3-2 to both report paths (or add AC-F3-6) and name
   the member path in DEC-6's precedence list; then add the TC (narrowed +
   two-member plan: exit 1, no record, no capsule, prior record still newest) and
   a plan obligation that places the refusal before
   `crossRepositoryEvaluation`'s append.

4. [major] system_spec_consistency — plan Phase 5 obligation 5.3 (`readGateSet =
   resolveMergeGateSetFromConfig(values)` in `packages/cli/src/production.ts`) vs
   spec F-5/NG-5/DEC-12 and spec F-1/§12
   Gap: the delivered production CLI composes the gates runtime without any gate
   set (`packages/cli/src/production.ts` `createVerifyGatesCommandRuntime({...})`
   passes no `readGateSet`), so `edge.ts`'s default `resolveMergeGateSet(undefined)`
   always yields the shipped five; `resolveMergeGateSetFromConfig`
   (`packages/core/src/domain/merge-gate-set.ts`) is called nowhere in
   `packages/cli` or `packages/mcp`. Phase 5 therefore makes a *config-declared
   `merge.gates` live in production for the first time* — a change to the gate
   battery, gate ids, and citations for every adopter repository that declares
   one. No AC covers that behavioural change, and it sits uneasily with F-5/NG-5
   ("the five gates … do not move") and with the parity claim. The spec's premise
   in F-1/§12 ("resolved from the same resolved configuration values that supply
   the declared gate set") is simply not true of the delivered production path.
   Suggested remediation target phase: delivery_planning
   Suggested fix: either supply only `readSuiteMap` in Phase 5 (keep the
   delivered shipped-default gate set, so the change stays inside its ACs), or
   declare the gate-set wiring as an intentional, separately AC'd behaviour
   change with its own parity cases. Correct F-1/§12's wording either way.

5. [major] system_spec_consistency — spec §20 ("Committed configuration is the
   declaration home") and §21 ("cannot silently opt out") vs plan Phase 5
   obligation 5.3 (`enableProjectLocalConfig: true`)
   Gap: the map's configuration-layer posture is never pinned, and the delivered
   layer semantics make the claim above false. Layer precedence is
   defaults < system < user-global < project-committed < project-local
   (`packages/core/src/contracts` `CONFIG_LAYERS`), and
   `packages/adapters/src/file/config-source.ts` reads the user-global layer in
   any non-CI run regardless of `enableUserConfig`. So a developer's
   `~/.config/delivery-os/config.yaml` (precedence above the committed file) or
   an untracked `<repo>/.delivery-os/config.local.yaml` (enabled by the plan)
   can supply or replace `verify.suite-map` with a map that matches a deliberately
   narrow job — review of the committed document is not the control it is
   claimed to be. It also means the same repository resolves a different map
   locally than in CI, which is the comparison the story exists to protect, and
   it exposes TC-SMAP-004's end-to-end DoD-8 proof to an ambient user config
   (the suite asserts nothing about which layers were read).
   Suggested remediation target phase: specification
   Suggested fix: pin the layer posture (e.g. the map is honoured only from the
   project-committed layer; a declaration found in a user-global or project-local
   layer is ignored or refused), record it as a DEC, and add the assertion to
   TC-SMAP-004 and to the map's validation cases. If the merged-layer posture is
   kept, §20/§21 must be reworded to the weaker true claim and the override must
   become a named risk.

6. [major] test_traceability — `chg-GH-300-test-plan.md` §5.2 TC-SCITE-001
   precondition and TC-SCITE-003 step 3 / §8.1 TR-10
   Gap: DM-2/DEC-4/C-4 make "`suiteBreadth` is the mirror job's declared list,
   never the local declaration" a core invariant, and TR-10 claims it is covered
   ("TC-SCITE-001 compares to the job's declared order"). But every equality
   fixture declares `suites` and `local` *in the same order*, and set equality
   makes the two lists identical there — so an implementation that copies
   `data.suiteBreadth` straight from `local` passes every stated TC. TC-SDET-002's
   order distinction covers only the narrowed header, not `data.suiteBreadth`.
   (The same weakness makes AC-F2-3's clause "never the local declaration when it
   differs from the mirror's set" witnessless on an emitted report, since the
   sets are equal by construction; only order can differ.)
   Suggested remediation target phase: test_planning
   Suggested fix: add one equality fixture whose `local` is set-equal to the
   mirror job's `suites` but ordered differently, and assert `data.suiteBreadth`
   reproduces the job's declared order verbatim; tighten AC-F2-3's clause to the
   order wording it can actually witness.

7. [major] plan_doc_update_coverage — spec Appendix D (D-1..D-13) and plan Phase 7
   scope (bound to "exactly the spec's Appendix D list")
   Gap: two Current documents carry the exact invariant the change narrows and
   are in neither the delta register nor the Phase 7 file list:
   `doc/spec/features/feature-merge-verify-deploy.md` ("Every full evaluation
   appends exactly one fenced, post-append-verified record … `verify gates`
   records the battery entries …") and
   `doc/quality/test-specs/test-spec-merge-verify-deploy.md` (`status: Current`;
   "exactly one appended record per full battery evaluation"). Both become false
   for a narrowed refusal, and Phase 7 is explicitly limited to Appendix D, so
   the drift is guaranteed. Related, smaller: `feature-verify-gates.md`
   §Quality evidence lists the fixture roots as
   `tests/fixtures/verify-gates/{cases,corpus,golden,workflows}` and the new
   `suite-map` root is not added by D-5.
   Suggested remediation target phase: specification
   Suggested fix: add the two files (and the §Quality evidence fixture-root
   sentence) to Appendix D as new delta rows, which by the plan's own binding
   brings them into Phase 7 scope.

8. [minor] cross_artifact_consistency — `chg-GH-300-plan.yaml` header source
   block and §P-4
   Gap: the plan cites "Tests: ./chg-GH-300-test-plan.md (v1.1)", and §P-4
   describes the TC-SNARR-001 `error.summary` contradiction as still requiring a
   test-plan revision "before or at the DoR gate". The test plan is now v1.2
   (§9 revision log) and the contradiction is resolved; the plan's recorded
   state is stale relative to the artifact it binds to.
   Suggested remediation target phase: delivery_planning
   Suggested fix: update the source block to v1.2 and restate P-4 as resolved,
   with a pointer to the v1.2 log row.

9. [minor] plan_coverage — `chg-GH-300-plan.yaml` Phase 6 `scope.files`
   Gap: `tests/fixtures/verify-gates/corpus/cases.json` is declared as a Phase 6
   scope file while the plan's own SCOPE CONVENTION paragraph pins it as "a
   READ-ONLY control: … the corpus stays at 48 cases", and Phase 6 obligation 6.1
   compares all 48 cases against the Phase 1 baseline. Declaring it writable gives
   the phase the option to break its own parity proof.
   Suggested remediation target phase: delivery_planning
   Suggested fix: remove it from Phase 6 `scope.files` (it is read, not edited).

10. [minor] spec_completeness — spec Appendix B and §7.3/OQ-1 vs
    `milestones/m2/test-scenarios.md` SC-M2-S7-02
    Gap: the seed's precondition is "a local gate **invocation** limited to one
    package"; the delivered mechanism is declaration-scoped, and the spec
    discloses that gap only as a deferral (OQ-1, §7.3, RSK-1). Appendix B claims
    the seeds are "inherited by name" without recording that the seed's Given is
    re-read as a declaration. The observable Assert is met, so this is a
    traceability-clarity gap, not a missing requirement.
    Suggested remediation target phase: specification
    Suggested fix: add one line to Appendix B recording the reinterpretation and
    citing OQ-1/RSK-1, so the reviewer of the delivered change can see the seed
    was narrowed deliberately.

11. [minor] system_spec_consistency — spec §8.1/§16 vs plan Phase 4 obligation 4.7
    Gap: the spec says the MCP `gate-report` tool "inherits the additive report
    fields and the new error identity through the shared engine", but nothing
    pins the *shipped* MCP composition: the plan only adds an optional seam on
    `GateReportToolRuntime`, and `packages/mcp/src/serve.ts` `buildGateRuntime`
    supplies no map (it also supplies no gate set). TC-SCITE-004 injects the
    override, so an inert mirror and a live mirror both pass. (Impact is bounded:
    the shipped MCP composition injects every provider read as
    `credential-unavailable`, so it cannot reach `overall: pass` today.)
    Suggested remediation target phase: specification
    Suggested fix: state the intended MCP composition posture in §8.1/§16 (inert
    with the shipped composition or fed by the same resolved snapshot as the CLI)
    and, if live, add it to Phase 5's composition obligation.

## Hazards flagged by the plan

- **P-3 (`.delivery-os/` excluded) — adequately handled.** Verified: the shared
  repository `.git/info/exclude` really does list `.delivery-os/`, while
  `.gitignore` only excludes `.*/config.local.yaml`. Phase 5 obligation 5.2 pins
  the forced add plus the `git ls-files --error-unmatch .delivery-os/config.yaml`
  boundary assertion, and escalates it as a trigger. No finding.
- **P-1 (unreadable-config silence) — not resolved.** Findings 1 and 2 above: the
  plan's fail-open answer both contradicts an owned AC and leaves the
  security-relevant posture unpinned in the authoritative artifact.

## Verified delivered-fact claims (no finding)

Spot-checked against the tree and found accurate: 48 corpus cases; CI job
`ts-aggregate` with display name `TS aggregate check` running `pnpm check`
(eight-suite breadth is a defensible reading of `pnpm check`); the six delivered
`VERIFY_GATES_*` bounds reused by DM-3 (120 / 8 / 6 / 4096); `CommandResultDetail`
= `{ holder? }` with `COMMAND_FAILURE_DETAIL_MAX_CHARS = 128`; `verify` kind = 6
identities with 2 `verify gates` rows and the live error-table count at 135; the
config-shaped summary/hint suppression in `failureOutcome`; the delivered header
formula in `renderVerifyGatesFailureSummary`; `fallback.invocation` for a third
positional and an unknown flag; the diagnostic (and therefore the future `cause:`
line) reaching stderr in every mode including `--json`; the derived cause-line
bounds (134 / 545) arithmetic; the `readGateSet` seam shape the plan extends.

## Next step

Reopen `specification` for findings 2, 3, 5, 7, 10, 11 (findings 3 and 5 also
imply one test-plan case and one plan obligation each), then `test_planning` for
finding 6, then `delivery_planning` for findings 1, 4, 8, 9. Re-run this gate
(iteration 2) after the revisions. Delivery must not start from this verdict.
