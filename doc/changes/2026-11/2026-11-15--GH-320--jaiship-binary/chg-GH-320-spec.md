---
change:
  ref: GH-320
  type: feat
  status: Proposed
  slug: jaiship-binary
  title: "M4-S1a: jaiship executable binary and local install"
  version: "1.3"
  owners: ["engineering"]
  service: delivery-os
  milestone: "M4: Public release readiness"
  labels:
    - cli
    - entrypoint
    - branding
    - config
    - state
    - installer
    - compatibility
    - m4
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered branding seam (GH-171/GH-174): one pure resolver deriving the twelve values, `installPath` currently unconsumed"
      - "delivered executable entrypoint (GH-242): the non-installed Bun bin, working-name resolution, help/version self-description"
      - "delivered configuration layer (GH-173): seven ordered layers, `acquireFileConfig`, classified errors and skips"
      - "delivered state scope (GH-288): the one pure host-root policy and the per-checkout project root"
      - "delivered legacy compatibility adapter: `ADOS_*`/`.ados` mapping with one warning per process"
      - "delivered installer surface: `scripts/install.sh` with global and local modes and the delivery script/tool arrays"
    external:
      - "Bun runtime (the bin and the installed launcher execute the TypeScript entrypoint through Bun, and the local install requires it at install time; no network surface)"
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/320
  related_changes: ["GH-320", "GH-171", "GH-173", "GH-242", "GH-288", "GH-310"]
  related_decisions: ["ADR-0003", "TDR-0005", "TDR-0022"]
  contracts:
    - "CLI package bin manifest gains a second executable identity beside `delivery-os`"
    - "entrypoint identity selection: one declared default working name per bin plus an optional declared prior identity"
    - "entrypoint self-description gains the brand install-path read"
    - "configuration acquisition gains an optional prior-identity directory with per-layer candidate ordering"
    - "host-root policy gains prior-identity root selection over injected existence facts"
    - "prior-identity fallback notice: one classification token, four reasons, once per source per composed program"
    - "installer registers a user-level launcher at the brand install path"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make `jaiship` the primary executable name of the delivered CLI — a second native bin whose identity is `jaiship` while `delivery-os` keeps working unchanged — and give that identity a real local install posture (`~/.jaiship/bin/jaiship`) without orphaning the project configuration and host state created under the previous identity.

## 1. SUMMARY

The owner fixed the product name as `jaiship` on 2026-11-15. The public repository move has **not** happened, so this change delivers the first slice of the M4-S1 naming work only: the **executable name and its install posture**. Package scope, repository URLs, docs domain, and the wider rename stay untouched.

Concretely, the change delivers four things that only make sense together:

1. A native `jaiship` bin beside the existing `delivery-os` bin. Each bin is a declared identity selector; both stay thin over one shared launcher composition and one resolver, and `DELIVERY_OS_WORKING_NAME` remains the override seam for both.
2. A **prior-identity read fallback**: a `jaiship` invocation that finds no `.jaiship` project configuration or no `~/.jaiship-state` host root reads the `.delivery-os/config.yaml` / `~/.delivery-os-state` artifacts instead on the surfaces that acquire them, loudly and once, so nothing that already exists becomes invisible.
3. A classified **prior-identity fallback notice** that is distinct from the delivered pre-GH-288 store warning and from the `ADOS_`/`.ados` legacy notice, and that never changes an exit code or a machine payload.
4. A **user-level local install** that registers `~/.jaiship/bin/jaiship` as an executable launcher derived from `BrandIdentity.installPath`, working from outside the repository, with the delivery script/tool arrays and the `delivery-os` bin mapping unchanged.

The transitional cost is stated rather than hidden, as four declared divergences: MCP keeps its own `delivery-os` default, the shell fallback in the delivery scripts keeps the `delivery-os` host root, the installer keeps its own pre-freeze `~/.ados` / `ADOS_*` surface, and a `jaiship` working name still derives `https://github.com/delivery-os/jaiship` until the public move.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **One executable identity, one bin.** The CLI package maps exactly one bin (`delivery-os`) to one Bun entry file. The bin reads the environment once, takes a non-empty `DELIVERY_OS_WORKING_NAME` as the configured working name and otherwise the literal neutral name, then delegates to `runEntrypoint`; it never calls the command runtime directly and is absent from both installer arrays ([CLI Entrypoint](../../../spec/features/feature-cli-entrypoint.md)).
- **Identity resolution is a three-step chain.** Typed configured name → non-empty override → neutral `delivery-os` default. An invalid override or name falls back to the neutral default **for self-description only**, so `--help`/`--version` stay usable. A configuration-bearing command under an invalid override does **not** surface a classified resolver error: the configuration composer returns the resolver-level input error, the production composition throws it, and `runEntrypoint` converts the throw into the delivered containment identity `fallback.internal` at exit `2`, whose summary names the missing composition (`DELIVERY_OS_WORKING_NAME='bad/name' … status --json` → exit 2, `fallback.internal`, summary `command "status" is not part of the composed prompt-required set`). That projection is the delivered behaviour for **both** bins and this change keeps it ([CLI Entrypoint](../../../spec/features/feature-cli-entrypoint.md), [Branding Seam](../../../spec/features/feature-branding-seam.md)).
- **Every composed invocation already acquires project configuration.** The production composition resolves the daemon and lane settings over one read-only project-configuration acquisition at composition time, before any command handler runs, so `status --json` **does** read `<repo>/<configDirectoryName>/config.yaml` — traced as the acquisition of `/tmp/…/.delivery-os/config.yaml` for a `status --json` invocation in a fixture checkout. `statusComposition()` wiring an empty *provider* chain is a different fact: provider profiles are not resolved on `status`, but file configuration is. The acquisition's failure is swallowed to shipped defaults (`if (!acquired.ok) return resolveOver({}, {})`), so this change adds **no** acquisition to any command and changes no existing status observable ([CLI Entrypoint](../../../spec/features/feature-cli-entrypoint.md)).
- **The `config` command is not an executable surface.** `config` is not prompt-required: the entrypoint drops it from the composed program and `jaiship config --json` answers the containment identity (`fallback.internal`, exit 2, summary `command "config" is not part of the composed prompt-required set`). The configuration **inspection** program exists only as an in-process composition, so no acceptance criterion and no test may treat `… config --json` as a reachable CLI surface ([CLI Entrypoint](../../../spec/features/feature-cli-entrypoint.md)).
- **One resolver derives twelve values.** `workingName: "jaiship"` yields `binaryName` `jaiship`, `environmentPrefix` `JAISHIP_`, `configDirectoryName` `.jaiship`, `stateDirectoryName` `.jaiship-state`, `mcpToolPrefix` `jaiship_`, `installPath` `~/.jaiship/bin/jaiship`. `workingName: "delivery-os"` yields the corresponding `.delivery-os` values. `packageScope` and the scope org stay fixed at `@delivery-os` / `delivery-os`, so `repositoryUrl` and `docsBaseUrl` remain `delivery-os` URLs for either working name ([Branding Seam](../../../spec/features/feature-branding-seam.md)).
- **`installPath` has no consumer.** The resolver produces it; no installer, package surface, or release job reads it. The delivered regression suite pins that the working name enters at runtime-aware edges only, that no exported module-level string constant exists under `packages/**`, and that no `BrandIdentity` field is assigned a literal outside `branding`/`contracts`.
- **Configuration acquisition takes one directory name.** The file acquisition reads the four file layers with `configurationDirectoryName` as a single parameter; project-committed is `<repo>/<configDirectoryName>/config.yaml` and project-local is `<repo>/<configDirectoryName>/config.local.yaml`. There is no fallback directory, no second candidate, and no notion of a prior identity. Skips are first-match and ordered; a selected file occupies the project-committed slot and never redirects ([Configuration Layer](../../../spec/features/feature-config-layer.md)).
- **Host state is one pure rule.** The host root is an absolute `<PREFIX>_STATE_DIR` override, otherwise `<home>/<brand.stateDirectoryName>`; the project root is `<host root>/projects/<project key>` derived from the checkout identity marker. The policy reads no filesystem, composes no path anywhere else, and exactly one structure test pins the single home-plus-brand composition and the single `_STATE_DIR` read ([Repositories and the Host Overview](../../../spec/features/feature-projects.md)).
- **The existing legacy compatibility is about a different prior.** The legacy adapter maps `ADOS_*` environment facts onto the current prefix and warns once when the pre-freeze `.ados` directory is present. It does **not** read a prior config file, and its literal inventory allows exactly `ADOS_` and `.ados`. The pre-GH-288 store warning is a third, separate concept: it reports host-root store artifacts beside a missing project root.
- **The installer installs documents, scripts, and tools — no binary today.** Global mode clones the source to `~/.ados/repo`; local mode content-syncs redistributable docs, `ADOS_DELIVERY_SCRIPTS`, `ADOS_DELIVERY_TOOLS`, template files, and the plugin projection into the current project. Two structure suites pin that the entrypoint is named by neither array, and the CLI package is `private` with `files: ["dist"]`.
- **Users and current impact.** An operator who has been running `delivery-os` has `.delivery-os/` configuration in each checkout and a populated `~/.delivery-os-state` host root. Introducing a second identity without a read path would present them with an empty store and an unconfigured project on the first `jaiship` invocation.

### 2.2 Pain Points / Gaps

- **The product has a name but no executable with that name.** Every invocation still spells the pre-freeze working name, so the public name cannot be demonstrated, scripted, or documented.
- **A second identity would fork the workstation.** Project configuration and host state are directory-named from the identity. Switching identity without a read path silently orphans both: the operator sees an empty store and defaults, and the old data stays on disk but invisible — the worst possible failure mode because it looks like data loss.
- **There is no fallback concept to reuse.** The `ADOS_`/`.ados` adapter maps environment names and warns about a directory; it does not read a prior identity's config file and knows nothing about the host state root. The pre-GH-288 store warning describes a store-layout migration, not an identity change.
- **`installPath` is a value without a mechanism.** The resolver already names where an installed executable belongs, but nothing installs it, so a user cannot run the product from outside a checkout.
- **The install posture is stated as an exclusion.** The current normative sentence says the bin is not part of the install surface; that sentence is now wrong and must be replaced precisely, not softened.
- **Two bins invite drift.** Without a shared composition and a bounded literal rule, the second bin becomes a fork: a second composition body, a second identity derivation, and a slow divergence in help, version, and error behaviour.
- **Several documented consumers disagree by construction.** MCP keeps its own `delivery-os` default, the shell fallback in the delivery scripts keeps the `delivery-os` host root, and the installer carries its own `~/.ados` / `ADOS_*` surface. Silence about that would be a trap.

## 3. PROBLEM STATEMENT

Because the CLI carries a single pre-freeze executable identity and resolves configuration and host state from that identity alone, an operator cannot run the product under its decided public name, and the moment that name exists the existing `.delivery-os` configuration and `~/.delivery-os-state` host root become unreachable — so switching identity either loses the operator's data from view or forces an unmanaged migration, and the product still has no installed executable path at all.

**Who is affected.** The owner cannot present the product under its decided name. The operator either loses a working store or keeps using the old name indefinitely. Agents and delivery scripts sit on the same identity chain. The M4 publication slice cannot build a release or an install instruction on an executable that only exists inside a checkout.

## 4. GOALS

- **G-1** Ship `jaiship` as a native executable name beside `delivery-os`, both thin over one shared launcher composition and one resolver (ticket task 1).
- **G-2** Keep `delivery-os` working unchanged — same version output, same help, same `.delivery-os` paths (ticket AC3, task 2).
- **G-3** Keep `DELIVERY_OS_WORKING_NAME` as the one working-name override for both bins, with each bin declaring its own default identity (ticket task 1).
- **G-4** Preserve access to existing project configuration when the `.jaiship` equivalent is absent, by a read-only, per-layer, current-wins fallback (ticket AC4, task 3).
- **G-5** Preserve access to existing host state when the `.jaiship-state` root is absent, through the one pure host-root policy and without creating a second root (ticket AC4, task 3).
- **G-6** Classify the fallback as its own notice with bounded, once-per-source-per-process semantics that collide with neither delivered warning (ticket AC4).
- **G-7** Give the identity a local install posture: a user-level launcher at the brand install path, working outside the repository, repointing on re-run, failing classified when its target is gone (ticket AC6, task 3).
- **G-8** Bring the structural truth along: two declared bins, one declared default per bin plus the new bin's prior identity, the unchanged MCP default, and the resolver's declared scope-org derivation input, exact inventory equality, and installer arrays that still name no binary (ticket task 4).
- **G-9** Document the local install path and the transitional compatibility behaviour — including what this slice deliberately does **not** rename (ticket task 5).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Prompt-required command families advertised by `jaiship --help` | Same 20 families, same order, as `delivery-os --help` (0 differences) |
| Executable identities declared in the CLI bin manifest | Exactly 2 (`delivery-os`, `jaiship`), pointing at 2 distinct entry files |
| Composition bodies for the executable surface | 1 shared launcher composition; 0 duplicated bodies |
| Committed working-name literals under `packages/**` | Exactly 5 declared sites (3 CLI selector sites, the unchanged MCP default, the resolver's scope-org derivation input), each matching a declared inventory entry with its role; 0 undeclared sites; 0 exported |
| `delivery-os` observable behaviour change | 0 (version text, help text, config path, state path, install posture, invalid-override projection) |
| Existing project configuration orphaned on first `jaiship` use | 0 (read fallback, or an explicit `config-skipped` notice when shadowed) |
| Existing host state orphaned on first `jaiship` use | 0 (prior root used, or an explicit `state-skipped` notice when shadowed) |
| New `~/.jaiship-state` roots created while a prior root holds data | 0 |
| Writes, moves, copies, or deletions performed in the prior-identity config directory | 0 |
| Prior-identity notices per source kind per composed program | ≤ 1 (`config`, `state`); 0 when no fallback applies; a production process is one composed program, so this is once per process in production |
| Exit-code or machine-envelope changes caused by the notice | 0 |
| Installer arrays naming a binary, entrypoint, or composer | 0 (unchanged) |
| Installer steps that silently skip the launcher registration | 0 (a missing runtime or a source without the CLI entry is a classified failure, never a skip) |
| Local install from the change branch producing an executable launcher at the brand install path | 100% of runs; 0 network calls with `--no-fetch`; independent of an ambient working-name override |
| Re-running an unchanged local install | 0 bytes rewritten by the launcher step |
| `pnpm check` (including the branch-range commit-message gate) | Green |

### 4.2 Non-Goals

- **NG-1**: No package scope, repository URL, docs-domain, README, or public-doc rebranding; `packageScope` and the scope org stay `@delivery-os` / `delivery-os`.
- **NG-2**: No general rename of `@delivery-os/*` package names, the root workspace name, or the private manifest set.
- **NG-3**: No migration command and no automatic migration of user-level configuration or host state.
- **NG-4**: No MCP identity change; MCP keeps its own default and its own override read.
- **NG-5**: No change to the `ADOS_`/`.ados` legacy compatibility adapter's mapping, warning text, or once-per-process semantics.
- **NG-6**: No change to the pre-GH-288 store warning, the store layout, or the project-root derivation.
- **NG-7**: No change to the delivery script/tool installer arrays, the hook examples, the template install set, or the plugin projection.
- **NG-8**: No new error-table row and no new prompt-required command family; the fallback is a notice, not a failure identity.
- **NG-9**: No change to the forbidden-literal seed set and no change to the rename drill document.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | A second native executable identity (`jaiship`) beside the unchanged `delivery-os` bin, both thin over one shared launcher composition and one resolver | The decided public name must be runnable without forking the executable surface |
| F-2 | Declared identity selection per bin: one default working name each, one optional declared prior identity, and one unchanged override seam | A second identity must not introduce a second derivation or a second override mechanism |
| F-3 | Prior-identity project configuration read (per-layer, current-wins, read-only) | Existing project configuration must stay visible under the new identity |
| F-4 | Prior-identity host state root selection through the one pure policy, over injected existence facts | Existing delivery state must stay visible without forking the store |
| F-5 | A classified prior-identity fallback notice with once-per-source-per-process semantics | A silent fallback is indistinguishable from data loss; a noisy one is unusable |
| F-6 | User-level local install registering a launcher at the brand install path, working outside the repository | The product needs an executable that exists outside a checkout |
| F-7 | Structural truth for the two-bin reality: bounded identity literals, exact inventory, installer absence preserved, non-vacuous guards | The repository's structure suites are the reason a rename stays cheap; they must describe the new truth |
| F-8 | Documented install path and transitional compatibility, including the declared divergences | Operators must be able to see what changed, what did not, and what remains old |

### 5.1 Capability Details

- **F-1 — Second executable identity.** The CLI package declares two executables: the delivered `delivery-os` entry, whose observable behaviour is unchanged and whose body becomes a thin selector over the shared launcher, and a new `jaiship` entry. Both delegate to one shared launcher composition that reads the environment, the working directory, and the home directory exactly once, composes the production program, and returns an exit code; neither entry contains a second copy of that body, and neither calls the command runtime directly. The second entry exists so the identity is selectable at the process edge, not inferred from an argument, an environment variable, or the invoked path. Both bins therefore compose the same program from the same resolver input and differ only in the identity selector they declare.

- **F-2 — Declared identity selection.** Each bin declares exactly two facts: its default working name (its own identity) and, optionally, its prior identity. The `jaiship` bin declares the decided public name as its default and the pre-freeze working name as its prior identity; the `delivery-os` bin declares the pre-freeze working name as its default and **no** prior identity (it *is* the prior). Both facts are declared at the process edge; each is a non-exported local value in its own bin file; every derived value (binary name, environment prefix, config directory, state directory, tool prefix, install path, and the prior identity's equivalents) comes from the one resolver, so a prior path is never a second literal. `DELIVERY_OS_WORKING_NAME` remains the single override for both bins and keeps its delivered precedence. The delivered split between lenient self-description and strict configuration is preserved and made precise: an invalid override or name falls back to the **invoking bin's declared default identity** for `--help`/`--version` (so the self-description of a `jaiship` invocation never reports a different product), while a configuration-bearing command fails closed through the delivered containment identity `fallback.internal` at exit `2` (the resolver-level input error is wrapped by the composition-gap containment, never surfaced as a CLI-visible classified error) and **no fallback identity is substituted**. That projection is the delivered behaviour for both bins and stays unchanged (D6). The entrypoint module's delivered neutral default constant is replaced by the invoking bin's declared default, so no residual neutral identity literal survives in that module; the unchanged MCP surface keeps its own declared default. The delivered neutral default constant and its `neutralWorkingName` accessor are **removed**, not retained as a literal-free shim: the invoking bin's declared default is the only identity floor, and no fallback name is invented anywhere in the tree. The environment-variable-name accessor (`workingNameEnvironmentVariable`) is retained unchanged, because it exposes a variable *name* rather than an identity value, and the production composition keeps consuming it for the daemon re-entry environment. A missing or unusable declared default is a composition error reported through the same delivered containment identity (`fallback.internal`, exit `2`), never replaced by a substituted name.

- **F-3 — Prior-identity project configuration read.** When the invoking identity has a declared prior identity, project configuration acquisition considers, per eligible layer, the current-identity file first and the prior-identity file at the same layer second. Eligible layers are the two repository-owned layers (`project-committed`, `project-local`); the two machine-global layers (`system`, `user-global`) and an explicitly selected file do **not** fall back, because the ticket's transitional claim is about the artifacts the product itself created in a workspace, and reading another identity's machine-global configuration would widen the trust boundary beyond what the transition needs. Ordering rules: the current-identity file wins whenever it exists at that layer and the prior file is then reported as **not used**; the prior file is read (as that same layer, with its real path recorded as the loaded file and as the origin of every value it supplies) only when the current-identity file is absent and the prior file exists; when neither exists the delivered `missing` skip is recorded unchanged and no new skip reason is introduced. The fallback is strictly read-only: no write, copy, move, or deletion ever targets the prior directory, and the fallback value is never laundered as a current-identity path. The fallback is **not** a configuration warning, so `--strict` behaviour is unchanged and a prior-identity read cannot turn into `config.warning.strict`. The read is exercised wherever the delivered composition acquires project configuration: every composed invocation resolves the daemon and lane settings over exactly one such acquisition, so `jaiship status --json` exercises the fallback and its notice. The change adds no acquisition to any command and no new CLI surface; origin truth is observable through the configuration inspection resolution's origin metadata, which is composed in-process rather than exposed as a command (the `config` command is not reachable through the executable, §2.1).

- **F-4 — Prior-identity host state root.** When the invoking identity has a declared prior identity, the one pure host-root policy selects the root in this order: an absolute current-identity `<PREFIX>_STATE_DIR` override wins outright and disables the fallback (an explicit current-identity override is an intentional choice); otherwise the current-identity default root when it exists; otherwise the prior-identity default root when it exists; otherwise the current-identity default root, which is the ordinary first-use creation path. The prior-identity root is chosen only when the current-identity default root does not exist, and while the fallback is in effect no current-identity default root is created — that is the anti-orphaning guarantee. The prior identity's *environment* names are not mapped: no prior-prefix state-directory override is read, so an override never silently crosses identities. The policy stays pure and filesystem-free: the two existence facts arrive as injected inputs from the composition tier, which already probes with the delivered filesystem facts (the production composition is the only site that does so), the home-plus-directory composition remains a single helper used for both names, and the `<PREFIX>_STATE_DIR` read remains a single site. Because a project store must be single-rooted, a fallback invocation uses the prior host root for reads **and** the ordinary store operations that follow it; nothing is moved, copied, or rewritten, and the notice states which root is in effect. The test-only composition helper that resolves its own directory without the prior-identity facts is out of scope and must not join a production path without them (§7.2).

- **F-5 — Classified prior-identity fallback notice.** The fallback reports itself through one concept — the **prior-identity fallback notice** — with one classification token (`prior-identity-fallback`) and a closed reason set: `config-read`, `config-skipped`, `state-read`, `state-skipped`. It is a notice, not a failure: no error-table row, no exit-code change, no change to any machine payload. It is emitted at most once per source kind (`config`, `state`) per **composed program instance**. The once-state lives with the composition — the same pattern the delivered legacy adapter uses for its own once flag: a closure created once per composed program, never a process global — so one composed program that resolves configuration many times emits once, and a second independently composed program in the same process emits its own once. In production exactly one composed program exists per process, so this is once per process, and that is the deliberate reading of ticket AC4's "classified one-time warning": a moved-in workstation therefore sees at most two lines, one per source kind, rather than one line in total. Self-description never emits the notice, because `--version`, `--help` and the install-path read acquire nothing (§9 NFR-2). The rendered line begins with the classification token and reason, names the prior and current locations involved, and states that nothing was moved, copied, or deleted; it carries no value, no file content, and no secret. It surfaces on the delivered notice channel — stderr, once per notice, in **every** mode including `--json` — so `status --json` keeps its payload and exit projection while the transitional fact remains visible. It is distinct in concept and wording from the pre-GH-288 store warning and from the `ADOS_`/`.ados` legacy-compatibility notice, and it reuses none of the configuration warning kinds (`deprecated`, `shadowed`, `legacy`).

- **F-6 — Local install and launcher.** A user-level local install registers one executable launcher at the brand install path — for the `jaiship` identity, `~/.jaiship/bin/jaiship` — and nothing else about the install set changes. "Local install from the change branch" means a local-mode install run against a checkout of the change branch with fetching disabled and a scratch home, so the operation is hermetic and repeatable. The launcher is a small executable that hands the process to the runtime on exactly one target: the CLI entry file of the installed source tree, recorded as an absolute path at install time, with the invocation arguments passed through, the standard streams inherited, and the environment left unmodified — so the working-name override, the state-directory override, and every delivered flag behave exactly as they do in the repository. The launcher performs no version probe, no network access, and no search of `PATH` for the product itself. The install path is not composed by the installer: it is read from the executable's own state-free self-description (a declared install-path self-description member answered before any composition, with the same isolation contract as help and version), so the resolver remains the single derivation point and the installer only expands the leading home marker against the invoking home. Re-running the same install rewrites the launcher only when its content differs (content-idempotent); re-running from another source repoints it. If the recorded target no longer exists, the launcher answers one bounded stderr line naming the expected target and the remedy (re-run the local install) with a non-zero exit — never a silent success and never a guess. Because `--version` and `--help` read no state, git metadata, or configuration, `jaiship --version` works from any working directory outside the repository. Removing a registered launcher is not part of this slice. The step's own preconditions and failure modes are declared rather than implied: it requires the Bun runtime **at install time** (it invokes the install-path self-description), so a host without Bun is a classified installer failure naming the missing runtime and is never a silent skip; a resolved source tree that carries no CLI entry — for example a docs-only source directory — is likewise a classified failure naming the missing entry, and no launcher is written; `DRY_RUN` reports the planned registration and writes nothing; and the step is independent of `--tool`, registering the product's launcher for the default and the deprecated tool selections alike. The installer asks the **declared identity** of the executable it installs: it invokes the self-description with the working-name override removed from that child's environment, so an ambient `DELIVERY_OS_WORKING_NAME` in the operator's shell cannot redirect a local install away from the brand install path, while the installed launcher still forwards the environment unchanged, so the override keeps governing identity at run time.

- **F-7 — Structural truth for two bins.** The repository's structural description is updated rather than loosened: the CLI bin manifest declares exactly two executables pointing at two distinct existing entry files; both entries share one composition and neither exports a module-level string constant; the committed working-name literals match the declared **five-site** inventory exactly — the three CLI selector sites (`bin/delivery-os.ts` default, `bin/jaiship.ts` default, `bin/jaiship.ts` prior), the unchanged MCP default in `packages/mcp/src/serve.ts`, and the resolver's `SCOPE_ORG` scope-org derivation input in `packages/core/src/branding/index.ts` — under a `packages/**` string-literal scan, with no residual neutral literal in the entrypoint module; every declared entry must be found and every found site must be declared, so the guard asserts the declared rule and inventory rather than a bare count; the content inventory matches the file set exactly and allows executables per file only; and the installer still names no binary, entrypoint, or composer in its delivery arrays while the launcher registration is declared as its own step. Every one of these guards carries a non-vacuity requirement and, where the guard is a scan, a negative control proving that an injected violation is still caught.

- **F-8 — Documented install and transition.** The local install path and the transitional compatibility behaviour are documented for users: the install command shape, where the launcher lands, what it executes, the install-time runtime requirement and its classified failures, what the notice means, what the fallback covers, what it deliberately does not cover (machine-global configuration layers, prior-identity environment names), and the explicit statement of **four** declared divergences that remain on the pre-freeze name in this slice — the MCP identity, the delivery-script shell fallback host root, the scope-derived repository and docs URLs, and the installer's own `~/.ados` / `ADOS_*` surface; package scope, README, and public documentation stay on the pre-freeze name by non-goal (NG-1, NG-2). The installer's install set is documented where the distribution marker and install set are already documented, so that page is part of this change's documentation set.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Version and help parity
  Operator runs `jaiship --version` from the repository (via the workspace executable link).
  → identity selection yields the jaiship default; the resolver derives the jaiship values.
  → stdout: `jaiship <version> (build <build>)`; exit 0; no state, git, or configuration read.
  Operator runs `jaiship --help`.
  → the same 20 prompt-required families, in the same order, as `delivery-os --help`;
    only the binary name in the synopsis/examples differs.

Flow 2: First use of the new identity on a moved-in workstation
  The checkout holds `.delivery-os/config.yaml`; `~/.delivery-os-state` holds this
  project's state root; no `.jaiship` equivalents exist.
  → the delivered composition-time configuration acquisition (which every composed
    invocation performs, `status` included) finds no current-identity project file,
    finds the prior file, reads it as the project-committed layer, records the prior
    path honestly, and emits `prior-identity-fallback: config-read ...` once on stderr.
  → host-root selection finds no `JAISHIP_STATE_DIR` override, no `.jaiship-state`
    default root, and an existing prior default root; it selects the prior root and
    emits `prior-identity-fallback: state-read ...` once on stderr.
  → `jaiship status --json` answers the same facts as the operator's previous
    invocations; the payload shape and exit code are unchanged, and no command
    gained a configuration read.
  → nothing is created under `~/.jaiship-state`; nothing is moved or copied.

Flow 3: Both identities have artifacts
  `.jaiship/config.yaml` and `.delivery-os/config.yaml` both exist; `~/.jaiship-state`
  and `~/.delivery-os-state` both exist.
  → the current-identity file and root win.
  → the prior artifacts are reported once each as `config-skipped` / `state-skipped`
    so the operator knows an older artifact is present and not in use.

Flow 4: Explicit override
  `DELIVERY_OS_WORKING_NAME=acme` is set for a `jaiship` invocation.
  → the override wins for both bins; every derived path follows the override identity.
  → invalid override: `jaiship --version` still answers the jaiship identity, while a
    configuration-bearing command fails closed through the delivered containment
    identity `fallback.internal` at exit 2 — no fallback identity is substituted and
    no classified resolver error reaches the CLI.

Flow 5: Local install from the change branch
  Operator runs the local install against a change-branch checkout with fetching
  disabled and a scratch home, from a scratch project root.
  → the installer asks the executable's declared identity for its install path
    (ambient working-name override removed from that child), so the registration is
    independent of the operator's shell.
  → it registers an executable launcher at the brand install path
    (`~/.jaiship/bin/jaiship`) whose single target is that checkout's CLI entry.
  → from a directory outside the checkout, `jaiship --version` answers the jaiship
    identity; re-running the install rewrites nothing while the content is unchanged.
  → if the recorded source tree is gone, the launcher answers one bounded line naming
    the expected target and the remedy, with a non-zero exit.
  → if the runtime is unavailable, or the source tree carries no CLI entry, the
    install fails classified and names what is missing; a dry run writes nothing.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The second native bin (`jaiship`) in the CLI bin manifest plus its thin entry file, and the shared launcher composition the two bins share.
- Per-bin declared identity selection: the default working name, the optional prior identity, the preserved `DELIVERY_OS_WORKING_NAME` override, the corrected lenient self-description fallback (invoking bin's default identity), and the removal of the entrypoint's neutral default constant together with its `neutralWorkingName` accessor so no residual neutral identity literal remains.
- The state-free install-path self-description member consumed by the installer.
- Prior-identity project configuration read: per-layer candidate ordering for the two repository-owned layers, current-wins precedence, honest origins for a prior file, read-only semantics, unchanged skips, no new warning kind, no `--strict` change, exercised on the delivered composition-time acquisition so `jaiship status --json` proves it and no command gains an acquisition.
- Prior-identity host state root selection inside the one pure policy over injected existence facts: override precedence, prior-root selection, no creation of the current default root while the fallback holds, no prior-prefix environment mapping.
- The classified prior-identity fallback notice: concept, classification token, four reasons, once-per-source-per-composed-program semantics with the once-state owned by the composition, text requirements, stderr surfacing in every mode, and no payload/exit change.
- The user-level launcher registration in local install mode, derived from the brand install path, with content-idempotent re-runs, a classified missing-target failure, a declared install-time runtime requirement whose absence is a classified failure rather than a skip, a declared no-CLI-source failure, declared `DRY_RUN` behaviour, tool-independence, and an install path asked of the executable's declared identity so an ambient working-name override cannot redirect it.
- Structural truth updates: the two-bin manifest assertions and non-vacuity, the declared five-site identity-literal inventory under its declared `packages/**` scan rule, the exact content inventory and per-file executable allowances, and the installer-absence assertions reconciled with the declared launcher step.
- Documentation updates: the four affected system specification pages plus the installer install-set page in the phase-7 documentation set, the user-facing local install and transition documentation, and the planning backlog markers.

### 7.2 Out of Scope

- [OUT] Renaming `@delivery-os/*` packages, the root workspace package name, or the private manifest set.
- [OUT] Changing `packageScope`, the scope org, `repositoryUrl`, `docsBaseUrl`, `releaseAssetPrefix`, the README, the documentation profile, or any public documentation to the decided public name.
- [OUT] Migrating or copying user-level configuration or host state; there is no migration command and no automatic move.
- [OUT] Reading or mapping the prior identity's environment names (for example a prior-prefix state-directory override).
- [OUT] Changing the MCP surface's identity default, its override read, or its tool prefix.
- [OUT] Changing the `ADOS_`/`.ados` legacy compatibility adapter, its literal inventory, or its warning.
- [OUT] Changing the pre-GH-288 store warning, the store layout, the host index, or the project-key derivation.
- [OUT] Changing the delivery script/tool installer arrays, the hook examples, the template install set, or the plugin projection.
- [OUT] Registering a launcher for the `delivery-os` identity, or removing/uninstalling a registered launcher.
- [OUT] Growing the forbidden-literal seed set with the decided public name, or re-baselining the scan corpus.
- [OUT] Changing the rename drill document or its battery.
- [OUT] Threading the prior-identity fallback through the test-only composition helper that resolves its own directory: it is not on any production path today, and joining it without the existence facts would break the one-root-per-invocation guarantee.
- [OUT] Making the configuration inspection command prompt-required or otherwise reachable through the executable: no CLI configuration surface is added, and the configuration half of the fallback is proven on the delivered acquisition rather than through a `… config --json` token.
- [OUT] Changing the CI workflow: the installer integration cases run inside the Bun-bearing test job, so no `.github/workflows/ci.yml` change is required.
- [OUT] Merging the change before the active cross-repository lane (GH-310) lands: the delivery stops at an open pull request.

### 7.3 Deferred / Maybe-Later

- Removing the prior-identity fallback and the transition documentation once the public repository move completes (the fallback is transitional by construction; see OQ-1).
- Registering a launcher for the compatibility alias, and an uninstall path for a registered launcher.
- Extending the fallback to the machine-global configuration layers if operators report that a user-global configuration was expected to carry over.
- Aligning the MCP identity with the CLI (a separate slice) and retiring the shell fallback's pre-freeze host root in the delivery scripts.
- A `doctor`-style check that reports which identity paths are in effect and whether a prior artifact is present.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. No HTTP surface is added or changed. The affected command surface is the executable entry itself:

| Invocation | Outcome | Exit |
|---|---|---|
| `jaiship --version` / `delivery-os --version` | `<the invoking bin's binary name> <version> (build <build>)` | `0` |
| `jaiship --help` / `delivery-os --help` | Root help with the same 20 prompt-required families; the binary name in the synopsis and examples follows the invoking identity | `0` |
| `jaiship <command> --help` | Delivered per-command help, with the invoking identity's binary name | `0` |
| `jaiship <command> [options] [args]` | Delivered command runtime through the one composed program | The command's own `{0, 1, 2}` projection |
| `<binary> <configuration-bearing command>` with an invalid working-name override | Delivered containment identity `fallback.internal` naming the missing composition; the resolver-level input error is wrapped inside it, for both bins | `2` |
| `<binary> --print-install-path` | The brand install path for the effective identity, one line, no other output | `0` |
| `jaiship <uncomposed command>` | Delivered `fallback.internal` containment identity naming the missing composition | `2` |

The install-path self-description member is the root-level read `--print-install-path`. It is intercepted before any composition, in the same root-level self-description family as `--version` and `--help`, under the delivered isolation contract (no state, network, git, or configuration read, no write, no composer invocation). It is deliberately not a global flag and not a prompt-required command: it adds no family row and no help family, so the family-parity statement is unaffected, and it is an operator- and installer-facing token documented in the guide rather than advertised in root help. It is the one new public CLI token this change introduces, and that is stated rather than left implicit. It answers the **effective** identity, so an override present in the environment is honoured when an operator asks directly; the installer pins the declared identity instead, by removing the override from that child's environment (F-6).

### 8.2 Events / Messages

N/A. No ledger event, taxonomy version, topic, or payload is added or changed. The prior-identity fallback is reported as a process notice, not as an event; nothing is appended to the store by a fallback read.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Executable identity selector (per bin) | Two facts per bin: the default working name and an optional prior working name. Declared once at the process edge; every derived value comes from the one resolver. Additive; no resolver change and no `BrandIdentity` field change (the contract stays at twelve fields) |
| DM-2 | Prior-identity configuration acquisition input | An optional prior configuration-directory name supplied to file acquisition, plus a per-layer outcome recording what the prior candidate did (`read` or `not used`) with the layer and the prior path. Additive; unchanged skips, unchanged error codes, no new warning kind |
| DM-3 | Prior-identity host-root input | Injected existence facts for the current-identity and prior-identity default host roots. The policy remains pure; the facts arrive from the composition. Additive; the `<PREFIX>_STATE_DIR` read and the home-plus-directory composition remain single sites |
| DM-4 | Prior-identity fallback notice | One concept, one classification token (`prior-identity-fallback`), four reasons (`config-read`, `config-skipped`, `state-read`, `state-skipped`), rendered as one bounded stderr line per source kind per composed program (once per process in production, where one composed program exists per process). The once-state is owned by the composition instance, mirroring the delivered legacy adapter, so suppression is provable in-process and order-independent. Not an error-table row, not a configuration warning, not part of any machine payload |
| DM-5 | Launcher registration | One executable file at the brand install path whose content is the runtime exec of one absolute target plus the identity's arguments; content compared on re-run; the path is asked of the executable's declared identity, with the working-name override removed from that child's environment; no record is written anywhere else |
| DM-6 | Declared identity-literal inventory | The guard's rule is a `packages/**` string-literal scan (comments are not literals) collecting every literal byte-equal to a declared working name. The inventory is the assertion, not a count: each of the **five** declared sites must be found and every found literal must match a declared entry. The declared sites are the three CLI selector sites (`bin/delivery-os.ts` default, `bin/jaiship.ts` default, `bin/jaiship.ts` prior), the unchanged MCP default in `packages/mcp/src/serve.ts`, and `SCOPE_ORG` in `packages/core/src/branding/index.ts`, which is declared as a **derivation input** — a scope-org literal consumed by `docsBaseUrl` and `repositoryUrl`, byte-equal to a working name but not an identity selector — rather than as an undeclared exemption; the resolver is code-UNCHANGED. The entrypoint module holds no identity literal at all: its delivered neutral constant and its `neutralWorkingName` accessor are removed, which also removes that one name from the module's per-file executable allowance in the content inventory (`workingNameEnvironmentVariable` stays allowed because it exposes a variable name, not an identity value). The installer adds one declared layout reference to the CLI entry file it launches |

**Prior-identity notice classification (distinct from both delivered warnings):**

| Concept | Classification | Reasons | Where it surfaces | Interaction with delivered concepts |
|---|---|---|---|---|
| Prior-identity fallback notice | `prior-identity-fallback` | `config-read`, `config-skipped`, `state-read`, `state-skipped` | stderr, once per source kind per composed program (once per process in production), every mode including `--json`; never in the machine payload; never changes an exit code | Distinct from the pre-GH-288 store warning (store layout beside a missing project root) and from the `ADOS_`/`.ados` legacy-compat notice (pre-freeze environment names and directory); reuses none of the configuration warning kinds |

**Precedence, stated once:**

| Source | Order | Both present | Explicit override |
|---|---|---|---|
| Project configuration (per eligible layer) | current file → prior file → `missing` skip | current file read; prior reported `config-skipped` | a selected file occupies the project-committed slot; no fallback of any layer |
| Host state root | absolute current `<PREFIX>_STATE_DIR` → current default root (if present) → prior default root (if present) → current default root (first use) | current root used; prior reported `state-skipped` | an absolute current override wins and disables the fallback; prior-prefix overrides are never read |

### 8.4 External Integrations

No vendor, API, credential, or network surface is added. The one external dependency is the runtime that executes the entry: the bin and the installed launcher both hand the process to the Bun runtime on the TypeScript entry file, exactly as the delivered bin does inside the repository. The launcher performs no download; the install gate runs with fetching disabled and therefore needs no network.

### 8.5 Backward Compatibility

- **The compatibility alias is behaviourally unchanged.** `delivery-os --version`, `delivery-os --help`, every command's behaviour, the `.delivery-os` configuration path, the `~/.delivery-os-state` host root, and its invalid-override projection (the delivered `fallback.internal` containment at exit `2`) are exactly as delivered; the alias declares no prior identity, so no fallback path can apply to it.
- **The override seam is unchanged.** `DELIVERY_OS_WORKING_NAME` remains the single working-name override for both bins, with the delivered precedence and the delivered empty-value handling.
- **The lenient/strict split is preserved and sharpened.** Self-description keeps falling back on an invalid override or name, now to the invoking bin's declared default identity instead of a single global neutral name, and stays usable. A configuration-bearing command keeps failing closed through the **delivered** containment identity `fallback.internal` at exit `2`, with the resolver-level input error wrapped inside it and no fallback identity substituted; no classified resolver error becomes CLI-visible. For the `delivery-os` bin both halves are observably identical to the delivered ones, that projection included.
- **Existing artifacts stay reachable.** Project configuration and the host state root created under the prior identity are read under the new identity; nothing is orphaned silently, because either the prior artifact is used or its presence is reported as not used.
- **Previously delivered warnings are untouched.** The pre-GH-288 store warning and the `ADOS_`/`.ados` legacy-compat notice keep their triggers, text shape, and once-per-process discipline; the new notice is additive and distinct.
- **Install set is unchanged except for the launcher.** The delivery script/tool arrays, the hook examples, the template set, and the plugin projection are byte-identical; the `delivery-os` bin mapping is unchanged; the only new installed artifact is the launcher at the brand install path.
- **Local install gains one declared requirement and three declared failure modes.** The launcher step requires the Bun runtime at install time (a host without it gets a classified failure naming the runtime, never a skip); a resolved source tree with no CLI entry gets a classified failure naming the missing entry and no launcher is written; `DRY_RUN` writes nothing; and the step is independent of `--tool`. The installer asks the executable's declared identity for the path, so an ambient working-name override in the operator's shell cannot redirect the install, while the installed launcher forwards the environment unchanged so the override still governs identity at run time. The installer's own `~/.ados` / `ADOS_*` surface (`ADOS_HOME`, `ADOS_REPO_DIR`, `ADOS_SOURCE_DIR`, `ADOS_RAW_URL`, `ADOS_REPO_URL`) is unchanged and declared as the fourth divergence.
- **Machine contracts are unchanged.** No envelope field, error code, exit projection, status/brief payload, event topic, or taxonomy version changes.
- **The detached re-entry environment contract is unchanged.** The declared child-environment allowlist already admits the working-name override and the brand-derived state-directory name, so the jaiship identity's override and state-directory names re-enter a detached child (and the installed unit) exactly as the delivered identity's do, with no allowlist change.
- **Four known, declared divergences.** (1) MCP keeps its own `delivery-os` default and override read. (2) The delivery-script shell fallback keeps the `delivery-os` host root. (3) The scope-derived `repositoryUrl` and `docsBaseUrl` remain `delivery-os` URLs. (4) The installer keeps its own pre-freeze surface (`~/.ados` default home, `~/.ados/repo`, `ADOS_HOME`, `ADOS_REPO_DIR`, `ADOS_SOURCE_DIR`, `ADOS_RAW_URL`, `ADOS_REPO_URL`). With no override, the first two continue to address the prior artifacts — which is exactly what the CLI fallback reads, so the surfaces agree while the prior artifacts exist; after an operator moves artifacts to the new identity, MCP and the shell fallback keep addressing the prior locations and are aligned only by setting the delivered override for MCP. This is documented, not silent (see §22).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Identity determinism | The same declared selector, override, and injected environment produce the same twelve values across repeated runs; 0 name-derived values computed outside the resolver; 0 exported module-level identity literals |
| NFR-2 | Self-description isolation | `--version`, `--help`, and the install-path read perform 0 state reads, 0 git reads, 0 configuration reads, 0 writes, 0 network calls, and 0 composer invocations, for both bins, including with a poisoned environment or an unreadable configuration file |
| NFR-3 | Notice discipline | At most 1 notice per source kind per composed program (once per process in production); exactly 0 when no fallback applies; repeated resolutions in one composed program add 0 further notices; 0 notices from self-description; 0 notices carrying a value, file content, or secret; ≤ 1 line per notice and ≤ 400 characters |
| NFR-4 | Fallback safety | 0 writes, moves, copies, or deletions in the prior configuration directory; 0 creations of the current default host root while the fallback is in effect; 0 reads of prior-prefix environment overrides; 0 changes to `--strict` behaviour; 0 added acquisitions on any command |
| NFR-5 | Install idempotence, hermeticity, and honesty | Re-running an unchanged local install writes 0 files in the launcher step; the gate run performs 0 network accesses with fetching disabled and writes only under the scratch home and scratch project root; 0 silent skips (a missing runtime or a source without the CLI entry is a classified failure) |
| NFR-6 | Structural completeness | 2 declared executables, 2 distinct entry files, 5 declared identity-literal sites under the declared `packages/**` scan rule (3 CLI selector sites, the unchanged MCP default, the resolver's scope-org derivation input) with every found literal declared and every declared site found; exact inventory equality; a per-file executable allowance for every executable file; every guard has a failing negative control |
| NFR-7 | Regression safety | `pnpm check` green under the plan's single executable same-device invocation, including the branch-range commit-message gate; 0 regressions in the delivered alias, entrypoint, configuration, state-scope, daemon-mount, events-mount, and installer suites |
| NFR-8 | Declared divergences | Every remaining pre-freeze consumer — the MCP default and override read, the delivery-script shell fallback host root, the scope-derived repository and docs URLs, and the installer's own `~/.ados` / `ADOS_*` surface — is stated in the specification, the guide, and the change record; 0 undocumented identity paths |
| NFR-9 | Rendering fidelity | `jaiship --help` and `delivery-os --help` differ only in the binary name; the family rows are identical in content and order |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The fallback is observable as one classified notice per source kind per composed program, on stderr, in every mode — the same channel the delivered notices use, so an operator sees it in an interactive run and an automated harness captures it without parsing a payload.
- The notice names both the prior and the current location, so a support conversation can reconstruct exactly which artifact was in use without inspecting the filesystem.
- Configuration origins remain truthful: a value supplied by a prior file reports that prior file as its origin, so the configuration inspection resolution shows where a value came from rather than a laundered current-identity path. That resolution is composed in-process rather than exposed as a command (§2.1).
- The launcher failure mode is observable: one bounded line naming the expected target and the remedy, with a non-zero exit, instead of a shell-level "not found".
- No metrics, spans, ledger events, or telemetry records are added; nothing is written to the store by a fallback read.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Silent state fork: a `~/.jaiship-state` root is created while `~/.delivery-os-state` still holds the operator's deliveries | H | M | Prior-root selection when the current default root is absent; explicit "no current default root is created while the fallback holds" requirement; `state-skipped` notice when both exist; acceptance asserts zero creations | L |
| RSK-2 | Configuration read from the wrong directory: a prior file silently overriding a current one, or a value reported with a laundered path | H | L | Current-wins precedence; the prior file is read only when the current file is absent; the prior path is recorded as the loaded file and of every value's origin; `config-skipped` notice when shadowed | L |
| RSK-3 | Two bins drift: a second composition body, a second derivation, or divergent help/version behaviour | M | M | One shared launcher composition; bounded identity literals; family-parity acceptance; structure assertions on the manifest shape and the shared composition | L |
| RSK-4 | The launcher points at a source tree that no longer exists | M | M | Absolute target recorded at install time; re-running the install repoints it; classified one-line failure naming the target and the remedy; no PATH guess | L |
| RSK-5 | Install step touches the real user home or the network during the gate | M | L | The gate runs local install with fetching disabled, a scratch home, and a scratch project root; the launcher step is content-idempotent | L |
| RSK-6 | Notice noise trains operators to ignore it | M | M | Once per source kind per composed program; at most two lines; no notice when no fallback applies and no repetition within one composed program | L |
| RSK-7 | MCP and the CLI disagree about which identity paths are live | M | M | Declared transitional limitation with the delivered override seam as the alignment mechanism; documented in the guide and the specification; MCP identity work deferred to its own slice | M |
| RSK-8 | The decided public name becomes a committed literal before the naming freeze completes, weakening the rename drill's premise | M | M | The literal sites are declared and bounded (three CLI selector sites, the unchanged MCP default, the resolver's scope-org derivation input) plus one installer layout reference; the resolver stays the only derivation point; the seed set and the rename drill are deliberately unchanged; the public move re-evaluates both | M |
| RSK-9 | Entrypoint hot-file conflict with the active cross-repository lane (GH-310) | M | H | The delivery stops at an open pull request and does not merge before GH-310 lands; the entrypoint and bin files are the declared shared surface | M |
| RSK-10 | An operator expects machine-global configuration to carry over and does not find it | L | M | The fallback scope is stated in the guide with the rationale; the notice names the source kind so an unexpected absence is visible; extending the scope is a recorded deferred item | L |
| RSK-11 | Local install stops working on a host without the runtime, because the launcher step must ask the executable for its path | M | M | The install-time runtime requirement is declared in the specification and the guide; its absence is a classified failure naming the runtime, never a silent skip; the step stays content-idempotent so a re-run after installing the runtime completes the install | L |
| RSK-12 | A reader or a test treats `status --json` as non-acquiring and asserts a vacuous configuration case (the defect that reopened this specification) | M | L | The acquisition is stated as a verified current-truth fact in §2.1 and F-3, and AC-F3-4 names the composition-time acquisition explicitly; the acceptance wording no longer conditions on an unstated "when configuration is resolved" | L |

## 12. ASSUMPTIONS

- The owner's decision of 2026-11-15 is the source of truth for the product name; this slice does not re-open it.
- The public repository move is not part of this change, so every pre-freeze URL, scope, and package name stays exactly as delivered.
- The pre-freeze working name (`delivery-os`) is the prior identity for the `jaiship` bin; there is no third identity in scope.
- Operators who adopt `jaiship` today are the same operators who created `.delivery-os` artifacts under the previous identity on the same workstation and in the same checkout.
- The runtime that executes the entry is available in the operator's environment, since the delivered bin already requires it; the local install requires it at install time too, and its absence is a classified installer failure rather than a silent skip.
- A project store is single-rooted; a read-only state fallback would split one store across two roots, which the state layer forbids, so the state fallback selects one root for the whole invocation.
- In this checkout the `.delivery-os` *configuration* file is absent while `~/.delivery-os-state` exists, so the configuration half of the fallback acceptance runs `status --json` in a fixture checkout that carries `.delivery-os/config.yaml`; the state half runs against the existing host root with a scratch counterpart.
- The delivered composition-time project-configuration acquisition is read-only and already swallows its own failures to shipped defaults, so adding the prior-identity fallback to it introduces no error path and no observable change on any command except the notice.
- `ADOS_`-prefixed environment facts continue to map onto whatever prefix the invoking identity derives, which is the delivered legacy behaviour and is not modified.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Branding seam (delivered, GH-171/GH-174) | The twelve-value derivation, the `installPath` value this change finally consumes, and the structure guards that keep one derivation point |
| Depends on | Executable entrypoint (delivered, GH-242) | Working-name resolution, the lenient/strict split, and the help/version self-description contract the install-path read joins |
| Depends on | Configuration layer (delivered, GH-173) | The seven ordered layers, file acquisition with injected filesystem facts, classified errors and skips |
| Depends on | State scope (delivered, GH-288) | The one pure host-root policy, the project-root derivation, and the structure test asserting one composition |
| Depends on | Installer surface (delivered) | Local and global modes, the delivery arrays, the content-sync discipline; local mode gains the launcher step and its install-time runtime requirement |
| Depends on | Content inventory and structure suites (delivered) | Exact file-set equality and per-file executable allowances the new bin must join |
| Blocks | M4-S1 remainder (naming freeze and the wider rename) | The executable name and install posture are the first slice; the scope, URL, and documentation rename builds on it |
| Blocks | M4-S2 publication and release automation | A release needs an executable name and an install path |
| Constrained by | Active cross-repository lane (GH-310) | Shared entrypoint hot files; the change must not merge before that lane lands |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | When and by which slice is the prior-identity fallback retired? | The fallback exists so the identity change does not orphan artifacts created before the public move. It must not become permanent: once operators have moved their artifacts, the fallback and its notice become a permanent second read path with a permanent trust-boundary cost. The retirement trigger and the accompanying documentation change belong to the M4-S1 remainder. | Deferred to the M4-S1 remainder (public move); not a blocker for this slice |
| OQ-2 | Should the compatibility alias ever gain a prior-identity read of its own? | Today `delivery-os` is the prior identity and declares none, so an operator who moves to `.jaiship` artifacts and then runs the alias gets the delivered empty-store behaviour. Aligning the alias in the other direction (reading forward) is a separate product decision with its own risks; it is out of this slice. | Deferred; consult `@decision-advisor` if the alias is to be kept as a writing surface after the public move |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The legacy identity fallback is the chosen mechanism, not a migration command: a `jaiship` invocation reads the prior identity's project configuration and host state root when the current-identity equivalents are absent, with a classified one-time notice. | Ticket AC4 selects the fallback explicitly; it is the option that leaves existing artifacts in place and cannot half-migrate. (PM decision D1.) | 2026-11-15 |
| DEC-2 | Scope stays at the executable name and its install posture. Package scope, the scope org, repository URLs, docs domain, README, and public documentation remain on the pre-freeze name, so a `jaiship` working name still derives `https://github.com/delivery-os/jaiship` and a `delivery-os` docs base. That consequence is accepted and stated, not silently corrected. | The public move has not happened; changing URLs now would publish dead links and a package scope nobody owns yet. (PM decision D2.) | 2026-11-15 |
| DEC-3 | The install posture changes: a user-level local install registers a launcher at the brand install path (`~/.jaiship/bin/jaiship` for the new identity), and that acceptance supersedes the delivered sentence that the bin is not part of the install surface. The `delivery-os` bin mapping and the delivery script/tool arrays are unchanged. | Ticket AC6 requires an executable that works outside the repository; the delivered exclusion is simply no longer true. (PM decision D3.) | 2026-11-15 |
| DEC-4 | `DELIVERY_OS_WORKING_NAME` remains the working-name override for both bins. The `delivery-os` bin keeps its current configured default, so its behaviour and its `.delivery-os` paths are unchanged; only the new bin defaults to the new identity. The resulting divergence from MCP's own default and override read is recorded as a documented transitional limitation, not a silent behaviour. | Ticket requirement plus the smallest change that keeps the alias honest. (PM decision D4.) | 2026-11-15 |
| DEC-5 | The two bin files are the declared identity selectors: each names exactly one default working name as a non-exported local value, and the new bin names its prior identity the same way. The resolver remains the single derivation point, no identity value is exported, and any shared launcher exposes behaviour through a function. The unchanged MCP surface keeps its own declared default, and the resolver's `SCOPE_ORG` is declared as a scope-org derivation input (byte-equal to a working name, but not an identity selector); the three CLI sites, the MCP default, and `SCOPE_ORG` form the declared five-site inventory. Every other site stays name-free and the entrypoint module keeps no residual neutral literal. | This is a **correction of delivered truth**, not a new rule: declared `delivery-os` literals already exist in both bins, the MCP default, and the resolver, so the delivered sentence "no working-name literal is committed" is inaccurate. The seam's real invariant — bounded, non-exported, single-derivation — is what the guard asserts, together with the declared inventory. No decision record is opened (D8); the phase-7 branding-seam page carries the corrected wording. | 2026-11-15 |
| DEC-6 | The prior identity is declared as a prior *working name*, so `.delivery-os` and `.delivery-os-state` derive from the resolver rather than being introduced as new literals. | One derivation path for current and prior paths; no second naming mechanism and no prior-path literal in code. | 2026-11-15 |
| DEC-7 | The configuration fallback covers only the two repository-owned layers (project-committed and project-local). System and user-global layers and an explicitly selected file never fall back. | The transition claim is about artifacts the product created in a workspace; falling back on machine-global configuration would read another identity's machine settings and widen the trust boundary beyond the ticket. | 2026-11-15 |
| DEC-8 | Within an eligible layer the current-identity file wins; the prior file is read only when the current file is absent. When both exist the prior file is reported as not used. The fallback is read-only: no write, copy, move, or deletion ever targets the prior directory. The fallback is not a configuration warning, so `--strict` is unchanged. | Current data is authoritative; the prior read is a visibility measure, and turning it into a strict-mode failure would break delivered behaviour for operators who enable strict validation. | 2026-11-15 |
| DEC-9 | The state fallback selects one effective host root for the whole invocation: an absolute current override wins and disables the fallback; otherwise the current default root when present; otherwise the prior default root when present; otherwise the current default root as first use. While the fallback holds, the current default root is never created. Prior-identity environment overrides are never read. | A store is single-rooted; a read-only state fallback would split one store across two roots or force a migration. Selecting one root keeps reads and writes coherent and satisfies "nothing orphaned" without moving anything. This **extends** TDR-0022 rather than contradicting it: still exactly one effective host root per invocation, one home-plus-brand composition, and one `<PREFIX>_STATE_DIR` read — only which root is selected changes. No decision record is opened (D8); the phase-7 repositories/host-overview page carries the extended wording. | 2026-11-15 |
| DEC-10 | The fallback is reported as the prior-identity fallback notice: classification token `prior-identity-fallback`, reasons `config-read`, `config-skipped`, `state-read`, `state-skipped`, at most one per source kind per composed program (once per process in production), on stderr in every mode, with no payload and no exit-code change. The once-state is owned by the composition instance, mirroring the delivered legacy adapter. It reuses neither the pre-GH-288 store warning nor the legacy-compat notice nor a configuration warning kind. | A distinct, bounded classification is auditable and testable; reusing a delivered warning would make the two indistinguishable in support and in `--strict` semantics; a composition-owned once-state is provable in-process and order-independent. | 2026-11-15 |
| DEC-11 | Self-description falls back on an invalid override or name to the invoking bin's declared default identity; a configuration-bearing command keeps the delivered containment identity `fallback.internal` at exit `2`, wrapping the resolver-level input error, and substitutes no fallback identity. | Preserves the delivered lenient/strict split and the delivered error projection while making the self-description identity-correct: a `jaiship` self-description must never claim a different product, and the alias must keep its shipped behaviour. The delivered behaviour is the containment projection, verified for both bins; the earlier wording that described a CLI-visible classified resolver error was wrong (D6). | 2026-11-15 |
| DEC-12 | The installer does not compose a name-derived path. It obtains the install path from the executable's state-free install-path self-description and only expands the leading home marker. | The resolver is the single derivation point; a bash-side derivation of the dot-directory and binary name would be exactly the class of duplication the seam exists to prevent. | 2026-11-15 |
| DEC-13 | The launcher is a single exec of one absolute target recorded at install time, with arguments passed through, streams inherited, and the environment unmodified; no version probe, no network, no `PATH` search for the product. Re-running the install rewrites it only on content change and repoints it when the source differs; a missing target is a classified one-line failure with a non-zero exit. | Predictable, testable, override-preserving, and honest about a moved source tree. | 2026-11-15 |
| DEC-14 | The configuration half of ticket AC4 is verified on `jaiship status --json` — the ticket's literal surface — because the delivered composition already acquires project configuration on every composed invocation: the daemon/lane settings resolution runs one read-only project-configuration acquisition at composition time, before any handler, so `status` reads `<repo>/<configDirectoryName>/config.yaml` today. The change therefore adds **no** acquisition to `status` and changes no status observable except the new notice in the transitional prior-identity case. The alternative surface recorded at the readiness gate (`… config --json`) is not available: `config` is not prompt-required, is dropped from the composed program, and answers `fallback.internal` at exit `2` through the executable. The correction of the recorded surface, the evidence, and the preserved ticket wording are disclosed for owner acceptance at the pull-request gate. | Truthfulness over a recorded surface: an acceptance criterion written against an unreachable command cannot pass, and `status` proves both halves of AC4 exactly as the ticket words it without any product-scope change. | 2026-11-15 |
| DEC-15 | The installer asks the executable's **declared identity** for the install path by invoking the install-path self-description with `DELIVERY_OS_WORKING_NAME` removed from that child's environment, and installs that path; the installed launcher forwards the environment unchanged, so the override still governs identity at run time. The launcher step's install-time runtime requirement is declared, and a missing runtime or a source tree without the CLI entry is a classified installer failure, never a skip; `DRY_RUN` writes nothing and the step is independent of `--tool`. | A local install must land at the product's declared install path (ticket AC6) even when the operator's shell carries an override, while the override stays the runtime identity channel D4 keeps unchanged. Silent skips would let "installed" mean "nothing happened". | 2026-11-15 |

### 15.1 Precedent status of DEC-5 and DEC-9 (no new decision record)

The readiness gate asked whether DEC-5 and DEC-9 are precedent-setting and require a decision record. They do not, and that is recorded here rather than left implicit (D8).

- **DEC-5 corrects delivered truth; it does not introduce a rule.** The repository already commits `delivery-os` literals in `bin/delivery-os.ts`, in the MCP default, and in the resolver's `SCOPE_ORG`, so the branding-seam sentence "no working-name literal is committed" describes an invariant the tree does not have. What the seam actually guarantees — one derivation point, bounded and non-exported literals, and no `BrandIdentity` field literal outside `branding`/`contracts` — is unchanged, and that is what the guard asserts, now together with the declared inventory. The correction is carried by the phase-7 update of `doc/spec/features/feature-branding-seam.md`, declared in §16.
- **DEC-9 extends TDR-0022 without contradicting it.** TDR-0022 records the single host-root rule; this change keeps exactly one effective host root per invocation, one home-plus-brand composition, and one `<PREFIX>_STATE_DIR` read, and changes only which root that same rule selects. The extension is carried by the phase-7 updates of `doc/spec/features/feature-projects.md` and `doc/spec/features/feature-config-layer.md`, both declared in §16.
- **DEC-10 adds a notice vocabulary, not a system invariant.** The classification is additive and bounded: no error-table row, no payload, no exit-code effect; it is stated in the configuration-layer and entrypoint pages.
- **No file under `doc/decisions/**` is opened or amended by this change**, so the plan declares no decision-record file.

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| CLI bin manifest | Updated — a second executable identity beside `delivery-os` (F-1, DM-1) |
| CLI executable entry surface | Updated — one shared launcher composition; two thin identity selectors; the install-path self-description member (F-1, F-2, F-6) |
| Entrypoint identity resolution | Updated — per-bin default identity, prior identity input, corrected lenient fallback (F-2, DEC-11) |
| Production composition | Updated — prior identity threaded into every configuration acquisition site and the host-root input; owns the composition-scoped once-state; surfaces the notice through the delivered warning channel (F-3, F-4, F-5) |
| Configuration file acquisition | Updated — optional prior directory with per-layer ordering and a recorded prior outcome (F-3, DM-2) |
| Host-root policy | Updated — prior-root selection over injected existence facts; one composition helper and one override read preserved (F-4, DM-3) |
| Contracts (configuration and notice language) | Updated — the prior-identity outcome and the notice classification vocabulary (DM-2, DM-4) |
| Installer | Updated — the user-level launcher registration step, its declared identity query, and its install-time runtime requirement with classified failures; arrays unchanged (F-6, DEC-15) |
| Structure, behaviour, and conformance suites | Updated — two-bin manifest and non-vacuity, the five-site literal guard, exact inventory, installer-absence reconciliation, fallback behaviour per source, launcher structure and installer integration, doc-truth checks, and the delivered conformance isolation suite the neutral-default removal touches (F-5, F-7) |
| System specification pages | Updated — CLI entrypoint, branding seam, configuration layer, repositories/host overview, plus the install-set/distribution-marker page in the phase-7 documentation set (F-8, finding 8d) |
| User-facing documentation | Updated — the local install path, the transitional behaviour, and the four declared divergences (F-8) |
| Planning backlog | Updated — the M4-S1 marker reflects the delivered first slice and the remaining rename |
| MCP surface, shell fallback, package scope, repository and docs URLs, README, installer's `ADOS_*` surface | Unchanged — the four declared transitional divergences plus the package-scope non-goals (NG-1, NG-2, NG-4, NFR-8) |

**File impact map**

| Path | Status | What changes |
|------|--------|--------------|
| `packages/cli/package.json` | CHANGED | The bin manifest gains the second executable identity pointing at the new entry file |
| `packages/cli/bin/jaiship.ts` | NEW | Thin identity selector: declares the new default working name and the prior working name, delegates to the shared launcher |
| `packages/cli/bin/delivery-os.ts` | CHANGED | Becomes a thin selector over the shared launcher; declares the unchanged default and no prior identity; observable behaviour unchanged |
| `packages/cli/src/bin-launcher.ts` | NEW | The single shared launcher composition (behaviour exported as a function, never as a literal) |
| `packages/cli/src/entrypoint.ts` | CHANGED | Per-bin default identity, prior-identity input, lenient fallback to the invoking default, install-path self-description member; the delivered neutral default constant and its `neutralWorkingName` accessor are removed, so no identity literal remains in the module (`workingNameEnvironmentVariable` is retained and still consumed by the production composition) |
| `packages/cli/src/production.ts` | CHANGED | Threads the prior identity into every configuration acquisition site (the composition-time settings read plus the daemon, dispatch, and coordinator paths) and into the host-root input; owns the composition-scoped once-state; surfaces the notice through the delivered warning channel |
| `packages/cli/src/edge.ts` | CHANGED | The configuration program receives the prior-identity directory and resolves through the fallback-aware acquisition; the test-only composition helper is untouched and stays outside the fallback path (§7.2) |
| `packages/cli/src/help.ts`, `packages/cli/src/help/prompt-required-commands.ts` | UNCHANGED | No command family or prompt-required set change; only the brand substitution inside the rendered help differs per identity |
| `packages/core/src/contracts/config.ts` | CHANGED | The prior-identity acquisition outcome type; skips, errors, and warning kinds unchanged |
| `packages/core/src/contracts/index.ts` | CHANGED | Re-exports the additive configuration and notice vocabulary |
| `packages/core/src/app/state-scope.ts` | CHANGED | Prior-root selection over injected existence facts; one home-plus-directory helper and one `<PREFIX>_STATE_DIR` read |
| `packages/adapters/src/file/config-source.ts` | CHANGED | Optional prior directory name, per-layer candidate ordering, honest prior-path origins, read-only |
| `packages/core/src/branding/index.ts` | UNCHANGED | Derivation rules, the twelve fields, and `SCOPE_ORG` stay exactly as delivered; the constant is declared in the inventory only (DM-6) |
| `packages/mcp/src/serve.ts` | UNCHANGED | Keeps its own default (a declared inventory site) and override read; first declared divergence |
| `scripts/install.sh` | CHANGED | Launcher registration step, the declared-identity install-path query, the install-time runtime requirement with classified failures, `DRY_RUN` and no-CLI-source behaviour, usage/header documentation; delivery arrays unchanged |
| `scripts/lib/dispatch-authority.sh` | UNCHANGED | Keeps the pre-freeze host root; second declared divergence |
| `scripts/checks/forbidden-literals.registry.json` | CHANGED | The new user-facing guide is registered in the doc scan; the seed set stays unchanged (NG-9) |
| `scripts/checks/manifest-privacy.ts`, `scripts/checks/publish-guard.ts` | UNCHANGED | Six private package names and the neutral scope are unchanged |
| `tests/structure/entrypoint-bin.test.ts` | CHANGED | Two-bin manifest assertions with non-vacuity; shared-composition and declared-literal-inventory assertions |
| `tests/structure/entrypoint-installer-absence.test.ts` | CHANGED | Arrays still name no binary; the declared launcher step and its layout reference are asserted |
| `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json` | CHANGED | Exact file-set equality gains the new entries; per-file executable allowances updated, including removal of the retired neutral accessor from the entrypoint module's allowance |
| `tests/structure/projects-state-scope-policy.test.ts` | CHANGED | The composition predicate is re-expressed around the one helper; negative controls preserved |
| `tests/structure/state-scope.test.ts` | CHANGED | The prior-root selection cell and its injected-fact contract |
| `tests/structure/install-launcher.test.ts` | NEW | Launcher registration structure, path authority, idempotence declaration, missing-target classification |
| `tests/structure/branding-seam.test.ts`, `tests/structure/branding-contract.test.ts` | UNCHANGED | The seam scan and the twelve-field contract stay as delivered and stay green; they are run as controls |
| `tests/behaviour/entrypoint-two-bins.test.ts` | NEW | The two-bin process edge: parity, shared composition, install-path read, and the manifest-derived identity facts |
| `tests/behaviour/identity-override.test.ts` | NEW | The override seam across both bins, including the invalid-override containment projection and the lenient self-description fallback |
| `tests/behaviour/prior-identity-config-fallback.test.ts` | NEW | Per-layer ordering, current-wins, honest origins, no writes, selected-file and machine-global exclusions |
| `tests/behaviour/prior-identity-state-fallback.test.ts` | NEW | Host-root precedence, no second root, override disabling, both-present shadowing, and the follow-on store root |
| `tests/behaviour/prior-identity-notice.test.ts` | NEW | One notice per source kind per composed program, text contract, distinctness from delivered warnings, no payload/exit change |
| `tests/behaviour/entrypoint-version.test.ts`, `tests/behaviour/entrypoint-help-isolation.test.ts` | CHANGED | Per-bin identity, parity, and isolation for both entries; the neutral-default controls move to an injected declared default |
| `tests/behaviour/daemon-start-detached.test.ts` | CHANGED | The child-environment allowlist control re-proven for the new identity's override and state-directory names |
| `tests/conformance/pilot/pilot-isolation.test.ts` | CHANGED | The delivered conformance cell that asserted the neutral identity now asserts an injected declared default |
| `tests/checks/identity-docs.test.ts` | NEW | Documentation-truth guard for the identity statements and the four declared divergences |
| `tests/checks/prior-identity-hermetic.test.ts` | NEW | Hermeticity guard: the fallback cases never read or write the operator's real home or state root |
| `tests/checks/support/arm-counters.preload.ts` | NEW | Test-only preload module arming the network/credential/sleep/write counters for the spawned hermeticity run (the static half lives in the hermeticity suite) |
| `tests/checks/install-launcher-installer.test.ts` | NEW | Installer integration cases: shells out to `scripts/install.sh` in a scratch home and project root, proving launcher registration, `--no-fetch`, idempotence, repointing, the classified failures, and outside-repository `--version` in the Bun-bearing test job (D9; replaces the shell suite) |
| `tests/checks/doc-conformance.test.ts` | CHANGED | The phrase-table page set reflects the corrected identity wording |
| `tests/fixtures/entrypoint/alias-baseline.json` | NEW | The delivered alias's observable baseline (version, help, paths, invalid-override projection) used as the byte-identity control |
| `tests/fixtures/entrypoint/prior-identity/` | NEW | The prior-identity checkout and home fixtures (config layers, host roots, shadowing and selected-file variants) |
| `.changeset/gh-320-jaiship-binary-minor.md` | NEW | Release bookkeeping: one lockstep minor changeset over the five publishables, per the GH-280..GH-310 convention |
| `doc/spec/features/feature-cli-entrypoint.md` | CHANGED | Two executables, identity selectors, install posture, prior-identity read, self-description member, the retired neutral default, and the delivered invalid-override projection |
| `doc/spec/features/feature-branding-seam.md` | CHANGED | The corrected literal invariant and the declared five-site inventory, `installPath` consumption, prior-identity derivation |
| `doc/spec/features/feature-config-layer.md` | CHANGED | Prior-identity per-layer fallback, precedence, the notice, unchanged skips and strictness, and the composition-time acquisition fact |
| `doc/spec/features/feature-projects.md` | CHANGED | Host-root prior-identity selection, the no-second-root guarantee, and the TDR-0022 extension wording |
| `doc/spec/features/feature-doc-distribution-marker.md` | CHANGED | Phase-7 documentation set: the installer's install set now includes the launcher registration, with its install-time runtime requirement and failure modes |
| `doc/guides/local-install.md` | NEW | The local install shape, the launcher path, the transition, the four declared divergences, and what is deliberately not renamed |
| `doc/planning/oss-tooling/backlog.md`, `doc/planning/oss-tooling/cli-command-registry.md` | CHANGED | The M4-S1 marker reflects the delivered first slice |
| `README.md`, `doc/00-index.md` | UNCHANGED | No public rebranding (NG-1, NG-2); the documentation profile stays absent, so `engineering-repo` behaviour applies |

The map and the plan describe one blast radius: the product and suite files listed above, the four specification pages, the phase-7 install-set page, the guide, the two planning markers, the changeset, and the two fixture entries. The installer integration cases live in the Bun test job (`tests/checks/install-launcher-installer.test.ts`) rather than in a `scripts/.tests` shell suite, which is why no CI-workflow file appears here (D9).

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a workspace install of the change branch, **when** `pnpm exec jaiship --version` runs with no working-name override, **then** stdout is `jaiship <version> (build <build>)` on one line and the exit code is `0`; and **when** the same invocation runs with a poisoned environment or an unreadable configuration file present, **then** the output and exit code are identical and no state, git, or configuration read occurs (ticket AC1) | F-1, F-2, NFR-1, NFR-2 |
| AC-F1-2 | **Given** the change branch, **when** `jaiship --help` and `delivery-os --help` are run, **then** the family rows are identical in content and order — the same 20 prompt-required families — and the only difference anywhere in the two outputs is the binary name; and **when** any family is removed from the composed set, **then** the comparison fails rather than passing vacuously (ticket AC2) | F-1, NFR-9, NFR-6 |
| AC-F2-3 | **Given** the change branch, **when** `delivery-os --version` and `delivery-os --help` are run, **then** they produce byte-identical output to the delivered behaviour for the same injected version and build, and **when** `delivery-os status --json` resolves paths, **then** it uses `.delivery-os` configuration and `~/.delivery-os-state` exactly as delivered with no prior-identity fallback; and **when** the alias runs with an invalid override, **then** it produces the delivered containment projection recorded in the alias baseline (ticket AC3) | F-2, NFR-7 |
| AC-F3-4 | **Given** a checkout with no `.jaiship` configuration and a `.delivery-os/config.yaml`, **when** `jaiship status --json` runs, **then** the prior file is read as the project-committed layer by the delivered composition-time configuration acquisition (which every composed invocation performs, so no command gains a read), its real path is reported as the loaded file and as the origin of the values it supplies, and no write, move, copy, or deletion occurs in the prior directory; and **when** both `.jaiship/config.yaml` and `.delivery-os/config.yaml` exist, **then** the current file wins and the prior file is reported as not used; and **when** a file is selected explicitly, **then** no layer falls back (ticket AC4 on the ticket's literal surface; DEC-14) | F-3, DM-2, NFR-4, DEC-14 |
| AC-F4-5 | **Given** no `JAISHIP_STATE_DIR` override, no `~/.jaiship-state`, and an existing populated `~/.delivery-os-state`, **when** `jaiship status --json` runs, **then** the prior host root is the effective root, the reported delivery state matches the delivered state of that root, and no `~/.jaiship-state` root is created; and **when** an absolute `JAISHIP_STATE_DIR` is set, **then** it wins and no fallback applies; and **when** both default roots exist, **then** the current root wins and the prior root is reported as not used (ticket AC4) | F-4, DM-3, NFR-4 |
| AC-F5-6 | **Given** a fallback read, **when** any command runs in any mode including `--json`, **then** exactly one notice per source kind per composed program is written to stderr (once per process in production), beginning with the classification token and the reason, naming the prior and current locations and stating that nothing was moved, copied, or deleted; and **when** the same composed program resolves configuration repeatedly, **then** no further notice appears; and **when** no fallback applies, **then** no notice appears; and **when** the store already holds a pre-GH-288 layout or an `ADOS_`/`.ados` source is present, **then** the respective delivered warning still appears as its own distinct line; and the payload and exit code are unchanged (ticket AC4; the per-source reading of "one-time" is DEC-10) | F-5, DM-4, NFR-3 |
| AC-F2-7 | **Given** `DELIVERY_OS_WORKING_NAME` is set, **when** either bin runs, **then** the override supplies the identity for both; and **when** the override is invalid, **then** `--version`/`--help` answer the invoking bin's declared default identity without failing, while any configuration-bearing command fails closed through the delivered containment identity `fallback.internal` at exit `2` — the resolver-level input error wrapped inside it, never surfaced as a CLI-visible classified error — with no fallback identity substituted; and **when** the alias runs that case, **then** its projection is exactly the delivered one, summary included (ticket task 1) | F-2, DEC-11, NFR-1 |
| AC-F6-8 | **Given** a local install run against the change-branch checkout with fetching disabled, a scratch home, a scratch project root, and an ambient working-name override in the installing environment, **when** the run completes, **then** an executable `~/.jaiship/bin/jaiship` exists — the brand install path, not an override-derived path — whose single target is that checkout's CLI entry, and **when** `jaiship --version` runs from a directory outside the checkout, **then** it prints the jaiship identity and exits `0`; and **when** the unchanged install is re-run, **then** the launcher is not rewritten; and **when** the recorded target is removed, **then** the launcher exits non-zero with one bounded line naming the target and the remedy; and **when** the install-time runtime is unavailable or the resolved source tree carries no CLI entry, **then** the install fails classified naming what is missing and writes no launcher (ticket AC6; DEC-15) | F-6, DM-5, NFR-5 |
| AC-F7-9 | **Given** the change branch, **when** `pnpm check` runs, **then** it is green, including the branch-range commit-message gate and the delivered entrypoint, configuration, state-scope, daemon-mount, events-mount, installer, and content-inventory suites (ticket AC5) | NFR-7, F-7 |
| AC-F7-10 | **Given** the change branch, **when** the structure suites run, **then** the CLI manifest declares exactly two executable identities mapping to two distinct existing entry files, the content inventory equals the actual file set with a per-file executable allowance for every executable file, the committed working-name literals match the declared five-site inventory under the declared `packages/**` scan rule — three CLI selector sites, the unchanged MCP default, and the resolver's scope-org derivation input — with every declared site found and every found literal declared, and no residual neutral default in the entrypoint module, and neither installer array names a binary, entrypoint, or composer while the launcher step is declared; and **when** any one of these is violated by an injected fixture, **then** the corresponding guard fails by name (ticket task 4) | F-7, DM-6, NFR-6 |
| AC-F8-11 | **Given** the change branch, **when** the documentation set is inspected, **then** the affected specification pages state the two-executable reality, the fallback and its notice, the install posture with its install-time runtime requirement and failure modes, the composition-time acquisition fact, and the host-root selection; the install-set/distribution-marker page states the launcher in the install set; the user-facing guide states the install path, the transitional behaviour, and **all four** declared divergences; and **when** the public surfaces are compared with the delivered ones, **then** the package scope, the scope org, `repositoryUrl`, `docsBaseUrl`, the README, the docs profile, the MCP default, the delivery-script shell fallback, and the installer's `ADOS_*` surface are unchanged (ticket task 5) | F-8, NG-1, NG-2, NFR-8 |

**Traceability.** Ticket AC1 → `AC-F1-1`; ticket AC2 → `AC-F1-2`; ticket AC3 → `AC-F2-3`; ticket AC4 → `AC-F3-4` (configuration half, on the ticket's literal `status --json` surface), `AC-F4-5` (state half), `AC-F5-6` (classified one-time notice); ticket AC5 → `AC-F7-9`; ticket AC6 → `AC-F6-8`. Ticket tasks that carry no AC of their own are covered by `AC-F2-7` (override seam, identity selection, and the delivered invalid-override projection), `AC-F7-10` (inventory and installer-absence truth), and `AC-F8-11` (documentation and the unchanged public surfaces). Every `F-` capability is exercised by at least one AC, and every `NFR-` is bound to at least one AC.

**AC4 surface note (deviation record).** The readiness gate recorded a surface change: prove the configuration half on the configuration inspection command. That surface is unreachable — `config` is not prompt-required, is dropped from the composed program, and answers `fallback.internal` at exit `2` through the executable — while `status --json` already performs the delivered composition-time acquisition and therefore reads `.jaiship`/`.delivery-os` project configuration today. `AC-F3-4` therefore keeps the ticket's literal `status --json` surface, and the change adds no acquisition to `status`. The correction, its evidence, and the preserved ticket wording are recorded as DEC-14 and disclosed for owner acceptance at the pull-request gate.

**Verification intent.** `AC-F1-1`, `AC-F1-2`, `AC-F2-3`, `AC-F2-7`, `AC-F5-6` are behaviour-level with injected streams, environment, clock, and run identity, plus one subprocess cell per bin for the real process edge. `AC-F3-4` and `AC-F4-5` are behaviour-level over fixture checkouts and a scratch home, with the state half additionally exercised against a scratch counterpart of this repository's host root so the real artifacts are never mutated. `AC-F6-8` and part of `AC-F7-9` are the Bun-level installer integration test plus the plan's single executable same-device `pnpm check` invocation. `AC-F7-10` is structure-level with an injected negative fixture per guard. `AC-F8-11` is a documentation comparison over the affected pages plus the unchanged-surface assertions.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full eleven-phase lifecycle on the change branch; plan phases declared in the plan; commits through the commit primitive with conventional subjects and every body/footer line within the configured limit; quality gates green before the pull request; the pull request targets the integration branch and **stops open**.
- The change must not merge before the active cross-repository lane lands, because the entrypoint and bin files are the shared hot surface. Sequencing, rebase, and the re-run of the gates after that lane lands belong to the readiness gate and the pull request.
- Adoption is additive for operators: the new executable works immediately, and the fallback means the first `jaiship` invocation shows the same configuration and state as the last `delivery-os` invocation. Nothing is migrated automatically, so no adoption step can half-complete.
- Documentation ships in the same change: the four affected specification pages, the install-set/distribution-marker page in the phase-7 documentation set, the user-facing install and transition guide, and the planning backlog marker.
- The transitional window ends at the public move (OQ-1). Until then, the four divergences are stated in the specification and the guide, and the override seam is the documented alignment mechanism for MCP.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. This change performs no migration, no seeding, and no backfill, and it introduces no migration command.

- Existing project configuration and host state stay exactly where they are; the fallback reads them in place.
- No artifact is written into a prior-identity directory, and no current-identity default host root is created while a prior root is in effect.
- The user-facing guide documents the optional one-step move of `.delivery-os` to `.jaiship` and `~/.delivery-os-state` to `~/.jaiship-state` as an operator action, including the fact that the fallback stops applying once the current-identity artifacts exist; that move is not automated here.
- The store layout, the host index, the project-key derivation, and every record family are untouched, so no schema version, record kind, or payload changes.

## 20. PRIVACY / COMPLIANCE REVIEW

No new personal data is collected, stored, or transmitted. The fallback reads locations the operator already owns and reports them as paths — never as values, file content, or credentials. The notice carries two paths, a classification token, and a bounded explanation, which is operational metadata about the local installation, not user content. No tracker, provider, or vendor data flow is added, and nothing leaves the machine: the install gate runs with fetching disabled and the launcher performs no network access.

## 21. SECURITY REVIEW HIGHLIGHTS

- The prior-identity read is bounded to two repository-owned configuration layers and one host state root; it never reads an arbitrary directory named by the environment, and prior-prefix environment overrides are not mapped, so an override cannot silently cross identities.
- The fallback is read-only with respect to the prior configuration directory, which removes any path by which a compromised or stale prior file could author a write into another identity's storage.
- The launcher execs one absolute target recorded at install time, with no `PATH` search for the product and no argument interpolation, which removes the usual PATH-hijack and injection surface for an installed shim. Its failure mode is a bounded diagnostic, never a silent success.
- The install path is not composed in the shell; it is read from the executable's own state-free self-description, so the shell cannot drift into a name-derived path that a later rename would silently mis-point.
- No new credential reference, secret, endpoint, or telemetry field is introduced; the notice is redaction-safe by construction and passes the delivered serialization path.
- `--strict` semantics are unchanged, so the fallback cannot be abused to bypass strict configuration validation.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Two executable names are now a maintained surface: the family-parity assertion and the shared launcher are the guards against drift, and a change to one bin's composition without the other must fail.
- The prior-identity fallback is transitional and must not become permanent. Its retirement (OQ-1), the corresponding notice removal, and the guide update belong to the M4-S1 remainder; the specification and the guide both say so, which is the reminder mechanism.
- The declared identity-literal inventory is the complete set of committed working-name literals: the three CLI selector sites, the unchanged MCP default, the resolver's scope-org derivation input, plus one installer layout reference. The delivered neutral default inside the entrypoint module is removed rather than retained, together with its `neutralWorkingName` accessor, and the entrypoint module's content-inventory allowance is reduced by that one name accordingly. The naming freeze must re-evaluate this inventory together with the seed set and the scan corpus baseline.
- The four declared divergences are operational contracts that must stay truthful as the product moves: MCP's own default and override read, the delivery-script shell fallback's pre-freeze host root, the `delivery-os` repository and docs URLs derived from the fixed scope org, and the installer's own `~/.ados` / `ADOS_*` surface. The installer additionally carries a declared install-time runtime requirement whose absence is a classified failure, not a skip.
- `status` is a configuration-acquiring surface and must stay documented as one: the composition-time acquisition it performs is the reason the ticket's literal AC4 surface works, and a future change that removes or replaces that acquisition must revisit `AC-F3-4` and `DEC-14`.
- A registered launcher is an operator-owned artifact outside the repository; it is not removed by this change, so a reinstall is the documented update path and a moved source tree requires a re-run.
- The new guide is a distributable document: it must declare its distribution marker and be registered in the forbidden-literal registry in the same change, and it must survive the documentation drift guard.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Identity | The working name from which every name-derived value is computed: binary name, environment prefix, config directory, state directory, tool prefix, docs and repository URLs, release asset prefix, install path |
| Identity selector | The declared fact at a process edge that names the identity a bin uses: one default working name, plus an optional prior working name |
| Prior identity | The identity a new identity inherits visibility from: the pre-freeze working name, whose configuration directory and host state root a new-identity invocation reads when its own are absent |
| Prior-identity fallback notice | The one classified notice reporting, per source kind per composed program, that a prior-identity artifact was used, or that it exists but was not used |
| Composition-time acquisition | The one read-only project-configuration acquisition the production composition performs before any handler, which is why `status --json` reads project configuration without gaining a read |
| Containment identity | The delivered `fallback.internal` identity (`exit 2`) that a composition gap — including a resolver-level name error thrown during composition — is reported through; it is not a CLI-visible classified resolver error |
| Project configuration | The repository-owned layers: `<repo>/<configDirectoryName>/config.yaml` (project-committed) and `config.local.yaml` (project-local) |
| Host root | The directory that holds host-wide delivery documents from which every project state root derives: an absolute `<PREFIX>_STATE_DIR` override, otherwise `<home>/<stateDirectoryName>` |
| Project state root | `<host root>/projects/<project key>` — the delivered store location for one checkout |
| Install path | The brand-derived location an installed executable belongs at: `~/<dot directory>/bin/<binary name>` |
| Launcher | The installed executable that hands the process to the runtime on one absolute CLI entry target with the invocation arguments passed through |
| Compatibility alias | The `delivery-os` executable, which keeps working unchanged, declares no prior identity, and keeps its delivered error projection |
| Declared divergence | A surface that deliberately keeps the pre-freeze identity in this slice: the MCP default and override read, the delivery-script shell fallback host root, the scope-derived repository and docs URLs, and the installer's own `~/.ados` / `ADOS_*` surface |

## 24. APPENDICES

### Appendix A: Identity derivation for the two declared selectors

| `BrandIdentity` field | `delivery-os` (alias, unchanged) | `jaiship` (new) | Note |
|---|---|---|---|
| `binaryName` | `delivery-os` | `jaiship` | Rendered by `--version` and in help |
| `environmentPrefix` | `DELIVERY_OS_` | `JAISHIP_` | Env layer names and the state-dir override name |
| `configDirectoryName` | `.delivery-os` | `.jaiship` | Project configuration directory |
| `stateDirectoryName` | `.delivery-os-state` | `.jaiship-state` | Host root default directory |
| `mcpToolPrefix` | `delivery-os_` | `jaiship_` | MCP keeps its own identity in this slice |
| `packageScope` | `@delivery-os` | `@delivery-os` | Fixed neutral scope; unchanged (NG-1) |
| `docsBaseUrl` | `https://delivery-os.github.io/delivery-os/` | `https://delivery-os.github.io/jaiship/` | Derived from the fixed scope org; moving it is out of scope (DEC-2) |
| `repositoryUrl` | `https://github.com/delivery-os/delivery-os` | `https://github.com/delivery-os/jaiship` | Accepted consequence of the fixed scope org (DEC-2) |
| `releaseAssetPrefix` | `delivery-os-` | `jaiship-` | Consumed by later release work |
| `installPath` | `~/.delivery-os/bin/delivery-os` | `~/.jaiship/bin/jaiship` | Consumed by the new launcher registration |

`SCOPE_ORG` is the resolver's committed `delivery-os` literal (`packages/core/src/branding/index.ts`). It is the scope-org input of `docsBaseUrl` and `repositoryUrl`, byte-equal to a working name, and is declared in the identity-literal inventory as a derivation input rather than an identity selector; the resolver is code-UNCHANGED.

### Appendix B: Notice and warning inventory after this change

| Concept | Kind | Trigger | Frequency | Where | Effect |
|---|---|---|---|---|---|
| Prior-identity fallback notice | Notice (new) | A prior-identity project config file was read, a current file shadowed it, a prior host root was used, or a current root shadowed it | ≤ 1 per source kind per composed program (once per process in production) | stderr, every mode | None on exit code or payload |
| Legacy compatibility notice (`ADOS_`/`.ados`) | Notice (delivered) | Pre-freeze environment names present, or the pre-freeze config directory exists | 1 per process | stderr | None |
| Pre-GH-288 store warning | Warning (delivered) | Host root holds store artifacts while the project root does not exist | 1 per state-opening invocation | stderr | None |
| Configuration warnings (`deprecated`, `shadowed`, `legacy`) | Configuration warning (delivered) | Layer/key semantics | Per resolution | stderr; `config.warning.strict` under `--strict` | May fail under `--strict`; the new notice never does |
| Invalid working-name override | Failure (delivered, unchanged) | The override or name is invalid and a configuration-bearing command runs | Per invocation | stderr and envelope | Delivered containment identity `fallback.internal`, exit `2` |
| Launcher missing target | Failure (new, local) | The recorded CLI entry target no longer exists | Per invocation | stderr | Non-zero exit |
| Installer launcher preconditions | Failure (new, local) | The install-time runtime is unavailable, or the resolved source tree has no CLI entry | Per install run | stderr | Classified failure naming what is missing; no launcher written |

### Appendix C: Source anchors

- Ticket: GitHub issue 320 (milestone "M4: Public release readiness"), story M4-S1a; backlog story M4-S1 in `doc/planning/oss-tooling/backlog.md`.
- PM clarify-scope summary and the four binding decisions: this change's `chg-GH-320-pm-notes.yaml`.
- Current-truth specification pages: CLI entrypoint (one non-installed bin, identity chain, install posture), branding seam (twelve values, derivation rules, literal scan, legacy adapter), configuration layer (seven layers, acquisition, skips, strict warnings), repositories and the host overview (host root, project root, one policy), plus the delivered change records for GH-171, GH-242, GH-173, and GH-288.
- Delivered code anchors consulted for current truth: the CLI bin and entrypoint, the production composer's scope and config composition, the branding resolver, the host-root policy, the file acquisition, the legacy adapter, the installer's modes and arrays, and the structure suites that pin the manifest, inventory, literals, and state-scope composition.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | @spec-writer | Initial specification |
| 1.1 | 2026-11-15 | @spec-writer | B-1 remediation: declared four-site identity-literal inventory; entrypoint neutral default removed rather than retained |
| 1.2 | 2026-11-15 | @spec-writer | DoR iter-1 remediation: AC4 configuration half proven on `status --json` via the delivered composition-time acquisition (unreachable inspection command recorded); delivered `fallback.internal` invalid-override projection restored for both bins; five-site identity-literal inventory declared under its scan rule; DEC-5/DEC-9 precedent status recorded without a new decision record; §16 reconciled to the plan's blast radius; installer preconditions, failures, `DRY_RUN`, and its `ADOS_*` divergence declared; doc-distribution page added; minors 14–19 addressed |
| 1.3 | 2026-11-15 | @pm | Blast-radius reconciliation: added `tests/checks/support/arm-counters.preload.ts` to the impact map (the D11 hermeticity harness half-b module) so the spec map and the plan scope are identical |

---

## AUTHORING GUIDELINES

- Authored from the GitHub issue 320 text (goal, five tasks, six verbatim acceptance criteria, the out-of-scope list), the PM clarify-scope summary and the binding PM decisions D1–D11 in this change's `pm-notes`, the readiness iteration-1 verdict and its findings, and the current-truth specification pages and structure suites named in Appendix C. Where a recorded decision's stated premise did not survive verification against the tree, the correction and its evidence are recorded in the decision log (DEC-14) rather than silently implemented. No invention beyond those sources: every verbatim ticket requirement is carried into a capability, a requirement, or an acceptance criterion.
- The seven design tensions the PM asked to be resolved are resolved explicitly and recorded as decisions rather than left implicit: the committed working-name literal (DEC-5, DEC-6), the configuration fallback mechanics (DEC-7, DEC-8), the state fallback versus the pure policy (DEC-9, and the structure-test amendment in §16), the notice classification (DEC-10), the install posture (DEC-3, DEC-12, DEC-13, DEC-15), the inventory and installer-absence expectations (F-7, AC-F7-10), and the declared divergences (DEC-4, §8.5, §22).
- Scope discipline: this specification states behaviour, contracts, precedence, and classification only. Mechanism choices inside a declared contract — the shape of the injected existence facts, the exact signature of the acquisition input, the launcher's literal text, and the file-level layout of the shared composition — belong to the plan.
- Tech-neutral phrasing with repo conventions: the one resolver, the declared identity selectors, the pure policy plus injected facts, closed vocabularies, once-per-composed-program notices, non-vacuous structure guards, and truthful performance all follow delivered precedent rather than introducing new patterns.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-320)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the pm-notes milestone verbatim ("M4: Public release readiness")
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, AC-, RSK-, DEC-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] Every ticket AC traces to at least one specification acceptance criterion
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability, mitigation, and residual risk
- [x] Scope limited to the ticket; out-of-scope items are marked `[OUT]`
- [x] No implementation task list and no code-level instruction beyond the declared contracts and the requested file-impact map
- [x] Every delivered-behaviour claim added in v1.2 was verified against the tree (the composition-time acquisition, the unreachable inspection command, the containment projection, the live literal sites)
- [x] The declared identity-literal inventory matches the live `packages/**` literals after the change (five sites, each with a declared role)
- [x] Front matter validates per the front-matter rules
