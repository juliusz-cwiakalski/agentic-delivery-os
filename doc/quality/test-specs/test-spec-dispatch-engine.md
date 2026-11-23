---
ados_distribution: internal
id: TEST-SPEC-DISPATCH-ENGINE
status: Current
created: 2026-11-08
last_updated: 2026-11-23
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-239", "GH-275", "GH-277", "GH-279", "GH-286", "GH-289", "GH-293", "GH-347", "GH-354", "GH-386"]
  related_decisions: ["TDR-0049", "TDR-0050", "TDR-0051", "TDR-0052", "TDR-0053", "TDR-0054", "TDR-0058"]
  feature_spec: doc/spec/features/feature-dispatch-engine.md
---

# Test Specification: Dispatch Engine

## Overview

The dispatch suite protects one property: a delivery verdict is trustworthy only when truth decides it, evidence is durable, and authority moves only through a recorded gate. The suite fails if an exit code alone can produce a success claim; if a dispatch that reaches classification appends no attempt record or appends more than one; if a pre-session refusal records a fake attempt or an admission refusal claims a lease or starts a session; if an admission read outcome is forwarded from the adapter instead of classified from its received status; if an exit-0 run with no decisive arm escapes the total derivation or is reported as a success on its exit code; if a clean exit is restarted, a stall is left running, or a terminal lane record is rewritten; if an admission verdict is decided outside the claim, a refusal surfaces an internal containment identity, or a pre-session refusal appends an attempt or a lane; if a false-success incident is hidden or an incident does not reset the evidence window; if a delivered-evidence divergence duplicates, disappears, or becomes locally unresolvable; if evidence of the wrong class counts toward a production handover; if a handover flips more than one repository, cannot be reverted idempotently, or is lost on replay; if the gate's four condition statuses are derived by a second rule, disagree with `unmetConditions`, or a window-level `unverifiable` becomes a third status; if `cleanDispatches` is a dispatch count rather than the corroborated number; if a handover outcome that reads gate evidence omits `conditions`, or the idempotent revert noop manufactures one; if the fleet row evaluates evidence that is not its own repository's, writes a binding, or fabricates a row when the ledger cannot be read; if bash needs the typed CLI to decide fallback; if the daemon path and the one-shot path disagree; if a model call or secret enters help, summary, gate, record, or envelope; if a per-ref operator query appends, fences, rewrites the lane, starts a process, deletes an artifact file, or reads a shell-owned path; if the typed `log` tail stops being the harness's own stdout, its bounds or retention stop holding, or a torn tail is returned as content; if `last-message` stops being the persisted session's final assistant text or stops being redacted before it is bounded; or if a merge path becomes reachable from dispatch.

## Test Scope

- Components under test: the dispatch contracts (`packages/core/src/contracts/dispatch.ts`, `packages/core/src/contracts/harness.ts`, `packages/core/src/contracts/pm-notes.ts`, `packages/core/src/contracts/projects.ts`), the pure domain (`dispatch-result`, `dispatch-liveness`, `dispatch-comparison`, `dispatch-identity`, `dispatch-authority`, `dispatch-gate`, `dispatch-attempts`, `dispatch-resume`, `dispatch-prompt`, `dispatch-tracker`, `lane-launch-plan`), the app tier (`dispatch`, `dispatch-lane`, `dispatch-ledger`, `dispatch-gate`, `dispatch-attempts`, `queue`, `projects`, `daemon-dispatch-result`, `daemon-supervision`), the checkout identity adapters (`packages/adapters/src/file/dispatch-identity.ts`, `packages/adapters/src/file/pm-notes-parser.ts`, `packages/adapters/src/repo/index.ts`), the two harness adapters (`packages/adapters/src/harness/opencode.ts`, `packages/adapters/src/harness/claude.ts`), the GitHub work-item read and its received-status stamp (`packages/adapters/src/github/client.ts`, `packages/adapters/src/github/normalize.ts`, `packages/adapters/src/io/provider-transport.ts`), the CLI surface (`packages/cli/src/commands/dispatch.ts`, `output/dispatch-text.ts`, `index.ts`, `edge.ts`, `production.ts`, `entrypoint.ts`, `daemon-compose.ts`), the help and prompt-required inventory, the static no-shell invariant (`scripts/checks/no-shell-dispatch.ts`), the four bash entry points plus `scripts/lib/dispatch-authority.sh`, and the four `dispatch` error rows.
- GH-335 contracts under test: the pinned supported-version window and probe grammar with their closed verdict/refusal identities, the declared integration mode with its origin, the two additive optional spawn/resume members (the caller's agent identity and the resolver's single-seat binding) and the additive per-spawn environment context, the four new pre-session refusal identities with the declared `detail.harness` evidence member, the additive attempt facts (held `sessionIds`, recorded `binding`, `harnessVersion`, `versionVerdict`, `mode`, `modeOrigin`), and the additive `delivery.harness.telemetry.v1` row fields (`seat`, `resolvedModel`, `durations`, `absentObservedAxes`).
- GH-347 contracts under test: the dispatch-owned `dispatch.lane` record kind, payload schema, key prefix, and latest-wins read; the optional `capabilities` declaration carried on the session port (every production adapter declares; an absent declaration stays undeclared and keeps the engine's fail-open capable default); the optional harness `terminate` member and its `terminated`/`escalated`/`reaped` result, with `reaped` reporting an exact-identity match rather than an OS reap; the confirmed-versus-unconfirmed termination gate that starts no second session; the fresh-spawn title grammar and bound; the injection-delay vocabulary (`claim-fence`, `tracker-ladder`, `terminate-grace`); the `pmNotes` completeness fact; the caller-scoped restart admission; the arm-keyed corroboration sufficiency entries beside the unchanged token-keyed map; the dispatch claim's no-renewal outcome set; and the permanent `PARITY_PROOF_BOUNDARY` constant.
- Contracts under test: the optional `preflight` admission port and its status-keyed refusal identities, the trusted-refusal marker's narrow forwarding rule, the three additive record kinds and the derived authority document, the closed evidence-class and comparison vocabularies, the eleven-token taxonomy with its projection and derivation classes, the pinned failure-token pairs, the delivered-evidence divergence shape and its per-work-item dedupe, the local-only resolve typing, the four-condition handover gate, the shared `DispatchConditionStatus` shape (`{condition, status: "met" | "open"}` in the declared `truth, coverage, floor, corroboration` order) with the invariant that the open set equals `unmetConditions` in order, the summary's `cleanDispatches` (identical to `corroboration.satisfied`) and trailing-run `consecutiveCleanDispatches`, the handover data's outcome table (four gate-reading outcomes carry `conditions` and `reversible`; the idempotent revert noop is the single evidence-read-free exemption), the `repos.v1` row's additive `reversible` and `handoverGate` fields at their declared order and the unchanged five-column text table, the `production` evidence scope, the read-only non-persisting row binding, the `attempts.v1` read-side contract with its sixteen-field projection, total order and declared bounds, the additive resolve result (unconditional `local-evidence` mode, subject repository, shared repository-scoped divergence block), and the bounded read/output constants.
- Exclusions: no real repository is flipped and no real pilot evidence is accrued; the controlled proof uses the real state store and command path with injected harness, tracker, CI, and VCS ports. No live network, live model, or real merge is exercised. Evidence retention and cross-host authority are out of scope.

## Test Levels

### Unit and pure-domain tests

- `tests/behaviour/dispatch-truth-derivation.test.ts` and `dispatch-state-unverified.test.ts` — the one total derivation order, the retired ledger no-work arm, the subsumed exit-0-no-artifact arm, tracker facts, and the unverifiable-truth token.
- `tests/behaviour/dispatch-liveness.test.ts` — progress signals, absent readings, the two-evaluation stall rule, the terminal pre-restart verdict set, and the undecidable-truth predicate.
- `tests/behaviour/dispatch-comparison.test.ts`, `dispatch-evidence-record.test.ts`, `dispatch-evidence-class.test.ts` — comparison shape invariants, evidence-class declaration and immutability, record completeness, and privacy bounds.
- `tests/behaviour/dispatch-false-success.test.ts`, `dispatch-unevaluable.test.ts` — false-success classification, the unreadable-versus-contradicted corroboration distinction, and record-level versus window-level degradation.
- `tests/behaviour/dispatch-identity.test.ts` and `tests/structure/dispatch-authority-view.test.ts` — repository identity resolution, rename stability, checkout-scoped marker reuse, and the atomic authority view.
- `tests/behaviour/dispatch-dual-run-floor.test.ts`, `dispatch-gate-evidence.test.ts`, `dispatch-gate-window.test.ts`, `dispatch-divergence.test.ts` — floor-only semantics, corroboration, incident-exclusive window, and divergence folding.
- `tests/behaviour/dispatch-delivered-evidence-divergence.test.ts` — the delivered-evidence predicate over the classifier outcome and readable ledger, at most one open divergence per (repository, work-item reference), the divergence-before-attempt order, the failed-divergence-append and orphan directions, replay, and summary counting.
- `tests/behaviour/dispatch-resolve-diagnostics.test.ts` — local-only resolve, preserved `state` identities with their own projections, the distinguishable not-found sentinel mapped to `input.value.rejected`, note clamping, and replay idempotency.

### Command and ledger tests

- `tests/behaviour/dispatch-harness-lease.test.ts` — harness resolution, lease claim, pre-session refusals, and spawn-refused recording.
- `tests/behaviour/dispatch-admission-preflight.test.ts`, `dispatch-admission-read-mapping.test.ts`, `dispatch-admission-diagnostics.test.ts` — admission ordering before the lease, zero side effects and zero requests on a credential refusal, the status-keyed read-outcome matrix with identity and kind asserted together, the name-only bounded summary in machine and human output, the trusted-refusal marker, and the admission read budget and latency.
- `tests/behaviour/providers/github-inputs.test.ts`, `github-trap.test.ts` — the real GitHub client and normalizer stamp the received 2xx status onto a decode failure, keep 404 as `provider.not-found`, preserve any other non-2xx status, and leave a thrown transport status-absent.
- `tests/behaviour/dispatch-harness-verdict-mode.test.ts` — the success side records the normalized observed version, the window verdict, the selected mode and its origin; each pre-session refusal carries exactly its mapped `detail.harness` member and appends no attempt record; the unassigned named agent carries no member; the daemon producer records the held identity and a binding only when one exists; the scripted projection is exactly `{error, runId}`; and every committed capture replays with one handle acquisition, full drain, and unchanged evidence.
- `tests/behaviour/dispatch-harness-acquisition.test.ts` — the real opencode adapter over a scripted JSONL stream through the dispatch composition: the handle is returned before the session completes, `collect` stays pending across at least two liveness polls, the recorded call order is spawn → collect → liveness → classify, and a pre-session failure still collapses to `dispatch.session.spawn-failed`.
- `tests/behaviour/dispatch-watch.test.ts` — progress-based watching at the lane cadence, the recorded verdict trail, a transient stall cleared by later progress, a persistent stall at the bound classifying `max-restarts`, and a below-bound stall terminating the session and resuming it in-process with no silent second spawn.
- `tests/behaviour/dispatch-envelope.test.ts`, `dispatch-error-envelope.test.ts`, `dispatch-harness-default-detail.test.ts`, `dispatch-harness-default-spawn.test.ts`, `tests/structure/dispatch-envelope-detail.test.ts`, `tests/golden/dispatch-text.test.ts`, `tests/golden/dispatch-errors.test.ts` — machine envelope fields, the data-bearing attempt-stage `data.error`, the additive `DispatchEnvelopeError.detail` on the pre-session spawn path (identified and bounded), the default-allowlist spawn through a synthetic `opencode` on a controlled `PATH`, verbose human detail versus the four-key text, the post-spawn collection failure, four-key text order, and classified failures.
- `tests/behaviour/dispatch-evidence-record.test.ts`, `dispatch-evidence-class.test.ts` — one attempt record per classified dispatch and one per attempt-stage failure.
- `tests/behaviour/dispatch-resume.test.ts`, `dispatch-restart-budget.test.ts`, `dispatch-resume-economics.test.ts` — resume modes, phase-ledger continuity, the operator-resume admission at the persisted bound (a clean exit keeps its classification; only a stall produces `max-restarts`), and resume-economics refusal.
- `tests/behaviour/dispatch-dual-run-summary.test.ts`, `dispatch-handover.test.ts`, `tests/golden/dispatch-summary.test.ts` — summary reporting, readable-but-unmet refusal, handover, reversal, and idempotent replay under an advancing clock.
- `tests/behaviour/dispatch-merge-absence.test.ts`, `tests/structure/dispatch-merge-boundary.test.ts`, `dispatch-imports.test.ts`, `dispatch-composition.test.ts`, `dispatch-preflight-contract.test.ts`, `dispatch-resolve-composition.test.ts` — no merge path, composition honesty, the optional-preflight contract, the production preflight wiring and ordering, the production harness composition, and the production-composed gate, handover, resolve, resume-lane, rename-invariant identity, and per-repository identity isolation paths.
- `tests/structure/cli-edge-seam.test.ts`, `entrypoint-bin.test.ts` — the declared truth-read key registered for redaction from injected environment facts (literal and prefixed references) and the entrypoint/bin secret seam.

The attempt read side and the extended resolve result (GH-289) are covered by:

- `tests/behaviour/dispatch-attempts-ref.test.ts` — `dispatch attempts` reference resolution (explicit flag and the active-change default), the three unresolvable-context cells, the limit grammar (1 and 100 accepted; `0`, `101`, `-1`, `abc`, `07`, `+7`, ` 7`, `001`, and a missing value refused with zero reads), the total order across identical start instants and two insertion orders, and the request-grammar refusals.
- `tests/behaviour/dispatch-attempts-contract.test.ts` — the sixteen-field projection (exact key set, singular `divergenceRef` present or explicit `null`, no undeclared key), `endedAt` and stored instants, the comparison projection with its not-applicable null token, `matched`/`hasMore`, and the no-gate-key cells.
- `tests/behaviour/dispatch-attempts-bounds.test.ts` — the 65,536-byte page declaration, the 5,000-record ledger window with the ledger scope winning, the count-only foreign disclosure over the retained window, exactly one verified store read, and latency at the ledger bound.
- `tests/behaviour/dispatch-attempts-digest.test.ts` — the declared digest with its reviewed three-row and empty goldens, the seven cells, the closed corroboration derivation, the 40-line/8,192-byte human budget with its declared cut, and repeated-run determinism.
- `tests/behaviour/dispatch-attempts-scope.test.ts` — two checkouts on one host root, the migrated root's count-only disclosure independent of `--ref`, the non-checkout refusal, and the read-only-with-respect-to-evidence proof (stable evidence bytes, unchanged record counts, no binding marker).
- `tests/behaviour/dispatch-attempts-refusals.test.ts` — a verified empty history at exit 0, and the torn, unknown, and permission-denied store identities with their delivered projections, never an empty history.
- `tests/behaviour/dispatch-resolve-result.test.ts`, `tests/behaviour/dispatch-divergence-count.test.ts`, `tests/structure/dispatch-attempts-count-rule.test.ts` — the resolve extension (unconditional mode, subject repository, exact counts), replay idempotency, the blank and long note cells, the one deterministic resolve line, the 25-open shared count with 20 identifiers and `idsTruncated`, and the single-computation structural pin with zero list-length derivation.
- `tests/structure/dispatch-attempts-taxonomy.test.ts`, `tests/checks/dispatch-attempts-test-isolation.test.ts`, `tests/structure/dispatch-attempts-composition.test.ts`, `tests/behaviour/dispatch-additive-stability.test.ts` — taxonomy closure over the new surfaces, test isolation, the single pointer route from evidence to the gate, and the delivered shapes with the four delivered-form refusals under `acceptsAnyFlag`.

### Operator surface tests

The GH-354 operator surface is covered by:

- `tests/conformance/dispatch/dispatch-operator-grammar.test.ts` — the family grammar, the four `query` discriminators, and the refusal identities over a poisoned runtime, so "decided before any runtime call" is observable; `tests/structure/dispatch-operator-composition.test.ts` — an uncomposed query surface refusing `input.value.rejected`, never crashing or answering an empty success, and the production composition supplying all four surfaces.
- `tests/conformance/dispatch/dispatch-operator-status.test.ts` — the real lane read, repository scoping before the fold, the `delivering`/`stale`/`marker`/`probe` derivation, the absent-ref answer at exit `0`, and the failed-read typed `state.*` identity.
- `tests/conformance/dispatch/dispatch-operator-isdel.test.ts` — both `is-delivering` forms, the 0/1 exits with the boolean in `data`, the 20-ref bound and its truncation fact, and a stale active lane answering not in progress.
- `tests/conformance/dispatch/dispatch-operator-log.test.ts` and `tests/behaviour/dispatch-operator-log-bounds.test.ts` — the addressed-directory read, the stitched two-file join, the torn-tail drop, the tail grammar, the one truncation fact and its precedence, the black-box `no-log`/`unreadable`/empty distinctions, and the human byte bound.
- `tests/conformance/dispatch/dispatch-operator-message.test.ts`, `tests/behaviour/dispatch-operator-message-composition.test.ts`, and `tests/behaviour/dispatch-operator-transcript-opencode.test.ts` — the capability-gated seam (the Claude Code gap is adapter data, never a test-local branch), the closed ladder, the finality rule, the redact → flatten → bound → mark order against the delivered chokepoint, and the adapter returning stored text verbatim while the query composes the bound.
- `tests/conformance/dispatch/dispatch-operator-persist.test.ts` and `tests/behaviour/dispatch-operator-artifact-writer.test.ts` — the per-stream sink bound before the first value, the one-LF writer rule, the per-file cap by segmentation with an oversized value continued and reconstructed, the newest-two retention, and a sink fault changing no token, exit, record, or evidence.
- `tests/conformance/dispatch/dispatch-operator-posture.test.ts` — zero appends, zero fences, zero process starts, zero deletions, byte/mode/mtime stability, planted shell artifacts unchanged, and the zero-shell posture across the new surfaces.
- `tests/conformance/dispatch/dispatch-operator-matrix.test.ts` and `tests/checks/operator-proof-boundary.test.ts` — the 4-query × 3-lifecycle-state answer matrix from one registry, byte-identical over two runs, and the permanent proved/not-proved boundary.
- `tests/checks/operator-contract-invariance.test.ts`, `tests/checks/operator-seam-identity.test.ts`, `tests/behaviour/dispatch-operator-latency.test.ts`, and `tests/checks/dispatch-operator-test-isolation.test.ts` — the closed contract pins extended additively only, every case driving a real production seam (with a planted reimplementation rejected by name), the 1,000 ms per-query latency budget over the 5,000-record store, and suite isolation from the operator's real state directory.

### Evaluation-surface tests

- `tests/behaviour/dispatch-clean-accrual.test.ts` — `cleanDispatches` equals `corroboration.satisfied` and is not a dispatch count, the trailing-run streak (a non-clean tail breaks it without changing accrual), an uncorroborated success claim counted but not clean, the empty-window zeros and declared empty-window statuses, the pure-fold agreement, the accrual walk (counted, clean, first-appearance coverage, streak), and a resolved divergence leaving the numbers unchanged.
- `tests/behaviour/dispatch-conditions-projection.test.ts` — one shape in the declared order with exactly two keys per entry and closed statuses, an eligible window reading four `met`, a missing class opening `coverage` and `floor`, the open set equalling `unmetConditions` in order on every fixture family including the truncated one, and `corroboration`/`floor` opening without a fabricated status.
- `tests/behaviour/dispatch-handover-conditions.test.ts` — the four gate-reading outcomes carrying four conditions and the noop carrying the declared absences; the no-record exemption; a torn attempts ledger or unreadable divergences ledger never refusing the noop; the `reversible` truth table; the recorded revert refusing under a torn attempts ledger while the noop answers; the unchanged record key set and replay; per-repository isolation; `verdict == "unverifiable" ⟺ truncation present` including the recorded revert's verdict; unchanged handover text; and the noop over a torn or unreadable **handover** ledger refused `dispatch.state-unverified` at exit `2` with no data.
- `tests/behaviour/repos-handover-gate.test.ts`, `tests/behaviour/repos-list-contract.test.ts`, `tests/behaviour/projects-flat-alias.test.ts` — the row's two additive fields in the declared order, agreement with the summary over one ledger and exclusion of foreign records, an unreadable ledger or unresolvable identity failing `repos.state-unavailable` at exit `2` with no row, a truncated read reporting `unverifiable` plus `truncation`, two reads over unchanged state byte-identical, the read re-evaluating and writing nothing, and the `projects.v1` / `projects list --flat` alias carrying neither field byte-identically.
- `tests/behaviour/engine-first-cross-surface.test.ts`, `tests/behaviour/dispatch-additive-stability.test.ts`, `tests/golden/dispatch-summary.test.ts` — the summary, handover, and row agreeing on one ledger; the `truncated` family is a ledger longer than the declared read bound, so the truncation is real and the summary, the handover, and the row all carry `verdict: "unverifiable"` with one identical `truncation` object; the delivered summary and handover shapes extended by appending only with key order pinned; and the summary text lines (`clean_dispatches=`, `consecutive_clean_dispatches=`, `conditions=`) in place before the optional truncation line.
- `tests/checks/engine-first-no-flip.test.ts`, `tests/checks/engine-first-hermetic.test.ts`, `scripts/.tests/test-engine-first-shell-parity.sh` — the handover use case as the only authority writer with reads appending nothing, no live call in the change's surface, and the four entry points' stdout byte-identical across the two authority states with the pointer on stderr only.

### Registration, fallback, and daemon tests

- `tests/behaviour/entrypoint-composition.test.ts`, `entrypoint-help-coverage.test.ts`, `dispatch-help-version.test.ts`, `tests/structure/dispatch-help-inventory.test.ts`, `tests/checks/dispatch-doc-conformance.test.ts` — prompt-required registration, help paths, reference-page coverage, and the stale-ring reconciliation.
- `tests/behaviour/error-classification.test.ts` — the trusted-refusal marker is required for the bounded credential refusal, while an unmarked config-shaped failure and a marked failure for any other `config.*` code keep the untrusted-config suppression.
- `scripts/.tests/test-dispatch-bash-fallback.sh` and `tests/structure/dispatch-bash-authority.test.ts` — the twelve-cell fallback matrix (four scripts × dual-run, authoritative, typed-CLI-absent/broken) and the no-typed-CLI source rule.
- `tests/behaviour/dispatch-daemon-planner.test.ts`, `dispatch-daemonless.test.ts`, `tests/conformance/dispatch/dispatch-daemon-lane.test.ts` — planner output, executor composition, the daemon-path attempt record, and the daemon-less one-shot path. The daemon lane seam is factory-proven here; the production composition mounts the daemon family without a lane composition, so supplying it remains resident-daemon production scope (GH-238).

### Conformance and controlled proof

- `tests/conformance/dispatch/dispatch-e2e.test.ts` — real state and command paths under `controlled-proof` evidence: accrual to eligibility, handover, post-handover dispatch, reversal, and bash fallback.
- `tests/conformance/dispatch/dispatch-fixture.test.ts` — provenance guard: evidence comes from real command invocations, no ledger writer is exposed, and no controlled-proof record counts toward a production repository.

### Parity battery and no-shell tests

The GH-347 battery is offline and deterministic: zero live network calls, zero real child processes, and zero wall-clock assertions; the injected delay recorder is the only time source. The single row registry is `tests/fixtures/dispatch/parity/cases.ts` (43 rows across `class`, `admission`, `resume`, `push-parity` (GH-386), `tracker-outage`, `loop`, `terminate`, and `spawn`), the 11-class table and the permanent `PARITY_PROOF_BOUNDARY` constant live in `tests/fixtures/dispatch/parity/evidence.ts` (nine proven surfaces including GH-386's `push` seam), and the doubles live under `tests/fixtures/dispatch/parity/` (`harness.ts`, `interleave.ts`, `lane.ts`, `pm-notes.ts`, `process-runner.ts`, `seams.ts`, `terminate.ts`).

- `tests/conformance/dispatch/dispatch-parity-push.test.ts` (GH-386) — every push-parity registry row yields its declared token and delivered exit exactly once through the real command path: clean parity with zero push invocations and `push:clean` evidence; the accepted push with `push:pushed` evidence and exactly one re-read; every rejection class (non-fast-forward, protected branch, credential), the timeout, the spawn-level act failure (OQ-1: the same typed row), the stale re-read, and the remote-ahead state all resolving the identity-less typed failure with the PR URL retained, the not-applicable comparison carrying `push-parity-unmet`, and no divergence; the unreadable parity read staying `state-unverified` at exit 2 and never landing in the row; the unaddressable URL staying outside the precondition; the defect-pin matrix proving a divergent `pr-open` unrepresentable over the closed injected fact space; and the resume variants keeping the delivered resume economics (equal heads idempotent with zero pushes, local ahead reconciled by exactly one push).
- `tests/conformance/dispatch/dispatch-parity-battery.test.ts` — every class row yields its token and delivered exit exactly once, the class table names one row per taxonomy token, the import-identity manifest holds for every seam (including the push seam mounted in the production composition), the registry runs twice with identical envelopes and counts at 11/11 class coverage, the live constant has nine proven and six not-proven ids in order with every row's seam proven, the planted controls fail by name, and the suite reads no change artifact; lane records carry the exact key set with no forbidden payload.
- `tests/conformance/dispatch/dispatch-parity-admission.test.ts` — one admitted and one `queue.single-flight` naming the holder over the real claim and a real store, the refusal appending no attempt, lane, or lease; the dispatch proceeding after the fence frees with recorded bounded waits; a never-released fence returning the `state` kind with zero records; the refusal table mapping to its `ERROR_TABLE` projection; and a refused ref admitting after the live lease is gone.
- `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts` — one active record with every DM-1 field before the attempt and one terminal record with the token, outcome, and exact key set; zero lanes and zero attempts for every pre-session refusal; a failed append leaving the token unchanged with a bounded `lane:append-failed`; pre-change attempts and daemon lanes reading unchanged; the daemon reader never returning a dispatch lane and reconciliation appending none; a recorded `pr-open` lane resuming with zero spawns; no recorded lane being an explicit fresh spawn carrying the operator text; an unknown session being a classified failure with one attempt and no spawn; and attach-continue and resume-prompt-reentry at persisted counts being admitted with no ordinal charged.
- `tests/conformance/dispatch/dispatch-parity-tracker.test.ts` — four attempts with waits `[2000,4000,8000]` and no exhaustion reference, five attempts with waits `[2000,4000,8000,16000]` and exit `2` naming exhaustion, and an outage with versus without a decisive artifact resolving through the artifact or `state-unverified`.
- `tests/conformance/dispatch/dispatch-parity-stall-loop.test.ts` — signals ordered with the grace honoured and one session before the restart; a clean exit after an earlier mid-run stall, or with no stall, terminating and restarting nothing; the three terminal pre-restart verdicts short-circuiting with no restart; a confirmed termination below the bound consuming one ordinal and running a second iteration; an unconfirmed termination (`terminated: false`) starting no second session and resolving terminal `state-unverified` with `terminate:failed` evidence; a Claude-shaped port carrying its declared terminate gap and the production Claude port's own `CLAUDE_CAPABILITIES` stopping a below-bound stall before any second session; a terminal verdict short-circuiting with one acquisition and no terminate member; undecidable truth resolving `state-unverified` with the stall evidence and no second session; TERM reaching only the tree with exact-identity matches and unrelated pids untouched; spawn-then-resume with one restart record, one attempt, and active/active/terminal lanes; four iterations with three restarts and exhaustion; a persisted count at or above the bound running one iteration with no restart and no terminate; the injected recorder's exact wait budget; and the active/terminal lane pair appending a new pair on a second run.
- `tests/conformance/dispatch/dispatch-parity-spawn.test.ts` — exactly one `--agent pm` and one `--model`; one `--title ticket-GH-347` on a fresh spawn and none on a resume; a deterministic title across refs and runs; the fresh prompt carrying the ref, the base branch, and the five sections with two refs producing different prompts; a resume using the operator text verbatim; a role-less composition recording no binding and rendering no agent or title; and the shipped CLI rejecting `--agent` and `--title` as unknown options.
- `tests/conformance/dispatch/dispatch-parity-no-shell.test.ts` — every registry row running with fixed argv, no shell, and no script path (the GH-386 push-parity rows included, sweeping the git and push seam argv); the injected runner refusing a requested shell or script path by name; and zero real child processes started by the battery's seams.
- `tests/checks/no-shell-dispatch.test.ts` and the named package script `check:no-shell` (`bun run scripts/checks/no-shell-dispatch.ts`) — the static invariant over the declared dispatch-flow surface, which covers GH-386's adapters push seam so the typed stack's first remote-write act is under the same static scan rules: zero script-path literals, zero `shell: true`, zero shell-capable child-process imports or calls, the one permitted `spawn(` carrying a literal `shell: false`, an empty allowlist, and a planted reference failing by name.
- `tests/behaviour/dispatch-push-parity.test.ts`, `dispatch-push-evidence.test.ts`, `tests/structure/dispatch-push-envelope.test.ts` (GH-386) — the act contract (one attempt per classification, fixed argv naming only the change branch, literal non-shell spawn, injectable 60 000 ms default timeout with no new configuration key, fast-forward only, upstream only); the evidence reservation holding under a genuinely overflowing evidence slice with the 16-reference budget intact; the added-cost bound (one parity read on equal heads, exactly one re-read after a performed push, no new provider read class); the envelope block present exactly on the two evaluating outcomes, bounded single-line members within 256 characters, absent everywhere else including pre-change records; pre-change attempts reading unchanged with no fabricated parity facts; and text mode byte-identical over every parity cell.
- `tests/behaviour/dispatch-single-flight.test.ts` — the dispatch-family per-ref verdicts over the real claim and the sibling renewal control: same-ref refusal under another holder and under its own holder, other-ref `queue.lease-conflict`, TTL staleness proceeding, the no-live-lease claim with one record, no lease or attempt record on refusal, and the sibling `queue claim` still renewing its own live same-ref lease.
- `tests/checks/dispatch-contract-invariance.test.ts`, `tests/structure/dispatch-token-home.test.ts`, `tests/structure/harness-stream-contract.test.ts` — the closed vocabulary and pinned contract surfaces: the eleven tokens, projections, exits, attempt schema, and error table; the token home and the push-verdict home; exactly one failure-mapping row (lifecycle push failure, identity-less) and one comparison-reason literal (`push-parity-unmet`) added; the seven required port members plus the optional `capabilities` declaration and the optional capability-gated `terminate`, with the opencode support, the Claude gap, and the absent-declaration default.

## Test Data

Dispatch suites drive `runCli` with an injected command program and injected harness, tracker, CI, VCS, clock, run-id, and fence seams. Fixtures under `tests/fixtures/dispatch/` supply harness evidence, truth reads, ledger records, evidence windows, authority documents, bash authority files, admission doubles (recording credential port and transport), golden refusal envelopes, golden text, and mutation cases. Evaluation-surface fixtures add the clean and uncorroborated success claims, a non-clean tail, an empty window, two repositories' records in one store, and handover ledgers in readable, truncated, torn, and unreadable states. The controlled proof uses a real local state store and real change files with deterministic UTC date advance; only the command path produces its attempt, divergence, and handover records. The production-composition proof seeds attempt records through the delivered ledger append to reach an eligible window, then drives `summary`, `resolve`, `handover`, and resume through the shipped production composer. The parity battery adds the scripted session port over an injected streaming starter, the deterministic two-invocation admission interleaving over a real state store, the seeded dispatch lane, the process-tree model with a virtual clock and a signal log, the injected zero-delay recorder, and the injected process runner that refuses a shell by name. No fixture fabricates a command outcome.

## Test Scenarios

### Scenario: derivation total order

- **Given** a spawned session that exits `0` with no branch commit, no PR, and a readable non-done non-blocked tracker
- **When** the dispatch classifies
- **Then** the result is `noop-lane-nothing-to-do` at exit `0`, corroborated by the tracker fact alone; the subsumed exit-0-no-artifact failure arm no longer exists.
- **And given** the same evidence with an unreadable tracker
- **Then** the result is `state-unverified` at exit `2`, never a success from an exit code.
- **And given** a readable tracker whose state is done and a blocking label
- **Then** the result is `merged` (the tracker arm precedes the blocking arm) and corroborated by the tracker fact alone.
- **And given** branch commits with incomplete or absent pm-notes
- **Then** the result is `partial` at exit `1`; with complete pm-notes it is `finished`.
- **And given** a non-clean end — a reported failure, a tool failure, or a premature end — with a decisive artifact
- **Then** the artifact arm decides (`pr-open` for an open pull request, `finished` for commits with complete pm-notes); the shared classifier's token is used only when no artifact is decisive.
- **And given** a harness-reported timeout
- **Then** it takes no artifact arm: the stall ladder decides, and the derivation yields the session token.

### Scenario: open PR with an unresolvable URL

- **Given** a tracker fact that the PR is open but no resolvable URL
- **When** truth is evaluated
- **Then** the result token is `pr-open-unverified`, `urlResolved` is `false`, the independent tracker comparison token is `pr-open` with outcome `match`, and no divergence is opened.

### Scenario: pre-session refusal versus attempt-stage failure

- **Given** an unknown harness, rejected input, an admission preflight refusal, or a conflicting lease before a spawn
- **When** the dispatch refuses
- **Then** it emits the classified top-level error envelope at the mapped exit (`1`, or `2` for a provider outage or malformed payload) and appends no attempt record.
- **And given** a spawn failure, restart-budget refusal, resume-economics refusal, or harness spawn refusal
- **Then** exactly one attempt record is appended with the pinned failure token and outcome.
- **And given** a pre-session spawn failure
- **Then** `data.error` is a `DispatchEnvelopeError` carrying the underlying harness failure `kind` and `code` in the additive `detail`, with `field` present only when the failure carries one; the `dispatch.session.spawn-failed` identity, token, outcome, exit, and last message are unchanged; non-verbose text stays exactly four keys while verbose human output names the detail.
- **And given** a post-spawn `harness.collect` failure
- **Then** exactly one attempt record is appended with token `state-unverified`, outcome `failed`, and exit `2`, and the envelope carries the classified error under `data.error`.

### Scenario: admission preflight and read classification

- **Given** an unresolvable truth-read credential and a harness session port that records every spawn and resume
- **When** dispatch runs
- **Then** it refuses pre-session with `config.credential.missing` (`kind: "config"`, exit `1`) and a bounded summary naming the resolved source key and the reference, issues zero provider requests, and records zero spawns, zero leases, and zero attempt records.
- **And given** a resolvable credential and a bounded work-item read failing with 401 or 403
- **Then** the refusal is `provider.auth.rejected` (`kind: "provider"`, exit `1`); 5xx or any other status-bearing non-2xx and a status-absent transport failure are `provider.outage` (`kind: "provider"`, exit `2`); a malformed 2xx payload carrying its received status is `provider.payload.invalid` (`kind: "provider"`, platform-provider); and a 404 is `input.value.rejected` (`kind: "input"`, exit `1`) naming the reference without asserting it is wrong.
- **And given** an unknown harness or a malformed reference
- **Then** the input refusal precedes the preflight and the preflight port is never invoked.

### Scenario: delivered-evidence divergence

- **Given** a completed classifier outcome, a readable phase ledger with progress or a complete total, and an unreadable truth read
- **When** the dispatch records the attempt
- **Then** one open divergence with `comparisonClass: not-applicable`, `engineToken: state-unverified`, `comparisonToken: null`, `attempt:<id>` and `truth:unreadable:<ledger|tracker|artifact|state>` evidence is appended before the attempt, and the attempt carries its `divergenceRef`.
- **And given** an open delivered-evidence divergence for the same (repository, work-item reference)
- **Then** a resume or another unverifiable-but-delivered attempt reuses and references it without increasing the unresolved count, and a new divergence opens only after the previous one is resolved.
- **And given** the classifier outcome is not completed, the ledger is unreadable, or the ledger shows no progress and an incomplete total
- **Then** no divergence opens.
- **And given** the divergence append fails
- **Then** one attempt lands with no `divergenceRef` and a bounded `divergence:append-failed` reference, and the underlying state identity is returned; when the attempt append fails after the divergence lands, the orphan stays open, counted, and resolvable.

### Scenario: resolve writes from local evidence only

- **Given** a composed resolve runtime with spy credential and transport ports
- **When** `dispatch dual-run resolve <id> --note <text>` runs
- **Then** neither port is invoked and the resolution comes from local state and the divergence ledger.
- **And given** a store fault such as `state.lock.busy`, `state.store.torn`, or `state.write.failed`
- **Then** the failure carries `kind: "state"` with that identity and its own projection, never `dispatch.state-unverified`.
- **And given** an absent divergence identifier
- **Then** it is the app-local `divergence-not-found` sentinel surfaced as `input.value.rejected` with `kind: "input"` and nothing is appended, never `state.keys.missing`.
- **And given** a note longer than 240 characters
- **Then** the resolution lands with the note clamped to at most 240 characters.
- **And given** a successful resolution or an idempotent replay
- **Then** the result keeps the five delivered keys and adds `mode: "local-evidence"`, the divergence's own `repository`, and the shared `divergences` block, and the one text line reports the same state, append flag, unresolved count, mode, and repository.
- **And given** a blank or whitespace-only note
- **Then** it exits `1` with `input.value.rejected` and appends nothing.

### Scenario: attempt history is a bounded repository-scoped read

- **Given** a repository with attempts on one reference and an active change in the local delivery context
- **When** `dispatch attempts --ref <ref>` runs
- **Then** `data.ref` is that reference, `data.refSource` is `"flag"`, and every row carries the sixteen declared fields with `divergenceRef` present or explicit `null`.
- **And when** `dispatch attempts` runs with no `--ref`
- **Then** `data.ref` is the active change's reference and `data.refSource` is `"active-change"`; an absent, unparsable, or active-change-less context refuses at exit `1` with `input.value.rejected` and names the context file and the `--ref` remedy.
- **And given** a page bound, a 65,536-byte `data` budget, and a 5,000-record ledger window
- **Then** `matched`, `hasMore`, and a single `truncation` object declare every bound that binds, the ledger scope wins, and the human digest declares its own row cut and ends with the coverage/floor pointer.
- **And given** one project root holding two repositories' records
- **Then** only the invoking repository's rows are returned, foreign records are counted in `excluded.foreignRepository` and never named, and an invocation outside a checkout refuses instead of reading the `unbound` store.
- **And given** a verified empty history
- **Then** it exits `0` with `attempts: []`, `matched: 0`, and `hasMore: false`; a torn, unreadable, or permission-denied store keeps its own `state.*` identity and never reports an empty history, with the exit following that row (`state.permission.denied` is `1`; the platform state rows are `2`).

### Scenario: unreadable corroboration is unevaluable

- **Given** a success claim whose comparison matches but whose corroboration source cannot be read
- **When** the attempt is classified
- **Then** the source is recorded `unsatisfied`, the claim fails corroboration, no divergence is opened, and no false-success incident is recorded or evidence window reset.
- **And given** a readable source that contradicts the claim
- **Then** the attempt is a false-success incident and the window resets.

### Scenario: resume modes and admissions

- **Given** an existing recorded lane and `--resume-prompt`
- **When** the adapter supports attach-and-continue
- **Then** no restart ordinal is consumed and the recorded mode is `attach-continue`.
- **And when** the adapter lacks resume injection
- **Then** the recorded mode is `resume-prompt-reentry` and the prefill cost is acknowledged.
- **And given** a recorded `pr-open` attempt
- **Then** the resolver returns it as the lane, the recorded session is resumed, and zero fresh spawns occur.
- **And given** no recorded lane and `--resume-prompt`
- **Then** the operator text is an explicit fresh spawn, never a fabricated resume.
- **And given** an unknown session
- **Then** the resume is a classified failure with exactly one attempt and no spawn.
- **And given** a persisted restart count at or above the bound
- **Then** the operator resume is admitted, consumes no ordinal, and runs.
- **And when** the re-entry is uneconomical
- **Then** the attempt refuses at exit `1` with the pinned token and appends exactly one record.

### Scenario: one-shot watch and restart admission

- **Given** a running session whose evidence collection is pending
- **When** the watcher polls at `lane.liveness-interval`
- **Then** an advancing session records `progressing` and never stalls, and the verdict trail is recorded as attempt evidence.
- **And given** a healthy spawn that identifies its session on the first stream line
- **Then** the spawn returns its handle before the session completes, and `collect` remains pending while liveness polls.
- **And given** two consecutive sourced no-advance readings followed by an advancing observation and completed evidence
- **Then** the transient stall clears, both verdicts stay recorded as liveness evidence, and the completed session classifies normally rather than `max-restarts`, even when the restart count has reached the bound.
- **And given** a stall still current when evidence collection resolves and a confirmed termination
- **Then** at or above the restart bound the attempt is `max-restarts`/`failed` with the terminal exhaustion record and no second spawn, and below the bound the stalled session is terminated through the declared `terminate` operation, one ordinal is consumed, one `economics.restart` with reason `watchdog.liveness-stalled` is appended, the recorded session is resumed in-process, and the restarted iteration appends no attempt record.
- **And given** an adapter that declares no terminate capability
- **Then** it is never asked, the stall is still recorded, the attempt is terminal `state-unverified` at exit `2`, and no second session starts.
- **And given** a Claude-shaped port that carries the declared terminate gap (the production Claude port's own `CLAUDE_CAPABILITIES`) and a below-bound stall
- **Then** the engine's gate reads the port's declaration, so the stall is terminal `state-unverified` at exit `2` with the stall evidence, zero ordinals, zero resumes, and no second session.
- **And given** a capable adapter whose terminate returns `terminated: false` or rejects
- **Then** the termination is unconfirmed: the stall is recorded with `terminate:failed` evidence, the attempt is terminal `state-unverified` at exit `2`, and no second session starts.
- **And given** a session port with no capability declaration
- **Then** the declaration stays undeclared and the engine keeps its fail-open capable default; the production composition fills every production port from the adapter's exported constant, so the default is reachable only by an explicitly undeclared double.
- **And given** a clean session exit
- **Then** it is terminal: nothing is terminated and nothing is restarted, even at or above the persisted bound.

### Scenario: production composition surfaces

- **Given** the shipped production composer over an injected store, remote, and harness runner
- **When** `dispatch attempts`, `dispatch dual-run summary`, `dispatch dual-run resolve`, `dispatch handover`, `dispatch handover --revert`, and `dispatch <ref> --resume-prompt` run
- **Then** each surface runs through the delivered CLI, the attempt read opens the resolved store against the checkout's repository with persistence disabled, the resume uses the persisted session, the checkout-scoped first-use identity marker binds the repository, two repositories in one home keep separate bindings, a read-only summary never binds an arbitrary `--repo`, and a renamed remote or changed scheduler key does not re-key history.
- **And given** an unresolvable repository argument
- **Then** the surface refuses cleanly at exit `1`.

### Scenario: incident-exclusive window

- **Given** a false-success incident at time T and sufficient counted dispatches strictly after T
- **When** the summary evaluates
- **Then** `windowStart` is T, `windowStartReason` is `false-success-incident-reset`, and a dispatch recorded exactly at T is excluded.
- **And** the four `conditions` read in the declared order (`truth`, `coverage`, `floor`, `corroboration`) with `truth` `open` while an incident or unresolved divergence is in the window, `cleanDispatches` equals `corroboration.satisfied`, and `consecutiveCleanDispatches` is the trailing clean run in ledger append order.
- **And given** no further incident or unresolved divergence, all eleven classes, the floor, and corroboration
- **Then** eligibility is true and all four conditions are `met`.

### Scenario: evidence-class counting

- **Given** a production repository
- **When** the gate counts evidence
- **Then** only `pilot` attempts count; `controlled-proof`, `smoke`, and `fixture` attempts are surfaced as excluded.
- **And given** the controlled repository scope
- **Then** only `controlled-proof` attempts count.

### Scenario: handover and reversal

- **Given** a repository whose evidence bar is readable but unmet
- **When** `dispatch handover <repo>` runs
- **Then** it refuses at exit `1`, names every unmet condition, and changes no authority.
- **And given** the bar is readable and not truncated
- **Then** its data carries the four ordered `conditions` (the open set equal to `unmetConditions` in order), `reversible: false`, and no `truncation`, and `unmetConditions` stays refusal-only.
- **And given** a met bar
- **Then** it appends one handover record, flips only that repository, and refreshes the authority view atomically.
- **And** its data reports the four `met` conditions, `verdict: "eligible"`, and `reversible: true`.
- **And when** `--revert` runs
- **Then** a reversal record restores `dual-run` and history remains; its data carries the four conditions, `verdict`, `reversible: false`, and `truncation` iff the verdict is `unverifiable`; a second `--revert` is a noop at exit `0`.
- **And given** the idempotent revert noop on an already-`dual-run` repository
- **Then** its data carries `recorded: false`, `noop: true`, `operation: "dual-run"`, and `reversible: false`, and no `conditions`, `verdict`, or `truncation`, and a torn or unreadable attempts or divergences ledger never refuses it.
- **And given** the same noop over an unreadable or torn **handover** ledger
- **Then** it refuses `dispatch.state-unverified` at exit `2` with no data and appends no record.

### Scenario: fleet read-time gate evaluation

- **Given** two checkouts on one host root whose ready rows hold evidence for different repositories
- **When** `repos list --json` runs
- **Then** each row carries exactly `repoKey`, `root`, `stateLocation`, `daemonReachable`, `handoverState`, `reversible`, and `handoverGate`, and the block's `countedDeliveries`, `cleanDispatches`, and `conditions` count only that row's own repository identity at the declared `production` scope.
- **And given** a `first-use` row
- **Then** it reports the empty-window evaluation (`ineligible`; `truth` met, `corroboration` met vacuously, `coverage` and `floor` open; `countedDeliveries: 0`) and `reversible: false`, without opening a store.
- **And given** a truncated attempts read
- **Then** the row reports `verdict: "unverifiable"` with `truncation` over the visible window and the read succeeds at exit `0`.
- **And given** an unreadable or torn attempts/divergences ledger, or a ready row whose repository identity cannot be resolved
- **Then** the whole read fails `repos.state-unavailable` at exit `2` with no row and no binding written.
- **And given** two reads over unchanged state
- **Then** the payloads are byte-identical, and the text table stays the delivered five columns.

### Scenario: bash fallback

- **Given** any of the four bash entry points
- **When** the authority view is absent, unreadable, malformed, or torn
- **Then** the script runs as `dual-run` with no typed CLI invocation.
- **And when** the repository is authoritative
- **Then** it prints the deprecation pointer and stays executable.

### Scenario: daemon-driven lane

- **Given** a planned lane and the daemon composition
- **When** the daemon starts, observes, collects, and resumes the lane
- **Then** the planner returns the lifecycle prompt and declared variable names, the lane record is written, and one attempt record is appended with the same token and outcome a one-shot dispatch derives from the same evidence.

### Scenario: controlled end-to-end proof

- **Given** a controlled repository running the real state store and command path under `controlled-proof` evidence
- **When** evidence accrues to eligibility, handover runs, a post-handover dispatch runs, and `--revert` runs
- **Then** the full path succeeds, the bash fallback returns to normal, and the provenance guard proves no hand-inserted evidence.

## Performance and Bounds Tests

`tests/behaviour/dispatch-bounds.test.ts` asserts the bounded summary read, the declared truncation above 5,000 records (`bound: 5000` and the omitted count), the 65,536-byte machine cap, the 40-line/8,192-byte human cap, and the p95 summary latency target. `dispatch-determinism.test.ts` asserts byte-identical replay; `dispatch-idempotency.test.ts` asserts no duplicate records, including a handover replay under an advancing clock; `dispatch-privacy.test.ts` and `tests/checks/fixture-privacy.test.ts` assert no secret, prompt, transcript, or raw payload enters output, records, or fixtures.

## CI Gates

The binding checks are `pnpm check:help`, `pnpm check:no-shell`, `tests/checks/dispatch-doc-conformance.test.ts`, `scripts/checks/error-table-sync.ts`, `scripts/checks/exit-code-literals.ts`, `scripts/checks/prompt-conformance.ts`, and the aggregate `pnpm check`. The parity battery and the no-shell inventory run inside `bun test` as their own suites, so the aggregate gate covers them without a CI-topology change. The bash fallback matrix runs as `bash scripts/.tests/test-dispatch-bash-fallback.sh` alongside the four retained entry-point suites.
