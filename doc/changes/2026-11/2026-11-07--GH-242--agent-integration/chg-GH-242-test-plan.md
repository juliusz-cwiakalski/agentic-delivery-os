---
id: chg-GH-242-test-plan
status: Updated
created: 2026-11-07T00:00:00Z
last_updated: 2026-11-07T13:00:00Z
owners: [engineering]
service: delivery-os
labels: [m1, m1-s20, agent-integration, cli, prompts, documentation]
version_impact: minor
summary: "Seventy-two scenarios verifying GH-242: the executable bin/composition and self-description surface (uncomposed commands fail through the existing `fallback.internal` identity), phase and commit adoption, session-guard reversal, lifecycle staging and bidirectional ordering convergence, typed blockers, coordinator J1 loop, plan summary alignment, phase-owned prompt/doc/system-spec conformance against the §16.1.1 phrase table, key=value continuity, and a deterministic pilot J1 iteration with non-pilot and pilot safety scans split by owning phase."
links:
  change_spec: ./chg-GH-242-spec.md
  implementation_plan: ./chg-GH-242-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S20: Agent integration: prompts consume the tooling

## 1. Scope and Objectives

This plan protects the integration contract between the delivered typed primitives and the lifecycle prompts. Its core objective is to prove, mechanically, that coordination is a sequence of typed calls rather than prose discipline: no prompt writes phase state by hand, no lifecycle prompt hand-crafts a commit, every prompt-required command is discoverable through `--help` and a reference page, the bash-era key=value summaries still hold byte-for-byte, and one full J1 coordinator iteration runs on a fixture-backed pilot repository without any outbound tracker, CI, PR-platform, provider, or network call.

The highest-risk areas are prompt drift, the deliberate reversal of the GH-227 delivery-session refusal, the widened lifecycle staging scope, and the ordering change that must place the pm-notes transition inside the completion commit. The plan treats these as must-pass gates, not review notes.

### 1.1 In Scope

- The production entrypoint: a non-installed Bun bin entry mapped in the `bin` manifest, a `main`/composition entry, root help/version, per-command help, working-name resolution (configuration → `DELIVERY_OS_WORKING_NAME` → neutral `delivery-os`), and an honest prompt-required composition with `state`/`mcp`/`dispatch`/daemon asserted absent; an uncomposed invocation fails closed through the existing `fallback.internal` containment identity (platform category, `retryable: false`, `consequence: unknown`, platform-provider projection → exit `2`) with no new error-table row.
- Removal of the delivery-session refusal from `commit` and `phase complete`, retention of the sanitized one-shot context, and retirement of `commit.session.context-refused` across the machine table, documented table, corpora, fixtures, and sync check.
- Lifecycle completion staging (mapped plan scope union the change folder), standalone commit staging (plan union; plan-absent change folder), stray exclusion, and completion ordering convergence in **both** directions: post-commit/pre-document convergence and the reverse window (document written, commit act failed) with pre-write restore, failed-restore exit 2, and single-transition/single-commit retry.
- `phase complete` / `phase list` / `phase reopen` adoption, the pm-notes `notes:` PR URL record, and the thin `@committer`.
- Typed blocker adoption and the coordinator J1 sequence (`status` → `blockers answer` → `verify change`/`phase list` → `merge` → `closeout --apply` → `queue plan --next N`).
- Optional `phases[].summary`, the no-`tasks` rule, and progress remaining in pm-notes `notes:`.
- Prompt/doc conformance scans, help/guide coverage, retained-vs-retired bash classification, `.ados-claude/**` freshness, secret scanning, and the four omitted current-truth feature specs (`feature-delivery-lifecycle`, `feature-quality-gates-and-pr`, `feature-autonomous-delivery`, `feature-local-code-review`) together with the phase-3 behavior-spec rows (`feature-commit-primitive` ordering/staging and `feature-pm-notes-lint-and-phase-transitions` ordering/staging), each asserted against the spec's §16.1.1 stale/required phrase table (AC-F8-5, NFR-13).
- Appendix A key=value byte-equality on `merge`, `queue`, `verify`, `plan`, and `blockers`, plus the retained `deliver-ticket.sh` and `ceo-loop.sh` summaries.
- The deterministic pilot J1 conformance suite over real state, git, files, envelopes, and exits, with tracker/CI/PR-platform/provider stubbed and clock/id generation stubbed or deterministically injected.

### 1.2 Out of Scope & Known Gaps

- **No prompt-execution harness exists.** Prompt behavior is verified by a deterministic text scan plus primitive-level behaviour tests; the plan does not claim that an agent runtime executes the prompt. This is a deliberate, named gap, mitigated by negative scan mutants and the pilot suite driving the same primitives.
- **`--help`/`--version` isolation is a deterministic gate, not a timing gate.** The hard assertions are zero state/network/git/configuration reads and zero writes, plus completion inside the suite's fixed `bun test` timeout. Wall-clock latency is recorded as informational only and is never used to pass or fail an AC (AC-NFR1-1, NFR-1, NFR-2). No production load test is claimed.
- **"Executable" is the non-installed bin plus the `main`/composition entry.** The bin is a Bun-shebang file mapped in `packages/cli/package.json`; the in-process `runCli` surface is not sufficient evidence. A built-artifact smoke test is supplemental; the structural bin/manifest assertion is the AC evidence (AC-F1-7, DEC-14).
- **`dispatch` (M1-S9) and the resident daemon (M1-S18)** are not delivered and are not tested as features; the plan asserts that the entrypoint does not compose them and no prompt claims them (AC-F1-6, AC-F6-3).
- **Installer, packaging, and release behavior** are unchanged; the plan asserts absence and existing install-test parity, not new install functionality.
- **New tracker integrations, MCP parity, memory commands, state migrations, and `phase start`** are out of scope.
- **`tasks` unknown-key policy** is not asserted as a rejection; the plan asserts that absence is valid and that no consumer or prompt requires the key. See OQ-T2.
- **Legacy markdown plan reading** is unchanged except that it must not regress; existing `plan-legacy.test.ts` remains the regression control.

### 1.3 Risk-Based Prioritization

**Must-pass (AC-gating).** These scenarios are the primary or sole evidence for an acceptance criterion or a ticket acceptance criterion. A failure blocks delivery:

- `TC-ENTRY-001`, `TC-ENTRY-002`, `TC-ENTRY-004`, `TC-ENTRY-005`, `TC-ENTRY-006`, `TC-ENTRY-007`, `TC-ENTRY-008`, `TC-ENTRY-009`, `TC-ENTRY-010`
- `TC-SESS-001`, `TC-SESS-002`, `TC-SESS-004`, `TC-SESS-005`
- `TC-ERRROW-001`, `TC-ERRROW-002`, `TC-ERRROW-003`, `TC-ERRROW-004`
- `TC-STAGE-001` through `TC-STAGE-007`, `TC-STAGE-009`, `TC-STAGE-010`
- `TC-PLANSUM-001` through `TC-PLANSUM-005`
- `TC-PSCAN-001` through `TC-PSCAN-010`
- `TC-HELP-001`, `TC-HELP-002`
- `TC-DOCREC-001`, `TC-DOCREC-002`, `TC-DOCREC-003`, `TC-DOCREC-004`
- `TC-KEYVAL-001` through `TC-KEYVAL-007`
- `TC-ADOPT-001`
- `TC-COORD-001`, `TC-COORD-002`, `TC-COORD-003`
- `TC-BLKADOPT-001`, `TC-BLKADOPT-002`, `TC-BLKADOPT-003`
- `TC-PILOT-001` through `TC-PILOT-006`

**Nice-to-have (supplemental).** These scenarios improve diagnosis, guard against over-generalization, or add a control where the AC already has primary evidence. They are tracked and expected to pass, but a failure in one of them does not by itself reopen an AC unless it exposes a real behavioral gap:

- `TC-ENTRY-003` — root help is also exercised by `TC-ENTRY-004` and `TC-ENTRY-006`; keep it for diagnosis.
- `TC-SESS-003` — the in-session/out-of-session parity control; the AC is carried by `TC-SESS-001` and `TC-SESS-002`.
- `TC-STAGE-008` — the existing exclusion control under the widened scope; it protects NFR-9 but does not add a new AC.
- `TC-HELP-003` — reference-page parity is a quality control; `TC-HELP-001` carries the coverage AC.
- `TC-ADOPT-002` — role purity is a supporting control for `TC-ADOPT-001` and `TC-PSCAN-002`.

Phase independence rule: each plan phase must be green on its own. Phase 2 proves only guard removal, the sanitized one-shot, and error-row retirement; phase 3 owns artifact/pm-notes staging, both ordering windows, and the §16.1.1 behavior-spec rows it reconciles (`feature-commit-primitive` ordering/staging and `feature-pm-notes-lint-and-phase-transitions` ordering/staging). Phase 4 proves the plan contract/validator/template/plan-writer plus code/template consumers; the coder/PM/run-plan prompt scan is phase 5/8. Phase 7 proves only the guides/man page/reference pages it updates; full feature-spec conformance is phase 10. Phase 8 proves the non-pilot conformance scans and key=value goldens, scanning `.opencode/**` and the phase-7 updated guides/man/reference pages but never `doc/spec/features/**`; phase 9 proves the pilot and re-runs the privacy/safety scan over the pilot fixtures it creates; phase 10 proves final plugin freshness, full feature-spec conformance against the §16.1.1 phrase table, and the aggregate gate.

The change is delivered as one PR (DEC-15); the phase split above is sequencing, not a delivery split. The foundation phases 1–5 remain the first reviewable commits, and the pilot suite is the end-to-end gate.

## 2. References

- Change specification: [chg-GH-242-spec.md](./chg-GH-242-spec.md)
- Implementation plan: [chg-GH-242-plan.yaml](./chg-GH-242-plan.yaml) (phases 1–10; phase order per DEC-15)
- Repository testing strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md)
- TypeScript workspace rules: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md)
- Ticket scope and AC: [backlog.md, M1-S20](../../../planning/oss-tooling/backlog.md)
- Decision record: [TDR-0013-agent-session-commit-guard-reversal.md](../../../decisions/TDR-0013-agent-session-commit-guard-reversal.md)
- M1 command reference pages: `doc/planning/oss-tooling/milestones/m1/commands/*.md` and `doc/planning/oss-tooling/milestones/m1/man-page.md`
- Affected system specs: `doc/spec/features/feature-commit-primitive.md`, `feature-pm-notes-lint-and-phase-transitions.md`, `feature-plan-schema.md`, `feature-blockers.md`, `feature-status-digest.md`, `feature-brief.md`, `feature-merge-verify-deploy.md`, `feature-closeout.md`, `feature-scheduling-engine.md`, `feature-result-contract.md`, `feature-agents-and-commands.md`, plus the four omitted current-truth pages `feature-delivery-lifecycle.md`, `feature-quality-gates-and-pr.md`, `feature-autonomous-delivery.md`, and `feature-local-code-review.md`, all asserted against the §16.1.1 stale/required phrase table (AC-F8-5, NFR-13).
- Acceptance criteria, §17.1 Definition of Done (DoD-1..DoD-20), and Appendix C ticket-AC traceability: sections 17 and 24 of the change spec.
- Appendix A key=value register, Appendix B retained/retired entry points, Appendix D pilot stub/real matrix: section 24 of the change spec.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | `--version` prints injected identity, exits 0, no state/network/git write | TC-ENTRY-001 | Covered |
| AC-F1-2 | Every prompt-required command `--help` has usage, options, example, exit codes, see-also | TC-ENTRY-003, TC-ENTRY-004, TC-ENTRY-006 | Covered |
| AC-F1-3 | No seed literal in `packages/**`; configured/override identity renders; neither source renders neutral `delivery-os` | TC-ENTRY-002, TC-ENTRY-007 | Covered |
| AC-F1-4 | The bin/entrypoint is not added to the installer; installer tests unchanged | TC-ENTRY-008 | Covered |
| AC-F1-5 | Help/version succeed with no config, project checkout, or override and render the neutral default | TC-ENTRY-005, TC-ENTRY-006 | Covered |
| AC-F1-6 | Composition is exactly §8.1; `state`, `mcp`, `dispatch`, daemon absent; an uncomposed invocation returns the existing `fallback.internal` identity (platform, `retryable: false`, `consequence: unknown`, exit 2) naming the missing composition, with no new error-table row | TC-ENTRY-009 | Covered |
| AC-F1-7 | Non-installed Bun bin mapped in `bin` alongside `main`/composition; bin invokes the composition; absent from the installer | TC-ENTRY-010, TC-ENTRY-008 | Covered |
| AC-F2-1 | Zero prompt instructions that write phase timestamps or `phases.pr_creation.url` | TC-PSCAN-001 | Covered |
| AC-F2-2 | In-session phase completion lands the transition; pm-notes transition and artifacts are in the commit; no refusal | TC-SESS-002, TC-STAGE-001, TC-STAGE-003, TC-STAGE-006, TC-STAGE-007, TC-STAGE-009 | Covered |
| AC-F2-3 | PR URL is a pm-notes `notes:` entry; `phases.pr_creation.url` is not written | TC-PSCAN-008 | Covered |
| AC-F2-4 | Reverse window: no transition/commit lands (HEAD and commit count unchanged; no reachable commit object; object-database absence is not asserted), pre-write bytes restored, failed restore exits 2, retry yields one transition and one commit | TC-STAGE-009, TC-STAGE-010 | Covered |
| AC-F3-1 | Zero `git add` / `git commit` / hand-crafted commit instructions | TC-PSCAN-002, TC-ADOPT-002 | Covered |
| AC-F3-2 | `@committer` invokes `commit`, reports the envelope, performs no direct staging/commit | TC-PSCAN-007, TC-ADOPT-001 | Covered |
| AC-F3-3 | Completion stages mapped plan scope union change folder; unrelated strays stay unstaged | TC-STAGE-001, TC-STAGE-002, TC-STAGE-003, TC-STAGE-004 | Covered |
| AC-F3-4 | Plan-absent standalone `commit` stages the change folder; strays are not staged and are disclosed | TC-STAGE-005 | Covered |
| AC-F4-1 | In-session `commit`/`phase complete` do not return `commit.session.context-refused` | TC-SESS-001, TC-SESS-002, TC-SESS-003, TC-SESS-005, TC-ERRROW-001 | Covered |
| AC-F4-2 | Harness one-shot runs in temp empty context, sanitized env, no session facts, removed after | TC-SESS-004 | Covered |
| AC-F4-3 | TDR records the reversal and supersedes GH-227 DEC-6; spec references the ID | TC-ERRROW-004 | Covered |
| AC-F5-1 | Lanes publish closed-type blockers; do not write pm-notes `blockers:` | TC-BLKADOPT-001 | Covered |
| AC-F5-2 | Coordinator reads questions from status/blockers and answers as data with `applied` posture | TC-BLKADOPT-002 | Covered |
| AC-F5-3 | Credential question carries only the variable name; the channel refuses a value | TC-BLKADOPT-003 | Covered |
| AC-F6-1 | `pr-open` finalization uses `verify change`/`phase list` and `merge`, not `gh pr merge` | TC-COORD-002 | Covered |
| AC-F6-2 | Full J1 sequence and no `gh pr list`/`gh pr merge` primary path | TC-COORD-001, TC-PILOT-002 | Covered |
| AC-F6-3 | Retained `deliver-ticket.sh`/`ceo-loop.sh`; no dispatch/daemon claims | TC-COORD-003, TC-PSCAN-004 | Covered |
| AC-F6-4 | `queue plan --next N` nextActions/reasons drive the next pick | TC-COORD-003, TC-PILOT-002 | Covered |
| AC-F7-1 | Optional `phases[].summary` accepted/echoed; omission remains valid | TC-PLANSUM-001, TC-PLANSUM-002 | Covered |
| AC-F7-2 | No `tasks` consumer; no prompt writes progress into the plan; progress stays in pm-notes `notes:` | TC-PLANSUM-003, TC-PLANSUM-005 | Covered |
| AC-F7-3 | Plan writer emits `delivery.plan.v1` with declared phases/scope, no task log | TC-PLANSUM-004 | Covered |
| AC-F8-1 | Coverage matrix: every prompt-required command has `--help` and a reconciled reference page | TC-HELP-001, TC-HELP-002, TC-HELP-003 | Covered |
| AC-F8-2 | Every prompt typed invocation is in the allowed set and covered | TC-PSCAN-003, TC-HELP-001 | Covered |
| AC-F8-3 | No retired bash entry point is a primary path; retained paths are classified | TC-PSCAN-004, TC-DOCREC-002 | Covered |
| AC-F8-4 | `.ados-claude/**` regenerated and byte-current | TC-DOCREC-001 | Covered |
| AC-F8-5 | Every row in the §16.1.1 stale/required phrase table, including the phase-3 behavior-spec rows, the four omitted feature specs, and the generic behavioral-primitives row, contains no stale phrase and contains its required replacement | TC-DOCREC-002, TC-DOCREC-003, TC-DOCREC-004 | Covered |
| AC-F9-1 | `merge`, `queue`, `verify`, `plan`, `blockers` key=value goldens byte-identical | TC-KEYVAL-001, TC-KEYVAL-002, TC-KEYVAL-003, TC-KEYVAL-004, TC-KEYVAL-005, TC-KEYVAL-007 | Covered |
| AC-F9-2 | Registered keys present on replaced surfaces; retained `deliver-ticket.sh` keys unchanged | TC-KEYVAL-006, TC-KEYVAL-007 | Covered |
| AC-F10-1 | Pilot drives status → blockers answer → merge → closeout → queue plan with expected next ref | TC-PILOT-001, TC-PILOT-002, TC-PILOT-006 | Covered |
| AC-F10-2 | Double run byte-identical with fixed clock/ids, no sleeps, bounded step/retry budget; zero outbound tracker/CI/provider/network calls; fixed runner timeout with no wall-clock assertion | TC-PILOT-004, TC-PILOT-005, TC-PILOT-006 | Covered |
| AC-F10-3 | State, git, files, envelopes real; clock and ids stubbed or deterministically injected; only tracker/CI/PR-platform/provider stubbed | TC-PILOT-001, TC-PILOT-003 | Covered |
| AC-NFR1-1 | Help/version record zero state/network/git/configuration reads and zero writes and complete inside the fixed suite timeout; timing informational | TC-ENTRY-006 | Covered |
| AC-NFR3-1 | Conformance scans deterministic; identical counts; zero ambient reads | TC-PSCAN-005, TC-PILOT-005 | Covered |
| AC-NFR9-1 | Zero secret-shaped findings in prompts/guides/fixtures/pilot data; commit safety scan unchanged | TC-PSCAN-006, TC-PSCAN-009, TC-PSCAN-010, TC-BLKADOPT-003 | Covered |

#### 3.1.1 Ticket AC Coverage

This table mirrors the spec's Appendix C exactly: six ticket-AC rows, with the first ticket clause kept as two obligations (phase-state writes and hand-crafted commits) because the ticket groups them in one sentence.

| Ticket AC (Appendix C row) | Spec coverage | Primary evidence |
|---|---|---|
| No lifecycle agent instruction writes phase state by hand | F-2; AC-F2-1, AC-F2-2, AC-F2-3, AC-F2-4 | TC-PSCAN-001, TC-SESS-002, TC-STAGE-006, TC-STAGE-009, TC-STAGE-010, TC-ADOPT-001 |
| No lifecycle agent instruction hand-crafts a commit for a phase transition | F-3, F-5; AC-F3-1, AC-F3-2, AC-F3-3, AC-F3-4 | TC-PSCAN-002, TC-PSCAN-007, TC-ADOPT-001, TC-ADOPT-002, TC-STAGE-001, TC-STAGE-005, TC-STAGE-006 |
| Every tool call the prompts require has `--help` and a guide | F-1, F-9; AC-F1-2, AC-F1-6, AC-F1-7, AC-F8-1, AC-F8-2 | TC-ENTRY-004, TC-ENTRY-009, TC-ENTRY-010, TC-HELP-001, TC-HELP-002, TC-HELP-003, TC-PSCAN-003 |
| No prompt references a retired bash entry point as the primary path | F-9, Appendix B; AC-F8-3, AC-F6-3 | TC-PSCAN-004, TC-COORD-003, TC-DOCREC-002 |
| The bash-continuity key=value machine summaries are preserved on every replaced surface | F-11, Appendix A; AC-F9-1, AC-F9-2 | TC-KEYVAL-001 through TC-KEYVAL-007 |
| End-to-end: a coordinator session completes one full J1 iteration using only the tooling primitives on a pilot repository | F-10; AC-F10-1, AC-F10-2, AC-F10-3 | TC-PILOT-001 through TC-PILOT-006 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

There are no new `API-#` or `EVT-#` identifiers in this change. The CLI invocation contract, the state records, and the text surfaces are the interfaces under test.

| Interface | Element | TC ID(s) | Evidence |
|---|---|---|---|
| DM-1 | `delivery.plan.v1` optional `phases[].summary` | TC-PLANSUM-001, TC-PLANSUM-002, TC-PLANSUM-004 | Validation echo from `tests/fixtures/plan/summary/`; omission-valid fixture; commit subject consumes the summary |
| DM-2 | pm-notes PR URL `notes[]` entry | TC-PSCAN-008 | pm-notes note accepted; no `phases.pr_creation.url` write |
| DM-3 | `commit` error-domain row retirement | TC-ERRROW-001, TC-ERRROW-002, TC-ERRROW-003 | Five machine rows; documented table sync; `true-positives.json` no longer names the code; temp-copy re-introduction mutants fail the sync scan |
| Appendix A | `merge`, `queue`, `verify`, `plan`, `blockers`, `deliver-ticket.sh`, `ceo-loop.sh` key=value register | TC-KEYVAL-001 through TC-KEYVAL-007 | Byte equality and register completeness |
| Appendix B | Retained vs retired entry points | TC-PSCAN-004, TC-COORD-003 | Scan classification and retained labels |
| Appendix D | Pilot stub/real matrix (clock and ids stubbed or deterministically injected) | TC-PILOT-003 | Port call recording versus real state/git/files/envelopes |
| Section 8.1 | Allowed prompt-required command set, with `state`/`mcp`/`dispatch`/daemon absent | TC-ENTRY-004, TC-ENTRY-009, TC-PSCAN-003, TC-HELP-001 | Composition absence assertions, scan, and coverage matrix |
| Error table (containment) | Existing `fallback.internal` identity for uncomposed commands; no new row | TC-ENTRY-009, TC-ERRROW-002 | Uncomposed invocation returns platform/`retryable: false`/`consequence: unknown`/exit 2 with a summary naming the missing composition; the documented-table count does not change for composition |
| Package manifest | Non-installed Bun `bin` entry plus `main`/composition entry | TC-ENTRY-010, TC-ENTRY-008 | Manifest/tree assertion and installer-absence check |
| Section 8.2 | Existing `phase.transition` and `commit.telemetry` records | TC-PILOT-006 | Records appended and read with expected identities |
| Section 8.4 | Harness one-shot sanitized context | TC-SESS-004 | Temp empty directory, sanitized env, cleanup |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Self-description isolation and deterministic completion | TC-ENTRY-001, TC-ENTRY-003, TC-ENTRY-005, TC-ENTRY-006 | Covered |
| NFR-2 | Entrypoint composition honesty and neutral startup identity | TC-ENTRY-002, TC-ENTRY-007, TC-ENTRY-009, TC-ENTRY-010 | Covered |
| NFR-3 | Conformance determinism | TC-PSCAN-005, TC-PILOT-005 | Covered |
| NFR-4 | Prompt invariants: no raw git, no hand-written phase state, no retired primary path | TC-PSCAN-001, TC-PSCAN-002, TC-PSCAN-004 | Covered |
| NFR-5 | Help/guide coverage 100% | TC-HELP-001, TC-HELP-002, TC-HELP-003, TC-PSCAN-003 | Covered |
| NFR-6 | Key=value continuity, byte-identical goldens | TC-KEYVAL-001 through TC-KEYVAL-007 | Covered |
| NFR-7 | Pilot determinism, fixed or deterministically injected clock/ids, zero network | TC-PILOT-003, TC-PILOT-004, TC-PILOT-005 | Covered |
| NFR-8 | Pilot boundedness and determinism: fixed clock/ids, no sleeps, bounded step/retry budget, zero outbound calls, byte-identical replay, fixed test-runner timeout; wall-clock duration informational only | TC-PILOT-005, TC-PILOT-006 | Covered |
| NFR-9 | No secrets in prompts/guides/fixtures; safety scan unchanged | TC-PSCAN-006, TC-PSCAN-009, TC-PSCAN-010, TC-STAGE-008, TC-BLKADOPT-003 | Covered |
| NFR-10 | Brand neutrality, no seed literal in `packages/**` | TC-ENTRY-002, TC-ENTRY-007 | Covered |
| NFR-11 | Backward compatibility outside declared changes | TC-KEYVAL-001 through TC-KEYVAL-006, plus the full `pnpm check` regression | Covered |
| NFR-12 | Generated-plugin freshness | TC-DOCREC-001 | Covered |
| NFR-13 | Current-truth reconciliation: every row in the §16.1.1 stale/required phrase table (the single source for the scan) has its stale phrase absent and its required replacement present; rows outside the table carry only the §16.1 scope obligation | TC-DOCREC-002, TC-DOCREC-003, TC-DOCREC-004 | Covered |

## 4. Test Types and Layers

| Layer | Framework / location | Purpose in this change |
|---|---|---|
| Structure / unit | `bun:test`, `tests/structure/*.test.ts` | Contract shape, error-table membership, package composition, brand-literal absence, component inventory. |
| Repository invariants | `scripts/checks/*.ts` with `bun run`, mutation-tested by `tests/checks/*.test.ts` | Prompt/doc conformance, help/guide coverage, reference-page parity, doc conformance, key-register completeness. |
| Behaviour | `bun:test`, `tests/behaviour/*.test.ts`, in-process `runCli` with injected dependencies | Entrypoint help/version, commit/phase adoption, staging, ordering, convergence, plan summary, blockers, harness context. |
| Golden | `bun:test`, `tests/golden/*.test.ts` over committed fixtures | Byte-pinned key=value text for merge, queue, verify, plan, blockers, and the retained summaries. |
| Conformance / integration | `bun:test`, `tests/conformance/pilot/*.test.ts` | Full J1 pilot iteration with real state/git/files/envelopes and stubbed external surfaces. |
| Shell | `bash scripts/.tests/test-*.sh` | Installer parity, generated-plugin freshness, retained `deliver-ticket.sh`/`ceo-loop.sh` key=value output. |
| Manual | Review checklist in the PR | TDR presence and prose quality; reference-page readability; no secret-shaped examples. |

Test IDs follow the `TC-FEATURE-NNN` pattern. Each test file carries the TC IDs in its header comment, as the existing suites do (for example `tests/behaviour/commit-session-guard.test.ts`), so the traceability survives file moves. Fixtures are never named `*.test.ts`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Test Level | Priority | AC Coverage |
|---|---|---|---|---|---|
| TC-ENTRY-001 | `--version` renders injected identity without side effects | Happy Path | Behaviour | High | AC-F1-1 |
| TC-ENTRY-002 | Configured, override, and neutral-default identities render without a seed literal | Edge Case | Behaviour | High | AC-F1-3, NFR-10 |
| TC-ENTRY-003 | Root `--help` lists families and global flags | Happy Path | Behaviour | High | AC-F1-2 |
| TC-ENTRY-004 | Every prompt-required command and subcommand has man-page-grade help (phase-1 static help coverage) | Happy Path | Behaviour | High | AC-F1-2, AC-F8-1 |
| TC-ENTRY-005 | Help and version succeed without config/project and render the neutral default | Edge Case | Behaviour | High | AC-F1-5 |
| TC-ENTRY-006 | Help and version perform zero reads/writes inside the fixed timeout | Negative | Behaviour | High | AC-F1-2, AC-F1-5, AC-NFR1-1, NFR-1 |
| TC-ENTRY-007 | No seed literal in `packages/**`; brand arrives only through the seam | Negative | Structure | High | AC-F1-3, NFR-10 |
| TC-ENTRY-008 | The bin/entrypoint is absent from the installer | Regression | Integration | High | AC-F1-4, AC-F1-7 |
| TC-ENTRY-009 | Composition is exactly §8.1; state/mcp/dispatch/daemon absent; uncomposed invocation fails closed | Corner Case | Behaviour | High | AC-F1-6, NFR-2, DEC-13 |
| TC-ENTRY-010 | Non-installed Bun bin plus `main` composition is mapped and invokes the composition | Happy Path | Structure | High | AC-F1-7, DEC-14, NG-2 |
| TC-SESS-001 | In-session standalone `commit` lands under normal rules | Happy Path | Behaviour | High | AC-F4-1 |
| TC-SESS-002 | In-session `phase complete` records the transition with and without a commit (phase-2 half) | Happy Path | Behaviour | High | AC-F4-1, AC-F2-2 |
| TC-SESS-003 | In-session and out-of-session behavior are otherwise identical | Regression | Behaviour | Medium | AC-F4-1 |
| TC-SESS-004 | The sanitized one-shot context is retained | Regression | Behaviour | High | AC-F4-2 |
| TC-SESS-005 | No `commit.session.context-refused` code path remains | Negative | Structure | High | AC-F4-1 |
| TC-ERRROW-001 | Machine table carries five `commit` rows and no retired row | Happy Path | Structure | High | AC-F4-1, DM-3 |
| TC-ERRROW-002 | Documented table and sync check agree with the machine table | Happy Path | Structure | High | DM-3 |
| TC-ERRROW-003 | Retired code is absent from the corpus and re-introduction fails the sync scan | Negative | Structure | High | DM-3 |
| TC-ERRROW-004 | TDR-0013 records the reversal and the GH-227 supersession | Happy Path | Structure | High | AC-F4-3 |
| TC-STAGE-001 | Completion stages plan scope union the change folder | Happy Path | Behaviour | High | AC-F3-3, AC-F2-2 |
| TC-STAGE-002 | Unrelated strays stay unstaged and are disclosed | Negative | Behaviour | High | AC-F3-3 |
| TC-STAGE-003 | A planning phase with no plan stages the change folder | Corner Case | Behaviour | High | AC-F3-3, AC-F2-2 |
| TC-STAGE-004 | A delivery phase maps to every delivery-kind plan phase | Happy Path | Behaviour | High | AC-F3-3 |
| TC-STAGE-005 | Standalone commit keeps plan union; plan-absent stages the change folder | Corner Case | Behaviour | High | AC-F3-4 |
| TC-STAGE-006 | The pm-notes transition is inside the completion commit | Happy Path | Behaviour | High | AC-F2-2 |
| TC-STAGE-007 | A failed document write after a landed commit converges without a second commit | Negative | Behaviour | High | AC-F2-2 |
| TC-STAGE-008 | Forbidden and binary exclusions still apply | Negative | Behaviour | Medium | F-5, NFR-9 |
| TC-STAGE-009 | A failed commit act after the document write restores the pre-write bytes and retry converges | Negative | Behaviour | High | AC-F2-2, AC-F2-4 |
| TC-STAGE-010 | A failed restoration exits 2 with a classified fault and reconciliation instruction | Negative | Behaviour | High | AC-F2-4 |
| TC-PLANSUM-001 | Optional `summary` is accepted and echoed | Happy Path | Behaviour | High | AC-F7-1, DM-1 |
| TC-PLANSUM-002 | A plan without `summary` remains valid | Edge Case | Behaviour | High | AC-F7-1, DM-1 |
| TC-PLANSUM-003 | No code or template consumer requires `tasks`; progress stays out of the plan | Negative | Structure | High | AC-F7-2 |
| TC-PLANSUM-004 | Plan writer emits the schema and the commit path consumes `summary` | Happy Path | Behaviour | High | AC-F7-3, DM-1 |
| TC-PLANSUM-005 | No prompt writes `tasks` or plan progress into the plan | Negative | Structure | High | AC-F7-2 |
| TC-PSCAN-001 | Zero hand-written phase-state or PR-URL write instructions | Negative | Structure | High | AC-F2-1 |
| TC-PSCAN-002 | Zero raw `git add` / `git commit` / hand-crafted commit instructions | Negative | Structure | High | AC-F3-1 |
| TC-PSCAN-003 | Every prompt typed invocation is in the allowed set | Happy Path | Structure | High | AC-F8-2 |
| TC-PSCAN-004 | Retained versus retired bash classification is correct | Negative | Structure | High | AC-F8-3, AC-F6-3 |
| TC-PSCAN-005 | Scan mutants fail; scans are deterministic with zero ambient reads | Negative | Structure | High | AC-NFR3-1 |
| TC-PSCAN-006 | Prompt and guide secret scan reports zero findings | Negative | Structure | High | AC-NFR9-1 |
| TC-PSCAN-007 | `@committer` is a thin executor of `commit` | Happy Path | Structure | High | AC-F3-2 |
| TC-PSCAN-008 | The PR URL is a pm-notes note, not phase state | Happy Path | Structure | High | AC-F2-3, DM-2 |
| TC-PSCAN-009 | Non-pilot new fixtures carry no secrets and the commit safety scan is unchanged (phase 8) | Negative | Structure | High | AC-NFR9-1, NFR-9 |
| TC-PSCAN-010 | Pilot fixtures and suite data carry no secrets and the safety scan is unchanged (phase 9) | Negative | Structure | High | AC-NFR9-1, NFR-9 |
| TC-HELP-001 | Help and guide coverage matrix is complete | Happy Path | Structure | High | AC-F8-1 |
| TC-HELP-002 | A coverage-matrix mutation fails and names the missing obligation | Negative | Structure | High | AC-F8-1 |
| TC-HELP-003 | Reference pages match the delivered help surface | Regression | Structure | Medium | AC-F8-1, AC-F1-2 |
| TC-DOCREC-001 | Generated Claude plugin is byte-current | Regression | Integration | High | AC-F8-4 |
| TC-DOCREC-002 | Phase-7 guides, man page, and reference pages are reconciled | Regression | Structure | High | AC-F8-3, AC-F8-5, NFR-13 |
| TC-DOCREC-003 | Full feature-spec conformance against the complete §16.1.1 phrase table (phase 10) | Regression | Structure | High | AC-F8-5, NFR-13 |
| TC-DOCREC-004 | Phase-3 behavior-spec phrase-table rows are reconciled (commit ordering/staging and pm-notes phase transitions) | Regression | Structure | High | AC-F8-5, NFR-13 |
| TC-KEYVAL-001 | `merge` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-002 | `queue` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-003 | `verify` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-004 | `plan` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-005 | `blockers` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-006 | Retained `deliver-ticket.sh` and `ceo-loop.sh` summaries are unchanged | Regression | Golden | High | AC-F9-2 |
| TC-KEYVAL-007 | Appendix A register is complete and ordered | Negative | Golden | High | AC-F9-1, AC-F9-2 |
| TC-ADOPT-001 | PM, coder, and command prompts use `phase` and `commit` only | Happy Path | Structure | High | AC-F3-2, AC-F2-1, AC-F3-1 |
| TC-ADOPT-002 | Pure writers stay pure; `@pr-manager` never merges and never runs raw git | Negative | Structure | Medium | AC-F3-1, F-3 |
| TC-COORD-001 | J1 sequence is ordered and avoids raw merge/discovery | Happy Path | Structure | High | AC-F6-2 |
| TC-COORD-002 | `pr-open` finalization uses `verify` and `merge` | Happy Path | Structure | High | AC-F6-1 |
| TC-COORD-003 | Retained bash stays primary; `queue plan` next actions are consumed | Regression | Structure | High | AC-F6-3, AC-F6-4 |
| TC-BLKADOPT-001 | Lanes publish typed blockers and stop writing pm-notes `blockers:` | Happy Path | Structure | High | AC-F5-1 |
| TC-BLKADOPT-002 | The coordinator answers blockers as data | Happy Path | Behaviour | High | AC-F5-2 |
| TC-BLKADOPT-003 | Credential questions carry names only and values are refused | Negative | Behaviour | High | AC-F5-3 |
| TC-PILOT-001 | Pilot repository seeds real state, git, and files | Happy Path | Conformance | High | AC-F10-1, AC-F10-3 |
| TC-PILOT-002 | The full J1 sequence returns the expected next action | Happy Path | Conformance | High | AC-F10-1 |
| TC-PILOT-003 | The stub/real matrix matches Appendix D | Negative | Conformance | High | AC-F10-3 |
| TC-PILOT-004 | Zero outbound tracker, CI, PR-platform, provider, or network calls | Negative | Conformance | High | AC-F10-2 |
| TC-PILOT-005 | Two runs replay byte-identically | Regression | Conformance | High | AC-F10-2, AC-NFR3-1 |
| TC-PILOT-006 | Durable records, deterministic bounds, and cleanup hold | Happy Path | Conformance | Medium | AC-F10-1, AC-F10-2, NFR-8 |

**Scenario counts:** 72 total — ENTRY 10, SESS 5, ERRROW 4, STAGE 10, PLANSUM 5, PSCAN 10, HELP 3, DOCREC 4, KEYVAL 7, ADOPT 2, COORD 3, BLKADOPT 3, PILOT 6. Must-pass: 67; nice-to-have: 5.

### 5.2 Scenario Details

#### TC-ENTRY-001 - `--version` renders injected identity without side effects

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-1, NFR-10, DEC-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-version.test.ts`
**Tags**: @backend, @entrypoint

**Preconditions**:
- A synthetic `BrandIdentity` with binary name `example-product` and a fixed build/version string is injected through `CliDependencies`.
- Recording fakes for the state store, git seam, and network/provider ports count every call.

**Steps**:
1. Invoke the production entrypoint in process with `["--version"]`.
2. Assert the exit code, the rendered identity, and every recorder count.
3. Repeat with the state directory pointed at a non-existent path.

**Expected Outcome**:
- Exit `0`; stdout contains the injected binary name and build/version metadata.
- No seed-name literal appears in the output.
- State, git, and network counters remain zero; no file is created.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-version.test.ts` exits 0; any non-zero recorder count, missing identity, or seed literal fails the test.

#### TC-ENTRY-002 - Configured, override, and neutral-default identities render without a seed literal

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-10, DEC-14
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-version.test.ts`
**Tags**: @backend, @entrypoint, @branding

**Preconditions**:
- The entrypoint composes the brand in the declared order: typed configuration → non-empty `DELIVERY_OS_WORKING_NAME` override → neutral default `delivery-os`.
- The ambient environment is a synthetic record passed through injected dependencies, not `process.env`.

**Steps**:
1. Run `--version` with a configured working name and no override.
2. Run `--version` with `DELIVERY_OS_WORKING_NAME=alt-product` and the configuration name also present; assert the override wins.
3. Run `--version` with neither a configured name nor an override (and no config file).
4. Compare the rendered binary name and usage family label across all three runs.
5. Run the forbidden-literal scan over `packages/**` and assert the neutral default is not the seed literal.

**Expected Outcome**:
- The configured run renders the configured identity; the override run renders `alt-product` in the same positions.
- The neither-source run renders the neutral default `delivery-os`, succeeds, and does not fail with a missing-name error.
- The outputs differ only at the identity tokens; no seed literal is introduced anywhere.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-version.test.ts` exits 0; a missing override, a rejected neutral default, or a seed literal fails the run.

#### TC-ENTRY-003 - Root `--help` lists families and global flags

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-help.test.ts`
**Tags**: @backend, @entrypoint

**Preconditions**:
- The entrypoint is composed with recording state, git, and network ports.

**Steps**:
1. Run the entrypoint with `["--help"]`.
2. Assert the family list contains every prompt-required family and the global flags.
3. Assert the recorder counters and the filesystem snapshot.

**Expected Outcome**:
- Exit `0`; the output lists the command families, `--help`, `--version`, and the see-also pointer.
- No state, network, or git write occurs; no config file is required.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-help.test.ts` exits 0 and fails on any missing family or recorder count above zero.

#### TC-ENTRY-004 - Every prompt-required command and subcommand has man-page-grade help

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-9, AC-F1-2, AC-F8-1, NFR-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-help-coverage.test.ts`
**Tags**: @backend, @entrypoint, @docs

**Preconditions**:
- A committed fixture, `tests/fixtures/entrypoint/programs.ts`, exports the synthetic entrypoint programs, brand identities, and every invocation tuple from spec section 8.1: root `--version`, root `--help`, and each command/subcommand help path.
- The static coverage inventory `tests/fixtures/help-guide/coverage.json` exists in phase 1; it declares the invocation-to-help/reference-page obligation for every tuple but does not require the reference pages themselves to be reconciled yet.
- The expected help shape is usage, options, at least one example, exit codes, and a see-also pointer.

**Steps**:
1. Iterate the fixture and invoke each tuple with `--help`.
2. Assert the exit code and the five required sections in each output.
3. Assert every example is syntactically accepted by the parser in a no-write dry run.
4. Assert every see-also target maps to a row in the static `tests/fixtures/help-guide/coverage.json` inventory. Do not read or require the reconciled reference pages here; page existence and content parity are `TC-HELP-001`/`TC-HELP-003` in phases 7/8.

**Expected Outcome**:
- All tuples exit `0` and carry the five required sections.
- Examples parse without `fallback.invocation`.
- Every see-also target has an inventory row; no tuple is missing.
- Phase 1 requires no phase-7/8 artifact and no reconciled reference page.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-help-coverage.test.ts` exits 0; the failure message names the invocation tuple, the missing section, or the missing inventory row.

#### TC-ENTRY-005 - Help and version succeed without config/project and render the neutral default

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-5, NFR-1, DEC-14
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-help-isolation.test.ts`
**Tags**: @backend, @entrypoint

**Preconditions**:
- A fresh temporary directory with no `.git`, no configuration file, no state directory, and no `package.json`.
- `DELIVERY_OS_WORKING_NAME` is unset in the injected environment record.
- The process working directory is set to that directory for the invocation.

**Steps**:
1. Run `--help` and `--version` from the empty directory.
2. Assert both render the neutral default `delivery-os` identity and exit 0.
3. Repeat with an unreadable configuration file present.
4. Assert the exit codes and outputs.

**Expected Outcome**:
- Both invocations exit `0` and render the neutral default identity, not a configuration error.
- No configuration error is raised; no state, network, git, or configuration read is attempted.
- The neutral default is not the forbidden seed literal.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-help-isolation.test.ts` exits 0; a config-required, project-required, or missing-name failure fails the test.

#### TC-ENTRY-006 - Help and version perform zero reads/writes inside the fixed timeout

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F1-5, AC-NFR1-1, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-help-isolation.test.ts`
**Tags**: @backend, @entrypoint

**Preconditions**:
- Recording fakes count state reads/writes, network calls, git operations, filesystem writes, and configuration reads.
- A no-spawn guard is installed, following `tests/fixtures/result/no-spawn-guard.ts`.
- The suite runs under the repository's fixed `bun test` timeout; the timing measurement is informational and never an assertion.

**Steps**:
1. Run `--help` and `--version` with a warm in-process composition.
2. Assert every recorder count is zero and the no-spawn guard reports no violations.
3. Assert both invocations complete inside the suite's fixed timeout.
4. Record the wall-clock duration in the test output as informational metadata only.
5. Re-run with a poisoned state, network, git, and configuration port that throws if touched.

**Expected Outcome**:
- Zero state, network, git-write, configuration-read, and spawn calls; zero writes.
- Both commands complete inside the fixed suite timeout.
- The poisoned ports are never invoked; no wall-clock threshold decides pass/fail.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-help-isolation.test.ts` exits 0; the hard failure is any non-zero port counter, a spawn violation, or a timeout. The recorded duration is reported but not asserted.

#### TC-ENTRY-007 - No seed literal in `packages/**`; brand arrives only through the seam

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-10
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/forbidden-literals.test.ts` (existing scan), extended with the new entrypoint files
**Tags**: @backend, @branding

**Preconditions**:
- The forbidden-literal scanner covers the package tree, root manifests, root workspace files, ignore rules, and user-facing docs.
- The new entrypoint modules live under `packages/cli/src/**`.

**Steps**:
1. Run `bun run scripts/checks/forbidden-literals.ts`.
2. Assert zero violations across the five scope classes.
3. Add a temporary mutant file containing a seed literal in a temp copy and assert the scanner fails naming the file.

**Expected Outcome**:
- The live tree reports zero violations and the five expected scope classes.
- The mutant is rejected with the file and token named.

**Pass/Fail Evidence**:
- `bun test tests/checks/forbidden-literals.test.ts` exits 0; the mutation control proves the scan is non-vacuous.

#### TC-ENTRY-008 - Entrypoint is absent from the installer

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-4, AC-F1-7, NG-2, DEC-14
**Test Type(s)**: Structure, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/entrypoint-installer-absence.test.ts`; `scripts/.tests/test-install.sh`
**Tags**: @backend, @install

**Preconditions**:
- `scripts/install.sh` declares `ADOS_DELIVERY_SCRIPTS` and `ADOS_DELIVERY_TOOLS`.
- The installed file set is asserted by the existing install tests.

**Steps**:
1. Read `scripts/install.sh` and assert no entrypoint path or bin name is present in either array.
2. Run `bash scripts/.tests/test-install.sh`.
3. Assert the install test output is unchanged and exits 0.

**Expected Outcome**:
- The entrypoint is not installed.
- The installer tests pass with no new expectations.
- No packaging or release file mentions the new entrypoint.

**Pass/Fail Evidence**:
- `bun test tests/structure/entrypoint-installer-absence.test.ts` and `bash scripts/.tests/test-install.sh` both exit 0.

#### TC-ENTRY-009 - Composition is exactly §8.1; state/mcp/dispatch/daemon absent; uncomposed invocation fails closed

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-6, DEC-13, NFR-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-composition.test.ts`
**Tags**: @backend, @entrypoint, @error-table

**Preconditions**:
- The entrypoint composes the prompt-required subset and exposes the command registry for inspection.
- An invocation of a command outside the composed set is available in the test.
- The suite runs under the repository's fixed `bun test` timeout.

**Steps**:
1. Assert the composed command set equals spec section 8.1 exactly, including subcommands.
2. Assert `state`, `mcp`, `dispatch`, and the resident daemon are not registered, not reachable, and not claimed anywhere in the composition.
3. Assert `tests/structure/state-scope.test.ts` still passes, proving the state layer ships no command surface.
4. Invoke a command outside the composed set and assert the **existing** `fallback.internal` containment identity: platform category, `retryable: false`, `consequence: unknown`, platform-provider projection, exit projection `2`, with a summary that names the missing composition; never a silent success and never an unclassified crash.
5. Assert no new error-table row exists for composition, and that the machine and documented tables are unchanged by this case; the only table change in this change is the `commit.session.context-refused` retirement.
6. Assert the composition resolves the working name without reading an ambient brand literal and completes inside the fixed suite timeout.

**Expected Outcome**:
- The prompt-required set is complete and nothing else is composed.
- `state`, `mcp`, `dispatch`, and the daemon are absent from the registry and from prompt claims.
- The uncomposed invocation returns `fallback.internal` (platform, `retryable: false`, `consequence: unknown`, exit 2) with a summary naming the missing composition, introducing no new error-table row.
- Startup resolves the working name without an ambient brand literal; wall-clock timing is informational, not an assertion.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-composition.test.ts tests/structure/state-scope.test.ts tests/structure/error-table.test.ts` exits 0; any extra/missing command, a present `state`/`mcp`/`dispatch`/daemon registration, an unclassified success, a new composition error row, or a timeout fails the test.

#### TC-ENTRY-010 - Non-installed Bun bin plus `main` composition is mapped and invokes the composition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-7, DEC-14, NG-2
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/entrypoint-bin.test.ts` (new)
**Tags**: @backend, @entrypoint, @install

**Preconditions**:
- `packages/cli/package.json` declares `main` and `bin` entries.
- The CLI package tree contains the bin source under `packages/cli/bin/`.
- `scripts/install.sh` declares `ADOS_DELIVERY_SCRIPTS` and `ADOS_DELIVERY_TOOLS`.

**Steps**:
1. Assert the `bin` manifest maps a single neutral binary name to a Bun-shebang `.ts` file under `packages/cli/bin/`.
2. Assert the bin file exists, starts with a Bun shebang, and imports/invokes the `main`/composition entry rather than an in-process-only test helper.
3. Assert the `main`/composition export exists and is the same composition the behaviour suites drive.
4. Assert the binary name and bin path are absent from both installer arrays.
5. Build the package (or inspect the declared build output) and assert the built bin resolves to the same composition; this smoke check is supplemental to the structural assertions.

**Expected Outcome**:
- A non-installed Bun bin is mapped in the manifest and invokes the composition.
- The composition is shared with the in-process surface; there is no second entry path.
- The bin is absent from the installer install set.
- The neutral binary name contains no seed literal.

**Pass/Fail Evidence**:
- `bun test tests/structure/entrypoint-bin.test.ts` exits 0; a missing `bin` mapping, a missing shebang, an in-process-only target, or an installer entry fails the test.

#### TC-SESS-001 - In-session standalone `commit` lands under normal rules

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F4-1, DEC-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-session-adoption.test.ts` (update from `commit-session-guard.test.ts`)
**Tags**: @backend, @commit, @session

**Preconditions**:
- `withCommitHarness` seeds a dirty tree and injects `sessionFacts: { insideDeliverySession: true, sessionId: "ses_fixture" }`.
- The core transport and safety scanner are injected fakes.

**Steps**:
1. Run `commit GH-310`.
2. Run `commit GH-310 --dry-run`.
3. Run `commit GH-310 --phase delivery`.
4. Assert exit code, envelope data, HEAD, commit count, ledger lines, and the `excluded` list.

**Expected Outcome**:
- Every invocation succeeds under the primitive's normal safety and staging rules.
- No `commit.session.context-refused` error is returned.
- The landing is recorded in `phase.transition` and `commit.telemetry`.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/commit-session-adoption.test.ts` exits 0; any refusal code or missing record fails the test.

#### TC-SESS-002 - In-session `phase complete` records the transition with and without a commit (phase-2 half)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-F4-1, AC-F2-2, DEC-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-session-adoption.test.ts`
**Tags**: @backend, @phase, @session

**Preconditions**:
- A change folder with pm-notes and a validated lifecycle phase; session facts report an active delivery session.
- This case intentionally does not assert artifact/pm-notes staging or commit contents; those are phase-3 assertions owned by `TC-STAGE-001`, `TC-STAGE-003`, `TC-STAGE-006`, and `TC-STAGE-009`.

**Steps**:
1. Run `phase complete GH-310 specification` with session facts present.
2. Assert the command exits 0, returns no `commit.session.context-refused` code, and records exactly one ledger transition.
3. Run the same fixture with `--no-commit` and assert the transition without a commit.
4. Re-run the `--no-commit` case and assert the transition is idempotent and no refusal is returned.

**Expected Outcome**:
- Both flag shapes succeed inside a delivery session; no session refusal is returned anywhere.
- The default completion records exactly one transition; the `--no-commit` shape records the transition only.
- A re-run does not duplicate the transition.
- Staging, commit contents, and ordering are deliberately out of scope for this phase-2 case.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-session-adoption.test.ts` exits 0; any refusal code, duplicate transition, or missing transition fails the test. Artifact/pm-notes commit-content assertions are not part of this case.

#### TC-SESS-003 - In-session and out-of-session behavior are otherwise identical

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-session-adoption.test.ts`
**Tags**: @backend, @commit, @session

**Preconditions**:
- The same dirty tree, plan, and safety outcome are used for both runs.
- Only the injected session facts differ.

**Steps**:
1. Run `commit GH-310` with an active session.
2. Run the same command with no session.
3. Compare exit code, envelope shape, staged files, commit subject, and ledger record shape.

**Expected Outcome**:
- The outputs are identical except for fields that legitimately name the session context.
- No behavioral divergence is introduced by the guard removal.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/commit-session-adoption.test.ts` exits 0; a shape or staging difference fails the comparison.

#### TC-SESS-004 - The sanitized one-shot context is retained

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DEC-3, section 8.4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/harness-oneshot-context.test.ts`
**Tags**: @backend, @harness, @session

**Preconditions**:
- A recording harness runner captures the working directory and environment of every spawn.
- The parent environment contains canary delivery-session keys and an undeclared token.

**Steps**:
1. Invoke the one-shot transport through the harness adapter.
2. Assert the working directory is a fresh temporary empty project directory.
3. Assert the environment contains no delivery-session facts and no undeclared parent key.
4. Assert the directory is removed after the attempt, including the failure path.

**Expected Outcome**:
- The one-shot remains isolated and sanitized.
- No delivery-session fact is injected.
- The temporary context is always removed.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/harness-oneshot-context.test.ts` exits 0; a canary leak or a surviving temp directory fails the test.

#### TC-SESS-005 - No `commit.session.context-refused` code path remains

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-3
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/commit-contract.test.ts` (existing, extend)
**Tags**: @backend, @commit

**Preconditions**:
- The source tree is the live checkout.

**Steps**:
1. Scan `packages/**` for the retired code string and for the session-refusal branch in `commit.ts` and `phase.ts`.
2. Assert the string appears only in historical change artifacts and the retired-row fixtures expected to be removed.
3. Assert the runtime session facts type still exists for other consumers.

**Expected Outcome**:
- No production branch returns the retired code.
- The session-fact mechanism remains available but does not gate `commit` or `phase complete`.

**Pass/Fail Evidence**:
- `bun test tests/structure/commit-contract.test.ts` exits 0; any production reference fails the scan.

#### TC-ERRROW-001 - Machine table carries five `commit` rows and no retired row

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-3
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/commit-contract.test.ts`
**Tags**: @backend, @commit, @error-table

**Preconditions**:
- `ERROR_TABLE` is imported from the core contracts.

**Steps**:
1. Filter `ERROR_TABLE` by `domainKind === "commit"`.
2. Assert exactly five rows and the expected identities.
3. Assert `commit.session.context-refused` is absent.
4. Assert every remaining row keeps its category, retryability, consequence, and projection.

**Expected Outcome**:
- Five rows: `commit.staging-blocked-untracked`, `commit.commitlint-failed`, `commit.safety.secret-suspected`, `commit.safety.scan-unavailable`, `commit.atomic-abort`.
- No retired identity remains.

**Pass/Fail Evidence**:
- `bun test tests/structure/commit-contract.test.ts` exits 0; a sixth row or the retired code fails the assertion.

#### TC-ERRROW-002 - Documented table and sync check agree with the machine table

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-3
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing, update)
**Tags**: @backend, @docs, @error-table

**Preconditions**:
- The documented tables are in `doc/spec/features/feature-commit-primitive.md` and `doc/spec/features/feature-result-contract.md`.
- The sync check reads the machine table and the documented rows.

**Steps**:
1. Run `bun run scripts/checks/error-table-sync.ts`.
2. Assert the `commit` domain is described as five rows and the retired row is absent.
3. Assert no composition-specific error row exists: no `config.composition.unavailable` and no new `fallback.*` row. An uncomposed command uses the already-documented `fallback.internal` identity, so the only documented-table count change is the `commit`-domain retirement.
4. Mutate a temp copy by re-adding the row to the doc and assert the sync check fails.
5. Mutate a temp copy by re-adding the row to the machine table and assert the sync check fails.

**Expected Outcome**:
- The live tree is synced.
- Both half-removal mutations fail closed and name the offending row.

**Pass/Fail Evidence**:
- `bun test tests/checks/error-table-sync.test.ts` exits 0; either mutation must fail.

#### TC-ERRROW-003 - Retired code is absent from the corpus and re-introduction fails the sync scan

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-3
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts`; `tests/fixtures/result/code-corpora/true-positives.json`
**Tags**: @backend, @error-table, @fixtures

**Preconditions**:
- The existing corpora are `tests/fixtures/result/code-corpora/true-positives.json` and `false-positives.json`; no new corpus file is introduced.
- The detection mechanism is the error-table sync scan over the machine table and the documented table, not a corpus entry.

**Steps**:
1. Assert `true-positives.json` no longer contains `commit.session.context-refused`.
2. Run `bun run scripts/checks/error-table-sync.ts` and assert the machine table and the documented table both omit the retired row.
3. In a temp copy, re-add the row to the machine table only and assert the sync scan fails naming the row.
4. In a temp copy, re-add the row to the documented table only and assert the sync scan fails naming the row.
5. Assert the documented examples and the result-contract fixtures do not name the code as a valid positive.

**Expected Outcome**:
- No existing corpus, fixture, golden, or documented example treats the retired code as a valid positive.
- Any re-introduction in either the machine table or the documentation is detected by the sync scan and fails closed.
- No `true-positives.json`-shaped new fixture is invented; the existing corpus is updated in place.

**Pass/Fail Evidence**:
- `bun test tests/checks/error-table-sync.test.ts tests/structure/result-contract.test.ts` exits 0; a surviving re-introduction mutant or a stale positive fails the run.

#### TC-ERRROW-004 - TDR-0013 records the reversal and the GH-227 supersession

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, OQ-2
**Test Type(s)**: Structure
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/checks/decision-record.test.ts` (new) and manual review of `doc/decisions/TDR-0013-agent-session-commit-guard-reversal.md`
**Tags**: @docs, @decision

**Preconditions**:
- TDR-0013 exists and is indexed in `doc/decisions/00-index.md`.
- The GH-242 spec references TDR-0013 in DEC-3 and OQ-2.

**Steps**:
1. Assert the TDR file exists, has ID `TDR-0013`, and names the reversal and the GH-227 DEC-6 supersession.
2. Assert the index row is present and the status is the recorded status.
3. Assert the GH-242 spec contains the TDR identifier.
4. Manually review that the TDR states the retained one-shot and the error-row retirement.

**Expected Outcome**:
- The record is present, indexed, and referenced.
- The prose states the behavioral consequence and the retained isolation.
- No other document claims the guard remains.

**Pass/Fail Evidence**:
- `bun test tests/checks/decision-record.test.ts` exits 0; the PR review checklist records the manual prose check.

#### TC-STAGE-001 - Completion stages plan scope union the change folder

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F3-3, AC-F2-2, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-staging-scope.test.ts`
**Tags**: @backend, @phase, @commit, @staging

**Preconditions**:
- A validated multi-phase plan declares files under `src/` and a change folder under `doc/changes/2026-11/2026-11-07--GH-310--staging/` containing `chg-GH-310-spec.md` and `chg-GH-310-pm-notes.yaml`.
- The plan phase is `delivery`.

**Steps**:
1. Modify a declared plan file and create the change-folder artifacts.
2. Run `phase complete GH-310 delivery`.
3. Inspect `stagedFiles`, `excluded`, the commit tree, and the ledger record.
4. Repeat with a lifecycle phase that has no plan-phase correspondence and assert only the change folder is staged.

**Expected Outcome**:
- The staged set equals the mapped plan scope union the change folder.
- Both the plan file and the change-folder artifacts are in the commit.
- A lifecycle phase with no plan-phase correspondence contributes only the change folder.
- The transition record and commit land atomically.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-staging-scope.test.ts` exits 0; the assertion compares the exact staged path set.

#### TC-STAGE-002 - Unrelated strays stay unstaged and are disclosed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F3-3, DEC-4, RSK-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-staging-scope.test.ts`
**Tags**: @backend, @phase, @staging

**Preconditions**:
- The fixture from TC-STAGE-001 plus `stray.txt` at the repository root and `tools/untracked.sh` outside the change folder.

**Steps**:
1. Run `phase complete GH-310 delivery`.
2. Assert `stray.txt` and `tools/untracked.sh` remain untracked.
3. Assert both appear in the envelope `excluded` disclosure with a reason.

**Expected Outcome**:
- Neither stray is staged or committed.
- The disclosure names every excluded path and reason.
- The commit contains only the allowed scope.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-staging-scope.test.ts` exits 0; a stray in the commit fails the test.

#### TC-STAGE-003 - A planning phase with no plan stages the change folder

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F3-3, AC-F2-2, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-staging-scope.test.ts`
**Tags**: @backend, @phase, @staging

**Preconditions**:
- No plan file exists for the ref.
- A new untracked `chg-GH-310-spec.md` and the updated pm-notes exist in the change folder.

**Steps**:
1. Run `phase complete GH-310 specification`.
2. Assert the new spec artifact and the pm-notes transition are in the commit.
3. Assert no unrelated path is staged.

**Expected Outcome**:
- The artifact phase can commit its newly created artifact through the change-folder scope.
- The transition is atomic with the commit.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-staging-scope.test.ts` exits 0; a missing artifact fails the commit-tree assertion.

#### TC-STAGE-004 - A delivery phase maps to every delivery-kind plan phase

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F3-3, DEC-4, DEC-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-staging-scope.test.ts`
**Tags**: @backend, @phase, @staging

**Preconditions**:
- A plan with two delivery-kind phases, each declaring a distinct new file, and one planning-kind phase.
- The lifecycle phase is `delivery`.

**Steps**:
1. Modify both delivery-phase files and leave the planning-phase file dirty.
2. Run `phase complete GH-310 delivery`.
3. Assert both delivery files and the change folder are staged; the planning-only file is not.

**Expected Outcome**:
- The delivery completion maps to the union of all delivery-kind plan phases.
- Planning-kind scope is not staged by a delivery completion.
- The change folder is always included.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-staging-scope.test.ts` exits 0; the exact path-set assertion fails on an extra or missing file.

#### TC-STAGE-005 - Standalone commit keeps plan union; plan-absent stages the change folder

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F3-4, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/commit-staging-scope.test.ts`
**Tags**: @backend, @commit, @staging

**Preconditions**:
- Case A: a validated plan with declared files.
- Case B: no plan; a change folder with untracked spec/test-plan/plan artifacts and a root `stray.txt`.

**Steps**:
1. In Case A, run `commit GH-310` and assert the staged set is the plan union.
2. In Case B, run `commit GH-310` and assert the change-folder artifacts are staged.
3. In Case B, assert `stray.txt` is unstaged and disclosed.

**Expected Outcome**:
- Case A behavior is unchanged from GH-227.
- Case B stages only the change folder for the ref; unrelated strays remain unstaged.
- The envelope discloses every exclusion.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/commit-staging-scope.test.ts` exits 0; either a missed artifact or a staged stray fails the test.

#### TC-STAGE-006 - The pm-notes transition is inside the completion commit

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-2, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-completion-ordering.test.ts`
**Tags**: @backend, @phase, @ordering

**Preconditions**:
- A recording filesystem port records the write index and the commit call index.
- The pm-notes document starts with `delivery` incomplete.

**Steps**:
1. Run `phase complete GH-310 delivery`.
2. Assert the pm-notes write occurs before the commit act in the recorded call order.
3. Assert `git show --name-only HEAD` contains the pm-notes path and the phase artifact.
4. Assert the parent commit does not contain the updated transition.

**Expected Outcome**:
- The transition document is written first and is part of the same commit.
- The previous HEAD lacks the transition.
- The completion envelope reports the commit SHA and the staged files.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-completion-ordering.test.ts` exits 0; a commit missing the pm-notes path or a document write after the commit fails the test.

#### TC-STAGE-007 - A failed document write after a landed commit converges without a second commit

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F2-2, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-completion-convergence.test.ts` (extend the `commit-convergence` pattern)
**Tags**: @backend, @phase, @convergence

**Preconditions**:
- A completion record and a landed commit are constructed directly, the pm-notes document is left stale, and the durable transition exists (the same simulated-interruption pattern as `tests/behaviour/commit-convergence.test.ts`).
- The filesystem port is healthy on the re-run.

**Steps**:
1. Construct the post-commit/pre-document state: completion record present, commit present, pm-notes document stale.
2. Run `phase complete GH-310 delivery`.
3. Assert the document converges from the stored transition and the commit count is unchanged.
4. Repeat the constructed state three times and assert every re-run is a stable no-op.

**Expected Outcome**:
- The re-run never creates a second commit.
- The document is reconstructed from the durable transition.
- A third run is a stable no-op.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-completion-convergence.test.ts` exits 0; a duplicate commit or a non-converged document fails the test.

#### TC-STAGE-008 - Forbidden and binary exclusions still apply

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, NFR-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-staging-scope.test.ts`
**Tags**: @backend, @phase, @safety

**Preconditions**:
- The change folder contains a forbidden path and an oversized binary, both declared in scope or introduced as strays.

**Steps**:
1. Run `phase complete GH-310 delivery`.
2. Assert the forbidden path and the binary are excluded.
3. Assert the tracked scope drift is disclosed in `excluded`.

**Expected Outcome**:
- The exclusions still apply when the staging scope widens.
- The disclosure names every excluded path and reason.
- The safety scan still runs before staging and transport.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-staging-scope.test.ts` exits 0; a forbidden or oversized path in the commit fails the test.

#### TC-STAGE-009 - A failed commit act after the document write restores the pre-write bytes and retry converges

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-2, AC-F2-2, AC-F2-4, DEC-16, RSK-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-completion-reverse-window.test.ts` (new; reuses the `withCommitHarness` recorder)
**Tags**: @backend, @phase, @ordering, @convergence

**Preconditions**:
- A recording filesystem port snapshots the exact pm-notes bytes before the completion writes.
- A scripted commit seam can fail at four injection points after the pm-notes write: safety STOP, staging refusal, commitlint failure, and atomic abort.
- A validated plan and a change folder with pending artifacts exist.

**Steps**:
1. For each of the four failure modes, run `phase complete GH-310 delivery` with the injection armed after the pm-notes write.
2. Assert the completion does not report success and the atomic contract holds: HEAD and the commit count are unchanged, no reachable commit object remains, and the ledger gains no transition. Do not assert object-database absence and do not assume no partial commit object was ever written; the observable contract is "no commit lands" and "no transition lands".
3. Compare the pm-notes bytes with the pre-write snapshot and assert byte equality.
4. Disarm the injection and retry the same completion.
5. Assert the retry lands exactly one transition and exactly one commit containing the pm-notes transition and the artifacts.
6. Re-run the successful completion once more and assert it is a stable no-op (no second commit, no duplicate transition).

**Expected Outcome**:
- Every post-document/pre-commit failure leaves the derived projection equal to the pre-write bytes, with no ledger transition and no landed commit (HEAD and commit count unchanged, no reachable commit object); object-database absence is not asserted.
- The retry after any failed attempt produces exactly one transition and exactly one commit.
- A third run after success does not duplicate either the transition or the commit.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-completion-reverse-window.test.ts` exits 0; a leaked transition, a changed HEAD/commit count, a reachable new commit, a non-restored document, or a duplicate on retry fails the test. A surviving object-database entry alone does not fail it.

#### TC-STAGE-010 - A failed restoration exits 2 with a classified fault and reconciliation instruction

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F2-4, DEC-16, RSK-11
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-completion-reverse-window.test.ts`
**Tags**: @backend, @phase, @ordering, @failure-contract

**Preconditions**:
- The pm-notes pre-write snapshot exists.
- The commit act is scripted to fail and the restore write is scripted to fail as well.

**Steps**:
1. Run `phase complete GH-310 delivery` with the commit failure and the restore failure armed.
2. Assert exit code `2`.
3. Assert the envelope carries a classified platform fault (stable error code and category), the affected pm-notes path, and the pre-write snapshot source as the reconciliation instruction.
4. Assert the completion does not claim success and does not append a ledger transition or commit.
5. Assert the next successful completion after the fault converges to exactly one transition and one commit.

**Expected Outcome**:
- A failed restore is a classified platform fault with exit projection `2`, not a silent success or an unclassified crash.
- The reconciliation instruction names the affected document and the snapshot source.
- No transition or commit is claimed, and a later retry converges once the restore path is healthy.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-completion-reverse-window.test.ts` exits 0; an exit other than `2`, an unclassified error, a missing reconciliation instruction, or a claimed success fails the test.

#### TC-PLANSUM-001 - Optional `summary` is accepted and echoed

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F7-1, DM-1, DEC-8
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-summary.test.ts`
**Tags**: @backend, @plan

**Preconditions**:
- A valid `delivery.plan.v1` fixture with a non-empty `phases[].summary` under `tests/fixtures/plan/summary/`.

**Steps**:
1. Run `plan validate GH-310` on the fixture.
2. Assert the verdict is `valid` and the summary is echoed in the machine data.
3. Run with an empty string and with a non-string value.
4. Assert both are rejected with `plan.schema.invalid` and the field path.

**Expected Outcome**:
- A non-empty summary is accepted and echoed.
- Empty or non-string values fail with the field named.
- Omission remains valid (TC-PLANSUM-002).

**Pass/Fail Evidence**:
- `bun test tests/behaviour/plan-summary.test.ts` exits 0; a swallowed field or a missing rejection fails the test.

#### TC-PLANSUM-002 - A plan without `summary` remains valid

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F7-1, DM-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/plan-summary.test.ts`; `tests/fixtures/plan/summary/`
**Tags**: @backend, @plan

**Preconditions**:
- A valid plan fixture with no `summary` lives under `tests/fixtures/plan/summary/` and is copied into the test root.
- A legacy markdown plan fixture is also available.

**Steps**:
1. Run `plan validate` on the no-summary fixture.
2. Assert the verdict and all non-summary fields match the existing golden.
3. Run `plan diff` and `plan overlap` with the fixture.
4. Assert no verdict changes.

**Expected Outcome**:
- The plan remains valid; no new required field appears.
- Existing plan, diff, overlap, and legacy verdicts are unchanged.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/plan-summary.test.ts tests/behaviour/plan-validate.test.ts` exits 0; a changed verdict fails the run.

#### TC-PLANSUM-003 - No code or template consumer requires `tasks`; progress stays out of the plan

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F7-2, DEC-8
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/plan-consumer-inventory.test.ts` (code/template consumers only)
**Tags**: @backend, @plan, @docs

**Preconditions**:
- A valid plan fixture without a `tasks` key under `tests/fixtures/plan/summary/`.
- A second fixture that contains a `tasks` key, used only to prove no consumer reads it; the validator's unknown-key verdict is recorded, not asserted as a rejection (OQ-T2).
- A source inventory of code and template consumers that read plan phases, summaries, and scope.

**Steps**:
1. Assert the no-`tasks` plan validates.
2. Run `plan validate` on the `tasks`-bearing fixture and record the verdict.
3. Scan the code and template consumers for reads of a `tasks` key; assert zero.
4. Assert the implementation-plan template carries no task-progress or `tasks` instruction and points progress to pm-notes `notes:`.

**Expected Outcome**:
- No code or template consumer requires `tasks`.
- The template keeps progress out of the plan and names pm-notes `notes:` as the progress channel.
- The prompt-text scan is deliberately not part of this phase-4 case; it is `TC-PLANSUM-005` in phase 5/8.

**Pass/Fail Evidence**:
- `bun test tests/checks/plan-consumer-inventory.test.ts` exits 0; a consumer read or a template progress instruction fails the scan.

#### TC-PLANSUM-004 - Plan writer emits the schema and the commit path consumes `summary`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F7-3, DM-1
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/plan-writer-prompt.test.ts` (new, phase-4 scoped); `tests/behaviour/commit-message.test.ts`
**Tags**: @backend, @plan, @commit

**Preconditions**:
- The plan-writer prompt and the implementation-plan template are in the phase-4 scope.
- A plan fixture with a `summary` and a fixture without one under `tests/fixtures/plan/summary/`.

**Steps**:
1. Assert the plan-writer prompt and template emit `delivery.plan.v1`, declared phases, and declared scope, with no task-progress log.
2. Run the commit path over the summary fixture and assert the commit subject uses the phase summary.
3. Run it over the no-summary fixture and assert the deterministic fallback is used.

**Expected Outcome**:
- The producer emits the schema and the optional summary.
- The consumer uses the summary when present and falls back safely when absent.
- No task log appears in either output.
- This case does not depend on the coder/PM/run-plan prompt edits or the phase-8 prompt scan.

**Pass/Fail Evidence**:
- `bun test tests/structure/plan-writer-prompt.test.ts tests/behaviour/commit-message.test.ts` exits 0; a task-log instruction or an ignored summary fails the test.

#### TC-PLANSUM-005 - No prompt writes `tasks` or plan progress into the plan

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F7-2, DEC-8
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-conformance.test.ts` (phase 5/8; runs after the coder/PM/run-plan prompt edits)
**Tags**: @prompts, @plan, @conformance

**Preconditions**:
- The lifecycle inventory fixture `tests/fixtures/prompt-inventory/lifecycle.json` lists every `.opencode/agent/*.md` and `.opencode/command/*.md`.
- The coder, PM, run-plan, and plan-writer prompts are updated by phases 4–5.

**Steps**:
1. Scan the lifecycle inventory for instructions to write a `tasks` key or plan progress into the plan file.
2. Assert zero such instructions.
3. Assert every progress instruction points to a pm-notes `notes:` entry naming the plan phase id, commit hash, and test result.
4. Mutate a temp copy with a plan-progress write instruction and assert the scan fails naming file and rule.

**Expected Outcome**:
- No prompt writes progress into the plan.
- The pm-notes `notes:` path is the declared progress channel.
- The mutant fails; the scan is non-vacuous.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-conformance.test.ts` exits 0; a prompt write instruction or a surviving mutant fails the scan.

#### TC-PSCAN-001 - Zero hand-written phase-state or PR-URL write instructions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-4, DEC-2
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts`
**Tags**: @prompts, @docs, @conformance

**Preconditions**:
- The inventory fixture `tests/fixtures/prompt-inventory/lifecycle.json` lists every `.opencode/agent/*.md` and `.opencode/command/*.md`.
- The phase-8 scan scope adds the guides, man page, and reference pages reconciled in phase 7; it excludes `doc/spec/features/**`, which phase 7 must not read and phase 10 reconciles.
- The scan grammar knows instruction-bearing lines and code blocks and excludes read-only `phase list` references.
- A pm-notes schema example is allowed only when it is explicitly labeled read-only; a line or block that tells the agent to set a phase field is an instruction and must fail.

**Steps**:
1. Run the scan over the lifecycle inventory.
2. Assert zero instructions that set `phases.ID.started`, `phases.ID.completed`, or `phases.pr_creation.url`.
3. Assert `phase complete`, `phase list`, and `phase reopen` are the only phase-state verbs taught.
4. Assert the read-only schema example is allowed and a write-instruction mutant fails.
5. Mutate a temp copy with each forbidden write pattern and assert a failure naming file and rule.
6. Re-run `tests/behaviour/phase-write-path-lint.test.ts` and assert the phase family remains the only write path.
7. Run the same phase-state rule over the phase-7 updated guides, man page, and reference pages updated by phase 7. Do **not** read `doc/spec/features/**` here; the system-spec phrase-table scan is `TC-DOCREC-003` in phase 10, after the feature specs are reconciled.

**Expected Outcome**:
- Zero violations on the live tree.
- Every mutant fails; the scan reports the file and the rule.
- Legitimate read-only phase references do not fail.
- The phase-8 scan covers `.opencode/**` and the phase-7 updated guides/man/reference pages; the system-spec scan is deferred to phase 10.

**Pass/Fail Evidence**:
- `bun run scripts/checks/prompt-conformance.ts` exits 0; `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/phase-write-path-lint.test.ts` proves every mutant fails and the phase family remains the only write path. A scan failure caused by an unreconciled `doc/spec/features/**` page is out of scope for this phase.

#### TC-PSCAN-002 - Zero raw `git add` / `git commit` / hand-crafted commit instructions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-4, DEC-5
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts`
**Tags**: @prompts, @conformance

**Preconditions**:
- The scan distinguishes read-only git (`status`, `diff`, `log`, `rev-parse`, `branch --list`) from write operations.
- The `@pr-manager` push and PR-creation allowances are declared in `tests/fixtures/prompt-inventory/allowlist.json`.
- The phase-8 scan scope is `.opencode/**` plus the phase-7 updated guides/man/reference pages; `doc/spec/features/**` is excluded until phase 10.

**Steps**:
1. Scan every lifecycle prompt for `git add`, `git commit`, `git commit -F`, `git reset`, and a hand-crafted commit recipe.
2. Assert zero write instructions while read-only git remains allowed.
3. Mutate a temp copy with each write pattern and assert a failure.
4. Assert the `@pr-manager` push/PR creation allowance is the only git-write allowance.
5. Run the same raw-git rule over the phase-7 updated guides, man page, and reference pages. Do **not** read `doc/spec/features/**` here; system-spec phrase assertions are `TC-DOCREC-003` in phase 10. Historical change artifacts are excluded as records, and read-only git remains allowed.

**Expected Outcome**:
- Zero raw-git commit instructions in the lifecycle inventory and the phase-7 updated docs.
- The read-only allowance remains intact.
- Every mutation fails with the file and rule named.
- The system-spec scan is deferred to phase 10, so phase 8 is green before reconciliation.

**Pass/Fail Evidence**:
- `bun run scripts/checks/prompt-conformance.ts` exits 0; `bun test tests/checks/prompt-conformance.test.ts` proves non-vacuity.

#### TC-PSCAN-003 - Every prompt typed invocation is in the allowed set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F8-2, NFR-5
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts`
**Tags**: @prompts, @conformance

**Preconditions**:
- `tests/fixtures/prompt-inventory/allowed-commands.json` mirrors spec section 8.1.
- The scan extracts command invocations from prompt code blocks and inline backticks.

**Steps**:
1. Extract every typed invocation from the lifecycle inventory.
2. Assert each invocation belongs to the allowed set, including the subcommand level.
3. Assert every allowed command appears at least once in the inventory and in the help/guide matrix.
4. Mutate a temp copy with an unknown command and assert a failure.

**Expected Outcome**:
- No prompt invokes a command outside the allowed set.
- The allowed set is not vacuous: every entry is exercised.
- The unknown-command mutant fails.

**Pass/Fail Evidence**:
- `bun run scripts/checks/prompt-conformance.ts` exits 0; the coverage matrix and scan agree.

#### TC-PSCAN-004 - Retained versus retired bash classification is correct

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F8-3, AC-F6-3, NFR-4, DEC-7
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-conformance.test.ts`; `tests/fixtures/prompt-inventory/retained-retired.json`
**Tags**: @prompts, @bash, @conformance

**Preconditions**:
- Appendix B is encoded as a fixture: retired paths and retained paths with their replacement or retention reason.

**Steps**:
1. Scan every prompt reference to a bash path.
2. Assert no retired path appears as a primary step or command block.
3. Assert `scripts/deliver-ticket.sh` is labeled retained until M1-S9 and `scripts/ceo-loop.sh` until M1-S18.
4. Assert no prompt claims `dispatch` or the resident daemon.
5. Mutate a temp copy with a retired path as a primary step and assert a failure.

**Expected Outcome**:
- The retained scripts are explicitly labeled retained.
- No retired path is a primary path.
- No undelivered story is claimed.
- The mutant fails.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-conformance.test.ts` exits 0; the classifier names the file and path on failure.

#### TC-PSCAN-005 - Scan mutants fail; scans are deterministic with zero ambient reads

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, AC-NFR3-1, DEC-11
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-conformance-mutants.test.ts`
**Tags**: @prompts, @conformance, @determinism

**Preconditions**:
- A temp copy of the prompt/doc inventory is writable; the mutant corpus is `tests/fixtures/prompt-inventory/mutants/`.
- The scan accepts an injected root and no ambient environment.

**Steps**:
1. Inject one forbidden pattern per rule into a temp copy; run the scan and assert every mutant fails with the expected rule.
2. Remove one required retained label; assert the scan fails.
3. Run the scan twice on the same tree and compare the full report byte-for-byte.
4. Run with an empty sanitized environment and compare the counts.

**Expected Outcome**:
- Every mutant fails; no rule is vacuous.
- The two reports are identical in counts and ordering.
- No ambient read changes the result.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-conformance-mutants.test.ts` exits 0; a surviving mutant or a differing report fails the test.

#### TC-PSCAN-006 - Prompt and guide secret scan reports zero findings

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, AC-NFR9-1, section 20
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-authoring.test.ts` (existing, extend) and `tests/checks/prompt-secret-scan.test.ts` (new)
**Tags**: @prompts, @privacy, @security

**Preconditions**:
- The prompt/guide inventory includes every `.opencode/**` file and the reconciled guides, plus the phase-8 fixture inventory: `tests/fixtures/prompt-inventory/lifecycle.json`, `allowed-commands.json`, `allowlist.json`, `mutants/`, `tests/fixtures/key-register/register.json`, `tests/fixtures/help-guide/coverage.json`, `tests/fixtures/entrypoint/programs.ts`, `tests/fixtures/plan/summary/`, and `tests/golden/plan/`.
- The secret corpus and canary fixtures exist under `tests/fixtures/secret-boundary` and `tests/fixtures/privacy-literals`.

**Steps**:
1. Run the privacy/secret scan over the prompt, guide, and new fixture inventory.
2. Assert zero secret-shaped findings in prompts, guides, and the new test data.
3. Inject a canary credential into a temp copy of each new fixture type and assert a finding.
4. Re-run `tests/behaviour/commit-safety.test.ts` and assert the safety-scan behavior is unchanged.

**Expected Outcome**:
- Zero findings on the live tree, including the new fixtures.
- Every canary mutant is detected.
- The commit safety scan still passes/fails as before.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-secret-scan.test.ts tests/behaviour/commit-safety.test.ts` exits 0; a canary leak, an unscanned fixture class, or a changed safety verdict fails the test.

#### TC-PSCAN-007 - `@committer` is a thin executor of `commit`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DEC-5
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/commit-command.test.ts`
**Tags**: @prompts, @commit

**Preconditions**:
- The `@committer` prompt is in the lifecycle inventory.
- The commit harness can invoke the primitive with the same ref/phase context the prompt would pass.

**Steps**:
1. Scan `@committer` for `git add`, `git commit`, re-stage, amend, and independent message composition.
2. Assert it invokes `commit` with the resolved ref/phase context and reports the envelope.
3. Run `commit GH-310 --phase delivery` through the harness and assert the envelope is the reported shape.
4. Assert caller `outcome`/`why`/`verification` hints remain contextual only.

**Expected Outcome**:
- The prompt performs no direct staging or commit.
- The primitive's computed message is authoritative.
- The envelope is the reported result.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/commit-command.test.ts` exits 0; a raw-git step or an independent message recipe fails the scan.

#### TC-PSCAN-008 - The PR URL is a pm-notes note, not phase state

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DM-2, DEC-2
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/pm-notes-lint.test.ts`
**Tags**: @prompts, @pm-notes

**Preconditions**:
- A pm-notes fixture with a PR-URL `notes[]` entry (`text` containing the URL, `type: info`, `date`).
- The PM prompt is in the inventory.

**Steps**:
1. Assert the pm-notes fixture validates with the note.
2. Assert `phases.pr_creation.url` is not written by any prompt instruction.
3. Assert the PM prompt instructs the note write before `phase complete pr_creation`.
4. Assert the note is included in the `pr_creation` completion commit.

**Expected Outcome**:
- The PR URL is an ordinary note.
- The phase state is written only by `phase complete`.
- The note lands in the completion commit.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/pm-notes-lint.test.ts` exits 0; a `phases.pr_creation.url` write fails the scan.

#### TC-PSCAN-009 - Non-pilot new fixtures carry no secrets and the commit safety scan is unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, AC-NFR9-1, section 20
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-secret-scan.test.ts`; `tests/checks/privacy-authoring.test.ts`; `tests/behaviour/commit-safety.test.ts`
**Tags**: @privacy, @security, @fixtures

**Preconditions**:
- The new non-pilot test data exists at the canonical paths created through phase 8: `tests/fixtures/prompt-inventory/{lifecycle,allowed-commands,allowlist,retained-retired}.json`, `tests/fixtures/prompt-inventory/mutants/`, `tests/fixtures/key-register/register.json`, `tests/fixtures/help-guide/coverage.json`, `tests/fixtures/entrypoint/programs.ts`, `tests/fixtures/plan/summary/`, and `tests/golden/plan/`.
- `tests/fixtures/pilot/**` is **not** required here; the pilot fixtures are created in phase 9 and are scanned by `TC-PSCAN-010`.
- The canary corpus covers token-, key-, and credential-shaped values.

**Steps**:
1. Run the privacy/secret scanner over every new non-pilot fixture and golden path listed above.
2. Assert zero secret-shaped findings.
3. Insert one canary value into a temp copy of each non-pilot fixture class (prompt inventory, key register, help coverage, entrypoint programs, plan summary, plan golden) and assert each is detected.
4. Re-run `tests/behaviour/commit-safety.test.ts` and assert the safety STOP/allow verdicts are unchanged.

**Expected Outcome**:
- No new non-pilot fixture or golden carries a secret-shaped value.
- Every non-pilot fixture class is inside the scan scope; an unscanned class fails the test.
- The commit safety scan behavior is unchanged.
- Phase 8 is green without phase-9 pilot data.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-secret-scan.test.ts tests/checks/privacy-authoring.test.ts tests/behaviour/commit-safety.test.ts` exits 0; a canary leak, an unscanned non-pilot class, or a changed safety verdict fails the test.

#### TC-PSCAN-010 - Pilot fixtures and suite data carry no secrets and the safety scan is unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-9, AC-NFR9-1, section 20
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-secret-scan.test.ts`; `tests/checks/privacy-authoring.test.ts`; `tests/checks/pilot-privacy.test.ts` (new); `tests/behaviour/commit-safety.test.ts`
**Tags**: @privacy, @security, @fixtures, @pilot

**Preconditions**:
- The pilot data exists at the canonical phase-9 paths: `tests/fixtures/pilot/{harness,repo,stubs,matrix}.ts`, the seeded plan/pm-notes/change-folder fixtures they create, and `tests/conformance/pilot/*.test.ts`.
- Phase 9 creates the pilot data before this case runs; this is the pilot-data half of the split from `TC-PSCAN-009`.
- The canary corpus covers token-, key-, and credential-shaped values.

**Steps**:
1. Run the privacy/secret scanner over every pilot fixture, seeded artifact, and pilot suite file.
2. Assert zero secret-shaped findings in pilot data and pilot test files.
3. Insert one canary value into a temp copy of each pilot fixture class (harness, repo seed, stubs, matrix, pilot suite) and assert each is detected.
4. Re-run the commit safety scan over the pilot fixtures and assert the STOP/allow verdicts are unchanged.

**Expected Outcome**:
- No pilot fixture, seed, or pilot suite file carries a secret-shaped value.
- Every pilot fixture class is inside the scan scope; an unscanned pilot class fails the test.
- Phase 9 owns the pilot-data scan and is green only when it passes.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-secret-scan.test.ts tests/checks/privacy-authoring.test.ts tests/checks/pilot-privacy.test.ts tests/behaviour/commit-safety.test.ts` exits 0; a canary leak, an unscanned pilot class, or a changed safety verdict fails the test.

#### TC-HELP-001 - Help and guide coverage matrix is complete

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F8-1, NFR-5, DEC-10
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/help-guide-coverage.ts`; `tests/checks/help-guide-coverage.test.ts`; `tests/fixtures/help-guide/coverage.json`
**Tags**: @docs, @conformance

**Preconditions**:
- The matrix fixture `tests/fixtures/help-guide/coverage.json` (created in phase 1) maps every spec-section-8.1 invocation to its help obligation and reference page path.
- The reference pages are updated by phase 7 before this phase-8 case runs.
- The reference pages exist under `doc/planning/oss-tooling/milestones/m1/commands/`; the root obligation maps to `man-page.md` plus the new `commands/entrypoint.md` reference page.
- The root/entrypoint reference page is the only new page this change must add; every other page already exists and is reconciled.

**Steps**:
1. Load the matrix and the command registry.
2. Assert every prompt-required invocation has a `--help` surface and a reference page.
3. Assert every reference page exists and is non-empty.
4. Assert the missing count is zero and every page is linked from the matrix.

**Expected Outcome**:
- 100% coverage; zero missing entries.
- The matrix and the registry agree on the command set.

**Pass/Fail Evidence**:
- `bun run scripts/checks/help-guide-coverage.ts` and `bun test tests/checks/help-guide-coverage.test.ts` exit 0; a missing entry names the invocation.

#### TC-HELP-002 - A matrix mutation fails and names the missing obligation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F8-1, NFR-5
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/help-guide-coverage-mutants.test.ts`
**Tags**: @docs, @conformance

**Preconditions**:
- A temp copy of the matrix and the reference-page directory is writable.

**Steps**:
1. Remove one command's help obligation and run the matrix; assert failure naming the command.
2. Remove one reference page and run the matrix; assert failure naming the page.
3. Add an extra page with no matrix row and assert a failure naming the orphan.
4. Restore and assert the clean tree passes.

**Expected Outcome**:
- Every mutation fails with an actionable message.
- The clean tree passes.
- The matrix is non-vacuous.

**Pass/Fail Evidence**:
- `bun test tests/checks/help-guide-coverage-mutants.test.ts` exits 0; a surviving mutation fails the test.

#### TC-HELP-003 - Reference pages match the delivered help surface

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-9, AC-F8-1, AC-F1-2, DEC-10
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/reference-page-parity.test.ts`
**Tags**: @docs, @conformance

**Preconditions**:
- The help output for each command is captured from the entrypoint.
- The reference pages are updated by phase 7; this case runs after those updates and asserts the reconciled pages against the phase-1 static `tests/fixtures/help-guide/coverage.json` inventory.
- The reference pages declare options and examples.

**Steps**:
1. Extract flags and options from each `--help` output.
2. Assert every documented flag appears in the reference page and vice versa.
3. Assert every example in `--help` is syntactically accepted by the parser.
4. Assert every see-also link resolves to an existing, non-empty page, and every inventory row has a reconciled page.
5. Assert the inventory is not read as a phase-1 substitute for page content: phase 1 proved row coverage; this case proves the updated pages match the delivered help surface.

**Expected Outcome**:
- No stale flag or missing option.
- Examples parse without `fallback.invocation`.
- See-also links resolve and every inventory page exists and is reconciled.
- Phase 7/8 reference-page reconciliation is proven separately from the phase-1 help-coverage fixture check.

**Pass/Fail Evidence**:
- `bun test tests/checks/reference-page-parity.test.ts` exits 0; a mismatch names the command and the flag.

#### TC-DOCREC-001 - Generated Claude plugin is byte-current

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F8-4, NFR-12
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`
**Tags**: @docs, @plugin

**Preconditions**:
- `.opencode/**` and `.ados-claude/**` are committed.
- `scripts/build-claude-plugin.sh` is deterministic and removes existing output before regeneration.

**Steps**:
1. Run `bash scripts/.tests/test-build-claude-plugin.sh`.
2. Assert the `committed plugin matches fresh build` test passes.
3. In a temp copy, modify one prompt and run the build; assert the committed plugin no longer matches.
4. Rebuild the temp copy and assert the outputs match again.

**Expected Outcome**:
- The committed plugin is byte-current.
- A prompt change without regeneration is detected as drift.
- Regeneration is deterministic.

**Pass/Fail Evidence**:
- `bash scripts/.tests/test-build-claude-plugin.sh` exits 0; the drift mutant fails the check.

#### TC-DOCREC-002 - Phase-7 guides, man page, and reference pages are reconciled

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F8-3, AC-F8-5, NFR-13, DEC-7, DEC-10
**Test Type(s)**: Structure / Check / Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/checks/doc-conformance.test.ts` with the parameterized phase-7 scope (`scope: docs`); plus the PR review checklist
**Tags**: @docs, @conformance

**Preconditions**:
- The phase-7 documents are `AGENTS.md`, `doc/guides/change-lifecycle.md`, `doc/guides/unified-change-convention-tracker-agnostic-specification.md`, `doc/guides/delivery-modes.md`, `doc/guides/autonomous-batch-delivery.md`, `doc/planning/concepts/automated-commit.md`, the M1 man page, and the command reference pages updated in phase 7.
- The stale-phrase and required-phrase lists are encoded in the parameterized doc-conformance fixtures.
- This case deliberately does not assert the `doc/spec/features/**` pages; the phase-3 behavior-spec rows belong to `TC-DOCREC-004` and the full feature-spec set belongs to `TC-DOCREC-003` in phase 10.

**Steps**:
1. Scan the phase-7 document set for stale phrases: raw `git add -A`, `git commit -F`, `phases.pr_creation.url` as a write target, the session-refusal rule, and `gh pr merge` as the merge path.
2. Scan for required phrases: `phase complete`, `commit` primitive, typed blockers, retained `deliver-ticket.sh`/`ceo-loop.sh`, and the neutral entrypoint identity.
3. Assert every phase-7 reference page exists, is non-empty, and names the delivered behavior it documents.
4. Manually review prose coherence and link validity.

**Expected Outcome**:
- Zero stale phrases in the phase-7 document set.
- Every required concept is present in the guides/man/reference pages.
- The manual review records no contradiction.
- The feature-spec pages are not read by this scoped run, so phase 7 is green before phase 10.

**Pass/Fail Evidence**:
- `bun test tests/checks/doc-conformance.test.ts` (phase-7 parameter set) exits 0; the PR checklist records the manual review.

#### TC-DOCREC-003 - Full feature-spec conformance against the complete §16.1.1 phrase table

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F8-5, AC-F8-3, NFR-13, DEC-7
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/doc-conformance.test.ts` with the full/final parameterized scope (`scope: full`), run in phase 10
**Tags**: @docs, @conformance

**Preconditions**:
- The §16.1.1 stale/required phrase table is the **single source** for the scan. The fixture encodes it row by row, with one assertion per page/phrase pair; a missing row is a coverage failure.
- The phase-10 feature specs are present, including the four omitted current-truth pages (`feature-delivery-lifecycle.md`, `feature-quality-gates-and-pr.md`, `feature-autonomous-delivery.md`, `feature-local-code-review.md`), the phase-3 behavior-spec pages (`feature-commit-primitive.md`, `feature-pm-notes-lint-and-phase-transitions.md`), `feature-result-contract.md`, and the generic behavioral-primitives pages.
- The §16.1 prompt/guide inventory rows are **outside** the named-phrase table and carry only their §16.1 scope obligation; this case makes no named-phrase claim about them.

**Steps**:
1. Iterate every row of the §16.1.1 table and assert each named stale phrase is absent and each required phrase is present, including:
   - `feature-commit-primitive`: the old completion order and old plan-only staging are absent; the pre-write/restore order, `mapped plan-phase scope union the change folder` staging, plan-absent change-folder staging, stray exclusion, in-session execution, and `five commit rows` are present.
   - `feature-pm-notes-lint-and-phase-transitions`: the session refusal, `the six commit.* identities`, and the completion error-identity "session refusal" are absent; in-session execution, `the five commit.* identities`, and "no session refusal" are present.
   - `feature-result-contract`: `the six commit.* rows` and `commit.session.context-refused` are absent; `the five commit rows`, the retired-row absence, and `fallback.internal` as the documented containment identity are present.
   - `feature-delivery-lifecycle`: the `@committer`-only commit claims are absent; `lifecycle commits route through the commit primitive`, the thin `@committer`, and `phase state is written only through the phase family` are present.
   - `feature-quality-gates-and-pr`: the temp-message-file/post-hook-amend workflow is absent; `@committer` invokes `commit` and performs no direct staging, commit, re-stage, or amend is present.
   - `feature-autonomous-delivery`: `gh pr merge --squash` and `glab mr merge` as the CEO merge authority are absent; `merge` as the lifecycle merge path and retained `deliver-ticket.sh`/`ceo-loop.sh` are present.
   - `feature-local-code-review`: the raw-git `/commit` workflow is absent; the primitive-backed `commit` or thin `@committer` is present.
   - The generic behavioral-primitives row: `git add -A`, `git commit -F`, post-hook amend, hand-edited `started`/`completed`, and `phases.pr_creation.url` written are absent; `lifecycle commits route through the commit primitive or the thin @committer`, `phase state is written only through the phase family`, and `the PR URL is a pm-notes notes: entry` are present.
2. Assert the page set covered by the fixture equals the page set named by §16.1.1; a missing row fails as a coverage failure, not a pass.
3. Assert every page outside the §16.1.1 table is exempt from the named-phrase assertion but still carries its §16.1 required-change obligation in the inventory.
4. Assert no feature page claims `state`, `mcp`, `dispatch`, or the daemon as a CLI command.

**Expected Outcome**:
- Every §16.1.1 phrase-table row is stale-absent and required-present.
- The four previously omitted specs and the phase-3 behavior-spec rows are covered by named assertions.
- No page outside the phrase table is falsely claimed as phrase-covered.
- A missing phrase-table row fails coverage.

**Pass/Fail Evidence**:
- `bun test tests/checks/doc-conformance.test.ts` (full parameter set) exits 0; a stale phrase, a missing required phrase, or a missing phrase-table row names the page and phrase.

#### TC-DOCREC-004 - Phase-3 behavior-spec phrase-table rows are reconciled

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F8-5, NFR-13, DEC-16
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/doc-conformance.test.ts` with the phase-3 behavior-spec parameter set (`scope: behavior-spec`); run in phase 3
**Tags**: @docs, @conformance, @phase

**Preconditions**:
- The §16.1.1 phrase table is the single source. This case encodes exactly the two rows whose ordering/staging reconciliation phase 3 owns: `feature-commit-primitive.md` and `feature-pm-notes-lint-and-phase-transitions.md`.
- Phase 2 has landed the session-refusal/five-row machine and documented-table changes; phase 3 lands the completion ordering/staging behavior and the matching spec text.
- The phase-10 full run (`TC-DOCREC-003`) re-asserts the same rows, so this case is early evidence, not a substitute.

**Steps**:
1. Run the `scope: behavior-spec` parameter set over the two phase-3-owned pages.
2. For `feature-commit-primitive`, assert all four stale phrases from the §16.1.1 row are absent: the old completion order, the old plan-only staging sentence, "refuses to run inside a delivery session", and `commit.session.context-refused`. Assert all four required phrases are present: pre-write-then-commit-with-restore, `mapped plan-phase scope union the change folder` staging with plan-absent change-folder staging and stray exclusion, in-session execution, and `five commit rows`.
3. For `feature-pm-notes-lint-and-phase-transitions`, assert the session-refusal sentence, `the six commit.* identities`, and the completion error-identity "session refusal" are absent; assert in-session execution, `the five commit.* identities`, and "no session refusal" are present.
4. Assert the fixture covers both rows and every named phrase; a missing page or phrase fails as a coverage failure.
5. Assert the run does not read any other `doc/spec/features/**` page, so phase 3 stays independently green.

**Expected Outcome**:
- The two phase-3 behavior-spec rows are stale-absent and required-present.
- The completion ordering/staging text matches the delivered behavior and the five-row commit domain.
- Phase 3 is green without waiting for phase 10.

**Pass/Fail Evidence**:
- `bun test tests/checks/doc-conformance.test.ts -t "scope: behavior-spec"` exits 0; a stale phrase, a missing required phrase, or a missing row names the page and phrase.

#### TC-KEYVAL-001 - `merge` text is byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F9-1, NFR-6, Appendix A
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/merge.test.ts`; `tests/fixtures/merge/golden`
**Tags**: @golden, @merge

**Preconditions**:
- The merge success, gate-refusal, waiver, stale, rebase, tracker, and override scenarios exist.

**Steps**:
1. Run every merge scenario in text mode.
2. Compare stdout/stderr byte-for-byte with the committed golden.
3. Assert `result=`, `squash=`, and the per-gate `ok`/refused lines are present in the declared order.
4. Regenerate only with the explicit fixture command when a deliberate change is approved.

**Expected Outcome**:
- Every golden is byte-identical.
- No key is renamed, reordered, or dropped.
- A renderer mutation fails the comparison.

**Pass/Fail Evidence**:
- `bun test tests/golden/merge.test.ts` exits 0; a byte diff names the scenario and the offset.

#### TC-KEYVAL-002 - `queue` text is byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F9-1, NFR-6, Appendix A
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/queue-list.test.ts`, `tests/golden/queue-plan.test.ts`; `tests/fixtures/queue-ready/golden`
**Tags**: @golden, @queue

**Preconditions**:
- The queue list and plan fixtures cover bounded summaries, `degraded=`, and `truncated=`.

**Steps**:
1. Run `queue list` and `queue plan` in text mode.
2. Compare with the committed goldens byte-for-byte.
3. Assert the bounded per-entry/action lines and the declared keys remain.
4. Assert a mutated renderer fails.

**Expected Outcome**:
- Byte-identical text and unchanged envelope shape.
- No key reordering.

**Pass/Fail Evidence**:
- `bun test tests/golden/queue-list.test.ts tests/golden/queue-plan.test.ts` exits 0.

#### TC-KEYVAL-003 - `verify` text is byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F9-1, NFR-6, Appendix A
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/verify-gates.test.ts`, `tests/golden/verify-deploy.test.ts`, plus `tests/golden/verify-change.test.ts` (new if no text golden exists)
**Tags**: @golden, @verify

**Preconditions**:
- Fixtures cover `verify change` full/lite/unknown, `verify gates` pass/fail, and `verify deploy` verified/unknown/failed.

**Steps**:
1. Run each verify variant in text mode.
2. Compare with the committed goldens byte-for-byte.
3. Assert `result=`, `variant=`, `missing=`, `detail=`, per-gate lines, and `verdict=` remain in order.
4. Assert a mutated renderer fails.

**Expected Outcome**:
- Byte-identical text; no key or line-shape change.

**Pass/Fail Evidence**:
- `bun test tests/golden/verify-gates.test.ts tests/golden/verify-deploy.test.ts tests/golden/verify-change.test.ts` exits 0.

#### TC-KEYVAL-004 - `plan` text is byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F9-1, NFR-6, Appendix A
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/plan-text.test.ts` (new); `tests/golden/plan/`
**Tags**: @golden, @plan

**Preconditions**:
- Fixtures cover `plan validate` valid/invalid, `plan diff` within/outside/truncated, and `plan overlap` parallel/sequence.

**Steps**:
1. Run each plan variant in text mode.
2. Compare with the committed goldens byte-for-byte.
3. Assert `verdict=`, `artifact=`, `tier=`, `readyForDevelopment=`, `error=`, `field=`, `against=`, `overlapping=`, `ordering=`, and `truncated=` remain in order.
4. Assert a mutated renderer fails.

**Expected Outcome**:
- Byte-identical text; no key or line-shape change.

**Pass/Fail Evidence**:
- `bun test tests/golden/plan-text.test.ts` exits 0; a missing fixture is a plan gap, not a silent pass.

#### TC-KEYVAL-005 - `blockers` text is byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F9-1, NFR-6, Appendix A
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/blockers.test.ts`; `tests/fixtures/blockers/golden`
**Tags**: @golden, @blockers

**Preconditions**:
- Fixtures cover open/answered counts, ranking, and the omission line.

**Steps**:
1. Run `blockers list`/`status` in text mode.
2. Compare with the committed goldens byte-for-byte.
3. Assert `open=`, `answered=`, the ranked question lines, and `+N more questions omitted` remain in order.
4. Assert a mutated renderer fails.

**Expected Outcome**:
- Byte-identical text; no key or ranking change.

**Pass/Fail Evidence**:
- `bun test tests/golden/blockers.test.ts` exits 0.

#### TC-KEYVAL-006 - Retained `deliver-ticket.sh` and `ceo-loop.sh` summaries are unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F9-2, NFR-6, Appendix A, DEC-12
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-deliver-ticket-result-tuples.sh`, `scripts/.tests/test-ceo-loop.sh`
**Tags**: @bash, @retained, @golden

**Preconditions**:
- The retained scripts and their tests are unchanged by this change.

**Steps**:
1. Run `bash scripts/.tests/test-deliver-ticket-result-tuples.sh`.
2. Run `bash scripts/.tests/test-ceo-loop.sh`.
3. Assert the summary keys `result=`, `pr_url=`, `exit_code=`, `closeout_unverified=`, `last_message=` and the `--status` keys remain.
4. Assert no prompt stops consuming the retained summary while dispatch is retained.

**Expected Outcome**:
- The retained key=value contract is unchanged: `result=`, `pr_url=`, `exit_code=`, `closeout_unverified=`, `last_message=`.
- The retained `--status` keys are unchanged: `delivering=`, `ref=`, `pid=`, `session_id=`, `stale=`, `delivering_marker=` for `deliver-ticket.sh`; `loop_running=`, `loop_pid=`, `ceo_alive=`, `ceo_pid=`, `ceo_session=`, `stop_signal=` for `ceo-loop.sh`.
- The tests pass with no new expectations.

**Pass/Fail Evidence**:
- Both shell tests exit 0; a key rename or removal fails the test.

#### TC-KEYVAL-007 - Appendix A register is complete and ordered

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F9-1, AC-F9-2, NFR-6
**Test Type(s)**: Golden / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/key-register.test.ts` (new); `tests/fixtures/key-register/register.json`
**Tags**: @golden, @conformance

**Preconditions**:
- The register fixture encodes every Appendix A surface and its key list in order.
- Each surface has a renderer entry point and a golden fixture.

**Steps**:
1. For every registered surface, extract the emitted keys from the text output.
2. Assert the emitted key sequence equals the register exactly.
3. Remove one key from a fixture and assert the check fails naming the surface and key.
4. Assert every Appendix A row has a test owner and a golden.

**Expected Outcome**:
- No surface is unowned.
- No key is missing, extra, or reordered.
- The register is non-vacuous.

**Pass/Fail Evidence**:
- `bun test tests/golden/key-register.test.ts` exits 0; a missing owner or key fails the test.

#### TC-ADOPT-001 - PM, coder, and command prompts use `phase` and `commit` only

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F3-2, AC-F2-1, AC-F3-1
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-conformance.test.ts`; `tests/checks/agent-role-conformance.test.ts` (new)
**Tags**: @prompts, @conformance

**Preconditions**:
- The inventory includes `pm.md`, `coder.md`, `committer.md`, `run-plan.md`, `commit.md`, and the affected commands.

**Steps**:
1. Assert PM completion instructions call `phase complete` and read with `phase list`.
2. Assert coder per-plan-phase commits call `commit` and `phase complete delivery` at the lifecycle boundary.
3. Assert commands call `commit` after the artifact write and never `@committer` with raw git.
4. Assert no prompt instructs `phase start`.

**Expected Outcome**:
- The phase and commit primitives are the only write paths taught.
- The compatibility `@committer` delegate is thin.
- No `phase start` claim.

**Pass/Fail Evidence**:
- `bun test tests/checks/agent-role-conformance.test.ts` exits 0; a missing primitive call or a raw-git step fails the role assertion.

#### TC-ADOPT-002 - Non-committing agents remain pure; callers own the commit

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/agent-role-conformance.test.ts`
**Tags**: @prompts, @conformance

**Preconditions**:
- The inventory includes `spec-writer.md`, `test-plan-writer.md`, `reviewer.md`, `readiness-reviewer.md`, `doc-syncer.md`, `pr-manager.md`, and `review-feedback-applier.md`.

**Steps**:
1. Assert each pure writer/reviewer prompt contains no commit trigger and no raw git.
2. Assert the caller-orchestrator prompt owns the commit trigger.
3. Assert `@pr-manager` never merges (no `gh pr merge`, `glab mr merge`, or `merge` command step) and never runs raw git (`git add`, `git commit`, `git reset`, amend, or a hand-crafted commit recipe). For a dirty worktree at PR time it invokes the typed `commit` primitive, or delegates to the thin `@committer` that only invokes `commit`; it does **not** assert "no commit at all" and does not forbid the dirty-tree commit path.
4. Assert `@pr-manager` keeps push and PR creation as its only retained git writes.
5. Mutate a temp copy with a commit step in a pure writer and assert a failure; mutate a temp copy with a raw-git or merge step in `pr-manager` and assert a failure.

**Expected Outcome**:
- Pure writers stay pure.
- The caller commits through `commit`.
- `@pr-manager` never merges and never runs raw git; a dirty worktree commits through `commit` or the thin `@committer`, and push/PR creation remain its only retained git writes.
- A correct dirty-tree delegation to `commit` is not reported as a violation.

**Pass/Fail Evidence**:
- `bun test tests/checks/agent-role-conformance.test.ts` exits 0; the mutants fail, while a dirty-tree `commit`/thin-`@committer` instruction passes.

#### TC-COORD-001 - J1 sequence is ordered and avoids raw merge/discovery

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F6-2, DEC-7
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/coordinator-sequence.test.ts`
**Tags**: @prompts, @coordinator, @conformance

**Preconditions**:
- The `ceo.md` J1 section is in the inventory.
- The required token order is status, blockers answer, verify change/phase list, merge, closeout, queue plan.

**Steps**:
1. Extract the J1 instruction block.
2. Assert the first occurrence order of the six steps.
3. Assert `gh pr list` and `gh pr merge` do not appear as primary steps.
4. Assert `queue plan --next` is the final next-pick call.
5. Assert the prompt also names `brief`, `lanes list/show`, `queue list/claim/release`, `spend`, and `retro` for their declared roles.

**Expected Outcome**:
- The sequence is exactly the declared order.
- No raw discovery or merge path is primary.
- The owner-facing, lane, and learning commands are present in their declared roles.
- The generated plugin contains the same sequence.

**Pass/Fail Evidence**:
- `bun test tests/checks/coordinator-sequence.test.ts` exits 0; an out-of-order or raw step fails the test.

#### TC-COORD-002 - `pr-open` finalization uses `verify` and `merge`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F6-1, DEC-7
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/coordinator-sequence.test.ts`
**Tags**: @prompts, @coordinator, @merge

**Preconditions**:
- The coordinator prompt contains the `pr-open` branch.

**Steps**:
1. Extract the `pr-open` block.
2. Assert `verify change` or `phase list` precedes `merge`.
3. Assert `gh pr merge` and `glab mr merge` are not command steps.
4. Assert `merge` is the only landing call in the block.

**Expected Outcome**:
- Finalization evidence is typed.
- The lifecycle merge path is `merge`, not a platform CLI.
- No `gh pr merge` primary path remains.

**Pass/Fail Evidence**:
- `bun test tests/checks/coordinator-sequence.test.ts` exits 0; a platform merge step fails the test.

#### TC-COORD-003 - Retained bash stays primary; `queue plan` next actions are consumed

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F6-3, AC-F6-4, DEC-7, NG-1
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/coordinator-sequence.test.ts`; `tests/checks/prompt-conformance.test.ts`
**Tags**: @prompts, @coordinator, @bash

**Preconditions**:
- Appendix B's retained/retired classification is encoded in the fixture.

**Steps**:
1. Assert `deliver-ticket.sh` is the primary per-ticket call with a retained-until-M1-S9 label.
2. Assert `ceo-loop.sh` is the outer supervisor with a retained-until-M1-S18 label.
3. Assert no `dispatch` or daemon claim.
4. Assert the prompt consumes `nextActions` and reasons from `queue plan --next N` rather than diff/queue discovery.

**Expected Outcome**:
- Retained bash remains primary where it is today.
- The next pick is typed.
- No undelivered story is claimed.

**Pass/Fail Evidence**:
- `bun test tests/checks/coordinator-sequence.test.ts tests/checks/prompt-conformance.test.ts` exits 0.

#### TC-BLKADOPT-001 - Lanes publish typed blockers and stop writing pm-notes `blockers:`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F5-1, DEC-6
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/pm-notes-lint.test.ts`
**Tags**: @prompts, @blockers

**Preconditions**:
- The lane prompts are in the inventory.
- A pm-notes fixture with a schema-allowed `blockers:` collection exists.

**Steps**:
1. Assert every lane blocker instruction uses `blockers publish` with a closed type and `--lane`.
2. Assert no prompt instructs writing the pm-notes `blockers:` collection.
3. Assert the pm-notes schema still accepts the collection (not a schema removal).
4. Assert lane identifiers follow the declared role-plus-ref convention and no new lane registry is introduced.
5. Assert the published question ranks in `status` and `brief`.

**Expected Outcome**:
- Typed publication is the only agent write path.
- The schema stays backward-compatible.
- Lane identifiers are stable and conventional; no new registry exists.
- The question is visible in the digest and brief.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/pm-notes-lint.test.ts` exits 0.

#### TC-BLKADOPT-002 - The coordinator answers blockers as data

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F5-2, DEC-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-answer-adoption.test.ts`
**Tags**: @backend, @blockers, @coordinator

**Preconditions**:
- The blockers harness seeds an open `decision-needed` question for a lane.
- The caller audience is the coordinator or the owner; a non-audience caller is also available.

**Steps**:
1. Read the open question from `status --json` and `blockers list --open`.
2. Answer with `blockers answer Q-0001 --choice 2` in one case and `--text "use option two"` in another.
3. Assert the answer record carries the substance, `applied`, and `laneResume`.
4. Assert the non-audience caller is refused by the audience routing.

**Expected Outcome**:
- The question is answerable as data.
- The answer record carries the required posture.
- Audience routing is enforced.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/blockers-answer-adoption.test.ts` exits 0; a missing posture field or a permitted non-audience answer fails the test.

#### TC-BLKADOPT-003 - Credential questions carry names only and values are refused

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F5-3, NFR-9
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/blockers-credential.test.ts`, `blockers-credential-shape.test.ts`, `blockers-credential-negative-controls.test.ts`; plus the prompt scan
**Tags**: @backend, @blockers, @security

**Preconditions**:
- The credential question fixtures and the canary values exist.

**Steps**:
1. Publish a `credential-missing` question naming only the environment variable.
2. Assert the text contains the variable name and no value.
3. Attempt to answer with a value and assert `blockers.credential-value-rejected`.
4. Scan the prompt/guide inventory for credential examples that contain values.

**Expected Outcome**:
- Names only; values are refused.
- No prompt example contains a real or shaped credential value.
- The existing guard behavior is unchanged.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/blockers-credential.test.ts` exits 0; the prompt scan reports zero value-shaped findings.

#### TC-PILOT-001 - Pilot repository seeds real state, git, and files

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, AC-F10-3, Appendix D
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/pilot/pilot-fixture.test.ts`; `tests/fixtures/pilot/harness.ts`, `tests/fixtures/pilot/repo.ts`, `tests/fixtures/pilot/stubs.ts`
**Tags**: @conformance, @pilot

**Preconditions**:
- The harness creates a temporary repository, a local bare remote, a state directory, and a change folder.
- The seeds include a validated plan, pm-notes, a ready item, and one open typed question.

**Steps**:
1. Seed the pilot repository and assert the file tree.
2. Run `plan validate` and `lint` on the seeded artifacts.
3. Assert the state store opens and the ready item/question are present.
4. Assert the real git repository and bare remote are initialized.

**Expected Outcome**:
- The seeds validate.
- The state, git, and files are real and usable.
- The fixture is self-contained and removed in teardown.

**Pass/Fail Evidence**:
- `bun test tests/conformance/pilot/pilot-fixture.test.ts` exits 0; an invalid seed or a missing remote fails the test.

#### TC-PILOT-002 - The full J1 sequence returns the expected next action

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-7, AC-F10-1, AC-F6-2, AC-F6-4
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/pilot/j1-iteration.test.ts`
**Tags**: @conformance, @pilot, @coordinator

**Preconditions**:
- The TC-PILOT-001 fixture is seeded.
- Tracker, CI, PR-platform, and provider surfaces are stubbed; state, git, files, envelopes, and exits are real.

**Steps**:
1. Run `status --json` and assert the digest sections and the open question.
2. Run `blockers answer Q-0001 --choice 2`.
3. Run `verify change GH-310` and `phase list GH-310`.
4. Run `merge GH-310`.
5. Run `closeout GH-310 --apply`.
6. Run `queue plan --next 1`.
7. Assert the final `nextActions[0].ref` is the expected next ref and the reasons are present.

**Expected Outcome**:
- Every command returns its declared success/verdict.
- State, git, and files reflect each operation.
- The next action names the expected ref with reasons.
- No `gh pr list` or `gh pr merge` is invoked.

**Pass/Fail Evidence**:
- `bun test tests/conformance/pilot/j1-iteration.test.ts` exits 0; any wrong verdict, missing state effect, or wrong next ref fails the test.

#### TC-PILOT-003 - The stub/real matrix matches Appendix D

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-3, Appendix D
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/pilot/pilot-isolation.test.ts`
**Tags**: @conformance, @pilot, @isolation

**Preconditions**:
- Every port is wrapped in a recorder.
- The Appendix D matrix is encoded in `tests/fixtures/pilot/matrix.ts`.

**Steps**:
1. Run the J1 sequence.
2. Assert the state ledger, git objects, change files, envelopes, text renderers, and exit codes are the real implementations.
3. Assert tracker, CI, PR-platform, and provider/network calls are all recorded stubs.
4. Assert the clock and id generator are stubbed or deterministically injected and fixed.
5. Assert no production entrypoint is reachable from the pilot composition.

**Expected Outcome**:
- The real/stub split matches Appendix D exactly: state, git, files, envelopes, text, and exits are real; tracker, CI, PR-platform, and provider/network are stubbed; clock and ids are stubbed or deterministically injected.
- Real evidence exists for state, git, files, envelopes, and exits.
- The pilot composition is test-only.

**Pass/Fail Evidence**:
- `bun test tests/conformance/pilot/pilot-isolation.test.ts` exits 0; a real external call or a stubbed real surface fails the matrix assertion.

#### TC-PILOT-004 - Zero outbound tracker, CI, PR-platform, provider, or network calls

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-2, NFR-7
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/pilot/pilot-isolation.test.ts`
**Tags**: @conformance, @pilot, @network

**Preconditions**:
- A no-spawn guard and a network guard are installed, following `tests/fixtures/result/no-spawn-guard.ts` and the existing hermetic patterns.
- Every stub records call counts.

**Steps**:
1. Run the full J1 sequence.
2. Assert the tracker, CI, PR-platform, and provider stub call counters are zero for outbound calls.
3. Assert the network guard reports no fetch/http/socket use.
4. Assert no `gh`, `glab`, or provider CLI is spawned.

**Expected Outcome**:
- Zero outbound calls of any kind.
- The only process is the local `git` needed for real objects and landing.

**Pass/Fail Evidence**:
- `bun test tests/conformance/pilot/pilot-isolation.test.ts` exits 0; any outbound counter or spawn violation fails the test.

#### TC-PILOT-005 - Two runs replay byte-identically

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-2, AC-NFR3-1, NFR-3, NFR-7
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/pilot/pilot-determinism.test.ts`
**Tags**: @conformance, @pilot, @determinism

**Preconditions**:
- Two fresh temp roots are seeded with identical fixtures.
- The clock, run ids, and id generator are fixed to the same sequence.

**Steps**:
1. Run the full J1 sequence in root A and root B.
2. Canonicalize paths, then compare every stdout, envelope, state record, and file content byte-for-byte.
3. Assert the run ids and timestamps are identical.
4. Assert a deliberate clock change produces a different but still deterministic result.

**Expected Outcome**:
- The two runs are byte-identical after path canonicalization.
- The record order is stable.
- The clock change is the only source of a different output.

**Pass/Fail Evidence**:
- `bun test tests/conformance/pilot/pilot-determinism.test.ts` exits 0; a byte diff names the first differing artifact.

#### TC-PILOT-006 - Durable records, deterministic bounds, and cleanup hold

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-10, AC-F10-1, AC-F10-2, NFR-8, section 8.2
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/pilot/pilot-records.test.ts` and `pilot-runtime.test.ts`
**Tags**: @conformance, @pilot, @records, @determinism

**Preconditions**:
- The pilot run from TC-PILOT-002 has completed.
- The clock and id generator are fixed; the harness exposes the step/retry budget and a sleep guard.
- The suite runs under the repository's fixed `bun test` timeout; duration is recorded as informational metadata only.

**Steps**:
1. Assert `phase.transition` and `commit.telemetry` records exist with the expected identities.
2. Assert the merge, closeout, and blocker-answer records exist with the expected keys.
3. Assert the deterministic pilot conditions hold: the clock and ids are fixed/identically injected for both runs, the fixed step/retry budget is not exceeded, the sleep guard records zero sleeps, and no outbound call is made (re-assert with `TC-PILOT-004`).
4. Assert the two-run replay is byte-identical (`TC-PILOT-005`).
5. Assert the suite completes inside the fixed test-runner timeout, and record the wall-clock duration as informational output only. Do not assert a 180 s (or any wall-clock) threshold.
6. Assert every temp repository, state directory, and bare remote is removed in teardown.

**Expected Outcome**:
- The durable evidence is present and keyed correctly.
- The deterministic conditions hold: fixed clock/ids, no sleeps, bounded step/retry budget, zero outbound calls, byte-identical replay, fixed runner timeout.
- The recorded duration is informational and never decides pass/fail.
- No temp artifact survives.

**Pass/Fail Evidence**:
- `bun test tests/conformance/pilot/pilot-records.test.ts tests/conformance/pilot/pilot-runtime.test.ts` exits 0; a missing record, a sleep, an exceeded step/retry budget, a non-identical replay, a timeout, or a surviving temp root fails the test. A duration above 180 s alone does not fail it.

## 6. Environments and Test Data

### 6.1 Environment Rules

- **In-process by default.** Behaviour, structure, checks, golden, and conformance suites use `bun:test` and injected `CliDependencies`; no test reaches the live state directory, the live git remote, the network, or the wall clock.
- **Temporary roots.** Every suite that needs files uses `mkdtempSync` under `os.tmpdir()` (or the existing `makeTempRoot`/`withCommitHarness` helpers) and removes the root in `afterAll`/`finally`.
- **Fixed clock and ids.** The pilot and golden suites use a fixed clock (`2026-11-07T00:00:00Z` or the existing fixture constant) and a deterministic id sequence. No `Date.now()` or random id appears in an assertion path.
- **Sanitized environment.** The harness one-shot test passes an explicit environment record; no test mutates `process.env` for another test. Canary keys prove deny-by-default.
- **No child process except git.** The commit/phase and pilot suites spawn the local `git` binary for real objects and landing; every other external surface is injected.
- **CI.** The new invariant checks run with `bun run scripts/checks/*.ts` and are mutation-tested by `tests/checks/**`; the aggregate gate is `pnpm check`. The pilot suite is part of `bun test`; its bounds are deterministic (fixed clock/ids, no sleeps, bounded step/retry budget, byte-identical replay) and the fixed test-runner timeout, with wall-clock duration informational only.
- **Working directory.** Tests that inspect paths use `process.cwd()` only for read-only fixture discovery, never for writes.

### 6.2 Test Data and Fixtures Inventory

| Fixture / data | Status | Purpose | Closest existing pattern |
|---|---|---|---|
| `tests/fixtures/entrypoint/programs.ts` | New | Synthetic entrypoint programs, brand identities, and every section 8.1 invocation tuple for help coverage | `tests/fixtures/result/programs` + `tests/golden/helpers.ts` |
| `tests/fixtures/prompt-inventory/lifecycle.json` | New | Inventory of `.opencode/agent/*.md` and `.opencode/command/*.md` | `tests/structure/inventory.json` |
| `tests/fixtures/prompt-inventory/allowed-commands.json` | New | Section 8.1 allowed set and subcommands | `tests/structure/inventory.json` |
| `tests/fixtures/prompt-inventory/allowlist.json` | New | Read-only git and `@pr-manager` push/PR-creation allowances | `tests/fixtures/forbidden-literals/true-positives.json` |
| `tests/fixtures/prompt-inventory/retained-retired.json` | New | Appendix B classification | `scripts/checks/forbidden-literals.registry.json` |
| `tests/fixtures/prompt-inventory/mutants/` | New | One forbidden pattern per scan rule | `tests/fixtures/forbidden-literals/true-positives.json` |
| `tests/fixtures/help-guide/coverage.json` | New (created in phase 1; static) | Invocation to help and reference-page obligation mapping; phase 1 asserts see-also rows, phase 8 asserts reconciled page existence/parity | `tests/fixtures/result/result-shape.json` |
| `tests/fixtures/key-register/register.json` | New | Appendix A surface-to-key register | `tests/fixtures/result/envelope-key-set.json` |
| `doc/planning/oss-tooling/milestones/m1/commands/entrypoint.md` | New | Root/entrypoint reference page for `--help`/`--version` | `doc/planning/oss-tooling/milestones/m1/man-page.md` |
| `tests/fixtures/commit/harness.ts` | Existing, extend | In-session facts, change-folder staging, ordering recorder, reverse-window injection | `withCommitHarness` |
| `tests/fixtures/phase/full-open.yaml`, `lite-open.yaml` | Existing | Lifecycle phase fixtures for completion | `tests/behaviour/phase-*` |
| `tests/fixtures/plan/summary/` | New | Summary-present, summary-absent, and invalid-summary plan fixtures | `plan-validate.test.ts` |
| `tests/fixtures/pm-notes/valid/` | Existing, extend | PR-URL `notes:` entry and schema-allowed `blockers:` | `pm-notes-lint.test.ts` |
| `tests/fixtures/merge/golden/` | Existing | Merge key=value goldens | `tests/golden/merge.test.ts` |
| `tests/fixtures/queue-ready/golden/` | Existing | Queue list/plan key=value goldens | `tests/golden/queue-*.test.ts` |
| `tests/fixtures/status/golden/` | Existing | Digest fixture used by the pilot seed | `tests/fixtures/status/harness.ts` |
| `tests/fixtures/closeout/golden/` | Existing | Closeout envelope/human goldens | `tests/fixtures/closeout/harness.ts` |
| `tests/fixtures/blockers/golden/` | Existing | Blockers key=value goldens | `tests/golden/blockers.test.ts` |
| `tests/fixtures/verify`, `tests/fixtures/verify-gates`, `tests/fixtures/verify-deploy` | Existing, extend | Verify change/gates/deploy text goldens | `tests/golden/verify-*.test.ts` |
| `tests/golden/plan/` | New | Plan text key=value goldens (not `tests/fixtures/plan/golden`) | `tests/fixtures/merge/golden/*.txt` |
| `tests/fixtures/result/code-corpora/true-positives.json` | Existing, updated | Remove the retired `commit.session.context-refused` positive; no new corpus file | `error-table-sync.test.ts` |
| `tests/fixtures/result/code-corpora/false-positives.json` | Existing, unchanged | Negative corpus; not used to prove retirement | `error-table-sync.test.ts` |
| `tests/fixtures/pilot/harness.ts` | New | Temp repo, bare remote, state store, stubbed or deterministically injected clocks/ids | `tests/fixtures/commit/harness.ts` + `tests/fixtures/merge/git-harness.ts` |
| `tests/fixtures/pilot/repo.ts` | New | Seed change folder, plan, pm-notes, ready item | `tests/fixtures/closeout/temp-git.ts` |
| `tests/fixtures/pilot/stubs.ts` | New | Tracker, CI, PR-platform, provider stubs with counters | `tests/fixtures/merge/harness.ts` |
| `tests/fixtures/pilot/matrix.ts` | New | Appendix D real/stub matrix assertion data | `tests/fixtures/status/matrix` |
| `tests/checks/pilot-privacy.test.ts` | New (phase 9) | Pilot-data privacy/secret scan and canary mutants (the pilot half of the split from `TC-PSCAN-009`) | `tests/checks/privacy-authoring.test.ts` |
| `tests/conformance/pilot/*.test.ts` | New | Pilot J1 suite: fixture, iteration, isolation, determinism, records, runtime | `tests/conformance/**` |

The fixture names above are canonical: the plan, this test plan, and the tests must use them identically. No alternative names (`matrix.json`, `roles.json`, `prompt-command-set.ts`, `tests/fixtures/plan/golden`, `tests/fixtures/plan/valid|invalid` for summary cases) are used anywhere. The privacy/secret scan is split by owning phase: `TC-PSCAN-006` and `TC-PSCAN-009` cover the prompts/guides and non-pilot fixtures in phase 8; `TC-PSCAN-010` covers the pilot fixtures and pilot suite created in phase 9. The commit safety scan re-runs in both phases.

### 6.3 Isolation and Cleanup

- The pilot suite uses a single temp root per case, a local bare repository as the landing target, and a state directory inside the root; teardown removes the root recursively.
- The one-shot test asserts the temporary empty project directory is removed on both success and failure.
- Golden suites never regenerate fixtures implicitly; a deliberate change runs the explicit `regenerate.ts` command and the diff is reviewed.
- The prompt/doc scans accept an injected root; mutation tests copy the inventory to a temp root and never write the live tree.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file / check | Execution command | Implementation status | Required mocks/stubs |
|---|---|---|---|---|
| TC-ENTRY-001 | `tests/behaviour/entrypoint-version.test.ts` | `bun test tests/behaviour/entrypoint-version.test.ts` | Implemented | In-process entrypoint; recording state/git/network ports |
| TC-ENTRY-002 | `tests/behaviour/entrypoint-version.test.ts` | `bun test tests/behaviour/entrypoint-version.test.ts` | Implemented | Synthetic environment record; configured/override/neutral-default cases |
| TC-ENTRY-003 | `tests/behaviour/entrypoint-help.test.ts` | `bun test tests/behaviour/entrypoint-help.test.ts` | Implemented | Recording ports |
| TC-ENTRY-004 | `tests/behaviour/entrypoint-help-coverage.test.ts` | `bun test tests/behaviour/entrypoint-help-coverage.test.ts` | Implemented | `tests/fixtures/entrypoint/programs.ts` command-set fixture; static `tests/fixtures/help-guide/coverage.json` from phase 1 |
| TC-ENTRY-005 | `tests/behaviour/entrypoint-help-isolation.test.ts` | `bun test tests/behaviour/entrypoint-help-isolation.test.ts` | Implemented | Empty temp directory |
| TC-ENTRY-006 | `tests/behaviour/entrypoint-help-isolation.test.ts` | `bun test tests/behaviour/entrypoint-help-isolation.test.ts` | Implemented | Poisoned ports; no-spawn guard |
| TC-ENTRY-007 | `tests/checks/forbidden-literals.test.ts` | `bun test tests/checks/forbidden-literals.test.ts` | Existing, updated | Temp copy mutation |
| TC-ENTRY-008 | `tests/structure/entrypoint-installer-absence.test.ts`; `scripts/.tests/test-install.sh` | `bun test tests/structure/entrypoint-installer-absence.test.ts && bash scripts/.tests/test-install.sh` | Implemented | Shell temp install root |
| TC-ENTRY-009 | `tests/behaviour/entrypoint-composition.test.ts`; `tests/structure/state-scope.test.ts`; `tests/structure/error-table.test.ts` | `bun test tests/behaviour/entrypoint-composition.test.ts tests/structure/state-scope.test.ts tests/structure/error-table.test.ts` | Implemented | Registry inspection; uncomposed invocation; `fallback.internal` identity; absence assertions |
| TC-ENTRY-010 | `tests/structure/entrypoint-bin.test.ts` | `bun test tests/structure/entrypoint-bin.test.ts` | Implemented | `packages/cli/package.json` `bin`/`main`; installer arrays |
| TC-SESS-001 | `tests/behaviour/commit-session-adoption.test.ts` | `bun test tests/behaviour/commit-session-adoption.test.ts` | Existing, updated | `withCommitHarness`; scripted transport/safety |
| TC-SESS-002 | `tests/behaviour/phase-session-adoption.test.ts` | `bun test tests/behaviour/phase-session-adoption.test.ts` | Existing, updated | `withCommitHarness`; in-session facts; phase-2 scope only (no staging assertions) |
| TC-SESS-003 | `tests/behaviour/commit-session-adoption.test.ts` | `bun test tests/behaviour/commit-session-adoption.test.ts` | Existing, updated | Paired runs with/without session facts |
| TC-SESS-004 | `tests/behaviour/harness-oneshot-context.test.ts` | `bun test tests/behaviour/harness-oneshot-context.test.ts` | Implemented | Recording harness runner |
| TC-SESS-005 | `tests/structure/commit-contract.test.ts` | `bun test tests/structure/commit-contract.test.ts` | Existing, updated | Source scan |
| TC-ERRROW-001 | `tests/structure/commit-contract.test.ts` | `bun test tests/structure/commit-contract.test.ts` | Existing, updated | None |
| TC-ERRROW-002 | `tests/checks/error-table-sync.test.ts` | `bun test tests/checks/error-table-sync.test.ts` | Existing, updated | Temp copy mutation |
| TC-ERRROW-003 | `tests/checks/error-table-sync.test.ts`; `tests/fixtures/result/code-corpora/true-positives.json` | `bun test tests/checks/error-table-sync.test.ts tests/structure/result-contract.test.ts` | Existing, updated | Existing corpus; temp-copy re-introduction mutants |
| TC-ERRROW-004 | `tests/checks/decision-record.test.ts`; manual review | `bun test tests/checks/decision-record.test.ts` | Implemented / Manual review | None |
| TC-STAGE-001 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | Implemented | `withCommitHarness`; multi-phase plan |
| TC-STAGE-002 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | Implemented | Stray files; `excluded` assertion |
| TC-STAGE-003 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | Implemented | Plan-absent fixture |
| TC-STAGE-004 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | Implemented | Two delivery-kind phases |
| TC-STAGE-005 | `tests/behaviour/commit-staging-scope.test.ts` | `bun test tests/behaviour/commit-staging-scope.test.ts` | Implemented | Plan-present and plan-absent fixtures |
| TC-STAGE-006 | `tests/behaviour/phase-completion-ordering.test.ts` | `bun test tests/behaviour/phase-completion-ordering.test.ts` | Implemented | Recording filesystem and commit seam |
| TC-STAGE-007 | `tests/behaviour/phase-completion-convergence.test.ts` | `bun test tests/behaviour/phase-completion-convergence.test.ts` | Implemented | Constructed post-commit/pre-document state |
| TC-STAGE-008 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | Implemented | Forbidden path and oversized binary |
| TC-STAGE-009 | `tests/behaviour/phase-completion-reverse-window.test.ts` | `bun test tests/behaviour/phase-completion-reverse-window.test.ts` | Implemented | Scripted post-document commit failures; pre-write snapshot recorder |
| TC-STAGE-010 | `tests/behaviour/phase-completion-reverse-window.test.ts` | `bun test tests/behaviour/phase-completion-reverse-window.test.ts` | Implemented | Scripted commit and restore failures; classified fault envelope |
| TC-PLANSUM-001 | `tests/behaviour/plan-summary.test.ts`; `tests/fixtures/plan/summary/` | `bun test tests/behaviour/plan-summary.test.ts` | Implemented | Summary-present fixture |
| TC-PLANSUM-002 | `tests/behaviour/plan-summary.test.ts`; `tests/fixtures/plan/summary/` | `bun test tests/behaviour/plan-summary.test.ts` | Implemented | Summary-absent and legacy fixtures |
| TC-PLANSUM-003 | `tests/checks/plan-consumer-inventory.test.ts` | `bun test tests/checks/plan-consumer-inventory.test.ts` | Implemented | Code/template consumer inventory only |
| TC-PLANSUM-004 | `tests/structure/plan-writer-prompt.test.ts`; `tests/behaviour/commit-message.test.ts` | `bun test tests/structure/plan-writer-prompt.test.ts tests/behaviour/commit-message.test.ts` | Implemented | Plan-writer prompt/template; summary fixtures |
| TC-PLANSUM-005 | `tests/checks/prompt-conformance.test.ts` | `bun test tests/checks/prompt-conformance.test.ts` | Implemented | `tests/fixtures/prompt-inventory/lifecycle.json`; plan-progress mutant |
| TC-PSCAN-001 | `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/phase-write-path-lint.test.ts` | `bun run scripts/checks/prompt-conformance.ts && bun test tests/checks/prompt-conformance.test.ts tests/behaviour/phase-write-path-lint.test.ts` | Implemented | Temp copy mutants |
| TC-PSCAN-002 | `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts` | `bun run scripts/checks/prompt-conformance.ts && bun test tests/checks/prompt-conformance.test.ts` | Implemented | Temp copy mutants |
| TC-PSCAN-003 | `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts` | `bun run scripts/checks/prompt-conformance.ts && bun test tests/checks/prompt-conformance.test.ts` | Implemented | Allowed-command fixture |
| TC-PSCAN-004 | `tests/checks/prompt-conformance.test.ts`; `tests/fixtures/prompt-inventory/retained-retired.json` | `bun test tests/checks/prompt-conformance.test.ts` | Implemented | Retained/retired fixture |
| TC-PSCAN-005 | `tests/checks/prompt-conformance-mutants.test.ts`; `tests/fixtures/prompt-inventory/mutants/` | `bun test tests/checks/prompt-conformance-mutants.test.ts` | Implemented | Mutant corpus; temp copy |
| TC-PSCAN-006 | `tests/checks/prompt-secret-scan.test.ts`; `tests/checks/privacy-authoring.test.ts`; `tests/behaviour/commit-safety.test.ts` | `bun test tests/checks/prompt-secret-scan.test.ts tests/checks/privacy-authoring.test.ts tests/behaviour/commit-safety.test.ts` | Implemented | Canary fixtures; new fixture inventory |
| TC-PSCAN-007 | `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/commit-command.test.ts` | `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/commit-command.test.ts` | Implemented | Commit harness |
| TC-PSCAN-008 | `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/pm-notes-lint.test.ts` | `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/pm-notes-lint.test.ts` | Implemented | pm-notes fixture |
| TC-PSCAN-009 | `tests/checks/prompt-secret-scan.test.ts`; `tests/checks/privacy-authoring.test.ts`; `tests/behaviour/commit-safety.test.ts` | `bun test tests/checks/prompt-secret-scan.test.ts tests/checks/privacy-authoring.test.ts tests/behaviour/commit-safety.test.ts` | Implemented | Canary values for every non-pilot fixture class; no pilot data |
| TC-PSCAN-010 | `tests/checks/pilot-privacy.test.ts`; `tests/checks/prompt-secret-scan.test.ts`; `tests/checks/privacy-authoring.test.ts`; `tests/behaviour/commit-safety.test.ts` | `bun test tests/checks/pilot-privacy.test.ts tests/checks/prompt-secret-scan.test.ts tests/checks/privacy-authoring.test.ts tests/behaviour/commit-safety.test.ts` | Implemented | Canary values for pilot fixture classes; phase-9 pilot data |
| TC-HELP-001 | `scripts/checks/help-guide-coverage.ts`; `tests/checks/help-guide-coverage.test.ts`; `tests/fixtures/help-guide/coverage.json` | `bun run scripts/checks/help-guide-coverage.ts && bun test tests/checks/help-guide-coverage.test.ts` | Implemented | `coverage.json` fixture |
| TC-HELP-002 | `tests/checks/help-guide-coverage-mutants.test.ts` | `bun test tests/checks/help-guide-coverage-mutants.test.ts` | Implemented | Temp copy mutants |
| TC-HELP-003 | `tests/checks/reference-page-parity.test.ts` | `bun test tests/checks/reference-page-parity.test.ts` | Implemented | Help output capture |
| TC-DOCREC-001 | `scripts/.tests/test-build-claude-plugin.sh` | `bash scripts/.tests/test-build-claude-plugin.sh` | Existing, verified | Temp build copy |
| TC-DOCREC-002 | `tests/checks/doc-conformance.test.ts` (`scope: docs`) | `bun test tests/checks/doc-conformance.test.ts` | Implemented / Manual review | Phase-7 phrase fixtures |
| TC-DOCREC-003 | `tests/checks/doc-conformance.test.ts` (`scope: full`) | `bun test tests/checks/doc-conformance.test.ts` | Implemented | Complete §16.1.1 phrase fixtures; four omitted specs; generic row |
| TC-DOCREC-004 | `tests/checks/doc-conformance.test.ts` (`scope: behavior-spec`) | `bun test tests/checks/doc-conformance.test.ts -t "scope: behavior-spec"` | Implemented | Phase-3 rows of the §16.1.1 phrase table |
| TC-KEYVAL-001 | `tests/golden/merge.test.ts` | `bun test tests/golden/merge.test.ts` | Existing, updated | Merge fixtures |
| TC-KEYVAL-002 | `tests/golden/queue-list.test.ts`; `tests/golden/queue-plan.test.ts` | `bun test tests/golden/queue-list.test.ts tests/golden/queue-plan.test.ts` | Existing, updated | Queue fixtures |
| TC-KEYVAL-003 | `tests/golden/verify-gates.test.ts`; `tests/golden/verify-deploy.test.ts`; `tests/golden/verify-change.test.ts` | `bun test tests/golden/verify-*.test.ts` | Existing, updated | Verify fixtures |
| TC-KEYVAL-004 | `tests/golden/plan-text.test.ts`; `tests/golden/plan/` | `bun test tests/golden/plan-text.test.ts` | Implemented | `tests/golden/plan/` goldens |
| TC-KEYVAL-005 | `tests/golden/blockers.test.ts` | `bun test tests/golden/blockers.test.ts` | Existing, updated | Blockers fixtures |
| TC-KEYVAL-006 | `scripts/.tests/test-deliver-ticket-result-tuples.sh`; `scripts/.tests/test-ceo-loop.sh` | `bash scripts/.tests/test-deliver-ticket-result-tuples.sh && bash scripts/.tests/test-ceo-loop.sh` | Existing, verified | Shell temp roots |
| TC-KEYVAL-007 | `tests/golden/key-register.test.ts` | `bun test tests/golden/key-register.test.ts` | Implemented | Register fixture |
| TC-ADOPT-001 | `tests/checks/agent-role-conformance.test.ts` | `bun test tests/checks/agent-role-conformance.test.ts` | Implemented | Prompt inventory |
| TC-ADOPT-002 | `tests/checks/agent-role-conformance.test.ts` | `bun test tests/checks/agent-role-conformance.test.ts` | Implemented | Prompt inventory |
| TC-COORD-001 | `tests/checks/coordinator-sequence.test.ts` | `bun test tests/checks/coordinator-sequence.test.ts` | Implemented | `ceo.md` inventory |
| TC-COORD-002 | `tests/checks/coordinator-sequence.test.ts` | `bun test tests/checks/coordinator-sequence.test.ts` | Implemented | `ceo.md` inventory |
| TC-COORD-003 | `tests/checks/coordinator-sequence.test.ts`; `tests/checks/prompt-conformance.test.ts` | `bun test tests/checks/coordinator-sequence.test.ts tests/checks/prompt-conformance.test.ts` | Implemented | Retained/retired fixture |
| TC-BLKADOPT-001 | `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/pm-notes-lint.test.ts` | `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/pm-notes-lint.test.ts` | Implemented | pm-notes fixture |
| TC-BLKADOPT-002 | `tests/behaviour/blockers-answer-adoption.test.ts` | `bun test tests/behaviour/blockers-answer-adoption.test.ts` | Existing, updated | Blockers harness |
| TC-BLKADOPT-003 | `tests/behaviour/blockers-credential*.test.ts` | `bun test tests/behaviour/blockers-credential.test.ts tests/behaviour/blockers-credential-shape.test.ts tests/behaviour/blockers-credential-negative-controls.test.ts` | Existing, verified | Canary fixtures |
| TC-PILOT-001 | `tests/conformance/pilot/pilot-fixture.test.ts` | `bun test tests/conformance/pilot/pilot-fixture.test.ts` | Implemented | `tests/fixtures/pilot/*` |
| TC-PILOT-002 | `tests/conformance/pilot/j1-iteration.test.ts` | `bun test tests/conformance/pilot/j1-iteration.test.ts` | Implemented | Real state/git/files; stubs |
| TC-PILOT-003 | `tests/conformance/pilot/pilot-isolation.test.ts` | `bun test tests/conformance/pilot/pilot-isolation.test.ts` | Implemented | Recorder ports; matrix fixture |
| TC-PILOT-004 | `tests/conformance/pilot/pilot-isolation.test.ts` | `bun test tests/conformance/pilot/pilot-isolation.test.ts` | Implemented | No-spawn and network guards |
| TC-PILOT-005 | `tests/conformance/pilot/pilot-determinism.test.ts` | `bun test tests/conformance/pilot/pilot-determinism.test.ts` | Implemented | Two seeded temp roots |
| TC-PILOT-006 | `tests/conformance/pilot/pilot-records.test.ts`; `tests/conformance/pilot/pilot-runtime.test.ts` | `bun test tests/conformance/pilot` | Implemented | State records; fixed clock/ids; sleep guard; step/retry budget |

### 7.1 Execution Order

1. Narrow static checks: `git diff --check`, markdown/YAML review for changed docs.
2. Structure and checks: `bun test tests/structure tests/checks`.
3. Behaviour: `bun test tests/behaviour`.
4. Golden: `bun test tests/golden`.
5. Pilot: `bun test tests/conformance/pilot`.
6. Shell: `bash scripts/.tests/test-build-claude-plugin.sh`, `bash scripts/.tests/test-install.sh`, `bash scripts/.tests/test-deliver-ticket-result-tuples.sh`, `bash scripts/.tests/test-ceo-loop.sh`.
7. Aggregate: `pnpm check`.

### 7.2 Plan Phase Mapping

Each plan phase must be independently green. The revised phase order and the test cases it owns are:

| Plan phase | Scope | TC IDs |
|---|---|---|
| 1 | Executable bin/composition, root/command help, version identity, composition honesty; creates the static coverage inventory | `TC-ENTRY-001` through `TC-ENTRY-010` |
| 2 | Delivery-session guard reversal, sanitized one-shot, error-row retirement, TDR verification | `TC-SESS-001` through `TC-SESS-005`; `TC-ERRROW-001` through `TC-ERRROW-004` |
| 3 | Staging scope, plan-absent staging, completion ordering, reverse-window restore, failed-restore exit 2, convergence; reconciles the two §16.1.1 ordering/staging behavior-spec rows | `TC-STAGE-001` through `TC-STAGE-010`; `TC-DOCREC-004` |
| 4 | Plan contract/validator/template/plan-writer and code/template consumers only | `TC-PLANSUM-001` through `TC-PLANSUM-004` |
| 5 | Foundation prompt adoption (PM, coder, committer, commit, run-plan) | `TC-ADOPT-001`, `TC-ADOPT-002`, `TC-PLANSUM-005` (scan re-run in phase 8) |
| 6 | Coordination prompt adoption (ceo, lanes, remaining commands) | `TC-COORD-001` through `TC-COORD-003`; `TC-BLKADOPT-001` through `TC-BLKADOPT-003` |
| 7 | Guides, man page, and reference pages only (scoped doc conformance); updates the pages the phase-8 coverage/parity cases verify | `TC-DOCREC-002`; `TC-HELP-003` supporting |
| 8 | Non-pilot prompt/doc scans over `.opencode/**` and the phase-7 updated guides/man/reference pages, help coverage, reference parity, non-pilot secret/safety re-runs, key=value goldens | `TC-PSCAN-001` through `TC-PSCAN-009` (excludes `TC-PSCAN-010`); `TC-HELP-001`, `TC-HELP-002`, `TC-HELP-003`; `TC-KEYVAL-001` through `TC-KEYVAL-007`; `TC-PLANSUM-005` re-run |
| 9 | Pilot J1 conformance suite; pilot fixture/suite privacy and safety scan after the pilot data exists | `TC-PILOT-001` through `TC-PILOT-006`; `TC-PSCAN-010` |
| 10 | Final plugin freshness, full feature-spec conformance against the complete §16.1.1 phrase table (including the system-spec raw-git/phase-state rules), aggregate gate, clean tree | `TC-DOCREC-001`, `TC-DOCREC-003`; full `pnpm check` re-runs every family |

The plan YAML must list the same fixture names and the same phase-owned test files as section 6.2 and section 7. A test declared in a phase must pass with only that phase's scope applied. In particular, phase 3's scope/test list must include the two behavior-spec pages and the `scope: behavior-spec` doc-conformance run (`TC-DOCREC-004`), phase 8 must not list pilot data, and phase 9's test list must include the pilot privacy/safety scan (`TC-PSCAN-010`).

### 7.3 Definition-of-Done Evidence Map

The spec's §17.1 DoD-1..DoD-20 map to this plan as follows. A DoD row without passing evidence reopens its owning phase.

| DoD | TC evidence | Plan phase |
|---|---|---|
| DoD-1 | `TC-ENTRY-001`, `TC-ENTRY-010` | 1 |
| DoD-2 | `TC-ENTRY-001` through `TC-ENTRY-007`, `TC-HELP-001`, `TC-HELP-003` | 1, 7, 8 |
| DoD-3 | `TC-ENTRY-002`, `TC-ENTRY-007`, `TC-ENTRY-008`, `TC-ENTRY-010` | 1 |
| DoD-4 | `TC-ENTRY-009`, `TC-ENTRY-010` | 1 |
| DoD-5 | `TC-SESS-001` through `TC-SESS-005`, `TC-ERRROW-001` through `TC-ERRROW-004` | 2 |
| DoD-6 | `TC-PSCAN-001`, `TC-PSCAN-008`, `TC-ADOPT-001`, `TC-SESS-002` | 5, 6, 8 |
| DoD-7 | `TC-STAGE-001` through `TC-STAGE-005`, `TC-STAGE-008` | 3 |
| DoD-8 | `TC-STAGE-006`, `TC-STAGE-007`, `TC-STAGE-009`, `TC-STAGE-010` | 3 |
| DoD-9 | `TC-PSCAN-002`, `TC-PSCAN-007`, `TC-ADOPT-001`, `TC-ADOPT-002` | 5, 8 |
| DoD-10 | `TC-BLKADOPT-001` through `TC-BLKADOPT-003`, `TC-PSCAN-006`, `TC-PSCAN-009`, `TC-PSCAN-010` | 6, 8, 9 |
| DoD-11 | `TC-COORD-001` through `TC-COORD-003`, `TC-PILOT-002`, `TC-DOCREC-002` | 6, 7, 9 |
| DoD-12 | `TC-PLANSUM-001` through `TC-PLANSUM-005` | 4, 5, 8 |
| DoD-13 | `TC-HELP-001` through `TC-HELP-003`, `TC-PSCAN-003`, `TC-PSCAN-004`, `TC-DOCREC-001` | 6–8, 10 |
| DoD-14 | `TC-ERRROW-002`, `TC-DOCREC-002`, `TC-DOCREC-003`, `TC-DOCREC-004` | 2, 3, 7, 10 |
| DoD-15 | `TC-KEYVAL-001` through `TC-KEYVAL-007` | 8 |
| DoD-16 | `TC-PILOT-001` through `TC-PILOT-006` | 9 |
| DoD-17 | `TC-PSCAN-005`, `TC-PSCAN-006`, `TC-PSCAN-009`, `TC-PSCAN-010`, `TC-PILOT-005` | 8, 9 |
| DoD-18 | Every §3.1/§3.3 row Covered; execution log populated | 10 |
| DoD-19 | Section 7.1 aggregate `pnpm check`; per-phase commands; clean tree | 10 |
| DoD-20 | PR record and description; pm-notes risk-acceptance entry; TDR-0013 review note (manual) | 10 |

### 7.4 Review remediation coverage (iteration 1)

The iteration-1 code review found that phase 8 replaced rather than extended two pre-existing suites. Phase 11 restores that coverage and extends it; every row below is re-run evidence, not a plan claim.

| Finding | Coverage restored or added | Files | Verification |
|---|---|---|---|
| F-1 | The 37-test CI-invariant mutation/negative suite returns: pin equality (four-copy divergence, rejected shapes), vulnerability gate (live lockfile, fixture advisory), supply chain (floating tag), topology (DEC-7 allowance fixtures A–G, missing job ids), bindingness (injected `continue-on-error`), and the GH-172/GH-181 bindings. The prompt/help scan wiring moves to its own suite instead of replacing the base file. | `tests/checks/ci-checks.test.ts`; `tests/checks/ci-wiring.test.ts` | 39 pass / 0 fail |
| F-2 | `TC-PRIVACY-018` (stdin-only registry-shaped record, class flag, empty/over-cap failure with no digest, echo mutant), `TC-PRIVACY-019` (CI refusal under both markers, no argv/environment channel), and `F-8` (unknown positional rejection) return. The non-pilot fixture scan moves to its own file, and `runAuthoring` is used again. | `tests/checks/privacy-authoring.test.ts`; `tests/checks/fixture-privacy.test.ts`; `tests/checks/privacy-support.ts` | 11 pass / 0 fail |
| F-3 | Section 7 statuses are `Implemented`/`Existing, updated`/`Existing, verified`; section 10 carries the family log; pm-notes `notes:` remains the per-phase command log and the tie-breaker. | this file | this file |
| F-4 | Direct behavioural tests over an in-memory `ChangeFolderFileSystem`: month scan ascending (non-month entries ignored), folder scan ascending, exact `--<ref>--` token match, read-only non-mutation, relative prefix strip with root trailing-separator trim, out-of-root pass-through, unresolved ref. | `tests/behaviour/change-folder-locate.test.ts` | 9 pass / 0 fail |
| F-5 | Negation is sentence-local for rule matches, forbidden literals, and retired literals, and every rule occurrence on a line is examined. A negated instruction mutant is rejected. Sentence-local negation exposed one plural false positive (`plan updates` in the pm review step), so the `plan.no-progress` alternative is narrowed to the singular instruction phrase `plan update`. | `scripts/checks/prompt-conformance.ts`; `tests/fixtures/prompt-inventory/mutants/raw-git-negated.md`; `tests/checks/prompt-conformance-mutants.test.ts` | 11 pass / 0 fail; live scan clean |
| F-6 | A TC pins the `commit --phase --dry-run` preview scope to the DEC-4 union (mapped plan-phase scope plus the change folder) and asserts the excluded stray and the untouched tree. | `tests/behaviour/commit-staging-scope.test.ts` | 3 pass / 0 fail |

The privacy CI-wiring suite pinned the moved fixture-scan test by name; its suite-filter table now points at the restored authoring suite and the new fixture suite.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|---|---|---|---|---|
| TR-1 | Prompt scan false positives or false negatives make the conformance gate untrustworthy | H | M | One forbidden pattern per mutant; a reviewed allowlist; report file and rule; run the scan on the generated plugin too |
| TR-2 | No prompt-execution harness means behavior is inferred | M | M | Keep the scan grammar narrow; verify the primitives with behaviour tests; the pilot exercises the same command definitions |
| TR-3 | A wall-clock latency gate is flaky in CI | L | L | Timing is informational only; the hard gate is zero reads/writes plus the fixed suite timeout (AC-NFR1-1) |
| TR-4 | Pilot stubs diverge from real adapters | M | M | Stubs implement the delivered ports; adapter contract tests remain; the pilot asserts only the stub surfaces and a real state/git/file path |
| TR-5 | Reference pages are missing or stale | M | M | The `coverage.json` fixture lists every required page; missing pages are added in this change; parity test compares flags |
| TR-6 | Golden churn hides a real regression | M | L | Goldens are byte-pinned and regenerated only by an explicit command; the key-register test proves no key is silently dropped |
| TR-7 | Pilot determinism or boundedness regresses (sleeps, unbounded retries, nondeterministic clock/ids) | M | L | Fixed clock/ids, sleep guard, bounded step/retry budget, byte-identical replay, and the fixed test-runner timeout; wall-clock duration is informational only |
| TR-8 | A prompt is added after this change and drifts | M | M | The scan is wired into `pnpm check`/CI; a new prompt without an inventory row fails the scan |
| TR-9 | The reversed completion order leaves pm-notes ahead of the ledger when the commit act fails | H | M | Pre-write snapshot + restore on each failure mode; failed restore exits 2 with a reconciliation instruction; retry converges to one transition/commit (`TC-STAGE-009`, `TC-STAGE-010`) |
| TR-10 | A phase test depends on a later phase's files, so the phase is not independently green | H | M | §7.2 keeps staging in phase 3, non-pilot prompt/doc scans in phase 8, the pilot and pilot-data privacy scan in phase 9, and full feature-spec conformance in phase 10; phase 8 never reads `doc/spec/features/**`, and phase 9 never needs phase-8 pilot data. Each phase's declared command must pass alone |
| TR-11 | Fixture names diverge between this test plan and the plan YAML | M | M | Section 6.2 is the single canonical list; the plan revision must use the same names; review checks the two inventories side by side |
| TR-12 | The plan YAML's phase scope/test list lags this test plan's ownership split | M | M | Phase 3 must add the behavior-spec doc-conformance parameter set, phase 1 must own the static coverage inventory, phase 8 must drop pilot data, and phase 9 must add the pilot privacy/safety scan; the plan review gate closes these before delivery |

### 8.2 Assumptions

- The entrypoint composition can be invoked in process for tests, and the production bin uses the same composition; the bin is a non-installed Bun-shebang entry mapped in `packages/cli/package.json`.
- The reference pages under `doc/planning/oss-tooling/milestones/m1/commands/` are the canonical man-page-grade guides.
- `withCommitHarness`, the phase harness, the blockers harness, and the merge/closeout/status harnesses can be extended with the new staging, ordering, reverse-window, and adoption cases.
- TDR-0013 exists and is the durable record of the reversal.
- `scripts/install.sh` and the retained bash scripts are not modified by this change.
- The implementation plan names the exact entrypoint module/export and uses the canonical fixture names in section 6.2; this plan names the behaviour and the fixture contract, not the final internal symbol.
- `tests/fixtures/prompt-inventory/lifecycle.json` and the plan's prompt inventory describe the same file set; a divergence is a plan/test-plan defect caught at review.

### 8.3 Open Questions

| ID | Question | Proposed answer | Blocking? | Owner |
|---|---|---|---|---|
| OQ-T1 | What exact grammar defines a "primary path" in a prompt for the retained/retired scan? | Treat numbered steps and fenced command blocks as primary; every retained mention must include the token `retained`; every retired path is forbidden in those positions. | No; the proposed grammar is deterministic and mutation-tested | engineering |
| OQ-T2 | Does `plan validate` reject an unknown `tasks` key? | The plan does not require the key and does not assert rejection. It asserts absence is valid and no consumer or prompt reads/writes `tasks`. If the validator rejects unknown keys, that is documented separately. | No | spec/plan owner |
| OQ-T3 | Should the pilot suite live under `tests/conformance/pilot/` or `tests/behaviour/pilot/`? | `tests/conformance/pilot/` because it is an end-to-end conformance exercise, not a unit behaviour suite. | No | engineering |
| OQ-T4 | Is any wall-clock latency measured in CI? | No gate. The isolation and pilot suites record duration as informational metadata only; the assertions are zero reads/writes, fixed clock/ids, no sleeps, a bounded step/retry budget, byte-identical replay, and the fixed suite timeout. | No | engineering |
| OQ-T5 | Is a built-binary smoke test required? | The structural bin/manifest assertion (`TC-ENTRY-010`) is the AC evidence; a built-artifact smoke check is supplemental and must not replace it. | No | engineering |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-11-07 | test-plan-writer | Initial test plan derived from the GH-242 specification, ticket ACs, Appendix A/B/D, and the repository testing strategy. |
| 0.2 | 2026-11-07 | test-plan-writer | DoR iteration-1 remediation. Added the reverse-window cases (TC-STAGE-009/010, AC-F2-4) and split phase-2 session adoption from phase-3 staging (TC-SESS-002). Moved the plan prompt scan to phase 5/8 (TC-PLANSUM-005) and scoped phase-4 consumers to code/template (TC-PLANSUM-003). Split doc conformance into phase-7 scoped (TC-DOCREC-002) and phase-10 full feature-spec (TC-DOCREC-003, four omitted specs, AC-F8-5/NFR-13). Canonicalized the fixture inventory and added privacy/safety re-runs (TC-PSCAN-009). Replaced the p95 gate with deterministic zero-read/zero-write plus fixed timeout (TC-ENTRY-006), promoted TC-ENTRY-009 to must-pass for AC-F1-6 with state/mcp/dispatch/daemon absence, and added TC-ENTRY-010 for AC-F1-7. Aligned ticket-AC traceability to Appendix C's six rows and used "stubbed or deterministically injected" for clock/ids. Specified the retired-row detection mechanism (TC-ERRROW-003). Total 70 TCs; all ACs covered. |
| 0.3 | 2026-11-07 | test-plan-writer | DoR iteration-2 remediation and spec 1.2 alignment. RR-17: split the privacy/safety scan by fixture availability — TC-PSCAN-009 is phase-8 non-pilot only; new TC-PSCAN-010 owns the phase-9 pilot fixtures/suite. RR-21: TC-PSCAN-001/002 no longer read `doc/spec/features/**` in phase 8; the system-spec phrase scan moves to phase 10/TC-DOCREC-003, and the phase map states the split. RR-22: TC-DOCREC-003 now consumes the spec's §16.1.1 stale/required table exactly, including the generic behavioral-primitives row, and drops the "every §16.1 row" claim; NFR-13/AC-F8-5 wording matches. RR-23: TC-ADOPT-002 asserts `@pr-manager` never merges and never runs raw git; a dirty worktree commits via `commit` or the thin `@committer`, not "no commit at all". RR-24: TC-ENTRY-004 uses the phase-1 static `tests/fixtures/help-guide/coverage.json`; page reconciliation stays TC-HELP-001/003 in phases 7/8. RR-25: TC-PILOT-006 replaces the 180 s assertion with fixed clock/ids, no sleeps, bounded step/retry budget, byte-identical replay, zero outbound calls, and the fixed runner timeout (duration informational). RR-26: TC-STAGE-009 asserts HEAD/commit-count unchanged and no reachable commit object, not object-database absence. RR-27: removed stale OQ-T6. Added TC-DOCREC-004 for the phase-3 behavior-spec phrase-table rows (supporting the spec's phase-3 ownership). TC-ENTRY-009 now asserts the `fallback.internal` composition identity and no new error-table row. Total 72 TCs; all ACs covered. |
| 0.4 | 2026-11-08 | coder (review remediation) | Iteration-1 review remediation. F-1: section 7 maps the restored 37-test CI-invariant suite and the separate scan-wiring suite. F-2: the authoring privacy suite is restored and the non-pilot fixture scan is its own suite. F-3: section 7 statuses are the delivered state, section 10 is populated per family, and section 7.4 records the remediation coverage. F-4/F-5/F-6 add the change-folder behavioural suite, sentence-local negation with a negated-instruction mutant, and the `commit --phase --dry-run` DEC-4 union case. |

## 10. Test Execution Log

The per-phase command log is the `notes:` ledger in `chg-GH-242-pm-notes.yaml`: every plan-phase entry names the phase, the commit, and the observed test result, and it is the authoritative execution record. This section is the family-level summary of the final re-run; on a disagreement the pm-notes `notes:` entry plus the raw log wins.

All rows were re-run on 2026-11-08 (phase 11, review remediation iteration 1) on the delivery branch with the absolute repo-local `TMPDIR=<repo>/tmp/tmpdir`. The aggregate `pnpm check` runs every TypeScript family, so a green aggregate is the family evidence; targeted commands are re-run per phase 11's test list.

| Family | Command | Tests | Result | Notes / Evidence |
|---|---|---|---|---|
| Entrypoint, help, and version identity | `bun test tests/behaviour/entrypoint-*.test.ts` (inside the aggregate) | 25 | PASS | Entrypoint version/identity, help + coverage, isolation, composition honesty and `fallback.internal`; zero outbound calls |
| Session adoption and sanitized one-shot | `bun test tests/behaviour/*-session-adoption.test.ts tests/behaviour/harness-oneshot-context.test.ts` | 8 | PASS | In-session `commit`/`commit --dry-run`/`commit --phase`/`phase complete`/`phase complete --no-commit` proceed; one-shot runs in a sanitized empty context |
| Staging, ordering, reverse window, convergence | `bun test tests/behaviour/commit-command.test.ts tests/behaviour/*staging-scope.test.ts tests/behaviour/phase-completion-*.test.ts tests/behaviour/commit-convergence.test.ts` | 40 | PASS | Plan scope ∪ change folder; plan-absent staging; pre-write restore per failure mode; retry = one transition and one commit; legacy window converges; `commit --phase --dry-run` previews the same union |
| Plan schema, summary, and consumers | `bun test tests/behaviour/plan-summary.test.ts tests/checks/plan-consumer-inventory.test.ts tests/structure/plan-writer-prompt.test.ts tests/behaviour/commit-message.test.ts` | 18 | PASS | Optional non-empty `phases[].summary`; omission valid; no `tasks` consumer; no progress log |
| Error-row retirement and contract | `bun test tests/structure/commit-contract.test.ts tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts` | 178 | PASS | `commit.session.context-refused` absent from the domain, table, corpora, and goldens; five-row `commit` domain; entries = documented |
| Prompt adoption and coordinator sequence | `bun test tests/checks/agent-role-conformance.test.ts tests/checks/coordinator-sequence.test.ts` | 17 | PASS | `phase complete`/`phase list`/`phase reopen` and `blockers publish` adopted; retained bash labeled retained; no primary merge/list path |
| Prompt and doc conformance scans | `bun run scripts/checks/prompt-conformance.ts`; `bun test tests/checks/prompt-conformance.test.ts tests/checks/prompt-conformance-mutants.test.ts` | 11 | PASS | 5 prompt(s) clean; every rule has a failing mutant; sentence-local negation with a negated-instruction mutant; repeat runs identical |
| Doc conformance against the phrase table | `bun test tests/checks/doc-conformance.test.ts` | 11 | PASS | scope `docs` 3, `scope: behavior-spec` 3, `scope: full` 5 |
| Help/guide coverage and reference parity | `bun run scripts/checks/help-guide-coverage.ts`; `bun test tests/checks/help-guide-coverage*.test.ts tests/checks/reference-page-parity.test.ts` | 8 | PASS | Every prompt-required command covered; mutants fail by page/flag |
| Key=value continuity goldens | `bun test tests/golden` | 222 | PASS | Byte-pinned surfaces unchanged; key register loses no key |
| CI invariants (restored in phase 11) | `bun test tests/checks/ci-checks.test.ts tests/checks/ci-wiring.test.ts` | 39 | PASS | Pin four-copy divergence, advisory gate, floating tag, DEC-7 topology fixtures A–G, job-id removal, injected `continue-on-error`/`|| true`, GH-172/GH-181 bindings; scan wiring in its own suite |
| Privacy guard (restored in phase 11) | `bun test tests/checks/privacy-authoring.test.ts tests/checks/fixture-privacy.test.ts tests/checks/privacy-ci-wiring.test.ts` | 25 | PASS | `TC-PRIVACY-018/019` and `F-8` restored (stdin-only record, class flag, over-cap failure with no digest, echo mutant, both CI markers, no argv/environment channel, positional rejection); non-pilot fixture scan; suite filters re-pinned |
| Change-folder resolution views (new in phase 11) | `bun test tests/behaviour/change-folder-locate.test.ts` | 9 | PASS | Month scan ascending, `--<ref>--` token match, read-only, repo-relative prefix strip, out-of-root pass-through |
| Pilot J1 conformance and pilot privacy | `bun test tests/conformance/pilot` (inside the aggregate) | 28 | PASS | Real temp repo/ledger/change folder, deterministic double run, zero outbound calls, zero sleeps, expected next ref |
| Forbidden literals and secret reads | `bun test tests/checks/forbidden-literals.test.ts tests/checks/secret-read-boundary.test.ts` | 54 | PASS | 0 violations; 5 allowlisted entries; secret-read boundary clean |
| Shell and plugin suites | `bash scripts/.tests/test-build-claude-plugin.sh`; retained bash suites | 16/16 plugin; 54 bash | PASS | Committed plugin byte-current; install and retained `deliver-ticket.sh`/`ceo-loop.sh` suites green |
| Aggregate gate | `pnpm check` | 6009 tests / 683 files | PASS | 6005 pass / 4 skip / 0 fail; lint 54 warnings / 0 errors; format clean; 6 packages + `tests/types` typecheck; boundaries 294 modules; prompt/help scans clean; exports parity 5/5 |

**Phase-11 remediation re-runs:** the restored and new suites above (`ci-checks` 37 + `ci-wiring` 2 = 39; `privacy-authoring` 8 + `fixture-privacy` 3 + `privacy-ci-wiring` 14 = 25; `change-folder-locate` 9; `commit-staging-scope` 3; `prompt-conformance` 11) all pass, and the aggregate gate above is the same tree.

**Known gate environment note:** `exports-parity` fails only when `TMPDIR` is a *relative* path (the `attw --pack`/`pnpm` quirk under `packages/*/tmp`). With the absolute repo-local `TMPDIR` it passes 5/5; CI uses a same-filesystem checkout. This is a host quirk, recorded in pm-notes, not a code defect.
