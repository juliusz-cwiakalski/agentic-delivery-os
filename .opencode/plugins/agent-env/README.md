# agent-env

Expose the active OpenCode agent ID to tool subprocesses as an environment
variable.

Default variable: `OPENCODE_AGENT`.

```sh
# shell run by @coder
printf '%s\n' "$OPENCODE_AGENT"
# coder
```

## Behavior

- Session model requests update `process.env[OPENCODE_AGENT]` with the session's
  agent before the request is dispatched.
- Every tool call also updates `process.env[OPENCODE_AGENT]` with the calling
  agent ID before the tool executes.
- Shell creation also injects the correlated agent directly into the shell
  environment. Commands are correlated by command string, so concurrent sessions
  with different agents do not overwrite each other in the usual case.
- The previous process value is restored when the plugin unloads.

## Options

The plugin reads an optional `variable` option from `ctx.options`. Auto-loaded
plugins under `.opencode/plugins/` use the default; the option applies when the
plugin is loaded through a `plugins` entry from another location:

```jsonc
{
  "plugins": [
    {
      "package": "../shared/plugins/agent-env",
      "options": { "variable": "AGENT_NAME" },
    },
  ],
}
```

## Limits

- `process.env` is shared by the OpenCode server. Non-shell tools in concurrent
  sessions can observe the most recently started call's agent instead of their
  own. Shell commands use their correlated agent.
- The value is the OpenCode agent ID, not the agent display name.
