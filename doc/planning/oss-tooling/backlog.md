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
- Created stories carry their tracking ticket (`- Ticket:` line,
  milestone-scoped); story codes are stable identifiers even before
  ticket creation.
- Every story lists its dependencies (`Depends on:`); dependencies are
  strict (the story cannot deliver without them), not sequencing
  preferences. Suggested delivery order, including non-forced
  placements, lives in [backlog-ranking.md](backlog-ranking.md).
- M0 is fully specified. M1 is fully specified as of the delivery-engine
  re-planning (2026-11-03). M2 through M4 are at outline level and get
  refined at the start of each milestone.
- Every story ends with machine-checkable acceptance criteria. Success is
  artifacts, not exit codes.
- Stories are self-contained for ticket creation: no private-repository
  references; ported prototypes have their command surface inlined in the
  ticket or named from this repository.

## Cross-cutting principles (apply to every story)

- Verify by artifact: pushed commit, pull request, tracker state, head
  pipeline for the pushed commit.
- Bounded output: machine-readable result plus a short human digest.
- Self-describing commands: `--help` with examples on every command and a
  man-page-grade guide; where a bash script emitted a stable machine
  contract (the key=value delivery summary), the replacement emits the
  same shape; stable exit codes per the error table.
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
- Ticket: GH-170 (milestone M0)
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
- Ticket: GH-171 (milestone M0)
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
- Ticket: GH-172 (milestone M0)
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
- Ticket: GH-173 (milestone M0)
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
- Ticket: GH-174 (milestone M0)
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
- Ticket: GH-175 (milestone M0)
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
- Ticket: GH-176 (milestone M0)
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
- Ticket: GH-177 (milestone M0)
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
- Ticket: GH-178 (milestone M0)
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
- Ticket: GH-179 (milestone M0)
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
- Ticket: GH-180 (milestone M0)
- Goal: Safe admin for the harness session database so state bloat is managed without live-session damage.
- Tasks: port the session-database admin prototype (admin for the harness
  session store, the opencode session database; surface inlined in the
  ticket from the bash prototype): size, list, prune, reboot helpers;
  bounded output; dry-run by default.
- AC: prune is idempotent and safe to re-run; no live session lock is
  deleted.
- Depends on: M0-S1, M0-S3.

### M0-S12 Primitive ports, credential port, and embedded metadata
- Ticket: GH-181 (milestone M0)
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
- Ticket: GH-182 (milestone M0)
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
- Ticket: GH-183 (milestone M0)
- Goal: The post-merge ceremony becomes one idempotent transaction, removing routine manual closeout misses per merge.
- Tasks: ticket to done, label sweep, unassign, owed-flip sweep (tickets
  the merge leaves owed an owner action flip to their owner-owed state),
  comment resolution, checkout restore, squash-safe branch cleanup.
  Harness telemetry capture joins closeout in M1-S11 (concepts/
  harness-telemetry.md).
- AC: closeout is idempotent; a re-run after restart converges.
- Depends on: M0-S19.

### M0-S15 Privacy and no-cloud guards
- Ticket: GH-184 (milestone M0)
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
- Ticket: GH-185 (milestone M0)
- Goal: Document the interim mitigations so the bash-era loop known rough edges are handled by config and docs until the engines replace them.
- Tasks: document permission-denial handling, stuck-minute defaults,
  in-flight warning for the delivery loop, pm-notes authoring rule. No
  shell feature work.
- AC: mitigations are docs or config only; no shell behavior changes.
- Depends on: M0-S4.

### M0-S17 Decision records and measurement baseline
- Ticket: GH-186 (milestone M0)
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
- Ticket: GH-187 (milestone M0)
- Goal: A machine-read license registry with a fail-closed CI gate so unknown or denied dependency licenses block merges.
- Tasks: YAML registry under doc/legal/ (machine-parseable plus
  human-readable) listing dependency licenses and policy; CI license gate
  reads the registry and fails closed on unknown licenses; deny list
  enforced (SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC).
- AC: a dependency with an unregistered or denied license fails CI.
- Depends on: M0-S1.

### M0-S19 Client seeds with trap catalogs
- Ticket: GH-188 (milestone M0)
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
- Ticket: GH-189 (milestone M0)
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

## Epic M1: Delivery engine and autonomous dispatch (months 2-3)

Goal: replace the bash delivery stack (`deliver-ticket.sh`,
`batch-deliver.sh`, `ceo-loop.sh`, `pm-liveness.sh`) with the typed delivery
engine: truthful signals, merge as a transaction, machine-readable delivery
plans, and scheduling plus waiting out of the coordinator's context. The
recorded operator input for this epic is
[operator-requirements-2026-11.md](operator-requirements-2026-11.md);
the re-planning decisions are recorded in roadmap.md (M0 exit amendment and
the M1 redefinition).

### M1-S1 Watchdog and lane contracts
- Ticket: GH-221 (milestone M1)
- Goal: Watchdog checks that refuse dirty or non-base checkouts and restore on every exit, so stranded and foreign commits become structurally impossible.
- Tasks: pre-flight refuses non-base or dirty checkout; teardown restores on
  every exit; memory-publish verification; progress-based liveness.
- AC: stranded commits and foreign commits are refused or restored with
  evidence.
- Depends on: M0-S5.

### M1-S2 State validation everywhere
- Ticket: GH-222 (milestone M1)
- Goal: Schema validation at every state boundary so torn or unknown registries are classified events, never silently read as empty.
- Tasks: schema checks at every state read/write boundary; classification of
  unknown, never silent zero. Coverage includes the delivery registry, the
  retro registry, and ceremony artifacts, not only pm-notes. Self-corruption
  salvage: a torn log tail is truncated to the last valid frame with a
  classified salvage record (data after the tear is quarantined, never
  silently read); indexes are rebuildable from the log alone; disk-full is
  a classified fail-closed event, never a partial write.
- AC: a torn registry read is classified, not treated as empty; retro and
  ceremony artifacts validate at their boundaries too; a torn tail
  salvages to the last valid frame with the salvage recorded; indexes
  rebuild from the log alone; disk-full fails classified with no partial
  write.
- Depends on: M0-S5.

### M1-S3 doctor v1
- Ticket: GH-224 (milestone M1)
- Goal: One command that diagnoses wiring problems with fix hints, so environment issues are found before they burn delivery quota.
- Tasks: doctor-style checks for repo, tracker, provider, state, CI wiring;
  stable exit codes.
- AC: doctor output names each failing check with a fix hint.
- Depends on: M0-S6, M0-S13.

### M1-S4 Merge and verify-deploy engine
- Ticket: GH-225 (milestone M1)
- Goal: Merge as a verified transaction (gates fresh, squash, landing verified) plus deploy verification by job trace, killing merge near-misses and vacuous-green deploys; every refusal names its gate with inline evidence.
- Tasks: merge transaction helper (verify gates fresh, squash, verify
  landed); deploy verification by job trace, not job status; the gate set
  is config-declared, versioned data, so repositories add gates (workspace
  test gates, deploy verification) without code; the gate freshness bound
  covers tracker state as well as CI (a ticket that moved to an
  owner-gated state after verification invalidates the verification);
  owner-gate classification (never-merge classes, owner-review-first) is
  policy-as-data the operator can inspect; waivers carry an authorizer
  principal, and the merge verifies the authorizer against the gate
  class's declared policy (owner-authored for never-merge classes) -
  presence of a waiver is never sufficient; the override path is a
  recorded waiver, never a hidden decision inside the tool; the refresh
  path: when the PR has fallen behind its base, the transaction attempts
  a rebase-refresh once, and a conflict is a classified refusal with the
  conflicting paths named (never a force path).
- AC: the merge helper refuses when gates were verified more than a bounded
  time ago; a refusal names the failed gate with inline evidence; deploy
  verified by trace; a repo-declared gate is enforced without code changes;
  a post-verification tracker transition to an owner-gated state is caught;
  an owner-gate classification is readable from declared policy; a waiver
  authored by a principal not authorized for the gate class is refused;
  a rebase conflict is a classified refusal naming the paths.
- Depends on: M0-S9, M0-S4.

### M1-S5 Owner-gate SLA
- Ticket: GH-229 (milestone M1)
- Goal: Owner gates age into escalation or a default decision, never silence, so the fleet never idles on an unanswered ask.
- Tasks: 24 h stale-review escalation; 72 h default-on-expiry; aging visible
  in brief and board; one pre-agreed default per gate. The escalation
  mechanism is designed for reuse by the typed blocker channel (M1-S16):
  one mechanism, two audiences (owner and coordinator).
- AC: an owner gate older than the SLA ages into escalation or a proceed
  decision, never silence.
- Depends on: M0-S6.

### M1-S6 Brief render-only v0
- Ticket: GH-228 (milestone M1)
- Goal: A deterministic, render-only owner brief so the owner daily attention starts from facts, not chat.
- Tasks: deterministic brief from the M0 collectors (tracker included) with
  explicit placeholders for unbuilt collectors; no LLM in the render path;
  one screen; decision-first layout. The brief renders from the same
  collector state as the status digest (one source of truth) and carries
  ready-to-merge, blocker questions, and owner-gate ages as anchored
  actions (blockers render as named placeholders until M1-S16 lands).
- AC: brief output matches collector state exactly; placeholders are named,
  not silent.
- Depends on: M0-S6.

### M1-S7 Minimal MCP
- Ticket: GH-231 (milestone M1)
- Goal: A minimal MCP surface over proven engines so agent sessions consume the same core results through their native tool interface.
- Tasks: thin MCP mirroring the CLI scope over proven engines: status,
  verify-artifact, gate report; no batch.
- AC: MCP tool calls return the same core results and stable error codes
  as the CLI; the MCP surface never propagates process exit codes
  (CommandResult envelope rendering stays in the CLI, per ADR-0003).
- Depends on: M0-S6, M0-S8, M0-S9.

### M1-S8 OSS retro pipeline
- Ticket: GH-232 (milestone M1)
- Goal: The retro evidence pipeline with an independent evidence sidecar, so retrospectives read collector-truth delivery agents cannot alter.
- Tasks: retro collection, registry hardening, shape-crash guards, export;
  home of the periodic memory audit; the independent evidence sidecar -
  a collector identity delivery agents cannot write, append-only
  storage, trace ids, pipeline-truth checks (concepts/retrospectives.md).
  Integrity wording is tamper-evidence, not prevention: on a single-user
  host nothing physically stops a lane process from touching the file,
  so the sidecar is hash-chained with a chaining key that never enters
  lane environments - a delivery agent cannot alter evidence
  undetectably, and the retro flags the tamper.
- AC: retro output survives a malformed entry without data loss; evidence
  alteration by a delivery agent is detectable (hash-chain break flagged,
  not silently trusted).
- Depends on: M0-S5, M1-S2.

### M1-S9 Dispatch engine: dual-run evidence and per-repo handover
- Ticket: GH-239 (milestone M1)
- Goal: The typed dispatch loop (spawn, watch, classify, summarize) runs beside the bash stack, accumulates verify-change evidence, and hands over per repository, so the new engine becomes authoritative with the bash stack demoted to fallback.
- Tasks: the per-ticket dispatch loop is this story's deliverable: spawn
  through the harness adapter, watch with progress-based liveness,
  classify into the TDR-0005 result enum, and emit the bash-continuity
  key=value summary contract. Two phases with different gates:
  (a) **evidence accrual** starts as soon as the scheduling engine ships
  its one-shot mode (M1-S17): dual-run on pilot tickets with the bash
  stack authoritative, verify-change evidence recorded per ticket,
  divergences reported; (b) **handover per repository** additionally
  requires the resident daemon live (M1-S18) and the evidence-based clean
  bar met. Clean is the conjunction of four conditions: (a) zero
  false-success incidents and zero unresolved divergences on the
  repository's pilot paths; (b) dispatch evidence exercising every
  TDR-0005 result class on real tickets; (c) an exposure floor of at
  least 20 dispatches or at least 7 consecutive days, whichever comes first,
  where that either/or binds only the floor and never substitutes
  for class coverage, incident truth, or corroboration; (d) corroboration,
  where an engine-claimed success is never sufficient and a dispatch
  counts clean only when artifact and tracker truth agree.

  The result-class condition is total over the vocabulary the classifier
  can emit, enumerated here for set comparison against the typed contract:
  `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `failed`,
  `finished`, `max-restarts`, `state-unverified`, `partial`,
  `noop-lane-permission`, `noop-lane-nothing-to-do`.

  Corroboration is exactly three evidence sources: completed pm-notes
  phases, tracker state, and CI on the pushed head. A success claim such
  as merged needs the pushed head, CI on that head, the tracker state,
  and completed phases; a tracker-derived claim such as pr-open,
  blocked, or pr-open-unverified needs the tracker fact. A result
  token alone never counts. Handover flips the repository to the engine
  as authoritative (recorded, reversible), and the bash entry points
  print deprecation pointers and remain reachable as fallback. Covers
  the functions of `deliver-ticket.sh`, `batch-deliver.sh`,
  `pm-liveness.sh` (coordinator-session supervision has its own story,
  M1-S23) and, with M1-S17/M1-S18, `ceo-loop.sh`'s loop-driving
  function.
- AC: pilot tickets produce dual-run evidence with divergence reported;
  a dispatch is classified exit-0-with-no-artifact as failed (never
  success); the key=value summary contract matches the bash shape;
  handover is refused while the repository's clean window is unmet and
  offered when met (the evidence gate is an AC, not a task note); a
  handed-over repository dispatches through the new stack end to end;
  the bash entry points still run as fallback with deprecation notices;
  handover is per repository and reversible.
- Depends on: M0-S8, M1-S11, M1-S17, M1-S18.

### M1-S10 status collector expansion
- Ticket: GH-243 (milestone M1)
- Goal: Collector expansion to full attention-state coverage so status keeps replacing manual probing and one digest bootstraps every session.
- Tasks: expand beyond the six M0 collectors toward attention-state
  coverage: lanes delivering versus idle-with-reason, ready-to-merge as a
  first-class action list, parked items with their conditions, owner-gate
  ages, spend summary (delivered by M1-S19); stable finding codes so
  findings are acted on without re-deriving; grouped, deduplicated, ranked
  output (four red CI findings on mains is one job, not four); the
  blockers section is a named placeholder until M1-S16; tracker
  ticket-hygiene assertions (epic membership, story points, in-sprint
  state) are named in this expansion.
- AC: each new collector is artifact-verified and bounded; ticket-hygiene
  assertions are covered by name; every finding carries a stable finding
  code; ready-to-merge ranks as an action list.
- Depends on: M0-S6.

### M1-S11 Harness adapters and dispatch portability
- Ticket: GH-233 (milestone M1)
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
  containerized-delivery.md); the execution-environment descriptor
  carries a deny-by-default environment allowlist: spawned harness
  sessions receive only the variables the descriptor declares (model
  routing, work paths), never the full parent environment - provider
  credentials resolve through the credential port at use time rather
  than by inheritance (concepts/credential-sidecar.md names the
  exposure class this closes).
- AC: dispatch runs the same delivery through either harness adapter with
  identical result classification; liveness signals are harness-agnostic;
  the harness choice is configuration; a spawned session's environment
  contains only allowlisted variables (an undeclared parent variable is
  absent from the spawn env); after closeout the event log holds
  the delivery's session statistics (tokens by class, calls, tool usage,
  per agent and model) without re-querying harness stores.
- Depends on: M0-S12, M0-S13.

### M1-S12 Change capsule completion and closeout expansion
- Ticket: GH-240 (milestone M1)
- Goal: Every merged change leaves a closed memory capsule (events plus promotion decisions), and post-merge mechanics become one idempotent command that emits judgment residue instead of consuming coordinator tokens.
- Tasks: complete every change folder as a memory episode capsule:
  append-only events.jsonl (phase transitions, gate outcomes, review
  verdicts; one stream with the telemetry concept) and a candidates/
  directory for memory promotion candidates; wire the memory step into
  closeout: validate capsule, identify candidates, dedup against
  project memory, link evidence, promote accepted items to exactly one
  canonical home, archive the capsule (concepts/memory-lifecycle.md);
  capsules stay self-contained through phases 1 to 10 (no cross-change
  writes), which is what later makes preparation phases safely
  concurrent (concepts/parallel-delivery.md). Closeout expansion: the
  owed-flip sweep of the merged diff (feature-flag and class strings,
  TODO markers, when-X-merges notes); MR comment-thread resolution
  check; tracker done plus hygiene (unassign the ball, sweep todo-class
  labels to done-class); branch and worktree cleanup; retro-coverage
  registry move; closeout emits a bounded judgment residue list
  (unresolved human comment threads, ambiguous flip hits) instead of the
  coordinator grepping diffs. Telemetry store clarification: harness
  telemetry (M1-S11) lands in the state-layer event log (the store
  `spend` reads); the capsule's events.jsonl carries phase, gate, and
  review events - two streams, two owners, no duplication. Closeout
  also triggers session compaction (through the `db` integration) for
  the closed delivery's sessions.
- AC: every merged change leaves behind a closed capsule with events and
  a promotion decision (promoted or rejected with reason) per candidate;
  no candidate skips the capture bar or the evidence link; closeout
  performs the full mechanical sweep idempotently and emits bounded
  judgment residue; the M1-S11 telemetry capture still lands in the
  state-layer event log after the closeout rewrite; a re-run after
  restart converges.
- Depends on: M0-S5, M0-S14, M1-S8, M1-S11.

### M1-S13 Machine-readable delivery plan schema
- Ticket: GH-226 (milestone M1)
- Goal: Delivery plans become machine-readable declared artifacts (per-phase scope, done-artifacts, leases, weight class, interactions) so parallelism is computable and the scheduler batches without an LLM in the loop.
- Tasks: the plan schema (YAML) as the plan-writer output format: each
  phase declares the files, packages, and folders it will modify; its
  done-artifacts (MR URL, pipeline id, deployed environment, tracker
  transition) so lane joins verify artifacts, not exit codes; the repo
  leases and build-weight class it needs; declared interactions (contract
  files, generated code) so the scheduler orders producers before
  consumers mechanically; the change variant or ceremony tier is data in
  the plan (per-tier phase sets and escalation triggers; no hardcoded
  eleven); planning phases are declared lease-free (safely parallel) and
  delivery phases lease-taking; the `ados plan` family: validate
  (schema), diff (declared scope versus actual branch diff), overlap
  (pairwise conflict answer: run in sequence or parallel); plan lint
  integrated into `ados lint`; the ready-for-development gate: a change
  is ready for development when its plan validates and its scope is
  declared; migration path from the markdown plan format (writer output
  flips; legacy markdown plans remain readable during transition).
- AC: a plan with an invalid schema is rejected with a classified error;
  the overlap of two plans that touch the same files answers
  run-in-sequence with the overlapping paths named; disjoint plans
  answer parallel; the tier is read from the plan, not hardcoded; the
  ready-for-development gate refuses a change whose plan does not
  validate.
- Depends on: M0-S5, M0-S10.

### M1-S14 Commit primitive and phase-transition commits
- Ticket: GH-227 (milestone M1)
- Goal: Commits become a tool primitive that computes the message from the working tree plus change context, and phase completion records and commits atomically, so agents stop hand-crafting commits and every transition lands as a conventional commit.
- Tasks: `ados commit`: compute a conventional commit message from
  uncommitted files plus the change context (ref, current phase, plan
  phase); precise staging (never untracked strays; privacy-scanned at the
  emitter); phase-transition integration: `ados phase complete` performs
  the record plus commit atomically for the completed phase's pending
  work, **on by default** (`--no-commit` opts out per call; config
  disables per project) - the PM's ledger transitions and the coder's
  plan-phase completions trigger the commit automatically, with no
  agent iteration spent on the commit act; idempotent re-run; respects
  the repository commitlint configuration. The design follows
  concepts/automated-commit.md (owner decisions recorded there):
  deterministic skeleton plus one constrained model call for the
  language parts (subject; body only when it earns its place), inference
  transports behind a seam, marked template fallback when no model is
  available, and the commit never runs inside a delivery session.
- AC: a commit message derives from tree state plus context without agent
  authorship; a plain `phase complete` lands the ledger transition and
  the commit atomically (both land or neither) by default, and `--no-commit`
  records the transition alone; stray untracked files are never staged; a
  re-run after interruption converges.
- Depends on: M0-S3, M0-S10.

### M1-S15 Session lifecycle economics
- Ticket: GH-235 (milestone M1)
- Goal: Sessions resume without re-paying prefill, liveness is progress-based, and restart budgets fail loudly, killing the resume-loop amplification class (the largest measured token-waste incident class).
- Tasks: progress-based liveness signals at the harness adapter level
  (heartbeat, session traffic, token delta; CPU is never the only
  signal; a prefilling or resuming session never reads as stalled);
  resume economics: a resumed session attaches and continues without
  re-paying its prefill, or the restart path is classified uneconomical
  and refused with a reason; a bounded restart budget with a classified,
  fail-loud terminal state (never a silent loop); lane status exposes
  the restart count and the amplification signal.
- AC: a large resuming session is not killed as stalled; a restart past
  the budget fails loudly with a classified reason visible in lane
  status; the resume-amplification metric is derivable per delivery
  (feeds M1-S19); budget exhaustion is durable and consumed by every
  resume path, daemon or one-shot (a one-shot resume past the budget is
  refused with the same classified reason), and its terminal state is
  escalation, not silence: the delivery is
  marked failed in the queue with the classified reason and restart
  history, and a typed question reaches the coordinator within one
  collection cycle (never a silent requeue loop).
- Depends on: M1-S1, M1-S11.

### M1-S16 Typed blocker and question channel
- Ticket: GH-230 (milestone M1)
- Goal: Blockers publish as typed, ranked, answerable questions and answers apply without re-entering delivery sessions, converting hours of lane idle into seconds.
- Tasks: typed question records (decision-needed with options,
  spec-ambiguity, credential-missing with variable name only and never
  values, external-wait) published to the state layer; every question
  carries an `audience` field (owner or coordinator) and answers are
  routed by it: `blockers answer` refuses a cross-audience answer except
  where policy-as-data explicitly delegates (the confused-deputy guard);
  free-text answers refuse credential values like the question path
  does; questions ranked in the
  status digest and brief; answerable as data (`ados blockers answer`);
  the answer is applied by the coordinator loop or the daemon and the
  lane resumes without a full session re-entry where the harness adapter
  declares the resume-injection capability (the laneResume mode records
  which path was taken: boundary-note, attach-continue, or
  resume-prompt-reentry as the acknowledged fallback with its prefill
  cost); one mechanism, two audiences: owner gates (M1-S5) and
  coordinator questions; credential values never transit the channel;
  the pickup contract: the coordinator session is woken (or its next
  iteration is triggered) when a question ranked top-of-digest is
  addressed to it - no question waits on the daily brief.
- AC: a blocker surfaces in the digest within one collection cycle as a
  typed question; an answer addressed to the wrong audience is refused
  (owner-audience question answered by a coordinator identity ->
  refused, with the policy that would delegate named); an answer resumes
  the lane, and when the adapter lacks resume injection the fallback is
  the declared re-entry mode with its cost acknowledged; question types
  are validated; a credential-missing question or answer carries the
  variable name and never a value.
- Depends on: M0-S5, M1-S5.

### M1-S17 Scheduling engine: queue, lanes, dependency batching
- Ticket: GH-237 (milestone M1)
- Goal: The programmatic queue with dependency awareness schedules the delivery loop end to end from declared plans, so the coordinator stops being a dispatcher and parallelism is computed, not discovered.
- Tasks: priority queue with explicit dependencies between changes
  (priorities, repos, dependency graph as one artifact); readiness
  computed from artifacts (builds on queue ready: deps satisfied, repo
  free, tier known, no owner gate, CI healthy, provider available);
  per-repo single-flight keyed on remote as the only structural lane cap
  (capacity, bandwidth, and CI slots never gate lane count); build-weight
  classes (at most one heavy-class job per constrained runner; a resource
  class, not a lane cap); dependency-aware batching (producers before
  consumers; a producer's deploy verified before a dependent repo
  merges); closing beats opening (merge-ready, in-review, and parked
  items rank above new starts); park and resume for external windows
  that re-check their condition continuously and resume exactly when it
  clears (a park that outlives its condition is a classified bug);
  preemption releases the repo with a named park state; lease objects
  carry a scope field (repo-exclusive is the only implemented scope;
  worktree-scoped leases arrive without redesign, concepts/
  parallel-delivery.md); one-shot mode: the queue computes the next
  action and a CLI one-shot executes it (daemon-free operation); lease
  acquisition runs through the fence-token state path (any writer may
  acquire, the daemon is just the usual holder), with a stale-lease
  takeover rule (age beyond the lease TTL with no heartbeat), so
  daemon-down one-shots are mutually exclusive too; park recheck
  semantics: each condition type declares a default recheck interval as
  configuration, a park whose condition cleared is auto-recovered with
  a recorded incident (a park outliving its condition is a classified
  bug, surfaced as a finding), and a parked lane is re-evaluated by the
  next one-shot or daemon start when the daemon was down.
- AC: two lanes cannot deliver the same repo concurrently (including two
  daemon-down one-shots: the second refuses with lease-held evidence);
  a heavy build
  is not scheduled onto a runner already carrying one; a ready producer
  is scheduled before its consumer; close items rank above new starts; a
  park resumes exactly when its condition clears (per-interval
  re-evaluation; auto-recovery with a recorded incident); the queue
  operates end to end without the daemon (one-shot mode).
- Depends on: M0-S7, M0-S13, M1-S2, M1-S4, M1-S13, M1-S15.

### M1-S18 Resident dispatch daemon
- Ticket: GH-238 (milestone M1)
- Goal: A resident daemon drives the queue continuously (single-instance, crash-safe, never a lane itself, degrading to CLI one-shots), so lanes never idle waiting for a coordinator iteration.
- Tasks: the daemon process (start, stop, status) supervises lanes by
  consuming the scheduling engine; single-instance enforcement (lock with
  staleness takeover); crash-safe: scheduling state lives in the state
  layer and a restart resumes the queue without lost or duplicated work
  (idempotent convergence: reruns never duplicate tickets, comments, or
  commits); the dispatcher is never a lane (it spawns and observes; it
  never runs delivery work in-process); progress-based liveness applied
  to its lanes (M1-S15); degradation: daemon failure or absence leaves
  the CLI one-shot path fully functional; runs under a real process
  supervisor (systemd or equivalent); prepares and queues merges but
  never fires them (roadmap constraint 9). The command-to-daemon
  communication contract: state-mediated truth with a local control
  socket (derived from the state dir) as an optimization for wake-now
  notifications and bounded live streams, never the only route; commands
  write intent records (queue entries, priorities, dependencies, blocker
  answers, resume notes) and the daemon writes execution records
  (leases, lane state, heartbeats, parks) under the state layer's fence
  tokens; every command interaction completes through the state path
  alone when the daemon is down, and the daemon reconciles on start.
  The wire contract is control protocol v1: NDJSON frames (request,
  response, event, error) over the unix socket with version negotiation
  (n and n-1), interaction classes poke, query, subscribe (bounded
  streams; overflow degrades the subscriber, never the dispatcher), and
  control (drain, stop, takeover under fence tokens); authorization is
  filesystem permissions (same-user); no business truth crosses the wire
  (every frame derivable from state) and secrets never transit it. The
  protocol is layered (codec, session, transport) with the transport
  config-selected behind an interface: the same frames and logic run
  over stdio in the conformance suite (the transport-independence
  proof), and remote or container-attached transports arrive later with
  one additive `intent` frame class and a handshake identity claim,
  never a protocol rewrite. Concurrency model: one connection per CLI
  invocation (responses routed to the asking connection only; ids
  correlate within a connection), a multi-connection single-event-loop
  server, mutations serialized through the single-writer state layer
  under fence tokens with idempotency keys, and one daemon per state
  dir so multiple agents and multiple projects on one host are isolated
  by scope. Persistence and recovery: the daemon is stateful through the
  state layer only (queue shape, lanes, leases, parks, restart counters,
  and budgets are durable; no fact that matters survives solely in
  memory); `daemon install` registers a user-level supervisor unit
  (systemd user unit with linger, launchd, Windows equivalent) scoped
  to the state dir so the daemon starts at login and survives logout,
  optional and local-first-neutral; on start (login, boot, or crash) a
  bounded idempotent startup reconciliation rebuilds the world from
  state and classifies every in-flight lane by artifact evidence:
  alive (reattach), interrupted (process gone without a failure record:
  resume from the ledger position, completed phases idempotently
  skipped, restart counter incremented), or crashed (failure recorded:
  reason classified, resume per budget). Trust model statement (explicit residual risk): the local
  transport's authorization is the filesystem boundary - every same-user
  process, including lane sessions executing repository code, is inside
  it; per-state-dir scoping isolates projects from each other, not lanes
  from the engine; the boundary is accepted for M1 and the escape paths
  are the parked concepts (credential sidecar, containerized lanes). A
  caller-principal field is reserved (unauthenticated locally, exactly
  like the handshake seam) on intent records and control frames, so a
  later lane-scoped authorization can retrofit without a schema break.
  External-effect protocol (the crash-safety mechanism behind the
  convergence claims): every externally-visible effect (tracker
  transition, comment, commit) is written as intent, applied once with a
  receipt, `unknown` consequence is first-class when the effect may have
  landed before its receipt, and re-apply is gated on query-based
  check-before-reapply reconciliation (the primitive-catalogue rows for
  CommandReceipt and OutboxEffect); commits are additionally protected
  structurally by M1-S14 atomicity and SHA idempotency. Resident-daemon
  polling hygiene: tracker and CI polling runs with per-platform
  rate limits and backoff as configuration (a resident process never
  hammers an API).
- AC: a second daemon instance is refused or takes over stale state with
  evidence; killing the daemon mid-delivery and restarting converges
  without duplicated work - commits structurally (atomicity plus SHA
  idempotency), tickets and comments via receipt-verified
  reconciliation with unknown-first-class classification and
  check-before-reapply (a re-driven effect that already landed is
  detected, not duplicated); deliveries continue via the one-shot CLI
  while the daemon is down; the daemon never executes a merge; commands
  that mutate scheduling or blocker state complete daemon-down and are
  applied on reconcile with zero loss; live-watch without the daemon
  declares degraded mode rather than failing or silently idling; intent
  records and control frames carry the reserved caller-principal field. The
  conformance suite drives the daemon over stdio, proving codec and
  session logic are transport-agnostic; concurrent invocations from
  multiple connections are answered without cross-talk and concurrent
  mutating requests serialize through the state layer with at-most-once
  application (idempotency keys). After an unclean stop or host
  restart, startup reconciliation classifies each in-flight lane
  (alive, interrupted, crashed) from artifact evidence, resumes
  interrupted deliveries from the ledger without redoing completed
  phases, and enforces restart budgets durably; an installed login unit
  starts the daemon against the right state-dir scope and its absence
  changes nothing for one-shot operation.
- Depends on: M1-S4, M1-S15, M1-S16, M1-S17.

### M1-S19 Spend read side and resume amplification
- Ticket: GH-236 (milestone M1)
- Goal: Per-ticket and per-phase spend plus the resume-amplification metric are visible from the event log, so waste classes are findable from the spend report alone.
- Tasks: `ados spend` v0 read side over the closeout-captured harness
  telemetry: per-ticket and per-phase tokens by class, calls, per agent
  and model; the resume-amplification metric (tokens paid versus unique
  progress); per-delivery restart counts; text digest plus JSON; alarms,
  burn-rate, and quota snapshots stay in M2-S6.
- AC: a closed change reports its spend breakdown from the event log
  without re-querying harness stores; the resume-amplification metric
  reads approximately 1 for a healthy delivery and flags amplification
  events by name.
- Depends on: M1-S11.

### M1-S20 Agent integration: prompts consume the tooling
- Ticket: GH-242 (milestone M1)
- Goal: The lifecycle agents (the PM-style coordinator and its lane agents: plan writer, coder, reviewer, and the rest) use the tool primitives for coordination, so coordination is tool calls, not prose discipline.
- Tasks: update the agent prompt definitions and lifecycle instructions:
  phase bookkeeping exclusively via `ados phase`; pm-notes writes through
  the linted path; plan-writer emits the M1-S13 plan schema; coder
  executes against declared phase scope and marks phase completion
  (record plus commit via the M1-S14 primitive); blockers publish as
  typed questions instead of prose; the coordinator consumes the digest
  and typed answers; man-page-grade guides and `--help` coverage for
  every command the agents call; bash-era instruction residue removed
  where superseded.
- AC: no lifecycle agent instruction writes phase state by hand or
  hand-crafts a commit for a phase transition; every tool call the
  prompts require has `--help` and a guide; no prompt references a
  retired bash entry point as the primary path; the bash-continuity
  key=value machine summaries are preserved on every replaced surface;
  end-to-end: a coordinator session completes one full J1 iteration
  (digest, typed answers, merge, closeout, next pick) using only the
  tooling primitives on a pilot repository.
- Depends on: M0-S10, M1-S4, M1-S10, M1-S13, M1-S14, M1-S16, M1-S17.

### M1-S21 Model profiles and provider watching
- Ticket: GH-234 (milestone M1)
- Goal: Model routing becomes profile-driven configuration (tier structure, per-agent overrides, selection heuristics, eligibility rules) with live provider watching and automatic switch-or-park, reverse-engineered from the legacy user-config resolver scripting; every harness spawn resolves a profile first, so quota and cost policy are enforced by machinery, not agent discipline.
- Tasks: the profile model as configuration data: tiers as structure
  (responsibility groups) and profiles as the model-per-tier assignment
  with per-agent overrides; the selection heuristics encoded as
  declarative policy (assign by consequence of an error times reasoning
  depth divided by volume; capability gates are hard rules - a
  text-only seat never receives a vision task; amplification and
  family-diversity rules declared, not hardcoded); profile hierarchy
  and preference chain (base, fallback, chain order; a profile is a
  candidate iff every provider it uses is available; probes lazy and
  memoized); provider watching for the first-iteration set behind the
  provider engine - the coding-plan subscription quota endpoints (weekly
  and rolling windows), the DeepSeek balance API, and the OpenAI
  subscription usage windows - with parks for expensive windows (peak
  hours, priced multipliers) and switch-not-park on exhaustion plus
  automatic revert on recovery; subscription pacing as configuration
  data (declared goal priorities: utilize the subscription window, keep
  the judgment seat until a configured tail, minimize paid use;
  pacing rungs move only the declared non-judgment seats); spawn
  integration: profile selection always runs before any harness spawn,
  whether from the CLI or the dispatch daemon, and the spawn wrapper
  injects the resolved model environment as validated data records,
  never shell code (the legacy hook's data-only env-record contract
  carries over); the current target profile persists in state with
  revert-on-recovery; the legacy resolver scripting's semantics are
  ported with its test battery (chain order, lazy probes,
  park-versus-switch, revert, condition seams); the env-record
  validation schema is adversarially hardened (variable-name shape,
  duplicate keys, metacharacters, homoglyphs, NUL and equals signs
  rejected; values are never shell-interpreted); seat assignments carry
  a typed pacingClass field (judgment or execution) as data - the
  pacing rungs move only execution-class seats, and the field, not a
  profile-naming convention, is what the engine enforces.
- AC: a spawn never starts without a resolved profile; an exhausted
  subscription provider switches to the next eligible profile
  automatically and reverts when it recovers; a provider in an
  expensive window parks with cause and expiry and resumes exactly when
  the window clears; a text-only seat never receives a vision task; the
  pacing rungs move only seats whose declared pacingClass is execution;
  chain,
  thresholds, rungs, and overrides are configuration (no code changes);
  the legacy scripting's decision table is covered by ported tests.
  Milestone-exit criterion (declared in): every harness spawn on the
  pilot paths resolves its profile through the engine, and the audit
  ledger shows zero manual model-environment overrides in the final
  two-week window.
- Depends on: M0-S13, M1-S11.

### M1-S22 Command audit ledger and agent identity
- Ticket: GH-223 (milestone M1)
- Goal: Every CLI invocation is audited (command, args, outcome, timing, caller identity) in a durable ledger, so scripted outputs can drop context fields agents do not need and auditor or retro agents get a trustworthy record.
- Tasks: append-only audit ledger in the state layer: runId, command,
  arguments (through the redaction chokepoint), exit code, timing,
  outcome class, scope or repo, and the calling agent's identity when
  provided; the identity convention is specified: an environment
  variable named through the branding seam, set by the harness adapter
  at spawn from the agent role and lane id (per-lane-unique shape),
  rendered into shells the agent starts by the harness plugin - the
  identity is unauthenticated attribution (recorded as claimed, not
  proven; see the S18 trust model); the envelope context fields
  (schemaVersion, runId, timing) are recorded here, enabling the
  scripted-mode output trim (the trim activates when this story lands;
  commands shipped before it emit the full envelope until then);
  retention follows the state layer; integrity is tamper-evident
  hash-chaining (a chaining key that never enters lane environments),
  so records cannot be altered undetectably - wording is
  tamper-evidence, not prevention, on a single-user host; a bounded,
  filtered read surface for retro and auditor agents.
- AC: every command invocation produces exactly one audit record
  (idempotent re-runs distinguished by runId); the calling agent's name
  is captured when provided and never inferred when absent; scripted
  `--json` output omits schemaVersion, runId, and timing (errors keep
  runId as the correlation key) while the audit
  record retains them; the ledger survives a malformed entry without
  data loss; undetectable alteration of a record is not achievable
  within the trust model (hash-chain break flags); secrets never appear
  in any record.
- Depends on: M0-S3, M0-S5.

### M1-S23 Coordinator supervision
- Ticket: GH-241 (milestone M1)
- Goal: The coordinator session gets the same managed lifecycle lanes have (resume on context pressure, artifact-evidence stuck detection, kill with grace, bounded restarts, wake on typed questions), replacing `ceo-loop.sh`'s actual function so the bash stack can retire at M4-S5 with no actor left unmanaged.
- Tasks: coordinator-session supervision beside the lane daemon: spawn
  and join-or-resume decisions under context pressure (resume the
  existing session when its context is recoverable, spawn fresh when
  not, with the decision recorded); stuck detection by artifact
  evidence (no digest consumed, no merge, no answer within declared
  windows - not CPU); kill the coordinator tree with a grace period;
  bounded restart budget with classified, loud exhaustion (escalates to
  the owner brief, never a silent loop); wake-on-typed-question: a
  top-of-digest coordinator-audience question triggers the next
  coordinator iteration (the M1-S16 pickup contract's enforcement
  arm); runs under the same supervisor regime as the daemon
  (`daemon install` scope), distinct process, distinct budget.
- AC: a coordinator session killed mid-iteration resumes or is
  respawned per the recorded decision without losing closed-out work;
  a stuck coordinator is detected by artifact evidence within the
  declared window and restarted with the reason classified; restart
  exhaustion escalates to the owner brief (never silent); a
  coordinator-audience typed question wakes the coordinator within one
  collection cycle; the ceo-loop.sh functions are covered: context
  resume decision, stuck detection, kill-with-grace, restart budget.
- Depends on: M1-S15, M1-S16.

---

## Epic M2: Ceremonies, measurement, and memory (months 3-6)

Note: the M1 redefinition moved the queue, lanes, and dispatch core (the
former M2-S1) into M1; its content is delivered by M1-S17 (scheduling
engine) and M1-S18 (resident dispatch daemon). The M2-S1 code is retired;
the gap is deliberate. M2 stories keep their codes.

The M2 stories below now read on three levels. A repository is one git
checkout and stays the delivery unit; a project is a named group of
repositories whose membership is declared in configuration; a workspace is an
optional persisted directory usable as a discovery root, and it is never
required. The naming boundary follows from that: `repos` is the flat enumeration and `projects` is the group surface.
The first is owned by the amended M2-S11 and the second by M2-S18.
Entrypoint consequence: both become root families, so the root listing meets
the repository family and the project family separately.

### M2-S2 Supervise
- Goal: A supervisor battery with artifact-evidence liveness so stuck or lying deliveries are detected and acted on, not just observed, running over the M1 daemon's lanes.
- Tasks: supervisor battery: tri-state status, progress watchdogs,
  duplicate-supervisor detection, lying-liveness signals by artifact
  evidence, restart policies over the resident dispatch daemon.
- AC: a stuck supervisor is detected by artifact evidence, not process
  state.
- Depends on: M1-S1, M1-S18.

### M2-S3 Ceremony runner
- Goal: Ceremonies become declared, deterministic units, cutting ceremony share of active agent time toward 40 percent and making catch-up automatic.
- Tasks: reduce ceremony share; compact at boundaries; tiered intake. A
  ceremony is a declared unit (schedule, inputs from collectors, render,
  verification, catch-up semantics), not hardcoded logic. The built-in
  set: morning brief, retro evidence pass, sprint rollover, night-watch,
  testing-session assessment (owner note to item-by-item assessment with a
  coverage verdict per item), and decision-record mirror sync to affected
  repos before a new ticket dispatches there. Projects declare their own
  ceremonies through the same contract (custom ceremony packs later). The
  ceremony tier engine lands here: per-tier phase sets and escalation
  triggers as data, consuming the tier declared in M1-S13 plans.
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
- Depends on: M1-S5, M1-S17, M2-S11.

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
  failure rate, escaped defects; burn-rate alarms. Builds on the `ados
  spend` read side delivered in M1-S19; this story adds the alarm and
  metric layers.
  Consumes M2-S14 telemetry for per-agent and per-model facts.
- AC: exit criteria measurable with committed numbers.
- Depends on: M1-S19, M2-S3, M2-S14.

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

### M2-S11 Multi-repository workstations
- Ticket: GH-288 (milestone M2)
- Progress: delivered by GH-288 — the two-layer state scope (host root plus a
  per-repository project root), the checkout identity marker with its minted
  project key, the derived host index with bounded maintenance and the
  collision guard, the read-only `projects list [--json]` overview, the
  one-step migration guide, and the host-wide owner hold preserved.
- Goal: Multiple delivery-managed repositories on one workstation are
  first-class: state is scoped per repository so same-ref collisions are
  impossible, and `repos list` is the flat enumeration of every managed
  checkout.
- Tasks: per-repository state scoping derived from the checkout identity
  (git common dir marker) with a host-level index; `repos list` reporting
  repo key, root, state location, daemon reachability, handover state;
  migration note for existing single-store users; tests proving two checkouts
  using the same ref cannot observe each other's documents; transition note:
  if a flat `projects list` had landed before the group story (M2-S18), the
  group story renames it with a deprecation alias.
- AC: two checkouts of different repositories on one host, both using ref
  GH-241, hold disjoint phase state and queue entries; `repos list`
  enumerates them without manual configuration.
- Depends on: M0-S5, M1-S17.

### M2-S12 Evidence inspection and divergence resolution
- Goal: The dual-run evidence ledger is inspectable and actionable from the
  CLI, so handover decisions and retros rest on readable evidence, not file
  spelunking.
- Tasks: `dispatch attempts [--ref] [--limit]` read side (token, corroboration
  triple, divergence refs, timestamps, harness); operational divergence
  resolution flow (`dual-run resolve`) including resolution from
  local evidence when live truth reads are unavailable; coverage and floor
  reporting remains as exposed by the summary.
- AC: attempt history for a repository is retrievable as a machine envelope; a
  recorded divergence can be resolved with a note and leaves unresolved
  counts; resolve works when tracker truth is unreachable
  (local-evidence mode) with the mode declared.
- Depends on: M1-S9.

### M2-S13 Public event taxonomy
- Goal: The daemon subscribe surface carries a versioned, documented event
  taxonomy covering delivery state changes, so any client (watch commands,
  scripts) consumes one contract.
- Tasks: extend topics beyond status/lanes to queue.graph, dispatch.attempt,
  phase.state, blockers.state; document event kinds, payloads,
  ordering guarantees, and the slow-consumer overflow-to-repoll rule as a
  public versioned contract; contract tests per topic.
- AC: a client subscribed to queue.graph
  observes entry and dependency changes it can act on; the taxonomy document
  version is pinned by tests;
  overflow degrade behavior is preserved for every topic.
- Depends on: M1-S18.

### M2-S14 Harness telemetry v2
- Goal: Token, cost, and timing telemetry captured per ticket, repository,
  lane, agent role, and model from the opencode v2.x.y stream, so spend,
  metrics, and retro state facts instead of estimates.
- Tasks: ingest per-step cost/tokens from the harness JSONL stream (opencode
  v2.x.y step frames), attributed through session economics and
  command-audit identity (M1-S15, M1-S22); phase-transition, stall, and
  restart timing; schema-versioned local event storage; extend the spend read
  side with breakdowns per ticket/repo/lane/agent/model plus timing summaries;
  expose the summaries to the retro evidence pass and the morning brief.
- AC: for a completed delivery, spend reports
  tokens and cost per agent role and model with phase timings, reconciling
  with harness-reported session totals within a declared tolerance;
  the retro evidence pass and brief cite these numbers; telemetry absence
  remains a classified outcome.
- Depends on: M1-S11, M1-S15, M1-S19, M1-S22.

### M2-S15 Queue lifecycle completion
- Goal: Queue hygiene is complete: entries leave the queue when their
  work lands or is abandoned, dependencies are manageable, and one ref
  cannot run twice at once regardless of entry path.
- Tasks: entry removal/release with reasons;
  automatic release on merge and closeout; dependency edge add/remove;
  single-flight per ref enforced across dispatch paths (evidence: during
  dual-running a lane observed a second concurrent session on one ref);
  reconciliation of stale entries against tracker truth.
- AC: after a squash merge and closeout,
  the ref's queue entry is gone without manual action; a second dispatch
  against a ref with an active lane is
  refused with a classified error naming the holder; stale entries are
  reconcilable without editing state files.
- Depends on: M1-S9, M1-S17, M1-S18, M2-S13.

### M2-S16 Engine-first delivery operations
- Goal: Day-to-day delivery of this repository runs primarily through the
  typed engine with the shell stack as documented fallback, accumulating the
  evidence the handover gate requires.
- Tasks: operate dispatch through the engine for regular delivery;
  provider windows and holds as engine-visible data (building on the
  pre-iteration hold hook and lane economics);
  periodic handover-gate evaluation on accrued evidence per repository with
  the shell path kept green; deprecation pointers from shell entry points
  toward the engine once a repository flips.
- AC: consecutive engine dispatches with corroborated outcomes accrue in the
  summary; handover evaluation reports per-condition status;
  the shell path remains usable and documented throughout; any flip is
  per-repository and reversible.
- Depends on: M1-S9, M1-S18, M1-S21, M2-S12, M2-S13, and the owner-hold hook change (#280).

### M2-S17 Provider-aware peak pausing
- Goal: Peak-hour cost control is enforced per provider profile: in-flight
  sessions whose nominated provider enters a peak window are stopped and later
  resumed, while deliveries on other providers continue untouched.
- Tasks: every delivery nominates its provider profile at dispatch admission
  (recorded on the lane and attempt records, building on M1-S21 profiles and
  M1-S22 identity); peak-window rules as data per provider profile (windows,
  multipliers, buffers); the resident daemon watches profile windows and parks
  in-flight lanes whose profile enters peak (bounded-grace stop, session state
  preserved, park reason recorded);
  automatic resume from preserved session state when the window ends
  (same branch, session resume path, never re-dispatch from scratch);
  zero-spend assertion through telemetry (M2-S14): no model calls bill
  on a parked profile during its window; daemon-absent degrades to the
  existing iteration-start gating, documented.
- AC:
  1. A dispatch records its nominated provider profile; the nomination is visible on lane and attempt records.
  2. When a peak window starts for profile P, every in-flight lane using P is stopped with bounded grace, marked parked with reason `peak-window` and the window end, and stays parked until it ends.
  3. Lanes using other providers are unaffected during a P peak window and keep running.
  4. When the window ends, parked lanes resume automatically from preserved session state; no branch, artifact, or queue state is lost or duplicated.
  5. Telemetry proves zero billable model calls on profile P during its peak window for parked lanes.
  6. Stop, park, and resume are auditable ledger events surfaced in status and brief.
  7. Works with the daemon resident; without it, behavior degrades to iteration-start gating with the difference declared.
- Depends on: M1-S15, M1-S18, M1-S21, M1-S22, M2-S14, and the owner-hold semantics (#280).

### M2-S18 Project groups
- Goal: A project is a configured group of repositories that belong together,
  so the tooling can enumerate groups with their members and scope delivery
  views per project, with a workspace directory usable as an optional
  discovery root.
- Tasks: project configuration declaring member repositories, with any
  tracker adapter and mixed trackers remaining valid configuration even if
  only GitHub is exercised initially; an optional workspace-directory
  discovery root: register a directory, scan for managed clones inside, and
  never require it; `projects list` rendering groups with member repositories,
  their health, and their state; project scoping for queue and status reads;
  the naming boundary documented, where `repos` is the flat enumeration and
  `projects` describes groups.
- AC:
  1. A project with two member repositories in one workspace directory is discoverable by registering that directory.
  2. The same project configured with repositories in unrelated directories behaves identically, because a workspace is optional.
  3. `projects list` shows the group with both members and their state.
  4. Queue and status accept a project scope.
  5. A configuration mixing tracker kinds is accepted at validation time with the unimplemented member classified `not-yet-supported` rather than rejected silently.
- Depends on: M2-S11.

### M2-S19 Cross-repository changes
- Goal: One change may span multiple repositories of one project: one
  lifecycle, one spec and plan, one definition of done, with a branch and
  pull request per member repository.
- Tasks: the plan declares member repositories and their slices; one
  lifecycle drives per-repo branches and PRs; per-repo gates and one shared
  DoD; closeout across member repositories, with branch cleanup and issue
  closure per tracker; dependency edges between member repositories' steps
  where order matters; evidence records enumerate all member PRs.
- AC:
  1. A two-repository change produces one spec, two branches, two PRs, one review flow, and a closeout that lands both.
  2. Per-repo CI truth is corroborated per member before the change counts done.
  3. A member failing its gates blocks the shared DoD with the failing member named.
- Depends on: M2-S11, M2-S18, M1-S17.

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
- Depends on: M1-S18, M2-S2, M2-S3, M2-S6.

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

