---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/rename-drill.md
ados_distribution: internal
---
# Rename Drill

A name-free procedure that proves the branding seam is the only place a name is
derived. Run it on a temporary copy before release and whenever branding changes;
it never edits the working tree it is run from.

The drill replaces the working-name values in the branding resolver and the
legacy compatibility adapter mapping inside a temporary copy, then runs the full
verification battery. A green run proves the rename is one seam swap: the CLI,
the runtime, and the product directory follow the branding values without any
other name literal.

## Procedure

| Anchor | Check | Command or evidence |
|--------|-------|---------------------|
| RD-1 | Copy the workspace to a temporary directory, replace the branding values and the legacy compatibility adapter mapping in that copy only, and keep every edit inside the copy. | `cp -a . "$TMPDIR/rename-drill"` then update the branding resolver inputs and the legacy mapping in the copy |
| RD-2 | Typecheck the temporary copy. | `pnpm typecheck` |
| RD-3 | Run the unit and integration tests. | `pnpm test` |
| RD-4 | Run the boundary tests and the boundary check. | `bun test tests/boundaries` and `pnpm check:boundaries` |
| RD-5 | Run the forbidden-literal test. | `bun run scripts/checks/forbidden-literals.ts` |
| RD-6 | Build the binary. | `pnpm build` |
| RD-7 | Run the package publish dry-run. | `pnpm -r publish --dry-run --no-git-checks` |
| RD-8 | Capture the MCP tool-list snapshot from the built runtime and compare it with the frozen snapshot. | MCP tool-list snapshot diff |
| RD-9 | Capture the OpenCode tool-list snapshot from the host integration and compare it with the frozen snapshot. | OpenCode tool-list snapshot diff |
| RD-10 | Assert rename survival: the root `.gitignore` still matches the renamed project-local config path, and every root workspace file is name-free or derived from branding. | `git check-ignore -q "$CONFIG_DIR/config.local.yaml"` plus a review of the root workspace files |
| RD-11 | Record the run and its result in the change that triggers the drill. | Execution obligation |

## Rename-survival assertions (RD-10)

1. The root `.gitignore` still matches the renamed project-local config path
   (`config.local.yaml` under the renamed product directory).
2. Every root workspace file is name-free or derived from branding.

## Execution obligation

The drill must pass before release and whenever branding changes.
