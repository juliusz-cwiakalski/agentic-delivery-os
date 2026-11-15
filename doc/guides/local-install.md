---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/local-install.md
ados_distribution: redistributable
---
# Local Install and Prior-Identity Transition

This guide describes the user-level local install that puts the product's executable on your `PATH`, and the transitional read that keeps the configuration and delivery state you created under the previous identity visible.

## Install shape

Run the local install from the project you want to adopt, against a checkout of the product (or its published distribution), with fetching disabled when you already have the source:

```bash
cd /path/to/your-project
bash /path/to/product-checkout/scripts/install.sh --local --no-fetch
```

Run the installer from its own checkout and it resolves that checkout as the source, so no source variable is needed. `--no-fetch` is optional; it prevents the installer from updating its own source before installing. With it, the run needs no network access at all.

The local install:

- copies the redistributable guides, the delivery scripts, the delivery tools, the templates, and the plugin projection into the current project;
- registers one executable launcher at the brand install path; and
- leaves every other installer surface unchanged.

## Where the launcher lands and what it executes

The launcher lands at `~/.jaiship/bin/jaiship`. The directory and the file name are the executable's own declared identity, not a value the installer composes: the installer asks the executable's state-free self-description (`--print-install-path`) for the path and expands only the leading home marker. You can ask the same question yourself:

```bash
~/.jaiship/bin/jaiship --print-install-path
```

That command prints the path for the identity in effect. The installer deliberately removes the `DELIVERY_OS_WORKING_NAME` override from the child environment it uses for the query, so an override in your shell cannot redirect the registration; the installed launcher then forwards your environment unchanged, so the override still governs the identity at run time.

The launcher records exactly one absolute target — the CLI entry of the source tree it was installed from — and hands the process to the runtime on that target with your arguments passed through, the standard streams inherited, and the environment unmodified. The target is written as one safely quoted shell word, so a source path containing a single quote, a backslash, or a space is supported and the launcher still execs exactly that path. It performs no version probe, no network access, and no search of `PATH` for the product.

Re-running the same install rewrites nothing while the launcher's content is unchanged. Installing from a different source repoints the launcher. Removing a registered launcher is an operator action: reinstall to update it, and delete the file yourself to remove it.

If the recorded target no longer exists (for example the source checkout moved), the launcher prints one line naming the expected target and the remedy and exits non-zero. Re-running the local install repoints it.

## Install-time requirements and failures

The launcher step needs the Bun runtime at install time, because it asks the executable for its install path. Two conditions are classified failures rather than silent skips:

- **No runtime:** if Bun is not resolvable, the install fails naming the runtime and writes no launcher. Install the runtime and re-run.
- **No CLI entry:** if the resolved source tree has no CLI entry, the install fails naming the expected entry path and writes no launcher. Point the install at a complete checkout (the installer's own `--help` lists the supported source override).

`DRY_RUN=true` (or `--dry-run`) is a plan-only preview of the launcher step: it evaluates no install-time precondition, prints one line naming the CLI entry it would record, writes nothing, and exits successfully — including from a source tree without the CLI entry. The two classified failures above apply to a real run only. The step is independent of `--tool`: the launcher is the product's, not the selected AI tool's.

## What the fallback notices mean

On the first invocation under the new identity, the product reads the artifacts the previous identity created when the new identity's equivalents are absent. It tells you so once per source kind, on stderr, in every mode including `--json`. Each line begins with `prior-identity-fallback:` and one reason:

| Reason | Meaning |
|---|---|
| `config-read` | The prior project configuration file was read because the current-identity file is absent. |
| `config-skipped` | Both files exist; the current one is in effect and the prior one was not read. |
| `state-read` | The prior host state root is in effect because the current-identity root is absent. |
| `state-skipped` | Both roots exist; the current one is in effect and the prior one was not used. |

Every line names both locations and states that nothing was moved, copied, or deleted. The notice is informational: it changes no exit code and never appears in a machine payload. It is delivered even when the invocation then fails: if an invalid working-name override still reads the prior project configuration, the `config-read` line appears before the contained failure. It is distinct from the configuration warnings and from the pre-freeze compatibility notices the product already emits.

## What the fallback covers, and what it does not

Covered:

- The two repository-owned configuration layers (`config.yaml` and `config.local.yaml` at the project root), per layer, with the current file always winning.
- The host state root: the prior default root is selected only when the current default root is absent, and no current-identity root is created while the fallback holds.

Not covered, by design:

- Machine-global configuration layers (system and user-global). The transitional claim is about artifacts the product created in a workspace, so reading another identity's machine-wide configuration would widen the trust boundary beyond the transition.
- The prior identity's environment variable names. A prior-prefix state-directory override is never read, so a variable cannot silently cross identities.
- An explicitly selected configuration file: it occupies the project-committed slot and disables every layer's fallback.

The fallback is transitional. It exists so the identity change does not orphan your artifacts; the retirement belongs to the later rename slice.

## Optional one-step move

Nothing is migrated automatically, and nothing has to be. If you prefer a single identity on disk, you can move the artifacts yourself:

```bash
mv /path/to/your-project/.delivery-os /path/to/your-project/.jaiship
mv ~/.delivery-os-state ~/.jaiship-state
```

After the move the current-identity artifacts exist, so the fallback stops applying and no notice appears. The move is an operator action: the product never performs it.

## What is not renamed in this slice

Four surfaces deliberately keep the pre-freeze identity for now:

1. **The MCP surface** keeps its own default identity and its own override read. Use the delivered override to align it with the CLI when you need them to address the same artifacts.
2. **The delivery-script shell fallback** keeps the pre-freeze host root, so the shell-side helper and the CLI fallback agree while the prior artifacts exist.
3. **The scope-derived repository and documentation URLs** keep the pre-freeze organization, so a new working name still derives a URL under that organization until the public move.
4. **The installer's own home directory and environment-variable surface** keep their pre-freeze names. Those identifiers are documented in the installer's own help (`scripts/install.sh --help`, Environment section) and in this change's record (`doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md`, §8.5); this guide references them by role so the registered, seed-scanned document set stays honest.

Package scope, the README, and the public documentation also stay on the pre-freeze name by non-goal, and this slice adds no migration command.

## See also

- [CLI Entrypoint and Self-Description](../spec/features/feature-cli-entrypoint.md)
- [Branding Seam and Working Name](../spec/features/feature-branding-seam.md)
- [Configuration Layer](../spec/features/feature-config-layer.md)
- [Repositories and the Host Overview](../spec/features/feature-projects.md)
