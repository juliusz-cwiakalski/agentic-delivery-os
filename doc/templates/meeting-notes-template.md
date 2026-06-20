---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/meeting-notes-template.md
id: MEETING-<YYYY-MM-DD>-<slug>
status: Draft # Draft | Accepted
meeting_date: <YYYY-MM-DD>
meeting_type: standup # standup | planning | review | retro | 1-1 | all-hands | interview | working-session | other
attendees: [<name1>, <name2>]
recording_url: null # link to recording/transcript if available
document_classification: raw-evidence # raw-evidence | current-truth
source_type: meeting
synthesis_status: raw # raw | in-review | synthesized
owners: [<owner-or-team>]
area: meetings
links:
  related_decisions: []
  related_changes: []
  related_documents: []
summary: "<one-line summary of the meeting>"
---

# Meeting Notes: <topic>

> **Storage rule:** Repo-scoped meetings live in `doc/meetings/` of the implementation repository. Cross-repo, product, or business meetings live in `doc/business/meetings/` of the canonical strategy repository (requires `business_docs_enabled: true`). See `doc/documentation-handbook.md` §2b.

> **Classification rule:** Raw agendas, live minutes, and transcripts are `raw-evidence`. Once the group accepts the summary, decisions, and action items, mark the document `document_classification: current-truth` and `synthesis_status: synthesized`. Significant decisions should also be recorded as ADR/PDR/BDR records in `doc/decisions/`.

## Attendees

- <name> — <role>

## Agenda

1. <topic>
2. <topic>

## Discussion

### <topic>

<notes>

## Decisions

- <decision> → <decision-record-id if applicable>

## Action Items

- [ ] <action> — <owner> — <due-date>

## Links

- Recording/transcript: <url or "N/A">
- Related changes: <workItemRef list>
- Related decisions: <ADR/PDR/BDR IDs>
