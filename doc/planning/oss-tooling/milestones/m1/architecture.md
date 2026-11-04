# M1 outcome architecture: delivery engine and autonomous dispatch (planned)

The system at M1 exit: the bash delivery stack is demoted to fallback and
the typed engine is authoritative on pilot repositories. Planned state;
story numbers reference [../../backlog.md](../../backlog.md). The pack
conventions are in [../README.md](../README.md); the recorded operator
input is
[../../operator-requirements-2026-11.md](../../operator-requirements-2026-11.md).

## C4 Level 1: system context (M1 end state)

```mermaid
flowchart TB
    subgraph people
        OWNER[Owner<br/>accepts records, reads brief, gates waivers]
        COORD[Coordinator agent<br/>plans, answers, merges, closes out]
        LANE[Lifecycle agents<br/>PM session and lane agents per change]
    end
    subgraph external
        TRACKER[(Tracker<br/>Jira or GitHub)]
        VCS[(VCS and CI<br/>repos, MRs, pipelines, deploys)]
        HARNESS[(Harnesses<br/>opencode, Claude Code)]
        LLM[(AI providers<br/>subscription first, parks)]
    end
    ENGINE[delivery engine<br/>status, truth engines, plans,<br/>queue, daemon, merge transaction]
    BASHF[bash stack<br/>demoted fallback with<br/>deprecation pointers]
    OWNER -->|SLA asks, brief, waivers| ENGINE
    COORD -->|plan batch, typed answers, merge, closeout| ENGINE
    ENGINE -->|typed questions, digest| COORD
    ENGINE -->|spawn, resume, liveness| HARNESS
    HARNESS --> LANE
    ENGINE --> TRACKER
    ENGINE --> VCS
    ENGINE -->|provider engine| LLM
    COORD -.->|only if engine degraded| BASHF
    BASHF --> TRACKER
    BASHF --> VCS
```

M1 in one sentence: the coordinator plans (priorities, repos, dependencies
as one artifact), the machinery schedules and verifies, the coordinator
answers typed questions, merges, and closes out; between iterations zero
coordinator tokens go to waiting, polling, scheduling, or re-verification
of healthy paths.

## C4 Level 2: containers (M1 end state)

```mermaid
flowchart TB
    subgraph runtime [delivery engine runtime]
        CLISHOT[CLI one-shots<br/>every command, daemon-free]
        DAEMON[resident daemon<br/>single instance, crash safe<br/>drives lanes, never a lane<br/>never fires a merge]
        MCPS[mcp surface<br/>status, verify, gate report]
    end
    subgraph engines [engine layer]
        ATTN[attention plane<br/>status collectors, digest, brief,<br/>board SLA, blockers rank]
        TRUTH[truth and transaction plane<br/>verify change, verify gates,<br/>merge transaction, verify deploy,<br/>doctor, state validation, watchdog]
        PLAN[planning plane<br/>plan schema, overlap,<br/>ready-for-development gate]
        SCHED[scheduling engine<br/>queue, lanes, leases,<br/>weight classes, parks]
        EXEC[execution plane<br/>dispatch, harness adapters,<br/>commit primitive, session economics]
        LEARN[learning plane<br/>retro pipeline, capsule,<br/>closeout expansion, spend read side]
    end
    STATE[(state layer<br/>validated at every boundary)]
    CONFIG[(config layer<br/>gate sets, tiers, harnesses as data)]
    BASH2[bash stack<br/>fallback entry points<br/>deprecation notices]
    CLISHOT --> engines
    DAEMON --> SCHED
    DAEMON --> EXEC
    MCPS --> ATTN
    MCPS --> TRUTH
    ATTN --> STATE
    TRUTH --> STATE
    PLAN --> STATE
    SCHED --> STATE
    SCHED --> PLAN
    EXEC --> STATE
    LEARN --> STATE
    engines --> CONFIG
    engines --> TRACKER3[(tracker, VCS, CI, providers)]
    EXEC --> HARNESS3[(harnesses)]
    BASH2 -.->|fallback only| STATE
```

## C4 Level 3: components (M1 end state)

```mermaid
flowchart LR
    subgraph attention [attention plane]
        ST[status digest<br/>collectors + finding codes M1-S10]
        BR[brief render-only<br/>same source as digest M1-S6]
        BD[board SLA<br/>aging, defaults M1-S5]
        BLK[blockers channel<br/>typed questions M1-S16]
    end
    subgraph truth [truth and transaction plane]
        VC[verify change M0-S8]
        VG[verify gates M0-S9]
        MG[merge transaction<br/>gate set as data,<br/>tracker freshness, waivers M1-S4]
        VD[verify deploy by trace M1-S4]
        DR[doctor M1-S3]
        SV[state validation M1-S2]
        WD[watchdog checks M1-S1]
    end
    subgraph planp [planning plane]
        PS[plan schema<br/>scope, artifacts, leases,<br/>tier as data M1-S13]
        OV[overlap engine<br/>sequence vs parallel M1-S13]
        RDY[ready-for-development gate M1-S13]
    end
    subgraph schedp [scheduling plane]
        QU[queue<br/>deps, priorities, close-first M1-S17]
        LN[lanes and leases<br/>per-repo single-flight,<br/>weight classes M1-S17]
        PK[parks<br/>condition-exact resume M1-S17]
    end
    subgraph exec [execution plane]
        DP[dispatch<br/>dual-run then handover M1-S9]
        HA[harness adapters<br/>opencode, Claude Code M1-S11]
        CM[commit primitive<br/>record-plus-commit M1-S14]
        SE[session economics<br/>progress liveness,<br/>restart budget M1-S15]
    end
    subgraph learn [learning plane]
        RT[retro pipeline M1-S8]
        CP[capsule + closeout residue M1-S12]
        SP[spend read side<br/>amplification metric M1-S19]
    end
    ST --> BLK
    MG --> VG
    MG --> VC
    QU --> RDY
    QU --> PK
    DP --> HA
    DP --> SE
    DP --> QU
    CM --> PS
    SP --> SE
    CP --> RT
```

## Key flows

### The coordinator iteration (M1 end state)

```mermaid
flowchart LR
    A[status digest<br/>one bounded read] --> B{typed questions?}
    B -->|yes| C[answer as data<br/>blockers answer]
    B -->|no| D[merge ref<br/>transaction verifies all gates fresh]
    C --> D
    D -->|lands| E[closeout<br/>mechanics plus judgment residue]
    D -->|refuses| F[gate named,<br/>evidence inline,<br/>no re-probe needed]
    E --> G[pick next<br/>queue already scheduled it]
```

Zero-coordinator-token zones: waiting for CI, polling lanes, discovering
parallelism, re-verifying healthy paths, session babysitting (daemon owns
all five).

### Parallel planning versus leased delivery

```mermaid
flowchart TB
    P1[plan A authored<br/>lease-free preparation] --> OVX[overlap check]
    P2[plan B authored<br/>lease-free preparation] --> OVX
    OVX -->|disjoint scope| PAR[parallel: both queue,<br/>repo-disjoint lanes run]
    OVX -->|shared paths| SEQ[sequence: order enforced<br/>by the dependency graph]
    PAR --> LSE[delivery phases take<br/>per-repo leases]
    SEQ --> LSE
    LSE --> JOINS[phase joins verify<br/>done-artifacts, not exit codes]
```

### Blocker round-trip (hours become seconds)

```mermaid
flowchart LR
    L[lane blocked] --> T[typed question published<br/>decision-needed with options]
    T --> R[ranked in digest and brief<br/>within one collection cycle]
    R --> AN[answer as data]
    AN --> AP[applied, lane resumes<br/>no session re-entry]
```

## Daemon communication (command to daemon contract)

Principle: **state-mediated truth, socket as optimization.** The state
layer is the only shared truth; the daemon is a state-machine driver over
it, not a server that owns data. Commands talk to the daemon through two
channels:

1. **State writes (always available, daemon or not).** Commands write
   intent records to the state layer: queue entries, dependency edges,
   blocker answers, resume notes. The daemon consumes the event log and
   reconciles; anything written while it was down is picked up on start
   (idempotent convergence).
2. **Control socket (optimization, never the only route).** A local
   control endpoint (unix domain socket at a path derived from the state
   dir; named pipe equivalent on Windows) carries wake-now notifications
   (so `queue add` takes effect in milliseconds, not at the next poll)
   and bounded live streams (`status --watch`, `lanes --watch` tail
   semantics). Reads of live process facts (uptime, current spawn,
   restart counters) come from the daemon's heartbeat record in state,
   written every few seconds; the socket serves immediate queries.

**Writer ownership (single-writer discipline under the state layer's
fence tokens):**

| Writer | Writes |
|---|---|
| commands (any invocation) | intent: queue entries, priorities, dependency edges, blocker questions and answers, resume notes, waivers |
| daemon | execution: lease acquisition and release, lane state, liveness heartbeats, park transitions, restart events and reasons |
| lifecycle agents | ledger: phase transitions, capsule events (through `phase` and `commit`) |

No writer ever mutates another writer's record class; conflicts are
prevented by fence tokens, not by convention.

**Every interaction has a state-only fallback:**

| Command (daemon up) | Daemon down |
|---|---|
| `queue add` | writes the entry; daemon reconciles on start |
| `queue plan` | computes from state; heartbeat age declared stale |
| `blockers answer` | answer and resume note land in state; lane resumes when the daemon (or a one-shot `dispatch --resume`) applies it |
| `status` / `lanes` | reads state; `--watch` degrades to bounded polling in a declared degraded mode |
| `dispatch` | one-shot execution path (the queue names the next action; the command executes it) |
| `phase complete` / `commit` | ledger writes; unaffected (never daemon-mediated) |

The daemon wakes on: control-socket poke, state-change notification, or a
bounded poll interval, in that order of preference.

### Control protocol v1 (the wire contract)

- **Transport:** unix domain socket at a path derived from the state dir
  (named pipe equivalent on Windows). Filesystem permissions are the
  authorization model for the local transport: the socket lives in the
  0700 state dir, same-user only; cross-user connections are refused
  with a classified error. No network transport ships by default and no
  tokens exist locally; non-local transports are config-selected per the
  layering section below, which is where an auth story appears.
- **Wire format:** newline-delimited JSON frames, the same serialization
  discipline as the state layer's JSONL event log. Every frame carries
  `v` (protocol version), `id` (correlation), `kind` (one of `request`,
  `response`, `event`, `error`), and `type`. Errors use the one internal
  error table (code, category, retryable, consequence, remediationHint)
  exactly as CLI errors do.
- **Versioning:** the daemon serves v(n) and v(n-1); an unsupported
  version is refused with `daemon.protocol.unsupported` naming the
  versions offered. Frame shapes are stable contracts like command
  output.
- **No business truth on the wire.** Every frame is derivable from state;
  losing or ignoring any frame leaves the system correct (side effects
  are at-most-once; the daemon reconciles from the event log). The only
  mutating frames delivered in M1 are control-plane (`stop`, `drain`,
  `takeover`), each also expressible without the socket (signal or
  state); the additive `intent` class arrives with remote transports.
- **Interaction classes:**
  1. `poke` (request): "state changed at event cursor N" - the daemon
     re-reads state. No business logic crosses the wire.
  2. `query` (request/response): immediate facts (`daemon status`,
     live lane state). Responses bounded, labeled `live`.
  3. `subscribe` (request then event stream): `status --watch`,
     `lanes --watch` receive bounded, deduplicated, finding-coded
     frames. Slow consumers never stall the dispatcher: each
     subscription has a bounded buffer and, on overflow, the daemon
     drops the subscriber to a declared degraded mode (re-poll state)
     rather than blocking dispatch - the dispatcher is never a lane,
     including for its own watchers.
  4. `control` (request/response): `stop` (drain: finish current lane
     bookkeeping, stop spawning), `takeover` guarded by the fence token.
- **Secrets never cross the wire:** credential facts are variable names
  only, consistent with the blockers channel contract.

Example frames (illustrative):

```
-> {"v":1,"id":41,"kind":"request","type":"poke","cursor":"e-004211"}
<- {"v":1,"id":41,"kind":"response","type":"poke","data":{"applied":true}}
-> {"v":1,"id":42,"kind":"request","type":"subscribe","topic":"lanes"}
<- {"v":1,"id":42,"kind":"response","type":"subscribe","data":{"ok":true}}
<- {"v":1,"kind":"event","type":"lane.state","data":{"lane":"L2","state":"delivering","phase":"delivery"}}
<- {"v":1,"id":43,"kind":"request","type":"stop","payload":{"mode":"drain"}}
<- {"v":1,"id":43,"kind":"response","type":"stop","data":{"draining":true,"lanes":3}}
```

### Transport layering and the remote seam

The protocol is layered so the transport is replaceable without touching
codec or logic:

- **Codec layer (transport-agnostic):** the NDJSON frames above, plus
  encode/decode and the error table. Knows nothing about sockets.
- **Session layer:** connection lifecycle, request/response correlation,
  subscriptions, bounded buffers, timeouts. Talks in frames, not bytes.
- **Transport layer (config-selected):** any ordered byte stream. Local
  default: unix domain socket (named pipe on Windows). The same protocol
  runs unchanged over stdio (used by conformance tests, proving transport
  independence), TCP or TLS sockets, an SSH-tunneled socket, or a pipe
  into a container or VM. Endpoint selection is configuration
  (`transport`, `address`), never code.

Remote and containerized control (a fleet of workers on remote hosts or
inside containers or VMs, per concepts/containerized-delivery.md and the
M1-S11 execution-environment descriptor) therefore needs no protocol
change, only a new transport implementation plus two additive seams that
M1 must not foreclose:

1. **The `intent` frame class (additive, not delivered in M1).** Locally,
   commands write intent to the shared local state and only poke. A
   remote CLI has no access to the daemon's local state, so it sends the
   same intent records as `intent` frames and the daemon applies them
   through its own state write path (idempotent, same schema, same fence
   discipline). Same records, same encoding, one new frame type.
2. **Handshake-level identity (additive).** Filesystem permission is the
   only authorization for local same-user sockets. Non-filesystem
   transports add an identity claim in a handshake frame with a
   pluggable verifier (token or mutual TLS from configuration); the
   frame shape keeps a place for it so the protocol does not rewrite.
   Secrets rules are unchanged: credentials never transit frames.

Remote transports remain off by default and configuration-driven
(local-first; the documented connection point for remote coordination
lands with M4-S6). M1 delivers local transport only, with two seam
proofs: the conformance suite drives the daemon over stdio (codec and
session logic demonstrably transport-free), and the session layer
exposes the transport as an interface, not an implementation.

### Persistence and recovery model

The daemon is stateful through the state layer only: no fact that matters
survives solely in memory. Queue shape (entries, priorities, dependency
edges), lane assignments, lease holders, park states, restart counters,
and restart budgets are durable state; each delivery's position lives in
its phase ledger plus the harness session records. A daemon that starts
at login (or after a crash) rebuilds the entire world from state.

**Auto-start.** `daemon install` registers a user-level supervisor unit
(systemd user unit with linger enabled so it starts at login and survives
logout; launchd agent; Windows service equivalent) pointing at the
state-dir scope; `daemon uninstall` removes it. Installation is
optional and changes nothing about local-first behavior (one-shots work
with or without it); the daemon refuses nothing when uninstalled, it
just is not resident.

**Startup reconciliation.** On start (login, boot, or crash restart),
the daemon runs a bounded, idempotent reconciliation:

1. Rebuild the queue, lanes, leases, parks, and budgets from state.
2. For every lane marked delivering, check liveness of the recorded OS
   process and harness session (artifact evidence, not memory).
3. Classify each: `alive` (reattach and observe), `interrupted` (process
   gone without a completion record: machine restart, kill, supervisor
   stop - resume from the ledger position; already-completed phases are
   idempotently skipped; restart counter +1), or `crashed` (failure
   signal recorded: classify the reason, resume per budget).
4. Apply restart budgets: a delivery past its budget is marked `failed`
   in the queue (terminal, classified reason, restart history attached)
   and surfaces to the coordinator as a typed question within one
   collection cycle. Exhaustion never silently requeues.

```mermaid
flowchart TB
    START[daemon starts<br/>login, boot, or crash] --> REBUILD[rebuild queue, lanes,<br/>leases, budgets from state]
    REBUILD --> CHECK{per in-flight lane:<br/>process or session alive?}
    CHECK -->|alive| OBS[reattach and observe]
    CHECK -->|gone, no failure record| RES[interrupted: resume from ledger,<br/>completed phases skipped, restarts +1]
    CHECK -->|failure recorded| CLS[crashed: classified reason,<br/>resume per budget]
    RES --> BUD{restart budget left?}
    CLS --> BUD
    BUD -->|yes| GO[delivery continues]
    BUD -->|no| FAIL[queue: failed terminal<br/>typed question to coordinator<br/>never silent requeue]
    OBS --> GO
```

### Concurrency model (many CLIs, many agents, one host)


- **Connection per invocation.** Every CLI process opens its own
  connection; the kernel hands the daemon one accepted socket per
  invocation. Responses are routed back only on the connection that
  asked; the `id` field correlates requests to responses within one
  connection (pipelining), never across connections. A CLI never
  receives another CLI's response; broadcast frames are `event` frames
  on subscribed topics only.
- **Server shape.** The daemon is a multi-connection, single event loop:
  frames from all connections are processed on the loop, shared
  in-memory state is mutated only on the loop (no data races by
  construction), and slow or idle connections never block it (bounded
  per-connection buffers; see the subscribe overflow rule).
- **Mutations serialize at the state layer.** Concurrent requests from
  simultaneous agents and coordinators are applied as ordered events
  through the single-writer state layer under fence tokens. Per record
  class: appends are idempotent by identity (a re-sent queue add is a
  no-op), sets are last-writer-wins with the writer named, and every
  mutating request carries a client id usable as an idempotency key
  (at-most-once application).
- **Scoping.** State dir scopes the world: one daemon per state dir
  (one project scope), socket path derived from it, single-instance per
  scope. Multiple projects delivering on one host run one daemon each;
  cross-project coordination happens above the tooling (the coordinator
  reads multiple scopes), not by merging scopes.
- **Bounded waiting.** Every request carries a bounded response timeout;
  on timeout or unreachable transport the CLI degrades to its
  state-path fallback (or the declared degraded mode) instead of
  blocking the agent.

```mermaid
flowchart LR
    subgraph cmd [CLI invocation]
        C1[write intent to state]
        C2[poke control socket]
    end
    S[(state layer<br/>event log, fence tokens)]
    D[daemon<br/>drives lanes, writes execution records]
    C1 --> S
    C2 -->|wake now| D
    D -->|heartbeats, lane state, parks| S
    D -->|reconcile on start| S
    S -->|reads, degraded mode| cmd
```

## Boundary invariants at M1 exit

1. The daemon never executes a merge; it prepares and queues (roadmap
   constraint 9). The merge transaction stays an explicit coordinator
   action.
2. Per-repo single-flight is the only structural lane cap; capacity,
   bandwidth, and CI slots never gate lane count. Weight classes are
   resource classes, not caps.
3. Truth before dispatch: the scheduling engine hard-depends on the merge
   transaction, session economics, state validation, and the plan schema;
   the daemon hard-depends on those plus the scheduling engine.
4. Daemon failure degrades to CLI one-shots; the bash stack remains
   installed as fallback with deprecation pointers (removal is M4-S5).
5. Deterministic render paths (digest, brief, plans, scheduling) contain
   no LLM calls; judgment sits on top of their output.
6. Gate sets, ceremony tiers, harness choices, and lane policies are
   configuration data, never code changes and never wizards.
