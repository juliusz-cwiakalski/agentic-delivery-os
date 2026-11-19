---
ados_distribution: internal
id: SPEC-INSTALL-LIFECYCLE
status: Current
created: 2026-11-19
last_updated: 2026-11-19
owners: ["engineering"]
service: delivery-os
summary: "The installable product artifact and its composed `install` lifecycle (M4-S1): one Bun-compiled self-contained executable at `dist/<binary-name>` produced by the additive `build:binary` entry, a build-time-injected identity behind the preserved one-line `--version` contract with four exact tokens, and the compiled process edge that derives the detached re-entry path from the artifact's real path; the twenty-sixth prompt-required family `install` with `status`, `rollback`, `uninstall`, and `purge`, composed in both bins and owned by the primary identity only, with an admission predicate that refuses a linked worktree and a development run, one `install.record.v1` record written atomically, a seven-step atomic replace with an artifact-content agreement no-op and in-place record reconciliation, a single compiled-artifact rollback slot with the pair-inversion precondition and its two declared limits, an advisory-on-write and typed-on-report state-format check, the removal matrix with the always-printed residual set, four zero-write dry-runs that report the daemon `unchecked`, the delimited opt-in PATH block, the migration refusal, the before-swap daemon guard that no dry-run evaluates, the guarded shell launcher step, and eleven `install` error rows."
links:
  related_changes: ["GH-346", "GH-320", "GH-242"]
  related_decisions: ["TDR-0044", "TDR-0045", "TDR-0046", "TDR-0047", "TDR-0048"]
  contracts:
    - "scripts/build-binary.ts"
    - "packages/cli/src/build-identity.ts"
    - "packages/core/src/contracts/install.ts"
    - "packages/core/src/domain/install-admission.ts"
    - "packages/core/src/domain/install-record.ts"
    - "packages/core/src/domain/install-replace.ts"
    - "packages/core/src/domain/install-compatibility.ts"
    - "packages/core/src/domain/install-removal.ts"
    - "packages/core/src/domain/install-path-block.ts"
    - "packages/core/src/domain/install-migration.ts"
    - "packages/core/src/domain/install-status.ts"
    - "packages/adapters/src/file/install-destination.ts"
    - "packages/adapters/src/file/install-record.ts"
    - "packages/adapters/src/file/install-profile.ts"
    - "packages/adapters/src/file/install-state-roots.ts"
    - "packages/cli/src/commands/install.ts"
    - "packages/cli/src/output/install-text.ts"
---

# Feature: Installable Artifact and Install Lifecycle

> **Role of this Document:** Source of truth for the delivered product artifact and the `install` command family (M4-S1). It covers the build entry, the injected identity and the `--version` token contract, the compiled process edge, the family's five entry points and flags, the admission and development-build gates, the install record, the atomic replace with its artifact-agreement no-op, rollback and upgrade, the state-format compatibility check, removal and dry-runs, the managed `PATH` block, the migration hook, the daemon guard, the ownership split with the shell installers, and the eleven error rows. Requirements live in the GH-346 change artifacts; this page describes current behavior. The process surface that composes the family is [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md), the error contract is [Result Contract and Error Table](feature-result-contract.md), the compatibility anchor is [State Layer](feature-state-layer.md), and the operator narrative is the [Local Install guide](../../guides/local-install.md).

## 1. Overview

The installed product is one self-contained executable. The additive `build:binary` entry compiles the primary bin into `dist/<binary-name>` and injects a build identity — lockstep version, full commit, ISO-8601 UTC build instant, dirty flag over tracked files, and the reserved `dev` channel — as one compile-time constant. The artifact answers `--version`, `--help`, and `--print-install-path` from itself alone: it reads no state, git, configuration, or network, and needs no runtime, source tree, or workspace dependency present.

The installed artifact carries its own lifecycle. `install` is the twenty-sixth prompt-required family, composed in both executables for exact family parity and owned by the primary identity only:

| Invocation | Purpose | Outcome |
|---|---|---|
| `<binary> install` | Install or upgrade from the running compiled artifact | `0` on a completed install or an artifact-agreement no-op; `1` on a declared refusal |
| `<binary> install status` | Read-only report of the running identity, the recorded install, the record and slot conditions, target stability, the state-format verdict, and the managed `PATH` block | `0`, or `1` with `install.state.incompatible` when a judged root is not accepted |
| `<binary> install rollback` | Swap the destination and the single rollback slot, then update the record | `0`, or `1` on `install.slot.absent`, `install.slot.invalid`, or `install.record.unreadable` |
| `<binary> install uninstall` | Remove the artifact, the slot, the record, and the managed `PATH` block; always print the purge residual set | `0`, including a second no-op run |
| `<binary> install purge` | Additionally remove the configuration and state roots | `1` with `install.purge.unconfirmed` without `--yes`; `0` with it, including "nothing to remove" |

Upgrade is not a verb: it is an install of a different compiled artifact, so the identity on disk is exactly the identity that was executed. Nothing downloads, nothing builds, and no network client is composed.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** A local install that registers a launcher pointing into a checkout requires the runtime and a source file at an absolute path inside a directory that can be deleted. Such an install cannot say which build it is, cannot report compatibility with the state on disk, cannot go back one step, and cannot be removed by the product.
- **Affected Users:** The operator who installs, upgrades, and removes the tool; the agent team that delivers through the installed command; support, which must reconstruct which build produced an artifact.
- **Business Impact:** Without a self-contained artifact and a lifecycle, every delivery run is attributable to a mutable checkout, a worktree deletion silently breaks the installed command, and the later milestone stories (namespace migration, prompt rewrite, wrappers) have no surface to call.

### 2.2 Goals & Success Metrics

- **Primary Goal:** The installed command is a versioned, self-contained product artifact whose install, upgrade, rollback, and removal are one composed, typed, reversible lifecycle.
- **KPIs:**
  - Self-containment: `--version`, `--help`, and one composed command succeed from an empty directory with a scrubbed `PATH` and no checkout: 3/3.
  - Identity truth: the four declared token situations resolve exactly: 4/4.
  - Read-free self-description: 0 state, git, configuration, and network reads and 0 writes on `--version`, `--help`, and `--print-install-path`.
  - Prompt-required families: exactly 26, identical in content and order in both bins.
  - Lifecycle entry points reachable through the composed program: 5/5.
  - Writes performed by a refused install: 0.
  - Crash points that leave a runnable artifact at a known path: 7/7 replace steps.
  - Bytes rewritten by re-installing the identical artifact: 0 artifact bytes and 0 destination renames.
  - Residual-set equality between `uninstall` and `purge`: exact, path for path.
  - Dry-runs that write anything: 0 of 4.

## 3. Capabilities

### 3.1 The artifact and its build entry

`bun run build:binary` (`scripts/build-binary.ts`, registered at the workspace root as `build:binary`) compiles the primary bin with the pinned Bun toolchain into one executable at `dist/<binary-name>` under the repository root, a product output that version control ignores. `--out <directory>` redirects the output. The entry is repo-internal: it is not a member of the delivered script or tool install arrays, it produces no compatibility-named executable, and the existing package build (`build`) is unchanged and continues to serve library consumers.

The build captures its facts, invokes the compiler once, and fails loudly when the output is missing or not executable. It needs no clean tree and mutates no tracked file. Three limits are declared rather than hidden:

| Limit | Statement |
|---|---|
| Size | The measured unminified artifact is on the order of 107 MB; no minification, stripping, or per-command tree-shaking is performed |
| Target | The artifact targets the host operating system and architecture it was built on; there is no cross-compilation and no per-platform artifact matrix |
| Reproducibility | The injected build instant changes on every build, so two builds of one commit report the same identity and hold different bytes; no output or document claims reproducibility |

### 3.2 Build identity and the `--version` contract

The identity is captured at build time and injected as one compile-time constant behind a presence guard: the lockstep version from the root manifest, the full commit, the build instant as an ISO-8601 UTC timestamp, a dirty flag computed over tracked files only, and a reserved channel field whose only value this increment defines is `dev`. The artifact name is derived from the declared primary identity at exactly one declared build-side site (`scripts/build-binary.ts`), which is registered in the identity-literal inventory; no identity literal enters a handler, a composer, or a library module.

`--version` keeps exactly `<binary-name> <version> (build <token>)` on one line at exit `0`:

| Situation | Token |
|---|---|
| Compiled from a clean tracked tree | the short commit (seven characters) |
| Compiled from a dirty tracked tree | `<short commit>-dirty` |
| Compiled with no git metadata | `unknown` |
| Not compiled (workspace run, tests, embedder) | `dev`, with version `0.0.0` |

No field is appended, no second line is printed, `--version --json` is byte-identical to `--version`, and the alias produces byte-identical output for the same injected identity modulo its own binary name. The build instant never appears in that line: it changes on every build and is not an operator-facing identity. The full identity is served only by `install status --json`. No runtime path derives an identity field from the manifest, git, file timestamps, or the environment; a run without an injected identity keeps `0.0.0` and `dev` verbatim.

### 3.3 The compiled process edge

A compiled artifact presents the runtime name and a virtual bundle path as its first two arguments, so the delivered argument slice still yields exactly the user arguments and every family, subcommand, positional, and global flag behaves as it does in a source run. The bin supplies the artifact's own real executable path as the detached re-entry entry path and as the installed service unit's executable when it runs as a compiled artifact, and the delivered script path otherwise; no value containing the bundle's virtual root is ever handed to a spawn or a unit. `--print-install-path` is unchanged, read-free, and answers the effective identity's brand install path, so the installer's existing probe of that self-description keeps working against the compiled artifact.

### 3.4 The family, its flags, and the owning role

`install` joins `PROMPT_REQUIRED_COMMANDS` as the twenty-sixth family, appended after `supervise`, and the production composer registers it unconditionally with its runtime: the home directory, the process facts, the file-system port, the clock, the daemon status read and stop path, and the delivered worktree-topology read. Root help lists the family, and each of the five entry points resolves its own help from the static inventory with usage, options, examples, exit codes, and a see-also pointer.

`rollback`, `uninstall`, and `purge` are subcommands rather than flags: a mode flag on a default-destructive verb is one typo from an unintended removal, and each destructive form needs its own help, exit codes, and dry-run.

| Flag | Applies to | Meaning |
|---|---|---|
| `--add-to-path` | `install` | Append exactly one delimited `PATH` block to one profile and record its file and marker |
| `--shell-profile <path>` | `install` | Select the profile explicitly; always wins over the declared shell mapping |
| `--migrate` | `install` | Accept the migration hook and answer the typed delegation refusal; no other entry point accepts it |
| `--dry-run` | `install`, `install rollback`, `install uninstall`, `install purge` | Print the complete plan and write nothing |
| `--stop-daemon` | every artifact-replacing or artifact-removing path | Stop a live daemon through the delivered stop path before the swap or removal |
| `--yes` | `install purge` | The explicit confirmation input |

Global flags `--json`, `--verbose`, and `--pretty` behave as on every other family. The destination is derived from the read-free self-description and is never an input: a destination flag or a positional path is the delivered `fallback.invocation` grammar refusal at exit `1`, and no flag, argument, or environment value can redirect it away from the brand install path.

Two failure classes stay distinct. A **missing runtime** is a composition gap contained as `fallback.internal` at exit `2`; the family is never dropped and a partial surface never answers. A **data** condition — no git metadata, an absent record, no daemon instance, a damaged record — is answered by the handler as a typed outcome or a declared refusal.

The family is composed for both identities because family parity is exact. The primary bin declares one boolean owning-role fact; the compatibility alias declares none, and an absent fact means **not owning**. A lifecycle invocation on the alias answers exactly one `install.identity.not-owning` line at exit `1` naming the invoked identity (the alias's own resolved binary name), stating that installation is owned by the primary identity, and giving the documented remedy — run the operation through the installed product binary. It writes nothing and creates no path under its own namespace, and no owner-name derivation and no new identity literal are introduced. The alias therefore advertises the family with its restriction; every other alias command is exactly as delivered.

### 3.5 The install target, admission, and the development-build gate

The **install target** is the running artifact together with the git checkout it resolves to; the **destination** is the brand install path returned by the read-free self-description; the **recorded provenance** is what the record keeps about the target (checkout path, commit, dirty flag, verification state); the **executed path** is any path the product persists for later execution. One admission predicate governs all of them:

| Rule | Predicate | Outcome |
|---|---|---|
| Linked worktree | The checkout's own git directory and its common git directory, both absolute, differ | Refuse `install.target.worktree`, exit `1` |
| Unreadable git | Either read fails (git absent, not a repository, command error) | Admit; provenance `unverified` |
| Stable checkout | Both reads succeed and are equal | Admit; provenance `verified` |
| Destination | The destination equals the brand install path | Cannot fail by operator action, because the destination is not an input |

Detection is repository metadata, never a string comparison: no path-prefix test, no reliance on worktree-listing order, and no assumption that the primary checkout sorts first. The target directory is the artifact's own directory, so an artifact anywhere inside a checkout is detected through the repository's own resolution. The refusal names the target directory, the worktree's git directory, and the common git directory, and states the two admissible origins plus the reason a lane worktree is refused: it is deleted after merge, so an install that pointed into it would work until the merge and then break. Nothing is written before the refusal — no staging, no record, no `PATH` line — and the destination's bytes and modification time are unchanged.

The dirty flag of the target's checkout is never an admission question. The rule is about *where* the target lives, never about its working-tree state: a dirty tree is admitted and its token is `<short commit>-dirty`.

An install requires a running artifact that carries an injected build identity. A development run — the delivered fallback identity — is refused with `install.dev-build` at exit `1`, naming the build entry and the `dist/<binary-name>` convention, because a workspace run has no stable identity, can be edited mid-run, and cannot be recorded truthfully. This is the identity half of the same stability rule. The install never invokes a build tool, a package manager, or a network client, and that absence is asserted statically over the composition. The gate is scoped to the write paths: `install status` is a report and is not refused by it.

### 3.6 The install record

One record lives at `<config root>/install.json` — beside the operator's configuration and never inside a state root — under its own schema identifier `install.record.v1`. It has one writer and one atomicity rule: it is written at step 7 of a replacing install, at a rollback, and at the step-4 reconciliation, always staged-and-renamed, never partially, and never containing a credential. The record repeats the artifact's identity fields at install time, so "installed versus running" is a comparison of two records rather than a computation.

| Field | Meaning |
|---|---|
| `schemaVersion` | `install.record.v1` |
| `version`, `commit`, `builtAt`, `dirty`, `channel` | The installed artifact's injected identity |
| `stateSchemaVersion` | The store-format identifier the artifact accepts |
| `sourceCheckout` | The checkout the artifact's identity was built from; absent when the build had no git metadata |
| `provenance` | `verified` or `unverified` |
| `installedAt` | When this record was written |
| `previous` | The slot's identity; absent when the slot is empty, and absent — reported unknown, never guessed — when no readable record names its occupant |
| `launcherDisposition`, `launcherDetail` | `none`, `launcher-discarded`, or `symlink-replaced`, with the reported detail |
| `pathBlock` | The profile file and block marker; absent when no block was appended |

`previous` is swapped on **every replacing** install, not only when the identity differs; a no-op install swaps nothing, because the slot already holds the previous install. Every consumer tolerates a damaged or absent record without throwing: `install uninstall` still removes the artifact paths and reports the `PATH` block as unknown rather than guessed; `install` brings a damaged or stale record back to `current` after a successful replace and also by reconciling it in place on an artifact-agreement run; `install rollback` refuses typedly and writes nothing. The record is never a gate, only a repair source.

### 3.7 The seven-step replace, artifact agreement, rollback, and upgrade

The replace is seven normative steps with one invariant: at every instant at least one runnable artifact exists at a known path.

| Step | Action | Failure consequence |
|---|---|---|
| 1 | Admission, the identity gate, the daemon guard, and the read-only compatibility pre-flight | Nothing written; typed exit |
| 2 | Stage the running artifact's bytes into a temporary file in the install directory, on the same file system | Destination and record untouched; temporary file removed |
| 3 | Verify the staged file: exists, non-empty, executable, and content-equal to the running artifact | Destination and record untouched; temporary file removed |
| 4 | Artifact-agreement gate and record reconciliation: read the destination; when it is a regular, non-empty, executable compiled artifact whose content equals the running artifact, stop here | On the agreement path the destination and slot are untouched; a reconciliation that cannot write leaves the record stale, is reported, and costs nothing else |
| 5 | Rename the destination into the slot, only when the destination is a regular compiled artifact whose content differs | Destination gone and slot holds the previous artifact: recoverable by re-running install; a launcher or a symlink leaves the existing slot unchanged |
| 6 | Rename the staged file to the destination | Destination present again, slot intact |
| 7 | Write the record, staged and renamed | Destination and slot both valid; the record is stale until the next install, and `install status` reports `record-stale` |

Step 4's gate is a read of the destination, so an agreement run evaluates steps 1 and 4 only: no staging file, no destination rename, no slot swap, no daemon action, and no step-7 write. Identity is deliberately not the test and cannot be: an artifact's injected identity is a compile-time constant inside the binary, so no process can read it back out of a file without executing it. Content agreement is the only read-only proof that the destination *is* the running artifact; identity equality follows from it and needs no record. Only the window between steps 5 and 6 has no destination, and in that window the slot holds a runnable artifact at a known path: a step-5 crash is recovered by re-running install, which skips step 5 because the destination is absent and therefore keeps the slot; a step-7 crash is recovered by an agreement run that performs no destination rename, so the rollback step survives. No step writes bytes in place at the destination, and no cross-device move is possible.

Destination dispositions are decided by content agreement and never by the record:

| Found at the destination | Disposition |
|---|---|
| Content equals the running artifact; record `current` | Left as it is; nothing is written |
| Content equals the running artifact; record `record-stale`, damaged, or absent | Left as it is; the record is reconciled in place — `current` = the running identity, `previous` = the predecessor the readable record named, absent and reported unknown otherwise |
| A differing regular compiled artifact | Becomes the rollback slot, only through the step-5 rename |
| A delivered bash launcher | Discarded with a report naming its recorded target, including when that target is missing or inside a worktree; never promoted, so the existing slot is unchanged |
| A symlink to another artifact | Replaced, never written through, and never promoted; the disposition names the link and its target, and the existing slot is unchanged |
| Nothing | Created |

**Upgrade** is running a different compiled artifact's `install`: the artifact installs itself, and both identities are reported — the previous one from the record and slot, the new one from the running artifact. `install status` and `--version` answer the same identity afterwards.

**Rollback** is `install rollback`: two renames in reverse order against the single slot, then the record update. It is involutive — a second rollback returns to the artifact installed before the first. Its refusals are evaluated in one declared order, the slot refusals first (`install.slot.absent`, then `install.slot.invalid`), then the record precondition, and the whole ordered set is evaluated before any daemon action and before any rename, so a refused rollback performs none and writes nothing. The record precondition is the **pair inversion**: the record must be readable and carry the two names the two renames move — the artifact at the destination in `current`, checked against the destination, and the slot's occupant in `previous`, checked for **presence** only. Every unmet precondition refuses with `install.record.unreadable`, writing nothing. There are **five causes**. Four are **missing-name** record conditions: an absent record, an unreadable record, a readable `current` naming no `previous` while a slot is present, and the post-crash pair, whose `current` names the artifact step 5 moved into the slot rather than the one at the destination. The fifth is a **destination-shape** cause, not a record condition: the destination is not a compiled artifact at all — a delivered launcher, a symlink, or a foreign file — so the pair the swap inverts does not exist on disk, and the run refuses before the daemon gate and any rename instead of displacing that object into the slot. Two declared limits follow:

- A **wrong** `previous` name is taken at its word. No slot digest is stored, so the run cannot compare that name; it proceeds, writes the claimed name **verbatim** in `current` with the displaced destination in `previous`, and reports exactly those two recorded identities. The artifact now at the destination may differ from the recorded claim, which is the limit itself, and the claim is checkable against `install status`.
- **The pair inversion compares the record with what is on disk, never with the running identity.** A candidate-artifact invocation is reported `record-stale` by `install status` and still proceeds; the post-crash record is `record-stale` and refuses, because the pair it names is not the pair the swap inverts.

`recordState` is the other comparison: the record against the **running** identity, which is the only identity a process can know. The two comparisons diverge without either being wrong, and neither widens the other.

### 3.8 The state-format compatibility check

The check compares exactly two already-delivered values: the artifact's accepted store-format identifier — the delivered constant, no new constant — and each enumerated state root's ledger header's declared format identifier. The comparison is equality, not ordering: the identifier is opaque, and the check never infers that a different value is newer, older, or compatible. Each root is judged independently, so a machine with one compatible and one incompatible project reports both.

Enumeration covers the effective host root — the declared state-directory override when set, otherwise the brand default — judged alongside each first-level project directory under it; nothing below a project directory is visited, no manifest is discovered, and the repository is never walked. A declared cap of 128 judged roots bounds it, and exceeding the cap marks the verdict truncated and reports how many roots were judged. The per-root outcomes are `accepted`, `not-accepted`, `unreadable`, and `unchecked`; an absent root is `unchecked`, never `accepted`, and an unreadable header is reported as data at exit `0` rather than as `not-accepted`, because a read that could not complete is not evidence of incompatibility.

| Surface | Verdict |
|---|---|
| `install`, `install rollback` | Advisory: one line per not-accepted root, never an exit-code change and never a block, because the remedy for a mismatch is a different artifact and the install surface must remain able to install it |
| `install status` | The typed verdict `install.state.incompatible` at exit `1`, naming the root, the observed identifier, the accepted identifier, and the judged count; the machine payload carries the same facts |

Nothing is persisted by the check — no header write, no marker, no manifest — and its only persistence is one record field stating the identifier the installed artifact accepts. The delivered `state.schema.mismatch` hard gate keeps its identity, its `platform-provider` projection, and its remedy, and the new check never pre-empts, shadows, or re-words it. `--version`, `--help`, `--print-install-path`, and every other command gain no state read.

### 3.9 Removal and dry-runs

| Path | `uninstall` | `purge` |
|---|---|---|
| The installed artifact | removed | removed |
| The rollback slot | removed | removed |
| The install record | removed | removed |
| The managed `PATH` block | removed | removed |
| The configuration root | **kept** | removed |
| The state root (host root and every project root) | **kept** | removed |

`uninstall` **always** prints the residual set — the absolute paths that exist at that moment under the configuration and state roots — as exactly what `purge` would additionally delete, whether or not a dry-run was requested. `purge` requires `--yes`; without it the run refuses with `install.purge.unconfirmed` at exit `1`, names both roots and the flag, and removes nothing. Confirmation is required even when the roots are absent: the answer is then "nothing to remove", reported at exit `0`. Removal order is artifact, slot, record, `PATH` block, then the roots, so a partial failure leaves the recoverable members in place. An absent member is reported as absent: a second `uninstall` removes nothing, reports every member as absent, prints the same residual set, and exits `0`, and a damaged record makes the block `unknown` rather than guessed.

Each of the four write paths accepts `--dry-run`, which prints the complete plan with absolute paths, one line per path, and performs no write, no directory creation, and no daemon read or action:

| Command | Plan content |
|---|---|
| `install --dry-run` | Running identity and artifact path; destination; whether the destination's content is this artifact, so the run would stop at step 4, and whether — and from which condition — the record would be reconciled, with the `previous` it would record or that it is unknown; otherwise the disposition of what is found there; whether the slot would be swapped; the record path; the profile file and block text only with `--add-to-path`; detected prior-namespace artifacts; the state-format advisories; the daemon disposition `unchecked`, with the line that a dry-run neither reads nor stops the daemon |
| `install rollback --dry-run` | When the pair-inversion precondition is met, those two identities, the two renames in order, and the record update — producible for a candidate-artifact invocation whose record names the pair; when it is unmet, the refusal identity, its cause, and the remedy in place of a plan at exit `0` |
| `install uninstall --dry-run` | The removal list and, in a separated block, the residual set it would report |
| `install purge --dry-run` | The removal list including both roots and every enumerated project root |

A dry-run never claims that an artifact or a block exists; it states what it would do. The non-daemon gates a real run evaluates are read-only, so a dry-run evaluates them too and answers the same registered refusal at its own exit digit when one fires, still writing nothing: `install` evaluates the identity, admission, and shell-profile gates; a rollback dry-run evaluates the slot refusals and the record precondition. The daemon guard is never evaluated on a dry-run of any of the four paths: a dry-run is decided before the guard, so it neither reads nor stops the daemon, answers no `install.daemon.running` refusal, and reports the disposition as `daemon: unchecked` — a dry-run neither reads nor stops the daemon; a real run refuses a live holder unless `--stop-daemon` and otherwise stops it before the swap or removal. Two cases are reported instead of refused: an unmet rollback record precondition is printed as the refusal identity, its cause, and its remedy in place of a plan at exit `0`, while the slot refusals still refuse; and `install purge` requires no confirmation for a dry-run.

### 3.10 The managed `PATH` block

By default the product writes no profile file. `--add-to-path` appends exactly one delimited block to one profile: a start marker and an end marker derived from the declared binary name, and between them exactly the one export line that puts the install directory first. File selection is `--shell-profile <path>` when given, otherwise the declared mapping of the operator's shell — `zsh` selects `~/.zshrc`, `bash` selects `~/.bashrc`, `sh` selects `~/.profile` — with the leading home marker expanded against the invoking home. An unidentifiable shell with no explicit path is `install.shell-profile.unresolved` at exit `1`, and no profile is written.

An identical block is not re-appended; a block with different content at the same markers is replaced in place and never duplicated. The block's file and marker are recorded in the install record, so a later install or removal finds it even if the operator edited the profile, and `install uninstall` and `install purge` remove exactly that block and nothing else. There is no standalone "remove the block but keep the install" verb.

### 3.11 The migration hook

Without `--migrate`, `install` detects prior-namespace artifacts and prints one advisory line naming them and the operator's documented manual move; it never moves, copies, or deletes them. With `--migrate`, `install` accepts the hook and answers `install.migration.unavailable` at exit `1`, stating that migration is not available in this build, naming M4-S2 as its owner, and giving a remedy that points at the documented manual move. No migration port is composed, so the flag cannot silently no-op. A dry-run with `--migrate` prints the same detection list and states that nothing would be migrated. No other lifecycle entry point accepts the flag.

### 3.12 The daemon guard

`install`, `install rollback`, `install uninstall`, and `install purge` each refuse a live daemon holder with `install.daemon.running` at exit `1`, naming the holder and the remedy, and write nothing. With `--stop-daemon`, the daemon is stopped through the delivered stop path **before** the swap or removal, so no delivery path ever observes two builds. A refused rollback performs no daemon action at all, because the ordered refusal set runs before the stop. The guard belongs to the four real runs only: a `--dry-run` of any of the four paths is decided before the guard, so it neither reads nor stops the daemon, never answers `install.daemon.running`, and reports the disposition as `unchecked`.

### 3.13 The ownership split with the shell installers

One owner per artifact class.

- **The lifecycle family owns the binary.** The artifact, the rollback slot, the install record, and the managed `PATH` block belong to `install`, `install status`, `install rollback`, `install uninstall`, and `install purge`.
- **The shell installers own repository artifacts.** `scripts/install.sh` copies the redistributable docs, delivery scripts, delivery tools, templates, and the plugin projection, and keeps its launcher step for the legacy launcher. One predicate governs that step: **anything present at the brand install path that is not the delivered launcher — the artifact, the slot, or any other content — is a managed or foreign artifact**, and detection is by what is at the path, never by the install record. With nothing but the delivered launcher (or nothing at all) there, the step behaves exactly as delivered: same target, content-idempotent, the two classified failures, the plan-only dry-run preview, and independence from the tool selection. With anything else there — under a `current` record, a `record-stale` record, or a deleted or damaged record — it refuses, classified, names `install` as the update path, writes no launcher, and leaves the content byte-untouched.
- **`scripts/uninstall.sh` removes repository artifacts only.** It removes no binary, slot, record, or product root, keeps its own `0/2/3/4/5` exit taxonomy and its dry-run behaviour, and where a managed install is detected it reports it and names `install uninstall` as the owning removal command. Its detection source is the product's read-free `--print-install-path` self-description invoked with the working-name override scrubbed from the child environment; when no binary is reachable it reports no managed install without an error and guesses no path.

Neither surface deletes the other's artifacts, and each names the other when the operator is looking in the wrong place.

### 3.14 Declared conformance surface and error rows

The family places `install` in the prompt-required set as its twenty-sixth member, appended after `supervise` and followed by `loop`, with every pinned family count and family-tail position in the structural and behavioural suites; the root, family, and subcommand help entries; the reference page at `doc/planning/oss-tooling/milestones/m4/commands/install.md` containing both `--help` and `--version`; the help-coverage page-root branch placing that page in the M4 directory, because the default M1 root must not serve a new family; the help-guide coverage inventory in both directions; one `install` error domain kind with its eleven rows, documented on the [result contract](feature-result-contract.md), with the closed two-segment allowlist at 66 declared identities and the declared table total at 164 machine identities; and one declared build-side identity-literal site with the product-surface inventory unchanged at five sites ([Branding Seam](feature-branding-seam.md)).

The eleven rows are all category `user`, non-retryable, consequence `not_landed`, projection `user-validation` (exit `1`):

| Identity | Trigger |
|---|---|
| `install.target.worktree` | The install target resolves inside a linked git worktree |
| `install.dev-build` | The running artifact carries no injected identity |
| `install.state.incompatible` | `install status` judged a state root whose header identifier is not accepted |
| `install.identity.not-owning` | A lifecycle entry point ran on an identity that does not own installation |
| `install.shell-profile.unresolved` | `--add-to-path` without `--shell-profile` and with no identifiable shell |
| `install.migration.unavailable` | `--migrate` was supplied; migration is not available in this build |
| `install.daemon.running` | A live daemon holds the artifact and `--stop-daemon` was not given |
| `install.record.unreadable` | The rollback precondition is unmet: the install record does not name the pair the rollback swap inverts, or the destination is not a compiled artifact |
| `install.slot.absent` | Rollback found no rollback slot |
| `install.slot.invalid` | Rollback found a slot that is not a compiled artifact or is unreadable |
| `install.purge.unconfirmed` | `install purge` ran without `--yes` |

`install.dev-build` is the only kind-first two-segment identity and therefore the only addition to the closed two-segment allowlist. Grammar refusals, an unknown subcommand, and a destination argument reuse the delivered `fallback.invocation`; no `install.*` family or wildcard exists.

## 4. Contract Data and Interfaces

### 4.1 The `install.status.v1` payload

| Group | Content |
|---|---|
| `running` | `version`, `commit` (full), `builtAt`, `dirty`, `channel`, `artifactPath` |
| `installed` | The record's identity fields, or `null` when the record is not readable |
| `recordState` | `current`, `record-stale`, `unreadable`, or `absent` — the record against the **running** identity |
| `recordPath` | `<config root>/install.json` |
| `rollback` | The slot `path`, its `state` (`present`, `absent`, `invalid`), and its `identity` when knowable |
| `targetStability` | `verified`, `unverified`, or `linked-worktree`, reported as data and never as a refusal on this surface |
| `stateFormat` | The accepted identifier; per-root entries with root, observed identifier, outcome, and reason; the judged count; the truncation flag |
| `pathBlock` | The profile file and block marker, or `null` |

Field order and content are deterministic for a given machine state; nothing depends on directory iteration order.

### 4.2 Outcomes and exits

| Outcome kind | Meaning |
|---|---|
| `installed` | A replacing install completed |
| `unchanged` | An artifact-agreement no-op, with its reconciliation report when the record was reconciled |
| `rolled-back` | A rollback completed |
| `uninstalled` | The removal matrix minus the roots completed |
| `purged` | The removal matrix including both roots completed |
| `plan` | A dry-run plan |

The closed `daemon` disposition on every outcome is `absent`, `running`, `stopped`, or `unchecked`: a real run reports `absent` or `stopped`, a dry-run reports `unchecked`, and `running` is admitted by the type but is never a reported outcome because a live holder either refuses with `install.daemon.running` or is stopped under `--stop-daemon`. `unchecked` states exactly that the daemon was neither read nor stopped; it is never a guess at the daemon's state.

Exit `0` covers each completed operation and each producible plan; `1` covers every declared refusal and grammar refusal; `2` covers a containment or platform failure. The exit digit is produced only by the delivered projection module.

## 5. Boundaries

- **No namespace migration.** `--migrate` is accepted and refused typedly; moving, copying, backing up, or converting configuration, state, or artifacts belongs to M4-S2.
- **No release channel.** No package registry, release asset naming, checksum manifest, signature verification, download-based upgrade, auto-update, or publishing pipeline.
- **No network and no build inside the lifecycle.** The artifact requires the pinned toolchain and `git` at build time only; at install time only the delivered git read is used, and a host without `git` is admitted and recorded `unverified`.
- **No configurable destination.** No flag, argument, or environment override redirects the install path.
- **No multi-user or system-wide install.** No `sudo`, no shared prefix, and no writes outside the operator's home and the one operator-owned profile file an operator explicitly asks to manage.
- **No second artifact path.** No minification, stripping, per-command tree-shaking, cross-compilation, or architecture selector.
- **No per-domain version comparison.** The compatibility check compares one store-format identifier and nothing else.
- **No rollback depth beyond one step**, no retention policy, and no versioned artifact directories.
- **No hard-link disposition rule.** The atomic replace overwrites the directory entry regardless, so the destination is stable, but a hard link cannot be detected portably from the link side.
- **No daemon-pinning policy.** Whether a daemon must always run the installed artifact belongs to M4-S3; this feature keeps the re-entry path correct and refuses to replace or remove the artifact under a live daemon without `--stop-daemon`.
- **No `doctor`-style preflight absorbing `install status`** and no content estimates before a purge confirmation.
- **The hook is reserved, not implemented.** Only `dev` is defined as a build-channel value; the field exists so a release build can be distinguished later without a schema change.

## 6. Testing

| Level | Scope | Suites |
|---|---|---|
| Behaviour | The composed family and its refusals, admission and the dev-build gate, the destination dispositions, agreement, upgrade and the involutive rollback, the record's shape and tolerance, the record precondition, the compatibility verdict, the seven-step crash matrix, and the daemon guard | `tests/behaviour/install-family-surface.test.ts`, `install-admission.test.ts`, `install-replace.test.ts`, `install-record.test.ts`, `install-compatibility.test.ts`, `install-crash-matrix.test.ts` |
| Checks | The four zero-write dry-runs, removal and the residual set, the `PATH` block and the migration hook, the daemon guard on the four real runs and `unchecked` on the four dry-runs, the error domain's source rows, the conformance surface and its mutants, one real-artifact end-to-end arm, and the documentation page | `tests/checks/install-lifecycle-dryrun.test.ts`, `install-lifecycle-removal.test.ts`, `install-lifecycle-path.test.ts`, `install-lifecycle-daemon.test.ts`, `install-lifecycle-e2e.test.ts`, `install-error-domain.test.ts`, `install-conformance-mutants.test.ts`, `install-lifecycle-docs.test.ts` |
| Artifact | Self-containment, the four identity tokens, the two-build comparison, the argument slice, the re-entry path, and the install-path authority, one cached build per run into a scratch output directory | `tests/checks/artifact-self-containment.test.ts`, `artifact-identity.test.ts`, `artifact-grammar.test.ts` |
| Structure | The additive build entry and its single declared build-side literal site, the family's composition absence of network and build spawns, the prompt-required membership and every pinned count, the reference page and page-root mapping, and the ownership split | `tests/structure/build-artifact-entry.test.ts`, `install-composition-absence.test.ts`, `install-conformance.test.ts`, `install-launcher.test.ts`, `install-ownership-split.test.ts` |
| Shell | The installer's preserved launcher behaviour, its classified refusal on the content predicate in three record conditions, and the uninstaller's reporting arm | `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh`, `tests/checks/install-launcher-installer.test.ts` |

The replace is proven by injecting a failure at each of the seven steps: a runnable artifact exists at a known path after every failure, no staged file remains at the destination, and a re-run restores a complete install. A refused install is proven three ways — a registered identity, an unchanged destination in bytes and modification time, and no record, no staging file, and no profile line — and a refused alias invocation additionally proves that no path under the alias's namespace was created. No suite times a lifecycle command or asserts an artifact-size threshold; the size is reported, not gated.

## 7. Operational Notes

- **Cadence:** build a release, install it, deliver iterations through the installed binary, decide, re-install. Going back one step is a rollback; a rebuild of the same commit is a different artifact (a different build instant) and therefore an upgrade, not a no-op.
- **Observability.** Every lifecycle operation reports its decisions as operator-facing lines: the admission outcome with its provenance, the destination disposition, the artifact-agreement outcome including whether and from which condition the record was reconciled and what `previous` it recorded or that it is unknown, the slot identity, the record path, the compatibility advisories, and the migration advisories. A refused operation reports the identity, the offending facts, and the remedy. A crash between the destination renames and the record write is visible as `record-stale` in `install status` rather than as an unexplained mismatch.
- **Support.** The installed build is identifiable from one line (`--version`) and from one command (`install status`), and the identity object is what the record and the status payload carry, so "what is installed", "what is running", and "what is in the slot" can be compared without inspecting binaries.
- **No telemetry.** No metric, span, ledger event, telemetry record, or store write is added; the compatibility verdict is computed and reported, never cached.

## 8. Glossary

| Term | Meaning |
|---|---|
| Artifact | The self-contained executable at `dist/<binary-name>` built by `build:binary` |
| Install target | The running artifact together with the git checkout it resolves to |
| Destination | The brand install path derived from the read-free self-description |
| Rollback slot | The single file beside the destination, `<binary name>.previous`, holding the previous compiled artifact |
| Install record | `<config root>/install.json` under `install.record.v1` |
| Provenance | `verified` when both git-directory reads succeed and agree; `unverified` otherwise |
| Artifact agreement | Content equality between the destination and the running artifact, the only read-only proof that the destination is the running artifact |
| Residual set | The absolute paths under the configuration and state roots that exist at the moment of an uninstall, printed as what purge would additionally delete |
| Managed block | The single delimited `PATH` block the product owns in one operator profile file |

## 9. Related

- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the composition, the read-free self-description, the family count, and the owning-role fact.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the projection, and the eleven `install` rows.
- [State Layer](feature-state-layer.md) — the store-format identifier and the ledger header the compatibility check reads.
- [Branding Seam and Working Name](feature-branding-seam.md) — the identity literals, the product-surface inventory, and the build-side site.
- [Doc Distribution Marker](feature-doc-distribution-marker.md) — the install set and the conditional launcher step.
- [Local Install guide](../../guides/local-install.md) — the operator narrative for the whole cadence.
- [Install model](../../planning/oss-tooling/milestones/m4/install-model.md) — the milestone layout and mechanics.
- [Install reference page](../../planning/oss-tooling/milestones/m4/commands/install.md) — the command reference served by the help-coverage check.
- Design records: [TDR-0044](../../decisions/TDR-0044-install-lifecycle-composed-command-family.md), [TDR-0045](../../decisions/TDR-0045-self-contained-binary-build-identity.md), [TDR-0046](../../decisions/TDR-0046-install-target-stability-and-dev-build-exclusion.md), [TDR-0047](../../decisions/TDR-0047-installed-binary-state-format-compatibility-check.md), [TDR-0048](../../decisions/TDR-0048-upgrade-rollback-uninstall-purge-boundaries.md).
- **Change record:** `doc/changes/2026-11/2026-11-18--GH-346--installable-versioned-binary/`.
