---
id: chg-GH-242-test-plan
status: Proposed
created: 2026-11-07T00:00:00Z
last_updated: 2026-11-07T00:00:00Z
owners: [engineering]
service: delivery-os
labels: [m1, m1-s20, agent-integration, cli, prompts, documentation]
version_impact: minor
summary: "Sixty-four scenarios verifying GH-242: the executable and self-description surface, phase and commit adoption, session-guard reversal, lifecycle staging and ordering, typed blockers, coordinator J1 loop, plan summary alignment, prompt/doc conformance, key=value continuity, and a deterministic pilot J1 iteration."
links:
  change_spec: ./chg-GH-242-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S20: Agent integration: prompts consume the tooling

## 1. Scope and Objectives

This plan protects the integration contract between the delivered typed primitives and the lifecycle prompts. Its core objective is to prove, mechanically, that coordination is a sequence of typed calls rather than prose discipline: no prompt writes phase state by hand, no lifecycle prompt hand-crafts a commit, every prompt-required command is discoverable through `--help` and a reference page, the bash-era key=value summaries still hold byte-for-byte, and one full J1 coordinator iteration runs on a fixture-backed pilot repository without any outbound tracker, CI, PR-platform, provider, or network call.

The highest-risk areas are prompt drift, the deliberate reversal of the GH-227 delivery-session refusal, the widened lifecycle staging scope, and the ordering change that must place the pm-notes transition inside the completion commit. The plan treats these as must-pass gates, not review notes.

### 1.1 In Scope

- The production entrypoint composition, root help/version, per-command help, and working-name override.
- Removal of the delivery-session refusal from `commit` and `phase complete`, retention of the sanitized one-shot context, and retirement of `commit.session.context-refused` across the machine table, documented table, corpora, fixtures, and sync check.
- Lifecycle completion staging (mapped plan scope union the change folder), standalone commit staging (plan union; plan-absent change folder), stray exclusion, and completion ordering/convergence.
- `phase complete` / `phase list` / `phase reopen` adoption, the pm-notes `notes:` PR URL record, and the thin `@committer`.
- Typed blocker adoption and the coordinator J1 sequence (`status` → `blockers answer` → `verify change`/`phase list` → `merge` → `closeout --apply` → `queue plan --next N`).
- Optional `phases[].summary`, the no-`tasks` rule, and progress remaining in pm-notes `notes:`.
- Prompt/doc conformance scans, help/guide coverage, retained-vs-retired bash classification, `.ados-claude/**` freshness, and secret scanning.
- Appendix A key=value byte-equality on `merge`, `queue`, `verify`, `plan`, and `blockers`, plus the retained `deliver-ticket.sh` and `ceo-loop.sh` summaries.
- The deterministic pilot J1 conformance suite over real state, git, files, envelopes, and exits, with tracker/CI/PR-platform/provider and clock/id injection only.

### 1.2 Out of Scope & Known Gaps

- **No prompt-execution harness exists.** Prompt behavior is verified by a deterministic text scan plus primitive-level behaviour tests; the plan does not claim that an agent runtime executes the prompt. This is a deliberate, named gap, mitigated by negative scan mutants and the pilot suite driving the same primitives.
- **`--help`/`--version` p95 latency** is measured in process over a repeated sample. The hard, deterministic gate is the zero state/network/git-write counter; the 100 ms p95 is an advisory ceiling with CI tolerance. No production load test is claimed.
- **`dispatch` (M1-S9) and the resident daemon (M1-S18)** are not delivered and are not tested; the plan only asserts that no prompt claims them.
- **Installer, packaging, and release behavior** are unchanged; the plan asserts absence and existing install-test parity, not new install functionality.
- **New tracker integrations, MCP parity, memory commands, state migrations, and `phase start`** are out of scope.
- **`tasks` unknown-key policy** is not asserted as a rejection; the plan asserts that absence is valid and that no consumer or prompt requires the key. See OQ-T2.
- **Legacy markdown plan reading** is unchanged except that it must not regress; existing `plan-legacy.test.ts` remains the regression control.

### 1.3 Risk-Based Prioritization

**Must-pass (AC-gating).** These scenarios are the primary or sole evidence for an acceptance criterion or a ticket acceptance criterion. A failure blocks delivery:

- `TC-ENTRY-001`, `TC-ENTRY-002`, `TC-ENTRY-004`, `TC-ENTRY-005`, `TC-ENTRY-006`, `TC-ENTRY-007`, `TC-ENTRY-008`
- `TC-SESS-001`, `TC-SESS-002`, `TC-SESS-004`, `TC-SESS-005`
- `TC-ERRROW-001`, `TC-ERRROW-002`, `TC-ERRROW-003`, `TC-ERRROW-004`
- `TC-STAGE-001` through `TC-STAGE-007`
- `TC-PLANSUM-001` through `TC-PLANSUM-004`
- `TC-PSCAN-001` through `TC-PSCAN-008`
- `TC-HELP-001`, `TC-HELP-002`
- `TC-DOCREC-001`
- `TC-KEYVAL-001` through `TC-KEYVAL-007`
- `TC-ADOPT-001`
- `TC-COORD-001`, `TC-COORD-002`, `TC-COORD-003`
- `TC-BLKADOPT-001`, `TC-BLKADOPT-002`, `TC-BLKADOPT-003`
- `TC-PILOT-001` through `TC-PILOT-005`

**Nice-to-have (supplemental).** These scenarios improve diagnosis, guard against over-generalization, or add a control where the AC already has primary evidence. They are tracked and expected to pass, but a failure in one of them does not by itself reopen an AC unless it exposes a real behavioral gap:

- `TC-ENTRY-003` — root help is also exercised by `TC-ENTRY-004` and `TC-ENTRY-006`; keep it for diagnosis.
- `TC-ENTRY-009` — composition completeness is supporting evidence for F-1/DEC-13; no AC names it directly.
- `TC-SESS-003` — the in-session/out-of-session parity control; the AC is carried by `TC-SESS-001` and `TC-SESS-002`.
- `TC-STAGE-008` — the existing exclusion control under the widened scope; it protects NFR-9 but does not add a new AC.
- `TC-HELP-003` — reference-page parity is a quality control; `TC-HELP-001` carries the coverage AC.
- `TC-DOCREC-002` — guide/spec prose conformance; `TC-PSCAN-004` carries the retained/retired AC.
- `TC-ADOPT-002` — role purity is a supporting control for `TC-ADOPT-001` and `TC-PSCAN-002`.
- `TC-PILOT-006` — durable-record and runtime diagnostics; the J1 AC is carried by `TC-PILOT-001` through `TC-PILOT-005`.

If the change is split for review (OQ-1 was resolved as no split), the foundation half still requires every must-pass entry related to entrypoint, session, error-row, staging, plan summary, prompt scan, help, plugin freshness, key=value, and coordinator classification. The pilot suite remains the integration evidence for the coordination half.

## 2. References

- Change specification: [chg-GH-242-spec.md](./chg-GH-242-spec.md)
- Implementation plan: not yet authored (delivery-planning phase); update `links.implementation_plan` when created.
- Repository testing strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md)
- TypeScript workspace rules: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md)
- Ticket scope and AC: [backlog.md, M1-S20](../../../planning/oss-tooling/backlog.md)
- Decision record: [TDR-0013-agent-session-commit-guard-reversal.md](../../../decisions/TDR-0013-agent-session-commit-guard-reversal.md)
- M1 command reference pages: `doc/planning/oss-tooling/milestones/m1/commands/*.md` and `doc/planning/oss-tooling/milestones/m1/man-page.md`
- Affected system specs: `doc/spec/features/feature-commit-primitive.md`, `feature-pm-notes-lint-and-phase-transitions.md`, `feature-plan-schema.md`, `feature-blockers.md`, `feature-status-digest.md`, `feature-brief.md`, `feature-merge-verify-deploy.md`, `feature-closeout.md`, `feature-scheduling-engine.md`, `feature-result-contract.md`, `feature-agents-and-commands.md`
- Appendix A key=value register, Appendix B retained/retired entry points, Appendix D pilot stub/real matrix: section 24 of the change spec.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | `--version` prints injected identity, exits 0, no state/network/git write | TC-ENTRY-001 | Covered |
| AC-F1-2 | Every prompt-required command `--help` has usage, options, example, exit codes, see-also | TC-ENTRY-003, TC-ENTRY-004, TC-ENTRY-006 | Covered |
| AC-F1-3 | No seed literal in `packages/**`; `DELIVERY_OS_WORKING_NAME` changes identity | TC-ENTRY-002, TC-ENTRY-007 | Covered |
| AC-F1-4 | Entrypoint not added to the installer; installer tests unchanged | TC-ENTRY-008 | Covered |
| AC-F1-5 | Help/version succeed with no config file or project checkout | TC-ENTRY-005, TC-ENTRY-006 | Covered |
| AC-F2-1 | Zero prompt instructions that write phase timestamps or `phases.pr_creation.url` | TC-PSCAN-001 | Covered |
| AC-F2-2 | In-session phase completion lands transition + artifacts + pm-notes in the commit, no refusal | TC-SESS-002, TC-STAGE-001, TC-STAGE-003, TC-STAGE-006, TC-STAGE-007 | Covered |
| AC-F2-3 | PR URL is a pm-notes `notes:` entry; `phases.pr_creation.url` is not written | TC-PSCAN-008 | Covered |
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
| AC-F7-2 | No `tasks` consumer; progress stays out of the plan and in pm-notes `notes:` | TC-PLANSUM-003 | Covered |
| AC-F7-3 | Plan writer emits `delivery.plan.v1` with declared phases/scope, no task log | TC-PLANSUM-004 | Covered |
| AC-F8-1 | Coverage matrix: every prompt-required command has `--help` and a reconciled reference page | TC-HELP-001, TC-HELP-002, TC-HELP-003 | Covered |
| AC-F8-2 | Every prompt typed invocation is in the allowed set and covered | TC-PSCAN-003, TC-HELP-001 | Covered |
| AC-F8-3 | No retired bash entry point is a primary path; retained paths are classified | TC-PSCAN-004, TC-DOCREC-002 | Covered |
| AC-F8-4 | `.ados-claude/**` regenerated and byte-current | TC-DOCREC-001 | Covered |
| AC-F9-1 | `merge`, `queue`, `verify`, `plan`, `blockers` key=value goldens byte-identical | TC-KEYVAL-001, TC-KEYVAL-002, TC-KEYVAL-003, TC-KEYVAL-004, TC-KEYVAL-005, TC-KEYVAL-007 | Covered |
| AC-F9-2 | Registered keys present on replaced surfaces; retained `deliver-ticket.sh` keys unchanged | TC-KEYVAL-006, TC-KEYVAL-007 | Covered |
| AC-F10-1 | Pilot drives status → blockers answer → merge → closeout → queue plan with expected next ref | TC-PILOT-001, TC-PILOT-002, TC-PILOT-006 | Covered |
| AC-F10-2 | Double run byte-identical; zero outbound tracker/CI/provider/network calls | TC-PILOT-004, TC-PILOT-005 | Covered |
| AC-F10-3 | State, git, files, envelopes real; only tracker/CI/PR-platform/provider stubbed | TC-PILOT-001, TC-PILOT-003 | Covered |
| AC-NFR1-1 | Help/version p95 at or under 100 ms; no state/network read | TC-ENTRY-006 | Covered |
| AC-NFR3-1 | Conformance scans deterministic; identical counts; zero ambient reads | TC-PSCAN-005, TC-PILOT-005 | Covered |
| AC-NFR9-1 | Zero secret-shaped findings in prompts/guides; commit safety scan unchanged | TC-PSCAN-006, TC-BLKADOPT-003 | Covered |

#### 3.1.1 Ticket AC Coverage

| Ticket AC | Primary evidence |
|---|---|
| No lifecycle agent instruction writes phase state by hand | TC-PSCAN-001, TC-ADOPT-001 |
| No lifecycle agent instruction hand-crafts a commit for a phase transition | TC-PSCAN-002, TC-PSCAN-007, TC-ADOPT-001, TC-ADOPT-002, TC-STAGE-006 |
| Every tool call the prompts require has `--help` and a guide | TC-ENTRY-004, TC-HELP-001, TC-HELP-002, TC-HELP-003, TC-PSCAN-003 |
| No prompt references a retired bash entry point as the primary path | TC-PSCAN-004, TC-COORD-003, TC-DOCREC-002 |
| Bash-continuity key=value summaries preserved on every replaced surface | TC-KEYVAL-001 through TC-KEYVAL-007 |
| End-to-end J1 iteration on a pilot repository using only tooling primitives | TC-PILOT-001 through TC-PILOT-006 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

There are no new `API-#` or `EVT-#` identifiers in this change. The CLI invocation contract, the state records, and the text surfaces are the interfaces under test.

| Interface | Element | TC ID(s) | Evidence |
|---|---|---|---|
| DM-1 | `delivery.plan.v1` optional `phases[].summary` | TC-PLANSUM-001, TC-PLANSUM-002, TC-PLANSUM-004 | Validation echo; omission-valid fixture; commit subject consumes the summary |
| DM-2 | pm-notes PR URL `notes[]` entry | TC-PSCAN-008 | pm-notes note accepted; no `phases.pr_creation.url` write |
| DM-3 | `commit` error-domain row retirement | TC-ERRROW-001, TC-ERRROW-002, TC-ERRROW-003 | Five machine rows; documented table sync; corpora/goldens updated |
| Appendix A | `merge`, `queue`, `verify`, `plan`, `blockers`, `deliver-ticket.sh`, `ceo-loop.sh` key=value register | TC-KEYVAL-001 through TC-KEYVAL-007 | Byte equality and register completeness |
| Appendix B | Retained vs retired entry points | TC-PSCAN-004, TC-COORD-003 | Scan classification and retained labels |
| Appendix D | Pilot stub/real matrix | TC-PILOT-003 | Port call recording versus real state/git/files/envelopes |
| Section 8.1 | Allowed prompt-required command set | TC-ENTRY-004, TC-ENTRY-009, TC-PSCAN-003, TC-HELP-001 | Composition, scan, and coverage matrix |
| Section 8.2 | Existing `phase.transition` and `commit.telemetry` records | TC-PILOT-006 | Records appended and read with expected identities |
| Section 8.4 | Harness one-shot sanitized context | TC-SESS-004 | Temp empty directory, sanitized env, cleanup |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Self-description latency and isolation | TC-ENTRY-006, TC-ENTRY-005 | Covered |
| NFR-2 | Entrypoint startup and no ambient brand literals | TC-ENTRY-007, TC-ENTRY-009 | Covered |
| NFR-3 | Conformance determinism | TC-PSCAN-005, TC-PILOT-005 | Covered |
| NFR-4 | Prompt invariants: no raw git, no hand-written phase state, no retired primary path | TC-PSCAN-001, TC-PSCAN-002, TC-PSCAN-004 | Covered |
| NFR-5 | Help/guide coverage 100% | TC-HELP-001, TC-HELP-002, TC-HELP-003 | Covered |
| NFR-6 | Key=value continuity, byte-identical goldens | TC-KEYVAL-001 through TC-KEYVAL-007 | Covered |
| NFR-7 | Pilot determinism, fixed clock/ids, zero network | TC-PILOT-004, TC-PILOT-005 | Covered |
| NFR-8 | Pilot runtime at or under 180 s | TC-PILOT-006 | Covered |
| NFR-9 | No secrets in prompts/guides/fixtures; safety scan unchanged | TC-PSCAN-006, TC-STAGE-008, TC-BLKADOPT-003 | Covered |
| NFR-10 | Brand neutrality, no seed literal in `packages/**` | TC-ENTRY-002, TC-ENTRY-007 | Covered |
| NFR-11 | Backward compatibility outside declared changes | TC-KEYVAL-001 through TC-KEYVAL-006, plus the full `pnpm check` regression | Covered |
| NFR-12 | Generated-plugin freshness | TC-DOCREC-001 | Covered |

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
| TC-ENTRY-002 | `DELIVERY_OS_WORKING_NAME` changes the rendered identity | Edge Case | Behaviour | High | AC-F1-3 |
| TC-ENTRY-003 | Root `--help` lists families and global flags | Happy Path | Behaviour | High | AC-F1-2 |
| TC-ENTRY-004 | Every prompt-required command and subcommand has man-page-grade help | Happy Path | Behaviour | High | AC-F1-2, AC-F8-1 |
| TC-ENTRY-005 | Help and version succeed without config or project | Edge Case | Behaviour | High | AC-F1-5 |
| TC-ENTRY-006 | Help and version are isolated and inside the latency ceiling | Negative | Behaviour | High | AC-F1-2, AC-F1-5, AC-NFR1-1 |
| TC-ENTRY-007 | No seed literal in `packages/**`; brand arrives only through the seam | Negative | Structure | High | AC-F1-3, NFR-10 |
| TC-ENTRY-008 | Entrypoint is absent from the installer | Regression | Integration | High | AC-F1-4 |
| TC-ENTRY-009 | Only prompt-required commands are composed; unconfigured compositions fail closed | Corner Case | Behaviour | Medium | F-1, DEC-13, NFR-2 |
| TC-SESS-001 | In-session standalone `commit` lands under normal rules | Happy Path | Behaviour | High | AC-F4-1 |
| TC-SESS-002 | In-session `phase complete` lands with and without a commit | Happy Path | Behaviour | High | AC-F4-1, AC-F2-2 |
| TC-SESS-003 | In-session and out-of-session behavior are otherwise identical | Regression | Behaviour | Medium | AC-F4-1 |
| TC-SESS-004 | The sanitized one-shot context is retained | Regression | Behaviour | High | AC-F4-2 |
| TC-SESS-005 | No `commit.session.context-refused` code path remains | Negative | Structure | High | AC-F4-1 |
| TC-ERRROW-001 | Machine table carries five `commit` rows and no retired row | Happy Path | Structure | High | AC-F4-1, DM-3 |
| TC-ERRROW-002 | Documented table and sync check agree with the machine table | Happy Path | Structure | High | DM-3 |
| TC-ERRROW-003 | Corpora, fixtures, and goldens retire the code; re-addition fails | Negative | Structure | High | DM-3 |
| TC-ERRROW-004 | TDR-0013 records the reversal and the GH-227 supersession | Happy Path | Structure | High | AC-F4-3 |
| TC-STAGE-001 | Completion stages plan scope union the change folder | Happy Path | Behaviour | High | AC-F3-3, AC-F2-2 |
| TC-STAGE-002 | Unrelated strays stay unstaged and are disclosed | Negative | Behaviour | High | AC-F3-3 |
| TC-STAGE-003 | A planning phase with no plan stages the change folder | Corner Case | Behaviour | High | AC-F3-3, AC-F2-2 |
| TC-STAGE-004 | A delivery phase maps to every delivery-kind plan phase | Happy Path | Behaviour | High | AC-F3-3 |
| TC-STAGE-005 | Standalone commit keeps plan union; plan-absent stages the change folder | Corner Case | Behaviour | High | AC-F3-4 |
| TC-STAGE-006 | The pm-notes transition is inside the completion commit | Happy Path | Behaviour | High | AC-F2-2 |
| TC-STAGE-007 | A failed document write converges without a second commit | Negative | Behaviour | High | AC-F2-2 |
| TC-STAGE-008 | Forbidden and binary exclusions still apply | Negative | Behaviour | Medium | F-5, NFR-9 |
| TC-PLANSUM-001 | Optional `summary` is accepted and echoed | Happy Path | Behaviour | High | AC-F7-1, DM-1 |
| TC-PLANSUM-002 | A plan without `summary` remains valid | Edge Case | Behaviour | High | AC-F7-1 |
| TC-PLANSUM-003 | No consumer requires `tasks`; progress stays out of the plan | Negative | Structure | High | AC-F7-2 |
| TC-PLANSUM-004 | Plan writer emits the schema and the commit path consumes `summary` | Happy Path | Behaviour | High | AC-F7-3, DM-1 |
| TC-PSCAN-001 | Zero hand-written phase-state or PR-URL write instructions | Negative | Structure | High | AC-F2-1 |
| TC-PSCAN-002 | Zero raw `git add` / `git commit` / hand-crafted commit instructions | Negative | Structure | High | AC-F3-1 |
| TC-PSCAN-003 | Every prompt typed invocation is in the allowed set | Happy Path | Structure | High | AC-F8-2 |
| TC-PSCAN-004 | Retained versus retired bash classification is correct | Negative | Structure | High | AC-F8-3, AC-F6-3 |
| TC-PSCAN-005 | Scan mutants fail; scans are deterministic with zero ambient reads | Negative | Structure | High | AC-NFR3-1 |
| TC-PSCAN-006 | Prompt and guide secret scan reports zero findings | Negative | Structure | High | AC-NFR9-1 |
| TC-PSCAN-007 | `@committer` is a thin executor of `commit` | Happy Path | Structure | High | AC-F3-2 |
| TC-PSCAN-008 | The PR URL is a pm-notes note, not phase state | Happy Path | Structure | High | AC-F2-3, DM-2 |
| TC-HELP-001 | Help and guide coverage matrix is complete | Happy Path | Structure | High | AC-F8-1 |
| TC-HELP-002 | A matrix mutation fails and names the missing obligation | Negative | Structure | High | AC-F8-1 |
| TC-HELP-003 | Reference pages match the delivered help surface | Regression | Structure | Medium | AC-F8-1, AC-F1-2 |
| TC-DOCREC-001 | Generated Claude plugin is byte-current | Regression | Integration | High | AC-F8-4 |
| TC-DOCREC-002 | Guides and affected system specs are reconciled | Regression | Structure | High | AC-F8-3 |
| TC-KEYVAL-001 | `merge` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-002 | `queue` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-003 | `verify` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-004 | `plan` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-005 | `blockers` text is byte-identical | Regression | Golden | High | AC-F9-1 |
| TC-KEYVAL-006 | Retained `deliver-ticket.sh` and `ceo-loop.sh` summaries are unchanged | Regression | Golden | High | AC-F9-2 |
| TC-KEYVAL-007 | Appendix A register is complete and ordered | Negative | Golden | High | AC-F9-1, AC-F9-2 |
| TC-ADOPT-001 | PM, coder, and command prompts use `phase` and `commit` only | Happy Path | Structure | High | AC-F3-2, AC-F2-1, AC-F3-1 |
| TC-ADOPT-002 | Non-committing agents remain pure; callers own the commit | Negative | Structure | Medium | AC-F3-1 |
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
| TC-PILOT-006 | Durable records, runtime bound, and cleanup hold | Happy Path | Conformance | Medium | AC-F10-1, NFR-8 |

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

#### TC-ENTRY-002 - `DELIVERY_OS_WORKING_NAME` changes the rendered identity

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-version.test.ts`
**Tags**: @backend, @entrypoint, @branding

**Preconditions**:
- The entrypoint composes the brand from configuration or the neutral `DELIVERY_OS_WORKING_NAME` override.
- The ambient environment is a synthetic record passed through injected dependencies, not `process.env`.

**Steps**:
1. Run `--version` with the override unset.
2. Run `--version` with `DELIVERY_OS_WORKING_NAME=alt-product`.
3. Compare the rendered binary name and usage family label across both runs.

**Expected Outcome**:
- The unset run renders the configured identity.
- The override run renders `alt-product` in the same positions.
- The two outputs differ only at the identity tokens; no seed literal is introduced.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-version.test.ts` exits 0; a missing or ignored override fails the run.

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
- A committed fixture, `tests/fixtures/entrypoint/prompt-command-set.ts`, lists every invocation tuple from spec section 8.1: root `--version`, root `--help`, and each command/subcommand help path.
- The expected help shape is usage, options, at least one example, exit codes, and a see-also pointer.

**Steps**:
1. Iterate the fixture and invoke each tuple with `--help`.
2. Assert the exit code and the five required sections in each output.
3. Assert every example is syntactically accepted by the parser in a no-write dry run.
4. Assert every see-also target exists in the reference-page inventory.

**Expected Outcome**:
- All tuples exit `0` and carry the five required sections.
- Examples parse without `fallback.invocation`.
- See-also targets resolve; no tuple is missing.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-help-coverage.test.ts` exits 0; the failure message names the invocation tuple and the missing section.

#### TC-ENTRY-005 - Help and version succeed without config or project

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-5, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-help-isolation.test.ts`
**Tags**: @backend, @entrypoint

**Preconditions**:
- A fresh temporary directory with no `.git`, no configuration file, no state directory, and no `package.json`.
- The process working directory is set to that directory for the invocation.

**Steps**:
1. Run `--help` and `--version` from the empty directory.
2. Repeat with an unreadable configuration file present.
3. Assert the exit codes and outputs.

**Expected Outcome**:
- Both invocations exit `0` and render the same help/version content.
- No configuration error is raised; no state or network read is attempted.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-help-isolation.test.ts` exits 0; a config-required or project-required failure fails the test.

#### TC-ENTRY-006 - Help and version are isolated and inside the latency ceiling

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F1-5, AC-NFR1-1, NFR-1
**Test Type(s)**: Behaviour, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-help-isolation.test.ts`
**Tags**: @backend, @entrypoint, @perf

**Preconditions**:
- Recording fakes count state reads, network calls, git operations, and filesystem writes.
- A no-spawn guard is installed, following `tests/fixtures/result/no-spawn-guard.ts`.

**Steps**:
1. Run `--help` and `--version` 20 times each with a warm in-process composition.
2. Assert every recorder count is zero and the no-spawn guard reports no violations.
3. Compute the p95 of the in-process wall time and compare it with the 100 ms threshold.
4. Re-run with a poisoned state and network port that throws if touched.

**Expected Outcome**:
- Zero state, network, git-write, and spawn calls.
- p95 is at or under 100 ms on the reference environment; a CI-tolerant ceiling is documented in the test.
- The poisoned ports are never invoked.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-help-isolation.test.ts` exits 0; the hard failure is any non-zero port counter or a spawn violation, and the timing assertion names the measured p95.

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
**Related IDs**: F-1, AC-F1-4, NG-2
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

#### TC-ENTRY-009 - Only prompt-required commands are composed; unconfigured compositions fail closed

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, DEC-13, NFR-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-composition.test.ts`
**Tags**: @backend, @entrypoint

**Preconditions**:
- The entrypoint composes the prompt-required subset and exposes the command registry for inspection.
- A composition missing a required port is available in the test.

**Steps**:
1. Assert every invocation from spec section 8.1 resolves to a handler.
2. Assert `dispatch` and the resident daemon are not registered or claimed.
3. Invoke a command whose composition is unconfigured and assert the classified failure.

**Expected Outcome**:
- The prompt-required set is complete.
- The unconfigured composition fails closed with a classified platform/configuration error and exit projection `2`, never a fake success.
- Startup resolves the working name without reading an ambient brand literal.
- Startup p95 is at or under 250 ms in the same warm in-process sample.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/entrypoint-composition.test.ts` exits 0; an unclassified success or a missing required invocation fails the test.

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

#### TC-SESS-002 - In-session `phase complete` lands with and without a commit

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, F-5, AC-F4-1, AC-F2-2, DEC-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-session-adoption.test.ts`
**Tags**: @backend, @phase, @session

**Preconditions**:
- A change folder with pm-notes and a new spec artifact; a validated plan.
- Session facts report an active delivery session.

**Steps**:
1. Run `phase complete GH-310 specification`.
2. Assert the transition, the commit, and the staged artifact.
3. Run the same fixture with `--no-commit` and assert the transition without a commit.
4. Re-run the `--no-commit` case and assert convergence.

**Expected Outcome**:
- Both flag shapes succeed; no session refusal is returned.
- The default completion appends one record and lands one commit containing the artifact and the pm-notes transition.
- `--no-commit` appends the transition only and a re-run converges.

**Pass/Fail Evidence**:
- `bun test tests/behaviour/phase-session-adoption.test.ts` exits 0; any refusal code, duplicate record, or missing commit fails the test.

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
3. Mutate a temp copy by re-adding the row to the doc and assert the sync check fails.
4. Mutate a temp copy by re-adding the row to the machine table and assert the sync check fails.

**Expected Outcome**:
- The live tree is synced.
- Both half-removal mutations fail closed and name the offending row.

**Pass/Fail Evidence**:
- `bun test tests/checks/error-table-sync.test.ts` exits 0; either mutation must fail.

#### TC-ERRROW-003 - Corpora, fixtures, and goldens retire the code; re-addition fails

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-3
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts`; `tests/fixtures/result/code-corpora/*.json`
**Tags**: @backend, @error-table, @fixtures

**Preconditions**:
- The code corpora contain true-positive and false-positive entries used by the result-contract suite.

**Steps**:
1. Remove the retired code from the true-positive corpus.
2. Add it to the false-positive or retired-codes fixture so a re-introduction is detected.
3. Run the sync check and the result-contract tests.
4. Assert the fixtures and the documented examples no longer name the code as valid.

**Expected Outcome**:
- No corpus or golden treats the retired code as a valid positive.
- A mutation that re-adds it fails the sync or corpus check.

**Pass/Fail Evidence**:
- `bun test tests/checks/error-table-sync.test.ts tests/structure/result-contract.test.ts` exits 0; a stale positive fails the run.

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

#### TC-STAGE-007 - A failed document write converges without a second commit

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
- A valid `delivery.plan.v1` fixture with a non-empty `phases[].summary`.

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
**Target Layer / Location**: `tests/behaviour/plan-summary.test.ts`; `tests/fixtures/plan/valid`
**Tags**: @backend, @plan

**Preconditions**:
- An existing valid plan fixture with no `summary` is copied into the test root.
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

#### TC-PLANSUM-003 - No consumer requires `tasks`; progress stays out of the plan

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F7-2, DEC-8
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/plan-consumer-inventory.test.ts` (new) and `tests/checks/prompt-conformance.test.ts`
**Tags**: @backend, @plan, @docs

**Preconditions**:
- A valid plan fixture without a `tasks` key.
- A second fixture that contains a `tasks` key, used only to prove no consumer reads it; the validator's unknown-key verdict is recorded, not asserted as a rejection (OQ-T2).
- A source inventory of consumers that read plan phases, summaries, and scope.

**Steps**:
1. Assert the no-`tasks` plan validates.
2. Run `plan validate` on the `tasks`-bearing fixture and record the verdict.
3. Scan the plan consumers for reads of a `tasks` key; assert zero.
4. Scan the plan-writer, coder, PM, and command prompts for instructions to write `tasks` or plan progress.
5. Assert progress instructions point to pm-notes `notes:`.

**Expected Outcome**:
- No consumer requires `tasks`.
- No prompt writes progress into the plan.
- The pm-notes `notes:` path is the declared progress channel.

**Pass/Fail Evidence**:
- `bun test tests/checks/plan-consumer-inventory.test.ts tests/checks/prompt-conformance.test.ts` exits 0; a consumer read or a prompt write instruction fails the scan.

#### TC-PLANSUM-004 - Plan writer emits the schema and the commit path consumes `summary`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F7-3, DM-1
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/commit-message.test.ts`
**Tags**: @backend, @plan, @commit

**Preconditions**:
- The plan-writer prompt is in the lifecycle inventory.
- A plan fixture with a `summary` and a fixture without one.

**Steps**:
1. Assert the plan-writer prompt emits `delivery.plan.v1`, declared phases, and declared scope, with no task-progress log.
2. Run the commit path over the summary fixture and assert the commit subject uses the phase summary.
3. Run it over the no-summary fixture and assert the deterministic fallback is used.

**Expected Outcome**:
- The producer emits the schema and the optional summary.
- The consumer uses the summary when present and falls back safely when absent.
- No task log appears in either output.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/commit-message.test.ts` exits 0; a task-log instruction or an ignored summary fails the test.

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
- The inventory fixture lists every `.opencode/agent/*.md` and `.opencode/command/*.md`.
- The scan grammar knows instruction-bearing lines and code blocks and excludes read-only `phase list` references.
- A pm-notes schema example is allowed only when it is explicitly labeled read-only; a line or block that tells the agent to set a phase field is an instruction and must fail.

**Steps**:
1. Run the scan over the lifecycle inventory.
2. Assert zero instructions that set `phases.ID.started`, `phases.ID.completed`, or `phases.pr_creation.url`.
3. Assert `phase complete`, `phase list`, and `phase reopen` are the only phase-state verbs taught.
4. Assert the read-only schema example is allowed and a write-instruction mutant fails.
5. Mutate a temp copy with each forbidden write pattern and assert a failure naming file and rule.
6. Re-run `tests/behaviour/phase-write-path-lint.test.ts` and assert the phase family remains the only write path.
7. Run the same phase-state rule over the reconciled guides and system specs; historical change artifacts are excluded as records.

**Expected Outcome**:
- Zero violations on the live tree.
- Every mutant fails; the scan reports the file and the rule.
- Legitimate read-only phase references do not fail.

**Pass/Fail Evidence**:
- `bun run scripts/checks/prompt-conformance.ts` exits 0; `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/phase-write-path-lint.test.ts` proves every mutant fails and the phase family remains the only write path.

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

**Steps**:
1. Scan every lifecycle prompt for `git add`, `git commit`, `git commit -F`, `git reset`, and a hand-crafted commit recipe.
2. Assert zero write instructions while read-only git remains allowed.
3. Mutate a temp copy with each write pattern and assert a failure.
4. Assert the `@pr-manager` push/PR creation allowance is the only git-write allowance.
5. Run the same raw-git rule over the reconciled guides and system specs; historical change artifacts are excluded as records, and read-only git remains allowed.

**Expected Outcome**:
- Zero raw-git commit instructions in the lifecycle inventory and the reconciled docs.
- The read-only allowance remains intact.
- Every mutation fails with the file and rule named.

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
- A temp copy of the prompt/doc inventory is writable.
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
- The prompt/guide inventory includes every `.opencode/**` file and the reconciled guides.
- The secret corpus and canary fixtures exist under `tests/fixtures/secret-boundary` and `tests/fixtures/privacy-literals`.

**Steps**:
1. Run the privacy/secret scan over the prompt and guide inventory.
2. Assert zero secret-shaped findings.
3. Inject a canary credential into a temp copy and assert a finding.
4. Re-run `tests/behaviour/commit-safety.test.ts` and assert the safety-scan behavior is unchanged.

**Expected Outcome**:
- Zero findings on the live tree.
- The canary mutant is detected.
- The commit safety scan still passes/fails as before.

**Pass/Fail Evidence**:
- `bun test tests/checks/prompt-secret-scan.test.ts tests/behaviour/commit-safety.test.ts` exits 0; a canary leak or a changed safety verdict fails the test.

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

#### TC-HELP-001 - Help and guide coverage matrix is complete

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F8-1, NFR-5, DEC-10
**Test Type(s)**: Structure / Check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/help-guide-coverage.ts`; `tests/checks/help-guide-coverage.test.ts`; `tests/fixtures/help-guide/matrix.json`
**Tags**: @docs, @conformance

**Preconditions**:
- The matrix fixture maps every spec-section-8.1 invocation to its help obligation and reference page path.
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
- The reference pages declare options and examples.

**Steps**:
1. Extract flags and options from each `--help` output.
2. Assert every documented flag appears in the reference page and vice versa.
3. Assert every example in `--help` is syntactically accepted by the parser.
4. Assert every see-also link resolves to an existing page.

**Expected Outcome**:
- No stale flag or missing option.
- Examples parse without `fallback.invocation`.
- See-also links resolve.

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

#### TC-DOCREC-002 - Guides and affected system specs are reconciled

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F8-3, DEC-7, DEC-10
**Test Type(s)**: Structure / Check / Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/checks/doc-conformance.test.ts` (new) plus the PR review checklist
**Tags**: @docs, @conformance

**Preconditions**:
- The affected documents are `AGENTS.md`, `doc/guides/change-lifecycle.md`, `doc/guides/unified-change-convention-tracker-agnostic-specification.md`, `doc/guides/delivery-modes.md`, the M1 reference pages, and the affected `doc/spec/features/**` pages.
- The stale-phrase list and required-phrase list are fixtures.

**Steps**:
1. Scan for stale phrases: raw `git add -A`, `git commit -F`, `phases.pr_creation.url` as a write target, the session-refusal rule, and `gh pr merge` as the merge path.
2. Scan for required phrases: `phase complete`, `commit` primitive, typed blockers, retained `deliver-ticket.sh`/`ceo-loop.sh`.
3. Assert every affected feature page names the delivered behavior, including the five-row `commit` domain.
4. Manually review prose coherence and link validity.

**Expected Outcome**:
- Zero stale phrases in the reconciled set.
- Every required concept is present.
- The manual review records no contradiction.

**Pass/Fail Evidence**:
- `bun test tests/checks/doc-conformance.test.ts` exits 0; the PR checklist records the manual review.

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
**Target Layer / Location**: `tests/golden/plan-text.test.ts` (new); `tests/fixtures/plan/golden/*.txt`
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
3. Assert `pr-manager` keeps push/PR creation but performs no merge and no commit.
4. Mutate a temp copy with a commit step in a pure writer and assert a failure.

**Expected Outcome**:
- Pure writers stay pure.
- The caller commits through `commit`.
- `pr-manager` keeps only push/PR creation.

**Pass/Fail Evidence**:
- `bun test tests/checks/agent-role-conformance.test.ts` exits 0; the mutant fails.

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
3. Assert tracker, CI, PR-platform, and provider calls are all recorded stubs.
4. Assert the clock and id generator are injected and fixed.
5. Assert no production entrypoint is reachable from the pilot composition.

**Expected Outcome**:
- Only the declared surfaces are stubbed.
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

#### TC-PILOT-006 - Durable records, runtime bound, and cleanup hold

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-10, AC-F10-1, NFR-8, section 8.2
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/pilot/pilot-records.test.ts` and `pilot-runtime.test.ts`
**Tags**: @conformance, @pilot, @records

**Preconditions**:
- The pilot run from TC-PILOT-002 has completed.

**Steps**:
1. Assert `phase.transition` and `commit.telemetry` records exist with the expected identities.
2. Assert the merge, closeout, and blocker-answer records exist with the expected keys.
3. Measure the suite wall time and assert it is at or under 180 s on the reference environment.
4. Assert every temp repository, state directory, and bare remote is removed in teardown.

**Expected Outcome**:
- The durable evidence is present and keyed correctly.
- The runtime stays within the budget.
- No temp artifact survives.

**Pass/Fail Evidence**:
- `bun test tests/conformance/pilot/pilot-records.test.ts tests/conformance/pilot/pilot-runtime.test.ts` exits 0; a missing record, an over-budget run, or a surviving temp root fails the test.

## 6. Environments and Test Data

### 6.1 Environment Rules

- **In-process by default.** Behaviour, structure, checks, golden, and conformance suites use `bun:test` and injected `CliDependencies`; no test reaches the live state directory, the live git remote, the network, or the wall clock.
- **Temporary roots.** Every suite that needs files uses `mkdtempSync` under `os.tmpdir()` (or the existing `makeTempRoot`/`withCommitHarness` helpers) and removes the root in `afterAll`/`finally`.
- **Fixed clock and ids.** The pilot and golden suites use a fixed clock (`2026-11-07T00:00:00Z` or the existing fixture constant) and a deterministic id sequence. No `Date.now()` or random id appears in an assertion path.
- **Sanitized environment.** The harness one-shot test passes an explicit environment record; no test mutates `process.env` for another test. Canary keys prove deny-by-default.
- **No child process except git.** The commit/phase and pilot suites spawn the local `git` binary for real objects and landing; every other external surface is injected.
- **CI.** The new invariant checks run with `bun run scripts/checks/*.ts` and are mutation-tested by `tests/checks/**`; the aggregate gate is `pnpm check`. The pilot suite is part of `bun test` and must stay under the 180 s budget.
- **Working directory.** Tests that inspect paths use `process.cwd()` only for read-only fixture discovery, never for writes.

### 6.2 Test Data and Fixtures Inventory

| Fixture / data | Status | Purpose | Closest existing pattern |
|---|---|---|---|
| `tests/fixtures/entrypoint/prompt-command-set.ts` | New | Every section 8.1 invocation tuple for help coverage | `tests/fixtures/result/programs` |
| `tests/fixtures/entrypoint/programs.ts` | New | Synthetic entrypoint programs and brand identities | `tests/golden/helpers.ts` programs |
| `tests/fixtures/prompt-inventory/lifecycle.json` | New | Inventory of `.opencode/agent/*.md` and `.opencode/command/*.md` | `tests/structure/inventory.json` |
| `tests/fixtures/prompt-inventory/allowed-commands.json` | New | Section 8.1 allowed set and subcommands | `tests/structure/inventory.json` |
| `tests/fixtures/prompt-inventory/allowlist.json` | New | Read-only git and `@pr-manager` push/PR-creation allowances | `tests/fixtures/forbidden-literals/true-positives.json` |
| `tests/fixtures/prompt-inventory/retained-retired.json` | New | Appendix B classification | `scripts/checks/forbidden-literals.registry.json` |
| `tests/fixtures/prompt-inventory/mutants/` | New | One forbidden pattern per scan rule | `tests/fixtures/forbidden-literals/true-positives.json` |
| `tests/fixtures/help-guide/matrix.json` | New | Invocation to help and reference-page mapping | `tests/fixtures/result/result-shape.json` |
| `doc/planning/oss-tooling/milestones/m1/commands/entrypoint.md` | New | Root/entrypoint reference page for `--help`/`--version` | `doc/planning/oss-tooling/milestones/m1/man-page.md` |
| `tests/fixtures/commit/harness.ts` | Existing, extend | In-session facts, change-folder staging, ordering recorder | `withCommitHarness` |
| `tests/fixtures/phase/full-open.yaml`, `lite-open.yaml` | Existing | Lifecycle phase fixtures for completion | `tests/behaviour/phase-*` |
| `tests/fixtures/plan/valid/` | Existing, extend | Summary-present and summary-absent valid plans | `plan-validate.test.ts` |
| `tests/fixtures/plan/invalid/` | Existing, extend | Empty and non-string summary rejection | `plan-validate-rejections.test.ts` |
| `tests/fixtures/pm-notes/valid/` | Existing, extend | PR-URL `notes:` entry and schema-allowed `blockers:` | `pm-notes-lint.test.ts` |
| `tests/fixtures/merge/golden/` | Existing | Merge key=value goldens | `tests/golden/merge.test.ts` |
| `tests/fixtures/queue-ready/golden/` | Existing | Queue list/plan key=value goldens | `tests/golden/queue-*.test.ts` |
| `tests/fixtures/status/golden/` | Existing | Digest fixture used by the pilot seed | `tests/fixtures/status/harness.ts` |
| `tests/fixtures/closeout/golden/` | Existing | Closeout envelope/human goldens | `tests/fixtures/closeout/harness.ts` |
| `tests/fixtures/blockers/golden/` | Existing | Blockers key=value goldens | `tests/golden/blockers.test.ts` |
| `tests/fixtures/verify`, `tests/fixtures/verify-gates`, `tests/fixtures/verify-deploy` | Existing, extend | Verify change/gates/deploy text goldens | `tests/golden/verify-*.test.ts` |
| `tests/fixtures/plan/golden/*.txt` | New | Plan text key=value goldens | `tests/fixtures/merge/golden/*.txt` |
| `tests/fixtures/key-register/register.json` | New | Appendix A surface-to-key register | `tests/fixtures/result/envelope-key-set.json` |
| `tests/fixtures/result/code-corpora/*.json` | Existing, update | Retire the `commit.session.context-refused` positive | `error-table-sync.test.ts` |
| `tests/fixtures/pilot/harness.ts` | New | Temp repo, bare remote, state store, clocks, stubs | `tests/fixtures/commit/harness.ts` + `tests/fixtures/merge/git-harness.ts` |
| `tests/fixtures/pilot/repo.ts` | New | Seed change folder, plan, pm-notes, ready item | `tests/fixtures/closeout/temp-git.ts` |
| `tests/fixtures/pilot/stubs.ts` | New | Tracker, CI, PR-platform, provider stubs with counters | `tests/fixtures/merge/harness.ts` |
| `tests/fixtures/pilot/matrix.ts` | New | Appendix D real/stub matrix assertion data | `tests/fixtures/status/matrix` |

### 6.3 Isolation and Cleanup

- The pilot suite uses a single temp root per case, a local bare repository as the landing target, and a state directory inside the root; teardown removes the root recursively.
- The one-shot test asserts the temporary empty project directory is removed on both success and failure.
- Golden suites never regenerate fixtures implicitly; a deliberate change runs the explicit `regenerate.ts` command and the diff is reviewed.
- The prompt/doc scans accept an injected root; mutation tests copy the inventory to a temp root and never write the live tree.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file / check | Execution command | Implementation status | Required mocks/stubs |
|---|---|---|---|---|
| TC-ENTRY-001 | `tests/behaviour/entrypoint-version.test.ts` | `bun test tests/behaviour/entrypoint-version.test.ts` | To Implement | In-process entrypoint; recording state/git/network ports |
| TC-ENTRY-002 | `tests/behaviour/entrypoint-version.test.ts` | `bun test tests/behaviour/entrypoint-version.test.ts` | To Implement | Synthetic environment record |
| TC-ENTRY-003 | `tests/behaviour/entrypoint-help.test.ts` | `bun test tests/behaviour/entrypoint-help.test.ts` | To Implement | Recording ports |
| TC-ENTRY-004 | `tests/behaviour/entrypoint-help-coverage.test.ts` | `bun test tests/behaviour/entrypoint-help-coverage.test.ts` | To Implement | Command-set fixture |
| TC-ENTRY-005 | `tests/behaviour/entrypoint-help-isolation.test.ts` | `bun test tests/behaviour/entrypoint-help-isolation.test.ts` | To Implement | Empty temp directory |
| TC-ENTRY-006 | `tests/behaviour/entrypoint-help-isolation.test.ts` | `bun test tests/behaviour/entrypoint-help-isolation.test.ts` | To Implement | Poisoned ports; no-spawn guard |
| TC-ENTRY-007 | `tests/checks/forbidden-literals.test.ts` | `bun test tests/checks/forbidden-literals.test.ts` | Existing, update | Temp copy mutation |
| TC-ENTRY-008 | `tests/structure/entrypoint-installer-absence.test.ts`; `scripts/.tests/test-install.sh` | `bun test tests/structure/entrypoint-installer-absence.test.ts && bash scripts/.tests/test-install.sh` | To Implement / Existing | Shell temp install root |
| TC-ENTRY-009 | `tests/behaviour/entrypoint-composition.test.ts` | `bun test tests/behaviour/entrypoint-composition.test.ts` | To Implement | Registry inspection; missing-port composition |
| TC-SESS-001 | `tests/behaviour/commit-session-adoption.test.ts` | `bun test tests/behaviour/commit-session-adoption.test.ts` | Existing, update | `withCommitHarness`; scripted transport/safety |
| TC-SESS-002 | `tests/behaviour/phase-session-adoption.test.ts` | `bun test tests/behaviour/phase-session-adoption.test.ts` | Existing, update | `withCommitHarness`; in-session facts |
| TC-SESS-003 | `tests/behaviour/commit-session-adoption.test.ts` | `bun test tests/behaviour/commit-session-adoption.test.ts` | Existing, update | Paired runs with/without session facts |
| TC-SESS-004 | `tests/behaviour/harness-oneshot-context.test.ts` | `bun test tests/behaviour/harness-oneshot-context.test.ts` | To Implement | Recording harness runner |
| TC-SESS-005 | `tests/structure/commit-contract.test.ts` | `bun test tests/structure/commit-contract.test.ts` | Existing, update | Source scan |
| TC-ERRROW-001 | `tests/structure/commit-contract.test.ts` | `bun test tests/structure/commit-contract.test.ts` | Existing, update | None |
| TC-ERRROW-002 | `tests/checks/error-table-sync.test.ts` | `bun test tests/checks/error-table-sync.test.ts` | Existing, update | Temp copy mutation |
| TC-ERRROW-003 | `tests/checks/error-table-sync.test.ts`; `tests/fixtures/result/code-corpora` | `bun test tests/checks/error-table-sync.test.ts tests/structure/result-contract.test.ts` | Existing, update | Corpus fixtures |
| TC-ERRROW-004 | `tests/checks/decision-record.test.ts`; manual review | `bun test tests/checks/decision-record.test.ts` | To Implement / Manual | None |
| TC-STAGE-001 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | To Implement | `withCommitHarness`; multi-phase plan |
| TC-STAGE-002 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | To Implement | Stray files; `excluded` assertion |
| TC-STAGE-003 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | To Implement | Plan-absent fixture |
| TC-STAGE-004 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | To Implement | Two delivery-kind phases |
| TC-STAGE-005 | `tests/behaviour/commit-staging-scope.test.ts` | `bun test tests/behaviour/commit-staging-scope.test.ts` | To Implement | Plan-present and plan-absent fixtures |
| TC-STAGE-006 | `tests/behaviour/phase-completion-ordering.test.ts` | `bun test tests/behaviour/phase-completion-ordering.test.ts` | To Implement | Recording filesystem and commit seam |
| TC-STAGE-007 | `tests/behaviour/phase-completion-convergence.test.ts` | `bun test tests/behaviour/phase-completion-convergence.test.ts` | To Implement | Constructed post-commit/pre-document state |
| TC-STAGE-008 | `tests/behaviour/phase-staging-scope.test.ts` | `bun test tests/behaviour/phase-staging-scope.test.ts` | To Implement | Forbidden path and oversized binary |
| TC-PLANSUM-001 | `tests/behaviour/plan-summary.test.ts` | `bun test tests/behaviour/plan-summary.test.ts` | To Implement | Summary fixtures |
| TC-PLANSUM-002 | `tests/behaviour/plan-summary.test.ts` | `bun test tests/behaviour/plan-summary.test.ts` | To Implement | No-summary and legacy fixtures |
| TC-PLANSUM-003 | `tests/checks/plan-consumer-inventory.test.ts`; `tests/checks/prompt-conformance.test.ts` | `bun test tests/checks/plan-consumer-inventory.test.ts tests/checks/prompt-conformance.test.ts` | To Implement | Consumer inventory |
| TC-PLANSUM-004 | `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/commit-message.test.ts` | `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/commit-message.test.ts` | Existing, update | Plan summary fixtures |
| TC-PSCAN-001 | `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/phase-write-path-lint.test.ts` | `bun run scripts/checks/prompt-conformance.ts && bun test tests/checks/prompt-conformance.test.ts tests/behaviour/phase-write-path-lint.test.ts` | To Implement | Temp copy mutants |
| TC-PSCAN-002 | `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts` | `bun run scripts/checks/prompt-conformance.ts && bun test tests/checks/prompt-conformance.test.ts` | To Implement | Temp copy mutants |
| TC-PSCAN-003 | `scripts/checks/prompt-conformance.ts`; `tests/checks/prompt-conformance.test.ts` | `bun run scripts/checks/prompt-conformance.ts && bun test tests/checks/prompt-conformance.test.ts` | To Implement | Allowed-command fixture |
| TC-PSCAN-004 | `tests/checks/prompt-conformance.test.ts`; `tests/fixtures/prompt-inventory/retained-retired.json` | `bun test tests/checks/prompt-conformance.test.ts` | To Implement | Retained/retired fixture |
| TC-PSCAN-005 | `tests/checks/prompt-conformance-mutants.test.ts` | `bun test tests/checks/prompt-conformance-mutants.test.ts` | To Implement | Temp copy mutants |
| TC-PSCAN-006 | `tests/checks/prompt-secret-scan.test.ts`; `tests/checks/privacy-authoring.test.ts` | `bun test tests/checks/prompt-secret-scan.test.ts tests/checks/privacy-authoring.test.ts tests/behaviour/commit-safety.test.ts` | To Implement / Existing | Canary fixtures |
| TC-PSCAN-007 | `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/commit-command.test.ts` | `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/commit-command.test.ts` | To Implement / Existing | Commit harness |
| TC-PSCAN-008 | `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/pm-notes-lint.test.ts` | `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/pm-notes-lint.test.ts` | To Implement / Existing | pm-notes fixture |
| TC-HELP-001 | `scripts/checks/help-guide-coverage.ts`; `tests/checks/help-guide-coverage.test.ts` | `bun run scripts/checks/help-guide-coverage.ts && bun test tests/checks/help-guide-coverage.test.ts` | To Implement | Matrix fixture |
| TC-HELP-002 | `tests/checks/help-guide-coverage-mutants.test.ts` | `bun test tests/checks/help-guide-coverage-mutants.test.ts` | To Implement | Temp copy mutants |
| TC-HELP-003 | `tests/checks/reference-page-parity.test.ts` | `bun test tests/checks/reference-page-parity.test.ts` | To Implement | Help output capture |
| TC-DOCREC-001 | `scripts/.tests/test-build-claude-plugin.sh` | `bash scripts/.tests/test-build-claude-plugin.sh` | Existing, no change | Temp build copy |
| TC-DOCREC-002 | `tests/checks/doc-conformance.test.ts` | `bun test tests/checks/doc-conformance.test.ts` | To Implement / Manual | Phrase fixtures |
| TC-KEYVAL-001 | `tests/golden/merge.test.ts` | `bun test tests/golden/merge.test.ts` | Existing, update | Merge fixtures |
| TC-KEYVAL-002 | `tests/golden/queue-list.test.ts`; `tests/golden/queue-plan.test.ts` | `bun test tests/golden/queue-list.test.ts tests/golden/queue-plan.test.ts` | Existing, update | Queue fixtures |
| TC-KEYVAL-003 | `tests/golden/verify-gates.test.ts`; `tests/golden/verify-deploy.test.ts`; `tests/golden/verify-change.test.ts` | `bun test tests/golden/verify-*.test.ts` | Existing, update | Verify fixtures |
| TC-KEYVAL-004 | `tests/golden/plan-text.test.ts` | `bun test tests/golden/plan-text.test.ts` | To Implement | Plan text goldens |
| TC-KEYVAL-005 | `tests/golden/blockers.test.ts` | `bun test tests/golden/blockers.test.ts` | Existing, update | Blockers fixtures |
| TC-KEYVAL-006 | `scripts/.tests/test-deliver-ticket-result-tuples.sh`; `scripts/.tests/test-ceo-loop.sh` | `bash scripts/.tests/test-deliver-ticket-result-tuples.sh && bash scripts/.tests/test-ceo-loop.sh` | Existing, no change | Shell temp roots |
| TC-KEYVAL-007 | `tests/golden/key-register.test.ts` | `bun test tests/golden/key-register.test.ts` | To Implement | Register fixture |
| TC-ADOPT-001 | `tests/checks/agent-role-conformance.test.ts` | `bun test tests/checks/agent-role-conformance.test.ts` | To Implement | Prompt inventory |
| TC-ADOPT-002 | `tests/checks/agent-role-conformance.test.ts` | `bun test tests/checks/agent-role-conformance.test.ts` | To Implement | Prompt inventory |
| TC-COORD-001 | `tests/checks/coordinator-sequence.test.ts` | `bun test tests/checks/coordinator-sequence.test.ts` | To Implement | `ceo.md` inventory |
| TC-COORD-002 | `tests/checks/coordinator-sequence.test.ts` | `bun test tests/checks/coordinator-sequence.test.ts` | To Implement | `ceo.md` inventory |
| TC-COORD-003 | `tests/checks/coordinator-sequence.test.ts`; `tests/checks/prompt-conformance.test.ts` | `bun test tests/checks/coordinator-sequence.test.ts tests/checks/prompt-conformance.test.ts` | To Implement | Retained/retired fixture |
| TC-BLKADOPT-001 | `tests/checks/prompt-conformance.test.ts`; `tests/behaviour/pm-notes-lint.test.ts` | `bun test tests/checks/prompt-conformance.test.ts tests/behaviour/pm-notes-lint.test.ts` | To Implement / Existing | pm-notes fixture |
| TC-BLKADOPT-002 | `tests/behaviour/blockers-answer-adoption.test.ts` | `bun test tests/behaviour/blockers-answer-adoption.test.ts` | Existing, update | Blockers harness |
| TC-BLKADOPT-003 | `tests/behaviour/blockers-credential*.test.ts` | `bun test tests/behaviour/blockers-credential.test.ts tests/behaviour/blockers-credential-shape.test.ts tests/behaviour/blockers-credential-negative-controls.test.ts` | Existing, no change | Canary fixtures |
| TC-PILOT-001 | `tests/conformance/pilot/pilot-fixture.test.ts` | `bun test tests/conformance/pilot/pilot-fixture.test.ts` | To Implement | `tests/fixtures/pilot/*` |
| TC-PILOT-002 | `tests/conformance/pilot/j1-iteration.test.ts` | `bun test tests/conformance/pilot/j1-iteration.test.ts` | To Implement | Real state/git/files; stubs |
| TC-PILOT-003 | `tests/conformance/pilot/pilot-isolation.test.ts` | `bun test tests/conformance/pilot/pilot-isolation.test.ts` | To Implement | Recorder ports; matrix fixture |
| TC-PILOT-004 | `tests/conformance/pilot/pilot-isolation.test.ts` | `bun test tests/conformance/pilot/pilot-isolation.test.ts` | To Implement | No-spawn and network guards |
| TC-PILOT-005 | `tests/conformance/pilot/pilot-determinism.test.ts` | `bun test tests/conformance/pilot/pilot-determinism.test.ts` | To Implement | Two seeded temp roots |
| TC-PILOT-006 | `tests/conformance/pilot/pilot-records.test.ts`; `tests/conformance/pilot/pilot-runtime.test.ts` | `bun test tests/conformance/pilot` | To Implement | State records; timing |

### 7.1 Execution Order

1. Narrow static checks: `git diff --check`, markdown/YAML review for changed docs.
2. Structure and checks: `bun test tests/structure tests/checks`.
3. Behaviour: `bun test tests/behaviour`.
4. Golden: `bun test tests/golden`.
5. Pilot: `bun test tests/conformance/pilot`.
6. Shell: `bash scripts/.tests/test-build-claude-plugin.sh`, `bash scripts/.tests/test-install.sh`, `bash scripts/.tests/test-deliver-ticket-result-tuples.sh`, `bash scripts/.tests/test-ceo-loop.sh`.
7. Aggregate: `pnpm check`.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|---|---|---|---|---|
| TR-1 | Prompt scan false positives or false negatives make the conformance gate untrustworthy | H | M | One forbidden pattern per mutant; a reviewed allowlist; report file and rule; run the scan on the generated plugin too |
| TR-2 | No prompt-execution harness means behavior is inferred | M | M | Keep the scan grammar narrow; verify the primitives with behaviour tests; the pilot exercises the same command definitions |
| TR-3 | `--help` p95 timing is flaky in CI | M | M | The hard gate is zero I/O; the timing assertion uses a warm in-process sample and a CI-tolerant ceiling, documented in the test |
| TR-4 | Pilot stubs diverge from real adapters | M | M | Stubs implement the delivered ports; adapter contract tests remain; the pilot asserts only the stub surfaces and a real state/git/file path |
| TR-5 | Reference pages are missing or stale | M | M | The matrix fixture lists every required page; missing pages are added in this change; parity test compares flags |
| TR-6 | Golden churn hides a real regression | M | L | Goldens are byte-pinned and regenerated only by an explicit command; the key-register test proves no key is silently dropped |
| TR-7 | Conformance runtime exceeds 180 s | M | L | One pilot suite, shared fixtures, no process spawn except git; the runtime test fails over budget |
| TR-8 | A prompt is added after this change and drifts | M | M | The scan is wired into `pnpm check`/CI; a new prompt without an inventory row fails the scan |

### 8.2 Assumptions

- The entrypoint composition can be invoked in process for tests, and the production bin (if built) uses the same composition.
- The reference pages under `doc/planning/oss-tooling/milestones/m1/commands/` are the canonical man-page-grade guides.
- `withCommitHarness`, the phase harness, the blockers harness, and the merge/closeout/status harnesses can be extended with the new staging, ordering, and adoption cases.
- TDR-0013 exists and is the durable record of the reversal.
- `scripts/install.sh` and the retained bash scripts are not modified by this change.
- The implementation plan will name the exact entrypoint module and export used by the tests; this plan names the behaviour, not the final symbol.

### 8.3 Open Questions

| ID | Question | Proposed answer | Blocking? | Owner |
|---|---|---|---|---|
| OQ-T1 | What exact grammar defines a "primary path" in a prompt for the retained/retired scan? | Treat numbered steps and fenced command blocks as primary; every retained mention must include the token `retained`; every retired path is forbidden in those positions. | No; the proposed grammar is deterministic and mutation-tested | engineering |
| OQ-T2 | Does `plan validate` reject an unknown `tasks` key? | The plan does not require the key and does not assert rejection. It asserts absence is valid and no consumer or prompt reads/writes `tasks`. If the validator rejects unknown keys, that is documented separately. | No | spec/plan owner |
| OQ-T3 | Should the pilot suite live under `tests/conformance/pilot/` or `tests/behaviour/pilot/`? | `tests/conformance/pilot/` because it is an end-to-end conformance exercise, not a unit behaviour suite. | No | engineering |
| OQ-T4 | How is the 100 ms p95 measured in CI? | Warm in-process sample of 20 runs; the deterministic gate is the zero-I/O counter; the timing ceiling is CI-tolerant and reported, not used to hide a regression. | No | engineering |
| OQ-T5 | Is a built-binary smoke test required beyond the in-process entrypoint? | Add one built-artifact smoke test if the package build produces the bin; it is supplemental and does not replace the in-process AC evidence. | No | engineering |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-11-07 | test-plan-writer | Initial test plan derived from the GH-242 specification, ticket ACs, Appendix A/B/D, and the repository testing strategy. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes / Evidence |
|---|---|---|---|
| — | — | Pending | Plan authored; execution starts in the delivery phase. |
