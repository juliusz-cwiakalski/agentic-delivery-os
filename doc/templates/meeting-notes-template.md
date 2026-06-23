---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/meeting-notes-template.md
id: MEETING-<YYYY-MM-DD>-<slug>
status: Draft # Draft | Accepted
meeting_date: <YYYY-MM-DD>
meeting_type: standup # standup | planning | review | retro | decision | 1-1 | all-hands | interview | working-session | brainstorming | war-room | incident | design-review | technical-spike | other
attendees: [<name1>, <name2>]
recording_url: null # link to video/audio recording if available
transcript_url: null # relative path to doc/meetings/transcripts/<file> or external URL
facilitator: <name>
note_taker: <name>
timekeeper: <name>
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

> **Lifecycle:** This document starts as an **agenda** before the meeting and is extended into a **summary** afterward. Update `status` from `Draft` to `Accepted` and `document_classification` from `raw-evidence` to `current-truth` once the summary is finalized.

> **Two ways to share the agenda:**
> - **Copy/paste:** select the "Agenda & Preparation" block below and paste it into the calendar invite.
> - **Git-native:** commit this file (or open a PR) before the meeting and share the file/PR URL as the calendar invite link. Collaborators can comment on the agenda, ask questions, and propose additions before the meeting starts.

> **Transcripts:** Store full transcripts in `doc/meetings/transcripts/YYYY-MM-DD-<topic-slug>.txt` (one click away) and link via `transcript_url` in front matter. Do not inline transcripts — they are large and noisy.

---

## Agenda & Preparation (copy/paste into invite)

> **Goal:** <one sentence — what this meeting must achieve. Format: [Decision/Outcome] for [Stakeholder] by [Deadline]>

> **Why now:** <brief context — what triggered this meeting>

### Topics (with time estimates)

| Time | Topic | Owner | Expected outcome |
|------|-------|-------|------------------|
| 5 min | <topic> | <name> | <decision \| discussion \| update \| feedback> |
| 10 min | <topic> | <name> | <decision \| discussion \| update \| feedback> |
| 5 min | Action items review & wrap-up | <facilitator> | owners + due dates |

### Preparation required

- **Pre-reads:** <links to documents to review before the meeting>
- **Pre-work:** <tasks to complete before the meeting>
- **Questions to prepare:** <optional — questions attendees should think about>

### Attendees & Roles

- **Required:** <name1> (decision-maker), <name2> (subject-matter expert)
- **Optional:** <name3> (visibility)
- **Facilitator:** <name> — **Note-taker:** <name> — **Timekeeper:** <name>

### Decision framework (for decision meetings)

- Framework: <DACI | RAPID | consent | consensus | N/A>
- Driver/Approver/Contributors: <names>

---

## Discussion

> Capture key points by topic — not verbatim transcript. Use bullets.

### <topic from agenda>

<notes, insights, concerns raised>

### <topic from agenda>

<notes>

## Decisions

> Record accepted decisions with brief rationale. File significant decisions as ADR/PDR/BDR records and cross-link via `related_decisions`.

- **<decision statement>** — Rationale: <why>. Implication: <what changes>. → <ADR/PDR/BDR-ID if applicable>

## Action Items

> Each item: verb-first task, SINGLE owner, specific due date. Send action items within 60 minutes of meeting end.

- [ ] <action description> — **Owner:** <name> — **Due:** <YYYY-MM-DD> — **Context:** <why it matters>
- [ ] <action description> — **Owner:** <name> — **Due:** <YYYY-MM-DD> — **Context:** <why it matters>

## Ideas

> For brainstorming sessions: capture ALL ideas without judgment during the meeting. Evaluate post-meeting by feasibility x impact. Move accepted ideas to Decisions or Action Items.

- <idea>
- <idea>

**Evaluation (post-meeting):**

| Idea | Feasibility | Impact | Verdict |
|------|------------|--------|---------|
| <idea> | Low/Med/High | Low/Med/High | <pursue \| park \| drop> |

## Open Questions

> Unresolved items needing follow-up. Assign an owner to investigate each.

- **<question>** — Owner: <name> — Revisit by: <YYYY-MM-DD or next meeting>
- **<question>** — Owner: <name> — Revisit by: <YYYY-MM-DD or next meeting>

## Parked Items

> Parking lot: off-topic items noted for future attention without derailing this meeting. Review at the start of the next meeting.

- <parked topic> — Proposed next step: <follow-up meeting \| async thread \| add to backlog>
- <parked topic> — Proposed next step: <...>

## Notes Worth Keeping

> Durable insights beyond decisions and actions: patterns, risks, context, agreements, constraints discovered. These inform future work even if no specific action is assigned.

- <insight, pattern, or constraint discovered>
- <risk identified>

## Follow-Up

- **Summary distributed:** <YYYY-MM-DD> (target: within 24 hours)
- **Action items sent:** <YYYY-MM-DD> (target: within 60 minutes)
- **Next meeting:** <date or "N/A — one-time">
- **What to prepare for next meeting:** <description or "N/A">

## Links

- Recording: <url or "N/A">
- Transcript: <`doc/meetings/transcripts/YYYY-MM-DD-<topic-slug>.txt` or "N/A">
- Related changes: <workItemRef list>
- Related decisions: <ADR/PDR/BDR IDs>
