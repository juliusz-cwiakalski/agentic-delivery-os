---
id: TOOLING-INCEPTION-PHASE-2-SCOPE
status: Draft
created: 2026-10-31
last_updated: 2026-11-01
owners: [bootstrapper]
area: engineering
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Derived M0 remainder scope, reconciled delivery snapshot, milestone validation, and explicit cross-cutting coverage gaps."
---

# Phase 2: scope and coverage

Gate 2 approved on 2026-11-01 with OPEN-Q7..Q11 carried forward. This accepts
the reconciliation view, not delivery completion, unanswered repair routes,
decision-record acceptance, or the claim that every quality gate is green.

**Gate 2 review draft. Current Milestone: M0 remainder, not MVP.** No completed
milestone is established by this review. This is a derived review view of the
existing plan, not a second roadmap or an approved backlog amendment.

## Canonical homes and review basis

- [North star](../../overview/01-north-star.md): approved outcome, single-user
  local scope, and documentation ownership. No separate OST or PRD; outcome
  hypotheses remain in [assumptions](assumptions.md).
- [Roadmap](../../planning/oss-tooling/roadmap.md): milestone scope and exits.
- [Backlog](../../planning/oss-tooling/backlog.md): story requirements and dependencies.
- [Ranking](../../planning/oss-tooling/backlog-ranking.md): suggested sequence,
  distinct from strict dependencies.
- [Registry](../../planning/oss-tooling/cli-command-registry.md): planned command
  surface. [Journeys](../../planning/oss-tooling/user-journeys.md): usage flows,
  not proof of delivered behavior.
- [Feature specs](../../spec/features/): delivered behavior. In particular,
  [verify change](../../spec/features/feature-verify-change-and-exit-taxonomy.md)
  is ledger-only; [provider](../../spec/features/feature-provider-engine.md)
  resolves availability, not model selection or session spawn. Provider production
  factories are not yet imported by a production host composition per its spec.

Snapshot: local HEAD `773f2c9`, integrating `main-tools` at `3ebc61f` on
2026-11-01. Read-only repository and GitHub reconciliation distinguishes
merged artifacts, runnable behavior, issue state, decision acceptance, and
milestone outcomes. Earlier repo-analysis, inventory, and state-file snapshots
predate this integration; this draft does not update those files.

## Reconciled M0 delivery state

There are **18/20 merged story outcomes supported by repository evidence**,
including documentation/configuration deliveries GH-185 and GH-186. This is
not a count of 18 runnable engines. The live issue query also returns
**18/20 CLOSED**, but for a different set: GH-177 is implemented and OPEN;
GH-178 is CLOSED but its merged outcome is planning/readiness artifacts only.

| State at review | Stories / evidence |
|---|---|
| Earlier delivered outcomes | S1 GH-170, S2 GH-171, S3 GH-172, S4 GH-173, S5 GH-174, S8 GH-177, S10 GH-179, S12 GH-181, S13 GH-182, S16 GH-185, S19 GH-188; GH-177 alone remains OPEN in this set |
| Additional merged outcomes | S15 GH-184 `7155074`, S18 GH-187 `08a9a5e`, S6 GH-175 `32b894c`, S17 GH-186 `b31ec47`, S20 GH-189 `34e9819`, S11 GH-180 `f073ffd`, S7 GH-176 `3ebc61f`; all issues CLOSED |
| Closed without runnable delivery | S9 GH-178 `dcc6fc6`: nine change-artifact/readiness files; no command source. PM notes leave delivery through PR creation unset. |
| Unmerged implementation | S14 GH-183, issue OPEN; feature worktree contains code and review evidence, but no merged outcome or matching PR was found at observation. |

Two implementation gaps remain in the integrated tree: GH-178 and GH-183.
[GH-178 PM notes](../../changes/2026-10/2026-10-31--GH-178--verify-gates-v1/chg-GH-178-pm-notes.yaml)
record DoR completion only. Direct inspection of
`packages/cli/src/commands/verify.ts` confirms only `verify change` grammar;
the commit message's gate-verification claim is not runnable-delivery evidence.
Its spec defines five gates, with suite-to-job mapping, comment-based owner asks,
and metadata-provenance consumption deferred; neither scope nor deferral is
implementation. GH-183's worktree record reports production-wiring remediation
and review iteration-2 PASS, while final quality-gate completion, DoD and PR
creation remain unset. These are work-in-progress records, not merged proof.

## Current Milestone scope and dependencies

In: finish verify gates and closeout, using delivered status/tracker reads and
ledger verification, and establish the acceptance and pilot evidence required
for M0 exit. Queue-ready remains read-only. DB admin, privacy, licensing,
conformance and the proxy baseline are delivered within their stated boundaries;
decision acceptance and milestone outcome validation remain separate.

The declared GH-176 dependency on GH-175 is fulfilled. GH-178's verify/seed
dependencies and GH-183's seed dependency are merged, but dependencies do not
establish gate implementation or closeout writes. GH-189 supplies capability-aware
conformance without filling those write gaps. GH-183's unmerged scope names
GitHub/Jira write implementations and GitLab gaps; integrated capability truth
remains read-only. Ranking is sequencing guidance, not a milestone waiver.

GH-186 delivered the partial proxy baseline and the four foundational records:
[ADR-0008](../../decisions/ADR-0008-harness-adapter-contract.md),
[ADR-0009](../../decisions/ADR-0009-release-model-v1.md),
[ODR-0002](../../decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md), and
[ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md).
All remain `Proposed` with null decision dates. They are existing reconciliation
homes, not missing phase 3 seeds; merge does not establish human acceptance.

Out for M0: production queue/dispatch takeover, merge/deploy transactions,
full MCP/harness surfaces, model-profile selection, shared/team state, and
public naming/publication. Parked concepts constrain seams without adding
implementation work. Screen inventory and GUI artifacts are inactive; the
existing CLI/agent journeys are retained. Owner-approved thin ubiquitous
language is a phase 4 output, with primitive definitions staying in the catalogue.

## Outcomes and validation by milestone

Targets quoted below come from the roadmap. Proposed evidence procedures need
gate approval; no baseline values or pilot results are invented here.

| Milestone | Deliverables and outcome target | Dependencies | Validation approach / decision |
|---|---|---|---|
| M0, current | Protected engines beside shell; "zero false-success incidents on pilot paths over two weeks"; repo adopts scaffold. Owner attention improvement is the north-star hypothesis, not yet quantified. | GH-178 implementation, GH-183 completion, acceptance reconciliation for existing Proposed records, direct collection contract and independent pilot evidence; delivered proxy baseline reused | Runner records per-engine comparisons, exposure and divergence against actual artifacts; Owner reviews attention and quality. Exit only on evidence, otherwise remediate. XC-009/010 propose missing measurement/protocol follow-ups. |
| M1, outline | Watchdog, state validation, doctor, merge/deploy, SLA, brief, minimal MCP, retros, harness adapters, pilot and capsules; "false-success and lying-liveness counts near zero on migrated engines" and merge near-misses structurally impossible. | M0 exit; M1-S9 depends on verify and M1-S11; engine readiness before MCP | Replays for named merge traps plus pilot incident/exposure records and operator review. Define "near zero" and named near-miss classes at M1 refinement; not acceptance-ready numerical thresholds today. |
| M2, outline | Queue/lanes/dispatch, supervise, ceremonies, board, steer, metrics/spend and memory; ceremony share "trending below 40 percent", idle coordination near zero, owner-gate median age under two days. | M1 exit and dual-run evidence; M2-S6 depends on harness telemetry and ceremonies | Source-linked before/after metrics, owner-gate ages, dispatch parity and incident review; approve handover per repo only after required clean evidence. Define trend window, exposure and "near zero" at refinement. |
| M3, outline | Harness/full MCP, adapter completion, validators/policy/utilities, memory tooling and internal readiness; self-delivery for a "consecutive run of changes", coordinating-session MCP use and equivalents/deprecation notices. | M2 exit, proven engines, adapter conformance | Cross-surface and provider-matrix results, cited self-delivery artifacts and deprecation inventory; define run length before acceptance, then decide internal readiness. |

M4 remains the public-release boundary in the canonical roadmap; this review
does not pull release work into M0. Outcome linkage for M0-M3 is the north-star
attention/truthfulness hypothesis plus J1 core loop, J2 coordination, J3 owner,
J4 cost, and J5 learning. Journey inclusion is not an experiment result.

## Derived cross-cutting matrix

Derived from local state, multi-provider evidence, migration, privacy and the
[risk register](risks.md). Stable XC IDs identify concerns. "Represented" means
a dedicated story or explicit AC exists, not that it passed or covers every
future engine. Quotes are actual backlog AC excerpts, linked to story headings.
General "applies to every story" principles are not counted as representation.

| ID / concern | Dedicated story or explicit AC | Evidence boundary / proposed gap |
|---|---|---|
| XC-001 Truthful gates and cited evidence (RSK-002/003) | [M0-S9 verify gates v1](../../planning/oss-tooling/backlog.md#m0-s9-verify-gates-v1): "verify gates catches a red pipeline, a missing job, and a vacuous green; each verdict cites its evidence." | Represented in planning, not runnable: GH-178 is CLOSED but `dcc6fc6` adds only artifacts; PM delivery fields remain unset and the handler accepts only `verify change`. Recommend owner/PM route implementation and tracker reconciliation. Full suite-to-job breadth remains M2-S7. |
| XC-002 Durable state and ledger conformance (RSK-003) | [M0-S5 State layer](../../planning/oss-tooling/backlog.md#m0-s5-state-layer): "torn state is detected and reported, never silently read as zeros"; [M0-S10](../../planning/oss-tooling/backlog.md#m0-s10-pm-notes-and-registry-lint-and-phase-transitions): "malformed notes are rejected at write; transitions are idempotent". | Represented and implemented per state/phase specs. Broader state-boundary validation belongs to dedicated M1-S2. Windows ACL evidence remains platform-conditional in state spec. |
| XC-003 Restart safety for external mutations (RSK-004/009) | [M0-S14 closeout v1 with branch cleanup](../../planning/oss-tooling/backlog.md#m0-s14-closeout-v1-with-branch-cleanup): "closeout is idempotent; a re-run after restart converges." | GH-183 has unmerged implementation and review evidence, not an integrated result. Verify interrupted-step replay, artifact verification and unknown-mutation handling against final merged behavior; do not presume a new AC amendment or infer restart safety from a unit-level retry. |
| XC-004 Privacy and credential containment (RSK-006) | [M0-S12](../../planning/oss-tooling/backlog.md#m0-s12-primitive-ports-credential-port-and-embedded-metadata): "a boundary check fails CI on any secret read outside the credential port"; [M0-S15](../../planning/oss-tooling/backlog.md#m0-s15-privacy-and-no-cloud-guards): "a committed file containing a guarded literal fails CI; metadata envelopes are scanned at the emitter." | Implemented: GH-184 `7155074` supplies guard/emitter controls alongside the credential boundary. See feature-privacy-guard.md and committed negative controls; this does not clear unrelated branch doc-membership failures. |
| XC-005 Provider capability honesty and live drift (RSK-004) | [M0-S20 Adapter conformance suite v1](../../planning/oss-tooling/backlog.md#m0-s20-adapter-conformance-suite-v1): "the suite runs green on mocks in CI for every shipped adapter; a scheduled live run records a result artifact; an adapter change that breaks a flow fails CI." | Capability honesty implemented by GH-189: explicit declared-gap skips, coverage gates, production-client mock replay, scheduled read-only artifacts. Live writes/create-teardown are deferred; no configured successful live run established here. GH-183 names candidate write ownership, but remains unmerged. See feature-adapter-conformance.md. |
| XC-006 Provider failure visibility (RSK-002) | [M0-S13 provider v1](../../planning/oss-tooling/backlog.md#m0-s13-provider-v1): "a park reports its cause and expiry; provider outage is announced, not silent." | Represented and merged. Provider spec bounds evidence and distinguishes parks; production spawn integration and live effectiveness are not established by injected tests. |
| XC-007 Bounded and actionable output (RSK-002/009) | [M0-S3 Result contract and error table](../../planning/oss-tooling/backlog.md#m0-s3-result-contract-and-error-table): "a broken command under --json still emits a valid envelope"; [M0-S6 status v1](../../planning/oss-tooling/backlog.md#m0-s6-status-v1): "status on a live repository returns the six sections with evidence-backed states". | Mechanical bounds fulfilled by GH-175: human 24 lines/4096 bytes, machine data 65536 bytes, counts and visible truncation; code and fixture evidence exist. GH-176 adds a bounded tri-state ready-set, not the M2 queue engine. Operator/agent actionability remains unmeasured; recommend a pilot walkthrough follow-up, not an amendment treating GH-175 as pending. |
| XC-008 License sustainability (RSK-007) | [M0-S18 License registry](../../planning/oss-tooling/backlog.md#m0-s18-license-registry-doclegal): "a dependency with an unregistered or denied license fails CI." | Hardening implemented by GH-187 `08a9a5e`: schema v3, mandatory deny families, deny precedence and negative controls. Mechanical enforcement is distinct from owner determination; the registry still describes verdicts as proposed at delivery and confirmed at PR review. |
| XC-009 Owner attention and measurement validity (RSK-001) | [M0-S17](../../planning/oss-tooling/backlog.md#m0-s17-decision-records-and-measurement-baseline): "baseline committed to the local measurement log with each number traced to its source." | GH-186 delivered measurement-baseline.yaml and feature-measurement-baseline.md. Overall PARTIAL: duration/cycle proxies, CI session proxy and curated incident count, not direct owner attention or accepted-delivery denominator. Recommend a separately routed lightweight collection-contract follow-up; no amendment to the closed story is assumed. |
| XC-010 Migration parity and authority transfer (RSK-003) | [M1-S9 Dispatch dual-run pilot](../../planning/oss-tooling/backlog.md#m1-s9-dispatch-dual-run-pilot): "pilot tickets produce dual-run evidence; divergence is reported." | Dispatch represented in M1. M0 two-week/per-engine evidence is a roadmap exit, not a dedicated M0 story AC. Proposed gap: assign a pilot evidence owner and explicit protocol/AC, including exposure, comparison unit, failure treatment and fallback, without silently creating a ticket. |
| XC-011 Documentation integrity after merges (RSK-005) | [M3-S4 Validators and deploy checklist](../../planning/oss-tooling/backlog.md#m3-s4-validators-and-deploy-checklist): "validation errors are classified with codes and fix hints." | Glossary and state-spec frontmatter now parse without duplicate keys; Domain kind appears once. Two identical Empty-but-enforced rows remain in the glossary (lines 54/194). Targeted deduplication and stale-analysis reconciliation still need a route; no global merge-union convention follows. |
| XC-012 Brand neutrality and architecture boundaries (RSK-008) | [M0-S2](../../planning/oss-tooling/backlog.md#m0-s2-branding-seam-and-working-name): "the forbidden-literal test fails CI on a literal outside the allowlist"; [M0-S1](../../planning/oss-tooling/backlog.md#m0-s1-monorepo-scaffold-and-toolchain): "boundaries enforced". | Represented/implemented, but the branch scan reports 18 unregistered-document membership failures across inception/north star and zero literal violations. Route membership at OPEN-Q11; no registry edit authorized here. Unregistered documents are not thereby certified scanned/clean. Parked seams need phase 3 review, not implementation. |
| XC-013 Local completeness (RSK-008) | [M4-S6 Extension hooks](../../planning/oss-tooling/backlog.md#m4-s6-extension-hooks-open-source-side): "local function is complete with no remote service configured". | Explicit release-stage AC. Single-operator local scope is ratified now; an M0 offline/local operating check is a proposed gap if gate 2 requires earlier mechanical coverage. External tracker/model APIs remain expected inputs. |

### Canonical evidence and remaining boundaries

- [Status digest](../../spec/features/feature-status-digest.md) and
  [queue ready](../../spec/features/feature-queue-ready.md) describe delivered
  bounded read-only commands. Fixtures and bounds do not prove caller usability.
- [Adapter conformance](../../spec/features/feature-adapter-conformance.md)
  distinguishes executed reads, declared-gap skips and live-read-only deferrals.
  Scheduled infrastructure alone is not a configured successful live run.
- [Measurement contract](../../spec/features/feature-measurement-baseline.md)
  points to [canonical baseline data](../../planning/oss-tooling/measurement-baseline.yaml).
  Its fixed source commit, sample exclusions and proxy caveats travel with values.
  No direct attention metric or pilot outcome is inferred.
- The [license registry](../../legal/dependency-licenses.yaml) is schema v3;
  [audit](../../../scripts/checks/license-audit.ts), CI binding and committed
  policy/deny/exit tests establish the implemented enforcement surface.
  This corrects phase 0's absent-enforcement claim. Owner determination and
  Proposed TDR-0007 acceptance are not inferred from GH-187 closure.
- GH-204 `c62cdb8` delivered the memory kernel, memory tree and consolidation
  skill. These are later phase 4/5 integration inputs, not completion of this
  run's conventions audit, graduation or framework verification.

## Gate 2 choices and deferred writes

Reconciliation checks on 2026-11-01: glossary and state-spec YAML frontmatter
parse with recursive duplicate-key checks passing. The forbidden-literal scan
still reports 18 unregistered-document membership failures and zero literal
violations. Unregistered docs are not thereby certified as scanned/clean.
The remaining duplicate glossary row and registry membership need bounded
owner-selected correction; broad branch quality gates are not claimed green.

Approve or amend the current-milestone view, role assignments, assumptions and
risks. Decide follow-up routing for the gate implementation/tracker discrepancy,
closeout completion, usability, direct measurement, pilot protocol, residual
documentation defects and optional early local-completeness check. No issue or
canonical AC was created or changed by this draft.
See [OPEN-Q7 onward](../open-questions/phase-2-open-questions.md).

[Tribal graduation](tribal-knowledge-graduation.md) proposes permanent-home
changes for explicit approval. Actual permanent writes are deferred; approving
this review alone does not make them written. Phase 3 requires the human gate.
The later explicit Gate 2 approval permits Phase 3. Substantive questions and
permanent-home writes remain deferred; later phases still require their gates.
