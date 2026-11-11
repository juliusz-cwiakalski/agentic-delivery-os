# Review confirmation — GH-286 (targeted pass after the iteration-3 remediation)

- **Status:** FAIL — one delivered-artifact contradiction (**CF-1**). Every named finding NF3-1..NF3-5 is verified closed in code, tests, spec, test plan and TDR, and every gate named for this pass is green.
- **Date:** 2026-11-11
- **HEAD reviewed:** `46ff9428` (`7b8e68b9` and `46ff9428` are change-artifact only; no source file changed after `885d8dcc`, so the recorded full battery at `885d8dcc` still describes the shipped code)
- **Artifacts:** spec v1.6 (52 ACs), test plan v1.6 (55 TCs, 52/52), plan v1.7 (TC map 55/55), TDR-0022 (scoped engine exception + amendment row), `review/review-iter-3.md`
- **Scope:** confirmation of the five named findings and of determinism, plus a fresh agreement check across spec / test plan / plan / TDR / docs / code. Not a fourth full iteration.

## Named findings

| Finding | Verdict | Evidence |
|---|---|---|
| NF3-1 engine change no longer denied | CLOSED | §1, NG-1, §5.1 F-2, §7.1, §7.2, §8.5, §12, §13, §16 and TDR-0022 C-6 / scoped-exception note / amendment row all declare the stale-lock takeover reap as the one contract-conformance fix. The only surviving "Consumer only" cell (§16 control protocol, supervisor adapter, records, error table) is scoped to those components and is true. |
| NF3-2 §16 names twenty reconciled pages | CLOSED | The list carries 21 reconciled bullets plus 2 "no change required" bullets and the index line; all twenty are present in the branch diff of `doc/**`, and the two "no change required" pages (`cli-command-registry.md`, `man-page.md`) are absent from it. The completeness sentence is now true. |
| NF3-3 listeners before start; racing signal buffered | CLOSED | `packages/cli/src/daemon-compose.ts:878-905` installs both listeners before `runtime.start` (882) and buffers a signal while the start is in flight (`request`/`startSettled`, 870-875) before applying it at 900; `daemon-main.ts:31-40` opens `waitForStop()` before `start`. `TC-DAEMON-033/036` asserts two registered listeners at acquisition and `[acquired, released]` / `[acquired, immediate-stop]`. Seam parity declared in §5.1 F-2. |
| NF3-4 real-child determinism | CLOSED | `tests/fixtures/daemon/real-child-gate.ts` (exclusive gate, bounded wait, stale takeover) is used by both real-child files; the crash case waits on the child's own durable record (15 s poll, not the 1 s product window) and kills only after the initial heartbeat and fence release (`daemon-crash-restart.test.ts:445-517`). Both files together at default concurrency: **5/5 runs, 6 pass, 0 fail** (2.59-2.64 s each). |
| NF3-5 reap failure keeps its identity | CLOSED | `daemon-runtime.ts:294-309` returns any non-`state.lock.busy` removal code instead of the busy mapping; `daemon-lock.ts:77-93` distinguishes replaced-token (`state.lock.busy`) from remove failure (`state.write.failed` + lock path). `daemon-crash-restart.test.ts:289-338` asserts the identity, the lock path, no append and the dead lock left in place. Matches AC-F2-12. |

### NF3-1 quotes

- §1: "The change is additive apart from one declared conformance fix. It ships the daemon engine's stale-lock takeover reap: on a `takeover` decision the observed dead lock record is removed by a compare-and-delete on its token before the exclusive re-acquire … Beyond that reap there is no engine-semantics, control-protocol, error-identity, state-schema, reconciliation, heartbeat-cadence, or lane-record change."
- NG-1 (§4.2): "… no new lock policy: the delivered staleness evaluation stays the only takeover decision. The single exception is the stale-lock takeover reap declared in §7.1 and AC-F2-11, which is contract conformance with the delivered `taken-over` operation …"
- §7.2: "[OUT] Any daemon engine change other than the takeover reap named in §7.1 … The one in-scope exception removes a record the staleness evaluation has already proved dead; it adds no takeover rule, no lock-policy option, and no new identity (AC-F2-11)."
- §12: "… with the single declared exception of the start path's stale-lock takeover reap (§7.1, AC-F2-11)." §13 (GH-238 row): "Consumed unchanged, with the single declared exception of the start path's takeover reap (§7.1, AC-F2-11)."
- §16: "Daemon engine start path — One declared contract-conformance fix: on a `takeover` decision the stale lock record is removed — by a compare-and-delete keyed on the observed `lockToken` … while any other removal failure surfaces its own identity rather than that busy claim (AC-F2-12)."
- TDR-0022: "### C-6: Additive composition only — no engine, contract, or schema change beyond stale-lock takeover conformance"; "**Scoped engine exception — stale-lock takeover conformance.** *(Added 2026-11-11 — review iteration 3, NF3-1.)*"; and the 2026-11-11 amendment row superseding the earlier "no daemon engine edit" statement.

## Counts and agreement

- Spec 52 AC rows = test plan §3.1 52 rows, identical id sets (`diff` empty).
- 55 TCs in the test plan = 55 distinct TC ids in the plan = 55 §5.1/§5.2/§7 entries.
- AC-F2-11 and AC-F2-12 trace to `TC-DAEMON-030` (§3.1, §3.4, §9, and step 16's two halves).
- Delivered docs carry the same truth: `feature-resident-daemon.md`, `glossary.md` and `test-spec-resident-daemon.md` state the reap, the removal-failure identity and the listener-before-start order.

## Evidence run

| Check | Result |
|---|---|
| daemon behaviour + conformance + checks + structure battery (45 files) | 402 pass, 0 fail |
| entrypoint / queue / lanes battery (44 files) | 406 pass, 1 skip, 0 fail |
| Real-child pair at default concurrency, 5 consecutive runs | 6 pass / 0 fail each run |
| `tests/checks/doc-conformance.test.ts` | pass (in the 402) |
| `scripts/checks/error-table-sync.ts` | OK — entries=121 documented=121 |
| `bash scripts/.tests/test-doc-distribution.sh` | OK — 82 in-scope docs, no drift |
| `plan validate GH-286` | verdict=valid, tier=full, readyForDevelopment=true |
| `git diff --check 885d8dcc..HEAD` | clean |
| Code delta since the 7286-pass battery (`885d8dcc..HEAD`) | doc artifacts only — no source file |

## Findings

- **CF-1 [medium, blocking]** — `chg-GH-286-plan.yaml` still instructs the **pre-remediation** foreground order in two places: the contract summary at lines 341-343 ("… start, capture the readiness snapshot, install `SIGINT`/`SIGTERM`, run the resident loop …") and task 4.1 at lines 979-981 ("start the runtime, capture the readiness snapshot, install exactly one `SIGINT` and one `SIGTERM` listener, run the resident loop …"). The shipped code, spec F-2, DM-2, AC-F2-4/AC-F2-5, `TC-DAEMON-033` step 1 and `test-spec-resident-daemon.md` all state listeners **before** `runtime.start`. The plan therefore instructs exactly the race NF3-3 closed, and no amendment row anywhere supersedes those two sentences. Fix: restate both as "install `SIGINT`/`SIGTERM` listeners, start the runtime, capture the readiness snapshot, run the resident loop, buffer a signal that arrives while the start is in flight and apply its mode once the loop runs".
- **CF-2 [low]** — the plan's SOURCES block (lines 5-6, 19-20) pins spec v1.4 / 50 ACs / `AC-F2-1..10` and test plan v1.4 / 50/50, while the spec is v1.6 with 52 ACs (AC-F2-11, AC-F2-12) and the test plan reports 52/52. Plan revision also stays 1.7 although the file changed after it. Fix: refresh the two pins and add the revision line at the next docs commit.
- **CF-3 [info]** — `46ff9428` (spec v1.6, test plan v1.6, `review-iter-3.md`, three reconciled docs) carries no pm-notes evidence entry; the last note closes `885d8dcc`/`7b8e68b9`. Phase 9's declared exit criterion asks the notes to record the post-phase commits with a gate at that HEAD. Fix: one closing note naming `46ff9428` with this pass's gates.

## Disposition

Everything the confirmation pass was asked to verify is closed and green: the engine change is declared everywhere, §16's twenty pages are real and complete, the foreground order is correct in code and in the normative artifacts, the real-child pair is deterministic at default concurrency (5/5), and the reap surfaces its own identity. The single blocker is CF-1: the implementation plan, which phase 10 reads, still describes the ordering that NF3-3 corrected. Correcting the two plan sentences and the SOURCES pin (CF-1, CF-2) is a comment-only edit inside the change folder; no source, test or AC changes, and no re-run of the source battery is required — `plan validate`, `doc-conformance` and the doc-distribution guard are the only gates that touch those lines.
