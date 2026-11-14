---
change:
  ref: GH-310
  type: feat
  status: Proposed
  slug: cross-repository-changes
  title: "M2-S19: Cross-repository changes (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  labels: [milestone-m2, plan, verify-gates, closeout, queue, multi-repository, review-flow]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "GH-309 (M2-S18 project groups — delivered on main-tools; supplies groupKey/repoKey identity)"
      - "GH-288 (M2-S11 multi-repository workstations — delivered)"
      - "M1-S17 scheduling engine (delivered: queue entries, dependency edges, lanes, removal reasons)"
      - "Delivered plan schema and verdicts (feature-plan-schema.md; delivery.plan.v1)"
      - "Delivered verify gates report and read budget (feature-verify-gates.md; delivery.verify-gates.v1)"
      - "Delivered closeout transaction and additive discipline (feature-closeout.md; delivery.closeout.v1)"
      - "Delivered result contract envelope, error table, and {0,1,2} projection (feature-result-contract.md)"
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Let one change span several member repositories of one project group — one lifecycle, one spec, one plan, one shared definition of done — by declaring the member set and slices in the plan, holding one queue entry and one lane per member with dependency edges, corroborating CI per member before the change counts done, and reporting a closeout that enumerates every member pull request in landing order and names the member that blocks.

## 1. SUMMARY

ADOS assumes one change is one repository. The plan declares phases and scope only; `verify gates` resolves a single open pull request and one CI head; closeout resolves one merged delivery request and reports one repository; and the queue holds one entry per change. A change that genuinely spans two member repositories of one configured project group therefore has no declared member set, no per-member gates or CI corroboration, no per-member closeout report, no ordering between member slices, and no single executable review flow — so a partly landed change can read as done, an unavailable CI reading can pass as green, and a reviewer cannot see which member blocked the change.

This change delivers the M2 contract for cross-repository changes: the additive `plan.data.members[]` declaration (one entry per member with `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn[]`, `gates`) that `plan validate` parses, validates, and echoes without weakening any delivered rejection; the shared verdict at `verify gates` as `data.definitionOfDone` (`status`, `members[]` with `repoKey`/`gates.ci`/`verdict`, `evidence[]` in landing order) plus `data.blockingMembers[]`, with per-member CI truth read on each member's pushed head and an unavailable reading blocking as a classified outcome rather than counting as green; `closeout.data.members[]` (`repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, `landed`) with one landing removal per member; one queue entry and one lane per member keyed by that member's ref, with per-member dependency edges and per-member removal; dependency ordering that holds a member step until its prerequisite member's pull request lands; and exactly one review run over the declared member pull-request set with one verdict per member. Plans that declare no members keep every delivered single-repository surface byte-identical.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The plan schema is document-level `delivery.plan.v1` (delivered).** The accepted shape is `schemaVersion`, optional `workItemRef`, required `tier`, optional `defaultLeases`, optional `defaultWeightClass`, and required `phases[]` (1..64) with `id`, `title`, optional `summary`, `kind`, `scope`, optional `leaseClass`, `leases`, `weightClass`, `doneArtifacts`, and `interactions`. The plan declares phases and scope only: no task log, no progress state (feature-plan-schema.md).
- **Unknown-key handling today, verified.** The delivered validator rejects unknown keys **only** in two places: unknown `scope.*` keys and unknown `doneArtifacts.*` slots. An unknown **top-level** document key and an unknown **per-phase** key are silently ignored — the validator walks the keys it knows and never enumerates the document's or a phase's own key set. Consequence: a `members:` key written into a plan today parses, validates, and is dropped from the verdict with no echo and no error (verified against the delivered validator and its per-phase parse).
- **`verify gates` is single-target (delivered).** `verify gates <changeRef>` evaluates the declared battery (default five built-ins in shipped order) with one cited `pass`/`fail`/`unknown` per gate; the overall result is `pass` only when every evaluated gate passes; `unknown` is never a pass; the battery is evaluated without short-circuit. Target resolution is one deterministic open-PR rule; the report schema is `delivery.verify-gates.v1` with `schemaVersion`, `changeRef`, `target`, `overall: "pass"`, `summary`, and `gates[]`; the envelope is `delivery.result.v1`. The read budget is bounded per source: one local ledger read, one repository HEAD/branch read, one CI-workflow read, at most one open-PR page (100), one resolved detail read, one check-run page (100), one work-item read, no retries, no pagination. On failure the delivered surface emits no `data`; a classified unknown reuses the first unknown gate's own projection.
- **Closeout is single-request (delivered).** `closeout <ref>` computes a deterministic twelve-step plan (`ticket-to-done`, `lifecycle-label-sweep`, `unassign`, `owed-flip-sweep`, `comment-resolution`, `checkout-restore`, `worktree-cleanup`, `branch-cleanup`, `merged-diff-sweep`, `retro-coverage-move`, `session-compaction`, `capsule`), resolves **one** merged delivery request by a bounded source-ref lookup (highest numeric provider identity wins, `merged_at` is merge truth), writes an append-only `closeout.operation` ledger, and reports one repository. `delivery.closeout.v1` is additive-optional-field disciplined: consumers resolve steps by `stepId` and tolerate unknown step ids and additive fields. Its declared non-goals include "Cross-repository closeout, global state, or multi-repo fan-out".
- **The queue is keyed by one canonical change ref (delivered).** An entry carries `ref`, optional `repository`, priority; the graph fold keys entries and dependency records by the **canonical ref alone** (entries and edge sets are folded to the latest record per canonical ref). Canonicalization normalizes to `<PREFIX>-<digits>` (uppercase prefix, digits without leading zeros, at most `QUEUE_MAX_REF_CHARS` = 64). Removal reasons are closed: `landed`, `abandoned`, `superseded`, `reconciled`. A removal skips with `ref-not-canonical` when the ref does not canonicalize. Readiness exposes one blocking reason per unmet edge, including `dependency-open`; a start on an unsatisfied ref is refused with `queue.precondition.unmet`; a cycle-creating edge mutation is refused with `queue.dependency-cycle`. Admission is per-ref single-flight — one active lane per ref.
- **Group identity is delivered and consumed, not modified.** `feature-project-groups.md` supplies `groupKey` (group identity), `repoKey` (`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$`, bounded basename), configuration-only membership, and the group-scoped aggregation vocabulary. This change consumes `repoKey` as the member identity and adds no group-scoped store.
- **The result contract is delivered.** Envelope `delivery.result.v1` carries exactly `schemaVersion`, `runId`, `exitCode`, `timing`, and exactly one of `data`/`error`; new keys live under `data`; the projection maps `success`→`0`, `user-validation`→`1`, `attention`→`1`, `platform-provider`→`2`. A data-bearing negative verdict is a delivered precedent: `plan validate` returns an `invalid` verdict **with data** at exit `1`, and the error table already carries the reusable identities this change needs (`plan.schema.invalid`; `queue.precondition.unmet`; `queue.dependency-cycle`).
- **The two-repository test seam exists.** `tests/fixtures/projects/temp-repos.ts` creates real temporary repositories, bare origins, commits, and clones with a sanitized git environment and a pinned `GIT_CEILING_DIRECTORIES`, so a two-member change can be exercised hermetically with injected provider observations and no live network.

### 2.2 Pain Points / Gaps

- **GAP-1**: No declared member set. A plan cannot state that a change spans repositories, which slice belongs to which member, which branch and pull request carry it, which member step depends on which, or which gates apply to a member.
- **GAP-2**: No shared definition of done. `verify gates` decides one CI head, so a two-repository change is either unrepresentable or silently decided by one member's evidence.
- **GAP-3**: No per-member CI corroboration. CI truth on each member's pushed head is neither read per member nor recorded, so a partly landed change can read as done.
- **GAP-4**: No unavailable-CI classification. There is no place to record "the reading was unavailable", so the absence of evidence can be consumed as if it were a pass.
- **GAP-5**: No per-member closeout report. Closeout resolves one merged request and reports one repository, so member branch cleanup, per-tracker issue closure, and per-member landing are invisible.
- **GAP-6**: No per-member queue representation. One canonical ref per change means one entry, one lease, one lane, and one removal, so a member that lands cannot be retired without retiring the whole change.
- **GAP-7**: No member ordering. Nothing prevents a member step from starting before the member it depends on has landed.
- **GAP-8**: No executable review flow. "Review the change" is one ref-shaped instruction, so two member pull requests have no run identity, no per-member verdicts, and no once-only guarantee.

## 3. PROBLEM STATEMENT

Because the tooling models one change as exactly one repository — the plan cannot declare members, `verify gates` and closeout each resolve a single delivery request, and the queue keys one canonical ref per change — a change that genuinely spans two member repositories of one project group cannot declare its member set, cannot corroborate CI per member, cannot report per-member landing, cannot order member slices, and cannot be reviewed as one flow; as a result a partly landed change can read as done, an unavailable CI reading can pass as green, and a failing or blocking member cannot be named.

## 4. GOALS

- **G-1**: One change declares its member set: `plan.data.members[]` carries one entry per member with `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn[]`, and `gates`, validated and echoed by `plan validate`.
- **G-2**: One shared definition of done decides the change: `verify gates` reports `data.definitionOfDone` (`status`, `members[]` with `repoKey`/`gates.ci`/`verdict`, `evidence[]` in landing order) plus `data.blockingMembers[]`.
- **G-3**: CI truth is corroborated per member on that member's pushed head, and an unavailable reading blocks the shared definition of done as a classified outcome rather than counting as green.
- **G-4**: Closeout reports per member: `closeout.data.members[]` with `repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, and `landed`, with per-member landing removal.
- **G-5**: The queue holds one entry and one lane per member keyed by that member's ref, with per-member dependency edges and per-member removal, and never a cross-repository lane.
- **G-6**: Member dependency order holds: a member step with a dependency edge does not start before the prerequisite member's pull request lands, and member evidence lists the pull requests in landing order.
- **G-7**: Exactly one review run covers the declared member pull-request set, with one verdict per member and no member reviewed twice.
- **G-8**: Single-repository behaviour is preserved: a change whose plan declares no members produces byte-identical plan, gates, closeout, and queue output with unchanged exits.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance criteria demonstrated | 4 of 4 (AC1–AC4, mapped in Appendix B) |
| Cross-repository acceptance criteria green | All 29 §17 criteria pass with named observable surfaces |
| Partial landing read as done | 0 occurrences: `definitionOfDone.status` is never `green` while any declared member is not `pass` |
| Unavailable CI counted as green | 0 occurrences: an unavailable reading is recorded as `gates.ci: unavailable` and never `pass` |
| Single-repository parity | Byte-identical plan/gates/closeout/queue output and identical exits for plans declaring no members (100% of parity fixtures) |
| New error-table rows introduced | 0 (only delivered identities are reused) |
| Envelope conformance | 0 new top-level envelope keys; every new key under `data` |
| Live network calls in default tests | 0 (both members are real local temporary repositories with injected provider observations) |
| Quality gates | `TMPDIR=/home/juliusz/tmp pnpm check` green before the PR opens |

### 4.2 Non-Goals

- **NG-1**: No live multi-repository network execution — no second real remote, no live cross-repository provider fan-out in default runs; the two-member flow is exercised with local temporary repositories and injected provider observations.
- **NG-2**: No merge authority — the delivering pull request stays open for human review; this change performs no merge, no auto-merge, and no cross-repository merge transaction.
- **NG-3**: No global cross-repository state store and no group-scoped store — membership, phase state, queue entries, and lane leases stay per-checkout; the member report is derived output, not a new store.
- **NG-4**: No board change — the board stays repository-keyed and is never group-scoped or member-scoped.
- **NG-5**: No new tracker adapter — the delivered GitHub slice is exercised; per-member tracker kinds remain declarative and an unimplemented kind stays classified, never silently rejected.
- **NG-6**: No MCP or OpenCode/host surface change — the CLI envelope is the observable surface; no new MCP tool and no prompt-set change.
- **NG-7**: No rewrite of delivered single-repository behaviour — every unscoped or member-less surface stays byte-identical (parity is a requirement, not a nicety).
- **NG-8**: No per-member file scope — the plan's phases keep declaring scope; a member's `slice` is a descriptive declaration, not a scope matcher, and `plan diff`/`plan overlap` are unchanged.
- **NG-9**: No current-truth feature-spec amendment by this specification — current truth flips in phase 7 (system_spec_update), except the error-identity/documentation rows this change reuses, which are already documented.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Plan member declaration: `plan.data.members[]` validated and echoed | A change must be able to declare its member repositories and slices |
| F-2 | Member queue representation: one entry, one lane per member, per-member edges and removal | A member must be retirable on its own landing without retiring the change |
| F-3 | Shared definition of done with per-member CI corroboration and named blockers | One verdict must decide the change while every member's evidence stays visible |
| F-4 | Member dependency ordering enforcement | A dependent slice must not start before its prerequisite lands |
| F-5 | Closeout member report with per-member cleanup, issue closure, and landing | Post-merge reporting must enumerate members and never claim an unlanded member |
| F-6 | One executable review flow over the declared member pull-request set | Two member pull requests need one run, one verdict each, and a once-only guarantee |
| F-7 | Single-repository parity preservation | Delivered behaviour for member-less changes must not move |

### 5.1 Capability Details

- **F-1 — Plan member declaration.** `delivery.plan.v1` gains one additive optional document-level key, `members[]`: at most eight entries, each declaring exactly `repoKey` (a declared member repository key), `slice` (a non-empty description of the portion of the change delivered in that member), `branch` (the member branch), `pullRequest` (the member pull request identity, optional at authoring because plans are written before pull requests exist), `dependsOn[]` (zero to eight member `repoKey` values, never the member itself, each naming a member declared in the same list), and `gates` (a non-empty array of up to sixteen gate identifiers). The schema identifier is unchanged. Validation is closed and classifying: a duplicate `repoKey`, an unknown member key inside an entry, a `dependsOn` element naming no declared member, a self edge, a dependency cycle, an over-bound list, or a member whose derived member ref would exceed the queue ref bound is `plan.schema.invalid` naming the member position and field. `plan validate` echoes the declaration verbatim in declared order under `data.members[]`; `lint plan` reports the same defects with document locations; the plan's phases, scope matching, diff, and overlap are untouched. Gate identifiers are shape-validated only — the plan verdict reads no configuration — and an identifier the effective gate set does not declare is resolved at `verify gates` as that member's `unknown` evidence, never as a pass (DEC-9).
- **F-2 — Member queue representation.** A plan declaring `members[]` gives the change one queue entry per member, keyed by that member's member ref `<canonicalChangeRef>@<repoKey>` (DEC-2), with each entry bound to its member repository and carrying its own lease and its own lane; there is never a cross-repository lane and no entry keyed by the bare change ref for such a plan. `dependsOn[]` declarations become per-member dependency edges onto the prerequisite members' member refs. Release drops each member's lease while the entries stay; removal happens per member with the change's reason (`landed`, `abandoned`, `superseded`, or `reconciled`); one member landing removes only its entry and re-evaluates the remaining members' readiness. An unsatisfied declared edge makes the member entry `not-ready` with the delivered `dependency-open` blocking reason. A plan declaring no members keeps the delivered single canonical ref, entry, lease, lane, and removal behaviour unchanged.
- **F-3 — Shared definition of done.** For a plan declaring members, `verify gates` reports, under `data`: `definitionOfDone` = `{ status, members[], evidence[] }` where `status` is `green`, `blocked`, or `incomplete`; `members[]` carries exactly one entry per declared member in declared order with `repoKey`, `gates.ci`, and `verdict`; and `evidence[]` lists the member pull requests in landing order (DEC-6). It also reports `data.blockingMembers[]`, the `repoKey` of every member preventing green, in declared order. `gates.ci` is a closed four-value vocabulary (`pass`, `fail`, `unavailable`, `absent`) read on that member's pushed head: `unavailable` is a classified reading failure and `absent` means no pushed head or no run for it — neither is ever green. `verdict` is the closed three-value member verdict `pass`, `fail`, `unknown`, where `unknown` is never a pass and a member with an unresolvable declared gate identifier is `unknown`. Per-member resolution is a bounded extension of the delivered read budget (DEC-10): one bounded open-PR page per member, one resolved detail read per member, one check-run page per member, no retries and no pagination, plus the one bounded local plan read that supplies the member set. The evaluation never short-circuits: every member is evaluated and reported (DEC-3, DEC-4).
- **F-4 — Member dependency ordering.** A member step carrying a dependency edge does not start before the prerequisite member's pull request lands. Enforcement is layered: the member entry is `not-ready` with `dependency-open` while a prerequisite is unlanded; a start attempt on that entry (claim, dispatch, or any start path keyed to the member ref) is refused with the delivered `queue.precondition.unmet` naming the member and its unlanded prerequisite; and a queue edge mutation that would close a cycle among member refs is refused with the delivered `queue.dependency-cycle`. A dependency cycle inside the plan declaration is caught earlier, at plan validation, as `plan.schema.invalid` (F-1). A member step is admitted only once its prerequisite's landing is observable; the declared edge alone never admits it.
- **F-5 — Closeout member report.** For a plan declaring members, `closeout` resolves merge truth per declared member pull request and reports one additive `data.members[]` entry per member in declared order with `repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, and `landed`. `cleanup` carries the member branch-cleanup step's delivered outcome value; `issueClosure` carries the member's work-item transition step's delivered outcome value; `landed` is boolean merge truth and is `true` only when the member's merge is observed — never inferred from a green pipeline or a closed branch. The twelve delivered step ids are unchanged (no new step id; consumers still resolve steps by `stepId` and tolerate additive fields); per-member work rides the existing steps: `branch-cleanup` expands to one member branch per declared member under the delivered squash-safety predicate, `ticket-to-done` expands to one transition per member's tracked item, and `comment-resolution` iterates the member pull-request set. Landing removal happens per member: an observed merged member pull request retires that member's member-ref entry with reason `landed` inside the held fence, leaving other members' entries untouched. A member's absent merge truth keeps the delivered skip semantics and never counts as landed.
- **F-6 — One executable review flow.** The review flow is one run over the declared member pull-request set, reported as an additive `data.reviewFlow` block beside the shared verdict: `{ runId, complete, verdicts[] }`. `runId` is the stable identity of the member set (DEC-8), so a second run over an unchanged set is the same run and adds no verdict entry. `verdicts[]` carries exactly one entry per declared member in declared order with `repoKey`, `pullRequest`, and `verdict` in the closed set `pass`, `fail`, `unreviewed`; `complete` is `true` only when every declared member has exactly one verdict. A member with more than one recorded review observation cannot read as reviewed: it is `fail` with `complete` false, and no second verdict entry appears. The flow is pure over injected review observations at the composition edge: no new store, no new command, and no live network in default runs.
- **F-7 — Single-repository parity.** A plan that declares no `members[]` produces the delivered behaviour exactly: the plan verdict is byte-identical with no `members` key, `verify gates` emits the delivered report with no `definitionOfDone`, `blockingMembers`, or `reviewFlow`, closeout emits no `members` key, and the queue keeps the delivered single canonical ref entry with the delivered lane, removal, and skip semantics. Parity is measured by byte comparison against the pre-change goldens, not asserted by prose.

## 6. USER & SYSTEM FLOWS

```
Flow 1: One lifecycle drives two member branches and two pull requests (AC1)
  A change declares members[] with two entries (api, web), each with its
  branch, gates, and a slice; the second dependsOn the first.
  → one spec and one plan exist in the change folder (no per-member folder)
  → queue gains two entries keyed <ref>@<api> and <ref>@<web>, one lane each,
    and the web entry carries the edge to the api entry
  → each member gets its own branch and pull request; one review run covers
    both with one verdict per member
  → closeout (apply) reports both members with branch cleanup, per-tracker
    issue closure, and landed=true for each; each landing removes only its
    member entry.

Flow 2: A failing member blocks the shared definition of done (AC3)
  → api passes its member gates; web fails one of its declared gates
  → verify gates reports definitionOfDone.status=blocked,
    members[] verdict pass for api and fail for web, and
    blockingMembers[]=[web.repoKey]; the report is present and the exit is 1.

Flow 3: Per-member CI corroboration and an unavailable reading (AC2)
  → verify gates reads the CI verdict on each member's own pushed head
  → both heads read: gates.ci=pass for both, status=green, exit 0
  → one head's reading is unavailable: gates.ci=unavailable,
    verdict=unknown (never pass), blockingMembers names that member,
    status is not green, exit 1.

Flow 4: Dependency ordering holds the dependent slice (AC4)
  → a start attempt on the web entry while api's pull request is unlanded is
    refused with queue.precondition.unmet naming web and api; the web entry
    reads not-ready with dependency-open
  → api's pull request lands → web's entry becomes startable
  → evidence lists the api pull request before the web pull request.

Flow 5: Member-less change stays byte-identical (parity)
  → a plan with no members[] runs plan validate, verify gates, closeout, and
    queue exactly as delivered: no members key, no definitionOfDone, one
    canonical-ref entry, identical bytes and exits.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The additive plan declaration `members[]` (eight-entry bound; fields `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn[]`, `gates`) with closed validation, the classified `plan.schema.invalid` defects, the `plan validate` echo, and the `lint plan` location report.
- The member queue representation: member ref `<canonicalChangeRef>@<repoKey>`, one entry and one lane per member, per-member dependency edges, per-member lease release, per-member removal with the closed reason vocabulary, and the member-form canonicalization extension.
- The shared verdict block `data.definitionOfDone` (`status`, `members[]` with `repoKey`/`gates.ci`/`verdict`, `evidence[]` in landing order) and `data.blockingMembers[]` on `verify gates`.
- Per-member CI corroboration on each member's pushed head through a bounded per-member extension of the delivered read budget, with `unavailable` and `absent` never green.
- Dependency ordering enforcement across member steps (entry blocking reason, start refusal identity, cycle refusal identity).
- The closeout member report `data.members[]` and per-member landing removal, riding the delivered twelve steps.
- One executable review flow reported as `data.reviewFlow` over the declared member pull-request set.
- The status and verdict vocabulary pins (`green`/`blocked`/`incomplete`; `pass`/`fail`/`unavailable`/`absent`; `pass`/`fail`/`unknown`; `pass`/`fail`/`unreviewed`) and the exit projection of the cross-repository report.
- Single-repository parity proofs for every touched surface (plan, gates, closeout, queue).
- Fixture work over the delivered two-repository temporary-checkout seam with injected provider observations.
- Milestone bookkeeping per planning conventions (backlog M2-S19 progress marker, status snapshot, M2 contracts ownership line).

### 7.2 Out of Scope

- [OUT] Live multi-repository network execution or a second real remote (NG-1); default tests stay offline and hermetic.
- [OUT] Merge authority, auto-merge, or a cross-repository merge transaction — the pull request stays open for human review (NG-2).
- [OUT] Any global cross-repository state store, group-scoped store, or new durable record kind (NG-3).
- [OUT] Board work of any kind, group-scoped or member-scoped (NG-4).
- [OUT] New tracker adapters or provider write surfaces beyond the delivered GitHub slice (NG-5).
- [OUT] MCP and OpenCode/host surface changes (NG-6).
- [OUT] Per-member file scope, member-aware `plan diff`, or member-aware `plan overlap` (NG-8).
- [OUT] Retirement or redefinition of delivered single-repository behaviour, and any change to delivered exit meanings (NG-7).
- [OUT] New error-table rows — every refusal in this change reuses a delivered identity.
- [OUT] Amendment of current-truth feature specifications by this specification (NG-9); phase 7 reconciles them.
- [OUT] Review-execution tooling: no review command, no review model call, no review store.

### 7.3 Deferred / Maybe-Later

- Per-member declared file scope, so member scope could be matched and diffed per repository.
- A durable review-verdict record (if a later change wants review verdicts to survive beyond the report).
- Remote branch or remote ref cleanup per member (the delivered closeout keeps remote cleanup out of scope).
- Cross-repository board and cross-repository spend/brief surfaces.
- Worktree-per-member delivery parallelism.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface is added or changed. The observable surfaces are CLI commands (`plan validate`, `lint plan`, `verify gates`, `closeout`, `queue`, `lanes`); the daemon control protocol is untouched.

### 8.2 Events / Messages

No new topic and no new event kind. Member queue entries reuse the delivered `queue.graph` kinds (`entry`, `dependency-edge`, `release`, `remove`) with the member ref as the entry identity, so a member landing publishes one `remove` for that member ref only, and a declared `dependsOn[]` declaration materializes as one `dependency-edge` per named prerequisite. `queue.graph` ordering stays per lane, and a member's lane is its member ref.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Plan member declaration | `delivery.plan.v1` additive document-level `members[]` (≤8): each entry declares `repoKey`, `slice`, `branch`, optional `pullRequest`, `dependsOn[]` (≤8 member repoKeys), `gates` (1..16 identifiers); echoed verbatim by `plan validate` in declared order |
| DM-2 | Shared verdict block | `verify gates` `data.definitionOfDone` = `{ status: green\|blocked\|incomplete, members[]: { repoKey, gates.ci, verdict }, evidence[] }` plus the sibling `data.blockingMembers[]` (member repoKeys in declared order) |
| DM-3 | Member CI and verdict vocabularies | `gates.ci` closed set `pass\|fail\|unavailable\|absent`; member `verdict` closed set `pass\|fail\|unknown`; `unknown` is never a pass; `blocked` and `incomplete` are never green |
| DM-4 | Member evidence and landing order | `evidence[]` entries carry the member pull request identity and its `repoKey`, ordered landed-first by ascending landing position, then unlanded members in declared order |
| DM-5 | Closeout member report | `delivery.closeout.v1` additive optional `data.members[]`: one entry per member in declared order with `repoKey`, `branch`, `cleanup` (delivered step outcome value), `pullRequest`, `issueClosure` (delivered step outcome value), `landed` (boolean merge truth) |
| DM-6 | Member queue identity and edges | Member ref `<canonicalChangeRef>@<repoKey>` (≤ `QUEUE_MAX_REF_CHARS` = 64); one entry, lease, lane, dependency-edge set, and removal per member ref; a plan declaring no members keeps the plain canonical change ref |
| DM-7 | Review-flow block | `verify gates` `data.reviewFlow` = `{ runId, complete, verdicts[]: { repoKey, pullRequest, verdict } }`, `verdict` closed set `pass\|fail\|unreviewed`, one entry per declared member in declared order |

### 8.4 External Integrations

N/A — no external vendor or API integration is added. Per-member CI, pull-request, and merge facts arrive through the delivered provider ports and, in default tests, through injected observations over local temporary repositories. No live network is required for any acceptance criterion.

### 8.5 Backward Compatibility

- **Schema identifiers unchanged.** `delivery.plan.v1`, `delivery.verify-gates.v1`, `delivery.closeout.v1`, `delivery.result.v1`, `delivery.queue.v1`, and `delivery.queue.*` record schemas keep their identifiers; every extension is an additive optional key under `data` or an additive optional record field.
- **Member-less parity is a hard guarantee.** A plan with no `members[]` produces byte-identical plan verdicts, gate reports, closeout data, and queue projections with unchanged exits (F-7, AC-F7-1, AC-NFR2-1).
- **Reused error identities only.** `plan.schema.invalid` classifies every member-declaration defect; `queue.precondition.unmet` classifies a start on a member whose prerequisite is unlanded; `queue.dependency-cycle` classifies a cycle-creating edge mutation. No identity is added, renamed, or reworded, so the bidirectional error-table documentation gate stays satisfied.
- **Queue ref canonicalization is extended, never narrowed.** The member form is recognized in addition to the delivered `<PREFIX>-<digits>` form; the delivered form canonicalizes exactly as before, and `ref-not-canonical` never applies to a declared member ref (DEC-2).
- **Consumer tolerance.** Consumers of the gate report, closeout data, and queue projections must tolerate the additive keys and must resolve members by `repoKey` (and steps by `stepId`), never by array position beyond the declared order guarantee.
- **Delivered single-request resolution stays.** A member-less change keeps the delivered one-open-PR and one-merged-request resolution; the cross-repository path resolves a declared set instead.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Envelope continuity: every new key lives under `data`; the five-field `delivery.result.v1` shape is preserved | 0 new top-level envelope keys; 0 `ok` or `command` fields |
| NFR-2 | Determinism and bounded output: member order is declared order, evidence order is the pinned landing rule, and members/results are bounded | Two runs over unchanged fixtures are byte-identical; ≤8 members per plan; the gate report stays within the delivered `VERIFY_GATES_MAX_MACHINE_BYTES` (65 536); report-level truncation never removes a blocking member |
| NFR-3 | Offline and hermetic: default tests use two real local temporary repositories and injected provider observations | 0 live network calls, 0 real second remotes, 0 credentials in default test runs |
| NFR-4 | Read-only posture: plan validation writes nothing; the gate evaluation keeps exactly one appended gate-verification record; closeout plan mode writes nothing | 0 writes on plan paths; exactly 1 append per full battery evaluation; 0 writes in closeout plan mode |
| NFR-5 | Fail-closed classification: an unavailable or absent CI reading is never green and is always recorded | 100% of unavailable/absent readings recorded as `unavailable`/`absent`; 0 occurrences of `pass` without a read verdict |
| NFR-6 | Bounded provider reads: per-member resolution extends the delivered per-source budget without retries or pagination | ≤1 open-PR page, ≤1 detail read, ≤1 check-run page per member; ≤8 members; 0 retries; 0 pagination |
| NFR-7 | Identity reuse: no new error-table row and no new domain kind | 0 new rows; 0 new kinds; every refusal resolves to a delivered identity |
| NFR-8 | Single-repository parity: member-less behaviour is unchanged | Byte-identical outputs and identical exits across the parity fixture set (100%) |
| NFR-9 | Quality gates and commit hygiene for the delivering change | `TMPDIR=/home/juliusz/tmp pnpm check` green before the PR opens; conventional commit subjects; every body/footer line ≤100 characters |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new telemetry ships. Observability comes from the classified verdict data the surfaces already project: `definitionOfDone.status`, the per-member `gates.ci` and `verdict` values, `blockingMembers[]`, the ordered `evidence[]`, `reviewFlow.complete`, the closeout `members[]` outcomes, and the delivered queue blocking reasons (`dependency-open`) and refusal identities (`queue.precondition.unmet`, `queue.dependency-cycle`). Absence and degradation are always classified — `unavailable` and `absent` are first-class values, never silence.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | A partly landed change reads as done because one member's evidence decides the change | H | M | One shared verdict over every declared member; `green` implies every member `pass`; `blocked`/`incomplete` are never green; AC-F3-2/AC-F3-4/AC-F5-2 pin it | Low |
| RSK-2 | An unavailable CI reading is consumed as a pass | H | M | Closed `gates.ci` vocabulary with `unavailable`/`absent`; `unknown` is never a pass; blocking member named; AC-F3-3/AC-F3-5 pin it | Low |
| RSK-3 | The member-ref extension breaks delivered queue canonicalization, reconcile, or landing removal | H | M | The delivered `<PREFIX>-<digits>` form canonicalizes unchanged; the member form is additive and bounded; reconcile resolves the change ref part; parity fixture proves member-less behaviour (AC-F2-4, AC-F7-1) | Low |
| RSK-4 | The plan schema is weakened, or member keys are silently dropped | M | M | Unknown member keys stay rejected; the echo is asserted; member-less verdicts stay byte-identical (AC-F1-1..AC-F1-4) | Low |
| RSK-5 | Single-repository behaviour drifts while adding the cross-repository path | H | M | Parity is an explicit criterion with byte comparison (AC-F7-1, AC-NFR2-1); the DoD table names the phase that proves it | Low |
| RSK-6 | Scope creeps into live multi-repo execution or merge authority | M | M | §7.2 exclusions; fixtures are local temporary repositories; the PR stays open (NG-1, NG-2) | Low |
| RSK-7 | Report bounds hide a blocking member under truncation | M | L | Member and evidence counts are bounded at 8; `blockingMembers[]` is never truncated; determinism/bound criteria (AC-NFR2-1) | Low |
| RSK-8 | Reused identities drift in meaning and mislead consumers | M | L | Every reuse is declared with its exact meaning (DEC-7); zero new rows (NFR-7); review cross-checks the identities used | Low |
| RSK-9 | Review-flow verdicts cannot be produced in production because the carrier is unspecified | M | M | The flow is pure over injected review observations; the production carrier is an open question with a proposed resolution (OQ-3); no AC depends on a live reviewer | Medium |

## 12. ASSUMPTIONS

- The delivered GH-309 group surface supplies the `repoKey` identity this change consumes; membership stays configuration-only and no group-scoped store is introduced.
- The delivered plan validator's tolerance of unknown top-level and per-phase keys is unchanged, so `members` becomes a validated key rather than a rejected one.
- The delivered queue fold, removal-reason vocabulary, readiness blocking reasons, lane-per-ref admission, and refusal identities are reused as delivered.
- The delivered closeout twelve steps, operation ledger, additive-field discipline, and merge-truth rule are reused; no step id is added.
- Pull requests do not exist when a plan is authored, so `pullRequest` is optional at authoring and required for a green shared definition of done (DEC-5).
- Only the GitHub provider slice is exercised; other tracker kinds stay declarative.
- Delivery runs the full eleven-phase lifecycle on a branch from `main-tools`; the PR targets `main-tools` and stops open.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-309 (M2-S18 project groups) | **Delivered** on `main-tools`; supplies `groupKey`/`repoKey` identity and the aggregation vocabulary this change consumes without modifying |
| Depends on | GH-288 (M2-S11 multi-repository workstations) | **Delivered**; supplies the per-checkout state scope the member evidence reads |
| Depends on | M1-S17 scheduling engine | **Delivered**; supplies queue entries, dependency edges, lanes, removal reasons, `dependency-open`, `queue.precondition.unmet`, `queue.dependency-cycle` |
| Depends on | Delivered plan schema and verdicts | The member declaration extends `delivery.plan.v1`; `plan.schema.invalid` is the reuse identity |
| Depends on | Delivered verify gates report | `delivery.verify-gates.v1` gains additive `data` keys; the read budget is extended per member |
| Depends on | Delivered closeout transaction | `delivery.closeout.v1` gains additive `data.members[]`; the delivered non-goal is superseded for the member-reporting slice |
| Depends on | Delivered result contract | Envelope shape, error table, and `{0,1,2}` projection; a data-bearing negative verdict is a delivered precedent |
| Consumed by | Later cross-repository automation | Anything that needs member landing order or blocker attribution consumes `definitionOfDone`, `blockingMembers[]`, and `closeout.data.members[]` |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Does a member's `slice` carry any scope semantics, or is it descriptive only? | The blueprint names `slice` without defining it; the plan's phases already declare file/package/folder scope | **Resolved in this specification**: descriptive only, echoed verbatim, and it never participates in scope matching, diff, or overlap (NG-8). Per-member scope is deferred (§7.3) |
| OQ-2 | Is `pullRequest` required in a member declaration? | Plans are authored before pull requests exist, but the shared definition of done needs the member request identity | **Resolved in this specification**: optional at authoring; a member without it cannot be `pass`, so a declared member set with unresolved requests reports `incomplete` (DEC-5) |
| OQ-3 | How do production review verdicts reach `data.reviewFlow` when review is agent-mediated? | The flow is pure over injected review observations; only fixtures exist today | Open — proposed: production supplies the reviewer's recorded verdict set through the same injected observation port the tests use; no store and no command are added in this change. Decision needed if a durable review record is required: consult `@decision-advisor` |
| OQ-4 | Is a one-member `members[]` declaration a cross-repository change? | A single member is a legitimate declaration and must not silently behave differently | **Resolved in this specification**: valid declaration data, evaluated as a one-member shared verdict under the member ref form; the parity guarantee covers plans declaring no `members[]` at all (DEC-2) |
| OQ-5 | What is `queueRemoval` behaviour when a member entry has a live lease at landing? | The delivered landing removal skips with `lease-held` | **Resolved in this specification**: each member entry reuses the delivered skip semantics and skip reasons; a skipped member removal leaves that entry in place and is disclosed, never silently dropped (AC-F5-2) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The member declaration is an additive optional document-level `members[]` key on the unchanged `delivery.plan.v1`; validation is closed over member fields only; no schema version bump | Verified current truth: the validator rejects unknown keys only for `scope.*` and `doneArtifacts.*`, so an unknown top-level `members` is currently ignored. Making it a known, validated, echoed key strengthens the surface without weakening any existing rejection and without breaking member-less plans | 2026-11-14 |
| DEC-2 | The member ref is `<canonicalChangeRef>@<repoKey>`; a plan declaring no `members[]` keeps the plain canonical ref; the member form extends canonicalization (fold key, edge identity, lease/lane identity, removal id) and `ref-not-canonical` never applies to a declared member ref; reconcile resolves the change ref before the `@` | The delivered graph folds entries and edges by canonical ref alone, so per-member entries require a distinct canonical identity; the `@` form is unique, stable, derivable from `repoKey` with no extra field, bounded (≤64 chars), and leaves the delivered form untouched | 2026-11-14 |
| DEC-3 | `status` semantics: `green` iff every declared member is `pass` and `blockingMembers[]` is empty; `blocked` iff at least one member is definitively negative or its CI reading is unavailable or a declared gate cannot be resolved; `incomplete` iff no member is negative/unavailable but at least one member's evidence does not exist yet (no pushed head, no declared pull request, no run) | Separates a decision from an unfinished state while keeping both non-green, so a partly landed change never reads as done and the difference is observable in data | 2026-11-14 |
| DEC-4 | `gates.ci` closed set `pass\|fail\|unavailable\|absent`; member `verdict` closed set `pass\|fail\|unknown`; `unavailable` and `absent` never map to `pass`; a member with an unresolvable declared gate identifier is `unknown` | The delivered gate vocabulary already treats `unknown` as never-pass; mirroring it per member keeps one mental model and makes "unavailable is not green" mechanically checkable | 2026-11-14 |
| DEC-5 | `pullRequest` is optional at authoring; a member without it (or without a pushed head) cannot be `pass` and forces `incomplete` | Plans are authored before pull requests exist; requiring the identity at authoring would make every cross-repository plan invalid | 2026-11-14 |
| DEC-6 | `evidence[]` order: landed members first in ascending observed landing position, then unlanded members in declared order; ties break by declared order | "Landing order" must be deterministic and must expose a partly landed change without inventing a second ordering surface | 2026-11-14 |
| DEC-7 | Dependency ordering reuses delivered identities: entry blocking reason `dependency-open`, start refusal `queue.precondition.unmet` (naming the member and its unlanded prerequisite), cycle refusal `queue.dependency-cycle`, and plan-time cycles as `plan.schema.invalid` | No new error row is needed; the delivered queue vocabulary already expresses an unmet precondition and a dependency cycle, so consumers face no new identity | 2026-11-14 |
| DEC-8 | The review flow's identity is one run over the declared member pull-request set: `runId` is a stable digest over the change ref and the sorted member pull-request identities, identical for an unchanged set; `verdicts[]` is one entry per declared member in declared order; a duplicated review observation degrades the member to `fail` with `complete: false` | "Exactly one review run, one verdict per member, no member reviewed twice" becomes mechanically checkable without a store, a command, or a second run concept | 2026-11-14 |
| DEC-9 | Plan validation shape-checks member gate identifiers and does not resolve them against configuration; resolution happens at `verify gates`, where an unresolved identifier makes that member `unknown` (never a pass) | `plan validate` reads no configuration today and must keep that posture; capability resolution belongs to the surface that owns the effective gate set | 2026-11-14 |
| DEC-10 | Bounds: `PLAN_MAX_MEMBERS` = 8, `PLAN_MAX_MEMBER_DEPENDS_ON` = 8, `PLAN_MAX_MEMBER_GATES` = 16, `VERIFY_GATES_MAX_MEMBERS` = 8, `CLOSEOUT_MAX_MEMBERS` = 8; per-member reads are one open-PR page, one detail read, one check-run page, no retries, no pagination | Keeps the delivered bounded-output and bounded-read posture while covering every realistic project group; the same count is used on every surface so a declaration cannot be valid in one place and unrepresentable in another | 2026-11-14 |
| DEC-11 | The cross-repository gate report is data-bearing on every `status`: `green` projects exit 0; `blocked` and `incomplete` project exit 1 with the report present; member-level provider unavailability is member evidence, not a command failure, and command-level failures stay the delivered failure envelopes | A verdict without data cannot name the blocking member; a data-bearing negative verdict at exit 1 is a delivered precedent (`plan validate` invalid, `plan overlap` run-in-sequence) | 2026-11-14 |
| DEC-12 | Closeout adds no step id: per-member cleanup and issue closure ride the delivered `branch-cleanup` and `ticket-to-done` steps, and `data.members[]` is additive and optional | Consumers resolve steps by `stepId` and tolerate additive fields; adding a step id would force a consumer migration the blueprint does not ask for | 2026-11-14 |
| DEC-13 | No new error-table row and no new domain kind; every refusal reuses a delivered identity; current-truth docs flip in phase 7 | The error-table sync gate is bidirectional, and reuse keeps the documented table truthful with zero documentation debt | 2026-11-14 |
| DEC-14 | Delivery conventions: full eleven-phase lifecycle, one commit per plan phase through the commit primitive, conventional subjects scoped GH-310, gates run with the pm-notes gate environment, PR targets `main-tools` and stays open | pm-notes binding decisions for this change | 2026-11-14 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Plan vocabulary and validator | Extended — additive `members[]` declaration, closed member validation, `members[]` echo in the validate verdict, location reporting in the lint target |
| Verify gates report and evaluation | Extended — `data.definitionOfDone`, `data.blockingMembers[]`, `data.reviewFlow`, per-member target resolution, bounded per-member read budget, cross-repository exit projection |
| Closeout transaction and report | Extended additively — per-member merge-truth resolution, per-member cleanup and issue closure inside the delivered steps, `data.members[]`, per-member landing removal |
| Queue, readiness, and lanes | Extended — member ref form, per-member entries/edges/leases/lanes/removals, `dependency-open` readiness, member-form canonicalization |
| Result contract and error table | **Unchanged in rows** — delivered identities reused; the cross-repository report's data-bearing negative verdict is declared for the gate surface only |
| Provider ports and observations | Consumed unchanged — injected provider observations carry per-member PR/CI/merge facts; no new port |
| Project group configuration (GH-309) | **Unchanged** — `repoKey` is consumed as the member identity; membership stays configuration-only |
| State layer, host index, daemon, event taxonomy | **Unchanged** — no new record kind, topic, kind, or store |
| Change artifacts and planning corpus | Change folder artifacts unchanged in shape; backlog M2-S19 progress markers, status snapshot, and the M2 contracts ownership line maintained at delivery |
| Current-truth feature specs | Reconciled in phase 7 — plan schema, verify gates, closeout, scheduling engine, delivery lifecycle (not amended by this specification) |

## 17. ACCEPTANCE CRITERIA

**Plan member declaration (ticket AC1: one spec, one plan)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a change whose single plan declares `members[]` with two entries carrying `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn[]`, and `gates`, **when** `plan validate <ref>` runs, **then** the verdict is `valid` with `readyForDevelopment: true` at exit `0`, `data.members[]` echoes both entries in declared order with exactly the declared fields, and exactly one spec and one plan exist for the change with no per-member change folder (ticket AC1; scenario seed SC-M2-S19-01 inherited by name) | F-1, F-7, DM-1 |
| AC-F1-2 | **Given** a plan whose `members[]` declares a duplicate `repoKey`, a `dependsOn` element naming no declared member, a self edge, a dependency cycle, or an unknown member key, **when** `plan validate` and `lint plan` run, **then** each defect is the delivered `plan.schema.invalid` naming `members[i].<field>` (with its document location in the lint report), the verdict is `invalid` with `readyForDevelopment: false` at exit `1`, and no invalid member is echoed as valid | F-1, DM-1 |
| AC-F1-3 | **Given** a plan that declares no `members[]`, **when** `plan validate`, `lint plan`, `plan diff`, and `plan overlap` run, **then** every payload and exit is byte-identical to the pre-change behaviour and no `members` key appears anywhere in the verdict | F-1, F-7, NFR-8 |
| AC-F1-4 | **Given** a plan exceeding the declared member bounds (more than 8 members, more than 8 dependency edges on one member, more than 16 gate identifiers on one member, or a member whose derived member ref exceeds 64 characters), **when** `plan validate` runs, **then** the defect is `plan.schema.invalid` naming the member position and field at exit `1` | F-1, DM-6, NFR-2 |

**Member queue representation (ticket AC1, AC4)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** a plan declaring two members, **when** the change is queued and `queue list` runs, **then** exactly two entries exist keyed `<changeRef>@<repoKeyA>` and `<changeRef>@<repoKeyB>`, each bound to its own repository and carrying its own lane, no entry is keyed by the bare change ref, and no lane spans both members (ticket AC1) | F-2, DM-6 |
| AC-F2-2 | **Given** member B declares `dependsOn: [repoKeyA]` and A's pull request is not landed, **when** `queue list` and `lanes list` run, **then** B's entry carries the edge to A's member ref and reads `not-ready` with the delivered `dependency-open` blocking reason, while A's entry is unaffected (ticket AC4; scenario seed SC-M2-S19-05 inherited by name) | F-2, F-4, DM-6 |
| AC-F2-3 | **Given** two member entries and an observed landing of member A, **when** the landing removal runs, **then** exactly one removal record exists for A's member ref with reason `landed`, B's entry is retained, and B's readiness is recomputed against A's landing (ticket AC1) | F-2, F-5, DM-6 |
| AC-F2-4 | **Given** a declared member ref, **when** it is presented to the queue (add, read, remove, or landing removal), **then** the member form canonicalizes and is accepted, the delivered `<PREFIX>-<digits>` form canonicalizes exactly as before, and `ref-not-canonical` never applies to a declared member ref | F-2, DM-6, NFR-8 |

**Shared definition of done and per-member CI (ticket AC2, AC3)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a two-member change whose gates and CI pass on both members' own pushed heads, **when** `verify gates <ref> --json` runs, **then** `data.definitionOfDone.status` is `green`, `members[]` carries exactly one entry per declared member in declared order with `gates.ci: pass` and `verdict: pass`, `data.blockingMembers[]` is empty, `evidence[]` carries both pull requests, and the exit is `0` (ticket AC2; scenario seed SC-M2-S19-03 inherited by name) | F-3, DM-2, DM-3 |
| AC-F3-2 | **Given** a two-member change where member B fails one of its declared gates, **when** the shared verdict is evaluated, **then** `data.definitionOfDone.status` is `blocked`, `data.blockingMembers[]` equals exactly `[B.repoKey]`, B's `verdict` is `fail`, A's `verdict` is `pass`, the report data is present, and the exit is `1` (ticket AC3; scenario seed SC-M2-S19-02 inherited by name) | F-3, DM-2, DEC-3, DEC-11 |
| AC-F3-3 | **Given** a member whose CI reading is unavailable, **when** the shared verdict is evaluated, **then** that member's `gates.ci` is `unavailable` and its `verdict` is `unknown` (never `pass`), `data.blockingMembers[]` names that `repoKey`, `data.definitionOfDone.status` is not `green`, and the exit is `1` (ticket AC2; scenario seed SC-M2-S19-04 inherited by name) | F-3, DM-3, NFR-5 |
| AC-F3-4 | **Given** a member with no pushed head or no declared pull request while no member is negative or unavailable, **when** the shared verdict is evaluated, **then** `data.definitionOfDone.status` is `incomplete`, that member's `gates.ci` is `absent`, `data.blockingMembers[]` names it, and the exit is `1` | F-3, DM-2, DM-3, DEC-3 |
| AC-F3-5 | **Given** a two-member change where one member's CI passes and the other's reading is unavailable, **when** the shared verdict is evaluated, **then** the unavailable member's `gates.ci` is never `pass` (no cross-member reuse of a CI verdict) and its `verdict` is `unknown` | F-3, DM-3, NFR-5 |
| AC-F3-6 | **Given** a partly landed two-member change, **when** the shared verdict is evaluated, **then** `data.definitionOfDone.evidence[]` lists the landed member's pull request before the unlanded member's, landed members ordered by ascending observed landing position and unlanded members in declared order, and the ordering is identical on a repeated run over unchanged facts (ticket AC4; scenario seed SC-M2-S19-05 inherited by name) | F-3, DM-4, NFR-2 |

**Dependency ordering (ticket AC4)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** member B's dependency edge on member A and A's pull request unlanded, **when** any member-step start path is attempted on B's member ref, **then** it is refused with the delivered `queue.precondition.unmet` at exit `1` naming B and its unlanded prerequisite A, and after A's pull request lands the same attempt is admitted (ticket AC4) | F-4, F-2, DEC-7 |
| AC-F4-2 | **Given** a queue edge mutation among member refs that would close a cycle, **when** the mutation runs, **then** it is refused with the delivered `queue.dependency-cycle` at exit `1`; and **given** a plan declaring a dependency cycle, **when** the plan is validated, **then** the cycle is `plan.schema.invalid` before any queue write | F-4, F-1, DEC-7 |

**Closeout member report (ticket AC1)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** a two-member change where both member pull requests are observed merged, **when** `closeout <ref> --apply --json` runs over fixtures, **then** `data.members[]` carries exactly two entries in declared order, each with `repoKey`, `branch`, `cleanup` in the delivered outcome vocabulary, `pullRequest` naming that member's pull request, `issueClosure` in the delivered outcome vocabulary, and `landed: true`, and each member's landing removes only its own queue entry (ticket AC1; scenario seed SC-M2-S19-01 inherited by name) | F-5, DM-5 |
| AC-F5-2 | **Given** a two-member change where only member A is merged, **when** `closeout <ref> --apply --json` runs, **then** A's entry reports `landed: true` and B's reports `landed: false`, A's queue entry is removed and B's is retained (or disclosed with a delivered skip reason when its lease is held), and no step outcome or exit code claims B landed | F-5, F-2, DM-5, OQ-5 |
| AC-F5-3 | **Given** a member whose squash-safety predicate fails, **when** closeout plans or applies, **then** that member's `cleanup` is the delivered refuse value, the branch is not deleted, and `landed` still reflects observed merge truth only | F-5, DM-5 |
| AC-F5-4 | **Given** a change whose plan declares no `members[]`, **when** `closeout` runs in plan and apply modes, **then** `data` carries no `members` key and the steps, outcomes, ledger records, and human output are byte-identical to the pre-change behaviour | F-5, F-7, NFR-8 |

**Review flow (ticket AC1)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** a two-member change with both member pull requests declared and one review observation per member, **when** the review flow runs and `verify gates <ref> --json` reports, **then** `data.reviewFlow.verdicts[]` carries exactly one entry per declared member in declared order with `repoKey`, `pullRequest`, and a `verdict` from `pass\|fail\|unreviewed`, `data.reviewFlow.complete` is `true`, and a second run over the unchanged member set yields the identical `runId` and adds no verdict entry (ticket AC1) | F-6, DM-7, DEC-8 |
| AC-F6-2 | **Given** a member with more than one recorded review observation, **when** the flow reports, **then** that member's `verdict` is `fail` and `data.reviewFlow.complete` is `false`, and `verdicts[]` still carries exactly one entry for that member | F-6, DM-7, DEC-8 |
| AC-F6-3 | **Given** a member set that changes between runs, **when** the flow reports, **then** the `runId` differs from the unchanged-set run and `verdicts[]` carries no entry for a member that is no longer declared | F-6, DM-7, NFR-2 |

**Parity, contract, and quality**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** the parity fixture set (plans declaring no members; single-repository gate, closeout, and queue flows), **when** each surface runs after this change, **then** every payload is byte-identical to the pre-change golden and every exit code is identical, proving the cross-repository path is opt-in and never the default | F-7, NFR-8 |
| AC-NFR1-1 | **Given** every envelope produced by this change, **when** envelopes are inspected or contract-tested, **then** each uses the five-field `delivery.result.v1` shape with every new key under `data`, and no `ok` or `command` top-level field exists | NFR-1, DM-2, DM-5, DM-7 |
| AC-NFR2-1 | **Given** two runs over unchanged fixtures, **when** the shared verdict, closeout report, and queue projections are compared, **then** the output is byte-identical; and **given** a report with eight members, **then** the gate report stays within the delivered machine byte bound and `blockingMembers[]` is never truncated | NFR-2, DM-2, DM-4 |
| AC-NFR3-1 | **Given** the default test suite, **when** it runs, **then** both members are real local temporary repositories from the delivered checkout fixture seam, all provider facts are injected observations, and zero live network calls, real second remotes, or credentials are used | NFR-3, NFR-6 |
| AC-NFR4-1 | **Given** the touched read and write surfaces, **when** their writes are audited, **then** plan validation writes nothing, the full battery evaluation appends exactly one gate-verification record, and closeout plan mode performs zero writes | NFR-4 |
| AC-NFR5-1 | **Given** the delivering change, **when** quality gates run before the PR opens, **then** `TMPDIR=/home/juliusz/tmp pnpm check` is green and every commit subject is conventional with body/footer lines at or below 100 characters | NFR-9, DEC-14 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds §17 criteria to a checkable outcome, names its verification method, and is proven in the delivering plan phase of `chg-GH-310-plan.yaml` that owns the capability. This specification claims no passing evidence and no acceptance.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | The plan declaration parses, validates, and echoes: `members[]` carrying only the six declared field names per entry (`pullRequest` present when declared), declared order preserved, `valid`/`readyForDevelopment: true` at exit 0 | F-1, DM-1, AC-F1-1 | Plan validate contract tests over a two-member fixture plan | Plan-declaration phase |
| DoD-2 | Member declaration defects are classified: duplicate `repoKey`, unknown member key, unknown dependency target, self edge, cycle, over-bound list, over-length member ref — each `plan.schema.invalid` naming `members[i].<field>`, with lint locations, and no invalid member echoed as valid | F-1, AC-F1-2, AC-F1-4 | Negative-path fixture table green (one defect per case) | Plan-declaration phase |
| DoD-3 | Member refs are represented: two entries, two leases, two lanes, per-member edges, per-member removal, and the member form canonicalizes while the delivered form is unchanged | F-2, AC-F2-1, AC-F2-3, AC-F2-4 | Queue fixture suite over two temporary repositories; canonicalization unit tests | Queue-representation phase |
| DoD-4 | The shared verdict reports one entry per declared member with `gates.ci` read on that member's own head and `verdict` from the closed set; `green` implies every member `pass` | F-3, AC-F3-1, AC-F3-5 | Shared-verdict behaviour tests plus goldens; SC-M2-S19-03 coverage | Shared-verdict phase |
| DoD-5 | Blocker attribution holds: a failing member yields `blocked` with `blockingMembers[]` equal to that member; an unavailable reading yields `unavailable`/`unknown` and is named; an absent evidence member yields `incomplete`; all three are non-green with the report present at exit 1 | F-3, AC-F3-2, AC-F3-3, AC-F3-4, DEC-3, DEC-11 | SC-M2-S19-02 and SC-M2-S19-04 coverage; exit-projection assertions | Shared-verdict phase |
| DoD-6 | Evidence ordering is the pinned landing rule and is stable across repeated runs | F-3, AC-F3-6, DEC-6 | Landing-order determinism test | Shared-verdict phase |
| DoD-7 | Dependency ordering holds: `dependency-open` readiness, `queue.precondition.unmet` start refusal naming member and prerequisite, admitted after landing, `queue.dependency-cycle` for edge cycles, plan-cycle caught at validation | F-4, AC-F4-1, AC-F4-2 | Dependency-order behaviour suite; SC-M2-S19-05 coverage | Dependency-ordering phase |
| DoD-8 | Closeout reports every member with branch, cleanup outcome, pull request, issue closure outcome, and merge-truth `landed`; partial landing is visible; per-member removal removes only that member's entry; unsafe cleanup refuses without deleting | F-5, AC-F5-1, AC-F5-2, AC-F5-3 | SC-M2-S19-01 coverage over two temporary repositories; partial-landing and unsafe-branch fixtures | Closeout phase |
| DoD-9 | The review flow is one run with one verdict per member, an unchanged set reuses the run identity and adds no verdict, and a duplicated observation degrades the member to `fail` with `complete: false` | F-6, AC-F6-1, AC-F6-2, AC-F6-3 | Review-flow unit tests plus report golden | Review-flow phase |
| DoD-10 | Parity holds: member-less plan, gates, closeout, and queue outputs are byte-identical to the pre-change goldens with identical exits | F-7, AC-F1-3, AC-F5-4, AC-F7-1, NFR-8 | Parity golden comparison in the touched-surface suites | Every implementation phase; rolled up in the final delivery phase |
| DoD-11 | Contract continuity holds: no new top-level envelope key, no `ok`/`command` field, zero new error-table rows or domain kinds, and the report stays within the delivered byte bound with no truncated blocker | NFR-1, NFR-2, NFR-7, AC-NFR1-1, AC-NFR2-1 | Envelope contract tests; error-table sync check; bounded-output tests | Shared-verdict and queue phases |
| DoD-12 | Read-only and read-budget posture holds: zero plan-path writes, exactly one gate-verification append per battery evaluation, zero closeout plan-mode writes, no retries, no pagination, ≤1 page/detail/check-run read per member | NFR-4, NFR-6, AC-NFR4-1, AC-NFR3-1 | Read-only audit tests; read-budget assertions; no-live-calls invariant | Shared-verdict and closeout phases |
| DoD-13 | Documentation impact is delivered: current-truth specs reconciled in phase 7 (plan schema, verify gates, closeout retired non-goal, scheduling engine, delivery lifecycle) and milestone bookkeeping updated | §22, NG-9 | Doc diff review; backlog/status/contracts row inspection | Phase 7 system_spec_update |
| DoD-14 | Full acceptance coverage: all 29 §17 criteria green with no uncovered criterion and no orphan test | §17, NFR-1..NFR-9 | Test plan coverage matrix all Covered; execution evidence in pm-notes | Per phase; roll-up at the final delivery phase |
| DoD-15 | The full gate battery is green at the delivered HEAD and the PR is created against `main-tools` and left open | NFR-9, DEC-14 | Gate run recorded in pm-notes; PR record attached | Quality gates / PR creation |

A condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery**: full eleven-phase lifecycle on a feature branch created from `main-tools`; the PR targets `main-tools` (the repository is in the tooling transition; `main` is the frozen public baseline) and stops open for human review. Commits go through the commit primitive with conventional subjects and body/footer lines at or below 100 characters (DEC-14).
- **Ordering inside the change**: the plan declaration lands first so the remaining surfaces have a declared member set; the shared verdict, queue representation, dependency ordering, closeout report, and review flow follow; parity proofs run in every phase.
- **Adoption**: opt-in per change — a change that declares `members[]` gains the cross-repository path; a change that does not stays exactly as delivered. No configuration key is added, and no existing plan needs editing.
- **Communication**: milestone bookkeeping via the OSS-tooling backlog M2-S19 progress marker, the status snapshot, and the M2 contracts ownership line per planning conventions.
- **Rollback**: revert-safe — every extension is additive and optional over unchanged state; reverting restores member-less behaviour, and member declarations are inert plan data with no migration to undo.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No data migration and no seeding. No state file, queue ledger record, closeout ledger record, host index entry, or plan artifact is rewritten or moved. Existing plans remain valid without a `members` key, and existing queue entries keep their canonical refs. No stored identity is migrated: member refs are derived from the declaration and appear only in queue records created after the declaration exists.

## 20. PRIVACY / COMPLIANCE REVIEW

Low impact. Member declarations carry a repo key, a slice description, a branch name, and a pull-request identity — repository-scoped identifiers with no personal data. Cross-member reporting reads the same provider facts the delivered surfaces already read; no new data category is collected, stored, or transmitted. No secrets, credentials, or personal data flows are introduced, and default tests use local fixtures only.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Fail-closed verdict is the security-relevant invariant**: an unavailable or absent CI reading can never be green, so an unmeasured member cannot launder a change into "done" (NFR-5, AC-F3-3).
- **Ordering prevents premature landing**: a dependent member step is refused while its prerequisite is unlanded, which blocks a slice from entering a repository ahead of the change it depends on (AC-F4-1).
- **No widened authority**: no merge, no auto-merge, no provider write beyond the delivered closeout operations, and no new credential or network surface (NG-1, NG-2).
- **Bounded evidence**: member and read counts are bounded, and a blocking member is never truncated out of the report, so a hostile or oversized input cannot hide a blocker (NFR-2, NFR-6).
- **Identity reuse**: zero new error rows keeps one documented classification surface, preventing a parallel vocabulary from becoming an unaudited trust boundary (NFR-7).

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Two shapes per surface**: each touched surface now has a member-less form (delivered, byte-identical) and a member form. Future changes must keep the parity obligation when editing either.
- **Bounds are shared**: member count is eight on the plan, gate, and closeout surfaces; changing it requires changing all three together, or a declaration would validate where it cannot be reported.
- **Vocabulary stewardship**: `gates.ci`, member `verdict`, `definitionOfDone.status`, and review verdict sets are closed and documented; widening any of them is a contract change, not an implementation detail.
- **Identity stewardship**: member refs are derived, not stored; any future per-member persistence must reuse the `<canonicalChangeRef>@<repoKey>` identity rather than minting a second one.
- **Documentation debt**: phase 7 reconciles plan schema, verify gates, closeout (including retiring its cross-repository non-goal for the member-reporting slice), scheduling engine, and delivery lifecycle.
- **Review-flow carrier**: while review verdicts are injected observations, the production carrier is a known open point (OQ-3) and must be settled before review evidence is relied on operationally.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Cross-repository change | One change spanning several member repositories of one project group under one lifecycle, one spec, one plan, and one shared definition of done |
| Member | One declared member repository of a cross-repository change, identified by its `repoKey` |
| Slice | The declared portion of the change delivered in one member; descriptive only, never a scope matcher |
| Member ref | The canonical queue identity of one member entry, `<canonicalChangeRef>@<repoKey>` |
| Shared definition of done | The single verdict over all declared members: `green`, `blocked`, or `incomplete` |
| Blocking member | A declared member whose evidence prevents green; named by `repoKey` in `blockingMembers[]` |
| Per-member CI corroboration | Reading and recording the CI verdict on each member's own pushed head |
| `unavailable` | A classified CI reading failure; never a pass |
| `absent` | No pushed head or no run for the pushed head; never a pass |
| `incomplete` | A non-green verdict meaning member evidence does not exist yet, with no member negative |
| `blocked` | A non-green verdict meaning a member is negative or its evidence is unreadable |
| Landing order | Landed members by ascending observed landing position, then unlanded members in declared order |
| Review flow | One run over the declared member pull-request set with one verdict per member and no member reviewed twice |
| Member-less plan | A plan declaring no `members[]`; the delivered single-repository behaviour, byte-identical |

## 24. APPENDICES

### Appendix A — Pinned literals register

Every literal a downstream test plan or plan author must use without re-deciding:

| # | Literal | Value | Where |
|---|---------|-------|-------|
| 1 | Plan member key | `members` (document level, additive, optional) | DEC-1, DM-1 |
| 2 | Member entry fields | `repoKey`, `slice`, `branch`, `pullRequest` (optional), `dependsOn[]`, `gates` | DM-1 |
| 3 | Member counts | members ≤8; `dependsOn` ≤8; `gates` 1..16 | DEC-10 |
| 4 | Shared verdict block | `data.definitionOfDone` = `{status, members[], evidence[]}` | DM-2 |
| 5 | Status vocabulary | `green`, `blocked`, `incomplete` | DEC-3 |
| 6 | `gates.ci` vocabulary | `pass`, `fail`, `unavailable`, `absent` | DEC-4 |
| 7 | Member `verdict` vocabulary | `pass`, `fail`, `unknown` | DEC-4 |
| 8 | Blockers | `data.blockingMembers[]`, member `repoKey` values in declared order | DM-2 |
| 9 | Evidence order | landed first by ascending landing position, then unlanded in declared order; ties by declared order | DEC-6 |
| 10 | Closeout member fields | `repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, `landed` | DM-5 |
| 11 | Member ref | `<canonicalChangeRef>@<repoKey>`; plain ref when no `members[]` | DEC-2, DM-6 |
| 12 | Dependency identities | `dependency-open`; `queue.precondition.unmet`; `queue.dependency-cycle`; plan cycle → `plan.schema.invalid` | DEC-7 |
| 13 | Review flow block | `data.reviewFlow` = `{runId, complete, verdicts[]}`; verdicts `pass`, `fail`, `unreviewed` | DEC-8, DM-7 |
| 14 | Exit projection | `green`→0; `blocked`→1; `incomplete`→1; report data present on all three | DEC-11 |

### Appendix B — Ticket acceptance criteria mapping

| Ticket AC (M2-S19) | Spec criteria | Scenario seed |
|--------------------|---------------|---------------|
| AC1 — a two-repository change produces one spec, two branches, two PRs, one review flow, and a closeout that lands both | AC-F1-1 (one spec, one plan), AC-F2-1 (two entries/lanes), AC-F6-1 (one review flow), AC-F5-1 (closeout lands both) | SC-M2-S19-01 |
| AC2 — per-repo CI truth is corroborated per member before the change counts done; an unavailable CI reading blocks as a classified outcome rather than counting as green | AC-F3-1 (corroborated per member), AC-F3-3 (unavailable never green), AC-F3-5 (no cross-member reuse) | SC-M2-S19-03, SC-M2-S19-04 |
| AC3 — a member failing its gates blocks the shared DoD with the failing member named | AC-F3-2 | SC-M2-S19-02 |
| AC4 — member dependency order holds and evidence lists PRs in landing order | AC-F4-1, AC-F4-2, AC-F2-2, AC-F3-6 | SC-M2-S19-05 |

Every ticket criterion maps to at least one AC; the remaining criteria (AC-F1-2..AC-F1-4, AC-F2-3, AC-F2-4, AC-F3-4, AC-F5-2..AC-F5-4, AC-F6-2, AC-F6-3, AC-F7-1, AC-NFR1-1..AC-NFR5-1) enforce the invariants the four criteria depend on.

### Appendix C — Constraint register (carried into plan and test authoring)

- C-1: Member-less parity is absolute — byte-identical output and identical exits for every surface (F-7, AC-F7-1, NFR-8).
- C-2: An unavailable or absent CI reading is never green; `unknown` is never a pass (DEC-4, NFR-5).
- C-3: Zero new error-table rows and zero new domain kinds (DEC-13, NFR-7).
- C-4: Member ref derivation is the only queue identity extension; the delivered canonical form is unchanged (DEC-2, AC-F2-4).
- C-5: Bounds are eight members on plan, gates, and closeout; a declaration must never be valid where it cannot be reported (DEC-10).
- C-6: Review verdicts come from injected observations; no store, no command, no live model call (F-6, OQ-3).
- C-7: Default tests stay offline and hermetic over the delivered two-repository temporary-checkout seam (NFR-3, AC-NFR3-1).
- C-8: Current-truth feature specs flip in phase 7, not in delivery phases (NG-9, DoD-13).
- C-9: Gate battery and commit hygiene per pm-notes: `TMPDIR=/home/juliusz/tmp pnpm check` before the PR, conventional subjects, body/footer lines ≤100 characters, PR to `main-tools` staying open (DEC-14, NFR-9).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | spec-writer (deepseek-flash) | Initial specification from GitHub issue #310 (M2-S19), backlog M2-S19, the M2 milestone pack (`contracts.md` "Cross-repository change plan shape" and "Queue and lane representation"; `architecture.md` cross-repository flow and boundary invariants; `test-scenarios.md` SC-M2-S19-01..05, referenced by name), and current truth (plan schema and validator, verify gates, closeout, scheduling engine and queue contracts, project groups, result contract and error table); open literals pinned as DEC-2..DEC-13 |

---

## AUTHORING GUIDELINES

Sources: GitHub issue #310 "M2-S19: Cross-repository changes (M2)" (owner-authored; AC quoted in intent via Appendix B); backlog story M2-S19 (canonical scope, tasks, and the four ACs) and stories M2-S18/M2-S11/M1-S17 (delivered dependencies); the M2 milestone pack — `contracts.md` §"Cross-repository change plan shape" and §"Queue and lane representation" (member fields, shared verdict fields, closeout member fields, per-member queue and lane rules), `architecture.md` §"Cross-repository change" and §"Boundary invariants at M2 exit", `test-scenarios.md` SC-M2-S19-01..05 (inherited by name, never restated); current truth — `feature-plan-schema.md` and the delivered plan validator (verified unknown-key handling), `feature-verify-gates.md` and the delivered gate contract (single-target resolution, verdict vocabulary, read budget, report schema), `feature-closeout.md` and the delivered closeout contract (twelve steps, ledger, additive discipline, the superseded non-goal), `feature-scheduling-engine.md` and the queue contracts (canonical ref keying, dependency edges, removal reasons, lanes, refusal identities), `feature-project-groups.md` (`repoKey` identity and aggregation vocabulary), `feature-result-contract.md` (envelope, error table, projection, data-bearing negative-verdict precedent); `tests/fixtures/projects/temp-repos.ts` (the two-repository hermetic seam); and `chg-GH-310-pm-notes.yaml` (scope decision, fixture decision, gate environment, delivery conventions).

Every literal the blueprint left open is pinned rather than deferred: the member queue identity (DEC-2), the `blocked`/`incomplete` split (DEC-3), the CI and verdict vocabularies (DEC-4), `pullRequest` optionality (DEC-5), evidence ordering (DEC-6), dependency-ordering identity reuse (DEC-7), the review-flow identity (DEC-8), gate-identifier resolution (DEC-9), the bounds (DEC-10), and the cross-repository exit projection (DEC-11). The single remaining open point is the production carrier of review verdicts (OQ-3), which no acceptance criterion depends on.

Constraints honored: scope stated at capability level only — no implementation steps and no repository code paths; runtime artifacts that are themselves the contract surface (envelope keys, record identities, vocabularies) are named as contracts; scenario seeds and contracts are referenced by name, never duplicated.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-310)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (G-, NG-, F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-, DoD-, C-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then (29 criteria)
- [x] Every ticket AC (1–4) maps to at least one AC ID (Appendix B)
- [x] Every AC names an observable surface (plan verdict, gate report, closeout data, queue projection, review block)
- [x] Change-specific Definition of Done present (§17.1) with per-condition verification and plan-phase ownership
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability and residual risk
- [x] Out-of-scope items start with `[OUT]`
- [x] Blueprint field names used verbatim: `members`, `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn`, `gates`, `definitionOfDone`, `status`, `gates.ci`, `verdict`, `evidence`, `blockingMembers`, `cleanup`, `issueClosure`, `landed`
- [x] Supersession stated explicitly: closeout's "cross-repository closeout, global state, or multi-repo fan-out" non-goal is retired for the member-reporting slice; the plan's "phases and scope only" statement is extended by the additive member declaration
- [x] No implementation details (no repository code file paths as directives, no step-by-step tasks)
- [x] No content duplicated from linked docs (contracts and scenario seeds referenced by name)
