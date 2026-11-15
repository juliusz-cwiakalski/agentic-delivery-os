---
change:
  ref: GH-300
  type: feat
  status: Proposed
  slug: suite-job-mapping-gates
  title: "M2-S7: Suite-to-job mapping in gates (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [milestone-m2, verify-gates, config, policy-as-code, gates]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "GH-178 (M0-S9 verify gates v1 — delivered: five-gate battery, citations, exits, the CI-workflow job-name read, the config-declared gate set, and the `merge.gate-verification` record)"
      - "GH-225 (M1-S4 merge transaction — delivered: `merge.gates` config-declared gate set and the born-invalid EVT-1 verification record)"
      - "GH-310 (M2-S19 cross-repository gate report — delivered: the additive `CrossRepositoryVerifyGatesReport` and its report union)"
      - "Delivered configuration layer and the typed project configuration document (feature-config-layer.md)"
      - "Delivered result contract, error table, and `{0,1,2}` projection (feature-result-contract.md; TDR-0027 failure-envelope `detail`)"
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the local gate battery cite the suite breadth it claims and the one CI job that breadth mirrors, so a local run whose breadth is narrower than that CI job refuses a full-green report instead of letting a narrow suite masquerade as full verification.

## 1. SUMMARY

`verify gates <changeRef>` evaluates a cited gate battery locally, and its CI gate reads the repository's `.github/workflows/ci.yml` to learn the expected *job-name* set. That read proves only that a job name is declared and reports a check run: it says nothing about whether the local run covered the same suite breadth as the CI job that carries that breadth. A repository (or an agent) can therefore run a narrow local suite, report a green battery, and have that green consumed by phase 10 and by `merge` as if it were full verification. The delivered current truth names exactly this deferral: suite-to-job mapping is not part of the CI gate.

This change delivers the M2-S7 contract: a versioned, config-declared suite-to-job map (`verify.suite-map`, shaped like the delivered `merge.gates` declaration) that states which CI job runs which suite set and which suite set the local gate evaluates; a breadth comparison resolved by one deterministic rule over that declaration and the already-read workflow job-name set; two additive report fields — `data.suiteBreadth` (the mirrored CI breadth, in declared order) and `data.mirrorsJob` (the CI job that breadth mirrors) — present together on both emitted report types; and a `verify.narrowed-scope` refusal at exit `1` that names the narrowed breadth, performs no state append, and therefore leaves no fresh verification for `merge` to consume. Every delivered behaviour of the five gates, the verdict vocabulary, the reason codes, the report types' existing fields, the durable verification record, the capsule event, the exits, and the invocation grammar is preserved; a repository that declares no map produces the delivered output byte-identically.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The gate battery is delivered and closed.** `verify gates <changeRef>` evaluates the config-declared battery (default: the five built-ins `lifecycle-finalization`, `ci-green`, `push-parity`, `owner-gate`, `squash-preflight` in shipped order), one cited verdict per gate, no short-circuit; overall `pass` only when every gate passes; `unknown` is never a pass (feature-verify-gates.md).
- **The CI gate's workflow knowledge is job presence only.** The expected job set is read at the edge from `.github/workflows/ci.yml` with a bounded YAML read; only each job's display `name` (falling back to the job id) leaves the adapter; the delivered read contract states that "No raw workflow body, step, environment value, or secret crosses the boundary" (`readCiWorkflowJobNames`). An absent, unreadable, empty, duplicate, or over-cap set is `ci-expected-jobs-invalid`, never green. Current truth states it plainly: "The CI gate detects job display-name presence only; matrix expansion, suite-to-job mapping, and job-level `if` conditions are deferred."
- **The report carries no breadth and no job attribution.** The delivered `VerifyGatesReport` is `schemaVersion`, `changeRef`, `target`, `overall: "pass"`, `summary`, `gates[]`; `VerifyGateRecord` is exactly `id`, `verdict`, `reason`, `citation`; the citation's sources, outcomes, counts, name kinds, and reasons are closed vocabularies. The additive cross-repository report (GH-310) adds `overall: pass|fail`, `definitionOfDone`, `blockingMembers[]`, `reviewFlow`, and a required `member` on each record. Neither type names what the local run covered.
- **The declaration precedent exists.** The gate set is config-declared versioned data (`merge.gates`, schema `delivery.merge.gates.v1`): a closed object with `schemaVersion` plus `entries[]`, resolved by one pure resolver, refused as `config.value.invalid` on an unsupported version, a duplicate, a malformed entry, an omitted built-in, or an undeclared field; absent means the shipped default. The configuration layer presents declared keys as typed branches (`merge`, `harness`, `queue`, `coordinator`, …) with a per-key default and refusal semantics.
- **The command is read-only with exactly one write.** "It performs no merge, auto-merge, provider mutation, or child process." Its bounded read budget is one local ledger read, one repository HEAD/branch read, one local CI-workflow read, at most one bounded open-PR page (100), one resolved detail read, one check-run page (100), and one work-item read, with no retries and no pagination; "It appends exactly one fenced gate-verification record per full battery evaluation and nothing else."
- **The durable record is a closed, consumed shape.** `merge.gate-verification` (schema `delivery.merge.gate-verification.v1`) carries `schema`, `changeRef`, `headSha`, `verifiedAt`, `gateSet` (schema version plus id list), `gates[]` (`id`, `verdict`, `reason`, `citation` only — no other keys), and `trackerPosture`. The closed key set is validated on read and as the post-append equality check; `merge` consumes the record, and a stale record is refused (`merge.gates-stale`).
- **The failure envelope has one additive evidence member.** `delivery.result.v1` carries exactly `data` or `error`; `error` carries `code`, `category`, `retryable`, `consequence`, `remediationHint`, and optional `summary`. TDR-0027 declares one optional envelope-level `detail` member whose declared set is currently `{ holder?: string }`; a future member is "a declared addition with its own bound and test" and values are "identifiers only, never truncated".
- **The invocation grammar is pinned.** "`verify` is one top-level command with three subcommands, `change`, `gates`, and `deploy`, each followed by exactly one change ref and no command-specific flags"; a third positional or unknown flag is `fallback.invocation`.
- **The `verify` error kind carries six identities** — `verify.ledger.incomplete`, `verify.gates.failed`, `verify.gates.unavailable`, `verify.deploy.trace-missing`, `verify.deploy.status-stale`, `verify.deploy.trace-failed` — two of which are the `verify gates` rows.
- **The policy is declared prose today.** `policy-as-code.md` lists "Local gate breadth must equal CI breadth — Suite-to-job mapping (M2-S7)" among future policy ideas, i.e. a rule without a check.

### 2.2 Pain Points / Gaps

- **GAP-1**: No local breadth datum. Nothing in the report states which suites the local run claims to have covered, so "green" carries no breadth.
- **GAP-2**: No CI-side breadth. The workflow read yields job names only, so no CI job's breadth is expressible and nothing can be compared against the local run.
- **GAP-3**: No mirror attribution. A green report cannot name the CI job whose breadth it claims to stand in for, so a reader cannot tell a full-substitution run from a narrow one.
- **GAP-4**: Narrow masquerade. A local run over a narrow suite produces the same `overall: "pass"` and the same durable record as a full run, and that record is what phase 10 and `merge` consume.
- **GAP-5**: No refusal identity. A narrowed run has no classified outcome of its own; it is indistinguishable from a full one.
- **GAP-6**: Silent declaration drift. Nothing confronts a local suite declaration with the CI job it names, so adding a local step or renaming a job leaves the claim silently wrong.

## 3. PROBLEM STATEMENT

Because the local battery cites one verdict per gate and nothing about the suite breadth it covers, while the CI gate reads only the workflow's job names and no CI job's breadth is declared anywhere, a local run whose breadth is narrower than the CI job that carries that breadth produces the same green report and the same durable verification record as a full run — so a narrow local suite masquerades as full green, phase 10 and `merge` consume evidence whose breadth is unknown, and a declaration that drifts from the repository's CI fails silently instead of refusing.

## 4. GOALS

- **G-1**: The repository declares its suite-to-job map once, as versioned configuration in the same posture as `merge.gates`: which CI job runs which suite set, and which suite set the local gate evaluates; an invalid declaration is refused before any read.
- **G-2**: A reported run cites its breadth: `data.suiteBreadth` names the mirrored CI breadth and `data.mirrorsJob` names the CI job that breadth mirrors, present together on both report types.
- **G-3**: A narrow local breadth cannot report full green: `verify gates` refuses with `verify.narrowed-scope` at exit `1`, names the narrowed breadth, and appends no verification record, so no fresh full-green evidence exists for `merge` to consume.
- **G-4**: Breadth resolution is total and never a false pass: an equality is reportable, a strict narrowing refuses, and a breadth that cannot be mirrored or corroborated is a classified failure — never a pass.
- **G-5**: Every delivered behaviour is preserved: gate ids, order, verdicts, reasons, citations, summary and human bytes for the five gates, exits, the invocation grammar, the durable record shape, the capsule event, and the read budget.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance criteria demonstrated | 2 of 2 (backlog M2-S7 goal and AC, mapped in Appendix B) |
| Milestone scenario seeds satisfied | SC-M2-S7-01 and SC-M2-S7-02, by name (Appendix B) |
| Reported runs whose cited breadth is narrower than the mirror job's declared breadth | 0 (a narrowing is refused, never reported) |
| Narrowed runs that leave a fresh full-green verification record | 0 (no ledger append on `verify.narrowed-scope`) |
| Additional reads introduced | 0 (the map is resolved from the same resolved configuration values that supply the declared gate set; the mirror corroboration reuses the delivered workflow job-name read) |
| Delivered literal changes outside the enumerated set (§8.3) | 0 |
| New error-table rows | 1 (`verify.narrowed-scope`); new domain kinds 0 |
| Repositories without a declared map | Byte-identical report, human text, and exits (100% of parity fixtures) |
| Live network calls in default tests | 0 |
| Quality gates | `pnpm check` green with the pm-notes gate environment before the PR opens |

### 4.2 Non-Goals

- **NG-1**: No matrix expansion, no reusable-workflow mapping, no job-level `if` awareness, and no step-level proof that a CI job runs a suite. The declaration is the record of CI breadth; a workflow step body is never parsed.
- **NG-2**: No execution. The command runs no suite, spawns no child process, and never executes a workflow step; breadth comes from declarations and the existing bounded reads.
- **NG-3**: No per-invocation breadth selector. The invocation grammar is unchanged (no flag, no extra positional); breadth is a declaration of record, not an argument.
- **NG-4**: No merge, review-approval, or branch-protection work; no waiver path for the narrowed scope in this change.
- **NG-5**: No change to the durable `merge.gate-verification` record shape, the capsule `gate.outcome` payload, the gate-battery verdicts, or the delivered report field set of either report type beyond the two additive fields.
- **NG-6**: No per-member suite breadth. On a cross-repository report the two fields describe the invoking repository's declaration, unchanged across members.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Declared suite-to-job map with closed resolution | Breadth needs one declared source: what CI runs and what the local gate evaluates |
| F-2 | Suite-breadth citation on every report | A green report must state the breadth it claims and the CI job it mirrors |
| F-3 | Narrowed-scope refusal with no durable append | A narrow local suite must not masquerade as full green in the report or in the ledger |
| F-4 | Total breadth resolution: equality, narrowing, unmirrored, uncorroborated | Every declaration state must resolve to one deterministic outcome and never to a pass it has not earned |
| F-5 | Delivered-surface preservation | The five gates, record, capsule, exits, grammar, and read budget must not move |

### 5.1 Capability Details

- **F-1 — Declared suite-to-job map.** The project configuration document gains one additive, optional, versioned branch `verify.suite-map` (schema `delivery.verify.suite-map.v1`), shaped like `merge.gates`: an object carrying exactly `schemaVersion`, `jobs`, and `local`, resolved by one pure resolver that performs no I/O. `jobs[]` declares the suite-to-job mapping: each entry carries exactly `job` (a non-empty expected-check-run name of at most 120 characters — the same string the CI gate accepts as an expected job name, i.e. the workflow job's display `name` falling back to its id) and `suites` (a non-empty list of suite identifiers). `local` declares the suite set the local gate evaluates: a non-empty list of suite identifiers. A suite identifier is a repository-scoped identifier matching `^[a-z][a-z0-9-]*$`, 1..64 characters, unique within one `suites` list and unique within `local`; it is a declared identifier, not a closed core vocabulary, exactly as a declared gate id is. Bounds: at most 64 `jobs[]` entries, at most 32 suites in one `suites` list, at most 32 suites in `local`. The declaration is refused as the delivered `config.value.invalid` — before any read is performed and with no `data` — on an unsupported or missing `schemaVersion`, an undeclared or missing top-level key, a non-list `jobs`/`local`, an empty `jobs`/`local`, an over-cap list, an undeclared or missing entry key, a non-string or empty `job`, a `job` over 120 characters, a duplicate `job`, an empty `suites` list, an identifier that fails the grammar or the length bound, a duplicate identifier in one `suites` list, or a duplicate identifier in `local`. The map is resolved from the same resolved configuration values that supply the declared gate set, through the same injected seam; absent means undeclared — no default map is invented. The command remains read-only and its source budget is unchanged: the map adds no read of its own and no write (DM-1, DM-3, DEC-11).
- **F-2 — Suite-breadth citation.** Both emitted report types — the delivered `VerifyGatesReport` and the additive `CrossRepositoryVerifyGatesReport` — gain two additive optional fields at the report root: `suiteBreadth` (the mirrored CI breadth: the mirror job's declared `suites`, in the map's declared order, de-duplication not required because duplicates are refused) and `mirrorsJob` (the mirror job's declared name, non-empty). They are one fact and are present together or absent together; when the map is undeclared, or no report is emitted, both are absent. On a declared map with a resolved equality the fields are present on every report. `suiteBreadth` is the **CI job breadth**, never the local declaration and never a union: the equality rule of F-4 makes the two identical, and citing the CI breadth keeps the citation meaning "this run's breadth equals the breadth of the job named in `mirrorsJob`". The cross-repository report carries the same two fields with the same values (they describe the invoking repository's declared local breadth and are member-independent) (DM-2).
- **F-3 — Narrowed-scope refusal.** When the declared local breadth is a strict subset of the mirror job's declared breadth, `verify gates` refuses: exit `1`, no `data`, `error.kind` `verify`, `error.code` `verify.narrowed-scope` (new row: category `user`, non-retryable, consequence `not_landed`, projection class `user-validation`, summary "The local gate breadth is narrower than the CI job it mirrors.", remediation hint "Run the local gate over the declared full suite breadth, or update the declared suite map so the local suite set matches the mirrored CI job, then re-run the gates."). The narrowed breadth is named twice, deterministically: in the failure-envelope evidence member `detail.suiteBreadth` (the complete local declaration, in declared order, never truncated, bounded to 32 identifiers of at most 64 characters each) and in the failure `summary`, whose header line gains the tokens `scope=narrowed mirror=<job>` followed by up to `VERIFY_GATES_MAX_CITATION_NAMES` (8) suite identifiers in declared order with an `omitted=<n>` marker when more remain, while the summary keeps exactly one line per gate (the delivered header-plus-five shape, at most six lines and 4096 bytes, each gate line unchanged). The refusal performs **no** state append: no `merge.gate-verification` record is written and no capsule `gate.outcome` event is appended, so a narrowed run leaves no fresh full-green evidence for phase 10 or `merge` to consume. The refusal is evaluated after the declared gate set, the map, and the reads (so the summary carries real gate evidence) and before the battery verdict projection, and it takes precedence over `verify.gates.failed`, over the classified-unknown reuse, and over `verify.gates.unavailable` (DM-5). It does not take precedence over command-level failures that prevent an evaluation at all: grammar (`input.value.rejected`, `fallback.invocation`), gate-set resolution (`config.value.invalid`), map resolution (`config.value.invalid`), mirror corroboration (`config.value.invalid`), and an append failure keep their delivered identities and exits (F-3, DM-5, DM-6).
- **F-4 — Total breadth resolution.** One pure rule resolves the pair (map, read workflow job-name set) to exactly one outcome, with no other path: (a) **equality** — if one or more declared jobs carry a `suites` set equal (as a set; order-insensitive) to the `local` set, the mirror is the first such job in declared order, the run is reportable, and the report cites F-2's fields; (b) **narrowing** — otherwise, if one or more declared jobs carry a `suites` set that is a strict superset of the `local` set, the mirror is the first such job in declared order and the run is refused with F-3's identity; (c) **unmirrored** — otherwise (the local set is covered by no single declared job, which includes a local set that is a strict superset of every job's set or disjoint from all of them) the declaration cannot be attributed to one CI job and is refused as the delivered `config.value.invalid` with no `data`; (d) **uncorroborated** — the resolved mirror's name must appear, by exact string match, in the read CI-workflow job-name set before it may be cited: when the workflow was read and its set is valid but the mirror is absent, the declaration contradicts the repository's CI and is refused as `config.value.invalid`; when the workflow is absent, unreadable, empty, duplicate, or over-cap, the breadth is not corroborated but the delivered CI gate already fails `ci-expected-jobs-invalid`, so the run follows the delivered `verify.gates.failed` path at exit `1` with no `data` and cites no breadth. No outcome is a pass except (a), equality never reports a superset, and no breadth fact is invented from observed check-run names. Because the delivered outcome projection suppresses a command-supplied summary and hint for a `config`-shaped failure (only the table's own summary and hint reach the envelope), the cause of an `unmirrored` or `uncorroborated` refusal — the local breadth or the mirror job — is named in the command's identifier-only human diagnostic, not in the envelope; that projection stays exactly as delivered (F-4, DEC-5, DEC-14).
- **F-5 — Delivered-surface preservation.** The five built-in gates keep their ids, order, verdict vocabulary (`pass`/`fail`/`unknown`), closed reasons, sources, outcomes, count names, name kinds, and citation shape; the failure summary for a non-narrowed run is byte-identical; the success human report stays the delivered six deterministic lines and gains no line. The map adds no expected job name to the CI gate's expected set and alters no CI-gate condition, so `ci-expected-jobs-invalid`, `ci-missing-jobs`, `ci-green`, and every other CI reason is unchanged. The invocation grammar is unchanged (`verify gates <ref>`; a third positional or unknown flag is still `fallback.invocation`). The durable `merge.gate-verification` record, its schema, its closed gate-record key set, its gate-set identity, and its append-once-per-reported-evaluation behaviour are unchanged; the capsule `gate.outcome` payload is unchanged. The read budget is unchanged: zero additional reads (F-5, DEC-9, DEC-10).

## 6. USER & SYSTEM FLOWS

```
Flow 1: A declared map whose local breadth equals the mirrored CI job (SC-M2-S7-01)
  config declares verify.suite-map with jobs[] = [{job: "TS aggregate check",
    suites: [tests, lint, format, typecheck, boundaries, prompt-conformance,
             help-guide-coverage, exports-parity]}] and local = the same eight
  → grammar ok → declared gate set resolved → map resolved (no read)
  → reads: ledger, HEAD/branch, ci.yml job names, open PRs, detail, check-runs, work item
  → mirror resolution: exact set match on "TS aggregate check" (first in declared order)
  → corroboration: "TS aggregate check" is in the read job-name set
  → battery evaluates; all five gates pass
  → one merge.gate-verification record appended (unchanged shape)
  → report: overall=pass, five gate records unchanged,
    data.suiteBreadth = the eight suites in the job's declared order,
    data.mirrorsJob = "TS aggregate check"; exit 0
  → human report: the delivered six lines (unchanged)

Flow 2: A narrow local breadth refuses full green (SC-M2-S7-02)
  config declares local = [tests] while the same job declares eight suites
  → map resolves; repair: local is a strict subset of the job's set → narrowed
  → mirror = "TS aggregate check"
  → battery evaluates (evidence still produced, never reported as data)
  → refusal: exit 1, error.kind=verify, error.code=verify.narrowed-scope,
    detail.suiteBreadth = [tests], summary header names scope=narrowed,
    mirror=TS aggregate check and the eight-suite job breadth
  → NO merge.gate-verification append, NO capsule gate.outcome append
  → the previous full run's record is the newest record; nothing fresh is green

Flow 3: Breadth that cannot be corroborated is never a pass
  config declares the map; the workflow file is absent (or unreadable/invalid)
  → the delivered CI gate fails ci-expected-jobs-invalid
  → no mirror corroboration is attempted, no breadth is cited
  → exit 1, error.code=verify.gates.failed, delivered summary, no data

Flow 4: Declaration drift is refused, not silent
  a) the declared mirror job no longer exists in the read job-name set
     → exit 1, config.value.invalid, mirror named in the bounded evidence
  b) local cites a suite set no single job covers (wider or disjoint)
     → exit 1, config.value.invalid, local breadth named in the bounded evidence
  c) the map is structurally invalid → exit 1, config.value.invalid,
     raised before any read

Flow 5: No declared map stays byte-identical (parity)
  the configuration declares no verify.suite-map
  → no breadth resolution, no refusal path, no new key in the report
  → report, human text, summary, exits, and the appended record are
    byte-identical to the pre-change behaviour
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The additive `verify.suite-map` configuration branch: closed shape (`schemaVersion`, `jobs[]` with `job`/`suites`, `local`), the identifier grammar, the caps, the duplicate and undeclared-field refusals, and the pure resolver.
- The breadth resolution rule (equality, narrowing, unmirrored, uncorroborated) over the declared map and the delivered workflow job-name read.
- The additive report fields `data.suiteBreadth` and `data.mirrorsJob`, present together, on both emitted report types.
- The `verify.narrowed-scope` error row, its projection (exit `1`, `user-validation`), the `detail.suiteBreadth` evidence member, and the narrowed summary header tokens.
- The no-append-on-refusal rule for the durable verification record and the capsule event.
- Declared constants and bounds; the structure, behaviour, golden, and parity fixture work; the composition seam that supplies the declared map.
- The reference declaration for this repository (a map whose local breadth equals the mirrored aggregate CI job's declared breadth), so this repository's own gate runs cite breadth instead of refusing.
- Milestone bookkeeping per planning conventions (backlog M2-S7 progress marker, status snapshot).

### 7.2 Out of Scope

- [OUT] Matrix expansion, reusable-workflow mapping, job-level `if` conditions, or step-level proof of a job's breadth (NG-1).
- [OUT] Executing anything: no suite runner, no child process, no workflow step, no provider write (NG-2).
- [OUT] An invocation-scoped breadth selector, any new flag or positional, or any change to the `verify` grammar (NG-3).
- [OUT] Per-invocation recording of what a shell actually executed (for example a scoped `pnpm --filter` run) — a read-only command over declarations cannot observe it (§7.3, OQ-1).
- [OUT] Merge execution, review approval, branch protection, or a waiver/override path for a narrowed scope (NG-4).
- [OUT] Any change to the `merge.gate-verification` record shape, its schema version, or its consumers; any change to the capsule `gate.outcome` payload (NG-5).
- [OUT] Per-member suite breadth on a cross-repository report (NG-6).
- [OUT] Amending current-truth feature specifications in this specification; phase 7 reconciles them (§24/Appendix C).

### 7.3 Deferred / Maybe-Later

- **A recorded local-run breadcrumb.** A durable record of what a local gate invocation actually executed (so an ad-hoc narrow shell run is observable) would need a writer and an execution surface; deferred, named by no acceptance criterion (OQ-1).
- **Step-derived CI breadth.** Proving a job's breadth from its workflow steps would need an additive workflow read contract that the delivered adapter boundary deliberately forbids today (OQ-2).
- **Merge-time breadth enforcement.** Requiring a fresh record to carry breadth would change the record shape and `merge`'s consumption; deferred to the merge surface's own change (OQ-3).
- **Per-member breadth.** Extending breadth to each declared member of a cross-repository change.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface is added or changed. The observable surfaces are the CLI invocation `verify gates <changeRef>` (grammar unchanged, no command-specific flag) and its `delivery.result.v1` envelope. The mirrored MCP `gate-report` tool keeps its input schema (exactly one `ref`, no additional properties) and inherits the additive report fields and the new error identity through the shared engine; it adds no tool and no input.

### 8.2 Events / Messages

No new topic and no new event kind. The durable `merge.gate-verification` record is unchanged in shape, schema, and derivation, and is still appended exactly once per full battery evaluation that is not refused for narrowed suite breadth. The capsule `gate.outcome` event is unchanged: same payload field set (`gateSet`, `headSha`, `gates[]`), same key derivation, same non-gating disclosure. The one behavioural addition is negative and additive: a run refused with `verify.narrowed-scope` appends neither the record nor the capsule event.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `verify.suite-map` declaration | Additive optional versioned configuration key (schema `delivery.verify.suite-map.v1`) carrying exactly `schemaVersion`, `jobs[]`, and `local`. `jobs[]` entries carry exactly `job` (non-empty expected-check-run name, ≤120 chars; the workflow job display `name` falling back to the id) and `suites` (1..32 suite identifiers). `local` is 1..32 suite identifiers. Identifier grammar `^[a-z][a-z0-9-]*$`, 1..64 chars, unique within a `suites` list and within `local`; `job` values unique. Caps: ≤64 `jobs[]` entries. Refused as `config.value.invalid` (before any read, no `data`) on an unsupported/missing `schemaVersion`, a missing or undeclared key, a non-list or empty `jobs`/`local`, an over-cap list, an undeclared or missing entry key, a non-string/empty/over-long `job`, a duplicate `job`, an empty `suites`, a malformed or duplicate identifier. Absent means undeclared; no default map is invented (DEC-2). |
| DM-2 | Report breadth fields | Both `VerifyGatesReport` and `CrossRepositoryVerifyGatesReport` gain two additive optional root fields: `suiteBreadth?: readonly string[]` (the mirror job's declared `suites` in the map's declared order, 1..32 identifiers, each ≤64 chars) and `mirrorsJob?: string` (the mirror job's declared name, 1..120 chars, non-empty). They are present together or absent together; they are absent when the map is undeclared and on every non-report outcome. `suiteBreadth` is the CI job breadth, never the local declaration and never a union; `mirrorsJob` is the exact expected-check-run name the CI gate would expect for that job. On the cross-repository report both describe the invoking repository's declaration and are member-independent. The delivered report fields, gate records, `summary`, and `overall` semantics are unchanged (DEC-4). |
| DM-3 | Constants and bounds | `VERIFY_SUITE_MAP_SCHEMA_VERSION = "delivery.verify.suite-map.v1"`; `VERIFY_SUITE_MAP_CONFIG_KEY = "verify.suite-map"`; `VERIFY_SUITE_MAP_MAX_JOBS = 64`; `VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB = 32`; `VERIFY_SUITE_MAX_BREADTH = 32`; `VERIFY_SUITE_MAX_ID_CHARS = 64`; suite-id pattern `^[a-z][a-z0-9-]*$`. Job-name length reuses the delivered `VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS` (120) and is never redeclared; the narrowed summary reuses the delivered `VERIFY_GATES_MAX_CITATION_NAMES` (8), `VERIFY_GATES_MAX_SUMMARY_LINES` (6), and `VERIFY_GATES_MAX_SUMMARY_BYTES` (4096). No node-byte bound is added: the declaration is a node of the already-bounded configuration read and every collection in it is capped (DEC-3). |
| DM-4 | Breadth resolution outcome | One internal closed outcome over `(map, workflow facts)`: `equal` (a job's `suites` set equals the `local` set; mirror = first such job in declared order), `narrower` (otherwise the first job whose `suites` set is a strict superset of `local`, in declared order), `unmirrored` (no job's set covers `local`), `uncorroborated` (the resolved mirror is absent, by exact string match, from a validly read job-name set). Breadth is resolved only when the workflow read is valid; when it is absent, unreadable, empty, duplicate, or over-cap, no breadth outcome is produced and the delivered `verify.gates.failed` path stays in force. Only `equal` yields a report; `narrower` yields `verify.narrowed-scope`; `unmirrored` and `uncorroborated` yield `config.value.invalid`. Set comparison is order-insensitive; the citation uses the job's declared order. No other outcome exists (DEC-3, DEC-5). |
| DM-5 | `verify.narrowed-scope` error identity | One additive `ERROR_TABLE` row under the existing `verify` kind: code `verify.narrowed-scope`, category `user`, `retryable: false`, `consequence: "not_landed"`, `projectionClass: "user-validation"` (exit `1`), summary "The local gate breadth is narrower than the CI job it mirrors.", remediation hint "Run the local gate over the declared full suite breadth, or update the declared suite map so the local suite set matches the mirrored CI job, then re-run the gates." The handler emits it with `error.kind: "verify"`. The `verify` kind moves from six to seven identities; the `verify gates` subcommand from two to three rows (DEC-6). |
| DM-6 | Failure-envelope evidence member | `CommandResultDetail` gains one additive optional member `suiteBreadth?: readonly string[]` under TDR-0027's declared-addition rule: identifiers only, never truncated, present only on a `verify.narrowed-scope` refusal, carrying the complete `local` declaration in declared order, bounded by `VERIFY_SUITE_MAX_BREADTH` (32) entries of at most `VERIFY_SUITE_MAX_ID_CHARS` (64) characters. The existing `holder` member is unchanged, the member is never an open key-value map, and no other command sets it (DEC-8). |
| DM-7 | Durable record and capsule event — unchanged | `MergeGateVerificationRecord` keeps exactly `schema`, `changeRef`, `headSha`, `verifiedAt`, `gateSet`, `gates[]` (`id`/`verdict`/`reason`/`citation`, no other keys), and `trackerPosture`; the schema stays `delivery.merge.gate-verification.v1`; the closed key validation, the post-append equality check, and the read tolerance are untouched, so no breadth fact enters the ledger and every existing reader stays valid. The capsule `gate.outcome` payload field set and key derivation are unchanged. The only behavioural difference is the no-append rule on a narrowed refusal (DEC-7, DEC-9). |

**Additive documented error row (two-way sync).**

| Code | Domain kind | Category | Retryable | Consequence | Projection class | Exit | Emitted when |
|---|---|---|---|---|---|---|---|
| `verify.narrowed-scope` | `verify` | `user` | `false` | `not_landed` | `user-validation` | `1` | The declared local suite set is a strict subset of the mirrored CI job's declared suite set, so the run cannot report full green. |

**Enumerated changes to delivered literals (nothing else changes).**

| # | Delivered item | Current value | New value |
|---|---|---|---|
| 1 | `VerifyGatesReport` | `schemaVersion`, `changeRef`, `target`, `overall: "pass"`, `summary`, `gates[]` | plus optional `suiteBreadth?`, `mirrorsJob?` |
| 2 | `CrossRepositoryVerifyGatesReport` | the above required fields plus `overall: "pass" \| "fail"`, `definitionOfDone`, `blockingMembers[]`, `reviewFlow` | plus the same two optional fields |
| 3 | `CommandResultDetail` | `{ holder?: string }` | plus optional `suiteBreadth?: readonly string[]` |
| 4 | `ERROR_TABLE` | no `verify.narrowed-scope` row; `verify` kind = 6 identities; `verify gates` = 2 rows | one row added; `verify` = 7; `verify gates` = 3 |
| 5 | Append sentence (current truth) | "It appends exactly one fenced gate-verification record per full battery evaluation and nothing else." | "… per full battery evaluation **that is not refused for narrowed suite breadth**; a refused run appends nothing." (record shape, schema, derivation, and the one-append counting for every non-refused evaluation unchanged) |
| 6 | Configuration catalog | no `verify` branch | one `verify` branch carrying one key, `verify.suite-map`, default absent |
| 7 | Contract constants | no suite constants | the six declared in DM-3 |

### 8.4 External Integrations

N/A — no external vendor or API integration is added and no provider read is added. Breadth comes from a configuration declaration plus the delivered single local CI-workflow read; that read remains the delivered bounded `readCiWorkflowJobNames` call, unchanged in scope, bound, and outcome vocabulary, and its result is used for both the CI gate and the mirror corroboration.

### 8.5 Backward Compatibility

- **Schema identifiers unchanged.** `delivery.verify-gates.v1`, `delivery.result.v1`, `delivery.merge.gate-verification.v1`, and `delivery.merge.gates.v1` keep their identifiers. Changes are the seven enumerated items in §8.3, of which only item 5 changes a behaviour and only for a run that declares a narrowing map.
- **No declared map is byte-identical.** A repository (or fixture) whose configuration declares no `verify.suite-map` sees the delivered report, human text, failure summary, exits, and appended record byte-for-byte, because breadth resolution produces neither a field nor a refusal (F-5, AC-F5-1, AC-F5-4).
- **The five gates are untouched.** Gate ids, shipped order, verdict vocabulary, closed reason codes, sources, outcomes, counts, name kinds, citation shape, per-gate human lines, and the CI gate's expected-set validation and reasons are all unchanged; the map adds no expected job and no gate condition.
- **The durable ledger is unchanged.** No breadth fact enters `merge.gate-verification`; a narrowed refusal appends nothing, so `merge`'s freshness and stale-refusal semantics keep their delivered meaning and no existing consumer needs a new field.
- **The error table stays two-way synced.** Exactly one row and no domain kind are added; `verify.ledger.incomplete`, `verify.gates.failed`, `verify.gates.unavailable`, and the three deploy rows are unchanged, and `fallback.internal` still contains anything undeclared.
- **One new refusal shape, enumerated.** A narrowed run is the only new outcome: `verify.narrowed-scope` at exit `1`, an error envelope with `detail.suiteBreadth` and no `data`. It reuses the delivered `user-validation` projection, so `{0,1,2}` is preserved and no new exit value appears.
- **The delivered failure projection is not relaxed.** A `config`-shaped failure still suppresses a command-supplied summary and hint; the two map-side refusals therefore reuse the table's own summary and hint and name their cause in the human diagnostic (DEC-14). The new `detail` member is honoured through the same explicit, validated projection the delivered `holder` member uses, so no undeclared key can reach the envelope.
- **Grammar and read budget unchanged.** `verify gates <ref>` keeps exactly one positional and no command-specific flag; the read count per invocation is unchanged (0 additional reads).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Envelope continuity: every new key lives under `data` or in the declared `error.detail` member; the `delivery.result.v1` five-field shape is preserved | 0 new top-level envelope keys; 1 declared `detail` member added; 0 `detail` keys outside the declared set |
| NFR-2 | Determinism and bounded output: mirror selection is declared order, `suiteBreadth` follows the mirror's declared order, and every collection is capped | Two runs over unchanged fixtures are byte-identical; ≤64 jobs; ≤32 suites per job; ≤32 breadth identifiers; each identifier ≤64 chars; ≤8 identifiers plus `omitted` in the narrowed summary header; summary ≤6 lines and ≤4096 bytes |
| NFR-3 | Offline and hermetic: default tests are fixture-driven over configuration fixtures and workflow fixtures | 0 live network calls, 0 credentials, 0 provider sockets in default suites |
| NFR-4 | Read budget unchanged: breadth adds no read | The map is resolved from the same resolved configuration values that supply the declared gate set, so it adds no read of its own; the delivered per-source gates budget is untouched — 1 ledger read, 1 repository HEAD/branch read, 1 CI-workflow read, ≤1 open-PR page, ≤1 detail read, ≤1 check-run page, ≤1 work-item read, 0 retries, 0 pagination — with identical counts and identical transport calls with and without a declared map |
| NFR-5 | Read-only posture: no write on any refusal | 0 state appends and 0 capsule appends on a `verify.narrowed-scope` refusal; exactly 1 `merge.gate-verification` append per full battery evaluation that is not refused; 0 writes on any config or repository file |
| NFR-6 | No false pass: a report never cites a breadth narrower than the mirror job's declared breadth | 0 occurrences over the fixture corpus; every narrowing is a `verify.narrowed-scope` refusal; every uncorroborated breadth is a non-report outcome |
| NFR-7 | Identity discipline: exactly one new error-table row, no new domain kind, no renamed or reworded row | 1 row added (`verify.narrowed-scope`); 0 kinds added; 0 delivered rows reworded |
| NFR-8 | Parity for an undeclared map: every delivered output is unchanged | Byte-identical report, human text, failure summary, appended record, and exits across 100% of parity fixtures |
| NFR-9 | Quality gates and commit hygiene for the delivering change | `pnpm check` green with the pm-notes gate environment before the PR opens; conventional commit subjects scoped `GH-300`; every body/footer line ≤100 characters |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new telemetry ships and no new metric is invented. Observability comes from the classification the surface already projects: the presence or absence of `data.suiteBreadth`/`data.mirrorsJob` on a report, the narrowed refusal with its `detail.suiteBreadth` and its `mirror=`/`omitted=` summary tokens, and the delivered `config.value.invalid` refusal whose identifier-only human diagnostic names a drifted mirror or an unattributable local breadth. Absence is always classified: an uncorroborated breadth never passes as evidence and is never silent — it is either the delivered CI failure, a configuration refusal, or the narrowed refusal.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Breadth is declared, not observed: an agent's ad-hoc narrow shell run never reaches the command, so the policy binds the declaration of record rather than what executed | M | M | The refusal is the enforcement point plus the no-append rule; the declaration is committed and reviewed with the code; the gap is declared (§7.3, OQ-1) and named by no AC | M |
| RSK-2 | Declaration drift blocks an otherwise healthy change: adding a local step or renaming a CI job turns into `config.value.invalid` or a narrowed refusal | M | M | Both refusals name the exact drift (mirror or local breadth) in the human diagnostic, and a one-line map edit repairs it; the delivered `config.value.invalid` remediation points at the configuration value; drift is never silent by design | L–M |
| RSK-3 | `jobs[].suites` is not proven against the workflow steps, so a false CI breadth can be declared | M | M | The mirror must exist in the read job set, the declaration is configuration of record at the same trust level as `merge.gates`, and review is the control; proving steps would need a workflow-step read the adapter forbids (OQ-2) | M |
| RSK-4 | The composition never supplies the configuration document to the gates runtime, leaving the policy inert with no signal | M | M | A stated requirement on the composition plus a structure assertion that the reference composition supplies the map read and a behaviour fixture that exercises it end-to-end; the inert state is indistinguishable from "undeclared", which is the designed parity path | M |
| RSK-5 | The new refusal masks a coexisting gate failure behind a scope error, delaying the real diagnosis | L | M | The refusal summary keeps the delivered six-line block, so every gate's verdict and reason is still visible, and the hint names both the breadth and the re-run action | L |
| RSK-6 | The `detail.suiteBreadth` member drifts from TDR-0027's bounded, never-truncated contract | L | L | One declared bound, a structure test over the detail key set, and the documented-row sync gate | L |
| RSK-7 | A symmetric false declaration (both `local` and `jobs[].suites` narrowed together) still cites equality | M | L | Equality is over declared sets and the declaration is reviewed as policy data; step-level proof is out of reach for a read-only command and is declared (NG-1, OQ-2) | M |
| RSK-8 | A reader over-reads the cross-repository report's breadth as per-member breadth | L | L | The fields are documented as change-level and member-independent, and per-member breadth is declared out of scope | L |
| RSK-9 | Documentation drift across the verify-gates spec, the result-contract error table, the config-layer catalog, the MCP mirror row, and the policy register | M | M | Phase 7 reconciles exactly the deltas enumerated in §24; the two-way error-table gate and the doc-distribution guard cover the new row and any new doc | L |

## 12. ASSUMPTIONS

- The delivered workflow job-name read is the only source of CI job identity, and a map `job` value is the same string the CI gate expects (display `name`, else job id).
- The project configuration document is the declaration home for the map, and the composition can supply it to the gates runtime through the same seam that supplies the declared gate set.
- A suite identifier is repository-scoped policy data, not a core vocabulary; the core pins only its grammar, its length bound, and its caps.
- This repository's local aggregate evaluates the same eight suites the aggregate CI job runs, so its own declaration resolves to equality and its own gate runs cite breadth instead of refusing.
- Matrix-expanded job names, reusable workflows, and job-level `if` conditions remain outside every surface this change touches.
- The durable verification record is consumed by `merge` and must not change shape in this change; breadth is report data only.
- Delivery runs the full eleven-phase lifecycle on a branch from `main-tools`; the PR targets `main-tools` and stops open.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-178 (M0-S9 verify gates v1) | **Delivered**; supplies the five-gate battery, the citation layers, the exits, the CI-workflow job-name read, the config-declared gate set, the read budget, and the `merge.gate-verification` record. The story's declared dependency |
| Depends on | GH-225 (M1-S4 merge transaction) | **Delivered**; supplies the `merge.gates` declaration posture (`config.value.invalid` refusals, closed fields, absent means default) the map mirrors, and the record consumer whose freshness semantics must not move |
| Depends on | GH-310 (M2-S19 cross-repository changes) | **Delivered**; supplies the additive cross-repository report type that gains the same two fields |
| Depends on | Delivered configuration layer | The typed project configuration branch and its per-key default/refusal semantics; the map is declared there and resolved on the same pass |
| Depends on | Delivered result contract and error table (TDR-0027) | The optional envelope `detail` member rule the new evidence member follows; the two-way documented-row sync gate; the `{0,1,2}` projection |
| Consumed by | Phase 9/10 gate runs and `merge`'s freshness path | A narrowed run leaves no fresh record, so field-gate evidence and merge freshness keep their delivered meaning |
| Blocks | Any later breadth-at-merge enforcement or policy-engine rule | Those need the report fields and the refusal identity this change introduces |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Must breadth bind per invocation rather than per declaration, so an ad-hoc narrow shell run is observable? | A read-only command over declarations cannot see a manual `pnpm --filter` run; binding per invocation would need a durable local-run record (a new writer) or an invocation flag (a grammar change) | **Deferred, non-blocking**: declaration-of-record is the delivered posture for policy data (`merge.gates`) and is what the milestone scenarios pin. No acceptance criterion depends on it. Decision needed if the policy must bind per invocation: consult `@decision-advisor` |
| OQ-2 | Should the CI side of the map be proven from the workflow's steps instead of declared? | The delivered adapter boundary states that no raw workflow body or step crosses it, and step-shell parsing is unbounded; proving breadth would need an additive workflow read contract | **Deferred, non-blocking**: the mirror job must at least exist in the read job set, and the declaration stays policy data. Decision needed if step-derived breadth becomes a requirement: consult `@decision-advisor` |
| OQ-3 | Should `merge` refuse a verification record whose run cited no breadth, or a narrowed run, before landing? | The record shape is unchanged here; enforcing breadth at merge would need a record field and a merge change | **Deferred, non-blocking**: the no-append rule already denies a narrowed run any fresh record, so merge freshness semantics are sufficient for this change |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | **The breadth mechanism is a config-declared suite-to-job map**, mirrored on the delivered `merge.gates` declaration and resolved by one pure resolver; it supplies both sides — the CI job's declared suite set and the local gate's declared suite set — and the comparison is a set comparison between them, corroborated against the already-read workflow job-name set. Rejected: **(b) workflow-derived mapping from job `run:` steps** — the delivered adapter contract states that no raw workflow body or step crosses the read boundary, step shell strings are an unbounded vocabulary, and matrix/`if` semantics would have to be interpreted; **(c) a recorded local run read from a durable surface** — no delivered durable surface records executed suite coverage, the only verify-authored surfaces (`merge.gate-verification`, the capsule `gate.outcome`) are outputs of this very command, so reading a prior record would launder a narrow run into a fresh citation, and creating such a surface needs a writer and an execution path outside this change; **(d) an invocation flag** — it would change the delivered "no command-specific flags" grammar for a purely self-asserted input, and neither milestone scenario asks for one | The declaration is mechanical, bounded, hermetic, and needs no execution; it is the same trust posture the delivered gate set already uses; and it is falsifiable in both directions because the two sides are declared separately (a narrowed local set, or a local set no job covers, is refused rather than silently accepted) | 2026-11-15 |
| DEC-2 | The declaration is one additive optional key `verify.suite-map` (schema `delivery.verify.suite-map.v1`) carrying exactly `schemaVersion`, `jobs[]` (`job`, `suites`), and `local`; extra or missing keys are refused; suite identifiers match `^[a-z][a-z0-9-]*$` at 1..64 characters and are unique where declared; `job` values are unique, non-empty, and ≤120 characters; caps are 64 jobs, 32 suites per job, 32 breadth identifiers; absent means undeclared and no default map is invented; every defect is `config.value.invalid` raised before any read | Mirrors the delivered `merge.gates` contract exactly (closed field set, versioned, duplicate-refusing, undeclared-field-refusing) so one configuration posture covers both policy declarations; refusing before any read keeps a structural defect cheap, deterministic, and free of partial evidence; an invented default map would fabricate a breadth claim nobody declared | 2026-11-15 |
| DEC-3 | Mirror resolution is one ordered rule over declared order: an exact set match first (order-insensitive, mirror = first match), then the first job whose set is a strict superset of `local` (narrowing), otherwise unmirrored; the citation uses the mirror job's declared `suites` order | Declared order is the map's own precedence, needs no sorting or digest, and makes two runs over one declaration byte-identical; set equality (not list equality) keeps the comparison about breadth rather than about ordering style, while the citation order is pinned by the job declaration | 2026-11-15 |
| DEC-4 | `suiteBreadth` and `mirrorsJob` are **report-root fields on both report types**, never gate-record fields; they are present together or absent together; `suiteBreadth` is the mirrored CI job's declared suite list, never the local declaration and never a union | The scenario asserts a report-level path; breadth is a property of the invocation, not of one gate; and a record-level field would have to enter the closed `VerifyGateRecord`/citation vocabularies (new count names or name kinds) and would then have to be projected out of the durable ledger exactly as GH-310 projected `member`, which is strictly worse. Report-root fields keep every delivered gate record, citation, and ledger byte intact and stay coherent across the member-less and member-mode reports because both read one source | 2026-11-15 |
| DEC-5 | Equality semantics, complete and total: **equal** (local set equals a job's set) → reportable, fields cited; **narrower** (local is a strict subset of the first covering job) → `verify.narrowed-scope` refusal; **unmirrored** (no single job's set covers `local`, which includes a local set wider than every job and a disjoint one) → `config.value.invalid`; **uncorroborated** (mirror absent from a valid read job-name set) → `config.value.invalid`; **workflow not validly read** → the delivered `verify.gates.failed` path stands. Wider-than-CI breadth is therefore refused rather than reported, because `suiteBreadth` must equal the breadth of the job in `mirrorsJob` — reporting a superset would break that equality, and there is no job to name | Every state of a declaration must land on exactly one outcome, and none of them may be a pass it has not earned; refusing a superset keeps "the cited breadth equals a real CI job's breadth" an invariant of every report rather than a convention, and it makes drift visible in both directions instead of only in the narrowing direction | 2026-11-15 |
| DEC-6 | The narrowing is refused with one new row `verify.narrowed-scope` (kind `verify`, category `user`, non-retryable, `not_landed`, `user-validation` → exit `1`), evaluated **before** the battery verdict projection and taking precedence over `verify.gates.failed`, the classified-unknown reuse, and `verify.gates.unavailable`, but not over command-level failures (grammar, gate-set or map resolution, mirror corroboration, and — for a non-refused run — an append failure); the failure summary keeps the delivered header-plus-five-lines shape with `scope=narrowed mirror=<job>` and up to eight identifiers plus `omitted=<n>` in the header | A refusal needs its own identity or the table cannot classify it; the scenario pins exit `1` and the code; `user-validation` is the delivered class for a caller-fixable configuration state, and reusing it keeps `{0,1,2}`. Breadth is decidable without provider evidence, so making it the primary refusal is deterministic across environments; keeping the six-line summary means gate evidence is never lost to the refusal, which answers the obvious objection to taking precedence | 2026-11-15 |
| DEC-7 | A narrowed refusal performs **no** state append and **no** capsule append; the delivered append sentence is refined from "per full battery evaluation" to "per full battery evaluation that is not refused for narrowed suite breadth", with the record shape, schema, derivation, key set, and one-append-per-evaluation counting otherwise untouched | The record is what phase 10 and `merge` consume; appending a full-pass record from a narrowed run would carry the masquerade past the report and into the ledger, which is the exact failure the story targets. Denying the append is the only enforcement that does not change the record shape or the merge consumer, and it keeps the read-only-plus-one-write posture meaningful rather than stubbed | 2026-11-15 |
| DEC-8 | The narrowed breadth is named in the failure envelope through one additive `CommandResultDetail` member, `suiteBreadth?: readonly string[]` (identifiers only, never truncated, bounded to 32 entries of ≤64 characters), coexisting with the delivered `holder` member and adding no open key-value map | TDR-0027 permits exactly this kind of declared addition with its own bound and test; a machine-readable list beats a comma-joined sentence inside a bounded summary, and the bound plus the never-truncated rule keep the member inside the contract the delivered detail already follows | 2026-11-15 |
| DEC-9 | The durable `merge.gate-verification` record, its schema, its closed gate-record key set, its gate-set identity, and the capsule `gate.outcome` payload are **unchanged**; breadth is report data only | The record's closed key set is validated on read and as the post-append equality check, and `merge` consumes it; adding fields would change pinned record bytes and the merge consumer for no gain, because breadth is a claim about the local run, which the report already carries. Version-safe by construction: no consumer re-learns anything | 2026-11-15 |
| DEC-10 | The CI gate is untouched: its expected job set, its reasons, its counts, names, sources, and verdict conditions do not change, and no map `job` is added to the expected set; the mirror corroboration is a breadth-side check over the same single workflow read | Breadth and CI-green are different claims: the map says which job carries which breadth, the CI gate says which jobs must report. Merging them would change a delivered closed reason set and make a suite declaration able to fail a gate it does not own; reusing the one read keeps the budget at zero additional reads | 2026-11-15 |
| DEC-11 | The map is resolved from the project configuration document supplied through the same composition seam as the declared gate set (`readSuiteMap`, defaulting to undeclared); where the composition supplies no configuration, breadth is undeclared and the delivered behaviour stands | Matches the delivered injection posture (`readGateSet` is an injected seam with a shipped default) and keeps the runtime-neutral tiers: the resolver is pure and adds no second read; an undeclared map must not be confused with an empty one, so absence is explicit rather than defaulted | 2026-11-15 |
| DEC-12 | Parity is a hard guarantee: an undeclared map produces the delivered report, human text, summary, appended record, and exits byte-for-byte, and no breadth resolution is attempted | The policy is opt-in policy data in the delivered `merge.gates` tradition; a hard parity path is what allows the change to land without touching any existing consumer or fixture expectation | 2026-11-15 |
| DEC-13 | Delivery conventions: full eleven-phase lifecycle, one commit per plan phase through the commit primitive, conventional subjects scoped `GH-300`, quality gates with the recorded gate environment, PR to `main-tools` staying open | pm-notes binding conventions for this change | 2026-11-15 |
| DEC-14 | The two map-side refusals (`unmirrored`, `uncorroborated`) reuse the delivered `config.value.invalid` identity **and its delivered projection posture**: the command-supplied summary and hint are suppressed for a `config`-shaped failure, so the envelope carries the table's own summary and hint, and the specific cause (the local breadth or the mirror job) is named in the command's identifier-only human diagnostic. No `detail` member and no new row are added for these refusals | The delivered projection deliberately treats config-shaped prose as untrusted, and reversing that would widen a security-relevant rule for a diagnostic convenience; a declaration contradiction is fixed by editing the configuration, which the delivered `config.value.invalid` hint already directs, while the human line still names the drift so the repair is a one-line edit | 2026-11-15 |

Test-plan impact of DEC-1..DEC-14: DEC-1 by the hermeticity and no-execution assertions; DEC-2 and DEC-3 by the map-validation and mirror-resolution cases; DEC-4 by the report-field presence/pairing cases on both report types; DEC-5 by the four-outcome totality matrix; DEC-6 by the refusal identity, precedence, and summary-shape cases; DEC-7 by the no-append assertions around the refusal; DEC-8 by the envelope detail case; DEC-9 and DEC-10 by the delivered-record and CI-gate parity cases; DEC-11 and DEC-12 by the composition and parity cases; DEC-14 by the config-refusal projection case (envelope summary is the table's own, cause named in the human diagnostic). No test-case identifiers are fixed here; the test plan owns them.

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Verify-gates report vocabulary | Extended additively — two optional report-root fields on both report types; gate records, citations, summary, `overall`, and human output unchanged |
| Verify-gates evaluation | Extended — one pure breadth resolution over the declared map and the workflow facts, one narrowed refusal path, one no-append path |
| Verify-gates command handler | Extended — map resolution before the reads, refusal before the verdict projection, the error-envelope evidence member, and the skipped append on refusal |
| Configuration layer and catalog | Extended — one new `verify` branch with one key (`verify.suite-map`), default absent, `config.value.invalid` refusals |
| Error table and result contract | Extended by exactly one row and one optional `detail` member; no domain kind, no reworded row |
| CLI composition / gates runtime seam | Extended — one injected map read function on the existing configuration seam; read counts unchanged |
| CLI outcome projection (envelope) | Extended — the declared failure-`detail` member is honoured beside `holder` with its own validation, so a malformed or over-bound value is never projected; the config-shaped summary/hint suppression is untouched |
| MCP `gate-report` mirror | Inherits the additive report fields and the new error identity through the shared engine; input schema and tool set unchanged |
| Gate-verification record and capsule event | **Unchanged** — same shape, schema, derivation, and append counting, minus the append on a narrowed refusal |
| CI workflow read | **Unchanged** — same path, bound, outcome vocabulary, and job-name extraction |
| Change artifacts and planning corpus | Change folder artifacts as produced; backlog M2-S7 progress marker and status snapshot maintained at delivery |
| Current-truth feature specs | Reconciled in phase 7 — verify gates, result contract, config layer, MCP surface, policy-as-code register, and the lifecycle/DoD guide sentences enumerated in §24 |

## 17. ACCEPTANCE CRITERIA

**Declared suite-to-job map (F-1)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a configuration declaring `verify.suite-map` with `schemaVersion: "delivery.verify.suite-map.v1"`, one `jobs[]` entry whose `suites` equals `local`, and every identifier inside the grammar and caps, **when** `verify gates <ref>` runs, **then** the declaration resolves with no refusal, the resolved map carries the declared job and both suite sets, and no read is performed to resolve it | F-1, DM-1, NFR-4 |
| AC-F1-2 | **Given** a map that is missing `schemaVersion` or carries an unsupported one, carries an undeclared or missing top-level key, has a non-list or empty `jobs`/`local`, exceeds 64 jobs / 32 suites per job / 32 breadth identifiers, has an entry with an undeclared or missing key, has an empty or over-120-character `job`, repeats a `job`, has an empty `suites`, or carries an identifier violating `^[a-z][a-z0-9-]*$`, exceeding 64 characters, or duplicated within a list, **when** `verify gates` runs, **then** the outcome is `config.value.invalid` at exit `1` with no `data` and no read of the ledger, repository, workflow, or any provider source | F-1, DM-1, DM-3, NFR-4 |
| AC-F1-3 | **Given** a `job` value that differs from the read job-name set only by case, by a surrounding space, or by punctuation, **when** the breadth is corroborated, **then** the match is exact and the value is treated as absent from the set (the `config.value.invalid` uncorroborated path), no case folding, trimming, or fuzzy matching is applied, and `mirrorsJob` is only ever a string the CI gate itself would expect for that job | F-1, F-4, DM-1, DM-4 |

**Breadth citation (F-2)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** a change whose declared map resolves to equality and whose five gates all pass, **when** `verify gates <ref> --json` runs, **then** the exit is `0`, `data.overall` is `pass`, `data.suiteBreadth` equals the mirror job's declared `suites` in declared order, `data.mirrorsJob` is that job's non-empty declared name, the five gate records are byte-identical to the pre-change report, `data.summary` is unchanged, and the human report is the delivered six lines with no added line (scenario seed SC-M2-S7-01 inherited by name) | F-2, F-5, DM-2, NFR-8 |
| AC-F2-2 | **Given** a member-declaring change whose plan resolves through the cross-repository path and whose breadth resolves to equality, **when** the report is read, **then** `data.suiteBreadth` and `data.mirrorsJob` are present with the same values as a member-less report for the same declaration, `data.definitionOfDone`, `data.blockingMembers[]`, `data.reviewFlow`, and every `member`-bearing gate record are unchanged, and the two fields are member-independent | F-2, DM-2, NFR-8 |
| AC-F2-3 | **Given** any emitted report, **when** its root keys are inspected, **then** `suiteBreadth` and `mirrorsJob` are either both present or both absent, `suiteBreadth` is non-empty, unique, at most 32 identifiers of at most 64 characters, and `mirrorsJob` is 1..120 characters — never an empty string, never a union of several jobs, never the local declaration when it differs from the mirror's set | F-2, DM-2, DM-3 |

**Narrowed-scope refusal (F-3)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a declared map whose `local` is a strict subset of the first covering job's `suites`, **when** `verify gates <ref>` runs, **then** it exits `1` with no `data`, `error.kind` is `verify`, `error.code` is `verify.narrowed-scope`, `error.category` is `user`, `error.retryable` is `false`, `error.consequence` is `not_landed`, `detail.suiteBreadth` carries the complete `local` declaration in declared order, and the failure `summary` header names `scope=narrowed`, the mirror job, and up to eight suite identifiers of the mirror's breadth plus `omitted=<n>` (scenario seed SC-M2-S7-02 inherited by name) | F-3, DM-5, DM-6, NFR-6 |
| AC-F3-2 | **Given** a narrowed refusal, **when** the change's gate-verification history is read back through the delivered state contract, **then** no record was appended for that run, the newest record is whichever record existed before it, the read is not `torn`, and no capsule `gate.outcome` event was appended for the refused run | F-3, DM-7, NFR-5 |
| AC-F3-3 | **Given** a narrowed declaration and a battery in which one gate fails, **when** `verify gates` runs, **then** the error code is `verify.narrowed-scope` (the refusal takes precedence), the failure `summary` still carries the delivered header plus exactly one line per gate with that gate's verdict and reason visible, and the exit is `1` | F-3, DM-5 |
| AC-F3-4 | **Given** a narrowed declaration and a provider read that would make a gate `unknown`, **when** `verify gates` runs, **then** the error code is `verify.narrowed-scope` at exit `1` rather than the classified-unknown reuse or `verify.gates.unavailable`, and the summary still carries every gate's evidence | F-3, DM-5 |
| AC-F3-5 | **Given** a map whose `local` declaration contains more than eight identifiers, **when** the refusal is rendered, **then** `detail.suiteBreadth` carries every identifier (never truncated) while the summary header names at most eight followed by an `omitted` count, and the summary stays within six lines and 4096 bytes | F-3, DM-3, DM-6, NFR-2 |

**Total resolution and no false pass (F-4)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a declared map and a CI workflow that is absent, unreadable, empty, duplicate, or over-cap, **when** `verify gates` runs, **then** the outcome is the delivered `ci-expected-jobs-invalid` CI failure and the delivered `verify.gates.failed` envelope at exit `1` with no `data`, no breadth field anywhere in the output, and no pass on any path | F-4, DM-4, NFR-6 |
| AC-F4-2 | **Given** a validly read workflow job-name set that does not contain the resolved mirror job, **when** `verify gates` runs, **then** the outcome is `config.value.invalid` at exit `1` with no `data`, the envelope carries the table's own summary and hint (a command-supplied config summary stays suppressed as delivered), the mirror job is named in the command's identifier-only human diagnostic, and no report is emitted | F-4, DM-4, DEC-14, NFR-6 |
| AC-F4-3 | **Given** a `local` set covered by no single declared job — including a local set that is a strict superset of every job's set and one disjoint from all of them, **when** `verify gates` runs, **then** the outcome is `config.value.invalid` at exit `1` with no `data`, the local breadth is named in the command's identifier-only human diagnostic, and no report is emitted (wider-than-CI breadth is refused, never reported) | F-4, DM-4, DEC-14, NFR-6 |
| AC-F4-4 | **Given** two declared jobs whose `suites` sets both equal `local`, **when** the map resolves and the report is emitted twice over unchanged facts, **then** `mirrorsJob` is the first such job in declared order both times and the two reports are byte-identical | F-4, DM-3, DM-4, NFR-2 |

**Delivered-surface preservation (F-5)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** a configuration declaring no `verify.suite-map`, **when** `verify gates <ref>` (and `--json`) runs over the delivered fixture corpus for every verdict, reason, exit, and failure envelope, **then** the report, human text, failure summary, and exits are byte-identical to the pre-change behaviour and neither `suiteBreadth` nor `mirrorsJob` appears anywhere | F-5, DM-2, NFR-8 |
| AC-F5-2 | **Given** a declared map and a passing battery, **when** the verification record is appended, **then** it is exactly one `merge.gate-verification` record whose schema, `changeRef`, `headSha`, `verifiedAt`, `gateSet`, `gates[]` key set, and `trackerPosture` are the delivered shape with no breadth key, and reading the history back is not `torn` | F-5, DM-7, NFR-5 |
| AC-F5-3 | **Given** a declared map where one map `job` is not a workflow job, **when** the CI gate is evaluated against the same facts, **then** its expected job set, counts, names, reasons, and verdict are exactly the delivered ones — the map contributes no expected job and no citation entry | F-5, DEC-10 |
| AC-F5-4 | **Given** a declared map and a passing battery with every read instrumented, **when** the invocation completes, **then** the counted reads are exactly the delivered ones — one ledger read, one repository HEAD/branch read, one CI-workflow read, at most one open-PR page, one detail read, one check-run page, and one work-item read — with zero retries and zero pagination, the map resolution adds no read of its own, and the counts are identical with and without the declaration | F-5, NFR-4 |
| AC-F5-5 | **Given** the invocation `verify gates <ref>` with a third positional or an unknown flag, **when** it is parsed, **then** it is rejected as `fallback.invocation` before any read and no map is resolved, so the grammar is unchanged by this change | F-5, DEC-1 |

**Non-functional**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR1-1 | **Given** any outcome of this change, **when** the envelope is serialized, **then** no top-level key outside `{schemaVersion, runId, exitCode, timing, data, error, detail}` appears, `data` and `error` remain exclusive, `detail` carries no key outside `{holder, suiteBreadth}`, and no exit outside `{0,1,2}` is produced | NFR-1, DM-6 |
| AC-NFR2-1 | **Given** the declared-map corpus — equality, narrowing, unmirrored, uncorroborated, invalid map, and invalid workflow — **when** every case is evaluated twice over unchanged injected facts, **then** the two runs produce byte-identical stdout, byte-identical stderr, and identical exits, and the narrowed header's identifier list and `omitted` count are identical | NFR-2, DM-3 |
| AC-NFR5-1 | **Given** any run of this change over the corpus, **when** every write surface is observed, **then** at most one `merge.gate-verification` record is appended (only on a non-refused full evaluation), at most one non-gating capsule event is appended on the same path, no file or configuration is written, and a refused or invalid run appends nothing | NFR-5, DM-7 |
| AC-NFR3-1 | **Given** the default test suite, **when** it runs, **then** no network call, credential, or provider socket is used and every case is driven by configuration and workflow fixtures | NFR-3 |
| AC-NFR7-1 | **Given** the error table and its documented mirror, **when** the sync gate runs, **then** `verify.narrowed-scope` is present in both directions with identical category, retryability, consequence, projection class, summary, and hint, the `verify` kind carries seven identities, and no delivered row is reworded | NFR-7, DM-5 |

## 17.1 Definition of Done (change-specific)

| ID | Done condition |
|----|----------------|
| DoD-1 | The declared map resolves by one pure rule with the four declared outcomes and no fifth path |
| DoD-2 | Both report types carry `suiteBreadth`/`mirrorsJob` together on a resolved equality, and neither carries them otherwise |
| DoD-3 | The narrowed refusal exits `1` with `verify.narrowed-scope`, names the narrowed breadth in `detail.suiteBreadth` and in the summary header, and appends neither the record nor the capsule event |
| DoD-4 | Uncorroborated, unmirrored, and structurally invalid declarations never pass, and each names its cause in the human diagnostic (the config-shaped envelope keeps the table's own summary and hint) |
| DoD-5 | The five gates, the delivered report fields, the summary and human bytes, the exits, the grammar, and the read counts are unchanged, proven by parity fixtures |
| DoD-6 | The durable record and the capsule event are unchanged in shape, and the append counting is exactly one per full evaluation that is not refused |
| DoD-7 | Exactly one error-table row and one `detail` member are added, two-way synced with the documented table |
| DoD-8 | The reference declaration for this repository is present and resolves to equality, so this repository's own gate runs cite breadth instead of refusing |
| DoD-9 | The §24 documentation deltas are enumerated here and applied in phase 7 |
| DoD-10 | `pnpm check` is green with the pm-notes gate environment, the commit subjects are conventional and scoped `GH-300`, and the PR is open against `main-tools` |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Single change, no flag.** The capability is opt-in by declaration: the code ships inert for any repository without a map, and this repository adds its own declaration in the same change so its gate runs cite breadth from that point on.
- **Declaration order matters.** The reference declaration and the resolution code land together; a declaration whose `local` set does not equal the mirrored aggregate job's `suites` would make this very change refuse its own gate runs at phase 9/10, so the declaration is verified by running the gates before the PR opens.
- **No data migration and no backfill.** No store, record, or configuration value is migrated; existing records stay readable and `merge`'s freshness semantics are untouched.
- **Rollback is a declaration change.** Removing the `verify.suite-map` key restores the delivered behaviour exactly (DEC-12), with no code rollback required to unblock a repository.
- **Communication.** The refusal is user-category at exit `1`, so it surfaces in the delivered failure rendering with its hint; phase 7 documents the fields and the row so a reader of the report can interpret them without reading this specification.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no durable record, schema, or store changes, and no seed data is required. The reference configuration declaration is authored content, not a migration; an undeclared map is the pre-change state and remains valid.

## 20. PRIVACY / COMPLIANCE REVIEW

- **No personal data.** The declaration carries suite identifiers and CI job names only; the report and the failure detail carry the same identifiers. No comment bodies, titles, file contents, diffs, credentials, or paths are added to any output.
- **Committed configuration is the declaration home.** The map is policy data in the project configuration document, in the same posture as `merge.gates`; it carries no secret and no machine-specific path, so the delivered configuration-layer prohibitions (secrets, machine paths) continue to apply unchanged.
- **No new retention or audit surface.** Nothing new is retained: the record and capsule shapes are unchanged, and the refused run retains nothing.
- **Failure output stays identifiers-only.** `detail.suiteBreadth` is a bounded identifier list and the summary keeps its delivered bounded, non-payload form.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new read surface and no new write surface.** Breadth comes from a configuration node and the delivered workflow read; the refusal removes a write rather than adding one. No credential, network, process-spawn, or filesystem-write capability is added.
- **Configuration trust.** A narrowed or false declaration is policy data under review; the refusal cannot be waived in this change (no override path), so a repository cannot silently opt out while still citing a CI job.
- **Fail-closed by construction.** Every unresolvable state ends in a refusal or a delivered failure; there is no path where an uncorroborated breadth yields a report, which closes the "narrow run looks green" attack the story names.
- **Denial of the ledger write is deliberate.** A narrowed run cannot create fresh verification evidence, so a downstream consumer cannot be tricked into landing on a narrow-scope verification; staleness handling stays the merge surface's delivered job.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **One new maintenance obligation:** the map is updated when a local step is added or removed, or when a CI job is renamed. Drift is refused in both directions rather than ignored (RSK-2).
- **Failure diagnosis is bounded and named:** a refusal names either the mirror job, the local breadth, or the structural defect, so repair is a one-line configuration edit and a re-run.
- **No new runtime dependency, daemon, or scheduled job;** no change to `pnpm check`, to the workflow, or to any CI job.
- **Documentation maintenance** rides the two-way gates that already exist (documented error table sync, doc-distribution guard, prompt/help conformance).
- **Operational visibility:** the report's two fields and the refusal are the only observable additions; no dashboard, metric, or alert changes.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Suite | A named unit of local verification a repository declares (for example a test suite, lint, format, typecheck, or a repository invariant scan). Identified by a repository-scoped suite id. |
| Suite id | The declared identifier of a suite: `^[a-z][a-z0-9-]*$`, 1..64 characters, unique inside one declared list. |
| Suite breadth | A set of suite ids: what a run covers. |
| Local breadth | The `local` set declared in `verify.suite-map`: the suites the local gate claims to evaluate. |
| CI job breadth | The `suites` list a declared `jobs[]` entry attributes to one CI job. |
| Mirror job | The CI job whose declared breadth equals the local breadth. Reported as `data.mirrorsJob`. |
| Mirrored CI breadth | The mirror job's declared `suites`, reported as `data.suiteBreadth`. |
| Narrowed scope | A declared local breadth that is a strict subset of the mirror job's breadth; refused with `verify.narrowed-scope`. |
| Unmirrored breadth | A declared local breadth that no single declared job covers; refused as `config.value.invalid`. |
| Uncorroborated breadth | A resolved mirror job that the read CI-workflow job-name set does not contain; refused as `config.value.invalid`. |
| Suite map | The `verify.suite-map` declaration: schema version, `jobs[]` (job to suites), and `local`. |

## 24. APPENDICES

### Appendix A — Pinned literals register

Every literal a downstream plan or test author must use without re-deciding:

| # | Literal | Value | Where |
|---|---------|-------|-------|
| 1 | Configuration key | `verify.suite-map`; schema `delivery.verify.suite-map.v1`; default absent | DEC-2, DM-1 |
| 2 | Map fields | exactly `schemaVersion`, `jobs[]` (`job`, `suites`), `local`; extra keys refused | DM-1 |
| 3 | Suite id | `^[a-z][a-z0-9-]*$`, 1..`VERIFY_SUITE_MAX_ID_CHARS` (64), unique per list | DM-1, DM-3 |
| 4 | Caps | `VERIFY_SUITE_MAP_MAX_JOBS` 64; `VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB` 32; `VERIFY_SUITE_MAX_BREADTH` 32; job name ≤ `VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS` (120) | DM-3 |
| 5 | Report fields | `data.suiteBreadth` (mirror job's `suites`, declared order) and `data.mirrorsJob` (mirror job's name), present together or absent together, on both report types | DEC-4, DM-2 |
| 6 | Resolution rule | exact set match → equality (first in declared order); else first strict-superset job → narrowing; else unmirrored; mirror must appear in the read job-name set → else uncorroborated | DEC-3, DEC-5, DM-4 |
| 7 | Refusal identity | `verify.narrowed-scope`, kind `verify`, category `user`, non-retryable, `not_landed`, `user-validation`, exit `1`, no `data` | DEC-6, DM-5 |
| 8 | Narrowed evidence | `detail.suiteBreadth` = complete `local` list, never truncated (≤32 × ≤64 chars) | DEC-8, DM-6 |
| 9 | Narrowed summary header | `scope=narrowed mirror=<job>` plus up to `VERIFY_GATES_MAX_CITATION_NAMES` (8) identifiers and `omitted=<n>`; summary keeps ≤6 lines / ≤4096 bytes | DEC-6, DM-3 |
| 10 | Precedence | narrowed refusal precedes `verify.gates.failed`, the classified-unknown reuse, and `verify.gates.unavailable`; grammar, gate-set, map, and corroboration failures keep their delivered identities, and an append failure can only occur on a non-refused run | DEC-6 |
| 11 | Append rule | 1 `merge.gate-verification` per full evaluation that is not refused; 0 on a narrowed refusal; 0 capsule `gate.outcome` on a narrowed refusal | DEC-7, DEC-9 |
| 12 | Configuration refusals | every map defect is `config.value.invalid` at exit `1`, raised before any read, no `data` | DEC-2 |
| 13 | Unmirrored / uncorroborated | `config.value.invalid` at exit `1`, no `data`, envelope summary and hint from the table (config-shaped prose suppressed as delivered), cause named in the command's identifier-only human diagnostic | DEC-5, DEC-14 |
| 14 | Invalid workflow read | delivered `ci-expected-jobs-invalid` → `verify.gates.failed`, exit `1`, no `data`, no breadth | DEC-5, DEC-10 |
| 15 | Unchanged surfaces | gate ids/order/verdicts/reasons/citations/summary/human text; record shape and schema; capsule payload; grammar; read counts | DEC-9, DEC-10, DEC-12 |
| 16 | Error-table delta | `verify` kind 6 → 7 identities; `verify gates` rows 2 → 3; no new domain kind | DM-5, NFR-7 |
| 17 | `detail` delta | `{ holder?: string }` → `{ holder?: string; suiteBreadth?: readonly string[] }` | DEC-8, DM-6 |
| 18 | Deferred scope | per-invocation breadth, step-derived CI breadth, merge-time breadth enforcement, per-member breadth | §7.3, OQ-1..OQ-3 |

### Appendix B — Ticket acceptance criteria mapping

| Ticket criterion (M2-S7) | Spec criteria | Scenario seed |
|---|---|---|
| Goal — "Local gates must cite the same suite breadth as CI" | AC-F2-1 (report cites breadth and mirror job), AC-F2-2 (cross-repository coherence), AC-F2-3 (field shape), AC-F1-1/AC-F1-2/AC-F1-3 (declaration and closed resolution), AC-F4-4 (determinism) | SC-M2-S7-01 |
| AC — "a narrower local suite cannot masquerade as full green" | AC-F3-1 (refusal identity and named breadth), AC-F3-2 (no fresh record), AC-F3-3/AC-F3-4 (precedence with gate evidence retained), AC-F3-5 (naming within the bounds), AC-F4-1..AC-F4-3 (no false pass on any unresolved state) | SC-M2-S7-02 |
| Invariants the two criteria depend on | AC-F5-1..AC-F5-5 (delivered surfaces, ledger, CI gate, read budget, grammar), AC-NFR1-1, AC-NFR2-1, AC-NFR3-1, AC-NFR5-1, AC-NFR7-1 | — |

Both ticket criteria map to at least one criterion; the remaining criteria enforce the invariants they rest on.

### Appendix C — Constraint register (carried into plan and test authoring)

- C-1: Breadth is declared, not executed — no suite, workflow step, or child process is ever run (NG-2, DEC-1).
- C-2: Two declared sides, one comparison — a single-sided declaration cannot produce a check (DEC-1, DEC-2).
- C-3: A report exists only on an equality; every other outcome is a refusal or the delivered failure (DEC-5, NFR-6).
- C-4: `suiteBreadth` is the mirrored CI breadth, never the local declaration and never a union (DEC-4).
- C-5: A narrowed refusal appends nothing — no record, no capsule event (DEC-7).
- C-6: Exactly one new error row and one new `detail` member; no new domain kind, no reworded row (NFR-7, DEC-8).
- C-7: Zero additional reads; the map is a node of the configuration read and corroboration reuses the workflow read (NFR-4, DEC-10).
- C-8: The record, the CI gate, the five gates, the grammar, and the human output do not move (DEC-9, DEC-10, DEC-12).
- C-9: Default tests are configuration- and workflow-fixture driven, with zero live calls (NFR-3).
- C-10: Current-truth specifications flip in phase 7 only, per the delta list below (NG-5, DoD-9).
- C-11: Gates and commit hygiene per pm-notes: `pnpm check` with the recorded gate environment before the PR, conventional subjects scoped `GH-300`, body/footer lines ≤100 characters, PR to `main-tools` staying open (DEC-13, NFR-9).

### Appendix D — Documentation deltas for phase 7 (exact superseded sentences)

| # | Document | Current sentence or row | Reconciliation |
|---|---|---|---|
| D-1 | `doc/spec/features/feature-verify-gates.md` §Limitations | "The CI gate detects job display-name presence only; matrix expansion, suite-to-job mapping, and job-level `if` conditions are deferred." | Retain the CI gate's job-presence wording and the matrix/`if` deferrals; strike `suite-to-job mapping` from the deferred list and state that suite breadth is declared (`verify.suite-map`), cited (`data.suiteBreadth`/`data.mirrorsJob`), and refused when narrowed, while the CI gate itself remains job-presence only |
| D-2 | same, §Overview | "It appends exactly one fenced gate-verification record per full battery evaluation and nothing else." | "… per full battery evaluation **that is not refused for narrowed suite breadth**; a refused run appends neither the record nor the capsule event." |
| D-3 | same, §Gate rules | "The expected job set is read from `.github/workflows/ci.yml` at the edge, using each job's display `name` and falling back to the job id; … The repository declares 23 jobs across the bash and TypeScript pipelines." | Add that the same single read also corroborates the declared mirror job's presence for the breadth citation, and that the declared suite map adds no expected job and no CI-gate condition |
| D-4 | same, §Error rows table | two `verify gates` rows (`verify.gates.failed`, `verify.gates.unavailable`) and "Both rows are additive members of the existing `verify` kind" | Three rows; add the `verify.narrowed-scope` row with its category, retryability, consequence, projection class, exit, and trigger; reword the sentence to "The three `verify gates` rows …" |
| D-5 | same, §Bounds and read budget | the delivered constant table and the per-source read budget | Add the six suite constants and state that the map adds no read and no retry |
| D-6 | same, report description | "The report schema is `delivery.verify-gates.v1`; the envelope schema remains `delivery.result.v1`." | Record the two additive optional report fields on both report types, present together |
| D-7 | `doc/spec/features/feature-result-contract.md` error-table capability and documented table | "The `verify` kind carries six verify subcommand identities: … `verify.gates.failed` and `verify.gates.unavailable` for `verify gates` …" | Seven identities; `verify gates` carries three; add the documented `verify.narrowed-scope` row; record the additive `detail.suiteBreadth` member beside `holder` |
| D-8 | `doc/spec/features/feature-config-layer.md` | the typed-branch catalog with `## The merge configuration branch` | Add a `## The verify configuration branch` section with the single key `verify.suite-map` (shape, default absent, refusal semantics) and add it to the consumed-by list of the configuration layer |
| D-9 | `doc/spec/features/feature-mcp-surface.md` `gate-report` row | the report description and its error identity list | Record the additive report fields and add `verify.narrowed-scope` to the mirrored identity list; the tool input schema and tool set are unchanged |
| D-10 | `doc/planning/concepts/policy-as-code.md` §C | the row `Local gate breadth must equal CI breadth` mapped to `Suite-to-job mapping (M2-S7)` | Move the rule into §B as an enforced check ("Suite-breadth citation and narrowed-scope refusal in the gate battery") and adjust the §"Story mapping" line for M2-S7 |
| D-11 | `doc/guides/change-lifecycle.md` finalization bullet and `doc/guides/definition-of-done.md` | "`verify gates <ref>` evaluates the config-declared merge battery … and records the verification" / "`verify gates <ref>` supplies the recorded merge-battery evidence" | Add that a reported run cites its suite breadth and mirrored CI job, and that a narrowed run refuses at exit `1` and records no fresh verification |
| D-12 | `doc/overview/glossary.md` | — | Add the glossary terms from §23 (suite, suite breadth, local breadth, CI job breadth, mirror job, narrowed scope) |
| D-13 | `doc/planning/oss-tooling/backlog.md` and the planning status snapshot | M2-S7 story without a progress marker | Add the delivery progress marker naming this change and the delivered surfaces |

No other current-truth sentence changes: the gate order, verdict vocabulary, reason codes, citation shape, exits, invocation grammar, record schema, and capsule payload statements stand as delivered.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | spec-writer (deepseek-flash) | Initial specification from GitHub issue #300 (M2-S7), backlog story M2-S7, the M2 milestone pack (`test-scenarios.md` SC-M2-S7-01/SC-M2-S7-02 inherited by name; `README.md` M2-S7 row and its `none in this pack` convention), `policy-as-code.md` (the "local gate breadth must equal CI breadth" rule), and current truth (verify gates v1 and the GH-310 report types, the `merge.gates` declaration posture, the configuration layer, the result contract and TDR-0027 detail member, and the delivered workflow job-name read). Open literals pinned as DEC-1..DEC-14; three residual questions recorded as OQ-1..OQ-3; 25 acceptance criteria, 7 data-model rows, 9 risks |

---

## AUTHORING GUIDELINES

Sources: GitHub issue #300 "M2-S7: Suite-to-job mapping in gates (M2)" (owner-authored; the goal and AC quoted through Appendix B); backlog story M2-S7 (goal, task, AC, dependency M0-S9) and the M2 milestone pack — `milestones/m2/test-scenarios.md` SC-M2-S7-01 (report cites the CI job's suite breadth and names the mirrored job; `data.suiteBreadth` equals the CI job breadth; `data.mirrorsJob` non-empty) and SC-M2-S7-02 (a narrowed local breadth states the narrowed breadth and refuses full green; exit `1` with `error.code == "verify.narrowed-scope"`), inherited by name and never restated as new assertions — plus `milestones/m2/README.md` (the M2-S7 row: `none in this pack` for the architecture flow and the contract surface, because the story owns a surface outside this pack) and `policy-as-code.md` (the prose rule this change turns into a check); current truth — `feature-verify-gates.md` (battery, citations, exits, the workflow job-name read, the config-declared gate set, the read budget, the append rule, and the deferral this change narrows), `feature-merge-verify-deploy.md` and `packages/core/src/contracts/merge.ts` (the `merge.gates` declaration posture and the closed `merge.gate-verification` record), `feature-config-layer.md` (typed configuration branches and per-key defaults), `feature-result-contract.md` and `packages/core/src/contracts/result.ts` (envelope, error table, the TDR-0027 `detail` member rule, the `{0,1,2}` projection), `feature-mcp-surface.md` (the mirrored `gate-report` surface); and `chg-GH-300-pm-notes.yaml` (scope decision, the delegation of the mechanism to this spec as a DEC entry with rejected options, the documentation impacts, the gate environment, and the delivery conventions).

Every literal the planning surface left open is pinned rather than deferred: the mechanism and its rejected alternatives (DEC-1), the declaration shape and caps (DEC-2), the mirror resolution rule (DEC-3), the report-level placement of the two fields (DEC-4), the complete equality/refusal semantics including wider-than-CI breadth (DEC-5), the refusal identity, projection, and precedence (DEC-6), the no-append rule (DEC-7), the envelope evidence member (DEC-8), the unchanged durable record (DEC-9), the untouched CI gate and zero additional reads (DEC-10), the injected map seam (DEC-11), parity (DEC-12), delivery conventions (DEC-13), and the config-refusal projection posture (DEC-14). The residual points — per-invocation breadth (OQ-1), step-derived CI breadth (OQ-2), and merge-time breadth enforcement (OQ-3) — are declared as deferrals, are named by no acceptance criterion, and do not block delivery.

## VALIDATION CHECKLIST

- [x] Front matter declares `change.ref` = `GH-300`, one owner, `status: Proposed`, and the tracker milestone title verbatim
- [x] Sections appear in the template's exact order, with all 25 numbered sections and the three trailing sections
- [x] Feature ids (`F-1`..`F-5`), data-model ids (`DM-1`..`DM-7`), decision ids (`DEC-1`..`DEC-14`), risk ids (`RSK-1`..`RSK-9`), question ids (`OQ-1`..`OQ-3`), and acceptance ids are unique within their category
- [x] Every acceptance criterion is Given/When/Then form and links at least one `F-`/`DM-`/`NFR-`/`DEC-` id
- [x] NFRs carry numeric thresholds (caps, read counts, byte and line bounds, zero-occurrence guarantees)
- [x] Risks carry impact, probability, mitigation, and residual risk
- [x] Every changed delivered literal is stated with its exact current value and its exact new value (§8.3 enumerated table)
- [x] The mechanism decision names the chosen option and each rejected option with its reason (DEC-1)
- [x] No implementation task or code-level instruction appears in the change scope; documents are named only as phase-7 reconciliation targets or as provenance of current truth
