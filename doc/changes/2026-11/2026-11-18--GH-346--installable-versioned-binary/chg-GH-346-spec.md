---
change:
  ref: GH-346
  type: feat
  status: Proposed
  slug: installable-versioned-binary
  title: "M4-S1: Installable, versioned binary — self-contained artifact and the composed install lifecycle"
  version: "1.0"
  owners: ["Juliusz Ćwiąkalski"]
  service: jaiship CLI install surface, release artifact, and local install tooling
  milestone: "M4: Jaiship-native delivery"
  labels:
    - cli
    - entrypoint
    - installer
    - install-lifecycle
    - binary
    - release
    - m4
  version_impact: minor
  audience: mixed
  security_impact: medium
  risk_level: high
  dependencies:
    internal:
      - "delivered executable entrypoint and the two-bin identity selectors (GH-320): one shared launcher composition, `--help`/`--version`/`--print-install-path` read-free self-description, exact family parity"
      - "delivered version render and its optional injected `version`/`build` inputs (GH-242), never supplied in production today"
      - "delivered typed-error contract: envelope, closed `DOMAIN_KINDS` register, single projection module, `{0, 1, 2}` exit taxonomy"
      - "delivered state layer: one store-format identifier, one ledger header per store, and the `state.schema.mismatch` hard gate"
      - "delivered git adapter reads (worktree path, worktree list, cleanliness) with fixed argv and no shell"
      - "delivered installer launcher step and the shell uninstaller's repository-artifact scope"
    external:
      - "Bun 1.4.4 (pinned toolchain; the only build mechanism and runtime for the artifact)"
      - "git (worktree topology and commit metadata at build and install time only; no network)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Turn the delivered CLI from a source tree executed by a runtime into a versioned, self-contained, self-describing product artifact — and give that artifact one composed `install` lifecycle that installs, inspects, rolls back, removes, and purges it atomically, refuses a target that lives in a disposable worktree, refuses a development run, reports a real compatibility verdict against the on-disk state format, and never depends on the checkout it was built from.

## 1. SUMMARY

The product's installed entry point is today a bash launcher that records one absolute path to a TypeScript entry inside whichever checkout installed it, and executes the Bun runtime on that path. Both delivered launchers on the author's workstation point into a lane worktree that is deleted after merge, and the command they run reports `jaiship 0.0.0 (build dev)` — so the installed product is a pointer into a disposable directory that cannot say which build it is. That is the defect this change removes.

The change delivers four things that only make sense together:

1. **One self-contained artifact.** A single Bun-compiled executable at the repository-root artifact directory, built by one additive root build script, carrying a build identity (lockstep version, full commit, build instant, dirty flag) injected as a compile-time constant. It runs with no runtime on `PATH`, no TypeScript source, and no workspace dependencies present; it never reads git, state, or configuration to describe itself.
2. **A truthful `--version`.** The delivered one-line shape is preserved byte-for-byte and the existing `(build <build>)` slot is given its real meaning: the build identity token (short commit, `-dirty`, `unknown`, or the preserved `dev`). No field is added to the line and no machine mode is added to `--version`; the full identity is served only by `install status --json`.
3. **One composed `install` family.** `install`, `install status`, `install rollback`, `install uninstall`, `install purge` join the prompt-required composition as the twenty-sixth family, with `--add-to-path`, `--shell-profile`, `--migrate`, `--dry-run`, `--stop-daemon` as their flags. The family is composed for both executable identities and **refused typedly** on the compatibility alias, so the alias can never create a pre-freeze namespace. `upgrade` is not a verb: an upgrade is an `install` of a different compiled artifact.
4. **Safety rules with a name.** One install-target stability rule refuses a target that resolves inside a linked git worktree and refuses a development run; one compatibility check compares the artifact's accepted store-format identifier with each enumerated state root's existing ledger header, advisory on the write paths and a typed verdict on the report path; one seven-step atomic replace with a single rollback slot; one removal matrix with an always-printed purge residual set; one zero-write dry-run per write path.

The residual shell surfaces keep their own artifact class: the delivered launcher step survives unchanged **when no managed binary exists** and refuses, classified, when one does; the shell uninstaller keeps its repository-artifact scope and reports a managed install instead of touching it. The transitional costs are declared rather than hidden: a ~107 MB unminified host-only artifact whose `builtAt` field makes byte-identical rebuilds impossible, and one visible asymmetry — the compatibility alias advertises a family it refuses.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The installed product is a pointer into a checkout.** The delivered local install registers an executable bash launcher at the brand install path (`~/.jaiship/bin/jaiship`) whose single recorded target is an absolute path to the source tree's CLI entry, and whose body executes the Bun runtime on that target with the invocation arguments passed through (`scripts/install.sh` `install_local_launcher`, `resolve_launcher_path`, one declared `CLI_ENTRY_RELATIVE`). The step is content-idempotent, stages beside the destination, and classifies exactly two install-time failures: no Bun runtime, and a resolved source tree with no CLI entry. `DRY_RUN` is a plan-only preview that evaluates no precondition and writes nothing.
- **The live defect.** On the author's workstation both `~/.jaiship/bin/jaiship` and `~/.local/bin/jaiship` record a target inside the `jaiship-gh-339` lane worktree, and a lane worktree is deleted after merge; the command reports `jaiship 0.0.0 (build dev)` (observed 2026-11-18). The installed entry point breaks the moment that worktree is removed, and it cannot name a build while it works.
- **Nothing in the repository produces a self-contained artifact.** The root `build` script is a recursive package build that ends in TypeScript compilation; the CLI package's build emits library output for workspace consumers. A compile probe on the pinned toolchain produced a working single-file executable from the primary bin that answered `--version`, `--help`, `--print-install-path`, and one composed command correctly (measured 2026-11-18).
- **Production never supplies the identity.** The version render is `<binary-name> <version> (build <build>)` on one line, with `0.0.0` and `dev` as the defaults of two optional entrypoint inputs; both bins pass process facts and neither supplies `version` or `build`, so every production run takes the defaults.
- **Self-description is contractually read-free.** `--version`, `--help`, and `--print-install-path` perform no state, git, configuration, or network read and no write, and never invoke the composer; the isolation suite proves it with a throwing composer and a poisoned environment. `--print-install-path` is the install-path authority, and the installer scrubs the working-name override from that child's environment so an ambient value cannot redirect a registration.
- **A compiled artifact changes three process-edge facts.** Its `argv` is `["bun", "/$bunfs/root/<name>", …userArgs]`, so argument parsing is unchanged in effect; its `process.execPath` is the artifact path; and `process.argv[1]` is a virtual path inside the bundle. The bins pass `daemonEntry: process.argv[1]`, which the daemon composition consumes for detached re-entry and for the installed service unit — so an unmodified compiled artifact would install a service unit naming `/$bunfs/root/jaiship`.
- **The composed command set is twenty-five families, and only its members are reachable.** `selectPromptRequiredProgram` copies exactly `PROMPT_REQUIRED_COMMANDS` and drops every extra registration, and a missing member throws a composition gap that the entrypoint contains as `fallback.internal` at exit `2`. `config` and `doctor` are the delivered proofs that a registered-but-not-prompt-required command is unreachable through the binary. Family parity between the two bins is an exact assertion with the count and the tail positions pinned across the structure and behaviour suites.
- **Every prompt-required command needs a reference page.** The help coverage check requires one page per family containing `--help` and `--version`, resolved through a per-command page-root mapping whose roots are the M1 and M2 milestone page directories, with the inventory mirrored in the help-guide coverage fixture; it runs inside the aggregate quality gate. Each delivered mount added its page, its inventory rows, and its page-root branch in the same change.
- **Failure identity is one closed register.** Every failure carries a registered identity from a closed domain-kind register, an envelope, and the fixed projection (`success` 0, `user-validation` 1, `attention` 1, `platform-provider` 2); the projection module is the only place an exit digit may appear. The result-contract page documents every row and the closed two-segment allowlist (currently 65 declared identities), and a CI gate fails when the source table, the documented table, and the fixtures disagree. Shell scripts own a separate numeric vocabulary and are not part of this contract.
- **The state layer already declares the only compatibility anchor.** One store-format identifier (`delivery.state.v1`) is written into `<state root>/header.<workspace>.json` when a store is created, and the store already refuses a mismatch in two places with `state.schema.mismatch` (`platform-provider`, non-retryable, exit `2`). Every other version in the system is per-domain and enforced at its own boundary; there is no aggregate repository-state version anywhere.
- **State roots are enumerated, not discovered.** A host root (an override when set, otherwise the brand default) holds one directory per project under `projects/<key>`, each with its own header; a machine can hold several independent stores.
- **There is no install record and no lifecycle surface.** No install record exists anywhere in the repository and nothing writes or reads one. There is no `install` family, no rollback slot, no PATH management by the product, and no compatibility report. The delivered documentation states, as a property of the launcher step, that no uninstall path exists and that removing a registered launcher is an operator action.
- **The shell uninstaller has a different, documented scope.** It removes repository artifacts (global agent/command files, the cloned home, local project copies), documents its own `0/2/3/4/5` exit taxonomy, supports `DRY_RUN`, and contains no binary, launcher, slot, or Jaiship-root handling.
- **Daemon state is readable and stoppable.** The delivered daemon exposes an instance record with a heartbeat staleness window and a stop path, and the composition already receives the daemon entry path for re-entry and for the installed service unit. Replacing a *running* executable is safe on POSIX; a supervised daemon that keeps the previous build is the real hazard.

### 2.2 Pain Points / Gaps

- **The installed entry point is not a product artifact.** It requires the runtime, a source file, and a workspace build at an absolute path inside a disposable directory; the ticket's premise ("the tool is a product artifact, not a checkout") is unsatisfied.
- **The installed command cannot identify itself.** Every installed invocation reports `0.0.0 (build dev)`, so an operator cannot tell an upgrade from a no-op, and no evidence artifact produced by an installed run can be attributed to a build.
- **The defect class is structural, not incidental.** Installing from a lane worktree is a normal action in this repository's topology, and the failure surfaces only after the merge that removes the worktree — the worst time to discover it.
- **There is no lifecycle at all.** There is no atomic replace, no rollback, no uninstall, no purge, no dry-run, and no ownership rule between the shell installers and the product, so a failed install, an unattempted removal, and a silent overwrite are all possible.
- **The product cannot answer the one compatibility question an operator has.** Nothing reports whether the artifact in hand can read the delivery state on this machine before the first delivery command fails.
- **Development builds can enter the delivery path.** A workspace run has no stable identity, can be edited mid-run, and cannot be recorded truthfully, yet nothing prevents it from installing itself.
- **Two lifecycle implementations would be a permanent cost.** A shell installer would duplicate the stability rule, the replace algorithm, the removal matrix, and a second failure vocabulary for the same product, and the later agent-prompt rewrite would have no command to call.
- **The delivered installer can silently downgrade an installed product.** Nothing stops the launcher step from overwriting a managed artifact with a checkout pointer, which is the live defect in its most direct form.
- **The documentation states the opposite of the intended truth.** "No uninstall path exists" becomes false the moment a lifecycle arrives, and the install model document still describes a shell installer with flag forms.

## 3. PROBLEM STATEMENT

Because the installed entry point is a shell launcher that records an absolute path into whichever checkout installed it and runs the source through a host runtime, an operator cannot install the product as a versioned artifact, cannot tell which build is installed, cannot go back one step, cannot remove the command cleanly, and can be left with a command that stops working when a worktree is deleted — while every safety rule the story requires (a stable target, a dev-build exclusion, atomic replace, an atomic record, an undo, a removable footprint, a compatibility statement) has no surface to live on, so each one either stays unimplemented or is implemented twice with two different failure vocabularies.

**Who is affected.** The operator cannot trust the installed command or remove it. The agent team cannot deliver through an installed binary or install a fix without a shell. The milestone's later stories (namespace migration, prompt rewrite, wrapper rewrite) each need a lifecycle surface to call. Support cannot reconstruct which build is running from a report.

## 4. GOALS

- **G-1** Make the product a self-contained artifact: one compiled executable that runs with no runtime on `PATH`, no source tree, and no workspace dependencies (ticket task: self-contained build; ticket AC: clean-profile install works).
- **G-2** Give the artifact a truthful build identity that is captured at build time and never inferred at run time, while preserving the delivered one-line `--version` shape (ticket AC: the binary reports version+commit).
- **G-3** Make the process edge correct for the compiled shape, so argument parsing, detached daemon re-entry, and the installed service unit name the real executable, and the install path stays the resolver's authority (ticket AC: delivery runs while the repository is dirty or mid-change).
- **G-4** Deliver the install lifecycle as one composed command family reachable through the installed artifact — install/upgrade, status, rollback, uninstall, purge — with typed refusals and the delivered exit projection (ticket task: `install` with atomic replace, add-to-path, migrate hook, `uninstall`/`purge` with a dry-run report).
- **G-5** Refuse a target that lives in a linked git worktree, with one typed error naming the paths and the remedy, and admit every stable origin (ticket AC: an install whose target is a worktree is refused with a typed error).
- **G-6** Keep development builds out of the delivery path: an install requires an artifact carrying an injected identity, never builds, and never downloads (ticket task: dev builds kept out of the delivery path).
- **G-7** Make upgrade explicit, offline, reversible, and version-reported: upgrade is an install of a different artifact, one rollback slot holds only a compiled artifact, and rollback is involutive (ticket AC: upgrade is explicit, reversible, and version-reported).
- **G-8** Make removal safe and honest: `uninstall` removes the entry point, the slot, the record, and only the PATH block the product owns, and always prints exactly what `purge` would delete; `purge` requires explicit confirmation (ticket AC: uninstall removes the entry point and reports exactly what purge would delete).
- **G-9** State a real compatibility verdict between the running artifact and the state format on disk, from identifiers both sides already declare, without a second state contract (ticket task/backlog: compatibility check between installed binary and repository state version).
- **G-10** Preserve every delivered contract that this change touches: the alias's observable behaviour, the read-free self-description, the shell installers' scopes, the state layer's hard gate, and the prompt-required family parity.
- **G-11** Pay the conformance cost in one change and declare it: twenty-six families, the help entries, the reference page, the coverage inventory, the page-root branch, the error domain and its documented rows, and the identity-literal inventory.
- **G-12** Document the operator cadence (install a release → deliver iterations → decide → re-install) and correct the documents that this change makes untrue (ticket task: documented cadence).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Self-containment of the artifact | `--version`, `--help`, and one composed command succeed from an empty directory with a scrubbed `PATH` and no checkout: 3/3 |
| Identity truth across the four token situations | clean short commit / `<commit>-dirty` / `unknown` / `dev`: 4/4 exact |
| Read-free self-description | 0 state, git, configuration, and network reads and 0 writes on `--version`, `--help`, `--print-install-path`, including with a recording `git` stub |
| `--version` shape regressions | 0 (one line, no added field, no machine mode; alias bytes identical for the same identity) |
| Prompt-required families | Exactly 26, identical in content and order in both bins, with every pinned count moved |
| Lifecycle operations reachable through the composed program | 5/5 (`install`, `install status`, `install rollback`, `install uninstall`, `install purge`) |
| Lifecycle refusals carrying a registered identity and a projected exit | 100% (0 bare exit codes) |
| Writes performed by a refused installation | 0 (destination bytes and mtime unchanged; no record; no PATH change) |
| Writes performed by a refused alias invocation | 0, and 0 paths created under a pre-freeze namespace |
| Crash points that leave a runnable artifact at a known path | 7/7 replace steps plus the two-rename window |
| Bytes rewritten by re-installing the identical artifact | 0 (destination, slot, record, and daemon untouched) |
| Rollback depth | 1 step, involutive: two rollbacks return to the artifact installed before the first |
| `uninstall` residual set vs `purge` | Exactly equal: the printed set equals `purge --dry-run`'s removal set at the same moment and what `purge --yes` removes |
| Dry-runs that write anything | 0 of 4 (filesystem snapshot unchanged) |
| Compatibility advisory impact on an install | Exit code unchanged; exactly one advisory line per not-accepted root |
| Payloads decoded by the compatibility check | 0 (header files only, one project level, capped enumeration) |
| Network calls and build spawns performed by the lifecycle | 0 |
| `pnpm check` (including the help-coverage and exports-parity gates) | Green |
| CI `error-table-sync` gate | Green, with the new domain's rows documented and the two-segment allowlist moved by exactly the declared count |

### 4.2 Non-Goals

- **NG-1**: No namespace migration. No artifact, record, configuration, state, or environment name is moved, renamed, or retired; the migration *implementation* belongs to M4-S2, and this change only accepts the `--migrate` hook and refuses it typedly.
- **NG-2**: No release channel, package manager, download-based upgrade, checksum manifest, signature verification, or publishing pipeline (M4-S2 owns release automation within the release model).
- **NG-3**: No auto-update, no background version check, and no network access of any kind in the lifecycle.
- **NG-4**: No minification, no tree-shaking, and no second build path; the declared artifact size is accepted as measured.
- **NG-5**: No cross-compilation and no per-platform artifact matrix; the artifact targets the host it is built on.
- **NG-6**: No multi-user or system-wide installation, no `sudo`, no shared prefix, and no writes outside the operator's home.
- **NG-7**: No daemon-pinning policy. Whether a daemon must always run the installed artifact is M4-S3's decision; this change only keeps the re-entry path correct and refuses to replace the artifact under a live daemon without an explicit flag.
- **NG-8**: No agent-prompt rewrite (M4-S7) and no shell entry-point rewrite (M4-S8). No prompt, agent, or command definition is edited by this change.
- **NG-9**: No GitHub repository rename, no package-scope change, and no public-documentation rebranding.
- **NG-10**: No removal, retirement, or renaming of the `delivery-os` compatibility alias, its bin mapping, its brand paths, or its delivered projections.
- **NG-11**: No new state contract: no aggregate repository-state version, no manifest file, no state record kind, no configuration key, no environment variable, and no write into any state root.
- **NG-12**: No second error vocabulary: no lifecycle refusal may be a bare process exit code, and no shell installer gains lifecycle semantics.
- **NG-13**: No configurable install destination. No flag, argument, or environment override redirects the install path in this increment.
- **NG-14**: No storage of secrets, provider credentials, or tokens in the install record or in any lifecycle output.
- **NG-15**: No change to the delivered version-line *shape*, to the `--print-install-path` contract, or to the alias's byte output for a given identity.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | One self-contained, host-built product artifact produced by an additive build entry, with declared size/target/reproducibility limits | The product must survive the deletion of every checkout and worktree; only a self-contained executable does |
| F-2 | A build-time-injected build identity and the preserved one-line `--version` contract that carries it | The AC requires version **and** commit; the delivered shape forbids a second field; the identity must not be read at run time |
| F-3 | Process-edge correctness for the compiled shape: argument handling unchanged in effect, a real executable path for detached re-entry and service units, and the install path as the resolver's authority | A compiled artifact whose re-entry path names a virtual bundle path cannot restart a daemon or install a unit |
| F-4 | The composed `install` command family with its five entry points and its declared flags, composed for both identities and refused on the non-owning one | The installed artifact is the only reachable surface, and the alias must not be able to create a pre-freeze namespace |
| F-5 | The install-target stability rule: one named admission predicate with a linked-worktree refusal, stable-origin admission, unreadable-git tolerance, and destination dispositions | The defect class must become impossible by admission, not rarer by warning |
| F-6 | The dev-build exclusion: an install requires an injected identity, never builds, and never downloads | A development run is disposable in content exactly as a worktree is disposable on disk |
| F-7 | The installed-binary ↔ state-format compatibility check: one delivered identifier per side, header-only, bounded, advisory on the write paths, a typed verdict on the report path | M4-S1 names the check; the only honest comparison available uses values both sides already declare |
| F-8 | One install record (`install.record.v1`) written atomically, never secret-bearing, and readable by every consumer that needs it | Four consumers read it (status, rollback, uninstall residual, the next install); a field interpreted differently by two of them is the failure mode |
| F-9 | The seven-step atomic replace, the single compiled-artifact rollback slot, and the explicit/offline/reportable upgrade model | A failed install must never break a working one, and an operator must be able to go back exactly one step |
| F-10 | The `uninstall` / `purge` removal matrix with the always-printed purge residual set and the confirmation requirement | The only genuinely dangerous operations in the story must be bounded, reported, and confirmed |
| F-11 | A zero-write dry-run on every write path, with a declared plan content per command | An operator must be able to see the exact effect before any destructive action |
| F-12 | The managed PATH block: opt-in, delimited, idempotent, recorded, and removable | PATH guidance is the only place the product may touch an operator-owned file, so it must be delimited and owned |
| F-13 | The migration hook: detection and advisory without the flag, one typed delegation refusal with it, and no movement ever | The ticket asks for the hook, not the migration; a pretending flag would be a lie and an omitted flag would force a breaking surface change later |
| F-14 | The ownership split with the delivered shell installers: the guarded launcher step and the reporting shell uninstaller | Two writers of one install path is the live defect; one owner per artifact class is the fix |
| F-15 | The declared conformance surface: twenty-six families, help entries, the reference page, the coverage inventory, the error domain with documented rows, and the identity-literal inventory | The aggregate quality gate enforces all of it; declaring the cost in advance stops it being discovered as breakage |
| F-16 | The documented operator cadence and lifecycle story, with the documents this change falsifies corrected | An undocumented lifecycle is a lifecycle operators are afraid to use |

### 5.1 Capability Details

- **F-1 — One self-contained artifact.** The product artifact is a single executable compiled from the primary bin by the pinned toolchain, produced by one additive build entry registered at the workspace root as `build:binary` and emitted as `dist/<binary-name>` at the repository root (already ignored by version control), so it is a product output rather than a package build output. The build entry is repo-internal: it is not a delivered installer script and not a member of the delivered script or tool install arrays. The existing package build is unchanged and continues to serve library consumers; a developer who runs only the package build still has no artifact, and the installation guide says which entry produces what. The toolchain is the pinned runtime — no second compiler, bundler, or packaging engine. The artifact is not minified and not tree-shaken per command; it compiles the whole command surface. The build requires no clean tree and mutates no tracked file: it captures its facts, invokes the compiler once, and fails loudly when the output is missing or not executable. Three limits are declared rather than hidden, each with a revisit trigger: the measured artifact is on the order of 107 MB unminified; it targets the host operating system and architecture only; and the injected build instant makes byte-identical rebuilds impossible, so no result in this change claims reproducibility. Only the primary identity ships an artifact: no compatibility-named executable is produced, because a legacy-named artifact would be a legacy namespace in binary form.

- **F-2 — Build identity and the `--version` contract.** The identity is captured at build time and injected as one compile-time constant object behind a presence guard: the lockstep version from the root manifest (the one version line), the full commit, the build instant as an ISO-8601 UTC timestamp, a dirty flag computed over tracked files only, and a reserved channel field whose only value this increment defines is `dev`. A run without an injected identity falls back to exactly the delivered defaults, so every workspace run, test, and embedder case keeps its current observable behaviour. The version line remains `<binary-name> <version> (build <build>)` on one line at exit `0`, and the existing build slot becomes the identity token (Appendix A). The commit requirement is met inside the existing slot: no field is appended, no second line is printed, no `--version --json` mode exists, and the alias produces byte-identical output for the same injected identity. The build instant is deliberately absent from the line — it changes on every build and is not an operator-facing identity — and appears only on the machine surface (`install status --json`, Appendix D). No runtime path derives any identity field from the manifest, git, file timestamps, or the environment; the identity module imports nothing ambient, and the build entry is its only producer. The artifact name is derived from the declared primary identity at exactly one declared build-side site, which is registered in the identity-literal inventory; no new identity literal enters a handler, a composer, or a library module.

- **F-3 — Process edge for the compiled shape.** Argument parsing is unchanged in effect: a compiled artifact presents the runtime name and a virtual bundle path as its first two arguments, so the delivered argument slice still yields exactly the user arguments, and every family, subcommand, positional, and global flag behaves as delivered. The detached re-entry entry path is corrected at the process edge: the bin supplies the artifact's own executable path when it is running as a compiled artifact and the delivered script path otherwise, so no spawn, service unit, or supervisor ever receives a path inside the bundle's virtual root. This is the one behavioural change the artifact forces, and it applies to the delivered daemon composition unchanged. The install path remains the resolver's authority: `--print-install-path` is unchanged, read-free, and answers the effective identity, and the installer's existing probe of that self-description keeps working against the compiled artifact. Pinning a daemon to the installed artifact is explicitly out of scope; the delivered rule (the running entry path) is preserved.

- **F-4 — The composed `install` family.** `install` joins the prompt-required set as the twenty-sixth family and is registered unconditionally in the production composer with its runtime (home directory, process facts, file-system port, clock, daemon status read, git worktree read). Two failure classes stay distinct exactly as the delivered entrypoint defines them: a **missing runtime** is a composition gap contained as `fallback.internal` at exit `2` and can never be answered by dropping the family or shipping a partial surface; a **data** condition (no git metadata, an absent record, no daemon instance, a damaged record) is answered by the handler as a typed outcome or refusal. Root help lists the family, and each of the five entry points resolves its own help from the static inventory with usage, options, examples, exit codes, and a see-also pointer. The five entry points and their flags are declared in §8.1; `rollback`, `uninstall`, and `purge` are subcommands rather than flags, because a mode flag on a default-destructive verb is one typo from an unintended removal, and because each destructive form needs its own help, its own exit codes, and its own dry-run. Identity rule: the family is composed for **both** bins, because family parity is exact; the bin declares one additional process-edge role fact — whether this identity owns installation — and the composer defaults to **not owning** when the fact is absent. The primary identity declares the owning role; the compatibility alias declares none. A lifecycle invocation on a non-owning identity answers one typed refusal naming the owning binary (derived from the brand's binary name, no identity literal), writes nothing, and the help entry states the restriction so the family is advertised *with* its limit rather than silently rejected. A destination is not an input: an attempt to supply one is refused as a grammar error through the delivered invocation identity rather than silently ignored.

- **F-5 — Install-target stability rule.** The **install target** is the running artifact the install copies into place together with the git checkout that artifact resolves to; it is the only operator-influenceable input to an install. The **destination** is the brand install path returned by the read-free self-description, derived and never supplied. The **recorded provenance** is what the record keeps about the target: checkout path, commit, dirty flag, and verification state. The **executed path** is any path the product persists for later execution: the installed artifact, a legacy launcher's recorded target, and a service unit's command. One admission predicate governs all of them, with four named rules (Appendix C.1): a linked worktree is refused with one typed identity; an unreadable git state (git absent, not a repository, command failure) is **admitted** and recorded `unverified`; a stable checkout is admitted and recorded `verified`; and the destination rule cannot fail by operator action because the destination is not an input. Detection is repository metadata, never a string comparison: no path-prefix test, no reliance on worktree-listing order, and no assumption that the primary checkout sorts first. The target directory is the artifact's own directory, so an artifact anywhere inside a checkout is detected through the repository's own resolution. The refusal names the target directory, the worktree's git directory, and the common git directory, and states the two admissible origins plus the reason a lane worktree is refused. Nothing is written before the refusal: the check runs before staging, before the record, and before any PATH modification, and the destination's bytes and modification time are unchanged. The dirty flag of the target's checkout is never an admission question — the rule is about *where* the target lives, never about its working-tree state. Destination dispositions are declared (Appendix C.2): a compiled artifact with a valid record becomes the rollback slot; a delivered bash launcher is discarded with a report and never promoted, including the case where its recorded target vanished or pointed into a worktree; a symlink is replaced and its target is never written through; an absent destination is created. The slot may only ever hold a compiled artifact carrying an injected identity, so the defect cannot survive a rollback.

- **F-6 — Dev-build exclusion.** An install requires a running artifact that carries an injected build identity. A development run — the delivered fallback identity — is refused with one typed identity naming the build entry and the artifact path convention, because a workspace run has no stable identity, may be edited mid-run, and cannot be recorded truthfully. The install never invokes a build tool, a package manager, or a network client, and that is enforced both structurally on the composition and by the absence of the capability. This is the identity half of the same stability rule, not a second policy: a lane worktree is disposable on disk and a development run is disposable in content, and both make the installed product non-reproducible.

- **F-7 — Installed-binary ↔ state-format compatibility check.** The check compares exactly two already-delivered values: the artifact's accepted store-format identifier (the delivered constant, no new constant) and each enumerated state root's ledger header's declared format identifier. The comparison is equality, not ordering — the identifier is opaque, and the check never infers that a different value is newer, older, or compatible. Each root is judged independently, so a machine with one compatible and one incompatible project reports both. Enumeration covers the effective host root (the override when set, otherwise the brand default) and each first-level project directory under it; nothing below a project directory is visited, no manifest is discovered, and the repository is never walked. A declared cap bounds the enumeration, and exceeding it marks the verdict truncated and reports how many roots were judged, so a pathological machine degrades visibly rather than slowly. An absent root is `unchecked`, never `accepted`. The check runs as a read-only pre-flight on `install` and `install rollback` (one advisory line per not-accepted root, never an exit-code change, never a block, because the remedy for a mismatch is a different artifact and the install surface must remain able to install it) and as the verdict behind `install status` (a typed refusal at exit `1` naming the root, the observed identifier, the accepted identifier, and the judged-root count). `--version`, `--help`, `--print-install-path`, and every other command gain nothing: no delivered command acquires a state read. Nothing is persisted by the check — no header write, no marker, no manifest — and the only persistence it contributes is one record field stating the identifier the installed artifact accepts. The delivered `state.schema.mismatch` gate keeps its identity, its projection, and its remedy; the new check never pre-empts, shadows, or re-words it. Per-domain versions are deliberately not compared; their enforcement stays at their own read and write boundaries, and widening that is a revisit trigger.

- **F-8 — The install record.** One record lives at `<config root>/install.json` — beside the operator's configuration and never inside a state root — under its own schema identifier `install.record.v1`. It is written once per successful install, atomically (staged and renamed), never partially, and never containing a credential; every field is required except the three that are legitimately absent (the source checkout for a build with no git metadata, the previous slot when it is empty, and the PATH block when none was appended). The fields and their meanings are declared in §8.3 (DM-2). The record repeats the artifact's identity fields at install time, so "installed versus running" is a comparison of two records rather than a computation. Every consumer tolerates a damaged or absent record without throwing: `install uninstall` still removes the artifact paths and reports the PATH block as unknown rather than guessed; `install` overwrites a damaged record after a successful replace; `install rollback` refuses with a typed identity when the record is present but unreadable, because a rollback that rewrote the slot history without it would be a claim the operator cannot check. `install status` reports the record condition as data (`current`, `record-stale`, `unreadable`, `absent`) rather than as a failure, so a crash between the two destination renames and the record write is visible instead of pretending.

- **F-9 — Atomic replace, rollback, and upgrade.** The replace is seven normative steps (Appendix B) with one invariant: at every instant at least one runnable artifact exists at a known path. Only the step that renames the destination into the slot has a window in which the destination is absent, and in that window the slot holds a runnable artifact, so the state is recoverable by re-running install. Staging happens in the destination directory on the same file system, so no cross-device move is possible; the destination is never written in place; and a staged file is never left at the destination. **Upgrade is running a different compiled artifact's `install`**: the operator builds (or receives) an artifact and runs *it*, the artifact installs itself, and the identity on disk is exactly the identity that was executed. Nothing downloads, nothing builds, nothing mutates in place. Both identities are reported — the previous one from the record and slot, the new one from the running artifact — and both `install status` and `--version` answer the same question afterwards. Re-installing the identical artifact is a no-op by identity comparison, not by timestamp: nothing is rewritten, the slot is not swapped, and the daemon is not disturbed. **Rollback** swaps the slot and the destination with two renames in the reverse order, updates the record, and reports both identities; it is involutive, because the displaced artifact becomes the new slot, so rolling back twice returns to the artifact that was installed before the first rollback. Rollback refuses typedly when the slot is absent, holds anything without an injected identity, or is unreadable. **Daemon interaction:** when a live instance is detected through the delivered instance and heartbeat read, every artifact-replacing or artifact-removing operation refuses with a typed identity naming the holder and the remedy unless `--stop-daemon` is given, in which case the daemon is stopped through the delivered stop path **before** the swap. Stopping after the swap would leave the new artifact in place while the old build kept running — the exact two-builds-in-one-delivery-path failure. Replacing a running executable with no daemon in play is safe and requires no stopping.

- **F-10 — Uninstall and purge.** The removal matrix is declared in Appendix C.3: `uninstall` removes the artifact, the slot, the record, and only the managed PATH block; configuration and state roots survive byte-identically. `uninstall` **always** prints the residual set — the absolute paths that exist at that moment under the configuration and state roots — as what `purge` would additionally delete, whether or not a dry-run was requested. `purge` additionally removes the configuration root and the state root, and requires an explicit confirmation input (`--yes`); without it, a typed refusal names both roots and the flag and nothing is removed. Confirmation is required even when the roots are absent: the answer is then "nothing to remove", reported at exit `0`, not a silent success and not an error. Removal order is artifact, slot, record, PATH block, then the roots — so a partial failure leaves the recoverable members in place. Tolerating an already-absent member is part of the contract: a second `uninstall` removes nothing, reports every member as absent, prints the same residual set, and exits `0`.

- **F-11 — Dry-run contract.** `install`, `install rollback`, `install uninstall`, and `install purge` each accept `--dry-run`, print the complete plan with absolute paths, one line per path, and perform no write, no directory creation, and no daemon action. The plan content per command is declared in Appendix C.4. A dry-run never claims that an artifact or a block exists; it states what it would do. Every refusal that applies to the real run also applies to its dry-run, because the admission and identity gates are reads, but a dry-run performs no staging and no swap.

- **F-12 — Managed PATH block.** `--add-to-path` appends exactly one delimited block to one profile file: a start marker and an end marker derived from the declared binary name, and between them exactly the one export line that puts the install directory first. File selection: `--shell-profile <path>` when given; otherwise derived from the basename of the operator's configured shell — `zsh` selects `~/.zshrc`, `bash` selects `~/.bashrc`, `sh` selects `~/.profile` — with the leading home marker expanded against the invoking home; an unidentifiable shell with no explicit path is a typed refusal naming both the unresolved shell and the flag. An identical block is not re-appended; a block with different content is replaced in place and never duplicated. The block's file and marker are recorded in the install record so a later install or removal finds it even if the operator edited the profile. `install uninstall` and `install purge` remove exactly that block and nothing else from the profile. Without the flag, the product writes no profile file.

- **F-13 — Migration hook.** Without `--migrate`, `install` **detects** prior-namespace artifacts and prints one advisory line naming them and the operator's documented manual move; it never moves, copies, or deletes them. With `--migrate`, `install` accepts the hook and answers one typed refusal stating that migration is not available in this build and naming the M4-S2 story as its owner, with a remedy pointing at the documented manual move; no migration port is composed, so the flag cannot silently no-op. A dry-run with `--migrate` prints the same detection list and states that nothing would be migrated. No other lifecycle entry point accepts `--migrate`.

- **F-14 — Ownership split with the shell installers.** One owner per artifact class. The binary, its slot, its record, and its managed PATH block belong to the lifecycle family. Repository artifacts (delivered docs, agent and command definitions, the plugin projection, and the legacy launcher **when no managed binary exists**) belong to the shell installers. `scripts/install.sh` keeps its delivered launcher step unchanged when no managed binary exists — same target, same idempotence, same two classified failures, same plan-only dry-run preview, same independence from the tool selection — and **refuses, classified, naming the lifecycle command as the update path, writing nothing**, when a managed binary is present at the install path. `scripts/uninstall.sh` keeps its repository-artifact scope, its own exit taxonomy, and its dry-run behaviour, never deletes the binary, the slot, the record, or any Jaiship root, and where a managed install is detected it reports it and names the owning removal command. Neither surface deletes the other's artifacts, and each names the other when the operator is looking in the wrong place.

- **F-15 — Declared conformance surface.** The change moves, in one change: the prompt-required membership (25 → 26 families) and every pinned family count and family-tail position across the structural and behavioural suites; the root, family, and subcommand help entries; the per-command reference page under the M4 milestone command directory, created for this change and containing both `--help` and `--version`; the help-coverage page-root branch that places the page in that directory (the default root is the M1 snapshot root and must not serve a new family, and the M2 branch is the delivered precedent); the help-guide coverage inventory and its reference-page rows; one new error-table domain kind `install` with its declared rows, documented on the result-contract page, with the closed two-segment allowlist moved by exactly the number of new kind-first two-segment identities; and one new declared build-side identity-literal site with the product-surface literal count unchanged. Legacy-namespace detection and the advisory copy live in code and in the change record, not as new identity literals.

- **F-16 — Documented cadence and lifecycle story.** The operator guidance states the cadence this story exists to make possible — install a release, deliver iterations through the installed binary, decide, re-install — plus which surface owns which artifact class, the admissible installation origins (the primary checkout, a plain directory holding a released artifact, a host without git recorded as unverified), the dev-build requirement, upgrade as an install of a different artifact, rollback's single step, the uninstall/purge split with its residual report, the opt-in PATH block, the compatibility asymmetry and its rationale (an install must be able to install the fix; a report must be able to say no), and the fact that installing from a lane worktree is refused deliberately. The same change corrects the two delivered documents this capability falsifies: the install-set documentation's statement that no uninstall path exists, and the install model document, which loses on **surface** (no shell lifecycle script, no destructive flags) while keeping its **mechanics** (layout, atomic replace, one slot, record fields, PATH block, daemon refusal, the out-of-scope list).

## 6. USER & SYSTEM FLOWS

```
Flow 1: Build and install a release (the documented cadence, first half)
  Operator, in the primary checkout, runs the additive build entry.
  → the build captures version, commit, build instant, and dirty flag, compiles
    the primary bin into one executable at the artifact directory, and reports
    the identity it injected. The tree is not mutated; a dirty tree is fine.
  Operator runs that artifact: `<artifact> install`.
  → admission: the artifact's directory resolves to the primary checkout (equal
    git dirs) → verified. The compatibility pre-flight reads headers and prints
    one advisory per not-accepted root at most, exit unaffected.
  → destination: a delivered bash launcher is found → discarded with a report
    naming its recorded target; it is not promoted to the slot.
  → seven-step replace: stage → verify → identity comparison → destination into
    the slot → staged into the destination → record written.
  → output names the running identity, the previous identity (if any), the
    destination, the disposition, the slot, the record path, and the PATH
    guidance (a block is appended only with `--add-to-path`).
  → `jaiship --version` from any directory now prints `jaiship <version>
    (build <shortsha>)`, and `jaiship install status` names the same build.

Flow 2: Delivery while the repository is dirty or mid-change
  The delivery team edits the checkout; nothing is committed.
  → the installed artifact is a copy of bytes; it reads no source file, so
    delivery runs unchanged while the checkout is dirty.
  → re-running install from a dirty-tree build is admitted and reports
    `<commit>-dirty`; the artifact reports the same token.

Flow 3: Install attempted from a lane worktree
  Operator runs `<worktree>/dist/jaiship install`.
  → the artifact's directory resolves to a linked worktree (its git directory
    differs from the common git directory) → refused: one registered identity,
    exit 1, naming the target directory and both git directories, stating the
    two admissible origins and that a lane worktree is deleted after merge.
  → nothing is written: the destination's bytes and mtime are unchanged, no
    record exists, no PATH line is touched.

Flow 4: Install attempted from a development run
  Operator runs the workspace entry (or a test-shaped invocation) with `install`.
  → the running artifact carries no injected identity → refused: one registered
    identity, exit 1, naming the build entry and the artifact path convention.

Flow 5: Upgrade, rollback, and the report
  Operator builds a newer artifact and runs `<new artifact> install`.
  → the previous artifact moves into the slot, the new one lands, the record is
    rewritten; output names both identities.
  → `jaiship --version` and `jaiship install status --json` both report the new
    build; the slot's identity is reported beside it.
  Operator runs `jaiship install rollback`.
  → two renames in reverse order; output names both identities; the displaced
    artifact becomes the new slot, so a second rollback returns to where they
    started.
  Operator runs `jaiship install`.
  → identical identity and matching record → reported as unchanged; zero bytes
    rewritten; slot and daemon untouched.

Flow 6: A live daemon holds the artifact
  `jaiship daemon start` is running. Operator runs `jaiship install`.
  → the delivered instance/heartbeat read reports a live holder → refused with
    one registered identity naming the holder and the remedy, exit 1.
  Operator re-runs with `--stop-daemon`.
  → the daemon is stopped through the delivered stop path BEFORE the swap, then
    the install proceeds, so no delivery path ever sees two builds.

Flow 7: Removal
  Operator runs `jaiship install uninstall --dry-run`.
  → two separated blocks: what would be removed, and the residual set that would
    be reported. Nothing is written.
  Operator runs `jaiship install uninstall`.
  → artifact, slot, record, and the managed PATH block are removed; the
    configuration and state roots are byte-identical; the residual set is printed
    as "purge would additionally delete:".
  Operator runs `jaiship install purge` → refused (confirmation absent), naming
    the two roots and the flag, nothing removed.
  Operator runs `jaiship install purge --yes` → the residual set enumerated, then
    removed, each absolute path reported.
  With no store and no configuration, `purge --yes` reports "nothing to remove"
    and exits successfully.

Flow 8: Compatibility mismatch
  The artifact accepts format v1; one project's state root was written by a
  different format.
  → `install` prints one advisory naming the root, the observed identifier, the
    accepted identifier, and the remedy, and completes with an unchanged exit
    code (the fix may be this artifact).
  → `install status` reports the per-root verdict and exits 1 with the typed
    incompatibility identity naming the root, observed, accepted, and the judged
    count; `install status --json` carries the same facts.
  → the first command that opens that store still answers the delivered hard-gate
    identity at exit 2, unchanged.

Flow 9: The alias is used for a lifecycle operation
  Operator runs `delivery-os install`.
  → the alias declares no owning role → one typed refusal naming `jaiship`,
    exit 1, nothing written; no path under the alias's namespace is created.
  → `delivery-os --version`, `--help`, `--print-install-path`, and every other
    command are unchanged.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The additive workspace-root artifact build entry, its identity capture, the artifact location and name, the compiled-artifact output, and the declared size/target/reproducibility limits.
- The confined identity module with its documented fallback, the compile-time injection seam, and the build-side identity-literal site registration.
- The version render's build slot meaning, the four-situation token contract, and the machine surface that carries the full identity.
- The process-edge correction for the compiled shape: the bin's re-entry entry path, unchanged argument handling, and the preserved install-path authority.
- The `install` family: five entry points, five flags, unconditional composition on both identities with the owning-role fact and the non-owning refusal, the destination-not-an-input rule, and the help entries with the alias restriction stated.
- The install-target stability rule with its four admission rules, the two refusal identities, the recorded provenance states, and the destination disposition table including the legacy-launcher discard and the slot-content rule.
- The dev-build exclusion and the no-build/no-download construction rule.
- The compatibility check: the two compared values, the enumeration and its cap, the five outcome states (`accepted`, `not-accepted`, `unreadable`, `unchecked`, `truncated`), the advisory on the write paths, the verdict on the report path, the record field, and the preserved hard gate.
- The install record: location, schema identifier, full field set, atomic write, tolerance on read, and the no-secret rule.
- The seven-step atomic replace with its failure consequences, the single slot, the identity-comparison no-op, the upgrade model and its both-ways reporting, the involutive rollback, and the daemon guard with its before-swap stop.
- The removal matrix, the always-printed residual set, the confirmation requirement, the absent-member tolerance, and the removal order.
- The zero-write dry-run on all four write paths with a declared plan content each.
- The managed PATH block: selection, delimiters, idempotent replacement, recording, and removal.
- The migration hook: detection, advisory, the typed delegation refusal, and the dry-run statement.
- The ownership split: the installer's guard, the uninstaller's scope and report, and each surface naming the other.
- The declared conformance surface: family membership and counts, help entries, the new reference page under the M4 command directory, the page-root branch, the coverage inventory, the error domain and rows with their documented table, the two-segment allowlist movement, and the literal inventory.
- The documentation set: the local install guide, the CLI entrypoint page, the doc-distribution page, the state-layer page, the result-contract page, the install model correction, and the new reference page.

### 7.2 Out of Scope

- [OUT] Implementing the namespace migration: accepting the hook, detecting, and refusing are in scope; moving, copying, backing up, or converting any configuration, state, or artifact is not (M4-S2).
- [OUT] Any release channel, package registry, release asset naming, checksum manifest, signature verification, or publishing pipeline.
- [OUT] Download-based upgrade, auto-update, update notification, or any network access at all in the lifecycle.
- [OUT] Minification, stripping, tree-shaking per command, or a second artifact build path.
- [OUT] Cross-compilation, per-platform artifacts, or an architecture selector.
- [OUT] Multi-user, system-wide, container-image, or writable-home-free installation, and any destination parameter.
- [OUT] Daemon-pinning policy (whether a daemon must always run the installed artifact) and any daemon lifecycle decision beyond the replace guard and the re-entry path (M4-S3).
- [OUT] Rewriting agent prompts or commands to call the lifecycle family (M4-S7) and rewriting the shell entry points as wrappers (M4-S8).
- [OUT] Renaming the GitHub repository, changing package scope, or rebranding public documentation.
- [OUT] Removing, retiring, renaming, or re-pointing the compatibility alias, or registering any installer step for it.
- [OUT] Any new state contract: an aggregate repository-state version, a state manifest, a state record kind, a configuration key, an environment variable, or a write inside a state root.
- [OUT] Comparing per-domain record versions inside the compatibility check.
- [OUT] A second rollback step, a retention policy, or versioned artifact directories.
- [OUT] A hard-link disposition rule at the destination (the atomic replace overwrites the directory entry regardless, so the destination is stable; a hard link cannot be detected portably from the link side).
- [OUT] Removing the managed PATH block without removing the install (no standalone "remove block" verb).
- [OUT] Publishing purge content estimates (file or byte counts) before confirmation.
- [OUT] A `doctor` or preflight surface that absorbs `install status`.
- [OUT] Changing the delivered version-line shape, the `--print-install-path` contract, the read-free isolation contract, the projection module's exit taxonomy, the `state.schema.mismatch` gate, or the delivered install-time behaviour of the shell installer when no managed binary exists.

### 7.3 Deferred / Maybe-Later

- A declared build channel value beyond the reserved `dev` (for example distinguishing a local compile from a release build of the same commit).
- Release-asset naming that embeds the version, platform, and architecture, decided with the release pipeline.
- Minification or a stripped build, if artifact size becomes an operational problem; a second platform target matrix, if a non-host installation is needed.
- Reproducible builds, which would require removing the build instant from the artifact and re-baselining release attestations.
- An explicit, recorded override that permits installing from a lane worktree for per-iteration dogfood installs, with the recorded-provenance claim reopened.
- More than one rollback step, or versioned artifact directories with retention.
- A preflight that reports which identity paths are in effect, which surfaces hold a managed install, and whether prior-namespace artifacts are present (a natural home for the migration advisory after M4-S2).
- Folding the shell installers' remaining artifact classes into the family once the wrappers are rewritten.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. No HTTP surface is added or changed. The affected surface is the executable's command grammar and its self-description. The lifecycle contract:

| Invocation | Outcome | Exit | Writes |
|---|---|---|---|
| `jaiship install` | Install or upgrade from the running compiled artifact: admission, identity gate, daemon guard, compatibility advisory, destination disposition, seven-step replace, record write | `0` on success and on an identity-equal no-op | Destination, slot, record; the PATH block only with `--add-to-path` |
| `jaiship install --dry-run` | The full install plan (Appendix C.4), nothing written | `0` when the plan is producible | None |
| `jaiship install status` | Read-only report of the running identity, the installed record, the record condition, the slot, the target stability, the state-format verdict, and the managed block | `0`; `1` with `install.state.incompatible` when any judged root is not accepted | None |
| `jaiship install status --json` | The same facts under `install.status.v1` (Appendix D) | Same as above | None |
| `jaiship install rollback` | Two renames in reverse order, record update, both identities reported | `0` | Destination, slot, record |
| `jaiship install rollback --dry-run` | Current and slot identities, the two renames in order, the record update | `0` | None |
| `jaiship install uninstall` | Removal matrix minus the roots; residual set always printed | `0` (including a second, no-op run) | Removal only |
| `jaiship install uninstall --dry-run` | Removal list and residual set in two blocks | `0` | None |
| `jaiship install purge` | Refusal: confirmation absent | `1` (`install.purge.unconfirmed`) | None |
| `jaiship install purge --yes` | Removal matrix including both roots, each path reported | `0` (also when the roots are absent: "nothing to remove") | Removal only |
| `jaiship install purge --dry-run` | Removal list including every enumerated project root | `0` (with or without `--yes`) | None |
| `jaiship install <unknown-subcommand>` | Delivered grammar refusal | `1` (`fallback.invocation`) | None |
| `jaiship install --target <path>` (or any destination argument) | Delivered grammar refusal | `1` (`fallback.invocation`) | None |
| `delivery-os install …` | One typed refusal naming the owning binary | `1` (`install.identity.not-owning`) | None |
| `jaiship install --help`, `install status --help`, `install rollback --help`, `install uninstall --help`, `install purge --help` | Static-inventory help with usage, options, examples, exit codes, and see-also; the family entry states the alias restriction | `0` | None |

Flags owned by the family: `--add-to-path` and `--shell-profile <path>` (install); `--migrate` (install only); `--dry-run` (all four write paths); `--stop-daemon` (every artifact-replacing or artifact-removing path); `--yes` (purge). Global flags `--json`, `--verbose`, `--pretty` behave exactly as on every other family.

Refusal identities and their projections are declared in §8.3 (DM-6); the exit digit is produced only by the delivered projection module.

### 8.2 Events / Messages

N/A. No ledger event, taxonomy version, topic, or payload is added or changed. The compatibility advisory and the migration advisory are process lines on the delivered notice channel (stderr, every mode including `--json`, never in a payload, never affecting an exit code). Nothing is appended to any store by this change.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Build identity object | Five fields captured at build time: lockstep version, full commit, build instant (ISO-8601 UTC), dirty flag (tracked files only), channel (`dev` is the only value defined in this increment). Injected as one compile-time constant behind a presence guard, read by the process edge only, with the delivered `0.0.0`/`dev` fallback for a non-injected run. Additive: no new identity literal in a handler, composer, or library module |
| DM-2 | Install record (`install.record.v1`) | One file at `<config root>/install.json`, never inside a state root, written atomically once per successful install, never containing a credential. Fields: `schemaVersion` (the record's own version identifier); `version`, `commit`, `builtAt`, `dirty`, `channel` (the installed artifact's injected identity); `stateSchemaVersion` (the store-format identifier the artifact accepts); `sourceCheckout` (the checkout the artifact's identity was built from — absent when the build had no git metadata, and only ever an admissible path); `provenance` (`verified` or `unverified`); `installedAt`; `previous` (the slot's identity, absent when the slot is empty); `launcherDisposition` (`none`, `launcher-discarded`, `symlink-replaced`, with the reported detail); `pathBlock` (the profile file and block marker, absent when none was appended). `previous` is swapped on **every** install, not only when the identity differs |
| DM-3 | Rollback slot | One file in the install directory beside the destination, holding only a compiled artifact that carries an injected identity. Its identity is reported through the record and the status payload; its content is never a launcher and never an identity-less artifact |
| DM-4 | Install status payload (`install.status.v1`) | Machine report carrying: the running identity (all five DM-1 fields plus the artifact path); the installed record's identity and the record condition (`current`, `record-stale`, `unreadable`, `absent`); the slot identity and slot condition (`present`, `absent`, `invalid`); the target stability finding (`verified`, `unverified`, `linked-worktree`) as data, never as a refusal on this surface; the state-format verdict (accepted identifier, per-root entries with root, observed identifier, outcome, reason, the judged count, and a truncation flag); the managed PATH block, when present. Deterministic field order and content for a given machine state |
| DM-5 | Managed PATH block | One delimited block in one operator profile file: a start marker and end marker derived from the declared binary name, containing exactly the one export line that puts the install directory first. Its file and marker are recorded in DM-2; it is replaced in place when its content differs and removed only by uninstall or purge |
| DM-6 | `install` error domain | One new domain kind and exactly eleven rows, all category `user`, non-retryable, consequence `not_landed`, projection class `user-validation` (exit `1`) unless stated: `install.target.worktree`, `install.dev-build`, `install.state.incompatible`, `install.identity.not-owning`, `install.shell-profile.unresolved`, `install.migration.unavailable`, `install.daemon.running`, `install.record.unreadable`, `install.slot.absent`, `install.slot.invalid`, `install.purge.unconfirmed`. Every code is a three-segment code except `install.dev-build`, which is a kind-first two-segment identity and therefore joins the closed two-segment allowlist (65 → 66 declared identities). Grammar refusals and an unknown subcommand reuse the delivered `fallback.invocation`; an unusable destination argument reuses it too; no `install.*` family or wildcard is introduced |
| DM-7 | Declared identity-literal inventory entry | One new build-side site derives the artifact name from the declared primary identity. It is registered in the inventory with its own scan root, and it does not count as a product-surface literal; the product-surface inventory stays at its delivered five sites and the installer's declared layout reference is unchanged |
| DM-8 | Git worktree-topology read | One additive read on the delivered git adapter surface in the delivered fixed-argv, no-shell shape, returning the checkout's own git directory and its common git directory as absolute paths, or an absence — never an error. It changes a pinned adapter export surface and its parity baseline once; it adds no spawn shape and no network access |

### 8.4 External Integrations

No vendor, API, credential, or network surface is added. Two host tools are consumed and neither is a network dependency: the pinned Bun toolchain at build time only, and `git` at build time (commit, dirty state) and at install time (worktree topology). A host without `git` is a supported, declared state: the install proceeds and records `unverified`. The lifecycle performs no download, invokes no package manager, and spawns no build.

### 8.5 Backward Compatibility

- **The version line is unchanged in shape and meaning-bearing in its existing slot.** `<binary-name> <version> (build <build>)`, one line, exit `0`, read-free. No field is added, no second line is printed, and `--version --json` continues to produce exactly what `--version` produces. A non-injected run keeps `0.0.0` and `dev` verbatim, so every delivered test and workspace run describes reality unchanged.
- **The compatibility alias is behaviourally unchanged, with one declared divergence.** `delivery-os --version`, `--help`, `--print-install-path`, every command's behaviour, its `.delivery-os` configuration path, its `~/.delivery-os-state` host root, and its delivered projections are exactly as delivered. The single divergence is the new family: it is **composed for parity and refused on this identity** with one typed refusal and zero writes, so the alias advertises the family with its restriction and cannot create a pre-freeze namespace. This is declared in the sense of GH-320 §8.5, not absorbed silently.
- **Self-description stays read-free.** No identity field, and no compatibility verdict, is read on `--version`, `--help`, or `--print-install-path`; the delivered isolation suite is unchanged and remains the control.
- **The install path stays the resolver's authority.** `--print-install-path` is unchanged and still answers the effective identity; the installer's existing probe of it keeps working against the compiled artifact.
- **The delivered installer keeps its contract when it is still the owner.** With no managed binary present, the launcher step's target, idempotence, two classified failures, plan-only dry-run preview, and tool independence are exactly as delivered; the new behaviour is one added refusal arm, which writes nothing.
- **The shell uninstaller keeps its contract.** Its two modes, its own `0/2/3/4/5` exit taxonomy, its dry-run, and its repository-artifact scope are unchanged; it gains one reporting arm and never touches a Jaiship root or the binary.
- **The state layer is untouched.** `state.schema.mismatch` keeps its identity, its `platform-provider` projection, and its remedy; the new check reads headers only and persists nothing; no state constant, record kind, or write is added.
- **The error table is additive.** One domain kind and eleven rows are added; no delivered row is renamed, reworded, or re-projected; the projection module remains the only place an exit digit appears. The closed two-segment allowlist widens by exactly one declared identity.
- **The composed set grows by one.** Every pinned family count and every family-tail position moves from twenty-five to twenty-six in the same change, and both bins stay identical in content and order.
- **Retired claims.** Exactly two delivered documentation statements become untrue and are corrected in this change: "no uninstall path exists" (install-set documentation) and the install model's shell-installer surface description (flags for rollback/uninstall/purge, a shell lifecycle script as the entry point). The model keeps its mechanics; the decision records win on surface.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Self-containment | The artifact answers `--version`, `--help`, and one composed command from an empty directory with a scrubbed `PATH`, no `HOME` content, and no checkout: 3/3; 0 runtime, source-file, or workspace-dependency requirements |
| NFR-2 | Read-free self-description | 0 state reads, 0 git reads, 0 configuration reads, 0 writes, 0 network calls, and 0 composer invocations on `--version`, `--help`, and `--print-install-path`, including with a recording `git` stub on `PATH` and a poisoned environment |
| NFR-3 | Crash safety of the replace | A failure injected at each of the seven replace steps leaves a runnable artifact at a known path and never a truncated destination: 7/7; the destination-absent window leaves the slot runnable; a re-run recovers |
| NFR-4 | Idempotence | Installing the identical artifact rewrites 0 bytes: destination mtime unchanged, slot not swapped, record unchanged, daemon undisturbed, and the identity reported |
| NFR-5 | Dry-run purity | After each of the four dry-runs, a filesystem snapshot (paths, sizes, mtimes, modes) is unchanged: 4/4; 0 directory creations; 0 daemon actions; the printed plan names every path the real run would touch |
| NFR-6 | Non-blocking compatibility | Under a not-accepted root, `install` and `install rollback` complete with an unchanged exit code and exactly one advisory line per not-accepted root: 0 additional lines, 0 exit changes |
| NFR-7 | Bounded compatibility enumeration | Header files only; 0 ledger payloads decoded; 0 traversal below a project directory; the judged-root count never exceeds the declared cap, and an exceeded cap is reported as truncated together with the judged count |
| NFR-8 | No network, no build | 0 HTTP clients constructed and 0 build or package-manager spawns across all five entry points, asserted structurally over the composition |
| NFR-9 | Typed refusals | 100% of declared lifecycle refusals assert a registered identity, an envelope, and the projected exit (`1` or `2`); 0 bare exit codes; the projection module remains the only exit-digit site |
| NFR-10 | Zero-write refusals | A refused install (worktree, dev build, daemon holder, unconfirmed purge, non-owning identity) writes 0 files: destination bytes and mtime unchanged, 0 records written, 0 profile lines added, 0 paths created under a pre-freeze namespace |
| NFR-11 | Residual-set equality | The `uninstall` residual set equals `purge --dry-run`'s removal set at the same moment and equals what `purge --yes` removes, path for path: exact |
| NFR-12 | Record integrity | 0 partially written records; 0 records containing a credential or a secret-shaped value; the secret-read boundary check stays green; every read tolerates an absent or damaged record without throwing |
| NFR-13 | Additivity | 0 new configuration keys, 0 new state record kinds, 0 new environment variables, 0 new state-file writes, 0 new event topics; one new record file and one new status payload, both declared |
| NFR-14 | Conformance completeness | `PROMPT_REQUIRED_COMMANDS` is exactly 26; both bins agree in content and order; the reference page exists in the M4 command directory with `--help` and `--version`; the coverage inventory and the page-root mapping agree; the CI error-table-sync gate is green with every new row documented and the two-segment allowlist at exactly 66; the aggregate `pnpm check` is green |
| NFR-15 | Declared limits are measured and stated | The artifact size, the host-only target, and the non-reproducibility of byte-identical rebuilds are each reported by the build or measured in the change record; 0 claims of reproducibility; 0 silent minification |
| NFR-16 | Deterministic reporting | For a given machine state, `install status` (human and machine form) produces the same fields, order, and content across repeated runs; 0 ordering that depends on directory iteration order |
| NFR-17 | Documentation truth | The corrected pages and the guide state the delivered behaviour; 0 remaining delivered statements that no uninstall path exists; the documentation conformance checks stay green |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The installed build is identifiable from one line (`--version`) and from one command (`install status`), and the same identity object is what the install record and the status payload carry — so a support conversation can compare "what is installed", "what is running", and "what is in the slot" without inspecting binaries.
- Every lifecycle operation reports its decisions as operator-facing lines: the admission outcome with its provenance state, the destination disposition, the identity comparison outcome, the slot identity, the record path, the compatibility advisories, and the migration advisories. A refused operation reports the identity, the offending facts, and the remedy.
- `uninstall` prints the residual set unconditionally, which is the observability contract for the destructive boundary: the operator sees the purge surface before deciding, without asking for a dry-run.
- A crash between the two destination renames and the record write is visible as `record-stale` in `install status` rather than as an unexplained mismatch.
- No metrics, spans, ledger events, telemetry records, or store writes are added. The compatibility verdict is computed and reported, never cached, so it stays true when the state changes underneath.
- No lifecycle output contains a credential, a provider value, or file content; the record carries paths and identifiers only.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | A crash between the destination rename and the staged rename leaves no destination | H | L | The ordering is normative: the slot is filled first, so the destination-absent window always has a runnable slot; a re-run of install recovers, and the crash matrix is an acceptance criterion | L |
| RSK-2 | The compiled shape breaks the daemon: a service unit or a detached child names a virtual bundle path | H | M | The re-entry path is corrected at the process edge and asserted in both arms (compiled and non-compiled); no bundle-root path may be handed to a spawn or a unit | L |
| RSK-3 | A legacy launcher is promoted into the rollback slot, so a rollback restores the defect | H | M | The slot accepts only a compiled artifact with an injected identity; the launcher disposition discards and reports; rollback refuses typedly on an invalid slot, with both arms asserted | L |
| RSK-4 | The alias creates a pre-freeze namespace or half-executes a lifecycle operation | H | L | The owning-role fact defaults to *not owning*; the refusal is one typed identity and every write path is gated behind it; a filesystem assertion proves no alias-namespace path is created | L |
| RSK-5 | The delivered installer overwrites a managed binary with a checkout pointer (the live defect) | H | M | The installer's launcher step refuses, classified, naming the lifecycle command and writing nothing, whenever a managed binary is present; the delivered suite stays green and a new case asserts the refusal | L |
| RSK-6 | The conformance surface is discovered as breakage rather than declared work: family counts, tail positions, help coverage, the page, the error rows, the literal inventory | M | M | The surface is enumerated in this specification and bound to one acceptance criterion; every pinned count moves in the same change | L |
| RSK-7 | The compatibility check becomes a second state read path or a second contract | H | L | Header-only, one project level, capped enumeration, no payload decode, no persistence, and the delivered hard gate preserved; the two-segment allowlist and the state const inventory are asserted unchanged | L |
| RSK-8 | A compatibility pre-flight blocks the very install that would fix a mismatch | H | L | The write paths are advisory by contract with an unchanged exit code; only the report path refuses; the asymmetry is documented with its rationale | L |
| RSK-9 | The install record drifts into two interpretations (status, rollback, uninstall, next install) | M | M | One field table with declared meanings; every consumer tolerates absence and damage; `record-stale` is a reported state, not an exception; the atomic write is acceptance-tested | L |
| RSK-10 | A live daemon keeps the previous build after a replace, so one delivery path runs two builds | H | M | Every replacing or removing path refuses without `--stop-daemon`, and the stop happens **before** the swap; both arms are acceptance-tested | L |
| RSK-11 | `purge` removes configuration or delivery history by accident | H | L | An explicit confirmation input is required even when the roots are absent; the refusal names both roots; `uninstall` prints the residual set before the operator considers purge; the removal order leaves recoverable members last | L |
| RSK-12 | The artifact is or becomes operationally unacceptable (size, host-only, non-reproducible) | M | M | Each limit is declared with a revisit trigger and measured rather than asserted; no claim of reproducibility is made anywhere | M |
| RSK-13 | Installing from a lane worktree is refused and that breaks a real workflow | M | M | The refusal is a declared operating rule with a stated remedy (build and install from the primary checkout or a prepared directory); the override route is recorded as a deferred decision | M |
| RSK-14 | The new domain widens the error vocabulary beyond what the ACs need | L | L | Eleven declared rows, each bound to an acceptance criterion, all `user`-validation at exit `1`; no family or wildcard; no delivered row reworded | L |
| RSK-15 | The artifact build makes the aggregate quality gate slow or non-deterministic | M | M | The artifact probe is a gated, offline case rather than a per-run build of the whole suite; the additive build entry does not join the existing build chain, so `pnpm check` keeps its current shape | M |
| RSK-16 | The install model document and the delivered documentation contradict the product after delivery | M | M | The correction is a declared obligation of this change, bound to a documentation acceptance criterion, with the record-wins-on-surface rule stated | L |

## 12. ASSUMPTIONS

- The five decision records (TDR-0036 … TDR-0040) are the binding design for this change; this specification carries their normative details and does not re-litigate them.
- The pinned Bun toolchain compiles the primary bin into a working self-contained executable, and `--define` substitutes a compile-time constant object that a presence guard can detect — both were measured on the pinned version before this specification was written.
- A compiled artifact's argument vector presents the runtime name and a virtual bundle path as its first two entries, so the delivered argument slice remains correct.
- The primary checkout is the normal in-repository installation origin, and installing from a lane worktree is an operating rule the owner accepts losing.
- Every machine that installs has `git` available is **not** assumed; the rule is designed so a host without it is admitted and recorded as unverified.
- A store header is the only file the store writes with the format identifier, and the state-root layout is one host root with one directory per project beneath it.
- The delivered daemon exposes a readable instance with a heartbeat staleness window and a stop path.
- The delivered launcher's rendered content is distinguishable from a compiled artifact at the destination, so the disposition table is decidable.
- The operator's profile file is writable and identifiable when `--add-to-path` is requested; an unidentifiable shell is a typed refusal.
- One rollback step is sufficient for this milestone; a second step would require a retention policy the milestone does not design.
- The install record does not exist today and nothing else reads or writes it, so its schema is additive by construction.
- The ticket's acceptance paragraph contains six semicolon-delimited criteria; this specification traces all six (see §17).
- The ticket's `upgrade` task is satisfied by installing a different compiled artifact; no `upgrade` verb is introduced, because a second verb would be an alias with no distinct semantics.
- The artifact probe in the quality gate can run offline and deterministically on the pinned toolchain, in the delivered pattern for installer integration cases.
- The aggregate quality gate does not currently run the error-table sync check; that gate runs in CI, and a test asserts it stays out of the aggregate script — so this change must not add it there.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Executable entrypoint and the two-bin identity selectors (delivered, GH-320) | The shared launcher composition, the read-free self-description contract, and the exact family-parity assertion the new family joins |
| Depends on | Version render and its optional injected inputs (delivered, GH-242) | The seam the build identity finally uses; the line shape that must not change |
| Depends on | Typed-error contract, register, and projection (delivered) | One new domain kind and eleven rows; the projection module stays the only exit-digit site |
| Depends on | State layer: store-format identifier, ledger header, hard gate (delivered) | The compatibility anchor and the enforcement point this change must not shadow |
| Depends on | Git adapter reads (delivered) | One additive worktree-topology read, plus the surface-parity baseline it moves |
| Depends on | Daemon instance/heartbeat read and stop path (delivered) | The replace guard and the before-swap stop |
| Depends on | Installer launcher step and shell uninstaller scope (delivered, GH-320) | The guard, the reporting arm, and the installed suite cases that must stay green |
| Depends on | Help coverage check, its page-root mapping, and the coverage inventory (delivered) | The page, the branch, and the inventory rows that must move together |
| Depends on | Pinned Bun toolchain and `git` on the build host | The artifact's only build mechanism and its commit/dirty capture |
| Blocks | M4-S2 namespace migration | The migration implementation resolves into the `--migrate` hook and replaces its typed refusal |
| Blocks | M4-S7 prompt rewrite on product primitives | Prompts call this family instead of a shell script |
| Blocks | M4-S8 dogfood window and wrapper rewrite | The evidence window requires a stable installed artifact and the wrappers delegate to it |
| Constrained by | The alias's delivered behaviour | The family is composed for parity and refused on that identity; no other observable may change |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the artifact carry a declared build channel value beyond `dev`? | A release build and a local compile of the same commit are indistinguishable today. The identity object reserves the field; only `dev` is defined in this increment. | Deferred to M4-S2 release automation; the field exists so no schema change is needed later |
| OQ-2 | Should `--add-to-path` gain a standalone removal mode? | The block is removable only through `uninstall`/`purge` today, which couples block removal to artifact removal. | Deferred; Decision needed: consult `@decision-advisor` if an operator needs to keep the binary and drop the block |
| OQ-3 | Is a hard link at the destination a case the stability rule must cover? | A hard link cannot be detected portably from the link side. Today's answer is "not covered, and the atomic replace still makes the destination stable". | Deferred; the disposition table records the answer rather than implying coverage |
| OQ-4 | Should `purge` print content estimates (file or byte counts) of the roots before confirmation? | The AC requires exact paths only; counts would need a bounded walk of both roots. | Deferred; a bounded-walk decision belongs with a later convenience change |
| OQ-5 | Which blueprint page replaces the ticket's missing reference? | The ticket cites a blueprint page that does not exist in the milestone pack; no decision in this change depends on it. | Open for `@pm`/`@doc-syncer` in the documentation phase: correct the ticket or the blueprint file set |
| OQ-6 | Does `install status` ever gain a daemon-held view and a broader preflight role? | The status payload already reads daemon state for the guard; folding it into a preflight is a conformance question, not a contract question. | Deferred to M4-S3 |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Adopt TDR-0036: the install lifecycle is one composed `install` family inside the prompt-required composition; `rollback`, `uninstall`, and `purge` are subcommands; `--add-to-path`, `--shell-profile`, `--migrate`, `--dry-run`, `--stop-daemon` are flags; the shell installer keeps only its guarded launcher step. | The installed artifact is the only reachable surface, and only a composed command can carry the registered typed-error contract the AC requires. Status: TDR-0036 is **Proposed**; the owner accepts or rejects it at this change's pull-request review. | 2026-11-18 |
| DEC-2 | Adopt TDR-0037: one compiled executable from the primary bin, identity injected at build time, the existing build slot carrying the commit token, the full identity only on the machine surface, and the process-edge re-entry correction. | The artifact must survive every checkout; the identity must not be read at run time; the delivered line shape and alias bytes are pinned. TDR-0037 is **Proposed**, accepted at pull-request review. | 2026-11-18 |
| DEC-3 | Adopt TDR-0038: one install-target stability rule with a positive linked-worktree refusal, admitted provenance for stable or unreadable origins, a dirty tree never refused, and the dev-build gate; a legacy launcher is discarded and never promoted. | The defect class must become impossible by admission, and a false refusal would block the clean-profile case the AC requires. TDR-0038 is **Proposed**, accepted at pull-request review. | 2026-11-18 |
| DEC-4 | Adopt TDR-0039: the compatibility check compares the artifact's accepted store-format identifier with each enumerated state root's header only, advisory on the write paths, a typed verdict on `install status`, nothing persisted, and the delivered hard gate untouched. | It is the only comparison both sides already declare; a blocking pre-flight would prevent installing the fix. TDR-0039 is **Proposed**, accepted at pull-request review. | 2026-11-18 |
| DEC-5 | Adopt TDR-0040: the seven-step atomic replace, the single compiled-artifact slot, upgrade as an install of a different artifact, the removal matrix with the always-printed residual set, the confirmation requirement, the four dry-runs, and the ownership split. | A failed install must never break a working one, and an operator must be able to go back exactly one step. TDR-0040 is **Proposed**, accepted at pull-request review. | 2026-11-18 |
| DEC-6 | The ticket's `upgrade` task is realised as `install` of a different compiled artifact. No `upgrade` verb, flag, or alias is added. | A second verb would carry no distinct semantics; the artifact installs itself, so the identity on disk is exactly the identity executed. Recorded because the ticket names `upgrade` as a task. | 2026-11-18 |
| DEC-7 | The alias's composed-but-refusing family is a **declared divergence** under the GH-320 §8.5 convention, with its own registered refusal identity derived from the brand's binary name and no identity literal. | Family parity is an exact assertion, so the family cannot be omitted from the alias; the alias's brand path is a pre-freeze namespace this change must not create. Advertised with its restriction rather than silently rejected. | 2026-11-18 |
| DEC-8 | Where a decision record and the install model document disagree, **the record wins on surface and the model keeps its mechanics**; the model is corrected in this change rather than left contradicting the shipped product. | The record is the accepted design for the surface; the mechanics (layout, atomic replace, one slot, record fields, PATH block, daemon refusal) are the model's and are preserved as behaviour. | 2026-11-18 |
| DEC-9 | Declare the compatibility enumeration cap at 128 judged roots (the host root plus up to 127 project roots) and the five-outcome vocabulary `accepted` / `not-accepted` / `unreadable` / `unchecked` / `truncated`. | The record requires a bounded enumeration and a visible truncation but fixes no number; a declared constant with a reported truncation keeps a pathological machine slow-but-honest instead of fast-and-wrong. | 2026-11-18 |
| DEC-10 | An **unreadable** header is reported as data at exit `0`, not as `not-accepted`. Only a positive equality failure refuses. | Mirrors the admission rule's positive-determination discipline: a read that could not complete is not evidence of incompatibility, and collapsing it into a refusal would manufacture a hard gate the record forbids. | 2026-11-18 |
| DEC-11 | `install uninstall` and `install purge` also refuse a live daemon without `--stop-daemon`, extending the record's install/rollback guard to the removal paths. | Removing the artifact under a supervised daemon leaves a live process with no artifact and no stop path the operator chose; refusing is the conservative reading of the record's open question, and the flag is the explicit escape. Owner acceptance is requested at pull-request review. | 2026-11-18 |
| DEC-12 | Declare the two schema identifiers `install.record.v1` and `install.status.v1`, and declare eleven `install` rows, of which exactly one (`install.dev-build`) is a kind-first two-segment identity. | The records fix the requirements and leave the spellings to the specification; eleven rows is the minimum that binds each declared refusal to exactly one identity, and the allowlist movement is exactly one. | 2026-11-18 |
| DEC-13 | `install rollback` refuses with `install.record.unreadable` when the record is present but unreadable, while `install` overwrites a damaged record and `install uninstall` removes what it can and reports the block as unknown. | A rollback that rewrote the slot history without the record would produce a claim the operator cannot check; removal and install remain useful without it. | 2026-11-18 |
| DEC-14 | The ticket's acceptance paragraph is read as six semicolon-delimited criteria, and all six are traced to specification acceptance criteria. | The paragraph contains six independent, falsifiable statements; reading it as five would leave one untraced. | 2026-11-18 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Workspace build entry | New — one additive artifact build entry beside the unchanged package build (F-1) |
| Build identity module and injection seam | New — the confined identity source, the compile-time constant, and the documented fallback (F-2, DM-1) |
| CLI process edge (both bins) and shared launcher | Updated — the owning-role fact, the identity supply, and the compiled-arm re-entry entry path (F-2, F-3, F-4) |
| Entrypoint self-description | Updated — the version render consumes the injected identity; the shape and the read-free contract are unchanged (F-2) |
| Production composition | Updated — unconditional registration of the family with its runtime and ports; no network and no build in the composition (F-4, F-6, NFR-8) |
| Typed-error register and projection | Updated additively — one domain kind, eleven rows; the projection module is unchanged (DM-6, NFR-9) |
| Git adapter | Updated — one additive worktree-topology read in the delivered fixed-argv shape; the pinned export surface and its parity baseline move once (DM-8) |
| Help inventory | Updated — one family entry and one entry per subcommand, with the alias restriction stated (F-4, F-15) |
| Help coverage check and its inventory | Updated — one page-root branch for the M4 command directory and the new command/page rows (F-15) |
| Shell installer | Updated — one classified refusal arm naming the lifecycle command when a managed binary is present; the delivered launcher behaviour is unchanged (F-14) |
| Shell uninstaller | Updated — one reporting arm naming the owning removal command; its scope, modes, and exit taxonomy are unchanged (F-14) |
| System specification pages | Updated — CLI entrypoint, doc-distribution/install set, state layer, and result contract (F-16) |
| User-facing guide | Updated — the cadence, the admissible origins, upgrade/rollback, uninstall versus purge, the PATH block, the compatibility asymmetry, and the ownership split (F-16) |
| Milestone planning pack | Updated — the install model document is corrected on surface while keeping its mechanics (DEC-8, F-16) |
| Reference documentation | New — the lifecycle's reference page under the M4 milestone command directory (F-15) |
| Compatibility alias, package scope, repository and docs URLs, state contracts, configuration catalog, agent and command definitions, shell entry points | Unchanged — the alias differs only by the composed-but-refusing family (DEC-7); no migration, rebrand, or prompt edit is in scope |

**Documentation obligations of this change.** The documentation work is part of the change, not a follow-up, and it is bound to a single acceptance criterion (§17, AC-F16-1):

| Document | Obligation |
|---|---|
| Local install guide | Rewritten around the lifecycle: the build entry that produces the artifact, the cadence, the admissible installation origins and the worktree refusal with its reason, the dev-build requirement, upgrade as an install of a different artifact, the single rollback step, `uninstall` versus `purge` with the residual report, the opt-in PATH block and its removal, the compatibility asymmetry and its rationale, and the ownership split with the shell installers |
| CLI entrypoint page | The artifact and its identity (four token situations, machine surface), the compiled versus non-compiled re-entry path, the twenty-six families, the lifecycle family with its flags and the alias restriction, and the install posture that replaces the launcher-only description |
| Documentation distribution page | The install set's launcher step becomes conditional: unchanged when no managed binary exists, refusing when one does; the retired "no uninstall path exists" statement is replaced by the ownership split |
| State layer page | The ledger header is the compatibility surface for the installed binary, the check is read-only and advisory, and the hard gate is unchanged |
| Result contract page | The `install` domain kind, its eleven rows with categories and projections, and the two-segment allowlist moving from 65 to 66 declared identities |
| Milestone install model | Corrected: the surface sections (the shell lifecycle entry point, the flag forms for rollback/uninstall/purge) are superseded by the delivered family, while the layout, the atomic replace, the single slot, the record fields, the PATH block, and the daemon refusal are preserved as behaviour (DEC-8) |
| M4 reference page (new) | The family and its five entry points, `--help` and `--version`, the flags, the refusals, the dry-run plans, and the ownership split |
| Planning backlog / milestone pack | The M4-S1 marker reflects the delivered story and the surfaces now owned by the family |

**Contract surfaces this change moves (the declared conformance and documentation set).**

| Surface | What must become true |
|---|---|
| Prompt-required command set | Twenty-six families, with the new family appended; the entry follows the delivered declaration shape |
| Family-count and family-tail assertions | Every pinned count is 26 and every tail position names the current last family (the delivered tail pins move) |
| Root, family, and subcommand help | One family entry plus one entry per subcommand, each with usage, options, examples, exit codes, and see-also; the alias restriction is stated in the family entry |
| Production registration | Unconditional registration with the family's runtime and ports; the family is never absent from the composed program |
| Help-coverage page-root mapping | One branch placing the family's page in `doc/planning/oss-tooling/milestones/m4/commands/install.md`; the default M1 root must not serve it |
| Help-guide coverage inventory | The command row and the reference-page row, in both directions |
| New reference page | Exists, and contains both `--help` and `--version` |
| Error-table source and documented table | One `install` domain kind and eleven rows, documented with category, retryability, consequence, projection, and remediation; the two-segment allowlist moves to 66 |
| Identity-literal inventory | One new declared build-side site; the product-surface count unchanged; the bidirectional comparison (with its negative control) green |
| Installer and uninstaller suites | The delivered cases stay green; one new installer case asserts the managed-binary refusal and that no launcher is written; one uninstaller case asserts a managed install is reported and untouched |
| Documentation conformance checks | The corrected pages and the guide stay green under the phrase and literal checks |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the change branch and the pinned toolchain, **when** the artifact build entry (`build:binary`) runs, **then** one executable exists at `dist/<binary-name>` under the repository root, running it answers `--version`, `--help`, and one composed command from an empty directory with a scrubbed `PATH`, no `HOME` content, and no checkout (3/3), and **when** the same build runs with a dirty tracked tree, **then** it completes and the artifact reports `<commit>-dirty` while no tracked file is modified by the build (ticket task: self-contained build; ticket AC: clean-profile install works; ticket AC: delivery runs while the repository is dirty or mid-change) | F-1, NFR-1, NFR-15 |
| AC-F1-2 | **Given** two consecutive builds of the same commit, **when** both artifacts are inspected, **then** their `--version` output is identical and their bytes are not, the build reports the artifact size and the host target it produced, and no output or document claims byte-identical rebuilds (ticket task: self-contained build) | F-1, NFR-15 |
| AC-F2-1 | **Given** artifacts built clean, built from a dirty tree, built without git metadata, and a non-compiled run, **when** `--version` runs in each case, **then** the line is exactly `<binary-name> <version> (build <token>)` on one line at exit `0` with tokens equal to the short commit, `<short commit>-dirty`, `unknown`, and `dev` respectively (4/4) (ticket AC: the binary reports version+commit) | F-2 |
| AC-F2-2 | **Given** any injected identity, **when** `--version` runs, **then** the output contains no field beyond the delivered line and `--version --json` produces exactly the same bytes as `--version`; and **when** both bins run with the same injected identity, **then** the alias's line is byte-identical to the primary identity's modulo the binary name (ticket AC: the binary reports version+commit; ticket AC: upgrade is version-reported) | F-2, NFR-1 |
| AC-F2-3 | **Given** an artifact, **when** `--version`, `--help`, and `--print-install-path` run in a directory with no repository, with an unreadable configuration file, with a poisoned environment, and with a recording `git` stub on `PATH`, **then** every invocation exits `0`, writes nothing, and the recorded stub sees zero invocations; and **when** a composed command runs, **then** the identity fields are the injected ones with no ambient read (ticket AC: the binary reports version+commit) | F-2, NFR-2 |
| AC-F3-1 | **Given** a compiled artifact, **when** a family command, a subcommand, a positional, and a global flag are invoked, **then** each resolves exactly as the delivered grammar resolves for the same argument vector, and the user argument slice contains exactly the user arguments (ticket AC: delivery runs while the repository is dirty or mid-change) | F-3 |
| AC-F3-2 | **Given** a compiled artifact, **when** the detached re-entry entry path and the installed service unit's executable are derived, **then** both name the artifact's real path, no value containing the bundle's virtual root is ever handed to a spawn or a unit, and a non-compiled run keeps the delivered script path; and **when** `--print-install-path` runs, **then** it answers the effective identity's brand install path exactly as delivered (ticket AC: delivery runs while the repository is dirty or mid-change) | F-3, NFR-2 |
| AC-F4-1 | **Given** the change branch, **when** each of `install`, `install status`, `install rollback`, `install uninstall`, `install purge` is invoked through the composed program of **both** bins, **then** each resolves to the family handler (5/5), root help lists the family as the twenty-sixth, and each of the five resolves its own `--help` from the static inventory; and **when** the family's runtime is unavailable, **then** the invocation answers the containment identity at exit `2` rather than an absent family (ticket task: `install` with atomic replace; ticket task: `uninstall`/`purge` with a dry-run report) | F-4, F-15 |
| AC-F4-2 | **Given** the alias, **when** any of the five lifecycle entry points runs on it, **then** exactly one typed refusal `install.identity.not-owning` at exit `1` names the owning binary, nothing is written, no path under the alias's namespace is created, and its help entry states the restriction; and **when** any other alias command runs, **then** its behaviour and output are exactly as delivered (ticket task: `install`; DEC-7) | F-4, NFR-10 |
| AC-F4-3 | **Given** the family, **when** an unknown subcommand, an unrecognised flag, or a destination argument is supplied, **then** the delivered grammar refusal `fallback.invocation` at exit `1` answers and nothing is written; and **when** the destination is examined, **then** no flag, argument, or environment value can redirect it away from the brand install path (ticket task: `install`) | F-4, NFR-9 |
| AC-F5-1 | **Given** an artifact inside a linked git worktree, **when** `install` runs, **then** it refuses with `install.target.worktree` at exit `1`, names the target directory and both git directories, states the two admissible origins and that a lane worktree is deleted after merge, and leaves the destination's bytes and modification time unchanged with no record written and no profile line added (ticket AC: an install whose target is a worktree is refused with a typed error) | F-5, NFR-10 |
| AC-F5-2 | **Given** four targets — the primary checkout, a non-worktree clone, a plain directory holding a released artifact, and a host with no `git` on `PATH` — **when** each installs the same artifact, **then** all four succeed and the recorded provenance is `verified`, `verified`, `unverified`, `unverified` respectively; and **when** the origin's tree is dirty, **then** the install is admitted and the reported token is `<commit>-dirty` (ticket AC: clean-profile install works; ticket AC: delivery runs while the repository is dirty or mid-change) | F-5 |
| AC-F5-3 | **Given** four destination states — a compiled artifact with a valid record, a delivered bash launcher, a symlink to another artifact, and nothing — **when** `install` runs against each, **then** the artifact becomes the slot, the launcher is discarded with a report naming its recorded target (including when that target is missing or inside a worktree) and is never promoted, the symlink is replaced without writing through it and the disposition names it, and an absent destination is created; and **when** the slot is later inspected, **then** it holds only a compiled artifact carrying an injected identity (ticket AC: upgrade is explicit, reversible, and version-reported) | F-5, F-9 |
| AC-F6-1 | **Given** a non-compiled invocation, **when** `install` runs, **then** it refuses with `install.dev-build` at exit `1`, names the build entry and the artifact path convention, writes nothing, and **when** the composition is inspected structurally, **then** it constructs no HTTP client and spawns no build or package-manager process (ticket task: dev builds kept out of the delivery path) | F-6, NFR-8, NFR-10 |
| AC-F7-1 | **Given** a state root whose header declares a format the artifact does not accept, **when** `install` and `install rollback` run, **then** each completes successfully with an unchanged exit code and prints exactly one advisory line per not-accepted root naming the root, the observed identifier, the accepted identifier, and the remedy (ticket task: compatibility check between installed binary and repository state version) | F-7, NFR-6 |
| AC-F7-2 | **Given** roots in the states accepted, not-accepted, unreadable, and absent, **when** `install status` runs, **then** each root is reported with its root path, observed identifier, outcome, and reason; the exit code is `1` with `install.state.incompatible` naming the root, observed, accepted, and the judged count when any root is not accepted, and `0` for the accepted, unreadable, and unchecked states; and `unchecked` is never reported as accepted (ticket task: compatibility check) | F-7, NFR-9, NFR-16 |
| AC-F7-3 | **Given** a planted record with a foreign version inside an accepted store, **when** the compatibility check runs, **then** that record is never opened, no path below a project directory is visited, the judged count never exceeds the declared cap, an exceeded cap reports truncated with the judged count, nothing is written into any state root, and the delivered `state.schema.mismatch` suite is unchanged (ticket task: compatibility check) | F-7, NFR-7, NFR-13 |
| AC-F8-1 | **Given** a successful install, **when** the record is inspected, **then** it exists at `<config root>/install.json` with schema `install.record.v1` and every declared field of §8.3 populated or legitimately absent, it was written atomically with no partially written intermediate visible, it contains no credential and no secret-shaped value, and `install status` reports the same identity the artifact reports (ticket task: `install.json` build identity) | F-8, NFR-12 |
| AC-F8-2 | **Given** an absent record, a damaged record, and a record that no longer matches the destination (the post-crash case), **when** the lifecycle runs, **then** `install status` reports `absent`, `unreadable`, and `record-stale` respectively as data at exit `0`, `install` overwrites a damaged record after a successful replace, `install uninstall` removes what it can and reports the managed block as unknown, and `install rollback` refuses with `install.record.unreadable` at exit `1` (DEC-13) | F-8, NFR-12 |
| AC-F9-1 | **Given** a failure injected at each of the seven replace steps in turn, **when** each run fails, **then** a runnable artifact exists at a known path after every failure, no truncated destination is ever left, no staged file remains at the destination, and re-running `install` restores a complete install (7/7) (ticket AC: clean-profile install works) | F-9, NFR-3 |
| AC-F9-2 | **Given** an installed artifact, **when** the identical artifact installs again, **then** the destination's bytes and modification time are unchanged, the slot is not swapped, the record is unchanged, a live daemon is not disturbed, and the run reports the identity and that nothing changed (ticket AC: upgrade is explicit, reversible, and version-reported) | F-9, NFR-4 |
| AC-F9-3 | **Given** a second artifact with a different identity, **when** it installs over the first, **then** output names both identities and both `--version` and `install status` report the new one; **when** `install rollback` runs, **then** the previous artifact is back in place and output names both identities; **when** rollback runs a second time, **then** the original artifact is in place (involutive); and **when** the slot is absent, holds a launcher, or holds an artifact without an injected identity, **then** rollback refuses with `install.slot.absent` or `install.slot.invalid` at exit `1` and writes nothing (ticket AC: upgrade is explicit, reversible, and version-reported) | F-9, NFR-9 |
| AC-F9-4 | **Given** a live daemon holding the artifact, **when** `install`, `install rollback`, `install uninstall`, or `install purge` runs without `--stop-daemon`, **then** each refuses with `install.daemon.running` at exit `1` naming the holder and the remedy and writes nothing; and **when** the same run includes `--stop-daemon`, **then** the daemon is stopped through the delivered stop path **before** the swap or removal, and no delivery path observes two builds (DEC-11) | F-9, F-10, NFR-10 |
| AC-F10-1 | **Given** an installed artifact with a managed PATH block and populated configuration and state roots, **when** `install uninstall` runs, **then** the artifact, the slot, the record, and the managed block are removed, both roots remain byte-identical, and the residual set is printed unconditionally as exactly what `purge` would additionally delete; and **when** the same set is compared with `purge --dry-run`'s removal set at the same moment and with what `purge --yes` removes, **then** the three sets are equal path for path (ticket AC: uninstall removes the entry point and reports exactly what purge would delete) | F-10, NFR-11 |
| AC-F10-2 | **Given** `install purge` without a confirmation input, **when** it runs, **then** it refuses with `install.purge.unconfirmed` at exit `1`, names both roots and the flag, and removes nothing; **when** it runs with `--yes`, **then** the removal list is enumerated and removed with each absolute path reported, including every enumerated project root; and **when** the roots are absent, **then** it reports "nothing to remove" at exit `0` (ticket AC: uninstall removes the entry point and reports exactly what purge would delete) | F-10, NFR-11 |
| AC-F11-1 | **Given** a filesystem snapshot, **when** each of `install --dry-run`, `install rollback --dry-run`, `install uninstall --dry-run`, and `install purge --dry-run` runs, **then** the snapshot is unchanged (paths, sizes, mtimes, modes) (4/4), no directory is created, no daemon action is taken, and each printed plan contains the declared content for its command with absolute paths, one line per path (ticket task: `uninstall`/`purge` with a dry-run report) | F-11, NFR-5 |
| AC-F12-1 | **Given** `--add-to-path` with an explicit profile path, **when** install runs, **then** exactly one delimited block containing one export line is appended, its file and marker are recorded, and re-running install with identical content appends nothing while different content is replaced in place and never duplicated; **when** the profile is derived from the operator's shell, **then** the declared mapping selects one file; **when** no shell is identifiable and no path is given, **then** `install.shell-profile.unresolved` refuses at exit `1`; **when** the flag is absent, **then** no profile file is written; and **when** uninstall or purge runs, **then** exactly that block is removed and nothing else (ticket task: `--add-to-path` opt-in) | F-12, NFR-10 |
| AC-F13-1 | **Given** prior-namespace artifacts present on the machine, **when** `install` runs without `--migrate`, **then** one advisory line names them and the documented manual move, and zero files are moved, copied, or deleted; **when** it runs with `--migrate`, **then** `install.migration.unavailable` at exit `1` states that migration is not available in this build and names the M4-S2 owner with a remedy, and zero files are moved, copied, or deleted; and **when** `--migrate` is combined with `--dry-run`, **then** the detection list is printed and nothing is migrated (ticket task: `--migrate` hook) | F-13, NFR-10 |
| AC-F14-1 | **Given** no managed binary at the install path, **when** the delivered installer runs, **then** its launcher step behaves exactly as delivered (same target, content-idempotent, the two classified failures, the plan-only dry-run preview that writes nothing and exits `0`, independence from the tool selection); and **given** a managed binary with a record, **when** the installer runs, **then** the launcher step refuses, classified, names the lifecycle command as the update path, writes no launcher, and leaves the managed binary and its record untouched (ticket task: `install`; DEC-1) | F-14, NFR-10 |
| AC-F14-2 | **Given** a managed install, **when** the shell uninstaller runs in either mode, **then** it removes no binary, no slot, no record, and no Jaiship root, it reports the managed install and names the owning removal command, and its own exit taxonomy and dry-run behaviour are unchanged (DEC-5) | F-14, NFR-13 |
| AC-F15-1 | **Given** the change branch, **when** the aggregate quality gate runs, **then** it is green with the prompt-required set at exactly 26 families, both bins identical in content and order, the family's reference page present in the M4 command directory containing `--help` and `--version`, the page-root mapping resolving that page, and the coverage inventory agreeing in both directions; and **when** any of these is violated by an injected fixture, **then** the corresponding gate fails by name (ticket task: `install`) | F-15, NFR-14 |
| AC-F15-2 | **Given** the change branch, **when** the CI error-table gate runs, **then** the source table, the documented table, and the fixtures agree with the `install` domain kind and its eleven declared rows documented with category, retryability, consequence, projection, and remediation, the closed two-segment allowlist at exactly 66 declared identities, and no delivered row renamed, reworded, or re-projected | F-15, DM-6, NFR-9 |
| AC-F15-3 | **Given** the change branch, **when** the identity-literal inventory check runs, **then** exactly one new declared build-side site is present with its own scan root, the product-surface inventory is unchanged at its delivered count, and the bidirectional comparison passes with its negative control failing on an injected undeclared literal (DEC-2) | F-15, DM-7 |
| AC-F16-1 | **Given** the change branch, **when** the documentation set is inspected, **then** the guide states the cadence, the admissible origins and the worktree refusal with its reason, the dev-build requirement, upgrade and rollback, uninstall versus purge with the residual report, the PATH block, the compatibility asymmetry with its rationale, and the ownership split; the entrypoint, doc-distribution, state-layer, and result-contract pages state the delivered truth; the install model is corrected on surface with its mechanics preserved and the record-wins rule stated; the retired "no uninstall path exists" statement is gone; and no page claims a behaviour this change does not deliver (ticket task: documented cadence; DEC-8) | F-16, NFR-17 |

**Ticket-AC traceability.** The ticket's acceptance paragraph contains six semicolon-delimited criteria. Mapping:

| Ticket AC (verbatim fragment) | Specification ACs |
|---|---|
| "clean-profile install works" | `AC-F1-1`, `AC-F5-2`, `AC-F9-1`, `AC-F4-1` |
| "delivery runs while the repository is dirty or mid-change" | `AC-F1-1`, `AC-F5-2`, `AC-F3-1`, `AC-F3-2` |
| "upgrade is explicit, reversible, and version-reported" | `AC-F9-3`, `AC-F9-2`, `AC-F2-2`, `AC-F5-3` |
| "the binary reports version+commit" | `AC-F2-1`, `AC-F2-2`, `AC-F2-3`, `AC-F8-1` |
| "an install whose target is a worktree is refused with a typed error" | `AC-F5-1` |
| "uninstall removes the entry point and reports exactly what purge would delete" | `AC-F10-1`, `AC-F10-2`, `AC-F11-1` |

**Ticket-task traceability.** "self-contained build" → `AC-F1-1`, `AC-F1-2`; "`install` with atomic replace into the brand install path, one rollback slot, install record build identity, `--add-to-path` opt-in, `--migrate` hook" → `AC-F4-1`, `AC-F9-1`, `AC-F9-2`, `AC-F8-1`, `AC-F12-1`, `AC-F13-1`; "`upgrade`" → `AC-F9-2`, `AC-F9-3` (DEC-6); "`uninstall`/`purge` with a dry-run report" → `AC-F10-1`, `AC-F10-2`, `AC-F11-1`; "`--version` reporting build identity" → `AC-F2-1`, `AC-F2-2`; "compatibility check between installed binary and repository state version" → `AC-F7-1`, `AC-F7-2`, `AC-F7-3`; "a stability rule that refuses an install target inside a git worktree" → `AC-F5-1`, `AC-F5-2`; "documented cadence" → `AC-F16-1`; "dev builds kept out of the delivery path" → `AC-F6-1`. Every `F-` capability is exercised by at least one acceptance criterion, and every `NFR-` is bound to at least one.

**Verification intent.** `AC-F1-1`, `AC-F1-2`, `AC-F2-1`, `AC-F3-1`, and `AC-F3-2` are artifact-level cases that consume one build of the change branch and run it in a scrubbed, offline environment, in the delivered pattern for installer integration cases, so the aggregate gate stays deterministic and offline. `AC-F2-2` and `AC-F2-3` are behaviour-level over injected identities and streams plus the delivered isolation suite, extended with the recording-`git`-stub negative control. `AC-F4-1`, `AC-F4-2`, and `AC-F4-3` are behaviour-level over the composed programs of both bins with a filesystem assertion for the zero-write claim. `AC-F5-1`, `AC-F5-2`, `AC-F5-3`, and `AC-F6-1` are behaviour-level over fixture checkouts — a fixture linked worktree, a primary-shaped checkout, a non-worktree clone, a plain directory, and a scrubbed `PATH` without `git` — each asserting destination bytes and mtime. `AC-F7-1`, `AC-F7-2`, and `AC-F7-3` are behaviour-level over crafted state roots with a file-access assertion for the header-only and no-payload-decode claims. `AC-F8-1` and `AC-F8-2` assert the record's shape, atomicity, and tolerance, with an injected damaged record. `AC-F9-1`, `AC-F9-2`, `AC-F9-3`, and `AC-F9-4` are behaviour-level with a failure injected at each replace step, an identity round-trip, both slot-refusal arms, and an injected live-daemon instance. `AC-F10-1`, `AC-F10-2`, `AC-F11-1`, `AC-F12-1`, `AC-F13-1`, and part of `AC-F14-1`/`AC-F14-2` are installer and lifecycle integration cases over a scratch home and a scratch project root, with the residual-equality assertion comparing three computed sets at the same moment and a filesystem snapshot per dry-run. `AC-F15-1`, `AC-F15-2`, and `AC-F15-3` are structural and gate-level with an injected negative control per guard. `AC-F16-1` is a documentation comparison over the declared pages plus the documentation-truth checks.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full eleven-phase lifecycle on the change branch; plan phases declared in the plan; commits through the commit primitive; quality gates green before the pull request; the pull request targets the integration branch and **stops open** with merge authority outside this change.
- Delivery order inside the change is constrained by dependency, not preference: the artifact and its identity first (nothing can install itself otherwise), then the family with its admission rules, then the record and the replace, then removal and the dry-runs, then the guards and the conformance surface, then the documentation correction. The plan owns the phase boundaries; this specification owns the contract.
- Adoption is opt-in and reversible for an existing operator: their current launcher keeps working until they build and run the artifact; the first managed install discards the launcher **with a report** rather than silently, so the operator sees what was replaced. Nothing is migrated, and nothing under a pre-freeze namespace is created.
- The declared operating change is stated where operators will meet it: an install must originate from the primary checkout (or a prepared directory holding a released artifact), and installing from a lane worktree is refused on purpose. The guide says so, and the refusal says so.
- The transition out of this increment is explicit: the `--migrate` hook becomes a delegation when M4-S2 lands, and the refusal identity is retired in that change rather than left as a dead path.
- An installed artifact is unaffected by any reversal of this change: removing the family and the build entry leaves an already-installed binary running, and the installer guard stays because it prevents a shim from overwriting a managed binary whether or not the family exists.
- Documentation ships in the same change (§16), including the two corrected delivered claims.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. This change performs no migration, no seeding, and no backfill.

- The install record is new; there is no prior record to convert. An absent record is a declared readable state (`absent`), so no upgrade path from a record-less install is required.
- No configuration key, state record kind, state file, or environment variable is introduced, and nothing is written into a state root.
- Prior-namespace artifacts are **detected and reported only**; the operator's documented manual move is theirs to perform, and the `--migrate` hook refuses typedly rather than half-performing it.
- The destination may hold a delivered launcher from the previous increment; its disposition is a report-then-discard at install time, not a migration, because restoring it later would restore the defect.
- Rollback across the transition is one step and never restores a launcher: the slot accepts only a compiled artifact.

## 20. PRIVACY / COMPLIANCE REVIEW

No new personal data is collected, stored, or transmitted, and nothing leaves the machine.

- The install record holds paths, identity fields, a schema identifier, and a timestamp — operational metadata about a local installation, not user content. It never holds a credential, a provider value, a token, or file content.
- Lifecycle output names absolute paths (the install path, the install directory, the profile file, the configuration and state roots, and enumerated project roots). Those paths are the operator's own local layout, and the destructive operations require them to be named exactly; the residual report is paths only and never file contents.
- The compatibility check reads only a small header file per root and reports an opaque format identifier; it never decodes a delivery record and never reads a secret.
- The build captures the commit and a dirty flag from the local repository; nothing is uploaded, and the identity is embedded in a local artifact.
- No tracker, provider, vendor, or analytics flow is added; the lifecycle performs no network access at all.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No network, no fetch, no build inside the lifecycle.** The family constructs no HTTP client, invokes no package manager, and spawns no build; the absence is asserted structurally over the composition, so a later addition fails a check rather than shipping quietly.
- **The destination is not operator-selectable.** No flag, argument, or environment value redirects the install path; an attempt is a grammar refusal. A redirectable install path is an arbitrary-write primitive, and it is absent by construction.
- **Replacement is a rename, never an in-place write.** Staging happens in the destination directory on the same file system, the staged file is verified (existence, non-empty, executable bit, identity) before the renames, and the destination is never written in place — so a compromised or truncated artifact cannot be left as the installed product.
- **The rollback slot cannot resurrect a weaker artifact class.** Only a compiled artifact carrying an injected identity is admissible; a launcher, a wrapper, or an identity-less binary is refused, so an attacker who can place a file at the slot path gains nothing.
- **The alias cannot create a pre-freeze namespace.** The owning-role fact defaults to *not owning*, so a lifecycle invocation on any identity other than the primary one writes nothing; the refusal carries no identity literal, so it cannot drift.
- **The PATH block is delimited, opt-in, and owned.** One block, one export line, explicit markers, recorded in the record, replaced rather than duplicated, and removed only by removal — so a later edit or a hostile profile line cannot be attributed to the product, and the product cannot silently grow a second block.
- **The profile file is the only operator-owned file the product touches**, and only when explicitly asked. Nothing else outside the Jaiship namespaces and the install directory is written.
- **Removal is bounded and ordered.** Artifact, slot, record, block, then the roots; roots are removed only under an explicit confirmation; absent members are reported rather than guessed; a damaged record degrades the report to "unknown" rather than inventing a path.
- **The compatibility check is read-only and bounded** (header files, one level, capped), so it cannot be turned into a store-wide read from a command that does not otherwise read state.
- **Typed refusals instead of bare exits** keep the failure surface inside the delivered envelope and projection, so no lifecycle failure can masquerade as success or bypass redaction.
- **No new secret path.** The record and every lifecycle output are redaction-safe by construction; the secret-read boundary check stays green, and the build embeds no credential.
- **The artifact is bigger and less inspectable than a script.** That is a declared trade: it is a single file at a known path with a reported identity, and its bytes are reproducible in *content* only in the sense that the same commit yields the same reported identity, which the documentation states honestly.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **One lifecycle implementation, one owner per artifact class.** The shell installer owns repository artifacts and, when no managed binary exists, the launcher; the family owns the binary, its slot, its record, and its block. Either surface naming the other is a maintained contract, and a change that blurs it must revisit both.
- **The replace ordering is the invariant, not an implementation detail.** Any future change to the seven steps must preserve "a runnable artifact exists at a known path at every instant"; the crash matrix in the acceptance criteria is the guard, and it is cheap to run and easy to update together with the algorithm.
- **The record is a shared contract with four readers.** A new field is additive and optional on read; a renamed or re-meant field is a contract change that must move `install status`, rollback, the uninstall residual computation, and the next install together.
- **The compatibility check has a declared blind spot.** It detects a store-format change and cannot detect a per-domain break, whose only detector remains that domain's own read boundary. Widening it is a recorded revisit trigger, not a maintenance accident.
- **The refusal surface is closed at eleven rows.** A new refusal means a new documented row and, when it is a kind-first two-segment code, a deliberate widening of the closed allowlist — never a wildcard.
- **The family's membership is an exact assertion.** Adding the family moved every pinned count and the family-tail positions; the next family will do the same, and the pins are the reason that stays cheap.
- **The artifact's limits are maintained facts.** Size, host-only targeting, and non-reproducibility are recorded with revisit triggers; a claim of reproducibility added anywhere is a documentation defect, and a size claim must be re-measured rather than inherited.
- **The `--migrate` refusal is a dated seam.** When M4-S2 lands, the refusal becomes a delegation and the identity retires in that change; leaving it in place would be a dead path that lies about the product's capability.
- **The managed PATH block is the one operator-file mutation.** Its markers, its recording, and its removal are the complete story; an operator who edits the profile by hand is a documented, tolerated case.
- **Installing from a lane worktree is now a refused workflow.** The operating rule is documented, and the revisit trigger records the override route if per-iteration installs become a real need.
- **The corrected documentation is part of the product's truth.** The retired "no uninstall path exists" statement must not reappear, and the install model's mechanics stay authoritative for the layout and the algorithm while its surface sections follow the delivered family.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Artifact | The single self-contained executable produced by the artifact build entry and installed by the lifecycle |
| Build identity | The five captured facts injected into the artifact at build time: version, commit, build instant, dirty flag, channel |
| Build token | The value rendered inside the delivered `(build …)` slot: short commit, short commit with `-dirty`, `unknown`, or `dev` |
| Development run | A non-compiled invocation carrying the fallback identity (`0.0.0`, `unknown`, `dev`); admitted nowhere as an install source |
| Install target | The running artifact together with the git checkout it resolves to — the only operator-influenceable input to an install |
| Destination | The brand install path returned by the read-free self-description; derived, never supplied |
| Recorded provenance | What the record keeps about the target's checkout: path, commit, dirty flag, and `verified`/`unverified` |
| Executed path | Any path the product persists for later execution: the installed artifact, a legacy launcher's recorded target, or a service unit's command |
| Linked worktree | A checkout whose own git directory differs from the repository's common git directory; deleted after merge in this repository's topology |
| Admission | The install-target stability rule's decision: refuse, admit verified, or admit unverified |
| Disposition | What happens to whatever is found at the destination before a managed install: becomes the slot, discarded with a report, replaced, or created |
| Rollback slot | The one file beside the destination holding the previous compiled artifact; swapped on every install and on every rollback |
| Install record | The single `install.record.v1` file inside the configuration root describing the installed artifact, its provenance, its slot, its launcher disposition, and its managed block |
| Residual set | The absolute paths that exist under the configuration and state roots at the moment of an uninstall — exactly what a purge would additionally delete |
| Managed PATH block | The delimited, recorded, opt-in block the product appends to one shell profile |
| Compatibility verdict | The per-root comparison of the artifact's accepted store-format identifier against each state root's header identifier |
| `unchecked` | The compatibility outcome for an absent or unreadable root: nothing was compared, and the state is never collapsed into `accepted` |
| Owning identity | The executable identity that owns installation; the compatibility alias does not, so the family is composed for it and refused on it |
| Declared divergence | A deliberately unchanged or deliberately asymmetric surface stated in this specification: the alias's refusal of the composed family, and (preserved) the alias's own name paths and projections |
| Cadence | The documented operating rhythm: install a release, deliver iterations through the installed artifact, decide, re-install |

## 24. APPENDICES

### Appendix A — The `--version` token contract (normative)

| Situation | Token in `(build …)` | Example line |
|---|---|---|
| Compiled from a clean tracked tree | short commit (7 characters) | `jaiship 1.2.3 (build 4bc7b61)` |
| Compiled from a dirty tracked tree | short commit + `-dirty` | `jaiship 1.2.3 (build 4bc7b61-dirty)` |
| Compiled with no git metadata | `unknown` | `jaiship 1.2.3 (build unknown)` |
| Not compiled (workspace run, tests, embedder) | `dev`, version `0.0.0` | `jaiship 0.0.0 (build dev)` |

The line is one line, exit `0`, read-free. The build instant never appears in it. `--version --json` is byte-identical to `--version`. The full identity is served only by `install status --json`.

### Appendix B — The seven replace steps (normative)

| Step | Action | Failure consequence |
|---|---|---|
| 1 | Admission (stability rule), identity gate, daemon guard, and the read-only compatibility pre-flight | Nothing written; typed exit |
| 2 | Stage the running artifact's bytes into a temporary file in the install directory (same file system) | Destination and record untouched; temporary file removed |
| 3 | Verify the staged file: exists, non-empty, executable, identity equal to the running artifact | Destination and record untouched; temporary file removed |
| 4 | If the destination's identity equals the running identity **and** the record matches, stop: report unchanged, write nothing | No churn; slot not swapped; daemon undisturbed |
| 5 | Rename the destination to the slot (replacing any existing slot) | Destination gone, slot holds the previous artifact: recoverable by re-running install |
| 6 | Rename the staged file to the destination | Destination present again, slot intact: a working install exists at every instant |
| 7 | Write the record (staged and renamed) | Destination and slot are both valid; the record is stale until the next install and `install status` reports `record-stale` |

Only the window between steps 5 and 6 has no destination, and in that window the slot holds a runnable artifact at a known path. No step writes bytes in place at the destination, and no cross-device move is possible.

### Appendix C — Admission, disposition, removal, and dry-run tables (normative)

**C.1 Admission rules**

| Rule | Predicate | Outcome |
|---|---|---|
| S-1 linked worktree | the checkout's own git directory and its common git directory, both absolute, differ | Refuse: `install.target.worktree`, exit `1` |
| S-2 unreadable git | either read fails (git absent, not a repository, command error) | Admit; provenance `unverified` |
| S-3 stable checkout | both reads succeed and are equal | Admit; provenance `verified` |
| S-4 destination | the destination equals the brand install path | Cannot fail by operator action (the destination is not an input) |
| D-1 product artifact | the running artifact carries an injected identity | Admit |
| D-2 development run | the running artifact carries the fallback identity | Refuse: `install.dev-build`, exit `1` |
| D-3 no build, no download | no build tool, package manager, or network client in the composition | Structural assertion |

**C.2 Destination dispositions**

| Situation found at the destination | Disposition |
|---|---|
| Compiled artifact with a valid record | Becomes the rollback slot (only through the step-5 rename) |
| Delivered bash launcher | Discarded with a report naming its recorded target; never promoted — including when the target is missing or inside a worktree |
| Symlink to another artifact | Replaced; the reported disposition names the link and its target; the link target is never written through |
| Nothing | Created |

**C.3 Removal matrix**

| Path | `uninstall` | `purge` |
|---|---|---|
| The installed artifact | removed | removed |
| The rollback slot | removed | removed |
| The install record | removed | removed |
| The managed PATH block | removed | removed |
| The configuration root (everything else) | **kept** | removed |
| The state root (host root and every project root) | **kept** | removed |

Order: artifact, slot, record, block, then the roots (purge only). An absent member is reported as absent; a damaged record makes the block "unknown" rather than guessed.

**C.4 Dry-run plan content**

| Command | Plan content |
|---|---|
| `install --dry-run` | Running identity and artifact path; destination path; the disposition of whatever is found there; whether the slot would be swapped; the record path; the profile file and the exact block text (only with `--add-to-path`); detected prior-namespace artifacts; the state-format advisory set; the daemon disposition |
| `install rollback --dry-run` | Current and slot identities; the two renames in order; the record update |
| `install uninstall --dry-run` | The removal list and, in a separated block, the residual set it would report |
| `install purge --dry-run` | The removal list including both roots and every enumerated project root |

Every plan uses absolute paths, one line per path, and performs no write, no directory creation, and no daemon action.

### Appendix D — The `install.status.v1` payload shape (normative)

| Group | Content |
|---|---|
| `running` | `version`, `commit` (full), `builtAt`, `dirty`, `channel`, `artifactPath` |
| `installed` | The record's identity fields, or null when the record is absent |
| `recordState` | `current` \| `record-stale` \| `unreadable` \| `absent` |
| `rollback` | The slot's identity, or null; `slotState`: `present` \| `absent` \| `invalid` |
| `targetStability` | `verified` \| `unverified` \| `linked-worktree` (reported as data; never a refusal on this surface) |
| `stateFormat` | `accepted` identifier; `roots[]` each with `root`, `observed`, `outcome` (`accepted` \| `not-accepted` \| `unreadable` \| `unchecked`), `reason`; `judged`; `truncated` |
| `pathBlock` | The profile file and block marker, or null |

Field order and content are deterministic for a given machine state.

### Appendix E — The declared `install` domain rows (normative)

| Identity | Trigger | Exit |
|---|---|---|
| `install.target.worktree` | The install target resolves inside a linked git worktree | `1` |
| `install.dev-build` | The running artifact carries no injected identity | `1` |
| `install.state.incompatible` | `install status` judged a state root whose header identifier is not accepted | `1` |
| `install.identity.not-owning` | A lifecycle entry point ran on an identity that does not own installation | `1` |
| `install.shell-profile.unresolved` | `--add-to-path` without `--shell-profile` and with no identifiable shell | `1` |
| `install.migration.unavailable` | `--migrate` was supplied; migration is not implemented in this build | `1` |
| `install.daemon.running` | A live daemon holds the artifact and `--stop-daemon` was not given | `1` |
| `install.record.unreadable` | `install rollback` found the record present but unreadable | `1` |
| `install.slot.absent` | Rollback found no slot | `1` |
| `install.slot.invalid` | Rollback found a slot that is not a compiled artifact or whose bytes are unreadable | `1` |
| `install.purge.unconfirmed` | `install purge` without its confirmation input | `1` |

All eleven are category `user`, non-retryable, consequence `not_landed`, projection class `user-validation`. `install.dev-build` is the only kind-first two-segment identity and therefore the only addition to the closed two-segment allowlist. Grammar refusals, an unknown subcommand, and a destination argument reuse the delivered `fallback.invocation`. No family or wildcard exists.

### Appendix F — Source anchors

- Ticket: GitHub issue 346, milestone "M4: Jaiship-native delivery", story M4-S1 (goal, tasks, six AC clauses, and the flip-priority paragraph).
- Binding design: TDR-0036 (family surface), TDR-0037 (artifact and identity), TDR-0038 (stability and dev exclusion), TDR-0039 (compatibility check), TDR-0040 (lifecycle boundaries) — all `Proposed`, accepted or rejected by the owner at this change's pull-request review.
- Milestone pack: the M4 README (exit criteria EC-1, EC-7, EC-8 and decisions D3, D6), the backlog entry for M4-S1 and the stories it blocks, the ranking, and the install model (whose surface is superseded and whose mechanics are preserved).
- Delivered contracts verified for current truth: the two bins and the shared launcher, the entrypoint's self-description and composition rules, the production composer's registration rule, the prompt-required declaration, the help inventory and the help-coverage check with its inventory fixture, the typed-error register and the documented result contract, the state layer's format identifier and ledger header, the git adapter's reads, the installer's launcher step, and the shell uninstaller's scope.
- Prior change record: GH-320 (§8.5 backward compatibility and declared divergences, §17 acceptance criteria, §22 maintenance) for the conventions this specification reuses.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-18 | @spec-writer | Initial specification: artifact and identity, the composed `install` family with its refusals, the stability and dev gates, the compatibility verdict, the install record, the replace/rollback/removal/dry-run contracts, the installer guards, the declared conformance surface, and the documentation obligations |

---

## AUTHORING GUIDELINES

- Authored from the GitHub issue 346 body (goal, task list, six acceptance clauses, and the "Flip priority" paragraph), the five binding decision records (TDR-0036 … TDR-0040), the M4 milestone pack, the delivered contracts named in §16 and Appendix F, and the prior GH-320 change record for conventions. No invention beyond those sources: every normative detail of the decision records is carried into a capability, a rule, an appendix table, or an acceptance criterion instead of being re-litigated.
- The ticket's task list names `upgrade` as a task; the binding design makes upgrade an install of a different artifact. That divergence is recorded explicitly (DEC-6) and traced, rather than silently dropped or silently implemented as a second verb.
- Where a decision record and the install model document disagree, the rule is stated once (DEC-8): the record wins on **surface**, the model keeps its **mechanics**, and the model is corrected in this change.
- The conformance and documentation obligations are declared as contracts (F-15, F-16, §16) rather than left implicit, because the aggregate quality gate and the documentation-truth checks enforce them: a family cannot be reachable without its help entry, its page, its inventory row, its page-root branch, and its error rows.
- Scope discipline: this specification states behaviour, contracts, refusals, matrices, and acceptance only. Internal structure, module boundaries, and the exact phrasing of operator output beyond the declared content belong to the plan and the delivery.
- Judgement calls that the decision records deliberately left to the specification are recorded as decisions with their rationale (DEC-9 enumeration cap, DEC-10 unreadable-header outcome, DEC-11 removal-path daemon guard, DEC-12 schema identifiers and row set, DEC-13 record tolerance, DEC-14 AC reading), so a downstream reader can see which numbers and spellings were chosen here and why.
- The six-clause reading of the ticket's acceptance paragraph is recorded (DEC-14) and traced in §17, so no ticket criterion can be lost by a counting convention.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (GH-346)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the pm-notes milestone verbatim ("M4: Jaiship-native delivery")
- [x] All sections present in order (1–25 plus authoring guidelines and this checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, AC-, RSK-, OQ-, DEC-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] Every ticket acceptance clause traces to at least one specification acceptance criterion (§17)
- [x] Every ticket task traces to a capability and at least one acceptance criterion (§17)
- [x] NFRs include measurable values
- [x] Risks include Impact, Probability, mitigation, and residual risk
- [x] Out-of-scope items are marked `[OUT]`
- [x] Every normative detail of TDR-0036 … TDR-0040 is present as behaviour (family and flags, token table, S-1…S-4, D-1…D-3, dispositions, verdict, record schema, seven steps, removal matrix, dry-runs, `--migrate` boundary, ownership split)
- [x] No `ados` or `delivery-os` namespace is introduced; the compatibility alias keeps its name and paths
- [x] No implementation task list, no commit instructions, and no code-level step-by-step guidance beyond the declared contracts and the conformance surfaces the quality gate enforces
- [x] Front matter validates per the front-matter rules
