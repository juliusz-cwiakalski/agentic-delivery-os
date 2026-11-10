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

These are operator-executed PR-time checks, not automated test cases. They were
not executed in the delivery sandbox because it has no real credential and no
provider network access; the operator attaches the observed facts at the pull
request.

| ID | Procedure | Required corroboration |
|---|---|---|
| MV-1 | With `GITHUB_TOKEN` exported, run one real `dispatch <ref> --json` for a change whose artifact, tracker, and CI facts are addressable. | The verdict is a token other than `state-unverified`; attach the artifact evidence (branch/PR), the tracker state for the reference, and the CI run URL the verdict points at. The verdict alone is not sufficient. |
| MV-2 | Record one `dispatch dual-run summary --repo <repo> --json` before and after `dispatch dual-run resolve <id> --note <text>`, and a resume for the same pair while the divergence is open. | The unresolved count moves by exactly one after resolution; the resume references the existing open divergence and does not increase the count; the attempt and both divergence records stay readable. |
| MV-3 | Inspect TDR-0015 and TDR-0020. | The four additive TDR-0015 amendment notes exist, TDR-0020 is named as their durable home, no supersession is claimed, and this record repeats the pointer. |

## Decision record

The four TDR-0015 assertions amended by the delivered-evidence divergence are
carried by TDR-0020 as their durable home; each affected TDR-0015 clause keeps an
additive note linking to it. No supersession is claimed.

## Doctor

`doctor` remains unshipped in this change. It is not added to the prompt-required
command set, its help inventory is unchanged, and the only doctor artefact in
this change is the parity regression test.

## Release note

The minor release note records: the new admission refusal class (a precondition
refusal carries no attempt record), the exact `GITHUB_TOKEN` prerequisite with the
explicit export bridge, doctor remaining unshipped, and the delivered-evidence
divergence-recording behaviour.
