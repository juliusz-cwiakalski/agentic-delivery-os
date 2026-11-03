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
