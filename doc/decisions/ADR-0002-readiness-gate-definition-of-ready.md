---
id: ADR-0002
decision_type: adr
status: Proposed
created: 2026-06-27
decision_date: null
last_updated: 2026-06-27
summary: "Add a Definition of Ready gate (@readiness-reviewer + /check-readiness + dor_check phase) that adversarially critiques change artifacts against the source ticket before delivery; prompt-as-source DoR; hard gate + recorded override."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-lifecycle
decision_area: architecture
decision_scope: org
reversibility: moderate
review_date: null
business_impact: "Inserts the highest-leverage pre-delivery checkpoint; structurally counters AI sycophancy at the point where spec/plan/test-plan gaps compound most"
customer_impact: null
classification:
  domains: [architecture, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: medium
  blast_radius: org
  recurrence: one-off
governance:
  driver: "@decision-advisor"
  decider: null
  contributors:
    - "Juliusz Ćwiąkalski (author)"
  reviewers: []
  performers:
    - "@toolsmith"
    - "@coder"
  informed:
    - "ADOS users"
ai_assistance:
  used: true
  roles: [analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A DoR facet proves to need deep specialization, prompting a split-out critic (the single-critic choice is reversible by design)"
  - "Adoption friction shows the gate over-blocks, or the override discipline slips toward de-facto silent skip"
  - "The deferred mechanical pre-check (issue #49) lands and shifts the DoR/guide split"
links:
  related_changes: ["GH-57"]
  supersedes: []
  superseded_by: []
  spec: ["doc/changes/2026-06/2026-06-27--GH-57--readiness-gate/chg-GH-57-spec.md"]
  contracts: []
  diagrams: []
  decisions: ["ADR-0001"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0002: Readiness Gate (Definition of Ready) for Pre-Delivery Artifact Critique

## Context

ADOS delivers changes through a PM-orchestrated, deterministic workflow. The four **artifact-creation phases** — `clarify_scope` → `specification` (`@spec-writer`) → `test_planning` (`@test-plan-writer`) → `delivery_planning` (`@plan-writer`) — produce the highest-leverage artifacts in the entire pipeline: a flaw in the spec, test-plan, or plan compounds across **every** implementation task built on it.

- **FACT:** Today these artifacts are handed straight to `@coder` (phase 5, `delivery`) with **no independent critique** between plan authoring and implementation.
- **FACT:** The only structured review agent is `@reviewer` (phase 7, `review_fix`), a **Definition of Done**: it audits *implementation against spec/plan* (post-implementation, on diffs). It does not critique the artifacts themselves pre-implementation.
- **FACT:** The structural precedent for a unified, adversarial review agent is `@reviewer` itself — GH-36 merged a separate `code-reviewer` into one `@reviewer` explicitly for **cross-artifact consistency**, and it runs on a stronger reasoning tier (`claude.model: opus` frontmatter) with a hard adversarial `built_in_heuristics` block. This is the house style the new agent mirrors.
- **FACT:** Per `AGENTS.md` "Extending the system", editing `.opencode/agent/**` and `.opencode/command/**` is delegated to `@toolsmith`, and `.opencode/` (source) + `.ados-claude/` (generated) are committed together with CI-enforced freshness.
- **ASSUMPTION:** AI agents tend toward sycophancy — confidently producing plausible-but-incomplete artifacts — and with no adversarial gate this bias is unopposed at the highest-leverage point in delivery.
- **TO CONFIRM:** That the new gate materially catches pre-implementation gaps in practice (behavioral; verified manually by GH-57 dogfooding the gate end-to-end, AC10).

The GH-57 change implements this gate; this record (ADR-0002) captures its precedent-setting structural decisions. It follows the **ADR-0001 precedent** that delivery-workflow structural changes are recorded as ADRs.

## Problem Framing (Clarified)

The root cause is a **missing separation of concerns**: artifact-creation and implementation are directly coupled with no critique gate between them. The question *"are the artifacts right?"* is never asked before code exists; the only review checkpoint conflates **Definition of Done** (code-vs-spec, post-implementation) with the absent **Definition of Ready** (artifacts-vs-ticket, pre-implementation).

Symptoms that follow from this:

- **Highest-leverage artifacts are unreviewed.** Spec/plan/test-plan reach `@coder` unvetted; a single ambiguous or untestable AC multiplies across the build.
- **Sycophancy surfaces late and expensively.** Gaps reach `@reviewer` (phase 7) only *after* the entire implementation is written — the most expensive moment to discover them.
- **No formal Definition of Ready.** "Is this ready to build?" is judged ad hoc; nothing enforces AC testability/non-overlap, plan coverage of every AC, test-plan traceability to every AC, cross-artifact consistency, or decision capture.
- **Decision capture timing is implicit.** Decisions surfaced during specification have no dedicated routing gate (change-scoped → change docs; system-wide/precedent-setting → decision records).

The fix is to insert an independent, adversarial Definition-of-Ready gate **between `delivery_planning` and `delivery`**, owned by a new agent (`@readiness-reviewer`), that critiques all change artifacts together against the source ticket — explicitly distinct from the post-implementation `@reviewer` (DoD), which stays unchanged in role.

## Constraints (Hard Requirements)

### C-1: The gate must be pre-implementation

- **Statement:** The readiness gate must run *before* `delivery` — it critiques artifacts, never code. It must not become a second Definition of Done.
- **Source:** AC
- **Verification:** code review (phase position between `delivery_planning` and `delivery`; agent inputs are artifacts + ticket, not code/diffs)
- **Negotiable:** no

### C-2: DoR/DoD role separation must be preserved

- **Statement:** The post-implementation `@reviewer` must remain purely the Definition of Done (code-vs-spec, post-implementation, diffs). The DoR gate must be a distinct agent/invocation so the two roles are never conflated.
- **Source:** prior decision (GH-36 unified-`@reviewer` precedent)
- **Verification:** code review (`@reviewer` role text unchanged; `@readiness-reviewer` is a distinct agent)
- **Negotiable:** no

### C-3: No silent skip

- **Statement:** The gate must block delivery by default. The only bypass for genuinely trivial changes must be an **explicit, recorded override**; no unconditional/silent skip path may exist.
- **Source:** AC
- **Verification:** code review / audit (prompt encodes hard-gate-default + override-record fields; absence of an unconditional pass)
- **Negotiable:** no

### C-4: Single source of truth for `.opencode`

- **Statement:** New/changed agent and command definitions must be authored via `@toolsmith` (not hand-edited), and `.opencode/` source + generated `.ados-claude/` counterparts must be committed together with CI-enforced freshness.
- **Source:** internal standard (AGENTS.md "Extending the system" + "Generated plugin rule")
- **Verification:** code review + CI (`scripts/build-claude-plugin.sh` freshness check)
- **Negotiable:** no

### C-5: DoR must be enforced behavior (lives in the prompt)

- **Statement:** The Definition of Ready must live authoritatively in the `@readiness-reviewer` prompt (the prompt is the product; enforced correctness behavior belongs in the prompt), with `doc/guides/definition-of-ready.md` as a human-readable mirror that explicitly states the prompt is authoritative.
- **Source:** internal standard (AGENTS.md "prompts are the product")
- **Verification:** code review (DoR facets present in prompt; guide states prompt authoritative)
- **Negotiable:** no

> **Table-stakes:** All alternatives inherit git-native, no-runtime, no-new-external-access properties (plain Markdown/YAML definitions; the gate reads only local artifacts + the existing tracker access). These are acknowledged once, not re-listed per alternative.

## Decision Drivers

**Business drivers:**
- Catch high-leverage gaps early — a flaw found at the DoR gate saves the entire downstream implementation cost rather than surfacing post-delivery. *(highest weight)*
- Make the gate the formal decision-capture point (routing change-scoped vs system-wide decisions to the right home).

**Technical drivers:**
- Cross-artifact consistency — every AC covered by the plan and traced by the test-plan; ticket → spec → test-plan → plan aligned. *(the highest-value DoR facet)*
- Single source of truth — the DoR is authoritative in exactly one place (the prompt); the guide mirrors, never competes.
- Anti-sycophancy — a structural (not willpower-based) counter to plausible-but-incomplete artifacts.

**Operational drivers:**
- Reversibility — a reversible structural choice beats a theoretically optimal one delayed; the single-critic shape can split later if a facet needs specialization.
- Lean process — ceremony scales with stakes; one extra gate on high-leverage artifacts pays for itself.
- Paved road — mirror the proven `@reviewer` house style rather than invent a new pattern.

**Ranked:** catching high-leverage gaps early · cross-artifact consistency · anti-sycophancy · reversibility · lean process · single-source-of-truth.

## Mental Models & Techniques Used

- **Reversibility trumps theoretical optimality:** a single critic is reversible — a facet can be split into a specialized critic later if needed. Defer the irreversible/complex version (multiple critics) until a facet proves it needs specialization.
- **Paved road:** mirror `@readiness-reviewer` on the shipped `@reviewer` (frontmatter incl. `claude.model: opus`, role/non-goals, adversarial heuristics, structured findings, read-only safety rules). Novelty must justify its cognitive load.
- **Inversion:** what would make a readiness gate *fail*? A silent skip — because agents would always judge their own work "trivial," reintroducing the sycophancy the gate exists to prevent. Hence hard-gate-default + explicit recorded override (no silent skip).
- **Separation of concerns:** DoR (artifacts-vs-ticket, pre-implementation) and DoD (code-vs-spec, post-implementation) have different inputs, timing, and mental models — keep them as distinct agents.
- **Least privilege:** the reviewer is read-only — it critiques and emits a verdict; it does not modify code and does not auto-merge/approve.
- **Second-order thinking:** the cost of a flawed plan is not the plan's defect — it is every implementation task built on the flaw. That second-order cost is what the gate exists to prevent.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

≥3 constraints have mixed compliance across alternatives, so a matrix is used (default-to-matrix heuristic).

| Alternative | C-1 (pre-impl gate) | C-2 (DoR/DoD separation) | C-3 (no silent skip) | C-4 (`.opencode` SoT) | C-5 (DoR in prompt) |
|-------------|:---:|:---:|:---:|:---:|:---:|
| **Alt 0 — Do nothing (status quo)** | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Alt 1 — New `@readiness-reviewer` + `/check-readiness` + `dor_check` (chosen)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Alt 2 — Multiple specialized critics (`@spec-critic`/`@plan-critic`/`@test-plan-critic`)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Alt 3 — `@reviewer` "readiness mode"** | ✅ | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails (disqualifying, constraint is `negotiable: no`) · ⚠️ passes only via an accepted-risk exception (none here).

### Alternative 0 — Do Nothing / Keep Current Approach

- **Summary:** No readiness gate; artifact-creation phases continue handing artifacts straight to `@coder`; `@reviewer` remains the only (DoD) review.
- **Pros:** Zero migration cost; no lifecycle renumbering; no new agent to maintain.
- **Cons:** Highest-leverage artifacts stay unreviewed pre-implementation; sycophancy unopposed at the most expensive-to-fix-later point; no formal DoR; no decision-capture gate.
- **Constraint compliance:** Fails **C-1** (no pre-implementation gate exists), **C-3** (everything is silently passed — the most extreme silent-skip case), and **C-5** (no enforced DoR behavior exists at all). Passes C-2 (vacuously — `@reviewer` is unchanged) and C-4 (no `.opencode` change).
- **Why rejected:** Three disqualifying constraint failures. The status quo *is* the root problem.

### Alternative 1 — New `@readiness-reviewer` + `/check-readiness` + `dor_check` phase, prompt-as-source DoR (chosen)

- **Summary:** Insert `dor_check` as the new phase 5 (renumber existing 5–10 → 6–11); add `@readiness-reviewer` (adversarial, independent, read-only, multi-facet DoR authoritative in its prompt, `claude.model: opus`) and `/check-readiness`; emit `READY`/`NOT_READY` with per-facet findings; on `NOT_READY` reopen the relevant artifact-creation phase (never `delivery`); hard-gate-default with an explicit recorded override for trivial changes; a redistributable `doc/guides/definition-of-ready.md` mirror stating the prompt is authoritative.
- **Pros:** Highest-leverage checkpoint exactly where gaps compound most; structural anti-sycophancy; one holistic view maximizes cross-artifact consistency (the highest-value facet); clean DoR/DoD separation (`@reviewer` untouched); paved-road house style; reversible (remove the phase/agent; renumber back).
- **Cons:** Lifecycle renumbering has a wide blast radius (mitigated by the NFR-1 sweep); one extra gate adds latency to delivery (acceptable: a trivial cost vs implementing a flawed plan); prompt + mirror must be co-maintained (mitigated by the mirror stating the prompt is authoritative).
- **Constraint compliance:** Passes all constraints C-1–C-5.
- **Why chosen:** The only alternative that satisfies every constraint *and* maximizes the cross-artifact-consistency driver, while staying reversible and on the paved road.

### Alternative 2 — Multiple specialized critics (`@spec-critic` / `@plan-critic` / `@test-plan-critic`)

- **Summary:** Instead of one holistic reviewer, create a specialized critic per artifact type.
- **Pros:** Each critic can carry deep, artifact-specific heuristics.
- **Cons:** Agent proliferation (3+ agents for one capability); siloed critics each see **one artifact** and are therefore worst at the single highest-value facet — cross-artifact consistency (ticket → spec → test-plan → plan alignment needs *one* view of the whole set); fragments the DoR across 3 prompts (weakens single-source-of-truth, though not a hard C-5 violation); higher maintenance/routing cost.
- **Constraint compliance:** Passes all constraints C-1–C-5 — but passes on the wrong axis.
- **Why rejected:** It satisfies the constraints yet **loses on the cross-artifact-consistency driver**, which is the point of the gate. A single holistic reviewer can still specialize *via checklist sections*; specialization into separate agents is deferred until a facet proves it needs it (reversible).

### Alternative 3 — `@reviewer` "readiness mode"

- **Summary:** Add a "readiness" mode to the existing `@reviewer` instead of a new agent.
- **Pros:** No new agent; one fewer definition to maintain.
- **Cons:** Overloads `@reviewer` with two distinct responsibilities (DoR pre-impl vs DoD post-impl) that have different inputs, timing, and mental models; conflates DoR and DoD — the exact conflation this change exists to end.
- **Constraint compliance:** Fails **C-2** (DoR/DoD role separation) — a "readiness mode" means `@reviewer`'s role is no longer purely DoD. Disqualifying (C-2 is `negotiable: no`).
- **Why rejected:** Disqualifying constraint failure, and the conceptual conflation it introduces is the root problem reframed as a feature.

## Decision

**Adopt Alternative 1.** Insert a Definition of Ready gate as a new lifecycle phase `dor_check` (new phase 5; existing 5–10 renumbered to 6–11), owned by a new adversarial agent `@readiness-reviewer` (invoked via `/check-readiness`). The gate critiques all change artifacts (spec + test-plan + plan) together against the source ticket, under an adversarial/critical stance independent of the artifact authors, emits a `READY`/`NOT_READY` verdict with per-facet findings, and on `NOT_READY` reopens the relevant artifact-creation phase (never `delivery`).

The sub-decisions (the ticket's open decisions plus the PM-level structural decision), each tied to a driver:

1. **DEC-1 — One `@readiness-reviewer` with a structured multi-facet DoR checklist (not multiple specialized critics).** Cross-artifact consistency needs one holistic view; matches the unified-`@reviewer` precedent (GH-36). Specialization happens via checklist sections; a facet can split out later (reversible).
2. **DEC-2 — A new agent, not a `@reviewer` "readiness mode".** `@reviewer` is code-vs-spec (post-impl, diffs); readiness is artifacts-vs-ticket (pre-impl, no code). Different inputs/timing/mental model. (Satisfies C-2.)
3. **DEC-3 — Stronger reasoning model: OpenCode model via the `opencode*.jsonc` config; Claude Code model via `claude.model: opus` agent frontmatter (mirrors `@reviewer`). Model assignment is NOT encoded in the prompt body.** (Satisfies C-4.)
4. **DEC-4 — Hard gate by default + explicit, recorded override for genuinely trivial changes (no silent skip).** A silent skip reintroduces sycophancy; the override forces a conscious, recorded decision. (Satisfies C-3.)
5. **DEC-5 — DoR location = prompt-as-source-of-truth (refined by ticket comment #1).** Core DoR authoritative in the `@readiness-reviewer` prompt; `doc/guides/definition-of-ready.md` is a human-readable mirror stating the prompt is authoritative; repo-local `.ai/agent/readiness-instructions.md` deferred (YAGNI). Supersedes the ticket's original "dedicated guide" recommendation. (Satisfies C-5.)
6. **DEC-6 — The deterministic mechanical pre-check `ados check-readiness` (issue #49) is out of scope.** A future complement to the adversarial semantic gate, not a dependency.
7. **DEC-8 — Insert `dor_check` as the new phase 5 and renumber existing 5–10 → 6–11** (rather than appending). Cleanest insertion preserves the artifact → implementation → verification → finalization grouping.

### Constraint Compliance Attestation

The chosen alternative satisfies **all** constraints C-1–C-5:

- **C-1 (pre-implementation gate):** `dor_check` runs between `delivery_planning` and `delivery`; `@readiness-reviewer` consumes artifacts + ticket, never code/diffs. ✅
- **C-2 (DoR/DoD separation):** `@reviewer` is unchanged in role; `@readiness-reviewer` is a distinct agent/invocation. ✅
- **C-3 (no silent skip):** Hard-gate-default; the only bypass is an explicit, recorded override (workItemRef + rationale + approver + date); no unconditional pass path. ✅
- **C-4 (`.opencode` single source of truth):** Agent/command definitions authored via `@toolsmith`; source + generated `.ados-claude/` committed together with CI freshness. ✅
- **C-5 (DoR as enforced behavior in the prompt):** DoR facets are authoritative in the `@readiness-reviewer` prompt; the guide mirror states the prompt is authoritative. ✅

No accepted-risk exceptions are required — the chosen alternative violates no constraint.

**Assumptions:** the gate reads only local change artifacts + the source ticket via existing tracker access (no new platform integration); a human is available to approve overrides and to resolve needs-human-input decisions; the same-model independence limitation applies (the adversarial stance is a structural counter to sycophancy, not a guarantee of omniscience).

**Revisit when:** a DoR facet proves to need deep specialization (split it out — reversible); adoption friction shows the gate over-blocks or the override slips toward de-facto silent skip; the deferred mechanical pre-check (#49) lands and shifts the DoR/guide split.

## Trade-offs & Consequences

### Positive Outcomes

- A checkpoint at the single highest-leverage point in delivery — flaws caught here save the entire downstream implementation cost.
- A **structural** anti-sycophancy mechanism (independent adversarial agent + hard gate) rather than a reliance on agent willpower.
- A formal decision-capture gate that routes change-scoped vs system-wide decisions to their correct homes.
- Clean DoR/DoD pairing on the paved road (`dor_check` ↔ `@readiness-reviewer` ↔ `/check-readiness` ↔ DoR guide, mirroring `dod_check` ↔ `@reviewer` ↔ `/review`).

### Negative Outcomes

- **Lifecycle renumbering blast radius:** inserting phase 5 and renumbering 5–10 → 6–11 touches many surfaces. Mitigated by the NFR-1 structural sweep (0 stale phase references).
- **One extra gate adds latency to delivery.** Accepted: a trivial cost vs the cost of implementing a flawed plan.
- **Prompt + mirror co-maintenance.** Mitigated by the mirror stating the prompt is authoritative and CI covering the redistributable guide.

> **Precedent-status note (RT1-NIT-01, accepted-risk):** ADR-0001 (the cited precedent for recording delivery-workflow structural changes as ADRs) is itself still `Proposed`; the structural-pattern precedent holds regardless of its acceptance status — the *practice* of recording delivery-workflow structural changes as ADRs is what is being followed, independent of ADR-0001's own acceptance.

### Unresolved Questions

- [ ] Will a DoR facet later prove to need a split-out specialized critic? (owner: revisit on evidence; reversible) — deferred by design.
- [ ] Will the override discipline hold up in practice, or drift toward de-facto silent skip? (owner: retrospective agent GH-43; review override records over time)

## Implementation Plan

High-level only — delivered through the standard ADOS delivery process (the GH-57 change is the implementation; this record is its design authority). Delivery order per the change spec §18:

1. This ADR (`@decision-advisor`) + `00-index.md` row.
2. `@toolsmith` authors `@readiness-reviewer` + `/check-readiness` and modifies `@pm` (add the `dor_check` step + DoR reopening logic that routes gaps to artifact phases, never `delivery`; decision-capture routing + human pause; `phases.dor_check` in the PM-notes map).
3. Regenerate `.ados-claude/` and commit source + generated together (NFR-5).
4. Author `doc/guides/definition-of-ready.md` (redistributable mirror; states prompt authoritative).
5. Update `doc/guides/change-lifecycle.md` (insert phase 5; renumber 5–10 → 6–11; mermaid + agent-responsibility + phase-reopening tables; reference the DoR guide).
6. Update `AGENTS.md` + `.opencode/README.md` (11-phase inventory); review `.ai/agent/pm-instructions.md`.
7. Renumbering sweep verifying 0 stale references (NFR-1).
8. `@doc-syncer` reconciles any system docs at phase 7.

**Rollout:** single PR; CI verifies plugin freshness + the doc-distribution guard; behavioral claims (adversarial stance, reopening routing, end-to-end pass) are covered by the manual verification matrix + PR review. **Acceptance signal:** this record's acceptance rides the GH-57 PR — flip `status` to `Accepted` and set `decision_date` at merge (human PR approval = the human decision).

## Verification Criteria

- **Metric:** Stale phase-number references across `change-lifecycle.md`, `AGENTS.md`, `.opencode/README.md`, `@pm` — Target: **0** — Window: post-merge (NFR-1)
- **Metric:** Total lifecycle phases — Target: **11** — Window: post-merge
- **Metric:** `@readiness-reviewer` encodes adversarial DoR + override-record fields — Target: **yes** (structural) — Window: post-merge
- **Metric:** `doc/guides/definition-of-ready.md` declares `ados_distribution: redistributable` and states the prompt is authoritative — Target: **yes** — Window: post-merge (CI doc-distribution guard)
- **Metric:** `@reviewer` role text changes — Target: **0** (DoD preserved) — Window: post-merge
- **Metric:** `.ados-claude/` byte-freshness — Target: **fresh** — Window: post-merge (CI)
- **Metric:** GH-57 dogfoods the gate end-to-end (`READY` or `NOT_READY` with correct gap routing) — Target: **yes** — Window: GH-57 delivery (manual; AC10)

## Confidence Rating

**High.** The decisions are owner-endorsed and individually reversible; the structural precedent (`@reviewer` / GH-36) is proven and being mirrored; the constraints are satisfiable by exactly the chosen alternative; and the cross-artifact-consistency driver — the whole point of the gate — is maximized by the single holistic reviewer. Main uncertainty is behavioral (does it catch gaps in practice?), which GH-57 dogfoods.

## Lessons Learned (Retrospective)

TODO: Populate after implementation and observation (post GH-57 merge + a few delivery cycles through the gate).

## Examples & Usage (Optional)

**DoR/DoD pairing (mirrors the change spec Appendix B):**

| Gate | Phase | Agent | Command | Guide | When |
|------|-------|-------|---------|-------|------|
| Definition of Ready | `dor_check` (5) | `@readiness-reviewer` | `/check-readiness` | `doc/guides/definition-of-ready.md` | before `delivery` (artifacts vs ticket) |
| Definition of Done | `review_fix` (8) | `@reviewer` | `/review` | inline in `change-lifecycle.md` | before PR (code vs spec/plan) |

The role name describes the lifecycle role; the adversarial "critic" behavior lives in the prompt.

## References

- **Change spec (design authority):** [doc/changes/2026-06/2026-06-27--GH-57--readiness-gate/chg-GH-57-spec.md](../changes/2026-06/2026-06-27--GH-57--readiness-gate/chg-GH-57-spec.md)
- **Precedent decision record:** [ADR-0001 — Decision-Making Framework Refactor](ADR-0001-decision-making-framework.md) (delivery-workflow structural changes are ADRs)
- **Record-artifact guide:** [doc/guides/decision-records-management.md](../guides/decision-records-management.md) (§6.1 constraints discipline; §8 change linkage)
- **Record template:** [doc/templates/decision-record-template.md](../templates/decision-record-template.md) (body structure — single source of truth)
- **Lifecycle guide (to be modified by GH-57):** [doc/guides/change-lifecycle.md](../guides/change-lifecycle.md)
- **Structural sibling (house style to mirror):** `.opencode/agent/reviewer.md` (`@reviewer`, GH-36)
- **Project-local decision conventions:** [.ai/agent/decision-instructions.md](../../.ai/agent/decision-instructions.md)
