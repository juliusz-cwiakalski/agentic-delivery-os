# OSS tooling backlog

Story backlog for the open-source tooling. Milestones and sequencing live in
[roadmap.md](roadmap.md); the command surface lives in
[cli-command-registry.md](cli-command-registry.md). The structure decision is
[ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); the working
name is `ados` until the naming freeze.

## Reading guide

- Epics map to milestones M0 through M4.
- Stories are the unit of delivery (one pull request each, 11-phase
  lifecycle).
- Tasks are the concrete work inside a story; they become the story body
  when the tracking issue is created.
- M0 is fully specified. M1 through M4 are at outline level and get refined
  at the start of each milestone.
- Every story ends with machine-checkable acceptance criteria. Success is
  artifacts, not exit codes.

## Cross-cutting principles (apply to every story)

- Verify by artifact: pushed commit, pull request, tracker state, head
  pipeline for the pushed commit.
- Bounded output: machine-readable result plus a short human digest.
- Failure visibility: every skipped or degraded path is reported.
- Idempotent: safe to re-run after crash or restart.
- Rollback story: revert to the bash behavior in one step.
- Working name: `ados` for binary, `ADOS_` env prefix, `.ados` config dir,
  and the state dir; all derived from the single branding constant, never
  from scattered literals.
- Open source content only in committed files.
- Tier and residence rules from ADR-0003.
- pnpm workspaces with Bun pinned; one lockstep version line via changesets
  fixed group; all packages private until the naming freeze, with a
  release-job publish guard.
- Configuration follows DEC-4 (layered chain, fail-closed validation,
  secrets environment-only).
- License: Apache-2.0; dependency licenses via the `doc/legal/` registry,
  fail closed.
- Old bash tools stay until their engine replacement passes parity; removal
  happens at the very last stage with a deprecation notice pointing to the
  new equivalent.
- Agents and engines speak ADOS primitives only; provider and harness
  dialect lives in adapters behind typed ports, the role-to-primitive policy
  layer is enforced at the port boundary, and the raw escape hatch is
  audited and off by default (concepts/agent-primitive-surface.md).
- Delivery is harness-agnostic: dispatch spawns sessions through harness
  adapters (opencode default, Claude Code supported, pi.dev a candidate),
  and the tooling ships as a generated plugin per harness from one
  canonical source (concepts/harness-adapters.md).

---

## Epic M0: Trust substrate (weeks 1-4)

Goal: a typed core, a truthful result contract, status and verify change
working end-to-end, the delivery loop usable on real tickets.

Protected subset (must land by week 4): status with the tracker collector,
verify change plus verify gates, provider, closeout, validation bundled with
verify change. Per-repo single-flight means M0 stories serialize, so the
protected subset is the weeks 1-4 relief promise; everything else in M0
floats behind it.

### M0-S1 Monorepo scaffold and toolchain
- Tasks: create packages/ per ADR-0003: core (runtime-neutral, subpaths
  ./contracts, ./state, ./branding, one createRuntime composition root),
  adapters (per-provider and per-I/O subpaths), cli, mcp, opencode, testkit
  (private, dev-only). pnpm workspaces with pinned packageManager and
  lockfile; Bun pinned to the most-recent stable with a four-copy
  pin-equality CI check; ESM; strict tsconfig; biome; commitlint + husky;
  dependency-cruiser on declared entrypoints plus workspace isolation;
  changesets fixed group lockstep versioning; builds with exports at dist;
  publint and package-export checks; CI fast loop wired to the delivery
  branch; package scripts for lint, format check, typecheck, test,
  boundary check, and one aggregate check.
- AC: fresh clone builds and runs the aggregate check green in CI;
  boundaries enforced; all six packages private with the publish guard in
  place.

### M0-S2 Branding seam and working name
- Tasks: branding module with the single name constant (working name ados)
  driving binary, package scope, env prefix `ADOS_`, config dir `.ados`,
  MCP prefix, telemetry namespace, docs URL; env override to swap the name
  at the naming freeze; forbidden-literal test that fails CI on any name
  literal outside the allowlist (the branding module plus the legacy
  adapter, per ADR-0003 DEC-8; the scan covers new code, the pre-existing
  corpus migrates separately); legacy `ADOS_*` and `~/.ados` adapter with a
  one-time warning; neutral telemetry schema (delivery.event.v1); rename
  drill documented.
- AC: every name-derived value traces to the branding constant; the
  forbidden-literal test fails CI on a literal outside the allowlist; the
  legacy adapter itself passes the scan; legacy env/config still read with
  a warning.

### M0-S3 Result contract and error table
- Tasks: CommandResult envelope (schemaVersion, runId, exitCode, timing,
  data or error); internal error table as the primary model (types in core
  ./contracts); exit codes as a projection of the table in the standalone
  CLI only; error classification chain (domain kind, app error code, exit
  code); runCli(argv, streams) testable; JSON machine output always valid;
  redaction chokepoint.
- AC: unit and golden tests; a broken command under --json still emits a
  valid envelope; secrets never appear in output; error codes resolve to
  documented table entries.

### M0-S4 Config layer (DEC-4)
- Tasks: layered chain built-in defaults < system < user-global < project
  committed (.<product>/config.yaml) < project local (config.local.yaml) <
  environment (ADOS_*) < CLI flags; maps merge recursively, lists replace;
  per-key origin via `config debug`; one schema validating each layer and
  the merged result; unknown keys error with the x- vendor namespace
  allowed; fail closed on malformed file; secrets environment-only with a
  hard CONFIG_INVALID in repository-scoped layers; CI mode disables the
  system and user-global layers; discovery walks up from the working
  directory to the git root and never above it; platform locations for
  Linux, macOS, Windows.
- AC: malformed config yields a classified error with a code, not a crash;
  config debug names the file and line for each key.

### M0-S5 State layer
- Tasks: local-first state behind an implementation-neutral abstraction;
  append-only JSONL plus SQLite indexes; schema-versioned; atomic replace;
  single-writer; key-set assertions on read; POSIX 0700/0600 with a Windows
  ACL equivalent; retention starts at forever; planned levels local,
  project (shared), maybe global; workspace and fence identifiers scoped as
  local fields to generalize before shared state.
- AC: torn state is detected and reported, never silently read as zeros;
  the abstraction has no implementation-dependent call sites.

### M0-S6 status v1
- Tasks: six collectors: tracker (owner hand-backs, blocked deps, stalls,
  ticket hygiene), changes and PRs, CI, lanes or queue, providers, parked
  work. Artifact-verified reads; bounded digest output; machine JSON. The
  Jira read slice from M0-S12 precedes this story.
- AC: status on a live repository returns the six sections with
  evidence-backed states; no network call is treated as a verdict.

### M0-S7 queue ready (read-only)
- Tasks: readiness checks (deps satisfied, repo free, tier known, no owner
  gate, CI healthy, provider available); prints why a ticket is not ready;
  ranks close items (merge-ready, review-pending) above new starts.
- AC: a not-ready ticket names the missing readiness condition; close items
  rank above new starts.

### M0-S8 verify change and exit taxonomy
- Tasks: verify a delivered change against the 11-phase ledger, classify
  the delivery result tuple; exit taxonomy mapped to classified results.
  Malformed pm-notes are classified with a code, never a crash (lint from
  M0-S10 lands with this story).
- AC: verify on an incomplete ledger names the missing phases; malformed
  notes are classified; the taxonomy matches the delivery result enum.

### M0-S9 verify gates v1
- Tasks: bundled with verify change; local gate battery for a pull request
  or change; suite-to-job awareness deferred to M2; citation layer for each
  gate.
- AC: verify gates catches a red pipeline, a missing job, and a vacuous
  green.

### M0-S10 pm-notes and registry lint, and phase transitions
- Tasks: schema and format conformance checks at write time for pm-notes
  and the delivery registry (`ados lint`); error on parse failure; key-set
  assertions. Phase transitions through `ados phase` (`phase list`,
  `phase complete`, `phase reopen` with a required reason) as the only
  write path for phase state; the coordinating agent and every lifecycle
  agent mark phases through it. Bundled with M0-S8 (verify change depends
  on it).
- AC: malformed notes are rejected at write; transitions are idempotent; a
  reopen without a reason is rejected; the ledger read by verify change is
  safe.

### M0-S11 db session-admin port
- Tasks: port the session-database admin prototype: size, list, prune,
  reboot helpers; bounded output; dry-run by default.
- AC: prune is idempotent and safe to re-run; no live session lock is
  deleted.

### M0-S12 Primitive ports and client seeds with trap catalogs
- Tasks: primitive ports v1 with capability flags in core ./contracts (the
  primitive set is catalogued in ../concepts/primitive-catalogue.md);
  provider-agnostic adapters behind them; the Jira read slice precedes
  M0-S6 (tracker collector); GitLab client (MRs, pipelines per commit,
  merge status quirks); Jira client (label replace, custom fields,
  transitions as data, comment omission); a minimal GitHub read slice
  (PRs, pipelines, issues) so this repository dogfoods status and verify
  from M0; the full GitHub adapter stays in M3-S3; embedded metadata
  envelope v1 (comments and provenance, adapter-chosen carrier); the
  conformance suite v1 (change lifecycle, comment provenance roundtrip,
  label semantics) with test tenants (scratch repos, Jira sandbox, strict
  teardown); trap catalogs encoded as tests.
- AC: trap catalog tests pass for each documented quirk; the conformance
  suite passes for every shipped adapter; metadata round-trips through the
  primitive view and degrades gracefully when absent.

### M0-S13 provider v1
- Tasks: quota and peak-window awareness; parks carry cause and expiry;
  subscription quota before pay-per-token; fail-loud announcements; the
  ported provider test battery.
- AC: a park reports its cause and expiry; provider outage is announced,
  not silent.

### M0-S14 closeout v1 with branch cleanup
- Tasks: ticket to done, label sweep, unassign, owed-flip sweep, comment
  resolution, checkout restore, squash-safe branch cleanup. Harness
  telemetry capture joins closeout in M1-S11 (concepts/
  harness-telemetry.md).
- AC: closeout is idempotent; a re-run after restart converges.

### M0-S15 Privacy and no-cloud guards
- Tasks: privacy-literal guard (denylist or hash list; generic paths);
  no-cloud-in-committed-files check; no secrets or private identifiers in
  embedded ADOS metadata; wired into CI.
- AC: a committed file containing a guarded literal fails CI; metadata
  envelopes are scanned at the emitter.

### M0-S16 Interim mitigations, docs and config only
- Tasks: document permission-denial handling, stuck-minute defaults,
  in-flight warning for the delivery loop, pm-notes authoring rule. No
  shell feature work.
- AC: mitigations are docs or config only; no shell behavior changes.

### M0-S17 Decision records and measurement baseline
- Tasks: decision records for layout, config precedence, the adapter
  contract (providers and harnesses), state schema, release model; the
  command naming convention locked (a decision record or the man-page v1
  acceptance) before M0 ends; baseline numbers captured (ceremony share,
  cycle time, CI failure rate, false-signal incidents).
- AC: decisions recorded; names locked; baseline committed to the local
  measurement log.

### M0-S18 License registry (doc/legal)
- Tasks: YAML registry under doc/legal/ (machine-parseable plus
  human-readable) listing dependency licenses and policy; CI license gate
  reads the registry and fails closed on unknown licenses; deny list
  enforced (SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC).
- AC: a dependency with an unregistered or denied license fails CI.

---

## Epic M1: Attention and minimal surfaces (months 2-3)

### M1-S1 Watchdog and lane contracts
- Tasks: pre-flight refuses non-base or dirty checkout; teardown restores on
  every exit; memory-publish verification; progress-based liveness.
- AC: stranded commits and foreign commits are refused or restored with
  evidence.

### M1-S2 State validation everywhere
- Tasks: schema checks at every state read/write boundary; classification of
  unknown, never silent zero. Coverage includes the delivery registry, the
  retro registry, and ceremony artifacts, not only pm-notes.
- AC: a torn registry read is classified, not treated as empty; retro and
  ceremony artifacts validate at their boundaries too.

### M1-S3 doctor v1
- Tasks: doctor-style checks for repo, tracker, provider, state, CI wiring;
  stable exit codes.
- AC: doctor output names each failing check with a fix hint.

### M1-S4 Merge and verify-deploy engine
- Tasks: merge transaction helper (verify gates fresh, squash, verify
  landed); deploy verification by job trace, not job status.
- AC: the merge helper refuses when gates were verified more than a bounded
  time ago; deploy verified by trace.

### M1-S5 Owner-gate SLA
- Tasks: 24 h stale-review escalation; 72 h default-on-expiry; aging visible
  in brief and board; one pre-agreed default per gate.
- AC: an owner gate older than the SLA ages into escalation or a proceed
  decision, never silence.

### M1-S6 Brief render-only v0
- Tasks: deterministic brief from the M0 collectors (tracker included) with
  explicit placeholders for unbuilt collectors; no LLM in the render path;
  one screen; decision-first layout.
- AC: brief output matches collector state exactly; placeholders are named,
  not silent.

### M1-S7 Minimal MCP
- Tasks: thin MCP mirroring the CLI scope over proven engines: status,
  verify-artifact, gate report; no batch.
- AC: MCP tool calls return the same core results and stable error codes
  as the CLI; the MCP surface never propagates process exit codes
  (CommandResult envelope rendering stays in the CLI, per ADR-0003).

### M1-S8 OSS retro pipeline
- Tasks: retro collection, registry hardening, shape-crash guards, export;
  home of the periodic memory audit.
- AC: retro output survives a malformed entry without data loss.

### M1-S9 Dispatch dual-run pilot
- Tasks: dispatch runs beside the bash stack on selected tickets in one
  pilot repository; verify-change evidence per ticket; shell stays
  authoritative.
- AC: pilot tickets produce dual-run evidence; divergence is reported.

### M1-S10 status collector expansion
- Tasks: expand beyond the six M0 collectors toward attention-state
  coverage; tracker ticket-hygiene assertions (epic membership, story
  points, in-sprint state) are named in this expansion.
- AC: each new collector is artifact-verified and bounded; ticket-hygiene
  assertions are covered by name.

### M1-S11 Harness adapters and dispatch portability
- Tasks: harness primitive ports (HarnessInstance, HarnessSession); the
  opencode delivery adapter (porting today's bash session spawn, resume,
  and liveness handling); the Claude Code delivery adapter (headless
  spawn); dispatch consumes a harness adapter instead of calling one
  harness directly (concepts/harness-adapters.md); harness telemetry
  extraction (read-only, from the opencode session store and Claude Code
  local files) captured into the event log at closeout, with session-tree
  attribution to work items (concepts/harness-telemetry.md).
- AC: dispatch runs the same delivery through either harness adapter with
  identical result classification; liveness signals are harness-agnostic;
  the harness choice is configuration; after closeout the event log holds
  the delivery's session statistics (tokens by class, calls, tool usage,
  per agent and model) without re-querying harness stores.

---

## Epic M2: Orchestration and measurement (months 3-6)

### M2-S1 Queue, lanes, dispatch
- Tasks: priority queue, lane plan with dependency awareness and a
  build-weight class (heavy builds excluded per runner), preemption,
  single-flight per repo keyed on remote.
- AC: two lanes cannot deliver the same repo concurrently; preemption
  releases the repo with a named park state; a heavy build is not scheduled
  onto a runner already carrying one.

### M2-S2 Supervise
- Tasks: supervisor service: tri-state status, progress watchdogs,
  duplicate-supervisor detection, lying-liveness signals by artifact
  evidence.
- AC: a stuck supervisor is detected by artifact evidence, not process
  state.

### M2-S3 Ceremony runner
- Tasks: reduce ceremony share; compact at boundaries; tiered intake. The
  enumerated ceremony set: morning brief, retro evidence pass, sprint
  rollover, night-watch, testing-session assessment (owner note to
  item-by-item assessment with a coverage verdict per item), and
  decision-record mirror sync to affected repos before a new ticket
  dispatches there.
- AC: ceremony share measured before and after; trend toward 40 percent;
  every ceremony in the set is parity-testable.

### M2-S4 Board
- Tasks: full board of lanes, gates, owner asks, parked work; one screen
  sharing the brief and status state source.
- AC: board, brief, and status share one state source.

### M2-S5 Steer
- Tasks: owner briefs, escalation, resequencing heuristics with measured
  aging; queued steering notes delivered at phase boundaries.
- AC: owner asks are batched with drawn defaults and measured aging.

### M2-S6 Metrics and spend
- Tasks: ceremony share, per-dispatch tokens/cost/restarts, cycle time, CI
  failure rate, escaped defects; burn-rate alarms.
- AC: exit criteria measurable with committed numbers.

### M2-S7 Suite-to-job mapping in gates
- Tasks: local gates must cite the same suite breadth as CI.
- AC: a narrower local suite cannot masquerade as full green.

---

## Epic M3: Surfaces, adapters, validators (months 6-9)

### M3-S1 Harness surfaces (opencode, Claude Code)
- Tasks: expose the same commands and agents in each supported harness from
  one canonical source; generated artifacts per harness, sync-verified in
  CI, never hand-edited; pi.dev evaluation spike (concepts/
  harness-adapters.md).
- AC: same behavior via CLI and each harness surface, tested cross-surface;
  a definition change regenerates every harness artifact in one step.

### M3-S2 Full MCP
- Tasks: full MCP surface over proven engines; batch semantics.
- AC: MCP matches CLI contracts and trap catalogs.

### M3-S3 Adapter completion
- Tasks: full GitHub adapter for dogfooding; Azure on demand; parity tests
  ported.
- AC: adapter matrix green per provider quirks.

### M3-S4 Validators and deploy checklist
- Tasks: decision-record validator, frontmatter validator,
  deploy-prerequisite checklist; folds the existing validator backlog work
  in this repository.
- AC: validation errors are classified with codes and fix hints.

### M3-S5 Policy engine
- Tasks: mechanical enforcement of rules at the point of action.
- AC: a prose rule without a check is flagged, not enforced silently.

### M3-S6 Workspace utilities
- Tasks: backup, restore, migration helpers for state and config; clone,
  branch, and worktree hygiene with safety rails.
- AC: utilities are idempotent and tested against torn state; never touch
  repositories with live deliveries.

### M3-S7 v1.0 internal readiness and bash deprecation
- Tasks: parity evidence per engine; deprecation notices on old tools
  pointing to the new equivalents; removal plan at the very last stage.
- AC: every replaced bash command has a working new equivalent with a
  deprecation notice.

---

## Epic M4: Public release readiness

### M4-S1 Naming freeze and rename
- Tasks: owner decides the final public name; swap the branding constant;
  migrate legacy .ados config once; re-run the rename drill; update docs,
  package scope, and registry names.
- AC: one constant swap plus migration renames everything; legacy paths
  warn.

### M4-S2 Publication and release automation
- Tasks: release job flips private off for the frozen name; changesets
  fixed group publishes one lockstep version line; registry provenance and
  SBOM; pinned tagged releases become the stable install source; `ados
  update` self-update.
- AC: a release publishes all five public packages at one version; the
  guard blocks any publish under a non-frozen name.

### M4-S3 Docs, license registry, and public materials
- Tasks: user docs and guides; doc/legal/ registry complete; contributing
  guide and security policy; public changelog.
- AC: all distributable docs pass the distribution guard; registry is
  exhaustive for production dependencies.

### M4-S4 Merge the tooling branch to the default branch
- Tasks: owner merges the delivery branch into the default branch; installs
  move there; the delivery branch is deleted.
- AC: the default branch carries the released tooling; no pull requests
  target the old branch.

### M4-S5 Bash stack retirement
- Tasks: during the deprecation window the retired entry points are
  compatibility wrappers that print a deprecation notice and delegate to
  the new equivalents (installed from M3-S7); after the window, remove the
  wrappers entirely.
- AC: during the window, every retired entry point prints the notice and
  delegates; after removal, no retired entry point remains and the new
  commands cover the documented surface.

### M4-S6 Extension hooks (open-source side)
- Tasks: telemetry sink hooks behind the neutral event schema; a documented
  connection point for remote coordination services (off by default). No
  hosted-product behavior is specified or implemented in this repository;
  hosted capabilities live outside it (boundary rule).
- AC: the sink is opt-in and off by default; local function is complete
  with no remote service configured; the hook surface is a documented
  versioned contract; no proprietary content enters committed files.
