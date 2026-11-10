---
change:
  ref: GH-284
  type: docs
  status: Proposed
  version: 1.2
  slug: m2-planning
  title: "Plan M2: engine-first operations, multi-repo workstations, evidence inspection, and telemetry"
  owners: [engineering]
  service: delivery-os-planning
  labels: [change, docs]
  version_impact: none
  audience: internal
  security_impact: none
  risk_level: medium
  dependencies:
    internal: [oss-tooling-backlog, oss-tooling-status, milestone-packs, m1-command-pages, doc-distribution-guard]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Complete the M2 planning surface — seven new stories, two dependency amendments, truthful contract-doc headers, a current status snapshot, and a committed M2 blueprint pack — so delivery agents execute M2 from repository truth instead of a transient tracker ticket, and so every planning page states what M1 actually delivered.

## 1. SUMMARY

This change plans the remainder of M2 in the committed planning corpus. It lands M2-S11 through M2-S17 in the canonical backlog with their goals, tasks, acceptance criteria, and dependencies; amends M2-S4 and M2-S6 so the dependency graph matches the new stories; reconciles M1 command-page status headers with delivered reality (including the verified finding that the daemon lifecycle command is not reachable from the production entrypoint); records the M2 planning state in a new dated status section without rewriting history; and authors the `milestones/m2/` blueprint pack (architecture, contracts, test scenarios, journeys, six command contracts, an entrypoint delta note), registered in the pack index. No product code, product behavior, or tracker ticket is created.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **M1 is delivered.** `doc/planning/oss-tooling/backlog.md` carries 23 `### M1-S*` story entries, `doc/planning/oss-tooling/status.md` records their delivery through the eleven-phase lifecycle to `main-tools`, and `doc/spec/features/` already holds delivered system specifications for the surfaces this planning touches: doctor, state layer, MCP surface, resident daemon, dispatch engine, spend, scheduling engine, provider profiles, session lifecycle economics, audit ledger, and the CLI entrypoint.
- **M2 is partial and outline-level.** The Epic M2 block begins at the `## Epic M2: Ceremonies, measurement, and memory (months 3-6)` heading and currently holds, in this file order, M2-S2, M2-S3, M2-S10, M2-S4, M2-S5, M2-S6, M2-S7, M2-S8, M2-S9; the block notes that M2-S1 was retired into M1 and that the gap is deliberate and story codes stay stable. `## Epic M3` follows the block. Codes are not in numeric file order today, and the reading guide treats story codes, not file position, as the identifier.
- **The M2 planning content exists only in the ticket.** M2-S11 through M2-S17, the two story amendments, and the file-by-file blueprint brief live in GH-284. The backlog is the canonical scope source for the reading guide, tracker ticket creation, and delivery agents; nothing in the repository currently carries these stories.
- **The M1 command pack has 28 command pages**, not the four the ticket names. Fifteen of them carry a claim that contradicts delivered reality:
  - Nine say `M1 planned (<story>)` for a story that delivered: `board.md` (M1-S5), `doctor.md` (M1-S3), `mcp.md` (M1-S7), `state.md` (M1-S2), `merge.md` (M1-S4), `verify-deploy.md` (M1-S4), `watchdog.md` (M1-S1), `blockers.md` (M1-S16), `retro.md` (M1-S8).
  - Two say `M1 milestone planned` after a shipped story: `plan.md` (M1-S13), `commit.md` (M1-S14).
  - Two attribute a delivered extension as merely proposed: `verify-gates.md` (M1-S4 extends the gate set), `closeout.md` (M1-S12 expands the sweep).
  - Two misstate the entrypoint: `daemon.md` says `Status: Current (GH-238 delivered)` and documents `daemon start|stop|status|install|uninstall`, while `entrypoint.md` says `state`, `mcp`, `dispatch`, and the resident daemon are not registered.
- **Observed entrypoint truth (verified this session, `packages/*/dist` built).** Root `--help` lists sixteen families — `status`, `brief`, `queue`, `lanes`, `blockers`, `phase`, `commit`, `lint`, `plan`, `verify`, `merge`, `closeout`, `dispatch`, `spend`, `retro`, `coordinator` — and no `daemon`, `mcp`, or `state`. `daemon --help` fails with `unknown flag "--help"` (exit 1); `daemon status` fails with `unexpected argument "status"` (exit 1). The daemon command definition exists in the CLI composition and is mounted only when the daemon option is enabled; the production entrypoint does not enable it. So `daemon.md` overclaims reachability, and `entrypoint.md` underclaims the composed set (`dispatch` and `coordinator` are registered, `state`/`mcp`/`daemon` are not).
- **The M2 pack does not exist.** `doc/planning/oss-tooling/milestones/` holds `m0/` (architecture only) and `m1/` (architecture, contracts, interactions, journeys, man-page, test-scenarios, and 28 command pages, with no pack README). `milestones/README.md` defines the pack contents table and conventions (bare command names with a `<binary>` invocation prefix, planned-until-exit status semantics, mermaid C4 diagrams with the level named per heading, no private content) and its `## Index` table lists M0 and M1 only.
- **`status.md` predates M1 closure.** Its title reads "M0 stories delivered, milestone exit pending"; its dated sections are the 2026-11-03 M0 amendment, the 20/20 M0 delivery record, the M0 exit-pending section, the decision list, the 2026-11-05 M1 ticket map, the 2026-11-07 scheduling-engine section, and the 2026-11-07 M1-S9 handover amendment. It contains no M2 planning state.
- **Doc-distribution scope.** `scripts/.tests/test-doc-distribution.sh` marker-checks `doc/guides/**` and a fixed standalone list; `doc/planning/**` is outside that set, and no M1 pack document carries an `ados_distribution` marker. The aggregate gate is `pnpm check` (lint, format:check, typecheck, test, boundaries, prompt conformance, help-guide coverage, exports parity). **No mermaid syntax validator exists in this repository:** no workflow step or `scripts/checks/` entry invokes diagram tooling, and the only mechanical mermaid touch is a fenced-block counter in `scripts/.tests/test-inception-doc-consistency.sh`, which covers one guide and not `doc/planning/**`. Diagram validity is therefore proven structurally (NFR-6).

### 2.2 Pain Points / Gaps

- **The canonical scope source is incomplete.** Delivery agents read `backlog.md` as truth; six M2 stories that the ticket already specifies, plus the owner-hard S17, exist nowhere in the repository, so planning survives only as long as the ticket is remembered and reachable.
- **The M2 dependency graph is wrong once those stories exist.** M2-S4 (board) claims a single-screen fleet view while M2-S11 introduces the per-repository project model the board needs; M2-S6 claims metrics and spend while M2-S14 is the story that produces per-agent and per-model facts from the harness stream. Without the amendments, delivery order and dispatch admission admit work whose inputs do not exist yet.
- **Planning pages assert a false present.** Nine command pages tell a reader that a delivered command is planned, four more blur delivered and undelivered work, and the daemon page promises a lifecycle command that fails on invocation. A reader cannot tell which regime — engine or shell, resident or one-shot — is authoritative today.
- **A reader cannot see authority at the entrypoint.** The root entrypoint is the product's self-description; its documented composition and its observed composition disagree, in both directions.
- **`status.md` has no M2 state and no supersession pointers**, so its forward-looking statements ("M1 delivery start", milestone exit pending) read as current.
- **M2 has no blueprint pack.** M1 proved that committed architecture, contracts, scenario seeds, journeys, and command pages let delivery agents execute from repository truth; M2's new surfaces (`projects`, `attempts`, event taxonomy, telemetry attribution, queue lifecycle, provider-aware pausing) would otherwise be invented per ticket, story by story, with contracts drifting between stories.

## 3. PROBLEM STATEMENT

Because the M2 scope exists only in a tracker ticket and the committed planning pages still describe M1's planned state, delivery agents cannot execute M2 from repository truth — they under-read the dependency graph, re-derive contracts and scenarios story by story, and cannot distinguish delivered from planned command surfaces — resulting in rework, contract drift between stories, and planning decisions that are not inspectable to the owner or to review.

## 4. GOALS

- **G-1**: `backlog.md` becomes the complete M2 scope: M2-S11, M2-S12, M2-S13, M2-S14, M2-S15, M2-S16, and M2-S17 land with their ticket-supplied goals, tasks, acceptance criteria, and dependencies, and M2-S4 and M2-S6 gain the amendments that make the graph consistent.
- **G-2**: Every M1 command-page status header states what M1 delivered; pages with remaining planned scope name the M2 or M3 story that owns it.
- **G-3**: The daemon reachability question is resolved in the documents: the page is corrected to the observed truth, the command is not wired, and the registration gap is attributed to the M2 entrypoint delta note rather than to an invented story.
- **G-4**: `status.md` gains a dated M2 planning snapshot — M1 delivered, M2 story set and amendments, early inputs — while no original line of any dated section is removed, reordered, or modified, and superseded forward-looking statements gain explicit pointers.
- **G-5**: `doc/planning/oss-tooling/milestones/m2/` exists as a committed, registered blueprint pack that a delivery agent can execute M2 from: architecture, contracts, scenarios, journeys, six command contracts, and the entrypoint delta note.
- **G-6**: The change is docs-only and guard-clean: no product code, no behavior change, no tracker ticket, and the planning corpus stays public and OSS-safe.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|---|---|
| New M2 story entries in `backlog.md` | 7 (S11, S12, S13, S14, S15, S16, S17) |
| M2 story amendments applied | 2 (S4 dependency, S6 task plus dependency) |
| M1 command pages whose status contradicts a delivered story | 0 of 28 |
| M1 command pages edited outside their status header | 0 |
| New dated `status.md` sections | 1, with pointers on 4 superseded statement groups |
| New files under `milestones/m2/` | 12 (5 pack documents, 1 delta note, 6 command pages) |
| `SC-M2-*` test scenarios | ≥ 32 (≥ 2 per story, S2–S17) |
| Story clauses lost against the ticket | 0 |
| Product files changed outside `doc/planning/oss-tooling/**` (excluding `doc/changes/**`) | 0 |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0 |
| Aggregate `pnpm check` | exit 0 |
| Diagram structure failures (fence inventory: count, keyword, closure, headings, 3+6+1 inventory) | 0 of 5 checks over ≥ 10 blocks |

### 4.2 Non-Goals

- **NG-1**: Delivering any M2 story. This change plans; it does not implement S11–S17, queue lifecycle mutations, telemetry ingestion, or pause/resume behavior.
- **NG-2**: Wiring the daemon lifecycle command into the production entrypoint, or any other product behavior change.
- **NG-3**: Rewriting `doc/spec/**`. The system spec is reconciled by the doc-syncer phase at the end of a change and owns its own truth; this change creates no delivered behavior to reconcile.
- **NG-4**: Creating tracker tickets for M2 stories, or proposing scope splits.
- **NG-5**: Restructuring `roadmap.md`, `backlog-ranking.md`, or `cli-command-registry.md` beyond the references this change needs.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | M2-S11 through M2-S16 land in `backlog.md` | The canonical scope source must carry the stories delivery agents execute, not a ticket |
| F-2 | M2-S17 lands in `backlog.md` with its seven acceptance criteria | The owner-hard requirement is normative story text and must be a first-class backlog unit like its siblings |
| F-3 | M2-S4 and M2-S6 amendments land | The dependency graph must admit the project model and the telemetry pipeline before dependent stories start |
| F-4 | Every other backlog byte is preserved | Reflow or renumbering destroys anchors, review confidence, and the GH-266 preservation lesson |
| F-5 | M1 command-page status headers reconcile with delivered reality | A reader must not be told a delivered command is planned, or a planned command is current |
| F-6 | The entrypoint page states the observed command composition | The product's self-description must match its root listing in both directions |
| F-7 | `status.md` records the M2 planning snapshot without rewriting history | Planning state must be current and auditable, with history intact |
| F-8 | The M2 pack documents land | Delivery agents execute from committed architecture, contracts, scenarios, and journeys |
| F-9 | The six M2 command contracts land | New and extended command surfaces must be inspectable before delivery, like M1's |
| F-10 | The entrypoint delta note lands | The root listing delta, including the daemon registration gap, must be recorded where the blueprint reader looks |
| F-11 | The pack index registers M2 | A pack that is not in the index is not discoverable from the milestone surface |

### 5.1 Capability Details

- **F-1 — Six M2 stories land.** The Epic M2 block gains `### M2-S11 Multi-repository workstations`, `### M2-S12 Evidence inspection and divergence resolution`, `### M2-S13 Public event taxonomy`, `### M2-S14 Harness telemetry v2`, `### M2-S15 Queue lifecycle completion`, and `### M2-S16 Engine-first delivery operations`. Each entry carries `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on:` in the existing story shape, and no `- Ticket:` line (no ticket exists yet; the reading guide says the line appears only for created stories). The dependency lists are exactly the ticket's: S11 on M0-S5 and M1-S17; S12 on M1-S9; S13 on M1-S18; S14 on M1-S11, M1-S15, M1-S19, M1-S22; S15 on M1-S9, M1-S17, M1-S18; S16 on M1-S9, M1-S18, M1-S21, and the owner-hold hook change (#280). Story content is *verbatim in substance*: every normative clause of the ticket's story text is present with its meaning intact, and no clause is added, dropped, weakened, or merged into another story. Only whitespace, line wrapping, and typographic normalisation are permitted. The stories are appended after M2-S9 and before the Epic M3 boundary, in code order S11 through S17, so no existing entry moves.
- **F-2 — The owner-hard S17 lands.** `### M2-S17 Provider-aware peak pausing` lands with the same shape, its goal, its six task clauses (provider profile nomination at admission recorded on lane and attempt records; peak-window rules as data per profile; daemon watches windows and parks in-flight lanes with bounded-grace stop and recorded park reason; automatic resume from preserved session state at window end; zero-spend assertion through telemetry; daemon-absent degradation to iteration-start gating, documented), its seven numbered acceptance criteria, and its dependency list including M2-S14 and the owner-hold semantics (#280). The `- AC:` block is rendered as `- AC:` followed by an indented numbered list of the seven criteria, one per ticket criterion, because a single inline sentence cannot carry seven independently checkable conditions. The M2 test-scenario and contracts coverage for S17 is part of F-8.
- **F-3 — Two amendments land.** In M2-S4, only the `- Depends on:` line changes: `M1-S5, M1-S17` becomes `M1-S5, M1-S17, M2-S11`, because the cross-repository board is delivered through the project model. In M2-S6, the `- Tasks:` block gains the clause that the story consumes M2-S14 telemetry for per-agent and per-model facts, and the `- Depends on:` line gains `M2-S14`. The goal, the existing task clauses, the acceptance criterion, and the `- Ticket:` line (where present) are untouched. No other story is amended.
- **F-4 — Preservation.** The backlog frontmatter block, the `## Reading guide`, the `## Cross-cutting principles` section, the Epic headings, the Epic M2 retirement note, every other story heading, and every other story's body are byte-identical to the base revision. Story codes and heading text are not renumbered, reordered, or reflowed. The retired M2-S1 gap stays a gap with the existing explanatory note. The diff is confined to the seven appended entries and the two amended entries.
- **F-5 — Status headers state delivered reality.** The reconciliation rule is: a status header may not attribute planned status to a story that delivered, may not carry the milestone-level phrase after the milestone's stories delivered, and may not claim a command surface is reachable when the production entrypoint does not compose it. Applied across all 28 pages, this edits the fifteen pages named in Appendix B and no others. Pages with remaining planned scope point at the story that owns it: `board.md` at M2-S4 (full board), `watchdog.md` at M2-S2 (supervision battery), `mcp.md` at M3-S2 (full MCP). `plan.md` and `commit.md` drop the `M1 milestone planned` phrase while keeping their shipped attribution. `verify-gates.md` and `closeout.md` attribute their extension to the delivered story. `daemon.md` states in its header that the daemon engine and control protocol were delivered by M1-S18 while the lifecycle command is not mounted at the production entrypoint, and refers to the M2 entrypoint delta note for registration; its body is preserved as the delivered engine contract, so the header carries the reachability correction rather than the synopsis being rewritten. `entrypoint.md` is covered by F-6. Pack-level labels that follow the planned-until-exit convention (the M1 pack architecture title, the milestone index row) are not status headers and are not edited.
- **F-6 — The entrypoint page matches observation.** `milestones/m1/commands/entrypoint.md`'s DESCRIPTION composes the command set in two adjacent sentences today: the first enumerates fourteen families (omitting `dispatch` and `coordinator`), and the second names `state`, `mcp`, `dispatch`, and the resident daemon as unregistered (wrongly including `dispatch`). Both sentences are wrong, in opposite directions, so the correction is a bounded contiguous region of at most two adjacent sentences replaced in place: the enumeration sentence lists exactly the sixteen observed families (adding `dispatch` and `coordinator`), and the registration sentence names exactly `state`, `mcp`, and the resident daemon (dropping `dispatch`). The two statements remain separate sentences, because the test plan's extraction predicate stops at the first period; merging them is not permitted. The region is the only change: the title, status header, and every following section keep their bytes. The corrected text is evidence-based — it derives from the observed root `--help`, and the observation (invocation, expected output, exit code) is recorded in the M2 delta note so a later reader can re-verify it.
- **F-7 — The status snapshot.** `status.md` gains one new dated section that records: M1 story delivery complete at 23 of 23 through the eleven-phase lifecycle; the M2 planning state entered by this change (S2–S10 carried, S11–S17 added, S1 retired into M1 with the gap deliberate, the two amendments, and no tickets yet created); the early inputs #268 (early M2 chore, scoped in its own issue) and #280 (delivered owner-hold baseline); and the maintenance convention that future M2 story deliveries keep the planning corpus current. The section does not claim M0 or M1 milestone exit, and it repeats that story delivery is not milestone exit. Superseded forward-looking statements gain explicit pointers without being rewritten: the title framing, the "M1 delivery starts now" paragraph under the M0 exit section, the 2026-11-07 scheduling-engine section, and items 1–3 of "Proposed next steps". Retention semantics are stated once in NFR-7: no original line is removed, reordered, or modified; each pointer is a new line or short paragraph inserted after its statement; and the retention oracle, not a whole-section comparison, is the acceptance check.
- **F-8 — The M2 pack documents.** `milestones/m2/` gains `README.md` (index and how to read: the pack's artifact map, status semantics, and the story-to-artifact map), `architecture.md` (C4 Level 1, Level 2, and Level 3 headings for the M2 end state — multi-repository workstations with per-repository state and a host-level index, the daemon event surface, the telemetry pipeline from harness stream through attribution to spend, metrics, and retro, completed queue lifecycle, engine-first operations with the shell fallback — plus the six key flows named in the ticket, the park/resume flow for S17, persistence and concurrency deltas, and boundary invariants at M2 exit), `contracts.md` (shared contract continuity plus `projects.v1`, `attempts.v1`, event taxonomy v1 with its four new topics, event kinds, payload shapes, ordering guarantees and the slow-consumer overflow-to-repoll rule, `telemetry.v1` attribution fields and reconciliation tolerance, queue lifecycle mutations with release/remove reasons, dependency edges and single-flight, and `spend` v2 breakdown fields, plus the S17 additions: the provider profile field on admission, lane, and attempt records, the peak-window rule schema, the park-reason vocabulary with `peak-window` and `owner-hold` and until timestamps, and resume event shapes), `test-scenarios.md` (`SC-M2-*` scenarios mapped to stories S2 through S17, at least two per story, including the seven mandatory scenarios the ticket names and the five S17 scenarios), and `journeys.md` (the four operator journeys the ticket names plus the S17 cost-control journey).
- **F-9 — Six command contracts.** `milestones/m2/commands/` gains `projects.md`, `attempts.md`, `events.md`, `spend.md`, `queue.md`, and `board.md`, each a man-page-style contract with the pack's status header `Proposed (M2)`, synopsis, options, output shape (text digest and machine envelope), exit codes, invocation examples, an error table, and see-also links. Command names are bare with the `<binary>` invocation prefix; no working name is repeated. `attempts` is documented as a subfamily of `dispatch`, and `events` as the subscribe-taxonomy reference, matching the story tasks that introduce them.
- **F-10 — The entrypoint delta note.** `milestones/m2/entrypoint-delta.md` records the root-entry delta: the observed composition at the time of writing (the sixteen families incl. `dispatch` and `coordinator`; `state`, `mcp`, and `daemon` absent), the M2-planned additions implied by the new stories (`projects`, `attempts` under `dispatch`, `events` under the subscribe surface, `spend` v2, `queue` lifecycle verbs, the full `board`), the daemon registration gap with its observed evidence and its owner (product wiring, outside this planning change), and the fact that the M1 `entrypoint.md` page now points here for the gap. It is a delta note, not a restated man page; the M1 `man-page.md` remains the M1 snapshot.
- **F-11 — Index registration.** `milestones/README.md` gains one M2 row in its `## Index` table linking the pack README and each pack artifact, following the existing row shape, with the milestone label marked planned. The M0 and M1 rows keep their bytes.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — A delivery agent plans and starts an M2 story
  Agent reads backlog.md Epic M2
    → finds S11..S17 with goal, tasks, AC, dependencies
    → follows the story code into milestones/m2/README.md
    → reads architecture and contracts for the surface it implements
    → inherits SC-M2-* scenarios as the seed of its test plan
  (no ticket lookup required; the ticket stays the narrative source, not the scope source)

Flow 2 — The owner validates the M2 shape before delivery
  Owner opens milestones/README.md
    → M2 row → m2/README.md → architecture, journeys, commands
    → compares the planned end state against intent
    → requests refinements in the pack, not in a ticket comment

Flow 3 — A reviewer audits planning truth
  Reviewer reads an M1 command page
    → status header names the delivered story and the owning M2/M3 story for the remainder
    → sees no "planned" claim for delivered work, no "Current" claim for an unmounted command
  Reviewer reads entrypoint.md and root --help
    → the two agree

Flow 4 — The M2 planning state is read as history
  Reader opens status.md
    → dated 2026-11-03, 2026-11-05, 2026-11-07 sections unchanged
    → 2026-11-10 section states M1 delivery, M2 planning, early inputs
    → each superseded forward-looking statement points forward
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `doc/planning/oss-tooling/backlog.md`: seven new M2 story entries, two amendments, and the preservation guarantees.
- `doc/planning/oss-tooling/status.md`: one new dated M2 planning section and pointers on superseded forward-looking statements.
- `doc/planning/oss-tooling/milestones/m1/commands/*.md`: status-header reconciliation on the pages whose header contradicts delivered reality, plus the bounded two-sentence DESCRIPTION correction on the entrypoint page (Appendix B).
- `doc/planning/oss-tooling/milestones/m2/`: the new pack — README, architecture, contracts, test-scenarios, journeys, entrypoint delta note, six command contracts.
- `doc/planning/oss-tooling/milestones/README.md`: the M2 index row.
- The change artifacts under `doc/changes/2026-11/2026-11-10--GH-284--m2-planning/`.

### 7.2 Out of Scope

- [OUT] Wiring or registering the `daemon` lifecycle command at the production entrypoint, and any other change to `packages/**`.
- [OUT] Delivering any M2 story, including the surfaces S11–S17 describe.
- [OUT] Changing `tests/**`, `scripts/**`, `.opencode/**`, or `.ai/**`, including adding a check for this change's own invariants.
- [OUT] Rewriting `doc/spec/**`; the doc-syncer phase owns system-spec truth and this change delivers no behavior to reconcile.
- [OUT] Creating tracker tickets for M2-S11 through M2-S17; the PM proposes, the owner decides.
- [OUT] Landing #268 as a backlog story; it is already scoped in its own issue.
- [OUT] Reorganising `roadmap.md`, `backlog-ranking.md`, or `cli-command-registry.md`.
- [OUT] Any hosted, proprietary, fleet, repository, or product name in the new documents.

### 7.3 Deferred / Maybe-Later

- Registering the new M2 command names in `cli-command-registry.md`; the registry stays the naming surface, and the names this pack introduces derive from story tasks. Reconcile at first M2 story delivery.
- Updating the M1 pack labels from "planned" to "snapshot"; that belongs to the milestone exit, not to story delivery.
- Propagating the still-residual M1-S9 calendar phrasing listed in the 2026-11-07 amendment; untouched here by design.
- A mechanical drift check for planning-doc status headers, if review suggests the manual rule is insufficient.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This change delivers no endpoint and documents no endpoint behavior change. The contracts it documents (`projects.v1`, `attempts.v1`, event taxonomy v1, `telemetry.v1`, queue lifecycle mutations, `spend` v2) are planned M2 contracts, not delivered interfaces.

### 8.2 Events / Messages

N/A for this change. The planning pack documents, but does not deliver, the M2 event taxonomy additions (`queue.graph`, `dispatch.attempt`, `phase.state`, `blockers.state`), their payload shapes, ordering guarantees, and the slow-consumer overflow-to-repoll rule.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Backlog story entry | Heading `### Mx-Sn Title`, optional `- Ticket:` line, then `- Goal:`, `- Tasks:`, `- AC:`, `- Depends on:`. `AC` may be one inline criterion or an indented numbered list. Codes are stable identifiers; file position carries no meaning. |
| DM-2 | Command-page status header | The status line under the page title. It must name the delivered story or state planned status, and name the owning M2/M3 story when a planned remainder exists. For the status reconciliations it is the only line that may change; the entrypoint page's composition region is corrected separately under F-6. |
| DM-3 | Milestone pack manifest | The pack's file set plus its row in the pack index: documents under the milestone folder, command contracts under `commands/`, and the milestone index row that links them. |
| DM-4 | Status snapshot section | A dated `##` section in `status.md` that states a point-in-time state, links forward from superseded statements without removing, reordering, or modifying an original line, and never rewrites a dated section. |

### 8.4 External Integrations

- The telemetry contract documents attribution from the opencode v2.x.y step stream; no ingestion is implemented here.
- The two early inputs referenced as dependencies (#268, #280) are tracker issues; the planning documents cite them by number. No tracker write is performed by this change.

### 8.5 Backward Compatibility

- Existing heading anchors, story codes, and cross-document links remain valid; nothing is renumbered or moved.
- The M1 pack remains the M1 snapshot; the M2 pack is additive.
- In `status.md`, no original line is removed, reordered, or modified; the new dated section and the pointers are additive, and a whole-section comparison is not the acceptance check.
- Command status changes are documentary only; no CLI behavior, output shape, or exit code changes.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Docs-only containment | 0 product files changed outside `doc/planning/oss-tooling/**`; 0 files changed under `packages/`, `tests/`, `scripts/`, `.opencode/`, `.ai/`, or `doc/spec/`. `doc/changes/**` artifacts are excluded from the product-file set. |
| NFR-2 | Backlog preservation | Every existing story heading is byte-identical; the two amended entries differ only in the lines F-3 names; every other story's `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on:` lines are byte-identical; the frontmatter block, reading guide, and epic retirement note are byte-identical; 0 story codes renamed. |
| NFR-3 | Command-page containment | For each of the fourteen status reconciliation pages (every edited M1 command page except `entrypoint.md`), 100% of diff hunks lie within the status header region (the lines from the page title through the first section heading), and the remainder of the page is byte-identical. `entrypoint.md` is bounded separately: one contiguous diff hunk confined to a region of at most two adjacent sentences in its DESCRIPTION, with every other byte of the page identical. The predicate is expressible as "one contiguous diff hunk confined to the DESCRIPTION paragraph; at most two adjacent sentences; all other bytes identical". |
| NFR-4 | Doc-distribution guard | `bash scripts/.tests/test-doc-distribution.sh` exits 0; 0 `ados_distribution` markers added to any planning document. |
| NFR-5 | Aggregate gate | `pnpm check` exits 0 on the branch head. |
| NFR-6 | Diagram structure (self-contained check) | No mermaid syntax validator exists in this repository, so diagram validity is proven structurally over `doc/planning/oss-tooling/milestones/m2/**`, without new tooling: (a) at least 10 fenced blocks whose opening fence is tagged `mermaid`; (b) every such block's first body line starts with a diagram-type keyword (`flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`); (c) every opened fence is closed, so fence counts are even per file and each mermaid body ends before the next heading; (d) each diagram sits under a heading naming its subject, with the three C4 diagrams under `C4 Level 1`, `C4 Level 2`, and `C4 Level 3` headings and the six key flows plus the S17 park/resume under their named flow headings; (e) the inventory is 3 C4 levels, 6 key flows, and 1 S17 park/resume. A grep/awk procedure (Appendix E) proves (a)–(e) and exits 0. |
| NFR-7 | Status history retention | Retention semantics, stated once: no original line in `status.md` is removed, reordered, or modified — every line present in the base revision is present in the head revision, in the same order, byte-identical. Additions are permitted only as (i) the one new dated 2026-11-10 section and (ii) one appended pointer per affected statement group (the title framing, the "M1 delivery starts now" paragraph, the 2026-11-07 scheduling-engine section, and items 1–3 of "Proposed next steps"), each a new line or short paragraph of at most 3 lines that names the new section. The acceptance oracle is retention over the whole file (zero removed, reordered, or modified base lines, plus a whitelist of added regions). A whole-section `cmp` is not the acceptance oracle and must not be used. |
| NFR-8 | Story fidelity | 100% of ticket-supplied normative clauses present per story; 0 added acceptance criteria; 0 clause meaning changes. |
| NFR-9 | Public/OSS hygiene | 0 private, fleet, repository, hosted, or proprietary product names in new or changed text; 0 new forbidden-literal violations. |
| NFR-10 | Link integrity and non-duplication | 0 broken relative links introduced; 0 restated acceptance-criteria blocks in pack documents (packs reference story codes instead of copying AC text). |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A for this change. No runtime surface is added or modified, so no metric, log, trace, or alert is emitted. The planning pack documents the M2 telemetry contract, but the change itself produces only documentary evidence: the gate results recorded in the change artifacts and the observed entrypoint outputs recorded in the M2 delta note.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The header reconciliation is broader than the four pages the ticket names, and a broad edit accidentally rewrites delivered contract prose | H | M | The rule is stated once (F-5); edits are confined to the status header (NFR-3, AC-F5-4); the known page set is enumerated in Appendix B; review reads one-line diffs | L: a status line can still be worded ambiguously |
| RSK-2 | Landing seven stories reflows or reorders existing backlog entries, breaking anchors or review confidence | M | M | Append-only placement after M2-S9 (F-1); hunk containment and byte-identity checks (AC-F1-3, AC-F4-1, NFR-2) | L |
| RSK-3 | The corrected entrypoint statement overclaims in the other direction (e.g. implying `mcp` is registered) | M | L | Wording is derived from observed root `--help` and names exactly the absent families (F-6); evidence recorded in the delta note | L |
| RSK-4 | The M2 pack drifts from M1 conventions (mermaid structure, bare command names, no private content) | M | M | Mirror the M1 heading structure; NFR-6 and NFR-9; AC-F9-1/AC-F9-2 | L |
| RSK-5 | M2-S17 is dropped from the blueprint because the ticket's general pack brief says "S2-S16" | H | M | S17 has its own normative section; F-2 and F-8 name its blueprint additions explicitly; AC-F2-*, AC-F8-3, AC-F8-4, AC-F8-5 | L |
| RSK-6 | Pack documents restate or contradict backlog acceptance criteria | M | M | Packs reference story codes; NFR-10; the status snapshot points to the backlog as canonical | L |
| RSK-7 | New command names (`projects`, `attempts`, `events`) are absent from `cli-command-registry.md` | M | L | Names derive from story tasks; registry reconciliation is a declared deferred item; the delta note records the planned additions | M: the registry stays stale until the next planning touch |
| RSK-8 | The status snapshot implies a milestone exit that has not happened | H | L | The snapshot states story delivery only and repeats that story delivery is not milestone exit; M0/M1 exit sections are untouched (AC-F7-1, AC-NFR7-1) | L |
| RSK-9 | Diagram structure or doc guards fail review or CI after local authoring | M | L | Run the structural diagram procedure (Appendix E), the distribution guard, and `pnpm check` before the PR; AC-NFR5-1/AC-NFR6-1 | L |
| RSK-10 | The planning corpus drifts again after the next M2 delivery | M | H | The maintenance convention is restated in the new status section; each M2 delivery updates backlog markers and the snapshot | M: depends on future delivery discipline |

## 12. ASSUMPTIONS

- The ticket body is the normative requirement source for story text, amendments, the pack brief, and the acceptance list.
- "M1 delivered 23/23" means story delivery through the lifecycle; it does not assert milestone exit, pilot completion, or decision acceptance.
- `doc/planning/**` is outside the doc-distribution guard's scan set, and the pack adds no marker; this follows the guard's path set and `AGENTS.md`, which narrows the broader "any doc under `doc/`" phrasing in `.ai/agent/pm-instructions.md`.
- The repository has no mermaid syntax validator and no workflow step or `scripts/checks/` entry for diagrams; diagram validity is therefore established structurally by the Appendix E procedure (NFR-6), not by a gate.
- The M1 pack's planned-until-exit labels remain correct until the milestone exits; only per-command status headers that name delivered stories are reconciled.
- A built workspace exists in the checkout, so `delivery-os` invocations reflect the built composition; the observed outputs recorded in Appendix C were produced from that build.
- The M1 command pack has 28 pages, verified by directory listing; the ticket's count of the drift examples is illustrative, not exhaustive.
- Pack documents are public; production evidence is described by class, never by name.
- Story codes are stable and file position carries no ordering meaning, per the backlog reading guide.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M1 story delivery (23/23) | Every reconciliation target must actually be delivered; verified in the current tree |
| Depends on | Owner-hold hook change (#280) | Referenced as a dependency by M2-S16 and M2-S17; delivered as the baseline |
| Depends on | Doc-distribution guard and structural diagram check | Must pass on the branch head; no mermaid validator exists, so the check is the Appendix E procedure |
| Depends on | Delivered feature specs under `doc/spec/features/` | The external truth that makes "M1 planned" headers wrong |
| Blocks | M2 story ticket creation and delivery (S11–S17) | Tickets are created from backlog entries; the pack seeds each story's test plan |
| Related | #268 (commit-message lint before PR) | Early M2 chore, scoped in its own issue; named in the status snapshot, not landed here |

## 14. OPEN QUESTIONS

None. The one open verification the ticket carried — whether the daemon lifecycle command is wired — was resolved by observation and is recorded as DEC-2 with its evidence in Appendix C. Every other ambiguity resolved to a recorded decision rather than a requirement gap.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None outstanding | — | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | M2-S17 is in scope; the backlog gains S11 through S17 | The Acceptance line says "M2-S11..S16", but the ticket carries a normative M2-S17 section with story text, seven ACs, dependencies, and blueprint additions; the explicit section governs, and the Acceptance line is shorthand for the add-stories set | 2026-11-10 |
| DEC-2 | The daemon question is resolved by correcting the page, not by wiring the command; no new story or tracker ticket is created; the registration gap is attributed to the M2 entrypoint delta note | Observation shows the command definition is mounted only when the daemon option is enabled and the production entrypoint does not enable it, so the page's "Current" claim is false; wiring is product work outside a docs-only planning change, and inventing a story would misstate the backlog | 2026-11-10 |
| DEC-3 | Header reconciliation covers every M1 command page whose status contradicts delivered reality, not the four named pages | Acceptance says headers are reconciled with delivered reality; nine pages say `M1 planned` for delivered stories, two carry `M1 milestone planned`, and two attribute delivered extensions as proposed; a partial fix would leave the same class of false claim in place | 2026-11-10 |
| DEC-4 | Pack-level status labels (the M1 pack title, the M1 index row) are not reconciled; only per-command status headers are | Pack status semantics are planned-until-exit and milestone exit has not been asserted; changing pack labels would conflate story delivery with exit | 2026-11-10 |
| DEC-5 | `status.md` history is not rewritten: one new dated section records M1 delivery and the M2 planning state, and four superseded forward-looking statement groups each gain one inserted pointer (new lines; no original line altered) | Follows the GH-266 precedent: dated sections are historical records, and an inserted pointer resolves the apparent live contradiction without erasing what was said | 2026-11-10 |
| DEC-6 | No `ados_distribution` marker is added to any M2 pack document | `doc/planning/**` is outside the guard's closed scan set and no M1 pack document carries a marker; the `AGENTS.md` required-marker list is the operative rule and narrows the broader pm-instructions phrasing, which the spec resolves in favor of the guard's actual path set | 2026-11-10 |
| DEC-7 | `milestones/README.md` gains an M2 index row | The ticket asks for a new pack with its own README; the pack index is how a pack is discovered, so registration is part of delivering the pack | 2026-11-10 |
| DEC-8 | `entrypoint.md`'s command-composition region is corrected in this change, treating the `dispatch`/`coordinator` drift as delivered-reality reconciliation | The page is a delivered page whose claim is contradicted by the observed root listing in both directions; correcting it is the same class of fix as the status headers, not new scope | 2026-11-10 |
| DEC-9 | The new and amended story entries are appended after M2-S9 and before Epic M3, in code order S11–S17; existing entries do not move | Codes are the identifier and file position carries no meaning, so appending minimises the diff and preserves every anchor | 2026-11-10 |
| DEC-10 | `test-scenarios.md` maps S2 through S17, at least two scenarios per story; the ticket's "S2-S16" phrase is read as pre-S17 shorthand | S17's normative section explicitly adds blueprint test scenarios (park at peak start, provider isolation, resume without loss, zero-spend, daemon-absent degradation); the explicit additions govern | 2026-11-10 |
| DEC-11 | Early inputs are handled as context: #280 appears where the story text makes it a dependency, #268 stays in its own issue and is named in the status snapshot; neither becomes a backlog story here | The ticket presents both as already-filed inputs, and the Acceptance list does not ask for backlog entries; naming them in the snapshot keeps the sequencing context without inventing scope | 2026-11-10 |
| DEC-12 | The entrypoint delta note lives at `milestones/m2/entrypoint-delta.md`, not inside `commands/` or the pack README | The note describes the root entry's delta, not a command contract, and the README is the pack index; a named pack-level note keeps both roles clean | 2026-11-10 |
| DEC-13 | Preservation is enforced mechanically: append-only placement, per-entry hunk containment, byte identity for untouched regions, and status-header-only diffs for reconciled pages | The GH-266 lesson is that a preservation clause needs its own checkable criterion; a prose promise alone does not survive review | 2026-11-10 |
| DEC-14 | M2 command pages use the pack's `Status: Proposed (M2)` header, reading the ticket's uppercase `STATUS: Proposed (M2)` as the status value, not a label-casing change | All 28 M1 command pages carry `Status:`; keeping the label consistent makes the pack mechanically checkable, while the value `Proposed (M2)` carries the ticket's meaning | 2026-11-10 |
| DEC-15 | Mermaid validity is checked structurally, not by a repository gate: this repository has no mermaid syntax validator (no workflow step, no `scripts/checks/` entry, and the only mechanical touch is a fence counter in `scripts/.tests/test-inception-doc-consistency.sh`, which does not cover `doc/planning/**`). NFR-6 and AC-NFR6-1 are a grep/awk-verifiable fence inventory (Appendix E); the diagram content inventory (3 C4 levels, 6 key flows, 1 park/resume) is unchanged | An unexecutable criterion cannot be tested or reviewed; the structural procedure proves the same content requirements without new tooling, and recording the correction explains why the criterion changed | 2026-11-10 |
| DEC-16 | Two mechanism corrections. (a) `entrypoint.md` is bounded as one contiguous hunk over at most two adjacent sentences in DESCRIPTION, with every other byte identical, because both the enumeration sentence and the not-registered sentence are wrong in opposite directions; the two statements stay separate sentences so the extraction predicate that stops at the first period keeps working; merging them is not permitted. (b) `status.md` acceptance is a retention oracle over the whole file — zero removed, reordered, or modified base lines, additions confined to the new dated section and one pointer per affected statement group — and a whole-section `cmp` is explicitly not the oracle and must not be used | A one-sentence bound is unachievable against the page's actual text and would merge two facts the test plan separates; whole-section identity contradicts the appended pointers this same spec requires, so retention plus an addition whitelist is the only self-consistent check | 2026-11-10 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/planning/oss-tooling/backlog.md` | Updated: 7 new stories, 2 amended entries, preservation guarantees |
| `doc/planning/oss-tooling/status.md` | Updated: 1 new dated section, 4 pointer insertions |
| `doc/planning/oss-tooling/milestones/m1/commands/` | Updated: 14 status headers plus the entrypoint DESCRIPTION region |
| `doc/planning/oss-tooling/milestones/m2/` | New: 12 documents |
| `doc/planning/oss-tooling/milestones/README.md` | Updated: M2 index row |
| `doc/spec/features/` | Unchanged (external truth used to justify reconciliation) |
| `packages/**`, `tests/**`, `scripts/**`, `.opencode/**`, `.ai/**` | Unchanged |

## 17. ACCEPTANCE CRITERIA

### 17.1 Functional

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** `backlog.md`, **when** Epic M2 is read, **then** it contains, in order after M2-S9 and before the Epic M3 heading, the headings `### M2-S11 Multi-repository workstations`, `### M2-S12 Evidence inspection and divergence resolution`, `### M2-S13 Public event taxonomy`, `### M2-S14 Harness telemetry v2`, `### M2-S15 Queue lifecycle completion`, and `### M2-S16 Engine-first delivery operations`, each followed by `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on:` lines and by no `- Ticket:` line. | F-1, DM-1 |
| AC-F1-2 | **Given** the six new entries, **when** each is compared against its ticket story section, **then** every normative clause is present with unchanged meaning: S11's per-repository state scoping derived from the checkout identity (git common dir marker) with a host-level index, `projects list` reporting repo key, root, state location, daemon reachability and handover state, the migration note for existing single-store users, and the tests proving two checkouts using the same ref cannot observe each other's documents; S12's `dispatch attempts [--ref] [--limit]` read side carrying token, corroboration triple, divergence refs, timestamps and harness, the `dual-run resolve` flow including resolution from local evidence with the mode declared, the machine envelope, unresolved counts, and coverage/floor reporting as exposed by the summary; S13's extension beyond status/lanes to `queue.graph`, `dispatch.attempt`, `phase.state` and `blockers.state`, the documented event kinds, payloads, ordering guarantees and slow-consumer overflow-to-repoll rule as a public versioned contract, and contract tests per topic; S14's per-step cost and token ingestion from the opencode v2.x.y step frames attributed through session economics and command-audit identity (M1-S15, M1-S22), phase-transition, stall and restart timing, schema-versioned local event storage, spend breakdowns per ticket/repository/lane/agent/model plus timing summaries, exposure to the retro evidence pass and the morning brief, and the declared reconciliation tolerance with telemetry absence remaining a classified outcome; S15's release/removal with reasons, automatic release on merge and closeout, dependency edge add/remove, single-flight per ref enforced across dispatch paths on the dual-run evidence, and stale-entry reconciliation against tracker truth; S16's engine-first regular delivery, provider windows and holds as engine-visible data built on the pre-iteration hold hook and lane economics, periodic per-repository handover-gate evaluation over accrued evidence with the shell path kept usable and documented, deprecation pointers from shell entry points, and a per-repository reversible flip. Zero clauses are missing, added, or merged across stories. | F-1, NFR-8 |
| AC-F1-3 | **Given** the `backlog.md` diff against the base revision with zero-context hunks, **when** the hunks are inspected, **then** every hunk lies inside one of the seven new entries or the two amended entries, with nothing quoted from a neighbouring entry. | F-1, F-4, NFR-2 |
| AC-F2-1 | **Given** `backlog.md`, **when** `### M2-S17 Provider-aware peak pausing` is read, **then** it carries its goal, its six task clauses, an `- AC:` block with seven numbered criteria matching the ticket one-for-one, and a `- Depends on:` line containing `M1-S15`, `M1-S18`, `M1-S21`, `M1-S22`, `M2-S14`, and the owner-hold semantics `(#280)`. | F-2, DM-1 |
| AC-F2-2 | **Given** the S17 entry, **when** its task clauses are compared with the ticket, **then** provider-profile nomination at dispatch admission recorded on the lane and attempt records (building on M1-S21 profiles and M1-S22 identity), peak-window rules as data per profile including windows, multipliers and buffers, the daemon's watch-and-park behavior with bounded-grace stop, preserved session state and a recorded park reason, automatic resume from preserved session state on the same branch through the session resume path without re-dispatch, the zero-spend assertion through telemetry that no model calls bill on a parked profile during its window, and daemon-absent degradation to the existing iteration-start gating (documented) are all present, and none is softened to "may" or moved to another story. | F-2, NFR-8 |
| AC-F2-3 | **Given** the S17 entry, **when** its acceptance block is inspected, **then** each of the seven criteria remains independently identifiable (numbered list under `- AC:`), so a test plan can map one criterion to one check. | F-2, NFR-8 |
| AC-F3-1 | **Given** the M2-S4 entry, **when** it is compared byte for byte with the base revision, **then** only its `- Depends on:` line differs, reading `- Depends on: M1-S5, M1-S17, M2-S11`, and its heading, goal, tasks, and acceptance criterion are byte-identical. | F-3, NFR-2 |
| AC-F3-2 | **Given** the M2-S6 entry, **when** it is compared byte for byte with the base revision, **then** its `- Tasks:` block gains the M2-S14 telemetry-consumption clause and its `- Depends on:` line gains `M2-S14`, and its heading, goal, existing task clauses, and acceptance criterion are byte-identical. | F-3, NFR-2 |
| AC-F4-1 | **Given** `backlog.md`, **when** every story heading present in the base revision and every non-amended entry are compared byte for byte, **then** every such heading text, every story code, the Epic M2 retirement note, and every other entry are identical, and no existing story has moved relative to its neighbours. | F-4, NFR-2 |
| AC-F4-2 | **Given** `backlog.md`, **when** its head is compared with the base revision, **then** the frontmatter block, the `## Reading guide`, and the `## Cross-cutting principles` section are byte-identical. | F-4, NFR-2 |
| AC-F5-1 | **Given** the 28 M1 command pages, **when** all status headers are searched, **then** zero contain `M1 planned` or `M1 milestone planned` for a story that delivered, and each of the fourteen status reconciliation pages in Appendix B names the delivered story, with its GH reference where one exists, in its header; `entrypoint.md` satisfies AC-F6-1. | F-5, DM-2 |
| AC-F5-2 | **Given** the reconciled pages with remaining planned scope, **when** `board.md`, `watchdog.md`, and `mcp.md` are read, **then** each names its owning future story (M2-S4, M2-S2, M3-S2 respectively) alongside the delivered attribution. | F-5, DEC-3 |
| AC-F5-3 | **Given** `daemon.md`, **when** its status header is read, **then** it states that the daemon engine and control protocol were delivered by M1-S18 (GH-238), that the lifecycle command is not mounted at the production entrypoint, and that registration is tracked in the M2 entrypoint delta note; the header no longer claims `Current` reachability, and the page body is byte-identical so the delivered engine contract (protocol, persistence, degradation) survives as written. | F-5, F-10, DEC-2 |
| AC-F5-4 | **Given** each of the fourteen status reconciliation pages, **when** its diff against the base revision is inspected, **then** every hunk lies within the status header region and the rest of the page is byte-identical; and **given** `entrypoint.md`, **then** its diff is one contiguous hunk confined to the DESCRIPTION paragraph, covering at most two adjacent sentences, and every other byte of the page is identical. | F-5, NFR-3, DEC-13, DEC-16 |
| AC-F6-1 | **Given** `milestones/m1/commands/entrypoint.md`, **when** the DESCRIPTION is read, **then** the corrected region lists exactly the sixteen families observed in root `--help` (including `dispatch` and `coordinator`) and names exactly `state`, `mcp`, and the resident daemon as not registered; the enumeration and the not-registered statement remain separate sentences; and the diff is one contiguous hunk inside that region with every other byte of the page identical. | F-6, NFR-3, DEC-8, DEC-16 |
| AC-F7-1 | **Given** `status.md`, **when** the new dated section is read, **then** it states M1 story delivery at 23 of 23, the M2 planning state (S2–S10 carried, S11–S17 added, S1 retired with the gap deliberate, the two amendments, no tickets created yet), the early inputs #268 and #280, and the maintenance convention for future M2 deliveries; and it neither claims M0 or M1 milestone exit nor contradicts the exit criteria stated in the historical sections. | F-7, DEC-5, RSK-8 |
| AC-F7-2 | **Given** the four superseded forward-looking statement groups (the title framing, the "M1 delivery starts now" paragraph, the 2026-11-07 scheduling-engine section, and items 1–3 of "Proposed next steps"), **when** each is read, **then** each carries exactly one appended pointer — a new line or short paragraph of at most 3 lines naming the new dated 2026-11-10 section — inserted after the affected statement, with no original line removed, reordered, or modified. | F-7, NFR-7, DEC-5, DEC-16 |
| AC-F7-3 | **Given** `status.md` compared with the base revision, **when** a line-retention comparison runs over the whole file, **then** every line present in the base revision is present in the head revision, in the same order, byte-identical — zero removed, reordered, or modified lines — and every added line lies inside the new dated 2026-11-10 section or inside one of the four permitted pointer insertions. A whole-section `cmp` is not used as the acceptance oracle. | F-7, NFR-7, DEC-16 |
| AC-F8-1 | **Given** `milestones/m2/`, **when** its file set is listed, **then** it contains exactly `README.md`, `architecture.md`, `contracts.md`, `test-scenarios.md`, `journeys.md`, `entrypoint-delta.md`, and `commands/{projects,attempts,events,spend,queue,board}.md`, and the README lists every one with a one-line purpose and the story-to-artifact map. | F-8, F-10, DM-3 |
| AC-F8-2 | **Given** `milestones/m2/architecture.md`, **when** its headings are read, **then** it names C4 Level 1, Level 2, and Level 3 headings for the M2 end state; contains the six ticket-named flows (multi-repo overview; attempt-history inspection and divergence resolution; telemetry attribution; queue auto-release after merge and closeout; single-flight refusal across dispatch paths; handover-gate evaluation) plus the S17 park/resume flow; covers persistence and concurrency deltas; and ends with boundary invariants at M2 exit. | F-8 |
| AC-F8-3 | **Given** `milestones/m2/contracts.md`, **when** its surfaces are listed, **then** it covers `projects.v1`, `attempts.v1`, event taxonomy v1 (topics `queue.graph`, `dispatch.attempt`, `phase.state`, `blockers.state`; event kinds; payload shapes; ordering guarantees; overflow-to-repoll rule), `telemetry.v1` (ticket, repository, lane, agent role, model, phase timing; reconciliation tolerance), queue lifecycle mutations (release/remove reasons, dependency edges, single-flight), `spend` v2 breakdowns, and the S17 additions (provider profile field on admission/lane/attempt, peak-window rule schema, park-reason vocabulary with `peak-window` and `owner-hold` plus until timestamps, resume event shapes). | F-8, DEC-10 |
| AC-F8-4 | **Given** `milestones/m2/test-scenarios.md`, **when** the scenario set is counted and inspected, **then** at least two `SC-M2-*` scenarios exist for each of S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, and S17 (32 or more total), including the seven mandatory scenarios (same-ref two-repo collision safety, divergence resolution in local-evidence mode, subscribe topic contract compliance, telemetry reconciliation within tolerance, auto-release after closeout, single-flight refusal naming the holder, handover evaluation reporting per condition) and the five S17 scenarios (park at peak start per profile, other-provider isolation, resume at window end without state loss, zero-spend assertion, daemon-absent degradation). | F-8, DEC-10 |
| AC-F8-5 | **Given** `milestones/m2/journeys.md`, **when** its journeys are listed, **then** it contains the one-host multi-repo morning overview, inspecting evidence before a handover decision, a retro grounded in telemetry, steering a running delivery, and the S17 cost-control journey in which a profile's peak parks one lane while another provider's lane finishes and both remain visible with automatic resume. | F-8 |
| AC-F9-1 | **Given** the six M2 command pages, **when** each header is read, **then** it carries `Status: Proposed (M2)`, a bare command name with the `<binary>` invocation prefix, and no working name. | F-9, DEC-14 |
| AC-F9-2 | **Given** each M2 command page, **when** its body is read, **then** it contains synopsis, options, output shape including the machine envelope, exit codes, at least one invocation example, an error table, and see-also links; and `attempts` is presented as a `dispatch` subfamily while `events` is presented as the subscribe-taxonomy reference. | F-9 |
| AC-F10-1 | **Given** `milestones/m2/entrypoint-delta.md`, **when** it is read, **then** it records the observed root composition (the sixteen families incl. `dispatch` and `coordinator`; `state`, `mcp`, `daemon` absent), the M2-planned additions, the daemon registration gap with the observed invocations and exit codes, the statement that wiring is product work outside this change, and the pointer from the M1 `entrypoint.md` page. | F-10, DEC-2, DEC-12 |
| AC-F11-1 | **Given** `milestones/README.md`, **when** the `## Index` table is read, **then** it contains one M2 row linking `m2/README.md` and each pack artifact, marked planned, and the M0 and M1 rows are byte-identical to the base revision. | F-11, DM-3 |

### 17.2 Non-Functional

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR1-1 | **Given** the branch diff filtered to product files (all paths except `doc/changes/**`), **when** the changed-path list is inspected, **then** every path is under `doc/planning/oss-tooling/` and zero files changed under `packages/`, `tests/`, `scripts/`, `.opencode/`, `.ai/`, or `doc/spec/`. | NFR-1 |
| AC-NFR2-1 | **Given** the `backlog.md` diff, **when** the preservation set is checked, **then** all headings except the seven new entries and two amended entries are byte-identical, all their body lines are byte-identical, and the frontmatter, reading guide, and epic retirement note are byte-identical. | NFR-2, F-4 |
| AC-NFR3-1 | **Given** each of the fourteen status reconciliation pages, **when** its diff is inspected with zero context, **then** every hunk lies in the header region and the body is byte-identical; and **given** `entrypoint.md`, **then** one contiguous hunk covers at most two adjacent sentences in DESCRIPTION and every other byte is identical. | NFR-3, F-5 |
| AC-NFR4-1 | **Given** the branch head, **when** `bash scripts/.tests/test-doc-distribution.sh` runs, **then** it exits 0 and no planning document carries an `ados_distribution` marker. | NFR-4, DEC-6 |
| AC-NFR5-1 | **Given** the branch head, **when** `pnpm check` runs, **then** it exits 0. | NFR-5 |
| AC-NFR6-1 | **Given** the M2 pack documents, **when** the structural diagram procedure in Appendix E runs over them (count the fenced blocks whose opening fence is tagged `mermaid` and inspect each body), **then** (a) the count is at least 10; (b) every block's first body line begins with `flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, or `stateDiagram-v2`; (c) fences are balanced per file, so every mermaid block closes before the next heading; (d) the three C4 diagrams sit under headings containing `C4 Level 1`, `C4 Level 2`, and `C4 Level 3`, and the six key flows plus the S17 park/resume sit under headings naming those flows; and (e) the inventory is 3 C4 levels, 6 key flows, and 1 park/resume; the procedure exits 0 and reports zero failures. | NFR-6, RSK-9 |
| AC-NFR7-1 | **Given** `status.md`, **when** the retention oracle runs over the whole file, **then** zero base lines are removed, reordered, or modified; every added line lies inside the new dated section or one of the four permitted pointer insertions; and no whole-section `cmp` is asserted. | NFR-7, F-7 |
| AC-NFR8-1 | **Given** the seven new story entries, **when** each is diffed clause by clause against its ticket section, **then** the missing-clause count, the added-criterion count, and the changed-meaning count are each zero. | NFR-8, F-1, F-2 |
| AC-NFR9-1 | **Given** all new and changed text, **when** the forbidden-literal and private-name checks run, **then** zero new violations are attributable to the change and no hosted, proprietary, fleet, repository, or product name appears. | NFR-9, RSK-4 |
| AC-NFR10-1 | **Given** the pack documents, **when** links and content are inspected, **then** zero relative links are broken and zero pack documents restate a story's acceptance-criteria block instead of referencing the story code. | NFR-10, RSK-6 |

### 17.3 Definition of Done

- [ ] `backlog.md` carries M2-S11 through M2-S17 with full clause fidelity, appended after M2-S9, and the M2-S4 and M2-S6 amendments applied; all other bytes preserved (AC-F1-*, AC-F2-*, AC-F3-*, AC-F4-*, AC-NFR2-1).
- [ ] All 28 M1 command pages audited; the fourteen status reconciliation pages in Appendix B reconciled in their status header only (including `daemon.md`, whose body is preserved), with remainders pointed at M2-S4, M2-S2, or M3-S2; the entrypoint page's bounded DESCRIPTION region (at most two adjacent sentences) matched to observed root help with every other byte identical (AC-F5-*, AC-F6-1, AC-NFR3-1).
- [ ] `status.md` carries one new dated M2 section and four appended pointer insertions under the retention oracle — zero removed, reordered, or modified base lines, additions confined to the whitelist — with no whole-section `cmp` asserted (AC-F7-*, AC-NFR7-1).
- [ ] `milestones/m2/` exists with the twelve documents, complete architecture levels and flows, contract surfaces, at least 32 scenarios, five journeys, six command contracts, and the delta note (AC-F8-*, AC-F9-*, AC-F10-1).
- [ ] `milestones/README.md` indexes M2 without touching M0 or M1 rows (AC-F11-1).
- [ ] `bash scripts/.tests/test-doc-distribution.sh` and `pnpm check` exit 0; the structural diagram procedure (Appendix E) passes with zero failures; zero product files outside planning (AC-NFR1-1, AC-NFR4-1, AC-NFR5-1, AC-NFR6-1).
- [ ] No tracker ticket was created, no M2 story was delivered, and no product behavior changed (DEC-1, NG-1, NG-2, NG-4).
- [ ] Story codes, headings, and existing story text outside the amended entries are byte-identical, with the check recorded in the delivery evidence (DEC-13, NFR-2).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

One docs-only pull request against `main-tools`. Recommended commit order: (1) backlog stories and amendments, (2) contract-doc status reconciliation, (3) status snapshot, (4) M2 pack and index row. The order keeps each commit reviewable on its own and lets the pack reference story codes that already exist in the backlog. No feature flag, no migration, no coordination window; the documents are read by maintainers and delivery agents, and the only adoption step is that M2 tickets are created from the new backlog entries.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No stored user data, schema, index, or seed set changes. The only "migration" is editorial: existing planning documents gain corrected headers and one new section, and readers' existing links stay valid.

## 20. PRIVACY / COMPLIANCE REVIEW

None. The change touches public planning documents and adds no personal data, no telemetry, and no tracking. The story text's credential handling remains the existing rule (credential-missing names the variable, never its value). No private fleet, repository, or product name is introduced.

## 21. SECURITY REVIEW HIGHLIGHTS

No security impact: the change adds no runtime surface, no permission, no credential path, and no executable content. The only security-adjacent content is the story text that restates existing credential and privacy constraints; it introduces no new rule. The docs must not publish secrets, hostnames, or internal URLs, which NFR-9 covers.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The planning corpus is now the maintenance surface for M2: each M2 story delivery updates its backlog entry (progress markers) and, at meaningful boundaries, the status snapshot, per the convention restated in the new status section.
- The new command pages and contracts are proposals until their stories deliver; the pack README states the planned-until-exit semantics so a reader does not mistake them for shipped behavior.
- The entrypoint delta note is a point-in-time record; when the daemon is wired or M2 commands register, the note and the M1 entrypoint page are updated together.
- The header reconciliation is manual; if drift recurs, a mechanical check can be added later (deferred item).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Milestone pack | A per-milestone set of committed planning documents (architecture, journeys, contracts, scenarios, command pages) describing the intended end state. |
| Story entry | One backlog unit: heading, optional ticket line, goal, tasks, acceptance criteria, dependencies. Identified by a stable `Mx-Sn` code. |
| Status header | The line under a command page's title stating whether the command is delivered, planned, or partly delivered, and which story owns the remainder. |
| Planned-until-exit | Pack convention: everything in a milestone pack is a proposal until the milestone exits, after which the pack is a snapshot. |
| Deliverable-reality reconciliation | Correcting a planning document so its claim matches what the delivered system and its specs actually provide. |
| Entrypoint composition | The set of command families the production CLI entrypoint mounts and lists in root help. |
| Entrypoint delta note | The M2 pack document recording the difference between the observed root listing and the M1 entrypoint page, plus the M2-planned additions. |
| Owner-hard requirement | A requirement the owner has mandated independently of delivery convenience; M2-S17 is one. |
| Docs-only change | A change whose product files are documentation only, with no behavior, test, or tooling change. |

## 24. APPENDICES

### Appendix A — Ticket-to-spec clause map

| Ticket section | Spec requirement |
|---|---|
| Context (four "so that" outcomes) | G-1 through G-6, §2.2 |
| Add stories: M2-S11 … M2-S16 | F-1 |
| Amend existing stories: M2-S4, M2-S6 | F-3 |
| Reconcile contract doc statuses | F-5, F-6 |
| Early inputs already filed (#268, #280) | DEC-11, F-7 |
| Acceptance list | §4.1, §17.3 |
| Milestone blueprint (milestones/m2/) | F-8, F-9, F-10 |
| M2-S17 story text | F-2 |
| M2-S17 blueprint additions | F-8 (architecture, contracts, scenarios, journeys) |
| Planning-docs maintenance | F-7, §22 |

### Appendix B — M1 command-page reconciliation set

| Page | Current claim | Delivered truth | Required correction |
|---|---|---|---|
| `board.md` | `M1 planned (M1-S5)` | M1-S5 delivered (GH-229), owner-gate SLA mechanics | Delivered M1-S5; full board planned M2-S4 |
| `doctor.md` | `M1 planned (M1-S3)` | M1-S3 delivered (GH-224) | Delivered M1-S3; no planned remainder |
| `mcp.md` | `M1 planned (M1-S7)` | M1-S7 delivered (GH-231), minimal MCP | Delivered M1-S7; full MCP planned M3-S2 |
| `state.md` | `M1 planned (M1-S2)` | M1-S2 delivered (GH-222) | Delivered M1-S2 |
| `merge.md` | `M1 planned (M1-S4)` | M1-S4 delivered (GH-225) | Delivered M1-S4 |
| `verify-deploy.md` | `M1 planned (M1-S4)` | M1-S4 delivered (GH-225) | Delivered M1-S4 |
| `watchdog.md` | `M1 planned (M1-S1)` | M1-S1 delivered (GH-221) | Delivered M1-S1; supervision battery planned M2-S2 |
| `blockers.md` | `M1 planned (M1-S16)` | M1-S16 delivered (GH-230) | Delivered M1-S16 |
| `retro.md` | `M1 planned (M1-S8)` | M1-S8 delivered (GH-232) | Delivered M1-S8 |
| `commit.md` | `M1-S14 shipped (GH-227); M1 milestone planned` | M1-S14 delivered (GH-227) | Delivered M1-S14; milestone-planned phrase removed |
| `plan.md` | `M1-S13 shipped (GH-226); M1 milestone planned` | M1-S13 delivered (GH-226) | Delivered M1-S13; milestone-planned phrase removed |
| `verify-gates.md` | `M0 shipped (M0-S9); M1-S4 extends …` | M1-S4 delivered (GH-225) | Delivered M0-S9 plus delivered M1-S4 extension |
| `closeout.md` | `M0 shipped (M0-S14); M1-S12 expands …` | M1-S12 delivered (GH-240) | Delivered M0-S14 plus delivered M1-S12 expansion |
| `daemon.md` | `Current (GH-238 delivered)` | Engine and control protocol delivered by M1-S18; lifecycle command not mounted at the production entrypoint | Header only: engine delivered; command not registered; see the M2 entrypoint delta note |
| `entrypoint.md` | `delivered (GH-242)`; first DESCRIPTION sentence omits `dispatch`/`coordinator`, second wrongly lists `dispatch` as unregistered | `dispatch` and `coordinator` registered; `state`, `mcp`, `daemon` absent | DESCRIPTION region of at most two adjacent sentences: exact observed composition; `state`, `mcp`, and resident daemon named as not registered; every other byte identical |

The other thirteen pages already state delivered or shipped status consistently and are not edited.

### Appendix C — Observed entrypoint evidence

```
$ delivery-os --help
  Commands: status brief queue lanes blockers phase commit lint plan
            verify merge closeout dispatch spend retro coordinator
  (no daemon, no mcp, no state)

$ delivery-os daemon --help
  delivery-os: unknown flag "--help"
  exit 1

$ delivery-os daemon status
  delivery-os: unexpected argument "status"
  exit 1
```

Composition fact: the daemon command definition exists in the CLI composition and is mounted only when the daemon option is enabled; the production entrypoint does not enable it. The page says `Current`; observation says unreachable.

### Appendix D — M2 pack manifest

| Path | Purpose |
|---|---|
| `milestones/m2/README.md` | Pack index, how to read, status semantics, story-to-artifact map |
| `milestones/m2/architecture.md` | C4 L1/L2/L3 for the M2 end state, six key flows, S17 park/resume, persistence and concurrency deltas, boundary invariants |
| `milestones/m2/contracts.md` | Shared contracts plus `projects.v1`, `attempts.v1`, event taxonomy v1, `telemetry.v1`, queue lifecycle mutations, `spend` v2, S17 additions |
| `milestones/m2/test-scenarios.md` | `SC-M2-*` scenarios for S2–S17, at least two per story |
| `milestones/m2/journeys.md` | Four operator journeys plus the S17 cost-control journey |
| `milestones/m2/entrypoint-delta.md` | Root listing delta, M2 additions, daemon registration gap and evidence |
| `milestones/m2/commands/projects.md` | Project overview command contract |
| `milestones/m2/commands/attempts.md` | `dispatch attempts` evidence read-side contract |
| `milestones/m2/commands/events.md` | Subscribe event-taxonomy reference contract |
| `milestones/m2/commands/spend.md` | Spend v2 breakdown contract |
| `milestones/m2/commands/queue.md` | Queue lifecycle verbs contract |
| `milestones/m2/commands/board.md` | Full M2 board contract |

### Appendix E — Structural diagram check (reference procedure)

No mermaid syntax validator exists in this repository, so the pack's diagrams are
checked structurally. The procedure below is the reference a test plan can adopt
or refine; it exits non-zero on any failure and prints what failed.

```bash
root=doc/planning/oss-tooling/milestones/m2
files=$(find "$root" -name '*.md')

# (a) at least 10 opening fences tagged mermaid
count=$(grep -h '^```mermaid' $files | wc -l)
[ "$count" -ge 10 ] || { echo "FAIL: $count mermaid fences, need >= 10"; exit 1; }

# (b) first body line is a diagram-type keyword; (c) every fence closes
awk '
  FNR==1 && open { printf "FAIL unclosed fence in %s\n", prev; bad=1; open=0 }
  /^```mermaid/ {
      open=1; prev=FILENAME; getline
      if ($0 !~ /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2)([ \t]|$)/) {
          printf "FAIL keyword %s:%d: %s\n", FILENAME, FNR, $0; bad=1
      }
      next
  }
  /^```/ { open=0 }
  END { if (open) { printf "FAIL unclosed fence in %s\n", prev; bad=1 } exit bad }
' $files || exit 1

# (d) C4 level headings; (e) inventory is 3 C4 + 6 named flows + 1 park/resume
c4=$(grep -hE '^#{2,3} C4 Level [123]' $files | wc -l)
[ "$c4" -eq 3 ] || { echo "FAIL: $c4 C4 level headings, need 3"; exit 1; }
# Flow headings are named in the pack's architecture.md; the reviewer confirms
# the six ticket flows plus the S17 park/resume, one heading and one diagram each.
```

The heading check in (d)–(e) is a counted grep for the C4 levels plus a named
heading review for the flows; both are deterministic because the flow names are
fixed by the ticket.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-10 | @spec-writer | Initial specification |
| 1.1 | 2026-11-10 | @spec-writer | Corrected the mermaid-validation premise: no validator exists in this repository. Rewrote NFR-6 and AC-NFR6-1 as a self-contained structural fence inventory (Appendix E), fixed the CONTEXT, ASSUMPTIONS, dependency, risk, KPI, and DoD references, and added DEC-15. Diagram content requirements unchanged. |
| 1.2 | 2026-11-10 | @spec-writer | Fixed two mechanism contradictions: the `entrypoint.md` bound is now one contiguous hunk over at most two adjacent DESCRIPTION sentences (F-6, NFR-3, AC-F5-4, AC-F6-1, AC-NFR3-1, DoD), and `status.md` acceptance is a whole-file retention oracle with an enumerated addition whitelist, not a whole-section `cmp` (NFR-7, AC-F7-2, AC-F7-3, AC-NFR7-1, DoD). Added DEC-16. |

---

## AUTHORING GUIDELINES

- The ticket body was read as the normative requirement source; the PM notes for GH-284 supplied the binding decisions (S17 scope, daemon resolution, reconciliation breadth, history handling, marker policy, index registration), which are encoded as DEC-1 through DEC-7 rather than re-litigated.
- Repository facts were verified in the working tree rather than assumed: the M2 epic position and current story set, the 28 M1 command pages and their status lines, the absence of the M2 pack, the pack conventions and index rows, the distribution guard's path set, the gate battery and the absence of any mermaid syntax validator (DEC-15), and the observed entrypoint outputs in Appendix C.
- Two ticket ambiguities were resolved and recorded: the entrypoint page's `dispatch` claim (DEC-8) and the blueprint brief's "S2-S16" scenario range against S17's explicit additions (DEC-10). The delta-note location (DEC-12), the status-header label (DEC-14), and the diagram-validation mechanism (DEC-15) are also recorded because the ticket left them to the pack convention or to repository tooling that does not exist.
- The template at `doc/templates/change-spec-template.md` governed structure; every section is present in order, and the Definition of Done lives under Section 17 so the mandated ordering is preserved.
- No implementation detail, file-level code path, or step-by-step task appears; the documents' contract surfaces are described as requirements, and code composition is described by behavior only.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-284)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
