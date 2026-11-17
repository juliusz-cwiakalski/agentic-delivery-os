---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/backlog.md
---
# M5 — Public release readiness backlog

Moved from `doc/planning/oss-tooling/backlog.md` (per-milestone split, 2026-11-17).

## Epic M4: Public release readiness

### M5-S1 Naming freeze and rename
- Goal: The public name frozen and the rename drill executed, unblocking publication.
- Tasks: owner decides the final public name; swap the branding constant;
  migrate legacy .ados config once; re-run the rename drill; update docs,
  package scope, and registry names.
- AC: one constant swap plus migration renames everything; legacy paths
  warn.
- Progress: delivered by GH-320 - the executable name and local install posture; the naming freeze and the wider rename remain.
- Depends on: M0-S2.

### M5-S2 Publication and release automation
- Goal: Release automation that publishes all public packages at one version from the frozen name, with provenance and self-update.
- Tasks: release job flips private off for the frozen name; changesets
  fixed group publishes one lockstep version line; registry provenance and
  SBOM; pinned tagged releases become the stable install source; `ados
  update` self-update.
- AC: a release publishes all five public packages at one version; the
  guard blocks any publish under a non-frozen name.
- Depends on: M0-S17, M3-S7, M5-S1.

### M5-S3 Docs, license registry, and public materials
- Goal: User docs, complete license registry, and public materials so the project is usable and contributable by outsiders.
- Tasks: user docs and guides; doc/legal/ registry complete; contributing
  guide and security policy; public changelog.
- AC: all distributable docs pass the distribution guard; registry is
  exhaustive for production dependencies.
- Depends on: M0-S18.

### M5-S4 Merge the tooling branch to the default branch
- Goal: The tooling branch merged to the default branch so installs and visibility move to the public baseline.
- Tasks: owner merges the delivery branch into the default branch; installs
  move there; the delivery branch is deleted.
- AC: the default branch carries the released tooling; no pull requests
  target the old branch.
- Depends on: M5-S2.

### M5-S5 Bash stack retirement
- Goal: The bash stack retired through a wrapper window then removal, closing the strangler migration.
- Tasks: during the deprecation window the retired entry points are
  compatibility wrappers that print a deprecation notice and delegate to
  the new equivalents (installed from M3-S7); after the window, remove the
  wrappers entirely.
- AC: during the window, every retired entry point prints the notice and
  delegates; after removal, no retired entry point remains and the new
  commands cover the documented surface.
- Depends on: M3-S7, M5-S4.

### M5-S6 Extension hooks (open-source side)
- Goal: Neutral extension hooks (opt-in sink, documented remote connection point) so local function stays complete and integrations are possible without proprietary leakage.
- Tasks: telemetry sink hooks behind the neutral event schema; a documented
  connection point for remote coordination services (off by default). No
  hosted-product behavior is specified or implemented in this repository;
  hosted capabilities live outside it (boundary rule).
- AC: the sink is opt-in and off by default; local function is complete
  with no remote service configured; the hook surface is a documented
  versioned contract; no proprietary content enters committed files.
- Depends on: M0-S5.
