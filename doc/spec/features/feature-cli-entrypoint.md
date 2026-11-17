---
ados_distribution: internal
id: SPEC-CLI-ENTRYPOINT
status: Current
created: 2026-11-08
last_updated: 2026-11-17
owners: ["engineering"]
service: delivery-os
summary: "The executable CLI surface: two declared Bun bins (`delivery-os` and `jaiship`) over one shared launcher composition plus a `main` composition entry, per-bin declared default identities with the non-empty `DELIVERY_OS_WORKING_NAME` override as the one seam, root and per-command `--help` plus `--version` plus the install-path self-description with no state, network, git, or configuration read, the exact prompt-required command composition including the `dispatch`, `coordinator`, `daemon`, `projects`, `repos`, `events`, `board`, `ceremony`, `steer`, and `supervise` families, fail-closed `fallback.internal` containment for an uncomposed invocation, the declared credential references registered for serialization redaction from the injected environment, and the production composition's single repository-facts resolution that supplies the queue repository binding only as a complete key-and-root pair."
links:
  related_changes: ["GH-242", "GH-239", "GH-273", "GH-241", "GH-277", "GH-279", "GH-280", "GH-284", "GH-286", "GH-288", "GH-289", "GH-290", "GH-309", "GH-320", "GH-296", "GH-297", "GH-287", "GH-298", "GH-295"]
  related_decisions: ["ADR-0003", "TDR-0005", "TDR-0019", "TDR-0022", "TDR-0023", "TDR-0024", "TDR-0025"]
  contracts:
    - "packages/cli/bin/delivery-os.ts"
    - "packages/cli/bin/jaiship.ts"
    - "packages/cli/src/bin-launcher.ts"
    - "packages/cli/src/entrypoint.ts"
    - "packages/cli/src/help.ts"
    - "packages/cli/src/help/prompt-required-commands.ts"
    - "packages/cli/src/production.ts"
    - "packages/cli/src/daemon-compose.ts"
---

# Feature: CLI Entrypoint and Self-Description

## Overview

The entrypoint is the process surface an agent or human invokes. The CLI package `bin` manifest declares exactly two executables: `delivery-os` (`packages/cli/bin/delivery-os.ts`, the compatibility alias) and `jaiship` (`packages/cli/bin/jaiship.ts`), beside the package `main` composition entry (`packages/cli/src/entrypoint.ts`). Both bins are thin identity selectors over one shared launcher composition (`packages/cli/src/bin-launcher.ts`): the launcher reads the process environment, the working directory, and the home directory once, builds the production composer, and delegates every decision to `runEntrypoint`; neither bin composes a second body and neither calls `runCli` directly. The bins and the behaviour suites invoke the same `runEntrypoint` composition, so the tested surface is the shipped composition.

Each bin declares exactly two facts at the process edge: its default working name (`delivery-os` for the compatibility alias, `jaiship` for the primary bin) and, for the `jaiship` bin only, the pre-freeze working name as its prior identity. Every derived value — binary name, environment prefix, configuration directory, state directory, tool prefix, install path, and the prior identity's equivalents — comes from the one resolver.

Every command that opens a store resolves the two-layer state scope through the one core policy described in [Repositories and the Host Overview](feature-projects.md): the store, the dispatch state root, and the retro sidecar resolve the **project** state root, the owner-hold read resolves the **host** root, and an invocation outside any git work tree uses the declared `unbound` scope with one bounded warning. The composition receives the invoking command token so the read-only `projects list` and `repos list` paths perform no host-index maintenance. The layout and policy are recorded in [TDR-0022](../../decisions/TDR-0022-multi-repository-workstation-state-scope.md).

The entrypoint composes exactly the prompt-required command set and advertises nothing else. Root `--help` lists the command families, the global flags, and the see-also pointers; `<command> --help` prints usage, options, at least one example, exit codes, and a see-also pointer; `--version` prints the binary identity, version, and build; `--print-install-path` prints the effective identity's brand install path on one line. The install-path read is a root-level self-description member intercepted before any composition, under the same isolation contract as help and version; it adds no command family and no global flag, and it is deliberately not advertised in root help. Root `--help` is bounded by content — one row per family plus the five declared sections — not by a line or byte ceiling; a per-command help page stays inside the delivered family-page bound of 120 lines and 4 000 bytes. Help and version are the one surface callable before trust is established: they perform no state, network, git, or configuration read and no write, require no valid project configuration, and never invoke the command composer.

An invocation outside the composed set fails closed through the existing `fallback.internal` containment identity — platform category, `retryable: false`, `consequence: unknown`, `platform-provider` projection, exit `2` — with a summary naming the missing composition. The entrypoint introduces no error-table row, never returns a silent success, and never crashes unclassified. Its identity arrives through the branding seam: a typed configured working name, then a non-empty `DELIVERY_OS_WORKING_NAME` override, then the invoking bin's declared default used for self-description when neither source yields a name. A configuration-bearing invocation under an invalid override keeps the delivered projection: brand resolution fails before the command set is composed, the delivered pre-composition configuration probe/read and state-root touch still occur, and the containment identity `fallback.internal` answers at exit `2` with the delivered summary. A notice the composition produced before it failed is still delivered: the entrypoint collects composition-scoped warning lines and passes the collected lines to the containment outcome, so the `jaiship` bin's prior-configuration read emits its one `prior-identity-fallback: config-read` line on stderr before `fallback.internal` answers, while the alias emits none and the machine payload stays clean. The committed working-name literals are exactly the declared five-site inventory: the three CLI selector sites, the unchanged MCP default, and the resolver's scope-org derivation input ([Branding Seam](feature-branding-seam.md)).

## Interface contract

| Invocation | Outcome | Exit |
|---|---|---|
| `<binary> --help` | Root help: families, global flags, examples, see-also | `0` |
| `<binary> --version` | `<binary-name> <version> (build <build>)` | `0` |
| `<binary> --print-install-path` | The effective identity's brand install path on one line | `0` |
| `<binary> <command> --help` | Command help for a prompt-required command or subcommand | `0` |
| `<binary> <command> [options] [args]` | The composed command runs through `runCli` | The command's own `{0, 1, 2}` projection |
| `<binary> <uncomposed-command>` | Classified `fallback.internal` failure naming the missing composition | `2` |

Global flags on every surface are `--json`, `--verbose`, and `--pretty`. `--json` selects the machine envelope; `--verbose` forces the full machine envelope in either machine mode and also selects a command's bounded verbose human diagnostic where one is supplied (the dispatch command names the underlying harness failure `kind`, `code`, and, when present, `field`); `--pretty` affects indentation only and never re-expands a scripted line. Command help is served from a static inventory (`packages/cli/src/help.ts`); a global flag before `--help` does not prevent help resolution. An unknown `<command> --help` path has no help entry and falls through to the classified composition failure. The help inventory covers every prompt-required command and its subcommands.

## Composition

`PROMPT_REQUIRED_COMMANDS` is the exact set the entrypoint composes — twenty-four families:

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
| `retro` | `collect`, `report`, `action` (`file`, `close`, `list`) |
| `dispatch` | `attempts` (`--ref`, `--limit`), `dual-run` (`summary`, `resolve`), `handover` (`--revert`) |
| `coordinator` | `start`, `stop`, `status`, `tick` |
| `daemon` | `start`, `stop`, `status`, `install`, `uninstall` |
| `projects` | `list` |
| `repos` | `list` |
| `events` | `list`, `describe <topic>` |
| `board` | `--all`, `--project <key>` |
| `ceremony` | `list`, `run <name>`, `resume <runId>`, `catch-up [--name <name>]` |
| `steer` | `send <text>`, `list`, `read`, `complete <id> --ref <artifact>` |
| `supervise` | — |

`state` and `mcp` are not registered or claimed: the state layer ships no command surface and `mcp` is its own package surface. The resident daemon is part of the prompt-required composition: the production composer supplies the daemon runtime unconditionally, so `daemon start`, `stop`, `status`, `install`, and `uninstall` reach their handlers and the family appears in root `--help` ([Resident Dispatch Daemon](feature-resident-daemon.md)). An absent optional daemon input — the entry path, the signal host, the supervisor seam, a re-entry environment — or an unresolvable state directory degrades one start, spawn, or install shape; it never removes the command, because a prompt-required command with no runtime is a composition gap the entrypoint contains as `fallback.internal`. The coordinator family is part of the prompt-required composition: the production composer supplies its `CoordinatorComposition` (store, clock, id/fence factories, resolved coordinator settings, node process port with start-time identity, the delivered harness session port selected per harness kind, harness-session facts/effects, and the foreground cycle driver), and the shipped `coordinator status`, `start --foreground`, `stop`, and `tick` reach the handler. Its help entry points at the coordinator reference page. Other registered commands (`config`, `provider`, `db`, `watchdog`) are not prompt-required and are dropped from the composed program rather than advertised. The `board` family is prompt-required and composed unconditionally by the production composition root: it reads the managed repositories through the per-repository state scope and host index, renders the declared sections, and serves its M2 reference page (`doc/planning/oss-tooling/milestones/m2/commands/board.md`) through the same page-root mapping ([Board](feature-board.md)). `doctor` is registered only when a `DoctorComposition` is supplied; the production composer supplies none today, so the production program contains no `doctor` command and it is not advertised (a pre-existing doctor residual, see [Doctor](feature-doctor.md)). `dispatch` is composed with its attempt read, resolution, summary, and reversal forms, and its help entries point at the dispatch reference page (the attempt subfamily points at its own M2 page). `dispatch attempts` is a subfamily, so the prompt-required set and the root family listing are unchanged. The `projects` family is prompt-required and composed by the production entrypoint; its reference page is the M2 page (`doc/planning/oss-tooling/milestones/m2/commands/projects.md`), resolved through the per-command page-root mapping the two help gates apply, and it is composed in the edge's command map so the entrypoint's restriction step finds it. The `repos` family is prompt-required in the same way: its single `list` verb reads the flat record set, it is composed in the edge's command map, it appears in root `--help` beside `projects`, and its reference page is the M2 page (`doc/planning/oss-tooling/milestones/m2/commands/repos.md`) through the same page-root mapping. The `events` family is prompt-required and composed unconditionally: its runtime is the compiled taxonomy declaration, so the production composer supplies it with no store, configuration, transport, or supervisor input, `events list` and `events describe <topic>` reach their handler, and its help entries point at the M2 page through the same page-root mapping.
 The `ceremony` family is prompt-required and composed unconditionally: the production composer supplies its runtime (the state store, the state directory, the injected clock and run-id/fence factories, the invoking checkout root, the brand configuration directory, and the resolved repository id), so `ceremony list`, `run`, `resume`, and `catch-up` reach their handler and the family appears in root `--help`; its reference page is the M2 page through the same page-root mapping. Its declared input collectors and its mirror landing path are composed separately from the entrypoint, so a ceremony input that is not composed arrives at the engine as a declared `unavailable` degradation rather than a composition gap (see [Ceremony Runner](feature-ceremony-runner.md#9-delivered-limits-and-known-gaps)).
The `retro` family is prompt-required and composed with both surfaces: the evidence runtime (sidecar, collectors, and registry) and the action-registry port behind the additive `action` verb group, so `retro collect`, `report`, `action file`, `action close`, and `action list` reach their handler. The M2 reference page (`doc/planning/oss-tooling/milestones/m2/commands/retro.md`) serves the help-coverage check through the per-command page-root mapping, and the M1 page stays the snapshot page.
 The `steer` family is prompt-required and composed unconditionally: the production composer supplies its runtime (the invoking state store, the injected clock and fence factory, the derived checkout origin from the local PM context, the delivered phase fold over the bound change, and the delivered open-question view with its PDR-0003 join facts), so `steer send`, `list`, `read`, and `complete` reach their handler and the family appears in root `--help`; its reference page is the M2 page through the same page-root mapping (see [Steer](feature-steer.md)).
 The `supervise` family is prompt-required and composed unconditionally: the production composer supplies its runtime (the invoking state store, the resolved repository key with its declared checkout-directory fallback, the injected clock and fence factory, the delivered park append path, and the delivered restart, exhaustion, and typed-question append paths), so `supervise` reaches its handler and the family appears in root `--help`; its reference page is the M2 page through the same page-root mapping (see [Supervise](feature-supervise.md)).

Program selection is strict. A missing prompt-required command is a composition gap and throws instead of shipping a partial surface; the entrypoint catches that throw and answers the invocation with the `fallback.internal` containment identity. Extra registrations are dropped. The production composer (`packages/cli/src/production.ts`) wires the delivered adapters — the state store, credential port, repository facts, git seams, GitHub client, and the command runtimes — and reuses the branding seam so the name has one source.

The composer resolves the checkout's repository facts once per invocation and derives the queue repository binding from that single resolution. The binding is present only when the GitHub target resolution from the origin succeeds, `normalizeRepositoryKey(originUrl)` yields the normalized `host/owner/name` key, and the resolved checkout root is defined; otherwise the queue composition receives no binding at all, never a key without a root or a root without a key. An injected repository origin replaces only the remote, while the checkout root always resolves from the working directory, so the recorded root is the declaring checkout's absolute root from the top level, a nested directory, or a linked worktree. The queue entry records the normalized key and the root together, and the root stays internal: it is never serialized into an envelope, finding, incident, log line, or telemetry event.

## Identity resolution

The working name resolves in declared order:

1. The typed configured working name, when present and non-empty.
2. A non-empty `DELIVERY_OS_WORKING_NAME` override, which takes precedence over the configured name when both are present.
3. The invoking bin's declared default working name when neither source yields a name — the alias bin declares `delivery-os` and the `jaiship` bin declares `jaiship`.

An empty override is ignored rather than rejecting the run, and an invalid override or name falls back to the invoking bin's declared default so self-description stays usable and a `jaiship` self-description never reports a different product. The entrypoint module keeps no identity literal and no internal default: the declared default is a required input, and its absence where an identity is needed is the delivered containment identity `fallback.internal` at exit `2`, never a substituted name. Version and build default to `0.0.0` and `dev` when the composition does not inject them. `--version` output is metadata only: it reads no environment beyond the working-name override and prints no secret. `--print-install-path` answers the **effective** identity, so an override present in the environment is honoured when an operator asks directly; the installer pins the declared identity instead ([Local Install guide](../../guides/local-install.md)).

## Runtime neutrality and boundaries

`packages/cli/src/entrypoint.ts` and `packages/cli/src/help.ts` are runtime-neutral: they import core contracts, branding data, and the credentials adapter's pure source-key resolver; they read no ambient global and perform no I/O. `packages/cli/src/production.ts` and `packages/cli/src/bin-launcher.ts` are the declared process edges: the launcher reads `process.env`, the working directory, and the home directory once and writes one exit code; the production composer constructs the Node file, process, state, git, and provider edges. Both bins are exact, reason-bearing entries in the content inventory, as are the launcher and the composition.

The launcher passes the declared credential references (`DECLARED_CREDENTIAL_REFERENCES`, the `github-read` reference in production) into `runEntrypoint` through the optional `credentialReferences` input. The entrypoint derives each reference's resolved source key and registers any non-empty value present in the injected environment for serialization redaction, so no diagnostic, envelope, or human text can echo the truth-read credential. An absent or empty value is not registered, and no ambient environment read is added.

The entrypoint emits self-description text through the existing serialization chokepoint: help and version travel as the human-success payload of an inert synthetic command, so every byte passes the same redaction and write path as any other command and no second stream writer exists. The entrypoint never invokes `process.exit`; the bin sets `process.exitCode` from the returned code.

## Prior-identity read

A `jaiship` invocation declares the pre-freeze working name as its prior identity. Where the delivered composition acquires project configuration (the composition-time daemon/lane settings read that every composed invocation performs, so `status --json` exercises it), it considers the current-identity file first and the prior-identity file second, per repository-owned layer; the current file wins whenever it exists and the prior file is then reported as not used. The host-root policy selects the prior default root only when the current default root is absent, and no current default root is created while the fallback holds. Both facts are reported once per source kind per composed program by the prior-identity fallback notice (`prior-identity-fallback`, reasons `config-read`, `config-skipped`, `state-read`, `state-skipped`) on stderr in every mode, never in a payload and never as an exit-code change. The alias declares no prior identity, so no fallback path applies to it. The fallback is read-only with respect to the prior configuration directory and is not a configuration warning, so `--strict` is unchanged. Precedence and the notice contract are stated in [Configuration Layer](feature-config-layer.md) and [Repositories and the Host Overview](feature-projects.md); the operator-facing description is the [Local Install guide](../../guides/local-install.md).

## Install posture

A user-level local install registers an executable launcher at the brand install path — `~/.jaiship/bin/jaiship` for the `jaiship` identity — and nothing else about the install set changes. The launcher hand-off records exactly one absolute target, the installed source tree's CLI entry, at install time; the recorded target is rendered as a single safely quoted shell word, so a source path containing a single quote, a backslash, or a space still yields a launcher that execs exactly that target. It passes the invocation arguments through, inherits the standard streams, and leaves the environment unmodified, so the working-name override and every delivered flag behave exactly as they do in the repository. Re-running an unchanged install rewrites nothing, a different source repoints the launcher, and a missing target answers one bounded stderr line naming the target and the remedy with a non-zero exit. The install path is not composed by the installer: it is read from the executable's state-free `--print-install-path` self-description with the working-name override removed from that child's environment, so the resolver remains the single derivation point and an ambient override cannot redirect the install. The installer's delivery script and tool arrays stay unchanged and name neither bin nor composition; the install set, its install-time runtime requirement, and its classified failure modes are stated in [Documentation Distribution Marker](feature-doc-distribution-marker.md). The alias keeps its delivered `delivery-os` mapping, and no `delivery-os` launcher is registered.

## Quality evidence

| Level | Scope | Evidence |
|---|---|---|
| Behaviour | Root help, command help coverage, version identity and precedence, help/version isolation, the install-path read, the two-bin process edge and family parity, the alias baseline, the override seam, and composition honesty and fail-closed containment | `tests/behaviour/entrypoint-help.test.ts`, `entrypoint-help-coverage.test.ts`, `entrypoint-version.test.ts`, `entrypoint-help-isolation.test.ts`, `entrypoint-composition.test.ts`, `entrypoint-two-bins.test.ts`, `identity-override.test.ts` |
| Structure | The two-bin manifest mapping, Bun shebang, the shared launcher composition, the declared five-site identity-literal inventory, the composed `main` entry, installer absence with the declared launcher step, the shipped coordinator registration, and the declared credential-reference redaction registration | `tests/structure/entrypoint-bin.test.ts`, `install-launcher.test.ts`, `entrypoint-installer-absence.test.ts`, `cli-edge-seam.test.ts`, `coordinator-production-composition.test.ts` |
| Daemon mount | Prompt-required membership, unconditional production registration, selection without a containment throw, help and reference coverage, and the detached re-entry path proven through one bounded real child | `tests/structure/daemon-production-composition.test.ts`, `tests/behaviour/daemon-mount-help.test.ts`, `tests/conformance/daemon-mount/real-reentry.test.ts`, `tests/checks/daemon-privacy.test.ts` |
| Events mount | Prompt-required membership, unconditional production registration over the compiled declaration, root-help listing, family and verb help, the M2 reference page and coverage rows, and the reference-surface purity | `tests/structure/events-production-composition.test.ts`, `tests/behaviour/events-mount-help.test.ts`, `tests/checks/event-mount-guards.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/behaviour/events-purity.test.ts` |
| Repos mount | Prompt-required membership, root-help listing beside `projects`, family and verb help, the M2 reference page and coverage row, and the prompt-set count | `tests/behaviour/repos-help.test.ts`, `tests/behaviour/entrypoint-composition.test.ts`, `tests/checks/reference-page-parity.test.ts`, `scripts/checks/help-guide-coverage.ts` |
| Steer mount | Prompt-required membership as the twenty-third family, unconditional production registration over the store, clock, origin, phase fold, and asks view, root/family/subcommand help, the M2 reference page and coverage row, and the moved family-count pins | `tests/structure/steer-mounting.test.ts`, `tests/behaviour/steer-help.test.ts`, `tests/behaviour/entrypoint-help-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` |
| Supervise mount | Prompt-required membership as the twenty-fourth family, unconditional production registration over the store, resolved repository key, clock, park write path, and economics append paths, root/family help, the M2 reference page and coverage row, and the moved family-count pins | `tests/structure/supervision-mounting.test.ts`, `tests/behaviour/supervision-help.test.ts`, `tests/behaviour/entrypoint-help-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` |
| Composition binding | Production queue repository binding derivation, the key-and-root pair, root sourcing and non-disclosure, and the queue entry invariant | `tests/behaviour/queue-production-binding.test.ts`, `queue-binding-invariant.test.ts`, `tests/structure/queue-binding-derivation.test.ts`, `queue-binding-fixture-shape.test.ts`, `tests/conformance/pilot/pilot-records.test.ts` |
| Checks | Forbidden literals, content inventory, help/guide coverage | `scripts/checks/forbidden-literals.ts`, `tests/structure/content-inventory.test.ts`, `scripts/checks/help-guide-coverage.ts` |

Help/version isolation is asserted with a throwing composer: the composer must not run, the run must exit `0` with empty stderr, and the working directory must stay byte-identical, including when a configuration file is unreadable or the environment is poisoned. An uncomposed-command case asserts the exact identity fields and exit `2` and that `data` is absent. Every case is deterministic over injected streams, clock, and run id.

## Related

- [Agents and Commands System](feature-agents-and-commands.md) — the prompt inventory, the delivery-integration invariants, and the prompt/help/guide conformance checks.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the `fallback.internal` containment entry, and the `{0, 1, 2}` projection.
- [Branding Seam and Working Name](feature-branding-seam.md) — the injected identity, the working-name input, and the derived install path.
- [Local Install and Prior-Identity Transition](../../guides/local-install.md) — the install command shape, the launcher, the notice, and the declared divergences.
- [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md) — package layout, exports, and the content-inventory boundary.
- [MCP Surface](feature-mcp-surface.md) — the separate read-only `mcp serve` package surface, which declares no `bin`.
- [Dispatch Engine](feature-dispatch-engine.md) — the `dispatch` family composed by this entrypoint, its help entries, and the reference page.
- [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md)

**Change record:** `doc/changes/2026-11/2026-11-07--GH-242--agent-integration/`.
