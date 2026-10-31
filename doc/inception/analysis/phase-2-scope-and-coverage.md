---
id: TOOLING-INCEPTION-PHASE-2-SCOPE
status: Draft
created: 2026-10-31
last_updated: 2026-10-31
owners: [bootstrapper]
area: engineering
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Derived M0 remainder scope, reconciled delivery snapshot, milestone validation, and explicit cross-cutting coverage gaps."
---

# Phase 2: scope and coverage

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

Snapshot: local HEAD `5bc121e`, including phase 1 `cc4bdd1` and integrated
GH-177 `8f6023a` / GH-182 `9a70aaf`. Initial worktree was clean. Read-only GitHub
queries on 2026-10-31 confirm PR201 and PR202 merged and PR203 open. The
phase 0 repo analysis and north-star in-flight list predate those merges.

## Reconciled M0 delivery state

There are **11/20 implementation stories merged**, but the live issue query
returns **10/20 CLOSED**, not 11/20: GH-177 remains OPEN despite merged PR201.
Treat this as closeout/tracker reconciliation, not a reason to relabel delivered
code as pending or to claim the issue closed. No tracker state was changed.

| State at review | Stories / evidence |
|---|---|
| Nine earlier closed stories | S1 GH-170, S2 GH-171, S3 GH-172, S4 GH-173, S5 GH-174, S10 GH-179, S12 GH-181, S16 GH-185, S19 GH-188 |
| Newly merged | S8 GH-177, PR201 (issue still OPEN); S13 GH-182, PR202 (issue CLOSED) |
| In flight, not delivered | S15 GH-184, PR203 OPEN |
| Eight other pending stories | S6 GH-175, S7 GH-176, S9 GH-178, S11 GH-180, S14 GH-183, S17 GH-186, S18 GH-187, S20 GH-189; all issues OPEN |

Thus nine implementation stories remain: GH-184 plus eight pending. Issue closure,
merged code, decision acceptance, and observed milestone outcomes are separate
states. Neither 11 merged stories nor passing fixtures proves M0 exit.

## Current Milestone scope and dependencies

In: finish the existing M0 stories, prioritizing the remaining protected relief
path (status with tracker, verify gates, closeout, validation with verify change),
and establish the decision/baseline and pilot evidence required for M0 exit.
Queue-ready is read-only; db admin, privacy, licensing, and conformance remain
named M0 stories. Existing foundation work is reused.

Strict pending edges from the backlog: GH-176 depends on GH-175. GH-175's state
and seed dependencies are merged; GH-178's verify and seed dependencies are
merged; GH-183 and GH-189 depend on merged seeds. The latter is a declared
dependency fact, not proof that the seeds implement needed write operations.
GH-180, GH-184, GH-186, and GH-187 have no currently open declared prerequisite.
The ranking protects relief first; it is not permission to ignore milestone
gates or missing capabilities.

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
| M0, current | Protected engines beside shell; "zero false-success incidents on pilot paths over two weeks"; repo adopts scaffold. Owner attention improvement is the north-star hypothesis, not yet quantified. | Remaining M0 stories; GH-186 decisions/baseline; independent pilot evidence | Runner records per-engine comparisons, exposure and divergence against actual artifacts; Owner reviews attention and quality. Exit only on evidence, otherwise remediate. XC-009/010 propose missing measurement/protocol AC. |
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
| XC-001 Truthful gates and cited evidence (RSK-002/003) | [M0-S9 verify gates v1](../../planning/oss-tooling/backlog.md#m0-s9-verify-gates-v1): "verify gates catches a red pipeline, a missing job, and a vacuous green; each verdict cites its evidence." | Represented, GH-178 pending. Ledger-only GH-177 does not satisfy this. Full suite-to-job breadth is explicitly M2-S7. |
| XC-002 Durable state and ledger conformance (RSK-003) | [M0-S5 State layer](../../planning/oss-tooling/backlog.md#m0-s5-state-layer): "torn state is detected and reported, never silently read as zeros"; [M0-S10](../../planning/oss-tooling/backlog.md#m0-s10-pm-notes-and-registry-lint-and-phase-transitions): "malformed notes are rejected at write; transitions are idempotent". | Represented and implemented per state/phase specs. Broader state-boundary validation belongs to dedicated M1-S2. Windows ACL evidence remains platform-conditional in state spec. |
| XC-003 Restart safety for external mutations (RSK-004/009) | [M0-S14 closeout v1 with branch cleanup](../../planning/oss-tooling/backlog.md#m0-s14-closeout-v1-with-branch-cleanup): "closeout is idempotent; a re-run after restart converges." | Represented, GH-183 pending. Proposed refinement: interrupted-step replay with artifact verification and unknown-mutation handling; not implied by a unit-level retry alone. |
| XC-004 Privacy and credential containment (RSK-006) | [M0-S12](../../planning/oss-tooling/backlog.md#m0-s12-primitive-ports-credential-port-and-embedded-metadata): "a boundary check fails CI on any secret read outside the credential port"; [M0-S15](../../planning/oss-tooling/backlog.md#m0-s15-privacy-and-no-cloud-guards): "a committed file containing a guarded literal fails CI; metadata envelopes are scanned at the emitter." | Credential boundary represented/implemented. GH-184 guard/emitter completion remains open; no delivery claim from an open PR. |
| XC-005 Provider capability honesty and live drift (RSK-004) | [M0-S20 Adapter conformance suite v1](../../planning/oss-tooling/backlog.md#m0-s20-adapter-conformance-suite-v1): "the suite runs green on mocks in CI for every shipped adapter; a scheduled live run records a result artifact; an adapter change that breaks a flow fails CI." | Represented, GH-189 pending. Seeds only read and have synthetic fixtures. Proposed gap: name owner and implementation story for closeout writes, and capability-aware flow expectations rather than assume a full lifecycle works on every seed. |
| XC-006 Provider failure visibility (RSK-002) | [M0-S13 provider v1](../../planning/oss-tooling/backlog.md#m0-s13-provider-v1): "a park reports its cause and expiry; provider outage is announced, not silent." | Represented and merged. Provider spec bounds evidence and distinguishes parks; production spawn integration and live effectiveness are not established by injected tests. |
| XC-007 Bounded and actionable output (RSK-002/009) | [M0-S3 Result contract and error table](../../planning/oss-tooling/backlog.md#m0-s3-result-contract-and-error-table): "a broken command under --json still emits a valid envelope"; [M0-S6 status v1](../../planning/oss-tooling/backlog.md#m0-s6-status-v1): "status on a live repository returns the six sections with evidence-backed states". | Partial: envelope validity and six sections have AC; no explicit status size budget/truncation or caller-actionability AC. Proposed gap at GH-175: deterministic budget, visible omissions and evidence-preserving fallback, with operator/agent review. |
| XC-008 License sustainability (RSK-007) | [M0-S18 License registry](../../planning/oss-tooling/backlog.md#m0-s18-license-registry-doclegal): "a dependency with an unregistered or denied license fails CI." | Represented; existing enforcement verified below. GH-187 reconciles policy and evidence rather than presuming no gate. |
| XC-009 Owner attention and measurement validity (RSK-001) | [M0-S17](../../planning/oss-tooling/backlog.md#m0-s17-decision-records-and-measurement-baseline): "baseline committed to the local measurement log with each number traced to its source." | Partial: the tasks name ceremony share, cycle time, CI failure rate and false-signal incidents. Direct owner-attention measurement and accepted-delivery denominator lack explicit AC. Proposed gap: Owner/PM agree collection, missing-data policy, sample window, quality/rework guardrails and source tracing at GH-186; later automation at M2-S6 only if approved. |
| XC-010 Migration parity and authority transfer (RSK-003) | [M1-S9 Dispatch dual-run pilot](../../planning/oss-tooling/backlog.md#m1-s9-dispatch-dual-run-pilot): "pilot tickets produce dual-run evidence; divergence is reported." | Dispatch represented in M1. M0 two-week/per-engine evidence is a roadmap exit, not a dedicated M0 story AC. Proposed gap: assign a pilot evidence owner and explicit protocol/AC, including exposure, comparison unit, failure treatment and fallback, without silently creating a ticket. |
| XC-011 Documentation integrity after merges (RSK-005) | [M3-S4 Validators and deploy checklist](../../planning/oss-tooling/backlog.md#m3-s4-validators-and-deploy-checklist): "validation errors are classified with codes and fix hints." | Future dedicated validator, not explicit M0 duplicate-key or semantic-union coverage. Current glossary and state spec contain duplicate metadata keys; glossary also has conflicting duplicate term rows. Proposed targeted repair and strict parse/combined-content check, with owner-approved routing. |
| XC-012 Brand neutrality and architecture boundaries (RSK-008) | [M0-S2](../../planning/oss-tooling/backlog.md#m0-s2-branding-seam-and-working-name): "the forbidden-literal test fails CI on a literal outside the allowlist"; [M0-S1](../../planning/oss-tooling/backlog.md#m0-s1-monorepo-scaffold-and-toolchain): "boundaries enforced". | Represented/implemented, but this branch's literal gate currently fails on unregistered inception docs, including all six new drafts and earlier phases. Route registry membership at OPEN-Q11; no registry edit authorized here. Parked seams need phase 3 review, not implementation. |
| XC-013 Local completeness (RSK-008) | [M4-S6 Extension hooks](../../planning/oss-tooling/backlog.md#m4-s6-extension-hooks-open-source-side): "local function is complete with no remote service configured". | Explicit release-stage AC. Single-operator local scope is ratified now; an M0 offline/local operating check is a proposed gap if gate 2 requires earlier mechanical coverage. External tracker/model APIs remain expected inputs. |

### GH-187: checked rather than inferred

The [registry](../../legal/dependency-licenses.yaml) is schema v2 with
`approved` verdict fields and an allow list. Its comment still describes owner
determination as proposed at delivery and confirmed at PR review; this review
has not verified that approval trail. The
[audit](../../../scripts/checks/license-audit.ts) checks registered dependency
uses and the locked runtime closure, approved verdicts, and all SPDX branches
against the allow list. [CI](../../../.github/workflows/ci.yml) already runs it
in `ts-license-audit`. Local audit passes and
[license tests](../../../tests/checks/license-audit.test.ts) pass (13 tests).

This corrects phase 0's unsupported claim that CI enforcement remains absent.
GH-187 is still OPEN; review its remaining policy/deny-case coverage and owner
determination against the existing implementation. No new legal determination
or issue completion is asserted here.

## Gate 2 choices and deferred writes

Draft checks: strict frontmatter parsing, 60 local links/anchors, assumption
enums, punctuation/private-path checks and whitespace checks pass. Strict
parsing of the existing glossary reports indentation and duplicate-key errors;
the state spec reports duplicate keys. The forbidden-literal check fails with
18 unregistered-document membership findings, including the six new drafts
and earlier inception/north-star files; it does not report a forbidden-token
match in these drafts. This is a gate follow-up, not a passed quality check.

Approve or amend the current-milestone view, role assignments, assumptions and
risks. Decide routing for XC-005/007/009/010/011/013 proposals and the GH-177
tracker discrepancy. No issue or AC was created or changed by this draft.
See [OPEN-Q7 onward](../open-questions/phase-2-open-questions.md).

[Tribal graduation](tribal-knowledge-graduation.md) proposes permanent-home
changes for explicit approval. Actual permanent writes are deferred; approving
this review alone does not make them written. Phase 3 requires the human gate.
