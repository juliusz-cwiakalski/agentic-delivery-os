---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add coordinator supervision: the `coordinator start --foreground [--fresh-budget] |
stop | status [--live] | tick` family, the append-only instance lease carried by
`coordinator.fence` records with a liveness-first atomic claim, one-record stale
takeover, and the two named state-fence rules (claim acquire vs non-claim append),
a recorded join-or-resume-or-spawn lifecycle decision, artifact-evidence stuck
detection with the `progress-bound` prefill-safety corroborator, identity-verified
kill-with-grace over the delivered `DaemonProcessPort` (additive `SIGKILL` and
optional `startTimeMs`), a distinct durable per-epoch restart budget with loud
owner-brief exhaustion escalation through the delivered blocker channel, and
wake-on-typed-question within one collection cycle. Adds six `coordinator.*`
record kinds under the unchanged `delivery.state.v1`, six `coordinator` error rows
(the two-segment allowlist grows to 38 and the identity table to 121), one
`coordinator` configuration branch with six keys, the reserved escalation slot in
`typed-questions`/`blocker-questions`, and the deterministic
`delivery.coordinator.v1` observation payload. v1 is foreground-only; coordinator
OS-unit hosting remains the M1-S18 seam and `ceo-loop.sh` is unchanged.
