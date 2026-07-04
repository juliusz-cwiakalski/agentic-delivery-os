---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/quality-gates.md
ados_distribution: redistributable
id: GUIDE-QUALITY-GATES
status: Active
created: 2026-07-04
owners: ["engineering"]
summary: "Operator guide for the AI-tuned quality-gates runner (scripts/quality-gates.sh) — how to run, declare, extend, and read its output."
---

# Quality Gates Runner

> **Canonical sources:** this guide documents `scripts/quality-gates.sh`. The
> feature spec lives at [doc/spec/features/feature-quality-gates-and-pr.md](../spec/features/feature-quality-gates-and-pr.md);
> the lifecycle phase is described in [doc/guides/change-lifecycle.md](change-lifecycle.md) (phase 9: quality_gates).

## What it is

`scripts/quality-gates.sh` is a stdlib-bash orchestrator that runs the
repository's quality gates in one deterministic pass, captures per-gate exit
code + duration, and emits an **AI-actionable structured summary** with log
pointers. It is the deterministic resolution target of the `/check` command
(lifecycle phase 9: quality_gates).

The runner **invokes** the repo's existing gates — it does not reimplement test
or gate discovery.

## Running gates

### Directly

```bash
# Run all gates (default — no args needed)
scripts/quality-gates.sh

# Run specific gates by name
scripts/quality-gates.sh bash-tests whitespace

# Show help + the selector taxonomy
scripts/quality-gates.sh --help
```

### Via `/check`

The `/check` command resolves `scripts/quality-gates.sh` and delegates gate
execution to it. `/check` mirrors command output under
`tmp/run-logs-runner/<YYYY-MM-DD>/` as it does for any command.

## Selectors

| Selector | Status | Behavior |
|----------|--------|----------|
| *(no args)* | Implemented | Runs every gate in the resolved set (default = `all`). |
| `all` | Implemented | Same as no args. |
| `<gate>` | Implemented | Runs only the named gate(s); repeatable for a subset. |
| `fast`, `slow` | **Future** | Accepted but treated as `all` — no duration-based partition exists yet. |

Unknown selectors are **tolerated**: warned on stderr and ignored. They never
mask a real gate failure — a failing named gate still drives a non-zero exit.

## Gate-set resolution

The runner resolves the gate set in this order (first match wins):

1. **`QGATES_GATE_SET_FILE`** — if set and pointing to an existing file, that
   file is the gate set (preferred). This is the **extension point**: a project
   adds or overrides gates via this file without editing the script's core.
2. **Built-in default set** — this repo's real gates (below).

### Built-in default gates

| Name | Command | What it checks |
|------|---------|----------------|
| `bash-tests` | `bash scripts/test-all.sh` | All `scripts/.tests/test-*.sh` suites. |
| `doc-distribution` | `bash scripts/.tests/test-doc-distribution.sh` | Drift guard for `ados_distribution` markers. |
| `plugin-freshness` | `bash scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/` | Generated Claude plugin is current. |
| `whitespace` | `git diff --check` | No whitespace/conflict-marker violations. |

## Adding a project-specific gate

Create a gate-set declaration file and point `QGATES_GATE_SET_FILE` at it. Each
line is `name command` (space-separated; `#` comments and blank lines are
ignored):

```
# custom-gates.txt
bash-tests        bash scripts/test-all.sh
doc-distribution  bash scripts/.tests/test-doc-distribution.sh
plugin-freshness  bash scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/
whitespace        git diff --check
my-project-gate   bash my-checks/lint.sh
```

Then set the env var (e.g. in CI, a wrapper script, or an AGENTS.md-declared
convention):

```bash
QGATES_GATE_SET_FILE=custom-gates.txt scripts/quality-gates.sh
```

A gate named like a built-in is **overridden** by the file entry (file wins).

## AI-tuned output contract

The runner emits a structured per-gate summary on **stdout** using the stable
`(quality-gates)` tag, so a downstream agent (`@runner`, `@fixer`) can parse
which gates passed/failed and where to look. Diagnostics (progress, warnings)
go to **stderr**.

### Summary format

```
(quality-gates) START selector=<all|named> gates=<n>
(quality-gates) name=<gate> status=<PASS|FAIL> duration=<sec>s [exit=<n>]
(quality-gates) name=<gate> log=<path>            # only on FAIL
(quality-gates) name=<gate> excerpt:              # only on FAIL
(quality-gates)   | <bounded excerpt line>        # <= 10 lines
(quality-gates) SUMMARY passed=<n> failed=<n> total=<n> overall=<PASS|FAIL>
```

- Every gate entry carries **name**, **status**, and **duration**.
- On failure, it additionally carries **exit** code, **log** pointer, and a
  bounded **excerpt** (last 10 lines of the gate's output).

### Example (clean run)

```
(quality-gates) START selector=all gates=4
(quality-gates) name=bash-tests status=PASS duration=1.234s
(quality-gates) name=doc-distribution status=PASS duration=0.456s
(quality-gates) name=plugin-freshness status=PASS duration=0.789s
(quality-gates) name=whitespace status=PASS duration=0.012s
(quality-gates) SUMMARY passed=4 failed=0 total=4 overall=PASS
```

### Example (failing gate)

```
(quality-gates) START selector=all gates=4
(quality-gates) name=bash-tests status=FAIL duration=1.234s exit=1
(quality-gates) name=bash-tests log=/repo/tmp/quality-gates/2026-07-04/bash-tests.log
(quality-gates) name=bash-tests excerpt:
(quality-gates)   | [FAIL] TC-042 something broke
(quality-gates) name=doc-distribution status=PASS duration=0.456s
...
(quality-gates) SUMMARY passed=3 failed=1 total=4 overall=FAIL
```

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | All selected gates passed (or none were selected). |
| `1` | One or more selected gates failed. |
| `2` | Usage / invocation error. |

There is no third gate-verdict outcome: the runner **never masks** a gate
failure (exit 0 iff all pass; non-zero iff any fail).

## Log locations

Per-gate logs land under the canonical output dir:

```
tmp/quality-gates/<YYYY-MM-DD>/<gate>.log
```

The date is UTC (`date -u +%F`). Override the root via `QGATES_OUTPUT_ROOT`.

`@runner` (via `/check`) additionally mirrors the full command output under
`tmp/run-logs-runner/<YYYY-MM-DD>/` — this is standard runner behavior, not
the quality-gates script's responsibility.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `QGATES_GATE_SET_FILE` | *(unset)* | Path to a gate-set declaration file (preferred over the built-in default). |
| `QGATES_OUTPUT_ROOT` | `<repo>/tmp/quality-gates` | Per-gate log root. |
| `VERBOSE` | `false` | Set to `true` for debug diagnostics on stderr. |

## Cross-links

- [Feature spec: quality gates & PR](../spec/features/feature-quality-gates-and-pr.md)
- [Change lifecycle (phase 9: quality_gates)](change-lifecycle.md)
- [Bash coding rules](../../.ai/rules/bash.md)
- [`/check` command definition](../../.opencode/command/check.md)
