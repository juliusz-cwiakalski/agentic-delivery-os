---
id: SPEC-TOOLING-NONFUNCTIONAL
status: Proposed
created: 2026-11-01
last_updated: 2026-11-06
owners: [engineering]
ados_distribution: internal
links:
  related_changes: [GH-200, GH-222, GH-221, GH-227, GH-228, GH-229, GH-224, GH-231, GH-225, GH-251]
summary: "Cross-cutting index of implemented tooling quality contracts and separately proposed validation targets."
---

# Non-functional requirements: local delivery tooling

## Authority and evidence boundary

This Phase 3 collection indexes current feature contracts and exposes gaps for human
decision. Its Proposed status does not demote existing implemented contracts or
promote new targets to accepted policy. Numerical budgets remain canonical in the
linked feature specs and contract constants; this index does not override them.
An inconsistency requires reconciliation at the owning feature, not a silent choice.

Scope is single-operator local tooling and delivered CLI/core/adapter/MCP surfaces.
Full MCP/host parity, shared state, dispatch takeover, and release readiness are not
established here. Missing documentation profile means engineering-repo behavior.
Phase 2 approval carries OPEN-Q7 through OPEN-Q11 forward. Existing Proposed ADRs
and TDRs remain unaccepted until their human decision is recorded.

Status `existing` means an implemented contract with identified source/test evidence;
it does not mean its tests were rerun here. All runtime results are `not-reverified`
in this docs-only collection. `proposed` rows require a human decision and a scoped
validation procedure. `gap` identifies evidence or capability still missing.
Owners below are proposed accountable roles, not new assignments or tracker edits.

OPEN-Q20 reconciliation baseline: integrated `main-tools` `5330809`, including
closeout PR #215 and verify-gates recovery PR #217. Shared `createRuntime` is
declaration-only; CLI has no `bin`; the MCP package serves three read-only tools
over local stdio; the typed OpenCode entry remains a placeholder.

## Existing contract index

### NFR-TOOL-001: Truthful evidence and failure semantics

- Quality attribute: reliability and diagnosability. Applies: result envelopes,
  status, brief, queue-ready, verify-change, provider reads, the watchdog probes, the
  owner-gate board, the doctor pre-flight diagnostic, the merge transaction, and the
  verify-deploy verdict.
- Requirement/status: existing. Missing, failed, or unavailable evidence must not
  become a clear/ready/zero claim. Command success is not delivery success.
- Evidence/test: [result](features/feature-result-contract.md),
  [status](features/feature-status-digest.md), [brief](features/feature-brief.md),
  [ready-set](features/feature-queue-ready.md),
  [verify](features/feature-verify-change-and-exit-taxonomy.md),
  [owner-gate SLA](features/feature-owner-gate-sla.md),
  [doctor](features/feature-doctor.md),
  [merge and verify deploy](features/feature-merge-verify-deploy.md),
  [watchdog](features/feature-watchdog-lane-contracts.md);
  `packages/core/src/domain/ci-result.ts`, `tests/behaviour/status-negative-controls.test.ts`,
  `tests/behaviour/queue-ready-negative-controls.test.ts`,
  `tests/behaviour/watchdog-liveness.test.ts`.
- Limits: CI observes one checkout-head page, not every required PR-head job;
  `merge-ready` is an approval-based close class, not merge authorization.
  Change-ledger verification is separate from the `verify gates` battery:
  [battery contract](features/feature-verify-gates.md) observes CI, push parity,
  squash surface, the owner gate, and lifecycle. The owner gate checks the work
  item's hand-back and human-input-needed labels; no gate asserts completion.
  The merge transaction accepts only a fresh recorded verification plus its
  bounded probe; `verify deploy` accepts only trace evidence, so a created-but-
  never-run pipeline and a status without a trace are `unknown`, never green.
  Unknown evidence is not green. The watchdog liveness probe classifies absent
  signal sources as `watchdog.signals-absent` and emits no guessed verdict. The
  doctor diagnostic applies the same rule per check: a failed or unattempted read
  is never `ok` (it is `unreachable`, or `fail` where the condition catalog
  declares an observed defect), and every non-ok verdict carries a bounded detail
  and a fix hint.
- Owner/trigger: reviewer with PM; every new evidence consumer (RSK-002/003, XC-001).

### NFR-TOOL-002: Stable machine output and bounded read digests

- Quality attribute: interoperability and resource boundedness. Applies: CLI
  envelope, status, brief, queue-ready, board, verify gates, merge, verify deploy,
  and doctor renderers. Status: existing.
- Requirement: one valid `CommandResult` under `--json`, exactly one of data/error,
  classified containment, deterministic ordering, and visible truncation.
- Canonical budgets: [status](features/feature-status-digest.md#evidence-counts-truncation-and-bounds)
  caps human output at 24 lines/4096 bytes and serialized data at 65536 bytes;
  [queue-ready](features/feature-queue-ready.md#reasons-bounds-and-truncation) caps
  human output at 16 lines/4096 UTF-8 bytes and serialized data at 65536 UTF-8 bytes;
  [board](features/feature-owner-gate-sla.md#ranking-bounds-and-truncation) caps
  rendered gates at 8, human output at 24 lines/4096 UTF-8 bytes, and serialized
  data at 65536 UTF-8 bytes; [doctor](features/feature-doctor.md#bounds-and-read-limits)
  caps human output at 24 lines/4096 bytes and serialized data at 65536 bytes, with
  200-character detail and hint caps and one bounded page per wiring read. The
  [merge transaction](features/feature-merge-verify-deploy.md#invariants) caps the
  human summary at 24 lines/4096 bytes and machine data at 65536 bytes, and
  `verify deploy` uses the same caps with 50-step/50-artifact evidence lists and
  explicit `+N` marks. These are data caps, not a universal total-envelope cap.
  Brief reuses the status human and machine caps by reference and declares no
  parallel numeric bound.
- Queue-ready accepts 1..8 candidates of at most 64 canonical characters; its
  per-field caps and renderer-only reverse-rank drops remain feature-specific.
- Evidence/test: `packages/core/src/contracts/status.ts`,
  `queue-ready.ts`, `brief.ts`, `owner-gate-sla.ts`, `doctor.ts`, `merge.ts`,
  `verify-deploy.ts`; `tests/behaviour/status-output.test.ts`,
  `queue-ready-output.test.ts`, `brief-output.test.ts`, `board-output.test.ts`,
  `doctor-output.test.ts`, `merge-bounds.test.ts`, `verify-deploy-bounds.test.ts`,
  golden suites.
- Owner/trigger: engineering/reviewer; payload or renderer changes (XC-007).

### NFR-TOOL-003: Scoped performance and read cost

- Quality attribute: performance efficiency. Applies: status/queue-ready pure
  policy, the owner-gate board, the doctor diagnostic, provider evaluation, privacy
  scan/policy, session administration.
- Requirement/status: existing feature budgets only; no universal latency SLO.
  Reference-environment results are not promises for every platform or network.

| Canonical feature | Budget index and caveat | Evidence/test |
|---|---|---|
| [Status](features/feature-status-digest.md#non-functional-requirements) | Pure cap-sized aggregation within 50 ms; at most three network reads, one logical park fold, one config resolve; no retry/pagination loop. | `tests/behaviour/status-performance.test.ts` asserts median of five pure samples and request counts. |
| [Brief](features/feature-brief.md#non-functional-requirements) | Pure cap-sized projection within 50 ms; the same three outbound reads, park fold, and config resolve as one status invocation; no brief-specific read. | `tests/behaviour/brief-performance.test.ts` samples projection latency and injected read counts. |
| [Queue-ready](features/feature-queue-ready.md#non-functional-requirements) | Pure evaluation/ranking/rendering contract within 50 ms; same three outbound reads, one park fold/config/local-context read. | `tests/behaviour/queue-ready-performance.test.ts` samples evaluator latency and injected read counts; independent renderer timing not established here. |
| [Board](features/feature-owner-gate-sla.md#non-functional-requirements) | Pure evaluation/ranking/rendering within 50 ms; one bounded tracker read, at most one decision-history read, and one fence plus one append per newly defaulted gate. | `tests/behaviour/board-performance.test.ts`, `board-read-cost.test.ts`. |
| [Doctor](features/feature-doctor.md#non-functional-requirements) | Pure cap-sized aggregation within 50 ms; at most two single-page network reads (tracker and CI), one configuration resolve, one shared verified ledger read; no pagination, retry, or write. | `tests/behaviour/doctor-performance.test.ts` samples the median of 21 runs after warm-ups; `doctor-network-posture.test.ts` pins the read budget and shared-source read-once posture. |
| [Merge and verify deploy](features/feature-merge-verify-deploy.md#invariants) | Pure freshness, waiver, and deploy-verdict evaluation; `merge` performs one verification read, one work-item read, one check-run page, one request-detail read, and only the declared git mutations; `verify deploy` performs one bounded trace read; the freshness bound defaults to 1800 s with at-bound stale. | `tests/behaviour/merge-probe.test.ts`, `merge-determinism.test.ts`, `verify-deploy-read-budget.test.ts`, `merge-bounds.test.ts`, `verify-deploy-bounds.test.ts`. |
| [Provider](features/feature-provider-engine.md#non-functional-requirements) | Pure evaluation of 100 entries within 50 ms, excluding transport; configurable quota timeout defaults to 15000 ms, sleep cap to 24 completed sleeps. | Provider behavior and evidence-bounds suites; these are not end-to-end command deadlines. |
| [Privacy](features/feature-privacy-guard.md#non-functional-requirements) | Scan within 60 s for up to 50 MiB on CI reference runner; emitter within 10 ms per 2048-byte envelope; at most 32 hashed lengths. | `tests/checks/privacy-performance.test.ts`; production empty classes limit what a clean scan demonstrates. |
| [Commit](features/feature-commit-primitive.md#non-functional-requirements) | Dry-run p95 under 2 s and template-fallback p95 under 5 s; one constrained model call per attempt; a model-transport commit is bounded by the provider call. | `tests/behaviour/commit-performance.test.ts` samples the dry-run and template paths; the model-transport bound is not a CI deadline. |
| [Session admin](features/feature-session-database-admin.md#non-functional-requirements) | Reference size/list/selection/recheck/live-check/500-candidate apply: at most 30 s/10 s/30 s/250 ms each/10 s/180 s total. | Fake-I/O suites and separately recorded non-CI reference smoke; no host performance rerun here. |

- Session constants separately bound a query/delete to 30000 ms and checkpoint to
  120000 ms. Per-operation timeouts do not establish a complete batch deadline.
- Owner/trigger: engineering with runner; performance-sensitive changes or runtime
  upgrades require named workload and platform evidence (RSK-008/009, XC-007).

### NFR-TOOL-004: Durable local state and fenced writes

- Quality attribute: integrity and recoverability. Applies: ledger, derived indexes,
  phase transitions, provider park persistence, and the merge-domain records
  (gate verification, waiver, transaction). Requirement/status: existing.
- [State](features/feature-state-layer.md) requires verified ledger truth, explicit
  verified-empty evidence, key-set assertions, torn and unknown classification,
  reusable artifact-boundary validation, fenced writes, explicit stale-lock recovery,
  and atomic derived-document replacement. The three merge-domain record kinds are
  additive within `delivery.state.v1`, and an append failure never leaves a
  consumable half-verification.
- Read/index strategy does not change truth; only the two explicit terminal-tail
  operations remove ledger bytes, and guided salvage quarantines the removed bytes
  instead of discarding them. Mid-stream corruption is not silently repaired, and
  reads never mutate bytes.
- Storage exhaustion is fail-closed: an append, derived-document replace, or salvage
  write that cannot complete fails `state.storage.exhausted` with the ledger at its
  last valid frame and no partial frame or partial document observable.
- POSIX modes are directory 0700/files 0600, including the quarantine directory and
  its artifacts; Windows requires current-user-only ACLs. Linux CI cannot establish
  the Windows branch. Only local level is implemented.
- Evidence/test: `packages/core/src/state/ledger.ts`, `driver/runtime-edge.ts`;
  `tests/behaviour/state-torn.test.ts`, `state-unknown.test.ts`, `state-salvage.test.ts`,
  `state-salvage-invariants.test.ts`, `state-storage-exhausted.test.ts`,
  `state-index-post-salvage.test.ts`, `state-artifact-boundary.test.ts`,
  `state-fence.test.ts`, `state-atomic-replace.test.ts`, `state-permissions.test.ts`.
- Owner/trigger: engineering/runner; storage format, driver, platform, or writer changes
  (RSK-003, XC-002). Forever retention has no compaction or global growth budget.

### NFR-TOOL-005: Credentials, redaction, and bounded input

- Quality attribute: security/confidentiality. Applies: config acquisition, credential
  port, CLI serialization, provider HTTP. Requirement/status: existing scoped controls.
- [Config](features/feature-config-layer.md) rejects non-environment catalog secrets,
  disallowed machine-path sources, unknown keys, interpolation, and poisoned skipped
  sources. CI disables workstation layers unless explicitly enabled.
- [Result](features/feature-result-contract.md) redacts edge-registered non-empty
  secret values through `packages/cli/src/output/serialize.ts`; unregistered or
  transformed secret material is not a general detection guarantee.
- Evidence/test: config restrictions/parser suites, result goldens, credential and
  `tests/checks/secret-read-boundary.test.ts` negative controls;
  `tests/behaviour/config-parser.test.ts` and
  `tests/behaviour/pm-notes-source-limits.test.ts` pin the source-size boundary.
- Bounded input: the YAML parser limits nodes/depth/aliases to 2048/64/100 and
  enforces its 1048576-byte source limit as true UTF-8 byte length at the YAML
  check site and both pm-notes parser check sites, fail-closed and with the
  existing error identities. Boundary tests pin exactly-at-limit, one byte over,
  one byte under, code-unit-at-limit-but-bytes-over, and all-ASCII content at all
  three sites (3 sites × 5 fixture classes). This is a bounded-input control
  proven by tests, not a security certification.
- Owner/trigger: engineering/security reviewer; parser, credential, transport, or
  output changes (RSK-006, XC-004). No blanket security certification is implied.

### NFR-TOOL-006: Public-safe content and metadata privacy

- Quality attribute: privacy. Applies: working-tree text and embedded metadata.
  Requirement/status: existing guard mechanics, limited configured coverage.
- [Privacy guard](features/feature-privacy-guard.md) scans tracked plus untracked,
  non-ignored text; reports identifiers, never matched content; requires a fail-closed
  policy over exact compact metadata JSON before carrier construction.
- Evidence/test: `scripts/checks/privacy-literals.registry.json`,
  `tests/checks/privacy-registry.test.ts`, `privacy-scope.test.ts`,
  `tests/behaviour/envelope-content-policy.test.ts` and type/structure controls.
- Both production hashed classes are empty with reasons. Synthetic activation
  proves mechanism, not detection of unregistered private terms. Generic heuristics
  miss novel shapes; history, encoded/archive content and binary deep inspection
  are excluded. Human comment text is outside emitter policy input.
- Metadata codec policy is distinct from CLI result-value redaction. Known branding
  membership remediation is tracked in the readiness report; neither guard substitutes for the other.
- Owner/trigger: owner/reviewer; public artifact, schema, or registry changes
  (RSK-006, XC-004/012). Digest population and residual acceptance stay owner decisions.

### NFR-TOOL-007: Honest capabilities and conformance

- Quality attribute: compatibility and testability. Applies: GitHub/GitLab/Jira seeds
  and adapter conformance. Requirement/status: existing reads, supported writes and explicit gaps.
- [Seeds](features/feature-provider-client-seeds.md) expose normalized views and
  credential-port-only authorization. [Closeout](features/feature-closeout.md)
  implements supported GitHub/Jira label/assignee and completion operations plus
  GitHub thread resolution. GitLab write gaps and no work-item read remain explicit.
- [Conformance](features/feature-adapter-conformance.md) gates structural/runtime
  coverage, exact-URL mock replay, explicit skips, and bounded artifacts (262144
  bytes). Mock conformance executes supported production writes; at least one
  executing step per adapter is not all-flow or live write coverage.
- Evidence/test: `tests/conformance/mock-conformance.test.ts`,
  `broken-adapter-control.test.ts`, `tests/structure/conformance-coverage.test.ts`.
- Live v1 is GET-only, zero mutations/created artifacts, and scheduled evidence,
  not a merge gate. Not-configured exit zero is not a successful configured run.
- Owner/trigger: adapter engineering/reviewer; capability or provider-shape change
  (RSK-004, XC-005). No live write parity or successful live run is inferred.

### NFR-TOOL-008: Mutation safety and restart boundaries

- Quality attribute: safety and recoverability. Applies: provider state, session
  admin, integrated closeout, and watchdog restoration; live convergence remains unverified (RSK-004/009, XC-003).
- Existing requirement: unchanged provider park generations append no duplicates;
  parks expire at read time. Provider selection neither spawns nor selects models,
  and production factory composition is not established by injected tests.
- [Session admin](features/feature-session-database-admin.md) defaults to dry-run;
  apply uses cold/non-live/leaf selection, immediate rechecks, official deletes,
  partial-failure accounting, and one live-gated checkpoint without host restart.
- Bounds: list at most 100, prune at most 500; human 40 lines/8192 bytes, data
  524288 bytes. Liveness is activity within 15 minutes, not a PID/lock guarantee.
- Evidence/test: provider parks tests; `tests/behaviour/session-admin-prune.test.ts`,
  `session-admin-reboot.test.ts`, `session-admin-privacy.test.ts`.
- Closeout is a seven-step transaction, plan by default, `--apply` for mutation.
  Command-specific production composition bridges raw clients, real git and state.
  Verified `closeout.operation` history uses deterministic identities, fenced
  appends, first-terminal reuse and failed-outcome retry; classified state/provider/
  safety failures preserve consequences. The git seam rechecks protected refs,
  merged head, checkout and foreign worktrees. This is a real replay substrate,
  not a separate write-ahead-intent protocol or live crash experiment.
  Evidence: `packages/core/src/state/closeout.ts`, `domain/closeout.ts`,
  `packages/cli/src/edge.ts`, `tests/behaviour/closeout-integration.test.ts`;
  real-local git/store with mocked providers inspected, not rerun.
- Watchdog teardown preserves a stranded commit under the attributed
  `watchdog-preserved/<lane>` ref, restores the declared base, removes only
  untracked lane-workspace residue, preserves unattributable content, and reports
  `.ai/memory` publications as `committed` or `preserved` without staging,
  committing, reverting, cleaning, or deleting them. Every action carries
  non-empty evidence, and unevaluable facts fail closed.
  Evidence: `packages/core/src/domain/watchdog.ts`,
  `packages/adapters/src/git/watchdog.ts`,
  `tests/behaviour/watchdog-teardown.test.ts`, `watchdog-memory.test.ts`;
  real temporary repositories with a live-workspace fixture guard.
- Owner/trigger: engineering/reviewer; each mutation/replay change. Unit idempotence
  does not prove multi-step external restart convergence or an owner privacy sign-off.

## Proposed cross-cutting targets requiring human decision

These rows are desired validation contracts, not implemented universal requirements.
Each needs an approved scope and evidence plan before it can gate delivery.

| Stable ID / quality attribute | Proposed requirement and applicable surfaces | Status / evidence gap | Proposed owner, validation proposal and trigger | Phase 2 links |
|---|---|---|---|---|
| NFR-TOOL-009 / recoverability | External multi-step mutations converge after interruption; unknown consequence requires artifact inspection before retry. Applies: integrated closeout. | proposed additional validation; persistent replay and mocked restart/local integration exist, not live-write convergence. | Engineering/reviewer; interrupt before/after every external step, replay against capability-aware sandbox, compare actual artifacts; before closeout acceptance. | RSK-004/009, XC-003/005 |
| NFR-TOOL-010 / usability and accessibility | Human and agent callers identify uncertainty, truncation, and next action without hidden assumptions. Applies: CLI digests/errors. | proposed; no observed caller study or accessibility baseline. | Owner/reviewer; bounded plain-text/assistive-terminal and agent walkthrough including unknown, park, partial failure and long Unicode data; agree criteria before pilot. | RSK-002, XC-007 |
| NFR-TOOL-011 / local operability | Local functions remain complete without a hosted service; configured tracker/model networking remains explicit. Applies: installation and local commands. | proposed M0 validation; release-stage local-completeness AC exists, early evidence missing. | Engineering/owner; classify local-only versus API-dependent commands, run local subset with remote-service integration absent and network denied, verify explicit unavailable states; milestone/release review. | RSK-008, XC-013 |
| NFR-TOOL-012 / outcome validity | Measure direct owner attention per accepted delivery with quality, exposure, fallback and maintenance context. Applies: pilot/measurement artifacts. | proposed; current baseline is PARTIAL proxy evidence. | Owner/PM; approve lightweight collection/denominator protocol, exclusions and equal-definition comparisons, then collect independent pilot artifacts; before outcome claims. | RSK-001/003/008, XC-009/010 |
| NFR-TOOL-013 / maintainability and compliance | Every claimed quality guarantee names scope, negative evidence, platform and ratification status. Applies: integrated docs, dependencies and release evidence. | proposed cross-cutting evidence rule; checks exist but full claim coverage is a gap. | Reviewer/owner; trace claims to feature tests, review license determination separately from mechanical audit, route document-membership and stale-text repairs; integration and Phase 6. | RSK-005/007, XC-008/011/012 |

New validation assumptions are explicit rather than silently accepted:

| ID | Assumption | risk_type | validation_status | Proposed validation |
|---|---|---|---|---|
| NFR-ASM-01 | A bounded interrupted-step matrix predicts useful restart behavior for the first external mutation flow. | feasibility | unvalidated | NFR-TOOL-009 sandbox replay plus artifact inspection; owner accepts remaining coverage limits. |
| NFR-ASM-02 | A small attention log improves decisions without consuming the expected relief. | viability | unvalidated | NFR-TOOL-012 pilot records collection effort and missing samples alongside attention outcomes. |

No universal uptime, throughput, retention, accessibility-conformance, or recovery-time
threshold is invented. Candidate OPEN-Q12+ decisions include parser limit units,
performance/platform reference evidence, terminal accessibility criteria, restart
matrix ownership, and an early local-operability check. Deferred Phase 2 routes remain
open. See the [FSE audit](../inception/analysis/fse-audit.md) for environment findings;
docs-only review does not establish product test results or branch-wide green CI.
