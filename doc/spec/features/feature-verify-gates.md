---
ados_distribution: internal
id: SPEC-VERIFY-GATES
status: Current
created: 2026-10-31
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The verify gates surface: the config-declared merge battery (default five built-ins in shipped order), cited pass/fail/unknown verdicts, structured VerifyLedgerEvaluation consumption, deterministic open-PR resolution, read-specific 404 absence, shared status vocabulary, bounded deterministic output, the appended EVT-1 gate-verification record with byte-identical verdicts, the non-gating capsule `gate.outcome` append with a bounded disclosure, and the two verify.gates.* error rows."
links:
  related_changes: ["GH-178", "GH-225", "GH-240"]
  related_decisions: ["ADR-0003", "ADR-0006", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/verify-gates.ts"
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
without short-circuit, so every report is complete.

The command performs no merge, auto-merge, provider mutation, or child
process. It performs bounded local reads (ledger, repository HEAD/branch, CI
workflow) and at most one bounded page or item per provider source: one open-PR
page, one matched detail read, one check-run page, and one work-item read. It
appends exactly one fenced gate-verification record per full battery evaluation
and nothing else. The report schema is `delivery.verify-gates.v1`; the envelope
schema remains `delivery.result.v1`.

## Command surface

| Invocation | Outcome |
|---|---|
| `verify gates GH-178` | Evaluate the declared battery (default five gates); a success prints the deterministic six-line human report; a failure prints the bounded gate summary. |
| `verify gates GH-178 --json` | Exactly one machine envelope on stdout; on success `data` is the full `delivery.verify-gates.v1` report, on failure there is no `data`. |
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
| `push-parity` | Attached branch, exactly one matching open delivery request, full 40/64-hex SHAs, and equal local/remote SHAs. |
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
pipelines.

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
`state.store.torn` (exit `2`).

## Error rows

| Code | Domain kind | Category | Projection class | Exit | Emitted when |
|---|---|---|---|---|---|
| `verify.gates.failed` | `verify` | user | `user-validation` | `1` | The overall result is `fail`. |
| `verify.gates.unavailable` | `verify` | platform | `platform-provider` | `2` | The overall result is `unknown` and no first-unknown gate carries a resolvable error-table identity. |

Both rows are additive members of the existing `verify` kind;
`verify.ledger.incomplete` remains the `verify change` row and is unchanged.

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

The read budget is bounded per source: one local ledger read (pm-notes plus
the verified registry), one local repository HEAD/branch read, one local
CI-workflow read, at most one bounded open-PR page, one resolved detail read,
one check-run page, and one work-item read per invocation. There are no
retries and no pagination. The only write is one appended gate-verification
record per full battery evaluation.

## Quality evidence

Default tests make no live calls. Behaviour and golden suites are
fixture-driven (`tests/behaviour/verify-gates-*.test.ts`,
`tests/golden/verify-gates.test.ts`), structure tests
(`tests/structure/verify-gates-*.test.ts`) pin the contract and exports,
fixtures live under `tests/fixtures/verify-gates/{cases,corpus,golden,workflows}`,
and `tests/checks/verify-gates-no-live-calls.test.ts` guards the default
network-free path. Provider gate-fact traps live under
`tests/fixtures/providers/traps/` and `tests/fixtures/providers/github/`. The
opt-in live smoke (`tests/behaviour/verify-gates-live.test.ts`) asserts
structural invariants only and runs only under `VERIFY_GATES_LIVE=1`.

## Limitations

The owner gate's declared signal is labels; comment-based owner asks are not
read (ADR-0006). The CI gate detects job display-name presence only; matrix
expansion, suite-to-job mapping, and job-level `if` conditions are deferred.
Review approval, unresolved threads, branch protection, and worktree
cleanliness remain outside this surface. Merge execution is the merge
transaction's surface, specified in
[Merge and Verify Deploy](feature-merge-verify-deploy.md).

## Capsule gate append

After the gate-verification state append, a full battery evaluation also appends one `gate.outcome` capsule event when a capsule producer port is injected. The event carries the gate-set identity (`<schemaVersion>:<id,id,...>`), the head SHA, and one bounded `{gateId, verdict, reason}` entry per evaluated gate. The event key is derived from the gate-set identity and head SHA, so a re-run of the same evaluation appends nothing. The append is non-gating: a failed or thrown append becomes a bounded `capsule` disclosure on the success data or on the classified failure envelope, and the gate verdicts, the verification record, and the exit projection are unchanged. The capsule contract is in [Change Capsule](feature-capsule.md).

## Related

- [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md)
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

**Change record:** `doc/changes/2026-10/2026-10-31--GH-178--verify-gates-v1/`; `doc/changes/2026-11/2026-11-06--GH-225--merge-verify-deploy/`; `doc/changes/2026-11/2026-11-07--GH-240--capsule-closeout/`.

## Config-declared gate set and verification record

The gate set is config-declared versioned data (`merge.gates`) shared with
`merge`. An absent declaration yields the shipped five built-in entries in
shipped order plus the merge-only `tracker-freshness` entry, so the default
report keeps the shipped five-gate output. A repo-declared `battery`/`both`
entry is evaluated and cited exactly like a built-in; `merge`-only entries never
appear on the battery. The five built-in ids stay reserved and mandatory in any
declared set.

Every full battery evaluation appends exactly one fenced, post-append-verified
EVT-1 gate-verification record (`merge.gate-verification`) carrying the change
ref, head SHA, verification time, declared gate-set identity, per-gate verdicts
with citations, and the tracker posture. Verdicts, citations, ordering, and
human bytes are pinned byte-identically by goldens; the append is the only
output effect. An append failure is a classified state failure, never a verdict
change. `merge` consumes the record. See
[Merge and Verify Deploy](feature-merge-verify-deploy.md).
