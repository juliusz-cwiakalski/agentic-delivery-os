# M1 outcome test scenarios: the API prototype (planned)

Exact test scenarios designed upfront: each names the command executed,
the expected observable response, and machine-checkable assertions, so
the API design can be read, course-corrected, and improved before
delivery (design by example). Conventions in [../README.md](../README.md);
field contracts in [contracts.md](contracts.md); transcripts in
[interactions.md](interactions.md).

Status semantics: these scenarios are the **seed for each owning story's
test plan** at delivery (chg-\<ref\>-test-plan.md inherits and extends
them). The owning story reconciles this file when implementation refines
a detail; divergence discovered later is a defect, not a fork. Scenario
ids are stable (SC-M1-NN) and cited from contracts and story test plans.

Format per scenario: Given (world state), When (exact invocation), Then
(observable behavior: text keys, envelope fields, side effects on
state/tracker/repo), Assert (machine-checkable).

Shared pins (apply everywhere, stated once):

- A clean refusal is a successful verification with a negative verdict:
  `result=refused`, exit 1, classified error naming the gate or
  condition, remediation hint present. Never exit 0; never exit 2;
  never silence.
- Exit 2 is reserved for platform/provider faults and state-unverified
  outcomes, always with a classified error.
- Every command re-run is safe (idempotent convergence).
- Text mode prints the bash-continuity keys where a predecessor existed;
  `--json` emits the envelope with `data` or `error`.

## A. Truth and transaction

### SC-M1-01: merge lands clean (M1-S4)
Given: GH-301 PR open, all gates verified fresh (within bound), tracker
in review, CI green on pushed SHA.
When: `<binary> merge GH-301`
Then: `result=merged` squash SHA printed, branch deleted, landing
verified by SHA present on base; closeout-ready state recorded.
Assert: base branch HEAD advanced by exactly one squash commit; PR
state merged; envelope data.result == merged; exit 0.

### SC-M1-02: merge refuses stale gates with inline evidence (M1-S4)
Given: gates for GH-302 verified 31m ago (freshness bound 30m); CI has
a new failing job on the head SHA.
When: `<binary> merge GH-302`
Then: `result=refused`, the failed freshness/gate named, the evidence
inline (verification age, new red job id), remediation hint re-run
verify gates.
Assert: exit 1; error code merge.gates-stale or merge.gate.<id>.failed;
base HEAD unchanged; no PR state change.

### SC-M1-03: merge catches a post-verification tracker flip (M1-S4)
Given: gates verified 2m ago; ticket then transitioned to an
owner-gated state.
When: `<binary> merge GH-303`
Then: refusal names tracker-freshness with the transition and its age.
Assert: exit 1; no merge; the refusal cites the owner-gate scan.

### SC-M1-04: repo-declared gate enforced without code (M1-S4)
Given: project config declares a custom gate (workspace test gate).
When: `<binary> verify gates GH-304` then `<binary> merge GH-304`
Then: the custom gate appears cited like a built-in; failing it refuses
the merge.
Assert: gate list includes the config-declared id; no source change was
needed (asserted by review); refusal shape as SC-M1-02.

### SC-M1-05: vacuous deploy reads unknown (M1-S4)
Given: deploy pipeline created but zero jobs ran.
When: `<binary> verify deploy GH-305`
Then: verdict unknown with the job trace showing zero steps; never
green.
Assert: data.verdict == unknown; exit 1 with classified finding.

## B. Plans and scheduling

### SC-M1-06: overlap answers sequence with paths (M1-S13)
Given: GH-306 and GH-307 plans both declare writes to
packages/core/src/contracts/queue.ts.
When: `<binary> plan overlap GH-306 GH-307`
Then: `verdict=run-in-sequence`, overlapping paths listed, ordering
producer-first.
Assert: exit 0; every listed path exists in both declared scopes.

### SC-M1-07: ready-for-development gate refuses an unvalidatable plan
(M1-S13)
Given: GH-308 plan missing per-phase scope for phase 6.
When: `<binary> plan validate GH-308`
Then: classified error plan.schema.invalid naming the phase and missing
field; ready=false.
Assert: exit 1; queue add of GH-308 warns the entry is parked behind a
valid plan.

### SC-M1-08: same-repo single-flight (M1-S17)
Given: two ready entries target repo-alpha; no lease held.
When: the queue schedules (daemon or `queue plan`)
Then: exactly one lane takes the repo-alpha lease; the other waits with
reason lease-held.
Assert: lease records show one holder; the waiting entry names the
holder and lease id.

### SC-M1-09: heavy build not co-scheduled (M1-S17)
Given: runner R2 carries a heavy-class job; GH-309 is heavy-class and
ready.
When: scheduling computes
Then: GH-309 held with reason weight-class; standard-class entries
still scheduled (not a lane cap).
Assert: at most one heavy job per runner in the schedule; standard
entries unaffected.

### SC-M1-10: close-first ranking (M1-S17)
Given: one merge-ready entry and one new start, both ready.
When: `<binary> queue plan --next 2`
Then: the merge-ready entry ranks first.
Assert: order asserted; reasons printed for both.

### SC-M1-11: park resumes exactly when its condition clears (M1-S17)
Given: lane parked on provider peak window ending at T; window ends.
When: the park condition re-check runs
Then: lane resumes within one re-check interval after T.
Assert: resume event timestamp within (T, T+interval]; a park still
held after condition clears surfaces finding
queue.park-condition-stuck.

## C. Execution and lifecycle

### SC-M1-12: atomic phase completion is the default (M1-S14)
Given: GH-310 phase delivery has pending work; one untracked stray
file exists.
When: `<binary> phase complete GH-310 delivery`
Then: ledger transition recorded AND conventional commit landed (both
or neither); stray file unstaged. `--no-commit` records the transition
alone.
Assert: ledger shows delivery complete; one commit with computed
subject; stray file still untracked in git status; with `--no-commit`,
no commit object is created.

### SC-M1-13: blocker round-trip without session re-entry (M1-S16)
Given: lane L2 blocked, published decision-needed with options.
When: `<binary> blockers answer q-8f21 --choice 2`
Then: answer recorded as data; L2 resumes at the next phase boundary;
no new session spawn for the resume.
Assert: answer record in state; resume event references the answer id;
harness session id unchanged (or attach-and-continue semantics
recorded).

### SC-M1-14: prefilling session never reads as stalled (M1-S15)
Given: a large session resuming (prefill in progress, rising token
delta, no phase output yet).
When: liveness evaluates
Then: progress signals (token delta, traffic) classify the lane
progressing; no kill.
Assert: no restart event; the lane state remains delivering.

### SC-M1-15: budget exhaustion escalates, never silently requeues
(M1-S15 + M1-S18)
Given: GH-315 at restart 3/3; next spawn fails again.
When: the restart budget evaluates
Then: queue entry marked failed (terminal, classified reason, restart
history); typed question raised within one collection cycle with
options (requeue with fresh budget, park for owner review).
Assert: no fourth spawn; queue entry state failed; blockers list shows
the question; digest ranks it.

### SC-M1-16: daemon restart reconciles dead lanes (M1-S18)
Given: host restarted mid-delivery; L1 process alive, L2 process gone
without a failure record, L3 recorded crash.
When: `<binary> daemon start`
Then: reconciliation classifies L1 alive (reattach), L2 interrupted
(resume from ledger, completed phases skipped, restarts+1), L3 crashed
(classified reason, per budget).
Assert: zero duplicated tickets/comments/commits (ids unchanged);
completed phases not re-executed; restart counters incremented exactly
once for L2.

### SC-M1-17: one-shot works daemon-down (M1-S17 + M1-S18)
Given: daemon stopped; queue has a ready entry.
When: `<binary> queue plan --next 1` then `<binary> dispatch <ref>`
Then: plan computed from state with degraded note; dispatch executes
one-shot.
Assert: exit 0 with degraded=daemon-unreachable recorded; state
consistent when the daemon later reconciles.

## D. Communication and contracts

### SC-M1-18: concurrent invocations without cross-talk (M1-S18)
Given: daemon up; two CLI processes issue requests simultaneously on
separate connections.
When: both `daemon status --live` queries run
Then: each receives its own response (id-correlated on its connection).
Assert: fixture-driven: two stdio transport connections replayed
concurrently; responses match asking connection; no frame leakage.

### SC-M1-19: envelope valid on failure (M0-S3 continuity, M1-wide)
Given: any command hitting a malformed input.
When: `<binary> <command> --json`
Then: valid envelope with error (code, category, retryable,
consequence, remediationHint); exit projected.
Assert: JSON parses; schemaVersion present; secrets absent.

### SC-M1-20: subscribe overflow degrades the subscriber, not the
dispatcher (M1-S18)
Given: a slow subscriber on topic lanes; a burst of lane events.
When: the subscription buffer overflows
Then: subscriber dropped to declared degraded mode (re-poll hint);
daemon dispatch loop unaffected.
Assert: dispatcher event loop latency unchanged (bounded); degraded
event emitted to the subscriber before drop.

## E. Profiles, watching, and audit

### SC-M1-21: profile eligibility with hard capability gate and
auto-switch revert (M1-S21)
Given: the chain is mixed, deepseek; the coding-plan subscription quota
just exhausted; a vision-capable task is queued for an agent whose tier
seats include a text-only profile candidate.
When: a harness spawn resolves its profile
Then: mixed is ineligible (provider exhausted) and deepseek is selected
automatically; the text-only candidate is refused for the vision task
regardless of chain position (hard gate); when the subscription resets,
the target reverts to mixed.
Assert: env record emitted as validated data (never shell code); the
eligibility list names the blocker per refused profile; revert event
recorded on recovery; judgment seats unchanged across pacing rungs.

### SC-M1-22: expensive window parks; exhaustion switches (M1-S21)
Given: a provider enters its declared peak window (priced multiplier);
another provider's balance is exhausted.
When: profile resolution runs
Then: the peak-window provider parks with cause and expiry and resumes
exactly when the window clears; the exhausted provider does not park
the spawn - the chain switches to the next eligible profile.
Assert: park record carries cause and expiry; switch event carries the
new target and revert condition; no sleep-without-record path exists.

### SC-M1-23: every invocation audited; scripted output trimmed
(M1-S22)
Given: an agent runs `<binary> lanes list --json` through a shell whose
environment carries the agent-name convention (PM session shell).
When: the command completes
Then: exactly one audit record exists (runId, command, args redacted,
exit, timing, agent identity); the agent's stdout is one minified
`{"data":...}` line without schemaVersion, runId, or timing (an error
line keeps runId).
Assert: audit record retains the trimmed fields; identity captured when
present and absent-never-inferred otherwise; re-run produces a second
record with a new runId; no secret patterns in the record.

### SC-M1-24: cross-audience answer refused (M1-S16)
Given: question q-9043 is addressed to audience owner; the answering
identity is the coordinator.
When: `<binary> blockers answer q-9043 --choice 1`
Then: refused with blockers.audience-mismatch naming the audience and
the delegation policy (none).
Assert: exit 1; no answer record applied; the question remains open.

### SC-M1-17b: daemon-down one-shots are mutually exclusive (M1-S17)
Given: daemon stopped; two one-shot dispatches target the same repo; no
lease held.
When: both run concurrently
Then: exactly one acquires the lease via the fence-token state path;
the other refuses with lease-held evidence naming the holder.
Assert: one lease record with heartbeat; the refused process exits 1
with the lease holder named; a stale lease (TTL exceeded, no heartbeat)
is taken over with evidence.

### SC-M1-25: coordinator supervision lifecycle (M1-S23)
Given: a coordinator session mid-iteration; context pressure rises; a
coordinator-audience question is ranked top-of-digest.
When: supervision evaluates
Then: the join-or-resume decision is recorded and applied; a stuck
coordinator (no digest consumed, no merge, no answer within the declared
window) is detected by artifact evidence, killed with grace, and
restarted within budget; the typed question wakes the next iteration
within one collection cycle.
Assert: restart events classified; exhaustion escalates to the owner
brief (never silent); the ceo-loop function map (resume decision, stuck
detection, kill, budget, wake) is covered.

### SC-M1-26: dispatch classifies the happy path (M1-S9)
Given: a clean dual-run delivery lands its PR.
When: the typed dispatch loop completes
Then: classification `pr-open` with the key=value summary matching the
bash shape (`result=`, `pr_url=`, `exit_code=`, `last_message=`).
Assert: token parity with the bash enum (TDR-0005); summary keys
identical.

### SC-M1-27: exit-0-with-no-artifact classifies failed (M1-S9)
Given: the spawned session exits 0 but no PR or branch commits exist.
When: classification runs
Then: result `failed` (exit 1), never success; the missing artifact is
named.
Assert: classification checks artifacts, not exit codes.

### SC-M1-28: resume-prompt path (M1-S9)
Given: a lane blocked on a question is answered; the harness adapter
lacks resume injection.
When: the resume applies
Then: the resume mode records `resume-prompt-reentry` with its prefill
cost acknowledged; the lane continues from its ledger position.
Assert: mode recorded; phases before the block are not re-executed.

### SC-M1-29: handover flips one repository (M1-S9)
Given: repo-alpha's clean window met (two weeks, zero false-success,
zero unresolved divergences); repo-beta's not.
When: handover runs
Then: repo-alpha flips to engine-authoritative (recorded, reversible)
with bash fallback notices; repo-beta does not flip and names its
remaining window.
Assert: per-repo isolation of the flip; bash entry points still execute
for repo-beta.

### SC-M1-30: dual-run summary counts evidence (M1-S9)
Given: fourteen days of dual-run evidence with two reported divergences,
both resolved.
When: `<binary> dispatch dual-run summary --repo <repo>`
Then: the summary counts days, deliveries, incidents (zero
false-success), divergences (two, resolved), and states eligibility.
Assert: eligibility logic = clean window met; unresolved divergence
blocks eligibility.

## Coverage map

| Story | Scenarios |
|---|---|
| M1-S4 | SC-M1-01..05 |
| M1-S9 | SC-M1-26..30 |
| M1-S13 | SC-M1-06..07 |
| M1-S14 | SC-M1-12 |
| M1-S15 | SC-M1-14..15 |
| M1-S16 | SC-M1-13, SC-M1-24 |
| M1-S17 | SC-M1-08..11, SC-M1-17, SC-M1-17b |
| M1-S18 | SC-M1-15..18, SC-M1-20 |
| M1-S21 | SC-M1-21..22 |
| M1-S22 | SC-M1-23 |
| M1-S23 | SC-M1-25 |
| cross-cutting | SC-M1-19 |

Coverage rule: every M1 story AC traces to an SC-M1 id here or to a
named story-local test case in its own test plan; a story test plan
without that traceability fails its own DoR. Stories not listed (S1,
S2, S3, S5, S6, S7, S8, S10, S11, S12, S19, S20) inherit the pattern
at test-plan time with story-local TC ids recorded in their plans.
