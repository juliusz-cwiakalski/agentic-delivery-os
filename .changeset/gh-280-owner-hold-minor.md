---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the owner hold that outranks provider windows: one injected fact with a
brand-derived environment source and a fixed production-store marker, a DM-1
example hook with an unbounded MAX driver and no fixed iteration cap, and a
global read-only gate that suppresses next actions, refuses supplied-ref and
no-ref claims and dispatches with `queue.precondition.unmet`/`owner-hold`, and
skips park auto-recovery while preserving every record for resume. Status gains
the additive evidence-level `providers.evidence.ownerHold` member and human
suffix. Doctor keeps the provider check `ok` and adds the single non-failing
`owner-hold` annotation reason plus a bounded detail that survives the detail
clamp whenever a `DoctorComposition` is supplied; this is a command-runtime
capability, the production composer supplies no `DoctorComposition` today, and
in production `status` carries the hold in its digest while `queue list`,
`queue plan`, `lanes`, and `queue watch` report it on their own surfaces. Queue
ready is unchanged, no park cause or state record kind is added, and doctor
verdicts and exits are unchanged.
