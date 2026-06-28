---
id: chg-GH-85-ados-process-map-diagrams
status: Proposed
created: 2026-06-28T10:31:00Z
last_updated: 2026-06-28T10:31:00Z
owners: ["engineering"]
service: docs
labels: [docs, developer-experience, mermaid, navigation, documentation]
links:
  change_spec: ./chg-GH-85-spec.md
  change_test_plan: ./chg-GH-85-test-plan.md
  change_pm_notes: ./chg-GH-85-pm-notes.yaml
summary: >
  Docs-only change to reduce the time-to-"AHA" moment for ADOS adopters: create a
  canonical process map (doc/guides/ados-processes.md) with a master Mermaid
  diagram of the 6 ADOS processes, add compact Mermaid diagrams near the top of
  README.md and the three process guides that currently lack them, wire
  cross-navigation between every process guide, surface the map in doc/00-index.md,
  and align all diagrams on a single consistent convention set. Mermaid only; no
  agent/command changes; no rendered image assets.
version_impact: >
  Docs-only. No code, no agent/command definitions, no install set behavior change,
  no package version bump. Only Markdown under doc/, README.md, and doc/00-index.md
  are touched. Per-repo convention: no version bump for documentation-only changes.
---

# IMPLEMENTATION PLAN — GH-85: ADOS processes map + per-guide diagrams

> **Scope class:** Documentation-only. The implementing agent (`@coder`) edits Markdown files exclusively. No source code, no `.opencode/agent/**` or `.opencode/command/**` changes, no `scripts/**`, no `tools/**`.

> **Branch:** `docs/GH-85/ados-process-map-diagrams` (already created and checked out, based on `origin/main` `1e2e7ff`). Do **not** create or switch branches during this plan.

## Context and Goals

ADOS exposes six first-class **processes** (reusable, repeatable ways of working), but today a new visitor has to read several long guides before the whole picture clicks. Three of the five process guides have no diagram at all; README has a hero image but no process-map Mermaid; and the relationships between processes (inception vs. onboarding as alternative entry points; decision-making and meetings as cross-cutting supporters; documentation reconciliation embedded inside the change lifecycle) are not visualized anywhere. This change fixes that by adding one canonical process map and per-guide diagrams so a reader gets the AHA moment in seconds.

This plan delivers:

1. A new canonical guide, `doc/guides/ados-processes.md`, containing the master Mermaid process map, one card per process, the cross-process relationship narrative, and a "how to use this map" note.
2. Compact Mermaid process map + an adjacent clickable link table near the top of `README.md`.
3. A Mermaid diagram near the top of each of the three guides that currently lack one: meeting preparation, decision-making, onboarding.
4. Cross-navigation (back-link to the canonical map from every process guide, plus forward links where the relationship is non-obvious).
5. A prominent entry to the canonical map from `doc/00-index.md`.
6. A consistency review so the new and existing diagrams share one convention set, plus the mandatory doc-distribution quality gate green.

The plan is derived from the GitHub issue #85 scope and `chg-GH-85-pm-notes.yaml`. The change spec (`chg-GH-85-spec.md`) and test plan (`chg-GH-85-test-plan.md`) are being authored in parallel; the 12 acceptance criteria below are extracted from the issue scope and governance constraints and are the authoritative DoD for this plan.

**Resolved decisions (from `chg-GH-85-pm-notes.yaml`):**

- README "clickable links to guides" requirement is satisfied by an **adjacent markdown link table** directly under the diagram. GitHub's Mermaid iframe sandbox blocks node click-callbacks (`<click>` and `<a>` in node labels do not render reliably), so node-clickability is not achievable on GitHub. An adjacent link block is the GitHub-native way to give one-click access.
- **Mermaid only.** A rendered PNG/SVG hero was considered for max rendering reliability but is explicitly forbidden by the issue's non-goals. No image assets are produced.
- Scope is held tightly to the issue AC. Broader README improvements surfaced by research (badges, "who is this for", hero rework) are out of scope here.
- The canonical guide is named `doc/guides/ados-processes.md` per the issue (authoritative), not the informally-suggested `process-map.md`.

**The six ADOS processes (the map's domain):**

| # | Process | Standalone guide | Role |
|---|---------|------------------|------|
| 1 | Project Inception | `doc/guides/project-inception.md` | 8-phase setup that builds the knowledge base for new/serious projects |
| 2 | Onboarding an Existing Project | `doc/guides/onboarding-existing-project.md` | Lighter entry point: install ADOS into an existing repo |
| 3 | Change Lifecycle | `doc/guides/change-lifecycle.md` | The steady-state 11-phase delivery loop |
| 4 | Documentation Reconciliation | (embedded in change-lifecycle, phase 7 `system_spec_update`) | Keeps `doc/spec/**` current truth — no standalone guide |
| 5 | Decision-Making | `doc/guides/decision-making.md` | Cross-cutting: D0–D14 kernel, R0–R3 rigor routing |
| 6 | Meeting Preparation & Summarization | `doc/guides/meeting-preparation-and-summarization.md` | Cross-cutting: evidence capture that feeds decisions |

**Open questions:** None blocking. (If the parallel spec assigns slightly different AC numbering, treat the AC intents below as authoritative and remap identifiers 1:1.)

## Scope

### In Scope

- **F-1** New `doc/guides/ados-processes.md` (canonical process map): frontmatter (copyright header via script + `ados_distribution: redistributable` + `id`/`status`/`owners`/`summary` like sibling guides), intro, master Mermaid diagram of all 6 processes + their relationships, per-process cards (problem / audience / output / link) for all 6, cross-process relationships narrative, "how to use this map" note.
- **F-2** Compact Mermaid process map added near the top of `README.md`, replacing/supplementing the plain-text pipeline line; existing hero image + header preserved.
- **F-3** Adjacent markdown link table immediately under the README diagram (GitHub-native one-click access, since Mermaid click-callbacks are unreliable on GitHub).
- **F-4** Mermaid diagram added near the top of `doc/guides/meeting-preparation-and-summarization.md` (before → during → after lifecycle).
- **F-5** Mermaid diagram added near the top of `doc/guides/decision-making.md` (D0–D14 kernel + R0–R3 routing).
- **F-6** Mermaid diagram added near the top of `doc/guides/onboarding-existing-project.md` (setup flow: getting ADOS → prerequisites → choose path → mandatory artifacts → first change).
- **F-7** Cross-navigation: back-link to `ados-processes.md` near the top of every process guide (inception, onboarding, change-lifecycle, meeting-prep, decision-making) + forward links where the relationship is non-obvious.
- **F-8** Prominent link to `ados-processes.md` in `doc/00-index.md` (Start Here or a new Processes row near the top).
- **F-9** Consistency review + alignment of all diagrams (new and existing) on a single convention set.

### Out of Scope

- Any change to `.opencode/agent/**`, `.opencode/command/**`, `.ados-claude/**`, `scripts/**`, `tools/**`, or `.ai/**`.
- Rendered image assets (PNG/SVG/WebP) — Mermaid only (issue non-goal).
- New `doc/spec/features/**` feature specs (process maps are guide-level documentation, not behavior specs).
- README rework beyond the process map + link table (badges, "who is this for", hero redesign) — surfaced as a follow-up suggestion, not invented scope.
- Content rewrites of the existing guides (only insert diagram + navigation links; do not restructure bodies).
- Localization/translation.

### Constraints

- **Mermaid syntax must be conservative and widely supported.** GitHub pins a specific Mermaid version; bleeding-edge directives (`%%{init}%%` theme overrides, exotic shapes, `click` callbacks) silently fail to render. Stay within: `flowchart TD|TB|LR`, `subgraph`, standard node shapes (`[ ]`, `( )`, `{ }`, `[( )]`, `([ ])`), `<br/>` line breaks, quoted labels, `style <id> fill:#hex,color:#fff`, and solid (`-->`) / dashed (`-.->`) arrows.
- **License headers are managed by script, never hand-written** (per `AGENTS.md`). The new `doc/guides/ados-processes.md` header is added via `scripts/add-header-location.sh doc/guides`. Existing headers in modified files are preserved verbatim.
- **`ados_distribution` markers are mandatory** for every new/changed guide and for `doc/00-index.md`: `ados_distribution: redistributable` inside the existing `---` frontmatter block (never a new block). README has no `ados_distribution` marker today (it is not a `doc/` doc); do not add one there.
- **Docs-only delivery.** No build/test/lint of source code applies; the quality gate is the doc-distribution drift guard plus the repo's other shell test scripts (must stay green — no regressions).
- **Branch is fixed.** All work lands on `docs/GH-85/ados-process-map-diagrams`. Do not branch or switch.

### Risks

- **RSK-1: Mermaid renders locally but not on GitHub.** Different Mermaid versions; some syntax that renders in editors fails on GitHub's pinned version. *Mitigated by:* Phase 8 consistency review explicitly limits syntax to the conservative subset; prefer only constructs already proven in `change-lifecycle.md` and `project-inception.md`.
- **RSK-2: Diagram overload / diagram wider than one screen.** The master map with 6 processes + relationships can sprawl. *Mitigated by:* keep the master map to a single left-to-right pipeline at one screen-width; push per-process detail into the cards (text), not the diagram.
- **RSK-3: Drift between the master map's process list and the actual guides.** *Mitigated by:* the master map and the card table both enumerate exactly the 6 processes listed in Context; Phase 8 cross-checks card links resolve to real files.
- **RSK-4: Breaking the doc-distribution gate.** A new redistributable guide absent from the install set, or a dropped marker, fails `test-doc-distribution.sh`. *Mitigated by:* Phase 9 runs the header script + verifies markers; Phase 10 runs the gate and fixes drift until green.
- **RSK-5: Accidental content edits to guide bodies.** *Mitigated by:* each phase scope is explicitly "insert diagram/navigation only"; review checklist verifies no body restructuring.

### Success Metrics

- Every process guide and README opens with a Mermaid diagram reachable without scrolling past prose.
- A first-time visitor can identify all 6 ADOS processes and their relationships from the master map alone.
- All diagrams share one visible convention set (direction, color meaning, arrow meaning).
- `bash scripts/.tests/test-doc-distribution.sh` exits 0; all other repo test scripts remain green.
- All 12 acceptance criteria satisfied (see Definition of Done).

## Mermaid convention set (shared across all phases)

> Every diagram authored in this plan MUST conform to this set. It is derived by reconciling the two existing in-repo diagram styles (`change-lifecycle.md` and `project-inception.md`) so the result is consistent.

| Aspect | Convention |
|--------|-----------|
| Direction | `flowchart TD` (or `TB`) for vertical lifecycles; `flowchart LR` for pipelines / horizontal flows. |
| Labels | Quote any label with spaces, punctuation, or multiple lines: `N["label text"]`. Use `<br/>` for line breaks inside a label. |
| Subgraphs | `subgraph "Quoted Title" ... end` to group phases/tracks; one concept per subgraph. |
| Arrows | Solid `-->` = normal forward flow. Dashed `-.->` = feedback / reopening / optional / evidence-feed loops only. |
| Color palette (consistent meaning) | Green `#4CAF50` = entry / success / start. Blue `#2196F3` = default process / steady-state. Orange `#FF9800` = gate / decision / attention. Red `#F44336` = remediation / fail / reopen. Purple `#9C27B0` = conditional / optional / cross-cutting. Always pair `fill:#hex,color:#fff`. |
| Decision nodes | Diamond `{ "Quoted question?" }` for gates/routing. |
| Legend / caption | Every diagram followed by a short `**Legend**:` bullet list or a one-line caption explaining color/arrow meaning. |
| Forbidden | No `click` callbacks, no `<a>` inside node labels, no `%%{init}%%` theme overrides, no exotic node shapes, no HTML beyond `<br/>`. |

## Phases

### Phase 1: Create the canonical process map (`doc/guides/ados-processes.md`)

**Goal**: Establish the single source of truth that every other diagram and navigation link points at.

**Tasks**:

- [ ] **1.1** Create `doc/guides/ados-processes.md` with a YAML frontmatter block matching sibling guides: `# Copyright ...` header lines, `source:` line, `ados_distribution: redistributable`, plus `id: GUIDE-ADOS-PROCESSES`, `status: Draft`, `created: 2026-06-28`, `owners: ["engineering"]`, and a one-line `summary`. (Do NOT hand-write the copyright header — run the script in Phase 9; here just reserve the frontmatter block so the script can populate the header lines. If authoring before Phase 9, write the header block exactly as siblings do and let Phase 9 verify/idempotently normalize.)
- [ ] **1.2** Write a 2–3 sentence intro stating the page is the canonical map of ADOS's six processes and that each process links to its detailed guide.
- [ ] **1.3** Author the **master Mermaid diagram**: a `flowchart LR` pipeline showing all 6 processes as nodes + their relationships (inception & onboarding as alternative setup entry points → change lifecycle as steady-state loop → documentation reconciliation embedded in the lifecycle → decision-making and meetings as cross-cutting supporters). Keep it to one screen-width. Apply the shared convention set. Add a `**Legend**:` block beneath explaining color/arrow meaning.
- [ ] **1.4** Add the **per-process card table** with one row per process (all 6, including documentation reconciliation which has no standalone guide): columns = Process | Problem it solves | Audience | Primary output | Guide link. Card text must be derived from each guide's actual purpose statement (do not invent).
- [ ] **1.5** Write the **cross-process relationships narrative**: explain (a) inception vs. onboarding as alternative entry points; (b) the change lifecycle as the steady-state loop that consumes setup outputs; (c) decision-making + meetings as cross-cutting supporters invoked from within the lifecycle and from inception; (d) documentation reconciliation as phase 7 of the lifecycle, not a standalone process. Reference the master diagram.
- [ ] **1.6** Add a **"How to use this map"** note: new project → start at inception; existing repo → start at onboarding; day-to-day → change lifecycle; any time a hard choice arises → decision-making; any time people meet → meeting guide.
- [ ] **1.7** Verify every guide link in the cards and narrative resolves to a real file (`project-inception.md`, `onboarding-existing-project.md`, `change-lifecycle.md`, `decision-making.md`, `meeting-preparation-and-summarization.md`).

**Acceptance Criteria**:

- Must: AC-1 (file + frontmatter/header/marker), AC-2 (master diagram of 6 processes + relationships), AC-3 (per-process cards for all 6), AC-4 (relationships narrative + how-to-use note).
- Should: master diagram renders within one screen-width and uses only the conservative Mermaid subset.

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/ados-processes.md` (new).

**Tests**:

- Visual: master Mermaid renders (paste into a Mermaid previewer / GitHub-rendered markdown mentally against the convention set).
- Link check: every card/narrative link points to an existing file.

**Completion signal**: `docs(gh-85): add canonical ADOS process map guide`

---

### Phase 2: README process map + adjacent link table

**Goal**: Give the very first thing a visitor sees a visual of the whole system, with one-click access to each guide.

**Tasks**:

- [ ] **2.1** In `README.md`, just below the hero image block and the `# Agentic Delivery OS (ADOS)` heading, insert a compact `flowchart LR` Mermaid process map mirroring the master map (same 6-process pipeline, possibly more compact labels). Do **not** remove or alter the hero image, the `<picture>` block, or the `source:` copyright header.
- [ ] **2.2** Replace or supplement the existing plain-text pipeline line (`ticket -> spec -> plan -> ... -> release`) with the diagram; if the text line is kept, place it as the diagram caption or remove the redundancy (prefer the diagram + link table).
- [ ] **2.3** Immediately under the diagram, add an **adjacent markdown link table** giving one-click access to each process guide (Process | Guide link). This satisfies the "clickable links" requirement the GitHub-native way (Mermaid click-callbacks are unreliable on GitHub — see decision in Context).
- [ ] **2.4** Ensure the README TOC (`<!-- TOC -->` block) still regenerates correctly / is not broken by the insertion (the TOC is a known block; insert the diagram outside or around it without corrupting it).

**Acceptance Criteria**:

- Must: AC-5 (compact Mermaid process map near the top of README; hero/header preserved), AC-6 (adjacent markdown link table for one-click guide access).
- Should: README still reads cleanly on a narrow/mobile viewport (compact labels).

**Files and modules**:

- Code areas: none.
- System docs: `README.md` (updated). (README has a copyright header already — preserve it; README has no `ados_distribution` marker — do not add one.)

**Tests**:

- Visual: diagram + link table render on GitHub.
- Header preserved: the `source:` copyright block at the top of README is intact.

**Completion signal**: `docs(gh-85): add process map and guide link table to README`

---

### Phase 3: Diagram near top of meeting preparation guide

**Goal**: Give the meeting guide an at-a-glance before/during/after lifecycle.

**Tasks**:

- [ ] **3.1** In `doc/guides/meeting-preparation-and-summarization.md`, insert a Mermaid diagram near the top (immediately after the frontmatter and the `> Audience/Purpose` blockquote, before `## 1.`).
- [ ] **3.2** Diagram content: a `flowchart TD` (or `LR`) showing the three phases — **Before** (decide-if-needed → goal → agenda → roles → share), **During** (start → parking lot → real-time capture → inclusive participation), **After** (finalize summary ≤24h → send actions ≤60min → file durable decisions → review next time). Group with subgraphs; use the shared color palette (green entry, blue steps, orange for the decision-filing gate).
- [ ] **3.3** Add a one-line caption or `**Legend**:` beneath the diagram.
- [ ] **3.4** Do not restructure the guide body beyond this insertion; preserve the existing copyright header and `ados_distribution: redistributable` marker.

**Acceptance Criteria**:

- Must: AC-7 (Mermaid diagram near the top of the meeting guide showing before/during/after).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/meeting-preparation-and-summarization.md` (updated).

**Tests**:

- Visual: diagram renders; header + marker intact.

**Completion signal**: `docs(gh-85): add lifecycle diagram to meeting guide`

---

### Phase 4: Diagram near top of decision-making guide

**Goal**: Give the decision guide an at-a-glance D0–D14 kernel + R0–R3 routing view.

**Tasks**:

- [ ] **4.1** In `doc/guides/decision-making.md`, insert a Mermaid diagram near the top (after the frontmatter and the `> Audience/Purpose` blockquote, before `## 1.`).
- [ ] **4.2** Diagram content: a `flowchart TD` showing the **universal decision kernel** as a pipeline (Trigger/Triage D0 → Charter D1 → Context D2 → ... → Decision D11 → Execution D12 → Verification D13 → Retrospective D14) with an **R0–R3 rigor routing** branching at the top (R0 escape hatch → no record; R1 → lightweight brief; R2 → standard record; R3 → full record + independent reviewer + human decision). Use diamonds for the routing decision and the rigor branches; orange for gates, purple for the R0 escape hatch, red where remediation/reopen is possible.
- [ ] **4.3** Add a one-line caption or `**Legend**:` beneath the diagram.
- [ ] **4.4** Do not restructure the guide body; preserve the existing copyright header and `ados_distribution: redistributable` marker.

**Acceptance Criteria**:

- Must: AC-8 (Mermaid diagram near the top of the decision guide showing D0–D14 kernel + R0–R3 routing).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/decision-making.md` (updated).

**Tests**:

- Visual: diagram renders; kernel stages and rigor branches legible; header + marker intact.

**Completion signal**: `docs(gh-85): add decision kernel + routing diagram to decision guide`

---

### Phase 5: Diagram near top of onboarding guide

**Goal**: Give the onboarding guide an at-a-glance setup flow.

**Tasks**:

- [ ] **5.1** In `doc/guides/onboarding-existing-project.md`, insert a Mermaid diagram near the top (after the frontmatter and the `> Audience/Goal` blockquote, before the TOC or `## Getting ADOS`).
- [ ] **5.2** Diagram content: a `flowchart TD` setup flow: **Getting ADOS** (install: global curl / local / plugin) → **Prerequisites** (git repo, OpenCode, AI provider key, tracker access) → **Choose path** (diamond: automated `/bootstrap` vs. manual setup) → **Mandatory artifacts** (AGENTS.md, pm-instructions.md, documentation-handbook.md) → **First change** (the 11-phase lifecycle, linked). Use green for the start, blue for steps, orange for the path-choice diamond, green again for the "first change shipped" end.
- [ ] **5.3** Add a one-line caption or `**Legend**:` beneath the diagram.
- [ ] **5.4** Do not restructure the guide body; preserve the existing copyright header and `ados_distribution: redistributable` marker.

**Acceptance Criteria**:

- Must: AC-9 (Mermaid diagram near the top of the onboarding guide showing the setup flow).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/onboarding-existing-project.md` (updated).

**Tests**:

- Visual: diagram renders; header + marker intact.

**Completion signal**: `docs(gh-85): add setup flow diagram to onboarding guide`

---

### Phase 6: Cross-navigation between process guides

**Goal**: Make the canonical map the navigational hub and surface non-obvious cross-process links.

**Tasks**:

- [ ] **6.1** Add a **back-link to `ados-processes.md`** near the top of each process guide (a single-line `> Part of the [ADOS process map](ados-processes.md).` style blockquote, placed right after the frontmatter + audience/purpose block, before any diagram or `## ` section): `project-inception.md`, `onboarding-existing-project.md`, `change-lifecycle.md`, `meeting-preparation-and-summarization.md`, `decision-making.md`.
- [ ] **6.2** For documentation reconciliation (no standalone guide — it is embedded as phase 7 `system_spec_update` of the change lifecycle): ensure the change-lifecycle guide's phase-7 section and/or the canonical map card link clearly to that section. Do **not** create a standalone guide for it.
- [ ] **6.3** Add **forward links where the relationship is non-obvious**: e.g., decision-making guide ↔ meeting guide (meetings produce decision evidence; durable decisions route to records — already cross-linked in places, verify and keep consistent); change-lifecycle guide ↔ decision-making (decision consultation during spec/delivery); onboarding guide ↔ change-lifecycle (first change walkthrough); inception guide ↔ change-lifecycle (inception hands off to delivery). Keep these as one-line inline links, not new sections.
- [ ] **6.4** Verify no broken relative links (`ados-processes.md` resolves from each guide's directory; all are in `doc/guides/`).

**Acceptance Criteria**:

- Must: AC-10 (back-link to the canonical map from each process guide; forward links where non-obvious; documentation reconciliation handled correctly since it has no standalone guide).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/project-inception.md`, `doc/guides/onboarding-existing-project.md`, `doc/guides/change-lifecycle.md`, `doc/guides/meeting-preparation-and-summarization.md`, `doc/guides/decision-making.md` (all updated — small navigation insertions only).

**Tests**:

- Link check: `ados-processes.md` reachable from every guide; all forward links resolve.

**Completion signal**: `docs(gh-85): wire cross-navigation between process guides`

---

### Phase 7: Prominent link in `doc/00-index.md`

**Goal**: Make the canonical map discoverable from the documentation landing page.

**Tasks**:

- [ ] **7.1** In `doc/00-index.md`, add a prominent entry for `ados-processes.md`. Preferred placement: a new **"Processes"** row in the **Start Here** table (or a short "Processes" subsection immediately under Start Here) with a one-line description ("Canonical map of ADOS's six processes — start here for the big picture").
- [ ] **7.2** Ensure the relative link resolves (`guides/ados-processes.md` from `doc/00-index.md`).
- [ ] **7.3** Preserve the existing copyright header and `ados_distribution: redistributable` marker in `doc/00-index.md`.

**Acceptance Criteria**:

- Must: AC-11 (prominent link to `ados-processes.md` in `doc/00-index.md` near the top).

**Files and modules**:

- Code areas: none.
- System docs: `doc/00-index.md` (updated).

**Tests**:

- Link check: entry link resolves to the new guide; header + marker intact.

**Completion signal**: `docs(gh-85): surface process map in documentation index`

---

### Phase 8: Diagram consistency review

**Goal**: Align all diagrams (new and existing) on one convention set so the system looks unified.

**Tasks**:

- [ ] **8.1** Audit the two existing diagrams (`change-lifecycle.md` lifecycle diagram; `project-inception.md` convergence + 8-phase diagrams) against the shared convention set in this plan. Note any divergence in direction, color meaning, arrow meaning, or label style.
- [ ] **8.2** Audit all newly added diagrams (Phases 1–5) for the same.
- [ ] **8.3** Reconcile divergences with minimal edits: align colors to the shared palette meaning (green=entry/success, blue=process, orange=gate, red=remediation, purple=cross-cutting/optional); ensure dashed arrows mean feedback/optional only; ensure every diagram has a Legend or caption. Prefer adjusting the new diagrams to match where the existing ones already encode a clear convention; adjust existing ones only if a clear inconsistency exists.
- [ ] **8.4** Confirm no diagram uses forbidden syntax (click callbacks, `<a>` in labels, `%%{init}%%`, exotic shapes).
- [ ] **8.5** Confirm node naming is consistent: use the canonical process names ("Project Inception", "Onboarding", "Change Lifecycle", "Decision-Making", "Meetings", "Documentation Reconciliation") everywhere they appear across diagrams.

**Acceptance Criteria**:

- Must: AC-12 (partial — consistent node naming / color / subgraph conventions across all diagrams).

**Files and modules**:

- Code areas: none.
- System docs: any of `doc/guides/ados-processes.md`, `change-lifecycle.md`, `project-inception.md`, `meeting-preparation-and-summarization.md`, `decision-making.md`, `onboarding-existing-project.md`, `README.md` (updated only if a real inconsistency is found; otherwise no change).

**Tests**:

- Manual review: side-by-side comparison of every diagram against the convention set.

**Completion signal**: `docs(gh-85): align all process diagrams on one convention set`

---

### Phase 9: Headers + `ados_distribution` markers hygiene

**Goal**: Guarantee header and marker governance is satisfied before the quality gate runs.

**Tasks**:

- [ ] **9.1** Run `scripts/add-header-location.sh doc/guides` to add/normalize the copyright header on every guide under `doc/guides/` (this is the only sanctioned way to manage headers — never hand-write them per `AGENTS.md`). The new `doc/guides/ados-processes.md` must receive its 5-line copyright header here.
- [ ] **9.2** Verify every **new/modified guide** has `ados_distribution: redistributable` inside its existing `---` frontmatter block (not a new block): `ados-processes.md` (new), `meeting-preparation-and-summarization.md`, `decision-making.md`, `onboarding-existing-project.md`, `change-lifecycle.md`, `project-inception.md`.
- [ ] **9.3** Verify `doc/00-index.md` still has `ados_distribution: redistributable`.
- [ ] **9.4** Verify `README.md` retains its existing copyright header and is **not** given an `ados_distribution` marker (it is not a `doc/` doc; adding one would be incorrect).
- [ ] **9.5** Confirm no guide body content was accidentally altered by the header script (diff should show only header-line additions/normalization).

**Acceptance Criteria**:

- Must: AC-12 (partial — headers added via script, markers correct on all new/modified docs, README/doc-00-index headers retained).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/**` (header normalization), `README.md`, `doc/00-index.md` (verification).

**Tests**:

- Grep/visual: every in-scope guide has the copyright header + `ados_distribution: redistributable`; README header intact, no marker added.

**Completion signal**: `docs(gh-85): normalize headers and distribution markers`

---

### Phase 10: Quality gate, finalize, and release

**Goal**: Prove the change is green and complete; perform spec reconciliation and close out.

**Tasks**:

- [ ] **10.1** Run the doc-distribution drift guard: `bash scripts/.tests/test-doc-distribution.sh`. It must exit 0 (enforces `ados_distribution` marker presence, valid enum, redistributable docs are installed, no internal docs installed, derived set == sandbox install set). If it fails, fix the named condition and re-run until green.
- [ ] **10.2** Run the other repo test scripts to confirm no regressions: `bash scripts/.tests/test-add-header-location.sh`, `bash scripts/.tests/test-inception-doc-consistency.sh`, and any other `scripts/.tests/test-*.sh` / `tools/.tests/test-*.sh` that are quick and relevant (the text-to-image/zclaude suites are out of scope for a docs change but should remain green if run). Note results in the Execution Log.
- [ ] **10.3** Spec reconciliation: confirm there is no `doc/spec/features/**` feature spec to update — process maps are guide-level documentation, not behavior specs, so `doc/spec/**` is unaffected. If the `@doc-syncer` (lifecycle phase 7) flags any coverage gap, record it as advisory (coverage does not block a docs change). State explicitly: "no `doc/spec/**` reconciliation required for this change."
- [ ] **10.4** Version bump: none (docs-only; no versioned artifact per repo conventions). State explicitly: "no version bump — documentation-only change."
- [ ] **10.5** Final DoD self-check: walk all 12 acceptance criteria (Definition of Done below); confirm every checkbox in Phases 1–9 is checked; confirm the branch is `docs/GH-85/ados-process-map-diagrams`.
- [ ] **10.6** Stage only the documentation files touched by this change (the new guide + the modified guides + README + doc/00-index.md). Do not stage unrelated files.

**Acceptance Criteria**:

- Must: AC-12 (partial — `test-doc-distribution.sh` green; no regressions; no version bump; spec reconciliation handled).

**Files and modules**:

- Code areas: none.
- System docs: none beyond what Phases 1–9 produced.

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh` → exit 0.
- Other relevant `scripts/.tests/test-*.sh` → green.

**Completion signal**: `docs(gh-85): pass doc-distribution gate and finalize process map change`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | `doc/guides/ados-processes.md` exists with header + `ados_distribution: redistributable` + id/status/owners/summary | 1, 9, 10 | AC-1 |
| TS-2 | Master diagram shows all 6 processes + their relationships in one screen-width | 1, 8 | AC-2 |
| TS-3 | Card table has a row for each of the 6 processes (problem/audience/output/link); every link resolves | 1 | AC-3 |
| TS-4 | Relationships narrative + "how to use this map" note present | 1 | AC-4 |
| TS-5 | README renders a compact Mermaid process map near the top; hero image + header preserved | 2 | AC-5 |
| TS-6 | README has an adjacent markdown link table giving one-click access to each guide | 2 | AC-6 |
| TS-7 | Meeting guide opens with a before/during/after diagram | 3 | AC-7 |
| TS-8 | Decision guide opens with a D0–D14 + R0–R3 routing diagram | 4 | AC-8 |
| TS-9 | Onboarding guide opens with a setup-flow diagram | 5 | AC-9 |
| TS-10 | Every process guide has a back-link to `ados-processes.md`; non-obvious forward links present; documentation reconciliation handled (no standalone guide created) | 6 | AC-10 |
| TS-11 | `doc/00-index.md` links to `ados-processes.md` prominently near the top | 7 | AC-11 |
| TS-12 | All diagrams share one convention set; `bash scripts/.tests/test-doc-distribution.sh` exits 0; headers via script; markers correct | 8, 9, 10 | AC-12 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Canonical process map guide | `doc/guides/ados-processes.md` | New doc |
| README process map + link table | `README.md` | Updated doc |
| Meeting guide diagram | `doc/guides/meeting-preparation-and-summarization.md` | Updated doc |
| Decision guide diagram | `doc/guides/decision-making.md` | Updated doc |
| Onboarding guide diagram | `doc/guides/onboarding-existing-project.md` | Updated doc |
| Cross-navigation links | `doc/guides/{project-inception,onboarding-existing-project,change-lifecycle,meeting-preparation-and-summarization,decision-making}.md` | Updated docs |
| Documentation index entry | `doc/00-index.md` | Updated doc |
| Change specification | `./chg-GH-85-spec.md` | Spec (parallel) |
| Change test plan | `./chg-GH-85-test-plan.md` | Test plan (parallel) |
| PM notes | `./chg-GH-85-pm-notes.yaml` | Tracking |

**Style references used**: `doc/guides/change-lifecycle.md` (flowchart TD + subgraphs + `<br/>` + dashed feedback + Legend), `doc/guides/project-inception.md` (flowchart TB + quoted labels + style fills + convergence diamonds).

## Definition of Done

All 12 acceptance criteria satisfied, each mapped to the phase(s) that deliver it:

| AC | Criterion | Delivered in |
|----|-----------|--------------|
| AC-1 | `doc/guides/ados-processes.md` created with copyright header (via script) + `ados_distribution: redistributable` + `id`/`status`/`owners`/`summary` matching sibling guides | Phase 1, verified 9 |
| AC-2 | Master Mermaid diagram of all 6 ADOS processes + their relationships in the canonical guide | Phase 1 |
| AC-3 | Per-process cards (problem/audience/output/link) for all 6 processes | Phase 1 |
| AC-4 | Cross-process relationships narrative + "how to use this map" note | Phase 1 |
| AC-5 | Compact Mermaid process map added near the top of README; hero image + header preserved | Phase 2 |
| AC-6 | Adjacent markdown link table under the README diagram for one-click guide access (GitHub-native) | Phase 2 |
| AC-7 | Mermaid diagram near the top of the meeting guide (before/during/after lifecycle) | Phase 3 |
| AC-8 | Mermaid diagram near the top of the decision guide (D0–D14 kernel + R0–R3 routing) | Phase 4 |
| AC-9 | Mermaid diagram near the top of the onboarding guide (setup flow) | Phase 5 |
| AC-10 | Cross-navigation: back-link to canonical map from every process guide + forward links where non-obvious; documentation reconciliation handled (embedded, no standalone guide) | Phase 6 |
| AC-11 | Prominent link to `ados-processes.md` in `doc/00-index.md` near the top | Phase 7 |
| AC-12 | All diagrams consistent (naming/color/subgraph); `bash scripts/.tests/test-doc-distribution.sh` green; headers via script; markers correct; no regressions; spec reconciliation handled; no version bump | Phases 8, 9, 10 |

**Definition of Done = every checkbox above checked AND every AC-1..AC-12 satisfied AND `test-doc-distribution.sh` exit 0 AND all touched files committed on `docs/GH-85/ados-process-map-diagrams`.**

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-28 | plan-writer | Initial plan. Derived from GitHub issue #85 + `chg-GH-85-pm-notes.yaml`; spec and test plan authored in parallel — AC extracted from issue scope + governance constraints. 10 phased delivery tasks; 12 AC mapped to Definition of Done. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Not started | — | — | — | |
| 2 | Not started | — | — | — | |
| 3 | Not started | — | — | — | |
| 4 | Not started | — | — | — | |
| 5 | Not started | — | — | — | |
| 6 | Not started | — | — | — | |
| 7 | Not started | — | — | — | |
| 8 | Not started | — | — | — | |
| 9 | Not started | — | — | — | |
| 10 | Not started | — | — | — | |

> **Lifecycle note:** Per `chg-GH-85-pm-notes.yaml`, two red-team challenge rounds are planned — R1 on the spec/plan/test-plan artifacts pre-delivery (feeds the `dor_check` gate) and R2 on the delivered change pre-PR (feeds `review_fix`). These are orchestrated by `@pm` outside this delivery plan; any R1 findings that affect this plan are folded in as a plan revision log entry before delivery, and any R2 findings are remediated by reopening the relevant phase above.
