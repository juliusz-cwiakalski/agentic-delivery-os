# entrypoint(1)

Status: delivered (GH-242). The executable entrypoint and its self-description
surface.

## NAME

`<binary>` - the non-installed executable entrypoint and its root
`--help`/`--version` identity.

## SYNOPSIS

```
<binary> --help
<binary> --version
<binary> <command> [options] [args]
```

## DESCRIPTION

The entrypoint is a non-installed Bun bin (`packages/cli/bin/delivery-os.ts`,
Bun shebang, mapped in the CLI package `bin` manifest next to the `main`
composition entry). It composes exactly the prompt-required command set:
`status`, `brief`, `queue`, `lanes`, `blockers`, `phase`, `commit`, `lint`,
`plan`, `verify`, `merge`, `closeout`, `spend`, and `retro`. `state`, `mcp`,
`dispatch`, and the resident daemon are not registered.

The working name resolves as typed configuration, then a non-empty
`DELIVERY_OS_WORKING_NAME` override, then the neutral default `delivery-os`.
Root `--help` lists the command families and global flags. `<command> --help`
prints usage, options, at least one example, exit codes, and a see-also
pointer. `--version` prints the binary identity, version, and build.

An invocation outside the composed set fails closed through the existing
`fallback.internal` identity: platform category, `retryable: false`,
`consequence: unknown`, `platform-provider` projection, exit `2`, with a
summary naming the missing composition. It introduces no new error-table row.

## OPTIONS

- `--help` - root or command help.
- `--version` - version and build identity.
- `--json`, `--verbose`, `--pretty` - global output flags.

## EXAMPLES

```
<binary> --help
<binary> --version
<binary> status --json
```

## EXIT STATUS

`0` success; `1` user validation or a negative verdict; `2` platform,
state, or provider failure.

## HELP

`<binary> entrypoint --help` prints usage, options, at least one example, exit
codes, and a see-also pointer. Root `<binary> --help` and `<binary> --version`
are self-description only: zero state, network, git, or configuration reads and
zero writes.

## SEE ALSO

[man page](../man-page.md), [commit.md](commit.md), [phase.md](phase.md)
