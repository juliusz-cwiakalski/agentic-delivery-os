---
change:
  ref: GH-288
  type: feat
  status: Proposed
  slug: multi-repo-workstations
  title: "Scope delivery state per repository and add the projects host overview"
  owners: [engineering]
  service: delivery-os
  labels: [feature, projects, state-layer, cli-composition, m2-s11, multi-repository]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: high
  dependencies:
    internal:
      - "State layer store facade and store layout (M0-S5, GH-174)"
      - "Production CLI composition and its single state-directory resolution"
      - "MCP serve composition (state identity plus repository facts)"
      - "Configuration catalog: state-directory scope and daemon socket derivation"
      - "Checkout git directory resolution (gitdir and common dir, linked worktrees)"
      - "Checkout-scoped dispatch identity marker (create-once, atomic, 0600)"
      - "Dispatch handover ledger and the derived per-repository authority view"
      - "Owner-hold marker resolution and the delivered owner-hold vocabulary"
      - "CLI-independent bash dispatch-authority read (shell fallback stack)"
      - "Entrypoint prompt-required composition, help inventory, and help-coverage gate"
      - "Error table, its domain kinds, and the bidirectional docs sync gate"
      - "State consumers: status, brief, queue, lanes, phase, commit, dispatch, spend, retro, coordinator, board"
      - "System specs: state layer, CLI entrypoint, branding seam, dispatch engine, result contract"
    external:
      - "Local git metadata read-only inspection (git dir, common dir, worktrees, remote); no network, no added process spawn"
      - "Local unix-domain socket liveness probe to a same-user daemon; no network transport, no protocol write"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make a workstation that manages several repositories first-class by scoping delivery state per repository from the checkout identity and by adding one `projects list` overview of every managed checkout, so two checkouts using the same ref can never observe each other's phase state or queue entries.

## 1. SUMMARY

Delivery state is currently scoped per user, not per repository: the production composition resolves one directory (`<home>/<brand.stateDirectoryName>`) and opens one store with workspace identifier `default`, so every managed checkout on the host shares a single ledger, one documents namespace, one queue key space, one dispatch authority surface, and one owner-hold marker, all keyed only by `workItemRef`. Two checkouts of different repositories that happen to work the same ref therefore collide: each can observe the other's phase documents and queue entries, and no surface tells an operator which checkouts this host manages, where their state lives, or whether their daemon and handover state are healthy.

This change introduces a repository-scoped state root derived from the checkout identity (the git common directory marker) beneath the delivered host root, a derived host index that makes discovery work without a hand-written registry, and the `projects list [--json]` surface (`projects.v1`) that reports one row per project: project key, checkout root, state location, daemon reachability with a declared degradation reason, and handover state. It also delivers the one-step migration note for existing single-store installs and the mount obligations (prompt-required set, reference page, coverage inventory, error table) that make the new family actually reachable instead of silently dropped.

The state layer's record contract, schema version, file layout, and permission model are unchanged; isolation comes from the state root, so migration is a directory move and not a state rewrite.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **One state directory per user.** The production composition resolves `stateDirectory = <home>/<brand.stateDirectoryName>` once (the delivered home-plus-brand resolution) and opens the store with `workspaceId: "default"`, fence namespace `cli`, and the current schema version. The home and the brand name are injected; the brand derives `stateDirectoryName` as the dot directory plus `-state`, and the delivered environment override `<PREFIX>_STATE_DIR` wins over the home default as an absolute path.
- **Every store path is workspace-scoped, never repository-scoped.** The state layer lays out `ledger.<workspace>.jsonl`, `header.<workspace>.json`, `index.<workspace>.sqlite`, `fence.<workspace>.lock`, `documents.<workspace>/`, `chain-key.<workspace>.json`, the retro evidence sidecar and its lock, `chain-key.retro.<workspace>.json`, and `quarantine.<workspace>/`, where the workspace segment is the encoded workspace identifier. With one workspace identifier for the whole host, one store serves every checkout.
- **The colliding artifacts are keyed by ref alone.** Phase state is a derived document named `phase-state.<REF>.json` inside the documents directory; queue entries are ledger records under the key prefix `queue.entries:` with the canonical ref as the remainder. Two repositories working the same ref write the same document name and the same ledger key in the same store.
- **Other state surfaces inherit the same single root.** The dispatch state root, the derived dispatch authority documents, the retro sidecar location, the provider parks document, the owner-hold marker, and the command audit ledger all live under that one directory.
- **A second resolution site exists.** The MCP surface derives its own state directory from the injected home plus the same brand value with fence namespace `mcp`, so two surfaces independently repeat the same rule.
- **The resident daemon is not mounted in the production entrypoint.** The daemon lifecycle family is composed only when a daemon runtime is supplied, and the production entrypoint supplies none, so no daemon is running and no control socket is served. The daemon socket path is derived by the configuration catalog with a default of `<stateDirectory>/<daemon socket name>` and a rule that the resolved socket must stay inside the state directory. Any "daemon reachable" claim made from the shipped build would therefore be false unless it is declared as a degradation.
- **Handover state is real but only visible per dispatch run.** Dispatch handover appends an append-only handover record per repository and rebuilds a derived per-repository authority document atomically; authority is `authoritative` or `dual-run`, and an absent, unreadable, or malformed view resolves to `dual-run`. Handover records are read by key prefix, so the folded truth is cheap to obtain; no host-level surface reports it today.
- **The CLI-independent shell fallback reads the same state root by a different rule.** The bash dispatch-authority read resolves its state root from an environment override, then a repository-local directory, then the home default, and it scans up to two directory levels deep for the authority document. It therefore depends on the exact depth at which the derived document sits.
- **Repo identity free from the checkout already exists.** Checkout git directory resolution returns the git directory and the common directory from the working directory (a `.git` directory for a normal root, a `gitdir:` file for a linked worktree); the common directory is shared by every linked worktree of one repository and never by a second repository. The production composition already uses the common directory as the identity-marker directory for dispatch identity, where a create-once marker is written atomically (synced sibling plus link, `0600`) and is shared by the worktrees of one repository.
- **No host-level inventory exists.** Nothing enumerates managed checkouts, their roots, or their state locations, and nothing detects that a home still holds a pre-migration single store.

### 2.2 Pain Points / Gaps

- **Same-ref collisions are structural, not incidental.** Any two checkouts of different repositories working the same ref write the same phase document name and the same queue ledger key; each can read the other's work as its own. A single collision can advance an unrelated change's phase state or claim another repository's lease.
- **The state location is user-scoped in an era of per-repository work.** One host is now expected to carry several delivery-managed checkouts; a user-scoped store makes that configuration unsafe by default.
- **There is no host overview.** An operator cannot answer "which checkouts does this host manage, where does their state live, is anything running, and is this repository engine-authoritative" from the CLI.
- **The state-scope rule is duplicated.** The CLI composition and the MCP surface each derive the same directory separately, so a per-repository rule applied at one site and not the other silently splits one repository's state in two.
- **Daemon reachability is assumed, not reported.** Without an explicit, honest reachability report, an operator cannot distinguish "no daemon in this build" from "a daemon is down" from "this checkout has no state yet".
- **Existing users have no migration path.** A populated single store would simply stop being read by a per-repository build, which looks like data loss.
- **The shell fallback depends on the store depth.** Moving derived documents one level deeper without updating the fallback read would leave the bash stack permanently believing `dual-run` after an engine handover — the opposite of the safety direction the handover exists to protect.

## 3. PROBLEM STATEMENT

Because delivery state is resolved once per user and opened with one workspace identifier, while phase documents and queue entries are keyed by ref alone, an operator who manages two repositories on one host cannot keep their state apart: both checkouts read and write the same documents and the same ledger keys, so the same ref in one repository can observe and mutate the other's phase state and queue entries, and because nothing enumerates managed checkouts or reports their state location, daemon reachability, and handover state, the operator cannot see the collision, cannot verify isolation, and cannot tell which checkout a piece of state belongs to.

## 4. GOALS

- **G-1**: Scope delivery state per repository, derived from the checkout identity, so two checkouts of different repositories on one host hold disjoint phase state, queue entries, lane leases, and derived documents even when both use the same ref.
- **G-2**: Make project identity stable where an operator expects it: unchanged across a working-directory rename and across a moved checkout, one project for all linked worktrees of a repository, and distinct projects for distinct clones of the same remote.
- **G-3**: Discover managed checkouts without a hand-written registry: a host-level index derived from use, revisioned, self-pruning, and never authoritative over delivery state.
- **G-4**: Deliver `projects list [--json]` as the single CLI overview of the host, reporting exactly the contract fields with deterministic text output and the shared exit-code and envelope contracts.
- **G-5**: Report daemon reachability and handover state honestly: a declared degradation reason instead of an implied daemon, and a derived handover state that is never invented.
- **G-6**: Apply one state-scope policy across every surface that opens a store or derives a state path (CLI composition, MCP surface, daemon socket derivation, dispatch state root, retro sidecar, owner-hold read, and the CLI-independent shell fallback), so no surface keeps reading the old location.
- **G-7**: Give existing single-store users a one-step, reversible migration that moves state without rewriting it, and make the unmigrated condition visible instead of silent.
- **G-8**: Make the new family actually reachable and documented: prompt-required composition, help entries, reference page, coverage inventory, error-table rows, system-spec reconciliation, and planning-corpus maintenance.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Cross-repository state collisions for one ref on one host | 0 (phase documents and queue entries of the two checkouts are disjoint file sets and neither surface observes the other) |
| Store-opening surfaces that resolve a state root outside the single state-scope policy | 0 across CLI composition, MCP serve, daemon socket derivation, dispatch state root, retro sidecar, owner-hold read, shell fallback |
| Store files remaining at the host root after migration (other than the host index and the host-wide owner-hold marker) | 0 |
| State-file content changes caused by migration | 0 (byte-identical files; audit chain still verifies; retro sidecar still reads) |
| `projects list` rows produced without any hand-written registry, for two registered checkouts | 2 of 2 with all five contract fields plus the index revision |
| False daemon-reachability claims | 0 (no `reachable: true` without a successful bounded connect; the unmounted build declares its reason) |
| Invented handover states | 0 (`engine` only with agreeing folded truth and derived view; `in-transition` only with a detected disagreement) |
| `projects.registry-corrupt` on an ordinary first run (no index present) | 0 |
| `projects list` latency (warm cache, human table and JSON) | p95 ≤ 500 ms at 25 projects; ≤ 4 s at 200 projects |
| Per-invocation index maintenance cost | ≤ 10 ms p95; at most one index read and one index write; no filesystem crawl |
| `pnpm check:help` and the reference-page parity gate | green, with the new reference page registered and containing `--help` and `--version` |
| New error-table rows | exactly 3, in one new domain kind, with the result-contract doc synced bidirectionally |
| New hardcoded product or binary literal in shipped code, docs, or fixtures | 0 (names resolved from the injected brand identity) |

### 4.2 Non-Goals

- **NG-1**: Changing the state layer's record contract, schema version, record kinds, key prefixes, fold rules, validation predicates, or file layout; adding a state record kind is out of scope unless isolation proves impossible without one (it does not).
- **NG-2**: Changing any delivered command's grammar, flags, envelope shape, key order, exit projection, or human text, other than the state root those commands read and write.
- **NG-3**: Mounting or implementing the surfaces owned by other M2 stories: the full cross-repository board, `attempts`, `events`, and `spend` v2 are other stories, and this change composes only the `projects` family.
- **NG-4**: Closing the resident-daemon mount gap. The daemon lifecycle family stays unmounted in this build, and `projects list` reports that fact instead of pretending a daemon exists.
- **NG-5**: Per-project (repository-scoped) owner holds. The owner hold stays a host-wide control in this change.
- **NG-6**: Automatic migration, an automatic filesystem crawl for checkouts, a `projects` verb beyond `list`, or a writable registry an operator maintains by hand.
- **NG-7**: Re-attributing historical records of a shared store to the repositories that produced them, or matching queue/phase records to a repository by inference.
- **NG-8**: Changing dispatch identity resolution, handover-gate semantics, queue scheduling, or lane-lease semantics.
- **NG-9**: Cloud, multi-host coordination, remote or network state, or a new workspace package.
- **NG-10**: Redesigning or retiring the CLI-independent shell fallback; only its state-root resolution and its documented search depth follow the new layout.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Project identity and per-repository state root | Isolation is the ticket's reason to exist; the root is the only place one repository's state can be kept from another's. |
| F-2 | Derived host index (discovery without a registry) | "No manual configuration" must mean derived and self-maintaining, not a file an operator edits. |
| F-3 | `projects list` surface (`projects.v1`) | The overview is the ticket's second acceptance criterion and the only way to see isolation, state location, and health from one place. |
| F-4 | Handover state derivation (`engine` / `shell` / `in-transition`) | A reported handover state that cannot be derived from delivered evidence would be a guess, and a guess about authority is dangerous. |
| F-5 | Daemon reachability with declared degradation | Honest degradation converts "unknown" into an operator-readable fact instead of an implied daemon. |
| F-6 | One state-scope policy across every surface | A per-repository rule applied at one site and not another splits one repository's state in two, which is worse than the collision it replaces. |
| F-7 | Host-wide owner-hold continuity | The hold is a safety control; narrowing it silently would weaken a stop-all mechanism. |
| F-8 | One-step migration and legacy detection | Moving state without rewriting it is the only migration the state contract permits, and silent non-detection looks like data loss. |
| F-9 | Mount, help, coverage, and error identities | A composed command that cannot be reached or is absent from the help inventory repeats a known mount gap. |
| F-10 | System-spec and planning-corpus reconciliation | The planning corpus is the current-truth record for the next story; a delivered story with stale markers misleads every later delivery. |

### 5.1 Capability Details

- **F-1 — Project identity and per-repository state root.** State resolution becomes two layers. The **host root** keeps the delivered rule unchanged: the environment override when set (absolute path required), otherwise the injected home plus the brand state directory name. Beneath it, a **project state root** is `<host root>/projects/<project key>`, where the project key is the stable identity of one checkout. The project key and a project identifier are minted once and persisted in a **checkout identity marker** inside the checkout's git common directory, using the discipline the delivered dispatch identity marker already establishes: created once, never overwritten, written atomically through a synced sibling plus a link, `0600`, shared by every linked worktree of the repository, and travelling with a moved or renamed checkout. Dedicated checkout-scoped identity is required rather than reuse of the dispatch identity marker: the dispatch marker records the normalized remote identity (`host/owner/name`), which two clones of the same remote share, while state isolation must separate any two checkouts that do not share a git common directory. Consequently: two checkouts of different repositories are two projects; two clones of one remote are two projects; all linked worktrees of one clone are one project; a renamed or moved checkout keeps its key and its state root; a nested working directory resolves to the nearest enclosing checkout; and a submodule is its own project through its own git common directory. The workspace identifier stays `default` inside every project root, and the store file layout inside that root is exactly the delivered layout, so the same store names serve one repository instead of the whole host. Marker creation failure is a state-location failure, not an identity failure, and no path-derived key is ever substituted for a missing marker. An invocation that is not inside a git work tree has no project: it uses a declared host-scoped `unbound` root beside the project container, emits a warning that its state is not repository-scoped, and never writes into a project's root.
- **F-2 — Derived host index.** The host root holds a single host-level index document naming, per project, the project key, the project identifier, the checkout root, and the state location, plus a monotonic revision. The index is a derived cache: it is not a state record, never overrides delivery state, and is rebuildable from checkouts. It is maintained — never rebuilt by crawling — by a bounded step that runs when a store-opening invocation resolves its scope from inside a checkout: upsert the current project, prune entries that are provably dead (root absent, or the root's identity marker resolves to a different project identifier), and leave every uncertain entry in place. Absent is not corrupt: no index means no registered project, an empty list, revision zero, and exit success. A present but unparsable index is corrupt for a read; maintenance preserves the corrupt file as a timestamped sibling and writes a fresh index containing the current project, so the host recovers without a filesystem scan. The `stateLocation` a row reports is always re-derived from the project key and never trusted from the index, so tampering with or staleness in the index cannot redirect a state read; a recorded value that disagrees with the derived one is a warning and is repaired by maintenance. Pruning removes index entries only and never deletes state; a re-registered checkout recovers the same key and the same state root from its marker.
- **F-3 — `projects list` surface.** `projects list [--json]` is a host overview and the only verb of the family. The machine envelope carries `data.projects[]` with exactly `projectKey`, `root`, `stateLocation`, `daemonReachable`, and `handoverState`, plus `data.hostIndexRevision`; the human output is a deterministic table with the columns `key`, `root`, `state`, `daemon`, `handover`, sorted by project key. Both projections are stable for unchanged state. The command is read-only with respect to delivery state: it reports the index as it finds it, never prunes, never migrates, and never creates a project root. Exit codes follow the shared contract: `0` when the list was produced, `1` when the request is refused (an unknown verb, or a managed checkout whose identity can no longer be read), `2` when the host index or a project state location prevents an honest answer. A project that exists in the index but is stale and still present is reported, with a warning; a project whose root has vanished is not invented and not reported, and is removed by the next maintenance run.
- **F-4 — Handover state derivation.** The reported handover state is folded from delivered evidence only. `engine` is reported when the folded latest handover operation for the project is `authoritative` **and** the project's derived authority document agrees. `shell` is reported when the folded latest operation is `dual-run`, when no handover record exists (including a project with no state root yet), or when no derived view exists — the documented safe default. `in-transition` is reported when the folded truth and the derived document disagree: a handover or reversal has been recorded but the derived document has not caught up, or it is absent while the ledger carries authoritative truth, or it is malformed. Operationally `in-transition` means the engine truth and the file the shell fallback reads say different things, so both runtimes would claim authority; it is a real, transient condition, derived by comparison and never assigned for any other cause. If a project's state root is present but unreadable, the command reports a state failure rather than a fabricated handover state.
- **F-5 — Daemon reachability.** `daemonReachable` is a structured value carrying `reachable` and, when false, a declared reason from a closed vocabulary: the build composes no resident daemon (the shipped condition), the project has no state root yet, the derived socket path does not exist, or the socket exists and a bounded connect fails. The probe reads only: it derives the socket path from the project state root through the delivered configuration rule (including the inside-the-state-directory constraint) and performs a bounded connect with the declared timeout; it writes nothing and sends no command. A mount capability is injected, so the shipped build declares the unmounted reason without probing, while a composition that does supply a daemon capability probes honestly; both branches are exercised by tests.
- **F-6 — One state-scope policy.** The state-scope rule lives below the CLI tier as a runtime-neutral policy over injected facts, with the filesystem and git reads in the adapter tier, because both the CLI composition and the MCP surface must consume it and neither may import the other. Every site that derives a state path consumes that policy: the CLI production composition, the MCP serve composition, the daemon socket derivation, the dispatch state root, the retro sidecar location, the owner-hold read, and the CLI-independent shell fallback. One resolution site means one place to change, and it also means a structural assertion can pin the invariant. The shell fallback additionally follows the layout: it resolves the project state root before looking for the authority document and does not compensate by widening its directory search depth, and it keeps its environment-override precedence.
- **F-7 — Host-wide owner-hold continuity.** The owner hold remains a host-wide control: the marker is read at the host root (where it already lives) and the environment override keeps its precedence, so one hold stops every project on the host. No per-project marker is introduced and no consumer's meaning changes. Migration therefore leaves the marker where it is, and a hold that existed before the migration keeps holding everything.
- **F-8 — Migration and legacy detection.** Migration is a one-step directory move of the populated store into one designated primary project's root: the ledger, header, index, fence, documents, chain keys, retro sidecar and its lock, and quarantine move together, keep their names and modes, and are served by the same store contract afterwards. The move is reversible by the inverse move and rewrites no state file. Records belonging to other repositories are not re-attributed: the primary project keeps the history it had, and every other checkout starts a fresh per-repository store. Because no automatic migration is performed, a state-opening invocation whose scope resolves to a project root that does not exist while the host root still holds store files emits one bounded warning on the error stream naming the migration note, performs no move, deletes nothing, and does not change the command's exit code. The migration note is a delivered document with a declared distribution class.
- **F-9 — Mount, help, coverage, and error identities.** `projects` becomes part of the exact prompt-required composition (the entrypoint composes that set and drops everything else), gains help entries at the root and at the family with at least one example and the shared exit-code block, and gains a reference page that documents `--help` and `--version`. The delivered precedent for the failure this avoids is the board family: its command definition exists in the composition, but it is not prompt-required, so the composed program drops it and no root listing advertises it. `projects` avoids that outcome by changing the prompt-required set in the same change that composes the family, and the help-coverage gate plus the reference-page parity gate make a missing page or an unadvertised family a red gate instead of a discovery an operator makes. The two gates also learn a per-command reference page root, so an M2 page can serve an M2 command without editing the M1 milestone snapshot. The three contract errors become real error-table rows under one new domain kind, documented in the result-contract spec so the bidirectional sync gate stays green, and no other row changes.
- **F-10 — Reconciliation.** The system specs that state the state root, the resolved command set, and the brand consumer list are reconciled with the delivered behaviour, a new feature page covers the `projects` surface, and the planning corpus records the delivery: the backlog entry's progress markers, the status snapshot's maintenance convention, the command registry row, and the milestone pack's mount note. The pack's own status semantics are respected: the pack stays "planned until M2 exit", so the command page keeps its proposed status and only the observed-composition note records what is mounted.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Any store-opening command inside a checkout (the new default path)
  operator/agent runs a command inside a managed checkout
    → resolve host root:  <PREFIX>_STATE_DIR (absolute) else <home>/<stateDirectoryName>
    → resolve checkout identity from cwd (git dir + common dir, nearest enclosing root)
         identity marker present  → read project key + project id
         absent                   → mint once, atomically, 0600, inside the common dir
         not a git work tree      → no project: use the declared `unbound` scope + warning
    → project state root = <host root>/projects/<project key>
    → maintain host index: upsert this project; prune provably dead entries;
      replace an unreadable index with a fresh one, preserving the corrupt file
    → open the store with workspace `default` and the delivered layout
    → every phase document, queue entry, lease, derived document, dispatch
      authority view, and retro sidecar of this repository lives under that root
    → if the project root is absent while the host root still holds store files:
      warn once, naming the migration note; move nothing

Flow 2: Two checkouts of different repositories, both working the same ref
  checkout A: phase complete GH-241 → documents.<default>/phase-state.GH-241.json
              under <host>/projects/<key-A>/
  checkout B: phase complete GH-241 → documents.<default>/phase-state.GH-241.json
              under <host>/projects/<key-B>/
  A: queue add GH-241 → ledger key queue.entries:GH-241 under <key-A>
  B: queue add GH-241 → ledger key queue.entries:GH-241 under <key-B>
  → A's and B's phase documents and queue entries are disjoint
  → none of `phase list`, `queue list`, `lanes`, `status`, or `dispatch`
    observes the other checkout's state from either side

Flow 3: `projects list` (host overview)
  operator runs `projects list [--json]` from anywhere
    → read host index (absent → empty list, revision 0, exit 0;
      present but unparsable → projects.registry-corrupt, exit 2)
    → for each recorded project, in project-key order:
         stateLocation   = re-derived from project key (never from the index)
         handoverState   = fold latest handover operation vs derived authority view
         daemonReachable = mounted? probe socket : declared unmounted reason
         (a project whose root vanished is not reported; a stale but present
          entry is reported with a warning)
         (a present but unreadable state root → projects.state-unavailable, exit 2)
    → text: key | root | state | daemon | handover, sorted by key, deterministic
      --json: data.projects[] with the five fields plus data.hostIndexRevision

Flow 4: Migration of an existing single store (operator run, one step)
  stop the foreground coordinator; keep the host-wide owner-hold marker in place
    → run any command inside the checkout designated primary
         (registers the project, warns about the unmigrated store)
    → move the host root's store files into <host root>/projects/<key>/
         names, order, and modes unchanged; owner-hold stays at the host root
    → verify: `projects list` shows the project; a read command inside the
      checkout serves the migrated history (audit chain still verifies,
      retro sidecar still reads)
  reversal: move the files back
  other checkouts: start fresh; historical records are not re-attributed

Flow 5: Handover projection
  folded latest handover operation   derived authority view   reported
  authoritative                      authoritative            engine
  dual-run                           dual-run (or absent)     shell
  none                               absent                   shell
  authoritative                      absent | dual-run | malformed   in-transition
  dual-run                           authoritative            in-transition
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The two-layer state-scope rule: the delivered host root plus a per-repository project root derived from the checkout identity, including the declared host-scoped `unbound` scope for invocations outside any checkout.
- The checkout identity marker (minted once, atomic, `0600`, inside the git common directory) carrying the project key and project identifier, and its create-once read/write seam.
- The host index: schema, revision, bounded maintenance (upsert plus provable pruning), corrupt-index recovery with the corrupt file preserved, and the rule that state locations are always re-derived.
- The `projects list [--json]` command: verb, options, envelope, text table, ordering, exit codes, and the three contract error identities.
- Handover state derivation (`engine` / `shell` / `in-transition`) from the folded handover truth and the derived authority view.
- Daemon reachability with the closed degradation-reason vocabulary and the bounded read-only probe behind an injected mount capability.
- Consumption of the policy by every state-opening surface: CLI production composition, MCP serve, daemon socket derivation, dispatch state root, retro sidecar, owner-hold read, and the CLI-independent shell fallback.
- The host-wide owner-hold scope preserved, including the migration treatment of its marker.
- The one-step migration procedure and the legacy-detection warning; the migration note as a delivered document with a declared distribution class.
- Mount obligations: the prompt-required set entry, help entries, the reference page with `--help`/`--version`, the coverage inventory, the per-command reference page root in the two gates, and three error-table rows in a new domain kind with the result-contract synced.
- Reconciliation: the state-layer, CLI-entrypoint, and branding-seam system specs, a new feature page for the `projects` surface, and the planning-corpus updates (backlog markers, status snapshot, command registry, milestone-pack mount note).
- Tests proving same-ref isolation, discovery without a registry, identity stability, honest degradation, migration integrity, and test isolation from the real user state directory.
- The release obligation: one changeset declaring the five fixed-group packages at `minor`, because the release gate pins exactly that shape.

### 7.2 Out of Scope

- [OUT] Any change to the state layer's record contract, schema version, record kinds, key prefixes, fold rules, validation predicates, or store file layout.
- [OUT] Per-project owner holds, per-project owner-hold markers, or any narrowing of the delivered owner-hold meaning.
- [OUT] Mounting or implementing the board family, `dispatch attempts`, the event taxonomy, or `spend` v2; those belong to their own M2 stories.
- [OUT] Closing the resident-daemon mount gap: no daemon lifecycle command is composed in this build, and `projects list` reports that state.
- [OUT] Automatic migration, a migration command, a `projects` verb other than `list`, or any operator-maintained registry.
- [OUT] Filesystem crawling for checkouts outside the host index, and any registry entry not created by use.
- [OUT] Re-attributing historical records of a pre-migration shared store to their originating repositories.
- [OUT] Changing dispatch identity resolution, handover-gate evaluation, queue scheduling, lane leases, provider parks, or closeout semantics.
- [OUT] Redesigning the shell fallback, deprecating it, or widening its directory search depth.
- [OUT] Multi-host coordination, remote or networked state, or anything that puts delivery state in a cloud service.
- [OUT] A new workspace package, a new external dependency, or a version bump of the state schema.

### 7.3 Deferred / Maybe-Later

- Per-project owner holds (a marker inside each project root), with the union-of-scopes semantics and the hook-example update that would need to accompany them.
- An explicit re-attribution or split tool for historically shared state, if operators report real loss after migration.
- Retiring the host-wide index in favour of an on-demand discovery that reads a bounded, configurable set of workspace roots.
- A `projects` verb that opens a checkout (`projects open`) or prints a machine-readable host inventory for other tools.
- Extending the same scope to the coordinator's supervisor records, should they acquire host-level state beyond what the project root already holds.
- Mounting the daemon lifecycle family (tracked separately), which would turn the unmounted daemon reason into a live probe in the shipped build.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The interface surface is the CLI, the state layout, and the host index file.

| Invocation | Contract |
|---|---|
| `projects list` | Enumerates managed projects as a deterministic table with columns `key`, `root`, `state`, `daemon`, `handover`, sorted by project key. Exit `0` produced; `1` refused (unknown verb, or a managed checkout whose identity is unreadable); `2` platform or state failure. |
| `projects list --json` | Machine envelope `{ ok, command, data, error?, warnings? }` with `data.projects[]` carrying exactly `projectKey`, `root`, `stateLocation`, `daemonReachable` (`{ reachable, reason? }`), `handoverState`, plus `data.hostIndexRevision`. No new top-level envelope keys. |
| `projects <other-verb>` | Refused at exit `1` with the shared invocation classification; no other verb exists in this contract. |
| `projects --help`, `projects list --help`, `--version` | Served from the static help inventory like every prompt-required family; no state, network, git, or configuration read; the reference page documents both flags. |
| Every store-opening command (`status`, `brief`, `queue`, `lanes`, `blockers`, `phase`, `commit`, `lint`, `plan`, `verify`, `merge`, `closeout`, `spend`, `retro`, `dispatch`, `coordinator`) | Grammar, flags, envelopes, and exit projections unchanged. The state root they read and write becomes `<host root>/projects/<project key>`; an invocation outside any checkout uses the declared `unbound` scope with a warning. |
| MCP surface | Same state-scope policy and therefore the same state root as the CLI for the same checkout; tool names, payloads, and error parity unchanged. |
| Shell fallback (dispatch authority read) | Resolves the same project state root before locating the derived authority document; environment-override precedence unchanged; search depth not widened. |

### 8.2 Events / Messages

None. No event, message, telemetry event, or subscription topic is added, removed, or reshaped. The command audit ledger continues to record invocations through the delivered mechanism, and the new command is covered by it like every other command.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Checkout identity marker | A checkout-scoped file inside the git common directory carrying a project key (a readable slug) and a project identifier minted once, plus a creation timestamp. Created once, atomically, `0600`, never rewritten, shared by the linked worktrees of one repository, travelling with a moved or renamed checkout. Not a state record and not part of the store artifact set. |
| DM-2 | Host index | One host-level document under the host root with a schema identity, a monotonic revision, and one entry per registered project: project key, project identifier, absolute checkout root, derived state location, and the time the entry was last written. Derived and rebuildable; never authoritative over delivery state. |
| DM-3 | Project state root | `<host root>/projects/<project key>`, containing exactly the delivered store artifacts under workspace `default` with unchanged names, modes, and semantics. The host root keeps only the host index, the optional host-wide owner-hold marker, the project container, and the declared `unbound` scope. |
| DM-4 | `projects.v1` envelope data | `data.projects[]` entries with exactly five fields plus `data.hostIndexRevision`; entries sorted by project key; `daemonReachable` is a structured value `{ reachable, reason? }`. |
| DM-5 | Handover state projection | A derived, unpersisted projection with the closed values `engine`, `shell`, `in-transition`, computed per project from the folded latest handover operation and the derived authority document. |
| DM-6 | Error identities | Three rows under a new `projects` domain kind: `projects.identity-unreadable` (refusal), `projects.registry-corrupt` (state), `projects.state-unavailable` (state), each with category, retryability, consequence, remediation, and projection class, and each documented in the result-contract spec. |
| DM-7 | Owner-hold scope | Unchanged meaning and location: the marker is read at the host root and applies to every project; the environment override keeps its precedence. No per-project marker exists. |

No schema-version bump, no new state record kind, no changed key prefix, and no changed validation predicate. The store contract (`delivery.state.v1`) is untouched; the change moves the directory a store is opened in.

### 8.4 External Integrations

| Integration | Change |
|---|---|
| Local git metadata | Read-only inspection of the `.git` directory or `gitdir:` file and the git common directory, using the delivered checkout resolution. No new process spawn beyond the existing reads and no network. |
| Local unix-domain socket (resident daemon) | A bounded, read-only connect probe to the derived socket path, never performed when the build declares no daemon capability. No protocol write, no payload, no network transport. |
| Filesystem layout under the host root | New project container and host index; the delivered store artifacts are moved, not reshaped. Permissions stay `0700` for directories and `0600` for store-managed files, and the marker follows the same discipline. |
| GitHub API, tracker, CI, providers | Untouched; not called by the new command. |
| CLI-independent shell fallback | Reads the derived authority document under the project state root instead of the host root; its failure-to-dual-run default is unchanged. |

### 8.5 Backward Compatibility

- **Command surface**: no grammar, flag, envelope, exit-code, or human-text change for any delivered command; the only change is the state root they resolve, plus the new family.
- **State contract**: unchanged schema version, record kinds, key prefixes, and file layout inside a root; the workspace identifier stays `default`, which is what makes migration a move rather than a rewrite.
- **Existing state**: a populated single store is not read in place after the upgrade. That is a deliberate, bounded break, mitigated by the delivered migration note, the legacy-detection warning, and the fact that the migration is a reversible directory move. The window between upgrade and migration is visible on every state-opening invocation rather than silent.
- **Out-of-checkout invocations**: these no longer see repository state; they use the declared `unbound` scope with a warning. The migration note states that delivery commands are expected to run inside the checkout.
- **Owner hold**: identical semantics; the marker is not moved, so a pre-migration hold keeps holding everything.
- **Shell fallback**: keeps working, resolves the new root, and keeps the authoritative evidence as its only non-default signal. Its behaviour is unchanged for a host that has not migrated (no authority document is found, which resolves to `dual-run`, exactly as today).
- **Tests and fixtures**: every existing suite that resolves a state directory keeps its injected seams; the new suites point the state-scope override at a temporary host root so the real user state directory is never written.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Isolation: no project's state set intersects another project's, and no surface observes another project's documents or entries | 0 shared store files and 0 cross-observed documents across the two-checkout same-ref scenario; asserted per read surface (`phase`, `queue`, `lanes`, `status`, `dispatch`) |
| NFR-2 | State-contract preservation: no schema-version change, no new record kind, no key-prefix change, no layout change inside a root | 0 diffs in store artifact names, modes, and semantics; existing state suites green without modification |
| NFR-3 | Determinism: repeated `projects list` runs over unchanged state produce identical output | 2 of 2 identical human tables byte for byte, and structurally identical JSON across runs and across project ordering in the index |
| NFR-4 | Bounded work: index maintenance and the overview add no filesystem crawl and no unbounded read | maintenance p95 ≤ 10 ms with at most 1 index read and 1 write per invocation; `projects list` p95 ≤ 500 ms at 25 projects and ≤ 4 s at 200; per-project reads bounded to the handover key prefix |
| NFR-5 | Honest degradation: no claim that is not backed by evidence | 0 `reachable: true` without a successful bounded connect; 0 `engine` without agreeing folded truth and view; 0 `in-transition` without a detected disagreement; 0 `projects.registry-corrupt` on an absent index |
| NFR-6 | Identity stability: the project key and state root survive rename, move, worktree use, and nested invocations | 100% identical key and state location across a working-directory rename, a linked-worktree invocation, a moved checkout, and a nested-subdirectory invocation |
| NFR-7 | Migration integrity: the move preserves every byte and every mode and is reversible | 0 content changes across all store artifacts; audit chain verifies after the move; retro sidecar reads after the move; the inverse move restores the pre-migration reads |
| NFR-8 | Test isolation: no test writes to the real user state directory or the real home checkout state | 0 writes outside the per-test temporary root, asserted by a guard that fails the suite on a leak |
| NFR-9 | Surface parity: the same policy serves every surface | 1 state-scope policy implementation; ≥ 6 consumers asserted structurally (CLI composition, MCP serve, daemon socket derivation, dispatch state root, retro sidecar, owner-hold read) plus the shell fallback |
| NFR-10 | No new hardcoded names and no dependency creep | 0 new product or binary literals; 0 new external dependencies; 0 new workspace packages; boundary, literal, and licence gates green |
| NFR-11 | Gate health: the aggregate gate passes | `pnpm check` green with a temporary directory override, including help-coverage, reference-page parity, error-table sync, and the release gate |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **No new telemetry.** No event, metric, span, or diagnostic stream is added. The `projects` surface is the observability: it reports state location, daemon reachability with a reason, and handover state that previously had no host-level read.
- **Warnings instead of silent degradation.** An invocation outside a checkout warns that its state is not repository-scoped; an invocation inside an unmigrated host warns once and names the migration note; a stale-but-present index entry is reported with a warning naming the project and the reason. Warnings never change a state-opening command's exit code, and `projects list` reports index corruption as an error instead of a warning because it cannot answer honestly.
- **Failure diagnosis.** Each of the three new error identities names the project key or the index it failed on, so an operator can act without reading state files.
- **Evidence-preserving recovery.** A corrupt host index is preserved as a timestamped sibling before it is replaced, so the failure remains inspectable.
- **No secrets and no unintended path disclosure.** The host index and the `projects` envelope contain absolute local paths by design; they are local-only surfaces and never flow into pm-notes, change artifacts, commit messages, PR bodies, telemetry, or the retro sidecar.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Migration is done wrongly or partially, leaving a store that neither the old nor the new layout serves | H | M | The note prescribes one move of every store artifact and one verification step; AC-F8-1 asserts byte-identity, audit-chain verification, and retro readability after the move; the move is reversible | An operator who moves only part of the directory recovers only by moving back; the note names the artifact set explicitly |
| RSK-2 | A surface is missed, so one command keeps reading the host root and silently reports empty state | H | M | F-6 requires one policy and ≥ 6 asserted consumers; AC-F6-1 pins the single resolution structurally and AC-F6-2 asserts write placement for the principal commands; AC-F6-3 covers the MCP surface | A surface added later could bypass the policy; the structural assertion is the guard and the policy is the only exported way to derive a state path |
| RSK-3 | Project identity is unstable, so a move or rename silently forks one repository into two projects | H | M | Identity is minted once and persisted in the common directory, not derived from a path; AC-F1-3 covers rename, move, worktree, and nested invocations | A deleted marker re-mints a new key and orphans the old root; the note documents that the marker is authoritative and must not be deleted |
| RSK-4 | Two clones of one remote are mistakenly treated as one project, reintroducing same-ref collisions | H | L | Identity is per git common directory, not per remote; AC-F1-4 asserts distinct projects for two clones | An operator who expects clones to share state will be surprised; the overview shows both rows, which is the honest answer |
| RSK-5 | The host index is stale or corrupt and the overview lies or refuses | M | M | Absent is not corrupt; reads re-derive state locations; stale-but-present entries are reported with a warning; corruption is recovered by maintenance with the corrupt file preserved; AC-F2-1/AC-F2-3/AC-F2-5 cover all three | An entry whose root vanished is invisible until maintenance; state is never deleted, so the loss is presentational |
| RSK-6 | Pruning deletes state instead of an index entry | H | L | Pruning is index-only by contract; AC-F2-4 asserts state survives pruning and that re-registration recovers the same key and root | A future change could widen pruning; the assertion is permanent |
| RSK-7 | Daemon reachability claims a live daemon that is not there, or hides a real one | M | L | The mount capability is injected and the shipped build declares the unmounted reason; the probe is a bounded read-only connect; AC-F5-1/AC-F5-2/AC-F5-3 cover unmounted, reachable, and the reason vocabulary | A daemon that binds and then stalls still reports reachable; reachability is liveness of the socket, not of delivery work, and the contract says so |
| RSK-8 | Handover state is guessed, so an operator believes a repository is engine-authoritative when it is not | H | L | `engine` requires both the folded truth and an agreeing derived view; `in-transition` requires a detected disagreement; AC-F4-1/AC-F4-2/AC-F4-3 assert each cell and a mutation proves the projection cannot be hardcoded | A torn ledger is reported as a state failure, never as a state |
| RSK-9 | The owner hold is narrowed by the move, weakening a stop-all control | H | L | The marker stays at the host root and is read there; AC-F7-1 asserts host-wide effect and AC-F8-3 asserts post-migration continuity | Per-project holds are deferred; an operator who wants one has no surface for it yet, and the note says so |
| RSK-10 | The shell fallback stops seeing engine authority after the handover, so both stacks act authoritatively | H | M | F-6 requires the fallback to resolve the project root and forbids widening the search depth; AC-F6-5 asserts the handover is observed by the fallback | A host that migrates while an unupdated fallback is deployed resolves to `dual-run`, which is the safe direction |
| RSK-11 | The new family ships composed but unreachable, repeating the mount gap the milestone pack records for the board family | M | M | `projects` joins the prompt-required set, gains help entries and a reference page, and both help gates are wired to the page root; AC-F9-1/AC-F9-2 assert reachability and gate health | A future family could repeat the gap; the parity gate is the permanent guard |
| RSK-12 | Tests write into the real user state directory and corrupt a developer's host | M | M | Every suite points the state-scope override at a temporary host root; NFR-8 requires a leak guard | A test that forgets the override is caught only by the guard; the guard is mandatory in the new suites |
| RSK-13 | The planning corpus drifts: the backlog keeps saying planned, the registry keeps saying undelivered | M | H | F-10 names every file to update and AC-F10-2 makes it review-verified; the status snapshot's own maintenance convention is the authority for the shape of the update | Review is the only gate for corpus freshness; the receipt is the diff |

## 12. ASSUMPTIONS

- The delivered checkout resolution returns the git directory and the git common directory from the working directory, treating a `.git` directory as a normal root and a `gitdir:` file as a linked worktree root, and it never continues above the first `.git` entry. This is verified in the delivered adapter and is the identity input this change relies on.
- The git common directory is shared by every linked worktree of one repository and never by a second repository, and a checkout-scoped file stored beside it survives a working-directory rename. This is the delivered marker discipline for dispatch identity.
- The state layer's store facade accepts an injected state directory per open, applies and verifies `0700` on that directory and `0600` on store-managed files, and creates missing parents; no state-layer change is needed to open a store at a deeper root.
- The host root keeps the delivered resolution: an absolute `<PREFIX>_STATE_DIR` wins, otherwise the injected home plus the brand state directory name. No new configuration key is introduced.
- The production CLI composition resolves the state directory in exactly one place, so one policy application covers every command family it composes.
- The MCP surface composes its own store but consumes adapters and core, so it can consume the same policy without importing the CLI.
- The resident daemon is not composed in the production entrypoint; its lifecycle command is unmounted, and the daemon capability must therefore be reported as unmounted rather than probed.
- Handover records are readable by key prefix and the derived authority document is readable as a plain file, so the handover projection is cheap and needs no new record.
- A managed checkout is discovered because a command was run in it; no filesystem crawl is performed, and "no manual configuration" therefore means "no hand-written registry", not "no prior use".
- A pre-migration store can be moved into one project root as a whole, and its records for other repositories are acceptable as history of the designated primary project because splitting them would require rewriting records that carry no repository attribution.
- Tests can create real temporary git checkouts with distinct common directories and can point the state-scope override at a temporary host root, so isolation and migration are exercised end to end without touching the real user state.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | State layer (M0-S5, GH-174) | Store facade, layout, permissions, derived documents, prefix reads |
| Depends on | Queue and scheduling (M1-S17, GH-237) | Ref-keyed entries and leases that the collision affects |
| Depends on | Dispatch handover and the derived authority view (M1-S9, GH-239) | The folded truth and the derived document the projection compares |
| Depends on | Checkout-scoped dispatch identity marker | The marker discipline the project identity reuses |
| Depends on | Checkout git directory resolution | The identity input (git dir, common dir) |
| Depends on | Configuration catalog: state scope and daemon socket | The host root rule and the socket derivation the probe uses |
| Depends on | Entrypoint prompt-required composition and help inventory | The mount mechanism and the help surface |
| Depends on | Help-coverage gate, reference-page parity gate, error-table sync gate | The gates the new family must satisfy |
| Depends on | Release gate (five fixed-group packages at minor) | The changeset obligation |
| Blocks | M2-S4 board (full cross-repository board) | The board depends on per-repository state and the host overview |
| Blocks (soft) | M2-S12, M2-S13, M2-S15, M2-S16, M2-S17 | Each needs per-repository state or the host index to attribute state to a repository |
| Blocks (soft) | Any operator workflow that runs two repositories on one host | The collision is what this change removes |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the migration re-attribute historical records of a shared store to the repositories that produced them? | The pack forbids rewriting state files, and queue and phase records carry no repository attribution, so any split would be inference. **Recommendation:** no re-attribution; the move lands the whole store in one designated primary project and other checkouts start fresh, with the consequence stated in the note (DEC-11). | Resolved in-spec — DEC-11; revisit only if operators report real loss |
| OQ-2 | Should the owner hold become repository-scoped so one repository can be paused while another keeps running? | A per-project hold is operationally attractive but would narrow a stop-all control and would be invisible to consumers that read only the host marker (for example the pre-iteration hook example). **Recommendation:** keep the hold host-wide in this change and list per-project holds as deferred (§7.3, DEC-9). | Resolved in-spec — DEC-9; deferred, not rejected |
| OQ-3 | Should `projects list` repair the host index while listing? | The command page calls the surface read-only, and a read that writes makes concurrent listings contend on one file. **Recommendation:** maintenance runs on any state-opening invocation inside a checkout, and `list` never writes (DEC-5). | Resolved in-spec — DEC-5 |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The project state root is `<host root>/projects/<project key>`, and the host root keeps the delivered resolution rule. | The host root already has an operator-facing override and a brand-derived default, so keeping it means the new layer adds no configuration. Keeping state under the host root makes migration a same-tree move with identical file names, keeps state out of the working tree so it cannot be committed or swept, and keeps the index beside the roots it indexes. The command page's illustrative in-checkout state path is a proposal refined here; the pack states command pages are proposals refined at story delivery. | 2026-11-11 |
| DEC-2 | The workspace identifier stays `default` and the store layout inside a root is unchanged; isolation comes from the root, not from re-keying the workspace. | Re-keying would rename every store artifact and every derived document, which would make migration a rewrite and would break every consumer that pins a document name. Root-level scoping preserves the delivered contract exactly, so migration is a move. | 2026-11-11 |
| DEC-3 | Project identity is minted once and persisted in a checkout-scoped marker inside the git common directory, carrying a readable project key and a project identifier; it is not derived from the checkout path and not taken from the remote identity. | A path-derived key breaks on rename and move; a remote-derived key collapses two clones of one remote into one project, which would reintroduce the same-ref collision. The common directory is the smallest unit shared by exactly the checkouts that should share state. | 2026-11-11 |
| DEC-4 | The host index is a derived, revisioned cache under the host root, maintained by bounded upsert-plus-provably-dead pruning on any state-opening invocation inside a checkout; it is never authoritative. | "No manual registry" requires derivation, and derivation from use is the only bounded alternative to a filesystem crawl. Treating it as a cache keeps it rebuildable and keeps delivery state authoritative. | 2026-11-11 |
| DEC-5 | `projects list` is read-only with respect to delivery state and never writes; absent index means an empty successful list. | The command page declares the surface read-only; a read that writes would contend on one host file for concurrent listings. Absent-versus-corrupt is the distinction that keeps a first run from looking broken. | 2026-11-11 |
| DEC-6 | `daemonReachable` is a structured value `{ reachable, reason? }` under the single declared field. | The contract fixes the entry to exactly five fields and simultaneously requires a boolean plus a degradation reason; nesting keeps both properties and keeps the reason machine-readable instead of smuggling it into text. | 2026-11-11 |
| DEC-7 | `handoverState` maps to `engine` for agreeing authoritative evidence, `shell` for dual-run or absent evidence, and `in-transition` for a detected disagreement between the folded handover truth and the derived authority document. | `in-transition` is the only third value available, and the only honest source for it is a real disagreement between two delivered artifacts; assigning it for anything else would be invention. Unreadable state is a state failure, not a fourth state. | 2026-11-11 |
| DEC-8 | A missing project state root is a normal first-use condition, not a failure; `projects.state-unavailable` is reserved for a state location that is present but unreadable, or that cannot be established at all (including an uncreatable identity marker). This refines the command page's wording "missing or unreadable", because a registered checkout that has only been read from has no store yet, and refusing the whole overview for it would make the command unusable on a real host; the absent case is reported as the `state-absent` daemon reason with `handoverState` `shell`. | A freshly discovered checkout has no state by definition; failing the whole overview for it would make the command unusable on a real host. Reservation keeps the error meaningful, and the refinement is recorded on the command page rather than applied silently. | 2026-11-11 |
| DEC-9 | The owner hold stays host-wide: the marker is read at the host root, the environment override keeps its precedence, and no per-project marker is introduced. | The hold is a stop-all safety control; narrowing it silently would weaken it, and consumers that read only the host marker would miss a per-project hold without any signal. | 2026-11-11 |
| DEC-10 | An invocation outside any git work tree uses a declared host-scoped `unbound` state root beside the project container, with a warning, and never falls back into a project's root. | Refusing would break currently working host-level invocations; a silent fallback into the old shared root would reintroduce ref-keyed collisions. A distinct declared scope keeps reachability without mixing. | 2026-11-11 |
| DEC-11 | Migration moves one populated store wholesale into one designated primary project's root; no record is re-attributed, no state file is rewritten, and other checkouts start fresh. | Queue and phase records carry no repository attribution, so a split would be inference presented as evidence. A reversible move is the only migration the state contract allows, and it makes the loss (if any) explicit and recoverable. | 2026-11-11 |
| DEC-12 | The state-scope policy lives below the CLI tier as a runtime-neutral rule over injected facts, with the filesystem and git I/O in the adapter tier, and every surface consumes it. | The MCP surface must not import the CLI and the CLI must not own a rule the MCP surface duplicates; a single policy also makes the invariant structurally assertable. | 2026-11-11 |
| DEC-13 | The `projects` reference page is the M2 command page, extended with the `--help` and `--version` contract; the help-coverage and parity gates learn a per-command reference page root instead of placing an M2 page inside the M1 milestone snapshot. | The M1 snapshot is a dated record that stays as written, and putting an M2 page in it would misrepresent the snapshot. A declared mapping keeps both gates strict and keeps one page per command. | 2026-11-11 |
| DEC-14 | A present but unparsable host index is corruption for a read and is replaced by maintenance, with the corrupt file preserved as a timestamped sibling; a corrupt index is never reported for an absent one. | Recovery must not require a filesystem crawl, and evidence must survive the repair. The absent case is the ordinary first run and must stay a success. | 2026-11-11 |
| DEC-15 | `version_impact` is `minor` and the change ships one changeset declaring all five fixed-group packages at `minor`. | The release gate pins exactly one new changeset with those five packages at `minor`; a patch entry fails the gate, and the change adds a command family and relocates state, which is minor and not patch. | 2026-11-11 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| State-scope policy (core, runtime-neutral) | New — pure rule over injected host root, brand state directory name, and resolved checkout identity; returns project key, state root, or the declared unbound scope |
| Checkout identity marker seam (adapter) | New — create-once, atomic, `0600` marker read/write inside the git common directory, following the delivered dispatch-identity discipline |
| Host index seam (adapter) | New — read, replace-atomically, revision increment, corrupt-file preservation, provably-dead pruning |
| Production CLI composition | Updated — the single state-directory resolution becomes the two-layer state-scope resolution; index maintenance runs once per invocation; the legacy-detection warning is emitted here |
| MCP serve composition | Updated — consumes the same policy instead of repeating the resolution |
| Configuration catalog (daemon branch) | Updated — the daemon socket path derives from the project state root; the inside-the-state-directory rule is unchanged |
| State layer (store facade and layout) | Unchanged — same artifacts, modes, record kinds, and schema version, now opened at a deeper root |
| Dispatch handover projection consumer | Updated — the folded handover truth and the derived authority document are read per project for the new projection |
| Owner-hold resolution | Updated in wiring only — reads the host root; semantics unchanged |
| CLI-independent shell fallback | Updated — resolves the project state root; precedence unchanged; search depth not widened |
| `projects` command family (CLI) | New — `list` verb, `--json`, envelope, deterministic table, exit projections, error identities |
| Error table and result-contract spec | Updated — one new domain kind, three rows, synced documentation |
| Entrypoint composition, help inventory, reference-page gates, coverage inventory | Updated — `projects` becomes prompt-required; new help entries; per-command reference page root |
| Reference page `doc/planning/oss-tooling/milestones/m2/commands/projects.md` | Updated — becomes the delivered reference page with the `--help`/`--version` contract and the delivered errors |
| Migration note (guide) | New — one-step move, primary-checkout designation, owner-hold continuity, fresh-start consequence, declared distribution class |
| System specs: state layer, CLI entrypoint, branding seam, result contract | Reconciled |
| System spec: `projects` feature page | New — surface coverage for the overview and the state-scope rule |
| Planning corpus: backlog, status snapshot, command registry, M2 entrypoint delta, M2 pack status note | Reconciled |
| Structural inventories and release artifacts | Updated — new module inventory rows, help coverage fixture, one five-package minor changeset |

### 16.1 Documentation impact (phase 7 inputs)

| Document | Expected change |
|---|---|
| `doc/spec/features/feature-state-layer.md` | State root becomes the host root plus the project root; the host index is named as the only host-level document; the store layout table gains a note that the same artifacts are opened per project root; the migration constraint (move, never rewrite) is recorded |
| `doc/spec/features/feature-cli-entrypoint.md` | The prompt-required table gains `projects list`; the state resolution note changes from one directory to the two-layer scope; the unmounted daemon statement stays and is referenced by the new degradation reason |
| `doc/spec/features/feature-branding-seam.md` | The `stateDirectoryName` consumer list states that the value names the host root from which project roots derive |
| `doc/spec/features/feature-projects.md` | New page: `projects.v1`, the envelope and text contract, exit codes, error identities, discovery and pruning rules, the handover and daemon projections, and the identity marker |
| `doc/spec/features/feature-result-contract.md` | Three new identities under a new domain kind, so the bidirectional sync gate stays green |
| `doc/spec/features/feature-dispatch-engine.md` | The authority-view read is noted as consumed from the project state root; the shell-fallback paragraph states that the project root is resolved |
| `doc/spec/features/feature-owner-gate-sla.md` | The owner-hold marker is stated as host-wide and read at the host root |
| `doc/guides/` migration note | New guide with `ados_distribution: redistributable`, registered in the forbidden-literals registry |
| `doc/planning/oss-tooling/backlog.md` | M2-S11 progress markers |
| `doc/planning/oss-tooling/status.md` | M2 delivery snapshot entry per the maintenance convention |
| `doc/planning/oss-tooling/cli-command-registry.md` | The `projects` row moves from planned to delivered |
| `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` | The observed composition gains `projects`; the remaining M2 additions stay planned |
| `doc/planning/oss-tooling/milestones/m2/commands/projects.md` | Delivered reference page with `--help`/`--version`; the illustrative `STATE` column is corrected to the delivered host-root placement, `daemonReachable` is documented as the structured `{ reachable, reason? }` value with the closed reason vocabulary, `projects.state-unavailable` is documented as present-but-unreadable or unestablishable (an absent root is a first-use state), and the page states that listing is read-only with respect to delivery state; the proposed status header is retained per the pack's status semantics |
| `doc/planning/oss-tooling/milestones/m2/README.md` | Only if the pack index needs the status note adjusted; the planned-until-exit semantics stay |
| `scripts/hooks/pre-opencode-iteration-owner-hold.sh` docs | Marker-path guidance states that the hold is host-wide and read at the host root |

## 17. ACCEPTANCE CRITERIA

**Verification method.** Each acceptance criterion names its evidence class — **suite** (a permanent assertion in the delivered test suites), **mutation-verified** (the assertion guards behaviour the pre-change code already exhibits, so its detection power is proven by an in-place mutation or revert of the artifact it exercises, after which the assertion must turn red and be restored), or **review-verified** (the evidence is a diff inspection recorded in the change review). A criterion that also makes a contract-stability claim — a row not added, a snapshot page not touched — names that half explicitly as review-verified, because no permanent test can assert a diff against a moving base.

| ID | Criterion | Linked | Evidence |
|----|-----------|--------|----------|
| AC-F1-1 | **Given** two checkouts of different repositories on one host under one temporary host root, **when** each records phase state and a queue entry for the same ref, **then** the phase documents and queue records are disjoint file and key sets under two different project roots, and neither checkout's store contains a record the other wrote (SC-M2-S11-01 reconciled, Appendix E). | F-1, NFR-1, G-1 | Suite, red under the revert of the two-layer resolution to the single host root |
| AC-F1-2 | **Given** the same two checkouts after AC-F1-1, **when** `phase list`, `queue list`, `lanes`, `status`, and `dispatch` observe that ref in each checkout, **then** each surface reports only its own state and no surface reports the other checkout's phase completion, entry, or lease (SC-M2-S11-01 reconciled, Appendix E). | F-1, NFR-1, G-1 | Suite |
| AC-F1-3 | **Given** a managed checkout, **when** it is invoked from a nested subdirectory, from a linked worktree of the same repository, and after the checkout directory has been renamed and moved, **then** the project key and the state location are identical in all four cases and only the reported checkout root changes after the rename; **and** a repository nested inside another checkout resolves to its own project. | F-1, NFR-6, G-2 | Suite |
| AC-F1-4 | **Given** two clones of the same remote on one host, **when** each resolves its scope, **then** they are two projects with distinct keys and distinct state roots; **and** every linked worktree of one clone resolves to that clone's single project; **and** the identity marker is created once, atomically, `0600`, is not rewritten by later invocations, and carries no hardcoded product or binary name. | F-1, DM-1, G-2, NFR-10 | Suite |
| AC-F2-1 | **Given** a host with no host index, **when** `projects list --json` runs, **then** it exits `0` with an empty `data.projects`, `data.hostIndexRevision` equal to zero, and no `projects.registry-corrupt`; **and** an invocation inside a checkout creates the index and the next `projects list` reports that project. | F-2, F-3, NFR-5, RSK-5 | Suite, red under a mutation that maps an absent index to corruption |
| AC-F2-2 | **Given** two managed checkouts with no hand-written registry and no prior overview run, **when** `projects list --json` runs from either of them, **then** the envelope returns both projects, each carrying `projectKey`, `root`, `stateLocation`, `daemonReachable`, and `handoverState`, plus the index revision (SC-M2-S11-02 reconciled). | F-2, F-3, DM-4, G-3, G-4 | Suite |
| AC-F2-3 | **Given** a host index that is present but unparsable, **when** `projects list --json` runs, **then** it refuses at exit `2` with `projects.registry-corrupt`, names the index, and changes no file; **and when** any state-opening invocation then runs inside a checkout, **then** the corrupt file is preserved as a timestamped sibling, a fresh index is written containing that project, and the following `projects list` succeeds. | F-2, DM-6, DEC-14, RSK-5 | Suite |
| AC-F2-4 | **Given** an index entry whose checkout root no longer exists and an entry whose root now resolves to a different project identifier, **when** maintenance runs, **then** both entries are removed from the index; **and** the state roots they referenced are untouched; **and** re-registering the moved checkout restores the same project key and the same state location. | F-2, DEC-4, RSK-6 | Suite, red under a mutation that deletes the referenced state root during pruning |
| AC-F2-5 | **Given** an index written by maintenance, **when** the revision and the reported state location are inspected, **then** the revision increases monotonically with each index write and `projects list` reports the revision it read; **and given** an index entry whose recorded state location disagrees with the location derived from its project key, **then** the derived location is reported and the disagreement is a warning, never a redirected read. | F-2, DM-2, DEC-4, RSK-5 | Suite, red under a mutation that trusts the recorded location |
| AC-F3-1 | **Given** two registered projects, **when** `projects list --json` runs, **then** each entry carries exactly the five contract fields (no more, no fewer), entries are ordered by `projectKey`, and `data.hostIndexRevision` is present alongside `data.projects` with no new top-level envelope key. | F-3, DM-4, G-4 | Suite |
| AC-F3-2 | **Given** unchanged state, **when** `projects list` runs twice, **then** the human output is byte-identical, has exactly the columns `key`, `root`, `state`, `daemon`, `handover`, and is sorted by key; **and** a project with an unreachable daemon renders the reason in the `daemon` column instead of a bare negative. | F-3, NFR-3, G-4 | Suite |
| AC-F3-3 | **Given** the three contract errors and the refusal path, **when** each condition is provoked, **then** an unknown verb exits `1`, a managed checkout whose identity cannot be read exits `1` with `projects.identity-unreadable`, a present but unreadable project state location exits `2` with `projects.state-unavailable`, and a produced list exits `0`; **and** no other exit code is produced by the family. | F-3, DM-6, NFR-5 | Suite |
| AC-F4-1 | **Given** a project whose folded latest handover operation is `authoritative` and whose derived authority document agrees, **when** `projects list --json` runs, **then** `handoverState` is `engine`; **and given** a project whose folded latest operation is `dual-run`, **then** it is `shell`; **and given** a project with no handover record and no derived document, **then** it is also `shell`. | F-4, DM-5, G-5 | Suite |
| AC-F4-2 | **Given** a project whose folded latest operation is `authoritative` while the derived document is absent, says `dual-run`, or is malformed, **when** the overview runs, **then** `handoverState` is `in-transition`; **and given** a project whose folded latest operation is `dual-run` while the derived document says `authoritative`, **then** it is also `in-transition`. | F-4, DM-5, DEC-7, RSK-8 | Suite, red under a mutation that makes `in-transition` unreachable |
| AC-F4-3 | **Given** the handover projection, **when** it is inspected for invention, **then** `engine` is produced only when both the folded truth and the derived document agree, `in-transition` only when they disagree, and a present but unreadable state location produces `projects.state-unavailable` at exit `2` rather than a handover state. | F-4, DEC-7, DEC-8, NFR-5 | Mutation-verified; the refusal half is suite-covered |
| AC-F5-1 | **Given** the shipped composition, which supplies no daemon capability, **when** `projects list --json` runs, **then** every entry reports `daemonReachable.reachable` as `false` with reason naming the unmounted daemon, at exit `0`; **and** no socket probe is attempted. | F-5, DM-4, NG-4, G-5 | Suite |
| AC-F5-2 | **Given** a composition that supplies a daemon capability and a project whose derived socket path is served by a bound local socket, **when** the probe runs, **then** `daemonReachable.reachable` is `true` with no reason; **and given** the same composition with no bound socket, **then** it is `false` with the absent-socket reason. | F-5, G-5 | Suite |
| AC-F5-3 | **Given** a composition with a daemon capability, **when** the socket path is absent, refuses the connection, or the project has no state root, **then** the reported reason is exactly the corresponding declared reason from the closed vocabulary; **and** the probe completes or gives up within the declared timeout and performs no write and no command. | F-5, NFR-4, NFR-5 | Suite |
| AC-F6-1 | **Given** the delivered sources, **when** the structural assertion runs, **then** exactly one implementation of the state-scope rule exists below the CLI tier, the production composition and the MCP serve composition both consume it, and no surface derives a state directory from the home and brand value directly. | F-6, DEC-12, NFR-9, RSK-2 | Suite |
| AC-F6-2 | **Given** a fresh temporary host root and one checkout, **when** `phase complete`, `queue add`, `commit`, and `dispatch` run there, **then** every store artifact those commands produce exists under that checkout's project root and no store artifact exists at the host root; **and** `status`, `lanes`, `retro`, and `spend` read the same root. | F-6, DM-3, NFR-1, RSK-2 | Suite, red under the revert of the two-layer resolution |
| AC-F6-3 | **Given** one checkout and one temporary host root, **when** the MCP surface and the CLI both resolve state for it, **then** each opens the store under the identical project root; **and** the MCP tool payloads and error parity are unchanged. | F-6, NFR-9, RSK-2 | Suite |
| AC-F6-4 | **Given** a project state root and a daemon configuration without an explicit socket path, **when** the socket path is resolved, **then** it derives from that project root and satisfies the inside-the-state-directory rule; **and** an explicit socket path outside the project root is still refused. | F-6, F-5, DM-3 | Suite |
| AC-F6-5 | **Given** a host with a migrated project and an engine-authoritative handover for it, **when** the CLI-independent shell fallback reads the authority state, **then** it reports `authoritative` from the document under the project root; **and** a host with no project state root reports `dual-run` exactly as before; **and** the fallback's environment-override precedence is unchanged and its directory search depth is not widened. | F-6, RSK-10 | Suite, red under a mutation that widens the search depth instead of resolving the root |
| AC-F7-1 | **Given** a host-wide owner-hold marker at the host root and two registered projects, **when** any state-opening command runs in either checkout, **then** the hold is observed as active; **and** the environment override outranks the marker exactly as before; **and** no per-project marker location is read. | F-7, DM-7, DEC-9, RSK-9 | Suite |
| AC-F8-1 | **Given** a populated pre-migration store (ledger, header, index, fence, documents, chain keys, retro sidecar and lock, quarantine), **when** its contents are moved into one project root, **then** every file is byte-identical with its original mode, the audit chain still verifies, the retro sidecar still reads, and the same reads that worked before the move work after it; **and** the inverse move restores the pre-migration reads. | F-8, NFR-7, DEC-11, RSK-1 | Suite |
| AC-F8-2 | **Given** a host root that still holds store artifacts and a checkout whose project root does not exist, **when** a state-opening command runs inside that checkout, **then** exactly one warning naming the migration note is written to the error stream, nothing is moved, nothing is deleted, and the command's exit code is unchanged; **and given** a migrated host, no such warning is emitted. | F-8, G-7, RSK-1 | Suite, red under a mutation that removes the detection |
| AC-F8-3 | **Given** a pre-migration host-wide owner-hold marker, **when** the store is migrated, **then** the marker remains at the host root, the hold still stops every project, and the migration note states the primary-checkout designation, the fresh-start consequence for other checkouts, the owner-hold continuity, the out-of-checkout `unbound` scope, and the reversal step. | F-8, F-7, F-10 | Review-verified |
| AC-F9-1 | **Given** the built workspace, **when** `<binary> --help` runs, **then** `projects` is listed among the command families; **and when** `<binary> projects --help`, `<binary> projects list --help`, and `<binary> --version` run, **then** each succeeds at exit `0` with the help or version content and no state, network, git, or configuration read. | F-9, G-8, RSK-11 | Suite |
| AC-F9-2 | **Given** the help gates, **when** `pnpm check:help` and the reference-page parity test run, **then** both are green, `projects` is in the coverage inventory, its reference page is registered in the reference page list, the page contains `--help` and `--version`, and the M1 milestone snapshot pages are unmodified. | F-9, DEC-13, G-8 | Suite |
| AC-F9-3 | **Given** the error table, **when** the sync gate and the table are inspected, **then** exactly three rows exist under one new domain kind (`projects.identity-unreadable`, `projects.registry-corrupt`, `projects.state-unavailable`), each documented in the result-contract spec, and no existing row was added, retired, or reworded. | F-9, DM-6, G-8 | Suite; the unchanged-row half is review-verified |
| AC-F9-4 | **Given** the new command surface, its help entries, its reference page, and its error rows, **when** the forbidden-literal scan and the branding scan run, **then** no new hardcoded product or binary literal exists and every name is resolved from the injected brand identity. | F-9, NFR-10 | Suite |
| AC-F10-1 | **Given** the completed change, **when** the system specs are read, **then** the state-layer page states the two-layer state root and the host index, the CLI-entrypoint page lists `projects list` in the prompt-required set and states the two-layer resolution, the branding-seam page states that the state directory name names the host root, the dispatch-engine page states that the authority document is read under the project root, the owner-gate page states that the hold is host-wide, and a `projects` feature page covers the new surface. | F-10, §16.1 | Review-verified |
| AC-F10-2 | **Given** the completed change, **when** the planning corpus is read, **then** the M2-S11 backlog entry records the delivery, the status snapshot records the M2 delivery per its maintenance convention, the command registry row marks `projects` delivered by this change, the M2 entrypoint delta records `projects` as mounted while the other M2 additions stay planned, and the command page keeps the pack's proposed status. | F-10, §16.1, G-8 | Review-verified |
| AC-F10-3 | **Given** the change branch, **when** the release gate runs, **then** exactly one new changeset exists, it declares the five fixed-group packages at `minor`, it is the only changeset added, every pre-existing changeset is byte-identical, and no dependency or lockfile change accompanies it. | F-10, DEC-15 | Suite |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery unit**: one change, one PR against `main-tools`, one reviewable unit. The scope resolution, the host index, the command, the mount obligations, the tests, and the migration note land together: a partial delivery would leave a build that either reads the wrong root or advertises a family it cannot serve.
- **Order within the change**: the state-scope policy and the identity marker first (everything else consumes them), then the host index, then the command and its projections, then the mount and help obligations, then the migration note and the reconciliation. Each phase is independently green; the structural and isolation assertions arrive with the policy so no phase relies on a later one to be meaningful.
- **No feature flag.** A flag would have to select between two state roots, which is precisely the ambiguity this change removes; the two-layer resolution is the only path, and the legacy detection is the migration bridge.
- **Migration is operator-run and documented, not automatic.** An automatic move on first use would mutate state on a read path, could not be validated before it happened, and would be unrecoverable if it failed halfway. The delivered mechanism is a warning plus a written one-step move.
- **Communication**: the release note states that delivery state now lives under a per-repository root, that `projects list` is the new host overview, that an existing install must perform the one-step move, and that delivery commands are expected to run inside a checkout.
- **Rollback**: reverting the change restores the single-root behaviour. A host that has already migrated must move the files back; because no file was rewritten, the inverse move is sufficient. No schema, record, or output rollback is required.
- **Verification gates**: same-ref isolation and discovery tests, the structural single-policy assertion, the two help gates, the error-table sync gate, the release gate, and the aggregate `pnpm check` with a temporary directory override.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

**Migration is required** for every host that has used a pre-change build with at least one store artifact.

- **Designated primary checkout.** The operator chooses one checkout to inherit the existing history, because queue and phase records carry no repository attribution and inference would be guesswork.
- **Step 0 — quiesce.** Stop the foreground coordinator. No resident daemon runs in this build, so no daemon stop is required.
- **Step 1 — register.** Run any state-opening command inside the primary checkout. It mints the checkout identity marker, registers the project in the host index with an empty project root, and emits the legacy-detection warning.
- **Step 2 — move.** Move every store artifact from the host root into `<host root>/projects/<project key>/`: the ledger, header, index, fence, documents directory, audit chain key, retro evidence sidecar and its lock, the retro chain key, and the quarantine directory. Names, order, and modes are preserved. The host-wide `owner-hold` marker stays at the host root. The new host index stays at the host root.
- **Step 3 — verify.** `projects list` reports the project with its state location; a read command inside the checkout serves the migrated history; the audit chain verifies and the retro sidecar reads.
- **Reversal.** Move the artifacts back. Because nothing was rewritten and nothing was re-keyed, the inverse move restores the pre-migration reads.
- **Other checkouts.** They start with empty state; their historical records are not recoverable from the primary project without attribution that does not exist. The note states this plainly so the choice of primary checkout is informed.
- **Owner hold.** Unchanged in location and meaning; a hold set before the migration keeps holding every project on the host.
- **Host root override.** A `<PREFIX>_STATE_DIR` override now names the host root; project roots derive beneath it. The note says so, because an operator who pointed it at a specific store must move that store's contents into the derived project root.
- **Out-of-checkout invocations.** After the migration they use the declared `unbound` scope; the note states that delivery commands are expected to run inside the checkout.
- **No seeding** of project entries, identity markers, or index rows is performed beyond the automatic registration described above; nothing is written into a checkout's git common directory other than its identity marker.

## 20. PRIVACY / COMPLIANCE REVIEW

- **Personal data**: none. The host index holds local filesystem paths and project keys; paths are machine-identifying, not personal, and stay on the operator's own machine.
- **Path disclosure boundary**: unlike repository roots in queue records, the `projects` surface deliberately discloses absolute checkout paths and state locations to the local operator, because that is its purpose. The guard is directional: those values never flow into pm-notes, change artifacts, commit messages, PR bodies, telemetry, the audit ledger's payloads, or the retro sidecar. The existing non-disclosure rule for recorded repository roots is untouched.
- **Permissions**: the host root, the project container, and each project root stay `0700`; store-managed files stay `0600`; the identity marker is `0600`. The overview performs no write, so it cannot widen a permission.
- **Retention**: unchanged. Migration moves evidence rather than discarding it, and the corrupt-index sibling preserves evidence instead of deleting it.
- **Compliance**: no change to audit, retention, or consent obligations; the record contract is unchanged, so the audit chain remains verifiable across the move.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Tamper resistance of the inventory.** The index is untrusted input for reads: the state location is always re-derived from the project key, so editing or corrupting the index cannot redirect a state read or a probe to an arbitrary path. A disagreement is a warning, never a redirect.
- **No untrusted input at the surface.** The command takes no path, no ref, and no project identifier; there is nothing to traverse, quote, or interpolate. Project keys are read from a marker the tool itself created, and the key is validated as a single path segment before use.
- **Marker integrity.** Create-once through a synced sibling plus a link means two racing first uses cannot both win and no reader observes a partial marker, mirroring the delivered dispatch-identity discipline. A marker that cannot be created is a state-location failure, never a silent path-derived substitute.
- **Pruning is index-only.** No code path deletes a project state root, so a stale or malicious index cannot cause data loss, and a state read never follows an index-supplied path.
- **Probe safety.** The daemon probe is a bounded connect to a path derived from the state root, with no payload, no authentication attempt, and no write; the unmounted build performs none.
- **Permission preservation.** The migration preserves modes, so moving a `0600` store into a `0700` root does not weaken the least-privilege contract, and the store re-verifies on open.
- **Disclosure surface.** The three error identities name a project key or an index path and never echo record content or credentials.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Ongoing cost**: none. No new configuration key, no background process, no scheduled job, and no new dependency. Index maintenance is bounded and runs inside work the command already does.
- **Operational procedure**: one migration step per host, documented; nothing recurring. Delivering a new checkout requires only that a command runs in it, which is what an operator does anyway.
- **Diagnosability**: the two failure classes an operator will meet (missing identity, unreadable state location) are named identities with a remediation, and the first-run and unmigrated conditions are distinguished from failure.
- **Documentation maintenance**: the system-spec set in §16.1 is the durable record; the planning corpus updates are one-time. The migration note is the only new durable user-facing document and it is the place future migration questions land.
- **Test maintenance**: the new suites own the invariants — single policy, disjoint state, honest projections, migration byte-identity, and no leak into the real user state directory. A future surface that bypasses the policy reds the structural assertion instead of silently splitting state.
- **Coupling to the resident daemon**: if the daemon family is mounted later, only the injected mount capability flips and the probe becomes live; the overview contract does not change.
- **Deferred work that will re-open this area**: per-project owner holds, re-attribution tooling, and a discovery mechanism that does not depend on prior use.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Host root | The delivered state directory resolution: the absolute environment override when set, otherwise the injected home plus the brand state directory name. It holds the host index, the host-wide owner-hold marker, the project container, and the declared unbound scope. |
| Project | One checkout identity, meaning one git common directory: a single clone and all of its linked worktrees. Two clones of one remote are two projects. |
| Project key | The stable, readable identity of one project, minted once and persisted in the checkout identity marker. |
| Project identifier | An opaque, once-minted value that distinguishes two projects that would otherwise share a key, and that survives rename and move. |
| Project state root | `<host root>/projects/<project key>`, holding exactly the delivered store artifacts under workspace `default`. |
| Checkout identity marker | The create-once file inside the git common directory that carries the project key and identifier; shared by a repository's worktrees and travelling with a moved checkout. |
| Host index | The derived, revisioned host-level document naming each registered project's key, identifier, root, and state location. Rebuildable, never authoritative over delivery state. |
| Unbound scope | The declared host-scoped state root used by a state-opening invocation that is not inside a git work tree, with a warning that its state is not repository-scoped. |
| Handover state | The projected authority state of a project: `engine` (engine authoritative), `shell` (dual-run, the safe default), or `in-transition` (folded truth and derived view disagree). |
| Folded handover truth | The latest handover operation derived from the append-only handover records of a project's ledger. |
| Derived authority view | The atomically replaced per-repository authority document that the shell fallback reads as a plain file; absent, unreadable, or malformed resolves to dual-run. |
| Declared degradation | A reported reason for a capability that is absent, instead of an implied absence. |
| Migration | The one-step, reversible move of a populated store into one designated primary project's root, rewriting no file. |
| Corrupt index | A host index that is present but unparsable; distinct from an absent one, which is an ordinary first run. |

## 24. APPENDICES

### Appendix A — State-scope resolution matrix

| Invocation context | Host root | Project identity | State root | Notes |
|---|---|---|---|---|
| Checkout, marker present | Override else home plus brand name | Read from the marker | `<host>/projects/<key>` | The steady state |
| Checkout, marker absent | Same | Minted once, atomically, in the common directory | `<host>/projects/<key>` | First use of a checkout |
| Checkout, marker uncreatable | Same | Not obtainable | None | State-location failure; no path-derived substitute |
| Checkout, git directories unreadable | Same | Not obtainable | None | Identity refusal |
| Linked worktree | Same | The parent clone's marker | The parent clone's root | One project, several checkouts |
| Second clone of one remote | Same | Its own marker | Its own root | Two projects by design |
| Nested directory inside a checkout | Same | The enclosing checkout's marker | The enclosing checkout's root | Nearest enclosing `.git` wins |
| Submodule | Same | The submodule's own common directory | Its own root | A submodule is its own project |
| Moved or renamed checkout | Same | The travelling marker | Unchanged key and root | Only the reported root changes |
| Not inside a git work tree | Same | None | `<host>/unbound` | Declared, warned, never attributed to a project |

### Appendix B — Handover projection matrix

| Folded latest handover operation | Derived authority document | Reported state | Meaning |
|---|---|---|---|
| `authoritative` | `authoritative` | `engine` | Engine truth and the shell fallback agree that the engine is authoritative |
| `dual-run` or none | `dual-run` or absent | `shell` | Shell authoritative; the safe default when there is no authoritative evidence |
| `authoritative` | absent, `dual-run`, or malformed | `in-transition` | A handover was recorded but the shell-visible document has not caught up: both runtimes would claim authority |
| `dual-run` | `authoritative` | `in-transition` | A reversal was recorded but the shell-visible document still says authoritative |
| any | store present but unreadable | none (error) | `projects.state-unavailable` at exit `2`; no state is fabricated |

### Appendix C — Daemon reachability reason vocabulary

| Reason | Condition | Probe performed |
|---|---|---|
| `daemon-not-mounted` | The build composes no resident daemon capability (the shipped condition) | No |
| `state-absent` | The project has no state root yet | No |
| `socket-absent` | The derived socket path does not exist | Yes, path check only |
| `socket-unreachable` | The socket exists and a bounded connect fails | Yes, bounded connect |
| (no reason) | The socket exists and a bounded connect succeeds | Yes, bounded connect |

### Appendix D — Evidence map

| Invariant | Owning criterion | Evidence class |
|---|---|---|
| Same-ref isolation of phase documents and queue entries | AC-F1-1, AC-F1-2 | Suite, revert-sensitive |
| Identity stability across rename, move, worktree, nesting | AC-F1-3, AC-F1-4 | Suite |
| Discovery without a registry | AC-F2-1, AC-F2-2 | Suite |
| Corrupt-versus-absent index, re-derived locations | AC-F2-3, AC-F2-5 | Suite, mutation-sensitive |
| Pruning never touches state | AC-F2-4 | Suite, mutation-sensitive |
| Contract shape, ordering, determinism, exit codes | AC-F3-1, AC-F3-2, AC-F3-3 | Suite |
| No invented handover states | AC-F4-1, AC-F4-2, AC-F4-3 | Suite plus mutation |
| Honest daemon reporting | AC-F5-1, AC-F5-2, AC-F5-3 | Suite |
| One policy across every surface | AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, AC-F6-5 | Suite, structural plus behaviour |
| Owner-hold continuity | AC-F7-1, AC-F8-3 | Suite plus review |
| Migration integrity and legacy detection | AC-F8-1, AC-F8-2 | Suite, revert-sensitive |
| Reachability, help gates, error identities, literal policy | AC-F9-1..AC-F9-4 | Suite |
| Documentation and corpus reconciliation | AC-F10-1, AC-F10-2 | Review-verified |
| Release shape | AC-F10-3 | Suite |

### Appendix E — Scenario seed reconciliation

| Seed | Inherited assertion | Reconciled form in this specification |
|---|---|---|
| SC-M2-S11-01 | Two checkouts of different repositories both using one ref hold disjoint phase state and queue entries; the two checkouts' phase-state and queue files are disjoint and neither `projects list` row references the other ref. | AC-F1-1 and AC-F1-2. The file-disjointness half is kept literally. The second half is restated, because a project row carries no ref by contract: the reconciled evidence is that no read surface in one checkout observes the other's phase completion, queue entry, or lease, which is the property the seed was written to protect. |
| SC-M2-S11-02 | With no hand-written registry, `<binary> projects list --json` returns both projects with repo key, root, state location, daemon reachability, and handover state. | AC-F2-2, with AC-F2-1 supplying the absent-index first run and AC-F3-1 supplying the exact entry shape. "Managed checkout" is reconciled to "a checkout a command has been run in", because discovery is derived from use and no filesystem crawl is performed (DEC-4). |

### Appendix F — Sources consulted

- Ticket GH-288 (goal, scope list, acceptance criteria, non-goals).
- Backlog M2-S11 and the M2 milestone pack: architecture (multi-repository overview flow; persistence and concurrency deltas; boundary invariants), contracts `projects.v1`, the `projects` command page, the entrypoint delta, and the scenario seeds SC-M2-S11-01 and SC-M2-S11-02.
- Delivered source behaviour of: the production composition's state-directory resolution and workspace identity; the MCP serve state identity; the state-directory scope and daemon socket resolution in the configuration catalog; the store layout; the checkout git directory resolution; the checkout-scoped dispatch identity marker; the handover ledger fold and the derived authority document; the owner-hold marker read; the CLI-independent shell authority read; the prompt-required composition and the help inventory; the help-coverage and reference-page parity gates; the error table and its sync gate; the release gate.
- System specs: state layer, CLI entrypoint, branding seam, dispatch engine, result contract, resident daemon, owner-gate SLA.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-11 | spec-writer | Initial specification from ticket GH-288, the M2 milestone pack, and the planning session |

---

## AUTHORING GUIDELINES

- **Inputs**: ticket GH-288, its `clarify_scope` pm-notes, the M2 milestone pack (architecture flow, `projects.v1` contract, command page, entrypoint delta, scenario seeds), and direct verification of the delivered seams rather than re-derivation from the session summary. Every claim in §2.1 was checked against the delivered sources named in Appendix F.
- **Deliberate limits**: the spec states outcomes, contracts, and invariants, not implementation steps. It names modules and symbols only where a boundary or a pinned gate must be identified (the prompt-required set, the coverage and parity gates, the error table, the shell fallback) and otherwise describes components by role.
- **Refinements recorded, not hidden**: three pack statements are refined at delivery and recorded as decisions rather than silently changed — the illustrative in-checkout state path (DEC-1), the boolean-plus-reason field represented as a nested value (DEC-6), and an M2 reference page serving an M2 command through a declared page root (DEC-13).
- **Relationship to the ticket**: the two ticket acceptance criteria are the floor. AC-1 maps to AC-F1-1 and AC-F1-2; AC-2 maps to AC-F2-2 with AC-F2-1 and AC-F3-1 supplying the shape. The migration note, the mount obligations, and the reconciliation are ticket scope (items 3-5) and are covered by F-8, F-9, and F-10.
- **Downstream readiness**: acceptance criteria are Given/When/Then, each names one evidence class, and each references at least one functional, data-model, or non-functional identifier, so the test plan and the delivery plan can trace directly and no criterion needs interpretation.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-288)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 plus guidelines and checklist)
- [x] ID prefixes consistent and unique within category (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, G-, NG-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] Every acceptance criterion names its evidence class (suite, mutation-verified, or review-verified)
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability, a mitigation, and a residual risk
- [x] No implementation details (no code blocks, no step-by-step delivery tasks, no commit instructions)
- [x] No content duplicated from linked docs (the pack is referenced, not restated)
- [x] Front matter validates per the front-matter rules, including `version_impact: minor` (§15 DEC-15)
