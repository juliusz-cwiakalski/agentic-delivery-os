---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Enforce peak windows for a lane started by `dispatch`. The one-shot run path
now supplies its own life-long profile-window watch over the nominated
profile's declared `peakWindows` rules, parks the lane with the delivered
bounded-grace stop at the first open window's effective end, keeps the
repository lease live through the run and the park at
`min(lane.liveness-interval, queue.lease-ttl / 2)`, waits until that end,
resumes the same session on the same branch and in the same worktree, and
returns one result whose summary states that the lane was paused and resumed.
A standing park is recovered through the delivered mutating park pass before a
new episode; an un-expired standing park refuses a resume or a re-dispatch
before any session starts with the new `dispatch.resume-parked` error row.

The one intended change to a delivered payload with no park open is
`peakEnforcement.mode`, which now reads `window-watch` on a production
composition with automatic pausing enabled (it keeps `iteration-start-gating`
otherwise).

Automatic pausing is on by default and can be disabled with the declared
boolean `lane.disable-peak-pausing`. Only a profile that declares `peakWindows`
is pausable; the shipped defaults declare none.

The owning invocation withholds terminal classification for at least the
applied grace plus one observation cadence after collection resolves, about
50 s per session end at the defaults. Three consequences are declared: a
dispatch admitted while its nominated profile's window is already open bills
for at most one observation cadence plus the applied grace before its first
park; overlapping windows produce consecutive exactly-once episodes rather
than one union park; and a standing park is recovered before the next episode.

The operator command `dispatch stop <ref> --cause peak-window --until <iso>`
now requests the same pause on demand and refuses by name when the lane is not
running or is already parked.
