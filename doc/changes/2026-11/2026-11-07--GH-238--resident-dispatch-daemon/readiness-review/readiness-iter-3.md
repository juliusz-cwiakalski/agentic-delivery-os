# Readiness Review Iteration 3

Verdict: **READY_WITH_RISKS**
Work Item: GH-238 (M1-S18: Resident dispatch daemon)
Date: 2026-11-07
Pause Required: no

`READY` means "all facets pass and no blocking finding remains". No blocking finding
remains, so delivery may start; `_WITH_RISKS` records (a) one governance risk that the
owner must ratify and (b) five minor, non-blocking defects that must be closed in their
owning artifact phase (or recorded as accepted) before the phase that depends on them.

## Gate Summary

- Artifact set reviewed: `chg-GH-238-spec.md` v1.2 (17 capabilities, 36 ACs,
  18 NFRs, 9 events, DM-1..DM-18, DEC-1..DEC-19), `chg-GH-238-test-plan.md` v1.3
  (102 local TCs), `chg-GH-238-plan.yaml` (`delivery.plan.v1`, 12 phases /
  85 tasks, validator `valid` + `readyForDevelopment: true`), `chg-GH-238-pm-notes.yaml`,
  `doc/decisions/TDR-0013-commit-effect-crash-safety-message-independent-identity.md`
  (committed in `5620f463`, indexed at `doc/decisions/00-index.md:39`), ticket
  `juliusz-cwiakalski/agentic-delivery-os#238` (read directly), and the delivered
  substrate the change builds on (`commit-act.ts`, `commit-converge.ts`,
  `commit-transport.ts`, `contracts/commit.ts`, `contracts/registry.ts`,
  `cli/edge.ts`, `cli/commands/phase.ts`, `config/catalog.ts`,
  `branding/index.ts`, `adapters/src/git/commit.ts`, `.dependency-cruiser.cjs`,
  `scripts/checks/ambient-globals.ts`).
- Iteration-2 findings: **14/14 resolved** (N-01..N-05 blocking, all resolved; N-06..N-14
  non-blocking, all resolved or resolved-with-residual).
- Iteration-1 findings: **19/19 still resolved** — no regression found (R-01..R-19
  re-checked individually; see the status table).
- New findings: **8** — 0 critical, 0 major, **5 minor**, **3 nit**. **0 blocking.**
- Blocking total: **0**.
- Reopen targets: **none required for delivery**. The five minor new findings are
  change-scoped and can be closed inside the owning artifact before its dependent
  phase: `specification` (NF-1, NF-2, NF-3 partially), `test_planning` (NF-3, NF-4,
  NF-5, NF-8), `delivery_planning` (NF-1 alternative, NF-6). Because the plan already
  scopes `chg-GH-238-test-plan.md` in **Phase 11**, NF-4/NF-8 can close in the Phase 11
  docs pass without a formal phase reopen.
- The Definition-of-Ready override is **not** available and was **not** used: the change
  adds and alters behaviour, introduces contracts, and changes the command surface.
- Pause is **not** required. The remaining governance question (TDR-0013 `Proposed`
  → owner ratification) is explicitly deferred by the PM to the GH-238 PR review gate
  and is a recorded residual here, not a missing artifact.

## Facet Summary

- spec_completeness: **PASS** (minor non-blocking: NF-1, NF-3)
- ac_quality: **PASS** (minor non-blocking: NF-2)
- plan_coverage: **PASS**
- test_traceability: **PASS** (minor non-blocking: NF-5)
- cross_artifact_consistency: **PASS** (minor non-blocking: NF-1, NF-2, NF-3, NF-4, NF-8)
- decision_capture: **PASS** (risk accepted: TDR-0013 `Proposed`; nit: NF-7)
- system_spec_consistency: **PASS** (minor non-blocking: NF-1)
- plan_doc_update_coverage: **PASS**
- plan_code_area_coverage: **PASS** (nit: NF-6)
- dod_defined: **PASS**

## Per-Finding Status — Iteration 2 (N-01..N-14)

| ID | Severity / blocking | Status | Evidence |
|---|---|---|---|
| N-01 (pre-commit identity not derivable from the model-message path) | critical / B | **Resolved** | `spec:150` (F-10) pins the identity to `baselineHead` + `changeRef` + `phase` + sorted normalized staged path set and forbids a message/body/fingerprint; `spec:467` (§13 assumption) now states the message is **not** deterministic and is never part of an identity; `spec:601` (AC-F10-2) is rewritten to the path-set match, the four fail-closed `unknown` outcomes, and three negative controls; `spec:369/766` (DM-10 / Appendix D) forbid message fields; TDR-0013 INV-1..INV-8 cited at `spec:149,388,514,525,824,840`; test plan `TC-EFFECT-005` steps 1–9 (model-path fixture whose message no template would produce; derivation-break, query-removal, match-rule-break and owner-restore controls; no fixture-supplied expected subject/body) and `TC-RECON-007` steps 2–7; plan tasks 7.1–7.7 use only the path-set identity and explicitly record "no message, subject, body, or fingerprint". PM decision recorded (`pm-notes` N-01, 2026-11-08). No live message-identity wording remains. |
| N-02 (undefined effect owner; no transition-recovery path; F-9 contradiction) | major / B | **Resolved** | `spec:149` (F-9) names the lane/one-shot owner and limits the daemon to detection + one bounded query + the durable redrive request; `spec:529` (DEC-19); `spec:597` (AC-F8-4) restructured to daemon-detect / owner-restore; `spec:877` (Appendix I) adds the ownership rule; plan task 7.3 forbids daemon apply, task 7.5 places restoration in `packages/cli/src/edge.ts readEvidence` + `packages/cli/src/commands/phase.ts` (both declared in Phase 7 scope), reusing `classifyCommitDelta` unchanged; the delivered `commit-without-record` row (`packages/cli/src/commands/phase.ts:490-497`) already appends `commitIntent: "atomic"` with the SHA, so INV-8 is implementable without a primitive change; `TC-RECON-007` steps 2–5/8 and `TC-LANE-002` steps 3–6 assert the two-process boundary plus a daemon-boundary control. |
| N-03 (state-dir scope asserted with no mechanism) | major / B | **Resolved** | `spec:141` (F-1), `spec:610` (AC-F15-1: explicit `Environment=<PREFIX>_STATE_DIR=<canonical dir>`, two-scope positive, wrong-scope negative, socket-outside `config.value.invalid`), `spec:743` (Appendix C), `spec:792-800` (Appendix E process-environment section with exact precedence), `spec:503` (OQ-4 resolved), `spec:469` (§12 assumption); DEC-18 (`spec:530`); plan tasks 1.6/5.6 (resolver in `packages/cli/src/edge.ts stateDirectoryFor`, no flag, no config key), 10.1/10.3/10.5 (unit `Environment=`); the mechanism exists in the delivered brand contract (`packages/core/src/branding/index.ts:126` `environmentPrefix`, convention `${prefix}NAME` used at `edge.ts:2315,325`). Residual coverage gap: **NF-5**. |
| N-04 (files required by tasks declared in no phase) | major / B | **Resolved** | Phase 7 scope now declares `packages/adapters/src/git/commit.ts` (producer, the sole `CommitGitPort` implementor) and `packages/core/src/contracts/commit.ts`; Phase 1 scope declares `tests/behaviour/config-schema.test.ts`, `config-resolver.test.ts`, `config-contract.test.ts` (+ consumer re-audit of `config-cli`/`config-provenance`/`config-restrictions`) and the Phase 1 gate runs both exact-set suites. Independent scan: 112 gate path tokens and 148 task path tokens all resolve to an existing file or a declared scope entry; the only existing files named in a task but absent from that phase's scope are the intended rename source (`tests/golden/lanes-watch-refusal.test.ts`, task 9.4) and read-only context (`scripts/…`, `tests/types/tsconfig.json`, `domain/commit-converge.ts` "reused unchanged"). |
| N-05 (lock token in the start envelope/golden) | major / B | **Resolved** | `spec:738-740` (Appendix C) project `instance` with the DM-1 scope digest and state the token never appears in `daemon start`/`stop`/`status` envelopes; `spec:578` (AC-F1-1) "carries no daemon lock token"; `spec:588` (AC-F4-4), `spec:640` (§21), `spec:667` (glossary); plan header line 149 (`instance.fence` is absent); test plan `TC-WIRE-006` step 2 and `TC-LIFE-008` step 6 (two-run byte-identical output is now satisfiable); zero `instance.fence` occurrences remain in any artifact. |
| N-06 (`feature-commit-primitive.md` absent from doc duties) | major / N | **Resolved** | `spec:560` (§16.1) adds the exact reconciliation (one bounded `logSince` read, normalization/rename representation, effect-protocol cross-reference, crash-window recovery, message composition unchanged); Phase 11 scope and task 11.x declare the file; TDR-0013 Implementation Plan step 5. |
| N-07 (ticket-pin supersession has no system record) | major / N | **Resolved** | TDR-0013 authored with C-1..C-7, ALT-0..ALT-4, INV-1..INV-8, supersession section, governance and revisit triggers; indexed at `doc/decisions/00-index.md:39`; `spec:914` (§24) no longer claims DEC-1..DEC-4 reproduce the pin unchanged; `spec:840` (Appendix G) states the supersession; DEC-4/DEC-15 revised (`spec:511,523`); `pm-notes` records the supersession and reserves ratification to the PR gate. Residual: record status `Proposed` (accepted residual). |
| N-08 (control dedupe key scope) | minor / N | **Resolved** | `spec:146` (F-6), `spec:166` (C-2), `spec:592` (AC-F6-2), `spec:769` (Appendix D), `spec:367` (DM-8) all key control application on (connection identity, `id`, lock token); `TC-CONC-005` splits same-connection replay from the cross-connection collision and adds a global-key negative control (step 9). |
| N-09 (four "full" rows whose gate omits a target suite) | minor / N | **Resolved** | Phase 3 gate now runs `tests/structure/daemon-contract.test.ts`, Phase 5 `tests/structure/daemon-imports.test.ts`, Phase 9 `tests/behaviour/daemon-state-mediation.test.ts`, Phase 10 `tests/behaviour/daemon-degradation.test.ts`. Independent scan over all `coverage` rows: **no** row claiming `full` has a phase gate that runs none of its TC's Target-Layer suites. |
| N-10 (`config-*.test.ts` wildcard; false T-RSK-9) | minor / N | **Resolved** | The wildcard is gone from every artifact; `TC-VOCAB-003`, `TC-TRANSPORT-003`, `TC-POLL-003`, `TC-CONFIG-001` and their automation rows name `tests/behaviour/config-schema.test.ts` and `config-resolver.test.ts`; Phase 1 scope + gate declare both. Independent scan: every one of the 260 Target-Layer path tokens across 102 TCs resolves to an existing file or a plan-declared file/folder. |
| N-11 (AC-F17-1 conflation, adapters daemon path, stale rows) | minor / N | **Resolved** | `spec:613` (AC-F17-1) separates the source-level `from`-set proof (core + CLI + `packages/adapters/src/daemon/`) from the injected-executor reachability proof; task 1.7 adds the adapters path with a per-family failing fixture and registry entry; `TC-MERGEABS-001/002` keep the two proofs distinct (002 step 5); test-plan AC-F17-1 row (`test-plan:135`), `TC-LIFE-003`, and DM-8 (v1-only) are corrected. |
| N-12 (no observable for "applied exactly once") | minor / N | **Resolved** | `spec:528` (DEC-16), `spec:583` (AC-F3-1), `spec:762` (Appendix D lane `resumeIntent` + executor call count) name the observable; `TC-STATE-003` steps 3–5 assert exactly one resume/attach call at the boundary, zero with no lane, the `resumeIntent`/state transition, and `applied: false` unchanged, with three negative controls (step 8). |
| N-13 (§4 table row glued to the previous row) | nit / N | **Resolved** | `test-plan:241` is a standalone "Behaviour — lock concurrency" row with its own level and execution cell. |
| N-14 (wording, plan version, watch-golden naming) | nit / N | **Resolved** | "the client supplies the intent, not a separate key" in `spec:143,146,166,769`; plan header cites spec v1.2 / test plan v1.3 (`plan:4,12`); goldens renamed in task 9.4 and reflected in `TC-WATCH-002/003`, `TC-VOCAB-005`, §4/§5.2/§6/§7 of the test plan. Residual: the test plan's §7.1 obligation block is still phrased as outstanding (**NF-4**, **NF-8**). |

## Regression Check — Iteration 1 (R-01..R-19)

| ID | Status | Re-verification |
|---|---|---|
| R-01 (invented mutating wire request) | No regression | F-6 (`spec:146`), AC-F6-2 (`spec:592`), DEC-14, DM-17, `TC-CONC-002/003/005` all still state at-most-once as a state-path property; no `intent` wire class. |
| R-02 (commit crash safety overclaim) | No regression | Superseded-and-closed by the N-01/N-02 fix; "SHA idempotency" survives only as the explicitly superseded ticket pin (`spec:840`). |
| R-03 (lock token vs secrets) | No regression | F-4 (`spec:144`), AC-F4-4 (`spec:588`), NFR-12, §21, glossary, `TC-WIRE-006` steps 2–3 (exemption **and** non-credential shape). |
| R-04 (v0/v1, wire types, additive claim) | No regression | EVT-8 (`spec:351`) names exactly the Appendix B wire set and calls `query` a class; AC-F4-1 (`spec:585`), AC-F16-1 (`spec:612`); `TC-WIRE-001/002`; DM-8 says "every v1 frame" only (`spec:367`). |
| R-05 (`outbox.effect` caller principal) | No regression | EVT-7, DM-10, Appendix D (`spec:766`), plan 1.2/1.4, `TC-VOCAB-004`. |
| R-06 (blocker-answer application) | No regression | OQ-5 resolved, DEC-16, AC-F3-1, plan 4.6/6.2, `resumeIntent` in DM-3/EVT-3, `TC-STATE-003`. |
| R-07 (systemd unit form) | No regression | `ExecStart=<binary> daemon start --foreground`, `Type=simple`, `Restart=on-failure` in F-15, DEC-17, AC-F15-1, tasks 10.1/10.3/10.5, `TC-INSTALL-001/007`; no real systemd invoked. |
| R-08 (TC-META-001 unmapped) | No regression | Phase 11 coverage row + `tests/checks/daemon-mutants.test.ts` in the Phase 11 gate; `tests/fixtures/daemon/mutants` scoped. |
| R-09 (premature "full" flags) | No regression | Re-verified globally (see N-09); the partial rows (`VOCAB-004/008`, `CONC-002/003`, `RECON-006`, `LIFE-005`, `DEGRADE-003`) still carry explicit completing phases. |
| R-10 (watch-refusal golden out of scope) | No regression | Phase 9 scope + gate declare the renamed goldens and the fixture; task 9.4 states the in-place rename and removal of the old names. |
| R-11 (undeclared Phase 1 edits) | No regression | Phase 1 still declares `packages/core/src/app/queue.ts` and `packages/core/src/state/blockers.ts`; the class recurred on two other files and is closed under N-04. |
| R-12 (gate hygiene) | No regression | Task 7.7 creates `tests/behaviour/commit-act.test.ts` (numbering moved from 7.6 — see NF-8); Phase 6 gate runs `tests/behaviour/blockers-publish.test.ts`. |
| R-13 (plan/test-plan misalignment) | No regression | Front matter links the plan; §7/§7.1/§7.2/§8.1 reconciled; the wildcard residue is closed (N-10). |
| R-14 (`mergeCodePath` complement) | No regression | DM-13 and AC-F17-1 define `{"absent","present"}`; `TC-MERGEABS-002` asserts both and that no third value is representable. |
| R-15 (cross-user identity + exit hedge) | No regression | `state.permission.denied` at exit 1 in F-5/AC-F5-1/Appendix B/F/§21; `TC-TRANSPORT-002/003`. |
| R-16 (socket path vs golden) | No regression | §20, Appendix C, `TC-LIFE-001` step 4, `TC-TRANSPORT-002` step 5, `TC-PRIVACY-001` step 4. |
| R-17 (scope identifier) | No regression | DM-1/§20/glossary pin the SHA-256 first-16-hex digest; plan 2.1/2.3; `TC-PRIVACY-001` steps 2–4. |
| R-18 (takeover Given + seed count) | No regression | AC-F2-2 three cases; `TC-LOCK-003`; all artifacts say seven seeded ids (SC-M1-14/15/16/17/17b/18/20). |
| R-19 (test doubles in a published subpath) | No regression | In-memory pair in `tests/fixtures/daemon/transport/` (Phase 3 scope); task 3.5 forbids exporting a test double. |

## New Findings

Ordered by severity. None is blocking. Each names the artifact phase that owns the fix;
`delivery` is never a remediation target.

### NF-1 [minor][N] system_spec_consistency / spec_completeness / cross_artifact_consistency — `chg-GH-238-spec.md` Appendix F row (`spec:814`), C-3 (`spec:167`), Appendix C exit matrix (`spec:744`), Appendix E closing rule (`spec:790`), Appendix J (`spec:881-895`), OQ-6 (`spec:505`); `chg-GH-238-test-plan.md` `TC-WIRE-004` step 1 (`test-plan:981`), `TC-VOCAB-002` step 2 (`test-plan:2627`)

Gap: `daemon.subscriber-degraded` is declared as a reachable error row (exit 2) whose trigger is "the daemon's subscription capacity is exhausted before any event", but no capacity mechanism exists anywhere: Appendix E explicitly says "No capacity … key is introduced" (`spec:790`), Appendix J bounds only the per-subscription buffer, and `TC-WIRE-004` requires 100 subscriptions to be **established** and served — which a capacity cap would break. Appendix F's own preamble ("every row … names a reachable behaviour") is therefore false for this row, and `TC-VOCAB-002` step 2 only checks a *documented* trigger. A coder must either invent an undeclared capacity key (which changes the configuration surface and violates AC-F16-1's additive-only list) or ship dead vocabulary. This is a pre-existing defect not caught in iterations 1–2.

Suggested remediation target phase: **specification** (with **test_planning**)
Suggested fix: pin a non-configurable capacity bound in Appendix J (declared constant, e.g. a per-daemon maximum subscription count above the 100-subscriber test), and add the capacity-refused case to `TC-WIRE-004`/`TC-WIRE-003` without adding a TC id; or explicitly record the row as declared-but-unreachable in this change (the `withdrawn` precedent) and correct the Appendix F preamble claim.

### NF-2 [minor][N] cross_artifact_consistency / ac_quality — `chg-GH-238-spec.md` AC-F10-2 (`spec:601`) and F-10 (`spec:150`) vs AC-F8-4 (`spec:597`), F-9 (`spec:149`), DEC-19 (`spec:529`); `chg-GH-238-test-plan.md` `TC-RECON-007` step 2 (`test-plan:1552-1560`)

Gap: AC-F10-2 attributes the single bounded `logSince(baselineHead)` read to "a later owning lane/one-shot run [that] reconciles the effect", while AC-F8-4, F-9, DEC-19, INV-7, the plan (task 7.3) and `TC-RECON-007` all place the detection read in the **daemon** and give the owner only the restoration (from the receipt, plan task 7.5). A reviewer applying AC-F10-2 literally would flag a correct implementation, and a coder could add a second owner-side read for the same effect. No behavioural property is at risk (both readings preserve zero duplicates and no lost binding), but the actor attribution is inconsistent between two ACs of the same spec.

Suggested remediation target phase: **specification** (with **test_planning**)
Suggested fix: restate AC-F10-2 as "exactly one bounded read per detection or re-drive attempt — the daemon performs it during restart reconciliation and records the receipt; the owning lane/one-shot process consumes the receipt's SHA and performs no second read", and have `TC-RECON-007` assert the owner performed zero `logSince` calls.

### NF-3 [minor][N] spec_completeness / test_traceability — `chg-GH-238-spec.md` DM-18 (`spec:377`), Appendix D detection shape (`spec:767`), EVT-6/DM-9 (`spec:349,368`); `chg-GH-238-test-plan.md` `TC-RECON-007` steps 2 and 7 (`test-plan:1568,1580`)

Gap: the redrive-detection record reuses `command.receipt`, whose closed field set requires `status` (`applied | already-applied | failed | unknown`) and `queryVerdict` (`found | not-found | unreadable`), but the artifacts never pin which values a detection records. Step 7 pins `unknown` for the ambiguous outcomes; step 2 pins only `found` + the discovered SHA. The verdict for "multiple commits" and "path-set mismatch" (neither `found` nor `unreadable`) is unpinned, and the `status` for a `found` detection is unpinned — a coder can record `status: "applied"` (which reads as a terminal receipt and can be mistaken for a state transition) or `queryVerdict: "found"` with no SHA. The `attempt: 0` discriminator and the "never transitions the effect" rule are stated; the field values are not.

Suggested remediation target phase: **specification** (with **test_planning**)
Suggested fix: pin the mapping in Appendix D/DM-18 — e.g. detection receipts carry `attempt: 0`, `queryVerdict: "found"` with `status: "unknown"` plus the discovered SHA, and `queryVerdict: "not-found"` with `status: "unknown"` for zero/multiple/mismatch (mismatch is "not ours"), `"unreadable"` for a failed/over-cap read — and assert it in `TC-RECON-007` step 2/7.

### NF-4 [minor][N] cross_artifact_consistency — `chg-GH-238-test-plan.md` §7.1 obligation block (`test-plan:3163-3202`), `T-RSK-9` (`test-plan:3215`), OQ-T10 (`test-plan:3249`), OQ-T11 (`test-plan:3250`), OQ-T12 (`test-plan:3251`)

Gap: the test plan still states, in the present tense, that the plan "must still declare" the concrete config suites, the renamed watch golden, `packages/adapters/src/git/commit.ts`, `packages/cli/src/commands/phase.ts`, and the `^packages/adapters/src/daemon/` boundary path, and that "the current header cites spec v1.1 and test plan v1.1". The plan now declares all of them (Phase 1/7/9/10 scopes and gates, `plan:4,12`, task 1.7) and cites spec v1.2 / test plan v1.3, so `T-RSK-9`/OQ-T11/OQ-T12 read as open obligations that no longer exist and `TC-VOCAB-006`'s `.changeset/**` root is the only Target Layer not covered by a declared folder or file. This is the residue of N-14/N-10, not a new defect in the plan; it can mislead a coder into re-declaring or believing something is undeclared.

Suggested remediation target phase: **test_planning** — or, because `chg-GH-238-test-plan.md` is already in Phase 11 scope, close it in the Phase 11 docs pass.
Suggested fix: re-state §7.1 as "satisfied by plan v1.3" with the declaration list as evidence, mark T-RSK-9/OQ-T10/OQ-T11/OQ-T12 closed with the plan cites, and drop the stale v1.1 parenthetical.

### NF-5 [minor][N] test_traceability / spec_completeness — `chg-GH-238-spec.md` Appendix E process-environment section (`spec:796-800`), F-1 (`spec:141`), AC-F15-1 (`spec:610`); `chg-GH-238-test-plan.md` `TC-INSTALL-001` step 7 (`test-plan:2427`), `TC-VOCAB-003` (`test-plan:2629-2648`)

Gap: the `<PREFIX>_STATE_DIR` contract states two behaviours — an explicitly set value wins outright and is never merged with the default, and a non-absolute/unusable value is `config.value.invalid` at exit 1 — but no TC asserts either one at the resolver. `TC-INSTALL-001` step 7 covers the two-scope routing and the wrong-scope/socket-outside negatives only through `daemon install`; `TC-VOCAB-003` enumerates the `daemon`/`poll` keys but not the environment contract; the existing `tests/behaviour/production-composition.test.ts:95` asserts only the default derivation and is not claimed by any phase. The failure mode this leaves unguarded is the one AC-F15-1 forbids ("a wrong scope is never silently shared"): a silent fallback to `<home>/<brand.stateDirectoryName>` on an unusable value would put two projects in one store, and nothing would fail.

Suggested remediation target phase: **test_planning** (with **specification** if the observable becomes an AC clause)
Suggested fix: add precedence + invalid-value cases (unset → default; set → wins; set-but-relative/unusable → `config.value.invalid` exit 1; both set and default present → never merged) to `TC-VOCAB-003` or `TC-INSTALL-001`, and either claim or explicitly disclaim `tests/behaviour/production-composition.test.ts`.

### NF-6 [nit][N] plan_code_area_coverage — `chg-GH-238-plan.yaml` tasks 1.6 (`plan:435-440`), 5.6 (`plan:1049-1053`), 10.1/10.3 (`plan:1727-1770`)

Gap: the state-directory variable name is written as the literal token `<PREFIX>_STATE_DIR` in the resolver task and the unit task, while the delivered brand contract exposes `environmentPrefix` **with a trailing underscore** (`packages/core/src/branding/index.ts:17,126`) and the codebase convention is `${brand.environmentPrefix}NAME` (`packages/cli/src/edge.ts:2315,325`; `packages/core/src/domain/blockers.ts:105`). Nothing pins the concatenation, so the unit writer and the resolver can independently produce `ADOS_STATE_DIR` and `ADOS__STATE_DIR`. `TC-INSTALL-001` step 7 would catch a real mismatch, so the risk is contained.

Suggested remediation target phase: **delivery_planning** (one clause in the install pin)
Suggested fix: state that the variable is `brand.environmentPrefix + "STATE_DIR"` (one separator) in the plan's install pin and in Appendix E, so neither side re-derives the spelling.

### NF-7 [nit][N] decision_capture — `doc/decisions/TDR-0013-…md` "Unresolved Questions" (`TDR:330-334`)

Gap: TDR-0013 still lists as open the choice of how the receipt SHA enters convergence (`TDR:332`), although plan task 7.5 now answers it (`readEvidence` additive redrive evidence source + `phase` discriminator), and the reopen/different-baseline key case (`TDR:334`) is still neither confirmed by a TC nor disclaimed (no artifact mentions `reopen`). INV-2's baseline component makes the reopen case structurally distinct, so this is record hygiene rather than a gap.

Suggested remediation target phase: **specification** via `@decision-advisor` (record maintenance), with **test_planning** for the reopen assertion.
Suggested fix: mark `TDR:332` resolved with the plan-task reference, and either add the reopen case to `TC-EFFECT-005` or state in the TDR that INV-2's baseline component covers it.

### NF-8 [nit][N] cross_artifact_consistency — `chg-GH-238-test-plan.md` §7.1 (`test-plan:3171`) vs `chg-GH-238-plan.yaml` task 7.7

Gap: the test plan says `tests/behaviour/commit-act.test.ts` "is created by Phase 7 task 7.6"; the plan creates it in task 7.7 (7.6 is the effect/convergence suites). Task-id drift only; the file is declared in Phase 7 scope and gate.

Suggested remediation target phase: **test_planning** (or the Phase 11 docs pass)
Suggested fix: update the task reference to 7.7.

## Verification Notes (not findings)

- **Plan validator**: re-run through the repository's own `validatePlan` with the real YAML-parser contract against the real `doc/changes` tree → `verdict: "valid"`, `readyForDevelopment: true`, `totalErrors: 0`, `truncated: false`, `schemaVersion: "delivery.plan.v1"`, `tier: "full"`, 12 phases, all echoing `kind: delivery` and the declared weight classes (`heavy` 4/5/6/7/9/11/12, `standard` 1/2/3/8/10). 85 tasks. The validator checks schema/shape, not coverage.
- **Counts**: spec 36 ACs (`AC-F1-1..AC-F17-1`), 18 NFRs (`NFR-1..NFR-18`), 9 events, DM-1..DM-18, DEC-1..DEC-19, 6 OQs. Test plan: **102** local TCs (index = details = 102, titles identical in both), 36/36 AC rows, 18/18 NFR rows, EVT-1..EVT-9, DM-1..DM-18, DEC-1..DEC-19 traced, **seven** seeded ids. `TC-LEASE-002` remains GH-237's inherited proof and is correctly excluded from the 102.
- **Plan coverage**: 102/102 TC ids and 36/36 ACs appear in the plan; all 36 ACs are covered in Phases 1–11, so Phase 12 adds only the closure net. Every `full` coverage row's claiming gate runs at least one of that TC's Target-Layer suites (checked for all 102).
- **Path audit**: 112 distinct gate path tokens and 148 task path tokens all resolve to an existing file or a declared scope entry; every TC Target-Layer token (260) resolves. Rename source paths appear only in the rename instruction (task 9.4), which also states the old names are removed.
- **Delivered-substrate assertions re-verified**: `commit-without-record` appends `commitIntent: "atomic"` + `commitSha` (`packages/cli/src/commands/phase.ts:490-497`); `classifyCommitDelta` is total over the four states (`packages/core/src/domain/commit-converge.ts:13-45`); `PhaseCommitEvidence` lives in `packages/cli/src/commands/phase.ts:133` and `CommitDurableEvidence` in `packages/core/src/contracts/commit.ts:432`, both declared where the plan edits them; `readEvidence` is `packages/cli/src/edge.ts:546`; `stateDirectoryFor` is `packages/cli/src/edge.ts:1076` with an injected environment (`EdgeOptions.environment`), so no ambient `process.env` read is needed; `PRODUCTION_CATALOG` exact-key assertions exist at `tests/structure/config-contract.test.ts:10` and `tests/behaviour/config-schema.test.ts:24` (both declared Phase 1); the `runtime-apis-confinement` allowlist is `.dependency-cruiser.cjs` (declared Phase 1); `environmentPrefix` exists in the brand contract, so `<PREFIX>` is mechanizable.
- **Scope leak check**: no `dispatch` command/handover, dual-run evidence, full resume, remote transport, `status --watch`, fleet coordination, or merge execution is added; all remain NG-1..NG-10 / M1-S9 / M4-S6. No tracker/VCS/CI write adapter ships. The ticket's five seeded scenarios are all inherited (plus SC-M1-14 and SC-M1-17b from the M1 pack).
- **No-merge structural proof**: `AC-F17-1` + task 1.7 + `TC-MERGEABS-001/002` + `TC-LANE-002` step 6 give a source-level `from` set covering `^packages/core/src/(app|domain)/daemon`, `^packages/cli/src/daemon`, `^packages/adapters/src/daemon/` with a per-family failing fixture and registry entry, a distinct reachability proof (`mergeCodePath` `{"absent","present"}`), and a daemon-boundary control in `TC-RECON-007` step 8.
- **Doc-distribution / changeset**: Phase 11 lists the new `feature-resident-daemon.md`, ten neighbour specs (including `feature-commit-primitive.md` and `feature-config-layer.md` with the `<PREFIX>_STATE_DIR` selector), the command registry, the man page, the glossary, the architecture overview, `doc/00-index.md`, the doc-distribution guard, and one five-package lockstep changeset. TDR-0013 carries `ados_distribution: project-generated`.
- **Working tree**: `chg-GH-238-pm-notes.yaml` has one uncommitted line — the `dor_check` iteration-3 stamp. The PM should commit it together with this verdict.
- **No override record** was needed or used.

## Risks Requiring Owner Attention

- **TDR-0013 is `Proposed` with `decision_date: null`.** It is the binding contract for F-10/AC-F10-2/AC-F8-4 and it supersedes a ticket pin the ticket marks "binding; do not re-derive". The PM recorded the supersession and preserved the pin's intent (`pm-notes` 2026-11-08), and the TDR states acceptance is pending at the GH-238 PR review (TDR-0012 precedent). Delivery may proceed under that precedent; the PR **must not** be merged without the owner's ratification and the record's status flip. If the owner rejects ALT-2, the affected surface is INV-1..INV-8 → F-10/AC-F10-2/AC-F8-4 → Phase 7 (a pre-delivery artifact change, not a delivery fix).
- **False-`unknown` rate from working-tree drift** (TDR-0013 negative outcomes, AS-1): the path-set identity is exact, so a hook/formatter writing between the wrapper's pre-read and the act's read resolves `unknown` and requires operator confirmation. Accepted deliberately and fail-safe; measure it during delivery and revisit via the TDR's first revisit trigger.

## Accepted Residuals

Carried from iterations 1–2, still accepted and unchanged:

- **Algorithmic, not OS-level, concurrency** (GAP-T1): 100-start and 100-subscriber proofs are deterministic interleavings; one bounded real-child smoke covers start/stop only (hermeticity, NFR-7).
- **Environment-sensitive latency** (GAP-T3): NFR-6's 50 ms p99 is measured against a recorded reference-class baseline; the structural properties are asserted independently.
- **Real cross-user kernel refusal and real systemd/launchd/Windows managers are not exercised** (GAP-T2, GAP-T4): policy and unit content are asserted through injected seams; OS enforcement is operational verification.
- **No production tracker/VCS write adapter** (RSK-9): the effect protocol is proven over injected adapters; the commit half is the only production effect path and is now backed by TDR-0013 + the path-set mechanism.
- **`daemon install` linger failure reuses `daemon.supervisor-unsupported`** (OQ-T1): tested as written; semantic conflation flagged to the spec owner.
- **Heartbeat `laneCounts` uses the separate `{delivering, idle, parked, failed}` set** (S-6): declared as a separate closed set; no vocabulary redefinition.
- **`daemon.preemption.withdrawn` is declared but never written** (S-4): accepted as a declared read-only state with no cancellation trigger.
- **`dispatch <ref>` and SC-M1-17b remain M1-S9/GH-237** (GAP-T6, GAP-T7): inherited with the PM acknowledgement; not re-proven here.
- **Deferred scope is explicit**: M1-S9 dispatch/handover, remote transport (M4-S6), `status --watch`, launchd/Windows adapters, lane-scoped authorization, full blocker-resume execution — NG-1..NG-10 with named owners; not leakage.
- **TDR-0013 acceptance is pending at PR review** (new this iteration): delivery unblocked under the TDR-0012 precedent; merge blocked on owner ratification.

The new non-blocking findings NF-1..NF-8 are **not** accepted residuals: NF-1..NF-5 must be fixed in their owning artifact phase (or separately recorded as accepted) before the phase that depends on them — NF-5 before Phase 5, NF-1/NF-3 before Phase 3/7, NF-2 before the Phase 7 review, NF-4/NF-8 in the Phase 11 docs pass.

## Escalation Note

This is the third and final iteration of the gate. No blocking gap persists, so a fourth loop is **not** recommended. The only remaining decision that is not an artifact-authoring task is the owner's ratification of TDR-0013 at the PR gate; if the owner intends to reject the message-independent identity, that decision should be taken **before** Phase 7 starts, not at merge.
