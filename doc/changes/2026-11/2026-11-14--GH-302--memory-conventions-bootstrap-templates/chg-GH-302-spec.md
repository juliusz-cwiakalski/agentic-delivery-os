---
change:
  ref: GH-302
  type: feat
  status: Proposed
  slug: memory-conventions-bootstrap-templates
  title: "M2-S9: Memory conventions in bootstrap templates (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  labels: [milestone-m2, memory, bootstrap, documentation]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "GH-301 (M2-S8 memory records — OPEN; delivery authorized by owner directive, see DEC-1)"
      - "Bootstrapper (SPEC-BOOTSTRAPPER)"
      - "Agent memory conventions (the AGENTS.md Agent memory section — single current-truth source)"
    external: []
  links:
    decisions: ["PDR-0004"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Wire the agent-memory learning loop (memory tree scaffold, AGENTS.md kernel section, per-agent entry points, capture/promotion rules, retro-note conventions, and a manual doctor checklist) into bootstrap templates and the bootstrap flow, so every newly bootstrapped ADOS project starts with the learning loop in place.

## 1. SUMMARY

The agent-memory learning loop exists today only as current truth inside ADOS's own kernel — the "Agent memory" section of this repository's AGENTS.md. A project that runs ADOS inception receives AGENTS.md, four agent-instruction files, and the installed guide/template set, but none of the memory conventions: no memory tree, no kernel section, no capture bar, no promotion path, no retro-note conventions. This change wires those conventions into bootstrap Phase 5 and its templates so a newly bootstrapped project starts with the learning loop already in place — and, until memory tooling lands (GH-301 / M2-S8), ships the doctor strictly as a documented manual checklist with no executable component.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Memory conventions (current truth).** The "Agent memory" section of ADOS's own AGENTS.md defines the canonical learning loop: the committed memory tree at `.ai/memory/**` (per-agent entry point at `.ai/memory/agents/<agent>/README.md`, the index at `.ai/memory/README.md`, `lessons/`, `tacit/`), ephemeral state at `.ai/local/**` (never committed), entry-point caps (~150 lines per agent entry point, ≤200 for the index), the capture bar, evidence-linked supersede-never-rewrite records, promotion handoff routing (lessons / tacit / fact / decision / norm / workflow homes), reviewer independence, and change-capsule completion. This section is the single source the scaffold must mirror.
- **Meta-learning reference (exists, draft).** The memory-practices concept document (`doc/planning/concepts/`, status Draft, 2026-10-26) already carries the adopt-now rules, an AGENTS.md kernel template section, an adoption checklist, anti-patterns, and candidate metrics. The planning summary described this file as new; repo truth is that it exists in draft form. It is the intended content source for the meta-learning capability, and its adoption checklist must be aligned with the scaffolded truth (see DEC-2).
- **Bootstrap Phase 5 (SPEC-BOOTSTRAPPER).** The bootstrapper runs an 8-phase inception workflow; Phase 5 (ADOS framework integration) generates AGENTS.md, the four installed agent-instruction files (coordinator/PM, PR/MR, decision, code-review), sets the documentation profile, and installs the handbook, templates, decisions index, guides, and `doc/00-index.md`. The human-executable authority for Phase 5 is the inception guide. Neither the feature spec's Phase 5 outputs table nor its write allowlist mentions memory.
- **Bootstrap write allowlist.** The allowlist (mirrored across SPEC-BOOTSTRAPPER, the bootstrapper agent prompt, and the inception guide) does **not** include the memory tree root. Any memory scaffold written by Phase 5 today would fall outside containment and require per-write human confirmation.
- **Retro conventions for bootstrapped projects.** No retro ceremony exists in what bootstrap installs. Retrospective conventions today are: (a) inception-phase retrospectives under `doc/inception/retrospective/` during the bootstrap flow itself, and (b) change-capsule retro capture owned by the change lifecycle. The ceremony runner (M2-S3) and retro action registry (M2-S10) are future tooling and do not exist yet.
- **Tooling status.** GH-301 (M2-S8: memory records, layout, and lint — typed records, memory lint in the gates) has no change artifacts yet. No memory tooling, lint, or doctor automation exists. This repository's own `.ai/memory` tree **exists and is populated** (per-agent entry points plus lessons; created by GH-204, 2026-11-07) and serves as the living reference instance of the conventions — but it was grown by hand: nothing in the bootstrap flow wires any of it into a new project. GH-301 owns the tree's further evolution (typed records, lint); GH-302's gap is bootstrap wiring, not tree creation.

### 2.2 Pain Points / Gaps

- **GAP-1**: A newly bootstrapped project gets zero memory wiring — no tree, no kernel section, no per-agent entry points — so its delivery agents start with no learning loop and must invent (or skip) memory practice per project.
- **GAP-2**: The capture bar and promotion rules live only in this repo's kernel; the installed coordinator instructions of a bootstrapped project carry none of them, so the coordinating agent has no mandate to run capture, promotion, or consolidation.
- **GAP-3**: Retro-note conventions (append-only notes with a generated index) have no carrier in a bootstrapped project; there is nothing that tells a new project how to accumulate retro learnings.
- **GAP-4**: The meta-learning reference (memory-practices concept) exists only as a draft inside this repo's planning area, disconnected from what bootstrap installs, and its adoption checklist does not yet match a scaffoldable tree shape.
- **GAP-5**: The Phase 5 write allowlist does not cover the memory tree, so the containment contract itself must be extended before the scaffold can be written legitimately.
- **GAP-6**: With no memory tooling yet, there is no doctor at all — not even a manual one — for a new project to audit memory health (coverage, budgets, dangling references, contradictions, secret leakage).

## 3. PROBLEM STATEMENT

Because bootstrap Phase 5 installs none of the agent-memory conventions that exist as current truth in ADOS's own kernel, every newly bootstrapped project starts delivery without the learning loop — agents capture nothing durable, lessons evaporate between changes, and each project must rediscover memory practice from scratch — resulting in repeated mistakes across projects, no accumulation of operational knowledge, and an inconsistent adoption path once memory tooling (GH-301) arrives.

## 4. GOALS

- **G-1**: A newly bootstrapped project starts with the learning loop in place: the memory tree scaffold, the kernel section in its generated AGENTS.md, and the capture/promotion rules wired into its installed coordinator instructions and retro-note conventions.
- **G-2**: The scaffolded conventions mirror ADOS's current-truth kernel section **exactly** — no invented record schema, no anticipation of GH-301's typed-record fields — so post-GH-301 reconciliation cost stays minimal.
- **G-3**: The doctor exists, until tooling lands, strictly as a documented manual checklist; this change ships no memory tooling or lint.
- **G-4**: Bootstrap containment stays intact: the write allowlist is extended deliberately and consistently across the feature spec, the inception guide, and the bootstrapper prompt, with all companion documentation reconciled in the same change.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Memory-adjacent artifacts present after Phase 5 (both `new` and `legacy` flows) | 100% of the capability set (F-1…F-6) present and approved at the Phase 5 gate |
| Convention drift between scaffold and current-truth kernel | Zero findings in review; review verdict records "mirrors source, no invented fields" |
| Entry-point and index budgets in generated scaffold | 100% of generated files within caps (~150 lines per agent entry point; ≤200 lines for the index) |
| Conformance and distribution gates | `pnpm check` green (incl. prompt/help conformance); doc-distribution test passes for every new/changed distributable doc |
| Retro ceremony invention | Zero ceremony artifacts or automation shipped (conventions only) |

### 4.2 Non-Goals

- **NG-1**: No memory lint or memory tooling of any kind — that is M2-S8's line (GH-301).
- **NG-2**: No typed-record schema: no id/kind/scope/provenance/trust/validity/status fields, no record formats beyond what the current-truth kernel already states.
- **NG-3**: No doctor automation: no scripts, no gates, no package or CLI code changes — the manual checklist is documentation.
- **NG-4**: No changes to this repository's own `.ai/memory` tree — the existing populated tree is the living reference instance of the conventions being templated, and GH-302 must not modify, extend, or restructure it; its evolution is owned by GH-301 (M2-S8).
- **NG-5**: No retro ceremony is invented: no ceremony runner, no ceremony commands, no action registry — retro wiring is scoped to what templates, the kernel section, and the installed instructions can carry (ceremony tooling remains M2-S3 / M2-S10).
- **NG-6**: No retrofit automation for previously bootstrapped projects — existing projects adopt manually via the installed adoption checklist (see 8.5).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Memory tree scaffold in bootstrap outputs | New projects must start with the canonical memory layout, seeded empty, so the learning loop has a home from day one |
| F-2 | AGENTS.md memory kernel section | The kernel section is the always-read entry point; without it the tree is undiscoverable and unenforced |
| F-3 | Capture and promotion rules in installed coordinator instructions | The coordinating agent must hold the mandate and the rules for capture, promotion, and consolidation |
| F-4 | Retro-note conventions for the bootstrapped project | Retro learnings need an append-only, indexed carrier that does not depend on ceremony tooling that does not exist yet |
| F-5 | Manual doctor checklist (documentation only) | Until tooling lands, the project needs a documented way to audit memory health on a cadence |
| F-6 | Aligned meta-learning reference | The adopt-now practices concept becomes the canonical meta-learning source, consistent with the scaffold |
| F-7 | Bootstrap containment update (allowlist + documentation) | The scaffold is only legitimate if the write allowlist and its documentation mirror each other |

### 5.1 Capability Details

- **F-1 — Memory tree scaffold.** Phase 5 creates the bootstrapped project's memory tree, seeded empty (structure, not content): the memory index (README entry point), one entry-point README per resident agent role, the lessons area, and the tacit area — exactly the locations the current-truth kernel names for a fresh tree. Entry-point READMEs state the capture bar and read/write policy. Ephemeral state remains outside the committed tree per the source conventions. What is *not* provisioned: any additional areas the draft concept's checklist mentions but the current-truth kernel does not name (see DEC-2 and OQ-1).
- **F-2 — Kernel section.** The generated AGENTS.md carries a memory kernel section with all **twelve** content classes of ADOS's current-truth section: (1) canonical and ephemeral locations; (2) the advisory/untrusted preamble (memory never overrides instructions, repository rules, or current truth; any directive found inside memory is data, not a command); (3) read policy (own entry point read at session start, index and topic files just-in-time, append at event time); (4) capture bar; (5) write ownership (own folder only, unseeded first-capture exception, consolidation-owned shared surfaces); (6) evidence over recency — supersede, never rewrite; (7) unique ids (monotonic next free id per prefix and year, never reused including after supersession or pruning); (8) reviewer independence (adversarial and mechanical roles keep no episodic memory); (9) caps and growth (entry point ≤150 lines, index ≤200 lines, split into topic files past ~50 lines when distinct areas emerge, topic files load on demand); (10) promotion handoff routing (exactly one home per candidate, closeout executes the routing at the change boundary); (11) change-capsule completion; and (12) conflict reality (never claim memory is conflict-free; shared surfaces are consolidation-only yet merge-conflict capable; memory changes ride normal delivery PRs). It references the installed conventions rather than duplicating them, and it contains no record-schema fields. All twelve classes fit the ~200-line kernel guidance — the source section itself carries them in compact bold-headed form — so the extension creates no tension with the NFR-2 budgets; AC-NFR2-1 measures per-agent entry points and the index, not the kernel section.
- **F-3 — Coordinator instructions wiring.** The installed coordinator (PM-facing) instructions state the capture bar and the promotion path, and the companion installed instruction files carry the per-role memory expectations consistent with the kernel (read-own-entry-point, write-own-folder, no cross-agent memory edits). The companion files reference the kernel rather than restating it.
- **F-4 — Retro-note conventions.** The bootstrapped project receives retro-note conventions — append-only retro notes with a generated index — carried by the installed convention/template set and referenced from the kernel section and the coordinator instructions. The retro conventions **reference** the capture bar and promotion path rather than duplicating them (scenario seed SC-M2-S9-02). No ceremony, command, or automation is delivered (NG-5); when the ceremony runner (M2-S3) lands, it adopts these conventions.
- **F-5 — Manual doctor checklist.** A documentation-only memory-health checklist ships with the installed set: index coverage, budget caps (~150 lines per agent entry point, ≤200 for the index), dangling references, contradictions, derivable-content heuristics, and secret-pattern scan. It states explicitly that it is manual until memory lint lands in the gates (GH-301). It prescribes the cadence (e.g., per-retro or periodic audit) but performs nothing.
- **F-6 — Aligned meta-learning reference.** The existing memory-practices concept is aligned and finalized as the canonical meta-learning reference for ADOS-driven projects: its adoption checklist is corrected to match the scaffolded tree shape (DEC-2), its kernel template section stays consistent with F-2, and the installed convention material stays self-contained, citing the ADOS repository's published reference as optional further reading rather than as an installed dependency (PDR-0004).
- **F-7 — Containment update.** The Phase 5 write allowlist gains the bootstrapped memory tree root (`.ai/memory/**`) — and nothing broader — consistently in all three places that state it: SPEC-BOOTSTRAPPER (outputs table + allowlist), the bootstrapper agent prompt, and the inception guide's Phase 5 authority detail. The readiness check (Phase 6) verifies presence of the memory artifacts so an incomplete scaffold fails readiness rather than surfacing later.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Bootstrap Phase 5 with memory wiring (project.owner + @bootstrapper)
  Owner runs inception → Phase 5 generates AGENTS.md, agent instructions,
  documentation profile, and NOW: memory tree scaffold (index, per-agent
  entry points, lessons/, tacit/), kernel section, coordinator capture/
  promotion wiring, retro-note conventions, manual doctor checklist
  → human gate approves all framework files incl. memory artifacts
  → Phase 6 readiness check verifies memory artifacts present; FAIL reopens
  → Phase 7 sign-off: project incepted WITH the learning loop.

Flow 2: First change in a bootstrapped project (learning loop in action)
  Agents read their entry points at session start → capture bar gates what
  becomes a durable candidate → candidates route through the promotion
  handoff to exactly one home → coordinator instruction owns curation
  → retro notes accumulate append-only with a generated index.

Flow 3: Manual doctor cadence (project.owner + coordinator)
  Coordinator runs the documented checklist (coverage, budgets, dangling
  refs, contradictions, secret scan) → fixes or files findings as retro
  notes → until memory lint replaces it in the gates (GH-301).
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Memory tree scaffold generation in Phase 5: memory index entry point, per-agent entry-point READMEs for the resident agent roles, lessons area, tacit area — seeded empty, mirroring current-truth conventions.
- Memory kernel section in the generated AGENTS.md, mirroring the source section's content classes.
- Capture bar and promotion rules in the installed coordinator instructions; consistent per-role memory expectations in the companion installed instruction files.
- Retro-note conventions (append-only notes, generated index) carried by the installed convention/template set and referenced by kernel and coordinator instructions.
- Manual doctor checklist as documentation, shipped with the installed set.
- Alignment of the memory-practices concept (existing draft) with the scaffolded truth; its adoption checklist corrected to the scaffolded tree shape.
- New memory bootstrap templates in the template set, each carrying the required distribution marker; prompt changes kept current-state and the generated plugin output regenerated with the source change.
- Write allowlist extension for the memory tree, stated identically in SPEC-BOOTSTRAPPER, the bootstrapper prompt, and the inception guide; Phase 6 readiness verification extended to the memory artifacts.
- Backlog progress marker for M2-S9 per milestone delivery conventions (documentation bookkeeping at delivery).

### 7.2 Out of Scope

- [OUT] Memory lint, memory tooling, schema validation, or any executable memory code (M2-S8 / GH-301).
- [OUT] Typed-record fields (id/kind/scope/provenance/trust/validity/status) or any record schema beyond current-truth conventions.
- [OUT] Doctor automation: scripts, quality-gate wiring, or CLI changes.
- [OUT] Modifying, extending, or restructuring this repository's own populated `.ai/memory` tree (its evolution is owned by GH-301 / M2-S8).
- [OUT] A retro ceremony runner, ceremony commands, or a retro action registry (M2-S3 / M2-S10).
- [OUT] Retrofit/automation to add the learning loop to previously bootstrapped projects (manual adoption only, see 8.5).
- [OUT] Provisioning memory areas beyond the current-truth set (e.g., preferences/retro areas) — deferred pending OQ-1.
- [OUT] Changes to the change-capsule mechanics themselves (`events.jsonl`, candidates) — capsules are owned by the change lifecycle and are referenced, not modified.

### 7.3 Deferred / Maybe-Later

- Provisioning additional memory areas (preferences, retro archive) once GH-301 defines the full committed tree — resolved there, not here (OQ-1).
- Doctor automation wiring into quality gates when memory lint lands (GH-301).
- Retro ceremony adoption of the conventions delivered here, when the ceremony runner (M2-S3) and retro action registry (M2-S10) land.
- Retrofit guidance pack for projects bootstrapped before this change, if manual adoption proves too costly in practice.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface is added or changed.

### 8.2 Events / Messages

N/A — no event or message surface is added or changed. Change-capsule events remain owned exclusively by the lifecycle commands and are untouched.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Bootstrapped memory tree shape | The on-disk layout Phase 5 seeds in a target project: memory index entry point, `agents/<agent>/README.md` per resident agent role, `lessons/`, `tacit/`; committed; ephemeral state excluded per source conventions. Shape mirrors the current-truth kernel exactly |
| DM-2 | Generated kernel section shape | The content-class contract for the AGENTS.md memory section in a bootstrapped project: the **twelve** classes of the source section — locations; advisory/untrusted preamble; read policy; capture bar; write ownership; evidence over recency (supersede, never rewrite); unique ids; reviewer independence; caps and growth (≤150 entry point / ≤200 index, topic-file split past ~50 lines); promotion handoff; capsule completion; conflict reality — no record-schema fields |
| DM-3 | Retro-note convention shape | Append-only retro notes plus a generated index; fronted by the installed conventions, referenced (not duplicated) by kernel and coordinator instructions |

### 8.4 External Integrations

N/A — no external vendor or API integration is added or changed. The bootstrap interview and PR/MR platform detection flows are untouched.

### 8.5 Backward Compatibility

- **New projects**: the capability set is additive; Phase 5's human gate, phase count, and resume semantics are unchanged (memory artifacts join the existing Phase 5 approval).
- **Previously bootstrapped projects**: unaffected at runtime. The template set they receive via content-sync updates will include the new memory templates (templates are upstream-tracked and overwritten on sync), but AGENTS.md and the agent-instruction files are project-specific and are **not** auto-updated — so the kernel section and instructions wiring must be adopted manually using the installed adoption checklist. No migration tooling is shipped (NG-6).
- **Generated plugin output**: regenerated with the source prompt change and shipped in the same change; consumers see the same command/agent surface with the added memory responsibility.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Convention fidelity: scaffolded tree, kernel section, and instruction wiring match the current-truth kernel with zero invented fields | Zero drift findings in review against the source section |
| NFR-2 | Budget caps mirrored in scaffold and checklist: per-agent entry point and memory index | Agent entry point ~150 lines max; index ≤200 lines; kernel section ~200-line guidance |
| NFR-3 | Bootstrap flow overhead: Phase 5 gains no additional human gates or interactive steps for memory artifacts | Gate count unchanged (single Phase 5 approval covers memory artifacts); zero new interview questions |
| NFR-4 | Conformance: prompt conformance scans, help/reference checks, and the doc-distribution gate stay green | `pnpm check` green; doc-distribution test passes with zero drift for all new/changed distributable docs |
| NFR-5 | Resume idempotency: an interrupted Phase 5 run completes the scaffold without duplication or overwrite of human-approved files | Zero duplicated entry points; zero silently overwritten files on resume |
| NFR-6 | Authoring-time check execution for the change itself | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens (recorded for delivery phases per pm-notes conventions) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no telemetry ships in this change (no tooling allowed, NG-1/NG-3). The manual doctor checklist is the observability story until GH-301 lands. Candidate memory-health metrics already documented in the meta-learning reference remain future input for GH-301 and are not implemented here.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Convention drift: GH-301 lands a tree/schema that differs from what this change scaffolded, requiring reconciliation in already-bootstrapped projects | M | M | Binding constraint DEC-1: mirror the current-truth kernel exactly and anticipate nothing; GH-301 then reconciles only schema deltas, not tree shape | Low |
| RSK-2 | Internal inconsistency: generated kernel section, scaffold, and instruction wiring disagree (e.g., kernel names an area the tree lacks) | M | L | Single-source authoring from the current-truth kernel; Phase 6 readiness check verifies artifact presence; review cross-checks the three surfaces | Low |
| RSK-3 | Allowlist over-extension: the containment fix opens more write surface than the scaffold needs | L | L | Extend by exactly the memory tree root and nothing broader; out-of-allowlist confirmation rule unchanged; allowlist text kept identical across spec, guide, and prompt | Low |
| RSK-4 | Retro overreach: conventions accrete ceremony-like structure that M2-S3 tooling must later unwind | M | L | NG-5 boundary: conventions only (append-only notes + generated index), explicitly no ceremony; deferred list records the future adoption path | Low |
| RSK-5 | Distribution-marker drift: a new template misses the required marker or breaks YAML consumers, failing the distribution gate late | L | L | Markers required on every new distributable doc at authoring time; the distribution test runs in CI and blocks merge on drift | Low |
| RSK-6 | Prompt-conformance regressions: kernel/prompt edits introduce evolution-history phrasing or stale help references | L | L | Current-state authoring rule; conformance scans run in `pnpm check`; generated plugin output regenerated in the same commit as source | Low |

## 12. ASSUMPTIONS

- The AGENTS.md "Agent memory" section remains the single current-truth source for memory conventions through delivery of this change.
- The existing `.ai/memory` tree in this repository is the living reference instance of the conventions being templated; GH-302 templates its conventions and does not modify the tree itself.
- GH-301 does not change the tree shape before this change lands; if it does, the DoR gate re-opens this spec for reconciliation.
- The installed-set surface for a bootstrapped project is otherwise unchanged; this change only adds memory artifacts to it.
- No retro ceremony exists for bootstrapped projects today; the templates, kernel section, and installed instructions are the only carriers available for retro conventions.
- The existing memory-practices concept (draft) is the intended meta-learning content source and will be aligned, not replaced.
- Owner directive to deliver with GH-301 open stands (recorded in pm-notes and DEC-1).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-301 (M2-S8 memory records, layout, and lint) | **OPEN** — delivery explicitly authorized by owner directive (DEC-1); this change targets the pre-tooling state and must not pre-empt GH-301's record schema |
| Depends on | Current-truth memory conventions (kernel section) | The content source being mirrored; not modified by this change |
| Depends on | SPEC-BOOTSTRAPPER + inception guide + bootstrapper prompt | All three state the Phase 5 contract and must move together (F-7) |
| Related (not blocking) | M2-S3 ceremony runner, M2-S10 retro action registry | Future adopters of the retro conventions delivered here |
| Blocks | None formally | Downstream stories benefit but have no hard dependency on this landing first |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the scaffold also provision empty `preferences/` and retro-archive areas, as the draft concept's adoption checklist suggests, or strictly the current-truth set (index, per-agent entry points, lessons, tacit)? | The binding constraint (DEC-1) mirrors the kernel, which names only the current-truth set; the draft checklist mentions two extra areas the kernel does not | Resolved for this change by DEC-2 (current-truth set only); revisit when GH-301 defines the full committed tree |
| OQ-2 | Does the meta-learning reference stay repo-internal source material, or is it installed into bootstrapped projects as part of the convention set? | The install surface today does not ship the planning/concepts area into target projects, while the header-placement convention treats concept documents as part of the installed set; the two signals conflict | **Resolved for this change by PDR-0004 (repo-internal):** the meta-learning reference is aligned and finalized in this repository (F-6) as upstream source material for the installed conventions and is **not** installed into bootstrapped projects — the Phase 5 install surface does not gain `doc/planning/concepts/**`, and installed memory conventions stay self-contained (public ADOS repo URL as optional further reading only). Revisit: adopter demand for a bundled practices guide → purpose-written redistributable guide under `doc/guides/`, never planning concepts wholesale. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Deliver GH-302 now although declared dependency GH-301 (M2-S8) is open; acceptance targets the pre-tooling state; the scaffold mirrors the current-truth kernel exactly — no invented record schema, no anticipation of GH-301's typed-record fields; no memory tooling/lint ships (manual doctor checklist only) | Explicit owner directive; the ticket AC anticipates the tooling-free state; mirroring keeps post-GH-301 reconciliation cost minimal (binding constraint passed to all downstream agents, from pm-notes) | 2026-11-14 |
| DEC-2 | The scaffold provisions exactly the current-truth tree set (index, per-agent entry points, lessons, tacit); the draft concept's extra areas (preferences, retro archive) are not provisioned now, and the draft adoption checklist is corrected to match the scaffolded truth | The binding mirror constraint makes the kernel — not the draft — authoritative for tree shape; extra areas belong to GH-301's tree decision | 2026-11-14 |
| DEC-3 | The doctor ships as a manual checklist (documentation only); no executable doctor component in this change | Ticket AC states the checklist-until-tooling intent explicitly; tooling is M2-S8's line | 2026-11-14 |
| DEC-4 | Retro wiring is scoped to conventions (templates/kernel/instructions carriers); no retro ceremony is invented | No ceremony exists for bootstrapped projects today; the ceremony runner (M2-S3) and retro registry (M2-S10) will own ceremony mechanics later | 2026-11-14 |
| DEC-5 | delivery_mode: autonomous — full lifecycle in one directive, stopping at an open PR against `main-tools` (merge authority: CEO per ticket conventions) | Owner request, recorded in pm-notes | 2026-11-14 |
| DEC-6 | The meta-learning reference stays repo-internal: aligned in this repo as upstream source (F-6), not installed into bootstrapped projects; install surface unchanged by it | PDR-0004 (`doc/decisions/PDR-0004-memory-practices-concept-repo-internal.md`): install membership is defined by Phase 5 outputs + the distribution-marker system, which exclude planning concepts; installing would set a class-wide precedent and add a drift-prone second authority surface. PM-adopted pending owner ratification at the open-PR gate (R2 convention: AI never auto-Accepts) | 2026-11-14 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Bootstrapper agent prompt | Updated — Phase 5 gains memory-wiring responsibility; write allowlist extended; stays current-state (no evolution history) |
| Bootstrap command prompt | Updated only as needed to stay consistent with the agent prompt; thin wrapper role unchanged |
| Generated Claude plugin output | Regenerated from the source prompt changes and committed together (never hand-edited) |
| SPEC-BOOTSTRAPPER (feature spec) | Updated — Phase 5 outputs table and write allowlist gain the memory artifacts; spec reconciliation also expected at phase 7 of the lifecycle |
| Inception guide (Phase 5 authority detail) | Updated — Phase 5 activities/outputs gain the memory wiring; allowlist statement kept identical |
| Bootstrap template set | Extended — new memory templates (scaffold seeds, kernel section reference, coordinator capture/promotion content, retro-note conventions, manual doctor checklist, adoption checklist), each with the required distribution marker |
| Memory-practices concept (planning concepts) | Updated — status advanced from Draft, adoption checklist aligned to the scaffolded tree, kept consistent with F-2 |
| OSS-tooling backlog (M2-S9 entry) | Updated — Progress marker per milestone delivery conventions |
| This repository's own `.ai/memory` | **Unchanged** — existing populated tree (GH-204) serves as the living reference instance; evolution owned by GH-301 |

## 17. ACCEPTANCE CRITERIA

**Learning loop presence**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a project completes bootstrap Phase 5 (either flow), **when** its committed tree is inspected, **then** the memory scaffold exists with the memory index entry point, one entry-point README per resident agent role, the lessons area, and the tacit area — mirroring the current-truth conventions, seeded empty, and with no additional areas (scenario seed SC-M2-S9-01 inherited; content not restated here) | F-1, DM-1 |
| AC-F2-1 | **Given** the scaffold is generated, **when** the project's AGENTS.md is read, **then** it carries the memory kernel section with all twelve content classes of the source section (locations; advisory/untrusted preamble; read policy; capture bar; write ownership; evidence over recency with supersede-never-rewrite; unique ids never reused including after supersession or pruning; reviewer independence; caps and growth with the topic-file split rule; promotion handoff; capsule completion; conflict reality) and contains no record-schema fields | F-2, DM-2, NFR-1 |
| AC-F3-1 | **Given** a bootstrapped project, **when** the installed coordinator instructions are read, **then** they state the capture bar and the promotion path, and the retro-note conventions reference both rather than duplicating them (scenario seed SC-M2-S9-02 inherited; content not restated here) | F-3, F-4, DM-3 |
| AC-F4-1 | **Given** a bootstrapped project, **when** its installed convention set is inspected for retro handling, **then** append-only retro notes with a generated index are prescribed by documentation alone, with no ceremony, command, or executable artifact shipped | F-4, DM-3 |

**Pre-tooling doctor**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** no memory tooling exists in the delivering repository, **when** a project owner wants to audit memory health, **then** the doctor executes as a documented manual checklist covering coverage, budget caps, dangling references, contradictions, derivable-content heuristics, and secret-pattern scan — and no script, gate, or package change was shipped for it | F-5, NG-1, NG-3 |

**Meta-learning alignment**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** the meta-learning reference, **when** its adoption guidance is compared with the scaffolded tree and kernel section, **then** they agree on tree shape, caps, and capture bar with zero contradictions | F-6, NFR-1 |

**Containment and consistency**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** the containment contract, **when** Phase 5 writes the memory scaffold, **then** every write lands inside the extended allowlist, the allowlist text is identical across the feature spec, the inception guide, and the bootstrapper prompt, and any path outside it still requires explicit human confirmation | F-7, NFR-4 |
| AC-F7-2 | **Given** the readiness check, **when** Phase 6 runs on a project whose memory artifacts are incomplete, **then** readiness fails and reopens the gap rather than signing off a project without the learning loop | F-1, F-7 |

**Robustness**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-2 | **Given** a bootstrap run interrupted during Phase 5 after a partial scaffold, **when** the run resumes, **then** the scaffold is completed without duplicated entry points and without silently overwriting human-approved files | F-1, NFR-5 |
| AC-NFR2-1 | **Given** a generated scaffold, **when** the per-agent entry points and the memory index are measured, **then** each file is within its budget cap (~150 lines per agent entry point; ≤200 lines for the index) | NFR-2 |
| AC-NFR4-1 | **Given** the delivering change, **when** quality gates run, **then** prompt conformance, help/reference checks, and the doc-distribution test all pass with zero drift | NFR-4, NFR-6 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds the §17 acceptance criteria to a concrete, checkable outcome, names its verification method, and cites the delivering plan phase in `chg-GH-302-plan.yaml` (Phases 1–5) where the proof is produced. The change-specific DoD is the post-implementation acceptance gate (`dod_check`): `@reviewer` audits the implementation against it, then `@pm` confirms the full checklist before PR creation. This specification claims no passing evidence and no acceptance; the conditions define what must be proven. This change ships documentation, templates, and prompt changes only — every condition is verified by inspection, review, or the named documentation checks; no runtime telemetry exists to capture. Two framing rules, both binding:

1. **Populated-tree boundary.** Per NG-4, the delivering repository's own populated `.ai/memory/**` tree is the living reference instance only: no DoD condition requires or permits modifying, extending, or restructuring it, and any change to it fails this DoD (review-time changed-file checks, TC-MEMSCAF-004 / TC-MEMWIRE-004).
2. **Pre-tooling posture.** Per DEC-1 and DEC-3, the doctor is documentation only: no DoD condition requires executable memory tooling, and the presence of any memory script, gate, or package change in the delivered files fails this DoD.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | The memory tree scaffold is present and faithful: Phase 5 (either flow) seeds the memory index entry point, one entry-point README per resident agent role, the lessons area, and the tacit area — empty, mirroring the source conventions, with no additional areas | F-1, DM-1, AC-F1-1 | Bootstrap dry-run fidelity review (manual; TC-MEMRESUME-002 live dry-run) against the source conventions; coverage-matrix TCs green | Phase 1 (templates), Phase 2 (Phase 5 wiring) |
| DoD-2 | The generated kernel section carries all twelve content classes of the source section (locations; advisory/untrusted preamble; read policy; capture bar; write ownership; evidence over recency; unique ids; reviewer independence; caps and growth with the topic-file split rule; promotion handoff; capsule completion; conflict reality) within the ~200-line kernel guidance, with no record-schema fields and zero drift from the source | F-2, DM-2, AC-F2-1, NFR-1, NFR-2 | TC-MEMKERN-003 side-by-side fidelity review green against the full source section; TC-MEMKERN-001 pin green | Phase 1 |
| DoD-3 | The installed coordinator instructions state the capture bar and the promotion path, and the retro-note conventions reference both rather than duplicating them | F-3, F-4, DM-3, AC-F3-1 | Coverage-matrix TCs green; manual wiring review of the rendered instructions | Phase 1 |
| DoD-4 | Retro handling is documentation-only: append-only retro notes with a generated index, with no ceremony, command, or executable artifact anywhere in the change | F-4, DM-3, AC-F4-1 | Changed-file check over the delivered files (no ceremony artifact present); review verdict | Phases 1–2 |
| DoD-5 | The manual doctor checklist ships as documentation covering coverage, budget caps, dangling references, contradictions, derivable-content heuristics, and secret-pattern scan — with no script, gate, or package change for it | F-5, AC-F5-1, NG-1, NG-3 | Changed-file check (zero executable memory tooling in the diff); checklist content review | Phase 1 |
| DoD-6 | The meta-learning reference agrees with the scaffolded truth: adoption checklist corrected to the scaffolded tree, kernel template section consistent with F-2, zero contradictions | F-6, AC-F6-1 | TC-MEMALIGN-003 green; manual alignment review | Phase 3 |
| DoD-7 | The write allowlist is extended by exactly the memory tree root and its text is identical across the three surfaces (feature spec, inception guide, bootstrapper prompt); the out-of-allowlist confirmation rule is unchanged | F-7, AC-F7-1, NFR-4 | `bash scripts/.tests/test-inception-doc-consistency.sh` green; manual three-way text comparison recorded | Phase 2 |
| DoD-8 | The readiness flow gates the memory artifacts: Phase 6 verifies scaffold and kernel presence and fails readiness on an incomplete learning loop | F-1, F-7, AC-F7-2 | Inspection of the updated prompt and guide text (Phase 6 wiring); coverage-matrix TC green | Phase 2 |
| DoD-9 | Resume after an interrupted Phase 5 completes the scaffold without duplicated entry points and without silently overwriting human-approved files | F-1, AC-F1-2, NFR-5 | Interrupted-resume exercise within the bootstrap dry run (manual; rides TC-MEMRESUME-002) | Phase 2 |
| DoD-10 | Generated scaffold budgets hold: every per-agent entry point within ~150 lines and the memory index within 200 lines | NFR-2, AC-NFR2-1 | Line counts recorded from the dry-run scaffold | Phases 1–2 |
| DoD-11 | Full acceptance coverage: all eleven §17 acceptance criteria green — AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1, AC-F6-1, AC-F7-1, AC-F7-2, AC-F1-2, AC-NFR2-1, AC-NFR4-1 — with no uncovered criterion and no orphan TC | §17, NFR-1..NFR-6 | Test plan coverage matrix all Covered; execution evidence recorded in the phase pm-notes | Phases 1–4 (per-phase), Phase 5 (roll-up) |
| DoD-12 | The full gate battery is green on a clean checkout at the delivered HEAD: `TMPDIR=$PWD/tmp/tmpdir pnpm check` (prompt/help conformance included), `bash scripts/.tests/test-doc-distribution.sh` (every new distributable doc carries its marker), and `bash scripts/.tests/test-inception-doc-consistency.sh` | NFR-4, NFR-6, AC-NFR4-1 | Gate run logs attached to the change | Phase 5 (re-verification; Phases 1–4 run their scoped suites) |
| DoD-13 | The generated plugin output is fresh: regenerated by the build script from the delivered source prompt changes and committed in the same change; no hand-edited generated files | NFR-4, RSK-6 | Plugin regen guard green (freshness check) | Phase 2 |
| DoD-14 | Review-time changed-file checks pass per plan phase: every phase's changed files match its declared scope, and NG-4 holds (zero changes under the delivering repository's own `.ai/memory/**`) | §7.2, NG-4, delivery process | TC-MEMSCAF-004 and TC-MEMWIRE-004 review-time changed-file checks green; per-phase pm-notes `notes:` evidence | Phases 1–5 (each phase's gate) |
| DoD-15 | PDR-0004 is landed beside its index row: the memory-practices distribution decision record and its row in the decision index stand together in the register, durably recording the OQ-2 resolution | F-6, OQ-2 | Decision register and index inspection | Phase 3 |
| DoD-16 | The M2-S9 backlog entry carries its Ticket and Progress markers per milestone delivery conventions | §16, §18 | Backlog inspection | Phase 5 |
| DoD-17 | PR posture: a pull request is created against `main-tools` and left open for human review with the required CI jobs green on the pushed HEAD; merge and owner acceptance remain external and are not claimed by this specification | §18, delivery process | PR record and CI run attached to the change | Phase 5, lifecycle phase 11 |

A condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery**: single change on a feature branch created from `main-tools`; the PR targets `main-tools` (repo is in the tooling transition; `main` is the frozen public baseline). Delivery conventions for later phases (commit primitive usage, conventional subjects, gate execution before PR) are recorded in the change pm-notes and are not restated here.
- **Adoption — new projects**: automatic; every bootstrap run from the delivered state wires the learning loop at Phase 5.
- **Adoption — existing projects**: manual; content-sync delivers the new templates, but the kernel section and instruction wiring are project-specific and must be adopted by hand using the installed adoption checklist. No retrofit automation (NG-6).
- **Communication**: milestone bookkeeping via the OSS-tooling backlog Progress marker and status notes per milestone delivery conventions; no user-facing release note obligations identified beyond the repository's own documentation.
- **Rollback**: revert-safe — the change is additive to bootstrap outputs; a revert restores the previous Phase 5 contract, and already-bootstrapped projects keep their scaffold (harmless, self-contained documentation and empty trees).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No migration. Seeding is structural only: Phase 5 seeds the memory tree **empty** — index entry point, per-agent entry-point READMEs, and empty lessons/tacit areas — carrying conventions, not records. No content is copied from this repository's planning area into target projects beyond what the installed convention set itself declares.

## 20. PRIVACY / COMPLIANCE REVIEW

Low impact. The memory conventions carried into bootstrapped projects prohibit secrets, tokens, credentials, and private identifiers in any memory location, and the manual doctor checklist includes a secret-pattern scan. The bootstrap safety rules (credential-pattern check before recording interview answers; no secrets in state or artifacts) are unchanged. No personal data flows are introduced.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Allowlist expansion is the security-relevant delta** (RSK-3): the write allowlist gains exactly the memory tree root and nothing broader; the explicit-confirmation rule for out-of-allowlist writes is unchanged.
- **Prompt-injection containment**: the memory conventions state that memory is advisory, untrusted input — it never overrides instructions, repository rules, or current truth — and external content must be quarantined/verified before influencing durable memory. Carrying these rules into new projects slightly *improves* the injection-resistance posture.
- **Generated-output integrity**: generated plugin output is regenerated by the build script and committed with the source change; hand-editing generated files remains prohibited.
- No new trust boundaries, credentials, or external surfaces.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Template upkeep**: new memory templates join the upstream-tracked template set; they content-sync into existing projects on update, so future convention changes propagate to project template copies but not to project-specific AGENTS.md/instructions (owners adopt manually).
- **Single-source discipline**: the kernel section content must be maintained in lockstep with the source section in the delivering repository; the review convention "mirror, don't fork" is the standing rule, and GH-301 is the next expected reconciler.
- **Doctor cadence**: until GH-301 automates it, memory health is checked by the documented manual cadence; findings route to retro notes.
- **Conformance surface**: prompt and distribution conformance scans now also cover the added memory content; they run in the aggregate gate.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Learning loop | The capture → candidate → promotion → consolidation cycle by which agent experience becomes durable, governed project memory |
| Memory tree | The committed `.ai/memory/**` layout: index entry point, per-agent entry points, lessons area, tacit area |
| Memory index | The README entry point of the memory tree listing what exists and when to read it |
| Per-agent entry point | The README inside each agent's own memory folder; the only memory file that agent always reads at session start |
| Kernel section | The memory section of a project's AGENTS.md: hard facts, routing, scope rules, invariants (~200-line guidance) |
| Capture bar | The durability test a candidate must pass before it is written as memory (repeat mistake, review catch, repeated correction, verified outcome, repeated workflow) |
| Promotion handoff | The routing that sends each accepted candidate to exactly one permanent home (lessons, tacit, fact, decision, norm, workflow) |
| Consolidation (curator) | The dedicated curation operation that merges, supersedes, prunes, and rebuilds shared memory surfaces |
| Retro-note conventions | Append-only retrospective notes with a generated index, carried by documentation until ceremony tooling exists |
| Doctor (manual) | The documentation-only memory-health checklist (coverage, budgets, dangling refs, contradictions, secret scan) used until memory lint lands |
| Change capsule | The per-change memory container (append-only events plus candidate proposals) owned by lifecycle commands; referenced, not modified, by this change |

## 24. APPENDICES

### Appendix A — Source mapping (twelve content classes → scaffold elements)

All twelve classes are the canonical set defined by F-2/DM-2/AC-F2-1 (v1.2), verified against this repository's AGENTS.md "Agent memory" section.

| Content class | Source in AGENTS.md "Agent memory" | Scaffold element receiving it |
|---------------|-------------------------------------|-------------------------------|
| (1) Canonical and ephemeral locations | Intro paragraph | Memory tree scaffold (F-1) + kernel section (F-2) |
| (2) Advisory/untrusted preamble | Intro paragraph | Kernel section (F-2) — echoed by the security posture (§21) |
| (3) Read policy | "Read policy." bullet | Kernel section (F-2), per-agent entry-point READMEs (F-1) |
| (4) Capture bar | "Capture bar." bullet | Kernel section (F-2), per-agent entry-point READMEs (F-1), coordinator instructions (F-3) |
| (5) Write ownership | "Write ownership." bullet | Kernel section (F-2), coordinator instructions (F-3) |
| (6) Evidence over recency (supersede, never rewrite) | "Evidence over recency." bullet | Kernel section (F-2), retro-note conventions (F-4) |
| (7) Unique ids | "Unique ids." bullet | Kernel section (F-2) |
| (8) Reviewer independence | "Reviewer independence." bullet | Kernel section (F-2) |
| (9) Caps and growth | "Caps and growth." bullet | Kernel section (F-2, incl. the topic-file split rule), scaffold entry points (F-1), manual doctor checklist (F-5), NFR-2 |
| (10) Promotion handoff | "Promotion handoff." bullet | Coordinator instructions (F-3), referenced by retro conventions (F-4) |
| (11) Capsule completion | "Capsule completion." bullet | Kernel section (F-2) — referenced only; capsules themselves out of scope |
| (12) Conflict reality | "Conflict reality." bullet | Kernel section (F-2) |

### Appendix B — Planning-truth pointers

- Ticket: GitHub issue #302 "M2-S9: Memory conventions in bootstrap templates (M2)", milestone "M2: Ceremonies, measurement, and memory" (owner-authored).
- Canonical scope: backlog story M2-S9 (OSS-tooling planning area); milestone pack under the m2 milestones folder.
- Scenario seeds **SC-M2-S9-01** (bootstrapped project starts with the memory layout) and **SC-M2-S9-02** (bootstrapped project carries capture and promotion rules) are inherited by the change test plan; their content is not restated in this spec.
- Binding PM decisions recorded in `chg-GH-302-pm-notes.yaml` and mirrored in the Decision Log (DEC-1, DEC-5).

### Appendix C — Constraint register (carried into plan/test authoring)

- C-1: mirror the current-truth kernel exactly; zero invented fields (DEC-1, NFR-1).
- C-2: no tooling, no code, no doctor automation (DEC-3, NG-1/NG-3).
- C-3: every new distributable doc carries its distribution marker; the distribution gate must pass (NFR-4).
- C-4: prompt changes are current-state only; conformance scans and help/reference checks stay green; generated plugin output ships with source (NFR-4, RSK-6).
- C-5: concept-area documents are in the license-header placement scope (F-6).
- C-6: PR targets `main-tools`; delivery conventions per pm-notes (Section 18).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | spec-writer (GLM-5.3-Flash) | Initial specification from ticket #302, backlog M2-S9, pm-notes decisions, and repo-truth verification |
| 1.1 | 2026-11-14 | spec-writer (GLM-5.3-Flash) | Correction (specification phase reopened): `.ai/memory` existence claims fixed — the tree exists and is populated (GH-204, 2026-11-07); NG-4 and the matching out-of-scope item now guard the populated tree; living-reference assumption added to Assumptions; affected-components row corrected. Constraint force unchanged; no AC, capability, DEC, or OQ changes |
| 1.2 | 2026-11-14 | spec-writer (GLM-5.3-Flash) | DoR iteration-1 remediation (NOT_READY; specification reopened). Finding dod_defined: added §17.1 "Definition of Done (change-specific)" — seventeen conditions (DoD-1..DoD-17) binding all eleven ACs, the manual-evidence items (bootstrap dry-run fidelity review, TC-MEMKERN-003 side-by-side fidelity review, review-time changed-file checks per plan phase), the full gate battery (`TMPDIR=$PWD/tmp/tmpdir pnpm check`, doc-distribution, inception-doc-consistency, plugin regen guard), PDR-0004 landing beside its index row, the M2-S9 backlog Ticket+Progress markers, and the PR posture — with the NG-4 populated-tree boundary and the DEC-1/DEC-3 pre-tooling posture as framing rules and a fail-closed closing rule. Finding spec_completeness: the kernel content-class enumeration in F-2, DM-2, and AC-F2-1 extended from ten to **twelve** classes verified against the source AGENTS.md "Agent memory" section — adding the advisory/untrusted preamble, unique ids (monotonic per prefix/year, never reused including after supersession or pruning), conflict reality, and the growth/split rule (caps and growth: topic-file split past ~50 lines); the former evidence-bar/supersede pair merged to match the source's single "Evidence over recency" class; F-2 records that all twelve classes fit the ~200-line kernel guidance, so AC-NFR2-1 (which measures entry points and index) is unaffected. Validation checklist gains the DoD line per sibling convention. No other AC, capability, DEC, or OQ touched; test plan and plan unmodified |
| 1.3 | 2026-11-14 | spec-writer (GLM-5.3-Flash) | DoR iteration-2 remediation (spec-internal drift). Appendix A synced to the twelve-class contract of F-2/DM-2/AC-F2-1 (v1.2): the eight bundled rows replaced by twelve single-class rows in the canonical order, each with an explicit source mapping into the AGENTS.md "Agent memory" section (intro paragraph for locations and the advisory/untrusted preamble; the named bullet for the ten bulleted classes) and accurate carried-by mappings; carried-by chains preserved from the previous rows where they were accurate. No AC, F-/DM-, or other section touched |

---

## AUTHORING GUIDELINES

Sources: GitHub issue #302 (owner-authored, verbatim AC intent); backlog story M2-S9; M2 milestone pack (scenario seeds referenced, not restated); `chg-GH-302-pm-notes.yaml` (binding decisions DEC-1/DEC-5 and delivery conventions); repo truth verified against SPEC-BOOTSTRAPPER (Phase 5 outputs + write allowlist), the inception guide's Phase 5 section, the bootstrapper agent prompt (allowlist block; no memory wiring present), the bootstrap command prompt, the template set inventory (no memory or retro templates exist), the planning-concepts inventory, and the install/sync behavior (templates upstream-tracked; project-specific files preserved).

Verification corrections applied against the planning summary: (1) the memory-practices concept already exists as a 2026-10-26 Draft — the spec treats it as align-and-finalize (F-6), not create-from-scratch; (2) no retro ceremony exists for bootstrapped projects — retro wiring is scoped to documentation carriers with ceremony explicitly deferred (DEC-4, NG-5); (3) the draft concept's adoption checklist names areas (`preferences`, retro archive) the current-truth kernel does not — resolved in favor of the kernel per the binding mirror constraint (DEC-2), with OQ-1 recording the revisit point; (4) GH-301 has no change artifacts yet — dependency confirmed open.

Constraints honored: scope statement only at capability level (no implementation steps or code-level directives in the body; component identities rather than repository file paths, except runtime artifact locations of target projects which are themselves the contract surface, e.g. the memory tree root in the allowlist contract); no content duplicated from the kernel section or scenario seeds — content classes and outcomes are referenced by name.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-302)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-, GAP-, NG-, G-, C-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR-/NG- ID and use Given/When/Then
- [x] Change-specific Definition of Done present (§17.1) — binds all eleven ACs, the manual-evidence items, the gate battery, PDR-0004 landing, the backlog markers, and the PR posture with per-condition verification and plan phases
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no repository code file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (kernel section, scenario seeds referenced by name only)
- [x] Front matter validates per front_matter_rules
