---
change:
  ref: GH-404
  type: feat
  status: Proposed
  slug: worktree-lane-foundation
  title: "M4-S36: A work item's whole lifecycle runs in its own worktree (default on) (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "dispatch engine and lane lifecycle (git adapter worktree seam, worktree-scoped lane environment, host-index registration, closeout worktree removal)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - change
    - m4
    - worktree
    - dispatch
    - cli
    - config
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered dispatch engine: the repository lease claimed before the lane spawns, the lane record, and the phase lifecycle from clarify_scope to pr_creation (all unchanged by this change)"
      - "delivered git adapter worktree seams in the house style: listWorktrees, currentWorktreePath, isWorktreeClean, removeWorktree — creating a worktree does not exist yet and is added here as addWorktree"
      - "delivered closeout worktree removal under the strict local worktree safety predicate (GH-240 F-7)"
      - "delivered clone identity: the identity marker in the git common directory, shared by the main checkout and every linked worktree, with the per-clone state root (no path-derived substitute key)"
      - "delivered host index and flat record set: registration keyed by clone identity, maintenance pruning entries whose root no longer matches"
      - "GH-406 landed: the delivery vocabulary (product, repository, main checkout, worktree, lane, work item, clone identity, product key) per ODR-0006, main-tools tip e5ff0512; the new-code naming check with its committed baseline runs in pnpm check"
      - "related changes: GH-412 (parallel lanes build on this foundation), GH-408 (mechanical identifier rename), GH-367 (queues), GH-407 (planning horizon)"
    external:
      - "git: linked-worktree semantics (create, list, remove; the porcelain worktree listing) on supported hosts"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make every work item's whole delivery lifecycle run in its own dedicated worktree by default — dispatch creates it before the first phase, the lane runs there from `clarify_scope` to `pr_creation`, resume reuses it, closeout removes it only after the merge is confirmed — so the main checkout stays on the base branch and clean throughout, on the foundation the future parallel lanes (GH-412) need.

## 1. SUMMARY

This change delivers the owner's worktree foundation (M4-S36, governed by the CEO comment of 2026-11-25): a work item's whole lifecycle, from `clarify_scope` to `pr_creation`, runs in its own linked worktree by default, while the main checkout stays parked on the base branch and untouched. Dispatch creates the worktree before the first phase at a deterministic sibling path, the lane's environment is derived for the worktree (its own dependency binaries lead `PATH`, its gate temporary directory lives inside it), resume reuses the same worktree, registration stays pinned to the main checkout, and closeout sweeps the lane's logs and removes the worktree only after the merge is confirmed. An exception setting restores today's behaviour byte-for-byte for environments that cannot create worktrees; parallel lanes are split to GH-412 and are out of scope.

## 2. CONTEXT

### 2.1 Current State Snapshot

- `dispatch` has no worktree notion: a lane's whole lifecycle runs in the invoking checkout, which today is the main checkout.
- The git adapter already carries the worktree read and removal seams in the house style — `listWorktrees`, `currentWorktreePath`, `isWorktreeClean`, `removeWorktree` (fixed argv, no shell, local only). Creating a worktree does not exist yet.
- Closeout already removes worktrees post-merge under a strict local safety predicate (delivered with GH-240): removal happens only when the predicate says the worktree is safe to remove.
- A linked worktree already resolves the same clone identity as its main checkout: the identity marker lives in the git common directory, and the per-clone state root is derived from it — never a path-derived substitute key. No change is needed there; the behaviour is pinned with a fixture.
- Registration writes the invoking checkout's path into the host index, and host-index maintenance rewrites the entry whenever that root differs. Hazard: a lane running in a worktree would flip the entry's root to the worktree path; when closeout removes the worktree, the next maintenance pass would prune the entry — `repos list` would lose the row and group-member resolution would degrade.
- The linked-worktree enumeration drops the first porcelain block by position, and the branch-checked-out-elsewhere check does the same. Once lanes create worktrees, "worktree" must mean a **linked** worktree only, and that positional reliance becomes load-bearing.
- The delivered vocabulary (GH-406 / ODR-0006) names the concepts this change composes: product, repository, main checkout, worktree, lane, work item, clone identity, product key.

### 2.2 Pain Points / Gaps

- Every lane runs in the operator's main checkout: the owner cannot use it while a lane delivers, and lane artifacts mix with the operator's working tree.
- There is no isolation foundation for parallel lanes — GH-412's per-lane leases and second-lane admission need per-lane worktrees first.
- The registration hazard above means a naive worktree lane would silently corrupt the host index and degrade `repos list` and group-member resolution.
- The positional reliance in the linked-worktree enumeration is an untested correctness hazard that this change makes load-bearing.
- Environments that cannot create worktrees (restricted filesystems, unusual hosts) currently have no way to keep today's behaviour once worktrees become the default.

## 3. PROBLEM STATEMENT

Because `dispatch` has no worktree notion and every phase of a work item's lifecycle runs in the main checkout, the owner cannot keep the main checkout on the base branch and clean while a lane delivers, lane artifacts and gate state mix with the operator's working tree, and the isolation foundation that parallel lanes (GH-412) require does not exist — resulting in an operator-hostile delivery experience and a blocked M4 arc.

## 4. GOALS

- **G-1**: A new `addWorktree` seam in the git adapter, in the house style of the existing worktree seams (`listWorktrees`, `currentWorktreePath`, `isWorktreeClean`, `removeWorktree`): fixed argv, no shell, local only, no force flag; a git refusal is a refusal.
- **G-2**: `dispatch` creates the worktree before the first phase: path `<worktree-root>/<checkout-basename>-<ref>`, a sibling of the main checkout by default, with `worktree-root` a worker setting; created on a new branch at the tip of the base branch; paths resolved from the clone's physical location, never through a symlinked alias.
- **G-3**: The lane runs in the worktree from `clarify_scope` to `pr_creation`; the main checkout stays on the base branch and is never touched by a work item. The lane's environment is derived for the worktree: its `node_modules/.bin` leads `PATH`, its gate temporary directory is created inside it, and the evidence recorded in the pm-notes keeps the literal `$PWD/tmp/tmpdir`. Dependencies are installed before the first phase; whatever the gates need built is built there.
- **G-4**: Resume reuses the lane's worktree: it finds the work item's worktree, verifies it is on the right branch, and continues there; never a second worktree for one work item.
- **G-5**: Registration stays with the main checkout: the host index records the main checkout's path, never the invoking worktree; a worktree removal never prunes a live clone's entry; worktrees appear in `dispatch status`, `lanes` and `board`, never as rows of the flat record set.
- **G-6**: Merge and closeout work for a branch checked out in a worktree: `merge` resolves the change from the worktree or the main checkout; closeout removes the worktree only after the merge is confirmed, sweeping the lane's logs first; a lane that stopped without a merge keeps its worktree until resumed or closed out.
- **G-7**: Visibility: `dispatch status`, `lanes` and `board` show each lane's worktree path.
- **G-8**: An exception setting (the disable-worktrees setting) disables worktrees for an environment that cannot create them; with it set, behaviour is byte-for-byte today's.
- **G-9**: Clone identity is shared: a linked worktree resolves the same clone identity and the same state root as its main checkout (the identity marker lives in the git common directory; no change needed there — pinned with a fixture).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Governing fixtures (ticket AC1–AC5) | 5 of 5 pass |
| Main-checkout cleanliness during a lane | on the base branch and clean at every observed point (fixture, ticket AC1) |
| Second worktrees created per work item | 0 — resume reuses the lane's worktree (fixture, ticket AC2) |
| Clone-identity and state-root equality across a linked worktree | identical to the main checkout (fixture, ticket AC3) |
| Host-index entries lost by a worktree removal | 0 — the live clone's entry survives (fixture, ticket AC4) |
| Worktree path visibility | 3 of 3 surfaces (`dispatch status`, `lanes`, `board`) |
| Output delta with the disable-worktrees setting set | 0 bytes on every pinned output (regression, ticket AC7) |
| Positional reliance in linked-worktree enumeration | 0 — pinned by a test or made position-independent |
| Fresh-worktree provisioning measurement | recorded as delivery evidence: what the gates need (install, build) and how long it takes |

### 4.2 Non-Goals

- **NG-1**: No parallel lanes. Per-lane leases, the per-repository cap, second-lane admission, sync before the pull request, and the "behind" indicator all belong to GH-412.
- **NG-2**: No change to the repository lease: one lane at a time per repository, exactly as today.
- **NG-3**: No change to the dispatch result `pr-open` semantics.
- **NG-4**: No renames. Command names, payload fields and configuration-layer names keep their identifiers until GH-408; new code names the clone identity `cloneKey` and the declared product key `declaredProductKey`, never the bare legacy token, per the naming check landed with GH-406 (its committed baseline runs in `pnpm check`).
- **NG-5**: No change to clone-identity or state-root derivation. The identity marker in the git common directory and the per-clone state root are pinned by a fixture, not altered.
- **NG-6**: No sync-before-PR and no "behind" indicator, and no position on the GH-412 sync-commit choice — both are GH-412 territory.
- **NG-7**: No per-lane spend accounting (GH-378 territory, GH-412) and no planning-horizon change (GH-407).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | `addWorktree` git adapter seam | the missing create operation, in the house style of the existing worktree seams |
| F-2 | Worktree creation before the first phase | dispatch provisions the lane's worktree deterministically, from the clone's physical location |
| F-3 | Worktree-scoped lane environment | the lane's commands, gates and evidence run inside the worktree; the main checkout is never touched |
| F-4 | Resume reuses the lane's worktree | one work item, one worktree — across attempts |
| F-5 | Registration pinned to the main checkout | prevents the host-index root-flip and prune regression |
| F-6 | Merge and closeout on a worktree-checked-out branch | the lifecycle completes in the worktree, with removal strictly after merge confirmation |
| F-7 | Worktree path visibility | `dispatch status`, `lanes` and `board` show each lane's worktree path |
| F-8 | Disable-worktrees exception setting | environments that cannot create worktrees keep today's behaviour byte-for-byte |
| F-9 | Shared clone identity pin | a linked worktree resolves the same clone identity and state root; fixture-pinned, no change |
| F-10 | Linked-only worktree enumeration guard | the positional first-block reliance is pinned by a test or made position-independent |

### 5.1 Capability Details

- **F-1 — `addWorktree` seam.** The git adapter gains a create-worktree seam alongside the existing worktree seams, in the same house style: fixed argv, no shell, local only, no force flag. A git refusal (branch exists, path exists, unsafe parent, anything else) surfaces as a refusal — it is never retried, worked around, or forced. The seam creates a **linked** worktree on a new branch; it is the only new git capability in this change.
- **F-2 — Creation before the first phase.** On dispatch of a work item whose lane has no worktree yet, the worktree is created before the first phase (`clarify_scope`) at `<worktree-root>/<checkout-basename>-<ref>`. `worktree-root` is a worker setting; its default places the worktree as a sibling of the main checkout. The worktree is created on a new branch at the tip of the base branch. All paths involved — the main checkout's location, the worktree root, the new worktree's path — are resolved from the clone's physical location, never through a symlinked alias. The repository lease is claimed before any of this, exactly as today.
- **F-3 — Worktree-scoped lane environment.** From `clarify_scope` through `pr_creation`, the lane's working directory is its worktree. The lane's environment is derived for the worktree: the worktree's dependency binaries lead `PATH`, the gate temporary directory is created inside the worktree, dependencies are installed before the first phase, and whatever the gates need built is built there. The evidence recorded in the pm-notes keeps the literal `$PWD/tmp/tmpdir` — the convention is unchanged; its meaning is anchored to the lane's worktree because that is the lane's working directory. The main checkout stays on the base branch and clean throughout the lane.
- **F-4 — Resume reuse.** When a lane is resumed, the lane's existing worktree is found, verified to be on the lane's branch, and continued in. A second worktree for the same work item is never created. A lane whose worktree is missing or cannot be verified surfaces that as a lane error rather than silently re-provisioning.
- **F-5 — Registration pinned to the main checkout.** Every lane command, whatever checkout it runs in, keeps the host index pointing at the **main checkout**: the entry's root is the main checkout's path, never the invoking worktree's. Host-index maintenance never prunes a live clone's entry because a worktree was removed. Worktrees are never rows of the flat record set — they appear only through the lane surfaces (F-7).
- **F-6 — Merge and closeout in the worktree.** `merge` resolves the change from the worktree or the main checkout, so a branch checked out in a worktree lands normally. Closeout removes the worktree only after the merge is confirmed — never before — and sweeps the lane's logs before removal. A lane that stopped without a merge keeps its worktree until it is resumed and completes, or is closed out.
- **F-7 — Visibility.** `dispatch status`, `lanes` and `board` show each lane's worktree path, so an operator can always answer "where is this lane working?".
- **F-8 — Disable-worktrees exception setting.** A worker-level exception setting disables worktree lanes for an environment that cannot create them. With the setting set, dispatch, resume, `dispatch status`, `lanes`, `board`, `merge` and closeout behave byte-for-byte as they do today: the lane runs in the main checkout, outputs are unchanged, and no worktree is created or referenced.
- **F-9 — Shared clone identity pin.** A linked worktree resolves the same clone identity and the same state root as its main checkout, because the identity marker lives in the git common directory shared by the whole clone. This is current behaviour, not new behaviour: the change pins it with a fixture and alters nothing.
- **F-10 — Linked-only enumeration guard.** The linked-worktree enumeration and the branch-checked-out-elsewhere check currently drop the first porcelain block by position. With lanes creating worktrees, "worktree" must mean a linked worktree only. That reliance is either pinned by a test that proves the positional reading, or made position-independent; the plan chooses one, and the guard is part of this change's quality gates.

## 6. USER & SYSTEM FLOWS

```
Flow 1: first dispatch of a work item (default behaviour)
  Operator dispatches a work item from a clean main checkout
    → the repository lease is claimed (unchanged)
    → a worktree is created before the first phase, as a sibling of the
      main checkout, on a new branch at the tip of the base branch
    → dependencies are installed in the worktree; gate prerequisites built
    → the lane's phases run there, clarify_scope → pr_creation
    → the main checkout remains on the base branch and clean throughout

Flow 2: resume of a stopped lane
  Operator resumes the lane
    → the lane's worktree is found and verified on the lane's branch
    → the lane continues in that worktree; no second worktree is created

Flow 3: merge and closeout
  The lane's pull request is merged
    → merge resolves the change from the worktree or the main checkout
    → closeout sweeps the lane's logs, then removes the worktree —
      only after the merge is confirmed, never before
  A lane that stopped without a merge
    → keeps its worktree until resumed or closed out

Flow 4: registration during the lane
  A lane command runs inside the worktree
    → the host-index entry keeps pointing at the main checkout
    → after closeout removes the worktree, the entry is still there;
      `repos list` keeps its row; group-member resolution is intact

Flow 5: visibility
  Operator runs `dispatch status`, `lanes` or `board`
    → each lane's worktree path is shown

Flow 6: environment without worktree support
  Operator sets the disable-worktrees exception setting
    → the lane runs in the main checkout as today
    → every output is byte-identical to the pre-change behaviour
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `addWorktree` git adapter seam (F-1), in the house style of the existing worktree seams.
- Worktree creation before the first phase: sibling path scheme, `worktree-root` worker setting, new branch at the tip of the base branch, physical-path resolution (F-2).
- The worktree-scoped lane environment: working directory, `PATH` precedence for the worktree's dependency binaries, gate temporary directory inside the worktree, dependency installation and gate builds before the phases, pm-notes evidence keeping the literal `$PWD/tmp/tmpdir` (F-3).
- Resume reuse with branch verification and the never-a-second-worktree rule (F-4).
- Registration pinned to the main checkout; no prune of a live clone's entry; worktrees never rows of the flat record set (F-5).
- Merge resolving from the worktree or the main checkout; closeout log sweep and removal strictly after merge confirmation; stalled lanes keeping their worktrees (F-6).
- Worktree path visibility in `dispatch status`, `lanes` and `board` (F-7).
- The disable-worktrees exception setting with the byte-for-byte guarantee (F-8).
- The shared clone identity fixture pin (F-9).
- The linked-only enumeration guard (F-10).
- The governing fixtures: ticket AC1–AC5 fixtures, the AC7 byte-identical regression, and the fresh-worktree provisioning measurement recorded during delivery.

### 7.2 Out of Scope

- [OUT] Parallel lanes: per-lane leases, the per-repository lane cap, second-lane admission, queue behaviour changes (GH-412).
- [OUT] Sync before the pull request and the "behind" indicator (GH-412), including the GH-412 sync-commit choice.
- [OUT] Per-lane spend accounting (GH-378 territory, delivered under GH-412).
- [OUT] The planning horizon (GH-407).
- [OUT] Any rename of command names, payload fields or configuration-layer names — identifiers keep their names until GH-408.
- [OUT] Any change to the repository lease, the dispatch result `pr-open` semantics, or clone-identity/state-root derivation.
- [OUT] New telemetry beyond the worktree path's appearance in the existing lane surfaces.

### 7.3 Deferred / Maybe-Later

- Tuning the fresh-worktree provisioning (install/build cost) informed by the delivery measurement — informs GH-412 planning.
- Making the linked-worktree enumeration position-independent if the pinned test proves brittle across git versions (F-10 allows either outcome; the alternative stays open).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

Not applicable — no HTTP surface in this change.

### 8.2 Events / Messages

Not applicable — no new event kinds. The existing lane record carries the lane's worktree context (DM-1) so the lane surfaces can render it and resume can find it; the capsule event kinds and the state-layer event log are unchanged.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Lane worktree context | The lane record identifies the lane's worktree path — additive — so resume can find it (F-4) and the lane surfaces can render it (F-7). A lane without worktree context is the disable-worktrees shape (pre-change lanes resume under it per DEC-8). |
| DM-2 | Host-index root pin | The host-index entry's root is the main checkout's path for every lane command, whatever checkout invoked it; a worktree removal never prunes a live clone's entry; worktrees are never rows of the flat record set. |
| DM-3 | `worktree-root` worker setting | Declares the root under which lane worktrees are created; default places each worktree as a sibling of the main checkout, named `<checkout-basename>-<ref>`. |
| DM-4 | Disable-worktrees exception setting | Worker-level exception setting; when set, no worktree is created and all behaviour and output are byte-identical to the pre-change behaviour. |
| DM-5 | Clone-identity sharing pin | The identity marker lives in the git common directory — one per clone, shared by the main checkout and every linked worktree; a linked worktree resolves the same clone identity and the same state root. Unchanged behaviour, pinned by fixture. |

### 8.4 External Integrations

- git: the change relies on git's linked-worktree semantics (create, list, remove; the porcelain worktree listing) on supported hosts. The new create seam issues a fixed argv locally, never shells out, and never forces; a git refusal is surfaced as a refusal. No other vendor or API is touched.

### 8.5 Backward Compatibility

- With the disable-worktrees exception setting set, every output is byte-identical to the pre-change behaviour (regression-pinned, ticket AC7).
- Command names, payload fields and configuration-layer names are unchanged (identifiers keep their names until GH-408); new code names `cloneKey` and `declaredProductKey` per the naming check landed with GH-406.
- The repository lease (one lane at a time, claimed before spawn) and the dispatch result `pr-open` semantics are unchanged.
- Existing configuration keeps loading; the two new worker settings are additive with a default (F-2, DM-3) and an opt-in exception (DM-4).
- Existing closeout behaviour for non-worktree lanes is unchanged; the delivered local worktree safety predicate is reused, not redefined.
- Lanes recorded before this change carry no worktree context — they resume as today, in the invoking checkout, never provisioning a worktree (DEC-8; OQ-2 resolved).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Seam safety: `addWorktree` uses fixed argv with 0 shell invocations, 0 network operations, 0 force paths; every git refusal surfaces as a refusal (0 silent retries, 0 overrides) | unit-proven |
| NFR-2 | Main-checkout cleanliness: during a worktree lane, the main checkout is on the base branch and clean at every observed point of the lifecycle | fixture (ticket AC1) |
| NFR-3 | Single worktree per work item: resume creates 0 second worktrees across any number of attempts | fixture (ticket AC2) |
| NFR-4 | Byte-identical exception mode: with the disable-worktrees setting set, the output delta on every pinned command surface is 0 bytes | regression suite (ticket AC7) |
| NFR-5 | Closeout safety ordering: the lane's logs are swept before removal (0 log loss), and removal happens only after merge confirmation — never before (0 removals of unmerged lanes' worktrees) | fixtures (ticket AC5), delivered safety predicate |
| NFR-6 | Registration fidelity: after any lane command the host-index entry's root equals the main checkout's path (0 root flips), and after worktree removal the live clone's entry is still present (0 prunes) | fixture (ticket AC4) |
| NFR-7 | Path resolution fidelity: worktree paths are resolved from the clone's physical location, 0 resolutions through a symlinked alias | proven in the creation fixture |
| NFR-8 | Enumeration correctness: the linked-only reading of worktree enumeration holds with 0 position-dependent reads — pinned by a test or made position-independent | guard test |
| NFR-9 | Fresh-worktree provisioning measurement: what the gates need (install, build) and how long it takes are recorded as delivery evidence during delivery; this spec imposes no threshold — the measurement informs GH-412 | recorded in pm-notes |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

Not applicable — no new telemetry. The existing lane surfaces gain the worktree path (F-7), which is itself the observability an operator needs; the fresh-worktree provisioning measurement (NFR-9) is recorded as pm-notes evidence, not telemetry; the state-layer event log and capsule events are unchanged.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Lane-environment derivation is wrong for the worktree (`PATH` precedence, gate temporary directory placement), so gates fail or leak state into the main checkout | H | M | The environment is derived for the worktree as a specified contract (F-3); the creation fixture proves phases and gates run in the worktree while the main checkout stays clean (AC-F3-1, NFR-2) | Medium |
| RSK-2 | The host-index root-flip regression: a lane in a worktree flips the entry's root; closeout removes the worktree; maintenance prunes the entry — `repos list` loses the row and group-member resolution degrades | H | M | Registration pinned to the main checkout as a specified contract (F-5, NFR-6); the survival fixture proves the entry outlives the worktree (AC-F5-1) | Low |
| RSK-3 | Worktree removal at the wrong time: removed before the merge is confirmed, or the lane's logs swept away with it | H | L | Removal strictly after merge confirmation and log sweep first as specified contracts (F-6, NFR-5); the delivered safety predicate is reused | Low |
| RSK-4 | The byte-for-byte guarantee under the exception setting drifts as surfaces evolve | M | M | Byte-identical regression suite pinned in the gates (F-8, NFR-4, AC-F8-1); the exception path is a first-class tested mode, not a dead branch | Low |
| RSK-5 | The positional first-block drop in worktree enumeration misreads once linked worktrees exist (main checkout + lane worktrees) | M | M | Linked-only guard: pinned by a test or made position-independent (F-10, NFR-8, AC-F10-1) | Low |
| RSK-6 | Fresh-worktree gate prerequisites (install/build) cost more lane time than expected | M | M | Dependencies installed and gate prerequisites built before the first phase (F-3); the measurement (NFR-9) is recorded during delivery and informs GH-412; no threshold is imposed by this spec | Medium |
| RSK-7 | A symlinked clone alias makes worktree creation or sibling placement resolve to the wrong location | M | L | Paths resolved from the clone's physical location, never a symlinked alias (F-2, NFR-7), proven in the creation fixture | Low |
| RSK-8 | TDR-0077 (if written) is rejected at the pull request | L | L | Reserved as `Proposed` with `decision_date: null`; the owner accepts or rejects at PR review; no other artifact depends on its acceptance | Low |

## 12. ASSUMPTIONS

- Source order: ticket body < CEO governing comment (comment 5 of 5, 2026-11-25). The governing comment directs scope; ticket body sections that conflict with it are superseded.
- The delivered vocabulary (ODR-0006, GH-406) governs this document's prose: product, repository, main checkout, worktree, lane, work item, clone identity, product key. Identifiers keep their names until GH-408.
- git's linked-worktree semantics hold on supported hosts (create, list, remove; the porcelain listing format is stable enough to be pinned by the F-10 guard).
- The delivered closeout worktree safety predicate is reused as-is; this change extends the ordering around it, not the predicate itself.
- The repository lease continues to be claimed before the lane spawns; exactly one lane runs per repository at a time, as today.
- This change itself is delivered in the main checkout; the next lane dispatched after it lands is the first to run in a worktree.
- Environments that cannot create worktrees use the disable-worktrees exception setting rather than receiving degraded behaviour.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered dispatch engine | Lease claimed before spawn, lane records, phase lifecycle `clarify_scope` → `pr_creation` — all reused unchanged |
| Depends on | Delivered git adapter worktree seams | `listWorktrees`, `currentWorktreePath`, `isWorktreeClean`, `removeWorktree`; `addWorktree` joins the family in the same house style |
| Depends on | Delivered closeout worktree removal | Strict local safety predicate (GH-240 F-7) reused; ordering extended around it |
| Depends on | Delivered clone identity / state scope | Identity marker in the git common directory; per-clone state root — pinned, not changed |
| Depends on | Delivered host index and flat record set | Registration keyed by clone identity; maintenance behaviour extended by the root pin |
| Depends on | GH-406 (landed) | Delivery vocabulary per ODR-0006; main-tools tip e5ff0512; the naming check with its committed baseline runs in `pnpm check` |
| Enables | GH-412 | Parallel lanes build directly on this foundation (per-lane leases, second-lane admission, sync-before-PR) |
| Related | GH-367 | Queue lanes — the lane concept this change worktree-scopes |
| Related | GH-407 | Planning horizon — separate change |
| Governs | GH-408 | Identifiers stay as-is until the mechanical rename; this change introduces no renames |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | What do the gates need in a fresh worktree (install, build), and how long does that take? | Ticket directive: to settle during planning, not delivery; the measurement itself is recorded during delivery (NFR-9). The GH-412 sync-commit choice is explicitly out of scope here. | Resolved — in delivery planning: settled as the plan's provisioning phase (an explicit phase strictly before `clarify_scope`: `pnpm install --frozen-lockfile`, the gate build, and the gate temporary directory inside the worktree); the timing measurement is delivery evidence recorded in the pm-notes (NFR-9; test-plan TC-ENV-004 — no timing assertion). TDR-0077 was reserved but is UNUSED — no decision record was authored |
| OQ-2 | How does a lane recorded before this change (no worktree context) resume? | Resume reuses the lane's worktree (F-4); a pre-change lane has none. Proposed default: such a lane resumes under the disable-worktrees shape (main checkout, today's behaviour), so no in-flight lane breaks at upgrade — but the default is not owner-confirmed. | Resolved — PM decision 2026-11-25 (change-scoped, autonomous), Option A: a lane recorded before this change — no worktree context in its lane record — resumes exactly as today, in the invoking/main checkout, under the same shape as the disable-worktrees mode (F-8); it never provisions a worktree and it completes and closes out under today's behaviour. Recorded as DEC-8; owner-visible at PR review |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The governing scope is the CEO comment on GH-404 dated 2026-11-25 (comment 5 of 5); ticket body sections that conflict with it are superseded | Owner-directed scope; the comment carries the nine deliverables and the verbatim acceptance criteria used in this spec | 2026-11-25 |
| DEC-2 | Scope split: this change delivers the worktree foundation only — one lane at a time, the repository lease and the dispatch result `pr-open` unchanged; parallel lanes and their satellites move to GH-412 | Owner's scope split recorded in the pm-notes decisions; the foundation must land before parallel lanes can be specified | 2026-11-25 |
| DEC-3 | Worktree lanes are default-on, with the disable-worktrees exception setting as the escape hatch; with it set, behaviour is byte-for-byte today's | Owner direction (deliverable 8); environments that cannot create worktrees must not degrade | 2026-11-25 |
| DEC-4 | This spec's prose uses the GH-406 vocabulary (product, repository, main checkout, worktree, lane, work item, clone identity, product key); identifiers stay as-is until GH-408; new code names `cloneKey` and `declaredProductKey`, never the bare legacy token | ODR-0006 landed with GH-406; the naming check with its committed baseline runs in `pnpm check` | 2026-11-25 |
| DEC-5 | "Worktree" in this change means a linked worktree only; the positional first-block reliance in enumeration and the branch-elsewhere check is pinned by a test or made position-independent | Owner-verified code fact; the reliance becomes load-bearing once lanes create worktrees | 2026-11-25 |
| DEC-6 | The gate temporary directory lives inside the lane's worktree, and the pm-notes evidence keeps the literal `$PWD/tmp/tmpdir` — the convention is unchanged because the lane's working directory is the worktree | Owner direction (deliverable 3) and the delivery convention recorded in the pm-notes | 2026-11-25 |
| DEC-7 | If this change writes a decision record, it is TDR-0077 (next free id on main-tools), `status: Proposed`, `decision_date: null`; the owner accepts or rejects at PR review | Ticket directive; reservation recorded in the pm-notes | 2026-11-25 |
| DEC-8 | A lane recorded before this change — one whose lane record carries no worktree context — resumes exactly as today, in the invoking/main checkout, under the same shape as the disable-worktrees mode (F-8); it never provisions a worktree, and it completes and closes out under today's behaviour. PM-decided (autonomous) change-scoped decision, owner-visible at PR review; no separate decision record — the TDR-0077 reservation stays tied to OQ-1 only | In-flight lanes must survive the upgrade (least surprise); absence of worktree context is detectable because the lane record gains its context additively (DM-1); the context-less population is transitional; provisioning a worktree retroactively would swap a live lane's environment mid-delivery, and refusing resume would hard-break in-flight deliveries; reversible per lane, no migration | 2026-11-25 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Git adapter | New — `addWorktree` seam in the house style of the existing worktree seams; linked-only enumeration guard (F-10) |
| Dispatch engine | Updated — worktree creation before the first phase; the lane's working directory and derived environment; resume reuse with branch verification |
| Closeout domain | Updated — lane log sweep before removal; removal strictly after merge confirmation (delivered safety predicate reused) |
| Merge command | Updated — resolves the change from the worktree or the main checkout |
| Host index / registration | Updated — entry pinned to the main checkout; live-clone entries never pruned by a worktree removal; worktrees never rows of the flat record set |
| State scope / clone identity | Pinned — fixture proves the shared clone identity and state root; no behavioural change |
| CLI surfaces: `dispatch status`, `lanes`, `board` | Updated — each lane's worktree path shown |
| Configuration layer (worker settings) | New — `worktree-root`; the disable-worktrees exception setting |
| Fixtures and regression suite | New — ticket AC1–AC5 fixtures, the AC7 byte-identical regression, the enumeration guard |
| Feature specs (dispatch engine, closeout, projects, board, config layer, state layer) | Updated — reconciled with the delivered behaviour in phase 7 |
| Decision record TDR-0077 (if written) | New |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the git adapter's seam contract, **when** `addWorktree` is exercised, **then** it creates a linked worktree with fixed argv, no shell, local-only operation and no force path, and a git refusal surfaces as a refusal — never retried, worked around, or forced | F-1, NFR-1 |
| AC-F2-1 | **Given** a clean main checkout, **when** a work item is dispatched, **then** a worktree is created before the first phase at `<worktree-root>/<checkout-basename>-<ref>`, a sibling of the main checkout by default, on a new branch at the tip of the base branch, with all paths resolved from the clone's physical location and never through a symlinked alias (fixture, ticket AC1) | F-2, DM-3, NFR-7 |
| AC-F3-1 | **Given** the lane runs in its worktree from `clarify_scope` to `pr_creation`, **when** its phases and gates run, **then** the worktree's dependency binaries lead `PATH`, the gate temporary directory is created inside the worktree, dependencies are installed before the first phase, whatever the gates need built is built there, the pm-notes evidence keeps the literal `$PWD/tmp/tmpdir`, and the main checkout is on the base branch and clean throughout (fixture, ticket AC1) | F-3, NFR-2 |
| AC-F4-1 | **Given** a lane that stopped and is resumed, **when** resume runs, **then** the lane continues in the same worktree, verified to be on the lane's branch, and no second worktree is created (fixture, ticket AC2) | F-4, NFR-3 |
| AC-F5-1 | **Given** a lane whose commands run from its worktree, **when** the host index is inspected during the lane and again after the worktree is removed, **then** the entry points at the main checkout the whole time and is still present after the removal, and worktrees never appear as rows of the flat record set (fixture, ticket AC4) | F-5, DM-2, NFR-6 |
| AC-F6-1 | **Given** a change whose branch is checked out in its worktree, **when** `merge` runs, **then** the change lands, resolved from the worktree or the main checkout, and closeout sweeps the lane's logs first and removes the worktree only after the merge is confirmed and not before; a lane stopped without a merge keeps its worktree (fixtures, ticket AC5) | F-6, NFR-5 |
| AC-F7-1 | **Given** a lane with a worktree, **when** `dispatch status`, `lanes` or `board` is read, **then** each lane's worktree path is shown (ticket AC6, goal 7) | F-7 |
| AC-F8-1 | **Given** the disable-worktrees exception setting is set, **when** dispatch, resume, `dispatch status`, `lanes`, `board`, `merge` and closeout run, **then** no worktree is created and every output is byte-identical to the pre-change behaviour (regression, ticket AC7) | F-8, NFR-4 |
| AC-F9-1 | **Given** a linked worktree, **when** identity and state root are resolved, **then** they equal the main checkout's clone identity and state root, and the identity marker in the git common directory is unchanged (fixture, ticket AC3) | F-9, DM-5 |
| AC-F10-1 | **Given** the linked-worktree enumeration and the branch-checked-out-elsewhere check, **when** the guard runs, **then** the linked-only reading holds with no positional reliance — pinned by a test or made position-independent | F-10, NFR-8 |
| AC-F3-2 | **Given** a fresh worktree, **when** the lane's gate prerequisites are provisioned, **then** what the gates need (install, build) and how long it takes are measured and recorded as delivery evidence | F-3, NFR-9 |

### Ticket acceptance-criteria traceability

Ticket AC1 → AC-F2-1 + AC-F3-1; AC2 → AC-F4-1; AC3 → AC-F9-1; AC4 → AC-F5-1; AC5 → AC-F6-1; AC6 → AC-F7-1; AC7 → AC-F8-1. AC-F1-1, AC-F10-1 and AC-F3-2 are spec-decomposed criteria required by the governing comment's deliverables 1, the enumeration caveat, and the measurement directive.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full 11-phase lifecycle on one branch (`feat/GH-404/worktree-lane-foundation`); one pull request targeting `main-tools`; commits via the commit primitive per plan phase; gate evidence uses the `TMPDIR=$PWD/tmp/tmpdir` convention.
- Worktree lanes are default-on at merge; the disable-worktrees exception setting is the supported escape hatch. Both modes must be green before the pull request: the governing fixtures prove the default, the regression suite proves the exception.
- This change itself is delivered in the main checkout; the next lane dispatched after it lands is the first to run in a worktree.
- TDR-0077 (if written) ships as `Proposed` with `decision_date: null`; the owner accepts or rejects it at the pull request — acceptance is the change-management act, not a pre-merge step.
- GH-412 follows on this foundation; no coordination beyond the recorded scope split is required.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. Nothing migrates: no persisted field is re-keyed, renamed or rewritten. The lane record gains its worktree context additively (DM-1); existing configuration keeps loading, with the two new worker settings additive (DM-3, DM-4). Lanes recorded before this change carry no worktree context — they resume as today, in the invoking checkout, never provisioning a worktree (DEC-8; OQ-2 resolved), which is not a migration.

## 20. PRIVACY / COMPLIANCE REVIEW

Not applicable. No personal data, credentials or secret material is introduced or handled by this change; worktree paths shown in local command output are local filesystem paths on the operator's own machine.

## 21. SECURITY REVIEW HIGHLIGHTS

- The `addWorktree` seam follows the adapter house style: fixed argv, no shell, local only, no force flag. There is no override path around a git refusal — no injection surface, no forced destructive creation.
- Worktree paths are resolved from the clone's physical location, never through a symlinked alias — no path confusion between the alias an operator typed and the location the lane actually works in.
- Closeout removal stays behind the delivered local safety predicate, ordered after merge confirmation, with the lane's logs swept before removal — no removal of unmerged work, no silent log loss.
- No credential, token or tracker-secret handling changes in this change.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Stalled lanes keep their worktrees until resumed or closed out: sibling directories accumulate by design. `dispatch status`, `lanes` and `board` expose each lane's worktree path, so cleanup expectations are answerable from the tool; the operator-facing wording is reconciled in phase 7.
- The byte-identical regression suite (exception mode) must stay green whenever a pinned command surface changes — the exception path is standing, tested behaviour, not a legacy branch.
- The linked-only enumeration guard must track git's porcelain listing format across git versions.
- The fresh-worktree provisioning measurement (NFR-9) becomes the input to GH-412's lane-cost planning.
- Documentation impacts for phase 7 are recorded in the pm-notes: the dispatch-engine, closeout, projects, board, config-layer and state-layer feature specs.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Product | One or more repositories that together form a single deliverable, planned and delivered as one (ODR-0006). |
| Repository | One git repository belonging to exactly one product (ODR-0006). |
| Main checkout | The clone's primary working tree — the directory that holds `.git`; stays on the base branch, whatever that branch is called. This change guarantees a work item never touches it. |
| Worktree | A **linked** git worktree of a main checkout, created for one work item; the word never includes the main checkout. Temporary — removed by closeout after the merge is confirmed. |
| Lane | One work item's delivery in one repository, resumable across dispatch attempts; an attempt is never a lane. This change gives each lane its own worktree. |
| Work item | A ticket. Durable in the tracker. |
| Clone identity | The identity minted once per clone into the marker in the git common directory, shared by the main checkout and every linked worktree; keys the per-clone state root. Identifiers keep their legacy names until GH-408. |
| Product key | The product's own key (ODR-0006); new code names it `declaredProductKey`. |
| Base branch | The branch the main checkout is parked on while a lane runs; the lane's worktree branch is created at the base branch's tip. |
| `worktree-root` | The worker setting declaring where lane worktrees are created; default: a sibling of the main checkout. |
| Lane environment | The derived environment a lane's commands run in: working directory (its worktree), `PATH` led by the worktree's dependency binaries, and the gate temporary directory inside the worktree. |
| Repository lease | The one-lane-at-a-time claim on a repository, taken before the lane spawns — unchanged by this change. |
| Disable-worktrees exception setting | The worker-level setting that turns worktree lanes off for an environment; with it set, behaviour is byte-for-byte today's. |

## 24. APPENDICES

### Appendix A — The nine deliverables mapped to capabilities

| Governing deliverable | Capability |
|----------------------|------------|
| 1. `addWorktree` seam in the house style | F-1 |
| 2. Worktree creation before the first phase | F-2 |
| 3. Lane runs in the worktree; derived environment | F-3 |
| 4. Resume reuses the worktree | F-4 |
| 5. Registration stays with the main checkout | F-5 |
| 6. Merge and closeout on a worktree branch | F-6 |
| 7. Worktree path visibility | F-7 |
| 8. Exception setting, byte-for-byte | F-8 |
| 9. Shared clone identity, pinned | F-9 |
| (enumeration caveat, owner-verified fact) | F-10 |

### Appendix B — Explicit non-changes (from the governing comment)

- The repository lease: one lane at a time, exactly as today.
- The dispatch result `pr-open` semantics.
- Sync-before-PR and the "behind" indicator — both GH-412.
- Command names, payload fields and configuration-layer names — identifiers stay until GH-408; new code says `cloneKey` and `declaredProductKey`, never the bare legacy token; the naming check with its committed baseline runs in `pnpm check`.

### Appendix C — Sources

- Ticket GH-404 body (owner direction, M4-S36) — superseded where conflicted by the governing comment.
- CEO governing comment on GH-404, 2026-11-25 (comment 5 of 5): the nine deliverables, the verbatim acceptance criteria AC1–AC7, the explicit non-changes, and the planning directives (measurement, TDR-0077 reservation).
- Owner-verified code facts from the ticket comments (verified 2026-11-23/24): the existing git adapter worktree seams and their locations; the registration root write and host-index maintenance hazard; the positional first-block drop in worktree enumeration and the branch-elsewhere check; the clone-identity common-directory marker; the lease claim before spawn; the delivered closeout worktree safety predicate.
- PM clarify-scope context and delivery conventions (pm-notes of this change folder).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-25 | spec-writer agent | Initial specification from the CEO governing comment (comment 5 of 5, 2026-11-25), the owner-verified code facts (verified 2026-11-23/24), and the pm-notes context; ticket AC1–AC7 kept verbatim in meaning and mapped to spec criteria |

---

## AUTHORING GUIDELINES

- Authored from the governing CEO comment (comment 5 of 5, 2026-11-25) as directed by the delegating session; the ticket body is superseded where it conflicts. No requirements were invented beyond the governing comment, the owner-verified code facts, and the pm-notes.
- The ticket's acceptance criteria AC1–AC7 are kept verbatim in meaning (including their fixture/regression annotations) and mapped one-to-one onto spec criteria in §17; the three spec-decomposed criteria (seam contract, enumeration guard, provisioning measurement) come from the governing comment's own deliverables and directives.
- Code identifiers named by the governing comment (`addWorktree`, `listWorktrees`, `currentWorktreePath`, `isWorktreeClean`, `removeWorktree`, `cloneKey`, `declaredProductKey`, `worktree-root`, the porcelain worktree listing, `TMPDIR=$PWD/tmp/tmpdir`, the `$PWD/tmp/tmpdir` evidence literal, `<worktree-root>/<checkout-basename>-<ref>`) are contract identifiers required verbatim by the acceptance criteria, not implementation directives. Affected components are named at package/domain level only; no file paths are given.
- The enumeration caveat and the fresh-worktree provisioning measurement are recorded as spec requirements (F-10, NFR-9) and open planning items (OQ-1) exactly as the governing comment frames them; the TDR-0077 reservation is carried into DEC-7 and OQ-1.
- Pre-change lanes' resume behaviour is not covered by the governing comment; it is surfaced as OQ-2 rather than assumed.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-404)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the tracker milestone title verbatim ("M4: Jaiship-native delivery") and the pm-notes `milestone`
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level file paths, no step-by-step tasks)
- [x] No content duplicated verbatim from linked docs beyond the owner-directed vocabulary and ticket criteria required verbatim
- [x] Front matter validates per front_matter_rules
