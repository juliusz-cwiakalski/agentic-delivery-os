---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Make `pr-open` a parity-backed claim by construction: the dispatch engine's
derivation arm for an open pull request gains the parity precondition — the
local branch head is compared against the pull request's head (the verify-gates
`push-parity` definition), the change branch is pushed fast-forward to its
configured upstream exactly once when the heads are unequal, parity is re-read
once, and `pr-open` derives only from a readable equality. A rejected, failing,
timed-out, or spawn-level-failed act — or parity still unmet after the act — is
the one new failure-classification row (result `failed`, outcome `failed`, exit
1, exactly one attempt record, comparison not applicable with reason
`push-parity-unmet`); it adds no result token, no error identity, no domain
kind, and no error-table row, and it retains the PR URL in both output modes. An
unreadable parity read stays the delivered `state-unverified` undecidable-truth
semantics, `pr-open-unverified` stays outside the precondition, and a resumed
recorded `pr-open` lane re-evaluates the precondition idempotently.

The typed stack's first remote-write seam lands in the adapters git family
(`packages/adapters/src/git/push.ts`): one fast-forward-only push of the change
branch over a fixed argv and a literal non-shell child process, under the static
no-shell invariant's declared surface, with a 60 000 ms default timeout
injectable through the seam options and no new configuration key. Attempt
evidence names the parity outcome through the bounded `push:<verdict>`
references (`clean`, `pushed`, `failed`), reserved ahead of the 16-reference
evidence slice, and the machine envelope gains the additive optional `push`
block (`verdict`, `localHead`, `remoteHead`, `parity`), present
together-or-absent-together exactly when the precondition evaluated and bounded
within the 256-character dispatch bound. Text mode stays the delivered
four-key contract byte for byte; pre-change attempt records read unchanged and
parity facts are never fabricated for them. The bash fallback keeps its
delivered five-key tail, exits, and push conventions — the divergence is
declared in the feature pages and the engine-first operations guide. Companion
decision record: `doc/decisions/TDR-0076-engine-ensure-push-first-remote-write.md`.
