---
change:
  ref: GH-85
  type: docs
  status: Proposed
  slug: ados-process-map-diagrams
  title: "ADOS processes map + per-guide diagrams (DX: reduce time to AHA moment)"
  owners: ["@juliusz-cwiakalski"]
  service: documentation
  labels: [dx, documentation, mermaid, onboarding, adoption]
  version_impact: none
  audience: external
  security_impact: none
  risk_level: low
  dependencies:
    internal:
      - doc/guides/change-lifecycle.md
      - doc/guides/project-inception.md
      - doc/guides/meeting-preparation-and-summarization.md
      - doc/guides/decision-making.md
      - doc/guides/onboarding-existing-project.md
      - README.md
      - doc/00-index.md
      - scripts/.tests/test-doc-distribution.sh
    external:
      - "GitHub Mermaid renderer (pinned version)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Give newcomers a single visual map of every ADOS process and a per-process diagram in each guide, so they grasp what ADOS does in seconds instead of reading walls of text — reducing time to the "AHA moment" and maximizing adoption.

## 1. SUMMARY

This change adds a canonical **ADOS Processes Map** guide (`doc/guides/ados-processes.md`) containing a master Mermaid diagram of all six processes (project inception, project onboarding, change delivery, meeting management, decision making, and documentation reconciliation as a supporting process), plus a compact process map to the top of `README.md`, and adds a near-the-top Mermaid diagram to the three process guides that currently lack one. It also weaves a cross-navigation mesh (back-links from every process guide to the processes map, forward links, and a prominent index placement). It is strictly **documentation-only**: no agent, command, or process logic changes.

## 2. CONTEXT

### 2.1 Current State Snapshot

ADOS is delivered and understood primarily through prose. The repository today offers:

- A **README.md** with a hero image and a one-line text pipeline (`ticket -> spec -> plan -> ... -> release`) that visualizes **only change delivery**. The other processes (inception, onboarding, meetings, decisions, documentation reconciliation) are invisible from the landing surface.
- **Five process guides** (plus documentation reconciliation, embedded inside the change lifecycle):
  1. `doc/guides/project-inception.md` — **has** Mermaid diagrams (flowchart TB, quoted labels, color fills, convergence diamonds).
  2. `doc/guides/change-lifecycle.md` — **has** a Mermaid diagram (flowchart TD, subgraphs, `<br/>` multiline labels, dashed feedback loops, Legend block).
  3. `doc/guides/meeting-preparation-and-summarization.md` — **no** Mermaid diagram.
  4. `doc/guides/decision-making.md` — **no** Mermaid diagram (its D0–D14 kernel and R0–R3 routing exist only as tables).
  5. `doc/guides/onboarding-existing-project.md` — **no** Mermaid diagram.
- **No single artifact** that shows all processes together and how they relate.
- `doc/00-index.md` lists guides in a table but has no "processes at a glance" entry point.

These are **two guides with diagrams (5 Mermaid fences total)** — `change-lifecycle.md` has 1 fence, `project-inception.md` has 4 fences — exhibiting two mature style families that serve as the de-facto conventions for this change.

### 2.2 Pain Points / Gaps

- **No bird's-eye view.** A newcomer must read multiple long guides to assemble a mental model of what ADOS actually does across its full surface area.
- **3 of 5 process guides have no diagram.** meeting-prep, decision-making, and onboarding are walls of text with no scannable entry visual.
- **README shows only change delivery.** Inception, onboarding, meetings, and decisions — equally important to understanding ADOS — are not represented on the first thing most people see.
- **No navigation mesh between process guides.** A reader in one process guide has no quick way to jump to the related processes or back to an overview.
- **Documentation reconciliation is implicit.** It is a real process (run by `@doc-syncer` / `/sync-docs`, embedded in the change lifecycle) but is never named as a process, so newcomers miss that ADOS keeps a living "current system spec" continuously reconciled.

## 3. PROBLEM STATEMENT

Because ADOS has no single visual map of its processes and three of five process guides have no diagram, a newcomer cannot quickly understand what the system does end-to-end, resulting in a slow time-to-AHA moment, higher perceived complexity, and reduced adoption.

## 4. GOALS

- **G-1**: Reduce time-to-AHA moment — a newcomer should grasp the full ADOS process surface from one diagram.
- **G-2**: Make every process visually scannable — each process guide has a Mermaid diagram near the top.
- **G-3**: Establish a single canonical "processes at a glance" reference that supports meetings (as a shared reference point) and onboarding.
- **G-4**: Maximize adoption by making the README and index immediately orient the reader to all processes with one-click access to each guide.
- **G-5**: Achieve diagrammatic consistency across all process diagrams (new and existing).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Process guides with a Mermaid diagram near the top | 5 of 5 (inception, change-lifecycle already pass; meeting-prep, decision-making, onboarding added) |
| Canonical processes-map guide exists | 1 (`doc/guides/ados-processes.md`) |
| Processes represented on README landing surface | 6 (5 primary + documentation reconciliation) — up from 1 (change delivery only) |
| Process guides with a back-link to the processes map | 5 of 5 |
| One-click access from README map to each guide | 5 of 5 (via adjacent link legend) |
| Render reliability on GitHub desktop | 100% of diagrams render (no blank/error boxes) |
| doc-distribution test | `bash scripts/.tests/test-doc-distribution.sh` exits 0 |

### 4.2 Non-Goals

- **NG-1**: No agent, command, or process-logic changes of any kind. This is documentation-only.
- **NG-2**: No rendered image assets (PNG/SVG). Diagrams are **Mermaid only** throughout — per the ticket's explicit Non-goals.
- **NG-3**: No restructuring of existing guide content beyond adding diagrams and navigation links.
- **NG-4**: No `doc/spec/**` feature specs for documentation processes (these are process guides, not system-feature specs).
- **NG-5**: No README hero rework, badges, "who is this for" section, or other adoption-funnel improvements surfaced by research but not in the ticket AC (deferred — see §7.3).
- **NG-6**: No interactive node-click navigation inside Mermaid diagrams (technically infeasible on GitHub — see DEC-1).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Canonical ADOS processes-map guide | A single authoritative overview with a master diagram, per-process cards, and cross-process relationships does not exist today; it is the missing bird's-eye view. |
| F-2 | Compact README process map | The README is the first thing newcomers see; it currently visualizes only change delivery and must orient the reader to all processes with one-click access. |
| F-3 | Per-guide Mermaid process diagrams | Three of five process guides (meeting-prep, decision-making, onboarding) have no diagram; a near-the-top visual makes each process scannable. |
| F-4 | Cross-navigation mesh | Readers in one process guide have no path to related processes or back to an overview; back-links, forward links, and index placement create a navigable whole. |
| F-5 | Diagram consistency review | New diagrams must be stylistically consistent with the two existing mature diagrams so the whole set reads as one coherent system. The review covers the two guides with diagrams (5 Mermaid fences total) plus the new diagrams added by F-1/F-2/F-3 — not just "the two diagrams". |

### 5.1 Capability Details

**F-1 — Canonical ADOS processes-map guide (`doc/guides/ados-processes.md`)**

A new guide that presents all six ADOS processes in one place. It contains: (a) a master Mermaid diagram showing the six processes and their relationships; (b) one overview card per process capturing the problem it solves, its audience, its primary output, and a link to its detailed guide; and (c) a readable, scannable structure (clear sections, short prose, tables/cards) — not a wall of text. The six processes are:

1. **Project inception** (greenfield) — produces the knowledge base agents operate against.
2. **Project onboarding** (brownfield) — adopts ADOS into an existing project.
3. **Change delivery** — the 11-phase ticket-to-PR workflow.
4. **Meeting management** — prepare, run, document, and follow up on meetings.
5. **Decision making** — calibrate decision rigor to risk; produce decision records.
6. **Documentation reconciliation** (supporting) — embedded in change delivery via `@doc-syncer` / `/sync-docs`; keeps the living "current system spec" reconciled after each change.

Cross-process relationships to surface: inception feeds delivery (knowledge base → agent autonomy); onboarding is the brownfield counterpart of inception; decisions arise during both inception and delivery; meetings produce decisions and action items; documentation reconciliation is embedded inside change delivery.

**F-2 — Compact README process map**

A compact Mermaid diagram placed near the top of `README.md` showing all processes at a glance. Because GitHub renders Mermaid inside a sandboxed iframe where node click-callbacks and in-label links do not work reliably (see DEC-1), one-click access to each guide is delivered via an **adjacent markdown link legend/table immediately under the diagram**, not via clickable nodes.

**F-3 — Per-guide Mermaid process diagrams**

A near-the-top Mermaid diagram added to each of the three guides that currently lacks one. The diagram visualizes that guide's process so the reader can scan it before reading prose:

- **meeting-preparation-and-summarization.md** — a before / during / after lifecycle diagram.
- **decision-making.md** — a D0–D14 decision-kernel overview plus an R0–R3 rigor-routing diagram (visualizing the tables the guide already documents).
- **onboarding-existing-project.md** — a setup flow diagram: getting ADOS → prerequisites → choose path (automated bootstrap vs manual) → mandatory artifacts → first change.

**F-4 — Cross-navigation mesh**

Every process guide carries a back-link to `doc/guides/ados-processes.md`, and the processes-map guide carries forward links to each process guide. `doc/00-index.md` links to the processes map in a prominent position (alongside or near the top "Start Here" surface). The change-lifecycle and project-inception guides (which already exist) also gain a back-link so all five process guides are uniformly connected.

**F-5 — Diagram consistency review**

A consistency pass over the whole set — the **two guides with diagrams (5 Mermaid fences total)** plus the new ones added by F-1/F-2/F-3 — so that node naming, color usage, subgraph conventions, multiline-label style, and feedback-loop notation read as one coherent family. The F-5 review covers **all 5 existing fences**: (1) `change-lifecycle.md` lifecycle diagram; (2) `project-inception.md` Track A/B convergence diagram; (3) `project-inception.md` bootstrap master-flow diagram; (4) `project-inception.md` Phase 0 intake/material-scan flow; (5) `project-inception.md` Phases 5–7 shared back-half flow. This is a review/normalization activity, not a redesign of the existing fences beyond minor consistency tweaks if needed.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Newcomer orientation (primary):
  Opens README → sees compact process map + link legend →
  clicks a process of interest → lands in that process guide →
  sees its near-the-top diagram → scans the process →
  follows back-link to the processes map → explores a related process.

Flow 2 — Meeting reference:
  Team is discussing "how does ADOS handle decisions?" →
  someone shares doc/guides/ados-processes.md → master diagram is the shared reference point →
  card for decision-making links to the detailed guide → its D0–D14 / R0–R3 diagram grounds the discussion.

Flow 3 — Onboarding path selection:
  New adopter opens onboarding-existing-project.md →
  sees the setup flow diagram (ADOS → prerequisites → automated vs manual → mandatory artifacts → first change) →
  picks a path without reading the full prose first.

Flow 4 — Cross-process traversal:
  Reader in change-lifecycle.md wonders where doc reconciliation fits →
  back-link to processes map → sees documentation reconciliation is a supporting process embedded in delivery →
  returns to change-lifecycle with the relationship clear.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

1. **Create** `doc/guides/ados-processes.md` — the canonical processes-map guide with: a master Mermaid diagram of all six processes and their relationships; one overview card per process (problem solved, audience, primary output, link to detailed guide); and a scannable, easy-to-read structure.
2. **Add** a compact Mermaid process map near the top of `README.md`, with an adjacent markdown link legend providing one-click access to each guide (DEC-1).
3. **Add** a near-the-top Mermaid diagram to `doc/guides/meeting-preparation-and-summarization.md`, `doc/guides/decision-making.md`, and `doc/guides/onboarding-existing-project.md`.
4. **Cross-navigation**: add a back-link to `doc/guides/ados-processes.md` from every process guide (all five), forward links from the processes map to each guide, and a prominent link to the processes map in `doc/00-index.md`.
5. **Consistency review** of all process diagrams — the two guides with diagrams (5 Mermaid fences total) plus the new ones — for stylistic coherence.

### 7.2 Out of Scope

- [OUT] Any change to agent definitions, command definitions, skills, or process logic.
- [OUT] Rendered image assets (PNG/SVG) anywhere. Mermaid only.
- [OUT] Redesigning the existing change-lifecycle or project-inception diagrams beyond minor consistency tweaks identified in the F-5 review.
- [OUT] Restructuring existing guide prose/content beyond inserting diagrams and navigation links.
- [OUT] Creating `doc/spec/features/**` specs for documentation processes.
- [OUT] Interactive/clickable Mermaid nodes (infeasible on GitHub — see DEC-1).
- [OUT] README hero rework, badges, "who is this for" section, or other adoption improvements beyond the compact process map + link legend.

### 7.3 Deferred / Maybe-Later

- **README adoption-funnel improvements** (badges, "who is this for" hero rework, social proof) — research surfaced these as furthering the adoption goal, but they have no AC here and expanding risks scope creep. Surfaced as a follow-up suggestion to the human, not invented scope.
- **A rendered PNG/SVG hero for maximum rendering reliability** — research recommended this, but the ticket's Non-goals forbid rendered image assets. Revisit only if the Mermaid-only constraint is lifted.
- **Per-process detail diagrams** beyond the near-the-top overview (e.g., deeper sub-flows) — future enhancement once the overview diagrams land.
- **Localization / multi-language diagrams** — not requested.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — documentation-only change. No HTTP endpoints added or modified.

### 8.2 Events / Messages

N/A — documentation-only change. No events or messages.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | New guide document | `doc/guides/ados-processes.md` is a new redistributable document under the scanned distribution set. It must carry a valid `ados_distribution: redistributable` marker (its absence/invalidity fails the doc-distribution test — see NFR-5). |

No structured-data schema changes. No migration.

### 8.4 External Integrations

| Integration | Constraint |
|-------------|-----------|
| GitHub Mermaid renderer (pinned version) | Diagrams must render on GitHub's sandboxed Mermaid iframe. Two hard constraints follow: (1) **node click-callbacks (`<click>` directives) and `<a>` links inside node labels do not work reliably** — navigation must use adjacent markdown link legends; (2) **syntax must stay conservative** — avoid bleeding-edge directives that GitHub's pinned Mermaid version may not render (see NFR-1). |
| Mobile GitHub rendering | Large diagrams can overflow on mobile viewports; the README compact map must stay compact and the master map must not break page layout destructively (see NFR-2, NFR-3). |

### 8.5 Backward Compatibility

- Existing guide navigation and inbound links must keep working; this change only **adds** diagrams and links, it does not rename or move existing anchors/sections.
- The three modified guides keep their existing front matter, license headers, and content; diagrams and links are inserted, prose is not restructured.
- `doc/00-index.md` and `README.md` retain their existing license headers and structure; only the process-map diagram/link block and an index entry are added.
- `doc/00-index.md` is currently `redistributable` and stays so; the new entry must not drop or alter the marker.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Mermaid syntax renders on GitHub | 100% of new/modified diagrams render without error on github.com desktop; only conservative, widely-supported Mermaid syntax is used (no directives outside GitHub's pinned Mermaid version) |
| NFR-2 | README compact map fits one screen-width | At GitHub desktop viewport (~1280px) the compact diagram produces no horizontal scrollbar |
| NFR-3 | Mobile rendering does not break layout | All diagrams render (not blank/error) on GitHub mobile; vertical scroll acceptable, destructive horizontal overflow avoided (master map split if needed) |
| NFR-4 | License headers on redistributable docs | Every new/modified redistributable doc retains/obtains a license header — the new `doc/guides/ados-processes.md` obtains one; the three modified guides and `doc/00-index.md` keep theirs |
| NFR-5 | doc-distribution guard passes | `bash scripts/.tests/test-doc-distribution.sh` exits 0 (new guide carries `ados_distribution: redistributable`; existing markers preserved; install set does not drift) |
| NFR-6 | Diagram consistency | All process diagrams share consistent node-naming, color, subgraph, multiline-label, and feedback-loop conventions (F-5 review completed) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — documentation-only change. No metrics, logs, traces, or alerts.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | GitHub Mermaid sandbox blocks node click-callbacks and in-label links, breaking the "clickable links to guides" AC if attempted via clickable nodes | M | H | Use an adjacent markdown link legend/table under the diagram for one-click access (DEC-1); do not rely on `<click>`/`<a>` in nodes | L |
| RSK-2 | Master process-map diagram overflows on mobile, harming the newcomer experience | M | M | Keep the diagram structured for readability; split into per-process subgraphs; verify mobile render (NFR-3) | L |
| RSK-3 | New `ados-processes.md` is missing/invalid `ados_distribution` marker, failing the doc-distribution test and causing install-set drift | M | M | Mark it `redistributable` on creation; run `bash scripts/.tests/test-doc-distribution.sh` before merge (NFR-5, AC-NFR5-1) | L |
| RSK-4 | Bleeding-edge Mermaid directives do not render on GitHub's pinned version, producing blank boxes | M | M | Use conservative syntax only; visually verify each diagram on github.com; match the syntax style of the two existing rendering diagrams (across the 5 existing fences — NFR-1) | L |
| RSK-5 | Modifying shared files (README.md, doc/00-index.md, three guides) introduces link rot or breaks existing anchors | L | M | Only add diagrams and links; do not rename/move existing sections; preserve existing license headers and markers; verify all links resolve | L |
| RSK-6 | Scope creep into README adoption-funnel work (badges, hero rework) | L | M | Scope is bounded to the 12 AC; broader improvements explicitly deferred (NG-5, §7.3) | L |

## 12. ASSUMPTIONS

- The six-process inventory (inception, onboarding, change delivery, meetings, decisions, documentation reconciliation-as-supporting) is the correct and complete process surface of ADOS today.
- Documentation reconciliation is best represented as a **supporting process embedded in change delivery** (via `@doc-syncer` / `/sync-docs`), not as a standalone primary process.
- The two guides with diagrams (5 Mermaid fences total — `change-lifecycle.md` ×1, `project-inception.md` ×4) render correctly today and define the de-facto style conventions to match.
- GitHub's Mermaid sandbox behavior (no reliable node-click) is stable for the foreseeable future.
- `README.md` is **not** in the doc-distribution scan set (only `doc/guides`, `doc/templates`, and a fixed standalone list including `doc/00-index.md`), so README changes carry no distribution-marker constraint — but README must keep its existing license header.
- `doc/00-index.md` **is** in the scan set and is currently `redistributable`; it must stay so.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | `doc/guides/change-lifecycle.md` existing diagram + style | Style reference (flowchart TD, subgraphs, `<br/>`, dashed feedback, Legend) for consistency (F-5) |
| Depends on | `doc/guides/project-inception.md` existing diagram + style | Style reference (flowchart TB, quoted labels, color fills, convergence diamonds) for consistency (F-5) |
| Depends on | `doc/guides/meeting-preparation-and-summarization.md`, `decision-making.md`, `onboarding-existing-project.md` content | Diagrams visualize each guide's documented process (before/during/after; D0–D14 + R0–R3; setup flow) |
| Depends on | `scripts/.tests/test-doc-distribution.sh` | Validates the new guide's `ados_distribution` marker and install-set integrity (NFR-5) |
| Depends on | GitHub Mermaid renderer (pinned) | External rendering surface; constrains syntax and navigation (NFR-1, DEC-1) |
| Blocks | None | Documentation-only; does not block any other change |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | (none) | All decisions were resolved during `clarify_scope` and are recorded in §15 (DEC-1…DEC-3). No blocking open questions remain. | Resolved |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | README "clickable links to guides" is satisfied via an **adjacent markdown link table/legend immediately under the Mermaid diagram** — nodes themselves are not clickable. | GitHub renders Mermaid inside a sandboxed iframe; node click-callbacks (`<click>` directives) and `<a>` links inside node labels do **not** work reliably. An adjacent "Guides:" link block is the GitHub-native way to give one-click access to each guide. | 2026-06-28 |
| DEC-2 | **Mermaid-only throughout — no PNG/SVG**, even though research recommended a rendered PNG hero for maximum rendering reliability. | The ticket's Non-goals explicitly forbid rendered image assets. The human constraint wins. | 2026-06-28 |
| DEC-3 | The new canonical guide is named **`doc/guides/ados-processes.md`**. | Per ticket scope #1; the issue's explicit name is authoritative (research informally suggested `process-map.md`, but the issue name wins). | 2026-06-28 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/guides/ados-processes.md` | New — canonical processes-map guide |
| `README.md` | Updated — compact process map + link legend near the top |
| `doc/00-index.md` | Updated — prominent link to processes map; marker preserved |
| `doc/guides/meeting-preparation-and-summarization.md` | Updated — near-the-top Mermaid diagram + back-link |
| `doc/guides/decision-making.md` | Updated — near-the-top Mermaid diagram (D0–D14 + R0–R3) + back-link |
| `doc/guides/onboarding-existing-project.md` | Updated — near-the-top setup-flow Mermaid diagram + back-link |
| `doc/guides/change-lifecycle.md` | Updated — back-link added; consistency review (minor tweaks if needed) |
| `doc/guides/project-inception.md` | Updated — back-link added; consistency review (minor tweaks if needed) |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the change is delivered, **when** a reader opens `doc/guides/ados-processes.md`, **then** the file exists and its front matter declares `ados_distribution: redistributable`. | F-1, NFR-5 |
| AC-F1-2 | **Given** `doc/guides/ados-processes.md`, **when** a reader views the master diagram, **then** all six processes (inception, onboarding, change delivery, meeting management, decision making, documentation reconciliation as supporting) appear as nodes with their cross-process relationships visible. | F-1 |
| AC-F1-3 | **Given** `doc/guides/ados-processes.md`, **when** a reader scans the guide, **then** there is one overview card per process capturing: problem solved, audience, primary output, and a link to the detailed guide. | F-1 |
| AC-F1-4 | **Given** `doc/guides/ados-processes.md`, **when** a reader opens it, **then** the structure is scannable (clear sections, cards/tables, short prose) — not a wall of text. | F-1, NFR-2 |
| AC-F2-1 | **Given** `README.md`, **when** a newcomer opens the repo landing page near the top, **then** a compact Mermaid process map is present and an adjacent markdown link legend provides one-click access to each process guide (nodes are not clickable per DEC-1). | F-2, DEC-1 |
| AC-F3-1 | **Given** `doc/guides/meeting-preparation-and-summarization.md`, **when** a reader opens it, **then** a Mermaid diagram (before/during/after lifecycle) appears near the top. | F-3 |
| AC-F3-2 | **Given** `doc/guides/decision-making.md`, **when** a reader opens it, **then** a Mermaid diagram (D0–D14 kernel overview and/or R0–R3 rigor routing) appears near the top. | F-3 |
| AC-F3-3 | **Given** `doc/guides/onboarding-existing-project.md`, **when** a reader opens it, **then** a Mermaid setup-flow diagram appears near the top. | F-3 |
| AC-F4-1 | **Given** any process guide (inception, onboarding, change-lifecycle, meeting-prep, decision-making), **when** a reader looks for an overview, **then** a back-link to `doc/guides/ados-processes.md` is present. | F-4 |
| AC-F4-2 | **Given** `doc/00-index.md`, **when** a reader browses the documentation landing page, **then** a link to `doc/guides/ados-processes.md` appears in a prominent position (near the "Start Here" surface). | F-4 |
| AC-F5-1 | **Given** all process diagrams — the two guides with diagrams (5 existing Mermaid fences: change-lifecycle ×1, project-inception ×4) plus the new diagrams added by F-1/F-2/F-3 — **when** the consistency review (F-5) is complete, **then** they share consistent node-naming, color, subgraph, multiline-label, and feedback-loop conventions. | F-5, NFR-6 |
| AC-NFR4-1 | **Given** all new/modified redistributable docs, **when** the license-header convention is checked, **then** every one (new `ados-processes.md`; modified guides; `doc/00-index.md`; and `README.md` whose pre-existing header is preserved) carries a license header. | NFR-4 |
| AC-NFR5-1 | **Given** the doc-distribution guard, **when** `bash scripts/.tests/test-doc-distribution.sh` runs, **then** it exits 0 (new guide marked redistributable, no install-set drift). | NFR-5 |

> **Canonical AC scheme.** This AC table is the canonical source of truth (13 IDs mapping to the 12 ticket items — the README map + one-click links are folded into AC-F2-1, and diagram consistency is its own AC-F5-1). The implementation plan and test plan remap to these IDs 1:1.

> **Definition of Done**: all AC-F* and AC-NFR* criteria above are satisfied, all plan tasks are complete, and the change passes `/review` and `/check` (quality gates).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery order**: (1) create `ados-processes.md` with master diagram + cards; (2) add the three per-guide diagrams; (3) add the README compact map + link legend; (4) weave the navigation mesh (back-links, forward links, index entry); (5) run the consistency review and apply minor tweaks; (6) run the doc-distribution test and quality gates.
- **Merge strategy**: single PR on `docs/GH-85/ados-process-map-diagrams`; docs-only, low-risk, no feature flags.
- **Verification**: visually confirm each diagram renders on github.com (desktop + mobile) before merge; run `bash scripts/.tests/test-doc-distribution.sh`.
- **Communication**: PR description links the processes map as the new canonical entry point; no deprecation notices (purely additive).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — documentation-only change. No data migration or seeding.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — documentation-only change. No personal data, PII, or compliance-relevant content introduced.

## 21. SECURITY REVIEW HIGHLIGHTS

N/A — documentation-only change. No code, secrets, credentials, or attack surface introduced. Diagrams and links reference only in-repo and in-org paths.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Low ongoing cost.** Diagrams are Markdown/Mermaid text in tracked files; updated via the normal change workflow (the system dogfoods itself).
- **Drift risk**: if a process changes (e.g., a phase is added to the change lifecycle), its diagram must be updated in the same change. The F-5 consistency conventions lower the cost of keeping diagrams aligned.
- **Doc-distribution**: the new guide is `redistributable` and installs into consumer repos; future changes to it must keep the marker valid or the doc-distribution test fails.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| ADOS | Agentic Delivery OS — the spec-driven, agent-based delivery system in this repo. |
| AHA moment | The point at which a newcomer grasps what ADOS does and why it is valuable. |
| Mermaid | A Markdown-embedded diagramming language rendered by GitHub (and others) from fenced ` ```mermaid ` blocks. |
| Process map | A single diagram showing all ADOS processes and how they relate. |
| Back-link | A link from a process guide back to the canonical processes-map guide. |
| `ados_distribution` | A front-matter marker declaring a doc's distribution class (`redistributable` / `internal` / `project-generated`), consumed by the install script and doc-distribution test. |
| Redistributable | A doc that installs into consumer repos during ADOS onboarding. |
| Supporting process | A process that is real and named but embedded inside another primary process (e.g., documentation reconciliation inside change delivery). |

## 24. APPENDICES

### Appendix A — Existing diagram style conventions (F-5 reference)

ADOS ships **two guides with diagrams (5 Mermaid fences total)**, not "two diagrams". The F-5 consistency-review scope covers **all 5 existing fences** plus the new diagrams added by F-1/F-2/F-3:

| # | Guide (file) | Fence / diagram | Direction | Conventions |
|---|--------------|-----------------|-----------|-------------|
| 1 | `change-lifecycle.md` | Lifecycle diagram | `flowchart TD` | Subgraphs per stage; `<br/>` for multiline node labels; dashed `-.->` arrows for feedback loops; a "Legend" block after the diagram. |
| 2 | `project-inception.md` | Track A/B convergence diagram | `flowchart TB` | Quoted node labels; `style ... fill:#...` color fills; convergence diamonds `{" "}`. |
| 3 | `project-inception.md` | Bootstrap master-flow diagram (all phases + gates + readiness-check loop) | `flowchart TD` | Subgraphs per phase; multiline labels; feedback loops. |
| 4 | `project-inception.md` | Phase 0 intake/material-scan flow | `flowchart LR` | Sub-flow style; quoted labels. |
| 5 | `project-inception.md` | Phases 5–7 shared back-half flow | `flowchart LR` | `subgraph` grouping shared phases. |

New diagrams should be stylistically consistent with these (node naming, color usage, subgraph conventions, multiline-label style, feedback-loop notation). The F-5 review normalizes all 5 existing fences (minor tweaks only) plus the new fences into one coherent family — it does not redesign them.

### Appendix B — Diagram design principles (research-grounded, informs HOW diagrams look — not new scope)

- **Master process map**: left-to-right flow where natural; show each process as a node with its primary output visible; show cross-process relationships (inception feeds delivery; decisions arise during inception and delivery; meetings produce decisions/action items; onboarding is the brownfield counterpart of inception; documentation reconciliation is embedded in change delivery).
- **README compact map**: keep to one screen-width; color-code by stage if helpful; agent ownership can be omitted in README (kept compact) — it already appears in the detailed change-lifecycle diagram.
- **meeting-prep**: a before / during / after lifecycle diagram.
- **decision-making**: a D0–D14 decision-kernel overview + R0–R3 rigor-routing diagram (the guide already documents these in tables — visualize them).
- **onboarding-existing-project**: a setup flow (getting ADOS → prerequisites → choose path [automated bootstrap vs manual] → mandatory artifacts → first change).
- **Syntax**: keep Mermaid conservative/widely-supported; avoid bleeding-edge directives GitHub's pinned version may not render.
- **Decision-diagram render-risk (highest risk)**: the decision-making diagram (D0–D14 kernel + R0–R3 routing) is the **highest render-risk** diagram on GitHub's pinned Mermaid, because it packs the most nodes/edges and uses punctuation-heavy labels. Constrain it to **≤2 subgraphs** and use **conservative syntax**: quote every label containing an en-dash or slash (e.g., `"D0–D14"`, `"R0–R3"`, `"Trigger/Triage"`) so the parser does not choke on the dash/slash. Verify its render on github.com before merge.
- **Accessibility (WCAG 1.4.1 — use of color)**: diagrams must **not rely on color alone** to convey meaning. Every diagram carries a **Legend**, and red/green nodes (fail/remediation vs success) must also carry a **text cue** (e.g., the node label itself, such as `"FAIL"`/`"OK"`) so color-blind readers are not lost.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-28 | `@spec-writer` | Initial specification — authored from GH-85 ticket + `chg-GH-85-pm-notes.yaml` (clarify_scope decisions) + existing guide/research context. |
| 1.1 | 2026-06-28 | `@spec-writer` | Red-team Round 1 surgical remediation (SHIP-WITH-FINDINGS): n3 — corrected "two existing diagrams" to "two guides with diagrams (5 Mermaid fences total)" and enumerated all 5 fences in F-5/Appendix A (m2); added canonical-AC-scheme note under §17 table; m6 — added decision-diagram render-risk principle (≤2 subgraphs, quote en-dash/slash labels) in Appendix B; added WCAG 1.4.1 accessibility principle (no color alone, Legend + text cues) in Appendix B. No scope/non-goal/DEC changes; AC scheme unchanged. |

---

## AUTHORING GUIDELINES

- **Sources**: GH-85 issue body (provided in the delegation prompt); `doc/changes/2026-06/2026-06-28--GH-85--ados-process-map-diagrams/chg-GH-85-pm-notes.yaml` (full problem, decisions, scope analysis, open-questions=[]); the change-spec template at `doc/templates/change-spec-template.md`; existing guides `change-lifecycle.md` and `project-inception.md` (diagram style + content for consistency); `README.md` and `doc/00-index.md` (current landing surfaces); the three diagram-less guides for their documented processes.
- **PM decisions encoded, not re-opened**: the three decisions in §15 (DEC-1 clickable-via-adjacent-legend; DEC-2 Mermaid-only; DEC-3 guide name) were resolved during `clarify_scope` and are recorded as decisions, not open questions, per the delegation instruction.
- **Scope discipline**: research surfaced broader README/adoption work (badges, hero rework) that would further the adoption goal; these are explicitly deferred (§7.3, NG-5) rather than invented into scope, because they have no AC and expanding risks creep.
- **Tech-neutral**: no implementation tasks, file-level code edits, or step-by-step build instructions; concrete deliverable files appear only at the capability/scope level to make AC testable.
- **No license header / no `ados_distribution` marker** on this spec file — it is a change artifact under `doc/changes/`, which receives neither (the deliverable guide it describes, however, must carry both — see AC-NFR4-1, AC-NFR5-1).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-85)
- [x] `owners` has at least one entry (`@juliusz-cwiakalski`)
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values (render %, screen-width, exit-0, header presence)
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (existing diagram styles summarized as reference, not copied)
- [x] Front matter validates per front_matter_rules
