---
change:
  ref: GH-239
  type: feat
  status: Proposed
  slug: dispatch-engine
  title: "M1-S9: Dispatch engine: dual-run evidence and per-repo handover"
  owners: [engineering]
  service: delivery-os dispatch engine
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: high
  dependencies:
    internal: [result contract and exit taxonomy, harness adapters, scheduling engine, resident daemon, state layer, session lifecycle economics, verify change, CLI composition and help, blockers channel, configuration layer]
    external: [opencode CLI, Claude Code CLI, VCS remote and tracker read APIs, CI read APIs, git]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the typed per-ticket dispatch loop beside the bash stack — spawn, watch, classify, summarize — with durable dual-run evidence, an evidence-based per-repository handover/reversal mechanism, and a bash fallback that keeps working, so the engine can become authoritative repository by repository only when truth, class coverage, exposure, and corroboration all agree.

## 1. SUMMARY

Deliver the `dispatch` command family for M1: a one-shot per-ticket execution path that resolves a harness, claims the queue lease, spawns or resumes the lifecycle session through the delivered harness session port, watches it with progress-based liveness, classifies the outcome through the shared classifier into the closed TDR-0005 vocabulary, and emits the bash-continuity summary plus the machine envelope. Each dispatch appends a durable evidence record carrying the engine result, the independently derived comparison token, divergence state, false-success classification, and corroboration references.

The change also delivers `dispatch dual-run summary`, `dispatch dual-run resolve`, and `dispatch handover` with an evidence gate: a repository may flip to engine-authoritative only when zero false-success incidents and zero unresolved divergences hold, every TDR-0005 class has been exercised on real tickets, the exposure floor is met, and success claims are corroborated by completed pm-notes phases, tracker state, and CI on the pushed head. The flip is per repository, recorded, reversible, and readable by the four bash entry points without invoking the typed CLI, so the bash stack remains runnable fallback before and after handover. The change fills the delivered daemon lane-executor seam and registers dispatch in the prompt-required CLI surface, retiring the tests that asserted its absence.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The M1 dependency set is delivered on the integration branch: read-only `verify change` with the ledger outcome vocabulary (`finished`, `partial`, `failed`, `state-unverified`), the harness session port with opencode and Claude Code adapters and one shared classifier, the scheduling engine with repo-exclusive leases, queue planning, parks, and one-shot state-only mutation, the resident daemon with lane records, reconciliation, restart budgets, and one-shot degradation, and the state layer with append/read/fence and derived-document patterns.
- The resident daemon's lane-executor seam exists but its prompt/environment planner is unowned: without a planner and an execution-environment descriptor the lane executor reports unavailable and the daemon runs supervise-only. One-shot queue operations already work daemon-down, and every daemon interaction has a state-only fallback.
- The bash delivery stack remains authoritative: `deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, and `ceo-loop.sh` drive deliveries, with the stable summary keys `result=`, `pr_url=`, `exit_code=`, `last_message=` (and an additive bash-internal `closeout_unverified=` key between the last two).
- No `dispatch` command exists. The CLI entrypoint explicitly states that dispatch is not registered or claimed, the prompt-required composition omits it, and three delivered assertions enforce its absence: the entrypoint-composition test, the pilot-isolation conformance test, and the harness-review-deferrals test that also asserts no dispatch spawn-failure row exists. The harness review deferral F-9 (host-runner semantics) is re-deferred to M1-S9 because dispatch is named as its first production consumer.
- The delivery-result vocabulary is closed at eleven tokens with a total taxonomy (projection class and derivation class per token; TDR-0005), and the dispatch-session projection is ratified as a six-row outcome-to-token mapping with two binding consumer rules: `outcome` must be read beside any `partial`, and harness-path `noop-lane-permission` means spawn-refused (TDR-0010). `state-unverified` deliberately projects to exit 2 where bash exits 1; token-level parity is the dual-run comparison unit.
- The handover gate is planning truth only. The canonical backlog defines `clean` as a four-condition evidence bar: zero false-success incidents and zero unresolved divergences on pilot paths; every TDR-0005 class exercised on real tickets; at least 20 dispatches or at least 7 consecutive days, whichever comes first, with that either/or binding only the floor; and corroboration from completed pm-notes phases, tracker state, and CI on the pushed head. The GH-239 ticket body still quotes the superseded rolling two-week window; the command reference page and two seeded scenarios still carry the same stale phrasing.
- No durable dispatch evidence exists: no per-dispatch records, no divergence records, no per-repository authority record, and no derived authority view a bash script could read without the typed CLI. Existing dispatch error rows are limited to `dispatch.restart-budget-exceeded` and `dispatch.resume-uneconomical`; `dispatch.session.spawn-failed` and `dispatch.state-unverified` are not declared.

### 2.2 Pain Points / Gaps

- The per-ticket delivery loop has no typed path. Every delivery still depends on bash orchestration, so spawn, watch, classify, and summarize cannot be reused by agents, the daemon, or the MCP surface.
- Classification is not truth-bound at the per-ticket level. The typed stack can classify a session, but nothing records whether the claimed result agrees with the branch, PR, ledger, tracker, or CI, so an exit-0-with-no-artifact run has no durable place to be recognized as a false success.
- There is no machine-readable handover gate. Even with the amended backlog, a repository cannot be evaluated or flipped without manually reconstructing evidence from bash logs and tracker history.
- There is no reversible authority record. A repository cannot move from bash-authoritative to engine-authoritative and back without an ad-hoc operational edit that leaves no audit trail.
- The bash fallback has no safe way to learn that a repository has been handed over. Invoking the typed CLI from bash would break the fallback exactly when the typed CLI is unavailable; a durable, CLI-independent authority view is missing.
- The daemon cannot drive dispatch lanes because the planner seam is unfilled and no production composition supplies the lane executor.
- Dispatch is invisible to agents and help: it is not in the prompt-required command set, has no help entry, and the delivered absence tests would fail the moment the command is registered.
- The error table cannot classify a spawn failure or a dispatch-specific state-unverified outcome, so those failures would be contained as internal errors instead of stable identities.

## 3. PROBLEM STATEMENT

Because the only per-ticket delivery loop is the bash stack and the typed engine has no durable truth-bound dispatch evidence or per-repository authority mechanism, the delivery process cannot safely move authority from bash to the engine for one repository at a time, resulting in either permanent dependence on untyped orchestration or a handover decision made without class coverage, incident truth, exposure, and corroborated evidence.

## 4. GOALS

- **G-1**: Deliver a one-shot typed dispatch path that resolves a harness, claims the queue lease, spawns or resumes the lifecycle session through the harness session port, watches with progress-based liveness, and classifies through the shared classifier into the closed TDR-0005 vocabulary.
- **G-2**: Make dispatch results truth-bound: artifacts and tracker facts determine success, exit-0-with-no-artifact is `failed`, unreadable truth is `state-unverified`, and no success claim is accepted on an exit code alone.
- **G-3**: Support the resume path with recorded resume modes, phase-ledger continuity, restart-budget enforcement, and resume-economics admission, so a resume never silently re-executes completed phases or silently requeues an exhausted delivery.
- **G-4**: Accrue durable dual-run evidence per dispatch: repository, reference, timestamps, engine outcome and token, independently derived comparison token, divergence state, false-success classification, and corroboration references.
- **G-5**: Deliver the evidence-based handover gate with a summary surface, named unmet conditions, per-repository flip and reversal, and an audit record of the decision.
- **G-6**: Keep the four bash entry points runnable as fallback, with deprecation pointers only after a repository is engine-authoritative and with no dependency on the typed CLI for that decision.
- **G-7**: Fill the daemon lane-executor seam so the resident daemon can drive dispatch lanes, while one-shot dispatch continues to work from state with no daemon.
- **G-8**: Register dispatch in the prompt-required CLI surface with help and reference-page coverage, add the missing dispatch error identities, and retire or invert every delivered assertion that dispatch is absent.

### 4.1 Success Metrics / KPIs

| Metric | Target for this change |
|---|---|
| Acceptance criteria verified against the implementation | 100% |
| TDR-0005 tokens in the closed vocabulary after the change | 11 of 11; 0 new, 0 removed, 0 remapped |
| Bash-continuity summary keys emitted in order by a dispatch run | 4 of 4 (`result=`, `pr_url=`, `exit_code=`, `last_message=`), 0 omitted, 0 reordered |
| Documented token/exit divergences from TDR-0005 | 0 beyond the ratified `state-unverified` exit 2 |
| Exit-0-with-no-artifact runs classified as success | 0 |
| False-success incidents accepted as clean in the fixture proof | 0 |
| Dispatch error rows added | 2 of 2 (`dispatch.session.spawn-failed`, `dispatch.state-unverified`); existing 2 retained |
| Absence assertions retired or inverted | 3 of 3 delivered assertions |
| Four bash entry points runnable without the typed CLI | 4 of 4 |
| Model/provider calls in help, summary, gate, and render paths | 0 |
| Controlled-repository end-to-end handover and reversal | 1 handover and 1 reversal, both recorded |
| Daemon-driven dispatch lanes in the fixture | 1 lane spawned, observed, collected, resumed through the seam |

### 4.2 Non-Goals

- **NG-1**: Actually flipping this repository, or any real repository, to engine-authoritative. The flip is an operational act after real pilot evidence; this change delivers the mechanism, gate, records, and controlled proof (D2).
- **NG-2**: Changing the delivery-result token set, its projection classes, its derivation classes, or TDR-0005/TDR-0010. The vocabulary is closed.
- **NG-3**: Firing a merge. `dispatch` never merges; `result=merged` is already-merged detection only.
- **NG-4**: Coordinator-session supervision (`ceo-loop.sh`'s loop-driving function belongs to M1-S23).
- **NG-5**: Tracker or PR label migration at handover. The Session G transcript mentions an engine-managed label set, but no acceptance criterion requires it.
- **NG-6**: Cross-host authority sharing for one repository. Authority is scoped to the state directory that holds the handover ledger.
- **NG-7**: Containerized or remote lane execution. The host execution environment remains the only implementation.
- **NG-8**: Removing, rewriting, or re-architecting the bash entry points. They remain installed fallback.
- **NG-9**: Accumulating real pilot evidence inside the pull request. Evidence accrual starts after merge; the pull request proves the mechanism on a controlled repository or fixture.
- **NG-10**: Rewriting planning documents outside the story-owned reference page and the two seeded scenarios, and reconciling `doc/spec/**` (phase 7).
- **NG-11**: Retention, compaction, or pruning of dispatch evidence records beyond the bounded read window.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | One-shot typed dispatch with harness resolution, lease claim, spawn/resume, progress-based liveness, classification, and summary/envelope output | The per-ticket loop is the story's deliverable and the unit every other capability observes. |
| F-2 | Truth-bound result derivation: artifact and tracker truth decide success; exit-0-with-no-artifact is `failed`; unreadable truth is `state-unverified` | An exit code is not evidence; false success must be impossible to record as clean. |
| F-3 | Resume path with recorded resume mode, phase-ledger continuity, restart-budget enforcement, and resume economics | A resumed lane must neither re-run completed work nor silently requeue an exhausted delivery. |
| F-4 | Durable per-dispatch dual-run evidence with comparison token, divergence state, incident classification, and corroboration references | Handover needs an auditable evidence base, not reconstructed logs. |
| F-5 | `dispatch dual-run summary --repo` with counts, class coverage, window, and the four-condition eligibility verdict | The gate must be answerable before it is applied. |
| F-6 | `dispatch handover` with refusal naming unmet conditions, per-repository recorded flip, and `--revert` | Authority transfer must be evidence-gated, isolated, and reversible. |
| F-7 | Bash fallback with CLI-independent authority detection and deprecation pointers after handover | The fallback must not depend on the thing it falls back from. |
| F-8 | End-to-end proof on a controlled repository: evidence, handover, authoritative dispatch, reversal | The mechanism is only proven if the full path runs end to end. |
| F-9 | Merge-absence: dispatch never fires a merge; `merged` is detection only | Authority transfer must not transfer merge authority. |
| F-10 | Daemon integration: production `LaneLaunchPlanner` and `createLaneExecutor` availability, with a daemon-less one-shot path | The resident daemon must be able to drive dispatch lanes without making dispatch dependent on it. |
| F-11 | Registration and self-description: prompt-required composition, help entries, reference page, and retirement/inversion of absence tests | Agents and humans must discover the delivered command, and stale absence assertions must not contradict it. |
| F-12 | Dispatch error identities and exit projection, including spawn-failed and dispatch-specific state-unverified | Failures must classify through stable identities, never prose or internal containment. |

### 5.1 Capability Details

- **F-1**: `dispatch <ref> [--harness <name>] [--resume-prompt <text>]` executes one dispatch. It resolves the harness from the flag when present and from configuration otherwise, rejects an unknown harness name as an input refusal, claims the repository lease for the reference through the scheduling engine, refuses on an active conflicting lease, and spawns a fresh lifecycle session or resumes the existing lane through the harness session port. It watches the session with progress-based liveness: token delta, session traffic, worktree activity, or prefill advancement anywhere in the observed session tree counts as progress; a bare elapsed timer never produces a stalled verdict; an absent reading is reported absent or unknown and is never coerced to zero. On termination it classifies through the one shared classifier and emits, in text mode, exactly the four bash-continuity keys in bash order, and in machine mode, one envelope whose `data` carries `result`, `prUrl`, `phaseLedger`, `restarts`, `resumeAmplification`, `harness`, `handoverState`, and `outcome`. The `outcome` field is mandatory because TDR-0010 requires consumers to read it beside any `partial` token.
- **F-2**: Result derivation is artifact-first. A session that exits successfully but leaves no branch commits, no PR, and no ledger progress is `failed`, with the missing artifact named. A tracked change with an open PR is `pr-open`; an open PR whose URL cannot be resolved is `pr-open-unverified`; an already-merged PR or branch is `merged` as detection only; a tracker state that blocks delivery is `blocked`; a lane with nothing left to do is `noop-lane-nothing-to-do`; a harness refusal before a session exists is `noop-lane-permission` and means spawn-refused, never a lane-permission policy verdict; a timeout that exhausts liveness is `max-restarts` through the restart admission path. A failed ledger, tracker, artifact, or state read that prevents a verdict is `state-unverified` at exit 2. `partial` always carries its outcome. No token outside the eleven may be emitted.
- **F-3**: `--resume-prompt` resumes the existing lane with the supplied guidance, records the resume mode, and continues from the phase-ledger position; completed phases are skipped idempotently. When the selected harness adapter lacks resume injection, the recorded mode is `resume-prompt-reentry` and the prefill cost is acknowledged in the record and output. Restart admission delegates to the delivered restart-budget gate with the bound resolved from `lane.restart-budget`: at or above the bound the attempt is refused with `dispatch.restart-budget-exceeded`, exit 1, a terminal exhaustion record, and a typed escalation; it is never silently requeued. Resume economics delegates to the delivered admission: attach-and-continue consumes no restart ordinal; an uneconomical prefill re-pay is refused with `dispatch.resume-uneconomical`; unreadable token or cost facts refuse rather than admit.
- **F-4**: Every dispatch appends exactly one attempt record with the repository identity, reference, start and finish timestamps, harness, handover state at run, engine outcome and token, the independently derived comparison token or an explicit not-applicable marker, divergence state, false-success classification, corroboration references, and the resume mode when applicable. A comparison disagreement is a divergence record; a later resolution record marks it resolved without deleting the original evidence. A success-claimed result contradicted by the branch, PR, ledger, tracker, or CI is recorded as a false-success incident with bounded evidence references. An unreadable or incomplete evidence read never produces a clean record; it produces an unevaluable record that blocks eligibility.
- **F-5**: `dispatch dual-run summary --repo <repo>` reads the repository's evidence window, reports elapsed days, counted deliveries, false-success incidents, divergences (reported, resolved, unresolved), result-class coverage with missing classes named, corroboration satisfaction, and the eligibility verdict. Eligibility is the conjunction of the four conditions. The floor-only "whichever comes first" is applied exactly: at least 20 counted dispatches or at least 7 consecutive calendar days with at least one counted dispatch, within the current window. It never substitutes for class coverage, incident truth, or corroboration. Bounded or truncated reads are declared and make eligibility unverifiable rather than eligible.
- **F-6**: `dispatch handover <repo>` evaluates the same gate. When unmet it is a clean refusal at exit 1, names every unmet condition, and appends nothing that changes authority. When met it appends one handover record containing the conditions snapshot and evidence references, flips only that repository to engine-authoritative in the derived authority view, and reports the flip as recorded and reversible. `dispatch handover <repo> --revert` appends a reversal record, restores dual-run authority for that repository, preserves the full history, and is an idempotent noop when the repository is already in dual-run. Other repositories are never affected.
- **F-7**: The four bash entry points continue to run with their existing arguments and exit behavior. Before a repository is handed over they behave exactly as today. After handover they print a deprecation pointer naming `dispatch` and the reversal surface, and they remain executable as fallback if the operator insists. Authority detection is a pure read of the derived repository authority view: no typed CLI invocation, no network, no model. An absent, unreadable, or malformed view means dual-run, so a missing typed installation can never break the bash stack.
- **F-8**: A controlled test repository, or an equivalently controlled harness fixture with injected tracker, CI, and harness ports, runs the complete path: dispatches accrue genuine evidence, the summary reaches eligibility, handover flips the repository, a post-handover dispatch runs end to end through the typed stack, and `--revert` restores the bash-authoritative state. Records and the derived authority view are produced by the real commands; fixture evidence is never hand-inserted into the ledger.
- **F-9**: Dispatch has no merge port and no merge code path. A delivery whose PR is already merged reports `merged` only after independently observing the merged state. A merge-ready open PR reports `pr-open` or `pr-open-unverified` and is left for the coordinator's `merge`.
- **F-10**: The production composition supplies a `LaneLaunchPlanner` that produces the lifecycle prompt and the declared execution-environment allowlist for a `LaneLaunchRequest`, and supplies `createLaneExecutor` over the selected harness session port and execution-environment descriptor. The resident daemon can then claim, start, observe, collect, and resume dispatch lanes. The planner resolves no secret value and returns only declared variable names; an unavailable planner or a declared capability gap keeps the executor unavailable and the daemon in honest supervise-only mode. With no daemon, the one-shot command still runs entirely from state.
- **F-11**: `dispatch` joins the prompt-required command set. Root help, command help, and the reference page cover the three execution forms plus the resolution and reversal surfaces; help rendering stays a pure data lookup. The three delivered absence assertions are retired or inverted: the entrypoint-composition expectation, the pilot-isolation expectation, and the harness-review-deferrals assertion. The F-9 host-runner deferral is revisited because dispatch is named as its first production consumer, and the deferral record states the production-consumer outcome.
- **F-12**: The error table gains `dispatch.session.spawn-failed` (spawn failure before a session exists) and `dispatch.state-unverified` (dispatch-specific unverifiable truth), while retaining `dispatch.restart-budget-exceeded` and `dispatch.resume-uneconomical`. Every failure classifies through exactly one declared identity with a projection class consistent with TDR-0005: spawn refusal and spawn failure are user-validation at exit 1, restart-budget and resume-uneconomical are user-validation at exit 1, and dispatch state-unverified is platform-provider at exit 2. Prose is never identity.

## 6. USER & SYSTEM FLOWS

```
Flow 1: one-shot dispatch (dual-run or authoritative)
  Actor runs `dispatch <ref>` -> harness resolved (flag, then config)
  -> queue lease claimed for the repository -> session spawned or resumed
  -> liveness evaluated on progress signals -> shared classifier -> outcome + token
  -> artifact/tracker/ledger truth evaluated -> final token, exit projection
  -> attempt record appended -> four key=value lines (text) or envelope (json)
  -> in dual-run: result is evidence only; no authority claim and no merge

Flow 2: exit-0-with-no-artifact
  Session exits 0 -> artifact check finds no branch commit, no PR, no ledger progress
  -> token failed (exit 1) -> attempt record carries missing-artifact evidence
  -> never recorded as success, never counted clean

Flow 3: resume
  Answer or operator supplies `--resume-prompt` -> existing lane resolved
  -> resume mode recorded (attach-continue or resume-prompt-reentry + prefill cost)
  -> restart budget admitted or refused -> completed phases skipped
  -> lane continues from the ledger position -> normal classification and evidence

Flow 4: evidence accrual and summary
  Each dispatch appends an attempt record -> comparisons append divergence records
  -> resolutions append resolution records -> `dual-run summary --repo` folds the window
  -> days, deliveries, incidents, divergences, class coverage, corroboration
  -> eligibility verdict with unmet conditions named

Flow 5: handover
  `dispatch handover <repo>` -> gate evaluated
  -> unmet: clean refusal at exit 1, no authority change
  -> met: handover record appended, derived authority view flipped for that repo
  -> other repositories unchanged

Flow 6: reversal
  `dispatch handover <repo> --revert` -> reversal record appended
  -> derived authority view returns to dual-run -> bash fallback returns to normal

Flow 7: bash fallback
  Any of the four bash entry points runs -> authority view read as a plain file
  -> absent/unreadable means dual-run -> normal behavior
  -> authoritative means deprecation pointer printed -> execution still possible

Flow 8: daemon-driven lane
  Daemon computes a dispatch action -> planner produces prompt and environment allowlist
  -> lane executor spawns through the harness session port -> lane record appended
  -> daemon observes and collects -> one-shot and daemon paths share classification
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `dispatch` command family: `dispatch <ref> [--harness <name>] [--resume-prompt <text>]`, `dispatch dual-run summary --repo <repo>`, `dispatch dual-run resolve <divergence-id> --note <text>`, and `dispatch handover <repo> [--revert]`.
- Harness resolution, queue lease claim, fresh spawn, resume, progress-based liveness, shared classification, artifact/tracker/ledger truth evaluation, token derivation, and exit projection.
- The bash-continuity summary (four keys in order) and the machine envelope data, including the mandatory `outcome` field beside `result`.
- The resume path: resume-mode recording, prefill-cost acknowledgement, phase-ledger continuity, restart-budget enforcement through the delivered gate, and resume-economics admission.
- Three additive state record kinds: dispatch attempt, divergence resolution, and handover. One derived per-repository authority view readable without the typed CLI.
- The four-condition handover gate, the summary verdict, refusal naming unmet conditions, per-repository flip, and reversal.
- Bash fallback behavior in all four entry points: unchanged before handover, deprecation pointer after handover, safe when the typed CLI is absent.
- Daemon integration: the production lane-launch planner and lane-executor availability over the delivered harness port; the daemon-less one-shot path.
- Registration in the prompt-required command set, help entries, reference-page coverage, error-table additions, and retirement/inversion of the three absence assertions.
- Revisiting the F-9 host-runner deferral because dispatch becomes its first production consumer.
- End-to-end proof on a controlled repository or controlled fixture.
- Reconciling the dispatch reference page and the two seeded scenarios (SC-M1-29, SC-M1-30) with the evidence-based bar, because this story owns those artifacts and the scenario file explicitly yields to the owning story.

### 7.2 Out of Scope

- [OUT] Flipping this repository or any real repository to engine-authoritative.
- [OUT] Changing the eleven-token vocabulary, projection classes, derivation classes, or TDR-0005/TDR-0010.
- [OUT] Firing a merge, adding a merge port, or transferring merge authority.
- [OUT] Coordinator-session supervision and `ceo-loop.sh`'s loop-driving function (M1-S23).
- [OUT] Tracker or PR label migration at handover.
- [OUT] Cross-host or cross-state-directory authority sharing for one repository.
- [OUT] Containerized, remote, or non-host execution environments.
- [OUT] Removing, rewriting, or re-architecting the four bash entry points.
- [OUT] Accumulating real pilot evidence, or performing the operational handover, inside the pull request.
- [OUT] Rewriting `backlog-ranking.md`, `roadmap.md`, `cli-command-registry.md`, the milestone journeys, the user journeys, or the dated operator-input record; the GH-266 declared residual continues for those files.
- [OUT] Editing the GH-239 ticket body, which remains stale on the two-week wording.
- [OUT] Reconciling `doc/spec/**` current-truth documentation (phase 7).
- [OUT] Record retention, compaction, pruning, or archival policy.
- [OUT] A general-purpose workflow engine, batch dispatch, or multi-repository scheduling UI.

### 7.3 Deferred / Maybe-Later

- Cross-host authority synchronization and a repository-global authority record.
- Pruning or compacting dispatch evidence after a retention bound, and a configurable evidence window.
- Importing pre-dispatch bash delivery evidence into the dual-run ledger; only dispatches produced after this change can carry an engine/comparison pair.
- Machine-readable encoding of the gate predicate for external tooling.
- Tracker and PR label migration at handover, if the owner decides the label set is required.
- Richer divergence taxonomy than resolved/unresolved, for example classifier-defect versus evidence-noise classes.
- Automated scheduling of pilot dispatches instead of operator-driven accrual.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. Dispatch is a CLI command family; it introduces or modifies no HTTP surface. External tracker, CI, and VCS reads continue through the delivered read adapters and their configured credentials.

### 8.2 Events / Messages

| ID | Event / record | Contract |
|---|---|---|
| EVT-1 | `dispatch.attempt` state record | Appended once per dispatch under the state fence. Payload schema `delivery.dispatch.attempt.v1`. Carries attempt identity, repository identity, reference, harness, start/finish timestamps, handover state at run, engine outcome and token, comparison token or explicit not-applicable, divergence reference, false-success classification, corroboration references, and resume mode when applicable. Immutable; a failed read or malformed payload classifies as a state failure and is never a fabricated attempt. |
| EVT-2 | `dispatch.divergence` state record | Payload schema `delivery.dispatch.divergence.v1`. Appended when a comparison disagrees (`state: open`) and again on resolution (`state: resolved`, bounded note, recording principal, timestamp). Folded latest-per-divergence; the original open record is never rewritten or deleted. |
| EVT-3 | `dispatch.handover` state record | Payload schema `delivery.dispatch.handover.v1`. Appended on flip and on reversal. Carries repository identity, operation (`authoritative` or `dual-run`), conditions snapshot (the summary verdict at decision time), evidence references, recording principal, and timestamp. Folded latest-per-repository. |

All three record kinds, their payload schemas, key prefixes, identity fields, and closed state vocabularies are declared once in the runtime-neutral contracts tier; no production module declares a second copy. The derived per-repository authority view (`delivery.dispatch.authority.v1`) is a rebuildable document, not an event: it is replaced atomically from the folded handover ledger and exists so non-typed consumers can read authority without invoking the CLI.

### 8.3 Data Model Impact

| ID | Element | Description |
|---|---|---|
| DM-1 | Dispatch attempt record | Durable per-dispatch evidence: identity, repository, reference, timestamps, harness, handover state, engine outcome and token, comparison token or not-applicable, divergence reference, incident classification, corroboration tri-state per source, resume mode. |
| DM-2 | Divergence record | Append-only open/resolved state for one comparison disagreement, with bounded resolution note, recording principal, and timestamps. |
| DM-3 | Handover record | Append-only per-repository authority operation with conditions snapshot, evidence references, principal, and timestamp. |
| DM-4 | Derived repository authority view | Rebuildable document: repository identity, `authority` (`dual-run` or `authoritative`), handover reference, recorded time, and reversal availability. Absent or unreadable means dual-run. |
| DM-5 | Dispatch envelope data | `result`, `prUrl`, `phaseLedger` (`completed`, `total`, `variant`), `restarts`, `resumeAmplification`, `harness`, `handoverState`, `outcome`; error envelopes keep the full error-table fields. |
| DM-6 | Dual-run summary data | Repository, evaluation window (start, end, reason), day count, counted deliveries, false-success incident count, divergences (reported, resolved, unresolved, identifiers), class coverage (present and missing), corroboration (satisfied and unsatisfied), eligibility verdict, and unmet conditions. |
| DM-7 | Handover gate predicate | The four-condition conjunction, evaluated over the current evidence window: incident and divergence truth, eleven-class coverage, floor-only exposure, and corroboration. One declared home; the summary and handover evaluate the same predicate. |
| DM-8 | Corroboration evidence set | Completed pm-notes phases, tracker state, and CI on the pushed head. A result token alone never satisfies it; per-outcome-family sufficiency is declared once and reused by the gate. |

No schema-version bump is required: the three record kinds and the derived view are additive inside the delivered state format, matching the established additive-record pattern. No existing record kind, payload schema, or key changes.

### 8.4 External Integrations

- Harness CLIs: spawn and resume through the delivered adapters for opencode and Claude Code; the harness kind is configuration or the `--harness` flag; no direct runtime branching outside the adapter.
- VCS and tracker reads: branch commits, PR state and URL, and tracker state for artifact and corroboration truth. Read-only.
- CI reads: CI verdict on the pushed head for `merged` corroboration and for false-success detection. Read-only.
- Git: local branch and commit evidence. Read-only.
- No external write is introduced. Dispatch itself performs no tracker transition, comment, or merge; lifecycle writes continue to belong to the lifecycle commands and agents.

### 8.5 Backward Compatibility

- The eleven-token vocabulary, its order, and its projection classes are unchanged; `state-unverified` keeps exit 2, and no call-site exit override is introduced.
- The text summary of a dispatch run preserves the bash keys `result=`, `pr_url=`, `exit_code=`, `last_message=` in that order and with the same semantics. Bash-internal `closeout_unverified=` is not part of the declared four-key contract; dispatch expresses unverified outcomes through `pr-open-unverified` and `state-unverified`.
- Existing dispatch error rows are retained. New rows are additive and sync-checked against the documented table.
- The four bash entry points keep their arguments, outputs, and exit behavior for dual-run repositories. The only new behavior is a deprecation pointer after handover and a pure-file authority read that defaults to dual-run.
- The prompt-required command set gains one member; the entrypoint, root help, command help, and reference page change together. Consumers of the previous absence behavior are limited to the three retired/inverted tests.
- State history remains readable: new kinds are additive, and old readers that ignore unknown kinds continue to work under the delivered unknown-kind rules; a kind-aware reader must not treat an unknown dispatch kind as clean evidence.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Token and exit closure | Every emitted result token is one of the eleven TDR-0005 tokens (0 outside the set); every process exit is 0, 1, or 2; `state-unverified` exits 2; success-claimed tokens exit 0; `failed`, `max-restarts`, `partial`, and `noop-lane-permission` exit 1; 0 call-site exit literals. |
| NFR-2 | Progress-based liveness truth | 0 stalled verdicts derived from a bare elapsed timer; 0 stalled verdicts while any sourced token delta, traffic, worktree, or prefill signal advances between two consecutive evaluations; absent readings report absent or unknown, never zero; evaluation cadence is `lane.liveness-interval` (default 30 s). |
| NFR-3 | Determinism and no model calls | 0 model or provider calls in help, summary, gate evaluation, classification, and render paths; the same state and inputs produce the same ordered verdict and bounded human output. |
| NFR-4 | Bounded reads and output | Machine payload ≤ 65,536 UTF-8 bytes; human output ≤ 40 lines and ≤ 8,192 bytes; a repository summary reads at most 5,000 attempt records and completes within 5 s at p95 on the reference host; any truncation is declared and makes eligibility unverifiable. |
| NFR-5 | Evidence durability and atomic derived state | 100% of attempt, divergence, and handover appends are fenced and verified after append; 0 clean verdicts derived from an unreadable or torn read; the authority view is replaced atomically so an observed file is always a complete prior or next version, never a torn mix. |
| NFR-6 | Idempotent convergence | Replaying an identical summary, handover, or reversal appends 0 duplicate records and yields the same authority state; a `noop` is reported instead of a second effect; a resumed lane consumes at most one restart ordinal per admitted attempt. |
| NFR-7 | Secret containment | 0 secrets, credential values, prompts, transcripts, diffs, or raw provider payloads in output, envelopes, records, help, or logs; the spawn environment contains 0 undeclared parent variables (deny-by-default allowlist). |
| NFR-8 | Bash fallback compatibility | 4 of 4 bash entry points run for dual-run repositories with 0 new required arguments and 0 behavior changes; 0 typed CLI invocations are required to decide fallback; an absent or malformed authority view resolves to dual-run. |
| NFR-9 | Merge absence | 0 merge code paths or merge ports reachable from dispatch composition; a structural boundary check and a production-composition check both prove absence. |
| NFR-10 | Evidence completeness | 100% of counted dispatches carry a complete comparison field (a token or an explicit not-applicable marker) and a tri-state corroboration record; 0 counted dispatches with silently missing evidence are treated as clean; 0 unresolved divergences are omitted from the summary. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The dispatch attempt record is the primary per-run telemetry artifact; the divergence and handover records are the audit trail. No separate metric endpoint, collector, or alert is introduced.
- `dispatch dual-run summary` is the reporting surface: it counts days, deliveries, incidents, and divergences, names unresolved divergence identifiers, reports missing result classes, and states the eligibility verdict with unmet conditions.
- One-shot dispatches append attempt records even when the daemon is absent; daemon-driven dispatches additionally leave the delivered daemon lane record. The two paths must agree on the final token and outcome for the same evidence.
- Deterministic render paths contain no model calls. No prompt, transcript, raw payload, or credential value enters a record, log, or envelope.
- A false-success incident is loud in the record and in the summary counts (never zeroed or hidden). An unevaluable evidence read is loud as a classified state failure and blocks eligibility.
- Existing status and lanes surfaces are not required to change; if they already expose dispatch runs through daemon lane records, the projection stays consistent with DM-5 and DM-6.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | The stale two-week wording in the GH-239 body is implemented by mistake | H | H | D1 makes the amended backlog the only gate definition; AC-F5-2/AC-F5-3 and AC-F6-1 assert the four-condition bar and the floor-only rule; the reference page and seeded scenarios are reconciled | L: a reader who opens only the ticket body still sees the stale text |
| RSK-2 | The floor is misread as an alternative to class coverage, incident truth, or corroboration | H | M | The summary and handover evaluate one predicate; AC-F5-3 requires the floor-only sentence and AC-F5-2 requires all four conditions | L: prose can still be skimmed, but the verdict is machine-checked |
| RSK-3 | An engine-claimed success is counted clean without corroboration | H | M | AC-F4-3 and AC-F5-2 require artifact, tracker, and CI corroboration; an uncorroborated success claim blocks eligibility; the token alone never counts | L: a forged record could still lie, but it must forge three independent evidence sources |
| RSK-4 | Handover flips the wrong repository or leaks authority across repositories | H | L | Repository identity is explicit in every record and in the derived view; AC-F6-2 asserts per-repo isolation; AC-F8-1/AC-F8-2 prove isolation in the fixture | L: identity resolution for a malformed repository record remains an operator-visible refusal |
| RSK-5 | A flip cannot be reverted or a reversal loses history | M | M | `--revert` appends a reversal rather than deleting; AC-F6-3 asserts history retention and idempotent noop; AC-F8-2 proves the full cycle | L: an operator who edits state by hand can still corrupt it, as with any state change |
| RSK-6 | Bash fallback breaks when the typed CLI is absent or the authority view is malformed | H | M | AC-F7-3 and NFR-8 require a pure-file read, no typed CLI invocation, and dual-run on any absence or parse failure; all four entry points are exercised | L: an OS-level unreadable file still falls back to dual-run, which is safe |
| RSK-7 | Dispatch accidentally fires a merge | H | L | AC-F9-1 and NFR-9 require no merge port and a structural absence check; the result derivation treats `merged` as detection only | L: a future contributor could add a port, which the boundary check would catch on review |
| RSK-8 | Evidence records leak prompts, transcripts, or secrets | H | L | Record fields are bounded and enumerated; AC-F4-1 and NFR-7 restrict them; the planner returns variable names only and the spawn environment is deny-by-default | L: `last_message` is bounded and redacted but can still contain operational prose |
| RSK-9 | Daemon planner wiring diverges from the one-shot path | M | M | Both paths use the same harness session port and shared classifier; AC-F10-1/AC-F10-2 assert planner output and daemon driveability; AC-F10-3 asserts the daemon-less path | L: composition differences can still introduce timing variance |
| RSK-10 | The gate cannot be demonstrated in the pull request because real pilot evidence does not exist yet | H | H | D2 scopes the PR to mechanism, records, gate, and controlled proof; AC-F8-1 proves the path on a controlled repository or injected fixture; real accrual starts after merge | M: the first real handover still waits for evidence outside this change |
| RSK-11 | Rare classes (`state-unverified`, `max-restarts`, `noop-lane-permission`) are hard to exercise on real tickets and block the gate indefinitely | M | M | The class set is closed and named; the summary names missing classes; the controlled proof exercises all eleven; operational guidance records how to obtain rare-class evidence safely | M: the owner may accept a long accrual period; the bar is intentionally strict |
| RSK-12 | Absence tests remain or are inverted incorrectly, so CI contradicts the delivered command | M | L | AC-F11-3 names all three assertions and the F-9 revisit; the plan retires or inverts them in the same change that registers dispatch | L: a future test could reassert absence, which review should catch |
| RSK-13 | Error-table additions break kind-only dispatch classification or the sync check | M | L | AC-F12-1/AC-F12-2 require exact-code resolution and table sync; the dispatch kind already has multiple rows, so kind-only resolution must not be assumed | L: a malformed failure object could still be contained as internal |
| RSK-14 | A resume re-executes completed phases or consumes duplicate restarts | H | L | AC-F3-1 and AC-F3-4 assert ledger continuity and idempotent replay; the delivered restart fold refuses torn ordinals | L: a harness that ignores the prompt can still redo work; the record exposes it |
| RSK-15 | An unresolved divergence is silently dropped or forgotten | H | M | Divergences are append-only records; resolution requires an explicit record; AC-F4-2 and AC-F5-2 block eligibility while any remains unresolved | L: an operator could resolve without evidence, which the recorded principal and note expose |
| RSK-16 | The incident-reset window is read as weakening the zero-incident bar | M | M | The window never predates the most recent incident, so an incident can never be inside the evaluated window; AC-F5-1/AC-F5-2 require the window start and reason to be reported | L: the owner may prefer a permanent bar; DEC-10 records the choice for review |
| RSK-17 | Multi-host authority splits one repository across two state directories | M | L | Authority is explicitly state-directory scoped and declared out of scope; the derived view is not replicated | M: a shared repository across hosts could see two authorities until a future change |

## 12. ASSUMPTIONS

- The dependency set (verify change, harness adapters, scheduling engine, resident daemon) is delivered and stable on the integration branch (D5).
- The eleven-token vocabulary, the TDR-0010 projection, and the two consumer rules are binding and unchanged.
- `lane.restart-budget` (default 3) and `lane.liveness-interval` (default 30 s) remain the policy-as-data homes for restart and liveness cadence; no new policy key is required for the gate.
- The harness branch already supplies kind selection, execution environment, store locations, and the declared environment allowlist; no new harness configuration shape is required.
- The state layer admits additive record kinds and derived documents without a schema bump, as the delivered queue and daemon kinds demonstrate.
- Tracker, CI, and VCS reads are available through injected read ports, so a controlled fixture can supply deterministic evidence without hand-editing records.
- Repository identity can be resolved from the scheduling engine's `repository` field; when absent, the declared checkout root serves as a stable fallback identity.
- The four bash entry points can read a small derived document with ordinary shell tooling and can default to dual-run on any read or parse failure.
- A controlled test repository, or an injected fixture, can exercise all eleven result classes without touching real pilot tickets.
- The existing planning residual (ranking, roadmap, registry, journeys, user journeys, operator input) remains declared and is not silently contradicted by this change.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | M0-S8 verify change and the TDR-0005 exit taxonomy | Supplies the ledger outcome and the token/exit projection used as the comparison baseline and final classification contract. |
| Depends on | M1-S11 harness adapters and the shared classifier | Supplies spawn, resume, collect, liveness, and the six-row outcome-to-token projection bound by TDR-0010. |
| Depends on | M1-S17 scheduling engine | Supplies repo-exclusive lease claim, queue identity, and one-shot state-only operation. |
| Depends on | M1-S18 resident daemon | Supplies the lane-executor seam, lane records, restart records, and reconcile behavior that dispatch fills. |
| Depends on | Delivered state layer and error table | Supplies fenced append/read, derived documents, and stable error identities. |
| Depends on | Delivered session lifecycle economics | Supplies the shared restart-budget gate and resume-economics admission. |
| Depends on | Delivered CLI composition and help | Supplies prompt-required composition, help rendering, and reference-page conventions. |
| Depends on | Amended backlog M1-S9 entry (GH-266) | The canonical four-condition evidence bar; the ticket body's two-week wording is stale. |
| Blocks | The operational handover of any repository to the engine | The first real flip waits for real pilot evidence after this change merges. |
| Blocks | M1 exit evidence for M1-S9 | The summary and records are the instruments the milestone exit row reads. |

## 14. OPEN QUESTIONS

No blocking questions. Three ambiguities were resolved in the decision log rather than left open: the four-key summary versus the additive bash-internal key (DEC-8), the reversal and divergence-resolution surfaces not present in the proposed command page (DEC-6, DEC-7), and the family-wise comparison baseline (DEC-3). Record retention and cross-host authority are explicitly out of scope (Section 7.2) and deferred (Section 7.3).

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 | The handover gate is the amended backlog's four-condition evidence bar; the GH-239 ticket body's rolling two-week wording is stale and is not implemented | D1; the backlog was amended by GH-266 and is canonical; a calendar window measures waiting, not classifier exposure | 2026-11-08 |
| DEC-2 | The deliverable is the mechanism, gate, records, and controlled end-to-end proof; actually flipping a real repository is an operational act after real pilot evidence | D2; a pull request cannot satisfy a real-evidence gate, and flipping this repository would be an unreviewable operational change | 2026-11-08 |
| DEC-3 | The comparison baseline is the independently derived token: verify-change's ledger outcome for verify-class tokens, independent tracker truth for tracker-pr tokens, and an outcome-level comparison with an explicit not-applicable token baseline for dispatch-session tokens | D3 and TDR-0005 require token-level parity with independent truth, not two deliveries; TDR-0010 requires the outcome beside dispatch-session/partial tokens | 2026-11-08 |
| DEC-4 | `dispatch` joins the prompt-required composition; help, reference-page coverage, and the three absence assertions change in the same delivery | D4; agents and the coordinator must discover the delivered command, and tests asserting absence would otherwise fail the build | 2026-11-08 |
| DEC-5 | The dependency set is treated as delivered and stable | D5; verify change, harness adapters, scheduling, and daemon are on the integration branch | 2026-11-08 |
| DEC-6 | Reversal is `dispatch handover <repo> --revert`, appended as a reversal record rather than a deletion | The ticket requires a reversible, recorded handover; the proposed command page has no reversal form, so the story refines it additively | 2026-11-08 |
| DEC-7 | Divergence resolution is `dispatch dual-run resolve <divergence-id> --note <text>`, appended as a resolution record | Unresolved divergences block handover; without an explicit resolution surface the gate could never be cleared except by hand-editing state | 2026-11-08 |
| DEC-8 | The dispatch text summary emits exactly the four declared keys in order; the additive bash-internal `closeout_unverified=` key is not emitted | The declared M1 continuity contract is four keys; unverified outcomes are already distinct tokens (`pr-open-unverified`, `state-unverified`); emitting an extra key would violate "exactly" | 2026-11-08 |
| DEC-9 | Authority truth is the append-only handover ledger; a rebuildable per-repository authority view is derived from it and is the only thing bash reads | The state layer is truth; bash must not depend on the typed CLI, so it reads an atomic, CLI-independent projection | 2026-11-08 |
| DEC-10 | The evaluated window begins at the later of the first counted dispatch and the most recent false-success incident; an incident resets the floor and class coverage, while resolved divergences do not reset it | A permanent incident bar would make recovery impossible; never letting the window precede an incident preserves "zero incidents in the evaluated evidence" without weakening it | 2026-11-08 |
| DEC-11 | Class coverage is a set comparison over the eleven TDR-0005 tokens among counted dispatches in the window; dispatch-session tokens count as exposure even though they carry no independent token baseline | The bar requires every class to be exercised; the closed set is the only stable definition, and exposure is not a success claim | 2026-11-08 |
| DEC-12 | The day floor counts distinct UTC calendar dates with at least one counted dispatch, in a run of at least seven consecutive dates | A deterministic, timezone-independent definition avoids a gate that depends on the operator's locale | 2026-11-08 |
| DEC-13 | Repository identity is the scheduling engine's `repository` value; when absent it is a stable digest of the declared checkout root | Per-repository isolation must survive restarts, renames of the checkout path, and absent remote metadata | 2026-11-08 |
| DEC-14 | `noop-lane-nothing-to-do` is derived by dispatch outside the shared classifier; harness-path `noop-lane-permission` means spawn-refused | The shared projection has six outcome rows and no nothing-to-do row; TDR-0010 binds the permission token's harness meaning | 2026-11-08 |
| DEC-15 | The production composition supplies the lane-launch planner and the lane executor; one-shot dispatch remains fully state-based with no daemon | The daemon seam is delivered but unfilled; dispatch must work in both modes and must not become daemon-dependent | 2026-11-08 |
| DEC-16 | Tracker/PR label migration at handover is out of scope; handover records authority only | No acceptance criterion requires the label set; adding it would expand the change into tracker writes | 2026-11-08 |
| DEC-17 | No new configuration keys are introduced; dispatch reuses the harness branch and the `lane` restart-budget and liveness keys | The policy already has data homes; a second key would create two sources of truth | 2026-11-08 |
| DEC-18 | New state kinds are additive inside the delivered state format; no migration and no schema bump | Matches the delivered queue, daemon, and economics additive-record pattern and keeps old readers working | 2026-11-08 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| Dispatch command family | New: one-shot dispatch, dual-run summary, divergence resolution, handover, reversal |
| Dispatch domain logic | New: truth-bound token derivation, evidence fold, window evaluation, gate predicate |
| State contracts and ledgers | Updated additively: three record kinds and the derived authority view |
| Error table and exit projection | Updated: two new dispatch rows; existing two retained; projection unchanged |
| CLI composition and entrypoint | Updated: dispatch added to the prompt-required set |
| Root and command help, reference page | Updated: new help entries and reference-page coverage |
| Daemon lane-executor composition | Updated: production planner and executor availability |
| Lane-executor adapter | Unchanged: reused as delivered |
| Configuration layer | Reused: harness branch and lane keys; no new key |
| Bash entry points | Updated narrowly: CLI-independent authority read and deprecation pointer |
| Seeded scenarios SC-M1-29 and SC-M1-30 | Updated: evidence-based gate assertions replace the stale window wording |
| Absence assertions | Retired or inverted: entrypoint composition, pilot isolation, harness review deferrals |
| Harness review deferrals record | Updated: F-9 production-consumer revisit recorded |
| GH-239 ticket body | Unchanged; remains stale on the two-week wording |
| Current-truth system specs | Unchanged here; reconciled in phase 7 |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** a configured harness and a canonical reference with a free repository lease, **when** `dispatch <ref>` runs, **then** it selects the harness from `--harness` when present and from configuration otherwise, rejects an unknown harness name at exit 1 with a classified input error, claims the repository lease through the scheduling engine, spawns a fresh session through the harness session port, and refuses at exit 1 on an active conflicting lease without spawning. | F-1, F-12, DM-5 |
| AC-F1-2 | **Given** a running session whose token delta, traffic, worktree activity, or prefill advances, **when** liveness evaluates, **then** the session is progressing and no stalled verdict is produced; **and given** all sourced readings absent, **then** the report says absent or unknown, never zero and never stalled; **and given** no progress while sourced readings exist across two consecutive evaluations, **then** the session may classify stalled, but elapsed time alone never does. | F-1, NFR-2 |
| AC-F1-3 | **Given** a completed dispatch, **when** it is classified, **then** the result token is one of the eleven TDR-0005 tokens, `partial` carries its `outcome`, and the envelope `data` carries `result`, `prUrl`, `phaseLedger`, `restarts`, `resumeAmplification`, `harness`, `handoverState`, and `outcome`; **and when** text mode is selected, **then** stdout carries exactly `result=`, `pr_url=`, `exit_code=`, `last_message=` in that order and no other key. | F-1, F-12, DM-5, NFR-1, NFR-4 |
| AC-F1-4 | **Given** a dispatch result, **when** the process exits, **then** `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `finished`, and `noop-lane-nothing-to-do` exit 0; `failed`, `max-restarts`, `partial`, `noop-lane-permission`, and a restart-budget or resume-economics refusal exit 1; `state-unverified` exits 2; and a failing run still emits a valid envelope with the full error fields. | F-1, F-2, F-12, NFR-1 |
| AC-F2-1 | **Given** a spawned session that exits 0 but leaves no branch commit, no PR, and no ledger progress, **when** classification runs, **then** the result is `failed` at exit 1, the missing artifact is named, and the attempt record is never success-classified; classification consults artifacts and truth, not the exit code. (SC-M1-27) | F-2, DM-1, EVT-1 |
| AC-F2-2 | **Given** a change with an open PR, an unresolvable PR URL, an already-merged PR, or a blocking tracker state, **when** truth is evaluated, **then** the result is respectively `pr-open`, `pr-open-unverified`, `merged`, or `blocked`; `merged` is emitted only after independently observing the merged state; `blocked` and tracker-derived tokens are corroborated by the tracker fact; and a missing tracker fact never becomes a clean success. (SC-M1-26) | F-2, DM-1, DM-8, EVT-1 |
| AC-F2-3 | **Given** a failed or unreadable ledger, tracker, artifact, or state read that prevents a verdict, **when** classification runs, **then** the result is `state-unverified` at exit 2 with a classified `dispatch.state-unverified` or delivered `state.*` identity and a remediation hint; it is never exit 0 and never silently `failed`. | F-2, F-12, NFR-1 |
| AC-F2-4 | **Given** any dispatch output, **when** the token is checked against the closed taxonomy, **then** no token outside the eleven appears, no projection or derivation class changes, harness-path `noop-lane-permission` is reported as spawn-refused, and `noop-lane-nothing-to-do` is derived only when the lane has no remaining work. | F-2, NFR-1, DEC-14 |
| AC-F3-1 | **Given** a lane blocked on a typed question and `--resume-prompt <text>` supplied, **when** the resume runs, **then** the existing lane is resumed through the harness session port, the resume mode is recorded, completed phases are not re-executed, and the lane continues from its ledger position; **and given** an adapter without resume injection, **then** the recorded mode is `resume-prompt-reentry` and the prefill cost is acknowledged in the record and output. (SC-M1-28) | F-3, DM-1, EVT-1, NFR-6 |
| AC-F3-2 | **Given** a delivery whose restart count is at `lane.restart-budget`, **when** another restart is attempted, **then** the attempt is refused at exit 1 with `dispatch.restart-budget-exceeded`, the delivered terminal exhaustion record is present, a typed escalation is surfaced, no spawn occurs, and the delivery is never silently requeued. | F-3, F-12, EVT-1, NFR-5 |
| AC-F3-3 | **Given** a resume that would re-pay prefill without sufficient unique progress, **when** resume economics evaluates, **then** it is refused at exit 1 with `dispatch.resume-uneconomical`; **and given** unreadable token or cost facts, **then** the attempt is refused or classified unevaluable rather than admitted; **and given** attach-and-continue is declared, **then** no restart ordinal is consumed. | F-3, F-12, NFR-1 |
| AC-F3-4 | **Given** an identical resume replay, **when** it runs again, **then** no duplicate restart ordinal is consumed, no completed phase is re-executed, and the second run converges on the same lane position without a second spawn. | F-3, NFR-6 |
| AC-F4-1 | **Given** any dispatch, **when** it finishes, **then** exactly one attempt record is appended with repository identity, reference, start and finish timestamps, harness, handover state, engine outcome and token, comparison token or explicit not-applicable marker, divergence reference, false-success classification, corroboration tri-state, and resume mode when applicable; no prompt, transcript, credential, or raw payload is present. | F-4, DM-1, DM-8, EVT-1, NFR-7, NFR-10 |
| AC-F4-2 | **Given** an engine token or outcome that disagrees with the independently derived comparison, **when** the attempt is recorded, **then** an open divergence record is appended; **and when** a resolution is recorded, **then** the divergence folds to resolved with the bounded note, principal, and timestamp, the original open record remains, and the summary reports both totals. | F-4, DM-2, EVT-2, DM-6 |
| AC-F4-3 | **Given** an engine success claim whose artifact, tracker, or CI truth contradicts it, **when** the attempt is recorded, **then** it is classified as a false-success incident with bounded evidence references, it is never counted clean, and it resets the evidence window's lower bound so the floor and class coverage must be re-accrued after it. | F-4, F-5, DM-1, DM-8, NFR-10 |
| AC-F4-4 | **Given** an attempt whose comparison or corroboration cannot be evaluated, **when** evidence is folded, **then** the attempt is recorded unevaluable with the classified state or provider identity, the gate does not treat it as clean, and a bounded read that omits evidence declares truncation instead of reporting zero. | F-4, F-5, NFR-5, NFR-10 |
| AC-F5-1 | **Given** a repository with accumulated evidence, **when** `dispatch dual-run summary --repo <repo>` runs, **then** it reports the window start and reason, elapsed days, counted deliveries, false-success incidents, divergences (reported, resolved, unresolved, identifiers), class coverage with missing classes, corroboration satisfaction, and the eligibility verdict. (SC-M1-30) | F-5, DM-6, DM-7 |
| AC-F5-2 | **Given** the summary evidence, **when** eligibility is computed, **then** it is true only when zero false-success incidents and zero unresolved divergences are in the window, all eleven classes are covered by counted dispatches, the floor is met, and every success-claimed counted dispatch is corroborated; otherwise it is false and every unmet condition is named. (SC-M1-30) | F-5, DM-7, DM-8, NFR-10 |
| AC-F5-3 | **Given** the exposure floor, **when** eligibility is computed, **then** `at least 20 counted dispatches` or `at least 7 consecutive UTC dates with at least one counted dispatch in the window` satisfies only the floor; neither alternative can substitute for class coverage, incident truth, or corroboration. | F-5, DM-7, DEC-10, DEC-12 |
| AC-F5-4 | **Given** an unreadable, torn, or truncated evidence read, **when** the summary runs, **then** it declares the degradation or truncation, does not fabricate zeros, and reports eligibility as unverifiable rather than eligible; an unresolvable repository identity is a clean refusal, not an empty success. | F-5, NFR-4, NFR-5 |
| AC-F6-1 | **Given** a repository whose evidence bar is unmet, **when** `dispatch handover <repo>` runs, **then** it refuses at exit 1 as a clean verification with a negative verdict, names every unmet condition, appends no authority-changing record, and leaves the bash stack authoritative. (SC-M1-29) | F-6, DM-7, EVT-3 |
| AC-F6-2 | **Given** a repository whose evidence bar is met, **when** `dispatch handover <repo>` runs, **then** it appends one handover record with the conditions snapshot and evidence references, flips only that repository to `authoritative`, updates the derived authority view atomically, reports the flip as recorded and reversible, and leaves every other repository in `dual-run`. (SC-M1-29) | F-6, DM-3, DM-4, EVT-3 |
| AC-F6-3 | **Given** an engine-authoritative repository, **when** `dispatch handover <repo> --revert` runs, **then** it appends a reversal record, restores `dual-run`, preserves the full handover history, and returns the repository to bash-authoritative; **and when** the repository is already in `dual-run`, **then** it is an idempotent noop at exit 0. | F-6, DM-3, DM-4, EVT-3, NFR-6 |
| AC-F6-4 | **Given** the derived authority view, **when** it is compared with the folded handover ledger after any flip or reversal, **then** it names the repository, authority, handover reference, recorded time, and reversal availability; it is replaced atomically; and an absent, unreadable, or malformed view resolves to `dual-run`. | F-6, F-7, DM-4, NFR-5 |
| AC-F6-5 | **Given** a repository in `dual-run`, **when** a dispatch runs, **then** it reports `handoverState: "dual-run"`, records evidence, does not claim authority, does not suppress or block the bash stack, and fires no merge; authority changes only through a recorded handover. | F-6, F-9, DM-5, DEC-3 |
| AC-F7-1 | **Given** a dual-run repository, **when** any of the four bash entry points runs, **then** it runs with its existing arguments and exit behavior, prints no deprecation pointer, and requires no typed CLI invocation. | F-7, NFR-8 |
| AC-F7-2 | **Given** an engine-authoritative repository, **when** any of the four bash entry points runs, **then** it prints a deprecation pointer naming `dispatch` and the reversal surface, remains executable as fallback, and does not refuse merely because authority moved. | F-7, NFR-8 |
| AC-F7-3 | **Given** the typed CLI is absent, uninstalled, or broken, **when** any of the four bash entry points runs, **then** it runs normally; authority detection is a pure file read with no typed CLI invocation, and an absent, unreadable, or malformed authority view means dual-run. | F-7, NFR-8 |
| AC-F8-1 | **Given** a controlled test repository or controlled fixture with genuine harness, tracker, CI, and state ports, **when** dispatches accrue until the gate is met and `dispatch handover` runs, **then** the repository flips to authoritative, a subsequent dispatch runs end to end through the typed stack with a valid token, summary, and attempt record, and no step hand-inserts evidence into the ledger. (SC-M1-29) | F-8, F-1, F-5, F-6 |
| AC-F8-2 | **Given** the handed-over controlled repository, **when** `dispatch handover <repo> --revert` runs and a bash entry point is invoked, **then** the repository is back in dual-run, the bash path runs normally, and the handover and reversal records remain in history. (SC-M1-29) | F-8, F-6, F-7 |
| AC-F9-1 | **Given** a completed dispatch whose PR is merge-ready, **when** the command completes, **then** it emits `pr-open` or `pr-open-unverified` and fires no merge; no merge port or merge code path is reachable from dispatch composition, and a structural boundary check proves the absence. | F-9, NFR-9 |
| AC-F9-2 | **Given** a change whose PR was already merged independently, **when** dispatch evaluates truth, **then** it may report `merged` as already-merged detection, with the observed merged evidence recorded, and it still fires no merge. | F-9, DM-1, NFR-9 |
| AC-F10-1 | **Given** a `LaneLaunchRequest` and the production composition, **when** the lane-launch planner plans, **then** it returns the lifecycle prompt and the declared execution-environment allowlist, resolves no secret value, and `createLaneExecutor` reports available with the selected harness session port and descriptor. | F-10, F-1, NFR-7 |
| AC-F10-2 | **Given** a running daemon and a planned lane, **when** the daemon supervises, **then** it starts the lane through the executor, records the delivered lane record, observes progress, collects the outcome, and can resume through the executor; the final token and outcome agree with a one-shot dispatch over the same evidence. | F-10, F-1, EVT-1 |
| AC-F10-3 | **Given** no daemon, **when** `dispatch <ref>` runs, **then** it completes from state alone, appends the attempt record, and does not fail, idle, or claim a daemon dependency (SC-M1-17 continuity); an unavailable planner or declared capability gap leaves the daemon in honest supervise-only mode. | F-10, F-1, NFR-6 |
| AC-F11-1 | **Given** the delivered CLI, **when** the prompt-required set, root help, command help, and reference page are inspected, **then** `dispatch` is present with its three execution forms plus resolution and reversal, the help entry points at the reference page, and the reference page describes the evidence-based handover bar rather than the stale two-week window. | F-11, DEC-1, DEC-4 |
| AC-F11-2 | **Given** `--help` or `--version`, **when** rendered, **then** it performs no state, network, git, configuration, or model read and exits 0; help remains a pure data lookup. | F-11, NFR-3 |
| AC-F11-3 | **Given** the three delivered absence assertions (entrypoint composition, pilot isolation, harness review deferrals), **when** the change lands, **then** each is retired or inverted to assert the delivered dispatch surface; the F-9 host-runner deferral records the production-consumer outcome of dispatch and is no longer a blanket "no dispatch surface" claim. | F-11, F-12, DEC-4 |
| AC-F12-1 | **Given** a spawn failure before a session exists, **when** it is classified, **then** it carries `dispatch.session.spawn-failed` at exit 1; **and given** an unverifiable dispatch truth read, **then** it carries `dispatch.state-unverified` at exit 2; both rows are present in the machine and documented tables. | F-12, NFR-1 |
| AC-F12-2 | **Given** the dispatch error rows, **when** classification runs, **then** `dispatch.restart-budget-exceeded` and `dispatch.resume-uneconomical` remain unchanged, every dispatch failure resolves by exact code, and no kind-only dispatch discriminant is assumed to resolve to a single row. | F-12, NFR-1 |
| AC-F12-3 | **Given** any dispatch failure, **when** the envelope is emitted, **then** the error carries a stable code, category, retryable flag, consequence, remediation hint, and summary; prose never substitutes for identity, and no exit outside 0, 1, or 2 is produced. | F-12, NFR-1 |
| AC-NFR1-1 | **Given** the implemented dispatch path, **when** the token set and exit projection are checked structurally, **then** the emitted token set is a subset of the eleven declared tokens, no new token literal exists outside the contracts home, and no call-site exit literal exists outside the projection module. | NFR-1 |
| AC-NFR4-1 | **Given** a large repository evidence set, **when** summary or handover runs, **then** the read is bounded, any truncation is declared, machine output stays within 65,536 bytes, human output stays within 40 lines and 8,192 bytes, and the p95 summary latency stays within 5 s on the reference host. | NFR-4 |
| AC-NFR6-1 | **Given** an identical replay of summary, handover, reversal, or resume, **when** it runs again, **then** no duplicate record is appended, the authority state is unchanged, and a `noop` is reported where nothing changed. | NFR-6 |
| AC-NFR7-1 | **Given** any dispatch output, record, help page, or spawn environment, **when** it is scanned, **then** no secret, credential value, prompt, transcript, diff, or raw provider payload is present, and every child environment variable is declared in the harness allowlist. | NFR-7 |
| AC-NFR8-1 | **Given** the four bash entry points, **when** they run in dual-run and authoritative modes and with the typed CLI absent, **then** all twelve combinations (four scripts × three conditions) complete with the declared behavior, no new required argument, and no typed CLI dependency for the fallback decision. | NFR-8 |
| AC-NFR9-1 | **Given** the production dispatch composition, **when** the dependency boundary and reachability checks run, **then** no merge executor, merge port, or merge invocation is reachable; a source-level merge import from any dispatch path fails the boundary check. | NFR-9 |

### 17.1 Definition of Done

- [ ] Every acceptance criterion above is verified against the implementation, not against intent.
- [ ] The token set is compared mechanically with `DELIVERY_RESULT_TOKENS`: 11 of 11, 0 outside.
- [ ] The four-key summary order is asserted in a test, and no fifth key is emitted.
- [ ] The dispatch error rows are sync-checked in both directions between the machine table and the documented table.
- [ ] The three absence assertions are retired or inverted, and the F-9 deferral record is updated with the production-consumer outcome.
- [ ] The controlled-repository proof runs the full path: evidence, eligibility, handover, authoritative dispatch, reversal.
- [ ] The bash combinations (four scripts × dual-run, authoritative, typed CLI absent) are exercised.
- [ ] All four conditions and the floor-only rule are asserted through the summary and handover, not just documented.
- [ ] The reference page and SC-M1-29/SC-M1-30 are reconciled with the evidence-based bar.
- [ ] The GH-239 ticket body and the remaining planning residual are reported, not edited.
- [ ] No `doc/spec/**` file is modified in this change.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

The change lands as one delivery on the integration branch. Immediately after merge, every repository remains in `dual-run`: the command is registered and usable, but it claims no authority and never merges while a repository is in dual-run. Evidence accrual begins on pilot work items; the bash stack remains authoritative and can continue to deliver. The summary is the operational instrument for reading exposure, and handover is a separate, reversible act for one repository at a time after real evidence is met.

No feature flag is required: `handoverState` is data, and the default when no handover record exists is `dual-run`. The bash deprecation pointer appears only after a repository is flipped, so no repository sees changed bash behavior at merge. Reversal is always available and preserves history. The owner or coordinator decides when real accrual starts and when a repository is flipped; this change does not perform either act. A controlled repository or fixture proves the full cycle in CI.

Communication: the reference page and help describe the command and the evidence bar; the GH-239 ticket body and the remaining planning residual are reported as stale, not edited; the first real handover is announced with the recorded conditions snapshot so the evidence is auditable.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The three record kinds and the derived authority view are additive inside the delivered state format; no schema bump, migration, backfill, or seed set is required. Evidence recorded before this change, including bash delivery logs and tracker history, is not imported or re-scored: only dispatches produced after the change can carry an engine/comparison pair. Existing records and derived documents are untouched. A repository with no handover record reads as `dual-run`.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal, private, or credential data is added. Attempt records carry repository, reference, timestamps, tokens, outcomes, and bounded evidence references; they carry no prompt, transcript, diff, message body, or credential value. `last_message` is bounded and redacted before output and record. The derived authority view carries repository identity and authority only. Existing file-permission and same-user state-directory assumptions are unchanged. No new compliance obligation, consent, retention, or cross-border data flow is introduced.

## 21. SECURITY REVIEW HIGHLIGHTS

- Authority transfer is a trust boundary. The handover ledger, the conditions snapshot, the recording principal, and the reversal record make the decision auditable and reversible; the gate cannot be passed by an engine-claimed success alone.
- The spawn environment remains deny-by-default: the planner returns declared variable names, the descriptor is the only environment source, credentials resolve through the credential port at use time, and no secret enters a record or output.
- Dispatch has no merge authority and no merge code path. `merged` is detection only.
- Bash fallback reads a derived document with filesystem permissions as its authorization boundary; a write to that document is equivalent to an authority change and is protected by the state fence and directory permissions.
- The authority view is per state directory; cross-host sharing is explicitly out of scope and must not be implied by the record.
- Stable error identities and classified consequences prevent a failed spawn or unverifiable read from masquerading as a success or a permission verdict.
- No prompt injection surface is added: the resume prompt is data passed through the adapter, and the harness classification remains a pure function of neutral evidence.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The gate predicate has one declared home; the summary and handover evaluate the same predicate, so a future change cannot drift one without the other.
- Adding a TDR-0005 token requires a gate update in the same change; the class coverage is intentionally total, so the old enumeration becomes incomplete by design.
- The help entry and reference page must stay in sync with the command grammar, including the resolution and reversal surfaces added by this story.
- The derived authority view is rebuildable from the handover ledger; if it is lost or malformed, the safe default is dual-run and the next handover or reversal rewrites it.
- Dispatch evidence grows with every run. Retention and compaction are deferred; operators should expect the bounded summary read to declare truncation rather than silently omit old evidence.
- The F-9 host-runner deferral is revisited here because dispatch is the first production consumer; the deferral record must state whether the production consumer resolves it or requires a follow-up.
- The four bash entry points remain a maintained fallback until a repository is handed over; after handover they are a fallback and deprecation surface, not the primary path.
- Phase 7 must reconcile the current-truth specs that this change makes stale: the CLI entrypoint page (which states dispatch is not registered), harness adapters (dispatch consumer), resident daemon (planner seam now filled), scheduling engine (dispatch consumer), result contract and exit taxonomy (dispatch result derivation), session lifecycle economics (resume integration), and verify-change (comparison baseline).

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Authority (handover state) | Whether a repository is `dual-run` (bash authoritative, dispatch evidence only) or `authoritative` (dispatch authoritative, bash fallback). |
| Attempt record | The durable per-dispatch evidence record (DM-1 / EVT-1). |
| Clean dispatch | A counted dispatch with no false-success incident, no unresolved divergence, and corroboration satisfied for its outcome family. |
| Comparison token | The token independently derived from verify-change ledger truth or tracker truth for the same dispatch, used for token-level parity. |
| Corroboration | Agreement between an engine claim and independent truth: completed pm-notes phases, tracker state, and CI on the pushed head. |
| Counted dispatch | A recorded dispatch on a pilot path in the evidence window with a complete comparison field and a corroboration tri-state; fixture or smoke runs are excluded. |
| Divergence | A disagreement between the engine result and the comparison token; open until an explicit resolution record. |
| Dual-run | The mode in which dispatch runs beside the bash stack, records evidence, claims no authority, and never merges. |
| Evidence window | The dispatch evidence evaluated by the gate: from the later of the first counted dispatch and the most recent false-success incident, up to evaluation time. |
| Exposure floor | At least 20 counted dispatches or at least 7 consecutive UTC dates with at least one counted dispatch, whichever comes first; it binds only the floor. |
| False-success incident | A claimed successful outcome contradicted by artifact, tracker, or CI truth. |
| Handover | The recorded, reversible act that makes the engine authoritative for one repository. |
| Handover gate | The four-condition conjunction in DM-7 / Section 5.1 F-5. |
| Pilot path | A real repository work item used for dual-run evidence, as opposed to a fixture or smoke run. |
| `resume-prompt-reentry` | The resume mode used when the harness adapter lacks resume injection; the lane is re-entered with a prompt and the prefill cost is acknowledged. |
| Spawn-refused | The harness-path meaning of `noop-lane-permission`: the harness refused before a session existed; it is not a lane-permission policy verdict. |
| `state-unverified` | The result token for an unverifiable truth read; it exits 2, deliberately diverging from bash's exit 1. |
| TDR-0005 | The decision record adopting the eleven-token delivery-result vocabulary and token-level dual-run parity. |
| TDR-0010 | The decision record ratifying the dispatch-session outcome-to-token projection and its two consumer rules. |

## 24. APPENDICES

### Appendix A — Closed token taxonomy (TDR-0005, unchanged)

| Token | Projection class | Exit | Derivation class |
|---|---|---|---|
| `merged` | success | 0 | tracker-pr |
| `blocked` | success | 0 | tracker-pr |
| `pr-open` | success | 0 | tracker-pr |
| `pr-open-unverified` | success | 0 | tracker-pr |
| `failed` | user-validation | 1 | verify |
| `finished` | success | 0 | verify |
| `max-restarts` | user-validation | 1 | dispatch-session |
| `state-unverified` | platform-provider | 2 | verify |
| `partial` | user-validation | 1 | verify |
| `noop-lane-permission` | user-validation | 1 | dispatch-session |
| `noop-lane-nothing-to-do` | success | 0 | dispatch-session |

### Appendix B — Handover predicate, restated for evaluation

Eligibility is true only when all of the following hold inside the current evidence window:

1. **Incident and divergence truth**: zero false-success incidents and zero unresolved divergences on the repository's pilot paths.
2. **Class coverage**: the set of result tokens across counted dispatches equals the eleven-token TDR-0005 set; every missing class is named.
3. **Exposure floor**: at least 20 counted dispatches or at least 7 consecutive UTC dates with at least one counted dispatch, whichever comes first. This condition is floor-only; it never substitutes for 1, 2, or 4.
4. **Corroboration**: every success-claimed counted dispatch has the evidence its outcome family requires; a `merged` claim needs the pushed head, CI on that head, tracker state, and completed phases; a tracker-derived claim (`pr-open`, `blocked`, `pr-open-unverified`) needs the tracker fact; a `finished` claim needs the completed phase ledger; a `noop-lane-nothing-to-do` claim needs the ledger or queue fact that no work remains; an engine token alone never suffices.

An unevaluable, truncated, or unreadable evidence set makes eligibility unverifiable, never eligible. The window never begins before the most recent false-success incident, so an incident cannot sit inside an eligible window.

### Appendix C — Seeded scenario inheritance

| Scenario | Inherited assertion | Reconciliation note |
|---|---|---|
| SC-M1-26 | Happy-path classification is `pr-open` with the four key=value keys matching the bash shape and token parity with TDR-0005 | Unchanged in substance; the attempt record and `outcome` field are additive. |
| SC-M1-27 | Exit-0-with-no-artifact classifies `failed` at exit 1 and names the missing artifact | Unchanged; the attempt record adds the durable incident/evidence field. |
| SC-M1-28 | Resume mode records `resume-prompt-reentry`, acknowledges prefill cost, and does not re-execute completed phases | Unchanged; the resume mode is also on the attempt record. |
| SC-M1-29 | Handover flips one repository and leaves the other authoritative state untouched | The parenthetical two-week window is superseded by the four-condition evidence bar (DEC-1); the test plan must assert the evidence gate, not the calendar proxy. |
| SC-M1-30 | Summary counts days, deliveries, incidents, divergences and states eligibility; unresolved divergence blocks | Unchanged in substance; the summary additionally reports class coverage, corroboration, window start and reason, and named unmet conditions. |

### Appendix D — Bash-continuity summary

Text mode emits, in order:

```
result=<one of the eleven tokens>
pr_url=<url or empty>
exit_code=<0|1|2>
last_message=<bounded, redacted, single line>
```

The bash implementation also emits an additive `closeout_unverified=` key between `exit_code=` and `last_message=`. That key is bash-internal metadata, not part of the declared four-key M1 continuity contract; dispatch expresses unverified outcomes through `pr-open-unverified` and `state-unverified` (DEC-8).

### Appendix E — PM binding decisions

- **D1**: The amended backlog evidence bar is the gate definition; the ticket body's two-week wording is stale and must not be implemented.
- **D2**: Deliver the mechanism, gate, records, and controlled proof; flipping this repository is an operational act after real pilot evidence and out of PR scope.
- **D3**: The comparison baseline is the token independently derived by verify-change (ledger/tracker truth); "bash authoritative" in dual-run means dispatch never claims authority and never merges, not that both stacks deliver the same ticket twice.
- **D4**: `dispatch` joins the prompt-required composition; help and reference-page coverage are updated, and the absence tests are retired or inverted.
- **D5**: The dependency set (M0-S8, M1-S11, M1-S17, M1-S18) is delivered on the integration branch.

### Appendix F — Sources

- GH-239 ticket body and pinned decisions (the body's two-week wording is stale per D1).
- `doc/planning/oss-tooling/backlog.md` M1-S9 entry (canonical, amended by GH-266).
- `doc/changes/2026-11/2026-11-07--GH-266--evidence-based-handover-gate/chg-GH-266-spec.md` (CEO-D-073 amendment).
- `doc/planning/oss-tooling/milestones/m1/commands/dispatch.md`, `contracts.md` §dispatch, `test-scenarios.md` SC-M1-26..30, `interactions.md` Session G, `architecture.md` dispatch fallback table.
- `doc/decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md`; `doc/decisions/TDR-0010-dispatch-session-classification-token-projection.md`.
- Delivered infrastructure: harness session port and adapters, scheduling queue and lease contracts, daemon lane-executor seam and reconciliation, result contract, error table, state append/read/fence and ledgers, economics budget/resume, verify-change evaluation, config catalog/defaults, CLI composition/help, bash entry points.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-08 | @spec-writer | Initial specification for GH-239 (M1-S9), authored from the GH-239 ticket, the amended backlog, GH-266, the M1 dispatch contract and scenarios, TDR-0005/TDR-0010, and the delivered infrastructure. |

---

## AUTHORING GUIDELINES

- Authored from the GH-239 ticket body and pinned decisions, the PM clarify-scope binding decisions D1-D5, the canonical amended backlog entry, the GH-266 amendment spec, the M1 dispatch command/contract/scenario/architecture documents, TDR-0005 and TDR-0010, and direct reads of the delivered harness, scheduling, daemon, result, state, economics, verify-change, config, and CLI-composition contracts.
- The template at `doc/templates/change-spec-template.md` governed structure; every section is present in order, and the Definition of Done lives under Section 17 so the mandated ordering is preserved.
- Scope was deliberately kept to the mechanism, evidence, gate, records, proof, and registration. Flipping a real repository, real evidence accrual, coordinator supervision, label migration, cross-host authority, and current-truth doc reconciliation are explicitly excluded.
- The ticket body's superseded two-week definition is recorded as stale and is not implemented; every gate criterion traces to the amended backlog and GH-266.
- Line-level implementation choices (exact record keys, file names, module boundaries, test file changes) were left to the plan; this spec names contracts, behaviors, identities, and acceptance conditions only.
- Judgment calls that the test-plan and plan writers must honor are recorded as decisions: the four-key summary (DEC-8), the reversal and resolution surfaces (DEC-6, DEC-7), the family-wise comparison baseline (DEC-3), the incident-reset window (DEC-10), the UTC day floor (DEC-12), and the repository identity rule (DEC-13).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-239)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, EVT-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/EVT- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs beyond the minimal token table, the four-condition restatement, and the bash summary shape
- [x] Front matter validates per front_matter_rules
