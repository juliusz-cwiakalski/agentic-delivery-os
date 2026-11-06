---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Enforce the 1048576 source-size limit as UTF-8 bytes in the YAML configuration
parser and at both pm-notes document parser check sites, preserving the
byte-named constant, the limit value, and existing error identities. Multibyte
sources whose code-unit count is under the limit but whose byte count is over
are now rejected fail-closed.
