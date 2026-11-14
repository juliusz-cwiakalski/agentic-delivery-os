---
id: chg-GH-313-test-plan
status: Proposed
created: 2026-11-14
last_updated: 2026-11-14
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, governance, planning, agents, enforcement]
version_impact: minor
summary: "Verification strategy for M2-S20 milestone-first planning and delivery: the redistributable milestone-management guide and its nine topics, the pack-conventions pointer, PDR-0005, the required change.milestone artifact field and its single-template scope, the creation/intake rules in the tracker instructions and three prompts with regenerated plugin output, the offline decision-table evaluation core and its thin issue-event workflow (flag, idempotency, exemption, reversal, static comment, least privilege, SHA pins), the zero-write advisory sweep with its read-count bound, the unchanged offline aggregate gate, the planning-truth repair of backlog/ranking/pack/status, and the read-only M0/M1/M2 tracker evidence."
links:
  change_spec: ./chg-GH-313-spec.md
  implementation_plan: ./chg-GH-313-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M2-S20: Milestone-first planning and delivery (M2)

## 1. Scope and Objectives

This change is a **governance-and-automation change with almost no product code**: one new redistributable guide plus a pointer in the milestone pack conventions; three prompt edits, one project tracker-instruction file, and one regenerated Claude Code plugin; one new required front-matter field on exactly one template; one pure, offline-tested evaluation core behind a thin GitHub issue-event workflow; and a repair of the planning corpus so the milestone's own record mirrors the tracker.

The behaviours that must be protected, in descending risk order, are: **the offline determinism of `pnpm check`** (C-1/NFR-2/DEC-2 — any tracker call, bypass construct, or added step inside the gate is a release-blocking regression); **flag precision and idempotency** (NFR-1 — ≤1 comment ever per issue, 0 duplicate label writes, 0 flags on compliant or exempt issues); **the closed write surface** (C-2/C-4 — a flag label and at most one comment, never a state, assignee, milestone, or other-label write); **comment safety by construction** (NFR-7 — a static body with zero issue-authored interpolation); **workflow least privilege and supply-chain hygiene** (NFR-3 — `issues: write` + `contents: read`, 40-hex SHA pins, no `pull_request_target`, no secret, no bypass construct); **historical-debt non-mutation** (C-2/C-3 — the sweep performs exactly 0 tracker writes); and **planning-corpus truth** (F-5/F-6 — the corpus is a mirror, and "every planned ticket was attached" is a recorded fact, not an assumption).

The motivating regressions are: an enforcement surface that quietly enters the deterministic gate; a flag that comments twice (or on exempt tickets) and destroys its own credibility; a check whose write surface grows past a label and one comment; a pipeline that interpolates an issue title into a comment or a log and turns a governance check into an injection surface; a bootstrapped or edited prompt path that forgets the milestone rule while the guide claims it; and a guide/backlog/ranking that drift from the tracker again immediately after being repaired.

### 1.1 In Scope

- **Guide and register (F-1, AC-F1-1…4):** guide existence, `ados_distribution: redistributable`, index link, script-managed header, derived-install-set membership and the distribution drift guard; the nine lifecycle topics documented once; the pack-conventions pointer with no restated procedure; PDR-0005 in the decision register and referenced from guide and change.
- **Artifact field (F-4, AC-F4-1…2):** the required `change.milestone` field and its resolution rule in the change-specification template and the `@spec-writer` front-matter rules; this change's own spec/pm-notes value equality; exactly one template carrying the field with the five other templates unchanged.
- **Creation and intake (F-2, AC-F2-1…3):** the milestone argument, attach-from-existing resolution rule, and no-autonomous-creation rule in `.ai/agent/pm-instructions.md` and `.opencode/agent/pm.md`; preserved existing prohibitions; intake verification with a pm-notes record and a human question on an unattached ticket; the milestone section in the `@bootstrapper` guidance that generates project tracker instructions; regenerated plugin output and freshness.
- **Enforcement core and workflow (F-3, AC-F3-1…7, AC-NFR1-1, AC-NFR3-1, AC-NFR7-1):** the complete offline decision table; flag, idempotency, exemption, reversal on attach/detach, and closed-write-surface assertions driven through a fake tracker port; adversarial comment safety; the sweep's advisory reporting, zero tracker writes, single local artifact, exit-code discipline and read bound; the workflow's event set, job-scoped permissions, SHA pins, secret absence, and bypass-construct absence — plus a mutation proof that each static assertion actually fires.
- **Aggregate gate (AC-NFR2-1, AC-NFR5-1):** the `check` chain unchanged and in order, no milestone step, no network-capable path in the chain, green at the delivered HEAD, and conventional commit history within the ≤100-character rule via the range gate.
- **Planning truth (F-5, AC-F5-1…5):** the M2-S20 block in story shape, 19/19 ticket lines, story-code set equality and contiguous ranking, the pack row with resolvable seeds, and the status delivery addendum.
- **Tracker evidence (F-6, AC-F6-1…2):** read-only, paged, per-milestone declared-versus-attached evidence recorded in the change; GH-313's own attachment.

### 1.2 Out of Scope & Known Gaps

- **No ticket is created, no milestone is created, no historical issue is labelled, attached, or edited by any test** (NG-3, NG-5, C-12, §20). Verification leaves no tracker residue. A live flag/clear demonstration is permitted **only** on an already-existing unattached issue and must be fully reverted, or the workflow's own first live run is cited once it occurs (DoD-8/DoD-9 framing); it is not a repeatable automated test and is not part of the gate.
- **No test may call the tracker network.** Every automated case runs offline over fixtures and injected fakes. Live evidence (sweep run, M0/M1/M2 attachment evidence) is a recorded, read-only sweep/report run — never `bun test`, never part of CI or `pnpm check` (NFR-2, C-1).
- **No new aggregate-gate step, no alternate aggregate, no `|| true`/`continue-on-error`/`set +e` escape** (C-1, C-9). Asserted as a tree invariant, not as a diff.
- **NFR-6's 10-minute ceiling is measured, not asserted.** Wall-clock bounds are environment-dependent; the suite asserts the structural bound (page size 100 and ≤ ⌈N/100⌉+3 reads over N=250 and N=500 fixtures) and the execution log records the measured elapsed time of the 500-issue fixture against the 10-minute threshold.
- **"No story block reordered" and "no fabricated ticket line" cannot be asserted by a permanent suite.** The first is a diff property (`.ai/rules/testing-strategy.md` forbids asserting a moving-base diff) and is review-verified (TC-SCOPE-001); the second requires tracker truth and is verified in the AC-F6-1 evidence record (TC-EVID-001), not offline.
- **"Each topic exactly once" (AC-F1-2) is anchored automatically (heading/keyword counts) and confirmed once by recorded content review** — semantic duplication in prose is not mechanically decidable.
- **Current-truth specification reconciliation is phase 7** (`doc/spec/**`, Appendix B rows 21–28) and is explicitly not tested here; the delivery diff must not contain pre-flipped behavioural current truth (TC-SCOPE-001).
- **The evaluation core's home is pinned by the implementation plan.** This plan proposes `scripts/checks/milestone-attachment.ts` (pure core) + `scripts/checks/milestone-attachment-runner.ts` (port-injected orchestration) and the workflow `.github/workflows/ticket-milestone-check.yml`. Appendix B row 29 lists `scripts/**` as unchanged while row 11 declares a new core "at a path declared at plan authoring" — the plan must pin the path and state that row 29 means *no distributable/install-set script*; see TP-Q1.
- **The existing invariant scanners do not read a new workflow file** (`ci-supply-chain.ts`/`ci-bindingness.ts` read `.github/workflows/ci.yml`, and supply-chain only inspects `ts-` jobs). Without a coverage step, "the supply-chain, topology, and bindingness checks stay green" would be vacuously true for the new file. This plan requires dedicated static assertions plus a mutation proof (TC-WF-003); see TP-Q2.
- **No MCP surface, no CLI surface, no product telemetry** (NG-4, §10): none is asserted because none is claimed.
- **DoD-19 is the roll-up condition**, satisfied by the all-Covered matrix in §3 plus execution evidence in §10 and phase pm-notes; it has no TC of its own.

## 2. References

- Change specification: `./chg-GH-313-spec.md` — F-1…F-6 (§5), flows (§6), interfaces EVT-1…4 and DM-1…5 (§8.2/§8.3), NFR-1…NFR-7 (§9), telemetry (§10), RSK-1…RSK-10 (§11), DEC-1…DEC-12 (§15), **AC-F1-1…AC-NFR7-1 (§17)**, DoD-1…DoD-21 (§17.1), Appendix C testability notes and scenario seeds `SC-M2-S20-01…05`, Appendix D ticket mapping, **Appendix E constraint register C-1…C-12**.
- Implementation plan: `./chg-GH-313-plan.yaml` — **pending (phase 4)**. This test plan constrains it: it must pin the evaluation-core and test-suite paths, the sweep artifact location, and the evidence-record home; it must keep every phase inside the §7.1 scope; it must not add a gate step.
- Repository testing strategy: `.ai/rules/testing-strategy.md` — module→test mapping (`.github/workflows/ci.yml` → `ci-topology`/`ci-bindingness`/`ci-supply-chain`; `scripts/<script>.sh` → `scripts/.tests/test-<script>.sh`; `scripts/checks/<check>.ts` → `tests/checks/**`), `bun:test` authoring, permanent-suite rules (assert the tree, never a moving-base diff; assert meaning, not a growing count).
- TypeScript test authoring: `.ai/rules/typescript.md` §9 — bun:test under `tests/**/*.test.ts`, injected fakes over `mock.module`, deterministic (no clock, network, `$HOME`, sleeps), fixtures never named `*.test.ts`, goldens regenerated by an explicit command.
- Decision record: `doc/decisions/PDR-0005-milestone-first-planning-and-delivery.md` (registered in `doc/decisions/00-index.md`; `Proposed`, `decision_date: null` until the owner decides at the PR gate) — the operating rule, enforcement and exemption the guide and tests must mirror.
- PM notes: `./chg-GH-313-pm-notes.yaml` — `milestone: "M2: Ceremonies, measurement, and memory"`, `story_code: M2-S20`, `delivery_mode: autonomous`, recorded prompt/plugin and backlog-drift risks.
- Scenario seeds (inherited **by name**, per spec Appendix C): `SC-M2-S20-01` flag-once/no-state-change → TC-CHK-002/CHK-003; `SC-M2-S20-02` no second flag/comment → TC-CHK-003; `SC-M2-S20-03` exemption suppresses → TC-CHK-004; `SC-M2-S20-04` attach clears / detach restores → TC-CHK-005; `SC-M2-S20-05` sweep zero writes / one artifact / exit 0 → TC-SWEEP-001.
- Delivered machinery this plan consumes unchanged: `scripts/.tests/test-doc-distribution.sh` + `test-doc-distribution-modes.sh` (marker-derived install set, five failure modes), `scripts/add-header-location.sh` (header ownership), `scripts/build-claude-plugin.sh` + the CI `verify-claude-build` job (plugin freshness), `scripts/checks/script-surface.ts` (`NAMED_CHECKS` = lint → format:check → typecheck → test → check:boundaries), `scripts/checks/ci-supply-chain.ts`/`ci-bindingness.ts`/`ci-topology.ts`, `tests/checks/prompt-conformance.test.ts` + `tests/fixtures/prompt-inventory/{lifecycle,retained-retired}.json`, `scripts/run-bash-suites.sh` (bash suite discovery), `scripts/lint-commit-range.sh`.
- Planning corpus under assertion as data: `doc/planning/oss-tooling/backlog.md`, `backlog-ranking.md`, `milestones/README.md` (`## Conventions`), `milestones/m2/README.md` (story-to-artifact map), `milestones/m2/test-scenarios.md` (seed headings), `status.md` (addendum form); `doc/00-index.md` (Guides table); `doc/templates/change-spec-template.md`; `.opencode/agent/{pm,spec-writer,bootstrapper}.md`; `.ai/agent/pm-instructions.md`; `.ados-claude/agents/*` (generated).

## 3. Coverage Overview

All 30 §17 acceptance criteria are covered; none is left as TODO. DoD-19 is satisfied by this matrix plus the execution evidence in §10 and phase pm-notes.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Guide exists with `ados_distribution: redistributable`, in the derived install set, script-managed (not hand-written) header, linked from the index Guides table, drift guard green | TC-GUIDE-001, TC-GUIDE-005 | Covered |
| AC-F1-2 | Nine lifecycle topics documented, each once; tracker record named source of truth; `M<n>`-prefix convention | TC-GUIDE-002 | Covered |
| AC-F1-3 | Pack `## Conventions` records the operating rule as a pointer without restating the procedure; guide states the unattended-run precondition | TC-GUIDE-003, TC-GUIDE-002 | Covered |
| AC-F1-4 | PDR-0005 exists in the decision register, records rule + enforcement + exemption, referenced from guide and change | TC-GUIDE-004 | Covered |
| AC-F2-1 | Creation requires a milestone resolved from the existing set in both surfaces; no autonomous creation; existing prohibitions present and unweakened | TC-PROMPT-001, TC-PROMPT-002 | Covered |
| AC-F2-2 | Intake verifies attachment and records the milestone in pm-notes before artifacts; unattached (incl. exempt) ticket produces a question and blocks artifacts | TC-PROMPT-003 | Covered |
| AC-F2-3 | Bootstrapper generates a milestone section; regenerated plugin committed and fresh; prompt conformance green | TC-PROMPT-004, TC-PLUGIN-001 | Covered |
| AC-F3-1 | Open `change` issue, no milestone, no exemption → flag label + exactly one marked comment; state/assignee/other labels unchanged | TC-CHK-002 | Covered |
| AC-F3-2 | Repeated triggers → no second comment, flag applied at most once, observable state identical after any number of runs | TC-CHK-003 | Covered |
| AC-F3-3 | Exemption suppresses flag and comment; exemption purpose and removability documented in guide and tracker instructions | TC-CHK-004 (docs: TC-GUIDE-002, TC-PROMPT-001) | Covered |
| AC-F3-4 | Attach removes the flag with no comment; detach restores the flag with no new comment | TC-CHK-005 | Covered |
| AC-F3-5 | Sweep reports the unattached open `change` population as advisory + one machine-readable local artifact, 0 tracker writes, 1 artifact write, exits successfully | TC-SWEEP-001 | Covered |
| AC-F3-6 | Full decision table covered offline (change/non-change, open/closed, milestone ±, exemption ±, removal event); gate contains no milestone step and no tracker call | TC-CHK-001, TC-GATE-001 | Covered |
| AC-F3-7 | Workflow declares `issues: write` + `contents: read` only, SHA-pinned actions, no `pull_request_target`/bypass, no secret; invariant checks green | TC-WF-001, TC-WF-002, TC-WF-003 | Covered |
| AC-F4-1 | `change.milestone` required in template + spec-writer rules with resolution rule; this change's spec value = tracker title = pm-notes value | TC-TPL-001, TC-TPL-002, TC-TPL-003, TC-EVID-002 | Covered |
| AC-F4-2 | Only the change-spec template carries the field; plan/test-plan/feature-spec/roadmap/decision-record templates unchanged; reasons recorded | TC-TPL-004, TC-SCOPE-001 | Covered |
| AC-F5-1 | M2-S20 block exists in story shape (Goal, Tasks, machine-checkable AC, `Depends on:`, `- Ticket: GH-313 (milestone M2)`); no other block reordered | TC-PLAN-001, TC-SCOPE-001 | Covered |
| AC-F5-2 | All 19 M2 story blocks carry a `Ticket:` line naming ticket + milestone; no fabricated line | TC-PLAN-002, TC-EVID-001 | Covered |
| AC-F5-3 | Story-code set equality backlog↔ranking, one contiguous unique sequence, M2 in backlog order | TC-PLAN-003 | Covered |
| AC-F5-4 | M2 pack carries the M2-S20 row; cited seeds exist; seed heading range covers M2-S20 | TC-PLAN-004 | Covered |
| AC-F5-5 | Status snapshot carries the delivery addendum naming M2-S20 + GH-313 and stating M2 has not exited | TC-PLAN-005 | Covered |
| AC-F6-1 | Per-milestone (M0/M1/M2) declared-vs-attached evidence, closed tickets included, title-prefix match, empty gap list, unattached backlog count reported (not reconciled) | TC-EVID-001 | Covered |
| AC-F6-2 | GH-313 attached to M2; the M2-S20 block names it | TC-EVID-002, TC-PLAN-001 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The change authors no HTTP endpoint (`API-#` is absent by design, §8.1). The §8.1 interaction table is asserted as a **closed write plan** by TC-CHK-002 and as a **workflow wiring property** by TC-WF-002.

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| EVT-1 | Issue opened/edited/labeled → flag; compliant/exempt produce no write; idempotent per issue | TC-CHK-001, TC-CHK-002, TC-CHK-003 | Covered |
| EVT-2 | Milestone attached/detached → flag removed / restored; no new comment | TC-CHK-005 | Covered |
| EVT-3 | Manual dispatch sweep → advisory only, 0 tracker writes, 1 local artifact, exit 0 | TC-SWEEP-001 | Covered |
| EVT-4 | Exactly one verdict per evaluation from `compliant \| exempt \| flagged \| restored \| out-of-scope` | TC-CHK-001 | Covered |
| DM-1 | `change.milestone` required field; tracker title verbatim; `none` only where tracker instructions declare no milestone construct | TC-TPL-001, TC-TPL-003 | Covered |
| DM-2 | Label vocabulary (`needs-milestone`, `backlog-capture`) + stable comment marker | TC-CHK-002, TC-CHK-003, TC-CHK-004, TC-CHK-006, TC-PROMPT-001 | Covered |
| DM-3 | pm-notes `milestone` key populated at intake (no schema change) | TC-PROMPT-003, TC-TPL-003 | Covered |
| DM-4 | `- Ticket: GH-<n> (milestone M<n>)` line convention; coverage extended to every M2 story with a ticket | TC-PLAN-001, TC-PLAN-002, TC-EVID-002 | Covered |
| DM-5 | Milestone record convention: `M<n>:` title prefix = story-code root; attached set = planned scope | TC-GUIDE-002, TC-EVID-001 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Flag precision/idempotency: 0 flags on milestone/exempt; ≤1 comment ever; 0 duplicate label applications | TC-CHK-003, TC-CHK-002, TC-CHK-004, TC-CHK-005 | Covered |
| NFR-2 | Gate determinism: 0 tracker calls, five named checks in order, no milestone step, green | TC-GATE-001, TC-QG-001 | Covered |
| NFR-3 | Workflow privilege/supply chain: `issues: write` + `contents: read`, 40-hex pins, no `pull_request_target`, no secret | TC-WF-002, TC-WF-003 | Covered |
| NFR-4 | Documentation distribution: marker, derived install set, drift guard, no hand-written header, no hand-edited plugin | TC-GUIDE-001, TC-GUIDE-005, TC-PLUGIN-001, TC-SCOPE-001 | Covered |
| NFR-5 | Change quality gates: `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before PR; conventional subjects; body/footer ≤100 chars | TC-QG-001 | Covered |
| NFR-6 | Sweep bounds/write discipline: page 100, ≤⌈N/100⌉+3 reads, 0 tracker writes, 1 local artifact, ≤10 min for N≤500, exit 0 | TC-SWEEP-002, TC-SWEEP-001 | Covered |
| NFR-7 | Comment safety: static body, zero issue-authored interpolation, no untrusted text in the run log | TC-CHK-006 | Covered |

**Acceptance-criterion rows for the non-functional set** (each AC explicitly mapped, so no AC rests only on its NFR parent):

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-NFR1-1 | Repeated events over compliant/exempt/flagged issues → 0 duplicate label applications, ≤1 comment, 0 flags on milestone/exempt issues | TC-CHK-003, TC-CHK-002, TC-CHK-004, TC-CHK-005 | Covered |
| AC-NFR2-1 | At the delivered HEAD the chain is unchanged and ordered, performs 0 tracker calls, has no milestone step, and `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green | TC-GATE-001, TC-QG-001 | Covered |
| AC-NFR3-1 | Permissions limited to `issues: write` + `contents: read`, every action a 40-hex SHA pin, no `pull_request_target`, no bypass construct, no secret | TC-WF-002, TC-WF-003 | Covered |
| AC-NFR4-1 | Guide in the derived install set, drift guard passes, no hand-edited plugin file, no hand-written license header | TC-GUIDE-001, TC-GUIDE-005, TC-PLUGIN-001, TC-SCOPE-001 | Covered |
| AC-NFR5-1 | Aggregate gate green before the PR; every commit subject conventional; body/footer lines ≤100 characters | TC-QG-001 | Covered |
| AC-NFR6-1 | For N ≤ 500: pages of 100, ≤⌈N/100⌉+3 reads, 0 tracker writes, exactly 1 local artifact, ≤10 minutes, exit 0 regardless of findings | TC-SWEEP-002, TC-SWEEP-001 | Covered |
| AC-NFR7-1 | Comment body byte-identical under adversarial issue content, containing no issue-authored string, with no untrusted text in the run log | TC-CHK-006 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this change is **documentation + prompt + repository-automation**, not a TypeScript workspace feature: the primary layers are **static/contract suites over files-as-data**, **a pure unit layer over the evaluation core**, **an offline integration layer over a fake tracker port**, and a small **read-only evidence layer**. No layer calls the network.

- **Unit (pure decisions, no I/O).** `bun test tests/checks/milestone-attachment.test.ts`. The core is a pure function over an input value (labels, state, milestone, event) returning one verdict and a closed action list. No clock, no environment, no port. The decision table from spec Appendix C is the oracle.
- **Contract / static (files as data).** `bun test tests/checks/milestone-guide.test.ts tests/checks/milestone-artifacts.test.ts tests/checks/milestone-prompts.test.ts tests/checks/milestone-workflow.test.ts tests/checks/milestone-gate.test.ts tests/checks/planning-truth.test.ts`. Every assertion parses the delivered tree (guide front matter, template front matter, prompt text, workflow YAML, `package.json` scripts, planning markdown tables and headings). YAML is parsed with the `yaml` package (already a dev dependency), never by substring where structure matters. Each static assertion must be paired with a negative fixture proving it fires (TC-WF-003; same pattern as `tests/checks/ci-checks.test.ts`).
- **Integration (event → actions, offline).** `bun test tests/checks/milestone-attachment-integration.test.ts tests/checks/milestone-sweep.test.ts`. Fixture event payloads plus an injected in-memory tracker port (`readIssue`, `listComments`, `listMilestones`, `listIssues`, `addLabel`, `removeLabel`, `createComment`) record every call. The assertions are on the resulting tracker state **and** on the recorded call list — the call list is what proves "no duplicate application", "no other mutation", and "0 tracker writes". No `mock.module`; the fake is injected (`.ai/rules/typescript.md` §9).
- **Aggregate gate (no new code in the chain).** `TMPDIR=$PWD/tmp/tmpdir pnpm check` — lint → format:check → typecheck → test → check:boundaries → `prompt-conformance.ts` → `help-guide-coverage.ts` → `exports-parity.ts`. The new suites ride the existing `test` step; the workflow does not enter the chain (C-1/DEC-2).
- **Evidence runs (read-only, recorded, outside the gate).** Distribution guard `bash scripts/.tests/test-doc-distribution.sh` + `bash scripts/.tests/test-doc-distribution-modes.sh`; plugin freshness `./scripts/build-claude-plugin.sh` followed by `git status --porcelain .ados-claude/`; commit range `./scripts/lint-commit-range.sh --base main-tools`; the live advisory sweep (manual dispatch, read-only) and the M0/M1/M2 attachment reads. Each result is recorded in §10 and mirrored into pm-notes `notes:`. None of these runs inside `bun test` or `pnpm check`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-GUIDE-001 | Guide exists with the marker, index link, and script-generated header | Happy Path | Contract | Critical | AC-F1-1, AC-NFR4-1 |
| TC-GUIDE-002 | Nine lifecycle topics documented once, tracker record as source of truth, unattended-run precondition | Happy Path | Contract | Critical | AC-F1-2, AC-F1-3, DM-5 |
| TC-GUIDE-003 | Pack `## Conventions` points at the guide without restating the procedure | Happy Path | Contract | High | AC-F1-3 |
| TC-GUIDE-004 | PDR-0005 registered, records rule + enforcement + exemption, referenced from guide and change | Happy Path | Contract | High | AC-F1-4 |
| TC-GUIDE-005 | Distribution drift guard + negative-mode self-tests green; install set derived from the marker | Regression | Evidence | Critical | AC-F1-1, AC-NFR4-1 |
| TC-TPL-001 | Change-spec template carries required `change.milestone` with resolution rule and `none` escape | Happy Path | Contract | Critical | AC-F4-1, DM-1 |
| TC-TPL-002 | `@spec-writer` front-matter rules require the field and validate it | Happy Path | Contract | High | AC-F4-1, DM-1 |
| TC-TPL-003 | This change's spec value equals pm-notes `milestone` (tracker equality in TC-EVID-002) | Regression | Contract | Critical | AC-F4-1, DM-1, DM-3 |
| TC-TPL-004 | Exactly one template carries the field; the five excluded templates do not | Negative | Contract | Critical | AC-F4-2, C-6 |
| TC-PROMPT-001 | Tracker instructions require milestone at creation from the existing set; prohibitions preserved | Happy Path | Contract | Critical | AC-F2-1, DM-2 |
| TC-PROMPT-002 | `@pm` prompt carries the tracker-agnostic creation rule and forbids autonomous milestone creation | Happy Path | Contract | Critical | AC-F2-1 |
| TC-PROMPT-003 | Intake verifies attachment, records pm-notes, asks on absence, treats exempt as unattached | Happy Path | Contract | Critical | AC-F2-2, DM-3, C-3 |
| TC-PROMPT-004 | `@bootstrapper` guidance generates a milestone section in project tracker instructions | Happy Path | Contract | High | AC-F2-3 |
| TC-PLUGIN-001 | Generated plugin mirrors the three changed prompts and is fresh; prompt conformance green | Regression | Contract + Evidence | Critical | AC-F2-3, AC-NFR4-1 |
| TC-CHK-001 | Complete offline decision table; one verdict and a closed action set per evaluation | Contract | Unit | Critical | AC-F3-6, EVT-4 |
| TC-CHK-002 | Flag path: one flag label, exactly one marked comment, no other mutation | Happy Path | Integration | Critical | AC-F3-1, EVT-1, DM-2 |
| TC-CHK-003 | Idempotency: repeats add no comment and no duplicate label; state identical | Regression | Integration | Critical | AC-F3-2, AC-NFR1-1, NFR-1 |
| TC-CHK-004 | Exemption suppresses flag and comment and is reported as exempt | Negative | Integration | Critical | AC-F3-3, DM-2 |
| TC-CHK-005 | Attach clears the flag; detach restores it; neither comments; compliant/closed no-op | Corner Case | Integration | Critical | AC-F3-4, EVT-2 |
| TC-CHK-006 | Adversarial issue content: byte-identical static comment, no interpolation, no log leakage | Negative | Unit | Critical | AC-NFR7-1, NFR-7 |
| TC-SWEEP-001 | Sweep: advisory summary + one local artifact, 0 tracker writes, exit 0, fail-loud on API error | Happy Path | Integration | Critical | AC-F3-5, EVT-3, C-2 |
| TC-SWEEP-002 | Sweep bounds: page size 100, ≤⌈N/100⌉+3 reads, exit 0 for N=250/500, elapsed recorded | Corner Case | Integration | High | AC-NFR6-1, NFR-6 |
| TC-WF-001 | Workflow declares the six evaluation event classes and the manual sweep dispatch | Contract | Contract | High | AC-F3-7, AC-F3-6 |
| TC-WF-002 | Least privilege, 40-hex pins, no `pull_request_target`, no secret, no bypass construct | Negative | Contract | Critical | AC-F3-7, AC-NFR3-1, NFR-3 |
| TC-WF-003 | Each static workflow assertion is proven non-vacuous by a mutation fixture | Negative | Contract | Critical | AC-F3-7, AC-NFR3-1 |
| TC-GATE-001 | Aggregate chain unchanged and in order, no milestone step, no network-capable path | Regression | Contract | Critical | AC-NFR2-1, AC-F3-6, NFR-2, C-1 |
| TC-QG-001 | Gate green at delivered HEAD; conventional subjects; ≤100-char body/footer lines | Regression | Evidence | Critical | AC-NFR5-1, NFR-5, C-11 |
| TC-PLAN-001 | M2-S20 block exists in story shape with its ticket line | Happy Path | Contract | Critical | AC-F5-1, DM-4 |
| TC-PLAN-002 | Every M2 block carries exactly one valid ticket line; no other section leaks in | Negative | Contract | Critical | AC-F5-2, DM-4 |
| TC-PLAN-003 | Ranking: story-code set equality, contiguous unique numbering, M2 in backlog order | Regression | Contract | Critical | AC-F5-3 |
| TC-PLAN-004 | M2 pack carries the M2-S20 row, every cited seed heading exists, range covers S20 | Happy Path | Contract | High | AC-F5-4 |
| TC-PLAN-005 | Status snapshot carries the delivery addendum in the established form | Happy Path | Contract | High | AC-F5-5 |
| TC-EVID-001 | Read-only per-milestone declared-vs-attached evidence with empty gap list and reported debt count | Happy Path | Evidence | Critical | AC-F6-1, F-6 |
| TC-EVID-002 | GH-313 attached to M2; M2-S20 names it; three-surface title equality | Happy Path | Evidence | Critical | AC-F6-2, AC-F4-1 |
| TC-SCOPE-001 | Changed-scope conformance: no tickets, no milestones, no mass edits, no new install-set surface, no lifecycle change, no pre-flipped current truth | Negative | Manual (review) | High | AC-F4-2, AC-F1-1, AC-NFR4-1 |

### 5.2 Scenario Details

#### TC-GUIDE-001 - Guide exists with the marker, index link, and script-generated header

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-NFR4-1, NFR-4, C-9
**Test Type(s)**: Contract (front matter + index table as data)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-guide.test.ts` (To Implement)
**Tags**: @bun, @docs, @distribution

**Preconditions**:

- `doc/guides/milestone-management.md` is delivered (guide phase).
- `scripts/add-header-location.sh` and the existing `doc/guides/*.md` files define the expected header shape.

**Steps**:

1. Assert the file exists at `doc/guides/milestone-management.md`.
2. Parse its first `---` front-matter block; assert `ados_distribution: redistributable` (exact enum value, quote-tolerant parse), and assert the parse is on the first block only (a body occurrence does not satisfy the marker).
3. Assert the header block, where present, is exactly the script-generated form: the three `#`-prefixed copyright/license lines and a `source:` line whose path is `doc/guides/milestone-management.md` (branch segment per the script default). Assert no header text is hand-shaped (no alternate copyright wording, no missing `source:`, no second header block).
4. Parse `doc/00-index.md`, locate the `## Guides` table, and assert exactly one row links `guides/milestone-management.md`, with a non-empty description.
5. Assert the guide contains a pointer to `doc/decisions/PDR-0005-*.md` (rule provenance) and no repository-specific milestone number or ticket number asserted as a redistributable rule (C-4).

**Expected Outcome**:

- The guide is discoverable, correctly classified, and header-managed; the index link resolves. AC-F1-1's "no hand-written header" is satisfied as "header, if present, is byte-equivalent to script output" (see TP-Q3).

**Notes / Clarifications**:

- If the header script has not yet been run at the moment the suite first executes, the test fails on the missing generated header block — this is intentional: the guide phase runs the script before its gate.

#### TC-GUIDE-002 - Nine lifecycle topics documented once, tracker record as source of truth, unattended-run precondition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F1-3, DM-5, C-9
**Test Type(s)**: Contract (heading/keyword anchors) + recorded content review
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/checks/milestone-guide.test.ts` (To Implement) + review checklist row in §10
**Tags**: @bun, @docs, @review

**Preconditions**:

- TC-GUIDE-001's guide is delivered.

**Steps**:

1. Assert one heading (any level) per topic, exactly once each: naming, creation, attachment, entry review, planned scope, exit review, closure, extension or reopening, enforcement. Case-insensitive heading match; fail naming the missing or duplicated topic.
2. Assert the naming section states the `M<n>: <outcome phrase>` convention (literal `M<n>` token), that the prefix is the durable identifier and matches the story-code root, and that the tracker record is the source of truth for identity/attachment/state.
3. Assert the creation section states owner-created, agent-proposed, never agent-created.
4. Assert the attachment section states one milestone per `change` ticket at creation, and that the backlog mirrors it with `- Ticket: GH-<n> (milestone M<n>)`.
5. Assert the enforcement section names the flag label `needs-milestone`, the exemption label `backlog-capture`, the non-blocking nature of the flag, and the advisory sweep.
6. Assert the guide states the unattended-run precondition: a milestone and all its linked tickets exist before work starts.
7. Recorded review: one pass confirming no topic is substantively restated in another section (semantic duplication is not mechanically decidable — see §1.2).

**Expected Outcome**:

- All nine topics present exactly once, each carrying the rule's substance; the precondition and the vocabulary are explicit.

#### TC-GUIDE-003 - Pack `## Conventions` points at the guide without restating the procedure

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-5, AC-F1-3, RSK-9, C-9
**Test Type(s)**: Contract (section extraction + link/text assertions)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-guide.test.ts` (To Implement)
**Tags**: @bun, @docs, @planning

**Preconditions**:

- `doc/planning/oss-tooling/milestones/README.md` has a `## Conventions` section (verified today).

**Steps**:

1. Extract the `## Conventions` section body (until the next `## ` heading).
2. Assert it contains a markdown link resolving to `../../guides/milestone-management.md` (path-relative resolution checked against the file's directory).
3. Assert it names the operating rule as a convention (a sentence naming the milestone-first rule / planned scope) — a pointer, not a procedure.
4. Assert non-duplication by structure: the section contains no ordered procedure list (`1.`/`2.` …) and none of the lifecycle-topic headings, and does not define entry review, exit review, or closure inside itself.
5. Assert the rest of the pack index is unchanged in meaning: the existing conventions (binary placeholder, status semantics, diagrams, no private content) remain present.

**Expected Outcome**:

- The pack records the rule as a pointer only; a rule change stays a guide edit plus one sentence (RSK-9 mitigation).

#### TC-GUIDE-004 - PDR-0005 registered, records rule + enforcement + exemption, referenced from guide and change

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-4, DEC-5
**Test Type(s)**: Contract (register table + record content + reference graph)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-guide.test.ts` (To Implement)
**Tags**: @bun, @docs, @governance

**Preconditions**:

- `doc/decisions/PDR-0005-milestone-first-planning-and-delivery.md` exists (authored during the artifact phases; present and untracked at test-plan time).

**Steps**:

1. Assert the record file exists with `id: PDR-0005` and `decision_type: pdr` in front matter.
2. Parse `doc/decisions/00-index.md`; assert exactly one row with id `PDR-0005` whose link resolves to the record file and whose type cell is `PDR`.
3. Assert the record states the operating rule, the enforcement mechanism (flag label + one marked comment, non-blocking, reversible), and the exemption (capture marker, not a delivery licence).
4. Assert the guide links the record and the change spec declares `links.decisions: ["PDR-0005"]` (both directions present).
5. Assert the record's status is `Proposed` with `decision_date: null` (the R2 open-PR ratification convention, PDR-0004 precedent) — an `Accepted` claim would be false before the owner decides.

**Expected Outcome**:

- The rule has one precedent-setting record, discoverable from the register, the guide, and the change; no premature acceptance is claimed.

#### TC-GUIDE-005 - Distribution drift guard + negative-mode self-tests green; install set derived from the marker

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-NFR4-1, NFR-4
**Test Type(s)**: Evidence (guard run)
**Automation Level**: Automated (evidence run, not part of `pnpm check`)
**Target Layer / Location**: repository root — `bash scripts/.tests/test-doc-distribution.sh` and `bash scripts/.tests/test-doc-distribution-modes.sh`
**Tags**: @gate, @distribution, @docs

**Preconditions**:

- TC-GUIDE-001's guide is delivered and the header script has been run.

**Steps**:

1. Run `bash scripts/.tests/test-doc-distribution.sh`; assert exit 0 and that its derived install set includes `doc/guides/milestone-management.md`.
2. Run `bash scripts/.tests/test-doc-distribution-modes.sh`; assert exit 0 (the five failure modes still fire — the guard was not weakened to accommodate the new file).
3. Assert `scripts/install.sh` was not hand-edited to list the guide (the install set stays marker-derived; the guard's mode 5 would catch drift, and the assertion records the "no install-set change" intent for AC-NFR4-1).
4. Record both runs in §10 and mirror into the guide phase's pm-notes `notes:` entry.

**Expected Outcome**:

- The guide enters the install set by its marker alone; the guard and its self-tests are green; no install-set hand-edit exists.

#### TC-TPL-001 - Change-spec template carries required `change.milestone` with resolution rule and `none` escape

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-1, DEC-6, DEC-7
**Test Type(s)**: Contract (template front matter + instruction text)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-artifacts.test.ts` (To Implement)
**Tags**: @bun, @docs, @templates

**Preconditions**:

- `doc/templates/change-spec-template.md` exists with its `change:` front-matter block.

**Steps**:

1. Parse the template YAML front matter; assert `change.milestone` is present as a key (the template's placeholder form is acceptable, e.g. `<tracker-milestone-title>`), positioned inside `change:`.
2. Assert the template's instruction/comment text states the field is **required**, that the value is the tracker milestone title verbatim (`M<n>: <outcome phrase>`), that it equals the pm-notes `milestone`, and that the literal `none` is permitted only where the project's tracker instructions declare no milestone construct.
3. Assert the template offers no per-change convenience escape (the `none` rule is bound to a project property, not to author preference).
4. Assert the field is not duplicated elsewhere in the template (one occurrence).

**Expected Outcome**:

- The template makes the declaration mandatory and gives one unambiguous value rule; DM-1 is the contract.

#### TC-TPL-002 - `@spec-writer` front-matter rules require the field and validate it

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-1
**Test Type(s)**: Contract (prompt text as data)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-artifacts.test.ts` (To Implement)
**Tags**: @bun, @prompts, @templates

**Preconditions**:

- `.opencode/agent/spec-writer.md` carries a `<front_matter_rules>` block.

**Steps**:

1. Extract the `<front_matter_rules>` block (and its `Validation:` list).
2. Assert the YAML skeleton in the block includes `milestone:` under `change:` alongside the existing keys.
3. Assert the validation list requires the field, and states the value rule (tracker title verbatim; equal to pm-notes) and the `none` escape condition.
4. Assert the prompt's front-matter validation checklist still requires `change.ref`, owners ≥ 1, and `status: Proposed` (the new rule is additive, not a replacement).

**Expected Outcome**:

- The field is authored by rule, not optionally filled; the existing front-matter contract is intact.

#### TC-TPL-003 - This change's spec value equals pm-notes `milestone` (tracker equality in TC-EVID-002)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F6-2, DM-1, DM-3, DEC-7
**Test Type(s)**: Contract (cross-file value equality)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-artifacts.test.ts` (To Implement)
**Tags**: @bun, @docs, @governance

**Preconditions**:

- This change's spec root-level `change:` front matter carries the field; pm-notes carries `milestone`.

**Steps**:

1. Parse `chg-GH-313-spec.md` front matter; read `change.milestone`. Assert it is present, non-empty, not `none`, and matches `^M\d+: .+`.
2. Parse `chg-GH-313-pm-notes.yaml`; read `milestone`. Assert string equality with the spec value.
3. Assert the value matches the milestone title recorded for M2 in the planning corpus evidence path used by TC-EVID-002 (the exact tracker comparison is live and read-only there).
4. Assert no translation layer exists: the spec value is not a milestone number and not a story code.

**Expected Outcome**:

- One string on two in-repo surfaces; the third surface (tracker) is closed by TC-EVID-002. Disagreement becomes detectable instead of invisible.

#### TC-TPL-004 - Exactly one template carries the field; the five excluded templates do not

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DEC-6, C-6
**Test Type(s)**: Contract (directory scan)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-artifacts.test.ts` (To Implement)
**Tags**: @bun, @templates, @negative

**Preconditions**:

- `doc/templates/` holds the change-spec, implementation-plan, test-plan, feature-spec, engineering-roadmap, and decision-record templates among others.

**Steps**:

1. Read every `doc/templates/**/*.md`; extract the first YAML front-matter block where present.
2. Assert exactly one file declares `change.milestone` (or a top-level `milestone:` field declared as a milestone membership): `change-spec-template.md`.
3. Assert each of the five excluded templates has no milestone-membership field: `implementation-plan-template.md`, `test-plan-template.md`, `feature-spec-template.md`, `engineering-roadmap-template.md`, `decision-record-template.md`.
4. Assert the exclusion reasons are recorded (the spec's DEC-6 text is present and referenced by the template's own comment or the decision log) — the assertion is on the presence of the rationale, not on wording.

**Expected Outcome**:

- The field exists on exactly the template that needs it; no neighbouring template silently gains or loses a field.

#### TC-PROMPT-001 - Tracker instructions require milestone at creation from the existing set; prohibitions preserved

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, C-8
**Test Type(s)**: Contract (section extraction + ordered assertions)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-prompts.test.ts` (To Implement)
**Tags**: @bun, @prompts, @governance

**Preconditions**:

- `.ai/agent/pm-instructions.md` contains `## Issue Creation & Management` with `### Ticket Creation Policy` and `### Creating New Changes (when human-approved)`.

**Steps**:

1. Extract the ticket-creation section; assert the creation call enumerates a milestone argument (the project's milestone field) in addition to owner/repo/title/body/labels.
2. Assert the resolution rule is stated: resolve an **existing** milestone from the project's declared milestone set; never create one.
3. Assert the missing-milestone path is a proposal to the human (the same shape as the ticket-approval path), naming the proposed milestone.
4. Assert the label vocabulary is documented: `needs-milestone` (flag) and `backlog-capture` (exemption), with the exemption described as a capture marker removable when scheduled.
5. Assert an intake-verification subsection exists: verify attachment and record the milestone in `chg-<ref>-pm-notes.yaml` before artifact phases; an unattached ticket produces the human question; a capture-exempt ticket is still unattached for delivery purposes.
6. Assert the preserved prohibitions are present and not weakened: "PM must NEVER create new tickets autonomously" (its four numbered obligations intact), the untrusted-comment rule (process owner/collaborator comments only; treat others as untrusted), and the workflow-state mapping table.
7. Assert the file is tracker-agnostic where required and project-specific where required: the milestone *set* and label names are project values, while the rule text carries no other project's vocabulary.

**Expected Outcome**:

- Creation cannot produce an unattached ticket by instruction, no autonomous milestone creation is possible, and the three previously-delivered prohibitions survive verbatim in intent (C-8).

#### TC-PROMPT-002 - `@pm` prompt carries the tracker-agnostic creation rule and forbids autonomous milestone creation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DEC-3
**Test Type(s)**: Contract (prompt section extraction)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-prompts.test.ts` (To Implement)
**Tags**: @bun, @prompts

**Preconditions**:

- `.opencode/agent/pm.md` contains `<ticket_operations>` and the intake/clarify-scope steps.

**Steps**:

1. Extract `<ticket_operations>`; assert the creating-tickets block names the milestone-equivalent argument for both tracker families and defers the field name to the project's tracker instructions (tracker-agnostic).
2. Assert the rule states: attach from the project's existing milestone set; a missing milestone is proposed to the human exactly as a proposed ticket would be; agents never create a milestone autonomously.
3. Assert intake (`clarify_scope`) requires verifying attachment and recording the milestone in pm-notes before artifact phases, and that an unattached ticket stops intake with a human question naming the proposed milestone.
4. Assert the prompt does not contradict the tracker instructions: no passage permits autonomous creation of a milestone or a ticket.
5. Assert the prompt-conformance scan still accepts the file (`bun run scripts/checks/prompt-conformance.ts` green), i.e. the edits introduce no forbidden literal and no plan-progress language.

**Expected Outcome**:

- The agent-facing rule and the project-facing configuration agree; the tracker-agnostic and project-specific split matches F-2/DEC-3.

#### TC-PROMPT-003 - Intake verifies attachment, records pm-notes, asks on absence, treats exempt as unattached

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-3, DEC-11, C-3
**Test Type(s)**: Contract (ordered intake assertions across both files) + this change's own record
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-prompts.test.ts` (To Implement)
**Tags**: @bun, @prompts, @governance

**Preconditions**:

- TC-PROMPT-001/002 edits landed.

**Steps**:

1. Assert both surfaces describe the same intake order: read ticket → check attachment → (attached) record in pm-notes → artifacts; (unattached) ask the human naming the proposed milestone → stop until attached.
2. Assert the wording makes artifact phases conditional on the attachment existing (no "proceed with a TODO" path).
3. Assert the exemption is explicitly **not** a delivery licence: an exempt ticket still produces the question and still blocks artifact phases (DEC-11/C-3; the rule that stops RSK-2 becoming a permanent bypass).
4. Assert the pm-notes record is named as the `milestone` key (delivered optional key, no schema change claimed).
5. Assert this change's own evidence of the rule: `chg-GH-313-pm-notes.yaml` carries a non-empty `milestone` and the change spec carries the equal value (TC-TPL-003 binds the equality).

**Expected Outcome**:

- Intake has one stopping condition and one record; capture and delivery are different states with different evidence.

#### TC-PROMPT-004 - `@bootstrapper` guidance generates a milestone section in project tracker instructions

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DEC-3
**Test Type(s)**: Contract (guidance block extraction)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-prompts.test.ts` (To Implement)
**Tags**: @bun, @prompts, @bootstrap

**Preconditions**:

- `.opencode/agent/bootstrapper.md` contains `<pm_instructions_guidance>` with its mandatory-sections list.

**Steps**:

1. Extract `<pm_instructions_guidance>`; assert the mandatory-sections list gains a milestone section (numbering may shift).
2. Assert the section's required content is stated: the milestone convention/naming, attachment at creation from the existing set, no autonomous creation, intake verification, and the capture exemption.
3. Assert the guidance keeps the pre-existing mandatory sections (tracker configuration, workflow-state mapping, label taxonomy, backlog source of truth, conventions) — the addition is additive.
4. Assert the generated-configuration scope remains a project value: the guidance instructs the generator to derive the milestone *set* from the project, not to copy this repository's titles.

**Expected Outcome**:

- A bootstrapped project starts compliant instead of inheriting the gap; the guidance carries rule shape, not repo content.

#### TC-PLUGIN-001 - Generated plugin mirrors the three changed prompts and is fresh; prompt conformance green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, AC-NFR4-1, NFR-4, C-7, RSK-3
**Test Type(s)**: Contract (generated artifacts as data) + Evidence (freshness run)
**Automation Level**: Semi-automated (contract assertion + recorded build)
**Target Layer / Location**: `tests/checks/milestone-prompts.test.ts` (To Implement) + `./scripts/build-claude-plugin.sh` evidence run
**Tags**: @bun, @prompts, @plugin, @gate

**Preconditions**:

- Prompt sources edited; the plugin regenerated in the same change.

**Steps**:

1. For each changed prompt (`pm.md`, `spec-writer.md`, `bootstrapper.md`), locate its generated counterpart under `.ados-claude/agents/` and assert it exists and carries the generated-file header naming its source path and the regeneration command.
2. Assert each generated file contains the milestone anchors introduced in the source (the creation/intake rule for `pm`, the front-matter field for `spec-writer`, the milestone section for `bootstrapper`) — a generated file that predates the edit fails.
3. Assert no generated file was hand-edited: the header's "GENERATED FILE — DO NOT EDIT DIRECTLY" block is intact and the source-of-truth path resolves to an existing `.opencode/agent/*.md`.
4. Run `./scripts/build-claude-plugin.sh`; assert it exits 0 and `git status --porcelain .ados-claude/` is empty (freshness). Record the run; CI's `verify-claude-build` job is the standing authority.
5. Run `bun run scripts/checks/prompt-conformance.ts` and `bun run scripts/checks/help-guide-coverage.ts`; assert both exit 0.

**Expected Outcome**:

- Generated output matches its sources byte-for-byte, the freshness job will pass, and prompt/help conformance stay green (RSK-3 mitigation).

**Notes / Clarifications**:

- Step 4 is evidence, not a permanent assertion: running the build writes files, so it is executed at the prompts phase and at `quality_gates`, recorded in §10/pm-notes. CI enforces it on every push.

#### TC-CHK-001 - Complete offline decision table; one verdict and a closed action set per evaluation

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-6, EVT-1, EVT-4, NFR-1
**Test Type(s)**: Unit (pure core, table-driven)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment.test.ts` (To Implement) over the core module (proposed `scripts/checks/milestone-attachment.ts`; plan pins the path)
**Tags**: @bun, @unit, @milestone

**Preconditions**:

- The core exposes a pure evaluator over a value input `{ labels, state, milestone, event }` and returns `{ verdict, actions }`.

**Steps**:

1. Assert every row of the spec Appendix C decision table, at minimum:
   - `change` + open + no milestone + no exemption + opened/edited/labeled → `flagged`;
   - `change` + open + milestone + no exemption + any event → `compliant` (no actions);
   - `change` + open + no milestone + exemption + any event → `exempt` (no actions);
   - `change` + open + milestone + exemption + any event → `compliant` (no actions);
   - `change` + open + milestone + `milestoned` → `compliant` with a flag-removal action;
   - `change` + open + no milestone + `demilestoned` → `restored` with a flag-add action;
   - `change` + closed + no milestone + no exemption + any event → `out-of-scope` (no actions);
   - non-`change` + any state/milestone/exemption/event → `out-of-scope` (no actions).
2. Assert the verdict value is exactly one member of the closed set `compliant | exempt | flagged | restored | out-of-scope` for every input combination (exhaustive product over boolean dimensions and event classes), and never undefined/empty.
3. Assert the action list is a closed union: every action produced by the exhaustive matrix is `add-label` (flag), `remove-label` (flag), or `create-comment` — no state, assignee, milestone, or other-label action exists in the type or in the output.
4. Assert determinism: evaluating the same input twice yields deep-equal results; evaluation order across the table does not matter.
5. Assert the case table used by the suite covers every row of the spec table (the suite asserts the row count and each row's expected verdict, so a row removed from the core fails the suite rather than silently shrinking coverage).

**Expected Outcome**:

- The decision logic is fully pinned offline, with a closed verdict vocabulary and a closed write surface; AC-F3-6's "full decision table ... without network access" is demonstrated by construction.

**Notes / Clarifications**:

- AC-F3-6 also makes a coverage claim about its own test suite. Step 5 converts that into a testable property: the suite's row table must be complete against the pinned table, and a missing row is a failure.

#### TC-CHK-002 - Flag path: one flag label, exactly one marked comment, no other mutation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, AC-NFR1-1, EVT-1, DM-2
**Test Type(s)**: Integration (fixture event + fake tracker port)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment-integration.test.ts` (To Implement), fixtures under `tests/fixtures/milestone-attachment/`
**Tags**: @bun, @integration, @milestone, @security

**Preconditions**:

- In-memory tracker port with call recording: `readIssue`, `listComments`, `listMilestones`, `listIssues`, `addLabel`, `removeLabel`, `createComment`.
- Fixture `events/issue-opened--change--no-milestone.json` (open issue, labels `["change"]`, `milestone: null`, `author_association` irrelevant to the rule).

**Steps**:

1. Seed the port with the fixture issue, no comments, and milestones M0/M1/M2.
2. Run the port-injected runner for the event; capture the resulting tracker state and the recorded call list.
3. Assert the verdict is `flagged`.
4. Assert the flag label `needs-milestone` was applied exactly once, and the issue now carries `change` + `needs-milestone` (no other label added or removed).
5. Assert exactly one comment was created; its body contains the stable marker, the guide path `doc/guides/milestone-management.md`, the exemption label `backlog-capture`, and a statement that the flag does not block work.
6. Assert the recorded call list contains **only** allowed write calls (`addLabel`, `createComment`) plus reads; zero state transitions, zero assignee updates, zero milestone writes, zero other-label writes.
7. Assert the issue `state` and `assignee` in the resulting tracker state are byte-equal to the seed.
8. Repeat the whole case with `events/issue-opened--change--with-milestone.json` and `--exempt.json`; assert zero write calls in both (contrast cases for precision).

**Expected Outcome**:

- One label and one legible comment on a genuine orphan; nothing else changes; the §8.1 interaction contract is the only surface exercised.

#### TC-CHK-003 - Idempotency: repeats add no comment and no duplicate label; state identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-NFR1-1, NFR-1, SC-M2-S20-01, SC-M2-S20-02
**Test Type(s)**: Integration (repeated evaluation over one port state)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment-integration.test.ts` (To Implement)
**Tags**: @bun, @integration, @milestone, @idempotency

**Preconditions**:

- TC-CHK-002's flag case completed on a fresh port (so the issue is flagged with one comment).

**Steps**:

1. Replay the same `issue-opened` event 3 times; assert no new comment and zero `addLabel` calls on repeats (the flag is already present), and assert the full tracker state is deep-equal after run 2 and run 3 to the state after run 1.
2. Replay `issue-edited` and `issue-labeled` events carrying the marker comment in `listComments`; assert verdict `flagged` with **zero** write calls.
3. Run a variant where the marker comment exists but the flag label is absent; assert the label is re-applied once and no comment is created (the marker, not the label, governs the comment).
4. Run a variant where the flag label exists but no marker comment exists (manual label application); assert no comment is created and no duplicate label call is issued.
5. Assert the invariant across the sequence: comment count ≤ 1 and flag-label application count ≤ 1 across all runs, and the observable state after N runs equals the state after the first.

**Expected Outcome**:

- Any number of triggers leaves the tracker in the same state, with at most one comment ever; "0 duplicate label applications" is proven at the action layer (see TP-Q4).

#### TC-CHK-004 - Exemption suppresses flag and comment and is reported as exempt

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, AC-F1-2, DM-2, DEC-11, SC-M2-S20-03
**Test Type(s)**: Integration (suppression probe)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment-integration.test.ts` (To Implement)
**Tags**: @bun, @integration, @milestone, @negative

**Preconditions**:

- Fixture `events/issue-opened--change--exempt.json` (open `change` issue, no milestone, labels include `backlog-capture`).

**Steps**:

1. Seed the port with the exempt issue; run each event class (opened, edited, labeled, demilestoned).
2. Assert the verdict is `exempt` for every event.
3. Assert zero write calls: no flag label, no comment, no label removal.
4. Assert the exemption is removable at any time with the flag returning on the next evaluation: seed the same issue without `backlog-capture`, run `issue-edited`, assert verdict `flagged` and the flag action set (label + comment) appears.
5. Assert the run summary for the exempt case names the issue number and the verdict `exempt` and reports "no writes" (legibility, §10) without copying the issue title/body.

**Expected Outcome**:

- The only escape is honest and reversible; the exempt ticket is visibly not yet planned, never silently treated as compliant.

#### TC-CHK-005 - Attach clears the flag; detach restores it; neither comments; compliant/closed no-op

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-4, EVT-2, DM-2, SC-M2-S20-04
**Test Type(s)**: Integration (reversal state machine)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment-integration.test.ts` (To Implement)
**Tags**: @bun, @integration, @milestone, @reversal

**Preconditions**:

- A port state representing a flagged issue (label present, marker comment present) — produced by TC-CHK-002, not hand-seeded, so the fixture cannot encode a state the check cannot reach.

**Steps**:

1. Run `events/issue-milestoned--change.json`; assert verdict `compliant`, exactly one `removeLabel` call for `needs-milestone`, zero `createComment`, zero other writes; assert the existing marker comment is untouched.
2. Run `events/issue-demilestoned--change.json` on the resulting state; assert verdict `restored`, exactly one `addLabel` call, zero `createComment`; assert the comment count is still 1.
3. Run the demilestoned event again; assert zero write calls (idempotent restoration).
4. Run a `milestoned` event on an issue that never carried the flag; assert zero `removeLabel` calls (no spurious removal) and verdict `compliant`.
5. Run `events/issue-demilestoned--change--closed.json`; assert verdict `out-of-scope` and zero writes (closed issues never re-flag).
6. Assert the full sequence leaves exactly one comment and only label writes, and that the final state equals the state after step 2 (reversal is a pure label toggle).

**Expected Outcome**:

- Attachment reverses the flag without destroying history; detachment restores it without a second explanation; closed and compliant states never produce writes.

#### TC-CHK-006 - Adversarial issue content: byte-identical static comment, no interpolation, no log leakage

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, AC-NFR7-1, F-3, C-5
**Test Type(s)**: Unit (pure comment builder + summary projection)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment.test.ts` (To Implement), fixtures under `tests/fixtures/milestone-attachment/adversarial/`
**Tags**: @bun, @unit, @security, @milestone

**Preconditions**:

- The comment body and the run-summary projection are pure functions in the core module.

**Steps**:

1. Build the comment body for each adversarial fixture: `issue-text-injection.json` (title/body/author containing `${{ secrets.TOKEN }}`, `<!-- marker -->`, backticks, a line starting `## `, `</script>`, ANSI escape sequences) and `issue-log-forging.json` (newlines, `\r`, zero-width characters, a right-to-left override, a 10 000-character body).
2. Assert the body is byte-identical across **every** case, and identical to the body produced for a benign fixture (one string, always).
3. Assert the body contains none of the adversarial tokens and no substring of any fixture title, body, or author login (assert against a token list extracted from each fixture, so the check is non-vacuous).
4. Assert the body is a static constant: the builder accepts no issue-derived argument (call it with the adversarial issue and with a benign issue and compare; additionally assert the module-level constant is referenced by the builder).
5. Render the run-summary projection for each adversarial fixture; assert it contains the issue number, the verdict, and the writes ("none" or the action list) and zero issue-authored text (title/body/author) and zero control characters.
6. Assert no untrusted text reaches a log-shaped projection: any diagnostic string produced by the runner for these fixtures contains only the issue number, the event name, and the verdict.

**Expected Outcome**:

- The primary injection surface is closed by construction, not by escaping; the flag is legible without echoing the issue's content.

#### TC-SWEEP-001 - Sweep: advisory summary + one local artifact, 0 tracker writes, exit 0, fail-loud on API error

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-5, EVT-3, NFR-6, C-2, SC-M2-S20-05
**Test Type(s)**: Integration (sweep over paged fixtures with a fake port and a temp output directory)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-sweep.test.ts` (To Implement)
**Tags**: @bun, @integration, @sweep, @read-only

**Preconditions**:

- Fixture `sweep/issues-n250-page-1..3.json` (100/100/50) including: unattached open `change` issues, exempt issues, milestoned issues, closed issues, non-change issues.
- An isolated temp directory standing in for the declared sweep output path (plan pins the production path, e.g. `tmp/milestone-sweep/latest.json`).

**Steps**:

1. Run the sweep through the runner with the fake port and the temp output directory; capture the exit code, the recorded call list, the artifact file(s), and the summary projection.
2. Assert exit code 0 with a non-zero finding count.
3. Assert **zero** write calls of any kind (no `addLabel`, `removeLabel`, `createComment`, no state/milestone/assignee call).
4. Assert exactly one file was created in the output directory, JSON-parseable, carrying: total inspected, exempted count, unattached count (open `change` minus exempt), the issue list of unattached numbers, and an explicit statement that no tracker write occurred with the local artifact named as the only write.
5. Assert the artifact contains no issue titles, bodies, or author logins (numbers and labels only — NFR-7 by extension).
6. Assert exclusion correctness: closed issues, non-`change` issues, and milestoned issues appear in neither the unattached list nor the exempted count; exempt issues appear only in the exempted count.
7. Run the sweep with a port whose read throws; assert the run exits non-zero, names the failure, and writes no summary artifact (fail-loud, no `continue-on-error`-style swallow).

**Expected Outcome**:

- Historical debt is visible and untouched; the single write is a repository-local artifact; an outage cannot present as a clean pass.

#### TC-SWEEP-002 - Sweep bounds: page size 100, ≤⌈N/100⌉+3 reads, exit 0 for N=250/500, elapsed recorded

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-6, AC-NFR6-1, F-3
**Test Type(s)**: Integration (call-count bound over two populations)
**Automation Level**: Automated (bound) + recorded measurement (elapsed)
**Target Layer / Location**: `tests/checks/milestone-sweep.test.ts` (To Implement)
**Tags**: @bun, @integration, @sweep, @bounds

**Preconditions**:

- Fixtures `sweep/issues-n250-*` (3 pages) and `sweep/issues-n500-*` (5 pages).

**Steps**:

1. Run the sweep for N=250; assert every list request used page size 100 and the total read count is ≤ ⌈250/100⌉ + 3 = 6, and that no read was repeated for the same page.
2. Run for N=500; assert the same page size and a total read count ≤ ⌈500/100⌉ + 3 = 8.
3. Assert the read count is independent of the finding count (add an all-clean population of N=500 and assert the same bound).
4. Assert exit code 0 in both runs regardless of findings.
5. Record the measured elapsed time of the N=500 run in §10; assert only that it completed (the 10-minute ceiling is an evidence threshold, not a deterministic assertion — see §1.2).

**Expected Outcome**:

- The sweep is bounded by pages, not by findings; the structural bound is asserted, the wall-clock claim is recorded.

#### TC-WF-001 - Workflow declares the six evaluation event classes and the manual sweep dispatch

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-7, AC-F3-6, EVT-1, EVT-2, EVT-3
**Test Type(s)**: Contract (workflow YAML parse)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-workflow.test.ts` (To Implement)
**Tags**: @bun, @workflow, @contract

**Preconditions**:

- `.github/workflows/ticket-milestone-check.yml` (proposed name; the plan pins it).

**Steps**:

1. Parse the workflow with the `yaml` package; assert the `on:` block declares `issues` with types covering opened, edited, labeled, milestoned, demilestoned (the six evaluation classes include the manual sweep).
2. Assert a `workflow_dispatch` trigger exists with an input selecting sweep mode (a named boolean/choice input), and that the sweep path is reachable only through dispatch (no schedule).
3. Assert every declared event reaches the same evaluation entry point (the job's run step invokes the runner with the event payload path), so one verdict per evaluation is acted on (EVT-4).
4. Assert the sweep step's exit semantics are the runner's, not a shell swallow: the dispatch step does not wrap the command in `|| true`/`exit 0` (the sweep itself returns 0 on findings).
5. Assert no `permissions: write-all` and no repository-wide permission block that widens the job's grant.

**Expected Outcome**:

- The declared events match the contract, the sweep is manual-only, and the single-verdict rule is wired through one entry point.

#### TC-WF-002 - Least privilege, 40-hex pins, no `pull_request_target`, no secret, no bypass construct

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-7, AC-NFR3-1, NFR-3, RSK-5
**Test Type(s)**: Contract (static security assertions)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-workflow.test.ts` (To Implement), reusing the scanners' rule shapes from `scripts/checks/ci-supply-chain.ts` and `ci-bindingness.ts`
**Tags**: @bun, @workflow, @security, @supply-chain

**Preconditions**:

- TC-WF-001's workflow file exists.

**Steps**:

1. Parse the workflow; assert the enforcement job's `permissions` block is exactly `{ issues: write, contents: read }` — no extra scope, no `id-token`, no `packages`, no `actions` write.
2. Assert every `uses:` value in every step matches `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+@[0-9a-f]{40}$` (full commit SHA, no tag, no branch, no `@v4`).
3. Assert the workflow's `on:` block does not contain `pull_request_target` (and no `workflow_run` chain that would bypass the fork boundary).
4. Assert the serialized workflow text contains no `secrets.` reference (the token must come from `github.token`/the default token) and no `env` value echoing a secret-shaped name.
5. Assert no bypass construct anywhere in the enforcement job: `continue-on-error`, `|| true`, `set +e`, `if: always()`, `exit 0` wrap — using the same forbidden-pattern set as `scripts/checks/ci-bindingness.ts`.
6. Assert the write calls are limited by construction: the workflow passes only the event path and token to the runner; no `gh`/`curl` write command appears inline in the workflow (writes go through the port adapter).
7. Assert the job is not a required check and carries no `if:` that would make it advisory only (the check must run; it just must not block delivery — C-6).

**Expected Outcome**:

- The workflow cannot exceed the declared privilege, cannot float an action, cannot read a secret, and cannot swallow a failure.

#### TC-WF-003 - Each static workflow assertion is proven non-vacuous by a mutation fixture

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-7, AC-NFR3-1, NFR-3
**Test Type(s)**: Contract (mutation test over a temp copy)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-workflow.test.ts` (To Implement); pattern from `tests/checks/ci-checks.test.ts`
**Tags**: @bun, @workflow, @mutation, @negative

**Preconditions**:

- TC-WF-002's assertions are implemented as pure functions over workflow text (so a mutated copy can be scanned).

**Steps**:

1. Copy the workflow into a temp directory; inject, one at a time: `issues: write` widened with `pull-requests: write`; an action reference changed to `actions/checkout@v4`; a `pull_request_target` trigger; a `${{ secrets.GITHUB_TOKEN }}` reference; `continue-on-error: true` on the enforcement step; a `|| true` suffix on the runner command.
2. Assert each mutation is rejected and the finding **names the offending field** (consistent with the repository invariant-check contract).
3. Assert the unmutated copy passes.
4. Assert coverage of the gap: the scanner function is applied to the new workflow path (not only `ci.yml`), and a test asserts that the set of scanned workflow files includes `ticket-milestone-check.yml` — so a future rename cannot silently drop the file from the battery (TP-Q2).
5. If the implementation plan extends `ci-supply-chain.ts`/`ci-bindingness.ts`/`ci-topology.ts` to scan all workflow files, assert those extended rules reject the same mutations and that `bun run scripts/checks/ci-supply-chain.ts` (etc.) stay green on the live tree.

**Expected Outcome**:

- Every security assertion is proven to fire; the new workflow cannot escape the battery by living outside `ci.yml`.

#### TC-GATE-001 - Aggregate chain unchanged and in order, no milestone step, no network-capable path

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR2-1, AC-F3-6, NFR-2, C-1, DEC-2
**Test Type(s)**: Contract (manifest + module-import scan)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-gate.test.ts` (To Implement)
**Tags**: @bun, @gate, @contract

**Preconditions**:

- `package.json` `scripts.check` is the single aggregate (pinned by `scripts/checks/script-surface.ts`).

**Steps**:

1. Parse `package.json`; split `scripts.check` on `&&`; assert the first five tokens are, in order, `lint`, `format:check`, `typecheck`, `test`, `check:boundaries` (the `NAMED_CHECKS` contract) and that the trailing scans `scripts/checks/prompt-conformance.ts`, `scripts/checks/help-guide-coverage.ts`, `scripts/checks/exports-parity.ts` are still present.
2. Assert the aggregate contains no milestone token: no `milestone`, no `ticket-milestone`, no `workflow_dispatch`, and no new step between the five named checks.
3. Assert the aggregate contains no network-capable command: no `curl`, `wget`, `gh `, `http://`, `https://`, `node:http`, `fetch(`.
4. Assert no alternate aggregate exists (`verify`, `ci`, `all`, `validate`, `precommit`) — the `script-surface.ts` alternate-aggregate rule, re-asserted here as the milestone-specific guard; and assert `bun run scripts/checks/script-surface.ts` exits 0.
5. Static scan of the delivered core/runner/adapter modules: assert no import of `node:http`, `node:https`, `node:child_process`, or a tracker SDK, and no bare `fetch(` call. The only network-capable surface is the workflow-time adapter, which is not referenced from `scripts.check`.
6. Assert the new test suites are reachable only through the existing `test` step (`bun test` discovery), i.e. no new manifest script was added to run them separately.
7. Assert the workflow path does not appear in `scripts.check` or in any package manifest script.

**Expected Outcome**:

- `pnpm check` keeps its five-step order plus the three scans, gains nothing milestone-specific, and has no path that can reach the network; "0 tracker calls" is established by construction and by the import scan (see §8.2).

#### TC-QG-001 - Gate green at delivered HEAD; conventional subjects; ≤100-char body/footer lines

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, AC-NFR5-1, AC-NFR2-1, C-11, DEC-12
**Test Type(s)**: Evidence (gate + commit range)
**Automation Level**: Automated (evidence run)
**Target Layer / Location**: repository root — `TMPDIR=$PWD/tmp/tmpdir pnpm check` and `./scripts/lint-commit-range.sh --base main-tools`
**Tags**: @gate, @evidence, @commit

**Preconditions**:

- All implementation phases complete at the delivered HEAD; branch `feat/GH-313/milestone-first-planning` cut from `main-tools`.

**Steps**:

1. Run `TMPDIR=$PWD/tmp/tmpdir pnpm check`; assert exit 0 and record the run (all 8 chained steps).
2. Run `./scripts/lint-commit-range.sh --base main-tools`; assert `PASS` (commit subjects conventional; body/footer lines ≤100 characters per commitlint configuration).
3. Assert the working tree is clean and the branch is ahead of `main-tools` only by this change's commits (no unrelated file).
4. Record both verdicts in §10 and as pm-notes `notes:` entries; a `FAIL` is remediated in the mode the gate names and re-run — never recorded as a pass.

**Expected Outcome**:

- The gate battery is green at the delivered HEAD with a lawful commit history before the PR opens.

#### TC-PLAN-001 - M2-S20 block exists in story shape with its ticket line

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F6-2, DM-4, DEC-10
**Test Type(s)**: Contract (markdown section parse)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/planning-truth.test.ts` (To Implement)
**Tags**: @bun, @planning, @contract

**Preconditions**:

- `doc/planning/oss-tooling/backlog.md` M2 section holds `### M2-S<n> <title>` blocks.

**Steps**:

1. Parse the M2 section; assert a block with heading `### M2-S20 <title>` exists exactly once and is the last M2 block (append-only repair).
2. Assert the block carries the repository's story shape: a Goal statement, a Tasks list, an AC list with machine-checkable criteria, a `Depends on:` line (including the literal `none` when there is no dependency), and exactly one `- Ticket: GH-313 (milestone M2)` line directly under the heading block.
3. Assert the block names the milestone `M2` in the ticket line and its story code root (`M2-`) matches.
4. Assert the M2 story-code set is unchanged except for the added `M2-S20` (set comparison against the delivered baseline set, derived by parsing the same file for headings; the assertion is "no code removed, exactly one added"), and that heading order outside the append is not asserted here — reordering is a diff property (TC-SCOPE-001).
5. Assert no other section's heading count changed: M0/M1/M3/M4 heading sets are parsed and compared to a committed expectation fixture (`tests/fixtures/milestone-attachment/planning/section-headings.json`) that is regenerated deliberately when a story is added.

**Expected Outcome**:

- M2-S20 exists in the exact shape every other story uses, with its ticket and milestone; no neighbouring story disappears.

**Notes / Clarifications**:

- Step 4/5's expectation fixture is the tree-invariant way to assert "nothing was reordered/renumbered" without asserting a base-branch diff (testing strategy). The fixture is updated deliberately when a new story is authored.

#### TC-PLAN-002 - Every M2 block carries exactly one valid ticket line; no other section leaks in

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-4
**Test Type(s)**: Contract (per-block completeness + format)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/planning-truth.test.ts` (To Implement)
**Tags**: @bun, @planning, @contract

**Preconditions**:

- TC-PLAN-001's block exists; the twelve backfilled ticket lines are delivered.

**Steps**:

1. For every `### M2-S<n>` block, assert exactly one `- Ticket: GH-<digits> (milestone M2)` line; assert the block count equals the ticket-line count (no block without a line, no orphan line).
2. Assert every ticket number is a positive integer and unique across the M2 section (two stories cannot claim one ticket).
3. Assert every ticket line sits inside its own block (not at the section head or under another heading) by slicing each block between headings.
4. Assert format exactness (`- Ticket: GH-313 (milestone M2)` shape): the literal `- Ticket: `, `GH-`, digits, ` (milestone M2)`. A malformed line fails.
5. Assert the M0/M1 sections retain their delivered ticket-line coverage (count of blocks equals count of ticket lines in each section) — the repair did not disturb the closed milestones, and their lines still parse (golden counts are derived, never hardcoded).
6. Assert the twelve backfilled story codes (`M2-S2, S3, S4, S5, S6, S7, S8, S10, S14, S16, S17, S19` per spec §2.1) now each carry a line, and that no M2 story without a ticket carries a fabricated line (the fabrication question is closed by TC-EVID-001's tracker comparison; here the assertion is that every line's milestone suffix is `M2` and its ticket is unique).

**Expected Outcome**:

- 19/19 coverage with no malformed, duplicated, or fabricated-shaped line; the offline half of AC-F5-2 is complete and the tracker half is delegated to TC-EVID-001.

**Notes / Clarifications**:

- Counts are derived from the file (blocks vs lines), not hardcoded to 19, so the assertion stays true when M2-S21 is authored (testing-strategy "meaning, not a growing count").

#### TC-PLAN-003 - Ranking: story-code set equality, contiguous unique numbering, M2 in backlog order

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DEC-9
**Test Type(s)**: Contract (two-file data comparison)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/planning-truth.test.ts` (To Implement)
**Tags**: @bun, @planning, @contract

**Preconditions**:

- `backlog-ranking.md` `## Order` table with `| # | Story | Depends on | Why here |` rows.

**Steps**:

1. Parse the backlog's story codes (`M\d+-S\d+`) from all `###` story headings; parse the ranking's story codes from the `Story` column of the order table (the code is the leading token; a ticket reference in parentheses is optional).
2. Assert set equality: every backlog story code appears exactly once in the ranking and no ranking code is absent from the backlog (both directions; a code appearing twice fails).
3. Assert the `#` column is exactly the contiguous sequence `1..N` with no gap, no repetition, and no reorder anomaly (sort numerically and compare to the index sequence).
4. Assert the M2 subsequence of the ranking equals the backlog's M2 section order exactly (extract M2 codes in file order from both; compare arrays, not sets).
5. Assert the twelve repaired rows plus M2-S20 are present, and that each M2 row's `Story` cell retains the story title.
6. Assert the file's stated invariant sentence is still present and still claims backlog-order ("stories from backlog.md top to bottom" in intent) — the repair restores the claim rather than editing it away.

**Expected Outcome**:

- The suggested-order file is a complete, contiguous, backlog-ordered mirror; DEC-9's repair is verified as data, not by eyeballing a diff.

#### TC-PLAN-004 - M2 pack carries the M2-S20 row, every cited seed heading exists, range covers S20

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-4, F-1, DEC-10
**Test Type(s)**: Contract (two-file reference resolution)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/planning-truth.test.ts` (To Implement)
**Tags**: @bun, @planning, @docs

**Preconditions**:

- `doc/planning/oss-tooling/milestones/m2/README.md` story-to-artifact table; `.../m2/test-scenarios.md` seed headings.

**Steps**:

1. Parse the pack's story-to-artifact table; assert exactly one row whose first cell story code is `M2-S20`.
2. Assert the row's scenario-seed cell cites at least two `SC-M2-S20-<nn>` identifiers (pack convention: at least two seeds per story).
3. Resolve **every** seed cited by **every** row against `test-scenarios.md` `### SC-...` headings; assert every cited seed exists and every defined seed is cited (no dangling citation, no orphan seed). This generalizes beyond S20 so a future row cannot cite a non-existent seed.
4. Assert `test-scenarios.md` has a `## M2-S20 <title>` section containing the seeds cited, and that the file's introductory range statement covers S2 through S20 (parse the stated range and assert it includes S20 — a range that still says "S2 through S19" fails).
5. Assert the pack index's pack-contents line describing the seed file covers S20 as well (the range mention appears in `m2/README.md`'s pack-contents table).
6. Assert the M2-S20 seeds are behaviourally the five inherited seeds (`SC-M2-S20-01…05`) or a superset, and that each seed names an observable assertion.

**Expected Outcome**:

- The row does not cite seeds that do not exist and the seed file's declared range is true; the pack remains a reviewable blueprint of the new story.

#### TC-PLAN-005 - Status snapshot carries the delivery addendum in the established form

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-5
**Test Type(s)**: Contract (section heading + required tokens)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/planning-truth.test.ts` (To Implement)
**Tags**: @bun, @planning, @docs

**Preconditions**:

- `doc/planning/oss-tooling/status.md` already carries addenda in the form `## M2 delivery snapshot addendum (YYYY-MM-DD): M2-S<n> delivered by GH-<n>` (GH-294 and GH-309 precedents).

**Steps**:

1. Find all addendum headings; assert exactly one whose heading names `M2-S20` and `GH-313`.
2. Assert the heading matches the established date form and is appended at the end of the file (no insertion into history sections).
3. Assert the section body names the delivered capability in the established prose shape and contains the sentence stating M2 has not exited, plus the remaining-stories statement.
4. Assert the file's existing history pointers and prior addenda are unchanged (parse the ordered list of addendum headings and compare to the delivered precedence plus the new one at the tail — a tree invariant, not a diff).
5. Assert the addendum does not claim milestone exit or owner acceptance.

**Expected Outcome**:

- The status snapshot records this delivery in the same form as its predecessors, without rewriting history or claiming exit.

#### TC-EVID-001 - Read-only per-milestone declared-vs-attached evidence with empty gap list and reported debt count

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F5-2, DM-5, RSK-10, DoD-14
**Test Type(s)**: Evidence (read-only tracker reads, manually run, recorded)
**Automation Level**: Semi-automated (declared set parsed locally; attachment read live)
**Target Layer / Location**: change folder + pm-notes — evidence record; read-only `gh api` paged reads (no write verb anywhere)
**Tags**: @evidence, @tracker, @read-only, @governance

**Preconditions**:

- Planning-truth phase delivered (the declared set is the backlog's M0/M1/M2 ticket lines).
- A token with read access; no write scope is used.

**Steps**:

1. Derive the **declared** set locally: parse `backlog.md` M0, M1, and M2 sections and collect every `- Ticket: GH-<n> (milestone M<n>)` line per milestone. Record each milestone's declared count.
2. Read the **actual** attachment per declared issue with read-only, paged calls, e.g. `gh api --paginate "repos/<owner>/<repo>/milestones/<number>/issues?state=all&per_page=100"` (state `all`, so closed tickets are included) and/or `gh api repos/<owner>/<repo>/issues/<n> --jq '.milestone.title'` per issue. Record the exact commands in the evidence record so a reviewer can confirm only GET requests were issued.
3. Compare per milestone: every declared ticket is attached to the milestone its block names; the attached count equals the declared count; the set difference (declared minus attached) is the gap list and must be empty when green.
4. Assert the title-prefix match: the milestone title begins `M<n>:` and every attached ticket's originating story code begins `M<n>-` (report any mismatch as a named row).
5. Read the deliberately unattached population and report it **by count, never reconciled**: open `change` issues with no milestone (minus exempted), recorded as a number with the query used (e.g. `gh issue list --state open --label change --search "no:milestone"`), alongside the planning-time baseline of 94 total / 53 open for context.
6. Write the evidence record with, per milestone, declared count, attached count, prefix-match verdict, and gap list; plus the unattached count. Record it in `chg-GH-313-pm-notes.yaml` as a `notes:` entry (type `evidence`) and mirror it into §10; if the plan declares a dedicated change-folder artifact (e.g. `milestone-evidence.md`), the record lives there and the pm-notes entry points at it.
7. Assert zero tracker writes occurred: the command list contains no `POST`/`PATCH`/`PUT`/`DELETE`, no `-X`, no `--method` write verb, and no label/milestone/issue mutation command. Any attachment needed to reach zero is a separate, human-confirmed PM action, not part of this test.

**Expected Outcome**:

- "Every ticket declared by M0/M1/M2 is attached, closed included" is a recorded, reproducible fact with an empty-or-reported gap list; the historical debt is reported as a count and left untouched.

**Notes / Clarifications**:

- This is verification evidence, not a permanent suite: the tracker is live data and cannot enter an offline deterministic test. Re-running the same procedure at M2 exit reproduces the claim (§22). A non-empty gap list blocks the DoD row rather than being waived (RSK-10, §17.1).

#### TC-EVID-002 - GH-313 attached to M2; M2-S20 names it; three-surface title equality

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, AC-F4-1, DM-1, DM-3, DM-4
**Test Type(s)**: Evidence (read-only tracker read + cross-surface comparison)
**Automation Level**: Semi-automated
**Target Layer / Location**: this change's tracker record + spec + pm-notes + backlog; read-only `gh api`/`gh issue view`
**Tags**: @evidence, @tracker, @read-only

**Preconditions**:

- GH-313's artifact phases are complete; the backlog M2-S20 block names it (TC-PLAN-001).

**Steps**:

1. Read GH-313 (GET only): assert its milestone title is the M2 milestone title and that the title begins `M2:`.
2. Assert the read title equals the spec's `change.milestone` and the pm-notes `milestone` (the local comparison is TC-TPL-003; this step closes the third surface).
3. Assert the backlog M2-S20 block's `- Ticket: GH-313 (milestone M2)` line names the same ticket and milestone prefix.
4. Assert the issue state is `OPEN` at the delivery gate (delivery stops at PR creation; closing is a later human/merge action) and record the state rather than asserting a transition.
5. Record the three values and the query in §10/pm-notes; assert no write occurred (GET-only command list).

**Expected Outcome**:

- The join key is consistent across tracker, spec, pm-notes, and backlog; the change's own ticket is inside its milestone.

#### TC-SCOPE-001 - Changed-scope conformance: no tickets, no milestones, no mass edits, no new install-set surface, no lifecycle change, no pre-flipped current truth

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-2, AC-F1-1, AC-NFR4-1, NG-1…NG-10, C-6, C-10, DEC-12
**Test Type(s)**: Manual (review-time changed-file inspection)
**Automation Level**: Manual
**Target Layer / Location**: PR changed-file list against `main-tools`, at each delivery phase's gate and at `review_fix`
**Tags**: @manual, @review, @governance

**Preconditions**:

- The change branch's commits are staged per phase.

**Steps**:

1. List the change's files (`git diff --name-only <base>...HEAD`) at the delivered HEAD.
2. Assert the delivered file set is inside spec §7.1 / Appendix B: the guide, index, one template, three prompts, the plugin output, `.ai/agent/pm-instructions.md`, the workflow, the evaluation core + its suites + fixtures, the four planning files, and the change artifacts. Any other path requires a recorded reason in the plan.
3. Assert the forbidden areas are untouched: no `packages/**` change; no `.opencode/command/**` change; no install-set or shell-script change (`scripts/install.sh`, `scripts/uninstall.sh`); no phase-set or lifecycle-gate change; no `gh`/`glab` write automation added; no `doc/spec/**` behavioural flip (phase 7 owns those); no roadmap `MS-<NNNN>` identifiers or allocation matrix (C-10).
4. Assert no other template gained or lost a field (AC-F4-2), and that the five excluded templates are byte-unchanged in their front matter.
5. Assert no ticket or milestone creation and no mass edit occurred: the tracker's issue/milestone record for this change shows only the change's own lifecycle reads/writes; the 94 pre-existing unattached issues keep their labels and comments (spot-check that no historical issue has `needs-milestone`; report the count of pre-existing flags found, which must be 0).
6. Assert no pre-flipped current-truth prose: any `doc/spec/**` or guide edit outside Appendix B rows 21–28 is a violation; a missing phase-7 reconciliation is not a violation of this row.
7. Record the verdict in §10 and pm-notes; a violation reopens the owning phase (DoD framing).

**Expected Outcome**:

- The delivered diff stays inside the declared scope, and the exclusions of §7.2 hold as observable facts rather than good intentions.

**Notes / Clarifications**:

- Review-time by design (testing strategy forbids permanent suites asserting a moving-base diff). This TC is also AC-F5-1's "no other block reordered" verification and AC-F4-2's "unchanged templates" verification.
- Appendix B row 29's "`scripts/**` UNCHANGED" must be read as "no distributable/install-set script changed"; the new evaluation core is row 11's declared new surface. The plan pins the wording (TP-Q1). A reviewer who reads row 29 literally would reject the core — the scope review must use the row 11 reading.

## 6. Environments and Test Data

- **Environment:** local development only (`pnpm` + Bun workspace, Bun 1.4.4 per `.bun-version`); no staging, no live tracker, no network. The gate convention is `TMPDIR=$PWD/tmp/tmpdir pnpm check`; suites isolate any temp output under that base or `mkdtemp` and never read `$HOME`.
- **Test data — issue-event payloads** (committed fixtures, never named `*.test.ts`), proposed home `tests/fixtures/milestone-attachment/events/`:

  | Fixture | Shape | Purpose |
  |---|---|---|
  | `issue-opened--change--no-milestone.json` | `action: opened`, issue `state: open`, `labels: ["change"]`, `milestone: null` | TC-CHK-002/003 happy flag path |
  | `issue-opened--change--with-milestone.json` | same + `milestone: { number: 3, title: "M2: …" }` | compliant contrast (zero writes) |
  | `issue-opened--change--exempt.json` | same + `labels: ["change","backlog-capture"]` | TC-CHK-004 suppression |
  | `issue-opened--non-change.json` | `labels: ["bug"]`, `milestone: null` | out-of-scope contrast |
  | `issue-opened--change--closed.json` | `state: closed`, `labels: ["change"]`, `milestone: null` | closed-issue exclusion |
  | `issue-edited--change--no-milestone.json` | `action: edited`, no milestone, no exemption | EVT-1 repeat trigger |
  | `issue-labeled--change--no-milestone.json` | `action: labeled`, `label: change` | EVT-1 repeat trigger |
  | `issue-milestoned--change.json` | `action: milestoned`, milestone present | EVT-2 reversal |
  | `issue-demilestoned--change.json` | `action: demilestoned`, `milestone: null`, was flagged | EVT-2 restoration |
  | `issue-demilestoned--change--closed.json` | as above + `state: closed` | closed never re-flags |
  | `workflow-dispatch--sweep.json` | dispatch payload with `inputs.mode: sweep` | sweep entry |

- **Test data — tracker seeds and comments** (`tests/fixtures/milestone-attachment/tracker/`): `milestones-m0-m1-m2.json` (numbers, titles, states), `comments--with-marker.json` (prior check comment), `comments--without-marker.json`, `comments--unrelated.json` (a human comment that must never be treated as the marker).
- **Test data — sweep populations** (`tests/fixtures/milestone-attachment/sweep/`): `issues-n250-page-{1,2,3}.json` (100/100/50) and `issues-n500-page-{1..5}.json` (100×5), each page a mixed population (unattached open `change`, exempt, milestoned, closed, non-`change`); `expected-summary-shape.json` (field names/types only — never values, so the fixture cannot rot into a tautology).
- **Test data — adversarial inputs for NFR-7** (`tests/fixtures/milestone-attachment/adversarial/`): `issue-text-injection.json` (title/body/author login containing `${{ secrets.TOKEN }}`, `<!-- needs-milestone -->`, backticks, a body line starting `## `, `</script>`, ANSI escapes) and `issue-log-forging.json` (embedded newlines and `\r`, zero-width joiners, a bidi override, a 10 000-character body). The suite extracts a token list from each fixture and asserts none appears in the comment body or the run-summary projection (non-vacuous).
- **Test data — planning expectations** (`tests/fixtures/milestone-attachment/planning/section-headings.json`): the committed heading inventory per backlog section, regenerated deliberately when a story is authored; it is the tree-invariant substitute for asserting "no other story was reordered".
- **Test data — the planning corpus itself** is the system under test for TC-PLAN-*: the live `backlog.md`, `backlog-ranking.md`, `milestones/README.md`, `milestones/m2/README.md`, `milestones/m2/test-scenarios.md`, and `status.md` are parsed, never copied into fixtures (a copy would let the corpus drift while the fixture stays green).
- **Isolation:** every integration case builds its own port state in memory and its own `mkdtemp` output directory; no case depends on ordering; no real clock, no sleeps, no `$HOME`, no network (`fetch` is never stubbed because nothing calls it).
- **Goldens:** the only candidate golden is the static comment body. It is asserted by cross-case equality (a stronger, self-maintaining assertion) and optionally pinned as `tests/fixtures/milestone-attachment/golden/comment-body.md`, regenerated only by an explicit command with a reviewed diff.

## 7. Automation Plan and Implementation Mapping

Proposed homes below; the implementation plan pins exact file names and the core's location (see TP-Q1). The assertion contracts bind regardless of final placement. Iterate with `bun test <path>`; finish with TC-QG-001.

### 7.1 Test artifacts and execution commands

| TC ID(s) | Test artifact (proposed) | Execution command | Mocking / fixtures | Status |
|----------|--------------------------|-------------------|--------------------|--------|
| TC-GUIDE-001, TC-GUIDE-002, TC-GUIDE-003, TC-GUIDE-004 | `tests/checks/milestone-guide.test.ts` | `bun test tests/checks/milestone-guide.test.ts` | None — file and table parsing (`yaml`, markdown slices) | To Implement |
| TC-GUIDE-005 | Guard scripts, repository root | `bash scripts/.tests/test-doc-distribution.sh && bash scripts/.tests/test-doc-distribution-modes.sh` | None; sandbox install run inside the guard | Existing — run, no new code |
| TC-TPL-001, TC-TPL-002, TC-TPL-003, TC-TPL-004 | `tests/checks/milestone-artifacts.test.ts` | `bun test tests/checks/milestone-artifacts.test.ts` | `yaml` parse of template/spec/pm-notes front matter | To Implement |
| TC-PROMPT-001, TC-PROMPT-002, TC-PROMPT-003, TC-PROMPT-004, TC-PLUGIN-001 | `tests/checks/milestone-prompts.test.ts` + `scripts/build-claude-plugin.sh` | `bun test tests/checks/milestone-prompts.test.ts`; `./scripts/build-claude-plugin.sh && git status --porcelain .ados-claude/`; `bun run scripts/checks/prompt-conformance.ts` | None; generated files read as data | To Implement + evidence run |
| TC-CHK-001, TC-CHK-006 | `tests/checks/milestone-attachment.test.ts` | `bun test tests/checks/milestone-attachment.test.ts` | Pure core; adversarial fixtures; no port | To Implement |
| TC-CHK-002, TC-CHK-003, TC-CHK-004, TC-CHK-005 | `tests/checks/milestone-attachment-integration.test.ts` | `bun test tests/checks/milestone-attachment-integration.test.ts` | Injected in-memory tracker port; event fixtures | To Implement |
| TC-SWEEP-001, TC-SWEEP-002 | `tests/checks/milestone-sweep.test.ts` | `bun test tests/checks/milestone-sweep.test.ts` | Paged fixtures; temp output directory; call-count recorder | To Implement |
| TC-WF-001, TC-WF-002, TC-WF-003 | `tests/checks/milestone-workflow.test.ts` | `bun test tests/checks/milestone-workflow.test.ts` | `yaml` parse + mutated temp copies (pattern: `tests/checks/ci-checks.test.ts`) | To Implement |
| TC-GATE-001 | `tests/checks/milestone-gate.test.ts` | `bun test tests/checks/milestone-gate.test.ts` | Manifest parse + source import scan | To Implement |
| TC-PLAN-001, TC-PLAN-002, TC-PLAN-003, TC-PLAN-004, TC-PLAN-005 | `tests/checks/planning-truth.test.ts` | `bun test tests/checks/planning-truth.test.ts` | Live planning files parsed as data; heading expectation fixture | To Implement |
| TC-QG-001 | Repository root | `TMPDIR=$PWD/tmp/tmpdir pnpm check`; `./scripts/lint-commit-range.sh --base main-tools` | None | Existing gate — run, no new code |
| TC-EVID-001, TC-EVID-002 | Tracker reads (GET only) + evidence record | `gh api --paginate …` (read-only; exact commands recorded in the evidence note) | Live tracker, read-only, manual dispatch only | Evidence runs (PM-owned) |
| TC-SCOPE-001 | Review checklist | `git diff --name-only <base>...HEAD` at each delivery phase gate | None | Manual Only |

### 7.2 Gate battery per level and expected evidence

| Level | Command | Expected evidence |
|---|---|---|
| Unit | `bun test tests/checks/milestone-attachment.test.ts` | Green; decision table rows and adversarial cases enumerated in the test output |
| Contract/static | `bun test tests/checks/milestone-guide.test.ts tests/checks/milestone-artifacts.test.ts tests/checks/milestone-prompts.test.ts tests/checks/milestone-workflow.test.ts tests/checks/milestone-gate.test.ts tests/checks/planning-truth.test.ts` | Green; each negative case fails on a mutated temporary copy (TC-WF-003 pattern) |
| Integration | `bun test tests/checks/milestone-attachment-integration.test.ts tests/checks/milestone-sweep.test.ts` | Green; recorded call lists prove zero unexpected writes and the read bound |
| Distribution | `bash scripts/.tests/test-doc-distribution.sh` + `…-modes.sh` | Exit 0 both; install set includes the guide; five failure modes still fire |
| Plugin freshness | `./scripts/build-claude-plugin.sh`; `git status --porcelain .ados-claude/` | No output from `git status`; CI `verify-claude-build` green |
| Prompt/help conformance | `bun run scripts/checks/prompt-conformance.ts`; `bun run scripts/checks/help-guide-coverage.ts` | Exit 0 both |
| Commit history | `./scripts/lint-commit-range.sh --base main-tools` | `PASS` |
| Aggregate | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Exit 0; the eight chained steps named |
| Read-only tracker evidence | Paged GET reads per TC-EVID-001/002; manual sweep dispatch | Recorded per-milestone counts, empty-or-reported gap list, unattached count, zero-write command list |

### 7.3 How the plan's phases consume this test plan

| Likely plan phase (spec §18 order) | Test groups consumed | Exit evidence for that phase |
|---|---|---|
| Guide and docs | TC-GUIDE-001…005 (+ TC-SCOPE-001 partial) | `bun test tests/checks/milestone-guide.test.ts`; both distribution guard scripts; index-link assertion |
| Templates | TC-TPL-001…004 (+ TC-SCOPE-001 for other-template absence) | `bun test tests/checks/milestone-artifacts.test.ts` |
| Prompts and generated plugin | TC-PROMPT-001…004, TC-PLUGIN-001 | `bun test tests/checks/milestone-prompts.test.ts`; `build-claude-plugin.sh` + clean `git status`; `check:prompt`/`check:help` |
| Check core, tests, workflow | TC-CHK-001…006, TC-SWEEP-001…002, TC-WF-001…003, TC-GATE-001 | The three check suites green; `ci-supply-chain`/`ci-bindingness`/`ci-topology` green; gate-chain assertion green |
| Planning truth | TC-PLAN-001…005 (+ TC-SCOPE-001 for reorder absence) | `bun test tests/checks/planning-truth.test.ts` |
| Tracker evidence | TC-EVID-001…002 | Recorded evidence note + §10 rows |
| Final delivery / `quality_gates` | TC-QG-001 (+ all of the above re-run) | `pnpm check` green, `lint-commit-range.sh` PASS, pm-notes entries |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **Fixture drift masquerading as coverage (RSK-4).** GitHub event payloads change shape; a hand-written fixture can encode a shape the workflow never receives. Mitigation: fixtures are copied from real event payloads at authoring, the core takes a normalized input (not the raw payload), and the adapter normalizes — so a payload-shape change fails loudly at the adapter, not silently in the core.
- **Tautological data assertions.** Deriving the expected ticket-line count from the same file it asserts would prove nothing. Mitigation: assertions compare two independent surfaces (blocks vs lines, backlog vs ranking, pack citations vs seed headings) and never hardcode the growing counts (19/77 are evidence metrics, not assertions).
- **Golden over-pinning of the comment body.** A committed golden could be "refreshed" into legitimizing an interpolated body. Mitigation: the primary assertion is cross-case byte equality plus a token-leakage list; the golden is optional and regenerated only with a reviewed diff.
- **Vacuity of workflow security assertions (TP-Q2).** The existing scanners read only `ci.yml` and only `ts-` jobs. Mitigation: TC-WF-003's mutation matrix, including the meta-assertion that the new workflow path is covered.
- **Evidence latency and human dependency (RSK-10).** TC-EVID-001 depends on live reads and, in principle, on a human-confirmed attachment write if a gap appears. Mitigation: the evidence is produced at the end of delivery, the gap list is a blocking DoD row, and the procedure is reproducible at M2 exit.
- **Network creep into the gate.** A future contributor may wire the sweep into `pnpm check` for convenience. Mitigation: TC-GATE-001 asserts the chain, the absence of milestone tokens, and the absence of network-capable imports; the assertion names the offending field.
- **Prompt edits weakening existing rules (C-8).** An edit that rewrites the no-autonomous-ticket or untrusted-comment rule while adding the milestone rule would pass a naive "milestone present" check. Mitigation: TC-PROMPT-001 step 6 asserts the preserved rules explicitly, and TC-PLUGIN-001 re-runs prompt conformance.

### 8.2 Assumptions

- The delivered machinery named in §2 is stable through this change: the marker-derived install set, the header script's output shape, the plugin build script, the `NAMED_CHECKS` order, and the `tests/checks` + `bun test` discovery pattern.
- GitHub Issues supplies `issues` events including `milestoned`/`demilestoned`, and an `issues: write` token can add/remove a label and create a comment without broader scopes.
- The evaluation core and its runner are implemented in a location the `pnpm test` discovery already reaches (`tests/**/*.test.ts` imports the module directly); no build step is needed for the core, exactly as `scripts/checks/*.ts` are consumed today.
- "Zero tracker calls inside the gate" is established by construction (no network-capable import on any chain-reachable path) plus the manifest and import assertions — the plan does not add packet-level interception, and the test states that limit honestly.
- The planning corpus is repaired before the data assertions run (phase order: planning truth before the final gate), so the assertions are green at the delivered HEAD and remain true afterwards.
- The evidence runs use a read-only token; no test, fixture, or suite performs a tracker write.

### 8.3 Open Questions

| ID | Question | Status | Owner |
|----|----------|--------|-------|
| TP-Q1 | Where does the evaluation core live, and how does that reconcile with Appendix B row 29's "`scripts/**` UNCHANGED"? | **Open — the plan must pin.** This plan proposes `scripts/checks/milestone-attachment.ts` (+ runner) and reads row 29 as "no distributable/install-set script changed". If the plan instead places the core outside `scripts/**` (e.g. `.github/milestone-check/`), the test imports move and TC-SCOPE-001's scope review uses that path. Either choice keeps every assertion contract | Plan-writer |
| TP-Q2 | Do the existing invariant scanners gain the new workflow file, or does the dedicated suite own it? | **Open — the plan must pin.** Today `ci-supply-chain.ts` inspects `.github/workflows/ci.yml` and only `ts-` jobs; `ci-bindingness.ts` inspects `ci.yml` only. This plan requires the properties (TC-WF-002) and a mutation proof (TC-WF-003) either way; if the scanners are extended, their own mutation tests in `tests/checks/ci-checks.test.ts` extend too, and `ci-topology.ts`'s job inventory gains the new job. | Plan-writer |
| TP-Q3 | Does "no hand-written license header" (AC-F1-1/NFR-4) mean the header is absent, or that it is script-generated? | **Open — needs a one-line spec clarification.** The repository adds headers to `doc/guides/` by script, so the delivered guide *will* carry one. This plan asserts "byte-equivalent to script output, no hand-shaped variant". Smallest clarification: restate the AC clause as "carries only the license header generated by `scripts/add-header-location.sh`, never a hand-written one". | Spec-writer / owner |
| TP-Q4 | Is "0 duplicate label applications" (NFR-1, AC-NFR1-1) observable at the tracker or at the check? | **Open — needs a one-line spec clarification.** Applying an existing label is server-side idempotent, so the only falsifiable claim is "the check issues no add-label call when the flag is already present". Smallest clarification: add "(observable as zero add-label actions issued by the check on repeat evaluation)". This plan asserts the action-layer form. | Spec-writer / owner |
| TP-Q5 | Where is the tracker evidence record stored (pm-notes only, or a dedicated change artifact)? | **Open — the plan may pin.** §17.1 DoD-14 says "Evidence record" without a path. This plan defaults to a pm-notes `notes:` entry of type `evidence`, mirrored in §10, and accepts a change-folder file if the plan declares one. | Plan-writer |
| TP-Q6 | Is "each topic exactly once" (AC-F1-2) mechanically decidable? | **Resolved here as semi-automated.** Heading/keyword counts are asserted; substantive non-duplication is a recorded content review (TC-GUIDE-002 step 7). No spec change requested; the limitation is stated so the DoR gate does not read it as a gap. | Test plan |

**Reconciliation rule:** when the implementation plan pins TP-Q1/TP-Q2/TP-Q5, names different suite paths, or the spec is clarified for TP-Q3/TP-Q4, this test plan MUST be revised (new revision-log row; affected TCs updated) before the DoR gate passes — never left to drift silently.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | test-plan-writer (DeepSeek V4.1 Flash) | Initial test plan: 35 TCs in 12 families covering all 30 §17 ACs (AC-F1-1…AC-NFR7-1), DoD-1…DoD-21 (DoD-19 roll-up, DoD-21 lifecycle evidence), EVT-1…4, DM-1…5, NFR-1…7, the five inherited seeds `SC-M2-S20-01…05` by name, Appendix E constraints C-1…C-12, a fixtures catalog (11 event payloads, tracker seeds, 250/500-issue sweep populations, two adversarial NFR-7 inputs, planning heading expectations), data assertions over backlog/ranking/pack/status, and the read-only M0/M1/M2 evidence procedure. Six test-plan questions raised (TP-Q1 core location vs Appendix B row 29; TP-Q2 workflow coverage by the invariant battery; TP-Q3 header wording; TP-Q4 duplicate-label observability; TP-Q5 evidence home; TP-Q6 "exactly once" decidability — the last resolved here) |

**Reconciliation rule:** see §8.3.

## 10. Test Execution Log

Populated during delivery (phases 6/9/10). Evidence runs and review-time items are logged here and mirrored into phase pm-notes `notes:` entries per DoD conventions.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | No executions yet; plan authored at phase 3 (`test_planning`). All 35 TCs are To Implement or evidence/manual by design. |
