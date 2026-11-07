---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the M1-S8 retro evidence pipeline: the `retro collect|report [--level
<name>]` command family over an independent append-only evidence sidecar with
collector trace ids, collection watermarks, claimed identity, and an
HMAC-SHA-256 keyed chain over a distinct store-managed chaining key; verified
reads on every pass with position/trace-id break reporting and key-substitution
detection; entry-level malformation classified in band with valid output
preserved and store-level damage reusing the delivered state identities; the
five pipeline-truth checks with the explicit exit-0 `no-target` outcome and the
blocking `retro.evidence.tamper-flagged` / `retro.truth.vacuous-run` identities;
the `change` level collector over the delivered GET-only sources with
addenda-not-rewrites; the four-key report fold with mechanical findings and the
follow-through read-fold; the three additive retro registry record kinds
(`retro.level`, `retro.run`, `retro.trigger`) with the periodic memory-audit
trigger; the bounded export engine surface (library only — no CLI invocation);
and the four `retro` error-table rows with the documented table in sync.
