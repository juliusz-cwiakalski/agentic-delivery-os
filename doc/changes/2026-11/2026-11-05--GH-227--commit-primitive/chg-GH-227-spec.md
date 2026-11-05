---
change:
  ref: GH-227
  type: feat
  status: Proposed
  slug: commit-primitive
  title: "M1-S14: Commit primitive and phase-transition commits"
  owners: [engineering]
  service: delivery-os
  labels: [m1, m1-s14, commit, cli, delivery-engine]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal: ["Result contract and error table (GH-172)", "Phase command family and pm-notes transitions (GH-179)", "Machine-readable delivery plan schema (GH-226)", "Provider engine (M0-S13)", "State layer", "Configuration layer", "Adapter ports and harness surface", "Branding seam", "Monorepo scaffold and toolchain tiers"]
    external: ["AI model provider APIs reachable through configured provider chains", "Harness CLI headless one-shot invocation", "Repository commitlint configuration (when present)"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Turn the commit act from an agent-managed subagent loop into a tool primitive — a `commit` command that computes a conventional commit from the working tree plus change context, and a default-on atomic record-plus-commit inside `phase complete` — so no agent iteration is spent hand-crafting commits and every phase transition lands as a conventional commit.

## 1. SUMMARY

M1-S14 makes committing a deterministic tool capability with exactly one constrained model call for the language parts. A new `commit` command collects tree state and change context, computes everything verifiable (ref, type candidate, staging set, exclusions, safety scans), produces the message through a transport seam (core-owned inference → harness one-shot → marked template fallback), validates it against the repository's commitlint configuration plus deterministic checks, and lands the commit with precise staging. `phase complete` gains atomic record-plus-commit **on by default** (`--no-commit` opts out per call; project configuration disables it), with idempotent re-run convergence and no empty commits. A telemetry event (commit SHA, message source, transport, token spend) is emitted for later spend reads (M1-S19, report-only now). The design follows the binding owner decisions recorded in the automated-commit concept; this spec does not re-derive them.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The commit act is agent-managed today: the `@committer` subagent loop performs 8–12 git round-trips with diff output echoing through context every turn — roughly 15–50k tokens per commit, plus dispatch overhead and latency from the calling session.
- The phase command family (`phase list` / `complete` / `reopen`) is the only schema-validated, idempotent write path for phase state (GH-179): a nine-row idempotency matrix, an append-only delivery-registry ledger over the state layer, and a derived phase-state projection. `phase complete` currently records the transition only; it creates no commit.
- The machine-readable delivery plan schema (GH-226) supplies per-phase declared scope, titles, and summaries — the highest-signal input for the commit skeleton.
- The provider engine (M0-S13) resolves a subscription-first provider chain with quota evaluation, parks, and classified announcements — the core-owned inference transport's availability source.
- The result contract (GH-172) provides the one envelope, the machine-readable error table with fail-closed documentation binding, and the `{0, 1, 2}` exit projection. Existing domains: `lint`, `state`, `verify`, `db`, `closeout`, `plan`, `watchdog`.
- The state layer provides append-only schema-versioned ledger records, verified reads, fences, and additive record kinds with payload schemas (precedent: `provider.park`, `provider.announcement`, `phase.transition`, `closeout.operation`).
- The configuration layer provides typed, layered, per-project-committed configuration with origin reporting.
- The seeded acceptance scenario SC-M1-12 pins the atomic default: ledger transition AND commit land together or neither; a stray untracked file stays unstaged; `--no-commit` records the transition alone.

### 2.2 Pain Points / Gaps

- Every commit costs an agent iteration: a large system prompt, a tool loop, and diff echoing — the mechanical majority of the spend (ref resolution, type, scope, staging, safety, the commit itself) buys nothing.
- Nothing enforces conventional-commit discipline on what lands: message shape, ref fidelity, and staging precision depend on the agent's care; stray untracked files can leak into commits.
- Phase transitions and their commits are two separate acts performed by different agents, so a transition can land without its commit and vice versa; there is no both-or-neither guarantee.
- There is no per-commit telemetry: message source (model vs template), transport, and token spend are invisible, so message quality and cost cannot be audited later.

## 3. PROBLEM STATEMENT

Because the commit act is agent-managed and phase transitions carry no commit, callers cannot land a precise, conventional, safety-scanned commit without spending agent tokens and iteration, and a ledger transition can land without the commit that documents it, resulting in high per-commit token cost, inconsistent commit discipline, possible stray-file leakage into history, and transition/commit divergence that a later auditor cannot reconcile.

## 4. GOALS

- **G-1**: Provide a `commit` tool primitive that computes a conventional commit message from uncommitted tree state plus change context — no agent authorship of the message or the staging set.
- **G-2**: Make atomic record-plus-commit the default for `phase complete`: the ledger transition and the commit land together or neither, with per-call (`--no-commit`) and per-project (configuration) opt-outs.
- **G-3**: Stage precisely and safely: never stage untracked strays, never stage forbidden paths, run the deterministic safety pass (secret scan on content and filenames, forbidden-path exclusions, binary size guard) before anything is staged, and STOP on suspicion.
- **G-4**: Generate the message with a deterministic skeleton plus exactly one constrained model call (subject; body only when it earns its place); everything verifiable is computed, never generated.
- **G-5**: Keep inference transports behind a seam tried in order — core-owned inference via the provider engine → harness one-shot in a temporary empty project context → marked template fallback — so delivery never stalls on a commit and the fallback is visible, not silent.
- **G-6**: Respect the repository's commitlint configuration (repo rules win), validate deterministically (ref matches the resolved ref, type in the allowed list, no invented refs), retry once with the lint error fed back, then fall back to the template.
- **G-7**: Make re-runs converge: after any interruption, a repeated invocation completes exactly the missing side, never creates an empty commit, and never appends a duplicate ledger record.
- **G-8**: Emit a per-commit telemetry event (commit SHA, message source, transport, token spend) that later spend reads (M1-S19) can consume; report-only in this change.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Agent token spend on the commit act | From ~15–50k per commit (subagent loop) to ~1–5k per commit via the direct transport; zero agent loop round-trips |
| Model calls per commit | Exactly one; zero when the tree is empty/fully excluded or the template fallback is taken |
| Subject length ≤ 72 characters | 100% of landed commits |
| Untracked strays staged | 0 across all landed commits |
| Empty commits created by `phase complete` | 0 (no pending work → transition-only; no-op completion → nothing) |
| Duplicate ledger records from re-runs | 0 |
| Atomicity violations (one side landed on a returned abort) | 0 on the clean-abort path; single-side states reachable only via hard interruption, and 100% convergent on re-run |
| Template share | Measurable and reportable per commit (no ceiling in this change) |

### 4.2 Non-Goals

- **NG-1**: Retiring or rewriting the `@committer` subagent and re-pointing every agent prompt — agent adoption is a separate change; this change ships the primitive.
- **NG-2**: Spend reporting, dashboards, template-share ceilings, or quality gates over `message-source` — M1-S19 consumes the events; this change emits them report-only.
- **NG-3**: MCP or other host-surface exposure of the commit primitive — the CLI command family is the v1 surface.
- **NG-4**: Push, PR creation, branch management, or any remote repository operation — the primitive lands local commits only.
- **NG-5**: Per-file-summary fan-out (the N+2 request shape), local/fine-tuned model lanes, and model-profile routing — parked research candidates and M2 work.
- **NG-6**: Rewriting history, amending commits other than the primitive's own interrupted attempt, or interactive message editing.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | `commit` command surface with `--dry-run` | A callable primitive replaces the agent loop; dry-run lets callers audit message and staging before anything lands. |
| F-2 | Deterministic context collection and skeleton | Ref, type candidate, scope, staging set, exclusions, and last-commit tone are computed facts; verifiable things are never generated. |
| F-3 | Constrained message generation and validation | One JSON-schema-constrained model call for subject/body/breaking; commitlint plus deterministic checks with one retry, then template. |
| F-4 | Inference transport seam with marked template fallback | Provider-keyed and subscription-auth environments both work; no-AI environments still land a commit, visibly marked. |
| F-5 | Precise staging and deterministic safety | The stray-leak and secret-leak guarantees are mechanical, never delegated to the model. |
| F-6 | Atomic phase completion (default on) | Transition and commit land together or neither; per-call and per-project opt-outs preserve caller control. |
| F-7 | Idempotency and re-run convergence | Interruptions converge; the nine-row matrix extends without empty commits or duplicate records. |
| F-8 | Commit telemetry event | Per-commit SHA, message source, transport, and token spend become durable evidence for spend reads. |

### 5.1 Capability Details

- **F-1 — `commit` command surface.** `<binary> commit <ref> [--phase <phase>] [--dry-run]` lands a conventional commit for the working tree's pending work, contextualized by the change ref. `--phase <phase>` selects phase-centric mode: the staging set is the completed phase's pending work within that phase's declared plan scope, and the invocation exercises the same atomic record-plus-commit primitive as `phase complete`. `--dry-run` prints the computed message and staging set (including what would be excluded) and changes nothing. `phase complete <ref> <phase> [--no-commit]` remains the transition-centric entry to the same atomic act. The command never runs inside a delivery session; callers (agents, scripts, humans) invoke it from outside.
- **F-2 — Deterministic context collection and skeleton.** The tool resolves the work item ref (branch, then change folder), reads the current phase from the verified ledger, reads the plan-phase declaration (title, declared scope, summary) when a plan artifact exists, collects repository status (porcelain, name-status, numstat), budget-capped diff hunks for the highest-signal changed files, and the last few commit subjects for tone. Generated noise (lockfiles, minified or vendored files) is removed deterministically before any model sees the bundle; over-cap files contribute metadata only. The skeleton computes: type candidate from a phase/type table (delivery → feat, review_fix → fix, docs sync → docs, with documented defaults across the canonical phase vocabulary), scope = the work item ref, breaking flag default false. Empty or fully-excluded pending work makes no model call at all.
- **F-3 — Constrained message generation and validation.** Exactly one model call carries the context bundle; its output is schema-constrained to `{subject, body?, breaking}` with low-temperature decoding and a hard output cap (subject ≤ 72 characters; body capped). The model may omit the body when the header explains the change to an auditor; it must include one when auditor-relevant content exists. Validation is commitlint (when the repository configures it; repo rules win) plus deterministic checks: the ref in the message matches the resolved ref, the type is in the allowed list, and no invented tracker references appear in subject or body (fabricated references are removed mechanically). One retry feeds the lint error back; a second failure falls back to the deterministic template `<type>(<ref>): <plan-phase summary or top-path summary>`. A template that still violates the repository's commitlint configuration aborts the commit (see `commit.commitlint-failed`).
- **F-4 — Inference transport seam.** The single model call runs behind a transport interface with two implementers, tried in order: (1) core-owned inference via the provider engine — a direct call when a provider route is available; (2) harness one-shot — the model invoked headlessly in a temporary empty project context so no delivery session or project context is loaded, reusing harness subscription auth where no plain key exists. Selection is configuration plus capability discovery, not hard-coded order alone; failover is classified in the emitted event. When neither transport is available (quota park, no credentials, provider outage), the deterministic template is used and the event records `message-source: template`. Delivery never stalls on a commit.
- **F-5 — Precise staging and deterministic safety.** The staging set is computed, never guessed: pending work from repository status, minus forbidden-path exclusions, minus strays. Untracked files are staged only when they fall inside the intended scope (the target phase's declared plan scope in phase-centric mode; the union of declared phases in standalone mode); untracked material outside any declared scope is a stray and is never staged, only disclosed. Tracked modifications are staged even outside declared scope — scope drift is disclosed in evidence, never silently dropped, and remains observable through the plan diff surface. The safety pass runs on the candidate staging set before any model transport is selected and before anything is staged: secret-pattern scan on content and filenames (STOP on suspicion, confirmed or not), forbidden-path exclusions, and a binary size guard (oversized binaries are never staged; if exclusion empties the staging set the commit is refused). If the safety pass itself cannot run, the commit is refused — safety is fail-closed.
- **F-6 — Atomic phase completion.** By default, `phase complete <ref> <phase>` performs the ledger transition and the conventional commit as one act: both land or neither lands. `--no-commit` records the transition alone. A typed configuration key disables the atomic commit per project. A completion with no pending work lands the transition alone with no commit object (no empty commit). A no-op completion (matrix row 2: already-completed) appends no record and creates no commit. An abort inside the atomic act restores both sides to neither-landed and returns a classified error; the re-run convergence protocol handles hard interruptions.
- **F-7 — Idempotency and re-run convergence.** The existing nine-row idempotency matrix is extended with the commit dimension. Every re-run evaluates the four-state delta over durable evidence — (ledger record landed?) × (commit landed?) — against the persisted transition record and the persisted commit telemetry event: neither landed → normal atomic path; record only → complete the missing commit from the phase's pending work, no new record; commit only → append the transition via the existing write path, no re-commit; both → no-op citing the existing completion, no commit. Which single-side states are reachable depends on the landing mechanism and is a delivery decision; the convergence semantics are total over all four states.
- **F-8 — Commit telemetry event.** Every landed commit (standalone, atomic, or reconciled) emits one telemetry event carrying: change ref, phase (when phase-centric), commit SHA, message source (`model` | `template`), transport used (direct | harness one-shot | none/template), token spend for the generation call (zero for template), and timestamps. The event rides the state layer as an additive record kind; emission is non-gating (a failed emission is disclosed in the result evidence and never fails the landed commit). M1-S19 spends reads consume these events later; nothing in this change reads them for control flow beyond convergence evidence.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Standalone commit (`commit <ref>`)
  Caller invokes `commit <ref>` outside any delivery session
    → session-context guard passes (refuses inside a delivery session)
    → resolve ref; read current phase from verified ledger; read plan-phase data
    → collect status + budget-capped diffs; strip generated noise
    → compute skeleton (type candidate, scope=ref); compute staging set
    → run deterministic safety pass (secrets, forbidden paths, binary guard)
        - suspicion → STOP: refuse, exit 1, human review required
    → select transport: core-owned inference → harness one-shot → template
    → one constrained model call (skipped for template or empty set)
    → validate (commitlint + deterministic checks) → retry once → template
    → stage precisely → create commit object → emit telemetry event
    → envelope: subject, stagedFiles, commitSha, messageSource, transport

Flow 2: Atomic phase completion (`phase complete <ref> <phase>`, default)
  Grammar + idempotency checks (nine-row matrix)
    → row 2 (already-completed) → no-op success; no record; no commit
    → open/reopened → compute the phase's pending work (declared scope ∩ tree)
    → no stageable pending work → transition lands alone; no commit; disclosed
    → stageable work → atomic act:
        stage precisely → safety pass → message (skeleton + one call / template)
        → commit object and ledger transition land together or neither
        → clean abort → both restored to neither-landed; exit 2; re-run converges
    → envelope: phase, state, atomic=true, commitSha

Flow 3: Opt-outs
  `phase complete <ref> <phase> --no-commit` → transition alone, no commit object
  project configuration disables the atomic commit → same as --no-commit

Flow 4: Interrupted re-run convergence
  Re-run `phase complete <ref> <phase>` after a hard interruption
    → read durable evidence: transition record + commit telemetry event
    → record only   → land the missing commit (staging rules apply); no new record
    → commit only   → land the missing transition via the write path; no re-commit
    → both          → no-op citing existing completion
    → neither       → normal atomic path
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `commit` command family: `commit <ref> [--phase <phase>] [--dry-run]` with result-contract envelopes, text output, and the `{0, 1, 2}` exit projection.
- Extension of `phase complete <ref> <phase>` with default-on atomic record-plus-commit, `--no-commit`, and the per-project configuration disable key.
- Deterministic context collection, skeleton (phase/type table, scope, breaking default), staging-set computation, and generated-noise filtering for the model bundle.
- Exactly one constrained message-generation call: `{subject, body?, breaking}` schema, low-temperature decoding, hard output cap, subject ≤ 72 characters.
- The inference transport seam with both implementers (core-owned inference via the provider engine; harness one-shot in a temporary empty project context) and the marked template fallback.
- Message validation: commitlint consultation (repo rules win), deterministic checks (ref fidelity, allowed type, invented-ref stripping), one retry with lint feedback, then template.
- The deterministic safety pass: secret scan on content and filenames with STOP on suspicion, forbidden-path exclusions, binary size guard, fail-closed scan unavailability.
- Idempotency matrix extension, four-state re-run convergence, empty-commit avoidance, and the clean-abort contract.
- One new `commit` domain kind in the error table with its rows, their documented counterparts, and the sync-check binding.
- One additive telemetry record kind on the state layer with payload schema, non-gating emission, and disclosure in result evidence.
- Golden/behaviour/structure/boundary test coverage per the workspace testing strategy, including SC-M1-12 as seeded scenario.

### 7.2 Out of Scope

- [OUT] Retiring or re-pointing the `@committer` subagent and other agent prompt changes (adoption is a separate change).
- [OUT] Spend reporting, dashboards, template-share ceilings or quality gates over `message-source` (M1-S19).
- [OUT] MCP or other host-surface exposure of the commit primitive.
- [OUT] Push, PR creation, branch cleanup, or any remote repository operation.
- [OUT] Per-file-summary fan-out request shape, local/fine-tuned model lanes, model-profile (`lite` class) routing.
- [OUT] Interactive message editing, commit amending beyond the primitive's own interrupted attempt, and history rewriting.
- [OUT] `--dry-run` on the `phase complete` surface (dry-run belongs to the `commit` surface in this change).

### 7.3 Deferred / Maybe-Later

- MCP/host-surface parity for the commit primitive once the CLI surface stabilizes.
- Template-share governance (per-change or per-fleet ceilings) once M1-S19 exposes real shares.
- Phase/type table overrides via project configuration (v1 ships core defaults).
- Local zero-API model lane riding the provider route's lite class (M2, model-profiles).
- Per-file-summary fan-out revisit if single-call message quality disappoints against real commits.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The interface surface is the CLI command family (envelopes under `--json`, human diagnostics otherwise, exit projection `{0, 1, 2}`).

| Invocation | Outcome | Exit |
|---|---|---|
| `commit <ref>` | Lands one computed conventional commit for the stageable pending work; envelope data per DM-2. | `0` committed or dry-run ok; `1` staging blocked, commitlint failure, safety STOP, session-context refusal; `2` platform faults |
| `commit <ref> --phase <phase>` | Atomic record-plus-commit for the completed phase's pending work (same primitive as `phase complete`); `atomic: true` in data. | as above; `2` atomic abort (neither landed) |
| `commit <ref> --dry-run` | Prints computed message and staging set (including exclusions); changes nothing; `dryRun: true` in data. | `0` |
| `phase complete <ref> <phase>` | Default-on atomic transition + commit; envelope data per DM-3. | `0` transitioned (with or without commit per pending work); `1` invalid phase, safety STOP, staging blocked, session-context refusal; `2` atomic abort, ledger unreachable |
| `phase complete <ref> <phase> --no-commit` | Records the transition alone; no commit object is created. | `0` |

Command names and flag shapes follow the proposed M1 pack contracts; refinements at delivery are permitted and must be recorded against this spec (see §15, DEC-14).

### 8.2 Events / Messages

| ID | Event | Contract |
|----|-------|----------|
| EVT-1 | Commit telemetry event | One additive state-layer record kind per landed commit, payload schema `delivery.commit.telemetry.v1` (DM-1), appended through the state port, verified reads only. Carries ref, phase, commit SHA, message source, transport, token spend, timestamps. Non-gating: emission failure is disclosed in result evidence and never fails the landed commit. Report-only in this change; M1-S19 consumes later. No derived projection document ships in this change. |
| — | Phase transition record | Unchanged: one `phase.transition` ledger record per landing, per the existing registry contract. Atomic completions append exactly one record exactly once (convergence forbids duplicates). |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Commit telemetry record payload | `delivery.commit.telemetry.v1`: change ref, phase id (when phase-centric), commit SHA, message source (`model` \| `template`), transport (`core-inference` \| `harness-one-shot` \| `none`), token spend (input/output counts; zero for template), landed-at timestamp, and the transition identity when the commit belongs to an atomic completion. Metadata only — never message body content, diff content, or secret material. |
| DM-2 | `commit` envelope success data | `subject`, `body` (present only when produced), `stagedFiles`, `excluded` (forbidden/stray/noise disclosures, including `untrackedNotStaged`), `commitSha`, `messageSource`, `transport`, `atomic` (true in `--phase` mode), `ledgerTransition` (when atomic), `dryRun` (when dry-run). Shape refinement at delivery is recorded against the pack page. |
| DM-3 | `phase complete` envelope success data extension | Existing fields (`phase`, `state`, `reason`, `commitSha`, `atomic`) plus `commitSkipped` basis when no commit was created (`no-pending-work` | `disabled` | `opted-out` | `no-op`) and reconciliation evidence when a re-run completed a missing side. |
| DM-4 | Error table additions | One new `commit` domain kind with six rows (below), added to the declared domain kinds, the machine-readable table, the documented table, and the sync-check binding in the same change. |

New error rows (all under the `commit` domain kind; exact-code classification like other multi-row kinds):

| Code | Category | Retryable | Consequence | Projection | Fires when |
|------|----------|-----------|-------------|------------|------------|
| `commit.staging-blocked-untracked` | user | false | not_landed | user-validation (1) | The computed staging set is empty because the pending work is entirely stray, forbidden-path, or excluded material — nothing stageable remains while a commit was requested. |
| `commit.commitlint-failed` | user | false | not_landed | user-validation (1) | Neither the retried model message nor the deterministic template satisfies the repository's commitlint configuration and the deterministic checks; nothing staged or committed. |
| `commit.safety.secret-suspected` | user | false | not_landed | user-validation (1) | STOP classification: the secret scan flagged staged content or a filename on suspicion; the operation refuses, names the finding class without leaking the material, and requires human review. Never retried blindly. |
| `commit.safety.scan-unavailable` | platform | true | not_landed | platform-provider (2) | The deterministic safety pass could not run; fail-closed — nothing is staged or committed until the scan executes. |
| `commit.atomic-abort` | platform | true | not_landed | platform-provider (2) | The commit act failed during an atomic completion; the clean-abort contract restored both sides to neither-landed; a re-run converges via the normal path. |
| `commit.session.context-refused` | user | false | not_landed | user-validation (1) | The commit primitive was invoked inside a delivery session; it refuses and the caller must invoke it from outside. |

Template fallback is not a failure identity: a template commit is a success (`exit 0`) whose envelope data and telemetry event carry `messageSource: template` (see DEC-10).

### 8.4 External Integrations

- **AI model providers** (via the provider engine): the core-owned inference transport sends the budget-capped context bundle through a configured provider route; provider-side quota, park, and announcement semantics govern availability. Only content that passed the deterministic safety scan enters the bundle.
- **Harness one-shot**: the model is invoked headlessly in a temporary empty project context; no delivery session or project context is loaded into that invocation. Whether this rides a dedicated headless session mode or a CLI-level invocation is a delivery-planning decision (OQ-1).
- **Repository commitlint configuration**: consulted when present; repo rules win. Absent configuration degrades to the deterministic checks only.
- **Git**: local commit-object creation and staging only (no push, no remote operations).

### 8.5 Backward Compatibility

- `phase complete` behavior changes by default: it now also lands a commit. Callers needing the old transition-only semantics pass `--no-commit` or set the project configuration disable. This is the headline behavioral change and must be flagged in the PR description.
- Envelope evolution is additive within `schemaVersion`: existing `phase complete` fields keep their meaning; new fields are additions. No breaking envelope change.
- `phase complete` gains new failure modes (commit-side): callers that assumed transition-only must now handle `commit.*` identities on that command. Exit codes remain within `{0, 1, 2}`.
- The `phase` command family's grammar, matrix semantics, advisory vocabulary, and registry records are unchanged; the commit dimension is an extension, not a rewrite.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Model-call economy: exactly one model call per commit attempt; zero calls when pending work is empty/fully excluded or the template fallback is taken; total token spend per commit via the direct transport stays in the target band | 1 call; ~1–5k tokens typical (hard ceiling 8k input budget as shipped default; validated against real commits during delivery) |
| NFR-2 | Constrained output: JSON-schema shape `{subject, body?, breaking}`, low-temperature decoding, hard output cap | Subject ≤ 72 characters on 100% of landed commits; body capped at the schema-sized cap |
| NFR-3 | Latency: dry-run and template-fallback paths stay fast; model-transport bound accommodates the provider call | Dry-run ≤ 2 s p95; template-fallback commit ≤ 5 s p95; model-transport commit ≤ 30 s p95 |
| NFR-4 | Determinism: identical tree state, context, and injected dependencies yield identical dry-run output (message source may vary only by transport availability, which is injected fact) | Byte-identical dry-run envelopes for fixed injected dependencies |
| NFR-5 | Purity and tiers: contracts stay data-only; domain logic runtime-neutral; runtime/I/O access only at the allowed edges; time, randomness, environment, and I/O injected | Zero ambient reads in contracts/domain; boundary checks green |
| NFR-6 | Atomicity and convergence: no empty commits, no duplicate records, convergence total over the four (record, commit) landed-states | 0 violations across the matrix and convergence test corpus |
| NFR-7 | Fail-closed safety: nothing is staged or committed unless the full deterministic safety pass completed successfully | 100% of landed commits have a completed safety pass on record (telemetry evidence) |
| NFR-8 | Branding: no hardcoded product or binary name anywhere in delivered modules or docs use the injected identity | Forbidden-literal scan green |
| NFR-9 | Machine output validity: every outcome under `--json` is exactly one valid envelope per the result contract, on success, classified failure, containment, and broken invocation | Envelope conformance validator green on all new golden cases |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- EVT-1 is the observability payload: one event per landed commit with SHA, message source, transport, and token spend — enough for M1-S19 to report per-commit and aggregate spend and template share without re-reading git history.
- The envelope discloses the same facts (`messageSource`, `transport`) plus staging evidence (`excluded` lists), so a single invocation is auditable without tooling.
- Reconciliation evidence (Flow 4) is disclosed in the envelope when a re-run completed a missing side, so convergence is visible, not silent.
- Emission failures are disclosed in result evidence and diagnostics; they never fail the landed commit (non-gating), and no new error row exists for them.
- No dashboards, alerts, or spend projections in this change (M1-S19; NG-2).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Model produces a plausible-but-wrong message (fabricated tracker refs, off-list types, over-length subjects) | M | M | Deterministic skeleton owns type/scope/ref; schema-constrained decoding with hard cap; deterministic validation strips invented refs; one retry; template fallback; message source recorded | Template share carries the quality floor; auditable per event |
| RSK-2 | Atomicity defect lands one side without the other (ledger/commit divergence) | H | L | Clean-abort contract restores neither-landed; four-state convergence against durable evidence (transition record + telemetry event); verified ledger reads; matrix + convergence corpus tests | Hard interruption in an untested window leaves a single-side state; re-run converges it |
| RSK-3 | Secret reaches a commit or a provider bundle undetected | H | L | Scan on content and filenames before staging and before transport selection; STOP on suspicion; bundle built only from scanned content; fail-closed scan unavailability | Unknown secret patterns are not detected; human review remains the STOP backstop |
| RSK-4 | No inference transport available (quota park, no credentials, provider outage) and message quality drops | L | M | Deterministic template fallback keeps delivery unblocked; fallback visibly marked (`messageSource: template`); report-only share measurement feeds later governance | Template messages are blander; delivery is never stalled |
| RSK-5 | Harness one-shot transport is slow or costly (session bootstrap) | L | M | Tried only after the direct transport; selection is configuration plus capability discovery; classified in the emitted event | Bootstrap cost recurs per commit until a headless mode is tuned (OQ-1) |
| RSK-6 | Diff budget defaults mis-sized (too large wastes tokens; too small starves quality) | M | M | Evidence-based shipped defaults (total input ≤ 8k, per-file cap with name-status fallback, top-N files fully diffed); validated against real repository commits during delivery; treated as tunable data | Budgets may need one tuning pass after real-world validation |
| RSK-7 | Empty-commit or duplicate-record regressions against the nine-row matrix | M | L | Matrix extension tests; no-op completions append nothing and create nothing; convergence forbids duplicates | Low after corpus coverage |
| RSK-8 | Repository commitlint configurations reject the template shape (unusual configs) | M | L | Repo rules win: the table only proposes candidates; a template that fails repo validation aborts cleanly (`commit.commitlint-failed`, nothing lands) with a corrective remediation hint | Change cannot commit until type table or repo config is reconciled — loud, not silent |

## 12. ASSUMPTIONS

- The invoking repository is a local git worktree where staging and commit-object creation are possible; the primitive never pushes.
- Delivery sessions inject detectable session-context facts at the runtime edge, making the never-inside-a-session guard mechanically enforceable.
- A plan artifact (`chg-<ref>-plan.yaml`) exists for plan-scoped staging in phase-centric mode; when absent, phase-centric mode stages tracked pending work with untracked-outside-scope exclusion still enforced, and the degraded scope source is disclosed.
- The provider engine is configured per project; a fresh install with no declared chain has no direct transport, and the seam degrades to template fallback without stalling delivery.
- Commitlint configuration, when present, is discoverable from the repository root; the type table's candidates are a subset of conventional types and repo rules may narrow them.
- The harness adapter surface can perform a headless one-shot invocation in a temporary empty project context.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Result contract and error table (GH-172) | Envelope, error-table binding and sync check, exit projection, redaction chokepoint |
| Depends on | Phase command family (GH-179) | The `phase complete` write path, nine-row matrix, registry ledger being extended |
| Depends on | Machine-readable plan schema (GH-226) | Per-phase declared scope and summaries — the skeleton's highest-signal input |
| Depends on | Provider engine (M0-S13) | Core-owned inference transport availability, quota/park states that trigger fallback |
| Depends on | State layer | Ledger substrate for the transition record, verified reads, fences, and the additive telemetry record kind |
| Depends on | Configuration layer | Typed per-project disable key with origin reporting |
| Depends on | Adapter ports and harness surface | Repository status/diff reads, staging/commit execution, headless one-shot transport |
| Depends on | Branding seam | Injected binary/product identity; no hardcoded names |
| Depends on | Monorepo tiers (ADR-0003) | Contracts data-only, domain purity, runtime confinement, boundary matrix updates with negative fixtures |
| Blocks | M1-S19 spend reads | Consume EVT-1 events for per-commit and aggregate spend and template share |
| Blocks (soft) | Agent adoption change | Agents re-point from `@committer` loops to the primitive once delivered |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Does the harness one-shot transport need a dedicated headless session mode, or does a CLI-level invocation in a temporary empty project context suffice? | Concept leaves the mechanism open; both satisfy the contract (no delivery session or project context loaded). | Deferred — resolvable at delivery planning without owner input; record the choice against this spec. |
| OQ-2 | When should template-share governance (ceilings, quality gates) be introduced, and at which scope (per change, per fleet)? | Concept decision: start report-only; M1-S19 owns the reads. | Deferred to M1-S19 planning. |

No blocking open questions: all PM-flagged edge cases are resolved in-spec (§5.1, §8.2–8.4, §15) and all concept-stage questions are either resolved as decisions (DEC-11, DEC-12) or deferred above.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Atomic record-plus-commit is default-on for `phase complete`; `--no-commit` opts out per call; a typed configuration key disables per project; both land or neither | Binding owner decision, automated-commit concept (2026-11-03); restated, not re-derived | 2026-11-05 |
| DEC-2 | Deterministic skeleton + exactly one constrained model call for `{subject, body?, breaking}`; temperature ≤ 0.1; hard output cap; subject ≤ 72 chars; everything verifiable computed | Binding owner decision, automated-commit concept | 2026-11-05 |
| DEC-3 | Transports behind a seam, tried in order: core-owned inference (provider engine) → harness one-shot (temporary empty project context) → marked template fallback; failover classified in the event | Binding owner decision, automated-commit concept | 2026-11-05 |
| DEC-4 | Validation = commitlint (repo rules win) + deterministic checks (ref matches, allowed type, no invented refs); one retry with lint error fed back; then template; a template that still fails repo validation aborts with `commit.commitlint-failed` | Derived from pinned validation policy; the abort case keeps "repo rules win" honest without stalling delivery silently | 2026-11-05 |
| DEC-5 | Safety is never AI; secret-scan suspicion STOPs the operation as a user-category identity (`commit.safety.secret-suspected`, exit 1, no blind retry); scan unavailability fails closed as platform (`commit.safety.scan-unavailable`, exit 2); forbidden paths are excluded (not errors) and disclosed | Resolves the pinned STOP policy + PM exit-taxonomy edge case: caller-remediable content issues project to exit 1; platform faults to exit 2 | 2026-11-05 |
| DEC-6 | "Never runs inside a delivery session" is enforced mechanically: the edge-injected delivery-session context facts are checked at invocation, and a detection refuses with `commit.session.context-refused` (exit 1); the harness one-shot's empty project context is not a delivery session | Resolves pinned guardrail #6 with a mechanical detection rather than a documentation-only rule | 2026-11-05 |
| DEC-7 | Re-run convergence is a four-state delta over durable evidence — (ledger record landed) × (commit landed) — read from the transition record and the telemetry event: neither → atomic path; record only → complete the commit, no new record; commit only → append the record, no re-commit; both → no-op, no commit. Total over all four states regardless of which single-side states the landing mechanism can produce | Resolves the PM convergence edge case precisely against the atomicity guarantee | 2026-11-05 |
| DEC-8 | Empty commits never happen: a completion with no stageable pending work lands the transition alone (disclosed basis); a no-op completion (matrix row 2) appends no record and creates no commit | Resolves the PM matrix-interaction and no-pending-work edge cases; no-op must not manufacture a commit | 2026-11-05 |
| DEC-9 | The telemetry event is an additive state-layer record kind (`delivery.commit.telemetry.v1`), appended via the state port, non-gating (emission failure disclosed, never fails the landed commit), report-only in this change, no derived projection yet | Resolves the PM telemetry-target edge case using the provider-record precedent; M1-S19 adds reads later | 2026-11-05 |
| DEC-10 | Error-table additions: one new `commit` domain kind, six rows (DM-4). Two refinements vs the M1 pack page: `commit.atomic-abort` projects platform-provider (exit 2) rather than the proposed exit 1, because an abort is a platform-side fault under the user-vs-platform taxonomy; `commit.model-unavailable-template-fallback` is realized as marked success evidence (`messageSource: template` in data + event) rather than a failure row, because a landed fallback commit is not a failure and every table row must project a failure class | Keeps the error table total, honest about consequence, and sync-check clean | 2026-11-05 |
| DEC-11 | The phase/type table ships as core defaults covering the canonical phase vocabulary (concept-named pairs pinned: delivery → feat, review_fix → fix, docs sync → docs; documented defaults for the remainder), with configuration-driven overrides deferred | Resolves the concept's table-location question minimally; overrides are §7.3 | 2026-11-05 |
| DEC-12 | Diff-budget numbers ship as the concept's evidence-based defaults (total input ≤ 8k tokens, per-file cap with name-status fallback for over-cap files, top-N files fully diffed) and are validated against real repository commits during delivery; budgets are tunable data, not code constants | Resolves the concept's budget question by shipping defaults with in-story validation | 2026-11-05 |
| DEC-13 | Configuration key `commit.phaseCommit` (boolean, default `true`) disables the atomic commit per project; `--no-commit` opts out per call; no per-call force-override of a project-level disable exists in this change | Per-call flags may relax a default, not override an explicit project policy; keeps semantics minimal (exact key name refinable at delivery, recorded) | 2026-11-05 |
| DEC-14 | Command shapes follow the M1 pack proposals (`commit <ref> [--phase <phase>] [--dry-run]`; `phase complete <ref> <phase> [--no-commit]`); `commit --phase` and `phase complete` exercise the same atomic primitive; envelope shapes per DM-2/DM-3 with delivery-time refinements permitted and recorded | Honors the proposed contracts while allowing shape refinement against the delivered envelope conventions | 2026-11-05 |
| DEC-15 | Staging precision contract: tracked pending work is staged even outside declared scope (drift disclosed in evidence, observable via plan diff); untracked files are staged only inside the declared scope; untracked outside scope are strays and never staged | Satisfies the stray guarantee without silently dropping tracked work or blocking declared new files (which are untracked until first commit) | 2026-11-05 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts | New — commit domain contracts: skeleton types, staging-set types, telemetry record payload schema, envelope data shapes, error-table rows and `commit` domain kind (data-only) |
| Core domain | New — pure skeleton computation, staging-set computation, validation rules, convergence delta classification, transport port |
| Provider/inference integration | Extended — core-owned inference transport behind the seam, consuming provider-engine availability |
| Adapters (repository/host/session edges) | Extended — repository status/diff reads, staging and commit-object execution, headless harness one-shot transport, safety-scan execution at an I/O edge |
| CLI command surface | New `commit` command; extended `phase complete` with atomic default, `--no-commit`, and commit-side failure modes; session-context guard at the edge |
| Configuration catalog | New typed `commit` branch with the per-project disable key (DEC-13) |
| Error table (machine + documented) | Extended — six `commit` rows plus the domain kind, synced in the same change |
| State layer vocabulary | Extended — one additive record kind (`commit.telemetry`) with payload schema; no projection document |
| Testkit and fixtures | Extended — envelope golden cases, convergence and matrix corpora, transport fakes |
| Documentation | New feature spec for the commit primitive; reconciliation of the phase-transitions feature spec; M1 pack pages (commit/phase) refined from planned-proposal to delivered behavior; error table doc rows |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a work tree with pending work for a change ref, **when** `commit <ref>` runs outside a delivery session, **then** the landed commit's message derives from the tree state plus change context (resolved ref, current phase, plan-phase data) with no agent authorship of subject, body, or staging set. | F-1, F-2, F-3 |
| AC-F1-2 | **Given** any tree state, **when** `commit <ref> --dry-run` runs, **then** the computed message and staging set (including `untrackedNotStaged` and exclusion disclosures) are printed and no file is staged, no commit is created, and no ledger record is appended. | F-1, NFR-4 |
| AC-F1-3 | **Given** the primitive is invoked from inside a delivery session (session-context facts present at the edge), **when** any commit-capable invocation runs, **then** it refuses with `commit.session.context-refused`, exit 1, nothing staged or committed, and the remediation directs the caller to invoke from outside. | F-1, DM-4 |
| AC-F3-1 | **Given** stageable pending work and an available transport, **when** the message is generated, **then** exactly one model call is made, its output conforms to `{subject, body?, breaking}`, the subject is ≤ 72 characters, decoding is temperature ≤ 0.1 with a hard output cap, and no model call is made when the staging set is empty or fully excluded. | F-3, NFR-1, NFR-2 |
| AC-F3-2 | **Given** a model message containing an invented tracker reference or an off-list type, **when** validation runs, **then** the deterministic checks fail the message, one retry is attempted with the lint error fed back, and a second failure falls back to the deterministic template marked `messageSource: template`. | F-3, DEC-4 |
| AC-F3-3 | **Given** a repository whose commitlint configuration forbids the template's shape, **when** the template fallback is produced, **then** the commit aborts with `commit.commitlint-failed`, exit 1, and nothing is staged or committed. | F-3, DM-4 |
| AC-F4-1 | **Given** a configured provider route, **when** the transport seam selects, **then** core-owned inference is tried first, the harness one-shot second (headlessly, in a temporary empty project context), and the template last, with the transport used and any failover classified in the emitted event. | F-4, EVT-1 |
| AC-F4-2 | **Given** no inference transport is available (quota park, missing credentials, provider outage), **when** a commit is requested, **then** the deterministic template commit lands, the event carries `messageSource: template`, and delivery is not stalled. | F-4, G-5 |
| AC-F5-1 | **Given** pending work plus one untracked stray file outside any declared scope, **when** the staging set is computed, **then** the stray is never staged and is disclosed as unstaged in the result evidence. | F-5, DEC-15 |
| AC-F5-2 | **Given** candidate staging content containing a secret-scan-suspicious pattern (content or filename), **when** the safety pass runs, **then** the operation STOPs with `commit.safety.secret-suspected`, exit 1, nothing staged or committed, no secret material in any output, and human review required. | F-5, DM-4, NFR-7 |
| AC-F5-3 | **Given** pending work under forbidden paths or an oversized binary, **when** the staging set is computed, **then** those paths are excluded and disclosed, and if exclusion empties the staging set the commit is refused with `commit.staging-blocked-untracked` (exit 1). | F-5, DM-4 |
| AC-F5-4 | **Given** the safety pass cannot execute, **when** a commit is requested, **then** the operation fails closed with `commit.safety.scan-unavailable`, exit 2, and nothing is staged or committed. | F-5, NFR-7 |
| AC-F6-1 | **Given** GH-310 phase delivery has pending work and one untracked stray file (SC-M1-12), **when** `phase complete GH-310 delivery` runs, **then** the ledger transition AND the conventional commit land — both or neither — with the computed subject, and the stray file remains untracked in status. | F-6, F-5, G-2 |
| AC-F6-2 | **Given** the same SC-M1-12 tree, **when** `phase complete GH-310 delivery --no-commit` runs, **then** the transition alone is recorded and no commit object is created. | F-6, G-2 |
| AC-F6-3 | **Given** a completion whose target phase has no stageable pending work, **when** `phase complete` runs, **then** the transition lands alone with a disclosed `commitSkipped` basis and no empty commit is created. | F-6, F-7, DEC-8 |
| AC-F6-4 | **Given** project configuration disabling the atomic commit, **when** `phase complete` runs without `--no-commit`, **then** the transition lands alone and the evidence discloses the configuration as the basis. | F-6, DEC-13 |
| AC-F6-5 | **Given** a platform fault in the commit act during an atomic completion, **when** the abort is returned, **then** both sides are restored to neither-landed, `commit.atomic-abort` projects exit 2 with `not_landed`, and a re-run converges via the normal atomic path. | F-6, F-7, DM-4 |
| AC-F7-1 | **Given** a hard interruption that landed the ledger record but not the commit, **when** `phase complete` re-runs, **then** the missing commit is completed from the phase's pending work, no new ledger record is appended, and the reconciliation is disclosed. | F-7, DEC-7 |
| AC-F7-2 | **Given** a hard interruption that landed the commit but not the ledger record, **when** `phase complete` re-runs, **then** the transition is appended via the existing write path, the commit is not repeated, and no empty commit is created. | F-7, DEC-7 |
| AC-F7-3 | **Given** a phase already completed with both record and commit landed (matrix row 2), **when** `phase complete` re-runs, **then** the outcome is a no-op success citing the existing completion, with no ledger record and no commit. | F-7, F-6, DEC-8 |
| AC-F8-1 | **Given** any landed commit (standalone, atomic, or reconciled), **when** it lands, **then** exactly one telemetry event is emitted carrying ref, phase, commit SHA, message source, transport, token spend (zero for template), and — for atomic completions — the transition identity; emission failure is disclosed without failing the commit. | F-8, EVT-1, DM-1 |
| AC-NFR9-1 | **Given** any outcome of the new surfaces under `--json` (success, template fallback, classified failure, containment, broken invocation), **when** the envelope is emitted, **then** it is exactly one valid result-contract envelope with the projected exit code in `{0, 1, 2}`. | F-1, NFR-9 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single change delivered on `feat/GH-227/commit-primitive`, PR targeting `main-tools`, per the branch model.
- The default-on behavior change for `phase complete` is the headline: the PR description must call out that transitions now land commits by default and how to opt out (`--no-commit`, configuration key).
- No data migration: the telemetry record kind is additive to the existing state schema; existing ledgers, projections, and change artifacts are untouched.
- Agent adoption (re-pointing `@committer`-style flows to the primitive) is a follow-up change; this change ships and documents the primitive.
- Documentation updates land in the same change: new feature spec, reconciliation of the phase-transitions feature spec, refined M1 pack pages, and the six new documented error rows (sync-check bound).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The only durable additions are new ledger records (telemetry events) and new transitions/commits produced by normal use; no existing record, projection, or document is rewritten or migrated.

## 20. PRIVACY / COMPLIANCE REVIEW

- Context bundles sent to a model transport contain working-tree content (diff hunks, filenames, summaries). Ordering requirement: the deterministic safety pass runs **before** transport selection and bundle construction, so secret-suspicious material never reaches a provider or the harness one-shot. Generated noise is stripped deterministically before any model sees the bundle.
- The harness one-shot runs in a temporary empty project context so no project files beyond the bundle are loaded.
- Telemetry payloads are metadata only (SHA, counts, spend, identities) — never message bodies, diff content, or secret material; the serialization redaction chokepoint covers envelope and diagnostics as today.
- Diff budgets bound what any single transport call can carry (total input ≤ 8k shipped default).

## 21. SECURITY REVIEW HIGHLIGHTS

- Safety is never AI: secret scan (content + filenames), forbidden-path exclusions (`tmp/`, `.ai/local/` among them), and the binary size guard are deterministic and run before staging; the model never approves or performs safety decisions.
- STOP on suspicion: a scan hit refuses the operation even without confirmation; the identity names the finding class without leaking the material; retryable is false so agents cannot blind-retry.
- Fail-closed: if the safety pass cannot run, nothing is staged or committed (`commit.safety.scan-unavailable`).
- Ref fidelity: the deterministic layer strips fabricated tracker references and rejects off-list types, preventing message-level injection of false provenance.
- No new secrets or credentials are introduced; provider credentials ride the existing credential-port resolution; outputs pass the existing redaction chokepoint.

## 22. MAINTENANCE & OPERATIONS IMPACT

- New error rows must stay sync-bound with the machine table; the documented table in the result-contract spec gains the six `commit` rows in the same change.
- The transport seam is the extension point for future lanes (local models, profile routing); new transports must classify themselves in the telemetry event.
- Diff budgets and the phase/type table are data with documented defaults; tuning is expected after real-world validation and is a data change, not a behavior change.
- Project configuration gains one typed key; `config debug`-style origin reporting applies as usual.
- Operators gain a new diagnostic surface: template share and transport failover are readable from telemetry events, making silent degradation visible.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Commit primitive | The tool capability (`commit` command + atomic phase completion) that computes and lands conventional commits without agent authorship. |
| Skeleton | The deterministic part of the message: ref, type candidate, scope, breaking default — computed, never generated. |
| Flesh | The language part produced by exactly one constrained model call: subject, optional body, breaking flag. |
| Transport | An implementer of the inference seam: core-owned inference (provider engine) or harness one-shot; selection is configuration plus capability discovery. |
| Template fallback | The deterministic message `<type>(<ref>): <plan-phase summary or top-path summary>` used when no transport is available or validation exhausts; visibly marked `messageSource: template`. |
| Message source | `model` or `template` — recorded in the envelope and the telemetry event for auditability. |
| Staging set | The computed set of paths to stage: pending work minus forbidden paths minus strays; tracked work is staged (drift disclosed), untracked work only inside declared scope. |
| Stray | An untracked file outside any declared scope; never staged, only disclosed. |
| Atomic completion | A `phase complete` that lands the ledger transition and the commit together or neither, by default. |
| Convergence | The four-state re-run delta over durable evidence that completes exactly the missing side of (record, commit). |
| Clean abort | An atomic act that fails returned-to-caller with both sides restored to neither-landed (`not_landed`). |
| Phase/type table | Core-default mapping from lifecycle phase to conventional commit type (delivery → feat, review_fix → fix, docs sync → docs, …). |
| STOP classification | A safety refusal that halts the operation and requires human review; content issues project user (exit 1), platform faults project exit 2. |

## 24. APPENDICES

### Appendix A: seeded scenario mapping

SC-M1-12 (atomic phase completion is the default) maps to AC-F6-1, AC-F6-2, AC-F5-1 and Flow 2. Divergence of the delivered behavior from SC-M1-12 after delivery is a defect.

### Appendix B: idempotency matrix × commit dimension

| Prior state | Pending work | Outcome |
|---|---|---|
| open, record not landed | stageable | Atomic: record + commit land together (default) |
| open, record not landed | none | Transition alone; no commit; disclosed basis |
| completed (record + commit landed) | — | No-op; no record; no commit (matrix row 2) |
| completed (record landed, commit missing — interruption) | phase work dirty | Converge: land the commit; no new record |
| completed (commit landed, record missing — interruption) | clean | Converge: append the record; no re-commit |
| reopened | stageable | Re-completion lands a new record + commit atomically |

The matrix's grammar, advisory, and reopen semantics are unchanged; only the commit dimension is added.

### Appendix C: source documents

- Binding design policy: the automated-commit concept with owner decisions recorded 2026-11-03.
- Proposed command contracts: M1 pack pages for `commit` and `phase`.
- Seeded scenario: SC-M1-12 in the M1 test scenarios.
- Consumed contracts: result contract and error table, phase transitions feature, plan schema, state layer, provider engine, configuration layer.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | spec-writer | Initial specification from GH-227 planning context, the binding automated-commit design policy, M1 pack proposals, and the PM clarify_scope edge-case resolutions. |

---

## AUTHORING GUIDELINES

- Sources: the GH-227 ticket requirements (as relayed by planning), the binding owner decisions in the automated-commit concept (restated, never re-derived), the M1 pack command proposals, SC-M1-12, and the delivered feature specs for the result contract, phase transitions, plan schema, state layer, provider engine, and configuration layer.
- The six PM-flagged edge cases are resolved in-spec (DEC-5 through DEC-10, DEC-13, DEC-15) rather than deferred to open questions, per planning guidance.
- Two deliberate refinements vs the M1 pack proposals are recorded in DEC-10 (atomic-abort exit projection; template fallback as evidence rather than a failure row) and DEC-15 (staging precision contract for tracked scope drift and declared new files). Envelope and flag shapes remain refinable at delivery with recorded deltas (DEC-14).
- The spec is tech-neutral: no file-level paths, no implementation steps, no code. Landing-mechanism choices (ordering, journaling, rollback mechanics) belong to the delivery plan.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-227)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, EVT-, OQ-, G-, NG-)
- [x] Acceptance criteria reference at least one F-/EVT-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated wholesale from linked docs (pinned decisions restated, not re-derived)
- [x] Front matter validates per front_matter_rules
