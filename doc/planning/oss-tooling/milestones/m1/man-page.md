# M1 outcome man page: the command surface after M1 (planned)

The command surface available after M1 exits, in man-page form. Planned
state; every entry carries its delivery story. The invocation prefix is
written `<binary>` per the pack conventions
([../README.md](../README.md)); the locked naming surface, including the
working name and the naming audit, lives in
[../../cli-command-registry.md](../../cli-command-registry.md). After M1
the bash stack remains installed as fallback with deprecation pointers
(removal is M4-S5).

## NAME

`<binary>` - the delivery command-line tool.

## SYNOPSIS

```
<binary> <command> [options] [args]
<binary> <command> --help
<binary> --version
```

## DESCRIPTION

One command-line surface over a shared typed core. Turns tickets into
reviewed, tested, merged deliveries and manages the surrounding delivery
factory: attention digests, truth engines, machine-readable plans, the
queue and lanes, the resident dispatch daemon, provider routing, merge
transactions, closeout, and spend.

Every command returns a machine envelope (schemaVersion, runId, exitCode,
timing, data or error) with `--json`; errors come from one internal error
table; exit codes are the standalone projection (0 success, 1 user or
validation, 2 platform or provider). Where a bash predecessor emitted a
stable key=value summary, the replacement emits the same shape.

## COMMAND FAMILIES

### Deliver

| Command (first delivered) | Usage |
|---|---|
| `dispatch` (M1-S9) | `<binary> dispatch <ref> [--harness <name>] [--resume-prompt <text>]` |
| `plan validate` (M1-S13) | `<binary> plan validate <ref>` |
| `plan diff` (M1-S13) | `<binary> plan diff <ref> [--against <base>]` |
| `plan overlap` (M1-S13) | `<binary> plan overlap <refA> <refB>` |
| `commit` (M1-S14) | `<binary> commit <ref> [--phase <phase>] [--dry-run]` |
| `verify change` (M0-S8) | `<binary> verify change <ref>` |
| `verify gates` (M0-S9) | `<binary> verify gates <ref>` |
| `verify deploy` (M1-S4) | `<binary> verify deploy <ref>` |
| `merge` (M1-S4) | `<binary> merge <ref> [--dry-run]` |
| `closeout` (M0-S14, M1-S12) | `<binary> closeout <ref> [--apply]` |

`phase complete <ref> <phase>` (M0-S10, M1-S14) performs the
record-plus-commit atomically for the completed phase's pending work by
default (`--no-commit` records the transition alone; config disables
per project).

### See

| Command (first delivered) | Usage |
|---|---|
| `status` (M0-S6, M1-S10) | `<binary> status [--repo <path>]... [--json]` |
| `queue ready` (M0-S7) | `<binary> queue ready <ref>... (1..8 refs)` |
| `queue` (M1-S17) | `<binary> queue [list\|plan\|add\|prioritize\|dep]` |
| `lanes` (M1-S17) | `<binary> lanes [list\|show <lane>]` |
| `blockers list` (M1-S16) | `<binary> blockers list [--open]` |
| `blockers answer` (M1-S16) | `<binary> blockers answer <id> [--choice <n>] [--text <s>]` |
| `board` (M1-S5) | `<binary> board [--watch]` |
| `brief` (M1-S6) | `<binary> brief` |

### Operate

| Command (first delivered) | Usage |
|---|---|
| `provider resolve` (M0-S13) | `<binary> provider resolve [--profile <name>]` |
| `provider profile resolve` (M1-S21) | `<binary> provider profile resolve [--agent <name>] [--for-spawn]` |
| `provider watch status` (M1-S21) | `<binary> provider watch status [--provider <name>]` |
| `provider quota` (M0-S13) | `<binary> provider quota [--provider <name>]` |
| `provider parks list` (M0-S13) | `<binary> provider parks list [--all]` |
| `config` (M0-S4) | `<binary> config [--debug]` |
| `state` (M1-S2) | `<binary> state [check\|describe] [--store <name>]` |
| `lint` (M0-S10) | `<binary> lint <ref>` |
| `phase` (M0-S10) | `<binary> phase list\|complete\|reopen <ref> [<phase>] [--reason <s>]` |
| `db` (M0-S11) | `<binary> db size\|list\|prune\|reboot [--dry-run]` |
| `watchdog` (M1-S1) | `<binary> watchdog preflight\|teardown\|liveness <lane>` |
| `doctor` (M1-S3) | `<binary> doctor [--json]` |
| `daemon start` (M1-S18) | `<binary> daemon start [--foreground]\|stop\|status [--live]\|install\|uninstall` |
| `repos` | not delivered until M3-S6; bash utilities remain |

### Learn

| Command (first delivered) | Usage |
|---|---|
| `retro` (M1-S8) | `<binary> retro collect\|report [--level <name>]` |
| `spend` (M1-S19) | `<binary> spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]` |

### Surfaces

| Command (first delivered) | Usage |
|---|---|
| `mcp` (M1-S7) | `<binary> mcp serve` (tools: status, verify-artifact, gate-report) |

## GLOBAL OPTIONS

- `--json` - machine envelope output. Interactive terminals print the
  full pretty envelope; scripted or piped invocations print one minified
  line with only `{"data":...}` or `{"error":...}` (schemaVersion,
  runId, and timing live in the audit ledger, not the agent's context);
  `--verbose` forces the full envelope anywhere.
- `--pretty[=auto|always|never]` - indentation when `--json` is set:
  `auto` (default) indents on an interactive terminal and minifies when
  piped; `always`/`never` enforce. Stream outputs (`--watch`) stay
  line-delimited (one JSON object per line) in every mode: multi-line
  objects would break stream framing.
- `--verbose` - full envelope in any mode.
- `--config <path>` - explicit config file.
- `--no-color` - plain output.
- `--help` - command help with examples.
- `--version` - version and build info.

Per-command reference pages with invocation examples and JSON outputs
are in [commands/](commands/).

## EXIT STATUS

0 success; 1 user or validation error; 2 platform or provider error.
State-unverified outcomes exit 2 and say why (never exit-0 silence).

## ENVIRONMENT

Typed overrides use the env prefix from the branding seam; secrets are
environment-only and never in files.

## FILES

Project committed and local config under the config dir from the branding
seam; state lives in the local state dir (JSONL event log plus SQLite
indexes).

## SEE ALSO

Command contracts with inputs, outputs, and examples:
[contracts.md](contracts.md). Architecture at M1 end:
[architecture.md](architecture.md). Journeys: [journeys.md](journeys.md).
