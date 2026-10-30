# Result contract and error table

Every command returns one `CommandResult` envelope. The envelope carries
`schemaVersion` (`delivery.result.v1` at v1), an opaque per-invocation `runId`,
`exitCode`, `timing`, and exactly one of `data` or `error`. The generic
`Result<T, E>` remains the internal computation result; the envelope is the
command-surface rendering.

Failures are classified through one chain: domain kind -> app error code ->
exit-code projection class. The machine-readable table in `core ./contracts` is
the single source; every error object is a pure projection of one entry
(`code`, `category`, `retryable`, `consequence`, `remediationHint`, and an
optional non-identifying `summary`).

Exit codes exist only in the standalone CLI: `success` projects to 0,
`user-validation` to 1, and `platform-provider` to 2. Broken invocations and
unknown commands are contained by `fallback.invocation`; errors no entry
classifies are contained by `fallback.internal`. Both containment entries carry
`consequence: unknown` and `retryable: false`.

`runCli(argv, streams, deps)` is deterministic and in process. Under `--json` it
writes exactly one valid envelope to the injected output stream through a single
serialization chokepoint; human diagnostics go to the injected error stream.
The chokepoint replaces every edge-registered secret value with `[redacted]`
before serialization, on success and failure payloads alike. Values that were
never registered at the edge are outside the guarantee.

## Documented error table

| Code | Domain kind | Category | Retryable | Consequence | Remediation hint | Projection class | Summary |
|------|-------------|----------|-----------|-------------|------------------|------------------|---------|
| fallback.invocation | fallback | user | false | unknown | Check the command name and arguments, then retry the invocation. | user-validation | The invocation could not be understood. |
| fallback.internal | fallback | platform | false | unknown | Inspect the diagnostics stream and report the failure if it persists. | platform-provider | The failure could not be classified. |
| provider.quota.exceeded | provider | transient | true | not_landed | Wait for the quota window to reset, then retry the operation. | platform-provider | The provider quota was exceeded. |
| input.value.rejected | input | user | false | not_landed | Correct the rejected value and retry the command. | user-validation | The supplied value was rejected. |

## Evolution

Envelope changes are additive within `schemaVersion`; a breaking shape change
requires a new schema version. A new table entry requires its structured fields,
projection class, and documented row in the same change. The binding sync check
fails when an emitted or referenced code has no documented row, or when a
documented row has no machine-readable entry.
