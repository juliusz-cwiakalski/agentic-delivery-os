---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/clean-merged-branches.md
ados_distribution: redistributable
---

# clean-merged-branches User Guide

> Version 1.0.0 | [Changelog](#100-2026-07-03)

## Overview

`clean-merged-branches` is a standalone CLI tool that deletes local git branches which have been merged into the base branch. It handles both regular merges (ancestry-based) and squash merges (content-identical trees), making it safe for squash-merge workflows where standard `git branch --merged` misses branches.

**Key features:**

- **Squash-merge safe**: detects branches with identical tree content to the base branch, not just ancestry-merged ones
- **Protected branches**: never deletes `main`, `master`, or `develop` (configurable)
- **Dry-run mode**: preview what would be deleted without making changes
- **Original branch restore**: returns to the branch you were on after cleanup

## Requirements

- Bash 4.0+
- Git

## Installation

### From the ADOS repo

```bash
# The tool is at tools/clean-merged-branches in the ADOS repository
chmod +x tools/clean-merged-branches
```

### As a standalone tool

```bash
curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/tools/clean-merged-branches \
  -o ~/.local/bin/clean-merged-branches
chmod +x ~/.local/bin/clean-merged-branches
```

## Usage Examples

### Basic cleanup (default base: main)

```bash
clean-merged-branches
```

Switches to `main`, fetches/prunes, deletes all merged and content-identical branches, restores original branch.

### Use a different base branch

```bash
clean-merged-branches --base develop
```

### Preview without deleting

```bash
clean-merged-branches --dry-run
```

### Add custom protected branches

```bash
clean-merged-branches --protected release-1.0,release-2.0
```

### Allow cleanup with uncommitted changes

```bash
clean-merged-branches --allow-dirty
```

### Colored output

```bash
clean-merged-branches --color
```

## How It Works

The tool operates in two phases:

### Phase 1: Ancestry-merged branches

Uses `git branch --merged <base>` to find branches whose commits are all reachable from the base branch. These are deleted with `git branch -d` (safe delete — git verifies the merge).

### Phase 2: Content-identical branches (squash-merge detection)

For remaining branches, compares tree content with `git diff <base>..<branch>`. If the diff is empty (identical trees), the branch is deleted with `git branch -D` (force delete). This catches the squash-merge case where a feature branch was squash-merged into the base branch — there's no ancestry link, but the tree content is identical.

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLEAN_MERGED_BASE` | `main` | Default base branch |
| `DRY_RUN` | `false` | Set to `true` for dry-run mode |
| `VERBOSE` | `false` | Set to `true` for debug output |

## CLI Reference

```
clean-merged-branches [OPTIONS]

OPTIONS:
  -h, --help              Show this help message
  -V, --version           Show version
  -n, --dry-run           List branches without deleting
  -v, --verbose           Enable debug output
  --base <branch>         Base branch to compare against (default: main)
  --protected <list>      Comma-separated extra protected branches
  --allow-dirty           Allow cleanup with uncommitted changes
  --color                 Enable colored output

EXIT CODES:
  0 - Success
  2 - Usage error (including dirty tree without --allow-dirty)
  4 - Runtime error
```

## Troubleshooting

### "Working tree has uncommitted changes"

The tool refuses to run when the working tree is dirty to prevent accidental branch switches with pending changes. Either commit/stash your changes or use `--allow-dirty`.

### Protected branch was deleted

The default protected branches are `main`, `master`, and `develop`. If you use a different naming convention, add your branches with `--protected branch1,branch2`.

### Squash-merged branch not deleted

If the base branch has moved forward with other commits since the squash merge, the branch's tree may no longer be identical to the base. The tool only deletes branches with **exactly identical** tree content. Run the tool immediately after squash-merging for best results.

## Changelog

### 1.0.0 (2026-07-03)
- Initial release
- Squash-merge-safe branch cleanup with ancestry and content-identical detection
- Protected branch support (main, master, develop + custom)
- Dry-run, verbose, and color modes
