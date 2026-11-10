# M2 outcome architecture: engine-first operations and multi-repository workstations (planned)

The system at M2 exit: one workstation manages several delivery repositories
as first-class projects, the typed engine carries day-to-day delivery, the
queue lifecycle closes itself, the daemon publishes a versioned event
taxonomy, and telemetry turns spend, metrics, and retro into stated facts.
Planned state; story numbers reference [../../backlog.md](../../backlog.md).
Pack conventions are in [README.md](README.md); contract detail is in
[contracts.md](contracts.md).

## C4 Level 1: system context

```mermaid
flowchart TB
    subgraph people
        OWNER[Owner<br/>accepts records, reads brief, steers]
        COORD[Coordinator agent<br/>plans, merges, closes out]
        LANE[Lane agents<br/>one change per lane]
    end
    subgraph external
        TRACKER[(Tracker<br/>issues and state)]
        VCS[(VCS and CI<br/>branches, merges, pipelines)]
        HARNESS[(Harness step stream<br/>per-step frames)]
        PROFILES[(Provider profiles<br/>windows, holds, multipliers)]
    end
    ENGINE[delivery engine<br/>projects, queue, dispatch,<br/>events, telemetry, handover gate]
    HOST[(Host-level project index<br/>one entry per managed checkout)]
    OWNER -->|asks, brief, steering notes| ENGINE
    COORD -->|plan, merge, closeout| ENGINE
    ENGINE -->|typed questions, digest| COORD
    ENGINE -->|spawn, resume, park| LANE
    ENGINE --> HOST
    ENGINE --> TRACKER
    ENGINE --> VCS
    LANE --> HARNESS
    HARNESS -->|step frames| ENGINE
    ENGINE -->|peak windows, holds| PROFILES
```

M2 in one sentence: the host knows every repository it manages, each
repository owns its own state, the engine can prove what it dispatched and
what it spent, and a provider peak parks one lane without touching the rest.

## C4 Level 2: containers

```mermaid
flowchart TB
    subgraph entry [entry surfaces]
        CLI[CLI one-shots<br/>projects, attempts, events,<br/>spend, queue, board]
        SUB[subscribe client<br/>watch commands and scripts]
        DAEMON[resident daemon<br/>window watcher, event publisher,<br/>park and resume]
    end
    subgraph planes [engine planes]
        PROJ[project plane<br/>checkout identity, state root<br/>per repository, host index]
        EVID[evidence plane<br/>attempt ledger, divergence<br/>resolution, coverage and floor]
        EVENTS[event plane<br/>versioned topics, ordering,<br/>overflow to repoll]
        TELEM[telemetry plane<br/>ingest, attribution,<br/>reconciliation, rollups]
        QUEUE[queue plane<br/>lifecycle verbs, dependency<br/>edges, single-flight]
        OPS[operations plane<br/>engine-first dispatch,<br/>handover-gate evaluation]
    end
    STATE[(per-repository state<br/>validated at each boundary)]
    HOSTIDX[(host-level project index)]
    BASHF[bash stack<br/>documented fallback with<br/>deprecation pointers]
    CLI --> PROJ
    CLI --> EVID
    CLI --> TELEM
    CLI --> QUEUE
    SUB --> EVENTS
    DAEMON --> EVENTS
    DAEMON --> QUEUE
    DAEMON --> TELEM
    PROJ --> HOSTIDX
    PROJ --> STATE
    EVID --> STATE
    TELEM --> STATE
    QUEUE --> STATE
    OPS --> QUEUE
    OPS --> EVID
    OPS -.->|only when a repository<br/>has not flipped| BASHF
```

## C4 Level 3: components

```mermaid
flowchart LR
    subgraph project [project components]
        IDENT[checkout identity<br/>git common dir marker]
        ROOT[state root resolver]
        LIST[projects list projector]
    end
    subgraph evidence [evidence components]
        ATTEMPT[attempt reader<br/>token, corroboration triple,<br/>divergence refs]
        RESOLVE[divergence resolver<br/>live truth or local evidence]
        FLOOR[coverage and floor reporter]
    end
    subgraph events [event components]
        TOPICS[topic registry<br/>queue.graph, dispatch.attempt,<br/>phase.state, blockers.state]
        ORDER[ordering guard<br/>monotonic per lane]
        OVER[overflow policy<br/>drop and repoll]
    end
    subgraph telemetry [telemetry components]
        INGEST[step-frame ingestor]
        ATTR[attribution<br/>session economics,<br/>command-audit identity]
        RECON[reconciliation<br/>declared tolerance]
        BREAK[spend v2 breakdowns<br/>ticket, repository, lane,<br/>agent role, model, timing]
    end
    subgraph lifecycle [lifecycle components]
        REL[release and remove<br/>with reasons]
        DEP[dependency edge editor]
        SINGLE[single-flight guard<br/>one active lane per ref]
        STALE[stale-entry reconciler]
    end
    subgraph peak [peak components]
        WATCH[profile window watcher]
        PARK[park bookkeeper<br/>reason, until]
        RESUME[session resume path<br/>same branch, no re-dispatch]
    end
    IDENT --> ROOT --> LIST
    ATTEMPT --> RESOLVE --> FLOOR
    TOPICS --> ORDER --> OVER
    INGEST --> ATTR --> RECON --> BREAK
    REL --> DEP --> STALE
    SINGLE --> REL
    WATCH --> PARK --> RESUME
    PARK --> SINGLE
    RESUME --> ATTEMPT
    BREAK --> FLOOR
```

## Key flows

### Multi-repository overview

```mermaid
flowchart LR
    A[projects list] --> B[resolve host index]
    B --> C{checkout identity}
    C -->|git common dir marker| D[repo key]
    D --> E[state root per repository]
    E --> F[daemon reachability]
    F --> G[handover state]
    G --> H[one table: key, root, state,<br/>daemon, handover]
```

### Attempt-history inspection and divergence resolution

```mermaid
flowchart LR
    A[dispatch attempts --ref] --> B[read attempt ledger]
    B --> C[token and corroboration triple]
    C --> D[divergence refs and timestamps]
    D --> E{machine envelope}
    E --> F[dual-run resolve]
    F -->|tracker truth reachable| G[resolve against live truth]
    F -->|unreachable| H[resolve from local evidence,<br/>mode declared]
    G --> I[note plus unresolved counts]
    H --> I
```

### Telemetry attribution

```mermaid
flowchart LR
    A[harness step frames] --> B[ingest per step]
    B --> C[attribute by session economics<br/>and command-audit identity]
    C --> D[ticket, repository, lane,<br/>agent role, model]
    D --> E[phase timings]
    E --> F[reconcile against session totals<br/>within declared tolerance]
    F --> G[spend v2 breakdowns]
    G --> H[metrics and retro evidence]
    G --> I[morning brief]
```

### Queue auto-release after merge and closeout

```mermaid
flowchart LR
    A[merge transaction lands] --> B[closeout completes]
    B --> C[release the ref's queue entry<br/>reason: landed]
    C --> D{dependency edges}
    D -->|dependents now ready| E[ready set recomputed]
    D -->|no dependents| F[queue unchanged]
    E --> G[event: queue.graph]
```

### Single-flight refusal across dispatch paths

```mermaid
flowchart LR
    A[dispatch request for ref R] --> B{single-flight guard}
    B -->|no active lane| C[claim lane and proceed]
    B -->|active lane exists| D[refuse with classified error<br/>naming the holder]
    D --> E[event: dispatch.attempt refused]
    C --> F[event: dispatch.attempt started]
```

### Handover-gate evaluation

```mermaid
flowchart LR
    A[accrued engine dispatches] --> B[coverage floor]
    B --> C[corroboration per dispatch]
    C --> D[exposure floor]
    D --> E[incident truth]
    E --> F[per-condition status]
    F -->|all conditions met| G[repository may flip]
    F -->|any condition open| H[stay on the shell path]
```

### S17 park and resume under a provider peak

```mermaid
sequenceDiagram
    participant D as resident daemon
    participant P as profile window watcher
    participant L as lane on profile-a
    participant O as lane on another provider
    participant T as telemetry
    D->>P: window opens for profile-a
    P->>L: bounded-grace stop
    L-->>P: session state preserved
    P->>L: mark parked, reason peak-window, until window end
    Note over O: keeps running, unaffected
    D->>P: window ends
    P->>L: resume from preserved session state on the same branch
    L-->>T: zero billable calls during the window
    P->>T: ledger events: stop, park, resume
```

## Persistence and concurrency deltas

M2 changes where state lives, not only what it contains.

- **Per-repository state.** The state root resolves from the checkout identity
  (the git common dir marker), so two checkouts on one host never share phase
  state, queue entries, or lane leases. The host-level index names each
  project key, root, and state location; it is the only host-wide file.
- **Migration.** Existing single-store users get a migration note and a
  one-step move into the per-repository root; no state file is rewritten in
  place.
- **Concurrency.** One active lane per ref is enforced across every dispatch
  path, not only the queue path, so a second session on the same ref is
  refused with a classified error naming the holder. Lane leases stay
  repo-exclusive with stale takeover.
- **Ordering.** Event topics are ordered per lane with monotonic sequence
  numbers; a slow consumer overflows to a repoll instead of receiving a
  reordered stream.
- **Telemetry storage.** Telemetry lands in schema-versioned local event
  storage; a version bump migrates by re-reading, never by mutating old rows.
- **Park state.** A parked lane records its reason and an until timestamp;
  the record survives a daemon restart, so resume is idempotent.

## Boundary invariants at M2 exit

- No two repositories on one host observe each other's phase state, queue
  entries, or lane leases.
- Every dispatch records its nominated provider profile on the lane and on
  the attempt record.
- One active lane per ref, whichever dispatch path is used.
- A queue entry leaves the queue when its work lands or is abandoned, with a
  recorded reason; stale entries reconcile against tracker truth without
  editing state files.
- Event topics are versioned, documented, and ordered per lane; overflow is a
  declared repoll, never silent loss.
- Telemetry reconciles with harness-reported totals within the declared
  tolerance, and telemetry absence is a classified outcome.
- A provider peak parks only lanes on that profile; other providers keep
  running, and resume loses or duplicates no branch, artifact, or queue
  state.
