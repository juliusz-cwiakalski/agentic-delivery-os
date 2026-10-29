---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/backlog.md
---
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
- Every story opens with a Goal line (what it achieves and why) so
  tickets and implementing agents carry the wider context, then Tasks
  and machine-checkable AC.
- Tasks are the concrete work inside a story; they become the story body
  when the tracking issue is created.
- Every story lists its dependencies (`Depends on:`); dependencies are
  strict (the story cannot deliver without them), not sequencing
  preferences. Suggested delivery order, including non-forced
  placements, lives in [backlog-ranking.md](backlog-ranking.md).
- M0 is fully specified. M1 through M4 are at outline level and get refined
  at the start of each milestone.
- Every story ends with machine-checkable acceptance criteria. Success is
  artifacts, not exit codes.
- Stories are self-contained for ticket creation: no private-repository
  references; ported prototypes have their command surface inlined in the
  ticket or named from this repository.

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
- Parked concepts shape seams, not schedules: design-level concepts in
  [concepts/](../concepts/README.md) that are deliberately not scheduled
  (containerized execution, the credential sidecar, worktree-scoped
  parallel leases, typed agent messaging) each name, under "Compatibility
  with the current build", what current stories must not foreclose. A
  story that would hardcode an assumption a parked concept needs
  reopened is a design defect, even when the story itself is correct.

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
- Goal: Stand up the monorepo and toolchain so every later story lands into a typed, CI-verified structure instead of accreting loose scripts; the scaffold is the substrate the whole tooling grows in.
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
- Depends on: none.

### M0-S2 Branding seam and working name
- Goal: One branding constant derives every name-derived value so the eventual public rename is a single swap, not an archaeology dig; the forbidden-literal test keeps the seam honest.
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
- Depends on: M0-S1.

### M0-S3 Result contract and error table
- Goal: Every command speaks one result contract so machines and agents can trust output even on failure; the error table makes failures classifiable instead of exit-code folklore.
- Tasks: CommandResult envelope (schemaVersion, runId, exitCode, timing,
  data or error); internal error table as the primary model (types in core
  ./contracts); exit codes as a projection of the table in the standalone
  CLI only; error classification chain (domain kind, app error code, exit
  code); runCli(argv, streams) testable; JSON machine output always valid;
  redaction chokepoint; error codes are self-describing for agents: stable
  symbolic hierarchical codes (domain.reason.detail, for example
  provider.quota.exceeded) plus structured fields on every error -
  category (user, platform, transient, permanent), retryable,
  consequence (did the mutation land; unknown is first-class), and a
  remediation hint; the ticket includes a short survey of
  AI-agent-facing error design (problem-details style structures,
  tool-use error guidance) validating or refining the convention.
- AC: unit and golden tests; a broken command under --json still emits a
  valid envelope; secrets never appear in output; error codes resolve to
  documented table entries.
- Depends on: M0-S1.

### M0-S4 Config layer (DEC-4)
- Goal: Configuration that is layered, validated, and traceable per key, so behavior differences are explainable and secrets never sit in files.
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
- Depends on: M0-S1, M0-S2, M0-S3.

### M0-S5 State layer
- Goal: Durable local state with torn-state detection so every verification reads truth, not zeros; the abstraction keeps the storage engine swappable.
- Tasks: local-first state behind an implementation-neutral abstraction;
  append-only JSONL plus SQLite indexes; schema-versioned; atomic replace;
  single-writer; key-set assertions on read;   POSIX 0700/0600 with a Windows
  ACL equivalent; retention starts at forever; planned levels local,
  project (shared), maybe global; workspace and fence identifiers
  (single-writer lock tokens) scoped as local fields to generalize
  before shared state.
- AC: torn state is detected and reported, never silently read as zeros;
  the abstraction has no implementation-dependent call sites.
- Depends on: M0-S1, M0-S2, M0-S3.

### M0-S6 status v1
- Goal: The first call of every session returns a bounded, evidence-backed digest of the delivery world, replacing the largest measured token cost (scripted probing) with one command.
- Tasks: six collectors: tracker (owner hand-backs, blocked deps, stalls,
  ticket hygiene), changes and PRs, CI, lanes or queue, providers,
  parked work. Artifact-verified reads; bounded digest output; machine
  JSON. The Jira read slice from M0-S19 precedes this story. The
  providers collector reads the declared chain from config and park
  states from the state layer - it does not depend on the provider
  engine; engine telemetry (M0-S13) enriches it later.
- AC: status on a live repository returns the six sections with
  evidence-backed states; no network call is treated as a verdict.
- Depends on: M0-S5, M0-S19.

### M0-S7 queue ready (read-only)
- Goal: A read-only ready-set answer for what can start now, so idle lanes beside a full queue become visible and closing beats opening.
- Tasks: readiness checks (deps satisfied, repo free, tier known, no owner
  gate, CI healthy, provider available - provider availability from the
  declared chain and park states, as in the M0-S6 collector); prints why
  a ticket is not ready; ranks close items (merge-ready, review-pending)
  above new starts.
- AC: a not-ready ticket names the missing readiness condition; close items
  rank above new starts.
- Depends on: M0-S6.

### M0-S8 verify change and exit taxonomy
- Goal: Verify a delivery against the phase ledger and classify the result tuple, killing the exit-zero false-success class at the verification layer.
- Tasks: verify a delivered change against the phase ledger, classify
  the delivery result tuple; exit taxonomy mapped to classified results.
  The result enum mirrors the bash-era summary contract
  (scripts/deliver-ticket.sh key=value summary) so dual-run evidence
  compares like with like. The ledger supports the LITE change variant
  (compressed phase set for small, low-risk changes; the variant and
  its required phases are declared in pm-notes): verification checks
  the declared variant's phase set, not a hardcoded eleven. Malformed
  pm-notes are classified with a code, never a crash (lint from M0-S10
  lands with this story).
- AC: verify on an incomplete ledger names the missing phases for the
  change's declared variant (full or LITE); malformed notes are
  classified; the taxonomy matches the delivery result enum.
- Depends on: M0-S5, M0-S10.
### M0-S9 verify gates v1
- Goal: One command evaluating all merge gates with citations, removing
  the manual merge checklist and its near-miss classes.
- Tasks: bundled with verify change; local gate battery for a pull request
  or change, the M0 battery enumerated: lifecycle finalization (verify
  change, against the change's declared variant - full or LITE), CI
  green on the pushed commit, push parity (local head equals
  remote branch head), owner-gate scan (no unanswered owner asks),
  squash preflight; suite-to-job awareness deferred to M2; citation
  layer for each gate (every verdict names its evidence).
- AC: verify gates catches a red pipeline, a missing job, and a vacuous
  green; each verdict cites its evidence.
- Depends on: M0-S8, M0-S19.

### M0-S10 pm-notes and registry lint, and phase transitions
- Goal: Pm-notes and registry writes are schema-checked and phase transitions flow through one idempotent path, making the ledger every verification reads authoritative.
- Tasks: schema and format conformance checks at write time for pm-notes
  and the delivery registry (`ados lint`); error on parse failure; key-set
  assertions; the pm-notes schema declares the change variant (full
  eleven-phase or LITE compressed set) and lint validates the declared
  variant's required phases. Phase transitions through `ados phase`
  (`phase list`, `phase complete`, `phase reopen` with a required
  reason) as the only write path for phase state; the coordinating
  agent and every lifecycle agent mark phases through it. Bundled with
  M0-S8 (verify change depends on it).
- AC: malformed notes are rejected at write; transitions are idempotent; a
  reopen without a reason is rejected; a LITE declaration missing one of
  its required phases fails lint; the ledger read by verify change is
  safe.
- Depends on: M0-S1, M0-S3, M0-S5.

### M0-S11 db session-admin port
- Goal: Safe admin for the harness session database so state bloat is managed without live-session damage.
- Tasks: port the session-database admin prototype (admin for the harness
  session store, the opencode session database; surface inlined in the
  ticket from the bash prototype): size, list, prune, reboot helpers;
  bounded output; dry-run by default.
- AC: prune is idempotent and safe to re-run; no live session lock is
  deleted.
- Depends on: M0-S1, M0-S3.

### M0-S12 Primitive ports, credential port, and embedded metadata
- Goal: Typed primitive ports with capability flags, one credential-resolution port, and the embedded metadata envelope: the contracts every adapter and provider interaction build on, with secrets centralized and the sidecar adoption path open.
- Tasks: primitive ports v1 with capability flags in core ./contracts (the
  primitive set is catalogued in ../concepts/primitive-catalogue.md);
  provider-agnostic adapter contracts behind them; the credential-
  resolution port in core with its environment-backed implementation -
  adapters and the provider engine never read secrets directly, so a
  future credential sidecar becomes the port's second implementation
  (concepts/credential-sidecar.md); embedded metadata envelope v1
  (comments and provenance, adapter-chosen carrier, per
  concepts/embedded-metadata.md). The port design documents the sidecar
  adoption path: in the sidecar era, adapter implementations gain a
  mediated mode that forwards operations to the sidecar (a remote
  adapter delegating over local transport) instead of executing with
  local credentials; the M0 port keeps this a documentation constraint
  only - the env-backed implementation stays simple.
- AC: ports are typed and carry capability flags; a boundary check fails
  CI on any secret read outside the credential port; the metadata
  envelope round-trips and degrades gracefully when a provider strips
  it.
- Depends on: M0-S1, M0-S3, M0-S4.

### M0-S13 provider v1
- Goal: Provider routing with quota awareness and named parks so spawn failures are announced and diagnosable events, not silent stalls; subscription-first keeps cost down.
- Tasks: quota and peak-window awareness; parks carry cause and expiry;
  subscription quota before pay-per-token; fail-loud announcements; the
  provider test battery ported from the legacy bash resolver tests in
  this repository (the ticket enumerates the battery cases); provider
  credentials resolve through the M0-S12 credential port, never direct
  environment reads.
- AC: a park reports its cause and expiry; provider outage is announced,
  not silent.
- Depends on: M0-S3, M0-S4, M0-S12.

### M0-S14 closeout v1 with branch cleanup
- Goal: The post-merge ceremony becomes one idempotent transaction, removing routine manual closeout misses per merge.
- Tasks: ticket to done, label sweep, unassign, owed-flip sweep (tickets
  the merge leaves owed an owner action flip to their owner-owed state),
  comment resolution, checkout restore, squash-safe branch cleanup.
  Harness telemetry capture joins closeout in M1-S11 (concepts/
  harness-telemetry.md).
- AC: closeout is idempotent; a re-run after restart converges.
- Depends on: M0-S19.

### M0-S15 Privacy and no-cloud guards
- Goal: Privacy and no-cloud guards in CI so private or hosted-only content can never land in committed files.
- Tasks: privacy-literal guard built from two parts - generic pattern
  rules in committed code plus a project-configurable hashed-literal
  list (raw private literals are never committed; only their hashes
  are); no-cloud-in-committed-files check; no secrets or private
  identifiers in embedded ADOS metadata; wired into CI.
- AC: a committed file containing a guarded literal fails CI; metadata
  envelopes are scanned at the emitter.
- Depends on: M0-S1.

### M0-S16 Interim mitigations, docs and config only
- Goal: Document the interim mitigations so the bash-era loop known rough edges are handled by config and docs until the engines replace them.
- Tasks: document permission-denial handling, stuck-minute defaults,
  in-flight warning for the delivery loop, pm-notes authoring rule. No
  shell feature work.
- AC: mitigations are docs or config only; no shell behavior changes.
- Depends on: M0-S4.

### M0-S17 Decision records and measurement baseline
- Goal: Lock the foundational decisions and command names before scaling delivery, and capture the bash-era baseline so later milestones prove improvement against numbers, not memory.
- Tasks: decision records for layout, config precedence, the adapter
  contract (providers and harnesses), state schema, release model, and
  the ID prefix scheme: the base registry from
  ../concepts/id-prefix-catalog.md adopted, with the project
  customization model (per-type versus single-sequence decision ranges)
  recorded; the
  command naming convention locked before M0 ends via the man-page v1
  acceptance recorded in a decision record; baseline numbers captured
  from the bash-era delivery record (ceremony share, cycle time, CI
  failure rate, false-signal incidents) with sources named in the
  ticket.
- AC: decisions recorded; names locked; baseline committed to the local
  measurement log with each number traced to its source.
- Depends on: none.

### M0-S18 License registry (doc/legal)
- Goal: A machine-read license registry with a fail-closed CI gate so unknown or denied dependency licenses block merges.
- Tasks: YAML registry under doc/legal/ (machine-parseable plus
  human-readable) listing dependency licenses and policy; CI license gate
  reads the registry and fails closed on unknown licenses; deny list
  enforced (SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC).
- AC: a dependency with an unregistered or denied license fails CI.
- Depends on: M0-S1.

### M0-S19 Client seeds with trap catalogs
- Goal: Tracker and VCS client seeds behind the primitive ports, each shipping its provider quirks as trap-catalog tests, so higher layers read providers through one truthful interface.
- Tasks: tracker and VCS client seeds behind the primitive ports, each
  shipping its documented quirks as trap-catalog tests: GitLab client
  (MRs, pipelines per commit, merge status quirks); Jira client (label
  replace, custom fields, transitions as data, comment omission), read
  slice first - it feeds the M0-S6 tracker collector; a minimal GitHub
  read slice (PRs, pipelines, issues) so this repository dogfoods status
  and verify change from M0 (the full GitHub adapter stays in M3-S3).
  All credentials flow through the M0-S12 credential port.
  Implementation basis per client is an evaluation recorded in the
  ticket: for GitHub and GitLab, provider CLIs versus direct APIs
  (mid-term maintenance versus control and trap coverage); for Jira,
  evaluate official or well-maintained open-source API or MCP client
  implementations before writing a custom one. The primitive port
  boundary makes the choice invisible to consumers either way.
- AC: each client's trap-catalog tests pass against recorded fixtures;
  the Jira read slice answers the tracker-collector queries named in
  M0-S6; the GitHub read slice serves status and verify change on this
  repository; no client reads a secret outside the credential port.
- Depends on: M0-S12.

### M0-S20 Adapter conformance suite v1
- Goal: The conformance flow suite that keeps every adapter honest for the same primitives, so adapter changes are gated by behavior, not review vigilance.
- Tasks: the conformance flow suite in primitives (change lifecycle,
  comment provenance roundtrip, label semantics) per
  concepts/adapter-conformance.md, run against every shipped adapter:
  mock tenants in CI plus scheduled live runs (scratch repos, Jira
  sandbox, strict teardown); suite green gates adapter changes.
- AC: the suite runs green on mocks in CI for every shipped adapter; a
  scheduled live run records a result artifact; an adapter change that
  breaks a flow fails CI.
- Depends on: M0-S19.

---

## Epic M1: Attention and minimal surfaces (months 2-3)

### M1-S1 Watchdog and lane contracts
- Goal: Watchdog checks that refuse dirty or non-base checkouts and restore on every exit, so stranded and foreign commits become structurally impossible.
- Tasks: pre-flight refuses non-base or dirty checkout; teardown restores on
  every exit; memory-publish verification; progress-based liveness.
- AC: stranded commits and foreign commits are refused or restored with
  evidence.
- Depends on: M0-S5.

### M1-S2 State validation everywhere
- Goal: Schema validation at every state boundary so torn or unknown registries are classified events, never silently read as empty.
- Tasks: schema checks at every state read/write boundary; classification of
  unknown, never silent zero. Coverage includes the delivery registry, the
  retro registry, and ceremony artifacts, not only pm-notes.
- AC: a torn registry read is classified, not treated as empty; retro and
  ceremony artifacts validate at their boundaries too.
- Depends on: M0-S5.

### M1-S3 doctor v1
- Goal: One command that diagnoses wiring problems with fix hints, so environment issues are found before they burn delivery quota.
- Tasks: doctor-style checks for repo, tracker, provider, state, CI wiring;
  stable exit codes.
- AC: doctor output names each failing check with a fix hint.
- Depends on: M0-S6, M0-S13.

### M1-S4 Merge and verify-deploy engine
- Goal: Merge as a verified transaction (gates fresh, squash, landing verified) plus deploy verification by job trace, killing merge near-misses and vacuous-green deploys.
- Tasks: merge transaction helper (verify gates fresh, squash, verify
  landed); deploy verification by job trace, not job status.
- AC: the merge helper refuses when gates were verified more than a bounded
  time ago; deploy verified by trace.
- Depends on: M0-S9.

### M1-S5 Owner-gate SLA
- Goal: Owner gates age into escalation or a default decision, never silence, so the fleet never idles on an unanswered ask.
- Tasks: 24 h stale-review escalation; 72 h default-on-expiry; aging visible
  in brief and board; one pre-agreed default per gate.
- AC: an owner gate older than the SLA ages into escalation or a proceed
  decision, never silence.
- Depends on: M0-S6.

### M1-S6 Brief render-only v0
- Goal: A deterministic, render-only owner brief so the owner daily attention starts from facts, not chat.
- Tasks: deterministic brief from the M0 collectors (tracker included) with
  explicit placeholders for unbuilt collectors; no LLM in the render path;
  one screen; decision-first layout.
- AC: brief output matches collector state exactly; placeholders are named,
  not silent.
- Depends on: M0-S6.

### M1-S7 Minimal MCP
- Goal: A minimal MCP surface over proven engines so agent sessions consume the same core results through their native tool interface.
- Tasks: thin MCP mirroring the CLI scope over proven engines: status,
  verify-artifact, gate report; no batch.
- AC: MCP tool calls return the same core results and stable error codes
  as the CLI; the MCP surface never propagates process exit codes
  (CommandResult envelope rendering stays in the CLI, per ADR-0003).
- Depends on: M0-S6, M0-S8, M0-S9.

### M1-S8 OSS retro pipeline
- Goal: The retro evidence pipeline with an independent evidence sidecar, so retrospectives read collector-truth delivery agents cannot alter.
- Tasks: retro collection, registry hardening, shape-crash guards, export;
  home of the periodic memory audit; the independent evidence sidecar -
  a collector identity delivery agents cannot write, append-only
  storage, trace ids, pipeline-truth checks (concepts/retrospectives.md).
- AC: retro output survives a malformed entry without data loss; a
  delivery agent cannot alter evidence the retro will read.
- Depends on: M0-S5, M1-S2.

### M1-S9 Dispatch dual-run pilot
- Goal: Dual-run dispatch beside the bash stack on pilot tickets, accumulating the verify-change evidence that justifies the later handover.
- Tasks: dispatch runs beside the bash stack on selected tickets in one
  pilot repository; verify-change evidence per ticket; shell stays
  authoritative.
- AC: pilot tickets produce dual-run evidence; divergence is reported.
- Depends on: M0-S8, M1-S11.

### M1-S10 status collector expansion
- Goal: Collector expansion toward full attention-state coverage so status keeps replacing manual probing.
- Tasks: expand beyond the six M0 collectors toward attention-state
  coverage; tracker ticket-hygiene assertions (epic membership, story
  points, in-sprint state) are named in this expansion.
- AC: each new collector is artifact-verified and bounded; ticket-hygiene
  assertions are covered by name.
- Depends on: M0-S6.

### M1-S11 Harness adapters and dispatch portability
- Goal: Dispatch becomes harness-agnostic through adapters and session telemetry lands in the event log at closeout, making the harness a configuration choice and cost data durable.
- Tasks: harness primitive ports (HarnessInstance, HarnessSession); the
  opencode delivery adapter (porting today's bash session spawn, resume,
  and liveness handling); the Claude Code delivery adapter (headless
  spawn); dispatch consumes a harness adapter instead of calling one
  harness directly (concepts/harness-adapters.md); harness telemetry
  extraction (read-only, from the opencode session store and Claude Code
  local files) captured into the event log at closeout, with session-tree
  attribution to work items (concepts/harness-telemetry.md); the spawn
  path carries an execution-environment descriptor (host is the only
  implementation now) and harness store locations resolve from
  configuration, so a containerized executor and bind-mounted shared
  stores slot in without redesign (concepts/
  containerized-delivery.md).
- AC: dispatch runs the same delivery through either harness adapter with
  identical result classification; liveness signals are harness-agnostic;
  the harness choice is configuration; after closeout the event log holds
  the delivery's session statistics (tokens by class, calls, tool usage,
  per agent and model) without re-querying harness stores.
- Depends on: M0-S12, M0-S13.

### M1-S12 Change capsule completion and closeout promotion
- Goal: Every merged change leaves a closed memory capsule (events plus promotion decisions), starting the learning loop at the change boundary.
- Tasks: complete every change folder as a memory episode capsule:
  append-only events.jsonl (phase transitions, gate outcomes, review
  verdicts; one stream with the telemetry concept) and a candidates/
  directory for memory promotion candidates; wire the memory step into
  closeout: validate capsule, identify candidates, dedup against
  project memory, link evidence, promote accepted items to exactly one
  canonical home, archive the capsule (concepts/memory-lifecycle.md);
  capsules stay self-contained through phases 1 to 10 (no cross-change
  writes), which is what later makes preparation phases safely
  concurrent (concepts/parallel-delivery.md).
- AC: every merged change leaves behind a closed capsule with events and
  a promotion decision (promoted or rejected with reason) per candidate;
  no candidate skips the capture bar or the evidence link.
- Depends on: M0-S5, M0-S14, M1-S8.

---

## Epic M2: Orchestration and measurement (months 3-6)

### M2-S1 Queue, lanes, dispatch
- Goal: The programmatic queue manages the delivery loop end to end: what is in flight, what needs review, what can start next; it starts work automatically when dependencies are satisfied and repos and resources are free, so the coordinating session stops being a dispatcher.
- Tasks: priority queue, lane plan with dependency awareness and a
  build-weight class (heavy builds excluded per runner), preemption,
  single-flight per repo keyed on remote; the queue manages the loop:
  in-delivery, needs-review, and ready states are computed from
  artifacts, and ready work starts automatically when dependencies are
  satisfied and repos and resources are free (the coordinator
  supervises; it no longer hand-dispatches). Single-flight is enforced
  through per-repo lease objects carrying a scope field; repo-exclusive
  is the only implemented scope, and worktree-scoped leases (the
  dormant N-per-repo mode) arrive without redesign
  (concepts/parallel-delivery.md).
- AC: two lanes cannot deliver the same repo concurrently; preemption
  releases the repo with a named park state; a heavy build is not scheduled
  onto a runner already carrying one.
- Depends on: M1-S9.

### M2-S2 Supervise
- Goal: A supervisor service with artifact-evidence liveness so stuck or lying deliveries are detected and acted on, not just observed.
- Tasks: supervisor service: tri-state status, progress watchdogs,
  duplicate-supervisor detection, lying-liveness signals by artifact
  evidence.
- AC: a stuck supervisor is detected by artifact evidence, not process
  state.
- Depends on: M1-S1, M2-S1.

### M2-S3 Ceremony runner
- Goal: Ceremonies become declared, deterministic units, cutting ceremony share of active agent time toward 40 percent and making catch-up automatic.
- Tasks: reduce ceremony share; compact at boundaries; tiered intake. A
  ceremony is a declared unit (schedule, inputs from collectors, render,
  verification, catch-up semantics), not hardcoded logic. The built-in
  set: morning brief, retro evidence pass, sprint rollover, night-watch,
  testing-session assessment (owner note to item-by-item assessment with a
  coverage verdict per item), and decision-record mirror sync to affected
  repos before a new ticket dispatches there. Projects declare their own
  ceremonies through the same contract (custom ceremony packs later).
- AC: ceremony share measured before and after; trend toward 40 percent;
  every built-in ceremony is parity-testable; a project-declared ceremony
  runs through the same runner without tooling changes; retro ceremonies
  follow concepts/retrospectives.md - declared trigger model,
  follow-through-first agenda, the fixed note schema, idempotent scope
  keys, and per-level outputs.
- Depends on: M0-S6, M0-S13, M1-S8.

### M2-S10 Retro action registry and follow-through
- Goal: The retro action registry with the five-field contract and artifact closure, so retrospectives produce verified follow-through, not lists.
- Tasks: the action registry behind every retro level: five-field
  contract (owner, verifiable verb, measurable outcome, tracker entry,
  due date) plus verification artifact; aging nudges and escalation;
  explicit closure rules (done with artifact, deprioritized with
  reason, superseded); board surface next to owner asks; improvement
  WIP limit per window (concepts/retrospectives.md; tracker anchor
  issue #43); communication analytics (unanswered asks, aging,
  escalation rates) join the evidence inputs once the message contract
  exists (concepts/inter-agent-communication.md).
- AC: an action without all five fields cannot be filed; every R4+
  retro opens with artifact-verified follow-through; aging is visible
  on the board; no action closes without an explicit decision and
  artifact or reason; actions carry outcome verifiers (delayed metric
  windows) and rollback conditions, and closure distinguishes artifact
  closure from outcome closure.
- Depends on: M1-S8.

### M2-S4 Board
- Goal: The fleet on one screen sharing one state source with brief and status, so coordination stops re-deriving the world.
- Tasks: full board of lanes, gates, owner asks, parked work; one screen
  sharing the brief and status state source.
- AC: board, brief, and status share one state source.
- Depends on: M1-S5, M2-S1.

### M2-S5 Steer
- Goal: The owner can change the course of a running delivery without killing the session: steering notes queue up, land at the next phase boundary, and carry receipts, so course corrections are safe and auditable.
- Tasks: owner briefs, escalation, resequencing heuristics with measured
  aging; queued steering notes delivered at phase boundaries. Steer is
  the first message type of a typed message contract (origin block,
  receipt, TTL, artifact-ref completion), not a bespoke owner-note
  channel; agent-to-agent messaging extends the same contract later
  (concepts/inter-agent-communication.md).
- AC: owner asks are batched with drawn defaults and measured aging; a
  steering note carries origin, a read receipt, and TTL; the message
  record schema is shared, not owner-specific.
- Depends on: M0-S10, M1-S11.

### M2-S6 Metrics and spend
- Goal: Delivery metrics and spend from the event log with alarms, so success claims and cost drift are measurable, not anecdotal.
- Tasks: ceremony share, per-dispatch tokens/cost/restarts, cycle time, CI
  failure rate, escaped defects; burn-rate alarms.
- AC: exit criteria measurable with committed numbers.
- Depends on: M1-S11, M2-S3.

### M2-S7 Suite-to-job mapping in gates
- Goal: Local gates must cite the same suite breadth as CI, so a narrow local suite cannot masquerade as full green.
- Tasks: local gates must cite the same suite breadth as CI.
- AC: a narrower local suite cannot masquerade as full green.
- Depends on: M0-S9.

### M2-S8 Memory records, layout, and lint
- Goal: The committed memory tree with typed records and lint, so project memory is one canonical, budgeted, reference-checked store.
- Tasks: the committed memory tree (.ai/memory: index README, lessons,
  tacit fragments, preferences, per-agent entry points, guild trees,
  retro archive)
  with one typed record per file (id, kind, scope, provenance, trust,
  validity, status; concepts/memory-architecture.md); memory lint in the
  quality gates: schema, dating, provenance, dangling references, index
  coverage, budget caps (kernel ~200 lines, index ~200 lines, agent
  entry ~150 lines), derivable-content heuristics, secret patterns.
- AC: lint fails on a record missing id/date/evidence, on an index line
  without a backing record and vice versa, and on budget violations;
  concurrent agents creating records produce zero merge conflicts.
- Depends on: M1-S12.

### M2-S9 Memory conventions in bootstrap templates
- Goal: Memory conventions wired into bootstrap templates so new projects start with the learning loop in place.
- Tasks: adoption checklist into the bootstrap flow and templates:
  memory tree scaffold, AGENTS.md kernel section, per-agent entry
  points, capture bar and promotion rules in the coordinator
  instructions and the retro ceremony, append-only retro notes with a
  generated index and a meta-learning file (concepts/
  memory-practices.md).
- AC: a newly bootstrapped project starts with the memory layout, the
  kernel section, and the capture/promotion rules wired into its
  ceremonies; the doctor runs as a manual checklist until tooling
  lands.
- Depends on: M2-S8.

---

## Epic M3: Surfaces, adapters, validators (months 6-9)

### M3-S1 Harness surfaces (opencode, Claude Code)
- Goal: The same commands and agents exposed in every supported harness from one canonical source, so the tooling multiplies into each surface without duplication.
- Tasks: expose the same commands and agents in each supported harness from
  one canonical source; generated artifacts per harness, sync-verified in
  CI, never hand-edited; pi.dev evaluation spike (concepts/
  harness-adapters.md).
- AC: same behavior via CLI and each harness surface, tested cross-surface;
  a definition change regenerates every harness artifact in one step.
- Depends on: M1-S11.

### M3-S2 Full MCP
- Goal: The full MCP surface with batch semantics so agent sessions get complete programmatic reach over proven engines.
- Tasks: full MCP surface over proven engines; batch semantics.
- AC: MCP matches CLI contracts and trap catalogs.
- Depends on: M1-S7.

### M3-S3 Adapter completion
- Goal: Adapter completion (full GitHub, Azure on demand) so the matrix
  of supported providers is real and parity-tested.
- Tasks: full GitHub adapter for dogfooding; Azure on demand; parity tests
  ported. Additional tracker kinds (Linear and others) are additive
  behind the primitive ports when needed; multi-tracker federation
  stays a parked concept (concepts/tracker-federation.md).
- AC: adapter matrix green per provider quirks.
- Depends on: M0-S19, M0-S20.

### M3-S4 Validators and deploy checklist
- Goal: Validators with classified errors for decision records, frontmatter, and deploy prerequisites, folding the validator backlog into the lint family.
- Tasks: decision-record validator, frontmatter validator,
  deploy-prerequisite checklist; folds the existing validator backlog work
  in this repository; a primitive-reference check: backticked
  PascalCase tokens matching the primitive-name shape must resolve to
  catalogue names (primitive-catalogue.md), so renamed or removed
  primitives cannot leave dangling doc references.
- AC: validation errors are classified with codes and fix hints.
- Depends on: M0-S10.

### M3-S5 Policy engine
- Goal: Policy as code: fleet drift detection, apply with rollback snapshots, and a rules register that flags prose rules, so written policy and enforced policy stop diverging.
- Tasks: declared repository policy (branch protection, required checks,
  merge rules) with fleet check and apply, exception profiles, and
  timestamped snapshots for rollback and forensics; a rules register
  mapping every written rule to its mechanical check or flagging it
  prose-only; enforcement consulted at the point of action. Policy
  documents are typed objects with a kind field (repository settings
  are the first kind); authority and autonomy policy is a classified
  future kind, so the engine never hardcodes the repository-settings
  shape. The policy inventory and classification live in
  ../concepts/policy-as-code.md (enforced today, prose today, future
  ideas; authority policy is AutonomyContract-shaped,
  software-delivery-autonomy.md).
- AC: policy drift across repos is detected and applies take a
  pre-change snapshot; a prose rule without a check is flagged by name,
  not enforced silently.
- Depends on: M0-S19.

### M3-S6 Workspace utilities
- Goal: Workspace utilities with safety rails so state, config, and repository hygiene operations are idempotent and never touch live deliveries.
- Tasks: backup, restore, migration helpers for state and config; clone,
  branch, and worktree hygiene with safety rails (worktree-per-delivery
  is the dormant parallel mode's mechanism; keep the utilities
  worktree-aware, concepts/parallel-delivery.md).
- AC: utilities are idempotent and tested against torn state; never touch
  repositories with live deliveries.
- Depends on: M0-S4, M0-S5.

### M3-S7 v1.0 internal readiness and bash deprecation
- Goal: V1.0 internal readiness with parity evidence and deprecation notices, the gate before public-release work.
- Tasks: parity evidence per engine; deprecation notices on old tools
  pointing to the new equivalents; removal plan at the very last stage.
- AC: every replaced bash command has a working new equivalent with a
  deprecation notice.
- Depends on: M2-S1, M2-S2, M2-S3, M2-S6.

### M3-S8 Memory command family
- Goal: The ados memory command family over canonical records, so memory governance (audit, promotion, supersession) is tool-enforced.
- Tasks: `ados memory` commands over the canonical records: lint,
  candidates, promote, supersede, conflicts, stale, doctor; the doctor
  bundles the full audit (schema, index coverage, budgets, dangling
  references, expired review dates, contradiction candidates); the
  promotion step enforces the approval matrix and the routing table
  (concepts/memory-architecture.md, memory-lifecycle.md).
- AC: every doctor finding is classified with a code and fix hint; a
  policy-class candidate cannot promote without recorded human approval;
  supersession closes validity windows without deleting history; records
  and index lines carry visibility tags, lint fails out-of-visibility
  references, and compile emits role-filtered projections (concepts/
  memory-autonomy-and-visibility.md); behavior-changing lessons cannot
  reach authoritative without validation evidence (replay, shadow, or
  canary result) and flag expired revalidation windows (concepts/
  memory-architecture.md, retrospectives.md).
- Depends on: M2-S8.

### M3-S9 Memory compiler to harness surfaces
- Goal: Canonical memory compiled into each harness native formats, so every surface reads the same memory without manual sync.
- Tasks: compile canonical memory into each harness's native context
  formats (AGENTS.md, CLAUDE.md, path rules, skills) from one canonical
  source, sync-verified, never hand-edited - the memory-side counterpart
  of harness surfaces (concepts/memory-architecture.md, M3-S1).
- AC: a canonical memory change regenerates every harness projection in
  one step; projections carry no content the canonical source lacks.
- Depends on: M2-S8, M3-S1.

---

## Epic M4: Public release readiness

### M4-S1 Naming freeze and rename
- Goal: The public name frozen and the rename drill executed, unblocking publication.
- Tasks: owner decides the final public name; swap the branding constant;
  migrate legacy .ados config once; re-run the rename drill; update docs,
  package scope, and registry names.
- AC: one constant swap plus migration renames everything; legacy paths
  warn.
- Depends on: M0-S2.

### M4-S2 Publication and release automation
- Goal: Release automation that publishes all public packages at one version from the frozen name, with provenance and self-update.
- Tasks: release job flips private off for the frozen name; changesets
  fixed group publishes one lockstep version line; registry provenance and
  SBOM; pinned tagged releases become the stable install source; `ados
  update` self-update.
- AC: a release publishes all five public packages at one version; the
  guard blocks any publish under a non-frozen name.
- Depends on: M0-S17, M3-S7, M4-S1.

### M4-S3 Docs, license registry, and public materials
- Goal: User docs, complete license registry, and public materials so the project is usable and contributable by outsiders.
- Tasks: user docs and guides; doc/legal/ registry complete; contributing
  guide and security policy; public changelog.
- AC: all distributable docs pass the distribution guard; registry is
  exhaustive for production dependencies.
- Depends on: M0-S18.

### M4-S4 Merge the tooling branch to the default branch
- Goal: The tooling branch merged to the default branch so installs and visibility move to the public baseline.
- Tasks: owner merges the delivery branch into the default branch; installs
  move there; the delivery branch is deleted.
- AC: the default branch carries the released tooling; no pull requests
  target the old branch.
- Depends on: M4-S2.

### M4-S5 Bash stack retirement
- Goal: The bash stack retired through a wrapper window then removal, closing the strangler migration.
- Tasks: during the deprecation window the retired entry points are
  compatibility wrappers that print a deprecation notice and delegate to
  the new equivalents (installed from M3-S7); after the window, remove the
  wrappers entirely.
- AC: during the window, every retired entry point prints the notice and
  delegates; after removal, no retired entry point remains and the new
  commands cover the documented surface.
- Depends on: M3-S7, M4-S4.

### M4-S6 Extension hooks (open-source side)
- Goal: Neutral extension hooks (opt-in sink, documented remote connection point) so local function stays complete and integrations are possible without proprietary leakage.
- Tasks: telemetry sink hooks behind the neutral event schema; a documented
  connection point for remote coordination services (off by default). No
  hosted-product behavior is specified or implemented in this repository;
  hosted capabilities live outside it (boundary rule).
- AC: the sink is opt-in and off by default; local function is complete
  with no remote service configured; the hook surface is a documented
  versioned contract; no proprietary content enters committed files.
- Depends on: M0-S5.

