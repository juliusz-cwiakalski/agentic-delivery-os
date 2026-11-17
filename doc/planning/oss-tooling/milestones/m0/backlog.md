---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/backlog.md
---
# M0 — Trust substrate backlog

Moved from `doc/planning/oss-tooling/backlog.md` (per-milestone split, 2026-11-17).

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
- Tasks: branding module with the single name constant (historical working name)
  driving binary, package scope, environment prefix, config directory,
  MCP prefix, telemetry namespace, docs URL; env override to swap the name
  at the naming freeze; forbidden-literal test that fails CI on any name
  literal outside the allowlist (the branding module plus the legacy
  adapter, per ADR-0003 DEC-8; the scan covers new code, the pre-existing
  corpus migrates separately); legacy environment prefix and config path adapter with a
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
  environment (legacy env prefix) < CLI flags; maps merge recursively, lists replace;
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
  and the delivery registry (the historical lint command); error on parse failure; key-set
  assertions; the pm-notes schema declares the change variant (full
  eleven-phase or LITE compressed set) and lint validates the declared
  variant's required phases. Phase transitions through the historical phase command
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
