---
id: PDR-0005
decision_type: pdr
status: Proposed
created: 2026-11-14
decision_date: null
last_updated: 2026-11-14
summary: "The milestone is the enforced unit of planning and delivery: a milestone record and every ticket attached to it exist in the tracker before work starts, every new change ticket is attached at creation (agents propose milestones, never create them), intake verifies attachment before artifact phases, and a non-blocking event-driven check flags an unattached change issue with one label and one marked comment."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_scope: repo
review_date: null
business_impact: "Governs how the repository plans and starts work: planned scope becomes a checkable precondition for unattended delivery runs, and every future ticket is created inside a milestone."
customer_impact: "Adopters inherit the operating rule through the redistributable milestone-management guide and through bootstrapped tracker instructions; the flagging workflow stays repository-local and is not installed."
classification:
  domains: [product, governance, process, agents, documentation]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (subagent session, consulted by @pm for GH-313 under spec DEC-5)"
  decider: "Juliusz Ćwiąkalski — owner and author of the 2026-11-12 directive; PM-adopted for the GH-313 autonomous run, owner ratifies or vetoes at the GH-313 open-PR gate (per repo convention, R2 records stay Proposed until a human explicitly decides)"
  contributors:
    - "@pm (ticket-creation and intake surfaces, enforcement scope, DEC-1..DEC-12)"
    - "@spec-writer (change-spec milestone field, DM-1..DM-5)"
    - "Juliusz Ćwiąkalski (owner directive of 2026-11-12: plan in milestones, then run unattended)"
  reviewers:
    - "Juliusz Ćwiąkalski (GH-313 PR review — ratify or veto)"
    - "@decision-critic (optional independent challenge; R2)"
  performers:
    - "@coder (GH-313 delivery — guide, prompts, template, check, planning truth)"
    - "@pm (M0/M1/M2 tracker evidence; any attachment write confirmed with the human)"
  informed:
    - "Future ticket authors and every delivery agent (the rule binds all new work)"
    - "GH-139 (later extends the same guide with MS- pre-fixed identifiers and the allocation matrix)"
    - "Adopters of the redistributable guide and of generated tracker instructions"
ai_assistance:
  used: true
  roles: [researcher, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "At M2 exit: if the non-blocking flag does not sustain attachment at creation (measured unattached-new-ticket count stays above zero across several tickets), escalate to the deferred mechanical intake refusal or the issue-form/auto-attach path."
  - "Adopters ask for the check as installable automation — decide workflow distribution as a separate change; this record's enforcement stays repository-local until then."
  - "GH-139 lands MS- pre-fixed roadmap identifiers and the allocation matrix — the naming rule here is re-read for compatibility (title prefix vs identifier) and the guide is reconciled, not split."
  - "GitHub ships a required-field or enforced-milestone capability for issues — re-evaluate the label-plus-comment mechanism against the native construct."
  - "The capture exemption grows into the default (exempt population rising across milestones) — treat as a rule failure and reopen this decision rather than adjusting the vocabulary."
  - "A second tracker (Jira) is adopted for this repository — the milestone-equivalent field, its event semantics, and the check's decision table are re-derived per tracker instructions."
links:
  related_changes: ["GH-313"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-14--GH-313--milestone-first-planning/chg-GH-313-spec.md"
    - "doc/planning/oss-tooling/backlog.md"
    - "doc/planning/oss-tooling/roadmap.md"
    - "doc/planning/oss-tooling/milestones/README.md"
  contracts: []
  diagrams: []
  decisions: ["PDR-0004", "ODR-0002"]
  experiments: []
  metrics: []
  roadmap_items: ["M2-S20", "GH-139"]
---

# PDR-0005: Milestone-First Planning and Delivery — Tracker-Attached Scope Before Work Starts

## Context

The repository plans in milestones (M0 #1, M1 #2, M2 #3) and delivers them with AI agents, but it plans them **by convention, not by rule**. Four facts describe the state before this decision (verified in-repo on 2026-11-14 as recorded in `chg-GH-313-spec.md` §2.1):

- **The milestone exists and is the planning unit.** M0 (#1) closed 20 tickets; M1 (#2) closed 24 including the planning umbrella #219; M2 (#3) holds 23 tickets. Titles follow an `M<n>:` prefix (`M2: Ceremonies, measurement, and memory`) and story codes embed the same prefix (`M2-S18`), so the prefix is the durable human identifier while the tracker's milestone number is the API handle. The committed planning corpus (backlog, suggested-order file, milestone packs) is the canonical statement of scope.
- **The lifecycle around the milestone is undocumented.** The pack index states pack conventions only. There is no written rule for naming, creation, attachment, entry review, planned-scope definition, exit review, closure, or for scope discovered mid-milestone. The entry review that precedes an unattended run exists only as owner practice.
- **The ticket path carries no milestone at all.** The `@pm` tracker instructions create a ticket with title, body, and labels; the `@pm` prompt lists the same three arguments; intake resolves the work item without checking attachment; the change-spec template has no milestone field; and the `@bootstrapper` guidance that generates a new project's tracker instructions carries no milestone section either, so bootstrapped projects inherit the gap. The tracker MCP already supports an optional milestone argument — the capability exists and is simply not used.
- **Nothing notices an orphan.** The repository's workflows are CI, a PR-base guard, release, and a scheduled conformance run: no issue-event automation exists. 94 `change` issues currently carry no milestone (53 open), and they must not be treated as new debt.

The trigger is the owner directive of **2026-11-12**: plan in milestones, then let agents run **unattended for days to one to two weeks** to deliver a planned scope. That operating mode inverts the cost structure of a missing milestone. Today an orphan ticket costs a planning conversation at some later point; under an unattended run it costs the run — scope is discovered only after work starts, the milestone record cannot state its own completeness, and the owner cannot answer "is this scope self-contained?" from the tracker.

Two prior artifacts constrain the shape of the answer. **PDR-0004** established the house convention this record follows: a change-scoped PDR stays `Proposed` with `decision_date: null` until a human decides at the open-PR gate. **ODR-0002** (ID-prefix scheme and project catalog) already owns the identifier vocabulary that GH-139 extends, which is why this decision deliberately excludes roadmap `MS-<NNNN>` identifiers and the allocation matrix.

## Problem Framing (Clarified)

**Decision question:** *how should the repository make "a milestone and all its linked tickets exist before work starts" an enforceable operating rule — enforced where an orphan is still cheap to fix, with a signal precise enough to survive legitimate backlog capture and historical debt — while adding no new service, no tracker feature, no credential, and no network dependency to the deterministic gates?*

The root cause is not a missing template field or a missing label. It is that **the milestone is a planning convention with no attachment point in the creation path and no observer anywhere in the repository**. A change ticket can be born without a milestone, travel the full 11-phase lifecycle, and surface only when someone reads the tracker by hand. Every symptom in the spec follows from that single structural gap:

- **GAP-2/GAP-3:** creation does not attach, intake does not verify — the two cheapest interception points are unguarded.
- **GAP-4/GAP-5:** with no observer and no vocabulary, an accidentally orphaned ticket and a deliberately captured backlog idea are indistinguishable, so any enforcement that *does* observe would either fire on both or on neither.
- **GAP-1/GAP-6/GAP-7:** an undocumented lifecycle plus an artifact that does not declare its milestone means the spec, the pm-notes record, and the tracker can disagree while each surface looks correct in isolation.
- **GAP-8/GAP-9:** "every planned ticket was planned" is an assumption for M0 and M1, and a bootstrapped project starts with the same assumption.

Two framings were rejected as symptoms rather than causes. *"Add a required field to the spec template"* fixes only the artifact side and leaves creation and observation untouched. *"Make CI fail on an unattached ticket"* converts a governance gap into a delivery outage, which the owner directive cannot absorb: unattended runs must not stall on tracker bookkeeping, and historical debt would fail unrelated work.

The reframed problem is therefore a **three-point enforcement design**: attach at creation (where the orphan is born), verify at intake (where it is still free to fix), and observe continuously without blocking (so debt is visible and new drift is noticed). The escape hatch is part of the design, not an exception to it — a rule with no legitimate way to capture an unplanned idea would be routed around within a week.

## Constraints (Hard Requirements)

Table stakes, acknowledged once: no new credential is provisioned (the workflow uses its own token); the generated Claude Code plugin stays fresh after prompt edits; the documentation-distribution marker guard and `pnpm check` stay green; and no feature code ships in `packages/**`. Every alternative below inherits these.

### C-1: The aggregate gate stays offline and deterministic

- **Statement:** No tracker read or write enters `pnpm check` or any of its eight chained steps; the chain, its order, and its offline determinism are unchanged.
- **Source:** internal standard (spec NFR-2, DEC-2; `package.json` `check` script; project priority "determinism").
- **Verification:** test (`AC-NFR2-1`: zero tracker calls; chain order unchanged) + code review.
- **Negotiable:** no

### C-2: No autonomous ticket or milestone creation, and no autonomous issue mutation

- **Statement:** The rule may not let an agent create a milestone or a ticket, and enforcement may write only a flag label and at most one marked comment to an issue — never a state change, assignee, milestone write, or any other label.
- **Source:** prior decision (`.ai/agent/pm-instructions.md` "PM must NEVER create new tickets autonomously") + AC (spec DEC-8, §8.1 "explicitly absent" list, NG-3).
- **Verification:** code review + offline decision-table tests (`AC-F3-1`, `AC-F3-2`).
- **Negotiable:** no

### C-3: Historical debt is never mutated, blocked, or reclassified

- **Statement:** Pre-existing unattached issues and historical change artifacts are reported only: no mass label, no mass attach, no edit, no block, no backfill. This is structural, not policy: the evaluation is a fixed order in which every zero-write verdict precedes any write — an issue that is not open or not `change` is `out-of-scope`; the capture exemption is `exempt` and outranks milestone and flag; a present milestone is `compliant` and only removes the flag. A write is reachable only when a milestone is absent, and then the flag is added only on `opened` (with at most one marker comment, and only when the marker is absent) or on `demilestoned` when the marker already exists. Edits, label or unlabel events, and reopens on an unflagged pre-existing issue are `out-of-scope` with zero writes, and a human-removed flag is never re-added outside those two paths. The advisory sweep performs exactly zero tracker writes. Any enforcement must distinguish new drift from existing debt structurally, not by a one-off cleanup.
- **Source:** AC (spec NG-5, NG-7, DEC-1, RSK-1; F-3 ordered evaluation).
- **Verification:** code review of the ordered evaluation + offline tests asserting a zero-write verdict for every out-of-scope, exempt, and compliant row, including the pre-existing-edit case and the no-reapply rule + audit (`AC-F3-5`: sweep performs exactly 0 tracker writes).
- **Negotiable:** no

### C-4: Redistributable text carries no repository-specific governance

- **Statement:** Any document that ships to adopters (the guide, the generated tracker instructions) must state the rule tracker-agnostically and must not reference this repository's ticket numbers, milestone numbers, or internal tracking; the enforcement workflow stays repository-local.
- **Source:** internal standard (`.ai/agent/decision-instructions.md` "Redistributable" key constraint; spec NG-9, NFR-4).
- **Verification:** code review + distribution drift guard.
- **Negotiable:** no

### C-5: Attachment identity must be a tracker-native milestone record

- **Statement:** The identity of "which plan is this ticket in" is the tracker's own milestone record, observed through the tracker's native fields and events (milestone present/absent, milestone attached/detached). No proxy object (an umbrella issue, a label as milestone, a body checklist) may serve as the attachment identity.
- **Source:** AC (spec F-3 event classes, DM-5; §2.1 milestone titles and numbers are the existing precedent).
- **Verification:** code review of the evaluation inputs + interface contract (`§8.1`).
- **Negotiable:** no

### C-6: Enforcement never blocks delivery

- **Statement:** No part of the rule may stop or fail a delivery: the flag is not a required status, intake stops only to ask the human for a decision, and no delivery entry script refuses an unattached ticket.
- **Source:** AC (spec DEC-8 "the flag never blocks work", NG-8) + owner directive of 2026-11-12 (unattended runs must not stall on bookkeeping).
- **Verification:** audit (workflow is not in required checks; no bypass construct; entry scripts unchanged) + code review.
- **Negotiable:** no

## Decision Drivers

**Product / governance drivers:**

1. **D1 — Unattended-run readiness (highest).** The point of the directive is days-to-weeks runs without new planning decisions. The precondition must be *answerable from the tracker* before a run starts: milestone open, conventional title, every planned ticket attached.
2. **D2 — Signal precision over coverage.** A governance signal that fires on legitimate backlog capture or on 94 historical issues is ignored within a week and takes the rule with it. Precision is the driver; coverage is worthless if it costs precision.
3. **D3 — Enforcement at the cheapest point.** Attach at creation, verify at intake. Detecting an orphan after delivery costs the run; detecting it at creation costs one dropdown.
4. **D4 — Owner authority over scope.** A milestone *is* a scope commitment. Agents may propose; the human decides. This is the same authority boundary as the existing no-autonomous-ticket rule, applied to the planning unit.
5. **D5 — Adoption reach without distribution risk.** The rule should reach bootstrapped projects as documentation and generated instructions, while repo-specific automation stays home.

**Operational / technical drivers:**

6. **D6 — Paved road and one source of truth.** Use tracker primitives that already exist (milestone records, labels, issue events); state the procedure once in one guide and point at it from everywhere else; add no service, secret, or required check.
7. **D7 — Reversibility and low ceremony.** The rule must be cheap to undo: labels are two clicks, prompt and guide edits revert as files, the workflow can be disabled without touching a single ticket. Consistent with "reversibility trumps theoretical optimality".
8. **D8 — Legibility.** A flagged issue must explain itself (why flagged, what fixes it, who is not blocked) and every evaluation must be answerable from its run record, so the rule can be audited by a human who did not write it.

Priority order: **D1 > D2 > D3 > D4 > D6 > D7 > D5 > D8.** D1 and D2 are near-incompatible at the extremes — maximum coverage (flag everything) destroys precision, maximum precision (flag nothing unattached) loses D1. The decision lives in that tension.

## Decision Rights (DACI)

- **Driver:** @decision-advisor (subagent session, consulted by @pm for GH-313 under spec DEC-5).
- **Decider / Approver:** Juliusz Ćwiąkalski (owner), author of the 2026-11-12 directive. Per repo convention an R2 record stays `Proposed` until the owner explicitly decides; for the GH-313 autonomous run it is **PM-adopted pending owner review at the open-PR gate** (ratify or veto there). This record asserts no acceptance.
- **Contributors:** @pm (creation and intake surfaces, failure modes, DEC-1..DEC-12); @spec-writer (artifact field and DM-1..DM-5); the owner directive itself (the operating-mode intent this instrument serves).
- **Required reviewers:** owner at the GH-313 PR review; @decision-critic optional at R2.
- **Performers:** @coder (guide, prompts, template, check, planning truth); @pm for the M0/M1/M2 tracker evidence, with any attachment write confirmed by the human.
- **Informed:** every current and future delivery agent and ticket author; GH-139 (extends the same guide); adopters who receive the redistributable guide and generated tracker instructions.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Milestones M0 (#1, 20 tickets, closed), M1 (#2, 24 tickets incl. #219, closed) and M2 (#3, 23 tickets, 11 open / 12 closed at planning time) are the planning unit, with `M<n>:` title prefixes and matching story codes | FACT | spec §2.1 (verified against the tracker at planning); roadmap milestone table | The naming rule and the entry-review criteria would need re-derivation | High |
| 94 `change` issues carry no milestone (53 open) and are historical/backlog, not new drift | FACT | spec §2.1 (tracker read at planning) | A blocking or sweeping enforcement would mass-flag real tickets; C-3 becomes the deciding constraint | High |
| No issue-event automation exists; workflows are CI, PR-base guard, release, and scheduled conformance | FACT | `.github/workflows/` listing (ci, conformance-live, pr-base-guard, release) | An existing observer would make ALT-0 partially viable and ALT-6 cheaper | High |
| `pnpm check` chains lint → format → typecheck → test → boundaries → three invariant checks, all offline | FACT | `package.json` `check` script | C-1 could be satisfied inside the gate and ALT-1 becomes nearer-eligible | High |
| Ticket creation currently passes title, body, and labels only; the tracker MCP has an optional milestone argument | FACT | `.ai/agent/pm-instructions.md`; `.opencode/agent/pm.md` lines 509-510 | The capability gap would be larger (new adapter work), exceeding this decision's scope | High |
| Intake does not verify attachment today; pm-notes already supports an optional `milestone` key | FACT | `.opencode/agent/pm.md` intake path; delivered pm-notes schema | A new artifact field would be required, changing F-4 cost | High |
| The change-spec template has no milestone field and `@spec-writer` has no rule for one | FACT | `doc/templates/change-spec-template.md` front matter | F-4 would be a no-op | High |
| `@bootstrapper` guidance for generated `.ai/agent/pm-instructions.md` lists mandatory sections and no milestone section | FACT | `.opencode/agent/bootstrapper.md` | Bootstrapped projects inherit the gap; D5 weakens | High |
| The planning corpus has drifted: 12 M2 stories lack `Ticket:` lines, M2-S20 has no block, ranking omits nine M2 stories | FACT | spec §2.1; `backlog.md`, `backlog-ranking.md` | The corpus cannot serve as the attachment mirror this rule presumes | High |
| The tracker supports milestone fields on issues, milestone attach/detach events, label writes, and comment reads/writes scoped to `issues: write` | ASSUMPTION | GitHub Issues platform behaviour; spec §12 | The whole F-3 mechanism needs a different trigger; ALT-6 becomes not eligible | Medium-High |
| Existing `M0:`/`M1:`/`M2:` titles remain the naming precedent; no renumbering is needed | ASSUMPTION | spec §12; roadmap table | Renaming work enters scope, and the field value (title verbatim) would need a migration | High |
| A non-blocking label-plus-comment flag is sufficient to sustain attachment at creation for a solo developer plus AI agents | ASSUMPTION | owner directive intent; analogy to the existing advisory review gates | If it is not sufficient, the deferred mechanical refusal or auto-attach path becomes necessary (revisit trigger; M2-exit measurement) | Medium |
| The owner directive of 2026-11-12 (plan in milestones, then run unattended for days to 1-2 weeks) remains the operating intent | ASSUMPTION | spec §13 "Enables" row; §3 problem statement | The rule's justification weakens to documentation hygiene and D1 drops, changing the ranking against ALT-2 | High |
| The public label names are `needs-milestone` (flag) and `backlog-capture` (exemption) — decided, not proposed | FACT (decided) | spec OQ-2 (resolved 2026-11-14) and DEC-8 — decided by @pm under autonomous delivery (spec DEC-5). Rationale: descriptive kebab-case names consistent with the tracker's existing label vocabulary, scoped to this check, reversible. The owner may rename either label at the open-PR gate; a rename touches the guide, the workflow, and the tracker instructions together | The decision still holds under other names — the mechanism is name-agnostic; only the three surfaces move together | High |
| Who triages the 94 pre-existing unattached issues, and over what horizon | TO-CONFIRM | spec OQ-1 (owner decision) | Debt stays visible in the sweep; no correctness impact on the rule itself | Medium |

## Mental Models & Techniques Used

- **First Principles:** separate the plan (milestone record + attached tickets), the artifact declaration (spec field), and the observer (check). Each has its own failure mode; one mechanism cannot cover all three.
- **Inversion ("what would make this rule wrong?"):** it is wrong if it fires on legitimate backlog capture (fixed by the exemption), if it blocks a delivery (fixed by non-blocking enforcement), if it punishes history (fixed by an evaluation order whose zero-write verdicts precede any write, plus a zero-write sweep), or if it can be satisfied by a lie (fixed by making the tracker record the identity, not the artifact text).
- **Second-order thinking:** a blocking gate seems stricter but produces workarounds — tickets get milestones they do not belong to, which corrupts the very data the rule protects. A precise advisory signal preserves data quality and leaves the decision with the human (D4).
- **Systems thinking:** the milestone is a join key across four surfaces (tracker, spec, pm-notes, backlog). Every alternative was judged on whether it strengthens or weakens that key, not on how loudly it enforces.
- **Opportunity cost:** an unattended run started on an incomplete scope burns days of agent time and produces an incomplete milestone record; the flag's cost is one label and one comment. The asymmetry justifies a narrow signal even at low coverage (D1 vs D2).
- **KISS / paved road:** use the tracker's own milestone construct and events; no umbrella-issue emulation, no bot service, no new required check.
- **Two-way doors:** labels, prompt text, and the workflow are all reversible; the rule was therefore not held to a "perfect-instrument" bar before being written down.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 offline gate | C-2 no autonomous creation | C-3 no historical mutation | C-4 no repo-specific distributable text | C-5 native milestone identity | C-6 never blocks |
|----------|----|----|----|----|----|----|
| ALT-0 — no rule / convention only | ✅ | ✅ | ✅ | ✅ | ❌ (no identity rule exists) | ✅ |
| ALT-1 — hard CI gate over tracker state | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| ALT-2 — periodic audit only | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 — per-milestone umbrella ticket | ✅ | ⚠️ (issue creation becomes a planning act) | ✅ | ✅ | ❌ | ✅ |
| ALT-4 — autonomous milestone creation | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 — mechanical refusal in entry scripts | ✅ | ✅ | ✅ | ⚠️ (installed scripts need per-project milestone sets) | ✅ | ❌ |
| ALT-6 — milestone-first rule + non-blocking flag (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via additional compliance work that becomes delivery scope (not an accepted-risk exception; C-4 for ALT-5 would require shipping milestone resolution logic into adopter scripts).

ALT-0's C-5 failure is deliberate: with no rule there is no attachment identity at all, only the informal practice that happens to use milestones — the constraint is unmet because nothing commits the tracker record to being the identity.

### Alternative 0 — Do Nothing / Keep the Convention (baseline)

- **Eligibility:** Not eligible (fails C-5 — no recorded attachment identity; C-1/C-2/C-3/C-4/C-6 pass vacuously).
- **Summary:** Keep planning by convention. Owners plan milestones in practice; tickets are created without milestones; nothing observes.
- **Constraint compliance:** Fails C-5. The remaining constraints pass because there is no enforcement to violate them.
- **Driver fit:** Worst on D1 (no checkable precondition), D2 (no signal exists — "precision" is zero over zero), D3, D6 (identity dispersed across artifacts and habit), D8. Cheap on D7.
- **Pros:** Zero cost; no new vocabulary; nothing to maintain.
- **Cons:** The unattended-run precondition stays unanswerable; every orphan must be found by hand; the corpus drift documented in §2.1 is the predicted steady state.
- **Why rejected:** The status quo is the problem statement. Its only advantage (zero cost) is bought at the price of the operating mode the directive requires.

### Alternative 1 — Hard CI Gate over Tracker State

- **Eligibility:** Not eligible (fails C-3 and C-6).
- **Summary:** A required workflow (or a step in the gate chain) reads the PR's linked ticket and fails the build when the ticket has no milestone; possibly extended to fail on an issue event.
- **Constraint compliance:** Fails C-6 — a required check blocks merges, which is a delivery outage for a bookkeeping gap, and it would stall unattended runs. Fails C-3 — a required check evaluates every PR, including those whose tickets predate the rule (or whose work is legitimately backlog-captured), so historical debt becomes a blocker unless per-PR exceptions are maintained by hand, which is false enforcement with extra steps. Passes C-1 only if implemented outside `pnpm check` (its network dependency would break offline determinism otherwise).
- **Driver fit:** Strong on D1 (unmissable) and D5; destroys D2 (every false positive blocks work), conflicts with D7 (a required check is a one-way operational commitment), and D4 (it removes the human from the scope decision by fiat).
- **Pros:** Maximum coverage; impossible to ignore; simplest mental model.
- **Cons:** Converts governance into an outage; requires exception machinery that recreates the problem; makes CI network-dependent; history cannot be exempted without manual bookkeeping.
- **Why rejected:** C-3 and C-6 are disqualifying. The failure it produces — blocking a run over a missing dropdown — is precisely what the directive cannot tolerate.

### Alternative 2 — Periodic Audit Only

- **Eligibility:** Eligible (passes all constraints).
- **Summary:** A scheduled (or on-demand) report lists open `change` issues without a milestone. No creation-time attachment rule, no change-spec field, no event-driven flag.
- **Constraint compliance:** All pass — read-only, offline, no mutation, tracker-native identity. It is essentially ALT-6's sweep mode with nothing else.
- **Driver fit:** Weak on D1 (the precondition is still uncheckable before a run — the report describes drift rather than preventing it), D3 (detection is late by design), D4 (no decision point exists to attach at creation), D5 (no rule for adopters to inherit). Moderate on D2 and D8.
- **Pros:** Smallest possible enforcement; zero tracker writes; trivially reversible; useful as a standing debt report.
- **Cons:** Does not attach anything at creation; an orphan can still consume the whole lifecycle; the guide and artifacts still declare nothing; drift returns between runs.
- **Why rejected:** It satisfies D2 by refusing to signal anything. The sweep is retained *inside* ALT-6 as the debt-reporting mode, which is why this alternative is recorded rather than dismissed — it is the correct subset of the rule, not the whole rule.

### Alternative 3 — Per-Milestone Umbrella Ticket Instead of a Milestone Record

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Model a milestone as a tracking issue with a body checklist (or task list) of its tickets; enforcement reads the checklist and the child-issue links; the milestone construct stays unused.
- **Constraint compliance:** Fails C-5 — the attachment identity becomes an issue-based proxy that must be parsed from a body, cannot be filtered or closed as a unit, and has no native attach/detach event to key idempotency and reversal on. Partially strains C-2 (the umbrella is a ticket, so creating milestones becomes ticket creation, colliding with the no-autonomous-ticket rule).
- **Driver fit:** Weak on D1 (completeness is a hand-maintained checklist, not a tracker fact), D2 (checklist drift produces both noise and false negatives), D6 (defeats the paved road), D8 (introspection requires parsing prose).
- **Pros:** Visible in the issue list; teams familiar with umbrella issues recognize it; no milestone vocabulary to learn.
- **Cons:** Reinvents a native construct; checklist and reality diverge silently; closure has no semantics; no events to hook; conflicts with the existing M0/M1/M2 record precedent.
- **Why rejected:** It is the one alternative that would make the signal *less* trustworthy than today's convention. The repository already uses milestone records, so this option also violates "prefer the paved road".

### Alternative 4 — Autonomous Milestone Creation

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Let the agent create a milestone when no existing one fits the ticket, removing the need for a proposal round-trip.
- **Constraint compliance:** Fails C-2 outright: a milestone is a scope commitment, and autonomous creation would let an agent invent a plan (and its name, prefix, and numbering) without owner authority. It also degrades C-5's data quality — autonomous names drift from the `M<n>` convention, which is exactly the identity the check and the story codes rely on.
- **Driver fit:** Convenient on D3 (no human round-trip) and superficially on D1 (an attachment always exists). Destroys D4 and, second-order, D2: a planner-invented milestone is a false plan, so attachment becomes a check box rather than a commitment.
- **Pros:** No blocking question at creation; fewer human touchpoints.
- **Cons:** Scope commitments made by agents; naming drift; the milestone set fragments; the same failure as autonomous ticket creation, at a larger blast radius.
- **Why rejected:** C-2 is disqualifying and the first-order convenience is exactly the wrong optimization: the value of the milestone is that a human committed to it.

### Alternative 5 — Mechanical Refusal in the Delivery Entry Scripts

- **Eligibility:** Not eligible (fails C-6; C-4 strains).
- **Summary:** Make `deliver-ticket.sh` and the CEO loop refuse to start on a ticket with no milestone, so no unattended run can begin on an orphan.
- **Constraint compliance:** Fails C-6 — a shell refusal is a blocking gate on delivery, and it fails closed at the worst moment (mid-batch, possibly overnight, with no human present to attach). Strains C-4: the scripts ship to adopters, so milestone resolution and vocabulary would have to be configurable per project, enlarging the installed surface far beyond this decision. Passes C-1, C-2, C-3, C-5.
- **Driver fit:** Strong on D1 when it triggers correctly (nothing starts), and directly aligned with D3's "detect early". Poor on D7 (a refusal path in delivery infrastructure is hard to walk back once relied on) and on D8 (an overnight stall is not legible).
- **Pros:** Unmissable precondition; no tracker automation at all; the enforcement point is exactly the run boundary.
- **Cons:** Fails closed without a human; requires every entry path to carry the logic; pushes per-project configuration into installed scripts; duplicates what intake already checks.
- **Why rejected:** C-6 is disqualifying, and intake already provides the same check while a human is present. Retained as the named escalation if the advisory signal proves insufficient (spec §7.3; revisit trigger at M2 exit).

### Alternative 6 — Milestone-First Rule with Event-Driven Non-Blocking Flag (CHOSEN)

- **Eligibility:** Eligible (passes every constraint).
- **Summary:** One operating rule, stated once in a redistributable guide and enforced at three points: **attach at creation** (tracker instructions and `@pm` prompt require a milestone resolved from the existing set; a missing milestone is proposed to the human, never created), **verify at intake** (the `@pm` records the milestone in pm-notes and asks before artifact phases when it is absent), and **observe without blocking** (an issue-event workflow flags a `change` issue that has no milestone and no capture exemption with one label and one marked comment, reverses on attachment, and offers a zero-write advisory sweep for historical debt). The change spec declares the milestone; the bootstrapper carries the rule into new projects.
- **Constraint compliance:** All pass. C-1: the check is workflow-only, `pnpm check` is untouched. C-2: the only writes are one label and one comment, and no agent creates a milestone. C-3: the canonical order puts every zero-write verdict first (`out-of-scope`, `exempt`, `compliant`) and reaches a flag only on `opened` or on `demilestoned` with an existing marker, so a pre-existing unattached issue is never written by an edit, relabel, unlabel, or reopen; the sweep is read-only, so the 94 historical issues are never written. C-4: the guide is tracker-agnostic and carried by the marker-derived install set while the workflow stays repo-local. C-5: the milestone record is the identity, observed through native fields and events. C-6: the flag is not a required status, the sweep never fails, and no entry script refuses.
- **Driver fit:** Best overall. D1 by construction (the entry review is a written checkable precondition). D2 via the capture exemption and the ordered zero-write verdicts. D3 (creation + intake). D4 (agents propose, owner decides). D5 (guide + generated instructions). D6 (one guide, native primitives, no service). D7 (labels revert in two clicks, files revert as files). D8 (static comment naming the guide and the escape; one verdict and its writes named in one job summary per run).
- **Pros:** Precise and reversible; no new credential, service, or gate; debt stays visible without being punished; bootstrapped projects inherit the rule; the flag is legible to a human who has never read the workflow.
- **Cons:** Non-blocking means an orphan can still be delivered if a human ignores the flag; two new public label names must be maintained; guide, prompts, and workflow must move in lockstep; the exemption can erode the rule if it becomes the default.
- **Why chosen:** It is the only alternative that satisfies all six constraints while serving the top three drivers. Its residual weakness (advisory rather than blocking) is a deliberate trade of enforcement strength for data quality and run continuity, with a named escalation path if the signal proves insufficient.

## Decision

- **Decision:** **Alternative 6.** Adopt the milestone-first planning and delivery operating rule:
  1. **Plan in milestones.** A milestone record and all of its linked tickets exist in the tracker *before* work starts on the planned scope. Once that precondition holds, agents run unattended for days to one to two weeks to deliver the scope. The guide states the precondition; the milestone pack conventions point at it.
  2. **Attach at creation.** Every new `change` ticket is attached to a milestone at creation, resolved from the project's existing milestone set. An agent **never** creates a milestone autonomously: a missing milestone is proposed to the human exactly as a proposed ticket would be.
  3. **Verify at intake.** Intake confirms the attachment and records the milestone in pm-notes before artifact phases begin. An unattached ticket produces a question naming the milestone the PM proposes; artifact phases start only after the attachment exists.
  4. **Observe without blocking.** An event-driven repository check evaluates a fixed input set — the action (`opened | edited | labeled | unlabeled | milestoned | demilestoned | reopened`), the issue state, the `change` label, the exemption label, the milestone, the flag label, and `markerCommentPresent` — in one canonical order: **(1)** not open or not `change` → `out-of-scope`, zero writes; **(2)** exemption present → `exempt`, zero writes, outranking milestone and flag; **(3)** milestone present → `compliant`, removing the flag if present and posting no comment; **(4)** milestone absent → the flag (`needs-milestone`) is added only on `opened` (with one marker comment, posted only when the marker is absent) or on `demilestoned` when the marker already exists; edits, label or unlabel events, and reopens on an unflagged pre-existing issue are `out-of-scope` with zero writes, and a human-removed flag is never re-added outside those two paths. A documented capture-exemption label (`backlog-capture`) marks pure backlog capture. Every run writes one job summary to `$GITHUB_STEP_SUMMARY` naming the issue, the verdict, and the writes performed. A manual advisory sweep reports pre-existing unattached debt with zero tracker writes.
  5. **The exemption is a capture marker, never a delivery licence.** An exempted ticket must still be attached before its lifecycle starts.
  6. **Naming and lifecycle.** A milestone title is `<M<n>>: <human-readable outcome phrase>`; the tracker milestone record is the identity source of truth for state and attachment. Creation, entry review, planned-scope definition, exit review, closure, and extension/reopening when scope is discovered are documented once in the guide; a closed milestone is an immutable record, and a reopened one repeats the entry review.
  7. **Declare the milestone on the artifact.** `change.milestone` is a required change-spec field whose value is the tracker milestone title verbatim (equal to the pm-notes `milestone`), with the literal `none` permitted only where a project's tracker instructions declare no milestone construct.
  8. **Explicit non-goals.** This decision does **not** adopt `MS-<NNNN>` roadmap identifiers, the roadmap allocation matrix, or an ID-prefix catalog (GH-139 and its follow-ups, ODR-0002's vocabulary); it creates no framework-wide ticket-creation change; and it performs no mass-labelling or triage of historical issues.
- **Rationale (tied to drivers):** The rule makes the unattended-run precondition a checkable tracker fact (D1) while keeping the signal precise enough to survive legitimate capture and historical debt (D2). It enforces where an orphan is cheap to fix — creation and intake (D3) — and leaves every scope commitment with the owner (D4). It uses tracker primitives and one guide rather than a service or a required check (D6), and it stays reversible by construction (D7) while reaching adopters as documentation (D5) and staying legible per event (D8). Alternatives 1 and 5 fail the never-blocks constraint; alternative 4 fails the owner-authority constraint; alternative 3 fails the native-identity constraint; alternatives 0 and 2 pass the constraints but fail D1 and D3, which are the drivers the directive exists to satisfy.
- **Decider:** Juliusz Ćwiąkalski (owner). PM-adopted for the GH-313 autonomous delivery run under spec DEC-5; the owner ratifies or vetoes at the GH-313 open-PR gate. This record remains `Proposed` with `decision_date: null` until that human decision.
- **Conditions for revisit:** See `revisit_triggers` — M2-exit measurement of attachment at creation; adopter demand for the check as installable automation; GH-139's `MS-` identifiers; a native tracker required-field capability; exemption growth; a second tracker.

### Constraint Compliance Attestation

The chosen alternative (ALT-6) satisfies all constraints C-1 … C-6: the aggregate gate keeps its eight-step offline chain with zero tracker calls (C-1); the only tracker writes are one flag label and at most one marked comment, and no agent creates a milestone (C-2); the canonical order makes the zero-write verdicts structurally prior — `out-of-scope`, `exempt`, and `compliant` are decided before any write, a flag is reachable only on `opened` or on `demilestoned` with an existing marker, and the advisory sweep is zero-write — so historical issues and artifacts are never mutated, blocked, or reclassified (C-3); redistributable content is tracker-agnostic and carries no repository-specific governance while the workflow stays repo-local (C-4); attachment identity is the tracker's native milestone record observed through native fields and events, including reversed attach/detach handling (C-5); and no required check, entry-script refusal, or blocking gate is introduced (C-6). No accepted-risk exceptions are recorded.

## Trade-offs & Consequences

### Positive Outcomes

- **The unattended-run precondition becomes answerable.** "Is this scope self-contained?" is answered by the milestone record plus its attachment set, not by owner memory — the direct enabler of the 2026-11-12 operating mode.
- **Orphans are intercepted at the cheapest points.** Creation carries the dropdown; intake asks one question; after that the cost curve rises steeply, which is why enforcement lives there.
- **The signal survives contact with reality.** The exemption, the ordered evaluation whose zero-write verdicts come first, and the zero-write sweep mean legitimate capture and 94 historical issues do not consume the rule's credibility.
- **One source of truth, three consistent surfaces.** `change.milestone`, pm-notes `milestone`, and the tracker title are one string; disagreement becomes detectable instead of invisible.
- **Adoption reach without distribution risk.** Bootstrapped projects inherit the rule through the guide and generated tracker instructions; repo-specific automation is not installed.
- **Cheap to undo.** Disabling the workflow removes enforcement without touching a ticket; labels are two clicks; prompt, template, and guide edits revert as files.

### Negative Outcomes

- **Advisory, not preventive.** An unattended run can still start on an orphan if a human ignores the flag; the rule relies on a human reading one label. The same canonical order means a human-removed flag is not re-applied outside a fresh `opened` or a milestone detach with an existing marker, so a human can silence a genuine gap — the intended deference to human judgment, at the cost of the flag's durability depending on the human rather than on the automation. This is the price of C-3 and C-6, and it is the main thing M2-exit measurement must test.
- **The exemption can become the default.** RSK-2 is a governance risk the mechanism cannot fix: an exempt ticket looks compliant to the check. Mitigation is intake still requiring attachment (decision point 5) plus the sweep reporting exempt counts; the revisit trigger treats growth as failure.
- **Two new public label names.** `needs-milestone` and `backlog-capture` join a public repository's vocabulary. The names are decided — descriptive kebab-case, consistent with the tracker's existing label vocabulary, scoped to this check, and reversible — so this is a maintenance cost rather than an open question. The owner may rename either label at the open-PR gate; a rename touches the guide, the workflow, and the tracker instructions together, never one surface alone.
- **Lockstep maintenance.** Guide, tracker instructions, `@pm` prompt, template, spec-writer rule, and workflow describe one rule; divergence produces a check that enforces something the guide does not say (RSK-4). Mitigated by the guide owning the procedure and the other surfaces owning pointers or project-specific values.
- **No native required field.** The tracker cannot make the milestone mandatory, so the rule is a convention plus a signal plus a human decision — three surfaces to keep aligned, instead of one enforced column.
- **Corpus work is manual.** The rule presumes the backlog mirrors attachment; the twelve missing `Ticket:` lines and nine missing ranking rows had to be repaired by hand in this change, and the mirror can drift again (D8 is not automated).
- **Historical debt remains visible noise.** 94 unattached issues (53 open) keep appearing in sweep output until a triage decision is made (OQ-1).

### Unresolved Questions

- [ ] Who triages the 94 pre-existing unattached `change` issues, and when? Proposed: advisory-only in this change; a separate triage pass uses the sweep artifact as its work list. (owner: Juliusz Ćwiąkalski)
- [ ] Does the check ship to adopters as installable automation? Deferred — this decision keeps it repository-local. (owner: future change; revisit trigger)
- [ ] Is a measurable unattended-run outcome (e.g. a milestone exit criterion) wanted at M2 exit? Deferred (spec §7.3). (owner: Juliusz Ćwiąkalski)

## Implementation Plan

Bound to this change's surfaces; no tracker ticket and no milestone is created by this decision or by GH-313.

1. **The rule, stated once (GH-313, `@coder`).** Author `doc/guides/milestone-management.md` as a redistributable guide: naming, creation, attachment, entry review, planned-scope definition, exit review, closure, extension/reopening, and enforcement with its exemption — plus the unattended-run precondition and a pointer to this record. Record the operating rule as a convention pointer in the M2 pack index's `## Conventions` section (no restatement) and link the guide from the documentation index.
2. **Creation and intake (GH-313, `@coder`).** Extend `.ai/agent/pm-instructions.md` with the project's milestone set, the attach-from-existing resolution rule, the label vocabulary, and intake verification; extend `.opencode/agent/pm.md` with the tracker-agnostic creation and intake rules, preserving the existing autonomous-creation prohibition, untrusted-comment handling, and state mapping unchanged. Carry the same rule into the `.opencode/agent/bootstrapper.md` guidance that generates a new project's `pm-instructions`; regenerate the Claude Code plugin with its sources.
3. **Artifact declaration (GH-313, `@coder`).** Add required `change.milestone` with its resolution rule to `doc/templates/change-spec-template.md` and to the `@spec-writer` front-matter rules. No other template gains the field (plan and test-plan inherit through `links.change_spec`; a feature spans milestones; the roadmap is the milestone register itself; a decision record is not milestone-scoped).
4. **Observation (GH-313, `@coder`).** Implement the attachment check as a pure offline-tested evaluation core plus a thin issue-event workflow: verdicts `compliant | exempt | flagged | restored | out-of-scope`, one flag label, at most one marked comment, reversal on attach/detach, and a manual sweep mode that writes one local artifact and zero tracker writes. Job-scoped permissions `issues: write` + `contents: read`, actions pinned to full SHAs, no bypass construct, no secret. Nothing enters `pnpm check`.
5. **Planning truth (GH-313, `@coder`).** Add the M2-S20 backlog block with its `Ticket:` line, the twelve missing M2 `Ticket:` lines, the missing ranking rows (contiguous, backlog order), the M2 pack row and its scenario seeds, and the status-snapshot delivery addendum — so the corpus the rule presumes is actually a mirror.
6. **Evidence (GH-313, `@pm`).** Produce per-milestone tracker evidence for M0, M1, and M2: declared tickets, attached count, title-prefix match, empty gap list, and the reported count of deliberately unattached backlog issues. Any attachment write is a human-confirmed PM tracker action, not code.
7. **Rollout and adoption.** The rule binds new tickets from the moment the guide and prompts land; existing tickets and historical specs stay untouched and valid. Rollback: disable the workflow (enforcement gone, no ticket affected), remove the two labels, revert the file edits — no data migration, nothing to undo beyond the revert.

## Verification Criteria

- **Attachment at creation.** New `change` tickets that are neither attached nor explicitly captured: **target 0**, measured per ticket at intake and by the flag's new-occurrence count. Window: from GH-313 merge onward.
- **Flag precision and idempotency.** Issues flagged that carry a milestone or the exemption: **target 0**; check comments per issue: **≤1 ever**; add-label actions issued on repeat evaluation: **0** (the flag label is applied once, at first evaluation). Window: continuous (offline decision-table suite as the gate; live observations as evidence thereafter).
- **Historical debt untouched.** Historical issues mass-labelled, mass-attached, or edited by this rule: **target 0**; sweep tracker writes: **target exactly 0**. Window: GH-313 delivery and every sweep run.
- **Check behaviour (the gate).** Every verdict — `compliant`, `exempt`, `flagged`, `restored`, `out-of-scope` — is proven by the offline decision-table suite with no network access over the canonical order and its dimensions: the seven actions (`opened`, `edited`, `labeled`, `unlabeled`, `milestoned`, `demilestoned`, `reopened`) × issue state (open/closed) × `change` label × exemption label × milestone present/absent × flag label present/absent × `markerCommentPresent` (true/false). The suite pins precedence — exemption outranks milestone and flag, milestone presence outranks the flag — and pins the write paths: the flag is added only on `opened`, and on `demilestoned` only when the marker already exists; an edit, label change, unlabel, or reopen on an unflagged pre-existing issue is `out-of-scope` with zero writes; a human-removed flag is not re-applied on later events; one marker comment at most, and only when the marker is absent. **Target 0 uncovered rows**, 0 network calls, and exactly one job summary per run. The suite is the gate for the check's behaviour; no live run is required to accept it. Window: GH-313 delivery and every later `pnpm check` run.
- **Live evidence (evidence, not a gate).** Accepted in either form: **(a)** a recorded local read-only sweep run executed through the repository's GitHub adapter module with a read-only credential — writing only the pinned local summary artifact, performing zero tracker writes, and failing nothing on findings; or **(b)** the first post-merge workflow run, cited once it occurs. The never-blocks rule holds under both: the flag is not a required status and a failed run blocks nothing. The no-residue rule holds under both: no ticket is created for the demonstration, and any live flag/clear cycle runs on an already-existing unattached issue and is fully reverted, leaving no tracker mutation behind. Window: (a) GH-313 delivery; (b) the first post-merge issue event.
- **Aggregate-gate determinism.** Tracker calls inside the `pnpm check` chain: **target 0**; chain order unchanged; gate green at the delivered HEAD. Window: GH-313 PR CI.
- **Artifact/tracker consistency.** For changes authored after GH-313: spec `change.milestone` = pm-notes `milestone` = tracker title: **target 100%**. Window: per change at DoR and DoD.
- **Corpus mirror.** M2 story blocks carrying a `Ticket:` line: **19 of 19**; story codes present in the ranking file: **77 of 77**, one contiguous sequence. Window: GH-313 delivery.
- **Milestone completeness evidence.** Declared tickets unattached across M0/M1/M2: **target 0**, with a gap list that is empty or explicitly reported (never waived); deliberately unattached backlog issues reported by count. Window: GH-313 evidence phase.
- **Behavioural outcome (the real test).** Across the tickets delivered in M2 after GH-313: **unattached-at-creation count stays 0 without the exemption being used as a default** (exempt population not rising milestone over milestone). Window: M2 exit — this is the measurement that decides whether the advisory instrument is sufficient (revisit trigger 1).

## Confidence Rating

**High** for the choice of instrument and for the constraint analysis: every decisive fact is local and was read directly (workflows, `package.json` gate chain, tracker instructions, `@pm` prompt, change-spec template, bootstrapper guidance, backlog and ranking state), and the alternatives were eliminated on constraints rather than on taste.

**Medium** for the long-run behavioural claim that a non-blocking flag sustains attachment at creation in a solo-developer-plus-agents setting. That claim rests on an analogy to the repository's existing advisory gates, not on measured data for this specific rule; it is deliberately exposed as the M2-exit verification criterion and as the first revisit trigger. Naming the escalation path (mechanical intake refusal, else issue-form auto-attach) is what keeps the confidence honest rather than merely optimistic.

## References

- Change spec: [chg-GH-313-spec.md](../changes/2026-11/2026-11-14--GH-313--milestone-first-planning/chg-GH-313-spec.md) — §2.1 current state, §4 goals, §5 F-1…F-6, §7 scope and non-goals, §15 DEC-1…DEC-12, §17 acceptance criteria and DoD, §18 rollout
- The procedure this decision will point at: `doc/guides/milestone-management.md` (authored in GH-313 delivery)
- Affected surfaces: `.ai/agent/pm-instructions.md` (ticket creation, intake verification, label vocabulary), `.opencode/agent/pm.md` (creation and intake rules), `.opencode/agent/spec-writer.md` (front-matter rules), `.opencode/agent/bootstrapper.md` (generated project configuration), [change-spec template](../templates/change-spec-template.md) (`change.milestone`)
- Planning corpus: [backlog.md](../planning/oss-tooling/backlog.md), [backlog-ranking.md](../planning/oss-tooling/backlog-ranking.md), [milestone packs](../planning/oss-tooling/milestones/README.md) (pack conventions), [roadmap.md](../planning/oss-tooling/roadmap.md), [status.md](../planning/oss-tooling/status.md)
- Tracker milestones: M0 — [milestone 1](https://github.com/juliusz-cwiakalski/agentic-delivery-os/milestone/1) (trust substrate, closed); M1 — [milestone 2](https://github.com/juliusz-cwiakalski/agentic-delivery-os/milestone/2) (delivery engine and autonomous dispatch, closed); M2 — [milestone 3](https://github.com/juliusz-cwiakalski/agentic-delivery-os/milestone/3) (ceremonies, measurement, and memory, open)
- Related decisions: [PDR-0004](PDR-0004-memory-practices-concept-repo-internal.md) (record-status and autonomous-run convention this record follows); [ODR-0002](ODR-0002-id-prefix-scheme-and-project-catalog.md) (ID-prefix vocabulary that GH-139 extends — explicitly outside this decision)
- Project configuration: [.ai/agent/decision-instructions.md](../../.ai/agent/decision-instructions.md) (strategic priorities; no-autonomous-ticket rule; redistributable constraint)
