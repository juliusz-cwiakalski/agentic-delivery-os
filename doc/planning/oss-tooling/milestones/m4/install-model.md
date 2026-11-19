# M4 install model: local user install from a built artifact

Status: **delivered surface** (GH-346 / M4-S1). Owner directive 2026-11-17:
local-only install; only Jaiship namespaces. The **mechanics** below — layout,
atomic replace, one slot, record fields, `PATH` block, daemon refusal, and the
out-of-scope list — are preserved as behaviour. The **surface** is the composed
`install` lifecycle family of the installed product; the shell lifecycle script
and its flag forms (`--rollback`, `--uninstall`, `--purge`) described in the
earlier draft are superseded by that family, and the decision records
(TDR-0044 … TDR-0048) win on surface.

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
  bin/jaiship.previous        # one rollback slot, replaced on each replacing install
  config.yaml                 # user configuration layer (provider policy, defaults)
  install.json                # install record: install.record.v1 (see below)
~/.jaiship-state/             # state layer: ledger, registry, projects, telemetry
<repo>/.jaiship/config.yaml   # optional project-local configuration layer
```

`install.json` carries `schemaVersion` (`install.record.v1`), the installed
artifact's identity (`version`, `commit`, `builtAt`, `dirty`, `channel`), the
accepted state format (`stateSchemaVersion`), the source checkout when the build
had git metadata, the recorded provenance (`verified`/`unverified`),
`installedAt`, the previous slot's identity (absent when no readable record
names it — reported unknown, never guessed), the launcher disposition, and the
managed `PATH` block's file and marker. It holds no credential and is written
staged-and-renamed, never in place.

## Build and install flow

1. Work in the primary checkout (a lane worktree is refused on purpose).
2. Produce the artifact with the additive entry: `bun run build:binary`
   (repo-internal; it does not join the package build chain). It writes
   `dist/jaiship`, captures version/commit/build instant/dirty over tracked
   files only, and reports the identity, size, and host target it produced.
3. Run the artifact: `./dist/jaiship install`.
   - Admission: the artifact's own directory resolves to a stable checkout
     (`verified`) or to an absence (`unverified`); a linked worktree is
     `install.target.worktree`.
   - Identity: a run with no injected identity is `install.dev-build`.
   - Daemon guard: a live holder is `install.daemon.running` unless
     `--stop-daemon` is passed; the stop runs through the delivered stop path
     **before** any rename.
   - Compatibility pre-flight: read-only and advisory; one line per
     not-accepted root; the exit code is unchanged.
   - Seven-step atomic replace: stage the running artifact's bytes in the
     install directory, verify a complete executable copy, stop at step 4 when
     the destination's **content** is already these bytes (reconciling the
     record in place when it is not `current`), move a differing compiled
     artifact into the slot, rename the staged copy into place, and write the
     record last.
   - `--add-to-path` appends exactly one delimited block to one profile, only
     when explicitly requested, and records its file and marker.
   - The migration hook detects prior-namespace artifacts and advises; with
     `--migrate` it refuses with `install.migration.unavailable` (M4-S2 owns
     the move) and moves nothing.
4. Verify: `jaiship --version` reports the build identity on one line, and
   `jaiship install status` (or `--json`) reports the running identity, the
   installed record, the record and slot conditions, target stability, the
   state-format verdict, and the managed block.

## Upgrade and rollback

- Upgrade = **install a different compiled artifact**: build (or receive) it
  and run *it*. Nothing downloads and nothing builds. The previous artifact
  stays in `jaiship.previous` for exactly one step, and both identities are
  reported.
- Rollback = `jaiship install rollback`: two renames in reverse order against
  the single slot, then the record update. It is involutive — a second rollback
  returns the previous state — and it refuses with `install.slot.absent`,
  `install.slot.invalid`, or `install.record.unreadable`, writing nothing.
- Version identity in every machine envelope lets CI and operators prove which
  build is running.

## Uninstall

- `jaiship install uninstall` removes the binary, the rollback slot, the
  install record, and only the managed `PATH` block; configuration and state
  are preserved, and the purge residual set is always printed.
- `jaiship install purge --yes` additionally removes `~/.jaiship/` and
  `~/.jaiship-state/`; without `--yes` it refuses with
  `install.purge.unconfirmed` and removes nothing.

## Safety

- Refuse to replace or remove a running daemon unless `--stop-daemon` is
  passed; the stop precedes the swap or removal.
- Never write outside the user's home directory (and the one operator-owned
  profile file the operator explicitly asks to manage); never store secrets in
  `install.json` (credentials stay environment-only).
- Failed installs never replace a working install: the staged copy is verified
  before any rename, and the slot is filled before the destination is replaced.
- The rollback slot accepts only a compiled artifact carrying an injected
  identity; a legacy launcher is discarded with a report and is never promoted.
- The shell installer's launcher step refuses whenever anything but the
  delivered launcher sits at the install path, and `scripts/uninstall.sh`
  removes no lifecycle member.

## Out of scope (this milestone)

Package-manager channels, system-wide installs, auto-update, multi-user hosts,
release publishing, and the namespace migration itself (M4-S2). Those can
follow once the local model is proven.
