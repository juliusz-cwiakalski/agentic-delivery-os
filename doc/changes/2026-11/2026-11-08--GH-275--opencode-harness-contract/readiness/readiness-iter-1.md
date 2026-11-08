# Readiness Review Iteration 1

Verdict: **NOT_READY**
Work Item: GH-275
Date: 2026-11-08
Pause Required: no

Artifacts reviewed: `chg-GH-275-spec.md` v1.1, `chg-GH-275-test-plan.md` v1.1 (42 TCs), `chg-GH-275-plan.yaml` (6 phases, `plan validate` verdict `valid`, `readyForDevelopment: true`), `chg-GH-275-pm-notes.yaml`, ticket GH-275, and the delivered repository (`packages/core/src/contracts/harness.ts`, `packages/core/src/domain/harness-classify.ts`, `packages/adapters/src/harness/opencode.ts`, `packages/adapters/src/host/index.ts`, `packages/cli/src/production.ts`, `packages/testkit/src/conformance/harness.ts`, `packages/core/src/app/dispatch.ts`, the delivered harness suites/fixtures, `tests/structure/harness-imports.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/checks/privacy-release.test.ts`) plus the installed `opencode v2.2.5` binary (event-emission code inspected in the shipped executable).

Counts: **3 blocking**, **8 advisory**.

## Facet Summary

- spec_completeness: FAIL (B-1, B-2)
- ac_quality: FAIL (B-2, A-1, A-5)
- plan_coverage: PASS (30 ACs each owned by exactly one phase; 42 TCs each owned by exactly one phase — recounted, totals 30/42)
- test_traceability: FAIL (B-3)
- cross_artifact_consistency: FAIL (B-1, A-1, A-2, A-3)
- decision_capture: PASS (A-6 advisory)
- system_spec_consistency: FAIL (B-1 contradicts the delivered conformance floor documented in `doc/spec/features/feature-adapter-conformance.md`)
- plan_doc_update_coverage: PASS (P6 names `feature-harness-adapters.md`, `feature-dispatch-engine.md`, and "any contract table"; A-8 advisory)
- plan_code_area_coverage: FAIL (A-3, A-7)
- dod_defined: PASS (AC set + gates are defined; two ACs are not yet honestly testable — B-2, A-1)

## What checked out (recorded so the next iteration does not re-litigate it)

- **Real stream shape**: the installed `opencode v2.2.5` `run --format json` handler writes `JSON.stringify({type, timestamp, sessionID, ...}) + "\n"` per event. It emits `step_start`, `text`, `reasoning`, `tool_use`, `step_finish`, and `error`; `sessionID` is top-level on every line; `step_finish` carries `part.reason = <normalized finish reason>` with real values `stop | tool-calls | length | error | unknown | content-filter`. `part.reason === "stop"` is a valid completion marker, and the last emitted event of a successful run is `step_finish`. The ticket's diagnosis is correct.
- **Classifier**: `classifyHarnessEvidence` (62 lines) checks `spawnRefused` → `timedOut` → non-zero exit → `failureReported` → `completionMarker` → premature end. Every claimed mapping in spec Appendix C maps to a code the delivered classifier and adapter can produce; no mapping requires a new code.
- **Dispatch**: `packages/core/src/app/dispatch.ts:459-487` spawns/resumes then starts `collect` before the liveness watch and collapses any pre-session failure to `dispatch.session.spawn-failed` with the exact message. TC-OCS-004/082 assertions match the delivered code; DEC-7 is accurate.
- **Migration sites**: `createOpencodeSession` is constructed in exactly 8 files (`packages/cli/src/production.ts:452`, `packages/testkit/src/conformance/harness.ts:91`, `tests/behaviour/harness-claude-session.test.ts:50`, `tests/behaviour/harness-opencode-session.test.ts:54`, `tests/behaviour/harness-spawn-credential.test.ts:108,146`, `tests/behaviour/harness-spawn-env.test.ts:113`, `tests/conformance/harness-liveness.test.ts:281`, `tests/structure/harness-neutrality.test.ts:124`). Every one is in P2's `scope.files`. No missed construction site (see A-7 for the facts-level fixture).
- **Gates**: the `node:child_process` allowlist is exactly 12 sites including `packages/adapters/src/host/index.ts` (`tests/structure/harness-imports.test.ts:24-38`); adding `createHostSpawnStarter` to that file keeps the equality; `tests/structure/content-inventory.test.ts:682` requires the host executable allowance edit the plan owns; `TC-RELEASE-001` (`tests/checks/privacy-release.test.ts:133-171`) does require exactly one added changeset with the five fixed packages at `minor` and a non-empty body, matching DEC-8 and the plan's P6 changeset. `pnpm check` is exactly lint → format → typecheck → test → boundaries → prompt → help → exports-parity.
- **E2E executability**: `opencode v2.2.5` is installed, provider credentials exist, and `gh auth token` succeeds, so `export GITHUB_TOKEN="$(gh auth token)"` (test plan §6.3 line 1478) satisfies the literal-key precondition at `packages/cli/src/production.ts:149`. The procedure is executable in this environment. If the credential is absent at run time, the correct record is exactly what §6.3 step 0a already mandates: `STOP: blocked precondition - no GITHUB_TOKEN`, no TC-OCS-100/101 result, no AC-F8-1 inference.

## BLOCKING findings

### B-1 [critical] cross_artifact_consistency / spec_completeness — DEC-5 forbids the evidence facts the retained conformance floor and delivered suites require

Artifacts: `chg-GH-275-spec.md` §15 DEC-5 (line 302), §8.5 (line 223), AC-F1-7 (line 332); `chg-GH-275-test-plan.md` TC-OCS-061 step 3 (line 1183), TC-OCS-040 (852), TC-OCS-041 (879); plan P2 (line 230), P4 (line 348).

Gap: DEC-5 says `completionMarker` is true **only** when exit 0, not timed out, and the final decoded `step_finish` carries `reason === "stop"`, and that `spawnRefused` is **never** set on a session that produced an identifier. But the artifacts also require the delivered six-scenario conformance floor and the delivered adapter suite to keep passing unchanged:

- `tests/fixtures/harness/scenarios/classification.ts:36-58` (`completed`) feeds `{"session":{"id":"ses_completed"},"result":{"completion":"complete"}}` with status 0 and expects `completionMarker: true` / token `finished`. That stream has no `step_finish`, so under DEC-5 it becomes `premature-end` / `partial`.
- Same file, `harness-failure` (line 103) expects `failureReported: true` from `result.status === "failed"`; under DEC-5 the JSONL read yields `premature-end`.
- Same file, `spawn-refusal` (line 127) carries an identifier **and** `result.refused: true` with status 126 and expects `spawnRefused: true` / `noop-lane-permission`; DEC-5 explicitly forbids `spawnRefused` once an identifier exists, and DEC-4 turns "identifier + non-zero exit" into `failed`.
- Same file, `timeout` (line 145) expects `completionMarker: true` **and** `timedOut: true`, a combination DEC-5 declares impossible.
- `tests/behaviour/harness-opencode-session.test.ts:219-270` (TC-HARN-010) asserts `completed` and `failed` outcomes from `output(...,"complete")` / `output(...,"failed")` single-document envelopes.
- TC-OCS-061 step 3 requires the JSONL variants to "classify identically to the single-document form", and the plan's P2 requires the migrated suites' "existing assertions still hold" via `streamStarterFromRunner`.

The spec never states that the legacy single-document `result` envelope's evidence facts remain honoured; §8.5 only says such a document "remains readable" (handle acquisition). A deliverer cannot satisfy DEC-5 and TC-OCS-061/TC-HARN-010 at the same time.

Suggested remediation target phase: **specification** (then test_planning/plan alignment).
Suggested fix: decide and record evidence precedence explicitly in F-4 / DEC-5 / §8.5 — e.g. "when the first parsed object is a legacy single-document envelope carrying a `result` object, its `completion`/`refused`/`failure`/`toolFailure` facts set the evidence and take precedence over JSONL terminal facts; otherwise the terminal `step_finish` rule applies", and note that `spawnRefused` may be true only for that legacy envelope. Then align TC-OCS-040/041/045 and AC-F1-7 with that rule, and clarify the `timeout` scenario's expected `completionMarker`. If the alternative (drop legacy evidence support, rewrite the conformance raw shapes to JSONL and change the delivered assertions) is chosen instead, that changes a delivered conformance contract and must be stated as such, with P2/P4 owning `tests/fixtures/harness/scenarios/classification.ts` and the delivered assertions.

### B-2 [critical] spec_completeness / ac_quality — §8.4's read vocabulary cannot produce the tool-error and failure facts AC-F4-3 / AC-F4-4 require

Artifacts: `chg-GH-275-spec.md` §8.4 (line 214), §12 assumption (line 269), DEC-5 (line 302), AC-F4-3 (line 342), AC-F4-4 (line 343); `chg-GH-275-test-plan.md` GAP-T2 (line 48), OQ-T1 (line 1740), TC-OCS-042 (906).

Gap: the spec declares the event types read as `step_start`, `text`, `step_finish` only, while AC-F4-3 requires an "explicit tool-error fact in the stream" and AC-F4-4 requires observed failure facts. The real v2.2.5 stream carries tool failures as `{"type":"tool_use", ..., "part":{"type":"tool","state":{"status":"error","error":"<message>"}}}` and stream failures as `{"type":"error", ..., "error":{"type","message"}}` — neither type appears in the spec's vocabulary. As written, a deliverer following §8.4 cannot set `toolFailure` or `failureReported` at all; and because the pinned 3-line fixture carries no tool-error line, TC-OCS-042 becomes self-certifying: the same delivery authors the fixture and the assertion, so AC-F4-3 can never fail. OQ-T1's "capture during delivery" is not a resolution — the encoding is knowable now and was verified in the installed binary.

Suggested remediation target phase: **specification** (test plan follows).
Suggested fix: name the encodings in §8.4 and DEC-5 (tool failure = `tool_use` with `part.state.status === "error"`; stream failure = `error` event; `reasoning` explicitly out of scope), add both to the pinned fixture/case table, and close OQ-T1. Keep "no second encoding" — the point is that the *real* encoding is named, not invented.

### B-3 [critical] test_traceability — TC-OCS-020's "handle before completion" proof can hang instead of failing, and M-3 cannot turn it red as claimed

Artifacts: `chg-GH-275-test-plan.md` TC-OCS-020 steps 2-4 (lines 619-628), TC-OCS-021 (634-660), §6.1 fixture contract (line 1444), §1.4 judgment call 3 (line 63); plan M-3 (line 101), P2 (line 230).

Gap: TC-OCS-020 step 2 says "Await the fake's `acquired` signal (resolved by the adapter's `acquired()` call)", but the fixture contract in §6.1 exposes `acquiredCalls` (a counter) — not an `acquired` promise; and `acquired()` is called only by a correct adapter. Against the M-3 mutant (`await stream.completion` before returning), `acquired()` is never called and `completion` is gated on `finish()`, so the test blocks at step 2 instead of reaching the bounded `flushUntil` at step 3. It therefore hangs to the runner timeout, not "fails an assertion after a bounded microtask flush and never hangs" as claimed in §1.4 #3 and M-3. TC-OCS-021 also cannot go red for M-3, because the mutant never returns a handle, so `collect` is never called. The same ordering flaw exists in TC-OCS-030 step 2/4 and TC-OCS-031/032 where "assert it resolves before completion" is sequenced behind an adapter-driven signal.

Suggested remediation target phase: **test_planning** (plan M-3 evidence follows).
Suggested fix: replace "await the acquired signal" with a bounded `flushUntil(() => spawnSettled || fake.acquiredCalls > 0, 64)` gate, then assert `spawnSettled === true`, `fake.acquiredCalls === 1`, and `completionSettled === false`; do the same for the resume proofs; and restate M-3's red set (TC-OCS-020 red by assertion; TC-OCS-021 stays green under M-3 — it is M-4's target).

## ADVISORY findings

### A-1 [major] ac_quality / cross_artifact_consistency — "carrying the timeout flag" has no field to carry it
Spec AC-F1-4 (line 329) and AC-F5-1 (line 345) require the refusal to carry the observed status **and timeout flag**/`timedOut: true`; `HarnessFailure` (`packages/core/src/contracts/harness.ts:303-311`) has `kind, code, summary, field, reference, status, cause` and no `timedOut`, and NG-2/AC-F6-2 forbid changing it. TC-OCS-014 (line 513), TC-OCS-031 step 2 (line 762) and TC-OCS-050 step 3 (line 1038) quietly downgrade the assertion to prose in `summary`. Remediation: **specification** — reword AC-F1-4/AC-F5-1 to "the refusal carries the observed status and a summary identifying the acquisition timeout, and the starter's completion result carried `timedOut: true`", or explicitly state that no structural timeout field exists by contract.

### A-2 [major] cross_artifact_consistency — TC-OCS-071's command-literal assertion contradicts TC-OCS-052's real synthetic child
TC-OCS-071 step 1 (line 1238) scans `tests/behaviour/harness-*stream*.test.ts` — which matches `harness-host-stream.test.ts` — and asserts "the only command values come from `tests/fixtures/harness/harness-io.ts` synthetic constants". TC-OCS-052 (line 1087) requires that suite to run a real synthetic child via `process.execPath -e '<script>'`. As written, TC-OCS-071 fails the suite it exists to protect, or the deliverer silently excludes a file from the scan. Remediation: **test_planning** — scope the command-literal assertion to the adapter suites and explicitly allow `process.execPath` in the host suite (keep the `node:child_process` / `Bun.spawn` / `Bun.$` ban on all harness suites).

### A-3 [major] plan_code_area_coverage — P4 declares work in files outside P4's `scope.files`
P4's summary (lines 361-372) says the opencode conformance registration must build over the starter and that real-shape JSONL variants are added; the registration lives in `packages/testkit/src/conformance/harness.ts` (only in P2's scope) and the scenario raw shapes live in `tests/fixtures/harness/scenarios/classification.ts` (in no phase's scope). Either the work belongs to P2, or P4 must declare those files. Remediation: **delivery_planning** — add `tests/fixtures/harness/scenarios/classification.ts` to whichever phase edits it (P2 if the derivation changes, P4 if variants are scenario data) and state that inline variant construction (no fixture edit) is the chosen approach; move the registration edit statement to P2 or add the testkit file to P4.

### A-4 [major] test_traceability — the E2E cannot distinguish non-blocking from completion-gated, and a slow first event is misread as a product failure
§6.3 step 6 (lines 1521-1529) waits 15 s after finding the child, then kills it. The shipped liveness cadence is `lane.liveness-interval` default 30 000 ms (`doc/spec/features/feature-dispatch-engine.md:233`, `packages/core/src/app/dispatch.ts:502`), so no `liveness:` evidence is produced; and both a correct adapter and a completion-gated one keep the child alive, then acquire the id from buffered stdout after the kill and classify — AC-F8-1 passes for both. Separately, a first event slower than the 60 s handle bound makes the starter kill the child and the run ends `spawn failed before a session existed`, which the current pass/fail rule classifies as a product FAIL. Remediation: **test_planning** — set `lane.liveness-interval` to ~3 s in the clone (a disposable, contained edit), require at least one `liveness:` evidence ref, and classify a `harness.spawn.refused` whose summary names the acquisition timeout as a blocked precondition (environment/model latency), not a product failure.

### A-5 [major] ac_quality — AC-F3-3's "never silently switches lanes" is unreachable against the real CLI
`opencode run --help` documents `--session: "Session ID to continue, or to create if it does not exist"`, and the run handler stamps the requested id into every event. A mismatch therefore cannot occur in production; the check is a defensive invariant that only the fake starter can exercise (which is how TC-OCS-032 tests it). Remediation: **specification** — state that the identity check is defence-in-depth and unreachable with the pinned CLI (it would only fire if the CLI changed), so no AC or PR claim implies a production lane-switch was prevented.

### A-6 [advisory] decision_capture — the "no TDR" call should cite the repo's own bar
DEC-1 (line 298) asserts no TDR is required because the runner shape is unchanged. `TDR-0008-additive-adapter-contract-extensions-closeout-v1.md` is the precedent for an additive adapter-contract extension being recorded at R2, and `.ai/agent/decision-instructions.md:21` sets ceremony by stakes/reversibility. Remediation: **specification** — either author a short R1 TDR for the second host seam, or state explicitly why this additive, reversible, engine-invisible seam sits below the record bar (and keep the PM's revisit trigger).

### A-7 [advisory] plan_code_area_coverage — keep the composer's starter fact optional-with-default
`ProductionCompositionFacts.harnessSpawnRunner` is optional with a host default (`packages/cli/src/production.ts:197,286`). `tests/fixtures/queue/production/harness.ts:205` injects only the runner and is not in P2's scope; if `harnessSpawnStarter` is made required, that fixture is a compile break, and if it defaults to the real host starter a future dispatch through that fixture would spawn a real CLI. Remediation: **delivery_planning** — state that the new fact is optional with `createHostSpawnStarter()` as the default (mirroring the runner), and keep `tests/fixtures/queue/production/harness.ts` free of real spawns.

### A-8 [advisory] plan_doc_update_coverage / isolation — the E2E writes to the real state root
`stateDirectory` is `${homeDirectory}/${brand.stateDirectoryName}` (`packages/cli/src/production.ts:227`), so the probe appends a real `dispatch.attempt` and binds the real GH-275 queue lease outside the clone. §6.3 permits this ("retained as production evidence") but only AC-F8-2's worktree snapshot is asserted. Remediation: **delivery_planning** — add an explicit post-run check that the probe's lease is released and record the attempt id in §10, so the probe cannot contend with the change's own queue state.

## Required remediation per owning artifact

- **Specification (`@spec-writer`)**: B-1 (evidence precedence for the legacy single-document envelope + `spawnRefused` carve-out + the `timeout` scenario), B-2 (name `tool_use`/`error` in §8.4 and DEC-5; close OQ-T1), A-1 (timeout flag wording), A-5 (identity check severity), A-6 (TDR citation or record).
- **Test plan (`@test-plan-writer`)**: B-3 (bounded flush gate instead of awaiting `acquired`; corrected red sets), A-2 (TC-OCS-071 scope), A-4 (E2E cadence + acquisition-timeout classification), plus the TC alignments implied by B-1/B-2 and A-1.
- **Plan (`@plan-writer`)**: A-3 (P4 file scope / variant placement), A-7 (optional starter fact), A-8 (state-root check), and the M-3 evidence correction that follows B-3.
