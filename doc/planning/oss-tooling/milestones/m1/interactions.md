# M1 outcome interactions: exact CLI sessions (planned, illustrative)

Concrete example sessions with the M1 command surface: exact inputs and
outputs as the tools are proposed to behave. Illustrative and proposed:
outputs show the shape and semantics each story must deliver, not shipped
behavior; refinement happens at story delivery. Conventions in
[../README.md](../README.md); the field-level contracts are in
[contracts.md](contracts.md); daemon communication design is in
[architecture.md](architecture.md) (section Daemon communication).

All examples use `<binary>` for the invocation prefix and example refs in
the GH-3xx range (illustrative only; M1 story tickets take their own
numbers).

## Session A: the coordinator iteration (healthy day)

The full loop with zero tokens spent waiting or polling.

```
$ <binary> status
attention digest - 2026-11-17T09:00:12Z - 4 repos - collected in 3.1s

READY TO MERGE (act list)
  1. GH-301 feat/merge-transaction   merge-ready  gates verified 4m ago  ci green 12/12
  2. GH-303 docs/plan-schema         merge-ready  gates verified 11m ago ci green 9/9

TYPED QUESTIONS (2 open)
  q-8f21  decision-needed    GH-302  plan tier: full or lite for the closeout residue sweep?
                                    options: [1] full  [2] lite+escalation  age: 14m
  q-8f37  external-wait      lane L3 provider peak window ends 10:30Z (auto-resumes)

LANES
  L1 GH-301  delivering   phase 10 dod_check      restarts 0  amp 1.0
  L2 GH-302  idle-waiting on question q-8f21       restarts 0  amp 1.0
  L3 GH-304  parked       provider window          resumes 10:30Z (checked every 60s)

OWNER GATES AGING
  waiver W-12 (merge.bypass-suite-breadth)  age 2d  policy: owner-review-first

SPEND (7d)  tokens 41.2M  resume-amplification 1.03  restarts 3
```

```
$ <binary> blockers answer q-8f21 --choice 2
answered q-8f21 (decision-needed, lane L2 / GH-302)
choice: lite+escalation  recorded-by: coordinator
lane L2: resuming without session re-entry (resume note queued at phase boundary)
```

```
$ <binary> merge GH-301
merge transaction GH-301
  gates: lifecycle-finalization ok (11/11 phases, variant full)
  gates: ci-on-pushed-sha ok  pipeline 44821  sha 9f21c0e  12/12 green  verified 4m ago (bound 30m)
  gates: push-parity ok  local==remote
  gates: owner-gate-scan ok  no unanswered asks
  gates: squash-preflight ok
  tracker freshness: re-checked 1s ago  ticket in review, no owner-gated transition
  landing: squash merged as a1b2c3d  branch deleted  landing verified by SHA on base
result=merged pr_url=https://example/PR/331 exit_code=0
```

```
$ <binary> closeout GH-301
closeout GH-301 (apply)
  ticket: GH-301 -> done  labels swept (in-progress->done)  unassigned
  owed-flip sweep: 2 hits -> flipped to owner-owed (flag STRIPE_RETRY, note in doc/x.md)
  comment threads: 4/4 resolved
  branch/worktree: cleaned  checkout restored to base
  capsule: closed  events 61  candidates 3 -> promoted 1, rejected 2 (reasons recorded)
  telemetry: captured to event log (session-tree attributed)
JUDGMENT RESIDUE (for you, 1 item)
  - PR thread t-77 by @reviewer-bob is unresolved but non-blocking: "rename retryPolicy?"
result=ok exit_code=0
```

```
$ <binary> queue plan --next 3
1. GH-303 merge-ready (close-first)            lane L4  lease: repo-alpha free
2. GH-302 resume at phase boundary (answered)  lane L2  lease: repo-beta free
3. GH-305 start (deps satisfied: GH-301 merged) lane L1 lease: repo-alpha after GH-303
   weight: heavy (native build) - held while runner R2 carries one heavy job (ETA 22m)
```

## Session B: planning a batch (parallelism computed)

```
$ <binary> plan validate GH-306
plan GH-306 (variant: full, tier data from plan)
  phases 1-5 preparation   lease: none (parallel-safe)
  phases 6-11 delivery     lease: repo-gamma (repo-exclusive)  weight: standard
  declared scope: packages/core/src/scheduler/** (3 phases), doc/spec/** (1 phase)
  done-artifacts: PR URL (phase 11), pipeline id (phase 9), tracker transition (phase 10)
  interactions: writes packages/core/src/contracts/queue.ts (contract file, 1 consumer)
verdict=valid ready-for-development=true exit_code=0
```

```
$ <binary> plan overlap GH-306 GH-307
verdict=run-in-sequence
overlapping-paths:
  packages/core/src/contracts/queue.ts      GH-306 phase 6 <-> GH-307 phase 2 (producer/consumer)
  doc/spec/features/feature-scheduler.md    GH-306 phase 7 <-> GH-307 phase 3
reason=shared-contract-files ordering=GH-306-before-GH-307
```

```
$ <binary> queue add GH-306 --priority 2 && <binary> queue add GH-307 --priority 2 --dep GH-306
GH-306 queued (priority 2)  daemon notified (poke ack 12ms)
GH-307 queued (priority 2, dep GH-306)  daemon notified (poke ack 9ms)
```

## Session C: inside a lane (lifecycle agent side)

```
$ <binary> commit GH-306 --phase delivery --dry-run
computed commit (dry-run):
  subject: feat(GH-306): scheduler lease acquisition and hand-off
  body: phase delivery; declared scope 3 files; plan diff within scope
  staged: packages/core/src/scheduler/lease.ts
          packages/core/src/scheduler/handoff.ts
          packages/core/src/scheduler/index.ts
  untracked-not-staged: tmp/scratch-notes.md (left alone)
```

```
$ <binary> phase complete GH-306 delivery
ledger: delivery -> complete (recorded)
atomic record+commit: commit 7c31e9a landed  both-or-neither: ok
daemon: notified (lane state advanced)
```

A lane blocked mid-phase publishes instead of stalling:

```
$ <binary> blockers publish decision-needed --lane L5 \
    "spec-ambiguity: closeout residue sweep full or lite?" --options full,lite+escalation
q-8f41 published (decision-needed) ranked #1 in digest  next collection <60s
```

## Session D: daemon lifecycle and degradation

```
$ <binary> daemon start
daemon started  pid 22143  single-instance lock acquired (fence token t-91)
state recovery: queue 6 entries, lanes 3 live, 1 parked  reconciled 0 duplicates
control socket: <state-dir>/daemon.sock  heartbeat: every 5s to state
supervisor: systemd unit delivery-engine-daemon
```

```
$ <binary> daemon status
uptime 3d 2h  queue depth 4  lanes L1,L2,L5 delivering  L3 parked
restarts this week: 1 (reason classified: provider outage, not a crash)
heartbeat age 1s  socket reachable  merge code path: absent (never fires merges)
```

Daemon killed uncleanly; commands keep working:

```
$ <binary> queue plan --next 1
note: daemon unreachable (socket <state-dir>/daemon.sock) - degraded mode
  reads from state (heartbeat age 71s, declared stale)  schedules computed one-shot
1. GH-303 merge-ready (close-first) ...
exit_code=0  degraded=daemon-unreachable
```

```
$ kill -9 22143; <binary> daemon start
daemon started  pid 22377  lock: previous fence t-91 stale (age 71s) -> takeover recorded
state recovery: 3 deliveries mid-flight resumed idempotently  0 duplicated tickets/comments/commits
```

Every daemon interaction has a state-only fallback: `queue add` without a
socket writes the entry (daemon reconciles on start); `blockers answer`
queues the resume note in state; watch streams degrade to bounded state
polling with a declared mode.

## Session E: parks, weight classes, and windows

```
$ <binary> provider parks list
P-31 provider-b  cause: peak-window  expires 10:30Z  recheck every 60s
P-32 provider-c  cause: quota-exhausted  expires: daily reset 04:00Z
```

```
$ <binary> queue plan --next 2
...
2. GH-305 held: weight heavy (native build); runner R2 carries one heavy job (ETA 22m)
   note: not a lane cap - L6..L9 (standard) proceed freely in parallel
```

A park that outlives its condition is a bug class, surfaced as such:

```
$ <binary> status
...
PARKED
  L3 provider window ended 10:30Z but lane still parked (age 19m past condition)
  finding=queue.park-condition-stuck severity=high action=auto-recover+record-incident
```

## Session F: spend and doctor

```
$ <binary> spend --ref GH-302 --amplification
GH-302 tokens 3.9M  by-class: input 61% cache-read 29% output 10%
  per-phase: p6 delivery 58%  p8 review 21%  rest <10% each
  per-agent: coder 2.1M  reviewer 0.9M  pm 0.6M  fixer 0.3M
  restarts 0  resume-amplification 1.02 (healthy ~=1)
```

```
$ <binary> doctor
repo        ok   base=main-tools clean=true
tracker     ok   Jira reachable  auth ok  projects mapped
provider    FAIL provider-c token expired (env PROVIDER_C_TOKEN)
            fix-hint: refresh the token, then `provider quota --provider provider-c`
state       ok   all stores validate (4/4)  torn reads 0
ci          ok   3 platforms reachable  last probe 8s ago
exit_code=1
```

## Session G: handover day (per repository)

```
$ <binary> dispatch dual-run summary --repo repo-alpha
repo-alpha dual-run evidence: 14 days  41 deliveries
  false-success incidents: 0  divergences: 2 (both reported, both resolved)
  parity: verify-change token-level comparison clean 14/14 days
eligible for handover: yes
```

```
$ <binary> dispatch handover repo-alpha
repo-alpha: engine now authoritative (recorded, reversible)
bash entry points print deprecation pointers and remain installed as fallback
tracker/PR labels moved to engine-managed set
```

## Session H: machine output (`--json`)

```
$ <binary> merge GH-303 --json
{"schemaVersion":1,"runId":"r_01H...","exitCode":0,
 "timing":{"started":"...","durationMs":8412},
 "data":{"result":"merged","ref":"GH-303","squashSha":"b2c3d4e",
         "gates":[{"id":"lifecycle-finalization","verdict":"ok","evidence":"phases 11/11"},
                  {"id":"ci-on-pushed-sha","verdict":"ok","evidence":"pipeline 44829, 9/9"}],
         "trackerFreshness":{"checkedAt":"...","state":"review"}}}
```

A failing command still emits a valid envelope; state-unverified exits 2
and says why.
