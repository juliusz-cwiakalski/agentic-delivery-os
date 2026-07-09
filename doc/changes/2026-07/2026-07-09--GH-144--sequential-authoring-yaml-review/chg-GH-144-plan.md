---
ados_distribution: project-generated
id: chg-GH-144-plan
status: Proposed
created: 2026-07-09T00:00:00Z
last_updated: 2026-07-09T00:00:00Z
owners: ["engineering"]
service: agentic-delivery-os
labels: ["process", "agents"]
version_impact: patch
links:
  change_spec: ./chg-GH-144-spec.md
  test_plan: ./chg-GH-144-test-plan.md
summary: >
  Implementation plan — strictly sequential artifact authoring (spec→test-plan→plan,
  reopen-on-gap) + consolidated single-YAML review output (local + remote, same DM-1
  schema). Derived from chg-GH-144-spec.md (AC-01..08, F-1..3, NFR-1..9, DM-1..4) and
  chg-GH-144-test-plan.md (TC-SEQ/YAML/XCHECK/CI). Agent/command edits are delegated to
  @toolsmith (repo hard rule).
---

# IMPLEMENTATION PLAN — GH-144: Sequential artifact authoring (spec→test-plan→plan) + consolidated review output (single YAML)

## Context and Goals

This plan delivers the two coupled concerns in GH-144 as **one PR** (spec DEC-1):

1. **Strictly sequential artifact authoring** — `@pm` step 4 rewritten so the three
   artifact-creation phases (specification → test_planning → delivery_planning) cannot
   fire in parallel; each waits for the predecessor to complete and consumes it; a
   documented **reopen-on-gap** loop lets a downstream author reopen the owning
   artifact-creation phase when it finds a gap (F-1, G-1).
2. **Consolidated single-YAML review output** — `@reviewer` writes **one YAML per
   iteration** (same DM-1 schema, local + remote) replacing the dual JSON+MD pair;
   re-review self-loads the YAML for dedup (F-2, G-2).
3. **Pre-DoR cross-check safety net + "canonical DoR trap" anti-pattern** documented in
   `change-lifecycle.md` (F-3, G-3) — this also folds in #109's pre-DoR cross-check
   (DEC-4); #109 is fully superseded (DEC-2).

**Resolved open questions** (none blocking): OQ-1 → `version: 1` in the review-YAML
schema; OQ-2 → `findings[]` is the re-review dedup source (`next_step` informational).

**Delivery order** mirrors spec §18. Phases 1–4 are `@toolsmith` delegations (repo hard
rule, DEC-7). Phase 5 edits the guide directly. Phase 6 regenerates the Claude plugin.
Phase 7 runs the CI gates.

## Scope

### In Scope

- **(A) `@pm` step-4 rewrite** — strictly sequential + wait-for-completion + each-builds-on-previous + reopen-on-gap (F-1, AC-01, AC-02; via `@toolsmith`).
- **(B) `@test-plan-writer`** — explicit "READ the completed spec, derive all values" first action (F-1, AC-03; via `@toolsmith`).
- **(C) `@plan-writer`** — explicit "READ the completed spec **and** test plan, derive all values" first action (F-1, AC-03; via `@toolsmith`).
- **(D) `@reviewer` consolidation** — single YAML per iteration (local `review-iter-<N>.yaml`; remote `review-draft.yaml`, same DM-1 schema); `state_files` table updated; re-review self-loads the YAML (F-2, AC-04, AC-05, AC-06; via `@toolsmith`).
- **(E) `@review-remote` command** — artifact-path references updated to `review-draft.yaml` (AC-05; via `@toolsmith`).
- **(F) `change-lifecycle.md`** — sequential dependency, reopen-on-gap loop + mermaid feedback edges, "canonical DoR trap" anti-pattern, pre-DoR cross-check (AC-02, AC-07; `ados_distribution: redistributable` preserved).
- **(G) `.ados-claude/` regeneration** + CI gates green (AC-08, NFR-3, NFR-7).

### Out of Scope

- Migrating historical review artifacts (`findings-iter-*.json`, `review-iter-*.md`, `review-draft.md`, `findings.json`) — NG-1.
- `@readiness-reviewer`'s `readiness-iter-<N>.md` format — NG-2.
- Which model authors artifacts — NG-3 (#115).
- A deterministic `ados check-readiness` CLI — NG-4 (#49). The pre-DoR cross-check is an AI-driven procedure, not a new tool.
- Renumbering the 11-phase flow (GH-57 settled numbering).
- Re-debating the YAML consolidation or #109 supersession (NG-5, NG-6).

### Constraints

- **Agent/command edits delegated to `@toolsmith`** (DEC-7; `AGENTS.md` "Extending the system"). `@coder` does not hand-edit `.opencode/agent/**` or `.opencode/command/**`.
- **Source + generated committed together** — `.opencode/` edits and regenerated `.ados-claude/` land in the same commit/PR (NFR-3, RSK-6).
- **No new access** — read-only sequencing/consolidation; no new network/external APIs (§8.4, §21).
- **Behavioral claims mostly manual** — most ACs are agent-capability claims not testable in CI (RSK-5); structural checks verify the prompt/guide *contains* the language.
- **Single YAML, same schema both modes** — fixed by the ticket (NG-5); DM-1 is authoritative.

### Risks

- **RSK-1** (M/L): Reviewer output format change could break a JSON consumer. Mitigated by confirming only `@reviewer` re-reads the JSON for dedup (PM analysis); re-review self-load moved to YAML; historical files untouched (NFR-6).
- **RSK-2** (M/M): Sequencing language reads as parallelizable if weak. Mitigated by explicit "STRICTLY SEQUENTIAL" + "wait for completion" + "never parallel" phrasing (NFR-1), verified by TC-SEQ-001/002/003.
- **RSK-3** (M/M): Reopen-on-gap could ping-pong or jump to delivery/dor_check. Mitigated by fencing reopen target to artifact-creation phases only (DM-4), verified by TC-SEQ-006.
- **RSK-4** (L/M): `@plan-writer` adding test plan as required input changes its FAIL mode. Intended behavior; sequential chain guarantees the test plan exists.
- **RSK-5** (M/H): Most ACs behavioral, untestable in CI. Mitigated by structural checks + CI gates + manual matrix + PR review + requested red-team review.
- **RSK-6** (M/M): `.ados-claude` goes stale. Mitigated by Phase 6 regeneration + TC-CI-001.
- **RSK-7** (M/M): Review-YAML schema drifts between modes. Mitigated by one shared DM-1 schema; verified by TC-YAML-006/007.

### Success Metrics

- `@pm` step 4 states strictly sequential + wait-for-completion + each-builds-on-previous; 0 parallel-delegation phrasing (NFR-1).
- `@test-plan-writer` consumes completed spec; `@plan-writer` consumes completed spec + test plan (first actions) (NFR-2).
- 1 YAML per iteration in local mode; 1 YAML in remote mode; 0 separate JSON/MD review files (NFR-5).
- Local + remote YAML share one DM-1 schema; re-review self-load reads the YAML (NFR-4).
- `change-lifecycle.md` documents reopen-on-gap loop + canonical DoR trap + pre-DoR cross-check (G-3).
- `.ados-claude/` regenerated; plugin-freshness + doc-distribution guards green (NFR-3, NFR-7).

## Phases

> **Phase dependency is strictly sequential** — each phase consumes the completed
> previous phase's output. This plan models the behavior GH-144 enforces (DEC-2).

### Phase 1: @toolsmith rewrites @pm step 4 (strictly sequential + reopen-on-gap)

**Goal**: Make `@pm`'s artifact-creation delegation strictly sequential with an explicit
wait-for-completion chain and a reopen-on-gap loop, eliminating the parallel-delegation
reading (F-1, G-1).

**Tasks**:

- [x] **1.1** Delegate to `@toolsmith` to rewrite `.opencode/agent/pm.md` step 4 from three independent delegation bullets into an explicit ordered chain: delegate specification → **wait for completion**; only then delegate test_planning (consumes completed spec); only then delegate delivery_planning (consumes completed spec + test plan).
- [x] **1.2** Ensure explicit "STRICTLY SEQUENTIAL", "wait for completion before delegating the next", "each builds on the previous output", and "never parallel" phrasing is present (NFR-1).
- [x] **1.3** Ensure **0 parallel-delegation** phrasing — no "in parallel"/"simultaneously" instructions for the three phases (TC-SEQ-002).
- [x] **1.4** Document the **reopen-on-gap** rule in step 4: when a downstream author finds a gap in an upstream artifact, reopen the owning artifact-creation phase (specification | test_planning | delivery_planning), correct, then resume — target is **never** `delivery` or `dor_check` (DM-4).
- [x] **1.5** Keep the prompt lean (NFR-8); no prose duplication.

**Acceptance Criteria**:

- Must: AC-01 — step 4 strictly sequential + wait-for-completion + each-builds-on-previous; no parallel-delegation phrasing.
- Must: (contributes to) AC-02 — reopen-on-gap rule present in `@pm` (lifecycle mirror happens in Phase 5).
- Must: NFR-1 (explicit sequencing phrasing), NFR-8 (lean).

**Affected code areas**:

- `.opencode/agent/pm.md` (updated) — via `@toolsmith`.

**System docs to update**:

- None in this phase (lifecycle guide is Phase 5).

**Tests**:

- TC-SEQ-001 — `rg -ni -e 'strictly sequential' -e 'wait for completion' -e 'each build' .opencode/agent/pm.md` → all present.
- TC-SEQ-002 — `rg -ni -e 'in parallel' -e 'parallel' -e 'simultaneously' .opencode/agent/pm.md` → 0 parallel-delegation instructions.
- TC-SEQ-003 — manual read of step 4: ordered chain, not independent bullets.

**Completion signal**: `feat(GH-144): rewrite @pm step 4 for strictly sequential authoring + reopen-on-gap`

---

### Phase 2: @toolsmith adds consume-preceding-artifact language to @test-plan-writer and @plan-writer

**Goal**: Make the two downstream authors explicitly **READ** the completed preceding
artifact(s) as a first action and derive all values from them (F-1, NFR-2). This is the
consumption half of the sequential chain.

**Tasks**:

- [x] **2.1** Delegate to `@toolsmith` to add an explicit first action to `.opencode/agent/test-plan-writer.md`: READ the completed `chg-<ref>-spec.md` and derive all values (TC IDs, AC coverage, file names, canonical values) from it (NFR-2). Preserve the existing "spec must exist → FAIL" guard.
- [x] **2.2** Delegate to `@toolsmith` to add an explicit first action to `.opencode/agent/plan-writer.md`: READ the completed `chg-<ref>-spec.md` **and** the completed `chg-<ref>-test-plan.md` and derive all values (plan tasks, AC alignment, file lists) from them (NFR-2, RSK-4). The test plan becomes a **required input**; FAIL guard applies when absent (intended behavior — the sequential chain guarantees presence).
- [x] **2.3** Keep both prompts lean (NFR-8).

**Acceptance Criteria**:

- Must: AC-03 — test-plan-writer consumes completed spec; plan-writer consumes completed spec **and** test plan, both as first actions.
- Must: NFR-2 (explicit consume/derive language), NFR-8 (lean).

**Affected code areas**:

- `.opencode/agent/test-plan-writer.md` (updated) — via `@toolsmith`.
- `.opencode/agent/plan-writer.md` (updated) — via `@toolsmith`.

**System docs to update**:

- None in this phase.

**Tests**:

- TC-SEQ-007 — `rg -ni -e 'read' -e 'completed spec' -e 'derive' .opencode/agent/test-plan-writer.md` → first-action consume-and-derive present.
- TC-SEQ-008 — `rg -ni -e 'spec' -e 'test plan' -e 'test-plan' -e 'derive' .opencode/agent/plan-writer.md` → both artifacts named as required inputs; derive-all-values present.
- TC-SEQ-009 — manual: prompts remain lean, no prose duplication.

**Completion signal**: `feat(GH-144): add consume-preceding-artifact first actions to @test-plan-writer and @plan-writer`

---

### Phase 3: @toolsmith consolidates @reviewer to single YAML (local + remote, DM-1 schema)

**Goal**: Collapse the dual JSON+MD review-output pair into a **single YAML per iteration**
in both modes, sharing one DM-1 schema; update `state_files`; make re-review self-load the
YAML (F-2, G-2).

**Tasks**:

- [x] **3.1** Delegate to `@toolsmith` to update `.opencode/agent/reviewer.md` local mode (step 9): write exactly one `<change_folder>/code-review/review-iter-<N>.yaml` per iteration (DM-2). Remove instructions to write `findings-iter-<N>.json` and `review-iter-<N>.md` for new iterations (NFR-5).
- [x] **3.2** Delegate to `@toolsmith` to update remote mode (step 10): write exactly one `tmp/code-review/<branch>/review-draft.yaml` (DM-3) using the **same DM-1 schema** as local (NFR-4). Leave `context.json`, `diff.patch`, `comments-snapshot.json`, `ticket-context.json`, `publish-report.json` **unchanged** (AC-05).
- [x] **3.3** Encode the DM-1 schema in the prompt: `version: 1`, `iteration`, `mode: local|remote`, `work_item_ref`, `branch`, `status: PASS|FAIL`, `summary`, `severity_breakdown: {critical, high, medium, low, info}`, `spec_compliance: PASS|FAIL|NA`, `plan_compliance: PASS|FAIL|NA`, `findings: [{id, severity, category, location, message, suggestion}]`, `reviewed_at` (ISO8601), `next_step` (OQ-1 → `version: 1`).
- [x] **3.4** Update the `state_files` table so the local-mode row lists only `review-iter-<N>.yaml` (no JSON/MD review rows) (NFR-5).
- [x] **3.5** Make the re-review / dedup step **self-load the YAML** `findings[]` (not the JSON) for dedup, in both modes (OQ-2 → `findings[]` is the dedup source; `next_step` informational).
- [x] **3.6** Keep the prompt lean (NFR-8); leave historical-file references only as legacy context, never as active write/read paths.

**Acceptance Criteria**:

- Must: AC-04 — local mode writes single `review-iter-<N>.yaml`; `state_files` lists only YAML; schema matches DM-1.
- Must: AC-05 — remote mode writes single `review-draft.yaml` (same schema); other remote artifacts unchanged.
- Must: AC-06 — re-review self-loads the YAML `findings[]` for dedup (both modes).
- Must: NFR-4 (schema parity), NFR-5 (no orphan review files), NFR-6 (historical untouched), NFR-8 (lean).

**Affected code areas**:

- `.opencode/agent/reviewer.md` (updated) — via `@toolsmith`.

**System docs to update**:

- None in this phase.

**Tests**:

- TC-YAML-001 — local writes single `review-iter-<N>.yaml`; 0 JSON/MD write instructions for new iterations.
- TC-YAML-002 — `state_files` table lists only the YAML (local mode).
- TC-YAML-003 — sample YAML matches DM-1; `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))"` parses.
- TC-YAML-004 — remote writes single `review-draft.yaml`; path matches DM-3.
- TC-YAML-005 — `context.json`/`diff.patch`/`comments-snapshot.json`/`ticket-context.json`/`publish-report.json` still present (unchanged).
- TC-YAML-006 — schema parity: local + remote reference one shared DM-1 schema (0 divergence).
- TC-YAML-007 — re-review self-loads the YAML `findings[]`, no JSON read.
- TC-YAML-009 — backward compat: no migration/deletion logic added; `readiness-reviewer.md` unchanged.

**Completion signal**: `feat(GH-144): consolidate @reviewer output to single review YAML (local + remote, DM-1)`

---

### Phase 4: @toolsmith updates @review-remote command paths

**Goal**: Align `.opencode/command/review-remote.md` artifact-path references with the
single `review-draft.yaml` introduced in Phase 3 (AC-05, scope item F).

**Tasks**:

- [x] **4.1** Delegate to `@toolsmith` to update `.opencode/command/review-remote.md`: change active review-output path references from `review-draft.md` + `findings.json` to the single `review-draft.yaml` (DM-3).
- [x] **4.2** Ensure no dangling references to the removed files as **active** paths; any remaining mentions must be legacy/contextual only (TC-YAML-008).
- [x] **4.3** Keep the command lean (NFR-8).

**Acceptance Criteria**:

- Must: AC-05 (scope item F) — review-remote references `review-draft.yaml`; no active removed-file refs.
- Must: NFR-8 (lean).

**Affected code areas**:

- `.opencode/command/review-remote.md` (updated) — via `@toolsmith`.

**System docs to update**:

- None in this phase.

**Tests**:

- TC-YAML-008 — `rg -ni -e 'review-draft\.yaml' .opencode/command/review-remote.md` → present; any `review-draft.md`/`findings.json` mentions are legacy/contextual only.
- TC-YAML-005 — (shared with Phase 3) other remote artifacts unchanged in the command.

**Completion signal**: `feat(GH-144): point @review-remote at review-draft.yaml`

---

### Phase 5: Update doc/guides/change-lifecycle.md (sequential dep, reopen-on-gap, canonical DoR trap, pre-DoR cross-check)

**Goal**: Document the durable process knowledge so the sequential + reopen-on-gap chain
and the residual-drift safety net are part of the canonical lifecycle guide (F-1, F-3,
G-3). Preserve `ados_distribution: redistributable` (NFR-7).

**Tasks**:

- [x] **5.1** Document the **strictly sequential dependency** between specification → test_planning → delivery_planning (each waits for the predecessor, consumes its output). Note it complements — does not replace — the existing phase numbering.
- [x] **5.2** Document the **reopen-on-gap loop**: test_planning finding a spec gap → reopens **specification**; delivery_planning finding a spec/test-plan gap → reopens **specification** or **test_planning**. Fence the reopen target to artifact-creation phases only — never `delivery`, `dor_check`, or later (DM-4; mirrors GH-57 F-4 earlier in the chain).
- [x] **5.3** Add **reopen-on-gap feedback edges** to the mermaid diagram (test_planning→specification; delivery_planning→(specification|test_planning)); preserve the existing A→B→C→D→E shape.
- [x] **5.4** Name the **"canonical DoR trap"** anti-pattern (exact phrase, §23): each author independently invents canonical values (TC IDs, file names, field names) during parallel authoring → they diverge and collide expensively at the gate; sequential authoring + the cross-check is the structural fix.
- [x] **5.5** Document the **pre-DoR cross-check** as a lightweight, AI-driven residual-drift safety net run after artifacts exist and before `dor_check`: (a) AC↔TC coverage bijective; (b) file inventory consistent across spec/plan; (c) shared/canonical values agree. Frame it explicitly as **complementary**, not a gate replacement — `dor_check` (phase 5) remains the authoritative adversarial gate (NFR-9).
- [x] **5.6** Preserve `ados_distribution: redistributable` in the frontmatter (NFR-7).

**Acceptance Criteria**:

- Must: AC-02 — reopen-on-gap loop documented; fenced to artifact-creation phases; never delivery/dor_check; mermaid reflects the reopen edges.
- Must: AC-07 — "canonical DoR trap" named + pre-DoR cross-check documented as safety net (not gate replacement).
- Must: NFR-7 (redistributable preserved), NFR-9 (safety net, not gate replacement).

**Affected code areas**:

- `doc/guides/change-lifecycle.md` (updated) — direct edit (guide, not agent/command).

**System docs to update**:

- `doc/guides/change-lifecycle.md` itself is the system doc updated here (the canonical lifecycle reference). Any further `doc/spec/**` reconciliation happens in phase 7 via `@doc-syncer`.

**Tests**:

- TC-SEQ-004 — both reopen edges documented (test_planning→specification; delivery_planning→specification|test_planning).
- TC-SEQ-005 — mermaid feedback-loop edges reflect reopen-on-gap.
- TC-SEQ-006 — reopen target fenced to artifact-creation phases; no edge to delivery/dor_check.
- TC-XCHECK-001 — `rg -ni -e 'canonical DoR trap' doc/guides/change-lifecycle.md` → named.
- TC-XCHECK-002 — pre-DoR cross-check documented (AC↔TC coverage, file inventory, shared values).
- TC-XCHECK-003 — cross-check framed as safety net; `dor_check` authoritative.
- TC-CI-002 (precondition) — `rg -n '^ados_distribution: redistributable$' doc/guides/change-lifecycle.md` → present.

**Completion signal**: `docs(GH-144): document sequential authoring, reopen-on-gap, canonical DoR trap, pre-DoR cross-check`

---

### Phase 6: Regenerate .ados-claude/ via scripts/build-claude-plugin.sh

**Goal**: Keep the generated Claude Code plugin byte-fresh with the `.opencode/` source
edits from Phases 1–4 (NFR-3, RSK-6). Source + generated committed together.

**Tasks**:

- [x] **6.1** Run `bash scripts/build-claude-plugin.sh` to regenerate the `.ados-claude/` counterparts for `pm.md`, `test-plan-writer.md`, `plan-writer.md`, `reviewer.md`, `review-remote.md`.
- [x] **6.2** Verify no stale diff: `git diff --exit-code -- .ados-claude/` is clean *after* regeneration (i.e., the committed generated files match a fresh build) (TC-CI-001).
- [x] **6.3** Commit the `.opencode/` source edits (Phases 1–4) together with the regenerated `.ados-claude/` output. Do **not** hand-edit `.ados-claude/` files.

**Acceptance Criteria**:

- Must: AC-08 (plugin freshness half) — `.ados-claude/` regenerated from `.opencode/`; no stale diff.
- Must: NFR-3 (byte-freshness), RSK-6 mitigated.

**Affected code areas**:

- `.ados-claude/agent/pm.md` (regenerated)
- `.ados-claude/agent/test-plan-writer.md` (regenerated)
- `.ados-claude/agent/plan-writer.md` (regenerated)
- `.ados-claude/agent/reviewer.md` (regenerated)
- `.ados-claude/command/review-remote.md` (regenerated)

**System docs to update**:

- None (`.ados-claude/` is generated, not a system doc).

**Tests**:

- TC-CI-001 — `bash scripts/build-claude-plugin.sh && git diff --exit-code -- .ados-claude/` → green; counterparts byte-fresh.

**Completion signal**: `build(GH-144): regenerate .ados-claude plugin for sequential authoring + review YAML`

---

### Phase 7: CI gates + DoD readiness (plugin freshness, doc-distribution, static)

**Goal**: Run the automated CI gates and the static `git diff --check`, confirm all ACs
met, then hand off to phase 8 (`@reviewer`) and phase 10 (`@pm` DoD). This phase also
covers the `@doc-syncer` reconciliation referenced in spec §18 step 7.

**Tasks**:

- [x] **7.1** Run the plugin-freshness gate: `bash scripts/build-claude-plugin.sh && git diff --exit-code -- .ados-claude/` (TC-CI-001).
- [x] **7.2** Run the doc-distribution guard: `bash scripts/.tests/test-doc-distribution.sh` (TC-CI-002) — covers `change-lifecycle.md` keeping `redistributable`.
- [x] **7.3** Run the static gate: `git diff --check` clean (TC-CI-003).
- [x] **7.4** Run the full structural TC suite (TC-SEQ-001..009, TC-YAML-001..009, TC-XCHECK-001..003) per the test plan's commands; record results in the test plan's Execution Log.
- [x] **7.5** Delegate to `@doc-syncer` (lifecycle phase 7) to reconcile `doc/spec/**` with the implementation if any system-spec surface references PM step 4 / reviewer output / lifecycle flow.
- [x] **7.6** Confirm all 8 ACs satisfied; if any structural TC fails, reopen the owning phase (per the reopen-on-gap discipline this very change introduces).

**Acceptance Criteria**:

- Must: AC-08 — plugin-freshness + doc-distribution CI guards green.
- Must: all of AC-01..AC-08 traced to ≥1 passing TC (full coverage matrix in the test plan).
- Must: NFR-3, NFR-7, and the testing-strategy §Fallback static layer satisfied.

**Affected code areas**:

- None (gate-running phase). `doc/spec/**` may be reconciled by `@doc-syncer` if needed.

**System docs to update**:

- `doc/spec/**` — reconciled by `@doc-syncer` only if a surface references the changed behavior (otherwise no-op).

**Tests**:

- TC-CI-001 — plugin freshness green.
- TC-CI-002 — doc-distribution guard green.
- TC-CI-003 — `git diff --check` clean.
- All structural TCs (TC-SEQ/YAML/XCHECK) per the test plan.

**Completion signal**: `test(GH-144): CI gates green (plugin freshness + doc-distribution + static)`

---

## Test Scenarios

> Full TC definitions, commands, and expected outcomes live in
> `./chg-GH-144-test-plan.md`. The matrix below maps each TC to the phase that
> delivers its target and the AC(s) it verifies.

| TC ID | Scenario | Phase | AC | NFR |
|-------|----------|-------|----|-----|
| TC-SEQ-001 | pm.md: strictly-sequential + wait-for-completion + each-builds-on-previous present | 1 | AC-01 | NFR-1 |
| TC-SEQ-002 | pm.md: no parallel-delegation phrasing (absence) | 1 | AC-01 | NFR-1 |
| TC-SEQ-003 | pm.md step 4 reads as ordered chain (manual) | 1 | AC-01 | — |
| TC-SEQ-004 | lifecycle: reopen-on-gap loop documented (both edges) | 5 | AC-02 | — |
| TC-SEQ-005 | lifecycle: mermaid feedback edges reflect reopen-on-gap | 5 | AC-02 | — |
| TC-SEQ-006 | lifecycle: reopen target fenced to artifact-creation phases | 5 | AC-02 | — |
| TC-SEQ-007 | test-plan-writer.md: reads completed spec, derives all values | 2 | AC-03 | NFR-2 |
| TC-SEQ-008 | plan-writer.md: reads completed spec AND test plan, derives all values | 2 | AC-03 | NFR-2 |
| TC-SEQ-009 | modified prompts stay lean; no prose duplication | 1–4 | — | NFR-8 |
| TC-YAML-001 | reviewer.md: local writes single review-iter-<N>.yaml; 0 JSON/MD | 3 | AC-04 | NFR-5 |
| TC-YAML-002 | reviewer.md: state_files lists only YAML (local) | 3 | AC-04 | NFR-5 |
| TC-YAML-003 | local review YAML matches DM-1 schema (valid YAML) | 3 | AC-04 | NFR-4 |
| TC-YAML-004 | reviewer.md: remote writes single review-draft.yaml (same schema) | 3 | AC-05 | — |
| TC-YAML-005 | reviewer.md + review-remote.md: other remote artifacts unchanged | 3, 4 | AC-05 | — |
| TC-YAML-006 | schema parity: local + remote share one DM-1 schema | 3 | AC-05, AC-06 | NFR-4 |
| TC-YAML-007 | re-review self-loads YAML findings[] (not JSON), both modes | 3 | AC-06 | NFR-4 |
| TC-YAML-008 | review-remote.md: references review-draft.yaml; no removed-file refs | 4 | AC-05 | — |
| TC-YAML-009 | backward compat: no migration/deletion; readiness-reviewer.md unchanged | 3, 7 | — | NFR-6 |
| TC-XCHECK-001 | lifecycle: names "canonical DoR trap" anti-pattern | 5 | AC-07 | — |
| TC-XCHECK-002 | lifecycle: documents pre-DoR cross-check (AC↔TC, file inventory, shared values) | 5 | AC-07 | — |
| TC-XCHECK-003 | cross-check framed as safety net; dor_check authoritative | 5 | AC-07 | NFR-9 |
| TC-CI-001 | .ados-claude/ regenerated; plugin freshness green | 6, 7 | AC-08 | NFR-3 |
| TC-CI-002 | doc-distribution guard green (redistributable kept) | 5, 7 | AC-08 | NFR-7 |
| TC-CI-003 | git diff --check clean | 7 | — | (static layer) |

**AC coverage**: AC-01 (TC-SEQ-001/002/003) · AC-02 (TC-SEQ-004/005/006) · AC-03 (TC-SEQ-007/008) · AC-04 (TC-YAML-001/002/003) · AC-05 (TC-YAML-004/005/008) · AC-06 (TC-YAML-006/007) · AC-07 (TC-XCHECK-001/002/003) · AC-08 (TC-CI-001/002). All 8 ACs covered.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-144-spec.md | Spec (source of truth) |
| Test plan | ./chg-GH-144-test-plan.md | Test plan |
| PM analysis | ./chg-GH-144-pm-notes.yaml | PM notes |
| `@pm` definition | `.opencode/agent/pm.md` | Agent prompt (updated, Phase 1) |
| `@test-plan-writer` definition | `.opencode/agent/test-plan-writer.md` | Agent prompt (updated, Phase 2) |
| `@plan-writer` definition | `.opencode/agent/plan-writer.md` | Agent prompt (updated, Phase 2) |
| `@reviewer` definition | `.opencode/agent/reviewer.md` | Agent prompt (updated, Phase 3) |
| `@review-remote` command | `.opencode/command/review-remote.md` | Command (updated, Phase 4) |
| Lifecycle guide | `doc/guides/change-lifecycle.md` | Guide (updated, Phase 5) |
| Generated Claude plugin | `.ados-claude/` counterparts | Generated (regenerated, Phase 6) |
| Plugin builder | `scripts/build-claude-plugin.sh` | CI script |
| Doc-distribution guard | `scripts/.tests/test-doc-distribution.sh` | CI test |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-09 | @plan-writer | Initial plan for GH-144. Derived from `chg-GH-144-spec.md` (AC-01..08, F-1..3, NFR-1..9, DM-1..4) and `chg-GH-144-test-plan.md` (TC-SEQ/YAML/XCHECK/CI). Phases mirror spec §18 delivery order; agent/command edits delegated to `@toolsmith` (DEC-7). |

## Execution Log

<!-- Populated during /run-plan. Reopen-on-gap (DM-4): a failing TC reopens the owning phase, never delivery/dor_check. -->

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 — @pm step 4 rewrite | Done | 2026-07-09 | 2026-07-09 | 611e34d | Strictly sequential + wait-for-completion + reopen-on-gap |
| 2 — @test-plan-writer + @plan-writer consume | Done | 2026-07-09 | 2026-07-09 | 611e34d | Consume-preceding-artifact first actions |
| 3 — @reviewer single YAML | Done | 2026-07-09 | 2026-07-09 | 611e34d | Consolidated to single review YAML (local + remote, DM-1) |
| 4 — @review-remote paths | Done | 2026-07-09 | 2026-07-09 | 611e34d | Pointed at review-draft.yaml |
| 5 — change-lifecycle.md | Done | 2026-07-09 | 2026-07-09 | 611e34d | Sequential dep + reopen-on-gap + canonical DoR trap + pre-DoR cross-check |
| 6 — regenerate .ados-claude/ | Done | 2026-07-09 | 2026-07-09 | 611e34d | Plugin regenerated (source + generated committed together) |
| 7 — CI gates + DoD readiness | Pending | | | | Pending quality_gates phase |

---

## AUTHORING NOTES

This plan models the behavior GH-144 enforces: the completed **spec** and completed
**test plan** were **read first**, and every phase task, acceptance criterion, affected
file, TC mapping, and completion signal is **derived** from them — nothing invented. The
7 phases mirror spec §18's delivery order exactly; agent/command edits (Phases 1–4) are
delegated to `@toolsmith` (DEC-7, repo hard rule); Phase 5 edits the guide directly;
Phase 6 regenerates the Claude plugin; Phase 7 runs CI gates. The phase chain is
**strictly sequential** — each phase consumes the completed previous phase's output
(this plan dogfoods F-1). Open questions OQ-1/OQ-2 are resolved in the spec and reflected
in Phases 3 and the TC matrix. Historical review artifacts are intentionally untouched
(NG-1); the review-YAML schema is DM-1, shared by both modes (NG-5).
