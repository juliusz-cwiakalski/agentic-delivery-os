---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Fix the opencode harness adapter to consume the real `opencode run --format json`
JSONL stream: parse each line independently, take the top-level `sessionID`,
return the session handle on the first identified line instead of blocking on the
multi-hour session, derive completion-scoped evidence under the retained
legacy-envelope precedence, preserve resume/deliver handle identity, and replace
the five-minute whole-session cap with a bounded handle-acquisition wait and no
default session bound. Adds the additive `HarnessSpawnStarter` streaming seam
beside the unchanged one-shot runner and session port.
