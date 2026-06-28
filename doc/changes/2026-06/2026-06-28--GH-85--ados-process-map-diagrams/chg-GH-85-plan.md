---
id: chg-GH-85-ados-process-map-diagrams
status: Updated
created: 2026-06-28T10:31:00Z
last_updated: 2026-06-28T11:15:00Z
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

The plan is derived from the GitHub issue #85 scope and `chg-GH-85-pm-notes.yaml`, and reconciled to the change spec (`chg-GH-85-spec.md`) and test plan (`chg-GH-85-test-plan.md`). The Definition of Done uses the **canonical AC scheme from the spec** — 13 IDs: `AC-F1-1`…`AC-F5-1`, `AC-NFR4-1`, `AC-NFR5-1` (see § Definition of Done). This plan's earlier flat `AC-1`…`AC-12` scheme has been **retired in favor of the spec's canonical IDs** (1:1 remap; see the cross-walk table in § Definition of Done).

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

**Open questions:** None blocking. (AC numbering reconciliation with the spec is complete — this plan now uses the spec's canonical `AC-F*` / `AC-NFR*` IDs 1:1; see the cross-walk table in § Definition of Done.)

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
- All 13 canonical acceptance criteria (`AC-F1-1`…`AC-F5-1`, `AC-NFR4-1`, `AC-NFR5-1`) satisfied (see Definition of Done).

## Mermaid convention set (shared across all phases)

> Every diagram authored in this plan MUST conform to this set. It is derived by reconciling the two existing in-repo diagram styles (`change-lifecycle.md` and `project-inception.md`) so the result is consistent.

| Aspect | Convention |
|--------|-----------|
| Direction | `flowchart TD` (or `TB`) for vertical lifecycles; `flowchart LR` for pipelines / horizontal flows. |
| Labels | Quote any label with spaces, punctuation, or multiple lines: `N["label text"]`. Use `<br/>` for line breaks inside a label. **Labels containing en-dashes (`–`), slashes (`/`), or spaces MUST be double-quoted** (see the **n1** callout below) or Mermaid silently fails to render. |
| Subgraphs | `subgraph "Quoted Title" ... end` to group phases/tracks; one concept per subgraph. |
| Arrows | Solid `-->` = normal forward flow. Dashed `-.->` = feedback / reopening / optional / evidence-feed loops only. |
| Color palette (consistent meaning) | Green `#4CAF50` = entry / success / start. Blue `#2196F3` = default process / steady-state. Orange `#FF9800` = gate / decision / attention. Red `#F44336` = remediation / fail / reopen. Purple `#9C27B0` = conditional / optional / cross-cutting. Always pair `fill:#hex,color:#fff`. |
| Decision nodes | Diamond `{ "Quoted question?" }` for gates/routing. |
| Legend / caption | **Mandatory:** every diagram is followed by a `**Legend**:` block explaining color/arrow meaning. Red (fail/remediation) and green (entry/success) nodes MUST also carry a **text cue** (e.g., "✗ Fail", "✓ Success") — never color alone (WCAG 1.4.1). |
| Forbidden | No `click` callbacks, no `<a>` inside node labels, no `%%{init}%%` theme overrides, no exotic node shapes, no HTML beyond `<br/>`. |

> **n1 — Quote labels with special characters (render-critical).** Mermaid's parser silently drops a node or fails to render when an unquoted label contains an en-dash (`–`), a slash (`/`), or any space. Every such label in this plan **MUST** be double-quoted — e.g. `K["D0–D14"]`, `R["R0–R3"]`, `T["Trigger/Triage D0"]`, `A["R0 / escape"]`. This is the single most common cause of a blank diagram box on GitHub; quote defensively.

> **a11y — Legend mandatory + non-color cue (WCAG 1.4.1).** Every diagram MUST carry a `**Legend**:` block. Where color encodes meaning — specifically red = fail/remediation/reopen and green = entry/success — the node label MUST also carry a text cue (e.g., `F["✗ Remediation"]`, `S["✓ Shipped"]`). Do not rely on color alone, so the diagram stays legible to color-blind readers and in high-contrast/accessibility modes.

## Phases

### Phase 1: Create the canonical process map (`doc/guides/ados-processes.md`)

**Goal**: Establish the single source of truth that every other diagram and navigation link points at.

**Tasks**:

- [x] **1.1** Create `doc/guides/ados-processes.md` with headerless frontmatter (`ados_distribution: redistributable` + id/status/created/owners/summary only; 0 copyright/MIT/source lines — verified). Header to be added by script in Phase 9. (commit pending)
- [x] **1.2** Intro written (3 sentences): canonical map of six processes; scan diagram then jump to a guide.
- [x] **1.3** Master `flowchart LR` diagram authored: 6 process nodes + 2 subgraphs (Setup, Support) + relationships; Legend block beneath; conservative syntax, all special-char labels quoted. Mermaid fence at line 18 (≤80). All 6 process labels present (verified: Inception×6, Onboarding×6, Change Delivery×8, Meeting Management×6, Decision Making×6, Documentation Reconciliation×4).
- [x] **1.4** Per-process cards for all 6 (Project Inception, Project Onboarding, Change Delivery, Meeting Management, Decision Making, Documentation Reconciliation) — each with Problem/Audience/Output/Link; card text derived from each guide's purpose statement.
- [x] **1.5** Cross-process relationships narrative written (5 bullets): two entry points → steady state; delivery consumes setup; doc reconciliation embedded as phase 7; decision-making as cross-cutting supporter; meetings feed decisions.
- [x] **1.6** "How to use this map" note written (5 routing bullets by situation).
- [x] **1.7** All 5 guide links resolve (project-inception, onboarding-existing-project, change-lifecycle, decision-making, meeting-preparation-and-summarization) — verified via `test -f`.

**Acceptance Criteria**:

- Must: AC-F1-1 (file exists with `ados_distribution: redistributable`), AC-F1-2 (master diagram of 6 processes + relationships), AC-F1-3 (per-process cards for all 6), AC-F1-4 (scannable structure — not a wall of text).
- Should: master diagram renders within one screen-width and uses only the conservative Mermaid subset; cross-process relationships narrative + "how to use this map" note present (support the master diagram and scannability).

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

- [x] **2.1** In `README.md`, insert a compact `flowchart LR` Mermaid process map mirroring the master map (same 6-process pipeline, possibly more compact labels). **"Near the top" threshold (matches spec + test-plan): the first ```mermaid fence MUST be within the first 60 lines** (`awk '/^```mermaid/{print NR;exit}' README.md` ≤ 60) — place it just below the `# Agentic Delivery OS (ADOS)` heading / hero, trimming preceding prose if needed to stay under the line budget. Do **not** remove or alter the hero image, the `<picture>` block, or the `source:` copyright header. (verified: mermaid @L23; hero + header preserved)
- [x] **2.2** Replace or supplement the existing plain-text pipeline line (`ticket -> spec -> plan -> ... -> release`) with the diagram; if the text line is kept, place it as the diagram caption or remove the redundancy (prefer the diagram + link table). (text pipeline replaced by compact 6-process diagram; the ticket→PR command detail is already covered in the "Typical workflow (manual)" section)
- [x] **2.3** Immediately under the diagram, add an **adjacent markdown link table** giving one-click access to each process guide (Process | Guide link). This satisfies the "clickable links" requirement the GitHub-native way (Mermaid click-callbacks are unreliable on GitHub — see decision in Context). (link table with all 5 standalone guides; verified each guide link count ≥1)
- [x] **2.4** **TOC interaction (m4):** `README.md` contains a hand-maintained `<!-- TOC -->` block. The diagram + link-table insertion MUST NOT introduce a new `##` heading that would stale the TOC — keep the diagram inline under the existing flow (e.g., under the existing intro/heading, with no new `## ` line). If a new `##` heading is unavoidable, regenerate/update the `<!-- TOC -->` block to include it before committing the phase. (no new `##` heading introduced; diagram inline under `# ADOS` heading; TOC intact @L57/77)

**Acceptance Criteria**:

- Must: AC-F2-1 (compact Mermaid process map within the first 60 lines of README **AND** an adjacent markdown link legend for one-click guide access — both required by this single AC; hero/header preserved).
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

- [x] **3.1** In `doc/guides/meeting-preparation-and-summarization.md`, insert a Mermaid diagram near the top (immediately after the frontmatter and the `> Audience/Purpose` blockquote, before `## 1.`). **"Near the top" threshold (matches spec + test-plan): the first ```mermaid fence MUST be within the first 80 lines** (`awk '/^```mermaid/{print NR;exit}' doc/guides/meeting-preparation-and-summarization.md` ≤ 80). (verified: mermaid @L17)
- [x] **3.2** Diagram content: a `flowchart TD` (or `LR`) showing the three phases — **Before** (decide-if-needed → goal → agenda → roles → share), **During** (start → parking lot → real-time capture → inclusive participation), **After** (finalize summary ≤24h → send actions ≤60min → file durable decisions → review next time). Group with subgraphs; use the shared color palette (green entry, blue steps, orange for the decision-filing gate). (flowchart TD; Before/During/After subgraphs; green start, orange triage + decision-filing gate, purple async escape)
- [x] **3.3** Add a one-line caption or `**Legend**:` beneath the diagram. (Legend block added)
- [x] **3.4** Do not restructure the guide body beyond this insertion; preserve the existing copyright header and `ados_distribution: redistributable` marker. (header=3, marker=1 preserved; body untouched)

**Acceptance Criteria**:

- Must: AC-F3-1 (Mermaid diagram within the first 80 lines of the meeting guide showing before/during/after).

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

- [x] **4.1** In `doc/guides/decision-making.md`, insert a Mermaid diagram near the top (after the frontmatter and the `> Audience/Purpose` blockquote, before `## 1.`). **"Near the top" threshold (matches spec + test-plan): the first ```mermaid fence MUST be within the first 80 lines** (`awk '/^```mermaid/{print NR;exit}' doc/guides/decision-making.md` ≤ 80). (verified: mermaid @L17)
- [x] **4.2** Diagram content: a `flowchart TD` showing the **universal decision kernel** as a pipeline (Trigger/Triage D0 → Charter D1 → Context D2 → ... → Decision D11 → Execution D12 → Verification D13 → Retrospective D14) with an **R0–R3 rigor routing** branching at the top (R0 escape hatch → no record; R1 → lightweight brief; R2 → standard record; R3 → full record + independent reviewer + human decision). Use diamonds for the routing decision and the rigor branches; orange for gates, purple for the R0 escape hatch, red where remediation/reopen is possible (with a text cue — a11y). (kernel D0–D14 pipeline + R0–R3 routing; diamonds for triage/rigor; R0 purple, gates orange, R3 orange, red "✗ Reopen" node with text cue)
- [x] **4.2a** **Render-risk constraint (m6): this is the HIGHEST render-risk diagram in the change** (most nodes + subgraphs + special-character labels). Constrain it to **≤2 subgraphs** and conservative syntax only (no `click`, no `<a>`, no `%%{init}%%`). Quote every label containing `–`, `/`, or spaces per **n1** — e.g. `K["D0–D14"]`, `R["R0–R3"]`, `T["Trigger/Triage D0"]`. (1 subgraph; 0 forbidden directives; all special-char labels quoted: "D0–D14", "D0 Trigger/Triage", "R0 escape", etc.)
- [x] **4.3** Add a one-line caption or `**Legend**:` beneath the diagram. (Legend block added, names all color semantics + the red "✗ Reopen" text cue)
- [x] **4.4** Do not restructure the guide body; preserve the existing copyright header and `ados_distribution: redistributable` marker. (header=3, marker=1; body untouched)

**Acceptance Criteria**:

- Must: AC-F3-2 (Mermaid diagram within the first 80 lines of the decision guide showing D0–D14 kernel + R0–R3 routing; constrained per task 4.2a and GitHub-render-verified first).

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

- [x] **5.1** In `doc/guides/onboarding-existing-project.md`, insert a Mermaid diagram near the top (after the frontmatter and the `> Audience/Goal` blockquote, before the TOC or `## Getting ADOS`). **"Near the top" threshold (matches spec + test-plan): the first ```mermaid fence MUST be within the first 80 lines** (`awk '/^```mermaid/{print NR;exit}' doc/guides/onboarding-existing-project.md` ≤ 80). (verified: mermaid @L17; inserted before the TOC)
- [x] **5.2** Diagram content: a `flowchart TD` setup flow: **Getting ADOS** (install: global curl / local / plugin) → **Prerequisites** (git repo, OpenCode, AI provider key, tracker access) → **Choose path** (diamond: automated `/bootstrap` vs. manual setup) → **Mandatory artifacts** (AGENTS.md, pm-instructions.md, documentation-handbook.md) → **First change** (the 11-phase lifecycle, linked). Use green for the start, blue for steps, orange for the path-choice diamond, green again for the "first change shipped" end. (all elements present; green start+success, orange choose-path diamond, blue steps)
- [x] **5.3** Add a one-line caption or `**Legend**:` beneath the diagram. (Legend block added)
- [x] **5.4** Do not restructure the guide body; preserve the existing copyright header and `ados_distribution: redistributable` marker. (header=3, marker=1; body untouched)
- [x] **5.5** **TOC interaction (m4):** `onboarding-existing-project.md` contains a hand-maintained `<!-- TOC -->` block. The diagram insertion MUST NOT introduce a new `##` heading that would stale the TOC — keep the diagram inline under the existing intro flow (no new `## ` line). If a new `##` heading is unavoidable, regenerate/update the `<!-- TOC -->` block to include it before committing the phase. (no new `##` heading; diagram inline before TOC @L40/78; TOC intact)

**Acceptance Criteria**:

- Must: AC-F3-3 (Mermaid setup-flow diagram within the first 80 lines of the onboarding guide).

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

- Must: AC-F4-1 (back-link to `ados-processes.md` from every process guide; forward links where non-obvious; documentation reconciliation handled correctly since it has no standalone guide).

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

- Must: AC-F4-2 (prominent link to `ados-processes.md` in `doc/00-index.md` near the top).

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

- [ ] **8.1** Audit **all 5 existing Mermaid fences** (not ~3) against the shared convention set: `doc/guides/change-lifecycle.md` (**1 fence**, ~line 50) + `doc/guides/project-inception.md` (**4 fences**, ~lines 54, 164, 330, 667). Enumerate each fence explicitly when reviewing. Note any divergence in direction, color meaning, arrow meaning, label style, or a missing Legend / non-color cue (a11y).
- [ ] **8.2** Audit all newly added diagrams (Phases 1–5) for the same.
- [ ] **8.3** Reconcile divergences with minimal edits: align colors to the shared palette meaning (green=entry/success, blue=process, orange=gate, red=remediation, purple=cross-cutting/optional); ensure dashed arrows mean feedback/optional only; ensure every diagram has a Legend or caption. Prefer adjusting the new diagrams to match where the existing ones already encode a clear convention; adjust existing ones only if a clear inconsistency exists.
- [ ] **8.4** Confirm no diagram uses forbidden syntax (click callbacks, `<a>` in labels, `%%{init}%%`, exotic shapes).
- [ ] **8.5** Confirm node naming is consistent: use the canonical process names ("Project Inception", "Onboarding", "Change Lifecycle", "Decision-Making", "Meetings", "Documentation Reconciliation") everywhere they appear across diagrams.

**Acceptance Criteria**:

- Must: AC-F5-1 (consistency review complete — all process diagrams, new and the 5 existing, share consistent node-naming / color / subgraph / multiline-label / feedback-loop conventions; every diagram carries a Legend + non-color cue where color encodes meaning).

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

- Must: AC-NFR4-1 (all new/modified redistributable docs carry a license header — added via `scripts/add-header-location.sh`, never hand-written; markers correct on all new/modified docs; README/doc-00-index headers retained).

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
- [ ] **10.5** Final DoD self-check: walk all 13 canonical acceptance criteria (`AC-F1-1`…`AC-F5-1`, `AC-NFR4-1`, `AC-NFR5-1` — Definition of Done below); confirm every checkbox in Phases 1–9 is checked; confirm the branch is `docs/GH-85/ados-process-map-diagrams`.
- [ ] **10.6** Stage only the documentation files touched by this change (the new guide + the modified guides + README + doc/00-index.md). Do not stage unrelated files.

**Acceptance Criteria**:

- Must: AC-NFR5-1 (`bash scripts/.tests/test-doc-distribution.sh` exits 0); no regressions; no version bump; spec reconciliation handled.

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
| TS-1 | `doc/guides/ados-processes.md` exists with header + `ados_distribution: redistributable` + id/status/owners/summary | 1, 9, 10 | AC-F1-1, AC-NFR4-1 |
| TS-2 | Master diagram shows all 6 processes + their relationships in one screen-width | 1, 8 | AC-F1-2 |
| TS-3 | Card table has a row for each of the 6 processes (problem/audience/output/link); every link resolves | 1 | AC-F1-3 |
| TS-4 | Relationships narrative + "how to use this map" note present (scannable structure) | 1 | AC-F1-4 |
| TS-5 | README renders a compact Mermaid process map (within first 60 lines) + adjacent link legend; hero image + header preserved | 2 | AC-F2-1 |
| TS-6 | README adjacent markdown link legend gives one-click access to each guide (half of AC-F2-1; verified together with TS-5) | 2 | AC-F2-1 |
| TS-7 | Meeting guide opens with a before/during/after diagram (within first 80 lines) | 3 | AC-F3-1 |
| TS-8 | Decision guide opens with a D0–D14 + R0–R3 routing diagram (within first 80 lines; ≤2 subgraphs, render-verified first) | 4 | AC-F3-2 |
| TS-9 | Onboarding guide opens with a setup-flow diagram (within first 80 lines) | 5 | AC-F3-3 |
| TS-10 | Every process guide has a back-link to `ados-processes.md`; non-obvious forward links present; documentation reconciliation handled (no standalone guide created) | 6 | AC-F4-1 |
| TS-11 | `doc/00-index.md` links to `ados-processes.md` prominently near the top | 7 | AC-F4-2 |
| TS-12 | All diagrams (new + 5 existing) share one convention set; `bash scripts/.tests/test-doc-distribution.sh` exits 0; headers via script; markers correct | 8, 9, 10 | AC-F5-1, AC-NFR4-1, AC-NFR5-1 |

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

This plan's DoD uses the **canonical AC scheme from the spec** (`chg-GH-85-spec.md` §17) — 13 IDs. The earlier flat `AC-1`…`AC-12` scheme is **retired**; every ID below maps 1:1 to a spec AC and to the ticket item that delivered it.

### DoD — canonical acceptance criteria

| Canonical AC | Criterion | Delivered in |
|--------------|-----------|--------------|
| AC-F1-1 | `doc/guides/ados-processes.md` exists with `ados_distribution: redistributable` | Phase 1, verified 9/10 |
| AC-F1-2 | Master Mermaid diagram shows all 6 processes (5 primary + 1 supporting) with relationships | Phase 1 |
| AC-F1-3 | Per-process overview card (problem/audience/output/link) for each of the 6 processes | Phase 1 |
| AC-F1-4 | Easy-to-read, scannable structure (not a wall of text) | Phase 1 |
| AC-F2-1 | README compact Mermaid process map near top **AND** adjacent markdown link legend (clickable via the legend — GitHub node-click infeasible, DEC-1) | Phase 2 |
| AC-F3-1 | `meeting-preparation-and-summarization.md` has a Mermaid diagram near the top | Phase 3 |
| AC-F3-2 | `decision-making.md` has a Mermaid diagram (D0–D14 + R0–R3) near the top | Phase 4 |
| AC-F3-3 | `onboarding-existing-project.md` has a Mermaid setup-flow diagram near the top | Phase 5 |
| AC-F4-1 | Every process guide has a back-link to `ados-processes.md` | Phase 6 |
| AC-F4-2 | `doc/00-index.md` links to `ados-processes.md` prominently | Phase 7 |
| AC-F5-1 | Consistency review — all process diagrams share consistent conventions | Phase 8 |
| AC-NFR4-1 | All new/modified redistributable docs have license headers (via script, never hand-written) | Phase 9 |
| AC-NFR5-1 | `bash scripts/.tests/test-doc-distribution.sh` exits 0 | Phase 10 |

### Cross-walk — canonical AC ↔ ticket item ↔ delivering phase

| Canonical AC | Ticket item (issue #85 / spec F-capability) | Delivering phase |
|--------------|---------------------------------------------|------------------|
| AC-F1-1 | #1 / F-1 — canonical processes-map guide exists + redistributable marker | Phase 1 (verified 9, 10) |
| AC-F1-2 | #1 / F-1 — master diagram of all 6 processes + relationships | Phase 1 |
| AC-F1-3 | #1 / F-1 — one overview card per process (problem/audience/output/link) | Phase 1 |
| AC-F1-4 | #1 / F-1 — scannable structure, not a wall of text | Phase 1 |
| AC-F2-1 | #2 / F-2, DEC-1 — README compact map **and** adjacent link legend (one AC, not two) | Phase 2 |
| AC-F3-1 | #3 / F-3 — meeting-prep near-the-top diagram | Phase 3 |
| AC-F3-2 | #3 / F-3 — decision-making near-the-top diagram (D0–D14 + R0–R3) | Phase 4 |
| AC-F3-3 | #3 / F-3 — onboarding near-the-top setup-flow diagram | Phase 5 |
| AC-F4-1 | #4 / F-4 — back-link from every process guide to `ados-processes.md` | Phase 6 |
| AC-F4-2 | #4 / F-4 — prominent `doc/00-index.md` link to `ados-processes.md` | Phase 7 |
| AC-F5-1 | #5 / F-5, NFR-6 — consistency review of all process diagrams | Phase 8 |
| AC-NFR4-1 | governance / NFR-4 — license headers on all new/modified redistributable docs | Phase 9 |
| AC-NFR5-1 | governance / NFR-5 — doc-distribution drift guard exits 0 | Phase 10 |

> **Threshold reconciliation (spec ↔ test-plan ↔ plan):** "near the top" = first ```mermaid fence within the first **60 lines (README)** / **80 lines (per guide)**; the `doc/00-index.md` link within the first **50 lines**. All three artifacts now state the identical threshold.

**Definition of Done = every checkbox in Phases 1–9 checked AND every one of the 13 canonical ACs above satisfied AND `bash scripts/.tests/test-doc-distribution.sh` exit 0 AND all touched files committed on `docs/GH-85/ados-process-map-diagrams`.**

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-28 | plan-writer | Initial plan. Derived from GitHub issue #85 + `chg-GH-85-pm-notes.yaml`; spec and test plan authored in parallel — AC extracted from issue scope + governance constraints. 10 phased delivery tasks; 12 AC mapped to Definition of Done. |
| 1.1 | 2026-06-28 | plan-writer | Red-team R1 remediation (verdict SHIP-WITH-FINDINGS). **M1**: retired the flat `AC-1`…`AC-12` DoD scheme; remapped to the spec's canonical 13-AC scheme (`AC-F1-1`…`AC-F5-1`, `AC-NFR4-1`, `AC-NFR5-1`) 1:1, with a cross-walk table (canonical-AC ↔ ticket-item ↔ phase); the README map + adjacent legend now both sit under the single `AC-F2-1`; the consistency review is its own `AC-F5-1`; every canonical AC maps to a delivering phase. **M2 (critical)**: removed the header-rule violation hedge from task 1.1 — the guide frontmatter is authored WITHOUT copyright/MIT/`source:` lines; Phase 9 runs `scripts/add-header-location.sh doc/guides` as the sole header source; noted the transient headerless commit is corrected in Phase 9 and the doc-distribution guard checks the working tree at gate time, not commit history. **m2**: Phase 8 now audits all 5 existing Mermaid fences (change-lifecycle ×1 ~L50; project-inception ×4 ~L54/164/330/667), not ~3. **m3**: stated the "near the top" threshold identically to spec/test-plan (README ≤60 lines, guides ≤80 lines) in Phases 2–5. **m4**: TOC-interaction rule (no new staling `##` heading, else regenerate the `<!-- TOC -->` block) added to Phases 2 and 5. **m6**: Phase 4 decision diagram constrained to ≤2 subgraphs + conservative syntax + label-quoting (n1), and required to be the first diagram visually verified on GitHub render (highest render risk). **n1**: added a render-critical callout in the shared convention section — labels with en-dash/slash/space MUST be double-quoted. **a11y**: made the Legend mandatory and required a non-color text cue on red/green nodes (WCAG 1.4.1) in the shared convention section. No scope, non-goals, PM-decision, phase-structure (10 phases), or branch changes. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Done | 2026-06-28 | 2026-06-28 | 7f4a5cd | ados-processes.md created; master diagram @L18; all 6 labels present; links resolve; headerless frontmatter (header added P9). |
| 2 | Done | 2026-06-28 | 2026-06-28 | 1cc4fcb | README compact map @L23; link table with 5 guides; hero+header preserved; no marker added; TOC intact. |
| 3 | Done | 2026-06-28 | 2026-06-28 | (pending) | meeting guide before/during/after flowchart @L17 + back-link; header+marker intact. |
| 4 | Done | 2026-06-28 | 2026-06-28 | (pending) | decision guide D0–D14 kernel + R0–R3 routing @L17; 1 subgraph (<=2); no forbidden syntax; red "✗ Reopen" text cue; header+marker intact. |
| 5 | Done | 2026-06-28 | 2026-06-28 | (pending) | onboarding guide setup-flow @L17 + back-link; TOC intact (no new heading); header+marker intact. |
| 6 | Not started | — | — | — | |
| 7 | Not started | — | — | — | |
| 8 | Not started | — | — | — | |
| 9 | Not started | — | — | — | |
| 10 | Not started | — | — | — | |

> **Lifecycle note:** Per `chg-GH-85-pm-notes.yaml`, two red-team challenge rounds are planned — R1 on the spec/plan/test-plan artifacts pre-delivery (feeds the `dor_check` gate) and R2 on the delivered change pre-PR (feeds `review_fix`). These are orchestrated by `@pm` outside this delivery plan; any R1 findings that affect this plan are folded in as a plan revision log entry before delivery, and any R2 findings are remediated by reopening the relevant phase above.
