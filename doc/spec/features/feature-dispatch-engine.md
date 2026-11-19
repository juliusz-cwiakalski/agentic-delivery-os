---
ados_distribution: internal
id: SPEC-DISPATCH-ENGINE
status: Current
created: 2026-11-08
last_updated: 2026-11-19
owners: ["engineering"]
service: delivery-os
summary: "The typed per-ticket dispatch engine: the `dispatch` command family (`dispatch <ref>`, `dispatch attempts`, `dispatch dual-run summary|resolve`, `dispatch handover [--revert]`), harness resolution with the pinned supported-version window and declared integration mode evaluated once before the lease, the provider profile nomination recorded at admission on the attempt and lane records with the classified no-nomination pre-session refusal, the dispatch-owned durable per-ref `dispatch.lane` record appended at each session acquisition and at the terminal classification with latest-wins reads and recorded-attempt resume (a recorded `pr-open` attempt included), the dispatch family's atomic per-ref admission decided inside the claim with the declared same-ref/other-ref verdicts and a bounded fence wait, spawn or resume through the harness session port with the caller agent identity `pm`, the single-seat binding, the deterministic `ticket-<REF>` title, and the ref-parameterized delivery-lifecycle prompt, handle acquisition before completion, the five-attempt tracker retry ladder, progress-based liveness with a bounded in-process restart loop that terminates a corroborated stall through the capability-gated `terminate` operation before any restart, the one total derivation ladder shared with the daemon path including the retired ledger no-work arm, the subsumed exit-0-no-artifact failure arm, the tracker-done `merged` arm, the artifact `partial` arm, and arm-aware corroboration, bash-continuity text and machine envelopes, the pinned failure-token mapping, durable attempt/divergence/handover records including the locally resolvable delivered-evidence divergence, the derived per-repository authority view, evidence-class counting and the incident-exclusive four-condition handover gate, the production composition of the evidence gate, the rename-invariant identity resolver with its checkout-scoped first-use marker, the factory-proven daemon lane seam with the daemon-path attempt producer, the repository-scoped `dispatch attempts` read side over the durable attempt ledger, the published parity proof boundary, the CLI-independent bash fallback authority read, and the offline parity battery that proves all eleven classes with no shell dependency."
links:
  related_changes: ["GH-239", "GH-275", "GH-277", "GH-279", "GH-280", "GH-286", "GH-288", "GH-289", "GH-292", "GH-294", "GH-293", "GH-335", "GH-347"]
  related_decisions: ["TDR-0015", "TDR-0005", "TDR-0010", "ADR-0008", "TDR-0016", "TDR-0019", "TDR-0020", "TDR-0021", "TDR-0024", "TDR-0026", "TDR-0027", "TDR-0028", "TDR-0031", "TDR-0040", "TDR-0041", "TDR-0042", "TDR-0044", "TDR-0045", "TDR-0046", "TDR-0047", "TDR-0048", "TDR-0049"]
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/pm-notes.ts"
    - "packages/core/src/contracts/delivery-result.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/contracts/result.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/core/src/app/dispatch-lane.ts"
    - "packages/core/src/app/dispatch-ledger.ts"
    - "packages/core/src/app/dispatch-gate.ts"
    - "packages/core/src/app/queue.ts"
    - "packages/core/src/app/daemon-dispatch-result.ts"
    - "packages/core/src/domain/dispatch-result.ts"
    - "packages/core/src/domain/dispatch-liveness.ts"
    - "packages/core/src/domain/dispatch-prompt.ts"
    - "packages/core/src/domain/dispatch-resume.ts"
    - "packages/core/src/domain/dispatch-tracker.ts"
    - "packages/core/src/domain/lane-launch-plan.ts"
    - "packages/adapters/src/harness/opencode.ts"
    - "packages/adapters/src/harness/claude.ts"
    - "packages/adapters/src/file/dispatch-identity.ts"
    - "packages/adapters/src/file/pm-notes-parser.ts"
    - "packages/adapters/src/repo/index.ts"
    - "packages/cli/src/commands/dispatch.ts"
    - "packages/cli/src/output/dispatch-text.ts"
    - "packages/cli/src/production.ts"
    - "scripts/checks/no-shell-dispatch.ts"
    - "scripts/lib/dispatch-authority.sh"
---

# Feature: Dispatch Engine

## Overview

The dispatch engine is the typed per-ticket delivery path. One invocation resolves a harness, validates its input, runs the admission preflight, claims the repository's queue lease atomically with the dispatch family's per-ref verdict, spawns or resumes the lifecycle session through the delivered harness session port, appends one active `dispatch.lane` record at each session acquisition, watches the session with progress-based liveness, terminates a corroborated stall through the capability-gated harness `terminate` operation, and runs a bounded in-process restart loop before classifying the terminal outcome through the shared harness classifier and deriving the final delivery token from artifact, ledger, tracker, and CI truth rather than from an exit code. Exactly one durable attempt record is appended at the terminal classification, so the engine accrues dual-run evidence beside the bash stack.

A repository is either `dual-run` (bash authoritative, dispatch evidence only) or `authoritative` (dispatch primary, bash fallback). Authority changes only through a recorded, reversible handover that evaluates the four-condition evidence gate. The derived per-repository authority view is a plain file the bash entry points read without invoking the typed CLI, so the fallback keeps working when the typed stack is unavailable.

`dispatch` is part of the prompt-required CLI composition and has root help, command help, and reference-page coverage. The same harness session port, classifier, truth derivation, attempt-record ledger, and lane resolver serve one-shot dispatches and daemon-driven lanes, and the dispatch flow invokes no shell and no script path.

The typed dispatch lane is parity-complete for the eleven result classes and the shell's supervision semantics: the durable lane, the atomic admission verdict, recorded-attempt resume, the tracker retry ladder, the stall termination, the in-process bounded restart loop, and the resolved spawn identity, title, and lifecycle prompt. It has no shell dependency, and the shell entry points remain the documented fallback until a separate handover.

The shipped production composition wires the one-shot run path with its admission preflight, the durable lane resolver and writer, the atomic dispatch claim, the injected delay, the restart ledger append, the spawn identity and title, the lifecycle prompt, the attempt read side, the evidence-gate runtime (`dual-run summary`, `dual-run resolve`, and `handover [--revert]`), and the repository identity resolver with its checkout-scoped first-use marker. The daemon lane seam is composed at the CLI/daemon factory; the production composition mounts the daemon family without a lane composition, so supplying that seam remains resident-daemon production scope (GH-238).

## Command grammar

| Invocation | Purpose |
|---|---|
| `dispatch <ref> [--harness <name>] [--resume-prompt <text>]` | Run one dispatch — one or more session iterations in a bounded loop — or resume the recorded lane with operator guidance. |
| `dispatch attempts [--ref <ref>] [--limit <n>]` | Read one work item's recorded attempts, newest first, as a bounded digest or the `attempts.v1` machine envelope. |
| `dispatch dual-run summary --repo <repo>` | Report the evidence window, class coverage, divergences, corroboration, and the four-condition verdict. |
| `dispatch dual-run resolve <divergence-id> --note <text>` | Append a bounded resolution to an open divergence. |
| `dispatch handover <repo> [--revert]` | Flip one repository to engine-authoritative, or append a reversal back to dual-run. |

A work-item reference matches `[A-Z]+-\d+`. The harness resolves from `--harness` when supplied and from the typed harness configuration otherwise; an unknown harness name is an input refusal. Grammar runs before any runtime call, and the handler returns data or a classified failure rather than choosing an exit digit.

Refusals before any session attempt exists are: an unknown harness, rejected input, a provider profile nomination refusal (the delivery cannot nominate a profile), an admission preflight refusal (an unresolvable truth-read credential or a failing bounded admission read), a pre-session harness admission refusal (an out-of-window or indeterminate version, an unavailable integration mode, or an unreadable harness resolution), an active owner hold, a conflicting lease on another ref, a live lease that already records the requested ref (the atomic per-ref admission refusal), and the port-boundary profile refusals (an unrepresentable seat model, a named agent the profile assigns no seat, and a present empty or invalid agent identity). Each emits the classified top-level error envelope with its mapped identity and exit and appends no lease, attempt, lane, or queue record; the nomination refusal and the admission preflight are the two whose exit can be `2` (the nomination when every candidate is ineligible, `provider.profile.unavailable`), and the per-ref refusal names the live holder in the envelope-root `detail`. The version and mode refusals run before the lease claim; the port-boundary profile refusals run at spawn or resume after the lease is claimed and released, and still append no attempt record. Every other failure after the lease claim is an attempt-stage failure and appends exactly one attempt record with its pinned token and outcome.

## One-shot dispatch

1. **Resolve the harness.** The flag wins over configuration; the selected adapter supplies spawn, resume, observe, collect, liveness, its declared `terminate` capability, and its declared gaps. For the opencode delivery harness the resolution also runs the single bounded version probe and evaluates the pinned window and the declared integration mode before the lease claim; an outside or indeterminate version refuses `harness.version.unsupported` or `harness.version.unknown`, and a requested non-default mode refuses `harness.mode.unavailable`.
2. **Nominate the provider profile.** Immediately after input validation and before the credential preflight, the owner-hold gate, and the lease claim, the nomination resolves through the delivered profile seam and records `providerProfile` on the attempt record and on the daemon lane record ([Provider Peak Pausing](feature-peak-pausing.md)). A delivery that cannot nominate is refused pre-session with the resolve identity for its shape (`provider.profile.absent`, `provider.profile.invalid`, `provider.profile.capability-denied` at exit `1`; `provider.profile.unavailable` at exit `2` with the eligibility list) — no lease, spawn, resume, attempt, lane, or queue record, and no event. A composed daemon supervision claim nominates through the same predicate before the claim.
3. **Run the admission preflight.** After the harness resolves, input validates, and the nomination records, the preflight resolves the declared truth-read credential and performs one bounded work-item read. A refusal here is pre-session: no lease, spawn, resume, or record.
4. **Admit and claim the lease atomically.** The dispatch claim decides the per-ref verdict inside the claim, from the live lease the claim observes atomically with its append: a live lease that records the requested ref — whichever holder — refuses `queue.single-flight` at exit `1` with the holder at the envelope root; a live lease on another ref refuses `queue.lease-conflict`; a stale lease is taken over with its incident evidence; no live lease claims. Store-fence contention (`state.lock.busy`) is a transient signal: the claim waits it out through the injected delay with reason `claim-fence`, in bounded steps whose cumulative wait never exceeds the queue lease TTL, and re-decides from the observed lease. A fence that never frees returns its typed `state.*` row, never a queue relabelling and never an internal containment identity. The dispatch claim uses the fixed holder `dispatch` and never renews, so a live same-ref lease under any holder is a refusal rather than a renewal. An active owner hold refuses `queue.precondition.unmet` with reason `owner-hold` before the fence. Every refusal here is pre-session and opens no lease, spawn, resume, attempt, lane, or queue record and publishes no event. Otherwise the scheduling engine claims the repository-exclusive lease for the reference.
5. **Spawn or resume.** A fresh spawn receives the caller agent identity `pm`, the resolved single-seat binding (the agent identity, the seat, and that seat's resolved model), the deterministic title `ticket-<REF>`, and the delivery-lifecycle prompt parameterized by the work-item reference and the resolved base branch. The adapter renders exactly one `--agent pm`, one `--model <seat model>`, and one `--title ticket-<REF>` for a fresh spawn, and no title for a resume. A role-less composition supplies neither the agent nor the binding, binds nothing, renders no title, records no binding, and is disclosed as an unresolved seat. The prompt is built, never constant: two references produce different prompts, and every prompt carries the five stable lifecycle sections (`state-detection`, `resume-sync`, `actions-by-state`, `eleven-phase-lifecycle`, `merge-authority`) with the reference and base branch interpolated. An opencode spawn returns its handle as soon as the first identified stream line arrives, before the session completes; a resume acquires the same way while preserving the existing session identity; a Claude Code spawn returns its handle when the bounded one-shot invocation completes.
6. **Resolve a recorded attempt on `--resume-prompt`.** The lane resolver returns the newest recorded lane for the ref that carries a session identity — dispatch-owned (`dispatch.lanes:<ref>`) in any state, or a daemon lane in `delivering`, `detached`, or `preempted` — and the newest record wins, with the dispatch-owned record winning a timestamp tie. A recorded `pr-open` attempt is therefore resumable. A resolved lane is resumed, never replaced by a fresh spawn, and the recorded resume mode is `attach-continue`, or `resume-prompt-reentry` with its acknowledged prefill cost when the adapter lacks resume injection; completed phases are skipped idempotently. The operator resume is admitted regardless of the persisted restart bound, consumes no restart ordinal, and never re-nominates: a pre-change lane resumes on its recorded absence, classified, and is simply not window-pausable. An unknown session is a classified failure, never a silent fresh spawn. With no recorded lane, the operator text is an explicit fresh spawn, never a fabricated resume.
7. **Append the durable lane record at acquisition.** Each successful acquisition — the first iteration and every restarted iteration — appends one `dispatch.lane` record with `state: "active"`, the session identity, the normalized repository, the attempt identity, the harness kind, the advisory owner facts (`processId` and `startedAt`), the 1-based iteration ordinal, the restarts consumed so far, and the recorded time. Records are append-only and the latest record for the ref is the lane; a differing record for the same ref is a new append, never a rewrite. No prompt, transcript, diff, credential, or provider payload is carried. A failed lane append leaves the token unchanged and is disclosed as a bounded `lane:append-failed` evidence reference.
8. **Watch with progress-based liveness.** Token delta, session traffic, worktree activity, or prefill advancement anywhere in the observed session tree counts as progress. A stall requires two consecutive sourced evaluations with no advance; a bare elapsed timer never stalls a lane. An absent reading stays absent or unknown and is never coerced to zero. The evaluation cadence is `lane.liveness-interval`. In the shipped composition the watch polls at that cadence while evidence collection is pending, records the observed verdict trail as bounded `liveness:<verdict>` evidence, and cancels its timer when collection finishes. A stall is a current-state verdict, not a latch: any later advancing observation clears it, so a transient mid-run stall stays recorded as liveness evidence and the collected evidence still classifies normally.
9. **Terminate a stall, then decide the next iteration.** A stall that is still current when collection resolves, or a harness-reported timeout, is restart-eligible; a clean session exit is always terminal. Before any restart decision the stalled session is terminated when the adapter declares the capability: the host process table is matched by exact identity, TERM reaches the matched session's process tree first, KILL only after the declared grace and only over a target still listed, an escaped runtime is chosen only by exact identity (this lane's session id or its `ticket-<REF>` title), and the operation is idempotent — an unknown session is success, and a repeated call appends no signal and replays the facts the first call observed. A resume re-enters as a new live process tree and clears the recorded termination fact, so a restarted iteration is signalable rather than inheriting the prior iteration's result. The grace is the declared `coordinator.kill-grace` (default 20 000 ms), reused rather than duplicated, and the wait is the injected delay with reason `terminate-grace`. An adapter that declares no terminate capability is never asked, produces `harness.capability.gap` by name if it is, and never causes a second session. The stall ladder then runs in the order below.
10. **Classify and derive truth.** The shared classifier yields a harness outcome and token; the one total derivation decides the final token from tracker state, PR state and URL, branch commits, pm-notes completeness, ledger progress, and CI. A success claim is never accepted on an exit code alone.
11. **Record and render.** One attempt record is appended under the state fence at the terminal classification, the terminal `dispatch.lane` record carrying `state: "terminal"`, `lastToken`, and `lastOutcome` is appended when the dispatch held a session, and the command renders either the four-key bash-continuity text (which gains one bounded `detail:` prose line in verbose human mode) or the machine envelope.

### Stall ladder

The stall decision is a total, ordered ladder and it is not the artifact-first derivation ladder an ended session uses (TDR-0047):

1. **Terminal pre-restart verdict set.** Exactly three truths short-circuit a stall without a restart: `merged` from a tracker-done work item, `blocked` from a blocking tracker state, and `pr-open` from an open pull-request artifact. A decisive artifact outside the set — `finished`, `partial`, `noop-lane-nothing-to-do` — does not stop a stall.
2. **Undecidable truth.** Any required read unreadable with no decisive artifact — an unreadable artifact, or an unreadable tracker with no open or already-merged pull request and no branch commits — resolves `state-unverified` at exit `2`, consumes no ordinal, and starts no second session.
3. **Termination capability.** A stall on an adapter that declares no terminate capability, or whose termination is not confirmed, is the same terminal `state-unverified` at exit `2` with the stall evidence: no ordinal is consumed and no second session starts.
4. **Below the bound.** One ordinal is consumed, exactly one `economics.restart` record is appended with reason `watchdog.liveness-stalled`, and the recorded session is resumed for the next iteration. A fresh spawn happens only when no session was ever recorded.
5. **At or above the bound.** The attempt is `max-restarts` with the delivered terminal exhaustion record, the stall and termination evidence, and no second spawn.

An admitted iteration at or above a persisted count still runs once; only a stall in it produces `max-restarts`, and a clean exit keeps its own classification. A composition with no positive bound composes no restart policy, so the loop never restarts automatically: it classifies the stall `max-restarts` instead of spinning on a permanently stalled session.

### Spawn identity, title, and lifecycle prompt

The spawn facts are supplied by the production composition as data, and no new
CLI flag, argument, or output key exposes them (TDR-0049):

- **Agent identity.** The caller agent identity is `pm`, supplied through the
  delivered optional agent member; the single-seat binding is the delivered pure
  resolver's output for that identity. A role-less composition supplies neither.
- **Title.** A fresh spawn carries the deterministic `ticket-<REF>` title — the
  `ticket-` prefix plus the work-item reference grammar, one short single token.
  The title is deterministic across runs and references, and a resume carries
  none.
- **Prompt.** The fresh prompt is the delivery-lifecycle prompt built for the
  reference and the resolved base branch. It is a built document, never a
  constant sentence, and it carries the five stable sections named above. A resume
  with operator text uses that text verbatim; an automatic restart re-enters with
  the lifecycle prompt.

An unknown or malformed reference yields no title at all rather than a malformed
one: the prefix and the work-item reference grammar together produce the title
only when the result is a well-formed single token within its declared bound.

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

## Per-ref single-flight admission

The dispatch family's per-ref verdict is decided **inside** the claim, from live
lease truth observed atomically with the claim's own append, so a live same-ref
lease can never slip past a separate pre-claim read (TDR-0045). It is one
predicate shared by `dispatch <ref>` and a composed daemon supervision claim,
because both claim with a fixed holder and never renew mid-flight:

| Live lease state for the requested ref's repository | Outcome | Session |
|---|---|---|
| records the requested ref, any holder | `queue.single-flight`, exit `1`, envelope-root `detail.holder` | none |
| records another ref | `queue.lease-conflict`, exit `1` | none |
| no live lease | claimed; one `acquired` record | the dispatch proceeds |
| stale lease (heartbeat age at or beyond `queue.lease-ttl`) | taken over with incident evidence; one `taken-over` record | the dispatch proceeds |

A same-ref lease is by definition a dispatch that is already running, so the
second dispatch is refused even when the live holder identity matches the
requester's. The dispatch claim never renews a lease whose recorded ref would have
to change, and it never renews its own live same-ref lease: it passes the
no-renewal flag, so any live same-ref lease is a refusal. A lease at or over its
TTL is not active: the delivered stale-takeover path applies on every path, so a
crashed session blocks a ref for no longer than the TTL.

Store-fence contention is transient, not an outcome. When the claim observes the
typed `state.lock.busy` row it waits through the injected delay with reason
`claim-fence` — the only time source is that injected fact — in bounded steps
whose cumulative wait is never greater than the queue lease TTL, and re-decides
from the lease it then observes. A fence that never frees returns its typed
`state.*` row at that row's projection, never a `queue` relabelling and never an
internal containment identity. The dispatch claim's outcome is always one of the
declared verdicts; `fallback.internal` is never surfaced for an admission
outcome. A refusal appends no lease, attempt, lane, or queue record, starts no
session, and publishes no event.

The refusal names the holder at the failure-envelope root: an additive optional,
command-declared `detail` object whose only member is `holder`, single line,
bounded to 128 characters, identifiers only, with no credential, session id, or
provider payload. `CommandResultError` keeps exactly its six delivered fields and
`error.detail` is not a placement; the success-shaped `data.error.detail` slot
described above is a separate, attempt-stage field (TDR-0027). The exit stays the
row's projection class (`user-validation` → `1`), and the row is retryable once
the holding lane ends.

The sibling `queue claim` path keeps its holder-aware outcomes, because it claims
with the caller's own holder and is the only path where renewal exists: a live
same-ref lease under the caller's holder returns `renewed` and starts no session,
another holder's same-ref lease refuses `queue.single-flight`, and a lease on any
other ref refuses the delivered `queue.lease-conflict`. Its own-holder renewal,
repository exclusivity, and its TTL are unchanged. The scheduling engine's
per-pass single-flight (one action per repository per pass) and its `repo-free`
readiness condition are unchanged and are different controls.

## Durable per-ref lane record

`dispatch.lane` (`delivery.dispatch.lane.v1`, key `dispatch.lanes:<ref>`) is the
dispatch-owned durable lane record and the resumable artifact (TDR-0044). It
mirrors the daemon lane's shape without sharing its kind, its states, or its
ownership:

| Field | Meaning |
|---|---|
| `schema` | `delivery.dispatch.lane.v1`. |
| `ref`, `repository` | The work-item reference and the normalized `host/owner/name` repository identity. |
| `attemptId`, `sessionId`, `harnessKind` | The attempt the lane belongs to, the held session identity, and the harness the session runs on. |
| `owner` | The advisory `{ processId, startedAt }` facts of the writing composition; never an exclusion mechanism. |
| `iterationOrdinal` | The 1-based iteration within this dispatch; `1` for the first acquisition. |
| `restartsConsumed` | The restart ordinals this dispatch consumed before this record. |
| `state` | `active` at each session acquisition, `terminal` at the final classification. |
| `lastToken`, `lastOutcome` | Present only on a terminal record. |
| `recordedAt` | The recorded instant. |

Exactly one active record is appended at each session acquisition — the first
iteration and every restarted iteration — and one terminal record at the
dispatch's final classification. A restarted stalled iteration appends no attempt
record and no terminal lane record. A record with no held session is never
appended, and a pre-session refusal appends none. The composition supplies the
advisory owner facts; a composition that supplies none writes no lane record, so
the shipped production composition always supplies its own process id and start
instant. The kind is append-only and
latest-wins per ref: a differing record for the same ref is a new append, never a
rewrite, and only an identical replay is a noop. The record carries no prompt,
transcript, diff, credential, or provider payload, and at most one owner object
and one session identity.

The record is dispatch-owned. The daemon family never reads or writes
`dispatch.lane`; `daemon.lane`, its state vocabulary, and daemon reconciliation
ownership are unchanged, and daemon reconciliation never adopts or rewrites a
dispatch lane ([Resident Dispatch Daemon](feature-resident-daemon.md)).

Resume resolves the newest recorded lane for the ref that carries a session
identity. A dispatch lane is a candidate in any state, so a recorded `pr-open`
attempt is resumable; a daemon lane is a candidate only in `delivering`,
`detached`, or `preempted`. An unreadable lane source contributes no candidate
rather than fabricating a session from a partial read, so a ref with no readable
candidate resolves the classified "no lane" outcome, and a pre-change state with
no `dispatch.lane` records simply resolves "no lane".

## Result derivation and exit projection

Derivation is one total order — the same derivation, with no second mode, is
called by the one-shot path and by the daemon path (TDR-0048). First match wins;
the pull-request and artifact arms apply to every ended, non-stall session, not
only to a clean completion:

1. A spawn failure before a session existed is `failed` with
   `dispatch.session.spawn-failed` and one attempt record.
2. A resume refused as uneconomical is `failed`; unreadable resume-admission
   facts are `state-unverified`.
3. The narrowed persisted-bound re-key: a harness-reported timeout at or above a
   positive bound is `max-restarts`. A clean exit, a premature end, a tool
   failure, or any other non-zero exit at the bound keeps its own classification
   and is never re-keyed by an already-reached bound.
4. An unreadable harness read is `state-unverified` at exit `2` with the
   classified state identity and one attempt record.
5. A spawn refusal before a session existed is a recorded attempt with token
   `noop-lane-permission` and outcome `refused`; from the harness path the token
   means spawn-refused, never a lane-permission policy verdict.
6. A readable tracker whose native state is done is `merged`, corroborated by the
   tracker fact alone and with no visible pull request required. This arm precedes
   the blocking arm, so a done work item that also carries a blocking label
   resolves `merged`.
7. A readable tracker that is blocking or in a delivery-blocked state is
   `blocked`.
8. An open pull request is `pr-open`; an open pull request whose URL cannot be
   resolved is `pr-open-unverified`. The independent tracker comparison token for
   either is `pr-open`, and URL resolution is the comparison's `urlResolved`
   attribute (`false` for `pr-open-unverified`). URL resolution never changes the
   compared token and never creates a divergence.
9. An independently observed already-merged pull request is `merged` as
   already-merged detection only.
10. Branch commits above zero with complete pm-notes is `finished`; branch commits
    above zero with incomplete or absent pm-notes is `partial`, carrying its
    harness outcome.
11. No branch commits, no open or already-merged pull request, and a readable
    non-done non-blocked tracker is `noop-lane-nothing-to-do`, corroborated by the
    tracker fact alone. This is the only arm that produces the token: the retired
    phase-ledger no-work arm no longer derives it, so a complete ledger with
    commits resolves `finished` or `partial` and a complete ledger with no commits
    takes this arm only under the shell condition. It is the one arm read as a
    judgement about a clean completion, so it applies only when the classifier's
    token is `finished`.
12. Otherwise a non-clean end uses the shared classifier's token: a reported
    failure or non-zero exit is `failed`; a tool failure or premature end is
    `partial`. This arm is exhaustive over the session outcome and precedes the
    undecidable arm, so a non-clean end whose truth read is unreadable keeps its
    classifier token. A harness-reported timeout is a terminal stall: it takes no
    artifact arm, and this ladder yields its classifier token while the stall
    ladder decides the outcome.
13. Truth undecidable — a session whose classifier token is `finished` and whose
    required read is unreadable with no decisive artifact — is `state-unverified`
    at exit `2`.

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

The artifact read carries a required `pmNotes` completeness fact — `complete`
when the change's pm-notes document exists and its delivery phase carries a
non-null completion, `absent` when there is no document, and `incomplete` when
the document is present but incomplete, unparseable, or otherwise not complete.
The fallible direction is never `complete`. The fact is projected from the
delivered pm-notes read and adds no external read, file-probe rule, or
configuration key.

### Arm-aware corroboration

Success corroboration is arm-aware for exactly two arms, and every other token
keeps its token-keyed requirement (TDR-0048): a `merged` reached from a
tracker-done work item, and `noop-lane-nothing-to-do`, each require the tracker
fact and nothing else. The closed requirement map is data — `merged` requires
`pm-notes`, `tracker`, and `ci`; `pr-open`, `pr-open-unverified`, and `blocked`
require `tracker`; `finished` and `noop-lane-nothing-to-do` require `pm-notes`;
`failed`, `partial`, `max-restarts`, `state-unverified`, and
`noop-lane-permission` require nothing and satisfy corroboration vacuously.

The one derivation decides the arm at its two arm-aware branches and passes it
unchanged to both evaluation sites (the one-shot path and the daemon-path attempt
producer); the corroboration record's tri-state shape is unchanged. The
evidence-window gate reads an attempt record, which carries no arm, so it stays
**token-level** by decision: adding an arm discriminator to the persisted attempt
record would be an attempt-schema change. A token-level window reading can
therefore be stricter than the dispatch-time arm-aware claim, and that difference
is declared rather than reconciled by changing the record.

The `"pm-notes"` corroboration source stays the phase ledger (`phasesComplete`)
and is deliberately not re-pointed at the `pmNotes` artifact fact. A `finished`
reached with a divergent ledger carries `corroboration.pmNotes ===
"unsatisfied"` and `falseSuccess === true`; the delivered-evidence divergence
record is not produced for a `finished` (that path is gated on
`state-unverified`); no new incident kind is added and `falseSuccess` is never
suppressed.

### Tracker retry ladder

A tracker read is retried through a bounded ladder: at most five attempts, with
the wait before attempt `n + 1` equal to `min(2 000 ms * 2^(n-1), 30 000 ms)` —
2 000, 4 000, 8 000, and 16 000 ms between the five attempts — for at most 30 000
ms of added latency. No configuration key is added. A read that succeeds within
the ladder is used; exhaustion yields the bounded `tracker:exhausted` evidence
reference and never a success-shaped fact from a failed read. Exhaustion resolves
`state-unverified` unless a decisive artifact resolves the outcome at arms 8–10.
The delay function is injected, so production uses a real timer and the offline
battery advances a virtual clock.

### Failure-token mapping

Every dispatch failure identity pins one result token, one engine outcome, one exit, an attempt-record policy, and a comparison treatment. No row adds a token or changes a projection or derivation class.

| Failure class | Attempt record | Result token | Outcome | Exit | Comparison record |
|---|---|---|---|---|---|
| `dispatch.session.spawn-failed` | exactly one | `failed` | `failed` | 1 | not applicable, token null, reason `comparison-source-unavailable` |
| `dispatch.restart-budget-exceeded` | exactly one | `max-restarts` | `failed` | 1 | not applicable, token null, reason `dispatch-session-family` |
| `dispatch.resume-uneconomical` | exactly one | `failed` | `failed` | 1 | not applicable, token null, reason `comparison-source-unavailable` |
| Post-spawn `harness.collect` failure (a session existed but its evidence could not be read) | exactly one | `state-unverified` | `failed` | 2 | not applicable, token null, reason `comparison-source-unavailable` |
| Harness spawn refusal (no error identity) | exactly one | `noop-lane-permission` | `refused` | 1 | not applicable, token null, reason `dispatch-session-family` |
| Unknown harness, rejected input, a nomination refusal, an active owner hold, a live same-ref lease, or a lease conflict on another ref before a spawn | none | none (a nomination refusal carries the profile resolve identity `provider.profile.absent`, `provider.profile.invalid`, `provider.profile.capability-denied`, or `provider.profile.unavailable`; an owner hold carries `queue.precondition.unmet` with blocking reason `owner-hold`; a live same-ref lease carries `queue.single-flight` with the holder at the envelope root; another ref carries `queue.lease-conflict`) | none | 1, or 2 for `provider.profile.unavailable` | none |
| Credential or admission-read refusal before a spawn | none | none (the top-level error carries the mapped identity) | none | 1 or 2 per the admission table | none |

All five recorded failure classes count for class coverage as exposure, make no success claim, create no divergence, and block nothing. The post-spawn collection failure is attempt-stage because a session existed; the engine records the unevaluable attempt at exit `2` instead of returning it unrecorded, and it is not one of the seven pre-session refusal kinds.

No failure class here adds an error identity. A missing `terminate` capability is not a failure identity: an adapter that declares no terminate capability is never asked, and one that is asked returns the delivered `harness.capability.gap` by name. The lane record, the terminate result, the stall verdict, and tracker exhaustion are recorded as bounded attempt evidence references — `lane:append-failed`, `terminate:terminated`/`terminate:escalated`/`terminate:reaped`/`terminate:failed`, `liveness:<verdict>`, `tracker:exhausted`, `economics:exhaustion`, and `economics:restart-failed` — never as identities and never as a new error row or domain kind.

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

Machine mode renders the standard command envelope. Dispatch `data` carries `result`, `prUrl`, `phaseLedger` (`completed`, `total`, `variant`), `restarts`, `resumeAmplification`, `harness`, `handoverState`, `outcome`, and `lastMessage`, plus a bounded `truncation` marker when a field is cut. An attempt-stage classified failure that carries an error identity is a data-bearing success envelope: the top-level envelope carries no `error`, while `data.error` carries the full error-table fields (`code`, `category`, `retryable`, `consequence`, `remediationHint`, and `summary`) beside `data.result` and `data.outcome`; consumers read `data.result` and `data.error` together. A recorded harness spawn refusal is a data-bearing success envelope with `data.result` and `data.outcome` and no error identity to nest. A pre-session refusal uses the standard top-level error envelope instead. When that refusal is `queue.single-flight`, the top-level envelope also carries the additive optional `detail` object with the live `holder`. The four pre-session harness refusals (`harness.version.unsupported`, `harness.version.unknown`, `harness.mode.unavailable`, `harness.profile.model-unrepresentable`) additionally carry the declared `detail.harness` member with exactly its four closed facts — `kind`, the normalized `observedVersion` (or explicit `null`), `versionVerdict`, and `mode` only where mode resolution ran; the unassigned named agent's delivered `provider.profile.invalid` refusal carries its facts in the bounded `error.summary` and adds no envelope member. No other dispatch refusal populates the envelope-root `detail`.

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
| Provider profile | The nominated profile recorded at admission (`providerProfile`); additive field, absent on pre-change records where reads render a classified absence. |
| Held session identities | The session identities the attempt held, one per spawn or resume (`sessionIds`); additive and optional, absent on a pre-change record and on an attempt that held none. A pre-session refusal still records no attempt at all. |
| Recorded binding | The single-seat binding the composition resolved for the attempt's spawn (`binding`: the agent identity, the seat, and that seat's resolved model); additive and optional, absent on a pre-change record and on a role-less run, and the daemon lane records one only when it resolved one. |
| Recorded harness facts | The normalized observed harness version (`harnessVersion`), the window verdict (`versionVerdict`), the selected integration mode (`mode`), and its origin (`modeOrigin`); additive and optional, recorded only when the run holds them, so a pre-change record stays readable and nothing is fabricated. |
| Comparison | Class (`verify-change`, `tracker-truth`, `not-applicable`), token or null, outcome (`match`, `mismatch`, `not-applicable`), optional reason, and `urlResolved` for tracker facts. |
| Classification | False-success flag, divergence reference when a comparison mismatches, tri-state corroboration per source (`pm-notes`, `tracker`, `ci`). |
| Resume | Resume mode and prefill-cost acknowledgement when the attempt resumed a lane. |
| Bounds | At most 16 bounded evidence references, with `lane:append-failed` and `tracker:exhausted` reserved ahead of the slice so a disclosure is never truncated away; no prompt, transcript, diff, credential, or raw provider payload. |

The attempt record's shape is unchanged by the lane: it gains no lane field, and
the durable lane record is the resumable artifact. The record is appended once at
the dispatch's terminal classification; a restarted stalled iteration appends
none, and a pre-session refusal appends none.

The composition mounts the profile wrapper on the opencode port, so a
caller-supplied agent identity is resolved by the pure resolver and supplied as the
invocation's one `--agent`/`--model` pair. The shipped production dispatch
supplies the caller agent identity `pm`: the binding is resolved from the selected
profile context, recorded on the attempt when it resolved, and rendered as
exactly one `--agent pm` and one `--model`. A composition that supplies no agent
identity is role-less, renders neither `--agent` nor `--title`, records no
binding, and is disclosed as an unresolved seat; a role-less run is never
evidence of profile propagation.

`token` is null if and only if the comparison class is `not-applicable`, and the comparison outcome is `not-applicable` if and only if the class is. A comparison divergence is appended when the outcome is `mismatch`; the delivered-evidence case below is the one additional, explicitly shaped divergence. Verify-family attempts compare against the verify-change ledger outcome; tracker-family attempts compare against the tracker fact; dispatch-session tokens and dispatch-derived failures carry a not-applicable comparison. A success claim contradicted by a readable artifact, tracker, or CI fact is recorded as a false-success incident with bounded evidence; a source whose read failed leaves the claim uncorroborated without creating an incident.

The watch contributes its observed verdict trail as `liveness:<verdict>` evidence references, so a transient stall remains visible even when the session later classifies normally. A post-spawn collection failure names `harness:collect-failed`; a restart-budget refusal names `economics:exhaustion` when the terminal record landed and `economics:exhaustion-unrecorded` when the append did not land, so an unrecorded exhaustion is never claimed as durable evidence.

### Attempt read side

`dispatch attempts [--ref <ref>] [--limit <n>]` is a subfamily of the dispatch
family: it does not change the root family listing or the prompt-required set.
It reads the durable attempt record and adds no record kind, schema version, key
prefix, fold, configuration key, or error identity. The static help inventory
carries five `dispatch` entries — the family plus `attempts`,
`dual-run summary`, `dual-run resolve`, and `handover` — and both
reference-page parity pins assert that count. The read side's rulings — the
closed-taxonomy reuse, the empty-history success, the record-bounded projection
cardinality, the unconditional evidence mode, the one exact divergence count, and
the twice-enforced repository scope — are recorded in
[TDR-0024](../../decisions/TDR-0024-dispatch-attempt-read-side-and-local-evidence-resolve.md).

- **Envelope.** The `attempts.v1` `data` carries eight always-present keys —
  `repository`, `ref`, `refSource` (`"flag"` or `"active-change"`), `limit`,
  `matched`, `hasMore`, `attempts[]`, and `excluded.foreignRepository` — plus a
  single `truncation` object only when a bound binds. The envelope is the
  standard five-field `CommandResult` (`schemaVersion`, `runId`, `exitCode`,
  `timing`, and `data`, plus `error` on a failure); it carries no `ok` and no
  `command` field, and the invocation is recorded in the command audit ledger
  under the family token `dispatch`.
- **Projection.** Each row carries exactly seventeen fields: `attemptId`,
  `repository`, `ref`, `harness`, `evidenceClass`, `outcome`, `token`,
  `startedAt`, `endedAt` (the consumer name for the recorded finish timestamp),
  `divergenceRef` (one identifier or explicit `null`), `corroboration`
  (`pmNotes`, `tracker`, `ci` tri-state), `falseSuccess`, `comparison` (`class`,
  `token` or `null`, `outcome`), `resumeMode` (or `null`), `providerProfile`
  (the admission nomination, or `null` as the classified absence on a
  pre-change record), `evidenceRefs` (at
  most 16 identifiers), and `recordedAt`. No prompt, transcript, diff,
  credential, or provider payload is projected.
- **Order and page.** The order is total: `startedAt` descending, `recordedAt`
  descending, `attemptId` ascending. `matched` is the number of matching
  records in the retained ledger window, `hasMore` is true exactly when matching
  attempts exist beyond the returned array, and the page is bounded by `--limit`
  (canonical decimal 1..100, default 20, refused rather than clamped).
- **Bounds.** The ledger read retains the newest 5,000 records; the serialized
  `data` is bounded to 65,536 UTF-8 bytes; the human digest to 40 lines and 8,192
  bytes with at most 37 rows beside a truncation line. The single truncation
  object is `{ scope: "ledger" | "page", bound, omittedRecords }`, with
  `bound: 5000` for `ledger`, `bound: 65536` for `page`, and the ledger scope
  taking precedence.
- **Reference resolution.** A supplied `--ref` must match `[A-Z]+-\d+`. When it
  is omitted, `active_change.workItemRef` resolves from
  `.ai/local/pm-context.yaml` through the same seam the spend read side uses. An
  absent, unparsable, or active-change-less context refuses at exit `1` with
  `input.value.rejected` and a bounded summary naming the context file and the
  `--ref` remedy, before any store read.
- **Repository scope.** The read is scoped twice: physically by the project
  state root and logically by filtering each record on its own `repository`.
  Records of another repository in the retained window are excluded from
  `attempts[]` and counted in `excluded.foreignRepository`, independent of
  `--ref`, and never named. An unresolvable identity refuses at exit `1` naming
  the checkout; an invocation outside any checkout never reports the host-scoped
  `unbound` store as a repository's history. Identity resolves with persistence
  disabled, so the dispatch repository binding marker is never created,
  repaired, or re-persisted.
- **Read-only posture.** Zero attempt, divergence, handover, or authority
  appends and zero fence acquisitions; the store's delivery-evidence bytes,
  modes, and mtimes are unchanged. The inherited store-opening effects are the
  host-index maintenance write (zero when unchanged) and the create-once project
  checkout identity marker.
- **Empty history.** A verified read that matches no record is success at exit
  `0` with `attempts: []`, `matched: 0`, and `hasMore: false`. A torn,
  unreadable, or permission-denied store keeps its delivered `state.*` identity
  with `kind: "state"` and that row's projection, and is never reported as an
  empty history; the exit follows the row (`state.permission.denied` projects
  `user-validation` at exit `1`, while the platform state rows project exit
  `2`).
- **Digest.** The human digest prints one summary line, one row per attempt
  newest first, an optional `truncation=human:bound:<kept>,omitted:<dropped>`
  line, and the coverage/floor pointer
  `next: dispatch dual-run summary --repo <repository> (coverage and floor)`.
  The corroboration cell is the closed three-value derivation
  (`corroborated`, `uncorroborated`, `vacuous`).

### Divergence and handover records

- `dispatch.divergence` (`delivery.dispatch.divergence.v1`) opens on a comparison mismatch and folds latest-per-divergence. A resolution appends a second record with `state: resolved`, a bounded note, the recording principal, and the timestamp; the original open record remains. A delivered-evidence divergence is the one other shape: when the shared classifier outcome is `completed` (evaluated at record time; the persisted attempt outcome is never used), the phase ledger is readable and shows progress or a complete total, and truth is unreadable, at most one open record per `(repository, work-item reference)` carries `comparisonClass: not-applicable`, `engineToken: state-unverified`, `comparisonToken: null`, and evidence references `attempt:<id>` plus `truth:unreadable:<ledger|tracker|artifact|state>`. The divergence is appended before the attempt so the attempt can carry `divergenceRef`; a resume reuses the open record. If the divergence append fails, the attempt lands once with no `divergenceRef` and a bounded `divergence:append-failed` reference, and the underlying state identity is returned. If the attempt append fails after the divergence lands, the orphan stays open, counted, and resolvable, and a later attempt for the same pair reuses it.
- `dispatch.handover` (`delivery.dispatch.handover.v1`) records one authority operation (`authoritative` or `dual-run`) per repository, with the conditions snapshot at decision time, bounded evidence references, principal, and timestamp. History is append-only; a reversal is a new record, never a deletion.

`dispatch dual-run resolve` works from local evidence only: it resolves no credential, performs no network call, and reads no truth source outside the local state store and the divergence ledger. A genuine store fault keeps its own `state.*` identity under `kind: "state"` with that row's category, retryability, consequence, remediation, and exit, so a store fault is never reported as `dispatch.state-unverified`. An absent divergence identifier is an app-local `divergence-not-found` sentinel, distinct from a genuine `state.keys.missing`, surfaced as `input.value.rejected` with `kind: "input"` and appending nothing. A blank or whitespace-only note is refused with `input.value.rejected` and appends nothing; a note longer than its declared 240-character bound is clamped before the record is built and reported as stored, so an over-long note cannot become a write failure. A successful resolution appends one resolved record, leaves the original open record byte-identical, reports the resolved state and stored note, and is idempotent on replay.

The success data keeps the five delivered keys — `divergenceId`, `state`, `resolved`, `note`, `principal` — and adds three: `mode: "local-evidence"` unconditionally on every success including a replay, because no live-truth branch exists; `repository`, the repository recorded on the resolved divergence; and `divergences`, the shared repository-scoped block `{ reported, resolved, unresolved, unresolvedIds, idsTruncated }`. `unresolved` is the exact folded open count for that repository, `unresolvedIds` lists at most 20 of them, and `idsTruncated` is true exactly when identifiers were dropped. The same computation feeds `dispatch dual-run summary`, so both surfaces agree; the summary's counts are exact and repository-scoped, and its identifier list and human `unresolved_divergences=` line print the same at-most-20 list. The shared computation is `summarizeRepositoryDivergences` in the dispatch gate domain; every surface that reports divergence counts consumes it, and no surface or helper derives a count from an identifier list's length. Cross-repository resolution is disclosed by the reported repository rather than prevented.

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

`dispatch dual-run summary --repo <repo>` reports the window and reason, elapsed day count, counted deliveries, counted and excluded evidence classes, incidents, divergences (the shared repository-scoped block: exact `reported`, `resolved`, `unresolved`, at most 20 `unresolvedIds`, and `idsTruncated` when identifiers are omitted), coverage present and missing, corroboration satisfaction, the floor, the verdict (`eligible`, `ineligible`, `unverifiable`), and every unmet condition. After `floor` it appends `cleanDispatches` (the corroborated counted attempts, declared identical to `corroboration.satisfied` — one derivation, no second counting rule), `consecutiveCleanDispatches` (the trailing run of clean counted attempts ending at the window's last counted attempt in ledger append order; `0` when that attempt is not clean or the window is empty), and `conditions` (the four ordered statuses). The text form gains `clean_dispatches=`, `consecutive_clean_dispatches=`, and `conditions=truth:<status>,coverage:<status>,floor:<status>,corroboration:<status>` between `unmet_conditions=` and the optional truncation line. `truncation` stays last. A readable summary exits `0` even when ineligible.

The four conditions are one shape in one declared order (`DISPATCH_HANDOVER_CONDITIONS`: `truth`, `coverage`, `floor`, `corroboration`), each `{condition, status}` with `status` in `met | open` and no `detail` field, and one derivation produces them for the summary, the handover decision, and the fleet row. A condition is `open` exactly when the evaluation names it in `unmetConditions`, so the open set equals the unmet list in order by construction. `unverifiable` is a window-level verdict, never a third status: a truncated read reports `verdict: "unverifiable"` with `truncation` present and the statuses explicitly over the visible window.

The fleet evaluation host is `repos list` (and only that read): every row carries `reversible` and a `handoverGate` block — evaluated at read time for each `ready` row, and the declared empty-window evaluation for a `first-use` row — bound to the row's own repository identity and folded at the declared `production` scope. No other read evaluates the gate, and no new command, verb, flag, daemon tick, or scheduler exists. The row contract is documented in [Repositories and the Host Overview](feature-projects.md).

`dispatch handover <repo>` evaluates the same predicate. A readable but unmet bar is a clean refusal at exit `1` that names every unmet condition and appends no authority-changing record. An unreadable or torn evidence read refuses at exit `2` with the classified identity and appends no authority-changing record. A met bar appends one handover record, flips only the resolved repository identity to `authoritative`, refreshes the authority view atomically, and reports the flip as recorded and reversible. Other repositories stay in `dual-run`.

The handover data carries the four ordered `conditions` and `reversible` on every outcome that performs the gate evidence read — a recorded flip, an idempotent flip noop, a clean refusal, and a recorded revert. The recorded revert also carries `verdict`, so the data-level invariant `verdict == "unverifiable" ⟺ truncation present` is expressible on it. `unmetConditions` keeps its delivered refusal-only shape. `reversible` is `true` exactly when the repository's latest folded authority after the operation is `authoritative` (a recorded flip and an idempotent flip noop are `true`; a clean refusal, a recorded revert, and an idempotent revert noop are `false`).

**Declared exemption.** Exactly one outcome performs no gate evidence read: the idempotent revert noop, `--revert` on a repository whose folded authority is already `dual-run` (or which has no handover record). It is answered from the folded handover before any gate read, at exit `0`, with `recorded: false`, `noop: true`, `operation: "dual-run"`, and `reversible: false`, carrying no `conditions`, no `verdict`, and no `truncation`; a torn or unreadable attempts or divergences ledger cannot refuse it. The folded handover that establishes the noop is still read, so an unreadable or torn handover ledger still refuses `dispatch.state-unverified` at exit `2` with no data on this path. A *recorded* revert keeps its gate read and still refuses at exit `2` when the evidence ledger is unreadable, while the prior flip stands. `dispatch handover <repo> --revert` appends a reversal record and restores `dual-run` while preserving history; replaying the same handover or reversal record appends no duplicate record.

Provider windows and holds are inputs to admission; their effects are the delivered surfaces the mapping names — the dispatch admission refusal and queue blocking for an owner hold, and `status.laneParks`, the brief park fields, `lanes` `peakEnforcement`, the board `PARKED` section, the `stop`/`parked` events, and the window-scoped spend evidence for a `peak-window` park. A declared window has no read surface of its own ([Provider Peak Pausing](feature-peak-pausing.md)).

**No-flip operating definition.** Authority stays `dual-run` until an owner act. The regular delivery path is the typed engine (`dispatch <ref>` and the engine merge/closeout primitives); the four bash entry points remain executable and keep their five-key summary tail, their exits, and the delivered pointer behaviour ([Bash fallback](#bash-fallback)). This change flips no repository and inserts no handover record.

Repository identity is rename-invariant and scoped to the checkout. The first successful resolution binds a first-use marker stored with the checkout inside its git common directory (`<git-common-dir>/dispatch-identity.json`); the marker is created once and never overwritten, so it travels with the checkout across a working-directory rename and is shared by every linked worktree of that repository. Creation writes a synced sibling file and links it into place, so an interrupted write cannot leave a torn marker, and a marker that nevertheless carries no binding is replaced by the next persisting dispatch instead of remaining permanently unreadable. Two repositories in one home therefore never share or overwrite each other's binding, and a rename, remote change, or scheduler re-key never re-keys history. Only a dispatch operating on the current checkout creates or repairs the marker: the read-only `dispatch attempts`, `dual-run summary`, `dual-run resolve`, and `handover` surfaces read the binding when present and never persist one from an arbitrary `--repo` argument. Without a marker, the scheduling engine's normalized `repository` key is tried first, then the checkout's configured VCS remote normalized to `host/owner/name`. A checkout-path digest is never presented as identity. An unresolvable identity is a clean refusal at exit `1`.

## Harness and daemon composition

The production composition supplies the real harness session port for the configured kind. It builds opencode over the host streaming spawn starter for spawn, resume, and deliver and the host one-shot runner for read-only session listing, with the deny-by-default environment builder and the shared classifier/liveness assembly; the Claude Code adapter supplies its declared spawn and collect capabilities over the one-shot runner. A healthy opencode spawn or resume returns its session handle as soon as the first identified stream line arrives, so the watch observes liveness and progress while the session is still running and collection resolves at process close. No default whole-session process cap applies to an opencode spawn or resume; the one-shot runner's bounded listing timeout is listing-only, and a handle-acquisition bound (60 s by default) refuses an opencode spawn or resume that never identifies its session. Dispatch spawns through the port and never branches on harness kind outside the adapter.

The production composition also resolves the `lane` policy branch and composes the run path end to end: the newest recorded lane carrying a session identity supplies the existing session handle on `--resume-prompt` (a dispatch lane in any state, or a resumable daemon lane), the folded phase ledger supplies the completed-phase position, the adapter's declared capability decides attach-and-continue versus re-entry, the verified economics records supply the persisted restart count, the atomic dispatch claim supplies the lease, the composition's lane owner facts and the store supply the durable lane record, the injected delay binds the real timer for the fence wait, the tracker ladder, and the terminate grace, the composition binds the terminate process-tree seam, the composition supplies the `pm` agent identity, the resolved binding, the `ticket-<REF>` title, and the resolved base branch, and `coordinator.kill-grace` supplies the terminate grace. The evidence-gate runtime is composed once over the same store and identity resolver, so `dispatch attempts`, `dispatch dual-run summary`, `dispatch dual-run resolve`, and `dispatch handover [--revert]` run in the shipped CLI.

Every dispatch-flow process is started with a fixed argv and no shell, and no script path appears in the flow (API-7, NFR-5). The static invariant is the named package script `check:no-shell` (`bun run scripts/checks/no-shell-dispatch.ts`), which scans a declared dispatch-flow surface file list with an empty allowlist and four named rules — a script-path literal, a `shell: true`, a shell-capable child-process import or call, and a child-process `spawn` without a literal `shell: false` — and is also discovered by `bun test` through its own suite.

The daemon lane seam supplies `createLaneLaunchPlanner`: a pure planner that returns the lifecycle prompt and only the declared environment variable names, resolving no secret value and reading no parent environment. It composes `createLaneExecutor` over the selected session port and execution-environment descriptor, so a daemon can claim, start, record, observe, collect, and resume lanes. An unavailable planner or declared capability gap leaves the daemon in honest `supervise-only` mode.

The lane seam is factory-proven: the daemon composition composes it when a lane composition is supplied, and the daemon-lane conformance suite drives the planner, executor, and daemon-path attempt record. The production composition mounts the daemon family without a lane composition, so supplying that seam remains resident-daemon production scope (GH-238); this feature proves the seam and the daemon-path attempt producer, not a production daemon that launches lanes.

The daemon path hands the same lane observation and collection evidence to `recordDaemonDispatchResult`, which derives the outcome and token through the same shared classifier and truth derivation, builds the same comparison and corroboration records, and appends exactly one attempt record through the same ledger. `recordDaemonDispatchResult` consumes the derivation's own `corroborationArm`, so a daemon-driven attempt inherits arm-aware corroboration without re-deriving it, and the daemon path inherits the tracker-done `merged` arm, the artifact `partial` arm, and the retired ledger no-work arm. A daemon-driven attempt therefore agrees with a one-shot dispatch over the same evidence, and a replay or resume of the same attempt appends no second record.

A one-shot `dispatch <ref>` works from state alone with no daemon, no socket, and no resident process.

## Parity proof boundary

The offline parity battery replays all eleven result classes through the real command path and the real derivation, and it proves the admission interleaving, the recorded-attempt resume, the tracker ladder, the terminate contract, the in-process loop, the spawn identity, and the no-shell invariant. It proves the contract, not the world outside it. The machine-checked source of the boundary is the permanent fixture constant `PARITY_PROOF_BOUNDARY` (`tests/fixtures/dispatch/parity/evidence.ts`); this page publishes the same list, and neither a change artifact nor the test plan is a source.

**Proven (eight, in declared order):** `claim`, `lane`, `spawn`, `ladder`, `terminate`, `loop`, `class-coverage`, `no-shell`.

**Not proven (six, in declared order):** `live-opencode`, `live-provider`, `os-termination`, `real-lifecycle-outcome`, `cross-process-race`, `long-run-outage`.

The not-proven list is deliberate. The battery does not prove live opencode behaviour (a real session's resume after a real process exit, real stdout framing, real prefill timing), live provider behaviour (real reads, throttling, authentication failure shapes), OS-level process-tree termination of a real child and a real escaped runtime — it proves the terminate contract and the exact-identity selection over the injected process-tree double, not kernel signal delivery — a real lifecycle-agent outcome or a real merge, cross-process race freedom beyond the state store's fence guarantee (the two-invocation interleaving is deterministic, not an arbitrary OS schedule), or long-run retry behaviour under a real 30-second outage (the injected delay advances a virtual clock).

Whole-change parity means the eleven classes and the shell's supervision semantics are reproduced by the typed lane, which invokes no shell and no script path; the shell entry points stay on disk as the documented fallback and their retirement is a separate owner act.

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

The read side adds no row either: `dispatch attempts` maps its malformed request, unresolvable active reference, and unresolvable identity to `input.value.rejected` (`kind: "input"`, exit 1), keeps the failing `state.*` identity for an unreadable store (`kind: "state"`, that row's projection), and treats a verified empty history as success. The exit always follows the row: `state.permission.denied` projects `user-validation` at exit `1`, and the platform state rows project exit `2`. No `attempts.*` identity is declared, emitted, or documented; a document that names one is stale.

The admission refusals and resolve failures add no `dispatch` row. An admission refusal carries an existing `provider`, `config`, or `input` identity (the admission table above); the nomination refusal reuses the profile resolve identities (`provider.profile.absent`, `provider.profile.invalid`, `provider.profile.capability-denied`, `provider.profile.unavailable`) and adds no identity of its own; a resolve store failure carries the failing `state` identity with `kind: "state"`; and an absent divergence identifier is `input.value.rejected` with `kind: "input"`. The engine's local result error-kind union admits the existing `provider` and `config` kinds; `DOMAIN_KINDS` and the error-table row count are unchanged.

The lane record, the terminate result, the restart loop, the tracker ladder, and the parity battery add no identity either. A missing terminate capability reuses the delivered `harness.capability.gap`, a durable `dispatch.lane` record is state, not an error identity, and no domain kind, error row, or projection moves.

## Bounds and configuration

| Bound | Value |
|---|---|
| Attempt records retained per verified read | 5,000 |
| Attempts page | 20 default, 1 minimum, 100 maximum (`--limit`, canonical decimal) |
| Attempt rows beside a human truncation line | 37 |
| Machine `data` | 65,536 UTF-8 bytes |
| Human output | 40 lines, 8,192 bytes |
| `last_message` | 512 characters, single line, redacted |
| `data.error.detail` | 256 characters, identifiers only, single line |
| Envelope-root `detail.holder` | 128 characters, identifiers only, single line |
| Evidence references per record | 16 |
| Divergence resolution note | 240 characters |
| Unresolved divergence ids in a summary | 20 |
| Evidence classes | `pilot`, `controlled-proof`, `smoke`, `fixture` |
| Exposure floor | 20 counted dispatches or 7 consecutive UTC dates |
| Tracker retry ladder | 5 attempts; waits `min(2 000 ms * 2^(n-1), 30 000 ms)`; ≤ 30 000 ms added |
| Fresh-spawn title | `ticket-<REF>`, at most 64 characters, one token |
| Admission fence wait | bounded steps of at most 1 000 ms, cumulative ≤ `queue.lease-ttl` (90 000 ms default) |
| Terminate grace | `coordinator.kill-grace`, 20 000 ms default |
| Restart bound | `lane.restart-budget`, 3 default |
| Liveness cadence | `lane.liveness-interval`, 30 000 ms default |

Configuration reuses the delivered harness branch and the `lane` policy keys: `lane.liveness-interval` (default `30000` ms) is the liveness cadence and `lane.restart-budget` (default `3`) is the restart bound; both are resolved from the typed configuration branch and read as policy data. The terminate grace borrows `coordinator.kill-grace` (default `20000` ms) because it is a signalling grace with identical semantics, and the fence wait is bounded by `queue.lease-ttl` (default `90000` ms). Dispatch introduces no new configuration key and reads no ambient environment outside the injected harness descriptor and credential seam. The in-process loop consumes the dispatch lane's own `lane.restart-budget`; `coordinator.restart-budget` governs coordinator supervision and is not consumed by dispatch.

The delivered state read verifies the JSONL ledger once. The attempt fold retains the newest 5,000 attempt records and declares the omitted count as `truncation: { bound, omittedRecords }`, so the bound is enforced on the returned evidence set rather than by a store-side scan limit. A truncated read is declared and makes eligibility unverifiable rather than eligible, and summary and handover evaluation make no model or provider call.

## Quality evidence

The enduring coverage map is the [dispatch engine test specification](../../quality/test-specs/test-spec-dispatch-engine.md). The principal suites are the dispatch truth-derivation, token-closure, liveness, watch, evidence, gate, handover, clean-accrual, conditions-projection, handover-conditions, resume, identity, admission-preflight, admission-read-mapping, admission-diagnostics, delivered-evidence-divergence, resolve-diagnostics, bash-fallback, help, daemon, production-composition, bounds, and controlled-proof suites; the GH-347 parity battery is covered by the parity admission, lane-resume, tracker, stall-loop, spawn, no-shell, and battery suites under `tests/conformance/dispatch/`, with the whole-battery registry in `tests/fixtures/dispatch/parity/cases.ts` and the permanent proof boundary in `tests/fixtures/dispatch/parity/evidence.ts`; the no-shell invariant is the `no-shell-dispatch` check suite and the named `check:no-shell` package script; the fleet row's additive fields and read-time evaluation are covered by the repos handover-gate, repos-list-contract, projects-flat-alias, engine-first-cross-surface, and engine-first-no-flip suites; the attempt read side and the extended resolve result are covered by the attempt reference, contract, bounds, scope, refusals, and digest suites, the resolve-result and divergence-count suites, and the attempts taxonomy, count-rule, composition, additive-stability, and test-isolation suites; `pnpm check:help` and the aggregate `pnpm check` cover the registration and conformance surfaces. All run under `tests/behaviour/`, `tests/structure/`, `tests/checks/`, `tests/golden/`, `tests/conformance/dispatch/`, and `scripts/.tests/`.

## Related

- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the prompt-required composition that includes `dispatch`.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the four dispatch rows, and the exit projection.
- [Harness Adapters](feature-harness-adapters.md) — the session port with its optional `terminate`, both delivery adapters, the spawn title rendering, and the shared classifier.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — lane supervision and the daemon-side attempt-record producer; a composed supervision claim belongs to this admission family.
- [Provider Peak Pausing](feature-peak-pausing.md) — the admission nomination the engine records and the window-end recovery the daemon routes through this engine's restart budget.
- [Scheduling Engine](feature-scheduling-engine.md) — the repository lease dispatch claims and releases, the in-claim per-ref verdict table, and the holder-naming refusal.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the restart-budget gate, resume-economics admission, the terminate contract, and the `economics.restart` record the loop appends.
- [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md) — the delivery-result vocabulary and the verify-change comparison baseline.
- [Dispatch reference page](../../planning/oss-tooling/milestones/m1/commands/dispatch.md)
- [Attempt read-side reference page](../../planning/oss-tooling/milestones/m2/commands/attempts.md)
- [Engine-first Delivery Operations](../../guides/engine-first-operations.md) — the operator routine over these surfaces: the daily loop, reading the gate and the fleet row, flip and reversal, and the shell fallback.
- [Repositories and the Host Overview](feature-projects.md) — the `repos list` row that hosts the read-time gate evaluation.
- [TDR-0031 — Engine-first evaluation surfaces](../../decisions/TDR-0031-engine-first-evaluation-surfaces.md)
- [Tracker Credential Provisioning](../../guides/tracker-credential-provisioning.md) — the supported truth-read key, the explicit `gh` export bridge, and rotation guidance.
- [TDR-0015 — Dispatch handover gate operational semantics](../../decisions/TDR-0015-dispatch-handover-gate-operational-semantics.md)
- [TDR-0019 — Dispatch admission credential preflight](../../decisions/TDR-0019-dispatch-admission-credential-preflight.md)
- [TDR-0020 — Dispatch divergence recording and resolution](../../decisions/TDR-0020-dispatch-divergence-recording-and-resolution.md)
- [TDR-0005 — Delivery result enum and CLI exit taxonomy](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md)
- [TDR-0010 — Dispatch session classification token projection](../../decisions/TDR-0010-dispatch-session-classification-token-projection.md)
- [ADR-0008 — Harness adapter contract](../../decisions/ADR-0008-harness-adapter-contract.md)
- [TDR-0016 — Additive harness streaming spawn seam](../../decisions/TDR-0016-harness-streaming-spawn-seam.md)
- [TDR-0026 — Queue lifecycle removal and single-flight](../../decisions/TDR-0026-queue-lifecycle-removal-single-flight.md)
- [TDR-0027 — Command failure envelope detail slot](../../decisions/TDR-0027-command-failure-envelope-detail-slot.md)
- [TDR-0044 — Dispatch-owned durable lane record](../../decisions/TDR-0044-dispatch-owned-durable-lane-record.md) — the lane kind, its fields, its ownership boundary, and recorded-attempt resume.
- [TDR-0045 — Dispatch atomic admission verdicts](../../decisions/TDR-0045-dispatch-atomic-admission-verdicts.md) — the in-claim same-ref/other-ref verdict, the no-renewal rule, and the bounded fence wait.
- [TDR-0046 — Harness terminate operation](../../decisions/TDR-0046-harness-terminate-operation.md) — the capability-gated terminate contract, its grace, and the exact-identity reap.
- [TDR-0047 — In-process bounded restart loop](../../decisions/TDR-0047-in-process-bounded-restart-loop.md) — the one-invocation loop, the stall ladder, and one terminal attempt record.
- [TDR-0048 — Total derivation ladder and corroboration](../../decisions/TDR-0048-total-derivation-ladder-and-corroboration.md) — the total order, the pm-notes artifact fact, and arm-aware corroboration.
- [TDR-0049 — Dispatch spawn identity, title, and prompt](../../decisions/TDR-0049-dispatch-spawn-identity-title-and-prompt.md) — the `pm` identity, the `ticket-<REF>` title, and the built lifecycle prompt.

**Change records:** `doc/changes/2026-11/2026-11-08--GH-239--dispatch-engine/` (the delivered engine), `doc/changes/2026-11/2026-11-10--GH-279--dispatch-credential-preflight/` (the admission preflight and delivered-evidence divergence), `doc/changes/2026-11/2026-11-11--GH-289--evidence-inspection/` (the attempt read side and the local-evidence resolve result), `doc/changes/2026-11/2026-11-12--GH-292--queue-lifecycle/` (the per-ref single-flight admission refusal and its envelope-root holder detail), `doc/changes/2026-11/2026-11-17--GH-293--engine-first-operations/` (clean accrual, condition projection, the handover outcome table, and the fleet read-time gate evaluation), and `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/` (the durable lane, atomic admission, recorded-attempt resume, tracker ladder, terminate, the in-process loop, spawn identity, the total derivation, and the parity battery).
