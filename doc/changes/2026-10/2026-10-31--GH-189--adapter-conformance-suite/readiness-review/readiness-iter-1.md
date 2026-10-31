# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-189
Date: 2026-10-31
Pause Required: no

## Scope of this review

Reviewed adversarially against the live ticket (`gh issue view 189 -R juliusz-cwiakalski/agentic-delivery-os`), the live repository at `feat/GH-189/adapter-conformance-suite` (`958986e`), and the following artifacts:

- `chg-GH-189-spec.md` (v1.0)
- `chg-GH-189-test-plan.md` (v1.0)
- `chg-GH-189-plan.md` (v1.1)
- `chg-GH-189-pm-notes.yaml`

Live mechanisms verified while reviewing (not re-reviewed as code): `packages/testkit/package.json` and `src/index.ts`; `packages/adapters/package.json` and `src/{github,gitlab,jira}/{client,capabilities,normalize}.ts`; `packages/adapters/src/io/provider-transport.ts`; `packages/adapters/src/credentials/index.ts`; `packages/core/src/contracts/{adapter-capabilities,credentials,ports}.ts`; `tests/structure/{inventory.json,content-inventory.test.ts}`; `tests/checks/{fixture-sanitization,secret-read-boundary,ci-checks,provider-hermetic}.test.ts`; `tests/structure/legacy-confinement.test.ts`; `tests/boundaries/{harness.ts,fixtures/cases.ts}`; `scripts/checks/{secret-read-boundary,workspace-entrypoints,ci-topology,ambient-globals,privacy-literals,forbidden-literals}.ts`; `.dependency-cruiser.cjs`; `.github/workflows/{ci,release,pr-base-guard}.yml`; `.changeset/config.json`; `bunfig.toml`; `.bun-version`; root `package.json`.

Prior readiness records: none (iteration 1).

## Facet Summary

| Facet | Result | Basis |
|---|---|---|
| spec_completeness | FAIL | The `not-configured` definition in spec §22 / DEC-12 is not faithful to how GitHub Actions materialises unset repository variables/secrets. |
| ac_quality | PASS | All 22 ACs are Given/When/Then, reference F-/DM-/NFR- ids, and are mechanically testable once "configured" is defined (see B-1). |
| plan_coverage | PASS | 22/22 ACs and 33/33 TCs are mapped to phases/tasks; every phase lists code areas and tests. |
| test_traceability | FAIL | TC-CONF-021 does not test the real workflow environment (present-but-empty keys); TC-CONF-026 does not prove the uploaded path equals the written path; TC-CONF-003 scan rule is underspecified. |
| cross_artifact_consistency | FAIL | Jira live-setting count differs between test plan and spec/plan; artifact-shape wording differs between spec §24, plan D-9, and TC-CONF-018. |
| decision_capture | PASS | DEC-1..DEC-15 and plan D-1..D-15 capture the material decisions and OQs; no unresolved product question blocks delivery. |
| system_spec_consistency | FAIL | Spec §22 "presence by name only" conflicts with the live workflow's empty-string env; spec §2.1/DEC-15 overstate the "ci.yml only" scanner scope; spec §24 omits `skipKind` added by plan D-9. |
| plan_doc_update_coverage | PASS | Plan P8.3 names the new feature spec and all system-doc updates + doc-distribution guard. |
| plan_code_area_coverage | PASS | Each phase lists new/updated files and modules; test-only and live files are explicitly placed. |
| dod_defined | PASS | Spec §18 defines testable DoD predicates, including CI evidence, docs, changeset, and the PR handoff. |

## Ticket AC coverage

The three ticket ACs are traced in spec §24, test plan §3.1, and plan "Ticket-AC trace":

- **Ticket AC-1 — the suite runs green on mocks in CI for every shipped adapter.** Covered by AC-F6-1/AC-F1-1/AC-F2-1/AC-F3-2/AC-F4-1/AC-F5-1 and TC-CONF-006/007/008/009/033. The boundary "every shipped adapter" is DEC-1 (GitHub/GitLab/Jira only; placeholders excluded) and is consistent with the live contracts. The mock suite rides `pnpm test`, which `ts-test` and `ts-aggregate` both run. **Strong**: declared-gap skips are exact and capability gates fail closed.
- **Ticket AC-2 — a scheduled live run records a result artifact.** Covered by AC-F7-1/F7-2/F7-3/F7-4/F8-1 and TC-CONF-020/021/022/026. **At risk**: B-1 means a real no-tenant scheduled run can be classified as configured and fail instead of `not-configured`/exit 0; finding 3 means the upload step can be green with no artifact. The AC is not yet mechanically proven against the actual workflow environment.
- **Ticket AC-3 — an adapter change that breaks a flow fails CI.** Covered by AC-F6-2/AC-F2-2/AC-F5-2/AC-F10-1 and TC-CONF-010/011/014/016/032. The mock suite runs in the existing test jobs, the broken-adapter control proves localization by provider/flow/step, and `ci.yml` stays byte-unchanged. **Strong**.

All 22 spec ACs have at least one TC; no AC is marked untestable. The gaps below are mechanism/consistency gaps, not missing ACs.

## Findings

Severity labels use the requested BLOCKING / ADVISORY / NIT classification with the DoR severity in parentheses.

### BLOCKING

1. **[BLOCKING / critical] cross_artifact_consistency + system_spec_consistency + test_traceability** — `chg-GH-189-spec.md` §22 (lines 423–431), DEC-12 (line 323); `chg-GH-189-plan.md` D-6 (line 67), P5.3 (line 322); `chg-GH-189-test-plan.md` TC-CONF-021 (lines 809–825) and §6 (line 1193).
   **Gap:** The plan and spec define `not-configured` as "presence by name only" for non-secret settings and token source keys. The live workflow injects every setting/secret through `env: ${{ vars.X }}` / `${{ secrets.X }}`; when a repository variable or secret is unset, GitHub Actions evaluates the expression to an **empty string** and the environment key is **present**. A presence-by-name check therefore classifies all three providers as configured, the credential port resolves the empty source key as `config.credential.missing`, and a no-tenant scheduled run becomes `failed`/exit 1 instead of `not-configured`/exit 0. TC-CONF-021 only tests an "empty environment" whose keys are absent, and the spawned subprocess unsets the names; neither reproduces the real workflow shape. This directly violates AC-F7-2 and NFR-5 ("no false alarm") and would make the first scheduled run red before tenants exist.
   **Suggested remediation target phase:** specification (with test_planning and delivery_planning follow-ups).
   **Suggested fix:** Define "present" as a **non-empty** value for non-secret settings and token source keys (the token value itself is never exposed/returned). Implement `readLiveConfig` to treat `undefined`, `""`, and whitespace-only as missing. Add a TC-CONF-021 case where all `CONFORMANCE_LIVE_*` keys are present but empty (the GitHub Actions representation) and assert `not-configured`, exit 0, and the 15-name missing list. Update spec §22/DEC-12 and plan D-6/P5.3 accordingly. Optionally also make the workflow omit unset keys, but the config-reader fix is the robust one.

2. **[BLOCKING / major] cross_artifact_consistency** — `chg-GH-189-test-plan.md` §6 (line 1193) and TC-CONF-021 precondition (line 812) vs `chg-GH-189-spec.md` §22 Jira row (line 429) and plan D-6 (line 67) / INCONSISTENCY-1 (line 81).
   **Gap:** The test plan says the Jira live names are "the Jira **three** settings plus token" (4 names); spec §22 defines two non-secret Jira settings (`CONFORMANCE_LIVE_JIRA_BASE_URL`, `CONFORMANCE_LIVE_JIRA_ISSUE_KEY`) plus the token (3 names); plan D-6 implements the spec's two settings and a 15-name missing list (7+5+3). The plan flags INCONSISTENCY-1 but deliberately leaves the test plan uncorrected. Test plan §10 evidence would therefore be written against a contradictory count, and an autonomous coder following the test plan could add a third Jira setting or assert 16 missing names.
   **Suggested remediation target phase:** test_planning.
   **Suggested fix:** Correct test plan §6 and TC-CONF-021 to "two Jira settings plus token"; state the expected 15-name missing list (GitHub 7, GitLab 5, Jira 3). No spec/plan change is needed; they already implement the spec's two settings.

### ADVISORY

3. **[ADVISORY / major] test_traceability + ac_quality (AC-F7-1, ticket AC-2)** — plan P6.1 (line 361), P6.2 (line 362); test plan TC-CONF-026 step 6 (line 967).
   **Gap:** The upload step is `if: always()` but the contract test and plan do not require `if-no-files-found: error`, and the plan/test plan do not explicitly assert that the entrypoint's `--out` path equals the upload `path`. With `actions/upload-artifact`'s default `warn`, a wrong path or a run that dies before writing produces a green upload step with no artifact. This is a "green but proves nothing" risk for ticket AC-2.
   **Suggested remediation target phase:** test_planning + delivery_planning.
   **Suggested fix:** Set `if-no-files-found: error` on the upload; assert the live step's `--out` argument equals the upload `path` (resolving `$RUNNER_TEMP`/`${{ runner.temp }}` consistently); add a TC-CONF-027 mutation control for a wrong `--out`/missing file/`if-no-files-found: warn`.

4. **[ADVISORY / major] plan_coverage + feasibility** — plan P3.1 (line 242) and P3.4 (line 245); test plan TC-CONF-010 step 4 (line 498) and TC-CONF-013 (lines 576–592).
   **Gap:** The runner specification only describes read dispatch (`read-work-item`, `read-delivery-request`, `read-pipeline-run`) and reserves a "carrier-roundtrip handler" for controls. But TC-CONF-010 step 4 / TC-CONF-013 define a control that **supports `write-comment`**; that capability also makes `change-lifecycle.comment` a supported step. Without a test-only write/roundtrip handler or an explicit rule, the control either has no dispatch for that step or fails the runtime "supported operation executed" gate. The plan does not specify the handler or the outcome for `change-lifecycle.comment` on controls.
   **Suggested remediation target phase:** delivery_planning.
   **Suggested fix:** Add an optional test-only write/roundtrip handler to the registration type and runner dispatch (never exported from the production registry), or explicitly scope the control's supported operations so only the carrier step is supported and the non-carrier `write-comment` step is a declared/covered skip. Assert the `change-lifecycle.comment` outcome in TC-CONF-013.

5. **[ADVISORY / major] test_traceability + plan_code_area_coverage** — test plan TC-CONF-003 (lines 271–299) and plan P2.6 (line 209).
   **Gap:** `packages/adapters/src/{github,gitlab,jira}/capabilities.ts` declare `export const *_ADAPTER_CONTRACT` while each subpath `index.ts` re-exports the same symbol. A naive scan for "exported `*_ADAPTER_CONTRACT` bindings" finds six occurrences, not three. The plan/test plan assert "exactly three" without specifying whether the scan matches declarations only, re-exports, or dedupes by adapter directory.
   **Suggested remediation target phase:** delivery_planning (test_planning clarification).
   **Suggested fix:** Specify that the scan matches `export const *_ADAPTER_CONTRACT` declarations (or dedupes by adapter name) and asserts exactly three; add a negative control proving an `index.ts`-only re-export does not count and a new `capabilities.ts` declaration does.

6. **[ADVISORY / major] cross_artifact_consistency + system_spec_consistency** — spec §24 normative shape (line 484), plan D-9 (line 70), test plan TC-CONF-018 step 2 (line 728).
   **Gap:** Plan D-9 adds `skipKind` to step results and defines `providers[].flows` as summaries while top-level `flows[]` carry nested `steps[]`. Spec §24's "normative fields" list does not mention `skipKind`, and TC-CONF-018 step 2's "each flow entry has ... steps" is ambiguous between provider-flow summaries and top-level flow results.
   **Suggested remediation target phase:** specification (test_planning follow-up).
   **Suggested fix:** Add `skipKind` and the provider-flow-summary distinction to spec §24, or remove `skipKind` and derive the skip distinction from `status`/`skipReason`; make TC-CONF-018 explicit about which `flows[]` carries `steps[]`.

7. **[ADVISORY / major] plan_doc_update_coverage + system_spec_consistency (CI gates)** — plan P8.1 (line 439), P8.2/P8.3 (lines 440–441); test plan TC-CONF-017/TC-CONF-019 canary requirements (lines 694–702, 752–760), TC-CONF-033 (line 1177).
   **Gap:** The final battery runs `pnpm check` and `license-audit`, but not `bun run scripts/checks/privacy-literals.ts` (wired into `ts-invariants`) or `forbidden-literals` (wired into `ts-forbidden-literals`). The new conformance tests require token/bearer/email/avatar canary shapes; if committed as literals outside the allowlisted fixture roots, `privacy-literals` fails CI. The new `doc/spec/features/feature-adapter-conformance.md` is scanned case-insensitively for `ados` by `ts-forbidden-literals`. The plan does not say where canaries live or add these guards.
   **Suggested remediation target phase:** delivery_planning.
   **Suggested fix:** Reuse `tests/fixtures/providers/sanitization/cases.ts` and/or the allowlisted `tests/fixtures/privacy-literals/` root for canary shapes (or add a narrowly scoped allowlist entry), keep the new doc free of `ados`/`ADOS`, and add `bun run scripts/checks/privacy-literals.ts` and `bun run scripts/checks/forbidden-literals.ts` to the P8 battery.

8. **[ADVISORY / minor] system_spec_consistency** — spec §14 OQ-3 (line 306), DEC-15 (line 326), plan DEC-15 summary (line 42).
   **Gap:** The claim "the existing CI scanners stay scoped to `ci.yml` in this change" is inaccurate. `tests/structure/legacy-confinement.test.ts` scans every `.github/workflows/*.yml` for `ADOS_` and the owner override variable, so the new workflow is inside an existing invariant's scope. The plan's P6 battery does not run `bun test tests/structure`.
   **Suggested remediation target phase:** specification (delivery_planning follow-up).
   **Suggested fix:** Narrow the claim to "`ci-supply-chain`/`ci-bindingness` stay `ci.yml`-scoped; repository-wide structure invariants still apply", and add `bun test tests/structure` (or at least `bun test tests/structure/legacy-confinement.test.ts`) to P6/P8.

### NIT

9. **[NIT / minor] cross_artifact_consistency** — plan EDITORIAL-1 (line 82).
   **Gap:** It claims the TC-CONF-001 heading is duplicated at the start of test plan §5.2. The current test plan has exactly one `#### TC-CONF-001` heading (line 212) and 33 TC headings total. The note is stale.
   **Suggested remediation target phase:** delivery_planning.
   **Suggested fix:** Remove/refresh EDITORIAL-1, or re-verify it against the current test plan.

10. **[NIT / minor] cross_artifact_consistency** — test plan §1.2 (line 42).
    **Gap:** It says "The implementation plan is absent at authoring time"; the plan now exists (v1.1) and reconciles file locations/commands.
    **Suggested remediation target phase:** test_planning.
    **Suggested fix:** Update the stale note or remove it in the test-plan revision.

11. **[NIT / minor] cross_artifact_consistency** — `chg-GH-189-pm-notes.yaml` notes.
    **Gap:** It records "issue GH-189 OPEN, no labels" and "worktree clean at origin/main-tools tip (b31ec47)". The live ticket has `change` and `planning` labels, and the branch now carries the spec/test-plan/plan commits with `chg-GH-189-pm-notes.yaml` modified. The state note is stale.
    **Suggested remediation target phase:** test_planning (or PM note refresh; no artifact phase owner defined for notes).
    **Suggested fix:** Refresh the state note or timestamp it as a clarify-scope snapshot.

12. **[NIT / minor] plan_coverage** — plan P3.4 (line 245) vs P4.1 (line 282).
    **Gap:** P3.4 says "Extend `tests/conformance/mock-conformance.test.ts`", but that file is not created until P4.1 ("Complete"). The phase wording is confusing for an autonomous coder.
    **Suggested remediation target phase:** delivery_planning.
    **Suggested fix:** Use "create" in P3.4 (runner/coverage controls) and "extend/complete" in P4.1, or move the file creation to P3.4.

## Reopened phase(s) and minimal remediation set

Because the verdict is NOT_READY, delivery is blocked. The following phases must reopen:

- **specification**
  - Define `not-configured` presence as non-empty for settings and token source keys (B-1).
  - Add `skipKind`/provider-flow-summary to §24 or remove `skipKind` (finding 6).
  - Narrow the "scanners stay `ci.yml`-scoped" claim (finding 8).
- **test_planning**
  - Correct the Jira live-setting count and TC-CONF-021 precondition (B-2).
  - Add the present-but-empty environment case and the 15-name missing list (B-1).
  - Harden TC-CONF-026: `--out` == upload path, `if-no-files-found: error`, mutation control (finding 3).
  - Specify the TC-CONF-003 scan rule (finding 5).
  - Align TC-CONF-018 with the artifact shape (finding 6).
  - Remove the stale "plan absent" note (finding 10).
- **delivery_planning**
  - Update D-6/P5.3 for non-empty presence (B-1).
  - Update P6.1/P6.2 for the upload hardening (finding 3).
  - Specify the test-only write/roundtrip handler for controls (finding 4).
  - Specify the registration scan dedupe rule (finding 5).
  - Add `privacy-literals`/`forbidden-literals` and `bun test tests/structure` to the gate battery (findings 7 and 8).
  - Remove/refresh EDITORIAL-1 and fix the P3.4/P4.1 wording (findings 9 and 12).

**Minimal blocking fix (if the PM wants the smallest path to READY):** correct the test-plan Jira count (B-2) and resolve the `not-configured` empty-string semantics across spec/test-plan/plan (B-1). The advisory items should be folded into the same revision pass because they are cheap and they harden the ticket AC-2 evidence.

## Notes on specific adversarial questions

- **AC testability / non-vacuity:** The 22 ACs are generally mapped to negative controls, exact skip reasons, runtime coverage, and a broken-adapter control. The two weak spots are the real-workflow `not-configured` path (B-1) and the artifact-upload proof (finding 3). No silent-skip-as-green path was found in the mock tier: `skipped` is distinct from `executed`, `capability-absent` is a skip kind, and runtime coverage requires every supported operation to execute.
- **Consistency:** Paths, TC ids (33/33), operation matrix, step matrix (12 steps), and skip reasons match the live contracts. The Jira live-setting count and the artifact-shape wording are the only material cross-artifact discrepancies.
- **Feasibility against live code:** Verified `@delivery-os/adapters/io` is not a declared subpath; deriving transport types from `GithubClientOptions["transport"]` / `GitLabClientOptions["transport"]` / `JiraClientOptions["transport"]` is type-feasible. Verified `WorkItem.comments` is optional; GitHub leaves it absent, Jira adds it only when the container exists. Verified Jira/GitLab/GitHub client option shapes and exact request URLs. Verified `createProcessCredentialPort` exists. Verified content-inventory allows types-only files without an allowance and forbids classes in allowed files. Verified `bun test` discovery excludes `run-live.ts`.
- **Scope/honesty:** The read-only v1 boundary, capability-gated skips, live evidence-only stance, no auto-ticket, no core/adapters production changes, no new `ci.yml` job, and exactly-four secret-read allowlist are all represented and consistent with the live repo.
- **Missing decision/mechanism:** The two mechanisms that need a decision before an autonomous coder can safely proceed are the empty-string `not-configured` semantics (B-1) and the control write dispatch (finding 4). The former is blocking; the latter is a mechanism gap that should be settled in the plan.

## Artifact provenance

This review wrote only this file. The spec, test plan, plan, and PM notes were read-only. No source code, workflow, fixture, or package file was modified. No git operations were performed.
