---
id: chg-GH-57-test-plan
status: Proposed
created: 2026-06-27
last_updated: 2026-06-27
owners: ["Juliusz Ćwiąkalski"]
service: delivery-lifecycle
labels: ["readiness-gate", "definition-of-ready", "dor", "agent", "lifecycle", "meta"]
version_impact: minor
summary: "Test plan for GH-57 (Definition of Ready gate: @readiness-reviewer + /check-readiness + dor_check phase 5 + 11-phase renumber + ADR-0002). Honest about the testing reality (RSK-4, carried from GH-71 DEC-9 / GH-72 NFR-8): the deliverable is agent/command/guide/PM-prompt definitions + a renumbering sweep, so most AC are behavioral agent-capability claims that CANNOT be unit-tested in CI. Coverage = (A) structural/PR-review checks (phase presence, 0 stale 10-phase refs, inventory entries, prompt encodes adversarial stance + hard-gate + override-record + decision-routing, @reviewer unchanged) where greppable, (B) CI gates backed by REAL existing scripts (plugin freshness, doc-distribution marker, install/uninstall consistency, license headers), (C) a manual TC-MANUAL-* verification matrix mapping each behavioral AC to a human-checkable step, with AC10 = GH-57 dogfooding the gate end-to-end. Every AC1..AC10 + key NFRs traced to TC IDs."
links:
  change_spec: ./chg-GH-57-spec.md
  implementation_plan: ./chg-GH-57-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
  decisions: ["ADR-0002"]
---

# Test Plan - Add Definition of Ready gate (@readiness-reviewer) to validate change artifacts before delivery

## 1. Scope and Objectives

GH-57 inserts a **pre-delivery Definition of Ready (DoR) gate** into ADOS's delivery
workflow: one new agent (`@readiness-reviewer`), one new command (`/check-readiness`), and
one new lifecycle phase (`dor_check`, inserted as **phase 5**; existing 5–10 renumbered to
**6–11**). The gate loads the complete artifact set (spec + test-plan + plan) plus the source
ticket, applies a structured multi-facet DoR under an **adversarial/critical stance**,
and emits a `READY` / `NOT_READY` verdict with per-facet findings — the single
highest-leverage checkpoint, because a flaw caught here saves the entire downstream
implementation cost. It is the deliberate **pair** of the post-implementation `@reviewer`
(Definition of Done): DoR audits **artifacts vs ticket** pre-implementation; DoD audits
**code vs spec/plan** post-implementation. The authoritative DoR lives in the prompt; a
redistributable guide mirrors it; the design is recorded as **ADR-0002** (acceptance rides
this PR). `.ados-claude/` is regenerated via `scripts/build-claude-plugin.sh`.

**Core behavior to protect:**

1. **11-phase flow, dor_check = phase 5 (AC8, NFR-1, DEC-8)** — after delivery, exactly 11
   phases; `dor_check` sits between `delivery_planning` and `delivery`; **0 stale references**
   to the old 10-phase numbering across `doc/guides/change-lifecycle.md` (mermaid + tables +
   phase sections), `AGENTS.md` (phase/agent/command tables + manual sequence), `.opencode/README.md`,
   and `.opencode/agent/pm.md` (workflow + PM-notes map).
2. **DoR/DoD role separation (AC9, NFR-9)** — `@reviewer` (now phase 8) role text is
   **unchanged**: still Definition of Done, code-vs-spec, post-implementation, reads diffs.
   `@readiness-reviewer` is a distinct agent/invocation. The two gates are never conflated.
3. **Adversarial + independent + holistic (AC2, AC3, F-3, NFR-8)** — `@readiness-reviewer`
   actively seeks gaps/contradictions/unstated assumptions, does not rubber-stamp, and is
   independent of `@spec-writer`/`@test-plan-writer`/`@plan-writer`; it reviews the **whole**
   artifact set together (cross-artifact consistency is the highest-value facet).
4. **Gap-driven reopening never targets delivery (AC4, F-4, RSK-8)** — a `NOT_READY` verdict
   reopens an **artifact-creation phase** (`specification`/`test_planning`/`delivery_planning`),
   **never** `delivery`. A gap is an artifact problem, not a code problem.
5. **Hard gate + recorded override (AC6, DM-4, NFR-7)** — the gate blocks by default; the
   **only** bypass is an explicit, recorded override (`workItemRef` + rationale + approver +
   date). **No silent/unconditional skip path** exists — a silent skip reintroduces the
   sycophancy this gate exists to prevent.
6. **Decision capture + human pause (AC5, AC7, DM-5)** — change-scoped decisions → change
   docs; system-wide/precedent-setting → proposed decision record under `doc/decisions/**`
   (ADR-0002 is the exemplar); needs-human-input → STOP and wait.

**Testing reality (governs the whole plan — read this first):**

The artifact under test is **agent/command/PM-prompt definitions** + a **renumbering sweep**
+ a **redistributable guide** + a **decision record** — not runnable application code. Per
the repo testing strategy (`.ai/rules/testing-strategy.md`: `doc/**` + agent definitions →
static/diff + content checks; "Fallback rules": prompt/doc-only changes → automated tests
**N/A**, require **manual verification** + `git diff --check`). An LLM agent's adversarial
behavior **cannot** be executed deterministically in CI (RSK-4; GH-71 DEC-9 / GH-72 NFR-8).

> **Reconciliation with GH-71 DEC-9 / GH-72.** This plan inherits the GH-72 honesty bar
> verbatim. The `TC-CI-*` family maps to **real, existing CI scripts** (plugin freshness,
> doc-distribution marker, install/uninstall consistency, license headers) — mechanical,
> file-level invariants, **none of which assert agent behavior**. The `TC-STRUCT-*` family is
> **PR-review intent checks** (a human reads the diff): the NFR-1 renumbering sweep, phase
> presence, inventory entries, and the prompt-*content* members (adversarial stance,
> hard-gate + override-record fields, decision-routing, @reviewer unchanged). They are
> deliberately **not** frozen-wording greps that would fossilize the prompts — except the
> NFR-1 *phase-number* sweep, which is greppable because phase numbers are a structural
> contract, not prompt prose. Behavioral AC coverage is the **manual `TC-MANUAL-*` matrix**,
> with AC10 = GH-57 dogfooding the gate on its own delivery. This plan **never** claims a
> behavioral AC is CI-testable.

### 1.1 In Scope

- **CI gates (B), `TC-CI-001`…`TC-CI-004`** — `.ados-claude` byte-freshness (NFR-5); the
  redistributable guide marker + doc-distribution guard (NFR-6); install/uninstall manifest
  consistency (the new redistributable guide enters the install set); license-header
  preservation on the header-required paths.
- **Structural / PR-review checks (A), `TC-STRUCT-001`…`TC-STRUCT-014`** — the NFR-1
  renumbering sweep (greppable); 11-phase presence + dor_check = phase 5; inventory entries;
  `@pm` workflow dor_check step + reopening-logic routes to artifact phases (not delivery) +
  PM-notes `dor_check` entry; prompt encodes adversarial stance + independence + DoR facets +
  hard-gate + override-record fields (DM-4) + decision-routing (DM-5); DoR source-of-truth
  discipline; `@reviewer` role text unchanged; house-style parity; ADR-0002 present; prompt-size
  discipline.
- **Manual behavioral matrix (C), `TC-MANUAL-001`…`TC-MANUAL-008`** — one human-run row per
  behavioral AC: adversarial stance actually applied (AC3), holistic verdict (AC2),
  gap-driven reopening to artifact phases (AC4), human pause on decisions (AC5), override
  discipline (AC6), decision routing (AC7), end-to-end dogfood via GH-57 itself (AC10), and
  DoR/DoD role separation observed at runtime (AC9).

### 1.2 Out of Scope & Known Gaps

- **No CI test executes any agent.** No behavioral AC (AC2, AC3, AC4, AC5, AC6, AC7, AC10) is
  CI-testable; all are the `TC-MANUAL-*` matrix + PR review (RSK-4; NFR-8).
- **The deterministic mechanical `ados check-readiness` pre-check (#49)** — explicitly OUT OF
  SCOPE (NG-3, DEC-6); a future complement, never a dependency. Not tested here.
- **Post-delivery retrospectives (GH-43)** — complementary but post-delivery (NG-4). Not tested.
- **The post-implementation `@reviewer` (DoD) behavior itself** — its role is *preserved
  unchanged* (AC9); it is not re-tested (its own change owns that).
- **Authoring the ADR / agent / command / PM-prompt wording** — produced via the decision
  workflow (`@decision-advisor`) and delegated to `@toolsmith` (DEC-9, repo hard rule). This
  plan only verifies their **outcomes** (presence, parity, stance encoded, role separation),
  not their authoring.
- **System-spec reconciliation** — `@doc-syncer` handles any phase-7 reconciliation; not a
  test target at plan time.
- **Runtime telemetry — N/A** (spec §10): the persisted gate verdict + per-facet findings
  (DM-2), override records (DM-4), and `phases.dor_check` in pm-notes (DM-1) are the durable
  artifacts humans inspect.
- **Frozen-wording prompt greps** — deliberately NOT introduced (DEC-9 reconciliation); the
  prompt-content `TC-STRUCT-*` members are PR-review intent checks, not brittle string
  assertions. The one greppable member is the **phase-number** sweep (TC-STRUCT-001), because
  phase numbers are a structural contract.

## 2. References

| Ref | Path |
|-----|------|
| Change spec (primary traceability source) | `./chg-GH-57-spec.md` |
| Implementation plan | `./chg-GH-57-plan.md` *(to be authored)* |
| Design authority (decision) | `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md` *(deliverable)* |
| Honesty/structure precedent (DEC-9, TC-* convention) | `../2026-06-27--GH-72--tribal-knowledge-extraction/chg-GH-72-test-plan.md` |
| File under test — new agent (OpenCode source) | `.opencode/agent/readiness-reviewer.md` *(deliverable)* |
| File under test — new command (OpenCode source) | `.opencode/command/check-readiness.md` *(deliverable)* |
| File under test — generated plugin counterparts | `.ados-claude/agents/readiness-reviewer.md`, `.ados-claude/commands/check-readiness.md` *(regenerated)* |
| File under test — modified PM prompt | `.opencode/agent/pm.md` (workflow steps + PM-notes `phases` map + reopening logic) |
| House-style sibling to mirror | `.opencode/agent/reviewer.md` (frontmatter `claude.model: opus`, role/non_goals, adversarial heuristics, structured findings, read-only safety rules) |
| File to be authored — redistributable mirror guide | `doc/guides/definition-of-ready.md` *(deliverable)* |
| File under test — modified lifecycle guide | `doc/guides/change-lifecycle.md` (mermaid + agent-responsibility + phase-reopening tables + phase sections + PM-notes map) |
| File under test — modified inventory surfaces | `AGENTS.md` (phase/agent/command tables + manual sequence); `.opencode/README.md` |
| Decision register | `doc/decisions/00-index.md` (ADR-0002 row) |
| Decision-capture authority | `doc/guides/decision-records-management.md` |
| Testing strategy | `.ai/rules/testing-strategy.md` |
| CI guard — plugin freshness | `scripts/.tests/test-build-claude-plugin.sh` |
| CI guard — doc distribution | `scripts/.tests/test-doc-distribution.sh` (+ `test-doc-distribution-modes.sh`) |
| CI guard — install/uninstall consistency | `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh` |
| CI guard — license headers | `scripts/.tests/test-add-header-location.sh` |
| Regeneration script | `scripts/build-claude-plugin.sh` |
| Authoritative AC source | GitHub issue GH-57 (+ owner comments #1, #2) |

## 3. Coverage Overview

> **Coverage model:** each AC maps to ≥1 TC. `TC-CI-*` are mechanical gates backed by real
> existing scripts. `TC-STRUCT-*` are PR-review intent checks (the NFR-1 phase-number sweep is
> greppable; prompt-content members are diff reads, not frozen-wording greps — DEC-9 bar).
> Behavioral AC are **manual only** (`TC-MANUAL-*`). **Every AC1..AC10 is covered.**

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (Given/When/Then) | TC ID(s) | Status |
|-------|-------------------------------|----------|--------|
| AC1 | DoR checklist is **authoritative** in the `@readiness-reviewer` prompt and **mirrored** in `doc/guides/definition-of-ready.md`, which states the prompt is authoritative. | TC-CI-002 (CI), TC-STRUCT-009 (PR-review), TC-STRUCT-011 (PR-review) | Covered |
| AC2 | Given all artifacts exist, when `dor_check` runs, then `@readiness-reviewer` reviews the full set together vs the ticket and emits `READY`/`NOT_READY` + per-facet findings, as new phase 5. | TC-CI-001 (CI), TC-STRUCT-002 (PR-review), TC-STRUCT-005 (PR-review), TC-MANUAL-002 (manual) | Covered |
| AC3 | Given the gate runs, then it adopts an adversarial/critical stance and is independent of the author agents. | TC-STRUCT-006 (PR-review), TC-MANUAL-001 (manual) | Covered |
| AC4 | Given a `NOT_READY` (e.g., test-plan not tracing to an AC), then the workflow reopens the relevant artifact-creation phase, **not** `delivery`. | TC-STRUCT-004 (PR-review), TC-MANUAL-003 (manual) | Covered |
| AC5 | Given a decision needing human input, then the workflow pauses (STOP and wait) before proceeding. | TC-STRUCT-008 (PR-review), TC-MANUAL-004 (manual) | Covered |
| AC6 | Given a change reaches `dor_check`, then it blocks by default and the only bypass is an explicit, recorded override (workItemRef + rationale + approver + date); no silent skip. | TC-STRUCT-007 (PR-review), TC-MANUAL-005 (manual) | Covered |
| AC7 | Given a decision surfaced: change-scoped → change docs; system-wide/precedent-setting → proposed decision record under `doc/decisions/**`. | TC-STRUCT-008 (PR-review), TC-STRUCT-013 (PR-review), TC-MANUAL-006 (manual) | Covered |
| AC8 | Given GH-57 ships, then `dor_check` (phase 5), `@readiness-reviewer`, and `/check-readiness` are reflected in lifecycle + pm.md + AGENTS.md + README, subsequent phases renumbered to 6–11, and the mermaid + agent-responsibility + phase-reopening tables are updated. | TC-CI-001 (CI), TC-STRUCT-001 (PR-review), TC-STRUCT-002 (PR-review), TC-STRUCT-003 (PR-review) | Covered |
| AC9 | Given GH-57 ships, then `@reviewer` (now phase 8) role is unchanged (DoD, code-vs-spec, post-impl) and distinct from `@readiness-reviewer` (DoR). | TC-STRUCT-010 (PR-review), TC-MANUAL-008 (manual) | Covered |
| AC10 | Given a change delivered through the 11-phase workflow, then `dor_check` executes end-to-end (READY → delivery, or NOT_READY → artifact phase); GH-57 dogfoods the gate. | TC-MANUAL-007a (surrogate), TC-MANUAL-007b (deferred) | Covered (surrogate + deferred) |

| F ID | Capability | TC ID(s) |
|------|-----------|----------|
| F-1 | Definition of Ready (authoritative prompt + redistributable mirror) | TC-CI-002, TC-STRUCT-009, TC-STRUCT-011 |
| F-2 | Readiness gate `dor_check` (holistic cross-artifact review vs ticket) | TC-CI-001, TC-STRUCT-002, TC-STRUCT-005, TC-MANUAL-002, TC-MANUAL-007a/007b |
| F-3 | Adversarial/critical independent review stance | TC-STRUCT-006, TC-MANUAL-001 |
| F-4 | Gap-driven reopening of artifact-creation phases (never delivery) | TC-STRUCT-004, TC-MANUAL-003, TC-MANUAL-007a/007b |
| F-5 | Decision capture & human-in-the-loop pause | TC-STRUCT-008, TC-STRUCT-013, TC-MANUAL-004, TC-MANUAL-006 |
| F-6 | Hard-gate-by-default + explicit recorded override | TC-STRUCT-007, TC-MANUAL-005 |
| F-7 | Workflow integration & DoR/DoD role separation | TC-CI-001, TC-STRUCT-001, TC-STRUCT-002, TC-STRUCT-003, TC-STRUCT-010, TC-MANUAL-008 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (spec §8.1 N/A), no events (spec §8.2 N/A), no external integrations (spec §8.4
N/A). The integration contract is the PM→agent delegation (`@pm` delegates `dor_check` to
`@readiness-reviewer`, consumes a gate verdict). Data-model coverage:

| DM ID | Element | TC ID(s) |
|-------|---------|----------|
| DM-1 | `dor_check` phase entry (PM-notes `phases.dor_check` between `delivery_planning` and `delivery`; lifecycle tables) | TC-STRUCT-002, TC-STRUCT-004 |
| DM-2 | Gate verdict + per-facet findings (`READY \| NOT_READY` + facet/finding/severity/artifact-loc/remediation-phase; persisted readiness-review record) | TC-STRUCT-012, TC-MANUAL-002 |
| DM-3 | DoR facets (the checklist): spec completeness vs ticket; AC clarity/testability/non-overlap; plan coverage of all reqs+AC; test-plan traceability to every AC; cross-artifact consistency; decision capture | TC-STRUCT-011, TC-MANUAL-002 |
| DM-4 | Override record (workItemRef + rationale + approver + date); absence of a record = no override | TC-STRUCT-007, TC-MANUAL-005 |
| DM-5 | Decision-capture routing (`scope: change \| system`; `system` → `doc/decisions/**`; needs-human-input → pause flag) | TC-STRUCT-008, TC-MANUAL-004, TC-MANUAL-006 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Notes |
|--------|-------------|----------|-------|
| NFR-1 | Renumbering consistency — 0 stale 10-phase refs across lifecycle + AGENTS.md + README + pm.md; total = 11 | TC-STRUCT-001 (greppable sweep), TC-STRUCT-002 | The headline CI-verifiable* structural claim. *Greppable at PR review; no dedicated CI script today (see TC-STRUCT-001). |
| NFR-2 | DoR source-of-truth — prompt authoritative; guide states so; 0 contradictions | TC-STRUCT-009 | PR-review content check. |
| NFR-3 | Stronger reasoning model via `claude.model: opus` frontmatter (not prompt body) | TC-STRUCT-012 | PR-review; mirrors `@reviewer`. |
| NFR-4 | House-style parity with `@reviewer` (role/non_goals, frontmatter, safety rules read-only, structured verdict/finding format) | TC-STRUCT-012 | PR-review content check. |
| NFR-5 | Plugin byte-freshness — source + generated `.ados-claude/` committed together | TC-CI-001 (CI) | Backed by `build-claude-plugin.sh` + `test-build-claude-plugin.sh` + `git diff --exit-code`. |
| NFR-6 | Redistributable guide — `definition-of-ready.md` declares `ados_distribution: redistributable` and passes the guard | TC-CI-002 (CI) | Backed by `test-doc-distribution.sh`. |
| NFR-7 | No silent skip — only bypass is an explicit override record (DM-4) | TC-STRUCT-007 (PR-review), TC-MANUAL-005 (manual) | Absence of unconditional pass asserted at PR review + manual. |
| NFR-8 | Adversarial *semantic* review (not mechanical) | TC-STRUCT-006 (PR-review), whole-plan framing (§1, §4, §8.1) | Behavioral stance is manual; #49 mechanical role fenced out (NG-3). |
| NFR-9 | Role separation — `@reviewer` role text unchanged; distinct agent/invocation | TC-STRUCT-010 (PR-review), TC-MANUAL-008 (manual) | Diff the reviewer.md role block → unchanged. |
| NFR-10 | Prompt size discipline — lean; reference guide for detail; no prose duplication | TC-STRUCT-014 | `wc -l` check at PR review. |

Risk coverage (informational — risks are mitigated by the TCs / PR review above):

| RSK ID | Risk | Covered by |
|--------|------|------------|
| RSK-1 | Renumbering drift (a missed "phase 5 = delivery" ref) | TC-STRUCT-001 (the grep sweep), TC-STRUCT-002. |
| RSK-2 | Prompt-vs-guide DoR drift | TC-STRUCT-009 (guide states prompt authoritative), TC-CI-002 (guide marker co-maintained). |
| RSK-3 | Gate over-blocks / override abused → sycophancy | TC-STRUCT-007 + TC-MANUAL-005 (override is recorded; no silent skip). |
| RSK-4 | Behavioral AC untestable in CI | Whole-plan honesty framing; `TC-MANUAL-*` matrix + PR review; no behavioral AC claimed as CI. |
| RSK-5 | Prompt bloat degrades instruction-following | TC-STRUCT-014 (`wc -l`; references guide, no prose duplication). |
| RSK-6 | Generated `.ados-claude` goes stale | TC-CI-001 (CI freshness). |
| RSK-7 | Scope creep into #49 mechanical checking | NFR-8 / NG-3 fence; not a TC (it is an absence — nothing claims mechanical checking). |
| RSK-8 | DoR reopening wrongly reopens `delivery` | TC-STRUCT-004 (lifecycle phase-reopening table + `@pm` reopening logic route to artifact phases) + TC-MANUAL-003. |

## 4. Test Types and Layers

This is a **prompt/command/guide/decision-record change** + a **lifecycle renumbering sweep**.
Per `.ai/rules/testing-strategy.md`, applicable layers are **static/diff checks** + **content
checks** + **manual verification**. There is no runnable application code, so no
unit/integration/E2E framework applies.

Three coverage layers:

- **Layer A — CI gates (mechanical), `TC-CI-*`.** Real, existing scripts asserting *file-level*
  invariants: `.ados-claude` byte-freshness (TC-CI-001 / NFR-5), the doc-distribution marker
  (TC-CI-002 / NFR-6), install/uninstall manifest consistency (TC-CI-003), and license-header
  preservation on header-required paths (TC-CI-004). **None of these assert agent behavior.**
- **Layer B — PR-review structural checks, `TC-STRUCT-*` (non-CI).** A human reads the diff and
  confirms: the NFR-1 renumbering sweep (TC-STRUCT-001 — greppable), 11-phase presence + dor_check
  = phase 5 (TC-STRUCT-002), inventory entries (TC-STRUCT-003), the `@pm` dor_check step +
  reopening logic to artifact phases + PM-notes entry (TC-STRUCT-004), file existence
  (TC-STRUCT-005), the prompt encodes adversarial stance + independence (TC-STRUCT-006),
  hard-gate + override-record fields (TC-STRUCT-007), decision-routing (TC-STRUCT-008), DoR
  source-of-truth discipline (TC-STRUCT-009), `@reviewer` unchanged (TC-STRUCT-010), DoR facets
  present (TC-STRUCT-011), house-style parity (TC-STRUCT-012), ADR-0002 present
  (TC-STRUCT-013), prompt-size discipline (TC-STRUCT-014). These are *intent* checks against
  the spec / ADR-0002, **not** frozen-wording greps — except the phase-*number* sweep, which
  is greppable because phase numbers are a structural contract (DEC-9 bar).
- **Layer C — Manual behavioral matrix, `TC-MANUAL-*`.** The honest way to "test" behavioral
  agent-capability AC: a human runs `/check-readiness` (or `@pm deliver`) on a change with a
  planted artifact gap and observes the verdict + routing. Evidence = captured session
  transcript + filled pass/fail. AC10 = GH-57 dogfooding the gate on its own delivery.

> **What CI does NOT cover (be explicit):** no CI test executes `@readiness-reviewer`,
> asserts an adversarial stance is applied, confirms a `NOT_READY` reopens the correct phase,
> verifies a human pause fires, enforces override recording, or routes a decision. All of that
> is Layer B + Layer C. This is the RSK-4 / NFR-8 trade-off stated plainly.

## 5. Test Scenarios

### 5.1 Scenario Index

**Active scenarios:**

| TC ID | Title | Type | Layer | Priority | AC / NFR / DM Coverage |
|-------|-------|------|-------|----------|------------------------|
| TC-CI-001 | `.ados-claude` byte-freshness (PLUGIN_FRESH) | Regression / Structural | A (CI) | High | AC2, AC8, NFR-5, RSK-6 |
| TC-CI-002 | Redistributable guide marker + doc-distribution guard | Regression / Structural | A (CI) | High | AC1, NFR-6, F-1 |
| TC-CI-003 | Install/uninstall manifest consistency | Regression | A (CI) | Medium | AC1, NFR-6 (Mode-3 oracle) |
| TC-CI-004 | License headers on header-required paths | Regression | A (CI) | Medium | AGENTS.md header rule |
| TC-STRUCT-001 | NFR-1 renumbering sweep (0 stale 10-phase refs; 11 total) | Regression / Structural | B (PR-review, greppable) | High | AC8, NFR-1, F-7, RSK-1 |
| TC-STRUCT-002 | 11-phase flow; dor_check = phase 5 between delivery_planning and delivery | Structural | B (PR-review) | High | AC2, AC8, DM-1, NFR-1 |
| TC-STRUCT-003 | Inventory entries present (agent + command) | Regression / Structural | B (PR-review) | High | AC8, F-7 |
| TC-STRUCT-004 | @pm dor_check step + reopening→artifact phases (never delivery) + PM-notes entry | Structural | B (PR-review) | High | AC4, DM-1, F-4, RSK-8 |
| TC-STRUCT-005 | @readiness-reviewer.md + /check-readiness.md exist | Structural | B (PR-review) | High | AC2, F-2 |
| TC-STRUCT-006 | Prompt encodes adversarial/critical stance + independence | Structural | B (PR-review) | High | AC3, F-3, NFR-8 |
| TC-STRUCT-007 | Prompt encodes hard-gate-default + override-record fields (DM-4) | Structural | B (PR-review) | High | AC6, DM-4, F-6, NFR-7 |
| TC-STRUCT-008 | Prompt encodes decision-capture routing (DM-5) + human pause | Structural | B (PR-review) | High | AC5, AC7, DM-5, F-5 |
| TC-STRUCT-009 | DoR source-of-truth discipline (prompt authoritative; guide says so) | Structural | B (PR-review) | High | AC1, NFR-2, F-1 |
| TC-STRUCT-010 | @reviewer role text unchanged (DoD); distinct from DoR | Regression / Structural | B (PR-review) | High | AC9, NFR-9, F-7 |
| TC-STRUCT-011 | Authoritative DoR facets (DM-3) present in prompt | Structural | B (PR-review) | High | AC1, DM-3, F-1 |
| TC-STRUCT-012 | House-style parity with @reviewer (frontmatter, role, safety, verdict format) | Structural | B (PR-review) | Medium | NFR-3, NFR-4, DM-2 |
| TC-STRUCT-013 | ADR-0002 exists + 00-index.md row | Regression / Structural | B (PR-review) | Medium | AC7 (exemplar) |
| TC-STRUCT-014 | Prompt size discipline (lean; references guide) | Corner Case | B (PR-review) | Medium | NFR-10, RSK-5 |
| TC-MANUAL-001 | Adversarial stance actually applied (planted gap) | Happy Path / Corner Case | C (manual) | High | AC3, F-3, NFR-8 |
| TC-MANUAL-002 | Holistic cross-artifact review → verdict + per-facet findings | Happy Path | C (manual) | High | AC2, F-2, DM-2, DM-3 |
| TC-MANUAL-003 | NOT_READY reopens artifact phase, never delivery | Negative / Corner Case | C (manual) | High | AC4, F-4, RSK-8 |
| TC-MANUAL-004 | Decision needing human input pauses the workflow | Corner Case | C (manual) | High | AC5, DM-5, F-5 |
| TC-MANUAL-005 | Override is explicit + recorded; no silent skip | Corner Case | C (manual) | High | AC6, DM-4, F-6, NFR-7 |
| TC-MANUAL-006 | Decision routing: change-scoped → docs; system → decision record | Happy Path | C (manual) | Medium | AC7, DM-5, F-5 |
| TC-MANUAL-007a | AC10 surrogate: GH-57's pre-delivery red-team review (RT1-MAJOR-02) | Happy Path (surrogate) | C (manual) | High | AC10, F-2, F-4, F-7 |
| TC-MANUAL-007b | AC10 deferred: first true end-to-end dogfood (post-merge) (RT1-MAJOR-02) | Deferred | C (manual) | High | AC10, F-2, F-4, F-7 |
| TC-MANUAL-008 | DoR/DoD role separation observed at runtime | Regression | C (manual) | Medium | AC9, NFR-9, F-7 |

### 5.2 Scenario Details

---

#### TC-CI-001 - `.ados-claude` byte-freshness (PLUGIN_FRESH)

**Scenario Type**: Regression / Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC2, AC8, NFR-5, RSK-6
**Test Type(s)**: CI (plugin freshness)
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md` + `.opencode/command/check-readiness.md` + `.opencode/agent/pm.md` ↔ `.ados-claude/**`; `scripts/build-claude-plugin.sh`; `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @ci, @regression, @plugin

**Preconditions**:
- The new agent/command and the modified `pm.md` have been authored (via `@toolsmith`).

**Steps**:
1. Run `bash scripts/build-claude-plugin.sh` after the `.opencode/` changes; assert it
   reports `PLUGIN_FRESH` (no regeneration diff remaining).
2. Run `git diff --exit-code -- .ados-claude/` — assert no diff (source + generated committed
   together).
3. Run `bash scripts/.tests/test-build-claude-plugin.sh` — assert pass.

**Expected Outcome**:
- The generated `.ados-claude/agents/readiness-reviewer.md`,
  `.ados-claude/commands/check-readiness.md`, and regenerated `pm.md` counterpart are
  byte-fresh vs the committed sources; the freshness test passes (NFR-5).

**Notes**:
- Backed by real scripts (AGENTS.md "Multi-tool support"); **REQUIRED** because three
  `.opencode/` source files changed in this PR.

---

#### TC-CI-002 - Redistributable guide marker + doc-distribution guard

**Scenario Type**: Regression / Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC1, NFR-6, F-1
**Test Type(s)**: CI (doc-distribution)
**Automation Level**: Automated
**Target Layer / Location**: `doc/guides/definition-of-ready.md`; `scripts/.tests/test-doc-distribution.sh`
**Tags**: @ci, @docs, @regression

**Preconditions**:
- The guide has been authored as a GH-57 deliverable.

**Steps**:
1. Confirm `doc/guides/definition-of-ready.md` exists.
2. Confirm its frontmatter declares `ados_distribution: redistributable` (inside the existing
   frontmatter block — no new `---`).
3. Run `bash scripts/.tests/test-doc-distribution.sh`; assert exit 0.
4. Run `bash scripts/.tests/test-doc-distribution-modes.sh`; assert pass (regression — modes
   exercised).

**Expected Outcome**:
- File present; marker `redistributable`; both doc-distribution guards pass (NFR-6; AC1 CI
  half). Mode 3 (redistributable-must-be-installed) is the independent oracle that the guide
  is in the install set.

**Notes**:
- The marker is what `install.sh` (doc/guides glob) and the drift guard derive distribution
  from. A new redistributable guide shipping is exactly the case this guard exists for.

---

#### TC-CI-003 - Install/uninstall manifest consistency

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC1, NFR-6
**Test Type(s)**: CI (install/uninstall)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/install.sh` (doc/guides glob → marker-driven); `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh`
**Tags**: @ci, @regression, @install

**Preconditions**:
- `definition-of-ready.md` is `redistributable` (TC-CI-002).

**Steps**:
1. Run `bash scripts/.tests/test-install.sh`; assert pass.
2. Run `bash scripts/.tests/test-uninstall.sh`; assert pass.

**Expected Outcome**:
- A new redistributable guide under `doc/guides/` enters the install set automatically
  (`install.sh` globs `doc/guides/*.md` and installs only `redistributable` markers); install
  + uninstall stay consistent. `test-doc-distribution.sh` Mode 3 is the independent oracle.

**Notes**:
- **REQUIRED** (mirrors GH-72 RT1-m5): the new redistributable guide is marker-installed, so
  the install/uninstall regression must stay green. No new template ships in GH-57, so the
  templates glob adds nothing.

---

#### TC-CI-004 - License headers on header-required paths

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AGENTS.md "License headers" rule
**Test Type(s)**: CI (headers)
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/`, `.opencode/command/`, `doc/guides/`; `scripts/.tests/test-add-header-location.sh`
**Tags**: @ci, @regression, @headers

**Preconditions**:
- The new agent/command and guide are authored.

**Steps**:
1. Run `bash scripts/.tests/test-add-header-location.sh` — assert pass.
2. Confirm the new `readiness-reviewer.md`, `check-readiness.md`, and `definition-of-ready.md`
   carry the license header (they are header-required paths). **Also confirm `pm.md` and
   `change-lifecycle.md` ARE header-required paths** — `pm.md` is under `.opencode/agent/` and
   `change-lifecycle.md` is under `doc/guides/`, both header-required roots per AGENTS.md
   (RT1-MINOR-01). `AGENTS.md`, `.opencode/README.md`, and the decision records are **not**
   header-required paths.

**Expected Outcome**:
- License headers present on the three new header-required files **and** on `pm.md` +
  `change-lifecycle.md`; no header churn on the genuinely non-required paths (`AGENTS.md`,
  `.opencode/README.md`, decision records).

**Notes**:
- `scripts/add-header-location.sh` is the only tool that manages headers; AI agents must never
  add headers by hand (AGENTS.md).

---

#### TC-STRUCT-001 - NFR-1 renumbering sweep (0 stale 10-phase refs; 11 total)

**Scenario Type**: Regression / Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC8, NFR-1, F-7, RSK-1
**Test Type(s)**: Manual (content check / PR review — greppable)
**Automation Level**: Semi-automated (greppable at PR review)
**Target Layer / Location**: repo-wide (excluding `doc/changes/**`, `.ados-claude/**`, `.git/**`)
**Tags**: @structural, @lifecycle, @regression

**Preconditions**:
- The renumbering sweep (delivery order step 7) has run.

**Steps**:
1. Grep for stale "10-phase" / "phase 5 = delivery" references across the **WHOLE repo**
   (excluding `doc/changes/**`, `.ados-claude/**`, `.git/**`) and assert **0** hits. Covers
   `change-lifecycle.md`, `AGENTS.md`, `README.md`, `doc/00-index.md`, `.opencode/README.md`,
   `.opencode/agent/pm.md` (incl. "step 10"/"steps 1-10"), all `doc/guides/**`,
   `doc/spec/features/**`, and `.ai/agent/decision-instructions.md` (RT1-MAJOR-01). Example:
   - `rg -n '10-phase|10 phase|all 10 phases|phases 1-10|phase 5: delivery|phase 5 = delivery' --glob '!doc/changes/**' --glob '!.ados-claude/**' --glob '!.git/**'`
2. Confirm each surface now states the **11-phase** flow (e.g., `AGENTS.md` intro + phase table
   header + key-references table row read "11-phase"; lifecycle mermaid + tables + phase
   sections show 11; `pm.md` workflow lists 11 steps).
3. Confirm the mermaid has a `dor_check` node as the 5th step and `delivery` as the 6th.

**Expected Outcome**:
- 0 stale references to the old 10-phase numbering; every touched surface describes exactly one
  11-phase flow (NFR-1; RSK-1).

**Notes**:
- This is the one greppable structural member (phase numbers are a contract, not prompt prose —
  DEC-9 bar). No dedicated CI script enforces it today; it is a PR-review grep. (Future #49
  mechanical pre-check is out of scope, NG-3.) The behavioral "reopening routes correctly"
  claim is TC-STRUCT-004 / TC-MANUAL-003.

---

#### TC-STRUCT-002 - 11-phase flow; dor_check = phase 5 between delivery_planning and delivery

**Scenario Type**: Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC2, AC8, DM-1, NFR-1
**Test Type(s)**: Manual (content check / PR review)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md` (mermaid + agent-responsibility table + phase sections + PM-notes map); `AGENTS.md` (phase table)
**Tags**: @structural, @lifecycle

**Preconditions**:
- Lifecycle + AGENTS.md edited.

**Steps**:
1. Confirm `dor_check` is numbered **phase 5** and sits between `delivery_planning` (4) and
   `delivery` (now 6).
2. Confirm the existing phases are renumbered 6–11: delivery(6), system_spec_update(7),
   review_fix(8), quality_gates(9), dod_check(10), pr_creation(11).
3. Confirm the mermaid diagram has a `dor_check` node (5th) with the correct inbound/outbound
   edges (delivery_planning → dor_check → delivery; plus the NOT_READY feedback edge to an
   artifact phase per TC-STRUCT-004).
4. Confirm the agent-responsibility table has a `dor_check | @readiness-reviewer` row.
5. Confirm the phase-reopening table includes DoR gap → reopen artifact phase rows (see
   TC-STRUCT-004) and that the example PM-notes `phases` map lists `dor_check` in the right
   position.

**Expected Outcome**:
- One consistent 11-phase flow; dor_check correctly placed as phase 5; all tables/diagram/map
  agree (DM-1; NFR-1).

---

#### TC-STRUCT-003 - Inventory entries present (agent + command)

**Scenario Type**: Regression / Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC8, F-7
**Test Type(s)**: Manual (content check / PR review — greppable)
**Automation Level**: Semi-automated
**Target Layer / Location**: `AGENTS.md` (agent table + command table), `.opencode/README.md`
**Tags**: @structural, @inventory, @regression

**Preconditions**:
- Inventory surfaces updated.

**Steps**:
1. Confirm `AGENTS.md` agent table has a `readiness-reviewer` row (role = DoR/adversarial
   artifacts-vs-ticket reviewer).
2. Confirm `AGENTS.md` command table has a `/check-readiness <ref>` row.
3. Confirm `.opencode/README.md` lists `readiness-reviewer` and `check-readiness`.
4. Confirm the `AGENTS.md` "Using the system" manual sequence includes the readiness step
   between plan and run-plan.

**Expected Outcome**:
- All four inventory entries present; no orphan/missing entry (AC8 inventory half).

---

#### TC-STRUCT-004 - @pm dor_check step + reopening→artifact phases (never delivery) + PM-notes entry

**Scenario Type**: Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC4, DM-1, F-4, RSK-8
**Test Type(s)**: Manual (content check / PR review)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/pm.md` (workflow steps + `phases` map + reopening logic)
**Tags**: @agent, @structural, @pm

**Preconditions**:
- `@toolsmith` has added the dor_check step + reopening logic + PM-notes entry (via
  `@toolsmith` per DEC-9).

**Steps**:
1. Confirm the `@pm` workflow has a `dor_check` step between `delivery_planning` and `delivery`
   that delegates to `@readiness-reviewer` and consumes the verdict.
2. Confirm the reopening logic: a `NOT_READY` verdict reopens an **artifact-creation phase**
   (`specification` | `test_planning` | `delivery_planning`) and re-delegates to the matching
   author agent — **never** `delivery` (F-4; RSK-8).
3. Confirm the `phases.dor_check` entry exists in the PM-notes structure block (between
   `delivery_planning` and `delivery`) — no existing phase key removed/renamed (DM-1).
4. Confirm the decision-capture routing + human-pause is present in the dor_check step (cross-ref
   TC-STRUCT-008).

**Expected Outcome**:
- dor_check step present + correctly placed; reopening fenced to artifact phases; PM-notes map
  carries `dor_check`; `delivery` is never the target of a DoR reopening.

**Notes**:
- Behavioral confirmation that a `NOT_READY` actually reopens the right phase = TC-MANUAL-003.

---

#### TC-STRUCT-005 - @readiness-reviewer.md + /check-readiness.md exist

**Scenario Type**: Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC2, F-2
**Test Type(s)**: Manual (file existence — greppable)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md`, `.opencode/command/check-readiness.md`
**Tags**: @structural, @agent, @command

**Preconditions**:
- New agent + command authored.

**Steps**:
1. Confirm `.opencode/agent/readiness-reviewer.md` exists.
2. Confirm `.opencode/command/check-readiness.md` exists.
3. Confirm the generated counterparts exist under `.ados-claude/` (cross-ref TC-CI-001).

**Expected Outcome**:
- All four files (2 source + 2 generated) present.

---

#### TC-STRUCT-006 - Prompt encodes adversarial/critical stance + independence

**Scenario Type**: Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC3, F-3, NFR-8
**Test Type(s)**: Manual (content check / PR review)
**Automation Level**: Manual (PR-review content check — not a CI grep; DEC-9 bar)
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md` (role/heuristics/stance)
**Tags**: @agent, @structural

**Preconditions**:
- Prompt authored (via `@toolsmith`).

**Steps**:
1. Read the prompt; confirm it encodes an **adversarial/critical stance**: actively seek gaps,
   contradictions, unstated assumptions; do not rubber-stamp; treat plausibility as a reason to
   probe, not to pass.
2. Confirm the prompt states **independence** from `@spec-writer`/`@test-plan-writer`/`@plan-writer`
   (distinct agent, distinct invocation; not the artifact authors).
3. Confirm the stance mirrors `@reviewer`'s adversarial `built_in_heuristics` discipline
   (house-style parity, cross-ref TC-STRUCT-012).

**Expected Outcome**:
- Adversarial stance + independence encoded in-prompt (AC3; F-3).

**Notes**:
- PR-review intent check, not a frozen-wording grep (DEC-9). Behavioral confirmation = TC-MANUAL-001.

---

#### TC-STRUCT-007 - Prompt encodes hard-gate-default + override-record fields (DM-4)

**Scenario Type**: Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC6, DM-4, F-6, NFR-7
**Test Type(s)**: Manual (content check / PR review)
**Automation Level**: Manual (PR-review content check)
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md` (gate verdict + override)
**Tags**: @agent, @structural, @security

**Preconditions**:
- Prompt authored.

**Steps**:
1. Confirm the prompt encodes a **hard gate by default**: the gate blocks delivery unless the
   verdict is `READY` (or an explicit override applies).
2. Confirm the **override-record fields** (DM-4) are required for any bypass:
   `workItemRef`, triviality rationale, human approver, date — **no field may be omitted**;
   absence of a record means no override was granted.
3. Confirm there is **no unconditional/silent skip** path — i.e., no branch that passes a change
   through `dor_check` without either a `READY` verdict or a recorded override.

**Expected Outcome**:
- Hard-gate-default + full override-record fields encoded; no silent-skip path present (AC6;
  NFR-7).

**Notes**:
- Behavioral confirmation (override actually leaves a record; no silent skip observed at runtime)
  = TC-MANUAL-005.

---

#### TC-STRUCT-008 - Prompt encodes decision-capture routing (DM-5) + human pause

**Scenario Type**: Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC5, AC7, DM-5, F-5
**Test Type(s)**: Manual (content check / PR review)
**Automation Level**: Manual (PR-review content check)
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md` (decision routing)
**Tags**: @agent, @structural

**Preconditions**:
- Prompt authored.

**Steps**:
1. Confirm the prompt encodes the decision-capture routing (DM-5): a surfaced decision carries
   `scope: change | system`; `change` → change docs (pm-notes/spec); `system` /
   precedent-setting → a proposed decision record under `doc/decisions/**` (delegate to
   `@decision-advisor`).
2. Confirm needs-human-input decisions set a **pause flag** (STOP and wait for confirmation)
   — the agent does not auto-advance past a pause.

**Expected Outcome**:
- Decision routing + human-pause encoded in-prompt (AC5; AC7; DM-5).

**Notes**:
- Behavioral confirmation (human pause actually fires) = TC-MANUAL-004; routing observed =
  TC-MANUAL-006. ADR-0002 is the exemplar system-wide record (TC-STRUCT-013).

---

#### TC-STRUCT-009 - DoR source-of-truth discipline (prompt authoritative; guide says so)

**Scenario Type**: Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC1, NFR-2, F-1
**Test Type(s)**: Manual (content check / PR review)
**Automation Level**: Manual (PR-review content check)
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md`; `doc/guides/definition-of-ready.md`
**Tags**: @agent, @docs, @structural

**Preconditions**:
- Both prompt + guide authored.

**Steps**:
1. Confirm the authoritative DoR lives in the `@readiness-reviewer` prompt (DoR is enforced
   behavior → belongs in the prompt, DEC-5).
2. Confirm `doc/guides/definition-of-ready.md` is a **mirror** and **explicitly states the
   prompt is authoritative** (NFR-2).
3. Confirm 0 contradictions between the prompt DoR and the guide mirror (the guide does not
   introduce a divergent facet list or rule).

**Expected Outcome**:
- Single source of truth (prompt); guide mirrors and defers; 0 contradictions (AC1; NFR-2).

---

#### TC-STRUCT-010 - @reviewer role text unchanged (DoD); distinct from DoR

**Scenario Type**: Regression / Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC9, NFR-9, F-7
**Test Type(s)**: Manual (content check / PR review — diff)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md` (`<role>` / mission / non_goals block)
**Tags**: @agent, @structural, @regression

**Preconditions**:
- GH-57 delivery complete.

**Steps**:
1. `git diff <base>..HEAD -- .opencode/agent/reviewer.md` — assert the role/mission/non_goals
   block is **unchanged** (the post-implementation DoD definition).
2. Confirm `@reviewer` is still described as Definition of Done (code-vs-spec/plan,
   post-implementation, reads diffs) and is a **distinct** agent/invocation from
   `@readiness-reviewer` (no conflation in any surface).

**Expected Outcome**:
- `@reviewer` role text unchanged; DoR/DoD separation preserved (AC9; NFR-9).

**Notes**:
- This is a regression guard for NG-1 (the explicit out-of-scope: do not replace/duplicate DoD).

---

#### TC-STRUCT-011 - Authoritative DoR facets (DM-3) present in prompt

**Scenario Type**: Structural
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC1, DM-3, F-1
**Test Type(s)**: Manual (content check / PR review)
**Automation Level**: Manual (PR-review content check)
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md` (DoR checklist)
**Tags**: @agent, @structural

**Preconditions**:
- Prompt authored.

**Steps**:
1. Confirm the prompt's DoR checklist evaluates **all** facets (DM-3):
   (a) spec completeness vs ticket; (b) AC clarity/testability/non-overlap; (c) plan coverage
   of all requirements + all AC, check-listable; (d) test-plan traceability to every AC;
   (e) cross-artifact consistency (ticket → spec → test-plan → plan); (f) decision capture in
   the right place.
2. Confirm the facets are a closed, authoritative set (no invented facet; none silently dropped).

**Expected Outcome**:
- All six facets present and authoritative (AC1; DM-3; F-1).

---

#### TC-STRUCT-012 - House-style parity with @reviewer (frontmatter, role, safety, verdict format)

**Scenario Type**: Structural
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-3, NFR-4, DM-2
**Test Type(s)**: Manual (content check / PR review)
**Automation Level**: Manual (PR-review content check)
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md` vs `.opencode/agent/reviewer.md`
**Tags**: @agent, @structural

**Preconditions**:
- Prompt authored.

**Steps**:
1. Confirm frontmatter carries `claude.model: opus` (stronger reasoning tier via config, NOT
   prompt body — NFR-3; DEC-3).
2. Confirm the structural discipline mirrors `@reviewer`: role/non_goals, safety rules
   (read-only — critiques artifacts, does not modify source, does not auto-merge/approve),
   structured verdict + per-facet finding format (DM-2: facet, finding, severity, linked
   artifact + location, suggested remediation target phase).

**Expected Outcome**:
- Frontmatter model tier + house-style parity with `@reviewer` (NFR-3; NFR-4; DM-2).

---

#### TC-STRUCT-013 - ADR-0002 exists + 00-index.md row

**Scenario Type**: Regression / Structural
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC7 (exemplar system-wide record)
**Test Type(s)**: Manual (file existence — greppable)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md`; `doc/decisions/00-index.md`
**Tags**: @structural, @decision

**Preconditions**:
- ADR produced via the decision workflow (status Proposed; acceptance rides the PR).

**Steps**:
1. Confirm `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md` exists.
2. Confirm `doc/decisions/00-index.md` has an ADR-0002 row.
3. Confirm the ADR frontmatter declares `links.related_changes: ["GH-57"]` (Appendix D linkage).

**Expected Outcome**:
- ADR-0002 present + indexed; bidirectionally linked to GH-57.

**Notes**:
- ADR-0002 is the **exemplar** of the system-wide decision-routing rule (DM-5/AC7) — its
  existence demonstrates the routing produces a decision record.

---

#### TC-STRUCT-014 - Prompt size discipline (lean; references guide)

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-10, RSK-5
**Test Type(s)**: Manual (quick check / PR review)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/readiness-reviewer.md`
**Tags**: @agent, @structural

**Preconditions**:
- Prompt authored.

**Steps**:
1. Run `wc -l .opencode/agent/readiness-reviewer.md`.
2. Assert it is lean and **references** `doc/guides/definition-of-ready.md` for human-readable
   detail rather than duplicating DoR prose (NFR-10; RSK-5). Flag for review if it exceeds the
   house thresholds for agent prompts (compare to `reviewer.md` size).

**Expected Outcome**:
- Lean prompt; DoR detail delegated to the guide mirror; no prose duplication.

---

#### TC-MANUAL-001 - Adversarial stance actually applied (planted gap)

**Scenario Type**: Happy Path / Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC3, F-3, NFR-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch change → `/check-readiness` (or `@pm deliver` to dor_check)
**Tags**: @agent, @manual, @adversarial

**Given/When/Then (AC3):** *Given* an artifact set with a planted plausible-but-incomplete gap
(e.g., an AC with no test-plan traceability, or a plan task not covering an AC), *when* the gate
runs, *then* `@readiness-reviewer` actively surfaces it (does not rubber-stamp) and is
independent of the artifact authors.

**Preconditions**:
- A scratch change with a complete-looking but subtly gapped artifact set (spec + test-plan +
  plan) and a source ticket.

**Steps**:
1. Invoke `/check-readiness <ref>` (or run `@pm deliver` to the dor_check phase).
2. Observe the verdict + findings.
3. Confirm the planted gap was **detected and reported** (NOT rubber-stamped), demonstrating the
   adversarial stance is actually applied at runtime.

**Expected Outcome**:
- The planted gap is surfaced in the findings; the verdict is `NOT_READY` for it; the review is
  independent (not co-authored with the artifact authors).

**Pass/Fail**:
- Pass only if the planted gap is caught and the verdict reflects it. Fail if the gate
  rubber-stamps the gapped set.

---

#### TC-MANUAL-002 - Holistic cross-artifact review → verdict + per-facet findings

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC2, F-2, DM-2, DM-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch change → `/check-readiness`
**Tags**: @agent, @manual, @gate

**Given/When/Then (AC2):** *Given* all artifacts exist, *when* `dor_check` runs, *then*
`@readiness-reviewer` reviews the full set together vs the ticket and emits a `READY` /
`NOT_READY` verdict with per-facet findings, as phase 5.

**Preconditions**:
- A scratch change with a full artifact set + ticket.

**Steps**:
1. Invoke `/check-readiness <ref>`.
2. Confirm the review is **holistic** (all artifacts together, not one at a time) and references
   the source ticket.
3. Confirm the verdict is `READY` or `NOT_READY`.
4. Confirm the per-facet findings follow DM-2 (facet, finding, severity, linked artifact +
   location, suggested remediation target phase) and cover the DM-3 facets.

**Expected Outcome**:
- A holistic cross-artifact verdict + structured per-facet findings persisted as a
  readiness-review record (DM-2).

**Pass/Fail**:
- Pass only if the verdict + structured findings are produced from the whole set vs the ticket.

---

#### TC-MANUAL-003 - NOT_READY reopens artifact phase, never delivery

**Scenario Type**: Negative / Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC4, F-4, RSK-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch change → `@pm deliver` through dor_check
**Tags**: @agent, @manual, @negative, @reopening

**Given/When/Then (AC4):** *Given* the gate finds an artifact gap (e.g., a test-plan not tracing
to an AC), *when* the verdict is `NOT_READY`, *then* the workflow reopens the relevant
artifact-creation phase (`specification`/`test_planning`/`delivery_planning`), **not** `delivery`.

**Preconditions**:
- A scratch change with a known artifact gap (e.g., missing test-plan traceability for AC-x).

**Steps**:
1. Run the change through `dor_check`; observe a `NOT_READY`.
2. Confirm `@pm` reopens the **artifact** phase owning the gap (e.g., `test_planning`) and
   re-delegates to the matching author agent.
3. Confirm `delivery` (phase 6) is **never** the target of the reopening.

**Expected Outcome**:
- A DoR gap reopens an artifact phase; `delivery` is never reopened by a DoR gap (F-4; RSK-8).

**Pass/Fail**:
- Pass only if the reopened phase is an artifact phase and `delivery` is untouched. Fail if a
  DoR gap wrongly reopens `delivery`.

---

#### TC-MANUAL-004 - Decision needing human input pauses the workflow

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC5, DM-5, F-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch change with a needs-human-input decision
**Tags**: @agent, @manual, @pause

**Given/When/Then (AC5):** *Given* the gate identifies a decision needing human input, *when*
no human input is yet provided, *then* the workflow pauses (STOP and wait).

**Preconditions**:
- A scratch change whose artifacts surface a system-wide/precedent-setting decision that needs
  human confirmation.

**Steps**:
1. Run the change through `dor_check`.
2. Confirm the gate routes the decision (DM-5) and, for the needs-human-input case, sets the
   pause flag.
3. Confirm the workflow **STOPs and waits** — it does not auto-advance past the pause.

**Expected Outcome**:
- A human-in-the-loop pause fires; the agent does not auto-finalize (AC5; DM-5).

**Pass/Fail**:
- Pass only if the workflow pauses and waits. Fail if it auto-advances.

---

#### TC-MANUAL-005 - Override is explicit + recorded; no silent skip

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC6, DM-4, F-6, NFR-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch trivial change → override path
**Tags**: @agent, @manual, @override, @security

**Given/When/Then (AC6):** *Given* a change reaches `dor_check`, *when* the gate is evaluated,
*then* it blocks by default and the only bypass for a genuinely trivial change is an explicit,
recorded override (workItemRef + rationale + approver + date); no silent skip path exists.

**Preconditions**:
- A scratch genuinely-trivial change.

**Steps**:
1. Run the change through `dor_check`; confirm it **blocks by default**.
2. Request the override for the trivial change; have a human approve.
3. Confirm the override record captures **all** DM-4 fields (workItemRef, rationale, approver,
   date) and is persisted in change docs.
4. Confirm there is **no path** that bypasses `dor_check` without either a `READY` verdict or a
   recorded override.

**Expected Outcome**:
- Hard gate by default; the only bypass is a fully-recorded override; no silent skip (AC6; NFR-7).

**Pass/Fail**:
- Pass only if the override is fully recorded and no silent skip is reachable. Fail if any field
  is missing or a silent/unconditional skip exists.

---

#### TC-MANUAL-006 - Decision routing: change-scoped → docs; system → decision record

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC7, DM-5, F-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch changes with each decision scope
**Tags**: @agent, @manual, @decisions

**Given/When/Then (AC7):** *Given* the gate surfaces a decision, *when* change-scoped it is
recorded in change docs, and *when* system-wide/precedent-setting it is proposed as a decision
record under `doc/decisions/**`.

**Preconditions**:
- Two scratch changes: one surfacing a change-scoped decision, one surfacing a system-wide one.

**Steps**:
1. For the change-scoped decision: confirm it is recorded in change docs (pm-notes/spec).
2. For the system-wide decision: confirm a decision record is **proposed** under `doc/decisions/**`
   (delegated to `@decision-advisor`).
3. Cross-check: ADR-0002 (GH-57's own system-wide structural decision) is the exemplar of the
   system-wide route (TC-STRUCT-013).

**Expected Outcome**:
- Decisions route by scope to the right place; system-wide decisions produce decision records
  (DM-5).

**Pass/Fail**:
- Pass if both routes land in the correct place. Fail if scopes are swapped or a system-wide
  decision is silently dropped into change docs.

---

#### TC-MANUAL-007a - AC10 surrogate: GH-57's pre-delivery red-team review (RT1-MAJOR-02)

**Scenario Type**: Happy Path (surrogate)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC10, F-2, F-4, F-7
**Test Type(s)**: Manual (existence check)
**Automation Level**: Semi-automated (file existence)
**Target Layer / Location**: `red-team/pre-delivery-round-1-report.md` (GH-57 change folder)
**Tags**: @agent, @manual, @dogfood, @e2e, @surrogate

**Given/When/Then (AC10 — surrogate):** *Given* `@readiness-reviewer` does not exist until
GH-57's own `delivery` phase (so a true phase-5 self-run is structurally impossible for GH-57),
*when* the GH-57 pre-delivery red-team review is adopted as the DoR surrogate, *then* AC10 is
deemed satisfied for GH-57 via that surrogate (RT1-MAJOR-02).

**Preconditions**:
- The GH-57 pre-delivery red-team review has been run.

**Steps**:
1. Confirm `red-team/pre-delivery-round-1-report.md` exists (the pre-delivery red-team review
   that ran as the DoR surrogate for GH-57's own delivery).

**Expected Outcome**:
- The report exists; the surrogate AC10 evidence is present.

**Pass/Fail**:
- **PASS** when the report exists. This TC is the GH-57-local surrogate; the first true
  end-to-end dogfood is TC-MANUAL-007b.

**Notes**:
- Because the gate cannot run on itself before it exists, GH-57's own AC10 is satisfied by the
  pre-delivery red-team surrogate. The first *true* end-to-end dogfood is the next change
  delivered after merge (TC-MANUAL-007b).

---

#### TC-MANUAL-007b - AC10 deferred: first true end-to-end dogfood (post-merge) (RT1-MAJOR-02)

**Scenario Type**: Deferred
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC10, F-2, F-4, F-7
**Test Type(s)**: Manual (deferred)
**Automation Level**: Manual
**Target Layer / Location**: the first change delivered after GH-57 merges (the 11-phase flow)
**Tags**: @agent, @manual, @dogfood, @e2e, @deferred

**Given/When/Then (AC10 — true dogfood):** *Given* the first change delivered after GH-57
merges, *when* it reaches `dor_check`, *then* the gate executes end-to-end — either `READY`
(proceed to delivery) or `NOT_READY` with gaps routed to the correct artifact phase —
exercising the full flow for the first time.

**Preconditions**:
- GH-57 has merged (the gate exists). The next change is delivered through the 11-phase flow.

**Steps**:
1. On the next change delivered after GH-57 merges, reach `dor_check` (phase 5).
2. Confirm `@readiness-reviewer` runs against that change's artifact set + the source ticket.
3. Confirm the gate executes end-to-end: `READY` (→ delivery) or `NOT_READY` with gaps routed to
   the correct artifact phase (per AC4/TC-MANUAL-003).
4. Capture the persisted readiness-review record (DM-2) as evidence.

**Expected Outcome**:
- The full flow runs through `dor_check` for the first time on a change other than GH-57.

**Pass/Fail**:
- **DEFERRED** — the first true end-to-end dogfood = the next change delivered after GH-57
  merges; tracked as a post-merge follow-up, not a GH-57 gate.

**Notes**:
- This is the headline behavioral proof, but it cannot be satisfied by GH-57 itself (the gate
  does not exist until GH-57's own delivery). GH-57 satisfies AC10 via the surrogate
  (TC-MANUAL-007a); TC-MANUAL-007b is the first genuine dogfood.

---

#### TC-MANUAL-008 - DoR/DoD role separation observed at runtime

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC9, NFR-9, F-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: a scratch change run through both gates
**Tags**: @agent, @manual, @regression, @role-separation

**Given/When/Then (AC9):** *Given* GH-57 ships, *when* a change runs the full flow, *then*
`@reviewer` (phase 8) still audits code-vs-spec post-implementation (DoD) and
`@readiness-reviewer` (phase 5) audits artifacts-vs-ticket pre-implementation (DoR); the two
are never conflated.

**Preconditions**:
- A scratch change delivered through the full 11-phase flow.

**Steps**:
1. Confirm `dor_check` (phase 5) runs **pre-implementation** (artifacts-vs-ticket, no code yet).
2. Confirm `review_fix` (phase 8) runs **post-implementation** (code-vs-spec/plan, reads diffs).
3. Confirm the two gates are distinct invocations with distinct inputs/timing — neither was
   merged into the other.

**Expected Outcome**:
- DoR and DoD operate as distinct gates at runtime; `@reviewer` role unchanged (AC9; NFR-9).

**Pass/Fail**:
- Pass if both gates run at their distinct points with distinct inputs. Fail if either is
  skipped, merged, or run at the wrong timing.

---

## 6. Environments and Test Data

- **CI (mechanical gates only):** the repo CI runner; no special environment. The four
  `TC-CI-*` gates run here (plugin freshness, doc-distribution, install/uninstall, headers).
- **PR-review structural checks (Layer B):** a reviewer reads the diff against the spec /
  ADR-0002; no environment beyond the checked-out branch. TC-STRUCT-001's grep sweep runs
  repo-wide (RT1-MAJOR-01).
- **Manual matrix (Layer C, local-dev only):** scratch changes (disposable) authored with
  planted gaps:
  - a **plausible-but-gapped** artifact set (TC-MANUAL-001, TC-MANUAL-002, TC-MANUAL-003) —
    e.g., an AC with no test-plan traceability, a plan task missing an AC;
  - a **needs-human-input decision** scratch change (TC-MANUAL-004);
  - a **genuinely-trivial** scratch change for the override path (TC-MANUAL-005);
  - two **decision-scope** scratch changes (change-scoped + system-wide) (TC-MANUAL-006);
  - a **full-flow** scratch change (TC-MANUAL-008).
- **Dogfood evidence (AC10):** GH-57's own delivery cannot self-run the gate at the true phase-5
  position (RT1-MAJOR-02); TC-MANUAL-007a is the surrogate (the pre-delivery red-team report),
  and TC-MANUAL-007b is the deferred first true dogfood on the next change.
- **Test data generation/cleanup:** scratch changes are disposable; persisted readiness-review
  records (DM-2) / override records (DM-4) are produced per scratch run. No fixtures committed.
- **Isolation:** manual runs use throwaway changes; never run against a real in-flight
  delivery except the GH-57 surrogate evidence (TC-MANUAL-007a, by design).
- **No secrets / no new access:** the gate reads local change artifacts + the source ticket via
  existing tracker access; no new platform integration (spec §8.4, §21).

## 7. Automation Plan and Implementation Mapping

> **Honest framing (RSK-4 / NFR-8):** there is no CI test for the behavioral deliverable.
> Every `TC-MANUAL-*` is **Manual Only**. The CI column lists only the mechanical gates that
> actually exist. `TC-STRUCT-*` are either **PR-review** (diff/grep read against the spec /
> ADR-0002) or trivially-greppable (file existence, the phase-number sweep). This plan never
> claims a behavioral AC is CI-testable.

| TC ID | Implementation status | Execution command | Mocking |
|-------|----------------------|-------------------|---------|
| TC-CI-001 | Automated (CI) | `bash scripts/build-claude-plugin.sh` (assert `PLUGIN_FRESH`); `git diff --exit-code -- .ados-claude/`; `bash scripts/.tests/test-build-claude-plugin.sh` | None |
| TC-CI-002 | Automated (CI) | `bash scripts/.tests/test-doc-distribution.sh`; `bash scripts/.tests/test-doc-distribution-modes.sh` (+ confirm file + marker) | None |
| TC-CI-003 | Automated (CI) | `bash scripts/.tests/test-install.sh`; `bash scripts/.tests/test-uninstall.sh` | None |
| TC-CI-004 | Automated (CI) | `bash scripts/.tests/test-add-header-location.sh` | None |
| TC-STRUCT-001 | Semi-automated (PR-review grep) | repo-wide grep for `10-phase\|phase 5: delivery\|phase 5 = delivery` (excluding `doc/changes/**`, `.ados-claude/**`, `.git/**`) (assert 0) | None |
| TC-STRUCT-002 | PR-review (content check) | reviewer reads lifecycle mermaid + tables + phase sections + PM-notes map | None |
| TC-STRUCT-003 | PR-review (content check) | reviewer reads AGENTS.md agent/command tables + manual sequence + `.opencode/README.md` | None |
| TC-STRUCT-004 | PR-review (content check) | reviewer reads `pm.md` workflow + `phases` map + reopening logic | None |
| TC-STRUCT-005 | PR-review (file existence) | `ls .opencode/agent/readiness-reviewer.md .opencode/command/check-readiness.md .ados-claude/agents/readiness-reviewer.md .ados-claude/commands/check-readiness.md` | None |
| TC-STRUCT-006 | PR-review (content check) | reviewer reads `readiness-reviewer.md` stance/independence vs spec F-3/AC3 | None |
| TC-STRUCT-007 | PR-review (content check) | reviewer reads `readiness-reviewer.md` gate + override vs DM-4/NFR-7 | None |
| TC-STRUCT-008 | PR-review (content check) | reviewer reads `readiness-reviewer.md` decision routing vs DM-5 | None |
| TC-STRUCT-009 | PR-review (content check) | reviewer reads prompt + `definition-of-ready.md` for authority statement + 0 contradictions | None |
| TC-STRUCT-010 | Semi-automated (PR-review diff) | `git diff <base>..HEAD -- .opencode/agent/reviewer.md` (role block unchanged) | None |
| TC-STRUCT-011 | PR-review (content check) | reviewer reads `readiness-reviewer.md` DoR facets vs DM-3 | None |
| TC-STRUCT-012 | PR-review (content check) | reviewer reads `readiness-reviewer.md` frontmatter + structure vs `reviewer.md` | None |
| TC-STRUCT-013 | PR-review (file existence) | `ls doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md`; confirm `00-index.md` row + `links.related_changes` | None |
| TC-STRUCT-014 | Semi-automated (PR-review) | `wc -l .opencode/agent/readiness-reviewer.md` | None |
| TC-MANUAL-001 | Manual Only | human-run `/check-readiness` on planted-gap artifact set | Planted gap |
| TC-MANUAL-002 | Manual Only | human-run `/check-readiness` on full artifact set | None |
| TC-MANUAL-003 | Manual Only | human-run `@pm deliver` to dor_check; observe `NOT_READY` reopening | Planted gap |
| TC-MANUAL-004 | Manual Only | human-run dor_check on needs-human-input decision | Planted decision |
| TC-MANUAL-005 | Manual Only | human-run dor_check override path on trivial change | Planted trivial change |
| TC-MANUAL-006 | Manual Only | human-run dor_check on change-scoped + system-wide decisions | Planted decisions |
| TC-MANUAL-007a | Semi-automated (file existence) | confirm `red-team/pre-delivery-round-1-report.md` exists (surrogate) | None |
| TC-MANUAL-007b | Manual Only (deferred) | next change post-merge runs `dor_check` end-to-end (dogfood) | None |
| TC-MANUAL-008 | Manual Only | human-run scratch change through both gates | None |

### CI gate list (run before merge)

> Only **mechanical** gates. None assert `@readiness-reviewer` behavior; all behavioral AC are
> the `TC-MANUAL-*` matrix + PR review.

1. `git diff --check` — whitespace/conflict-marker guard (testing-strategy "Static/diff checks").
2. `bash scripts/.tests/test-build-claude-plugin.sh` (+ `bash scripts/build-claude-plugin.sh`
   then `git diff --exit-code -- .ados-claude/`) — **REQUIRED**: three `.opencode/` source
   files changed (new agent + new command + modified `pm.md`), so source + generated are
   committed together (NFR-5; AGENTS.md "Multi-tool support").
3. `bash scripts/.tests/test-doc-distribution.sh` (+ `test-doc-distribution-modes.sh`) —
   **REQUIRED**: a new redistributable guide ships (`definition-of-ready.md`) (NFR-6; AC1 CI
   half). Mode 3 is the independent oracle that the guide is in the install set.
4. `bash scripts/.tests/test-install.sh` and `bash scripts/.tests/test-uninstall.sh` —
   **REQUIRED**: the new redistributable guide is marker-installed (`install.sh` globs
   `doc/guides/*.md` and installs only `redistributable` markers), so install/uninstall stay
   consistent. No new template ships, so the templates glob adds nothing.
5. `bash scripts/.tests/test-add-header-location.sh` — regression: the new agent, command, and
   guide are all header-required paths (`.opencode/agent/`, `.opencode/command/`, `doc/guides/`);
   `pm.md` (`.opencode/agent/`) and `change-lifecycle.md` (`doc/guides/`) are **also**
   header-required (RT1-MINOR-01). Only `AGENTS.md`, `.opencode/README.md`, and the decision
   records are not.

> `tools/.tests/*` (text-to-image, zclaude) — **N/A**: no `tools/` change in this PR.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk (testing-side) | Mitigation |
|---------------------|------------|
| Behavioral AC cannot be asserted in CI (RSK-4 / NFR-8) | **Stated honestly:** the ONLY behavioral coverage is the `TC-MANUAL-*` matrix + PR review. This plan never claims a behavioral AC is CI-testable; §7's CI gates are purely mechanical. |
| NFR-1 renumbering drift — a stale "phase 5 = delivery" / "10-phase" reference survives (RSK-1) | TC-STRUCT-001 is a greppable repo-wide sweep (excluding `doc/changes/**`, `.ados-claude/**`, `.git/**`); TC-STRUCT-002 cross-checks the diagram/tables. The sweep is the durable proof there is exactly one description of the flow. |
| A `TC-STRUCT-*` prompt-content check re-earns DEC-9's brittle-grep critique | The prompt-content members are **PR-review intent checks** (diff reads vs spec/ADR-0002), never frozen-wording greps. The one greppable member (TC-STRUCT-001) targets **phase numbers**, a structural contract — distinct from prompt prose. Stated in §1. |
| Manual-only coverage is skipped at merge | The §10 Test Execution Log must be filled (at least the critical TCs: CI-001/002, STRUCT-001/002/004/007, MANUAL-001/003/005/007a) before sign-off; PR-review checklist includes the Layer-B items. |
| GH-57 ships the gate but does not run it on itself (AC10 gap) | Resolved by RT1-MAJOR-02: TC-MANUAL-007a is the **surrogate** (the pre-delivery red-team report — PASS when it exists); a true self-run is structurally impossible for GH-57, so the first true dogfood is deferred to TC-MANUAL-007b (next change post-merge). |
| ADR-0002 lags (authored via the decision workflow, not at spec time) | TC-STRUCT-013 verifies presence + indexing; the ADR's acceptance rides the GH-57 PR (DEC-7). |

### 8.2 Assumptions

- The spec's 9 resolved decisions (DEC-1…DEC-9) are the design authority; inherited, not
  re-debated (spec §15).
- ADR-0002 (Proposed; R2) is the right next ADR number; its acceptance rides the GH-57 PR
  (DEC-7).
- `@reviewer` (GH-36, merged) is the structural/house-style precedent to mirror (frontmatter
  `claude.model: opus`, role/non_goals, adversarial heuristics, structured findings, read-only
  safety rules).
- `@toolsmith` is the required delegate for editing `.opencode/agent/**` and
  `.opencode/command/**` (DEC-9; AGENTS.md "Extending the system" hard rule).
- The artifact-creator agents (`@spec-writer`/`@test-plan-writer`/`@plan-writer`) each get a
  one-line DoR cross-reference note via `@toolsmith` (RT1-MAJOR-03) — their behavior is
  otherwise unchanged.
- A human is available to approve overrides (DM-4) and to resolve needs-human-input decisions
  (DM-5); the agent does not auto-advance past a pause.
- The deterministic mechanical pre-check (#49) is out of scope (NG-3/DEC-6) and not a dependency.

### 8.3 Open Questions

| OQ | Question | Blocking? | Owner |
|----|----------|-----------|-------|
| OQ-1 (spec) | Do the author agents need a re-invocation note? | **Resolved (revised after red-team RT1-MAJOR-03):** YES — each gets a one-line DoR cross-reference note via `@toolsmith`. (Inherited; not re-tested.) | PM |
| T-OQ-1 | Should the NFR-1 phase-number sweep be promoted to a dedicated CI script (rather than PR-review grep)? | No — phase-number renumbering is a one-time structural change; a CI grep would fossilize numbering. The PR-review grep (TC-STRUCT-001) suffices. (Mirrors GH-72's stance on not freezing prompt wording.) | PM |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-27 | Juliusz Ćwiąkalski | Initial test plan. Honest RSK-4/NFR-8 framing: (A) CI gates `TC-CI-001…004` (plugin freshness, doc-distribution marker, install/uninstall, headers — all real existing scripts), (B) structural PR-review checks `TC-STRUCT-001…014` (NFR-1 phase-number sweep is greppable; prompt-content members are intent checks, NOT frozen-wording greps — DEC-9 bar), (C) manual behavioral matrix `TC-MANUAL-001…008` with AC10 = GH-57 dogfooding the gate. Full AC1–AC10 + NFR-1…NFR-10 + F-1…F-7 + DM-1…DM-5 + RSK-1/2/3/5/6/8 traceability. #49 mechanical pre-check (NG-3) and post-delivery `@reviewer` re-testing explicitly out of scope. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(not yet executed — plan proposed; coverage is CI gates + PR-review structural checks + manual matrix per RSK-4/NFR-8)_ | | | |
