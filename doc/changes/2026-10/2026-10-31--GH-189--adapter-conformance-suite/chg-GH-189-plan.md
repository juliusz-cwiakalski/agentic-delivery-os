---
id: chg-GH-189-adapter-conformance-suite
status: Proposed
created: 2026-10-31T19:40:00Z
last_updated: 2026-10-31T21:30:00Z
owners: [engineering]
service: delivery-os provider adapters
labels: [change, planning]
links:
  change_spec: ./chg-GH-189-spec.md
  test_plan: ./chg-GH-189-test-plan.md
  pm_notes: ./chg-GH-189-pm-notes.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  typescript_rules: ../../../../.ai/rules/typescript.md
  adr_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
    - ../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md
  related_changes:
    - ../2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-plan.md
summary: >
  Deliver the provider-agnostic adapter conformance suite in the private
  testkit package: one three-flow registry over all seven closed
  ADAPTER_OPERATIONS, capability-gated execution for GitHub, GitLab, and Jira
  with explicit declared-gap skips, deterministic exact-URL mock tenants under
  the audited provider fixture root, structural and runtime coverage gates, a
  deliberately broken adapter control, the delivery.conformance.v1 artifact
  schema and validator, and a read-only scheduled live-evidence workflow whose
  artifact records passed/failed/not-configured and zero mutations. Mock
  conformance rides the existing pnpm test path and the existing ts-test /
  ts-aggregate jobs; ci.yml is byte-unchanged.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-189: M0-S20: Adapter conformance suite v1

## Context and Goals

Implement the completed specification (v1.2: F-1–F-10, DM-1–DM-8, NFR-1–NFR-9, DEC-1–DEC-15, 22 ACs in §17, §18 DoD predicates, §22 live variable names and non-empty occupancy, §24 operation matrix and artifact shape including `provider`/`flowId` on the flat `steps[]` and the closed `skipKind` set) and the completed test plan (v1.2: 33 TCs, TC-CONF-001..033, §5.2 occupancy and workflow hardening, §7.1 traceability matrix, §7.2 gate handoff, plus the TC-CONF-013 no-handler fail-closed control and the TC-CONF-027 static upload-`path` controls). Both are committed; this plan derives every task, path, command, and gate from them and adds no requirement. Execution belongs on `feat/GH-189/adapter-conformance-suite`; the PR targets `main-tools`.

**What this change delivers.** A single conformance flow registry in `@delivery-os/testkit` covering `change-lifecycle`, `comment-provenance`, and `label-semantics`; a conformance adapter registry for the three shipped read-slice contracts; declarative mock tenants with exact-URL replay; capability-gated execution and structural/runtime coverage gates; a `delivery.conformance.v1` artifact; a scheduled read-only live tier; and a broken-adapter control that proves the suite is non-vacuous.

**Settled inputs — this plan does NOT re-decide them.** DEC-1 (adapter scope = real provider `AdapterContract`s only; structural registration gate), DEC-2 (capability-gated execution with explicit declared-gap skips), DEC-3 (mock suite inside `pnpm test`; no `ci.yml` job), DEC-4/DEC-10 (live tier is read-only evidence, `passed`/`failed`/`not-configured`, exit 1 only on `failed`, zero mutations), DEC-5 (no automatic tracker ticket), DEC-6 (carrier step executes only when carriers are declared), DEC-7 (no GitHub `state_reason` modelling), DEC-8 (live configuration under `tests/`; tokens only through the credential port), DEC-9 (exactly three flows covering seven operations), DEC-11 (weekly Monday 05:17 UTC plus `workflow_dispatch`, no PR trigger, SHA pins, `if: always()` upload), DEC-12 (`not-configured` requires every non-secret setting and the token source key to be present **and non-empty (non-whitespace)**; the present-but-empty GitHub Actions no-tenant shape is `not-configured`), DEC-13 (one artifact contract for both tiers), DEC-14 (fixtures under `tests/fixtures/providers/conformance/**`), DEC-15 (the new workflow-contract test is the dedicated enforcement; `ci-supply-chain` and `ci-bindingness` stay `ci.yml`-scoped, while repository-wide structure invariants such as `tests/structure/legacy-confinement.test.ts` still scan every `.github/workflows/*.yml`).

**Code-reality facts this plan relies on (verified 2026-10-31).**

- `packages/testkit` has a single `.` export and `workspaceImports` admitting `@delivery-os/core` (`.` and `./contracts`) and every declared adapters subpath. **`@delivery-os/adapters/io` is NOT declared**, so testkit must derive transport/request/response types from the exported client option types (for example `GithubClientOptions["transport"]`) instead of importing the I/O subpath. No manifest edge changes.
- The three contracts are `GITHUB_ADAPTER_CONTRACT`, `GITLAB_ADAPTER_CONTRACT`, `JIRA_ADAPTER_CONTRACT` in `packages/adapters/src/{github,gitlab,jira}/capabilities.ts`, re-exported by each subpath `index.ts`. Client factories `createGitHubClient`, `createGitLabClient`, `createJiraClient` accept `{ instance, credentials, transport }` plus provider addressing (GitHub `repository`, GitLab `projectPath`).
- `ProviderTransport` is `{ send(request) }`; `ProviderRequest.method` is typed `"GET"` only, so the live non-`GET` guard is a pure function over a widened `{ method: string; url: string }` record and its negative control feeds a synthetic `POST` directly.
- Exact request URLs the mock tenants must fixturize: GitHub `/repos/{owner}/{repo}/issues/{n}`, `/repos/{owner}/{repo}/pulls/{n}`, `/repos/{owner}/{repo}/commits/{sha}/check-runs?per_page=20`; GitLab `/api/v4/projects/{urlEncodedProjectPath}/merge_requests/{iid}`, `/api/v4/projects/{urlEncodedProjectPath}/pipelines?sha={sha}`; Jira `/rest/api/2/issue/{issueKey}`.
- `github` normalization maps `open → ready` and `closed → done`; Jira maps through `JIRA_WORKFLOW_MAP` (`To Do`, `In Progress`, `In Review`, `Done`, …); GitLab review state resolves through its merge-status table. Identity `systemName` is the tenant `instance.instanceName`.
- `runtime-apis-confinement` has no testkit allowance; `testkit-no-surface-import` forbids CLI/MCP/OpenCode; `testkit-no-production-import` forbids production code importing testkit; `tests/structure/inventory.json` currently lists two testkit files and `tests/structure/content-inventory.test.ts` allows only `assertEnvelopeContract`, `RULES`, `loadGoldenCases` for `testkit/src/result-conformance.ts`.
- `content-inventory` permits only type/interface/import/export declarations plus function declarations and variable statements in an allowed file; an exported function or exported const whose name is not in the file's allowance fails; internal (non-exported) helpers are allowed. Classes and other top-level executable statements are not representable in an allowed file.
- `scripts/checks/secret-read-boundary.ts` holds exactly four allowlist entries and scans every `packages/*/src/**`. `tests/checks/fixture-sanitization.test.ts` scans every JSON under `tests/fixtures/providers/**` except `sanitization/`, requires a top-level `provenance` string, example/reserved hosts, declared placeholders, and fails **stale** placeholders.
- `tests/checks/ci-checks.test.ts` pins `TS_JOBS`/`BASH_JOBS` and the pin-equality over exactly four copies (`.bun-version`, `package.json` `engines.bun`, `ci.yml`, `release.yml`); `ci-supply-chain` and `ci-bindingness` read only `.github/workflows/ci.yml`. A new workflow therefore does not disturb them, and it must use `bun-version-file: .bun-version` rather than a fifth literal copy.
- `tests/boundaries` materialises fixture workspaces from the production `.dependency-cruiser.cjs` and registers every rule case in `tests/boundaries/fixture-registry.json`; the meta-check fails an unregistered fixture or an unenforced rule.
- `pretest`/`pretypecheck` run `pnpm build`; `pnpm test` = `bun test` over `tests/**/*.test.ts`; `pnpm check` = lint → format:check → typecheck → test → check:boundaries → exports-parity. A bare `bun test` after a source change needs a prior `pnpm build` because tests import `@delivery-os/testkit` and adapters through their `exports` → `dist`.

### Decision register (test-plan §8.3 OQs and plan-owned integration details)

| ID | Decision |
|----|----------|
| D-1 (OQ-A) | **Artifact caps.** `CONFORMANCE_LIMITS` exports finite positive integers: `maxProviders: 16`, `maxFlows: 16`, `maxStepsPerFlow: 64`, `maxTotalSteps: 512`, `maxMissingSettingsPerProvider: 16`, `maxFailureDetailChars: 1024`, `maxArtifactBytes: 262144`. The validator rejects over-cap counts naming the cap and the observed count; the serializer truncates free-text detail at `maxFailureDetailChars` with a visible `…[truncated]` marker; the serialized artifact must stay ≤ 256 KiB. Current v1 usage (3 providers / 3 flows / 12 steps) sits far below every cap, and the caps leave room for a new provider without a schema change. Recorded in `doc/spec/features/feature-adapter-conformance.md` at P8. |
| D-2 (OQ-B) | **Live output path.** `tests/conformance/live/run-live.ts` accepts `--out PATH`; without it the default is `conformance-live.json` in the process working directory. The workflow always passes `--out "$RUNNER_TEMP/conformance-live.json"` and uploads that exact path. No environment-based output variable is introduced (one spelling, one source of truth). |
| D-3 (OQ-C) | **Provider status enum.** `CONFORMANCE_PROVIDER_STATUSES = ["passed", "failed", "not-configured"]`; the overall `CONFORMANCE_STATUSES` is the same three-value closed set. There is no provider-level `skipped` status. The validator rejects any value outside the set. |
| D-4 (OQ-D) | **Configured vs not-configured.** A provider is configured exactly when `status !== "not-configured"`. Only a `not-configured` provider carries a non-empty `missingSettings` list; a configured provider carries `missingSettings: []`. Overall status: `failed` if any configured provider failed; `not-configured` if every provider is `not-configured`; otherwise `passed`. No extra `configured` boolean is added, so the artifact keeps the §24 normative field set. |
| D-5 (OQ-E) | **Mock ≤ 60 s evidence.** Measured, not asserted: `pnpm build` then `/usr/bin/time -f '%e s' bun test tests/conformance/mock-conformance.test.ts` at P4 and P8, with the number recorded in the plan Execution Log and test-plan §10. The permanent suite asserts the structural causes (offline fixture transport, throwing-`fetch` zero calls, no sleeps, injected clock/run id) rather than a wall-clock threshold, so a slow runner cannot flake. The live ≤ 10 min bound is asserted structurally as the workflow `timeout-minutes: 10`. |
| D-6 | **Live configuration derivation (non-empty occupancy).** `tests/conformance/live/config.ts` reads an **injected** `Record<string, string | undefined>` (the wrapper passes `process.env`) and never stores, returns, logs, or emits a token value. Provider non-secret settings are the spec §22 names: GitHub six — `CONFORMANCE_LIVE_GITHUB_{BASE_URL,OWNER,REPO,ISSUE_NUMBER,PULL_NUMBER,COMMIT_SHA}`; GitLab four — `CONFORMANCE_LIVE_GITLAB_{BASE_URL,PROJECT_PATH,MR_IID,COMMIT_SHA}`; Jira two — `CONFORMANCE_LIVE_JIRA_{BASE_URL,ISSUE_KEY}`. Token **source keys** are `CONFORMANCE_LIVE_{GITHUB,GITLAB,JIRA}_TOKEN`, expressed as literal-style `CredentialReference`s. A provider is configured only when every one of its documented non-secret settings is present **and non-empty (non-whitespace)** and its token source key is present **and non-empty (non-whitespace)**; `undefined`, `""`, and whitespace-only values are MISSING. The reader may inspect the token source key only to test occupancy; it never stores, returns, logs, or emits the value. In a fully absent, present-but-empty (the real GitHub Actions no-tenant shape), or whitespace-only environment the reported missing-name list is exactly 15: GitHub 7 (six settings + token key) + GitLab 5 (four + token key) + Jira 3 (two + token key). Names only, never values. Actual authorization resolves exclusively through the adapters `./credentials` `CredentialPort`. |
| D-7 | **Workflow Bun resolution.** `.github/workflows/conformance-live.yml` uses `oven-sh/setup-bun` with `bun-version-file: .bun-version`; it contains no literal Bun version and is not added to the four-copy pin check. The workflow-contract test asserts the file input exists, `.bun-version` equals `1.4.4`, and no `bun-version:` literal appears. |
| D-8 | **`if: always()` scoping.** `if: always()` appears exactly once, on the artifact-upload step, so the artifact uploads after a failed live run while every run step keeps fail-fast semantics. No `continue-on-error`, no `|| true`, no `set +e`, and no `if: always()` on the entrypoint step. The contract test asserts both the presence on the upload step and the absence everywhere else. |
| D-9 | **Artifact shape (spec v1.2 §24).** `providers[].flows` is a list of **provider flow summaries** carrying exactly `flowId`, `name`, and `status`, with **no** `steps`. The canonical per-flow results live in top-level `flows[]`, each carrying `provider`, `flowId`, `name`, `status`, and ordered nested `steps[]`. Top-level `steps[]` is the flat index of the same step results, each carrying `provider`, `flowId`, `stepId`, `operation`, `status`, `skipReason`, `skipKind`, `assertionCount`, and optional `failure`. `skipKind` is a closed set: `declared-gap`, `capability-absent`, `live-read-only`; every skipped step carries one. The deliberate duplication is bounded (12 steps in v1, far below the 256 KiB cap) and lets both normative views validate from one report. This matches spec v1.2 §24 (provider-flow summaries, canonical top-level `flows[]` with nested `steps[]`, flat `steps[]` carrying `provider` and `flowId`, closed `skipKind`) and TC-CONF-018 steps 2–5. |
| D-10 | **Primitive projection normalization.** Each flow step declares an assertion family; the runner projects a client result to one primitive shape before comparison: `read-work-item → WorkItem`, `read-delivery-request → DeliveryRequest`, `read-pipeline-run → readonly PipelineRun[]` (GitHub wrapper `.items`, GitLab array). `tenant.expected[stepId]` holds exactly that shape, so expected data stays provider-agnostic. Comparison uses a canonical sorted-key serialization; live mode skips exact projection comparison and applies invariants only. |
| D-11 | **Redaction and bounds.** Failure `expected`/`received` values are scalars only (string/number/boolean) plus a primitive `path`; the serializer rejects non-scalar values there. Free-text failure `detail` is redacted for the sanitization shape families (bearer header, `ghp_`, `glpat-`, `ATATT`, PEM, email, avatar URL, `raw-provider-payload`) and truncated at the cap; the validator re-scans the serialized artifact and rejects any remaining forbidden shape. |
| D-12 | **Inventory/allowance cadence.** Every phase that adds a `packages/testkit/src/**` file updates `tests/structure/inventory.json` and that file's entry in `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` **in the same commit**, so each phase boundary keeps `bun test tests/structure/content-inventory.test.ts` green. P7 reconciles the whole set and proves no global switch exists. Allowance entries name only exported functions/consts; internal helpers stay unlisted and permitted. |
| D-13 | **Live read-only classification.** The read operations are the explicit closed subset `read-work-item`, `read-delivery-request`, `read-pipeline-run` (not a string-prefix heuristic). In live mode a step whose operation is in that subset and is supported executes; a supported non-read operation is recorded `skipped` with `skipKind: live-read-only` and never dispatches; an unsupported operation records its declared-gap skip. Mock mode executes every supported operation. Runtime coverage treats `live-read-only` deferrals as satisfying supported-operation coverage only in live mode. |
| D-14 | **Injected determinism.** `runConformance` and `runLive` accept `{ nowIso, runId, adapters, credentials, transportFactory, writer }`. Testkit source contains no `Date.now`, no `new Date()` without an injected value, no `Math.random`, and no `process`/`Bun`/`Deno` environment access; the P5 source scan proves it and its negative control fails. |
| D-15 | **Placeholder discipline.** The three tenants reuse only the already-declared tokens `owner-placeholder`, `project-placeholder`, `group-placeholder`, and `acct-0001`/`acct-0002`/`acct-0003`; no new placeholder is expected and `tests/fixtures/providers/sanitization/placeholders.json` stays unchanged. If a genuinely new token appears during authoring, it is added in the same commit together with a live use, because the audit fails undeclared **and** stale entries. |

### Open questions and inconsistencies

- **No blocking inconsistency.** Every AC has an executable path.
- **INCONSISTENCY-1 (resolved in test plan v1.1 and retained in v1.2).** The earlier test plan said "the Jira three settings plus token". Test-plan §6 and TC-CONF-021 now define **two** Jira non-secret settings (`CONFORMANCE_LIVE_JIRA_BASE_URL`, `CONFORMANCE_LIVE_JIRA_ISSUE_KEY`) plus `CONFORMANCE_LIVE_JIRA_TOKEN`, matching spec §22 and D-6; the missing-name set is 15 (GitHub 7, GitLab 5, Jira 3). No residual contradiction.
- **AMBIGUITY-1 (non-blocking, resolved by D-9 and spec v1.2 §24).** Spec §24 lists `providers[].flows[]` and top-level `flows[]`/`steps[]`; D-9 fixes provider flows as summaries with no `steps`, top-level `flows[]` as the canonical per-flow results **including nested `steps[]`**, and top-level `steps[]` as the flat index of the same step results carrying `provider` and `flowId`, with the closed `skipKind` set.
- **ADVISORY-3/ADVISORY-4 (resolved in plan v1.3).** P3.1/P3.4 match test-plan v1.2 TC-CONF-010 step 4 and TC-CONF-013 steps 2–6: both write-capable controls supply the test-only handler and execute `change-lifecycle.comment`, and a supported non-read step with no handler fails closed naming provider, flow, step, and operation. P6.2 matches TC-CONF-027 step 5: an upload `path` that is missing, empty, or unresolvable against the entrypoint `--out` fails `validateWorkflowRoot` as a workflow-text assertion; no artifact file is written or removed at contract-test time, and the "a run that produces nothing cannot upload green" guarantee rests on `if-no-files-found: error` plus TC-CONF-020's writer-in-every-status proof.
- **CLARIFICATION-1.** Test-plan §5.2 TC-CONF-012 and §6.1 note that the GitHub `comment-provenance.read-comments` step executes and asserts **absence** (GitHub issues carry no `comments` field), while Jira asserts a present set. The step matrix's "execute" entry is honoured; the GitHub tenant supplies the same `WorkItem` projection for that step. Not a contradiction.
- **CLARIFICATION-2.** The concept document says a scheduled live failure opens a ticket automatically; DEC-5 and NG-5 override that for v1. The workflow must contain no ticket-creation command.
- **OQ-1/OQ-2 (spec §14).** Tenant ownership and future protected-environment scoping remain owner decisions; they are non-blocking because the workflow is tenant-agnostic and records `not-configured`.

## Scope

### In Scope

- F-1: three-flow typed registry (`change-lifecycle`, `comment-provenance`, `label-semantics`) covering all seven closed `ADAPTER_OPERATIONS`.
- F-2: capability-gated execution, exact declared-gap skips, `no-declared-carrier` and `live-read-only` distinctions.
- F-3: conformance adapter registry for GitHub, GitLab, Jira plus the `*_ADAPTER_CONTRACT` registration scan.
- F-4: declarative exact-URL mock tenants, production-client replay, throwing-`fetch` zero-call guard, double-replay determinism.
- F-5: structural and runtime coverage gates (non-vacuity, supported-operation coverage, gap encounter, carrier coverage, registration).
- F-6: mock suite under `tests/conformance` discovered by `pnpm test`, no new CI job.
- F-7/F-8: read-only scheduled live tier, `delivery.conformance.v1` artifact and validator, exit codes 0/1/0.
- F-9: zero-mutation / zero-created-artifact proof.
- F-10: bounded diagnostics and the deliberately broken adapter control.
- Structural, workflow-contract, inventory, boundary, sanitization, secret-read, and CI-topology evidence for the new surface.

### Out of Scope

- Write conformance execution, merge/deploy-trace/pipeline-expansion flows, transition-mapping flow, write create/teardown (NG-1, M1-S4).
- Provider write adapters and the full GitHub adapter (NG-2, M3-S3).
- Any core/adapters contract, package, subpath, dependency, or export change (NG-3, NG-8).
- Any `ci.yml` edit, new CI job, or weakening of topology/bindingness (NG-4).
- Live tier as a merge gate or automatic ticket creation (NG-5, DEC-5).
- Tenant provisioning automation and protected-environment/secrets-rotation work (NG-6, OQ-2).
- Conformance for `azure`/`ci` placeholders, the provider registry, or non-provider I/O adapters (NG-7).
- Committed live tenant identifiers, tokens, or personal data (NG-8).
- Bash stack, `tools/`, `.opencode/`, `.ados-claude/`, branding, and the concept document `doc/planning/concepts/adapter-conformance.md`.

### Constraints

- **Testkit purity.** No `node:*`/`bun:*` import in `packages/testkit/src/**` (`runtime-apis-confinement`); no ambient `process`/`Bun`/`Deno` environment read (secret-read boundary); no ambient time or randomness (NFR-1). Filesystem fixture loading, environment reads, native `fetch`, and file writing live only under `tests/`.
- **Declared import edges only.** Testkit imports `@delivery-os/core/contracts` and the `github`/`gitlab`/`jira` adapters subpaths. No new package, subpath, dependency, export map, or `workspaceImports` entry exists after this change; `@delivery-os/adapters/io` remains undeclared.
- **Inventory/allowance.** Every new testkit source file is listed in `tests/structure/inventory.json`; its exported names are listed per file in `EXECUTABLE_ALLOWANCES`; internal helpers need no entry; no global executable switch.
- **CI topology frozen.** `ci.yml` must be byte-unchanged; no new job; `tests/checks/ci-checks.test.ts` and the pinned job sets are untouched; mock conformance is discovered by `bun test` and therefore runs in `ts-test` and `ts-aggregate` via `pnpm test`.
- **New workflow contract.** `.github/workflows/conformance-live.yml` has only `schedule` and `workflow_dispatch`, no `pull_request`/`pull_request_target`/`push`; job-scoped `contents: read`; SHA-pinned actions; token secrets only in the live job step; `if: always()` only on upload with `if-no-files-found: error`; the entrypoint `--out` and the upload `path` resolve to the same normalized `$RUNNER_TEMP/conformance-live.json`; `timeout-minutes: 10`; Bun from `.bun-version`.
- **Fixture discipline.** Tenants live under `tests/fixtures/providers/conformance/{github,gitlab,jira}/tenant.json`, inside the sanitization audit; top-level `provenance`; example/reserved hosts only; declared placeholders only; no live tenant id, token, email, avatar, or personal datum; no parallel fixture root.
- **Carrier honesty.** Every shipped adapter declares empty carrier arrays. The carrier step is registered and structural coverage asserts it; at runtime it records the `write-comment` declared-gap skip. The positive carrier branch and the `no-declared-carrier` branch are exercised only by test-only controls injected through the runner's adapter list, never by the production registry.
- **No production change.** `packages/core/**` and `packages/adapters/**` source, contracts, manifests, and exports are untouched. Secret-read allowlist stays exactly four entries.
- **Build order.** `pnpm build` before every narrow `bun test` that imports package surfaces; `pnpm test`/`pnpm check` build via `pretest`/`pretypecheck`.
- **Commits.** One Conventional Commit per phase, scope `GH-189`, via `@committer`; every phase boundary leaves the narrow gates green.

### Rollback and Scope Proof

- **Additive only.** The change adds testkit modules, tests, fixtures, one workflow, one changeset, and documentation. It removes nothing and edits no production source, no contract, no manifest, no subpath, no `ci.yml`, and no existing check.
- **Revert as one coherent unit.** Reverting the phase commits in reverse order restores the exact pre-change tree. Never split a flow step from its mock route/projection/assertion, the adapter registry from the registration gate, the artifact schema/caps from the validator, the live composition from its workflow, or the inventory entry from the file it names.
- **Scope proof.** After any rollback: `git diff --exit-code "$(git merge-base HEAD origin/main-tools)" -- .github/workflows/ci.yml` is empty, `git diff --stat` shows only this change folder, `bun run scripts/checks/secret-read-boundary.ts` reports exactly four allowlist entries, `bun test tests/checks/fixture-sanitization.test.ts` is green, and `pnpm check` is green at the reverted HEAD. There is no persisted runtime state, no config key, and no migration to undo.

### Risks (from spec §11, with this plan's mitigation points)

- **RSK-1 read-only v1 coverage:** every supported read operation executes with assertions (P3/P4); write gaps are encountered and named (P3/P4); write flows join in M1-S4.
- **RSK-2 tenant absence:** `not-configured` exits 0 and lists missing names only (P5); the workflow is tenant-agnostic (P6).
- **RSK-3 accidental mutation:** live executes read steps only; non-`GET` fails the run; counters always present (P5).
- **RSK-4 fixture drift:** provenance-marked audited fixtures (P2) plus scheduled live revalidation (P5/P6).
- **RSK-5 vacuity/staleness:** structural and runtime gates plus the broken-adapter control fail closed (P3/P4).
- **RSK-6 secret/PII leakage:** sanitization audit, artifact redaction, credential-port exclusivity, workflow secret scoping (P2/P5/P6/P7).
- **RSK-7 testkit boundary creep:** no `node:*`, no ambient env, inventory/allowance, boundary fixture (P1–P3, P7).
- **RSK-8 live flakiness:** evidence-only, bounded, artifact on every run (P5/P6).
- **RSK-9 workflow drift:** the workflow-contract test and its mutations (P6).
- **RSK-10 slowness:** offline exact routes, no sleeps, measured budget (P4/P8).

### Success Metrics

- 3/3 shipped adapters registered and green in mock; 7/7 operations represented; 100% supported operations executed; 100% declared gaps encountered; 100% declared carriers exercised or none declared.
- 0 live network calls in mock; 100% identical double-replay outcomes and order.
- 1/1 broken-adapter control failing by provider/flow/step while the unmodified control passes.
- 0 new `ci.yml` jobs and a byte-unchanged `ci.yml` at review.
- 100% of scheduled/dispatch runs producing a valid artifact; live mutations 0 and created artifacts 0.
- Secret-read allowlist exactly 4; 0 ambient env reads in `packages/*/src`; 0 `node:*` in testkit source; 0 sanitization findings.
- Mock suite ≤ 60 s (measured); live ≤ 10 min (structural timeout).
- `pnpm check` green, doc-distribution guard green, zero new dependencies.

## Phases

Execution order is strict P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8. Each phase ends in a verifiable state and one Conventional Commit (scope `GH-189`) via `@committer`. Narrow cycles: `pnpm build` first, then the listed `bun test` command; final verification uses `pnpm check` (which builds through `pretest`/`pretypecheck`). Phases P1–P3 update inventory/allowance in the same commit that adds a testkit source file (D-12); P7 reconciles and hardens the invariant surface.

### Phase P1: Conformance types, flow registry, and artifact schema constants

**Goal**: Land the stable data model, the three-flow/twelve-step registry, and the versioned artifact constants so every later phase consumes one vocabulary. No provider adapter or runner behaviour yet.

**Tasks**:

- [x] **P1.1** Create `packages/testkit/src/conformance/types.ts` — types only (no runtime export): flow/step/assertion-family/carrier-requirement types; mock tenant, route, and expected-projection types; adapter registration and client-builder types, including an optional carrier-roundtrip handler reserved for test-only controls; provider/flow/step result and report types; tier and status unions; failure and violation types. Primitive imports come from `@delivery-os/core/contracts`; transport types are derived from the adapters' exported client-option types (never `@delivery-os/adapters/io`). (TC-CONF-001, TC-CONF-018)
- [x] **P1.2** Create `packages/testkit/src/conformance/flows.ts` — `CONFORMANCE_FLOWS` as ordered data with exactly three flows and twelve steps matching test-plan §5.1 step matrix, plus the exported `findFlow(flowId)` lookup; every step carries a stable id, an `ADAPTER_OPERATIONS` operation, an assertion family, and an optional carrier requirement; the comment-provenance carrier step declares a carrier requirement; the operation set is exactly the seven closed operations. (TC-CONF-001, TC-CONF-005)
- [x] **P1.3** Create `packages/testkit/src/conformance/artifact.ts` — declarative schema constants only in this phase: `CONFORMANCE_SCHEMA_ID = "delivery.conformance.v1"`, `CONFORMANCE_STATUSES`, `CONFORMANCE_PROVIDER_STATUSES` (D-3), and `CONFORMANCE_LIMITS` with the D-1 caps. No serializer/validator yet (P5 adds them and extends the allowance). (TC-CONF-018, TC-CONF-019)
- [x] **P1.4** Add `src/conformance/types.ts`, `src/conformance/flows.ts`, `src/conformance/artifact.ts` to `tests/structure/inventory.json` and add `CONFORMANCE_FLOWS`/`findFlow`, plus `CONFORMANCE_SCHEMA_ID`/`CONFORMANCE_STATUSES`/`CONFORMANCE_PROVIDER_STATUSES`/`CONFORMANCE_LIMITS`, to `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts`. `types.ts` needs no allowance (types only). (TC-CONF-030)
- [x] **P1.5** Re-export the public helpers from `packages/testkit/src/index.ts` as `export { … } from "./conformance/…js"` declarations (existing root export only; no new subpath). Keep the export set aligned with the allowance names. (TC-CONF-001 step 6, TC-CONF-029 step 5)
- [x] **P1.6** Create `tests/structure/conformance-coverage.test.ts` with the flow-registry contract (TC-CONF-001) and the flow-only non-vacuity floors of TC-CONF-005: exact three flow ids, twelve ordered steps, unique ids, every operation in the closed set, all seven operations represented, and mutation controls (fourth flow, duplicate id, unknown operation, removed operation, empty flow) built from pure function parameters or in-memory copies. Adapter-level floors land in P2/P3 in the same file. (TC-CONF-001, TC-CONF-005)

**Acceptance Criteria**:

- Must: exactly three flows and twelve steps with unique stable ids; every step operation is a member of `ADAPTER_OPERATIONS`; all seven operations appear (AC-F1-1).
- Must: the artifact schema constants are finite and exported; status sets are closed (AC-F8-1 mechanism, D-1/D-3).
- Must: `bun test tests/structure/content-inventory.test.ts` and the new structure test are green (NFR-9).

**Files and modules**:

- Code areas: `packages/testkit/src/conformance/types.ts` (new), `packages/testkit/src/conformance/flows.ts` (new), `packages/testkit/src/conformance/artifact.ts` (new), `packages/testkit/src/index.ts` (updated), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/structure/conformance-coverage.test.ts` (new).
- System docs: none (doc-sync owns the feature spec at P8).

**Tests**:

- `pnpm install --frozen-lockfile && pnpm build`
- `bun test tests/structure/conformance-coverage.test.ts`
- `bun test tests/structure/content-inventory.test.ts`

**Exit criteria**: Registry and constants importable through `@delivery-os/testkit`; structure and inventory suites green; no testkit `node:*` import; `bun test tests/structure` has no regression.

**Completion signal**: `feat(GH-189): add conformance types, flow registry and artifact schema`

---

### Phase P2: Adapter registrations, declarative mock tenants, and conformance fixtures

**Goal**: Register the three shipped provider contracts and ship deterministic exact-URL tenants replayed through the production client factories, all inside the audited fixture root.

**Tasks**:

- [x] **P2.1** Create `packages/testkit/src/conformance/adapters.ts` — `CONFORMANCE_ADAPTERS` with exactly the `github`, `gitlab`, and `jira` registrations. Each binds the imported contract (`GITHUB_ADAPTER_CONTRACT`, `GITLAB_ADAPTER_CONTRACT`, `JIRA_ADAPTER_CONTRACT`), a client builder over `{ instance, credentials, transport }` plus addressing (GitHub `repository`, GitLab `projectPath`, Jira none), and the addressing the flows need. Production registrations declare **no** carrier-roundtrip handler; only injected test-only controls may supply one (P3.1). No placeholder, registry, or non-provider subpath is imported or registered. (TC-CONF-002, TC-CONF-003)
- [x] **P2.2** Create `packages/testkit/src/conformance/mock-tenant.ts` — `decodeMockTenant` (pure shape validation: provider/adapter name, instance, credential reference name, addressing, ordered routes, expected projections, `provenance`; rejects duplicate URLs and unfixtured-shape data) and `createMockTenantTransport` (records every request, matches exact `method + url`, returns the declared status/body, and throws naming the method and URL for anything unfixtured). Transport/request types derive from adapters client-option types. (TC-CONF-004, TC-CONF-015)
- [x] **P2.3** Create `tests/conformance/support/fixtures.ts` — test-side fixture loading (`node:fs`/`node:path`), JSON decoding, and passing decoded tenants into testkit; it also exposes the throwing-`fetch` guard by reusing `tests/behaviour/providers/support.ts` (`installThrowingFetchGuard`) rather than duplicating it. No filesystem access enters testkit source. (TC-CONF-006, TC-CONF-015)
- [x] **P2.4** Author `tests/fixtures/providers/conformance/github/tenant.json`, `.../gitlab/tenant.json`, `.../jira/tenant.json` per test-plan §6.1: top-level `provenance` (`hand-authored-synthetic 2026-10-31`), `provider`/`adapterName`, `instance` with `https://{github,gitlab,jira}.example.com` and a literal credential reference, `credentialReferenceName`, provider addressing, ordered exact routes, and one expected primitive projection per executed step (D-10). Reuse the committed payload shapes from `tests/fixtures/providers/{github,gitlab,jira}/` (issues, pulls, check-runs, merge-requests, pipelines, Jira issue with comments and labels). Reuse only the declared placeholders (D-15); do **not** extend `placeholders.json` unless a genuinely new token appears, and never leave a stale one. (TC-CONF-031, TC-CONF-007/008/009 fixture half, TC-CONF-012 fixture half)
- [x] **P2.5** Update `tests/structure/inventory.json` with `src/conformance/adapters.ts` and `src/conformance/mock-tenant.ts`, and add their allowances: `adapters.ts` → `CONFORMANCE_ADAPTERS`; `mock-tenant.ts` → `decodeMockTenant`, `createMockTenantTransport`. (TC-CONF-030)
- [x] **P2.6** Extend `tests/structure/conformance-coverage.test.ts` with TC-CONF-002 (exactly three registrations keyed `github`/`gitlab`/`jira`; contract `adapterName` matches the key; client builder and addressing present; wrong-contract and `azure`-registration controls fail by name) and TC-CONF-003 (scan `packages/adapters/src/**` with a root parameter, matching only `export const *_ADAPTER_CONTRACT` **declarations** and deduping by adapter directory/name; assert exactly three declarations from three distinct declaring files — the six raw symbol occurrences (declaration + subpath re-export) must not inflate the count; negative controls: an `index.ts`-only re-export adds zero occurrences and does not fail, a new `example/capabilities.ts` declaration makes four declarations and fails naming source and adapter; a dangling registration fails; placeholder/non-provider modules do not false-positive). (TC-CONF-002, TC-CONF-003)

**Acceptance Criteria**:

- Must: registry is the sole participant list, exactly GitHub/GitLab/Jira, each bound to its own contract (AC-F3-2).
- Must: a new provider `*_ADAPTER_CONTRACT` without registration, and a dangling registration, fail by source/adapter (AC-F3-1).
- Must: fixtures are provenance-marked, example-host-only, placeholder-clean, inside `tests/fixtures/providers/**`, with zero sanitization findings (AC-F4-3).

**Files and modules**:

- Code areas: `packages/testkit/src/conformance/adapters.ts` (new), `packages/testkit/src/conformance/mock-tenant.ts` (new), `tests/conformance/support/fixtures.ts` (new), `tests/fixtures/providers/conformance/github/tenant.json` (new), `.../gitlab/tenant.json` (new), `.../jira/tenant.json` (new), `tests/structure/conformance-coverage.test.ts` (updated), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated), `tests/fixtures/providers/sanitization/placeholders.json` (only if D-15 requires).
- System docs: none.

**Tests**:

- `pnpm build`
- `bun test tests/structure/conformance-coverage.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `bun test tests/checks/fixture-sanitization.test.ts`
- `bun test tests/checks/secret-read-boundary.test.ts`

**Exit criteria**: Structure test green for TC-CONF-002/003; sanitization audit zero findings with the three tenants in scope; secret-read allowlist still exactly four; fixtures contain no live id/token/email/avatar.

**Completion signal**: `feat(GH-189): register provider adapters and add declarative mock tenants`

---

### Phase P3: Capability-gated runner, primitive assertions, and coverage gates

**Goal**: Execute the registry per adapter capability, assert normalized primitives, and fail closed on undeclared gaps, uncovered operations, stale gaps, and vacuous execution.

**Tasks**:

- [x] **P3.1** Create `packages/testkit/src/conformance/runner.ts` — `runConformance({ adapters, tenants, credentials, transportFactory, nowIso, runId, tier, mode })`. For each registration and flow step: if the operation is supported, build the production client and dispatch the read (per-provider dispatch for `read-work-item`/`read-delivery-request`/`read-pipeline-run`); if unsupported, require a matching `declaredGaps` record (otherwise fail naming adapter + operation) and record a `skipped` step with `skipKind: declared-gap` and the exact reason. The carrier step records the declared-gap skip when `write-comment` is unsupported, `no-declared-carrier` (`capability-absent`) when supported with both carrier arrays empty, and executes the roundtrip only when a writable/readable carrier is declared. **Control write dispatch:** the registration type carries an optional **test-only** carrier-roundtrip/write handler (typed in `types.ts`, consumed by `runner.ts`); the production `CONFORMANCE_ADAPTERS` never sets it, and it is injected only through the test's `adapters` argument. In mock mode a supported non-read control step dispatches that handler when present; a supported non-read step with no handler fails closed naming **provider, flow, step, and operation** (not just adapter/operation) rather than recording a silent skip, so runtime coverage never passes without executing `write-comment`. Every test-only control that declares `write-comment` supported (including the empty-carrier control in TC-CONF-010 step 4) supplies the handler. **Exact `change-lifecycle.comment` outcome:** on a control that supports `write-comment`, the step **executes** through the handler and is asserted (so `write-comment` coverage is satisfied); TC-CONF-013's carrier-declaring and empty-carrier controls both supply it, while the carrier-roundtrip step executes on the carrier control and records `no-declared-carrier` (`capability-absent`) on the empty-carrier control. Live mode applies D-13 (`live-read-only` deferrals stay live-only). Report construction uses the injected clock/run id; failures carry provider/flow/step/operation/assertion, expected/received scalars, and a fixture/request descriptor (D-11). (TC-CONF-010, TC-CONF-012, TC-CONF-013, TC-CONF-014)
- [x] **P3.2** Implement the primitive invariant assertions inside `runner.ts` (internal helpers): identity matches the requested entity and instance; closed delivery/review/job/relation enums; non-empty required strings; labels array; `comments` absent vs present-empty; ISO-8601 UTC `updatedAt` when present; trace evidence has name and location; no provider-native key on a normalized view; canonical sorted-key comparison against `tenant.expected[stepId]` in mock mode (skipped in live mode, D-10). (TC-CONF-007, TC-CONF-008, TC-CONF-009, TC-CONF-012)
- [x] **P3.3** Create `packages/testkit/src/conformance/coverage.ts` — `structuralCoverageViolations` (non-empty sets; unique flow/step ids; operation membership; all seven operations represented; per adapter every supported operation and every declared gap has a step; supported/gap sets disjoint and together equal the closed set; valid gap reasons; declared carrier has a carrier step; no unregistered provider contract) and `runtimeCoverageViolations` (at least one executed step; every supported operation executed; every declared gap encountered with its exact reason; declared carriers exercised or none; no failed step counted as passed; live mode accepts `live-read-only` deferrals). Every violation names provider and flow/step/operation. (TC-CONF-004, TC-CONF-005, TC-CONF-011)
- [x] **P3.4** Extend `tests/structure/conformance-coverage.test.ts` with TC-CONF-004 (structural step/carrier coverage and its mutation controls) and the adapter-level exact-set/non-vacuity floors of TC-CONF-005. **Create** `tests/conformance/mock-conformance.test.ts` with the runner/coverage controls: TC-CONF-010 (undeclared unsupported operation, invalid reason, declared-gap carrier skip, `no-declared-carrier` skip, skipped ≠ executed), TC-CONF-011 (runtime coverage and remove/mask mutations), TC-CONF-013 (carrier-declaring and empty-carrier controls injected through the adapter list, never in the production registry; both assert `change-lifecycle.comment` executes through the test-only write handler, the carrier-roundtrip step executes on the carrier control and records `no-declared-carrier` on the empty-carrier control, and a further control that declares a non-read operation supported with no handler fails closed naming provider, flow, step, and operation), TC-CONF-014 (double replay deep-equal, injected clock/run-id, identical failing diagnostics), TC-CONF-015 (throwing-`fetch` zero calls, exact URL, near-miss URL, unfixtured failure with method/URL, guard restore). (TC-CONF-004, TC-CONF-005, TC-CONF-010, TC-CONF-011, TC-CONF-013, TC-CONF-014, TC-CONF-015)
- [x] **P3.5** Update `tests/structure/inventory.json` with `src/conformance/runner.ts` and `src/conformance/coverage.ts`, and add allowances: `runner.ts` → `runConformance`; `coverage.ts` → `structuralCoverageViolations`, `runtimeCoverageViolations`. (TC-CONF-030)
- [x] **P3.6** Ensure testkit source stays free of `node:*`, ambient environment, `Date.now`, `new Date()`, and `Math.random`; run `bun test tests/boundaries` and `bun run scripts/checks/secret-read-boundary.ts` as the phase gate. (TC-CONF-025 scan prerequisite, TC-CONF-028, TC-CONF-029)

**Acceptance Criteria**:

- Must: supported operations execute with primitive assertions and unsupported operations skip with the exact declared reason; an undeclared unsupported operation fails (AC-F2-1).
- Must: a supported-but-uncovered operation, a stale declared gap, or an unexercised declared carrier fails naming adapter/operation (AC-F2-2, AC-F5-1).
- Must: carrier-positive and empty-carrier branches are proven by test-only controls; production registry stays at three (AC-F2-3).
- Must: identical inputs produce identical reports and diagnostics (AC-F4-2); offline replay makes zero live calls (AC-F4-1).

**Files and modules**:

- Code areas: `packages/testkit/src/conformance/runner.ts` (new), `packages/testkit/src/conformance/coverage.ts` (new), `tests/conformance/mock-conformance.test.ts` (new), `tests/structure/conformance-coverage.test.ts` (updated with TC-CONF-004/005 adapter floors), `tests/structure/inventory.json` (updated), `tests/structure/content-inventory.test.ts` (updated).
- System docs: none.

**Tests**:

- `pnpm build`
- `bun test tests/conformance/mock-conformance.test.ts`
- `bun test tests/structure/conformance-coverage.test.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `bun test tests/boundaries`
- `bun run scripts/checks/secret-read-boundary.ts`

**Exit criteria**: Runner/coverage controls green; no production-registry mutation; testkit boundary and secret-read gates green; structure coverage complete for three adapters.

**Completion signal**: `feat(GH-189): add capability-gated conformance runner and coverage gates`

---

### Phase P4: Mock conformance suite for all three adapters and the broken-adapter control

**Goal**: Prove the shipped read slices behave correctly through the registry, and prove the suite fails non-vacuously by provider, flow, step, operation, and assertion.

**Tasks**:

- [x] **P4.1** Complete/extend `tests/conformance/mock-conformance.test.ts` (created in P3.4) with the per-provider matrices: TC-CONF-006 (three providers × three flows, twelve step results in registry order, overall mock `passed`, per-adapter executed step and encountered gap, offline, missing-route control fails naming provider/flow/step/URL), TC-CONF-007 (GitHub: three `read-work-item` steps execute, pull read returns `DeliveryRequest` with closed review state and threads, check-runs-per-SHA returns the full set with closed job states and trace refs, every write step skips `adapter-not-implemented`, no native keys, projection-corruption control fails), TC-CONF-008 (GitLab: MR and pipeline reads execute; three work-item steps and all writes skip `adapter-not-implemented`; pipeline multiplicity preserved; dropped-pipeline and non-closed-review-state controls fail), TC-CONF-009 (Jira: three work-item steps execute with comments/labels; `read-delivery-request`/`read-pipeline-run`/`write-delivery-request` skip `provider-unsupported`; work-item writes skip `adapter-not-implemented`; no native keys; omitted-comment control preserves absence), TC-CONF-012 (comment read half present vs absent, carrier step declared-gap skip on all three, `comments: []` control fails), TC-CONF-014 (double replay across all providers). (TC-CONF-006, TC-CONF-007, TC-CONF-008, TC-CONF-009, TC-CONF-012, TC-CONF-014)
- [x] **P4.2** Create `tests/conformance/broken-adapter-control.test.ts` — TC-CONF-016 (a test-only wrapper around a production client corrupts one normalized outcome; the run fails naming `github`, `change-lifecycle`, `change-lifecycle.read-work-item`, and the assertion; expected/received and fixture reference present; the unmodified client passes the same flow; a second corruption in `label-semantics` localizes there; the control never enters the production registry) and TC-CONF-017 (diagnostic field completeness; no raw payload, authorization header, token, email, or avatar in the diagnostic or serialized report; canary credential absent from error text; non-scalar expected/received rejected; injected raw-payload marker fails the redaction/validation control). Canary shapes come from the allowlisted fixture roots `tests/fixtures/providers/sanitization/cases.ts` and `tests/fixtures/privacy-literals/`; no new inline literal secrets. (TC-CONF-016, TC-CONF-017)
- [x] **P4.3** Measure and record the mock wall clock for TC-CONF-006/033 with `/usr/bin/time -f '%e s' bun test tests/conformance/mock-conformance.test.ts`; record the number in the Execution Log (D-5). Re-run the suite to confirm identical outcomes and order. (TC-CONF-006, TC-CONF-014, NFR-8)
- [x] **P4.4** Confirm no new testkit source file is added in this phase, so inventory/allowance stays as set in P3; run `bun test tests/structure/content-inventory.test.ts` to prove it. (TC-CONF-030)

**Acceptance Criteria**:

- Must: the mock suite is green for GitHub, GitLab, and Jira with only declared or capability-absent skips (AC-F6-1, AC-F2-1).
- Must: each provider executes its supported reads with primitive assertions and skips with exact reasons (AC-F1-2, AC-F2-1).
- Must: the broken adapter fails by provider/flow/step while the unmodified client passes (AC-F5-2).
- Must: diagnostics are actionable and secret-free (AC-F10-1).
- Must: zero live network calls; measured wall clock recorded (AC-F4-1, NFR-8).

**Files and modules**:

- Code areas: `tests/conformance/mock-conformance.test.ts` (updated), `tests/conformance/broken-adapter-control.test.ts` (new).
- System docs: none.

**Tests**:

- `pnpm build`
- `bun test tests/conformance`
- `pnpm test` (proves `bun test` discovery through the existing aggregate path used by `ts-test`/`ts-aggregate`)
- `/usr/bin/time -f '%e s' bun test tests/conformance/mock-conformance.test.ts`
- `bun test tests/structure/content-inventory.test.ts`

**Exit criteria**: `bun test tests/conformance` and `pnpm test` green; the mock suite is discovered by the aggregate path; broken-adapter control green; measured mock wall clock recorded; no new testkit file.

**Completion signal**: `test(GH-189): prove mock conformance for GitHub, GitLab and Jira with a broken-adapter control`

---

### Phase P5: Artifact validator and read-only live composition entrypoint

**Goal**: Give both tiers one validated `delivery.conformance.v1` artifact, and compose the live run so configuration is non-secret, tokens resolve only through the credential port, the run is read-only, and every terminal status writes an artifact and returns the contracted exit code.

**Tasks**:

- [x] **P5.1** Extend `packages/testkit/src/conformance/artifact.ts` with `toConformanceArtifact(report)`, `serializeConformanceArtifact(artifact)`, and `validateConformanceArtifact(value)`: schema id, required fields, closed status/provider-status sets, ISO-8601 UTC `generatedAt`, provider/flow/step counts and failure-detail/byte caps (D-1), scalar-only expected/received, redaction of the D-11 shape families, truncation marker, rejected unknown schema/version/missing array/invalid status/missing mutation counter, and rejection of forbidden markers. Update the `artifact.ts` allowance to add the three function names. (TC-CONF-018, TC-CONF-019, TC-CONF-020 step 5)
- [x] **P5.2** Create `tests/conformance/artifact.test.ts` — TC-CONF-018 (shape, field sets, closed statuses, ISO timestamps, malformed-field controls, mock and persisted live artifacts validate through the same validator) and TC-CONF-019 (≤ 256 KiB; oversized detail truncated visibly; over-cap provider/flow/step reports rejected naming cap and observed count; canary token/header/email/avatar/raw payload absent; caps are finite positive integers). Canary shapes come from the allowlisted fixture roots `tests/fixtures/providers/sanitization/cases.ts` and `tests/fixtures/privacy-literals/`; no new inline literal secrets. (TC-CONF-018, TC-CONF-019)
- [x] **P5.3** Create `tests/conformance/live/config.ts` — `PROVIDER_LIVE_SETTINGS` with the exact spec §22 names (GitHub six, GitLab four, Jira two), the three literal token source keys, and `readLiveConfig(environment)` returning per-provider non-secret settings plus credential references and `missingSettings` names only. A provider is configured only when every non-secret setting is present **and non-empty (non-whitespace)** and its token source key is present **and non-empty (non-whitespace)**; `undefined`, `""`, and whitespace-only values are MISSING, so the present-but-empty GitHub Actions no-tenant shape yields `not-configured`. The reader may inspect the token source key only to test occupancy; it never stores, returns, logs, or emits the value, and actual authorization resolves through the adapters `./credentials` `CredentialPort`. A fully absent, present-but-empty, or whitespace-only environment reports exactly 15 missing names (GitHub 7, GitLab 5, Jira 3). (TC-CONF-021, TC-CONF-024)
- [x] **P5.4** Create `tests/conformance/live/recording-transport.ts` — `createNativeFetchTransport()` (native `fetch`, JSON body), `createRecordingTransport(inner)` recording `{ method, url }` for every request, and `readOnlyViolations(records)` naming the first non-`GET` method and URL. The guard is a pure function over a widened method string so its negative control can feed a synthetic `POST` (D-13). (TC-CONF-023)
- [x] **P5.5** Create `tests/conformance/live/run-live.ts` — exported `runLive({ environment, adapters, clock, runId, writer, transportFactory, credentials })` returning `{ status, exitCode, artifact }`, with injected flow registry, assertion code, clock, run id, and writer; plus the process wrapper under `import.meta.main` that parses `--out` (D-2), builds the process credential port (`createProcessCredentialPort(SYNTHETIC_BRAND)`, where `SYNTHETIC_BRAND` is a locally defined test-only `BrandIdentity` with a fixed `environmentPrefix`; the literal credential references make that prefix inert), generates the run id and clock at the composition edge, writes the artifact through a `node:fs` writer, and returns 0 for `passed`/`not-configured` and 1 for `failed`. (TC-CONF-020, TC-CONF-021, TC-CONF-022, TC-CONF-023)
- [x] **P5.6** Create `tests/conformance/live/live-entrypoint.test.ts` — TC-CONF-020 (status matrix 0/1/0 and artifact in every status; writer called before return; mock report stays in memory; a control that skips the writer on failure fails the test), TC-CONF-021 (spawned-entrypoint path: `bun run tests/conformance/live/run-live.ts --out "$TMPDIR/conformance-live.json"` with the documented names unset exits 0 and writes a valid artifact; no credential resolution and no request in that path; the absent/present-but-empty/whitespace occupancy matrix lands in P5.8), TC-CONF-022 (configured GitHub failure → overall `failed`, exit 1, artifact written, GitLab/Jira listed `not-configured`, no ticket, writer still called), TC-CONF-023 (all requests `GET`, synthetic `POST` fails naming method/URL, `live-read-only` deferral never dispatches, unsupported non-read records the declared gap, counters present in every status), TC-CONF-024 (config returns non-secret settings and references only; recording credential port resolves each configured provider; token value absent from artifact/diagnostics/errors; no `packages/*/src` import of the config reader), TC-CONF-025 (two identical injected runs serialize identically; only `runId`/`generatedAt` change when injected values change; source scan over `packages/testkit/src/**` finds no ambient time/randomness/environment and its temp-hit control fails). Put the reusable source scan in `tests/conformance/support/testkit-source-scan.ts`. (TC-CONF-020, TC-CONF-021, TC-CONF-022, TC-CONF-023, TC-CONF-024, TC-CONF-025)
- [x] **P5.7** Confirm `run-live.ts` is not a `*.test.ts` and is therefore not discovered as a suite; verify `bun test tests/conformance` discovers mock/artifact/live tests and does not execute the entrypoint. No inventory change (files are under `tests/`). (TC-CONF-021, TC-CONF-033 step 3)
- [x] **P5.8** Extend `tests/conformance/live/live-entrypoint.test.ts` with the TC-CONF-021 non-empty-occupancy matrix: (A) all 15 documented names absent; (B) all 15 names present with `""` — the real GitHub Actions no-tenant shape, where an unset repository variable or secret materialises as a present empty-string key; (C) all 15 names present with whitespace-only values (`" "`, `"\t"`). For each shape assert all three providers are `not-configured`, overall is `not-configured`, exit code is 0, the artifact lists exactly the 15 missing names (GitHub 7, GitLab 5, Jira 3; names only, never values), the recording credential port records zero lookups, and the recording transport records zero provider requests. Add the per-provider occupancy control: fill all 15 with non-empty values (all configured), then blank one GitHub setting and assert only GitHub returns to `not-configured` with exactly its 7 names. (TC-CONF-021)

**Acceptance Criteria**:

- Must: a `delivery.conformance.v1` artifact validates, is bounded and secret-free, and is produced in every terminal status (AC-F8-1, AC-F7-1).
- Must: `not-configured` exits 0 with missing names only; a configured provider failure exits 1 with the artifact written (AC-F7-2, AC-F7-3).
- Must: absent, present-but-empty (GitHub Actions no-tenant shape), and whitespace-only environments all yield `not-configured`, exit 0, exactly 15 missing names, zero credential resolution, and zero provider requests (AC-F7-2, NFR-5).
- Must: all live requests are `GET`; a non-`GET` fails; `mutationRequests: 0` and `createdArtifacts: 0` are always recorded (AC-F9-1).
- Must: token material resolves only through the credential port; no production-source env read and no allowlist growth (AC-F7-5).
- Must: identical injected inputs produce identical artifacts (AC-F4-2).

**Files and modules**:

- Code areas: `packages/testkit/src/conformance/artifact.ts` (updated), `tests/structure/content-inventory.test.ts` (updated allowance), `tests/conformance/artifact.test.ts` (new), `tests/conformance/live/config.ts` (new), `tests/conformance/live/recording-transport.ts` (new), `tests/conformance/live/run-live.ts` (new), `tests/conformance/live/live-entrypoint.test.ts` (new), `tests/conformance/support/testkit-source-scan.ts` (new).
- System docs: none.

**Tests**:

- `pnpm build`
- `bun test tests/conformance/artifact.test.ts`
- `bun test tests/conformance/live`
- `bun test tests/conformance`
- `bun run scripts/checks/secret-read-boundary.ts`

**Exit criteria**: Artifact and live suites green; the absent, present-but-empty, and whitespace-only occupancy matrix is green; the not-configured subprocess exits 0 with a valid artifact; source scan green with its negative control firing; `run-live.ts` not discovered; secret-read allowlist unchanged.

**Completion signal**: `feat(GH-189): add conformance artifact validator and read-only live evidence entrypoint`

---

### Phase P6: Scheduled read-only live workflow and its contract test

**Goal**: Ship the weekly/dispatch live-evidence workflow with least privilege, SHA pins, secret scoping, always-run artifact upload, and a contract test that fails on every drift.

**Tasks**:

- [x] **P6.1** Create `.github/workflows/conformance-live.yml` — `name: Conformance (live evidence)`; triggers only `schedule` (`cron: "17 5 * * 1"`) and `workflow_dispatch`; workflow-level `permissions: contents: read`; one `live` job with job-scoped `contents: read`, `timeout-minutes: 10`, no `continue-on-error`; steps: checkout (SHA-pinned), `oven-sh/setup-bun` (SHA-pinned, `bun-version-file: .bun-version`), `pnpm/action-setup` (SHA-pinned), `pnpm install --frozen-lockfile`, `pnpm build`, `bun run tests/conformance/live/run-live.ts --out "$RUNNER_TEMP/conformance-live.json"` with the §22 repository variables and the three token secrets in that step's `env` only, and an `if: always()` `actions/upload-artifact` (SHA-pinned) with `name: conformance-live`, `path: ${{ runner.temp }}/conformance-live.json`, `retention-days: 90`, and **`if-no-files-found: error`**. The entrypoint `--out` argument and the upload `path` must denote the same file under one normalized `$RUNNER_TEMP`/`${{ runner.temp }}` spelling; the workflow uses that single path spelling for both references and introduces no second output flag or environment variable. Reuse the exact 40-hex pins already present in `ci.yml` for checkout, `oven-sh/setup-bun`, and `pnpm/action-setup`; resolve and record a 40-hex pin for the artifact-upload action too. No ticket-creation command, no `secrets: inherit`, no literal Bun version. (TC-CONF-026, TC-CONF-027)
- [x] **P6.2** Create `tests/checks/conformance-workflow.test.ts` — export `validateWorkflow(text)` and `validateWorkflowRoot(root)`; assert triggers/cron, job permissions, 40-hex SHA pins for every `uses:`, Bun file pin + `.bun-version` value, secret placement and absence of `secrets: inherit`, `if: always()` only on upload with name/retention/`if-no-files-found: error`, the entrypoint `--out` equals the upload `path` after normalizing `$RUNNER_TEMP`/`${{ runner.temp }}`/`${RUNNER_TEMP}` to one token, a missing/empty upload `path` and an upload `path` that cannot be resolved against the entrypoint `--out` to one file fail `validateWorkflowRoot`, `timeout-minutes: 10`, no bypass constructs, and no ticket creation. Mutation controls per TC-CONF-027: added/removed triggers, changed cron, `@v4` pin, unpinned action, `continue-on-error`, `contents: write`, `id-token: write`, removed `if: always()`, `retention-days: 0`, changed artifact name, wrong `--out` vs upload path, a missing/empty upload `path`, an unresolvable `--out`/`path` pair, `if-no-files-found: warn`, literal `bun-version`, `secrets: inherit`, secret on an unrelated step, `gh issue create` — each fails naming the location; the unmutated workflow passes. The upload-`path` controls are workflow-text assertions only: no artifact file is written or removed at contract-test time. Build mutations from in-memory/temp copies. (TC-CONF-026, TC-CONF-027)
- [x] **P6.3** Run the existing supply-chain and bindingness checks plus the pin check to prove the new workflow does not disturb them, and run the repository-wide structure invariants that scan every `.github/workflows/*.yml` (including `tests/structure/legacy-confinement.test.ts`): `bun run scripts/checks/ci-supply-chain.ts`, `bun run scripts/checks/ci-bindingness.ts`, `bun test tests/checks/ci-checks.test.ts`, `bun test tests/structure`. (TC-CONF-032)

**Acceptance Criteria**:

- Must: only the weekly schedule and `workflow_dispatch` triggers; no PR trigger; least privilege; SHA pins; secrets scoped to the live step; always-run upload; Bun from `.bun-version` (AC-F7-4).
- Must: every contract clause has a failing control and the unmutated workflow passes (TC-CONF-027).
- Must: the upload fails (`if-no-files-found: error`) when no artifact is written, the static contract rejects a missing/empty or unresolvable upload `path`, and the entrypoint `--out` provably equals the upload `path` under one normalized spelling; the "produces nothing cannot upload green" guarantee is carried by `if-no-files-found: error` plus TC-CONF-020's writer-in-every-status proof (AC-F7-1, ticket AC-2).
- Must: existing `ci.yml` scanners and pin equality stay green, and repository-wide structure invariants that scan every workflow stay green (AC-F6-2, NFR-4).

**Files and modules**:

- Code areas: `.github/workflows/conformance-live.yml` (new), `tests/checks/conformance-workflow.test.ts` (new).
- System docs: none.

**Tests**:

- `bun test tests/checks/conformance-workflow.test.ts`
- `bun run scripts/checks/ci-supply-chain.ts`
- `bun run scripts/checks/ci-bindingness.ts`
- `bun test tests/checks/ci-checks.test.ts`
- `bun test tests/structure`

**Exit criteria**: Workflow contract and mutation suites green; the three existing CI invariant checks and the repository-wide structure invariants green; no `ci.yml` change.

**Completion signal**: `ci(GH-189): add scheduled read-only conformance workflow and contract test`

---

### Phase P7: Invariant hardening — testkit confinement, secret-read, inventory, and CI topology

**Goal**: Pin the new surface into the repository invariants with failing fixtures, and reconcile inventory/allowances so a future bypass fails closed.

**Tasks**:

- [x] **P7.1** Add a testkit negative boundary fixture for `node:*` in `tests/boundaries/fixtures/cases.ts` (`runtime-node-testkit-conformance`, packages `["testkit"]`, probe `packages/testkit/src/conformance/probe.ts`, source `import fs from "node:fs"; export const value = fs;`, rule `runtime-apis-confinement`, TC `TC-CONF-029`) and register it under `runtime-apis-confinement` in `tests/boundaries/fixture-registry.json`. Add or reuse a clean control importing `node:fs` from an allowed location. Run `bun test tests/boundaries` (including the fixture-coverage meta-check). (TC-CONF-029)
- [x] **P7.2** Add a testkit secret-read case to `tests/fixtures/secret-boundary/cases.ts` (`testkit-conformance-env-read`, files `packages/testkit/src/conformance/probe.ts` with `process.env.SECRET`, `Bun.env.SECRET`, and a computed-key form; expect violation; assert file/line) and extend `tests/checks/secret-read-boundary.test.ts` with an assertion that the testkit conformance source is not allowlisted and that the allowlist is exactly four entries with one `credential-material` entry. Run the check and its suite. (TC-CONF-028)
- [x] **P7.3** Reconcile `tests/structure/inventory.json` and `EXECUTABLE_ALLOWANCES` in `tests/structure/content-inventory.test.ts` against the delivered testkit file set: every `src/conformance/*.ts` listed exactly once; every exported function/const named; `types.ts` and `src/index.ts` need no allowance; no non-conformance file gained an allowance; no global switch. Add the missing-file and undeclared-export mutation controls if not already present. (TC-CONF-030)
- [x] **P7.4** Run the invariant battery: `bun run scripts/checks/testkit-exclusion.ts` (testkit dev-only, no published graph), `bun run scripts/checks/workspace-entrypoints.ts` and `bun test tests/structure/subpaths.test.ts` (no new subpath or edge), `bun run scripts/checks/ci-topology.ts`, `bun run scripts/checks/ci-bindingness.ts`, `bun run scripts/checks/ci-supply-chain.ts`, `bun test tests/checks/ci-checks.test.ts` (exact job sets, no conformance job). (TC-CONF-029, TC-CONF-032)
- [x] **P7.5** Prove the read-only scans do not mutate the tree: capture `git status --porcelain` before and after the boundary, sanitization, secret-read, and topology scans and assert equality; confirm no file was written under `packages/**` by any control. (TC-CONF-028, TC-CONF-031, TC-CONF-032)

**Acceptance Criteria**:

- Must: a `node:*` import in testkit conformance source violates `runtime-apis-confinement`; an allowed-location clean control passes (AC-F7-5).
- Must: a planted `process`/`Bun` read in `packages/testkit/src/conformance/probe.ts` fires by file and line; allowlist stays exactly four (AC-F7-5).
- Must: inventory equals the actual testkit file set and allowances are per file; missing entry and undeclared export fail by name (NFR-9).
- Must: no new subpath/edge; testkit dev-only; pinned job sets unchanged; no `conformance` job (AC-F6-2, NFR-4).

**Files and modules**:

- Code areas: `tests/boundaries/fixtures/cases.ts` (updated), `tests/boundaries/fixture-registry.json` (updated), `tests/fixtures/secret-boundary/cases.ts` (updated), `tests/checks/secret-read-boundary.test.ts` (updated), `tests/structure/inventory.json` (reconciled), `tests/structure/content-inventory.test.ts` (reconciled).
- System docs: none.

**Tests**:

- `bun test tests/boundaries`
- `bun test tests/checks/secret-read-boundary.test.ts`
- `bun run scripts/checks/secret-read-boundary.ts`
- `bun test tests/structure/content-inventory.test.ts`
- `bun run scripts/checks/testkit-exclusion.ts`
- `bun run scripts/checks/workspace-entrypoints.ts`
- `bun test tests/structure/subpaths.test.ts`
- `bun run scripts/checks/ci-topology.ts`
- `bun run scripts/checks/ci-bindingness.ts`
- `bun run scripts/checks/ci-supply-chain.ts`
- `bun test tests/checks/ci-checks.test.ts`

**Exit criteria**: All invariant suites green; boundary fixture registered and firing; secret-read allowlist exactly four; no tree mutation from read-only scans; no new edge/subpath/job.

**Completion signal**: `test(GH-189): enforce testkit confinement, secret-read, inventory and CI topology invariants`

---

### Phase P8: Verification, spec reconciliation, and release

**Goal**: Run the full battery, record real evidence for all 22 ACs, reconcile the system spec through the doc-sync owner, add the minor release intent, and hand off the PR.

**Tasks**:

- [x] **P8.1** Run the full verification battery and record outcomes, never claiming an unrun command as passing: `pnpm install --frozen-lockfile`, `pnpm check`, `bun test tests/conformance tests/structure tests/checks tests/boundaries`, `bun test tests/structure`, `bun run scripts/checks/license-audit.ts`, `bun run scripts/checks/privacy-literals.ts`, `bun run scripts/checks/forbidden-literals.ts`, `git diff --check`, and the measured mock wall clock (`/usr/bin/time -f '%e s' bun test tests/conformance/mock-conformance.test.ts`). Canary shapes for TC-CONF-017/TC-CONF-019 must reuse the existing allowlisted fixture roots (`tests/fixtures/providers/sanitization/cases.ts`, `tests/fixtures/privacy-literals/`) rather than embedding new literal secrets or private literals. Record commands and observed results in this plan's Execution Log; hand the same evidence to `@pm` for the test-plan owner to populate test-plan §10. Do **not** edit the test plan. (TC-CONF-033, AC-F6-1, NFR-9)
- [x] **P8.2** Record change-scoped CI evidence: `git diff --exit-code "$(git merge-base HEAD origin/main-tools)" -- .github/workflows/ci.yml` must be empty; confirm no new `ci.yml` job, trigger, permission, or step; run `bun run scripts/checks/ci-topology.ts`, `bun run scripts/checks/ci-supply-chain.ts`, and `bun test tests/structure/legacy-confinement.test.ts` (the repository-wide invariant that scans every `.github/workflows/*.yml`, now including `conformance-live.yml`) once more. (TC-CONF-032, AC-F6-2)
- [x] **P8.3** Reconcile the system spec (doc-sync owner; coordinate through `@pm`/`@doc-syncer`): create `doc/spec/features/feature-adapter-conformance.md` (front matter `ados_distribution: internal`, `id: SPEC-ADAPTER-CONFORMANCE`, `status: Current`, `created`/`last_updated`, `owners`, `service`, `summary`, `links.related_changes: ["GH-189"]`, `links.related_decisions: ["ADR-0003", "ADR-0005"]`) documenting the three flows, capability gating, coverage gates, mock/live tiers, the `delivery.conformance.v1` schema and D-1 caps, the D-3 provider statuses, the D-6 live variable names, and the D-13 read-only rule; update `doc/spec/features/feature-provider-client-seeds.md` (live revalidation now delivered; fixture-drift mitigation; consumed-by list), `doc/spec/features/feature-monorepo-scaffold-toolchain.md` (testkit now carries the conformance suite; no package/subpath/edge change), `doc/spec/features/feature-adapter-ports.md` (cross-reference only), `doc/overview/glossary.md` (conformance terms, related changes), and `doc/00-index.md` (feature entry). The new feature spec is a new user-facing doc under `doc/`, so add its path to the `registered` list in `scripts/checks/forbidden-literals.registry.json` (a new doc absent at the corpus baseline must be registered) and keep its body free of the case-insensitive `ados`/`ADOS` seed literal by using neutral wording (for example "the delivery system", "this repository"); the `ados_distribution:` front-matter line is covered by the existing `source-headers` line allowlist. Update `.ai/rules/testing-strategy.md` for the new `tests/conformance` layer (runner line plus module-to-test mapping). Run `bash scripts/.tests/test-doc-distribution.sh`, `bun run scripts/checks/privacy-literals.ts`, and `bun run scripts/checks/forbidden-literals.ts`. (AC-F7-5, AC-F8-1 documentation evidence; spec §16)
- [x] **P8.4** Add the release intent `.changeset/gh-189-adapter-conformance-minor.md` with the fixed five-package group (`@delivery-os/core`, `adapters`, `cli`, `mcp`, `opencode`) at `minor`, matching the spec `version_impact: minor`. No publish occurs here. (NFR-9, release convention) — delivered in P4 because the release guard requires exactly one added changeset for `pnpm test` to pass; validated here.
- [x] **P8.5** Build the AC evidence matrix: for each of the 22 ACs, record the phase, task, TC ID, command, and observed result; walk the §18 DoD predicates that this execution phase can observe (mock green in both jobs, structural/runtime gates firing, broken control naming provider/flow/step, `not-configured` artifact, workflow contract pass, zero mutations, allowlist four, sanitization green, `pnpm check` green, `ci.yml` unchanged, docs synchronized). Record the "open unmerged PR targets `main-tools` with required jobs green" predicate as a phase-11 lifecycle handoff with the plan's evidence attached, not as a completed phase task. (All ACs)
- [x] **P8.6** Hand off: update the plan Execution Log for P1–P8, list the delivered artifacts and the exact commands/results, and note open lifecycle steps (system-spec update PR review, `@reviewer` audit, `@runner` quality gates, `@pm` DoD check, `@pr-manager` PR creation on `feat/GH-189/adapter-conformance-suite` targeting `main-tools`). Do not push or create the PR in this phase. (Handoff)

**Acceptance Criteria**:

- Must: `pnpm check` green (lint, format, typecheck, test, boundaries, exports-parity) with the conformance suite discovered (AC-F6-1, NFR-9).
- Must: `ci.yml` byte-unchanged at review; topology/bindingness/supply-chain green; no new job (AC-F6-2, NFR-4).
- Must: every one of the 22 ACs has recorded evidence; no unrun command is marked passing (§18 DoD).
- Must: docs synchronized and the doc-distribution guard green; minor changeset present.
- Must: `privacy-literals` and `forbidden-literals` pass, the new feature spec is registered and free of the forbidden seed literal, and `tests/structure` (including the repository-wide workflow invariant) is green.
- Must: a valid artifact is produced for every live status; zero mutation requests and zero created artifacts recorded (AC-F7-1, AC-F9-1).

**Files and modules**:

- Code areas: none (verification only), except `.changeset/gh-189-adapter-conformance-minor.md` (new) and `scripts/checks/forbidden-literals.registry.json` (adds the new spec path to `registered`).
- System docs: `doc/spec/features/feature-adapter-conformance.md` (new), `doc/spec/features/feature-provider-client-seeds.md` (updated), `doc/spec/features/feature-monorepo-scaffold-toolchain.md` (updated), `doc/spec/features/feature-adapter-ports.md` (cross-reference), `doc/overview/glossary.md` (updated), `doc/00-index.md` (updated), and `.ai/rules/testing-strategy.md` (runner line and module-to-test mapping for the `tests/conformance` layer).

**Tests**:

- `pnpm install --frozen-lockfile`
- `pnpm check`
- `bun test tests/conformance tests/structure tests/checks tests/boundaries`
- `bun test tests/structure`
- `bun run scripts/checks/license-audit.ts`
- `bun run scripts/checks/privacy-literals.ts`
- `bun run scripts/checks/forbidden-literals.ts`
- `git diff --check`
- `git diff --exit-code "$(git merge-base HEAD origin/main-tools)" -- .github/workflows/ci.yml`
- `bash scripts/.tests/test-doc-distribution.sh`
- `/usr/bin/time -f '%e s' bun test tests/conformance/mock-conformance.test.ts`

**Exit criteria**: Full battery green; AC evidence complete; docs and changeset landed; handoff recorded; working tree contains only intended files.

**Completion signal**: `chore(GH-189): reconcile conformance spec, record release intent and gate evidence`

---

## Test Scenarios

All 33 test cases from the completed test plan land in a phase. TC IDs, AC traces, and target files follow test-plan §§5–7; this plan only fixes phase assignment and the D-1..D-15 decisions.

| TC ID | Scenario | AC | Phase(s) | Suite / file |
|---|---|---|---|---|
| TC-CONF-001 | Flow registry shape and closed-operation representation | AC-F1-1 | P1 | `tests/structure/conformance-coverage.test.ts`; `packages/testkit/src/conformance/{flows,types}.ts` |
| TC-CONF-002 | Adapter registry completeness and contract binding | AC-F3-2 | P2 | `tests/structure/conformance-coverage.test.ts`; `conformance/adapters.ts` |
| TC-CONF-003 | Provider-contract registration scan fails on an unregistered contract | AC-F3-1 | P2 | `tests/structure/conformance-coverage.test.ts`; adapters source scan |
| TC-CONF-004 | Structural step and carrier coverage per adapter | AC-F2-3, AC-F5-1 | P3 | `tests/structure/conformance-coverage.test.ts`; `conformance/coverage.ts` |
| TC-CONF-005 | Structural non-vacuity floors and mutation controls | AC-F1-1, AC-F5-1 | P1 (flow floors), P3 (adapter floors) | `tests/structure/conformance-coverage.test.ts` |
| TC-CONF-006 | Mock suite green for GitHub, GitLab, and Jira | AC-F2-1, AC-F6-1 | P4 | `tests/conformance/mock-conformance.test.ts` |
| TC-CONF-007 | GitHub operation matrix and primitive assertions | AC-F1-2, AC-F2-1 | P4 | `mock-conformance.test.ts`; github tenant |
| TC-CONF-008 | GitLab operation matrix and primitive assertions | AC-F1-2, AC-F2-1 | P4 | `mock-conformance.test.ts`; gitlab tenant |
| TC-CONF-009 | Jira operation matrix and primitive assertions | AC-F1-2, AC-F2-1 | P4 | `mock-conformance.test.ts`; jira tenant |
| TC-CONF-010 | Undeclared unsupported operation and silent-skip guard | AC-F2-1, AC-F2-2 | P3 | `mock-conformance.test.ts`; `conformance/{runner,coverage}.ts` |
| TC-CONF-011 | Runtime coverage gates execute supported operations and encounter every gap | AC-F2-2, AC-F5-1 | P3 | `mock-conformance.test.ts`; `conformance/coverage.ts` |
| TC-CONF-012 | Comment-provenance read half and shipped carrier skip | AC-F2-3 | P4 (read half), P3 (carrier skip) | `mock-conformance.test.ts`; jira tenant |
| TC-CONF-013 | Carrier roundtrip control and `no-declared-carrier` skip | AC-F2-3, AC-F5-1 | P3 | `mock-conformance.test.ts`; control adapters |
| TC-CONF-014 | Deterministic double replay with injected clock and run id | AC-F4-2 | P3, P4 | `mock-conformance.test.ts` |
| TC-CONF-015 | Exact-URL replay, throwing-fetch guard, unfixtured failure | AC-F4-1 | P3 | `mock-conformance.test.ts`; support fixtures |
| TC-CONF-016 | Broken adapter control fails by provider, flow, and step | AC-F5-2, AC-F6-2 | P4 | `tests/conformance/broken-adapter-control.test.ts` |
| TC-CONF-017 | Failure diagnostics and redaction | AC-F10-1, AC-F8-1 | P4 | `broken-adapter-control.test.ts`; `conformance/runner.ts` |
| TC-CONF-018 | Artifact schema validation for `delivery.conformance.v1` | AC-F8-1 | P5 | `tests/conformance/artifact.test.ts`; `conformance/artifact.ts` |
| TC-CONF-019 | Artifact bounds and redaction | AC-F8-1 | P5 | `artifact.test.ts`; `conformance/artifact.ts` |
| TC-CONF-020 | Artifact status matrix, write-in-every-status, and exit codes | AC-F7-1, AC-F7-2, AC-F7-3 | P5 | `artifact.test.ts`; `live/live-entrypoint.test.ts` |
| TC-CONF-021 | Live not-configured behavior and missing-variable reporting | AC-F7-1, AC-F7-2 | P5 | `live/live-entrypoint.test.ts`; `live/config.ts`; `live/run-live.ts` |
| TC-CONF-022 | Configured-provider live failure | AC-F7-1, AC-F7-3 | P5 | `live/live-entrypoint.test.ts`; `live/run-live.ts` |
| TC-CONF-023 | Live read-only, zero-mutation, and zero-created-artifact proof | AC-F9-1 | P5 | `live/live-entrypoint.test.ts`; `live/recording-transport.ts` |
| TC-CONF-024 | Live configuration reader and credential-port exclusivity | AC-F7-5 | P5 | `live/config.ts`; `live/live-entrypoint.test.ts` |
| TC-CONF-025 | Live injection determinism and no ambient time/randomness | AC-F4-2, NFR-1 | P5 | `live/live-entrypoint.test.ts`; `support/testkit-source-scan.ts` |
| TC-CONF-026 | Scheduled workflow contract | AC-F7-1, AC-F7-4 | P6 | `tests/checks/conformance-workflow.test.ts`; `conformance-live.yml` |
| TC-CONF-027 | Scheduled workflow mutation controls | AC-F7-4 | P6 | `tests/checks/conformance-workflow.test.ts` |
| TC-CONF-028 | Secret-read allowlist stays exactly four | AC-F7-5 | P7 (P3/P5 gates) | `tests/checks/secret-read-boundary.test.ts`; `scripts/checks/secret-read-boundary.ts` |
| TC-CONF-029 | Testkit confinement and dev-only edges | AC-F7-5 | P7 (P1–P3 gates) | `tests/boundaries/**`; `testkit-exclusion`; `workspace-entrypoints` |
| TC-CONF-030 | Content inventory and executable allowances updated | NFR-9 | P1, P2, P3, P5, P7 | `tests/structure/content-inventory.test.ts`; `inventory.json` |
| TC-CONF-031 | Conformance fixtures sanitized, provenance-marked, placeholders declared | AC-F4-3 | P2 | `tests/checks/fixture-sanitization.test.ts`; tenants; `placeholders.json` |
| TC-CONF-032 | CI topology, bindingness, supply chain, and `ci.yml` byte-unchanged | AC-F6-2, NFR-4 | P6, P7, P8 | `scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain}.ts`; `tests/checks/ci-checks.test.ts` |
| TC-CONF-033 | Aggregate gate and test discovery | AC-F6-1, NFR-9 | P8 | `package.json`; `bunfig.toml`; all suites |

### AC → task traceability (22/22)

| AC | Tasks / phases | Primary TC(s) |
|---|---|---|
| AC-F1-1 | P1.2, P1.5, P1.6; P3.3, P3.4 | TC-CONF-001, TC-CONF-005 |
| AC-F1-2 | P3.1, P3.2; P4.1 | TC-CONF-007, TC-CONF-008, TC-CONF-009 |
| AC-F2-1 | P3.1; P4.1 | TC-CONF-006, TC-CONF-007, TC-CONF-008, TC-CONF-009, TC-CONF-010 |
| AC-F2-2 | P3.1 (declared-gap requirement), P3.3, P3.4 | TC-CONF-010, TC-CONF-011 |
| AC-F2-3 | P1.2 (carrier step), P2.4 (Jira comments), P3.1 (carrier gating), P3.4, P4.1 | TC-CONF-004, TC-CONF-012, TC-CONF-013 |
| AC-F3-1 | P2.1, P2.6 | TC-CONF-003 |
| AC-F3-2 | P2.1, P2.6 | TC-CONF-002 |
| AC-F4-1 | P2.2, P3.4 | TC-CONF-015 |
| AC-F4-2 | P3.1 (injected clock/run id), P3.4, P5.6 | TC-CONF-014, TC-CONF-025 |
| AC-F4-3 | P2.4, P2.6 (audit regression) | TC-CONF-031 |
| AC-F5-1 | P3.3, P3.4, P4.1 | TC-CONF-004, TC-CONF-005, TC-CONF-011, TC-CONF-013 |
| AC-F5-2 | P4.2 | TC-CONF-016 |
| AC-F6-1 | P4.1, P8.1 | TC-CONF-006, TC-CONF-033 |
| AC-F6-2 | P4.2, P6.3, P7.4, P8.2 | TC-CONF-016, TC-CONF-032 |
| AC-F7-1 | P5.1, P5.5, P5.6, P6.1, P6.2 | TC-CONF-020, TC-CONF-021, TC-CONF-022, TC-CONF-026 |
| AC-F7-2 | P5.3, P5.5, P5.6, P5.8 | TC-CONF-021 |
| AC-F7-3 | P5.5, P5.6 | TC-CONF-022 |
| AC-F7-4 | P6.1, P6.2, P7.4 | TC-CONF-026, TC-CONF-027, TC-CONF-032 |
| AC-F7-5 | P5.3, P5.6, P7.1, P7.2 | TC-CONF-024, TC-CONF-028, TC-CONF-029 |
| AC-F8-1 | P1.3, P5.1, P5.2, P5.6 | TC-CONF-018, TC-CONF-019, TC-CONF-020 |
| AC-F9-1 | P5.4, P5.5, P5.6 (plus P3.4 mock offline) | TC-CONF-023, TC-CONF-015 |
| AC-F10-1 | P3.1, P4.2 | TC-CONF-016, TC-CONF-017 |

Ticket-AC trace: ticket AC-1 (mock green for every shipped adapter) → TC-CONF-006/007/008/009/033 across P4/P8; ticket AC-2 (scheduled live run records an artifact) → TC-CONF-020/021/022/026 across P5/P6; ticket AC-3 (an adapter change that breaks a flow fails CI) → TC-CONF-016/032 plus the existing `pnpm test` jobs.

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Change specification | [chg-GH-189-spec.md](./chg-GH-189-spec.md) | Source of requirements: F-1–F-10, DM-1–DM-8, NFR-1–NFR-9, DEC-1–DEC-15, ACs, §22 env names, §24 matrix |
| Test plan | [chg-GH-189-test-plan.md](./chg-GH-189-test-plan.md) | Source of TC-CONF-001..033, target layers, §7.2 gate battery, §8.3 OQs |
| PM notes | `./chg-GH-189-pm-notes.yaml` | Read-only orchestration context and clarify decisions |
| This plan | `./chg-GH-189-plan.md` | Only file written by this authoring pass |
| Concept (planning) | [concepts/adapter-conformance.md](../../../planning/concepts/adapter-conformance.md) | Flow families and tiers; remains a planning artifact, not current truth |
| ADR-0003 | [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) | Testkit placement, dev edges, live evidence-not-gate |
| ADR-0005 | [ADR-0005](../../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) | Provider-subpath confinement; testkit stays non-I/O |
| Testing strategy | [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Layer-to-gate mapping, fixture rules |
| TS rules | [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) | Strict-TS, purity, ports/adapters — read before editing |
| Existing provider seeds | `packages/adapters/src/{github,gitlab,jira}/` | Production clients and contracts consumed by the registry; unchanged |
| Existing trap harness | `tests/behaviour/providers/support.ts` | Reused throwing-`fetch` guard and fixture-transport pattern |
| New system spec | `doc/spec/features/feature-adapter-conformance.md` (P8, new) | Current truth for the suite, tiers, gates, artifact, env names, caps |
| Updated system specs | `doc/spec/features/feature-provider-client-seeds.md`, `feature-monorepo-scaffold-toolchain.md`, `feature-adapter-ports.md`, `doc/overview/glossary.md`, `doc/00-index.md` (P8) | Reconciliation only; owned by `@doc-syncer` |
| Release intent | `.changeset/gh-189-adapter-conformance-minor.md` (P8) | Five-package fixed group, minor |
| House-format precedent | [chg-GH-188-plan.md](../2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-plan.md) | Phase structure, gate ordering, execution-log style |

Protected paths untouched by every phase: `packages/core/**`, `packages/adapters/**` production source and manifests, `.github/workflows/ci.yml`, `tests/checks/ci-checks.test.ts`, `scripts/checks/secret-read-boundary.ts`, `tests/structure/subpaths.test.ts` expectations, `tools/`, `.opencode/`, `.ados-claude/`, `doc/planning/concepts/adapter-conformance.md`.

### Handoff (@pm / @coder)

- **@coder**: execute P1 → P8 in order, one Conventional Commit per phase with scope `GH-189`, never touching the protected paths. Run `pnpm build` before every narrow `bun test`; run the phase's listed commands and record actual outcomes in the Execution Log (never mark an unrun command passing). Stop after P8: do not push, open the PR, or edit the spec/test plan.
- **@pm**: route the plan through the Definition of Ready gate first. After P8, coordinate `@doc-syncer` (P8.3), `@reviewer`, `@runner`, the DoD check, and `@pr-manager` (branch `feat/GH-189/adapter-conformance-suite` → `main-tools`); own the test-plan §10 evidence handoff and the OQ-1 tenant-provisioning action (repository variables and the three token secrets named in spec §22). A scheduled live run before tenants exist is expected to be `not-configured` and is not a failure.
- **Rollback owner**: if any phase is reverted, revert the phase commits in reverse order as one coherent unit; do not split a flow step from its mock route/projection/assertion, the registry from its gate, the artifact schema/caps from its validator, or the live composition from its workflow.

### Remediation Phase P11 (review iteration 1)

Review iteration 1 returned PASS with zero blocker/major findings. This phase discharges the five low findings and the two cheap info items so the delivered evidence is non-vacuous and the artifact reports only actually-missing names. It changes no AC scope and no production package.

- [x] **P11.1 (F-1)** In `tests/conformance/live/run-live.ts`, build `missingSettings` for a `not-configured` provider from `entry.missingSettings` (the actually-missing names), not the full documented name set. Keep the no-tenant case at 15 names (7/5/3) and add/adjust a partial-configuration assertion: when exactly one GitHub setting is blanked, only that name is listed. Align any test comment that currently blesses the full set. (AC-F7-2, AC-F8-1, DEC-12)
- [x] **P11.2 (F-2)** Add a primitive-purity positive control in `tests/conformance/mock-conformance.test.ts`: a test-only client/control returns a normalized view carrying a forbidden native key (for example `html_url`/`fields`/`web_url`), and the step must fail with assertion `primitive-purity` naming the offending path. Prove the unmodified control passes. (AC-F10-1, NFR-3)
- [x] **P11.3 (F-3)** Replace the tautological `packages/*/src` test in `tests/conformance/live/live-entrypoint.test.ts` with a real assertion that every scanned production source file lacks the live-reader import and the `CONFORMANCE_LIVE_` token names; do not assert the scan-prefix tautology. (AC-F7-5)
- [x] **P11.4 (F-4)** Implement TC-CONF-020 step 6 as a real control: run `runLive` with a failure-triggering transport and a writer that does not record, then assert the artifact-presence check fails (or explicitly reframe the control to the status-matrix proof with no self-fulfilling array access). (AC-F7-1, AC-F7-3)
- [x] **P11.5 (F-5)** Include the request descriptor (method + URL) in the failed step's reference/detail when the mock transport recorded the attempted request, or otherwise make the diagnostic name it; then assert TC-CONF-006 step 6 / TC-CONF-015 step 3 against the actual message. Do not weaken the test-plan claim. (AC-F4-1, AC-F10-1)
- [x] **P11.6 (F-8, F-9)** Assert `mutationRequests === 0` and `createdArtifacts === 0` for the `not-configured` path too; pass `createNativeFetchTransport` directly from the process wrapper and let `runLive` own the single recording wrapper (remove the redundant double recording). (AC-F9-1)
- [x] **P11.7** Re-run `pnpm build`, `bun test tests/conformance`, `bun test tests/structure`, `bun test tests/checks`, `bun test tests/boundaries`, `pnpm check`, the invariant scripts, doc-distribution, and the `ci.yml` byte-diff; update the Execution Log with actual results; one Conventional Commit `fix(GH-189): ...` (scope `GH-189`). Protected paths stay untouched. (TC-CONF-006/015/017/020/023, NFR-3, NFR-8)

**P11 acceptance:** all five low findings have a firing control or a corrected behavior, no AC/TC identity changes, all gates green, and the review can re-run with no open finding above info. DoR NIT F-7 (plan wording) is recorded in the revision log as "cross-reference plus frontmatter cleanup"; no code change.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T19:40:00Z | Implementation Plan Writer | Initial eight-phase, 43-task plan: testkit types/flow registry/artifact constants (P1) → adapter registrations/mock tenants/audited fixtures (P2) → capability-gated runner/assertions/coverage gates (P3) → mock suite plus broken-adapter control (P4) → artifact validator and read-only live composition/entrypoint (P5) → scheduled workflow plus contract test (P6) → boundary/secret/inventory/topology hardening (P7) → full gates, spec reconciliation and release (P8). Resolves test-plan OQ-A..E (artifact caps, `--out`, provider status enum, configured-vs-unconfigured, measured mock budget) and the live-config/Bun/`if: always()` integration details (D-1..D-15). Records one non-blocking spec/test-plan inconsistency (Jira live setting count) in favour of spec §22 and two resolved ambiguities. 22/22 AC and 33/33 TC mapped; rollback/scope-proof and handoff sections included; no other file written. |
| 1.1 | 2026-10-31T19:55:00Z | Implementation Plan Writer | Verification pass over the completed spec (v1.0), test plan (v1.0), and live repo surfaces; plan remains `status: Proposed` pending the DoR gate. Corrected the task count to 43 (P1 6 + P2 6 + P3 6 + P4 4 + P5 7 + P6 3 + P7 5 + P8 6). Resolved the artifact-shape ambiguity in D-9 so top-level `flows[]` carry nested `steps[]` (spec §24 / TC-CONF-018 step 2) and top-level `steps[]` remains the flat index (TC-CONF-018 step 1), instead of the earlier canonical-flat-only reading. Fixed P3.4 to assign TC-CONF-004/TC-CONF-005 adapter floors to `tests/structure/conformance-coverage.test.ts` and keep only runner controls in `tests/conformance/mock-conformance.test.ts`. Clarified the local test-only `SYNTHETIC_BRAND` for `createProcessCredentialPort`, the reuse of existing 40-hex workflow pins, the no-edit handoff of test-plan §10 evidence, and the phase-11 handoff of the open-PR DoD predicate. No AC/TC identity, phase count, or scope changed; spec and test plan untouched. |
| 1.2 | 2026-10-31T20:45:00Z | Implementation Plan Writer | DoR iteration-1 remediation against spec v1.1 and test plan v1.1 (plan remains `status: Proposed`; eight phases and all AC/TC identities unchanged). **B-1:** D-6/P5.3 now define configured as present **and non-empty (non-whitespace)** for every non-secret setting and the token source key, with `undefined`/`""`/whitespace-only MISSING, the real GitHub Actions present-but-empty shape yielding `not-configured`/exit 0, the 15-name list retained, and the token source key inspected only for occupancy while authorization stays in the adapters `./credentials` CredentialPort; new P5.8 adds the absent/present-but-empty/whitespace-only live-entrypoint matrix (exit 0, 15 names, zero credential resolution, zero provider requests) and per-provider occupancy (task count 44). **B-2:** INCONSISTENCY-1 rewritten as resolved by test plan v1.1 (Jira two settings + token; 15 names). **Advisory 3:** P6.1/P6.2 require `if-no-files-found: error`, `--out` == upload `path` under one normalized `$RUNNER_TEMP` spelling, and wrong-path/missing-file/`warn` mutation controls. **Advisory 4:** P3.1/P3.4 add the optional test-only carrier-roundtrip/write handler and the exact `change-lifecycle.comment` outcome on write-capable controls (executes through the handler, asserted in TC-CONF-013). **Advisory 5:** P2.6 fixes the declaration-only, per-adapter-deduped registration scan (three declarations, not six raw occurrences) with re-export and new-declaration controls. **Advisory 6:** D-9 aligned to spec v1.1 §24 wording (provider flow summaries, canonical nested `flows[]`, flat `steps[]`, closed `skipKind`). **Advisory 7:** P8.1/P8.3 add `privacy-literals`/`forbidden-literals`, reuse the allowlisted canary fixture roots, register the new feature spec, and keep it free of the case-insensitive seed literal. **Advisory 8:** DEC-15 summary narrowed to `ci.yml`-scoped supply-chain/bindingness with repository-wide structure invariants, and `bun test tests/structure` added to P6/P8. **NIT 9:** stale EDITORIAL-1 removed. **NIT 12:** P3.4 now "creates" and P4.1 "complete/extends" `tests/conformance/mock-conformance.test.ts`. Only this plan file written; no git/build/test operations. |
| 1.3 | 2026-10-31T21:30:00Z | Implementation Plan Writer | DoR iteration-2 alignment pass against spec v1.2 and test plan v1.2 (plan remains `status: Proposed`; eight phases, 44 tasks, 22 ACs and 33 TCs unchanged). **Advisory 3:** P3.1 now requires a supported non-read step with no handler to fail closed naming **provider, flow, step, and operation**, and P3.4 adds the matching no-handler control so TC-CONF-010 step 4 and TC-CONF-013 steps 2–6 are fully covered. **Advisory 4:** P6.2 replaces the inexecutable "missing artifact file" mutation with the static `validateWorkflowRoot` controls from TC-CONF-027 step 5 — a missing/empty upload `path` or an upload `path` that cannot be resolved against the entrypoint `--out` to one file fails the contract test, with wrong-`--out` and `if-no-files-found: warn` controls retained; the "produces nothing cannot upload green" guarantee is carried by `if-no-files-found: error` plus TC-CONF-020's writer-in-every-status proof, and no artifact file is written or removed at contract-test time. **D-9:** confirmed the flat `steps[]` entries carry `provider` and `flowId`, matching spec v1.2 §24 and TC-CONF-018 step 4; only the version reference changed. **Version references:** active references now point at spec v1.2 and test plan v1.2; the 1.0–1.2 revision rows keep their historical versions. Only this plan file written; no git/build/test operations. |
| 1.4 | 2026-10-31T22:20:00Z | @pm | Review-iteration-1 remediation phase P11 appended after the PASS verdict with five low and two info findings (F-1 actual missing names, F-2 primitive-purity positive control, F-3 vacuous source-scan test, F-4 self-fulfilling writer control, F-5 request descriptor in diagnostics, F-8 not-configured counters, F-9 duplicate recording wrapper). No AC/TC identity, phase count, or scope change. P8.3's `feature-adapter-ports.md` update is recorded as "cross-reference plus duplicate-frontmatter cleanup" (F-7). |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| Authoring | Complete | 2026-10-31T19:25:00Z | 2026-10-31T19:55:00Z | none | Read the completed spec (v1.0), test plan (v1.0), PM notes, ticket GH-189, concept, ADR-0003/0005, `.ai/rules/{testing-strategy,typescript}.md`, and the live repo surfaces (testkit manifest/index, provider clients/contracts, normalize signatures, transport seam, credentials port, inventory/allowance mechanics, fixture sanitization, placeholder registry, secret-read boundary, dependency-cruiser rules, boundary harness/fixtures/registry, CI job sets and supply-chain/pin checks, changeset convention, doc markers). Revision 1.1 re-checked the 22 ACs and 33 TCs, corrected the task count (43), fixed D-9's artifact nesting to match spec §24/TC-CONF-018, and re-pointed P3.4's structural cases to the structure suite. Only this plan file written; no git/build/test operations. |
| P1 | Complete | 2026-10-31T22:00:00Z | 2026-10-31T22:10:00Z | see git | Types, flow registry, artifact constants, inventory/allowance, TC-CONF-001/005 flow floors. Evidence: `pnpm build` OK; `bun test tests/structure/conformance-coverage.test.ts tests/structure/content-inventory.test.ts` → 16 pass / 0 fail; `bun test tests/structure` → 268 pass / 0 fail. |
| P2 | Complete | 2026-10-31T22:12:00Z | 2026-10-31T22:30:00Z | see git | Adapter registry, mock-tenancy replay, three tenants, TC-CONF-002/003/031. Evidence: `pnpm build` OK; `bun test tests/structure/conformance-coverage.test.ts tests/structure/content-inventory.test.ts tests/checks/fixture-sanitization.test.ts tests/checks/secret-read-boundary.test.ts` → 48 pass / 0 fail; `bun test tests/structure` → 277 pass / 0 fail. Note: GitLab tenant uses a single-segment `project-placeholder` path to avoid an artificial URL-encoded placeholder token. |
| P3 | Complete | 2026-10-31T22:32:00Z | 2026-10-31T23:05:00Z | see git | Runner, assertions, coverage gates, control tests, TC-CONF-004/005/010/011/013/014/015. Evidence: `pnpm build` OK; `bun test tests/conformance/mock-conformance.test.ts tests/structure/conformance-coverage.test.ts` → 52 pass / 0 fail; `bun test tests/structure` → 289 pass / 0 fail; `bun test tests/structure/content-inventory.test.ts tests/boundaries` → 138 pass / 0 fail; `bun run scripts/checks/secret-read-boundary.ts` → OK (106 files, 4 allowlisted). |
| P4 | Complete | 2026-10-31T23:07:00Z | 2026-10-31T23:30:00Z | see git | Full mock matrices and broken-adapter control, TC-CONF-006/007/008/009/012/016/017; measured wall clock. Evidence: `pnpm build` OK; `bun test tests/conformance` → 40 pass / 0 fail; `/usr/bin/time -f '%e s' bun test tests/conformance/mock-conformance.test.ts` → 0.04 s (36 ms observed, well under 60 s); `bun test tests/structure/content-inventory.test.ts` → 6 pass / 0 fail; `pnpm test` → 1684 pass / 2 skip / 0 fail across 152 files. Deviation: the five-package minor changeset was added in P4 instead of P8.4 because the release guard requires it for `pnpm test` to pass; P8.4 validates it. |
| P5 | Complete | 2026-10-31T23:32:00Z | 2026-11-01T00:05:00Z | see git | Artifact validator, live config/transport/entrypoint, TC-CONF-018..025. Evidence: `pnpm build` OK; `bun test tests/conformance` → 77 pass / 0 fail across 4 files (run-live.ts not discovered); `bun test tests/conformance/live` → 24 pass / 0 fail incl. the spawned not-configured entrypoint; `bun test tests/structure` → 289 pass / 0 fail; `bun run scripts/checks/secret-read-boundary.ts` → OK (106 files, 4 allowlisted). |
| P6 | Complete | 2026-11-01T00:07:00Z | 2026-11-01T00:25:00Z | see git | `conformance-live.yml` and contract/mutation tests, TC-CONF-026/027/032. Evidence: `bun test tests/checks/conformance-workflow.test.ts` → 8 pass / 0 fail (28 assertions); `bun run scripts/checks/ci-supply-chain.ts` → OK; `ci-bindingness.ts` → OK; `bun test tests/checks/ci-checks.test.ts` → 27 pass / 0 fail; `bun test tests/structure` → 289 pass / 0 fail. ci.yml untouched. |
| P7 | Complete | 2026-11-01T00:27:00Z | 2026-11-01T00:50:00Z | see git | Boundary fixture, secret-read case, inventory reconciliation, topology checks, TC-CONF-028/029/030/032. Evidence: `bun test tests/boundaries` → 133 pass / 0 fail (incl. the registered testkit node:* negative fixture and fixture-coverage meta-check); `bun test tests/checks/secret-read-boundary.test.ts` → 18 pass / 0 fail (planted testkit reads fire; allowlist exactly 4, no testkit entry); `bun run scripts/checks/{testkit-exclusion,workspace-entrypoints,ci-topology,ci-bindingness,ci-supply-chain}.ts` → all OK; `bun test tests/structure/subpaths.test.ts` → 3 pass; `bun test tests/checks/ci-checks.test.ts` → 27 pass; `git status --porcelain` identical before and after the read-only scans. Inventory/allowances reconcile every conformance file exactly once, types.ts and index.ts without allowances. |
| P8 | Complete | 2026-11-01T00:52:00Z | 2026-11-01T01:25:00Z | see git | `pnpm check`, `ci.yml` byte-diff, doc sync, changeset validation, AC evidence, handoff, TC-CONF-033. Evidence: `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (1731 pass / 2 skip / 0 fail across 155 files; depcruise 125 modules; secret-read 106 files / 4 allowlisted; exports-parity 5 publishables); `bun test tests/conformance tests/structure tests/checks tests/boundaries` → 837 pass / 0 fail across 70 files; `bun test tests/structure` → 289 pass; `bun test tests/structure/legacy-confinement.test.ts` → 7 pass; `license-audit`, `privacy-literals`, `forbidden-literals` → OK; `git diff --check` exit 0; `git diff --exit-code ... ci.yml` exit 0; `bash scripts/.tests/test-doc-distribution.sh` exit 0; measured mock wall clock 0.07 s. Docs reconciled and `.ai/rules/testing-strategy.md` updated. |
| P11 | Complete | 2026-10-31T19:50:00Z | 2026-10-31T19:57:46Z | see git | Review-iteration-1 remediation F-1/F-2/F-3/F-4/F-5/F-8/F-9. Code: `run-live.ts` reports `entry.missingSettings` and passes `createNativeFetchTransport` directly (single recording wrapper); `runner.ts` appends the attempted request descriptor (method + URL) to a failed read's reference/detail when the transport exposes its log. Tests: partial-config expectation now `["CONFORMANCE_LIVE_GITHUB_OWNER"]`; primitive-purity positive control (`html_url`, `received === "html_url"`) plus unmodified-control pass; non-vacuous production-source scan (non-empty, no reader import/`CONFORMANCE_LIVE_`, allowlist 4); real writer-skips-on-failure control plus mock in-memory assertion; request descriptor asserted in TC-CONF-006 step 6 / TC-CONF-015 step 3; not-configured counters pinned to 0. Evidence: `pnpm build` exit 0; `bun test tests/conformance` → 79 pass / 0 fail (was 77; 2 purity controls added, live scan tests merged); `bun test tests/structure` → 289 pass / 0 fail; `bun test tests/checks` → 338 pass / 0 fail; `bun test tests/boundaries` → 133 pass / 0 fail; `pnpm check` exit 0 (1733 pass / 2 skip / 0 fail across 155 files; depcruise 125 modules; secret-read 106 files / 4 allowlisted; exports-parity 5 publishables); `secret-read-boundary`, `workspace-entrypoints`, `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `testkit-exclusion`, `privacy-literals`, `forbidden-literals` → all OK; `bash scripts/.tests/test-doc-distribution.sh` exit 0 (81 docs, no drift); `git diff --check` exit 0; `git diff --exit-code <merge-base> -- .github/workflows/ci.yml` exit 0. No protected path touched; no spec/test-plan edit. |


## P8 Validation Evidence Matrix

All commands below were actually run at P8; unrun commands are not marked passing.

| AC | Phase / tasks | Primary TC(s) | Command and observed result |
|---|---|---|---|
| AC-F1-1 | P1.2, P1.5, P1.6; P3.3, P3.4 | TC-CONF-001, TC-CONF-005 | `bun test tests/structure/conformance-coverage.test.ts` → 31 pass / 0 fail; three flows, twelve steps, all seven operations. |
| AC-F1-2 | P3.1, P3.2; P4.1 | TC-CONF-007, TC-CONF-008, TC-CONF-009 | `bun test tests/conformance` → 77 pass / 0 fail; read matrices execute normalized primitives. |
| AC-F2-1 | P3.1; P4.1 | TC-CONF-006/007/008/009/010 | `bun test tests/conformance/mock-conformance.test.ts` → 33 pass / 0 fail; supported reads execute, unsupported writes skip with exact reasons. |
| AC-F2-2 | P3.1, P3.3, P3.4 | TC-CONF-010, TC-CONF-011 | Same suite: undeclared gap, stale gap, uncovered operation and masked failure controls fail by provider/operation. |
| AC-F2-3 | P1.2, P2.4, P3.1, P3.4, P4.1 | TC-CONF-004, TC-CONF-012, TC-CONF-013 | Structure and mock suites: present/absent comments, declared-gap carrier skip, `no-declared-carrier`, carrier-positive control. |
| AC-F3-1 | P2.1, P2.6 | TC-CONF-003 | `bun test tests/structure/conformance-coverage.test.ts` → declaration-only scan finds 3, new declaration and dangling registration fail by name. |
| AC-F3-2 | P2.1, P2.6 | TC-CONF-002 | Same suite: exactly GitHub/GitLab/Jira, contract-bound, wrong-contract and `azure` controls fail. |
| AC-F4-1 | P2.2, P3.4 | TC-CONF-015 | `bun test tests/conformance/mock-conformance.test.ts` → exact-URL replay, near-miss rejection, throwing-`fetch` zero calls. |
| AC-F4-2 | P3.1, P3.4, P5.6 | TC-CONF-014, TC-CONF-025 | Mock double replay deep-equal; live artifacts identical from identical injected inputs. |
| AC-F4-3 | P2.4, P2.6 | TC-CONF-031 | `bun test tests/checks/fixture-sanitization.test.ts` (in the 837-pass battery): zero findings, provenance and placeholders clean. |
| AC-F5-1 | P3.3, P3.4, P4.1 | TC-CONF-004, TC-CONF-005, TC-CONF-011, TC-CONF-013 | Structure and mock suites: structural/runtime coverage complete for all three adapters. |
| AC-F5-2 | P4.2 | TC-CONF-016 | `bun test tests/conformance/broken-adapter-control.test.ts` → corrupt client fails by provider/flow/step; unmodified passes. |
| AC-F6-1 | P4.1, P8.1 | TC-CONF-006, TC-CONF-033 | `pnpm check` and `bun test tests/conformance` green; suite discovered by the existing `bun test` path. |
| AC-F6-2 | P4.2, P6.3, P7.4, P8.2 | TC-CONF-016, TC-CONF-032 | `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `tests/checks/ci-checks.test.ts` OK; `ci.yml` diff empty. |
| AC-F7-1 | P5.1, P5.5, P5.6, P6.1, P6.2 | TC-CONF-020/021/022/026 | Live status matrix writes one valid artifact in every status; workflow contract passes. |
| AC-F7-2 | P5.3, P5.5, P5.6, P5.8 | TC-CONF-021 | `bun test tests/conformance/live` → absent, present-but-empty and whitespace shapes are `not-configured`, exit 0, 15 names, spawn path writes an artifact. |
| AC-F7-3 | P5.5, P5.6 | TC-CONF-022 | Configured failure → `failed`, exit 1, artifact written, other providers `not-configured`, no ticket, counters zero. |
| AC-F7-4 | P6.1, P6.2, P7.4 | TC-CONF-026, TC-CONF-027, TC-CONF-032 | `bun test tests/checks/conformance-workflow.test.ts` → 8 pass / 0 fail; every mutation control fails at its location. |
| AC-F7-5 | P5.3, P5.6, P7.1, P7.2 | TC-CONF-024, TC-CONF-028, TC-CONF-029 | Secret-read allowlist exactly 4 with no testkit entry; testkit node:* boundary fixture fires; no production source imports the live reader. |
| AC-F8-1 | P1.3, P5.1, P5.2, P5.6 | TC-CONF-018, TC-CONF-019, TC-CONF-020 | `bun test tests/conformance/artifact.test.ts` → 13 pass / 0 fail; schema, closed sets, caps, redaction and truncation. |
| AC-F9-1 | P5.4, P5.5, P5.6 | TC-CONF-023 | All live requests GET, synthetic POST fails naming method/URL, counters zero in every status. |
| AC-F10-1 | P3.1, P4.2 | TC-CONF-016, TC-CONF-017 | Failed diagnostics name provider/flow/step/operation/assertion with scalar expected/received/reference and no secret/raw content. |

**Ticket-AC trace**

| Ticket AC | Evidence |
|---|---|
| AC-1 (mock green for every shipped adapter) | TC-CONF-006/007/008/009/033; `pnpm check` green with the suite discovered. |
| AC-2 (scheduled live run records an artifact) | TC-CONF-020/021/022/026; one valid artifact in every terminal status; workflow contract green. |
| AC-3 (an adapter change that breaks a flow fails CI) | TC-CONF-010/011/016/017/032; coverage/runner controls and the broken-adapter control fail by name inside the existing `pnpm test` path, with no new CI job. |

**§18 Definition of Done predicates observable in this phase**

- Mock suite green in the existing test jobs with zero live network calls — PASSED (`pnpm check`).
- Structural registration and operation-coverage gates fire on their negative controls — PASSED (TC-CONF-003/005/011).
- Broken-adapter control fails by provider/flow/step — PASSED (TC-CONF-016).
- Live entrypoint produces `not-configured` without tenants and a valid artifact in every status — PASSED (TC-CONF-020/021/022).
- Scheduled workflow contract test passes — PASSED (TC-CONF-026/027).
- Zero mutation requests and zero created artifacts recorded — PASSED (TC-CONF-023).
- Secret-read allowlist exactly four; fixture sanitization green — PASSED.
- `pnpm check` green; `ci.yml` byte-unchanged — PASSED.
- Documentation synchronized (new feature spec plus the listed updates) and doc-distribution guard green — PASSED.
- Open unmerged PR targeting `main-tools` with required jobs green — handoff to phase 11 (`@pr-manager`); not a completed delivery-phase task.
