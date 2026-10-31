# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-189
Date: 2026-10-31
Pause Required: no

## Scope of this review

Re-reviewed adversarially against the live ticket (`gh issue view 189 -R juliusz-cwiakalski/agentic-delivery-os`), the live repository at `feat/GH-189/adapter-conformance-suite` (`396cd7c`), and:

- `chg-GH-189-spec.md` (v1.1)
- `chg-GH-189-test-plan.md` (v1.1)
- `chg-GH-189-plan.md` (v1.2)
- `chg-GH-189-pm-notes.yaml`
- prior record `readiness-review/readiness-iter-1.md`

Live mechanisms verified while reviewing (not re-reviewed as code): `packages/testkit/{package.json,src/index.ts}`; `packages/adapters/src/{github,gitlab,jira}/{client,capabilities,index}.ts`; `packages/adapters/src/credentials/index.ts`; `packages/core/src/contracts/{adapter-capabilities,credentials}.ts`; `tests/structure/{inventory.json,content-inventory.test.ts,legacy-confinement.test.ts}`; `tests/checks/{fixture-sanitization,ci-checks}.test.ts`; `tests/fixtures/providers/sanitization/{cases.ts,placeholders.json}`; `tests/fixtures/privacy-literals/**`; `scripts/checks/{forbidden-literals.ts,forbidden-literals.registry.json,privacy-literals.ts,privacy-literals.registry.json,ci-supply-chain.ts}`; `.github/workflows/{ci,release,pr-base-guard}.yml`; `.changeset/config.json`; `bunfig.toml`; root `package.json`.

## Facet Summary

| Facet | Result | Basis |
|---|---|---|
| spec_completeness | PASS | Every ticket requirement is represented: three flow families, three shipped adapters, mock CI tier, scheduled live tier, artifact, failure gating, honest scope boundaries. |
| ac_quality | FAIL | AC-F7-5 forbids reading anything but non-secret settings and credential reference names, while the B-1 occupancy rule requires inspecting the token source key value; AC-F2-3 collapses declared-gap and capability-absent skips into one outcome. |
| plan_coverage | PASS | 22/22 ACs and 33/33 TCs mapped to phases/tasks; 44 check-listable tasks; every phase lists code areas, tests, and exit criteria. |
| test_traceability | PASS | Full TC ↔ AC ↔ suite matrix; every AC has at least one TC; B-1 added absent, present-but-empty, whitespace-only, and per-provider occupancy cases; negative controls are specified. |
| cross_artifact_consistency | FAIL | AC-F7-5, spec §8.4/§21/§16 path map, and test-plan §6 still say "only non-secret settings" / "never reads token values", contradicting spec §22/DEC-12, plan D-6, and TC-CONF-021/024; plan D-9 adds `provider`/`flowId` to flat `steps[]` where spec §24/TC-CONF-018 do not; plan P3.4 attributes a `change-lifecycle.comment` assertion to TC-CONF-013 that the test plan does not define. |
| decision_capture | PASS | DEC-1..DEC-15 and plan D-1..D-15 capture the material change-scoped decisions; no unresolved product question blocks delivery; no precedent-setting decision is missing. |
| system_spec_consistency | PASS | Spec §2.1 now states the layered scanner scope (`ci-supply-chain`/`ci-bindingness` are `ci.yml`-scoped; repository-wide structure invariants scan every workflow); no contradiction with `feature-adapter-ports`, `feature-provider-client-seeds`, `feature-monorepo-scaffold-toolchain`, ADR-0003, or ADR-0005. |
| plan_doc_update_coverage | PASS | P8.3 names the new conformance feature spec, the three feature-spec updates, glossary/index, doc-distribution guard, forbidden-literals registration, and neutral wording. |
| plan_code_area_coverage | PASS | Every phase lists new/updated files and modules; protected paths (`packages/core/**`, `packages/adapters/**` production source, `ci.yml`, CI checks) are explicit. |
| dod_defined | PASS | Spec §18 defines testable DoD predicates (mock green in both jobs, live artifact in every status, gates firing, zero mutations, allowlist four, docs synchronized, `pnpm check`, `ci.yml` byte-unchanged, PR handoff). |

Verdict is `NOT_READY` because `ac_quality` and `cross_artifact_consistency` fail on a residual contradiction created by the B-1 remediation. The behavior is specified correctly in the decision log, plan, and tests; the acceptance criterion and three prose statements are not.

## Findings

### BLOCKING

1. **[BLOCKING / critical] cross_artifact_consistency + ac_quality** — `chg-GH-189-spec.md` AC-F7-5 (line 394), §8.4 (line 231), §21 (line 417), §16 path map (line 359), glossary (line 464); `chg-GH-189-test-plan.md` §6 Secrets (line 1207).
   **Gap:** B-1 now requires `readLiveConfig` to treat `undefined`, `""`, and whitespace-only token source keys as MISSING, so the config reader must inspect the token source key **value** (not merely its presence) to classify a provider. TC-CONF-021 steps 2–5 and TC-CONF-024 step 2 encode exactly that, and TC-CONF-021 step 5 requires zero credential-port lookups in the not-configured path, so occupancy must read the injected environment value directly. But AC-F7-5 says "only non-secret settings and credential reference names are read under `tests/`"; §8.4 says "The live entrypoint never reads token values"; §21 says "the live entrypoint reads only reference names"; the §16 path map says the config reader handles "non-secret names and credential reference names only"; and test-plan §6 says "the live entrypoint reads only non-secret settings and credential reference names". As written, AC-F7-5 is a contractual acceptance criterion that the required B-1 implementation violates. A DoD reviewer can legitimately fail the change on this, and an autonomous coder following §8.4 could regress to presence-only occupancy and fail TC-CONF-021. This is the one residual the B-1 remediation did not propagate.
   **Suggested remediation target phase:** specification (primary), test_planning (prose).
   **Suggested fix:** Amend AC-F7-5 to: "reads non-secret settings and credential reference names, and inspects each documented token source key only for non-empty occupancy without storing, returning, logging, or emitting its value; actual token material resolves only through the adapters `./credentials` credential port." Apply the same carve-out to §8.4, §21, §16 path map, the glossary entry for "Not-configured" (also include present-but-empty and whitespace-only), and test-plan §6 Secrets. Optionally add a TC-CONF-024 assertion that the config reader retains only an occupancy boolean, never the token value.

### ADVISORY

2. **[ADVISORY / major] cross_artifact_consistency** — plan D-9 (line 70) vs `chg-GH-189-spec.md` §24 (line 490) and test-plan TC-CONF-018 step 4 (line 734).
   **Gap:** B-1's artifact-shape agreement is nearly complete: spec §24, D-9, and TC-CONF-018 now agree on top-level `flows[]` with nested `steps[]`, provider-flow summaries without `steps`, and the closed `skipKind` set. However, D-9 says each flat top-level `steps[]` entry carries `provider` **and** `flowId` in addition to the listed fields, while spec §24's normative list and TC-CONF-018 step 4 do not include `provider`/`flowId`. A strict validator or a test that checks the exact field set would diverge from D-9.
   **Suggested remediation target phase:** specification (test_planning follow-up).
   **Suggested fix:** Add `provider` and `flowId` to the flat `steps[]` field list in spec §24 and to TC-CONF-018 step 4, or remove them from D-9. Pick one source of truth; do not leave the plan carrying fields the normative shape omits.

3. **[ADVISORY / major] test_traceability + plan_coverage** — test-plan TC-CONF-013 (lines 569–596) and TC-CONF-010 step 4 (line 502) vs plan P3.1 (line 241) and P3.4 (line 244).
   **Gap:** The plan now specifies the test-only write/roundtrip handler, the fail-closed rule for a supported non-read step with no handler, and the exact `change-lifecycle.comment` outcome on write-capable controls, and P3.4 says TC-CONF-013 asserts it. The test plan's TC-CONF-013 still only asserts the carrier-roundtrip step, the empty-carrier `no-declared-carrier` skip, and registry isolation; its preconditions do not mention the handler or the `change-lifecycle.comment` step. The plan attributes an assertion to a TC that does not define it, so the test plan alone is not sufficient to implement the control.
   **Suggested remediation target phase:** test_planning.
   **Suggested fix:** Add to TC-CONF-013 a precondition that both controls supply the test-only carrier-roundtrip/write handler, and a step asserting `change-lifecycle.comment` **executes** through that handler on both controls (satisfying `write-comment` coverage) while the carrier-roundtrip step executes only on the carrier-declaring control and records `no-declared-carrier` on the empty-carrier control. Mirror the precondition in TC-CONF-010 step 4.

4. **[ADVISORY / minor] test_traceability** — test-plan TC-CONF-027 step 5 (line 1013) and §7.3 non-vacuity list (line 1324); plan P6.2 (line 363).
   **Gap:** The mutation control "remove the artifact file (simulate a run that produces nothing) and assert the upload contract fails" is not mechanically executable by a static workflow-text validator: the test never runs GitHub Actions' upload step, and no artifact file exists at contract-test time. The real guarantees are `if-no-files-found: error` and the TC-CONF-020 writer proof; as written, this control is likely to be implemented vacuously or skipped.
   **Suggested remediation target phase:** test_planning.
   **Suggested fix:** Rephrase the control as a static assertion that a missing/empty `path` or an unresolvable `--out`/`path` pair fails `validateWorkflowRoot`, or drop the "remove the artifact file" clause and rely on `if-no-files-found: error` plus TC-CONF-020's "writer called in every status" proof. Keep the wrong-`--out` and `warn` controls.

5. **[ADVISORY / minor] ac_quality** — `chg-GH-189-spec.md` AC-F2-3 (line 380) vs F-2 (line 123), DM-8 (line 219), and TC-CONF-013 step 3 (line 589).
   **Gap:** AC-F2-3 says the carrier roundtrip "executes only for an adapter declaring carriers, otherwise it records a declared-gap skip". For a control whose `write-comment` is supported but both carrier arrays are empty, the required outcome is a `no-declared-carrier` **capability-absent** skip, not a declared-gap skip. The AC's "otherwise" branch is therefore false for the control branch that TC-CONF-013 proves.
   **Suggested remediation target phase:** specification.
   **Suggested fix:** Reword AC-F2-3 to "otherwise it records the matching declared-gap skip when `write-comment` is unsupported, or a `no-declared-carrier` capability-absent skip when `write-comment` is supported with no declared carrier, and the flow remains registered."

### NIT

6. **[NIT / minor] cross_artifact_consistency** — `chg-GH-189-test-plan.md` §1.2 (line 42).
   **Gap:** NIT 10's stale "plan absent" note is gone, but the replacement says the implementation plan "exists (v1.1)"; the plan is now v1.2. The test plan also references spec v1.1 correctly.
   **Suggested remediation target phase:** test_planning.
   **Suggested fix:** Say the plan "exists and is the authority" or update the version to v1.2.

7. **[NIT / minor] cross_artifact_consistency** — `chg-GH-189-spec.md` glossary (line 464).
   **Gap:** "Not-configured: The live status when the documented tenant settings are absent; exits 0 and never alarms" omits the present-but-empty and whitespace-only shapes that are now the core of B-1.
   **Suggested remediation target phase:** specification.
   **Suggested fix:** "The live status when the documented tenant settings are absent or present-but-empty/whitespace-only; exits 0 and never alarms." This folds naturally into the blocking wording pass.

## Iteration-1 finding resolution

| ID | Prior class | Status | Verification |
|---|---|---|---|
| B-1 | BLOCKING / critical | **Partially resolved — residual blocking** | Non-empty (non-whitespace) occupancy is in spec §22/DEC-12, plan D-6/P5.3/P5.8, and test-plan TC-CONF-021/022/024; present-but-empty (GitHub Actions shape), whitespace-only, and per-provider occupancy cases are present; the 15-name list is consistent at GitHub 7 / GitLab 5 / Jira 3; no current artifact says "presence only" (only the historical PM-note blocker and iter-1 record use that phrase). Credential-port exclusivity is stated in DEC-12/§22/plan. Residual: AC-F7-5 and three prose statements still forbid reading token values (finding 1). |
| B-2 | BLOCKING / major | **Resolved** | Spec §22 Jira row has two settings plus token; test-plan §6 and TC-CONF-021 state two settings plus token and the 15-name set; plan INCONSISTENCY-1 is explicitly resolved. No stale "Jira three settings" in the current spec/test plan/plan (only the historical PM-note blocker text). |
| 3 | ADVISORY / major | **Resolved** | TC-CONF-026 steps 6–7 require `if-no-files-found: error`, the `conformance-live` name, 90-day retention, and `--out` equality after normalizing `$RUNNER_TEMP`/`${{ runner.temp }}`/`${RUNNER_TEMP}`; TC-CONF-027 adds wrong-`--out` and `warn` controls; plan P6.1/P6.2 repeat the requirements. Live `ci.yml` SHA pins are reusable. Residual feasibility nit in finding 4. |
| 4 | ADVISORY / major | **Partially resolved** | Plan P3.1/P3.4 add the optional test-only handler, the fail-closed rule, and the exact `change-lifecycle.comment` outcome; plan P3.4 attributes it to TC-CONF-013. Test-plan TC-CONF-013 does not define that assertion or precondition (finding 3). |
| 5 | ADVISORY / major | **Resolved** | TC-CONF-003 now specifies declaration-only matching, per-adapter dedupe, the six-raw-occurrence fact, an `index.ts`-only re-export negative control, and a new `capabilities.ts` declaration control; plan P2.6 repeats it. Live tree confirms three declarations in `{github,gitlab,jira}/capabilities.ts` and three `index.ts` re-exports (six raw symbols). |
| 6 | ADVISORY / major | **Partially resolved** | Spec §24 now carries `skipKind` (closed set: `declared-gap`, `capability-absent`, `live-read-only`) and the provider-flow-summary vs canonical top-level `flows[]` distinction; D-9 and TC-CONF-018 steps 2–5 agree on those. Residual flat-step `provider`/`flowId` mismatch (finding 2). |
| 7 | ADVISORY / major | **Resolved** | Plan P8.1 adds `privacy-literals` and `forbidden-literals` to the P8 battery; P8.1/P4.2/P5.2 reuse the allowlisted canary roots (`tests/fixtures/providers/sanitization/cases.ts`, `tests/fixtures/privacy-literals/`); P8.3 registers the new feature spec in `forbidden-literals.registry.json` and keeps its body free of the case-insensitive seed literal. Live registries confirm both roots are allowlisted and the new-doc registration rule. |
| 8 | ADVISORY / minor | **Resolved** | Spec §2.1 now states the layered scanner scope; OQ-3 and DEC-15 narrow the claim to `ci-supply-chain`/`ci-bindingness` while preserving repository-wide structure invariants; plan P6.3 and P8.1/P8.2 add `bun test tests/structure`. Live `tests/structure/legacy-confinement.test.ts` scans every `.github/workflows/*.yml` for `ADOS_` and the override variable, so the new workflow is in scope as stated. |
| 9 | NIT / minor | **Resolved** | No `EDITORIAL-1` remains in the plan; the current test plan has one `TC-CONF-001` heading and 33 TC headings. |
| 10 | NIT / minor | **Partially resolved** | The stale "plan absent" note is removed and spec v1.1 + the plan-decided output path are recorded, but the note now says plan v1.1 while the plan is v1.2 (finding 6). |
| 11 | NIT / minor | **Resolved** | PM-notes state note now records the current labels (`change`, `planning`) and the branch contents, with the earlier clarify-scope snapshot retained as history. |
| 12 | NIT / minor | **Resolved** | P3.4 says **Create** `tests/conformance/mock-conformance.test.ts`; P4.1 says **Complete/extend** it. |

## Ticket AC coverage

- **Ticket AC-1 — mock suite green in CI for every shipped adapter.** Covered by AC-F6-1, AC-F1-1, AC-F2-1, AC-F3-2, AC-F4-1, AC-F5-1 and TC-CONF-006/007/008/009/033. GitHub, GitLab, and Jira are the live contracts; the mock suite rides `pnpm test`, which `ts-test` and `ts-aggregate` run; declared-gap skips are exact and capability-gated. **Strong.**
- **Ticket AC-2 — a scheduled live run records a result artifact.** Covered by AC-F7-1, AC-F7-2, AC-F7-3, AC-F7-4, AC-F8-1 and TC-CONF-020/021/022/026/027. Every terminal status writes and uploads a `delivery.conformance.v1` artifact; `not-configured` exits 0; `--out` equals the upload path; `if-no-files-found: error` prevents a green upload with no file; wrong-path/missing-file/warn controls exist. **Strong**, subject to the finding-1 wording fix on the adjacent AC-F7-5 boundary criterion and the finding-4 control-feasibility clarification.
- **Ticket AC-3 — an adapter change that breaks a flow fails CI.** Covered by AC-F6-2, AC-F2-2, AC-F5-2, AC-F10-1 and TC-CONF-010/011/014/016/032. The mock suite is in the existing test path; structural/runtime coverage and the broken-adapter control fail by provider/flow/step/operation; `ci.yml` stays byte-unchanged and the topology/bindingness/supply-chain checks stay green. **Strong.**

All 22 spec ACs have at least one TC and a traceability row; no AC is marked untestable. The only AC that is **not satisfiable as written** is AC-F7-5, because it contradicts the B-1 occupancy behavior required by TC-CONF-021/024 (finding 1). The three ticket ACs are otherwise fully traced in spec §24, test-plan §3.1/§7.1, and plan "AC → task traceability".

## Testability, non-vacuity, scope honesty, and feasibility

- **Testability / non-vacuity:** 22/22 spec ACs and 3/3 ticket ACs are mapped. The B-1 tests are non-vacuous (absent, present-but-empty, whitespace-only, per-provider blanking; zero credential lookups and zero requests). The broken-adapter control, coverage mutations, registration scan, artifact bounds/redaction, workflow mutations, fixture failures, inventory failures, and boundary failures all have named negative controls. The remaining vacuity risks are the TC-CONF-013 handler assertion (finding 3) and the TC-CONF-027 missing-file control (finding 4), not the AC set.
- **Scope honesty:** Read-only v1, write create/teardown deferred to M1-S4, no auto-ticket, no core/adapters production change, no new package/subpath/dependency, no new `ci.yml` job, exactly four secret-read allowlist entries, fixtures inside the audited provider root. This is consistent with ADR-0003 and the ticket's "strict teardown" wording, which v1 proves as zero mutation requests / zero created artifacts. No hidden scope expansion found.
- **Feasibility:** Verified live: GitHub 3 reads + 4 declared gaps; GitLab 2 reads + 5 gaps; Jira 1 read + 6 gaps; all carrier arrays empty; three `*_ADAPTER_CONTRACT` declarations plus three subpath re-exports; `@delivery-os/adapters/io` is not a testkit import edge, so deriving transport types from client option types is required and feasible; `createProcessCredentialPort` resolves literal references verbatim, so the token source-key names work; fixture sanitization allows `*.example.com` and requires top-level `provenance`; `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES` accept the planned files/allowances; `.changeset/config.json` has the five-package fixed group; `ci.yml` carries the reusable 40-hex pins; `yaml` is available at the root; `bun test` discovery excludes `run-live.ts`; `tests/structure/legacy-confinement.test.ts` scans every workflow. No new feasibility blocker found.

## Reopened phases and minimal remediation

Because the verdict is `NOT_READY`, delivery remains blocked. Reopen:

- **specification**
  - Amend AC-F7-5 and the matching prose (§8.4, §21, §16 path map, glossary) to permit token source-key occupancy inspection without storing/returning/logging/emitting the value, with authorization only through the credential port. This is the minimal blocking fix.
  - Optionally align AC-F2-3 with the declared-gap vs capability-absent distinction and add `provider`/`flowId` to §24's flat `steps[]` (or remove them from D-9).
- **test_planning**
  - Align §6 Secrets with the occupancy carve-out and update §1.2's plan version.
  - Add the TC-CONF-013 handler precondition and `change-lifecycle.comment` executed-outcome step (mirroring TC-CONF-010 step 4).
  - Clarify or drop the TC-CONF-027 "remove the artifact file" static control.
- **delivery_planning**
  - Only if the D-9 side is changed instead of §24: remove `provider`/`flowId` from D-9. No blocking reopen is required on the current evidence.

**Minimal blocking fix:** one specification wording pass (AC-F7-5 + §8.4 + §21 + §16 path map + glossary) and one test-plan prose pass (§6 + §1.2 + TC-CONF-013). No behavior change, no new test is required: TC-CONF-021/024 already encode the correct behavior. Re-run this gate after the edits.

## Artifact provenance

This review wrote only this file. The spec, test plan, plan, and PM notes were read-only. No source code, workflow, fixture, package, or check file was modified. No git operations were performed.
