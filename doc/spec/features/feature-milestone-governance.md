---
ados_distribution: internal
id: SPEC-MILESTONE-GOVERNANCE
status: Current
created: 2026-11-14
last_updated: 2026-11-14
owners: ["engineering"]
service: delivery-os
summary: "The milestone-first operating rule and its enforcement: milestone identity and naming, attachment at ticket creation, intake verification, the canonical ordered issue-event evaluation with its five verdicts and closed write vocabulary, the capture exemption, the zero-write advisory sweep, the workflow's least-privilege posture and separation from the offline aggregate gate, the planning-corpus mirror and its consistency rules, and the user-facing documentation obligations that keep the rule discoverable and honest."
links:
  related_changes: ["GH-313"]
  decisions: ["PDR-0005"]
  guides:
    - "doc/guides/milestone-management.md"
  contracts:
    - "scripts/checks/milestone-attachment.ts"
    - "scripts/checks/milestone-attachment-runner.ts"
    - "scripts/checks/milestone-attachment-github.ts"
    - ".github/workflows/ticket-milestone-check.yml"
---

# Feature: Milestone Governance

## Overview

Milestone governance makes the milestone the enforced unit of planning and delivery. A milestone record and every ticket attached to it exist in the tracker before work starts; every new `change` ticket is attached to an existing milestone at creation; intake verifies the attachment before artifact phases begin; and a non-blocking issue-event check flags a milestone-less `change` issue, reverses the flag when a milestone is attached, and reports historical debt through a write-free advisory sweep. The operating rule is recorded in [PDR-0005](../../decisions/PDR-0005-milestone-first-planning-and-delivery.md) and stated once, as a procedure, in the [milestone-management guide](../../guides/milestone-management.md).

The rule serves one operating mode: an unattended delivery run that spans days to weeks without new planning decisions. The milestone record answers "is this scope self-contained?" from the tracker, and the check makes new drift visible without blocking any delivery.

## Business Context

### Problem Statement

- **Problem:** The milestone is a planning convention with no attachment point in the ticket-creation path and no observer anywhere in the repository. A change ticket can be created without a milestone, traverse the full delivery lifecycle, and surface as an orphan only when a human reads the tracker by hand. Legitimate backlog capture and accidental orphans are indistinguishable, and the committed planning corpus can drift from the tracker without any surface reporting it.
- **Affected Users:** The owner who plans and starts unattended runs; `@pm` and every delivery agent that creates or intakes work; adopters who receive the redistributable guide and bootstrapped tracker instructions.
- **Business Impact:** Without the rule, an unattended run can start on an incomplete scope, milestone records cannot state their own completeness, and planning decisions are discovered mid-run instead of before it.

### Goals & Success Metrics

- **Primary Goal:** Make "a milestone and all its linked tickets exist before work starts" a checkable tracker fact and a documented procedure, enforced at creation and intake and observed without blocking.
- **KPIs:** New `change` tickets that are neither attached nor explicitly captured: 0 unflagged. Check comments per issue: at most one ever. Historical issues written by the check or the sweep: 0. Planning-corpus story codes missing from the suggested-order file: 0. Tracker calls inside the aggregate gate: 0.

## User Experience & Functionality

### Capabilities

- **Milestone identity and naming (F-1):** A milestone title is `<M<n>>: <human-readable outcome phrase>`. The `<n>` prefix is the durable human identifier and matches the story-code root of the tickets planned under the milestone (`M<n>-S<m>`); the tracker's milestone number is only an API handle. The tracker record — number, title, state, and attached issues — is the source of truth for identity, attachment, and state.
- **Creation and attachment at creation (F-2):** Milestones are created by the human owner from a plan (outcome phrase, one-line goal, planned ticket list). An agent never creates a milestone autonomously; a missing milestone is proposed to the human exactly as a ticket would be proposed. Every `change` ticket is attached to exactly one milestone at creation, resolved from the project's existing milestone set, using the tracker's native milestone field rather than an umbrella issue, a label, or a body checklist.
- **Intake verification (F-3):** Intake confirms the ticket's attachment and records the milestone title in `chg-<workItemRef>-pm-notes.yaml` under `milestone` before artifact phases begin. An unattached ticket produces a question naming the milestone the PM proposes; artifact phases start only after the attachment exists. A ticket carrying the capture exemption is still unattached for delivery purposes and produces the same question and stop.
- **Milestone lifecycle (F-4):** Entry review requires an open milestone with a conventional title, every planned ticket attached, and every attached ticket traceable to a backlog story block or a recorded exception. Planned scope is the attached-ticket set. Exit review requires every attached ticket closed or explicitly removed with a recorded reason and every outcome claim evidenced. A milestone closes only after exit review and is then an immutable record. Scope discovered mid-milestone either extends the open milestone or reopens the closed one with a recorded reason and a repeated entry review; work is never silently attached to a closed milestone.
- **Ordered issue-event evaluation (F-5):** One issue event is evaluated at a time against a fixed input set, producing exactly one verdict from `compliant`, `exempt`, `flagged`, `restored`, and `out-of-scope`, and at most the closed write set `addFlag`, `removeFlag`, `postMarkerComment`, and `writeJobSummary`. The ordered contract, its precedence, and the two flag-write paths are below.
- **Capture exemption (F-6):** The `backlog-capture` label marks a `change` issue as captured but not yet planned. It suppresses the flag on every event, outranks both a milestone and an existing flag, is removable at any time, and is never a delivery licence: intake still requires a milestone before the lifecycle starts.
- **Advisory sweep (F-7):** A manual dispatch mode reads `change`-labelled issues in pages of 100, reports the open unattached population minus exempted issues, writes exactly one local summary artifact and one job summary, performs zero tracker writes, and exits successfully whatever the finding count.
- **Planning-corpus mirror (F-8):** The tracker is the canonical scope; the committed planning corpus mirrors it. Every created story carries a `- Ticket: GH-<n> (milestone M<n>)` line directly under its story heading; the suggested-order file carries every story code exactly once in one contiguous sequence in backlog order; the milestone pack carries a story-to-artifact row and the scenario seeds it cites; and the status snapshot records a delivery addendum. Drift is reported rather than assumed away.
- **User-facing documentation obligations (F-9):** The operating rule is documented once, in the redistributable guide, with the milestone pack conventions and the lifecycle guide pointing at it rather than restating it. A new user-facing document under `doc/` outside `doc/changes/**` and `doc/decisions/**` is registered in `scripts/checks/forbidden-literals.registry.json` unless it exists at the pinned corpus baseline; the scan fails closed on an unregistered page.

### The canonical evaluation order (F-5)

Inputs per evaluation: the event `action` (`opened`, `edited`, `labeled`, `unlabeled`, `milestoned`, `demilestoned`, `reopened`), the issue `state` (`open` or `closed`), the labels `change`, `needs-milestone`, and `backlog-capture`, the milestone's presence, and whether a comment carrying the check's stable marker already exists. Issue-authored text — title, body, author, label text — is never an input and is never interpolated into output.

The evaluation applies one order, first match wins:

| # | change | state | exemption | milestone | flag | marker | action | verdict | writes |
|---|--------|-------|-----------|-----------|------|--------|--------|---------|--------|
| 1 | absent | any | any | any | any | any | any | `out-of-scope` | none |
| 2 | present | not open | any | any | any | any | any | `out-of-scope` | none |
| 3 | present | open | present | any | any | any | any | `exempt` | none |
| 4 | present | open | absent | present | present | any | any | `compliant` | `removeFlag` |
| 5 | present | open | absent | present | absent | any | any | `compliant` | none |
| 6 | present | open | absent | absent | absent | absent | `opened` | `flagged` | `addFlag`, `postMarkerComment` |
| 7 | present | open | absent | absent | absent | present | `opened` | `flagged` | `addFlag` |
| 8 | present | open | absent | absent | present | any | `opened` | `flagged` | none |
| 9 | present | open | absent | absent | absent | present | `demilestoned` | `restored` | `addFlag` |
| 10 | present | open | absent | absent | present | present | `demilestoned` | `restored` | none |
| 11 | present | open | absent | absent | absent | absent | `demilestoned` | `out-of-scope` | none |
| 12 | present | open | absent | absent | present | any | `edited` / `labeled` / `unlabeled` / `reopened` | `flagged` | none |
| 13 | present | open | absent | absent | absent | present | `edited` / `labeled` / `unlabeled` / `reopened` | `out-of-scope` | none |
| 14 | present | open | absent | absent | absent | absent | `edited` / `labeled` / `unlabeled` / `reopened` | `out-of-scope` | none |

Precedence and write rules:

- **Exemption outranks everything after scope.** An exempt issue is never written, even when a stale flag is present; the stale flag stays visible for a human to remove (row 3).
- **A milestone clears the flag.** A milestone-present issue is `compliant` and only removes a stray flag; no comment is posted (rows 4–5).
- **The flag has exactly two write paths.** The first flag is written on an `opened` event (rows 6–7), and the flag is restored on a `demilestoned` event where the marker comment already exists (row 9). The flag is applied at most once per flag-present state.
- **A human removal is respected.** `edited`, `labeled`, `unlabeled`, and `reopened` events never re-apply the flag. On a pre-existing unattached issue with no marker comment they are `out-of-scope` with zero writes (rows 13–14).
- **A `demilestoned` event without a marker is out of scope** (row 11), so a pre-existing unattached issue is never restored.
- **A `milestoned` event with no milestone reported is out of scope** with zero writes; when the milestone is present the milestone rule (rows 4–5) applies.
- **The comment is static.** At most one marked comment is ever posted, with a fixed body naming the guide, the flag, the exemption, and the non-blocking nature of the flag.
- **No other tracker write exists.** There is no state transition, assignee change, milestone mutation or creation, or other label write.
- **Every evaluated run writes one job summary** to the run's summary target naming the issue number, the verdict, and the tracker writes performed (`none` when there were none). The job summary is not a tracker write.

### User Flows

```
Plan a milestone        owner creates "M<n>: <outcome phrase>" and attaches every planned ticket
                        → entry review: open, conventional title, every ticketed story attached
                        → the attached-ticket set is the planned scope; the run may start unattended

Create a ticket         @pm resolves an existing milestone from the project's set
                        → creates the ticket with title, body, labels, and that milestone
                        → records the workItemRef; the backlog block gains its Ticket line
                        (no milestone fits → propose one to the human; never create it)

Intake a change         @pm reads the ticket and its milestone
                        → attached: record it in pm-notes and continue to artifacts
                        → unattached (or capture-exempt): ask the human, naming the proposed
                          milestone, and stop until the attachment exists

A ticket enters         opened, change, no milestone, no exemption, no flag, no marker
without a milestone     → flagged: addFlag plus one marked comment
                        → edited or relabeled: flagged, zero writes
                        → milestoned: compliant, removeFlag; the comment stays as history
                        → demilestoned with the marker: restored, addFlag; no new comment
                        → a human removes the flag, then edits: out-of-scope, zero writes

Capture a backlog idea  ticket created with backlog-capture and no milestone
                        → exempt on every event; when scheduled, attach a milestone and remove the label

Sweep the debt          manual dispatch → advisory report, one local artifact, zero tracker writes, exit 0
```

### Edge Cases & Error Handling

- **Pre-existing unattached issue edited or relabeled:** no marker comment exists, so the catch-all rows apply and nothing is written; historical debt is never converted into a new flag.
- **A human removes the flag by hand:** the next event does not re-apply it; only a fresh `opened` flag or a `demilestoned` restore where the marker exists writes the flag again.
- **A closed or non-`change` issue:** out of scope on every event, with zero writes.
- **Tracker API failure:** the run fails loudly; there is no `continue-on-error` and no bypass construct, so an outage cannot present as a clean pass. The check is not a required status, so a failed run blocks nothing.
- **Sweep with zero findings or a large population:** the run still exits 0, writes the one artifact, and reports the counts.
- **A milestone attached while the flag is absent:** `compliant` with zero writes. A milestone detached from an issue whose marker predates the rule never restores a flag that was never written.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `doc/guides/milestone-management.md` | Operating-rule guide | States naming, creation, attachment, entry review, planned scope, exit review, closure, extension/reopening, and enforcement once; redistributable; points at PDR-0005 |
| `doc/planning/oss-tooling/milestones/README.md` | Milestone pack conventions | Records the operating rule as a convention pointer to the guide, with no restated procedure |
| `scripts/checks/milestone-attachment.ts` | Evaluation core | Pure and offline: normalised input to exactly one verdict plus the closed write vocabulary; no clock, environment, port, or network; exports the flag and exemption labels, the marker token, and the static comment body |
| `scripts/checks/milestone-attachment-runner.ts` | Port-injected orchestration | Reads the issue and comments, applies only the core's writes through injected tracker ports, emits the job summary, and runs the zero-write advisory sweep with its one local artifact |
| `scripts/checks/milestone-attachment-github.ts` | GitHub adapter | The sole network-capable module: issue, comment, label, and milestone reads plus the closed label and comment writes; read-only in sweep mode; used by the workflow and by an operator-run sweep; not imported by anything reachable from the aggregate gate |
| `.github/workflows/ticket-milestone-check.yml` | Issue-event workflow | Consumes the seven issue actions plus a manual dispatch sweep; job-scoped permissions `contents: read` and `issues: write`; SHA-pinned actions; no secret, no `pull_request_target`, no bypass construct, no schedule |
| `.ai/agent/pm-instructions.md` | Project tracker instructions | Declares the project's milestone set, the attach-from-existing resolution rule, the label vocabulary, intake verification, and the backlog source of truth |
| `.opencode/agent/pm.md` | PM prompt | Tracker-agnostic creation and intake rules; a missing milestone is proposed, never created |
| `.opencode/agent/spec-writer.md` | Spec-writer prompt | Requires `change.milestone` in change-spec front matter with its value and `none` rules |
| `.opencode/agent/bootstrapper.md` | Bootstrapper prompt | Generates the milestone section in a new project's tracker instructions |
| `doc/templates/change-spec-template.md` | Change-spec template | Carries the required `change.milestone` field with its resolution rule |
| `scripts/checks/forbidden-literals.registry.json` | Documentation registry | Registers each new user-facing page so the forbidden-literal scan is total and fails closed |

### Least privilege and gate separation

The workflow requests only the two scopes its contract needs: `contents: read` to check out the evaluation code and `issues: write` to read and write issues. Every action is pinned to a full 40-hex commit SHA. No secret is referenced; the workflow uses its own token. The job cannot change issue state, create or move milestones, or touch code.

The enforcement is deliberately outside `pnpm check`. The aggregate gate stays deterministic and offline: it performs zero tracker calls, keeps its check order, gains no milestone step, and does not import the network-capable adapter. The offline test suite pins the evaluation contract; the workflow's own runs are evidence, not a build gate. The evaluation core is pure, so the decision table is testable without a tracker.

### Data and vocabulary

- **`change.milestone`:** required change-spec front-matter field whose value is the tracker milestone title verbatim (equal to the pm-notes `milestone`); the literal `none` is permitted only where the project's tracker instructions declare no milestone construct.
- **Flag label:** `needs-milestone`.
- **Exemption label:** `backlog-capture`.
- **Comment marker:** a stable marker token inside the one comment the check posts, used to recognize its own prior output.
- **Sweep artifact:** `tmp/milestone-attachment-sweep.json`, schema `milestone-attachment-sweep.v1`, carrying the inspected total, the open `change` count, the exempted count, the unattached count and issue numbers, the zero tracker-write statement, and the artifact path.

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Flag precision and idempotency | Zero flags on issues carrying a milestone or the exemption; at most one check comment ever; at most one flag write per flag-present state; no re-application outside the `opened` and `demilestoned`-with-marker paths | Offline suite green for every contract row |
| NFR-2 | Gate determinism | The aggregate gate performs zero tracker calls, keeps its check chain and ordering, and gains no milestone step | Chain inspection and gate-chain suite green |
| NFR-3 | Workflow privilege and supply chain | Job permissions limited to `issues: write` and `contents: read`; every action pinned to a 40-hex SHA; no `pull_request_target`, no secret, no bypass construct | Workflow static suite and CI invariant checks green |
| NFR-4 | Sweep bounds and write discipline | Reads paged at 100; at most `ceil(N/100) + 3` tracker reads for `N` issues; exactly zero tracker writes; one job summary and one local artifact; exit 0 regardless of findings | Sweep-bound suite green |
| NFR-5 | Comment safety | The comment body is static; zero issue-authored strings are interpolated into it or into logs | Adversarial-input suite green |
| NFR-6 | Documentation totality | Every new user-facing page is registered or present at the pinned corpus baseline; the scan fails closed otherwise; redistributable pages carry a valid distribution marker and pass the drift guard | Forbidden-literal scan and distribution guard green |
| NFR-7 | Reversibility | The flag and exemption are removable by a human at any time; disabling the workflow removes enforcement without touching a ticket | Manual audit |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Offline unit | Decision table | `tests/checks/milestone-attachment.test.ts` covers every ordered row, precedence, and the two flag-write paths |
| Offline integration | Runner against injected ports | `tests/checks/milestone-attachment-integration.test.ts` asserts one verdict per event, the closed write set, no duplicate comment, and no state or unrelated-label write |
| Offline unit | Sweep bounds and zero writes | `tests/checks/milestone-sweep.test.ts` asserts paging, read bounds, the artifact, exit 0, and zero tracker writes |
| Static | Workflow definition | `tests/checks/milestone-workflow.test.ts` asserts the event set, job permissions, SHA pins, secret absence, and bypass-construct absence, with a mutation proof |
| Static | Gate separation | `tests/checks/milestone-gate.test.ts` asserts the aggregate chain gained no step and nothing it reaches imports the network adapter |
| Static | Guide, template, prompts, and plugin | `tests/checks/milestone-guide.test.ts`, `tests/checks/milestone-artifacts.test.ts`, and `tests/checks/milestone-prompts.test.ts` assert the guide contract, the required spec field, the prompt rules, and generated-plugin freshness |
| Static | Planning truth | `tests/checks/planning-truth.test.ts` asserts the story block, ticket lines, contiguous ranking, pack row and seeds, and status addendum |
| Adversarial | Comment safety | The adversarial fixture set asserts a byte-identical comment body and no issue text in output |

## Operational & Support

### Observability

- Every evaluated run appends one job summary naming the issue, the verdict, and the writes performed; the sweep summary states the inspected, exempted, and unattached counts and that no tracker write occurred.
- The `needs-milestone` label is the standing, queryable state: "how many orphans exist now" is a tracker query, not a dashboard.
- A tracker API failure fails the run visibly. Because the check is not a required status, the failure blocks no delivery.

### Maintenance

- The guide owns the procedure; the pack conventions, tracker instructions, and lifecycle guide point at it. Changing the rule is a guide edit plus the referencing sentence, never a second copy.
- The flag and exemption names, the comment marker, and the verdict vocabulary are the check's contract; a rename moves the guide, the workflow, and the tracker instructions together.
- The sweep is the standing way to re-derive the unattached population for a milestone exit review.

## Dependencies & Risks

- **Depends on:** the tracker supporting native milestone fields on issues and milestone attach/detach events; label and comment reads/writes scoped to `issues: write`; and the delivered pm-notes `milestone` key.
- **Depends on:** the redistributable guide's distribution marker and the forbidden-literal registry, so new documentation is installed and scanned deliberately.
- **Risk:** advisory rather than preventive enforcement — an orphan can still be delivered if a human ignores the flag. Mitigated by interception at creation and intake; measured at milestone exit.
- **Risk:** the exemption becomes the default — mitigated by intake still requiring a milestone and the sweep reporting exempt counts.
- **Risk:** guide, prompts, and workflow drift apart — mitigated by one vocabulary, one procedure owner, and the offline decision-table suite.
- **Risk:** the workflow regresses on permissions, pins, or topology — mitigated by the static workflow suite and the repository's invariant checks.

## Glossary

| Term | Definition |
|------|-----------|
| Milestone | The tracker record that owns a planned scope: a title with an `<M<n>>` prefix, a description, and an attached ticket set; the source of truth for what a plan contains |
| Planned scope | The attached-ticket set, where each ticket traces to a backlog story block or a recorded exception and the milestone is deliverable without a new scope decision |
| Entry review | The pre-work check that the milestone is open, conventionally named, and fully attached |
| Exit review | The pre-closure check that every attached ticket is closed or explicitly removed with a reason, and outcome claims are evidenced |
| Orphan ticket | A `change` issue with no milestone and no capture exemption |
| Flag | The `needs-milestone` label applied to an orphan; never a state change and never a block |
| Capture exemption | The `backlog-capture` label marking a ticket as captured but not yet planned |
| Advisory sweep | The manual, write-free report of the existing orphan population |
| Story code | The durable `<M<n>>-S<m>` identifier of a backlog story; its prefix matches the milestone title prefix |

## Related Documentation

- **Operating-rule guide:** [milestone-management.md](../../guides/milestone-management.md) — naming, creation, attachment, entry and exit review, planned scope, closure, extension/reopening, enforcement.
- **Decision record:** [PDR-0005](../../decisions/PDR-0005-milestone-first-planning-and-delivery.md) — the precedent-setting rule, its alternatives, constraints, and revisit triggers.
- **Pack conventions:** [doc/planning/oss-tooling/milestones/README.md](../../planning/oss-tooling/milestones/README.md) — the convention pointer to the guide.
- **Spec field:** [feature-document-templates.md](feature-document-templates.md) — the required `change.milestone` template field.
- **Prompt rules:** [feature-agents-and-commands.md](feature-agents-and-commands.md) — creation, intake, and generated-plugin obligations.
- **Lifecycle intake:** [feature-delivery-lifecycle.md](feature-delivery-lifecycle.md) — the phase-1 precondition.
- **Unattended runs:** [feature-autonomous-delivery.md](feature-autonomous-delivery.md) — the planned-scope precondition for unattended delivery.
- **Tracker instructions:** `.ai/agent/pm-instructions.md` — the project's milestone set, resolution rule, label vocabulary, and intake verification.
