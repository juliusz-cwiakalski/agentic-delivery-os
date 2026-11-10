# GH-279 Change Record

Change: preflight the tracker truth-read credential before dispatch spawn, with
typed credential and divergence diagnostics.

## Observed live evidence

GH-241 is the concrete harm. A real dispatch produced:

```
dispatch GH-241  ->  result=state-unverified, pr_url=, exit_code=2
artifact truth   ->  chg-GH-241-pm-notes.yaml 11/11 phases complete; PR #278 open
```

The change was delivered (completed phases, commits, an open pull request), but
the engine could not derive a verdict because the default install resolved the
truth-read reference `github-read` to the literal environment key
`GITHUB_TOKEN`, which was unset. The refusal named an error code but never the
missing key.

The same session exposed a second defect in the diagnostic area:
`dispatch dual-run resolve` reported `dispatch.state-unverified` even though the
local state store was demonstrably readable (the dual-run summary read it). The
resolve path was collapsing every store failure into the truth token.

## Delivered design

- Admission preflight: an optional `preflight` port on the dispatch engine ports,
  distinct from `ports.admission`, invoked after harness/input validation and
  before `claimLease`, spawn, or resume. Production always supplies it.
- Missing credential: `config.credential.missing` (`kind: config`, exit 1) with a
  bounded summary naming `GITHUB_TOKEN`, the `github-read` reference, and one
  remediation. Zero requests, no lease, no session, no attempt, no divergence.
- Admission read classification at the production boundary: 401/403 ->
  `provider.auth.rejected` (exit 1); 5xx, other status-bearing non-2xx, and a
  status-absent transport -> `provider.outage` (exit 2); a received-but-malformed
  2xx -> `provider.payload.invalid` (exit 2, status present); 404 ->
  `input.value.rejected` (exit 1, provider-reported absence, scope caveat).
- Resolve: local evidence only; genuine store faults keep `kind: state` with
  their own identity; an absent divergence id is the app-local
  `divergence-not-found` sentinel, surfaced as `input.value.rejected`; the note is
  clamped to 240 before the record is built; replay is a noop.
- Delivered-evidence divergence: a completed classifier outcome with a readable
  progressed/completed ledger and an unreadable truth read records at most one
  open divergence per `(repository, work-item reference)`, appended before the
  attempt, reused on resume, counted by the summary, and resolvable locally.
- Status: an additive optional section-level
  `credentialPrerequisite { referenceName, sourceKey }` on sections whose
  credential-dependent source failed; the `sources[]` shape and bound are
  unchanged; exit 0 with nine sections.
- Doctor: unchanged behaviour and availability; the regression parity test pins
  that the tracker and CI credential hints name the resolved key.

## Operator communication

Every install that relied on `gh` authentication alone must export the key before
upgrading:

```sh
export GITHUB_TOKEN="$(gh auth token)"
```

The refusal text, the provisioning guide, the dispatch reference page, this
record, and the pull-request description carry that message. No token value is
committed, printed, or attached.

## Manual verification

These are operator-executed PR-time procedures, not automated test cases. They
were not executed in the delivery sandbox because it has no real credential and
no provider network access. The table is the durable procedure record; the
observed facts are attached at `pr_creation`, and the pull-request description
repeats the MV-1 summary. Execution stays PR-time: no delivery-time gate
(`dod_check` included) depends on the observed facts, only on this recorded
obligation.

| ID | Timing / owner | Procedure | Artifact corroboration | Tracker corroboration | CI corroboration |
|---|---|---|---|---|---|
| MV-1 | PR-time, operator | With `GITHUB_TOKEN` exported, run one real `dispatch <ref> --json` for a change whose artifact, tracker, and CI facts are addressable. | Branch/PR URL the verdict points at. | Tracker state for the dispatched reference. | CI run URL and conclusion the verdict cites. The verdict alone is not sufficient. |
| MV-2 | PR-time, operator | Record one `dispatch dual-run summary --repo <repo> --json` before and after `dispatch dual-run resolve <id> --note <text>`, and a resume for the same pair while the divergence is open. | The open divergence id and attempt id before and after; both divergence records stay readable. | Not applicable (local state evidence only). | Not applicable (local state evidence only). |
| MV-3 | PR-time, operator | Inspect TDR-0015 and TDR-0020. | TDR-0015 and TDR-0020 paths and the four additive note anchors. | Not applicable. | Not applicable. |

MV-1 acceptance: the verdict is a token other than `state-unverified`. MV-2
acceptance: the unresolved count moves by exactly one after resolution, the
resume references the existing open divergence, and the count does not
increase. MV-3 acceptance: the four additive TDR-0015 amendment notes exist,
TDR-0020 is named as their durable home, and no supersession is claimed.

## Decision record

The four TDR-0015 assertions amended by the delivered-evidence divergence are
carried by TDR-0020 as their durable home; each affected TDR-0015 clause keeps an
additive note linking to it. No supersession is claimed.

## Doctor

`doctor` remains unshipped in this change. It is not added to the prompt-required
command set, its help inventory is unchanged, and the only doctor artefact in
this change is the parity regression test.

## Review remediation (iteration 1)

The first code review (`code-review/review-iter-1.yaml`) returned FAIL on branch
history hygiene with nine non-blocking advisories. Disposition:

| Finding | Disposition |
|---|---|
| F-1 commit subjects | **Accepted** per pm-notes D9. Commits go only through the commit primitive, so the branch keeps its primitive-generated template subjects. History is not rewritten and the tree is unchanged. |
| F-2 unreachable read reason | **Fixed.** `unreadableTruthReason` returns only the reachable `tracker`/`artifact` families; a `ci`-only failure yields no reference and is never labelled `state`. TC-DIVREC-002 adds the ci-only negative. |
| F-3 doctor prefix derivation | **Fixed.** TC-DOCTCRED-002 drives an `environment-prefixed` reference through `createDoctorCommandRuntime` and asserts the derived `EXAMPLE_PRODUCT_TRACKER_TOKEN` reaches the hint, not the bare suffix. |
| F-4 sentinel surface | **Fixed.** `DISPATCH_DIVERGENCE_NOT_FOUND` stays module-local in `app/dispatch-ledger`; no package-root or app-barrel export. The content-inventory allowance remains because it is file-scoped to the module export, not to the package root. |
| F-5 scope reconciliation | **Fixed as a record repair.** Phase 5 declares `packages/core/src/app/index.ts`; Phase 8 declares the glossary, the dispatch test spec, the two additionally reconciled feature specs, the forbidden-literals registry, the e2e fixture, the queue harness, and the content-inventory test. Seven feature specs are reconciled, not five. |
| F-6 projection pin | **Fixed.** The five admission goldens carry `kind` and `projectionClass`; `assertGolden` classifies the pair (kind AND projection AND exit) and TC-READMAP-008 pins the projection per pair. |
| F-7 MV evidence | **Fixed as a procedure record.** MV-1/MV-2/MV-3 are operator-executed PR-time procedures with artifact, tracker, and CI corroboration fields; execution stays at `pr_creation`. |
| F-8 entrypoint dependency | **Accepted** per pm-notes D10. The credential-key resolver import is pure and the boundary scan is green; no refactor. |
| F-9 human prerequisite | **Fixed.** `renderStatusHuman` appends `requires <sourceKey> (<referenceName>)` to each affected section line (names only, never a value); TC-STATCRED-001 covers it and the digest goldens are unchanged. |
| F-10 TC labels | **Fixed.** TC-READMAP-010 and TC-CREDNAME-006 appear in their test names. |

## Release note

The minor release note records: the new admission refusal class (a precondition
refusal carries no attempt record), the exact `GITHUB_TOKEN` prerequisite with the
explicit export bridge, doctor remaining unshipped, and the delivered-evidence
divergence-recording behaviour.
