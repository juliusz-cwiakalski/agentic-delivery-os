---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/local-install.md
ados_distribution: redistributable
links:
  related_changes: ["GH-365"]
---
# Local Install, Delivery, and Re-Install

This guide describes the operator cadence the tool exists to make possible — **install a release, deliver iterations through the installed binary, decide, re-install** — together with the admissible installation origins, the readiness requirements, upgrade and rollback, removal, the opt-in `PATH` block, and the ownership split between the installed binary and the shell installers. It also describes the transitional read that keeps the configuration and delivery state you created under the previous identity visible.

## The cadence

1. **Build a release artifact.** In the main checkout, run the additive build entry:

   ```bash
   bun run build:binary
   ```

   It writes `dist/<binary-name>`, reports the identity it injected (version, full commit, build instant, dirty flag, host target, and size), never mutates a tracked file, and needs no clean tree. A dirty tree is fine: the artifact then reports `<short commit>-dirty`. `--out <directory>` redirects the output when you keep artifacts elsewhere.

2. **Install it.** Run that artifact's `install`:

   ```bash
   ./dist/jaiship install
   ```

   The artifact installs itself: the identity on disk is exactly the identity that was executed, and nothing downloads or builds.

3. **Deliver.** Every delivery command runs through the installed binary (`jaiship …`). It is a copy of bytes and reads no source file, so delivery is unaffected by edits, branches, or worktrees in any checkout.

4. **Decide, then re-install.** When you want a new build, build it and run *its* `install`. Going back one step is `jaiship install rollback`.

## Admissible installation origins

The install target is the running artifact **and the git checkout it resolves to**. Three origins are admitted, and one is refused on purpose:

| Origin | Provenance |
|---|---|
| The main checkout | `verified` |
| A non-worktree clone | `verified` |
| A plain directory holding a released artifact, or a host without `git` | `unverified` |

A **linked git worktree** — a lane worktree, where `git rev-parse --git-dir` differs from `--git-common-dir` — is refused with `install.target.worktree`, naming the target directory and both git directories. The reason is operational, not cosmetic: a lane worktree is **deleted after merge**, so an install that pointed into it would work until the merge and then break. Build and install from the main checkout or a prepared directory holding a released artifact. The override route for per-iteration dogfood installs is a recorded deferred decision, not a hidden flag.

A dirty tree is never an admission question. The rule is about *where* the target lives, never about its working-tree state.

## The dev-build requirement

An install requires a running artifact that carries an **injected build identity**. A workspace run, a test-shaped invocation, or any run that was not produced by `bun run build:binary` carries no injected identity, reports `0.0.0 (build dev)`, and is refused with `install.dev-build`, naming the build entry and the `dist/<binary-name>` convention. The install never invokes a build tool, a package manager, or a network client; that absence is asserted structurally. A Bun runtime at install time is not required: the artifact is self-contained, and the runtime is required only by the legacy launcher step.

## Upgrade

**Upgrade is installing a different compiled artifact.** You build (or receive) an artifact, run *it*, and the artifact installs itself. Nothing downloads, nothing builds, nothing mutates in place. Both identities are reported — the previous one from the record and the slot, the new one from the running artifact — and `jaiship --version` and `jaiship install status` agree afterwards. Re-installing the same artifact is a **no-op by artifact agreement**: the destination's *content* is compared with the running artifact's, and when they agree the run stops with no staged copy, no rename, no slot swap, and no daemon action. A rebuild of the same commit is a different artifact (a different build instant), so it is an upgrade, not a no-op.

The replace is atomic: the running artifact's bytes are staged beside the destination, verified as a complete executable copy, the displaced artifact is moved into the single rollback slot, the staged copy is renamed into place, and the record is written last. At every instant a runnable artifact exists at a known path. A failure leaves the previous install working and a re-run of `install` recovers.

## Rollback

`jaiship install rollback` swaps the rollback slot and the destination with two renames in reverse order and updates the record, so the **single step back** is always exactly one install. It refuses with a registered identity, writing nothing, when the slot is absent (`install.slot.absent`), when the slot is not a compiled artifact (`install.slot.invalid`), or when the record precondition is unmet (`install.record.unreadable`). The precondition is the record *against what is on disk*: the record's `current` names the artifact at the destination and its `previous` carries a name. The `previous` leg is checked for **presence only** — the record stores no slot digest, so a wrong name is taken at its word and remains a claim you can check against `install status`; only a *missing* name is refused there. A record that does name the pair still refuses when the destination is not a compiled artifact at all — a launcher, a symlink, or a foreign file — because the pair the swap inverts does not exist on disk; the run refuses before any rename instead of moving that object into the slot. A refused rollback performs no daemon action even when `--stop-daemon` is given.

## Removal: `uninstall` versus `purge`

`jaiship install uninstall` removes the artifact, the rollback slot, the install record, and only the managed `PATH` block. Your configuration and delivery state are untouched. It **always** prints the residual set — the absolute paths that exist under the configuration and state roots — as exactly what `purge` would additionally delete:

```
purge would additionally delete:
path: <config root>/…
path: <state root>/…
```

`jaiship install purge` additionally removes the configuration root and the state root, and requires the explicit confirmation `--yes` **even when both roots are absent** (the answer is then "nothing to remove", reported at exit `0`). Without it the run refuses with `install.purge.unconfirmed`, names both roots and the flag, and removes nothing. The removal order is artifact, slot, record, `PATH` block, then the roots, so a partial failure leaves the recoverable members in place. A second `uninstall` removes nothing, reports every member as absent, prints the same residual set, and exits `0`.

All four write paths accept `--dry-run`: each prints its complete plan with absolute paths, one line per path, and performs no write, no directory creation, and no daemon read or action. A dry-run never evaluates the daemon guard: it neither reads nor stops the daemon, never answers `install.daemon.running`, and reports `daemon: unchecked` — a real run refuses a live holder unless `--stop-daemon` and otherwise stops it before the swap or removal.

## The opt-in `PATH` block

By default the tool writes no profile file. `--add-to-path` appends exactly one delimited block to one profile:

```bash
jaiship install --add-to-path
jaiship install --add-to-path --shell-profile ~/.config/my-shell/profile
```

The block holds one start marker, exactly one export line putting the install directory first, and one end marker. The file is `--shell-profile <path>` when given; otherwise the declared shell mapping of your shell selects it (`zsh` → `~/.zshrc`, `bash` → `~/.bashrc`, `sh` → `~/.profile`). An unidentifiable shell without `--shell-profile` is the typed refusal `install.shell-profile.unresolved`, and no profile is written. An identical block is never re-appended; different content is replaced in place and never duplicated. The block's file and marker are recorded in the install record, so `jaiship install uninstall` and `jaiship install purge` remove exactly that block and nothing else — a hand-edited profile is a tolerated case.

## Compatibility: advisory where it must install, a verdict where it must report

The installed artifact declares one **accepted state format** and compares it with each state root's ledger header, read-only, header files only, one project level, capped, and never persisted. The asymmetry is deliberate:

- On the **write paths** (`install`, `install rollback`) the verdict is **advisory**: one line per not-accepted root and no exit-code change, because a mismatch is fixed by installing a different artifact — and the install surface must remain able to install it.
- On the **report path** (`install status`) it is the typed verdict `install.state.incompatible` at exit `1`, naming the root, the observed identifier, the accepted identifier, and the judged count.
- The delivered `state.schema.mismatch` hard gate is unchanged: the first command that opens a mismatched store still answers it at exit `2`.

## Ownership split with the shell installers

One owner per artifact class:

- **The lifecycle family owns the binary.** `install`, `install status`, `install rollback`, `install uninstall`, and `install purge` own the artifact, the rollback slot, the install record, and the managed `PATH` block; `install migrate` owns the byte-preserving move of the three prior-identity roots.
- **The shell installers own repository artifacts.** `scripts/install.sh` copies the redistributable guides, delivery scripts, delivery tools, templates, the OpenCode/Claude plugin projection with its MCP surface untouched, and keeps its launcher step for the legacy launcher when nothing else sits at the install path. With anything else at that path — the installed artifact, the slot, or any other content, with or without a record — the launcher step refuses, classified, names `install` as the update path, and writes nothing. Detection is by what is at the path, never by the record.
- **`scripts/uninstall.sh` removes repository artifacts only.** It removes no binary, slot, record, or Jaiship root; it reports a managed install and names `install uninstall` as the owning removal command. When no product binary is reachable it reports no managed install without an error and guesses no path.

The compatibility alias (`delivery-os`) keeps its delivered behaviour with one declared divergence: it composes the `install` family for parity and refuses every lifecycle entry point with `install.identity.not-owning` — the alias does not own installation; run the lifecycle through the installed product binary.

## The migration verb

`install migrate [--dry-run] [--backup-dir <abs>] [--stop-daemon]` moves the three declared prior-identity roots — host configuration, host state, and the invoking project configuration — to the current Jaiship identity. It reuses the lifecycle admission gates: a linked worktree, a development build, or the non-owning compatibility alias refuses with nothing moved. Start with `install migrate --dry-run`: it prints `install.migration.plan.v1`-shaped data as one header per root class, one line per entry, the would-be backup path, and `daemon: unchecked`, and writes nothing. An applying run copies and digest-verifies every planned entry into `<backup>/<stamp>/manifest.json` (`install.migration.manifest.v1`) before the first move, so a move is reversible by hand from the backup. A differing entry is a `conflict` retained on both sides; a byte-identical duplicate is retained; a symlink entry is never followed; `--backup-dir` must be an absolute path outside every source root. The command writes **zero records of any kind** in every mode (the declared audit exception), never edits your shell profile (a managed `PATH` block under a prior root is reported with the remedy "re-run the installed artifact's `install`"), and a second run reports `already-migrated` with no move and no new backup.

The default backup root is `<current configuration root>/migration-backups/<UTC stamp>/`; `--backup-dir <abs>` relocates it (a relative or in-source path is refused). The plan is decided per entry: a source-only entry is `moved`; a destination-only entry is `already-migrated`; a byte-identical duplicate is `duplicate-identical` and is retained on both sides; a differing entry is `conflict` and is retained on both sides; a source symlink is `blocked` and a destination symlink is `conflict`, and neither is ever followed or moved. The run verdict is `migrated` or `already-migrated` at exit `0`, and `partial`, `conflict`, or `blocked` at exit `1`. A live daemon is refused without `--stop-daemon`; with it the daemon is stopped before the first move and is not restarted, and a dry run never reads the daemon. A second run moves nothing, creates no backup, and reports `already-migrated`. To reverse a move by hand, copy the entries back from the backup directory using its `manifest.json` digests — the tool performs no automatic reversal. The report names a residual line for a prior launcher or prior record left in place and a residual line for a managed `PATH` block whose path is under a prior root, with the remedy "re-run the installed artifact's `install`"; the tool never edits your shell profile. The install domain is ten identities: the delegation refusal is retired, and a negative migration verdict is data, not an error code. The loaded-path guarantee applies throughout: the current configuration file is the one read whenever it exists, the prior file is reported not used and never opened, and a migrated checkout and host emit no prior-identity notice.

If you use the shell fallback after migrating, its declared override still points at the prior host root until the M4-S8 wrapper cutover (DEC-13). Read the override variable's name from the header of `scripts/lib/dispatch-authority.sh` and point it at the current host state root; the installed example owner-hold hook keeps its declared marker default until then, and its own header is the authority for that path. Do not add a pre-freeze literal to a page or widen the ADR-0003 DEC-8 allowlist to make a gate pass — the gate is correct.

The retired `install --migrate` form is still recognised by the parser so the remedy is reachable: it refuses at exit `1` and names `install migrate`. The documented flag set no longer lists it. Without the flag, `install` keeps the delivered advisory detection line and moves nothing.

## The legacy launcher step

The shell installer is still available for a machine that has never installed the artifact: run it from its own checkout with fetching disabled when you already have the source (`bash /path/to/product-checkout/scripts/install.sh --local --no-fetch`). Its launcher step registers one executable launcher at the brand install path — `~/.jaiship/bin/jaiship` — and records exactly one absolute target: the CLI entry of the source tree it was installed from, rendered as a single safely quoted shell word. It hands the process to the runtime on that target, passes your arguments through, inherits the standard streams, and leaves the environment unmodified. A missing runtime and a source tree without the CLI entry are its two `classified failures`; it never skips silently. Re-running an unchanged install rewrites nothing, a different source repoints the launcher, and a missing target answers one bounded stderr line naming the target and the remedy with a non-zero exit. The install path is not composed by the installer: it is read from the executable's state-free `--print-install-path` self-description with the working-name override removed from that child's environment.

The launcher is the **transitional** surface: once the artifact is installed, the lifecycle family owns the install path, and the installer's launcher step refuses to overwrite it. Removing a registered launcher without installing the artifact remains an operator action — delete the file yourself, or install the artifact and use `jaiship install uninstall`.

## What the fallback notices mean

When the current identity's configuration or state is absent and the prior identity's is present, the tool reads the prior one and prints exactly one notice per source kind:

- `prior-identity-fallback: config-read` — the configuration was read from the prior identity's path because the current one is absent.
- `prior-identity-fallback: state-read` — the host state root in effect is the prior identity's default root.
- `prior-identity-fallback: state-skipped` — the current host root exists, so the prior root was not used.
- `prior-identity-fallback: config-skipped` — the current configuration exists, so the prior configuration was not read.

Nothing is moved, copied, or deleted by any of these reads. Machine-global layers never fall back: only the two per-invocation directories the notice names do, and the prior identity's environment variable names are read through the delivered compatibility mapping rather than a second literal. The notices travel the warnings channel (stderr), in every mode including `--json`, and never enter the machine payload or change an exit code.

## Optional one-step move

If you want the old namespace retired now, stop the tool and run `install migrate` — plan it first with `install migrate --dry-run`, then keep the verified backup until you have confirmed the moved checkout and host. The migration verb performs the move and the retired `--migrate` flag performs nothing; it only names `install migrate` as the remedy. A reversal stays a manual copy-back from the backup, as described above.

## What is not renamed in this slice

The GitHub repository, the package scope, the docs URLs, and the compatibility alias keep their delivered values. The alias remains a supported identity with one declared divergence (the lifecycle family it refuses), and no `delivery-os` launcher is registered. The repository and documentation URLs are scope-derived, the MCP surface and the delivery-script shell fallback are unchanged, and the installer's own home directory and environment-variable surface keep their delivered behaviour (`scripts/install.sh --help` documents it). See the change record `chg-GH-320-spec.md` for the four divergences, and the GH-346 record for the lifecycle one.

## See also

- [Install lifecycle reference page](../planning/oss-tooling/milestones/m4/commands/install.md)
- [Install model](../planning/oss-tooling/milestones/m4/install-model.md)
- [Installable Artifact and Install Lifecycle](../spec/features/feature-install-lifecycle.md)
- [CLI Entrypoint](../spec/features/feature-cli-entrypoint.md)
