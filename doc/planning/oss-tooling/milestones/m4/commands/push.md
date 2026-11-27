---
ados_distribution: redistributable
---
# `push` — the lane's own evidence push

`push <ref>` is the lane-side act that pushes the lifecycle's last evidence commit
to the remote. It performs exactly one non-force push of the change branch to the
checkout's configured push remote through the delivered push seam, appends one
durable `dispatch.lane-push` record, and answers the verdict, branch, head,
refusal cause, and whether the record landed. It authors nothing: no stage,
commit, amend, reset, or history rewrite.

At `pr_creation` the act runs after `phase complete <ref> pr_creation` has landed
the phase-completion commit, so the commit pushed is the lane's actual last commit.
The PR workflow's own pre-PR push and the dispatch engine's ensure-push stay in
place as the other two paths; a repeat push of an equal head is not an error.

## Help and version

```text
jaiship push --help
jaiship --version
```

## Grammar

```text
jaiship push <ref>
```

Exactly one positional work-item reference. A missing, empty, or malformed
reference is the delivered `input.value.rejected` refusal before any branch read,
act, or append. An undeclared flag is the delivered `fallback.invocation` refusal.
The global `--json`, `--verbose`, and `--pretty` flags are accepted.

## Branch resolution

The change branch is resolved from two delivered facts and one pure selection:

- the change record's optional, opaque `branch:` declaration (one bounded pm-notes
  read);
- the delivered local branch read, already narrowed by the work-item branch
  convention (one bounded local branch read);
- `selectMatchingBranch` over that read, with no merged-head tiebreaker.

Exactly one agreement resolves. Each of the following is a typed input refusal
that names the observed state, performs no act, and appends no record:

| State | Named in the refusal |
|---|---|
| the declaration and the convention read disagree | both branch values |
| the convention read matches no branch | the reference used for the match |
| the convention read matches more than one branch | the bounded candidate list |
| the resolved name fails the safe-ref predicate | the resolved name |

The protected-name membership check (`main`, `main-tools`, `HEAD`) runs beside the
safe-ref predicate as defence in depth. A resolved name is always a convention
match and contains a slash, so no command-path input can trigger it; the
membership check is retained for the seam's direct consumers.

## The act

One call of the delivered push seam: fixed argv
`git push <resolved push remote> HEAD:refs/heads/<branch>`, a literal non-shell
child process, the 60 000 ms injectable budget with no configuration key, one
attempt with no retry, and no force-capable variant. The push remote is resolved
by one bounded local configuration read in this order —
`branch.<branch>.pushRemote`, `remote.pushDefault`, `branch.<branch>.remote`,
then `origin` — and a missing or ambiguous destination is a typed
`remote-unavailable` refusal that starts no child, never a guess. No `--ff-only`
exists for `git push`: fast-forward-only semantics are git's own default for a
non-force push, so the act passes no flag and no `+` prefix and can never force.
The act runs in the invocation's own checkout; for a dispatch-provisioned lane
that is the lane's worktree. At act time the command reads the checkout's `HEAD`
through the delivered local checkout/head read; that value is the record's and
the answer's `head`, never a value the transport reports.

## The record

One `dispatch.lane-push` record (`delivery.dispatch.lane-push.v1`, key
`dispatch.lane-pushes:<ref>`) is appended under the store fence after the act. It
carries the schema, reference, normalized repository, branch, full-hex head,
verdict (`pushed` or `failed`), the closed cause when the verdict is `failed`, the
attempt and session identities when a durable lane record was readable at push
time, and the recorded instant. Identifiers and full-hex SHAs only; the whole
payload is at most 512 UTF-8 bytes; git's failure text never enters it.

Act first, append second: a fence or append that fails in one bounded attempt is
disclosed as `recorded: false` with no `recordedAt`. The act is not retried and no
partial record is written.

## The answer

Machine: `ref`, `repository`, and one `lanePush` object with `verdict`, `branch`,
`head`, `cause` (exactly when `failed`), `recorded`, and `recordedAt` (exactly when
recorded).

Human: one `key=value` block in this order — `ref`, `repository`, `lanePush`,
`branch`, `head`, `cause` (only when present), `recorded`, `recordedAt` (only when
recorded) — at most 16 lines and 2 KiB.

| Exit | Meaning |
|---|---|
| 0 | the verdict is `pushed` (an already-up-to-date branch included) |
| 1 | a refused act: a data-bearing answer with no top-level error identity |

## Closed refusal causes

`protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`,
`spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified`.

Seven are recordable child-act causes (`non-fast-forward`, `auth-rejected`,
`remote-unavailable`, `spawn-failed`, `timed-out`, `protected-ref` from a server
side protection or hook decline, and `unclassified`). `unsafe-branch` is
guard-only: the predicate refuses such a name before any child, so the command
refuses it pre-act and no lane-push record carries it. `protected-ref` is one token
with two sources; the layer and the child count tell them apart.

## Idempotence and reporting

A second invocation performs another single act and appends another record; a
standing record never suppresses an act, and a past refusal is never a licence to
force. The lane's final message names the PR URL and the push outcome; on a refusal
it names the cause and never claims the branch is on the remote. The dispatch
engine folds the newest matching record into the attempt's reserved evidence as
`lane-push:<verdict>` and, on a refusal, `lane-push-cause:<cause>`; `dispatch
status <ref>` carries the same fact as the additive `lanePush` member.
