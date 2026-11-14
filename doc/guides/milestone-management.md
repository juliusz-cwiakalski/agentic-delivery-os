---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/milestone-management.md
ados_distribution: redistributable
id: GUIDE-MILESTONE-MANAGEMENT
status: Draft
created: 2026-11-14
owners: ["engineering"]
summary: "The milestone-first operating rule: naming, creation, attachment, entry and exit review, planned scope, closure, extension and reopening, and enforcement."
links:
  decisions: ["PDR-0005"]
---

# Milestone Management

This guide owns the milestone-first operating rule. A milestone is the tracker's
unit of planning and delivery: the milestone record and every ticket attached
to it exist before work starts, so a planned scope can be delivered unattended
without taking new planning decisions along the way.

The rule is recorded as a precedent-setting product decision in
[PDR-0005](../decisions/PDR-0005-milestone-first-planning-and-delivery.md)
(`doc/decisions/PDR-0005-milestone-first-planning-and-delivery.md`). This guide
states the procedure once; project tracker instructions, packs, and templates
point here rather than restating it.

## Naming

A milestone title is `<M<n>>: <human-readable outcome phrase>`. The `<n>`
prefix is the durable human identifier: it matches the story-code root of the
tickets planned under the milestone (`M<n>-S<m>`), while the tracker's milestone
number is only an API handle. The tracker record — number, title, state, and attached issues — is the
source of truth for identity, attachment, and state; the planning corpus mirrors
that record.

## Creation

Milestones are created by the human owner from a plan. The owner states the
outcome phrase, a one-line goal, and the planned ticket list, and then creates
the tracker milestone record. An agent that sees a missing milestone proposes
one exactly as it would propose a ticket; an agent never creates a milestone
autonomously. The owner decides whether the scope is a milestone at all.

## Attachment

Every `change` ticket is attached to exactly one milestone at creation.
Attachment lives on the ticket record as the tracker's native milestone field,
never as an umbrella issue, a label, or a body checklist. The planning corpus
mirrors the attachment with a line of this exact shape directly under the
story block's heading:

```
- Ticket: GH-<n> (milestone M<n>)
```

New work is never silently attached to a closed milestone.

## Entry review

Before work starts on a milestone, the owner or an agent acting for the owner
performs the entry review:

- the milestone is open;
- its title follows the naming convention;
- every planned ticket exists and is attached;
- every attached ticket traces to a backlog story block or to an exception
  recorded in the milestone pack.

The entry review establishes the unattended-run precondition: a milestone and
all its linked tickets exist in the tracker before work starts. An unattended
run may proceed only after that precondition holds.

## Planned scope

Planned scope is the attached-ticket set. A milestone is deliverable without a
new scope decision when every attached ticket traces to a backlog story block
or a recorded exception, and no planned work is missing from the attachment
set. A ticket carrying the capture exemption is captured, not planned: its
milestone still has to be resolved before its lifecycle starts.

## Exit review

Exit review precedes closure. Every attached ticket must be closed, or removed
from the milestone with a recorded reason, and every outcome claim must be
evidenced. A ticket that is still open or unresolved is a gap in the exit
review, not an implied completion.

## Closure

A milestone closes only after exit review. Once closed, the milestone record is
an immutable record of what was planned and delivered; closure is not a licence
to keep attaching work silently.

## Extension and reopening

Scope discovered mid-milestone follows one of two paths:

- **Extension** — when the milestone is open, attach the new ticket, update the
  milestone pack, and record the scope delta.
- **Reopening** — when the milestone is already closed, set the record open,
  record why, update the pack, and repeat the entry review.

There is no third path. Work is never silently attached to a closed milestone.

## Enforcement

The operating rule is enforced at creation, at intake, and by a non-blocking
event-driven check.

The check evaluates issue events against a closed input set and applies one
ordered verdict: an issue that is not open or does not carry the `change` label
is out of scope; the `backlog-capture` exemption wins over both a milestone and
a flag; a milestone present is compliant; only a milestone-less `change` issue
reaches the flagging rules. The flag label is `needs-milestone` and the capture
exemption label is `backlog-capture`.

The flag is applied at most once per flag-present state. The only two flag
write paths are the first flag on an `opened` event and a restoration on a
`demilestoned` event where the check's marker comment already exists. The check
posts at most one marked comment ever, never changes issue state, assignee, or
any other label, and never blocks delivery. A human who removes the flag by hand
is respected: an `edited`, `labeled`, `unlabeled`, or `reopened` event never
re-applies it. The capture exemption is the only escape for pure backlog
capture; it is removable at any time and is never a delivery licence. A manual
sweep reports the existing unattached population as an advisory summary and a
local artifact, performs zero tracker writes, and exits successfully whatever
the finding count.

## Related documents

- [PDR-0005 — Milestone-First Planning and Delivery](../decisions/PDR-0005-milestone-first-planning-and-delivery.md)
- [Change lifecycle](change-lifecycle.md)
- [Milestone pack conventions](../planning/oss-tooling/milestones/README.md)
