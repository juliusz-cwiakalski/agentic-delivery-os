---
ados_distribution: internal
id: SPEC-CLI-ENTRYPOINT
status: Current
created: 2026-11-08
last_updated: 2026-11-11
owners: ["engineering"]
service: delivery-os
summary: "The executable CLI surface: a non-installed Bun bin plus a `main` composition entry, working-name resolution (typed configuration, the non-empty `DELIVERY_OS_WORKING_NAME` override, then the neutral `delivery-os` default), root and per-command `--help` plus `--version` with no state, network, git, or configuration read, the exact prompt-required command composition including the `dispatch`, `coordinator`, and `daemon` families, fail-closed `fallback.internal` containment for an uncomposed invocation, the declared credential references registered for serialization redaction from the injected environment, and the production composition's single repository-facts resolution that supplies the queue repository binding only as a complete key-and-root pair."
links:
  related_changes: ["GH-242", "GH-239", "GH-273", "GH-241", "GH-277", "GH-279", "GH-280", "GH-284", "GH-286", "GH-288"]
  related_decisions: ["ADR-0003", "TDR-0005", "TDR-0019", "TDR-0022", "TDR-0023"]
  contracts:
    - "packages/cli/bin/delivery-os.ts"
    - "packages/cli/src/entrypoint.ts"
    - "packages/cli/src/help.ts"
    - "packages/cli/src/help/prompt-required-commands.ts"
    - "packages/cli/src/production.ts"
    - "packages/cli/src/daemon-compose.ts"
---

# Feature: CLI Entrypoint and Self-Description

## Overview

The entrypoint is the process surface an agent or human invokes. It is a non-installed Bun bin (`packages/cli/bin/delivery-os.ts`, Bun shebang) mapped in the CLI package `bin` manifest beside the package `main` composition entry (`packages/cli/src/entrypoint.ts`). The bin reads the process environment and working directory once, builds the production composer, and delegates every decision to `runEntrypoint`; it never calls `runCli` directly. The bin and the behaviour suites both invoke the same `runEntrypoint` composition, so the tested surface is the shipped composition.

Every command that opens a store resolves the two-layer state scope through the one core policy described in [Projects Host Overview](feature-projects.md): the store, the dispatch state root, and the retro sidecar resolve the **project** state root, the owner-hold read resolves the **host** root, and an invocation outside any git work tree uses the declared `unbound` scope with one bounded warning. The composition receives the invoking command token so the read-only `projects list` path performs no host-index maintenance. The layout and policy are recorded in [TDR-0022](../../decisions/TDR-0022-multi-repository-workstation-state-scope.md).

The entrypoint composes exactly the prompt-required command set and advertises nothing else. Root `--help` lists the command families, the global flags, and the see-also pointers; `<command> --help` prints usage, options, at least one example, exit codes, and a see-also pointer; `--version` prints the binary identity, version, and build. Help and version are the one surface callable before trust is established: they perform no state, network, git, or configuration read and no write, require no valid project configuration, and never invoke the command composer.

An invocation outside the composed set fails closed through the existing `fallback.internal` containment identity — platform category, `retryable: false`, `consequence: unknown`, `platform-provider` projection, exit `2` — with a summary naming the missing composition. The entrypoint introduces no error-table row, never returns a silent success, and never crashes unclassified. Its identity arrives through the branding seam: a typed configured working name, then a non-empty `DELIVERY_OS_WORKING_NAME` override, then the neutral `delivery-os` default used only for self-description when neither source yields a name. No seed-name literal is embedded in `packages/**`.

## Interface contract

| Invocation | Outcome | Exit |
|---|---|---|
| `<binary> --help` | Root help: families, global flags, examples, see-also | `0` |
| `<binary> --version` | `<binary-name> <version> (build <build>)` | `0` |
| `<binary> <command> --help` | Command help for a prompt-required command or subcommand | `0` |
| `<binary> <command> [options] [args]` | The composed command runs through `runCli` | The command's own `{0, 1, 2}` projection |
| `<binary> <uncomposed-command>` | Classified `fallback.internal` failure naming the missing composition | `2` |

Global flags on every surface are `--json`, `--verbose`, and `--pretty`. `--json` selects the machine envelope; `--verbose` forces the full machine envelope in either machine mode and also selects a command's bounded verbose human diagnostic where one is supplied (the dispatch command names the underlying harness failure `kind`, `code`, and, when present, `field`); `--pretty` affects indentation only and never re-expands a scripted line. Command help is served from a static inventory (`packages/cli/src/help.ts`); a global flag before `--help` does not prevent help resolution. An unknown `<command> --help` path has no help entry and falls through to the classified composition failure. The help inventory covers every prompt-required command and its subcommands.

## Composition

`PROMPT_REQUIRED_COMMANDS` is the exact set the entrypoint composes:

| Command | Subcommands composed |
|---|---|
| `status` | — |
| `brief` | — |
| `queue` | `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, `release` |
| `lanes` | `list`, `show` |
| `blockers` | `publish`, `list`, `answer` |
| `phase` | `list`, `complete`, `reopen` |
| `commit` | — |
| `lint` | pm-notes, registry, and `plan` targets |
| `plan` | `validate`, `diff`, `overlap` |
| `verify` | `change`, `gates`, `deploy` |
| `merge` | — |
| `closeout` | — |
| `spend` | — |
| `retro` | `collect`, `report` |
| `dispatch` | `dual-run` (`summary`, `resolve`), `handover` (`--revert`) |
| `coordinator` | `start`, `stop`, `status`, `tick` |
| `daemon` | `start`, `stop`, `status`, `install`, `uninstall` |
| `projects` | `list` |

`state` and `mcp` are not registered or claimed: the state layer ships no command surface and `mcp` is its own package surface. The resident daemon is part of the prompt-required composition: the production composer supplies the daemon runtime unconditionally, so `daemon start`, `stop`, `status`, `install`, and `uninstall` reach their handlers and the family appears in root `--help` ([Resident Dispatch Daemon](feature-resident-daemon.md)). An absent optional daemon input — the entry path, the signal host, the supervisor seam, a re-entry environment — or an unresolvable state directory degrades one start, spawn, or install shape; it never removes the command, because a prompt-required command with no runtime is a composition gap the entrypoint contains as `fallback.internal`. The coordinator family is part of the prompt-required composition: the production composer supplies its `CoordinatorComposition` (store, clock, id/fence factories, resolved coordinator settings, node process port with start-time identity, the delivered harness session port selected per harness kind, harness-session facts/effects, and the foreground cycle driver), and the shipped `coordinator status`, `start --foreground`, `stop`, and `tick` reach the handler. Its help entry points at the coordinator reference page. Other registered commands (`config`, `provider`, `db`, `watchdog`, `board`) are not prompt-required and are dropped from the composed program rather than advertised. `doctor` is registered only when a `DoctorComposition` is supplied; the production composer supplies none today, so the production program contains no `doctor` command and it is not advertised (a pre-existing doctor residual, see [Doctor](feature-doctor.md)). `dispatch` is composed with its resolution, summary, and reversal forms, and its help entries point at the dispatch reference page. The `projects` family is prompt-required and composed by the production entrypoint; its reference page is the M2 page (`doc/planning/oss-tooling/milestones/m2/commands/projects.md`), resolved through the per-command page-root mapping the two help gates apply, and it is composed in the edge's command map so the entrypoint's restriction step finds it.

Program selection is strict. A missing prompt-required command is a composition gap and throws instead of shipping a partial surface; the entrypoint catches that throw and answers the invocation with the `fallback.internal` containment identity. Extra registrations are dropped. The production composer (`packages/cli/src/production.ts`) wires the delivered adapters — the state store, credential port, repository facts, git seams, GitHub client, and the command runtimes — and reuses the branding seam so the name has one source.

The composer resolves the checkout's repository facts once per invocation and derives the queue repository binding from that single resolution. The binding is present only when the GitHub target resolution from the origin succeeds, `normalizeRepositoryKey(originUrl)` yields the normalized `host/owner/name` key, and the resolved checkout root is defined; otherwise the queue composition receives no binding at all, never a key without a root or a root without a key. An injected repository origin replaces only the remote, while the checkout root always resolves from the working directory, so the recorded root is the declaring checkout's absolute root from the top level, a nested directory, or a linked worktree. The queue entry records the normalized key and the root together, and the root stays internal: it is never serialized into an envelope, finding, incident, log line, or telemetry event.

## Identity resolution

The working name resolves in declared order:

1. The typed configured working name, when present and non-empty.
2. A non-empty `DELIVERY_OS_WORKING_NAME` override, which takes precedence over the configured name when both are present.
3. The neutral default `delivery-os` when neither source yields a name.

An empty override is ignored rather than rejecting the run, and an invalid override or name falls back to the neutral default so self-description stays usable. The neutral default is not the forbidden seed literal and is used for `--help`/`--version` identity only. Version and build default to `0.0.0` and `dev` when the composition does not inject them. `--version` output is metadata only: it reads no environment beyond the working-name override and prints no secret.

## Runtime neutrality and boundaries

`packages/cli/src/entrypoint.ts` and `packages/cli/src/help.ts` are runtime-neutral: they import core contracts, branding data, and the credentials adapter's pure source-key resolver; they read no ambient global and perform no I/O. `packages/cli/src/production.ts` and `packages/cli/bin/delivery-os.ts` are the declared process edges: the bin reads `process.env`, the working directory, and the home directory once and writes one exit code; the production composer constructs the Node file, process, state, git, and provider edges. Both files are exact, reason-bearing entries in the content inventory.

The bin passes the declared credential references (`DECLARED_CREDENTIAL_REFERENCES`, the `github-read` reference in production) into `runEntrypoint` through the optional `credentialReferences` input. The entrypoint derives each reference's resolved source key and registers any non-empty value present in the injected environment for serialization redaction, so no diagnostic, envelope, or human text can echo the truth-read credential. An absent or empty value is not registered, and no ambient environment read is added.

The entrypoint emits self-description text through the existing serialization chokepoint: help and version travel as the human-success payload of an inert synthetic command, so every byte passes the same redaction and write path as any other command and no second stream writer exists. The entrypoint never invokes `process.exit`; the bin sets `process.exitCode` from the returned code.

## Install posture

The bin is not part of the install or release surface. `scripts/install.sh` names neither the bin nor the composition in either of its delivery arrays, installer tests stay unchanged, and no packaging surface claims an installed executable. Installing or releasing the binary is a later concern.

## Quality evidence

| Level | Scope | Evidence |
|---|---|---|
| Behaviour | Root help, command help coverage, version identity and precedence, help/version isolation, composition honesty and fail-closed containment | `tests/behaviour/entrypoint-help.test.ts`, `entrypoint-help-coverage.test.ts`, `entrypoint-version.test.ts`, `entrypoint-help-isolation.test.ts`, `entrypoint-composition.test.ts` |
| Structure | Bin and `main` manifest mapping, Bun shebang, composition invocation, installer absence, the shipped coordinator registration, and the declared credential-reference redaction registration | `tests/structure/entrypoint-bin.test.ts`, `entrypoint-installer-absence.test.ts`, `cli-edge-seam.test.ts`, `coordinator-production-composition.test.ts` |
| Daemon mount | Prompt-required membership, unconditional production registration, selection without a containment throw, help and reference coverage, and the detached re-entry path proven through one bounded real child | `tests/structure/daemon-production-composition.test.ts`, `tests/behaviour/daemon-mount-help.test.ts`, `tests/conformance/daemon-mount/real-reentry.test.ts`, `tests/checks/daemon-privacy.test.ts` |
| Composition binding | Production queue repository binding derivation, the key-and-root pair, root sourcing and non-disclosure, and the queue entry invariant | `tests/behaviour/queue-production-binding.test.ts`, `queue-binding-invariant.test.ts`, `tests/structure/queue-binding-derivation.test.ts`, `queue-binding-fixture-shape.test.ts`, `tests/conformance/pilot/pilot-records.test.ts` |
| Checks | Forbidden literals, content inventory, help/guide coverage | `scripts/checks/forbidden-literals.ts`, `tests/structure/content-inventory.test.ts`, `scripts/checks/help-guide-coverage.ts` |

Help/version isolation is asserted with a throwing composer: the composer must not run, the run must exit `0` with empty stderr, and the working directory must stay byte-identical, including when a configuration file is unreadable or the environment is poisoned. An uncomposed-command case asserts the exact identity fields and exit `2` and that `data` is absent. Every case is deterministic over injected streams, clock, and run id.

## Related

- [Agents and Commands System](feature-agents-and-commands.md) — the prompt inventory, the delivery-integration invariants, and the prompt/help/guide conformance checks.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the `fallback.internal` containment entry, and the `{0, 1, 2}` projection.
- [Branding Seam and Working Name](feature-branding-seam.md) — the injected identity and the working-name input.
- [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md) — package layout, exports, and the content-inventory boundary.
- [MCP Surface](feature-mcp-surface.md) — the separate read-only `mcp serve` package surface, which declares no `bin`.
- [Dispatch Engine](feature-dispatch-engine.md) — the `dispatch` family composed by this entrypoint, its help entries, and the reference page.
- [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md)

**Change record:** `doc/changes/2026-11/2026-11-07--GH-242--agent-integration/`.
