---
change:
  ref: GH-284
  type: docs
  status: Proposed
  version: 1.9
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
    internal: [oss-tooling-backlog, oss-tooling-status, milestone-packs, m1-command-pages, doc-distribution-guard, forbidden-literals-registry]
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
- **Doc-guard scopes.** `scripts/.tests/test-doc-distribution.sh` marker-checks `doc/guides/**` and a fixed standalone list; `doc/planning/**` is outside that set, and no M1 pack document carries an `ados_distribution` marker. **The forbidden-literals guard does scan `doc/planning/**`:** its `userFacingDocs` scope covers `doc/**` except `doc/changes/**` and `doc/decisions/**`, every new user-facing doc must be listed in `scripts/checks/forbidden-literals.registry.json#registered`, a registered entry must be absent at the corpus baseline, and the guard fails closed otherwise. The aggregate gate is `pnpm check` (lint, format:check, typecheck, test, boundaries, prompt conformance, help-guide coverage, exports parity). **No mermaid syntax validator exists in this repository:** no workflow step or `scripts/checks/` entry invokes diagram tooling, and the only mechanical mermaid touch is a fenced-block counter in `scripts/.tests/test-inception-doc-consistency.sh`, which covers one guide and not `doc/planning/**`. Diagram validity is therefore proven structurally (NFR-6).

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
| Product files changed (excluding `doc/changes/**`) | 34 total — 31 delivery (30 planning + 1 registry) + 3 `system_spec_update` reconciliations; 0 elsewhere |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0 |
| Aggregate `pnpm check` (repo-local `TMPDIR`) | exit 0; default-`TMPDIR` run recorded, a lone `ci-baseline-parity` failure classified environmental |
| Diagram structure failures (fence inventory: count, keyword, closure, headings, 3+6+1 inventory) | 0 of 5 checks over ≥ 10 blocks |

### 4.2 Non-Goals

- **NG-1**: Delivering any M2 story. This change plans; it does not implement S11–S17, queue lifecycle mutations, telemetry ingestion, or pause/resume behavior.
- **NG-2**: Wiring the daemon lifecycle command into the production entrypoint, or any other product behavior change.
- **NG-3**: Rewriting `doc/spec/**` or `doc/overview/**` beyond the phase-7 reconciliation of the three named files; the doc-syncer owns current-truth truth, and this change corrects only claims the delivery made false.
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

- **F-1 — Six M2 stories land.** The Epic M2 block gains `### M2-S11 Multi-repository workstations`, `### M2-S12 Evidence inspection and divergence resolution`, `### M2-S13 Public event taxonomy`, `### M2-S14 Harness telemetry v2`, `### M2-S15 Queue lifecycle completion`, and `### M2-S16 Engine-first delivery operations`. Each entry carries `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on:` in the existing story shape, and no `- Ticket:` line (no ticket exists yet; the reading guide says the line appears only for created stories). The dependency lists are exactly the ticket's: S11 on M0-S5 and M1-S17; S12 on M1-S9; S13 on M1-S18; S14 on M1-S11, M1-S15, M1-S19, M1-S22; S15 on M1-S9, M1-S17, M1-S18; S16 on M1-S9, M1-S18, M1-S21, and the owner-hold hook change (#280). Story content is *verbatim in substance*: every normative clause of the ticket's story text is present with its meaning intact, and no clause is added, dropped, weakened, or merged into another story. Only whitespace, line wrapping, and typographic normalisation are permitted. The stories are inserted at the end of the Epic M2 block: in the base revision the insertion point is immediately after the M2-S9 entry's last line (`- Depends on: M2-S8.`, base line 1166) and before the blank line and `---` separator pair that close the block, and in the head revision the inserted block ends immediately before that blank line and `---`, so the `---` line, the blank line after it, and the `## Epic M3` heading follow the inserted block and stay byte-identical. Entries are in code order S11 through S17, so no existing entry moves. The inserted block begins with a blank line, so the new `### M2-S11` heading is separated from M2-S9's last line exactly as every other entry is.
- **F-2 — The owner-hard S17 lands.** `### M2-S17 Provider-aware peak pausing` lands with the same shape, its goal, its six task clauses (provider profile nomination at admission recorded on lane and attempt records; peak-window rules as data per profile; daemon watches windows and parks in-flight lanes with bounded-grace stop and recorded park reason; automatic resume from preserved session state at window end; zero-spend assertion through telemetry; daemon-absent degradation to iteration-start gating, documented), its seven numbered acceptance criteria, and its dependency list including M2-S14 and the owner-hold semantics (#280). The `- AC:` block is rendered as `- AC:` followed by an indented numbered list of the seven criteria, one per ticket criterion, because a single inline sentence cannot carry seven independently checkable conditions. The seven acceptance criteria are enumerated here so each is independently checkable: (1) a dispatch records its nominated provider profile, and the nomination is visible on lane and attempt records; (2) when a peak window starts for profile P, every in-flight lane using P is stopped with bounded grace, marked parked with reason `peak-window` and the window end, and stays parked until it ends; (3) lanes using other providers are unaffected during a P peak window and keep running; (4) when the window ends, parked lanes resume automatically from preserved session state, with no branch, artifact, or queue state lost or duplicated; (5) telemetry proves zero billable model calls on profile P during its peak window for parked lanes; (6) stop, park, and resume are auditable ledger events surfaced in status and brief; (7) it works with the daemon resident, and without it behavior degrades to iteration-start gating with the difference declared. The M2 test-scenario and contracts coverage for S17 is part of F-8.
- **F-3 — Two amendments land.** In M2-S4, only the `- Depends on:` line changes: `- Depends on: M1-S5, M1-S17.` becomes `- Depends on: M1-S5, M1-S17, M2-S11.` (the terminal period is retained), because the cross-repository board is delivered through the project model. In M2-S6, the `- Tasks:` block gains the clause that the story consumes M2-S14 telemetry for per-agent and per-model facts, and the `- Depends on:` line becomes `- Depends on: M1-S19, M2-S3, M2-S14.` (the terminal period is retained). The goal, the existing task clauses, the acceptance criterion, and the `- Ticket:` line (where present) are untouched. No other story is amended.
- **F-4 — Preservation.** The backlog frontmatter block, the `## Reading guide`, the `## Cross-cutting principles` section, the Epic headings, the Epic M2 retirement note, the blank line and `---` separator that close the Epic M2 block, every other story heading, and every other story's body are byte-identical to the base revision, and the separator and `## Epic M3` heading appear after the inserted block. Story codes and heading text are not renumbered, reordered, or reflowed. The retired M2-S1 gap stays a gap with the existing explanatory note. The diff is confined to the seven inserted entries and the two amended entries.
- **F-5 — Status headers state delivered reality.** The reconciliation rule is: a status header may not attribute planned status to a story that delivered, may not carry the milestone-level phrase after the milestone's stories delivered, and may not claim a command surface is reachable when the production entrypoint does not compose it. Applied across all 28 pages, this edits the fifteen pages named in Appendix B and no others. Pages with remaining planned scope point at the story that owns it: `board.md` at M2-S4 (full board), `watchdog.md` at M2-S2 (supervision battery), `mcp.md` at M3-S2 (full MCP). `plan.md` and `commit.md` drop the `M1 milestone planned` phrase while keeping their shipped attribution. `verify-gates.md` and `closeout.md` attribute their extension to the delivered story. `daemon.md` states in its header that the daemon engine and control protocol were delivered by M1-S18 while the lifecycle command is not mounted at the production entrypoint, and refers to the M2 entrypoint delta note for registration; its body is preserved as the delivered engine contract, so the header carries the reachability correction rather than the synopsis being rewritten. The same reachability correction propagates to the current-truth spec in phase 7 — `doc/spec/features/feature-resident-daemon.md`, `doc/spec/features/feature-cli-entrypoint.md`, and `doc/overview/architecture-overview.md` — so the planning page and the spec state the same fact. `entrypoint.md` is covered by F-6. Pack-level labels that follow the planned-until-exit convention (the M1 pack architecture title, the milestone index row) are not status headers and are not edited. Two further rules make each reconciled header self-consistent. First, the proposal tail (`Proposed contract.` or `Proposed examples.`) is removed from any reconciled header whose planned remainder is empty, and may survive only where the header names a planned remainder, scoped to that remainder; no reconciled page may read "Delivered … Proposed contract." with no planned scope. Second, the reconciliation preserves any delivered-extension scope the header already names: `watchdog.md` keeps `M1-S15 adds progress signals` and its `SC-M1-14` scenario reference while losing `M1 planned` and the proposal tail, and `verify-gates.md`/`closeout.md` keep their delivered extension attributions. The reachability rule is general, not daemon-specific: any reconciled page whose command family is not composed at the production entrypoint carries the same one-clause note — delivered engine or domain, not mounted at the production entrypoint, registration tracked where applicable. For this change that set is `daemon.md`, `board.md`, and `watchdog.md`, verified by absence from root `--help` membership; `doctor.md` is the one reconciled page excluded, because its non-composition is the pre-existing doctor residual already recorded in the current-truth spec (`feature-cli-entrypoint.md`), not a claim this change corrected.
- **F-6 — The entrypoint page matches observation.** `milestones/m1/commands/entrypoint.md`'s DESCRIPTION composes the command set in two adjacent sentences today: the first enumerates fourteen families (omitting `dispatch` and `coordinator`), and the second names `state`, `mcp`, `dispatch`, and the resident daemon as unregistered (wrongly including `dispatch`). Both sentences are wrong, in opposite directions, so the correction is a bounded contiguous region of at most two adjacent sentences replaced in place: the enumeration sentence lists exactly the sixteen observed families (adding `dispatch` and `coordinator`), and the registration sentence names exactly `state`, `mcp`, and the resident daemon (dropping `dispatch`). The two statements remain separate sentences, because the test plan's extraction predicate stops at the first period; merging them is not permitted. The region is the only change: the title, status header, and every following section keep their bytes. The corrected text is evidence-based — it derives from the observed root `--help`, and the observation (invocation, expected output, exit code) is recorded in the M2 delta note so a later reader can re-verify it.
- **F-7 — The status snapshot.** `status.md` gains one new dated section that records: M1 story delivery complete at 23 of 23 through the eleven-phase lifecycle; the M2 planning state entered by this change (S2–S10 carried, S11–S17 added, S1 retired into M1 with the gap deliberate, the two amendments, and no tickets yet created); the early inputs #268 (early M2 chore, scoped in its own issue) and #280 (delivered owner-hold baseline); and the maintenance convention that future M2 story deliveries keep the planning corpus current. The section does not claim M0 or M1 milestone exit, and it repeats that story delivery is not milestone exit. Superseded forward-looking statements gain explicit pointers without being rewritten: the title framing, the "M1 delivery starts now" paragraph under the M0 exit section, the 2026-11-07 scheduling-engine section, and items 1–3 of "Proposed next steps". Retention semantics are stated once in NFR-7: no original line is removed, reordered, or modified; each pointer is a new line or short paragraph inserted after its statement; and the retention oracle, not a whole-section comparison, is the acceptance check.
- **F-8 — The M2 pack documents.** `milestones/m2/` gains `README.md` (index and how to read: the pack's artifact map, status semantics, and the story-to-artifact map), `architecture.md` (C4 Level 1, Level 2, and Level 3 headings for the M2 end state — multi-repository workstations with per-repository state and a host-level index, the daemon event surface, the telemetry pipeline from harness stream through attribution to spend, metrics, and retro, completed queue lifecycle, engine-first operations with the shell fallback — plus the six key flows named in the ticket, the park/resume flow for S17, persistence and concurrency deltas, and boundary invariants at M2 exit), `contracts.md` (shared contract continuity plus `projects.v1`, `attempts.v1`, event taxonomy v1 with its four new topics, event kinds, payload shapes, ordering guarantees and the slow-consumer overflow-to-repoll rule, `telemetry.v1` attribution fields and reconciliation tolerance, queue lifecycle mutations with release/remove reasons, dependency edges and single-flight, and `spend` v2 breakdown fields, plus the S17 additions: the provider profile field on admission, lane, and attempt records, the peak-window rule schema, the park-reason vocabulary with `peak-window` and `owner-hold` and until timestamps, and resume event shapes), `test-scenarios.md` (`SC-M2-*` scenarios mapped to stories S2 through S17, at least two per story, including the seven mandatory scenarios the ticket names and the five S17 scenarios), and `journeys.md` (the four operator journeys the ticket names plus the S17 cost-control journey). Delivering the pack includes its registry registration: the twelve new documents are added to `scripts/checks/forbidden-literals.registry.json` (sorted, no duplicates) so the forbidden-literals guard, whose `userFacingDocs` scope covers `doc/planning/**`, accepts them; this registry edit is part of the pack deliverable, not an incidental side effect. The pack deviates deliberately from the `milestones/README.md` pack-contents table, which lists `man-page.md` and `interactions.md` for every milestone with an operational CLI: M2 ships neither and ships `entrypoint-delta.md` instead. The deviation is stated in `milestones/m2/README.md`, the table is left byte-identical to the base revision, and refining it is deferred to milestone exit.
- **F-9 — Six command contracts.** `milestones/m2/commands/` gains `projects.md`, `attempts.md`, `events.md`, `spend.md`, `queue.md`, and `board.md`, each a man-page-style contract with the pack's status header `Proposed (M2)`, synopsis, options, output shape (text digest and machine envelope), exit codes, invocation examples, an error table, and see-also links. Command names are bare with the `<binary>` invocation prefix; no working name is repeated. `attempts` is documented as a subfamily of `dispatch`, and `events` as the subscribe-taxonomy reference, matching the story tasks that introduce them.
- **F-10 — The entrypoint delta note.** `milestones/m2/entrypoint-delta.md` records the root-entry delta: the observed composition at the time of writing (the sixteen families incl. `dispatch` and `coordinator`; `state`, `mcp`, and `daemon` absent), the M2-planned additions implied by the new stories (`projects`, `attempts` under `dispatch`, `events` under the subscribe surface, `spend` v2, `queue` lifecycle verbs, the full `board`), the daemon registration gap with its observed evidence and its owner (product wiring, outside this planning change), and the statement that the M1 `entrypoint.md` page is a milestone snapshot whose only amendment is its bounded DESCRIPTION correction, so the note must not claim a pointer from that page. The note is discoverable through the pack index (`milestones/README.md`'s M2 row) and `milestones/m2/README.md`, and it links forward to the M1 `entrypoint.md` page and the M2 command pages. It is a delta note, not a restated man page; the M1 `man-page.md` remains the M1 snapshot.
- **F-11 — Index registration.** `milestones/README.md` gains one M2 row in its `## Index` table linking the pack README, each pack-level document, and each of the six command pages — a deliberate twelve-target row, broader than the M1 rows because the M2 command contracts are part of the delivered contracts and the pack has no man page — with the milestone label marked planned and the table's formatting followed. The M0 and M1 rows keep their bytes.

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

- `doc/planning/oss-tooling/backlog.md`: seven new M2 story entries inserted inside the Epic M2 block before its closing blank line and `---` separator, two amendments, and the preservation guarantees.
- `doc/planning/oss-tooling/status.md`: one new dated M2 planning section and pointers on superseded forward-looking statements.
- `doc/planning/oss-tooling/milestones/m1/commands/*.md`: status-header reconciliation on the pages whose header contradicts delivered reality, plus the bounded two-sentence DESCRIPTION correction on the entrypoint page (Appendix B).
- `doc/planning/oss-tooling/milestones/m2/`: the new pack — README, architecture, contracts, test-scenarios, journeys, entrypoint delta note, six command contracts.
- `doc/planning/oss-tooling/milestones/README.md`: the M2 index row.
- `scripts/checks/forbidden-literals.registry.json`: the twelve new M2 pack documents registered (sorted, no duplicates) so the forbidden-literals guard accepts them.
- Phase 7 `system_spec_update`: exactly three current-truth corrections — `doc/spec/features/feature-resident-daemon.md` (reachability caveat on the command family), `doc/spec/features/feature-cli-entrypoint.md` (composition-authority sentence), and `doc/overview/architecture-overview.md` (stale "no typed daemon" claim).
- The change artifacts under `doc/changes/2026-11/2026-11-10--GH-284--m2-planning/`.

### 7.2 Out of Scope

- [OUT] Wiring or registering the `daemon` lifecycle command at the production entrypoint, and any other change to `packages/**`.
- [OUT] Delivering any M2 story, including the surfaces S11–S17 describe.
- [OUT] Changing any `scripts/**`, `tests/**`, `packages/**`, `.opencode/**`, or `.ai/**` file other than the one `scripts/checks/forbidden-literals.registry.json` registration; in particular, no guard-behaviour change (such as teaching the guard about branch-added docs) is in scope.
- [OUT] Rewriting `doc/spec/**` or `doc/overview/**` in the delivery phases, or beyond the three named phase-7 corrections; the phase-7 budget covers only claims the delivered change made false.
- [OUT] Creating tracker tickets for M2-S11 through M2-S17; the PM proposes, the owner decides.
- [OUT] Landing #268 as a backlog story; it is already scoped in its own issue.
- [OUT] Reorganising `roadmap.md`, `backlog-ranking.md`, or `cli-command-registry.md`.
- [OUT] Any hosted, proprietary, fleet, repository, or product name in the new documents.

### 7.3 Deferred / Maybe-Later

- Registering the new M2 command names in `cli-command-registry.md`; the registry stays the naming surface, and the names this pack introduces derive from story tasks. Reconcile at first M2 story delivery.
- A repo-wide interpretation of the `ados_distribution` marker scope for `doc/planning/**` (DEC-6), handed to `@decision-advisor` as an ODR or to an `AGENTS.md` wording fix, so the next planning change does not re-litigate it.
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
| DM-2 | Command-page status header | The status line under the page title. It must name the delivered story or state planned status, and name the owning M2/M3 story when a planned remainder exists. A reconciled header must not carry a proposal tail (`Proposed contract`/`Proposed examples`) unless it also names a planned remainder that the tail scopes to; a delivered-extension clause already present stays. For the status reconciliations it is the only line that may change; the entrypoint page's composition region is corrected separately under F-6. |
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
| NFR-1 | Docs-only containment, with the phase boundary explicit | The delivery budget (phases 1–6) is exactly 31 product files (all paths except `doc/changes/**`): 30 under `doc/planning/oss-tooling/**` and one registry file, `scripts/checks/forbidden-literals.registry.json`, carrying the twelve added registrations (sorted, no duplicates). `system_spec_update` (phase 7) is a separate budget: it may edit current-truth docs under `doc/spec/**` and `doc/overview/**` only, and only to correct claims the delivered change made false; for this change that is exactly three files — `doc/spec/features/feature-resident-daemon.md`, `doc/spec/features/feature-cli-entrypoint.md`, and `doc/overview/architecture-overview.md` — for **34 product files across the whole change**. No other paths change in either phase: no `scripts/**` beyond the registry, no `tests/**`, `packages/**`, `.opencode/**`, or `.ai/**`. `doc/changes/**` artifacts are excluded from the product-file set. |
| NFR-2 | Backlog preservation | Every existing story heading is byte-identical; the two amended entries differ only in the lines F-3 names; every other story's `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on:` lines are byte-identical; the frontmatter block, reading guide, and epic retirement note are byte-identical; the blank line and `---` separator closing the Epic M2 block and the `## Epic M3` heading are byte-identical and follow the inserted block; 0 story codes renamed. |
| NFR-3 | Command-page containment | For each of the fourteen status reconciliation pages (every edited M1 command page except `entrypoint.md`), 100% of diff hunks lie within the status header region (the lines from the page title through the first section heading), and the remainder of the page is byte-identical. `entrypoint.md` is bounded separately: one contiguous diff hunk confined to a region of at most two adjacent sentences in its DESCRIPTION, with every other byte of the page identical. The predicate is expressible as "one contiguous diff hunk confined to the DESCRIPTION paragraph; at most two adjacent sentences; all other bytes identical". |
| NFR-4 | Doc-distribution guard | `bash scripts/.tests/test-doc-distribution.sh` exits 0; 0 `ados_distribution` markers added to any planning document. |
| NFR-5 | Aggregate gate | The authoritative `pnpm check` run uses a repository-filesystem `TMPDIR` (`mkdir -p <repo>/tmp/tmpdir && TMPDIR=<repo>/tmp/tmpdir pnpm check`) and exits 0. Both runs are recorded: the default-`TMPDIR` run and the repo-local-`TMPDIR` run. A default-run failure of `tests/checks/ci-baseline-parity.test.ts` alone — `git clone --local` hardlinks crossing into tmpfs — is classified as environmental and is not a delivery failure; any other default-run failure, or any failure under the repo-local `TMPDIR`, is a delivery failure. |
| NFR-6 | Diagram structure (self-contained check) | No mermaid syntax validator exists in this repository, so diagram validity is proven structurally over `doc/planning/oss-tooling/milestones/m2/**`, without new tooling: (a) at least 10 fenced blocks whose opening fence is tagged `mermaid`; (b) every such block's first body line starts with a diagram-type keyword (`flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`); (c) every opened fence is closed, so fence counts are even per file and each mermaid body ends before the next heading; (d) each diagram sits under a heading naming its subject, with the three C4 diagrams under headings in the pack form `## C4 Level <n>: <subject>` (the M1 form) and the six key flows plus the S17 park/resume under named `###` flow headings; (e) the inventory is 3 C4 levels, 6 key flows, and 1 S17 park/resume. A grep/awk procedure (Appendix E) proves (a)–(e) and exits 0. |
| NFR-7 | Status history retention | Retention semantics, stated once: no original line in `status.md` is removed, reordered, or modified — every line present in the base revision is present in the head revision, in the same order, byte-identical. Additions are permitted only as (i) the one new dated 2026-11-10 section and (ii) one appended pointer per affected statement group (the title framing, the "M1 delivery starts now" paragraph, the 2026-11-07 scheduling-engine section, and items 1–3 of "Proposed next steps"), each a new line or short paragraph of at most 3 lines that names the new section. The acceptance oracle is retention over the whole file (zero removed, reordered, or modified base lines, plus a whitelist of added regions). A whole-section `cmp` is not the acceptance oracle and must not be used. |
| NFR-8 | Story fidelity | 100% of ticket-supplied normative clauses present per story; 0 added acceptance criteria; 0 clause meaning changes. |
| NFR-9 | Public/OSS hygiene | 0 private, fleet, repository, hosted, or proprietary product names in new or changed text; the twelve new pack documents registered in `scripts/checks/forbidden-literals.registry.json`; the forbidden-literals guard reports 0 violations with all scope classes scanned. |
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
| RSK-9 | Diagram structure, doc guards, or the aggregate gate fail after local authoring; a default-`TMPDIR` run hits the `ci-baseline-parity` hardlink failure; a new planning doc is missing from the forbidden-literals registry | M | M | Run the structural diagram procedure (Appendix E), both doc guards, and `pnpm check` with a repo-local `TMPDIR`; register all twelve pack documents; record both gate runs and classify a lone default-run `ci-baseline-parity` failure as environmental, not a regression (NFR-5, NFR-9, AC-NFR5-1, AC-NFR9-1, DEC-19, DEC-21) | L |
| RSK-10 | The planning corpus drifts again after the next M2 delivery | M | H | The maintenance convention is restated in the new status section; each M2 delivery updates backlog markers and the snapshot | M: depends on future delivery discipline |

## 12. ASSUMPTIONS

- The ticket body is the normative requirement source for story text, amendments, the pack brief, and the acceptance list.
- "M1 delivered 23/23" means story delivery through the lifecycle; it does not assert milestone exit, pilot completion, or decision acceptance.
- `doc/planning/**` is outside the distribution-marker guard's scan set but **inside** the forbidden-literals `userFacingDocs` scope (`doc/**` except `doc/changes/**` and `doc/decisions/**`); the twelve new pack documents must therefore be registered in `scripts/checks/forbidden-literals.registry.json` (sorted, no duplicates) and must be absent at the corpus baseline, and the guard fails closed on any unregistered doc.
- The repository has no mermaid syntax validator and no workflow step or `scripts/checks/` entry for diagrams; diagram validity is therefore established structurally by the Appendix E procedure (NFR-6), not by a gate.
- The M1 pack's planned-until-exit labels remain correct until the milestone exits; only per-command status headers that name delivered stories are reconciled.
- A built workspace exists in the checkout, so `delivery-os` invocations reflect the built composition; the observed outputs recorded in Appendix C were produced from that build.
- The environment's default `TMPDIR` is tmpfs, where `tests/checks/ci-baseline-parity.test.ts` fails because `git clone --local` hardlinks cross devices; the authoritative aggregate-gate run therefore uses a repository-filesystem `TMPDIR`, and the default run is recorded with that single failure classified environmental (NFR-5, DEC-19).
- The M1 command pack has 28 pages, verified by directory listing; the ticket's count of the drift examples is illustrative, not exhaustive.
- Pack documents are public; production evidence is described by class, never by name.
- Story codes are stable and file position carries no ordering meaning, per the backlog reading guide.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M1 story delivery (23/23) | Every reconciliation target must actually be delivered; verified in the current tree |
| Depends on | Owner-hold hook change (#280) | Referenced as a dependency by M2-S16 and M2-S17; delivered as the baseline |
| Depends on | Doc guards (distribution marker and forbidden literals) and structural diagram check | Must pass on the branch head; the distribution guard excludes `doc/planning/**`, the forbidden-literals guard scans it and requires the twelve registrations, and no mermaid validator exists so the diagram check is the Appendix E procedure |
| Depends on | Delivered feature specs under `doc/spec/features/` | The external truth that makes "M1 planned" headers wrong; three current-truth files are reconciled in phase 7 under DEC-22 |
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
| DEC-6 | No `ados_distribution` marker is added to any M2 pack document: `doc/planning/**` is outside the distribution guard's scan set (the guard marker-checks `doc/guides/**` plus the `STANDALONE_DOCS` list in `scripts/.tests/test-doc-distribution.sh`), and `AGENTS.md`'s "Doc distribution marker (`ados_distribution`)" section enumerates the paths that must declare the marker — `doc/guides/`, `doc/templates/`, and the named standalone docs — a set that excludes `doc/planning/**`; no M1 pack document carries a marker either. The forbidden-literals guard is a different guard with a different scope, handled by DEC-21 | The distribution guard's actual path set plus the `AGENTS.md` enumeration are the operative rule, which narrows the broader "any doc under `doc/`" phrasing in `.ai/agent/pm-instructions.md` for this change; because that reading is precedent-setting, it is also routed to `@decision-advisor` as a deferred repo-wide interpretation (see §7.3) | 2026-11-10 |
| DEC-7 | `milestones/README.md` gains an M2 index row | The ticket asks for a new pack with its own README; the pack index is how a pack is discovered, so registration is part of delivering the pack | 2026-11-10 |
| DEC-8 | `entrypoint.md`'s command-composition region is corrected in this change, treating the `dispatch`/`coordinator` drift as delivered-reality reconciliation | The page is a delivered page whose claim is contradicted by the observed root listing in both directions; correcting it is the same class of fix as the status headers, not new scope | 2026-11-10 |
| DEC-9 | The new and amended story entries are inserted at the end of the Epic M2 block — after the M2-S9 entry's last line and before the blank line and `---` separator that close the block — in code order S11–S17; existing entries do not move | Codes are the identifier and file position carries no meaning, so appending minimises the diff and preserves every anchor; the `---` is the epic-block separator, and stories belong inside their own block rather than below it | 2026-11-10 |
| DEC-10 | `test-scenarios.md` maps S2 through S17, at least two scenarios per story; the ticket's "S2-S16" phrase is read as pre-S17 shorthand | S17's normative section explicitly adds blueprint test scenarios (park at peak start, provider isolation, resume without loss, zero-spend, daemon-absent degradation); the explicit additions govern | 2026-11-10 |
| DEC-11 | Early inputs are handled as context: #280 appears where the story text makes it a dependency, #268 stays in its own issue and is named in the status snapshot; neither becomes a backlog story here | The ticket presents both as already-filed inputs, and the Acceptance list does not ask for backlog entries; naming them in the snapshot keeps the sequencing context without inventing scope | 2026-11-10 |
| DEC-12 | The entrypoint delta note lives at `milestones/m2/entrypoint-delta.md`, not inside `commands/` or the pack README | The note describes the root entry's delta, not a command contract, and the README is the pack index; a named pack-level note keeps both roles clean | 2026-11-10 |
| DEC-13 | Preservation is enforced mechanically: append-only placement, per-entry hunk containment, byte identity for untouched regions, and status-header-only diffs for reconciled pages | The GH-266 lesson is that a preservation clause needs its own checkable criterion; a prose promise alone does not survive review | 2026-11-10 |
| DEC-14 | M2 command pages use the pack's `Status: Proposed (M2)` header, reading the ticket's uppercase `STATUS: Proposed (M2)` as the status value, not a label-casing change | All 28 M1 command pages carry `Status:`; keeping the label consistent makes the pack mechanically checkable, while the value `Proposed (M2)` carries the ticket's meaning | 2026-11-10 |
| DEC-15 | Mermaid validity is checked structurally, not by a repository gate: this repository has no mermaid syntax validator (no workflow step, no `scripts/checks/` entry, and the only mechanical touch is a fence counter in `scripts/.tests/test-inception-doc-consistency.sh`, which does not cover `doc/planning/**`). NFR-6 and AC-NFR6-1 are a grep/awk-verifiable fence inventory (Appendix E); the diagram content inventory (3 C4 levels, 6 key flows, 1 park/resume) is unchanged | An unexecutable criterion cannot be tested or reviewed; the structural procedure proves the same content requirements without new tooling, and recording the correction explains why the criterion changed | 2026-11-10 |
| DEC-16 | Two mechanism corrections. (a) `entrypoint.md` is bounded as one contiguous hunk over at most two adjacent sentences in DESCRIPTION, with every other byte identical, because both the enumeration sentence and the not-registered sentence are wrong in opposite directions; the two statements stay separate sentences so the extraction predicate that stops at the first period keeps working; merging them is not permitted. (b) `status.md` acceptance is a retention oracle over the whole file — zero removed, reordered, or modified base lines, additions confined to the new dated section and one pointer per affected statement group — and a whole-section `cmp` is explicitly not the oracle and must not be used | A one-sentence bound is unachievable against the page's actual text and would merge two facts the test plan separates; whole-section identity contradicts the appended pointers this same spec requires, so retention plus an addition whitelist is the only self-consistent check | 2026-11-10 |
| DEC-17 | The seven new stories are inserted at the end of the Epic M2 block — immediately after the M2-S9 entry's last line (base line 1166) and before the blank line and `---` separator that close the block — so the `---` line, the blank line after it, and the `## Epic M3` heading remain byte-identical and follow the inserted block; an insertion below the separator is non-conforming | The `---` is the epic-block separator, so inserting after it would strand the separator between M2-S9 and M2-S11 and break the block structure that the backlog relies on for reading and review; pinning the position makes the containment ACs executable | 2026-11-10 |
| DEC-18 | On a reconciled status header, the proposal tail (`Proposed contract`/`Proposed examples`) is removed when the planned remainder is empty and retained only when the header names a planned remainder for it to scope to; delivered-extension clauses and scenario references already present are preserved (notably `watchdog.md`'s `M1-S15 adds progress signals` and `SC-M1-14`) | A "Delivered … Proposed contract." header is still a planned-status claim, and every already-delivered page in the repository has dropped the tail; preserving extension scope prevents a naive rewrite from deleting true delivered references | 2026-11-10 |
| DEC-19 | The authoritative aggregate-gate invocation is `pnpm check` with a repository-filesystem `TMPDIR` (`mkdir -p <repo>/tmp/tmpdir && TMPDIR=<repo>/tmp/tmpdir pnpm check`); both the default-`TMPDIR` and repo-local-`TMPDIR` runs are recorded, and a default-run failure of `tests/checks/ci-baseline-parity.test.ts` alone is classified environmental (`git clone --local` hardlinks crossing into tmpfs), not a delivery failure | Plain `pnpm check` is unsatisfiable in this environment and the test plan and plan already treat the repo-local invocation as authoritative; making it normative removes the spec-vs-plan contradiction without excusing any other failure | 2026-11-10 |
| DEC-20 | The M2 pack deliberately deviates from the `milestones/README.md` pack-contents table (no `man-page.md`, no `interactions.md`; `entrypoint-delta.md` instead); the deviation is stated in `milestones/m2/README.md`, the table is left byte-identical pending milestone-exit refinement, and the M2 index row links all twelve artifacts rather than the M1 rows' top-level-only shape | The ticket's explicit file list governs the pack; stating the deviation makes it checkable instead of silent, and the fuller index row reflects that the six command contracts are part of what M2 delivers | 2026-11-10 |
| DEC-21 | The two doc guards have different scopes. `scripts/.tests/test-doc-distribution.sh` does not scan `doc/planning/**` (so no `ados_distribution` marker is added), but the forbidden-literals guard's `userFacingDocs` scope covers `doc/**` except `doc/changes/**` and `doc/decisions/**`, so each of the twelve new pack documents is registered in `scripts/checks/forbidden-literals.registry.json` (sorted, no duplicates, absent at the corpus baseline). That one registry file is in scope for this change; changing guard behaviour — for example teaching the guard about branch-added docs — is explicitly out of scope | The guard fails closed on an unregistered user-facing doc, so without the registration `pnpm check` cannot pass; the registry is the guard's own extension mechanism, and editing it is the minimal change that keeps the containment rule satisfiable | 2026-11-10 |
| DEC-22 | The containment rule is split by phase. Delivery (phases 1–6) changes exactly 31 product files: 30 under `doc/planning/oss-tooling/**` plus `scripts/checks/forbidden-literals.registry.json`. `system_spec_update` (phase 7) is a separate budget limited to current-truth docs under `doc/spec/**` and `doc/overview/**`, correcting only claims the delivered change made false; for this change that is exactly three files (`feature-resident-daemon.md`, `feature-cli-entrypoint.md`, `architecture-overview.md`), for 34 product files across the whole change | The doc-syncer owns current-truth reconciliation; a containment rule written only for delivery phases would forbid the phase's own mandate, and the daemon reachability correction must live in the spec a reader consults, not only in a planning page | 2026-11-10 |
| DEC-23 | The M1 `entrypoint.md` page is a milestone snapshot and is not amended beyond its bounded DESCRIPTION correction; the M2 delta note must not claim a pointer from it. Discoverability runs through the pack index (`milestones/README.md` M2 row) and `milestones/m2/README.md`, and the delta note links forward to the M1 page and the M2 command pages | The containment bound (NFR-3/AC-F5-4) permits only the bounded DESCRIPTION hunk, so a back-link cannot be added without violating it; forward links plus the pack index give a discoverable path with no false claim | 2026-11-10 |
| DEC-24 | The reachability note is a general rule, not a daemon special case: any reconciled page whose command family is not composed at the production entrypoint carries the same one-clause note (delivered engine or domain; not mounted at the production entrypoint; registration tracked where applicable). The set is verified by absence from root `--help` membership; for this change it is `daemon.md`, `board.md`, and `watchdog.md`, with `doctor.md` excluded as the pre-existing doctor residual recorded in `feature-cli-entrypoint.md` | `board` and `watchdog` also answer `fallback.internal` at the production entrypoint, so a bare "Delivered" header overclaims reachability exactly as the daemon page did; applying the rule uniformly keeps the reconciliation honest | 2026-11-10 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/planning/oss-tooling/backlog.md` | Updated: 7 new stories, 2 amended entries, preservation guarantees |
| `doc/planning/oss-tooling/status.md` | Updated: 1 new dated section, 4 pointer insertions |
| `doc/planning/oss-tooling/milestones/m1/commands/` | Updated: 14 status headers plus the entrypoint DESCRIPTION region |
| `doc/planning/oss-tooling/milestones/m2/` | New: 12 documents |
| `doc/planning/oss-tooling/milestones/README.md` | Updated: M2 index row |
| `scripts/checks/forbidden-literals.registry.json` | Updated: twelve registrations for the new pack documents |
| `doc/spec/features/feature-resident-daemon.md` | Updated (phase 7): reachability caveat on the command family |
| `doc/spec/features/feature-cli-entrypoint.md` | Updated (phase 7): composition-authority sentence aligned |
| `doc/overview/architecture-overview.md` | Updated (phase 7): stale "no typed daemon" claim corrected |
| `packages/**`, `tests/**`, `.opencode/**`, `.ai/**`, and every other `scripts/**` file | Unchanged |

## 17. ACCEPTANCE CRITERIA

### 17.1 Functional

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** `backlog.md`, **when** Epic M2 is read, **then** the headings `### M2-S11 Multi-repository workstations`, `### M2-S12 Evidence inspection and divergence resolution`, `### M2-S13 Public event taxonomy`, `### M2-S14 Harness telemetry v2`, `### M2-S15 Queue lifecycle completion`, and `### M2-S16 Engine-first delivery operations` appear in that order after the M2-S9 entry — separated from its last line by a blank line — and before the `---` line that closes the Epic M2 block (the separator immediately before the blank line that precedes `## Epic M3`), each followed by `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on:` lines and by no `- Ticket:` line; `### M2-S17 Provider-aware peak pausing` follows the six and also precedes that `---` line; and the `---` line, the blank line after it, and the `## Epic M3` heading are unchanged in content and relative order. | F-1, DM-1 |
| AC-F1-2 | **Given** the six S11–S16 entries, **when** each is checked against the ticket-derived clause table enumerated by the test plan (79 rows overall across S11–S17: 7 goals, 36 task clauses, 26 acceptance clauses, 7 dependency lines, 3 amendment clauses; S17 is additionally covered by AC-F2-1), **then** every clause in that table for S11–S16 is present in its entry with unchanged meaning and the missing-clause count is zero; that table, not the summaries below, is the oracle for "every normative clause", and the summaries are illustrative examples only — for example, S11's per-repository state scoping derived from the checkout identity (git common dir marker) with a host-level index, `projects list` reporting repo key, root, state location, daemon reachability and handover state, the migration note for existing single-store users, and the tests proving two checkouts using the same ref cannot observe each other's documents; S12's `dispatch attempts [--ref] [--limit]` read side carrying token, corroboration triple, divergence refs, timestamps and harness, the `dual-run resolve` flow including resolution from local evidence with the mode declared, the machine envelope, unresolved counts, and coverage/floor reporting as exposed by the summary; S13's extension beyond status/lanes to `queue.graph`, `dispatch.attempt`, `phase.state` and `blockers.state`, the documented event kinds, payloads, ordering guarantees and slow-consumer overflow-to-repoll rule as a public versioned contract, and contract tests per topic; S14's per-step cost and token ingestion from the opencode v2.x.y step frames attributed through session economics and command-audit identity (M1-S15, M1-S22), phase-transition, stall and restart timing, schema-versioned local event storage, spend breakdowns per ticket/repository/lane/agent/model plus timing summaries, exposure to the retro evidence pass and the morning brief, and the declared reconciliation tolerance with telemetry absence remaining a classified outcome; S15's release/removal with reasons, automatic release on merge and closeout, dependency edge add/remove, single-flight per ref enforced across dispatch paths on the dual-run evidence, and stale-entry reconciliation against tracker truth; S16's engine-first regular delivery, provider windows and holds as engine-visible data built on the pre-iteration hold hook and lane economics, periodic per-repository handover-gate evaluation over accrued evidence with the shell path kept usable and documented, deprecation pointers from shell entry points, and a per-repository reversible flip. No criterion is added or merged across stories; any missing table row fails the clause check. | F-1, NFR-8 |
| AC-F1-3 | **Given** the `backlog.md` diff against the base revision with zero-context hunks, **when** the hunks are inspected, **then** every hunk lies inside one of the seven inserted entries or the two amended entries, with nothing quoted from a neighbouring entry, and every insertion hunk lies at or before the head-revision `---` line that precedes `## Epic M3`, so an insertion below that separator fails. | F-1, F-4, NFR-2, DEC-17 |
| AC-F2-1 | **Given** `backlog.md`, **when** the S17 entry is read, **then** its `- AC:` block carries all seven criteria as independently numbered items — (1) profile nomination recorded at dispatch admission and visible on lane and attempt records, (2) peak start stops every in-flight lane on P with bounded grace, parked with reason `peak-window` and the window end, until the window ends, (3) lanes on other providers are unaffected and keep running, (4) window end resumes parked lanes automatically from preserved session state with no branch, artifact, or queue state lost or duplicated, (5) telemetry proves zero billable model calls on P during the window for parked lanes, (6) stop, park, and resume are auditable ledger events surfaced in status and brief, (7) daemon-resident operation with the daemon-absent iteration-start degradation declared — and a `- Depends on:` line containing `M1-S15`, `M1-S18`, `M1-S21`, `M1-S22`, `M2-S14`, and the owner-hold semantics `(#280)`. | F-2, DM-1 |
| AC-F2-2 | **Given** the S17 entry, **when** its task clauses are compared with the ticket, **then** provider-profile nomination at dispatch admission recorded on the lane and attempt records (building on M1-S21 profiles and M1-S22 identity), peak-window rules as data per profile including windows, multipliers and buffers, the daemon's watch-and-park behavior with bounded-grace stop, preserved session state and a recorded park reason, automatic resume from preserved session state on the same branch through the session resume path without re-dispatch, the zero-spend assertion through telemetry that no model calls bill on a parked profile during its window, and daemon-absent degradation to the existing iteration-start gating (documented) are all present, and none is softened to "may" or moved to another story. | F-2, NFR-8 |
| AC-F2-3 | **Given** the S17 entry, **when** its acceptance block is inspected, **then** each of the seven criteria remains independently identifiable (numbered list under `- AC:`), so a test plan can map one criterion to one check. | F-2, NFR-8 |
| AC-F3-1 | **Given** the M2-S4 entry, **when** it is compared byte for byte with the base revision, **then** only its `- Depends on:` line differs, reading `- Depends on: M1-S5, M1-S17, M2-S11.` — with the terminal period, which follows the file's existing convention for every story's depends line and is required — and its heading, goal, tasks, and acceptance criterion are byte-identical. | F-3, NFR-2 |
| AC-F3-2 | **Given** the M2-S6 entry, **when** it is compared byte for byte with the base revision, **then** its `- Tasks:` block gains the M2-S14 telemetry-consumption clause and its `- Depends on:` line reads `- Depends on: M1-S19, M2-S3, M2-S14.` with the terminal period retained, and its heading, goal, existing task clauses, and acceptance criterion are byte-identical. | F-3, NFR-2 |
| AC-F4-1 | **Given** `backlog.md`, **when** every story heading present in the base revision and every non-amended entry are compared byte for byte, **then** every such heading text, every story code, the Epic M2 retirement note, and every other entry are identical, and no existing story has moved relative to its neighbours; the blank line and `---` separator closing the Epic M2 block and the `## Epic M3` heading remain byte-identical and follow the inserted block, so no insertion hunk lies below that separator. | F-4, NFR-2, DEC-17 |
| AC-F4-2 | **Given** `backlog.md`, **when** its head is compared with the base revision, **then** the frontmatter block, the `## Reading guide`, and the `## Cross-cutting principles` section are byte-identical. | F-4, NFR-2 |
| AC-F5-1 | **Given** the 28 M1 command pages, **when** all status headers are searched, **then** zero contain `M1 planned` or `M1 milestone planned` for a story that delivered, and each of the fourteen status reconciliation pages in Appendix B names the delivered story, with its GH reference where one exists, in its header; no reconciled page whose planned remainder is empty carries a `Proposed contract` or `Proposed examples` tail, and any reconciled page that keeps the tail names the planned remainder it scopes to; `watchdog.md` retains `M1-S15 adds progress signals` and `SC-M1-14`, and `verify-gates.md`/`closeout.md` retain their delivered extension attributions; `daemon.md`, `board.md`, and `watchdog.md` each carry the one-clause reachability note (not composed at the production entrypoint); `entrypoint.md` satisfies AC-F6-1. | F-5, DM-2, DEC-18, DEC-24 |
| AC-F5-2 | **Given** the reconciled pages with remaining planned scope, **when** `board.md`, `watchdog.md`, and `mcp.md` are read, **then** each names its owning future story (M2-S4, M2-S2, M3-S2 respectively) alongside the delivered attribution. | F-5, DEC-3 |
| AC-F5-3 | **Given** `daemon.md`, **when** its status header is read, **then** it states that the daemon engine and control protocol were delivered by M1-S18 (GH-238), that the lifecycle command is not mounted at the production entrypoint, and that registration is tracked in the M2 entrypoint delta note; the header no longer claims `Current` reachability, and the page body is byte-identical so the delivered engine contract (protocol, persistence, degradation) survives as written. | F-5, F-10, DEC-2 |
| AC-F5-4 | **Given** each of the fourteen status reconciliation pages, **when** its diff against the base revision is inspected, **then** every hunk lies within the status header region and the rest of the page is byte-identical; and **given** `entrypoint.md`, **then** its diff is one contiguous hunk confined to the DESCRIPTION paragraph, covering at most two adjacent sentences, and every other byte of the page is identical. | F-5, NFR-3, DEC-13, DEC-16 |
| AC-F6-1 | **Given** `milestones/m1/commands/entrypoint.md`, **when** the DESCRIPTION is read, **then** the corrected region lists exactly the sixteen families observed in root `--help` (including `dispatch` and `coordinator`) and names exactly `state`, `mcp`, and the resident daemon as not registered; the enumeration and the not-registered statement remain separate sentences; and the diff is one contiguous hunk inside that region with every other byte of the page identical. | F-6, NFR-3, DEC-8, DEC-16 |
| AC-F7-1 | **Given** `status.md`, **when** the new dated section is read, **then** it states M1 story delivery at 23 of 23, the M2 planning state (S2–S10 carried, S11–S17 added, S1 retired with the gap deliberate, the two amendments, no tickets created yet), the early inputs #268 and #280, and the maintenance convention for future M2 deliveries; and it neither claims M0 or M1 milestone exit nor contradicts the exit criteria stated in the historical sections. | F-7, DEC-5, RSK-8 |
| AC-F7-2 | **Given** the four superseded forward-looking statement groups (the title framing, the "M1 delivery starts now" paragraph, the 2026-11-07 scheduling-engine section, and items 1–3 of "Proposed next steps"), **when** each is read, **then** each carries exactly one appended pointer — a new line or short paragraph of at most 3 lines naming the new dated 2026-11-10 section — inserted after the affected statement, with no original line removed, reordered, or modified. | F-7, NFR-7, DEC-5, DEC-16 |
| AC-F7-3 | **Given** `status.md` compared with the base revision, **when** a line-retention comparison runs over the whole file, **then** every line present in the base revision is present in the head revision, in the same order, byte-identical — zero removed, reordered, or modified lines — and every added line lies inside the new dated 2026-11-10 section or inside one of the four permitted pointer insertions. A whole-section `cmp` is not used as the acceptance oracle. | F-7, NFR-7, DEC-16 |
| AC-F8-1 | **Given** `milestones/m2/`, **when** its file set is listed, **then** it contains exactly `README.md`, `architecture.md`, `contracts.md`, `test-scenarios.md`, `journeys.md`, `entrypoint-delta.md`, and `commands/{projects,attempts,events,spend,queue,board}.md`; the README lists every one with a one-line purpose, the story-to-artifact map, and an explicit statement that the pack deliberately ships no `man-page.md` or `interactions.md` and ships `entrypoint-delta.md` instead, while the `milestones/README.md` pack-contents table stays byte-identical. | F-8, F-10, DM-3, DEC-20 |
| AC-F8-2 | **Given** `milestones/m2/architecture.md`, **when** its headings are read, **then** it names C4 Level 1, Level 2, and Level 3 headings for the M2 end state; contains the six ticket-named flows (multi-repo overview; attempt-history inspection and divergence resolution; telemetry attribution; queue auto-release after merge and closeout; single-flight refusal across dispatch paths; handover-gate evaluation) plus the S17 park/resume flow; covers persistence and concurrency deltas; and ends with boundary invariants at M2 exit. | F-8 |
| AC-F8-3 | **Given** `milestones/m2/contracts.md`, **when** its surfaces are listed, **then** it covers `projects.v1`, `attempts.v1`, event taxonomy v1 (topics `queue.graph`, `dispatch.attempt`, `phase.state`, `blockers.state`; event kinds; payload shapes; ordering guarantees; overflow-to-repoll rule), `telemetry.v1` (ticket, repository, lane, agent role, model, phase timing; reconciliation tolerance), queue lifecycle mutations (release/remove reasons, dependency edges, single-flight), `spend` v2 breakdowns, and the S17 additions (provider profile field on admission/lane/attempt, peak-window rule schema, park-reason vocabulary with `peak-window` and `owner-hold` plus until timestamps, resume event shapes). | F-8, DEC-10 |
| AC-F8-4 | **Given** `milestones/m2/test-scenarios.md`, **when** the scenario set is counted and inspected, **then** at least two `SC-M2-*` scenarios exist for each of S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, and S17 (32 or more total), including the seven mandatory scenarios (same-ref two-repo collision safety, divergence resolution in local-evidence mode, subscribe topic contract compliance, telemetry reconciliation within tolerance, auto-release after closeout, single-flight refusal naming the holder, handover evaluation reporting per condition) and the five S17 scenarios (park at peak start per profile, other-provider isolation, resume at window end without state loss, zero-spend assertion, daemon-absent degradation). | F-8, DEC-10 |
| AC-F8-5 | **Given** `milestones/m2/journeys.md`, **when** its journeys are listed, **then** it contains the one-host multi-repo morning overview, inspecting evidence before a handover decision, a retro grounded in telemetry, steering a running delivery, and the S17 cost-control journey in which a profile's peak parks one lane while another provider's lane finishes and both remain visible with automatic resume. | F-8 |
| AC-F9-1 | **Given** the six M2 command pages, **when** each header is read, **then** it carries `Status: Proposed (M2)`, a bare command name with the `<binary>` invocation prefix, and no working name. | F-9, DEC-14 |
| AC-F9-2 | **Given** each M2 command page, **when** its body is read, **then** it contains synopsis, options, output shape including the machine envelope, exit codes, at least one invocation example, an error table, and see-also links; and `attempts` is presented as a `dispatch` subfamily while `events` is presented as the subscribe-taxonomy reference. | F-9 |
| AC-F10-1 | **Given** `milestones/m2/entrypoint-delta.md`, **when** it is read, **then** it records the observed root composition (the sixteen families incl. `dispatch` and `coordinator`; `state`, `mcp`, `daemon` absent), the M2-planned additions, the daemon registration gap with the observed invocations and exit codes, the statement that wiring is product work outside this change, and that the M1 `entrypoint.md` page is a milestone snapshot whose only amendment is its bounded DESCRIPTION correction; it claims no pointer from that page, and it links forward to the M1 page and the M2 command pages while remaining reachable through `milestones/README.md` and `milestones/m2/README.md`. | F-10, DEC-2, DEC-12, DEC-23 |
| AC-F11-1 | **Given** `milestones/README.md`, **when** the `## Index` table is read, **then** it contains one M2 row that links `m2/README.md`, the five other pack-level documents (`architecture.md`, `contracts.md`, `test-scenarios.md`, `journeys.md`, `entrypoint-delta.md`), and each of the six command pages — twelve targets in total — marked planned, with the table's formatting followed and the M0 and M1 rows byte-identical to the base revision. | F-11, DM-3, DEC-20 |

### 17.2 Non-Functional

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR1-1 | **Given** the whole-change diff filtered to product files (all paths except `doc/changes/**`), **when** the changed-path list is inspected, **then** 34 product files change: 31 from the delivery phases (30 under `doc/planning/oss-tooling/**` plus `scripts/checks/forbidden-literals.registry.json`) and 3 from `system_spec_update` (`doc/spec/features/feature-resident-daemon.md`, `doc/spec/features/feature-cli-entrypoint.md`, `doc/overview/architecture-overview.md`); and zero other files change under `scripts/**`, `tests/**`, `packages/**`, `.opencode/**`, `.ai/**`, or elsewhere under `doc/spec/**` or `doc/overview/**`. | NFR-1, DEC-21, DEC-22 |
| AC-NFR2-1 | **Given** the `backlog.md` diff, **when** the preservation set is checked, **then** all headings except the seven new entries and two amended entries are byte-identical, all their body lines are byte-identical, and the frontmatter, reading guide, and epic retirement note are byte-identical. | NFR-2, F-4 |
| AC-NFR3-1 | **Given** each of the fourteen status reconciliation pages, **when** its diff is inspected with zero context, **then** every hunk lies in the header region and the body is byte-identical; and **given** `entrypoint.md`, **then** one contiguous hunk covers at most two adjacent sentences in DESCRIPTION and every other byte is identical. | NFR-3, F-5 |
| AC-NFR4-1 | **Given** the branch head, **when** `bash scripts/.tests/test-doc-distribution.sh` runs, **then** it exits 0 and no planning document carries an `ados_distribution` marker. | NFR-4, DEC-6 |
| AC-NFR5-1 | **Given** the branch head, **when** the aggregate gate runs twice — once with the default `TMPDIR` and once with a repository-filesystem `TMPDIR` created by `mkdir -p <repo>/tmp/tmpdir` — **then** both invocations and results are recorded; the repo-local-`TMPDIR` run exits 0; and if the default run fails, its only failing test is `tests/checks/ci-baseline-parity.test.ts`, classified as environmental (`git clone --local` hardlinks crossing into tmpfs) and not a delivery failure, while any other default-run failure or any repo-local-`TMPDIR` failure is. | NFR-5, DEC-19 |
| AC-NFR6-1 | **Given** the M2 pack documents, **when** the structural diagram procedure in Appendix E runs over them (count the fenced blocks whose opening fence is tagged `mermaid` and inspect each body), **then** (a) the count is at least 10; (b) every block's first body line begins with `flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, or `stateDiagram-v2`; (c) fences are balanced per file, so every mermaid block closes before the next heading; (d) the three C4 diagrams sit under headings in the pack form `## C4 Level <n>: <subject>`, matched tolerantly so a heading ending at the level digit is accepted, the six key flows plus the S17 park/resume sit under named `###` flow headings, and each heading owns exactly one diagram; and (e) the inventory is 3 C4 levels, 6 key flows, and 1 park/resume; the procedure exits 0 and reports zero failures. | NFR-6, RSK-9 |
| AC-NFR7-1 | **Given** `status.md`, **when** the retention oracle runs over the whole file, **then** zero base lines are removed, reordered, or modified; every added line lies inside the new dated section or one of the four permitted pointer insertions; and no whole-section `cmp` is asserted. | NFR-7, F-7 |
| AC-NFR8-1 | **Given** the seven new story entries, **when** each is diffed clause by clause against its ticket section, **then** the missing-clause count, the added-criterion count, and the changed-meaning count are each zero. | NFR-8, F-1, F-2 |
| AC-NFR9-1 | **Given** all new and changed text, **when** the forbidden-literals guard runs with all scope classes scanned, **then** it reports zero violations; the twelve new `doc/planning/oss-tooling/milestones/m2/**` documents are registered in `scripts/checks/forbidden-literals.registry.json` (sorted, no duplicates, absent at the corpus baseline) so no unregistered-doc finding remains; and no hosted, proprietary, fleet, repository, or product name appears in the change. | NFR-9, RSK-4, DEC-21 |
| AC-NFR10-1 | **Given** the pack documents, **when** links and content are inspected, **then** zero relative links are broken and zero pack documents restate a story's acceptance-criteria block instead of referencing the story code. | NFR-10, RSK-6 |

### 17.3 Definition of Done

- [ ] `backlog.md` carries M2-S11 through M2-S17 with full clause fidelity, inserted at the end of the Epic M2 block after M2-S9's last line, separated by a blank line, and before the block-closing blank line and `---` separator, with the M2-S4 and M2-S6 amendments applied; all other bytes preserved, including the separator and `## Epic M3` after the inserted block (AC-F1-*, AC-F2-*, AC-F3-*, AC-F4-*, AC-NFR2-1).
- [ ] All 28 M1 command pages audited; the fourteen status reconciliation pages in Appendix B reconciled in their status header only (including `daemon.md`, whose body is preserved), with remainders pointed at M2-S4, M2-S2, or M3-S2; `daemon.md`, `board.md`, and `watchdog.md` carry the one-clause reachability note; the entrypoint page's bounded DESCRIPTION region (at most two adjacent sentences) matched to observed root help with every other byte identical (AC-F5-*, AC-F6-1, AC-NFR3-1).
- [ ] `status.md` carries one new dated M2 section and four appended pointer insertions under the retention oracle — zero removed, reordered, or modified base lines, additions confined to the whitelist — with no whole-section `cmp` asserted (AC-F7-*, AC-NFR7-1).
- [ ] `milestones/m2/` exists with the twelve documents, complete architecture levels and flows, contract surfaces, at least 32 scenarios, five journeys, six command contracts, and the delta note that records the gap and the M1 page's snapshot status without claiming a back-link (AC-F8-*, AC-F9-*, AC-F10-1).
- [ ] `milestones/README.md` indexes M2 without touching M0 or M1 rows (AC-F11-1).
- [ ] `bash scripts/.tests/test-doc-distribution.sh` exits 0; `pnpm check` exits 0 with a repo-local `TMPDIR`, both the default-`TMPDIR` and repo-local runs are recorded, and a lone default-run `ci-baseline-parity` failure is classified environmental (AC-NFR1-1, AC-NFR4-1, AC-NFR5-1, NFR-5); the structural diagram procedure (Appendix E) passes with zero failures (AC-NFR6-1); exactly 34 product files changed — 31 delivery (30 planning + `scripts/checks/forbidden-literals.registry.json`) plus the 3 `system_spec_update` reconciliations — with zero elsewhere, and the forbidden-literals guard reports zero violations with the twelve pack documents registered (AC-NFR1-1, AC-NFR9-1).
- [ ] No tracker ticket was created, no M2 story was delivered, and no product behavior changed (DEC-1, NG-1, NG-2, NG-4).
- [ ] Story codes, headings, and existing story text outside the amended entries are byte-identical, with the check recorded in the delivery evidence (DEC-13, NFR-2).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

One docs-only pull request against `main-tools`. Recommended commit sequence (the delivery plan may split it into finer phases, including a separate evidence commit): (1) backlog stories and amendments, (2) contract-doc status reconciliation, (3) status snapshot, (4) M2 pack and index row. The order keeps each commit reviewable on its own and lets the pack reference story codes that already exist in the backlog. No feature flag, no migration, no coordination window; the documents are read by maintainers and delivery agents, and the only adoption step is that M2 tickets are created from the new backlog entries.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No stored user data, schema, index, or seed set changes. The only "migration" is editorial: existing planning documents gain corrected headers and one new section, and readers' existing links stay valid.

## 20. PRIVACY / COMPLIANCE REVIEW

None. The change touches public planning documents and adds no personal data, no telemetry, and no tracking. The story text's credential handling remains the existing rule (credential-missing names the variable, never its value). No private fleet, repository, or product name is introduced.

## 21. SECURITY REVIEW HIGHLIGHTS

No security impact: the change adds no runtime surface, no permission, no credential path, and no executable content. The only security-adjacent content is the story text that restates existing credential and privacy constraints; it introduces no new rule. The docs must not publish secrets, hostnames, or internal URLs, which NFR-9 covers.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The planning corpus is now the maintenance surface for M2: each M2 story delivery updates its backlog entry (progress markers) and, at meaningful boundaries, the status snapshot, per the convention restated in the new status section.
- The new command pages and contracts are proposals until their stories deliver; the pack README states the planned-until-exit semantics so a reader does not mistake them for shipped behavior.
- The entrypoint delta note is a point-in-time record; when the daemon is wired or M2 commands register, the note is updated, and the M1 entrypoint page is revised with it at the milestone snapshot's next touch.
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
| Entrypoint delta note | The M2 pack document recording the difference between the observed root listing and the M1 entrypoint page, the M2-planned additions, and the M1 page's snapshot status (it claims no pointer from that page). |
| Owner-hard requirement | A requirement the owner has mandated independently of delivery convenience; M2-S17 is one. |
| Docs-only change | A change whose product files are documentation plus a data-only guard registry registration, with no behaviour, test, or tooling change. |

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
| `board.md` | `M1 planned (M1-S5)` | M1-S5 delivered (GH-229), owner-gate SLA mechanics; `board` is not composed at the production entrypoint | Delivered M1-S5; full board planned M2-S4; carry the one-clause reachability note (not mounted at the production entrypoint) |
| `doctor.md` | `M1 planned (M1-S3)` | M1-S3 delivered (GH-224) | Delivered M1-S3; no planned remainder |
| `mcp.md` | `M1 planned (M1-S7)` | M1-S7 delivered (GH-231), minimal MCP | Delivered M1-S7; full MCP planned M3-S2 |
| `state.md` | `M1 planned (M1-S2)` | M1-S2 delivered (GH-222) | Delivered M1-S2 |
| `merge.md` | `M1 planned (M1-S4)` | M1-S4 delivered (GH-225) | Delivered M1-S4 |
| `verify-deploy.md` | `M1 planned (M1-S4)` | M1-S4 delivered (GH-225) | Delivered M1-S4 |
| `watchdog.md` | `M1 planned (M1-S1; M1-S15 adds progress signals). Proposed contract` | M1-S1 delivered (GH-221); the M1-S15 progress signals are delivered; the page references `SC-M1-14`; `watchdog` is not composed at the production entrypoint | Delivered M1-S1; **preserve** `M1-S15 adds progress signals` and the `SC-M1-14` reference either way; the proposal tail **may be kept only if scoped to the M2-S2 remainder**, and dropping it is also conforming; carry the one-clause reachability note (not mounted at the production entrypoint) |
| `blockers.md` | `M1 planned (M1-S16)` | M1-S16 delivered (GH-230) | Delivered M1-S16 |
| `retro.md` | `M1 planned (M1-S8)` | M1-S8 delivered (GH-232) | Delivered M1-S8 |
| `commit.md` | `M1-S14 shipped (GH-227); M1 milestone planned` | M1-S14 delivered (GH-227) | Delivered M1-S14; milestone-planned phrase removed |
| `plan.md` | `M1-S13 shipped (GH-226); M1 milestone planned` | M1-S13 delivered (GH-226) | Delivered M1-S13; milestone-planned phrase removed |
| `verify-gates.md` | `M0 shipped (M0-S9); M1-S4 extends …` | M1-S4 delivered (GH-225) | Delivered M0-S9 plus delivered M1-S4 extension |
| `closeout.md` | `M0 shipped (M0-S14); M1-S12 expands …` | M1-S12 delivered (GH-240) | Delivered M0-S14 plus delivered M1-S12 expansion |
| `daemon.md` | `Current (GH-238 delivered)` | Engine and control protocol delivered by M1-S18; lifecycle command not mounted at the production entrypoint | Header only: engine delivered; command not registered; see the M2 entrypoint delta note |
| `entrypoint.md` | `delivered (GH-242)`; first DESCRIPTION sentence omits `dispatch`/`coordinator`, second wrongly lists `dispatch` as unregistered | `dispatch` and `coordinator` registered; `state`, `mcp`, `daemon` absent | DESCRIPTION region of at most two adjacent sentences: exact observed composition; `state`, `mcp`, and resident daemon named as not registered; every other byte identical |

The other thirteen pages already state delivered or shipped status consistently and are not edited. For every row above, only the false status fragment changes: any correct delivered-extension clause or scenario reference already present in the header or body — such as `watchdog.md`'s `M1-S15` progress-signal clause and `SC-M1-14` — is preserved, and the proposal tail is dropped when no planned remainder is named, or may be kept scoped to the remainder when one is named. Any row whose command family is absent from root `--help` carries the one-clause reachability note; for this set that is `daemon.md`, `board.md`, and `watchdog.md` (`doctor.md` is excluded as the pre-existing doctor residual recorded in `feature-cli-entrypoint.md`).

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

# (d) heading form and C4 association.
# The pack uses the M1 form: `## C4 Level <n>: <subject>` (e.g. "## C4 Level 1: system context").
# The predicate tolerates a heading that ends at the digit: ([^0-9]|$).
for lvl in 1 2 3; do
  heads=$(grep -hE "^## C4 Level $lvl([^0-9]|$)" $files | wc -l)
  [ "$heads" -eq 1 ] || { echo "FAIL: C4 Level $lvl headings=$heads (want 1)"; exit 1; }
  awk -v want="$lvl" '
    FNR==1 { inside=0 }
    $0 ~ "^## C4 Level " want "([^0-9]|$)" { inside=1; seen=0; next }
    /^## / { inside=0 }
    /^```mermaid/ { if (inside) seen++ }
    END { if (seen != 1) { printf "FAIL: C4 Level %s owns %d diagrams (want 1)\n", want, seen; exit 1 } }
  ' $files || exit 1
done

# (e) six key flows plus the S17 park/resume: each `###` heading under `## Key flows`
# owns exactly one diagram, and the section holds exactly seven of each.
awk '
  FNR==1 { insec=0 }
  /^## Key flows/ { insec=1; next }
  /^## / { insec=0 }
  insec && /^### / { n++; own[n]=0; next }
  insec && /^```mermaid/ { if (n) own[n]++ }
  END {
    ok=1
    if (n!=7) { printf "FAIL: flow headings=%d (want 7)\n", n; ok=0 }
    for (i=1;i<=n;i++) if (own[i]!=1) { printf "FAIL: flow heading %d owns %d diagrams (want 1)\n", i, own[i]+0; ok=0 }
    exit (ok?0:1)
  }
' $files || exit 1
```

The heading form is fixed: the pack uses `## C4 Level 1: <subject>`, `## C4 Level 2: <subject>`, and `## C4 Level 3: <subject>` (the M1 form), and the seven flows live under `## Key flows` as `### <flow name>` headings with one diagram each. The predicate matches a heading that ends at the level digit — `([^0-9]|$)` — so a bare heading is not falsely rejected, but the subject-bearing form is the committed target. Conditions (d) and (e) prove association, not merely independent counts; the test plan's P33 refines the same predicates.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-10 | @spec-writer | Initial specification |
| 1.1 | 2026-11-10 | @spec-writer | Corrected the mermaid-validation premise: no validator exists in this repository. Rewrote NFR-6 and AC-NFR6-1 as a self-contained structural fence inventory (Appendix E), fixed the CONTEXT, ASSUMPTIONS, dependency, risk, KPI, and DoD references, and added DEC-15. Diagram content requirements unchanged. |
| 1.2 | 2026-11-10 | @spec-writer | Fixed two mechanism contradictions: the `entrypoint.md` bound is now one contiguous hunk over at most two adjacent DESCRIPTION sentences (F-6, NFR-3, AC-F5-4, AC-F6-1, AC-NFR3-1, DoD), and `status.md` acceptance is a whole-file retention oracle with an enumerated addition whitelist, not a whole-section `cmp` (NFR-7, AC-F7-2, AC-F7-3, AC-NFR7-1, DoD). Added DEC-16. |
| 1.3 | 2026-11-10 | @spec-writer | Pinned the insertion position for the seven new stories at the end of the Epic M2 block, before its closing blank line and `---` separator (F-1, F-4, NFR-2, AC-F1-1, AC-F1-3, AC-F4-1, DEC-9, DoD). Added DEC-17. |
| 1.4 | 2026-11-10 | @spec-writer | DoR iteration 1 remediation: enumerated S17's seven acceptance criteria and made AC-F2-1 assert their content; made the repo-local-`TMPDIR` aggregate gate normative (NFR-5, AC-NFR5-1, KPI, RSK-9, DoD, assumption); added the proposal-tail rule and delivered-extension preservation (F-5, DM-2, AC-F5-1, Appendix B watchdog row, DEC-18); recorded the M2 pack-contents deviation and the twelve-target index row (F-8, AC-F8-1, F-11, AC-F11-1, DEC-20); pinned the inserted block's leading blank line (F-1, AC-F1-1, DoD); strengthened DEC-6 with the `AGENTS.md` citation and a deferred interpretation; recorded DEC-19; aligned §18 commit wording. AC count unchanged at 37. |
| 1.5 | 2026-11-10 | @spec-writer | DoR iteration 2 minor remediation: Appendix E now performs the heading-association check with the prescribed `## C4 Level <n>: <subject>` form and the EOL-tolerant `([^0-9]|$)` predicate, with NFR-6 and AC-NFR6-1 (d) aligned to it; Appendix B's `watchdog.md` row makes the proposal tail optional-but-scoped to M2-S2 rather than retained, matching DEC-18 and AC-F5-1; AC-F1-2 names the test plan's 79-row ticket-clause table as the oracle and labels its clause summaries illustrative. AC count unchanged at 37. |
| 1.6 | 2026-11-10 | @spec-writer | P6 correction: `doc/planning/**` is inside the forbidden-literals `userFacingDocs` scope (unlike the distribution-marker guard), so the twelve new pack documents must be registered in `scripts/checks/forbidden-literals.registry.json`. Fixed the §12 assumption, NFR-1, AC-NFR1-1 (exactly 31 product files: 30 planning + 1 registry), AC-NFR9-1, NFR-9, F-8, §7.1/§7.2, the KPI row, §13, RSK-9, §16, the glossary, and the DoD; added DEC-21 and noted it in DEC-6. AC count unchanged at 37. |
| 1.7 | 2026-11-10 | @spec-writer | Made the phase boundary explicit after `system_spec_update` reconciled three current-truth docs: NFR-1 and AC-NFR1-1 now state a 31-file delivery budget plus a separate phase-7 budget of exactly three files (`feature-resident-daemon.md`, `feature-cli-entrypoint.md`, `architecture-overview.md`), for 34 product files across the change. Updated the KPI row, §7.1/§7.2, §13, §16, NG-3, F-5 (propagation note), and the DoD; added DEC-22. AC count unchanged at 37. |
| 1.8 | 2026-11-10 | @spec-writer | Review iteration 1 remediation. F-1: the M1 `entrypoint.md` page stays a milestone snapshot and the delta note no longer claims a back-link — F-10 and AC-F10-1 now require the snapshot statement, forward links, and pack-index discoverability (DEC-23); the §22 maintenance note, glossary, and DoD aligned. F-8: the reachability note is a general rule for any reconciled page whose family is absent from root `--help` — `daemon.md`, `board.md`, and `watchdog.md` — encoded in F-5, Appendix B rows, the under-table rule, AC-F5-1, and the DoD (DEC-24). AC count unchanged at 37. |
| 1.9 | 2026-11-10 | @spec-writer | Review finding F-16 alignment: the M2-S4 and M2-S6 `- Depends on:` quotes now carry the terminal period the file's convention requires (F-3, AC-F3-1, AC-F3-2), so the period-restoring step is the compliant behaviour. AC count unchanged at 37. |

---

## AUTHORING GUIDELINES

- The ticket body was read as the normative requirement source; the PM notes for GH-284 supplied the binding decisions (S17 scope, daemon resolution, reconciliation breadth, history handling, marker policy, index registration), which are encoded as DEC-1 through DEC-7 rather than re-litigated.
- Repository facts were verified in the working tree rather than assumed: the M2 epic position and current story set, the 28 M1 command pages and their status lines, the absence of the M2 pack, the pack conventions and index rows, the two doc guards' differing scopes (the distribution marker guard excludes `doc/planning/**`, the forbidden-literals guard scans it and requires registration — DEC-21), the gate battery and the absence of any mermaid syntax validator (DEC-15), and the observed entrypoint outputs in Appendix C.
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
