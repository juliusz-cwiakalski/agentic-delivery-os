# Review — GH-286 — iteration 2

- **Status:** FAIL
- **Date:** 2026-11-11
- **Reviewer:** `@reviewer` (local ADOS mode; re-review after the Phase-9 remediation)
- **Branch:** `feat/GH-286/daemon-command-mounting` @ `72e2c1a7` vs `origin/main-tools`
- **Delta reviewed:** `a66c9588..72e2c1a7` (`1df9e74e`, `97a3f410`, `72e2c1a7`) plus a full regression pass
- **Artifacts:** spec v1.4 (50 ACs; DEC-19; extended AC-F7-2; §16 fourteen pages), test plan v1.4 (55 TCs), plan v1.6 (9 phases), pm-notes, review iter-1, readiness iter-1..3, TDR-0023

## Summary

The remediation is substantial and mostly genuine: the detached readiness poll is now tied to the spawn, TC-037/038 assert what they claim, 18 of 21 mutation controls execute the mutated module, the DM-4 predicate is a production unit, the production configuration path and the no-home configuration root are proven, and the owner-hold documentation is corrected. Two blockers remain. First, the readiness remediation's takeover half cannot occur in the production shape: the delivered engine decides "takeover" for a stale lock and then attempts an exclusive create against the still-present `daemon.lock`, so a crashed daemon can never be restarted — `daemon start` reports `daemon.already-running` (naming only the lock path) or a readiness timeout, while DEC-6, RSK-11, the resident-daemon spec, and the new composition comment all state the opposite. Second, the v1.4 §16 declaration now claims to be "the complete set the delivery reconciled" while six reconciled files are declared in no phase scope at all.

## Evidence run

| Check | Result |
|---|---|
| Ten remediation-touched suites (`bun test`) | 105 pass, 0 fail |
| Delivered GH-286 suites, guards, contract/error-table suites (17 files) | 206 pass, 0 fail |
| `tests/conformance/daemon-mount/real-reentry.test.ts` + dispatch daemon suites | 7 pass, 0 fail |
| `help-guide-coverage` | exit 0, all prompt-required commands covered |
| `reference-page-parity` + `doc-conformance` | 15 pass |
| `error-table-sync` | 96 pass |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0, no drift (82 in-scope docs) |
| `plan validate GH-286` | `valid`, `readyForDevelopment=true` |
| `biome lint` / `biome format` on the changed files | exit 0 |
| Probes against the shipped binary (temp roots, cleaned up) | live refusal, bare-start success, stale rejection reproduced; **takeover-after-crash fails** |
| Full battery at `--max-concurrency 4` | not re-run (no regression suspected; pm-notes records 7272/0 at that setting; the targeted suites at HEAD are green) |

The shipped-binary probes: `daemon --help` and `daemon --version` render; a bare `start` on an empty store returns exit `0` with `pid` = the detached child (`ps` agrees), socket reachable, heartbeat age from durable state; a second `start` while live returns exit `1` `daemon.already-running` in 3 ms with `instance=… pid=… acquired_at=… heartbeat_at=… heartbeat_age_ms=…` and appends nothing; a `start` against a stale record returns `daemon.state-recovery-failed`/`resident-readiness-timeout` at exit `2` and never reports the crash victim's pid; a `takeover` control frame over the composed socket returns `daemon.takeover-refused`.

## AC matrix (50)

| AC | Verdict | Evidence |
|---|---|---|
| AC-F1-1 | PASS | production-composition suite (TC-010/015); shipped `daemon status` reaches the handler |
| AC-F1-2 | PASS | `daemon --help` exit 0, usage/options/examples/exit codes/see-also; root listing carries the family |
| AC-F1-3 | PASS | help-guide-coverage exit 0; reference-page-parity + doc-conformance 15 pass |
| AC-F1-4 | PASS | mount-help TC-012, six help tuples at exit 0 |
| AC-F1-5 | PASS | full / entry-only / minimal fact sets all register and select |
| AC-F2-1 | PASS | bare start on an empty store: exit 0, receipt pid = detached child, socket reachable, `ageMs` 20 from durable `beatAt` |
| AC-F2-2 | PASS | TC-031; probe: child records nothing → exit 2, no append, `status` still truthful |
| AC-F2-3 | PASS | TC-032 (no entry path → in-process readiness) |
| AC-F2-4 | PASS | TC-033 (three advancing beats, one `released`/`drain`, one detach, listeners removed) |
| AC-F2-5 | PASS | TC-034 (`immediate-stop`, zero detaches) |
| AC-F2-6 | PASS | TC-035 (no signal host → return at readiness) |
| AC-F2-7 | PASS | stop-safety TC-036 (SIGTERM to recorded pid, `draining`, release observed from a fresh handle) |
| AC-F2-8 | PASS | TC-037 rewritten: only the release append refused, `state.write.failed`, no `data`, one attempt with cancellation observed first, listeners removed, durable record still `acquired` |
| AC-F2-9 | PASS | TC-038 counts terminal records (exactly one) and the `immediate-stop` split; mutant now yields two |
| AC-F2-10 | PASS | real `#!/usr/bin/env bun` child (conformance suite); stripped `PATH` fails closed; no home → `config.value.invalid` exit 1 |
| AC-F3-1 | PASS | state-scope suite: one directory for store/lock/settings/socket/scope |
| AC-F3-2 | PASS | binding written last, look-alike loses, same scope digest |
| AC-F3-3 | PASS | home default byte-identical |
| AC-F3-4 | PASS | non-absolute override keeps the home value, family stays mounted |
| AC-F3-5 | PASS | no home + no override: mounted family, `config.value.invalid` exit 1, nine invocations, no root-level path |
| AC-F4-1 | PASS | probe: `degraded: []`, socket reachable reported in the plain envelope |
| AC-F4-2 | PASS | `--live` live envelope |
| AC-F4-3 | PASS | `--live` fails closed (`socket-unreachable`/`heartbeat-stale`); plain degrades at exit 0 |
| AC-F4-4 | PASS | production config path: configured socket/interval/staleness reach the runtime (40 s beat inside a 60 s bound), empty branch resolves shipped defaults, no literal re-derivation |
| AC-F5-1 | PASS | projection suite, owned fresh instance → `[]` on both reads |
| AC-F5-2 | PASS | released/immediate → `["daemon-unreachable"]` |
| AC-F5-3 | PASS | absent instance → degraded at exit 0 |
| AC-F5-4 | PASS | at/over the composed bound → degraded |
| AC-F5-5 | PASS | watch flips in both directions, one resolver call per projection |
| AC-F5-6 | PASS | 16 owned cells agree with the fold; empty cell degrades |
| AC-F5-7 | PASS | torn ledger degrades, no throw, no fabricated reachability |
| AC-F5-8 | PASS | orphan/foreign-owner beats degrade while the fold reports `running` |
| AC-F6-1 | PASS | instance `pid` is the composing process id (non-zero) |
| AC-F6-2 | PASS | non-positive/degenerate pid → `state-recovery-failed`, zero signal calls |
| AC-F6-3 | PASS | `SIGTERM`/`SIGINT` to the recorded pid only, one call, failure classified |
| AC-F7-1 | PASS | unit content/ExecStart/Environment/enable/linger/receipt over the injected port and the delivered adapter on an in-memory FS (host `systemctl` limitation recorded in TC-105) |
| AC-F7-2 | PASS | XDG absolute; home fallback; no home → `config.value.invalid` exit 1, zero inspections, no unit/marker/directory, before the entry-path guard |
| AC-F7-3 | PASS | unsupported platform/linger failure → `daemon.supervisor-unsupported`, nothing left behind |
| AC-F7-4 | PASS | ownership-scoped uninstall, `noop` on repeat/absent |
| AC-F7-5 | PASS | resolvable state dir + no entry path → `state-recovery-failed`, no unit |
| AC-F8-1 | PASS | error table unchanged (96 sync assertions), every reached identity a delivered row, exits in {0,1,2} |
| AC-F8-2 | PASS | `STATE_SCHEMA_VERSION` unchanged, no kind/payload/migration |
| AC-F8-3 | PASS | array/omitted/resolver payloads byte-identical |
| AC-F8-4 | PASS | delivered suites pass with only the declared updates (206 + 105 + 7 green) |
| AC-NFR-1 | PASS | `--help`/`--version` compose nothing, write nothing |
| AC-NFR-2 | **PARTIAL** | read half PASS (≤2 additional daemon-fact reads, zero connect/probe/sleep, proven with a counting store); the "p95 within 10% of baseline" clause is **unmet** and recorded as unmet in test-plan §10.3 (measured ratio 1.27 minimised, 1.4–2.0× on a scaled store); the absolute 1 000 ms budget is asserted |
| AC-NFR-3 | PASS | real clock: cancellation observed at 232–236 ms, stop at the same instant, one `released` per sample |
| AC-NFR-4 | PASS | status p95 assertions in the status suite |
| AC-NFR-5 | PASS | privacy suite (canaries in every mounted path, spawn environment exactly the declared set) |
| AC-NFR-6 | PASS | install idempotent, released stop `noop`, live start → `daemon.already-running` exit 1 appending nothing (probe) |

**Totals:** 49 PASS, 1 PARTIAL (AC-NFR-2, declared unmet), 0 FAIL.

The blocking defect below sits outside the AC matrix: it falsifies a declared risk mitigation and a current-truth spec sentence, and it breaks the recovery path the mount makes user-facing.

## Blocking finding

### NF-1 — A crashed daemon can never be restarted; the takeover path is unreachable

`packages/core/src/app/daemon-runtime.ts:293-320` decides `takeover` for a stale lock and then calls `ports.lock.acquire(...)`, which is an exclusive create (`packages/core/src/state/daemon-lock.ts:67-78`). A crashed (SIGKILL/OOM/reboot) daemon leaves `daemon.lock` behind, so the create returns `state.lock.busy`, the runtime maps it to `daemon.already-running` with `detail = <lock path>` (`daemon-runtime.ts:305-311`), and no acquisition is ever appended. Nothing removes the stale lock before the create.

Reproduced against the shipped binary on a clean temp root with the default settings, after `SIGKILL` and 35 s of staleness (bound 30 s):

```
$ <binary> daemon start --foreground
delivery-os: daemon.already-running
summary: /…/state/daemon.lock          # exit 1, no holder named
$ <binary> daemon start
{"code":"daemon.state-recovery-failed","summary":"resident-readiness-timeout"}   # exit 2
```

The same holds with a configured `lock-staleness: 1500` and a 3 s wait. The only recovery is manually deleting `daemon.lock`; `daemon stop` fails with `signal-failed` (dead pid), and the control-plane `takeover` handler is a constant refusal (`packages/cli/src/daemon-compose.ts:1086`) whose hint ("wait until the lock heartbeat reaches daemon.lock-staleness before requesting a takeover") can never be satisfied.

Consequences for this change:

1. The remediation's third readiness cell ("a legitimate `taken-over` acquisition is accepted") is only reachable by the fake child in `tests/behaviour/daemon-start-detached.test.ts:195-236`; no real child can produce that record, so the test asserts a state the product cannot reach, and the parent's `taken-over` branch is dead in production.
2. `daemon.already-running`'s error-table hint promises "instance, process, acquisition time, and heartbeat age"; the parent's pre-spawn refusal honours it (verified), but the engine's busy-path summary — the one an operator hits after a crash — carries only the lock path.
3. Four delivered claims are false: `@/chg-GH-286-spec.md` DEC-6 ("a crash does not wedge restarts") and RSK-11 (same, impact `L`), the F-4 paragraph ("a leftover socket file from a crashed daemon is replaced by the next start rather than wedging restarts" — the socket is not the blocker), `doc/spec/features/feature-resident-daemon.md:119-124` ("stale and takeover-eligible … Takeover appends `taken-over`"), and the comment at `packages/cli/src/daemon-compose.ts:733-740` ("a stale one is left for the child's takeover to replace").

**Fix (either path, decided by the change owner):** remove a stale lock before the exclusive create once `evaluateDaemonLock` returns `takeover` (engine change, needs a spec/plan scope update and a regression test that starts after a simulated crash with the lock file present), **or** declare the limitation: correct DEC-6/RSK-11/F-4/§6/the resident-daemon page and the composition comment, map the post-crash outcome to one identity whose hint is true, and add a test pinning the delivered behaviour. Either way the change must stop claiming crash recovery it does not deliver.

## Medium findings

- **NF-2 — §16 claims a complete reconciled set that is not complete; six reconciled files are in no declared scope.** `chg-GH-286-spec.md` (Documentation impact, v1.4) now states "The list is the complete set the delivery reconciled", and the plan header repeats it (`chg-GH-286-plan.yaml:12-21`). The branch also reconciles `doc/spec/features/feature-autonomous-delivery.md`, `feature-doctor.md`, `feature-mcp-surface.md`, `feature-scheduling-engine.md`, `feature-status-digest.md`, and `doc/guides/delivery-modes.md` (owner-hold relocation; MCP home-only parity; qualified CLI/MCP parity). None appears in §16, in phase-7 `scope.files` (`chg-GH-286-plan.yaml:1510-1525`), or in phase-9 `scope.files` (`chg-GH-286-plan.yaml:1855-1877`). This is F-10's class reopened by the remediation itself, now under a stronger universal claim; the content is accurate and should be declared, not reverted.
- **NF-3 — Two remediation claims have no regression assertion.** (a) F-12: the receipt now folds `readDaemonStatus` with the composed `heartbeatIntervalMs`/`lockStalenessMs` (`packages/cli/src/daemon-compose.ts:772-800`), but no start-path test uses a non-default `daemon.lock-staleness` (`mountSettings(directory, values)` supports it), so a revert to default-staleness folding would pass. (b) F-11: the successful-install path is asserted to inspect once only indirectly — the sole `inspects === 1` assertion is on the entry-path refusal path (`tests/behaviour/daemon-install-mount.test.ts:647`), which the old double-inspection code also satisfied; a restored `installSupervisor` would inspect twice on success undetected.
- **NF-4 — The reachability rule now has three production copies.** `liveHolder` (`packages/cli/src/daemon-compose.ts:224-248`) and `daemonReachable` (`packages/cli/src/production.ts:229-250`) implement the same DM-4 predicate (acquisition operation, owner match, `age < staleness`), and `evaluateDaemonLock` (`packages/core/src/domain/daemon-lock.ts:32-47`) states it again with a `Math.max(0, …)` clamp the other two lack. No test asserts the three agree, so the pre-spawn refusal can drift from the queue/lanes marker — the opposite of the "one shared bound … no second rule" claim in AC-F5-6. One shared predicate (returning the holder evidence) should back all three.
- **NF-5 — Production code changed after the recorded gate, and the commit that carries it is typed `docs`.** The Phase-9 completion note records commit `1df9e74e` and its gate results (`chg-GH-286-pm-notes.yaml:21-69`) and says the two trailing doc-sync pages are "pending in the worktree". Those two commits landed (`97a3f410`, `72e2c1a7`), and `72e2c1a7` — subject `docs(GH-286): update doc/guides/delivery-modes.md` — also changes `packages/cli/src/daemon-compose.ts` (the `liveHolder` evidence + refusal detail) and `tests/behaviour/daemon-start-detached.test.ts`. No pm-notes entry records the landed trailing commits or a gate at HEAD. The suites are green at HEAD (this review ran them), so the risk is evidential, not behavioural; `1df9e74e`'s own `docs:` subject over the primary remediation code has the same effect. F-9's accepted template limitation is genuine, but a `docs:` type over source changes mislabels the change for release notes and blame.

## Low / info

- **NF-6 (low) — Test-plan drift for the new start cells.** `TC-DAEMON-030`'s steps (`chg-GH-286-test-plan.md:489-545`) still describe only the happy path; the three new cells (live refusal, takeover acceptance, stale rejection) exist in code and in the suite but not in the scenario contract, and §10.2's aggregate numbers predate the remediation (the Phase-9 note carries the newer run). A reader of the test plan cannot tell the readiness tie exists.
- **NF-7 (info) — `uninstall` in the unresolvable-root cell falls back to the state directory.** With no home, no absolute `XDG_CONFIG_HOME`, and an absolute state override, `install` refuses (correct), but `composedSupervisor` still defaults the configuration root to the state directory (`packages/cli/src/daemon-compose.ts:429-438`), so `daemon uninstall` searches there and reports `noop`. Harmless (it removes only its own marker) but asymmetric with AC-F7-2 and undeclared.
- **NF-8 (info) — Control error frames echo `type:"status"` for a `takeover` request.** Observed while confirming reachability over the composed socket; delivered GH-238 behaviour, untouched here, out of this change's scope — noted so a future protocol pass does not read it as new.

## Iteration-1 finding closure

| Iter. 1 | Verdict | Note |
|---|---|---|
| F-1 (blocking) | **PARTIAL / blocking** | The poll is now tied to the spawn and the pre-spawn live refusal is correct (probe). The takeover-acceptance half is unreachable in production (NF-1), so a crashed daemon still cannot start. |
| F-2 (blocking) | **CLOSED** | TC-037 refuses only the terminal append; asserts identity, no `data`, listeners removed, one attempt, cancellation-first, durable record still `acquired`. |
| F-3 (blocking) | **CLOSED** | TC-038 counts terminal records; the duplicate-terminal mutant produces two executed records (verified in the run). |
| F-4 | CLOSED | 18 controls execute a temp copy of the mutated module; 3 structural controls are declared with reasons; the header matches; §10.3 records it. |
| F-5 | CLOSED (as asked) | `daemonReachable` is an injected production predicate used by projection/boundary/read-cost cells; the extra copy is NF-4. |
| F-6 | CLOSED | Watch clause awaited; cancellation measured at 232–236 ms on the real clock; relative p95 measured and recorded as unmet. |
| F-7 | CLOSED | Configured/empty/invalid configuration cells added; DEC-19 divergence asserted on both surfaces. |
| F-8 | CLOSED | Config-layer owner-hold relocation and the no-home qualifier are accurate and consistent with the code. |
| F-9 | Accepted (verified) | No commit body carries phase metadata; the type-mislabel effect is NF-5. |
| F-10 | **PARTIAL** | Fourteen pages declared, but the remediation reconciled six more files, and §16 now claims completeness (NF-2). |
| F-11 | CLOSED (code) / untested | One inspection, then `port.install`; no success-path assertion (NF-3b). |
| F-12 | CLOSED (code) / untested | Composed interval and staleness folded; no non-default-bound assertion (NF-3a). |
| F-13 | CLOSED | No-home root refusal with zero inspections, no unit/marker/directory, before the entry-path guard. |
| F-14 | CLOSED (already true) | `daemon-status.test.ts` has consumed `normalizeStatus`/`status-unreachable.json` since `551c1ad4`; iteration 1's F-14 was a false positive and the coder recorded that honestly. |
| F-15 | CLOSED | No `require()` in ESM tests, no `as never as`, no `void` silencers or empty `finally` in the changed suites. |

## Documentation

Accurate where it was corrected: the owner-hold relocation (config layer, scheduling engine, status digest, doctor, autonomous delivery, glossary, delivery-modes) matches `readOwnerHold`/`stateDirectory`; the MCP home-only statement matches `packages/mcp/src/serve.ts:85-90,229-271`; the parity claim is properly qualified. Two documentation failures remain: the crash-recovery claims in NF-1, and the §16 completeness claim in NF-2.

## Next

`CALL_CODER`: close NF-1 (fix the stale-lock acquisition or declare the limitation truthfully across spec, risk, current-truth pages, and the composition comment, with a test pinning the delivered behaviour), correct NF-2's declaration and phase scopes, add the two missing assertions (NF-3), unify the reachability predicate (NF-4), and record the post-gate commits (NF-5). Then re-run `@doc-syncer` and re-review. The change is **not** ready for quality gates or a pull request.
