---
id: SPEC-CHG-GH-108
change:
  ref: GH-108
  type: fix
  status: Proposed
  slug: doc-syncer-reliable-spec-coverage
  title: "doc-syncer reliability — specs/guides must actually fire post-merge (GH-108)"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["fix", "process", "doc-syncer", "spec-coverage", "autonomous-delivery", "epic-107"]
  version_impact: minor
  audience: mixed
  security_impact: none
  risk_level: medium
  dependencies:
    internal: ["doc-syncer agent", "pm agent", "change-lifecycle guide", "pm-instructions", "opencode-session.sh", "doc/spec/features/feature-delivery-lifecycle.md"]
    external: []
links:
  related_changes: ["GH-78", "GH-79"]
  decisions: ["PDR-0002"]
  epic: "GH-107"
  siblings: ["GH-111"]
  closes: ["GH-108"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Close a reliability defect in the phase-7 spec-coverage *resolution* path — across a sustained autonomous delivery run, detected `spec_coverage_gaps` are reported but never resolved (no human is reachable mid-flight to approve a follow-up), so modified feature areas silently acquire no spec and the system spec rots — by making the resolution path **mode-aware** (`delivery_mode`) so a gap is resolved in-change in autonomous mode while the interactive de-noise behavior is preserved unchanged and the "PM never creates tickets autonomously" governance rule stays intact.

## 1. SUMMARY

This change fixes the doc-syncer spec-coverage resolution path so it stops silently dropping in autonomous delivery. It introduces a per-change `delivery_mode: interactive | autonomous` signal (in `chg-<workItemRef>-pm-notes.yaml`), and a **mode-aware resolution rule**: in `autonomous` mode, a detected `spec_coverage_gap` for a modified feature area that has no spec is **resolved within the change** (the missing `doc/spec/features/feature-<slug>.md` is authored), while `interactive` mode is byte-for-byte unchanged (advisory + human-gated follow-up). No agent creates a tracker ticket in any mode; the "PM must NEVER create new tickets autonomously" rule is preserved verbatim. A small visibility aid makes the coverage gap observable.

This is a process/framework `fix` (P1 bug, epic #107). The design is settled by **PDR-0002** (Alternative 1) and is incorporated here as the chosen design — it is not re-opened.

## 2. CONTEXT

### 2.1 Current State Snapshot

All claims verified against shipped sources:

- **Phase 7 (`system_spec_update`) is owned by `@doc-syncer`.** It reconciles `doc/spec/**` and runs a *positive* coverage check: for each **feature area** a change modifies, it looks for a corresponding `doc/spec/features/feature-<slug>.md` and collects any missing area into `spec_coverage_gaps` (`.opencode/agent/doc-syncer.md`, step 2 "Feature spec coverage (positive coverage check)").
- **Detection works; resolution does not.** `@doc-syncer` **only REPORTS** `spec_coverage_gaps`. The handoff rule (`.opencode/agent/doc-syncer.md` `<rules>` — "Spec-coverage handoff (report, never ticket)") is: doc-syncer reports → `@pm` checks open issues and **references** an existing tracker (de-noising) → `@pm` **proposes** a follow-up → **only the human** approves ticket creation. The `<reporting>` field states it is "Report-only — this field carries no automated side effect; it never creates a spec or a ticket."
- **Coverage is explicitly advisory at phase 7.** `doc/guides/change-lifecycle.md` (Phase 7): "Coverage is advisory at this phase; it does not block the change from proceeding to `review_fix`." The outcome is stated as "reported (not silently dropped)" — but that is only true *when a human reads the report*.
- **Intake coverage awareness is also advisory.** `.opencode/agent/pm.md` step 3 (clarify_scope): feature spec coverage awareness is "**advisory only — not a delivery blocker** … the human alone decides whether a follow-up ticket is created." `doc/guides/definition-of-ready.md` likewise records "Feature spec coverage is advisory, not a DoR facet."
- **A hard governance rule gates ticket creation.** `.ai/agent/pm-instructions.md`: "**PM must NEVER create new tickets autonomously** … The PM proposes; the human decides."
- **Autonomous delivery runs `@pm` end-to-end and stops at an open PR.** `scripts/opencode-session.sh` `default_prompt_for()` instructs `@pm` to run the full 11-phase lifecycle and "CREATE THE PR AND LEAVE IT OPEN … The human performs the final review and squash-merge as a separate gate." It sets **no mode signal** any agent can read today.
- **"Autonomous mode" is referenced by the ticket but is NOT a formal, detectable concept today** — no mode flag exists; the session script writes mappings to `.ai/local/` and passes a prompt, but exposes nothing structured agents can branch on.
- **`doc/spec/**` is already inside `@doc-syncer`'s write-allowlist.** It already creates and reconciles feature specs (`doc/spec/features/feature-<slug>.md`, front matter `status: Current`). Authoring a missing feature spec is an *extension of an existing capability*, not a new write surface.
- **The de-noise design is correct for human-in-loop** (origin: GH-78/GH-79). It deliberately stops every change from noisily forcing a follow-up ticket on a human who is present to decide. The defect is the **absence of mode-awareness** in the resolution path, not the de-noise principle.

### 2.2 Pain Points / Gaps

- **The resolution path assumes a human is reachable mid-flight.** In autonomous delivery there is no human mid-flight to read the advisory report or approve a follow-up. "Advisory + human-gated" therefore silently reduces to **"never happens."**
- **Observed effect:** zero feature specs produced across many merged changes during a sustained autonomous run; modified feature areas acquire no spec; the system spec (the knowledge base agents deliver against) silently rots.
- **"Advisory" is overloaded.** The same word legitimately means "non-blocking at phase 7" (correct) and "can be silently skipped" (the bug). The lifecycle/doc-syncer wording lets the second reading hold in autonomous mode.
- **No observability for the drop.** Nothing makes a silent spec-coverage drop visible, so the rot is invisible until a manual audit.

## 3. PROBLEM STATEMENT

Because the spec-coverage *resolution* path assumes a human is reachable mid-flight to read an advisory report and approve a follow-up ticket, ADOS in autonomous delivery — where `@pm` runs end-to-end and stops only at an open PR — cannot close a detected `spec_coverage_gap`, with the result that modified feature areas never acquire a feature spec, zero specs are produced across many merged changes, and the system spec silently rots even though the gap was correctly detected and reported.

## 4. GOALS

- **G-1**: Make the spec-coverage resolution path **mode-aware** so that, in autonomous delivery, a detected gap for a modified feature area is **resolved within the change** (no silent drop), while interactive/human-in-loop mode retains the current advisory + human-gated de-noise behavior unchanged.
- **G-2**: Introduce a durable, auditable, entry-point-portable **mode signal** (`delivery_mode`) so a mode-aware rule can apply and is reusable by sibling work (GH-111).
- **G-3**: **Preserve the governance rule** "PM must NEVER create new tickets autonomously" — the resolution path produces a doc artifact scoped to the change and reviewed at the open-PR gate, never a tracker ticket.
- **G-4**: Make the spec-coverage gap **observable** so a silent drop cannot recur undetected.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Autonomous run over an unspecced modified feature area → feature spec produced | 1 / 1 (demonstration) |
| Interactive (or absent `delivery_mode`) runs — behavior change vs pre-change | 0 (byte-for-byte unchanged) |
| Tracker tickets auto-created by any agent in any mode | 0 |
| "PM must NEVER create new tickets autonomously" — autonomous-mode exceptions carved into the rule | 0 |
| Entry points reading the same `delivery_mode` signal | 100% (session + manual `@pm`) |
| Feature-specs-present / changes-touching-feature-areas signal computable for autonomous runs | non-zero & computable |
| `.ados-claude/` regenerated iff `.opencode/` edited | 1:1 invariant |

### 4.2 Non-Goals

- **NG-1**: No change to the **de-noise design for interactive mode** — advisory + human-gated follow-up is preserved; mode-awareness is additive, not a revert.
- **NG-2**: No auto-creation of **tracker tickets** in any mode (governance preserved; explicitly out).
- **NG-3**: No formal **"delivery mode" feature** beyond the pm-notes field and the one-line session prompt instruction — no new opcodes, config surfaces, or env-var-based detection.
- **NG-4**: No authoring of the **missing specs for a specific project** (that is project cleanup, not a framework fix).
- **NG-5**: No implementation of sibling **GH-111** (operational guides trigger) — it mirrors this pattern later; only the `delivery_mode` concept is designed to be reusable by it.
- **NG-6**: No change to spec-coverage **detection** — the positive coverage check already works; this change fixes *resolution*, not detection.
- **NG-7**: No promotion of `spec_coverage` to a **hard DoR facet** (that remains a deferred option from GH-78 §7.3).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | **Per-change delivery-mode signal** — a `delivery_mode: interactive \| autonomous` field in `chg-<workItemRef>-pm-notes.yaml`, set by `@pm` at intake; default/absent ⇒ `interactive`. | The mode is not detectable today; a durable, auditable, backward-compatible signal is the prerequisite for any mode-aware rule (PDR-0002 D1). |
| F-2 | **Mode-aware spec-coverage resolution** — in `autonomous` mode, a detected `spec_coverage_gap` for a modified feature area with no spec is resolved in-change (missing feature spec authored); an existing spec is merely reconciled; `interactive` mode is byte-for-byte unchanged; no tracker ticket in any mode. | Closes the root-cause defect (resolution-path mode blindness) without reverting de-noise or weakening governance (PDR-0002 D2). |
| F-3 | **Autonomous entry-point mode wiring** — the autonomous session prompt instructs `@pm` to set `delivery_mode: autonomous`; the signal is readable from all entry points (session + manual `@pm`). | Makes the signal correct and portable; avoids env-var-only detection that manual invocations cannot reproduce (PDR-0002 C-4). |
| F-4 | **"Advisory ≠ silently skipped" wording normalization** — phase-7 / doc-syncer wording so "advisory" no longer reads as "silently skipped" in autonomous mode. | Removes the overloaded-wording defect that lets the resolution no-op in autonomous delivery. |
| F-5 | **Spec-coverage observability** — a visibility aid that produces a count of feature specs present vs changes touching feature areas. | Makes a silent drop detectable (AC-4); enables the rollout guardrail (inspect the first autonomous run). |

### 5.1 Capability Details

**F-1 — Delivery-mode signal.** A per-change field `delivery_mode: interactive | autonomous` added to the `chg-<workItemRef>-pm-notes.yaml` structure, set by `@pm` at intake (clarify_scope, step 3). Semantics: `interactive` is the **default**; an **absent** field is treated as `interactive` (identical to today), so existing change folders and manual runs need no migration. The signal is durable (a committed artifact), auditable (inspectable post-hoc per change), and general enough for sibling GH-111 to mirror.

**F-2 — Mode-aware resolution rule.** The spec-coverage handoff becomes conditional on `delivery_mode`:

- **`autonomous` mode:** a detected `spec_coverage_gap` for a modified **feature area** is **resolved within the change** — the missing `doc/spec/features/feature-<slug>.md` is **authored**. This promotes advisory → **required**, but **only for the FIRST spec of a feature area that has none**; an **existing** spec continues to be merely **reconciled** (it is not re-authored).
- **`interactive` mode (or absent):** byte-for-byte unchanged — report → `@pm` proposes a follow-up → **only the human** approves ticket creation.
- **No tracker ticket in any mode.** Authoring a feature spec is a natural promotion of an existing `@doc-syncer` capability over a write surface (`doc/spec/**`) it already owns — it is a doc artifact scoped to the change and reviewed at the **open-PR human gate** that autonomous delivery already mandates. The human gate is **relocated** to PR review, not removed.

**Ownership of authoring (rule vs implementation).** The *rule* is that the gap is closed in-change in autonomous mode. **Whether the resolving agent authors the spec directly or delegates authoring to a stronger model / `@coder` while retaining gap-detection and the resolution requirement is an implementation decision for the plan** — it is captured as OQ-1 and is **not** hard-coded into any acceptance criterion.

**"Feature area" (operational definition — restated for the over-fire guard).** A capability is a *feature area* iff it warrants a `doc/spec/features/feature-<slug>.md` — a coherent, nameable capability a contributor or reviewer would expect to find a spec for (e.g., "the delivery lifecycle", "the agents & commands system", "code review", "decision-making"). Routine edits, one-off scripts, and bug fixes to already-specced areas are **not** new feature areas and do **not** trigger authoring. This definition lives authoritatively in `.opencode/agent/doc-syncer.md`; it is restated here so autonomous authoring does not over-fire. (See NFR-4.)

**F-3 — Autonomous entry-point wiring.** The autonomous session entry point (`scripts/opencode-session.sh` `default_prompt_for()`) gains a one-line instruction directing `@pm` to set `delivery_mode: autonomous` in pm-notes. `@pm` owns the write (it already creates the file). **No new tooling surface, flags, or env vars are added** — the signal is the committed pm-notes field, which a manual `@pm` invocation reads identically. This satisfies portability across entry points (PDR-0002 C-4).

**F-4 — Wording normalization.** In `doc/guides/change-lifecycle.md` (Phase 7) and `.opencode/agent/doc-syncer.md` (`<rules>` / `<reporting>`), the term "advisory" is disambiguated: it continues to mean "non-blocking at phase 7 / human decides ticket creation" in interactive mode, but it must **not** mean "can be silently skipped" in autonomous mode. The mode-aware resolution is described where the coverage check is documented.

**F-5 — Observability.** A visibility aid produces a durable, computable signal: a count of feature specs present in `doc/spec/features/` vs changes touching feature areas (derived from `doc/changes/**`). The **recommended form** is a repo-internal `scripts/` tool (per the `scripts/` convention: `.sh` extension, with a `scripts/.tests/test-*.sh`), but the exact surface is a plan decision (OQ-2); the acceptance criterion is the **outcome** — the gap is observable and the count is computable and non-zero for autonomous runs.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Interactive (delivery_mode: interactive OR absent): UNCHANGED
  Change ships → system_spec_update → @doc-syncer detects gap (or none)
  → reports spec_coverage_gaps → @pm checks open issues (de-noise), proposes follow-up
  → ONLY the human approves ticket creation → no spec authored by the rule, no auto-ticket.

Flow 2 — Autonomous, modified feature area WITH a spec: reconciled (existing behavior)
  Change ships → system_spec_update → @doc-syncer finds feature-<slug>.md → reconciles it
  → no coverage gap → done.

Flow 3 — Autonomous, modified feature area WITHOUT a spec: THE FIX
  Change ships → system_spec_update → @doc-syncer reads delivery_mode: autonomous
  → detects spec_coverage_gap for a feature area with no spec
  → RESOLVES in-change: missing feature-<slug>.md is authored (advisory → required, first-spec-only)
  → authored spec is part of the change, reviewed at the open-PR human gate
  → NO tracker ticket created by any agent.

Flow 4 — Mode signal at intake
  @pm intake (clarify_scope) → sets delivery_mode in pm-notes
    - autonomous session prompt instructs @pm to set `autonomous`
    - manual @pm sets it explicitly (or leaves absent ⇒ interactive)
  → signal is durable/auditable; read identically by all entry points.
```

## 7. SCOPE & BOUNDARIES

> Scope touchpoints are cited for **traceability and scope definition** (matching repo convention), not as step-by-step implementation instructions. Shared files (`pm-instructions.md`, `change-lifecycle.md`) are edited **surgically** — only the Phase-7 / coverage / mode sections — to minimize rebase collisions with parallel sibling sessions.

### 7.1 In Scope

1. `.opencode/agent/doc-syncer.md` — make the spec-coverage handoff **mode-aware**: read `delivery_mode` from pm-notes; in `autonomous` mode resolve the gap in-change (author the missing feature spec, or own delegating that authoring); `interactive` behavior unchanged. Update `<rules>` and `<reporting>` so "advisory" does not mean "silently skipped" in autonomous mode.
2. `.opencode/agent/pm.md` step 3 (clarify_scope) — add the `delivery_mode` declaration to the pm-notes structure / intake actions; keep coverage awareness advisory in interactive mode.
3. `.ai/agent/pm-instructions.md` — note the `delivery_mode` field + the mode-aware coverage rule in the relevant section; **PRESERVE** the "PM must NEVER create new tickets autonomously" rule (surgical edit to the coverage/mode area only).
4. `doc/guides/change-lifecycle.md` Phase 7 — reword so "advisory" no longer means "silently skipped" in autonomous mode; describe the mode-aware resolution (surgical edit to the coverage/Phase-7 area only).
5. `scripts/opencode-session.sh` `default_prompt_for()` — one-line instruction directing `@pm` to set `delivery_mode: autonomous` (no new tooling surface/flags).
6. Visibility aid (F-5 / AC-4) — a `scripts/` tool producing the feature-specs-present vs changes-touching-feature-areas count, with a `scripts/.tests/test-*.sh` (tests required for `scripts/` per repo convention); or an equivalent durable signal — exact form is a plan decision (OQ-2).
7. Regenerate `.ados-claude/` for any `.opencode/` change (run `scripts/build-claude-plugin.sh`).
8. Reconcile `doc/spec/features/feature-delivery-lifecycle.md` at phase 7 by `@doc-syncer` (this change's own feature area — the delivery lifecycle / phase-7 spec-coverage capability — already has a spec, so it is **reconciled**, not authored from scratch). Captured in the Definition of Done (§17.1), not implemented by this spec.

### 7.2 Out of Scope

- [OUT] Authoring the missing specs for a specific project (project cleanup, not framework).
- [OUT] Changing the de-noise principle for interactive mode.
- [OUT] Implementing sibling GH-111 (operational guides trigger) — it mirrors this pattern later (the `delivery_mode` concept is designed to be reusable by it).
- [OUT] A formal "delivery mode" feature beyond the pm-notes field + the one-line session prompt instruction (no opcodes/config/env vars).
- [OUT] Auto-creating tracker tickets (explicitly out — governance preserved).
- [OUT] Changes to spec-coverage **detection** (the positive coverage check already works).
- [OUT] Promoting `spec_coverage` to a hard DoR facet (deferred — GH-78 §7.3).

### 7.3 Deferred / Maybe-Later

- **Shared-rule extraction with GH-111** — when GH-111 runs, extract a shared mode-aware-resolution rule and reconcile `delivery_mode`'s canonical location (PDR-0002 revisit trigger).
- **Quality spot-check for autonomous-authored specs** beyond the open-PR review (revisit if autonomous specs repeatedly arrive low-quality at PR — PDR-0002 revisit trigger).
- **`spec_coverage` as a hard DoR facet** (carried forward from GH-78 §7.3).
- **A dedicated `feature-doc-syncer.md`** — whether the phase-7 / spec-coverage sub-capability warrants its own spec (advisory; currently folded into `feature-delivery-lifecycle.md`).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface.

### 8.2 Events / Messages

N/A — no event/message surface.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `delivery_mode` (new pm-notes field) | Per-change field `delivery_mode: interactive \| autonomous` in `chg-<workItemRef>-pm-notes.yaml`; type enum; default/absent ⇒ `interactive`; set by `@pm` at intake; durable committed artifact. |
| DM-2 | Mode-aware resolution contract | The behavioral matrix over (`delivery_mode`) × (spec exists for modified feature area?): `autonomous` × (no spec) ⇒ **author in-change**; otherwise ⇒ **reconcile / report-only**; no tracker ticket in any cell. Encodes the root-cause fix (the prior contract had no `delivery_mode` dimension — resolution assumed a reachable human). |

### 8.4 External Integrations

N/A — the change is internal to the ADOS repo (agent prompts, guides, the session script, a repo-internal visibility tool).

### 8.5 Backward Compatibility

- **Additive & default-safe.** An absent `delivery_mode` ⇒ `interactive` ⇒ today's behavior. Existing change folders and manual runs need no migration; no new blocking prompt is introduced for interactive runs.
- **Interactive path is byte-for-byte unchanged** in effect (PDR-0002 C-3): report → PM proposes → human approves ticket creation only.
- **Detection unchanged.** The positive coverage check is untouched; only the resolution branch is added.
- **`.ados-claude/`** is regenerated **iff** a `.opencode/` file is edited (the 1:1 invariant is preserved).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Backward compatibility — interactive / absent `delivery_mode` behaves identically to pre-change | 0 new blocking prompts in interactive mode |
| NFR-2 | Entry-point portability — `delivery_mode` readable from every supported entry point | 100% (session-driven + manual `@pm`); no env-var-only signal |
| NFR-3 | Governance invariance — "PM must NEVER create new tickets autonomously" retained verbatim; no agent creates a tracker ticket in any mode | 0 auto-tickets; 0 autonomous-mode exceptions carved into the rule |
| NFR-4 | Over-fire guard — authoring fires only for the FIRST spec of an unspecced modified feature area; existing specs reconciled; routine edits excluded | A reviewer can name the feature area and confirm spec (non-)existence for any authoring invocation |
| NFR-5 | Observability — the visibility aid yields a computable, non-zero coverage signal for autonomous runs | feature-specs-present / changes-touching-feature-areas is computable & non-zero for autonomous runs |
| NFR-6 | Root-cause accuracy — the spec names the actual root cause (resolution-path mode blindness) and distinguishes it from "missing check" and from "de-noise design flaw" | 0 mischaracterizations |
| NFR-7 | Plugin freshness — `.ados-claude/` regenerated iff `.opencode/` edited | Regeneration matches the set of `.opencode/` edits exactly |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The `spec_coverage_gaps` report field is retained; in autonomous mode a resolved gap is reflected in the report (authored spec listed among updates; residual gaps still listed).
- A durable visibility signal (F-5) makes the feature-specs-present vs changes-touching-feature-areas ratio computable from committed artifacts (`doc/spec/features/**`, `doc/changes/**`) — the silent-drop failure mode becomes detectable without a manual audit.
- No runtime metrics/logs/alerts beyond existing agent report output (these are prompt-described behaviors, not instrumented services).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Model capacity for spec authoring — authoring a full feature spec from scratch may exceed the resolving agent's capacity | M | M | Authoring ownership/model-tier is a **plan decision** (OQ-1), not a rule; the open-PR human review gate catches low quality; the resolution *requirement* is rule-level and agent-agnostic | M |
| RSK-2 | Over-firing — authoring specs for routine edits / already-specced areas | M | M | Crisp "feature area" definition + **first-spec-only** rule (existing specs reconciled, not re-authored); routine edits excluded (NFR-4) | L |
| RSK-3 | Shared-file rebase collisions in the parallel batch (`pm-instructions.md`, `change-lifecycle.md`) | M | H | Surgical edits confined to the Phase-7 / coverage / mode sections only | L |
| RSK-4 | Mode mis-set — an autonomous run left `interactive` ⇒ the silent drop persists undetected | H | L | Session prompt instructs `@pm` to set `autonomous`; the visibility aid (F-5) makes a silent drop observable; `interactive` default is the safe backward-compatible default | M |
| RSK-5 | Spec rot-in-reverse — autonomous-authored specs are low quality and pollute `doc/spec/**` | M | M | Open-PR human review; ability to refine later; PDR-0002 revisit trigger | M |
| RSK-6 | Governance drift — autonomous authoring is later misread as license to auto-create tickets | H | L | NFR-3 + AC assert the rule is verbatim with no exception; PDR-0002 reaffirms it; resolution produces a **doc artifact**, not a tracker ticket | L |
| RSK-7 | `delivery_mode` concept proliferates before GH-111 extracts a shared rule | L | M | PDR-0002 records the concept as reusable; GH-111 revisit trigger reconciles to a shared form | L |

## 12. ASSUMPTIONS

- The agent prompts and `AGENTS.md` describe actual behavior; guides are human-readable mirrors; where a guide and a prompt differ, the prompt wins (`doc/guides/definition-of-ready.md`).
- `@pm` already creates and owns `chg-<workItemRef>-pm-notes.yaml` at intake (step 3), so adding a `delivery_mode` field reuses an existing owned artifact (no new machinery).
- `doc/spec/**` is already inside `@doc-syncer`'s write-allowlist and it already creates/reconciles feature specs — authoring a missing feature spec is an extension of an existing capability, not a new write surface or new power.
- Autonomous delivery already terminates at a human gate — the open PR — so autonomously-authored content is human-reviewed (relocated, not removed).
- The de-noise design (GH-78/GH-79) is correct for human-in-loop; this change adds mode-awareness rather than reverting it.
- This change's own feature area (the delivery lifecycle / phase-7 spec-coverage capability) already has a spec (`feature-delivery-lifecycle.md`, `status: Current`); per the mode-aware rule it is **reconciled**, not authored from scratch.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | PDR-0002 (Proposed) | Settles the mode representation (D1) and the governance-tension resolution (D2). Human confirms at the GH-108 PR; **non-blocking for delivery** (decision is `Proposed`, rule is adopted as the chosen design). |
| Depends on | GH-78 / GH-79 spec-coverage design (delivered) | Provides the detection/reporting (`spec_coverage_gaps`) and the "feature area" definition this change *promotes* to a resolution requirement. |
| Related (reuses, out of scope) | GH-111 (operational guides trigger) | Sibling ticket that mirrors this mode-aware pattern; will reuse `delivery_mode` and later extract a shared rule. |
| Closes | GH-108 | Closed by this change. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Does the resolving agent author a full feature spec adequately, or should authoring be delegated to a stronger model / `@coder` while gap-detection + the resolution requirement stay with doc-syncer? | Model-capacity is an *implementation* concern; the *rule* (gap closed in-change in autonomous mode) is settled (PDR-0002). | Plan decision — consult `@plan-writer` / `@decision-advisor`; **must not** be hard-coded into an AC. |
| OQ-2 | Exact form of the visibility aid — a `scripts/` tool (recommended, with `scripts/.tests/test-*.sh`) vs an equivalent durable signal? | The ticket says "cheap and conservative"; the `scripts/` convention requires tests. | Plan decision — outcome is fixed (observable count), form is open. |
| OQ-3 | Do autonomous-authored specs need a quality spot-check / human gate beyond the open-PR review? | PDR-0002 flags this as a revisit trigger. | Deferred (7.3); revisit after the first autonomous runs. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Adopt **PDR-0002 Alternative 1**: explicit `delivery_mode` signal + author-the-spec-in-change (autonomous). | The only position that passes all constraints C-1…C-4 cleanly while honoring the ticket's "mode-aware" framing and setting up a reusable precedent for GH-111. | 2026-07-02 |
| DEC-2 | **Preserve "PM must NEVER create new tickets autonomously" verbatim** (C-1). The resolution produces a **doc artifact** scoped to the change, reviewed at the open-PR gate — not a tracker ticket. | Resolves the AC-2 governance tension in favor of governance; authoring is a natural promotion of an existing doc-syncer write capability, not a new ticket-creation power. | 2026-07-02 |
| DEC-3 | **Interactive mode is byte-for-byte unchanged** (C-3); mode-awareness is additive, not a de-noise revert. | The de-noise design is correct for human-in-loop; the defect is the absence of mode-awareness. | 2026-07-02 |
| DEC-4 | **First-spec-only authoring.** An existing feature spec is merely reconciled; only a missing spec for a modified feature area is authored in autonomous mode. | Over-fire guard (NFR-4); prevents re-authoring stable specs on routine edits. | 2026-07-02 |
| DEC-5 | `delivery_mode` representation = **pm-notes field** (default/absent ⇒ `interactive`). | Backward-compatible (no migration), auditable (committed artifact), entry-point-portable (C-4), and reusable by GH-111. | 2026-07-02 |
| DEC-6 | Autonomous-authored content is reviewed at the **open-PR human gate** that autonomous delivery already mandates. | The human gate is relocated to PR review, not removed — preserving human oversight of autonomously-produced specs. | 2026-07-02 |
| DEC-7 | **Authoring ownership/model-tier is a plan decision (OQ-1), not a spec rule.** The spec states the rule (gap resolved in-change in autonomous mode) and does not hard-code which agent writes the spec. | Keeps the spec at the rule level; avoids over-constraining delivery on an unsettled implementation concern. | 2026-07-02 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.opencode/agent/doc-syncer.md` | Updated — mode-aware spec-coverage resolution (author in-change in autonomous mode); wording normalization |
| `.opencode/agent/pm.md` | Updated — `delivery_mode` declaration at intake; coverage stays advisory in interactive mode |
| `.ai/agent/pm-instructions.md` | Updated — note `delivery_mode` + mode-aware coverage rule (surgical); "PM never creates tickets autonomously" preserved |
| `doc/guides/change-lifecycle.md` | Updated — Phase 7 wording: "advisory" no longer ⇒ "silently skipped" in autonomous mode (surgical) |
| `scripts/opencode-session.sh` | Updated — `default_prompt_for()` one-line instruction to set `delivery_mode: autonomous` |
| `scripts/` visibility aid (+ `scripts/.tests/test-*.sh`) | New — spec-coverage observability (form per OQ-2; recommended = `scripts/` tool) |
| `.ados-claude/` | Regenerated — `.opencode/` files edited |
| `doc/spec/features/feature-delivery-lifecycle.md` | Reconciled at phase 7 by `@doc-syncer` (existing spec ⇒ reconciled, not authored) |

## 17. ACCEPTANCE CRITERIA

> Grouped by ticket AC. Given/When/Then; each links to ≥1 F-/NFR-/DM- ID.

### A. AC-1 — Root cause documented (NFR-6, DM-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR6-1 | **Given** this specification, **when** its Problem/Context is read, **then** it documents **why** no feature specs were produced across many merged changes — i.e., the resolution path is **mode-blind**: `@doc-syncer` only *reports* `spec_coverage_gaps` and the follow-up is human-gated, so in autonomous delivery (no human mid-flight) "advisory + human-gated" reduces to "never" — explicitly distinguishing this from a *missing check* and from a *de-noise design flaw*. | NFR-6, DM-2 |

### B. AC-2 — Mode-aware rule lands (F-1, F-2, F-3, NFR-1, NFR-2, NFR-3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** `.opencode/agent/pm.md` step 3 (clarify_scope) and the pm-notes structure, **when** read, **then** intake declares/sets a `delivery_mode: interactive \| autonomous` field in `chg-<workItemRef>-pm-notes.yaml`. | F-1 |
| AC-F1-2 | **Given** a manual `@pm` invocation and a session-driven run, **when** both run, **then** both read the same `delivery_mode` signal (no env-var-only or session-only mechanism). | F-1, NFR-2 |
| AC-F2-1 | **Given** `.opencode/agent/doc-syncer.md`, **when** read, **then** its spec-coverage handoff is **mode-aware**: it reads `delivery_mode` from pm-notes; in `autonomous` mode a detected gap for a modified feature area lacking a spec is **resolved in-change** (missing feature spec authored, or authoring owned/delegated); an **existing** spec is reconciled, not re-authored. | F-2, F-1, DM-2 |
| AC-F2-2 | **Given** the resolution path, **when** exercised in any mode, **then** **no agent creates a tracker ticket**; and `.ai/agent/pm-instructions.md` / `.opencode/agent/pm.md` retain "PM must NEVER create new tickets autonomously" **verbatim** with no autonomous-mode exception. | F-2, NFR-3 |
| AC-F2-3 | **Given** `delivery_mode` is absent or `interactive`, **when** the lifecycle runs, **then** behavior is identical to pre-change (advisory + human-gated follow-up; report → PM proposes → human approves ticket creation only; no new blocking prompt). | F-2, NFR-1 |
| AC-F3-1 | **Given** `scripts/opencode-session.sh` `default_prompt_for()`, **when** read, **then** it instructs `@pm` to set `delivery_mode: autonomous` (one-line addition; no new tooling surface/flags). | F-3 |
| AC-NFR4-1 | **Given** the mode-aware rule, **when** a modified feature area already has a spec, **then** it is **reconciled** (not re-authored); and **when** an edit is routine / not a feature area, **then** no spec is authored (over-fire guard). | F-2, NFR-4 |

### C. AC-3 — "Advisory" no longer means "silently skipped" (F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** `doc/guides/change-lifecycle.md` Phase 7, **when** read, **then** "advisory" is disambiguated so it cannot read as "silently skipped" in autonomous mode — the mode-aware resolution (author in-change in autonomous mode) is described. | F-4 |
| AC-F4-2 | **Given** `.opencode/agent/doc-syncer.md` (`<rules>` / `<reporting>`), **when** read, **then** the wording no longer implies advisory ⇒ silently-skipped in autonomous mode. | F-4 |

### D. AC-4 — Coverage gap is observable (F-5, NFR-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** the visibility aid, **when** run, **then** it produces a count of feature specs present vs changes touching feature areas (a computable, non-zero signal for autonomous runs), making a silent spec-coverage drop detectable. | F-5, NFR-5 |

### E. Cross-cutting — plugin freshness & system-spec reconciliation (NFR-7, DM-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR7-1 | **Given** this change edits `.opencode/` files, **when** delivery completes, **then** `.ados-claude/` has been regenerated via `scripts/build-claude-plugin.sh` and is current. | NFR-7 |
| AC-DM2-1 | **Given** `doc/spec/features/feature-delivery-lifecycle.md` (the spec for this change's feature area, `status: Current`), **when** phase 7 (`system_spec_update`) runs, **then** it is **reconciled** to describe the mode-aware resolution (existing spec ⇒ reconciled, not authored from scratch — demonstrating the DM-2 contract). | DM-2, F-2 |

### 17.1 Definition of Done

The change is Done when **all** acceptance criteria above pass **and**:

- The mode-aware resolution rule is encoded in `.opencode/agent/doc-syncer.md`, mirrored in `doc/guides/change-lifecycle.md` Phase 7, `.opencode/agent/pm.md` step 3, and `.ai/agent/pm-instructions.md` (with the governance rule preserved verbatim).
- `delivery_mode` is declared at intake and the autonomous session prompt instructs `@pm` to set `autonomous`.
- The visibility aid exists and produces the observable count (with its `scripts/.tests/test-*.sh` if implemented as a `scripts/` tool).
- `.ados-claude/` is regenerated for the `.opencode/` edits.
- `@doc-syncer` reconciles `doc/spec/features/feature-delivery-lifecycle.md` at phase 7 (this change's own feature area).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

1. Deliver as a single PR on `fix/GH-108/doc-syncer-reliable-spec-coverage`; regenerate `.ados-claude/` because `.opencode/` files are edited.
2. Review the shared-file edits (`pm-instructions.md`, `change-lifecycle.md`) as surgical, Phase-7/coverage/mode-scoped changes to ease rebase against parallel sibling sessions.
3. **Rollout guardrail:** the first autonomous run after landing should be inspected to confirm a modified feature area with no prior spec now yields an authored spec (PDR-0002 step 6); the visibility aid (F-5) makes this check cheap.
4. Communicate internally: maintainers should expect autonomous deliveries to start authoring feature specs in-change; interactive users see no behavioral change.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data migration. `delivery_mode` is backward-compatible (absent ⇒ `interactive`); existing change folders and manual runs need no migration. The visibility aid derives its counts from already-committed artifacts.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no personal data is processed. The change references only public repo artifacts (agent prompts, guides, the session script, decision records, committed change artifacts).

## 21. SECURITY REVIEW HIGHLIGHTS

- No code execution, secrets, or credentials involved (process/prompt/documentation only).
- The resolution path is a read + write over `doc/spec/**` (already in `@doc-syncer`'s allowlist); it creates no side effects beyond an authored/reconciled spec.
- Governance preserved: no agent gains ticket-creation authority in any mode (NFR-3).

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Ongoing:** autonomous deliveries will author feature specs in-change for unspecced modified feature areas; interactive deliveries keep the advisory + human-gated flow. Over time this keeps `doc/spec/` coverage from regressing in autonomous runs.
- **New maintenance surface:** autonomous-authored feature specs add docs to keep current; this is the intended outcome and is exactly what `system_spec_update` reconciles. The open-PR review gate is the quality backstop.
- **No new CI step is mandated** by this spec; if the visibility aid is a `scripts/` tool it ships with its own `scripts/.tests/test-*.sh` per convention (wiring it into CI is a separate decision).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| `delivery_mode` | New per-change field (`interactive \| autonomous`) in `chg-<ref>-pm-notes.yaml`; default/absent ⇒ `interactive` (DM-1). |
| Mode-aware spec-coverage resolution | In `autonomous` mode, a detected gap for a modified feature area with no spec is resolved in-change (spec authored); interactive mode unchanged (F-2, DM-2). |
| Feature area | A coherent, nameable capability warranting a `doc/spec/features/feature-<slug>.md`; routine edits are excluded (over-fire guard, NFR-4). |
| Mode blindness (root cause) | The resolution path assumed a reachable human; in autonomous delivery "advisory + human-gated" reduces to "never" (NFR-6). |
| First-spec-only authoring | Only a *missing* spec for a modified feature area is authored; an existing spec is merely reconciled (DEC-4). |
| `spec_coverage_gaps` | `@doc-syncer` report field listing modified feature areas lacking a spec (detection; unchanged by this change). |

## 24. APPENDICES

- **Appendix A — Root-cause chain (AC-1).** (a) `@doc-syncer` only *reports* `spec_coverage_gaps` (report-only, never ticket) per `.opencode/agent/doc-syncer.md` `<rules>`; (b) the PM handoff is human-gated (propose → human approves ticket creation) per the same rule + `.ai/agent/pm-instructions.md`; (c) in autonomous delivery there is no human mid-flight to read the advisory report or approve the follow-up, so "advisory + human-gated" reduces to "never"; (d) `@pm` step-3 coverage awareness is explicitly "advisory only — not a delivery blocker" and `change-lifecycle.md` Phase 7 says coverage "does not block the change." Net effect: zero feature specs produced across many merged changes; the system spec silently rots. The de-noise design is correct for human-in-loop; the bug is the absence of mode-awareness.
- **Appendix B — PDR-0002 constraint mapping.** C-1 (no auto-ticket) ⇒ DEC-2/NFR-3; C-2 (resolves without human mid-flight) ⇒ F-2/AC-F2-1; C-3 (interactive de-noise preserved) ⇒ DEC-3/NFR-1/AC-F2-3; C-4 (all entry points) ⇒ F-1/F-3/NFR-2/AC-F1-2. No accepted-risk exceptions; no negotiable constraint violated.
- **Appendix C — Reusability for GH-111.** GH-111 ("operational guides trigger") faces the structurally identical defect (a doc-handoff rule that assumes a reachable human, silently no-opping in autonomous delivery). This change's pattern is intended to be reused verbatim: (1) read `delivery_mode` from pm-notes; (2) in `autonomous` mode resolve the gap in-change; (3) leave interactive mode's human-gated behavior untouched; (4) preserve the relevant governance rule. When GH-111 runs, a shared mode-aware-resolution rule should be extracted (7.3 / PDR-0002 revisit trigger).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-02 | @spec-writer | Initial specification for GH-108 (incorporates PDR-0002 Alternative 1 as the chosen design) |

---

## AUTHORING GUIDELINES

- Sources: GitHub issue GH-108 (PM-provided `change_planning_summary`); the settled decision **PDR-0002** (`doc/decisions/PDR-0002-mode-aware-spec-coverage-resolution.md`, Alternative 1, constraints C-1…C-4); and the authoritative current-behavior sources read and reconciled during authoring — `.opencode/agent/doc-syncer.md` (`<rules>` "Spec-coverage handoff (report, never ticket)", `<reporting>` `spec_coverage_gaps`, step-2 positive coverage check), `.opencode/agent/pm.md` step 3 (coverage "advisory only — not a delivery blocker"), `doc/guides/change-lifecycle.md` Phase 7 (coverage "does not block the change"), `doc/guides/definition-of-ready.md` (coverage "advisory, not a DoR facet"), `.ai/agent/pm-instructions.md` ("PM must NEVER create new tickets autonomously"), `scripts/opencode-session.sh` `default_prompt_for()` (autonomous entry point; sets no mode signal today), and the prior GH-78/GH-79 spec for structure/conventions.
- PDR-0002's chosen design (Alternative 1) is incorporated as settled input — **not** re-litigated. The two open questions it routed (mode representation D1, governance tension D2) are resolved by DEC-1/DEC-5 and DEC-2 respectively.
- The model-capacity / authoring-ownership question is deliberately kept at the **rule** level (the gap is closed in-change in autonomous mode) and punted to the plan as OQ-1; **no acceptance criterion hard-codes which agent authors the spec** (per the planning summary and PDR-0002).
- The model tier of `@doc-syncer` is **not** asserted in this spec (sources disagree on the current tier); capacity is framed generically as an implementation concern (RSK-1, OQ-1).
- File paths are cited for traceability and scope definition (matching the GH-78 exemplar and repo convention), not as step-by-step implementation instructions; the plan-writer derives tasks from this scope. Shared-file edits are scoped surgically (Phase-7 / coverage / mode sections only) to minimize rebase collisions in the parallel batch.
- No license header is added (`doc/changes/**` is not a configured header path per `AGENTS.md`).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-108)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No step-by-step implementation tasks or commit/git instructions (paths cited for traceability only)
- [x] No content duplicated from linked docs (PDR-0002 design incorporated; cross-links used)
- [x] Front matter validates per front_matter_rules
