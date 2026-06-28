---
change:
  ref: GH-78
  type: docs
  status: Proposed
  slug: feature-spec-coverage-gate-and-debt
  title: "Spec-coverage gate and feature-spec debt reduction (GH-78 + GH-79)"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["docs", "process", "spec-coverage", "feature-specs", "gh-79"]
  version_impact: minor
  audience: mixed
  security_impact: none
  risk_level: medium
  dependencies:
    internal: ["doc-syncer agent", "pm agent", "change-lifecycle guide", "doc/spec/features", "GH-67 marker system"]
    external: []
links:
  related_changes: ["GH-79", "GH-67", "GH-46"]
  closes: ["GH-78", "GH-79"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Close a lifecycle process gap that allowed ADOS to repeatedly modify a major capability with no feature spec, and retire the audited feature-spec debt — by adding a falsifiable "feature spec coverage" check to the lifecycle and creating the 8 missing/partial P0–P2 feature specs.

## 1. SUMMARY

A single combined delivery (one PR, two tickets closed) of two linked issues:

- **GH-78 (process fix):** add a "feature spec coverage" check to **both** `clarify_scope` (phase 1) **and** `system_spec_update` (phase 7). When a change modifies a *feature area* that has no corresponding `doc/spec/features/feature-<slug>.md`, the gap is flagged and a follow-up is **proposed** — de-noised against existing trackers, and only ever ticketed by an explicit human approval. Proposal C (periodic standalone audit) is recorded as deferred.
- **GH-79 (spec debt):** create the **8** missing/partial feature specs identified by audit — delivery lifecycle, agents & commands system, decision-making framework, Claude plugin generation, quality gates + PR workflow, doc-distribution marker, local code review, and external-researcher — covering all P0/P1/P2 capabilities.

Both parts are documentation/process-only: GH-79 adds no behavior; GH-78 adds a new flagging behavior to `@doc-syncer` and a coverage awareness to intake. GH-78 is the primary `workItemRef` for artifact naming.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Lifecycle is 11-phase and gated** (`doc/guides/change-lifecycle.md`, `AGENTS.md` 11-phase table). `system_spec_update` = phase 7; `review_fix`=8; `quality_gates`=9; `dod_check`=10; `pr_creation`=11.
- **`clarify_scope` (phase 1)** cross-checks the ticket against `doc/spec/**` for **contradictions, dependencies, edge cases** (`.opencode/agent/pm.md` step 3b; lifecycle guide §1) — but it does **not** check whether the feature areas touched by the change have a spec at all.
- **`@doc-syncer` (phase 7)** reconciles `doc/spec/**`, contracts, domain, ops, guides (`.opencode/agent/doc-syncer.md` step 2 "Identify Impact" enumerates `doc/spec/features/`) — but it does **not** flag feature areas a change modifies that have no spec; it only updates/creates docs for what the change *introduces*.
- **8 feature specs exist** in `doc/spec/features/` (bootstrapper, decision-records, document-templates, documentation-profiles, license-header-script, onboarding-guide, remote-code-review, text-to-image-tool). They carry license headers but **no `ados_distribution` marker**.
- **Major capabilities have NO/partial spec:** the 11-phase lifecycle and PM orchestration (P0), the agents & commands system + model configuration (P0), decision-making framework (P1, partial — only decision-RECORDS are specified), Claude plugin generation / multi-tool support (P1), quality gates + commit/PR workflow (P1), the `ados_distribution` marker system (P2), local code review (P2, partial), and `@external-researcher` (P2).
- **The `ados_distribution` marker system (GH-67) is in place** but its guard (`scripts/.tests/test-doc-distribution.sh`) scans only `doc/guides`, `doc/templates/**`, and 5 standalone docs (the closed **DM-2** set). It does **not** scan `doc/spec/**`; feature specs are outside the marker/header automation surface.
- **`doc/spec/features` is created as an empty stub** by `install.sh` (`ADOS_LOCAL_DIRS`, install.sh line 121) — feature-spec **content is not redistributed**. The 4 existing decision-making/record guides (`doc/guides/decision-making.md`, `decision-records-management.md`) are `status: Draft`/`redistributable`; `doc/guides/change-lifecycle.md` and `doc/guides/definition-of-ready.md` are `status: Draft`.

### 2.2 Pain Points / Gaps

- **The coverage gap that motivated GH-78.** During a prior change, `system_spec_update` concluded "no spec change needed" while the feature being rewritten (the installer) had **no** feature spec. The lifecycle guards "don't ship a change contradicting an existing spec" but not "don't keep modifying a feature with no spec."
- **Incomplete `doc/spec/` mirror.** New contributors and the Definition of Ready gate cannot rely on `doc/spec/` as "current truth" when the flagship capabilities (lifecycle, agents/commands) are absent.
- **Spec-vs-behavior accuracy risk.** Several guides are `status: Draft`; the DoR guide states the **agent prompt wins** where guide and prompt differ. New specs must be authored from actual prompts/scripts/AGENTS.md, not idealized guides.
- **doc/spec outside automation.** Feature specs are neither marker-enforced nor auto-headed; adding the 8 new specs requires the explicit-path header mechanism (`scripts/add-header-location.sh <file>`).

## 3. PROBLEM STATEMENT

Because the lifecycle guards against contradicting an *existing* spec but not against *modifying a feature area that has no spec at all*, ADOS can repeatedly evolve major capabilities — the 11-phase delivery workflow, the agents-and-commands system that is the product — with no authoritative feature spec, leaving `doc/spec/` an incomplete mirror that new contributors, the readiness gate, and `@doc-syncer` cannot rely on for coverage, and quietly accumulating specification debt that only a one-off audit surfaces.

## 4. GOALS

- **G-1**: Add an **operational, falsifiable** "feature spec coverage" check to `clarify_scope` and `system_spec_update` so a change modifying a feature area with no spec is flagged and a de-noised follow-up is proposed (human-approved only).
- **G-2**: Create the **8** missing/partial P0/P1/P2 feature specs so `doc/spec/` covers every audited major capability.
- **G-3**: Author every new spec from **actual behavior** (prompts/AGENTS.md/scripts as authoritative; guides as mirrors) and surface guide-vs-prompt discrepancies as follow-up notes rather than silently picking one.
- **G-4**: **Cross-link, do not duplicate** — canonical lifecycle/convention/decision-record content is named and linked, not restated.
- **G-5**: Honest distribution classification (`ados_distribution: internal`) and no hand-added license headers.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| New feature specs created (P0–P2) | 8 / 8 |
| New specs citing ≥1 authoritative source (prompt/script/AGENTS.md) | 8 / 8 (100%) |
| Restated lifecycle/convention branch/folder/phase rules in new specs | 0 (cross-links instead) |
| Lifecycle places describing the feature-coverage check (GH-78) | ≥3 (doc-syncer prompt, clarify_scope, system_spec_update guide) |
| New feature specs carrying `ados_distribution: internal` | 8 / 8 |
| Hand-added license headers | 0 |
| `.ados-claude/` regenerated iff a `.opencode/` file is edited | 1:1 invariant |

### 4.2 Non-Goals

- **NG-1**: No change to agent behavior **beyond** the spec-coverage flagging/awareness semantics. GH-79 is specification-only; it changes no prompts, no scripts, no commands.
- **NG-2**: P3 minor agents (meeting-organizer, image-reviewer, editor, designer) are excluded — listed in GH-79 for completeness, not specced here.
- **NG-3**: The installer/onboarding spec (GH-77) is excluded — separate ticket; cross-linked as TBD only.
- **NG-4**: Do **not** extend `install.sh` or `test-doc-distribution.sh` to cover `doc/spec/**`. Feature-spec markers stay non-enforced by the guard (see NG of GH-67).
- **NG-5**: Do **not** retroactively mark the 8 existing feature specs (follow-up).
- **NG-6**: No automated "feature-area detection" tool — the check is a prompt-described agent behavior, not a script.
- **NG-7**: No split into two PRs — the single-PR, both-tickets-closed decision is an explicit override (DEC-1).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | **Feature spec coverage check** — identify the feature areas a change modifies, check `doc/spec/features/` for a corresponding spec, and when absent flag it + propose a follow-up. | Closes the root-cause gap; the check that was missing from both intake and reconciliation. |
| F-2 | **Operational "feature area" definition** — a capability is a feature area iff it warrants a `doc/spec/features/feature-<slug>.md`. | Makes F-1 falsifiable rather than subjective. |
| F-3 | **Eight feature specs** — one authoritative spec per audited P0–P2 capability (F-3.1…F-3.8). | Retires the audited debt; makes `doc/spec/` a reliable mirror. |
| F-4 | **Spec-vs-behavior reconciliation** — each spec is authored from the authoritative source hierarchy; guide-vs-prompt discrepancies are flagged as follow-ups. | Prevents speccing idealized behavior; "the prompt wins" is applied. |
| F-5 | **Distribution honesty + header hygiene** — new specs are `internal` and headed via the script's explicit-path mode. | No false redistributability claim; AI never hand-adds headers. |

### 5.1 Capability Details

**F-1 — Coverage check (two enforcement points).**

- *At `system_spec_update` (phase 7):* `@doc-syncer`'s **Identify Impact** step gains an explicit "feature spec coverage" sub-check. For each feature area the change modifies, it looks for a matching `doc/spec/features/feature-<slug>.md`. When absent, `@doc-syncer` **reports** the gap in its structured report (new field `spec_coverage_gaps`), it does **not** create a spec or a ticket. This is the missing positive check ("is there a spec for what we just changed?"), distinct from the existing reconciliation ("does the spec still match the implementation?").
- *At `clarify_scope` (phase 1):* `@pm`'s intake is made *aware* of spec coverage — when scoping a change, it notes whether the touched feature areas have specs, so a known coverage gap is visible before delivery rather than only after.
- **Handoff (de-noised, human-gated):** `@doc-syncer` **reports** the gap → `@pm` checks open issues for an existing tracker (e.g., GH-79, GH-77) and **references** it instead of proposing a duplicate (de-noising rule) → `@pm` **proposes** a follow-up → **only the human** approves ticket creation. `@doc-syncer` must never create tickets.

**F-2 — "Feature area" (operational definition).** A capability is a *feature area* iff it is substantial enough to warrant a `doc/spec/features/feature-<slug>.md` — i.e., a coherent, nameable capability a contributor or reviewer would expect to find a spec for (e.g., "the delivery lifecycle", "the agents & commands system", "code review", "decision-making"). Routine edits, one-off scripts, and bug fixes to already-specced areas are not "new feature areas." This makes the F-1 check falsifiable: a reviewer can name the feature area and confirm whether a spec exists.

**F-3 — The eight specs (target filenames in `doc/spec/features/`).** Each spec must (a) cover the listed scope, (b) cite authoritative sources, (c) cross-link canonical sources rather than restate them, (d) carry `ados_distribution: internal`, and (e) be headed via the script. The authoritative source map per spec:

| Spec | Coverage | Authoritative sources |
|------|----------|-----------------------|
| **F-3.1** `feature-delivery-lifecycle.md` (P0 #1) | The 11-phase spec→plan→deliver→review→PR gated workflow; PM orchestration; phase reopening; DoR/DoD gating; artifact set. | `AGENTS.md` (11-phase table), `doc/guides/change-lifecycle.md`, `.opencode/agent/{pm,spec-writer,test-plan-writer,plan-writer,readiness-reviewer,coder,doc-syncer,reviewer,committer,pr-manager}.md`, `.opencode/command/*.md`, `doc/guides/definition-of-ready.md`, `doc/guides/unified-change-convention-tracker-agnostic-specification.md` |
| **F-3.2** `feature-agents-and-commands.md` (P0 #2) | The agents & commands system as "the product"; `.opencode/` single source of truth; **model configuration nuance**; toolsmith by reference. | `.opencode/README.md`, `AGENTS.md` ("Multi-tool support"), `.opencode/agent/*.md` (frontmatter incl. `claude.model`), `.opencode/command/*.md`, `scripts/build-claude-plugin.sh`, `opencode*.jsonc` |
| **F-3.3** `feature-decision-making.md` (P1 #3) | The decision-making **process/framework** (rigor levels, decision kernel, classification, AI-authority model, decision modes) — the part NOT covered by the records spec. | `doc/guides/decision-making.md`, `.opencode/agent/{decision-advisor,decision-critic}.md`, `.opencode/command/{plan-decision,write-decision,review-decision}.md`, `.ai/agent/decision-instructions.md`; **cross-links** `feature-decision-records.md` (no duplication) |
| **F-3.4** `feature-claude-plugin-generation.md` (P1 #4) | `.opencode/` → `.ados-claude/` generation; single source of truth; idempotency; model-assignment plumbing; multi-tool extensibility; CI freshness gate. | `scripts/build-claude-plugin.sh`, `AGENTS.md` ("Multi-tool support"), `scripts/.tests/test-*.sh`, `.ados-claude/*` |
| **F-3.5** `feature-quality-gates-and-pr.md` (P1 #5) | Quality gates (`/check`, `/check-fix`); commit + PR workflow; runner/fixer/committer/pr-manager roles; platform config. | `.opencode/command/{check,check-fix,commit,pr}.md`, `.opencode/agent/{runner,fixer,committer,pr-manager}.md`, `.ai/agent/{pr-instructions,code-review-instructions}.md`, `doc/guides/pr-platform-integration.md` |
| **F-3.6** `feature-doc-distribution-marker.md` (P2 #6) | The `ados_distribution` marker system: values, two-path parser, derived install set, 5-mode drift guard, DM-2 scope. | `AGENTS.md` ("Doc distribution marker"), `doc/decisions/ODR-0001-classify-yaml-register-templates-redistributable.md`, `scripts/.tests/test-doc-distribution.sh`, `scripts/install.sh`; cross-links GH-67 as the delivering change and **GH-77 (installer spec) as TBD/out-of-scope** |
| **F-3.7** `feature-local-code-review.md` (P2 #7) | Local review: `/review`, `/review-deep`; spec/plan compliance + code-quality heuristics; remediation-phase append; relationship to the unified `@reviewer`. | `.opencode/command/{review,review-deep}.md`, `.opencode/agent/reviewer.md`; **cross-links** `feature-remote-code-review.md` (distinct workflow) |
| **F-3.8** `feature-external-researcher.md` (P2 #8) | MCP-driven external research: tool routing (context7/deepwiki/perplexity/web-search), untrusted-content handling, process, output. | `.opencode/agent/external-researcher.md`, `doc/guides/external-researcher-setup.md` |

**F-3.2 model-configuration nuance (must be captured accurately):** `claude.model` in an agent's frontmatter is a **Claude-Code-targeted hint** consumed by `scripts/build-claude-plugin.sh` to assign the model in the generated plugin; the **OpenCode-effective** model assignment lives in `opencode*.jsonc`. The two are independent concerns. The spec must state this precisely and not conflate them.

**F-4 — Reconciliation.** Where a `status: Draft` guide (e.g., `change-lifecycle.md`, `definition-of-ready.md`, `decision-making.md`) and a prompt disagree, the prompt is truth (per `definition-of-ready.md`'s explicit statement). Such discrepancies are captured as a "follow-up" note in the relevant spec rather than silently resolved.

**F-5 — Honesty + hygiene.** `ados_distribution: internal` is the honest classification: feature-spec content is **not** redistributed (only the empty `doc/spec/features/` stub is created by `install.sh`); `redistributable` would be a false claim; `internal` is consistent with the de-facto classification of the 8 existing (currently unmarked) specs. The marker is added for classification honesty and forward consistency — it is **not** guard-enforced because `doc/spec/**` is outside the guard's DM-2 scan set. License headers are applied by `scripts/add-header-location.sh <explicit-file-path>` (the script accepts an explicit path and is idempotent); **AI must not hand-add headers.**

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Change modifies a feature area WITH a spec (no-op, current behavior preserved)
  Change ships → system_spec_update → @doc-syncer finds feature-<slug>.md → reconciles it → no coverage gap → done.

Flow 2 — Change modifies a feature area WITHOUT a spec (the gap GH-78 closes)
  Change ships → system_spec_update → @doc-syncer identifies feature area, finds no spec
  → reports spec_coverage_gaps in structured report
  → @pm checks open issues for an existing tracker (de-noise: reference GH-79/GH-77 rather than duplicate)
  → @pm PROPOSES a follow-up to the human
  → ONLY the human approves ticket creation → @doc-syncer never creates a ticket

Flow 3 — Coverage visible at intake (clarify_scope)
  @pm scopes change → notes the touched feature area has no spec → records the known coverage gap
  → delivery proceeds (coverage is not a delivery blocker; it is a tracked gap)
  → surfaced again at system_spec_update (Flow 2)

Flow 4 — Authoring a new spec from actual behavior
  Identify capability → read authoritative prompt/script/AGENTS.md (NOT only the Draft guide)
  → reconcile: if guide and prompt differ, prompt wins; record discrepancy as a follow-up note
  → cross-link canonical sources (do not restate) → mark ados_distribution: internal → head via script
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

**Part A — GH-78 process fix (the edits that add the gate):**

- `.opencode/agent/doc-syncer.md` — the **Identify Impact** step gains an explicit "feature spec coverage" sub-check (identify feature areas modified → look for `doc/spec/features/feature-<slug>.md` → when absent, report `spec_coverage_gaps` in the structured report); the reporting/handoff rule (doc-syncer **reports**, never tickets) is stated.
- `.opencode/agent/pm.md` (clarify_scope, step 3b) — made **aware** of spec coverage: when scoping, note whether touched feature areas have specs (records the gap; not a delivery blocker).
- `doc/guides/change-lifecycle.md` (§7 system_spec_update) — documents the new "feature spec coverage" check.
- `doc/guides/definition-of-ready.md` (optional, lightweight) — may note coverage awareness at intake (not a new hard DoR facet — see 7.3).
- **"Feature area"** defined operationally (F-2).
- **Proposal C** (periodic standalone audit) recorded as **deferred** (7.3), not implemented.

**Part B — GH-79 specs (the 8 deliverables):** the 8 specs in §5.1 table (F-3.1…F-3.8), each meeting coverage/sources/cross-links/marker/header.

**Cross-cutting:** regenerate `.ados-claude/` via `scripts/build-claude-plugin.sh` **iff** any `.opencode/` file was edited (Part A edits doc-syncer.md and pm.md → regeneration required).

### 7.2 Out of Scope

- [OUT] P3 minor agents (meeting-organizer, image-reviewer, editor, designer) — no specs.
- [OUT] Installer/onboarding spec GH-77 — separate ticket; cross-linked TBD only.
- [OUT] Extending `install.sh` / `test-doc-distribution.sh` to scan `doc/spec/**` (guard stays non-enforcing for feature specs).
- [OUT] Retroactively marking the 8 existing feature specs.
- [OUT] An automated feature-area detection script (the check is prompt-described agent behavior).
- [OUT] Any agent/script/command behavior change beyond the spec-coverage flagging/awareness in F-1.
- [OUT] Splitting into two PRs.

### 7.3 Deferred / Maybe-Later

- **Proposal C — periodic standalone audit** of feature-spec coverage (not added now; the inline checks in F-1 are preferred as the forcing function).
- **`spec_coverage` as a formal DoR facet** in `@readiness-reviewer` — making coverage a hard pre-delivery gate. Not added now; the check is advisory + post-delivery reporting. Decision needed: consult `@decision-advisor`.
- **Extending DM-2** (the guard's scan set) to `doc/spec/features/**` so the marker becomes guard-enforced and retroactive marking of the 8 existing specs is forced.
- **`add-header-location.sh` / doc-spec drift reconciliation** — extending header/marker automation to cover `doc/spec/**` so feature specs are not reliant on the manual explicit-path mechanism.
- **Installer spec GH-77** — referenced as the natural home for cross-linking the marker/installer behavior.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface.

### 8.2 Events / Messages

N/A — no event/message surface.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | "Feature area" (concept) | Operational definition (F-2): a capability warranting a `doc/spec/features/feature-<slug>.md`. Makes the coverage check falsifiable. |
| DM-2 | `spec_coverage_gaps` (report field) | A new entry in `@doc-syncer`'s structured report: a list of modified feature areas lacking a spec. Report-only; carries no automated side effect. |

### 8.4 External Integrations

N/A — the change is internal to the ADOS repo (prompts, guides, specs).

### 8.5 Backward Compatibility

- **Additive.** The coverage check is a new flagging/awareness behavior; it does not alter existing reconciliation, gating, or install behavior.
- **Specs are new files.** No existing spec is modified; `feature-remote-code-review.md` and `feature-decision-records.md` are **cross-linked, not rewritten** (a companion `feature-local-code-review.md` and `feature-decision-making.md` are added — DEC-7).
- **Marker is non-enforcing** for `doc/spec/**`, so adding `ados_distribution: internal` cannot break the GH-67 guard (which does not scan `doc/spec`).
- **`.ados-claude/` is regenerated** only because Part A edits `.opencode/` files (doc-syncer.md, pm.md); the 1:1 invariant ("regenerate iff `.opencode/` edited") is preserved.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Authoritative sourcing — every new spec cites ≥1 prompt/script/AGENTS.md source | 8 / 8 specs (100%) |
| NFR-2 | No duplication — new specs cross-link canonical lifecycle/convention/decision-record sources | 0 restated branch/folder/phase/record rules |
| NFR-3 | Distribution honesty — each new spec carries `ados_distribution: internal` | 8 / 8 (100%) |
| NFR-4 | No hand-added license headers — all new specs headed via `scripts/add-header-location.sh <file>` | 0 hand-added; idempotent |
| NFR-5 | Falsifiable coverage check — "feature area" is operationally defined | A reviewer can name the area and confirm spec existence for any F-1 invocation |
| NFR-6 | Lifecycle accuracy — specs state the **11**-phase lifecycle (phase 7 = system_spec_update) | 0 references to the ticket's stale "10-phase / phase 6 doc-syncer" phrasing |
| NFR-7 | Plugin freshness — `.ados-claude/` regenerated iff `.opencode/` edited | Regeneration matches the set of `.opencode/` edits exactly |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- `@doc-syncer`'s structured report gains a `spec_coverage_gaps` field (DM-2) surfaced in its normal `<reporting>` output. No runtime metrics/logs/alerts beyond existing agent report output (this is a prompt-described behavior, not an instrumented service).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Spec≠behavior — authoring from `status: Draft` guides instead of prompts yields specs of idealized behavior | H | M | Source hierarchy (F-4): prompts/AGENTS.md/scripts authoritative; discrepancies flagged as follow-ups, not silently resolved | M |
| RSK-2 | Large, mixed diff (8 specs + 4 prompt/guide edits) is hard to review; the two issues blur | M | H | Clear Part A / Part B split; per-spec coverage table (§5.1); GH-78's 4 ACs isolated from GH-79's per-spec ACs | M |
| RSK-3 | `doc/spec/**` is outside marker/header automation — new specs rely on the manual explicit-path header mechanism and an unenforced marker | L | H | AC requires the script run per file; marker added for honesty; extend-DM-2 captured as a follow-up (7.3) | L |
| RSK-4 | "Feature area" too subjective → the coverage check is non-falsifiable / inconsistently applied | M | M | Operational definition (F-2/DM-1); de-noising + human-gate prevent noise | L |
| RSK-5 | `@doc-syncer` scope-creeps into creating tickets/specs | M | L | Explicit handoff rule (F-1): doc-syncer **reports**; PM **proposes**; human **approves** ticket creation only | L |
| RSK-6 | Single PR for two tickets deviates from "one ticket = one change," raising review/rollback risk | M | L | Documented override (DEC-1); both tickets close on one coherent PR; Part A/B are independently reviewable | L |
| RSK-7 | Companion-vs-broaden choice for local review (P2 #7) restructures a stable `status: Current` spec unexpectedly | M | L | Companion file chosen (DEC-7); remote spec untouched | L |

## 12. ASSUMPTIONS

- The **agent prompts and `AGENTS.md` describe actual behavior**; guides are human-readable mirrors, and where a guide is `status: Draft` and disagrees with a prompt, the prompt wins (stated explicitly in `doc/guides/definition-of-ready.md`).
- `doc/spec/features/` content is **not redistributed** — `install.sh` creates the directory as an empty stub (`ADOS_LOCAL_DIRS`); the GH-67 guard does not scan `doc/spec/**`. Therefore `ados_distribution: internal` is the honest classification and adding the marker cannot break the guard.
- The 8 existing feature specs carry **no** `ados_distribution` marker; this change classifies only the **8 new** specs (retroactive marking is a follow-up, NG-5).
- `scripts/add-header-location.sh` accepts an explicit file path and is idempotent (per `feature-license-header-script.md`), so heading the new specs via explicit path is safe and non-duplicative.
- The GH-79 ticket's references to a "10-phase" lifecycle and to "phase 6 doc-syncer / phases 8+9-10" are **stale**; the canonical lifecycle is **11 phases** with doc-syncer at phase 7 (per `AGENTS.md` and `change-lifecycle.md`).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-67 marker system (delivered) | Provides `ados_distribution` values + the parser; this change reuses `internal` for honesty. `doc/spec/**` is explicitly outside its DM-2 scan set. |
| Depends on | ODR-0001 (Accepted) | Authoritative marker semantics for F-3.6. |
| Related (out of scope) | GH-77 (installer spec) | Cross-linked TBD in F-3.6; not delivered here. |
| Closes | GH-78, GH-79 | Both closed by this single PR (DEC-1). |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should feature-spec coverage become a **hard DoR facet** (`spec_coverage`) enforced pre-delivery by `@readiness-reviewer`, rather than advisory intake + post-delivery reporting? | F-1 is advisory/reporting; a hard gate would catch the gap earlier but could block trivial changes. | Decision needed: consult `@decision-advisor` (captured as 7.3 follow-up). |
| OQ-2 | Should DM-2 be extended to scan `doc/spec/features/**` so the marker is guard-enforced (and the 8 existing specs retroactively marked)? | Today the marker on feature specs is honest-but-unenforced (RSK-3). | Captured as 7.3 follow-up; not decided in this change. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | **Single PR closes both GH-78 and GH-79;** GH-78 is the primary `workItemRef`. Explicit override of the red-team two-PR recommendation and of "one ticket = one change." | The gate fix (GH-78) and the debt it surfaces (GH-79) are one coherent unit; the specs are exactly what the gate will in future flag. Deviation recorded. | 2026-06-28 |
| DEC-2 | All 8 new specs are `ados_distribution: internal`. | Feature-spec content is not redistributed (empty stub only); `redistributable` would be a false claim; `internal` matches the de-facto classification of the existing specs. | 2026-06-28 |
| DEC-3 | **Cross-link, do not duplicate** lifecycle/convention/decision-record content. | Resolves the ticket's "fold in to stop duplication" vs "no duplication" contradiction; specs name + link canonical sources. | 2026-06-28 |
| DEC-4 | Canonical lifecycle = **11 phases**; doc-syncer/system_spec_update = phase 7. | `AGENTS.md` + `change-lifecycle.md` authoritative; the ticket's "10-phase" phrasing is stale. | 2026-06-28 |
| DEC-5 | "Feature area" defined **operationally** (warrants a `feature-<slug>.md`). | Makes the GH-78 check falsifiable (F-2/DM-1). | 2026-06-28 |
| DEC-6 | doc-syncer **reports** → PM **proposes** (de-noised) → **human** approves ticket creation; doc-syncer never creates tickets. | Keeps the gate non-prescriptive; prevents duplicate trackers; preserves human ownership of the backlog. | 2026-06-28 |
| DEC-7 | Local code review (P2 #7) = a **companion** `feature-local-code-review.md`, not a broadening of the remote spec. | Local and remote review are distinct workflows (different commands `/review`,`/review-deep` vs `/review-remote`; different inputs/outputs/state; different heuristics focus). Broadening would conflate them and disrupt a stable `status: Current` spec; companion matches the one-capability-per-spec pattern. | 2026-06-28 |
| DEC-8 | License headers via `scripts/add-header-location.sh <explicit-path>`; AI never hand-adds headers. | Per AGENTS.md header policy; the script is idempotent and accepts explicit paths (doc/spec is not in its default scan paths). | 2026-06-28 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.opencode/agent/doc-syncer.md` | Updated — feature spec coverage sub-check + `spec_coverage_gaps` report field + handoff rule (Part A) |
| `.opencode/agent/pm.md` | Updated — clarify_scope coverage awareness (Part A) |
| `doc/guides/change-lifecycle.md` | Updated — system_spec_update documents the coverage check (Part A) |
| `doc/guides/definition-of-ready.md` | (Optional) lightweight coverage-awareness note (Part A) |
| `doc/spec/features/feature-delivery-lifecycle.md` | New (F-3.1) |
| `doc/spec/features/feature-agents-and-commands.md` | New (F-3.2) |
| `doc/spec/features/feature-decision-making.md` | New (F-3.3) |
| `doc/spec/features/feature-claude-plugin-generation.md` | New (F-3.4) |
| `doc/spec/features/feature-quality-gates-and-pr.md` | New (F-3.5) |
| `doc/spec/features/feature-doc-distribution-marker.md` | New (F-3.6) |
| `doc/spec/features/feature-local-code-review.md` | New (F-3.7) |
| `doc/spec/features/feature-external-researcher.md` | New (F-3.8) |
| `.ados-claude/` | Regenerated (Part A edits `.opencode/`) |

## 17. ACCEPTANCE CRITERIA

> Grouped by area; Given/When/Then; each links to ≥1 F-/NFR-/DM- ID. Combines GH-78's 4 ACs with GH-79's per-spec coverage.

### A. GH-78 — the coverage gate (F-1, F-2, NFR-5, DM-1, DM-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** `.opencode/agent/doc-syncer.md`, **when** read, **then** its Identify Impact step contains an explicit "feature spec coverage" check that identifies modified feature areas and looks for a `doc/spec/features/feature-<slug>.md`, reporting gaps in a structured `spec_coverage_gaps` field. | F-1, DM-2 |
| AC-F1-2 | **Given** the doc-syncer handoff rule, **when** a coverage gap is found, **then** `@doc-syncer` reports it and does **not** create a spec or a ticket; only `@pm` proposes a follow-up and only the human approves ticket creation. | F-1 |
| AC-F1-3 | **Given** a proposed follow-up, **when** `@pm` prepares it, **then** it first checks open issues for an existing tracker (de-noising) and references it rather than proposing a duplicate. | F-1 |
| AC-F1-4 | **Given** `.opencode/agent/pm.md` clarify_scope, **when** read, **then** it mentions verifying/awareness of feature-spec coverage for the touched areas. | F-1 |
| AC-F1-5 | **Given** `doc/guides/change-lifecycle.md` §7 (system_spec_update), **when** read, **then** it documents the feature spec coverage check. | F-1, NFR-6 |
| AC-F1-6 | **Given** "feature area" is used by the check, **then** it is operationally defined (warrants a `feature-<slug>.md`) so the check is falsifiable. | F-2, DM-1, NFR-5 |

### B. GH-78 — plugin regeneration (F-1, NFR-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-7 | **Given** Part A edits `.opencode/` files (doc-syncer.md, pm.md), **when** delivery completes, **then** `.ados-claude/` has been regenerated via `scripts/build-claude-plugin.sh` and is current. | NFR-7 |

### C. GH-79 — the 8 specs exist and meet coverage (F-3, NFR-1, NFR-6)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** `doc/spec/features/`, **when** listed, **then** all 8 target files exist: `feature-delivery-lifecycle.md`, `feature-agents-and-commands.md`, `feature-decision-making.md`, `feature-claude-plugin-generation.md`, `feature-quality-gates-and-pr.md`, `feature-doc-distribution-marker.md`, `feature-local-code-review.md`, `feature-external-researcher.md`. | F-3 |
| AC-F3-2 | **Given** `feature-delivery-lifecycle.md`, **when** read, **then** it covers the **11**-phase workflow + PM orchestration + phase reopening + DoR/DoD gating and cites ≥1 authoritative source from the F-3.1 source map. | F-3.1, NFR-1, NFR-6 |
| AC-F3-3 | **Given** `feature-agents-and-commands.md`, **when** read, **then** it states the model-configuration nuance accurately (`claude.model` = Claude-Code hint consumed by the build script; OpenCode-effective assignment in `opencode*.jsonc`) and references `@toolsmith`. | F-3.2, NFR-1 |
| AC-F3-4 | **Given** `feature-decision-making.md`, **when** read, **then** it covers the decision **process/framework** (not just records) and **cross-links** `feature-decision-records.md` without duplicating it. | F-3.3, NFR-1, NFR-2 |
| AC-F3-5 | **Given** `feature-claude-plugin-generation.md`, **when** read, **then** it covers `.opencode/`→`.ados-claude/` generation, single source of truth, idempotency, and the CI freshness gate, citing `scripts/build-claude-plugin.sh`. | F-3.4, NFR-1 |
| AC-F3-6 | **Given** `feature-quality-gates-and-pr.md`, **when** read, **then** it covers `/check`, `/check-fix`, the commit + PR workflow, and runner/fixer/committer/pr-manager roles. | F-3.5, NFR-1 |
| AC-F3-7 | **Given** `feature-doc-distribution-marker.md`, **when** read, **then** it covers the marker values, two-path parser, derived install set, 5-mode guard, and DM-2 scope, citing ODR-0001 and the guard; cross-links GH-67 and marks GH-77 TBD. | F-3.6, NFR-1 |
| AC-F3-8 | **Given** `feature-local-code-review.md`, **when** read, **then** it covers `/review`, `/review-deep`, spec/plan compliance + heuristics, remediation-phase append, and **cross-links** (does not duplicate) `feature-remote-code-review.md`. | F-3.7, NFR-1, NFR-2 |
| AC-F3-9 | **Given** `feature-external-researcher.md`, **when** read, **then** it covers MCP tool routing, untrusted-content handling, and the output contract, citing `.opencode/agent/external-researcher.md`. | F-3.8, NFR-1 |

### D. GH-79 — cross-link, no duplication; honesty + hygiene (F-4, F-5, NFR-2, NFR-3, NFR-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** any of the 8 new specs, **when** read, **then** canonical lifecycle/convention/decision-record rules are **cross-linked** (named + linked), not restated. | NFR-2 |
| AC-F4-2 | **Given** any of the 8 new specs, **when** read, **then** where a `status: Draft` guide and a prompt disagree, the spec follows the prompt and records the discrepancy as a follow-up note (not a silent choice). | F-4 |
| AC-F5-1 | **Given** the 8 new specs, **when** inspected, **then** each carries `ados_distribution: internal` in its frontmatter. | F-5, NFR-3 |
| AC-F5-2 | **Given** the 8 new specs, **when** headed, **then** headers were applied via `scripts/add-header-location.sh <file>` (idempotent) and **none** was hand-added by the AI. | F-5, NFR-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

1. Deliver Part A (gate) and Part B (8 specs) together in one PR; regenerate `.ados-claude/` because Part A edits `.opencode/`.
2. Review Part A (process/behavior) and Part B (documentation) as independently as possible using the §5.1 coverage table.
3. On merge, the new coverage check takes effect for subsequent changes; the 8 specs become the authoritative mirror `@doc-syncer` reconciles against.
4. Communicate internally: maintainers should expect `@doc-syncer` to start reporting `spec_coverage_gaps` for changes touching unspecced feature areas.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data. The new specs are static documentation; the `spec_coverage_gaps` report field is ephemeral per-change output.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no personal data is processed. New specs reference only public repo artifacts (prompts, scripts, guides, decisions).

## 21. SECURITY REVIEW HIGHLIGHTS

- No code execution, secrets, or credentials involved (documentation/process only).
- The coverage check is a read/report behavior in `@doc-syncer`; it creates no side effects beyond the existing report.
- `@doc-syncer`/`@pm` continue to respect the existing no-invention/no-auto-ticket discipline (DEC-6).

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Ongoing:** `@doc-syncer` will surface `spec_coverage_gaps` per change; `@pm` triages these via the de-noised, human-gated flow. Over time this keeps `doc/spec/` coverage from regressing.
- **New specs add a maintenance surface** (8 docs to keep current); this is the intended outcome and is exactly what `system_spec_update` reconciles.
- **No new CI step.** The GH-67 guard is unchanged; `doc/spec/**` remains outside DM-2 by design.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Feature area | A coherent capability warranting a `doc/spec/features/feature-<slug>.md` (operational definition, F-2/DM-1). |
| Feature spec coverage check | The new lifecycle behavior: identify modified feature areas, look for their spec, report gaps (F-1). |
| `spec_coverage_gaps` | New `@doc-syncer` report field listing modified feature areas lacking a spec (DM-2). |
| Source hierarchy | Prompts/AGENTS.md/scripts are authoritative; guides are mirrors; "the prompt wins" on conflict (F-4). |
| DM-2 | The closed set of file classes the GH-67 distribution guard scans (excludes `doc/spec/**`). |
| Companion spec (local review) | A new `feature-local-code-review.md` distinct from the existing remote-review spec (DEC-7). |

## 24. APPENDICES

- **Appendix A — Spec inventory after this change.** Existing 8 + new 8 = 16 feature specs in `doc/spec/features/`. The 8 new specs cover: delivery lifecycle (P0), agents & commands (P0), decision-making (P1), Claude plugin generation (P1), quality gates & PR (P1), doc-distribution marker (P2), local code review (P2), external-researcher (P2). P3 minor agents intentionally unspecced.
- **Appendix B — Authoritative-source map.** See §5.1 table (F-3.1…F-3.8) for the per-spec source list. Priority: (1) agent/command prompts + `AGENTS.md` + scripts; (2) guides (human-readable mirrors; several `status: Draft`).
- **Appendix C — Flagged discrepancies / follow-ups.** (a) GH-79 ticket's "10-phase / phase-6 doc-syncer" phrasing is stale → specs use 11 phases (DEC-4). (b) `doc/spec/**` is outside the marker/header automation surface → new specs rely on the explicit-path header mechanism and an honest-but-unenforced `internal` marker (RSK-3; follow-up 7.3). (c) GH-79's "likely folds into installer spec GH-77" for the marker → GH-77 is out of scope; marker spec is standalone with GH-77 cross-linked TBD.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-28 | @spec-writer | Initial specification for GH-78 (combined GH-78 + GH-79 single-PR delivery) |

---

## AUTHORING GUIDELINES

- Sources: GitHub issues GH-78 and GH-79 (PM-provided context); authoritative repo artifacts read and reconciled during authoring — `AGENTS.md`, `.opencode/agent/{pm,doc-syncer,external-researcher}.md`, `.opencode/command/{review,review-deep}.md`, `doc/guides/{change-lifecycle,definition-of-ready,decision-making}.md`, `doc/decisions/ODR-0001-...md`, `scripts/{install.sh,build-claude-plugin.sh}`, `scripts/.tests/test-doc-distribution.sh`, and the existing feature specs (`feature-decision-records.md`, `feature-remote-code-review.md`, `feature-license-header-script.md`) for format/conventions.
- Every behavioral claim was checked against the actual prompt/script rather than the ticket prose. The ticket's stale "10-phase" lifecycle phrasing was corrected to 11 (DEC-4). Where a guide is `status: Draft`, the prompt is treated as truth and any divergence is recorded as a follow-up (F-4 / Appendix C), not silently resolved.
- The `doc/spec/features` install claim in PM decision #2 was verified: `install.sh` creates the directory only as an empty stub (`ADOS_LOCAL_DIRS`), and the GH-67 guard does not scan `doc/spec/**` — confirming `internal` as the honest, non-breaking marker value.
- PM decisions 1–8 (DEC-1…DEC-8) were treated as settled inputs, not re-litigated. The companion-vs-broaden choice for local review (DEC-7) was resolved here toward the less-disruptive option per the authoring guidance.
- File paths are cited for traceability and scope definition (matching repo convention and the GH-67 exemplar), not as step-by-step implementation instructions; the plan-writer derives tasks from this scope.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-78)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No step-by-step implementation tasks or commit/git instructions (paths cited for traceability only)
- [x] No content duplicated from linked docs (cross-link convention enforced)
- [x] Front matter validates per front_matter_rules
