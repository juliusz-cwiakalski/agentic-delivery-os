---
change:
  ref: GH-240
  type: feat
  status: Proposed
  slug: capsule-closeout
  title: "M1-S12: Change capsule completion and closeout expansion"
  owners: [engineering]
  service: delivery-os
  labels: [m1, capsule, memory, closeout, judgment-residue, telemetry]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: high
  dependencies:
    internal:
      - "State layer (M0-S5, GH-174, delivered) — the append-only verified ledger, fences, additive record-kind pattern, and the `harness.telemetry` records the ticket requires this change to preserve"
      - "Closeout v1 (M0-S14, GH-183, delivered) — the dry-run-by-default seven-step transaction, SHA-256 operation identities, the `closeout.operation` ledger, the git branch/checkout seam, the read observation vocabulary, bounded output, and the injected non-gating telemetry capture point this change extends"
      - "Retro evidence pipeline (M1-S8, GH-232, delivered) — the validated `retro.run`/`retro.level` registry read surface the retro-coverage move consults, and the collector-truth evidence plane the closed capsule feeds"
      - "Harness adapters (M1-S11, GH-233, delivered) — the injected telemetry capability, the read-only harness-store extraction seam with work-item session attribution, and the production-composer gap this change closes"
      - "Merge transaction (M1-S4, GH-225, delivered) — the `merge.transaction` landing record and squash SHA that anchor the merged-diff sweep"
      - "Configuration layer (M0-S4, GH-173, delivered) — the typed catalog and the `harness` branch carrying store locations and the declared environment allowlist"
      - "Result contract and error table (delivered) — the `CommandResult` envelope, the error-table sync invariant, the exit projection, and the single redaction chokepoint this change extends with the residue-attention outcome"
      - "Session database administration (GH-180, delivered) — the metadata-only `db` read surface and the session-store access discipline; this change consumes session facts but adds no `db` subcommand or field"
      - "Git branch/checkout seam (GH-183, delivered) — the fixed-argv, no-shell local mutation seam whose safety predicate the worktree cleanup mirrors"
    external:
      - "GitHub — merged delivery request review threads (author principal and authorship kind), thread resolution, and work-item reads/writes"
      - "Harness session stores — the opencode SQLite session store (read-only, query-only access) and Claude Code local session files (read-only parsing)"
      - "git — local worktree listing and removal; no remotes, no pushes"
---

# CHANGE SPECIFICATION

> **Status**: Proposed · **Version**: 1.3 · **Date**: 2026-11-07 · **Ticket**: [GH-240](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/240)
>
> **PURPOSE**: Make every merged change leave a self-contained, closed memory capsule and turn post-merge mechanics into one idempotent closeout transaction that emits a bounded judgment residue — while preserving the M1-S11 telemetry stream in the state-layer event log — so operators stop grepping diffs, memory promotion becomes evidence-gated ceremony, and preparation phases can safely run in parallel later.

## 1. SUMMARY

This change completes the change capsule and expands the delivered closeout transaction into the full post-merge ceremony. Every change folder becomes a memory episode capsule: an append-only `events.jsonl` carrying phase, commit, gate, review, and closeout events, plus a `candidates/` directory holding one memory-promotion candidate per file. Events are written only by the commands that own them — `phase` appends phase transitions, `commit` appends landed commits, `verify` appends gate outcomes, and closeout ingests review verdicts and appends its own closeout and capsule-lifecycle events. Capsules stay self-contained through phases 1–10, writing nothing across changes, which is the property that later makes preparation phases safely concurrent (M1 parallel-delivery seam).

At closeout, the capsule becomes the consolidation ceremony: validate the capsule, ingest review verdicts, evaluate every candidate against the capture bar and an evidence link, deduplicate against project memory, record exactly one promotion decision per candidate (promoted, or rejected with a reason from a closed set), apply accepted items to exactly one canonical home in the local checkout or to their sanctioned handoff route, append a terminal closed event, and report the capsule's closed state and per-candidate decisions in bounded output. Closeout gains the rest of the mechanical sweep as additive steps: a merged-diff owed-flip sweep that detects declared marker kinds and splits attributed hits from ambiguous residue, a human-vs-non-human review-thread policy that leaves human threads as residue instead of resolving them, local worktree cleanup under a safety predicate mirroring branch deletion, a read-only retro-coverage reconciliation against the delivered `retro.run` registry, and a session-compaction checkpoint that records the pre-compaction state while declaring the absent harness-compaction surface as a capability gap. The transaction emits a bounded, deterministically ordered `residue[]` list and exits 1 when residue requires attention, without turning residue into an error envelope.

The M1-S11 telemetry capture is wired into the production closeout composer, so a real closeout now captures harness session statistics into the state-layer event log that `spend` reads. The capsule event stream and the state-layer telemetry stream remain two streams with two owners: no telemetry statistics are copied into the capsule, and no capsule event is written into the telemetry record family. The GH-233 review deferrals that the production composer makes reachable are re-assessed: the Claude Code file-read budget (review finding F-8) and store-scoped orphan disclosure (review finding F-11) are resolved here; the host-runner semantics (review finding F-9) remain explicitly re-deferred because the runner is not on the closeout path.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The delivered closeout transaction is dry-run by default and applies only with `--apply`. Its deterministic plan is seven ordered steps — `ticket-to-done`, `lifecycle-label-sweep`, `unassign`, `owed-flip-sweep`, `comment-resolution`, `checkout-restore`, `branch-cleanup` — each composed of canonical, SHA-256-identified operations whose terminal outcomes persist in the append-only `closeout.operation` ledger. Re-runs reuse terminal outcomes and converge.
- The delivered `owed-flip-sweep` is tracker-relation-based: it moves open direct dependents whose blockers are all done to the owner-attention label and removes a present `blocked` label. It does not read the merged diff.
- The delivered `comment-resolution` resolves every unresolved review thread on the merged delivery request, up to a 100-thread cap. It has no authorship distinction: a thread started by a human reviewer is resolved exactly like a bot thread.
- Change folders exist under the `doc/changes/<YYYY-MM>/<YYYY-MM-DD>--<workItemRef>--<slug>/` convention and already hold the spec, plan, test plan, and PM notes. There is no event log and no candidate directory; no delivered command writes to a change folder except the artifacts authored by planning agents.
- Phase transitions persist as append-only `phase.transition` state records; commit landings persist as `commit.telemetry` state records; gate verification persists as `merge.gate-verification` state records. These are the durable evidence the capsule event stream must mirror, not replace.
- The harness adapter seam (M1-S11) delivers a read-only telemetry extraction capability, a harness-neutral statistics shape, one `harness.telemetry` record per captured session group plus a run-scoped capture outcome, and an injected closeout capture point. The production closeout composer does not inject it: a real closeout run captures no harness telemetry records today, and the feature documentation says so explicitly.
- The harness store's session rows carry work-item attribution (`work_item_ref` for the opencode store; the Claude Code extractor maps session-tree roots to a work item). The `db` command family exposes metadata-only size/list/prune/reboot but its `list` items carry no work-item field.
- The retro registry is a validated state-store boundary with `retro.level` (levels R1–R6), `retro.run` (one record per collection run, with a closed `collect`/`report` mode vocabulary and pipeline-truth verdict), and `retro.trigger` records. `retro collect` selects the most recent completed change not already collected at the level; the registry is read-only to every other consumer.
- The merge transaction records a verified squash landing (`merge.transaction`, `delivery.merge.transaction.v1`) with the squash SHA and landing evidence. The merge git seam exposes head, parent, tree, containment, refresh, squash-land, and branch deletion; it has no worktree removal capability and no diff-content read.
- The git branch/checkout seam lists worktrees (`worktree list --porcelain`) only to detect whether a branch is checked out elsewhere. It has no worktree removal surface.
- Project memory exists as `.ai/memory/README.md` (index and conventions), `lessons/`, `tacit/`, and per-agent folders. The promotion routing table and the promoted-record format are declared; `preferences/`, guild trees, typed memory records, and memory lint are M2-S8 scope and do not exist yet. `consolidate-memory` is the only cross-folder writer today.
- The result contract's projection classes are `success` → 0, `user-validation` → 1, and `platform-provider` → 2. A success envelope always projects 0; there is no outcome that carries `data` and exits 1.
- The PM planning session recorded five scope decisions that this specification adopts: capsule event ownership; promotion write authority; session-compaction semantics; additive-vs-extended step vocabulary; and the two-stream telemetry preservation rule. It also recorded the documentation risk list carried in §18.

### 2.2 Pain Points / Gaps

- **The merged change loses its own story.** Phase transitions, commits, gates, and review verdicts live in four different durable surfaces; nothing assembles them into the change folder, so later retrospection requires re-querying state and reconstructing a timeline.
- **Memory promotion is a convention, not a ceremony.** Candidates, capture-bar checks, evidence links, dedup, and the one-canonical-home routing table exist as prose. Nothing executes them at the change boundary, and nothing records why an item was rejected.
- **Post-merge mechanics still consume coordinator tokens.** The operator greps the merged diff for TODO markers, `when-X-merges` notes, feature-flag and class strings; manually decides which review threads were human; deletes worktrees by hand; and remembers the retro-coverage move. Every merge repeats the same mechanical work.
- **Human review threads are erased by automation.** The delivered resolution step cannot tell a bot thread from a human reviewer's unresolved question, so it resolves both. That loses exactly the judgment residue the operator needs to see.
- **Telemetry capture is delivered but unreachable.** The M1-S11 capability exists behind an injected seam that no production composer supplies. `spend` therefore reads an empty telemetry family for real deliveries even after the harness story shipped.
- **Worktrees strand.** A delivery's worktree survives its branch unless someone removes it; the branch/checkout seam can only report that a branch is checked out elsewhere.
- **Capsules are not self-contained today.** Because no capsule exists, there is nothing to keep conflict-free during preparation. The parallel-delivery seam depends on change folders writing only within themselves through phase 10.
- **Retro coverage is implicit.** Whether a closed change has been through a change-level retro is discoverable only by scanning the registry; closeout does not record its coverage state.
- **Compaction is manual and undocumented at closeout.** Session working state, unresolved questions, and the last verified commit are not checkpointed before sessions are compacted or lost.

## 3. PROBLEM STATEMENT

Because the change folder is not an episode capsule and post-merge mechanics remain a manual, judgment-heavy sweep, every merged change loses its cross-phase evidence, memory promotion happens by convention rather than by an evidence-gated ceremony, and the coordinator must grep the merged diff and adjudicate review-thread authorship by hand; because the delivered harness telemetry capture has no production composer, real closeouts capture no session statistics even though the state-layer store is the one `spend` reads; and because worktree, retro-coverage, and compaction steps have no closeout home, the highest-leverage M1 relief (operator R8: closeout as one command with bounded judgment residue) ships as a seven-step tracker transaction instead of the full mechanical ceremony the parallel-delivery and memory-lifecycle designs assume.

## 4. GOALS

- **G-1**: Every change closed by this closeout version leaves a capsule with append-only events and exactly one promotion decision (promoted or rejected with reason) per candidate (ticket AC 1).
- **G-2**: Capsule events are written only by the commands that own them, with no free-text agent writes and no cross-change writes during phases 1–10, so capsules remain self-contained and preparation phases stay safely concurrent.
- **G-3**: Closeout is the memory consolidation ceremony: it validates the capsule, evaluates candidates against the capture bar and evidence link, deduplicates, routes each accepted candidate to exactly one canonical home or sanctioned handoff, and records the decision (ticket AC 2).
- **G-4**: Closeout performs the full mechanical sweep idempotently and emits a bounded, deterministically ordered judgment residue instead of requiring diff grepping (ticket AC 3).
- **G-5**: The M1-S11 harness telemetry capture still lands in the state-layer event log after the closeout rewrite, with zero telemetry records moved into or duplicated by the capsule stream (ticket AC 4).
- **G-6**: Session compaction at closeout records the pre-compaction checkpoint for the delivery's attributed sessions and declares the absent harness-compaction surface as a capability gap, inventing no harness API (ticket-pinned clarification).
- **G-7**: A re-run after restart converges: terminal outcomes are reused, no duplicate capsule events, promotions, thread resolutions, branch deletions, worktree removals, or telemetry records are produced (ticket AC 5).
- **G-8**: All contract growth is additive within `delivery.closeout.v1`: new step ids, new optional output fields, and new closed vocabularies; consumers resolve steps by id and tolerate unknown ids; no field is removed or renamed.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Merged changes closed with a capsule containing events and one decision per candidate | 100% |
| Candidates promoted without a capture-bar basis or an evidence link | 0 |
| Human-authored review threads auto-resolved | 0 (left unresolved as `unresolved-human-thread` residue) |
| Worktree removals outside the declared safety predicate | 0 |
| Duplicate capsule events, promotion writes, thread resolutions, branch deletions, or worktree removals on a re-run | 0 |
| Harness telemetry records moved into the capsule or duplicated by the closeout rewrite | 0 |
| Post-closeout harness-store re-queries required by `spend` | 0 (the state-layer log remains the only source) |
| Residue items beyond the declared bound or rendered without a kind/location | 0 |
| Source-file edits, commits, pushes, or remote writes performed by closeout | 0 |
| Closeouts requiring manual re-grep of the merged diff after adoption | 0 |

### 4.2 Non-Goals

- **NG-1**: The typed memory-record store, the preferences tree, guild trees, memory lint in quality gates, the memory doctor, and the `ados memory` command family — M2-S8, M3-S8, M3-S9. This change writes only the existing lessons/tacit record format and records handoffs for the other classes.
- **NG-2**: A new archive tree, capsule relocation, or index rebuild engine — M2-S8. "Archive the capsule" here means a terminal closed marker and closed state, never a directory move.
- **NG-3**: Harness context-compaction invocation, a compaction adapter API, or any invented harness surface — a declared capability gap.
- **NG-4**: Source-code editing, marker removal, feature-flag code rewrites, commits, pushes, or history rewrites by closeout — the diff sweep detects and attributes; it never edits source.
- **NG-5**: Retro collection/report execution, retro evidence writing, coverage-registry redesign, ceremony scheduling, or index rebuild — M1-S8 owns collection; M2-S3 owns ceremony scheduling and the retro close stage. Closeout reads the delivered registry and records a capsule coverage event only.
- **NG-6**: Posting tracker comments or PR replies — `write-comment` remains a declared gap. Closeout resolves non-human threads and reports human threads as residue; it never writes prose.
- **NG-7**: MCP/host surfaces, a new CLI command family, or a new `db` subcommand/field — the change extends `closeout` and its event producers only.
- **NG-8**: Cross-repository or multi-change closeout; remote branch/worktree cleanup; containerized execution.
- **NG-9**: Telemetry backfill for changes closed before this change, and telemetry capture points outside closeout.
- **NG-10**: Provider write support beyond the delivered GitHub/Jira slices; GitLab remains a read slice with declared gaps.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Capsule artifact contract: change-folder resolution, append-only `events.jsonl` envelope, `candidates/` layout, event vocabulary, ordering, caps | A capsule must be a precise, self-contained, machine-readable episode, not a convention (G-1, G-2). |
| F-2 | Capsule event production by the owning commands (`phase`, `commit`, `verify`) with idempotent, non-gating appends | Events written by their owners preserve the architecture's writer-ownership table and keep capsules conflict-free in preparation (G-2). |
| F-3 | Capsule validation and closeout close: review-verdict ingestion, pre-contract backfill, terminal closed event, `closeout.capsule-invalid`, plan-mode zero writes | A capsule is only trustworthy if closeout validates it and refuses to close an invalid one (G-1, G-7). |
| F-4 | Candidate capture, capture bar, evidence link, deterministic dedup, and one promotion decision per candidate routed to exactly one canonical home or sanctioned handoff | Promotion must be evidence-gated, explainable, and idempotent (G-3, ticket AC 2). |
| F-5 | Merged-diff owed-flip sweep: closed marker vocabulary, attributed-hit resolution, ambiguous-hit residue, bounded diff read, idempotent re-runs | The operator's diff-grep work becomes a bounded mechanical detection with judgment residue (G-4). |
| F-6 | Human-vs-non-human review-thread policy: resolve non-human threads, leave human threads as residue, fail closed on unknown authorship | Automation must not erase human review questions (G-4). |
| F-7 | Local worktree cleanup under a safety predicate mirroring branch deletion, with a refusal path and idempotent removal | Stranded worktrees are post-merge debris; deletion must be as safe as branch deletion (G-4). |
| F-8 | Retro-coverage move against the delivered `retro.run`/level registry, recorded as a capsule coverage event | Closeout records whether the change is already collected without corrupting retro truth (G-4). |
| F-9 | Session-compaction checkpoint for the delivery's attributed sessions, with the harness compaction surface declared as a gap | The compaction contract is satisfied as far as the delivered stack allows, without inventing an API (G-6). |
| F-10 | Production telemetry wiring and two-stream separation: inject the M1-S11 capture, preserve the state-log records, resolve GH-233 review findings F-8/F-11 and re-defer review finding F-9 | Delivered capture must become reachable without being displaced by the capsule stream (G-5, ticket AC 4). |
| F-11 | Judgment-residue contract and output/exit semantics: closed kinds, bounds, deterministic order, `attention` outcome class | Residue is the product of the sweep and must be machine-actionable without becoming an error (G-4). |
| F-12 | Step-vocabulary and contract evolution: additive step ids, declared order, additive output fields, consumer tolerance | The delivered seven-step contract is published; growth must not break its consumers (G-8). |

### 5.1 Capability Details

- **F-1 — Capsule artifact contract.** The capsule is the existing change folder, resolved by the established convention: iterate the month directories matching `YYYY-MM` in ascending order, then the folders inside each month in ascending order, and select the first folder whose name contains `--<workItemRef>--`. Resolution is read-only and never creates a month or folder; an absent or ambiguous folder is a declared condition, not a guess. `events.jsonl` is an append-only file of LF-terminated JSON lines. Each line is one event with the schema id `delivery.capsule.event.v1`, a monotonically increasing per-capsule `sequence`, a deterministic `eventKey`, the work-item ref, the producing run id, a closed `kind`, a closed `writer` (`phase`, `commit`, `verify`, `closeout`), an injected-clock `occurredAt`, and a kind-specific bounded `payload`. The closed event-kind vocabulary is `capsule.opened`, `phase.transition`, `commit.landed`, `gate.outcome`, `review.verdict`, `closeout.step`, `capsule.promotion`, `capsule.retro-coverage`, `capsule.compaction-checkpoint`, `capsule.backfill-gap`, and `capsule.closed`. `capsule.opened` is appended once by the first writer to create the capsule and carries the capsule contract version and the work-item ref. `capsule.closed` is terminal: no writer appends after it. `candidates/` is a directory of one candidate per file; it is created empty when absent and is never a second state file. Capsule growth is bounded by declared event-count, event-payload, total-byte, candidate-count, and candidate-size caps (§9).

- **F-2 — Capsule event production.** Event authorship follows the architecture's writer-ownership table. `phase` appends one `phase.transition` event per landed phase completion or reopen, carrying the phase id, operation, outcome, commit intent, optional commit SHA, and timestamp. `commit` appends one `commit.landed` event per landed commit, carrying the commit SHA, parent SHA when known, message-source token, and change ref; it never carries a message body, diff content, or credential material. `verify` appends one `gate.outcome` event per full gate evaluation, carrying the gate-set identity, head SHA, and per-gate verdict/evidence summary. Each producer supplies a deterministic `eventKey` derived from what makes the event unique (for example phase id plus operation plus commit SHA, or commit SHA, or gate-set identity plus head SHA); a duplicate `eventKey` is a no-op append. Appends acquire a per-capsule exclusive append lock with bounded retry; a busy lock is the delivered retryable `state.lock.busy` identity with a busy detail naming the capsule lock, while an absent folder, torn tail, or cap breach is a classified, disclosed condition. Capsule appends are **non-gating** for `phase`, `commit`, and `verify`: the primary command outcome and its durable state record are unchanged, and the failure is disclosed in output. Closeout later treats a missing expected event as a capsule gap (§5.1 F-3). No agent free-text write exists; no command writes into another change's capsule during phases 1–10.

- **F-3 — Capsule validation and closeout close.** Capsule validation is a read-only pre-flight performed in both plan and apply modes before any closeout mutation. It checks: the change folder resolves uniquely; `events.jsonl` (when present) parses fully with no torn tail, contiguous sequences, unique `eventKey`s, valid kinds/writers/payloads, and no event after `capsule.closed`; a present capsule has an opening event; `candidates/` contains only valid candidate files with unique ids; after promotion, every candidate has exactly one `capsule.promotion` event (zero or multiple decisions make the capsule invalid); review artifacts under `code-review/review-iter-*.yaml` are ingested as `review.verdict` events when readable; and the capsule is cross-checked against the delivery's durable state records (phase transitions, commit telemetry, gate verification), with any expected event missing from the capsule recorded as a `capsule-event-gap` residue rather than an invalid capsule. A change folder with no capsule is a **pre-contract** capsule: closeout creates `events.jsonl` and `candidates/`, appends `capsule.opened`, appends one `capsule.backfill-gap` event naming the pre-contract state, and proceeds; absence is not an error. A malformed or torn capsule, a candidate schema failure (including an out-of-set `scope`, an unknown `status`, or a malformed evidence shape), a duplicate candidate id, or a candidate with zero or multiple promotion decisions after promotion is `closeout.capsule-invalid` (exit 1, user, non-retryable) in apply mode, and no promotion write occurs. In plan mode the same condition renders the capsule step as `would-refuse` so the operator can inspect it; plan mode performs zero writes, zero appends, and zero promotions. A closeable capsule receives one `capsule.closed` event carrying the decision counts, the event count, and a bounded capsule digest. The applied payload's `capsule` object carries `closed`, `events`, and `candidates[]`; each `capsule.candidates[]` entry is exactly the bounded projection `{id, decision, home?, reason?}` — `class`, `mode`, and `supersedes` never appear in output. The durable record is the `capsule.promotion` event payload (EVT-2/DM-3); output is the bounded disclosure. The `capsule` object is absent in plan mode. Closeout v1 performs no PM-notes completeness check (the delivered PM-notes lint and the lifecycle own that check) and fabricates no residue for a missing or incomplete PM-notes file; an unreadable review artifact is not capsule-invalid and is recorded as `review-verdict-unreadable` residue.

- **F-4 — Candidate capture and promotion decisions.** Each candidate is one YAML file under `candidates/`, named `<id>.yaml`, with the id matching the stable slug shape `^[a-z0-9][a-z0-9-]{2,63}$`, and with a required schema: `id` (unique, stable), `class` from the closed set `fact`, `decision`, `lesson`, `tacit`, `preference`, `workflow`, `norm`, `fleet`; `scope` from `change`, `component`, `repo`, `fleet`; `statement`; `evidence` exactly one declared evidence-link shape — `review-verdict:<ref>`, `ci-verdict:<ref>`, `human-correction:<ref>`, `merged-pr:<ref>`, or `test:<ref>`, with `<ref>` a non-empty bounded reference; `basis` from the capture bar — `repeat-occurrence`, `review-catch`, `human-correction`, `verified-outcome`, `repeated-workflow`; `source`; `trust` (T0–T5); `status` from the closed set `candidate`, `authoritative`, `superseded`; `created_by`; and `created` date. Optional fields are `rationale`, `applies_when`, `supersedes`, `contradicts`, and a promotion hint. Structural required-field or closed-vocabulary violations — including a `scope` outside the declared set, an unknown `status`, or a non-empty evidence value outside the five declared shapes — are candidate schema failures and therefore `closeout.capsule-invalid` (F-3), not candidate-level rejection reasons. The two gate fields are classified separately: a missing or empty `basis` is rejected `capture-bar-unmet`; a missing or empty `evidence` is rejected `evidence-missing`; neither is ever promoted or silently skipped. New promoted records carry `status: candidate`; this change never sets `authoritative` — the promotion decision is recorded in the capsule — and the only status rewrite it performs is the declared `superseded` mark on an old lesson/tacit record named by an accepted candidate. Closeout evaluates every candidate against the bar and the evidence link, and deduplication is deterministic and scoped to the memory records closeout is about to write plus the capsule's own candidates: normalize the statement (trim, case-fold, collapse whitespace) and compare it to existing lesson/tacit records and to other candidates; a match is rejected with `duplicate:<existing-id>`. Fact/decision handoffs are deduplicated authoritatively by the receiving owner at handoff, and the capsule records the handoff as the decision. A candidate that declares `supersedes` must name an existing lesson/tacit record id, otherwise it is rejected `supersedes-unknown`; an accepted superseding record writes the new record and marks the old record `status: superseded` (a single-file edit), and the capsule decision carries the supersession link. Contradiction is explicit, never inferred: a candidate declares `contradicts: <record-id>` and must also declare `supersedes: <record-id>` for that same id. Target existence is checked first: an unknown `contradicts` or `supersedes` target is rejected `supersedes-unknown`; otherwise a missing or different `supersedes` for the contradicted id is rejected `contradiction-requires-supersession`. No similarity scoring, embedding, or model judgment participates in dedup or contradiction classification; dedup is exact normalized-statement equality only. Promotion routing is the closed table in Appendix C: accepted `lesson` and `tacit` candidates are home-written as record files following the existing `lesson-YYYY-NNN-<slug>.md`/`tacit-YYYY-NNN-<slug>.md` naming, frontmatter, and monotonic id-allocation rule (unique across lessons/tacit, never reused), plus one bounded index row; a home write that would exceed the declared memory-index cap is rejected `index-budget-exceeded` and writes no record; accepted `fact`, `decision`, `norm`, and `workflow` candidates are recorded as sanctioned handoff proposals to their single home (`doc/spec/**`, `doc/decisions/**`, the kernel, or the normal change process) without editing those homes; `preference` is rejected `home-not-implemented (M2-S8)`; `fleet` is rejected `owner-approval-required`. Path resolution is confined: a candidate-supplied `id` or record-name outside the declared slug shape (including any path separator or `..`) is a candidate schema failure → `closeout.capsule-invalid` before any write; a resolved home path that does not stay under the injected memory root after realpath resolution (symlinked parent, absolute path, traversal) is a step failure → `closeout.step.capsule.failed` with zero writes, and plan mode renders `would-refuse`. No new error row is added. Exactly one promotion decision per candidate is recorded as one `capsule.promotion` event (durable payload per EVT-2/DM-3) and disclosed in the bounded `capsule.candidates[]` output projection (`{id, decision, home?, reason?}` per DM-5); a re-run appends no duplicate decision and performs no duplicate home write. Target-file handling is explicit and idempotent: a promotion target file that already exists with byte-identical content is a `satisfied` no-op (no write, no duplicate decision); a target file that already carries the same identity (the same candidate id or promoted record id) with different content is rejected `duplicate:<existing-id>`; a different identity that declares `contradicts: <existing-id>` without a matching `supersedes: <existing-id>` is rejected `contradiction-requires-supersession`. These are the only three outcomes for a pre-existing target; there is no overwrite. Closeout never pushes, never writes a remote, and never rewrites history; memory changes therefore reach history through the next normal delivery PR.

- **F-5 — Merged-diff owed-flip sweep.** A new step detects owed-flip markers in the merged change's introduced lines. The diff source is the verified merge transaction's squash SHA and its parent; absent a merge transaction record, the step is a declared gap (`merged-diff-unavailable`) rather than a guess. The scan reads only added lines from one bounded diff read (declared byte/file/hit caps, §9) and never walks the full repository history. The marker vocabulary is closed contract data with four kinds: `todo-marker`, `when-merges-note`, `feature-flag`, and `class-string`. A hit is **auto-flipped (resolved)** when its marker text names this work item ref and its kind maps to one of the four closed action tokens — `todo-marker`→`close-todo`, `when-merges-note`→`remove-guard`, `feature-flag`→`retire-flag`, `class-string`→`rename-class`; each marker's contract-data entry declares the action token it carries, and the sweep reads it. The sweep appends an idempotent `closeout.step` owed-flip evidence record (keyed by file path, line-content hash, marker kind, and work-item ref) and reports it as resolved in the step detail. A hit is **ambiguous** when it carries no work-item attribution, when it names another work item, when it is a `class-string` without an attributable owner, or when its declared action is outside that vocabulary or does not match its kind's mapping; an out-of-vocabulary or kind-mismatched action is always ambiguous, never resolved. Ambiguous hits become `ambiguous-flip-hit` residue with a bounded location. The sweep never edits a source file, never removes a marker, never commits, and never pushes; "auto-flipped" means the owed action is attributed and recorded, not code-rewritten. A re-run re-detects the same diff, appends no duplicate resolved record, and re-emits the same deterministic residue.

- **F-6 — Human-vs-non-human thread policy.** The delivered `comment-resolution` step is extended with an authorship gate. Each unresolved thread's root author is normalized to `human`, `non-human`, or `unknown`. Non-human threads are resolved exactly as delivered (bounded, identity-keyed, idempotent). Human threads are **not resolved**; each becomes an `unresolved-human-thread` residue item carrying the provider thread identity, the author principal, and a bounded thread location — never a comment body, title, or free-form subject. Unknown authorship is treated as human (fail-closed): an unattributable thread is never auto-resolved. The thread-resolution cap (100 per merged request) and the residue cap still apply; human threads beyond the residue cap are truncated with an explicit `+N` mark and remain unresolved. A provider with no thread surface or an unavailable thread signal keeps the delivered gap/no-op behavior and never fabricates residue. This is a deliberate behavior change from "resolve all threads"; existing consumers must expect human threads to remain open and the closeout to report attention.

- **F-7 — Worktree cleanup.** A new local git-seam capability removes a delivery-owned worktree only when the full safety predicate holds: the delivery request (or merge transaction) is observed merged; the worktree follows the delivery's worktree/branch convention and its checked-out branch matches the delivery branch convention; the branch head is observed and exactly equals the merged head (unknown refuses); the worktree is clean; it is not the current checkout; it is not locked and not referenced by another worktree; checkout restore succeeded when required; and no earlier non-gap step failed. Removal uses fixed argv, no shell, no force flag, and local-only execution; a git refusal is a refusal, never a fallback to forced removal. A failing predicate performs no removal and produces `closeout.branch.unsafe` in apply (reusing the delivered safety identity) with the failed step's bounded evidence naming the retained worktree, or a `would-refuse` step in plan; the `worktree-retained` residue is assertable in plan mode for the same facts and appears in the human diagnostic stream, never inside the error envelope (F-11). An absent worktree is `satisfied` with `no-worktree` evidence; a re-run never removes twice. The existing branch-cleanup foreign-worktree refusal remains; worktree cleanup runs before branch cleanup so a delivery worktree no longer holds the branch when branch deletion evaluates its predicate.

- **F-8 — Retro-coverage move.** A new step reads the delivered retro registry through its validated read surface and determines whether the closed change already has a `retro.run` record at level `change` whose scope is this work item. It writes **no** retro registry record — appending a synthetic run would corrupt the closed `collect`/`report` mode vocabulary and the pipeline-truth verdict, and would make the real collection look already done. Instead it appends one idempotent `capsule.retro-coverage` event recording `{level: "change", state: "collected" | "pending", runId?}` and reports the state in the step detail. The registry remains the authority for selection; the capsule records the coverage state at close. A re-run appends nothing for the same `(workItemRef, level)`. An unreadable registry is a disclosed `skipped-gap` with `retro-registry-unavailable` evidence plus a `retro-coverage-unavailable` residue item; the rest of closeout proceeds.

- **F-9 — Session-compaction checkpoint.** A new step identifies the closed delivery's sessions through the delivered read-only session-store seam by work-item attribution — the opencode session store's work-item column and the Claude Code session-tree mapping already consumed by M1-S11 telemetry extraction. `db list` is neither extended nor imitated: it carries no work-item attribution, is a metadata administration surface, and adding a field there would not create an attribution source. Identification is one bounded read capped by a declared session limit with an explicit truncation mark. The step appends one `capsule.compaction-checkpoint` event carrying the bounded session identities or a counted truncation, the work-item ref, working-state flushed, event-log flushed, the unresolved-question count, and the last verified commit SHA. The harness context-compaction invocation itself is a declared `skipped-gap` (`harness-compaction-unavailable`): no adapter surface exists, and the story does not invent one. When the delivery has no sessions at all, the step is `skipped-noop` with `no-sessions` evidence and writes no zero checkpoint; when sessions exist but work-item attribution is unavailable, the step is `skipped-gap` with `session-attribution-unavailable` evidence and a `session-attribution-gap` residue. A re-run appends no duplicate checkpoint event for the same session-set digest and last verified commit.

- **F-10 — Production telemetry wiring and two-stream separation.** The production closeout composer now constructs and injects the M1-S11 capture capability; apply mode runs extraction after the terminal steps and before the payload, exactly as the delivered capture point specifies, and plan mode performs no extraction and no append. Harness session statistics continue to land in the state-layer `harness.telemetry` records and remain the only source `spend` reads; the capsule stream carries no statistics, and closeout copies no telemetry record into the capsule. The GH-233 review deferrals that the composer makes reachable are re-assessed: the Claude Code file-read budget (F-8 in the GH-233 review) is resolved by checking the declared byte cap before a full read and treating a would-exceed file as truncated-with-warning; the store-scoped orphan attribution (F-11 in the GH-233 review) is resolved by scoping orphan/invalid-identity disclosure to the capturing delivery and reporting out-of-port orphans as a store-level warning rather than another delivery's failed sessions; the host-runner semantics (F-9 in the GH-233 review) are explicitly re-deferred because the host runner is not on the closeout extraction path and no production consumer exists until dispatch (M1-S9). Capture remains non-gating and idempotent.

- **F-11 — Judgment residue and output/exit contract.** Closeout output gains an additive `residue[]` of bounded items `{item, kind, location}`, ordered deterministically by kind then location, capped at a declared count with an explicit `+N` mark. The `kind` vocabulary is closed: `unresolved-human-thread`, `ambiguous-flip-hit`, `capsule-event-gap`, `review-verdict-unreadable`, `retro-coverage-unavailable`, `worktree-retained`, `session-attribution-gap`, and `capsule-cap-reached`. Residue never contains comment bodies, titles, transcripts, credentials, or free-form prose. Apply mode exits 1 when the residue list is non-empty (residue is the attention signal) while still returning `data` (the residue is not an error envelope); the result contract gains an additive `attention` projection class mapping to 1 for exactly this data-with-attention outcome, with the scripted success line unchanged. Plan mode renders the planned residue and exits 0 unless a hard plan failure occurs. Because the result contract permits exactly one of `data` or `error`, a run that ends in a command-level failure returns the error envelope and emits no structured `residue[]` for that run: the failed step's bounded evidence (carried in the classified error summary and the human diagnostic stream) names each refused or preserved item with its count and identity, and the same residue remains assertable in plan mode for the same facts. A step failure uses the delivered classified identities where they exist (for example provider write failure, unsafe branch, state failure) and the new `closeout.step.<id>.failed` family row otherwise; a capsule content failure uses `closeout.capsule-invalid`, while a capsule step failure such as a resolved home outside the memory root uses the `closeout.step.capsule.failed` family slot. No exit literal appears outside the projection module.

- **F-12 — Step vocabulary and contract evolution.** The transaction's step vocabulary grows additively. The delivered seven ids keep their identities; five step ids are added — `worktree-cleanup`, `merged-diff-sweep`, `retro-coverage-move`, `session-compaction`, and `capsule` — in a re-declared binding order (Appendix C). `worktree-cleanup` is inserted before `branch-cleanup` for safety; the other new ids follow the delivered order, and `capsule` is last. The machine schema stays `delivery.closeout.v1`; `residue`, `capsule`, and an optional step `detail` are additive fields; no field is removed or renamed. Consumers must resolve steps by `stepId`, never by array index, and must tolerate unknown step ids and optional new fields. Existing goldens are updated for the grown step list and the human-thread behavior change; a consumer that assumed exactly seven steps must be updated in the same change. A re-run after restart reuses every terminal operation outcome, appends no duplicate capsule event or promotion decision, performs no second thread resolution, branch deletion, or worktree removal, and produces byte-identical output for identical facts.

## 6. USER & SYSTEM FLOWS

```
Flow 1: the capsule across phases 1-10 (self-contained)
  planning agents author spec/plan/test-plan/PM notes in the change folder
  phase complete <phase>
    → phase.transition state record lands (delivered)
    → one capsule phase.transition event appended (eventKey = phase+operation+sha)
    → append failure: disclosed, phase outcome unchanged (non-gating)
  commit lands
    → commit.telemetry state record lands (delivered)
    → one capsule commit.landed event appended (eventKey = commit sha)
  verify gates <ref>
    → merge.gate-verification state record lands (delivered)
    → one capsule gate.outcome event appended (eventKey = gate-set+head sha)
  review writes code-review/review-iter-N.yaml (no command writes the capsule)
    → closeout ingests it later as a review.verdict event
  no command writes another change's capsule; preparation stays conflict-free
```

```
Flow 2: closeout capsule validation and promotion
  closeout <ref> --apply
    → resolve the unique change folder; validate events.jsonl and candidates/
    → no capsule: create it, append capsule.opened + capsule.backfill-gap
    → torn/malformed/duplicate: closeout.capsule-invalid (exit 1), no promotion
    → ingest readable review verdicts as review.verdict events
    → for each candidate: capture bar + evidence + dedup + route
        accepted lesson/tacit → write one record file + index row
        accepted fact/decision/norm/workflow → record handoff proposal
        preference/fleet → rejected with the declared reason
        missing bar/evidence/duplicate/contradiction → rejected with reason
    → append one capsule.promotion event per candidate (idempotent)
    → append capsule.closed (terminal) with decision counts and digest
    → output capsule {closed, events, candidates[decision, home?, reason?]}
```

```
Flow 3: the mechanical sweep and the residue
  closeout <ref> --apply
    → tracker steps (delivered) → checkout restore → worktree cleanup → branch cleanup
    → merged-diff sweep (one bounded diff read)
        attributed marker → resolved owed-flip evidence (no source edit)
        unattributed/ambiguous marker → ambiguous-flip-hit residue
    → comment resolution: non-human threads resolved; human threads left open
    → retro-coverage read: collected | pending, capsule event
    → session-compaction checkpoint: pre-compaction state recorded; harness call = declared gap
    → capsule close
    → residue[] bounded and ordered; apply exits 1 when attention is required
```

```
Flow 4: human vs non-human review thread
  unresolved thread root author → normalized authorKind
    non-human → resolve (bounded, idempotent, provider-asserted)
    human     → leave unresolved → residue unresolved-human-thread
    unknown   → treat as human (fail-closed) → residue
  no thread surface / signal unavailable → declared gap/no-op, never fabricated residue
```

```
Flow 5: two telemetry streams, two owners
  harness session stores (read-only)
    → M1-S11 capture (now injected by the production closeout composer)
    → harness.telemetry records in the state-layer event log → spend reads here
  phase/commit/verify/closeout
    → capsule events.jsonl → retro evidence / episode capsule
  the capsule never receives telemetry statistics; the state log never receives capsule events
```

```
Flow 6: session-compaction checkpoint
  closeout --apply
    → bounded read of the delivery's sessions by work-item attribution
    → sessions found: append capsule.compaction-checkpoint
        (session ids/count, working state flushed, event log flushed,
         unresolved questions, last verified commit)
    → harness compaction invocation: declared skipped-gap (no adapter surface)
    → no sessions: skipped-noop (no-sessions), no zero checkpoint
```

```
Flow 7: re-run after restart
  closeout <ref> --apply (again)
    → ledger fold reuses every terminal operation outcome
    → capsule eventKeys already present: no duplicate append
    → promotion decisions already recorded: no duplicate write
    → resolved threads/branches/worktrees already gone: satisfied, no second mutation
    → residue recomputed deterministically; byte-identical output for identical facts
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The capsule artifact contract: the established change-folder resolution rule, the `events.jsonl` line envelope and closed event-kind/writer vocabularies, ordering/sequence/event-key rules, the append lock, the append-only and torn-tail discipline, the `candidates/` one-file-per-candidate layout, and the declared caps.
- The ticket's tracker-hygiene task — ticket to done, unassign the ball, and sweep todo-class lifecycle labels to done-class — is satisfied by the delivered `ticket-to-done`, `unassign`, and `lifecycle-label-sweep` steps unchanged; this change introduces no new tracker mechanic for it.
- Capsule event production in `phase`, `commit`, and `verify`: one event per owned transition/landing/gate evaluation, deterministic event keys, idempotent duplicate suppression, non-gating classified disclosure, and no cross-change writes.
- Capsule validation and closeout close: pre-flight validation in both modes, review-verdict ingestion, pre-contract backfill, the terminal closed event, `closeout.capsule-invalid`, and plan-mode zero-write behavior.
- The candidate schema, the capture bar, the evidence-link requirement, deterministic dedup, supersession handling, the closed promotion routing table, home writes for lessons/tacit plus index rows, sanctioned handoffs for fact/decision/norm/workflow, rejection reasons for preference/fleet, and one promotion decision per candidate.
- The merged-diff owed-flip sweep: one bounded added-line diff read, the closed marker vocabulary, attributed-hit resolution, ambiguous-hit residue, and idempotent re-runs; no source edits.
- The authorship-gated review-thread policy: non-human resolution, human residue, unknown-as-human fallback, and the compatibility consequence.
- Local worktree cleanup: the new fixed-argv git-seam capability, the safety predicate, the refusal path, and idempotent removal.
- The retro-coverage move: verified read of the delivered `retro.run` registry, capsule coverage event, read-only behavior, and unreadable-registry gap.
- The session-compaction checkpoint: bounded work-item attribution through the delivered session-store read seam, the checkpoint event, the declared harness-compaction gap, and idempotency.
- Production telemetry wiring: composer injection of the M1-S11 capture, two-stream separation, and the GH-233 review findings F-8/F-11 resolution with review finding F-9 explicitly re-deferred.
- The residue contract and output/exit semantics: closed residue kinds, bounds, deterministic order, additive `residue`/`capsule`/`detail` fields, and the additive `attention` result-contract class (data plus exit 1).
- Additive step ids and contract evolution rules, updated goldens, and consumer tolerance requirements.
- The new `closeout.capsule-invalid` row and the `closeout.step.<id>.failed` family row, documented and machine-synced in the same change.

### 7.2 Out of Scope

- [OUT] The typed memory-record store, preferences tree, guild trees, memory lint, memory doctor, and the memory command family — M2-S8, M3-S8, M3-S9.
- [OUT] A new archive tree, capsule relocation, or full index rebuild engine — M2-S8; "archive" is a terminal marker here.
- [OUT] Harness context-compaction invocation or any harness compaction adapter API — a declared capability gap; no surface exists.
- [OUT] Source-code edits, marker removal, feature-flag code rewrites, commits, pushes, or history rewrites by closeout — the sweep detects and attributes only.
- [OUT] Retro collection/report execution, retro evidence writes, coverage-registry redesign, ceremony scheduling, and the retro close stage — M1-S8 and M2-S3.
- [OUT] Posting tracker/PR comments or replies — `write-comment` remains a declared gap; M3-S3 owns the full adapter.
- [OUT] New CLI command families, new `db` subcommands/fields, and MCP/host surfaces — this change extends `closeout` and its event producers only.
- [OUT] Cross-repository/multi-change closeout, remote branch or worktree cleanup, and containerized execution — later stories.
- [OUT] Telemetry backfill and capture points beyond closeout — M1-S19 consumes the forward stream; historical sessions are not backfilled.
- [OUT] Provider write support beyond the delivered GitHub/Jira slices — GitLab remains read-only with declared gaps.
- [OUT] Dispatch integration, queue/lane scheduling, watchdog economics, and spend aggregation — M1-S9, M1-S15, M1-S17, M1-S19.

### 7.3 Deferred / Maybe-Later

- A declared feature-flag registry that would let the diff sweep perform a real flag-state flip rather than attributing the owed action — revisit if a machine-readable flag registry exists.
- Automatic tracker-item creation for unambiguous owed-flip hits — no issue-create surface exists; revisit with the full adapter.
- A human-thread reply/ownership workflow beyond residue reporting — needs a `write-comment` surface.
- Compaction invocation once a harness adapter declares a compaction capability — then a capability upgrade of the existing adapter, never an invented API.
- Cross-change capsule indexing or a retrieval cache over capsules — M2-S8 and later retrieval work.
- Capsule relocation to an archive tree and retention policy — M2-S8.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — every surface is a local command, a file-based capsule, or a local adapter read/write; no HTTP endpoint is introduced.

### 8.2 Events / Messages

| ID | Event | Producer | Consumer | Content |
|----|-------|----------|----------|---------|
| EVT-1 | Capsule mechanical event (`delivery.capsule.event.v1`) | `phase` (`phase.transition`), `commit` (`commit.landed`), `verify` (`gate.outcome`), closeout (`capsule.opened`, `closeout.step`, `capsule.backfill-gap`, `capsule.closed`), closeout ingestion (`review.verdict`) | Capsule validation, retro evidence, episode reconstruction, closeout output | Schema id, sequence, event key, work item, run id, closed kind, closed writer, injected timestamp, bounded kind payload; append-only, LF-terminated, dedup by event key, terminal closed event |
| EVT-2 | Promotion decision event (`capsule.promotion`) | Closeout promotion stage | Capsule validation/read, closeout output, later memory consolidation | Exact durable payload `{id, class, decision, mode?, home?, reason?, supersedes?}`: `id` candidate id; `class` candidate class; `decision` `promoted`/`rejected`; `mode` `home-write`/`handoff` present iff promoted; `home` canonical home or handoff route present iff promoted; `reason` closed rejection reason present iff rejected; `supersedes` record-id list present iff the candidate declares supersession. The applied `capsule.candidates[]` output projection is the separate bounded shape `{id, decision, home?, reason?}`; one event per candidate, idempotent |
| EVT-3 | Compaction checkpoint event (`capsule.compaction-checkpoint`) | Closeout session-compaction step | Capsule read, later session resumption/retro | Work item, bounded session identities or counted truncation, working-state/event-log flushed flags, unresolved-question count, last verified commit, declared harness-compaction gap; idempotent by session-set digest plus commit |
| EVT-4 | Retro-coverage event (`capsule.retro-coverage`) | Closeout retro-coverage move | Capsule read, retro follow-through | Level (`change`), coverage state (`collected`/`pending`), optional run id; idempotent by work item plus level |
| EVT-5 | Harness telemetry record (`delivery.harness.telemetry.v1`, `delivery.harness.telemetry.capture.v1`) | M1-S11 capture, now injected by the production closeout composer | `spend`, retro, metrics (later stories), audit reads | Per-session statistics and a run-scoped capture outcome in the state-layer event log; unchanged shape, idempotent by session group and run; never copied into the capsule |

Residue is closeout output data, not an event. Capsule events never carry harness statistics; telemetry records never carry capsule events or phase/gate/review payloads.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Capsule event line (EVT-1 payload) | `delivery.capsule.event.v1`: schema id, sequence, event key, work item, run id, kind/writer closed vocabularies, timestamp, bounded payload. File-based inside the change folder; no state-store kind |
| DM-2 | Candidate record | One YAML file per candidate under `candidates/`, named `<id>.yaml` with a stable-slug id (no path separators or `..`): class, scope, statement, `evidence` in one of the five declared shapes, capture-bar basis, source, trust, `status` in `candidate`, `authoritative`, `superseded`, created_by, created, optional rationale/applies_when/supersedes/contradicts |
| DM-3 | Promotion decision (EVT-2 payload) | Exact durable payload `{id, class, decision, mode?, home?, reason?, supersedes?}` with conditional presence: `mode`/`home` iff promoted, `reason` iff rejected, `supersedes` iff declared. The applied output projection is the separate `capsule.candidates[]` shape `{id, decision, home?, reason?}` (DM-5); the event payload is the durable record, the projection is bounded disclosure |
| DM-4 | Residue item | `{item, kind, location}` with a closed kind vocabulary, bounded strings, no bodies/credentials; ordered by kind then location |
| DM-5 | Closeout data additive fields | `residue[]`, `capsule {closed, events, candidates[]}` where each `candidates[]` entry is exactly `{id, decision, home?, reason?}`, optional step `detail`; `delivery.closeout.v1` unchanged, additive within the version |
| DM-6 | Merged-diff marker and action vocabulary | Declared contract data: four marker kinds (`todo-marker`, `when-merges-note`, `feature-flag`, `class-string`), the four closed action tokens (`remove-guard`, `retire-flag`, `rename-class`, `close-todo`), each marker entry's declared action token, the attribution rule, and bounds; exact patterns/keys are delivery-bound |
| DM-7 | Worktree safety facts | Merged evidence, worktree/branch convention match, head equality, cleanliness, current/locked/foreign checks, earlier-failure gate; no new provider field |
| DM-8 | Compaction checkpoint payload | Bounded session identities/count, flushed flags, unresolved-question count, last verified commit, declared gap reason |
| DM-9 | Retro coverage payload | Level, state, optional run id; derived from a verified `retro.run` read, never a registry write |
| DM-10 | `attention` result outcome | Additive projection class mapping to exit 1 for a data-bearing outcome (residue requires attention); scripted success line unchanged |

The pinned vocabulary — event kinds and writers, candidate classes, promotion routing and rejection reasons, residue kinds, step ids and order, marker kinds, and error identities — may not be rebound; schema strings, file/folder spellings of candidate files, marker patterns, cap numbers within the declared ranges, and evidence renderings are delivery-bound.

### 8.4 External Integrations

- **GitHub:** merged delivery request review threads (root author principal and authorship kind), thread resolution for non-human threads, and work-item reads/writes already delivered. No new credential path, no new API surface beyond the existing injected transport.
- **Harness session stores:** opencode SQLite session store accessed read-only with the query-only pragma and bounded queries; Claude Code local session files parsed read-only with per-file byte/line caps. The same seam serves telemetry extraction and bounded session attribution for the compaction checkpoint.
- **git:** local worktree listing (`worktree list --porcelain`) and worktree removal through fixed-argv, no-shell, local-only execution; no remote, no force fallback. The existing branch/checkout seam is extended with the removal capability.
- **Retro registry:** a verified state-store read through the delivered `retro.*` boundary; no write.
- **File system:** the change folder (capsule files) and `.ai/memory/lessons|tacit` (promotion home writes). No network egress, no telemetry exporter, no remote sink.

### 8.5 Backward Compatibility

- `closeout` remains the same command with the same `--apply`/`--json` grammar. Its plan grows from seven to twelve ordered steps; `delivery.closeout.v1` stays the schema id with additive fields. Consumers must resolve steps by id and tolerate unknown ids; any consumer that indexes the step array by position must be updated in this change.
- `comment-resolution` deliberately stops resolving human-authored threads. Existing consumers/goldens must expect those threads to remain open and closeout to exit 1 with residue. The step's outcome vocabulary is unchanged.
- The `db` surface is unchanged: no new subcommand, no new list field, no changed prune/reboot behavior. Session attribution comes from the harness store seam, not `db`.
- `phase`, `commit`, and `verify` gain capsule appends but no changed primary behavior; a capsule append failure is disclosed and does not change their outcome. Their existing state records and output keep their shapes.
- The state ledger gains no capsule record kind and no schema-version bump; the `harness.telemetry` family is unchanged and remains the state-log telemetry destination.
- The result contract gains the additive `attention` projection class and the two new closeout error identities; the envelope shape, scripted projection, and `{0,1,2}` exit range are unchanged. The documented and machine tables stay synchronized.
- The retro registry gains no record kind and no mode value; closeout reads it only. The retro pipeline's target selection, truth checks, and report shape are unchanged.
- The merge transaction and its records are consumed unchanged; the diff sweep reads the recorded squash SHA rather than inventing a new merge surface.
- The git seam gains one capability; existing read-only isolation and no-force guarantees hold.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism: identical injected facts (change folder, review verdicts, candidates, merged diff, registry state, session facts, clock, ids) produce byte-identical capsule event ordering, promotion decisions, residue, and output | 100% byte-identical; zero run-to-run drift |
| NFR-2 | Capsule bounds: at most 2,000 events and 2 MiB per capsule, at most 4 KiB per event payload, at most 100 candidates at 8 KiB each; the memory index stays at or under 200 lines; a breach refuses the append/close or the promotion with a classified disclosure naming the cap and the refused/omitted count, and `capsule-cap-reached` follows the F-11 failure-envelope rule, never silent truncation | All caps enforced and marked; 0 unbounded growth |
| NFR-3 | Diff-scan budget: one bounded added-line diff read, at most 1 MiB of diff text, 500 changed files, and 200 hits; no full-repository scan, no history walk, no pagination | 0 full scans; caps enforced and marked |
| NFR-4 | Output bounds: machine `data` ≤ 65,536 UTF-8 bytes; human text ≤ 16,384 bytes / 200 lines; residue ≤ 50 items; each residue field bounded with an explicit `+N` mark on truncation | All bounds enforced and marked; no unbounded dump path |
| NFR-5 | Append-only and self-containment: zero rewrites, truncations, or deletions of capsule lines; zero cross-change writes during phases 1–10; a torn tail is refused, never repaired silently; the capsule is never compacted by this change | 0 rewrites; 0 cross-change writes; 100% torn-tail refusal |
| NFR-6 | Idempotency/convergence: a re-run appends no duplicate capsule event or promotion decision, performs no second thread resolution, branch deletion, or worktree removal, and writes at most one terminal `capsule.closed` event | 0 duplicates; 1 terminal close |
| NFR-7 | Telemetry preservation: zero `harness.telemetry` records moved into the capsule or duplicated; the state-layer log remains the only `spend` source; capture stays non-gating | 0 moved/copied; 0 duplicate records |
| NFR-8 | Latency: the delivered reference-fixture apply budget stays p95 ≤ 120 s; capsule validation ≤ 2 s, the diff scan ≤ 5 s, session attribution ≤ 5 s, and the retro-registry read ≤ 2 s on reference fixtures | Budgets met or the step is a declared gap; no unbounded wait |
| NFR-9 | Privacy/security: zero comment bodies, titles, transcripts, diffs, tool output, credentials, or environment values in any capsule event, candidate, residue item, or output; unknown thread authorship is treated as human; worktree removal satisfies the full predicate 100% | 0 leaks; 100% predicate enforcement; 0 remote writes |
| NFR-10 | Error-identity stability: every new code is documented and machine-declared in the same change; the `closeout.step.<id>.failed` family slot validates against the effective step-id set and rejects empty/malformed/unknown ids; no exit literal outside the projection | 0 undocumented codes; sync check green; 0 exit literals |
| NFR-11 | Capsule write concurrency: one writer at a time per capsule; concurrent `phase`/`commit`/`verify` appends never interleave or corrupt a line; the lock has bounded retry and a busy lock is disclosed as the retryable `state.lock.busy` identity | 0 interleaved/corrupt lines; bounded retry; 100% disclosure |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- Two streams, two owners: the capsule `events.jsonl` is the episode evidence stream (phase, commit, gate, review, closeout, capsule lifecycle); the state-layer log is the telemetry stream (`harness.telemetry`, plus existing state records). The two are never mixed, and no record is duplicated across them.
- Closeout output discloses every step's outcome, the resolved base, the capsule's closed state and per-candidate decisions, and the residue list. Residue is data with an attention exit code, not an error.
- The capsule is the durable audit trail for the delivery's phases, commits, gates, reviews, promotions, retro coverage, and compaction checkpoint; later consumers read the capsule rather than re-querying transient sources.
- Harness telemetry remains readable through the state-layer log alone after closeout; a post-closeout call to `spend` performs no harness-store query.
- No telemetry exporter, network sink, background process, or alerting channel is added.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Thread authorship is misclassified and a human thread is auto-resolved | M | M | Normalize to `human`/`non-human`/`unknown`; unknown is human (fail-closed); provider actor-type facts are fixture-tested; human threads are never resolved by any fallback | M — accepted, fail-closed posture is the design |
| RSK-2 | Worktree cleanup destroys unmerged work | H | L | The full predicate mirrors branch deletion: merged evidence, head equality, cleanliness, current/locked/foreign checks, earlier-failure gate; no force fallback; refusal preserves the worktree | L |
| RSK-3 | Concurrent capsule appends corrupt `events.jsonl` | M | M | Per-capsule exclusive append lock with bounded retry; append-only LF framing; torn-tail refusal; concurrency fixtures | L |
| RSK-4 | Promotion writes pollute memory, duplicate records, or bypass the kernel routing | M | M | Deterministic dedup; one record per file; home-write only for lessons/tacit; fact/decision/norm/workflow are sanctioned handoffs; preference/fleet rejected; idempotent by candidate id | L |
| RSK-5 | The diff sweep misses markers or floods the operator with residue | M | M | Closed marker vocabulary and the four-token action set; bounded read/hits; residue cap with `+N`; attributed vs ambiguous split is explicit; re-runs deterministic | M |
| RSK-6 | The telemetry rewrite moves or duplicates M1-S11 records, breaking `spend` | H | M | Two-stream AC/NFR; the capture point is injected and unchanged in shape; log-only readback test; idempotency re-run test | L |
| RSK-7 | Contract growth breaks existing closeout consumers or goldens | M | M | Additive ids/fields within `delivery.closeout.v1`; resolve-by-id rule; goldens updated in the same change; no version bump unless a future non-additive change requires it | L |
| RSK-8 | Session attribution is wrong or incomplete, so the checkpoint misses sessions | M | M | One bounded read; no guessing; absent attribution yields `skipped-noop`/`session-attribution-gap` residue; checkpoint records only what was observed | M |
| RSK-9 | The retro-coverage read couples closeout to a drifting registry | L | M | Read-only verified boundary; unreadable registry is a declared gap/residue; no registry write; no mode vocabulary change | L |
| RSK-10 | A long change hits the capsule cap and cannot close | M | L | Declared caps; cap breach is disclosed with the cap and refused/omitted count, and `capsule-cap-reached` follows the F-11 failure-envelope rule (residue on a non-failed run; failed-step evidence otherwise); the cap is contract data tunable at delivery; no silent truncation | L |
| RSK-11 | Human-thread residue makes closeout exit 1 routinely, surprising consumers | M | M | Residue is the intended attention signal; documented in the output/exit contract; consumers branch on exit 1 plus residue, never on an error envelope; plan mode shows it first | M — accepted, visibility is the point |

## 12. ASSUMPTIONS

- Every delivered or newly started change has exactly one change folder matching the established month-scan convention; the capsule never creates month or folder structures.
- `phase`, `commit`, and `verify` receive the changes directory through their existing injected edge options; no new configuration key is needed to locate the capsule.
- The harness store exposes work-item attribution for opencode sessions, and the Claude Code extractor's session-tree mapping supplies the same attribution; a store that cannot attribute existing sessions yields a declared attribution gap rather than a guessed checkpoint.
- GitHub exposes a thread root author actor type sufficient to distinguish bot/automation from user; other providers keep their delivered thread gaps.
- A merged change has a verified merge transaction record with a squash SHA; where the record is absent, the diff sweep is a declared gap.
- `.ai/memory/lessons/` and `.ai/memory/tacit/` exist and are writable; `preferences/`, guild trees, and typed memory records do not exist until M2-S8.
- The retro registry read surface is the delivered validated boundary; its `retro.run` mode vocabulary stays `collect`/`report`.
- The single-user, local-filesystem trust model (0700 state directory, same-user processes) is the accepted boundary for capsule locks, memory writes, and worktree removal.
- The M1 planning pack's closeout contract and man page are proposed and refined at story delivery; this specification records every refinement in Appendix A.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | State layer (M0-S5, GH-174) — DELIVERED ✓ | Append-only ledger, fences, verified reads, additive record kinds; the `harness.telemetry` family this change must preserve |
| Depends on | Closeout v1 (M0-S14, GH-183) — DELIVERED ✓ | Seven-step transaction, operation identity/ledger, read observations, bounded output, git seam, injected telemetry point |
| Depends on | Retro evidence pipeline (M1-S8, GH-232) — DELIVERED ✓ | `retro.run`/`retro.level` registry read surface for the coverage move |
| Depends on | Harness adapters (M1-S11, GH-233) — DELIVERED ✓ | Telemetry capability, read-only store extraction, work-item session attribution, and the composer gap this change closes |
| Depends on | Merge transaction (M1-S4, GH-225) — DELIVERED ✓ | `merge.transaction` record and squash SHA anchoring the diff sweep |
| Depends on | Configuration layer (M0-S4) | Typed catalog and the `harness` branch consumed unchanged |
| Depends on | Result contract and error table | Envelope, sync invariant, exit projection extended with the additive `attention` class and two closeout rows |
| Depends on | Session database administration (GH-180) | Session-store access discipline; `db` surface unchanged |
| Depends on | Git branch/checkout seam (GH-183) | Safety predicate pattern and the new local worktree removal capability |
| Feeds | M2-S8 memory records/layout/lint (depends on this story) | Consumes the capsules and decisions this change produces; owns the typed store, preferences, archive, and lint |
| Feeds | M1-S19 spend read side | Reads the preserved `harness.telemetry` stream with no harness re-query |
| Feeds | M1-S15 session lifecycle economics | Consumes the session attribution and telemetry seam unchanged |
| Feeds | M1-S13 parallel delivery / M1-S17 queue | Self-contained capsules make preparation phases safely concurrent |
| Feeds | M2-S3 ceremony runner | Consumes capsule decisions, retro coverage, and residue as ceremony inputs |
| Blocks | Nothing directly; M2-S8 is sequenced behind this story | The memory line is self-contained from here |

## 14. OPEN QUESTIONS

| ID | Question | Context | Resolution mechanism (pinned) | Status |
|----|----------|---------|-------------------------------|--------|
| OQ-1 | Which exact marker spellings belong to each of the four marker kinds? | The classification rules are pinned, but the concrete patterns are repository language data. | Declared contract data (`CLOSEOUT_DIFF_MARKERS`) validated at delivery; adding or changing a marker is a reviewed contract-data change with tests; the four kinds, the four action tokens (`remove-guard`, `retire-flag`, `rename-class`, `close-todo`), the attribution rule, and bounds are pinned and may not be rebound. | Non-blocking; resolved by declared data |
| OQ-2 | Which provider actor field determines human vs non-human authorship? | GitHub's actor type is available; other providers may expose different shapes. | Provider normalization emits a closed `authorKind` (`human`/`non-human`/`unknown`); unknown is human (fail-closed); each adapter declares a gap where it cannot supply the fact; the live signal is fixture-proxied and recorded in the test-plan gap register. | Non-blocking; resolved by normalization + fail-closed |
| OQ-3 | How are sessions attributed on harness stores other than opencode? | The Claude Code extractor uses session-tree mapping; other stores may lack the field. | Use only the delivered harness-neutral attribution (work-item column or session-tree mapping); no sessions at all yields `skipped-noop` (`no-sessions`), sessions without attribution yield `skipped-gap` plus a `session-attribution-gap` residue, never a guessed checkpoint. | Non-blocking; resolved by existing attribution + fail-closed gap |
| OQ-4 | What numeric values do the capsule and scan caps take? | The invariants are pinned; the exact numbers are tuning. | Declared contract data with the declared minima/maxima; the caps must be enforced and marked; changing a number is a reviewed data change, not a behavior change. | Non-blocking; resolved by declared data |
| OQ-5 | Does the promotion index row append belong to closeout or to the curator? | The memory lifecycle says rebuild the index at consolidation; the kernel says index edits belong to the curator. | Closeout appends one index row per home-written lesson/tacit record (bounded, idempotent); a full index rebuild/lint stays with `consolidate-memory`/M2-S8. The row append is the consolidation action, not a curator rewrite. | Resolved by DEC-6 |

No blocking open question remains. Any future decision that changes the pinned capsule, promotion, residue, or telemetry contracts reopens this specification rather than being patched silently.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The capsule is the existing change folder, resolved by the established month-directory scan (ascending, first folder containing `--<ref>--`); it adds `events.jsonl` and `candidates/` in place. "Archive the capsule" means a terminal `capsule.closed` event and closed state, never a directory move or new archive tree | The change folder is already the episode home (memory-architecture); a new archive tree would fork the layout M2-S8 owns. The resolution rule matches the delivered plan-artifact and pm-notes locators, so one convention governs every change-folder read | 2026-11-07 |
| DEC-2 | Capsule events are written only by their owning commands: `phase` → phase transitions, `commit` → commit events, `verify` → gate outcomes; closeout ingests review verdicts and appends its own closeout/capsule events. No agent free-text writes; no cross-change writes in phases 1–10. Capsule appends are non-gating and disclosed | Adopted from the PM scope decision (2026-11-07), which follows the M1 architecture writer-ownership table and extends its named writer set with `verify` for gate-outcome evidence (Appendix A). Non-gating appends preserve the delivered command contracts; self-containment is the property that makes preparation phases safely concurrent (parallel-delivery) | 2026-11-07 |
| DEC-3 | The capsule event envelope is `delivery.capsule.event.v1` with a monotonic sequence, a deterministic event key, closed kind/writer vocabularies, an injected timestamp, and a bounded payload; appends are LF-terminated, append-only, locked per capsule, deduplicated by event key, and terminal at `capsule.closed`; a torn tail is refused, never repaired or truncated | A file-based episode stream beside the state ledger needs the same discipline the state layer proves: append-only, single-writer, deduplicated, and fail-closed on damage. Event-key dedup is what makes re-runs idempotent without a second ledger | 2026-11-07 |
| DEC-4 | Capsule validation is a read-only pre-flight in both modes. A no-capsule change is a pre-contract capsule completed with `capsule.opened` + `capsule.backfill-gap`, not an error. Malformed/torn content, candidate schema failure (including an out-of-set `scope`, an unknown `status`, or a malformed evidence shape), duplicate candidate id, or zero/multiple promotion decisions is `closeout.capsule-invalid` (exit 1), with no promotion write. Missing expected events (cross-checked against phase/commit/gate state records) are `capsule-event-gap` residue, not invalid. Plan mode renders `would-refuse` and writes nothing; closeout performs no PM-notes completeness check and fabricates no residue for it (the delivered PM-notes lint and lifecycle own that check); an unreadable review artifact is not invalid and is recorded as `review-verdict-unreadable` residue | The ticket requires every merged change to leave a capsule, including changes started before this contract. Failing pre-contract changes would make the rollout unsafe; closing them with an explicit backfill gap is honest. Capsule-invalid is reserved for damage that makes decisions untrustworthy; a missing mirrored event is evidence of a non-gating append failure and belongs in residue. PM-notes completeness is owned by the delivered lint/lifecycle, not this transaction | 2026-11-07 |
| DEC-5 | Candidates are one file per candidate with a required schema (id, class, scope, statement, evidence, capture-bar basis, source, trust, status, created_by, created); the capture bar is the kernel's five-basis set; the evidence link is mandatory and uses the five declared shapes; dedup is exact normalized-statement equality; contradiction is explicit (`contradicts: <record-id>` paired with `supersedes: <record-id>` for the same target; target existence is checked first — unknown target `supersedes-unknown`, otherwise missing/different `supersedes` `contradiction-requires-supersession`); supersession names an existing lesson/tacit id and updates the old record's status; no similarity scoring, embedding, or model judgment participates. Target writes are content-idempotent: byte-identical → `satisfied` no-op; same identity with different content → `duplicate:<existing-id>`; different identity declaring `contradicts` without matching `supersedes` → `contradiction-requires-supersession`; never an overwrite | One file per record eliminates concurrent-write conflicts (memory-architecture) and matches the existing lessons/tacit format. A deterministic dedup rule keeps the ceremony reproducible; a model-scored similarity would break determinism and reviewability. The three target-file outcomes are the closed rejection set applied to a pre-existing file, so no new vocabulary is introduced | 2026-11-07 |
| DEC-6 | Promotion routing is the closed table: `lesson` → `.ai/memory/lessons/`, `tacit` → `.ai/memory/tacit/` are home-written with one index row; `fact` → `doc/spec/**`, `decision` → `doc/decisions/**`, `norm` → the kernel, `workflow` → a command/skill/playbook are recorded as sanctioned handoff proposals to their single home, not edited by closeout; `preference` is rejected `home-not-implemented (M2-S8)` and `fleet` is rejected `owner-approval-required`. A home write is content-idempotent: a byte-identical target is a no-op; same-identity differing content is a duplicate rejection; a different identity that declares `contradicts` without a matching `supersedes` is a contradiction rejection (DEC-5); no overwrite ever. Closeout never pushes or rewrites history; memory reaches history through the next normal PR | Adopted from the PM scope decision (2026-11-07) and reconciled with the kernel memory rule: the kernel says fact/decision promotions are handoff proposals to `@doc-syncer`/`@decision-advisor`, and `consolidate-memory` never writes `doc/spec` or `doc/decisions`. Home-writing lessons/tacit is the ceremony's own consolidation action; preferences/guild trees/typed records are M2-S8 | 2026-11-07 |
| DEC-7 | The step vocabulary grows additively: the delivered seven ids keep their identities; `worktree-cleanup` is inserted before `branch-cleanup`; `merged-diff-sweep`, `retro-coverage-move`, `session-compaction`, and `capsule` are appended in the declared order; `delivery.closeout.v1` stays the schema id with additive fields; consumers must resolve by `stepId` and tolerate unknown ids | Adopted from the PM scope decision (2026-11-07): the published seven-step order and closed vocabularies are a contract. A new step id is additive; overloading the delivered tracker-relation `owed-flip-sweep` with a diff mechanic would change the meaning of a published id and its goldens. Worktree cleanup must precede branch cleanup so the branch is not held by the delivery worktree | 2026-11-07 |
| DEC-8 | The merged-diff sweep detects four closed marker kinds from one bounded added-line diff read (merge transaction squash SHA vs parent); attributed markers are auto-flipped (recorded as resolved owed-flip evidence), unattributed/ambiguous markers become `ambiguous-flip-hit` residue; closeout never edits source, never removes a marker, never commits, never pushes | The operator's pain is grepping, not editing; a post-merge source editor would be a new, unsafe capability outside the closeout transaction. The merge transaction is the delivered merged evidence, so the diff is anchored rather than guessed | 2026-11-07 |
| DEC-9 | Human-authored review threads are never auto-resolved; non-human threads resolve as delivered; unknown authorship is treated as human; human threads become `unresolved-human-thread` residue with identity/author/location only | The ticket asks for a resolution check plus unresolved-human-thread residue. Fail-closed authorship protects a human reviewer's question; identity-only residue preserves the no-comment-body privacy rule (the man-page example's subject text is illustrative, Appendix A) | 2026-11-07 |
| DEC-10 | Worktree cleanup is a new fixed-argv, no-shell, local-only git-seam capability whose predicate mirrors branch deletion (merged evidence, convention match, exact head equality, cleanliness, not current, not locked/foreign, earlier-failure gate); a refusal reuses `closeout.branch.unsafe` and preserves the worktree; no force fallback | Stranded worktrees are the debris class branch deletion already reasons about; reusing the safety identity avoids inventing a parallel error family. The same predicate, not git ancestry, is the proof because a squash merge rewrites ancestry | 2026-11-07 |
| DEC-11 | The retro-coverage move reads the delivered `retro.run`/level registry and records a `capsule.retro-coverage` event; it writes no registry record and adds no mode value; unreadable registry is a declared gap plus residue | The delivered `retro.run` mode vocabulary is closed at `collect`/`report` and carries collection counts/truth; a synthetic closeout run would corrupt retro truth and make the real collection look done. Coverage is a capsule fact; the registry remains the selection authority | 2026-11-07 |
| DEC-12 | Session compaction identifies the delivery's sessions through the delivered read-only session-store attribution (opencode work-item column; Claude session-tree mapping), records a `capsule.compaction-checkpoint`, and declares the harness compaction invocation a `skipped-gap` capability; `db list` is not extended; no harness API is invented | Adopted from the PM scope decision (2026-11-07) and refined against the delivered surface: `db list` has no work-item field, so it cannot attribute; the harness-store read is the honest attribution seam. The checkpoint is the compaction contract's pre-compaction half; the invocation half has no adapter surface | 2026-11-07 |
| DEC-13 | Two streams stay separate: harness telemetry stays in the state-layer log (`harness.telemetry`) and is the only `spend` source; the capsule carries phase/gate/review/closeout events. The production closeout composer now injects the M1-S11 capture. GH-233 review F-8 (Claude file-read budget) and F-11 (orphan scoping) are resolved here; F-9 (host-runner semantics) is explicitly re-deferred because the runner is not on the closeout path and no production consumer exists until dispatch | The ticket pins telemetry preservation; the PM scope decision restates two streams/two owners. The composer makes F-8/F-11 production-reachable and cheap to fix; F-9's exposure is unchanged on the closeout path | 2026-11-07 |
| DEC-14 | Residue is bounded data (`{item, kind, location}`, closed kinds, 50-item cap, deterministic order) with an `attention` exit: apply returns `data` and exits 1 when residue remains on a run that completes without a command-level failure; a command-level failure returns the error envelope with no structured residue (F-11 failure-envelope rule); plan renders it and exits 0 unless a hard failure. The result contract gains an additive `attention` projection class (exit 1); no error envelope for residue | The man page pins a data-bearing residue list and exit 1; the delivered projection has no data-plus-exit-1 class. An additive class is smaller and more honest than forcing residue into an error envelope that cannot carry the structured list | 2026-11-07 |
| DEC-15 | Error identities: add `closeout.capsule-invalid` (user, non-retryable, not_landed, exit 1) and the `closeout.step.<id>.failed` family row (user, non-retryable, not_landed, exit 1) with the slot validated against the effective step-id set; reuse delivered identities for provider write failures, unsafe branch/checkout/worktree, state, config, and input; keep exit codes in the projection module | The man page names both identities; the family-row pattern is delivered (`status.collector.<id>.unavailable`, `merge.gate.<gate-id>.failed`). Reuse prevents a parallel error vocabulary and keeps the documented/machine tables synchronized | 2026-11-07 |
| DEC-16 | A re-run after restart converges by construction: terminal operation outcomes are reused; capsule events are deduplicated by event key; promotion decisions are keyed by candidate id; resolved threads, deleted branches, removed worktrees, and appended telemetry are all identity-idempotent; residue is recomputed deterministically | Ticket AC 5. The delivered closeout already proves terminal-outcome reuse; extending the same identity discipline to every new step is the only way the ceremony can be safely retried after a crash | 2026-11-07 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts (capsule event schema, candidate schema, promotion routing and rejection vocabulary, marker vocabulary, residue kinds, additive closeout data fields, `attention` outcome) | New — types and `as const` data only |
| Core domain (capsule validation, candidate evaluation/dedup/routing, diff-sweep classification, residue ordering, worktree predicate, coverage classification, compaction checkpoint, step expansion) | Extended — pure evaluation over injected facts |
| Core state (closeout ledger, harness telemetry, retro registry reads) | Consumed unchanged; no new state record kind and no schema-version bump |
| File adapter (change-folder resolution, capsule append/lock/read, candidate read) | New — file-based capsule I/O beside the existing change-folder locators |
| Git adapter (worktree listing/removal) | Extended — one new fixed-argv local capability; existing branch/checkout and merge seams unchanged |
| Harness adapters (opencode/Claude telemetry extraction and session attribution) | Updated — GH-233 review F-8/F-11 fixes; attribution reused for compaction |
| CLI command layer (`phase`, `commit`, `verify`, `closeout`) | Extended — capsule append points in three commands; closeout gains the new steps and output fields; no new command family |
| CLI edge/composition | Updated — production closeout composer injects the M1-S11 capture; capsule file runtime and worktree capability composed |
| Result contract (projection classes, error table) | Extended — additive `attention` class and two `closeout` rows; sync check grows |
| Retro pipeline | Consumed unchanged — registry read only; no new kind or mode |
| Session database admin (`db`) | Unchanged — no new subcommand or field; session facts come from the harness store seam |
| Current-truth feature documentation | New/updated — closeout is primary; neighbor list in §18; reconciliation at system_spec_update |

## 17. ACCEPTANCE CRITERIA

**Ticket AC (verbatim, condensed to the authoritative body):** every merged change leaves behind a closed capsule with events and a promotion decision (promoted or rejected with reason) per candidate; no candidate skips the capture bar or the evidence link; closeout performs the full mechanical sweep idempotently and emits bounded judgment residue; the M1-S11 telemetry capture still lands in the state-layer event log after the closeout rewrite; a re-run after restart converges.

Traceability: ticket AC 1 → AC-F1-1, AC-F3-1, AC-F4-2; AC 2 → AC-F4-1; AC 3 → AC-F5-1, AC-F6-1, AC-F7-1, AC-F8-1, AC-F11-1; AC 4 → AC-F10-1, AC-F10-2; AC 5 → AC-F12-2 plus the idempotency criteria AC-F1-3, AC-F2-1, AC-F4-3, AC-F5-2, AC-F7-1, AC-F9-2.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a change folder matching the established convention, **when** phase, commit, verify, or closeout events are appended, **then** `events.jsonl` carries the `delivery.capsule.event.v1` envelope with contiguous sequences, deterministic event keys, LF-terminated lines, and a closed kind/writer, and `candidates/` exists; the folder is resolved uniquely by the month-scan rule and no archive tree is created | F-1, DM-1, DEC-1 |
| AC-F1-2 | **Given** an `events.jsonl` with a torn tail, a duplicate event key, a non-contiguous sequence, or a line after `capsule.closed`, **when** a writer or closeout reads it, **then** the capsule is invalid, no append compounds the damage, and no truncation or repair occurs | F-1, DM-1, DEC-3, NFR-5 |
| AC-F1-3 | **Given** a phase/commit/verify invocation whose capsule append fails (absent folder, busy lock reported as the retryable `state.lock.busy`, torn tail, cap), **when** the command completes, **then** its primary outcome and state record are unchanged, the append failure is classified and disclosed, and closeout's cross-check against the durable state records reports the missing event as a `capsule-event-gap` residue | F-1, F-2, DEC-2, NFR-5 |
| AC-F2-1 | **Given** a phase completion, commit landing, and full gate evaluation, **when** each command runs, **then** `phase` appends exactly one `phase.transition` event, `commit` exactly one `commit.landed` event, and `verify` exactly one `gate.outcome` event, each with a bounded payload, and a re-run of the same logical event appends nothing | F-2, DM-1, DEC-2, NFR-6 |
| AC-F2-2 | **Given** the event producers, **when** inspected structurally, **then** no agent free-text write path exists, no command writes another change's capsule during phases 1–10, and every event carries a closed writer identity | F-2, DEC-2, NFR-5 |
| AC-F3-1 | **Given** a merged change with a valid capsule or no capsule, **when** closeout `--apply` runs, **then** it validates the capsule, ingests readable review verdicts, completes a pre-contract capsule with `capsule.opened` + `capsule.backfill-gap`, records the promotion decisions, and appends exactly one terminal `capsule.closed` event | F-3, DEC-1, DEC-4 |
| AC-F3-2 | **Given** a malformed/torn capsule, an invalid candidate schema, a duplicate candidate id, or a candidate with zero or multiple promotion decisions after promotion, **when** closeout `--apply` runs, **then** it returns `closeout.capsule-invalid` (exit 1) and performs no promotion write; **given** plan mode, **then** it renders the capsule step `would-refuse` with zero writes, appends, and promotions | F-3, DEC-4, NFR-5 |
| AC-F4-1 | **Given** candidates in `candidates/`, **when** closeout evaluates them, **then** every candidate has a `basis` from the capture-bar set, an `evidence` value matching one of the five declared link shapes, and a `status` in `candidate`, `authoritative`, `superseded`; a missing/empty `basis` is rejected `capture-bar-unmet`, a missing/empty `evidence` is rejected `evidence-missing`, and neither is ever promoted; a duplicate is rejected with the existing id; target existence is checked first, so an unknown `contradicts`/`supersedes` target is rejected `supersedes-unknown`, and otherwise a candidate declaring `contradicts` without a matching `supersedes` for the same target is rejected `contradiction-requires-supersession`; an id/record-name outside the declared slug shape (including separators or `..`), an out-of-set `scope`, an unknown `status`, or a non-empty evidence value outside the five shapes is a candidate schema failure (`closeout.capsule-invalid` per AC-F3-2), not a rejection reason | F-4, DM-2, DEC-5 |
| AC-F4-2 | **Given** an accepted `lesson` or `tacit` candidate, **when** closeout promotes it, **then** exactly one record file is written under the injected memory root with the documented frontmatter and one bounded index row is appended; a resolved home path outside that root after realpath resolution (symlinked parent, absolute path, traversal) is `closeout.step.capsule.failed` with zero writes (plan mode `would-refuse`); **given** an accepted `fact`, `decision`, `norm`, or `workflow` candidate, **then** a sanctioned handoff proposal to its single home is recorded and the home is not edited; **given** `preference` or `fleet`, **then** it is rejected with the declared reason; every candidate has exactly one decision in the durable `capsule.promotion` payload and exactly one entry in the `capsule.candidates[]` output projection (`{id, decision, home?, reason?}`) | F-4, DM-3, DEC-6 |
| AC-F4-3 | **Given** a re-run after a promotion decision, **when** closeout runs again, **then** no duplicate decision, no duplicate record file, and no duplicate index row are produced; a previously promoted candidate is stable; **given** a pre-existing promotion target file, **then** byte-identical content is `satisfied` with no write, same-identity/different-content (same candidate id or promoted record id) is rejected `duplicate:<existing-id>`, and a different identity that declares `contradicts: <existing-id>` without a matching `supersedes` for the same target is rejected `contradiction-requires-supersession`; no overwrite ever occurs | F-4, DEC-6, DEC-16, NFR-6 |
| AC-F5-1 | **Given** a merged change with a verified merge transaction and squash SHA, **when** the merged-diff sweep runs, **then** one bounded added-line read detects the closed marker kinds; a marker that names this work item and whose kind maps to a declared action from the closed action vocabulary (Appendix C) is recorded as resolved owed-flip evidence; a marker that is unattributed, names another work item, is a `class-string` without an attributable owner, or declares an out-of-vocabulary or kind-mismatched action becomes `ambiguous-flip-hit` residue (never resolved); no source file, marker, commit, or remote is touched | F-5, DM-6, DEC-8 |
| AC-F5-2 | **Given** no merge transaction record or no resolvable diff, **when** the sweep runs, **then** the step is `skipped-gap` with `merged-diff-unavailable` evidence; **given** a re-run, **then** no duplicate resolved record is appended and the residue is identical | F-5, DEC-8, NFR-6 |
| AC-F6-1 | **Given** unresolved review threads, **when** `comment-resolution` runs, **then** non-human-authored threads are resolved as delivered, human-authored threads are left unresolved and emitted as `unresolved-human-thread` residue with the thread identity, author principal, and bounded location only, and unknown authorship is treated as human so no unattributable thread is resolved | F-6, DM-4, DEC-9 |
| AC-F6-2 | **Given** a provider with no thread surface or an unavailable thread signal, **when** the step runs, **then** it keeps the delivered declared gap or `skipped-noop` with evidence and fabricates no residue; **given** more human threads than the residue cap, **then** the list is truncated with `+N` and none beyond the cap is resolved | F-6, DEC-9, NFR-4 |
| AC-F7-1 | **Given** a delivery worktree satisfying the full safety predicate (merged evidence, convention match, exact head equality, clean, not current, not locked/foreign, earlier steps clean), **when** `worktree-cleanup` runs, **then** the worktree is removed locally and recorded; **given** the worktree is already absent, **then** the step is `satisfied` with `no-worktree` and no mutation; a re-run never removes twice | F-7, DM-7, DEC-10, NFR-6 |
| AC-F7-2 | **Given** a worktree failing any predicate condition (dirty, moved head, current checkout, locked, foreign, or an earlier non-gap failure), **when** cleanup runs, **then** no removal occurs; apply returns `closeout.branch.unsafe` with the failed step's bounded evidence naming the retained worktree (count and identity); the `worktree-retained` residue is assertable in plan mode for the same facts and appears in the human diagnostic stream, never inside the error envelope; plan mode renders `would-refuse` | F-7, DEC-10, NFR-9 |
| AC-F8-1 | **Given** the delivered retro registry, **when** `retro-coverage-move` runs, **then** it reads verified `retro.run` records at level `change` for the work item and appends exactly one idempotent `capsule.retro-coverage` event with `collected` (a run exists) or `pending` (none), writes no registry record, and a re-run appends nothing | F-8, DM-9, EVT-4, DEC-11, NFR-6 |
| AC-F8-2 | **Given** an unreadable retro registry, **when** the step runs, **then** it is a disclosed `skipped-gap` with `retro-registry-unavailable` evidence and a `retro-coverage-unavailable` residue, and the rest of closeout proceeds | F-8, DEC-11 |
| AC-F9-1 | **Given** the delivery's sessions are attributable by work item through the read-only session-store seam, **when** `session-compaction` runs, **then** it appends one `capsule.compaction-checkpoint` event with bounded session identities or a counted truncation, flushed working-state/event-log flags, the unresolved-question count, and the last verified commit, and the harness compaction invocation is a declared `skipped-gap` capability with no invented API | F-9, DM-8, EVT-3, DEC-12 |
| AC-F9-2 | **Given** the delivery has no sessions, **then** the step is `skipped-noop` with `no-sessions` and writes no zero checkpoint; **given** sessions exist but work-item attribution is unavailable, **then** the step is `skipped-gap` with `session-attribution-unavailable` and a `session-attribution-gap` residue, never a guessed checkpoint; **given** a re-run, **then** no duplicate checkpoint event is appended for the same session-set digest and last verified commit | F-9, DEC-12, NFR-6 |
| AC-F10-1 | **Given** the production closeout composition and a configured harness, **when** closeout `--apply` runs, **then** the M1-S11 capture extracts read-only and appends `harness.telemetry` records to the state-layer event log, the capsule contains no telemetry statistics, `spend` reads the state log alone, and plan mode performs no extraction or append | F-10, EVT-5, DEC-13, NFR-7 |
| AC-F10-2 | **Given** the GH-233 review deferrals on the now-reachable production path, **then** the Claude Code file-read budget (GH-233 review finding F-8) treats a would-exceed file as truncated-with-warning without a full read, the orphan/invalid-identity disclosure (GH-233 review finding F-11) is scoped to the capturing delivery with out-of-port orphans as a store-level warning, and the host-runner semantics (GH-233 review finding F-9) remain explicitly re-deferred with the production-consumer reason recorded | F-10, DEC-13, NFR-7 |
| AC-F11-1 | **Given** residue items on a run that completes without a command-level failure, **then** the list is at most 50, ordered deterministically by kind then location, each item is `{item, kind, location}` from the closed kind vocabulary, no item contains a comment body/title/transcript/credential, and truncation carries `+N`; **given** apply mode with residue and no command-level failure, **then** the command returns `data` and exits 1; **given** plan mode, **then** it renders the residue and exits 0 unless a hard plan failure occurs; **given** a command-level failure, **then** the envelope is the error, no structured `residue[]` is emitted, and the failed step's evidence plus the human diagnostic stream name the refused/preserved items | F-11, DM-4, DEC-14, NFR-4 |
| AC-F11-2 | **Given** a step failure, **then** the envelope carries a delivered identity where one exists (provider write failure, unsafe branch, state/config/input) or `closeout.capsule-invalid` for capsule content damage or the `closeout.step.<id>.failed` family row for a capsule step failure, with the step slot validated against the effective step set and the category-appropriate exit; no exit literal appears outside the projection | F-11, DEC-15, NFR-10 |
| AC-F12-1 | **Given** a consumer of `delivery.closeout.v1`, **then** the delivered seven step ids keep their identities, the new ids are additive, existing fields are unchanged, `residue`/`capsule`/`detail` are additive optional fields, the consumer resolves steps by `stepId` and tolerates unknown ids, and no schema-version bump occurs | F-12, DM-5, DEC-7 |
| AC-F12-2 | **Given** a closeout re-run after restart, **then** every terminal operation outcome is reused, capsule events and promotion decisions are not duplicated, no second thread resolution, branch deletion, or worktree removal occurs, residue is deterministic, and the outcome converges | F-12, DEC-16, NFR-6 |

**Proxy and test-plan gap handoffs.** The following criteria are proven over injected fixtures/design proxies and are handed to the test plan as named gaps rather than weakened: GAP-C1 live GitHub thread authorship (recorded provider fixtures); GAP-C2 live harness session stores (injected store/file fixtures); GAP-C3 worktree removal (temporary local repositories); GAP-C4 promotion home writes (temporary memory trees); GAP-C5 retro registry/merge transaction state (injected state fixtures); GAP-C6 marker vocabulary (fixture-pinned merged diffs). The AC wording above is not reduced by these proxies.

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. The checklist is the post-implementation acceptance gate (`dod_check`): `@reviewer` audits the implementation against it, then `@pm` confirms the full list before PR creation. The specification claims no passing evidence and no acceptance; the conditions define what must be proven. "Proven in" names the delivery-order phase from §18; delivery planning maps the test plan's cases onto those phases without reshaping any pinned contract.

| # | Done condition | Binds | Verification (test / evidence) | Proven in |
|---|---|---|---|---|
| DoD-1 | The capsule artifact contract holds: established folder resolution, `delivery.capsule.event.v1` envelope, contiguous sequences, deterministic event keys, closed kind/writer vocabularies, LF framing, per-capsule lock, append-only discipline, terminal close, and declared caps | F-1, DM-1, AC-F1-1, AC-F1-2, NFR-2, NFR-5, NFR-11 | Capsule contract/append/lock/reader fixtures; torn-tail and duplicate-key negative cases; concurrency case | P1 |
| DoD-2 | Capsule events are produced only by `phase`, `commit`, and `verify`, with one event per owned transition/landing/evaluation and duplicate-event no-ops; capsule append failure is classified, disclosed, and non-gating; no cross-change writes exist | F-2, AC-F1-3, AC-F2-1, AC-F2-2, DEC-2, NFR-5 | Producer fixtures for each command; dedup re-run; non-gating failure injector; structural no-cross-write scan | P2 |
| DoD-3 | Closeout validates the capsule in both modes, ingests review verdicts, completes a pre-contract capsule with the backfill gap, appends one terminal close, returns `closeout.capsule-invalid` on damage with no promotion write, and performs zero writes in plan mode | F-3, AC-F3-1, AC-F3-2, DEC-4, NFR-5 | Validation matrix (valid/pre-contract/torn/duplicate/missing decision); plan zero-write assertions | P3 |
| DoD-4 | Every candidate is evaluated against the capture bar and evidence link (with the declared status and evidence-shape vocabularies), deduplicated deterministically, superseded only explicitly, routed to exactly one home/handoff, and recorded as exactly one promotion decision; preference/fleet rejections carry the declared reasons; home writes and index rows are idempotent; a pre-existing target resolves only as byte-identical no-op, same-identity duplicate, or declared-contradiction (`contradicts` without matching `supersedes`) rejection; home writes are path-confined (resolved home under the injected memory root; id-shape violation → `closeout.capsule-invalid`; escape → `closeout.step.capsule.failed` with zero writes); dedup/contradiction involve no similarity scoring, embedding, or model judgment | F-4, DM-2, DM-3, AC-F4-1, AC-F4-2, AC-F4-3, DEC-5, DEC-6, NFR-6, NFR-9 | Candidate schema/eval fixtures; status/evidence vocabulary cases; target-file three-outcome matrix; path-confinement and contradiction-declaration cases; routing matrix; temp-memory home writes; re-run stability | P4 |
| DoD-5 | The merged-diff sweep reads one bounded added-line diff, detects the closed marker kinds, records attributed hits as resolved evidence, emits ambiguous hits as `ambiguous-flip-hit` residue, touches no source/remote, and is idempotent | F-5, DM-6, AC-F5-1, AC-F5-2, DEC-8, NFR-1, NFR-3, NFR-6 | Diff fixtures across marker kinds and attribution cases; bounds measurement; re-run determinism | P5 |
| DoD-6 | Human-authored threads are never resolved; non-human threads resolve as delivered; unknown authorship is human; human threads become identity-only `unresolved-human-thread` residue; thread/residue caps are enforced and marked | F-6, DM-4, AC-F6-1, AC-F6-2, DEC-9, NFR-4, NFR-9 | Provider fixture matrix (human/non-human/unknown); cap/truncation; no-body privacy canary | P5 |
| DoD-7 | Worktree cleanup satisfies the full predicate, removes locally without force, refuses with `closeout.branch.unsafe`/`would-refuse` and the retained worktree named in bounded evidence (plan residue and human diagnostic, not the error envelope), and never removes twice | F-7, DM-7, AC-F7-1, AC-F7-2, DEC-10, NFR-6, NFR-9 | Temporary-repository matrix (clean/dirty/moved/current/locked/foreign/absent); no-force assertion | P7 |
| DoD-8 | The retro-coverage step reads the delivered registry, records exactly one idempotent `capsule.retro-coverage` event as `collected`/`pending`, writes no registry record or mode value, and degrades to a declared gap/residue when unreadable | F-8, DM-9, EVT-4, AC-F8-1, AC-F8-2, DEC-11, NFR-6 | Registry fixtures (collected/pending/unreadable); read-only assertion; re-run no-op | P8 |
| DoD-9 | The session-compaction step attributes sessions through the delivered read-only seam, records the checkpoint with flushed flags/unresolved count/last verified commit, declares the harness compaction gap, handles no-sessions and re-runs, and invents no harness API | F-9, DM-8, EVT-3, AC-F9-1, AC-F9-2, DEC-12, NFR-6, NFR-9 | Session-store fixtures; no-sessions; same-digest re-run; API-absence scan | P8 |
| DoD-10 | The production closeout composer injects the M1-S11 capture; `harness.telemetry` remains in the state-layer log with no capsule copy; capture is non-gating and idempotent; GH-233 review findings F-8 and F-11 are resolved and review finding F-9 is explicitly re-deferred with its reason | F-10, EVT-5, AC-F10-1, AC-F10-2, DEC-13, NFR-7 | Production-composition capture test; log-only readback; re-run no duplicates; review-F-8 size-cap and review-F-11 scoping cases; deferral record | P9 |
| DoD-11 | Residue is bounded, closed-kind, deterministically ordered, body-free, and rendered with `+N`; a non-failed apply returning data exits 1 when residue remains; a command-level failure returns the error envelope with the refused/preserved item in the failed step's bounded evidence and no structured residue; plan exits 0; the `attention` class is additive and no exit literal escapes the projection | F-11, DM-4, DM-10, AC-F11-1, AC-F11-2, DEC-14, NFR-4, NFR-10 | Residue ordering/bounds/canary; envelope+exit matrix for apply/plan/failure; projection check | P6, P10 |
| DoD-12 | The closeout contract grows additively: delivered step ids keep identity, new ids are additive and declared, existing fields unchanged, `residue`/`capsule`/`detail` additive, consumers resolve by id, no schema-version bump, and goldens are updated | F-12, DM-5, AC-F12-1, DEC-7, NFR-10 | Contract/golden diff; consumer-tolerance test; schema-id assertion | P10 |
| DoD-13 | A closeout re-run after restart converges: terminal outcomes reused, no duplicate capsule event, promotion decision, thread resolution, branch deletion, worktree removal, or telemetry record; residue deterministic | AC-F12-2, DEC-16, NFR-6 | Full re-run/convergence suite; restart fixture | P11 |
| DoD-14 | All 26 acceptance criteria are green: AC-F1-1..3, AC-F2-1..2, AC-F3-1..2, AC-F4-1..3, AC-F5-1..2, AC-F6-1..2, AC-F7-1..2, AC-F8-1..2, AC-F9-1..2, AC-F10-1..2, AC-F11-1..2, AC-F12-1..2; the test plan's coverage matrix is all Covered with no orphan TC | §17 | Coverage matrix and execution log | P1–P11 |
| DoD-15 | All 11 NFR thresholds are met with measured evidence: determinism, capsule bounds, diff budget, output/residue bounds, append-only/self-containment, idempotency, telemetry preservation, latency, privacy/security, error-identity stability, and capsule concurrency | NFR-1..NFR-11 | Execution log with measured values; invariant checks green | P1–P11 |
| DoD-16 | Every §4.1 success-metric row is verified at its target (100% capsules/decisions; 0 unsupported promotions; 0 human-thread auto-resolutions; 0 unsafe worktree removals; 0 duplicates; 0 telemetry moves/duplicates; 0 harness re-queries; 0 unbounded residue; 0 closeout source/remote mutations; 0 manual diff re-greps) | §4.1 | Metric table with evidence per row | P11 |
| DoD-17 | The quality-gate battery is green on a clean checkout at the delivered HEAD: the aggregate workspace check (`pnpm check` — lint, format, typecheck, tests, boundaries, exports parity), the error-table sync check, the doc-distribution check, and the license/vulnerability gates, with zero new runtime dependencies | Delivery process, NFR-10 | Aggregate run log; per-check records | P11 |
| DoD-18 | Exactly one lockstep changeset exists for the release, matching the declared minor version impact — one workspace version bump, no per-package drift | Delivery process | Changeset present and singular; Phase 11 release evidence | P11 |
| DoD-19 | Neighbor documentation is reconciled through the declared handoff (§18): the primary closeout feature doc and every listed neighbor, including the result-contract rows, the harness-adapters composer note, the retro/session consumers, and the memory index | §18 | Doc-sync reconciliation record; neighbor checklist | P11 |
| DoD-20 | PR posture: a pull request is created against the integration branch (`main-tools`) and left open for human review, with required CI jobs green on the pushed HEAD; merge and owner acceptance remain external and are not claimed here | Delivery process | PR record and CI run attached to the change | P11 |

A condition without passing evidence is not done; `dod_check` reopens the owning delivery-order phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one additive change through the standard 11-phase lifecycle on its feature branch; no flag-gating — a single-user local tool adds the ceremony directly.
- Delivery order inside the change (reflected in the DoD's `Proven in` column): **P1** capsule contracts, file runtime, and validation primitives; **P2** capsule event production in `phase`/`commit`/`verify`; **P3** capsule validation and the closeout capsule step; **P4** candidate model, capture bar, dedup, routing, and home writes; **P5** merged-diff sweep and human-thread policy; **P6** residue/output/exit contract and the `attention` class; **P7** worktree seam and cleanup step; **P8** retro-coverage and session-compaction steps; **P9** production telemetry wiring and the GH-233 deferral re-assessment; **P10** step-vocabulary/contract evolution, error rows, goldens; **P11** full convergence suite, gates, docs reconciliation, changeset, and PR posture.
- The capsule event producers land before closeout consumes them, but closeout's pre-contract backfill keeps changes started earlier closeable throughout the rollout.
- The human-thread policy is the one deliberate behavior change: operators should expect human-authored threads to remain open and closeout to exit 1 with residue. Plan mode shows the residue before apply.
- Worktree cleanup activates with the new git-seam capability; the default predicate refuses anything uncertain, so an operator sees the retained worktree named (plan residue or failed-step evidence) rather than a destructive default.
- The diff sweep is detection-only; no source edits occur, so adoption risk is limited to the accuracy of the residue.
- Reconciliation note for phase 7 (`system_spec_update`) — **neighbor documents this change will require**:
  - `doc/spec/features/feature-closeout.md` — primary: twelve-step order, capsule/residue/capsule output, `attention` exit, human-thread behavior, worktree cleanup, retro coverage, compaction, telemetry wired, new error rows.
  - `doc/spec/features/feature-result-contract.md` — the additive `attention` projection class, the `closeout.capsule-invalid` row, and the `closeout.step.<id>.failed` family row; table count and sync corpora.
  - `doc/spec/features/feature-harness-adapters.md` — the production composer now injects capture; replace the "no production composer until GH-240" note; record GH-233 review findings F-8/F-11 resolution and review finding F-9 re-deferral.
  - `doc/spec/features/feature-state-layer.md` — confirm the capsule is file-based and no state kind is added; restate that `harness.telemetry` is unchanged.
  - `doc/spec/features/feature-retro-pipeline.md` — the closeout coverage consumer reads `retro.run`/`retro.level` read-only; no new kind or mode.
  - `doc/spec/features/feature-session-database-admin.md` — the compaction consumer uses the harness-store attribution, not `db list`; the `db` surface is unchanged.
  - `doc/spec/features/feature-merge-verify-deploy.md` — the diff sweep consumes the `merge.transaction` squash SHA; no merge contract change.
  - `doc/spec/features/feature-commit-primitive.md` and `feature-pm-notes-lint-and-phase-transitions.md` — capsule event append points beside the delivered state records.
  - `doc/spec/features/feature-verify-gates.md` — the gate-outcome capsule append beside the delivered verification record.
  - `.ai/memory/README.md` — promotion routing is now mechanized by closeout; index rows for home-written lessons/tacit; M2-S8 owns the rest.
  - `AGENTS.md` — kernel memory rules are unchanged; closeout implements the consolidation ceremony they describe (no rule change expected).
  - `doc/overview/architecture.md`, the glossary, the ubiquitous-language index, and `doc/00-index.md` as needed.
  - `doc/decisions/**` — a decision record is recommended for the capsule-stream vs state-stream boundary and for the human-thread policy (routing recommendation in the authoring report; not authored here).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None for the state layer: no schema-version bump, no new state record kind, no migration, no backfill. Capsule files are new and append-only; a change folder with no capsule is completed at closeout with an explicit `capsule.backfill-gap` event (DEC-4), so pre-contract changes close safely without pretending their history existed. Existing `harness.telemetry`, `closeout.operation`, `retro.*`, and merge records are untouched. Changes closed before this change keep no capsule and are not retroactively backfilled; their folders remain readable artifacts.

## 20. PRIVACY / COMPLIANCE REVIEW

- Capsule events, candidates, promotion decisions, residue, and output carry identity references, counts, refs, SHAs, phase/gate ids, verdicts, file paths, line numbers, and bounded statements only. No comment bodies, titles, review prose, transcripts, diffs, tool output, prompts, credentials, environment values, or free-form conversation enter any artifact.
- The human-thread residue deliberately identifies a thread and its author principal but never the thread's text; the man-page example's subject text is illustrative and superseded (Appendix A).
- Harness telemetry remains metadata-only under the M1-S11 privacy contract; the capsule never receives telemetry statistics, and the compaction checkpoint carries session identities/counts, flags, an unresolved-question count, and a commit SHA — never session content.
- Promotion records carry the candidate's declared statement and evidence link; the candidate author is responsible for ensuring the statement contains no secret or private identifier. The closeout redaction chokepoint covers output; the capsule/candidate files are local committed artifacts and are reviewed like any memory record.
- Worktree and branch cleanup touch only local refs/worktrees under the safety predicate; no remote deletion, push, or history rewrite occurs.
- Everything is local-first: no telemetry exporter, network sink, or remote read beyond the delivered provider reads.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Primary — destructive worktree removal:** the new capability is fixed-argv, no-shell, local-only, and gated by the full predicate (merged evidence, exact head equality, cleanliness, not current, not locked/foreign, earlier-failure gate). No force fallback exists; a refusal preserves the worktree. The branch-cleanup predicate and protected-ref checks remain in force (F-7, AC-F7-1/2, NFR-9).
- **Human-review protection:** unknown authorship fails closed to human; no unattributable thread is auto-resolved; human threads are identity-only residue. This is the control that prevents automation from erasing a reviewer's question (F-6, AC-F6-1).
- **Append-only capsule integrity:** per-capsule lock, LF framing, event-key dedup, terminal close, and torn-tail refusal prevent silent corruption or history rewriting; the capsule is never truncated or compacted by this change (F-1, NFR-5).
- **Promotion write boundary:** home writes are limited to `.ai/memory/lessons|tacit`; fact/decision/norm/workflow are handoffs, not direct edits; preference/fleet are rejected. Paths are confined by realpath: a candidate-supplied id/record-name outside the declared slug shape (including separators or `..`) is `closeout.capsule-invalid` before any write, and a resolved home path outside the injected memory root (symlinked parent, absolute path, traversal) is `closeout.step.capsule.failed` with zero writes (plan mode `would-refuse`). Closeout never pushes, writes a remote, or rewrites history. The kernel's routing and the redaction chokepoint are preserved (F-4, DEC-6).
- **Read-only external surfaces:** harness stores are read-only (query-only pragma/file reads); the retro registry is read-only; the merged diff is a bounded local read; no new credential path, vendor, or network edge is added (F-8, F-9, F-10).
- **No source mutation:** the diff sweep never edits source, removes markers, commits, or pushes; its only products are capsule evidence and residue (F-5, DEC-8).
- **Telemetry boundary:** the state-layer telemetry family is unchanged and remains the only `spend` source; the capsule stream cannot acquire telemetry records, and the telemetry stream cannot acquire capsule events (F-10, NFR-7).
- **Error/exit integrity:** the new family row's slot is validated against the effective step set; exit codes stay in the projection module; the `attention` class is additive and data-bearing (F-11, NFR-10).
- **Brand neutrality:** no product, binary, or provider literal is committed; surfaces render injected names.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Adding a capsule event kind or a marker kind is a reviewed contract-data change with tests and documentation; the event vocabulary and marker vocabulary are closed, not plugin surfaces.
- Tuning capsule/scan/residue caps is a declared-data edit; the invariants (bounded, marked, refuse-beyond) do not change.
- Promotion routing changes (for example when M2-S8 ships preferences) are contract-data changes to the closed table; the ceremony, decision recording, and handoff discipline stay.
- Operators read one closeout result: step outcomes, capsule decisions, and residue. Human threads, ambiguous diff hits, retained worktrees, and coverage/attribution gaps are expected attention signals, not tool failures.
- Re-runs are the recovery story: fix the capsule, candidate, worktree, or registry condition and re-run; terminal outcomes and event keys make every retry safe.
- The memory index gains rows only for home-written lessons/tacit; the curator/M2-S8 later reconciles the full index, lint, archive, and preferences tree.
- The closeout and result-contract error tables grow by two rows and one projection class; the sync invariant enforces parity on every future edit.
- No new daemon, scheduled job, network dependency, or runtime-API location is introduced.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Change capsule | The change folder as a memory episode: existing artifacts plus an append-only `events.jsonl` and a `candidates/` directory. |
| Capsule event | One LF-terminated `delivery.capsule.event.v1` line: sequence, event key, work item, run, closed kind/writer, timestamp, bounded payload. |
| Event key | The deterministic identity of one logical event; a duplicate key is a no-op append, which is what makes re-runs idempotent. |
| Pre-contract capsule | A change folder with no capsule because it started before this contract; closeout creates it and records `capsule.backfill-gap`. |
| Candidate | One file under `candidates/` proposing a memory item: class, scope, statement, evidence, capture-bar basis, source, trust, status. |
| Capture bar | The kernel's promotion gate: repeated mistake/occurrence, review catch, human correction, verified outcome, or repeated successful workflow; routine success never qualifies. |
| Promotion decision | Exactly one `promoted` or `rejected` verdict per candidate, with a home/mode or a closed rejection reason. |
| Home write | A promotion applied by writing the canonical record file and one index row (lessons, tacit in this change). |
| Sanctioned handoff | A promotion recorded as a proposal to its single home (`doc/spec`, `doc/decisions`, the kernel, or the normal change process) without closeout editing that home. |
| Judgment residue | The bounded, ordered, body-free list of items that need human attention after the mechanical sweep: human threads, ambiguous flip hits, retained worktrees, coverage/attribution gaps, capsule gaps/caps. |
| `attention` outcome | The additive result-contract class that carries `data` and exits 1 when residue requires attention. |
| Merged-diff sweep | The detection-only read of the merged change's added lines for the four closed marker kinds; attributed hits are resolved evidence, ambiguous hits are residue. |
| Owed-flip marker | A declared marker kind (`todo-marker`, `when-merges-note`, `feature-flag`, `class-string`) indicating an action owed because the change merged. |
| Human thread | A review thread whose root author normalizes to `human` or `unknown` (fail-closed); never auto-resolved. |
| Worktree cleanup | Local removal of a delivery-owned worktree under the full safety predicate; no force, no remote. |
| Retro coverage | Whether the delivered `retro.run` registry already holds a change-level run for the work item; recorded as a capsule event, never as a synthetic run. |
| Compaction checkpoint | The pre-compaction capsule event: bounded session identities, flushed working state/event log, unresolved-question count, last verified commit. |
| Declared capability gap | A machine-readable statement that a surface does not exist (for example harness compaction), never an invented API. |
| Two streams | The capsule event stream (phase/gate/review/closeout) and the state-layer telemetry stream (`harness.telemetry`); two owners, no duplication. |

## 24. APPENDICES

### Appendix A — Design-baseline anchors and recorded refinements

- **Ticket GH-240** (M1-S12): goal, tasks, five acceptance criteria, the telemetry-preservation pin, and the session-compaction pin. **Dependencies** M0-S5, M0-S14, M1-S8, M1-S11 all delivered (PM intake note, 2026-11-07).
- **Design baseline:** the M1 closeout command page (inputs, output `data` with `steps[]`/`residue[]`/`capsule`, exit 0/1/2, errors `closeout.step.<id>.failed` and `closeout.capsule-invalid`), the M1 contracts `closeout` section, journey J7, the M1 architecture learning plane / writer ownership / CP→RT edge, operator requirement R8, the memory-architecture capsule layout, the memory-lifecycle consolidation/routing/compaction sections, telemetry-and-events, parallel-delivery, and the delivered current-truth specs (closeout, harness adapters, state layer, retro pipeline, session database admin, result contract, merge/verify deploy).
- **Recorded refinement — residue subject text.** The closeout man page's example residue item reads `"PR thread t-77 by @reviewer-bob: rename retryPolicy?"`. The delivered privacy contract forbids comment bodies/titles in output. This spec pins identity-only items (`thread id + author + location`); the example's subject is illustrative shorthand and is superseded.
- **Recorded refinement — `db`/session-store attribution.** The PM scope decision says "through the delivered `db`/session-store read surface by work-item attribution". The delivered `db list` carries no work-item field and is a metadata administration surface. This spec uses the delivered harness session-store read (opencode `work_item_ref`, Claude session-tree mapping) as the attribution surface and leaves `db` unchanged (DEC-12).
- **Recorded refinement — retro-coverage move.** The PM wording says "retro-coverage registry move, using the delivered `retro.run`/level registry". The delivered `retro.run` has a closed `collect`/`report` mode and carries collection counts/truth; a synthetic closeout run would corrupt retro selection and truth. This spec reads the registry read-only and records coverage as a capsule event (DEC-11).
- **Recorded refinement — promotion "canonical home".** The PM decision says accepted items are "applied to exactly one canonical home". The kernel memory rule says fact/decision promotions are handoff proposals to `@doc-syncer`/`@decision-advisor`, and the curator never writes `doc/spec`/`doc/decisions`. This spec home-writes lessons/tacit and records sanctioned handoffs for fact/decision/norm/workflow; preference/fleet are rejected because their homes are M2-S8 or owner-only (DEC-6). This preserves both the one-home routing table and the kernel's write authority.
- **Recorded refinement — data-bearing residue exit.** The man page shows `data` plus exit 1 for residue; the delivered projection has only success(0)/user-validation(1)/platform-provider(2), and a failure envelope cannot carry `data`. This spec adds the additive `attention` projection class (exit 1) for data-bearing attention outcomes (DEC-14).
- **Recorded refinement — step insertion.** Worktree cleanup is inserted before branch cleanup for safety; branch cleanup moves from the seventh to the eighth position in the declared array. Consumers must resolve by id. The alternative (append after branch cleanup) was rejected because a delivery worktree would hold the branch and force a refusal (DEC-7).
- **Recorded refinement — capsule lock failure identity.** A busy capsule lock is the delivered retryable `state.lock.busy` identity (transient, retryable, exit 2), with a busy detail naming the capsule lock; in phase/commit/verify it stays a disclosed non-gating skip. `closeout.capsule-invalid` is reserved for content damage, never for lock contention.
- **Recorded refinement — `verify` as capsule writer.** The M1 architecture writer-ownership table names `phase` and `commit` as the commands through which capsule events are written. The PM scope decision adds `verify` for gate outcomes. This spec adopts the PM decision and treats `verify` as the owner of its own `gate.outcome` kind under the same single-writer discipline; it writes no other change's capsule and no other event kind.
- **Recorded refinement — review-verdict ingestion.** Review verdicts are read from the change folder's `code-review/review-iter-*.yaml` artifacts as data. A malformed artifact is residue (`review-verdict-unreadable`), not capsule-invalid, because it is evidence, not capsule state.

### Appendix B — Current-truth reuse map

| Reused truth | Source surface | What this change takes from it |
|---|---|---|
| Dry-run-by-default transaction, SHA-256 operation identities, terminal-outcome ledger, bounded output | Closeout v1 (GH-183) | The closeout shell, idempotency ledger, output/exit mechanics, and the injected telemetry point the new steps extend |
| Change-folder resolution (month scan, `--<ref>--`) | Plan-artifact and pm-notes locators (delivered) | The capsule location rule; one convention for every change-folder read |
| Append-only, fenced, verified, schema-versioned records with additive kinds | State layer | The capsule's append-only/verified discipline in file form; the `harness.telemetry` family preserved |
| Read-only harness-store extraction, work-item session attribution, harness-neutral statistics, non-gating idempotent closeout capture | Harness adapters (GH-233) | The production wiring (F-10), attribution for compaction (F-9 of this spec), and the GH-233 review finding F-8/F-11 fixes |
| `retro.run`/`retro.level` validated registry and `change`-level selection | Retro pipeline (GH-232) | The coverage read (F-8); no new kind/mode |
| `merge.transaction` with squash SHA and landing evidence | Merge transaction (GH-225) | The anchored merged diff (F-5) |
| Metadata-only session administration and read-only store discipline | Session database admin (GH-180) | The session-store access posture; `db` surface unchanged |
| Promotion routing table, borrowed record format, capture bar, one-file-per-record | Memory architecture/lifecycle, `.ai/memory/README.md`, kernel | The candidate/promotion contract (F-4) and the home/handoff split |
| Envelope, scripted projection, error-table sync, redaction chokepoint, `{0,1,2}` exit | Result contract | The additive `attention` class and the two closeout rows |

### Appendix C — Pinned vocabularies

**Step order (12):** `ticket-to-done`, `lifecycle-label-sweep`, `unassign`, `owed-flip-sweep`, `comment-resolution`, `checkout-restore`, `worktree-cleanup`, `branch-cleanup`, `merged-diff-sweep`, `retro-coverage-move`, `session-compaction`, `capsule`.

**Capsule event kinds:** `capsule.opened`, `phase.transition`, `commit.landed`, `gate.outcome`, `review.verdict`, `closeout.step`, `capsule.promotion`, `capsule.retro-coverage`, `capsule.compaction-checkpoint`, `capsule.backfill-gap`, `capsule.closed`.

**Capsule writers:** `phase`, `commit`, `verify`, `closeout`.

**Candidate classes:** `fact`, `decision`, `lesson`, `tacit`, `preference`, `workflow`, `norm`, `fleet`.

**Candidate status values (three):** `candidate`, `authoritative`, `superseded` (the `.ai/memory/README.md` vocabulary). This change writes new promoted records as `candidate`, never `authoritative`; the promotion decision lives in the capsule, and the only status rewrite is the declared supersession mark.

**Evidence-link shapes (five):** `review-verdict:<ref>`, `ci-verdict:<ref>`, `human-correction:<ref>`, `merged-pr:<ref>`, `test:<ref>`; `<ref>` is a non-empty bounded reference. A missing/empty value is `evidence-missing`; a non-empty value outside these shapes is a candidate schema failure (`closeout.capsule-invalid`).

**`capsule.promotion` payload (durable):** exactly `id`, `class`, `decision` (`promoted`/`rejected`), `mode?` (`home-write`/`handoff`, promoted only), `home?` (promoted only), `reason?` (rejected only), `supersedes?` (declared only).

**Applied `capsule.candidates[]` projection:** exactly `{id, decision, home?, reason?}`; `class`, `mode`, and `supersedes` are not in the output projection.

**Capture-bar bases:** `repeat-occurrence`, `review-catch`, `human-correction`, `verified-outcome`, `repeated-workflow`.

**Promotion routing:**

| Class | Action | Home |
|---|---|---|
| `lesson` | home write | `.ai/memory/lessons/` |
| `tacit` | home write | `.ai/memory/tacit/` |
| `fact` | sanctioned handoff | `doc/spec/**` (to `@doc-syncer`) |
| `decision` | sanctioned handoff | `doc/decisions/**` (to `@decision-advisor`) |
| `norm` | sanctioned handoff | `AGENTS.md` kernel (normal change process) |
| `workflow` | sanctioned handoff | command/skill/playbook (normal change process) |
| `preference` | rejected | `home-not-implemented (M2-S8)` |
| `fleet` | rejected | `owner-approval-required` |

**Rejection reasons (eight):** `capture-bar-unmet`, `evidence-missing`, `duplicate:<existing-id>`, `contradiction-requires-supersession`, `supersedes-unknown`, `home-not-implemented`, `owner-approval-required`, `index-budget-exceeded`.

An out-of-set `scope` (or any other required-field/closed-vocabulary violation) is a candidate schema failure, not a rejection reason: it makes the capsule invalid (`closeout.capsule-invalid`) per F-3/AC-F3-2.

**Promotion write boundary:** a candidate-supplied `id`/record-name outside `^[a-z0-9][a-z0-9-]{2,63}$` (including separators or `..`) is a candidate schema failure → `closeout.capsule-invalid` before any write. A resolved home path that does not stay under the injected memory root after realpath resolution (symlinked parent, absolute path, traversal) is `closeout.step.capsule.failed` with zero writes; plan mode renders `would-refuse`. No new error row is added.

**Contradiction declaration:** optional `contradicts: <record-id>` must be paired with `supersedes: <record-id>` for the same target. Target existence is checked first: an unknown `contradicts` or `supersedes` target is `supersedes-unknown`; otherwise a missing or different `supersedes` is `contradiction-requires-supersession`. Dedup is exact normalized-statement equality; no similarity scoring, embedding, or model judgment participates.

**Residue kinds:** `unresolved-human-thread`, `ambiguous-flip-hit`, `capsule-event-gap`, `review-verdict-unreadable`, `retro-coverage-unavailable`, `worktree-retained`, `session-attribution-gap`, `capsule-cap-reached`.

**Merged-diff marker kinds:** `todo-marker`, `when-merges-note`, `feature-flag`, `class-string`.

**Merged-diff actions (four):** `remove-guard` (a temporary guard/fallback may be removed after merge), `retire-flag` (a feature flag may be retired), `rename-class` (a class/selector may be renamed or removed), `close-todo` (a TODO/FIXME may be closed). A marker must name this work item and its kind must map to one of these four actions to resolve; any other declared action, or a declared action that does not match its kind's mapping, is `ambiguous-flip-hit` residue.

**Marker-kind → action mapping:** `todo-marker` → `close-todo`, `when-merges-note` → `remove-guard`, `feature-flag` → `retire-flag`, `class-string` → `rename-class`.

**Error identities added:** `closeout.capsule-invalid` (user, non-retryable, not_landed, exit 1) and the `closeout.step.<id>.failed` family row (user, non-retryable, not_landed, exit 1; slot validated against the effective step set).

**Result-contract addition:** projection class `attention` → exit 1, for data-bearing attention outcomes only.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | @spec-writer | Initial specification from the PM planning session (clarify_scope validated), ticket GH-240, the M1 closeout command page/contracts/J7/architecture/operator R8, the memory-architecture/lifecycle/telemetry/parallel-delivery concepts, and the delivered current-truth specs; capsule contract, event ownership, validation, candidate/promotion routing, diff sweep, human-thread policy, worktree cleanup, retro coverage, compaction checkpoint, telemetry wiring, residue/exit contract, and additive step growth pinned as DEC-1..DEC-16; zero blocking open questions |
| 1.1 | 2026-11-07 | @spec-writer | Consistency fixes from test-plan authoring; no scope, AC intent, DEC, NFR, or pinned vocabulary reshaped beyond the three items. **S-1:** removed the producer-less `scope-invalid` rejection reason; an out-of-set `scope` (or other required-field/closed-vocabulary violation) is now stated as a candidate schema failure → `closeout.capsule-invalid`, and the rejection set is pinned at eight. **S-2:** aligned F-3 and DEC-4 so closeout v1 performs no PM-notes completeness check (the delivered PM-notes lint/lifecycle own it) and fabricates no residue for it; only an unreadable review artifact is recorded as `review-verdict-unreadable` residue. **S-3:** pinned the failure-envelope rule in F-11 — a command-level failure returns the error envelope with no structured `residue[]`; the failed step's bounded evidence names the refused/preserved item, and the same residue is assertable in plan mode and the human diagnostic stream; adjusted AC-F7-2, AC-F11-1, NFR-2, DoD-7, DoD-11, and RSK-10 to match. |
| 1.2 | 2026-11-07 | @spec-writer | DoR iteration-1 blocking fixes; no AC/DEC/NFR intent or pinned vocabulary otherwise reshaped. **Finding 4:** enumerated the four merged-diff action tokens `remove-guard`, `retire-flag`, `rename-class`, `close-todo` in F-5/DM-6/OQ-1/RSK-5/Appendix C, and reconciled AC-F5-1 so only a marker naming this work item with a declared action resolves; an out-of-vocabulary action is `ambiguous-flip-hit` (negative case explicit). **Finding 5:** split the durable `capsule.promotion` payload (`id, class, decision, mode?, home?, reason?, supersedes?`) from the applied `capsule.candidates[]` projection (`{id, decision, home?, reason?}`) across F-3/F-4/EVT-2/DM-3/DM-5/AC-F4-2 and Appendix C. **Finding 6:** pinned pre-existing-target handling to the existing rejection set — byte-identical `satisfied` no-op, same-identity differing content `duplicate:<existing-id>`, conflicting different-identity statement `contradiction-requires-supersession`, no overwrite — in F-4/DEC-5/DEC-6/AC-F4-3/DoD-4. **Finding 7:** enumerated candidate `status` (`candidate`/`authoritative`/`superseded`) and the five evidence-link shapes (`review-verdict:`, `ci-verdict:`, `human-correction:`, `merged-pr:`, `test:`), with structural violations as `closeout.capsule-invalid` and missing/empty gate fields as `capture-bar-unmet`/`evidence-missing`, in F-4/DM-2/AC-F4-1/Appendix C. **Busy-lock nit:** contention is the retryable `state.lock.busy` identity, not `closeout.capsule-invalid`. Rejection set stays eight. |
| 1.3 | 2026-11-07 | @spec-writer | Two test-plan-derived under-specification fixes; no other semantics moved. **R-1:** pinned promotion path confinement — a candidate-supplied `id`/record-name outside the declared slug shape (including separators or `..`) is `closeout.capsule-invalid` before any write; a resolved home outside the injected memory root after realpath resolution (symlinked parent, absolute path, traversal) is `closeout.step.capsule.failed` with zero writes and plan-mode `would-refuse`, with no new error row — in F-4/AC-F4-1/AC-F4-2/F-11/AC-F11-2/§21/Appendix C/DoD-4. **R-2:** replaced inferred contradiction with the explicit `contradicts: <record-id>` declaration that must be paired with `supersedes: <record-id>` for the same target (otherwise `contradiction-requires-supersession`; unknown target `supersedes-unknown`), with exact normalized-statement dedup and no similarity/embedding/model judgment, in F-4/DM-2/DEC-5/DEC-6/AC-F4-1/AC-F4-3/Appendix C/DoD-4. Rejection set stays eight. |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-240 (goal, tasks, five AC, the telemetry-preservation and session-compaction pins), the PM planning session and `chg-GH-240-pm-notes.yaml` decisions (2026-11-07), the M1 closeout command page and contracts, journey J7, the M1 architecture learning plane and writer-ownership table, operator requirement R8, the memory-architecture capsule-completion section, the memory-lifecycle consolidation/routing/compaction sections, telemetry-and-events, parallel-delivery, AGENTS.md kernel memory rules, `.ai/memory/README.md`, and the delivered feature specs (closeout, harness adapters, state layer, retro pipeline, session database admin, result contract, merge/verify deploy) plus the delivered code seams read for contract truth.
- PM scope decisions are recorded as spec decisions (DEC-2, DEC-6, DEC-7, DEC-12, DEC-13) and, where the delivered surface differs from the decision's wording, as recorded refinements in Appendix A (the `db` attribution surface, the retro-registry read-only move, the promotion home/handoff split, and the data-bearing residue exit). No decision was silently diverged from.
- Tech-neutral by design: no module names, code file paths, or implementation steps; the plan writer derives placement from the delivered package tiers and boundary rules.
- Quantified NFRs reuse the delivered reference values (65,536-byte machine payload, 16,384-byte/200-line human output, 30 s operation timeout, one bounded read per source, `+N` truncation marks) so the change matches the system's established bounds discipline.
- The ticket's two pinned clarifications are preserved verbatim as decisions/capabilities: telemetry stays in the state-layer event log (DEC-13), and closeout triggers the compaction checkpoint with a bounded disclosure while the harness invocation remains a declared gap (DEC-12).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-240)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] Change-specific Definition of Done present (§17.1) — 20 done conditions binding every AC, every NFR, the §4.1 metrics, the gate battery, one lockstep changeset, the neighbor docs, and the PR posture
- [x] Ticket AC covered 1:1 with an explicit traceability line (AC 1 → AC-F1-1/AC-F3-1/AC-F4-2; AC 2 → AC-F4-1; AC 3 → AC-F5-1/AC-F6-1/AC-F7-1/AC-F8-1/AC-F11-1; AC 4 → AC-F10-1/AC-F10-2; AC 5 → AC-F12-2)
- [x] `NG-` non-goals and `[OUT]` rows name the owning stories (M2-S8, M2-S3, M3-S3, M3-S8, M3-S9, M1-S9, M1-S15, M1-S17, M1-S19)
- [x] NFRs include measurable values (counts, bytes, lines, percentages, budgets, zero-targets)
- [x] Risks include Impact & Probability (H/M/L) with mitigation and residual risk
- [x] Every AC is testable in Given/When/Then form; proxy-only proofs name their test-plan gap handoffs (GAP-C1..C6) without weakening the AC
- [x] Interfaces specify contracts without implementation directives; step order, event/candidate/residue vocabularies, routing, and error rows are pinned
- [x] Out-of-scope items prefixed `[OUT]` and name the owning stories explicitly
- [x] No implementation details (no code file paths, no step-by-step tasks, no git instructions)
- [x] Unresolved decisions: none blocking — five open-question rows (four delivery-data questions with pinned resolution mechanisms, and one resolved by DEC-6); all specification-time choices are pinned as DEC-1..DEC-16
- [x] Front matter validates per front_matter_rules
