---
id: PDR-0002
decision_type: pdr
status: Proposed
created: 2026-07-02
decision_date: null
last_updated: 2026-07-02
summary: "Make doc-syncer spec-coverage resolution mode-aware: introduce an explicit `delivery_mode` signal so that, in autonomous delivery, a spec-coverage gap is resolved IN-CHANGE (feature spec authored) instead of silently dropped — while preserving the interactive-mode advisory/human-gated de-noise behavior and the 'PM never creates tickets autonomously' governance rule (GH-108, epic #107)."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_area: product
decision_scope: repo
reversibility: moderate
review_date: null
business_impact: "None directly — shapes the reliability of the delivery system's own documentation feedback loop."
customer_impact: "Adopters running ADOS autonomously no longer get silently-rotting system specs; every modified feature area acquires (or updates) a feature spec. Interactive users see no behavioral change."
classification:
  domains: [product, process, governance, operations]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor"
  decider: "Juliusz Ćwiąkalski (final acceptance rides the GH-108 PR review)"
  contributors:
    - "@pm (raised the two open questions + the recommended lean during clarify_scope)"
    - "@doc-syncer (current-behavior authority: report-only spec_coverage_gaps)"
  reviewers:
    - "Juliusz Ćwiąkalski (GH-108 PR)"
    - "@decision-critic (independent challenge, PM-run, optional)"
  performers:
    - "@coder (GH-108 delivery — encode the mode-aware rule in doc-syncer/lifecycle/pm)"
  informed:
    - "delivery agents"
    - "sibling change GH-111 implementer (operational-guides trigger mirrors this pattern)"
ai_assistance:
  used: true
  roles: [researcher, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Autonomous delivery gains a mid-flight human checkpoint → re-evaluate whether the in-change authoring requirement can relax back toward advisory."
  - "Sibling GH-111 extracts a SHARED mode rule that changes the representation (e.g., promotes `delivery_mode` to a non-pm-notes location) → reconcile this record to the shared form."
  - "Autonomous-authored feature specs repeatedly arrive low-quality at PR review → re-evaluate whether to gate authoring on model tier or add a human spot-check."
links:
  related_changes: ["GH-108"]
  spec: ["doc/spec/features/feature-delivery-lifecycle.md"]
  decisions: []
---

# PDR-0002: Mode-Aware Spec-Coverage Resolution for Autonomous Delivery

## Context

GH-108 (epic #107, P1 bug) reports that across a long autonomous delivery run, **zero feature specs were produced**: modified feature areas acquired no `doc/spec/features/feature-<slug>.md`, so the system spec silently rotted. The root cause is not a missing check — the check exists and fires — but a **mode blindness** in how its result is handled.

Today's authoritative behavior (all verified against shipped sources):

- `.opencode/agent/doc-syncer.md` `<rules>` — "Spec-coverage handoff (report, never ticket)": `@doc-syncer` **only REPORTS** `spec_coverage_gaps`; it never creates a spec or a ticket. The de-noised, human-gated chain is: doc-syncer reports → `@pm` checks open issues and **references** an existing tracker (de-noising) → `@pm` **proposes** a follow-up → **only the human** approves ticket creation.
- `doc/guides/change-lifecycle.md` Phase 7 — coverage "is advisory at this phase; it does not block the change from proceeding to `review_fix`."
- `.ai/agent/pm-instructions.md` line 40 — governance rule: "PM must NEVER create new tickets autonomously."
- `.opencode/agent/pm.md` step 3 — feature spec coverage awareness is "advisory only — not a delivery blocker."

This de-noise design is **correct for human-in-loop**: it stops every change from noisily forcing a follow-up ticket on a human who is present to decide. The bug is the **absence of mode-awareness**, not the de-noise principle. In autonomous delivery (`scripts/opencode-session.sh` runs `@pm` end-to-end via `default_prompt_for()`, stopping only at an open PR), there is **no human mid-flight** to read the advisory report or approve a follow-up. "Advisory + human-gated" therefore silently reduces to **"never happens."**

Two tightly-coupled decisions must be resolved together (both were routed to `@decision-advisor` as open questions in `chg-GH-108-pm-notes.yaml`):

- **D1 — Mode representation:** "Autonomous mode" is referenced by the ticket but is **not** a formal/detectable concept today (no mode flag; `opencode-session.sh` sets no structured signal agents can read). How should it be represented so a mode-aware rule can apply?
- **D2 — Governance tension:** AC-2 option (ii) "PM auto-creates follow-up ticket" directly conflicts with the hard governance rule "PM must NEVER create new tickets autonomously." How is the tension resolved?

This is **precedent-setting**: sibling ticket **GH-111** ("operational guides trigger") explicitly says it will **mirror this same mode-aware pattern and extract a shared rule**. The `delivery_mode` concept adopted here is intended to be reusable.

## Problem Framing (Clarified)

**FACT:** The spec-coverage gap is already detected and reported (doc-syncer `spec_coverage_gaps`); the defect is purely in the *resolution* path, not detection.

**FACT:** `doc/spec/**` is inside `@doc-syncer`'s write-allowlist; it already creates and reconciles feature specs. Authoring a missing feature spec is an *extension of an existing capability*, not a new write surface.

**FACT:** Autonomous delivery already terminates at a human gate: the open PR (the `default_prompt_for()` instructions explicitly say "CREATE THE PR AND LEAVE IT OPEN… the human performs the final review and squash-merge"). So autonomously-authored content is still human-reviewed — just at the end, not mid-flight.

**FACT:** "Autonomous mode" has no machine-readable representation today; `opencode-session.sh` writes session mappings to `.ai/local/` and passes a prompt, but sets no flag any agent can read.

**ASSUMPTION:** `@pm` is the natural owner of the per-change mode declaration, because it already creates and owns `chg-<workItemRef>-pm-notes.yaml` at intake (step 3).

**TO CONFIRM at delivery:** Whether `@doc-syncer`'s current model tier (haiku/scoped per `opencode-model-configuration.md`) is sufficient to *author* a full feature spec from scratch, or whether authoring must be delegated to a stronger model / `@coder` while doc-syncer retains gap-detection and the resolution requirement. (Flagged for the plan — see Unresolved Questions.)

**Reframed problem (root cause, not symptom):** The resolution path assumes a human is reachable mid-flight. The fix is to make the path **mode-aware**: introduce an explicit, auditable mode signal, and scope a *resolution requirement* (not merely reporting) to the mode where no human is reachable — autonomous — while leaving interactive mode's advisory/human-gated behavior (and the ticket-creation governance gate) untouched.

## Constraints (Hard Requirements)

**Table-stakes:** All alternatives inherit doc-syncer's existing write-allowlist (`doc/spec/**`, `doc/contracts/**`, etc.), the traceability rule (every updated file links `workItemRef`), and the autonomous-delivery terminal human gate (open PR reviewed by the human).

### C-1: The "PM never creates tickets autonomously" governance rule stays intact

- **Statement:** The decision must NOT override, carve an exception into, or weaken the rule in `.ai/agent/pm-instructions.md` ("PM must NEVER create new tickets autonomously"). A change that has `@pm` (or any agent on its behalf) auto-create a tracker follow-up ticket is disqualifying.
- **Source:** prior decision / governance (`.ai/agent/pm-instructions.md:40`; reinforced in doc-syncer `<rules>`).
- **Verification:** audit — `pm-instructions.md` and `pm.md` retain the rule with no autonomous-mode exception; the resolution path closes the coverage gap without creating a tracker ticket.
- **Negotiable:** no.

### C-2: The coverage gap resolves WITHOUT a human mid-flight in autonomous mode

- **Statement:** In autonomous mode, a detected `spec_coverage_gap` for a modified feature area must be **resolved within the change** (a feature spec is authored/created), with no step that blocks waiting for a human who is not present. Reporting alone is insufficient.
- **Source:** AC (the GH-108 bug — "specs must actually fire post-merge").
- **Verification:** demonstration / audit — an autonomous delivery run over a modified feature area with no prior spec produces a feature spec in `doc/spec/features/`.
- **Negotiable:** no.

### C-3: Interactive-mode de-noise behavior is preserved

- **Statement:** The decision must NOT revert the de-noise design for human-in-loop. Interactive mode retains the current advisory + human-gated behavior (report → PM proposes → human approves ticket creation); it must not gain a new forced resolution interaction that didn't exist before.
- **Source:** prior decision (the GH-78/GH-79 de-noise design; ticket framing: "Fix = mode-awareness, NOT reverting the de-noise design").
- **Verification:** audit — interactive path is byte-for-byte unchanged in effect; no new blocking prompt is introduced for interactive runs.
- **Negotiable:** no.

### C-4: Mode detection works across ALL entry points, not session-tooling-only

- **Statement:** The mode signal must be available and correct whether `@pm` is driven by `scripts/opencode-session.sh` OR invoked manually (e.g., `@pm deliver change GH-…` in an interactive session). It must not depend on an environment variable or marker that only the session script sets and that manual invocations cannot reproduce.
- **Source:** internal standard (self-contained agents; works across entry points; the manual path is a first-class supported mode).
- **Verification:** demonstration — a manual `@pm` invocation reads the same mode signal as an `opencode-session.sh` run.
- **Negotiable:** no.

## Decision Drivers

**Business / product drivers:**
- **D1 — Reliability of the feedback loop:** the system spec must not silently rot; modified feature areas must acquire/update specs. (This is the entire point of the ticket.)
- **D2 — Reusability / precedent:** the mode concept should be general enough that sibling GH-111 ("operational guides trigger") can mirror it and extract a shared rule — minimizing duplicated design.
- **D3 — Auditability:** the mode in force for a given change should be inspectable after the fact from a durable, committed artifact (not an ephemeral env var or session-local state).

**Operational drivers:**
- **D4 — De-noise preservation:** humans in interactive mode must not be re-burdened with per-change forced interactions the de-noise design deliberately removed.
- **D5 — Least governance disruption:** prefer the path that preserves existing hard governance rules over carving exceptions into them.
- **D6 — Simplicity / paved road:** prefer a representation that is cheap to encode, backward-compatible, and uses an existing owned artifact over inventing new machinery.

## Mental Models & Techniques Used

- **First Principles:** what is the *actual* difference between the two situations? Not "interactive vs autonomous" as labels, but "is a human reachable mid-flight to close an advisory loop?" The mode signal is a proxy for that reachability.
- **Inversion:** what makes the current design silently wrong? A resolution path that *assumes* a reachable human. The fix makes the assumption explicit and gated.
- **Second-Order Thinking:** if we let `@pm` auto-create tickets (option ii), what follows? A weakened governance rule, re-introduced de-noise (ticket clutter), and a precedent that ticket-creation is negotiable — exactly what the rule exists to prevent.
- **KISS / Paved Road:** `delivery_mode` lives in `pm-notes.yaml` (an artifact `@pm` already creates and owns); no new file, no new tooling surface.
- **Opportunity Cost:** the cost of *not* making mode a first-class concept is that GH-111 re-derives ad-hoc detection, fragmenting the rule.

## Alternatives Considered

The two decisions are **tightly coupled** (the mode signal gates the resolution behavior), so alternatives are evaluated as **combined positions** = (mode representation) × (resolution approach). Each position cross-references the option letters from the routing brief.

### Per-Alternative Constraint-Compliance Matrix

| Position | C-1 (no auto-ticket) | C-2 (resolves w/o human) | C-3 (interactive de-noise) | C-4 (all entry points) |
|---|:---:|:---:|:---:|:---:|
| **ALT-0** Do nothing (keep advisory everywhere) | ✅ | ❌ | ✅ | ✅ |
| **ALT-1** `delivery_mode` (D1-A) + author-in-change (D2-A) *(recommended)* | ✅ | ✅ | ✅ | ✅ |
| **ALT-2** Mode-independent always-require (D1-B) + author-in-change (D2-A) | ✅ | ✅ | ⚠️ | ✅ |
| **ALT-3** `delivery_mode` (D1-A) + PM auto-ticket (D2-B) | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails (disqualifying for `negotiable: no`) · ⚠️ passes only via an accepted-risk exception (requires `negotiable: yes`).

### Alternative 0 — Do Nothing / Keep Advisory Everywhere

- **Summary:** Status quo: doc-syncer reports `spec_coverage_gaps`; PM proposes a follow-up; human approves a ticket — in *all* modes. (The literal current state.)
- **Pros:** zero change; no new concepts.
- **Cons:** the bug persists unchanged. In autonomous delivery the gap is **never** resolved (no human mid-flight), so feature specs never get authored and the system spec rots. This is exactly what GH-108 was filed to fix.
- **Constraint compliance:** **fails C-2** (reporting is not resolution; no human is present to close the loop).
- **Why rejected:** it is the defect, not a fix. (D1)

### Alternative 1 — Explicit `delivery_mode` signal + author the spec in-change (autonomous) *(recommended)*

- **Summary:** Adopt a per-change `delivery_mode: interactive | autonomous` field in `chg-<ref>-pm-notes.yaml`, set at intake (default `interactive`; absent ⇒ interactive, so the field is backward-compatible). The autonomous session prompt instructs `@pm` to set it to `autonomous`. **Resolution rule (mode-aware):** in `autonomous` mode, a detected `spec_coverage_gap` for a modified feature area is **resolved within the change** — `@doc-syncer` (or a delegate it owns) **authors** the missing `doc/spec/features/feature-<slug>.md` (promoting advisory → required for the *first* spec of an area that has none; existing specs are still just reconciled). `interactive` mode is byte-for-byte unchanged (advisory + human-gated follow-up ticket). The "PM never creates tickets autonomously" rule is untouched — a spec is a doc artifact scoped to the change, reviewed at the open-PR human gate, not a durable tracker ticket.
- **Pros:** closes the gap with zero governance disruption (D5); preserves interactive de-noise (D4); the mode is durable and auditable from a committed artifact (D3); the `delivery_mode` concept is general and directly reusable by GH-111 (D2); backward-compatible (absent ⇒ interactive ⇒ current behavior) (D6).
- **Cons:** introduces a new first-class concept (`delivery_mode`) and a mode-scoped behavioral branch in doc-syncer/lifecycle/pm — slightly more machinery than a mode-independent rule; raises a model-capacity question for spec *authoring* (see Unresolved Questions).
- **Constraint compliance:** passes C-1, C-2, C-3, C-4.
- **Why chosen:** the only position that passes every constraint cleanly while honoring the ticket's explicit "mode-aware" framing and setting up a reusable precedent for GH-111. (D1, D2, D3, D4, D5)

### Alternative 2 — Mode-independent rule + author the spec in-change

- **Summary:** Drop the formal mode concept entirely. Adopt one universal rule: every detected `spec_coverage_gap` **must be resolved** (feature spec authored in-change OR an explicit recorded deferral), regardless of mode. Interactive humans "explicitly close/defer"; autonomous runs author (no human to defer to). (This is the strongest KISS challenger.)
- **Pros:** simplest — no detection, no new field, no branching; the *same* rule fires in both modes.
- **Cons:** it **changes interactive-mode behavior**: today an interactive run merely *reports* the gap and *proposes* a follow-up (advisory, non-blocking); under this alternative every interactive change gains a new forced resolution interaction (author-or-defer) that did not exist before — a regression of the de-noise design the ticket says must be preserved.
- **Constraint compliance:** **fails C-3** unless treated as an accepted-risk exception — but C-3 is marked `negotiable: no` (the ticket explicitly scopes out reverting de-noise), so the exception is **not permitted**. (D4)
- **Why rejected:** it cannot satisfy C-3 without an impermissible exception. It is the elegant answer to a *different* problem (one the ticket deliberately took off the table). Noted as the cleanest fallback *if* the project later decides to unify interactive behavior.

### Alternative 3 — Explicit `delivery_mode` + PM auto-creates follow-up ticket (the literal AC-2 option ii)

- **Summary:** Same `delivery_mode` signal as ALT-1, but in autonomous mode `@pm` **auto-creates the follow-up tracker ticket** (literal option ii) instead of authoring a spec in-change.
- **Pros:** faithful to one literal reading of AC-2 option (ii); the gap is recorded durably in the tracker.
- **Cons:** **overrides the hard governance rule** "PM must NEVER create new tickets autonomously" — carving an autonomous-mode exception into a rule the repo treats as non-negotiable. It also re-introduces de-noise risk (auto-created tickets clutter the backlog) and removes the human ticket-creation gate. For marginal benefit: ALT-1 already closes the coverage gap without touching governance.
- **Constraint compliance:** **fails C-1** (`negotiable: no`) — disqualifying.
- **Why rejected:** governance-disqualifying, and unnecessary given ALT-1 achieves coverage without it. (D5)

> **Not analyzed as standalone:** "Infer mode from session tooling (env var/marker set by `opencode-session.sh`)" (the brief's option C). It is **disqualified by C-4** off the bat: it is unavailable in manual `@pm` invocations and brittle across entry points, so it is not evaluated as a viable position.

## Decision

Adopt **Alternative 1**. The two coupled decisions resolve as follows.

### D1 — Mode representation: explicit, auditable `delivery_mode`

- **Mechanism:** a per-change field `delivery_mode: interactive | autonomous` in `chg-<workItemRef>-pm-notes.yaml`, set by `@pm` at intake (step 3 / clarify_scope).
- **Defaults & backward compatibility:** default `interactive`; an **absent** field is treated as `interactive` (identical to today), so existing change folders and manual runs need no migration.
- **Who sets `autonomous`:** the autonomous session entry point. Concretely, `scripts/opencode-session.sh`'s autonomous prompt (`default_prompt_for()`) instructs `@pm` to set `delivery_mode: autonomous` in pm-notes; `@pm` owns the write (it already creates the file). No new tooling surface is added to the session script beyond the prompt instruction.
- **Why this signal:** it is durable (committed artifact), auditable (inspectable post-hoc per change — D3), works across all entry points including manual `@pm` invocations (C-4), and is general enough for GH-111 to mirror (D2).

### D2 — Governance tension: author the spec IN-CHANGE (option i); the ticket-creation rule stays intact

- **Resolution rule (mode-aware):** in `autonomous` mode, a detected `spec_coverage_gap` for a modified feature area is **resolved within the change** — the missing `doc/spec/features/feature-<slug>.md` is **authored** (advisory → required for the *first* spec of a feature area that has none; an existing spec continues to be merely reconciled). `interactive` mode is unchanged: report → PM proposes a follow-up → **only the human** approves ticket creation.
- **Why this resolves the governance tension cleanly:** authoring a feature spec is a *natural promotion* of an existing doc-syncer capability (`doc/spec/**` is already in its write-allowlist; it already reconciles specs), not a new power and not a tracker ticket. A spec is a doc artifact scoped to the change that is human-reviewed at the open-PR gate — so the human gate is preserved (just relocated to PR review, which autonomous delivery already mandates). The "PM must NEVER create new tickets autonomously" rule (C-1) is preserved verbatim: **no agent creates a tracker ticket in any mode.**
- **Ownership of authoring:** `@doc-syncer` owns the gap-detection and the resolution requirement (it already runs the coverage check and owns `doc/spec/**` writes). Whether doc-syncer authors the spec directly or delegates the authoring to a stronger model / `@coder` (its current tier is haiku/scoped) is an **implementation detail for the plan** — the *decision* is that the gap is closed in-change in autonomous mode.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies **all** constraints C-1 through C-4:
- **C-1** — no agent creates a tracker ticket in any mode; the rule is preserved verbatim. ✅
- **C-2** — in autonomous mode the gap is resolved in-change (spec authored) with no mid-flight human wait. ✅
- **C-3** — interactive mode is byte-for-byte unchanged (advisory + human-gated follow-up). ✅
- **C-4** — `delivery_mode` lives in a committed, pm-owned artifact readable from any entry point. ✅

No accepted-risk exceptions are recorded; no negotiable constraint is violated.

## Trade-offs & Consequences

### Positive Outcomes

- The coverage gap actually closes in autonomous delivery — modified feature areas acquire/update a feature spec (D1).
- The de-noise design is preserved for humans (D4); interactive users see no behavioral change.
- The "PM never creates tickets autonomously" governance rule is reaffirmed, not weakened (D5) — the tension is resolved in favor of governance.
- `delivery_mode` becomes a reusable, auditable concept: sibling GH-111 mirrors the same pattern and can extract a shared rule (D2, D3).

### Negative Outcomes

- A new first-class concept (`delivery_mode`) and a mode-scoped behavioral branch are introduced into doc-syncer / change-lifecycle / pm — modest added complexity vs a mode-independent rule.
- Autonomous-authored feature specs may be lower-quality than human-authored ones at first; mitigation = the open-PR human review gate + the ability to refine later.
- Model-capacity risk: spec *authoring* may exceed doc-syncer's current (haiku/scoped) tier (see Unresolved Questions).

### Unresolved Questions

- [ ] **Model capacity for authoring (owner: plan-writer / @coder at GH-108 delivery):** does `@doc-syncer` (haiku/scoped) author a full feature spec adequately, or should authoring be delegated to a stronger model / `@coder` while doc-syncer retains detection + the requirement? The decision is mode/rule-level; this is an implementation choice.
- [ ] **Shared-rule extraction with GH-111 (owner: @decision-advisor when GH-111 runs):** when GH-111 extracts the shared mode rule, confirm `delivery_mode` in `pm-notes.yaml` remains the canonical signal (vs promoting it elsewhere) and reconcile this record if the representation changes.
- [ ] **Scope of "feature area" authoring (owner: spec-writer):** the operational definition of "feature area" (already in `doc-syncer.md`) governs *when* authoring fires; the spec should restate it crisply so autonomous authoring doesn't over-fire on routine edits.

## Implementation Plan

*(High-level only — the plan-writer owns task-level detail. No agent/guide/spec edits are made by this record.)*

1. **Mode signal (D1):** add a `delivery_mode` facet to the pm-notes structure (default `interactive`; absent ⇒ interactive); instruct `@pm` intake to set it; have the autonomous session prompt (`default_prompt_for()`) direct `@pm` to set `autonomous`.
2. **Mode-aware resolution rule (D2):** in `.opencode/agent/doc-syncer.md`, make the spec-coverage handoff mode-aware — in `autonomous` mode a gap is resolved in-change (missing feature spec authored); interactive behavior unchanged. Mirror the wording in `doc/guides/change-lifecycle.md` Phase 7 and `.opencode/agent/pm.md` step 3.
3. **Governance preservation:** confirm `.ai/agent/pm-instructions.md` "PM must NEVER create new tickets autonomously" is untouched and that no path creates a tracker ticket.
4. **Reconciliation:** update `doc/spec/features/feature-delivery-lifecycle.md` to describe the mode-aware resolution.
5. **Visibility (AC-4):** add a feature-specs-present vs changes-touching-feature-areas signal so the fix is observable.
6. **Rollout guardrail:** the first autonomous run after landing should be inspected to confirm a modified feature area with no prior spec now yields an authored spec.

## Verification Criteria

- **C-2 target:** an autonomous delivery run (`delivery_mode: autonomous`) over a modified feature area with no prior `feature-<slug>.md` produces one — measured by a 1-change demonstration. Window: GH-108 PR + first real autonomous run.
- **C-1 target:** zero tracker tickets created by any agent in autonomous mode; `pm-instructions.md`/`pm.md` retain the rule with no exception — audit at PR review.
- **C-3 target:** an interactive run (`delivery_mode: interactive` or absent) behaves identically to pre-change (advisory + human-gated follow-up; no new blocking prompt) — audit at PR review.
- **C-4 target:** a manual `@pm` invocation reads the same `delivery_mode` signal as an `opencode-session.sh` run — demonstration.
- **AC-4 target:** the feature-specs-present / changes-touching-feature-areas ratio is computable and non-zero for autonomous runs.

## Confidence Rating

**Medium-High.** The resolution path is a natural promotion of an existing doc-syncer capability over a write surface it already owns, and the autonomous terminal human gate (open PR) already exists. The main residual uncertainty is operational (model capacity for *authoring*, and the shared-rule extraction with GH-111) — both are flagged with owners and neither undermines the rule-level decision.

## Lessons Learned (Retrospective)

TODO: Populate after GH-108 ships and at least one autonomous run exercises the mode-aware resolution.

## Examples & Usage

**Applicability to sibling #111.** GH-111 ("operational guides trigger") faces the structurally identical defect: a doc-handoff rule that assumes a reachable human, silently no-opping in autonomous delivery. This record's pattern is intended to be reused verbatim: (1) read `delivery_mode` from `pm-notes.yaml`; (2) in `autonomous` mode, resolve the gap in-change (author/trigger the doc) rather than only reporting; (3) leave interactive mode's human-gated behavior untouched; (4) preserve the relevant governance rule. When GH-111 runs, `@decision-advisor` should extract the shared mode-aware-resolution rule and reconcile this record to the shared form (revisit trigger).

## References

- Ticket: GH-108 (doc-syncer reliability — specs/guides must actually fire post-merge); epic #107.
- Sibling ticket: GH-111 (operational guides trigger — mirrors this pattern).
- Shipped authority (current behavior): `.opencode/agent/doc-syncer.md` `<rules>` ("Spec-coverage handoff (report, never ticket)") + `<reporting>` `spec_coverage_gaps`; `.opencode/agent/pm.md` step 3 (coverage awareness "advisory only — not a delivery blocker"); `doc/guides/change-lifecycle.md` Phase 7 (coverage "does not block the change").
- Governance rule: `.ai/agent/pm-instructions.md` ("PM must NEVER create new tickets autonomously").
- Autonomous entry point: `scripts/opencode-session.sh` `default_prompt_for()` (runs `@pm` end-to-end, stops at open PR; sets no mode signal today).
- De-noise design origin: GH-78 / GH-79 (commit `1e2e7ff` "spec-coverage gate + feature-spec debt paydown").
- Change artifacts: `doc/changes/2026-07/2026-07-02--GH-108--doc-syncer-reliable-spec-coverage/chg-GH-108-pm-notes.yaml` (open questions routed to `@decision-advisor`).
- System spec: `doc/spec/features/feature-delivery-lifecycle.md`.
