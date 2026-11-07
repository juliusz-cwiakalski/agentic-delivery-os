# Readiness Review Iteration 2

Verdict: **NOT_READY**
Work Item: GH-237 (M1-S17: Scheduling engine: queue, lanes, dependency batching)
Date: 2026-11-07
Pause Required: no

## Gate Summary

- Artifact set reviewed: `chg-GH-237-spec.md` v1.2, `chg-GH-237-test-plan.md` v1.2, `chg-GH-237-plan.yaml` (delivery.plan.v1), `chg-GH-237-pm-notes.yaml`, the ticket context, the M1 design pack, and the delivered contracts/code the change builds on.
- Previous blocking findings R-01, R-02, R-03, R-04, R-05, R-06 (core), R-07 are **resolved**. R-06 retains one minor annotation residual (R2-02), not a placement failure.
- Non-blocking findings R-08..R-16 are resolved or explicitly accepted with an owner (R-12 owner: coordinator/PM in plan task 8.3a).
- One **new blocking** cross-artifact conflict was introduced by the R-03/R-10 remediation: AC-F1-1 requires `queue list` to show the recorded repository root, but Appendix C's `entries[]` shape, DM-13's graph document, the queue golden-normalization rule, and every TC detail omit it.
- Plan still validates: `verdict: "valid"`, `readyForDevelopment: true` (run through `validatePlan` + `parseConfigYaml`).
- Privacy-literal guard still passes: 2 691 files scanned, 0 violations; the credential-shaped literal is now the non-credential placeholder `https://user:redacted@github.com/Owner/Repo`.
- Structural counts hold: 66 TCs in the index, 66 detail sections, 66 TCs in plan `coverage`; 22 ACs and 14 NFRs traced; six seeded scenarios mapped.
- The Definition-of-Ready override is **not** available: the change adds behavior, introduces contracts, and changes the command surface.

## Facet Summary

- spec_completeness: **FAIL** — AC-F1-1's `queue list` display clause has no contract field and no test row (R2-01); §20 does not review the new absolute recorded root (R2-04); §19's "existing payload schema / older park record" wording conflicts with `queue.park` being a new kind (R2-07).
- ac_quality: **FAIL** — AC-F1-1's "`queue list` shows ... recorded root" is not satisfiable under the declared envelope and golden rules (R2-01).
- plan_coverage: **PASS** — all 66 TCs are mapped to Phases 1–8; phase ordering is executable; R2-02, R2-05, R2-06 are annotation/task-granularity residuals.
- test_traceability: **PASS** — 66/66 TCs mapped, 22/22 AC rows covered, 14/14 NFRs traced, six seeds mapped, no orphan in either direction. R2-01 records a clause-level gap inside an otherwise-covered AC.
- cross_artifact_consistency: **FAIL** — R2-01 (AC-F1-1 vs Appendix C/DM-13/goldens/TCs), R2-02 (TC-SCHED-001/TC-PARK-004 partial marking), R2-03 (add/prioritize/dep envelope omits `degraded[]`), R2-06 (stale `queue-ready.test.ts` gate reference).
- decision_capture: **PASS** — DEC-1..DEC-13, OQ-13/OQ-14, the PM one-shot acknowledgement, and the digest follow-up ownership are recorded in the right places.
- system_spec_consistency: **PASS** — F-11 now states the true lane-state provenance and separates the digest attention set; RSK-9 and plan 8.3/8.3a keep the digest gap flagged with an owner.
- plan_doc_update_coverage: **PASS** — Phase 8 lists the new feature spec, seven neighbour specs, queue/lanes man pages, registry, glossary, changeset, and the distribution-marker guard.
- plan_code_area_coverage: **PASS** — every phase declares files/folders; R2-05 notes that Phase 2 does not explicitly task recording the root that Phase 3/7 consume.
- dod_defined: **PASS** — 22 ACs, 14 NFRs, measurable §4.1 metrics, plan task 8.8's DoD checklist, and typed `doneArtifacts`.

## Previous Finding Status

| Finding | Status | Resolving evidence |
|---|---|---|
| R-01 [critical][B] claim refusal identity | **Resolved** | F-2 line 133: "`repo-free` is a read-surface condition and is never a pre-fence claim refusal: a claim decides repository exclusivity only through its in-fence verified lease read, so a repository held by another live holder always projects `queue.lease-conflict`, never `queue.precondition.unmet`". F-4 line 137: "**Pre-fence stage:** it evaluates ... the five non-exclusivity readiness conditions ... `repo-free` is excluded from the pre-fence gate". C-2, AC-F3-1(b), AC-F4-1, Appendix B line 627, OQ-13, and TC-LEASE-005 step 1 / TC-LEASE-012 all state the same rule. |
| R-02 [critical][B] closed park sets | **Resolved** | F-8 line 145: "The condition-type set is `provider-window` ..., `provider-quota` ..., and `preemption`. The cause set is `provider-window`, `provider-quota`, and `preempted-for-close-item`. The valid pairings are one-to-one". DM-5, NFR-14, Appendix E, Appendix F, plan task 1.1, plan task 7.1, TC-PARK-004 steps 1–3, TC-LEASE-011 step 6, and TC-RANK-004 step 4 carry the two-set contract and the `preempted-for-close-item` ↔ `preemption` pairing. |
| R-03 [major][B] producer-root discovery | **Resolved** | F-6 line 141: "Roots are discovered only from entry records (DM-1, DM-12): a match is exact string equality on the normalized key ... A producer config that is missing, unreadable, or invalid — including the case where no recorded root matches the key, or two distinct recorded roots both claim the key (a collision) — yields `unknown`". C-6, DM-1, DM-12, §12, Appendix E, AC-F6-2, OQ-14, TC-DEPEND-003 steps 6–11, and TC-DEPEND-004 steps 6–8 implement the rule. (The residual is R2-01/R2-05: the root is not in the read envelope and Phase 2 does not explicitly task recording it.) |
| R-04 [major][B] stuck-park schedule status | **Resolved** | F-7 line 143: "A park classified `queue.park-condition-stuck` is excluded before rank assignment (Appendix B step 7b): it is never `resume-parked`, never appears in `nextActions`, and is never selected by a no-ref claim." F-8, Appendix B step 7b, AC-F8-1, C-7, TC-PARK-008 (steps 1–6), and TC-RANK-005 step 5 assert the exclusion and the exit-1 zero-append refusal. |
| R-05 [major][B] in-pass single-flight projection | **Resolved** | F-3 line 135: "Within one scheduling pass, at most one action is projected per repository: after ordering, the first candidate for a repository becomes the action and the remaining ready entries in that repository are held with reason `repo-claimed-in-pass`, a per-pass projection reason distinct from `lease-held` ... (Appendix B step 13b)." Appendix B step 13b, F-9, AC-F3-1(a), Appendix C, TC-SCHED-004 step 6, and TC-LEASE-001 step 1 assert the projection. |
| R-06 [major][B] Phases 3–5 "full" TCs depend on Phase 7 CLI | **Partially resolved** — core placement resolved; one minor annotation residual (R2-02) | Test plan §7.1 lines 2150–2177 and plan header lines 36–51/182–198 define the phase-surface split; the affected TCs are marked partial with their completing phase, and each phase gate names only runnable rows. Plan Phase 2/3/4/5 coverage no longer marks the CLI-halves full. Residual: TC-PARK-004 is marked "full" in Phase 5 (plan line 521) while step 8 reads as a `queue release --park` CLI assertion; its parenthetical defers the behavior to TC-LEASE-011, so the gate remains runnable at domain level, but the annotation is ambiguous. |
| R-07 [major][B] "49 refusals" with alternating holders | **Resolved** | NFR-3 line 375: "Under 50 concurrent claim attempts by 50 **distinct holders** ... exactly 1 acquires and 49 refuse (a repeat claim by the holder renews, it does not conflict)". TC-LEASE-002 lines 750–770: "50 claim attempts ... each from a **distinct holder** (`holder-01` … `holder-50`) ... exactly 1 ... exactly 0 return `result=renewed`, and the remaining 49 return `queue.lease-conflict`", plus the same-holder renewal control in step 8. Plan task 4.3 repeats the distinct-holder model. |
| R-08 [major][N] one-shot narrowing acknowledgement | **Resolved** | `chg-GH-237-pm-notes.yaml` decision dated 2026-11-07: "the SC-M1-17 `dispatch <ref>` clause is explicitly inherited by M1-S9 ... The human owner retains the final say at the open-PR review gate". Spec Appendix A line 602 and §22 line 560 record the inheritance and acknowledgement. |
| R-09 [minor][N] AC-F8-1 interval wording | **Resolved** | AC-F8-1 line 517 now scopes the bound: "when a mutating pass runs within one recheck interval of T ... and when no mutating pass runs within one recheck interval of T, then the first mutating pass after the gap recovers the park with a gap-naming incident". NFR-5 line 377 matches; TC-PARK-005 steps 1–4 pin the inclusive bound and the gap case. |
| R-10 [minor][N] AC-F1-1 given clause | **Resolved** | AC-F1-1 line 504 now states: "a seeded dependency edge already declares GH-302 → GH-301 and GH-301 has no queue entry (an edge may target a ref with no entry; readiness evaluates it as `unknown` with `dependency-unobserved`)". F-1, DM-2, Appendix B step 2, TC-SCHED-001 step 1, and TC-DEPEND-001 carry the rule. |
| R-11 [minor][N] lane-vocabulary provenance | **Resolved** | F-11 line 151: "the five lane states declared by the M1 `lanes` design pack — `delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review` — extended in this change by the additive state `failed` ... it is not a delivered contract set today, and `failed` is this change's additive value." DM-11 and the digest attention-set distinction are stated. |
| R-12 [minor][N] digest follow-up ownership | **Resolved** | Plan task 8.3 now words the registry row as: "engine shipped; the digest's declared lanes-or-queue gap and its expected-story reference remain pending its own reconciliation". Plan task 8.3a names "OWNER: coordinator/PM", "TRIGGER: the status digest's own reconciliation cycle", and "TRACKING ROUTE: a tracker ticket is created only with human approval". No digest document is edited (NG-10). |
| R-13 [minor][N] eight-phase reconciliation | **Resolved** | Plan header lines 52–64 add the R-13 placement reconciliation naming Phase 7 as the CLI-surface step; test plan §7.2 lines 2179–2190 presents the eight plan phases; spec §18 is explicitly described as the seven-step narrative. |
| R-14 [minor][N] inventory registration | **Resolved** | Plan header lines 100–108; Phases 1–6 each name `tests/structure/inventory.json` and `tests/structure/content-inventory.test.ts` in `scope.files` and carry a registration task (1.7, 2.5, 3.8, 4.7, 5.8, 6.7) plus the inventory test in their gates. |
| R-15 [nit][N] type-probe bun invocation | **Resolved** | Plan header lines 109–114: "`tests/types/queue-scheduling.type-test.ts` is a compile-only probe. It is never invoked through `bun test` ... it compiles through `pnpm typecheck`". Phase 1 `testGate` runs `pnpm typecheck` and no longer names the type-test file in `bun test`. |
| R-16 [nit][N] TC-LANES-002 typo | **Resolved** | TC-LANES-002 step 4 now reads: "Assert no synthetic `L` ordinal identity is produced." |

## New Findings

Ordered by severity. `B` = blocking (must be fixed in an artifact phase before delivery starts); `N` = non-blocking (may be handled in delivery or accepted as risk).

### R2-01 [major][B] cross_artifact_consistency / ac_quality / spec_completeness — `chg-GH-237-spec.md` AC-F1-1 line 504 vs Appendix C line 631 and DM-13 line 344; `chg-GH-237-test-plan.md` §3.1 line 98, TC-SCHED-009 step 1 line 525; `chg-GH-237-plan.yaml` Phase 2 task 2.3 line 348, Phase 7 coverage line 621, Phase 7 task 7.4 line 614

Gap: AC-F1-1 requires that "`queue list` shows the entry, its repository key **and recorded root**, its priority, and its edges." The declared `queue list` envelope `entries[]` is "ref, repository, state, rankClass, priority, weightClass, weightClassSource, deps[], blocking[]" — there is no root field. DM-13's folded graph document likewise folds "entries, edges, priorities, repository keys, weight classes, and rank classes", with no root. No TC asserts a root in the list output: TC-SCHED-009 step 1 enumerates `entries[]` fields without root; TC-SCHED-001 step 2 asserts the root at append time, not display; TC-SCHED-002 step 5 asserts only "no duplicate entry line". The plan nevertheless claims Phase 7 completes "TC-SCHED-001 ... `queue list` display rows", but the test plan contains no such rows. The conflict is also operational: the plan's Phase 7 task 7.4 and the test plan's golden rules require queue goldens to carry "no absolute paths", while DM-1 defines the recorded root as an "absolute path" — so displaying the recorded root would either violate the envelope shape or force a normalized value that is no longer the recorded root.

An implementer cannot satisfy AC-F1-1 and Appendix C/DM-13/golden rules simultaneously. This is a remediation-introduced inconsistency: R-03/R-10 added the root recording and the AC display clause, but the envelope, graph document, TC rows, and golden rule were not reconciled.

Suggested remediation target phase: **specification** (primary), with **test_planning** follow-up if the display is retained.
Suggested fix: Prefer removing "and recorded root" from AC-F1-1's `queue list` clause and stating that the root is stored on the entry for producer-root discovery only, not exposed by `queue list` (this also avoids the absolute-path/golden and privacy conflicts). If the display is intentional, add `root` to Appendix C `entries[]`, DM-13, and a TC-SCHED-009/TC-SCHED-001 list-display row, define its normalized/redacted form, and update the golden rule accordingly. Update the plan's Phase 7 coverage claim to match the chosen option.

### R2-02 [minor][N] cross_artifact_consistency / plan_coverage — `chg-GH-237-plan.yaml` Phase 5 coverage line 521 and task 5.5 line 516; `chg-GH-237-test-plan.md` TC-PARK-004 line 1579

Gap: TC-PARK-004 is marked "full" in Phase 5, but step 8 asserts "`queue release --park` accepts exactly the cause set and rejects a condition-type token or an unknown token through `fallback.invocation`" — a CLI grammar/exit assertion. The queue command family lands in Phase 7; the plan's own §7.1 rule says such a TC is partial. The parenthetical "(cross-checked behaviourally in TC-LEASE-011)" and task 5.5's domain-level wording make the gate runnable at the policy level, but the marking is inconsistent with the plan's stated rule and with the other split TCs.

Suggested remediation target phase: **delivery_planning** (and **test_planning** for the TC annotation).
Suggested fix: Mark TC-PARK-004's step 8 as a contract/set assertion in Phase 5 with its behavioral CLI cross-check completing in Phase 7 (or move step 8 to TC-LEASE-011 and note it there), and align task 5.5's wording with the phase split.

### R2-03 [minor][N] cross_artifact_consistency — `chg-GH-237-spec.md` Appendix C line 633 vs AC-F10-2 line 521/F-10 line 149; `chg-GH-237-plan.yaml` task 7.2 line 612

Gap: AC-F10-2 requires that "any successful mutating `queue` subcommand with no daemon reachable ... the envelope reports the degradation", and F-10 says "Mutating subcommands ... the envelope carries `degraded: ["daemon-unreachable"]` at exit 0." Appendix C's `queue add | prioritize | dep` shape lists only "`ref`, `entry`, `edges[]`, `result`" and omits `degraded[]`; the plan's task 7.2 prose still says "A successful mutation ... exits 0 with degraded [`daemon-unreachable`]". The plan resolves the behavior, but the contract-level shape is incomplete and could lead an implementer following "Appendix C exactly" to omit the marker from those three envelopes.

Suggested remediation target phase: **specification**.
Suggested fix: Add `degraded[]` to the `queue add | prioritize | dep` envelope shape in Appendix C (and any matching DM/EVT wording), or state that `degraded[]` is a uniform field on every successful mutation envelope.

### R2-04 [minor][N] spec_completeness / privacy — `chg-GH-237-spec.md` §20 line 542 and DM-1 line 332 vs AC-F1-1 line 504

Gap: DM-1 records the declaring checkout's repository root as an **absolute path**, and AC-F1-1 makes it observable on `queue list`. §20's privacy review enumerates "work-item refs, normalized repository keys, priority and weight values, lease holder identities ..., park conditions and timestamps, and bounded incident evidence" but never mentions the absolute root. An absolute path can disclose a username or machine layout, and the test-plan golden rule forbids absolute paths. The privacy review is therefore incomplete and understates the observable surface.

Suggested remediation target phase: **specification** (fold into the R2-01 fix).
Suggested fix: Either keep the root internal to state records and state that it is never emitted in an envelope, or describe it in §20, normalize/redact it on display, and reconcile the golden rule.

### R2-05 [minor][N] plan_coverage / plan_code_area_coverage — `chg-GH-237-plan.yaml` Phase 2 task 2.1 line 346 and task 2.3 line 348 vs Phase 3 task 3.3 line 405 and Phase 7 task 7.3 line 613

Gap: R-03's producer-root discovery depends on `queue add` recording the declaring checkout's root on the entry (F-1, EVT-1, DM-1, DM-12). Phase 2 task 2.1 describes ref identity, priority, repository key, edges, and folding, but never says to record the root; task 2.3's AC-F1-1 sequence does not assert it. Phase 3 task 3.3 and Phase 7 task 7.3 then consume "the recorded root" / "entry records". The test plan TC-SCHED-001 step 2 asserts the root at append time, so delivery would likely catch the omission, but the plan's Phase 2 task is incomplete for a remediation-critical field.

Suggested remediation target phase: **delivery_planning**.
Suggested fix: Add "record the declaring checkout's repository root alongside the normalized key on the entry (DM-1, EVT-1) and fold it into the entry projection" to Phase 2 task 2.1/2.3, and assert it there.

### R2-06 [nit][N] plan_coverage — `chg-GH-237-plan.yaml` Phase 2 testGate line 359, Phase 4 testGate line 481, Phase 7 testGate line 637

Gap: Those gates name `tests/behaviour/queue-ready.test.ts`, which does not exist in the tree. The delivered queue-ready suites are the fifteen `tests/behaviour/queue-ready-*.test.ts` files (`queue-ready-output.test.ts`, `queue-ready-command.test.ts`, etc.). Bun treats a non-matching filter as an ignored filter when another filter matches, so the gate still runs and exits 0 — this is not gate-breaking — but the reference is stale and the plan's "run this suite" intent is not met.

Suggested remediation target phase: **delivery_planning**.
Suggested fix: Replace `tests/behaviour/queue-ready.test.ts` with the actual existing suites (`queue-ready-output.test.ts`, `queue-ready-command.test.ts`, or the full `tests/behaviour/queue-ready-*.test.ts` corpus), or remove the stale filter.

### R2-07 [nit][N] spec_completeness / cross_artifact_consistency — `chg-GH-237-spec.md` §19 line 538 vs F-12 line 153 and Appendix D line 647; `chg-GH-237-test-plan.md` TC-VOCAB-001 step 7 line 1893; `chg-GH-237-plan.yaml` task 5.7 line 518

Gap: §19 says "The `queue.park` record gains additive observation fields (`clearObservedAt`, `recoveryState`) within its **existing payload schema**; **no new record kind is introduced**, and an older park record without the fields reads as a park with no clear observation." F-12 and Appendix D declare `queue.park` as one of the **five new additive record kinds** (`delivery.queue.park.v1`). The intended meaning is reconcilable (the clear-observed marker is the same new `queue.park` kind, not a sixth kind; the schema includes the fields from the start), but the "existing payload schema" and "older park record" phrasing implies a pre-existing kind and a compatibility path that cannot exist for a new kind. The test plan and plan repeat the wording.

Suggested remediation target phase: **specification**.
Suggested fix: State that `queue.park` is a new kind whose schema includes `clearObservedAt`/`recoveryState` from the start, and that the clear-observed marker is another record of the same kind, not a sixth kind. Drop the "older park record" compatibility sentence or scope it to pre-1.0 drafts only.

## Reopen Targets

| Artifact phase | Findings |
|---|---|
| `specification` | R2-01 (AC-F1-1/Appendix C/DM-13 root display), R2-03 (degraded[] in add/prioritize/dep shape), R2-04 (§20 root privacy), R2-07 (§19 park-record wording) |
| `test_planning` | R2-01 (list-display TC rows if the display is retained; update the AC-F1-1 coverage row if removed), R2-02 (TC-PARK-004 partial annotation) |
| `delivery_planning` | R2-02 (TC-PARK-004 / task 5.5 alignment), R2-05 (Phase 2 root-recording task), R2-06 (stale `queue-ready.test.ts` gate) |

`delivery` is not reopened. After the author agents revise, re-run this gate. This is iteration 2 of a ~3-iteration cap; if the same blocking gap persists after the next revision, escalate to the human rather than looping.

## Verification Notes (not findings)

- **Plan validator**: `validatePlan` with the delivered `parseConfigYaml` wrapper returns `verdict: "valid"`, `readyForDevelopment: true`, `errors: []` for `chg-GH-237-plan.yaml` (all eight phases echoed).
- **Privacy literal**: `pnpm check:privacy-literals` exits 0 — 2 691 files scanned, 7 rules, 0 violations. The sanitized placeholder `https://user:redacted@github.com/Owner/Repo` is inert; no credential-shaped literal remains.
- **Counts**: test-plan index 66 TCs = detail sections 66 = plan `coverage` 66; AC rows 22 in both spec and test plan; NFRs 14 in both; six seeded scenarios mapped. No TC orphan in either direction.
- **Substrate**: all plan-asserted delivered paths exist (`contracts/queue-ready.ts`, `domain/queue-ready.ts`, `cli/commands/queue.ts`, `contracts/state.ts`, `state/merge.ts`, `contracts/plan.ts`, `domain/plan-validate.ts`, `domain/plan-overlap.ts`, `contracts/verify-deploy.ts`, `domain/verify-deploy.ts`, `contracts/economics.ts`, `domain/economics-view.ts`, `config/{catalog,schema,defaults}.ts`, `contracts/owner-gate-sla.ts`, `cli/edge.ts`, `tests/fixtures/state/harness.ts`). `tests/behaviour/queue-ready.test.ts` is the one stale gate reference (R2-06).
- **Delivered contract facts** relied on by the artifacts are present: `QUEUE_READY_CONDITION_ORDER`, the tri-state and `dependency-open`/`dependency-unobserved` evidence reasons, `BOARD_COLLECTOR_IDS = ["tracker"]`, `MERGE_DEPLOY_EXPECTATIONS_KEY = "merge.deploy-expectations"`, `resolveLaneSettings`, `createQueueReadyCommandDefinition`, and `options.queueReady`.
- **System-spec consistency**: F-11's lane-state provenance now matches the M1 pack plus this change's additive `failed`, and separates the digest attention set; the digest spec still declares its own `lanes-or-queue` gap (`M2-S1`, `engine-not-delivered`) and is correctly left to its owner (NG-10).
- **No override record** was needed or used; the change is behavioral and contract-bearing.
