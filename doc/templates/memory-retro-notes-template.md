---
ados_distribution: redistributable
---

# Retro-Note Conventions Template

Template for a project's retro-note conventions — the documentation-only carrier for retrospective learning until ceremony tooling exists. It prescribes append-only notes with a generated index and ships no ceremony, command, or automation; when a ceremony runner arrives, it adopts these conventions rather than replacing them.

## Conventions

- **Append-only notes.** Retro notes are dated files appended under the project's retro location (for example `doc/inception/retrospective/` during inception, or a retro area the project designates). An existing note is never rewritten in place; a correction is a new dated note that links the one it corrects.
- **Generated index.** A retro index lists one line per note — date, topic, outcome — generated from the notes, never hand-maintained as a second authority.
- **Promotion is gated.** A retro observation becomes durable memory only through the capture bar, and routes through the promotion path to exactly one home (lessons or tacit). Both rules live in the `AGENTS.md` memory section and the coordinator instructions; this document references them and never duplicates them.
- **Documentation only.** No ceremony runner, no commands, no action registry ships with these conventions.

## Discipline

- Write retro notes at event time (phase exits, incidents), not in wrap-ups.
- Cite evidence in every note; a note without an evidence link is scratch.
- No secrets, tokens, credentials, or private identifiers in any note.
