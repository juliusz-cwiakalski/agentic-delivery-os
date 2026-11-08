# Readiness Review Iteration 2

Verdict: **NOT_READY**
Work Item: GH-238 (M1-S18: Resident dispatch daemon)
Date: 2026-11-07
Pause Required: no

## Gate Summary

- Artifact set reviewed: `chg-GH-238-spec.md` v1.1 (17 capabilities, 36 ACs, 18 NFRs, 9 events, 17 data-model elements, DEC-1..DEC-17), `chg-GH-238-test-plan.md` v1.2 (102 TCs), `chg-GH-238-plan.yaml` (`delivery.plan.v1`, 12 phases / 84 tasks), `chg-GH-238-pm-notes.yaml`, ticket `juliusz-cwiakalski/agentic-delivery-os#238`, the M1 design pack, the delivered current-truth specs (including `feature-commit-primitive.md`), and the delivered code the change builds on (`commit-act.ts`, `commit-transport.ts`, `commit-message.ts`, `contracts/commit.ts`, `phase.ts`, `edge.ts`, `config/catalog.ts`, `adapters/src/git/commit.ts`, `contracts/blockers.ts`, `state/blockers.ts`).
- Iteration-1 findings: **19** — **15 resolved**, **3 partially resolved** (R-03, R-07, R-13), **1 not resolved** (R-02).
- New findings: **14** — 1 critical, 6 major, 6 minor, 1 nit. **5 blocking** (N-01..N-05), 9 non-blocking (N-06..N-14).
- Blocking total carried into this verdict: **5** (N-01..N-05). R-02 is carried inside N-01/N-02.
- Facets failing: `spec_completeness`, `ac_quality`, `plan_coverage`, `cross_artifact_consistency`, `decision_capture`, `system_spec_consistency`, `plan_doc_update_coverage`, `plan_code_area_coverage`.
- Reopen targets: **specification** (N-01, N-02, N-03, N-05, N-07, N-11, N-14), **test_planning** (N-01, N-02, N-08, N-10, N-11, N-12, N-13, N-14), **delivery_planning** (N-02, N-04, N-06, N-09, N-10). Never `delivery`.
- The Definition-of-Ready override is **not** available and was **not** used: the change adds and alters behavior, introduces contracts (7 record kinds, 8 error rows, 2 configuration branches, a wire protocol, an adapters subpath, an additive git-port read), and changes the command surface.
- Pause is **not** required. Every blocking finding is a change-scoped artifact correction. N-07 additionally needs a decision record authored by `@decision-advisor`; N-01/N-03 may alternatively be closed by a PM decision narrowing the clause with an explicit human acknowledgement in `pm-notes` (see Decision Routing).

Structural facts that pass (so the verdict is about substance, not missing bookkeeping):

- The plan is **schema-valid** through the repository's own validator (`validatePlan` + the real YAML-parser contract): `verdict: "valid"`, `readyForDevelopment: true`, `totalErrors: 0`, `truncated: false`, `schemaVersion: "delivery.plan.v1"`, `tier: "full"`, all 12 phases echoing `kind: delivery` and the declared weight classes (`heavy` 4/5/6/7/9/11/12, `standard` 1/2/3/8/10).
- Test plan: 102 TCs in the index = 102 scenario details = 102 automation rows; 36/36 AC rows; 18/18 NFR rows; EVT-1..EVT-9 and DM-1..DM-17 traced; **seven** seeded scenarios (SC-M1-14/15/16/17/17b/18/20) mapped; forward and reverse mapping complete.
- Plan: 12 phases, 84 tasks, 102/102 TC ids in `coverage`, 36/36 distinct ACs covered in Phases 1–10 before the Phase 12 closure net. No TC lacks a `full`/`completes` claim.
- Every test path named in a phase gate exists in the tree or is declared in a phase scope (56 gate paths checked); every path-like token in the tasks exists or is covered by a declared scope (108 checked). The failures below are files the tasks *require but never name*, not dangling gate paths.
- Delivered substrate assertions re-verified: `COMMIT_TEMPERATURE = 0.1` and the ordered model-template transport; `CommitGitPort = {readTree, stage, commit, head, resetTo, commitExists}` with `createGitCommitSeam` as the only production implementor; `readEvidence`/`classifyCommitDelta` read transitions + commit telemetry only; `PRODUCTION_CATALOG` has exactly six branches and no state-dir key; `stateDirectoryFor` derives `<home>/<brand.stateDirectoryName>` with no CLI flag; blocker answers carry the literal `applied: false` and the three-value `laneResume` set; `tests/behaviour/config-schema.test.ts` asserts the exact six-key catalog; `tests/golden/lanes-watch-refusal.test.ts` still asserts the exit-1 refusal; `.changeset/config.json` fixes the five packages.

## Facet Summary

- spec_completeness: **FAIL** — the commit-effect identity is not derivable pre-commit (N-01); the systemd state-directory scope is asserted but not mechanized, and the delivered CLI has no way to select it (N-03); the lock-token exemption leaves the start envelope/golden out (N-05).
- ac_quality: **FAIL** — AC-F10-2's identity cannot be constructed from the production mechanism (N-01); AC-F15-1's "explicit state-directory scope" is not implementable against the CLI surface (N-03); AC-F4-4 vs the `instance.fence` envelope (N-05); AC-F6-2's control `id` scope is ambiguous (N-08); AC-F17-1 conflates runtime injection with an import edge (N-11); AC-F3-1's "applied exactly once" has no observable (N-12).
- plan_coverage: **FAIL** — two files required by the tasks are declared in no phase (N-04); `feature-commit-primitive.md` is absent from the doc tasks (N-06); four "full" rows claim a phase gate that omits one of their target suites (N-09); the `config-*.test.ts` wildcard target remains (N-10).
- test_traceability: **PASS** — 102/102 TCs exist, 36/36 ACs and 18/18 NFRs traced, EVT/DM and seeds mapped. The defects are oracle correctness and file naming, tracked under the other facets.
- cross_artifact_consistency: **FAIL** — N-01, N-02, N-05, N-08, N-11.
- decision_capture: **FAIL** — the ticket's binding "SHA idempotency" pin is replaced while the spec still claims DEC-1..DEC-4 reproduce the ticket's binding decisions, and no system decision record captures the commit/effect contract M1-S9 will inherit (N-07).
- system_spec_consistency: **FAIL** — the spec's own assumption that the commit message is deterministic contradicts the delivered primitive's model path (N-01); the daemon-side commit re-apply contradicts F-9/TC-LANE-002 (N-02); the lock-token exemption contradicts NFR-12/§21 (N-05); the commit-primitive spec is not reconciled (N-06).
- plan_doc_update_coverage: **FAIL** — `doc/spec/features/feature-commit-primitive.md` is affected but absent from §16.1 and Phase 11 (N-06).
- plan_code_area_coverage: **FAIL** — `packages/adapters/src/git/commit.ts` and `tests/behaviour/config-schema.test.ts` are required by Phase 1/7 work but declared nowhere (N-04); the merge-absence boundary rule omits `packages/adapters/src/daemon/` (N-11).
- dod_defined: **PASS** — 36 ACs, 18 NFRs, the §4.1 metrics, the seven seeded scenarios, and the Phase 11/12 PR-ready checklist are present and enumerable; the AC-specific testability defects above are recorded under `ac_quality`/`spec_completeness`, not as a missing DoD.

## Findings

Ordered by severity. `B` = blocking (must be fixed in an artifact phase before delivery starts); `N` = non-blocking (fix in the owning artifact phase before that phase, or accept as a recorded residual).

### N-01 [critical][B] system_spec_consistency / cross_artifact_consistency / ac_quality — `chg-GH-238-spec.md` F-10 (line 149), AC-F10-2 (line 579), §13 assumption (line 456), §8.4 git-port bullet (line 378); `chg-GH-238-test-plan.md` TC-EFFECT-005 (line 1885), TC-RECON-007 (line 1553); `chg-GH-238-plan.yaml` tasks 7.1–7.6 (lines 1206–1265). Delivered: `packages/core/src/domain/commit-act.ts` `resolveMessage` (lines 148–240), `packages/core/src/domain/commit-transport.ts` `selectCommitTransport`, `packages/core/src/contracts/commit.ts:85`, `doc/spec/features/feature-commit-primitive.md` lines 23, 72.

Gap (this is R-02, still unresolved): the spec now rests commit crash safety on a "deterministic expected commit identity derived from the same message the commit primitive will create (expected subject plus body fingerprint)" and §13 asserts "the commit message the primitive will create is deterministic from the same inputs the wrapper records in the outbox intent". That is true only on the template path. The delivered primitive resolves the message through an ordered transport seam and, when a route is available, uses one schema-constrained **model** call at temperature `0.1` (`COMMIT_TEMPERATURE`) with one retry and sanitization; the resulting subject/body cannot be known before `runCommitAct` returns. The artifacts never pin a template-only composition or a message-independent identity, so a coder can either (a) force the template (an unstated change that disables model commit messages for every daemon/lane commit) or (b) record an identity the landed model message will not match, in which case the re-drive re-applies and creates a duplicate commit — exactly the failure R-02 was meant to close — while the specified negative control (which only removes the log query) still passes. The expected subject also falls back to `topPath` (the first staged path) when `planSummary` is absent, which depends on the staging plan the wrapper does not compute; the artifacts do not say how that value is obtained pre-commit. TC-EFFECT-005/TC-RECON-007 supply the expected identity by fixture, so the production derivation is never exercised.

Suggested remediation target phase: **specification** (with **test_planning**, and **delivery_planning** if the port/primitive placement changes)
Suggested fix: pick and pin one identity: (a) the wrapper composes the commit port with no inference route (template-only), the spec states it, and a test asserts zero model calls for effect commits; or (b) record a message-independent identity (`baselineHead` + sorted staged path set + change ref + phase) and match `git log --raw/--name-only`; or (c) add an explicit deterministic pre-commit message-resolution step to the primitive (a declared primitive change). In all cases derive the identity in the TCs from the production mechanism, and add a negative control that breaks the **derivation** (not only the query).

### N-02 [major][B] cross_artifact_consistency / system_spec_consistency — `chg-GH-238-spec.md` F-9 (line 148) vs F-10 (line 149), AC-F8-4 (line 575), AC-F10-2 (line 579), Appendix I commit rule (line 834); `chg-GH-238-plan.yaml` tasks 7.3 (line 1228) and 7.4 (line 1239), Phase 7 scope (lines 1170–1195); `chg-GH-238-test-plan.md` TC-EFFECT-005 step 7 (line 1885), TC-RECON-007 step 3 (line 1553), TC-LANE-002 step 3 (line 1660). Delivered: `packages/cli/src/commands/phase.ts` (lines 372–420, 478–535) and `packages/cli/src/edge.ts` `createPhaseCommitExtension.readEvidence` (line 546).

Gap: two related contradictions in the R-02 mechanism. (i) **Effect ownership.** F-9 says the daemon process performs no delivery work and "does not read repository code, run a phase, write a commit, or evaluate a gate"; AC-F9-1 and TC-LANE-002 step 3 repeat it. Plan task 7.3 instead gives reconciliation the commit re-apply ("no match re-applies exactly once"), task 7.4 places the commit-effect adapter in `packages/adapters/src/daemon/`, and TC-EFFECT-005 step 7 runs the re-apply in `daemon-effects.test.ts`. Either a daemon-initiated path writes a commit (breaking F-9, AC-F9-1, TC-LANE-002 and the import boundary) or the AC's "exactly one re-apply" is never implemented; the spec never names the effect owner. (ii) **Transition recovery.** Recording the effect `applied` with the landed SHA does not restore the phase transition's commit binding. `readEvidence`/`classifyCommitDelta` read only transitions and `commit.telemetry`; a new outbox receipt is invisible to `phase complete`, and no Phase 7 task appends the transition (`packages/cli/src/commands/phase.ts` is declared in no phase). TC-RECON-007 step 3 asserts "the ledger transition binds that SHA exactly once and no commit binding is lost", but nothing in the artifacts produces that record, so the delivered convergence contract would still classify the phase as record-only and lose the binding.

Suggested remediation target phase: **specification** (with **test_planning** and **delivery_planning**)
Suggested fix: name the effect owner explicitly — the lane/one-shot process applies and re-applies; the daemon only queries and records the resolved state (or leaves a durable re-drive request). Define and declare the transition-recovery path (the receipt feeds commit evidence into the phase delta, or the owning process re-runs `phase complete` with the discovered SHA). Add the touched files (`packages/cli/src/commands/phase.ts`, whichever delta/evidence contract changes) to a phase scope, and align F-9/F-10/Appendix I/AC-F8-4/AC-F10-2/TC-LANE-002/TC-EFFECT-005/TC-RECON-007.

### N-03 [major][B] spec_completeness / system_spec_consistency — `chg-GH-238-spec.md` F-15 (line 154), AC-F15-1 (line 588), OQ-4 (line 487), Appendix C install envelope (line 714); `chg-GH-238-plan.yaml` task 1.6 (`resolveDaemonSettings(..., {stateDirectory})`), tasks 10.1/10.3 (lines 1556–1580); `chg-GH-238-test-plan.md` TC-INSTALL-001 step 2 (line 2390), TC-INSTALL-007 (line 2541). Delivered: `packages/cli/src/edge.ts` `stateDirectoryFor` (lines 1076–1082), `packages/core/src/config/catalog.ts` `PRODUCTION_CATALOG` (lines 339–360).

Gap: the ticket requires "an installed login unit starts the daemon against the right state-dir scope", and AC-F15-1/TC-INSTALL-001 require the unit to carry "an explicit state-directory scope". The delivered CLI has no `--state-dir` flag, no state-dir configuration key, and no declared environment variable; the state directory is derived as `<HOME>/<brand.stateDirectoryName>` (or supplied by the injected composition option). A unit can therefore only set `HOME` (ambient, and the systemd user default) or invent an undeclared flag/env contract. The scope is asserted as a fact but has no mechanism, so a coder must either add an undeclared contract or leave the assertion vacuous. OQ-4's "the contract pins the scope" is not true.

Suggested remediation target phase: **specification** (with **test_planning** and **delivery_planning**)
Suggested fix: pin the mechanism — an additive `daemon start --state-dir <path>` flag, or a declared `<PREFIX>_STATE_DIR` environment variable read by the resolver — add it to F-1/Appendix C/Appendix E (or as a documented process flag), and assert it in TC-INSTALL-001/007 with a two-state-dir positive and a wrong-scope negative. Alternatively drop "explicit" and record the default-home-only scope as an accepted narrowing with a PM/human acknowledgement.

### N-04 [major][B] plan_code_area_coverage / plan_coverage — `chg-GH-238-plan.yaml` Phase 7 scope (lines 1170–1195), task 7.4 (line 1239), task 1.6, Phase 1 scope; `chg-GH-238-test-plan.md` §8.3 ("no plan-scope gap remains", line 3219) and T-RSK-9 (line 3186). Delivered: `packages/adapters/src/git/commit.ts:153` (`createGitCommitSeam`, the only production `CommitGitPort` implementor; listed at `tests/structure/content-inventory.test.ts:1482`), `tests/behaviour/config-schema.test.ts:24`.

Gap: two files are required by the plan but declared in no phase. (a) Phase 7 extends `CommitGitPort` in `packages/core/src/contracts/commit.ts` (declared, but with role `consumer`) with the additive `logSince` read; the only production implementor `packages/adapters/src/git/commit.ts` is declared nowhere, so a coder must edit an undeclared production file to make the port compile and the read real. (b) Phase 1 adds the `daemon` and `poll` branches to `PRODUCTION_CATALOG`; `tests/behaviour/config-schema.test.ts` asserts the exact six-key catalog and is declared nowhere, so it fails from Phase 1 and only surfaces at Phase 11's `pnpm check`, forcing another undeclared edit. This is the R-11 class recurring on files the remediation introduced; the test plan's "no plan-scope gap remains" and T-RSK-9 are false.

Suggested remediation target phase: **delivery_planning**
Suggested fix: add `packages/adapters/src/git/commit.ts` to Phase 7 scope with role `producer` (and any contract/port file whose shape changes); add `tests/behaviour/config-schema.test.ts` (and re-audit the other existing config behaviour suites that enumerate catalog keys) to Phase 1 scope and gate; update OQ-T8/T-RSK-9 after the audit.

### N-05 [major][B] cross_artifact_consistency / system_spec_consistency / ac_quality — `chg-GH-238-spec.md` Appendix C start envelope (line 711), NFR-12 (line 408), §21 (line 618), glossary (line 643), AC-F4-4 (line 566); `chg-GH-238-test-plan.md` TC-WIRE-006 step 2 (line 1013), TC-LIFE-001 step 1 (line 369), TC-LIFE-008 step 6 (line 546); `chg-GH-238-plan.yaml` task 5.1.

Gap: Appendix C requires the `daemon start` envelope's `instance.fence` to be "the daemon lock token", and AC-F1-1 requires the `instance` envelope. But NFR-12/§21/glossary permit the lock token "solely in the three control-frame payloads and durable lock/instance records", and TC-WIRE-006 step 2 asserts the token is absent from every status payload and golden. A command envelope on stdout is neither a control payload nor a durable record; a stored golden built from the start envelope would contain the token, and TC-LIFE-008 step 6 requires byte-identical machine output across two runs, which a random token cannot satisfy without an unstated normalization. The R-03 lock-token exemption therefore has a hole at exactly the surface the start golden and the status test exercise, and the zero-tolerance NFR-12 is unsatisfiable as written.

Suggested remediation target phase: **specification** (with **test_planning**)
Suggested fix: either (a) remove `fence` from the start/status envelope projections (keep it durable-only), or (b) add the command envelopes to the NFR-12 permitted set and declare a `<lock-token>` golden placeholder (mirroring the `<state-dir>/daemon.sock` rule), then align AC-F1-1/AC-F4-4/NFR-12/§21/Appendix C/TC-WIRE-006/TC-LIFE-001/TC-LIFE-008.

### N-06 [major][N] plan_doc_update_coverage / system_spec_consistency — `chg-GH-238-spec.md` §16.1 (lines 526–543); `chg-GH-238-plan.yaml` Phase 11 scope (lines 1628–1655); `chg-GH-238-test-plan.md` §2 (line 90); delivered `doc/spec/features/feature-commit-primitive.md` lines 9, 23, 72, 121, 125.

Gap: the change now adds a pre-commit outbox intent, a bounded `logSince(baselineHead)` read over the git commit port, and a recovery path at the commit crash window. `feature-commit-primitive.md` is a current-truth spec whose convergence section ("the record-bound SHA is primary", the four-state delta) is materially incomplete for that window and whose contract list omits the additive port read, yet neither §16.1's doc-impact table nor Phase 11 lists it. No delivery task reconciles it, so the phase-7 doc duty is incomplete for a spec the change directly affects.

Suggested remediation target phase: **specification** (with **delivery_planning**)
Suggested fix: add a `feature-commit-primitive.md` row to §16.1 and Phase 11 with the required reconciliation (effect-protocol cross-reference, the additive read, the crash-window recovery), or state explicitly why the current truth remains accurate and record that decision.

### N-07 [major][N] decision_capture — `chg-GH-238-spec.md` DEC-4 (line 498), §24 authoring guideline (line 868), Appendix G ticket map (line 781); `chg-GH-238-pm-notes.yaml` R-02 decision (line 31); ticket "Pinned decisions (binding; do not re-derive)".

Gap: the ticket's binding pin says commits are "additionally protected structurally by M1-S14 atomicity and SHA idempotency". DEC-4 was rewritten to the outbox + `logSince` mechanism and Appendix G paraphrases the ticket AC in the new terms, while the authoring guideline still claims "DEC-1..DEC-4 reproduce the ticket's binding decisions in intent". The divergence is captured only as a change-scoped PM note; the PM note does not state that it supersedes a binding ticket pin, and there is no `doc/decisions/**` record for a commit-crash-safety contract that M1-S9 (dispatch/lanes) will inherit and that changes the external-effect protocol. This is a system/precedent decision by the routing rules, not a change-only clarification.

Suggested remediation target phase: **specification** (decision record via `@decision-advisor`)
Suggested fix: have `@decision-advisor` author a TDR/ADR for the effect/commit crash-safety contract (identity, owner, recovery, additive port read); record the ticket-pin supersession explicitly in `pm-notes`; correct the §24 guideline and Appendix G so the divergence is honest.

### N-08 [minor][N] cross_artifact_consistency / ac_quality — `chg-GH-238-spec.md` F-6 (line 144), AC-F6-2 (line 570), DM-6 (line 356); `chg-GH-238-plan.yaml` task 3.3; `chg-GH-238-test-plan.md` TC-CONC-005 (line 1319)

Gap: F-6 says `id` correlates "within one connection, never across connections", but the control at-most-once rule is keyed on "frame `id` plus the daemon lock token" with no connection identity, and TC-CONC-005 mixes a same-connection replay with a precondition of two connections carrying the same id. A global dedupe would answer a second client's genuinely new `drain`/`stop`/`takeover` with a false "already applied"; a per-connection dedupe would let a cross-connection duplicate act twice. The key scope is unpinned, so the TC passes or fails by interpretation.

Suggested remediation target phase: **specification** (with **test_planning**)
Suggested fix: key control application on (connection identity, `id`, lock token) — or declare `id` globally unique for control frames — and split TC-CONC-005's same-connection replay from the cross-connection collision with the expected outcome for each.

### N-09 [minor][N] plan_coverage / gate hygiene — `chg-GH-238-plan.yaml` Phase 3 coverage TC-WIRE-007 vs Phase 3 gate; Phase 5 TC-POLL-004 vs Phase 5 gate; Phase 9 TC-STATE-001 vs Phase 9 gate; Phase 10 TC-INSTALL-005 vs Phase 10 gate

Gap: four rows are marked "full" in a phase whose gate does not run one of the TC's declared target suites (`tests/structure/daemon-contract.test.ts` absent from Phase 3; `tests/structure/daemon-imports.test.ts` absent from Phase 5; `tests/behaviour/daemon-state-mediation.test.ts` absent from Phase 9; `tests/behaviour/daemon-degradation.test.ts` absent from Phase 10). Each suite runs in another phase, so the surface is not missing, but the "full" claim is not verifiable at its claiming gate and a regression in the claiming phase would not be caught there.

Suggested remediation target phase: **delivery_planning**
Suggested fix: add the named suite to the claiming phase's gate, or mark the row partial with the completing phase.

### N-10 [minor][N] test_traceability / plan_coverage — `chg-GH-238-test-plan.md` TC-VOCAB-003 (line 2627), TC-TRANSPORT-003 (line 1149), TC-POLL-003 (line 2349), TC-CONFIG-001 (line 2957); automation rows (lines 3046, 3093, 3104, 3117); T-RSK-9 (line 3186); `chg-GH-238-plan.yaml` Phase 1

Gap: these Target Layers name the wildcard `tests/behaviour/config-*.test.ts`; no phase declares a concrete config behaviour test (the existing files that match are declared nowhere), and the automation command columns run no config file. T-RSK-9's "every TC Target Layer names a plan-declared file" is false. This is the remaining residue of R-13.

Suggested remediation target phase: **test_planning** (with **delivery_planning**)
Suggested fix: name the concrete file(s) the phase will create or update (or the existing `tests/behaviour/config-*.test.ts` members), declare them in the phase scope and gate, and align the automation rows.

### N-11 [minor][N] ac_quality / system_spec_consistency / cross_artifact_consistency — `chg-GH-238-spec.md` AC-F17-1 (line 591), DM-13 (line 363), §21 (line 613); `chg-GH-238-plan.yaml` task 1.7 (`daemon-merge-absence` paths), task 5.1; `chg-GH-238-test-plan.md` TC-MERGEABS-002 step 4 (line 2796), AC-F1-1 row (line 100), TC-LIFE-003 step 1 (line 439), DM-8 row (line 199)

Gap: three residual inconsistencies. (a) AC-F17-1 says "an injected merge executor ... trips the boundary assertion"; an injected test fake adds no import edge, so the dependency-cruiser rule cannot fail — the claim conflates runtime injection with an import violation. (b) The boundary rule's `from` paths are `^packages/core/src/(app|domain)/daemon` and `^packages/cli/src/daemon`; `^packages/adapters/src/daemon/` is not covered, so the "no daemon path imports merge" proof excludes the daemon adapters (which Phase 6/7 populate). (c) The test plan's AC-F1-1 row and TC-LIFE-003 still say `mergeCodePath: "absent"` instead of the closed set, and the DM-8 row says "on every frame" although AC-F4-5/TC-WIRE-007 scope it to v1.

Suggested remediation target phase: **specification** (with **test_planning** and **delivery_planning**)
Suggested fix: restate AC-F17-1 as "an injected executor yields `present`; a source-level import of merge fails the boundary"; add `^packages/adapters/src/daemon/` to the rule; fix the stale rows.

### N-12 [minor][N] ac_quality / test correctness — `chg-GH-238-test-plan.md` TC-STATE-003 step 5 (line 775); `chg-GH-238-spec.md` DEC-16 (line 510), glossary "Applied (blocker answer)" (line 672); delivered `packages/core/src/contracts/blockers.ts:227,290`

Gap: TC-STATE-003 step 5 asserts "the lane-holding answer is applied exactly once", but the delivered answer record's `applied` is the literal type `false` and the daemon never rewrites it, so the boundary application has no named observable. The test cannot distinguish "applied once" from "not applied"; only the injected executor could, and the TC does not assert an executor call or a lane-record state change.

Suggested remediation target phase: **test_planning** (with **specification** if the observable becomes a contract)
Suggested fix: assert the exact observable (one executor resume/attach call for the answer and zero for the no-lane case, plus the lane-record/`resumeIntent` state transition) and state it in DEC-16/Appendix D.

### N-13 [minor][N] test-plan formatting — `chg-GH-238-test-plan.md` §4 (line 237)

Gap: the "Behaviour — lock concurrency" row is glued onto the end of the "Behaviour — lifecycle" row (`... | bun test ... || Behaviour — lock concurrency | ...`), so the table has one fewer row and the lock-concurrency suite loses its own level and execution cell. Introduced by the remediation.

Suggested remediation target phase: **test_planning**
Suggested fix: restore the newline and leading `|`.

### N-14 [nit][N] spec/test-plan wording + version hygiene — `chg-GH-238-spec.md` F-3 (line 142)/DM-17 (line 367), `chg-GH-238-plan.yaml` header (line 12), `chg-GH-238-test-plan.md` §7 automation rows

Gap: (a) "client-supplied idempotency key" is defined as the immutable store-scoped record identity for the delivered queue/dependency/blocker kinds — that identity is derived from the record's target, not supplied by the client, so a coder may look for a field that does not exist. (b) The plan header still cites the test plan as "v1.1" while the test-plan front matter and revision log are v1.2. (c) The R-10 fix updates `tests/golden/lanes-watch-refusal.test.ts` in place to assert acceptance while its name and the sibling `watch-refusal-absent.test.ts` now overlap.

Suggested remediation target phase: **specification** (with **test_planning** and **delivery_planning**)
Suggested fix: reword to "the record identity is the idempotency key (the client supplies the intent, not a separate key)"; update the plan header version; rename or clearly split the two watch goldens.

## Previous Finding Status

| ID | Status | Evidence |
|---|---|---|
| R-01 (critical, cross-artifact/AC — mutating wire request invented) | **Resolved** | F-6 (line 144) now states at-most-once is a state-path property, the closed v1 vocabulary has no mutating wire class, and `queue add` has no relayed wire form or external effect. AC-F6-2 (line 570) restated for same-key/different-key state-path application plus a duplicated control frame. DEC-14, DM-17 added; TC-CONC-002/003 rewritten; TC-CONC-005 added. Residuals: N-08 (control `id` scope), N-14a (wording). |
| R-02 (critical, commit crash safety) | **Not resolved** | See N-01/N-02. The mechanism class is right (durable pre-commit intent + bounded `logSince` + identity match), and the old "SHA idempotency" overclaim is gone, but the identity is not derivable from the delivered primitive (model message), the effect owner contradicts F-9/TC-LANE-002, and recovery does not restore the transition binding. TC-EFFECT-005/TC-RECON-007 still supply the outcome by fixture. |
| R-03 (major, lock token vs secrets) | **Partially resolved** | F-4/AC-F4-4/NFR-12/§21/Appendix B/glossary/TC-WIRE-006 now classify the lock token as a same-user ownership capability and exempt it in the three control payloads and durable records. The start-envelope `instance.fence` and its golden are outside the permitted set (N-05). |
| R-04 (major, v0/v1 + wire types + additive claim) | **Resolved** | AC-F4-1 (line 563) states v1 carries the principal and v0 omits it; EVT-8 (line 342) now names exactly Appendix B's wire set and classifies `query` as a class; AC-F16-1 (line 590) is additive-only; TC-WIRE-001/002 aligned. Residual: N-11c (DM-8 row says "on every frame"). |
| R-05 (major, `outbox.effect` principal) | **Resolved** | EVT-7, Appendix D, DM-10, plan tasks 1.4/7.2, and test-plan TC-VOCAB-004 step 2 all add `callerPrincipal?` to `outbox.effect`. |
| R-06 (major, blocker-answer application) | **Resolved** | OQ-5 is resolved and DEC-16 pins the durable/visible answer, the `resumeIntent` on the lane record, and boundary application only when a lane exists, with full resume deferred to M1-S9. AC-F3-1, plan 4.6/6.2, `resumeIntent` in DM-3/EVT-3, and TC-STATE-003 step 3/4 are consistent. Residual: N-12 (no observable for "applied exactly once"). |
| R-07 (major, systemd unit form) | **Partially resolved** | The unit form is now pinned (`ExecStart=<binary> daemon start --foreground`, `Type=simple`, `Restart=on-failure`), TC-INSTALL-001/007 assert it with a spawn-and-return negative control, and no real systemd is invoked. The state-directory scope binding mechanism is still missing (N-03). |
| R-08 (major, TC-META-001 unmapped) | **Resolved** | Phase 11 coverage carries TC-META-001, the Phase 11 folder list scopes `tests/fixtures/daemon/mutants`, and the gate runs `tests/checks/daemon-mutants.test.ts`; counts are 102/102. |
| R-09 (major, premature "full" flags) | **Resolved** | VOCAB-004/008 are structure halves in Phase 1 and complete in Phase 4; CONC-002/003 declare no Phase 3 assertion and complete in Phase 4; RECON-006 completes in Phase 6; LIFE-005 and DEGRADE-003 complete in Phase 9. Residual: N-09 (four other full rows vs their gate). |
| R-10 (major, watch-refusal golden out of scope) | **Resolved** | Phase 9 declares `tests/golden/lanes-watch-refusal.test.ts`, `tests/fixtures/queue/golden/lanes-watch-refusal.json`, and the fixture folder; the gate runs the golden; task 9.4 states the update-in-place behaviour. Residual: N-14c (naming/overlap). |
| R-11 (major, undeclared Phase 1 edits) | **Resolved** | Phase 1 scope now includes `packages/core/src/app/queue.ts` and `packages/core/src/state/blockers.ts`. Recurred on two other files: N-04. |
| R-12 (major, gate hygiene) | **Resolved** | Task 7.6 creates `tests/behaviour/commit-act.test.ts`; the Phase 6 gate runs `tests/behaviour/blockers-publish.test.ts`. |
| R-13 (minor, plan/test-plan misalignment + phantom Target Layers) | **Partially resolved** | The front matter links the plan; §7/§7.1/§7.2/§8.1 are reconciled; most Target Layers match plan files. The `tests/behaviour/config-*.test.ts` wildcard target remains and contradicts T-RSK-9 (N-10). |
| R-14 (minor, `mergeCodePath` complement) | **Resolved** | DM-13 and AC-F17-1 define the closed set `{"absent","present"}`; TC-MERGEABS-002 asserts both values. Residuals: N-11a/b/c. |
| R-15 (minor, cross-user identity + exit hedge) | **Resolved** | `state.permission.denied` at exit 1 is pinned in F-5/AC-F5-1/Appendix B/F/§21; TC-TRANSPORT-002 asserts the identity and TC-TRANSPORT-003 pins `config.value.invalid` at exit 1. |
| R-16 (minor, socket path vs golden) | **Resolved** | §20 now permits start/status output plus the normalized `<state-dir>/daemon.sock` golden placeholder; TC-LIFE-001 step 4, TC-TRANSPORT-002 step 5, TC-PRIVACY-001 step 4, and TC-INSTALL-001 step 5 are aligned. |
| R-17 (minor, scope identifier) | **Resolved** | DM-1/§20/glossary pin the SHA-256 first-16-hex digest and its recomputable mapping; plan tasks 2.1/2.3 and TC-PRIVACY-001 steps 2–4 assert it. |
| R-18 (nit, takeover Given + seed count) | **Resolved** | AC-F2-2 splits stale takeover, explicit live takeover (`daemon.takeover-refused`), and live `daemon start` (`daemon.already-running`); TC-LOCK-003's three cases match; all three artifacts say seven seeded ids. |
| R-19 (minor, test doubles in a published subpath) | **Resolved** | The in-memory pair moves to `tests/fixtures/daemon/transport/` (declared Phase 3), the production subpath keeps only bindings, and plan task 3.5 asserts no test double is exported. |

## Reopen Targets

| Artifact phase | Findings | Required? |
|---|---|---|
| `specification` | N-01, N-02, N-03, N-05, N-07, N-11, N-14 | Yes — blocking contracts/ACs (N-01..N-03, N-05) |
| `test_planning` | N-01, N-02, N-08, N-10, N-11, N-12, N-13, N-14 | Yes — assertion/oracle and file-name corrections tied to the spec fixes |
| `delivery_planning` | N-02, N-04, N-06, N-09, N-10 | Yes — scope, gate, and doc-coverage corrections |
| decision record (`doc/decisions/**`) | N-07 | Yes — via `@decision-advisor`, orchestrated by `@pm` |
| `delivery` | none | Not reopened by this gate. |

`delivery` is not a valid remediation target and is not reopened. Re-run this gate after the authors revise the artifacts. This is iteration 2; one more iteration is available before the ~3-iteration cap. If the same blocking gaps persist after the next revision, escalate to the human rather than looping.

## Decision Routing

- **N-01/N-02 (commit-effect identity, ownership, and recovery):** `system` scope. This changes the external-effect protocol and the commit-crash-safety contract that M1-S9 will inherit, and it supersedes a binding ticket pin. Route a decision record to `@decision-advisor` (`needs_human_input` is not raised now because the PM has already decided the mechanism class and the remaining choices are technical). If the PM instead chooses to narrow the ticket clause and accept the convergence residual, record an explicit PM/human acknowledgement in `chg-GH-238-pm-notes.yaml` and set `Pause Required: yes`.
- **N-03 (state-directory scope binding):** `change` scope, but adding a `--state-dir` flag or an environment-variable contract changes the command/config surface; the PM should approve the exact shape and record it in `pm-notes`.
- **N-05 (lock token in the start envelope):** `change` scope; either narrow the envelope or extend the NFR-12 exemption and add the golden placeholder.
- **N-04, N-06, N-09, N-10:** `change` scope, delivery planning/test planning only.
- **N-07:** explicitly a `system`/precedent-setting decision; `@pm` should delegate the record to `@decision-advisor`.
- **N-08, N-11, N-12, N-13, N-14:** `change` scope; small contract/oracle/wording corrections.
- No silent skip or override path is used; the change is behavioral and contract-bearing.

## Verification Notes (not findings)

- **Plan validator**: `validatePlan` + the real YAML-parser contract returns `verdict: "valid"`, `readyForDevelopment: true`, `totalErrors: 0`, `truncated: false`, `schemaVersion: "delivery.plan.v1"`, `tier: "full"`; all 12 phases echo `kind: delivery`, and the weight classes match the header. The validator checks schema/shape, not coverage; the coverage defects above are outside its remit.
- **Counts**: spec 36 ACs, 18 NFRs, 17 capabilities, 9 events (EVT-1..9), 17 data-model elements (DM-1..17), 17 decisions (DEC-1..17), 6 open questions (OQ-5/OQ-6 resolved, OQ-1..OQ-4 open/deferred). Test plan 102 TCs (index = details = automation), 36/36 AC rows, 18/18 NFR rows, 7 seeded ids. Plan 12 phases, 84 tasks, 102/102 TC ids, 36/36 ACs covered in Phases 1–10; Phase 12 carries the closure net. `TC-LEASE-002` is GH-237's inherited proof, not a local TC (test plan line 3155).
- **Gate paths**: 56 distinct test/script paths named by phase gates exist or are declared in a phase scope; 108 distinct path-like tokens in task text exist or are covered by a declared file/folder. The missing files (N-04) are never named in any task, so a path-existence scan cannot see them; they were found by reading the delivered port implementors and the exact-set assertions.
- **Delivered-code facts verified**: `BOARD_COLLECTOR_IDS = ["tracker","lanes"]`; `QUEUE_LANE_STATES` includes `idle-with-reason`; `lane.liveness-interval`/`lane.restart-budget` defaults; `evaluateRestartBudget`/`appendEconomicsRestartEvent`/`releaseQueueLane` exist; `watchRefusal` exists in both `queue.ts` and `lanes.ts`; `tests/golden/lanes-watch-refusal.test.ts` asserts exit 1 with `fallback.invocation`; `tests/fixtures/queue/golden/lanes-watch-refusal.json` exists; blockers `laneResume` is a three-value set and answers carry the literal `applied: false`; `PRODUCTION_CATALOG` has exactly six branches and no state-dir key; `stateDirectoryFor` derives `<home>/<brand.stateDirectoryName>`; `CommitGitPort` has six members and `createGitCommitSeam` is the only production implementor; `COMMIT_TEMPERATURE = 0.1` and the model transport is the primary path; `phase.ts` `readEvidence` reads transitions + commit telemetry only and treats `neither`/`commit-without-record` exactly as iteration 1 described.
- **No-merge proof**: Phase 1 adds a `daemon-merge-absence` dependency-cruiser rule with a failing fixture and registry entry; the rule's `from` set omits `packages/adapters/src/daemon/` (N-11b). The daemon composition's merge-absence status is a computed closed set (N-11a on the AC wording).
- **Scope leak check**: no `dispatch`/handover, dual-run evidence, full resume, remote transport, `status --watch`, fleet coordination, or merge execution is added; all are explicitly NG-1..NG-6/NG-10 or M1-S9/M4-S6. No tracker/VCS write adapter ships. No secret or credential-shaped literal was introduced by this verdict.
- **Doc-distribution / changeset**: Phase 11 lists a single five-package lockstep changeset, the new resident-daemon spec, ten neighbour specs, the command registry, the man page, the glossary, the architecture overview, `doc/00-index.md`, and the doc-distribution guard; `feature-commit-primitive.md` is the one affected spec missing (N-06).
- **No override record** was needed or used; the change is behavioral and contract-bearing.

## Accepted Non-Blocking Residuals

These are declared, bounded, and still accepted; they are not findings (they carry forward from iteration 1 unless noted):

- **Algorithmic, not OS-level, concurrency** (GAP-T1): 100-start and 100-subscriber proofs are deterministic interleavings; one bounded real-child smoke covers start/stop only. Accepted for hermeticity (NFR-7).
- **Environment-sensitive latency** (GAP-T3): NFR-6's 50 ms p99 is measured on the reference CI class; the structural properties (bounded buffer, one degraded event, continued service) are asserted independently.
- **Real cross-user kernel refusal and real systemd/launchd/Windows managers are not exercised** (GAP-T2, GAP-T4): the permission policy, unit content, and adapter outcomes are asserted through injected seams; actual OS enforcement is operations verification.
- **No production tracker/VCS write adapter** (RSK-9): the effect protocol is proven over injected adapters; the commit half is the only production adapter and its crash window is subject to N-01/N-02.
- **`daemon install` linger failure reuses `daemon.supervisor-unsupported`** (OQ-T1): tested as written; the semantic conflation is flagged to the spec owner.
- **Heartbeat `laneCounts` uses the separate `{delivering, idle, parked, failed}` set** (S-6): declared as a separate closed set; no vocabulary redefinition.
- **`daemon.preemption.withdrawn` is declared but never written** (S-4): accepted as a read-only declared state with no cancellation trigger.
- **`dispatch <ref>` and SC-M1-17b remain M1-S9/GH-237** (GAP-T6, GAP-T7): inherited with the PM acknowledgement; not re-proven here.
- **Deferred scope is explicit**: M1-S9 dispatch/handover, remote transport (M4-S6), `status --watch`, launchd/Windows adapters, and lane-scoped authorization are NG-1..NG-6/NG-10 with named owners; not leakage.

The new non-blocking findings N-06..N-14 are **not** accepted residuals; they must still be fixed in their owning artifact phases (or separately recorded as accepted before that phase).
