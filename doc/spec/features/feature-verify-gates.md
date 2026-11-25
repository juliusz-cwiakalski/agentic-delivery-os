---
ados_distribution: internal
id: SPEC-VERIFY-GATES
status: Current
created: 2026-10-31
last_updated: 2026-11-25
owners: ["engineering"]
service: delivery-os
summary: "The verify gates surface: the config-declared merge battery (default five built-ins in shipped order), cited pass/fail/unknown verdicts, structured VerifyLedgerEvaluation consumption, deterministic open-PR resolution, read-specific 404 absence, shared status vocabulary, bounded deterministic output, the shipped run's fenced, post-append-verified persistence of the EVT-1 gate-verification record with byte-identical verdicts and the full-declared-sequence gate-set identity that binds its consumption, the delivered-shape projection of that record's member gates (`member` dropped, order and count preserved) so the ledger reads back non-`torn`, the non-gating capsule `gate.outcome` append with a bounded disclosure, the three verify gates rows (`verify.gates.failed`, `verify.gates.unavailable`, and the narrowed-scope refusal with its `detail.suiteBreadth` evidence member), the additive `data.suiteBreadth`/`data.mirrorsJob` suite-breadth fields on both report types, the suite-map declaration's fail-closed document posture, its four-outcome breadth resolution, and its two map-side refusals with their one bounded `cause:` line, and the additive cross-repository report type: one shared definition of done over the declared member set with per-(member, gate) records, per-member CI corroboration and member verdicts, landing-ordered evidence, an untruncated blocking-member list, one review flow with a stable run identity, and the data-bearing negative report at exit 1 while the delivered member-less report keeps its literal overall and exits."
links:
  related_changes: ["GH-178", "GH-225", "GH-240", "GH-310", "GH-300", "GH-338", "GH-388", "GH-386", "GH-404"]
  related_decisions: ["ADR-0003", "ADR-0006", "TDR-0005", "TDR-0032"]
  contracts:
    - "packages/core/src/contracts/verify-gates.ts"
    - "packages/core/src/domain/verify-gates-members.ts"
    - "packages/core/src/domain/verify-gates-suite-map.ts"
    - "packages/core/src/domain/review-flow.ts"
---

# Feature: Verify Gates

## Overview

`verify gates <changeRef>` is the M0 merge battery. It evaluates the effective
declared battery — by default the five built-in gates in shipped order:
`lifecycle-finalization`, `ci-green`, `push-parity`, `owner-gate`, and
`squash-preflight` — and returns one cited verdict (`pass`, `fail`, or
`unknown`) per gate. A declared `battery` or `both` entry is evaluated and
cited exactly like a built-in, and a `merge`-only entry never appears on the
battery. The overall result is `pass` only when every evaluated gate passes;
any `fail` is definitive; `unknown` is never a pass. The battery is evaluated
without short-circuit, so every report is complete. Its local reads are the
invoking working tree's — the change's pm-notes and that checkout's HEAD — so
under a worktree lane the battery is run from the lane's worktree, not from the
main checkout ([Dispatch Engine](feature-dispatch-engine.md#lane-worktrees)).

The command performs no merge, auto-merge, or provider mutation. It performs bounded local reads (ledger, repository HEAD/branch, CI workflow,
and the project-committed configuration document) and at most one bounded page
or item per provider source: one open-PR page, one matched detail read, one
check-run page, and one work-item read. Those provider reads travel through the injected transport, which the production composition may supply as the GitHub CLI transport, so the command itself spawns no process of its own. One bounded configuration-document
resolution attempt is the only added access: at most one stat-class existence
probe and at most one bounded content read, with no content read when the
document is absent, performed with or without a declaration and adding no read of
any other configuration layer. It appends exactly one fenced gate-verification
record per full battery evaluation that is not refused for narrowed suite
breadth; a refused run appends neither the record nor the capsule event. The
shipped production composition supplies the delivered fenced,
post-append-verified merge-ledger append as the runtime's append seam, so a
shipped `verify gates` run persists exactly one gate-verification record per
full battery evaluation that is not refused for narrowed suite breadth. The
append is silent — no human line, no machine field, and no exit-code change —
and adds no provider or configuration read. The
report schema is `delivery.verify-gates.v1`; the envelope schema remains
`delivery.result.v1`. Both emitted report types carry two additive
optional root fields, present together or absent together: `suiteBreadth` (the
mirrored CI job's declared `suites`, in declared order) and `mirrorsJob` (that
job's declared name). They are absent when no `verify.suite-map` is declared and
on every non-report outcome; `suiteBreadth` is the CI job breadth, never the
local declaration and never a union.

When the composing surface supplies the member runtime, a change whose plan
declares `members[]` reports one shared definition of done over the declared
member set: a distinct additive report type
(`CrossRepositoryVerifyGatesReport`) carrying the same required report fields
plus `overall: pass|fail`, `definitionOfDone`, `blockingMembers[]`, and
`reviewFlow`. It reports one gate record per declared (member, gate) pair, a
per-member CI reading taken on that member's own pushed head, and a mechanical
member verdict over both; the report is data-bearing on every status and a
negative verdict is exit `1`. The delivered `VerifyGatesReport` — its literal
`overall: "pass"`, its member-less record shape, its failure envelope, and its
exits — is unchanged, and a change whose plan declares no members produces that
report byte-identically.

The durable ledger keeps its delivered record shape independently of that report:
the one appended gate-verification record carries every member gate projected to
the delivered `{id, verdict, reason, citation}` set with the `member`
discriminator dropped, while `member` stays on every report record.

## Command surface

| Invocation | Outcome |
|---|---|
| `verify gates GH-178` | Evaluate the declared battery (default five gates); a success prints the deterministic six-line human report; a failure prints the bounded gate summary. |
| `verify gates GH-178 --json` | Exactly one machine envelope on stdout; on success `data` is the full `delivery.verify-gates.v1` report, on failure there is no `data` — except a negative cross-repository report, which is data-bearing at exit `1`. |
| `verify gates` / `verify gates GH-178 extra` / unknown flag | Rejected before any read: a missing or empty ref is `input.value.rejected`; a third positional or unknown flag is `fallback.invocation`. |

`verify` is one top-level command with three subcommands, `change`, `gates`,
and `deploy`, each followed by exactly one change ref and no command-specific
flags. `verify change` stays ledger-only and network-free; `verify gates`
evaluates the declared battery; `verify deploy` reads the deploy job trace as
specified in [Merge and Verify Deploy](feature-merge-verify-deploy.md).

## Gate rules

| Gate | Passing condition |
|---|---|
| `lifecycle-finalization` | The structured `VerifyLedgerEvaluation` is `finished` for the declared full or LITE variant. |
| `ci-green` | The pushed head is resolved, the expected job set is valid, the check-run page is below the limit, at least one expected job succeeded, no run failed/canceled/is pending, and every expected job is present. |
| `push-parity` | Attached branch, exactly one matching open delivery request, full 40/64-hex SHAs, and equal local/remote SHAs. GH-386: this equality is the shared parity definition with two consumers — verify gates computes it here as a gate, and the dispatch engine's derivation arm evaluates the same comparison (local branch head against the open delivery request's head) as its `pr-open` parity precondition with a bounded fast-forward ensure-push act; two consumers, one seam, documented on both pages so future changes keep them aligned. |
| `owner-gate` | A readable work item without `hand-back` or `human-input-needed` (case-insensitive). |
| `squash-preflight` | Open, non-draft, targeting `main-tools`, `mergeable`, with positive commit and changed-file counts. |

`lifecycle-finalization` is `pass` on `finished`, `fail`
`lifecycle-incomplete` on `partial` or a terminal document failure, and
`unknown` `lifecycle-unverifiable` when the registry evidence is untrustworthy;
missing phases are cited in required-set order. Each gate's reason comes from
its closed reason set; no free-form reason enters a citation.

A red pipeline, a missing expected job, a zero-run or all-skipped page, a
stale local head, an owner-attention label, a wrong base, a draft/closed PR,
unknown mergeability, or an empty change surface never passes. Mergeability is
never assumed: only `mergeableState: "mergeable"` passes; `conflicting`,
`not-mergeable`, and `unknown` fail with their distinct reasons.

The expected job set is read from `.github/workflows/ci.yml` at the edge,
using each job's display `name` and falling back to the job id; an absent,
unreadable, empty, duplicate, or over-cap set is `ci-expected-jobs-invalid`,
never green. The repository declares 23 jobs across the bash and TypeScript
pipelines. The same single workflow read also corroborates the declared mirror
job's presence for the suite-breadth citation: a resolved mirror that the read
job-name set does not contain, by exact string match, is a `config.value.invalid`
refusal. The declared suite map adds no expected job and no CI-gate condition,
so the CI gate's expected set, reasons, counts, names, and verdict are unchanged
by the map.

## Target resolution

Push parity and squash preflight share one deterministic open-PR rule. A
detached HEAD is `branch-unresolved` without a PR read. A raw page at
`VERIFY_GATES_OPEN_PR_LIMIT` (100) is `ambiguous-open-pr` even when it contains
a match. Exactly one `sourceRef === branch` match resolves the target; multiple
matches are ambiguous; zero open requests is `no-open-pr`; zero matches among
open requests is `branch-mismatch`.

## Read-specific absence

HTTP 404 surfaces as the adapter-local `provider.not-found` read result. An
absent open-PR list is `no-open-pr` for push parity and squash preflight; for
CI, which still needs the resolved detail, it is `head-unresolved`. A matched
PR detail 404 is `head-unresolved` with source outcome `absent` for CI,
parity, and squash; a work-item 404 is `ticket-unresolved`/`absent`; a
check-run 404 is source `absent` with gate `unknown` `read-failed`, never
`failed` and never `ci-no-runs`.

## Citations, output, and exits

Every gate carries ordered sources/outcomes, identity, contract-declared
counts, bounded name lists, and closed reasons. The failure summary is one
header plus exactly one line per gate; each line always carries `counts=` and
`names=` (rendering `-` when empty). Human success is six deterministic lines:
a header plus one line per gate.

A success exits `0`; any definitive gate failure reuses `verify.gates.failed`
(exit `1`); an unclassified unknown uses `verify.gates.unavailable` (exit `2`).
A classified unknown reuses the first unknown gate's error-table identity and
its projection, for example `config.credential.missing` (exit `1`) or
`state.store.torn` (exit `2`). A negative cross-repository report is the third
shape: it is data-bearing at exit `1` through the `user-validation` projection
class, so the report names the blocking member and the delivered
`verify.gates.failed` classification is carried by `overall: "fail"` rather than
by an error envelope. No error-table row is added for it. A narrowed declared
breadth refuses at exit `1` with `verify.narrowed-scope` before the verdict
projection, keeps every evaluated gate's verdict and reason in the summary (one
header line only on the member-declaring path), names the local breadth in
`detail.suiteBreadth`, and appends nothing.

## Error rows

| Code | Domain kind | Category | Retryable | Consequence | Projection class | Exit | Emitted when |
|---|---|---|---|---|---|---|---|
| `verify.gates.failed` | `verify` | user | `false` | `not_landed` | `user-validation` | `1` | The overall result is `fail`. |
| `verify.gates.unavailable` | `verify` | platform | `false` | `not_landed` | `platform-provider` | `2` | The overall result is `unknown` and no first-unknown gate carries a resolvable error-table identity. |
| `verify.narrowed-scope` | `verify` | user | `false` | `not_landed` | `user-validation` | `1` | The declared local suite set is a strict subset of the mirrored CI job's declared suite set, so the run cannot report full green. |

The `verify.narrowed-scope` row is the additive member; the two delivered
`verify.gates.*` rows keep their category, retryability, consequence, and
projection class.

The three `verify gates` rows are additive members of the existing `verify` kind;
`verify.ledger.incomplete` remains the `verify change` row and is unchanged. The
cross-repository report adds no row and no domain kind: its negative verdict is
data-bearing at exit `1` and is classified by `overall: "fail"`, and its
per-member and per-gate outcomes are report data rather than error identities.

The narrowed refusal keeps the delivered summary shape (a header plus one line
per evaluated gate): the header keeps `result=`/`gates=` byte-identical and
appends `; scope=narrowed mirror=<job> breadth=<id[,id]*>[ omitted=<n>]`,
naming the mirror job's declared breadth (at most eight identifiers, then the
count of unprinted identifiers). On the member-declaring path no gate is
evaluated, so the summary is the one header line. The complete narrowed local
breadth is carried as `detail.suiteBreadth` (identifiers only, never truncated),
and the run appends neither the verification record nor the capsule event.

## Bounds and read budget

| Constant | Value | Role |
|---|---|---|
| `VERIFY_GATES_OPEN_PR_LIMIT` | 100 | One bounded open-PR page; a page at the limit is ambiguous. |
| `VERIFY_GATES_CI_RUN_LIMIT` | 100 | One bounded check-run page; a page at the limit is truncated. |
| `VERIFY_GATES_MAX_EXPECTED_JOBS` | 200 | Maximum declared expected job names. |
| `VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS` | 120 | Maximum expected job-name length. |
| `VERIFY_GATES_WORKFLOW_MAX_BYTES` | 262144 | Maximum CI-workflow file size. |
| `VERIFY_GATES_MAX_CITATION_NAMES` | 8 | Maximum values per cited name list. |
| `VERIFY_GATES_MAX_NAME_CHARS` | 120 | Maximum cited name length. |
| `VERIFY_GATES_MAX_REF_CHARS` | 120 | Maximum cited ref length. |
| `VERIFY_GATES_MAX_SUMMARY_LINES` | 6 | Maximum failure-summary lines. |
| `VERIFY_GATES_MAX_SUMMARY_BYTES` | 4096 | Maximum failure-summary bytes. |
| `VERIFY_GATES_MAX_MACHINE_BYTES` | 65536 | Maximum serialized machine report bytes. |
| `VERIFY_GATES_MAX_MEMBERS` | 8 | Maximum declared members evaluated in one cross-repository report; `blockingMembers[]` is never truncated. |
| `VERIFY_SUITE_MAP_SCHEMA_VERSION` | `delivery.verify.suite-map.v1` | The declared suite-to-job map schema. |
| `VERIFY_SUITE_MAP_CONFIG_KEY` | `verify.suite-map` | The declaration key. |
| `VERIFY_SUITE_MAP_MAX_JOBS` | 64 | Maximum declared `jobs[]` entries. |
| `VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB` | 32 | Maximum suites in one `suites` list. |
| `VERIFY_SUITE_MAX_BREADTH` | 32 | Maximum `local` identifiers and detail entries. |
| `VERIFY_SUITE_MAX_ID_CHARS` | 64 | Maximum characters in one suite identifier. |

A suite identifier matches the single declared pattern `^[a-z][a-z0-9-]*$` at
1..64 characters and is unique within one list; each `job` value is unique. The
declared `job` is a
single-line printable name of 1..120 characters — no C0 control, no DEL or C1
control, no U+2028 or U+2029 line or paragraph separator, and no Unicode `Cf`
format control — with no leading or trailing whitespace, compared by exact
string match; the job-name bound reuses
`VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS`, and the narrowed header reuses the
citation-name, summary-line, and summary-byte bounds. A declared job therefore
can never break the one-physical-line narrowed header or the one-line `cause:`
diagnostic. The map adds exactly one bounded configuration-document resolution
attempt per invocation — at most one stat-class existence probe plus at most one
bounded content read, and no content read when no document exists — and no
retry; the per-source budget below is unchanged.

The read budget is bounded per source: one local ledger read (pm-notes plus
the verified registry), one local repository HEAD/branch read, one local
CI-workflow read, at most one bounded open-PR page, one resolved detail read,
one check-run page, and one work-item read per invocation. There are no
retries and no pagination. The only write is one appended gate-verification
record per full battery evaluation that is not refused for narrowed suite
breadth; a refused run writes nothing, and the append itself adds zero
provider and zero configuration reads on every path. The map's one bounded resolution attempt
is the added access; on the single-target path a declaration that reaches the
battery reads the same seven enumerable sources as an undeclared run, a
structural declaration refuses before any gates source read, an unmirrored or
uncorroborated declaration refuses before the provider reads, and a narrowed
member-declaring declaration refuses before every member read, so those refusals
read less.

## Suite-to-job map and suite breadth

The suite-to-job map is the one declaration that states which CI job runs which
suite set and which suite set the local gate evaluates. It is the optional
`verify.suite-map` configuration branch (schema
`delivery.verify.suite-map.v1`) whose shape, default, and refusal semantics are
specified in [Configuration Layer](feature-config-layer.md); its one home is the
document occupying the project-committed configuration layer slot. One bounded
resolution attempt reads only that document. An absent document — no
`${environmentPrefix}CONFIG` selection in play and no committed document — and a
document without the node are undeclared, and the run keeps its report, human
text, exits, and appended record unchanged. A selection naming a missing or
unreadable path, an unreadable or unparseable document, and a defective node are
`config.value.invalid` at exit `1` with no `data`, raised before any gates source
read; a schema or semantic defect elsewhere in the document is not interpreted,
so it neither refuses the run nor removes a valid declaration.

Breadth resolution compares the declared `local` set with the declared `jobs[]`
sets as sets (order-insensitive) and cites them in declared order. Exactly one
outcome resolves, and only equality is reportable:

| Outcome | Condition | Result |
|---|---|---|
| Equality | The first job in declared order whose `suites` set equals `local`, and that job's declared name is in the read CI-workflow job-name set. | A report carrying `suiteBreadth` (that job's `suites` in declared order) and `mirrorsJob` (its declared name), present together on both report types. |
| Narrowing | No job's set equals `local`, and the first job whose set is a strict superset of `local` is corroborated. | The `verify.narrowed-scope` refusal at exit `1`; no report and no append. |
| Unmirrored | No single declared job's set covers `local`. | `config.value.invalid` at exit `1` with no `data`. |
| Uncorroborated | The resolved mirror is absent, by exact string match, from a validly read job-name set. | `config.value.invalid` at exit `1` with no `data`. |

When the CI-workflow read is absent, unreadable, empty, duplicate, or over-cap,
no breadth outcome exists and the delivered `ci-expected-jobs-invalid` failure
stands, citing no breadth. No breadth fact is inferred from observed check-run
names, and the map never executes a suite, a workflow step, or a child process.

Both report paths resolve the same map against the same single workflow read, so
a narrowed declaration refuses identically on each; on a member-declaring change
the decision precedes every member read and the data-bearing cross-repository
report.

### Map-side refusal diagnosis

An unmirrored or uncorroborated declaration keeps the `config.value.invalid`
row's own category, retryability, consequence, summary, remediation hint, exit
`1`, and absent `data`; `detail` stays absent. The CLI names the cause on
exactly one bounded identifier-only line after the delivered
`<binary>: config.value.invalid` line on the error stream:

| Cause | Line | Meaning |
|---|---|---|
| Uncorroborated | `cause: mirror=<job>` | The declared mirror job is not in the read CI job-name set. |
| Unmirrored | `cause: breadth=<id[,id]*>[ omitted=<n>]` | The local declaration is covered by no single job; the ids are `local` in declared order, at most eight are printed, and `omitted` counts the unprinted ones and is absent when all are printed. |

The mirror form is bounded to the job-name bound plus the fixed `cause: mirror=`
token (134 characters in total), and the breadth form to eight identifiers of
`VERIFY_SUITE_MAX_ID_CHARS` plus its delimiters and `omitted` marker (545
characters in total). No other failure writes a `cause:` line, and neither line
enters the failure envelope or an MCP tool result.

## Cross-repository report

A change whose plan declares `members[]` is evaluated over that declared member
set when the composition supplies the member reads. The command emits the union
of two report types, discriminated by the presence of `definitionOfDone`: a
report without it is the delivered `VerifyGatesReport`, and a report with it is
the additive `CrossRepositoryVerifyGatesReport`. The delivered type is never
widened — its `overall` stays the literal `"pass"` and its `gates[]` stays
`VerifyGateRecord[]` with no `member` field.

### Report fields

The cross-repository report carries `schemaVersion`
(`delivery.verify-gates.v1`), `changeRef`, `target: "gates"`,
`overall: "pass" | "fail"`, `summary`, `gates[]`, `definitionOfDone`,
`blockingMembers[]`, and `reviewFlow`. When a declared suite map resolves to
equality, the report also carries the two additive optional root fields
`suiteBreadth` and `mirrorsJob`, present together; they describe the invoking
repository's declaration and are member-independent. There is no separate
classification field and no error envelope: `overall: "fail"` is itself the
carrier of the delivered `verify.gates.failed` classification.

### Per-(member, gate) records

`gates[]` carries exactly one record per declared (member, gate) evaluation:
members in declared order, then each member's declared gate order. Each record is
a `CrossRepositoryVerifyGateRecord` — the delivered `id`, `verdict`, `reason`,
and `citation` fields plus a **required** `member` holding the member `repoKey` —
so every record is attributable to exactly one member and no record exists
without a member. `summary` counts those records: `gates` is the record count and
`passed`, `failed`, and `unknown` count records by verdict, so a fully resolved
gate set yields `summary.gates` equal to the total number of declared (member,
gate) pairs.

A declared gate identifier the effective gate set does not resolve contributes
exactly one synthetic `unknown` record and never a `pass`, shaped as `id` = the
declared identifier, `member` = the declaring `repoKey`, `verdict: "unknown"`,
`reason: "read-failed"`, and a citation of `identity: { changeRef }` only with
`sources: []`, `counts: []`, `names: []`, and `reasons: ["read-failed"]`. No
provider source, count, name list, branch, or SHA is invented or attributed to a
real read.

### Durable ledger projection

The durable gate-verification ledger keeps its delivered closed record shape, so a
cross-repository evaluation appends exactly one `MergeGateVerificationRecord`
for an evaluation that is not refused for narrowed suite breadth; a narrowed
member path appends none, so the newest record stays the previous one. Its
`gates[]` is each member gate record projected to the delivered
`{id, verdict, reason, citation}` set: the `member` discriminator is dropped and
the four delivered fields are preserved in record order and count, so the appended
gate count equals the report record count (members × declared gates) and every
projected `verdict`, `reason`, and `citation` matches the corresponding report
record. Member attribution is report data only: the report's
`CrossRepositoryVerifyGateRecord` entries keep `member`, no ledger gate record
carries one, and the delivered closed-key validation, post-append equality check,
and read tolerance are untouched — the history reads back non-`torn`. An append
offered an unprojected member record is refused by that validation
(`state.store.torn`, consequence `not_landed`), so the projection is the only
accepted shape. The appended record's remaining fields keep their delivered
derivation, including a `trackerPosture.ownerLabels` read from the change's own
work item rather than from a member's `owner-gate` record.

### Member verdicts, CI corroboration, and status

`definitionOfDone.members[]` carries exactly one entry per declared member in
declared order: `repoKey`, `gates.ci`, and `verdict`.

- `gates.ci` is the closed four-value reading on that member's own pushed head:
  `pass`, `fail`, `unavailable`, or `absent`. `unavailable` is a classified
  reading failure; `absent` means the CI truth could not be established for any
  reason — no declared pull request, no pushed head, or no run for the head.
  Neither is ever green, and one member's reading is never reused for another.
  A reading is `pass` only when the member's pushed head has at least one succeeded
  job and no failed, canceled, pending, or missing job; a zero-run page, an
  unresolvable detail read, or a non-hex head is never `pass`.
- `verdict` is the closed three-value member verdict `pass`, `fail`, or
  `unknown`, computed mechanically from both the member's own records and its CI
  reading: `pass` iff every declared gate record for that member is `pass` and
  `gates.ci` is `pass`; `fail` iff any record is `fail` or `gates.ci` is `fail`;
  `unknown` otherwise. A member whose records all pass but whose CI is
  unavailable or absent is therefore never `pass`.
- `status` aggregates the members. `blocked` iff any member is `fail`, any
  member's `gates.ci` is `unavailable`, or any member carries a synthetic
  unresolvable-identifier record. `incomplete` iff none of those hold and at
  least one member is `unknown`. `green` iff every member is `pass`. `blocked`
  wins over `incomplete`, and both non-green statuses are never green.
- `blockingMembers[]` names every member whose verdict is not `pass`, in
  declared order. It is never truncated, including under the report's byte bound.

`evidence[]` enumerates the declared member pull requests in landing order, with
entries carrying exactly `repoKey`, `pullRequest`, `landed`, and — only when
`landed` is true — the 1-based `landingPosition` that justifies the order.
Landed members come first in ascending `landingPosition` (ties broken by declared
order), then unlanded members in declared order. A member with no declared pull
request is omitted from `evidence[]` while remaining present in `members[]`.

`landed`, `landingPosition`, and per-member merge truth arrive as injected
`MemberLandingObservation` entries — one per declared member `{ repoKey, merged,
headSha?, landingPosition? }`, with `landingPosition` present only when `merged`
is true — supplied through the verification composition. They are never obtained
by an additional provider read, so the bounded read budget is unchanged.

### Review flow

`reviewFlow` is one run over the declared member pull-request set:
`{ runId, complete, verdicts[] }`.

| Field | Contract |
|---|---|
| `runId` | A stable digest over the change ref and the sorted declared member set, where each element is the member `repoKey` plus its `pullRequest` or an explicit empty marker when the member declares none. An unchanged set is the same run and adds no verdict entry; adding, removing, or re-pointing any declared member — including a member with no pull request — changes the identity. |
| `verdicts[]` | Exactly one entry per declared member in declared order with `repoKey`, `pullRequest` (absent for a member that declares none), and `verdict` from the closed set `pass`, `fail`, `unreviewed`. |
| `complete` | `true` only when every declared member has exactly one recorded review observation. |

Each member's verdict derives from its own observation only. One observation maps
to the member verdict — `pass` when every observation verdict is `pass`, `fail`
otherwise — an empty verdict list is `unreviewed`, zero matching observations is
`unreviewed`, and two or more matching observations make the member `fail` with
`complete: false`. The flow is pure over injected `ReviewObservation` values
`{ repoKey, pullRequest, verdicts[] }` supplied through the existing verification
composition that composes this surface: no store, no command, no live model call,
and no live network in default runs. A member is only matched against an
observation naming both its `repoKey` and its declared `pullRequest`.

### Exits, human output, and read budget

| Status | `overall` | Exit | Data |
|---|---|---|---|
| `green` | `pass` | `0` | The full report. |
| `blocked` | `fail` | `1` | The full report, including `gates[]` and `summary`. |
| `incomplete` | `fail` | `1` | The full report, including `gates[]` and `summary`. |

`overall: "unknown"` is never emitted by this report type, so no cross-repository
report follows the delivered classified-unknown or `verify.gates.unavailable`
exit-`2` path. Command-level failures that prevent a report at all — an invalid
plan, an unreadable gate set, a registry append failure — keep their delivered
identities and exits. The human report is bounded and deterministic: a header
naming the change ref, `overall`, the passed/gate count, and the status; one line
per declared member with its `repoKey`, `verdict`, and `ci=` reading; and one
`blocking=` line naming every blocking member or `-` when none.

The read budget extends the delivered per-source budget per member: one bounded
open-PR page, one resolved detail read, and one check-run page per member, with
no retries and no pagination, plus the one bounded local plan read that supplies
the member set, the delivered single ledger read, repository HEAD/branch read,
CI-workflow read, work-item read, and the one configuration-document resolution
attempt (at most one stat-class existence probe and at most one bounded content
read, with no content read when the document is absent). Per-member reads are injected at the
composition edge, and the evaluation never short-circuits: every member is
evaluated and reported. The append posture is unchanged — exactly one
gate-verification record per full battery evaluation that is not refused for
narrowed suite breadth, carrying the member gates projected to the delivered
ledger shape, plus the non-gating capsule append on that same non-refused path;
a narrowed refusal appends neither.

The cross-repository evaluation is selected by the composed member runtime: when
the composition supplies the member reads, declarations, landing observations,
and review observations, a member-declaring plan takes this path; a plan that
declares no members, or a composition that supplies no member runtime, keeps the
delivered single-target path and the delivered report type.

## Quality evidence

Default tests make no live calls. Behaviour and golden suites are
fixture-driven (`tests/behaviour/verify-gates-*.test.ts`,
`tests/golden/verify-gates.test.ts`), structure tests
(`tests/structure/verify-gates-*.test.ts`) pin the contract and exports,
fixtures live under `tests/fixtures/verify-gates/{cases,corpus,golden,suite-map,workflows}`,
and `tests/checks/verify-gates-no-live-calls.test.ts` guards the default
network-free path. The `suite-map` fixture family is the declaration/refusal
corpus: the declaration builders and defect nodes, the golden cases, the
pre-change parity baseline, and the parity scope manifest; the workflow
job-name fixtures live in `workflows/`. Each committed-document case creates its
own temporary root inside the suite that uses it, so no suite depends on another
suite's fixture directory or on the process working directory. Provider
gate-fact traps live under `tests/fixtures/providers/traps/` and
`tests/fixtures/providers/github/`. The
opt-in live smoke (`tests/behaviour/verify-gates-live.test.ts`) asserts
structural invariants only and runs only under `VERIFY_GATES_LIVE=1`.

The cross-repository surface is proven by `tests/behaviour/verify-gates-members.test.ts`
(shared verdict, per-member records and summary, blockers, statuses),
`verify-gates-members-evidence.test.ts` (landing order, injected observations,
evidence element shape), `verify-gates-members-bounds.test.ts` (eight-member
bound, byte bound, untruncated blockers), `verify-gates-review-flow.test.ts`
(run identity, one verdict per member, duplicate observation), and
`verify-gates-read-budget.test.ts` (per-member read counts, no retry, no
pagination). The shipped production composition's record persistence is proven
by `tests/behaviour/verify-gates-persistence.test.ts`: the shipped `verify
gates` run over injected transports and a real state store appends exactly one
fenced, post-append-verified record per full battery evaluation on the
single-target and member-projected paths, a narrowed-scope or configuration
refusal appends neither record nor capsule event, an append fault fails the run
as a classified state failure, and the golden, read-budget, and privacy
extensions in `tests/golden/verify-gates.test.ts`,
`tests/behaviour/verify-gates-read-budget.test.ts`, and
`tests/behaviour/merge-privacy.test.ts` hold the surface byte-identical,
budget-identical, and secret-free with the append wired. Contract and export
facts are pinned by
`tests/structure/cross-repository-contract.test.ts` and the report union by
`tests/types/cross-repository-report.type-test.ts`; the two-member report
goldens live under `tests/fixtures/cross-repository/goldens/`, and parity,
determinism, read-only posture, and hermeticity are covered by
`tests/behaviour/cross-repository-{parity,determinism,readonly}.test.ts` and
`tests/checks/cross-repository-hermetic.test.ts`.

## Limitations

The owner gate's declared signal is labels; comment-based owner asks are not
read (ADR-0006). The CI gate detects job display-name presence only; matrix expansion and
job-level `if` conditions remain deferred. Suite-to-job mapping is not a CI-gate
feature: suite breadth is declared in `verify.suite-map`, cited on a report as
`data.suiteBreadth`/`data.mirrorsJob`, and refused as `verify.narrowed-scope`
when the local declaration is narrower than the mirrored CI job, while the CI
gate itself stays job-presence only.
Review approval, unresolved threads, branch protection, and worktree
cleanliness remain outside this surface. The verify-gates surface resolves the
shipped default gate set: a repository-declared custom `merge.gates` set is a
`merge`-side resolution, so a record produced by `verify gates` carries the
shipped-default identity and the merge freshness envelope fail-closes
`merge.gates-stale` with the set delta under a custom declared set.
Merge execution is the merge
transaction's surface, specified in
[Merge and Verify Deploy](feature-merge-verify-deploy.md).

The shipped composition does not yet supply a member read runtime (`readMembers`
and the per-member read bundle), so a member-declaring plan takes the delivered
single-target path in the shipped CLI. The cross-repository report is produced
when the composition supplies the member reads, declarations, landing
observations, and review observations, and the contracts, report types, and
seams are complete and exercised through that composition.

## Capsule gate append

After the gate-verification state append, a full battery evaluation that is not refused for narrowed suite breadth also appends one `gate.outcome` capsule event when a capsule producer port is injected; a `verify.narrowed-scope` refusal appends no capsule event. The event carries the gate-set identity (`<schemaVersion>:<id,id,...>`), the head SHA, and one bounded `{gateId, verdict, reason}` entry per evaluated gate. The event key is derived from the gate-set identity and head SHA, so a re-run of the same evaluation appends nothing. The append is non-gating: a failed or thrown append becomes a bounded `capsule` disclosure on the success data or on the classified failure envelope, and the gate verdicts, the verification record, and the exit projection are unchanged. The capsule contract is in [Change Capsule](feature-capsule.md).

## Related

- [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md)
- [Machine-Readable Plan Schema](feature-plan-schema.md)
- [Scheduling Engine](feature-scheduling-engine.md)
- [Closeout Transaction](feature-closeout.md)
- [Delivery Lifecycle](feature-delivery-lifecycle.md)
- [Status Digest](feature-status-digest.md)
- [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md)
- [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md)
- [Result Contract and Error Table](feature-result-contract.md)
- [Change Capsule](feature-capsule.md)
- [Merge and Verify Deploy](feature-merge-verify-deploy.md)
- [PM-Notes Lint and Phase Transitions](feature-pm-notes-lint-and-phase-transitions.md)
- [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md)
- [TDR-0005 — Delivery Result Enum and CLI Exit Taxonomy](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md)
- [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md)
- [ADR-0006 — Work-Item Custom Fields and Comment-Omission Representation](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md)

**Change record:** `doc/changes/2026-10/2026-10-31--GH-178--verify-gates-v1/`; `doc/changes/2026-11/2026-11-06--GH-225--merge-verify-deploy/`; `doc/changes/2026-11/2026-11-07--GH-240--capsule-closeout/`; `doc/changes/2026-11/2026-11-14--GH-310--cross-repository-changes/`; `doc/changes/2026-11/2026-11-15--GH-300--suite-job-mapping-gates/`; `doc/changes/2026-11/2026-11-23--GH-388--verify-gates-persist-merge-verification/`.

## Config-declared gate set and verification record

The gate set is config-declared versioned data (`merge.gates`) shared with
`merge`. An absent declaration yields the shipped five built-in entries in
shipped order plus the merge-only `tracker-freshness` entry, so the default
report keeps the shipped five-gate output. A repo-declared `battery`/`both`
entry is evaluated and cited exactly like a built-in; `merge`-only entries never
appear on the battery. The five built-in ids stay reserved and mandatory in any
declared set.

The verify-gates surface resolves the shipped default set. A repository that
declares a custom `merge.gates` set is a `merge`-side resolution: a record
produced by `verify gates` carries the shipped-default identity, and under a
custom declared set the merge freshness envelope fail-closes
`merge.gates-stale` with the set delta rather than consuming the record.

Every full battery evaluation that is not refused for narrowed suite breadth
appends exactly one fenced, post-append-verified EVT-1 gate-verification record
(`merge.gate-verification`) carrying the change ref, head SHA, verification
time, declared gate-set identity, per-gate verdicts with citations, and the
tracker posture. The gate-set identity is the schema version plus the full
declared entry-id sequence (the shipped-default sequence when undeclared),
resolved by the one gate-set resolver shared with `merge`; a surface projection
selects which entries a surface evaluates and which verdict records the
payload carries, and never the identity the record binds. Because both record
producers resolve through that one resolver, a verify-gates record and a
`merge --dry-run` record carry identical identities under the shipped default.
Verdicts, citations, ordering, and
human bytes are pinned byte-identically by goldens; the append is the only
output effect for every non-refused evaluation, and a narrowed refusal appends
none. An append failure is a classified state failure, never a verdict
change, and never consumable evidence; the append adds zero provider and
zero configuration reads. `merge` consumes the newest record through its
freshness envelope under total equality of that identity. See
[Merge and Verify Deploy](feature-merge-verify-deploy.md).
