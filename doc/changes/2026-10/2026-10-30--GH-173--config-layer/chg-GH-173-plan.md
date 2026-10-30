---
id: chg-GH-173-config-layer
status: Updated
created: 2026-10-30T06:47:31Z
last_updated: 2026-10-30T07:14:25Z
owners: [engineering]
service: delivery-os configuration
labels: [change, planning]
links:
  change_spec: ./chg-GH-173-spec.md
  test_plan: ./chg-GH-173-test-plan.md
  adr_refs:
    - ../../../decisions/ADR-0003-oss-monorepo-structure.md
    - ../../../decisions/TDR-0003-config-parser-schema-and-acquisition.md
summary: >
  Deliver the owner-accepted ADR-0003 DEC-4 seven-layer configuration model and a
  brand-derived CLI inspection surface. All resolution is fail-closed and shares
  the existing result/error and redaction contracts; credential resolution and
  consumers beyond configuration remain separate stories.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-173: M0-S4: Config layer (DEC-4)

## Context and Goals

Implement F-1–F-7 against the completed specification and test plan, identified by the reopened handoff as checkpoints `4097f60` and `f548533`. This writer read the working-tree artifacts and readiness iteration 1; it performed no git operations to independently verify checkpoint or branch identity. Execution belongs on `feat/GH-173/config-layer`; the orchestrator verifies branch/checkpoint state before delivery and targets `main-tools` for the unmerged PR. Spec §8.3 DM-2 defines the first-match skip-reason oracle; spec §18 defines completion for the open-PR handoff, not merge/adoption.

The current core config tier and file/repo adapter entries are scaffolds. Core `.` declares `createRuntime` but does not implement it. The existing CLI supplies injected command programs and streams, error classification, exit projection and one serialization boundary, but rejects positional subcommands and emits no human success payload. These are concrete implementation seams, not already-delivered config behavior. Do not implement unrelated runtime services to activate `createRuntime`.

Deliver a pure, exported production resolver with a plain ConfigSource port; line-preserving acquisition through existing adapter entries; and real CLI basic/debug/get inspection. Production ordinary catalog/defaults stay empty. Typed fixture catalogs must drive the same exported algorithm, actual file adapter and actual command path to prove the full seven-layer model. Bootstrap identity is required separately, resolved once and frozen before discovery.

### Open questions

- **OQ-1 — owner review before merge/adoption:** Proposed TDR-0003 selects runtime `yaml@2.9.1` and `Ajv@8.20.0`, subject to exact closure/license compatibility review, including BSD-3-Clause. It remains Proposed. Branch implementation and an open unmerged PR are permitted with truthful proposed registry determinations and passing gates. Decision needed: consult `@decision-advisor` if rejected or if actual host evidence prohibits validator code generation. Decision-record follow-up: amend the existing TDR-0003 proposal with evidence and obtain the human decision; do not mark it Accepted as part of implementation.
- **Observed upstream implementation gaps, not missing ACs:** `license-audit.ts` indexes by package name, requires `dev-dependency` even when manifests use runtime dependencies, and does not traverse runtime closure. `classifyDomainKind()` selects the first kind row; `classifyThrown()` ignores exact code; `runCli()` forwards handler summaries. Phases 1 and 4 must repair these seams without weakening existing approved singleton classification or generic command behavior.
- **Delivery-infrastructure scope constraint:** new standalone checks under `scripts/` require install registration, while this change excludes bash-stack edits. Use existing registered check modules for artifact generation/parity and audit extensions as specified below, plus test modules, rather than adding an unregistered script. If that cannot be implemented coherently, stop for PM scope reconciliation before adding a check or editing `scripts/install.sh`; no silent registration exception.
- **Artifact linkage:** the completed test plan links this existing implementation plan and retains its initial-authoring chronology. The reciprocal canonical link above and all proposed test paths remain intact; no test-plan edit is needed in this writer's one-file scope.

No additional product requirements or blocking spec/test coverage gaps were found. Actual security, parser portability and packed-artifact results remain unproven until execution.

## Scope

### In Scope

- F-1: defaults < system < user-global < project-committed < project-local < environment < CLI; recursive maps, scalar/list replacement, reset-before-set and deterministic winning origins.
- F-2: Linux/macOS/Windows locations, bounded root-only project discovery, optional missing evidence, selected-file committed slot, CI exclusions and named re-enable controls.
- F-3/F-4: typed catalog, trusted draft-07 schema, recursive partial/final validation, reserved input wrappers, file extensions, typed env/flag mappings, interpolation and source restrictions before any merge.
- F-5/F-6: real YAML/default positions, safe warnings/strict errors, exact nine-code classification, safe error locations, redacted human payloads and one machine envelope.
- F-7: existing core `.`/`./contracts` and adapters `./file`, `./repo`, `./legacy`; frozen brand composition, dependency governance, packed Node/Bun imports, current-state documentation and documentation-only mediated adoption path.

### Out of Scope

- Credential resolution/reads/caching, keyrings, provider/state config consumption, sidecar/transport/remote implementation. M0-S12 owns the credential-resolution port; this change must not introduce it.
- New package/public subpath, new config layer, public product name, branding contract changes, dynamic external schemas, `extends`, directory inheritance, restrict-only policy and persisted migrations.
- Bash delivery behavior, `.opencode/**`, `.ados-claude/**`, `doc/planning/**`, automatic rewriting of operator config, publishing or merging the PR. No source license headers are added by agents.

### Constraints

- Use the template's section order and per-phase acceptance gates. The 39 numbered tasks below are delivery tasks, not work performed by this writer. Phase 7 has three conditional tasks.
- Preserve the package/tier matrix: config imports contracts, never branding/adapters; adapters import core contracts only; runtime I/O stays under file/repo/legacy. Core exports resolver/schema from `.` without a new `./config` export. Preserve the existing declared composition-root surface.
- Preserve GH-172 `CommandResult`, run ID/timing and CLI projection {0,1,2}. Config user-validation exits 1; invalid classification contains as `fallback.internal`/exit 2. Do not introduce call-site exit literals or extra envelope fields casually.
- Machine and documented error rows ship together in Phase 1. Later doc synchronization does not excuse a red intermediate error-table gate.
- Build before dist-dependent tests/typechecks/exports. Root `pnpm check` is not a substitute for license, vulnerability, literal, all invariant and pushed-HEAD CI gates.
- No documentation profile exists; use engineering-repo behavior, no business docs. Register new user-facing docs in `scripts/checks/forbidden-literals.registry.json` when created. Apply distribution markers only where required by repository doc rules; do not copy template headers/markers indiscriminately into change artifacts or feature specs.
- Keep the five-package Changesets fixed group, private/publish guard, exact pins and existing bash CI jobs intact. No gate bypass, ignored failure or inferred human license acceptance.

### Risks

- **RSK-1:** guessed or stale origins. Retain actual YAML value-node ranges and ship a source-verified defaults manifest; test aliases, collections and line insertion even with empty production defaults.
- **RSK-2/RSK-6:** early diagnostics leak unregistered file secrets. Block actual upstream debug switches before parse, suppress raw parser/validator content and test both streams in every mode.
- **RSK-3:** multi-row classification and docs drift. Deliver exact code+kind classification, nine matching rows and two-direction mutation controls in the same phase.
- **RSK-4/RSK-5:** ambient CI sources or circular branding. Freeze one identity first; test each disabled layer, selector/root interactions and overlap exclusions.
- **RSK-7:** proposed runtime licenses or runtime imports fail review/portability. Account for actual uses and locked closure first, prove packed Node/Bun behavior, and stop before merge pending owner acceptance.

### Success Metrics

- 25/25 ACs traced to TC-CONFIG-001–025 and passing delivery evidence; seven precedence winners demonstrated with production code.
- Every present partial layer and one final tree validated; zero partial snapshots on error.
- Every displayed effective file/default leaf/collection has its actual positive source line; env/CLI and source-less errors invent none; defaults drift mutations fail.
- Zero forbidden-source secrets accepted; zero registered env or unregistered file canary bytes in stdout/stderr, including escaped/multiline variants.
- Nine distinct config codes round-trip exactly with complete synchronized rows; singleton regressions pass; zero expected failures misclassified.
- All applicable TypeScript, dependency, packaging, docs and existing bash gates green on the pushed handoff HEAD; human acceptance explicitly pending until owner review.

## Phases

Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → (7 if findings) → 8**. Parser/discovery helpers may be developed after Phase 1 contracts stabilize, but Phase 3 completes only against Phase 2's real resolver. Phase completion signals are states; the orchestrator delegates any commits to `@committer`. After coder's no-review implementation handoff, PM owns scheduling and evidence for Phases 6–8 through the lifecycle, including independent review, delegated fixes/re-review, final gates and PR handoff. Coder must not mark those phases complete merely by finishing implementation. Review and fixes loop until pass, never around a failing gate.

### Phase 1: Contracts, dependency governance and exact failure identities

**Goal**: Establish safe shared contracts and mechanically truthful dependencies before introducing resolver or parser behavior. Environment/scaffolding work is merged here because no new package is needed.

**Tasks**:

- [x] **1.1** Add core contracts for JSON-compatible values, seven named layers, ConfigSource acquisition facts/results, node-position/source identities, loaded/skipped records, warnings and safe locations. Declare `ConfigErrorCode`/`ConfigFailure` with `kind: config` and exact code. Contracts contain no parser text/documents, YAML/Ajv types, ambient acquisition or credential API. (core contracts; build/typecheck/boundaries PASS; runner `083149-phase1-verification-gh-173.log`; phase commit 7661d46)
- [x] **1.2** Extend `license-audit.ts` and the registry schema to retain manifest owner, dependency field, exact resolved version and all uses for shared packages; support direct dev/runtime and the new runtime transitive closure without overwriting multi-use rows by name. Traverse the committed lock closure for the new runtime roots; preserve current direct-dev checks and fail on missing, duplicate/conflicting, malformed, wrong-version, unapproved or unsupported-license records. Update audit output so runtime uses are not labelled development-only. (registry v2, lockedUses audit and negative tests; focused suite and license-audit PASS, runner log; phase commit 7661d46)
- [x] **1.3** Declare exact Ajv 8.20.0 in core runtime dependencies and yaml 2.9.1 in adapters runtime dependencies; retain the existing root yaml dev use and record Ajv's existing tooling use. Update lockfile and truthful proposed registry/allow-list rows for the actual closure: fast-deep-equal 3.1.3/MIT, fast-uri 3.1.9/BSD-3-Clause, json-schema-traverse 1.0.0/MIT and require-from-string 2.0.2/MIT, plus any actual lock change discovered. Verify yaml's runtime closure rather than assuming it. Proposed machine `approved` verdicts remain owner-review proposals under the registry's determination, not legal acceptance. (manifests and lock importers verified: adapters yaml runtime, core ajv runtime, root yaml dev; frozen install/license/vulnerability PASS, runner log; owner acceptance and phase commit 7661d46)
- [x] **1.4** Add all nine spec §8.3 rows to `ERROR_TABLE` with exact summary/remediation, domain kind config, category user, retryable false, consequence not_landed and projection user-validation. In this same phase add the nine exact rows to `feature-result-contract.md` and replace the one-row-per-kind invariant with unique-code/total-declared-discriminant coverage. Keep namespace-equals-kind and bidirectional sync binding. (machine/documented rows 13/13; sync PASS, runner log; phase commit 7661d46)
- [x] **1.5** Update `classifyDomainKind(kind, code?)` and `classifyThrown` for exact code lookup with matching kind, singleton-only kind lookup and safe containment of missing/unknown/wrong-kind config codes. Exercise returned and thrown paths through `runCli`; suppress untrusted config failure summaries, including malformed config discriminants, without removing approved existing provider/input behavior. (nine returned/thrown paths and malformed discriminants exercised; focused suite 67 PASS, runner log; phase commit 7661d46)
- [x] **1.6** Extend classifier/table/sync/license tests with nine identities, singleton regressions, ambiguous/malformed discriminants, machine-only/doc-only drift and audit negative mutations for missing transitive use, erased runtime use, conflicting version and disallowed SPDX branch. Keep ordinary branch work possible with explicit proposed owner determinations; never disable an audit to achieve it. (67 tests/809 assertions across four files PASS, sync/license/boundaries PASS; runner log; phase commit 7661d46)

**Acceptance Criteria**:

- Criterion: AC-F6-3 is demonstrable for all nine identities in returned/thrown tests before config handlers depend on them; trigger integration is completed in Phases 2–4. — PASSED for Phase 1 identities (67 focused tests/809 assertions, runner log); trigger integration remains in Phases 2–4.
- Criterion: proposed runtime/direct/transitive/multi-use accounting passes the extended fail-closed audit, and error-table sync passes with the new documented rows immediately. — PASSED (frozen install, license audit, 13/13 machine/documented sync, zero high/critical lock advisories; runner log; human determination pending).
- Criterion: existing provider/input singleton behavior, fallback rows, projection and envelope conformance remain green. — PASSED (focused classification/table/sync tests, build/typecheck/lint/format/boundaries/entrypoints PASS; runner log; full regression suite reserved for later phases).

**Files and modules**:

- Code areas: new `packages/core/src/contracts/config.ts`; updated contracts index/error table, `packages/cli/src/classify.ts`, config-specific containment in CLI index, core/adapters manifests, `pnpm-lock.yaml`, `scripts/checks/license-audit.ts`, `doc/legal/dependency-licenses.yaml`, existing classification/table/sync/license tests.
- System docs: `doc/spec/features/feature-result-contract.md` **in this phase**, including exact error rows and discriminant invariant; dependency registry scope/determination documentation alongside its schema changes.

**Tests**:

- TC-CONFIG-020 and dependency controls of TC-CONFIG-025; `tests/behaviour/error-classification.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, existing license-audit tests.
- Runner: frozen install after lock update, build, focused Bun suites, `bun run scripts/checks/error-table-sync.ts`, `bun run scripts/checks/license-audit.ts`, `bun run scripts/checks/vulnerability-gate.ts`, boundaries and workspace-entrypoint checks.

**Completion signal**: shared contracts, dependency accounting and nine synchronized failure identities pass focused gates with TDR/owner acceptance still pending.

### Phase 2: Pure catalog, schema, resolution and provenance artifacts

**Goal**: Implement the complete production algorithm with injected facts and real default-source positions, independent of runtime discovery.

**Tasks**:

- [x] **2.1** Replace the config placeholder with typed catalog/default metadata and schema helpers. Separate required string/no-default bootstrap descriptor from empty ordinary production catalog/defaults. Require typed defaults for default-bearing fields; forbid defaults for required env-only secrets. Expose resolver/catalog/schema helpers through core `.` while preserving the existing composition-root declaration. (core catalog/defaults/root API; build and 22 focused tests PASS in `085105`/`085108` runner logs; phase commit e94b2fe)
- [x] **2.2** Generate the canonical trusted draft-07 schema, recursively relaxed partial view and final required view. Validate `$schema`/`reset` wrapper shapes and strip directives/metadata; allow file `x-` data but reject unknown ordinary keys and undeclared env/flag mappings. Configure Ajv with no coercion, property removal, default insertion, logger, remote refs or async loading; use no Node-specific validator helper. Construct safe errors without input data or validator text. (schema and partial/final/reserved tests PASS, `085108` runner log; phase commit e94b2fe)
- [x] **2.3** Implement catalog-typed env/CLI conversion and whole-layer validation. Before any reset/merge, reject both in-file interpolation forms, unknown/invalid values and every forbidden source, including shadowed/reset inputs. Secrets are env-only; machine paths are system/user-global only, including checks on defaults and CLI. Return no partial snapshot on failure. (restriction/conversion tests PASS, `085108` runner log; phase commit e94b2fe)
- [x] **2.4** Implement seven-level deterministic recursive map/scalar/list merge and reset-before-set. Remove reset descendant values/origins; retain unaffected leaf origins, replace list element origins entirely and retain container positions only while effective. Emit safe deprecated/shadowed warnings and strict `config.warning.strict`; final validation runs after resolution and missing-required errors have no invented line. (resolver/provenance/warning tests PASS, `085108` runner log; phase commit e94b2fe)
- [x] **2.5** Implement defaults-source manifest/schema generation and parity through the existing `scripts/checks/exports-parity.ts` module with an explicit artifact-only generation mode, separate from its existing attw validation mode. Wire core build as compile → deterministic artifact generation into `dist` (no recursive build/attw call); retain existing default parity behavior and add config artifact validation. Ship schema, manifest and enough defaults-source identity/position evidence to reject line insertion even when production defaults have zero leaves. Runtime consumes shipped data, never reads TypeScript. Preserve display label `core/src/config/defaults.ts` and true fixture declaration lines. No new standalone script or public subpath is needed. (pure public resolver consumes injected shipped dist manifest, accepts valid/rejects forged identity/positions; 24 tests/171 assertions, build/artifact/5-publishable attw PASS `085818-gh173-phase2-remediation.log`; actual CLI edge injection explicitly remains 4.1; phase commit e94b2fe)
- [x] **2.6** Add typed fixture catalogs and production-API tests for all seven winners, defaults, required/nullable/deprecated fields, nested maps/lists, env secrets and machine paths. Add source-copy manifest/fixture line-insertion mutations and schema/packed-artifact parity controls; assert empty production yields `{}` without bootstrap/test keys or fictitious origins. (independent copied-fixture line-insertion mutation and shipped-manifest negative tests PASS; 24 tests/171 assertions in 7 files `085818-gh173-phase2-remediation.log`; phase commit e94b2fe)

**Acceptance Criteria**:

- Criterion: AC-F1-1/2, AC-F3-2/3/5, AC-F4-1/2, AC-F5-2/3 and pure resolution part of AC-F7-1 pass through the exported resolver, not a second test implementation. — PASSED for Phase 2 pure resolution (22 focused tests/161 assertions, `085108` runner log; runtime acquisition/inspection remains in later phases).
- Criterion: all supplied layers validate before merge, final required fields validate once, and env/flag facts carry only their own labels, not file positions. — PASSED for supplied pure facts and typed fixture catalogs (focused schema/restriction/provenance tests, `085108` runner log).
- Criterion: artifact generation is deterministic, build works from a clean dist tree, and both unchanged controls and source-drift mutations work with empty production defaults. — PASSED for Phase 2 (deterministic build/artifact generation; unchanged and mutated defaults/schema/fixture checks, injected shipped-manifest negative controls, 5/5 attw parity, 24 focused tests/171 assertions; `085818-gh173-phase2-remediation.log`; production CLI edge wiring remains Phase 4).

**Files and modules**:

- Code areas: `packages/core/src/config/{index,catalog,defaults,schema,resolver,provenance}.ts` (new/updated), core root exports/build script, existing `scripts/checks/exports-parity.ts`; `tests/behaviour/config-{resolver,schema,restrictions,provenance}.test.ts`, `tests/checks/config-default-positions.test.ts`, `tests/structure/config-contract.test.ts`, `tests/fixtures/config/**`.
- System docs: none newly required for this internal algorithm phase; Phase 1 error documentation remains synchronized. Phase 5 publishes the integrated feature contract.

**Tests**:

- TC-CONFIG-001, 002, 008, 009, 011, 012, 013, 016, 017, 023 and artifact portion of 025; fixture declarations use actual positions, not guessed numbers.
- Runner: build, focused suites, source-copy mutations, ambient guard, tier boundaries and existing exports-parity regression tests; verify artifact-only generation does not run attw or require previously generated artifacts.

**Completion signal**: production resolver is deterministic and fail-closed with empty production baseline, typed fixtures and shipped artifact controls passing.

### Phase 3: Safe YAML acquisition, bounded discovery and legacy source composition

**Goal**: Supply plain source facts and exact positions from the real runtime adapters without moving merge logic or branding into them.

**Tasks**:

- [x] **3.1** Implement YAML 1.2 parsing under adapters `src/file` with document/node ranges and LineCounter before conversion. Accept one unique-string-key mapping and JSON-compatible values; reject duplicate/non-string keys, multiple documents, custom/executable tags, merge semantics, cyclic/non-JSON data and excessive alias expansion. Record actual value-node lines, array element/empty collection positions and alias referenced-value positions in plain facts. (reworked interrupted `yaml-parser.ts` into a single-document walker with LineCounter, alias/depth/node bounds, tag/merge/cyclic/non-JSON rejection and plain `ConfigSourceFacts`; parser/source focused tests PASS in `144454-gh173-phase3-verify.log`; phase commit 7fb56de)
- [x] **3.2** Check actual host `LOG_TOKENS` and `LOG_STREAM` before invoking the Node-selected parser; reject either nonempty switch as safe `config.value.invalid`. Disable parser logging/snippet diagnostics, catch exceptions into safe constructed codes/available locations and expose no parser document/text, stack or raw summary. Do not mutate environment or intercept global console. (actual host-switch guard runs before parser construction; subprocess `LOG_TOKENS`/`LOG_STREAM` controls PASS in `144454-gh173-phase3-verify.log`; phase commit 7fb56de)
- [x] **3.3** Implement file/platform source acquisition with injected runtime facts and brand-derived directory/prefix: Linux XDG ordered first-existing system candidate and home defaults, macOS Application Support paths and Windows PROGRAMDATA/APPDATA. Optional absent sources report `missing`; unusable explicitly selected files fail `config.value.invalid` with actual path and no invented line. (`acquireFileConfig` with injectable platform/home/environment/fs and production wrappers; Linux/macOS/Windows and absent-variable cases PASS in `144454-gh173-phase3-verify.log`; phase commit 7fb56de)
- [x] **3.4** Implement git-root facts behind existing `./repo` (or an injected explicit root) and root-only project file selection. Never read intermediate/above-root decoys. Apply spec DM-2 before source reads: system and user-global independently check `CI=true` without their own enable flag (`ci-disabled`), then optional absence (`missing`); committed checks lack of selection and git/explicit root (`no-git-root`), then optional root-file absence (`missing`). Explicit root bounds discovery but never enables CI-disabled sources. For unselected project-local, check CI/local enable (`ci-disabled`) before root eligibility (`no-git-root`), then optional absence (`missing`); selected-local precedence belongs to 3.5. Skipped sources are never read, even when present/poisoned. (root-only `findGitRoot` handles `.git` dirs and linked-worktree gitfiles; DM-2 applies before reads; 19-row oracle, zero-read and temp-root tests PASS in `144454-gh173-phase3-verify.log`; phase commit 7fb56de)
- [x] **3.5** Apply `--config` over brand/legacy selector at project-committed priority, not an eighth layer. Project-local uses the first-match order `selected-config` > `ci-disabled` > `no-git-root` > `missing`: selection wins regardless of CI, explicit/git root, local enable flag or local-file presence, with zero local reads. Missing/unreadable selection fails `config.value.invalid`, never an optional skip; schema and source restrictions still apply. Neither selection nor root implicitly enables system/user; each retains its independent CI/enable/missing outcome. Return ordered loaded/skipped evidence and feed catalog-aware env facts and explicit recognized-name exclusions to core mapping without inferring arbitrary extension keys. (selected slot, exact local precedence, selected-file failures and zero local reads PASS; selected-config attribution fix hoists selection in `config-source.ts` and actual-path tests pass; `neutralEnvironmentFacts` removes only explicit recognized names; `144454-gh173-phase3-verify.log`; phase commit 7fb56de)
- [x] **3.6** Adapt legacy acquisition through the same ConfigSource contract using current names as parameters. Preserve existing legacy-name compatibility and current-wins collisions; use an injected safe warning sink with process-scoped once state for config calls, not the console-default helper or a fresh per-invocation warning state. Add actual-parser/temp-repository/platform/CI/selection/legacy tests, including isolated parser-host-switch and warning-lifetime controls. (`resolveConfigFacts` supplies plain environment/selector facts with current wins and injected sink/one instance-scoped warning; 14 legacy tests PASS; legacy remains a fact adapter, not an eighth layer; `144454-gh173-phase3-verify.log`; phase commit 7fb56de)

**Acceptance Criteria**:

- Criterion: AC-F2-1/2/3/4, AC-F3-1/4, AC-F6-4 and source-acquisition portions of AC-F7-2 pass against actual adapters. — PASSED (parser/acquisition/repo/legacy focused suites, 64 tests/386 expectations across 7 files, `144454-gh173-phase3-verify.log`; phase commit 7fb56de).
- Criterion: TC-CONFIG-004–006 assert exact DM-2 overlap reasons and acquisition read counts, including poisoned skipped sources and eligible/missing positive controls. Under CI outside git without root/selection, committed is `no-git-root`, local is `ci-disabled` unless locally enabled (then `no-git-root`); selection always makes local `selected-config`. System/user remain independently CI-disabled unless their own flags enable them; no skipped layer has a source read or loaded record. — PASSED (19-row DM-2 oracle and zero skipped-read assertions, `144454-gh173-phase3-verify.log`; phase commit 7fb56de).
- Criterion: every file leaf/array element/collection is associated with its true available position, selected-file errors invent none and parser invocation count is zero for both blocked host switches. — PASSED (true position assertions, selected-file no-invented-line checks and subprocess host-switch controls, `144454-gh173-phase3-verify.log`; phase commit 7fb56de).
- Criterion: no YAML/Ajv/raw-source types cross ConfigSource; adapters import only core contracts and never branding/core root; legacy unused control warns zero times. — PASSED (YAML types stay in adapters/file; adapters import core contracts only; legacy uses plain facts/injected sink and warns zero when unused; `144454-gh173-phase3-verify.log`; phase commit 7fb56de).

**Files and modules**:

- Code areas: `packages/adapters/src/file/{index,config-source,yaml-parser}.ts`, `packages/adapters/src/repo/index.ts`, `packages/adapters/src/legacy/index.ts`; existing `./file`, `./repo`, `./legacy` subpaths remain the only entrypoints, with added exports inside them and no new subpath; `tests/behaviour/config-{parser,sources}.test.ts`, legacy adapter tests and `tests/fixtures/config/yaml/**`.
- System docs: none beyond Phase 1 binding rows; full discovery/parser contract documentation ships in Phase 5.

**Tests**:

- TC-CONFIG-003–007, 010, 012, 013, 017, 021, 024 with production parser and disposable roots; aliases/multiline/flow/lists have independently recorded fixture line expectations.
- TC-CONFIG-005's exact DM-2 overlap oracle, with TC-CONFIG-004 root/decoy and TC-CONFIG-006 selector/error controls: assert first-match records and zero skipped-source reads, not merely ignored values; repeat eligible loads with absent optional files for `missing`.
- Runner: build then focused suites under controlled facts; Node subprocesses exercise actual parser entry and actual host switches with unregistered source canaries, unset/empty positive controls and no parent-environment mutation.

**Completion signal**: adapters supply bounded, position-accurate, safely classified plain facts and loaded/skipped evidence; negative parser/discovery controls pass.

**Provisional evidence map (Phase 3, pending runner)**:

| TC | Drafted evidence |
|---|---|
| TC-CONFIG-003 | `tests/behaviour/config-sources.test.ts` Linux XDG first-existing/default/XDG_HOME, macOS, Windows and absent-variable cases |
| TC-CONFIG-004 | `findGitRoot` normal/worktree/outside tests plus root-only read-count/decoy cases and DM-2 rows |
| TC-CONFIG-005 | 19-row exact DM-2 oracle with poisoned skipped sources and read-count assertions |
| TC-CONFIG-006 | selected rows, selected missing/unreadable failures, selection-over-root and zero local reads |
| TC-CONFIG-007 | parser rejection table for duplicate/non-string/multiple/custom/merge/cyclic/non-JSON/root-sequence/empty plus safe error shape |
| TC-CONFIG-010 | real `positions.yaml` node/list/empty/alias/multiline/flow line expectations |
| TC-CONFIG-012 | parser preserves interpolation strings and exported core resolver rejects both forms |
| TC-CONFIG-013 | existing Phase 2 restriction suite remains the source-restriction oracle; Phase 3 parser never rewrites values |
| TC-CONFIG-017 | parser positions plus existing replacement/default-manifest controls |
| TC-CONFIG-021 | subprocess `LOG_TOKENS`/`LOG_STREAM` block-before-parse, unset/empty positive controls, no canary |
| TC-CONFIG-024 | legacy current-wins/selector mapping and once-per-instance warning with injected sink |

**Parser reconciliation**: the interrupted untracked `yaml-parser.ts` was reworked, not discarded: it now exposes plain `ConfigSourceFacts`, keeps YAML types inside `adapters/file`, uses `LineCounter`, bounds aliases/nodes/depth, rejects non-string/duplicate/merge/custom/cyclic/non-JSON input, guards actual host switches before parsing and returns constructed failures without parser text.

### Phase 4: Frozen bootstrap and redacted production CLI inspection

**Goal**: Compose the real sources/resolver once and expose all required modes through the existing CLI output boundary.

**Tasks**:

- [x] **4.1** Add configuration composition at `cli/src/edge.ts`: take supplied `ResolverInput.workingName`, read the neutral override from injected/runtime-edge environment facts, resolve the unchanged branding seam exactly once, freeze identity before discovery, then compose file/repo/legacy sources and invoke core `resolveConfig`. Missing/invalid input preserves echo-free branding failure with no fallback name; no file setting can rename or rediscover the invocation. (edge resolves brand once before acquisition, composes file/repo/legacy facts, injects `defaultPositions` from the shipped `dist/config/defaults-positions.json` and returns secrets/brand/program; conditional `RepositoryRootFacts` construction follows strict TS; focused suites PASS in `150745-gh173-phase4-full-rerun.log`; phase commit 74e6f28)
- [x] **4.2** Extend command argument metadata/parser narrowly to support config basic, `debug`, `--debug`, `get key` and `--show-origin` plus global `--json`, selector/root, strict and three enable flags. Preserve existing injected programs, unknown-command/flag/missing-value/conflict behavior and avoid adding unrelated commands. Ordinary field flags exist only in explicitly supplied typed catalogs. (opt-in positional metadata and config definition with control/catalog flags; existing invocation semantics preserved; focused CLI/golden suites PASS in `150745-gh173-phase4-full-rerun.log`; phase commit 74e6f28)
- [x] **4.3** Exclude exactly neutral bootstrap override, brand selector and recognized legacy mappings before curated env validation, including neutral-prefix overlap. Register nonempty catalog-designated env-secret values in the invocation redaction set before any inspection; do not resolve credentials or allow excluded unrelated prefixed keys. Provide a controlled catalog injection seam for actual config command fixture tests, never published fixture settings. (exact exclusions, legacy fact mapping/current wins, catalog secret registration and catalog injection PASS in `150745-gh173-phase4-full-rerun.log`; phase commit 74e6f28)
- [x] **4.4** Implement config handler payloads from one resolved snapshot: basic tree, debug `{config, origins, loadedFiles, skippedLayers}`, get JSON value or `{key, value, origin}`. Unknown get fails classified validation, not empty success. Keep exact origin grammar, true lines and safe loaded/skipped/warning evidence; no bootstrap or directive keys in effective tree. (`commands/config.ts` payloads and unknown-get failure PASS; typed `next` locals avoid casts; S1 false positive removed by destructuring; `150745` and `150902` logs; phase commit 74e6f28)
- [x] **4.5** Extend `writeOutput` in the existing serialization module for opt-in human success JSON and safe structured warning/location diagnostics. Only CLI index invokes it; command/edge/adapters never write streams. Machine mode wraps the identical selected payload in exactly one existing envelope, failure has only error, and config errors use authoritative constructed summaries/remediation rather than untrusted summaries. Preserve generic handler compatibility and serialization containment; do not add a separate redactor/renderer bypass. (optional `humanJson`/warnings through the sole chokepoint; generic success unchanged; redaction/broken-command/serializer suites PASS in `150745-gh173-phase4-full-rerun.log`; phase commit 74e6f28)
- [x] **4.6** Implement CLI/golden/bootstrap tests using actual `runCli`, real command composition, actual adapters and fixture catalogs; cover all modes, exact nine triggers, true origin/get equality, branding spy-before-discovery, legacy once/current-wins and all strict/error paths. Capture every write for registered env and unregistered malformed/schema/forbidden/strict file canaries, including escaped/multiline forms; compare human and envelope data after redaction. (config-cli 14 and config-output 4 tests PASS with testkit envelope assertions, canaries, host-switch subprocess and legacy controls; 126 tests/730 expectations across 10 files; `150745` log; inventory refresh and repo executable allowance verified in `150902-content-inventory-biome-format.log`; phase commit 74e6f28)

**Acceptance Criteria**:

- Criterion: AC-F4-3, AC-F5-1/2, AC-F6-1/2/3/4/5, AC-F7-1/2 pass in the real composed invocation, completing earlier unit/source assertions. — PASSED (real composed invocation; 126 tests/730 expectations across 10 files, `150745-gh173-phase4-full-rerun.log`; phase commit 74e6f28).
- Criterion: human basic stdout is `{}` for empty production; debug/get have exactly specified payload forms; each machine invocation emits one envelope and no partial `data` on failure. — PASSED (basic/debug/get payloads and goldens; `150745` log; phase commit pending).
- Criterion: both streams contain zero canary values in literal and serialized forms; hostile config summaries never enter output; non-config approved behavior and all existing GH-172 tests still pass. — PASSED (redaction, canary and envelope suites; `150745` log and format follow-up `150902`; phase commit pending).

**Files and modules**:

- Code areas: `packages/cli/src/{edge,index,classify}.ts`, `packages/cli/src/commands/{index,config}.ts`, `packages/cli/src/output/serialize.ts`; `tests/behaviour/config-cli.test.ts`, legacy/classification regressions and `tests/golden/config-output.test.ts` with existing testkit envelope assertions.
- System docs: update `doc/spec/features/feature-result-contract.md` alongside any actual output/diagnostic contract changes; Phase 1 error rows remain binding and must not be deferred or weakened.

**Tests**:

- TC-CONFIG-006, 007, 014–016, 018–024; real host-switch subprocesses plus parser counter controls from Phase 3. Provisional CLI coverage: TC-014 branding/frozen bootstrap; TC-015 debug/get true origin; TC-016 warnings/strict; TC-017 provenance (Phase 2/3); TC-018 human payload goldens; TC-019 one envelope/redaction; TC-020 nine triggers plus Phase 1 exact-code table; TC-021 parser guard (Phase 3 subprocess + CLI fixture); TC-022 unregistered canaries; TC-023 pure resolver/edge brand; TC-024 legacy once/current wins. TC-006 selected-slot edge cases remain covered by Phase 3 sources plus CLI selector test.
- Runner: build, focused CLI/golden suites, all existing result/redaction/projection/branding/legacy suites, error-table sync, exit-code literal guard and serializer-boundary negative controls.

**Completion signal**: config basic/debug/get and their machine equivalents operate through the sole output chokepoint with complete provenance and zero leaked canaries.

### Phase 5: Documentation, boundary evidence and packed synchronization

**Goal**: Publish current implemented behavior, prove artifact portability and reconcile system documentation before review.

**Tasks**:

- [x] **5.1** Create `doc/spec/features/feature-config-layer.md` for the complete implemented model: seven priorities, source locations/eligibility, CI/root/selection controls, trusted partial/final schema, empty ordinary production catalog, typed extension mechanism, reset/null/restrictions, safe warnings, real origins, commands/payloads and safe errors. Register this new user-facing doc in forbidden-literal scope in the same phase and use only brand-derived naming. Respect applicable distribution markers if any additional guide/template is necessary; do not add headers. (authored `feature-config-layer.md`; registered in forbidden-literals; no product literals; forbidden-literals and doc-distribution guards PASS in `144249-gh173-phase5-confirmation.log`; phase commit pending)
- [x] **5.2** Reconcile `feature-branding-seam.md`, `feature-monorepo-scaffold-toolchain.md`, `feature-result-contract.md`, relevant spec index/glossary links against actual exports and behavior. State the documentation-only adoption path: M0-S12 supplies one credential-resolution port (environment-backed initially), later sidecar implementation may replace it, and direct/mediated adapters implement unchanged primitive ports with mediated operations forwarded locally rather than receiving local credentials. No edits to the planning sidecar concept and no credential implementation. (branding M0-S4 realization, scaffold config tier/registry text, result human-success wording and glossary links updated; full `pnpm check` PASS in `144249-gh173-phase5-confirmation.log`; phase commit pending)
- [x] **5.3** Complete packed contract tests: isolated tarball consumers import core `.` resolver/schema and contracts declarations under Node and Bun; existing adapter entries import successfully, schema/default artifacts are present and equal the public/source-derived values, and attempted `./config`/new adapter subpaths fail. Check packed declarations as well as JS; verify dependencies resolve from the packed consumer rather than workspace-only dev hoists. Extend existing exports-parity validation to run artifact checks without weakening its five-package attw behavior. (`packed-config.test.ts` 3/3 after per-package tarball dirs, core override and cleanup ordering; Node/Bun imports, artifacts/declarations and `./config` rejection PASS; `144249` log; phase commit pending)
- [x] **5.4** Add/extend boundary, ambient, workspace-entrypoint and artifact mutation fixtures: core config cannot import branding/adapters/YAML/Node helpers, adapters cannot import core root, commands cannot import serializer, runtime APIs remain confined and artifacts cannot silently drift. Reuse existing check modules; if a new invariant rule is needed it ships with a failing fixture and clean control. Check TS config/build/script-surface/CI-topology constraints and docs links/rendering; any needed CI edits are limited to additive TypeScript gate wiring, not existing bash jobs. (config branding/adapters boundary cases registered; synthetic YAML import detector added; existing artifact drift/serializer fixtures retained; boundaries 55 modules/59 deps and ambient 14 PASS; `144249` log; phase commit pending)

**Acceptance Criteria**:

- Criterion: AC-F7-3 and packed portions of AC-F3-5/AC-F5-3 pass under both hosts; no new package subpaths, ambient core reads or runtime parser in core. — PASSED (`packed-config` 3/3, exports-parity 5 publishables, boundaries/entrypoints clean; `144249-gh173-phase5-confirmation.log`).
- Criterion: docs describe all shipped behavior and limitations, including credential deferral and pending human license/TDR acceptance; the nine documented rows already shipped in Phase 1 remain exact. — PASSED (config feature spec + reconciliations; doc-distribution 80 docs clean; error-table sync included in full check; `144249` log).
- Criterion: new docs are registered and literal-clean; every changed/new boundary rule has negative evidence; existing approved matrices and gates are preserved. — PASSED (forbidden-literals clean, config boundary fixtures/registry entries, boundaries 55/59 and ambient 14; `144249` log).

**Files and modules**:

- Code areas: existing `scripts/checks/exports-parity.ts`, `scripts/checks/forbidden-literals.registry.json`, `tests/structure/config-contract.test.ts`, `tests/boundaries/**`, `tests/checks/**`; core manifest build/artifact packaging refinements only if proven necessary; existing CI TypeScript wiring only if needed.
- System docs: new config feature spec; existing branding, scaffold and result feature specs; relevant spec index/glossary. Register every newly created user-facing doc; leave planning/bash/prompt/plugin content unchanged.

**Tests**:

- TC-CONFIG-011, 017, 023, 025; packed Node/Bun import/declaration/artifact tests and isolated mutations for manifest/source drift, unknown subpath, ambient/import and error-table drift.
- Runner: build before exports, `bun test tests/structure tests/behaviour tests/golden tests/checks tests/boundaries`, `pnpm check:boundaries`, literal scan, exports-discipline/parity, error-table sync; review rendered Markdown and changed links. If distributable doc roots are touched, run `bash scripts/.tests/test-doc-distribution.sh` without editing bash sources.

**Completion signal**: current-state docs, negative boundary evidence and packed Node/Bun consumers agree with implementation, ready for independent analysis.

### Phase 6: Code Review (Analysis)

**Goal**: Independently audit correctness, security, scope and evidence without modifying implementation during analysis.

**Tasks**:

- [ ] **6.1** PM delegates independent analysis to `@reviewer` after coder's no-review handoff: trace every row of the 25-AC mapping below to code and non-vacuous test evidence; inspect seven-layer ordering, DM-2 first-match/non-read controls, per-layer-before-merge restrictions, frozen bootstrap, source position/default drift handling, exact code containment and preserved upstream behavior.
- [ ] **6.2** Audit all output paths and failure constructors for unregistered secrets/snippets, malformed discriminator summaries and writer bypass; inspect parser host-switch ordering, alias bounds, trusted-validator imports and packed consumer isolation. Inspect truthful runtime closure/multi-use accounting, fail-closed mutation tests and Proposed owner-review wording.
- [ ] **6.3** Record findings/verdict and evidence gaps through the normal review artifact workflow; verify no out-of-scope bash/prompt/plugin/planning changes, headers, credentials or unapproved boundary exceptions. Route implementation findings to Phase 7; route changed decisions to PM/decision advisor, not a silent alternative.

**Acceptance Criteria**:

- Must: reviewer produces a traceable PASS or actionable findings against spec/test plan/plan, with no fabricated test or owner-approval claims.
- Must: any missing evidence or failed negative control is treated as unfinished work; no severity downgrade solely to pass the gate.

**Files and modules**:

- Code areas: none; read-only analysis of Phases 1–5 implementation/tests/checks.
- System docs: none during analysis; review includes Phase 1 synchronized rows and Phase 5 current-state docs.

**Tests**:

- Inspect evidence for TC-CONFIG-001–025 and all mutation/security/packed controls. Ask `@runner` to reproduce questionable evidence rather than assuming a passing report.

**Completion signal**: independent verdict recorded; PASS advances to Phase 8, findings activate Phase 7.

### Phase 7: Post-Code Review Fixes (conditional)

**Goal**: Close accepted review or gate findings without expanding scope or losing regressions.

**Tasks**:

- [ ] **7.1** If findings exist, reproduce each via the relevant TC/negative fixture and add the missing regression before making the smallest fix; preserve current behavior outside the accepted config slice.
- [ ] **7.2** Fix code, catalog/artifacts, dependency accounting and matching docs together. Any error-table change carries its documented row in the same fix. Consult `@decision-advisor` through PM for selection/boundary changes; retain TDR-0003 Proposed pending the human decision.
- [ ] **7.3** PM delegates runner repetition of affected focused tests/mutations and full applicable gates, and independent re-review until PASS after delegated fixes. If no findings, record this phase as not required with reviewer evidence, rather than claim fixes were executed.

**Acceptance Criteria**:

- Must: all accepted findings closed, affected ACs remain traceable and previously green security/packed/upstream regressions still pass.
- Must: no unresolved blocker, waived check, invented production setting or undocumented scope expansion.

**Files and modules**:

- Code areas: only affected Phase 1–5 files and their corresponding regression tests; no blanket cleanup.
- System docs: corresponding config/result/branding/scaffold docs when behavior changes, with error table lockstep preserved.

**Tests**:

- Reproduce failing TC-CONFIG cases and negative controls; rerun all 25 before finalization, plus the gate set in Phase 8.

**Completion signal**: reviewer PASS after fixes, or explicit not-required state backed by Phase 6 PASS.

### Phase 8: Finalize and Release

**Goal**: Prepare a fully gated, versioned unmerged PR handoff; publishing/merge/adoption remain outside this execution slice.

**Tasks**:

- [ ] **8.1** Add the minor Changesets release intent per the existing five-publishable fixed group; verify group membership, dependency updates and private/publish guard. Do not flip private flags, publish, tag or hand-bump unrelated package versions. The release pipeline owns applying the eventual version bump; this change supplies the required minor bump declaration.
- [ ] **8.2** PM verifies spec §18's open-PR DoD: passing traceable evidence for all 25 ACs and applicable measured evidence for all nine NFR thresholds; executable negative controls and green positive controls for DM-2 disabled/selected non-reads, root bounds, malformed/shadowed/forbidden input, registered/unregistered canaries, parser switches, position/default-manifest drift, schema/error-table parity and boundary/ambient regressions. Reconcile current configuration/result/branding/scaffold/index/glossary docs, empty production/fixture behavior, packed schema/default-position artifacts, isolated Node/Bun consumption, CLI payloads and credential/mediated boundaries. Record actual states/evidence through executor logs; escalate divergences rather than rewriting approved requirements to match bugs.
- [ ] **8.3** Ask `@runner` to run the final ordered gate set below with exact commands/results and tested SHA, including whitespace preflight `git diff --check`. Require Markdown without trailing spaces and inspect newly created files too before committer staging; no claim that a plain unstaged diff checks untracked additions. Resolve failures and repeat affected/full gates rather than bypass them.
- [ ] **8.4** Have PM/committer/PR manager manage checkpoint commits and pushed-state verification; PR targets `main-tools` and all required jobs must be green on the **pushed HEAD**, not an earlier SHA. Present Proposed TDR-0003, exact runtime/license/closure rows, mechanical/security/portability evidence and pending human compatibility determination to the owner. STOP at the open unmerged PR; acceptance is required before merge/adoption, not before opening it.
- [ ] **8.5** Include rollback instructions and scope proof in the handoff: no persisted migration or operator-file rewrite. If rejected or unsafe, revert config composition, resolver/adapters, artifacts/build wiring, runtime dependency+lock+registry changes, corresponding tests/docs/error rows and Changeset as one coherent reviewed unit; retain upstream GH-170/171/172 behavior. Never roll back one side of the error-table sync, leave an unaccounted runtime dependency or replace a failure with permissive parsing. Re-run baseline checks after rollback; human review governs any replacement selection.

**Acceptance Criteria**:

- Must: spec §18's open-PR DoD has current passing evidence for 25/25 ACs, all nine applicable NFR thresholds, executable negative and positive controls, independent review/re-review, synchronized docs and packed artifacts; minor release intent and spec reconciliation are complete. Applicable local quality, license/security, packaging and existing bash gates pass without implying human TDR/license acceptance.
- Must: all `ts-*`, `bash-tests` and remaining required CI jobs are green on handoff HEAD, PR base is `main-tools`, pending human acceptance is explicit and no merge/publish occurs.
- Must: rollback is coherent and does not touch operator data, bash-stack behavior or upstream approved contracts.

**Files and modules**:

- Code areas: `.changeset/` minor release declaration; no product-code change unless a gate reopens Phase 7; executor-owned plan/test execution evidence.
- System docs: final reconciliation of Phase 1/5 current-state docs; no speculative future consumer settings or license-acceptance assertion.

**Tests**:

- Runner order: `pnpm install --frozen-lockfile` → `pnpm build` → focused TC suites and packed Node/Bun cases → `bun test tests/structure tests/behaviour tests/golden tests/checks tests/boundaries` → `pnpm check`.
- Also run the existing CI invariant set, including pnpm-foundation, ignore-rules, manifest-privacy, script-surface, workspace-entrypoints, tsconfig-strictness, changesets-group, testkit-exclusion, ci-topology, ci-bindingness, ci-supply-chain, error-table-sync, exit-code-literals and boundary-ci-parity. Build precedes any dist-dependent check; preserve exact pins.
- Run `bun run scripts/checks/exports-discipline.ts`, exports-parity and five-package `pnpm exec publint` / `pnpm exec attw --pack . --profile esm-only` with each package as working directory; pin equality, publish-guard tests, license-audit, vulnerability-gate, forbidden-literals and changed-check mutation suites. `pnpm check` does not include all these gates.
- Orchestrator verifies `ts-fresh-clone`, `ts-invariants`, `ts-typecheck`, `ts-lint`, `ts-format`, `ts-test`, `ts-boundaries`, `ts-build`, `ts-exports`, `ts-pins`, `ts-publish-guard`, `ts-license-audit`, `ts-vuln`, `ts-aggregate`, `ts-commitlint`, `ts-forbidden-literals`, `bash-tests` and other required doc/plugin/shell CI jobs on pushed HEAD. Preserve the bash job's existing excluded-suite matrix. Commit bodies follow the repository 100-character limit.
- Ask runner for `git diff --check` and committer's staged-path whitespace preflight; review rendered Markdown, changed links and the complete AC mapping. No test/build/CI execution is claimed by this plan writer.

**Completion signal**: minor release declaration, reconciled specs, current passing evidence and rollback instructions accompany an open PR to `main-tools`, awaiting owner decision; no merge or adoption claimed.

## Test Scenarios

All 25 ACs map one-to-one to the completed test plan. All are high priority; TC-CONFIG-025 is semi-automated (packed/gates automated, owner/PR handoff manual), the other 24 are automated. Detailed fixtures/steps/negative controls remain authoritative in test-plan §§5–7. Paths below preserve that implementation map; none is asserted to exist already merely because it is listed.

| TC ID | Scenario / acceptance check | AC | Primary phase(s) | Target layer / test file |
|---|---|---|---|---|
| TC-CONFIG-001 | Seven intermediate winners; recursive maps, scalars and whole-list replacement; deterministic origins | AC-F1-1 | 2, 3 | Unit/integration: `tests/behaviour/config-resolver.test.ts` |
| TC-CONFIG-002 | Reset before same-layer set; invalid targets fail even if later shadowed; descendants removed | AC-F1-2 | 2 | Unit/integration: `config-resolver.test.ts` |
| TC-CONFIG-003 | Linux XDG defaults/order, macOS/Windows paths and optional `missing` evidence | AC-F2-1 | 3 | Integration: `tests/behaviour/config-sources.test.ts` |
| TC-CONFIG-004 | Git/explicit root bounds, intermediate/parent decoys, outside-git first-match reasons and zero skipped/decoy reads | AC-F2-2 | 3 | Integration: `config-sources.test.ts` |
| TC-CONFIG-005 | Exact DM-2 CI/root/selection/independent-enable oracle; local selected > CI > root > missing; zero skipped reads | AC-F2-3 | 3, 4 | Integration: `config-sources.test.ts` |
| TC-CONFIG-006 | Selector priority and committed slot; selected-config first with zero local reads; independent system/user CI and selected-file errors | AC-F2-4 | 3, 4 | Integration: `config-sources.test.ts`, `config-cli.test.ts` |
| TC-CONFIG-007 | Actual malformed YAML fails safely at real available line, no partial data, human/machine exit 1 | AC-F3-1 | 3, 4 | Integration/contract: sources and CLI tests |
| TC-CONFIG-008 | Reserved metadata/reset, vendor extensions, unknown keys/types/null, partial and final checks | AC-F3-2 | 2, 3 | Unit/integration: `config-schema.test.ts`, sources tests |
| TC-CONFIG-009 | Empty production versus typed fixture catalog; required/nullable/defaulted semantics on same API | AC-F3-3 | 2, 4 | Unit/contract: schema tests, `tests/structure/config-contract.test.ts` |
| TC-CONFIG-010 | YAML multiline/flow/list/empty/alias real lines and unsupported-shape rejection | AC-F3-4 | 3 | Integration: `config-parser.test.ts`, YAML fixtures |
| TC-CONFIG-011 | Recursively partial versus final required; trusted validator only; packed schema parity | AC-F3-5 | 2, 5 | Unit/contract: schema and config-contract tests |
| TC-CONFIG-012 | Catalog-only typed nested env conversion, unmapped failure and two forbidden interpolations | AC-F4-1 | 2, 3 | Unit/integration: schema and sources tests |
| TC-CONFIG-013 | Every disallowed secret/path source, strict on/off, shadow/reset negatives and permitted controls | AC-F4-2 | 2, 3, 4 | Unit/integration: `config-restrictions.test.ts` |
| TC-CONFIG-014 | Exactly one brand call before discovery; neutral overlap exclusions and invalid-input contract | AC-F4-3 | 4 | Unit/integration: `config-bootstrap.test.ts` |
| TC-CONFIG-015 | Debug/get true winning origin and loaded/skipped completeness; unknown get fails | AC-F5-1 | 3, 4 | Integration/contract: `config-cli.test.ts` |
| TC-CONFIG-016 | Safe deprecated/shadowed warnings; strict classification, no raw value | AC-F5-2 | 2, 4 | Unit/integration: resolver and CLI tests |
| TC-CONFIG-017 | Effective map/list/alias/reset origins; empty-default and typed-fixture line-insertion mutations | AC-F5-3 | 2, 3, 5 | Unit/integration/contract: `config-provenance.test.ts`, `tests/checks/config-default-positions.test.ts` |
| TC-CONFIG-018 | Plain human basic/debug/get JSON and diagnostics through real serializer | AC-F6-1 | 4 | Integration/contract: CLI tests, `tests/golden/config-output.test.ts` |
| TC-CONFIG-019 | Exactly one envelope, identical redacted payloads, timing/run ID, no escaped/multiline canaries | AC-F6-2 | 4 | Integration/contract: CLI and golden tests |
| TC-CONFIG-020 | Nine exact code+kind round-trips; singleton/mismatch containment; bidirectional table drift | AC-F6-3 | 1, 4 | Unit/contract: existing classification/table/sync tests |
| TC-CONFIG-021 | Both actual host debug switches block before parser with zero unregistered source canary output | AC-F6-4 | 3, 4 | Integration/contract: parser/CLI tests and isolated subprocesses |
| TC-CONFIG-022 | Unregistered malformed/schema/forbidden/strict file canaries absent in all streams/modes | AC-F6-5 | 4 | Integration/contract: CLI and golden tests |
| TC-CONFIG-023 | Repeat injected facts across ambient changes, two brands and forbidden-import controls | AC-F7-1 | 2, 4, 5 | Unit/contract: resolver tests, `tests/boundaries/**` |
| TC-CONFIG-024 | Legacy current-wins, once-per-process injected safe warning, no credential/remote work | AC-F7-2 | 3, 4 | Integration/contract: legacy adapter and CLI tests |
| TC-CONFIG-025 | Packed Node/Bun APIs/types/artifacts, declared entries, closure/gates and manual PR owner boundary | AC-F7-3 | 1, 5, 8 | Contract/integration/manual: config-contract, boundaries and checks suites |

Phase 6 independently reviews all rows; Phase 7 replays affected rows; Phase 8 requires current evidence for all rows. The security matrix includes registered env success controls and **unregistered** file failure canaries; neither a direct `redact()` test nor hand-built source facts can replace actual parser/command coverage. Mutations edit isolated copies only and must fail for the intended reason with an unchanged passing control. Temporary roots/subprocesses/artifact consumers must be cleaned up, with no real user HOME/config/secrets used.

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Completed change spec | [chg-GH-173-spec.md](./chg-GH-173-spec.md) | Source of requirements, DM-2 matrix and §18 DoD; supplied checkpoint `4097f60` |
| Completed test plan | [chg-GH-173-test-plan.md](./chg-GH-173-test-plan.md) | Source of 25 TC IDs, overlap/read-count oracle, test locations, automation and AC mappings; supplied checkpoint `f548533` |
| Readiness iteration 1 | [readiness-iter-1.md](./readiness-review/readiness-iter-1.md) | Reopened skip-reason consistency and explicit DoD findings; PM must obtain renewed readiness verdict |
| This plan | `./chg-GH-173-plan.md` | Only file written by this authoring pass |
| PM scope evidence | [PM notes](./chg-GH-173-pm-notes.yaml) | Read-only; historical chronology and resolved checkpoint issues preserved |
| Accepted architecture | [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md) | Seven layers and package/tier matrix |
| Proposed parser/schema/acquisition selection | [TDR-0003](../../../decisions/TDR-0003-config-parser-schema-and-acquisition.md) | Proposed, pending owner PR review; existing record is the decision follow-up location |
| Testing strategy | [testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | Test/gate and mutation conventions |
| New system config feature | `doc/spec/features/feature-config-layer.md` | Phase 5 implemented current-state contract; register in literal scope |
| Existing binding result feature | `doc/spec/features/feature-result-contract.md` | Phase 1 error rows/invariant and Phase 4 output synchronization |
| Existing brand/scaffold features | `doc/spec/features/feature-branding-seam.md`, `feature-monorepo-scaffold-toolchain.md` | Phase 5 seam/tier reconciliation |
| Runtime contracts/implementation | `packages/core/src/contracts/config.ts`, `packages/core/src/config/**` | Plain acquisition facts and pure exported production resolver |
| Packed config artifacts | core `dist` schema and defaults position manifest/source evidence | Generated from catalog/default source in Phase 2; checked in workspace and packed consumers |
| Runtime acquisition | existing adapters `./file`, `./repo`, `./legacy` | Real parser/discovery/compatibility; no new public subpaths |
| Inspection | CLI edge/command/index and existing output serializer | One resolved snapshot and redaction chokepoint |
| Dependency governance | `doc/legal/dependency-licenses.yaml`, manifests/lock, `scripts/checks/license-audit.ts` | Truthful proposed runtime closure/multi-use records and fail-closed audit |
| Release intent | `.changeset/` minor declaration | Fixed five-package release convention; no publishing in this plan |

No new standalone delivery-infrastructure check is planned. Existing check modules are extended and covered by corresponding tests, avoiding any unregistered script or bash install-list edit. If execution genuinely needs a new script/tool, repository install registration is mandatory and conflicts with current scope until PM resolves it; no such addition is pre-authorized here.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-30T06:53:58Z | Implementation Plan Writer | Initial eight-phase, 39-task plan; 25/25 AC mapping, synchronous error docs, runtime closure governance, parser/provenance/security/packed controls, rollback and owner-review gate. |
| 1.1 | 2026-10-30T07:14:25Z | Implementation Plan Writer | DoR iteration 1: aligned tasks 3.4/3.5, acceptance and scenarios with DM-2 first-match/non-read oracle; synchronized explicit spec §18 DoD, existing test-plan linkage and supplied checkpoints; clarified PM-owned review/fixes/final handoff after coder no-review. Preserved all task/AC/TC IDs and execution history; only this plan edited, no git/build/test operations. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| Authoring | Complete | 2026-10-30T06:47:31Z | 2026-10-30T06:53:58Z | none | Read completed spec/test plan, template, Proposed TDR, PM notes, actual code/boundaries/gates. UTC obtained from system clock. Content search found no trailing whitespace or angle-bracket placeholders before final metadata/path cleanup. Only this plan written; no git/build/test operations or source/PM-note edits. Runner/committer whitespace diff preflight remains required. |
| 1 | Complete | 2026-10-30T07:22:34Z | — | 7661d46 | Tasks 1.1–1.6 and Phase 1 acceptance verified by `tmp/run-logs-runner/2026-10-30/083149-phase1-verification-gh-173.{log,meta.json}` (15 commands exit 0; 67 tests/809 assertions, sync 13/13, license/vulnerability/boundaries/typecheck/lint/format/diff PASS). Manifests/lock confirm adapters yaml runtime, core Ajv runtime, root yaml dev. Three lint warnings and one info non-blocking; owner TDR/license decision remains pending before merge. Commit and clean checkpoint reported by PM. |
| 2 | Complete | — | — | e94b2fe | Initial runner `tmp/run-logs-runner/2026-10-30/084918-gh173-phase2-verify.log` passed all except lint; two callback-return errors fixed. `085105`–`085125` logs all 7 commands green. Remediation log `tmp/run-logs-runner/2026-10-30/085818-gh173-phase2-remediation.log`: 11 commands exit 0, build/artifacts, 24 tests/171 assertions, exports/ambient/boundaries/typecheck/lint/format/diff PASS; source/fixture drift and injected packed-manifest controls exercised. Commit `e94b2fe` clean per PM; actual production edge manifest injection remains 4.1. |
| 3 | Complete | 2026-10-30T13:08:48Z | — | 7fb56de | `tmp/run-logs-runner/2026-10-30/144454-gh173-phase3-verify.log` all 13 steps exit 0: build/focused tests, boundaries, entrypoints, ambient, error-table-sync 13, license, forbidden-literals, exports-parity, typecheck, lint, format, diff. 64 tests/386 expectations across 7 files (sources 31, parser 6, resolver 2, schema 3, restrictions 4, provenance 4, legacy 14). Selected-config attribution fix hoists selection in `config-source.ts`; actual-path tests pass. Biome format applied to `config-sources.test.ts`. Pre-existing warnings only (ci-checks useIndexOf info, error-classification unused imports, two intentional noTemplateCurlyInString). Phase 3 committed as `7fb56de`. |
| 4 | Complete | 2026-10-30T14:08:00Z | — | 74e6f28 | `150745-gh173-phase4-full-rerun.log`: build 0; 126 tests/730 expectations/10 files all pass (config-cli 14, config-output 4, redaction 14, broken-command 16, cli-edge-seam 12, run-cli 10, content-inventory 5); ambient/boundaries/entrypoints/error-table-sync/license/forbidden-literals/exports-parity/typecheck/lint all 0; only format:check failed on 2 files. `150902-content-inventory-biome-format.log`: biome format applied to 2 files, format:check clean over 189 files, inventory 5/5 pass, values unchanged. Strict-TS fixes: typed `next` locals in `commands/config.ts` and conditional `RepositoryRootFacts` construction in `edge.ts`. Inventory refreshed with real modules; repo adapter executable allowance follows the existing adapter pattern. S1 false positive resolved by destructuring (`configSnapshot`/`configWarnings`), no recognizer/table change. UTC 14:08–14:09Z. Phase 4 committed as `74e6f28`. |
| 5 | Verified; checkpoint pending | — | — | — | `144249-gh173-phase5-confirmation.log` (UTC 14:45:14Z): `pnpm check` exit 0, all stages green — lint, format, typecheck 6/6, test 512 pass/0 fail/2879 expectations/48 files (including RSK-4 pnpm-isolation rejection observation), boundaries 55 modules/59 deps, ambient 14, entrypoints OK, exports-parity 5 publishables attw esm-only. Packed-config 3/3 after per-package tarball dirs + `pnpm.overrides` core tarball + cleanup ordering; branding-seam 5/5 after making `NEUTRAL_OVERRIDE_NAME` module-private; legacy-confinement 7/7 after adding `CONFIG` to `structuralLiterals`; doc-distribution guard green (80 docs, no drift); `feature-config-layer.md` registered and forbidden-literal scan clean. Phase 5 commit pending; Phase 6+ unchecked. Review remediation (pending runner): core config imports use `#contracts`; additive public `serializeProductionSchema` replaces the deep check import while artifact text stays identical; config-contract uses named public imports; the negative manifest test uses one justified cast; guard-validated resolver narrowings carry comments only. Gates unchanged. |
| 6 | Not started | — | — | — | Independent review pending implementation. |
| 7 | Conditional | — | — | — | Activate only for review/gate findings; otherwise record not required with evidence. |
| 8 | Not started | — | — | — | Final gates, version intent, reconciliation and open-PR handoff pending. |
