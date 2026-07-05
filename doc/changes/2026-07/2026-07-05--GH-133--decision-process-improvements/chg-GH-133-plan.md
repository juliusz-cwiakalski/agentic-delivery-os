---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-07/2026-07-05--GH-133--decision-process-improvements/chg-GH-133-plan.md
ados_distribution: project-generated
id: chg-GH-133-decision-process-improvements
status: Proposed
created: 2026-07-05T00:00:00Z
last_updated: 2026-07-05T00:00:00Z
owners:
  - "@juliusz-cwiakalski"
service: decision-making
labels:
  - docs
  - decision-making
  - agent-prompts
  - decision-record-template
links:
  change_spec: ./chg-GH-133-spec.md
  pm_notes: ./chg-GH-133-pm-notes.yaml
  ticket: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/133
summary: >
  Improve decision taxonomy, template usability, and technical-selection
  evidence: replace ambiguous 2D/proportional applicability with a tiered-default
  model, clean up record front matter, overhaul the decision-record template
  (decision rights, evidence/assumptions/unknowns, recommendation-vs-decision,
  rollback, communication plan, structured retro, worked R1/R2/R3 examples),
  add a bounded evidence-pack with security controls, and wire evidence
  delegation from @decision-advisor to @external-researcher — then regenerate
  the .ados-claude/ plugin.
version_impact: minor (non-breaking; docs + agent prompts + template; 6 existing records grandfathered, no migration)
---

# IMPLEMENTATION PLAN — GH-133: Improve decision taxonomy, template usability, and technical-selection evidence

## Context and Goals

This plan delivers a coherent upgrade to ADOS's decision-making surface across four
dimensions: (1) **taxonomy clarity** — a single, unambiguous model for which record
sections apply; (2) **template usability** — a cleaner, more complete record
template; (3) **evidence quality** — a bounded, security-controlled evidence pack
for technical/selection decisions; (4) **agent wiring** — `@decision-advisor`
delegates evidence gathering to `@external-researcher` under explicit guardrails.

**Source of truth.** Requirements were derived from the GH-133 ticket, the PM notes
(`chg-GH-133-pm-notes.yaml`), and the red-team R1 review (verdict:
`PASS_WITH_RISKS`). The red-team's ship-with findings are folded into scope (see
Scope → In Scope). Delivery is a **single ticket with phased commits** per owner
directive (pm-notes).

**Resolved upstream questions (no further action needed):**

- **GH-63 is DISREGARDED** — per owner directive it will not merge in current form;
  GH-133 is the sole authority for the new front-matter contract. No coordination.
- **Backward compatibility** — the 6 existing records (`ADR-0001`, `ADR-0002`,
  `PDR-0001`, `PDR-0002`, `ODR-0001`, `TDR-0001`) are **grandfathered**; verified
  that all 6 currently carry legacy top-level `decision_area` + `reversibility`. No
  migration pass.
- **Applicability model** — collapsed from a 2D matrix to a **tiered default**:
  rigor (R1/R2/R3) is the primary axis driving the section set; type/archetype
  toggles only small enumerated add-ons (full matrices defeat LLM rendering).

**Open questions:**

- **OQ-1 (process deviation):** No `chg-GH-133-spec.md` exists in this change
  folder at plan-authoring time — the operator supplied the requirements inline
  (ticket + pm-notes). The spec path `links.change_spec` above points to the
  canonical expected location. The DoR gate (`@readiness-reviewer`, phase 5) must
  decide whether the inline context satisfies Definition of Ready or whether a
  formal `chg-GH-133-spec.md` must be authored first. This plan does NOT author the
  spec (operator directive: "Do NOT write the spec").
- **OQ-2 (red-team independence):** pm-notes record that the R1 review was
  coordinator-synthesized (no true agent independence in this subagent runtime) and
  recommends independent re-review at DoR for CTO + domain-expert lenses. Scheduled
  R2 (artifacts) and R3 (post-delivery) reviews are tracked in the Execution Log.

---

## Scope

### In Scope

- **S-1** Tiered-default applicability model documented in both decision guides
  (replaces vague "proportional rendering" + the rejected 2D matrix). [AC-1]
- **S-2** Front-matter cleanup: new records drop top-level `decision_area` and
  `reversibility` (kept only inside `classification`); grandfathering note for the
  6 legacy records. [AC-2]
- **S-3** Template structural additions: decision rights prominence,
  evidence/assumptions/unknowns block, recommendation-vs-authorized-decision
  separation, rollback, communication plan, structured retrospective. [AC-3]
- **S-4** Eligibility-first alternatives: screen on constraints before ranking on
  drivers. [AC-4]
- **S-5** Worked R1/R2/R3 examples in the template. [AC-5]
- **S-6** Bounded evidence-pack guidance (top-3 candidates, ~10 signals) with
  security controls: canonical-source, as-of date, data-minimization. [AC-6]
- **S-7** `@external-researcher` decision-evidence gathering mode with the three
  security controls. [AC-7]
- **S-8** `@decision-advisor` evidence delegation to `@external-researcher`;
  ADR/TDR tie-breaker rule; R1 protection (strict subset, no bloat); R1-default-
  local delegation; license-as-human-step. [AC-8]
- **S-9** `.ados-claude/` regeneration from `.opencode/` source (committed with
  source). [AC-9]
- **S-10** Valid `ados_distribution` markers on all changed redistributable docs;
  doc-distribution guard green. [AC-10]
- **S-11** System feature specs reconciled with the implementation. [AC-11]

### Out of Scope

- Migration/edit of the 6 grandfathered records (ADR-0001/0002, PDR-0001/0002,
  ODR-0001, TDR-0001) — they keep their legacy top-level fields.
- GH-63 (decision-record front-matter validator) — disregarded; owner will rebuild
  it later against GH-133's new contract.
- New decision types beyond the existing ADR/PDR/TDR/BDR/ODR.
- Any change to the 11-phase delivery lifecycle, DoR/DoD gates, or `/write-decision`
  / `/plan-decision` command bodies (only their referenced guides/templates change;
  commands are not edited in this change unless Phase 4 review finds a hard break).
- Application/library semantic version bump — this repo's product is prompts/docs;
  there is no `package.json` version to bump. The plugin manifest version
  (`1.0.0`) is owned by `feature-claude-plugin-generation` and is not changed here.

### Constraints

- **C-1 (plugin staleness):** Any commit that edits `.opencode/agent/*.md` or
  `.opencode/command/*.md` MUST regenerate `.ados-claude/` via
  `scripts/build-claude-plugin.sh` **in the same commit** and commit source +
  generated together. CI fails on a stale generated plugin. → Therefore **Phase 3
  must regen** (it edits `external-researcher.md`), not only Phase 4.
- **C-2 (doc-distribution):** Every new/changed doc under `doc/guides/`,
  `doc/templates/` (incl. `blueprints/` and `*.yaml`), or the standalone docs MUST
  declare a valid `ados_distribution` (`redistributable | internal |
  project-generated`). `bash scripts/.tests/test-doc-distribution.sh` must pass for
  redistributable docs. The three target guides/template already carry
  `ados_distribution: redistributable` — preserve it.
- **C-3 (license headers):** AI must never hand-add license headers. Headers are
  managed exclusively by `scripts/add-header-location.sh` for `.opencode/agent/`,
  `doc/guides/`, `tools/`. If a header drifts, run the script — do not edit by hand.
- **C-4 (single source of truth):** Agent/command edits go ONLY in `.opencode/`;
  `.ados-claude/**` is generated. Never hand-edit generated files.
- **C-5 (recommendation ≠ decision):** All template/agent changes preserve the
  invariant that the AI recommendation is rendered separately from the authorized
  (often human) decision; R2/R3 records stay `Proposed` with `decision_date: null`
  until a human decides.
- **C-6 (non-breaking):** No removal of fields/sections that existing consumers
  depend on without grandfathering. Legacy records remain valid as-is.

### Risks

- **RSK-1: Guide/template drift from system specs.** Editing the guides/template
  without reconciling `doc/spec/features/feature-decision-making.md`,
  `feature-decision-records.md`, `feature-external-researcher.md`, and
  `feature-document-templates.md` leaves the spec ↔ implementation out of sync.
  *Mitigated by Phase 5 (Spec Synchronization) before review.*
- **RSK-2: Plugin staleness between phases.** If a phase edits an `.opencode/`
  agent but forgets to regen, CI fails. *Mitigated by C-1 + an explicit regen step
  + idempotency check (re-run produces no diff) in Phases 3 and 4.*
- **RSK-3: Over-engineering the evidence pack.** A heavy evidence-pack mandate
  could bloat R1/R2 records. *Mitigated by the bounded cap (top-3, ~10 signals) and
  R1 protection (strict subset).*
- **RSK-4: Ambiguous ADR vs TDR classification.** Selection decisions blur
  architecture vs technology. *Mitigated by the explicit tie-breaker rule (S-8).*
- **RSK-5: Reviewer flags missing formal spec.** OQ-1 may force a spec-authoring
  round-trip at DoR. *Mitigated by transparent flagging + rich inline context.*
- **RSK-6: License-as-human-step misread as license-blocking.** The rule is that AI
  must not *autonomously accept* a dependency's license, not that licenses block
  selection. *Mitigated by precise wording in Phase 4.*

### Success Metrics

- All ACs (AC-1 … AC-11) satisfied at DoD.
- `bash scripts/.tests/test-doc-distribution.sh` exits 0.
- `scripts/build-claude-plugin.sh` is idempotent (second run → no `git diff`).
- No edit to any of the 6 grandfathered records (`git diff -- doc/decisions/` clean
  for the 6 record files).
- Tiered-default model is the single documented applicability mechanism (no
  surviving "2D matrix" or standalone "proportional rendering" wording that
  contradicts it).

---

## Phases

### Phase 1: Taxonomy clarification (tiered-default applicability + grandfathering)

**Goal**: Replace the ambiguous proportional/2D-matrix applicability story with a
single tiered-default model, add the ADR/TDR tie-breaker, and document the
grandfathering of the 6 legacy records.

**Tasks**:

- [ ] **1.1** Add a **"Tiered-default section applicability"** subsection to
  `doc/guides/decision-making.md` (within/adjacent to §3 Rigor profiles): rigor
  (R1/R2/R3) is the **primary axis** driving the section set; type/archetype toggle
  only small **enumerated add-ons** (a compact table, not a full matrix). State
  explicitly that a full 2D matrix is intentionally avoided (LLM rendering cost).
- [ ] **1.2** Add the **ADR/TDR tie-breaker rule** to `decision-making.md` (§4 or
  §7) and mirror it in `decision-records-management.md` §2: selecting a specific
  technology/library/tool/build tooling → **TDR**; system structure, boundaries,
  patterns, API/event contracts → **ADR**. Provide a one-line "when both fit"
  resolution.
- [ ] **1.3** Update `decision-records-management.md` §6 (Required Sections) and §5
  (Front Matter) to **point to the tiered-default model** instead of the vague
  "proportional rendering" phrase; keep the template as the section-order authority.
- [ ] **1.4** Add a **"Backward compatibility / grandfathering"** note
  (`decision-records-management.md`, near §5): the 6 existing records
  (`ADR-0001`, `ADR-0002`, `PDR-0001`, `PDR-0002`, `ODR-0001`, `TDR-0001`) retain
  legacy top-level `decision_area` + `reversibility`; **no migration**; new records
  follow the Phase-2 front-matter contract.
- [ ] **1.5** Verify `ados_distribution: redistributable` is intact on both guides;
  run `bash scripts/.tests/test-doc-distribution.sh`.

**Acceptance Criteria**:

- Must: AC-1 (tiered-default documented in both guides); AC-2 (grandfathering note
  lists exactly the 6 IDs and states no-migration); AC-10 (markers valid, guard
  green).
- Should: AC-8-part (ADR/TDR tie-breaker present in both guides).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/decision-making.md` (updated), `doc/guides/decision-records-management.md` (updated).

**Tests**:

- `rg -n "tiered-default|tiered default" doc/guides/decision-making.md doc/guides/decision-records-management.md` returns matches.
- `rg -n "ADR-0001|ADR-0002|PDR-0001|PDR-0002|ODR-0001|TDR-0001" doc/guides/decision-records-management.md` shows the grandfathering note.
- `bash scripts/.tests/test-doc-distribution.sh` → exit 0.

**Completion signal**: `docs(gh-133): clarify decision taxonomy — tiered-default applicability + grandfathering`

---

### Phase 2: Template overhaul (front matter + sections + examples)

**Goal**: Clean up `decision-record-template.md` front matter, add the missing
structural sections, enforce eligibility-first alternatives and R1 protection, and
ship worked R1/R2/R3 examples.

**Tasks**:

- [ ] **2.1** **Front-matter cleanup**: remove top-level `decision_area` and
  `reversibility` keys (keep `reversibility` only inside the optional
  `classification` block). Add a short comment: legacy records are grandfathered
  (see Phase 1 note); new records use `classification` only.
- [ ] **2.2** **Decision rights prominence**: surface the `governance` (DACI) block
  earlier in the body with inline guidance (Driver / Decider / Contributors /
  Required reviewers / Performers / Informed), cross-linked to decision-making.md §5.
- [ ] **2.3** **Evidence / Assumptions / Unknowns**: add a structured block under
  Context (or a dedicated subsection) with `FACT / ASSUMPTION / TO-CONFIRM` labels
  and source references, consistent with the Phase-3 evidence-pack cap.
- [ ] **2.4** **Recommendation vs Authorized Decision**: split the Decision section
  so the analyst/AI *recommendation* and the *authorized decision* are rendered
  separately; keep the constraint-compliance attestation.
- [ ] **2.5** **Rollback + Communication Plan**: add a Rollback subsection (D12:
  revert steps, stop-conditions) and a Communication Plan subsection (D12:
  audiences, message, channel) — both gated by rigor (R3 expects both).
- [ ] **2.6** **Structured Retrospective**: replace the free-form Lessons Learned
  with a D14 structure separating process quality / evidence quality / execution
  quality / realized outcome / luck & variance (anti-outcome-bias).
- [ ] **2.7** **Eligibility-first alternatives**: make the Alternatives Considered
  guidance explicit — screen every alternative against constraints **first**
  (eliminate failures), **then** rank survivors on drivers. Keep the existing
  per-alternative compliance matrix.
- [ ] **2.8** **R1 protection**: update the PROPORTIONAL RENDERING comment block to
  state R1 is a **strict proper subset** of R3 (no R3-only sections) and list the
  R1-allowed vs R1-omitted sections crisply.
- [ ] **2.9** **Worked examples**: append worked **R1 / R2 / R3** examples (compact
  brief / standard record / high-assurance) that demonstrate the tiered-default
  rendering.
- [ ] **2.10** Verify `ados_distribution: redistributable` intact; run doc-distribution guard.

**Acceptance Criteria**:

- Must: AC-2 (no top-level `decision_area`/`reversibility` in the template front
  matter); AC-3 (all six structural additions present); AC-4 (eligibility-first
  wording); AC-5 (worked R1/R2/R3 examples); AC-10 (marker valid, guard green).
- Should: AC-1-consistency (template's rendering guidance matches the Phase-1
  tiered-default model, not a contradicting "proportional rendering" narrative).

**Files and modules**:

- Code areas: none.
- System docs: `doc/templates/decision-record-template.md` (updated).

**Tests**:

- `rg -n "^decision_area:|^reversibility:" doc/templates/decision-record-template.md` returns nothing (top-level removed); `rg -n "reversibility:" doc/templates/decision-record-template.md` shows it only under `classification:`.
- `rg -n "Rollback|Communication Plan|Recommendation|Structured Retrospective|FACT.*ASSUMPTION.*TO-CONFIRM" doc/templates/decision-record-template.md` returns matches.
- `rg -n "eligibility|screen.*constraint|eliminate" doc/templates/decision-record-template.md` returns matches.
- `rg -n "R1 example|R2 example|R3 example|Worked" doc/templates/decision-record-template.md` returns matches.
- `bash scripts/.tests/test-doc-distribution.sh` → exit 0.

**Completion signal**: `docs(gh-133): overhaul decision-record template — front matter, sections, examples`

---

### Phase 3: Evidence-pack guidance + external-researcher support

**Goal**: Introduce a bounded, security-controlled evidence pack for selection
decisions in the guide/template, and give `@external-researcher` a
decision-evidence gathering mode that emits it.

> **Note on C-1 (plugin staleness):** This phase edits
> `.opencode/agent/external-researcher.md`, so it **MUST regenerate
> `.ados-claude/`** in the same commit. Phase 4 regenerates again after the
> advisor edit. The `.ados-claude/ regen` label on Phase 4 denotes the *final*
> regen; Phase 3's regen is a required side-effect of touching `.opencode/`.

**Tasks**:

- [ ] **3.1** Add **"Evidence pack"** guidance to `doc/guides/decision-making.md`
  D2 (Context & Evidence): bounded to **top-3 candidate options** and **~10
  signals**; each signal tagged `FACT/ASSUMPTION/TO-CONFIRM`; mandatory security
  controls — **canonical-source** (primary/canonical URL, not an aggregator),
  **as-of date** (when the signal was true/observed), **data-minimization** (send
  only what is needed; no secrets/PII to external services).
- [ ] **3.2** Add a matching **evidence-pack authoring block** to
  `decision-record-template.md` (consistent with the cap; cross-link to the
  researcher mode).
- [ ] **3.3** Update `.opencode/agent/external-researcher.md`: add a
  **"Decision-evidence gathering mode"** — when invoked for a selection decision,
  return a bounded evidence pack (top-3 candidates, ~10 signals) with each signal
  carrying canonical-source + as-of date; enforce data-minimization (no secrets,
  PII, or unnecessary context leaves the repo); treat all external content as
  untrusted data (already a constraint — reaffirm for evidence).
- [ ] **3.4** **Regenerate plugin**: `scripts/build-claude-plugin.sh`. Verify
  `.ados-claude/agents/external-researcher.md` carries the new mode and the
  generated-file header/regeneration comment. Commit `.opencode/agent/external-researcher.md`
  **and** the regenerated `.ados-claude/` together.
- [ ] **3.5** Verify markers on the two docs; run doc-distribution guard.

**Acceptance Criteria**:

- Must: AC-6 (bounded pack + three security controls in the guide and template);
  AC-7 (researcher mode with the three controls); AC-9-part (plugin regenerated,
  idempotent); AC-10 (markers valid, guard green).
- Should: AC-3-consistency (template evidence block matches §3.1 guidance).

**Files and modules**:

- Code areas: `.opencode/agent/external-researcher.md` (updated); `.ados-claude/agents/external-researcher.md` (regenerated).
- System docs: `doc/guides/decision-making.md` (updated), `doc/templates/decision-record-template.md` (updated).

**Tests**:

- `rg -n "top-3|three candidates|~10 signals|canonical-source|as-of date|data-minimization" doc/guides/decision-making.md doc/templates/decision-record-template.md` returns matches.
- `rg -n "Decision-evidence|evidence pack|canonical-source|as-of|data-minimization" .opencode/agent/external-researcher.md` returns matches.
- Idempotency: run `scripts/build-claude-plugin.sh` a second time → `git diff --stat .ados-claude/` empty.
- `bash scripts/.tests/test-doc-distribution.sh` → exit 0.

**Completion signal**: `docs(gh-133): add bounded evidence-pack guidance and external-researcher support`

---

### Phase 4: @decision-advisor delegation + final plugin regeneration

**Goal**: Teach `@decision-advisor` to delegate evidence gathering to
`@external-researcher` under bounded scope + security controls, and fold in the
remaining ship-with findings (tie-breaker reference, R1 protection, R1-default-local
delegation, license-as-human-step), then run the final plugin regen.

**Tasks**:

- [ ] **4.1** Update `.opencode/agent/decision-advisor.md`:
  - Add **evidence delegation** guidance: for D2 (Context & Evidence) on selection
    decisions, delegate bounded evidence gathering to `@external-researcher`
    (top-3 candidates, ~10 signals; canonical-source + as-of date +
    data-minimization). Keep `@decision-advisor` as the synthesizer of the
    returned pack.
  - Reference the **ADR/TDR tie-breaker rule** (Phase 1) in the classification step.
  - Reaffirm **R1 protection**: R1 renders a strict proper subset of R3; never add
    R3-only sections to an R1 brief.
  - Document **R1-default-local delegation**: within the §6 bounded AI-authority
    model, R0/R1 reversible choices may be acted on locally (audit + escalation),
    no record for R0.
  - Document **license-as-human-step**: when a selection introduces a dependency,
    its license acceptance is a **human step** — the advisor flags the license for
    human review; it never autonomously "accepts" a license.
- [ ] **4.2** **Final regeneration**: `scripts/build-claude-plugin.sh`. Verify
  `.ados-claude/agents/decision-advisor.md` carries the delegation + security
  controls + generated-file header.
- [ ] **4.3** (If header drift detected) run `scripts/add-header-location.sh .opencode/agent`
  — never hand-edit headers. Otherwise skip.
- [ ] **4.4** Commit `.opencode/agent/decision-advisor.md` **and** the regenerated
  `.ados-claude/` together.

**Acceptance Criteria**:

- Must: AC-8 (delegation + tie-breaker + R1 protection + R1-default-local +
  license-as-human-step in the advisor); AC-9 (final plugin regen, idempotent,
  source + generated committed together).
- Should: AC-7-consistency (advisor's delegation contract matches the researcher's
  evidence-pack mode from Phase 3).

**Files and modules**:

- Code areas: `.opencode/agent/decision-advisor.md` (updated); `.ados-claude/agents/decision-advisor.md` (regenerated).
- System docs: none (agent prompt change).

**Tests**:

- `rg -n "@external-researcher|evidence|top-3|canonical-source|as-of|data-minimization" .opencode/agent/decision-advisor.md` returns matches.
- `rg -n "tie-breaker|ADR.*TDR|R1 protection|strict proper subset|license-as-human|license.*human" .opencode/agent/decision-advisor.md` returns matches.
- `rg -n "Decision-evidence|delegat" .ados-claude/agents/decision-advisor.md` returns matches (generated carries source).
- Idempotency: `scripts/build-claude-plugin.sh` second run → `git diff --stat .ados-claude/` empty.

**Completion signal**: `feat(gh-133): decision-advisor evidence delegation + regenerate plugin`

---

### Phase 5: Documentation & Spec Synchronization

**Goal**: Reconcile the system feature specs with the implemented changes so the
spec ↔ implementation stays consistent before review (mitigates RSK-1). This is the
`system_spec_update` phase, owned by `@doc-syncer`.

**Tasks**:

- [ ] **5.1** Update `doc/spec/features/feature-decision-making.md`: reflect the
  tiered-default applicability model and the bounded evidence pack + security
  controls.
- [ ] **5.2** Update `doc/spec/features/feature-decision-records.md`: reflect the
  front-matter cleanup (no top-level `decision_area`/`reversibility` for new
  records), the grandfathering policy, and the template's new sections.
- [ ] **5.3** Update `doc/spec/features/feature-external-researcher.md`: document
  the decision-evidence gathering mode + security controls.
- [ ] **5.4** Update `doc/spec/features/feature-document-templates.md`: refresh the
  `decision-record-template.md` description (front matter + sections + worked
  examples; the current spec says "14 sections" — reconcile to the actual count
  after Phase 2).
- [ ] **5.5** Verify `feature-claude-plugin-generation.md` still describes the regen
  contract accurately (no change expected; confirm only).
- [ ] **5.6** Run doc-distribution guard over the full DM-2 set.

**Acceptance Criteria**:

- Must: AC-11 (all four primary feature specs reconciled); AC-10 (guard green).
- Should: the "14 sections" claim in `feature-document-templates.md` matches the
  real post-Phase-2 section count.

**Files and modules**:

- Code areas: none.
- System docs: `doc/spec/features/feature-decision-making.md`, `feature-decision-records.md`, `feature-external-researcher.md`, `feature-document-templates.md` (updated); `feature-claude-plugin-generation.md` (verified).

**Tests**:

- `rg -n "tiered-default|evidence pack|grandfather" doc/spec/features/feature-decision-making.md doc/spec/features/feature-decision-records.md doc/spec/features/feature-external-researcher.md` returns matches.
- `bash scripts/.tests/test-doc-distribution.sh` → exit 0.

**Completion signal**: `docs(gh-133): reconcile decision specs with implementation`

---

### Phase 6: Code Review (Analysis)

**Goal**: Adversarially audit the change against spec/plan, repo rules, and the
red-team ship-with findings. This is the `review_fix` phase (local mode), plus the
scheduled **R2 (artifacts) review** from pm-notes. Owned by `@reviewer`.

**Tasks**:

- [ ] **6.1** Run `/review GH-133` (or `/review-deep GH-133`) against the diff vs
  `main`: verify each AC is demonstrably met in the artifacts, not just claimed.
- [ ] **6.2** Verify invariants: C-1 (no stale `.ados-claude/`), C-2 (markers),
  C-3 (no hand-added headers), C-4 (single source of truth), C-5 (recommendation ≠
  decision), C-6 (6 grandfathered records untouched).
- [ ] **6.3** Confirm the red-team ship-with findings are all addressed: tiered
  applicability, security controls, evidence-pack cap, ADR/TDR tie-breaker, worked
  examples, R1 protection, R1-default-local delegation, license-as-human-step.
- [ ] **6.4** Capture a tri-state verdict (PASS / PASS_WITH_RISKS / FAIL). If FAIL
  or PASS_WITH_RISKS with must-fix items → open Phase 7.

**Acceptance Criteria**:

- Must: review verdict is PASS or PASS_WITH_RISKS with all must-fix items tracked
  in Phase 7; every AC has evidence in the diff.

**Files and modules**:

- Code areas: none (read-only analysis); fixes land in Phase 7.
- System docs: none.

**Tests**:

- Review report artifact present; AC traceability matrix complete.

**Completion signal**: `docs(gh-133): add review report` (or no commit if review is
verbal/ephemeral — log verdict in Execution Log).

---

### Phase 7: Post-Review Fixes (conditional)

**Goal**: Apply targeted remediation for any FAIL / must-fix items from Phase 6.
**Skip entirely if Phase 6 verdict is PASS with no must-fixes.**

**Tasks**:

- [ ] **7.1** For each must-fix item: edit the relevant guide/template/agent source
  only; never edit `.ados-claude/**` or the 6 grandfathered records by hand.
- [ ] **7.2** If any `.opencode/agent/*.md` was touched → re-run
  `scripts/build-claude-plugin.sh` and commit source + generated together.
- [ ] **7.3** Re-run doc-distribution guard; re-verify affected ACs.
- [ ] **7.4** Re-review the remediated items only (delta review).

**Acceptance Criteria**:

- Must: all Phase-6 must-fix items resolved; invariants C-1 … C-6 hold.

**Files and modules**:

- Code areas: as identified by Phase 6 (source files only).
- System docs: as identified by Phase 6.

**Tests**:

- Doc-distribution guard green; idempotent plugin build; AC re-verification.

**Completion signal**: `fix(gh-133): apply <short> review findings`

---

### Phase 8: Finalize and Release

**Goal**: Run quality gates, confirm DoD, and hand to PR creation. This is the
`quality_gates` → `dod_check` → `pr_creation` tail.

**Tasks**:

- [ ] **8.1** Run `/check` (build/test/lint — for this repo: script tests +
  doc-distribution guard + plugin staleness). If failures → `@fixer` → re-run
  (`/check-fix`).
- [ ] **8.2** **Version note (per repo conventions):** no application/library
  semantic-version bump applies (this repo's product is prompts/docs; no
  `package.json` version). The release artifact is the regenerated `.ados-claude/`
  plugin (committed in Phases 3–4). Plugin manifest version (`1.0.0`) is owned by
  `feature-claude-plugin-generation` and is intentionally unchanged. Document this
  determination in the Execution Log.
- [ ] **8.3** **Spec reconciliation confirmation:** assert Phase 5 reconciled all
  four primary feature specs and the doc-distribution guard is green (AC-11).
- [ ] **8.4** `@pm` runs DoD: verify all ACs (AC-1 … AC-11) met and all phase tasks
  complete; confirm the 6 grandfathered records are untouched.
- [ ] **8.5** `@pr-manager` creates/updates the PR with ticket context; assign to
  human; the **R3 post-delivery review** (pm-notes) is scheduled after merge.

**Acceptance Criteria**:

- Must: all ACs satisfied; quality gates green; PR created and linked in Execution
  Log; DoD signed off.

**Files and modules**:

- Code areas: none (release/gate phase).
- System docs: none (already reconciled in Phase 5).

**Tests**:

- `bash scripts/.tests/test-doc-distribution.sh` → exit 0.
- `scripts/build-claude-plugin.sh` idempotent (no diff on second run).
- `git diff --stat -- doc/decisions/ADR-0001*.md doc/decisions/ADR-0002*.md doc/decisions/PDR-0001*.md doc/decisions/PDR-0002*.md doc/decisions/ODR-0001*.md doc/decisions/TDR-0001*.md` → empty (grandfathered, untouched).

**Completion signal**: PR created (`#<n>`); Execution Log updated with PR URL.

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | Tiered-default model is the sole documented applicability mechanism; no contradicting "2D matrix" wording survives | 1, 5 | AC-1 |
| TS-2 | New-record template front matter has no top-level `decision_area`/`reversibility`; they appear only under `classification` | 2 | AC-2 |
| TS-3 | Grandfathering note lists exactly the 6 legacy IDs and states no migration | 1 | AC-2 |
| TS-4 | Template contains decision rights, evidence/assumptions/unknowns, recommendation-vs-decision, rollback, communication plan, structured retro | 2 | AC-3 |
| TS-5 | Alternatives guidance states constraints screen before driver ranking | 2 | AC-4 |
| TS-6 | Template ships worked R1, R2, R3 examples | 2 | AC-5 |
| TS-7 | Evidence-pack guidance caps at top-3 / ~10 signals with the three security controls | 3 | AC-6 |
| TS-8 | `@external-researcher` has a decision-evidence mode emitting the bounded pack with security tags | 3, 4 | AC-7 |
| TS-9 | `@decision-advisor` delegates evidence to researcher + tie-breaker + R1 protection + R1-default-local + license-as-human-step | 4 | AC-8 |
| TS-10 | `.ados-claude/` regenerated; build is idempotent; source + generated committed together | 3, 4 | AC-9 |
| TS-11 | All changed redistributable docs carry valid `ados_distribution`; guard exits 0 | 1–5, 8 | AC-10 |
| TS-12 | The 6 grandfathered records are byte-for-byte untouched | 8 | AC-2, AC-6 |
| TS-13 | System feature specs reconciled with implementation | 5 | AC-11 |

---

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| PM notes (context source) | `./chg-GH-133-pm-notes.yaml` | Context |
| Change spec (expected, see OQ-1) | `./chg-GH-133-spec.md` | Spec |
| This plan | `./chg-GH-133-plan.md` | Plan |
| Decision-Making guide | `doc/guides/decision-making.md` | Updated (P1, P3, P5) |
| Decision Records Management guide | `doc/guides/decision-records-management.md` | Updated (P1) |
| Decision Record template | `doc/templates/decision-record-template.md` | Updated (P2, P3) |
| external-researcher agent | `.opencode/agent/external-researcher.md` | Updated (P3) |
| decision-advisor agent | `.opencode/agent/decision-advisor.md` | Updated (P4) |
| Generated plugin (external-researcher) | `.ados-claude/agents/external-researcher.md` | Regenerated (P3) |
| Generated plugin (decision-advisor) | `.ados-claude/agents/decision-advisor.md` | Regenerated (P4) |
| System spec — decision making | `doc/spec/features/feature-decision-making.md` | Updated (P5) |
| System spec — decision records | `doc/spec/features/feature-decision-records.md` | Updated (P5) |
| System spec — external researcher | `doc/spec/features/feature-external-researcher.md` | Updated (P5) |
| System spec — document templates | `doc/spec/features/feature-document-templates.md` | Updated (P5) |
| Ticket | https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/133 | External |

---

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-05 | plan-writer | Initial plan. 4 content phases (taxonomy, template, evidence-pack + researcher, advisor delegation) + spec-sync + review + fixes + release. Requirements derived from ticket + pm-notes + red-team R1 (inline; formal spec pending — see OQ-1). |

---

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Not started | — | — | — | |
| 2 | Not started | — | — | — | |
| 3 | Not started | — | — | — | Must regen `.ados-claude/` (C-1). |
| 4 | Not started | — | — | — | Final regen. |
| 5 | Not started | — | — | — | `@doc-syncer`. |
| 6 | Not started | — | — | — | `@reviewer`; includes R2 artifacts review. |
| 7 | Not started | — | — | — | Conditional on Phase 6. |
| 8 | Not started | — | — | — | Quality gates → DoD → PR; R3 post-delivery review scheduled post-merge. |
