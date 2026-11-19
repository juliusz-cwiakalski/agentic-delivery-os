---
id: TDR-0044
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "The install lifecycle (install/upgrade/status/rollback/uninstall/purge) is a composed `install` command family inside the prompt-required composition, not a shell installer; a composed command is the only surface reachable through the installed binary and the only one that can carry the repository's typed-error contract, and the shell installer keeps only its delivered, guarded launcher step. `--add-to-path`, `--migrate`, `--dry-run`, and `--stop-daemon` are flags of that family; `rollback`, `uninstall`, and `purge` are subcommands, not flags."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os install surface (CLI composition) and local install tooling"
decision_scope: repo
review_date: null
business_impact: "M4 EC-1 requires the installed binary to perform all delivery. If the install lifecycle stays in bash, every later story either keeps a shell orchestrator in the delivery path or re-implements the same rules twice, and the prompt rewrite in M4-S7 has no command to call."
customer_impact: "An operator installs, upgrades, inspects, rolls back, and removes the product through one documented command that answers the same envelope and exit projection as every other command, instead of through a bash script whose code-only exit codes are not the product's failure contract."
classification:
  domains: [architecture, tooling, operations, contracts]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-346: the change specification is blocked on where the lifecycle lives)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis and this record)"
    - "@pm (GH-346 clarify_scope: the ticket's 'refused with a typed error' wording and the M4 EC-1/EC-7/EC-8 direction)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-346 PR review — this record adds a family to the prompt-required composition)"
  performers:
    - "@coder (GH-346 delivery: family registration, help entry, reference page, coverage fixture, error rows, installer guard)"
    - "@doc-syncer (CLI entrypoint, doc-distribution marker, local-install guide)"
  informed:
    - "M4-S2 namespace migration (owns the migration implementation the `--migrate` hook will call)"
    - "M4-S7 agent prompts on Jaiship primitives (calls this family instead of a shell script)"
    - "M4-S8 dogfood window and shell entry-point rewrite (thin wrappers)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A second product binary needs its own install lifecycle: decide whether the family is parameterized by identity or whether only the primary identity owns installation, rather than letting each binary grow a private installer."
  - "M4-S2 lands the migration implementation: the `--migrate` hook's typed refusal becomes a delegation, and this record's §6 boundary must be replaced rather than silently relaxed."
  - "The compatibility alias is retired: remove the alias refusal path and the `ownsInstallation` role fact instead of leaving a dead refusal in the handler."
  - "A package-manager or download channel is decided (M4 out of scope today): revisit whether `install` gains a source channel, because the current decision deliberately performs no network access."
  - "`pnpm check:help`'s page-root mapping is reworked: the M4 page branch added here is the only thing placing the reference page, so it moves with that rework."
links:
  related_changes: ["GH-346", "GH-320"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-cli-entrypoint.md"
    - "doc/spec/features/feature-doc-distribution-marker.md"
    - "doc/guides/local-install.md"
    - "doc/planning/oss-tooling/milestones/m4/install-model.md"
    - "doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md"
  contracts:
    - "packages/cli/src/help/prompt-required-commands.ts"
    - "packages/cli/src/help.ts"
    - "packages/cli/src/entrypoint.ts"
    - "packages/cli/src/production.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "scripts/checks/help-guide-coverage.ts"
    - "tests/fixtures/help-guide/coverage.json"
    - "scripts/install.sh"
    - "scripts/uninstall.sh"
  diagrams: []
  decisions: ["TDR-0045", "TDR-0046", "TDR-0047", "TDR-0048", "ADR-0009"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S1", "M4-S2", "M4-S7", "M4-S8"]
---

# TDR-0044: Install Lifecycle Surface — One Composed `install` Family Inside the Prompt-Required Composition

## Context

- **FACT:** GH-346 requires `install` with atomic replace, `--add-to-path`, `--migrate`, `upgrade`, `uninstall`/`purge` with a dry-run report, and an AC that "an install whose target is a worktree is **refused with a typed error**" (ticket body, read 2026-11-18).
- **FACT:** `install-model.md` designs the same lifecycle as `scripts/install-jaiship.sh` with flag forms — `--rollback`, `--uninstall`, `--purge --yes`, `--add-to-path`, `--migrate`, `--stop-daemon` — and classified script exits (read 2026-11-18).
- **FACT:** Reaching a command through the installed artifact requires membership in `PROMPT_REQUIRED_COMMANDS`: `selectPromptRequiredProgram` copies exactly that set and **drops every extra registration**, and a missing member throws a composition gap (`packages/cli/src/entrypoint.ts`, read 2026-11-18). `config` and `doctor` are the delivered proofs — both are registered in the command layer and both are unreachable through the binary (`doc/spec/features/feature-cli-entrypoint.md` §Composition, read 2026-11-18).
- **FACT:** The composed set is twenty-five families, and family parity between the two bins is an **exact** assertion with the count pinned (`PROMPT_REQUIRED_COMMANDS.length === 25`, `tests/behaviour/entrypoint-two-bins.test.ts`, read 2026-11-18).
- **FACT:** `pnpm check:help` requires a reference page per prompt-required command containing `--help` and `--version`, resolved through a per-command `pageFor` mapping whose roots are the M1 and M2 milestone page directories, with the inventory mirrored in `tests/fixtures/help-guide/coverage.json` (`scripts/checks/help-guide-coverage.ts`, read 2026-11-18). `pnpm check` runs it.
- **FACT:** The repository's typed-error contract is the result envelope plus an error-table identity from a closed `DOMAIN_KINDS` register, projected to the fixed `{0, 1, 2}` exit taxonomy (`success` 0, `user-validation` 1, `attention` 1, `platform-provider` 2); the projection module is the only place exit digits may appear (`packages/core/src/contracts/error-table.ts`, `packages/cli/src/projection.ts`, `.ai/rules/typescript.md` §7, read 2026-11-18).
- **FACT:** Shell scripts in this repository own a numeric exit taxonomy of their own (`scripts/uninstall.sh` documents `0/2/3/4/5`) and are governed by the bash rules, not by the result envelope (read 2026-11-18).
- **FACT:** The delivered local install already registers a **bash launcher** at the brand install path with one absolute target — the source tree's CLI entry — and classifies two install-time failures (no Bun runtime, no CLI entry) plus a plan-only `DRY_RUN` preview (`scripts/install.sh` `install_local_launcher`, `resolve_launcher_path`, `CLI_ENTRY_RELATIVE="packages/cli/bin/jaiship.ts"`, read 2026-11-18). That launcher is a declared installer step of the install set, and the documentation says no uninstall path exists (`doc/spec/features/feature-doc-distribution-marker.md` §The launcher registration in the install set, read 2026-11-18).
- **FACT:** `scripts/uninstall.sh` removes repository artifacts only (global agent/command files, local project copies); it has no binary, launcher, or `~/.jaiship` story (`scripts/uninstall.sh`, read 2026-11-18).
- **FACT:** The compatibility alias's brand install path is `~/.delivery-os/bin/delivery-os` (observed from `bun packages/cli/bin/delivery-os.ts --print-install-path`, 2026-11-18). GH-346 forbids introducing `ados`/`delivery-os` paths.
- **FACT:** Both bins declare their working name as a **non-exported** module constant (`packages/cli/bin/jaiship.ts:14,17`; `packages/cli/bin/delivery-os.ts:13`), and the structure guard fails any *exported* working-name literal while pinning exactly five literal sites, three of them under `packages/cli/bin/` (`tests/structure/entrypoint-bin.test.ts:135-158,163-181,305-311`, read 2026-11-18).
- **FACT:** `packages/cli/bin/jaiship.ts` calls `runBinLauncher(...)` in a top-level initializer (`:19-31`), so importing that module from the alias bin executes a second launcher composition inside the alias process — a second output line and a second exit-code write (`packages/cli/src/bin-launcher.ts:55-92`, read 2026-11-18).
- **FACT:** `brand.binaryName` is the sanitized derivation of the *invoking* process's effective working name (`packages/core/src/branding/index.ts:108-137`), so in the alias process it names the alias and never the owning identity.
- **FACT:** Moving both identity names into side-effect-free shared code rewrites a documented branding claim: `doc/spec/features/feature-branding-seam.md:23` states "exactly five sites" and "the three CLI selector sites", pinned by `tests/checks/doc-conformance.test.ts:434-452`, and the structure inventory's `packages/cli/bin/` count would move from three to one (read 2026-11-18).
- **FACT:** M4 EC-1 requires the installed binary to perform all delivery, EC-7 requires prompts to call Jaiship commands only with no shell-orchestration imperatives, and EC-8 rewrites `deliver-ticket.sh`/`ceo-loop.sh` as thin wrappers over the product (`doc/planning/oss-tooling/milestones/m4/README.md`, read 2026-11-18). M4-S7 rewrites `pm`, `ceo`, `coder`, `reviewer`, `committer`, `pr-manager`, `doc-syncer` prompts around product commands (`backlog.md`, read 2026-11-18).
- **FACT:** The product can install itself without a bootstrap script: `bun build --compile` produced a working artifact from `packages/cli/bin/jaiship.ts` in this checkout and the artifact answered `--version`, `--help`, and `--print-install-path` correctly, with `process.execPath` naming the artifact (measured 2026-11-18; see TDR-0045).

## Problem Framing (Clarified)

The question is not "script or command" in the abstract. Three concrete requirements decide it, and only one surface satisfies all three:

1. **Reachability through the artifact.** The cadence GH-346 documents is "install release → deliver iterations → decide → re-install", executed by the agent team. M4 EC-7 forbids the prompt from shelling out. Only a composed command is reachable through the installed binary; a script is reachable only if the operator (or a prompt, in violation of EC-7) invokes bash.
2. **Typed-error fidelity.** The ticket says the worktree refusal is a *typed error*. In this repository that is an envelope with a registered identity and a projected exit code. A bash installer can only offer its own numeric codes, which are a second, undocumented failure vocabulary for the same product.
3. **One implementation of one rule set.** The lifecycle rules (stability refusal, atomic replace, rollback slot, purge report) are also the rules M4-S2, S7 and S8 depend on. Implementing them in bash now and in TS later is the duplication the milestone exists to remove.

The residual question is therefore narrower: does the shell installer disappear, and what happens to its delivered launcher step? It does not disappear as a project-artifact installer, and its launcher step must be *guarded* rather than deleted, because deleting it would silently break an install-set contract that the documentation and structure tests currently pin.

A second residual question is identity. Family parity is exact, so the family appears in both bins' help; but the alias's brand path is a legacy namespace this ticket forbids creating. The family must therefore be *composed* for parity and *refused* for the alias with a typed error — advertised with its restriction, not silently rejected.

The identity question has a second half that is easy to state wrongly: **what may the refusal say?** The owning identity's name exists as a literal only inside the owning bin's own process edge, and that module composes a launcher when it is loaded. The alias process cannot derive the owner's name from its own brand (there `brand.binaryName` is the alias), cannot import it without a second composition, and cannot restate it without either a sixth identity literal or a moved branding claim. The refusal therefore has to be renderable from facts the refusing process actually has — and the record has to state that, because a sentence like "naming the owning binary, derived from the brand" reads implementable while being unimplementable.

## Constraints (Hard Requirements)

### C-1: The lifecycle is reachable through the installed artifact

- **Statement:** Every lifecycle operation (install, status, rollback, uninstall, purge) must be invocable as a composed command of the installed binary, with no shell script in the invocation path.
- **Source:** GH-346 AC ("clean-profile install works", "upgrade is explicit, reversible, and version-reported"); M4 EC-1; M4 EC-7.
- **Verification:** Test — each operation resolves through `runEntrypoint` on the composed program; no delivered prompt or guide instructs bash for these operations.
- **Negotiable:** no.

### C-2: Refusals are typed, not numeric-only

- **Statement:** Every lifecycle refusal carries a registered error identity from the closed domain register, an envelope, and the fixed exit projection; no lifecycle refusal is a bare process exit code.
- **Source:** GH-346 AC ("refused with a typed error"); `.ai/rules/typescript.md` §7; `packages/cli/src/projection.ts`.
- **Verification:** Test — each refusal asserts identity fields plus exit `1` or `2`; `scripts/checks/error-table-sync.ts` green with the new rows documented.
- **Negotiable:** no.

### C-3: No new `ados`/`delivery-os` paths; the alias keeps its identity behaviour

- **Statement:** No lifecycle operation creates or writes anything under a pre-freeze namespace; the alias keeps its working name, its derived paths, its version text, and its delivered projections.
- **Source:** GH-346 delivery conventions; GH-320 §8.5; `DELIVERY_OS_WORKING_NAME` seam.
- **Verification:** Test — `delivery-os` lifecycle invocation refuses with a named identity and writes nothing; a filesystem assertion proves no `~/.delivery-os` path is created by this change.
- **Negotiable:** no.

### C-4: Additive within the delivered contracts

- **Statement:** No delivered command changes behaviour; the new surface is one composed family plus its help entry, its reference page, its coverage row, and its error identities. No second state contract, no new secret storage, no configuration schema.
- **Source:** Prior additive discipline (ADR-0004, ADR-0006, TDR-0008, TDR-0035); GH-346 constraints.
- **Verification:** Review and test — existing family behaviour suites unchanged; config catalog unchanged; `pnpm typecheck` green.
- **Negotiable:** no.

### C-5: `pnpm check` stays green as a consequence of the decision

- **Statement:** The decision's conformance surface is declared, not discovered: prompt-required membership, the help inventory entry, the per-command reference page, the coverage fixture, the page-root mapping, and the family-count pins all move in the same change.
- **Source:** `pnpm check` script; `scripts/checks/help-guide-coverage.ts`; `scripts/checks/prompt-conformance.ts`.
- **Verification:** `pnpm check` green on the change branch.
- **Negotiable:** no.

### C-6: The delivered installer contract is not silently broken

- **Statement:** The delivered launcher step, its two classified failures, and its plan-only `DRY_RUN` preview keep their documented behaviour when nothing but the delivered launcher (or nothing at all) is at the brand install path; when anything else is at that path the step refuses, classified, instead of overwriting it. Both arms are keyed on what is at the path, never on the install record (TDR-0048 §1).
- **Source:** GH-320 §8.5 ("Install set is unchanged except for the launcher"); `doc/spec/features/feature-doc-distribution-marker.md`; `scripts/.tests/test-install.sh`.
- **Verification:** Test — the delivered installer suite stays green; a new case asserts the managed-binary refusal and that no launcher is written.
- **Negotiable:** no.

### C-7: No network in the lifecycle (this decision)

- **Statement:** No lifecycle operation downloads anything, and no lifecycle operation invokes a build tool.
- **Source:** `install-model.md` ("install performs no download"); M4 out-of-scope list (package-manager channels, auto-update).
- **Verification:** Review — no HTTP client, no child build process, in the family's composition.
- **Negotiable:** no.

## Decision Drivers

1. **One surface, one vocabulary.** A second failure vocabulary for the same product costs more than the composition membership it avoids.
2. **Reachability by the agent team.** The surface must be callable by prompts written against EC-7, without a shell imperative.
3. **Conformance cost, paid once and declared.** Adding a family is a bounded, mechanical conformance surface; maintaining two implementations is unbounded.
4. **Blast radius of the change.** Fewer new contracts today, but no rule implemented twice.
5. **Paved road.** Every other product capability already arrives as a prompt-required family with a help entry and a reference page; the install lifecycle is not special.
6. **Identity safety.** A legacy namespace must not be creatable by a new command.
7. **Reversibility.** A family can be reduced to a refusing stub or removed; a bash script that operators have wired into habits is harder to retire.

*(Overlap check: reachability, typed refusals, identity safety, additivity, and conformance are gates C-1…C-7; they appear above only as ranking values — "how much of the required surface arrives per unit of new contract". The gates decide eligibility; the drivers rank the survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-346: the specification is blocked on this question).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (ticket scope and applied conventions); `@decision-advisor` (analysis and record); `@spec-writer` (carries the family, flags, and refusals into the change spec).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`; the owner for acceptance.
- **Performers:** `@coder` (family, help entry, page, coverage fixture, error rows, installer guard, tests); `@doc-syncer` (entrypoint, doc-distribution, local-install guide).
- **Informed:** M4-S2 (migration implementation behind `--migrate`), M4-S7 (prompts call the family), M4-S8 (wrappers).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| Only `PROMPT_REQUIRED_COMMANDS` members are reachable through the binary; extras are dropped. | FACT | `packages/cli/src/entrypoint.ts` (`selectPromptRequiredProgram`), read 2026-11-18 | A non-prompt-required `install` command could be reachable, and the conformance cost would be lower. | High |
| The composed set is twenty-five families and parity is exact with a pinned count. | FACT | `tests/behaviour/entrypoint-two-bins.test.ts`, `feature-cli-entrypoint.md`, read 2026-11-18 | The alias-parity consequence would not exist. | High |
| A help page per prompt-required command is enforced by `pnpm check:help`, with per-command page roots. | FACT | `scripts/checks/help-guide-coverage.ts`, read 2026-11-18 | The page and page-root mapping could be skipped. | High |
| The typed-error contract is envelope + registered identity + fixed projection, and shell exits are a separate vocabulary. | FACT | `packages/core/src/contracts/error-table.ts`, `packages/cli/src/projection.ts`, `.ai/rules/typescript.md` §7, read 2026-11-18 | A script could carry "typed" refusals and ALT-1 would be eligible. | High |
| The delivered installer registers a bash launcher and declares no uninstall path. | FACT | `scripts/install.sh`, `feature-doc-distribution-marker.md`, read 2026-11-18 | The guard requirement (C-6) would be unnecessary. | High |
| The alias's brand install path is `~/.delivery-os/bin/delivery-os`. | FACT | `delivery-os --print-install-path`, observed 2026-11-18 | `delivery-os install` could be allowed and the identity question would disappear. | High |
| M4 EC-1/EC-7 and S7/S8 require a product-command lifecycle. | FACT | M4 `README.md`, `backlog.md`, read 2026-11-18 | ALT-1 (script) would remain defensible on direction grounds. | High |
| A compiled artifact can install itself with no bootstrap script. | FACT | `bun build --compile` run on `packages/cli/bin/jaiship.ts`, artifact executed, 2026-11-18 | A bootstrap shell step would be mandatory and ALT-3 would gain weight. | High |
| The owning identity's name cannot be produced in a non-owning process: the name is a non-exported bin constant, its module composes a launcher on import, the brand names the invoking identity, and any shared home moves a documented branding claim. | FACT | Context (four bullets); `packages/cli/bin/jaiship.ts:14,19-31`; `tests/structure/entrypoint-bin.test.ts:135-158,305-311`; `feature-branding-seam.md:23`; `doc-conformance.test.ts:434-452`, read 2026-11-18 | The refusal could name the owning binary and AC-F4-2's clause would stand as written. | High |
| A refusal that names the invoked identity, the owning role, and the documented remedy is adequate for an operator. | ASSUMPTION (product judgement, accepted by the owner at PR review) | This record §3 | The refusal is less directly actionable, and AC-F4-2's "names the owning binary" clause must be withdrawn. | Medium-High |
| No prompt or guide currently instructs bash for a lifecycle operation. | FACT | `doc/guides/local-install.md`, `.opencode/**`, read 2026-11-18 | C-1 would require a prompt edit in this change rather than in S7. | High |

## Mental Models & Techniques Used

- **First principles:** What must be true for the agent team to install the product without a shell? The operation must be a command, the command must be composed, and the composition must be honest about refusals. All three are delivered mechanisms.
- **Inversion:** How does this fail? A bash installer that the prompt is forbidden to call; two rule sets that drift; a `delivery-os install` that creates the namespace the ticket forbids; a family added to the composition without its page, fixture, or count pins so `pnpm check` breaks; a launcher step that overwrites the binary it was supposed to be replaced by. C-1…C-7 and §5's declared consequences exclude each.
- **Second-order thinking:** Adding the family costs one axis of conformance today and removes the permanent cost of two implementations, plus it makes S7 a prompt edit rather than a shell-orchestration rewrite.
- **Systems thinking:** The install surface is upstream of every later story — S2 migrates through it, S7 prompts call it, S8 wrappers delegate to it. A surface that is not a command would force each of those to reach into bash.
- **Least privilege:** The family performs no network access, invokes no build, and writes only inside the destinations its own record names.
- **Paved road:** Twenty-five delivered families with help entries and reference pages are the pattern; this record follows it instead of inventing a build-time shell surface.
- **Reversibility:** The family can be reduced to a refusing stub if the direction changes; the delivered launcher step is preserved rather than deleted, so no operator loses their current install path.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 reachable | C-2 typed refusals | C-3 no legacy paths | C-4 additive | C-5 check green | C-6 installer intact | C-7 no network/build |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the delivered launcher step only | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 `scripts/install-jaiship.sh` (install-model) | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-2 composed `install` family (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 script bootstrap + composed family | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 non-prompt-required `install` command | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails. ALT-3 is eligible but ranks below ALT-2 on drivers 1, 4 and 5 (see below).

### Alternative 0 — Keep the Delivered Launcher Step Only

- **Eligibility:** Not eligible (fails C-1, C-2).
- **Summary:** `scripts/install.sh` keeps writing the bash launcher, and the product gains no lifecycle surface.
- **Constraint compliance:** Fails C-1 (no lifecycle through the artifact) and C-2 (nothing is typed); passes the rest trivially because nothing is added.
- **Driver fit:** Fails 1, 2, 3, 5, 7; strong on 4.
- **Pros:** Zero new surface; the live defect is someone else's problem.
- **Cons:** The live defect (`TARGET` into a lane worktree) is exactly this design, and the ticket exists because of it; upgrade/rollback/uninstall cannot be delivered at all.
- **Why rejected:** It is the status quo the story is chartered to replace.

### Alternative 1 — `scripts/install-jaiship.sh` with Classified Exit Codes (install-model.md)

- **Eligibility:** Not eligible (fails C-1, C-2, C-6).
- **Summary:** One shell installer owns install/upgrade/rollback/uninstall/purge with numeric exits and its own precondition checks.
- **Constraint compliance:** Fails C-1 (unreachable through the artifact and forbidden to prompts by EC-7), C-2 (a second failure vocabulary, no envelope), C-6 (it *is* a second write path to the launcher, so the delivered step and it would both own the brand path). Passes C-3 (it can be taught to refuse the alias), C-4, C-5, C-7.
- **Driver fit:** Best on 4 (smallest single change); fails 1, 2, 3, 5, 6.
- **Pros:** Smallest blast radius today; the operator instinct for an installer is a script.
- **Cons:** The rules must be reimplemented in TS for S7/S8 or kept in bash forever; the typed-error AC cannot be met; two writers of the same install path.
- **Why rejected:** It cannot satisfy the ticket's own AC, and it contradicts the milestone's exit criteria.

### Alternative 2 — One Composed `install` Family Inside the Prompt-Required Composition (chosen)

- **Eligibility:** Eligible.
- **Summary:** `jaiship install` (install-or-upgrade), `install status`, `install rollback`, `install uninstall`, `install purge` as one composed family, with `--add-to-path`, `--shell-profile`, `--dry-run`, `--migrate`, `--stop-daemon` as its flags; the shell installer keeps only its delivered, guarded launcher step.
- **Constraint compliance:** C-1 by construction; C-2 through registered identities and the delivered projection; C-3 through the alias refusal and the brand-path-only destination; C-4 (one family, no delivered command touched); C-5 with the declared conformance surface in §5; C-6 by guarding the launcher step; C-7 by performing no network access and invoking no build.
- **Driver fit:** Best on 1, 2, 3, 5, 6; good on 4 (one new family with a bounded, enumerated conformance cost); good on 7.
- **Pros:** One implementation of one rule set; reachable by prompts; typed refusals; machine-readable `install status`; the alias cannot create a legacy namespace.
- **Cons:** Composition membership has a real conformance price (§5) and the alias advertises a family it refuses.

### Alternative 3 — Script Bootstrap Plus Composed Family

- **Eligibility:** Eligible.
- **Summary:** A tiny shell script performs the very first install (from a fresh checkout), and the family owns everything afterwards.
- **Constraint compliance:** Passes every gate, because the bootstrap performs only a *first* install and the family still owns the rules. The duplication is limited to one copy step.
- **Driver fit:** Fails 1 and 3 partially (two entry points and two failure vocabularies for the same first operation) and 5 (a new bootstrap surface nobody asked for).
- **Pros:** A single documented command for a brand-new machine; no build step visible to the operator.
- **Cons:** The bootstrap must repeat the target-stability rule and the identity probe, or it can install something the family would have refused — the exact divergence two surfaces always produce.
- **Why rejected:** The built artifact installs itself, so the bootstrap repeats a capability the product already has; the redundancy buys nothing and re-opens the divergence class.

### Alternative 4 — A Non-Prompt-Required `install` Command

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Register `install` like `config` or `doctor` and rely on the workspace entry point for invocation.
- **Constraint compliance:** Fails C-1 — extras are dropped from the composed program, so the installed binary answers `fallback.internal` at exit `2`.
- **Driver fit:** Best on 3 and 4; fails 2.
- **Pros:** No help page, no coverage row, no family-count pins.
- **Cons:** The feature would be unreachable precisely through the artifact it manages.
- **Why rejected:** It is the delivered `config`/`doctor` trap, and the ticket's whole subject is the installed binary.

## Decision

- **Decision:** Adopt ALT-2. The install lifecycle is **one composed `install` family** inside `PROMPT_REQUIRED_COMMANDS`; the delivered shell installer keeps only its guarded launcher step and owns none of the lifecycle operations.

### 1. Family shape

| Invocation | Purpose | Write? |
|---|---|---|
| `jaiship install` | Install or upgrade from the running compiled artifact (atomic replace, one rollback slot, install record) | yes |
| `jaiship install status` | Read-only report: running identity, installed record, rollback slot, target stability, state-format verdict | no |
| `jaiship install rollback` | Swap the single previous slot back into place | yes |
| `jaiship install uninstall` | Remove the entry point and the install record; keep config and state; report exactly what purge would delete | yes |
| `jaiship install purge` | `uninstall` plus the config and state roots; requires explicit confirmation | yes |

- **`upgrade` is not a separate verb.** Upgrade is `install` from a different compiled artifact; the operation is idempotent by construction (a different artifact replaces, an identical artifact rewrites nothing). A second verb would be an alias with no distinct semantics, and install-model's own wording ("upgrade = rebuild from the desired commit and re-run the installer") describes exactly this.
- The table is the **owning identity's** shape. The alias reaches the same five invocations through the same registration and refuses every one before any admission, destination, or record read (§3); it has no write path.
- **Subcommands, not flags, for the destructive forms.** `rollback`, `uninstall`, and `purge` are subcommands, superseding `install-model.md`'s `--rollback`/`--uninstall`/`--purge` flags. Rationale: a flag on a default-destructive verb is one typo from an unintended removal, a subcommand gets its own help page with its own exit codes and dry-run, and the composed-command pattern has no flag-with-mode-payload precedent.
- **Flags owned by the family:**
  - `--add-to-path` (+ `--shell-profile <path>`): appends exactly one managed block to the operator's shell profile, only when explicitly requested; derived from `$SHELL` when `--shell-profile` is absent, and refused with a typed error when neither yields a file.
  - `--migrate`: the migration **hook** (see §6).
  - `--dry-run`: plan-only preview for every write path — `install`, `install rollback`, `install uninstall`, `install purge` — printing the exact plan and writing nothing.
  - `--stop-daemon`: permits replacing the artifact while a live daemon is recorded (see TDR-0048 §4).
- **Global flags unchanged:** `--json`, `--verbose`, `--pretty` behave as on every other family; `install status` is the JSON-bearing surface.

### 2. Composition and reachability rules

- `install` joins `PROMPT_REQUIRED_COMMANDS` and therefore the production composer's unconditional registration, with its runtime (home directory, process facts, file-system port, clock, daemon status read, git worktree read) supplied by the production composition. Two failure classes stay distinct, exactly as the delivered entrypoint defines them: a **missing runtime** is a composition gap contained as `fallback.internal` at exit `2`, and it can never be answered by dropping the family or by shipping a partial surface; a **data** condition (no git metadata, an absent install record, no daemon instance) is answered by the handler as a typed outcome or refusal. The family is never absent from the composed program.
- Root help lists the family; `<install|install status|install rollback|install uninstall|install purge> --help` each resolve from the static help inventory with usage, options, examples, exit codes, and a see-also pointer.

### 3. Identity rule for the alias

- The family is composed for **both** bins, because family parity is exact and a per-binary composition difference would break the one shared launcher composition.
- **Ownership is a property of the executable identity, not of the rendered brand.** Each bin declares one additional **role fact** at the process edge — the boolean `ownsInstallation` — and the composer defaults to *not owning* when the fact is absent. `jaiship` declares `true`; `delivery-os` declares nothing. The fact is threaded as a composition fact (bin → `BinLauncherOptions` → production composer) and is deliberately independent of the working-name override: `DELIVERY_OS_WORKING_NAME=<other> jaiship …` is still an owning invocation because it is the same executable identity under another name, and the same override can never promote the alias. The role is never derived from `brand`.
- **The refusal names only what the refusing process can know.** A lifecycle invocation on a non-owning identity answers **one** typed refusal, `install.identity.not-owning`, at exit `1`, and it states three things: the invoked identity (from `brand.binaryName`, which in that process is the alias's *own* resolved name), that installation is owned by the primary identity, and the remedy — run the operation through the installed product binary, as the family's reference page and the local install guide document it. It writes nothing and creates no path.
- **Why the refusal does not name the owning binary.** The name is not derivable in the alias process: `brand.binaryName` there is the alias's own name; the primary name is a non-exported constant in a module whose import composes a second launcher; and restating it — in the handler, in a shared module, or as a second declaration — would either fail the identity-literal guard or move two declared sites and the documented five-site claim of `feature-branding-seam.md`, a branding contract this change does not own. Naming the owner by role and the remedy by the documented surface keeps the refusal honest, single-line, and free of a new derivation site. Where the brand *is* the owner — the primary bin's own messages, help, and reference page — the name appears, derived from that process's own brand. The remedy names documents, never a brand-derived URL: the alias's `docsBaseUrl` points at the pre-freeze namespace.
- The help entry states the restriction — the family is listed for both identities, and the alias's entries say that lifecycle operations are refused on it and where to run them — so the family is advertised *with* its limit rather than silently rejected.
- This is the concrete mechanism by which the ticket's "no `delivery-os` paths" constraint survives family parity: the alias's brand install path (`~/.delivery-os/bin/delivery-os`) is never created, because no lifecycle operation runs on that identity — and because the role is a bin declaration, no working-name override can turn the alias into an owner.

### 4. The shell installer's remaining role (delivered contract preserved)

- `scripts/install.sh` keeps its delivered launcher step unchanged **when nothing but the delivered launcher (or nothing at all) is at the install path**: same target, same idempotence, same two classified failures, same plan-only `DRY_RUN`, same `--tool` independence.
- When anything else is present at the brand install path — the managed artifact, the rollback slot, or any other content — the launcher step **refuses classified, names `jaiship install` as the update path, and writes nothing**. One predicate governs the guard: **what is at the path**, never the install record. An absent, `record-stale`, or deleted record is a legitimate reachable state (TDR-0048 §1), and keying the guard on it would let the launcher overwrite a managed artifact. This is the guard that stops the delivered shim from silently downgrading an installed product to a checkout pointer — the live defect class.
- `scripts/uninstall.sh` keeps its own scope and never deletes `~/.jaiship*` (see TDR-0048 §9 for the ownership split).

### 5. Declared conformance surface (the cost of this decision)

The change that implements this record must move all of the following, in one change, or `pnpm check` fails:

1. `packages/cli/src/help/prompt-required-commands.ts` — the family joins the set (25 → 26 families).
2. `packages/cli/src/help.ts` — family entry plus one entry per subcommand.
3. `packages/cli/src/production.ts` — unconditional registration with its runtime.
4. `scripts/checks/help-guide-coverage.ts` — a `pageFor` branch placing the page in `doc/planning/oss-tooling/milestones/m4/commands/install.md` (the M2 branch is the delivered precedent; the default root is the M1 snapshot root and must not serve a new family).
5. `tests/fixtures/help-guide/coverage.json` — the command and its page rows.
6. The new reference page with `--help` and `--version` present.
7. The pinned family count and every "twenty-five families" assertion move to twenty-six, including the two-bin parity and install-path suites.
8. `packages/core/src/contracts/error-table.ts` — one new domain kind (`install`) with its rows, and the rows documented in `doc/spec/features/feature-result-contract.md` (`error-table-sync` fails otherwise).

**Deliberately not on this list:** no identity-literal site, no `feature-branding-seam.md` sentence, and no `doc-conformance` row moves. The role fact is a boolean and the refusal renders only values the refusing process already has (§3), so the five-site branding claim and the three-under-`packages/cli/bin/` structure count stay exactly as delivered. A change that finds itself editing either of those has taken the rejected ownership-naming route.

### 6. `--migrate` boundary (M4-S2 owns the migration)

- Without `--migrate`, `install` **detects** prior-namespace artifacts (`~/.delivery-os*`, `<repo>/.delivery-os`) and prints one advisory line naming them and the operator's documented manual move. It never moves, copies, or deletes them.
- With `--migrate`, `install` accepts the hook and answers one **typed refusal** stating that migration is not available in this build and naming M4-S2 as its owner, with a remedy pointing at the documented manual move. This change composes no migration port, so the hook cannot silently no-op.
- **Rationale:** the ticket asks for the hook, not the migration. Shipping a flag that pretends to migrate would be a lie; omitting the flag would force S2 to change the surface in a breaking way. A typed delegation refusal is the honest seam.

### Amendment — DoR iteration 1: how the alias refusal names the owner (2026-11-18)

This record was amended before acceptance. §3 first required the non-owning refusal to name the owning binary "derived from `brand.binaryName`, no identity literal". Definition-of-Ready iteration 1 on GH-346 proved that derivation impossible and named the plan phase it blocked.

- **Evidence (all four clauses).** In the alias process `brand.binaryName` is the alias's own sanitized name (`packages/core/src/branding/index.ts`). The primary name is a non-exported constant (`packages/cli/bin/jaiship.ts:14`), and `tests/structure/entrypoint-bin.test.ts` rejects any exported working-name site while pinning five literal sites, three under `packages/cli/bin/`. Importing the primary bin executes `runBinLauncher` at module load (`packages/cli/bin/jaiship.ts:19-31`) — a second composition in the alias process, two output lines, broken alias byte-identity. The only remaining route moves two literal sites and the documented "exactly five sites / the three CLI selector sites" claim (`doc/spec/features/feature-branding-seam.md:23`, pinned by `tests/checks/doc-conformance.test.ts:434-452`), which no GH-346 plan phase declared. Source: `doc/changes/2026-11/2026-11-18--GH-346--installable-versioned-binary/readiness-review/readiness-iter-1.md` finding 2, read 2026-11-18.
- **Candidates weighed.**
  - *(1) The owning bin injects `{ ownsInstallation: true, owningBinaryName }`.* Rejected: the alias process never receives a value supplied by another process's edge, so `owningBinaryName` would be a contract field with no production consumer and its only exercised arm would be a synthetic composition. It also invites the reader to believe the name is available where it is not.
  - *(2) Chosen: a boolean role fact declared by the bin, and a refusal that names the invoked identity, the owning role, and the documented remedy (§3).* Implementable with zero new literal, zero export, zero module-load side effect, and zero inventory or branding-seam movement; the single-line assertion and the zero-write assertion are unchanged.
  - *(3) Keep a concrete binary name without a new literal and without module-load side effects.* No such route exists: the name cannot be derived in the refusing process, an export is rejected by the structure guard, an import composes a second launcher, and a shared side-effect-free module relocates two declared sites plus a documented branding claim. Each sub-route was checked against the delivered guard and rejected on the evidence above.
- **Correction.** §3 now states ownership as a bin declaration that is independent of the brand name and of the working-name override, and fixes the refusal's content as invoked identity + owning role + remedy. §1's table gains the note that the alias reaches the same five invocations and refuses all five. §5 now records that no identity-literal or branding-seam surface moves.
- **Consequence for the specifications that consume this record.** `AC-F4-2` and the `delivery-os install …` row must stop requiring the owning binary's name and name the invoked identity and the owning role instead; `TC-INST-004` asserts one line carrying those two facts plus the remedy (its zero-write and no-alias-namespace arms are unchanged); `TC-INST-002`'s restriction assertion keeps its structure and re-words the expectation to "the entry states that the alias does not own installation and where to run the lifecycle". No identity-literal inventory row, `feature-branding-seam.md` sentence, or `doc-conformance` row moves, and no phase gains a document.
- **Same-amendment correction (§4 guard predicate).** This correction rides the same DoR iteration-1 amendment: §4's launcher guard is keyed on one content predicate — anything at the brand install path that is not the delivered launcher — and never on the install record, whose tolerance states are declared in TDR-0048 §1.

### Constraint Compliance Attestation

The chosen alternative (ALT-2) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken. Two consequences are recorded rather than treated as exceptions: the alias's composed-but-refusing family is a **declared divergence** in the GH-320 §8.5 sense (its identity, paths, version text, and projections are unchanged; it cannot create a pre-freeze namespace), and the conformance surface in §5 is the priced cost of reachability, stated before delivery so it cannot be discovered as a surprise. `install-model.md` loses on **surface** and keeps its **mechanics**; the model document must be corrected in the same change.

**Reversal.** Removing the family's entry from `PROMPT_REQUIRED_COMMANDS` and its help/coverage/page artefacts restores the twenty-five-family surface; an already-installed artifact keeps running, and the installer guard stays because it prevents the shim from overwriting a managed binary whether or not the family exists.

## Trade-offs & Consequences

### Positive Outcomes

- One implementation of the lifecycle rules, reachable exactly where the product is installed.
- Typed refusals for every lifecycle failure, in the envelope and exit taxonomy every other command uses.
- `install status --json` gives CI and operators a machine answer to "which build is installed and is it compatible" without a bash script.
- M4-S2, S7, and S8 each get a surface to call instead of a script to wrap.
- The alias cannot create a pre-freeze namespace, and the delivered launcher step is preserved for adopters instead of deleted.

### Negative Outcomes

- The composed set grows from twenty-five to twenty-six families, and every pinned count and help-parity assertion moves. This is a real, enumerated diff, not a side effect.
- The compatibility alias advertises a family it refuses. The restriction is stated in the help entry, but it is a visible asymmetry between the two bins — a new declared divergence in the sense of GH-320 §8.5.
- `pnpm check:help`'s page-root mapping gains an M4 branch; a new milestone directory (`m4/commands/`) appears in the planning tree.
- A new error domain kind widens `DOMAIN_KINDS`, and its rows must be documented in the result-contract page or `error-table-sync` fails.
- The shell installer now carries a refusal path that has no precedent in its own suite; the guard is a new invariant to maintain.
- `install-model.md`'s surface sections (`Build and install flow` step 3, `Upgrade and rollback`, `Uninstall`) are superseded on **surface** while their **mechanics** (layout, atomic replace, one slot, record fields, PATH block, daemon refusal) survive as behaviour. **This record wins on surface**; the model document must be corrected in the same change rather than left contradicting the delivered product.

### Unresolved Questions

- [ ] Whether `install status` should be part of a broader operator preflight later (for example under `doctor`, which is currently unreachable). Owner: M4-S3 conformance work; nothing in this decision depends on it.
- [ ] The exact wording of the alias refusal and whether the alias's help row should appear in the "not available for this identity" section rather than the family table. Owner: `@spec-writer` (presentation, not contract).
- [ ] Whether `--add-to-path` should also offer a removal mode (a managed block without a remover is a small asymmetry). Owner: `@spec-writer`; `install uninstall` removing its own block is the natural home and is decided in TDR-0048.

## Implementation Plan

1. **Family registration.** Add `install` to `PROMPT_REQUIRED_COMMANDS`; implement the command module with the five entry points; register it unconditionally in the production composer with its runtime (home directory, process facts, file-system port, clock, daemon status read, git worktree read).
2. **Alias role fact.** Add the process-edge role declaration to the two bins and thread it through the launcher and composer as a composition fact defaulting to *not owning installation*; implement the typed refusal and its help note.
3. **Help and coverage.** Help inventory entries; M4 page root branch in `scripts/checks/help-guide-coverage.ts`; the reference page; the coverage fixture; the family-count and parity pins.
4. **Error identities.** Register the `install` domain kind and its rows; document them in the result-contract page; assert each refusal's identity and exit in tests.
5. **Installer guard.** Add the managed-binary refusal to `install_local_launcher` and its test; assert no write and the named remedy.
6. **Docs.** Correct `install-model.md` (mark the superseded surface, keep the mechanics), the CLI entrypoint page, the doc-distribution page, and the local-install guide.
7. **Tests.** Family reachability through the composed program for both bins (owning and non-owning identity), help resolution for every subcommand, each typed refusal, dry-run writing nothing, and the installer guard.

## Verification Criteria

- Metric: reachability — each of the five lifecycle operations resolves through the composed program of the **installed** binary shape (composed program object), with no shell invocation. Target: 5/5. Window: GH-346 CI.
- Metric: alias safety — a lifecycle invocation on the alias answers exactly one refusal line at exit `1` that names the invoked identity and the owning role and states the documented remedy; it creates no path under a pre-freeze namespace; and its help entry states the restriction. Target: exact, 5/5 entries, with a filesystem assertion. Window: GH-346 CI.
- Metric: ownership declaration — ownership follows the bin, not the brand: the alias refuses under a working-name override, the primary identity owns under the same override, and the refusal carries no owner-name derivation. Target: exact, both identities × with/without override. Window: GH-346 CI.
- Metric: branding surface — the identity-literal inventory is unchanged at five sites (three under `packages/cli/bin/`), and `feature-branding-seam.md`'s five-site claim and the `doc-conformance` rows are untouched. Target: exact. Window: `pnpm check` on GH-346.
- Metric: typed refusals — every refusal asserts a registered identity and the projected exit; no lifecycle failure path returns a bare exit code. Target: 100% of declared refusals. Window: GH-346 CI.
- Metric: conformance — `PROMPT_REQUIRED_COMMANDS` is 26; the coverage fixture, the page, the `pageFor` branch, and every pinned count agree. Target: exact. Window: `pnpm check` on GH-346.
- Metric: installer guard — with anything at the brand install path that is not the delivered launcher, the launcher step refuses classified, writes no launcher, names the owner command, and leaves the artifact at that path untouched, in each of the three record conditions: a `current` record, a `record-stale` record, and a record manually deleted or damaged; with nothing but the delivered launcher (or nothing at all) at that path, every delivered case is unchanged. Target: exact, 3/3 record conditions plus the delivered arm. Window: GH-346 CI.
- Metric: no network, no build — the family's composition constructs no HTTP client and spawns no build process. Target: exact (structure test over the composition). Window: GH-346 CI.

## Confidence Rating

**High** for the surface decision: reachability, the typed-error contract, the milestone exit criteria, and the prompt rewrite direction are all verified in the repository and in the milestone pack, and they all point the same way. **High** for the installer-guard requirement: the delivered step writes the brand path unconditionally, so without a guard it would overwrite a managed binary. **High** for the alias restriction: the role fact is a boolean declared at the process edge, the refusal renders only facts the refusing process has, and no identity literal, export, module-load side effect, inventory row, or branding-seam claim moves. (This was Medium-High while §3 required the refusal to derive the owning name from `brand.binaryName`; that requirement was unimplementable — see the amendment.) The residual risk is product judgement, not feasibility: whether a role-and-remedy refusal is as clear to an operator as an owner name would be, which the help entry and the reference page carry and the owner confirms at PR review.

## References

- GH-346 ticket body (task list and AC) — `gh issue view 346 -R juliusz-cwiakalski/agentic-delivery-os`
- M4 blueprint — `doc/planning/oss-tooling/milestones/m4/README.md` (EC-1, EC-7, EC-8; decisions D3, D6), `backlog.md` (S1, S2, S7, S8), `install-model.md`, `ranking.md`
- Delivered composition and reachability rule — `packages/cli/src/entrypoint.ts`, `packages/cli/src/production.ts`, `packages/cli/src/help/prompt-required-commands.ts`, `doc/spec/features/feature-cli-entrypoint.md`
- Expected CLI surface and its pinned quality evidence — `doc/spec/features/feature-cli-entrypoint.md` §Quality evidence
- Delivered installer and launcher contract — `scripts/install.sh` (`install_local_launcher`, `resolve_launcher_path`, `CLI_ENTRY_RELATIVE`), `doc/spec/features/feature-doc-distribution-marker.md` §The launcher registration in the install set, `doc/guides/local-install.md`, `doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md` §8.5/§17/§22
- Shell-side uninstaller scope — `scripts/uninstall.sh`
- Typed-error contract — `packages/core/src/contracts/error-table.ts`, `packages/cli/src/projection.ts`, `.ai/rules/typescript.md` §7
- Conformance surfaces — `scripts/checks/help-guide-coverage.ts`, `tests/fixtures/help-guide/coverage.json`, `scripts/checks/prompt-conformance.ts`, `scripts/checks/error-table-sync.ts`, `pnpm check`
- [TDR-0045](TDR-0045-self-contained-binary-build-identity.md) — the compiled artifact this family installs
- [TDR-0046](TDR-0046-install-target-stability-and-dev-build-exclusion.md) — the stability refusal this family carries
- [TDR-0047](TDR-0047-installed-binary-state-format-compatibility-check.md) — the compatibility verdict `install status` reports
- [TDR-0048](TDR-0048-upgrade-rollback-uninstall-purge-boundaries.md) — the operation semantics behind this surface
- [ADR-0009](ADR-0009-release-model-v1.md) — the release unit whose artifacts this family installs
