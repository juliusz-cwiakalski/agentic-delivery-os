---
id: chg-GH-416-test-plan
status: Proposed
version: 1.9
created: 2026-11-27
last_updated: 2026-11-27
owners: ["Juliusz Ćwiąkalski"]
service: "the delivery lifecycle's `pr_creation` tail and the dispatch engine's attempt evidence (a prompt-required CLI command over the delivered adapters push seam, and a durable lane-push fact on the delivered operator surface)"
labels: [change, m4, dispatch, cli, delivery-lifecycle, git-seams]
version_impact: minor
summary: "Verification map for the lane-owned evidence push: one prompt-required typed `push <ref>` command thin over the delivered fast-forward seam (one act whose fixed argv shape is `git push <remote> HEAD:refs/heads/<branch>` (the push remote resolved by one bounded local config read, no `--ff-only`, no force flag), non-shell, 60 000 ms injectable budget, nothing authored or amended), structural branch resolution from the change record's `branch:` declaration cross-checked with the delivered convention read (declaration/convention disagreement, none, and ambiguous are refusals, never a guessed ref), the append-only `dispatch.lane-push` record and its single bounded read folded into the attempt's reserved evidence references (`lane-push:<verdict>` / `lane-push-cause:<cause>`, inside the 16-reference budget, no classification growth), the additive optional `lanePush` fact on `dispatch status` (byte-identical absence; one extra bounded record read; zero network calls, process starts, fences, appends, deletions), the ordered `pr_creation` tail and the final-message contract carried by the `pm` agent definition and the built lifecycle prompt, the declared typed-versus-shell divergence, the prompt-required composition/help/reference-page guards, and the standing lockstep changeset; every arm runs offline over injected facts and fixture transports, never a real remote, and the ticket's three acceptance fixtures plus requirement 4 are named cases."
links:
  change_spec: ./chg-GH-416-spec.md
  implementation_plan: ./chg-GH-416-plan.yaml   # phase-4 artifact; not present when this plan was written
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S45: A lane pushes its own last evidence commit before it stops (M4)

## 1. Scope and Objectives

The behaviour under protection is the one the ticket names: a lane's own last evidence commit reaches the remote even when no wrapper is alive to classify, and a refusal is named instead of being mistaken for a pushed branch. Today the act belongs to `@pr-manager` (before the pull request exists) and to the engine's `pr-open` ensure-push (only when an invocation reaches terminal classification); the two commits the lifecycle lands after the pull request exists — the pm-notes PR-URL note and the `pr_creation` phase completion — are local until somebody pushes them. This change moves that act into the lane as one prompt-required typed command over the delivered fast-forward seam, records one bounded durable fact per invocation, folds that fact into the attempt's reserved evidence, and surfaces it additively on `dispatch status`.

The integrity risks this plan pins are the ones where a plausible implementation is silently wrong: a push command that authors, amends, resets, or force-pushes (the evidence would no longer be the evidence); a branch resolution that guesses and pushes a foreign, ambiguous, unsafe, or protected ref (the worst outcome of the whole change); a `dispatch.lane-push` record that grows unbounded, carries git's stderr or a remote URL, or claims a push that never happened because the append preceded the act; a fold that fabricates a lane push for a foreign attempt or an unreadable store, or that turns a recorded refusal into a classification failure the delivered row would not have produced; an operator fact that breaks the surface's declared posture (a network call, a process start, a fence, an append) or perturbs the delivered answer when absent; and a new command that drifts the prompt-required composition, the help/coverage inventory, the reference pages, or the prompt-conformance scan.

The plan is a verification map, not an execution claim: nothing here was run against a new implementation at authoring time, and phase ownership belongs to `chg-GH-416-plan.yaml`, authored in phase 4 after this plan. All seven acceptance criteria (AC-F1-1, AC-F1-2, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1, AC-F6-1) are covered by at least one named case; the ticket's three acceptance criteria and requirement 4 each have their own traceability row (§3.1) and their own fixture arms (§5.2 TC-LPUSH-001, TC-LPUSH-002/003, TC-LMSG-001, TC-LSTATUS-001..003). There are no TODO rows and no orphan cases; the three earlier spec-side findings are recorded as closed by spec v1.1 with the location that now decides each, and one accepted coverage boundary remains declared (§8.3).

### 1.1 In Scope

- **F-1, the lane's own push**: the `push <ref>` grammar and answer (§8.1), one fast-forward act through the delivered seam per invocation — argv `git push <resolved-remote> HEAD:refs/heads/<branch>`, the push remote resolved by one bounded local config read, no `--ff-only`, no force flag — nothing authored/amended/reset/forced, the invocation's own checkout as the working directory, act-then-append ordering with `recorded: false` disclosure, idempotent re-invocation that never suppresses an act and never escalates to force, and **a real-git arm** that runs the seam's default runner against a local bare remote so the argv is proven by git rather than by a scripted exit code.
- **Branch resolution and the two layers of one predicate (F-1, NFR-7)**: the change record's `branch:` declaration cross-checked with the delivered convention read (`branchConvention` + `selectMatchingBranch`, the delivered `none | unique | ambiguous` semantics in `packages/core/src/domain/closeout.ts`), where a disagreement, no match, or more than one match is a typed input refusal that performs no act and appends no record; a uniquely resolved branch name that fails the shared safe-ref predicate is **always** the pre-act refusal (no child process, no act, no record, no verdict/cause — AC-F1-2), because the command applies the predicate the seam itself imports from `packages/core/src/contracts/dispatch.ts` (the change's home for it; `PROTECTED_REF_NAMES` stays in `contracts/closeout.ts`, untouched). The command's guard is that predicate plus the protected-name-set membership check: the predicate **accepts** a protected name (it is alphabet-legal), the membership check **refuses** it, and since no convention-resolved name can equal a protected name that second check is unreachable from the command path — defence in depth, not a reachable refusal. The seam keeps its guard as defence in depth for a direct consumer (the engine's ensure-push), whose rejection is the delivered `push:failed` parity evidence and never a lane-push record. The shared predicate is unified **for the push seam and its command only**: identical private copies remain in the git index, merge and watchdog adapters and are declared out of scope (unchanged by this change).
- **F-2, the second idempotent push (regression)**: an already-equal branch is `accepted`/`pushed` with no error at the lane, at the wrapper, and at the engine (`push:clean`, zero engine push invocations), and no delivered push path is removed, reordered, or narrowed.
- **F-3, the durable fact and its fold**: the `dispatch.lane-push` payload and its bounds, one append per invocation under the store fence, the single bounded read at classification, the newest-record-for-this-attempt rule, the reserved-ahead-of-slice evidence references (the delivered reservation is five, the fold adds at most two, so the post-change maximum is seven of the sixteen-reference budget), and the no-fabrication directions (foreign attempt, no record, unreadable store).
- **F-4, naming the refusal**: the closed cause set (eight tokens) split by source — `unsafe-branch` is **guard-only** (a pre-act refusal, never on a record); `protected-ref` is **one token with two sources** (protected-set membership → pre-act refusal, no record; a protection/hook decline git reports → child-act classification, verdict `failed`, record appended); the remaining **child-act-only** tokens are `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out` and `unclassified`, so **seven** causes are recordable in all (those six plus source (b) of `protected-ref`) — the command's answer, the final-message contract carried by both product surfaces (`pm` agent definition step and the built lifecycle prompt sentence), the engine consuming the **outcome only** and surfacing no cause (NG-3), and the "a disclosure is not a claim" rule against the delivered `push-parity-unmet` row.
- **F-5, the operator fact**: the additive optional `lanePush` member on `dispatch status`, its verbatim projection, its human rendering only when present, its byte-identical absence, and its read posture and widened read count.
- **F-6, the declared divergence**: the typed/shell reach of the product surface, the typed-only nature of the fold and the status fact, and the bounded residual for a lane that runs no `pr_creation` step.
- **Delivery guards**: prompt-required composition (28 → 29), help entries, coverage inventory, the M4 reference page, reference-page parity, `check:help`, `check:prompt` (and the prompt inventory's required phrases), the entrypoint restriction, `check:no-shell`, the output-stability surfaces, and the standing five-package minor changeset.
- **Backward compatibility**: a pre-change store holds no lane-push record and reads byte-identically; pre-change attempts carry no `lane-push:` references; `dispatch <ref>` text mode stays the four-key contract and its machine envelope unchanged (the GH-386 `push` block stays the parity block).

### 1.2 Out of Scope & Known Gaps

- **Real remotes, real credentials.** Never exercised: the transport is injected (`createGitPushSeam({ childRunner })`, the parity harness's scripted outcomes, and a fake remote keyed by ref for AC-1) and every observation is a real command-path invocation over injected facts. **The act under test spawns no git child except in the one declared real-git arm**: the fake remote and the injected child runner start no process, while TC-LGIT-001 deliberately runs the seam's default runner against a local bare remote (a filesystem path, never a URL). Zero live network calls and zero wall-clock assertions. One exception to the "no real process" posture is declared: TC-LPUSH-001's fixture **setup** creates a real temporary repository and its commits and resolves `HEAD` inline in the suite, so git runs there — outside the act, never over the network.
- **The session's prose final message as an artifact.** No delivered seam reads a session's final message as a testable value (the transcript read is a declared capability gap on one harness). AC-F4-1's final-message clause is pinned where the spec puts it: as two product-surface assertions (TC-LMSG-001) plus the behavioural cause naming in the command's answer (TC-LCAUSE-001/002). A session that ignores its instruction is the declared RSK-5 residual, not a testable claim; see §8.3's accepted coverage boundary.
- **The engine's ensure-push behavior.** Unchanged (spec NG-4, AC-F2-1's third clause): the delivered GH-386 suites (`tests/conformance/dispatch/dispatch-parity-push.test.ts`, `tests/behaviour/dispatch-push-parity.test.ts`) stay authoritative and are re-run, not re-pinned. TC-LPUSH-003 asserts only the "zero engine push invocations + `push:clean` evidence" arm the ticket names.
- **The bash wrappers' own push behavior and their retirement.** Unchanged (NG-10); TC-LDOC-002 asserts only the documentation declaration.
- **A worktree-cleanliness precondition at the push** (spec §7.3): deferred; a dirty tree is not tested as a refusal.
- **A remote-head equality claim on `dispatch status`** (spec F-5, DEC-3): deliberately not claimed and therefore not tested; TC-LSTATUS-001/002 pin a recorded snapshot, never a live comparison.
- **Refined cause classification beyond the closed set** (spec §7.3): the eight tokens are the contract; a wrong-but-closed label is the declared RSK-4 residual.
- **Changeset naming and phase ordering.** Delivery mechanics (spec §18); TC-LGATE-001 asserts the invariant (one new changeset, five fixed packages, all minor), not a file name.

### 1.3 Definition of Done (consolidated)

The change is Done when all of the following hold, each judged from evidence rather than assertion. This complements the AC matrix in §3; it does not replace it.

1. **All seven ACs proven by their mapped TCs** (§3.1): AC-F1-1 → TC-LPUSH-001 (the fake-remote fixture, whose head is read at act time — §5.2 notes) **plus TC-LGIT-001** (the argv git actually accepts); AC-F1-2 → TC-LRES-001..005; AC-F2-1 → TC-LPUSH-002/003/004 **plus TC-LGIT-001** (repeat push accepted and moved-remote refused against real git); AC-F3-1 → TC-LFOLD-001..004 + TC-LCAUSE-001; AC-F4-1 → TC-LMSG-001/002 + TC-LCAUSE-001/002 + TC-LFOLD-001 with the one declared boundary (CB-1, §8.3); AC-F5-1 → TC-LSTATUS-001..003; AC-F6-1 → TC-LDOC-001/002.
2. **AC-F4-1's message clause** is judged through CB-1's declared route (the two product surfaces asserted separately by TC-LMSG-001/002) plus the post-merge observation recorded in the lane's pm-notes — never by reading a session transcript.
3. **Gates green with recorded evidence**: `pnpm check` passes, and `./scripts/lint-commit-range.sh --base origin/main-tools` returns PASS (or SKIP with the reason recorded); every gate command's evidence is recorded in the change's pm-notes `notes:` trail, under `TMPDIR=$PWD/tmp/tmpdir`. A check that did not run is never reported as passing.
4. **Release invariant**: exactly one new lockstep changeset naming the five fixed-group packages at `minor` (TC-LGATE-001), added before the first gate run.
5. **Decision record landed**: the companion record amending TDR-0076's push ownership exists as `Proposed` with its index row (TC-LDOC-002 step 6).
6. **Documentation reconciled**: every page named in TC-LDOC-002 is current, including the test-spec coverage map; the I-4 ruling's page/phrase-row pair moved together (TC-LDOC-001 step 5).
7. **Plan phases complete with per-phase evidence**: every phase of `chg-GH-416-plan.yaml` is marked complete with its `notes:` evidence, and no AC is met only by a TODO row (there are none).
8. **PR open against `main-tools`**, merge authority human-only, and the change's declared residuals (CB-1, RSK-5, RSK-10) stated in the PR description.

## 2. References

- Change specification: `./chg-GH-416-spec.md` — §4.1 success metrics, §5 capabilities (F-1..F-6) and §5.1 declared behaviors (including F-1's corrected argv `git push <remote> HEAD:refs/heads/<branch>` with the push remote resolved by one bounded local config read and no `--ff-only`, F-1 "One predicate, two layers", NFR-1's argv shape, NFR-2's added config read, and DM-4's classification of the missing-destination and HTTP-403 wordings), §6 flows 1–5, §7 scope boundaries, §8.1 CLI surface/grammar/answer/exits, §8.2 the record kind, §8.3 data-model impacts (DM-1..DM-5), §8.5 backward compatibility, §9 NFRs (NFR-1..NFR-8, NFR-2's added-cost count), §10 telemetry, §11 risks (RSK-1..RSK-10, including RSK-10's pre-act silence), §12 assumptions, §17 acceptance criteria and ticket traceability (with AC-F4-1's closing sentence on CB-1), §20–§21 privacy/security, §22 maintenance impact, Appendix A code-truth basis, Appendix B the record payload, Appendix C the folded evidence, Appendix D the `pr_creation` sequence and final-message contract, Appendix E the closed cause set split by layer.
- PM notes: `./chg-GH-416-pm-notes.yaml` — intake scope reading, the three reserved design points, the doc-risk inventory for phase 7, and the delivery notes (changeset before the first gate run; only affected tests while working and the whole battery once; gate evidence `TMPDIR=$PWD/tmp/tmpdir`; commits via the commit primitive; PR targets `main-tools`).
- Ticket: `juliusz-cwiakalski/agentic-delivery-os` issue #416 (M4-S45, milestone "M4: Jaiship-native delivery") — the four required behaviours, the three acceptance criteria, requirement 4, and the owner comment that adds no scope.
- Testing strategy: `.ai/rules/testing-strategy.md` — bun:test under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; permanent suites assert the current tree, never a branch diff; goldens updated only by explicit regeneration; aggregate gate `pnpm check`; record evidence in change artifacts.
- TypeScript authoring rules: `.ai/rules/typescript.md` §9 (fakes over `mock.module`, determinism, golden discipline) and §10 (iterate with `pnpm typecheck` / `bun test <path>`, finish with `pnpm check`).
- Enduring coverage map: `doc/quality/test-specs/test-spec-dispatch-engine.md` — the dispatch suites this plan joins (parity battery, operator surface, push parity/evidence, help/registration guards), and the coverage map the change reconciles in phase 7.
- Current-truth feature pages the change reconciles: `doc/spec/features/feature-dispatch-engine.md` (derivation arm 8, attempt evidence, operator lane view and read posture, record-kind inventory), `doc/spec/features/feature-quality-gates-and-pr.md` (`pr_creation` tail), `doc/spec/features/feature-delivery-lifecycle.md` (`pr_creation`), `doc/spec/features/feature-agents-and-commands.md` (the new command).
- Delivered code surfaces the plan grounds its seams in: `packages/adapters/src/git/push.ts` (the fixed argv shape `git push <remote> HEAD:refs/heads/<branch>`, where `<remote>` is the push remote resolved by one bounded local config read in the order `branch.<branch>.pushRemote` → `remote.pushDefault` → `branch.<branch>.remote` → `origin`, with **no `--ff-only`** and no force flag — the corrected argv of spec v1.6 F-1; literal non-shell spawn, `PUSH_DEFAULT_TIMEOUT_MS = 60_000`, closed outcome union, `isSafeRef` + `PROTECTED_REF_NAMES` guard before any child), `packages/core/src/contracts/dispatch.ts` (`DISPATCH_PUSH_VERDICTS`, `dispatchPushEvidenceRef`, `DISPATCH_MAX_EVIDENCE_REFS = 16`, `DISPATCH_LANE_RECORD_KIND`, `DISPATCH_LANE_KEY_PREFIX`), `packages/core/src/contracts/dispatch-operator.ts` (`DispatchStatusData`, `DispatchStatusParkFact`), `packages/core/src/contracts/pm-notes.ts`, `packages/core/src/domain/closeout.ts` (`branchConvention`, `selectMatchingBranch`), `packages/core/src/domain/dispatch-prompt.ts` (`DISPATCH_LIFECYCLE_SECTIONS`, five markers), `packages/core/src/app/dispatch.ts` (the reserved-evidence block and attempt append), `packages/core/src/app/dispatch-lane-view.ts` (`readOperatorStatus`), `packages/cli/src/help/prompt-required-commands.ts` (28 commands today) and `packages/cli/src/help.ts` (the delivered help inventory), `packages/cli/src/output/dispatch-text.ts` (four-key `renderDispatchText`, additive `renderDispatchStatusText`), `.opencode/agent/pm.md` (step id 10, "PR/MR creation (phase 11)" — its phase list labels `pr_creation` as phase 11 of the lifecycle).
- Delivered test prior art this plan extends: `tests/behaviour/dispatch-push-parity.test.ts` and `tests/behaviour/dispatch-push-evidence.test.ts` (GH-386 act/failure/reservation cells over `createParityHarness` + `createGuardedRunner`), `tests/conformance/dispatch/dispatch-parity-push.test.ts` (registry-proven rows), `tests/behaviour/dispatch-status-park.test.ts` and `tests/conformance/dispatch/dispatch-operator-status.test.ts` (the additive park fact, the counted store, the read-count cell `TC-STATUS-007` asserting exactly two reads today), `tests/conformance/dispatch/dispatch-operator-posture.test.ts` (zero appends/fences/process starts/deletions, byte/mode/mtime stability), `tests/behaviour/dispatch-additive-stability.test.ts`, `tests/golden/dispatch-text.test.ts`, `tests/structure/dispatch-help-inventory.test.ts`, `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` (with `tests/fixtures/help-guide/coverage.json`), `tests/checks/doc-conformance.test.ts`, `tests/checks/dispatch-contract-invariance.test.ts`, `tests/structure/dispatch-token-home.test.ts`, `tests/checks/no-shell-dispatch.test.ts`, `tests/checks/privacy-release.test.ts` (TC-RELEASE-001), `tests/fixtures/prompt-inventory/lifecycle.json`, `tests/behaviour/closeout-branch.test.ts` (the delivered selection semantics, unchanged).
- Related decisions: TDR-0076 (amended by the companion decision record), TDR-0054, TDR-0058; spec DEC-1..DEC-7.

## 3. Coverage Overview

Every AC maps to at least one named case and every case traces to at least one AC; no AC is TODO. TC prefixes are new in this plan and verified unused in the delivered tree immediately before authoring (grep over `tests/` for `TC-LPUSH`, `TC-LRES`, `TC-LSTORE`, `TC-LFOLD`, `TC-LSTATUS`, `TC-LMSG`, `TC-LCMD`, `TC-LCAUSE`, `TC-LOUT`, `TC-LDOC`, `TC-LBND`, `TC-LGATE` returned zero files). The delivered `TC-PUSH-*` series (GH-386) is not reused or extended by name: this plan's cases are distinct acts (lane-side, not engine-side) even where they touch the same seam.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (compressed) | TC ID(s) | Status |
|-------|------------------------|----------|--------|
| AC-F1-1 | No wrapper alive, injected accepting transport: PR head equals branch head when the session ends, exactly one push act for that head, zero commits authored or amended — **and the act's argv is one real git accepts** | TC-LPUSH-001, TC-LGIT-001, TC-LCMD-001, TC-LCMD-002, TC-LRES-005, TC-LMSG-002 | Covered |
| AC-F1-2 | A resolution refusal — declaration/convention disagreement, no match, more than one match, or a uniquely resolved name that fails the shared safe-ref predicate — is typed, names the observed state, performs no act, appends no record, starts no child process, and never pushes a guessed, ambiguous, unsafe, or protected ref. The protected-name clause is satisfied by construction plus defence in depth: no convention-resolved name can equal a protected member; the safe-ref predicate accepts such a name while the membership check refuses it; and the only command-reachable `protected-ref` source is a server-side decline (recorded, TC-LCAUSE-001) | TC-LRES-001, TC-LRES-002, TC-LRES-003, TC-LRES-004, TC-LRES-005, TC-LCAUSE-001 | Covered |
| AC-F2-1 | A repeat push of an equal head is accepted with no error — proven against real git, not a scripted exit code — and a classification after a successful lane push derives `pr-open` with zero engine push invocations and `push:clean`; no delivered push path removed, reordered, or turned into an error | TC-LPUSH-002, TC-LPUSH-003, TC-LPUSH-004, TC-LGIT-001 | Covered |
| AC-F3-1 | A refused push recorded by the lane reaches the attempt as `lane-push:failed` + `lane-push-cause:<cause>` in the reserved-ahead-of-slice refs within the 16 budget, with no new token/identity/row/reason/source/arm/field; a foreign-attempt record and an unreadable store contribute nothing | TC-LFOLD-001, TC-LFOLD-002, TC-LFOLD-003, TC-LFOLD-004, TC-LCAUSE-001 | Covered |
| AC-F4-1 | A refused push is named in the command's answer (cause) and the lane's final message (PR URL + refusal cause; `recorded: false` disclosure when the record did not land), the message never claims the branch is on the remote, and the attempt carries the same cause | TC-LMSG-001, TC-LMSG-002, TC-LCAUSE-001, TC-LCAUSE-002, TC-LCMD-001, TC-LFOLD-001 | Covered |
| AC-F5-1 | `dispatch status` carries the additive `lanePush` fact verbatim (verdict, branch, head, recordedAt, cause when failed), renders additive human lines only when present, is byte-identical when absent, and makes no network call, starts no process, takes no fence, appends nothing, and takes at most one additional bounded record read | TC-LSTATUS-001, TC-LSTATUS-002, TC-LSTATUS-003 | Covered |
| AC-F6-1 | The reconciled pages and the operations guide declare the session-side push as a product surface reachable from typed and shell lanes, the fold and the status fact as typed dispatch surfaces, the wrappers' and engine's behavior unchanged, and the no-`pr_creation` lane's merge-bar backstop | TC-LDOC-002, TC-LDOC-001 | Covered |

Functional capability roll-up:

| F-# | Capability | TC ID(s) |
|-----|------------|----------|
| F-1 | The lane's own prompt-required typed push, thin over the delivered seam, performing no authoring | TC-LPUSH-001, TC-LGIT-001, TC-LCMD-001, TC-LCMD-002, TC-LRES-001..005, TC-LBND-001 |
| F-2 | Idempotent second push; the delivered push landscape unchanged | TC-LPUSH-002, TC-LPUSH-003, TC-LPUSH-004, TC-LGIT-001 |
| F-3 | Durable bounded lane-push record and its fold into reserved attempt evidence | TC-LSTORE-001, TC-LSTORE-002, TC-LFOLD-001..004 |
| F-4 | The refusal named on three surfaces with one closed eight-token vocabulary, seven of them recordable and one (`unsafe-branch`) guard-only | TC-LCAUSE-001, TC-LCAUSE-002, TC-LMSG-001, TC-LMSG-002, TC-LCMD-001 |
| F-5 | Additive optional `lanePush` fact on `dispatch status`, record-derived | TC-LSTATUS-001, TC-LSTATUS-002, TC-LSTATUS-003 |
| F-6 | Declared divergence between the product surface and the shell wrapper, with its bounded residual | TC-LDOC-002, TC-LDOC-001 |

Ticket acceptance-criteria and requirement traceability (spec §17 traceability line, Appendix D/E):

| Ticket AC / requirement | Spec criterion | TC ID(s) |
|-------------------------|----------------|----------|
| **Ticket AC-1** — no wrapper alive, injected transport, PR head equals branch head at session end, one push act, nothing authored or amended | AC-F1-1 (+ DM-1, DM-5, NFR-1) | **TC-LPUSH-001** (the fixture), TC-LCMD-001, TC-LCMD-002, TC-LMSG-002 |
| **Ticket AC-2** — wrapper alive: the second push is a no-op with no error, and the classification reports the pulled-forward result | AC-F2-1 | **TC-LPUSH-002** (the no-op), **TC-LPUSH-003** (pr-open, zero engine pushes, `push:clean`), TC-LPUSH-004 (delivered paths retained) |
| **Ticket AC-3** — a refused push is named in the lane's last message and in the attempt record | AC-F4-1 + AC-F3-1 | **TC-LMSG-001** (both product surfaces), **TC-LFOLD-001** (attempt record), TC-LCAUSE-001, TC-LCAUSE-002 |
| **Ticket requirement 4** — `dispatch status` says whether the branch head is on the remote (as a recorded snapshot, DEC-3) | AC-F5-1 | **TC-LSTATUS-001**, TC-LSTATUS-002, TC-LSTATUS-003 |
| Requirement 1, "nothing is authored or amended" | AC-F1-1 | TC-LPUSH-001, TC-LCMD-001, TC-LCMD-002 |
| Requirement 1, "resolve the branch" | AC-F1-2 | TC-LRES-001..005 |
| Requirement 2, "the wrapper's push stays" | AC-F2-1 | TC-LPUSH-003, TC-LPUSH-004 |
| NG-5's amendment of GH-386's NG-3 (session-side convention changes, declared) | AC-F6-1 | TC-LDOC-002 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP/REST surface and no event-taxonomy kind, message, or control frame is added (spec §8.1/§8.2) — nothing to cover there, by absence. One durable record kind and one additive optional query member are the whole interface growth:

| ID | Element | TC ID(s) / note |
|----|---------|-----------------|
| DM-1 | `dispatch.lane-push` payload (`delivery.dispatch.lane-push.v1`, key `dispatch.lane-pushes:<ref>`): schema, ref, repository, branch, head (full-hex — the **invocation checkout's `HEAD`, read at act time** through the delivered local checkout/head read, never a value the transport reports), verdict, cause iff `failed` (one of the **seven recordable** child-act causes — includes `protected-ref` from a git-reported decline, never `unsafe-branch`), attemptId/sessionId when a lane record was readable, recordedAt; whole payload ≤ 512 UTF-8 bytes; identifiers and SHAs only | TC-LSTORE-001 (members, bounds, forbidden content, head source, append-only latest-wins), TC-LSTORE-002 (attempt/session binding and its absence) |
| DM-2 | `lane-push:<verdict>` / `lane-push-cause:<cause>` evidence references; reserved ahead of the slice beside the delivered five (`lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, `push:<verdict>`); the fold adds at most two, so at most seven of the 16-reference budget | TC-LFOLD-001 (both references, cause form, reservation and the seven-of-sixteen maximum), TC-LFOLD-002 (`pushed` form), TC-LFOLD-003 (no fabrication), TC-LFOLD-004 (disclosure not a claim) |
| DM-3 | Additive optional `lanePush` fact on `DispatchStatusData` (`verdict`, `branch`, `head`, `cause?`, `recordedAt`), verbatim from the newest matching record; absent when none stands — and absence is one answer covering three states (never ran, pre-act refusal, record did not land), which is RSK-10's declared residual; human lines only when present | TC-LSTATUS-001, TC-LSTATUS-002, TC-LSTATUS-003 |
| DM-4 | Closed cause vocabulary on the seam's `detail` member (eight tokens), split by source: **guard-only** `unsafe-branch` — a pre-act refusal on the command path and never a lane-push record; **two-source, one reachable** `protected-ref` (the delivered literal, shared with the closeout ref guard) — protected-set membership is the guard's second check, the membership test that runs beside the safe-ref predicate (unreachable from a resolved name: no child, no record), while a **protection/hook decline git reports** is the command-reachable child-act classification (one child, verdict `failed`, record appended with cause `protected-ref`); **child-act-only** `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unclassified` — together **seven recordable causes**. The outcome union is unchanged and the engine's parity act discards `detail` (NG-3) | TC-LCAUSE-001 (both sources of `protected-ref`, the guard-only `unsafe-branch`, the seven recordable causes, and the outcome-only engine), TC-LCAUSE-002 (`unclassified` fallback, `protected-ref` literal, no `protected-branch` alias, raw text never leaves the seam), TC-LRES-004 (the command-path guard arm is pre-act) |
| DM-5 | The `push <ref>` command contract: one positional, the answer keys of §8.1, exits 0/1, no new error identity | TC-LCMD-001 (grammar, both answer forms, exits), TC-LOUT-002 (bounds and redaction), TC-LDOC-001 (registration and page) |

External integration (spec §8.4) is covered at the seam only: the one remote write is asserted through the injected runner's recorded argv, count, and order (TC-LCMD-001, TC-LBND-001), and TC-LBND-002 asserts no provider read class is added. No case opens a network connection or reads a real remote.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) / note |
|-----|-------------|-----------------|
| NFR-1 | Act boundedness: exactly one child per invocation; fixed argv **shape** — the resolved push remote as the repository argument and `HEAD:refs/heads/<branch>` as the only refspec, no `--ff-only`, no force-capable flag; the remote resolved by one bounded local config read (`branch.<branch>.pushRemote` → `remote.pushDefault` → `branch.<branch>.remote` → `origin`); literal non-shell spawn; injectable 60 000 ms budget, no new configuration key; one attempt, no retry | TC-LBND-001 (the whole act contract at the seam), TC-LCMD-001 (one act per invocation), TC-LCMD-002 (no retry after a failed append), TC-LPUSH-002 (no escalation to force on a recorded prior refusal) |
| NFR-2 | Added cost per lane end: at most one bounded **pm-notes document read** (the change record's `branch:` declaration), one bounded **local branch read**, one bounded **local checkout/head read** (the recorded `head`), one bounded **local config read** (the push remote), one bounded **lane read**, one push (≤ 60 000 ms), and one record append; classification adds at most one bounded record read; 0 added provider reads | TC-LBND-002 (the per-lane-end and per-classification counts), TC-LFOLD-003 (single lane-push read), TC-LSTATUS-003 (status read count) |
| NFR-3 | Operator-surface posture per `dispatch status`: 0 network calls, 0 process starts, 0 fences, 0 appends, 0 deletions; ≤ 1 lane read, 1 park read, 1 lane-push read, 1 artifact/transcript read | TC-LSTATUS-003 (+ the delivered `dispatch-operator-posture.test.ts` cells re-run) |
| NFR-4 | Output stability: `dispatch <ref>` text byte-identical (four keys); machine envelope unchanged; `dispatch status` members/lines byte-identical when `lanePush` absent; push command human ≤ 16 lines / 2 KiB | TC-LOUT-001, TC-LSTATUS-002, TC-LOUT-002 |
| NFR-5 | Evidence integrity: at most seven references reserved ahead of the slice (the delivered five plus at most two lane-push references); the 16-reference budget intact under a full slice; record payload ≤ 512 UTF-8 bytes, single-line fields, identifiers and full-hex SHAs | TC-LFOLD-001 (reservation under an overflowing slice, membership-based so the property survives a later widening), TC-LSTORE-001 (payload bounds) |
| NFR-6 | No-shell invariant: the new command and the seam stay inside the declared static surface set (zero script-path literals, zero `shell: true`, fixed argv only) | TC-LBND-001 |
| NFR-7 | Deterministic resolution: exactly one resolution rule; every unresolvable state a named refusal; no convention-level guess and no current-checkout fallback that names a ref the record does not | TC-LRES-001..005 |
| NFR-8 | Bound on added reads at classification: ≤ 1 lane-push read; an unreadable store contributes zero references and never blocks classification | TC-LFOLD-003, TC-LFOLD-004 |

## 4. Test Types and Layers

| Layer | Framework / location | Role in this plan |
|-------|----------------------|-------------------|
| Command-path behaviour | `bun:test`, `tests/behaviour/*.test.ts` | The push command's grammar/answer/ordering, the ticket AC-1/AC-2 fixtures over `createParityHarness`, the resolution refusal matrix, the record payload, the fold, the cause vocabulary, and the classification arm — all through the composed production program with injected seams |
| Conformance | `bun:test`, `tests/conformance/dispatch/*.test.ts` | Registry-proven rows for the new arm (`tests/fixtures/dispatch/parity/cases.ts`, group `push-parity`, seam `push`), the operator `status` surface over a counted store, and the zero-posture proofs (`dispatch-operator-posture.test.ts`) |
| **Real-git suite** | `bun:test`, `tests/behaviour/dispatch-lane-push-real-git.test.ts` over `tests/fixtures/dispatch/parity/temp-repo.ts` | The seam's **default runner** against a temporary checkout and a **local bare remote**: accepted, already-up-to-date, `non-fast-forward`, the guard refusals, and the missing-destination classification — the only layer that proves git accepts the argv. No network: the remote is a local path (TC-LGIT-001) |
| Structure / contract pins | `bun:test`, `tests/structure/*.test.ts`, `tests/checks/*.test.ts` | Closed vocabularies (cause set, verdict set, answer key sets), additive-only pins, help inventory, the prompt inventory's required phrases, reference-page parity, doc-conformance phrase table, `no-shell` static scan, changeset invariant |
| Golden | `bun:test`, `tests/golden/*.test.ts` | `dispatch <ref>` four-key text byte stability and the classified-failure cells; deliberate regeneration only |
| Static invariant (script) | `scripts/checks/no-shell-dispatch.ts` via `pnpm check:no-shell`; `scripts/checks/prompt-conformance.ts` via `pnpm check:prompt`; `scripts/checks/help-guide-coverage.ts` via `pnpm check:help` | NFR-6's home, the prompt-conformance rule set over the edited `pm.md`, and the coverage matrix |
| Manual / content checks | Testing-strategy docs layer (traceability review, markdown/link review) | AC-F6-1's content declaration, the decision record's presence, and the "no silent drift" reading |
| Aggregate gate | `pnpm check` | Final verification; evidence recorded with `TMPDIR=$PWD/tmp/tmpdir` |

Fixture strategy, applicable to every automated layer: the transport is the injected child runner (`createGitPushSeam({ childRunner })`), the parity harness's scripted push outcome, or the fake remote keyed by ref; the branch facts are delivered local-branch-read fixtures; the change record's `branch:` declaration is a pm-notes fixture value; the lane record is the delivered `dispatch.lane` fixture shape; the clock, the store, and the fence are injected. **No act under test starts a real child process except in TC-LGIT-001**, which runs the seam's default runner against a local bare remote to prove git accepts the argv; no case opens a network connection or reads a real remote. Two further declared real-git surfaces: TC-LPUSH-001's fixture setup builds a real temporary repository and resolves `HEAD` through the delivered fixture helpers before the act, and TC-LGIT-001's fixture builds a checkout, a bare remote and a second clone. No fixture fabricates a command outcome — every observation is a real command-path invocation. Fixtures are never named `*.test.ts`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-LCMD-001 | The `push <ref>` grammar, both answer forms, exits 0/1, one act per invocation | Happy Path | behaviour + structure | High | AC-F1-1, AC-F4-1, DM-5, NFR-1, NFR-4 |
| TC-LCMD-002 | Act-then-append ordering: `recorded: false` on a fence fault, no retry, no second act | Corner Case | behaviour | High | AC-F1-1, RSK-6, NFR-1, NFR-2 |
| TC-LPUSH-001 | **Ticket AC-1 fixture**: no wrapper, a fake remote keyed by ref that resolves `HEAD` at act time, PR head equals branch head at session end, one push act, zero authored/amended commits | Happy Path | behaviour (fixture) | High | AC-F1-1 |
| TC-LPUSH-002 | **Ticket AC-2 fixture (no-op)**: the second push of an equal head is accepted, not an error, at the lane and at the seam | Regression | behaviour | High | AC-F2-1, NFR-1 |
| TC-LPUSH-003 | **Ticket AC-2 fixture (classification)**: after a recorded lane push, the classification derives `pr-open` with zero engine push invocations and `push:clean` | Regression | conformance + behaviour | High | AC-F2-1, NFR-2 |
| TC-LPUSH-004 | The delivered push landscape is intact: the PR workflow's pre-PR push, the engine ensure-push, and the wrappers keep their behavior | Regression | structure + manual content | High | AC-F2-1, NG-4 |
| TC-LGIT-001 | **Real-git arm**: the seam's default runner against a temporary checkout and a local bare remote — accepted, already up to date, `non-fast-forward`, the guard refusals, and the missing-destination classification | Happy Path + Negative | real-git behaviour | High | AC-F1-1, AC-F2-1, NFR-1 |
| TC-LRES-001 | Declaration and convention read disagree: typed refusal naming both, no act, no record | Negative | behaviour | High | AC-F1-2, NFR-7 |
| TC-LRES-002 | The convention read matches no branch: refusal, no current-checkout fallback, no act | Negative | behaviour | High | AC-F1-2, NFR-7 |
| TC-LRES-003 | The convention read matches more than one branch: ambiguous refusal naming the candidates, no act | Negative | behaviour | High | AC-F1-2, NFR-7 |
| TC-LRES-004 | **One predicate for the seam and its command**: a convention-resolved name the safe-ref predicate rejects is a pre-act refusal (no child, no act, no record); the protected-name membership check is the guard's second, defence-in-depth check (it refuses what the predicate accepts, and no resolved name can equal a protected member); the seam guard survives for a direct consumer only; the index/merge/watchdog copies are out of scope | Negative | behaviour + structure + unit | High | AC-F1-2, NG-1, NFR-6, RSK-10 |
| TC-LRES-005 | The unique-resolution arms: declaration + convention agree; declaration absent and the convention read unique | Happy Path | behaviour | High | AC-F1-2, AC-F1-1, NFR-7 |
| TC-LSTORE-001 | The `dispatch.lane-push` payload is bounded and identifier-only (≤ 512 UTF-8 bytes; no stderr, URL, diff, credential), one append per invocation, latest-wins | Corner Case | behaviour | High | DM-1, NFR-5, §20 |
| TC-LSTORE-002 | Record identity binding: attempt/session from the newest readable lane record; absent for a manual run outside a dispatch | Edge Case | behaviour | High | DM-1, RSK-3 |
| TC-LFOLD-001 | The refusal fold: `lane-push:failed` + `lane-push-cause:<cause>` in the reserved block, never truncated, inside the 16 budget | Negative | behaviour + conformance | High | AC-F3-1, DM-2, NFR-5 |
| TC-LFOLD-002 | The acceptance fold: `lane-push:pushed` beside the delivered `push:` verdict | Happy Path | behaviour | High | AC-F3-1, DM-2 |
| TC-LFOLD-003 | No fabrication: a foreign attempt, no record, and an unreadable store each contribute zero references | Edge Case | behaviour + conformance | High | AC-F3-1, NFR-8, RSK-3 |
| TC-LFOLD-004 | A disclosure is not a claim: recorded `lane-push:failed` + parity holds → truthful `pr-open`; parity fails → the delivered `push-parity-unmet` row | Corner Case | behaviour | High | AC-F3-1, DEC-5, F-3 |
| TC-LCAUSE-001 | The closed cause set: seven recordable causes, one two-source token (`protected-ref`), one guard-only token (`unsafe-branch`), and an engine that consumes the outcome only | Negative | behaviour + contract | High | DM-4, AC-F3-1, AC-F4-1, NG-3 |
| TC-LCAUSE-002 | `unclassified` is the honest fallback; `protected-ref` is the delivered literal with two sources (no alias); the raw failure text never leaves the seam | Corner Case | behaviour + structure | High | DM-4, AC-F4-1, §20 |
| TC-LSTATUS-001 | `dispatch status` carries the additive `lanePush` fact verbatim (pushed and failed-with-cause arms) | Happy Path | conformance | High | AC-F5-1, DM-3 |
| TC-LSTATUS-002 | Byte-identical absence: every delivered member and line unchanged when the fact is absent; additive human lines only when present | Regression | conformance + golden | High | AC-F5-1, NFR-4 |
| TC-LSTATUS-003 | Read posture and count: ≤ 1 additional bounded lane-push read (the delivered two-read cells become three), 0 network/process/fence/append/delete | Corner Case | conformance + behaviour | High | AC-F5-1, NFR-3, DEC-3 |
| TC-LMSG-001 | The final-message contract is carried by both product surfaces with separate assertions: `pm.md`'s `pr_creation` step and the built lifecycle prompt sentence; five markers unchanged | Contract | doc-conformance + structure | High | AC-F4-1, DEC-6 |
| TC-LMSG-002 | The ordered `pr_creation` tail is pinned: PR → URL note → `phase complete` → `push` → final message → STOP; no phase reopen, no retry, no authored commit | Contract | structure + doc-conformance | High | AC-F4-1, AC-F1-1, DEC-6 |
| TC-LOUT-001 | `dispatch <ref>` output stability: four-key text byte-identical; machine envelope unchanged (no lane fact in the envelope) | Regression | golden + structure | High | NFR-4, NG-3 |
| TC-LOUT-002 | The push command's own answer bounds: human ≤ 16 lines / 2 KiB, machine within the envelope bound, redaction unchanged | Corner Case | structure + behaviour | Medium | NFR-4, DM-5 |
| TC-LDOC-001 | Composition and documentation guards: the 29th prompt-required command, help entries, coverage inventory, M4 reference page, parity, `check:help`, `check:prompt`, entrypoint restriction | Regression | structure + checks | High | AC-F6-1, §8.1, RSK-7 |
| TC-LDOC-002 | The declared divergence (F-6) in four feature pages, the operations guide, and the test-spec coverage map | Manual | docs content check | High | AC-F6-1 |
| TC-LBND-001 | No-shell invariant and act boundedness at the seam: fixed argv shape (resolved push remote, single `HEAD:refs/heads/<branch>` refspec), no `--ff-only`, literal non-shell spawn, injectable 60 000 ms default, no force variant, no new config key | Corner Case | static + behaviour | High | NFR-1, NFR-6 |
| TC-LBND-002 | Added cost bound per lane end and per classification; zero added provider reads | Corner Case | behaviour | Medium | NFR-2 |
| TC-LGATE-001 | The standing lockstep changeset invariant: exactly one new changeset, five fixed-group packages, all minor, no version hand-edit | Regression | checks | High | NG-11, §18 |

### 5.2 Scenario Details

#### TC-LCMD-001 - The `push <ref>` grammar, both answer forms, exits 0/1, one act per invocation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F4-1, DM-5, NFR-1, NFR-4
**Test Type(s)**: Integration (real command path over injected seams), Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-command.test.ts` (new); command composition in `packages/cli/src/production.ts`; answer rendering beside `packages/cli/src/output/dispatch-text.ts`
**Tags**: @backend, @api

**Preconditions**:

- A composed program carrying the new `push` command (the production composition, not a test-local branch).
- Injected transport: a recording child runner whose scripted result is `status: 0` (accepted).
- A change record whose `branch:` declaration equals the single branch the convention read returns.

**Steps**:

1. Run `push <ref> --json`; assert `data.ref` and `data.repository`, and that `data.lanePush` carries exactly `verdict`, `branch`, `head`, `recorded`, `recordedAt` (no `cause`), with `head` a full-hex SHA and `recorded: true`.
2. Assert exit `0` and that the recorded runner shows exactly one invocation with the corrected argv shape: `["push", "<remote>", "HEAD:refs/heads/<branch>"]`, where `<remote>` is the push remote the command resolved (assert it equals the value the local config read yields), with **no `--ff-only`** and no force-capable flag anywhere in the array.
3. Run the same act with a transport scripted to reject (`status: 1`, bounded failure text); assert `verdict: "failed"`, `cause` present (one closed token), `recorded: true`/`false` per the append outcome, and exit `1` with **no top-level error identity** (a data-bearing refusal answer).
4. Assert the human form is a single `key=value` block over the same facts and that it names `ref`, `repository`, `lanePush`, `branch`, `head`, `recorded`, `recordedAt` plus `cause`/`recordedAt` only when present.
5. Assert grammar refusals: a missing, empty, and malformed positional are `input.value.rejected` before any branch read, act, or append (zero runner invocations, zero appends); an undeclared flag yields the delivered `fallback.invocation`.
6. Assert that no delivered error identity was added for the refusal path (the reported `kind`/`code` are drawn from the delivered table only).

**Expected Outcome**:

- The answer is the declared DM-5 shape with the declared exits: `0` exactly when `pushed` (already-up-to-date included), `1` for a refused act as a data-bearing answer; grammar refusals use the standard envelope.
- A refusal is never an error identity, mirroring the delivered lifecycle push-failure shape.

#### TC-LCMD-002 - Act-then-append ordering: `recorded: false` on a fence fault, no retry, no second act

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, RSK-6, NFR-1, NFR-2
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-command.test.ts` (new); store usage under the fence in `packages/core/src/app/`
**Tags**: @backend, @api

**Preconditions**:

- A store double whose `acquireFence` fails (or whose `append` fails) on the first bounded attempt.
- An injected transport that accepts the push and records its invocation count.

**Steps**:

1. Run `push <ref> --json` with the fence fault.
2. Assert the act happened exactly once (one runner invocation, argv recorded) **and** the answer reports `recorded: false` with no `recordedAt`.
3. Assert the command did **not** retry the act and did **not** push twice (invocation count still one), and that it performed at most one bounded fence attempt.
4. Assert no lane-push record exists afterwards (no partial, no rewritten record) and that the answer still carries the verdict, branch, and head.
5. Run the inverted order check on the success path: assert the append is observed **after** the child invocation in the recorded call order (act first, record second), so a record can never claim a push that never happened.
6. Re-invoke after a refusal record exists; assert another single act occurs (no suppression because a record exists) and no force-capable argument appears.
7. **Oversize-payload arm**: use a production-shaped payload for this change — it measures 439 of 512 bytes today (the production attempt id is 65 characters) — and push it over the bound with a long branch name; assert the act still happens exactly once, the append is refused, the answer reports `recorded: false` with no `recordedAt`, no record lands, and the refusal is indistinguishable in the answer from the fence-fault arm (the declared bound, not a hidden failure).
8. Assert the append-failure arm's answer keeps the three-key contract (`verdict`, `recorded`, and the branch/head facts) and that no diagnostic text, cause, or payload leaks into it.

**Expected Outcome**:

- Ordering is act-then-append with the `recorded: false` disclosure; the act is never duplicated and never suppressed.

#### TC-LPUSH-001 - Ticket AC-1 fixture: no wrapper, a fake remote, PR head equals branch head at session end, one push act, zero authored commits

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-5, NFR-1, NFR-2, G-1
**Test Type(s)**: Integration (fixture over an injected transport), conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push.test.ts` (new); the transport double is a **fake remote** built for this case (modelled on the delivered `tests/fixtures/dispatch/parity/process-runner.ts` recording convention), driving the real command path over a real temporary repository checkout. Fixture **setup** (creating the repository and its commits, resolving `HEAD`) runs git inline in the suite (`createTempCheckout`); the **act under test** never spawns git — the fake remote is the transport and starts no child process.
**Tags**: @backend, @api

**Preconditions**:

- A simulated lane session that runs no dispatch classification at all (no wrapper): the fixture drives the lifecycle steps directly, then the push.
- A real temporary repository checkout holding the change branch, with the committed ledger including the pm-notes PR-URL note and the `pr_creation` phase-completion commit.
- A **fake remote keyed by ref** standing in for the transport, which (a) records the ref it was asked to push to, (b) resolves `HEAD` against the fixture checkout **at call time** (it never receives a head from the test), (c) stores the resolved head per ref, and (d) applies the fast-forward rule to decide `accepted` or `non-fast-forward`. It refuses a requested shell by name.

**Steps**:

1. Record the checkout's commit ledger before the act: the count and the identity of each commit, including the URL-note and the phase-completion commit. Do not record a "remote head" — the fixture supplies none.
2. Run `push <ref>` and capture the answer.
3. Assert the fake remote recorded **exactly one** push invocation for the resolved change branch (the ref it was asked to push to equals the branch the command resolved and named in its answer).
4. Assert the fake remote's stored head for that ref equals **the checkout's branch head after the phase-completion commit** — the head the fake remote resolved itself at call time. Assert the durable record's `head` equals the same value, and that the value is read at act time (a commit landed before the act is included; no value was supplied by the test).
5. Assert no commit landed after the act, so the fake remote's head still equals the checkout's head when the session ends — the ticket AC-1 equality, now observed rather than stipulated.
6. Assert the commit ledger is unchanged: zero commits authored, zero amended, zero reset, zero rewritten (same count, same identities — the act pushes a head that already exists).
7. Assert the argv is `push <resolved-remote> HEAD:refs/heads/<branch>`: the resolved push remote as the repository argument, exactly one refspec with `HEAD` as the source, no `--ff-only`, no force flag and no `--force-with-lease`, and no second ref.
8. Assert the answer reports `pushed` for that head with `recorded: true`.
9. Assert the session ends with no attempt record for the fixture's dispatch (no classification ran) — and that nothing is stranded: the evidence is on the fake remote and the fact is durable.

**Expected Outcome**:

- The defect case is closed by fixture: with no wrapper alive, the lane's own last evidence commit reaches the remote, exactly one act occurs, and nothing is authored or amended.

**Notes / Clarifications**:

- **What the equality does and does not discriminate**: the transport double receives the literal refspec `HEAD:refs/heads/<branch>` (with the resolved remote as its repository argument) and returns an outcome only, so it cannot be handed a head; this fake remote resolves `HEAD` against the checkout at call time and stores the result per ref. Because it resolves `HEAD` itself, the equality **cannot** fail merely because the act pushed a different commit — git's own fast-forward semantics are outside what an injected transport can observe. What it does discriminate is the fixture's **sequencing and plumbing**: the ref actually pushed (step 3), the head the command **recorded** at act time (step 4), whether anything landed **after** the act (step 5), and whether the act authored or amended anything (step 6) — besides steps 6–8's argv, answer, and ledger/attempt facts. The substantive claim of AC-1 is therefore carried by those assertions; the head equality is a consistency check over a real checkout, not a proof of git's behaviour.
- PR-head equality (what the provider reports for the pull request) remains the engine-side parity read's question, not this fixture's: the fake remote observes the ref and head the act delivered, and the provider head is asserted where it is read (TC-LPUSH-003, TC-LFOLD-004). That residual is now closed by a real-git arm (TC-LGIT-001), which runs the seam's default runner against a local bare remote and proves the argv is one git accepts; this fixture keeps its injected transport for determinism.

**Postconditions**:

- One `dispatch.lane-push` record; no attempt record; no divergence.

#### TC-LPUSH-002 - Ticket AC-2 fixture (no-op): the second push of an equal head is accepted, not an error

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-1, G-2
**Test Type(s)**: Integration (fixture over an injected transport)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push.test.ts` (new); the seam arm joins the delivered `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- The TC-LPUSH-001 state after a first accepted push (branch head already on the transport).
- A second invocation of `push <ref>` for the same head; the transport scripts the git "Everything up-to-date" shape (`status: 0`, empty stdout).

**Steps**:

1. Re-invoke `push <ref>` without any intervening commit.
2. Assert the answer is `pushed` (not `failed`), exit `0`, and that **no error identity, no `cause`, and no retry** appear anywhere in either answer form.
3. Assert the transport recorded a second single invocation (the act is performed, never suppressed) and that exit 0 maps to `accepted` exactly as the delivered seam contract declares.
4. Assert a second durable record exists and the newest record is the new verdict (append-only, latest-wins; nothing rewritten).
5. Assert the wrapper-equivalent path: a `git push` of an equal branch through the delivered seam yields `accepted` with no error at any call site (the seam-level cell, exercised by the injected runner).

**Expected Outcome**:

- An already-equal branch is a non-error at every call site: `pushed` at the lane, `accepted` at the seam, and a silent success for a wrapper push.

#### TC-LPUSH-003 - Ticket AC-2 fixture (classification): `pr-open` with zero engine push invocations and `push:clean`

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-1, NFR-2, G-2, G-4
**Test Type(s)**: Conformance (registry row) + behaviour (real command path)
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-push.test.ts` (Existing – Update: one new row) + `tests/behaviour/dispatch-lane-push.test.ts` (new); registry at `tests/fixtures/dispatch/parity/cases.ts` (group `push-parity`, seam `push`)
**Tags**: @backend, @api

**Preconditions**:

- A seeded lane with a recorded lane-push verdict `pushed` for the attempt being classified (the record's `attemptId` equals the attempt identity).
- The classification runs through the **real command path** with the recording runner above; no test double replaces the parity port.
- Injected parity facts: the local head equals the open request's head (the lane's push already landed).
- An injected push runner wired into the **production composition** that records every invocation with its argv and result (not a stub, not a constant): the zero-push claim is the runner's own counter read after the classification.

**Steps**:

1. Drive `dispatch <ref>` through the real command path with the facts above.
2. Assert the result token is `pr-open` at exit `0`, and that the recording runner's **invocation counter reads exactly zero** after the classification (parity holds; `git push` is never called). The assertion must be a read of the runner's recorded invocations — a test-local constant such as `const pushActs = 0` is a vacuous assertion and is not acceptable here.
3. Assert the attempt carries `push:clean` (the delivered parity evidence) and, additionally, `lane-push:pushed` (this change's disclosure), each exactly once.
4. Assert the comparison record is the delivered `tracker-truth`/`match` shape and no divergence is opened.
5. Assert the machine envelope's `push` block is the GH-386 parity block (`verdict`, `localHead`, `remoteHead`, `parity`) and carries no lane-push member (NG-3).
6. Assert the parity read count is the delivered bound (one read on equal heads; no re-read, because no act occurred).

**Expected Outcome**:

- A wrapper-alive lane ends in the delivered `pr-open` shape with zero engine pushes and `push:clean`; the lane's own act is visible as a distinct `lane-push:pushed` reference, not as a second `push:` verdict.

#### TC-LPUSH-004 - The delivered push landscape is intact

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NG-4
**Test Type(s)**: Structure, manual content check
**Automation Level**: Semi-automated (structure assertions + a documented content review)
**Target Layer / Location**: `tests/structure/dispatch-push-envelope.test.ts` and the delivered GH-386 suites (Existing – No Change); the `pm` agent's `pr_creation` step and `doc/spec/features/feature-quality-gates-and-pr.md` (content review)
**Tags**: @backend, @docs

**Preconditions**:

- The delivered push paths at the branch point: `@pr-manager`'s pre-PR push, the engine's ensure-push at the `pr-open` arm, and the four bash wrappers' own pushes.

**Steps**:

1. Re-run the delivered GH-386 suites unchanged (`tests/behaviour/dispatch-push-parity.test.ts`, `tests/behaviour/dispatch-push-evidence.test.ts`, `tests/conformance/dispatch/dispatch-parity-push.test.ts`, `tests/structure/dispatch-push-envelope.test.ts`): every delivered expectation must hold without edit beyond the mechanical fixture additions listed in §7.
2. Assert the ensure-push arm still derives `pr-open` only from a readable equality and still performs at most one act with one re-read (§7's broad-update note covers any fact addition only).
3. Assert the `pm` agent definition still instructs the PR workflow's own push before create/update, and that the new step is appended after the phase completion (TC-LMSG-002 pins the order).
4. Assert no delivered push path was removed, reordered, or turned into an error: the pre-PR push instruction, the arm-8 act, and the wrapper pushes are all present in their delivered positions.
5. Record the content review in the change's pm-notes `notes:` evidence (one line naming the pages reviewed).

**Expected Outcome**:

- The change adds a third, lane-side act and leaves the two wrapper-side acts exactly as delivered — the regression contract F-2 declares.

#### TC-LGIT-001 - Real-git arm: the seam's default runner over a temporary checkout and a local bare remote

**Scenario Type**: Happy Path + Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F2-1, NFR-1, NFR-6, DM-4, RSK-4
**Test Type(s)**: Integration (real git, real child process, local bare remote), Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-real-git.test.ts` (new), over the delivered temporary-repository fixture `tests/fixtures/dispatch/parity/temp-repo.ts`; the seam at `packages/adapters/src/git/push.ts` with **no** `childRunner` override
**Tags**: @backend, @git

**Preconditions**:

- A temporary checkout created by the delivered fixture helper, holding the change branch with at least two commits, and a **local bare remote** (a directory path, never a URL) seeded empty.
- The checkout's config carries the push remote in each of the four precedence positions across sub-arms: `branch.<branch>.pushRemote`; `remote.pushDefault`; `branch.<branch>.remote`; and no configuration at all (the `origin` fallback, with `origin` present).
- A second temporary clone of the bare remote, used only to move the remote branch for the `non-fast-forward` arm.
- The seam is constructed with its **default runner and default timeout** — no injected child runner, no injected result. This is the one layer where a real git process is the point.

**Steps**:

1. First push: call the seam with the change branch; assert `accepted`, assert the bare remote's `refs/heads/<branch>` now equals the checkout's `HEAD`, and assert exit-status facts only through the outcome (no stderr parsing).
2. Second push of the same head: assert `accepted` again (git exits 0 with "Everything up-to-date") and that the remote ref is unchanged — the accepted-idempotence contract, proven by git rather than by a scripted exit code.
3. `non-fast-forward`: in the second clone, advance and push the branch so the remote moves, then push from the original checkout; assert the outcome is `rejected` with `detail: non-fast-forward` and that the remote ref did not move.
4. Guard refusals (defence in depth, seam layer): call the seam with an unsafe name and with each protected member (`main`, `main-tools`, `HEAD`); assert `rejected` with `detail: unsafe-branch` / `protected-ref`, that the bare remote gained no ref, and that no child process ran (observable through the fixture's process accounting: the guard precedes the runner).
5. Missing destination: with no push remote configured anywhere and no `origin`, assert `rejected`/`failed` with `detail: remote-unavailable` (the spec v1.6 DM-4 classification of `fatal: No configured push destination`), never `unclassified`, and that nothing on disk changed.
6. Push-remote precedence: for each of the four configuration sub-arms assert the seam pushed to the **expected** remote (the bare remote that received the ref), so the resolution order is proven against real git configuration rather than asserted in prose.
7. No network: assert every configured remote is a local filesystem path (`git remote -v` yields no `://`), so the case cannot reach a network even if the credential domain is unconfigured.
8. Determinism and hygiene: run the whole matrix twice with the same fixture, assert identical outcomes, and dispose both temporaries (no refs, no directories left behind).

**Expected Outcome**:

- The corrected argv (`git push <resolved-remote> HEAD:refs/heads/<branch>`, no `--ff-only`, no force) is proven to be one git accepts: first push accepted, repeat accepted, moved remote a `non-fast-forward`, guard names refused before any child, and a missing destination classified `remote-unavailable`. The injected-transport residual for AC-F1-1/AC-F2-1 is closed here.

**Notes / Clarifications**:

- This case exists because every other push proof injects a runner that returns scripted text: an injected runner validates the argv **literally**, not git's grammar, so an argv git rejects would pass every other case (the review's F-1/F-2). This is the only case that runs the seam's default runner.
- The bare remote is a local path, so "no network" holds at the transport level; the case is deterministic and needs no credential. A provider-side 403 is not constructible locally and is covered at classification level (TC-LCAUSE-001's HTTP-403 instance).
- The four precedence sub-arms are configuration facts, not code branches: the seam performs one bounded local config read and passes the result as the repository argument.

#### TC-LRES-001 - Declaration and convention read disagree

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-7
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-resolution.test.ts` (new); resolution over the delivered `branchConvention`/`selectMatchingBranch` semantics
**Tags**: @backend, @api

**Preconditions**:

- A change record whose `branch:` declaration names branch A.
- A branch read whose only convention match is branch B (both branches exist locally, only B matches the work-item convention).
- A recording transport.

**Steps**:

1. Run `push <ref>`.
2. Assert the refusal is the delivered `input.value.rejected` row (exit `1`) carrying a typed refusal that **names the observed state** (the declaration value and the convention read's result), bounded and single-line.
3. Assert zero transport invocations, zero appends, and zero fence acquisitions.
4. Assert no durable record exists for the ref afterwards.
5. Assert the message names the next action (align the declaration or the branch) per the error-message rule.

**Expected Outcome**:

- A disagreement is a refusal, never a resolution: nothing is pushed and nothing is recorded.

#### TC-LRES-002 - The convention read matches no branch

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-7
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-resolution.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- No `branch:` declaration in the change record, or a declaration present; either way the branch read returns zero convention matches (for example the checkout is on a mainline branch and only a foreign-convention branch exists).
- A recording transport.

**Steps**:

1. Run `push <ref>`.
2. Assert the typed refusal names the "no matching branch" state and the ref used for the convention match.
3. Assert **no current-checkout fallback**: the command never pushes the checkout's `HEAD` branch by name when the convention read matched nothing (the transport is not invoked, and no ref is guessed).
4. Assert zero invocations, zero appends.
5. Repeat with a declaration present and the convention read empty: the declaration alone is still insufficient (the two sources are cross-checked, not alternated).

**Expected Outcome**:

- The "no branch" state is a named refusal; a guessed ref is structurally impossible.

#### TC-LRES-003 - The convention read matches more than one branch

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-7, RSK-9
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-resolution.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- Two local branches matching the work-item convention (`feat/<ref>/a` and `fix/<ref>/b`), with no declaration that disambiguates them, and no merged-head tiebreaker available to this act.
- A recording transport.

**Steps**:

1. Run `push <ref>`.
2. Assert the ambiguous refusal names the candidate branches (bounded list) and exits `1` under the delivered input row.
3. Assert zero invocations and zero appends; assert the refusal does not silently select the current checkout's branch.
4. Assert the delivered selection semantics are reused unchanged, not re-derived: the `none | unique | ambiguous` outcome shape is the one `selectMatchingBranch` returns (a structural pin over the domain module, so a second selection rule fails by name).

**Expected Outcome**:

- Ambiguity is a refusal with the candidates named; exactly one rule exists, and it is the delivered one.

#### TC-LRES-004 - The safe-ref refusal on the command path, the protected-set predicate, and the two layers

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NG-1, NFR-6, NFR-7, RSK-10, §21
**Test Type(s)**: Integration (real command path over injected seams), Contract, unit (predicate)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-resolution.test.ts` (new) for the command path, a unit cell for the shared predicate, plus the seam cells at `packages/adapters/src/git/push.ts` for the direct-consumer layer. The predicate's home is **`packages/core/src/contracts/dispatch.ts`** — a contracts module that already exports functions (the `push:<verdict>` builder) and is not pinned declaration-only — imported by the adapters push seam (allowed direction) and by the command. `PROTECTED_REF_NAMES` **stays in `packages/core/src/contracts/closeout.ts`**, untouched, so that module's declaration-only pins (`tests/structure/closeout-contract.test.ts`, `tests/structure/port-neutrality.test.ts`) stay green. The git index, merge and watchdog adapters keep their own private copies, unchanged.
**Tags**: @backend

**Preconditions**:

- Arm a1 (command path): a branch fact that the convention read resolves uniquely but whose name is git-legal and outside the shared predicate's alphabet — a name containing a character the predicate forbids (for example `~`, `^`, `:`, `?`, `*`, `[`, `\`, or whitespace) injected as a branch fact, so it is a real convention match the predicate then refuses. (Names starting with `-` or containing `..` are not constructible here: the convention read would not match them.)
- Predicate cell (unit): the two checks are called separately, with no command, transport, or store. The **safe-ref predicate** is called with an unsafe name (refused) and with each protected member `main`, `main-tools`, `HEAD` — **accepted**, because the alphabet is the only thing it checks. The **protected-name-set membership check** is called with the same members (refused) and with an alphabet-legal conventional name (accepted). Together the two checks are "the command's guard".
- A recording transport that would report the invocation if one happened, and a counted store that would report an append.
- The shared predicate is unified **for the push seam and its command only**; the identical private copies in the git index, merge and watchdog adapters are out of scope and are asserted unchanged, not unified.

**Steps**:

1. Run `push <ref>` for arm a1.
2. Assert the refusal is the typed input refusal of AC-F1-2 that **names the observed branch**, exit `1`, **zero child invocations** (resolution refuses before any act), zero appends, and **no `dispatch.lane-push` record**.
3. Assert the argv, had it run, could not have carried a force flag, a `--ff-only`, or a second ref — the pre-act predicate and the fixed argv shape are both asserted, not just one.
4. Assert the refusal does not consume the seam's recorded-rejection vocabulary as its own answer shape: the answer is an input refusal with no verdict/`cause` pair, and no record exists to carry a cause (`unsafe-branch` is never a record's cause; `protected-ref` reaches a record only from a server-side decline, TC-LCAUSE-001 step 3).
5. **Predicate cell, protected set is defence in depth**: call the two checks separately. Assert the **safe-ref predicate accepts** `main`, `main-tools`, `HEAD` and an alphabet-legal conventional name — a predicate that refused a protected name would be a different predicate, and this assertion is what stops the set being folded into it. Assert the **membership check refuses** those three members and accepts the conventional name. Assert the command composes the two checks (the guard) and imports both the predicate and the protected set rather than re-declaring either (one home for the push seam and its command; the index/merge/watchdog copies stay unchanged, R10).
6. **The protected-set arm is structurally unreachable on the command path**: assert that every name a convention-resolved selection can yield contains a slash (the delivered convention is `^[a-z][a-z0-9-]*/<ref>/.+$`, and `selectMatchingBranch` filters by it) and that no protected member (`main`, `main-tools`, `HEAD`) contains one — so no resolved name can equal a protected name, and the command-path membership check is defence in depth rather than an exercisable refusal. A fixture that injected `main` as a branch fact would resolve `none` and refuse for "no match" (TC-LRES-002), which is why no such arm exists here.
7. **Direct-consumer layer**: invoke the seam directly (the engine's path) with an unsafe name and with each protected member; assert it returns `rejected` with `detail` `unsafe-branch` / `protected-ref` **before the child runner is called** (zero child invocations), that no lane-push record is written on that path, and that the engine's own attempt records the delivered `push:failed` parity evidence instead (asserted by the delivered parity suites re-run in TC-LPUSH-004).

**Expected Outcome**:

- The command-reachable guard refusal is the **safe-ref** arm: a convention-resolved name the safe-ref predicate rejects is refused pre-act, with no child, no act, and no record. The guard's second check, protected-name membership, is proven at the predicate level and on the seam's direct path; it is structurally unreachable from a resolved branch and writes no record there. The seam's guard survives for a direct consumer only, where it is parity evidence and never a lane-push record.

**Notes / Clarifications**:

- Spec F-1 "One predicate, two layers" (read with the reachability correction): the predicate is unified for the push seam and its command only, and a resolved name can never be an exact member of the protected set, so the command-path protected check is defence in depth. The pre-act refusal leaves **no durable fact** — `dispatch status` shows no `lanePush` and the attempts digest shows nothing — which is spec RSK-10's declared residual; the final message is its only immediate disclosure (CB-1). This case asserts that silence deliberately.
- TC-LCAUSE-001 pins the seam vocabulary, the **seven** recordable causes (including `protected-ref` from a git-reported decline — the only command-reachable source of that token), and the guard-only `unsafe-branch`; the pair asserts that neither layer acquires the other's artifact and that the two sources of `protected-ref` stay distinguishable by child count and record presence.

#### TC-LRES-005 - The unique-resolution arms

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F1-1, NFR-7
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-resolution.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- Arm A: the change record declares `branch: feat/<ref>/slug` and the convention read returns exactly that one branch.
- Arm B: the change record carries no `branch:` key (the common delivered shape) and the convention read returns exactly one branch.
- A recording transport that accepts.

**Steps**:

1. Run `push <ref>` for arm A; assert exactly one invocation naming the declared branch and `pushed`.
2. Run arm B; assert the same, with the branch taken from the convention read.
3. Assert both arms push the same branch name and that the durable record's `branch` matches the resolved name in both.
4. Assert the resolution reads the declaration as an **opaque value** (no schema change, no typed promotion): a declaration carrying a 200-character value still resolves or refuses on the string, and the change record is not rewritten.

**Expected Outcome**:

- Exactly one agreement resolves; the declaration stays optional and opaque (NG-9), and the convention read is the structural second source.

#### TC-LSTORE-001 - The `dispatch.lane-push` payload is bounded and identifier-only

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-1, NFR-5, §20, RSK-6
**Test Type(s)**: Integration (real command path), Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-record.test.ts` (new); the record contract in `packages/core/src/contracts/dispatch.ts`, read through the delivered state store
**Tags**: @backend, @api

**Preconditions**:

- One accepted act and one refused act (each produced by a real command-path invocation), each appending one record.
- Boundary fixtures: the longest full-hex SHA form, a maximum-length branch name, and a deliberately verbose git stderr payload in the transport result (the seam must classify it away).

**Steps**:

1. Read the appended records back through the store; assert the exact member set of Appendix B and its declaration order, with `cause` present only for `failed`.
2. Assert the whole serialized payload is ≤ 512 UTF-8 bytes in every arm (boundary fixtures included), measured on the stored JSON bytes.
3. Assert every member is single-line and draws only identifiers/SHAs: `head` full-hex, `verdict` in `{pushed, failed}`, `cause` in the closed set, `ref`/`repository`/`branch`/`attemptId`/`sessionId` identifier-shaped, `recordedAt` an ISO instant.
4. Assert the forbidden content is structurally absent: no `stderr`, no remote URL, no diff, no prompt, no transcript, no credential, no provider payload — including in the arm where the transport returned a stderr string carrying a URL and a token-shaped fragment (the seam discards it).
5. Assert one append per invocation and append-only history: two invocations produce two records under the declared key prefix, the newest is the fact, and no earlier record is rewritten or deleted.
6. Assert the key is per work-item reference (`dispatch.lane-pushes:<ref>`), so two refs never share a record family entry.
7. **Head source**: assert the record's `head` equals the invocation checkout's `HEAD` read at act time (the delivered local checkout/head read) — including the arm where the fixture advances the checkout after the read but before the append, where the stored value stays the head that was read — and that no transport-reported value can reach the member (the seam returns an outcome only).
8. Assert the record's `cause`, when present, is one of the **seven recordable** causes — `protected-ref` is permitted (source (b)) — and that `unsafe-branch` never appears on a record (guard-only vocabulary, TC-LCAUSE-001 step 2).
9. **Validator-level refusals** (the store-side guard, not a re-run of the happy arms): append each malformed record through the delivered append path and assert each is refused as `state.write.failed` with no record landing — (a) `verdict: "failed"` with `cause: "unsafe-branch"`; (b) a ninth, undeclared cause token; (c) a `cause` on `verdict: "pushed"`; (d) an empty or short `head`; (e) a payload over the 512-byte bound (a long branch name or a 64-hex repository identity pushed past the bound). Assert the well-formed record is accepted in the same run, so the refusals are not the validator rejecting everything.

**Expected Outcome**:

- The record is a bounded, append-only, identifier-only fact; no transport text can reach it.

#### TC-LSTORE-002 - Record identity binding to the lane

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, DM-1, RSK-3
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-record.test.ts` (new); the lane record read (`DISPATCH_LANE_RECORD_KIND`, key `dispatch.lanes:<ref>`) as the identity source
**Tags**: @backend, @api

**Preconditions**:

- Arm A: a readable newest `dispatch.lane` record for the ref carrying `attemptId` and `sessionId`.
- Arm B: an older lane record with a different attempt identity (the newest wins).
- Arm C: no readable lane record (a manual run outside any dispatch).
- Arm D: an unreadable lane store.

**Steps**:

1. Arm A: assert the record's `attemptId`/`sessionId` equal the newest lane record's values.
2. Arm B: assert the binding uses the newest record, not the oldest, and never a mixture of the two.
3. Arm C: assert the record is written **without** `attemptId`/`sessionId` (members absent, not null, not empty strings) and that no status answer can attribute it to a lane.
4. Arm D: assert the act still happens and the record still lands without the identity members, and that the answer does not fail on the unreadable lane store (the identity is best-effort, the act is not).
5. In every arm assert the act was performed once and the record contains the pushed head.

**Expected Outcome**:

- The fact is bound to the lane identity when one is readable and is honestly identity-less when none is; the fold can therefore match on equality only.

#### TC-LFOLD-001 - The refusal fold: `lane-push:failed` + `lane-push-cause:<cause>` in the reserved block

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, NFR-5, NFR-8, DEC-2, DEC-5
**Test Type(s)**: Behaviour (real command path) + Conformance (registry row)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-fold.test.ts` (new) + `tests/conformance/dispatch/dispatch-parity-push.test.ts` (Existing – Update: refusal-fold row); fold site `packages/core/src/app/dispatch.ts` (the reserved-evidence block), read side `readDispatchAttempts`
**Tags**: @backend, @api

**Preconditions**:

- For each of the **seven recordable causes** (`non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `protected-ref` from a git-reported decline, `unclassified`): a durable lane-push record for the attempt being classified, verdict `failed`, cause = the arm's token. `unsafe-branch` is out of scope here by construction: the command cannot write a record for it (guard-only, F-1, DM-4, TC-LCAUSE-001 step 2).
- Injected parity facts: the local head is ahead and the engine's ensure-push cannot reconcile (or parity is unreadable per the delivered boundary), so the delivered failure/undecidable path is reachable — the fold is observed beside it, not instead of it.
- A disclosure-stress fixture: an attempt whose evidence slice is filled toward the 16-reference budget (the delivered `dispatch-push-evidence.test.ts` technique).

**Steps**:

1. For each of the **seven recordable causes**, drive **one full classification** (a real command-path invocation, one attempt record each) and read that attempt (`unsafe-branch` is unreachable here: no lane-push record can carry it). Calling a helper that computes evidence references for a synthetic attempt does not satisfy this step: the fold must be observed at the attempt the engine actually appended.
2. Assert exactly one `lane-push:failed` and exactly one `lane-push-cause:<cause>` reference per attempt, with the cause equal to the recorded token (no paraphrase, no truncation of the token).
3. Assert the references sit in the **reserved** block, with an explicit **overflow arm**: fill the evidence slice to the full `DISPATCH_MAX_EVIDENCE_REFS` (16) with ordinary slice references (the disclosed stress technique of the delivered `tests/behaviour/dispatch-push-evidence.test.ts`), classify one refused cause, and assert `lane-push:failed` and `lane-push-cause:<cause>` are still present in the rendered evidence while the ordinary slice references are the ones cut. The arm is not optional: without it the reservation claim is untested.
4. Assert the total evidence-reference count is ≤ `DISPATCH_MAX_EVIDENCE_REFS` (16) in every arm, and that the reserved block grew by at most two members over the delivered reservation — the post-change maximum is seven of sixteen (five delivered disclosures plus at most two lane-push references; spec F-3 "The evidence", DM-2, NFR-5, Appendix C). Asserted as membership and bound, so a correct block is proven by surviving the slice rather than by arithmetic on a literal count.
5. Assert **no vocabulary growth**: the token, outcome, exit, comparison reason, corroboration map, derivation arms, and attempt key set are byte-identical to the branch point; the only delta is the evidence references (the closure assertions live in TC-LFOLD-003's sibling structural pin).
6. Assert exactly one lane-push store read occurred for the classification.

**Expected Outcome**:

- A refusal is durable, named, and never truncated away, and it is expressible purely as evidence references — no new classification vocabulary.

#### TC-LFOLD-002 - The acceptance fold: `lane-push:pushed`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, RSK-8
**Test Type(s)**: Behaviour (real command path)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-fold.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- A durable lane-push record `pushed` for the attempt identity being classified; no `cause` member.

**Steps**:

1. Classify; read the attempt.
2. Assert exactly one `lane-push:pushed` and **no** `lane-push-cause:` reference.
3. Assert the delivered `push:` verdict reference is present and distinct (for example `push:clean` when parity already held, `push:pushed` when the engine reconciled), so an operator can tell which act produced which fact (RSK-8).
4. Assert the two families never collapse into one prefix and that no reference is duplicated.

**Expected Outcome**:

- The lane's own accepted act is visible beside the engine's parity verdict, as two different questions answered.

#### TC-LFOLD-003 - No fabrication: foreign attempt, no record, unreadable store

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-8, RSK-3
**Test Type(s)**: Behaviour (real command path) + Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-fold.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- Arm A: a lane-push record whose `attemptId` is a different attempt (a resumed or re-dispatched lane).
- Arm B: no lane-push record at all (pre-change store).
- Arm C: an unreadable/torn lane-push store.
- Arm D: a record in another repository's family with a matching ref and attempt id string.

**Steps**:

1. Classify each arm; assert the attempt carries **zero** `lane-push:` references in every arm, and no `lane-push:pushed` is synthesized.
2. Assert the classification itself is unchanged (same token, outcome, exit, comparison, corroboration as the same fixture without the arm).
3. Assert arm C never blocks classification: the unreadable store contributes nothing and no `state.*` identity is surfaced in place of classification.
4. Assert arm D is excluded by the repository filter before any attempt-identity match.
5. Assert each classification performed **exactly one** bounded lane-push read (NFR-8's bound) and no additional store read class.
6. Assert append-only history is untouched by the read (no rewrite, no delete).

**Expected Outcome**:

- Absence stays absence: the fold never invents a lane push, never blocks classification, and costs exactly one bounded read.

#### TC-LFOLD-004 - A disclosure is not a claim

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DEC-5, RSK-1
**Test Type(s)**: Behaviour (real command path)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-fold.test.ts` (new)
**Tags**: @backend, @api

**Preconditions**:

- Arm A: a recorded `lane-push:failed` (cause `non-fast-forward`), but at classification the local head equals the open request's head (the wrapper or a later attempt reconciled it).
- Arm B: a recorded `lane-push:failed` and parity genuinely unmet (the engine's ensure-push also fails).
- Arm C: a recorded `lane-push:pushed` but parity unmet (a commit landed after the push, or the remote moved) — the delivered row's territory.

**Steps**:

1. Arm A: assert the classification is the truthful `pr-open` at exit `0`, with `push:clean` evidence, and that the recorded `lane-push:failed` is still present as history — it turns no success into a failure.
2. Arm B: assert the delivered lifecycle push-failure row fires exactly as delivered (result `failed`, outcome `failed`, exit `1`, one attempt, comparison `push-parity-unmet`), and that `lane-push:failed` + cause appear beside it as extra evidence — one failure, not two.
3. Arm C: assert the same delivered row (a lane push cannot mask a genuine divergence), and that the stale `lane-push:pushed` is *not* rewritten or deleted (append-only history; the instant is the disclosure).
4. Assert in every arm that no new failure row, token, or comparison reason exists and no divergence is opened for the lane-push disclosure alone.

**Expected Outcome**:

- The two references answer different questions: the fold is a disclosure, and only a readable inequality or a refused engine act produces the failure.

#### TC-LCAUSE-001 - The closed cause set: seven recordable causes, one two-source token, one guard-only token, and an outcome-only engine

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-3, DM-4, AC-F3-1, AC-F4-1, NFR-2, RSK-4, NG-3
**Test Type(s)**: Behaviour (real command path over injected seams) + Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-causes.test.ts` (new) for the command path, plus `tests/behaviour/dispatch-push-parity.test.ts` (Existing – Update: the seam-level class table) and `tests/checks/dispatch-contract-invariance.test.ts` (the vocabulary pin); seam at `packages/adapters/src/git/push.ts`. The shared predicate lives in **`packages/core/src/contracts/dispatch.ts`** (a contracts module that already exports functions, which the adapters seam may import); the cause classification itself stays in `packages/adapters/src/git/push.ts`, and `PROTECTED_REF_NAMES` stays in `packages/core/src/contracts/closeout.ts`, untouched
**Tags**: @backend

**Preconditions**:

- **Seven recordable child-act outcomes**, each a rejection or failure the command can record: `non-fast-forward`; `auth-rejected`; `remote-unavailable`; `spawn-failed` (the runner is invoked and reports the start failure); `timed-out`; `protected-ref` **from source (b)**, a protection/hook decline git reports; and an unclassifiable rejection (`unclassified`). Two of those classes carry a second, real-git-wording instance each: **a missing push destination** (`fatal: No configured push destination`, and the vanished-remote path) → `remote-unavailable`; and an **HTTP-403 permission failure** (`unable to access … returned error: 403`, `Write access to repository not granted`) → `auth-rejected`, never `remote-unavailable`.
- **One pre-act guard name** on the command path: an unsafe (alphabet-rejected) name, the guard-only `unsafe-branch` — refused by the command's resolution before any child (TC-LRES-004 arm a1).
- **One guard-check fact**: the safe-ref predicate **accepts** each protected-set member (`main`, `main-tools`, `HEAD`) — they are alphabet-legal — and the **membership check refuses** them. No conventional, resolved branch name can equal a protected name, so this second check is defence in depth, not an exercisable command-path arm (TC-LRES-004 steps 5–6).
- The closed token set from DM-4 as the expected-value table: `protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified` — eight tokens, seven of them recordable.

**Steps**:

1. **The vocabulary pin**: assert the closed set has exactly the eight declared members and that **seven are recordable causes**; assert the outcome union is unchanged (`accepted | rejected | failed | timed-out`); assert that a ninth token, or the old `protected-branch` spelling, fails by name.
2. **`unsafe-branch` is guard-only**: on the command path an unsafe name is the pre-act refusal (no child, no record, no verdict/cause); a direct seam call with the same name returns `rejected` with `detail` `unsafe-branch` **before the child runner is called** (zero children). Assert structurally that no lane-push record can carry `unsafe-branch`, in any arm.
3. **`protected-ref` has two sources, one token — and only one of them is reachable**: for source (a) (protected-set membership) assert the guard-check fact — the safe-ref predicate accepts each protected member and the membership check refuses it, and no convention-resolved name can equal one, so **zero child invocations and no record** follow from the rule itself; say plainly that source (a) is defence in depth and **not an exercisable command-path arm**. For source (b) (a protection/hook decline git reports) assert the command path — **exactly one child invocation, verdict `failed`, one record appended with `cause: protected-ref`**. Assert both sources produce the **same token** while source (a) has no record at all and source (b) has one, so the token alone never implies a layer or a record.
4. **Child-act mapping**: for each of the seven recordable outcomes — including the missing-destination and HTTP-403 instances — run `push <ref>` and assert the answer's `verdict` is `failed`, its `cause` is the expected token, and the seam's `detail` matches — never `git-exit-<n>`, never an exit-code string, never raw text. Assert in particular that a 403 is **not** classified `remote-unavailable` (the ticket's "missing permission" class must be reachable).
5. **Child-process accounting**: assert **exactly one** child invocation attempt for each of the seven recordable outcomes (for `spawn-failed` the runner is invoked and reports the start failure), and **zero** for the command-path safe-ref refusal; the count keys on the **source**, never on the token alone — `protected-ref` is the one token with a zero-child non-arm (source (a), structurally unreachable) and a one-child recordable arm (source (b)).
6. **Artifact set (command path)**: for each of the seven recordable outcomes assert one `dispatch.lane-push` record appended with that `cause` and the answer's `recorded`/`recordedAt` consistency; assert `unsafe-branch` is absent from every record, and that a record's `cause` is always one of the seven.
7. **The engine consumes the outcome only (NG-3)**: drive a classification in which the engine's parity act runs with two different rejection causes; assert the engine's parity verdict, its `push:<verdict>` evidence, the attempt token/outcome/exit, and the comparison record are **identical** for both causes, that the machine envelope carries **no** cause member anywhere, and that the cause appears only in the command's answer, the `dispatch.lane-push` record, the folded `lane-push-cause:<cause>` reference, and — at rest — the `dispatch status` fact carried verbatim from that record.
8. Assert a `spawn-failed` result maps to the `failed` outcome with cause `spawn-failed` (not to `rejected`), and a timeout maps to `timed-out` with cause `timed-out`.

**Expected Outcome**:

- Eight closed tokens, seven of them recordable causes. `unsafe-branch` is guard-only and can never reach a record; `protected-ref` is one token with two sources that are told apart by child count and record presence, not by the token — and only the server-side source is exercisable. The engine consumes the outcome alone and surfaces no cause on any of its surfaces.

**Notes / Clarifications**:

- **Why `protected-ref` is recordable**: the ticket's required behaviour 3 names "a protected branch" as a cause that must be named, and a server-side protection/hook decline is observable only through the child act — its raw text is classified inside the seam and never leaves it. The protected-name-set membership check is the other, pre-act source of the same token (the safe-ref predicate accepts the name; the membership check is what refuses it). Both are asserted, so neither reading can silently displace the other.
- Spec F-1 "One predicate, two layers", DM-4 and Appendix E draw the split: the seam names a cause for both of its callers, and the engine discards it (F-4, section 22, NG-3). An earlier revision asserted the engine named a cause — unassertable, and it would have required violating NG-3; step 7 asserts the observable truth instead.
- The shared predicate is unified for the push seam and its command only; identical private copies in the git index, merge and watchdog adapters are out of scope and unchanged.
- The added-cost assertion (NFR-2) rides TC-LBND-002; the raw-text/privacy boundary rides TC-LCAUSE-002.

#### TC-LCAUSE-002 - `unclassified` is the honest fallback; raw text never leaves the seam

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-4, AC-F4-1, §20, RSK-4
**Test Type(s)**: Behaviour + Contract (structural scan)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-causes.test.ts` (new) + `tests/checks/dispatch-contract-invariance.test.ts` (Existing – Update: the cause-set pin)
**Tags**: @backend

**Preconditions**:

- A scripted rejection whose text matches none of the declared patterns, and one whose text is locale-flavoured or provider-specific (the RSK-4 direction).
- A scripted rejection carrying a remote URL with user info and a token-shaped fragment.

**Steps**:

1. Assert the outcome is `rejected` with cause `unclassified` — named as a refusal, not silently swallowed and not reported as success.
2. Assert the raw failure text appears in **no** member of the answer, the durable record, the status fact, or the evidence references (a byte-level absence assertion over each serialized artifact).
3. Assert a pattern-drift arm (unrecognized wording) still yields exactly one closed token and never a thrown error or an empty `detail`.
4. Assert the **classification table's** cause literals live in one declared place and are imported rather than re-typed at call sites. The pin is scoped to that table: the seam's guard literals stay where they are (they are not moved by this change) and `protected-ref` also occurs in the closeout domain, so a tree-wide "appears once" assertion would be wrong and is not made.
5. Assert the protected literal is the delivered `protected-ref` — the same string the closeout ref guard publishes — that it is **one token with two sources** (protected-set membership: policy-level, unreachable from a resolved name, no record; a git-reported protection/hook decline: child-act, one record), and that no `protected-branch` alias, mapping, or second spelling exists in the seam, the contracts, the answer, or the record (a vocabulary pin: the eight-member set is the whole set, and a rename is a contract change, not a test detail).
6. Assert `unsafe-branch` is the **guard-only** token: it appears as the seam's `detail` and in no record, answer verdict/cause pair, or folded reference (a structural absence pin), and no alias or second spelling for it exists either.
7. Assert no credential-shaped or URL-shaped substring survives into any artifact.
8. Assert the fallback still names a refusal **as a refusal** on the command path: `unclassified` yields `failed`, a record, and a `lane-push-cause:unclassified` fold candidate — the honest fallback never degrades into silence or a success claim.

**Expected Outcome**:

- A wrong-but-closed label is the declared residual; a leak is not, and the raw text is structurally absent.

#### TC-LSTATUS-001 - `dispatch status` carries the additive `lanePush` fact verbatim

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-3, DEC-3
**Test Type(s)**: Conformance (real operator command path over a counted store)
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts` (Existing – Update: two new cases) + `tests/behaviour/dispatch-status-lane-push.test.ts` (new, the projection-level arm modelled on `dispatch-status-park.test.ts`); read in `packages/core/src/app/dispatch-lane-view.ts`
**Tags**: @backend, @api

**Preconditions**:

- A seeded lane (active) with attempt identity A, and a lane-push record for attempt A: arm 1 verdict `pushed` (head H, instant T); arm 2 verdict `failed` with cause C.
- Arms: a second, older record for attempt A with a different verdict (newest wins); a record for attempt B (must not be read); a record in another repository (must not be read).

**Steps**:

1. Run `dispatch status <ref> --json` for arm 1; assert `data.lanePush` equals `{verdict: "pushed", branch, head: H, recordedAt: T}` with **no** `cause` member and no extra member.
2. Assert the values are carried verbatim from the record (no re-derivation, no truncation, no reformatting of the instant).
3. Run arm 2; assert `cause` is present with the recorded token and the rest unchanged.
4. Run the newest-wins arm; assert the newest matching record is the fact.
5. Run the foreign-attempt and foreign-repository arms; assert the fact is absent in both (and that no answer attributes a foreign act to this lane).
6. Assert the `head` member is never presented as a live remote head: the answer's semantics are a recorded snapshot (asserted at the projection level: no code path compares it to a local head, and no member claims equality).

**Expected Outcome**:

- An operator learns, without comparing heads, whether and for which head the lane's last push was accepted — and when it was refused and why.

#### TC-LSTATUS-002 - Byte-identical absence; additive human lines only when present

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-4, §8.5
**Test Type(s)**: Conformance + Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts` (the machine/human presence matrix) + `tests/golden/dispatch-status-worktree.test.ts` (Existing – Update: the **status** golden host — its new snapshot is `tests/golden/status-lane-push.txt`; `tests/golden/dispatch-text.test.ts` holds only `dispatch <ref>` cells and is not touched by this case) + `tests/behaviour/dispatch-additive-stability.test.ts` (Existing – Update: the new optional member joins the additive-only pin)
**Tags**: @backend

**Preconditions**:

- The delivered status fixtures: a live lane, a stale lane, a terminal lane, an absent ref, an unreadable store, a pre-change store (no lane-push family), a lane with a worktree path, and a lane with an open park.
- The facts-absent arms: no lane for the ref; a lane but no lane-push record; a lane and a record for another attempt.

**Steps**:

1. Render machine and human status for every absent arm and compare byte-for-byte against the delivered branch-point output (the committed status goldens in `tests/golden/status-*.txt`, read by the status host `tests/golden/dispatch-status-worktree.test.ts`; captured strings for the arms without a golden).
2. Assert every delivered member and line is unchanged and in the same order, including the park lines and the worktree line.
3. Render the present arm; assert the human form gains only additive lines (the exact key names) appended after the delivered block, with `cause` rendered only when present.
4. Assert the machine form gains exactly one member, `lanePush`, and that its absence is an absent key (never `null`, never `{}`).
5. Assert the two forms cannot disagree about presence (present in machine iff present in human).

**Expected Outcome**:

- Existing consumers of `dispatch status` see no change until a lane push is recorded, and then see one additive member (F-5, §8.5).

#### TC-LSTATUS-003 - Read posture and count

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-3, DEC-3, NFR-2
**Test Type(s)**: Conformance (counted store, recording filesystem edge, guarded runner)
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts` (`TC-STATUS-007` — Existing – Update: the delivered two-read cell becomes three) + `tests/conformance/dispatch/dispatch-operator-posture.test.ts` (Existing – Update: the lane-push family joins the posture sweep)
**Tags**: @backend, @api

**Preconditions**:

- The counted store wrapper (`countStore` from `tests/fixtures/dispatch/attempts-harness.ts`) around a real store holding a lane, a park, and a lane-push family.
- The recording filesystem edge, the transcript double, and the guarded process runner.

**Steps**:

1. Measure `readRecords` deltas for one `dispatch status` answer; assert the total is the delivered two bounded reads (lane, park) **plus at most one** lane-push read — and that exactly one read of the lane-push family occurred.
2. Assert `append`, `replaceDocument`, `acquireFence`, and `releaseFence` deltas are all zero.
3. Assert zero process starts (the guarded runner records none) and zero network calls (no transport is composed for this query).
4. Assert zero deletions and byte/mode/mtime stability of the filesystem snapshot, with planted decoy artifacts unchanged.
5. Assert the absent-fact arm performs no more reads than the present arm (the read is bounded, not repeated per member).
6. Assert the is-delivering/log/last-message queries are untouched in read count and posture.

**Expected Outcome**:

- The widened read count is exactly one bounded record read, and the surface's declared zero-posture is measured, not asserted.

#### TC-LMSG-001 - The final-message contract is carried by both product surfaces

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-6, RSK-5
**Test Type(s)**: Doc-conformance + structure (content assertions over product surfaces)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/dispatch-doc-conformance.test.ts` or a new `tests/checks/lane-push-surfaces.test.ts`; surfaces `.opencode/agent/pm.md` and `packages/core/src/domain/dispatch-prompt.ts`
**Tags**: @backend, @docs

**Preconditions**:

- The delivered `pm` agent definition (step id 10, "PR/MR creation (phase 11)", carrying the `pr_creation` tail) and the built lifecycle prompt (`dispatchLifecyclePrompt`).
- The prompt inventory (`tests/fixtures/prompt-inventory/lifecycle.json`).

**Steps**:

1. **Agent surface**: assert the `pr_creation` step names the typed `push` command and states the final-message rule — the message names the PR URL and the push outcome; on a refusal it names the cause and does not claim the branch is on the remote; when the record did not land it says the push landed without its record. Pin the **prohibition phrase itself** (the delivered wording "Do not retry, force") and a distinctive fragment of the refusal sentence, not the bare words `retry`/`force`/`reopen`: a presence check on those words passes even when the prompt *instructs* a retry.
2. **Prompt surface**: build the lifecycle prompt and assert it carries the one sentence naming the push and the reporting rule, and that the five declared section markers are present and in order (asserted by marker, never by prose matching).
3. Assert the prompt inventory gains `push` in `pm.md`'s required phrases and that `pnpm check:prompt` passes: the edited `pm.md` introduces no raw git write, no hand-edited phase state, no plan progress, and no PR-URL phase write (the delivered rule set).
4. Assert the two surfaces are asserted **separately** (a missing sentence in either fails by name), because they reach different lanes (typed spawn vs. an operator-run `pm`).
5. Assert no new prompt section marker was added (DEC-6) — the marker set is byte-identical to the branch point.
6. **Mutation arm**: on a scratch copy of `pm.md`, insert "retry the push once on failure" into the `pr_creation` step and re-run the pins; assert the case fails by name. A pin that survives the mutation is a presence check, not a prohibition check, and is rejected.

**Expected Outcome**:

- Both product surfaces carry the same final-message contract, and the prompt's structure is unchanged.

#### TC-LMSG-002 - The ordered `pr_creation` tail is pinned

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F4-1, AC-F1-1, DEC-6
**Test Type(s)**: Structure + doc-conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/lane-push-surfaces.test.ts` (new); surfaces `.opencode/agent/pm.md`, `doc/spec/features/feature-quality-gates-and-pr.md`, `doc/spec/features/feature-delivery-lifecycle.md`
**Tags**: @backend, @docs

**Preconditions**:

- The reconciled feature pages and the edited agent definition.

**Steps**:

1. Assert the declared order in the agent definition: PR/MR create-or-update → record the PR URL as a pm-notes note → `phase complete <ref> pr_creation` → `push <ref>` → the final message → STOP.
2. Assert the ordering property that matters: the push instruction appears **after** the `phase complete` instruction, so the phase completion commit — the lane's actual last commit — is the one pushed (the DEC-6 reading).
3. Assert no instruction in the tail tells the lane to author a commit to make the push succeed, to force, to retry in-lane, or to reopen `pr_creation` on a refusal — asserted against the pin's **prohibition sentence**, and proven non-vacuous by planting "retry the push once on failure" on a scratch copy and requiring the case to fail.
4. Assert the feature-page declarations state the same order and the same refusal rule, and that they declare the push does not replace the PR workflow's own pre-PR push.
5. **`no commit` interaction**: assert the tail states that the delivered `no commit` invocation directive suppresses commits, not the push — under it the phase-completion commit is skipped, the push step still runs and still records, and the final message still names the outcome (DEC-6).

**Expected Outcome**:

- A lane following its instructions pushes its own last commit, reports the outcome honestly, and cannot mistake a refusal for a phase failure.

#### TC-LOUT-001 - `dispatch <ref>` output stability

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, NG-3, AC-F5-1 (adjacent surface)
**Test Type(s)**: Golden + structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/dispatch-text.test.ts` and `tests/golden/dispatch-errors.test.ts` (Existing – No Change expected) + `tests/structure/dispatch-push-envelope.test.ts` (Existing – Update: an assertion that no lane-push member exists on the envelope)
**Tags**: @backend

**Preconditions**:

- The committed goldens captured at the branch point for every delivered dispatch cell.

**Steps**:

1. Re-render every delivered text cell and assert byte-identity: exactly `result=`, `pr_url=`, `exit_code=`, `last_message=`, in that order, with no fifth key.
2. Assert the machine envelope's key set is unchanged: the GH-386 `push` block remains the parity block, and **no cause member appears anywhere** in `dispatch <ref>`'s envelope (NG-3: the engine consumes the outcome only) — neither a lane-push member, verdict, head, nor a `cause` field under any name.
3. Assert a classification that folded a lane-push reference changes no envelope member and no text line — the fold is attempt evidence only.
4. Assert no golden was regenerated for this change (the diff contains no golden churn); if a golden must change, that is a spec violation to escalate, not to accept.

**Expected Outcome**:

- The machine envelope and the four-key text contract are untouched: the lane fact belongs to `dispatch status`, not to `dispatch <ref>`.

#### TC-LOUT-002 - The push command's answer bounds and redaction

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4, DM-5, §20
**Test Type(s)**: Structure + behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/lane-push-answer.test.ts` (new) + `tests/behaviour/dispatch-lane-push-command.test.ts`
**Tags**: @backend

**Preconditions**:

- Boundary fixtures: a maximum-length branch name, the longest head, a maximum-length cause token, and a transport stderr carrying a URL and a token-shaped fragment.

**Steps**:

1. Assert the human form is a bounded key=value block: ≤ 16 lines and ≤ 2 KiB, single-line values, in the declared key order.
2. Assert the machine form is inside the standard envelope bound and carries only the declared members.
3. Assert the redaction chokepoint is used unchanged (a planted secret-shaped environment fact does not appear in either form).
4. Assert a value that would exceed the bound is truncated/rejected by the declared rule rather than emitted unbounded.

**Expected Outcome**:

- The command's answer is bounded and secret-free exactly like its delivered peers.

#### TC-LDOC-001 - Composition and documentation guards

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, §8.1, RSK-7, NFR-4
**Test Type(s)**: Structure + checks (script guards)
**Automation Level**: Automated
**Target Layer / Location**: `packages/cli/src/help/prompt-required-commands.ts` (the composed set), `packages/cli/src/help.ts` (the delivered help inventory), `packages/cli/src/production.ts` (the command definition), `tests/fixtures/help-guide/coverage.json`, `doc/planning/oss-tooling/milestones/m4/commands/push.md`; guards `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/checks/doc-conformance.test.ts`, `tests/behaviour/entrypoint-help-coverage.test.ts`, `tests/structure/dispatch-help-inventory.test.ts`
**Tags**: @backend, @docs

**Preconditions**:

- The delivered 28-command composition and its inventories at the branch point.

**Steps**:

1. Assert `PROMPT_REQUIRED_COMMANDS` grew by exactly one — `push` — to 29, with every delivered member unchanged and in place.
2. Assert the entrypoint composes it **without an entrypoint edit** — it mounts every member of `PROMPT_REQUIRED_COMMANDS`, so the new command appears by virtue of the set; assert the composition test enumerating the program's commands matches the prompt-required set exactly, and that the entrypoint's restriction still rejects a non-listed command.
3. Assert the help inventory has an entry for the new command with a see-also target, and `dispatch`'s ten entries are unchanged.
4. Assert the coverage inventory (`tests/fixtures/help-guide/coverage.json`) registers the command and its page, and that the page exists at the **M4** command-page root (`doc/planning/oss-tooling/milestones/m4/commands/push.md`), not at a frozen earlier-milestone root; assert the page documents `--help` and `--version`.
5. Run `pnpm check:help`, `pnpm check:prompt`, and `bun test tests/checks/reference-page-parity.test.ts tests/behaviour/entrypoint-help-coverage.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/doc-conformance.test.ts` green. Assert the count-bearing M1 statement moves **with its own phrase row, as one unit**: `doc/planning/oss-tooling/milestones/m1/commands/provider.md` carries "the twenty-eighth and last" and `tests/checks/doc-conformance.test.ts` (the `PROMPT_REQUIRED_PAGES`/phrase-table row at the count assertion, currently :1620) requires that exact phrase; both change in the same phase to the twenty-ninth tail and its new last member, and neither is edited without the other. Every other M1/M2 reference page stays byte-unchanged, so `provider.md`'s ordinal sentence and its phrase row are the **only** M1 exemptions this change claims.

**Expected Outcome**:

- The new command is composed, documented, counted, and gated exactly like its 28 peers; no inventory drifts.

#### TC-LDOC-002 - The declared divergence (F-6) in the reconciled pages

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, RSK-5, NG-5
**Test Type(s)**: Manual content check (testing-strategy docs layer: traceability review, markdown/link review)
**Automation Level**: Manual (with `git diff --check` and any existing phrase pins)
**Target Layer / Location**: `doc/spec/features/feature-dispatch-engine.md`, `doc/spec/features/feature-quality-gates-and-pr.md`, `doc/spec/features/feature-delivery-lifecycle.md`, `doc/spec/features/feature-agents-and-commands.md`, the engine-first operations guide, `doc/quality/test-specs/test-spec-dispatch-engine.md`
**Tags**: @manual, @docs

**Preconditions**:

- The phase-7 documentation reconciliation has landed; the companion decision record amending TDR-0076 is present.

**Steps**:

1. Assert the dispatch-engine page declares: the new record kind and its key prefix in the record-kind inventory; derivation arm 8's cross-reference to the lane-side act; the `lane-push:<verdict>`/`lane-push-cause:<cause>` evidence beside `push:<verdict>` with the two questions distinguished; the operator `lane view`'s `lanePush` fact and the widened read count (one lane read plus at most two additional record reads — park and lane-push) with the unchanged zero-posture.
2. Assert the quality-gates/PR and delivery-lifecycle pages declare the `pr_creation` tail: push after the phase completion, the final-message rule, and that the PR workflow's pre-PR push remains first.
3. Assert the agents-and-commands page declares the new command as a prompt-required product surface.
4. Assert the operations guide states that the session-side push is reachable from typed and shell lanes, that the evidence fold and the status fact are typed dispatch surfaces only, that the wrappers' behaviour and the engine's backstop are unchanged, and that a lane running no `pr_creation` step keeps the merge bar plus the ensure-push as its backstops (the declared residual, RSK-5).
5. Assert the dispatch-engine test-spec coverage map names the lane-push, cause, fold, status-fact, and resolution-refusal coverage rows and their suites, so this plan's output joins the enduring map.
6. Assert the companion decision record exists, is referenced by the change, and amends TDR-0076's push ownership in substance (session-side act as a typed product surface; the one record-kind growth).
7. Run the docs-layer checks: markdown rendering, link/path integrity, `git diff --check`.

**Expected Outcome**:

- No silent drift: every reader is told what the lane now does, where the evidence lives, and what still does not (F-6, NG-5).

#### TC-LBND-001 - No-shell invariant and act boundedness at the seam

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-6, NG-1, §21
**Test Type(s)**: Static invariant + behaviour
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/no-shell-dispatch.ts` + `tests/checks/no-shell-dispatch.test.ts` (Existing – Update: the surface list covers the new command); seam cells in `tests/behaviour/dispatch-lane-push-command.test.ts`
**Tags**: @backend

**Preconditions**:

- The new command composed into the CLI and the delivered seam unchanged in argv.

**Steps**:

1. Assert the static scan's declared surface set includes the new command's module; plant a `shell: true`, a script-path literal, and a shell-capable import in a scratch fixture of the check's mechanism and assert each fails by name.
2. Assert one child process per invocation (counted) with the literal non-shell spawn (`shell: false` on the one permitted `spawn(`).
3. Assert the fixed argv shape: `git push <remote> HEAD:refs/heads/<branch>` — the resolved push remote as the repository argument (resolved as `branch.<branch>.pushRemote` → `remote.pushDefault` → `branch.<branch>.remote` → `origin`, one bounded local config read), one refspec only, **no `--ff-only`** (git has no such option for push), no force-capable flag, no `--force-with-lease`, no second ref.
4. Assert the timeout is the injected value with 60 000 ms as the production default, and that no new configuration key is read on any path (the configuration inventory is unchanged).
5. Assert the guard order: the safe-ref/protected-ref checks run before the child is spawned (zero invocations on a refusal).

**Expected Outcome**:

- The new act is bounded exactly as the delivered one and is under the same static no-shell regime.

#### TC-LBND-002 - Added cost bound per lane end and per classification

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2, F-1, F-3
**Test Type(s)**: Behaviour (recording seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-command.test.ts` + `tests/behaviour/dispatch-lane-push-fold.test.ts`
**Tags**: @backend

**Preconditions**:

- A recording **pm-notes document read** (the change record's `branch:` declaration), a recording local branch read, a recording **local checkout/head read** (the source of the recorded `head`), a recording **local config read** (the push remote), a counted store, a recording transport, and a request-recording provider transport.

**Steps**:

1. Measure one lane end against the corrected NFR-2 bound: assert at most **one bounded pm-notes document read, one bounded local branch read, one bounded local checkout/head read, one bounded local config read (the push remote), one bounded lane read, one push child, and one append** — nothing else.
2. Measure one classification that folds a lane push: assert at most one additional record read and zero additional provider reads (the request count for the delivered truth/parity reads is unchanged).
3. Assert re-invocation repeats **all seven parts exactly once more** — a second pm-notes document read, local branch read, local checkout/head read, local config read, lane read, push child, and record append — because each invocation is a fresh process that must re-resolve; and assert no further read class appears, in particular **no read of the standing lane-push record** on the write path.
4. Assert the read counts are measured from port counters, not from wall-clock or log scraping.

**Expected Outcome**:

- The change's cost is exactly the declared bound, per lane end and per classification.

#### TC-LGATE-001 - The standing lockstep changeset invariant

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NG-11, §18
**Test Type(s)**: Checks (branch-diff gate at PR time per the delivered TC-RELEASE-001)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-release.test.ts` (Existing – No Change; run as delivered)
**Tags**: @backend

**Preconditions**:

- The change edits `packages/**`, so a changeset is required before the first gate run (the delivered release check fails a packages change with no changeset).
- A base of `origin/main-tools` (the delivered suite's declared base).

**Steps**:

1. Run `bun test tests/checks/privacy-release.test.ts` and assert exactly one added changeset exists for the branch.
2. Assert the changeset's frontmatter names exactly the five fixed-group packages (`@delivery-os/core`, `adapters`, `cli`, `mcp`, `opencode`), all `minor`, and that no sixth package and no other bump type appears.
3. Assert no `package.json` version was hand-edited, the lockfile is unchanged, and no pre-existing changeset was rewritten.
4. Assert this suite is understood as a PR-time gate (testing-strategy rule): it asserts a branch diff by design, and the permanent suite must supply the changeset, not a tree invariant that pins its name.

**Expected Outcome**:

- The declared release invariant holds; the change is releasable as a five-package minor lockstep.

## 6. Environments and Test Data

- **Environment**: local dev only. Runner `bun test` for `tests/**/*.test.ts`; `pnpm typecheck` for types; `pnpm check` for the aggregate gate. Gate evidence commands run with `TMPDIR=$PWD/tmp/tmpdir` (the change's declared evidence convention). No CI topology change is introduced; every new suite runs inside the existing `bun test` discovery.
- **Offline posture**: zero live network calls, zero real remotes, zero wall-clock assertions, and zero dependence on the host's git credential chain. **The transports are injected everywhere except one declared arm**: the injected child runner, the parity harness's scripted outcome, and the fake remote are the transports, and they start no child. Local git processes appear in exactly two declared places: TC-LPUSH-001's fixture setup (creating the temporary repository, committing the ledger, resolving `HEAD`) and **TC-LGIT-001**, which runs the seam's default runner against a local bare remote on purpose — the only layer that can prove git accepts the argv. Both are local paths with no network. The counted store is the only read counter; `canonicalize`/byte comparison is the only determinism check.
- **Injected facts**: full-hex fixture SHAs for the pushed head and the parity/PR heads; branch facts as delivered local-branch-read fixtures (`none`/`unique`/`ambiguous` arms); the change record's `branch:` declaration as a pm-notes fixture value (present, absent, disagreeing, over-long); the lane record as the delivered `dispatch.lane` fixture shape with a controllable `attemptId`/`sessionId`; the clock as an injected instant so `recordedAt` is deterministic.
- **Transport outcomes as fixture values**: `accepted` (exit 0, including the "Everything up-to-date" arm), each rejection class with the delivered failure-text shape, `timed-out`, `spawn-failed`, and an unclassifiable text; the seam's guard arms (unsafe ref, protected ref) exercised before any child.
- **Fixture locations**: extend `tests/fixtures/dispatch/parity/` (the harness, the lane double, the process runner's by-name shell refusal) with a lane-push record builder and a resolved-branch builder; add the new parity rows to `tests/fixtures/dispatch/parity/cases.ts` under the existing `push-parity` group and `push` seam (no new group or seam is required by this change's declared surfaces — see §8.2). The real-git arm builds on its own fixture at `tests/fixtures/dispatch/parity/temp-repo.ts`: a temporary checkout plus a **local bare remote** directory and a second clone for the moved-remote arm — local paths only, no URL. Fixtures are never named `*.test.ts`.
- **Isolation**: every case uses the delivered temporary state-store root and disposes it (`scenario.dispose()`); no case leaves records in the operator's real state directory; the help/doc guards read the working tree read-only; mock-free by preference (injected fakes only, no `mock.module`).
- **Goldens**: the delivered `tests/golden/*` cells are the baseline. `dispatch <ref>` goldens (`tests/golden/dispatch-text.test.ts`, `dispatch-errors.test.ts`) must not change (TC-LOUT-001). One additive human-lines snapshot for `dispatch status` with the fact present is permitted — `tests/golden/status-lane-push.txt`, owned by the status golden host `tests/golden/dispatch-status-worktree.test.ts` — and must be created by the explicit regeneration path, never by blanket rewrite. `dispatch-text.test.ts` is not a status golden host and gains no status cell.
- **Cleanup**: no temp worktree, no `tmp/` residue beyond the declared `TMPDIR` root; the static-scan planted artefacts are exercised through the check's fixture mechanism, never against the working tree.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Execution command | Mocking / injection requirements | Status |
|-------|-------------------------------|-------------------|----------------------------------|--------|
| TC-LCMD-001, TC-LCMD-002 | `tests/behaviour/dispatch-lane-push-command.test.ts` (new) | `bun test tests/behaviour/dispatch-lane-push-command.test.ts` | Injected recording child runner (`createGuardedRunner`), a store double for the fence fault, the real command path | To Implement |
| TC-LPUSH-001, TC-LPUSH-002 | `tests/behaviour/dispatch-lane-push.test.ts` (new) | `bun test tests/behaviour/dispatch-lane-push.test.ts` | A fake remote keyed by ref (records the ref, resolves `HEAD` against a real temporary checkout at call time, stores the head per ref, applies the fast-forward rule) plus the up-to-date arm; commit ledger recorded by the fixture; no head is supplied by the test | To Implement |
| TC-LPUSH-003 | `tests/conformance/dispatch/dispatch-parity-push.test.ts` (new row) + `tests/behaviour/dispatch-lane-push.test.ts` | `bun test tests/conformance/dispatch/dispatch-parity-push.test.ts` | Seeded lane-push record for the classified attempt; equal-head parity facts; a **recording push runner wired into the production composition** whose counter is read after classification (no test-local constant) | Existing – Update |
| TC-LPUSH-004 | The delivered GH-386 suites (no edit beyond §7's broad note) + a documented content review in the pm-notes | `bun test tests/behaviour/dispatch-push-parity.test.ts tests/behaviour/dispatch-push-evidence.test.ts tests/conformance/dispatch/dispatch-parity-push.test.ts tests/structure/dispatch-push-envelope.test.ts` | None beyond delivered | Existing – No Change |
| TC-LGIT-001 | `tests/behaviour/dispatch-lane-push-real-git.test.ts` (new) over `tests/fixtures/dispatch/parity/temp-repo.ts` | `bun test tests/behaviour/dispatch-lane-push-real-git.test.ts` | **No injection at all**: the seam's default runner and default timeout, a temporary checkout, a local bare remote directory, and a second clone for the moved-remote arm; local paths only, no network, deterministic, cleaned up | To Implement |
| TC-LRES-001..005 | `tests/behaviour/dispatch-lane-push-resolution.test.ts` (new), including the predicate unit cell (the shared predicate in `packages/core/src/contracts/dispatch.ts`; `PROTECTED_REF_NAMES` unchanged in `contracts/closeout.ts`) | `bun test tests/behaviour/dispatch-lane-push-resolution.test.ts` | Branch-read fixtures per arm; pm-notes declaration fixtures; zero-invocation recorder on refusal arms; direct predicate calls with the protected members; no faked selection | To Implement |
| TC-LSTORE-001, TC-LSTORE-002 | `tests/behaviour/dispatch-lane-push-record.test.ts` (new) | `bun test tests/behaviour/dispatch-lane-push-record.test.ts` | Real temporary store + injected clock; lane-record fixtures (newest, older, absent, unreadable); boundary-value payload fixtures; **validator-level malformed-record arms** (guard token, ninth token, cause on `pushed`, bad head, oversize payload) each refused as `state.write.failed` | To Implement |
| TC-LFOLD-001, TC-LFOLD-002, TC-LFOLD-003, TC-LFOLD-004 | `tests/behaviour/dispatch-lane-push-fold.test.ts` (new) + one registry row in `tests/conformance/dispatch/dispatch-parity-push.test.ts` | `bun test tests/behaviour/dispatch-lane-push-fold.test.ts && bun test tests/conformance/dispatch/dispatch-parity-push.test.ts` | Seeded records per cause and per no-fabrication arm; disclosure-stress slice fixture (the delivered `dispatch-push-evidence.test.ts` technique); counted store | To Implement |
| TC-LCAUSE-001, TC-LCAUSE-002 | `tests/behaviour/dispatch-lane-push-causes.test.ts` (new) + `tests/checks/dispatch-contract-invariance.test.ts` (Existing – Update: the cause-set pin) | `bun test tests/behaviour/dispatch-lane-push-causes.test.ts && bun test tests/checks/dispatch-contract-invariance.test.ts` | Scripted failure texts per class (including a server-side protection decline); the predicate-level protected-set cell; a secret/URL-shaped text arm; no real child in the act | To Implement |
| TC-LSTATUS-001, TC-LSTATUS-002 | `tests/conformance/dispatch/dispatch-operator-status.test.ts` (Existing – Update: two cases) + `tests/behaviour/dispatch-status-lane-push.test.ts` (new, projection-level) + `tests/golden/dispatch-status-worktree.test.ts` (Existing – Update: the status golden host, new snapshot `tests/golden/status-lane-push.txt`) + `tests/behaviour/dispatch-additive-stability.test.ts` (Existing – Update) | `bun test tests/conformance/dispatch/dispatch-operator-status.test.ts tests/behaviour/dispatch-status-lane-push.test.ts tests/golden/dispatch-status-worktree.test.ts tests/behaviour/dispatch-additive-stability.test.ts` | Seeded lane + lane-push families; delivered status fixtures for the byte-identity arms; `dispatch-text.test.ts` untouched (it holds only `dispatch <ref>` cells) | Existing – Update |
| TC-LSTATUS-003 | `tests/conformance/dispatch/dispatch-operator-status.test.ts` (`TC-STATUS-007` — Existing – Update: two reads → three) + `tests/conformance/dispatch/dispatch-operator-posture.test.ts` (Existing – Update) | `bun test tests/conformance/dispatch/dispatch-operator-status.test.ts tests/conformance/dispatch/dispatch-operator-posture.test.ts` | `countStore`, recording filesystem edge, guarded runner, transcript double | Existing – Update |
| TC-LMSG-001, TC-LMSG-002 | `tests/checks/lane-push-surfaces.test.ts` (new) + `tests/fixtures/prompt-inventory/lifecycle.json` (Existing – Update: `push` among `pm.md`'s required phrases) | `bun test tests/checks/lane-push-surfaces.test.ts && pnpm check:prompt` | Tree content assertions only; `dispatchLifecyclePrompt` built in-process | To Implement |
| TC-LOUT-001 | `tests/golden/dispatch-text.test.ts`, `tests/golden/dispatch-errors.test.ts` (Existing – No Change) + `tests/structure/dispatch-push-envelope.test.ts` (Existing – Update: no lane member) | `bun test tests/golden && bun test tests/structure/dispatch-push-envelope.test.ts` | Committed goldens; injected parity/lane facts | Existing – Update |
| TC-LOUT-002 | `tests/structure/lane-push-answer.test.ts` (new) + `tests/behaviour/dispatch-lane-push-command.test.ts` | `bun test tests/structure/lane-push-answer.test.ts` | Boundary fixtures; planted secret-shaped env fact | To Implement |
| TC-LDOC-001 | `packages/cli/src/help/prompt-required-commands.ts`, `packages/cli/src/help.ts`, `packages/cli/src/production.ts`, `tests/fixtures/help-guide/coverage.json`, `doc/planning/oss-tooling/milestones/m4/commands/push.md` (all new/updated) + the delivered guard suites (Existing – Update where the set grows). `packages/cli/src/entrypoint.ts` needs **no edit**: it composes every prompt-required command from the declared set, so the mount follows from the set's one new member (asserted, not edited) | `pnpm check:help && pnpm check:prompt && bun test tests/checks/reference-page-parity.test.ts tests/behaviour/entrypoint-help-coverage.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/doc-conformance.test.ts tests/structure/dispatch-help-inventory.test.ts` | None beyond the tree | Existing – Update |
| TC-LDOC-002 | The four feature pages, the engine-first operations guide, `doc/quality/test-specs/test-spec-dispatch-engine.md`, and the companion decision record (all edited/new) | Manual review + `git diff --check` | None | Manual Only |
| TC-LBND-001 | `scripts/checks/no-shell-dispatch.ts` + `tests/checks/no-shell-dispatch.test.ts` (Existing – Update: surface list) + seam cells in `tests/behaviour/dispatch-lane-push-command.test.ts` | `pnpm check:no-shell && bun test tests/checks/no-shell-dispatch.test.ts && bun test tests/behaviour/dispatch-lane-push-command.test.ts` | Planted shell references via the check's fixture mechanism; by-name refusal runner | Existing – Update |
| TC-LBND-002 | `tests/behaviour/dispatch-lane-push-command.test.ts` + `tests/behaviour/dispatch-lane-push-fold.test.ts` | `bun test tests/behaviour/dispatch-lane-push-command.test.ts tests/behaviour/dispatch-lane-push-fold.test.ts` | Recording branch read, counted store, recording provider transport | To Implement |
| TC-LGATE-001 | `tests/checks/privacy-release.test.ts` (Existing – No Change) + one new `.changeset/*.md` | `bun test tests/checks/privacy-release.test.ts` | None | Existing – No Change |

Broad Existing – Update note: every delivered suite whose scenario resolves `pr-open` through the real command path gains the **mechanical** fixture fact "a lane-push read returns no matching record" (the delivered `readRecords` double already returns what the fixture seeds, so most suites need nothing). The rest of the expected diff is the mechanical re-pin of the command count and its inventories, because a twenty-ninth prompt-required command moves every place that states 28: the seventeen `PINNING_FILES` suites (`tests/fixtures/metrics/mounting.ts`, asserted by `tests/structure/provider-mounting.test.ts` TC-MOUNT-006 and the sibling mounting tests), the two captured family-list mounting fixtures (`tests/fixtures/metrics/mounting.ts` and `tests/fixtures/supervise/mounting.ts`; `tests/fixtures/steer/mounting.ts` is the historical 22→23 base and does not move), the alias baseline's `help` cell (`tests/fixtures/entrypoint/alias-baseline.json` — its Commands list gains one line and every other cell stays byte-unchanged), and the phrase rows that state the command count on roughly ten documentation pages in the doc-conformance phrase table. Those re-pins together with the new command's own suites are the expected diff; no delivered command's behaviour, output, or page content changes, so a re-pin that moves anything other than the count, the registration, and the new page is a defect in the change, not a planned update.

Suite placement (joining the enduring map): command/act/resolution/record/cause cases → `tests/behaviour/dispatch-lane-push-*.test.ts`; fold cases → `tests/behaviour/dispatch-lane-push-fold.test.ts` plus one conformance row; operator cases → `tests/conformance/dispatch/dispatch-operator-status.test.ts` and `tests/behaviour/dispatch-status-lane-push.test.ts`; surfaces/content → `tests/checks/lane-push-surfaces.test.ts`; static invariant → `tests/checks/no-shell-dispatch.test.ts`; output stability → the delivered golden/structure suites; release invariant → `tests/checks/privacy-release.test.ts`. TC-LDOC-002 step 5 names each of these in the test-spec coverage map.

### 7.1 Quality gate execution

Targeted runs while working (narrow first, per the testing strategy), with gate evidence captured under `TMPDIR=$PWD/tmp/tmpdir`:

```bash
# 1. Types for the touched packages and the type-test project
TMPDIR=$PWD/tmp/tmpdir pnpm typecheck

# 2. The change's own new and updated suites, one command per seam
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/dispatch-lane-push-command.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/dispatch-lane-push.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/dispatch-lane-push-resolution.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/dispatch-lane-push-record.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/dispatch-lane-push-fold.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/dispatch-lane-push-causes.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/dispatch-status-lane-push.test.ts

# 3. The delivered suites this change touches or must not disturb
TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance/dispatch
TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/dispatch-push-parity.test.ts tests/behaviour/dispatch-push-evidence.test.ts
TMPDIR=$PWD/tmp/tmpdir bun test tests/golden
TMPDIR=$PWD/tmp/tmpdir bun test tests/structure
TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts tests/checks/doc-conformance.test.ts tests/checks/dispatch-contract-invariance.test.ts tests/checks/privacy-release.test.ts

# 4. The repository invariant scripts the change can move
TMPDIR=$PWD/tmp/tmpdir pnpm check:help
TMPDIR=$PWD/tmp/tmpdir pnpm check:prompt
TMPDIR=$PWD/tmp/tmpdir pnpm check:no-shell

# 5. Whitespace / conflict-marker guard
git diff --check
```

The full battery, once, after the change is complete and before the phase gate is claimed:

```bash
# The changeset must exist first (the release check fails a packages change without one)
TMPDIR=$PWD/tmp/tmpdir pnpm check
# The supplementary pre-PR commit-message gate, at the PR boundary
./scripts/lint-commit-range.sh --base origin/main-tools
```

Evidence recording: each command's exit status and a one-line summary go into the change's pm-notes `notes:` evidence (the testing-strategy rule "record evidence in change artifacts"); a command that did not run is never reported as passing, and a knowingly waived gate is recorded with its follow-up. Do not run `tsc` directly; `pnpm typecheck` is the declared entry point.

### 7.2 Risk-based prioritisation

Ranked by (a) damage if wrong and (b) likelihood of a plausible-but-wrong implementation. The order is also the recommended implementation order of the test files, so the highest-risk seam is provable earliest.

| Rank | Cases | Why first |
|------|-------|-----------|
| 1 | TC-LPUSH-001, TC-LCMD-001, TC-LCMD-002 | The ticket's headline claim and the "nothing authored or amended" invariant: if the act authorises a commit or pushes the wrong head, every other guarantee is decoration. The ordering case (append-after-act) is the one an implementation gets right by accident only. |
| 2 | TC-LRES-001..005 | Pushing a guessed, ambiguous, unsafe, or protected ref is the worst outcome of the change and the easiest to reach by a fallback someone adds "to be helpful". Four refusal arms plus the unique arms are cheap and decisive. |
| 3 | TC-LFOLD-001, TC-LFOLD-003, TC-LFOLD-004 | The fold is where a silent lie is possible: fabricated evidence, a refusal that becomes a failure, or a failure that a disclosure masks. TC-LFOLD-004 is the adversarial one. |
| 4 | TC-LSTORE-001, TC-LSTORE-002 | The record is the only durable truth a dead wrapper leaves behind; an unbounded or identity-less-it-should-not-be record breaks privacy and the fold's matchability at once. |
| 5 | TC-LSTATUS-002, TC-LSTATUS-003 | Operator-surface regressions are cheap to introduce (an extra read, a rendered line when absent) and expensive to notice: the byte-identity and posture proofs are the guard. |
| 6 | TC-LPUSH-002, TC-LPUSH-003, TC-LPUSH-004 | The ticket AC-2 regression pins: they prove the change is additive, which is what makes it safe to merge. |
| 7 | TC-LCAUSE-001, TC-LCAUSE-002 | Reporting-only by design (nothing branches on the cause), so the damage is a wrong label or a leaked stderr — bounded but a privacy defect if the raw text escapes. |
| 8 | TC-LMSG-001, TC-LMSG-002 | Behavioural instruction, not code: decisive for the ticket's honesty claim, but a prompt/definition assertion, so the failure mode is drift rather than a wrong push. |
| 9 | TC-LSTATUS-001, TC-LDOC-001, TC-LOUT-001, TC-LOUT-002 | Correctness of projection and registration: visible, gated, and easy to verify once the seams exist. |
| 10 | TC-LDOC-002, TC-LBND-001, TC-LBND-002, TC-LGATE-001 | Content and cost/margin guards: important for the phase-7 and release gates, low risk of being silently wrong. |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| The reserved block is already at seven of sixteen after this change, so the fold's growth must stop at two and a later delivery could push the block past its room | M | DM-2 and NFR-5 pin the fold at "at most two references"; TC-LFOLD-001 asserts membership of the pre-slice block plus the ≤ 16 total and the at-most-two growth, so a third reference fails by name while the delivered block's own history stays free to be what it is. |
| The two guard checks drift apart or fuse — the protected set folded into the safe-ref predicate, `unsafe-branch` reaching a lane-push record, or a guard-shaped refusal being reported as a recorded rejection | H | TC-LRES-004 asserts the command-path safe-ref refusal is pre-act (no child, no record, no verdict/cause), that the **predicate accepts** protected members while the **membership check refuses** them (so the two never fuse), that no resolved name can equal one, and that a direct seam call returns the guard detail before the child; TC-LCAUSE-001 asserts `unsafe-branch` is structurally absent from every record while `protected-ref`'s one reachable source writes one. The predicate is unified for the push seam and its command only, in `contracts/dispatch.ts`; the index/merge/watchdog copies are out of scope (R10). |
| The pre-act refusal is silent by design (no record, no folded reference, no status fact), so a refused lane with a dead wrapper leaves only the final message — which CB-1 declares unobservable | M | Spec RSK-10 declares this residual with its backstops (the merge bar and the engine's ensure-push at the next classification); TC-LRES-004 asserts the silence deliberately and TC-LSTATUS-002 asserts that an absent `lanePush` covers the three states without fabricating a distinction. |
| Every push proof injects a runner that returns scripted text, so an argv git rejects would keep the whole battery green — the exact failure the review found in the delivered seam | H | TC-LGIT-001 runs the seam's **default runner** against a local bare remote and proves accepted / already-up-to-date / `non-fast-forward` / the guard refusals / the missing destination; every other case keeps an injected transport for determinism, and the plan names the real-git arm as the argv proof. A future argv change must re-run TC-LGIT-001, not only the literal pins. |
| The `TC-STATUS-007` read-count update is the one delivered count assertion that must change, so a later delivery could read it as a regression | L | Called out in §7's broad note and TC-LSTATUS-003 with the declared DEC-3 reason; the new count is asserted as "delivered two plus at most one", so a future family addition has an obvious place to update. |
| The ticket's "named in the lane's last message" has no machine-observable artifact, so a test could over-claim | M | TC-LMSG-001 asserts the two product surfaces separately and §8.3 declares the residual as an accepted coverage boundary rather than inventing a transcript assertion. |
| A new prompt-required command drifts the help/coverage/reference inventory, and a coder "fixes" it by rewriting an M1 snapshot page instead of moving the one count-bearing statement with its phrase row | L | TC-LDOC-001 asserts the M4 page root, the single M1 `provider.md` ordinal statement plus its doc-conformance phrase row moving as one unit, and every other M1/M2 page byte-unchanged; `check:help` + `reference-page-parity` + `entrypoint-help-coverage` + `doc-conformance` fail by name. |
| The keep-the-battery-green pressure tempts a golden regeneration for `dispatch <ref>` | M | TC-LOUT-001 asserts byte-identity and explicitly forbids golden churn for this change; the testing-strategy rule forbids blanket rewrites. |
| The change edits `packages/**` but the changeset is added after the first gate run, failing TC-RELEASE-001 | L | The delivery notes already order the changeset first; TC-LGATE-001 makes it a named case with its own command. |

### 8.2 Assumptions

- **The transport is injectable at the delivered seam.** `createGitPushSeam({ childRunner, timeoutMs, cwd })` and `createParityHarness`'s scripted push outcome are the injection points; no new test-only configuration key is introduced, and NFR-1's "injectable 60 000 ms budget with no new configuration key" is testable as delivered.
- **The branch facts come from the delivered reads.** `branchConvention` + `selectMatchingBranch` (the `none | unique | ambiguous` semantics) supply the convention arm; the change record's `branch:` value supplies the declaration arm; the resolution rule is a cross-check, not a new grammar.
- **The attempt identity comes from the newest readable `dispatch.lane` record.** The lane-push record's binding is derived, so the fixtures can control it without a new identity source.
- **The parity battery's declared groups and seams cover this change.** The new rows use the existing `push-parity` group and `push` seam; no new group, seam, or proof-boundary member is declared by the spec, so no battery extension is asserted beyond rows.
- **The delivered `push:` verdict family and the new `lane-push:` family stay distinct.** Two prefixes, two questions; RSK-8's mitigation is asserted by TC-LFOLD-002 step 3 and TC-LPUSH-003 step 3.
- **The companion decision record lands inside this change** (spec DEC-7), so TC-LDOC-002 can assert its presence as an artifact of the change.
- **The bash wrappers are out of test scope beyond documentation.** Their behavior is unchanged and their suites stay authoritative.

### 8.3 Resolved by Spec, Residuals, and the Accepted Coverage Boundary

**Resolved by spec** (correction passes, no scope change; recorded here as closed, with the location that now decides each):

| # | Earlier finding | Now decided by | Effect on this plan |
|---|-----------------|----------------|---------------------|
| OQ-1 | The reserved-evidence count was stated as "three delivered plus at most two = at most five", against code truth of five delivered. | Spec F-3 "The evidence", DM-2, NFR-5, §4.1 success metrics, Appendix A, Appendix C: the delivered reservation is five (`lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, `push:<verdict>`), the fold adds at most two, and the post-change maximum is seven of sixteen. | The plan states seven of sixteen as the declared maximum and keeps the assertions property-based (membership of the pre-slice reserved block, ≤ 16 total, at most two added) in TC-LFOLD-001 and §3.2/§3.3. |
| OQ-2 | The pre-act resolution refusal and the seam's recorded rejection were described inconsistently across artifacts. | Spec F-1 "One predicate, two layers" (as corrected on reachability), DM-4, AC-F1-2, Appendix E: the safe-ref predicate is shared by the push seam and its command and lives in **`packages/core/src/contracts/dispatch.ts`** (unified for those two only; `PROTECTED_REF_NAMES` stays in `contracts/closeout.ts`; the identical index/merge/watchdog copies stay out of scope). A convention-resolved name that the predicate rejects is therefore **always** the command's pre-act refusal (no child, no act, no record, no verdict/cause). The protected-name-set membership check is the guard's second check, running beside the safe-ref predicate: the predicate **accepts** a protected name (alphabet-legal), the membership check **refuses** it, and no convention-resolved name can equal a protected member (the convention always yields a slash; no member has one) — so that check is **defence in depth** and unreachable from the command path. `unsafe-branch` is guard-only and never recordable; `protected-ref`'s only command-reachable source is a server-side protection/hook decline, giving seven recordable causes. The seam's guard remains for a direct consumer (the engine), whose rejection is parity evidence and never a lane-push record. | TC-LRES-004 asserts the command-path safe-ref refusal, the split predicate cell (accepts protected names) versus membership check (refuses them), the structural unreachability of the membership arm, the direct-consumer layer, and the out-of-scope copies; TC-LCAUSE-001 pins the eight-token set as seven recordable + guard-only `unsafe-branch`, states that `protected-ref` source (a) is defence in depth, asserts source (b) yields one record with the same token, and asserts `unsafe-branch` never reaches a record; the §8.1 risk row is scoped to the seam and the command. |
| OQ-3 | The protected cause token was declared `protected-branch` while the delivered seam emits `protected-ref`, with alias behaviour unstated. | Spec DM-4, DEC-4, F-4, the glossary, Appendix E: `protected-ref` is the delivered literal, shared with the closeout ref guard, so no delivered string changes and no alias exists. | TC-LCAUSE-001's table asserts the eight-member set with `protected-ref` and fails on the old spelling; TC-LCAUSE-002 step 5 pins the literal and forbids a `protected-branch` alias anywhere. |

**Declared residuals this plan touches** (spec-declared, not coverage gaps):

| # | Residual | Where declared | How the plan handles it |
|---|----------|----------------|-------------------------|
| R-1 | A pre-act resolution refusal appends no record, so with no wrapper alive it leaves no durable fact: `dispatch status` shows no `lanePush` and the attempts digest shows nothing; the final message is its only immediate disclosure, and that message is CB-1. | Spec RSK-10 (F-5 "The fact", §10, §22). | TC-LRES-004 asserts the silence deliberately (no record, no verdict/cause, no child) and TC-LSTATUS-002 asserts that an absent fact covers the three states — never ran, pre-act refusal, record did not land — without fabricating a distinction. The silence is a property, not an omission. |
| R-2 | A lane that runs no `pr_creation` step performs no session-side push. | Spec F-6, RSK-5. | TC-LDOC-002 asserts the declared backstops (merge bar plus the engine's ensure-push) in the operations guide. |

**Accepted coverage boundary** (one, and not a spec defect):

| # | Boundary | Why it stands | How this plan covers what is coverable |
|---|----------|---------------|----------------------------------------|
| CB-1 | AC-F4-1's "the lane's final message names the pull request URL and the push outcome" cannot be machine-observed: no delivered seam exposes a session's final message as a value, and the transcript read is a declared capability gap on one harness. | Spec F-4, AC-F4-1's closing sentence, §7.1 place the contract on two product surfaces, each with its own assertion; RSK-5/RSK-10 declare the residual. Asserting a transcript would invent a capability the system does not have. | TC-LMSG-001 asserts both product surfaces separately and TC-LMSG-002 asserts the ordered tail (including the `no commit` interaction); the behavioural half — the cause being named in the command's answer and carried verbatim into the record and the attempt — is TC-LCAUSE-001/002 and TC-LFOLD-001. The unobservable remainder is declared, not hidden. |

**Former second boundary, closed by fixture (B3)**: an earlier revision would have needed CB-2 for AC-F1-1's head equality, because the transport double received only the literal `HEAD` and could not observe what was pushed. TC-LPUSH-001 now uses a fake remote keyed by ref that resolves `HEAD` against the checkout at call time, so the equality is measured, not stipulated. CB-1 is the only boundary this plan carries.

No open question remains. Every earlier finding is either closed by a named spec location above or is one of the two declared residuals or the single accepted boundary; none blocks the Definition of Ready.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | Initial test plan: 31 cases (TC-LCMD-001..002, TC-LPUSH-001..004, TC-LRES-001..005, TC-LSTORE-001..002, TC-LFOLD-001..004, TC-LCAUSE-001..002, TC-LSTATUS-001..003, TC-LMSG-001..002, TC-LOUT-001..002, TC-LDOC-001..002, TC-LBND-001..002, TC-LGATE-001) covering AC-F1-1, AC-F1-2, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1, AC-F6-1; the ticket's three acceptance criteria and requirement 4 mapped in §3.1; two spec-side gaps (OQ-1 reserved-count wording, OQ-2 refusal-versus-recorded-cause boundary) and one observation (OQ-3 token name) recorded, plus one declared coverage boundary (GAP-3, the unobservable final message). |
| 1.1 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | Reconcile with change spec v1.1 (correction pass, no scope change). No TC id, AC mapping, or coverage row removed. Reserved-evidence statements now read five delivered plus at most two, seven of sixteen (F-3 "The evidence", DM-2, NFR-5, Appendix C), with assertions kept property-based. TC-LRES-004 and TC-LCAUSE-001 became the explicit two-arm pair (arm (a) pre-act resolution refusal — no child, no act, no record; arm (b) seam rejection — verdict `failed`, record appended, closed cause) and assert distinguishability in both directions (F-1 "Two refusal arms, one question each", DM-4, AC-F1-2, Appendix E). The protected token is the delivered literal `protected-ref` everywhere, with TC-LCAUSE-002 additionally pinning the literal and forbidding a `protected-branch` alias (DM-4, DEC-4, F-4, glossary, Appendix E). §8.3 replaced by "Resolved by Spec v1.1 and the Accepted Coverage Boundary": OQ-1/OQ-2/OQ-3 closed against their deciding locations, and the unobservable final message kept as the single accepted coverage boundary (CB-1). §8.1 risk rows updated to the corrected maximum and to the arm-collapse risk. |
| 1.2 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | Four corrections found by the plan author against code truth; no TC id, AC mapping, inventory, or coverage row changed (31 cases intact). **I-1**: `pr_creation` is labelled by the repo as step id 10 ("PR/MR creation (phase 11)") and phase 11 of the lifecycle — both §2 and TC-LMSG-001 now say that, not "step 11". **I-2**: TC-LCAUSE-001 step 4 no longer expects a child invocation for the guard-shaped causes; it asserts zero child processes for `unsafe-branch`/`protected-ref` (the seam returns those rejections before the runner call), one child invocation attempt for the causes produced by the child act, and that the appended lane-push record — not a child process — is what distinguishes arm (b) from the pre-act refusal arm (a); TC-LRES-004's bypass step records the same seam ordering. **I-3**: §7's broad note now states the real re-pin surface of a twenty-ninth command (the seventeen `PINNING_FILES` suites, the two captured family-list mounting fixtures with the steer base explicitly unchanged, the alias baseline's `help` cell, and the count phrase rows on roughly ten documentation pages) instead of claiming `TC-STATUS-007` was the only delivered assertion to change. **I-5**: the help inventory path is `packages/cli/src/help.ts` (there is no `help/index.ts`), and `packages/cli/src/entrypoint.ts` is recorded as requiring no edit because it mounts the declared set. |
| 1.3 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | One clarification in TC-LCAUSE-001, no renumbering and no other change (31 cases, all ids, and the AC matrix intact). The `protected-ref` token has two sources with different child-process expectations: protected-set membership is a guard rejection made before the child runner is called, while a git-reported protection/hook decline can only be observed through the child act and is classified to the same token. Step 4 therefore keys child-process accounting on the **source** rather than the token — zero child invocations for the guard-produced instances (`unsafe-branch`, `protected-ref` from the protected set) and exactly one for every child-act instance, with the declined-protection instance added to that group — and asserts that the two `protected-ref` sources end in the same closed token while reporting different child counters. The preconditions now name each scripted instance by source (guard-produced versus child-act) and state the two-source property, and step 5's distinguishability wording is scoped to the guard-produced and child-act sub-arms so no step is ambiguous. |
| 1.4 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | DoR iteration-1 remediation against spec v1.3, no scope change and no case removed (31 TCs, all ids, AC matrix intact). **B1 (R1, one predicate/two layers)**: a guard-shaped name is always the command's pre-act refusal — TC-LRES-004 now asserts the single-predicate rule, the no-record/no-child/no-verdict outcome, and the direct-consumer seam layer (guard detail before the child, no lane-push record, engine parity evidence instead); TC-LCAUSE-001 is rewritten around the **six recordable child-act tokens** with the eight-token pin split into two seam-only guard tokens and six child-act tokens, and asserts no record can carry a guard token. Every assertion that the command produces a recorded guard rejection is deleted. **B2 (R2, engine consumes the outcome only)**: the old "both consumers name a cause" step is replaced by an outcome-only assertion — two different causes yield an identical engine verdict, `push:<verdict>` evidence, attempt and comparison, the envelope carries no cause anywhere (NG-3), and the cause reaches only the command answer, the lane-push record and the folded reference; TC-LOUT-001 and the DM-4 row state the same. **B3 (AC-1 fixture made observational)**: TC-LPUSH-001 now uses a fake remote keyed by ref that resolves `HEAD` against a real checkout at call time, stores the head per ref and applies the fast-forward rule, and the case states why the equality is measured rather than stipulated; the would-be second coverage boundary is withdrawn (CB-1 remains the only one). **B5 (count-bearing M1 statement)**: TC-LDOC-001 step 5 makes `m1/commands/provider.md` and its `doc-conformance` phrase row move **as one unit** to the twenty-ninth tail, with every other M1/M2 page byte-unchanged. **Advisories**: RSK-10 is cited where the pre-act refusal's silence is asserted (TC-LRES-004, DM-3, §8.3's new residuals table); NFR-2 and TC-LBND-002 mirror the corrected added-cost count (branch read, local checkout/head read, lane read, push, append); the DM-1/TC-LSTORE-001 head source is the checkout `HEAD` read at act time; TC-LFOLD-001 covers the six child-act causes; TC-LMSG-002 adds the `no commit` interaction; and §1.3 adds the consolidated Definition of Done (8 testable conditions, complementing §3). §8.1's risk rows updated for the two-layer drift and the RSK-10 silence. |
| 1.5 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | Three rulings applied against spec v1.4, no scope change, 31 cases and every AC row intact. **R7**: `protected-ref` is restored as a recordable, two-source token — protected-set membership is a pre-act refusal (zero children, no record) while a git-reported protection/hook decline is a child-act classification (`failed`, one child, one record with `cause: protected-ref`); `unsafe-branch` stays guard-only and is asserted structurally absent from records. The recordable causes are **seven** (`non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `protected-ref`, `unclassified`) and the closed set stays eight. TC-LCAUSE-001, TC-LCAUSE-002, TC-LFOLD-001, TC-LSTORE-001, DM-1/DM-4, §1.1 F-4 and the §3.1 F-4 roll-up carry it, with the "token alone never implies a layer" assertion kept. **R8**: NFR-2 and TC-LBND-002 now count the pm-notes document read and the local branch read as well — one bounded pm-notes read, one bounded local branch read, one bounded local checkout/head read, one bounded lane read, one push, one append; classification adds at most one record read. **R10**: every "one home" claim is scoped to the push seam and its command; the identical private copies in the git index, merge and watchdog adapters are declared out of scope and asserted unchanged (TC-LRES-004). **R11**: TC-LSTATUS-002's status golden host is `tests/golden/dispatch-status-worktree.test.ts` with the new snapshot `tests/golden/status-lane-push.txt`; `tests/golden/dispatch-text.test.ts` holds only `dispatch <ref>` cells and gains no status cell (corrected in the case, the §7 map row and §6's golden note). |
| 1.6 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | DoR iteration-2 remediation; no scope change, 31 cases, every id and the AC matrix intact. **R12**: the shared predicate's home is `packages/core/src/contracts/dispatch.ts` (a contracts module that already exports functions, importable by the adapters seam), not the closeout contract, which stays declaration-only so `closeout-contract.test.ts` and `port-neutrality.test.ts` remain green; `PROTECTED_REF_NAMES` stays in `contracts/closeout.ts`, untouched. The home is corrected in §1.1, TC-LRES-004's Target Layer and preconditions, TC-LCAUSE-001's Target Layer, the §7 rows and the §8.3 OQ-2 row. **R13**: the protected-set pre-act arm is structurally unreachable on the command path — a convention-resolved name always contains a slash and can never equal `main`, `main-tools` or `HEAD` — so TC-LRES-004 drops the faked-selection arm, keeps the safe-ref arm as the real command-path refusal (with a constructible example: a git-legal name outside the predicate's alphabet), and replaces the protected arm with a predicate-level unit cell plus a structural pin that no resolved name can equal a protected member; TC-LCAUSE-001 step 3 states that `protected-ref` source (a) is defence in depth, not an exercisable command-path arm, while source (b), the server-side decline, stays the recordable child-act cause; the AC-F1-2 row, the §8.1 risk row and the OQ-2 row carry the same rule. **R15**: TC-LBND-002 step 3 now says two invocations repeat all six parts exactly once more (each invocation is a fresh process) with no further read class and no read of the standing lane-push record; TC-LPUSH-001's zero-process claims are scoped to the act under test (the fake remote spawns nothing) and its fixture setup is declared as the one place git runs, and the non-tautology note is corrected to what the equality discriminates (the fixture's sequencing and plumbing, not git's acceptance semantics); the stale DEC-4 quote is removed in favour of the operative rule (the seam names a cause for both callers; the engine discards it), and step 7's surface list gains the `dispatch status` fact. The reviewer's related nit is also applied: TC-LCAUSE-002's literal-uniqueness pin is scoped to the classification table. |
| 1.7 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | One wording correction raised as a residual by the readiness confirmation; no assertion, step number, TC id or AC row changed (31 cases intact). Several places said "the shared predicate refuses each protected member", which is false for the symbol named: the safe-ref predicate (`isSafeRef`) checks the alphabet only and therefore **accepts** `main`, `main-tools` and `HEAD`; the protected-name-set membership check is what **refuses** them, and the two together are "the command's guard". Corrected in §1.1's branch-resolution bullet, the AC-F1-2 row, the DM-4 row, the TC-LRES-004 index row and its predicate-cell precondition and step 5 (which now asserts the predicate *accepts* protected names — the assertion that stops the set being folded into the predicate), its step 6 and expected outcome, TC-LCAUSE-001's guard-check precondition, its step 3 source (a) and its `protected-ref` note, the §8.1 drift risk row (now "drift apart or fuse"), and the §8.3 OQ-2 row. The structural argument is unchanged: no convention-resolved name can equal a protected member, so the membership check is defence in depth and unreachable from the command path. |
| 1.8 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | Code-review iteration-1 remediation under PM ruling R17; 32 cases now (TC-LGIT-001 added), every earlier id and the AC matrix intact, every AC still has at least one case. **R17.1 (argv)**: every argv expectation is the corrected spec v1.6 form `git push <remote> HEAD:refs/heads/<branch>`, with `<remote>` the push remote resolved by one bounded local config read (`branch.<branch>.pushRemote` → `remote.pushDefault` → `branch.<branch>.remote` → `origin`), **no `--ff-only`** and no force flag — corrected in the summary, §2, §1.1, NFR-1, NFR-2 (the added config read), the §5.1 index row, TC-LCMD-001 step 2, TC-LPUSH-001 steps 7 and notes, TC-LRES-004 step 3, TC-LBND-001 steps 3 and its index row. **R17.2 (real-git arm)**: new **TC-LGIT-001** — the seam's default runner against a temporary checkout and a local bare remote, proving accepted, already-up-to-date, `non-fast-forward`, the guard refusals and the missing destination, plus the four-way push-remote precedence and a no-network assertion; added to the index, the AC-F1-1 and AC-F2-1 rows, the F-1/F-2 roll-up, the DoD and §7, with the zero-process posture scoped to it. **R17.3 (review advisories)**: TC-LPUSH-003's zero-push claim is a real counter read from a recording runner in the production composition (no `const pushActs = 0`); TC-LFOLD-001 drives one full classification per cause and gains an explicit full-16-reference overflow arm; TC-LSTORE-001 gains validator-level refusals (guard token, ninth token, cause on `pushed`, bad head, oversize payload) beside the accepted record; TC-LCMD-002 gains the oversize-payload (439 of 512 bytes today) and append-failure arms; TC-LMSG-001/002 pin the prohibition sentence and a planted "retry the push" mutation must fail them. **R17.4 (classification)**: TC-LCAUSE-001's instances gain the missing push destination (`remote-unavailable`) and the HTTP-403 permission failure (`auth-rejected`, never `remote-unavailable`), with the not-403-as-unavailable assertion. |
| 1.9 | 2026-11-27 | @coder (DeepSeek V4.1 Flash 1017) | Code-review iteration-2 findings, no case id added, no assertion relaxed, and the AC matrix intact (32 cases). **F-22**: TC-LGIT-001's Target Layer line, the §6 real-git row and the §7 index row now name the delivered fixture `tests/fixtures/dispatch/parity/temp-repo.ts` instead of the two precedent helpers (`tests/fixtures/closeout/temp-git.ts`, `tests/fixtures/pilot/repo.ts`), and TC-LPUSH-001's fixture-setup notes say it builds its temporary checkout inline; the missing-destination and HTTP-403 wordings are now asserted through `push <ref>` on the command path (TC-LCAUSE-001 step 4), so the combined wording-token case runs at both layers instead of being composed from a seam arm and another wording's command arm. **F-17**: TC-LGIT-001's ordering probe gains the guards-before-read arm — an unsafe name and each protected name on a checkout with no configured destination answer `unsafe-branch` and `protected-ref` with zero children. **F-14/F-15**: the seam's one configuration read gains parser and bound arms in the resolution suite (annotated headers in git's five shapes, an unparseable header failing closed, and a configuration past 64 KiB refused `remote-unavailable`), noted here as seam-level coverage under TC-LRES-004 rather than a new case. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Populated during the delivery phase and the quality-gates phase; gate evidence recorded with `TMPDIR=$PWD/tmp/tmpdir`. TC-LDOC-002 is manual and recorded in the change's pm-notes `notes:` evidence. |
