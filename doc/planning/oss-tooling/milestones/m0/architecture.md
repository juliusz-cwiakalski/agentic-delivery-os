# M0 outcome architecture: trust substrate (delivered)

Backfill: the system as it stood at M0 completion (all 20 stories merged).
The M0 CLI engines exist beside the bash delivery stack; the bash stack
stays authoritative for dispatch and merge throughout M0. Story numbers
reference [../../backlog.md](../../backlog.md).

## C4 Level 1: system context (M0 end state)

```mermaid
flowchart TB
    subgraph people
        OWNER[Owner<br/>human decision maker]
        COORD[Coordinator agent<br/>CEO-style, drives the delivery loop]
        LANE[Lifecycle agents<br/>spec, plan, code, review per change]
    end
    subgraph external
        TRACKER[(Tracker<br/>Jira or GitHub issues)]
        VCS[(VCS and CI<br/>GitLab or GitHub: repos, MRs, pipelines)]
        LLM[(AI providers<br/>model hosts)]
    end
    BASH[bash delivery stack<br/>authoritative: dispatch, loop, liveness]
    CLI0[M0 CLI engines<br/>second opinion: read, verify, close out]
    OWNER -->|accepts records, gates| COORD
    COORD -->|drives lanes through| BASH
    LANE -->|11-phase lifecycle in| BASH
    COORD -.->|status, verify, provider, closeout beside bash| CLI0
    CLI0 --> TRACKER
    CLI0 --> VCS
    CLI0 -->|provider engine, parks| LLM
    BASH --> TRACKER
    BASH --> VCS
    BASH --> LLM
```

M0 in one sentence: every read the coordinator relies on (status, verify
change, verify gates, provider, closeout, lint, phase, db, queue ready)
has a truthful, artifact-verified typed engine running beside the bash
stack, so its signals can be trusted before anything replaces the bash
paths.

## C4 Level 2: containers (M0 end state)

```mermaid
flowchart TB
    subgraph cliengines [M0 CLI engines, one-shot commands]
        STATUS[status v1<br/>six collectors, tri-state]
        QREADY[queue ready<br/>read-only ready set]
        VERIFY[verify change + verify gates<br/>ledger + gate battery with citations]
        PROV[provider v1<br/>chain, quota, parks]
        CLOSE[closeout v1<br/>post-merge transaction]
        LINTP[lint + phase<br/>pm-notes schema, phase ledger]
        DB[db<br/>session store admin]
    end
    subgraph workspace [typed workspace, pnpm + Bun]
        CORE[core package<br/>contracts, state, branding, result envelope]
        ADPTS[adapters package<br/>GitLab, Jira, GitHub read slice<br/>behind primitive ports]
        CLIPKG[cli package<br/>command surface over core]
        MCPP[mcp, opencode, testkit<br/>scaffolded, engines only]
    end
    STATE[(state layer<br/>JSONL + SQLite, torn-state detection)]
    CONFIG[(config layer<br/>DEC-4 chain, per-key origin)]
    GUARDS[guards in CI<br/>privacy, no-cloud, license, boundaries]
    STATUS --> CORE
    VERIFY --> CORE
    PROV --> CONFIG
    PROV --> CORE
    CLOSE --> ADPTS
    CLOSE --> CORE
    LINTP --> STATE
    STATUS --> ADPTS
    QREADY --> STATUS
    VERIFY --> ADPTS
    DB --> STATE
    CORE --> STATE
    ADPTS --> CONFIG
    GUARDS -.->|fails CI on violation| workspace
```

## What M0 deliberately is not

- No dispatch replacement: the bash stack runs lanes end to end; M0
  engines are read-and-verify surfaces plus closeout.
- No daemon, no queue state: the lanes-or-queue status section reads
  `not-delivered` by design until M1-S17.
- No merge automation: the merge gate battery exists as `verify gates`
  evidence; the merge act stays manual.
- The minimal GitHub read slice serves this repository only; full adapter
  completion is M3-S3.

Exit state at handover to M1: the dual-run pilot (status, verify change,
provider, closeout beside bash) is the recorded path to M0 exit; the
thirteen Proposed decision records await owner acceptance.
