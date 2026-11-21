# `install` — the install lifecycle family

Status: **delivered in GH-346** (M4-S1). Owner of the artifact class: the
product binary. Owner of repository artifacts: `scripts/install.sh`.

## Identity

`install` is the twenty-sixth prompt-required family. It is composed in both
executables for exact family parity and **owned by the primary identity only**:
the compatibility alias advertises the family and refuses every entry point with
one typed line (`install.identity.not-owning`, exit `1`) naming the invoked
identity, stating that installation is owned by the primary identity, and giving
the documented remedy — run the lifecycle through the installed product binary,
as this page and the local install guide document it. The alias writes nothing.

`--version` answers `<binary-name> <version> (build <token>)` on one line at
exit `0`, and `--help` and `--print-install-path` stay read-free.

## Entry points

| Invocation | What it does |
|---|---|
| `install` | Install or upgrade from the running compiled artifact: admission, identity gate, daemon guard, compatibility advisory, destination disposition, the seven-step replace, and the record write. An artifact-agreement run stops at step 4 with no staging file, no rename, and no slot swap; the record is reconciled in place when it is not `current`. |
| `install --dry-run` | Prints the complete plan (running identity and artifact path, destination, the agreement outcome, the disposition, the slot, the record path, the profile file and block when `--add-to-path` is given, the compatibility advisories, and the daemon disposition `unchecked`) and writes nothing. A dry-run never evaluates the daemon guard: it neither reads nor stops the daemon, `install.daemon.running` cannot answer a dry-run, and the plan states `daemon: unchecked — a dry-run neither reads nor stops the daemon; a real run refuses a live holder unless --stop-daemon and otherwise stops it before the swap or removal`. |
| `install status` | Read-only report: running identity, installed record, record condition, slot condition, target stability, the state-format verdict, and the managed PATH block. |
| `install status --json` | The same facts under `install.status.v1`; the only surface that carries `builtAt` and the full commit. |
| `install rollback` | Two renames in reverse order against the single slot, then the record update. The ordered refusals are `install.slot.absent`, `install.slot.invalid`, and `install.record.unreadable`, evaluated before any write and before any rename and before the daemon stop. `install.record.unreadable` has five causes: four missing-name record conditions (absent, unreadable, `current` naming no `previous` while a slot is present, the post-crash pair) and a separate destination-shape cause — the destination is not a compiled artifact (a launcher, a symlink, or a foreign file). |
| `install uninstall` | Removes the artifact, the slot, the record, and the managed PATH block; always prints the residual set as what `purge` would additionally delete. |
| `install purge` | Additionally removes the configuration and state roots; requires `--yes` even when the roots are absent. |

## Flags

- `--add-to-path` appends exactly one delimited block holding one export line to
  the operator's profile, records its file and marker, replaces different content
  in place, and never duplicates an identical block.
- `--shell-profile <path>` selects the profile explicitly and always wins over
  the declared shell mapping (`zsh` → `~/.zshrc`, `bash` → `~/.bashrc`,
  `sh` → `~/.profile`).
- `--migrate` is **retired**: the parser still recognises it so the refusal is
  reachable, and it answers `fallback.invocation` at exit `1` naming the remedy
  `install migrate`. The documented flag set does not list it as supported.
- `--backup-dir <abs>` applies to `install migrate`: it places the verified
  backup at an absolute path outside every source root.
- `--dry-run` applies to every write path and writes nothing. It never
  evaluates the daemon guard — it neither reads nor stops the daemon — and each
  dry-run reports the daemon disposition as `unchecked`.
- `--stop-daemon` stops a live daemon through the delivered stop path **before**
  the swap or removal. Without it, a live holder is a typed refusal.
- `--yes` confirms `install purge`.

Global flags `--json`, `--verbose`, and `--pretty` behave as on every family.

## The migration verb

`install migrate [--dry-run] [--backup-dir <abs>] [--stop-daemon]` moves the
three declared prior-namespace roots — host configuration, host state, and the
invoking project configuration — to the current identity. `--dry-run` prints one
header per root class, one line per entry with its disposition and file/byte
counts, the would-be backup path, and `daemon: unchecked`; it writes nothing,
creates no directory, reads no daemon, and records nothing. An applying run
copies and digest-verifies every planned entry into
`<backup>/<stamp>/manifest.json` (`install.migration.manifest.v1`) before the
first move, then moves each non-derived entry without rewriting a byte; the
machine payload is `install.migration.plan.v1`. Differing entries are
`conflict`s retained on both sides, a source symlink is `blocked` and a
destination symlink `conflict`, and the declared derived entry
(`host-index.json`) is outside the move set. The command writes **zero records of
any kind** in every mode (the declared audit exception), never edits an operator
profile, and a second run is `already-migrated` with no move and no backup.

## Admission and exclusions

The install target is the running artifact together with the checkout it resolves
to; the destination is derived from the brand install path and is **never an
input** (an attempt is the delivered `fallback.invocation` grammar refusal).

- A linked git worktree is refused with `install.target.worktree`, naming the
  target directory and both git directories. Build and install from the primary
  checkout or a prepared directory holding a released artifact; a lane worktree
  is deleted after merge.
- A primary checkout is recorded `verified`; a plain directory or a host without
  git metadata is recorded `unverified`.
- A dirty tree is admitted; the token reports `<commit>-dirty`.
- A run carrying no injected identity is a development run and is refused with
  `install.dev-build`. Build the artifact with `bun run build:binary`; the
  artifact is `dist/<binary-name>`.

## Refusals

| Identity | Trigger |
|---|---|
| `install.target.worktree` | The target resolves inside a linked git worktree |
| `install.dev-build` | The running artifact carries no injected identity |
| `install.state.incompatible` | `install status` judged a state root whose header format the artifact does not accept |
| `install.identity.not-owning` | A lifecycle entry point ran on an identity that does not own installation |
| `install.shell-profile.unresolved` | `--add-to-path` without `--shell-profile` and with no identifiable shell |
| `install.daemon.running` | A live daemon holds the artifact and `--stop-daemon` was not given |
| `install.record.unreadable` | Rollback's record precondition is unmet: an absent record, an unreadable record, a `current` naming no `previous` while a slot is present, the post-crash pair, or a destination that is not a compiled artifact (a launcher, a symlink, or a foreign file) |
| `install.slot.absent` | Rollback found no slot |
| `install.slot.invalid` | Rollback found a slot that is not a compiled artifact |
| `install.purge.unconfirmed` | `install purge` without `--yes` |

An unknown subcommand or a destination argument is the delivered
`fallback.invocation` grammar refusal at exit `1`.

## Ownership split

The binary, its slot, its record, and the managed PATH block belong to this
family. Repository artifacts (delivered docs, agent and command definitions, the
plugin projection, and the legacy launcher when nothing else sits at the install
path) belong to `scripts/install.sh`. The installer's launcher step refuses,
classified, whenever anything but the delivered launcher is at the install path —
decided by what is at the path, never by the install record. `scripts/uninstall.sh`
keeps its repository-artifact scope and reports a managed install, naming
`install uninstall` as the owning removal command.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | The operation completed: install, agreement no-op, rollback, removal, or a dry-run plan |
| `1` | A declared refusal (see the table above) or a grammar refusal |
| `2` | A containment or platform failure |

## See also

- `doc/planning/oss-tooling/milestones/m4/install-model.md`
- `doc/guides/local-install.md`
- `doc/spec/features/feature-result-contract.md` (the `install` domain kind and
  its eleven rows)

## Self-description

Every entry point answers `--help` from the static inventory with usage, options,
examples, exit codes, and this page as its see-also target. `--version` and
`--print-install-path` are the delivered read-free self-description forms: they
read no state, git, or configuration.
