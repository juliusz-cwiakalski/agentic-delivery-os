# Pinned opencode JSONL stream captures

Provenance: captured from `opencode v2.2.5`, `opencode run --format json`
stdout. Every line is one JSON object; the session identifier is the top-level
`sessionID` field. Prompt content and `part` payload text are synthetic and
redacted; no real session id, credential, environment dump, or personal data is
present.

The set is the single stream oracle for the adapter suites:

| File                                 | Shape                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opencode-v2.2.5.jsonl`              | The clean three-line happy path: `step_start`, `text`, terminal `step_finish` with `part.reason === "stop"`.                                            |
| `opencode-v2.2.5-tool-error.jsonl`   | A `tool_use` event with `part.type === "tool"` and `part.state.status === "error"`, followed by a terminal `step_finish` with `part.reason === "stop"`. |
| `opencode-v2.2.5-stream-error.jsonl` | An `error` event `{type, timestamp, sessionID, error:{type, message}}` after an identified `step_start` line; no terminal `step_finish`.                |

## Regeneration

A CLI change that alters the framing, the `sessionID` field, or the terminal
`part.reason` must update this set deliberately:

```bash
printf 'Reply with the single word: ok\n' \
  | opencode run --format json > tests/fixtures/harness/stream/opencode-v2.2.5.jsonl
```

The two failure captures are produced by a failing tool call and a failing
provider stream; redact prompt content and replace every `part` payload with
synthetic content before committing. Keep each failure encoding in its own file
so the happy-path capture keeps its terminal stop.
