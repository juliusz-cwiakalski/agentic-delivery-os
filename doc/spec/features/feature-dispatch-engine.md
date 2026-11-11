---
ados_distribution: internal
id: SPEC-DISPATCH-ENGINE
status: Current
created: 2026-11-08
last_updated: 2026-11-11
owners: ["engineering"]
service: delivery-os
summary: "The typed per-ticket dispatch engine: the `dispatch` command family (`dispatch <ref>`, `dispatch dual-run summary|resolve`, `dispatch handover [--revert]`), harness resolution, the optional admission preflight (truth-read credential resolution plus one bounded work-item read) with status-keyed refusal identities, queue-lease claim, spawn or resume through the harness session port with handle acquisition before completion, progress-based liveness, artifact-first truth derivation into the closed TDR-0005 vocabulary, bash-continuity text and machine envelopes, the pinned failure-token mapping, durable attempt/divergence/handover records including the locally resolvable delivered-evidence divergence, the derived per-repository authority view, evidence-class counting and the incident-exclusive four-condition handover gate, the production composition of the evidence gate, the resume lane and restart-budget path and the rename-invariant identity resolver with its checkout-scoped first-use marker, the factory-proven daemon lane seam with the daemon-path attempt producer, and the CLI-independent bash fallback authority read."
links:
  related_changes: ["GH-239", "GH-275", "GH-277", "GH-279", "GH-280", "GH-286", "GH-288"]
  related_decisions: ["TDR-0015", "TDR-0005", "TDR-0010", "ADR-0008", "TDR-0016", "TDR-0019", "TDR-0020", "TDR-0021"]
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/delivery-result.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/core/src/app/dispatch-gate.ts"
    - "packages/core/src/app/daemon-dispatch-result.ts"
    - "packages/core/src/domain/lane-launch-plan.ts"
    - "packages/adapters/src/file/dispatch-identity.ts"
    - "packages/adapters/src/repo/index.ts"
    - "packages/cli/src/commands/dispatch.ts"
    - "packages/cli/src/output/dispatch-text.ts"
    - "packages/cli/src/production.ts"
    - "scripts/lib/dispatch-authority.sh"
---

# Feature: Dispatch Engine

## Overview

The dispatch engine is the typed per-ticket delivery path. One invocation resolves a harness, validates its input, runs the admission preflight, claims the repository's queue lease, spawns or resumes the lifecycle session through the delivered harness session port, watches it with progress-based liveness, classifies the terminal outcome through the shared harness classifier, and derives the final delivery token from artifact, ledger, tracker, and CI truth rather than from an exit code. Every dispatch that reaches classification appends one durable attempt record, so the engine accrues dual-run evidence beside the bash stack.

A repository is either `dual-run` (bash authoritative, dispatch evidence only) or `authoritative` (dispatch primary, bash fallback). Authority changes only through a recorded, reversible handover that evaluates the four-condition evidence gate. The derived per-repository authority view is a plain file the bash entry points read without invoking the typed CLI, so the fallback keeps working when the typed stack is unavailable.

`dispatch` is part of the prompt-required CLI composition and has root help, command help, and reference-page coverage. The same harness session port, classifier, truth derivation, and attempt-record ledger serve one-shot dispatches and daemon-driven lanes.

The shipped production composition wires the one-shot run path with its admission preflight, the evidence-gate runtime (`dual-run summary`, `dual-run resolve`, and `handover [--revert]`), the resume lane and restart-budget facts, and the repository identity resolver with its checkout-scoped first-use marker. The daemon lane seam is composed at the CLI/daemon factory; the production composition mounts the daemon family without a lane composition, so supplying that seam remains resident-daemon production scope (GH-238).

## Command grammar

| Invocation | Purpose |
|---|---|
| `dispatch <ref> [--harness <name>] [--resume-prompt <text>]` | Run one dispatch, or resume the existing lane with operator guidance. |
| `dispatch dual-run summary --repo <repo>` | Report the evidence window, class coverage, divergences, corroboration, and the four-condition verdict. |
| `dispatch dual-run resolve <divergence-id> --note <text>` | Append a bounded resolution to an open divergence. |
| `dispatch handover <repo> [--revert]` | Flip one repository to engine-authoritative, or append a reversal back to dual-run. |

A work-item reference matches `[A-Z]+-\d+`. The harness resolves from `--harness` when supplied and from the typed harness configuration otherwise; an unknown harness name is an input refusal. Grammar runs before any runtime call, and the handler returns data or a classified failure rather than choosing an exit digit.

Five kinds of refusal happen before any session attempt exists: an unknown harness, rejected input, an admission preflight refusal (an unresolvable truth-read credential or a failing bounded admission read), an active owner hold, and a conflicting lease. Each emits the classified top-level error envelope with its mapped identity and exit and appends no attempt record; the admission preflight is the only one whose exit can be `2`. Every failure after the lease claim is an attempt-stage failure and appends exactly one attempt record with its pinned token and outcome.

## One-shot dispatch

1. **Resolve the harness.** The flag wins over configuration; the selected adapter supplies spawn, resume, observe, collect, and liveness capabilities and its declared gaps.
2. **Run the admission preflight.** After the harness resolves and input validates, the preflight resolves the declared truth-read credential and performs one bounded work-item read. A refusal here is pre-session: no lease, spawn, resume, or record.
3. **Claim the lease.** The scheduling engine claims the repository-exclusive lease for the reference. An active owner hold refuses `queue.precondition.unmet` with reason `owner-hold` before the claim and opens no lease, spawn, resume, or record. A live conflicting lease refuses at exit `1` without spawning.
4. **Spawn or resume.** A fresh run spawns through the harness session port. An opencode spawn returns its handle as soon as the first identified stream line arrives, before the session completes, and a resume acquires the same way while preserving the existing session identity; a Claude Code spawn returns its handle when the bounded one-shot invocation completes. `--resume-prompt` resolves the existing lane, records the resume mode (`attach-continue`, or `resume-prompt-reentry` with its acknowledged prefill cost when the adapter lacks resume injection), and continues from the phase-ledger position. Completed phases are skipped idempotently.
5. **Watch with progress-based liveness.** Token delta, session traffic, worktree activity, or prefill advancement anywhere in the observed session tree counts as progress. A stall requires two consecutive sourced evaluations with no advance; a bare elapsed timer never stalls a lane. An absent reading stays absent or unknown and is never coerced to zero. The evaluation cadence is `lane.liveness-interval`. In the shipped composition the watch polls at that cadence while evidence collection is pending, records the observed verdict trail as bounded `liveness:<verdict>` evidence, and cancels its timer when collection finishes. A stall is a current-state verdict, not a latch: any later advancing observation clears it, so a transient mid-run stall stays recorded as liveness evidence and the collected evidence still classifies normally.
6. **Admit restarts and resumes.** Restart admission delegates to the delivered restart-budget gate with the bound from `lane.restart-budget` and the persisted restart count. At or above the bound, an attempt whose session has not completed refuses `dispatch.restart-budget-exceeded` with result token `max-restarts`, outcome `failed`, exit `1`, one attempt record, the delivered terminal exhaustion record, and a typed escalation; a completed harness session keeps its own classification and is never re-keyed to a restart refusal by an already-reached bound. Resume economics delegates to the delivered admission: attach-and-continue consumes no restart ordinal, an uneconomical prefill re-pay refuses `dispatch.resume-uneconomical` with token `failed`, outcome `failed`, exit `1`, and one attempt record, and unreadable token or cost facts refuse rather than admit. A stall that is still current when evidence collection resolves is routed through the same restart-admission gate: at or above the bound the attempt is the restart-budget refusal with no second spawn; below the bound the stall is recorded and left to lane supervision, because the delivered session port exposes no kill operation and the command never leaks a silent second session.
7. **Classify and derive truth.** The shared classifier yields a harness outcome and token; truth derivation then decides the final token from branch commits, PR state and URL, ledger progress, tracker state, and CI. A success claim is never accepted on an exit code alone.
8. **Record and render.** One attempt record is appended under the state fence, and the command renders either the four-key bash-continuity text (which gains one bounded `detail:` prose line in verbose human mode) or the machine envelope.

## Admission preflight

The engine exposes an optional `preflight` port, distinct from `ports.admission` (the delivered pre-spawn decision whose refusal still records an attempt pair). It runs after harness resolution and input validation and before `claimLease`, spawn, or resume, and it appends no attempt, divergence, handover, or authority record. Production composition always supplies it; a direct engine caller may omit it and keep the delivered run order.

The preflight resolves the declared truth-read reference (`github-read` over the environment key `GITHUB_TOKEN`) and performs one bounded work-item read. A credential refusal is name-only: one bounded single-line summary names the fully derived source key (a literal reference verbatim; an environment-prefixed reference as prefix plus suffix) and the reference name, never the value. When the credential is unresolvable the preflight issues no request at all; when it resolves, admission makes exactly one bounded read with no pagination, retry, or concurrent read, and it adds no configuration key. The preflight classifies the read itself from the failure's optional status instead of forwarding the adapter identity:

| Condition | Identity | Kind | Projection | Exit |
|---|---|---|---|---|
| Credential unresolvable | `config.credential.missing` | `config` | user-validation | 1 |
| Status 401 or 403 | `provider.auth.rejected` | `provider` | user-validation | 1 |
| Status 5xx or any other status-bearing non-2xx | `provider.outage` | `provider` | platform-provider | 2 |
| No status (transport throw or timeout) | `provider.outage` | `provider` | platform-provider | 2 |
| Malformed 2xx payload (status present) | `provider.payload.invalid` | `provider` | platform-provider | 2 |
| Status 404 | `input.value.rejected` | `input` | user-validation | 1 |

The 404 summary states that the provider reported the work item absent for this credential and names the reference; it does not assert that the reference is wrong, because an item the credential cannot see answers 404 exactly like an absent one. The engine result error-kind union admits the existing `provider` and `config` kinds additively; `DOMAIN_KINDS`, the error-table row count, the tokens, the projections, and the exits are unchanged. The credential refusal carries a narrow trusted-refusal marker that the CLI classifier honours only for `config.credential.missing`, so the bounded identifier-only summary reaches both machine and human output without reopening the untrusted-config suppression. The preflight applies to a fresh dispatch and to a resume alike; daemon-driven lane launches do not run it. The supported operator provisioning path is documented in [Tracker Credential Provisioning](../../guides/tracker-credential-provisioning.md).

## Result derivation and exit projection

Result derivation is artifact-first:

- An exit-0 session with no branch commit, no PR, and no ledger progress is `failed`; the missing artifact is named.
- An open PR is `pr-open`; an open PR whose URL cannot be resolved is the result token `pr-open-unverified`. The independent tracker comparison token for either is `pr-open`, and URL resolution is the comparison's `urlResolved` attribute (`false` for `pr-open-unverified`). URL resolution never changes the compared token and never creates a divergence.
- An independently observed merged PR or branch is `merged` as already-merged detection only.
- A tracker state that blocks delivery is `blocked`.
- A lane with nothing left to do is `noop-lane-nothing-to-do`, derived outside the shared classifier.
- A harness spawn refusal before a session exists is a recorded attempt with token `noop-lane-permission` and outcome `refused`; from the harness path the token means spawn-refused, never a lane-permission policy verdict.
- A failed ledger, tracker, artifact, or state read that prevents a verdict is `state-unverified` at exit `2`.

The closed eleven-token vocabulary and projection are unchanged:

| Token | Projection class | Exit | Derivation class |
|---|---|---|---|
| `merged` | success | 0 | `tracker-pr` |
| `blocked` | success | 0 | `tracker-pr` |
| `pr-open` | success | 0 | `tracker-pr` |
| `pr-open-unverified` | success | 0 | `tracker-pr` |
| `failed` | user-validation | 1 | `verify` |
| `finished` | success | 0 | `verify` |
| `max-restarts` | user-validation | 1 | `dispatch-session` |
| `state-unverified` | platform-provider | 2 | `verify` |
| `partial` | user-validation | 1 | `verify` |
| `noop-lane-permission` | user-validation | 1 | `dispatch-session` |
| `noop-lane-nothing-to-do` | success | 0 | `dispatch-session` |

`partial` always carries its harness `outcome`; the machine envelope therefore always carries `outcome` beside `result`.

### Failure-token mapping

Every dispatch failure identity pins one result token, one engine outcome, one exit, an attempt-record policy, and a comparison treatment. No row adds a token or changes a projection or derivation class.

| Failure class | Attempt record | Result token | Outcome | Exit | Comparison record |
|---|---|---|---|---|---|
| `dispatch.session.spawn-failed` | exactly one | `failed` | `failed` | 1 | not applicable, token null, reason `comparison-source-unavailable` |
| `dispatch.restart-budget-exceeded` | exactly one | `max-restarts` | `failed` | 1 | not applicable, token null, reason `dispatch-session-family` |
| `dispatch.resume-uneconomical` | exactly one | `failed` | `failed` | 1 | not applicable, token null, reason `comparison-source-unavailable` |
| Post-spawn `harness.collect` failure (a session existed but its evidence could not be read) | exactly one | `state-unverified` | `failed` | 2 | not applicable, token null, reason `comparison-source-unavailable` |
| Harness spawn refusal (no error identity) | exactly one | `noop-lane-permission` | `refused` | 1 | not applicable, token null, reason `dispatch-session-family` |
| Unknown harness, rejected input, an active owner hold, or a conflicting lease before a spawn | none | none (an owner hold carries `queue.precondition.unmet` with blocking reason `owner-hold`) | none | 1 | none |
| Credential or admission-read refusal before a spawn | none | none (the top-level error carries the mapped identity) | none | 1 or 2 per the admission table | none |

All five recorded failure classes count for class coverage as exposure, make no success claim, create no divergence, and block nothing. The post-spawn collection failure is attempt-stage because a session existed; the engine records the unevaluable attempt at exit `2` instead of returning it unrecorded, and it is not one of the five pre-session refusal kinds.

### Text and machine output

Text mode emits exactly four ordered keys:

```
result=<one of the eleven tokens>
pr_url=<url or empty>
exit_code=<0|1|2>
last_message=<bounded, redacted, single line>
```

The bash-internal `closeout_unverified=` key is not part of this contract; dispatch expresses unverified outcomes through `pr-open-unverified` and `state-unverified`.

Without `--verbose`, human text is exactly those four keys. With `--verbose`, the dispatch human-text selection renders the same four keys and, when the result carries the pre-session failure detail, appends one bounded `detail:` prose line naming the underlying harness failure `kind` and `code`, and the field when the failure carries one. The appended line is not a `key=value` line, so the non-verbose four-key contract is unchanged.

Machine mode renders the standard command envelope. Dispatch `data` carries `result`, `prUrl`, `phaseLedger` (`completed`, `total`, `variant`), `restarts`, `resumeAmplification`, `harness`, `handoverState`, `outcome`, and `lastMessage`, plus a bounded `truncation` marker when a field is cut. An attempt-stage classified failure that carries an error identity is a data-bearing success envelope: the top-level envelope carries no `error`, while `data.error` carries the full error-table fields (`code`, `category`, `retryable`, `consequence`, `remediationHint`, and `summary`) beside `data.result` and `data.outcome`; consumers read `data.result` and `data.error` together. A recorded harness spawn refusal is a data-bearing success envelope with `data.result` and `data.outcome` and no error identity to nest. A pre-session refusal uses the standard top-level error envelope instead.

A pre-session spawn failure types `data.error` as `DispatchEnvelopeError`: the delivered `CommandResultError` fields plus an additive `detail` carrying the underlying harness failure `kind` and `code`, with `field` present only when the failure carries one. The detail is always present on that path because the underlying `HarnessFailure` is always available there; it is identifiers only, single-line, bounded by `DISPATCH_MAX_ERROR_DETAIL_CHARS` (256), and never carries an environment value or secret. The `dispatch.session.spawn-failed` identity, category, retryability, consequence, remediation hint, result token, outcome, exit projection, and last message are unchanged, and the detail adds no new error code, delivery-result token, classifier row, or error-table row. It reaches machine JSON through the shared whole-envelope serializer and reaches verbose human output through the dispatch human-text selection.

Dispatch has no merge port and no merge code path. A merge-ready PR stays `pr-open` or `pr-open-unverified` for the coordinator's `merge`.

## Dual-run evidence

### Attempt record

Every dispatch that reaches classification, including an attempt-stage failure, appends exactly one `dispatch.attempt` record (`delivery.dispatch.attempt.v1`) under the state fence:

| Field group | Contents |
|---|---|
| Identity | Attempt id, normalized repository identity (`host/owner/name`), work-item reference, harness kind. |
| Timing | Start and finish timestamps, recorded time. |
| Evidence class | Exactly one of `pilot`, `controlled-proof`, `smoke`, `fixture`, attached at record creation from a declared composition or configuration input, never inferred from the outcome, immutable after append. |
| Result | Handover state at run, engine outcome, result token. |
| Comparison | Class (`verify-change`, `tracker-truth`, `not-applicable`), token or null, outcome (`match`, `mismatch`, `not-applicable`), optional reason, and `urlResolved` for tracker facts. |
| Classification | False-success flag, divergence reference when a comparison mismatches, tri-state corroboration per source (`pm-notes`, `tracker`, `ci`). |
| Resume | Resume mode and prefill-cost acknowledgement when the attempt resumed a lane. |
| Bounds | At most 16 bounded evidence references; no prompt, transcript, diff, credential, or raw provider payload. |

`token` is null if and only if the comparison class is `not-applicable`, and the comparison outcome is `not-applicable` if and only if the class is. A comparison divergence is appended when the outcome is `mismatch`; the delivered-evidence case below is the one additional, explicitly shaped divergence. Verify-family attempts compare against the verify-change ledger outcome; tracker-family attempts compare against the tracker fact; dispatch-session tokens and dispatch-derived failures carry a not-applicable comparison. A success claim contradicted by a readable artifact, tracker, or CI fact is recorded as a false-success incident with bounded evidence; a source whose read failed leaves the claim uncorroborated without creating an incident.

The watch contributes its observed verdict trail as `liveness:<verdict>` evidence references, so a transient stall remains visible even when the session later classifies normally. A post-spawn collection failure names `harness:collect-failed`; a restart-budget refusal names `economics:exhaustion` when the terminal record landed and `economics:exhaustion-unrecorded` when the append did not land, so an unrecorded exhaustion is never claimed as durable evidence.

### Divergence and handover records

- `dispatch.divergence` (`delivery.dispatch.divergence.v1`) opens on a comparison mismatch and folds latest-per-divergence. A resolution appends a second record with `state: resolved`, a bounded note, the recording principal, and the timestamp; the original open record remains. A delivered-evidence divergence is the one other shape: when the shared classifier outcome is `completed` (evaluated at record time; the persisted attempt outcome is never used), the phase ledger is readable and shows progress or a complete total, and truth is unreadable, at most one open record per `(repository, work-item reference)` carries `comparisonClass: not-applicable`, `engineToken: state-unverified`, `comparisonToken: null`, and evidence references `attempt:<id>` plus `truth:unreadable:<ledger|tracker|artifact|state>`. The divergence is appended before the attempt so the attempt can carry `divergenceRef`; a resume reuses the open record. If the divergence append fails, the attempt lands once with no `divergenceRef` and a bounded `divergence:append-failed` reference, and the underlying state identity is returned. If the attempt append fails after the divergence lands, the orphan stays open, counted, and resolvable, and a later attempt for the same pair reuses it.
- `dispatch.handover` (`delivery.dispatch.handover.v1`) records one authority operation (`authoritative` or `dual-run`) per repository, with the conditions snapshot at decision time, bounded evidence references, principal, and timestamp. History is append-only; a reversal is a new record, never a deletion.

`dispatch dual-run resolve` works from local evidence only: it resolves no credential, performs no network call, and reads no truth source outside the local state store and the divergence ledger. A genuine store fault keeps its own `state.*` identity under `kind: "state"` with that row's category, retryability, consequence, remediation, and exit, so a store fault is never reported as `dispatch.state-unverified`. An absent divergence identifier is an app-local `divergence-not-found` sentinel, distinct from a genuine `state.keys.missing`, surfaced as `input.value.rejected` with `kind: "input"` and appending nothing. The resolution note is clamped to its declared 240-character bound before the record is built, so an over-long note cannot become a write failure. A successful resolution appends one resolved record, leaves the original open record byte-identical, reports the resolved state and stored note, and is idempotent on replay.

### Authority view

`dispatch-authority.json` is the derived per-repository authority document (`delivery.dispatch.authority.v1`), rebuilt from the folded handover ledger and replaced atomically. It carries the repository identity, `authority` (`dual-run` or `authoritative`), the handover reference, the recorded time, and reversal availability. An absent, unreadable, or malformed view resolves to `dual-run`; it is never treated as authoritative.

### Evidence classes and counting

Production handover counts only `pilot` attempts. A controlled scope counts only `controlled-proof` attempts in its own controlled repository scope. `smoke` and `fixture` attempts count toward no handover. A record whose class does not match the scope is surfaced as excluded rather than silently accepted.

### Evidence window

The window lower bound is the most recent false-success incident's recorded timestamp, exclusive, when an incident exists; otherwise it is the first counted dispatch, inclusive. A dispatch recorded exactly at the incident timestamp is excluded. The summary reports `windowStart` and the closed `windowStartReason` (`first-counted-dispatch`, `false-success-incident-reset`, `no-counted-dispatch`). Resolved divergences do not reset the window; a false-success incident does.

A record-level unevaluable read degrades only that record: a non-success token still counts for class coverage and does not block, while an uncorroborated success claim fails corroboration as one named unmet condition without creating a comparison divergence or resetting the window. The delivered-evidence case is the explicit exception: a completed session with a readable progressed/completed ledger and an unreadable truth read owes one open, resolvable delivered-evidence divergence per work item, and that record counts as unresolved until resolved.

Corroboration distinguishes an unreadable source from a contradicted one. A source whose read failed is recorded uncorroborated (`unsatisfied` in the tri-state record) with the unreadable marker retained; it blocks the corroboration condition but is never a false-success incident. Only a readable contradiction of a success claim is a false-success incident that resets the evidence window. An unreadable, torn, or truncated evidence-stream read makes eligibility unverifiable and is never reported as eligible.

## Handover gate

Eligibility for a repository is the conjunction of four separated facts over the counted dispatches in the evidence window (TDR-0015):

1. **Truth.** Zero false-success incidents and zero unresolved divergences.
2. **Coverage (exposure only).** The set of result tokens across counted dispatches equals the eleven-token TDR-0005 set; every missing class is named. A non-success token counts for coverage, makes no success claim, creates no divergence, and does not by itself block.
3. **Floor (floor-only).** At least 20 counted dispatches or at least 7 consecutive UTC dates with at least one counted dispatch, whichever comes first. The floor never substitutes for truth, coverage, or corroboration.
4. **Corroboration (success claims only).** Every counted success-claimed token has the evidence its outcome family requires. A `merged` claim needs the pushed head, CI on that head, tracker state, and completed phases; a tracker-derived claim needs the tracker fact; `finished` needs the completed phase ledger; `noop-lane-nothing-to-do` needs the ledger or queue fact that no work remains. Non-success tokens satisfy corroboration vacuously.

`dispatch dual-run summary --repo <repo>` reports the window and reason, elapsed day count, counted deliveries, counted and excluded evidence classes, incidents, divergences (reported, resolved, unresolved, identifiers), coverage present and missing, corroboration satisfaction, the floor, the verdict (`eligible`, `ineligible`, `unverifiable`), and every unmet condition. A readable summary exits `0` even when ineligible.

`dispatch handover <repo>` evaluates the same predicate. A readable but unmet bar is a clean refusal at exit `1` that names every unmet condition and appends no authority-changing record. An unreadable or torn evidence read refuses at exit `2` with the classified identity and appends no authority-changing record. A met bar appends one handover record, flips only the resolved repository identity to `authoritative`, refreshes the authority view atomically, and reports the flip as recorded and reversible. Other repositories stay in `dual-run`.

`dispatch handover <repo> --revert` appends a reversal record and restores `dual-run` while preserving history. Reverting a repository already in `dual-run` is an idempotent noop at exit `0`. Replaying the same handover or reversal record appends no duplicate record.

Repository identity is rename-invariant and scoped to the checkout. The first successful resolution binds a first-use marker stored with the checkout inside its git common directory (`<git-common-dir>/dispatch-identity.json`); the marker is created once and never overwritten, so it travels with the checkout across a working-directory rename and is shared by every linked worktree of that repository. Creation writes a synced sibling file and links it into place, so an interrupted write cannot leave a torn marker, and a marker that nevertheless carries no binding is replaced by the next persisting dispatch instead of remaining permanently unreadable. Two repositories in one home therefore never share or overwrite each other's binding, and a rename, remote change, or scheduler re-key never re-keys history. Only a dispatch operating on the current checkout creates or repairs the marker: the read-only `dual-run summary`, `dual-run resolve`, and `handover` surfaces read the binding when present and never persist one from an arbitrary `--repo` argument. Without a marker, the scheduling engine's normalized `repository` key is tried first, then the checkout's configured VCS remote normalized to `host/owner/name`. A checkout-path digest is never presented as identity. An unresolvable identity is a clean refusal at exit `1`.

## Harness and daemon composition

The production composition supplies the real harness session port for the configured kind. It builds opencode over the host streaming spawn starter for spawn, resume, and deliver and the host one-shot runner for read-only session listing, with the deny-by-default environment builder and the shared classifier/liveness assembly; the Claude Code adapter supplies its declared spawn and collect capabilities over the one-shot runner. A healthy opencode spawn or resume returns its session handle as soon as the first identified stream line arrives, so the watch observes liveness and progress while the session is still running and collection resolves at process close. No default whole-session process cap applies to an opencode spawn or resume; the one-shot runner's bounded listing timeout is listing-only, and a handle-acquisition bound (60 s by default) refuses an opencode spawn or resume that never identifies its session. Dispatch spawns through the port and never branches on harness kind outside the adapter.

The production composition also resolves the `lane` policy branch and composes the resume path: the latest resumable daemon lane record supplies the existing session handle, the folded phase ledger supplies the completed-phase position, the adapter's declared capability decides attach-and-continue versus re-entry, and the verified economics records supply the restart count. The evidence-gate runtime is composed once over the same store and identity resolver, so `dispatch dual-run summary`, `dispatch dual-run resolve`, and `dispatch handover [--revert]` run in the shipped CLI.

The daemon lane seam supplies `createLaneLaunchPlanner`: a pure planner that returns the lifecycle prompt and only the declared environment variable names, resolving no secret value and reading no parent environment. It composes `createLaneExecutor` over the selected session port and execution-environment descriptor, so a daemon can claim, start, record, observe, collect, and resume lanes. An unavailable planner or declared capability gap leaves the daemon in honest `supervise-only` mode.

The lane seam is factory-proven: the daemon composition composes it when a lane composition is supplied, and the daemon-lane conformance suite drives the planner, executor, and daemon-path attempt record. The production composition mounts the daemon family without a lane composition, so supplying that seam remains resident-daemon production scope (GH-238); this feature proves the seam and the daemon-path attempt producer, not a production daemon that launches lanes.

The daemon path hands the same lane observation and collection evidence to `recordDaemonDispatchResult`, which derives the outcome and token through the same shared classifier and truth derivation, builds the same comparison and corroboration records, and appends exactly one attempt record through the same ledger. A daemon-driven attempt therefore agrees with a one-shot dispatch over the same evidence, and a replay or resume of the same attempt appends no second record.

A one-shot `dispatch <ref>` works from state alone with no daemon, no socket, and no resident process.

## Bash fallback

`scripts/lib/dispatch-authority.sh` reads the derived authority document as a plain file with ordinary shell tooling. It performs no typed CLI invocation, PATH lookup, network, or model call. `deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, and `ceo-loop.sh` source it at startup.

The resolver resolves the **project state root** before locating the document: the host root comes from the environment override first, then the repository-local default, then the home default, and the project root is `<host root>/projects/<project key>` with the key read from the checkout identity marker in the git common directory. The document therefore sits at `<project root>/documents.<workspace>/dispatch-authority.json` and the resolver's search bound stays `-maxdepth 2`; widening the search instead of resolving the root would make the fallback read the pre-migration host-root document and stay permanently `dual-run`. An absent marker, an absent project root, or a document placed at the old host-root location resolves to `dual-run` exactly as before.

The typed side writes and reads the same derived view under the same project root: the production dispatch state root is the policy-derived project state root, so the engine and the fallback agree about where authority lives.

- In `dual-run` the scripts behave as before: same arguments, outputs, exit behavior, and no deprecation pointer.
- In `authoritative` they print a bounded deprecation pointer on stderr naming `dispatch <ref>` and `dispatch handover <repo> --revert`, and they remain executable as fallback.
- When the authority view is absent, unreadable, malformed, or torn, the resolver reports `dual-run`; a missing or broken typed installation never breaks the bash stack.

## Error identities

The `dispatch` error kind carries four rows, all non-retryable with consequence `not_landed`:

| Code | Category | Projection | Exit | Meaning |
|---|---|---|---|---|
| `dispatch.session.spawn-failed` | user | user-validation | 1 | The harness or process failed before a session existed; `data.error.detail` carries the underlying harness failure `kind` and `code`, plus `field` when the failure carries one. |
| `dispatch.restart-budget-exceeded` | user | user-validation | 1 | Restart admission was refused on an existing lane. |
| `dispatch.resume-uneconomical` | user | user-validation | 1 | Resume admission was refused on an existing lane. |
| `dispatch.state-unverified` | platform | platform-provider | 2 | Dispatch truth could not be read, so no verdict was derived. |

Every dispatch failure resolves by exact code; no kind-only dispatch discriminant is assumed to resolve to one row. Prose is never identity, and no dispatch path exits outside `{0, 1, 2}`.

The admission refusals and resolve failures add no `dispatch` row. An admission refusal carries an existing `provider`, `config`, or `input` identity (the admission table above); a resolve store failure carries the failing `state` identity with `kind: "state"`; and an absent divergence identifier is `input.value.rejected` with `kind: "input"`. The engine's local result error-kind union admits the existing `provider` and `config` kinds; `DOMAIN_KINDS` and the error-table row count are unchanged.

## Bounds and configuration

| Bound | Value |
|---|---|
| Attempt records retained per summary | 5,000 |
| Machine `data` | 65,536 UTF-8 bytes |
| Human output | 40 lines, 8,192 bytes |
| `last_message` | 512 characters, single line, redacted |
| `data.error.detail` | 256 characters, identifiers only, single line |
| Evidence references per record | 16 |
| Divergence resolution note | 240 characters |
| Unresolved divergence ids in a summary | 20 |
| Evidence classes | `pilot`, `controlled-proof`, `smoke`, `fixture` |
| Exposure floor | 20 counted dispatches or 7 consecutive UTC dates |

Configuration reuses the delivered harness branch and the `lane` policy keys: `lane.liveness-interval` (default `30000` ms) is the liveness cadence and `lane.restart-budget` (default `3`) is the restart bound; both are resolved from the typed configuration branch and read as policy data. Dispatch introduces no new configuration key and reads no ambient environment outside the injected harness descriptor and credential seam.

The delivered state read verifies the JSONL ledger once. The attempt fold retains the newest 5,000 attempt records and declares the omitted count as `truncation: { bound, omittedRecords }`, so the bound is enforced on the returned evidence set rather than by a store-side scan limit. A truncated read is declared and makes eligibility unverifiable rather than eligible, and summary and handover evaluation make no model or provider call.

## Quality evidence

The enduring coverage map is the [dispatch engine test specification](../../quality/test-specs/test-spec-dispatch-engine.md). The principal suites are the dispatch truth, liveness, watch, evidence, gate, handover, resume, identity, admission-preflight, admission-read-mapping, admission-diagnostics, delivered-evidence-divergence, resolve-diagnostics, bash-fallback, help, daemon, production-composition, bounds, and controlled-proof suites under `tests/behaviour/`, `tests/structure/`, `tests/golden/`, `tests/conformance/dispatch/`, and `scripts/.tests/`; `pnpm check:help` and the aggregate `pnpm check` cover the registration and conformance surfaces.

## Related

- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the prompt-required composition that includes `dispatch`.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the four dispatch rows, and the exit projection.
- [Harness Adapters](feature-harness-adapters.md) — the session port, both delivery adapters, and the shared classifier.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — lane supervision and the daemon-side attempt-record producer.
- [Scheduling Engine](feature-scheduling-engine.md) — the repository lease dispatch claims and releases.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the restart-budget gate and resume-economics admission.
- [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md) — the delivery-result vocabulary and the verify-change comparison baseline.
- [Dispatch reference page](../../planning/oss-tooling/milestones/m1/commands/dispatch.md)
- [Tracker Credential Provisioning](../../guides/tracker-credential-provisioning.md) — the supported truth-read key, the explicit `gh` export bridge, and rotation guidance.
- [TDR-0015 — Dispatch handover gate operational semantics](../../decisions/TDR-0015-dispatch-handover-gate-operational-semantics.md)
- [TDR-0019 — Dispatch admission credential preflight](../../decisions/TDR-0019-dispatch-admission-credential-preflight.md)
- [TDR-0020 — Dispatch divergence recording and resolution](../../decisions/TDR-0020-dispatch-divergence-recording-and-resolution.md)
- [TDR-0005 — Delivery result enum and CLI exit taxonomy](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md)
- [TDR-0010 — Dispatch session classification token projection](../../decisions/TDR-0010-dispatch-session-classification-token-projection.md)
- [ADR-0008 — Harness adapter contract](../../decisions/ADR-0008-harness-adapter-contract.md)
- [TDR-0016 — Additive harness streaming spawn seam](../../decisions/TDR-0016-harness-streaming-spawn-seam.md)

**Change records:** `doc/changes/2026-11/2026-11-08--GH-239--dispatch-engine/` (the delivered engine) and `doc/changes/2026-11/2026-11-10--GH-279--dispatch-credential-preflight/` (the admission preflight and delivered-evidence divergence).
