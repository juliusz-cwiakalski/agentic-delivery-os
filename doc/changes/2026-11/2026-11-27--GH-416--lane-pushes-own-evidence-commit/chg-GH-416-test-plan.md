---
id: chg-GH-416-test-plan
status: Proposed
version: 1.3
created: 2026-11-27
last_updated: 2026-11-27
owners: ["Juliusz Ćwiąkalski"]
service: "the delivery lifecycle's `pr_creation` tail and the dispatch engine's attempt evidence (a prompt-required CLI command over the delivered adapters push seam, and a durable lane-push fact on the delivered operator surface)"
labels: [change, m4, dispatch, cli, delivery-lifecycle, git-seams]
version_impact: minor
summary: "Verification map for the lane-owned evidence push: one prompt-required typed `push <ref>` command thin over the delivered fast-forward seam (one act, fixed argv, non-shell, 60 000 ms injectable budget, nothing authored or amended), structural branch resolution from the change record's `branch:` declaration cross-checked with the delivered convention read (declaration/convention disagreement, none, and ambiguous are refusals, never a guessed ref), the append-only `dispatch.lane-push` record and its single bounded read folded into the attempt's reserved evidence references (`lane-push:<verdict>` / `lane-push-cause:<cause>`, inside the 16-reference budget, no classification growth), the additive optional `lanePush` fact on `dispatch status` (byte-identical absence; one extra bounded record read; zero network calls, process starts, fences, appends, deletions), the ordered `pr_creation` tail and the final-message contract carried by the `pm` agent definition and the built lifecycle prompt, the declared typed-versus-shell divergence, the prompt-required composition/help/reference-page guards, and the standing lockstep changeset; every arm runs offline over injected facts and fixture transports, never a real remote, and the ticket's three acceptance fixtures plus requirement 4 are named cases."
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

- **F-1, the lane's own push**: the `push <ref>` grammar and answer (§8.1), one fast-forward act through the delivered seam per invocation, nothing authored/amended/reset/forced, the invocation's own checkout as the working directory, act-then-append ordering with `recorded: false` disclosure, and idempotent re-invocation that never suppresses an act and never escalates to force.
- **Branch resolution and the two refusal arms (F-1, NFR-7)**: the change record's `branch:` declaration cross-checked with the delivered convention read (`branchConvention` + `selectMatchingBranch`, the delivered `none | unique | ambiguous` semantics in `packages/core/src/domain/closeout.ts`), where a disagreement, no match, or more than one match is a typed input refusal that performs no act and appends no record; a uniquely resolved branch name that fails the delivered safe-ref guard or names a ref in the seam's protected set is the same **pre-act resolution refusal** (no child process, no act, no record — AC-F1-2, "arm (a)"), which is distinct from the **seam's own recorded rejection or classification** (verdict `failed`, record appended, closed `detail` cause — DM-4, "arm (b)"). The two arms answer different questions and neither may silently become the other.
- **F-2, the second idempotent push (regression)**: an already-equal branch is `accepted`/`pushed` with no error at the lane, at the wrapper, and at the engine (`push:clean`, zero engine push invocations), and no delivered push path is removed, reordered, or narrowed.
- **F-3, the durable fact and its fold**: the `dispatch.lane-push` payload and its bounds, one append per invocation under the store fence, the single bounded read at classification, the newest-record-for-this-attempt rule, the reserved-ahead-of-slice evidence references (the delivered reservation is five, the fold adds at most two, so the post-change maximum is seven of the sixteen-reference budget), and the no-fabrication directions (foreign attempt, no record, unreadable store).
- **F-4, naming the refusal**: the closed cause vocabulary produced inside the seam (`protected-ref` — the delivered literal, shared with the closeout ref guard — plus `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified`), the command's answer, the final-message contract carried by both product surfaces (`pm` agent definition step and the built lifecycle prompt sentence), and the "a disclosure is not a claim" rule against the delivered `push-parity-unmet` row.
- **F-5, the operator fact**: the additive optional `lanePush` member on `dispatch status`, its verbatim projection, its human rendering only when present, its byte-identical absence, and its read posture and widened read count.
- **F-6, the declared divergence**: the typed/shell reach of the product surface, the typed-only nature of the fold and the status fact, and the bounded residual for a lane that runs no `pr_creation` step.
- **Delivery guards**: prompt-required composition (28 → 29), help entries, coverage inventory, the M4 reference page, reference-page parity, `check:help`, `check:prompt` (and the prompt inventory's required phrases), the entrypoint restriction, `check:no-shell`, the output-stability surfaces, and the standing five-package minor changeset.
- **Backward compatibility**: a pre-change store holds no lane-push record and reads byte-identically; pre-change attempts carry no `lane-push:` references; `dispatch <ref>` text mode stays the four-key contract and its machine envelope unchanged (the GH-386 `push` block stays the parity block).

### 1.2 Out of Scope & Known Gaps

- **Real git, real remotes, real credentials.** Never exercised: the transport is injected (`createParityHarness` / `createGitPushSeam({ childRunner })`) and every observation is a real command-path invocation over injected facts. Zero live network calls, zero real child processes, zero wall-clock assertions.
- **The session's prose final message as an artifact.** No delivered seam reads a session's final message as a testable value (the transcript read is a declared capability gap on one harness). AC-F4-1's final-message clause is pinned where the spec puts it: as two product-surface assertions (TC-LMSG-001) plus the behavioural cause naming in the command's answer (TC-LCAUSE-001/002). A session that ignores its instruction is the declared RSK-5 residual, not a testable claim; see §8.3's accepted coverage boundary.
- **The engine's ensure-push behavior.** Unchanged (spec NG-4, AC-F2-1's third clause): the delivered GH-386 suites (`tests/conformance/dispatch/dispatch-parity-push.test.ts`, `tests/behaviour/dispatch-push-parity.test.ts`) stay authoritative and are re-run, not re-pinned. TC-LPUSH-003 asserts only the "zero engine push invocations + `push:clean` evidence" arm the ticket names.
- **The bash wrappers' own push behavior and their retirement.** Unchanged (NG-10); TC-LDOC-002 asserts only the documentation declaration.
- **A worktree-cleanliness precondition at the push** (spec §7.3): deferred; a dirty tree is not tested as a refusal.
- **A remote-head equality claim on `dispatch status`** (spec F-5, DEC-3): deliberately not claimed and therefore not tested; TC-LSTATUS-001/002 pin a recorded snapshot, never a live comparison.
- **Refined cause classification beyond the closed set** (spec §7.3): the eight tokens are the contract; a wrong-but-closed label is the declared RSK-4 residual.
- **Changeset naming and phase ordering.** Delivery mechanics (spec §18); TC-LGATE-001 asserts the invariant (one new changeset, five fixed packages, all minor), not a file name.

## 2. References

- Change specification: `./chg-GH-416-spec.md` — §5 capabilities (F-1..F-6) and §5.1 declared behaviors, §6 flows 1–5, §7 scope boundaries, §8.1 CLI surface/grammar/answer/exits, §8.2 the record kind, §8.3 data-model impacts (DM-1..DM-5), §8.5 backward compatibility, §9 NFRs (NFR-1..NFR-8), §10 telemetry, §11 risks (RSK-1..RSK-9), §12 assumptions, §17 acceptance criteria and ticket traceability, §20–§21 privacy/security, §22 maintenance impact, Appendix A code-truth basis, Appendix B the record payload, Appendix C the folded evidence, Appendix D the `pr_creation` sequence and final-message contract, Appendix E the closed cause set with the ticket's named classes.
- PM notes: `./chg-GH-416-pm-notes.yaml` — intake scope reading, the three reserved design points, the doc-risk inventory for phase 7, and the delivery notes (changeset before the first gate run; only affected tests while working and the whole battery once; gate evidence `TMPDIR=$PWD/tmp/tmpdir`; commits via the commit primitive; PR targets `main-tools`).
- Ticket: `juliusz-cwiakalski/agentic-delivery-os` issue #416 (M4-S45, milestone "M4: Jaiship-native delivery") — the four required behaviours, the three acceptance criteria, requirement 4, and the owner comment that adds no scope.
- Testing strategy: `.ai/rules/testing-strategy.md` — bun:test under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; permanent suites assert the current tree, never a branch diff; goldens updated only by explicit regeneration; aggregate gate `pnpm check`; record evidence in change artifacts.
- TypeScript authoring rules: `.ai/rules/typescript.md` §9 (fakes over `mock.module`, determinism, golden discipline) and §10 (iterate with `pnpm typecheck` / `bun test <path>`, finish with `pnpm check`).
- Enduring coverage map: `doc/quality/test-specs/test-spec-dispatch-engine.md` — the dispatch suites this plan joins (parity battery, operator surface, push parity/evidence, help/registration guards), and the coverage map the change reconciles in phase 7.
- Current-truth feature pages the change reconciles: `doc/spec/features/feature-dispatch-engine.md` (derivation arm 8, attempt evidence, operator lane view and read posture, record-kind inventory), `doc/spec/features/feature-quality-gates-and-pr.md` (`pr_creation` tail), `doc/spec/features/feature-delivery-lifecycle.md` (`pr_creation`), `doc/spec/features/feature-agents-and-commands.md` (the new command).
- Delivered code surfaces the plan grounds its seams in: `packages/adapters/src/git/push.ts` (fixed argv `git push --ff-only HEAD:refs/heads/<branch>`, literal non-shell spawn, `PUSH_DEFAULT_TIMEOUT_MS = 60_000`, closed outcome union, `isSafeRef` + `PROTECTED_REF_NAMES` guard before any child), `packages/core/src/contracts/dispatch.ts` (`DISPATCH_PUSH_VERDICTS`, `dispatchPushEvidenceRef`, `DISPATCH_MAX_EVIDENCE_REFS = 16`, `DISPATCH_LANE_RECORD_KIND`, `DISPATCH_LANE_KEY_PREFIX`), `packages/core/src/contracts/dispatch-operator.ts` (`DispatchStatusData`, `DispatchStatusParkFact`), `packages/core/src/contracts/pm-notes.ts`, `packages/core/src/domain/closeout.ts` (`branchConvention`, `selectMatchingBranch`), `packages/core/src/domain/dispatch-prompt.ts` (`DISPATCH_LIFECYCLE_SECTIONS`, five markers), `packages/core/src/app/dispatch.ts` (the reserved-evidence block and attempt append), `packages/core/src/app/dispatch-lane-view.ts` (`readOperatorStatus`), `packages/cli/src/help/prompt-required-commands.ts` (28 commands today) and `packages/cli/src/help.ts` (the delivered help inventory), `packages/cli/src/output/dispatch-text.ts` (four-key `renderDispatchText`, additive `renderDispatchStatusText`), `.opencode/agent/pm.md` (step id 10, "PR/MR creation (phase 11)" — its phase list labels `pr_creation` as phase 11 of the lifecycle).
- Delivered test prior art this plan extends: `tests/behaviour/dispatch-push-parity.test.ts` and `tests/behaviour/dispatch-push-evidence.test.ts` (GH-386 act/failure/reservation cells over `createParityHarness` + `createGuardedRunner`), `tests/conformance/dispatch/dispatch-parity-push.test.ts` (registry-proven rows), `tests/behaviour/dispatch-status-park.test.ts` and `tests/conformance/dispatch/dispatch-operator-status.test.ts` (the additive park fact, the counted store, the read-count cell `TC-STATUS-007` asserting exactly two reads today), `tests/conformance/dispatch/dispatch-operator-posture.test.ts` (zero appends/fences/process starts/deletions, byte/mode/mtime stability), `tests/behaviour/dispatch-additive-stability.test.ts`, `tests/golden/dispatch-text.test.ts`, `tests/structure/dispatch-help-inventory.test.ts`, `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` (with `tests/fixtures/help-guide/coverage.json`), `tests/checks/doc-conformance.test.ts`, `tests/checks/dispatch-contract-invariance.test.ts`, `tests/structure/dispatch-token-home.test.ts`, `tests/checks/no-shell-dispatch.test.ts`, `tests/checks/privacy-release.test.ts` (TC-RELEASE-001), `tests/fixtures/prompt-inventory/lifecycle.json`, `tests/behaviour/closeout-branch.test.ts` (the delivered selection semantics, unchanged).
- Related decisions: TDR-0076 (amended by the companion decision record), TDR-0054, TDR-0058; spec DEC-1..DEC-7.

## 3. Coverage Overview

Every AC maps to at least one named case and every case traces to at least one AC; no AC is TODO. TC prefixes are new in this plan and verified unused in the delivered tree immediately before authoring (grep over `tests/` for `TC-LPUSH`, `TC-LRES`, `TC-LSTORE`, `TC-LFOLD`, `TC-LSTATUS`, `TC-LMSG`, `TC-LCMD`, `TC-LCAUSE`, `TC-LOUT`, `TC-LDOC`, `TC-LBND`, `TC-LGATE` returned zero files). The delivered `TC-PUSH-*` series (GH-386) is not reused or extended by name: this plan's cases are distinct acts (lane-side, not engine-side) even where they touch the same seam.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (compressed) | TC ID(s) | Status |
|-------|------------------------|----------|--------|
| AC-F1-1 | No wrapper alive, injected accepting transport: PR head equals branch head when the session ends, exactly one push act for that head, zero commits authored or amended | TC-LPUSH-001, TC-LCMD-001, TC-LCMD-002, TC-LRES-005, TC-LMSG-002 | Covered |
| AC-F1-2 | A resolution refusal — declaration/convention disagreement, no match, more than one match, or a uniquely resolved name that fails the safe-ref guard or names a ref in the seam's protected set — is typed, names the observed state, performs no act, appends no record, starts no child process, and never pushes a guessed, ambiguous, unsafe, or protected ref | TC-LRES-001, TC-LRES-002, TC-LRES-003, TC-LRES-004, TC-LRES-005 | Covered |
| AC-F2-1 | A repeat push of an equal head is accepted with no error; a classification after a successful lane push derives `pr-open` with zero engine push invocations and `push:clean`; no delivered push path removed, reordered, or turned into an error | TC-LPUSH-002, TC-LPUSH-003, TC-LPUSH-004 | Covered |
| AC-F3-1 | A refused push recorded by the lane reaches the attempt as `lane-push:failed` + `lane-push-cause:<cause>` in the reserved-ahead-of-slice refs within the 16 budget, with no new token/identity/row/reason/source/arm/field; a foreign-attempt record and an unreadable store contribute nothing | TC-LFOLD-001, TC-LFOLD-002, TC-LFOLD-003, TC-LFOLD-004, TC-LCAUSE-001 | Covered |
| AC-F4-1 | A refused push is named in the command's answer (cause) and the lane's final message (PR URL + refusal cause; `recorded: false` disclosure when the record did not land), the message never claims the branch is on the remote, and the attempt carries the same cause | TC-LMSG-001, TC-LMSG-002, TC-LCAUSE-001, TC-LCAUSE-002, TC-LCMD-001, TC-LFOLD-001 | Covered |
| AC-F5-1 | `dispatch status` carries the additive `lanePush` fact verbatim (verdict, branch, head, recordedAt, cause when failed), renders additive human lines only when present, is byte-identical when absent, and makes no network call, starts no process, takes no fence, appends nothing, and takes at most one additional bounded record read | TC-LSTATUS-001, TC-LSTATUS-002, TC-LSTATUS-003 | Covered |
| AC-F6-1 | The reconciled pages and the operations guide declare the session-side push as a product surface reachable from typed and shell lanes, the fold and the status fact as typed dispatch surfaces, the wrappers' and engine's behavior unchanged, and the no-`pr_creation` lane's merge-bar backstop | TC-LDOC-002, TC-LDOC-001 | Covered |

Functional capability roll-up:

| F-# | Capability | TC ID(s) |
|-----|------------|----------|
| F-1 | The lane's own prompt-required typed push, thin over the delivered seam, performing no authoring | TC-LPUSH-001, TC-LCMD-001, TC-LCMD-002, TC-LRES-001..005, TC-LBND-001 |
| F-2 | Idempotent second push; the delivered push landscape unchanged | TC-LPUSH-002, TC-LPUSH-003, TC-LPUSH-004 |
| F-3 | Durable bounded lane-push record and its fold into reserved attempt evidence | TC-LSTORE-001, TC-LSTORE-002, TC-LFOLD-001..004 |
| F-4 | The refusal named on three surfaces with one closed vocabulary | TC-LCAUSE-001, TC-LCAUSE-002, TC-LMSG-001, TC-LMSG-002, TC-LCMD-001 |
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
| DM-1 | `dispatch.lane-push` payload (`delivery.dispatch.lane-push.v1`, key `dispatch.lane-pushes:<ref>`): schema, ref, repository, branch, head (full-hex), verdict, cause iff `failed`, attemptId/sessionId when a lane record was readable, recordedAt; whole payload ≤ 512 UTF-8 bytes; identifiers and SHAs only | TC-LSTORE-001 (members, bounds, forbidden content, append-only latest-wins), TC-LSTORE-002 (attempt/session binding and its absence) |
| DM-2 | `lane-push:<verdict>` / `lane-push-cause:<cause>` evidence references; reserved ahead of the slice beside the delivered five (`lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, `push:<verdict>`); the fold adds at most two, so at most seven of the 16-reference budget | TC-LFOLD-001 (both references, cause form, reservation and the seven-of-sixteen maximum), TC-LFOLD-002 (`pushed` form), TC-LFOLD-003 (no fabrication), TC-LFOLD-004 (disclosure not a claim) |
| DM-3 | Additive optional `lanePush` fact on `DispatchStatusData` (`verdict`, `branch`, `head`, `cause?`, `recordedAt`), verbatim from the newest matching record; absent when none stands; human lines only when present | TC-LSTATUS-001, TC-LSTATUS-002, TC-LSTATUS-003 |
| DM-4 | Closed cause vocabulary on the seam's `detail` member: `protected-ref` (the delivered literal, shared with the closeout ref guard), `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified`; the outcome union unchanged; these tokens name the seam's own recorded rejection (`failed`, record appended) and **not** the command's pre-act resolution refusal | TC-LCAUSE-001 (arm (b): all eight, mapping arms, record appended, distinct from TC-LRES-004's arm (a)), TC-LCAUSE-002 (`unclassified` fallback, no `protected-branch` alias, raw text never leaves the seam) |
| DM-5 | The `push <ref>` command contract: one positional, the answer keys of §8.1, exits 0/1, no new error identity | TC-LCMD-001 (grammar, both answer forms, exits), TC-LOUT-002 (bounds and redaction), TC-LDOC-001 (registration and page) |

External integration (spec §8.4) is covered at the seam only: the one remote write is asserted through the injected runner's recorded argv, count, and order (TC-LCMD-001, TC-LBND-001), and TC-LBND-002 asserts no provider read class is added. No case opens a network connection or reads a real remote.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) / note |
|-----|-------------|-----------------|
| NFR-1 | Act boundedness: exactly one child per invocation; fixed argv naming only the change branch; literal non-shell spawn; injectable 60 000 ms budget, no new configuration key; one attempt, no retry; fast-forward only; no force-capable variant | TC-LBND-001 (the whole act contract at the seam), TC-LCMD-001 (one act per invocation), TC-LCMD-002 (no retry after a failed append), TC-LPUSH-002 (no escalation to force on a recorded prior refusal) |
| NFR-2 | Added cost per lane end: ≤ 1 branch read, 1 lane read, 1 push (≤ 60 000 ms), 1 append; classification adds ≤ 1 record read; 0 added provider reads | TC-LBND-002, TC-LFOLD-003 (single lane-push read), TC-LSTATUS-003 (status read count) |
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
| Structure / contract pins | `bun:test`, `tests/structure/*.test.ts`, `tests/checks/*.test.ts` | Closed vocabularies (cause set, verdict set, answer key sets), additive-only pins, help inventory, the prompt inventory's required phrases, reference-page parity, doc-conformance phrase table, `no-shell` static scan, changeset invariant |
| Golden | `bun:test`, `tests/golden/*.test.ts` | `dispatch <ref>` four-key text byte stability and the classified-failure cells; deliberate regeneration only |
| Static invariant (script) | `scripts/checks/no-shell-dispatch.ts` via `pnpm check:no-shell`; `scripts/checks/prompt-conformance.ts` via `pnpm check:prompt`; `scripts/checks/help-guide-coverage.ts` via `pnpm check:help` | NFR-6's home, the prompt-conformance rule set over the edited `pm.md`, and the coverage matrix |
| Manual / content checks | Testing-strategy docs layer (traceability review, markdown/link review) | AC-F6-1's content declaration, the decision record's presence, and the "no silent drift" reading |
| Aggregate gate | `pnpm check` | Final verification; evidence recorded with `TMPDIR=$PWD/tmp/tmpdir` |

Fixture strategy, applicable to every automated layer: the transport is the injected child runner (`createGitPushSeam({ childRunner })`) or the parity harness's scripted push outcome; the branch facts are delivered local-branch-read fixtures; the change record's `branch:` declaration is a pm-notes fixture value; the lane record is the delivered `dispatch.lane` fixture shape; the clock, the store, and the fence are injected. No case starts a real child process, opens a network connection, or reads a real remote, and no fixture fabricates a command outcome — every observation is a real command-path invocation. Fixtures are never named `*.test.ts`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-LCMD-001 | The `push <ref>` grammar, both answer forms, exits 0/1, one act per invocation | Happy Path | behaviour + structure | High | AC-F1-1, AC-F4-1, DM-5, NFR-1, NFR-4 |
| TC-LCMD-002 | Act-then-append ordering: `recorded: false` on a fence fault, no retry, no second act | Corner Case | behaviour | High | AC-F1-1, RSK-6, NFR-1, NFR-2 |
| TC-LPUSH-001 | **Ticket AC-1 fixture**: no wrapper, injected accepting transport, PR head equals branch head at session end, one push act, zero authored/amended commits | Happy Path | behaviour (fixture) | High | AC-F1-1 |
| TC-LPUSH-002 | **Ticket AC-2 fixture (no-op)**: the second push of an equal head is accepted, not an error, at the lane and at the seam | Regression | behaviour | High | AC-F2-1, NFR-1 |
| TC-LPUSH-003 | **Ticket AC-2 fixture (classification)**: after a recorded lane push, the classification derives `pr-open` with zero engine push invocations and `push:clean` | Regression | conformance + behaviour | High | AC-F2-1, NFR-2 |
| TC-LPUSH-004 | The delivered push landscape is intact: the PR workflow's pre-PR push, the engine ensure-push, and the wrappers keep their behavior | Regression | structure + manual content | High | AC-F2-1, NG-4 |
| TC-LRES-001 | Declaration and convention read disagree: typed refusal naming both, no act, no record | Negative | behaviour | High | AC-F1-2, NFR-7 |
| TC-LRES-002 | The convention read matches no branch: refusal, no current-checkout fallback, no act | Negative | behaviour | High | AC-F1-2, NFR-7 |
| TC-LRES-003 | The convention read matches more than one branch: ambiguous refusal naming the candidates, no act | Negative | behaviour | High | AC-F1-2, NFR-7 |
| TC-LRES-004 | **Arm (a)**: a uniquely resolved unsafe or protected name is a pre-act resolution refusal — no child process, no act, no record | Negative | behaviour + structure | High | AC-F1-2, NG-1, NFR-6 |
| TC-LRES-005 | The unique-resolution arms: declaration + convention agree; declaration absent and the convention read unique | Happy Path | behaviour | High | AC-F1-2, AC-F1-1, NFR-7 |
| TC-LSTORE-001 | The `dispatch.lane-push` payload is bounded and identifier-only (≤ 512 UTF-8 bytes; no stderr, URL, diff, credential), one append per invocation, latest-wins | Corner Case | behaviour | High | DM-1, NFR-5, §20 |
| TC-LSTORE-002 | Record identity binding: attempt/session from the newest readable lane record; absent for a manual run outside a dispatch | Edge Case | behaviour | High | DM-1, RSK-3 |
| TC-LFOLD-001 | The refusal fold: `lane-push:failed` + `lane-push-cause:<cause>` in the reserved block, never truncated, inside the 16 budget | Negative | behaviour + conformance | High | AC-F3-1, DM-2, NFR-5 |
| TC-LFOLD-002 | The acceptance fold: `lane-push:pushed` beside the delivered `push:` verdict | Happy Path | behaviour | High | AC-F3-1, DM-2 |
| TC-LFOLD-003 | No fabrication: a foreign attempt, no record, and an unreadable store each contribute zero references | Edge Case | behaviour + conformance | High | AC-F3-1, NFR-8, RSK-3 |
| TC-LFOLD-004 | A disclosure is not a claim: recorded `lane-push:failed` + parity holds → truthful `pr-open`; parity fails → the delivered `push-parity-unmet` row | Corner Case | behaviour | High | AC-F3-1, DEC-5, F-3 |
| TC-LCAUSE-001 | **Arm (b)**: the seam's own recorded rejection — verdict `failed`, record appended, one closed `detail` cause per token, distinct from arm (a) | Negative | behaviour + contract | High | DM-4, AC-F3-1, AC-F4-1 |
| TC-LCAUSE-002 | `unclassified` is the honest fallback; `protected-ref` is the delivered literal (no alias); the raw failure text never leaves the seam | Corner Case | behaviour + structure | High | DM-4, AC-F4-1, §20 |
| TC-LSTATUS-001 | `dispatch status` carries the additive `lanePush` fact verbatim (pushed and failed-with-cause arms) | Happy Path | conformance | High | AC-F5-1, DM-3 |
| TC-LSTATUS-002 | Byte-identical absence: every delivered member and line unchanged when the fact is absent; additive human lines only when present | Regression | conformance + golden | High | AC-F5-1, NFR-4 |
| TC-LSTATUS-003 | Read posture and count: ≤ 1 additional bounded lane-push read (the delivered two-read cells become three), 0 network/process/fence/append/delete | Corner Case | conformance + behaviour | High | AC-F5-1, NFR-3, DEC-3 |
| TC-LMSG-001 | The final-message contract is carried by both product surfaces with separate assertions: `pm.md`'s `pr_creation` step and the built lifecycle prompt sentence; five markers unchanged | Contract | doc-conformance + structure | High | AC-F4-1, DEC-6 |
| TC-LMSG-002 | The ordered `pr_creation` tail is pinned: PR → URL note → `phase complete` → `push` → final message → STOP; no phase reopen, no retry, no authored commit | Contract | structure + doc-conformance | High | AC-F4-1, AC-F1-1, DEC-6 |
| TC-LOUT-001 | `dispatch <ref>` output stability: four-key text byte-identical; machine envelope unchanged (no lane fact in the envelope) | Regression | golden + structure | High | NFR-4, NG-3 |
| TC-LOUT-002 | The push command's own answer bounds: human ≤ 16 lines / 2 KiB, machine within the envelope bound, redaction unchanged | Corner Case | structure + behaviour | Medium | NFR-4, DM-5 |
| TC-LDOC-001 | Composition and documentation guards: the 29th prompt-required command, help entries, coverage inventory, M4 reference page, parity, `check:help`, `check:prompt`, entrypoint restriction | Regression | structure + checks | High | AC-F6-1, §8.1, RSK-7 |
| TC-LDOC-002 | The declared divergence (F-6) in four feature pages, the operations guide, and the test-spec coverage map | Manual | docs content check | High | AC-F6-1 |
| TC-LBND-001 | No-shell invariant and act boundedness at the seam: fixed argv, literal non-shell spawn, injectable 60 000 ms default, ff-only, upstream only, no force variant, no new config key | Corner Case | static + behaviour | High | NFR-1, NFR-6 |
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
2. Assert exit `0` and that the recorded runner shows exactly one invocation with the delivered argv shape `["push", "--ff-only", "HEAD:refs/heads/<branch>"]`.
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

**Expected Outcome**:

- Ordering is act-then-append with the `recorded: false` disclosure; the act is never duplicated and never suppressed.

#### TC-LPUSH-001 - Ticket AC-1 fixture: no wrapper, injected accepting transport, PR head equals branch head at session end, one push act, zero authored commits

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-5, NFR-1, G-1
**Test Type(s)**: Integration (fixture over an injected transport), conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push.test.ts` (new), built on `tests/fixtures/dispatch/parity/harness.ts` (`createParityHarness`) and `tests/fixtures/dispatch/parity/process-runner.ts` (`createGuardedRunner`); the classification arm reuses the delivered GH-386 harness
**Tags**: @backend, @api

**Preconditions**:

- A simulated lane session that runs no dispatch classification at all (no wrapper): the fixture drives the lifecycle steps directly, then the push.
- An injected transport standing in for the remote: its recorded accepted head is the fixture's "remote head" value; it records every invocation (argv, count, order) and refuses a requested shell by name.
- Ordered evidence state: the pm-notes PR-URL note commit and the `pr_creation` phase-completion commit are both present in the fixture's commit ledger, and the transport's accepted head equals the ledger's current branch head.

**Steps**:

1. Record the commit ledger before the act (count, and the identity of each commit, including the URL-note and phase-completion commits).
2. Run `push <ref>` with the accepting transport; capture the answer.
3. Assert the transport recorded **exactly one** push invocation, and that the head it accepted equals the branch head at that moment — and that no commit landed after the act, so the remote head equals the branch head when the session ends (the ticket AC-1 equality).
4. Assert the commit ledger is unchanged: zero commits authored, zero amended, zero reset, zero rewritten (same count, same identities — the act pushes a head that already exists).
5. Assert the argv names only the change branch and `HEAD` as the source; no other ref, no force flag, no `--force-with-lease`.
6. Assert the answer reports `pushed` for that head with `recorded: true`, and that the durable record's `head` equals the pushed head.
7. Assert the session ends with no attempt record for the fixture's dispatch (no classification ran) — and that nothing is stranded: the evidence is on the transport and the fact is durable.

**Expected Outcome**:

- The defect case is closed by fixture: with no wrapper alive, the lane's own last evidence commit reaches the remote, exactly one act occurs, and nothing is authored or amended.

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
- Injected parity facts: the local head equals the open request's head (the lane's push already landed).
- An injected push runner that records invocations; expected count zero at classification.

**Steps**:

1. Drive `dispatch <ref>` through the real command path with the facts above.
2. Assert the result token is `pr-open` at exit `0`, and that the engine recorded **zero** push invocations (parity holds; `git push` is never called).
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

#### TC-LRES-004 - Arm (a): a uniquely resolved unsafe or protected name is a pre-act resolution refusal

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NG-1, NFR-6, NFR-7, §21
**Test Type(s)**: Integration (real command path over injected seams), Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-resolution.test.ts` (new); the delivered guard predicates in `packages/adapters/src/git/push.ts` (`isSafeRef`, `PROTECTED_REF_NAMES`) reused at resolution time
**Tags**: @backend

**Preconditions**:

- Arm a1: a uniquely resolved branch name that fails the delivered safe-ref grammar (for example one starting with `-`, containing `..`, or containing whitespace).
- Arm a2: a uniquely resolved branch name that is a member of the delivered protected set (`main`, `main-tools`, another `PROTECTED_REF_NAMES` entry) — the delivered `protected-ref` condition.
- A recording transport that would report the invocation if one happened, and a counted store that would report an append.

**Steps**:

1. Run `push <ref>` for arm a1.
2. Assert the refusal is the typed input refusal of AC-F1-2 that **names the observed branch**, exit `1`, **zero child invocations** (the guard runs during resolution, before any child), zero appends, and **no `dispatch.lane-push` record**.
3. Repeat for arm a2; assert the same no-act/no-record/no-child outcome and that the protected set tested against is the delivered `PROTECTED_REF_NAMES` (not a re-declared copy).
4. Assert the argv, had it run, could not have carried a force flag or a second ref — the pre-act guard and the fixed argv are both asserted, not just one.
5. Assert the refusal does not consume the seam's recorded-rejection vocabulary as its own answer shape: the answer is an input refusal with no verdict/`cause` pair, and no record exists to carry a cause (the distinguishing half of the pair completed by TC-LCAUSE-001).
6. Assert the same two names are still refused **by the seam** if resolution is bypassed (a direct seam call) — and that the seam's guard also returns before the child runner is called, so even the bypass arm starts no child process; the defence in depth is present but the command never reaches it, and the two arms coexist without either substituting for the other.

**Expected Outcome**:

- Arm (a): nothing is pushed, no child starts, and no record is written; the observed branch is named. Per spec F-1 "Two refusal arms, one question each" and AC-F1-2, this arm answers "is this ref pushable at all" and never becomes the recorded-rejection arm.

**Notes / Clarifications**:

- This case is the first half of the explicit two-arm pair; TC-LCAUSE-001 is the second half (verdict `failed`, record appended, closed `detail` cause). The pair asserts distinguishability in both directions, so a pre-act refusal that writes a record — or a recorded rejection that starts no child — fails by name.

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

- For each closed cause: a durable lane-push record for the attempt being classified, verdict `failed`, cause = the arm's token (`protected-ref` for the protected class).
- Injected parity facts: the local head is ahead and the engine's ensure-push cannot reconcile (or parity is unreadable per the delivered boundary), so the delivered failure/undecidable path is reachable — the fold is observed beside it, not instead of it.
- A disclosure-stress fixture: an attempt whose evidence slice is filled toward the 16-reference budget (the delivered `dispatch-push-evidence.test.ts` technique).

**Steps**:

1. For each of the eight causes, drive the classification and read the attempt record.
2. Assert exactly one `lane-push:failed` and exactly one `lane-push-cause:<cause>` reference per attempt, with the cause equal to the recorded token (no paraphrase, no truncation of the token).
3. Assert the references sit in the **reserved** block: under the overflowing-slice fixture they are still present in the rendered evidence (the reservation holds), while ordinary slice references are the ones that get cut.
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

#### TC-LCAUSE-001 - Arm (b): the seam's own recorded rejection and the closed cause vocabulary

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-4, AC-F3-1, AC-F4-1, RSK-4
**Test Type(s)**: Behaviour (real command path) + Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lane-push-causes.test.ts` (new), extending the delivered class table in `tests/behaviour/dispatch-push-parity.test.ts`; seam at `packages/adapters/src/git/push.ts`
**Tags**: @backend

**Preconditions**:

- Scripted transport results, one instance per **source**, each a seam-side rejection rather than a resolution refusal:
  - **guard-produced instances** (rejected inside the seam before any child runner call): `unsafe-branch` from the safe-ref guard; `protected-ref` from protected-set membership.
  - **child-act instances** (the runner is invoked and its result is classified): a protection/hook decline git reports, classified to `protected-ref`; non-fast-forward text; authentication/permission text; unreachable-host/address text; a timeout; a spawn-level start failure; and an unclassifiable rejection.
- The closed token set from DM-4 as the expected-value table: `protected-ref`, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `spawn-failed`, `timed-out`, `unsafe-branch`, `unclassified`.
- The `protected-ref` token is the one member reachable from **two sources** — protected-set membership (guard, no child) and a git-reported protection/hook decline (child act, one child) — so no assertion below may infer a child-process expectation from a token alone.

**Steps**:

1. For each scripted instance, run the act and assert the seam's outcome and `detail`: the `detail` **is** the closed cause token, never `git-exit-<n>`, never an exit-code string, never raw text.
2. Assert the token set asserted over the table is exactly the eight declared members (a structural equality, so a ninth token, a missing one, or the old `protected-branch` spelling fails by name) and that the outcome union is unchanged (`accepted | rejected | failed | timed-out`).
3. **Arm (b) artifact set**: for each rejection instance assert verdict `failed`, one `dispatch.lane-push` record appended with that cause, and the token carried into the answer — the recorded-rejection arm of spec F-1/DM-4.
4. **Child-process accounting keys on the source, not the token** (code truth: the safe-ref and protected-set checks precede the `runner(...)` call in `packages/adapters/src/git/push.ts`, while a git-reported protection/hook decline can only be observed through the child act): assert **zero** child invocations for the guard-produced instances (`unsafe-branch` from the safe-ref guard, `protected-ref` from protected-set membership) even inside arm (b), and **exactly one** child invocation attempt for every child-act instance — `protected-ref` from a git-reported protection/hook decline, `non-fast-forward`, `auth-rejected`, `remote-unavailable`, `timed-out`, and `spawn-failed` (where the runner is invoked and reports the start failure). Assert that the declined-protection instance and the protected-set instance end in the **same** closed token `protected-ref` while reporting different child counters, so the token alone never implies a child and the source alone decides the count.
5. **Distinguishability from arm (a)**: assert that what separates arm (b) from the pre-act resolution refusal is the **appended `dispatch.lane-push` record** plus the `failed` verdict and closed cause in the answer — **not** a child invocation, which the guard-produced instances on both sides lack. Arm (a) (TC-LRES-004) yields no record, no verdict/cause pair, and no child; arm (b)'s guard-produced instances for the same two conditions yield a record with verdict `failed` and the closed cause, and still no child; arm (b)'s child-act instances yield a record **and** one child. Neither arm may acquire the other's artifact, and no child-act instance may be reported as a pre-act refusal — its record is what makes it a recorded rejection.
6. Assert both consumers name a cause: the lane command's answer and the engine's ensure-push (the engine ignores the cause for classification — its behavior is unchanged, asserted by the delivered parity suites re-run in TC-LPUSH-004).
7. Assert the lane's answer carries the same token as the record's `cause`, and that the record's `cause` is in the closed set in every arm.
8. Assert a `spawn-failed` result maps to the `failed` outcome with cause `spawn-failed` (not to `rejected`), and a timeout maps to `timed-out` with cause `timed-out`.

**Expected Outcome**:

- One closed vocabulary, produced inside the seam, consumed by both producers, with the declared mapping for each of the ticket's named classes — and the recorded-rejection arm cleanly separated from the pre-act resolution refusal.

**Notes / Clarifications**:

- This case is the second half of the explicit two-arm pair whose first half is TC-LRES-004; both are required so neither arm can silently become the other (spec F-1 "Two refusal arms, one question each", DM-4, Appendix E's closing note).

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
4. Assert the pattern table lives in one declared place (a structural assertion that the cause literals appear once in the source and are imported, not re-typed at call sites).
5. Assert the protected literal is the delivered `protected-ref` — the same string the closeout ref guard publishes — and that no `protected-branch` alias, mapping, or second spelling exists in the seam, the contracts, the answer, or the record (a vocabulary pin: the eight-member set is the whole set, and a rename is a contract change, not a test detail).
6. Assert no credential-shaped or URL-shaped substring survives into any artifact.

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
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-operator-status.test.ts` + `tests/golden/dispatch-text.test.ts` (Existing – Update: one additive-lines golden cell, delivered cells unchanged) + `tests/behaviour/dispatch-additive-stability.test.ts` (Existing – Update: the new optional member joins the additive-only pin)
**Tags**: @backend

**Preconditions**:

- The delivered status fixtures: a live lane, a stale lane, a terminal lane, an absent ref, an unreadable store, a pre-change store (no lane-push family), a lane with a worktree path, and a lane with an open park.
- The facts-absent arms: no lane for the ref; a lane but no lane-push record; a lane and a record for another attempt.

**Steps**:

1. Render machine and human status for every absent arm and compare byte-for-byte against the delivered branch-point output (committed goldens where they exist; captured strings otherwise).
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

1. **Agent surface**: assert the `pr_creation` step names the typed `push` command and states the final-message rule — the message names the PR URL and the push outcome; on a refusal it names the cause and does not claim the branch is on the remote; when the record did not land it says the push landed without its record; no retry, no force, no authored commit, no phase reopened.
2. **Prompt surface**: build the lifecycle prompt and assert it carries the one sentence naming the push and the reporting rule, and that the five declared section markers are present and in order (asserted by marker, never by prose matching).
3. Assert the prompt inventory gains `push` in `pm.md`'s required phrases and that `pnpm check:prompt` passes: the edited `pm.md` introduces no raw git write, no hand-edited phase state, no plan progress, and no PR-URL phase write (the delivered rule set).
4. Assert the two surfaces are asserted **separately** (a missing sentence in either fails by name), because they reach different lanes (typed spawn vs. an operator-run `pm`).
5. Assert no new prompt section marker was added (DEC-6) — the marker set is byte-identical to the branch point.

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
3. Assert no instruction in the tail tells the lane to author a commit to make the push succeed, to force, to retry in-lane, or to reopen `pr_creation` on a refusal.
4. Assert the feature-page declarations state the same order and the same refusal rule, and that they declare the push does not replace the PR workflow's own pre-PR push.

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
2. Assert the machine envelope's key set is unchanged: the GH-386 `push` block remains the parity block, and no lane-push member, verdict, head, or cause appears in `dispatch <ref>`'s envelope (NG-3).
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
5. Run `pnpm check:help`, `pnpm check:prompt`, and `bun test tests/checks/reference-page-parity.test.ts tests/behaviour/entrypoint-help-coverage.test.ts tests/checks/help-guide-coverage.test.ts` green; assert no delivered page was rewritten to make the checks pass (the M1/M2 page sets stay byte-unchanged).

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
3. Assert the fixed argv: `git push --ff-only HEAD:refs/heads/<branch>` — one refspec, no force-capable flag, no `--force-with-lease`, no second ref, no repository argument.
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

- A recording branch-read seam, a counted store, a recording transport, and a request-recording provider transport.

**Steps**:

1. Measure one lane end: assert at most one bounded branch read, one bounded lane read, one push child, and one append — nothing else.
2. Measure one classification that folds a lane push: assert at most one additional record read and zero additional provider reads (the request count for the delivered truth/parity reads is unchanged).
3. Assert re-invocation doubles only the act and its append (no accumulation of reads per lane).
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
- **Offline posture**: zero live network calls, zero real remotes, zero real child processes, zero wall-clock assertions, and zero dependence on the host's git credential chain. The injected child runner is the only transport; the counted store is the only read counter; `canonicalize`/byte comparison is the only determinism check.
- **Injected facts**: full-hex fixture SHAs for the pushed head and the parity/PR heads; branch facts as delivered local-branch-read fixtures (`none`/`unique`/`ambiguous` arms); the change record's `branch:` declaration as a pm-notes fixture value (present, absent, disagreeing, over-long); the lane record as the delivered `dispatch.lane` fixture shape with a controllable `attemptId`/`sessionId`; the clock as an injected instant so `recordedAt` is deterministic.
- **Transport outcomes as fixture values**: `accepted` (exit 0, including the "Everything up-to-date" arm), each rejection class with the delivered failure-text shape, `timed-out`, `spawn-failed`, and an unclassifiable text; the seam's guard arms (unsafe ref, protected ref) exercised before any child.
- **Fixture locations**: extend `tests/fixtures/dispatch/parity/` (the harness, the lane double, the process runner's by-name shell refusal) with a lane-push record builder and a resolved-branch builder; add the new parity rows to `tests/fixtures/dispatch/parity/cases.ts` under the existing `push-parity` group and `push` seam (no new group or seam is required by this change's declared surfaces — see §8.2). Fixtures are never named `*.test.ts`.
- **Isolation**: every case uses the delivered temporary state-store root and disposes it (`scenario.dispose()`); no case leaves records in the operator's real state directory; the help/doc guards read the working tree read-only; mock-free by preference (injected fakes only, no `mock.module`).
- **Goldens**: the delivered `tests/golden/*` cells are the baseline. `dispatch <ref>` goldens must not change (TC-LOUT-001). One additive human-lines golden cell for `dispatch status` with the fact present is permitted and must be created by the explicit regeneration path, never by blanket rewrite.
- **Cleanup**: no temp worktree, no `tmp/` residue beyond the declared `TMPDIR` root; the static-scan planted artefacts are exercised through the check's fixture mechanism, never against the working tree.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Execution command | Mocking / injection requirements | Status |
|-------|-------------------------------|-------------------|----------------------------------|--------|
| TC-LCMD-001, TC-LCMD-002 | `tests/behaviour/dispatch-lane-push-command.test.ts` (new) | `bun test tests/behaviour/dispatch-lane-push-command.test.ts` | Injected recording child runner (`createGuardedRunner`), a store double for the fence fault, the real command path | To Implement |
| TC-LPUSH-001, TC-LPUSH-002 | `tests/behaviour/dispatch-lane-push.test.ts` (new) | `bun test tests/behaviour/dispatch-lane-push.test.ts` | `createParityHarness` + injected accepting/up-to-date transports; commit ledger recorded by the fixture | To Implement |
| TC-LPUSH-003 | `tests/conformance/dispatch/dispatch-parity-push.test.ts` (new row) + `tests/behaviour/dispatch-lane-push.test.ts` | `bun test tests/conformance/dispatch/dispatch-parity-push.test.ts` | Seeded lane-push record for the classified attempt; equal-head parity facts; zero-invocation recorder | Existing – Update |
| TC-LPUSH-004 | The delivered GH-386 suites (no edit beyond §7's broad note) + a documented content review in the pm-notes | `bun test tests/behaviour/dispatch-push-parity.test.ts tests/behaviour/dispatch-push-evidence.test.ts tests/conformance/dispatch/dispatch-parity-push.test.ts tests/structure/dispatch-push-envelope.test.ts` | None beyond delivered | Existing – No Change |
| TC-LRES-001..005 | `tests/behaviour/dispatch-lane-push-resolution.test.ts` (new) | `bun test tests/behaviour/dispatch-lane-push-resolution.test.ts` | Branch-read fixtures per arm; pm-notes declaration fixtures; zero-invocation recorder on refusal arms | To Implement |
| TC-LSTORE-001, TC-LSTORE-002 | `tests/behaviour/dispatch-lane-push-record.test.ts` (new) | `bun test tests/behaviour/dispatch-lane-push-record.test.ts` | Real temporary store + injected clock; lane-record fixtures (newest, older, absent, unreadable); boundary-value payload fixtures | To Implement |
| TC-LFOLD-001, TC-LFOLD-002, TC-LFOLD-003, TC-LFOLD-004 | `tests/behaviour/dispatch-lane-push-fold.test.ts` (new) + one registry row in `tests/conformance/dispatch/dispatch-parity-push.test.ts` | `bun test tests/behaviour/dispatch-lane-push-fold.test.ts && bun test tests/conformance/dispatch/dispatch-parity-push.test.ts` | Seeded records per cause and per no-fabrication arm; disclosure-stress slice fixture (the delivered `dispatch-push-evidence.test.ts` technique); counted store | To Implement |
| TC-LCAUSE-001, TC-LCAUSE-002 | `tests/behaviour/dispatch-lane-push-causes.test.ts` (new) + `tests/checks/dispatch-contract-invariance.test.ts` (Existing – Update: the cause-set pin) | `bun test tests/behaviour/dispatch-lane-push-causes.test.ts && bun test tests/checks/dispatch-contract-invariance.test.ts` | Scripted failure texts per class; a secret/URL-shaped text arm; no real child | To Implement |
| TC-LSTATUS-001, TC-LSTATUS-002 | `tests/conformance/dispatch/dispatch-operator-status.test.ts` (Existing – Update: two cases) + `tests/behaviour/dispatch-status-lane-push.test.ts` (new, projection-level) + `tests/golden/dispatch-text.test.ts` (Existing – Update: one additive-lines cell) + `tests/behaviour/dispatch-additive-stability.test.ts` (Existing – Update) | `bun test tests/conformance/dispatch/dispatch-operator-status.test.ts tests/behaviour/dispatch-status-lane-push.test.ts tests/golden/dispatch-text.test.ts tests/behaviour/dispatch-additive-stability.test.ts` | Seeded lane + lane-push families; delivered status fixtures for the byte-identity arms | Existing – Update |
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
| The two refusal arms collapse into one in implementation — a pre-act refusal that writes a record, or a recorded rejection that starts no child process | H | The explicit pair TC-LRES-004 (arm (a): no child, no act, no record) and TC-LCAUSE-001 (arm (b): `failed`, record appended, closed cause) asserts distinguishability by artifact presence in both directions; spec F-1 "Two refusal arms, one question each" and DM-4 make either collapse a defect, not a style choice. |
| The `TC-STATUS-007` read-count update is the one delivered assertion that must change, so a later delivery could read it as a regression | L | Called out twice (§7 broad note, TC-LSTATUS-003) with the declared DEC-3 reason; the new count is asserted as "delivered two plus at most one", so a future family addition has an obvious place to update. |
| The ticket's "named in the lane's last message" has no machine-observable artifact, so a test could over-claim | M | TC-LMSG-001 asserts the two product surfaces separately and §8.3 declares the residual as an accepted coverage boundary rather than inventing a transcript assertion. |
| A new prompt-required command drifts the help/coverage/reference inventory, and a coder "fixes" it by rewriting an M1 snapshot page | L | TC-LDOC-001 asserts the M4 page root and the byte-unchanged earlier-milestone pages; `check:help` + `reference-page-parity` + `entrypoint-help-coverage` fail by name. |
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

### 8.3 Resolved by Spec v1.1 and the Accepted Coverage Boundary

**Resolved by spec v1.1** (correction pass, no scope change; recorded here as closed, with the location that now decides each):

| # | Earlier finding | Now decided by | Effect on this plan |
|---|-----------------|----------------|---------------------|
| OQ-1 | The reserved-evidence count was stated as "three delivered plus at most two = at most five", against code truth of five delivered. | Spec v1.1 F-3 "The evidence", DM-2, NFR-5, §4.1 success metrics, Appendix A, Appendix C: the delivered reservation is five (`lane:append-failed`, `lease:not-owned`, `lease:renewal-failed`, `park:recovery-append-failed`, `push:<verdict>`), the fold adds at most two, and the post-change maximum is seven of sixteen. | The plan now states seven of sixteen as the declared maximum and keeps the assertions property-based (membership of the pre-slice reserved block, ≤ 16 total, at most two added) in TC-LFOLD-001 and §3.2/§3.3. |
| OQ-2 | The pre-act resolution refusal and the seam's recorded rejection were both partly described by AC-F1-2 and DM-4, leaving the boundary unstated. | Spec v1.1 F-1 "Two refusal arms, one question each", DM-4, AC-F1-2, Appendix E's closing note: arm (a) is the command's pre-act resolution refusal (safe-ref guard and protected-set membership — no child, no act, no record, typed input refusal naming the observed branch); arm (b) is the seam's own rejection or classification (verdict `failed`, record appended, closed `detail` cause). Neither may silently become the other. | TC-LRES-004 and TC-LCAUSE-001 are now an explicit pair asserting distinguishability by artifact presence in both directions; the "ambiguous boundary" risk row became the "the arms collapse" risk with that pair as its mitigation. |
| OQ-3 | The protected cause token was declared `protected-branch` while the delivered seam emits `protected-ref`, with alias behaviour unstated. | Spec v1.1 DM-4, DEC-4, F-4, the glossary, Appendix E: `protected-ref` is the delivered literal, shared with the closeout ref guard, so no delivered string changes and no alias exists. | TC-LCAUSE-001's table asserts the eight-member set with `protected-ref` and fails on the old spelling; TC-LCAUSE-002 step 5 pins the literal and forbids a `protected-branch` alias anywhere. |

**Accepted coverage boundary** (one, and not a spec defect):

| # | Boundary | Why it stands | How this plan covers what is coverable |
|---|----------|---------------|----------------------------------------|
| CB-1 | AC-F4-1's "the lane's final message names the pull request URL and the push outcome" cannot be machine-observed: no delivered seam exposes a session's final message as a value, and the transcript read is a declared capability gap on one harness. | Spec F-4/F-1 §7.1 place the contract on two product surfaces, each with its own assertion; the spec's RSK-5 declares the residual (a session that ignores its instruction). Asserting a transcript would invent a capability the system does not have. | TC-LMSG-001 asserts both product surfaces separately and TC-LMSG-002 asserts the ordered tail; the behavioural half — the cause being named in the command's answer and carried verbatim into the record and the attempt — is TC-LCAUSE-001/002 and TC-LFOLD-001. The unobservable remainder is declared, not hidden. |

No open question remains. Every earlier finding is either closed by a named spec location above or is the single accepted boundary; none blocks the Definition of Ready.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | Initial test plan: 31 cases (TC-LCMD-001..002, TC-LPUSH-001..004, TC-LRES-001..005, TC-LSTORE-001..002, TC-LFOLD-001..004, TC-LCAUSE-001..002, TC-LSTATUS-001..003, TC-LMSG-001..002, TC-LOUT-001..002, TC-LDOC-001..002, TC-LBND-001..002, TC-LGATE-001) covering AC-F1-1, AC-F1-2, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1, AC-F6-1; the ticket's three acceptance criteria and requirement 4 mapped in §3.1; two spec-side gaps (OQ-1 reserved-count wording, OQ-2 refusal-versus-recorded-cause boundary) and one observation (OQ-3 token name) recorded, plus one declared coverage boundary (GAP-3, the unobservable final message). |
| 1.1 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | Reconcile with change spec v1.1 (correction pass, no scope change). No TC id, AC mapping, or coverage row removed. Reserved-evidence statements now read five delivered plus at most two, seven of sixteen (F-3 "The evidence", DM-2, NFR-5, Appendix C), with assertions kept property-based. TC-LRES-004 and TC-LCAUSE-001 became the explicit two-arm pair (arm (a) pre-act resolution refusal — no child, no act, no record; arm (b) seam rejection — verdict `failed`, record appended, closed cause) and assert distinguishability in both directions (F-1 "Two refusal arms, one question each", DM-4, AC-F1-2, Appendix E). The protected token is the delivered literal `protected-ref` everywhere, with TC-LCAUSE-002 additionally pinning the literal and forbidding a `protected-branch` alias (DM-4, DEC-4, F-4, glossary, Appendix E). §8.3 replaced by "Resolved by Spec v1.1 and the Accepted Coverage Boundary": OQ-1/OQ-2/OQ-3 closed against their deciding locations, and the unobservable final message kept as the single accepted coverage boundary (CB-1). §8.1 risk rows updated to the corrected maximum and to the arm-collapse risk. |
| 1.2 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | Four corrections found by the plan author against code truth; no TC id, AC mapping, inventory, or coverage row changed (31 cases intact). **I-1**: `pr_creation` is labelled by the repo as step id 10 ("PR/MR creation (phase 11)") and phase 11 of the lifecycle — both §2 and TC-LMSG-001 now say that, not "step 11". **I-2**: TC-LCAUSE-001 step 4 no longer expects a child invocation for the guard-shaped causes; it asserts zero child processes for `unsafe-branch`/`protected-ref` (the seam returns those rejections before the runner call), one child invocation attempt for the causes produced by the child act, and that the appended lane-push record — not a child process — is what distinguishes arm (b) from the pre-act refusal arm (a); TC-LRES-004's bypass step records the same seam ordering. **I-3**: §7's broad note now states the real re-pin surface of a twenty-ninth command (the seventeen `PINNING_FILES` suites, the two captured family-list mounting fixtures with the steer base explicitly unchanged, the alias baseline's `help` cell, and the count phrase rows on roughly ten documentation pages) instead of claiming `TC-STATUS-007` was the only delivered assertion to change. **I-5**: the help inventory path is `packages/cli/src/help.ts` (there is no `help/index.ts`), and `packages/cli/src/entrypoint.ts` is recorded as requiring no edit because it mounts the declared set. |
| 1.3 | 2026-11-27 | @test-plan-writer (DeepSeek V4.1 Flash 1017) | One clarification in TC-LCAUSE-001, no renumbering and no other change (31 cases, all ids, and the AC matrix intact). The `protected-ref` token has two sources with different child-process expectations: protected-set membership is a guard rejection made before the child runner is called, while a git-reported protection/hook decline can only be observed through the child act and is classified to the same token. Step 4 therefore keys child-process accounting on the **source** rather than the token — zero child invocations for the guard-produced instances (`unsafe-branch`, `protected-ref` from the protected set) and exactly one for every child-act instance, with the declined-protection instance added to that group — and asserts that the two `protected-ref` sources end in the same closed token while reporting different child counters. The preconditions now name each scripted instance by source (guard-produced versus child-act) and state the two-source property, and step 5's distinguishability wording is scoped to the guard-produced and child-act sub-arms so no step is ambiguous. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Populated during the delivery phase and the quality-gates phase; gate evidence recorded with `TMPDIR=$PWD/tmp/tmpdir`. TC-LDOC-002 is manual and recorded in the change's pm-notes `notes:` evidence. |
