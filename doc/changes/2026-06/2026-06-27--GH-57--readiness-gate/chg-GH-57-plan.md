---
ados_distribution: project-generated
id: chg-GH-57-readiness-gate
status: Proposed
created: 2026-06-27T00:00:00Z
last_updated: 2026-06-27T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-lifecycle
labels: ["readiness-gate", "definition-of-ready", "dor", "agent", "lifecycle", "meta"]
links:
  change_spec: ./chg-GH-57-spec.md
  pm_notes: ./chg-GH-57-pm-notes.yaml
  decision: ../../decisions/ADR-0002-readiness-gate-definition-of-ready.md
  related: ["GH-43", "GH-49"]
summary: >
  Insert a Definition of Ready (DoR) gate into ADOS's delivery workflow so the spec,
  test-plan, and plan are critiqued together against the source ticket — by an
  adversarial reviewer independent of their authors — before a single line of
  implementation is written. Adds one new agent (@readiness-reviewer), one new command
  (/check-readiness), and one new lifecycle phase (dor_check, inserted as phase 5; the
  existing 5–10 are renumbered to 6–11). The authoritative DoR lives in the agent prompt
  (mirrored in a new redistributable guide that states the prompt is authoritative); the
  gate is a hard block by default with an explicit, recorded override for trivial changes
  (no silent skip), captures and routes decisions, and is kept structurally distinct from
  the post-implementation @reviewer (Definition of Done). Additive meta-change to ADOS
  itself; design recorded as ADR-0002 (Proposed; acceptance rides the GH-57 PR).
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-57: Definition of Ready gate (@readiness-reviewer)

## Context and Goals

This plan delivers **GH-57**: a **pre-delivery readiness gate** (`dor_check`) inserted
between `delivery_planning` and `delivery`. Today the highest-leverage artifacts
(spec/test-plan/plan) are produced by `@spec-writer`/`@test-plan-writer`/`@plan-writer`
and handed straight to `@coder` with **no independent critique** — a flaw in the spec
compounds across every implementation task built on it. The gate reviews the complete
artifact set **plus the source ticket** under a structured, multi-facet Definition of
Ready carried by an **adversarial** reviewer independent of the authors.

The product under change is an **agent prompt + a command + a redistributable guide +
structural renumbering** across the lifecycle/PM/inventory surfaces. The DoR is
**enforced behavior**, so its authoritative copy lives in the `@readiness-reviewer`
prompt (DEC-5); `doc/guides/definition-of-ready.md` is a human-readable **mirror** that
states the prompt is authoritative. The gate is deliberately distinct from the
post-implementation `@reviewer` (Definition of Done): `@reviewer` audits **code vs
spec/plan** (post-impl, diffs); `@readiness-reviewer` audits **artifacts vs ticket**
(pre-impl, no code yet) — different inputs, timing, and mental model.

**Phasing model.** Phases follow spec §18 delivery order, sequenced so each phase is a
discrete, independently-committable unit. The decision record ships first (Phase A) so
it is the design authority the agent/PM edits reference. The agent/command/PM tooling
(Phase B) is authored **via `@toolsmith`** (repo hard rule). The DoR mirror guide
(Phase C) follows the agent prompt so the mirror can faithfully state "the prompt is
authoritative" against a shipped prompt. The lifecycle renumber (Phase D) lands after
the agent/PM exist so the new phase 5 is wired into a flow that can actually run it.
The inventory/manifest updates (Phase E) follow the lifecycle so all surfaces describe
one consistent 11-phase flow. Phase F is a dedicated **renumbering sweep** proving 0
stale references (NFR-1) plus freshness verification. System-spec reconciliation (if any)
is **out of this plan** — delivered by `@doc-syncer` at phase 7 (DEC, §7.2 OUT).

**Resolved open questions (no blockers — see spec §14):**

- **OQ-1** (do the artifact-creator agents need a re-invocation note?) → RESOLVED (PM, R1):
  **NO** edits to `@spec-writer`/`@test-plan-writer`/`@plan-writer`. The DoR reopening is
  a **PM orchestration** concern expressed in `@pm`'s workflow + the lifecycle
  phase-reopening table; author agents simply respond to whatever `@pm` delegates. Their
  own behavior is unchanged.

**Hard governance rules encoded into the phases (from AGENTS.md + the GH-72 retro):**

1. **All edits to `.opencode/agent/*.md` and `.opencode/command/*.md` are done by `@toolsmith`,
   delegated by the PM directly.** The `@coder` subagent has **no task tool** and **cannot
   spawn `@toolsmith`** (proven lesson from the GH-72 retro). Therefore the
   `readiness-reviewer.md`, `check-readiness.md`, AND `pm.md` (workflow) edits in Phase B
   are **PM → `@toolsmith`** — they are **not** phrased as "`@coder` delegates to
   `@toolsmith`". `@coder` handles **only** the doc/guide/inventory edits (the 00-index.md
   row in Phase A; Phases C, D, E; the sweep in Phase F; the bookkeeping in Phase G).
2. **Source `.opencode/` + regenerated `.ados-claude/` committed together.** Run
   `scripts/build-claude-plugin.sh` after every `.opencode` change batch; CI verifies
   freshness via `scripts/.tests/test-build-claude-plugin.sh` (NFR-5).
3. **The renumbering (phase-5 insertion; 5–10 → 6–11) is a structural sweep** with its own
   dedicated phase (F): a grep sweep verifying **0 stale** phase-number references across
   `doc/guides/change-lifecycle.md`, `AGENTS.md`, `.opencode/README.md`, and
   `.opencode/agent/pm.md` (NFR-1).
4. **The new guide `doc/guides/definition-of-ready.md` MUST declare `ados_distribution:
   redistributable`** and pass `scripts/.tests/test-doc-distribution.sh` (NFR-6).
5. **ADR-0002 status stays `Proposed`** (do NOT auto-flip to Accepted — acceptance rides the
   GH-57 PR, set at human merge). `decision_date: null`. (ADR-0002 does not yet exist, so
   Phase A produces it; if it already exists by delivery time, Phase A degrades to verify.)

> **No open questions remain.** ADR-0002 is the design authority and its acceptance rides
> the GH-57 PR. A separate `@decision-critic` challenge is optional (the pre-delivery
> red-team and the gate's own adversarial stance already provide independent critique).
> The 5 structural decisions (single critic; new agent; stronger model; hard-gate + recorded
> override; DoR prompt-as-source + guide mirror) are fixed by the ticket + comment #1
> (spec §15 DEC-1…DEC-8) and are **not** re-debated here.

## Scope

### In Scope

- **(G) Decision record** — `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md`
  (Proposed; rigor R2) + an `ADR-0002` row in `doc/decisions/00-index.md` — spec §7.1(G),
  §7.2 OUT (authoring at spec time), DEC-7; **AC7**.
- **(A)(B)(E) Agent/command/PM tooling — via `@toolsmith`** —
  `.opencode/agent/readiness-reviewer.md` (authoritative DoR + adversarial/critical stance
  + independence + verdict/finding format + hard-gate + override-record DM-4 +
  decision-routing DM-5 + `claude.model: opus` frontmatter), `.opencode/command/check-readiness.md`,
  and the `pm.md` workflow edits (`dor_check` step + DoR reopening logic +
  decision-capture routing + `phases.dor_check` in PM-notes map) — spec §7.1(A)(B)(E),
  F-1/F-2/F-3/F-4/F-5/F-6, AC1/AC2/AC3/AC4/AC5/AC6, NFR-2/NFR-3/NFR-4/NFR-7/NFR-8/NFR-10.
- **(H) Plugin regeneration** — `.ados-claude/**` counterparts regenerated and committed
  with sources — spec §7.1(H), **NFR-5**.
- **(C) Redistributable DoR mirror guide** — `doc/guides/definition-of-ready.md`
  (`ados_distribution: redistributable`; states prompt is authoritative) — spec §7.1(C),
  DEC-5, **AC1**, NFR-2/NFR-6.
- **(D) Lifecycle renumber** — `doc/guides/change-lifecycle.md`: insert `dor_check` as
  phase 5; renumber 5–10 → 6–11; mermaid + agent-responsibility table + phase-reopening
  table + PM-notes phase map; reference the DoR guide — spec §7.1(D), F-7, **AC2/AC4/AC8**,
  NFR-1 (partial).
- **(F) Inventory + manifest** — `AGENTS.md` (phase table 11 phases; agent table add
  `readiness-reviewer`; command table add `/check-readiness`; "Using the system" manual
  sequence), `.opencode/README.md` (agent + command inventory), `.ai/agent/pm-instructions.md`
  (reviewed; add a `dor_check`/planning transition only if it enumerates phase transitions)
  — spec §7.1(F), **AC8**, NFR-1 (partial).

### Out of Scope

- System-spec reconciliation of any feature spec → `@doc-syncer`, **phase 7**
  (DEC; cross-referenced, not authored here). No `doc/spec/features/*` change is in scope.
- Deterministic mechanical pre-check `ados check-readiness` (issue **GH-49**) → future
  complement; explicitly fenced out (NG-3, NFR-8, DEC-6).
- Post-delivery retrospectives (**GH-43**) → complementary, post-delivery.
- Repo-local `.ai/agent/readiness-instructions.md` DoR extensions → deferred (YAGNI).
- Authoring ADR-0002 content at "plan time" → produced via the decision workflow
  (`@decision-advisor`) in Phase A; not hand-authored by `@coder`.
- Editing the three artifact-creator agents (`@spec-writer`/`@test-plan-writer`/
  `@plan-writer`) → OQ-1 resolved: **no** edits (reopening is a PM/lifecycle concern).

### Constraints

- **DEC-8** `dor_check` is the **new phase 5**; existing 5–10 renumber to **6–11** (no
  append/reorder).
- **DEC-5 / NFR-2** DoR is authoritative in the prompt; the guide mirror states so; 0
  contradictions between prompt and mirror.
- **NFR-7** Hard-gate by default; the only bypass is an explicit override record (DM-4) —
  no silent/unconditional skip path exists.
- **NFR-8** The gate is an **adversarial semantic** review (not a mechanical checker); #49
  is out of scope.
- **NFR-9** `@reviewer` (now phase 8) role text is **unchanged** — DoD, code-vs-spec,
  post-implementation; distinct agent/invocation from `@readiness-reviewer`.
- **NFR-10** `readiness-reviewer.md` stays lean — reference the DoR guide for human-readable
  detail; duplicate no prose.
- **Hard rule** — agent/command/PM-prompt edits go via `@toolsmith` (PM-delegated); source +
  generated committed together.

### Risks

- **RSK-1** (renumbering drift — a missed reference leaves "phase 5 = delivery") → mitigated
  by the dedicated Phase F grep sweep across all surfaces (NFR-1; target 0 stale). Residual M.
- **RSK-2** (prompt-as-source DoR drifts from the guide mirror) → mitigated by the guide
  explicitly stating the prompt is authoritative (NFR-2) and co-maintaining prompt + mirror
  in one change. Residual L.
- **RSK-3** (gate over-blocks or override is abused, reintroducing sycophancy) → mitigated by
  hard-gate + explicit recorded override (DM-4/NFR-7) + capped re-run iterations with human
  escalation on stalemate. Residual M.
- **RSK-4** (most AC are behavioral agent-capability claims untestable in CI) → mitigated by
  structural checks (phase presence, inventory consistency, prompt encodes stance/DoR) + CI
  gates (plugin freshness, doc-distribution) + a manual verification matrix; behavioral
  claims honestly marked **manual**. Residual M.
- **RSK-5** (prompt bloat) → mitigated by a lean prompt that references the guide for detail
  (NFR-10) and delegating authoring to `@toolsmith`. Residual L.
- **RSK-6** (`.ados-claude` staleness) → mitigated by regenerating and committing source +
  generated together; CI verifies freshness. Residual L.
- **RSK-8** (DoR reopening logic wrongly reopens `delivery`) → mitigated by the explicit,
  fenced reopening rule (gaps reopen `specification`/`test_planning`/`delivery_planning`,
  never `delivery`; F-4) verified structurally in the PM prompt + lifecycle phase-reopening
  table. Residual L.

### Success Metrics

- Exactly **1** new phase `dor_check` between `delivery_planning` and `delivery`; **0**
  changes to the DoD role of `@reviewer` (NFR-9).
- **11** total lifecycle phases after delivery; existing 5–10 renumbered to 6–11 with **0**
  stale phase-number references across all touched surfaces (NFR-1).
- `@readiness-reviewer` encodes the adversarial/critical stance + independence + the full
  DM-3 facet set; runs on `claude.model: opus` via frontmatter (NFR-3/NFR-8).
- **0** silent-skip paths; every bypass is an explicit override record (DM-4) (NFR-7).
- `doc/guides/definition-of-ready.md` declares `ados_distribution: redistributable` and
  passes the CI doc-distribution guard (NFR-6).
- Source `.opencode/` + regenerated `.ados-claude/` byte-fresh, committed together (NFR-5).

## Phases

> **Conventions.**
> 1. **Agent/command/PM-prompt edits go via `@toolsmith`, PM-delegated directly** — the
>    `@coder` subagent has no task tool and cannot spawn `@toolsmith` (GH-72 retro). So
>    Phase B (`readiness-reviewer.md`, `check-readiness.md`, `pm.md` workflow edits) is
>    **PM → `@toolsmith`**, never "`@coder` delegates". `@coder` handles the
>    doc/guide/inventory edits (the 00-index row; Phases C/D/E; the sweep in F; bookkeeping
>    in G). ADR-0002 is produced via the decision workflow (`@decision-advisor`).
> 2. **Source + generated committed together** — `scripts/build-claude-plugin.sh` runs after
>    every `.opencode` batch; CI verifies freshness (NFR-5).
> 3. Each phase is a discrete commit. Verification uses the CI gates below; the formal
>    `TC-STRUCT-*` IDs will be assigned by the GH-57 test plan (`chg-GH-57-test-plan.md`).
>    Per RSK-4, behavioral agent-capability claims are honestly marked **manual**.

### Phase A: Decision record — ADR-0002 (Proposed) + 00-index.md row

**Goal**: Ship the design authority for the precedent-setting workflow-structure change so
the Phase B agent/PM edits can reference it, and so the decision-capture routing facet
(AC7) has a concrete exemplar system-wide record. **No agent/command edits in this phase.**

**Delegate**: `@decision-advisor` authors **ADR-0002** via the decision workflow
(`/write-decision` / `/plan-decision`); `@coder` adds the `ADR-0002` row to
`doc/decisions/00-index.md` (a doc under `doc/decisions/`, not an agent/command — the
`@toolsmith` hard rule does **not** apply). **ADR-0002 does not yet exist**, so this phase
produces it; if it already exists at delivery time, this phase degrades to **verify
present + `status: Proposed`**.

**Tasks**:

- [ ] **A.1** `@decision-advisor` authors
  `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md` capturing: the precedent-
  setting workflow-structure change (new phase + agent + command); DEC-1…DEC-8 (single
  critic; new agent not a `@reviewer` mode; `claude.model: opus` via config; hard-gate +
  recorded override; DoR prompt-as-source + guide mirror; #49 out of scope; `dor_check` as
  phase 5; the `@toolsmith` delegation rule). Follow the ADR-0001 precedent for delivery-
  workflow structural changes. **Front matter MUST set `status: Proposed`, `decision_date: null`,
  and `links.related_changes: ["GH-57"]`** (spec Appendix D).
- [ ] **A.2** `@coder` adds the `ADR-0002` row to `doc/decisions/00-index.md` (table columns:
  `ID | Type | Title | Status | Date | Owners`), matching the ADR-0001 row style; **Status =
  Proposed**, **Date = 2026-06-27** (creation date, not acceptance). Preserve the existing
  `ados_distribution: project-generated` marker.
- [ ] **A.3** *(Should)* Confirm the spec front matter already declares
  `links.decisions: ["ADR-0002"]` (it does) and ADR-0002's front matter declares
  `links.related_changes: ["GH-57"]` — bidirectional linkage per `decision-records-management.md`.

**Acceptance Criteria**:

- Must: ADR-0002 exists with `status: Proposed` and `decision_date: null` (constraint #5;
  **AC7** exemplar system-wide record; DEC-7).
- Must: ADR-0002 row present in `00-index.md` with Status `Proposed`.
- Must: bidirectional `links` between the spec and ADR-0002.
- Should: ADR-0002 references DEC-1…DEC-8.

**Files and modules**:

- `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md` (new — decision workflow)
- `doc/decisions/00-index.md` (updated — ADR-0002 row)

**Tests**:

- Structural read: ADR-0002 front matter `status: Proposed`, `decision_date: null`.
- `grep -F "ADR-0002" doc/decisions/00-index.md` returns the index row with Status `Proposed`.
- `grep -F "links.related_changes" doc/decisions/ADR-0002-*.md` returns `GH-57`.
- No CI gate applies to decision records (they are project-specific, not in the redistributable
  set); `test-doc-distribution.sh` is unaffected.

**No-op escape**: if ADR-0002 already exists with `status: Proposed` and the 00-index row is
present, skip A.1/A.2 and only verify; still confirm the linkage.

**Completion signal**: `docs(decisions): add ADR-0002 — readiness gate / Definition of Ready (GH-57)`

---

### Phase B: Agent + command + PM tooling (PM DELEGATES @toolsmith; source + generated committed together)

**Goal**: Author the authoritative DoR agent, its `/check-readiness` command, and the `@pm`
workflow edits that make `dor_check` a runnable hard gate — `@readiness-reviewer` loads the
artifact set + ticket, applies all DoR facets adversarially, emits a verdict, routes
decisions, and reopens an artifact phase (never `delivery`) on `NOT_READY`.

**Delegate**: **PM delegates `@toolsmith` DIRECTLY** for all three `.opencode/` files
(`readiness-reviewer.md`, `check-readiness.md`, `pm.md` workflow edits). Per the GH-72-retro
governance rule, `@coder` has **no task tool and cannot spawn `@toolsmith`**, so these edits
are **never** phrased as "`@coder` delegates to `@toolsmith`". `@coder` does **not** touch
any `.opencode/agent|command` file in this change. After the `.opencode` batch, `@toolsmith`
(or PM via `@runner`) regenerates `.ados-claude/` and the source + generated are committed
together (NFR-5).

**Tasks**:

- [ ] **B.1** `@toolsmith` authors `.opencode/agent/readiness-reviewer.md`, mirroring the
  `@reviewer` house style (Appendix C): frontmatter keys incl. **`claude: model: opus`**
  (NFR-3; model in config, **not** the body), `mode: all`, a `<role>` with mission + `<non_goals>`
  (NFR-4). The prompt body carries:
  - **Authoritative Definition of Ready** — the closed facet set (DM-3): (a) spec completeness
    vs ticket; (b) AC clarity/testability/non-overlap; (c) plan coverage of all requirements +
    all AC, check-listable; (d) test-plan traceability to every AC; (e) cross-artifact
    consistency (ticket → spec → test-plan → plan); (f) decision capture in the right place.
  - **Adversarial/critical stance** — actively seek gaps, contradictions, unstated
    assumptions; do not rubber-stamp; treat plausibility as a reason to probe; independent of
    `@spec-writer`/`@test-plan-writer`/`@plan-writer` (F-3, NFR-8).
  - **Verdict + finding format (DM-2)** — `READY | NOT_READY` plus per-facet findings
    (facet, finding, severity, linked artifact + location, suggested remediation target phase),
    persisted as a readiness-review record under the change folder (mirrors `@reviewer`'s
    `findings-iter-<N>` discipline).
  - **Hard-gate + override-record (DM-4)** — blocks delivery by default; the only bypass for a
    genuinely trivial change is an explicit, recorded override (`workItemRef`, triviality
    rationale, human approver, date); **no silent/unconditional skip** (F-6, NFR-7).
  - **Decision-capture routing (DM-5)** — `scope: change` → change docs (pm-notes/spec);
    `scope: system` (precedent-setting/cross-component) → proposed decision record under
    `doc/decisions/**`; needs-human-input decisions set a pause flag (STOP and wait) (F-5, AC5).
  - **Read-only safety rules** — critiques artifacts + emits verdict/record; does not modify
    source code and does not auto-merge/approve (mirrors `@reviewer`, §21).
  - **Reference the DoR guide** for human-readable detail — duplicate no prose (NFR-10).
- [ ] **B.2** `@toolsmith` authors `.opencode/command/check-readiness.md` — the `/check-readiness`
  command, the DoR pair of `/review` (Appendix B). It invokes the `dor_check` gate on a
  `workItemRef`, loading spec + test-plan + plan + the source ticket, and surfaces the verdict
  + findings. Mirrors `/review`'s structure/flags.
- [ ] **B.3** `@toolsmith` edits `.opencode/agent/pm.md`:
  - Add the **`dor_check` step** between `delivery_planning` and `delivery` — `@pm` delegates
    to `@readiness-reviewer`, consumes the verdict, and proceeds to `delivery` on `READY`
    (F-2, AC2).
  - Add the **DoR reopening logic** — on `NOT_READY`, reopen the **relevant artifact phase**
    (`specification`/`test_planning`/`delivery_planning`) and re-delegate to the matching
    author agent; **never `delivery`**; re-run the gate until `READY` (cap iterations;
    escalate to human on stalemate) (F-4, AC4, RSK-8).
  - Add the **trivial-change override path** — record the override (DM-4) before bypassing the
    gate for THIS change only; no unconditional pass (F-6, AC6).
  - Add the **decision-capture routing + human pause** — system-wide → `@decision-advisor` →
    decision record; needs-human-input → STOP and wait (F-5, AC5, AC7).
  - Add **`phases.dor_check`** to the PM-notes phase map structure (DM-1).
- [ ] **B.4** Regenerate the Claude Code plugin: `scripts/build-claude-plugin.sh`, then stage
  the `.ados-claude/**` counterparts (new agent + command; modified pm) together with the
  `.opencode/` sources in one commit (NFR-5).

**Acceptance Criteria**:

- Must: prompt carries the authoritative DoR facets DM-3 + the prompt-vs-mirror authority
  statement (**AC1**, NFR-2).
- Must: prompt encodes the adversarial/critical stance + independence (**AC3**, NFR-8).
- Must: prompt + `@pm` encode the hard-gate default + override-record fields DM-4 + the
  absence of an unconditional pass (**AC6**, NFR-7).
- Must: prompt + `@pm` encode the pause for needs-human-input decisions (**AC5**) and the
  decision-routing rule DM-5 (**AC7**).
- Must: `@pm` reopening logic + (Phase D) phase-reopening table route DoR gaps to artifact
  phases, **never** `delivery` (**AC4**, RSK-8).
- Must: `claude.model: opus` in frontmatter (NFR-3); `readiness-reviewer.md` + `/check-readiness`
  exist (AC2); `@reviewer` role text unchanged (AC9, NFR-9).
- Must: `phases.dor_check` present in the PM-notes map (DM-1).
- Must: source + regenerated `.ados-claude` committed together (**NFR-5**).
- Should: `readiness-reviewer.md` stays lean (references guide, duplicates no prose) — NFR-10.

**Files and modules**:

- `.opencode/agent/readiness-reviewer.md` (new — `@toolsmith`)
- `.opencode/command/check-readiness.md` (new — `@toolsmith`)
- `.opencode/agent/pm.md` (updated — `dor_check` step + reopening + override + decision routing
  + PM-notes `phases.dor_check`; `@toolsmith`)
- `.ados-claude/agents/readiness-reviewer.md` (regenerated counterpart)
- `.ados-claude/commands/check-readiness.md` (regenerated counterpart)
- `.ados-claude/agents/pm.md` (regenerated counterpart)

**Tests**:

- Structural: DoR facets DM-3 present and authoritative in the prompt; adversarial stance +
  independence present; verdict/finding format present; hard-gate + override-record DM-4
  present; decision-routing DM-5 present; `claude.model: opus` in frontmatter.
- Structural: `pm.md` contains a `dor_check` step between `delivery_planning` and `delivery`,
  reopening logic targeting artifact phases only, and `phases.dor_check` in the PM-notes map.
- `bash scripts/build-claude-plugin.sh` then `git status` — the regenerated `.ados-claude`
  counterparts are the only generated changes (byte-fresh; NFR-5).
- `bash scripts/.tests/test-build-claude-plugin.sh` — must pass (plugin freshness/staleness).
- `wc -l .opencode/agent/readiness-reviewer.md` — lean (NFR-10; warn if it exceeds house
  thresholds for agent prompts).
- **Manual** (RSK-4): AC2/AC3/AC5/AC6 behavioral parts are agent-capability claims verified by
  PR review + the manual matrix, not CI.

**No-op escape**: if a file already exists with the required structure (partial prior
attempt), only regenerate + recommit the generated counterpart; otherwise re-delegate the
missing piece to `@toolsmith`. **`@coder` never hand-edits these files even in a no-op
escape** — gaps return to `@toolsmith`.

**Completion signal**: `feat(agent): add @readiness-reviewer + /check-readiness + @pm dor_check gate (GH-57)`

---

### Phase C: DoR mirror guide — definition-of-ready.md (redistributable)

**Goal**: Ship the human-readable **mirror** of the DoR that explicitly states the prompt is
authoritative, so the onboarding/retrospective audience (GH-43) has a redistributable reference
that does not contradict the prompt. The guide is a doc; the `@toolsmith` hard rule does **not**
apply.

**Delegate**: `@coder`.

**Tasks**:

- [ ] **C.1** Author `doc/guides/definition-of-ready.md` mirroring the shipped prompt's facet
  set (DM-3): spec completeness vs ticket; AC clarity/testability/non-overlap; plan coverage of
  all requirements + all AC; test-plan traceability to every AC; cross-artifact consistency;
  decision capture in the right place.
- [ ] **C.2** **State the prompt is authoritative** at the top: the `@readiness-reviewer` prompt
  (`.opencode/agent/readiness-reviewer.md`) is the single source of truth; this guide is a
  human-readable mirror; 0 contradictions between prompt and mirror (NFR-2).
- [ ] **C.3** Declare `ados_distribution: redistributable` inside the **single** frontmatter
  block (AGENTS.md `ados_distribution` rules — never a second `---` block; a second block makes
  `test-doc-distribution.sh`'s `get_marker()` return "missing"). **License-header note:** `@coder`
  writes the frontmatter; the **script** `scripts/add-header-location.sh` adds the license
  header lines (AGENTS.md: "AI agents must never add license headers").
- [ ] **C.4** Document the DoR/DoD pairing (Appendix B): `dor_check` ↔ `@readiness-reviewer` ↔
  `/check-readiness` ↔ `definition-of-ready.md` (DoR, before delivery) is the structural pair of
  `dod_check` ↔ `@reviewer` ↔ `/review` ↔ inline-in-change-lifecycle (DoD, before PR). Note #49
  as a future mechanical complement (not a dependency; DEC-6).

**Acceptance Criteria**:

- Must: file exists, declares `ados_distribution: redistributable` inside the single
  frontmatter block, and passes `test-doc-distribution.sh` (**AC1**, NFR-6).
- Must: states the prompt is authoritative; mirrors the DM-3 facet set with 0 contradictions
  (**NFR-2**).

**Files and modules**:

- `doc/guides/definition-of-ready.md` (new — redistributable mirror)

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh` — must pass (validates the marker +
  install-set invariants; AC1, NFR-6).
- `grep -F "ados_distribution: redistributable" doc/guides/definition-of-ready.md`.
- Manual: re-read the guide against the shipped `readiness-reviewer.md` prompt to confirm the
  facet set matches and the authority statement holds (NFR-2).

**No-op escape**: if the guide already exists with the marker, the authority statement, and the
  facet set, skip and only re-run the gate.

**Completion signal**: `docs(guides): add Definition of Ready mirror guide (GH-57)`

---

### Phase D: Lifecycle renumber — dor_check as phase 5; renumber 5–10 → 6–11

**Goal**: Make `doc/guides/change-lifecycle.md` the single, internally-consistent description of
the 11-phase flow: insert `dor_check` as phase 5, renumber the existing 5–10 to 6–11, and update
every surface in the guide (mermaid, agent-responsibility table, phase-reopening table, PM-notes
phase map) + reference the DoR guide. The guide is a doc; the `@toolsmith` hard rule does
**not** apply.

**Delegate**: `@coder`.

**Tasks**:

- [ ] **D.1** Update the **mermaid diagram** to insert `dor_check (5, @readiness-reviewer)`
  between `delivery_planning (4)` and `delivery (6, @coder)`, with `READY → delivery` and
  `NOT_READY → reopen an artifact phase` branches; renumber delivery…pr_creation to 6…11.
- [ ] **D.2** Update the **agent-responsibility table**: add the `dor_check` row (phase 5,
  `@readiness-reviewer`, "Review all artifacts together against the source ticket; emit a
  READY/NOT_READY verdict with per-facet findings"). Renumber subsequent rows to 6–11. **Keep
  `@reviewer` at the DoD row (now phase 8) unchanged in role.**
- [ ] **D.3** Update the **phase-reopening table** to add: a `dor_check` gap reopens
  `specification` / `test_planning` / `delivery_planning` — **never** `delivery` (F-4, AC4,
  RSK-8).
- [ ] **D.4** Update the **PM-notes phase map** description (DM-1): `dor_check` sits between
  `delivery_planning` and `delivery`.
- [ ] **D.5** **Reference the DoR guide** — link `doc/guides/definition-of-ready.md` from the
  `dor_check` phase description (and note the prompt is authoritative).
- [ ] **D.6** Preserve `ados_distribution: redistributable` and verify the renumbering is
  complete inside this file (the cross-file sweep is Phase F).

**Acceptance Criteria**:

- Must: `dor_check` present as phase 5; subsequent phases renumbered 6–11 in the mermaid +
  agent-responsibility table + PM-notes map (**AC2**, **AC8**).
- Must: phase-reopening table routes DoR gaps to artifact phases, never `delivery` (**AC4**,
  RSK-8).
- Must: `@reviewer` DoD role text unchanged, now at phase 8 (**AC9**, NFR-9).
- Must: `ados_distribution: redistributable` intact; DoR guide referenced.
- Should: total phase count in the guide == 11.

**Files and modules**:

- `doc/guides/change-lifecycle.md` (updated — phase 5 insertion + renumber + tables + map)

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh` — marker intact after edits.
- Structural read: mermaid shows 11 phases with `dor_check` at 5; agent-responsibility table
  lists `dor_check` + `@readiness-reviewer` and renumbers delivery…pr_creation to 6…11.
- Cross-phase consistency: any internal "phase N" prose in the guide points at the renumbered
  phases (the authoritative cross-file sweep is Phase F).

**No-op escape**: if a surface is already renumbered, skip that single edit and note it in the
execution log; still run the gates.

**Completion signal**: `docs(lifecycle): insert dor_check as phase 5, renumber to 11 phases (GH-57)`

---

### Phase E: Inventory + manifest — AGENTS.md, .opencode/README.md, review pm-instructions.md

**Goal**: Make `AGENTS.md`, `.opencode/README.md`, and (if relevant)
`.ai/agent/pm-instructions.md` reflect the 11-phase flow, the new agent, and the new command so
there is exactly one description of the flow across inventory surfaces (AC8). These are
docs/config, not agent/command definitions; the `@toolsmith` hard rule does **not** apply (the
`.opencode/README.md` inventory is a listing, not an agent/command definition).

**Delegate**: `@coder`.

**Tasks**:

- [ ] **E.1** `AGENTS.md` — **phase table**: renumber to 11 phases and add the `dor_check`
  row (phase 5, `@readiness-reviewer`, "Review all artifacts against the source ticket; emit a
  READY/NOT_READY verdict; reopen an artifact phase on NOT_READY"). Renumber delivery…pr_creation
  to 6…11.
- [ ] **E.2** `AGENTS.md` — **agent table** (under "Agent team"): add `readiness-reviewer` —
  "Definition of Ready gate — adversarial review of artifacts vs ticket before delivery".
- [ ] **E.3** `AGENTS.md` — **command table**: add `/check-readiness` — "Run the Definition of
  Ready gate (review artifacts vs ticket before delivery)".
- [ ] **E.4** `AGENTS.md` — **"Using the system" manual sequence**: insert `→ /check-readiness
  <ref>` between `/write-plan <ref>` and `/run-plan <ref>` (mirrors the DoR/DoD pairing in
  Appendix B).
- [ ] **E.5** `.opencode/README.md` — add `readiness-reviewer` to the agent inventory and
  `/check-readiness` to the command inventory, matching the sibling entries' style.
- [ ] **E.6** Review `.ai/agent/pm-instructions.md`: **add a `dor_check`/planning transition
  only if it enumerates phase transitions.** If it does not enumerate transitions (config-only
  for tracker access), make no edit and note that in the execution log (spec §7.1(F), §16).

**Acceptance Criteria**:

- Must: `AGENTS.md` phase table shows 11 phases with `dor_check` at 5; agent + command tables
  include `readiness-reviewer` + `/check-readiness`; manual sequence includes `/check-readiness`
  (**AC8**).
- Must: `.opencode/README.md` inventory lists both new entries (**AC8**).
- Must: `pm-instructions.md` reviewed; a transition added only if it enumerates transitions.
- Should: no `@reviewer` role text change (NFR-9).

**Files and modules**:

- `AGENTS.md` (updated — phase table + agent table + command table + manual sequence)
- `.opencode/README.md` (updated — agent + command inventory)
- `.ai/agent/pm-instructions.md` (reviewed; edited only if it enumerates phase transitions)

**Tests**:

- Structural: `AGENTS.md` phase table has 11 rows incl. `dor_check`; `readiness-reviewer` +
  `/check-readiness` present in their tables; manual sequence mentions `/check-readiness`.
- `grep -F "readiness-reviewer" .opencode/README.md` + `grep -F "check-readiness" .opencode/README.md`.

**No-op escape**: if `pm-instructions.md` does not enumerate transitions, explicitly no-op E.6
and record it; never invent a transition list to edit.

**Completion signal**: `docs(meta): reflect dor_check phase + @readiness-reviewer + /check-readiness in inventory (GH-57)`

---

### Phase F: Renumbering sweep + freshness verification (NFR-1 gate)

**Goal**: Prove the structural sweep is complete (0 stale phase-number references) and that both
CI-verifiable freshness gates are green. This is the dedicated sweep NFR-1 demands.

**Delegate**: `@coder` for the sweep + any stale-reference fixes (`@runner` may execute the CI
gates). Note: if a stale reference is found inside an `.opencode/agent|command` file (e.g.
`pm.md`), the fix is re-delegated to `@toolsmith`, not hand-edited by `@coder`.

**Tasks**:

- [ ] **F.1** Run the **grep sweep** for stale 10-phase / old-phase-5 references across
  `doc/guides/change-lifecycle.md`, `AGENTS.md`, `.opencode/README.md`, and
  `.opencode/agent/pm.md` — target **0 stale** references (e.g., no "phase 5 = delivery", no
  stray "10-phase", no `dod_check` still labeled phase 9 / `pr_creation` phase 10). Total
  phases == 11 everywhere (NFR-1).
- [ ] **F.2** Fix every stale reference found. **Governance check:** if any stale reference is
  inside `.opencode/agent/pm.md`, re-delegate that fix to `@toolsmith` and re-run
  `scripts/build-claude-plugin.sh`; do not hand-edit. Doc/guide/inventory fixes are `@coder`.
- [ ] **F.3** Confirm the DoR guide + the renumbered lifecycle guide pass the doc-distribution
  guard: `bash scripts/.tests/test-doc-distribution.sh` (NFR-6).
- [ ] **F.4** Confirm plugin freshness: `bash scripts/.tests/test-build-claude-plugin.sh`
  (source + generated committed together; NFR-5) and verify the freshness marker
  (`PLUGIN_FRESH` / no stale `.ados-claude`).
- [ ] **F.5** Confirm `@reviewer` is unchanged in role and now sits at phase 8; confirm
  `@readiness-reviewer` is a distinct agent/invocation (NFR-9).

**Acceptance Criteria**:

- Must: 0 stale phase-number references across all touched surfaces; 11 phases everywhere
  (**AC8**, **NFR-1**).
- Must: `test-build-claude-plugin.sh` PASS (NFR-5) and `test-doc-distribution.sh` PASS (NFR-6).
- Must: `@reviewer` DoD role unchanged, distinct from `@readiness-reviewer` (**AC9**, NFR-9).

**Files and modules**:

- (sweep across `doc/guides/change-lifecycle.md`, `AGENTS.md`, `.opencode/README.md`,
  `.opencode/agent/pm.md` — fixes only)

**Tests**:

- The grep sweep itself (F.1) — the durable proof of NFR-1.
- `bash scripts/.tests/test-build-claude-plugin.sh` — PASS.
- `bash scripts/.tests/test-doc-distribution.sh` — PASS.

**No-op escape**: if F.1 already yields 0 stale references and both gates are green, this phase
is verification-only; still record the sweep result.

**Completion signal**: `test(meta): 0 stale phase refs after dor_check renumber; freshness gates green (GH-57)`

---

### Phase G: Execution log + PM-notes phases update

**Goal**: Record what was delivered so this plan's checkboxes/execution log and the PM-notes
phase map reflect the shipped state. This is a bookkeeping commit on this plan file + the
pm-notes phase map.

**Delegate**: `@coder`.

**Tasks**:

- [ ] **G.1** Tick the completed task checkboxes for Phases A–F.
- [ ] **G.2** Append execution-log rows (phase / status / commit / notes) for each delivered
  phase.
- [ ] **G.3** Update `chg-GH-57-pm-notes.yaml` `phases` map: mark `delivery_planning`/`delivery`
  (and intermediate phases) per actual delivery progress; the new `phases.dor_check` entry
  introduced in Phase B is now part of the map (DM-1).

**Acceptance Criteria**:

- Must: plan checkboxes + execution log + pm-notes phases match the actually-committed state.

**Files and modules**:

- `doc/changes/2026-06/2026-06-27--GH-57--readiness-gate/chg-GH-57-plan.md` (updated — this file)
- `doc/changes/2026-06/2026-06-27--GH-57--readiness-gate/chg-GH-57-pm-notes.yaml` (updated — phases map)

**Tests**:

- None (bookkeeping).

**No-op escape**: if the log is already current, skip.

**Completion signal**: `docs(change): GH-57 execution log + pm-notes phases`

---

> **Out-of-plan phases (cross-referenced, not authored here — per the 11-phase lifecycle and
> spec §7.2 OUT / §18):**
>
> - **System-spec reconciliation** (any `doc/spec/features/*`) → `@doc-syncer`, **phase 7**
>   (`/sync-docs GH-57`): this is a delivery-process/framework change; reconcile only if a
>   feature spec drifts. No feature spec is in scope.
> - **Review** → `@reviewer`, **phase 8** (`/review GH-57`): audit vs spec/plan.
> - **Quality gates** → `@runner`, **phase 9** (`/check`): `test-doc-distribution.sh`,
>   `test-build-claude-plugin.sh` (and fixes via `@fixer` if any fail).
> - **DoD check** → `@pm`, **phase 10**: verify all AC met, all plan tasks done.
> - **PR creation** → `@pr-manager`, **phase 11** (`/pr`): single PR; CI verifies plugin
>   freshness + the doc-distribution guard; behavioral claims covered by the manual matrix +
>   PR review.
> - **End-to-end gate run (AC10)** → manual: GH-57's own delivery dogfoods the `dor_check`
>   gate; the pre-delivery red-team + the gate run itself exercise the full flow.
> - **Red-team (PM-coordinated)** → per pm-notes, the user requested two `@red-team-coordinator`
>   reviews (pre-delivery on spec/plan/test-plan; post-delivery on the shipped change). These
>   are adversarial layers separate from the delivery phases; findings are addressed via
>   follow-up phases before proceeding; stop at PR (ping user).

## Test Scenarios

| ID | Scenario | Phases | AC | Type |
|----|----------|--------|----|------|
| TC-STRUCT-ADR | ADR-0002 exists with `status: Proposed`, `decision_date: null`; 00-index.md row present; bidirectional links | A | AC7, DEC-7 | structural read |
| TC-STRUCT-DOR-PROMPT | Prompt carries authoritative DoR facets DM-3 + adversarial stance + independence + verdict/finding format DM-2 + hard-gate + override DM-4 + decision routing DM-5 | B | AC1, AC3, AC6, AC7, NFR-2/7/8 | structural read |
| TC-STRUCT-FRONTMATTER | `readiness-reviewer.md` frontmatter has `claude.model: opus` (model in config, not body) | B | NFR-3 | structural read |
| TC-STRUCT-PM-GATE | `pm.md` has a `dor_check` step between `delivery_planning` and `delivery`; reopening targets artifact phases only (never `delivery`); override path recorded; decision routing + pause; `phases.dor_check` in PM-notes map | B | AC2, AC4, AC5, AC6, DM-1 | structural read |
| TC-CI-PLUGIN | Plugin byte-fresh — source + regenerated `.ados-claude` committed together | B, F | NFR-5 | CI (`test-build-claude-plugin.sh`) |
| TC-STRUCT-GUIDE-MIRROR | `definition-of-ready.md` exists, declares `ados_distribution: redistributable` in one frontmatter block, states prompt authoritative, mirrors DM-3 with 0 contradictions | C | AC1, NFR-2/6 | CI (`test-doc-distribution.sh`) + structural |
| TC-STRUCT-LIFECYCLE | `change-lifecycle.md` mermaid + agent-responsibility table show 11 phases with `dor_check` at 5; phase-reopening table routes DoR gaps to artifact phases; `@reviewer` DoD row unchanged at phase 8; DoR guide referenced | D | AC2, AC4, AC8, AC9, NFR-9 | structural read |
| TC-STRUCT-INVENTORY | `AGENTS.md` phase table (11 phases) + agent table (`readiness-reviewer`) + command table (`/check-readiness`) + manual sequence; `.opencode/README.md` lists both | E | AC8 | structural read |
| TC-STRUCT-SWEEP | 0 stale phase-number references across all touched surfaces; 11 phases everywhere | F | AC8, NFR-1 | grep sweep |
| TC-CI-DOCDIST | `test-doc-distribution.sh` PASS after the new guide + renumbered lifecycle | C, F | NFR-6 | CI (`test-doc-distribution.sh`) |
| TC-STRUCT-ROLES | `@reviewer` role text unchanged (DoD); `@readiness-reviewer` distinct agent/invocation | B, F | AC9, NFR-9 | structural read |
| TC-MANUAL-ADVERSARIAL | On a sample change, the gate adversarially seeks gaps, emits READY/NOT_READY with per-facet findings, routes decisions, and reopens an artifact phase on NOT_READY | B–G | AC2, AC3, AC5, AC6 | manual (RSK-4) |
| TC-MANUAL-E2E | GH-57's own delivery runs `dor_check` end-to-end (dogfooding); either READY → delivery or NOT_READY → correct artifact phase | (delivery) | AC10 | manual (RSK-4) |

> Behavioral AC (AC2/AC3/AC5/AC6/AC10 agent-behavior parts) cannot be unit-tested in CI and are
> honestly marked **manual** (RSK-4, NFR-8). The formal `TC-*` IDs are provisional; the GH-57
> test plan (`chg-GH-57-test-plan.md`) is the authoritative traceability source. The CI-verifiable
> claims are the renumbering sweep (NFR-1), plugin freshness (NFR-5), and the doc-distribution
> guard (NFR-6).

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-57-spec.md | Spec (authority) |
| PM notes | ./chg-GH-57-pm-notes.yaml | Coordination |
| Test plan | ./chg-GH-57-test-plan.md | Test plan (authoritative TC traceability — to be authored) |
| Decision record (Phase A) | ../../decisions/ADR-0002-readiness-gate-definition-of-ready.md | ADR (Proposed; acceptance rides PR) |
| Decisions index (Phase A) | ../../decisions/00-index.md | Index (ADR-0002 row) |
| Readiness-reviewer agent (Phase B, via @toolsmith) | .opencode/agent/readiness-reviewer.md | Agent source (authoritative DoR) |
| Check-readiness command (Phase B, via @toolsmith) | .opencode/command/check-readiness.md | Command source |
| PM agent (Phase B, via @toolsmith) | .opencode/agent/pm.md | Agent source (dor_check step + reopening + override + routing) |
| Generated plugin (Phase B) | .ados-claude/agents/readiness-reviewer.md, .ados-claude/commands/check-readiness.md, .ados-claude/agents/pm.md | Generated plugin (byte-fresh) |
| DoR mirror guide (Phase C) | ../../guides/definition-of-ready.md | Redistributable guide (mirror) |
| Lifecycle guide (Phase D) | ../../guides/change-lifecycle.md | Redistributable guide (phase 5 + renumber) |
| Inventory (Phase E) | AGENTS.md, .opencode/README.md | Repo manifest |
| PM instructions (Phase E, reviewed) | .ai/agent/pm-instructions.md | Config (edited only if it enumerates transitions) |
| DoD reviewer (UNCHANGED — referenced) | .opencode/agent/reviewer.md | Agent source (house-style precedent; now phase 8) |
| House-style sibling | .opencode/agent/reviewer.md | Structural reference (Appendix C) |

## Phase Revision Log

| Phase | Version | Date | Changes |
|-------|---------|------|---------|
| _(empty — no phase-level revisions yet; this is the initial plan v1.0)_ | | | |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-27 | plan-writer | Initial plan — 7 phased commits (A decision record, B agent/command/PM tooling via PM→@toolsmith, C DoR mirror guide, D lifecycle renumber, E inventory/manifest, F renumbering sweep + freshness, G execution log). Governance split encoded: PM delegates @toolsmith for all `.opencode/agent|command` edits; @coder handles doc/guide/inventory edits. ADR-0002 status stays Proposed. System-spec reconciliation cross-referenced to @doc-syncer phase 7. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| A — decision record (@decision-advisor + @coder) | Pending | — | — | — | ADR-0002 (Proposed) + 00-index.md row. |
| B — agent/command/PM tooling (PM→@toolsmith) | Pending | — | — | — | readiness-reviewer.md + check-readiness.md + pm.md; regenerate `.ados-claude/`. |
| C — DoR mirror guide (@coder) | Pending | — | — | — | `doc/guides/definition-of-ready.md` (redistributable). |
| D — lifecycle renumber (@coder) | Pending | — | — | — | `doc/guides/change-lifecycle.md` (phase 5 + renumber 6–11). |
| E — inventory + manifest (@coder) | Pending | — | — | — | `AGENTS.md` + `.opencode/README.md` + review `pm-instructions.md`. |
| F — renumbering sweep + freshness (@coder/@runner) | Pending | — | — | — | 0 stale refs (NFR-1); plugin-fresh + doc-distribution green. |
| G — execution log + pm-notes (@coder) | Pending | — | — | — | This file + `chg-GH-57-pm-notes.yaml` phases. |
| (phase 7) system-spec reconciliation (@doc-syncer) | Out of plan | — | — | — | `/sync-docs GH-57` (only if a feature spec drifts). |
| (phase 8) review (@reviewer) | Out of plan | — | — | — | `/review GH-57`. |
| (phase 9) quality gates (@runner) | Out of plan | — | — | — | `/check`. |
| (phase 10) dod_check (@pm) | Out of plan | — | — | — | AC + task completion verification. |
| (phase 11) PR (@pr-manager) | Out of plan | — | — | — | `/pr`; single PR. |
| red-team (PM-coordinated) | Out of plan | — | — | — | Two `@red-team-coordinator` reviews (pre + post delivery); address findings before PR. |
