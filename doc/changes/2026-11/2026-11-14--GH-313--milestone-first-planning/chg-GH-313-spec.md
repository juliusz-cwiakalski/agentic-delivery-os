---
change:
  ref: GH-313
  type: feat
  status: Proposed
  slug: milestone-first-planning
  title: "M2-S20: Milestone-first planning and delivery (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [milestone-m2, governance, planning, agents, enforcement]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "@pm tracker instructions and the @pm agent prompt (ticket-creation and intake path)"
      - "@spec-writer prompt and the change-spec template (milestone front-matter field)"
      - "@bootstrapper pm-instructions generator guidance"
      - "Repository-local GitHub Actions issue-event automation"
      - "OSS-tooling milestone corpus (backlog, ranking, milestone pack, status snapshot)"
      - "Delivered pm-notes optional `milestone` key"
      - "Delivered doc-distribution marker machinery and license-header script"
    external:
      - "GitHub Issues tracker (milestone records, labels, issue comments)"
  links:
    decisions: ["PDR-0005"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the milestone the enforced unit of planning and delivery — a milestone and every ticket attached to it exist in the tracker before work starts, every new change ticket is attached at creation or explicitly captured as backlog, and the planning corpus mirrors that attachment — so a planned scope can be delivered unattended for days to weeks without new planning decisions and without orphan tickets.

## 1. SUMMARY

The repository plans in milestones (M0 #1, M1 #2, M2 #3) but plans them by convention, not by rule: the milestone lifecycle is undocumented, the ticket-creation path does not pass a milestone at all, the change spec does not declare which milestone it belongs to, and nothing notices a `change` ticket that enters the tracker with no milestone. The planning corpus has drifted from the tracker in exactly the places this rule would have kept aligned — the M2 section of the backlog carries `- Ticket:` lines for 6 of its 18 stories and no M2-S20 block, and the suggested-order file stops at M2-S9.

This change delivers the milestone-first operating rule as one reviewable procedure plus its enforcement surfaces: a redistributable milestone-management guide covering naming, creation, attachment, entry review, planned-scope definition, exit review, closure, and extension or reopening when scope is discovered; the milestone requirement wired into the ticket-creation path (`@pm` tracker instructions and the `@pm` prompt) and carried into new projects by the `@bootstrapper` guidance that generates their `pm-instructions`; a required `change.milestone` field in the change-spec template and the `@spec-writer` prompt; an event-driven tracker check that flags a new `change` issue lacking a milestone (label plus one comment, idempotent, never a state change) with a narrow documented escape for pure backlog capture and a non-writing advisory sweep for existing debt; and the planning-truth repair that makes the M2 backlog, ranking, and pack agree with the tracker.

The operating rule is precedent-setting for every future ticket, so it is also recorded as decision record PDR-0005 (authored via `@decision-advisor` during the artifact phases; this specification declares it and does not author it). The change creates no tickets, adds no platform feature code, masses no labels onto existing issues, and leaves the 11-phase lifecycle untouched.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Milestones exist and are the planning unit.** M0 (#1, 20 tickets, all closed), M1 (#2, 24 tickets including the planning umbrella #219, all closed), and M2 (#3, 23 tickets, 11 open and 12 closed at planning time). Milestone titles follow an `M<n>:` prefix convention (`M2: Ceremonies, measurement, and memory`), and story codes embed the same prefix (`M2-S18`), so the prefix is the durable identifier while the tracker's milestone number is the API handle.
- **The milestone corpus is committed and canonical for scope.** [backlog.md](../../../planning/oss-tooling/backlog.md) holds the story blocks (Goal, Tasks, AC, `Depends on:`) with `- Ticket: GH-<n> (milestone M<n>)` lines for created tickets; [backlog-ranking.md](../../../planning/oss-tooling/backlog-ranking.md) holds every story in suggested delivery order; the milestone packs under [milestones/](../../../planning/oss-tooling/milestones/README.md) hold the review surfaces, and the pack index's `## Conventions` section is the "milestone blueprint conventions" this story names.
- **The milestone lifecycle is undocumented.** The pack index states pack conventions (status semantics, diagrams, no private content) and no more. There is no written naming rule, creation procedure, entry or exit review, closure condition, or rule for scope discovered mid-milestone. The entry review that precedes an unattended run exists only as owner practice.
- **The ticket-creation path carries no milestone.** The `@pm` tracker instructions create a ticket with title, body, and labels only; the `@pm` prompt's ticket operations list the same three arguments. The tracker MCP supports an optional milestone argument, so the capability exists and is simply not used.
- **Intake does not verify attachment.** The `@pm` prompt's intake and change-identification steps resolve the work item and record it as the active change; nothing checks that the ticket belongs to a milestone before artifact phases begin. pm-notes supports an optional `milestone` key, so the record has a home without a rule requiring it.
- **Planning artifacts do not declare a milestone.** The change-spec template's front matter has no milestone field and the `@spec-writer` prompt's front-matter rules do not require one. The plan and test-plan templates carry `links.change_spec` and no milestone; pm-notes is the only artifact that already models the key.
- **New projects inherit the gap.** The `@bootstrapper` guidance for generating `.ai/agent/pm-instructions.md` lists mandatory sections (tracker configuration, workflow-state mapping, label taxonomy, backlog source, conventions) and no milestone section, so a bootstrapped project inherits a ticket-creation path without a milestone rule.
- **94 `change` issues carry no milestone** (53 open). These are historical and backlog items outside any milestone plan; mass-attaching or mass-labelling them would be false enforcement, and an edit-triggered check must not treat them as new debt.
- **No issue-event automation exists.** The repository's workflows are CI, a PR-base guard on PR events, release, and a scheduled live-conformance run. Nothing reacts to issue events, and no label vocabulary exists for a milestone gap or a backlog-capture exemption.
- **The aggregate gate is offline and ordered by contract.** `pnpm check` chains lint, format, typecheck, test, boundaries, and three named invariant checks; the repository-check surface enforces that ordering and forbids bypass constructs. Any check requiring tracker network access cannot enter it.
- **Planning-corpus drift is measurable.** The backlog's M2 section has 18 story blocks and 6 `Ticket:` lines; the twelve stories S2, S3, S4, S5, S6, S7, S8, S10, S14, S16, S17, and S19 have tickets (GH-295, GH-296, GH-297, GH-298, GH-299, GH-300, GH-301, GH-287, GH-291, GH-293, GH-294, GH-310) attached to M2 but no `Ticket:` line; there is no M2-S20 block; and `backlog-ranking.md` carries 67 rows for 76 story blocks, missing M2-S11 through M2-S19 entirely.

### 2.2 Pain Points / Gaps

- **GAP-1**: No documented milestone lifecycle — naming, creation, attachment, entry and exit review, closure, and reopen/extension are owner practice, so a scope can start before its milestone exists and a closed milestone can silently grow.
- **GAP-2**: Ticket creation does not attach a milestone, so orphan tickets are the path of least resistance and there is no record to notice them by.
- **GAP-3**: Intake does not verify attachment, so an unattached ticket can consume the full 11-phase lifecycle and only surface as an orphan after delivery.
- **GAP-4**: Nothing flags a `change` ticket that enters (or is edited) without a milestone; the repository must notice orphans by reading the tracker by hand.
- **GAP-5**: There is no escape vocabulary — a legitimate backlog-capture ticket and an accidentally orphaned ticket look identical.
- **GAP-6**: Change artifacts do not declare their milestone, so a spec, its pm-notes, and the tracker can disagree without any surface being wrong in isolation.
- **GAP-7**: The planning corpus does not mirror the tracker: 12 M2 stories lack their `Ticket:` line, M2-S20 has no block, and the ranking file omits nine M2 stories.
- **GAP-8**: No evidence exists that the closed milestones' declared tickets were all attached, so "every planned ticket was planned" is unverified for M0 and M1.
- **GAP-9**: A bootstrapped project inherits all of the above, because the generator guidance does not carry the rule.

## 3. PROBLEM STATEMENT

Because the milestone exists only as a planning convention with no creation, attachment, or intake rule and no surface that notices an orphan, the owner cannot start an unattended run with confidence that the planned scope is complete and self-contained, tickets can be delivered outside any milestone plan, and the committed planning corpus drifts from the tracker without any mechanism reporting the drift — resulting in lost unattended-delivery time, scope that is discovered only after work starts, and milestone records whose completeness cannot be stated as a verifiable fact.

## 4. GOALS

- **G-1**: The milestone-first operating rule exists as one reviewable procedure: naming, creation, attachment, entry review, planned-scope definition, exit review, closure, and extension or reopening, documented once and referenced everywhere else.
- **G-2**: Every new `change` ticket is attached to an existing milestone at creation, agents never create a milestone autonomously, and the lifecycle does not start for an unattached ticket.
- **G-3**: A `change` ticket that enters or is edited in the tracker without a milestone is flagged once, reversibly, without changing its state, with one documented and narrow escape for pure backlog capture; existing debt is reported, never mass-flagged.
- **G-4**: A change artifact declares the milestone it belongs to, consistently with pm-notes and the tracker.
- **G-5**: The planning corpus mirrors the tracker: every M2 story block names its ticket and milestone, M2-S20 exists as a block, and the suggested-order file covers every story.
- **G-6**: Milestone completeness is a verifiable fact: the change produces evidence that every ticket declared by the M0, M1, and M2 backlog sections is attached to its milestone, closed tickets included, and reports the count of deliberately unattached backlog issues.
- **G-7**: An unattended run has a checkable precondition — the milestone and all its linked tickets exist before work starts — stated in the guide and in the milestone pack conventions.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Documented milestone lifecycle topics | 9 of 9 (naming, creation, attachment, entry review, planned scope, exit review, closure, extension/reopen, enforcement) |
| New `change` tickets that are neither attached nor explicitly captured | 0 unflagged; 100% either attached at creation or carrying the capture exemption |
| Duplicate check output per issue | ≤1 check comment ever; 0 add-label actions after the first application |
| Historical issues mass-labelled by this change | 0 (the sweep performs zero tracker writes) |
| M2 planning-corpus coverage | 19 of 19 story blocks carry a `Ticket:` line; 77 of 77 story codes present in the ranking file |
| Milestone-field consistency for this change | 1 of 1 (spec front matter = pm-notes `milestone` = tracker milestone title) |
| Declared tickets unattached across M0/M1/M2 | 0; deliberately unattached backlog issues reported by count |
| Tracker calls inside the aggregate gate | 0; the aggregate chain is unchanged |
| Aggregated gate | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens |

### 4.2 Non-Goals

- **NG-1**: No roadmap `MS-<NNNN>` identifiers, no roadmap allocation matrix, and no framework-wide ID-prefix catalog — GH-139 and its follow-ups own those.
- **NG-2**: No bootstrapper project-local catalog work (#137).
- **NG-3**: No ticket creation of any kind in this change, including follow-up tickets for the deferred items.
- **NG-4**: No platform or CLI feature code, and no tracker adapter work — enforcement is repository-local automation and instruction text.
- **NG-5**: No mass-labelling, mass-attaching, or triaging of the 94 pre-existing unattached `change` issues.
- **NG-6**: No change to the 11-phase lifecycle, its gates, tiers, or phase sets.
- **NG-7**: No backfill of the milestone field into historical change specs.
- **NG-8**: No mechanical refusal in the delivery entry scripts (batch delivery, CEO loop) — enforcement is at instruction level plus the tracker check.
- **NG-9**: No new distributable script and no install-set change; the tracker check is repository-local automation, not an installed ADOS script.
- **NG-10**: No amendment of current-truth specifications by this document — phase 7 (`system_spec_update`) reconciles them.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Milestone-management guide and the recorded operating rule | One procedure must own naming, creation, attachment, entry/exit review, closure, extension, planned-scope definition, and enforcement; without it every other surface has nothing to point at |
| F-2 | Milestone requirement in the ticket-creation and intake path | Creation is where orphan tickets are born; intake is where an orphan can still be stopped cheaply |
| F-3 | Event-driven milestone-attachment check with a capture escape and an advisory sweep | The tracker must notice an orphan at the moment it appears, without mass-flagging historical debt and without entering the offline gate |
| F-4 | Milestone field in planning artifacts | A change must declare the milestone it belongs to so the corpus, pm-notes, and the tracker can be compared |
| F-5 | Planning-truth consistency across backlog, ranking, and milestone pack | A rule about milestones is worthless if the milestone's own record is incomplete |
| F-6 | Tracker-consistency evidence for M0/M1/M2 | "Every planned ticket was attached" must be a verified fact, closed tickets included, not an assumption |

### 5.1 Capability Details

- **F-1 — Milestone-management guide and the recorded operating rule.** A new guide at `doc/guides/milestone-management.md` states the operating rule and its procedure once. Naming: a milestone title is `<M<n>>: <human-readable outcome phrase>`; the `<n>` prefix is the durable identifier and matches the story-code root of its tickets (`M2-S18` under `M2: …`), while the tracker milestone record — its number and state — is the source of truth for identity and attachment. Creation: milestones are created by the human owner from a plan (outcome phrase, one-line goal, and the planned ticket list), never by an agent autonomously; an agent that sees a missing milestone proposes it exactly as it would propose a ticket. Attachment: every `change` ticket is attached to exactly one milestone at creation, attachment lives on the ticket record, and the backlog mirrors it with the `- Ticket: GH-<n> (milestone M<n>)` line. Entry review: before work starts, the milestone is open, its title follows the convention, every planned ticket exists and is attached, and every attached ticket traces to a backlog story block or to an exception recorded in the milestone pack. Planned scope: the attached-ticket set, where "planned" means the milestone can be delivered without taking a new scope decision. Exit review: every attached ticket is closed or explicitly removed with a recorded reason, and outcome claims are evidenced. Closure: a milestone closes only after exit review, and a closed milestone is an immutable record. Extension and reopening: scope discovered mid-milestone either extends the open milestone (attach, update the pack, record the scope delta) or, when the milestone is already closed, reopens it (set the record open, record why, update the pack) — new work is never silently attached to a closed milestone, and a reopened milestone repeats the entry review. Enforcement: the guide documents the flag, the capture exemption, and the advisory sweep of F-3, and states that a flag never blocks work. The guide also carries the unattended-run precondition of G-7. The guide is redistributable, linked from the documentation index, and its license header is added only by the header script. The operating rule is also recorded as decision record PDR-0005 by `@decision-advisor` during the artifact phases, and the milestone pack index's `## Conventions` section carries a short pointer to both, without restating the procedure.
- **F-2 — Milestone requirement in the ticket-creation and intake path.** The ticket-creation path requires a milestone on every created ticket: the resolution rule is "attach to an existing milestone from the project's declared milestone set", never "create one" — a missing milestone is proposed to the human exactly like a ticket. The rule is tracker-agnostic in the agent prompt (the milestone-equivalent field is declared in the project's tracker instructions) and project-specific in the tracker instructions (the project's milestone set, the resolution rule, the label vocabulary of F-3, and the intake verification). Intake verifies attachment before the lifecycle starts: the `@pm` records the ticket's milestone in pm-notes, and a ticket without one produces a question to the human naming the milestone the PM proposes to attach; artifact phases begin only after the attachment exists. A ticket carrying the capture exemption is still unattached — the exemption marks it as not yet planned, not as ready to deliver. The bootstrapper guidance that generates `.ai/agent/pm-instructions.md` for a new project gains a milestone section carrying the same rule, so a bootstrapped project starts compliant. Every existing rule in the tracker instructions — never create tickets autonomously, untrusted-comment handling, tracker-state mapping — is preserved unchanged; the milestone requirement is additive.
- **F-3 — Event-driven milestone-attachment check with a capture escape and an advisory sweep.** The check evaluates three inputs: whether the issue is a `change` issue, whether it carries a milestone, and whether it carries the capture exemption. A `change` issue that is open, has no milestone, and has no capture exemption is flagged: the flag label is applied and exactly one explanatory comment is posted (the comment names the guide, the escape, and the fact that the flag never blocks work, and carries a stable marker so the check recognizes its own earlier comment). No other tracker mutation occurs — no state change, no assignee, no label other than the flag, no milestone write. The check is idempotent: repeated events issue no further add-label action and no second comment. It is reversible: when a milestone is attached, the flag label is removed and nothing else changes; when a milestone is removed again, the flag label returns without a new comment. The escape is a documented label for pure backlog capture — it suppresses the flag, is named in the guide and the tracker instructions, and is removable at any time with the flag returning on the next evaluation. The sweep is a manual dispatch mode that reports the existing unattached `change` population as an advisory summary and a machine-readable local artifact, performs exactly zero tracker writes (its one write is that local artifact), and never fails on findings. The decision logic is a pure, offline-testable evaluation core; the workflow is a thin wrapper that supplies events and performs the tracker writes. The check does not enter the aggregate gate. Tracker: the evaluation covers event classes — issue opened, issue edited, issue labeled, milestone attached, milestone detached, and manual sweep — with a single verdict per evaluation.
- **F-4 — Milestone field in planning artifacts.** The change-specification artifact declares its milestone in front matter as a required field whose value is the tracker milestone title verbatim (the same string pm-notes carries), so the spec, the pm-notes record, and the tracker can be compared without translation. The template carries the field with its resolution rule, and the `@spec-writer` prompt requires it, so the field is authored rather than optionally filled. Where a project's tracker has no milestone construct — declared in that project's tracker instructions — the field is present with the literal `none`; the escape is a property of the project's tracker, never a per-change convenience. The field is added to the change-specification template only. The implementation-plan and test-plan templates are unchanged because they carry `links.change_spec` and inherit the change's identity; the feature-specification template is unchanged because a feature spans milestones; the engineering-roadmap template is unchanged because the roadmap is itself the milestone register, so a milestone field on it would be circular; the decision-record template is unchanged because PDR-0005 records a rule, not a milestone membership.
- **F-5 — Planning-truth consistency across backlog, ranking, and milestone pack.** The M2 story M2-S20 gains a backlog block in the repository's story shape (Goal, Tasks, machine-checkable AC, `Depends on:`, and a `- Ticket: GH-313 (milestone M2)` line); the twelve M2 stories whose tickets exist but whose `Ticket:` lines are missing gain those lines; the suggested-order file gains a row for every story it omits — M2-S11 through M2-S19 and M2-S20 — ordered by the backlog's own M2 section order, with the existing tail renumbered so the file keeps one contiguous sequence and its stated invariant ("stories from backlog.md top to bottom in suggested delivery order") holds again; the M2 pack gains the story-to-artifact row for M2-S20 with its scenario seeds, and the pack's seed file gains those seeds so the row does not cite seeds that do not exist; the pack index's `## Conventions` section records the operating rule as a convention with a pointer to the guide; and the status snapshot gains a delivery addendum in the established form when the change delivers.
- **F-6 — Tracker-consistency evidence for M0/M1/M2.** The change produces verified tracker evidence: every ticket declared by the M0, M1, and M2 sections of the backlog is attached to the milestone its block names — closed tickets included — with zero declared tickets unattached; the milestone title prefix matches the story-code prefix of its attached tickets; and the count of deliberately unattached `change` backlog issues is reported rather than reconciled. Attachment writes, if any are needed to reach zero, are PM-owned tracker actions confirmed with the human, not code, and the evidence record states the milestone, the declared count, the attached count, and the gap list (empty when green).

## 6. USER & SYSTEM FLOWS

```
Flow 1: Plan a milestone and pass the entry review (AC-F1-2, AC-F1-3)
  Owner decides the next milestone (outcome phrase, goal)
  → creates the tracker milestone "M2: <outcome phrase>" (agents propose, owner creates)
  → creates/attaches every planned ticket; each ticket traces to a backlog block
  → entry review: open milestone, conventional title, every ticketed story attached
  → the milestone pack records the scope and the planned-seat list
  → the scope is now deliverable unattended; no new planning decision is pending.

Flow 2: Create a ticket (AC-F2-1)
  Human approves a change
  → @pm resolves an existing milestone from the project's milestone set
  → creates the ticket with title, body, labels and that milestone
  → records the workItemRef; the backlog block gains its Ticket line
  (no milestone exists yet → @pm proposes one; the owner decides)

Flow 3: Intake a change (AC-F2-2)
  @pm reads the ticket
  → milestone attached? yes → record it in pm-notes; continue to artifacts
  → no → ask the human, naming the proposed milestone; stop until attached
  → capture-exempt ticket → same question: capture is not a delivery plan.

Flow 4: A ticket enters without a milestone (AC-F3-1..AC-F3-4)
  issues.opened / issues.edited / issues.labeled, change issue, no milestone
  → flag label applied; exactly one commented explanation; state unchanged
  → later a milestone is attached (issues.milestoned)
  → flag label removed; the comment stays as history
  → milestone detached again (issues.demilestoned)
  → flag label restored; no second comment.

Flow 5: Capture a backlog idea that has no milestone (AC-F3-3)
  Human approves capture without a plan
  → ticket created with the capture exemption (no milestone)
  → the check leaves it alone; the guide and tracker instructions name the exemption
  → when it is scheduled: the owner creates/attaches the milestone and removes the exemption.

Flow 6: Scope is discovered mid-milestone (AC-F1-2)
  A gap appears after the entry review
  → milestone open? attach the new ticket, update the pack, record the scope delta
  → milestone closed? reopen it with a recorded reason, update the pack, repeat entry review
  (no path silently attaches work to a closed milestone)

Flow 7: Exit review and closure (AC-F1-2, AC-F6-1)
  Every attached ticket closed (or removed with a recorded reason)
  → outcome claims evidenced; the pack becomes a snapshot
  → the milestone is closed; later work needs a new milestone or a declared reopen.

Flow 8: Sweep the existing debt (AC-F3-5)
  Manual dispatch, sweep mode
  → paged read of open change issues without a milestone, minus exempted ones
  → advisory summary plus a machine-readable local artifact; zero tracker
    writes; exit 0
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The new milestone-management guide at `doc/guides/milestone-management.md`: the operating rule, the nine documented topics, the enforcement and escape vocabulary, and the unattended-run precondition; redistributable marker; license header via the header script; linked from the documentation index.
- The operating-rule convention in the milestone pack index's `## Conventions` section, as a pointer to the guide (no restatement).
- Decision record PDR-0005 recording the operating rule as a precedent-setting decision, authored via `@decision-advisor` during the artifact phases.
- The milestone requirement in the ticket-creation path: the `@pm` tracker instructions (creation arguments, resolution rule, label vocabulary, intake verification) and the `@pm` agent prompt (tracker-agnostic creation and intake rules); the existing prohibitions preserved.
- The milestone requirement carried into generated project configuration by the `@bootstrapper` guidance.
- The required `change.milestone` field in the change-specification template and the `@spec-writer` prompt's front-matter rules; this change's own spec carries it.
- The event-driven milestone-attachment check: evaluation core with offline decision-table tests, thin issue-event workflow, flag label and one marked comment, reversal on attachment, capture exemption, and the advisory sweep mode.
- The documented label vocabulary for the flag and the exemption, in the guide and the tracker instructions.
- Planning-truth repair: the M2-S20 backlog block with its `Ticket:` line; the twelve missing M2 `Ticket:` lines; the suggested-order rows for M2-S11 through M2-S20 with the tail renumbered; the M2 pack story-to-artifact row for M2-S20 and its seeds; the status snapshot addendum at delivery.
- Tracker-consistency evidence for M0, M1, and M2 as an acceptance evidence item (PM-owned tracker actions; no code).
- Regenerated Claude Code plugin output for every changed prompt.

### 7.2 Out of Scope

- [OUT] Roadmap `MS-<NNNN>` identifiers, the roadmap allocation matrix, and any framework-wide ID-prefix catalog (GH-139 and its follow-ups; NG-1).
- [OUT] Bootstrapper project-local ID catalog work (#137; NG-2).
- [OUT] Any ticket creation, including follow-up tickets for deferred items (NG-3).
- [OUT] Platform or CLI feature code and tracker adapter implementations (NG-4).
- [OUT] Mass-labelling, mass-attaching, or triaging the 94 pre-existing unattached `change` issues (NG-5; advisory reporting only).
- [OUT] Changes to the 11-phase lifecycle, its gates, tiers, or phase sets (NG-6).
- [OUT] Backfilling the `change.milestone` field into historical change specs (NG-7).
- [OUT] Mechanical refusal of unattached tickets in the delivery entry scripts (NG-8).
- [OUT] A new distributable script, install-set change, or workflow shipping to adopters (NG-9).
- [OUT] Any other template field beyond the change-specification milestone field (plan, test-plan, feature-spec, roadmap, decision-record, PR-instructions templates stay unchanged).
- [OUT] Amendments to current-truth specifications by this document — phase 7 reconciles them (NG-10).

### 7.3 Deferred / Maybe-Later

- Extending the advisory sweep to report change specs whose front matter lacks `change.milestone` (a corpus-wide advisory, once historical specs are out of the picture).
- A scheduled sweep cadence, if the owner wants standing visibility instead of on-demand reporting.
- Shipping the check pattern to adopters through the install set (workflow distribution, not script distribution).
- Automated milestone attachment at issue creation (an issue-form plus bot path), which the event-driven check makes non-urgent.
- Mechanical intake refusal in the delivery entry scripts, if instruction-level enforcement proves insufficient in practice.
- A roadmap exit criterion for the unattended-run outcome, if the owner wants the operating model measured at M2 exit.
- Triage of the pre-existing unattached population (OQ-1).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the change authors no HTTP surface of its own. The check consumes the tracker's issue API; its contract is the interaction set, not a service endpoint:

| Interaction | Purpose | Access |
|---|---|---|
| List milestones (state, title, number) | Resolve and verify the milestone reference | read |
| Get an issue (state, labels, milestone) | Evaluation input | read |
| List issues (open, `change`, paged) | Sweep input | read |
| List comments (locate the check's own marker) | Idempotency | read |
| Add the flag label | Flag | write |
| Remove the flag label | Reversal | write |
| Create one comment | One-time explanation | write |

Explicitly absent from the contract: issue state transitions, milestone mutation or creation, assignee changes, and any other label.

### 8.2 Events / Messages

| ID | Trigger | Contract |
|----|---------|----------|
| EVT-1 | Issue opened, edited, or labeled | A `change` issue with no milestone and no exemption is flagged; compliant and exempt issues produce no write; the evaluation is idempotent per issue |
| EVT-2 | Milestone attached or detached on an issue | Attachment removes the flag label; detachment restores the flag label; neither posts a new comment |
| EVT-3 | Manual dispatch, sweep mode | Advisory report only: exactly 0 tracker writes, exactly 1 local summary artifact written, exit 0 regardless of findings |
| EVT-4 | Evaluation verdict | Exactly one of `compliant`, `exempt`, `flagged`, `restored`, `out-of-scope` is produced per evaluation and is what the workflow acts on |

Issues that are closed, not labeled `change`, or already carrying a milestone are out of scope for EVT-1 and EVT-2 and never produce a write.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `change.milestone` (change-spec front matter) | Required field; value is the tracker milestone title verbatim (`M<n>: <outcome phrase>`), equal to the pm-notes `milestone`; literal `none` only where the project's tracker instructions declare no milestone construct |
| DM-2 | Tracker label vocabulary and check marker | Flag label (`needs-milestone`), exemption label (`backlog-capture`), and a stable marker inside the check's one comment so the check recognizes its own prior output |
| DM-3 | pm-notes `milestone` key | Delivered optional key, populated at intake for every change; no schema change |
| DM-4 | Backlog ticket-line convention | `- Ticket: GH-<n> (milestone M<n>)` directly under the story heading; coverage extended to every M2 story with a ticket |
| DM-5 | Milestone record convention | Title `M<n>: <outcome phrase>` (prefix = story-code root), description carrying the goal and the planned ticket list, and the attached-ticket set as the planned scope |

### 8.4 External Integrations

GitHub Issues is the only external surface: milestone reads, issue reads, label writes, and one comment per flagged issue. No new credential is introduced — the workflow uses its own scoped token with the least privileges the contract needs. No vendor API, no MCP tool change, and no `gh` CLI dependency is added to the product path.

### 8.5 Backward Compatibility

- **Existing tickets are untouched.** The check writes nothing to issues that already carry a milestone, and the sweep performs no tracker writes at all — its only output is a local summary artifact; the 94 pre-existing unattached issues keep their current labels and comments until a human acts.
- **Existing change artifacts stay valid.** Historical specs without `change.milestone` are not validated or backfilled; the field is required for artifacts authored from this change onward.
- **pm-notes is unchanged.** The `milestone` key is delivered and optional; the change populates it by rule, not by schema change.
- **The aggregate gate is unchanged.** `pnpm check` keeps its chain, its ordering, and its offline determinism; the new tests run inside the existing test step and the enforcement does not.
- **The lifecycle is unchanged.** The 11 phases, gates, and tier semantics are untouched; intake gains a verification step, not a new phase.
- **Generated plugin output changes with its sources.** Prompt edits regenerate the Claude Code plugin in the same change; the freshness check stays green.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Flag precision and idempotency | 0 flags on issues that carry a milestone or the exemption; ≤1 check comment per issue ever; 0 add-label actions on repeat evaluation (the flag label is applied once, at first evaluation) |
| NFR-2 | Aggregate-gate determinism | `pnpm check` performs 0 tracker calls, keeps the five named checks in order, gains no milestone step, and stays green |
| NFR-3 | Workflow privilege and supply chain | Job-scoped permissions limited to `issues: write` and `contents: read`; every action pinned to a 40-hex commit SHA; no `pull_request_target`; no secrets referenced; the repository's CI invariant checks stay green |
| NFR-4 | Documentation distribution | The new guide declares `ados_distribution: redistributable`, enters the marker-derived install set, passes the drift guard, and carries exactly one license header — the one generated by `scripts/add-header-location.sh`, byte-identical to that script's output — never a hand-written header |
| NFR-5 | Change quality gates | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens; conventional commit subjects; every commit body/footer line ≤100 characters |
| NFR-6 | Sweep bounds and write discipline | Reads paged at 100; ≤ ceil(N/100) + 3 tracker reads for N issues; exactly 0 tracker writes in sweep mode; exactly 1 local summary-artifact write per run (a repository-local file, never a tracker write); completes within 10 minutes for N ≤ 500; exit 0 regardless of finding count |
| NFR-7 | Comment safety | The comment body is static: 0 issue-authored strings (title, body, author, label text) interpolated into it, and no untrusted text echoed into logs |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **Every evaluation is legible from the workflow run**: each run publishes a job summary naming the issue, the verdict from EVT-4, and the writes performed (or "none"), so an operator can answer "why was this flagged" from the run without reading the workflow source.
- **The sweep is self-describing**: the advisory summary states the total inspected, the exempted count, the unattached count, the explicit statement that no tracker write occurred, and that the single write is the local summary artifact; the machine-readable local artifact carries the same numbers plus the issue list.
- **Failures are visible, never silent**: a tracker API failure fails the run (no `continue-on-error`, no bypass construct), so an outage cannot present as a clean pass; because the check is not a required status, a failed run blocks nothing.
- **The label is the standing signal**: an issue's `needs-milestone` label is the durable, queryable state — "how many orphans exist right now" is a tracker query, not a dashboard.
- **No new product telemetry** ships: no event topic, no metrics family, no store kind is added.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | False enforcement: historical or legitimately unpinned tickets get flagged en masse, turning a governance rule into noise | M | M | Event-driven evaluation only (never a bulk run), a sweep that performs no tracker writes, closed issues excluded, and a one-label exemption for pure backlog capture (DEC-1, DEC-8) | Low |
| RSK-2 | Erosion of the new rule: the exemption becomes the default and the milestone requirement quietly disappears | H | M | The exemption is a capture marker, not a delivery licence: intake still requires a milestone (DEC-11); the guide states it; the sweep reports exempted tickets by count so growth is visible | Medium |
| RSK-3 | Prompt edits break the product surfaces: prompt conformance, help coverage, or generated-plugin freshness fails, or the changed prompts drift from current-truth docs | M | M | Edit sources only, regenerate the plugin in the same change, run `pnpm check:prompt`/`check:help` and the freshness job, and reconcile current truth in phase 7 (NFR-5) | Low |
| RSK-4 | Check and rule diverge: the guide describes one vocabulary or behaviour while the workflow implements another | M | M | One vocabulary (DM-2), the decision table pinned by offline tests, and the guide citing the check's verdict vocabulary as the contract (F-3, NFR-1) | Low |
| RSK-5 | Workflow supply-chain or topology regression: an unpinned action, an over-broad permission, a bypass construct, or a job that the invariant checks reject | H | L | Pinned actions, job-scoped least privilege, no bypass constructs, and the invariant battery run before the PR (NFR-3) | Low |
| RSK-6 | Guide ownership collision with GH-139: two stories author the same file and one overwrites the other | M | M | GH-313 owns the milestone-first operating-rule content; GH-139 extends the same file later with `MS-` identifiers and the allocation matrix; the boundary is recorded in the guide and in DEC-4 | Low |
| RSK-7 | Planning-truth edits drift from the tracker again, making the evidence stale on arrival | M | M | The evidence item is produced at delivery (F-6) and states counts plus a gap list; the backlog and ranking edits are verified against the tracker rather than copied from it | Low |
| RSK-8 | Scope creep into neighbouring stories: ID catalogs, bootstrapper catalogs, CLI enforcement, adapter work | M | M | Non-goals and the out-of-scope list are binding (NG-1..NG-10); the reviewer checks the delivered diff against §7 | Low |
| RSK-9 | Over-documentation: the guide duplicates the pack conventions, the lifecycle guide, or the tracker instructions, and the copies drift | M | M | State each rule once: the guide owns the procedure, the pack conventions own a pointer, the tracker instructions own the project's milestone set and labels, the lifecycle guide owns the prompt-authoritative mirror statement | Low |
| RSK-10 | Tracker-side evidence depends on human action, so completion slips past the code work | M | M | The evidence is a named acceptance item with an explicit owner action and a recorded gap list; a non-empty gap list blocks the DoD row rather than being waived (F-6, DoD-14) | Medium |

## 12. ASSUMPTIONS

- The GitHub tracker supports the milestone-events and label/comment writes the check needs, and its token can be scoped to `issues: write` without broader access.
- The existing milestone titles (`M0:`, `M1:`, `M2:`) remain the naming precedent; no renumbering is required for this change.
- The 94 unattached `change` issues stay out of scope; no human decision in this change reclassifies them.
- The delivered pm-notes `milestone` key needs no schema change, and its value form (the milestone title) is the form the spec field mirrors.
- The documentation-index linking requirement is satisfied by the existing Guides table; no new index document is introduced.
- Prompt changes regenerate cleanly through the plugin build, and the generated output is committed with its sources.
- The aggregate gate's contract (deterministic, offline, ordered) does not change in this change's window.
- Tracker writes for evidence are performed by the PM with human confirmation, so the evidence can be produced without new automation.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | None (ticket: "Depends on: none") | No story must deliver first; the consumed capabilities are already delivered |
| Consumes | Delivered pm-notes `milestone` key | Optional typed key already validated when present; the change populates it by rule |
| Consumes | Delivered doc-distribution marker machinery and header script | The new guide enters the derived install set; headers are script-added only |
| Consumes | Delivered repository invariant checks and CI topology | The new workflow and tests must satisfy them unchanged |
| Artifact-phase deliverable | PDR-0005 (via `@decision-advisor`) | Recorded during the artifact phases, before delivery begins; this spec declares it and does not author it (DEC-5) |
| Related (extends the same file later) | GH-139 | Owns roadmap `MS-<NNNN>` identifiers and the allocation matrix; extends the guide after this change (DEC-4) |
| Related (not consumed) | #137 bootstrapper project-local catalog | Different surface; explicitly out of scope |
| Enables | Unattended multi-day delivery as the default operating mode | The owner directive of 2026-11-12 depends on a planned scope being complete and orphan-free before a run starts |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Who triages the 94 pre-existing unattached `change` issues, and over what horizon? | This change reports them by count and never writes to them (DEC-1, NG-5); a triage pass would attach the genuinely planned ones and exempt the rest | Open — owner decision. Proposed: keep this change advisory-only; schedule a triage pass as separate work after delivery, using the sweep artifact as the work list. Decision needed: consult `@decision-advisor` if the triage is to be planned as a change |
| OQ-2 | Are the two public label names final? | `needs-milestone` (flag) and `backlog-capture` (exemption) become part of the tracker's public vocabulary in a public repository (DEC-8) | Open — confirm at review. Proposed: keep both names; renaming later is a guide + workflow change, so confirming now avoids a second pass |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Enforcement is event-driven, not bulk: the check evaluates newly created or edited `change` issues that lack a milestone and flags them (label plus one comment, idempotent, no state change); a manual sweep reports existing debt as advisory and fails nothing, because 94 historical issues (53 open) would otherwise be mass-flagged | PM decision recorded in pm-notes: mass-labelling historical debt is false enforcement and would bury the real signal; an advisory report makes the debt visible without punishing it | 2026-11-14 |
| DEC-2 | The check does not enter `pnpm check`: it is a GitHub Actions issue-event workflow over a pure, unit-testable evaluation function, so the decision logic has offline tests while the network-dependent enforcement stays out of the deterministic gate | PM decision: the aggregate gate must stay deterministic and offline; milestone attachment is tracker data, not a repository invariant | 2026-11-14 |
| DEC-3 | "Milestone blueprint conventions" is the milestone pack index's `## Conventions` section; "ticket generator templates" is the `@pm` ticket-creation path plus the `@bootstrapper` guidance that generates `.ai/agent/pm-instructions.md` | PM decision: the pack is the committed blueprint, and no standalone ticket template exists to edit | 2026-11-14 |
| DEC-4 | GH-313 authors the milestone-first operating-rule content of `doc/guides/milestone-management.md`; GH-139 later extends the same file with `MS-<NNNN>` identifiers and the allocation matrix; no new ticket is created | PM decision: two stories target one file; splitting by content ownership keeps one canonical guide without merging the scopes | 2026-11-14 |
| DEC-5 | The operating rule is recorded as PDR-0005 (via `@decision-advisor`) in the artifact phases, in addition to this decision log; this specification declares the record and does not author it | PM decision: the rule binds every future ticket, so it is a precedent-setting product decision rather than a change-local choice | 2026-11-14 |
| DEC-6 | Exactly one template gains the milestone field: the change-specification template. Plan, test-plan, feature-spec, engineering-roadmap, and decision-record templates do not | Smallest truthful set: plans and test plans inherit the change's identity through `links.change_spec`, and pm-notes already carries `milestone`; a feature spans milestones; the roadmap is the milestone register itself, so a milestone field on it would be circular; a decision record is not milestone-scoped | 2026-11-14 |
| DEC-7 | The field's value is the tracker milestone title verbatim (equal to pm-notes `milestone`), not the milestone number; the literal `none` is permitted only where the project's tracker instructions declare no milestone construct | One string, three surfaces, no translation table; the number is an API handle that changes per tracker, the title is the durable human identifier and carries the `M<n>` prefix the story codes use | 2026-11-14 |
| DEC-8 | The tracker label vocabulary is `needs-milestone` for the flag and `backlog-capture` for the exemption; the check posts at most one marked comment per issue; reversal removes the flag label and never deletes the comment | The label is the durable queryable state and the comment is history; deleting comments would destroy the audit trail and make idempotency detection harder | 2026-11-14 |
| DEC-9 | The suggested-order file is repaired, not just appended to: rows for M2-S11 through M2-S20 are inserted in the backlog's own M2 section order and the existing tail is renumbered so the sequence stays contiguous | Inserting M2-S20 alone already forces a renumber; the nine missing M2 rows restore the file's stated invariant ("stories from backlog.md top to bottom") at no extra cost and remove a second drift surface | 2026-11-14 |
| DEC-10 | The M2 pack gains the M2-S20 story-to-artifact row and two scenario seeds in the pack's seed file, and the seed file's heading range is updated | A row that cites seeds that do not exist would be false; the pack convention is at least two seeds per story, and the story's behaviour (flag, exemption) is expressible as Given/When/Then | 2026-11-14 |
| DEC-11 | The capture exemption is a capture marker, not a delivery licence: an exempted ticket still needs a milestone before the lifecycle starts | Prevents the exemption from becoming a permanent bypass (RSK-2); capture and delivery are different states with different evidence | 2026-11-14 |
| DEC-12 | Delivery runs the full 11-phase lifecycle in autonomous mode (per pm-notes), with commits through the commit primitive, conventional subjects, every body/footer line ≤100 characters, `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR, and the PR targeting `main-tools` and stopping open | Ticket delivery conventions and pm-notes; the repository is in the tooling transition, where `main` is the frozen public baseline | 2026-11-14 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Milestone-management guide | New — the operating rule and its procedure, redistributable and installed by marker |
| Documentation index | Updated — the guide is discoverable from the landing page |
| `@pm` agent prompt and tracker instructions | Updated — creation requires a milestone, resolution never creates one, intake verifies and records the attachment |
| `@bootstrapper` prompt | Updated — generated project configuration carries the milestone rule |
| `@spec-writer` prompt and change-spec template | Updated — a required milestone field with its resolution rule |
| Generated Claude Code plugin | Regenerated for every changed prompt |
| Milestone-attachment check | New — pure offline-tested evaluation core plus a thin issue-event workflow, flag label, marked comment, exemption, and advisory sweep |
| Tracker label vocabulary | Extended — `needs-milestone` and `backlog-capture` documented in the guide and the tracker instructions |
| Planning corpus (backlog, ranking, M2 pack, status) | Updated — M2-S20 block and row, twelve backfilled ticket lines, ranking repair, pack seeds, status addendum |
| Decision register | New — PDR-0005 |
| Current-truth specifications | Reconciled in phase 7 (`system_spec_update`), including a new milestone-governance feature spec — not amended by this document (NG-10) |
| 11-phase lifecycle, phases, gates, tiers | **Unchanged** |
| Product code and command surface (packages, CLI, MCP, adapters) | **Unchanged** — no feature code and no command-surface change |
| Repository automation | Extended — the new evaluation core and its tests are repository-internal (under the repository check and test surfaces); no existing script is modified, no entry is added to the install set, and the aggregate chain is untouched |
| Tracker data (existing issues, milestones) | **Unchanged by automation** — the only writes are the check's flag/reversal and the change's own lifecycle |

## 17. ACCEPTANCE CRITERIA

**F-1 — Milestone-management guide and the recorded operating rule**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the delivered documentation set, **when** the guide is inspected and the documentation-distribution guard runs, **then** `doc/guides/milestone-management.md` exists with `ados_distribution: redistributable`, appears in the marker-derived install set, carries exactly one license header — the one generated by `scripts/add-header-location.sh` and byte-identical to that script's output — with no hand-written header, is linked from the documentation index's Guides section, and the drift guard passes | F-1, NFR-4 |
| AC-F1-2 | **Given** the guide, **when** its content is checked against the operating rule, **then** it documents all nine topics — naming (with the `M<n>`-prefix convention and the tracker record as source of truth), creation (owner-created, agent-proposed), attachment, entry review, planned-scope definition, exit review, closure, extension or reopening when scope is discovered, and enforcement with its exemption — each exactly once | F-1, DM-5 |
| AC-F1-3 | **Given** the milestone pack index and the guide, **when** their relationship is inspected, **then** the pack index's `## Conventions` section records the operating rule as a convention that points at the guide without restating the procedure, and the guide states the unattended-run precondition that a milestone and all its linked tickets exist before work starts | F-1, F-5 |
| AC-F1-4 | **Given** the artifact phases, **when** delivery begins, **then** decision record PDR-0005 exists in the decision register, records the operating rule with its enforcement and exemption, and is referenced from the guide and from this change | F-1, DEC-5 |

**F-2 — Milestone requirement in the ticket-creation and intake path**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** the ticket-creation path, **when** a new `change` ticket is created, **then** both the tracker instructions and the agent prompt require a milestone resolved from the project's existing milestone set, neither permits creating a milestone autonomously (a missing milestone is proposed to the human), and the existing rules — never create tickets autonomously, untrusted-comment handling, tracker-state mapping — are present and unweakened | F-2, DM-2 |
| AC-F2-2 | **Given** a ticket at intake, **when** the lifecycle begins, **then** the PM instructions require verifying that the ticket is attached to a milestone and recording that milestone in pm-notes before artifact phases start; an unattached ticket produces a question to the human naming the proposed milestone and artifact phases do not begin until the attachment exists; an exempted ticket is treated the same way | F-2, DM-3, DEC-11 |
| AC-F2-3 | **Given** the bootstrapper guidance, **when** a new project's tracker instructions are generated, **then** the generated file carries a milestone section (convention, attachment at creation, no autonomous creation, intake verification, exemption), the regenerated Claude Code plugin output for the changed prompts is committed and fresh, and prompt conformance stays green | F-2, NFR-4, NFR-5 |

**F-3 — Event-driven milestone-attachment check**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** an open `change` issue with no milestone and no exemption, **when** the check evaluates it on creation, **then** the flag label is applied, exactly one explanatory comment carrying the check's marker is posted, and the issue's state, assignee, and other labels are unchanged | F-3, EVT-1, DM-2 |
| AC-F3-2 | **Given** an issue already flagged, **when** the trigger repeats (further edits, repeated label events), **then** no second comment is posted and the flag label is applied at most once, so the observable tracker state is identical after any number of runs | F-3, EVT-1, NFR-1 |
| AC-F3-3 | **Given** an open `change` issue carrying the exemption label, **when** the check evaluates it, **then** no flag and no comment are produced; the exemption, its purpose, and its removability are documented in the guide and the tracker instructions | F-3, DM-2, F-1 |
| AC-F3-4 | **Given** a flagged issue, **when** a milestone is attached, **then** the flag label is removed and no comment is added; **when** a milestone is detached again, **then** the flag label is restored and still no new comment appears | F-3, EVT-2 |
| AC-F3-5 | **Given** the sweep mode, **when** it runs against the current tracker state, **then** it reports the unattached open `change` issues (minus exempted ones) as an advisory summary and a machine-readable local artifact, performs exactly 0 tracker writes, writes exactly 1 local artifact file, and exits successfully whatever the finding count | F-3, EVT-3, NFR-6 |
| AC-F3-6 | **Given** the evaluation core, **when** the offline test suite runs, **then** the full decision table is covered without network access — `change`/non-`change`, open/closed, milestone present/absent, exemption present/absent, milestone-removal event — and the aggregate gate still contains no milestone step and performs no tracker call | F-3, EVT-4, NFR-2 |
| AC-F3-7 | **Given** the workflow definition, **when** the repository's CI invariant checks run, **then** the job declares `issues: write` and `contents: read` only, every action is pinned to a full commit SHA, no `pull_request_target` or bypass construct appears, no secret is referenced, and the supply-chain, topology, and bindingness checks stay green | F-3, NFR-3 |

**F-4 — Milestone field in planning artifacts**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** the change-specification template and the `@spec-writer` prompt, **when** a spec is authored, **then** `change.milestone` is a required front-matter field with its resolution rule stated, and this change's own spec carries a value equal to the tracker milestone title and to the pm-notes `milestone` value | F-4, DM-1, DM-3 |
| AC-F4-2 | **Given** the template set, **when** the affected templates are inspected, **then** only the change-specification template carries the field, the plan, test-plan, feature-spec, engineering-roadmap, and decision-record templates are unchanged, and the exclusion reasons are recorded | F-4, DEC-6 |

**F-5 — Planning-truth consistency**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** the backlog's M2 section, **when** it is inspected, **then** an M2-S20 block exists in the repository's story shape (Goal, Tasks, machine-checkable AC, `Depends on:`, and `- Ticket: GH-313 (milestone M2)`) and no other story block is reordered or renumbered | F-5, DM-4 |
| AC-F5-2 | **Given** the backlog's M2 section, **when** every story block is compared with the tracker, **then** all 19 M2 story blocks carry a `Ticket:` line naming their ticket and milestone (the twelve backfilled lines included), and a story whose ticket does not exist carries no fabricated line | F-5, DM-4 |
| AC-F5-3 | **Given** the backlog and the suggested-order file, **when** the two are compared as data, **then** every story code in the backlog appears exactly once in the ranking file, the ranking numbers form one contiguous sequence with no duplicate, and the M2 stories follow the backlog's M2 section order | F-5 |
| AC-F5-4 | **Given** the M2 milestone pack, **when** its index and seed file are inspected, **then** the story-to-artifact map carries the M2-S20 row and the seeds it cites exist in the pack's seed file, whose heading range covers M2-S20 | F-5, F-1 |
| AC-F5-5 | **Given** the delivered change, **when** the status snapshot is inspected, **then** it carries a delivery addendum in the established form naming M2-S20 and GH-313, and stating that M2 has not exited | F-5 |

**F-6 — Tracker-consistency evidence**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** milestones M0, M1, and M2, **when** the recorded evidence is inspected, **then** it states, per milestone, every ticket declared by that milestone's backlog section, confirms each is attached (closed tickets included) with the title prefix matching the story-code prefix, and reports zero declared tickets unattached with a gap list that is empty when green; the count of deliberately unattached `change` backlog issues is reported, not reconciled | F-6, DM-2, DM-5 |
| AC-F6-2 | **Given** the tracker at delivery, **when** GH-313 is inspected, **then** it is attached to the M2 milestone, and the M2-S20 block names it | F-6, F-5, DM-4 |

**Non-functional criteria**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR1-1 | **Given** any sequence of repeated evaluation events over a compliant, exempt, or flagged issue, **when** the tracker state is compared before and after, **then** on each repeat evaluation the check issues zero add-label actions and posts at most one comment in total, the observable tracker state is identical after any number of runs, and zero issues are flagged that carry a milestone or the exemption | NFR-1, F-3 |
| AC-NFR2-1 | **Given** the repository at the delivered HEAD, **when** the aggregate gate is inspected and run, **then** the check chain is unchanged and in order, it performs zero tracker calls, no milestone step exists in it, and `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green | NFR-2, NFR-5 |
| AC-NFR3-1 | **Given** the delivered workflow, **when** it is audited, **then** permissions are limited to `issues: write` and `contents: read`, every action reference is a 40-hex SHA pin, no `pull_request_target` and no bypass construct is present, and no secret is referenced | NFR-3, F-3 |
| AC-NFR4-1 | **Given** the documentation change set, **when** the distribution guard runs, **then** the new guide is in the derived install set, the drift guard passes, no generated plugin file was hand-edited, and the guide's only license header is the one generated by `scripts/add-header-location.sh` (byte-identical to that script's output), never a hand-written one | NFR-4, F-1 |
| AC-NFR5-1 | **Given** the delivering change, **when** the quality gates and the commit history are inspected, **then** the aggregate gate is green before the PR opens and every commit subject is conventional with body and footer lines ≤100 characters | NFR-5 |
| AC-NFR6-1 | **Given** a sweep over N ≤ 500 issues, **when** it runs, **then** reads are paged at 100, tracker reads are ≤ ceil(N/100) + 3, exactly 0 tracker writes occur, exactly 1 local summary-artifact write occurs (a repository-local file, not a tracker write), the run completes within 10 minutes, and the exit code is 0 regardless of findings | NFR-6, F-3 |
| AC-NFR7-1 | **Given** the check's comment body, **when** it is inspected against a set of adversarial issue titles, bodies, and authors, **then** the body is byte-identical in every case and contains no issue-authored string, and no untrusted text appears in the run log | NFR-7, F-3 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds the §17 acceptance criteria to a checkable outcome, names its verification method, and is proven in the delivering plan phase of `chg-GH-313-plan.yaml` that owns the capability. The change-specific DoD is the post-implementation acceptance gate (`dod_check`): `@reviewer` audits the implementation against it, then `@pm` confirms the full checklist before PR creation. This specification claims no passing evidence and no acceptance. Three framing rules, all binding:

1. **Artifact-phase gate.** Per DEC-5, PDR-0005 exists before delivery begins; a delivery phase that starts without it fails this DoD.
2. **Verification-before-record rule.** Per DEC-1 and DEC-8, the tracker and corpus claims are proven by inspection of the actual tracker and files, never by copying an intended value; a gap list is either empty or reported, never waived.
3. **No-ticket, no-residue rule.** Per NG-3, the delivering change creates no tracker tickets and leaves no tracker mutation behind for verification. Recorded evidence is the offline decision-table tests plus one read-only sweep run over the live tracker; where a live flag/clear cycle is demonstrated it runs on an already-existing unattached issue and is fully reverted, or the workflow's own first live run is cited as evidence once it occurs.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | The guide exists, is redistributable, is in the derived install set, is linked from the documentation index, and its only header is the script-generated one | F-1, AC-F1-1, NFR-4 | Distribution drift guard green; index inspection; header compared byte-for-byte against `scripts/add-header-location.sh` output | Guide phase |
| DoD-2 | The guide documents all nine topics once, names the tracker record as source of truth for the milestone identity, and states the unattended-run precondition | F-1, AC-F1-2, AC-F1-3, DM-5 | Content review against the topic list | Guide phase |
| DoD-3 | The pack conventions carry the operating rule as a pointer to the guide, with no restated procedure | F-1, AC-F1-3 | Pack-index review | Guide phase |
| DoD-4 | PDR-0005 exists before delivery and is referenced from the guide and the change | F-1, AC-F1-4, DEC-5 | Decision-register inspection | Artifact phases; verified at the delivery gate |
| DoD-5 | Ticket creation requires a milestone from an existing milestone set in both surfaces, and no autonomous milestone creation is possible; existing prohibitions are intact | F-2, AC-F2-1 | Prompt and tracker-instruction review; conformance checks | Prompts phase |
| DoD-6 | Intake verifies attachment, records the milestone in pm-notes before artifacts, and stops on an unattached ticket | F-2, AC-F2-2, DM-3 | Prompt review; this change's own pm-notes record | Prompts phase |
| DoD-7 | Bootstrapped projects inherit the rule through the generator guidance, and the generated plugin is fresh | F-2, AC-F2-3 | Guidance review; plugin freshness check | Prompts phase |
| DoD-8 | A new `change` issue without a milestone is flagged once with the label and one marked comment, with no state change | F-3, AC-F3-1, AC-F3-2, NFR-1 | Offline decision-table tests; plus the workflow's own first live run cited as evidence once it occurs — no ticket is created for the demonstration and no mutation is left behind | Check phase |
| DoD-9 | The exemption suppresses the flag; attaching a milestone clears it; detaching restores it; no duplicate comment appears | F-3, AC-F3-3, AC-F3-4 | Offline tests; a live flag/clear cycle is demonstrated only on an already-existing unattached issue and fully reverted, or the workflow's own first live run is cited as evidence once it occurs | Check phase |
| DoD-10 | The sweep reports advisories with zero tracker writes and one local summary artifact, and exits 0; reads are paged and bounded | F-3, AC-F3-5, NFR-6 | Recorded read-only sweep run over the live tracker; bounds and write discipline asserted by tests | Check phase |
| DoD-11 | The workflow's permissions, pins, and constructs satisfy the invariant battery | F-3, AC-F3-7, NFR-3 | Invariant checks green; dedicated workflow static suite green; workflow audit | Check phase |
| DoD-12 | The milestone field is required in the template and the spec-writer rules, and this change's spec carries a value equal to pm-notes and the tracker | F-4, AC-F4-1, DM-1 | Template and prompt review; front-matter comparison | Template phase |
| DoD-13 | Exactly the declared templates carry the field, and the exclusion reasons are recorded | F-4, AC-F4-2, DEC-6 | Template diff review | Template phase |
| DoD-14 | Tracker evidence proves zero declared tickets unattached across M0/M1/M2 and reports the unattached backlog count | F-6, AC-F6-1, AC-F6-2 | Evidence record with per-milestone counts and gap list | Evidence phase (PM action) |
| DoD-15 | The backlog gains the M2-S20 block and the twelve ticket lines, with no story reordering | F-5, AC-F5-1, AC-F5-2, DM-4 | File inspection; tracker cross-check | Planning-truth phase |
| DoD-16 | The ranking carries every story code once, contiguously, in backlog order; the pack carries the M2-S20 row and its seeds | F-5, AC-F5-3, AC-F5-4 | Set comparison of story codes; pack review | Planning-truth phase |
| DoD-17 | The status snapshot carries the delivery addendum in the established form | F-5, AC-F5-5 | Snapshot review | Planning-truth phase |
| DoD-18 | The comment body is static under adversarial issue content, and the run log carries no untrusted text | NFR-7, AC-NFR7-1 | Adversarial-input test | Check phase |
| DoD-19 | Full acceptance coverage: all 30 §17 criteria green, no uncovered criterion, no orphan test | §17, NFR-1..NFR-7 | Test-plan coverage matrix all Covered; execution evidence in pm-notes | Per-phase; roll-up at the final delivery phase |
| DoD-20 | The gate battery is green at the delivered HEAD and the commit history is conventional with ≤100-character body/footer lines | NFR-5, AC-NFR2-1, AC-NFR5-1 | Gate run and commit review recorded in pm-notes | Final delivery phase / quality_gates |
| DoD-21 | PR posture: a pull request against `main-tools`, left open for human review, with required CI green on the pushed HEAD; merge and owner acceptance remain external and are not claimed here | §18, DEC-12 | PR record attached to the change | Lifecycle phase 11 |

A condition without evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery**: the full 11-phase lifecycle in autonomous mode on a feature branch created from `main-tools`; the PR targets `main-tools` and stops open for human review. Commits go through the commit primitive with conventional subjects and every body/footer line ≤100 characters; `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens (DEC-12).
- **Order**: the artifact phases produce PDR-0005 and this specification; delivery then proceeds guide → templates → prompts and generated plugin → check (core, tests, workflow) → planning truth → tracker evidence, so each later surface can cite an earlier one and the evidence is produced against the finished state.
- **Adoption**: the rule binds new tickets from the moment the prompts and the check land; existing tickets are untouched and existing artifacts stay valid (§8.5). The guide is redistributable, so adopters receive the documented pattern through the normal install path; the workflow stays repository-local automation until a distribution decision is taken (7.3).
- **Communication**: the pack conventions gain the convention entry, the status snapshot gains the delivery addendum, and PDR-0005 carries the rationale for the public rule; the change makes no tracker announcements of its own.
- **Rollback**: revert-safe — disabling the workflow removes the enforcement without touching any ticket, removing the two labels is a two-click tracker action, and the prompt, template, and documentation edits revert as ordinary files. No data, state, or history is migrated, so there is nothing to undo beyond the revert.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No repository-data migration and no seeding. No state file, store layout, config schema, or artifact format is migrated; the change-specification field applies to artifacts authored from this change onward and historical specs are not backfilled (NG-7). Tracker-side, no issue is mass-edited: the flag mechanism writes only to newly created or edited issues that genuinely lack a milestone, and the sweep performs no tracker writes (it writes only a local summary artifact). The only corpus backfill is the twelve missing M2 ticket lines plus the ranking rows, which restate tracker facts already true rather than changing them.

## 20. PRIVACY / COMPLIANCE REVIEW

Low impact, and the surface is public by design. The check posts a static comment on a public issue; the comment names the repository guide path, the exemption label, and the non-blocking nature of the flag — no names, no paths, no issue content, no author identity. The guide and the tracker instructions contain no private names, fleets, or product identifiers. Nothing new is stored, transmitted, or retained: the tracker's own issue history holds the only record, and the sweep artifact contains issue numbers that are already public. No personal data, no cross-border transfer, and no compliance regime is engaged by a public-repository governance label.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Untrusted input is never echoed**: the comment body is static and no issue-authored string is interpolated into it or into logs (NFR-7, AC-NFR7-1). This is the primary injection surface, and it is closed by construction rather than by escaping.
- **Least privilege**: the workflow requests `issues: write` and `contents: read` only — it cannot change issue state, create or move milestones, or touch code (NFR-3, §8.1).
- **Supply-chain hygiene**: every action is pinned to a full commit SHA, `pull_request_target` is absent, no secret is referenced, and the workflow is subject to the repository's own invariant checks (NFR-3, RSK-5).
- **No self-escalation path**: the exemption label can be applied by anyone with label rights, which is the intended escape; it changes no state, grants no permission, and is visible in the issue history — the failure mode it enables (exemption as default) is a governance risk handled at intake, not a security boundary (RSK-2, DEC-11).
- **No new credential**: the check uses the workflow's own token; no tracker credential is provisioned, stored, or read (contrast: the truth-read key path is unchanged).
- **Reversible writes only**: the flag label and one comment are the entire write surface; reversal is a label removal, and nothing the check does is destructive.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **One procedure to maintain**: the guide owns the milestone lifecycle; the pack conventions, the tracker instructions, and the intake prompt reference it. A rule change is a guide edit plus the referencing sentence, never a second copy.
- **One vocabulary to maintain**: the flag and exemption labels, and the comment marker, are the check's contract (DM-2). Renaming them is a guide + workflow + tracker-instructions change, which is why OQ-2 asks for confirmation before they become public.
- **The check is small and idempotent**: it has no schedule, no state, and no storage; a failed run is visible and blocks nothing, so operation is "read the run summary when a flag surprises you".
- **The evidence is reproducible**: the sweep mode is the standing way to re-derive the unattached population, so a future milestone exit review can reproduce the attachment claim instead of trusting a snapshot.
- **Prompt upkeep**: the milestone rules live in three prompts plus the project configuration; a change to any of them regenerates the plugin and runs the prompt conformance checks (the standing rule for prompt edits, not a new obligation).
- **Planning corpus upkeep**: the `Ticket:` line and the ranking row are now part of the story block's definition of complete; the corpus is maintained by the delivery process as before, with the new field making drift detectable.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Milestone | The tracker record that owns a planned scope: a title with an `M<n>` prefix, a description, and an attached ticket set; the source of truth for what a plan contains |
| Milestone-first planning | The operating rule that the milestone and every attached ticket exist before work starts, so the scope can be delivered unattended without new planning decisions |
| Planned scope | The set of tickets attached to a milestone, where each traces to a backlog story block or a recorded exception, and the milestone can be delivered without taking a new scope decision |
| Entry review | The pre-work check that the milestone is open, conventionally named, and fully attached |
| Exit review | The pre-closure check that every attached ticket is closed or explicitly removed with a reason, and outcome claims are evidenced |
| Extension | Adding discovered scope to a still-open milestone, with the pack updated and the scope delta recorded |
| Reopening | Returning a closed milestone to open state with a recorded reason so discovered scope can be planned; requires repeating the entry review |
| Orphan ticket | A `change` issue with no milestone and no capture exemption |
| Flag | The `needs-milestone` label plus one marked comment applied to an orphan; never a state change, never a block |
| Capture exemption | The `backlog-capture` label marking a ticket as captured but not yet planned; it suppresses the flag and is removed when the ticket is scheduled |
| Advisory sweep | The manual, write-free report of the existing orphan population |
| Story code | The durable `M<n>-S<m>` identifier of a backlog story; its prefix matches the milestone title prefix |
| Tracker record | The milestone as the tracker holds it — number, title, state, attached issues — as opposed to its description in the planning corpus |
| Unattended run | A delivery stretch in which agents deliver a planned scope for days to weeks without new planning decisions |

## 24. APPENDICES

### Appendix A — The operating rule (reference summary)

| # | Rule |
|---|------|
| R1 | A milestone and all its linked tickets exist in the tracker before work starts |
| R2 | Every `change` ticket is attached to exactly one milestone at creation |
| R3 | A milestone title is `M<n>: <outcome phrase>`; its prefix matches the story-code prefix of its tickets |
| R4 | Agents never create milestones autonomously — they propose, the owner decides |
| R5 | Intake verifies attachment before the lifecycle begins and records the milestone in pm-notes |
| R6 | Planned scope is the attached-ticket set, each traceable to a backlog block or a recorded exception |
| R7 | A closed milestone is immutable: new scope extends an open milestone or reopens it with a recorded reason |
| R8 | An orphan ticket is flagged, never blocked; the capture exemption is the only escape |
| R9 | The tracker record is the source of truth; the planning corpus mirrors it and reports drift |

### Appendix B — File impact

| # | Surface | Path | Change | Notes |
|---|---------|------|--------|-------|
| 1 | Milestone-management guide | `doc/guides/milestone-management.md` | NEW | Redistributable marker; its only header is the one generated by `scripts/add-header-location.sh`, byte-identical to that script's output |
| 2 | Documentation index | `doc/00-index.md` | CHANGED | Guides table row |
| 3 | Change-specification template | `doc/templates/change-spec-template.md` | CHANGED | Required `change.milestone` field with its resolution rule |
| 4 | Plan, test-plan, feature-spec, engineering-roadmap, decision-record templates | `doc/templates/*` | UNCHANGED | Exclusion reasons in DEC-6 |
| 5 | `@pm` agent prompt | `.opencode/agent/pm.md` | CHANGED | Creation requires a milestone; intake verifies it |
| 6 | `@spec-writer` agent prompt | `.opencode/agent/spec-writer.md` | CHANGED | Front-matter rule gains the field |
| 7 | `@bootstrapper` agent prompt | `.opencode/agent/bootstrapper.md` | CHANGED | Generated project configuration carries the rule |
| 8 | Generated Claude Code plugin | `.ados-claude/**` (three prompts) | CHANGED (generated) | Regenerated by the build script; never hand-edited |
| 9 | Project tracker instructions | `.ai/agent/pm-instructions.md` | CHANGED | Milestone set, resolution rule, intake verification, label vocabulary |
| 10 | Issue-event workflow | `.github/workflows/ticket-milestone-check.yml` (proposed name) | NEW | Issue and dispatch events; least privilege; SHA pins |
| 11 | Repository check surface — evaluation core and runner | `scripts/checks/milestone-attachment.ts`, `scripts/checks/milestone-attachment-runner.ts` | NEW | Pure offline evaluation core plus a port-injected runner used by the workflow and the sweep; repository-internal, not distributable, not in the install set, no `ADOS_DELIVERY_SCRIPTS` entry, not chained into the aggregate gate |
| 12 | Repository check tests and fixtures | `tests/checks/milestone-attachment.test.ts`, `tests/checks/milestone-attachment-integration.test.ts`, `tests/checks/milestone-sweep.test.ts`, `tests/checks/milestone-workflow.test.ts`, `tests/checks/milestone-gate.test.ts`, `tests/fixtures/milestone-attachment/**` (events, tracker, sweep, adversarial, golden) | NEW | Offline decision-table, integration, sweep-bound, workflow-static, and gate-chain suites with their fixtures; the gate-chain suite asserts `pnpm check` gained no step and performs no tracker call |
| 13 | Guide suite | `tests/checks/milestone-guide.test.ts` | NEW | Contract/static assertions for the guide: marker, script-generated header, the nine topics, index link |
| 14 | Template and milestone-field suite | `tests/checks/milestone-artifacts.test.ts` | NEW | Asserts the required `change.milestone` field, the `@spec-writer` front-matter rule, and the declared template exclusions |
| 15 | Prompt and plugin suite | `tests/checks/milestone-prompts.test.ts` | NEW | Asserts the creation and intake rules in both prompts and the tracker instructions, the bootstrapper guidance, and the regenerated plugin currency |
| 16 | Planning-truth suite | `tests/checks/planning-truth.test.ts`, `tests/fixtures/milestone-attachment/planning/section-headings.json` | NEW | Asserts the M2-S20 block, 19/19 `Ticket:` lines, story-code set equality with contiguous ranking numbering, the pack row and seeds, and the status addendum |
| 17 | Backlog | `doc/planning/oss-tooling/backlog.md` | CHANGED | M2-S20 block; twelve `Ticket:` lines |
| 18 | Suggested delivery order | `doc/planning/oss-tooling/backlog-ranking.md` | CHANGED | M2-S11…M2-S20 rows; contiguous renumber |
| 19 | Milestone pack index | `doc/planning/oss-tooling/milestones/README.md` | CHANGED | `## Conventions` gains the operating rule as a pointer |
| 20 | M2 pack index | `doc/planning/oss-tooling/milestones/m2/README.md` | CHANGED | M2-S20 story-to-artifact row |
| 21 | M2 pack seeds | `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` | CHANGED | M2-S20 seeds; heading range covers S20 |
| 22 | Status snapshot | `doc/planning/oss-tooling/status.md` | CHANGED | Delivery addendum at delivery |
| 23 | Roadmap and planning index | `doc/planning/oss-tooling/roadmap.md`, `doc/planning/oss-tooling/README.md` | UNCHANGED | The roadmap's M2 scope enumerates product surfaces; the story lives in the backlog and the pack (7.3) |
| 24 | Decision record | `doc/decisions/PDR-0005-*.md` | NEW | Authored via `@decision-advisor` in the artifact phases |
| 25 | Milestone governance spec | `doc/spec/features/feature-milestone-governance.md` | NEW (phase 7) | Current-truth specification for the rule and its enforcement |
| 26 | Document-templates spec | `doc/spec/features/feature-document-templates.md` | CHANGED (phase 7) | The new required spec field |
| 27 | Agents-and-commands spec | `doc/spec/features/feature-agents-and-commands.md` | CHANGED (phase 7) | Creation and intake behaviour in the prompts |
| 28 | Bootstrapper spec | `doc/spec/features/feature-bootstrapper.md` | CHANGED (phase 7) | Generated configuration sections |
| 29 | Delivery-lifecycle spec | `doc/spec/features/feature-delivery-lifecycle.md` | CHANGED (phase 7) | Intake precondition |
| 30 | Autonomous-delivery spec and guide | `doc/spec/features/feature-autonomous-delivery.md`, `doc/guides/autonomous-batch-delivery.md` | CHANGED (phase 7) | Pointer to the planned-scope precondition |
| 31 | Change-lifecycle guide | `doc/guides/change-lifecycle.md` | CHANGED (phase 7) | Intake milestone precondition, attributed to the prompt |
| 32 | pm-notes and distribution-marker specs | `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md`, `doc/spec/features/feature-doc-distribution-marker.md` | UNCHANGED | The `milestone` key and the marker rule already cover the new surfaces |
| 33 | Product code and command surface | `packages/**`, `.opencode/command/**` | UNCHANGED | No feature code, no command-surface change, no phase change |
| 34 | Repository automation outside the new module | `scripts/**` (all other scripts) | UNCHANGED | No existing check or delivery script is modified or added to the aggregate chain, and no entry is added to `ADOS_DELIVERY_SCRIPTS` (the new modules of rows 11–12 are repository-internal, not distributable) |

### Appendix C — Testability notes (for the test-plan writer)

| Observation surface | What is asserted | Suggested instrument |
|---|---|---|
| Guide file | Existence, `ados_distribution: redistributable`, exactly one license header and it is the script-generated one (byte-identical to `scripts/add-header-location.sh` output), presence of the nine topics, index link | File inspection and the distribution drift guard; header compared byte-for-byte against the script's output |
| Pack index, M2 pack, status snapshot | Convention pointer present and non-duplicative; M2-S20 row; cited seeds exist; addendum form | File inspection |
| Prompts and tracker instructions | Required milestone argument, resolution rule, no autonomous creation, intake verification, preserved prohibitions | Text assertions on the prompt files plus conformance checks |
| Template and this spec | Field required; value equality across spec, pm-notes, tracker | Front-matter comparison |
| Evaluation core | The full decision table: `change`/non-`change`, open/closed, milestone present/absent, exemption present/absent, attachment/detachment events | Offline unit tests over a pure function |
| Workflow definition | Event set, permissions, SHA pins, absence of bypass constructs and `pull_request_target` | Static assertions over the workflow document by the dedicated workflow static suite, plus the CI invariant checks |
| Tracker behaviour | Flag on creation, no duplicate on repeat, exemption suppression, reversal on attach/detach, and 0 tracker writes in sweep mode | Offline decision-table tests for every verdict; one recorded read-only sweep run over the live tracker; a live flag/clear cycle only on an already-existing unattached issue and fully reverted, or the workflow's own first live run cited once it occurs — no ticket is created and no mutation is left behind |
| Backlog and ranking | Story-code set equality, contiguous numbering, M2 ordering, 19/19 ticket lines | Set comparison of parsed story codes |
| Tracker evidence | Per-milestone declared/attached counts, empty gap list, prefix match | Tracker query record |

**Workflow audit scope.** The new workflow's least-privilege permissions and SHA-pinned actions are asserted by the dedicated workflow static suite for issue-event workflows, because `scripts/checks/ci-supply-chain.ts` and `scripts/checks/ci-bindingness.ts` read only `.github/workflows/ci.yml` and enforce only `ts-`-prefixed jobs — the existing scanners stay unchanged and green.

**Scenario seeds (pack seeds for M2-S20, inherited by the test plan):**

- `SC-M2-S20-01` — A `change` issue created without a milestone is flagged once and its state is unchanged.
- `SC-M2-S20-02` — The same issue edited and relabeled is not flagged a second time and gains no second comment.
- `SC-M2-S20-03` — A `change` issue carrying the capture exemption is not flagged, and the check reports it as exempt.
- `SC-M2-S20-04` — Attaching a milestone clears the flag label; detaching restores it with no new comment.
- `SC-M2-S20-05` — The sweep reports the unattached population with zero tracker writes, one local summary artifact, and exit 0.

**Decision table (pure-core cases):**

| `change` label | Issue state | Milestone | Exemption | Event | Verdict |
|---|---|---|---|---|---|
| yes | open | absent | absent | opened/edited/labeled | `flagged` |
| yes | open | present | absent | any | `compliant` |
| yes | open | absent | present | any | `exempt` |
| yes | open | present | present | any | `compliant` |
| yes | open | attached | — | milestoned | `compliant` with flag removal |
| yes | open | absent | — | demilestoned | `restored` |
| yes | closed | absent | absent | any | `out-of-scope` |
| no | any | any | any | any | `out-of-scope` |

### Appendix D — Ticket acceptance criteria mapping

| Ticket AC (M2-S20) | Spec criteria |
|---|---|
| The guide exists with a distribution marker and is linked from the documentation index | AC-F1-1, AC-F1-2, AC-F1-3, AC-NFR4-1 |
| `@pm` instructions require attaching every new ticket to a milestone at creation | AC-F2-1, AC-F2-2, AC-F2-3 |
| A check flags tickets created without a milestone, with an explicit documented escape for pure backlog capture | AC-F3-1 … AC-F3-7, AC-NFR1-1, AC-NFR6-1, AC-NFR7-1 |
| Planning templates carry a milestone field | AC-F4-1, AC-F4-2 |
| M0/M1/M2 milestone records are consistent (every planned ticket attached, closed ones included) | AC-F5-1 … AC-F5-5, AC-F6-1, AC-F6-2, AC-NFR2-1 |

The ticket's stated tasks map as: guide authoring → F-1; the ticket-creation requirement in the PM instructions and the generator guidance → F-2; the milestone field in planning artifacts → F-4; the orphan check → F-3; the reopen/extend procedure → F-1 (a documented section); the planning-corpus updates named by the ticket's source-of-truth paragraph → F-5; the tracker consistency claim → F-6.

### Appendix E — Constraint register (carried into plan and test authoring)

- C-1: The enforcement never enters the aggregate gate; the gate stays deterministic and offline (DEC-2, NFR-2).
- C-2: No historical issue is mass-edited; the sweep performs exactly 0 tracker writes and writes exactly 1 local summary artifact (DEC-1, NG-5).
- C-3: The exemption never substitutes for attachment at intake (DEC-11).
- C-4: The flag never changes issue state and is always reversible (DEC-1, DEC-8).
- C-5: The comment body is static; no untrusted interpolation (NFR-7).
- C-6: Exactly one template gains the field (DEC-6); no other template is edited.
- C-7: Prompt edits are source-only, with the generated plugin regenerated in the same change (NFR-4, RSK-3).
- C-8: Existing rules in the tracker instructions are preserved verbatim in intent — never create tickets autonomously, untrusted-comment handling, tracker-state mapping (AC-F2-1).
- C-9: The guide owns the procedure; the pack conventions, tracker instructions, and lifecycle guide point at it and do not restate it (RSK-9).
- C-10: GH-139 owns `MS-` identifiers and the allocation matrix; this change does not touch them (DEC-4).
- C-11: Gate battery and commit hygiene per the ticket: aggregate gate green before the PR, conventional subjects, body/footer lines ≤100 characters, PR to `main-tools`, stop open (DEC-12, NFR-5).
- C-12: Verification creates no tickets and leaves no tracker residue: recorded evidence is the offline decision-table tests plus one read-only sweep run over the live tracker, and any live flag/clear demonstration runs on an already-existing unattached issue and is fully reverted (or the workflow's own first live run is cited once it occurs) (NG-3, DoD-8, DoD-9).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | spec-writer (DeepSeek V4.1 Flash) | Initial specification from GitHub issue #313 (M2-S20), the pm-notes decisions, the milestone corpus (backlog, ranking, pack indices, status snapshot), the `@pm`, `@spec-writer`, and `@bootstrapper` prompts, the change-specification template, the delivered pm-notes milestone key, and the repository's CI invariant contracts |

---

## AUTHORING GUIDELINES

Sources: GitHub issue #313 "M2-S20: Milestone-first planning and delivery (M2)" (owner-authored; acceptance quoted in intent via Appendix D); the five recorded PM decisions in `chg-GH-313-pm-notes.yaml`; the milestone corpus — `backlog.md` (M2 story blocks, `Ticket:` line convention, 6 of 18 lines present), `backlog-ranking.md` (67 rows for 76 story blocks; M2 stops at S9), `milestones/README.md` (`## Conventions` as the blueprint conventions), `milestones/m2/README.md` (story-to-artifact map, pack deviation note), `milestones/m2/test-scenarios.md` (seed style, "M2-S2 through M2-S19" range), `status.md` (delivery-addendum form), `roadmap.md` (M2 scope enumerates product surfaces); prompts and configuration — `.opencode/agent/pm.md` (ticket operations, intake, clarify-scope steps), `.ai/agent/pm-instructions.md` (ticket creation path, workflow-state mapping, label vocabulary), `.opencode/agent/bootstrapper.md` (pm-instructions guidance), `.opencode/agent/spec-writer.md` and `doc/templates/change-spec-template.md` (front-matter rules); delivered contracts — `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` (optional `milestone` key), `feature-doc-distribution-marker.md` and `scripts/.tests/test-doc-distribution.sh` (marker-derived install set and guard modes), `scripts/checks/script-surface.ts`, `ci-supply-chain.ts`, `ci-topology.ts`, `ci-bindingness.ts` (aggregate-chain ordering, SHA pins, job-scoped permissions, forbidden bypass constructs), `.github/workflows/pr-base-guard.yml` (small event-workflow precedent).

Resolutions applied against the planning open points (all resolved from recorded decisions and repository truth; nothing invented): enforcement is event-driven with an advisory sweep and a narrow exemption (DEC-1); the check stays out of the aggregate gate and splits into a pure core plus a thin workflow (DEC-2); the two ticket-template surfaces are the `@pm` creation path and the `@bootstrapper` guidance (DEC-3); the guide's content ownership is split with GH-139 (DEC-4); PDR-0005 records the rule (DEC-5); exactly one template gains the field (DEC-6); the field value form is the tracker title (DEC-7); the label vocabulary is fixed (DEC-8); the ranking file is repaired rather than appended to (DEC-9); the M2 pack gains the row and its seeds (DEC-10); the exemption is a capture marker only (DEC-11). Two questions remain genuinely open to the human and are raised as OQ-1 (the pre-existing unattached population) and OQ-2 (confirming the public label names); neither blocks authoring.

Constraints honored: scope is stated at capability level — no implementation steps, no repository code paths; artifact locations that are themselves the deliverable (the guide, the template, the prompts, the planning records, the decision record) are named as deliverables, while the check's internal layout is left to plan authoring; scenario seeds and decision-table cases are declared here because the pack carried none for this story, and are inherited by name thereafter.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-313)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, EVT-, DM-, NFR-, RSK-, DEC-, OQ-, AC-, GAP-, G-, NG-, DoD-, C-, R-, SC-)
- [x] Acceptance criteria reference at least one F-/EVT-/DM-/NFR- ID and use Given/When/Then
- [x] Change-specific Definition of Done present (§17.1) — binds all 30 ACs, the artifact-phase decision-record gate, the verification-before-record rule, the gate battery, and the PR posture with per-condition verification and plan-phase ownership
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] Out-of-scope items start with `[OUT]`
- [x] File-impact table present with new/changed/unchanged per surface (Appendix B), including the deliberate non-changes
- [x] Documentation-impact list includes the phase-7 reconciliation surfaces (Appendix B rows 25–32)
- [x] No implementation details (no internal code layout, no step-by-step tasks)
- [x] No content duplicated from linked docs (the guide owns the procedure; the pack, prompts, and lifecycle guide point at it)
- [x] Front matter validates per front_matter_rules; `change.milestone` present
