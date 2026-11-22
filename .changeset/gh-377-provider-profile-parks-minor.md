---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Make recorded provider parks and per-declared-target watch staleness synchronous
eligibility inputs to profile selection, so a parked provider can no longer reach
the `--for-spawn` env record. Seat resolution re-checks every effective seat
model against recorded unavailability, substitutes the same seat from the first
valid later profile through the same memoized probe, and refuses
`provider.profile.unavailable` as the delivered data envelope when no profile
supplies it. The change adds no live fetch, credential read, state write, or
vocabulary member; the committed provider policy is untouched, and TDR-0075
records the narrowed watch-staleness boundary.
