---
change:
  ref: GH-416
  type: feat
  status: Proposed
  slug: lane-pushes-own-evidence-commit
  title: "M4-S45: A lane pushes its own last evidence commit before it stops (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "the delivery lifecycle's `pr_creation` tail and the dispatch engine's attempt evidence (a prompt-required CLI command over the delivered adapters push seam, and a durable lane-push fact on the delivered operator surface)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - change
    - m4
    - dispatch
    - cli
    - delivery-lifecycle
    - git-seams
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered adapters push seam: one fast-forward-only push of the change branch over a fixed argv, a literal non-shell child runner, an injectable 60 000 ms budget, one attempt, and the closed outcome set `accepted | rejected | failed | timed-out`, where git exit 0 (already up to date included) is `accepted`"
      - "delivered dispatch attempt record: one record per terminal classification, at most 16 bounded evidence references with a reserved-ahead-of-slice disclosure set, and no prompt, transcript, diff, credential, or provider payload"
      - "delivered operator surface: four read-only queries over the durable lane record with an additive optional fact read through one additional bounded record read (the `park` precedent), and the declared posture of no network call, no process start, no fence, no append, no deletion"
      - "delivered `dispatch.lane` record (attempt identity, session identity, state) as the lane identity the session-side fact is bound to"
      - "delivered local branch reads and the branch convention with its `none | unique | ambiguous` selection semantics, as the structural source for the change branch"
      - "delivered pm-notes document read and the change record's `branch:` declaration (an optional, opaque top-level key today)"
      - "delivered state store with append-only records under the store fence, and the store's bounded verified read"
      - "delivered lifecycle prompt builder with its five stable section markers, and the `pm` agent definition whose step 10 is `pr_creation`"
      - "delivered prompt-required CLI composition, help inventory, help-guide coverage and reference-page parity guards"
      - "TDR-0076 (engine ensure-push as the first remote write), whose push-ownership boundary this change amends"
    external:
      - "the checkout's configured git remote and its ambient credential chain, for one fast-forward push of the change branch per lane end; no credential resolution, storage, or transport is introduced"
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/416
  related_changes: ["GH-386", "GH-394", "GH-404", "GH-406", "GH-413"]
  related_decisions: ["TDR-0076", "TDR-0054", "TDR-0058"]
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/dispatch-operator.ts"
    - "packages/core/src/contracts/pm-notes.ts"
    - "packages/core/src/domain/dispatch-prompt.ts"
    - "packages/core/src/domain/closeout.ts"
    - "packages/adapters/src/git/push.ts"
    - "packages/cli/src/help/prompt-required-commands.ts"
    - "packages/cli/src/output/dispatch-text.ts"
    - ".opencode/agent/pm.md"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the lane, not the wrapper, the owner of its last evidence commit — a prompt-required typed push at `pr_creation` over the delivered fast-forward seam, a durable lane-push fact that the dispatch classification folds into the attempt record and the operator surface reports, and a refused push that is named instead of mistaken for a pushed branch — so a lane whose dispatch wrapper is gone can no longer stop with its own evidence commit existing only locally.

## 1. SUMMARY

The push of a lane's final evidence commit is currently the wrapper's job: `@pr-manager` pushes before it creates the pull request, and the dispatch engine reconciles parity once, at terminal classification (GH-386). Both are true statements about a live wrapper. A lane whose wrapper is no longer alive keeps working — an interrupted tool call, a harness restart, a delivery-process restart — and the commits it lands after PR creation (the PR URL note and the `pr_creation` phase completion) stay local. The pull request's head then lags the branch head by exactly the delivered evidence, and the merge bar (local head, remote head, PR head equal) holds until a human pushes by hand.

This change moves that act into the lane. At `pr_creation`, after the pull request is recorded in the pm-notes and after the phase completion commit is landed, the lane invokes one prompt-required typed command that pushes the change branch's head fast-forward through the **delivered** adapters push seam — fixed argv, literal non-shell child, the injectable 60 000 ms budget, one attempt, no force, no ref but the change branch — and appends one durable, bounded `dispatch.lane-push` record with the verdict, the head, and, on a refusal, one closed cause token. Nothing is authored and nothing is amended: the command pushes the head that already exists. The wrapper's pushes stay as second, idempotent steps, and the seam's exit-0-means-accepted contract already makes "already up to date" a non-error. A refusal is named in the command's answer, in the lane's final message, and — because a session cannot write the attempt record that the engine appends at classification — in the attempt's bounded evidence references, which the classification folds in from the durable record it reads once. `dispatch status` carries the same fact additively, from the record and from no network call, so an operator sees whether the lane's head went to the remote without comparing heads. One new durable record kind and one new evidence-reference family are the declared structural growth; the classification vocabulary, the error table, the corroboration map, the attempt schema, and the delivery result tokens are unchanged. A decision record amending TDR-0076's push ownership accompanies the change.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Two pushes exist, both wrapper-side.** `@pr-manager` stages a clean tree through the commit primitive and pushes the branch immediately before creating the pull request, so the commits that make the PR visible are covered. The dispatch engine's ensure-push (GH-386) runs at the `pr-open` arm of the one total derivation: when the local head differs from the open request's head it performs one fast-forward push and re-reads parity, and it classifies `pr-open` only from a readable equality. It runs **only when a dispatch invocation reaches terminal classification**.
- **The commit primitive never pushes.** Every commit the lifecycle lands after the pull request exists is a local commit until somebody pushes it. The delivered evidence commits are exactly two: the pm-notes note recording the PR URL, and the phase completion commit that `phase complete <ref> pr_creation` lands. The delivered evidence confirms the shape: a recent lane recorded "the branch carries two pm-notes record commits after the gate" at the moment its PR was created.
- **A lane keeps working when its wrapper does not.** A dispatch wrapper can end for ordinary reasons (an interrupted tool call, a harness restart, a delivery-process restart) while the session in the runner continues. When that happens, no classification occurs, no ensure-push runs, and no attempt record is appended for that dispatch. Nothing in the typed stack notices that the lane's last commit is local.
- **The merge bar is head equality.** A pull request whose head lags the branch head by one commit cannot merge as delivered, and a late manual push invalidates the CI run on the PR head. The divergence is detectable only by comparing heads, so it persists until a human notices.
- **The lane runs in its own worktree.** A dispatch-provisioned lane creates its delivery branch inside its linked worktree, and that worktree is the session's working directory for the whole lifecycle. The session's `HEAD` is therefore the lane's own head.
- **The push seam is delivered and is the only remote-write act.** One fixed argv (`HEAD` to the change branch, fast-forward only), a literal non-shell child process, an injectable 60 000 ms budget, one attempt with no retry, and a closed outcome union. `git push` exit 0 — which includes "Everything up-to-date" — is `accepted`, so the seam itself already treats a repeated push of an equal branch as a non-error.
- **The session-side push is a convention with no vocabulary.** No CLI command pushes (the prompt-required composition has no `push`), the commit primitive never pushes, and the only typed push is the engine-side capability behind the dispatch parity port. A refusal anywhere in the delivered path surfaces as a cause-less rejection detail or not at all.
- **The attempt record is engine-written at classification.** It carries at most 16 bounded evidence references with a reserved-ahead-of-slice disclosure set of five members (`lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, `push:<verdict>`), one comparison record, and tri-state corroboration over the closed source map. The session cannot write it, and a dead wrapper writes nothing at all.
- **The operator surface is record-only by declaration.** The four read queries take at most one bounded lane read and at most one bounded artifact or transcript read, make no network call, start no process, take no fence, append nothing, and delete nothing. The delivered additive optional `park` fact on `dispatch status` is the precedent for one further bounded record read, carried verbatim and absent when nothing stands.
- **The lane is told what to do by two surfaces.** The built delivery-lifecycle prompt carries five stable section markers (asserted, never prose-matched) and tells the session to run the eleven phases and never skip a gate; the `pm` agent definition carries the per-phase instructions, whose step 10 is `pr_creation` (create the PR, record its URL as a pm-notes note, run `phase complete <ref> pr_creation`, stop).

### 2.2 Pain Points / Gaps

- A lane can end with its own evidence commit local: the PR head is one commit behind the branch, the merge bar is unmet, and the delivered artifact differs from the merged one by exactly the evidence the lifecycle promises.
- The act that would fix it belongs to a process that may no longer exist. Enforcement that depends on the wrapper is enforcement that depends on the wrapper being alive.
- Nothing durable records that the lane tried to push, so a refusal is invisible: no error, no evidence, no operator fact, and a lane that reports completion as if its evidence were on the remote.
- `dispatch status` answers lane state, staleness, probe, park, and worktree, but not the one question the merge bar asks: did this lane's head reach the remote?
- A late manual push costs a second CI cycle for a commit that belonged in the pull request from the start.

## 3. PROBLEM STATEMENT

Because the push of a lane's final evidence commit is a wrapper-side act that a dead wrapper cannot perform, and because nothing durable records the lane's own attempt to push, a lane can stop with its PR head one commit behind its branch head — leaving the merge bar unmet, the delivered artifact and the merged artifact differing by the change's own evidence, and the divergence visible only to whoever compares heads.

## 4. GOALS

- **G-1**: The lane pushes its own last commit at `pr_creation`, through the delivered fast-forward seam, authoring and amending nothing, and does so whether or not a wrapper is alive.
- **G-2**: The wrapper's pushes remain as second, idempotent steps: no delivered push path is removed, reordered, or made an error, and a push of an already-equal branch is a non-error at every call site.
- **G-3**: A refused push is named — in the lane's answer, in the lane's final message, and in the attempt record the engine appends at classification — and a lane never reports completion as if its evidence were on the remote.
- **G-4**: The lane's own push outcome is durable and visible: `dispatch status` answers whether, and for which head, the lane's last push was accepted, without a network call.
- **G-5**: No silent growth: the one new durable record kind, the two new evidence references, the push seam's cause vocabulary, and the widened status read count are each declared, bounded, and reconciled in current-truth documentation; no result token, error identity, failure row, corroboration source, comparison reason, derivation arm, or attempt-schema field is added.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Lanes ending with the PR head behind the branch head where no wrapper classified | 0 (fixture-proven in-PR; live observation recorded after merge) |
| Commits authored or amended by the push act | 0 |
| Refused session-side pushes with a durable record and a named cause | 100% |
| Refused session-side pushes reaching the attempt record | 100% (folded from the durable record) |
| Additional result tokens, error identities, error-table rows, corroboration sources, comparison reasons, derivation arms, attempt-schema fields | 0 |
| Added network calls, process starts, fence acquisitions, appends, deletions on the read queries | 0 / 0 / 0 / 0 / 0 |
| Additional bounded record reads per `dispatch status` answer | ≤ 1 (the lane-push fact) |
| Evidence references reserved ahead of the slice | ≤ 7 of 16 (five delivered plus at most two new lane-push references) |

### 4.2 Non-Goals

- **NG-1**: No force push, no history rewrite, no ref other than the change branch's configured upstream.
- **NG-2**: No new result token, error identity, error-table row, corroboration source, comparison reason, derivation arm, or attempt-record field; the attempt gains only bounded evidence references.
- **NG-3**: No change to the machine envelope of `dispatch <ref>`: its additive optional `push` block remains the parity block (GH-386) and does not carry the lane's own act.
- **NG-4**: No removal, reordering, or narrowing of the delivered pushes: the PR-creation workflow's pre-PR push, the engine's ensure-push at the `pr-open` arm, and the bash wrappers' own pushes keep their behavior.
- **NG-5**: **The explicit reverse of GH-386's NG-3**: this change *does* change the session-side convention. GH-386 declared "No change to session-side conventions" and made the engine's ensure-push a reconciliation backstop; that reading is now amended — the session-side act becomes a typed, durable, reported step, and the engine's act stays as the backstop it was declared to be.
- **NG-6**: No merge capability anywhere, and no change to merge authority.
- **NG-7**: No credential resolution, storage, or transport change: the act uses the checkout's ambient git credential chain, as the delivered engine-side push does.
- **NG-8**: No retry ladder and no automatic re-push by the lane: one attempt per invocation, resolved by the next classification, an operator, or the engine's own backstop.
- **NG-9**: No pm-notes schema change: the change record's `branch:` declaration stays an optional opaque key and is read as a value, never promoted to a typed field by this change.
- **NG-10**: No change to the bash wrappers' own push behavior or to their retirement status.
- **NG-11**: No changeset outside the standing lockstep invariant: the five fixed-group packages, all minor.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | A prompt-required typed push command the lane invokes at `pr_creation`, thin over the delivered fast-forward seam and performing no authoring | Requirement 1: the lane pushes its own last commit; a typed, injectable seam is the only form AC-1 can fixture-drive |
| F-2 | Idempotent second push: every delivered push path stays, and an already-equal branch is a non-error | Requirement 2, as a regression contract rather than a behavior change |
| F-3 | A durable, bounded lane-push record and its fold into the attempt's reserved evidence references | Requirement 3: the attempt record is engine-written, so the session must leave a durable fact the engine can name |
| F-4 | The refusal is named in the command's answer and in the lane's final message, through both product surfaces | Requirement 3: a lane never reports completion as if its evidence were on the remote |
| F-5 | An additive optional `lanePush` fact on `dispatch status`, derived from the recorded push with no network call | Requirement 4: visibility without breaking the operator surface's declared read posture |
| F-6 | The declared divergence between the session-side product surface and the shell wrapper, with its bounded residual | No silent drift: the act reaches typed and shell lanes alike, while the evidence fold and the status fact are typed dispatch surfaces |

### 5.1 Capability Details

**F-1 — The lane's own push.** The lifecycle's `pr_creation` tail gains one step: after the pull request is created or updated and its URL is recorded in the pm-notes, and after `phase complete <ref> pr_creation` has landed the phase completion commit, the lane invokes the push command for the work item, then reports. Declared behaviors:

- **One act, delivered contract.** The command performs exactly one fast-forward push of the change branch through the delivered push seam and changes none of its terms: fixed argv naming only the change branch, a literal non-shell child process, the 60 000 ms injectable budget (no new configuration key), one attempt with no retry, no force-capable variant, and only the branch's configured upstream. A second implementation of the push act, or a shell invocation of git, is not created.
- **Nothing is authored or amended.** The command stages nothing, commits nothing, amends nothing, resets nothing, and rewrites no history. It pushes the head that already exists — the phase completion commit — so the lane's evidence reaches the remote unmodified.
- **Working directory.** The act runs in the invocation's own checkout, which for a dispatch-provisioned lane is the lane's worktree, so the pushed `HEAD` is the lane's head.
- **Branch resolution is structural and refuses rather than guesses.** The change branch is resolved from two delivered facts: the change record's `branch:` declaration when the document carries one, and the delivered local branch read narrowed by the work-item branch convention. The delivered selection semantics are reused unchanged — exactly one match is a resolution; no match and more than one match are refusals. The two must agree when both exist. Each of the following is a typed input refusal that names the observed state, performs no act, and appends no record: the declaration and the convention read disagree; the convention read matches no branch; the convention read matches more than one; the resolved name fails the safe-ref guard or names a protected ref. A guessed branch is never pushed.
- **Two refusal arms, one question each.** The command performs the delivered seam's own two guards — the safe-ref check and membership of the seam's protected set — during resolution, so a resolved name that fails either is a pre-act typed input refusal that names the observed branch, starts no child process, performs no act, and appends no record (the arm AC-F1-2's outcome describes). The seam keeps both guards as defence in depth; when the seam itself rejects a name resolution did not catch, or a git-level refusal is classified, the verdict is `failed` and the record is appended (DM-4). The arms answer different questions — "is this ref pushable at all" versus "what did the transport do" — and neither may silently become the other.
- **Verdict.** An accepted act (git exit 0, including an already up-to-date branch) is `pushed`; a rejection, a timeout, and a spawn-level failure are `failed`. The verdict is the act's own outcome, recorded before any classification can disagree with it.
- **Recorded.** The act is followed by one append of the durable lane-push record (F-3), bound to the lane identity the command reads from the durable lane record before the act. When no lane record is readable (a manual run outside any dispatch), the record carries no attempt identity and no dispatch lane's status answers it. The act comes first and the append second: a failed append is disclosed on the answer (`recorded: false`) rather than a record claiming a push that never happened.
- **Idempotence.** The command may be invoked again; it performs another single act and records it. It never suppresses an act because a record already exists, and it never treats a prior refusal as license to force.

**F-2 — The second, idempotent push (regression).** Nothing in the delivered push landscape is removed or reordered:

- `@pr-manager` still pushes a clean branch before any PR/MR create or update, because a pull request for an unseen branch cannot exist.
- The dispatch engine's ensure-push at the `pr-open` arm is unchanged: it reads parity, pushes only when the heads differ, re-reads parity once, and classifies `pr-open` only from a readable equality.
- The bash wrappers keep their own push behavior.
- The seam's contract already makes a repeat a non-error: `git push` exit 0 covers an equal branch, so an up-to-date push is `accepted` and no call site turns it into an error. The lane's command answers `pushed`; the engine observes parity and performs no act at all (`push:clean`); a wrapper's own push succeeds silently.

The regression contract is therefore behavioral and pinned by fixture: a second push of an equal head yields no error anywhere, and a classification that follows a successful lane push derives `pr-open` with zero engine push invocations.

**F-3 — Durable lane-push record and its fold into the attempt record.** The session cannot write the attempt record: the engine appends exactly one at terminal classification, and a dead wrapper appends nothing. The lane therefore leaves a durable, bounded fact that the classification reads:

- **The record.** One new append-only durable record kind, `dispatch.lane-push` (`delivery.dispatch.lane-push.v1`), keyed per work-item reference, latest-wins per reference and attempt. One record per push invocation. Payload members are bounded and carry identifiers and full-hex SHAs only: the schema, the reference, the normalized repository identity, the branch, the head that was pushed, the verdict, the closed refusal cause when the verdict is `failed`, the attempt identity and session identity read from the newest lane record when one was readable, and the recorded instant. No stderr, no remote URL, no diff, no prompt, no transcript, no credential, and no provider payload enters the payload; the whole payload is bounded at 512 UTF-8 bytes.
- **The read at classification.** Classification performs at most one additional bounded record read of the lane-push family: records are filtered to the resolved repository first, then the newest record whose attempt identity equals the attempt being classified is the fact; an unreadable store, no matching record, and a record for another attempt each contribute nothing and never fabricate a push.
- **The evidence.** The folded references are reserved ahead of the evidence slice, beside the delivered disclosures: `lane-push:pushed` on an accepted act, and `lane-push:failed` together with `lane-push-cause:<cause>` on a refusal. The delivered reservation is five references, not three (code truth: `packages/core/src/app/dispatch.ts`, the reserved disclosure block ahead of the slice — `lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, `push:<verdict>`). This change adds at most two, so the post-change maximum is seven of the sixteen-reference budget: still inside the budget, and a lane-push disclosure is still never truncated away.
- **No classification growth.** The fold adds no result token, error identity, error-table row, comparison reason, corroboration source, derivation arm, or attempt field. The classification stays the one total order: the delivered lifecycle push-failure row (`failed` / `failed` / exit 1 / `push-parity-unmet`) remains the only consequence of a branch head that is genuinely not on the remote, because the engine's own ensure-push evaluates the same branch and will either reconcile it or type the failure.
- **A disclosure, not a claim.** A recorded `lane-push:failed` never turns a truthful classification into a failure and never suppresses one: if parity holds at classification, the evidence is on the remote and the earlier refusal is history; if parity does not hold, the delivered row fires. The two references answer different questions and both remain readable.

**F-4 — Naming the refusal.** A refusal is named on three surfaces with one vocabulary:

- **The command's answer** names the verdict, the branch, the head, and the cause, and states whether the durable record landed.
- **The lane's final message** is instructed by both product surfaces: the `pm` agent definition's `pr_creation` step and one sentence in the built lifecycle prompt. The message must name the pull request URL and the push outcome; on a refusal it must name the cause and must not state or imply that the branch is on the remote; when the record did not land it must say the push landed and its record did not. The lane does not retry, does not force, does not author a commit to make the push succeed, and does not reopen a phase: the act's remedy is the engine's reconciliation, an operator, or the next dispatch.
- **The attempt record** carries the folded references of F-3 at the next classification, which is the durable record an operator reads in the attempts digest.
- **The cause vocabulary is closed** (F-1, DM-4): `protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified`. The first four are the ticket's named classes (a protected branch, a changed remote, a missing permission), the next three are the delivered seams' own non-success shapes, and `unclassified` is the honest fallback that still names a refusal as a refusal. These tokens name the seam's own refusal, the arm recorded as `failed` with a lane-push record; the command's pre-act resolution refusal names the observed branch and writes no record (F-1, AC-F1-2). The classification is produced inside the delivered push seam from git's own bounded failure text; the raw text never leaves the seam.

**F-5 — Visibility on `dispatch status`.** `dispatch status <ref>` gains one additive optional fact:

- **The fact.** Carried verbatim from the newest lane-push record whose attempt identity equals the addressed lane's attempt identity: the verdict, the branch, the head, and the recorded instant, plus the cause when the verdict is `failed`. Absent when no such record stands, when the addressed reference has no lane, and when the record belongs to another attempt.
- **Read posture.** The fact costs at most one additional bounded record read of the lane-push family. The query still makes no network call, starts no process, acquires no fence, appends nothing, and deletes nothing. The delivered members and lines stay byte-identical when the fact is absent.
- **What the answer means.** It is a recorded snapshot: the lane's last push was accepted for head H at instant T, or refused with cause C at instant T. It is not a live remote-equality claim, and it does not read the local branch. Because the push is the lifecycle's last act, the recorded head is the branch head at that instant; a commit landed after the record makes the fact older than the branch, and the recorded instant is the disclosure that keeps the answer honest.

**F-6 — Declared divergence, bounded residual.** The session-side push is a product surface, not a typed-lane-only convention: the command is part of the prompt-required composition, and the `pm` agent definition instructs it, so a shell-lane session that runs the same agent with the installed binary performs the same act. The evidence fold into the attempt record and the `dispatch status` fact are typed dispatch surfaces; the bash wrappers' own bookkeeping reads neither. The wrappers' own push behavior is unchanged. The residual is declared, not silent: a lane that runs no `pr_creation` step (a custom prompt, or a harness running no `pm` agent) performs no session-side push, and for it the merge bar plus the engine's ensure-push remain the only backstops (RSK-5).

## 6. USER & SYSTEM FLOWS

```
Flow 1: The defect case, closed — the lane pushes and no wrapper classifies
  Session runs phases 1..10; pr-manager creates the PR (its own pre-PR push lands)
    → lane records the PR URL as a pm-notes note, landed by the commit primitive
    → `phase complete <ref> pr_creation` lands the phase completion commit
    → lane runs `push <ref>`
        → branch resolved (declaration + convention agree, exactly one match)
        → one fast-forward push of the branch head through the delivered seam
        → git exit 0 → verdict pushed
        → one `dispatch.lane-push` record: pushed, head, branch, attempt identity, instant
    → lane's final message names the PR URL and that the branch head is pushed
    → wrapper is gone: no classification, no attempt record — and nothing is stranded

Flow 2: Wrapper alive — the second push is a no-op, not an error
  ... lane pushed (Flow 1) → dispatch collection resolves → derivation reaches arm 8
    → parity read: local head == PR head → no engine act at all → `push:clean`
    → classified pr-open, exit 0; the attempt carries the folded `lane-push:pushed`
  ... or a wrapper push runs first: `git push` on an equal branch exits 0 → accepted

Flow 3: Refused push
  ... lane runs `push <ref>` → the transport refuses (protected branch / changed remote /
      missing permission / timeout / spawn failure)
    → verdict failed, one closed cause, one `dispatch.lane-push` record appended
    → the command's answer names the cause; exit 1; no commit authored, no retry, no force
    → the lane's final message names the PR URL and states the branch push was refused
      with that cause
    → at the next classification the engine folds `lane-push:failed` and
      `lane-push-cause:<cause>` into the attempt's reserved evidence; its own ensure-push
      either reconciles parity (pr-open) or types the delivered push-failure row (failed)

Flow 4: An operator asks without comparing heads
  Operator runs `dispatch status <ref>`
    → one bounded lane read, one bounded park read, one bounded lane-push read
    → the answer carries lanePush.verdict / branch / head / recordedAt (and cause)
    → no network call, no process start, no fence, no append

Flow 5: A resume after a refusal
  Operator or the lane resumes the recorded lane → completed phases skipped
    → pr_creation runs again: the push is attempted once more (one act, no suppression)
    → a success overwrites nothing (append-only): the newest record is the new verdict
    → the classification fold reads the newest matching record only
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The prompt-required typed push command and its composition, help, reference page, and coverage-inventory entry.
- Branch resolution: the change record's `branch:` declaration cross-checked with the delivered convention branch read, with refusal rather than guessing.
- The durable `dispatch.lane-push` record kind, its append by the push command, and its bounded read.
- The fold of the newest matching lane-push record into the attempt's reserved evidence references (`lane-push:<verdict>`, `lane-push-cause:<cause>`).
- The closed refusal-cause vocabulary produced inside the delivered push seam, with `unclassified` as the fallback.
- The additive optional `lanePush` fact on `dispatch status` and its human rendering.
- The `pr_creation` sequence and the lane's final-message contract, carried by the `pm` agent definition and one sentence in the built lifecycle prompt, each with its own assertion.
- The declared fallback divergence and its residual.
- Documentation reconciliation: the dispatch-engine feature page (derivation arm 8's cross-reference, the attempt-record evidence, the operator lane view and its read posture, the record-kind inventory), the quality-gates/PR page (`pr_creation` tail), the delivery-lifecycle page (`pr_creation`), the agents-and-commands page (the new command), the CLI entrypoint/help page, the engine-first operations guide, and the dispatch-engine test-spec coverage map.
- The companion decision record amending TDR-0076's push ownership.
- The standing lockstep changeset: five fixed-group packages, all minor, added before the first gate run.

### 7.2 Out of Scope

- [OUT] Force pushes, history rewrites, `--force-with-lease`, or any ref other than the change branch's configured upstream.
- [OUT] Any new result token, error identity, error-table row, corroboration source, comparison reason, derivation arm, or attempt-record field.
- [OUT] Any change to the `dispatch <ref>` machine envelope (the GH-386 `push` block stays the parity block) or to the four-key text contract.
- [OUT] Removal, reordering, or narrowing of the PR-creation workflow's pre-PR push, the engine's ensure-push, or the bash wrappers' pushes.
- [OUT] Any merge capability, merge port, or merge decision change.
- [OUT] Credential provisioning, storage, or a new transport; non-git transports are not added.
- [OUT] A retry ladder, an automatic re-push, or an in-lane repair of a refusal.
- [OUT] Authoring or amending a commit so that a push succeeds.
- [OUT] A pm-notes schema change (the `branch:` declaration stays opaque and optional).
- [OUT] Changes to the bash wrappers' behavior or their retirement.
- [OUT] A fourth corroboration source, or any change to the closed corroboration requirement map.
- [OUT] Cloud or hosted concerns of any kind.

### 7.3 Deferred / Maybe-Later

- A worktree-cleanliness precondition at the push, so a dirty tree is named (uncommitted work would otherwise be left behind while the branch head is pushed).
- Refining the cause classification (for example separating a changed remote address from a moved remote branch) if operator evidence shows `unclassified` or one class dominating.
- Carrying the remote head the transport reports, if the transport ever exposes it beyond exit status, so the fact becomes an equality rather than a recorded act.
- Surfacing the lane-push fact on `lanes` and `board`; today only `dispatch status` carries it.
- Teaching the bash wrappers' bookkeeping to read the typed evidence.
- A bounded local head read on the operator surface (it would need the posture to admit one process start per query).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 CLI Surface (no HTTP endpoints change)

No HTTP or REST surface is added or changed. The change adds one prompt-required CLI command and one additive member on an existing query:

| Invocation | Purpose |
|---|---|
| `push <ref>` | Push the change branch's head fast-forward to its configured upstream exactly once, append the durable lane-push record, and answer the verdict, the branch, the head, the cause on a refusal, and whether the record landed. |

- **Grammar.** Exactly one positional, the work-item reference. A missing, empty, or malformed reference is `input.value.rejected` before any branch read, act, or append; an undeclared flag is the delivered `fallback.invocation`.
- **Answer (machine).** `ref`, `repository`, and one bounded `lanePush` object: `verdict` over `pushed | failed`, `branch`, `head` (full-hex), `cause` (present exactly when `failed`, over the closed DM-4 set), `recorded` (whether the durable append landed), and `recordedAt` (present exactly when `recorded`).
- **Answer (human).** One key=value block over the same facts, bounded to 16 lines and 2 KiB: `ref`, `repository`, `lanePush`, `branch`, `head`, `cause` (only when present), `recorded`, `recordedAt` (only when present).
- **Exits.** `0` exactly when the verdict is `pushed` (already-up-to-date included), `1` for a refused act; a refusal is a data-bearing answer with no top-level error identity, matching the delivered lifecycle push-failure shape. Grammar refusals use the standard error envelope with the delivered `input.value.rejected` row.
- **`dispatch status <ref>`** gains the additive optional `lanePush` fact described in F-5 and DM-3; every delivered member and line is unchanged when it is absent.
- **Documentation of the command.** The command's reference page belongs to the current milestone's command-page root, not a frozen earlier-milestone snapshot root; the coverage inventory records the page so the help/guide coverage check and the reference-page parity pins pass unchanged in shape. The page carries the command's `--help`/`--version` sections like every prompt-required command.

### 8.2 Events / Messages

One durable record kind is added to the state layer's append-only set; no event-taxonomy kind, no message, and no control-protocol frame is added.

| Kind | Key | Appended by | Fold |
|---|---|---|---|
| `dispatch.lane-push` (`delivery.dispatch.lane-push.v1`) | `dispatch.lane-pushes:<ref>` | the push command, once per invocation, under the store fence | latest-wins per reference; the newest record whose attempt identity equals the reader's attempt is the fact |

The record is append-only, never rewritten, and replayed reads are the same reads. It carries no prompt, transcript, diff, remote URL, stderr, credential, or provider payload. A store fence that cannot be taken in one bounded attempt is answered as `recorded: false` (the act already happened); the command does not retry the act and does not push twice.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `dispatch.lane-push` record payload | Bounded members: schema, ref, repository, branch, head (full-hex), verdict (`pushed` \| `failed`), cause (present iff `failed`), attemptId and sessionId (present when the lane record was readable at push time), recordedAt. Identifiers and SHAs only; whole payload ≤ 512 UTF-8 bytes |
| DM-2 | `lane-push:<verdict>` and `lane-push-cause:<cause>` evidence references | Bounded identifiers in the delivered evidence-reference family; `lane-push:pushed` on acceptance, `lane-push:failed` plus `lane-push-cause:<cause>` on refusal; reserved ahead of the evidence slice; five delivered reserved references plus at most two new ones, so at most seven of the 16-reference budget (code truth: `packages/core/src/app/dispatch.ts`, the reserved disclosure block ahead of the slice) |
| DM-3 | Additive optional `lanePush` fact on the `dispatch status` payload | `verdict`, `branch`, `head`, `cause?`, `recordedAt`, carried verbatim from the newest matching lane-push record; absent when none stands; rendered as additive human lines only when present |
| DM-4 | Closed refusal-cause vocabulary on the delivered push seam's `detail` member | `protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified`; `detail` keeps its type and becomes the closed cause token instead of an exit-code string; the outcome union (`accepted \| rejected \| failed \| timed-out`) is unchanged. `protected-ref` is the delivered literal — the same token the closeout ref guard already uses — so no delivered string changes. These tokens name the seam's own recorded rejection or classification (verdict `failed`, record appended), not the command's pre-act resolution refusal (no act, no record — F-1, AC-F1-2), and the two arms answer different questions |
| DM-5 | The `push <ref>` command contract | One positional reference; the answer keys of §8.1; exits 0/1; no new error identity |

### 8.4 External Integrations

- **Git remote (GitHub)**: one fast-forward push of the change branch per lane end, over the checkout's configured upstream with its ambient credential chain, through the delivered seam. This is the change's only external write, and it writes only a head the lane already committed.
- No provider read is added: the lane-side act never reads the pull request. The parity read remains the engine's, unchanged.

### 8.5 Backward Compatibility

- The new command is additive; the prompt-required composition grows by one command, so the help inventory, coverage inventory, reference-page parity pins, and the reference-page set each grow by one, all in this change.
- The lane-push record kind is additive and append-only. Pre-change state stores hold no such record: every reader answers classified absence, fabricates nothing, and reads byte-identically to today.
- The attempt record's schema is unchanged; pre-change attempts carry no `lane-push:` references and read unchanged.
- `dispatch status` is byte-identical when the fact is absent (the GH-413 delivery precedent for additive optional members).
- Behavior widens only where it was broken: a lane that previously stopped with an unpushed evidence commit now pushes it, and a refusal that was previously silent is now reported. No classification changes for a branch whose head is already on the remote.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Act boundedness | Exactly one push child process per invocation; fixed argv naming only the change branch; literal non-shell spawn; injectable 60 000 ms budget with no new configuration key; one attempt, no retry; fast-forward only; no force-capable variant |
| NFR-2 | Added cost per lane end | At most one bounded branch read, one bounded lane read, one push (≤ 60 000 ms), and one record append; classification adds at most one bounded record read; added provider reads: 0 |
| NFR-3 | Operator-surface posture | Per `dispatch status` answer: 0 network calls, 0 process starts, 0 fence acquisitions, 0 appends, 0 deletions; at most one bounded lane read, one bounded park-record read, one bounded lane-push-record read, and one bounded artifact or transcript read |
| NFR-4 | Output stability | `dispatch <ref>` text mode byte-identical (four keys); its machine envelope unchanged; `dispatch status` delivered members and lines byte-identical when `lanePush` is absent; the push command's human form ≤ 16 lines and ≤ 2 KiB, its machine form within the standard envelope bound |
| NFR-5 | Evidence integrity | At most seven references reserved ahead of the slice (five delivered — `lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, `push:<verdict>` — plus at most two new lane-push references); the 16-reference budget intact under a full slice; the record payload ≤ 512 UTF-8 bytes, single-line fields, identifiers and full-hex SHAs only |
| NFR-6 | No-shell invariant | The new command and the push seam stay inside the declared static no-shell surface set: zero script-path literals, zero `shell: true`, fixed argv only |
| NFR-7 | Deterministic resolution | Exactly one branch-resolution rule; every unresolvable state is a named refusal; no convention-level guess, no current-checkout fallback that names a ref the record does not |
| NFR-8 | Bound on the added reads at classification | At most one lane-push read per classification; an unreadable store contributes zero references and never blocks classification |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The durable lane-push record is the lane-side telemetry: verdict, branch, head, cause, attempt identity, and instant, in one bounded append per act.
- The attempt's `lane-push:` references make the lane's own act visible in the attempts digest beside the engine's `push:<verdict>` parity evidence, so an operator can tell which act produced which fact.
- `dispatch status` answers the same fact without reading git or the network.
- The refusal cause classes are countable from the record set; no new metric surface, log stream, or alert is introduced, and the dual-run coverage counting is unchanged (no new failure class and no new token).
- A refused act is never silent: it has an answer, a record, a folded reference, and a final message.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The lane's push, a wrapper's push, and the engine's ensure-push interleave on the same branch | L | M | Every act is fast-forward-only and single-attempt; a losing interleave is a named rejection recorded as `failed`; the engine's own ensure-push re-reads parity and either reconciles or types the delivered failure; no force exists to corrupt history | L — one redundant rejected act at worst |
| RSK-2 | The recorded fact goes stale: a commit lands after the push, so the recorded head is no longer the branch head | M | L | The push is the lifecycle's last act, so this needs a post-`pr_creation` commit; the record carries its instant and the status answer states a recorded snapshot, not a live equality; a stale fact is disclosed rather than asserted as current | L |
| RSK-3 | The fold attributes a push to the wrong attempt, or to a lane that never pushed | M | L | The record is bound to the attempt identity read from the durable lane record at push time; the fold matches on equality only; no match, an unreadable store, and a foreign-attempt record each contribute nothing | L |
| RSK-4 | The cause classification misfires on git's wording, a locale change, or a provider-specific message | L | M | The cause is reporting-only and nothing branches on it; a closed set with `unclassified` as the honest fallback; patterns live in one declared place and a drift is a bounded defect, not a behavior change | M — a wrong label, never a wrong push |
| RSK-5 | A lane whose harness runs no `pr_creation` step performs no session-side push | M | M | Both product surfaces (the agent definition and the built prompt) instruct the step; the typed lane runs `pm`; the merge bar and the engine's ensure-push remain the backstops; the residual is declared in the feature pages | M — declared, not closed |
| RSK-6 | The push is accepted but the record append fails, so status and the attempt lack the fact | L | L | Act-then-append ordering (never the reverse); the answer discloses `recorded: false`; the lane's message names it; the delivered `push:clean`/`push:pushed` parity evidence still appears at classification | L |
| RSK-7 | A new prompt-required command drifts the help inventory, coverage inventory, reference pages, or the prompt-required composition | L | M | The coverage check, the reference-page parity pins, the entrypoint restriction, and the prompt-conformance scan are updated in the same change and gate the merge | L |
| RSK-8 | Two push vocabularies (`lane-push:` versus `push:`) confuse an operator reading the digest | L | M | Distinct prefixes, distinct meanings stated in the feature page, the glossary, and the operations guide; `dispatch status` carries only the lane fact | L |
| RSK-9 | A session-side push executes from a checkout that is not the lane's worktree (a manual run in the main checkout) and pushes the wrong head | M | L | Structural resolution refuses an unresolvable or contested branch name (declaration/convention disagreement, no match, more than one match, an unsafe name, a protected name); it refuses a ref, never a checkout state. The delivered seam then pushes the invocation checkout's `HEAD` to the resolved branch ref, so a checkout that resolves the branch while holding a different `HEAD` pushes that head. The operational rule is therefore that `pr_creation` runs in the lane's worktree, which is where the lifecycle already runs every command, and the recorded head names what was actually pushed | M — the act detects nothing: a checkout whose head diverges from the branch is rejected by the fast-forward rule, while one whose head fast-forwards the branch is pushed and recorded as `pushed` with its head named; the worktree rule is the guard, not a refusal |

## 12. ASSUMPTIONS

- The `pm` agent runs inside the lane's checkout with the installed binary reachable, which is how every delivered lifecycle command (`phase`, `commit`, `verify`) is already invoked.
- For a dispatch-provisioned lane the delivery branch is checked out in the lane's worktree, so the pushed `HEAD` is the lane's head; a lane running in the main checkout pushes that checkout's `HEAD` to the branch ref it resolved. Resolution refuses an unresolvable or contested branch name, never a checkout state: a checkout where the resolved branch exists but is not checked out resolves successfully and pushes its own `HEAD`, which is why `pr_creation` is assumed to run in the lane's worktree.
- The checkout's ambient git credential chain can push the change branch — the same boundary the delivered engine-side push already relies on.
- An accepted fast-forward push means the remote branch head equals the pushed local head (git's own guarantee), so the lane-side act needs no parity re-read to claim "pushed"; the parity re-read stays the engine's.
- The state store is writable from the lane's command, as it already is for phase transitions and capsule events.
- The change record's `branch:` declaration, when present, names the lane's branch; several delivered change records omit it, which is exactly why the convention read is the structural second source and a disagreement is a refusal.
- The five fixed-group packages are the lockstep changeset set, all minor.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered adapters push seam and its act contract | Reused unchanged except for the closed cause vocabulary on its `detail` member; no second git path |
| Depends on | Delivered durable lane record | Supplies the attempt identity the lane-push record is bound to |
| Depends on | Delivered state store, fence, and bounded verified read | Home of the new append-only record kind |
| Depends on | Delivered local branch reads and the branch convention selection | Structural branch resolution with `none`/`unique`/`ambiguous` semantics |
| Depends on | Delivered pm-notes read | Supplies the change record's `branch:` declaration |
| Depends on | Delivered operator surface and the additive `park` precedent | The read-count and additive-member pattern the status fact follows |
| Depends on | Delivered lifecycle prompt builder and the `pm` agent definition | The two product surfaces that carry the instruction |
| Depends on | Delivered prompt-required composition, help inventory, and coverage guards | The new command must be composed, documented, and counted |
| Depends on | TDR-0076 and the companion decision record | This change amends the record's push-ownership boundary; the new record is authored within the change |
| Blocks | Head-equal lane ends on the typed lane | The ticket's whole point: no lane stops with its own evidence local |
| Blocks | The M4 evidence bar's confidence in `pr-open`/`merged` claims | A recorded lane push is one of the facts an operator and the merged artifact now share |

## 14. OPEN QUESTIONS

None. The owner's comment states that no scope is added or removed, the four behaviours and three acceptance criteria are complete, and the mechanism is the specification's design job. Four readings were needed where the ticket's wording meets the delivered posture, and they are declared here rather than carried as questions:

- **"`dispatch status` says whether the branch head is on the remote"** meets the operator surface's declared "makes no network call", "starts no process", and bounded-read posture. Adopted reading: the answer is the lane's recorded push (verdict, head, instant, cause) — the fact the surface can answer truthfully without a network call — and it is stated as a recorded snapshot, not a live equality (DEC-3, F-5). A live equality would require a network read or a local process start, each of which the posture forbids.
- **"Named in the attempt record"** meets the fact that the attempt is engine-written at classification and the wrapper may be dead. Adopted reading: the lane records a durable fact and the classification folds it into the attempt's bounded evidence; a lane whose wrapper never classifies leaves the durable fact for the next classification and for `dispatch status` (DEC-2, F-3). When no classification ever follows, the attempt record does not exist — the record and the status fact are then the honest evidence.
- **"Resolve the branch from the pm-notes `branch:` declaration"** meets code truth: `branch:` is an optional, opaque top-level key in the delivered pm-notes vocabulary, absent from several delivered change records, so it cannot be the only source. Adopted reading: the declaration and the delivered convention branch read are cross-checked, exactly one agreement is a resolution, and every other state is a named refusal (F-1, NFR-7).
- **"After it records the pull request in the pm-notes"** meets the delivered `pr_creation` order, where the phase completion commit is landed by `phase complete` *after* the URL note. Adopted reading: the push follows the phase completion commit, so that commit — the lane's actual last commit — is the one pushed; pushing after the URL note but before the phase completion would reintroduce the exact defect one commit later (DEC-6).

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The session-side push is a new prompt-required typed command (`push <ref>`) that is thin over the delivered adapters push seam, resolves the change branch from the change record's `branch:` declaration cross-checked with the delivered convention branch read, and performs one fast-forward act in the invocation's own checkout | Rejected: **extending `phase complete`** — it would make the only schema-validated phase-state write path perform a network write and couple a state invariant to remote availability, so a refused push would entangle phase state with transport state; **a prompt-only instruction to `@pr-manager`** — its delivered push runs before PR creation and structurally cannot push commits that land after it, and a prompt-only act has no injectable transport, so AC-1/AC-3 could not be fixture-driven; **a second git implementation inside the command** — it would duplicate the seam's fixed argv, ff-only, single-attempt, bounded-timeout contract; **`dispatch push` under the engine family** — the session is not the engine, and the engine family is the classification authority. Consequence: the command joins the prompt-required composition as the twenty-ninth command, so the help inventory, coverage inventory, reference page, reference-page parity pins, and the agent/prompt surfaces grow by one each | 2026-11-27 |
| DEC-2 | A refused (and an accepted) session-side push reaches the attempt record through one new append-only durable record kind (`dispatch.lane-push`), which the classification reads once and folds into the attempt's reserved evidence references as `lane-push:<verdict>` and, on refusal, `lane-push-cause:<cause>` | Rejected: **deriving from the lane's final message** — the transcript read is untyped prose and is a declared capability gap on one harness, and it is not a store the classification reads; **deriving from pm-notes** — free-text notes, untyped, and a change-folder artifact the status surface does not read; **writing the attempt from the session** — the engine appends exactly one attempt at classification, so a session writer would break the one-record invariant and risk a double append on resume; **overloading the delivered `push:<verdict>` family** — that family is the engine's parity verdict, and conflating the two acts would make the digest unable to say which act produced a fact. **Named growth, declared: exactly one durable record kind**, because every existing durable fact is either engine-written at classification (attempt, terminal lane) or a pause/lease fact (park, lease), and none can carry a session-authored push outcome; the delivered vocabulary has no other home for it | 2026-11-27 |
| DEC-3 | `dispatch status` learns the fact from the recorded lane-push record — one additional bounded record read — and never from a network read or a local head read; the answer is a recorded snapshot carrying the verdict, head, cause, and instant, and the human form renders it as additive lines | Rejected: **a bounded remote head read** — it breaks the surface's declared "makes no network call" posture and adds a credential-dependent read to a read-only query; **a local branch-head read** — it starts a process and adds a read class, and it still cannot compare against a remote without the network; **reading the transcript** — a declared capability gap on one harness and untyped. **Declared consequence: the status read count widens from one lane read plus one additional record read to one lane read plus at most two additional record reads (park, lane-push)**, still with zero network calls, zero process starts, zero fences, zero appends, and zero deletions; phase 7 must reconcile the operator-surface posture clause with that count in exactly those words | 2026-11-27 |
| DEC-4 | The refusal cause is a closed vocabulary (`protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified`) produced inside the delivered push seam from git's bounded failure text, and the seam's `detail` member carries that cause token instead of an exit-code string. The protected token keeps the delivered literal `protected-ref`, the same token the closeout ref guard already uses, so neither the seam's string nor the closeout vocabulary changes | Rejected: **forwarding a stderr excerpt** — unbounded prose that can carry a remote URL or credential-bearing text, against the identifiers-only evidence rule; **a second git invocation to classify** — it duplicates the act and can disagree with the act's own result; **exit-code-only naming** — it cannot express the ticket's three named causes (a protected branch, a changed remote, a missing permission); **renaming the delivered `protected-ref` detail to match a new cause name** — it changes a delivered string and the vocabulary the closeout ref guard already publishes, for no behavioral gain. Consequence: both producers (the engine's ensure-push and the lane's command) name a cause; the engine's classification ignores it, so its behavior is unchanged | 2026-11-27 |
| DEC-5 | No classification-vocabulary growth: the delivered lifecycle push-failure row (`failed` / `failed` / exit 1 / `push-parity-unmet`) remains the only classification consequence of a branch head that is not on the remote; a recorded lane-push refusal is a disclosure | The engine already evaluates the same branch at classification; if parity fails it types the delivered failure, and if parity holds the evidence is genuinely on the remote and a failure would be a lie. A new row, token, identity, or corroboration source would duplicate a delivered, evaluated truth and count the same class twice | 2026-11-27 |
| DEC-6 | The `pr_creation` sequence is: pr-manager creates/updates the PR → the PM records the PR URL as a pm-notes note landed by the commit primitive → `phase complete <ref> pr_creation` lands the phase completion commit → `push <ref>` → the final message names the PR URL and the push outcome → STOP. The instruction reaches the lane through the `pm` agent definition's `pr_creation` step and one sentence in the built lifecycle prompt, with no new prompt section marker | Rejected: **pushing before the phase completion** — it leaves the phase commit local, which is the defect one commit later; **pushing before the URL note** — it leaves the URL record local, losing the PR reference from the merged artifact; **treating a refusal as a phase failure to reopen** — there is no in-lane repair, and reopening a phase would misreport a transport refusal as a workflow regression. The honesty rule: the completion claim and the push are never inverted, a refusal is reported with its cause, and the lane never claims the branch is on the remote | 2026-11-27 |
| DEC-7 | A decision record is required and is an expected artifact of the plan: one new record amending TDR-0076's push ownership — its "session-side push convention unchanged" boundary, its engine-first framing, and the one-record-kind growth — authored through `@decision-advisor` within the change | The delivered record authorizes the engine's first remote write and explicitly declares session-side push untouched; this change makes the session-side act a typed product surface and adds a durable record kind, which is a boundary change the record itself says reopens it (a second remote-write seam and a lane-side evidence fact). Authoring it inside the change keeps authority, code, and record in one reviewable unit | 2026-11-27 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Prompt-required CLI composition | Updated — one new command, its help page, its reference page, the coverage inventory, and the entrypoint restriction |
| Push seam (adapters git) | Updated — the closed refusal-cause vocabulary on `detail`; the argv, timeout, attempt, and outcome union unchanged |
| Dispatch contracts | Updated — the lane-push payload and its closed verdict/cause vocabularies; the status fact shape |
| Dispatch classification | Updated — one bounded lane-push read and the reserved evidence references; no derivation, token, or comparison change |
| Operator surface (`dispatch status`) | Updated — additive optional `lanePush` fact and human lines; the read count widens by one bounded record read |
| State layer | Updated — one new append-only record kind and key prefix |
| Delivery lifecycle prompt (built) | Updated — one sentence naming the `pr_creation` push and its reporting rule; the five markers unchanged |
| `pm` agent definition | Updated — step 10 gains the push step and the final-message rule |
| Quality-gates/PR and delivery-lifecycle feature pages | Updated — the `pr_creation` tail's push ownership |
| Dispatch-engine feature page and test-spec coverage map | Updated — derivation arm 8's cross-reference, attempt evidence, operator lane view, record-kind inventory |
| Bash wrappers | Unchanged — behavior, push conventions, and retirement status |
| Changesets | Updated — standing lockstep invariant: five fixed-group packages, all minor |
| Decision records | New — one record amending TDR-0076's push ownership |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a change whose lifecycle reaches `pr_creation`, a composed push transport (injected in the fixture) that accepts a fast-forward push, and no wrapper alive so no dispatch classification ever runs, **when** the lane records the PR URL, lands the phase completion commit, and runs the push, **then** the transport's branch head equals the lane's branch head at the moment the session ends, exactly one push act was performed for that head, and no commit was authored or amended by the act | F-1, DM-1, DM-5, NFR-1 |
| AC-F1-2 | **Given** a change record whose `branch:` declaration and the convention branch read disagree, or a convention read that matches no branch or more than one, or a uniquely resolved branch name that fails the safe-ref guard or names a ref in the seam's protected set, **when** the push runs, **then** it refuses with a typed input refusal naming the observed state, performs no act, appends no record, and never pushes a guessed, ambiguous, unsafe, or protected ref | F-1, NFR-7 |
| AC-F2-1 | **Given** a branch whose head is already on the remote (a wrapper pushed first, or the lane pushed once), **when** a push runs again and when the dispatch classifies at the `pr-open` arm, **then** the repeat act is accepted with no error (already-up-to-date is not a failure), the classification derives `pr-open` from the parity equality with zero engine push invocations and `push:clean` evidence, and no delivered push path (PR-creation workflow, engine ensure-push, bash wrappers) was removed, reordered, or turned into an error | F-2, NFR-1 |
| AC-F3-1 | **Given** a refused push (a rejection with a cause, a timeout, or a spawn-level failure) recorded by the lane's push, **when** the dispatch reaches terminal classification for that attempt, **then** the attempt record carries `lane-push:failed` and `lane-push-cause:<cause>` in its reserved-ahead-of-slice evidence references beside the delivered disclosures, inside the 16-reference budget, while no new result token, error identity, failure row, comparison reason, corroboration source, derivation arm, or attempt field is introduced; **and** a record whose attempt identity differs, or an unreadable push store, contributes no reference and no fabricated fact | F-3, DM-1, DM-2, NFR-5, NFR-8 |
| AC-F4-1 | **Given** a composed transport that refuses the push with a named cause, **when** the lane runs the push at `pr_creation` and finishes, **then** the command's answer names the cause, the lane's final message names the pull request URL and states that the branch push was refused with that cause (and, when the record did not land, that the push landed without its record), the message does not claim the branch is on the remote, and the attempt record for the classifying dispatch carries the same cause per AC-F3-1 | F-4, F-3, DM-1, DM-4 |
| AC-F5-1 | **Given** a lane whose newest matching lane-push record is `pushed` (or `failed` with a cause) for a head, **when** `dispatch status <ref>` answers, **then** the answer carries the additive `lanePush` fact (verdict, branch, head, recordedAt, cause when failed) carried verbatim from the record, the human form renders the additive lines only when the fact is present, every delivered member and line is byte-identical when it is absent, and the query makes no network call, starts no process, takes no fence, appends nothing, and takes at most one additional bounded record read | F-5, DM-3, NFR-3, NFR-4 |
| AC-F6-1 | **Given** the shipped bash wrappers, the delivered engine-side ensure-push, and the new command, **when** the documentation reconciliation lands, **then** the dispatch-engine, quality-gates/PR, delivery-lifecycle, and agents-and-commands pages and the operations guide declare that the session-side push is a product surface reachable from typed and shell lanes, that the evidence fold and the status fact are typed dispatch surfaces, that the wrappers' own push behavior and the engine's backstop are unchanged, and that a lane running no `pr_creation` step keeps the merge bar as its backstop | F-6 |

Ticket traceability: ticket AC-1 (PR head equals branch head with no wrapper alive, fixture with an injected transport) → AC-F1-1; ticket AC-2 (wrapper alive, second push is a no-op and reports no error) → AC-F2-1; ticket AC-3 (a refused push is named in the lane's last message and in the attempt record, fixture) → AC-F4-1 with AC-F3-1; ticket requirement 4 (`dispatch status` says whether the branch head is on the remote) → AC-F5-1; requirement 1's "nothing is authored or amended" → AC-F1-1; requirement 1's "pushes the branch" resolution rule → AC-F1-2; requirement 2's "wrapper's push stays" → AC-F2-1; NG-5's amendment of GH-386's NG-3 → AC-F6-1.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full 11-phase lifecycle on the change branch; commits through the commit primitive; gate evidence uses `TMPDIR=$PWD/tmp/tmpdir`; the PR targets `main-tools` and stops open.
- The lockstep changeset (five fixed-group packages, all minor) is added before the first gate run, because the change edits `packages/` and a release check fails a packages change with no changeset.
- Tests affected by the change are run while working; the full battery runs once, at the gate. The commit-range gate runs before the PR.
- The companion decision record (amending TDR-0076) is authored through `@decision-advisor` within the change and lands with it.
- In-merge gate: the AC-1, AC-2, and AC-3 fixtures plus the status-fact and resolution-refusal arms gate the merge; the dispatch-engine test-spec coverage map is reconciled in the same change.
- Post-merge: the next lanes' PR heads are observed equal to their branch heads with no manual push; a refusal there surfaces in the lane's message, the attempt record, and `dispatch status` rather than as a silent lag. The observation is recorded in the delivering lane's pm-notes.
- No repository flip, no handover record, and no merge-authority change is part of this change.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. All record kinds are append-only and shape-stable. The new lane-push family starts empty: readers answer classified absence, fabricate nothing, and a pre-change store reads byte-identically to today. No backfill, migration, or seeding is required, and no existing record is rewritten.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A. No personal data is introduced. The record carries a work-item reference, a repository identity, a branch name, two full-hex SHAs, a verdict, a closed cause token, and two identifiers — all already present in delivered records or in git's public branch state. Git's own failure text is classified inside the seam and never stored, so a remote URL, a user name in a URL, or a credential fragment cannot reach the record, the answer, the status fact, or the attempt evidence. The command's answer is redacted and bounded by the delivered serialization chokepoint.

## 21. SECURITY REVIEW HIGHLIGHTS

- The act runs the git binary with fixed argv and a literal non-shell child process inside the delivered bounded-timeout seam; the static no-shell invariant's surface set covers it, and no script path or shell is introduced.
- Fast-forward only, one attempt, change branch's configured upstream only: no force-capable variant exists and no other ref can be named. The seam's own safe-ref and protected-ref guards run before any child process starts.
- Credentials are the checkout's ambient git credential chain — the same trust boundary the delivered engine-side push already uses. No credential is resolved, read, or stored by the command, and none enters the record or the answer.
- The record and the answer carry identifiers and SHAs only; git's error text is classified inside the seam and discarded. The evidence-reference family stays identifiers-only.
- The new record kind is written under the store fence by one writer per invocation; it is append-only and never rewritten, so a recorded refusal cannot be erased by a later success (the newest record wins, and its instant is visible).
- `security_impact: low`: one additional write path over an existing credential boundary, with declared bounds, a closed cause vocabulary, and a typed refusal on rejection.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Operators read a refused lane push from three places with one vocabulary: the lane's final message, the attempts digest (`lane-push:failed` plus `lane-push-cause:<cause>`), and `dispatch status`. Diagnosis no longer needs a head comparison or a git command.
- The remedy for a refusal is unchanged in kind: fix the remote state (protection, permission, remote address) and re-run or resume the push, or re-dispatch; the engine's ensure-push still reconciles a pushable branch by itself.
- The record family grows by one append per lane end (typically one record, two on a retried push), bounded in size and never deleted by this change; retention follows the store's existing ledger discipline.
- The dispatch-engine test-spec coverage map gains the lane-push, cause, fold, status-fact, and resolution-refusal classes so the offline battery remains the contract's proof surface.
- The push seam now names a cause on both of its consumers; a change to the cause vocabulary is a documented contract change, not a test detail.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Lane-push | The lane's own fast-forward push of its change branch at `pr_creation`, performed by the prompt-required `push` command |
| `dispatch.lane-push` | The append-only durable record of one lane-push invocation: verdict, branch, head, closed cause, bound attempt identity, instant |
| Lane-push fact (`lanePush`) | The additive optional member on `dispatch status` carrying the newest matching lane-push record verbatim |
| `lane-push:<verdict>` | The attempt evidence reference recording the lane's own act: `pushed` or `failed`, plus `lane-push-cause:<cause>` on a refusal |
| `push:<verdict>` | The delivered (GH-386) attempt evidence reference recording the engine's parity outcome: `clean`, `pushed`, or `failed` — a different question from the lane's own act |
| Refusal cause | One token from the closed set `protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified` |
| Ensure-push | The delivered engine-side bounded act that reconciles parity at the `pr-open` arm before classification (TDR-0076) |
| Wrapper | The process that started a lane's session (the dispatch invocation, or a bash entry point); it may end before the session does |
| Evidence commit | A commit the lifecycle lands only to record its own state: the pm-notes PR-URL note and the `pr_creation` phase completion |
| Merge bar | The requirement that the local head, the remote head, and the pull request's head are equal before merge |
| Recorded snapshot | A fact stated as of its recorded instant, with no live re-read and no equality claim about a later state |

## 24. APPENDICES

### Appendix A — Code-truth basis for the declared mechanism

- The delivered push seam executes one fixed-argv fast-forward push (the change branch as the single refspec, `HEAD` as the source) with a literal non-shell child, an injectable 60 000 ms budget, and a closed outcome union; its `accepted` outcome covers git exit 0, which includes "Everything up-to-date". Requirement 2 therefore contradicts nothing in the seam and needs a regression pin, not a behavior change.
- No CLI command pushes; the prompt-required set is a closed list composed by the entrypoint and pinned by the help inventory, the coverage inventory, and the reference-page parity assertions, so a new command is a declared, counted surface rather than an incidental one.
- The attempt record is appended once at terminal classification with a reserved-ahead-of-slice evidence set; the engine composes a parity port and folds the parity verdict as `push:<verdict>`, which is the exact pattern the lane-push fold mirrors.
- The reserved disclosure block ahead of the 16-slice holds up to five members today — `lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, and the push parity reference — each emitted before the sliced evidence (`packages/core/src/app/dispatch.ts`, the reserved disclosure block ahead of the slice). The lane-push fold extends that block by at most two, so the never-truncated property survives at seven of sixteen.
- The operator surface's `dispatch status` already reads a second record family for its additive `park` fact, which is the delivered precedent for one further bounded read; the surface declares no network call, no process start, no fence, no append, and no deletion.
- The branch convention and its `none | unique | ambiguous` selection are delivered domain semantics (the closeout and merge families use them), so "refuse rather than guess" is a reuse, not a new rule.
- The change record's `branch:` key is optional and opaque in the delivered pm-notes vocabulary and is absent from several delivered change records; this is why the command cross-checks it against the structural branch read.
- The lifecycle prompt is data built by one pure function with five asserted section markers; the `pm` agent definition carries the per-phase instructions whose step 10 is `pr_creation`. Both are product surfaces, so both carry the new step.
- Session-side push today is a convention with no vocabulary: the PR workflow's push runs before PR creation, the commit primitive never pushes, and the engine's act runs only at classification. The twice-observed strandings are the direct consequence.

### Appendix B — The declared lane-push record (payload shape)

```
dispatch.lane-push  (delivery.dispatch.lane-push.v1)   key: dispatch.lane-pushes:<ref>
  schema:      "delivery.dispatch.lane-push.v1"
  ref:         <work-item reference>
  repository:  <normalized host/owner/name>
  branch:      <change branch>
  head:        <full-hex local head pushed>
  verdict:     pushed | failed
  cause:       <closed cause token>        present iff verdict = failed
  attemptId:   <newest lane record's attempt identity>   present when readable
  sessionId:   <newest lane record's session identity>   present when readable
  recordedAt:  <iso instant>
```

Bounded: identifiers and full-hex SHAs only; whole payload ≤ 512 UTF-8 bytes; append-only; latest-wins per reference and attempt; no stderr, remote URL, diff, prompt, transcript, credential, or provider payload.

### Appendix C — The folded attempt evidence

```
reserved ahead of the evidence slice, beside the delivered five
(lane:append-failed, lease:not-owned, lease:renewal-failed,
 park:recovery-append-failed, push:<verdict>):
  verdict pushed:  lane-push:pushed
  verdict failed:  lane-push:failed  +  lane-push-cause:<cause>

fold rule:  filter to the resolved repository → newest record whose attemptId
            equals the classifying attempt → fold; otherwise fold nothing
budget:     at most 7 reserved references of the 16-reference budget
unchanged:  no token, error identity, failure row, comparison reason,
            corroboration source, derivation arm, or attempt field
```

### Appendix D — The `pr_creation` sequence and the final-message contract

```
1. @pr-manager creates or updates the pull request (its own pre-PR push stays).
2. The PM records the PR URL as a pm-notes note, landed by the commit primitive.
3. phase complete <ref> pr_creation            (lands the phase completion commit)
4. push <ref>                                  (one fast-forward act + one record)
5. The final message names the PR URL and the push outcome, then the lane stops.

Final-message contract:
  accepted   → the branch head is pushed; the head is named when the answer names it
  refused    → the cause is named; the message never claims the branch is on the remote;
               no retry, no force, no authored commit, no phase reopened
  unrecorded → the push landed and its record did not (disclosed, not hidden)
```

### Appendix E — The closed refusal-cause set and the ticket's named classes

| Cause | Named by | Ticket class |
|---|---|---|
| `protected-ref` | the seam's own protected-set guard (the delivered literal, shared with the closeout ref guard), or a protection/hook decline git reports | a protected branch |
| `non-fast-forward` | the remote branch moved; a fast-forward is refused | a changed remote |
| `auth-rejected` | the remote rejects the credential or the permission | a missing permission |
| `remote-unavailable` | the remote or its host cannot be reached, or its address no longer resolves | a changed remote |
| `spawn-failed` | the git binary could not be started | delivered seam shape |
| `timed-out` | the bounded act budget expired | delivered seam shape |
| `unsafe-branch` | the seam's safe-ref guard refused the name | delivered seam shape |
| `unclassified` | a rejection the seam cannot classify — still named as a refusal | honest fallback |

The `protected-ref` and `unsafe-branch` rows describe the seam's own recorded-rejection arm: the verdict is `failed` and a lane-push record is appended. The command's resolution arm refuses the same two conditions before any act, as a typed input refusal with no record (F-1, AC-F1-2); the tokens are not used there.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-27 | @spec-writer (DeepSeek V4.1 Flash 1017) | Initial specification |
| 1.1 | 2026-11-27 | @spec-writer (DeepSeek V4.1 Flash 1017) | Correction pass, no scope change: (1) the reserved-evidence count corrected from "three delivered plus at most two = at most five" to the code truth — five delivered reserved references plus at most two new lane-push references, post-change maximum seven of sixteen — in §2.1, F-3, DM-2, NFR-5, §4.1, Appendix A and Appendix C; (2) the two refusal arms stated once and consistently — the command's pre-act resolution refusal (safe-ref guard and protected-set membership: no act, no record, AC-F1-2) versus the seam's own recorded rejection with the closed `detail` cause (`failed`, record appended, DM-4) — in F-1, DM-4 and AC-F1-2; (3) the protected cause token aligned to the delivered literal `protected-ref` rather than a rename, in DM-4, F-4, DEC-4, the glossary and Appendix E |
| 1.2 | 2026-11-27 | @spec-writer (DeepSeek V4.1 Flash 1017) | Truth correction, no scope change: RSK-9's mitigation no longer claims a refusal that no declared rule produces. Structural resolution refuses a ref, never a checkout state, and the seam pushes the invocation checkout's `HEAD` to the resolved branch ref, so a checkout that resolves the branch while holding a different `HEAD` is not refused. RSK-9 now states those two guarantees, the `pr_creation`-in-the-lane's-worktree operational rule, and an honest residual (a diverging checkout is stopped by the fast-forward rule; a fast-forwarding one is pushed and recorded with its head named). §12's checkout assumption states the same in substance, including the unrelated-checkout case. No refusal rule, acceptance criterion, NFR, or test reference is added |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-416 (body plus the owner delivery comment, which adds no scope), the change's pm-notes (intake, milestone, scope reading, the three reserved design points, the delivery notes), the current-truth dispatch-engine feature page, the delivered contracts (the push verdict family and parity port, the operator status payload and its park fact, the lane record, the pm-notes vocabulary, the push seam), the delivered prompt builder and `pm` agent definition, TDR-0076, the dispatch-engine test specification, and the GH-386 change specification as the closest precedent for section shape and for the style of declared closure.
- Current-state writing throughout: delivered behavior and declared behavior are stated; the twice-observed strandings appear only as motivating context and as the KPI baseline, never as build-to-build history.
- Mechanism declaration was delegated to this spec from code truth: the seam choice (DEC-1), the durable-fact fold (DEC-2), the status derivation (DEC-3), and the cause vocabulary (DEC-4) are each grounded in a delivered seam and each state the rejected alternatives. The one structural growth (a durable record kind) and the one vocabulary growth (two evidence references) are named with their justification, per the closure discipline GH-386 established.
- Every ticket acceptance criterion maps to a numbered criterion and a capability (§17); every required behaviour maps to a capability; each of the four points where the ticket's wording meets a delivered posture is stated as an adopted reading in §14 rather than as a question, because the owner's comment declares the requirements complete.
- No implementation tasks, file paths as instructions, or code-level steps: components and seams are named by their delivered behavior and contract names; fixture mechanics belong to the test plan.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-416)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-6, DM-1..DM-5, NFR-1..NFR-8, RSK-1..RSK-9, DEC-1..DEC-7, AC-F*-*, G-1..G-5, NG-1..NG-11)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] Every ticket acceptance criterion and required behaviour is traceable (§17 traceability line, Appendix C/E)
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability and a residual
- [x] No implementation details in the body (no step-by-step tasks; symbols and delivered contracts only)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules (`milestone` equals the pm-notes milestone verbatim)
- [x] Open questions empty; the four adopted readings are declared in §14
- [x] Declared growth limited to one durable record kind and two evidence references, each justified (DEC-2)
