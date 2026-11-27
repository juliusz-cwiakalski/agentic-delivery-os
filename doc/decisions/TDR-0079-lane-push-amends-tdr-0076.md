---
id: TDR-0079
decision_type: tdr
status: Proposed
created: 2026-11-27
decision_date: null
last_updated: 2026-11-27
summary: "GH-416 DEC-7: the lane, not its wrapper, owns the push of its own last evidence commit. At `pr_creation`, after the pull request URL is recorded and `phase complete <ref> pr_creation` lands the phase completion commit, the lane runs the prompt-required `push <ref>`: one fast-forward push of the change branch through the delivered adapters push seam (fixed argv, literal non-shell child, 60 000 ms injectable budget, one attempt, no force), authoring and amending nothing, followed by one append of a new durable record kind `dispatch.lane-push` (`delivery.dispatch.lane-push.v1`, key `dispatch.lane-pushes:<ref>`, whole payload at most 512 UTF-8 bytes). The dispatch classification reads that record once and folds it into the attempt's reserved evidence as `lane-push:<verdict>` and, on a refusal, `lane-push-cause:<cause>`, beside the five delivered disclosures, so the reserved block holds at most seven of the sixteen-reference budget; `dispatch status` carries the same fact as the additive optional `lanePush` member from one additional bounded record read and no network call, as a recorded snapshot and not a live equality. A refusal is named on three surfaces by a closed eight-token cause vocabulary produced inside the seam, seven recordable and one guard-only. The engine's ensure-push stays the reconciliation backstop and consumes the seam's outcome only, so no cause reaches any engine surface; the classification vocabulary, the failure row, the attempt schema, and the `dispatch <ref>` envelope are unchanged. This amends TDR-0076's push ownership: its session-side push convention becomes a typed product surface, its first remote-write seam gains a second caller whose act runs first in time, and its closed structural growth gains exactly one record kind. TDR-0076 is amended, not superseded, and the `push` family name is recorded here under the naming lock (ODR-0003)."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os delivery lifecycle `pr_creation` tail and dispatch evidence: the lane's own `push` command, the durable `dispatch.lane-push` record, and its fold into the attempt"
decision_scope: repo
review_date: null
business_impact: "A lane whose dispatch wrapper ended before the lane did can no longer stop with the lifecycle's own evidence existing only on the workstation: the reviewed and merged artifact carries the change's evidence from its first CI run, no delivery pays a second CI cycle for a late manual push, and the merge bar (local head, remote head, and pull request head equal) is met without a human. The cost is one bounded push and one bounded record append per lane end."
customer_impact: "An operator reads a refused lane push from three places with one vocabulary: the lane's final message, the attempts digest (`lane-push:failed` with `lane-push-cause:<cause>` beside the engine's `push:<verdict>`), and `dispatch status` (`lanePush` verdict, branch, head, cause, and instant), without comparing heads. The status answer is a recorded snapshot, not a live equality."
classification:
  domains: [dispatch, delivery-lifecycle, git-seams, operations, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-416 DEC-7: the companion record the change specification mandates for the amendment of TDR-0076's push ownership)"
  decider: "Juliusz Ćwiąkalski: human acceptance at the GH-416 pull-request review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-416 clarify-scope and intake: the scope readings, the three reserved design points, and the Definition-of-Ready rulings R1 to R16)"
    - "@spec-writer (GH-416 specification v1.5: DEC-1 to DEC-7, F-1 to F-6, DM-1 to DM-5, NFR-1 to NFR-8, RSK-1 to RSK-10, section 14, and Appendices A to E)"
    - "@readiness-reviewer (GH-416 Definition-of-Ready iterations 1 to 3: the safe-ref predicate's home and the engine's outcome-only consumption)"
    - "@test-plan-writer (GH-416 test plan: the reserved-reference count corrected to code truth and the delivered cause literal)"
    - "@plan-writer (GH-416 plan: phase 7's declared path and findings I-8 and I-9)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@reviewer"
    - "Human owner (GH-416 pull-request review: this record amends a delivered ownership boundary)"
  performers:
    - "@coder (the command, the seam's closed cause, the fold, and the status fact, delivered in plan phases 1 to 5)"
    - "@toolsmith (the `pm` agent definition's step 10, delivered in plan phase 6)"
    - "@doc-syncer (the documentation-phase reconciliation of the dispatch-engine page, the quality-gates page, the operations guide, and the test-spec coverage map)"
  informed:
    - "Operators of native deliveries reading the attempts digest and `dispatch status`"
    - "Future authors proposing a new prompt-required command family (the naming audit in D6)"
    - "Future authors proposing a durable record kind written from a session"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, option-generator, critic, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A second remote-write act is proposed for the lane (a tag, a release publication, a merge from the session). This record authorizes one caller over the one delivered seam for one act; another act is a new decision measured against TDR-0076 D5, not an extension of `push`."
  - "The reserved block's maximum of seven of sixteen is pressed further, or a new disclosure is proposed for the reservation. The fold's two references and the five delivered disclosures are the block's whole budget; an eighth reference re-decides the slice size or the fold."
  - "The cause mix observed on live lanes shows `unclassified` or one class dominating, or a provider's failure wording defeats the classification. The closed vocabulary and its patterns are re-decided; nothing branches on a cause today."
  - "The transcript read is proposed as a source for the lane's push fact, or the session is proposed as a writer of the attempt record. Both were rejected here for reasons that a delivered change in the transcript seam or in the attempt invariant would reopen."
  - "A second durable record kind written from a session is proposed. The one-kind growth is this record's declared maximum; a second kind re-decides whether sessions get a general evidence-record family."
  - "The `push` name is proposed for a rename or for a second meaning (a force-capable variant, a push of another ref, a tag). The naming lock (ODR-0003) requires a superseding decision record plus a code change."
  - "The engine is proposed to consume or surface the seam's cause. C-6 keeps every engine surface cause-free; a cause on the engine's arm is a change to TDR-0076 D3 and this record together."
  - "The operator surface's read posture is widened to admit a network read or a process start, so `lanePush` can become a live equality. The recorded-snapshot reading of D4 is re-decided with it."
links:
  related_changes: ["GH-416"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-27--GH-416--lane-pushes-own-evidence-commit/chg-GH-416-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-delivery-lifecycle.md"
    - "doc/spec/features/feature-quality-gates-and-pr.md"
    - "doc/spec/features/feature-agents-and-commands.md"
    - "doc/guides/engine-first-operations.md"
    - "doc/planning/oss-tooling/cli-command-registry.md"
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/dispatch-operator.ts"
    - "packages/core/src/domain/dispatch-lane-push.ts"
    - "packages/core/src/app/dispatch-lane-push.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/core/src/app/dispatch-lane-view.ts"
    - "packages/adapters/src/git/push.ts"
    - "packages/cli/src/commands/push.ts"
    - "packages/cli/src/output/dispatch-text.ts"
    - "packages/cli/src/help/prompt-required-commands.ts"
  diagrams: []
  decisions: ["TDR-0076", "TDR-0054", "TDR-0058", "TDR-0049", "TDR-0053", "TDR-0055", "TDR-0071", "ODR-0003"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S45"]
---

# TDR-0079: The Lane Pushes Its Own Last Evidence Commit: A Typed `push <ref>` at `pr_creation`, One Durable `dispatch.lane-push` Record, and the Engine's Ensure-Push as the Backstop (TDR-0076 Push Ownership Amended)

> **Traceability.** Change specification v1.5 §15 **DEC-7** (this record's mandate); §1; §2.1; §3; §5.1 F-1 to F-6; §6 Flows 1 to 5; §7.1; §8.1 to §8.5 (DM-1 to DM-5); §9 NFR-1 to NFR-8; §10; §11 RSK-1 to RSK-10; §12; §13; §14 (the four adopted readings); §15 DEC-1 to DEC-6; §16; §17 AC-F1-1 to AC-F6-1; §18; §24 Appendices A to E. Amends **TDR-0076's push ownership in the three places the specification's DEC-7 names: its session-side boundary (the "session-side push convention unchanged" boundary: D4, its summary, and its second Context fact), its engine-first framing (D5 and its first revisit trigger), and its record-kind boundary (C-5 and D3's reserved evidence set), for the lane's own act only**. TDR-0076's parity precondition, act contract, failure row, and `push:<verdict>` evidence stand verbatim (D7).

## Context

- **FACT:** TDR-0076 makes the engine the reconciler of the lane's last push. At the `pr-open` derivation arm the engine reads parity (the local branch head against the open request's head), performs one fast-forward push when the heads differ, re-reads parity once, and classifies `pr-open` only from a readable equality (`packages/cli/src/production.ts:4251-4303`; [TDR-0076](TDR-0076-engine-ensure-push-first-remote-write.md) D1).
- **FACT:** TDR-0076 declares the session side untouched and names its own act the first. Its D4 reads "Session-side conventions are unchanged ... the ensure-push is a reconciliation backstop, not a replacement instruction"; its D5 calls the engine's act "the typed stack's first remote-write operation" and "the pattern future write seams are measured against"; its first revisit trigger says a new write seam "reopens this record rather than inheriting it".
- **FACT:** The engine's act runs only when a dispatch invocation reaches terminal classification. A dispatch wrapper can end for ordinary reasons (an interrupted tool call, a harness restart, a delivery-process restart) while the lane's session continues; then no classification runs, no ensure-push runs, and no attempt record is appended (GH-416 specification §2.1; the strandings the ticket records).
- **FACT:** The evidence commits land after the pull request exists, and the commit primitive never pushes. In the delivered `pr_creation` order the pull request is created first; the PR-URL note and the phase completion commit that `phase complete <ref> pr_creation` lands are local commits until somebody pushes them (`.opencode/agent/pm.md:403-408`; TDR-0076 Context; GH-416 specification §2.1). The pull request's head then lags the branch head by exactly that evidence, the merge bar is unmet, and the divergence is visible only to whoever compares heads.
- **FACT:** One remote-write seam exists, and it is delivered. `createGitPushSeam` performs one non-force push with the fixed argv `git push <resolved push remote> HEAD:refs/heads/<branch>` — one repository argument resolved by one bounded local configuration read (`branch.<branch>.pushRemote`, then `remote.pushDefault`, then `branch.<branch>.remote`, then `origin`; a missing or ambiguous destination is a typed `remote-unavailable` refusal that starts no child), one refspec, no `--ff-only` (git has no such option for `push`), no force flag and no `+` prefix — through a literal non-shell child (`shell: false`), under the injectable `PUSH_DEFAULT_TIMEOUT_MS = 60_000`, in one attempt with no retry and no force-capable variant; its outcome union is `accepted`, `rejected`, `failed`, or `timed-out`, and git exit 0 (already up to date included) is `accepted` (`packages/adapters/src/git/push.ts`).
- **FACT:** The seam's `detail` member carries a closed cause token. The eight tokens are `protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, and `unclassified`; `unsafe-branch` is guard-only (the safe-ref predicate refuses the name before any child starts), and the other seven are recordable child-act causes (`packages/core/src/contracts/dispatch.ts:787-814`; `packages/adapters/src/git/push.ts:203-218`). The cause is classified from git's bounded failure text inside the seam, and the raw text never leaves it (`packages/adapters/src/git/push.ts:103-139`).
- **FACT:** The engine consumes the seam's outcome and discards the cause. The parity act branches on `act.outcome !== "accepted"` and reads no `detail`, so no engine envelope, parity fact, or classification carries a cause (`packages/cli/src/production.ts:4278-4286`). The engine also resolves the change branch through its own read, with no cross-check against any other resolution (`packages/cli/src/production.ts:4255`).
- **FACT:** The attempt record is engine-written at classification, and its reserved block is bounded. Ahead of the evidence slice sit the five delivered disclosures (`lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, and `push:<verdict>`), then the lane-push fold, then the sliced evidence, cut at `DISPATCH_MAX_EVIDENCE_REFS = 16` (`packages/core/src/app/dispatch.ts:1133-1144`; `packages/core/src/contracts/dispatch.ts:636`). The session cannot write the attempt, and a dead wrapper writes nothing at all.
- **FACT:** The lane's act is delivered on this change's branch. `push` is the twenty-ninth and last prompt-required command (`packages/cli/src/help/prompt-required-commands.ts:43-44`); the `pm` agent definition's step 10 orders the phase completion commit, then `push <workItemRef>`, then the final message, then STOP (`.opencode/agent/pm.md:403-418`); the built lifecycle prompt carries one sentence to the same effect (`packages/core/src/domain/dispatch-prompt.ts:58`); and the command registry carries the `push` row (`doc/planning/oss-tooling/cli-command-registry.md:147`).
- **FACT:** The durable record kind, the fold, and the status fact are delivered and proven. `dispatch.lane-push` (`delivery.dispatch.lane-push.v1`, key `dispatch.lane-pushes:<ref>`) is bounded at 512 UTF-8 bytes (`packages/core/src/contracts/dispatch.ts:769-771, 819, 833-834`); the classification folds it through one bounded read (`packages/core/src/app/dispatch.ts:113-122`); `dispatch status` reads it in one additional bounded record read and carries it as the additive optional `lanePush` fact (`packages/core/src/app/dispatch-lane-view.ts:130-145`; `packages/core/src/contracts/dispatch-operator.ts:160, 190`). Run on 2026-11-27 over the fourteen lane-push, engine-arm, status, envelope, and posture suites: 148 pass, 0 fail.
- **FACT:** TDR-0076 is itself `Proposed` with a null decision date on this branch. Its act is nevertheless delivered and is the current truth, which is what this record amends (the standing TDR-0078 holds toward TDR-0050).
- **FACT:** The naming lock governs the new command. ODR-0003 requires each command name to carry one meaning, commands to join an existing family where one fits, and a new family to be added to the registry under the same rules ([ODR-0003](ODR-0003-cli-command-naming-v1-lock.md) C-1 to C-4, DC-3, DC-4, and its second revisit trigger). `install`, `loop`, and `provider` each shipped as a new top-level family.
- **Why now:** GH-416 is the defect fix for the lane that outlives its wrapper, and its specification (DEC-7) routes this record here because the mechanism moves a boundary that TDR-0076 drew around itself. The choice is a technical decision about who performs one delivered act on one caller's path and what durable fact that caller leaves: record type TDR.

## Problem Framing (Clarified)

The question is not "should a push happen before `pr-open`?" TDR-0076 settled that the engine reconciles it, by construction, and that settlement stands. The question is narrower:

> When a lane stops, who has put its own last commit on the remote, and what durable fact exists if the process that would classify is already gone?

First principles: the evidence commit is authored by the session. The push that publishes it is that same act's completion, so ownership of the push belongs to whoever authored the commit, unless a reason exists to separate them. TDR-0076 separated them for a sound reason: enforcement of the `pr-open` claim must not depend on prompt conformance. This record reunites act and ownership for the lane's own commit and leaves TDR-0076's reason intact for the engine (D7).

Three sub-questions decide the mechanism:

1. **Which act covers the dead wrapper?** Only an act that runs inside the session, at the end of the lifecycle, before the session stops. Anything invoked by the wrapper inherits the wrapper's lifetime.
2. **How does a session-authored outcome reach the engine-written attempt record?** The session must leave a durable, bounded fact that the classification reads once and folds in. It must not write the attempt, and the fact must not be read back from prose.
3. **What can an operator read without comparing heads?** A recorded snapshot on the operator surface, taken from the record and from no network call.

Root cause versus symptom. The symptom is a pull request whose head lags the branch by one commit. The cause is that ownership of the last push belongs to a process whose lifetime is shorter than the session's, and that the session side had no typed act to call: TDR-0076 left it as it found it, a convention with no vocabulary (no command pushed, the commit primitive never pushed, and the only typed push was the engine's). Enforcement that depends on the wrapper is enforcement that depends on the wrapper being alive.

Two failure modes, each covering the other's. The engine's act cannot run without a classification; the lane's act cannot be guaranteed by code that a prompt will call it. Neither alone suffices: the engine alone strands the commit when the wrapper dies, and the lane alone strands it when the prompt is not followed. The lane's act runs first in time; the engine's act remains the reconciliation and the backstop.

Deliberately out of scope: TDR-0076's parity precondition, act contract, failure row, and `push:<verdict>` evidence family; the classification vocabulary and the derivation ladder; force pushes and history rewrites; retry ladders; credential resolution, storage, or transport; merge capability and merge authority; the `dispatch <ref>` machine envelope; the bash wrappers' own push behavior and their retirement status; and the safe-ref predicate's three private copies in the git index, merge, and watchdog adapters (GH-416 specification §7.2).

## Constraints (Hard Requirements)

### C-1: The lane's act runs at `pr_creation`, after the phase-completion commit, whatever the wrapper's state

- **Statement:** After the pull request URL is recorded in the pm-notes and `phase complete <ref> pr_creation` lands the phase completion commit, the lane performs exactly one fast-forward push of the change branch's head through the delivered seam. The act stages, commits, amends, resets, and rewrites nothing: it pushes the head that already exists. It depends on no wrapper, no classification, and no engine invocation.
- **Source:** AC (ticket GH-416 behaviour 1 as the specification's DEC-1 and AC-F1-1 cite it; GH-416 G-1, F-1, DM-5, NFR-1, DEC-6)
- **Verification:** test (the ticket's first fixture over a real temporary checkout and a keyed fake remote, with no classification in the run: the transport's branch head equals the lane's head, exactly one act, zero commits authored or amended)
- **Negotiable:** no

### C-2: The engine's ensure-push stays the reconciliation backstop, unchanged

- **Statement:** TDR-0076's act is not removed, reordered, narrowed, or turned into an error. The engine still evaluates parity at the `pr-open` arm, pushes at most once and only when the heads differ, re-reads parity once, and classifies `pr-open` only from a readable equality; its act contract, its additive envelope block, its `push:<verdict>` evidence family, and its failure row (`failed` / `failed` / exit 1, comparison reason `push-parity-unmet`) are unchanged. A lane push that already made the heads equal yields `push:clean` and zero engine push invocations. A recorded lane-push refusal never turns a truthful classification into a failure and never suppresses one.
- **Source:** prior decision (TDR-0076 C-1, C-3, D1 to D3); AC (GH-416 G-2, F-2, F-3, NG-3, NG-4, DEC-5; AC-F2-1, AC-F3-1)
- **Verification:** test (the delivered GH-386 suites as read-only controls with their delivered cells unedited; the equal-heads arm deriving `pr-open` with zero engine push invocations; the disclosure-not-a-claim arms: a truthful `pr-open`, the delivered failure row once, and an unrewritten stale record) + code review
- **Negotiable:** no

### C-3: One act, one seam, no state-write coupling

- **Statement:** The lane's act is the delivered adapters push seam: the fixed argv `git push <resolved push remote> HEAD:refs/heads/<branch>` (one repository argument resolved by one bounded local configuration read, one refspec, no `--ff-only`, no force flag, no `+` prefix), a literal non-shell child process, the 60 000 ms injectable budget with no new configuration key, one attempt with no retry, fast-forward only by never forcing, no force-capable variant. No second push implementation and no shell invocation of git is created. The act is not folded into `phase complete` or `commit`: the schema-validated phase-state write path and the commit primitive stay local-only and never perform a network write.
- **Source:** AC (GH-416 F-1, NFR-1, NFR-6, DEC-1, DEC-6); prior decision (TDR-0076 D4: one new seam, not a general remote-write permission; the commit primitive's never-push rule)
- **Verification:** code review (the command composes the delivered seam; the static no-shell surface set covers the command) + test (argument and attempt-count assertions under the injected runner)
- **Negotiable:** no

### C-4: A refusal is named, never silent after resolution

- **Statement:** A refused act is named in three places with one vocabulary. The command's answer carries the verdict, the branch, the head, one closed cause, and whether the record landed, at exit 1 with no new error identity. The lane's final message names the pull request URL and the push outcome, names the cause on a refusal, and never states or implies that the branch is on the remote. At the next classification the attempt record carries the folded `lane-push:failed` and `lane-push-cause:<cause>`. The cause set is closed, and git's failure text never leaves the seam.
- **Source:** AC (ticket GH-416 behaviour 3; GH-416 G-3, F-4, DM-4, DEC-4, DEC-6; AC-F4-1)
- **Verification:** test (the cause suite: seven recordable outcomes each one child and one closed cause, with locale-flavoured and URL or token text classified away; both product surfaces asserted separately) + demonstration (the final-message clause is judged through the two product surfaces; a session's own message is not a machine-observable artifact)
- **Negotiable:** no

### C-5: Declared, bounded growth, and no classification growth

- **Statement:** The structural growth is exactly one append-only durable record kind, `dispatch.lane-push` (`delivery.dispatch.lane-push.v1`, key `dispatch.lane-pushes:<ref>`), whole payload at most 512 UTF-8 bytes, carrying identifiers and full-hex SHAs only. The lane's evidence is a distinct reference family (`lane-push:<verdict>`, `lane-push-cause:<cause>`) reserved ahead of the evidence slice, so the reserved block holds at most seven of the sixteen-reference budget. No result token, error identity, error-table row, comparison reason, corroboration source, derivation arm, or attempt-record field is added; the attempt schema is unchanged and the attempt record stays engine-written, exactly one per terminal classification; and no delivered member of a closed set (`push:<verdict>` included) changes meaning.
- **Source:** AC (GH-416 G-5, F-3, §8.2, DM-1, DM-2, NFR-5, NFR-8, DEC-2, DEC-5; AC-F3-1); prior decision (TDR-0076 C-5)
- **Verification:** test (the state-additivity baseline gained exactly the lane-push constants; the payload bound; the fold suite's zero-reference arms; the set-equality inventories over each closed set)
- **Negotiable:** no

### C-6: No cause on any engine surface

- **Statement:** The engine's parity act consumes the seam's outcome and discards the detail. No engine envelope, parity fact, classification, or `dispatch <ref>` text mode carries a cause. The lane's cause is surfaced by the command's answer, by the lane-push record, by the `dispatch status` fact read from that record, and by the attempt's folded `lane-push-cause:<cause>` reference.
- **Source:** AC (GH-416 NG-3, F-3, F-4, §10, DEC-4); prior decision (TDR-0076 D3: the additive optional `push` block is the parity block)
- **Verification:** test (the seam's engine arm: two different causes leave verdict, evidence, exit, comparison, and push block identical, with no cause in the envelope) + code review (`packages/cli/src/production.ts:4279`)
- **Negotiable:** no

### C-7: The operator surface keeps its record-only posture

- **Statement:** `dispatch status` carries the lane's push as one additive optional `lanePush` fact, read from the record in at most one additional bounded record read (one lane read plus at most two additional record reads, park and lane-push). The query makes no network call, starts no process, takes no fence, appends nothing, and deletes nothing. Every delivered member and line is byte-identical when the fact is absent.
- **Source:** AC (ticket GH-416 requirement 4; GH-416 G-4, F-5, DM-3, DEC-3, NFR-3, NFR-4; AC-F5-1)
- **Verification:** test (the status projection suite; the read-count assertions at three reads; the delivered status goldens unchanged; the read-only posture suite)
- **Negotiable:** no

### C-8: The command name follows the naming lock

- **Statement:** `push` is one new top-level prompt-required command family, added to the command registry, with exactly one meaning in the delivery domain and no near-synonym among the delivered commands. No delivered command, family, or option name is renamed.
- **Source:** prior decision (ODR-0003 C-1 to C-4, DC-3, DC-4, and its second revisit trigger); AC (GH-416 DEC-1)
- **Verification:** audit (the registry row and the naming audit in D6) + test (the prompt-required composition, the help inventory, the help-guide coverage check, and the reference-page parity pins)
- **Negotiable:** no

> **Table stakes:** every alternative below keeps the checkout's ambient git credential chain as the only credential path, the merge-transaction seam's local-only declaration, the no-merge posture of dispatch, the closed delivery-result vocabulary, the bash wrappers' own push behavior, and the standing lockstep changeset invariant (five fixed-group packages, all minor). None of these eliminates an alternative.

## Decision Drivers

**Technical drivers (ranked):**

1. **Ownership follows authorship.** The lane that lands the evidence commit owns publishing it.
2. **An act must not depend on a process it does not need.** The lane's act is worth exactly what it does without a wrapper, so it must not depend on one.
3. **A deterministic lifecycle tail.** A typed step that a fixture can drive takes the place of a prose habit, so the last step of the eleven-phase workflow becomes reproducible.
4. **One seam, one act contract.** The delivered push seam is the only remote-write act; a second implementation is a second thing to drift.
5. **Evidence legibility.** An operator reads whether the lane's head reached the remote without comparing heads, and can tell which act produced which fact.

**Operational drivers:**

6. **No stranded evidence, no second CI cycle.** The evidence commit rides the pull request from its first CI run.
7. **Efficient for one person orchestrating AI.** No manual push, no head comparison, and no git archaeology after a lane stops.
8. **Bounded cost, idempotent repeats.** One push and one record append per lane end; a second push of an equal head is a non-error at every call site.
9. **No silent growth.** Every added record kind, evidence reference, command, and read is declared and counted.

**Precedent drivers:**

10. **Amendment, not supersession.** TDR-0076's authority for the engine's write posture stands; only the ownership boundary moves.
11. **Honest scope.** The divergence between the session-side product surface and the typed-only evidence surfaces is declared, and so is every residual.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor`, GH-416 DEC-7.
- **Decider / Approver:** Juliusz Ćwiąkalski, human acceptance at the GH-416 pull request. The AI does not accept this record, and `decision_date` stays null until that acceptance.
- **Contributors:** `@pm` (the scope readings, the three reserved design points, and the Definition-of-Ready rulings R1 to R16), `@spec-writer` (specification v1.5), `@readiness-reviewer` (three Definition-of-Ready iterations: the safe-ref predicate's home and the engine's outcome-only consumption), `@test-plan-writer` (the reserved-reference count corrected to code truth and the delivered cause literal), `@plan-writer` (phase 7's declared path and findings I-8 and I-9), `@decision-advisor` (analysis and this record).
- **Required reviewers:** `@reviewer`, and the human owner (this record amends a delivered ownership boundary).
- **Performers:** `@coder` (the command, the seam's closed cause, the fold, and the status fact), `@toolsmith` (the `pm` agent definition's step 10), `@doc-syncer` (the documentation-phase reconciliation).
- **Informed:** operators of native deliveries; future authors proposing a prompt-required command family; future authors proposing a durable record kind written from a session.

**Type and rigor note.** TDR. The rule of thumb decides the type before any tie-break: this is how one act is performed within an already-decided design, not a constraint on future system structure. The architecture-level question, that a bounded remote-write seam exists in the typed stack, is delivered (TDR-0076) and is not reopened. This record changes who performs that act on one caller's path, when, and what durable fact that caller leaves. It is R2 because it sets a precedent (a second caller of the write seam and a new record kind) and amends the boundary of a delivered record that the ticket's acceptance criteria rest on. It is not R3 because every fact is repo-local and read directly from code delivered on this change's branch, the change is reversible (remove the step from the two product surfaces and the command; every reader answers a missing record with classified absence and rewrites nothing), and no engine contract moves. No independent `@decision-critic` pass was run for it.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| One push seam exists with the fixed argv, the non-shell child, the 60 000 ms budget, one attempt, no force variant, and exit 0 as `accepted` | FACT | `packages/adapters/src/git/push.ts:60-64, 78, 147-155, 196-218` (read 2026-11-27) | The lane's act would need a new seam, and C-3 would fail | High |
| The cause vocabulary is the closed eight tokens, one guard-only and seven recordable, classified inside the seam | FACT | `packages/core/src/contracts/dispatch.ts:787-814`; `packages/adapters/src/git/push.ts:103-139, 203-218` | A refusal could not be named without new text leaving the seam | High |
| The engine's parity act branches on the outcome alone and reads no `detail` | FACT | `packages/cli/src/production.ts:4278-4286` | A cause would already reach an engine surface, and C-6 would amend rather than preserve | High |
| The engine resolves the change branch through its own read, with no cross-check against another resolution | FACT | `packages/cli/src/production.ts:4255`; GH-416 specification §12 | The two resolutions could not disagree, and the residual in Negative Outcomes would not exist | High |
| The reserved block holds five delivered disclosures ahead of a 16-reference slice, and the fold appends at most two | FACT | `packages/core/src/app/dispatch.ts:1133-1144`; `packages/core/src/contracts/dispatch.ts:636` | The post-change maximum would not be seven of sixteen | High |
| The record kind, schema, key prefix, and the 512-byte payload bound are delivered | FACT | `packages/core/src/contracts/dispatch.ts:769-771, 819, 833-855` | The growth would not be the one declared kind | High |
| The act comes first and the append second, and a failed append is answered as `recorded: false` | FACT | `packages/core/src/app/dispatch-lane-push.ts:106-135` | A record could claim a push that never happened | High |
| The `pm` step 10 orders the phase completion commit, the push, the final message, then STOP, and `push` is the twenty-ninth prompt-required command | FACT | `.opencode/agent/pm.md:403-418`; `packages/cli/src/help/prompt-required-commands.ts:43-44`; `packages/core/src/domain/dispatch-prompt.ts:58` | The instruction would not reach the lane, and C-1 would fail in practice | High |
| The fourteen lane-push, engine-arm, status, envelope, and posture suites pass on this branch | FACT (executed) | `bun test` over the fourteen suite files, 2026-11-27: 148 pass, 0 fail | The mechanism would rest on assertion rather than proof | High |
| The `pm` agent runs `pr_creation` in the lane's worktree, so the pushed `HEAD` is the lane's head | ASSUMPTION | GH-416 specification §12; the lifecycle runs every command in the lane's worktree | A checkout that resolves the branch while holding a different head pushes that head: a diverging head is refused by the fast-forward rule, and a fast-forwarding one is pushed and recorded with its head named (RSK-9) | Medium |
| The checkout's ambient credential chain can push the change branch from the lane's session | ASSUMPTION | GH-416 specification §12; the same boundary the delivered engine-side push relies on (TDR-0076) | The act is refused `auth-rejected`, named on every surface, and the engine's act or an operator resolves it | Medium |
| An accepted fast-forward push means the remote head equals the pushed head | ASSUMPTION | git's own guarantee, as the specification's §12 relies on it | The lane's act would need a parity re-read, which is the engine's and is not added here | High |
| The next lanes' pull-request heads equal their branch heads with no manual push, on a real remote | TO-CONFIRM | GH-416 specification §18 (the post-merge observation, recorded in the delivering lane's pm-notes) | The fixtures prove the logic over a real checkout and a keyed fake remote; the live remote is the residual proof, and the merge bar plus the engine's ensure-push remain | Medium |
| The observed cause mix leaves `unclassified` rare | TO-CONFIRM | GH-416 specification §7.3 and RSK-4 | A wrong label is possible and never a wrong push; nothing branches on a cause, and the classification can be refined by a later change | Low |

## Mental Models & Techniques Used

- **First principles:** the commit and the push that publishes it are two halves of one act, and ownership of the second belongs to the author of the first unless a reason separates them. TDR-0076's reason holds for the engine's claim and not for the lane's own commit.
- **Inversion:** how can a push look right and be wrong? The lane reports completion while the evidence is local. A record claims a push that never happened. A refusal is attributed to another attempt. A cause carries a remote URL or a token. A prompt is trusted where an injectable transport could be proven. Each alternative below was checked for one of these.
- **5 Whys** (on "the evidence commit is local when the lane stops"): nobody pushed it, because the wrapper that pushes was gone, because the session had no typed act to push with, because the session-side push was a convention that TDR-0076 deliberately left alone, because a classification was assumed to follow every session. The fix gives the session a typed act and a durable fact and leaves the engine as it is.
- **Systems thinking:** the lane's act, the PR-creation workflow's push, and the engine's act are three callers of one concern with two failure modes, and each covers the other's. The residual is their intersection, and it is declared rather than hidden.
- **Second-order thinking:** forcing a lane refusal into the classification would count the same class twice, through the delivered failure row, and could turn a truthful `pr-open` into a failure after the engine had reconciled the branch itself. And a late manual push invalidates CI on the pull request's head: a recurring second CI cycle that one act at the right moment removes.
- **Opportunity cost of the record kind:** a new durable kind is the change's one structural growth, and it buys the only property no delivered fact has, a session-authored outcome that outlives the session's wrapper.
- **KISS:** one command, one seam, one record, one fold, one fact; nothing is authored and nothing is retried.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 act at `pr_creation` | C-2 engine backstop unchanged | C-3 one seam, no state coupling | C-4 refusal named | C-5 bounded growth | C-6 no cause on engine | C-7 record-only status | C-8 naming lock |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 wrapper-side pushes only | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 extend `phase complete` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 prompt-only `@pr-manager` instruction | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 a second git implementation | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 `dispatch push` under the engine family | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-5 overload `push:<verdict>` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-6 the session writes the attempt | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-7 derive the fact from prose | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-8 `dispatch status` answers a live equality | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-9 a refused lane push is a classification failure | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-10 selected: typed `push <ref>`, one record, one fold, one fact | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails. All constraints are `Negotiable: no`, so no accepted-risk exception is claimed and any ❌ is disqualifying.

### Alternative 0: Do Nothing, Wrapper-Side Pushes Only

- **Eligibility:** Not eligible (fails C-1 and C-4).
- **Summary:** Leave the push of the last evidence commit to the PR-creation workflow's pre-PR push and to the engine's ensure-push at the `pr-open` arm, with no session-side act.
- **Constraint compliance:** Passes C-2, C-3, C-5, C-6, C-7, and C-8, because nothing changes. Fails C-1: no act runs at `pr_creation`, so the phase completion commit and the PR-URL note stay local until a wrapper acts. Fails C-4: when the wrapper is gone nothing records that a push was owed, and the lane reports completion as if its evidence were on the remote.
- **Driver fit:** Serves drivers 4 and 8 only.
- **Pros:** Zero change; no new command, record, or surface.
- **Cons:** It is the defect under decision. Both pushes belong to a process that may no longer exist, and enforcement that depends on the wrapper is enforcement that depends on the wrapper being alive.
- **Why rejected:** The ticket's first and third behaviours cannot be met by a mechanism that cannot run.

### Alternative 1: Extend `phase complete <ref> pr_creation` to Push

- **Eligibility:** Not eligible (fails C-3 and C-4).
- **Summary:** Let the phase completion command push after it lands the phase completion commit, so an existing lifecycle step carries the act.
- **Constraint compliance:** Fails C-3: it makes the only schema-validated phase-state write path perform a network write and couples a state invariant to remote availability. Fails C-4: a refused push must then either fail the phase transition, which misreports a transport refusal as a workflow regression and invites a reopen, or complete the phase with the refusal unrecorded. It could carry the one record kind, so C-5 passes.
- **Driver fit:** Serves drivers 1, 4, and 8; fails driver 3, because phase truth and transport truth become one write and a remote outage makes the tail nondeterministic.
- **Pros:** No new command; the act rides a step every lane already runs.
- **Cons:** Two things that fail for unrelated reasons are made to succeed or fail together.
- **Why rejected:** The push is not a state transition, and folding it into one buys a command at the price of a coupled write.

### Alternative 2: A Prompt-Only Instruction to `@pr-manager`

- **Eligibility:** Not eligible (fails C-1, C-3, and C-4).
- **Summary:** Instruct the PR-creation agent, in prose, to push the branch again after the phase completion commit.
- **Constraint compliance:** Fails C-1: the agent's delivered push runs before the pull request is created and structurally cannot publish commits that land after it. Fails C-3: a prompt-only act has no injectable transport, no fixed argv, no budget, and no single-attempt rule, and it reaches git through the session's shell. Fails C-4: there is no typed answer, no closed cause, and no durable record.
- **Driver fit:** Serves driver 8 only; fails drivers 3, 4, 5, and 7.
- **Pros:** No code.
- **Cons:** The ticket's first and third acceptance criteria ask for fixtures with an injected transport; a prose act cannot be fixture-driven, so it can be neither proven nor gated.
- **Why rejected:** TDR-0076 rejected prompt-conformance enforcement for the engine's claim. This record does not reinstate it for the lane's act: the lane's act is typed, bounded, and recorded precisely so that it does not depend on being described well.

### Alternative 3: A Second Git Implementation Inside the Command

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Give the command its own push implementation over the child-process family instead of composing the delivered seam.
- **Constraint compliance:** Every other constraint could be met. Fails C-3: two implementations of one act contract (fixed argv, fast-forward only, single attempt, bounded timeout) exist to drift, and a force-capable variant becomes a matter of discipline rather than of construction.
- **Driver fit:** Fails driver 4 and gains nothing on the others.
- **Pros:** Freedom to tune the command's own arguments.
- **Cons:** Nothing the command needs is missing from the seam, and TDR-0076 D4 authorizes one seam, not a family of them.
- **Why rejected:** It duplicates a delivered contract for no gain, and it would turn TDR-0076 D4's one authorized seam into two.

### Alternative 4: `dispatch push` Under the Engine Family

- **Eligibility:** Not eligible (fails C-8).
- **Summary:** Mount the command as a subcommand of the existing `dispatch` family, so that no new family name is introduced.
- **Constraint compliance:** Every mechanism constraint could be met. Fails C-8: the session is not the engine, the `dispatch` family is the classification authority, and its machine envelope already carries a `push` block that means the engine's parity facts. `dispatch push` would place two meanings beside one name, against ODR-0003's one-meaning rule and its rule that "new commands join an existing family where one fits".
- **Driver fit:** Serves driver 9 in appearance only; fails driver 5.
- **Pros:** The help, coverage, and reference-page inventories do not grow by a family.
- **Cons:** An operator could no longer tell the lane's act from the engine's by the name alone, which is the confusion RSK-8 already guards against.
- **Why rejected:** No existing family fits without carrying a meaning that is not its own.

### Alternative 5: Overload the Delivered `push:<verdict>` Evidence Family

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Record the lane's outcome under the evidence family the attempt already carries, as a `push:` reference, instead of a distinct `lane-push:` family.
- **Constraint compliance:** Fails C-5: `push:<verdict>` is defined as the engine's parity outcome over the closed verdicts `clean`, `pushed`, and `failed` (TDR-0076 D3). Writing the lane's own act under it changes the meaning of a delivered closed set and makes the digest unable to say which act produced a fact.
- **Driver fit:** Serves driver 9 in appearance only; fails driver 5.
- **Pros:** One vocabulary fewer to document.
- **Cons:** `push:pushed` could mean the lane pushed or the engine reconciled, and an operator reading a refusal could not tell whether the backstop had already run.
- **Why rejected:** Two acts answer two questions, and one prefix for both would answer neither.

### Alternative 6: The Session Writes the Attempt Record

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Let the lane's command append the lane's push outcome to the attempt record directly.
- **Constraint compliance:** Fails C-5: the attempt record would stop being engine-written exactly once per terminal classification, and a session writer would risk a double append on resume. In the case that matters most, a dead wrapper, there is no attempt record yet to write to.
- **Driver fit:** Serves driver 5 in appearance only; fails drivers 3 and 9.
- **Pros:** The outcome would sit in the one record operators already read.
- **Cons:** It breaks the one-record invariant the derivation ladder rests on, and it cannot help when no classification has run.
- **Why rejected:** The attempt is the engine's record. The lane leaves a fact; the engine folds it.

### Alternative 7: Derive the Fact From Prose (the Lane's Final Message or the pm-notes)

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Have the classification read the lane's final message, or a pm-notes entry, and infer the push outcome.
- **Constraint compliance:** Fails C-4: both sources are untyped free text and neither is a store the classification reads. The transcript read is a declared capability gap on one harness, and the pm-notes document is a change-folder artifact the operator surface does not read. A named cause would rest on a wording.
- **Driver fit:** Serves driver 9 only; fails drivers 3, 5, and 7.
- **Pros:** No record kind.
- **Cons:** An inference from prose is neither bounded nor attributable to an attempt, and it can be absent exactly when the wrapper is gone.
- **Why rejected:** Evidence is a record with an attempt identity, not a sentence.

### Alternative 8: `dispatch status` Answers a Live Equality

- **Eligibility:** Not eligible (fails C-7).
- **Summary:** Answer the ticket's fourth requirement by comparing the local head against the remote head when the operator asks.
- **Constraint compliance:** Fails C-7: a remote head read is a network call and a credential-dependent one; a local head read starts a process and still cannot compare against the remote without the network. Both break the surface's declared posture.
- **Driver fit:** Serves driver 5 fully in principle; fails drivers 2 and 7.
- **Pros:** The answer would be an equality rather than a snapshot.
- **Cons:** It turns a read-only, offline, record-only query into one that can hang, need credentials, or fail on a remote outage.
- **Why rejected:** The surface can answer truthfully without the network, and that answer is the lane's recorded push. The record carries its instant so the snapshot cannot masquerade as a current equality.

### Alternative 9: A Refused Lane Push Is a Classification Failure

- **Eligibility:** Not eligible (fails C-2 and C-5).
- **Summary:** Make a recorded lane-push refusal a typed delivery failure at the next classification, through a new failure row or token.
- **Constraint compliance:** Fails C-2: the engine's own ensure-push evaluates the branch it resolves independently, so a refusal can be followed by a successful reconciliation, and failing the attempt anyway would turn a truthful `pr-open` into a failure after the backstop had done its work. Fails C-5: a new row, token, identity, or corroboration source is classification growth.
- **Driver fit:** Serves driver 5 in appearance only; fails drivers 6 and 10.
- **Pros:** A refusal would block loudly.
- **Cons:** It counts the same class twice, through the delivered `push-parity-unmet` row and again through the new one, and it punishes a lane the backstop has already repaired.
- **Why rejected:** The lane's refusal is a disclosure about an earlier act. The delivered failure row remains the only classification consequence of a branch head that is genuinely not on the remote.

### Alternative 10: Selected, the Typed `push <ref>`, One Durable Record, One Fold, One Fact

- **Eligibility:** Eligible (passes C-1 to C-8).
- **Summary:** At `pr_creation`, after the phase completion commit, the lane runs one prompt-required command that performs one fast-forward push over the delivered seam and appends one bounded `dispatch.lane-push` record. The classification reads that record once and folds at most two references into the attempt's reserved evidence; `dispatch status` carries the same record as an additive optional fact from one additional bounded read. The engine's ensure-push is unchanged and consumes the seam's outcome only.
- **Constraint compliance:** C-1 by the ordered `pr_creation` tail on both product surfaces and the fixture that runs with no classification; C-2 by leaving TDR-0076's act, envelope, evidence family, and failure row untouched and proving zero engine acts after a successful lane push; C-3 by composing the one delivered seam with no second implementation and no state-write coupling; C-4 by the closed cause vocabulary produced inside the seam and named on three surfaces; C-5 by the one declared record kind, the two reserved references inside seven of sixteen, and no classification growth; C-6 by the engine arm that discards the detail; C-7 by a status fact read from the record with no network call; C-8 by the one-meaning name added to the registry under the naming lock (D6).
- **Driver fit:** Best on all eleven drivers.
- **Pros:** The lane's evidence reaches the remote while the lane is alive, whether or not a wrapper is; a refusal is named and recorded; the engine is untouched and idle in the common case; the operator reads one fact.
- **Cons:** One new record kind, one new command family with its pinning cost, a snapshot rather than an equality on the status surface, and the declared residuals in Negative Outcomes.
- **Why chosen:** It is the only alternative that satisfies every constraint, and it adds one act and one fact while reusing everything the repository already owns.

## Decision

- **Decision:** Adopt **ALT-10**.

### D1: The act: who, when, and what

- **The sequence** (GH-416 DEC-6 and Appendix D): `@pr-manager` creates or updates the pull request, and its own pre-PR push stays; the lane records the PR URL as a pm-notes note, landed by the commit primitive; `phase complete <ref> pr_creation` lands the phase completion commit; the lane runs `push <ref>`; the final message names the PR URL and the push outcome; the lane stops.
- **Why after the phase completion commit.** That commit is the lane's actual last commit. Pushing after the URL note but before the phase completion would reintroduce the defect one commit later.
- **One act, nothing authored.** The command performs exactly one fast-forward push through the delivered seam. It stages nothing, commits nothing, amends nothing, and rewrites no history.
- **Where it runs.** In the invocation's own checkout, which for a dispatch-provisioned lane is the lane's worktree, so the pushed `HEAD` is the lane's head.
- **Resolution refuses rather than guesses.** The change branch is resolved from the change record's `branch:` declaration, the declared source `merge` already reads ([TDR-0071](TDR-0071-merge-change-branch-and-resolved-head-authority.md)), cross-checked with the delivered convention branch read. Exactly one agreement is a resolution. Four states are typed input refusals that name the observed state, perform no act, and append no record: the declaration and the convention read disagree; the convention read matches no branch; it matches more than one; the resolved name fails the safe-ref predicate. A guessed branch is never pushed.
- **The verdict.** An accepted act (git exit 0, an already-up-to-date branch included) is `pushed`; a rejection, a timeout, and a spawn-level failure are `failed`. The verdict is the act's own outcome, recorded before any classification can disagree with it.
- **Idempotence.** The command may run again. It performs another single act and records it; it never suppresses an act because a record exists, and it never treats a prior refusal as license to force.
- **The `no commit` directive suppresses commits, not the push.** Under it the phase-completion commit is skipped, and the push step still runs and still records.

### D2: The engine's act: the backstop, stated exactly

- **TDR-0076's C-1, C-3, C-4, C-6, C-7, D1, D2, and D3 stand verbatim.** The engine still evaluates parity at the `pr-open` arm, pushes at most once and only when the heads differ, re-reads parity once, and classifies `pr-open` only from a readable equality.
- **After a successful lane push** the parity read finds the heads equal: no engine act is performed, and the attempt carries `push:clean` beside the folded `lane-push:pushed`.
- **After a refused lane push** the engine's own ensure-push evaluates the branch it resolves. That resolution is its own single-match read with no declaration cross-check, so it may resolve a branch this command refused to resolve; this record leaves that behaviour as delivered. The engine either reconciles the branch (`pr-open`, `push:pushed`) or types the delivered failure row (`failed`, exit 1, `push-parity-unmet`).
- **Outcome only.** The parity act consumes the seam's `accepted` or not and discards the detail. No engine envelope, parity fact, or classification carries a cause (C-6).
- **Ordering of ownership.** The lane's act runs first in time, at `pr_creation` and before any classification. The engine's act remains the reconciliation and the backstop.

### D3: The evidence, stated exactly

- **The seam.** One non-force push, `HEAD` to the change branch on the push remote resolved by one bounded local configuration read (`branch.<branch>.pushRemote`, then `remote.pushDefault`, then `branch.<branch>.remote`, then `origin`), with no `--ff-only`, no force flag, and no `+` prefix; a literal non-shell child process; the injectable 60 000 ms budget with no new configuration key; one attempt with no retry; no force-capable variant; and the closed outcome union `accepted`, `rejected`, `failed`, or `timed-out`, where git exit 0 (already up to date included) is `accepted` (`packages/adapters/src/git/push.ts`).
- **The closed cause vocabulary.** Eight tokens: `protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, and `unclassified`. `unsafe-branch` is guard-only: the safe-ref predicate refuses the name before any child starts, the command refuses it pre-act, and no lane-push record can carry it. The other seven are recordable child-act causes. `protected-ref` alone has two sources: the protected-name set's guard check, which a resolved name can never trigger because a resolved name is always a convention match, and a branch protection or hook decline that git reports. Only the second is recorded. The token alone never identifies the source; the layer and the child count do. The cause is produced inside the seam from git's bounded failure text, and the raw text never leaves it (`packages/core/src/contracts/dispatch.ts:787-814`; `packages/adapters/src/git/push.ts:103-139`).
- **The record.** `dispatch.lane-push` (`delivery.dispatch.lane-push.v1`), key `dispatch.lane-pushes:<ref>`: one append per invocation, append-only, latest-wins per reference and attempt. Its members are the schema, the reference, the normalized repository identity, the branch, the head that was pushed, the verdict, the closed cause when the verdict is `failed`, the attempt identity and session identity read from the newest lane record when one was readable, and the recorded instant. `head` is the invocation checkout's `HEAD`, read at act time, never a value the transport reports. No stderr, remote URL, diff, prompt, transcript, credential, or provider payload enters it. **The whole payload is bounded at 512 UTF-8 bytes.** The act comes first and the append second: a failed append is disclosed on the answer as `recorded: false`, never as a record claiming a push that never happened (`packages/core/src/contracts/dispatch.ts:769-771, 819, 833-855`; `packages/core/src/app/dispatch-lane-push.ts:106-135`).
- **The fold.** The classification performs at most one bounded read of the lane-push family: records are filtered to the resolved repository, and the newest record whose attempt identity equals the attempt being classified is the fact. An accepted act folds `lane-push:pushed`; a refusal folds `lane-push:failed` together with `lane-push-cause:<cause>`. An unreadable store, no matching record, and a record for another attempt each contribute nothing and never fabricate a push (`packages/core/src/app/dispatch.ts:113-122`).
- **The budget.** The reserved block ahead of the evidence slice holds the five delivered disclosures, `lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, and `push:<verdict>`, and the fold appends at most two references. **The post-change maximum is seven of the 16-reference budget**, so a disclosure is still never truncated away (`packages/core/src/app/dispatch.ts:1133-1144`; `packages/core/src/contracts/dispatch.ts:636`).

### D4: The operator fact: a recorded snapshot

- `dispatch status <ref>` carries one additive optional `lanePush` fact, verbatim from the newest matching lane-push record: the verdict, the branch, the head, the recorded instant, and the cause when the verdict is `failed`.
- **It costs at most one additional bounded record read.** The query's posture is one lane read plus at most two additional record reads, park and lane-push, with zero network calls, zero process starts, zero fence acquisitions, zero appends, and zero deletions. The delivered members and lines are byte-identical when the fact is absent.
- **It is a recorded snapshot, not a live equality.** It says that the lane's last push was accepted for head H at instant T, or refused with cause C at instant T. It does not read the local branch and it does not read the remote. Because the push is the lifecycle's last act, the recorded head is the branch head at that instant; a commit landed afterwards makes the fact older than the branch, and the recorded instant is the disclosure that keeps the answer honest.
- **Absence is one answer covering three states:** the push never ran, a pre-act resolution refusal (which appends no record), and a record that did not land. The fact does not distinguish them (RSK-10).

### D5: A disclosure, not a claim

- A recorded `lane-push:failed` never turns a truthful classification into a failure and never suppresses one. If parity holds at classification, the evidence is on the remote and the earlier refusal is history; if parity does not hold, the delivered failure row fires. The two references answer different questions and both remain readable.
- No classification vocabulary grows. The delivered lifecycle push-failure row remains the only consequence of a branch head that is genuinely not on the remote, because the engine's own ensure-push evaluates the branch it resolves and either reconciles it or types the failure.

### D6: The name: `push` under the naming lock

Finding I-9 of the change plan leaves it to this record whether the `push` family name is recorded here or in a note of its own. It is recorded here, and no second record is declared. ODR-0003's rules apply one by one:

- **One meaning per name (ODR-0003 C-1).** `push` means exactly one thing in the delivery domain: the lane's own single fast-forward push of its change branch's head. No delivered command is a near-synonym: `commit` never pushes, `merge` is the landing act and not a push, `dispatch` is the engine's classification invocation, and no `publish`, `sync`, or `upload` command exists in the composed program.
- **Join a family where one fits (C-2).** None fits. `dispatch` is the engine's family (Alternative 4), and `commit` and `phase` are barred by C-3 of this record. `push` is therefore a new top-level family, the twenty-ninth and last, following `install`, `loop`, and `provider`.
- **No domain-noun reuse (C-3).** `push` is not a noun that already names a broader domain concept.
- **Distinguishable and guessable (C-4).** The help line states the act in one sentence: push the change branch's head fast-forward once, record the lane's own act, and answer the verdict.
- **Added to the registry, no rename (DC-3, DC-4).** The registry carries the `push` row (`doc/planning/oss-tooling/cli-command-registry.md:147`). No delivered command, family, or option name changes. The `dispatch` envelope's `push` block and the `push:<verdict>` evidence family keep their meaning, the engine's parity facts. From this record `push` is a locked name: a rename requires a superseding decision record plus a code change.
- **Two vocabularies, stated apart (RSK-8).** `push:<verdict>` is the engine's parity outcome (`clean`, `pushed`, `failed`). `lane-push:<verdict>` is the lane's own act. The distinct prefixes are what let an operator tell which act produced which fact.

### D7: The amendment, stated exactly

TDR-0076 is amended in three places, each for the lane's own act only.

**1. The session-side boundary.** TDR-0076's D4 reads "**Session-side conventions are unchanged**: the lifecycle's push behavior, the PR-creation workflow's retained git writes, and the commit primitive's never-push rule stand; the ensure-push is a reconciliation backstop, not a replacement instruction", and its summary and its second Context fact say the same. After this record the session-side rule reads:

> The session-side push is a typed product surface: at `pr_creation`, after the phase completion commit, the lane runs `push <ref>`, one fast-forward act over the one delivered push seam, and appends one durable `dispatch.lane-push` record. The PR-creation workflow's retained git writes and the commit primitive's never-push rule stand. The engine's ensure-push is the reconciliation backstop, not a replacement instruction, and it still runs at the `pr-open` arm for every classification that reaches it, whatever the lane's act recorded.

**2. The engine-first framing.** TDR-0076's D5 calls the engine's act "the typed stack's first remote-write operation" and "the pattern future write seams are measured against", and its first revisit trigger says a new write seam "reopens this record rather than inheriting it". After this record the framing reads:

> The engine's ensure-push remains the typed stack's first remote-write seam and the pattern every write seam is measured against. That seam has one further caller: the lane's `push` command composes it and inherits the pattern, and no second seam exists. The lane's act runs first in time, at `pr_creation` and before any classification; the engine's act remains the reconciliation and the backstop.

D5 lets a seam that states all five properties inherit the pattern, and it requires its own record only of one that cannot. The lane's act is measured against them, and the result is stated rather than assumed. **Bounded** holds: one act, one attempt, the declared timeout, no new configuration. **Narrow** holds: fast-forward only, one ref, one remote. **Safe by construction** holds: no force variant exists, and the command refuses an unsafe or unresolvable name before any child starts. **Honest in failure** holds for every post-resolution refusal, whose cause is named on three surfaces; for the lane's act honesty is a named cause and not a classification failure (D5 of this record). It is declared, not closed, for the pre-act resolution refusal, which has no durable fact. **Declared** is completed by the change's documentation phase, which reconciles the pages named under Implementation Plan. So the act states all five by the time the change lands and inherits the pattern. This record is mandated by the specification's DEC-7 and by the two boundaries the act moves (1 and 3), not by D5's own-record clause.

**3. The record-kind boundary.** TDR-0076's C-5 closes the structural growth of its act ("No new result token, error identity, error-table row, domain kind, derivation arm, or attempt-record field"), and its D3 places parity evidence in the reserved set inside the sixteen-reference budget. TDR-0076 added no durable record kind: every fact it introduced lives on the engine-written attempt record, which exists only when a dispatch reaches terminal classification. After this record the boundary reads:

> Exactly one durable record kind is added, `dispatch.lane-push` (`delivery.dispatch.lane-push.v1`, key `dispatch.lane-pushes:<ref>`), written by the lane's command and never by the engine's classification. The attempt-record schema, the result tokens, the error identities, the error-table rows, the derivation arms, and the corroboration map are unchanged. The reserved block ahead of the evidence slice holds at most seven references of the sixteen-reference budget: the five delivered disclosures plus at most two lane-push references. The `dispatch status` answer carries the additive optional `lanePush` fact.

**What stands verbatim in TDR-0076.** C-1 (a parity-backed `pr-open`), C-2 (structural enforcement), C-3, C-4, C-6, and C-7; D1 (the parity precondition and the act contract); D2 (the one failure row); D3 (the `push:<verdict>` family and the envelope block); the merge-transaction seam's local-only declaration; and D4's sentence "this record authorizes one new seam, not a general remote-write permission", which stays true: there is still exactly one seam.

**TDR-0076's C-2 is not weakened.** C-2 forbids that the enforcement of the `pr-open` claim depend on prompt or session conformance. That enforcement is still the engine's alone. The lane's act is not the enforcement of `pr-open`; it is the publication of the lane's own last commit while the lane is alive. TDR-0076's Alternative 1, a session-side push with dispatch-side verification and no engine push, stays rejected: it would have removed the reconciliation. This record keeps the reconciliation and adds the lane's act beside it.

**TDR-0076's first open question is answered for the lane's act only.** It asked whether the single `push:failed` verdict suffices for operator diagnosis, or whether a real rejection mix justifies richer cause disclosure. The lane's act names a closed cause on its own surfaces (D3); the engine's single `push:failed` verdict stands by decision (C-6).

**Amended, not superseded.** TDR-0076's record, number, and status are untouched, and this record links to it rather than replacing it. Three current-truth sentences that carry the amended rule are reconciled in the change's documentation phase, not by this record: the quality-gates page's sentence that "the session-side push convention is unchanged" (`doc/spec/features/feature-quality-gates-and-pr.md:47`), the operations guide's sentence that the fallback's "session-side push conventions are unchanged" (`doc/guides/engine-first-operations.md:343`), and the dispatch-engine page's closure note that forbids new record kinds (`doc/spec/features/feature-dispatch-engine.md:783`), which gains the one declared kind.

**Authority and acceptance:** this is an R2 design record. Status is `Proposed` and `decision_date` is `null`. The human owner (Juliusz Ćwiąkalski) accepts or rejects it at the GH-416 pull-request review. AI assistance analysed and wrote the record; the AI does not accept it, and no independent `@decision-critic` pass was run for it. TDR-0076 is itself `Proposed` on this branch: this amendment describes the delivered behaviour, and its authority as a record takes effect with the owner's acceptance, which presumes TDR-0076's own acceptance at its review.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 to C-8: the lane performs one act at `pr_creation`, after the phase completion commit, with no dependence on a wrapper, a classification, or an engine invocation, and authors and amends nothing (C-1); TDR-0076's act, envelope, evidence family, and failure row are untouched, a successful lane push leaves the engine with zero acts and `push:clean`, and a recorded refusal is a disclosure that neither creates nor suppresses a failure (C-2); the act is the one delivered seam with every term unchanged, no second implementation exists, and the phase-state write path and the commit primitive stay local-only (C-3); a refusal is named by a closed cause in the command's answer, in the lane's final message, and in the attempt's folded references, and git's failure text never leaves the seam (C-4); the growth is exactly one append-only record kind bounded at 512 UTF-8 bytes, the two reserved references keep the block at seven of sixteen, the attempt record stays engine-written with an unchanged schema, no classification member grows, and `push:<verdict>` keeps its meaning (C-5); the engine consumes the outcome and discards the detail, so no engine surface carries a cause (C-6); the status fact is read from the record in at most one additional bounded read under the unchanged zero posture, and the answer is byte-identical when the fact is absent (C-7); and `push` carries one meaning, joins no family that does not fit, is added to the registry, and renames nothing (C-8). No accepted-risk exceptions are taken, and no clause rests on an open question: the two declared residuals, the pre-act refusal without a durable fact and the prompt-instructed final message, are consequences recorded under Negative Outcomes and not conditions of any constraint.

## Trade-offs & Consequences

### Positive Outcomes

- A lane that runs the `pr_creation` tail no longer stops with its own evidence local, whether or not its wrapper is alive: the phase completion commit and the PR-URL note reach the remote while the lane is still running.
- A refusal is named in three places with one vocabulary, so a lane does not report completion as if its evidence were on the remote, and an operator diagnoses without a git command.
- The operator reads whether, and for which head, the lane's last push was accepted from `dispatch status`, with no network call and no head comparison.
- The engine's act is untouched and idle in the common case: after a successful lane push the classification derives `pr-open` from parity with zero engine push invocations.
- The fold is a disclosure and not a claim, so no classification vocabulary grows and the delivered failure row still fires exactly when a branch head is genuinely not on the remote.
- The lifecycle's last step is typed and fixture-proven instead of a prose habit, which makes the tail deterministic.
- Everything is reused: one seam, the `dispatch.lane` record for the attempt identity, the `park` precedent for the additive status fact, and TDR-0078's amendment pattern for the record itself.

### Negative Outcomes

- **One new durable record kind.** The store grows by one bounded record per lane end, typically one record and two on a retried push, and this is the one structural growth the change declares.
- **One new prompt-required command family.** The help inventory, the coverage inventory, the reference pages, and the seventeen pinning suites the change record counts moved with it. Every later command pays the same pinning cost.
- **Up to three pushes of one branch after the pull request exists.** The lane's act, a bash wrapper's own push, and the engine's act can all run on the same branch; the PR-creation workflow's push ran before them, on an earlier head. Each is idempotent and costs at most one remote round trip, and a losing interleave is a named rejection (RSK-1).
- **The status fact is a snapshot, not an equality.** A commit landed after the push makes the fact older than the branch; the recorded instant discloses it and does not prevent it (RSK-2).
- **Two resolution paths exist.** The command's resolution cross-checks the declaration with the convention read and refuses rather than guesses; the engine's is its own single-match read with no cross-check. They may resolve differently, and the engine's is left as delivered.
- **A pre-act resolution refusal leaves no durable fact.** It is absent from `dispatch status` and from the attempts digest, and its only immediate report is the lane's final message, which is not a machine-observable artifact (RSK-10). Declared, not closed.
- **A lane that runs no `pr_creation` step performs no session-side push.** A custom prompt, or a harness running no `pm` agent, keeps the merge bar and the engine's ensure-push as its only backstops (RSK-5). Declared, not closed.
- **The act detects no wrong checkout.** A checkout that resolves the branch while holding a different head pushes that head if it fast-forwards, and is refused if it does not; the rule that `pr_creation` runs in the lane's worktree is the guard (RSK-9).
- **The final-message contract is prompt-instructed.** A session may still misreport. The durable record and the status fact are the machine-readable truth, and the message is not.
- **The product surface and the wrappers' bookkeeping diverge.** The act reaches typed and shell lanes alike, because the command is prompt-required and the `pm` agent definition instructs it; the evidence fold and the status fact are typed dispatch surfaces only (F-6).
- **Two push vocabularies share the digest.** `push:<verdict>` and `lane-push:<verdict>` answer different questions, and an operator must know which is which (RSK-8).
- **The cause classification depends on git's failure wording.** A locale change or a provider-specific message can mislabel a refusal; the label is reporting-only, so a wrong label is never a wrong push (RSK-4).

### Unresolved Questions

- [ ] Should `push <ref>` refuse a checkout whose current branch is not the resolved change branch, so that the lane-worktree rule is enforced rather than documented? It needs a ruling on the legitimate non-lane case (a detached `HEAD`, a differently named branch) and is best decided with the deferred worktree-cleanliness precondition. (owner: Juliusz Ćwiąkalski; recorded as a proposal in the GH-416 change record, and ticket creation stays with him under the tracker policy)
- [ ] Does the cause mix observed on live lanes justify refining the classification, for example separating a changed remote address from a moved remote branch? (owner: `@pm`; deferred until operator evidence shows `unclassified` or one class dominating)
- [ ] Should `lanes` and `board` carry the lane-push fact, and should the bash wrappers' own bookkeeping read the typed evidence? (owner: `@pm`; both are deferred by the specification's §7.3)

TDR-0076's own open questions on the shell fallback's parity enforcement and on `pr-open-unverified` remain that record's and are not reopened here.

## Implementation Plan

The mechanism is delivered on the change's branch in plan phases 1 to 6. This section states what those phases delivered, at the level of behaviour, and what remains for the documentation phase.

1. **Contracts** (plan phase 1): the record kind with its schema, key prefix, and closed verdict and cause vocabularies; the evidence builders; the command's answer contract; the additive status fact; and the safe-ref predicate's single home in the dispatch contract module, with the protected-name set in the closeout contract module.
2. **The seam's closed cause** (phase 2): the `detail` member carries the closed token classified inside the seam, with the argv, the timeout, the attempt count, and the outcome union unchanged.
3. **The command and its mount** (phase 3): the `push` command, its renderer, its production wiring over the delivered reads and the delivered seam, and its registration as the twenty-ninth prompt-required command with its help entry, reference page, coverage inventory, and the count-and-tail movement of every pinned inventory.
4. **The fold** (phase 4): one bounded read per classification and at most two references in the reserved block, with no token, comparison reason, corroboration source, derivation arm, or attempt field.
5. **The status fact** (phase 5): one additional bounded read, the additive `lanePush` member, and additive human lines only when the fact is present.
6. **The two product surfaces** (phase 6): the `pm` agent definition's step 10 and one sentence in the built lifecycle prompt, each with its own assertion and the five section markers unchanged.
7. **Documentation (the change's documentation phase):** reconcile the dispatch-engine feature page (derivation arm 8's cross-reference to the lane-side act, the attempt-record evidence with the two prefixes distinguished, the reserved block at seven of sixteen as code truth, the record-kind inventory, the operator lane view's `lanePush` fact and its read posture, and the closure note's one declared record kind); the quality-gates and lifecycle pages' `pr_creation` tails and the quality-gates page's unchanged-convention sentence; the agents-and-commands page and the CLI entrypoint page; the engine-first operations guide (the declared divergence, the three places an operator reads a refusal, and what an absent fact covers); the dispatch-engine test-spec coverage map; the glossary; and the TDR-0076 cross-reference.
8. **Rollout:** the full lifecycle on the change branch, with the pull request open against the integration branch and merge authority human. This change's own pull request is the first to run the new tail. After merge, the next lanes' pull-request heads are observed equal to their branch heads with no manual push, and a refusal there surfaces in the lane's message and, for a post-resolution refusal, in the attempt record and `dispatch status`; the observation is recorded in the delivering lane's pm-notes.
9. **Risk mitigation during implementation:** every interleave is fast-forward-only and single-attempt, so a losing act is a named rejection and no force exists to corrupt history; the act comes before the append, so no record can claim a push that never happened; and a refusal has no in-lane remedy, so the lane neither retries nor reopens a phase.

## Verification Criteria

- Metric: lanes ending with the pull request head behind the branch head where no wrapper classified. Target: 0. Window: the ticket's first fixture in the change's CI, then the post-merge observation of the next lanes.
- Metric: commits authored or amended by the push act. Target: 0. Window: the change's CI.
- Metric: push acts per `push <ref>` invocation. Target: exactly 1, with no retry. Window: the change's CI.
- Metric: post-resolution refusals with a durable record and a named cause. Target: 100%. Window: the change's CI.
- Metric: post-resolution refusals reaching the attempt record, folded from the durable record. Target: 100% of those whose attempt classifies. Window: the change's CI.
- Metric: references reserved ahead of the evidence slice. Target: at most 7 of 16. Window: the change's CI.
- Metric: lane-push payload size. Target: at most 512 UTF-8 bytes. Window: the change's CI.
- Metric: new durable record kinds. Target: exactly 1. Window: the change's CI (the state-additivity baseline).
- Metric: new result tokens, error identities, error-table rows, comparison reasons, corroboration sources, derivation arms, and attempt-record fields. Target: 0. Window: the change's CI (set-equality inventories).
- Metric: engine push invocations when the lane's push already made the heads equal. Target: 0, with `push:clean`. Window: the change's CI.
- Metric: causes on any engine surface. Target: 0. Window: the change's CI.
- Metric: additional bounded record reads per `dispatch status` answer. Target: at most 1 (three in total: lane, park, and lane-push). Window: the change's CI.
- Metric: added network calls, process starts, fence acquisitions, appends, and deletions on the read queries. Target: 0 each. Window: the change's CI.
- Metric: byte differences in a `dispatch status` answer when `lanePush` is absent, and in `dispatch <ref>` text mode. Target: 0. Window: the change's CI (the delivered goldens).

## Confidence Rating

**Medium-high.** Every element of the mechanism is delivered on this change's branch and proven by a suite: the seam and its bounds, the closed cause vocabulary, the record and its 512-byte bound, the fold and its zero-reference arms, the status fact, and the engine arm that discards the cause (148 tests across fourteen suites, all passing on 2026-11-27). That is the high component, and it is evidence rather than an estimate. Three surfaces keep it below high. The live remote is unproven: the fixtures run over a real temporary checkout and a keyed fake remote, and the ambient credential chain of a lane session is an assumption the engine's delivered act shares. The final-message contract is prompt-instructed and not machine-observable, so a session may still misreport where the durable record and the status fact do not. And the pre-act resolution refusal has no durable fact by design. Each is labelled in the evidence table or declared in Negative Outcomes, and none can produce a false success on a machine-readable surface: a wrong assumption surfaces as a named refusal or as an absent fact, never as a recorded push that did not happen.

## References

- Change specification: `doc/changes/2026-11/2026-11-27--GH-416--lane-pushes-own-evidence-commit/chg-GH-416-spec.md` (v1.5): §15 DEC-1 to DEC-7 (DEC-7 is this record's mandate), §5.1 F-1 to F-6, §8.2 and §8.3 DM-1 to DM-5, §9 NFR-1 to NFR-8, §11 RSK-1 to RSK-10, §12, §14, §24 Appendices A to E, and the §17 acceptance criteria AC-F1-1 to AC-F6-1.
- Change plan: `doc/changes/2026-11/2026-11-27--GH-416--lane-pushes-own-evidence-commit/chg-GH-416-plan.yaml`, phase 7 (this record's declared path) and findings I-8 and I-9.
- Change record: `doc/changes/2026-11/2026-11-27--GH-416--lane-pushes-own-evidence-commit/chg-GH-416-pm-notes.yaml` (the scope readings, the three reserved design points, the Definition-of-Ready rulings R1 to R16, and the phase evidence for phases 1 to 6).
- Definition-of-Ready reviews: `doc/changes/2026-11/2026-11-27--GH-416--lane-pushes-own-evidence-commit/readiness-review/readiness-iter-1.md`, `readiness-iter-2.md`, and `readiness-iter-3.md`.
- Ticket: GH-416, requirements 1 to 4 and acceptance criteria 1 to 3 as the specification's decision log and traceability cite them; the ticket body was not read for this record.
- Amended decision: [TDR-0076](TDR-0076-engine-ensure-push-first-remote-write.md), D4, D5, C-5, D3, and the first revisit trigger.
- Amendment pattern: [TDR-0078](TDR-0078-lease-heartbeat-amends-tdr-0050.md), which amends TDR-0050 without editing it.
- Prior decisions: [TDR-0054](TDR-0054-dispatch-spawn-identity-title-and-prompt.md) (the `pm` agent and the lifecycle prompt as data: the two product surfaces); [TDR-0058](TDR-0058-dispatch-session-output-artifacts-and-transcript-read-seam.md) (the transcript read seam, and the reason prose is rejected as evidence); [TDR-0049](TDR-0049-dispatch-owned-durable-lane-record.md) (the durable lane record that supplies the attempt identity); [TDR-0053](TDR-0053-total-derivation-ladder-and-corroboration.md) (the derivation ladder, unchanged); [TDR-0055](TDR-0055-phase-truth-registry-fold-mirror.md) (the one phase truth source, whose write path this record keeps local-only); [TDR-0071](TDR-0071-merge-change-branch-and-resolved-head-authority.md) (the change record's declared `branch` key as a resolution source); [ODR-0003](ODR-0003-cli-command-naming-v1-lock.md) (the naming lock).
- Current truth: [Dispatch Engine](../spec/features/feature-dispatch-engine.md); [Quality Gates and PR](../spec/features/feature-quality-gates-and-pr.md); [Delivery Lifecycle](../spec/features/feature-delivery-lifecycle.md); [Agents and Commands](../spec/features/feature-agents-and-commands.md); [Engine-First Operations](../guides/engine-first-operations.md); [CLI command registry](../planning/oss-tooling/cli-command-registry.md).
- Code and contracts (read 2026-11-27): `packages/core/src/contracts/dispatch.ts`; `packages/core/src/contracts/dispatch-operator.ts`; `packages/core/src/domain/dispatch-lane-push.ts`; `packages/core/src/app/dispatch-lane-push.ts`; `packages/core/src/app/dispatch.ts`; `packages/core/src/app/dispatch-lane-view.ts`; `packages/core/src/domain/dispatch-prompt.ts`; `packages/adapters/src/git/push.ts`; `packages/cli/src/commands/push.ts`; `packages/cli/src/output/dispatch-text.ts`; `packages/cli/src/production.ts`; `packages/cli/src/help/prompt-required-commands.ts`; `.opencode/agent/pm.md`.
- Suites (run 2026-11-27): `tests/behaviour/dispatch-lane-push.test.ts`, `tests/behaviour/dispatch-lane-push-causes.test.ts`, `tests/behaviour/dispatch-lane-push-command.test.ts`, `tests/behaviour/dispatch-lane-push-fold.test.ts`, `tests/behaviour/dispatch-lane-push-record.test.ts`, `tests/behaviour/dispatch-lane-push-resolution.test.ts`, `tests/behaviour/dispatch-status-lane-push.test.ts`, `tests/behaviour/dispatch-push-parity.test.ts`, `tests/checks/lane-push-surfaces.test.ts`, `tests/checks/dispatch-contract-invariance.test.ts`, `tests/structure/dispatch-push-envelope.test.ts`, `tests/structure/lane-push-answer.test.ts`, `tests/golden/dispatch-status-worktree.test.ts`, and `tests/conformance/dispatch/dispatch-operator-posture.test.ts`.
