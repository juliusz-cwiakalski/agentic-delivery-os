---
change:
  ref: GH-242
  type: feat
  status: Proposed
  slug: agent-integration
  title: "M1-S20: Agent integration: prompts consume the tooling"
  owners: [engineering]
  service: delivery-os
  labels: [m1, m1-s20, agent-integration, cli, prompts, documentation]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: high
  dependencies:
    internal:
      - "Result contract and error table (GH-172)"
      - "pm-notes lint and phase transitions (GH-179)"
      - "Commit primitive and atomic phase completion (GH-227)"
      - "Machine-readable delivery plan schema (GH-226)"
      - "Typed blocker and question channel (GH-230)"
      - "Status digest (GH-243 / M1-S10)"
      - "Brief (GH-228)"
      - "Merge and verify deploy (GH-225)"
      - "Closeout transaction (GH-183 / GH-221)"
      - "Scheduling engine and queue/lanes (GH-237)"
      - "State layer, configuration layer, and branding seam"
      - "Harness adapters and headless one-shot transport"
      - "Agent and command definitions under `.opencode/**`"
      - "Generated Claude Code plugin under `.ados-claude/**`"
    external:
      - "Local git CLI (read-only inspection and the commit primitive's local landing)"
      - "GitHub/GitLab CLIs for PR/MR creation and push (unchanged by this change)"
      - "Harness headless one-shot invocation (unchanged; sanitized empty project context)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make coordination a set of tool calls rather than prose discipline by pointing every lifecycle agent at the delivered typed primitives — with a real executable surface, `--help`/`--version`, session-safe commits and phase transitions, typed blockers, and a deterministic end-to-end coordinator iteration proving the loop works on a pilot repository.

## 1. SUMMARY

M1-S20 closes the M1 integration story: the lifecycle agents (the PM-style coordinator and its lane agents) stop hand-writing phase state, hand-crafting commits, and using prose for blockers, and instead call the typed tool surface for every coordination step. The change supplies the minimum executable and self-description surface the prompts need (a neutral CLI entrypoint with `--help`/`--version`), reverses the GH-227 delivery-session refusal so `commit` and `phase complete` work where agents actually run, widens lifecycle completion staging to include the change folder, aligns the plan schema with the optional `summary` the commit path consumes, and reconciles every prompt, command, guide, command reference page, and system spec that describes the old behavior. The completion order writes the pm-notes transition before the commit act but restores the pre-write bytes on any failed act, so a phase is never reported complete without its ledger transition and no retry produces a second commit.

The acceptance evidence is not prose: a deterministic, fixture-backed pilot-repository conformance exercise drives `status` → `blockers answer` → `merge` → `closeout` → `queue plan` through the real CLI surface, with tracker, CI, and network stubbed and state, git, files, and envelopes real. A machine-enforced prompt/doc conformance scan and a help/guide coverage matrix keep the integration from decaying after this change.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **No executable entrypoint.** The typed CLI exists as `runCli(argv, streams, deps)`, invoked in process by tests and fixtures. The package has no `bin`, no `main`, and no production composition that assembles a program and runs it. `createConfigProgram` can assemble command definitions, but nothing composes it into a process.
- **No `--help` or `--version`.** The parser treats both as unknown flags or a missing command (`fallback.invocation`). The M1 man page promises `--help` on every command with examples and `--version` globally, so the documented surface and the delivered surface disagree.
- **Commits and phase completions refuse inside a delivery session.** `commit` and `phase complete` return `commit.session.context-refused` when the injected session facts say a session is active. The production edge does not currently supply session environment keys, but the contract blocks the intended adoption: lifecycle agents operate inside delivery sessions by definition. GH-227 DEC-6 is the recorded source of that guard; GH-227 NG-1 explicitly defers agent adoption to this change.
- **Lifecycle prompts still hand-write phase state.** The PM prompt instructs the agent to mark `clarify_scope`, `specification`, `test_planning`, `delivery_planning`, `dor_check`, `delivery`, `system_spec_update`, `review_fix`, `quality_gates`, `dod_check`, and `pr_creation` started/completed by editing the pm-notes YAML, and records the PR URL under `phases.pr_creation.url`.
- **Lifecycle prompts still hand-craft commits.** `@committer` performs `git add -A`, `git commit -F`, re-staging, forbidden-path exclusion, and a post-hook amend. The PM and coder prompts delegate to it per phase; the `/commit` command is a thin wrapper over the raw-git agent. GH-227 NG-1 deferred re-pointing these prompts.
- **The coordinator prompt is bash-centric.** `@ceo` uses `deliver-ticket.sh` for per-ticket delivery and `gh pr merge --squash` for merging; it reads the `result`, `pr_url`, `exit_code`, `closeout_unverified`, and `last_message` key=value summary; it uses `ceo-loop.sh --status` and `deliver-ticket.sh --status` for process state. It does not use `status`, `blockers`, `merge`, `closeout`, or `queue plan`.
- **Typed blockers exist but prompts do not use them.** `blockers publish/list/answer` is delivered and feeds the digest and brief. Lifecycle prompts still describe blockers as prose in ticket comments or PM notes; the pm-notes `blockers:` collection remains schema-allowed.
- **The plan contract omits the optional `summary` the commit path consumes.** The plan writer emits `delivery.plan.v1` without a phase `summary`; the commit context reader tolerates and consumes a raw `summary` field from plan YAML, so the producer and consumer disagree about the declared schema. Nothing consumes a `tasks` key, and progress is recorded in pm-notes `notes:`.
- **`phase` has no `start` subcommand.** `phase complete` creates a missing phase entry with `started` and `completed` set to the completion timestamp. A separate start transition is not needed for the intended agent flow and would add a second write path.
- **Plan-absent staging cannot commit new artifacts.** In `plan-absent` mode untracked files are strays and are never staged, so an artifact phase (`specification`, `test_planning`, `delivery_planning`) cannot commit a newly created spec, test plan, or plan through `phase complete`.
- **The completion commit currently excludes the pm-notes transition.** The completion act stages and commits first, then writes the pm-notes document; the change-folder scope alone does not make the transition part of the commit.
- **The remaining primitives are delivered as their own surfaces.** `status`, `brief`, `queue` (`list`/`plan`/`add`/`prioritize`/`dep`/`claim`/`release`), `lanes`, `merge`, `closeout`, `verify`, `spend`, `retro`, `config`, `doctor`, `db`, and `watchdog` exist as CLI commands. `mcp` is a **separate package surface** (`@delivery-os/mcp`), not a CLI command. `state` is delivered as a **state layer with no command surface** (`tests/structure/state-scope.test.ts` fails if a `state` command is registered or implemented; `feature-state-layer.md` states the layer ships no command surface); the `state` command page is M1-planned, not delivered. `dispatch` (M1-S9) and the resident daemon (M1-S18) are not delivered and must not be claimed.
- **The Claude plugin is generated.** `.ados-claude/**` is generated from `.opencode/**` by `scripts/build-claude-plugin.sh`; any prompt or command change must regenerate it or CI fails.

### 2.2 Pain Points / Gaps

- **Coordination depends on agent discipline.** The same state is written two ways (pm-notes edits and ledger transitions), so drift, duplicate timestamps, and "completed without evidence" are possible and only review catches them.
- **Commit spend and inconsistency remain.** Even after GH-227 delivered the primitive, every commit still goes through the raw-git subagent loop, paying tokens and latency and depending on the agent's staging judgment.
- **The typed surface is not invokable by an agent.** A prompt cannot call `runCli` in process; without a binary entrypoint the primitives are library code, not tools.
- **The prompts cannot discover usage.** No `--help` means an agent must read source or prose guides to learn flags, examples, and exit codes; the man page's promise is unfulfilled.
- **The session guard blocks the intended operating model.** The lifecycle agents run inside delivery sessions, so the primitive refuses exactly where it is needed.
- **Artifact phases cannot commit their artifacts.** New spec/test-plan/plan files are untracked and fall outside the plan scope, so the "record plus commit" story fails at the phases where the artifacts are born.
- **Blockers are not machine-readable.** Prose blockers cannot rank in the digest, cannot be answered as data, and cannot drive `status`/`brief`.
- **The coordinator rediscovers work.** `gh pr list`, raw `gh pr merge`, and manual queue discovery spend coordinator tokens on facts the typed surfaces already compute.
- **Documentation and prompts diverge.** The man page, command reference pages, `AGENTS.md`, the lifecycle guide, and the unified change convention each describe a different commit/phase model.

## 3. PROBLEM STATEMENT

Because the typed primitives have no executable entrypoint, no `--help`/`--version`, and a delivery-session guard that refuses where lifecycle agents operate, the prompts continue to hand-write phase state, hand-craft commits, and coordinate through bash and prose; as a result coordination remains dependent on agent discipline, the delivered primitives cannot be adopted, phase transitions and their artifacts can diverge, and there is no end-to-end evidence that the M1 coordinator loop works on the tooling alone.

## 4. GOALS

- **G-1**: Provide a neutral executable entrypoint that composes the prompt-required commands and implements `--help` and `--version`, without hardcoding the product name and without adding the tool to the installer.
- **G-2**: Make the `phase` family the only write path for lifecycle phase state: agents complete phases through `phase complete`, and no prompt instructs a hand edit of `started`, `completed`, or `phases.pr_creation.url`.
- **G-3**: Make `commit` the only commit path in lifecycle prompts: `@committer` becomes a thin executor of the primitive, and no lifecycle prompt instructs `git add`, `git commit`, or a hand-crafted commit.
- **G-4**: Make `commit` and `phase complete` usable inside delivery sessions while keeping the harness one-shot transport in a sanitized empty project context.
- **G-5**: Make lifecycle completion stage the phase's mapped plan scope together with the change folder, including the pm-notes transition, so artifacts and their transition commit atomically and unrelated strays stay unstaged.
- **G-6**: Make typed blockers the only blocker channel for lifecycle agents, and make the digest/answer loop the coordinator's blocker path.
- **G-7**: Make the coordinator J1 iteration a sequence of typed calls (`status`, `blockers answer`, `merge`, `closeout`, `queue plan`) while retaining the bash per-ticket dispatch until M1-S9.
- **G-8**: Align the plan schema with the optional phase `summary` consumed by the commit path; keep progress out of the plan and do not add a `tasks` key.
- **G-9**: Give every typed call the prompts require a `--help` surface and a reconciled man-page-grade guide, and keep the key=value machine summaries on every replaced surface.
- **G-10**: Prove the integration with a deterministic, fixture-backed pilot-repository conformance exercise that runs one full J1 iteration through the real CLI surface.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Lifecycle prompt instructions that write phase timestamps or `phases.pr_creation.url` | 0 |
| Lifecycle prompt instructions that perform a raw-git commit (`git add`, `git commit`, `git commit -F`) | 0 |
| Lifecycle prompt instructions that use a retired bash entry point as the primary path | 0 |
| Prompt-required typed commands with a `--help` surface | 100% |
| Prompt-required typed commands with a reconciled reference page | 100% |
| Key=value regressions on `merge`, `queue`, `verify`, `plan`, and `blockers` text surfaces | 0 |
| Full J1 pilot iterations passing deterministically | 1 per conformance run, byte-identical across two runs |
| `--help`/`--version` isolation: state, network, git, or configuration reads and writes | 0 reads, 0 writes; the command completes inside the suite's fixed timeout (wall-clock timing is recorded as informational, not a gate) |
| Prompt-required commands composed by the entrypoint | Exactly the §8.1 set; `state`, `mcp`, `dispatch`, and the resident daemon asserted absent |
| Uncomposed commands returning a silent success or an unclassified failure | 0 (each returns the classified failure declared for an unavailable composition) |
| Entrypoint brand-literal violations | 0 |
| §16.1 current-truth docs still containing their stale phrase | 0 |
| Generated Claude plugin drift | 0 |
| Conformance suite runtime | Within the suite's fixed timeout (≤ 180 s on the reference environment) |

### 4.2 Non-Goals

- **NG-1**: Delivering `dispatch` (M1-S9) or the resident daemon (M1-S18); no prompt may claim either.
- **NG-2**: Installer, packaging, release, or public install-path changes; the entrypoint is not added to the installer in this change.
- **NG-3**: New tracker integrations (Jira/GitLab parity, new providers) or changes to the tracker MCP/CLI surface.
- **NG-4**: The full MCP tool surface; `mcp serve` remains its own surface, and this change does not add command parity to it.
- **NG-5**: Memory commands, memory-tier changes, or agent-memory policy changes.
- **NG-6**: Rolling back to bash, retiring `deliver-ticket.sh`/`ceo-loop.sh`, or removing the retained bash fallback.
- **NG-7**: Changing commit message generation, safety scanning, staging precision for standalone commits, or any existing envelope/output shape.
- **NG-8**: New state record kinds, projections, or migrations; the change consumes the existing ledger and telemetry.
- **NG-9**: Re-implementing `status`, `merge`, `closeout`, `queue`, or `blockers`; this change adopts them and composes them behind the entrypoint.
- **NG-10**: Adding a `state` CLI command or folding `mcp` into the CLI command surface. The state layer ships no command surface in this build, and `mcp` is its own package surface; neither is composed or claimed by the entrypoint.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Executable entrypoint and self-description | Prompts cannot consume a primitive with no invocation path, and agents need `--help`/`--version` to use it correctly. |
| F-2 | Phase-state sole-write adoption | One write path removes pm-notes/ledger drift and makes phase evidence durable. |
| F-3 | Typed commit adoption and thin `@committer` | Removes the raw-git loop while preserving the compatibility entry point. |
| F-4 | Delivery-session guard reversal | The intended operators run inside sessions; the guard blocks adoption. |
| F-5 | Lifecycle completion staging and ordering | Artifacts and their transition must land together; strays must not. |
| F-6 | Typed blocker adoption | Makes blockers rankable, answerable as data, and visible in the digest and brief. |
| F-7 | Coordinator J1 loop adoption | Turns the core M1 loop into tool calls and removes token spend on rediscovery. |
| F-8 | Plan `summary` alignment | Aligns producer and consumer and keeps progress out of the plan. |
| F-9 | Prompt/doc/help/guide conformance | Keeps the integration from decaying and satisfies the ticket's help/guide AC. |
| F-10 | Deterministic pilot conformance evidence | Proves the end-to-end J1 iteration on the tooling alone. |
| F-11 | Key=value machine-summary continuity | Preserves the bash-era machine contract on every replaced surface. |

### 5.1 Capability Details

- **F-1 — Executable entrypoint and self-description.** The typed CLI gains a production entrypoint: a **non-installed bin entry** (a Bun-shebang executable under the CLI package's `bin/` directory, mapped in the package `bin` manifest) plus a `main`/composition entry. "Executable" in this spec means exactly that bin plus the composition it invokes — not an in-process function that only tests can call. The composition resolves the working name in the order typed configuration → non-empty `DELIVERY_OS_WORKING_NAME` override (the override wins when both are present, per the branding seam) → the neutral default `delivery-os` when neither yields a name. The neutral default is the same one the MCP composition already uses, is used for `--help`/`--version` identity only, and is not the forbidden seed literal. The composition then composes the prompt-required command definitions and invokes the existing in-process surface. `--version` prints the product/binary identity and build/version information; root `--help` lists command families; `<command> --help` prints usage, options, at least one example, exit codes, and a pointer to the reference page. `--help`/`--version` perform no state, network, git, or configuration read and no write, and never require a valid project configuration. Command help remains available even when that command's runtime composition is not configured, so an agent can discover usage before credentials exist. The entrypoint must not embed the seed name literal in `packages/**`; the bin is not added to `scripts/install.sh`, and installer tests stay unchanged.
- **F-2 — Phase-state sole-write adoption.** Lifecycle agents complete phases with `phase complete <ref> <phase>` and read state with `phase list <ref>`. `phase reopen` remains the only reopen path. Prompts do not tell an agent to set `started` or `completed`; they rely on the completion's own document staging. `phase complete` creates a missing entry, so no `phase start` subcommand is added. The PR URL is recorded as a pm-notes `notes:` entry, not as `phases.pr_creation.url`; the prompt writes that note before completing `pr_creation` so the completion commit carries it.
- **F-3 — Typed commit adoption and thin `@committer`.** Every lifecycle commit is produced by `commit` (standalone or the atomic phase completion). `@committer` becomes a thin executor: it accepts the same caller context, invokes `commit` with the resolved ref and phase context, and reports the envelope; it performs no staging, no `git add`, no `git commit`, no re-stage/amend loop, and no independent message composition. Caller `outcome`/`why`/`verification` hints remain contextual only; the primitive's computed message is authoritative. Prompts call `commit` directly when the caller owns the commit trigger, or delegate to the thin `@committer` when a compatibility boundary requires an agent. The safety scan, staging precision, message generation, telemetry, and convergence remain the primitive's contract.
- **F-4 — Delivery-session guard reversal.** The `commit` and `phase complete` refusal is removed. The commands run inside a delivery session and outside it. The harness one-shot transport continues to run in a temporary empty project context with sanitized environment and no delivery-session facts. The `commit.session.context-refused` error row is retired with the guard; the `commit` domain shrinks from six rows to five, and the machine table, documented table, fixtures, and sync check move together. A TDR records the reversal and supersedes GH-227 DEC-6; it is authored via `@decision-advisor` before delivery (identifier assigned there).
- **F-5 — Lifecycle completion staging and ordering.** A lifecycle completion's staging set is the mapped plan-phase scope union the change folder for the change ref. This applies to every lifecycle phase: planning phases map to planning-kind plan phases where a plan exists, delivery maps to every delivery-kind plan phase, and a lifecycle phase with no plan-phase correspondence contributes the change folder. Standalone `commit` keeps the plan union; when no plan exists, a standalone commit may stage the change folder for the change ref. In every case, unrelated untracked strays are never staged, forbidden paths and oversized binaries remain excluded, and tracked scope drift remains disclosed. The completion's pm-notes document update and the phase's artifacts must be present in the completion commit; the current order (commit first, document write second) is reversed so the transition document is not left out of the commit.

  The reversed order carries a **reverse failure window** that must converge, not merely be documented. Before writing, the completion snapshots the pre-write pm-notes bytes. A phase is complete **only when the ledger transition lands**: the working-tree document write is a projection, not the completion. If the commit act fails after the document write — safety STOP, staging refusal, commitlint failure, or an atomic abort — the completion restores the pre-write pm-notes bytes, leaves the ledger without a transition, and returns the classified failure; it never leaves the derived projection ahead of the ledger. If the restoration itself fails, the completion exits with code `2`, reports a classified platform fault, and states the reconciliation instruction (the affected pm-notes path and the pre-write snapshot source); it does not claim success. A retry after any failed attempt converges to **exactly one transition and exactly one commit** — never an extra commit, never a transition without its commit. If a document write fails after a commit has landed (the legacy window), the re-run converges the document from the stored transition and never re-commits.
- **F-6 — Typed blocker adoption.** Lifecycle agents publish blockers with `blockers publish <type> --lane <id> "<question>" [--options ...]` and consume them with `blockers list`/`status`. The coordinator or the owner answers with `blockers answer <id> --choice <n>` or `--text`; the audience routing and delegation policy determine who may answer. The pm-notes `blockers:` collection remains schema-allowed but is not an agent write target. Lane identifiers in prompts use a stable role-plus-ref convention (for example the PM lane for a change, the coder lane for a change, or the coordinator lane) defined in the guide; no new lane registry is introduced. Credential questions carry the variable name only and the channel's value refusal is unchanged.
- **F-7 — Coordinator J1 loop adoption.** The coordinator prompt runs the J1 iteration as `status` (digest, including typed questions and ready-to-merge) → `blockers answer` for open questions → `verify change`/`phase list` for finalization → `merge` for each ready item → `closeout --apply` → `queue plan --next N` for the next pick. It uses `brief` for the owner-facing view, `lanes list/show` and `queue list/claim/release` for lane state, and `spend`/`retro` for the learning boundary. It must not use `gh pr list` or `gh pr merge` as the primary path. `scripts/deliver-ticket.sh` remains the primary per-ticket delivery path until M1-S9 and is explicitly retained, not retired; `scripts/ceo-loop.sh` remains the outer process supervisor until M1-S18.
- **F-8 — Plan `summary` alignment.** `delivery.plan.v1` gains an optional, non-empty `phases[].summary` string. The plan validator accepts it, the plan writer may emit it, and the commit path consumes it as it already does. A plan without `summary` remains valid. No `tasks` key is added; plan-phase progress stays in pm-notes `notes:` entries naming the plan phase id, commit hash, and test result. Per-plan-phase coder commits use standalone `commit` with the plan-union scope; the ledger records lifecycle phases only, and `phase complete delivery` is the lifecycle boundary.
- **F-9 — Prompt/doc/help/guide conformance.** Every prompt in the lifecycle inventory is updated to the allowed command set and the no-raw-commit invariant. Every prompt-required command has `--help` and a reconciled man-page-grade reference page. `AGENTS.md`, the change-lifecycle guide, the unified change convention, the M1 command reference pages, and the affected system specs are reconciled in the same change. The system-spec reconciliation includes the pages that still describe the replaced behavior: the delivery-lifecycle page ("all commits route through `@committer`", "No agent prompt other than `@committer` performs a direct `git commit`"), the quality-gates-and-PR page (the `@committer` temp-message-file and post-hook-amend workflow), the autonomous-delivery page (the CEO `gh pr merge --squash`/`glab mr merge` authority), and the local-code-review page (the review-triggered `/commit` path). `.ados-claude/**` is regenerated. A deterministic conformance scan enforces the invariants and a coverage matrix enforces the help/guide obligation.
- **F-10 — Deterministic pilot conformance evidence.** A fixture-backed pilot repository is seeded with a change folder, a validated plan, pm-notes, a state store, and a local bare remote. Tracker, CI, PR-platform, and provider/network surfaces are stubbed, and clock and id generation are deterministically injected; state, git, files, envelopes, text renderers, and exit codes are real. The suite drives `status` → `blockers answer` → `merge` → `closeout` → `queue plan` through the CLI surface, asserts the expected next action, asserts no outbound network, and asserts byte-identical output across two runs.
- **F-11 — Key=value machine-summary continuity.** The existing key=value grammar on `merge`, `queue`, `verify`, `plan`, and `blockers` text surfaces is preserved without output-shape changes. The retained `deliver-ticket.sh` summary (`result`, `pr_url`, `exit_code`, `closeout_unverified`, `last_message`) remains the per-ticket delivery contract. The register in Appendix A is the conformance list.

## 6. USER & SYSTEM FLOWS

```
Flow 1: PM artifact phase (specification / test_planning / delivery_planning)
  PM delegates the artifact author
    → author writes chg-<ref>-spec.md (or test-plan / plan) and returns
    → PM records decisions/notes in pm-notes (no phase timestamps)
    → PM runs: phase complete <ref> <phase>
        → phase family validates grammar, snapshots the pre-write pm-notes bytes,
          and lints the post-transition document
        → completion stages mapped plan scope ∪ the change folder (for a planning
          phase with no plan yet, the change folder carries the new artifact)
        → pm-notes transition is written before the commit act
        → safety scan → commit object → ledger transition append (atomic)
        → success (the phase is complete only when the ledger transition lands):
          envelope: phase, state, atomic, commitSha, stagedFiles
        → failure after the document write (safety STOP, staging refusal,
          commitlint failure, atomic abort):
              restore the pre-write pm-notes bytes; ledger keeps no transition;
              no completion claimed; return the classified failure
        → if restoration itself fails: exit 2, classified platform fault,
          reconciliation instruction; never claim success
        → retry after a failed attempt: exactly one transition, exactly one commit
    → PM proceeds to the next phase; no @committer raw-git loop

Flow 2: Coder plan phase and lifecycle delivery boundary
  Coder executes plan phase N within its declared scope
    → runs focused tests
    → runs: commit <ref>            (standalone, plan-union scope)
        → computed conventional commit; no agent-authored message
    → records a pm-notes notes: entry for plan phase N (plan phase id, commit hash, test result);
      the note lands in the next checkpoint commit
    → on a blocker: blockers publish <type> --lane <id> "<question>" [--options ...]
    → at the end of the lifecycle delivery phase: phase complete <ref> delivery
        → mapped delivery-kind plan scope ∪ change folder, atomic record + commit

Flow 3: Coordinator J1 iteration
  Coordinator starts an iteration
    → status --json                       (digest: typed questions, ready-to-merge, spend, parked)
    → if open questions: blockers answer <id> --choice <n> | --text <answer>
    → for each ready item:
         verify change <ref>              (variant-aware finalization verdict)
         phase list <ref>                 (lifecycle phase evidence)
         merge <ref>                      (gates fresh, squash, landing verified)
         closeout <ref> --apply           (mechanical sweep, judgment residue, capsule)
    → queue plan --next 1                 (next action, reasons, weight, lease)
    → pick the next item from nextActions; deliver via the retained per-ticket
      dispatch (deliver-ticket.sh) until M1-S9
    → repeat; no gh pr list / gh pr merge primary path

Flow 4: Blocker round trip
  Lane hits a decision / ambiguity / missing credential / external wait
    → blockers publish decision-needed --lane <id> "<question>" --options a,b
    → question ranks in status and brief within one collection cycle
    → coordinator or owner answers as data: blockers answer <id> --choice 2
    → answer record carries applied and laneResume; the applying actor resumes
      the lane through its dispatch mechanism (no full session re-entry claimed)

Flow 5: Pilot conformance (deterministic, fixture-backed)
  Seed a temporary pilot repository + state store + local bare remote
    → stubs: tracker reads/writes, CI check-runs, PR-platform merge transport,
      provider/network, clock and id injection
    → real: state ledger, git objects, change-folder files, envelopes, text
    → drive: status → blockers answer → merge → closeout → queue plan
    → assert: expected next action, no outbound network, key=value text intact,
      byte-identical output on a second run, no raw-git prompt instructions
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- A production CLI entrypoint — a non-installed Bun bin entry mapped in the package `bin` manifest plus a `main`/composition entry — that resolves the working name (configuration and `DELIVERY_OS_WORKING_NAME`, then the neutral `delivery-os` default), composes the prompt-required commands, and invokes the in-process surface.
- Root `--help`, `<command> --help`, and `--version`, with no state/network/git/configuration reads or writes and no configuration requirement.
- Removal of the delivery-session refusal from `commit` and `phase complete`; retention of the sanitized one-shot transport.
- Retirement of the `commit.session.context-refused` error row and reconciliation of the machine table, documented table, fixtures, and sync check.
- Lifecycle completion staging scope = mapped plan-phase scope ∪ change folder; standalone plan-union scope; plan-absent change-folder staging; stray exclusion preserved.
- Completion ordering so the pm-notes transition and phase artifacts are in the completion commit; the reverse failure window (document written, commit act failed) restores the pre-write pm-notes bytes, and a failed restoration exits 2 with a classified fault and a reconciliation instruction; retries converge to exactly one transition and one commit.
- Phase-state adoption: `phase complete`/`list`/`reopen` in PM, coder, and command prompts; no hand-written `started`/`completed`; PR URL as a pm-notes `notes:` entry.
- Commit adoption: `@committer` as a thin executor of `commit`; direct `commit` calls where the caller owns the trigger; no raw `git add`/`git commit` in lifecycle prompts.
- Typed blocker adoption: `blockers publish/list/answer` in lane and coordinator prompts; pm-notes `blockers:` no longer written.
- Coordinator J1 adoption: `status`, `blockers answer`, `verify change`/`phase list`, `merge`, `closeout`, `queue plan`, `brief`, `lanes`, `spend`, `retro`, with `deliver-ticket.sh`/`ceo-loop.sh` retained.
- Plan schema alignment: optional `phases[].summary`; no `tasks` key; progress remains in pm-notes `notes:`.
- Prompt and command inventory updates, guide and reference-page reconciliation, `AGENTS.md` and unified-convention reconciliation, and `.ados-claude/**` regeneration.
- The deterministic conformance scans, the help/guide coverage matrix, the key=value goldens, and the pilot-repository J1 suite.
- Reconciliation of the affected system specs (`commit-primitive`, `pm-notes-lint-and-phase-transitions`, `plan-schema`, `blockers`, `status-digest`, `brief`, `merge-verify-deploy`, `closeout`, `scheduling-engine`, `result-contract`, `agents-and-commands`, `delivery-lifecycle`, `quality-gates-and-pr`, `autonomous-delivery`, `local-code-review`).
- Classification of the non-CLI surfaces: `state` (state layer, no command surface) and `mcp` (`@delivery-os/mcp` package surface) are explicitly outside the prompt-required set and are asserted absent from the entrypoint composition; `dispatch` and the daemon remain undelivered.

### 7.2 Out of Scope

- [OUT] `dispatch` (M1-S9) and the resident daemon (M1-S18); no prompt may claim them.
- [OUT] Installer, packaging, release, or public install-path changes; the entrypoint is not added to the installer.
- [OUT] New tracker integrations, new providers, or changes to the tracker MCP/CLI surface.
- [OUT] Full MCP command parity; `mcp serve` remains its own surface.
- [OUT] Memory commands, memory tiers, or agent-memory policy.
- [OUT] Retiring or removing `deliver-ticket.sh`, `ceo-loop.sh`, or the bash fallback.
- [OUT] Changing commit message generation, safety scanning, standalone staging precision, or existing envelope/output shapes.
- [OUT] New state record kinds, projections, or data migrations.
- [OUT] A `phase start` subcommand.
- [OUT] A `tasks` key in the plan or plan-file progress tracking.
- [OUT] Adding a `state` CLI command or folding `mcp` into the CLI command surface; both stay non-CLI surfaces.
- [OUT] Re-implementing `status`, `merge`, `closeout`, `queue`, or `blockers`.

### 7.3 Deferred / Maybe-Later

- `phase start` if a future non-completion start transition is justified by a real consumer.
- Plan-phase-scoped staging in `commit` (for example `commit --plan-phase <id>`); current per-plan-phase commits use the plan union.
- A user-facing command guide beyond the man-page reference pages, once install/release lands.
- Full production composition of commands outside the prompt-required set; those remain library/in-process until their adoption.
- MCP parity for the new entrypoint/help/version surface.
- Daemon-driven lane resume on blocker answers; the blocker channel records the projection and the applying actor consumes it later.
- A shell-completion generator derived from the command grammar.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The interface surface is the CLI. The following is the **allowed command set the lifecycle prompts may call**, with the help/guide obligation for each. Commands outside this set may remain registered but are not prompt-required.

| Invocation | Primary prompt users | `--help` obligation | Guide obligation |
|---|---|---|---|
| `<binary> --version` | All | — (root) | Man page + entrypoint reference |
| `<binary> --help` | All | Root usage, families, global flags | Man page + entrypoint reference |
| `<binary> <command> --help` | All | Usage, options, ≥1 example, exit codes, see-also | Reconciled command reference page |
| `status [--repo <path>]... [--json]` | Coordinator, PM | Yes | `status` reference page |
| `brief [--json]` | Coordinator, owner-facing | Yes | `brief` reference page |
| `queue list\|plan [--next <n>]\|add\|prioritize\|dep\|claim\|release` | Coordinator | Yes | `queue` reference page |
| `lanes list\|show <ref>` | Coordinator | Yes | `lanes` reference page |
| `blockers publish <type> --lane <id> "<question>" [--options ...] [--audience ...]` | Lanes, PM | Yes | `blockers` reference page |
| `blockers list [--open]` | Coordinator, PM | Yes | `blockers` reference page |
| `blockers answer <id> [--choice <n>] [--text <text>]` | Coordinator, owner | Yes | `blockers` reference page |
| `phase list <ref>` | PM, coder, coordinator | Yes | `phase` reference page |
| `phase complete <ref> <phase> [--no-commit]` | PM, coder | Yes | `phase` reference page |
| `phase reopen <ref> <phase> <reason>` | PM | Yes | `phase` reference page |
| `commit [<ref>] [--phase <phase>] [--dry-run]` | PM, coder, commands, thin `@committer` | Yes | `commit` reference page |
| `lint <ref>` / `lint <ref> --registry` / `lint plan <ref>` | PM, coder, reviewer | Yes | `lint` reference page |
| `plan validate <ref>` / `plan diff <ref> [--against <base>]` / `plan overlap <refA> <refB>` | Plan writer, PM, coder, reviewer | Yes | `plan` reference page |
| `verify change <ref>` / `verify gates <ref>` / `verify deploy <ref>` | Coordinator, PM, reviewer | Yes | `verify-*` reference pages |
| `merge <ref> [--dry-run]` | Coordinator | Yes | `merge` reference page |
| `closeout <ref> [--apply]` | Coordinator | Yes | `closeout` reference page |
| `spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]` | Coordinator | Yes | `spend` reference page |
| `retro collect\|report [--level <name>]` | Coordinator | Yes | `retro` reference page |

Commands registered in the CLI but **not prompt-required** in this change: `config`, `doctor`, `provider`, `db`, `watchdog`, `board`. They keep their existing contracts and are not part of the coverage matrix's mandatory set. Two surfaces that are **not CLI commands at all** and therefore cannot appear in the composition: `state` (the state layer ships no command surface; `tests/structure/state-scope.test.ts` enforces the absence) and `mcp` (the `@delivery-os/mcp` package surface, whose parity is out of scope, NG-4). `dispatch` (M1-S9) and the resident daemon (M1-S18) are undelivered. The entrypoint composes only the table above; an absence assertion in the entrypoint composition suite proves `state`, `mcp`, `dispatch`, and the daemon are not registered or claimed.

External tools remain outside the typed help/guide obligation but inside the retired/retained classification: `git` read-only inspection (`status`, `diff`, `log`, `rev-parse`, `branch --list`) is allowed; `git add`/`git commit`/`git reset` write operations are retired for lifecycle prompts; `git push` remains in `@pr-manager`; `gh`/`glab` PR creation remains in `@pr-manager`, while `gh pr merge`/`glab mr merge` is retired as the lifecycle merge path.

### 8.2 Events / Messages

No new event or record kinds. The change consumes the existing `phase.transition` and `commit.telemetry` records; the pilot asserts their presence and identity. No derived projection, schema version, or state migration is added.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `delivery.plan.v1` phase `summary` | New optional, non-empty string on `phases[]`. The validator accepts and echoes it; the plan writer may emit it; the commit path consumes it as the plan-phase summary. Omission remains valid. No `tasks` key. |
| DM-2 | pm-notes PR URL note | The PR URL is recorded as a `notes[]` entry (`text` containing the URL, `type: info`, `date`). No pm-notes schema change; `phases.pr_creation.url` stops being an agent write target. |
| DM-3 | `commit` error-domain row retirement | `commit.session.context-refused` is retired with the guard. The `commit` domain shrinks from six rows to five; the machine table, documented table, fixtures, and sync check are updated together. |

### 8.4 External Integrations

- **Git**: local commit-object creation and landing continue through the existing commit seam; the entrypoint does not add remote operations. `@pr-manager` keeps push/PR creation.
- **Harness one-shot**: remains a headless invocation in a temporary empty project context with a sanitized environment and no delivery-session facts.
- **Tracker MCP/CLI**: lifecycle prompts keep using the tracker for ticket reads/writes; the coordinator uses `status` for its digest and `closeout` for the post-merge sweep. No new tracker integration.
- **CI**: `verify gates`/`merge` continue to read check-runs; the pilot stubs them.
- **Provider/network**: unchanged; the pilot stubs provider availability and network, and asserts no outbound call.
- **PR platform**: `@pr-manager` keeps `gh`/`glab` for creation and push; `merge` becomes the lifecycle merge path. The pilot uses a local bare-repository landing fixture and a stubbed platform surface.

### 8.5 Backward Compatibility

- **Entrypoint and help/version are additive.** Existing in-process `runCli` behavior, envelopes, and command contracts are unchanged; the entrypoint is a new composition, not a rewrite.
- **Session-guard removal is a deliberate behavioral change.** Callers that relied on `commit.session.context-refused` no longer get a refusal; this is the point of the change and must be called out in the PR and the TDR.
- **Error-row retirement is a table change.** Consumers that referenced `commit.session.context-refused` must stop; the documented table, machine table, fixtures, and sync check move together.
- **Plan `summary` is additive.** Existing plans without `summary` remain valid; the validator's new optional field does not reject unknown existing keys or change verdicts.
- **Staging scope widens only for the change ref.** Existing standalone commit behavior is unchanged except that a plan-absent commit may stage the change folder for the resolved ref; unrelated strays remain unstaged.
- **Key=value continuity is preserved.** The surfaces in Appendix A keep their existing key=value grammar and output shape; regressions fail the goldens.
- **Retained bash is explicitly retained.** `deliver-ticket.sh` and `ceo-loop.sh` remain primary where they are today; the change does not retire them or claim their replacements.
- **Prompts are behavior, not code.** Downstream consumers of the prompts (OpenCode and the generated Claude plugin) see new instructions; the generated plugin is regenerated in the same change so both hosts agree.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Self-description isolation: `--help` and `--version` perform zero state, network, git, or configuration reads and zero writes | Zero read/write calls asserted by the isolation suite; the command completes inside the suite's fixed timeout (wall-clock timing is informational, not a gate) |
| NFR-2 | Entrypoint composition completeness: the composition resolves the working name and registers exactly the prompt-required command subset; an uncomposed command fails closed with a classified platform/configuration error; no ambient brand literal | Exactly the §8.1 set composed, with absence assertions for `state`, `mcp`, `dispatch`, and the daemon; every uncomposed invocation returns a classified failure; forbidden-literal scan green; completes inside the suite's fixed timeout |
| NFR-3 | Conformance determinism: the prompt/doc scan, coverage matrix, and pilot suite are deterministic and replayable | Identical results on two runs with identical fixtures; zero ambient reads |
| NFR-4 | Prompt invariants: no raw-git commit instruction, no hand-written phase timestamp/PR URL write instruction, no retired bash primary path | 0 violations across the lifecycle inventory |
| NFR-5 | Help/guide coverage: every prompt-required command has `--help` and a reconciled reference page | 100% coverage; 0 missing entries |
| NFR-6 | Key=value continuity: the registered text surfaces keep their key order and grammar | Byte-identical goldens; 0 regressions |
| NFR-7 | Pilot determinism: fixed clock, ids, fixtures, and stubs produce byte-identical output | Byte-identical across two runs; 0 network calls |
| NFR-8 | Pilot runtime: the full J1 conformance exercise stays bounded | Completes within the suite's fixed timeout (≤ 180 s on the reference environment); timing is informational, not a per-run gate |
| NFR-9 | Safety: prompts, guides, and pilot fixtures contain no secrets; the commit safety scan is unchanged | 0 secret findings; safety pass still runs before staging/transport |
| NFR-10 | Brand neutrality: no seed-name literal in `packages/**`; all human output uses the injected identity or the neutral `delivery-os` default | Forbidden-literal scan green on all classes; the neutral default is not the seed literal |
| NFR-11 | Backward compatibility: unchanged commands keep their envelopes and exit projections | 0 byte diffs outside the new help/version surfaces and the declared changes |
| NFR-12 | Generated-plugin freshness: `.ados-claude/**` matches `.opencode/**` | CI drift check green; generated files byte-current |
| NFR-13 | Current-truth reconciliation: every §16.1 row no longer contains its named stale phrase and contains its required replacement | 0 stale matches; 100% required phrases present |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No new telemetry stream. The pilot and conformance suite report counts (prompt files scanned, invariants failed, commands covered, pilot steps) through their own test output; no production event is added.
- `--json` envelopes on the pilot commands are the evidence surface: `status` sections, `blockers` answer payload, `merge` gates/result, `closeout` steps/residue, `queue plan` next actions.
- Existing `phase.transition` and `commit.telemetry` records remain the durable evidence for the phase and commit steps; the pilot asserts they exist and carry the expected identities.
- Key=value text output remains the human/script continuity surface; no diagnostic is moved into a new stream.
- The entrypoint must not log the working name or version in a way that bypasses the serialization redaction chokepoint; `--version` output is metadata only.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Prompt, guide, and current-truth system-spec drift: agents, commands, guides, reference pages, system specs, and the generated plugin describe different commit/phase models | H | M | One allowed-command set; one prompt/doc/system-spec inventory (§16.1); deterministic conformance scan with stale/required phrase assertions; generated plugin regenerated; coverage matrix | A new prompt or spec page added after this change can drift unless the scan is wired into CI |
| RSK-2 | Session-guard removal enables unintended commits inside sessions | H | L | Only lifecycle prompts call the primitives; safety scan, staging precision, no push, no history rewrite; TDR records the reversal; `@committer` is a thin executor | A malicious or confused session can commit; the primitive still refuses unsafe content and never pushes |
| RSK-3 | Change-folder staging commits unintended documentation | M | M | Stage only the change folder for the resolved ref; untracked strays outside it remain excluded; forbidden paths and binaries excluded; `excluded` discloses everything | A tracked modification under the change folder is committed by design; review sees it in the completion commit |
| RSK-4 | Entrypoint hardcodes the product name or bypasses redaction/audit | H | L | Branding seam is the only name source; `DELIVERY_OS_WORKING_NAME` override; forbidden-literal scan; existing serialization chokepoint and audit seam are reused | A future composition can bypass the seam unless the boundary test stays in the aggregate gate |
| RSK-5 | Retiring `commit.session.context-refused` breaks a consumer | M | L | Documented table, machine table, fixtures, and sync check move together; PR calls out the removal; TDR records the consequence | External scripts referencing the code fail loudly; this is a pre-release surface |
| RSK-6 | Plan `summary` drifts or is unvalidated | M | M | Optional, non-empty, validated and echoed; plan writer emits it; no `tasks` key; lint/golden coverage | A writer may omit it, losing template quality; omission remains valid by design |
| RSK-7 | Key=value regression on a replaced surface | M | L | Appendix A register; byte-equality goldens for `merge`, `queue`, `verify`, `plan`, `blockers`; retained bash summary unchanged | A new text renderer can drift unless the goldens cover it |
| RSK-8 | Scope too large for one reviewable change | H | H | **One ticket, one PR is retained** (the delivery brief requires exactly one work item per PR; DEC-15). The review risk is explicitly accepted by the PM: the ten plan phases are sequenced so each is independently green, review is staged by commit (each phase's commit is a reviewable unit), and the pilot suite is the end-to-end gate. Foundation phases 1–5 land before coordination phase 6; the conformance scans (phase 8) and pilot (phase 9) follow the artifacts they scan. | A single PR remains large. Residual review risk is accepted, not eliminated: a reviewer must stage the review by commit and may still miss a cross-phase interaction; the pilot and conformance scans are the mechanical backstop, and the PM owns the acceptance (DEC-15). |
| RSK-9 | A retained bash entry point is mistaken for a retired one | M | M | Appendix B retained/retired register; prompts label retained paths explicitly; conformance scan targets only retired paths | A reader may still over-generalize; the register is the source |
| RSK-10 | Pilot stubs diverge from real adapter behavior | M | M | Stubs implement the delivered ports; real state/git/files/envelopes; contract tests cover the adapter surfaces; the pilot is evidence, not a replacement for the aggregate suite | A stub can hide a production-only failure; other suites cover the real edges |
| RSK-11 | The reversed completion order leaves the derived pm-notes projection ahead of the ledger when the commit act fails | H | M | Pre-write snapshot of the pm-notes bytes; restore on safety STOP, staging refusal, commitlint failure, or atomic abort; the phase is complete only when the ledger transition lands; a failed restore exits 2 with a classified platform fault and a reconciliation instruction; retries converge to exactly one transition and one commit (AC-F2-4) | A process kill between the write and the restore leaves the document ahead of the ledger; the reconciliation instruction and the next completion's convergence handle it, and the failure is never reported as success |

## 12. ASSUMPTIONS

- The typed primitives listed in §8.1 are delivered and keep their current contracts; this change composes and adopts them, not redesigns them.
- `createConfigProgram` can compose the prompt-required command definitions from existing command factories and production compositions; any missing production composition is added at the entrypoint, not by re-implementing a command.
- A command whose production composition is not configured fails closed with a classified configuration/platform error rather than silently pretending to work; the pilot injects stubs.
- After the guard removal, a delivery session needs no session-fact injection for `commit`/`phase complete`; the session-fact mechanism remains available for other consumers.
- The harness one-shot can continue to run in a temporary empty project directory with a sanitized environment and no project context.
- The M1 command reference pages under the command pack are the canonical man-page-grade guides; `--help` must be self-sufficient with examples.
- The pilot can use a local bare repository as the merge landing target and a fixture gate record as gate evidence.
- `.ados-claude/**` generation is deterministic and CI-enforced.
- Per-plan-phase progress remains in pm-notes `notes:`; the ledger records lifecycle phases only.
- The MCP composition's neutral default `delivery-os` is the appropriate neutral identity for `--help`/`--version` when neither configuration nor `DELIVERY_OS_WORKING_NAME` supplies a name, and it is not the forbidden seed literal.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Result contract and error table (GH-172) | Envelope, error table, `{0,1,2}` projection, redaction chokepoint, sync check |
| Depends on | Phase family and pm-notes lint (GH-179) | The only phase write path, idempotency matrix, post-transition lint |
| Depends on | Commit primitive (GH-227) | `commit` and atomic completion; the session guard and the six-row domain being changed |
| Depends on | Plan schema (GH-226) | `delivery.plan.v1`, declared scope, and the optional `summary` gap |
| Depends on | Typed blockers (GH-230) | Publish/list/answer, ranking, digest/brief integration |
| Depends on | Status digest and brief (GH-243, GH-228) | Digest sections and the owner-facing view the coordinator consumes |
| Depends on | Merge and verify deploy (GH-225) | The merge transaction and gate evidence |
| Depends on | Closeout (GH-183/GH-221) | The post-merge sweep and capsule |
| Depends on | Scheduling engine (GH-237) | `queue`/`lanes` and `queue plan` |
| Depends on | State layer, configuration layer, branding seam | Ledger, typed configuration, injected identity |
| Depends on | Harness adapters | Headless one-shot and session-fact boundary |
| Depends on | Agent/command definitions and Claude plugin generation | The prompt inventory and the generated plugin |
| Blocks | M1 exit evidence | The J1 iteration on the tooling is part of the M1 exit story |
| Blocks (soft) | Future dispatch/daemon adoption | The prompt surface is the integration point the daemon will drive |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should GH-242 be split into two changes? | The change touches ~20 prompt/command files, ~20 guide/spec files, the entrypoint, help/version, the session-guard reversal and error-row retirement, staging/ordering, the plan schema, the conformance scans, and the pilot suite. **Recommended split:** (a) **foundation** — entrypoint + `--help`/`--version` + session-guard reversal + `commit`/`phase complete` adoption + thin `@committer` + staging/ordering + plan `summary` + prompt/guide conformance scans; (b) **coordination adoption** — `status`/`blockers`/`merge`/`closeout`/`queue plan` in the coordinator and lane prompts + the J1 pilot conformance suite + the remaining guide/spec reconciliation. The foundation unblocks every agent; the coordination half is independently reviewable. | **Resolved 2026-11-07 (PM): no split.** GH-242 is one leaf story and the delivery brief requires exactly one work item to one PR. The ten phases are ordered foundation-first so each phase is independently green, review is staged by commit, and the pilot suite is the end-to-end gate; the review-risk acceptance is recorded explicitly in DEC-15 and RSK-8. |
| OQ-2 | What is the TDR identifier and timing for the session-guard reversal? | D3 supersedes GH-227 DEC-6. A TDR should record the reversal, the retained sanitized one-shot, and the error-row retirement. | **Resolved 2026-11-07 (PM):** `TDR-0013-agent-session-commit-guard-reversal`, authored via `@decision-advisor` before delivery; referenced in DEC-3 and the plan. |
| OQ-3 | Does the ticket's "guide" obligation require a user-facing guide beyond the man-page reference pages? | The ticket says "man-page-grade guides"; the command pack pages are man-page-grade but live under planning docs. Recommendation: satisfy the ticket with `--help` (self-sufficient examples) plus the reconciled command reference pages; defer a separate user guide to install/release. | **Resolved 2026-11-07 (PM):** help + reconciled reference pages satisfy the obligation; no separate user guide in this change (DEC-10). The reference pages are current-truth for the delivered surface and are reconciled accordingly. |
| OQ-4 | Is plan-union staging acceptable for per-plan-phase coder commits, or should `commit` gain plan-phase scoping? | Coder commits per plan phase via standalone `commit`, whose scope is the plan union. Recommendation: accept plan-union now (coder executes sequentially and records the plan phase in a pm-notes note); adding plan-phase scoping is a future primitive extension, not this change. | **Resolved 2026-11-07 (PM):** accept plan-union (DEC-9); revisit only if per-phase precision becomes a real need. |
| OQ-5 | Should the entrypoint ship a fully wired production composition for every M1 command, or only the prompt-required subset? | The prompt-required subset is enough for the ticket; other commands remain library/in-process until adoption. Recommendation: compose the prompt-required subset and fail closed for unconfigured compositions; do not claim the rest. | **Resolved 2026-11-07 (PM):** prompt-required subset, fail closed for unconfigured compositions (DEC-13). |
| OQ-6 | Should `commit.session.context-refused` be retired or retained as a reserved identity? | Retaining an unreachable row weakens the error table's honesty; retiring it changes the domain from six to five rows. Recommendation: retire it with the guard, update all four synced surfaces, and record the removal in the TDR. | **Resolved 2026-11-07 (PM):** retire the row with the guard; TDR-0013 records it (DEC-3). |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Include the minimum executable and self-description surface: a neutral CLI entrypoint plus root/command `--help` and `--version`. The entrypoint resolves the working name from configuration/`DELIVERY_OS_WORKING_NAME`, never hardcodes the seed literal in `packages/**`, and is not added to the installer in this change. | Prompts cannot consume a primitive with no invocation path or help; install/release is a later change. | 2026-11-07 |
| DEC-2 | The `phase` family is the only write path for phase state. Agents do not hand-edit `started`/`completed`; `phase complete` is the transition they call and it creates a missing entry. No `phase start` is added. The PR URL is a pm-notes `notes:` entry, not `phases.pr_creation.url`. | One write path removes drift; completion is the only transition the agents need; a start transition has no consumer. | 2026-11-07 |
| DEC-3 | Remove the delivery-session refusal from `commit` and `phase complete`; supersede GH-227 DEC-6. Keep the harness one-shot in a sanitized empty project context. Retire `commit.session.context-refused` and shrink the `commit` domain from six to five rows, updating the machine table, documented table, fixtures, and sync check together. The reversal is recorded in `TDR-0013-agent-session-commit-guard-reversal`, authored via `@decision-advisor` before delivery. | Lifecycle agents operate inside delivery sessions; an unreachable row weakens the error table's honesty. | 2026-11-07 |
| DEC-4 | Lifecycle completion staging scope = mapped plan-phase scope ∪ the change folder for the change ref. Standalone `commit` keeps the plan union; a plan-absent standalone commit may stage the change folder. Unrelated untracked strays are never staged. | Artifact phases cannot commit new spec/test-plan/plan files otherwise; the change folder is the smallest safe scope that carries them. | 2026-11-07 |
| DEC-5 | `@committer` becomes a thin executor of the typed `commit` primitive; no prompt instructs `git add`/`git commit` for a phase transition. Prompts call `commit` directly where the caller owns the trigger, or delegate to the thin `@committer` for compatibility. | Preserves the compatibility entry point without the raw-git loop or agent-authored messages. | 2026-11-07 |
| DEC-6 | Typed blockers are the only blocker channel for lifecycle agents (`publish`/`list`/`answer`). The pm-notes `blockers:` collection remains schema-allowed but is not an agent write target. | Makes blockers rankable, answerable as data, and visible in the digest/brief. | 2026-11-07 |
| DEC-7 | The coordinator J1 iteration uses `status`, `blockers answer`, `verify change`/`phase list`, `merge`, `closeout`, and `queue plan`. `scripts/deliver-ticket.sh` remains the primary per-ticket delivery path until M1-S9 and is explicitly retained; `scripts/ceo-loop.sh` remains the outer process supervisor until M1-S18. | The typed loop replaces rediscovery, not the retained per-ticket engine; retiring either now would claim undelivered stories. | 2026-11-07 |
| DEC-8 | `delivery.plan.v1` gains an optional, non-empty `phases[].summary`; no `tasks` key is added; plan-phase progress stays in pm-notes `notes:`. | Aligns the producer with the existing consumer without turning the plan into a progress log. | 2026-11-07 |
| DEC-9 | Per-plan-phase coder commits use standalone `commit` with the plan-union scope; the ledger records lifecycle phases only, and `phase complete delivery` is the lifecycle boundary. | The phase family validates canonical lifecycle phases only; extending `commit --phase` to plan ids would conflate two concepts. | 2026-11-07 |
| DEC-10 | The help/guide obligation is satisfied by a self-sufficient `--help` (usage, options, ≥1 example, exit codes, see-also) plus a reconciled man-page-grade command reference page. A separate user-facing guide is deferred. | The ticket asks for man-page-grade guides; the reference pages already have the right shape and only need reconciliation. | 2026-11-07 |
| DEC-11 | Conformance is enforced mechanically: a deterministic prompt/doc scan, a help/guide coverage matrix, key=value goldens, and the pilot suite. Prose review is not the enforcement. | Prompt drift is the main risk; mechanical checks survive agent turnover. | 2026-11-07 |
| DEC-12 | Key=value continuity is a byte-equality obligation on the surfaces in Appendix A; the retained `deliver-ticket.sh` summary keys remain unchanged. | The bash-era machine contract is what scripts and the coordinator consume; replacing a surface must not break it. | 2026-11-07 |
| DEC-13 | The entrypoint composes only the prompt-required command subset and fails closed with a classified error for a composition it does not provide; it does not claim every M1 command. | The ticket needs the calls the prompts make; claiming unwired commands would ship a false surface. | 2026-11-07 |
| DEC-14 | "Executable" means a **non-installed Bun bin entry** (`packages/cli/bin/<neutral-name>.ts`, shebang, mapped in the package `bin` manifest) plus a `main`/composition entry — not an in-process function. The working name resolves in the order typed configuration → non-empty `DELIVERY_OS_WORKING_NAME` override (override precedence) → neutral default `delivery-os` — the same default the MCP composition uses — applied for `--help`/`--version` identity only when neither source yields a name; the default is not the forbidden seed literal. The bin is **not** added to `scripts/install.sh`, and installer tests stay unchanged. | A prompt can only invoke a process; the neutral default closes the no-config identity gap without inventing a name source or weakening the seed-literal guard. | 2026-11-07 |
| DEC-15 | **One ticket, one PR.** GH-242 is delivered as a single change and a single PR to `main-tools`; it is not split. The PM explicitly accepts the review risk: the ten plan phases are sequenced so each is independently green, review is staged by commit (each phase's commit is a reviewable unit), and the pilot suite is the end-to-end gate. | The delivery brief requires exactly one work item per PR; a split would create a second work item. The risk is accepted and mitigated by phase independence plus staged review, not hidden. | 2026-11-07 |
| DEC-16 | Completion writes the pm-notes transition before the commit act, but the phase is complete only when the ledger transition lands. A failed commit act (safety STOP, staging refusal, commitlint failure, atomic abort) restores the pre-write pm-notes bytes and claims nothing; a failed restoration exits 2 with a classified platform fault and a reconciliation instruction; a retry lands exactly one transition and one commit. The legacy window (commit landed, document write later failed) still converges from the stored transition without re-committing. | Without the reverse-window rule the reversed order could leave the derived projection ahead of the ledger — the exact divergence this change exists to prevent. | 2026-11-07 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| CLI entrypoint and composition edge | New — a non-installed Bun bin entry, a `main`/composition entry, working-name resolution (configuration → `DELIVERY_OS_WORKING_NAME` → neutral `delivery-os` default), prompt-required composition, root/command help and version |
| CLI command surface | Extended — `--help`/`--version`; session-guard removal in commit/phase; staging/order changes; plan `summary` acceptance; prompt-required command registration |
| Core plan contract and validator | Extended — optional `phases[].summary` (types, validation, echo) |
| Commit and phase runtime | Extended — staging scope union, completion ordering, session-guard removal, error-row retirement |
| Error table (machine + documented) | Extended — retire `commit.session.context-refused`; `commit` domain shrinks to five rows; sync check updated |
| Agent prompt definitions | Updated — PM, coder, committer, CEO, plan-writer, reviewer, readiness-reviewer, doc-syncer, spec-writer, test-plan-writer, pr-manager, review-feedback-applier |
| Command definitions | Updated — `run-plan`, `commit`, `review`, `review-deep`, `check`, `check-fix`, `write-spec`, `write-test-plan`, `write-plan`, `sync-docs`, `check-readiness` |
| Guides and conventions | Updated — `AGENTS.md`, `doc/guides/change-lifecycle.md`, `doc/guides/unified-change-convention-tracker-agnostic-specification.md`, delivery-modes/autonomous-batch references |
| M1 command reference pages | Reconciled — `phase`, `commit`, `status`, `blockers`, `merge`, `closeout`, `queue`, `plan`, `lint`, `verify-*`, man page |
| System specs | Reconciled — commit primitive, pm-notes/phase, plan schema, blockers, status, brief, merge/verify, closeout, scheduling, result contract, agents/commands, delivery lifecycle, quality-gates-and-PR, autonomous delivery, local code review |
| Generated Claude plugin | Regenerated — `.ados-claude/**` from `.opencode/**`; byte-current |
| Test and conformance harness | New/extended — prompt/doc scan, coverage matrix, key=value goldens, pilot-repository J1 suite |

### 16.1 Prompt and Document Inventory

The following inventory is the scope of the prompt/doc reconciliation. Each row names the artifact and the required change; the row is not an implementation task. The conformance scan covers every `.opencode/agent/*.md` and `.opencode/command/*.md`; the table lists the artifacts known to require edits.

| Artifact | Required change |
|---|---|
| `.opencode/agent/pm.md` | Replace hand-edited phase timestamps and `@committer` triggers with `phase complete`; PR URL as a `notes:` entry; use `lint`, `plan validate`, `verify change`; publish typed blockers; no raw git. |
| `.opencode/agent/coder.md` | Per-plan-phase `commit` (plan union); pm-notes `notes:` evidence; `phase complete delivery` at the lifecycle boundary; `blockers publish`; no raw git. |
| `.opencode/agent/committer.md` | Thin executor of `commit`; remove `git add`/`git commit`/re-stage/amend and independent message composition; report the envelope. |
| `.opencode/agent/ceo.md` | J1 loop via `status` → `blockers answer` → `verify change`/`phase list` → `merge` → `closeout` → `queue plan`; remove `gh pr merge` as the merge path; keep `deliver-ticket.sh`/`ceo-loop.sh` primary where retained; no dispatch/daemon claims. |
| `.opencode/agent/plan-writer.md` | Emit optional `phases[].summary`; no `tasks`; progress stays out of the plan. |
| `.opencode/agent/reviewer.md` | Read-only git inspection allowed; no commit; use `plan validate`/`plan diff`/`verify`; publish typed blockers. |
| `.opencode/agent/readiness-reviewer.md` | No commit; verdict artifact; phase-state reads via `phase list` where applicable. |
| `.opencode/agent/doc-syncer.md` | No commit; orchestrator uses `commit`; no raw git. |
| `.opencode/agent/spec-writer.md`, `.opencode/agent/test-plan-writer.md` | Pure writers; orchestrator uses `commit`; no raw git. |
| `.opencode/agent/pr-manager.md` | No merge; dirty tree uses `commit` (or thin `@committer`); push/PR creation retained. |
| `.opencode/agent/review-feedback-applier.md` | No commit; the caller commits via `commit`. |
| `.opencode/command/run-plan.md` | Per-plan-phase `commit`; no `@committer` raw-git; `phase complete delivery` at the boundary. |
| `.opencode/command/commit.md` | Wrapper over the `commit` primitive (or thin `@committer`); remove raw-git instructions. |
| `.opencode/command/review.md`, `.opencode/command/review-deep.md` | Commit via `commit`; plan validate/diff; no raw git. |
| `.opencode/command/check.md`, `.opencode/command/check-fix.md` | Commit via `commit`; no raw git. |
| `.opencode/command/write-spec.md`, `.opencode/command/write-test-plan.md`, `.opencode/command/write-plan.md`, `.opencode/command/sync-docs.md` | Commit via `commit`; no raw git. |
| `.opencode/command/check-readiness.md` | No commit; no phase-state hand edit. |
| `doc/guides/change-lifecycle.md` | Rewrite the branch/commit responsibility model: `commit` primitive, `phase` family, typed blockers, retained bash; remove the raw-git-only rule. |
| `doc/guides/unified-change-convention-tracker-agnostic-specification.md` | PR URL as a pm-notes note; phase state via `phase`; no hand-edited timestamps. |
| `doc/guides/delivery-modes.md` and autonomous-batch references | Align the retained `deliver-ticket.sh`/`ceo-loop.sh` story with the typed coordinator loop; explicitly retain them. |
| `AGENTS.md` | Update the delivery-process table and artifact guidance to reference `phase complete` and `commit`; state the retained bash paths. |
| M1 man page and command pages | Reconcile `--help`/`--version`, the entrypoint, the session-guard reversal, staging scope, and the plan `summary`. |
| Affected `doc/spec/features/**` pages (behavioral primitives) | Reconcile the delivered behavior for commit, phase, plan, blockers, status, brief, merge/verify, closeout, scheduling, result contract, and agents/commands. |
| `doc/spec/features/feature-delivery-lifecycle.md` | Stale phrases: "all commits route through `@committer`" and "No agent prompt other than `@committer` performs a direct `git commit`". Required: lifecycle commits route through `commit` (standalone or the atomic phase completion), `@committer` is a thin executor, and phase state is written only through the `phase` family. |
| `doc/spec/features/feature-quality-gates-and-pr.md` | Stale: the `@committer` temp-message-file and post-hook-amend commit workflow. Required: the primitive-backed commit path through the thin executor, with the gate and PR obligations unchanged. |
| `doc/spec/features/feature-autonomous-delivery.md` | Stale: the CEO merging via `gh pr merge --squash` / `glab mr merge` (INV-DM-4). Required: `merge` is the lifecycle merge path, while `deliver-ticket.sh` and `ceo-loop.sh` remain retained and primary where they are today. |
| `doc/spec/features/feature-local-code-review.md` | Stale: review triggers `/commit` through the raw-git `@committer`. Required: the review-triggered commit path is the primitive-backed `commit` or the thin `@committer`. |
| `.ados-claude/**` | Regenerate from `.opencode/**`; commit source and generated output together; generated files byte-current. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a checkout with a configured working name, **when** the entrypoint runs `--version`, **then** it prints version/build information using the injected binary identity, exits 0, and performs no state, network, or git write. | F-1, NFR-1, NFR-10 |
| AC-F1-2 | **Given** any prompt-required command, **when** invoked with `--help`, **then** it prints usage, options, at least one example, exit codes, and a see-also pointer, exits 0, and performs no state, network, or git write. | F-1, NFR-1, NFR-5 |
| AC-F1-3 | **Given** the entrypoint built from `packages/**`, **when** the forbidden-literal scan runs and `--version` renders under (a) a configured name, (b) only `DELIVERY_OS_WORKING_NAME`, and (c) neither source, **then** no seed-name literal is present, (a) and (b) render the supplied identity, and (c) renders the neutral default `delivery-os`, which is not the seed literal. | F-1, NFR-10, DEC-14 |
| AC-F1-4 | **Given** the installer/release surface, **when** this change lands, **then** the entrypoint is not added to the installer and the installer tests are unchanged. | F-1, NG-2 |
| AC-F2-1 | **Given** the lifecycle prompt inventory, **when** it is scanned for instructions that write `phases.<id>.started`, `phases.<id>.completed`, or `phases.pr_creation.url`, **then** zero write instructions remain and phase state is read/written only through `phase list`/`phase complete`/`phase reopen`. | F-2, NFR-4 |
| AC-F2-2 | **Given** a lifecycle phase completion with pending phase artifacts inside a delivery session, **when** `phase complete <ref> <phase>` runs, **then** the transition lands, the pm-notes transition and phase artifacts are in the completion commit, and no session refusal is returned. | F-2, F-4, F-5 |
| AC-F2-3 | **Given** a completed `pr_creation` phase, **when** the prompt records the PR URL, **then** it is a pm-notes `notes:` entry and `phases.pr_creation.url` is not written. | F-2, DM-2 |
| AC-F2-4 | **Given** a lifecycle completion whose pm-notes transition has been written to the working tree and whose commit act then fails (safety STOP, staging refusal, commitlint failure, or atomic abort), **when** the completion returns, **then** the phase is not reported complete, the ledger holds no transition, the pm-notes document is restored to its pre-write bytes, and no commit exists; **when** the same completion is retried, **then** exactly one transition and exactly one commit exist. **Given** the restoration itself fails, **then** the completion exits with code 2, reports a classified platform fault, states its reconciliation instruction, and does not claim success. | F-5, F-2, DEC-16, RSK-11 |
| AC-F3-1 | **Given** the lifecycle prompt inventory, **when** it is scanned for `git add`, `git commit`, `git commit -F`, or a hand-crafted commit instruction, **then** zero instructions remain. | F-3, NFR-4 |
| AC-F3-2 | **Given** `@committer` invoked with dirty work in a delivery session, **when** it runs, **then** it invokes the `commit` primitive with the resolved ref/phase context, reports the envelope, and performs no direct staging or commit. | F-3, F-4 |
| AC-F3-3 | **Given** a lifecycle completion with pending artifacts under the change folder, **when** `phase complete` runs, **then** the mapped plan-phase scope and the change folder are staged together and unrelated untracked strays remain unstaged. | F-5, DEC-4 |
| AC-F3-4 | **Given** a standalone `commit` for a change with no plan, **when** the change folder contains untracked artifacts for that ref, **then** they are staged; unrelated untracked strays are not staged and are disclosed. | F-5, DEC-4 |
| AC-F4-1 | **Given** an active delivery session, **when** `commit` or `phase complete` runs, **then** it does not return `commit.session.context-refused` and the operation proceeds under the primitive's normal safety and staging rules. | F-4, DEC-3 |
| AC-F4-2 | **Given** the harness one-shot transport, **when** it invokes the model, **then** it runs in a temporary empty project context with a sanitized environment and no delivery-session facts, and the temporary context is removed after the attempt. | F-4, DEC-3 |
| AC-F4-3 | **Given** the session-guard reversal, **when** the change is ready for delivery, **then** a TDR authored via `@decision-advisor` records the reversal and supersedes GH-227 DEC-6, and this spec references its identifier. | F-4, OQ-2 |
| AC-F5-1 | **Given** a lane hitting a decision, **when** it records the blocker, **then** it uses `blockers publish` with a closed type and does not write the pm-notes `blockers:` collection. | F-6, DEC-6 |
| AC-F5-2 | **Given** open typed questions, **when** the coordinator or owner starts an iteration, **then** they read them from `status`/`blockers list` and answer them with `blockers answer` as the audience routing permits, and the answer record carries the answer substance and `applied` posture. | F-6, F-7 |
| AC-F5-3 | **Given** a `credential-missing` question, **when** it is published, **then** the text carries only the variable name and a value is refused by the channel. | F-6, NFR-9 |
| AC-F6-1 | **Given** a `pr-open` delivery result, **when** the coordinator prepares to merge, **then** it verifies finalization with `verify change`/`phase list` and merges with `merge`, not `gh pr merge`/`glab mr merge`. | F-7, DEC-7 |
| AC-F6-2 | **Given** a full J1 iteration, **when** the coordinator runs it, **then** the sequence is `status` → (`blockers answer` when questions exist) → `merge` per ready item → `closeout --apply` → `queue plan --next N`, and no `gh pr list`/`gh pr merge` primary path is used. | F-7, DEC-7 |
| AC-F6-3 | **Given** the retained per-ticket dispatch, **when** the coordinator prompt is scanned, **then** `deliver-ticket.sh` remains the primary delivery call until M1-S9, `ceo-loop.sh` remains the outer supervisor, and no prompt claims `dispatch` or the daemon. | F-7, DEC-7, NG-1 |
| AC-F6-4 | **Given** `queue plan --next N`, **when** the next item is selected, **then** the prompt uses the returned `nextActions` and reasons rather than manual diff/queue discovery. | F-7, DEC-7 |
| AC-F7-1 | **Given** a plan with an optional `phases[].summary`, **when** `plan validate` runs, **then** the plan is valid and the summary is accepted/echoed; a plan omitting `summary` is also valid. | F-8, DM-1 |
| AC-F7-2 | **Given** a plan with a `tasks` key, **when** `plan validate` runs, **then** no consumer requires it and no prompt writes plan progress into the plan; progress remains in pm-notes `notes:`. | F-8, DEC-8 |
| AC-F7-3 | **Given** the plan writer's output, **when** it writes a plan, **then** it emits `delivery.plan.v1` with declared phases/scope and no task-progress log. | F-8, DEC-8 |
| AC-F8-1 | **Given** the prompt-required command set, **when** the coverage matrix is checked, **then** every command has `--help` and a reconciled reference page and the missing count is zero. | F-9, NFR-5 |
| AC-F8-2 | **Given** a lifecycle prompt, **when** its typed-binary invocations are scanned, **then** every invocation is in the allowed set and has help/guide coverage. | F-9, NFR-5 |
| AC-F8-3 | **Given** a lifecycle prompt reference to a bash entry point, **when** it is classified, **then** no *retired* entry point is the primary path and the prompt or guide classifies every retained entry point as retained per Appendix B. | F-9, NFR-4 |
| AC-F8-4 | **Given** `.opencode/**` changes, **when** the generated plugin check runs, **then** `.ados-claude/**` is regenerated and byte-current. | F-9, NFR-12 |
| AC-F8-5 | **Given** the doc-conformance fixtures for the §16.1 current-truth specs, **when** the scan runs, **then** each listed page no longer contains its named stale phrase and contains its required replacement — including `feature-delivery-lifecycle`, `feature-quality-gates-and-pr`, `feature-autonomous-delivery`, and `feature-local-code-review`. | F-9, NFR-13 |
| AC-F9-1 | **Given** the `merge`, `queue`, `verify`, `plan`, and `blockers` text surfaces, **when** the key=value goldens run, **then** the registered keys and grammar are byte-identical and no output-shape change occurs. | F-11, NFR-6 |
| AC-F9-2 | **Given** a replaced bash surface, **when** the replacement renders, **then** the registered keys in Appendix A are present; the retained `deliver-ticket.sh` summary keys are unchanged. | F-11, NFR-6 |
| AC-F10-1 | **Given** a fixture-backed pilot repository with a ready item and an open typed question, **when** the conformance suite drives `status` → `blockers answer` → `merge` → `closeout` → `queue plan`, **then** each command returns its declared success/verdict, the state ledger/git/files reflect the operations, and the next action names the expected next ref. | F-10, NFR-7 |
| AC-F10-2 | **Given** the pilot suite, **when** it runs twice with identical fixtures and fixed clock/ids, **then** the outputs are byte-identical and the stubs record zero outbound tracker/CI/provider/network calls. | F-10, NFR-7, NFR-3 |
| AC-F10-3 | **Given** the pilot suite, **when** it exercises merge and closeout, **then** state, git, files, and envelopes are real, clock and id generation are stubbed or deterministically injected, and only the tracker/CI/PR-platform/provider surfaces are stubbed. | F-10, NFR-7 |
| AC-F1-5 | **Given** the entrypoint, **when** it runs `--help`/`--version` in a directory with no configuration file, no project checkout, and no `DELIVERY_OS_WORKING_NAME`, **then** it succeeds, renders the neutral default `delivery-os` identity, requires no config file or project checkout, and performs no state/network/git/configuration read. | F-1, NFR-1, DEC-14 |
| AC-F1-6 | **Given** the entrypoint composition, **when** it is inspected and invoked, **then** it composes exactly the command set in §8.1 and no others — `state`, `mcp`, `dispatch`, and the resident daemon are asserted absent — and an invocation of a command outside the composed set returns the classified failure declared for an unavailable composition (a stable error code with its declared exit projection), never a silent success and never an unclassified crash. | F-1, DEC-13, NFR-2 |
| AC-F1-7 | **Given** the CLI package, **when** its manifest and tree are inspected and its bin is executed, **then** a non-installed bin entry with a Bun shebang is mapped in the `bin` manifest alongside a `main`/composition entry, the bin invokes the composition (not an in-process-only function), and the bin is absent from the installer's install set. | F-1, DEC-14, NG-2 |
| AC-NFR1-1 | **Given** the help/version surface, **when** the isolation suite runs, **then** it records zero state, network, git, or configuration reads and zero writes, and the command completes inside the suite's fixed timeout; wall-clock latency is recorded as informational only and is not a gate. | NFR-1, AC-F1-1, AC-F1-2 |
| AC-NFR3-1 | **Given** the conformance scans, **when** they run twice on the same tree, **then** they report identical counts and zero ambient reads. | NFR-3 |
| AC-NFR9-1 | **Given** the prompt and guide inventory, **when** the secret scan runs, **then** zero secret-shaped findings are reported and the commit safety scan remains unchanged. | NFR-9 |

### 17.1 Definition of Done (this change)

This change is done when every condition below holds. Each condition binds the §4.1 success metrics and/or the §17 acceptance criteria and the §9 NFRs to a testable outcome, names its verification evidence, and cites the delivering plan phase in `chg-GH-242-plan.yaml` (Phases 1–10) where the proof is produced. Test evidence is named by suite and **TC family** (TC-ENTRY, TC-SESS, TC-STAGE, TC-ADOPT, TC-PSCAN, TC-HELP, TC-KEYVAL, TC-COORD, TC-DOCREC, TC-PILOT, TC-ERRROW, TC-BLKADOPT, TC-PLANSUM); the test-plan revision assigns the exact case ID inside each family, and every case maps one-to-one to an AC in §17. This specification claims no passing evidence and no acceptance; the conditions define what must be proven. `dod_check` reopens the owning plan phase rather than waiving a row.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | The executable exists: a non-installed Bun bin entry mapped in the package `bin` manifest plus a `main`/composition entry, and the bin invokes the composition rather than an in-process-only function | F-1, AC-F1-1, AC-F1-7, DEC-14 | Entrypoint version suite (TC-ENTRY family) + bin/manifest structure assertion | Phase 1 |
| DoD-2 | Self-description is complete and isolated: root help, every prompt-required command help (usage, options, ≥1 example, exit codes, see-also), no-config `--help`/`--version` with the neutral default, and zero state/network/git/configuration reads or writes inside the suite's fixed timeout | F-1, AC-F1-1, AC-F1-2, AC-F1-5, AC-NFR1-1, NFR-1, NFR-5 | Help, help-coverage, and help-isolation suites (TC-ENTRY, TC-HELP families); coverage matrix | Phase 1 (help/isolation), Phase 7 (reference pages), Phase 8 (matrix) |
| DoD-3 | Identity and installer posture: identity renders from configuration or the non-empty `DELIVERY_OS_WORKING_NAME` override, falls back to the neutral `delivery-os` (never the seed literal) when neither is present, the forbidden-literal scan is green, and the bin is absent from the installer with installer tests unchanged | F-1, AC-F1-3, AC-F1-4, NFR-10, DEC-14, NG-2 | Version/identity suite (TC-ENTRY), forbidden-literal check, installer-absence structure test, install script tests | Phase 1 |
| DoD-4 | Composition is honest: exactly the §8.1 prompt-required set is composed, `state`/`mcp`/`dispatch`/daemon are asserted absent, and an uncomposed command returns the classified failure declared for an unavailable composition | F-1, AC-F1-6, DEC-13, DEC-14, NFR-2 | Entrypoint composition suite (TC-ENTRY family: prompt-set parity, absence assertions, classified-failure case) | Phase 1 |
| DoD-5 | Guard reversal and error-row retirement: in-session `commit`/`phase complete` no longer refuse, the one-shot stays sanitized, the `commit` domain is five rows with machine table, documented table, fixtures, and sync check aligned, and TDR-0013 records the reversal | F-4, AC-F4-1, AC-F4-2, AC-F4-3, DM-3, NFR-11 | Session adoption and harness one-shot suites, error-table sync/structure cases, TDR structure case (TC-SESS, TC-ERRROW families) | Phase 2 |
| DoD-6 | Phase state has one write path: zero prompt instructions write `started`/`completed`/`phases.pr_creation.url`; the PR URL is a pm-notes note; prompts read via `phase list` and write via `phase complete`/`reopen` | F-2, AC-F2-1, AC-F2-3, NFR-4 | Prompt/doc scan (TC-PSCAN) + adoption cases (TC-ADOPT) | Phases 5–6 (prompt edits), Phase 8 (scan) |
| DoD-7 | Staging scope is correct: completion stages mapped plan scope ∪ change folder; a plan-absent standalone commit stages the change folder; unrelated strays are never staged and are disclosed | F-5, AC-F3-3, AC-F3-4, DEC-4 | Staging suite (TC-STAGE family) | Phase 3 |
| DoD-8 | Completion ordering converges in **both** directions: the pm-notes transition is in the completion commit; the phase is complete only when the ledger transition lands; a failed commit act after the document write (safety STOP, staging refusal, commitlint failure, atomic abort) restores the pre-write bytes and leaves no transition and no commit; a failed restore exits 2 with a classified fault and a reconciliation instruction; a retry yields exactly one transition and one commit; the legacy post-commit window converges without a second commit | F-5, F-2, AC-F2-2, AC-F2-4, DEC-16, RSK-11 | Staging/ordering suite (TC-STAGE family: transition-in-commit, reverse-window failure injection per failure mode, failed-restore exit 2, retry single transition/commit, post-commit convergence) | Phase 3 |
| DoD-9 | Commits are primitive-backed: zero prompt raw-git commit instructions, and `@committer` invokes `commit`, reports the envelope, and performs no direct staging or commit | F-3, AC-F3-1, AC-F3-2, DEC-5 | Prompt scan (TC-PSCAN) + adoption cases (TC-ADOPT) | Phases 5, 8 |
| DoD-10 | Blockers are typed: lanes publish with a closed type and never write the pm-notes collection; the coordinator/owner reads from `status`/`blockers list` and answers with `blockers answer`; credential questions carry only the variable name | F-6, AC-F5-1, AC-F5-2, AC-F5-3, DEC-6 | Blocker adoption cases (TC-BLKADOPT) + prompt scan + secret scan (TC-PSCAN) | Phases 6, 8 |
| DoD-11 | The coordinator J1 iteration is typed: `status` → `blockers answer` (when questions exist) → `verify change`/`phase list` → `merge` → `closeout --apply` → `queue plan --next N`; no `gh pr list`/`gh pr merge` primary path; retained bash labeled retained | F-7, AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, DEC-7, DEC-15 | Coordinator cases (TC-COORD) + pilot J1 sequence (TC-PILOT) | Phase 6 (prompts), Phase 9 (pilot) |
| DoD-12 | The plan schema accepts and echoes optional non-empty `phases[].summary`, omission stays valid, no `tasks` key is added or required, and the plan writer emits no progress log | F-8, AC-F7-1, AC-F7-2, AC-F7-3, DM-1, DEC-8 | Plan schema cases (TC-PLANSUM family) | Phase 4 |
| DoD-13 | Help/guide coverage and plugin freshness: every prompt-required command has `--help` and a reconciled reference page; every prompt invocation is in the allowed set; no retired path is primary; `.ados-claude/**` is byte-current | F-9, AC-F8-1, AC-F8-2, AC-F8-3, AC-F8-4, NFR-5, NFR-12 | Coverage matrix (TC-HELP), prompt scan (TC-PSCAN), reference parity, plugin drift check | Phases 6–7 (docs), Phase 8 (matrix/scan), Phase 10 (final regeneration) |
| DoD-14 | Current-truth docs are reconciled against §16.1: each row's stale phrase is absent and its required replacement present, including the four omitted specs (`feature-delivery-lifecycle`, `feature-quality-gates-and-pr`, `feature-autonomous-delivery`, `feature-local-code-review`) | F-9, AC-F8-5, NFR-13, RSK-1 | Doc-conformance cases (TC-DOCREC family: stale-absent / required-present per row) | Phase 7 (guides, man page, reference pages), Phase 10 (feature specs, finalization) |
| DoD-15 | Key=value continuity holds: the Appendix A surfaces are byte-identical and the retained `deliver-ticket.sh` summary keys are unchanged | F-11, AC-F9-1, AC-F9-2, NFR-6 | Key=value goldens (TC-KEYVAL family) | Phase 8 |
| DoD-16 | The pilot proves the J1 loop deterministically: expected next ref, zero outbound tracker/CI/PR-platform/provider/network calls, byte-identical double run, and the stub/real matrix (state/git/files/envelopes real; clock and ids stubbed or deterministically injected) | F-10, AC-F10-1, AC-F10-2, AC-F10-3, NFR-7, NFR-8 | Pilot suite (TC-PILOT family) | Phase 9 |
| DoD-17 | Determinism and secrets hold: conformance scans report identical counts on repeat runs with zero ambient reads; zero secret-shaped findings in prompts, guides, and fixtures; the commit safety scan is unchanged | AC-NFR3-1, AC-NFR9-1, NFR-3, NFR-9 | Repeat-run scan comparison (TC-PSCAN), secret scan, safety-scan regression case | Phases 8, 9 |
| DoD-18 | Complete coverage: every §17 AC (AC-F1-1 … AC-NFR9-1) and every NFR (NFR-1 … NFR-13) has passing, traceable evidence; no AC is uncovered and no case is orphaned; every §4.1 metric row is at its target | §17, §4.1, NFR-1..NFR-13 | Test-plan coverage matrix all Covered; execution log populated; metric rows recorded | Phase 10 |
| DoD-19 | Quality gates and a clean tree: the aggregate gate (`pnpm check` — lint, format, typecheck, tests, boundaries, exports parity) is green plus every targeted suite named by a phase; the worktree is clean after the change; no unrelated file is committed | Delivery process, NFR-11 | Aggregate check log; per-phase targeted suites; clean `git status`; commit inventory matches the plan scopes | Phase 10 |
| DoD-20 | One-PR posture and disclosure: exactly one PR to `main-tools` (no split, DEC-15); the PR description states the behavioral change (in-session `commit`/`phase complete`) and the error-row retirement; the one-PR review-risk acceptance is recorded; TDR-0013 is presented for owner review | DEC-15, §18, RSK-8, AC-F4-3 | PR record and description; pm-notes risk-acceptance entry; TDR-0013 review note | Phase 10 / lifecycle `pr_creation` |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **One ticket, one PR.** Single change on `feat/GH-242/agent-integration`, PR targeting `main-tools` per the branch model, no split (DEC-15). The delivery brief requires exactly one work item per PR; the PM accepts the resulting review risk and mitigates it by phase independence (each plan phase is green on its own), review staged by commit, and the pilot suite as the end-to-end gate (RSK-8).
- The session-guard reversal is the headline behavioral change: the PR description must state that `commit` and `phase complete` now run inside delivery sessions, that `commit.session.context-refused` is retired, and that the harness one-shot remains sanitized. The TDR-0013 record carries the same disclosure for review.
- The entrypoint/help/version is additive and not installed; the PR must state that install/release remains a later change.
- The prompt, guide, and system-spec reconciliation is broad: review by inventory (§16.1) and by conformance scan, not by prose. The generated Claude plugin is regenerated in the same change and must be byte-current at the delivered HEAD.
- The pilot suite is the end-to-end evidence; the aggregate gate (`pnpm check`) still runs the full workspace suite, and the targeted gate suites named by each phase run with it. The conformance scans are wired into CI so later prompt edits cannot drift.
- The delivered HEAD must leave a clean worktree and commit no unrelated file; a stray change is either part of the declared scope or it is not committed.
- No data migration: the plan `summary` is additive, pm-notes notes are additive, and the error-row removal is a table change, not a data change.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No existing record, projection, document, or plan is rewritten. The plan `summary` is optional and additive; new pm-notes notes are ordinary usage; the retired error row is a table/document change. The pilot seeds a temporary fixture repository and state store, which are removed after the run.

## 20. PRIVACY / COMPLIANCE REVIEW

- Prompts and guides contain placeholders and command examples, never real credentials, tokens, tracker payloads, or customer data.
- The entrypoint's `--version` output is metadata only (identity and build/version); it does not read the environment beyond the working-name override and does not print secrets.
- The pilot fixtures are synthetic: stub tracker/CI/provider payloads contain no real personal data. No outbound call is made.
- Commit message generation and its safety scan are unchanged; secret-suspicious content still STOPs before staging or transport.
- The existing serialization redaction chokepoint covers the new help/version text; no new output path bypasses it.
- The coordinator loop reads the same digest the owner sees; no new personal data is collected or persisted.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Session-guard reversal:** `commit`/`phase complete` become available inside delivery sessions. The residual is that a compromised or confused session can create local commits; the primitive still never pushes, never rewrites history, runs the deterministic safety scan, excludes forbidden paths, and refuses secret-suspicious content. The TDR records the acceptance.
- **Error-row retirement:** removing `commit.session.context-refused` removes a refusal class; consumers must not rely on the old code. The table sync check prevents a half-removal.
- **Entrypoint composition:** the entrypoint must reuse the branding seam, the serialization redaction chokepoint, and the audit seam; it must not construct a second output path or a second name source. The forbidden-literal scan and the boundary tests cover the new modules.
- **Help/version isolation:** `--help`/`--version` must not read project files, configuration, state, credentials, or network; they are the one surface an agent can call before trust is established. The neutral `delivery-os` default is a constant identity for that surface only and never a product-name source elsewhere.
- **Prompt trust boundary:** prompts are product code; the conformance scan enforces the no-raw-commit and no-hand-written-phase-state invariants. Prompt examples must not include real secrets or live URLs.
- **Retained bash:** `deliver-ticket.sh`/`ceo-loop.sh` keep their existing safety posture; this change does not widen their permissions or retire their guards.
- **Pilot stubs:** stubs must implement the delivered ports and must not be reachable from the production entrypoint; the pilot composition is test-only.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The prompt/doc conformance scan and the help/guide coverage matrix become CI checks; a new prompt or command must satisfy them before merge.
- The key=value goldens pin the bash-continuity contract; a renderer change requires a deliberate golden update and a recorded decision.
- The allowed-command set is the integration contract; adding a prompt-required command means adding its `--help`, its reference page, and its coverage-matrix row.
- The plan `summary` follows the additive optional-field pattern; future plan fields should be optional and validated before a consumer reads them.
- `.ados-claude/**` regeneration is mandatory whenever `.opencode/**` changes; CI enforces drift.
- The entrypoint composition must stay in sync with the registered command definitions; an unregistered prompt-required command is a coverage-matrix failure.
- The bin is not part of the install set in this change; adding it to the installer is a later change (NG-2), and installer tests must not change here.
- Retained bash entry points are documented as retained; their eventual retirement belongs to M1-S9/M1-S18 and a separate change.
- The TDR and this spec are the durable record of the session-guard reversal and the error-row retirement.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Entrypoint | The production executable surface: a non-installed Bun bin entry plus the `main`/composition it invokes, which resolves the working name, registers the prompt-required commands, and runs the in-process CLI surface. |
| Self-description surface | `--help`, command `--help`, and `--version` output that lets an agent discover usage without reading source. |
| Lifecycle agent | The PM-style coordinator and its lane agents (plan writer, coder, reviewer, and the rest) that execute the 11-phase change lifecycle. |
| Phase-state sole-write path | The `phase` command family (`list`/`complete`/`reopen`) as the only schema-validated way to change lifecycle phase state. |
| Thin committer | `@committer` as a compatibility wrapper that invokes the typed `commit` primitive and reports its envelope, with no raw-git workflow. |
| Delivery session | An agent session operating a change; the harness may inject session facts, but after this change they do not refuse `commit`/`phase complete`. |
| Lifecycle completion staging scope | The mapped plan-phase scope union the change folder for the change ref. |
| Change folder | The `doc/changes/YYYY-MM/YYYY-MM-DD--<ref>--<slug>/` directory holding the change artifacts and pm-notes. |
| Typed blocker | A `blockers` question with a closed type, audience, lane, and bounded content; answerable as data. |
| Coordinator J1 iteration | The core M1 loop: digest, typed answers, merge, closeout, next pick. |
| Retained bash entry point | A bash path that remains primary because its replacement is not delivered: `deliver-ticket.sh` until M1-S9, `ceo-loop.sh` until M1-S18. |
| Retired bash entry point | A bash/raw path superseded as a primary lifecycle path: raw `git add`/`git commit`, `gh pr merge`, hand-edited phase state, prose blockers. |
| Key=value continuity | The machine-readable text summary grammar preserved on a replaced surface. |
| Pilot repository | A temporary fixture-backed repository with real state/git/files and stubbed tracker/CI/network, used for the J1 conformance evidence. |

## 24. APPENDICES

### Appendix A: Bash-continuity key=value register

| Surface | Keys (existing contract) | Obligation |
|---|---|---|
| `merge` text | `result=merged\|refused`, `squash=<sha>`, per-gate `ok`/refused lines | Preserve exactly; no key renames or reordering |
| `queue plan`/`queue list` text | Bounded per-entry/action summary lines; `degraded=`, `truncated=` where present | Preserve; envelope unchanged |
| `verify change` text | `result=<token>; variant=<full\|lite\|unknown>; missing=<ids\|->[; detail=...]` | Preserve exactly |
| `verify gates` text | Per-gate verdict lines and the summary | Preserve |
| `verify deploy` text | `verdict=verified\|unknown\|failed` | Preserve |
| `plan validate` text | `verdict=`, `artifact=`, `tier=`, `readyForDevelopment=`, `error=<code> field=<field>` | Preserve |
| `plan diff` text | `verdict=`, `against=`, classification lines, `truncated=` where present | Preserve |
| `plan overlap` text | `verdict=`, `overlapping=`, `reason=`, `ordering=` | Preserve |
| `blockers` text | `open=<n>`, `answered=<m>`, ranked question lines, `+N more questions omitted` | Preserve |
| `deliver-ticket.sh` summary (retained) | `result=`, `pr_url=`, `exit_code=`, `closeout_unverified=`, `last_message=` | Retained; no prompt may stop consuming it while dispatch is retained |
| `deliver-ticket.sh --status` (retained) | `delivering=`, `ref=`, `pid=`, `session_id=`, `stale=`, `delivering_marker=` | Retained |
| `ceo-loop.sh --status` (retained) | `loop_running=`, `loop_pid=`, `ceo_alive=`, `ceo_pid=`, `ceo_session=`, `stop_signal=` | Retained |

### Appendix B: Retained vs retired entry points

| Path | Status | Replaced by / reason |
|---|---|---|
| `git add` / `git commit` / `git commit -F` / post-hook amend in lifecycle prompts | Retired as a lifecycle write path | `commit` / `phase complete` |
| Independent commit message composition in `@committer` | Retired | `commit` primitive |
| Hand-edited `phases.<id>.started` / `completed` | Retired | `phase complete` |
| Hand-written `phases.pr_creation.url` | Retired | pm-notes `notes:` entry |
| Prose blockers in ticket comments / pm-notes `blockers:` | Retired for agent writes | `blockers publish/list/answer` |
| `gh pr merge` / `glab mr merge` as the lifecycle merge path | Retired | `merge` |
| `gh pr list` as the ready-set discovery path | Retired as primary | `status` ready-to-merge |
| `scripts/deliver-ticket.sh` per-ticket delivery | Retained until M1-S9 | `dispatch` not delivered |
| `scripts/ceo-loop.sh` outer supervisor | Retained until M1-S18 | daemon not delivered |
| `git status`/`git diff`/`git log`/`git rev-parse`/`git branch --list` read-only inspection | Retained | Read-only; no write path |
| `git push` and `gh`/`glab` PR creation in `@pr-manager` | Retained | No typed PR primitive in this change |
| `@runner` command execution | Retained | Not a coordination write path |

### Appendix C: Ticket AC traceability

| Ticket AC | Spec coverage |
|---|---|
| No lifecycle agent instruction writes phase state by hand | F-2; AC-F2-1, AC-F2-2, AC-F2-3, AC-F2-4 |
| No lifecycle agent instruction hand-crafts a commit for a phase transition | F-3, F-5; AC-F3-1, AC-F3-2, AC-F3-3, AC-F3-4 |
| Every tool call the prompts require has `--help` and a guide | F-1, F-9; AC-F1-2, AC-F1-6, AC-F1-7, AC-F8-1, AC-F8-2 |
| No prompt references a retired bash entry point as the primary path | F-9, Appendix B; AC-F8-3, AC-F6-3 |
| The bash-continuity key=value machine summaries are preserved on every replaced surface | F-11, Appendix A; AC-F9-1, AC-F9-2 |
| End-to-end: a coordinator session completes one full J1 iteration (digest, typed answers, merge, closeout, next pick) using only the tooling primitives on a pilot repository | F-10; AC-F10-1, AC-F10-2, AC-F10-3 |

The ticket's first acceptance clause groups two obligations in one sentence; this table (like the test plan's ticket-AC coverage) shows them as two rows so phase-state writes and hand-crafted commits each keep their own evidence.

### Appendix D: Pilot stub/real matrix

| Surface | Real or stubbed | Evidence |
|---|---|---|
| State ledger (JSONL, fences, verified reads) | Real | Transition/telemetry/closeout records and answer records are appended and read |
| Git working tree, commit objects, local bare remote | Real | Commit SHA, squash landing, branch/checkout behavior |
| Change-folder files, pm-notes, plan, spec | Real | Staged/committed content and document transitions |
| CLI envelopes, text renderers, exit codes | Real | Byte-identical goldens and exit assertions |
| `--help`/`--version` | Real | Entrypoint self-description |
| Tracker reads/writes | Stubbed | In-memory fixture; zero outbound calls |
| CI check-runs | Stubbed | Fixture gate evidence; zero outbound calls |
| PR-platform merge transport | Stubbed / local bare repo | Landing fixture; no platform API call |
| Provider and network | Stubbed | Unavailable by default; zero outbound calls |
| Clock and id generation | Stubbed or deterministically injected | Deterministic timestamps and run ids |

### Appendix E: Source documents

- Ticket GH-242 (M1-S20) and `doc/planning/oss-tooling/backlog.md` (M1-S20 scope/AC).
- `doc/planning/oss-tooling/milestones/m1/journeys.md` (J1, J2, J3, J5, J6, J7), `man-page.md`, and the command pages under `commands/`.
- `doc/spec/features/feature-commit-primitive.md`, `feature-pm-notes-lint-and-phase-transitions.md`, `feature-plan-schema.md`, `feature-blockers.md`, `feature-status-digest.md`, `feature-brief.md`, `feature-merge-verify-deploy.md`, `feature-closeout.md`, `feature-scheduling-engine.md`, `feature-result-contract.md`, `feature-agents-and-commands.md`, `feature-delivery-lifecycle.md`, `feature-quality-gates-and-pr.md`, `feature-autonomous-delivery.md`, `feature-local-code-review.md`.
- `doc/changes/2026-11/2026-11-05--GH-227--commit-primitive/chg-GH-227-spec.md` (NG-1, DEC-6).
- `AGENTS.md`, `doc/guides/change-lifecycle.md`, `.ai/agent/pm-instructions.md`, `.opencode/agent/*.md`, `.opencode/command/*.md`.
- `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, `scripts/build-claude-plugin.sh`.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | spec-writer | Initial specification from GH-242 planning context, the M1 pack journeys/man page/command pages, the delivered feature specs, and the PM-pinned decisions D1–D7. |
| 1.1 | 2026-11-07 | spec-writer | DoR iteration 1 remediation. RR-1: added §17.1 change-specific Definition of Done binding every AC/NFR and §4.1 metric to named evidence and plan phases, including TDR-0013/PR disclosure, plugin freshness, `pnpm check`, one-PR posture, and clean-tree requirements. RR-2: defined the reverse failure window in F-5/Flow 1 and added AC-F2-4 (restore, failed-restore exit 2, single transition/commit on retry) with DEC-16 and RSK-11. RR-6: reclassified `state` (no command surface) and `mcp` (package surface) out of the CLI command set, added NG-10 and AC-F1-6 absence assertions. RR-7: added the four omitted current-truth specs to §7.1/§16/§16.1/Appendix E with stale/required phrases, added AC-F8-5 and NFR-13, and widened RSK-1. RR-9: defined the non-installed bin plus `main` composition and the configuration → `DELIVERY_OS_WORKING_NAME` → neutral `delivery-os` identity chain, added DEC-14 and AC-F1-7, adjusted AC-F1-3/AC-F1-5. RR-10: replaced the p95 wall-clock gate with zero-I/O isolation inside the suite's fixed timeout (AC-NFR1-1, NFR-1, NFR-2) and made composition/fail-closed a must-pass AC (AC-F1-6). RR-11: kept one PR, removed the split mitigation, recorded the PM review-risk acceptance in DEC-15 and rewrote RSK-8. RR-12: Appendix C now shows six ticket-AC rows. RR-13: AC-F10-3 says "stubbed or deterministically injected" for clock and ids. No existing AC renumbered; DEC-1..DEC-13 and Appendix A unchanged. |

---

## AUTHORING GUIDELINES

- Sources: the GH-242 ticket body and AC, the M1 pack (journeys, man page, command pages), the delivered system specs for commit/phase/plan/blockers/status/brief/merge/closeout/scheduling/result/agents and the four reconciled current-truth pages (delivery lifecycle, quality gates and PR, autonomous delivery, local code review), the GH-227 spec (NG-1, DEC-6), the DoR iteration-1 verdict, and the PM-pinned decisions D1–D7.
- The spec is deliberately explicit about the current-state gaps because the ticket's value is the gap closure: no entrypoint, no help/version, a session guard that blocks adoption, a completion order that excludes pm-notes from the commit, a plan schema that omits the consumed `summary`, and prompts that still hand-write state and commits.
- Tech-neutral: the spec names logical components and the prompt/doc inventory, not implementation tasks or code-level instructions. Landing mechanisms (composition, ordering, scan grammar, fixture wiring) belong to the delivery plan.
- Done is defined, not assumed: §17.1 binds every AC and NFR to evidence and a plan phase; a condition without passing evidence reopens its plan phase rather than being waived.
- Scope honesty: DEC-15 records the one-ticket/one-PR posture and the explicit PM review-risk acceptance. The spec is complete for the full ticket, and the plan sequences the ten phases so each is independently green (foundation first, then coordination adoption, then the conformance scans and pilot).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-242)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, NG-, G-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability
- [x] Change-specific Definition of Done present (§17.1) — binds every AC and NFR, the §4.1 metrics, the TDR/PR disclosure, plugin freshness, the aggregate gate, the one-PR risk acceptance, and the clean-tree requirement to named evidence and plan phases
- [x] Reverse failure window for the completion ordering is specified and acceptance-tested (AC-F2-4, DEC-16, RSK-11)
- [x] `state` and `mcp` are classified as non-CLI surfaces and excluded from the composed and prompt-required set (AC-F1-6, NG-10)
- [x] The four omitted current-truth system specs are in §7.1/§16.1 with stale/required phrases (AC-F8-5, NFR-13)
- [x] Executable identity is defined as the non-installed bin plus main composition, with the no-config neutral default (DEC-14, AC-F1-7)
- [x] Self-description thresholds are deterministic, not p95 wall-clock gates (NFR-1, NFR-2, AC-NFR1-1)
- [x] One-ticket/one-PR posture and its review-risk acceptance are recorded (DEC-15, RSK-8)
- [x] Appendix C shows all six ticket acceptance criteria
- [x] No implementation tasks or step-by-step code instructions
- [x] Prompt/doc inventory is a scope inventory, not an implementation task list
- [x] Front matter validates per front_matter_rules
