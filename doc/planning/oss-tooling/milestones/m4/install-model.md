# M4 install model: local user install from a cloned repository (design)

Status: **design draft** (planning PR GH-333). Owner directive 2026-11-17:
local-only install for now; only Jaiship namespaces.

## Constraints

- One self-contained binary; at runtime it never references the source
  checkout.
- Per-user install, no `sudo`, no system-wide paths.
- Only Jaiship namespaces: `~/.jaiship/`, `~/.jaiship-state/`, and the optional
  project-local `<repo>/.jaiship/`. Never legacy pre-Jaiship config or state paths.
- Upgrade is explicit; replace is atomic; uninstall is clean and reversible
  until purged.

## Layout

```
~/.jaiship/
  bin/jaiship                 # the installed binary (single executable)
  bin/jaiship.previous        # one rollback slot, replaced on each install
  config.yaml                 # user configuration layer (provider policy, defaults)
  install.json                # install metadata: version, source commit, installedAt
~/.jaiship-state/             # state layer: ledger, registry, projects, telemetry
<repo>/.jaiship/config.yaml   # optional project-local configuration layer
```

## Build and install flow

1. Clone the repository and build: `pnpm install && pnpm build`.
2. Produce a single binary: the CLI entry compiles with Bun into
   `dist/jaiship` (self-contained; no repository imports at runtime).
3. Run `scripts/install-jaiship.sh`:
   - Preconditions: `dist/jaiship` exists and `dist/jaiship --version` exits 0.
   - Atomic replace: copy to `~/.jaiship/bin/.jaiship.tmp`, then `mv` over the
     target; keep the prior binary as `jaiship.previous`.
   - Write `install.json` (version/build identity, source commit, timestamp).
   - Print PATH guidance; `--add-to-path` appends one managed block to the
     user's shell profile only when explicitly requested.
   - Legacy migration hook: if `~/.delivery-os*` or `<repo>/.delivery-os`
     exist, instruct (and, with `--migrate`, run) the idempotent migration
     defined in M4-S2 with a backup before any move.
4. Verify: `jaiship --version` reports the build identity; `jaiship status`
   reads config and state from the Jaiship paths only.

## Upgrade and rollback

- Upgrade = rebuild from the desired commit and re-run the installer. The
  previous binary stays as `jaiship.previous` for one step.
- Rollback = `scripts/install-jaiship.sh --rollback` (swap previous back).
- Version identity in every machine envelope lets CI and operators prove which
  build is running.

## Uninstall

- `scripts/install-jaiship.sh --uninstall` removes the binary and
  `install.json`; config and state are preserved.
- `--purge --yes` additionally removes `~/.jaiship/` and `~/.jaiship-state/`.

## Safety

- Refuse to replace a running daemon unless `--stop-daemon` is passed.
- Never write outside the user's home directory; never store secrets in
  `install.json` (credentials stay environment-only).
- Failed builds never replace a working install (atomic replace only after a
  verified `--version` run).

## Out of scope (this milestone)

Package-manager channels, system-wide installs, auto-update, and multi-user
hosts. Those can follow once the local model is proven.
