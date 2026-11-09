# GH-275 Code Review — Iteration 1

- **Mode:** local
- **Branch:** `fix/GH-275/opencode-harness-contract`
- **Reviewed HEAD:** `d5feb29b` (base `origin/main-tools` = `a3ad6cd9`)
- **Verdict:** **PASS**
- **Findings:** 0 critical · 0 high · 0 medium · **3 low** · 2 info
- **Spec compliance:** PASS · **Plan compliance:** PASS
- **Next step:** PROCEED (fix low/info items opportunistically; none blocking)

> Environment note: the disposable review clone at `/tmp/opencode/gh275-e2e`
> disappeared mid-review (external cleanup). The review was completed in the
> authoritative source worktree `/home/juliusz/git/cwiakalski-pub-gh/agentic-delivery-os-gh-275`,
> which is the same branch with the full P6 commit (`f4521ced`) plus the
> phase-7 doc-sync commits (`08aed1fe`, `d5feb29b`). The adapter/host/composition/
> test source tree is the same code lineage; only additional `doc/**` reconciliation
> commits differ from the clone tip. All probes below were run there.

## What the change does

The opencode adapter is corrected to consume the real `opencode run --format json`
JSONL contract:

- `packages/adapters/src/harness/opencode.ts` decodes stdout line-independently,
  strips CR, skips blank/non-JSON/non-object lines, takes the first identifier
  with precedence `sessionID` → `session.id` → `sessionId` → `id`, returns a
  handle on the first identified line, keeps draining, and resolves `collect`
  only at process close under the DEC-5 legacy-envelope-over-JSONL evidence
  precedence.
- `packages/adapters/src/host/index.ts` adds `createHostSpawnStarter` beside the
  unchanged `createHostSpawnRunner`: line channel, completion promise that never
  rejects, `acquired()` cancelling the 60 s handle bound, optional
  `sessionTimeoutMs`, idempotent SIGTERM→SIGKILL `kill`, and the preserved 16 MiB
  bound/truncation marker. It remains the single `node:child_process` site.
- `packages/core/src/contracts/harness.ts` adds the additive
  `HarnessSpawnStreamOptions`/`HarnessSpawnStream`/`HarnessSpawnStarter` types and
  re-exports them; `HarnessSpawnRunner`, the port, evidence, and failure codes are
  unchanged.
- `packages/cli/src/production.ts` binds an optional-with-host-default
  `harnessSpawnStarter` for opencode; the one-shot runner remains listing-only;
  Claude receives only the one-shot runner.
- `packages/testkit/src/conformance/harness.ts` derives the opencode starter from
  the scenario `spawnStdout`, keeping the six-envelope floor green.

**Scope verified clean:** `packages/core/src/app/dispatch.ts`,
`packages/adapters/src/harness/claude.ts`,
`packages/core/src/domain/harness-classify.ts`, and `scripts/**` are untouched.

## Probes run (all executed, not inferred)

| Probe | Command | Result |
|---|---|---|
| Diff hygiene | `git diff --check origin/main-tools...HEAD` | exit 0 |
| Plan validate | `bun packages/cli/bin/delivery-os.ts plan validate GH-275 --json` | exit 0 · valid · readyForDevelopment true · 0 errors |
| Typecheck | `pnpm typecheck` (build + all 6 packages + `tests/types`) | all Done, no errors |
| Boundaries | `pnpm check:boundaries` | 356 modules no violations; ambient-globals 162 clean; entrypoints OK; secret-read 325 clean |
| Focused harness suites | 8 suites from the brief | **96 pass / 0 fail / 904 expects** |
| Broader harness + release | 9 suites incl. session/claude/spawn/liveness/composition/content-inventory/privacy-release | **81 pass / 0 fail / 762 expects** (TC-RELEASE-001 green) |
| Scope guard | `git diff --name-only … dispatch.ts claude.ts harness-classify.ts scripts` | empty |

Working tree remained clean after all runs; nothing was staged or committed.

## Plan-phase evidence and coverage

`pm-notes.yaml` records P1–P6 **COMPLETE** with commits and per-phase gate
results, plus phase-7 `system_spec_update` complete:

- P1 `5f05d350`, P2 `fb7fd816`, P3 `7f97fcb1`, P4 `3f8c0078`, P5 `794a70d8`,
  P6 `f4521ced`; phase-7 doc sync `08aed1fe`/`d5feb29b`.
- Mutation evidence M-1…M-19 recorded in test-plan §10 with red/green pairs.
- AC coverage: **30/30** owned (plan header + validate); TC coverage: **46/46**
  mapped. 43 TC-OCS ids are labelled directly in automated tests; TC-OCS-003 is
  exercised by `harness-imports` + `check:boundaries` (untagged — see F-1/note);
  TC-OCS-100/101 are the operator-run §6.3 E2E recorded Pass (token `failed`,
  lastMessage not `spawn failed before a session existed`, worktree unchanged).
- Doc reconciliation is real: `feature-harness-adapters.md` and
  `feature-dispatch-engine.md` now describe the JSONL framing, top-level
  `sessionID`, handle-before-completion, completion-scoped collect, DEC-5
  precedence, the 60 s handle bound and the absent default session bound.

**AC-F8-1 / AC-F8-2** rest on P6's recorded operator E2E evidence. That proof
needs a live `opencode v2.2.5` and `GITHUB_TOKEN` against the real ticket and was
not independently re-executed here; the recorded evidence set is complete per the
test-plan PASS rule, so I treat these ACs as evidenced but not re-probed.

## Findings (advisory only)

### F-1 — low — dropped opencode resume capability-gap test
When the resume describes moved to `harness-opencode-resume-stream.test.ts` (P3),
the opencode "declared resume gap → `harness.capability.gap`" case was not
re-added, so that branch has no direct opencode test now (only Claude's gap path).
The `harness-opencode-session.test.ts:2` header still lists the removed
TC-HARN-008/009. **Fix:** re-add one gap case and refresh the docstring.

### F-2 — low — unrelated mass reorder in `contracts/index.ts`
P1 reorders the whole export surface (+239/−240) while only the three
`HarnessSpawn*` re-exports are semantic (verified by a sorted diff). Harmless but
inflates the diff and merge-conflict surface. **Fix:** keep whole-file reorders in
a formatting-only change next time.

### F-3 — low — unbounded `lineBuffer` in the host starter
`splitLines` appends every chunk to `lineBuffer` before the 16 MiB stdout check
and after `truncated` is set, so a newline-free/very-long single line can exceed
NFR-6's bound in host memory. Real JSONL is newline-delimited, so risk is low.
**Fix:** cap/short-circuit `lineBuffer` once the bound trips.

### F-4 — info — `ResultToken` alias deviation
`type ResultToken = DeliveryResultToken` (disclosed P1 deviation) changes the
exported `HarnessClassification.token` annotation to dodge a secret-scanner
false positive. Semantically identical; gates pass. Prefer fixing the scanner
allowlist if it recurs.

### F-5 — info — latent `collect` rejection path
`pump` has no `catch`; a future starter whose `lines` iterator rejected would
either make `collect` throw across the port boundary (acquired path) or produce
an unhandled rejection (absent path). The shipped host starter never rejects, so
this is latent only. **Fix:** add a defensive catch that maps the failure to
evidence.

## Recommendation

**PASS / PROCEED.** The fix is faithful to spec and plan, stays behind the
adapter/port, preserves every closed vocabulary and the Claude/dispatch/listing
paths, and is backed by deterministic, non-vacuous tests plus the aggregate gates.
Address F-1 (and optionally F-3/F-5) as follow-ups; none blocks merge.
