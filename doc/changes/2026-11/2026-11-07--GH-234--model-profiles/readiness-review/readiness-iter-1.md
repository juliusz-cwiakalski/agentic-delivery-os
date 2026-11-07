# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-234
Date: 2026-11-07
Pause Required: no

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Verification Evidence

- Ticket (GitHub #234) loaded via `gh`. All seven ticket ACs map one-to-one to spec ACs (spawn-never-without-profile → AC-F8-1; exhaustion switch + revert → AC-F6-2; expensive-window park/resume → AC-F6-1; text-only-never-vision → AC-F3-3; execution-only rung movement → AC-F7-4; configuration-only tuning → AC-F1-5; ported decision table → AC-F11-6); the milestone-exit criterion is AC-F8-8 and AC-F9-7 makes the watching deliverable testable (a ticket task, not scope creep). Every ticket task element traced: tiers/profiles/overrides (F-1, DM-1/2), the exact heuristic formula consequence × reasoning depth ÷ volume with declared amplification/family-diversity (F-2, TC-006), candidate-iff-every-provider-available with lazy memoized probes (F-4, TC-011..014), the three first-iteration vendor watch shapes with weekly+rolling / balance-floor / usage-window-park-expiry semantics (F-5, §8.4, TC-016..019), priced-multiplier + peak parks (DM-10, TC-022/023), switch-not-park + persisted target + revert (F-6, EVT-1/2/4, TC-024..028), goal priorities verbatim from the ticket (DM-5), typed pacingClass as the enforced field not a naming convention (DM-3, DEC-1), resolution-before-spawn incl. the CLI-or-daemon wording with the daemon deferred as a delivered seam (F-8, DEC-6, NG-1; M1-S9/GH-239 is a separate open story), data-only records with the ADOS_HOOK_ENV_V1 carry-over (DEC-3, NG-6), and all enumerated hardening classes (Appendix D: variable-name shape, duplicates, metacharacters, homoglyphs, NUL, equals-in-name, final LF, sizes, unauthorized names; values never shell-interpreted — TC-035..037).
- Seeded scenarios verified against `doc/planning/oss-tooling/milestones/m1/test-scenarios.md:216..238`: every SC-M1-21 assert (env record as validated data → TC-034; per-profile blockers → TC-008/024; revert event → TC-026/050; judgment seats unchanged across rungs → TC-029; text-only refused regardless of position → TC-008; deepseek auto-selected → TC-024/049) and every SC-M1-22 assert (park cause+expiry → TC-022; switch event with revert condition → TC-024/049; no sleep-without-record → TC-049/052) is folded exactly as spec Appendix B and test plan §3.1 claim.
- Milestone-exit treatment is explicit and honest in all four artifacts: AC-F8-8's own parenthetical "(Milestone-scoped; not gated on this change's merge alone.)", DEC-4, RSK-6; test plan GAP-T1 with the invariant-test-rule rationale and TC-058 marked "Covered for machinery/seam; TODO (external)"; plan task 7.4 records the delegation and task 9.5 records the external obligations for PR review. Not silently reinterpreted as satisfied.
- Pinned decisions carried faithfully into spec §15 (DEC-1..DEC-4 carry the ticket's four pinned bullets substance-verbatim, including "the field is what the engine enforces, not a naming convention") and into the plan header invariants plus per-phase tasks; the four delivery decisions named by the PM (goal-priority declared order = precedence closing OQ-T2/GAP-T4; legacy hook byte-unchanged with a structural assertion in plan task 8.6; fixture-proven vendor mappings; empty-by-default profiles mirroring the shipped engine rule) are all recorded, none invented silently.
- Counts recomputed: 58/58 TCs each present exactly once in §5.1, §5.2, and the §7 automation table — no orphans; every one of the 9 ACs owns ≥1 declaring TC (§3.1), capability-level TCs (006/007/015/039..043/046) are owned by F-/NFR- IDs as declared, and all 11 NFRs own TCs. Hermeticity is enforced structurally: §6 + TC-054 + plan task 8.1 (globalThis.fetch throws if reached; clock/sleep/transport/credential/state injected; zero live network/credentials/sleeps).
- Plan validator independently re-run against the artifact (core `validatePlan` with the proper read/parseYaml ports): `verdict: "valid"`, `readyForDevelopment: true` — confirms the pm-notes claim. All 58 TCs mapped onto Phases 1-9 with split-half completing-phase discipline (TC-003, 007, 021, 038, 045, 053, 055); phase order respects dependencies (contracts → config → selection → lifecycle/pacing → watch → CLI → spawn seam → cross-cutting → finalize) and matches test-plan §7 implementation order with the two documented reconciliation notes.
- Plan code-reality facts verified against the live tree, all accurate: `packages/core/src/provider/{engine,chain,conditions,parks,peak,quota,validate,announcements}.ts`, `packages/core/src/config/{catalog,defaults,schema,provenance,resolver}.ts`, `packages/core/src/contracts/{provider,error-table,credentials}.ts`, `packages/adapters/src/provider-quota/` (existing dir; the three normalizers are new files inside the already-admitted confinement entry), `packages/cli/src/commands/provider.ts` + `classify.ts`, `packages/core/src/domain/harness-spawn-env.ts`, all referenced existing suites (`provider-parks`, `provider-chain-resolution`, `provider-quota-evaluation`, `provider-cli`, `config-schema`, `harness-spawn-env`, `provider-legacy-parity` — the GH-182 in-repo battery whose absence for GH-234 grounds DEC-5/OQ-3), structure tests (`provider-contract`, `provider-surface`, `error-table`, `inventory.json`, `content-inventory`), checks (`error-table-sync`, `secret-read-boundary`, `ambient-globals`, `workspace-entrypoints`), `tests/boundaries/`, `tests/golden/`, `tests/fixtures/state/harness.ts`, `tests/fixtures/provider/contract-inventory.json`, `scripts/.tests/test-hook-regression.sh`, `scripts/ceo-loop.sh`.
- System-spec consistency verified directly: `feature-provider-engine.md:262` explicitly excludes model-profile selection and non-UTC timezones; `:304` "No chain is enabled by default, so resolve fails closed until a chain is declared" — DEC-9 mirrors the delivered precedent; `:316` snapshot-mapping-with-fixtures and guarded-set growth rules — F-5/F-10/DEC-8 follow them; `feature-harness-adapters.md:195` excludes model profiles (M1-S21) and `:40` provides the deny-by-default spawn-env seam this change consumes.
- The envRecord structured-vs-serialized question (the flagged contradiction candidate) is explicitly reconciled in the plan header as a delivery decision, matches the man page example (`provider.md:88..89` renders `envRecord` as a name→value map with `recordFormat: "data-v1"`), and both directions are tested (envelope: TC-044 step 4 / plan task 6.2; serialized grammar: TC-035..037 / plan task 7.1/7.5). Grammar lines `provider.md:13..15` match spec F-9/Appendix C and plan task 6.1 exactly.
- Out-of-scope exclusions present in all three artifacts for the big four: dispatch daemon M1-S9 (spec NG-1/§7.2, test plan §1.2 OUT, plan PM decision + task 7.2), audit ledger M1-S22 (NG-2, GAP-T1, tasks 7.4/9.5), spend M1-S19 (NG-3, §1.2 OUT, task 3.4 "no exporter ships here"), legacy hook modification (NG-6, GAP-T3, tasks 7.2/8.6). Non-UTC windows: excluded in spec NG-4 and test plan §1.2; the plan is silent (finding 1 — minor, inherited via engine-v1 reuse).
- DoD defined and testable: 9 Given/When/Then ACs, 12 KPI rows, 11 measurable NFRs; plan Phase 9 `doneArtifacts` (CI matrix green on the PR targeting main-tools; dod_check pass; PR at phase 11) plus task 9.6's PR-readiness checklist (all 9 ACs → green TCs, 11 NFRs measured, exactly one changeset, residuals surfaced for the reviewer).

## Findings

1. [minor] cross_artifact_consistency — chg-GH-234-plan.yaml header "Invariants carried by every phase"
   Gap: the non-UTC/local-timezone window exclusion (spec NG-4, test plan §1.2 OUT, feature-provider-engine.md:262) is not restated in the plan; the UTC basis is only implicit through "the engine v1 vocabulary ... is reused, never forked". No scope-creep risk exists (no task touches timezone handling; Phase 4 reuses the engine's UTC peak/park machinery), but the exclusion contract is otherwise tri-artifact.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add one invariant line to the plan header ("windows and expiries are UTC-only per NG-4; engine v1 basis unchanged"). Editorial; may land as a plan-header amendment with the Phase-1 commit.

2. [minor] decision_capture — chg-GH-234-plan.yaml header PM decision (pacing precedence) vs chg-GH-234-spec.md §8.3 DM-5 and chg-GH-234-pm-notes.yaml
   Gap: the pacing goal-priority precedence pin (declared order = precedence, first declared wins, duplicates invalid) is recorded in the plan header and summarized in a pm-notes info note, but not as a pm-notes `decisions:` entry, and spec DM-5/F-7 remain silent on precedence. The test plan explicitly authorized pinning "in delivery planning or by a decision record" (OQ-T2), so the placement is legitimate and TC-031 is finalized against it; this is capture asymmetry only — a future reader of the spec alone still finds precedence unpinned.
   Suggested remediation target phase: specification
   Suggested fix: at the next spec revision (or doc-sync), add one line to DM-5 / a DEC-10 recording declared-order precedence; optionally mirror the decision in the pm-notes `decisions:` list for symmetry with the other PM decisions.

3. [nit] ac_quality — chg-GH-234-spec.md Appendix C / §8.3 DM-7 vs chg-GH-234-plan.yaml header (envelope representation)
   Gap: the spec does not state whether the envelope `envRecord` is the structured name→value map or the serialized data-v1 grammar; the plan pinned it (envelope = structured record with `recordFormat: "data-v1"`; serialized grammar = wrapper-consumed wire form validated byte-level) per the man page, and both directions are tested.
   Suggested remediation target phase: specification
   Suggested fix: one clarifying sentence in Appendix C (and/or DM-7) naming the two representations and their consumers; delivery proceeds on the plan pin.

## Residual Risks to Track (non-blocking, recorded decisions/open questions — not gate failures)

- External legacy resolver battery absent from the repo (OQ-3 / OQ-T5): DEC-5 defines the ported table by the ticket-enumerated five groups; the owner may surface an external battery at PR review, which extends the mapping (RSK-3). Divergence from SC-M1-21/22 after delivery remains a defect.
- Tier naming (lite/regular/powerful) is delivery-bound pending the naming lock (OQ-1 / OQ-T3 / GAP-T5); tests use fixture-declared names.
- NFR-6's 50 ms bound is reference-environment class (GAP-T6); committed baseline + environment-independent no-I/O assertion is the mitigation — treat a marginal failure as investigate-first.
- Doc placement defaults to a new `doc/spec/features/feature-provider-profiles.md` at doc-sync (OQ-T7); `feature-provider-engine.md` is reconciled either way; final placement confirmed at lifecycle phase 7.
- AC-F8-8's milestone evidence (zero manual overrides in the final two-week window) rides M1-S9 (GH-239) and M1-S22 (GH-223); the change's own obligations are the seam proof (TC-058) and the honest external-evidence record (plan task 9.5).
- Vendor watch shapes are fixture-proven, not live-proven (GAP-T2 / RSK-2); live-shape drift is a review/operations concern — a missing fixture must fail naming itself, never weaken the assertion.
