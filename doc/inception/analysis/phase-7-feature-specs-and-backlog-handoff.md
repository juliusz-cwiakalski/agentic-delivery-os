---
id: TOOLING-INCEPTION-PHASE-7-FEATURE-HANDOFF
status: Draft
created: 2026-11-02
last_updated: 2026-11-02
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Legacy M0 feature-contract reconciliation, XC-001..013 coverage and proposed local follow-up AC; final sign-off pending."
---

# Phase 7: feature specs and backlog handoff

## Purpose and authority

Baseline: `docs/GH-200/tooling-inception` HEAD `bd34031`, integrating
`main-tools` `5330809`, including closeout and recovered verify gates.
Gate 6 is approved; Phase 7 final sign-off is pending. This is a derived
handoff, not a second backlog, new product direction or decision acceptance.
The [roadmap](../../planning/oss-tooling/roadmap.md),
[backlog](../../planning/oss-tooling/backlog.md),
[registry](../../planning/oss-tooling/cli-command-registry.md) and
[journeys](../../planning/oss-tooling/user-journeys.md) retain their ownership.

Legacy initial feature specs are fulfilled by reconciling existing current-truth
contracts with code, tests and documentation behavior below, not by making twenty
duplicate specs. These homes already cover the feature template's capabilities,
failure boundaries, architecture and quality evidence. Documentation-only S16
and static-data/decision S17 do not become runnable engines. Representative
high-risk paths were inspected directly; no runtime or full test battery ran.

## M0 feature-contract map

Each row maps one existing story to its anchored canonical feature home and
concrete behavior/evidence. Paths in evidence cells are repository-relative.
This is twenty mapped outcomes, not twenty operational engines or M0 exit.

| Story / ticket | Canonical feature home | Reconciled contract and evidence boundary |
|---|---|---|
| S1 / GH-170 | [Scaffold](../../spec/features/feature-monorepo-scaffold-toolchain.md#package-set-and-entrypoints) | Six private packages and declared exports; manifests and workspace checks enforce structure. `core/src/index.ts` only declares `createRuntime`; see HANDOFF-004. |
| S2 / GH-171 | [Branding](../../spec/features/feature-branding-seam.md#derivation-rules) | Identity derives names; `packages/core/src/branding/`, `tests/behaviour/branding-resolver.test.ts`; literal registry membership is separately required. |
| S3 / GH-172 | [Result](../../spec/features/feature-result-contract.md#envelope-field-contract) | Exactly one data/error envelope, classified exits and registered-secret redaction; CLI serializer and feature-listed goldens. Not a universal secret detector. |
| S4 / GH-173 | [Configuration](../../spec/features/feature-config-layer.md#overview) | Layer merge/provenance and fail-closed validation; `core/src/config/`, `tests/behaviour/config-restrictions.test.ts`. Parser units remain HANDOFF-006. |
| S5 / GH-174 | [State](../../spec/features/feature-state-layer.md#capabilities) | Verified JSONL truth, fences and projections; `core/src/state/`, `tests/behaviour/state-fence.test.ts`. Local level only; platform evidence qualified. |
| S6 / GH-175 | [Status](../../spec/features/feature-status-digest.md#evidence-counts-truncation-and-bounds) | Read-only six-section digest with unknowns, counts and visible truncation; status contracts/domain and `tests/behaviour/status-output.test.ts`. Human 24 lines/4096 bytes; data 65536 bytes. |
| S7 / GH-176 | [Queue ready](../../spec/features/feature-queue-ready.md#six-readiness-conditions-and-their-sources) | Bounded tri-state ready-set, close-first ranking and at most eight candidates; queue domain and negative-control/output suites. No dispatch or ownership acquisition. |
| S8 / GH-177 | [Verify change](../../spec/features/feature-verify-change-and-exit-taxonomy.md#overview) | Full/LITE ledger completeness and delivery taxonomy, network-free; verify handler and registry overlay. Ledger finished is not permission to merge. |
| S9 / GH-178 | [Verify gates](../../spec/features/feature-verify-gates.md#gate-rules) | Integrated recovery implements five cited read-only gates; `verify.ts` dispatches `change` and `gates`, with gates runtime supplied. CI missing/red/vacuous cases have direct tests. |
| S10 / GH-179 | [Lint and transitions](../../spec/features/feature-pm-notes-lint-and-phase-transitions.md#phase-command-and-the-idempotency-matrix) | Schema-checked phase state, idempotent complete/reopen and reason requirements; phase domain/state and feature-listed tests. No authority transfer from a completed ledger. |
| S11 / GH-180 | [Session admin](../../spec/features/feature-session-database-admin.md#destructive-operation-boundaries) | Metadata-only size/list and dry-run-first guarded prune/checkpoint; session adapter and prune/reboot/privacy suites. C-11 human privacy sign-off remains separate. |
| S12 / GH-181 | [Adapter ports](../../spec/features/feature-adapter-ports.md#credential-resolution) | Capability flags, credential port, metadata roundtrip/degradation; contracts, credential adapter and secret-read boundary checks. No general sidecar implementation. |
| S13 / GH-182 | [Provider](../../spec/features/feature-provider-engine.md#parks) | Quota/peak availability, expiring named parks and announcements through injected ports; provider engine/tests. No model selection/spawn or demonstrated production host mounting. |
| S14 / GH-183 | [Closeout](../../spec/features/feature-closeout.md#deterministic-twelve-step-plan) | Twelve-step plan by default, explicit apply, supported GitHub/Jira writes, real git/state composition and replay history. Integration uses real local git/store with mocked providers; not live-write parity. |
| S15 / GH-184 | [Privacy](../../spec/features/feature-privacy-guard.md#overview) | Working-tree guard and exact metadata-emitter policy; privacy checker/registry and emitter negative controls. Empty hashed classes remain explicit, not configured private-term coverage. |
| S16 / GH-185 | [Autonomous delivery](../../spec/features/feature-autonomous-delivery.md#configuration), [mitigations](../../guides/delivery-modes.md#interim-mitigations-permission-denial-and-the-join-warning) | Existing docs/config reconciliation only: permission denial, stuck defaults, JOIN warning and pm-notes authoring rule. GH-185 plan/notes identify edited homes and no shell behavior change. No separate engine spec needed. |
| S17 / GH-186 | [Measurement](../../spec/features/feature-measurement-baseline.md#6-status-semantics), [decision audit](phase-3-decision-reconciliation.md#existing-homes-and-acceptance-boundary) | Static source-traced PARTIAL baseline plus existing ADR-0008/0009 and ODR-0002/0003 homes. Four metric definitions/proxy caveats preserved; record creation is not human acceptance. |
| S18 / GH-187 | [License registry](../../spec/features/feature-monorepo-scaffold-toolchain.md#license-registry) | Schema-v3 registry, fail-closed audit and compound SPDX/deny precedence controls; `scripts/checks/license-audit.ts`, license policy/exit/CI tests. Human determination remains pending. |
| S19 / GH-188 | [Client seeds](../../spec/features/feature-provider-client-seeds.md#capability-and-gap-posture) | Normalized provider reads/traps; GitHub/Jira supported closeout writes are additive integrated behavior, GitLab writes remain gaps. Feature-listed trap fixtures and client sources bound the claim. |
| S20 / GH-189 | [Conformance](../../spec/features/feature-adapter-conformance.md#capability-gating) | Production-client mock execution, declared-gap skips and non-vacuous coverage; mock/broken-adapter suites. Live tier is GET-only with zero created artifacts; not-configured is not live success. |

The [status snapshot](../../planning/oss-tooling/status.md) predates the S9
recovery audit: its PR #213 row alone is not implementation evidence. Read
twenty-story delivery claims with recovery PR #217 and actual integrated source.
Historical Phase 2 and risk-register missing-gates/unmerged-closeout premises
remain dated evidence, superseded for current capabilities by this map.

## Representative source-to-contract probes

1. **Recovered gates:** [handler](../../../packages/cli/src/commands/verify.ts)
   `parseGrammar` accepts exactly `change | gates` plus one ref. Missing gates
   composition rejects rather than inventing a verdict. The leading ledger-only
   comment lags the actual dispatch; executable code determines this finding.
   [CI tests](../../../tests/behaviour/verify-gates-ci.test.ts) assert red,
   missing-job, zero-run and all-skipped failures; expected-success counts and
   citation names are checked. The contract's owner gate is label-based; comments,
   matrix expansion and suite-to-job mapping remain deferred, not inferred.
2. **Closeout:** [edge](../../../packages/cli/src/edge.ts) constructs
   `createCloseoutComposition` with provider clients, real git and state;
   `planFacts` reads merged request, dependents, checkout and history.
   [ledger](../../../packages/core/src/state/closeout.ts) validates operation
   payloads and terminal history; deterministic identities/fenced appends support
   replay, not a separately invented write-ahead-intent protocol.
   [integration test](../../../tests/behaviour/closeout-integration.test.ts)
   drives plan/apply through `runCli`, observes branch retention/deletion and
   persisted history over real temporary git/store. Providers are mocked.
3. **Not delivered by those probes:** [core root](../../../packages/core/src/index.ts)
   uses `export declare`; [CLI manifest](../../../packages/cli/package.json) has
   no `bin`; [MCP](../../../packages/mcp/src/index.ts) and
   [typed host](../../../packages/opencode/src/index.ts) export placeholder types.
   Existing prompt integration is not that typed implementation.
4. **Concrete follow-ups still present:**
   [shell CI](../../../.github/workflows/ci.yml) uses `find -exec bash {} \;`,
   which does not aggregate failing child statuses; prior read-only negative
   control is recorded in the [quality baseline](phase-4-quality-baseline.md#ci-baseline-and-concrete-failure-propagation-finding).
   [YAML](../../../packages/adapters/src/file/yaml-parser.ts),
   [pm-notes](../../../packages/adapters/src/file/pm-notes-parser.ts) and
   [CI workflow](../../../packages/adapters/src/file/ci-workflow.ts) compare
   `text.length` to byte-named limits. UTF-8 enforcement is not proved by names.

## Cross-cutting coverage: stable Phase 2 IDs

Sources: [Phase 2 matrix](phase-2-scope-and-coverage.md#derived-cross-cutting-matrix),
[risks](risks.md#register) and [NFR index](../../spec/nonfunctional.md).
Represented means a named story AC or current contract verification, not field
validation. Partial/missing early coverage is an explicit local follow-up below.
No assertion that a concern is covered by every story substitutes for this map.

| ID / risk | Dedicated story AC or canonical verification | Current coverage and local route |
|---|---|---|
| XC-001 / RSK-002/003 | M0-S9: red pipeline, missing job, vacuous green and citations; five-gate contract/probes above. | Bounded contract represented and implemented. Shell job can still report success after failed children: HANDOFF-005. Suite-to-job breadth belongs to M2-S7. |
| XC-002 / RSK-003 | M0-S5: torn state never zeros; M0-S10: malformed writes rejected/idempotent transitions. | Current state/phase contracts represent bounded coverage. Platform ACL/growing-ledger evidence remains partial: HANDOFF-007; M1-S2 expands validation. |
| XC-003 / RSK-004/009 | M0-S14: restart rerun converges; closeout operation ledger and integration/retry tests. | Integrated local/mock evidence replaces unmerged premise. Live interrupted-step validation is missing: NFR-TOOL-009, HANDOFF-003. |
| XC-004 / RSK-006 | M0-S12 secret-read boundary; M0-S15 emitter scan/guard AC; privacy and credential feature contracts. | Implemented scoped mechanics, not human privacy sign-off or configured coverage. Parser units HANDOFF-006; owner coverage HANDOFF-008. |
| XC-005 / RSK-004 | M0-S20 mock suite and broken-flow AC; conformance capability/execution gates. | Supported production writes executed against mocks; live GET-only deferrals explicit. Live mutation evidence partial: HANDOFF-003; adapter breadth M3-S3. |
| XC-006 / RSK-002 | M0-S13: cause/expiry and announced outage; provider parks/announcement contract. | Injected mechanism represented; production mounting/effectiveness absent: HANDOFF-004 and pilot HANDOFF-001. |
| XC-007 / RSK-002/009 | M0-S3 broken-command JSON; M0-S6 six evidence-backed sections; status/queue byte and count caps. | Mechanical output represented; observed operator/agent actionability absent: NFR-TOOL-010, HANDOFF-009. |
| XC-008 / RSK-007 | M0-S18: unregistered/denied license fails CI; schema-v3 audit/deny controls. | Mechanical coverage represented, human determination not supplied: HANDOFF-008; NFR-TOOL-013 proposal. |
| XC-009 / RSK-001 | M0-S17: source-traced baseline; measurement feature status semantics. | Proxy baseline represented. Direct attention/accepted-delivery protocol unrepresented in dedicated M0 story AC: NFR-TOOL-012, HANDOFF-002. |
| XC-010 / RSK-003 | Roadmap M0 two-week dual-run exit; M1-S9 pilot-ticket divergence AC. | Future dispatch story is not M0 pilot coverage. Explicit M0 protocol/owner/ticket still missing: HANDOFF-001, NFR-TOOL-012. |
| XC-011 / RSK-005 | M3-S4 classified validation/fix-hint AC; strict metadata/glossary readiness checks. | Bounded graduation repaired and readiness passed. Continuous navigation/framework consistency remains partial: HANDOFF-010. |
| XC-012 / RSK-008 | M0-S2 literal guard AC; M0-S1 boundary AC and registered negative fixtures. | Four exact new memberships integrated under owner authorization; focused guard PASS at Phase 7 draft integration, no rule/seed changes. Not full CI certification; HANDOFF-010 for upkeep. |
| XC-013 / RSK-008 | M4-S6: complete local function with no remote service configured. | Release-stage representation explicit. Early local/install evidence absent: NFR-TOOL-011, HANDOFF-011; no M0 coverage inferred from release AC. |

## Proposed initial follow-up representation

**All HANDOFF IDs below are local proposed requirements, not accepted canonical
AC, issued tickets, implementation commitments or status changes.** Each has a
bounded acceptance seed and next gate. PM/Owner must approve routing before
normal delivery. Missing ticket references are intentional, not fabricated.
Existing feature homes remain canonical; these scoped seeds avoid a duplicate
planned-feature spec. NFR-TOOL-009..013 remain proposals, not new universal SLOs.

### HANDOFF-001: M0 pilot evidence contract

- Owner proposed: Runner/reviewer with Owner; next gate: pilot protocol, then M0 exit.
- Proposed AC: name eligible per-engine paths and comparison units; retain shell
  authority until explicit cutover. Cite independent tracker/PR/job/SHA evidence,
  exposure, divergences, token-level result comparisons and rehearsed rollback.
  Record the two-week window, false-success cases and owner-approved restart/reset
  treatment; zero exposure is not zero incidents. No pilot result claimed here.
- Route: roadmap M0 exit, Q7/9/16, NFR-TOOL-012; no dedicated M0 ticket assigned.
  M1-S9 is a later dispatch pilot, not a substitute for this evidence.

### HANDOFF-002: Direct owner-attention collection

- Owner proposed: Owner with PM; next gate: agree protocol before outcome claims.
- Proposed AC: define direct attention/interventions, accepted-delivery denominator,
  sampling, missing-data/exclusions, collection effort and quality/rework/fallback/
  maintenance guardrails; collect source-linked comparisons with equal definitions.
  Preserve GH-186's immutable PARTIAL proxies without relabeling them direct data.
- Route: Q8, NFR-TOOL-012; M2-S6 may consume it later; no follow-up ticket assigned.

### HANDOFF-003: External replay and capability evidence

- Owner proposed: Engineering/reviewer; next gate: authorize sandbox validation
  before live mutation/cutover. Proposed AC: interrupt before/after supported
  external steps, inspect actual artifacts on unknown consequences, replay from
  persisted history and report convergence, duplicate effects and declared gaps.
  Keep current local/mock evidence distinct from live-write parity and record
  authorization/cleanup boundaries. Do not expand live conformance implicitly.
- Route: NFR-TOOL-009, closeout contract, Q9/16; M3-S3 adapter expansion if needed;
  no dedicated validation ticket assigned.

### HANDOFF-004: Runtime and surface reconciliation

- Owner proposed: PM with engineering; next gate: scope review before operational
  CLI or cross-surface claims. Proposed AC: reconcile M0-S1's shared-root task
  with the declaration; implement callable composition/executable mounting only
  through approved delivery and provide artifact-backed host smoke. Keep typed
  MCP/host placeholders and unmounted provider factories explicit until delivered.
- Route: Q13, M0-S1 scope reconciliation; M1-S7 minimal MCP, M1-S11 harness adapters
  and M3-S1/S2 broader surfaces. No new wiring ticket or completion claim assigned.

### HANDOFF-005 and HANDOFF-006: Binding gates and input units

- HANDOFF-005 owner proposed: Engineering/runner; next gate: scoped CI delivery.
  Proposed AC: a synthetic failing discovered shell suite makes the actual job
  command nonzero, a succeeding suite passes, and current exclusions/discovery
  remain explicit. Route Q19/ADR-0003 C-8; no repair ticket assigned.
- HANDOFF-006 owner proposed: Engineering/reviewer; next gate: parser repair review.
  Proposed AC: reconcile byte-named limits in config YAML, pm-notes read/prepare
  and CI-workflow acquisition with UTF-8 behavior; add ASCII/multibyte at/over-limit
  controls, classified failures and pre-parse rejection without source leakage.
  Preserve resource bounds. Route Q15/NFR-TOOL-005; no repair ticket assigned.

### HANDOFF-007 and HANDOFF-008: Support and separate owner gates

- HANDOFF-007 owner proposed: Engineering/runner with Owner; next gate: support
  commitment/runtime change. Proposed AC: name OS/runtime/reference workload,
  exercise real Windows ACL isolation where claimed, test growth/contention and
  full-command versus pure-policy costs, and publish supported/untested limits.
  Route Q14/16, state contract/NFR-TOOL-003/004; no dedicated ticket assigned.
- HANDOFF-008 owner: Owner, reviewer supports; next gate: each separate approval.
  Proposed AC: explicitly disposition each of thirteen Proposed records; record
  dependency-license determination and session-admin C-11 privacy review separately.
  Preserve accepted empty-coverage residual until owner-local stdin digest
  population/review, with no protected terms or values in public artifacts.
  Route readiness owner package and Q12/15; existing record homes, no new ticket.

### HANDOFF-009..011: Caller evidence, documentation and local operation

- HANDOFF-009 owner proposed: Owner/reviewer; next gate: pilot walkthrough criteria.
  Proposed AC: operator and agent identify unknown/truncated/park/partial-failure
  states and next safe action in plain/assistive terminals; record confusion and
  extra probing, not just cap compliance. Route Q9/16/NFR-TOOL-010; no ticket assigned.
- HANDOFF-010 owner proposed: PM with reviewer/toolsmith; next gate: authorized
  maintenance/integration. Proposed AC: validate metadata and combined feature
  meaning, exact corpus membership and negative controls; reconcile decision
  navigation and verify-only framework wording without regenerating scope or
  weakening guards. Route Q11/12, M3-S4 and NFR-TOOL-013; no new ticket assigned.
- HANDOFF-011 owner proposed: Engineering/Owner; next gate: decide early-check
  sequencing or retain release-stage validation. Proposed AC: classify local-only
  versus tracker/model-API-dependent paths; run approved local subset with hosted
  integration absent/network denied and verify explicit unavailable states.
  Record install/maintenance friction. Route Q9/16, NFR-TOOL-011, M4-S6; no ticket assigned.

## Handoff gate

The [summary](../inception-summary.md) and
[OPEN-Q21](../open-questions/phase-7-open-questions.md#open-q21-final-inception-sign-off)
request final knowledge-base approval only. Existing Q7..19 carry residual choices;
no duplicated product-direction vote or human answer is invented. Phase 7 remains
in progress. Inception approval cannot establish M0 exit, pilot success, license/
privacy sign-off, record acceptance, active-writer transfer or public release.
