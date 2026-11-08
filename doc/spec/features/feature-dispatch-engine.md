---
ados_distribution: internal
id: SPEC-DISPATCH-ENGINE
status: Current
created: 2026-11-08
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
summary: "The typed per-ticket dispatch engine: the `dispatch` command family (`dispatch <ref>`, `dispatch dual-run summary|resolve`, `dispatch handover [--revert]`), harness resolution and queue-lease claim, spawn or resume through the harness session port, progress-based liveness, artifact-first truth derivation into the closed TDR-0005 vocabulary, bash-continuity text and machine envelopes, the pinned failure-token mapping, durable attempt/divergence/handover records and the derived per-repository authority view, evidence-class counting and the incident-exclusive four-condition handover gate, daemon lane planner and executor composition with the daemon-path attempt producer, and the CLI-independent bash fallback authority read."
links:
  related_changes: ["GH-239"]
  related_decisions: ["TDR-0015", "TDR-0005", "TDR-0010", "ADR-0008"]
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/delivery-result.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/core/src/app/dispatch-gate.ts"
    - "packages/core/src/app/daemon-dispatch-result.ts"
    - "packages/core/src/domain/lane-launch-plan.ts"
    - "packages/cli/src/commands/dispatch.ts"
    - "packages/cli/src/output/dispatch-text.ts"
    - "scripts/lib/dispatch-authority.sh"
---

# Feature: Dispatch Engine

## Overview

The dispatch engine is the typed per-ticket delivery path. One invocation resolves a harness, claims the repository's queue lease, spawns or resumes the lifecycle session through the delivered harness session port, watches it with progress-based liveness, classifies the terminal outcome through the shared harness classifier, and derives the final delivery token from artifact, ledger, tracker, and CI truth rather than from an exit code. Every dispatch that reaches classification appends one durable attempt record, so the engine accrues dual-run evidence beside the bash stack.

A repository is either `dual-run` (bash authoritative, dispatch evidence only) or `authoritative` (dispatch primary, bash fallback). Authority changes only through a recorded, reversible handover that evaluates the four-condition evidence gate. The derived per-repository authority view is a plain file the bash entry points read without invoking the typed CLI, so the fallback keeps working when the typed stack is unavailable.

`dispatch` is part of the prompt-required CLI composition and has root help, command help, and reference-page coverage. The same harness session port, classifier, truth derivation, and attempt-record ledger serve one-shot dispatches and daemon-driven lanes.

## Command grammar

| Invocation | Purpose |
|---|---|
| `dispatch <ref> [--harness <name>] [--resume-prompt <text>]` | Run one dispatch, or resume the existing lane with operator guidance. |
| `dispatch dual-run summary --repo <repo>` | Report the evidence window, class coverage, divergences, corroboration, and the four-condition verdict. |
| `dispatch dual-run resolve <divergence-id> --note <text>` | Append a bounded resolution to an open divergence. |
| `dispatch handover <repo> [--revert]` | Flip one repository to engine-authoritative, or append a reversal back to dual-run. |

A work-item reference matches `[A-Z]+-\d+`. The harness resolves from `--harness` when supplied and from the typed harness configuration otherwise; an unknown harness name is an input refusal. Grammar runs before any runtime call, and the handler returns data or a classified failure rather than choosing an exit digit.

Three refusals happen before any session attempt exists: an unknown harness, rejected input, and a conflicting lease. Each emits the classified envelope at exit `1` and appends no attempt record. Every failure after harness resolution, input validation, and lease claim is an attempt-stage failure and appends exactly one attempt record with its pinned token and outcome.

## One-shot dispatch

1. **Resolve the harness.** The flag wins over configuration; the selected adapter supplies spawn, resume, observe, collect, and liveness capabilities and its declared gaps.
2. **Claim the lease.** The scheduling engine claims the repository-exclusive lease for the reference. A live conflicting lease refuses at exit `1` without spawning.
3. **Spawn or resume.** A fresh run spawns through the harness session port. `--resume-prompt` resolves the existing lane, records the resume mode (`attach-continue`, or `resume-prompt-reentry` with its acknowledged prefill cost when the adapter lacks resume injection), and continues from the phase-ledger position. Completed phases are skipped idempotently.
4. **Watch with progress-based liveness.** Token delta, session traffic, worktree activity, or prefill advancement anywhere in the observed session tree counts as progress. A stall requires two consecutive sourced evaluations with no advance; a bare elapsed timer never stalls a lane. An absent reading stays absent or unknown and is never coerced to zero. The evaluation cadence is `lane.liveness-interval`.
5. **Admit restarts and resumes.** Restart admission delegates to the delivered restart-budget gate with the bound from `lane.restart-budget`. At or above the bound the attempt refuses `dispatch.restart-budget-exceeded` with result token `max-restarts`, outcome `failed`, exit `1`, one attempt record, the delivered terminal exhaustion record, and a typed escalation. Resume economics delegates to the delivered admission: attach-and-continue consumes no restart ordinal, an uneconomical prefill re-pay refuses `dispatch.resume-uneconomical` with token `failed`, outcome `failed`, exit `1`, and one attempt record, and unreadable token or cost facts refuse rather than admit.
6. **Classify and derive truth.** The shared classifier yields a harness outcome and token; truth derivation then decides the final token from branch commits, PR state and URL, ledger progress, tracker state, and CI. A success claim is never accepted on an exit code alone.
7. **Record and render.** One attempt record is appended under the state fence, and the command renders either the four-key bash-continuity text or the machine envelope.

## Result derivation and exit projection

Result derivation is artifact-first:

- An exit-0 session with no branch commit, no PR, and no ledger progress is `failed`; the missing artifact is named.
- An open PR is `pr-open`; an open PR whose URL cannot be resolved is `pr-open-unverified` with `urlResolved: false` recorded as an engine-side attribute. URL resolution is not part of the comparison and never creates a divergence.
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
| Harness spawn refusal (no error identity) | exactly one | `noop-lane-permission` | `refused` | 1 | not applicable, token null, reason `dispatch-session-family` |
| Unknown harness, rejected input, or conflicting lease before a spawn | none | none | none | 1 | none |

All four recorded failure classes count for class coverage as exposure, make no success claim, create no divergence, and block nothing.

### Text and machine output

Text mode emits exactly four ordered keys:

```
result=<one of the eleven tokens>
pr_url=<url or empty>
exit_code=<0|1|2>
last_message=<bounded, redacted, single line>
```

The bash-internal `closeout_unverified=` key is not part of this contract; dispatch expresses unverified outcomes through `pr-open-unverified` and `state-unverified`.

Machine mode renders the standard command envelope. Dispatch `data` carries `result`, `prUrl`, `phaseLedger` (`completed`, `total`, `variant`), `restarts`, `resumeAmplification`, `harness`, `handoverState`, `outcome`, and `lastMessage`, plus a bounded `truncation` marker when a field is cut. An attempt-stage classified failure carries the result and outcome plus a classified error object; a pre-session refusal uses the standard top-level error envelope.

Dispatch has no merge port and no merge code path. A merge-ready PR stays `pr-open` or `pr-open-unverified` for the coordinator's `merge`.

## Dual-run evidence

### Attempt record

Every dispatch that reaches classification appends exactly one `dispatch.attempt` record (`delivery.dispatch.attempt.v1`) under the state fence:

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

`token` is null if and only if the comparison class is `not-applicable`, and the comparison outcome is `not-applicable` if and only if the class is. A divergence is appended if and only if the outcome is `mismatch`. Verify-family attempts compare against the verify-change ledger outcome; tracker-family attempts compare against the tracker fact; dispatch-session tokens and dispatch-derived failures carry a not-applicable comparison. A success claim contradicted by artifact, tracker, or CI truth is recorded as a false-success incident with bounded evidence.

### Divergence and handover records

- `dispatch.divergence` (`delivery.dispatch.divergence.v1`) opens on a comparison mismatch and folds latest-per-divergence. A resolution appends a second record with `state: resolved`, a bounded note, the recording principal, and the timestamp; the original open record remains.
- `dispatch.handover` (`delivery.dispatch.handover.v1`) records one authority operation (`authoritative` or `dual-run`) per repository, with the conditions snapshot at decision time, bounded evidence references, principal, and timestamp. History is append-only; a reversal is a new record, never a deletion.

### Authority view

`dispatch-authority.json` is the derived per-repository authority document (`delivery.dispatch.authority.v1`), rebuilt from the folded handover ledger and replaced atomically. It carries the repository identity, `authority` (`dual-run` or `authoritative`), the handover reference, the recorded time, and reversal availability. An absent, unreadable, or malformed view resolves to `dual-run`; it is never treated as authoritative.

### Evidence classes and counting

Production handover counts only `pilot` attempts. A controlled scope counts only `controlled-proof` attempts in its own controlled repository scope. `smoke` and `fixture` attempts count toward no handover. A record whose class does not match the scope is surfaced as excluded rather than silently accepted.

### Evidence window

The window lower bound is the most recent false-success incident's recorded timestamp, exclusive, when an incident exists; otherwise it is the first counted dispatch, inclusive. A dispatch recorded exactly at the incident timestamp is excluded. The summary reports `windowStart` and the closed `windowStartReason` (`first-counted-dispatch`, `false-success-incident-reset`, `no-counted-dispatch`). Resolved divergences do not reset the window; a false-success incident does.

A record-level unevaluable read degrades only that record: a non-success token still counts for class coverage and does not block, while an uncorroborated success claim fails corroboration as one named unmet condition without creating a divergence or resetting the window. An unreadable, torn, or truncated evidence-stream read makes eligibility unverifiable and is never reported as eligible.

## Handover gate

Eligibility for a repository is the conjunction of four separated facts over the counted dispatches in the evidence window (TDR-0015):

1. **Truth.** Zero false-success incidents and zero unresolved divergences.
2. **Coverage (exposure only).** The set of result tokens across counted dispatches equals the eleven-token TDR-0005 set; every missing class is named. A non-success token counts for coverage, makes no success claim, creates no divergence, and does not by itself block.
3. **Floor (floor-only).** At least 20 counted dispatches or at least 7 consecutive UTC dates with at least one counted dispatch, whichever comes first. The floor never substitutes for truth, coverage, or corroboration.
4. **Corroboration (success claims only).** Every counted success-claimed token has the evidence its outcome family requires. A `merged` claim needs the pushed head, CI on that head, tracker state, and completed phases; a tracker-derived claim needs the tracker fact; `finished` needs the completed phase ledger; `noop-lane-nothing-to-do` needs the ledger or queue fact that no work remains. Non-success tokens satisfy corroboration vacuously.

`dispatch dual-run summary --repo <repo>` reports the window and reason, elapsed day count, counted deliveries, counted and excluded evidence classes, incidents, divergences (reported, resolved, unresolved, identifiers), coverage present and missing, corroboration satisfaction, the floor, the verdict (`eligible`, `ineligible`, `unverifiable`), and every unmet condition. A readable summary exits `0` even when ineligible.

`dispatch handover <repo>` evaluates the same predicate. A readable but unmet bar is a clean refusal at exit `1` that names every unmet condition and appends no authority-changing record. An unreadable or torn evidence read refuses at exit `2` with the classified identity and appends no authority-changing record. A met bar appends one handover record, flips only the resolved repository identity to `authoritative`, refreshes the authority view atomically, and reports the flip as recorded and reversible. Other repositories stay in `dual-run`.

`dispatch handover <repo> --revert` appends a reversal record and restores `dual-run` while preserving history. Reverting a repository already in `dual-run` is an idempotent noop at exit `0`. Replaying the same handover or reversal record appends no duplicate record.

Repository identity resolves in order from the scheduling engine's normalized `repository` key, the checkout's configured VCS remote normalized to `host/owner/name`, or a persisted first-use marker created through store-managed artifact semantics. A checkout-path digest is never presented as identity. An unresolvable identity is a clean refusal at exit `1`.

## Harness and daemon composition

The production composition supplies the real harness session port for the configured kind. It builds opencode over the host spawn runner with the deny-by-default environment builder and the shared classifier/liveness assembly; the Claude Code adapter supplies its declared spawn and collect capabilities. Dispatch spawns through the port and never branches on harness kind outside the adapter.

The daemon composition supplies `createLaneLaunchPlanner`: a pure planner that returns the lifecycle prompt and only the declared environment variable names, resolving no secret value and reading no parent environment. It composes `createLaneExecutor` over the selected session port and execution-environment descriptor, so the resident daemon can claim, start, record, observe, collect, and resume lanes. An unavailable planner or declared capability gap leaves the daemon in honest `supervise-only` mode.

The daemon path hands the same lane observation and collection evidence to `recordDaemonDispatchResult`, which derives the outcome and token through the same shared classifier and truth derivation, builds the same comparison and corroboration records, and appends exactly one attempt record through the same ledger. A daemon-driven attempt therefore agrees with a one-shot dispatch over the same evidence, and a replay or resume of the same attempt appends no second record.

A one-shot `dispatch <ref>` works from state alone with no daemon, no socket, and no resident process.

## Bash fallback

`scripts/lib/dispatch-authority.sh` reads the derived authority document as a plain file with ordinary shell tooling. It performs no typed CLI invocation, PATH lookup, network, or model call. `deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, and `ceo-loop.sh` source it at startup:

- In `dual-run` the scripts behave as before: same arguments, outputs, exit behavior, and no deprecation pointer.
- In `authoritative` they print a bounded deprecation pointer on stderr naming `dispatch <ref>` and `dispatch handover <repo> --revert`, and they remain executable as fallback.
- When the authority view is absent, unreadable, malformed, or torn, the resolver reports `dual-run`; a missing or broken typed installation never breaks the bash stack.

## Error identities

The `dispatch` error kind carries four rows, all non-retryable with consequence `not_landed`:

| Code | Category | Projection | Exit | Meaning |
|---|---|---|---|---|
| `dispatch.session.spawn-failed` | user | user-validation | 1 | The harness or process failed before a session existed. |
| `dispatch.restart-budget-exceeded` | user | user-validation | 1 | Restart admission was refused on an existing lane. |
| `dispatch.resume-uneconomical` | user | user-validation | 1 | Resume admission was refused on an existing lane. |
| `dispatch.state-unverified` | platform | platform-provider | 2 | Dispatch truth could not be read, so no verdict was derived. |

Every dispatch failure resolves by exact code; no kind-only dispatch discriminant is assumed to resolve to one row. Prose is never identity, and no dispatch path exits outside `{0, 1, 2}`.

## Bounds and configuration

| Bound | Value |
|---|---|
| Attempt records per summary read | 5,000 |
| Machine `data` | 65,536 UTF-8 bytes |
| Human output | 40 lines, 8,192 bytes |
| `last_message` | 512 characters, single line, redacted |
| Evidence references per record | 16 |
| Divergence resolution note | 240 characters |
| Unresolved divergence ids in a summary | 20 |
| Evidence classes | `pilot`, `controlled-proof`, `smoke`, `fixture` |
| Exposure floor | 20 counted dispatches or 7 consecutive UTC dates |

Configuration reuses the delivered harness branch and the `lane` policy keys: `lane.liveness-interval` (default `30000` ms) is the liveness cadence and `lane.restart-budget` (default `3`) is the restart bound. Dispatch introduces no new configuration key and reads no ambient environment outside the injected harness descriptor and credential seam. The summary read is bounded; a truncated read is declared and makes eligibility unverifiable rather than eligible, and summary and handover evaluation make no model or provider call.

## Quality evidence

The enduring coverage map is the [dispatch engine test specification](../../quality/test-specs/test-spec-dispatch-engine.md). The principal suites are the dispatch truth, liveness, evidence, gate, handover, resume, bash-fallback, help, daemon, and controlled-proof suites under `tests/behaviour/`, `tests/structure/`, `tests/golden/`, `tests/conformance/dispatch/`, and `scripts/.tests/`; `pnpm check:help` and the aggregate `pnpm check` cover the registration and conformance surfaces.

## Related

- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the prompt-required composition that includes `dispatch`.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the four dispatch rows, and the exit projection.
- [Harness Adapters](feature-harness-adapters.md) — the session port, both delivery adapters, and the shared classifier.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — lane supervision and the daemon-side attempt-record producer.
- [Scheduling Engine](feature-scheduling-engine.md) — the repository lease dispatch claims and releases.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the restart-budget gate and resume-economics admission.
- [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md) — the delivery-result vocabulary and the verify-change comparison baseline.
- [Dispatch reference page](../../planning/oss-tooling/milestones/m1/commands/dispatch.md)
- [TDR-0015 — Dispatch handover gate operational semantics](../../decisions/TDR-0015-dispatch-handover-gate-operational-semantics.md)
- [TDR-0005 — Delivery result enum and CLI exit taxonomy](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md)
- [TDR-0010 — Dispatch session classification token projection](../../decisions/TDR-0010-dispatch-session-classification-token-projection.md)
- [ADR-0008 — Harness adapter contract](../../decisions/ADR-0008-harness-adapter-contract.md)

**Change record:** `doc/changes/2026-11/2026-11-08--GH-239--dispatch-engine/`.
