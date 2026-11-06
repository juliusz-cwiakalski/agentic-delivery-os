---
change:
  ref: GH-225
  type: feat
  status: Proposed
  slug: merge-verify-deploy
  title: "M1-S4: Merge and verify-deploy engine"
  owners: [engineering]
  service: delivery-os
  labels: [m1, merge, deploy-verification, gates]
  version_impact: minor
  audience: internal
  security_impact: high
  risk_level: high
  dependencies:
    internal:
      - "Verify gates battery (M0-S9, GH-178, delivered) — the five-gate cited evaluation this change makes config-declared, versioned, and recording"
      - "Configuration layer (M0-S4, GH-173, delivered) — the typed catalog branch that carries merge.gate-freshness and the declared gate set"
      - "State layer — append-only ledger, single-writer fences, verified reads, verified-empty, additive record kinds for verification-recency, waiver, and transaction-outcome records"
      - "Result contract and error table — CommandResult envelope, declared failure identities including the family-row mechanism, exit projection, redaction chokepoint, error-table sync guard"
      - "Owner-gate SLA (GH-229, delivered) — PDR-0003 two-row gate-kind/class policy map, gate-kind vocabulary, board gate facts; this change reconciles the classification and flips the v0 inertness boundary (GAP-9)"
      - "Commit primitive — the atomic land-and-record pattern and abort-convergence precedent for the squash landing"
      - "Command audit ledger (M1-S22, delivered) — per-invocation audit trail; scripted agent-mode trim is active for the new commands"
      - "Branding seam — binary name from configuration, no product literals"
    external:
      - "GitHub tracker (normalized work items per ADR-0004) — work-item reads and the provider-resolved repository owner principal"
      - "GitHub CI (Actions) — check-run pages and the bounded deploy-job execution trace (steps executed, artifacts produced)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make merging a verified transaction — full gate set fresh at the moment of landing, squash landing itself verified, every refusal naming its gate with inline evidence — and make deploy verification read the job trace instead of job status, killing merge near-misses and vacuous-green deploys.

## 1. SUMMARY

This change delivers the M1-S4 merge and verify-deploy engine: the `merge <ref> [--dry-run]` command and the `verify deploy <ref>` subcommand. `merge` is one transaction: it validates the full declared gate set against a recorded, bounded-fresh verification (a new append-only verification-recency record written by the declared-battery evaluation), re-probes the freshness-sensitive facts (tracker posture, CI on the pushed head) to catch post-verification transitions, verifies any waiver override's authorizer against the gate class's declared policy, attempts exactly one rebase-refresh when the request has fallen behind its base, then lands as one squash commit and verifies the landing. Every refusal is a classified verdict — `result=refused`, exit 1, the failed gate named with inline evidence — never silence, never a force path. The gate set becomes config-declared versioned data shared by `verify gates` and `merge`, so a repository adds gates without code changes; the five shipped built-in gates keep their identities and the shipped `verify gates` output. Owner-gate classification (never-merge vs owner-review-first classes) stays policy-as-data per PDR-0003 and becomes authoritative for merge-time waiver verification, flipping GH-229's v0 inertness boundary: the waiver-kind gate mapping and waiver recording become real against recorded data. `verify deploy` renders a deployment verdict from the deploy job's execution trace — steps executed, artifacts produced — with a status field alone never counting as evidence and a pipeline-created-never-ran reading unknown, never green. The merge remains an explicit coordinator action: no daemon merge code path exists in this story.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The verify gates battery (M0-S9, GH-178, delivered) evaluates exactly five fixed built-in gates in a fixed order — `lifecycle-finalization`, `ci-green`, `push-parity`, `owner-gate`, `squash-preflight` — and returns one cited verdict (`pass`, `fail`, `unknown`) per gate with no short-circuit. It is strictly read-only: no write, fence, merge, or provider mutation, and a bounded read budget of one page or item per provider source. Merge execution is explicitly external to it.
- No `merge` command and no deploy verification surface exist in the command registry. The delivered commands are `verify` (subcommands `change` and `gates`), `status`, `queue`, `lint`, `plan`, `watchdog`, `config`, `closeout`, `db`, `provider`, `brief`, `phase`, `board`, and `commit`.
- The configuration layer declares two ordinary production branches today (`provider`, `commit`) over the seven-layer resolver with typed schemas, per-value origins, and classified validation errors. There is no merge branch and no gate-set or freshness key.
- The state layer provides the append-only, schema-versioned JSONL ledger, verified reads, verified-empty evidence, single-writer fences, atomic derived-document replace, and additive record kinds (phase transitions, provider parks, closeout operations, commit telemetry, owner-gate decisions, audit reservation/invocation) — the substrate for durable, auditable merge-domain records.
- The result contract provides the `CommandResult` envelope, the machine-readable error table with the family-row mechanism proven by `status.collector.<id>.unavailable`, the `{0, 1, 2}` exit projection, the two-entry fallback containment, the single redaction chokepoint, and the binding documented-table/machine-table sync check. The scripted agent-mode trim (M1-S22) is active, and every command invocation is audited.
- The owner-gate SLA (GH-229, delivered) created the PDR-0003 two-row policy map — kind `owner-review` (class `owner-review`, never-merge, non-defaultable) and kind `waiver` (class `waiver`, defaultable to `owner-review-first`) — and pins a v0 inertness boundary: every tracker-observed gate maps to `owner-review`, waiver-kind gates are unreachable, and `waivedBy` never renders against real data. The delivered contract names this change as the reconciliation point (the waiver-recording surface, marked GAP-9 in the CLI edge).
- The M1 planning pack proposes the two command contracts (`merge`, `verify deploy`), the timing default (gate freshness bound 30 minutes, key `merge.gate-freshness`, owned by M1-S4), and the seed scenarios SC-M1-01..05; the backlog sanctions refining proposed contracts at story delivery.
- The command audit ledger (M1-S22) records one auditable invocation record per command run, including a claimed identity when present — the durable who-fired-it trail for a mutating coordinator command.

### 2.2 Pain Points / Gaps

- **Merging is manual and unverified**: nothing stands between a coordinator decision and the base branch. The near-miss class is real — gates verified once, then the world moves (a stale CI job, a ticket that flipped to an owner-gated state after verification) and the merge lands anyway.
- **No freshness bound**: a verification has no recorded age. Because `verify gates` records nothing, no consumer can answer "how long ago were these gates true?" — the precondition for any bounded-fresh merge.
- **Vacuous-green deploys**: deploy confidence today reads job status fields, never the execution trace. A pipeline created but never run, or a stale cached status, reads as green. Nothing verifies that deploy steps executed and artifacts were produced.
- **No override discipline**: there is no recorded waiver carrying an authorizer principal, and no verification of the authorizer against declared class policy — so an override would be a hidden decision inside the tool, exactly what the system forbids.
- **No refresh path**: when a request falls behind its base there is no declared single rebase-refresh attempt with a classified conflict refusal naming the conflicting paths; the de-facto alternatives are manual rebases or force pushes.
- **Gate set is code-fixed**: adding a repository-specific gate (a workspace test gate, deploy verification) requires a code change today; the five built-ins are hard-declared, not data.
- **Classification is inert**: the never-merge vs owner-review-first classification exists as data but polices nothing at merge time and no waiver recording exists, so owner authority over never-merge classes has no enforcement point.

## 3. PROBLEM STATEMENT

Because landing a change executes no verified transaction — no recorded verification age bounds the gates' validity, no post-verification probe catches tracker or CI transitions, no recorded waiver with a verified authorizer exists, and no classified refresh path handles a behind-base request — a coordinator merge can land on stale gates or a flipped owner gate as a silent near-miss; and because deploy confidence reads status fields instead of execution traces, a pipeline that was created but never ran reads as green; so the highest-value M1 relief (operator R1) — trustworthy, self-refusing merges and truthful deploy verdicts — cannot be delivered to the daemon and the coordinator surfaces sequenced behind it.

## 4. GOALS

- **G-1**: The merge transaction refuses when the recorded gate verification is older than the declared freshness bound — a bounded, config-declared bound whose coverage includes tracker state as well as CI (ticket acceptance criterion 1).
- **G-2**: Every refusal names the failed gate or condition with inline evidence and a remediation hint — no re-probe needed by the caller, never exit-0 silence, exit 2 reserved for platform faults and state-unverified outcomes (ticket acceptance criterion 2).
- **G-3**: Deployment verdicts derive from the job's execution trace — steps executed, artifacts produced — with status fields alone never counting as evidence and a created-never-ran pipeline reading unknown, never green (ticket acceptance criterion 3).
- **G-4**: The gate set is config-declared versioned data: a repository declares additional gates and they are enforced like built-ins, with no code change (ticket acceptance criterion 4).
- **G-5**: A post-verification tracker transition into an owner-gated state is caught at merge time and refused with the transition and its age in the evidence (ticket acceptance criterion 5).
- **G-6**: Owner-gate classification — never-merge vs owner-review-first — is readable from declared policy, and it is the authority merge consults (ticket acceptance criterion 6), flipping GH-229's v0 inertness boundary.
- **G-7**: Waivers carry an authorizer principal; the transaction verifies the authorizer against the gate class's declared policy (owner-authored for never-merge classes) and refuses an unauthorized authorizer — waiver presence alone never passes a gate (ticket acceptance criterion 7).
- **G-8**: A behind-base request gets exactly one rebase-refresh attempt; a conflict is a classified refusal naming the conflicting paths; there is no force path (ticket acceptance criterion 8).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Merges landing on verification older than the declared bound | 0 (every case refused with the bound and the age inline) |
| Refusals naming the failed gate with inline evidence and a remediation hint | 100% |
| Post-verification tracker transitions to an owner-gated state that land | 0 |
| Repo-declared gates enforced by `verify gates` and `merge` without a code change | 100% of declared entries |
| Waiver overrides applied without a verified-authorized authorizer record | 0 |
| Rebase conflicts expressed as anything other than a classified refusal naming paths | 0 (force paths: none exist) |
| Deploys verdict-verified on status-field evidence alone | 0 (trace is the only verified evidence) |
| Created-never-ran deploy pipelines rendering green | 0 (unknown, exit 1, classified) |
| Merge or deploy mutations fired by any path other than the explicit coordinator command | 0 (no daemon merge code path) |

### 4.2 Non-Goals

- **NG-1**: The daemon and its dispatch integration — no daemon merge code path ships here; the daemon later consumes merge as an external coordinator-owned command, never the reverse.
- **NG-2**: The typed blocker channel, queue leases, lane state, or coordinator supervision (M1-S16/S17/S23) — merge composes none of them in this story.
- **NG-3**: Closeout automation — the transaction records closeout-ready state; the closeout sweep itself is untouched.
- **NG-4**: Review approvals, unresolved threads, branch protection, or worktree cleanliness as new gate kinds — these remain external to the battery, as delivered by verify gates; only the declared recipe vocabulary shipped here is available for repo-declared gates.
- **NG-5**: Deploy execution — `verify deploy` verifies a deployment; it never triggers, re-runs, or schedules one.
- **NG-6**: Automatic re-verification loops or waiting-for-CI semantics inside the transaction — when evidence is missing or stale the transaction refuses with a remediation hint; it never waits or retries unbounded.
- **NG-7**: New SLA thresholds or owner-gate default changes — the PDR-0003 two-row map and SLA thresholds are owned by GH-229 and are consumed, not modified, here (the classification's merge-time role and the waiver recording are the reconciliation deliverables).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Config-declared versioned gate registry shared by `verify gates` and `merge` | Repositories must add gates without code changes (AC 4); the shipped battery behavior must be preserved by default. |
| F-2 | Verification-recency record and the merge freshness check | The bound needs a concrete, durable age source; "verified more than a bounded time ago" must be observable truth, not a re-derivation. |
| F-3 | Post-verification transition probe (tracker freshness) | A ticket that moved to an owner-gated state after verification must invalidate the verification (AC 5). |
| F-4 | Owner-gate classification as authoritative policy-as-data | The never-merge/owner-review-first classification must be readable from declared policy and consulted at merge time (AC 6); GH-229's inertness flips. |
| F-5 | Recorded waivers with authorizer verification | Overrides must be recorded, authorized against class policy, and never silently accepted (AC 7). |
| F-6 | `verify deploy` by job trace | Deploy truth lives in steps executed and artifacts produced, never in status fields (AC 3). |
| F-7 | Single rebase-refresh path with classified conflict | Behind-base requests need one declared refresh attempt; conflicts refuse with paths named; no force path (AC 8). |
| F-8 | Squash landing transaction with verified landing and idempotent convergence | The landing itself must be verified evidence, and re-runs must converge safely. |

### 5.1 Capability Details

- **F-1 — Config-declared versioned gate registry.** The gate set becomes declared data: a typed configuration branch `merge` carries `merge.gate-freshness` (the freshness bound, default 30 minutes) and `merge.gates` (the declared gate set). Each gate entry declares a stable id, a recipe from a closed versioned recipe vocabulary (the five built-in recipes plus declarative recipes that evaluate from existing repository and provider facts — e.g. required CI jobs or declared checks by name — so a workspace test gate is pure configuration), its surface applicability (`battery`, `merge`, or both), and for owner-gate-class gates its class binding. The declared set carries a schema version; an unsupported version or a malformed entry is a classified configuration failure, never silently interpreted. The shipped default — when `merge.gates` is absent — is exactly the five built-in ids with their shipped recipes and applicability, plus the merge-only `tracker-freshness` entry (F-3), so delivered `verify gates` output is preserved byte-identically by default. The five built-in entries are mandatory members of any declared set: a repository may add entries but a declaration omitting a built-in is refused as invalid configuration — gates are never silently removed. A declared set replaces the default wholesale, following the configuration layer's list-replacement semantics, and its effective identity (schema version plus entry ids) is part of verification validity (F-2). `verify gates` evaluates the battery-applicable entries and cites a repo-declared gate exactly like a built-in (SC-M1-04); `merge` evaluates the merge-applicable entries. Built-in ids are reserved: a declared entry reusing one must declare exactly the shipped recipe and applicability, and any other redefinition is a classified configuration failure — a declared set cannot silently weaken a safety gate such as by redefining `ci-green` to always pass (DEC-13).

- **F-2 — Verification-recency record and the merge freshness check.** Every full declared-battery evaluation — a `verify gates` run and a `merge --dry-run` run — appends one gate-verification record to the state ledger (EVT-1, DM-1): the change ref, the resolved head SHA, the verification time from the injected clock, the declared gate-set identity it evaluated against, per-gate verdicts with bounded citations, and the observed tracker posture at verification (owner-gate label state). The append is fenced and verified post-append; a failed append is a classified state failure, and a verification whose record did not land is never consumable as fresh evidence. `merge` consumes the newest record for the change and enforces the freshness envelope: (a) a record must exist — an absent, unreadable, torn, or schema-incompatible verification state is the declared state-unverified outcome (exit 2, platform class), never a silent pass; (b) the record's age — injected now minus recorded verification time — must satisfy the declared bound `merge.gate-freshness` with the declared boundary comparator (at-bound is already stale: the boundary belongs to refusal, not to landing); (c) the recorded head SHA must equal the current head, and the recorded gate-set identity must equal the currently effective one — any mismatch voids the verification. A violated envelope is the classified refusal `merge.gates-stale` carrying the verification age, the bound, and the voiding reason inline, with the remediation hint to re-run verify gates (SC-M1-02). The freshness envelope is primary: when it is violated, `merge.gates-stale` is the refusal identity and any probe observation (a new red job, a posture transition) rides as additional inline evidence; per-gate identities apply only when the verification is fresh (DEC-13). A dry run appends exactly one verification record and performs zero mutations — no squash, no request-state change, no waiver record, no transaction record — and reports the battery verdict: exit 0 when every merge-applicable gate passes, a classified refusal at exit 1 when one fails; it never renders `result=merged` or `squash=`, and whether it additionally reports the freshness envelope over a pre-existing record is delivery-bound and unpinned (DEC-13).

- **F-3 — Post-verification transition probe (tracker freshness).** `tracker-freshness` is a declared merge-applicable gate entry in the default set. At merge time the transaction performs one bounded post-verification probe: one tracker work-item read and one bounded check-run page on the verified head SHA, plus one request-detail read for base position. If the work item now carries an owner-attention label (or otherwise sits in an owner-gated posture) where the recorded verification observed none, the gate refuses with `merge.gate.tracker-freshness.failed`, the evidence naming the transition and its age relative to the verification time — the owner-gate scan cited inline (SC-M1-03). If the check-run page shows a failing or newly failing job on the head SHA that the recorded verification did not observe, the `ci-green` gate refuses with the new job id inline. The probe reads only; it never blocks or waits. Within the bound, the probe is what converts "the world moved after verification" from a near-miss into a classified refusal. Identity precedence follows the envelope: a violated freshness envelope refuses `merge.gates-stale` with the probe's observation as additional evidence, while a fresh verification with a probe-observed violation refuses the gate row — `merge.gate.ci-green.failed` for a new red job, `merge.gate.tracker-freshness.failed` for a post-verification tracker transition — with the recorded evidence fields identical in either case (DEC-13).

- **F-4 — Owner-gate classification as authoritative policy-as-data.** The gate-kind/class classification remains declared policy data per PDR-0003 — kind `owner-review` (class `owner-review`, never-merge) and kind `waiver` (class `waiver`, defaultable to `owner-review-first`), extended with each class's declared waiver-authorization policy: never-merge classes are owner-authored, and the owner principal is resolved from the provider-resolved repository identity, never claimed or inferred. The classification is readable from the declared data — a consumer determines a gate kind's class and its authorization policy without inspecting logic — and `merge` consults it as the authority for every override decision (F-5). With this change the GH-229 v0 inertness boundary flips: the waiver-kind mapping becomes real against recorded data — a gate with a recorded waiver (F-5) is collected as waiver-kind with its recorded authorizer, so `waivedBy` renders on the board against real recorded waivers, and the SLA's waiver-class default path becomes exercisable on real data. The classification vocabulary itself is owned by GH-229 policy data and is consumed unchanged.

- **F-5 — Recorded waivers with authorizer verification.** A waiver override is an explicit declaration on the merge surface naming the gate to override and the authorizer principal. The transaction first verifies the declaration: the named gate must be waivable (its class declared in the classification), and the authorizer principal must satisfy the class's declared authorization policy — for never-merge classes, the provider-resolved owner principal. An unauthorized authorizer is the classified refusal `merge.waiver-unauthorized` naming the gate, the class, and the authorizer; nothing is recorded as a waiver (the invocation itself remains in the audit ledger). An authorized waiver is appended as an append-only waiver record (EVT-2, DM-2) before any landing mutation — gate id, class, change ref, authorizer principal, authorization time, bounded reason — and the gate passes under that recorded waiver for this transaction. The owner-gate gate failing with no waiver declaration at all is the classified refusal `merge.owner-gate-override-without-waiver`, naming the gate and the override path. Waiver presence alone never passes a gate: the authorization check is unconditional, and an unresolvable principal never authorizes (fail-closed). The declaration's surface grammar (flag and argument spelling) is delivery-bound, read from the command contract at delivery planning; the behaviour — the declaration names the gate and the authorizer, verification precedes recording — and the refusal identities are pinned and may not be rebound (DEC-13). A dry run verifies and reports a declared override's authorization (authorized or unauthorized) but records no waiver and no transaction record: waiver recording is a landing-transaction act, and a real merge with the same declaration records the waiver before its first mutation (DEC-13).

- **F-6 — `verify deploy` by job trace.** The `verify deploy <ref>` subcommand (the third `verify` subcommand, beside `change` and `gates`) resolves the deployment target for the change deterministically, then reads the deploy job's execution trace: the steps executed with their outcomes and the artifacts produced. The expectation set the trace is compared against is declared data, read from contract data: a repository declares its expected deploy steps and artifact patterns in configuration — the same declared-data theme as the gate set — and where the delivered provider facts expose the expectation, the provider-declared fact serves as the declaration; with no declared expectation the verdict is never `verified` — it degrades to unknown with the absent-evidence identity, never green (fail-closed) (DEC-13). The verdict is `verified` only when the trace shows the declared expectation set's steps executed successfully and the artifacts they produce present in the trace evidence. A pipeline that exists but has zero executed steps reads `unknown` with the declared reason `pipeline-created-never-ran` — never green (SC-M1-05). A status field that stands alone without supporting trace evidence, or that contradicts the trace, reads `unknown` with the reason `status-stale` — a stale status field is disqualified as evidence, never a pass. A trace showing failed steps reads `failed` with the failing step named. Reasons and error identities are bound by one declared, bidirectional map in contract data — absent executed-step/artifact evidence, including the zero-executed-steps instance carrying reason `pipeline-created-never-ran`, carries `verify.deploy.trace-missing`; reason `status-stale` carries `verify.deploy.status-stale`; a failed-step trace carries `verify.deploy.trace-failed` — with no fourth row and no fourth reason: every declared row is reachable and every reason maps to exactly one row (DEC-13). A negative deploy verdict (unknown or failed) renders exactly as a merge refusal does: a classified error at exit 1 carrying the mapped `verify.deploy.*` identity with `runId` and no `data` sibling; text mode keeps `verdict=unknown` / `verdict=failed` as the continuity keys; the machine-visible verdict identity is the classified code and the failure envelope carries no prose reason field, so consumers (including the dispatch-classified delivery) map codes, never parse prose (DEC-13). SC-M1-05's `data.verdict` wire spelling is superseded by this shape while its observable semantics — verdict unknown, zero steps shown, never green, exit 1, classified — are preserved verbatim; the seed row's reconciliation is a phase-7 documentation obligation, not a silent fork. The unknown verdict (trace examined, evidence absent) is disjoint from state-unverified (the read itself failed): different classes, different exits — unknown and failed project exit 1; an unreadable platform read projects exit 2 through a declared existing platform/state row, never a new `verify.deploy.*` fault code (DEC-13). No retry, no pagination, one bounded trace read per invocation; `verify deploy` never triggers a deployment.

- **F-7 — Single rebase-refresh path with classified conflict.** When the request-detail read shows the request behind its base, the transaction attempts exactly one rebase-refresh. A refresh conflict is the classified refusal `merge.rebase-conflict` naming the conflicting paths inline — never a force path, which does not exist in the transaction's vocabulary. A successful refresh changes the head SHA, which voids the SHA-bound verification (F-2): the transaction then refuses `merge.gates-stale` with the old-to-new SHA transition inline and the remediation hint to re-run verify gates on the rebased head — the refresh made recorded, declared progress, and the landing still waits for gates verified on the SHA that will actually land. The refresh attempt and its outcome are carried in the transaction evidence; a second refresh is never attempted in the same invocation. The no-force guarantee is structural and asserted non-vacuously: the transaction's mutation vocabulary declares no force-capable operation, the merge and deploy production surfaces are scanned for force constructs against a mandatory failing control, and a passing scan without that control is treated as vacuous; the assertion technique is delivery-bound (DEC-13).

- **F-8 — Squash landing transaction with verified landing and idempotent convergence.** With every merge-applicable gate passing (by fresh verification plus probe, or by a recorded authorized waiver), the transaction lands the change as one squash commit and then verifies the landing: the squash SHA present on the base branch, the request state merged. A landing that fires but cannot be verified is the classified `merge.landing-unverified` with consequence `unknown` — the honest first-class answer that the mutation's landing state is not established. Post-landing steps (delivery branch deletion, closeout-ready state recorded via the transaction outcome record, EVT-3/DM-3) are declared in the output; a cleanup failure after a verified landing never flips the landing verdict and is never silent. Re-runs converge: a transaction record plus base containment already observed replays the `merged` verdict idempotently (exit 0, recorded squash SHA) — already-merged detection, never a second landing. An abort before any mutation lands restores nothing and classifies `merge.transaction-aborted` (not landed, retryable). The merge is an explicit coordinator action only: no daemon code path fires a merge (NFR-6), and every merge invocation is audited with its claimed identity when present.

## 6. USER & SYSTEM FLOWS

```
Flow 1: the merge transaction (happy path)
  coordinator runs <binary> verify gates <ref>   → battery evaluated, verification record appended
  coordinator runs <binary> merge <ref>
    → verification record read: exists, within bound, same head SHA, same declared gate set
    → probe: tracker posture unchanged (not owner-gated), no new red job on the head
    → no behind-base position, no waiver declarations
    → squash lands → landing verified (SHA on base, request merged)
    → branch deleted, closeout-ready recorded → result=merged, squash SHA, exit 0
```

```
Flow 2: the freshness refusal
  coordinator runs <binary> merge <ref>
    → verification record read: age 31m exceeds bound 30m
    → result=refused, exit 1, merge.gates-stale
      evidence: "gates verified 31m ago exceeds bound 30m; new red job 44832 on head sha 9f21c0e"
      remediation: re-run verify gates
    → base HEAD unchanged, no request state change, no re-probe needed by the caller
```

```
Flow 3: the post-verification tracker flip
  gates verified 2m ago; ticket then moved to an owner-gated state
  coordinator runs <binary> merge <ref>
    → probe reads the work item: owner-attention label present now, absent at verification
    → result=refused, exit 1, merge.gate.tracker-freshness.failed
      evidence: transition named with its age; owner-gate scan cited inline
```

```
Flow 4: the authorized override
  ticket is owner-gated; coordinator declares the override naming the gate and the owner principal
    → authorizer verified against the class's declared policy (owner-authored for never-merge)
    → waiver record appended (durable, auditable) → owner-gate passes under the recorded waiver
    → remaining gates evaluated → squash lands → landing verified → waiver record persists
  an unauthorized principal declares the same override
    → result=refused, exit 1, merge.waiver-unauthorized; no waiver record exists
```

```
Flow 5: behind-base with a conflict
  coordinator runs <binary> merge <ref>
    → request detail: behind base → exactly one rebase-refresh attempted
    → refresh conflicts → result=refused, exit 1, merge.rebase-conflict, conflicting paths named
    (refresh succeeds → head SHA changes → verification voided by the SHA transition
     → result=refused, exit 1, merge.gates-stale → re-run verify gates on the rebased head)
```

```
Flow 6: deploy verification
  coordinator runs <binary> verify deploy <ref>
    → trace read: steps executed, artifacts produced → verdict=verified, exit 0
    → trace read: zero steps executed, pipeline exists → verdict=unknown
      reason pipeline-created-never-ran, exit 1, classified — never green
    → green status field, no supporting trace → verdict=unknown, reason status-stale — disqualified
    → trace read itself fails (platform fault) → exit 2, classified platform identity
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The typed `merge` configuration branch: `merge.gate-freshness` (default 30 minutes, this story owns the key, the default, and the semantics) and `merge.gates` (the declared, schema-versioned gate set), with the declared-set validation rules (mandatory built-ins, closed recipe vocabulary, unsupported versions refused).
- The gate-verification record: a new additive state record kind appended by full declared-battery evaluations, carrying ref, head SHA, verification time, gate-set identity, per-gate verdicts with bounded citations, and the tracker posture snapshot.
- The `merge` command: freshness envelope enforcement, the post-verification probe, waiver verification, the single rebase-refresh path, squash landing with landing verification, post-landing steps, idempotent convergence, `--dry-run`, and the text/`--json` surface under the existing envelope, exit, and scripted-trim taxonomy.
- The `verify deploy` subcommand: deterministic target resolution, one bounded trace read, the verified/unknown/failed verdict taxonomy with the closed reason vocabulary, and status-fields-never-evidence.
- The waiver record and the authorizer-against-class-policy verification, fail-closed, with the owner principal resolved from provider-resolved repository identity.
- The owner-gate classification reconciliation: the PDR-0003 policy data consumed as merge-time authority; the waiver-kind gate mapping and `waivedBy` becoming real against recorded waivers (GH-229 inertness flip, GAP-9 closure).
- New error-table rows: the `merge` domain kind (including the `merge.gate.<gate-id>.failed` family row) and the `verify.deploy.*` rows, documented and machine-declared in the same change with the sync check green.
- `verify gates` gaining the verification-record append while its five-gate verdicts, citations, and human output remain byte-identical by default.
- The explicit-coordinator boundary: no daemon merge code path, asserted as a reviewable, testable invariant.

### 7.2 Out of Scope

- [OUT] Any daemon or dispatch code path that fires a merge — the daemon later consumes the coordinator-owned command (constraint 9; the `merged` token elsewhere is already-merged detection only). M1-S18.
- [OUT] Closeout sweep execution — the transaction records closeout-ready state; the sweep is the closeout story's surface. M1-S12.
- [OUT] Review approvals, unresolved threads, branch protection, and worktree cleanliness as gates — remain external to the battery as delivered. A later story may declare them as repo-declared gate recipes if a named consumer appears.
- [OUT] Deploy triggering, re-running, or scheduling — `verify deploy` is read-only over the trace. M1-S20 consumes the verdict; it does not originate here.
- [OUT] New owner-gate kinds, classes, SLA thresholds, or default-map changes — owned by GH-229 policy data (PDR-0003); this change consumes and reconciles, never re-derives.
- [OUT] Waiting-for-CI, automatic re-verification, or watch semantics inside the transaction — refusals carry remediation hints; the coordinator re-invokes.
- [OUT] MCP or other host surfaces for the new commands — the CLI surface ships here; surface parity follows the existing pattern later.

### 7.3 Deferred / Maybe-Later

- Additional declarative recipe kinds for repo-declared gates (artifact-presence gates, multi-workflow gates) beyond the shipped closed vocabulary, as named consumers appear.
- A standalone waiver-authoring surface separate from the merge override declaration, if a consumer needs to record waivers outside a merge invocation.
- Per-gate freshness overrides (a different bound per gate class) if the single declared bound proves too coarse.
- Deploy-trace providers beyond the delivered CI platform, following the adapter port pattern.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the surfaces are local CLI commands over provider reads; no HTTP endpoint is introduced.

### 8.2 Events / Messages

| ID | Event | Producer | Consumer | Content |
|----|-------|----------|----------|---------|
| EVT-1 | Gate-verification record | Every full declared-battery evaluation (`verify gates`, `merge --dry-run`) | `merge` freshness envelope; any later surface auditing verification history | Change ref, head SHA, verification time, declared gate-set identity, per-gate verdicts with bounded citations, tracker posture snapshot; append-only, fenced, verified post-append |
| EVT-2 | Waiver record | The merge transaction on an authorized override declaration | Merge waiver verification; board collector (waiver-kind mapping, `waivedBy`); audit reads | Gate id, gate class, change ref, authorizer principal, authorization time, bounded reason; append-only, durable regardless of the transaction's final verdict |
| EVT-3 | Merge transaction outcome record | The merge transaction at landing (and at replayed already-merged detection) | Landing verification on re-run; closeout readiness; audit reads | Result, squash SHA, landing-verification evidence, refresh attempts, waiver references, post-landing step statuses; append-only, idempotent by change |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Gate-verification record (EVT-1 payload) | Schema `delivery.merge.gate-verification.v1` under the store-scoped key per change ref; additive inside the existing state schema, no schema-version bump |
| DM-2 | Waiver record (EVT-2 payload) | Schema `delivery.merge.waiver.v1` under the store-scoped key per change ref; additive, no schema-version bump |
| DM-3 | Merge transaction outcome record (EVT-3 payload) | Schema `delivery.merge.transaction.v1` under the store-scoped key per change ref; additive, no schema-version bump |
| DM-4 | Declared gate set (configuration value) | Schema-versioned list of gate entries: id (built-in ids reserved), recipe from the closed versioned vocabulary, surface applicability (`battery` \| `merge` \| both), optional class binding; absent value yields the shipped default set |
| DM-5 | Owner-gate classification policy (declared data) | The PDR-0003 two-row kind/class map plus per-class waiver-authorization policy (never-merge ⇒ owner-authored; owner principal provider-resolved); readable without code inspection; consumed unchanged from GH-229 policy data |

Field spellings within the declared payloads — schema strings, record kind names, contract export names, field names, evidence rendering of ages/bounds/SHAs, the closeout-ready marker field, the deploy expectation field names, and the audit identity field — are delivery-bound; the vocabularies those payloads carry (gate ids, verdicts, reasons, classes, error codes, exits, comparator, caps) are pinned and may not be rebound (DEC-13).

### 8.4 External Integrations

- **Tracker (GitHub, delivered read slice):** one bounded work-item read per merge invocation for the posture probe, over the existing normalized work-item view (ADR-0004); the repository owner principal is provider-resolved for waiver authorization. No tracker writes, no new credential path.
- **CI (GitHub Actions):** one bounded check-run page per merge invocation (the transition probe), reusing the delivered read kind; one bounded deploy-job trace read per `verify deploy` invocation — a new bounded provider read kind returning executed steps with outcomes and produced artifacts. One page or item per source, no retries, no pagination.
- **Repository (git):** local bounded reads (head resolution, base containment) and the transaction's mutation set — the single rebase-refresh attempt, the squash landing, post-landing branch deletion. No force operations exist in the vocabulary.
- No new external API surface, no new vendor, no new credential kind.

### 8.5 Backward Compatibility

- `verify gates` verdicts, citations, ordering, and human output are unchanged by default; the surface gains one state append (the verification record) whose failure is classified, never silent. Its read-only status changes to read-plus-record — a declared, reviewed contract change reconciled in its feature documentation.
- The `CommandResult` envelope, the scripted trim, and the exit projection are unchanged; the new commands are consumers, not extensions, of the result contract's mechanics. The documented error table grows by the declared rows; all other rows are untouched.
- The state ledger gains three additive record kinds; no existing record kind, read, schema version, or boundary is modified.
- The configuration catalog gains the `merge` branch; existing branches and resolution semantics are unchanged; an operator declaring nothing keeps today's behavior (default gate set, 30-minute bound).
- The board's payload shape is unchanged; its waiver-kind population and `waivedBy` become real against recorded waivers (previously always null against real data) — an additive data change within the delivered schema.
- The two fallback containment rows continue to classify anything the new rows do not; no code reuses a row across categories. A provider or state fault inside `merge` or `verify deploy` reuses a declared existing platform/state identity — no new fault row is added to either new code family (DEC-13).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism: identical injected facts (provider reads, state, clock, configuration, git outcomes) produce byte-identical text and machine output, including refusal evidence | 100% byte-identical; zero run-to-run drift |
| NFR-2 | Read budget per `merge` invocation: one state verification read, one tracker work-item read, one bounded check-run page, one request-detail read, bounded local git reads; mutation reads (rebase, squash, branch deletion) only on their declared paths | ≤ 1 page/item per provider source; 0 retries; 0 pagination |
| NFR-3 | Read budget per `verify deploy` invocation: one bounded trace read; step and artifact lists bounded with explicit truncation marks | ≤ 1 trace read; 0 retries; 0 pagination |
| NFR-4 | Output bounds: machine `data` ≤ 65 536 UTF-8 bytes; human transaction summary ≤ 24 lines / 4 096 UTF-8 bytes; evidence name and path lists capped with explicit `+N` marks | All bounds enforced and marked; no unbounded dump path |
| NFR-5 | Freshness semantics: the bound is the declared `merge.gate-freshness` (default 30 minutes); age = injected now − recorded verification time; the declared boundary comparator makes at-bound stale; the bound covers CI and tracker state through the single recorded verification | 100% of stale verifications refused; 0 at-bound landings |
| NFR-6 | Coordinator-only boundary: no daemon code path fires a merge; the merge command is the only producer of landings | 0 daemon merge paths (structure/boundary assertable) |
| NFR-7 | State-write discipline: every merge-domain append is fenced and verified post-append; a failed append is a classified failure and the affected verification/waiver/transaction is never treated as landed | 100% classified; 0 silent partial records |
| NFR-8 | Error-identity stability: every new code documented in the documented table and declared in the machine table in the same change; the `merge.gate.<gate-id>.failed` family row is declared once and its slot validator accepts any id present in the effective declared gate set (registry-validated) while rejecting empty, malformed, or undeclared ids; the documentation-sync family recognizer stays narrow with no pattern widening | 0 undocumented codes; 0 reused-as-class codes; 0 undeclared slot admissions; sync check green |
| NFR-9 | Idempotency: every re-run converges; already-merged detection replays the recorded verdict without a second landing; waiver authorization is deterministic per (record, class policy) | 0 duplicate landings; 0 divergent replays |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The standard envelope's `runId` and `timing` on every `merge` and `verify deploy` invocation; the command audit ledger records every invocation with the claimed identity when present — the durable who-fired-it trail for a mutating command.
- Per-gate verdicts with citations on both success and refusal paths (the refusal evidence is inline; no re-probe needed).
- The verification, waiver, and transaction records (EVT-1..3) are the durable observability trail: what was verified, when, against which gate-set identity; who authorized which override; what landed, when, with which landing evidence.
- The transaction summary declares each post-landing step's outcome (branch deletion, closeout-ready recording) — never silent.
- No telemetry exporter, event sink, background process, or alerting channel is added.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|------------|------------|---------------|
| RSK-1 | A transition occurs between the merge-time probe and the squash landing (residual race window) | H | M | The window is bounded and declared: the probe is the last read before landing, refusals record what was observed, and the landing verification plus the transaction record preserve the evidence trail; eliminating the window entirely would require provider-side atomicity that does not exist | M |
| RSK-2 | `verify gates` gaining a write breaks consumers expecting a strictly read-only surface | M | M | The verdicts, citations, ordering, and human bytes are pinned unchanged by golden tests; the record append is additive and fenced; an append failure is classified, not a verdict change; the contract change is documented in the same change | L |
| RSK-3 | An operator mis-declares the gate set and silently drops a safety gate | H | M | The five built-ins are mandatory members of any declared set — omission is invalid configuration; the declared-set identity rides the verification record, so a set change voids prior verifications; unsupported schema versions are refused | L |
| RSK-4 | A waiver authorizer principal is claimed rather than authorized (local single-host trust) | H | M | The authorizer is verified against the class's declared policy with the owner principal resolved from provider-resolved repository identity; an unresolvable principal never authorizes (fail-closed); every authorization is a durable record and every invocation is audited; the single-host, same-user filesystem authorization posture is the accepted M1 boundary and is documented, not hidden | M |
| RSK-5 | The rebase-refresh path mutates the request branch and a failure leaves it half-refreshed | M | M | Exactly one attempt, no force path in the vocabulary; the attempt and its outcome are recorded in transaction evidence; a conflicted refresh is a classified refusal naming paths; the SHA transition after a successful refresh voids the verification rather than being papered over | L |
| RSK-6 | The GH-229 inertness flip changes board behavior in ways its goldens do not expect (waiver-kind gates, real `waivedBy`) | M | M | The classification map is consumed unchanged; only the mapping and recording become real; the board contract already declares the waiver-kind path over injected facts — the flip exercises it; goldens extend to recorded-waiver cases; SC coverage asserts both postures | L |
| RSK-7 | Deploy-trace availability or shape varies across CI configurations, degrading verdicts to unknown | M | M | The verdict taxonomy treats unknown as a first-class honest outcome with a declared reason — never green; the trace-read is a bounded adapter capability with a closed evidence vocabulary; provider capability gaps surface as declared unknowns with remediation, not as failures of the command | L |
| RSK-8 | The freshness bound is set too tight or too loose for a repository's CI duration, either blocking merges or rubber-stamping staleness | M | M | The bound is operator-owned configuration with per-value origin evidence (`config debug`); the default (30 m) matches the planning-pack timing table; the probe catches post-verification transitions independently of the bound, so a loose bound does not silently admit flips | L |

## 12. ASSUMPTIONS

- The delivered tracker slice is GitHub; the normalized work-item view, provider-native timestamps (ADR-0004), and provider-resolved repository identity are available to merge and deploy verification as they are to the delivered commands.
- Single-host, local-first posture: filesystem authorization (0700 state dir, same-user) is the accepted trust boundary for waiver principal claims and state records, matching the delivered state-layer and audit posture; no remote identity provider is introduced.
- The squash landing targets the delivered base branch (`main-tools` for tooling delivery), consistent with the shipped squash-preflight gate; the base is the battery's declared target, not a new configuration key.
- The merge command has no bash predecessor with continuity keys; it establishes the `result=` / `squash=` key shape in the delivered key=value continuity style.
- The M1 planning pack's proposed contracts are refined at story delivery as the backlog sanctions; this specification records each refinement and every pack-internal inconsistency it resolves (Appendix A).
- The command audit seam (M1-S22) is injected in production composition, so merge invocations are audited from the first delivery.
- The provider adapter gains the bounded deploy-job trace read as a new read kind behind the existing ports; no new credential path is required.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Verify gates battery (M0-S9, GH-178) — DELIVERED ✓ | The five built-in gates, cited verdicts, deterministic request resolution, read budgets; this change makes the set config-declared and the evaluation recording |
| Depends on | Configuration layer (M0-S4, GH-173) — DELIVERED ✓ | The typed catalog branch mechanism carrying `merge.gate-freshness` and `merge.gates` with origins and classified validation |
| Depends on | State layer | Append-only ledger, fences, verified reads, verified-empty, additive record kinds — substrate for EVT-1..3 |
| Depends on | Result contract and error table | Envelope, family-row mechanism, exit projection, redaction, the binding sync check |
| Depends on | Owner-gate SLA (GH-229) | PDR-0003 kind/class map and vocabulary consumed as merge authority; the inertness boundary this change flips (GAP-9) |
| Depends on | Commit primitive | The atomic land-and-record and abort-convergence precedent for the squash landing |
| Depends on | Command audit ledger (M1-S22) | Per-invocation audit with claimed identity; scripted trim active for the new commands |
| Depends on | Provider adapters | Work-item read, check-run page, request-detail read (delivered); the new bounded deploy-job trace read |
| Feeds | M1-S17 queue (GH-232-class work) | Merge-ready ranking consumes the transaction outcome record |
| Feeds | M1-S18 daemon (M1) | Consumes merge as an external coordinator-owned command; no daemon merge code path exists to reuse or bypass |
| Feeds | M1-S20 dispatch-classified delivery | The `merged` result token's producer is this command; deploy verdicts feed dispatch evidence |
| Blocks | Nothing directly; the sequenced coordinator and daemon surfaces (M1-S17/S18/S20) build on the transaction and verdict records |

## 14. OPEN QUESTIONS

None. All decisions reachable at specification time are pinned in the decision log (DEC-1..DEC-13); policy-table content beyond this change's vocabulary remains GH-229-owned and is not re-opened here. The reopened-specification iteration's test-plan gaps are adopted as spec truth (DEC-13, Appendix C); the plan-level items the test plan leaves delivery-bound — whether a dry run additionally reports the freshness envelope over a pre-existing record, the waiver declaration grammar, and which existing platform row a given fault reuses — are non-blocking delivery choices, not open specification questions.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The gate-verification record is written by the declared-battery evaluation — `verify gates` and `merge --dry-run` append it; plain `merge` consumes it and never silently re-evaluates the full battery | "Verified more than a bounded time ago" requires a recorded verification act with an age; a merge that re-verified everything fresh could never refuse for staleness (AC 1 would be vacuous). The battery is the verifier; merge is the freshness consumer. The remediation hint "re-run verify gates" closes the loop | 2026-11-06 |
| DEC-2 | `tracker-freshness` is a declared merge-applicable gate entry in the default set; gate entries carry surface applicability (`battery` \| `merge` \| both); the five built-ins keep their shipped ids and battery applicability so `verify gates` output is preserved | The pack's refusal examples name `tracker-freshness` as a gate while the shipped battery has five ids — modeling freshness as a declared merge-phase gate satisfies every refusal naming a gate (AC 2), keeps the shipped ids stable, and lets repo-declared gates default to both surfaces (SC-M1-04) | 2026-11-06 |
| DEC-3 | The freshness envelope requires: record exists (else state-unverified, exit 2), age within the declared bound with at-bound stale (declared `>=` comparator, mirroring the SLA comparator seam), recorded head SHA equal to current head, and recorded gate-set identity equal to the effective one | The ticket's bound "covers tracker state as well as CI" because one recorded verification captures both postures; the SHA and gate-set bindings make the record self-validating; at-bound-stale is the conservative boundary — the boundary belongs to refusal, not to landing | 2026-11-06 |
| DEC-4 | Refusals are classified errors: exit 1, envelope `error` carrying the table row's fields with the evidence inline in the structured summary and remediation hint, full per-gate citations on the diagnostics stream; text mode keeps `result=refused` as the verdict key | The pack man page's `{"data":{"result":"refused"}}` scripted example contradicts the shipped result contract (scripted failures render `error` + `runId`; verify gates' precedent is "on failure there is no data") and the shared pin's own "classified error" language. The pin is honored: negative verdict, exit 1, classified, evidence inline. Deviation recorded in Appendix A | 2026-11-06 |
| DEC-5 | The waiver override is declared on the merge surface (naming the gate and the authorizer); the transaction verifies the authorizer against the class's declared policy before anything is recorded; an authorized waiver is appended as a durable record before any landing mutation; an unauthorized declaration records no waiver | Waiver presence alone never passes (ticket pin); recording only authorized waivers prevents unauthorized records from persisting as if valid; the audit ledger still captures every attempt; the record-first order makes the override auditable even if the transaction later refuses on another gate | 2026-11-06 |
| DEC-6 | A successful rebase-refresh voids the SHA-bound verification and the transaction refuses `merge.gates-stale` with the SHA transition inline; a conflicted refresh refuses `merge.rebase-conflict` naming paths; exactly one attempt; no force path exists | CI evidence is SHA-bound — after a rebase the gates are not verified for the SHA that would land, and landing anyway would recreate the near-miss class; the refusal-with-remediation keeps the refresh useful (declared progress) without sacrificing the freshness guarantee (AC 8) | 2026-11-06 |
| DEC-7 | The error table gains a `merge` domain kind with eight rows — the family `merge.gate.<gate-id>.failed`, `merge.gates-stale`, `merge.waiver-unauthorized`, `merge.owner-gate-override-without-waiver`, `merge.rebase-conflict`, `merge.state-unverified`, `merge.landing-unverified`, `merge.transaction-aborted` — and the `verify` kind gains three rows — `verify.deploy.trace-missing`, `verify.deploy.status-stale`, `verify.deploy.trace-failed` | The pack lists the five notable merge codes and two deploy codes; the additions carry the pin's exit-2 semantics (state-unverified, platform faults), the honest unknown-consequence landing case, the clean-abort identity, and the failed-trace verdict the pack's verdict taxonomy requires but its error list omitted. All rows documented and machine-declared in the same change | 2026-11-06 |
| DEC-8 | State-unverified (exit 2) is reserved for: no verification record exists, or the verification state is unreadable/torn/schema-incompatible. Stale-but-readable verification is a refusal (exit 1). `verify deploy`'s unknown verdict (trace examined, evidence absent) is exit 1, disjoint from state-unverified | Exactly the ticket pin's exit reservation; the pack's cross-cutting note pins the deploy unknown/state-unverified split at exits 1 vs 2; the same split generalizes to the merge envelope | 2026-11-06 |
| DEC-9 | The five built-in gate entries are mandatory members of any declared gate set; a declared set replaces the default wholesale; the set carries a schema version; unsupported versions and omitted built-ins are classified configuration failures | "Repositories add gates without code" (AC 4) is the use case; silent removal of a safety gate is the failure mode; mandatory built-ins plus set-identity-in-the-verification-record (DEC-3) close it from both sides | 2026-11-06 |
| DEC-10 | `verify deploy` verdicts derive from the execution trace only: `verified` requires executed successful steps plus the produced artifacts in the trace evidence; status fields alone or contradicting the trace are `unknown` (`status-stale`); zero executed steps on an existing pipeline is `unknown` (`pipeline-created-never-ran`); failed steps are `failed` with the step named | "By job trace, not job status" is the ticket's core deploy demand (AC 3); the pack pins created-never-ran reads unknown never green and stale status disqualified; the closed reason vocabulary keeps verdicts machine-actionable | 2026-11-06 |
| DEC-11 | The owner-gate classification stays GH-229-owned policy data (PDR-0003 two-row map), extended with per-class waiver-authorization policy (never-merge ⇒ owner-authored, provider-resolved principal); merge consumes it as the authority; the waiver-kind mapping and `waivedBy` become real against recorded waivers, flipping the v0 inertness boundary | AC 6 requires classification readable from declared policy; re-deriving or forking the map would fork owner authority; the flip is exactly the reconciliation GH-229 named as this change's responsibility (GAP-9, PDR-0003 revisit trigger #2) | 2026-11-06 |
| DEC-12 | Re-runs converge idempotently: a recorded transaction outcome plus observed base containment replays `merged` (exit 0) without a second landing; a clean pre-mutation abort classifies `merge.transaction-aborted` (not landed, retryable); the shared pin "every command re-run is safe" holds for the mutating command | The commit primitive's convergence evidence pattern is the delivered precedent; a mutating transaction without idempotent replay would make the coordinator's retry the least safe action in the system | 2026-11-06 |
| DEC-13 | Reopened-specification amendment (specification phase iteration 2): the sixteen test-plan gap readings (GAP-1..GAP-16, the test plan's recorded gaps) are adopted as spec truth with no deviation — the deploy reason↔identity map with no fourth row or reason; configuration-declared deploy expectations read from contract data with fail-closed never-`verified`; classified-error deploy negative verdicts (SC-M1-05's `data.verdict` spelling superseded, semantics preserved, pack row reconciled at phase 7); dry-run zero-mutation semantics including no waiver and no transaction record; freshness-envelope precedence over per-gate identities; reserved built-in ids; the eleven new rows' field and exit pins (refusals and the deploy verdicts exit 1 user/`not_landed`/non-retryable; `merge.state-unverified` exit 2 platform/`not_landed`; `merge.landing-unverified` exit 2 platform/consequence `unknown`/non-retryable — the mutation fired and its landed state is unestablished, joining DEC-8's exit-2 reservation with the unestablished-mutation-state class, and a re-run re-verifies rather than re-lands; `merge.transaction-aborted` exit 1 user/retryable/`not_landed` — a clean retryable refusal); effective-declared-set family-slot validation with a narrow sync recognizer; platform-fault identity reuse with no new fault rows; the non-vacuous no-force assertion; and the pinned-vocabulary vs delivery-bound-spellings split | A specification that disagrees with its test plan fails the DoR gate; the test plan's readings are fail-closed and consistent with the spec's own pins, so adopting all of them keeps one source of truth; the full per-row field table is in Appendix C | 2026-11-06 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts (gate registry vocabulary, freshness envelope, waiver/transaction record shapes, classification policy reference) | New — closed recipe vocabulary, applicability dimension, record payload schemas, comparator seam |
| Core domain (freshness evaluation, waiver authorization, transition-probe classification, landing-verification classification, deploy-verdict evaluation) | New — pure evaluation over injected facts; no I/O, clock, randomness |
| Merge transaction domain | New — the transaction composition: envelope check, probe, waiver, refresh, squash, landing verification, records |
| CLI command surface (`merge`; `verify deploy` as the third `verify` subcommand) | New — command definitions and composition, registered beside the existing commands |
| Verify gates surface | Updated — gains the verification-record append; verdicts, citations, and default output unchanged |
| Configuration catalog | New — the typed `merge` branch (`merge.gate-freshness`, `merge.gates`) with schema validation and origins |
| State layer record kinds | New — three additive record kinds (verification, waiver, transaction); no existing kind modified |
| Result contract documentation | Updated — the `merge` domain kind rows and `verify.deploy.*` rows documented with the family mechanism; table count grows |
| Provider adapters | Extended — the bounded deploy-job trace read kind behind the existing ports |
| Board collector (owner-gate SLA) | Updated — waiver-kind mapping and `waivedBy` real against recorded waivers (GAP-9 closure); payload schema unchanged |
| Command registry / man-page surfaces | Extended — `merge` and `verify deploy` entries asserted as tree invariants and reconciled with the delivered contracts |
| Current-truth feature documentation | New — a feature spec for merge and verify-deploy, reconciled at system_spec_update; neighbor docs updated per the reconciliation note |

## 17. ACCEPTANCE CRITERIA

**Ticket AC (verbatim):** the merge helper refuses when gates were verified more than a bounded time ago; a refusal names the failed gate with inline evidence; deploy verified by trace; a repo-declared gate is enforced without code changes; a post-verification tracker transition to an owner-gated state is caught; an owner-gate classification is readable from declared policy; a waiver authored by a principal not authorized for the gate class is refused; a rebase conflict is a classified refusal naming the paths.

Traceability: ticket AC 1 → AC-F2-1; AC 2 → AC-F2-2, AC-F3-2, AC-F5-2, AC-F7-1; AC 3 → AC-F6-1..3; AC 4 → AC-F1-1..2; AC 5 → AC-F3-1; AC 6 → AC-F4-1; AC 7 → AC-F5-1..2; AC 8 → AC-F7-1..2.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** project configuration declaring a custom gate entry (a workspace test gate) alongside the mandatory built-ins, **when** `verify gates` then `merge` run for the change, **then** the custom gate is evaluated and cited exactly like a built-in on both surfaces, and failing it refuses the merge with the standard gate-refusal shape — with no source change made to enforce it | F-1, DM-4 |
| AC-F1-2 | **Given** a declared gate set that omits any of the five built-in entries, redefines a reserved built-in id with a different recipe or applicability, or carries an unsupported gate-set schema version, **when** the configuration resolves, **then** the declaration is refused as a classified configuration failure naming the offending entry, and the effective gate set is never silently reduced or weakened | F-1, DEC-9, DEC-13, NFR-8 |
| AC-F2-1 | **Given** a recorded gate verification whose age exceeds the declared bound (31 m against the 30 m default), **when** `merge` runs, **then** the result is refused with exit 1 and the classified `merge.gates-stale` identity, the evidence carrying the verification age, the bound, and any observed new red job on the head SHA inline, and the remediation hint naming re-run verify gates — and the base HEAD and request state are unchanged | F-2, EVT-1, DM-1, NFR-5 |
| AC-F2-2 | **Given** any merge refusal (stale envelope, failed gate, unauthorized waiver, missing override, conflicted refresh), **when** the refusal renders in text and machine modes, **then** it names the failed gate or condition with inline evidence and a remediation hint, never exits 0, and exit 2 occurs only for platform faults and state-unverified outcomes | F-2, F-3, F-5, F-7, DEC-4, DEC-8 |
| AC-F2-3 | **Given** no verification record for the change, or a verification state that is torn or schema-incompatible, **when** `merge` runs, **then** the outcome is the declared state-unverified identity (exit 2, platform class) — never a silent pass and never a stale-style refusal | F-2, DEC-8 |
| AC-F2-4 | **Given** a full battery evaluation whose verification-record append fails, **when** the evaluation completes, **then** the failure is classified (state taxonomy), the verdict is never treated as landed evidence, and a later `merge` does not consume it as fresh | F-2, EVT-1, NFR-7 |
| AC-F3-1 | **Given** gates verified 2 m ago and the ticket then transitioned to an owner-gated state, **when** `merge` runs, **then** the refusal names `tracker-freshness` with the transition and its age inline, cites the owner-gate scan, and no merge occurs | F-3, DM-1 |
| AC-F4-1 | **Given** the declared classification policy data, **when** a consumer resolves a gate kind (including from a refusal or the board), **then** the kind's class (never-merge or defaultable) and its waiver-authorization policy are readable from the declared data without inspecting evaluation logic | F-4, DM-5, DEC-11 |
| AC-F5-1 | **Given** an owner-gated change and an override declaration whose authorizer principal is not authorized for the gate's class (not the owner principal for a never-merge class), **when** `merge` runs, **then** the result is refused with exit 1 and `merge.waiver-unauthorized` naming the gate, the class, and the authorizer, and no waiver record exists afterward | F-5, DM-5 |
| AC-F5-2 | **Given** an override declaration by the authorized principal, **when** `merge` runs, **then** the waiver record is appended before any landing mutation, the gate passes under the recorded waiver, the record persists regardless of the transaction's final verdict, and an owner-gate failure with no override declaration at all refuses `merge.owner-gate-override-without-waiver` | F-5, EVT-2, DM-2, DEC-5 |
| AC-F6-1 | **Given** a declared deploy expectation set (configuration-declared expected steps and artifact patterns, or the provider-declared fact where the provider exposes it) and a trace showing those steps executed successfully and the artifacts produced, **when** `verify deploy` runs, **then** the verdict is `verified` with the trace summary, exit 0 | F-6, DEC-13, NFR-3 |
| AC-F6-2 | **Given** a deploy pipeline created but with zero executed steps, **when** `verify deploy` runs, **then** the verdict is `unknown` with reason `pipeline-created-never-ran` carried at identity `verify.deploy.trace-missing` per the declared reason↔identity map, exit 1 with a classified error envelope and `runId` — never green; **given** a green status field standing alone without supporting trace evidence or contradicting the trace, **then** the verdict is `unknown` with reason `status-stale` at identity `verify.deploy.status-stale`; and **given** no declared expectation set for the resolved deploy target, **then** the verdict is never `verified` — it degrades to unknown with the absent-evidence identity, never green | F-6, DEC-10, DEC-13 |
| AC-F6-3 | **Given** a deploy trace showing failed steps, **when** `verify deploy` runs, **then** the verdict is `failed` with the failing step named at identity `verify.deploy.trace-failed`, exit 1; and **given** the trace read itself fails as a platform fault, **then** the outcome is exit 2 with a declared existing platform/state row identity — never a new `verify.deploy.*` fault code — disjoint from the unknown verdict | F-6, DEC-8, DEC-10, DEC-13 |
| AC-F7-1 | **Given** a request behind its base whose rebase-refresh conflicts, **when** `merge` runs, **then** the result is refused with exit 1 and `merge.rebase-conflict` naming the conflicting paths inline, exactly one refresh attempt was made, and no force operation exists in the transaction's vocabulary | F-7, DEC-6 |
| AC-F7-2 | **Given** a request behind its base whose rebase-refresh succeeds, **when** the transaction continues, **then** the SHA transition voids the recorded verification and the transaction refuses `merge.gates-stale` naming the old-to-new SHA transition with the re-run remediation — the landing never proceeds on gates verified for a different SHA | F-7, F-2, DEC-6 |
| AC-F8-1 | **Given** all merge-applicable gates passing by fresh verification and probe, **when** `merge` runs, **then** the change lands as one squash commit, the landing is verified (squash SHA present on the base, request merged), the branch deletion and closeout-ready recording are declared in the output, and `result=merged` with the squash SHA exits 0 | F-8, EVT-3, DM-3 |
| AC-F8-2 | **Given** a change whose transaction record shows a verified landing, **when** `merge` re-runs, **then** the recorded verdict replays idempotently (exit 0, recorded squash SHA) with no second landing, no duplicate records, and no request mutation | F-8, DEC-12, NFR-9 |
| AC-F8-3 | **Given** the delivered daemon surface and composition, **when** the merge capability is inspected, **then** no daemon code path fires a merge — the coordinator command is the only landing producer — and every merge invocation appears in the audit ledger with its claimed identity when present | F-8, NFR-6 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one additive change through the standard 11-phase lifecycle on its feature branch; no flag-gating — a single-user local tool adds the surfaces directly.
- Delivery order inside the change: gate-registry data and the pure evaluation domains first (fixture-testable), then the three state record kinds, then the verify-gates recording change, then the `merge` and `verify deploy` surfaces; the error-table rows land with the commands that emit them so the sync check is green at every commit.
- The implementation plan (delivery planning) maps the test plan's cases onto delivery phases without reshaping any pinned behaviour, record, reason, exit, bound, or assertion; a later plan or implementation that changes a pinned contract reopens the test plan.
- The `verify gates` write gain is the one shipped-behavior change: its verdict bytes are pinned by goldens before and after; the contract change (read-only → read-plus-record) is called out in its feature documentation at reconciliation.
- The GH-229 inertness flip activates on delivery: real waiver-kind gates and `waivedBy` rendering become exercisable against recorded waivers; the SLA's owner-review permanence posture for unwaived gates is unchanged.
- Adoption: coordinators move from manual merge to `verify gates` → `merge` as one habit; the default bound (30 m) and default gate set require zero configuration to start.
- Reconciliation note for phase 7 (system_spec_update): author the new current-truth feature spec for merge and verify-deploy (always-resolve in-change), and update the neighbors — the verify-gates feature spec (gate set config-declared; the recording write; merge no longer external), the owner-gate SLA feature spec (inertness boundary flipped; waiver recording real; GAP-9 closed), the config-layer feature spec (the `merge` branch and its two keys), the state-layer feature spec (three additive record kinds and their consumers), the result-contract feature spec (the `merge` domain kind, the `verify.deploy.*` rows, the family row, the grown table), the error-table sync corpora and fixtures, the glossary, the nonfunctional bounds documentation, and the command registry/indexes — plus the M1 planning pack's seed-scenario row for SC-M1-05, whose `data.verdict` wire spelling is superseded by the classified-error deploy verdict shape while its observable semantics are preserved verbatim (a recorded reconciliation, not a silent fork).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. All three record kinds are new and append-only within the existing state schema — no schema-version bump, no backfill. Changes with no recorded verification simply refuse state-unverified until the first battery evaluation records one; waivers exist only from their first authorized declaration; the board renders `waivedBy` null for gates without recorded waivers exactly as its v0 contract declares.

## 20. PRIVACY / COMPLIANCE REVIEW

- No credentials, raw provider payloads, titles, bodies, comments, or free-form content enter the verification, waiver, transaction records, or the human output — refs, SHAs, gate ids, verdicts, bounded citations, principals, and declared reasons only.
- Waiver authorizer principals are identity references, not credentials; the bounded reason field carries operator-declared text under a length cap and passes the single serialization redaction chokepoint like every output.
- The single redaction chokepoint covers envelope, diagnostics, and audit fields; no new secret-read allowlist entry is added; the deploy trace summary carries step names and artifact references, never log bodies.
- Records are local, append-only, and bounded in content — an audit trail, not a data hold.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Authority boundary (primary):** the merge transaction is the only landing producer, and overrides never self-authorize — a waiver passes only after its authorizer principal satisfies the gate class's declared policy, resolved fail-closed (an unresolvable principal never authorizes); presence of a waiver, of expiry, or of any other state is never authority (F-5, AC-F5-1).
- **No force path:** the transaction's vocabulary contains no force operations; a conflicted refresh is a classified refusal naming paths — the destructive shortcut structurally does not exist (F-7, AC-F7-1).
- **Recorded decisions:** every override is a durable waiver record with principal and time; every invocation is in the audit ledger with its claimed identity; every landing is a transaction record with landing evidence — no hidden decisions inside the tool (EVT-1..3).
- **Evidence freshness:** the freshness envelope voids verifications on age, head-SHA change, or gate-set change, and the probe catches post-verification tracker and CI transitions — the near-miss class is closed by both bound and probe (F-2, F-3).
- **State integrity:** all merge-domain records ride the state layer's fence, permission, checksum, and torn-state discipline; a torn store is classified, never served as truth; an append failure never leaves a consumable half-verification (NFR-7).
- **Least mutation:** the transaction's mutation set is exactly one rebase attempt, one squash landing, and declared post-landing cleanup; provider interactions are read-only; no child processes beyond the declared git operations, no shell interpolation, no new credential path.
- **Brand neutrality:** no product or binary literal is committed; surfaces render the injected brand binary name.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Tuning the freshness bound is a configuration edit with origin evidence; adding gates is a declared-set edit validated by the mandatory-built-ins rule; both require no code change.
- Adding a recipe kind to the closed vocabulary is a reviewed contract-data change with tests and documentation — the extension point is explicit, not a plugin surface.
- The new error rows join the binding sync discipline: any future edit must keep both tables in parity or CI fails closed.
- The board, SLA, and future coordinator/daemon surfaces consume the same records (verification, waiver, transaction), so later features are additive consumers, not forks; the GAP-9 seam is closed and should not be re-flagged.
- Operator runbook changes: "merge" becomes verify → merge with refusals that name their remediation; stale-gate and conflict refusals are expected verdicts, not tool failures.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Merge transaction | The single coordinated unit — freshness envelope, transition probe, waiver verification, refresh path, squash landing, landing verification — that either lands verified or refuses classified. |
| Gate-verification record | The append-only state record of one full battery evaluation: ref, head SHA, time, gate-set identity, per-gate verdicts with citations, tracker posture. The freshness bound's age source. |
| Freshness envelope | The merge-time validity check over the verification record: exists, within bound, same head SHA, same declared gate-set identity. |
| Freshness bound | The declared maximum verification age (`merge.gate-freshness`, default 30 minutes); at-bound is stale. Covers tracker state as well as CI. |
| Post-verification probe | The merge-time bounded reads (tracker posture, check-run page, request position) that catch world changes after verification. |
| `tracker-freshness` | The declared merge-applicable gate entry whose refusal carries post-verification tracker transitions with the transition and its age. |
| Gate registry | The config-declared, schema-versioned gate set: id, closed recipe, surface applicability (`battery` \| `merge` \| both), optional class binding; built-ins mandatory in any declaration. |
| Surface applicability | The declared dimension splitting the shared gate set between the verify-gates battery and the merge evaluation. |
| Owner-gate classification | The declared PDR-0003 policy map (kind → class: `owner-review` never-merge; `waiver` defaultable) plus per-class waiver-authorization policy; the merge-time authority. |
| Waiver | A recorded override carrying the gate, class, authorizer principal, and time; appended only after the authorizer verifies against the class's declared policy; presence alone never passes a gate. |
| Authorizer principal | The identity declared to authorize an override; for never-merge classes it must be the provider-resolved owner principal; unresolvable principals never authorize. |
| Rebase-refresh | The single declared attempt to re-align a behind-base request; a conflict is a classified refusal naming paths; success voids the SHA-bound verification. |
| Landing verification | The post-squash evidence that the landing is real: squash SHA present on the base, request state merged. |
| Transaction outcome record | The append-only record of a landing (or replayed already-merged detection): result, squash SHA, landing evidence, refresh attempts, waiver references, post-landing steps. |
| State-unverified | The declared outcome class (exit 2) for a missing, torn, or schema-incompatible verification state — distinct from a stale-but-readable verification (exit 1 refusal). |
| Deploy trace | The deploy job's execution evidence: steps executed with outcomes and artifacts produced. The only evidence a `verified` deploy verdict accepts. |
| `pipeline-created-never-ran` | The declared unknown reason for a pipeline with zero executed steps — never green; carried at identity `verify.deploy.trace-missing` per the declared reason↔identity map. |
| `status-stale` | The declared unknown reason when a status field stands alone without trace evidence or contradicts the trace — disqualified as evidence; carried at identity `verify.deploy.status-stale`. |
| Reason↔identity map | The one declared, bidirectional contract-data map binding deploy verdict reasons to error identities: absent-evidence unknown (including created-never-ran keeping its reason) → `verify.deploy.trace-missing`, `status-stale` → `verify.deploy.status-stale`, failed-step → `verify.deploy.trace-failed`; no fourth row, no fourth reason. |
| Dry-run | `merge --dry-run`: evaluate the full merge-applicable battery, append exactly one verification record, print the battery verdict (exit 0 all pass; classified refusal exit 1 on any failure), land nothing — zero mutations, no waiver record, no transaction record, never `result=merged` or `squash=`; whether the freshness envelope over a pre-existing record is additionally reported is delivery-bound. |

## 24. APPENDICES

### Appendix A — Planning-pack anchors and recorded refinements

- Proposed contracts: `merge <ref> [--dry-run]` (gates fresh, squash, landing verified; refusal names the gate with inline evidence) and `verify deploy <ref>` (verdict by job trace; created-never-ran reads unknown never green; stale status disqualified). Timing default: gate freshness bound 30 m, key `merge.gate-freshness`, owned by M1-S4. Seed scenarios SC-M1-01..05 are inherited verbatim by the test plan.
- **Recorded refinement — refusal envelope shape:** the pack's scripted refusal example renders `{"data":{"result":"refused",...}}`. The shipped result contract renders scripted failures as `{"error":{...},"runId":...}` (verify gates precedent: on failure there is no `data`), and the shared pin itself says "classified error". This spec pins classified-error refusals (DEC-4): exit 1, envelope `error`, evidence inline in the structured summary/remediation hint, full citations on the diagnostics stream, `result=refused` retained in text mode. The pack example is treated as illustrative shorthand for the verdict semantics, not the wire shape.
- **Recorded refinement — gate ids:** the pack's examples use `ci-on-pushed-sha` and `tracker-freshness`; the shipped battery's ids are `ci-green` and `owner-gate`. This spec preserves the shipped built-in ids (backward compatibility, byte-identical default battery output) and models `tracker-freshness` as a declared merge-applicable entry (DEC-2), so the pack's refusal wording ("names tracker-freshness", "cites the owner-gate scan", SC-M1-03) is satisfied exactly.
- **Recorded refinement — error rows:** the pack's "notable" lists omit identities the pack's own semantics require: the exit-2 state-unverified and platform rows, the unknown-consequence landing case, the clean-abort identity, and the failed-trace verdict row. DEC-7 declares the full set; both tables are updated in the same change.
- **Recorded refinement — waiver recording surface:** the pack requires recorded waivers without naming a recording path; the synopsis has no waiver flag. This spec declares the override on the merge surface (DEC-5) — record-after-verify, durable regardless of the transaction verdict — closing the GAP-9 seam GH-229 named.
- **Pack-internal inconsistency noted, not delivered:** the pack's `tracker-freshness` evidence string ("ticket moved to owner-gated 6 min after verification") appears under a `merge.gates-stale` heading in one artifact and as a gate failure in another; this spec separates them cleanly — age/bound/SHA/set violations are `merge.gates-stale`, gate-level violations (including the post-verification transition) are `merge.gate.<gate-id>.failed` (SC-M1-02's assert allows either code for the stale case). The reopened-specification iteration pins the precedence within that separation (DEC-13): the envelope violation is primary when stale, the gate row when fresh.
- **Recorded refinement — deploy verdict wire shape (DoR iteration):** the pack's `verify deploy` example renders `data.verdict`; the delivered contract renders negative verdicts as classified errors. This spec pins the classified-error shape for deploy negative verdicts — identity `verify.deploy.*`, `runId`, no `data` sibling, text `verdict=` continuity — superseding SC-M1-05's `data.verdict == unknown` spelling while preserving its observable semantics verbatim; the pack seed row's reconciliation is a phase-7 documentation obligation (§18), not a silent fork.

### Appendix B — Current-truth reuse map

| Reused truth | Source surface | What this change takes from it |
|---|---|---|
| Five built-in gates with cited pass/fail/unknown verdicts, deterministic request resolution, read budgets | Verify gates (delivered) | The battery evaluation engine and its default entries, now config-declared; the recording append is new |
| Family-row mechanism (`status.collector.<id>.unavailable`) | Result contract | The `merge.gate.<gate-id>.failed` family row pattern with slot validation |
| Envelope, scripted trim, exit projection, redaction, audit seam | Result contract + command audit ledger | The new commands' output/failure posture and the who-fired-it trail |
| Additive fenced record kinds with post-append verification | State layer (closeout, commit-telemetry, owner-gate precedents) | The verification, waiver, and transaction record kinds |
| Atomic land-and-record with abort convergence | Commit primitive | The squash-landing transaction's atomicity and idempotent replay pattern |
| PDR-0003 two-row kind/class map, gate-kind vocabulary, comparator seam | Owner-gate SLA (GH-229) | The classification consumed as merge authority; the GAP-9 seam this change closes |
| Typed catalog branch with origins | Configuration layer | The `merge` branch (`merge.gate-freshness`, `merge.gates`) |
| Normalized work items, provider-resolved repository identity | Tracker slice (ADR-0004) | The posture probe and the never-merge authorizer resolution |

### Appendix C — Amendment record (v1.1, reopened specification, iteration 2)

The specification phase was reopened after the test plan surfaced sixteen precision gaps with pinned fail-closed readings. All sixteen are adopted as spec truth with no deviation; this table maps each gap to the amended spec truth so reviewers can diff intent quickly. Spec-side gap ids below are the test plan's recorded gaps; GH-229's separate `GAP-9` seam marker (the waiver-recording surface in the delivered CLI edge) is a different namespace and remains closed by F-4.

| GAP | Reading adopted (test plan §1.2) | Spec truth amended |
|---|---|---|
| GAP-1 | The implementation plan maps all test cases onto delivery phases without reshaping any pinned contract; a later reshaping reopens the test plan | §18 (plan-mapping obligation); process truth, no contract change |
| GAP-2 | One declared bidirectional reason↔identity map: absent-evidence unknown (including created-never-ran keeping its reason) → `verify.deploy.trace-missing`; `status-stale` → `verify.deploy.status-stale`; failed-step → `verify.deploy.trace-failed`; no fourth row, no fourth reason; every row reachable, every reason maps to exactly one row | F-6, AC-F6-2, AC-F6-3, DEC-13, glossary |
| GAP-3 | The deploy expectation set is declared data read from contract data — configuration-declared expected steps/artifact patterns (the provider-declared fact serving where the provider exposes it); no declared expectation ⇒ never `verified` (unknown with the absent-evidence reason), never green | F-6, AC-F6-1, AC-F6-2, DEC-13 |
| GAP-4 | Deploy negative verdicts = classified error, exit 1, `verify.deploy.*` identity, `runId`, no `data` sibling; text `verdict=` continuity keys; SC-M1-05's `data.verdict` spelling superseded, semantics preserved; pack row reconciled at phase 7 | F-6, DEC-13, §18, Appendix A |
| GAP-5 | Dry-run evaluates the merge-applicable battery, appends exactly one verification record, performs zero mutations, reports the battery verdict (0 all pass / 1 classified refusal), never `result=merged` or `squash=`; pre-existing-envelope reporting delivery-bound and unasserted | F-2, DEC-13, glossary |
| GAP-6 | Freshness-envelope violation ⇒ `merge.gates-stale` primary with the probe observation as additional inline evidence; fresh verification + probe observation ⇒ the gate row; recorded evidence fields identical either way | F-2, F-3, DEC-13 (AC-F2-1 already matched) |
| GAP-7 | Waiver declaration grammar delivery-bound; the behaviour, record content, ordering, and refusal identities are pinned and may not be rebound | F-5, DEC-13 |
| GAP-8 | No new platform row: a provider/state fault reuses a declared existing platform/state identity; the class asserted is platform, exit 2, classified | F-6, §8.5, DEC-13 |
| GAP-9 | Built-in ids reserved: an entry reusing one must declare the shipped recipe and applicability; any other redefinition is a classified configuration failure (fail-closed, consistent with RSK-3) | F-1, AC-F1-2, DEC-13 |
| GAP-10 | `merge.landing-unverified`: exit 2, category platform, retryable false, consequence `unknown` — the mutation fired and its landed state is unestablished; a re-run re-verifies rather than re-lands, never reports success | DEC-13, field table below |
| GAP-11 | `merge.transaction-aborted`: exit 1, category user, retryable true, consequence `not_landed` — a clean, retryable refusal | DEC-13, field table below |
| GAP-12 | A dry run verifies and reports a declared override's authorization but records no waiver and no transaction record; waiver recording is a landing-transaction act | F-5, F-2, DEC-13, glossary |
| GAP-13 | The family-row slot validator accepts any id present in the effective declared gate set (registry-validated) and rejects empty, malformed, or undeclared ids; the sync recognizer stays narrow with no pattern widening | NFR-8, DEC-13 |
| GAP-14 | No-force asserted non-vacuously: the mutation operation vocabulary contains no force variant, a production-surface scan runs against a mandatory failing control, and a control-less pass is vacuous; technique delivery-bound | F-7, DEC-13 |
| GAP-15 | Delivery-bound spellings (export names, schema/kind strings, labels, evidence rendering, marker/identity fields) vs the pinned vocabulary (ids, verdicts, reasons, classes, codes, exits, comparator, caps) — the vocabulary may not be rebound | §8.3 note, DEC-13 |
| GAP-16 | Prose-free deploy failure envelope: the classified code is the machine identity; the reason datum is text-mode plus the declared map; consumers map codes, never parse prose | F-6, AC-F6-2, DEC-13 |

**New-row field and exit pins (DEC-13; the documented and machine tables carry the same fields):**

| Code | Category | Retryable | Consequence | Exit |
|---|---|---|---|---|
| `merge.gate.<gate-id>.failed` (family) | user | false | not_landed | 1 |
| `merge.gates-stale` | user | false | not_landed | 1 |
| `merge.waiver-unauthorized` | user | false | not_landed | 1 |
| `merge.owner-gate-override-without-waiver` | user | false | not_landed | 1 |
| `merge.rebase-conflict` | user | false | not_landed | 1 |
| `merge.state-unverified` | platform | false | not_landed | 2 |
| `merge.landing-unverified` | platform | false | unknown | 2 |
| `merge.transaction-aborted` | user | true | not_landed | 1 |
| `verify.deploy.trace-missing` | user | false | not_landed | 1 |
| `verify.deploy.status-stale` | user | false | not_landed | 1 |
| `verify.deploy.trace-failed` | user | false | not_landed | 1 |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @spec-writer | Initial specification from the PM planning session (clarify_scope validated) and the M1 planning pack; freshness-evidence source, gate-registry shape, waiver record shape, error rows, and pack refinements pinned as DEC-1..DEC-12; zero open questions |
| 1.1 | 2026-11-06 | @spec-writer | Reopened-specification amendment (iteration 2): adopted all sixteen test-plan gap readings (GAP-1..GAP-16) as spec truth with no deviation — deploy reason↔identity map (no fourth row/reason), configuration-declared deploy expectations with fail-closed never-`verified`, classified-error deploy verdicts with SC-M1-05 pack reconciliation at phase 7, dry-run zero-mutation and no-waiver-recording semantics, freshness-envelope precedence over per-gate identities, reserved built-in ids, field/exit pins for the eleven new rows (landing-unverified 2; transaction-aborted 1), effective-declared-set family-slot validation, platform-fault identity reuse, non-vacuous no-force assertion, pinned-vocabulary vs delivery-bound split (DEC-13, Appendix C); G-1..G-8 and AC ids unchanged |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-225 goal, tasks, AC, and pinned decisions (refusal semantics; config-declared versioned gate set; freshness covering tracker state; waiver authorizer verification; single rebase-refresh), the PM planning summary (validated at clarify_scope), the M1 planning pack (backlog M1-S4; contracts `merge` and `verify deploy` entries; the two command man pages; test scenarios SC-M1-01..05; timing defaults), and the delivered current-truth specs (verify gates, config layer, state layer, result contract, owner-gate SLA, commit primitive, audit ledger).
- Pinned decisions from the ticket are recorded as decisions (DEC-3, DEC-4, DEC-5, DEC-6, DEC-8, DEC-10) or capabilities (F-2, F-5, F-6, F-7), never re-derived or contradicted.
- The freshness-evidence source was directed by planning ("design against the shipped state-layer conventions; specify what records verification recency and who writes it"); DEC-1 pins the battery as the writer and merge as the consumer.
- Tech-neutral by design: no module names, file paths, or implementation steps; the plan writer derives placement from the delivered package tiers and the boundary rules.
- Quantified NFRs reuse the delivered reference values (65 536 bytes, 4 096 bytes / 24 lines, one-page-per-source read budgets) so the change matches the system's established bounds discipline.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-225)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, EVT-)
- [x] Acceptance criteria reference at least one F-/DM-/EVT-/NFR-/DEC- ID and use Given/When/Then
- [x] Ticket AC covered 1:1 by testable criteria with an explicit traceability line (AC 1 → AC-F2-1; AC 2 → AC-F2-2 + gate-level refusals; AC 3 → AC-F6-1..3; AC 4 → AC-F1-1..2; AC 5 → AC-F3-1; AC 6 → AC-F4-1; AC 7 → AC-F5-1..2; AC 8 → AC-F7-1..2)
- [x] NFRs include measurable values (bounds, budgets, percentages, exit semantics)
- [x] Risks include Impact & Probability (H/M/L) with mitigation and residual risk
- [x] Out-of-scope items prefixed `[OUT]` and name the owning stories explicitly (M1-S12, M1-S16/S17/S18/S20/S23)
- [x] No implementation details (no code file paths, no step-by-step tasks)
- [x] Unresolved decisions: none — all specification-time decisions pinned as DEC-1..DEC-13; policy-table content beyond this vocabulary remains GH-229-owned
- [x] v1.1 amendment: reopened specification — all sixteen test-plan gap readings (GAP-1..GAP-16) adopted as spec truth (DEC-13, Appendix C); `status` remains Proposed; G-1..G-8 and AC-F1..AC-F8 ids unchanged; test plan remains valid as-is
- [x] Front matter validates per front_matter_rules
