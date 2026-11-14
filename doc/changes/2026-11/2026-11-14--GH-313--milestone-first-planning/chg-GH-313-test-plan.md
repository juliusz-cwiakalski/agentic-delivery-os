---
id: chg-GH-313-test-plan
status: Updated
created: 2026-11-14
last_updated: 2026-11-14
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, governance, planning, agents, enforcement]
version_impact: minor
summary: "Verification strategy for M2-S20 milestone-first planning and delivery: the redistributable milestone-management guide and its nine topics, the pack-conventions pointer, PDR-0005, the required change.milestone artifact field and its single-template scope, the creation/intake rules in the tracker instructions and three prompts with regenerated plugin output, the offline contract-v1 decision-table evaluation core and its thin issue-event workflow (ordered first-match rules, manual-removal respect, exemption precedence, reversal, fixed comment, job summary, least privilege, SHA pins), the zero-write advisory sweep with its read-count bound, the unchanged offline aggregate gate, the planning-truth repair of backlog/ranking/pack/status, and the read-only M0/M1/M2 tracker evidence."
links:
  change_spec: ./chg-GH-313-spec.md
  implementation_plan: ./chg-GH-313-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M2-S20: Milestone-first planning and delivery (M2)

## 1. Scope and Objectives

This change is a **governance-and-automation change with almost no product code**: one new redistributable guide plus a pointer in the milestone pack conventions; three prompt edits, one project tracker-instruction file, and one regenerated Claude Code plugin; one new required front-matter field on exactly one template; one pure, offline-tested evaluation core behind a thin GitHub issue-event workflow; and a repair of the planning corpus so the milestone's own record mirrors the tracker.

The behaviours that must be protected, in descending risk order, are: **the offline determinism of `pnpm check`** (spec C-1/NFR-2/DEC-2 — any tracker call, bypass construct, or added step inside the gate is a release-blocking regression); **flag precision and idempotency** (NFR-1 — ≤1 comment ever per issue, 0 `addFlag` writes when the flag is already present, 0 flags on compliant or exempt issues, and a manual flag removal is never silently reversed); **the closed write surface** (PDR C-2 and spec C-4 — the vocabulary is exactly `addFlag | removeFlag | postMarkerComment | writeJobSummary`, never a state, assignee, milestone, or other-label write, and the flag is always reversible); **comment safety by construction** (NFR-7 — a static body with zero issue-authored interpolation); **workflow least privilege and supply-chain hygiene** (NFR-3 — `issues: write` + `contents: read`, 40-hex SHA pins, no `pull_request_target`, no secret, no bypass construct); **historical-debt non-mutation** (spec C-2 and PDR C-3 — the sweep performs exactly 0 tracker writes and historical issues are never edited); and **planning-corpus truth** (F-5/F-6 — the corpus is a mirror, and "every planned ticket was attached" is a recorded fact, not an assumption).

Constraint citations in this plan are namespaced: **spec C-n** refers to the spec's Appendix E register (C-1…C-12) and **PDR C-n** to PDR-0005's hard constraints (C-1…C-6). They are different registers and are cited explicitly wherever a test asserts one.

The motivating regressions are: an enforcement surface that quietly enters the deterministic gate; a flag that comments twice (or on exempt tickets) and destroys its own credibility; a check whose write surface grows past the closed four-verb vocabulary; a check that reads an edit as a licence to re-apply a flag a human removed; a pipeline that interpolates an issue title into a comment or a log and turns a governance check into an injection surface; a bootstrapped or edited prompt path that forgets the milestone rule while the guide claims it; and a guide/backlog/ranking that drift from the tracker again immediately after being repaired.

### 1.1 In Scope

- **Guide and register (F-1, AC-F1-1…4):** guide existence, `ados_distribution: redistributable`, index link, exactly one script-generated header byte-identical to `scripts/add-header-location.sh` output, derived-install-set membership and the distribution drift guard; the nine lifecycle topics documented once; the pack-conventions pointer with no restated procedure; PDR-0005 in the decision register and referenced from guide and change.
- **Artifact field (F-4, AC-F4-1…2):** the required `change.milestone` field and its resolution rule in the change-specification template and the `@spec-writer` front-matter rules; this change's own spec/pm-notes value equality; exactly one template carrying the field with the five other templates unchanged.
- **Creation and intake (F-2, AC-F2-1…3):** the milestone argument, attach-from-existing resolution rule, and no-autonomous-creation rule in `.ai/agent/pm-instructions.md` and `.opencode/agent/pm.md`; preserved existing prohibitions; intake verification with a pm-notes record and a human question on an unattached ticket; the milestone section in the `@bootstrapper` guidance that generates project tracker instructions; regenerated plugin output and freshness.
- **Enforcement core and workflow (F-3, AC-F3-1…7, AC-NFR1-1, AC-NFR3-1, AC-NFR7-1):** the canonical contract-v1 decision table with ordered, first-match rules (exemption outranks milestone and flag; a manual flag removal is respected on every action except `opened` and `demilestoned`-with-marker); flag, idempotency, exemption, reversal on attach/detach, and closed-write-surface assertions driven through a fake tracker port; adversarial comment safety; the sweep's advisory reporting, zero tracker writes, single local artifact, exit-code discipline and read bound; the workflow's event set, job summary, job-scoped permissions, SHA pins, secret absence, and bypass-construct absence — plus a mutation proof that each static assertion actually fires.
- **Aggregate gate (AC-NFR2-1, AC-NFR5-1):** the `check` chain unchanged and in order, no milestone step, no network-capable path in the chain, green at the delivered HEAD, and conventional commit history within the ≤100-character rule via the range gate.
- **Planning truth (F-5, AC-F5-1…5):** the M2-S20 block in story shape, 19/19 ticket lines, story-code set equality and contiguous ranking, the pack row with resolvable seeds, and the status delivery addendum.
- **Tracker evidence (F-6, AC-F6-1…2):** read-only, paged, per-milestone declared-versus-attached evidence recorded in `chg-GH-313-milestone-evidence.md` and mirrored to pm-notes; a separately reported (never failing) attached-but-undeclared list; GH-313's own attachment.

### 1.2 Out of Scope & Known Gaps

- **No ticket is created, no milestone is created, no historical issue is labelled, attached, or edited by any test** (NG-3, NG-5, spec C-12, §20). Verification leaves no tracker residue. Accepted live evidence (spec §17.1 framing rule 3, spec C-12) is either (a) a recorded local read-only sweep run through `scripts/checks/milestone-attachment-github.ts` with a read-only credential, writing only `tmp/milestone-attachment-sweep.json` and performing zero tracker writes, or (b) the first post-merge workflow run cited once it occurs. A live flag/clear demonstration is permitted **only** on an already-existing unattached issue and must be fully reverted. None of this is a repeatable automated test and none of it is part of the gate.
- **No test may call the tracker network.** Every automated case runs offline over fixtures and injected fakes. Live evidence (the local read-only sweep run, the M0/M1/M2 attachment reads) is a recorded, read-only run — never `bun test`, never part of CI or `pnpm check` (NFR-2, spec C-1).
- **No new aggregate-gate step, no alternate aggregate, no `|| true`/`continue-on-error`/`set +e` escape** (spec C-1, spec C-9). Asserted as a tree invariant, not as a diff.
- **NFR-6's 10-minute ceiling is measured, not asserted.** Wall-clock bounds are environment-dependent; the suite asserts the structural bound (page size 100 and ≤ ⌈N/100⌉+3 reads over N=250 and N=500 fixtures) and the execution log records the measured elapsed time of the 500-issue fixture against the 10-minute threshold.
- **"No story block reordered" and "no fabricated ticket line" cannot be asserted by a permanent suite.** The first is a diff property (`.ai/rules/testing-strategy.md` forbids asserting a moving-base diff) and is review-verified (TC-SCOPE-001); the second requires tracker truth and is verified in the AC-F6-1 evidence record (TC-EVID-001), not offline.
- **"Each topic exactly once" (AC-F1-2) is anchored automatically (heading/keyword counts) and confirmed once by recorded content review** — semantic duplication in prose is not mechanically decidable.
- **Current-truth specification reconciliation is phase 7** (`doc/spec/**` and one guide, Appendix B rows 25–31) and is explicitly not tested here; the delivery diff must not contain pre-flipped behavioural current truth (TC-SCOPE-001).
- **The new check surfaces and the workflow are pinned by the delivery plan.** `scripts/checks/milestone-attachment.ts` (pure core), `scripts/checks/milestone-attachment-runner.ts` (port-injected orchestration), `scripts/checks/milestone-attachment-github.ts` (the sole network-capable adapter, used by the workflow and the local sweep), and `.github/workflows/ticket-milestone-check.yml`. Appendix B row 34's "`scripts/**` UNCHANGED" is read as "no distributable/install-set script changed" and is reconciled by the plan's TP-Q1 pin; the new modules are repository-internal, outside `ADOS_DELIVERY_SCRIPTS`, and outside the aggregate chain.
- **The existing invariant scanners stay unchanged by design.** `ci-supply-chain.ts`/`ci-bindingness.ts` read only `.github/workflows/ci.yml` and enforce only `ts-` jobs (spec Appendix C "Workflow audit scope"). The new workflow's permissions, pins, secret absence, and bypass-construct absence are owned by the dedicated static suite plus its mutation proof (TC-WF-002/TC-WF-003), not by editing the scanners.
- **Contract v1 is the shared artifact contract.** This revision implements the canonical check contract v1 (ordered rules 1, 2, 3, 4a–4f; closed write vocabulary `addFlag | removeFlag | postMarkerComment | writeJobSummary`) as the decision-table oracle. Spec Appendix C carries the same ordered contract (14 rows); a divergence in any artifact requires a revision before the DoR gate (never silent drift).
- **No MCP surface, no CLI surface, no product telemetry** (NG-4, §10): none is asserted because none is claimed.
- **DoD-19 is the roll-up condition**, satisfied by the all-Covered matrix in §3 plus execution evidence in §10 and phase pm-notes; it has no TC of its own.

## 2. References

- Change specification: `./chg-GH-313-spec.md` — F-1…F-6 (§5), flows (§6), interfaces EVT-1…4 and DM-1…5 (§8.2/§8.3), NFR-1…NFR-7 (§9), telemetry (§10), RSK-1…RSK-10 (§11), DEC-1…DEC-12 (§15), **AC-F1-1…AC-NFR7-1 (§17)**, DoD-1…DoD-21 (§17.1), Appendix C testability notes and scenario seeds `SC-M2-S20-01…05`, Appendix D ticket mapping, **Appendix E constraint register C-1…C-12**.
- Implementation plan: `./chg-GH-313-plan.yaml` — **remediated and reconciled with this revision**. Its pins, which this plan now asserts, are: phase 1 owns the guide, the pack-conventions pointer (`doc/planning/oss-tooling/milestones/README.md`), the documentation-index row, PDR-0005 plus its register row, and the header script run on the single new file only (`scripts/add-header-location.sh doc/guides/milestone-management.md`); phase 2 owns the change-spec template and TC-TPL-001/003/004; phase 3 owns the three prompts, the tracker instructions, the regenerated plugin, TC-TPL-002 and TC-PROMPT-001…004/TC-PLUGIN-001; phase 4 owns `scripts/checks/milestone-attachment.ts`, `scripts/checks/milestone-attachment-runner.ts`, `scripts/checks/milestone-attachment-github.ts`, the workflow, the five check suites, and the pinned sweep artifact `tmp/milestone-attachment-sweep.json`, including the local read-only sweep obligation; phase 5 owns the five planning documents (with the M2 pack-contents range line) plus the planning-truth suite and heading fixture; phase 6 is the PM-lane read-only evidence record at `chg-GH-313-milestone-evidence.md`. The plan keeps `package.json`'s check chain, `scripts/install.sh`, `ADOS_DELIVERY_SCRIPTS`, and the three invariant scanners untouched.
- Repository testing strategy: `.ai/rules/testing-strategy.md` — module→test mapping (`.github/workflows/ci.yml` → `ci-topology`/`ci-bindingness`/`ci-supply-chain`; `scripts/<script>.sh` → `scripts/.tests/test-<script>.sh`; `scripts/checks/<check>.ts` → `tests/checks/**`), `bun:test` authoring, permanent-suite rules (assert the tree, never a moving-base diff; assert meaning, not a growing count).
- TypeScript test authoring: `.ai/rules/typescript.md` §9 — bun:test under `tests/**/*.test.ts`, injected fakes over `mock.module`, deterministic (no clock, network, `$HOME`, sleeps), fixtures never named `*.test.ts`, goldens regenerated by an explicit command.
- Decision record: `doc/decisions/PDR-0005-milestone-first-planning-and-delivery.md` (registered in `doc/decisions/00-index.md`; `Proposed`, `decision_date: null` until the owner decides at the PR gate) — the operating rule, enforcement and exemption the guide and tests must mirror. Its hard constraints are the **PDR C-1…C-6** register (not the spec's Appendix E C-1…C-12); both are cited with their namespace.
- Canonical check contract **v1** (the decision-table oracle for this revision): inputs `action` (opened | edited | labeled | unlabeled | milestoned | demilestoned | reopened), issue state, `change` label, `backlog-capture` exemption, milestone, `needs-milestone` flag, and `markerCommentPresent`; ordered first-match rules 1 → 2 → 3 → 4a–4f; verdicts `out-of-scope | exempt | compliant | flagged | restored`; write vocabulary `addFlag | removeFlag | postMarkerComment | writeJobSummary`, with exactly one job summary per run written to `$GITHUB_STEP_SUMMARY`. The spec, PDR, and plan are being aligned to the same contract in parallel (§1.2).
- PM notes: `./chg-GH-313-pm-notes.yaml` — `milestone: "M2: Ceremonies, measurement, and memory"`, `story_code: M2-S20`, `delivery_mode: autonomous`, recorded prompt/plugin and backlog-drift risks.
- Scenario seeds (inherited **by name**, per spec Appendix C): `SC-M2-S20-01` flag-once/no-state-change → TC-CHK-002/CHK-003; `SC-M2-S20-02` no second flag/comment → TC-CHK-003; `SC-M2-S20-03` exemption suppresses → TC-CHK-004; `SC-M2-S20-04` attach clears / detach restores → TC-CHK-005; `SC-M2-S20-05` sweep zero writes / one artifact / exit 0 → TC-SWEEP-001.
- Delivered machinery this plan consumes unchanged: `scripts/.tests/test-doc-distribution.sh` + `test-doc-distribution-modes.sh` (marker-derived install set, five failure modes), `scripts/add-header-location.sh` (header ownership; its output is the byte reference for TC-GUIDE-001), `scripts/build-claude-plugin.sh` + the CI `verify-claude-build` job (plugin freshness), `scripts/checks/script-surface.ts` (`NAMED_CHECKS` = lint → format:check → typecheck → test → check:boundaries), `scripts/checks/ci-supply-chain.ts`/`ci-bindingness.ts`/`ci-topology.ts` (unchanged; they scope to `ci.yml`/`ts-` jobs), `tests/checks/prompt-conformance.test.ts` + `tests/fixtures/prompt-inventory/{lifecycle,retained-retired}.json`, `scripts/run-bash-suites.sh` (bash suite discovery), `scripts/lint-commit-range.sh`.
- New surfaces under assertion (plan-pinned): `scripts/checks/milestone-attachment.ts`, `scripts/checks/milestone-attachment-runner.ts`, `scripts/checks/milestone-attachment-github.ts`, `.github/workflows/ticket-milestone-check.yml`, the five `tests/checks/milestone-*.test.ts` / `planning-truth.test.ts` suites, `tests/fixtures/milestone-attachment/**`, the sweep artifact `tmp/milestone-attachment-sweep.json`, and the evidence record `chg-GH-313-milestone-evidence.md`.
- Planning corpus under assertion as data: `doc/planning/oss-tooling/backlog.md`, `backlog-ranking.md`, `milestones/README.md` (`## Conventions`), `milestones/m2/README.md` (story-to-artifact map), `milestones/m2/test-scenarios.md` (seed headings), `status.md` (addendum form); `doc/00-index.md` (Guides table); `doc/templates/change-spec-template.md`; `.opencode/agent/{pm,spec-writer,bootstrapper}.md`; `.ai/agent/pm-instructions.md`; `.ados-claude/agents/*` (generated).

## 3. Coverage Overview

All 30 §17 acceptance criteria are covered; none is left as TODO. DoD-19 is satisfied by this matrix plus the execution evidence in §10 and phase pm-notes.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Guide exists with `ados_distribution: redistributable`, in the derived install set, exactly one script-generated header byte-identical to `scripts/add-header-location.sh` output, linked from the index Guides table, drift guard green | TC-GUIDE-001, TC-GUIDE-005 | Covered |
| AC-F1-2 | Nine lifecycle topics documented, each once; tracker record named source of truth; `M<n>`-prefix convention | TC-GUIDE-002 | Covered |
| AC-F1-3 | Pack `## Conventions` records the operating rule as a pointer without restating the procedure; guide states the unattended-run precondition | TC-GUIDE-003, TC-GUIDE-002 | Covered |
| AC-F1-4 | PDR-0005 exists in the decision register, records rule + enforcement + exemption, referenced from guide and change | TC-GUIDE-004 | Covered |
| AC-F2-1 | Creation requires a milestone resolved from the existing set in both surfaces; no autonomous creation; existing prohibitions present and unweakened | TC-PROMPT-001, TC-PROMPT-002 | Covered |
| AC-F2-2 | Intake verifies attachment and records the milestone in pm-notes before artifacts; unattached (incl. exempt) ticket produces a question and blocks artifacts | TC-PROMPT-003 | Covered |
| AC-F2-3 | Bootstrapper generates a milestone section; regenerated plugin committed and fresh; prompt conformance green | TC-PROMPT-004, TC-PLUGIN-001 | Covered |
| AC-F3-1 | Open `change` issue, no milestone, no exemption, `opened` → flag label + one marked comment (comment only when no marker exists); state/assignee/other labels unchanged | TC-CHK-002 | Covered |
| AC-F3-2 | Repeated triggers → no second comment, no add-flag while the flag is present, manual flag removal respected, observable state identical after any number of runs | TC-CHK-003 | Covered |
| AC-F3-3 | Exemption suppresses flag and comment and outranks milestone and flag; purpose and removability documented in guide and tracker instructions | TC-CHK-004 (docs: TC-GUIDE-002, TC-PROMPT-001) | Covered |
| AC-F3-4 | Attach removes the flag only when present, with no comment; detach restores the flag only when the marker exists, with no comment | TC-CHK-005 | Covered |
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
| AC-F6-1 | Per-milestone (M0/M1/M2) declared-and-attached count plus total attached (declared-and-attached + attached-but-undeclared), closed tickets included, title-prefix match, declared-minus-attached gap list empty when green, unattached backlog count reported (not reconciled) | TC-EVID-001 | Covered |
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
| NFR-1 | Flag precision/idempotency: 0 flags on exempt issues; 0 `addFlag` when the flag is present; ≤1 comment ever; a manual removal is not reversed except by `opened` / `demilestoned`-with-marker | TC-CHK-003, TC-CHK-002, TC-CHK-004, TC-CHK-005 | Covered |
| NFR-2 | Gate determinism: 0 tracker calls, five named checks in order, no milestone step, green | TC-GATE-001, TC-QG-001 | Covered |
| NFR-3 | Workflow privilege/supply chain: `issues: write` + `contents: read`, 40-hex pins, no `pull_request_target`, no secret | TC-WF-002, TC-WF-003 | Covered |
| NFR-4 | Documentation distribution: marker, derived install set, drift guard, exactly one script-generated header (byte-identical to the script), no hand-edited plugin | TC-GUIDE-001, TC-GUIDE-005, TC-PLUGIN-001, TC-SCOPE-001 | Covered |
| NFR-5 | Change quality gates: `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before PR; conventional subjects; body/footer ≤100 chars | TC-QG-001 | Covered |
| NFR-6 | Sweep bounds/write discipline: page 100, ≤⌈N/100⌉+3 reads, 0 tracker writes, 1 local artifact, ≤10 min for N≤500, exit 0 | TC-SWEEP-002, TC-SWEEP-001 | Covered |
| NFR-7 | Comment safety: static body, zero issue-authored interpolation, no untrusted text in the run log | TC-CHK-006 | Covered |

**Acceptance-criterion rows for the non-functional set** (each AC explicitly mapped, so no AC rests only on its NFR parent):

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-NFR1-1 | On each repeat evaluation the check issues 0 `addFlag` writes while the flag is present and posts ≤1 comment in total; observable tracker state identical after any number of runs; 0 flags on exempt issues; a human's flag removal is not reversed by edit/label/reopen | TC-CHK-003, TC-CHK-002, TC-CHK-004, TC-CHK-005 | Covered |
| AC-NFR2-1 | At the delivered HEAD the chain is unchanged and ordered, performs 0 tracker calls, has no milestone step, and `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green | TC-GATE-001, TC-QG-001 | Covered |
| AC-NFR3-1 | Permissions limited to `issues: write` + `contents: read`, every action a 40-hex SHA pin, no `pull_request_target`, no bypass construct, no secret | TC-WF-002, TC-WF-003 | Covered |
| AC-NFR4-1 | Guide in the derived install set, drift guard passes, no hand-edited plugin file, exactly one license header generated by `scripts/add-header-location.sh` and byte-identical to that script's output | TC-GUIDE-001, TC-GUIDE-005, TC-PLUGIN-001, TC-SCOPE-001 | Covered |
| AC-NFR5-1 | Aggregate gate green before the PR; every commit subject conventional; body/footer lines ≤100 characters | TC-QG-001 | Covered |
| AC-NFR6-1 | For N ≤ 500: pages of 100, ≤⌈N/100⌉+3 reads, 0 tracker writes, exactly 1 local artifact, ≤10 minutes, exit 0 regardless of findings | TC-SWEEP-002, TC-SWEEP-001 | Covered |
| AC-NFR7-1 | Comment body byte-identical under adversarial issue content, containing no issue-authored string, with no untrusted text in the run log | TC-CHK-006 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this change is **documentation + prompt + repository-automation**, not a TypeScript workspace feature: the primary layers are **static/contract suites over files-as-data**, **a pure unit layer over the evaluation core**, **an offline integration layer over a fake tracker port**, and a small **read-only evidence layer**. No layer calls the network.

- **Unit (pure decisions, no I/O).** `bun test tests/checks/milestone-attachment.test.ts`. The core (`scripts/checks/milestone-attachment.ts`) is a pure function over the contract-v1 input `{ action, state, changeLabel, exemption, milestone, flag, markerCommentPresent }` returning `{ verdict, writes }` where `writes ⊆ { addFlag, removeFlag, postMarkerComment, writeJobSummary }`. No clock, no environment, no port. The canonical contract-v1 ordered table (§5.2 TC-CHK-001) is the oracle.
- **Contract / static (files as data).** `bun test tests/checks/milestone-guide.test.ts tests/checks/milestone-artifacts.test.ts tests/checks/milestone-prompts.test.ts tests/checks/milestone-workflow.test.ts tests/checks/milestone-gate.test.ts tests/checks/planning-truth.test.ts`. Every assertion parses the delivered tree (guide front matter, template front matter, prompt text, workflow YAML, `package.json` scripts, planning markdown tables and headings). YAML is parsed with the `yaml` package (already a dev dependency), never by substring where structure matters. Each static assertion must be paired with a negative fixture proving it fires (TC-WF-003; same pattern as `tests/checks/ci-checks.test.ts`).
- **Integration (event → actions, offline).** `bun test tests/checks/milestone-attachment-integration.test.ts tests/checks/milestone-sweep.test.ts`. Fixture event payloads plus an injected in-memory tracker port (`readIssue`, `listComments`, `listMilestones`, `listIssues`, `addLabel`, `removeLabel`, `createComment`) that carries the seeded `needs-milestone` flag and the marker-comment presence, and records every call. The assertions are on the resulting tracker state **and** on the recorded call list — the call list is what proves "no duplicate application", "no re-application after manual removal", "no other mutation", and "0 tracker writes". The job summary is written to an injected `$GITHUB_STEP_SUMMARY` sink and asserted for issue number, verdict, and writes; it is never interpolated into a tracker write. No `mock.module`; the fake is injected (`.ai/rules/typescript.md` §9). The sweep's pinned production artifact path is `tmp/milestone-attachment-sweep.json`; the suites substitute an isolated temp path.
- **Aggregate gate (no new code in the chain).** `TMPDIR=$PWD/tmp/tmpdir pnpm check` — lint → format:check → typecheck → test → check:boundaries → `prompt-conformance.ts` → `help-guide-coverage.ts` → `exports-parity.ts`. The new suites ride the existing `test` step; the workflow and the GitHub adapter do not enter the chain (spec C-1/DEC-2).
- **Evidence runs (read-only, recorded, outside the gate).** Distribution guard `bash scripts/.tests/test-doc-distribution.sh` + `bash scripts/.tests/test-doc-distribution-modes.sh`; plugin freshness `./scripts/build-claude-plugin.sh` followed by `git status --porcelain .ados-claude/`; commit range `./scripts/lint-commit-range.sh --base main-tools`; and the accepted live sweep evidence: a recorded local read-only run through `scripts/checks/milestone-attachment-github.ts` with a read-only credential (writes only `tmp/milestone-attachment-sweep.json`, performs zero tracker writes) **or** the first post-merge workflow sweep run cited once it occurs. Each result is recorded in §10 and mirrored into pm-notes `notes:`. None of these runs inside `bun test` or `pnpm check`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-GUIDE-001 | Guide exists with the marker, index link, and byte-identical script-generated header | Happy Path | Contract | Critical | AC-F1-1, AC-NFR4-1 |
| TC-GUIDE-002 | Nine lifecycle topics documented once, tracker record as source of truth, unattended-run precondition | Happy Path | Contract | Critical | AC-F1-2, AC-F1-3, DM-5 |
| TC-GUIDE-003 | Pack `## Conventions` points at the guide without restating the procedure | Happy Path | Contract | High | AC-F1-3 |
| TC-GUIDE-004 | PDR-0005 registered, records rule + enforcement + exemption, referenced from guide and change | Happy Path | Contract | High | AC-F1-4 |
| TC-GUIDE-005 | Distribution drift guard + negative-mode self-tests green; install set derived from the marker | Regression | Evidence | Critical | AC-F1-1, AC-NFR4-1 |
| TC-TPL-001 | Change-spec template carries required `change.milestone` with resolution rule and `none` escape | Happy Path | Contract | Critical | AC-F4-1, DM-1 |
| TC-TPL-002 | `@spec-writer` front-matter rules require the field and validate it | Happy Path | Contract | High | AC-F4-1, DM-1 |
| TC-TPL-003 | This change's spec value equals pm-notes `milestone` (tracker equality in TC-EVID-002) | Regression | Contract | Critical | AC-F4-1, DM-1, DM-3 |
| TC-TPL-004 | Exactly one template carries the field; the five excluded templates do not | Negative | Contract | Critical | AC-F4-2, spec C-6 |
| TC-PROMPT-001 | Tracker instructions require milestone at creation from the existing set; prohibitions preserved | Happy Path | Contract | Critical | AC-F2-1, DM-2 |
| TC-PROMPT-002 | `@pm` prompt carries the tracker-agnostic creation rule and forbids autonomous milestone creation | Happy Path | Contract | Critical | AC-F2-1 |
| TC-PROMPT-003 | Intake verifies attachment, records pm-notes, asks on absence, treats exempt as unattached | Happy Path | Contract | Critical | AC-F2-2, DM-3, spec C-3 |
| TC-PROMPT-004 | `@bootstrapper` guidance generates a milestone section in project tracker instructions | Happy Path | Contract | High | AC-F2-3 |
| TC-PLUGIN-001 | Generated plugin mirrors the three changed prompts and is fresh; prompt conformance green | Regression | Contract + Evidence | Critical | AC-F2-3, AC-NFR4-1 |
| TC-CHK-001 | Canonical contract-v1 decision table: verdict, tracker writes, and job summary per evaluation | Contract | Unit | Critical | AC-F3-6, EVT-4, NFR-1 |
| TC-CHK-002 | Opened flag path: one flag, one marker comment only when none exists, no other mutation | Happy Path | Integration | Critical | AC-F3-1, EVT-1, DM-2 |
| TC-CHK-003 | Idempotency and manual removal: no second comment, no re-add except `opened`/`demilestoned`-with-marker, state identical | Regression | Integration | Critical | AC-F3-2, AC-NFR1-1, NFR-1 |
| TC-CHK-004 | Exemption outranks milestone and flag; no writes; removable | Negative | Integration | Critical | AC-F3-3, DM-2 |
| TC-CHK-005 | Attach removes only a present flag; detach restores only with the marker; neither comments | Corner Case | Integration | Critical | AC-F3-4, EVT-2 |
| TC-CHK-006 | Fixed marker comment: byte-identical under adversarial content, no interpolation, no log leakage | Negative | Unit | Critical | AC-NFR7-1, NFR-7 |
| TC-SWEEP-001 | Sweep: advisory summary + one local artifact, 0 tracker writes, exit 0, fail-loud on API error | Happy Path | Integration | Critical | AC-F3-5, EVT-3, spec C-2 |
| TC-SWEEP-002 | Sweep bounds: page size 100, ≤⌈N/100⌉+3 reads, exit 0 for N=250/500, elapsed recorded | Corner Case | Integration | High | AC-NFR6-1, NFR-6 |
| TC-WF-001 | Workflow declares the seven action events, the manual sweep dispatch, and the job summary | Contract | Contract | High | AC-F3-7, AC-F3-6 |
| TC-WF-002 | Least privilege, 40-hex pins, no `pull_request_target`, no secret, no bypass construct | Negative | Contract | Critical | AC-F3-7, AC-NFR3-1, NFR-3 |
| TC-WF-003 | Each static workflow assertion is proven non-vacuous by a mutation fixture | Negative | Contract | Critical | AC-F3-7, AC-NFR3-1 |
| TC-GATE-001 | Aggregate chain unchanged and in order, no milestone step, no network-capable path | Regression | Contract | Critical | AC-NFR2-1, AC-F3-6, NFR-2, spec C-1 |
| TC-QG-001 | Gate green at delivered HEAD; conventional subjects; ≤100-char body/footer lines | Regression | Evidence | Critical | AC-NFR5-1, NFR-5, spec C-11 |
| TC-PLAN-001 | M2-S20 block exists in story shape and the M2 baseline set changes by exactly one addition | Happy Path | Contract | Critical | AC-F5-1, DM-4 |
| TC-PLAN-002 | Every M2 block carries exactly one valid ticket line; no other section leaks in | Negative | Contract | Critical | AC-F5-2, DM-4 |
| TC-PLAN-003 | Ranking: story-code set equality, contiguous unique numbering, M2 in backlog order | Regression | Contract | Critical | AC-F5-3 |
| TC-PLAN-004 | M2 pack carries the M2-S20 row citing all five seeds, every seed resolves, range covers S20 | Happy Path | Contract | High | AC-F5-4 |
| TC-PLAN-005 | Status snapshot carries the delivery addendum in the established form | Happy Path | Contract | High | AC-F5-5 |
| TC-EVID-001 | Read-only per-milestone declared-and-attached evidence, total attached, undeclared dispositions, and debt count | Happy Path | Evidence | Critical | AC-F6-1, F-6 |
| TC-EVID-002 | GH-313 attached to M2; M2-S20 names it; three-surface title equality | Happy Path | Evidence | Critical | AC-F6-2, AC-F4-1 |
| TC-SCOPE-001 | Changed-scope conformance: no tickets, no milestones, no mass edits, no new install-set surface, no lifecycle change, no pre-flipped current truth | Negative | Manual (review) | High | AC-F4-2, AC-F1-1, AC-NFR4-1 |

### 5.2 Scenario Details

#### TC-GUIDE-001 - Guide exists with the marker, index link, and byte-identical script-generated header

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-NFR4-1, NFR-4, spec C-9, PDR C-4
**Test Type(s)**: Contract (front matter + index table + header as data)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-guide.test.ts` (To Implement)
**Tags**: @bun, @docs, @distribution

**Preconditions**:

- `doc/guides/milestone-management.md` is delivered (plan phase 1).
- `scripts/add-header-location.sh` is available; `git` and `bash` ≥ 4 are available locally.

**Steps**:

1. Assert the file exists at `doc/guides/milestone-management.md`.
2. Parse its first `---` front-matter block; assert `ados_distribution: redistributable` (exact enum value, quote-tolerant parse), and assert the parse is on the first block only (a body occurrence does not satisfy the marker).
3. **Assert the header unconditionally.** Build a throwaway git repository under the test temp base containing `scripts/add-header-location.sh` and the guide's body with its leading header block removed; run the script on the single file path (`scripts/add-header-location.sh doc/guides/milestone-management.md`) with the default `GITHUB_BRANCH`; read the produced file and assert it is **byte-identical** to the delivered guide (whole-file comparison). A missing header, a hand-inserted header, a reworded line, or a second header block fails this comparison.
4. Assert the header composition exactly: after the opening `---`, line 2 is the copyright comment (`# Copyright (c) 2025-2026 …`), line 3 is the Apache-2.0 comment (`# Apache-2.0 License - see LICENSE file for full terms`), line 4 is `source: https://github.com/<slug>/blob/<branch>/doc/guides/milestone-management.md`, and no additional `#` header line exists before the front-matter body.
5. Parse `doc/00-index.md`, locate the `## Guides` table, and assert exactly one row links `guides/milestone-management.md`, with a non-empty description.
6. Assert the guide contains a pointer whose target is exactly `doc/decisions/PDR-0005-milestone-first-planning-and-delivery.md` (no wildcard, no glob, no shortened/fuzzy reference) and that the file exists; and assert no repository-specific milestone number or ticket number is stated as a redistributable rule (PDR C-4).

**Expected Outcome**:

- The guide is discoverable, correctly classified, and carries exactly one header that is byte-identical to `scripts/add-header-location.sh` output — AC-F1-1's and NFR-4's header clause is satisfied literally, not by interpretation.

**Notes / Clarifications**:

- The byte comparison is the non-tautological form of the assertion: the expected file is produced by the script from the header-less body, so the delivered file cannot pass by merely being idempotent. The script resolves its repo root through `git rev-parse --show-toplevel`, hence the throwaway repository; this is offline and deterministic.
- The plan runs the script only on the single new file path, never the directory, so an unrelated headerless guide is never rewritten; TC-SCOPE-001 verifies that no other guide changed.

#### TC-GUIDE-002 - Nine lifecycle topics documented once, tracker record as source of truth, unattended-run precondition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, AC-F1-3, DM-5, spec C-9
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
**Related IDs**: F-1, F-5, AC-F1-3, RSK-9, spec C-9
**Test Type(s)**: Contract (section extraction + link/text assertions)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-guide.test.ts` (To Implement)
**Tags**: @bun, @docs, @planning

**Preconditions**:

- `doc/planning/oss-tooling/milestones/README.md` has a `## Conventions` section (verified today).

**Steps**:

1. Extract the `## Conventions` section body (until the next `## ` heading).
2. Assert it contains a markdown link resolving to `../../../guides/milestone-management.md` from `doc/planning/oss-tooling/milestones/README.md` (path-relative resolution checked against the file's directory).
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

- `doc/decisions/PDR-0005-milestone-first-planning-and-delivery.md` exists and its register row is committed (landed by plan phase 1).

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
**Target Layer / Location**: `tests/checks/milestone-prompts.test.ts` (To Implement; plan phase 3, alongside the prompt edits it asserts)
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
**Related IDs**: F-4, AC-F4-2, DEC-6, spec C-6
**Test Type(s)**: Contract (directory scan)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-artifacts.test.ts` (To Implement)
**Tags**: @bun, @templates, @negative

**Preconditions**:

- `doc/templates/` holds the change-spec, implementation-plan, test-plan, feature-spec, `roadmap-engineering-template.md`, and decision-record templates among others.

**Steps**:

1. Read every `doc/templates/**/*.md`; extract the first YAML front-matter block where present.
2. Assert exactly one file declares `change.milestone` (or a top-level `milestone:` field declared as a milestone membership): `change-spec-template.md`.
3. Assert each of the five excluded templates has no milestone-membership field: `implementation-plan-template.md`, `test-plan-template.md`, `feature-spec-template.md`, `roadmap-engineering-template.md`, `decision-record-template.md`.
4. Assert the exclusion reasons are recorded (the spec's DEC-6 text is present and referenced by the template's own comment or the decision log) — the assertion is on the presence of the rationale, not on wording.

**Expected Outcome**:

- The field exists on exactly the template that needs it; no neighbouring template silently gains or loses a field.

#### TC-PROMPT-001 - Tracker instructions require milestone at creation from the existing set; prohibitions preserved

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, spec C-8
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
8. Assert the tracker instructions' **Backlog Source of Truth** section names the tracker as the canonical ticket backlog and `doc/planning/oss-tooling/backlog.md` as the committed planning mirror, while still forbidding a separate local backlog file (no `doc/planning/backlog.md` and no ad-hoc local queue presented as a backlog source).

**Expected Outcome**:

- Creation cannot produce an unattached ticket by instruction, no autonomous milestone creation is possible, the tracker is named as the canonical ticket backlog with the committed planning corpus as its mirror (not a second backlog), and the three previously-delivered prohibitions survive verbatim in intent (spec C-8).

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
**Related IDs**: F-2, AC-F2-2, DM-3, DEC-11, spec C-3
**Test Type(s)**: Contract (ordered intake assertions across both files) + this change's own record
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-prompts.test.ts` (To Implement)
**Tags**: @bun, @prompts, @governance

**Preconditions**:

- TC-PROMPT-001/002 edits landed.

**Steps**:

1. Assert both surfaces describe the same intake order: read ticket → check attachment → (attached) record in pm-notes → artifacts; (unattached) ask the human naming the proposed milestone → stop until attached.
2. Assert the wording makes artifact phases conditional on the attachment existing (no "proceed with a TODO" path).
3. Assert the exemption is explicitly **not** a delivery licence: an exempt ticket still produces the question and still blocks artifact phases (DEC-11, spec C-3; the rule that stops RSK-2 becoming a permanent bypass).
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
**Related IDs**: F-2, AC-F2-3, AC-NFR4-1, NFR-4, spec C-7, RSK-3
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

#### TC-CHK-001 - Canonical contract-v1 decision table: verdict, tracker writes, and job summary per evaluation

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-6, EVT-1, EVT-4, NFR-1, NFR-2
**Test Type(s)**: Unit (pure core, table-driven)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment.test.ts` (To Implement) over the pinned core module `scripts/checks/milestone-attachment.ts` (plan phase 4)
**Tags**: @bun, @unit, @milestone

**Preconditions**:

- The core exposes a pure evaluator `evaluate(input)` over the contract-v1 value `{ action, state, changeLabel, exemption, milestone, flag, markerCommentPresent }` (no raw webhook payload, no environment, no clock, no port).
- It returns `{ verdict, writes }` with `verdict ∈ { compliant, exempt, flagged, restored, out-of-scope }` and `writes ⊆ { addFlag, removeFlag, postMarkerComment, writeJobSummary }`.

**Steps**:

1. Assert the input shape: exactly the seven fields above, with `action` from the closed set `opened | edited | labeled | unlabeled | milestoned | demilestoned | reopened`, and no field carrying issue title/body/author text.
2. Assert the ordered, first-match rules against the table below, row by row. "Tracker writes" excludes the job summary; **every row also emits exactly one `writeJobSummary`**, recorded in the last column.
3. Assert precedence with deliberately conflicting inputs, proving first-match-wins rather than conjunction: a closed exempt issue → `out-of-scope` (rule 1 before 2); an open exempt issue **with** a milestone and a flag → `exempt` with zero writes (rule 2 before 3/4, so the flag is not removed and no comment is posted); an open compliant issue with the flag present → `compliant` with exactly one `removeFlag` (rule 3 before 4); an open issue with no milestone, no exemption, flag present, and an `edited`, `labeled`, `unlabeled`, or `reopened` action → `flagged` with zero writes (rule 4d); and the same issue on `demilestoned` **with** the marker → `restored` with zero writes (rule 4c, not 4d).
4. Assert the verdict is exactly one member of the closed verdict set for every row of the full product (exhaustive over booleans and the seven actions), never undefined/empty.
5. Assert the write vocabulary is closed: no produced write is outside `{ addFlag, removeFlag, postMarkerComment, writeJobSummary }`; no state transition, assignee change, milestone write, or other-label write exists in the type or in any output; every run contains exactly one `writeJobSummary` naming the issue number, the verdict, and the tracker writes (or "none").
6. Assert determinism: evaluating the same input twice yields deep-equal results; evaluation order across the table does not matter.
7. Assert branch/verb completeness as a meta-assertion: the suite's case table covers rules 1, 2, 3, 4a, 4b, 4c, 4d, 4e, 4f and every write verb at least once; a missing branch or verb fails naming it (this converts AC-F3-6's "full decision table" claim into a testable property).

**Canonical table (contract v1; `any` = both values; the first matching rule decides):**

| # | `change` | state | exemption | milestone | flag | marker | action | verdict | tracker writes | job summary |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | no | open | any | any | any | any | any | `out-of-scope` | none (rule 1) | 1 |
| 2 | yes | closed | any | any | any | any | any | `out-of-scope` | none (rule 1) | 1 |
| 3 | yes | open | yes | absent | absent | absent | opened | `exempt` | none (rule 2) | 1 |
| 4 | yes | open | yes | present | present | present | edited | `exempt` | none (rule 2 outranks 3/4) | 1 |
| 5 | yes | open | yes | present | absent | absent | milestoned | `exempt` | none (rule 2 outranks 3) | 1 |
| 6 | yes | open | no | present | present | present | any | `compliant` | `removeFlag` (rule 3) | 1 |
| 7 | yes | open | no | present | absent | present | milestoned | `compliant` | none (rule 3; nothing to remove) | 1 |
| 8 | yes | open | no | absent | absent | absent | opened | `flagged` | `addFlag` + `postMarkerComment` (4a) | 1 |
| 9 | yes | open | no | absent | absent | present | opened | `flagged` | `addFlag` only (4a; no second comment) | 1 |
| 10 | yes | open | no | absent | present | present | opened | `flagged` | none (4b) | 1 |
| 11 | yes | open | no | absent | absent | present | demilestoned | `restored` | `addFlag` (4c) | 1 |
| 12 | yes | open | no | absent | present | present | demilestoned | `restored` | none (4c; flag already present) | 1 |
| 13 | yes | open | no | absent | absent | absent | demilestoned | `out-of-scope` | none (4f; no marker, not restored) | 1 |
| 14 | yes | open | no | absent | present | present | edited | `flagged` | none (4d) | 1 |
| 15 | yes | open | no | absent | present | absent | labeled | `flagged` | none (4d; manually flagged, no marker) | 1 |
| 16 | yes | open | no | absent | absent | present | edited | `out-of-scope` | none (4e; human removed the flag) | 1 |
| 17 | yes | open | no | absent | absent | absent | edited | `out-of-scope` | none (4f; pre-existing unattached issue) | 1 |
| 18 | yes | open | no | absent | absent | absent | labeled | `out-of-scope` | none (4f) | 1 |
| 19 | yes | open | no | absent | absent | absent | unlabeled | `out-of-scope` | none (4f) | 1 |
| 20 | yes | open | no | absent | absent | absent | reopened | `out-of-scope` | none (4f) | 1 |

**Representative rows beyond the canonical 20 (marker and flag interactions):**

| # | `change` | state | exemption | milestone | flag | marker | action | verdict | tracker writes | job summary |
|---|---|---|---|---|---|---|---|---|---|---|
| 21 | yes | open | no | absent | present | absent | `demilestoned` | `out-of-scope` | none (4f; no marker, not restored) | 1 |
| 22 | yes | open | no | absent | present | absent | `unlabeled` | `flagged` | none (4d) | 1 |
| 23 | yes | open | no | absent | present | present | `reopened` | `flagged` | none (4d) | 1 |

**Expected Outcome**:

- The decision logic is fully pinned offline to contract v1: every ordered rule and every write verb has at least one case; exemption outranks milestone and flag; a pre-existing unattached issue and a human-removed flag are never written on edit/label/reopen; each run emits exactly one job summary. AC-F3-6's "full decision table ... without network access" is demonstrated by construction.

**Notes / Clarifications**:

- Contract v1 is the ordered contract carried by spec Appendix C, PDR-0005, and the plan (§1.2). The suite is the oracle, so a divergence in any artifact fails this TC rather than silently redefining the check.
- The "tracker writes" column is the tracker-side action set. `writeJobSummary` is not a tracker write; it is the one run-legibility write required by §10 and is asserted in column 10 and by TC-WF-001.

#### TC-CHK-002 - Opened flag path: one flag, one marker comment only when none exists, no other mutation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, AC-NFR1-1, EVT-1, DM-2, PDR C-2, spec C-4
**Test Type(s)**: Integration (fixture event + fake tracker port)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment-integration.test.ts` (To Implement), fixtures under `tests/fixtures/milestone-attachment/`
**Tags**: @bun, @integration, @milestone, @security

**Preconditions**:

- In-memory tracker port with call recording and seeded flag/marker state: `readIssue`, `listComments`, `listMilestones`, `listIssues`, `addLabel`, `removeLabel`, `createComment`; plus an injected `$GITHUB_STEP_SUMMARY` sink.
- Fixtures: `events/issue-opened--change--no-milestone.json` (open, `change`, no milestone, no exemption, flag absent, no marker), its `--marker-present` variant, `issue-opened--change--with-milestone.json`, and `issue-opened--change--exempt.json`.

**Steps**:

1. Seed the port with the no-marker fixture issue, no comments, and milestones M0/M1/M2.
2. Run the port-injected runner for `opened`; capture the resulting tracker state, the recorded call list, and the job-summary text.
3. Assert the verdict is `flagged`.
4. Assert the writes are exactly `addFlag` + `postMarkerComment` + one `writeJobSummary`: the flag label `needs-milestone` is applied once, and exactly one comment is created.
5. Assert the comment body is the fixed marker text: it contains the stable marker, the guide path `doc/guides/milestone-management.md`, the exemption label `backlog-capture`, and a statement that the flag does not block work.
6. Run the `--marker-present` variant (flag absent, marker present) from a fresh seed; assert verdict `flagged`, writes exactly `addFlag` + one `writeJobSummary`, **zero** `postMarkerComment`, and the comment count unchanged at 1 (no second comment).
7. Run the with-milestone and exempt fixtures; assert zero tracker writes in both (summary only) — `compliant` and `exempt` respectively.
8. Assert the recorded call list contains only allowed writes plus reads: zero state transitions, zero assignee updates, zero milestone writes, zero other-label writes; and the issue `state`/`assignee` remain byte-equal to the seed.
9. Assert the job summary names the issue number, the verdict (`flagged`), and the writes performed (or "none" for steps 7); it must contain no issue title/body/author text.

**Expected Outcome**:

- The `opened` path writes one flag and one comment only when no marker exists; when the marker exists it writes the flag only. Nothing else changes; the job summary is legible without echoing issue content.

#### TC-CHK-003 - Idempotency and manual removal: no second comment, no re-add except `opened`/`demilestoned`-with-marker, state identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-NFR1-1, NFR-1, SC-M2-S20-01, SC-M2-S20-02
**Test Type(s)**: Integration (repeated evaluation over one port state)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment-integration.test.ts` (To Implement)
**Tags**: @bun, @integration, @milestone, @idempotency

**Preconditions**:

- TC-CHK-002's `opened` case completed on a fresh port: the issue carries the flag and exactly one marker comment.

**Steps**:

1. Replay the same `opened` event 3 times; assert each verdict is `flagged`, each run issues **zero tracker writes** (rule 4b), the full tracker state is deep-equal after runs 2 and 3 to the state after run 1, and the comment count stays 1.
2. Replay `edited` and `labeled` with the flag present and the marker present; assert verdict `flagged` with **zero** tracker writes (rule 4d).
3. **Manual flag removal is respected.** Simulate a human removing `needs-milestone` while the marker remains; for each of `edited`, `labeled`, `unlabeled`, and `reopened` (milestone absent, exemption absent), assert verdict `out-of-scope` with **zero** tracker writes and specifically zero `addFlag` (rule 4e — the human's removal is never reversed).
4. Assert the only two paths that may re-add after a removal: `opened` with flag absent + marker present → `flagged` with exactly one `addFlag` and no comment (4a); `demilestoned` with the marker present + flag absent → `restored` with exactly one `addFlag` and no comment (4c). Repeating either yields zero writes.
5. Assert the "no re-add while present" invariant: for any evaluation whose input has the flag present, the write list contains zero `addFlag`; across the whole sequence, total `addFlag` actions equal the number of transitions from flag-absent into a rule that adds (never more).
6. Assert duplicate-comment and identical-state invariants: comment count ≤ 1 across all runs; for every no-write path the state after N runs equals the state after the first; the only state changes in the whole sequence are the single initial flag add and the deliberate re-add cases in step 4.

**Expected Outcome**:

- Repeats and edits never comment twice and never re-apply a flag a human removed; the two legitimate re-add paths are the only exceptions, each issuing at most one `addFlag`. The spec's action-layer claim (NFR-1: 0 `addFlag` while present) is proven by the recorded call list.

**Notes / Clarifications**:

- This replaces the revision-1.1 expectation that a manual removal would be re-applied. Under contract v1, rule 4e makes the human action authoritative; the test now asserts the opposite and pins it.

#### TC-CHK-004 - Exemption outranks milestone and flag; no writes; removability

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, AC-F1-2, DM-2, DEC-11, SC-M2-S20-03
**Test Type(s)**: Integration (suppression + precedence probe)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment-integration.test.ts` (To Implement)
**Tags**: @bun, @integration, @milestone, @negative

**Preconditions**:

- Fixtures: `events/issue-opened--change--exempt.json` (open, `change`, `backlog-capture`, no milestone, no flag); an exempt + milestone + flag variant; an exempt + flag variant.

**Steps**:

1. Seed the port with the exempt issue; run each action class (opened, edited, labeled, unlabeled, milestoned, demilestoned, reopened).
2. Assert the verdict is `exempt` for every action and every run issues **zero tracker writes** (rule 2): no flag, no comment, no label removal.
3. **Exemption outranks milestone**: run the exempt + milestone + flag variant; assert `exempt` with zero writes — the existing flag is *not* removed even though a milestone is present (rule 2 before rule 3).
4. **Exemption outranks the flag**: run the exempt + flag variant; assert `exempt` with zero writes and the flag left in place.
5. Assert removability: seed the same issue without `backlog-capture`, flag absent, marker absent; run `opened`; assert verdict `flagged` with `addFlag` + `postMarkerComment`.
6. Assert the interaction with manual removal: with the exemption removed, the marker present from an earlier flag, and the flag absent, run `edited`; assert `out-of-scope` with zero writes (rule 4e) — removing the exemption does not resurrect the flag on an edit.
7. Assert the run summary names the issue number, verdict `exempt`, and "no writes" without copying the issue title/body.

**Expected Outcome**:

- The exemption is the highest-precedence suppression after scope: it wins over a milestone and over a present flag, writes nothing, and is removable with predictable consequences. The ticket is visibly not yet planned, never silently treated as compliant.

#### TC-CHK-005 - Attach removes only a present flag; detach restores only with the marker; no comment

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-4, EVT-2, DM-2, spec C-4, SC-M2-S20-04
**Test Type(s)**: Integration (reversal state machine)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment-integration.test.ts` (To Implement)
**Tags**: @bun, @integration, @milestone, @reversal

**Preconditions**:

- A port state representing a flagged issue (flag present, marker present) — produced by TC-CHK-002, not hand-seeded, so the fixture cannot encode a state the check cannot reach.

**Steps**:

1. Run `events/issue-milestoned--change.json` on the flagged state; assert verdict `compliant`, exactly one `removeFlag` for `needs-milestone`, zero `postMarkerComment`, zero other tracker writes; the existing marker comment is untouched.
2. Run `milestoned` on an issue with a milestone and **no** flag; assert verdict `compliant` with zero tracker writes (nothing to remove — no spurious removal).
3. Run `events/issue-demilestoned--change.json` on the state from step 1 (milestone absent, flag absent, marker present); assert verdict `restored`, exactly one `addFlag`, zero `postMarkerComment`; the comment count stays 1.
4. Run `demilestoned` again with the flag already present; assert verdict `restored` with zero tracker writes (idempotent restoration, no duplicate `addFlag`).
5. Run `demilestoned` with the flag absent and **no marker** (a never-flagged pre-existing issue); assert verdict `out-of-scope` with zero tracker writes (rule 4f) — the restore path requires the marker.
6. Run `milestoned` and `demilestoned` on a closed issue; assert `out-of-scope` with zero writes (rule 1).
7. Assert the whole sequence leaves exactly one comment, only `addFlag`/`removeFlag` tracker writes, and one `writeJobSummary` per run; the final state equals the state after step 3.

**Expected Outcome**:

- Attachment reverses the flag only when it is present; detachment restores it only when the marker proves it was previously flagged; neither posts a comment; closed and unmarked issues never produce writes.

#### TC-CHK-006 - Fixed marker comment: byte-identical under adversarial content, no interpolation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-7, AC-NFR7-1, F-3, spec C-5
**Test Type(s)**: Unit (fixed comment constant + summary projection)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-attachment.test.ts` (To Implement), fixtures under `tests/fixtures/milestone-attachment/adversarial/`
**Tags**: @bun, @unit, @security, @milestone

**Preconditions**:

- The comment body is the fixed marker text exposed as a constant by the core module; the run-summary projection is a separate pure function.

**Steps**:

1. Assert the comment body equals the fixed marker text exactly — one constant, with the stable marker token, the guide path, the exemption label, and the non-blocking statement; there is no parameter that can alter it.
2. Build the body for each adversarial fixture: `issue-text-injection.json` (title/body/author containing `${{ secrets.TOKEN }}`, `<!-- marker -->`, backticks, a line starting `## `, `</script>`, ANSI escapes) and `issue-log-forging.json` (newlines, `\r`, zero-width characters, a bidi override, a 10 000-character body).
3. Assert the body is byte-identical across **every** adversarial case and to the benign case (same bytes as step 1).
4. Assert the body contains none of the adversarial tokens and no substring of any fixture title, body, or author login (assert against a token list extracted from each fixture, so the check is non-vacuous).
5. Assert the producer is a zero-argument constant (no issue-derived parameter); calling it with the adversarial issue object is impossible by type, and the module-level constant is the value used on the write path.
6. Render the job-summary projection for each adversarial fixture; assert it contains the issue **number**, the verdict, and the writes ("none" or the action list) and zero issue-authored text (title/body/author) and zero control characters.
7. Assert no untrusted text reaches a log-shaped projection: any diagnostic string produced by the runner for these fixtures contains only the issue number, the action name, and the verdict.

**Expected Outcome**:

- The primary injection surface is closed by construction: the comment is one fixed string, the summary carries only the issue number and the verdict, and no issue-authored text is echoed anywhere.

#### TC-SWEEP-001 - Sweep: advisory summary + one local artifact, 0 tracker writes, exit 0, fail-loud on API error

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-5, EVT-3, NFR-6, spec C-2, PDR C-3, SC-M2-S20-05
**Test Type(s)**: Integration (sweep over paged fixtures with a fake port and a temp output directory)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-sweep.test.ts` (To Implement)
**Tags**: @bun, @integration, @sweep, @read-only

**Preconditions**:

- Fixture `sweep/issues-n250-page-1..3.json` (100/100/50) including: unattached open `change` issues, exempt issues, milestoned issues, closed issues, non-change issues.
- An isolated temp directory standing in for the pinned sweep output path `tmp/milestone-attachment-sweep.json` (plan phase 4.2).

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

**Notes / Clarifications**:

- Automated scope: this suite proves the sweep's contract offline. The accepted live evidence for AC-F3-5/DoD-10 is either a recorded local read-only run through `scripts/checks/milestone-attachment-github.ts` (its only write is `tmp/milestone-attachment-sweep.json`, zero tracker writes) or the first post-merge workflow sweep run cited once it occurs. Neither form is part of this suite, and neither is part of `pnpm check`.

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

#### TC-WF-001 - Workflow declares the seven action events, the manual sweep dispatch, and the job summary

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-7, AC-F3-6, EVT-1, EVT-2, EVT-3
**Test Type(s)**: Contract (workflow YAML parse + summary-write assertion)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/milestone-workflow.test.ts` (To Implement)
**Tags**: @bun, @workflow, @contract

**Preconditions**:

- `.github/workflows/ticket-milestone-check.yml` (pinned by plan phase 4.4).

**Steps**:

1. Parse the workflow with the `yaml` package; assert the `on:` block declares `issues` with types covering **all seven contract actions**: opened, edited, labeled, unlabeled, milestoned, demilestoned, reopened, plus the manual sweep.
2. Assert a `workflow_dispatch` trigger exists with an input selecting sweep mode (a named boolean/choice input), and that the sweep path is reachable only through dispatch (no schedule).
3. Assert every declared event reaches the same evaluation entry point (the job's run step invokes the runner with the event payload path and the issue number), so one verdict per evaluation is acted on (EVT-4).
4. Assert the sweep step's exit semantics are the runner's, not a shell swallow: the dispatch step does not wrap the command in `|| true`/`exit 0` (the sweep itself returns 0 on findings).
5. Assert no `permissions: write-all` and no repository-wide permission block that widens the job's grant.
6. **Assert the job summary.** Assert a step writes to `$GITHUB_STEP_SUMMARY` (e.g. the run appends with `>> "$GITHUB_STEP_SUMMARY"`), that the write is unconditional on the evaluation path (not inside an `if:` that only runs on failure), and that it is not wrapped in a bypass construct. Assert the summary line shape names the issue number, the verdict, and the writes performed (or "none"): the static assertion pins the target and the invocation; the field-level content is asserted behaviorally in TC-CHK-001 step 5 and TC-CHK-002 step 9.

**Expected Outcome**:

- The declared events cover the contract's full action set, the sweep is manual-only, the single-verdict rule is wired through one entry point, and every run emits exactly one job summary naming the issue, verdict, and writes.

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
6. Assert the write calls are limited by construction: the workflow passes only the event path and token to the runner; no `gh`/`curl` write command appears inline in the workflow (writes go through the injected port of `scripts/checks/milestone-attachment-github.ts`).

**Expected Outcome**:

- The workflow cannot exceed the declared privilege, cannot float an action, cannot read a secret, and cannot swallow a failure.

**Notes / Clarifications**:

- The "not a required check / never blocks delivery" posture (PDR C-6) is **not** a property of the workflow file: it is a repository branch-protection/ruleset setting plus the absence of entry-script refusals. It is therefore verified in manual/evidence review by TC-SCOPE-001, not asserted here — a YAML assertion would only test a claim the file cannot carry.

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
4. Assert coverage of the gap by construction: the dedicated suite's scanned-file set is `.github/workflows/ticket-milestone-check.yml`, and a test asserts that path is present in the set — so a future rename cannot silently drop the file from the battery. The suite must not depend on `ci-supply-chain.ts`/`ci-bindingness.ts` being modified.
5. Assert the existing scanners stay unchanged and green: `bun run scripts/checks/ci-supply-chain.ts`, `bun run scripts/checks/ci-bindingness.ts`, and `bun run scripts/checks/ci-topology.ts` exit 0 on the delivered tree, and their source still scopes to `.github/workflows/ci.yml` / `ts-` jobs (spec Appendix C "Workflow audit scope"). The dedicated suite is the audit owner for the new file.

**Expected Outcome**:

- Every security assertion is proven to fire; the new workflow cannot escape the battery by living outside `ci.yml`, and the existing scanners stay untouched as the plan pins.

#### TC-GATE-001 - Aggregate chain unchanged and in order, no milestone step, no network-capable path

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR2-1, AC-F3-6, NFR-2, spec C-1, DEC-2
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
5. Static scan of the three pinned modules — `scripts/checks/milestone-attachment.ts`, `scripts/checks/milestone-attachment-runner.ts`, `scripts/checks/milestone-attachment-github.ts` — asserting the first two import no `node:http`, `node:https`, `node:child_process`, tracker SDK, or bare `fetch(`; the GitHub adapter is the only network-capable module and is not imported by any module reachable from `scripts.check` (assert the import graph of the chain-reachable files).
6. Assert the new test suites are reachable only through the existing `test` step (`bun test` discovery), i.e. no new manifest script was added to run them separately.
7. Assert the workflow path does not appear in `scripts.check` or in any package manifest script.

**Expected Outcome**:

- `pnpm check` keeps its five-step order plus the three scans, gains nothing milestone-specific, and has no path that can reach the network; "0 tracker calls" is established by construction and by the import scan (see §8.2).

#### TC-QG-001 - Gate green at delivered HEAD; conventional subjects; ≤100-char body/footer lines

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, AC-NFR5-1, AC-NFR2-1, spec C-11, DEC-12
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
4. Load the committed fixture `tests/fixtures/milestone-attachment/planning/section-headings.json`, which carries the **M2 baseline story-code set** (the 18 codes present before this change) plus the M0/M1/M3/M4 sets. Compare the delivered M2 set to the baseline: assert **exactly one addition (`M2-S20`) and zero removals**, failing and naming any other added or removed code. Heading order outside the append is not asserted here — reordering is a diff property (TC-SCOPE-001).
5. Compare the delivered M0/M1/M3/M4 story-code sets to the fixture's sets exactly (unchanged), so an edit in another section cannot ride along.

**Expected Outcome**:

- M2-S20 exists in the exact shape every other story uses, with its ticket and milestone; no neighbouring story disappears.

**Notes / Clarifications**:

- Step 4/5's baseline fixture is the tree-invariant way to assert "exactly one story added, none removed" without asserting a base-branch diff (testing strategy). It is regenerated deliberately only when a new story is authored after this change; the M2 baseline itself stays at the pre-change set so the one-addition assertion remains meaningful.

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
2. Assert the row's scenario-seed cell cites **all five** seeds `SC-M2-S20-01`, `-02`, `-03`, `-04`, `-05` — exactly these five, none missing and no invented sixth.
3. Resolve **every** seed cited by **every** row against `test-scenarios.md` `### SC-...` headings; assert every cited seed resolves to an existing heading, and every defined seed heading is cited by some row (no dangling citation, no orphan seed). This generalizes beyond S20 so a future row cannot cite a non-existent seed and a defined seed cannot be unreferenced.
4. Assert `test-scenarios.md` has a `## M2-S20 <title>` section containing the seeds cited, and that the file's introductory range statement covers S2 through S20 (parse the stated range and assert it includes S20 — a range that still says "S2 through S19" fails).
5. Assert the pack index's pack-contents line describing the seed file covers S20 as well (the range mention appears in `m2/README.md`'s pack-contents table).
6. Assert the five M2-S20 seeds are behaviourally the inherited set — flag-once, no second comment / manual removal respected, exemption precedence, attach/detach reversal, and the zero-write sweep — and that each names an observable assertion.

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

#### TC-EVID-001 - Read-only per-milestone declared-vs-attached evidence, undeclared report, and reported debt count

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F5-2, DM-2, DM-5, RSK-10, DoD-14, spec C-12
**Test Type(s)**: Evidence (read-only tracker reads, PM lane, recorded)
**Automation Level**: Semi-automated (declared/attached sets parsed locally; attachment read live)
**Target Layer / Location**: `chg-GH-313-milestone-evidence.md` in this change folder (plan phase 6), mirrored as a `notes:` entry of type `evidence`; read-only `gh api` paged reads; the recorded local sweep artifact `tmp/milestone-attachment-sweep.json`
**Tags**: @evidence, @tracker, @read-only, @governance

**Preconditions**:

- Plan phase 5 delivered (the declared set is the backlog's M0/M1/M2 `Ticket:` lines).
- Plan phase 6 runs in the PM lane, not by `@coder`; a read-only credential is used and no write scope is exercised.
- The local read-only sweep run may already have been executed in plan phase 4.7; its artifact is available at `tmp/milestone-attachment-sweep.json`.

**Steps**:

1. Derive the **declared** set locally: parse `backlog.md` M0, M1, and M2 sections and collect every `- Ticket: GH-<n> (milestone M<n>)` line per milestone. Record each milestone's declared count.
2. Read the **actual** attachment per declared issue with read-only, paged calls, e.g. `gh api --paginate "repos/<owner>/<repo>/milestones/<number>/issues?state=all&per_page=100"` (state `all`, so closed tickets are included) and/or `gh api repos/<owner>/<repo>/issues/<n> --jq '.milestone.title'` per issue. Record the exact commands in the evidence record so a reviewer can confirm only GET requests were issued.
3. Define and compute the metric per milestone: **declared-and-attached count = |declared ∩ attached|**; **gap list = declared − attached** (every declared ticket must be attached to the milestone its block names; the gap list is empty when green and blocks DoD-14 when not, never waived); and **total attached = declared-and-attached + attached-but-undeclared** (the second term comes from step 5). Record all three numbers for every milestone.
4. Assert the title-prefix match: the milestone title begins `M<n>:` and every attached ticket's originating story code begins `M<n>-` (report any mismatch as a named row).
5. Compute the **attached-but-undeclared** set (the second term of total attached): tickets attached to M0/M1/M2 that no backlog block declares. Reconcile the known current members by name — M1 `#219`; M2 `#268`, `#284`, `#286`, `#303` — and record a `disposition` field for every row: `declared-exception` (the milestone pack records it as a deliberate exception), `backlog-gap` (genuinely undeclared work, backlog action required), or `unknown` (PM follow-up). **This list is reported, never failing**: it never makes the evidence run non-green, never blocks DoD-14, and never implies a tracker write; it exists so undeclared attachment is visible instead of invisible and so `total attached` is an honest count.
6. Report the deliberately unattached population **by count, never reconciled**: open `change` issues with no milestone (minus exempted), recorded as a number with the query used (e.g. `gh issue list --state open --label change --search "no:milestone"`), alongside the planning-time baseline of 94 total / 53 open for context.
7. Attach the recorded live sweep evidence: the local read-only adapter run through `scripts/checks/milestone-attachment-github.ts` (its `tmp/milestone-attachment-sweep.json` artifact plus the summary numbers), **or** the first post-merge workflow sweep run cited once it occurs. Both forms are zero-write; the artifact is the only write.
8. Write the evidence record to `chg-GH-313-milestone-evidence.md`: per milestone, declared count, declared-and-attached count, total attached (declared-and-attached + attached-but-undeclared), prefix-match verdict, gap list (empty or named); the attached-but-undeclared list with dispositions; the unattached count; and the exact read commands. Mirror it as a pm-notes `notes:` entry of type `evidence` and into §10.
9. Assert zero tracker writes occurred: the command list contains no `POST`/`PATCH`/`PUT`/`DELETE`, no `-X`, no `--method` write verb, and no label/milestone/issue mutation command; the only write is the local sweep artifact. Any attachment needed to reach zero is a separate, human-confirmed PM action, not part of this test.

**Expected Outcome**:

- "Every ticket declared by M0/M1/M2 is attached, closed included" is a recorded, reproducible fact: declared-and-attached equals the declared count, the declared-minus-attached gap list is empty, and total attached is reconciled as declared-and-attached plus the reported attached-but-undeclared list with dispositions that never fails the run; the historical debt is reported as a count and left untouched.

**Notes / Clarifications**:

- The acceptance claim is **declared-and-attached** (the intersection), exactly as AC-F6-1 states. The attached-but-undeclared list is the separate second term of `total attached`; it is a reported visibility surface that cannot make the run fail. Its known members are reconciled by name so a reviewer can see M1's planning umbrella and M2's four undeclared tickets are understood, not silently ignored.
- This is verification evidence, not a permanent suite: the tracker is live data and cannot enter an offline deterministic test. Re-running the same procedure at M2 exit reproduces the claim (§22). A non-empty **declared-minus-attached** gap list blocks the DoD row rather than being waived (RSK-10, §17.1).
- No new automation is added for the evidence (NG-4/NG-9): the reads are operator-run GET commands plus the already-delivered adapter's read-only sweep.

#### TC-EVID-002 - GH-313 attached to M2; M2-S20 names it; three-surface title equality

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, AC-F4-1, DM-1, DM-3, DM-4
**Test Type(s)**: Evidence (read-only tracker read + cross-surface comparison)
**Automation Level**: Semi-automated
**Target Layer / Location**: this change's tracker record + spec + pm-notes + backlog; read-only `gh api`/`gh issue view`; recorded in `chg-GH-313-milestone-evidence.md` and mirrored to pm-notes
**Tags**: @evidence, @tracker, @read-only

**Preconditions**:

- GH-313's artifact phases are complete; the backlog M2-S20 block names it (TC-PLAN-001).

**Steps**:

1. Read GH-313 (GET only): assert its milestone title is the M2 milestone title and that the title begins `M2:`.
2. Assert the read title equals the spec's `change.milestone` and the pm-notes `milestone` (the local comparison is TC-TPL-003; this step closes the third surface).
3. Assert the backlog M2-S20 block's `- Ticket: GH-313 (milestone M2)` line names the same ticket and milestone prefix.
4. Assert the issue state is `OPEN` at the delivery gate (delivery stops at PR creation; closing is a later human/merge action) and record the state rather than asserting a transition.
5. Record the three values and the query in `chg-GH-313-milestone-evidence.md`, §10, and pm-notes; assert no write occurred (GET-only command list).

**Expected Outcome**:

- The join key is consistent across tracker, spec, pm-notes, and backlog; the change's own ticket is inside its milestone.

#### TC-SCOPE-001 - Changed-scope conformance: no tickets, no milestones, no mass edits, no new install-set surface, no lifecycle change, no pre-flipped current truth

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-2, AC-F1-1, AC-NFR4-1, NG-1…NG-10, spec C-6, spec C-10, spec C-11, PDR C-3, PDR C-6, DEC-12
**Test Type(s)**: Manual (review-time changed-file and repository-setting inspection)
**Automation Level**: Manual
**Target Layer / Location**: PR changed-file list against `main-tools` and the read-only repository settings for `main-tools`, at each delivery phase's gate and at `review_fix`
**Tags**: @manual, @review, @governance

**Preconditions**:

- The change branch's commits are staged per phase; the six plan phases are known.

**Steps**:

1. List the change's files (`git diff --name-only <base>...HEAD`) at the delivered HEAD.
2. Assert the delivered file set is inside the declared scope (spec §7.1 and Appendix B rows 1–24, plus this change's artifacts). The **allowed** changed-file set is:
   - the new guide (row 1) and the documentation index row (row 2);
   - the change-spec template (row 3);
   - the three prompts (rows 5–7), the regenerated plugin output (row 8), and the project tracker instructions (row 9);
   - PDR-0005 (row 24) and the decision register row `doc/decisions/00-index.md`;
   - the workflow (row 10), the three check modules (row 11), and the check suites/fixtures (rows 12–16, including the guide, artifacts, prompts, and planning-truth suites);
   - **all seven plan-phase-5 files**: `backlog.md`, `backlog-ranking.md`, `milestones/m2/README.md` (including the pack-contents range line), `milestones/m2/test-scenarios.md`, `status.md`, `tests/checks/planning-truth.test.ts`, and `tests/fixtures/milestone-attachment/planning/section-headings.json`;
   - the milestone pack index (row 19, plan phase 1);
   - `chg-GH-313-milestone-evidence.md` and the change-folder artifacts (spec, plan, test plan, pm-notes);
   - `<change_folder>/readiness-review/**` — the Definition-of-Readiness review evidence under `doc/changes/2026-11/2026-11-14--GH-313--milestone-first-planning/readiness-review/**`.
   Any other path requires a recorded reason in the plan.
3. Assert the forbidden areas are untouched: no `packages/**` change; no `.opencode/command/**` change; no install-set or shell-script change (`scripts/install.sh`, `scripts/uninstall.sh`, `ADOS_DELIVERY_SCRIPTS`); no existing check or delivery script modified outside the three new modules; no phase-set or lifecycle-gate change; no `gh`/`glab` write automation added; no roadmap `MS-<NNNN>` identifiers or allocation matrix (spec C-10).
4. Assert no other template gained or lost a field (AC-F4-2, spec C-6), and that the five excluded templates are byte-unchanged in their front matter: `implementation-plan-template.md`, `test-plan-template.md`, `feature-spec-template.md`, `roadmap-engineering-template.md`, `decision-record-template.md`.
5. Assert the guide-change boundary: the only delivery-phase guide change is the new `doc/guides/milestone-management.md` (row 1). No existing guide is edited in the delivery diff. The only existing guides this change may ever touch are the phase-7 rows 25–31 — `doc/guides/autonomous-batch-delivery.md` (row 30) and `doc/guides/change-lifecycle.md` (row 31) — and those land in `system_spec_update`, never in a delivery phase. Likewise no `doc/spec/**` behavioural flip appears in the delivery diff; phase-7 rows 25–31 are the only permitted current-truth surfaces, after delivery.
6. Assert no ticket or milestone creation and no mass edit occurred: the tracker record for this change shows only the change's own lifecycle reads/writes; the 94 pre-existing unattached issues keep their labels and comments (spot-check that no historical issue has `needs-milestone`; report the count of pre-existing flags found, which must be 0). PDR C-3.
7. **Repository-setting evidence for "never blocks delivery" (PDR C-6)**: inspect read-only whether the new workflow is configured as a required status check on `main-tools` (branch protection/ruleset read, e.g. a GET of the branch protection or the repository ruleset). It must **not** be required. Confirm no delivery entry script (`deliver-ticket.sh`, `ceo-loop.sh`, `batch-deliver.sh`) gained a refusal for an unattached ticket, and that the workflow is not in any required-check list. Record the observation (setting name, read command, verdict) in §10 and the evidence note. This assertion is intentionally not made in the workflow YAML suite: required-status configuration is not expressible in the workflow file.
8. Record the verdict in §10 and pm-notes; a violation reopens the owning phase (DoD framing).

**Expected Outcome**:

- The delivered diff stays inside the declared scope, every exclusion of §7.2 holds as an observable fact, existing guides change only in the permitted phase-7 rows, and the "never blocks delivery" posture is evidenced from repository settings rather than asserted from YAML.

**Notes / Clarifications**:

- Review-time by design (testing strategy forbids permanent suites asserting a moving-base diff). This TC is also AC-F5-1's "no other block reordered" verification and AC-F4-2's "unchanged templates" verification.
- Appendix B row 34's "`scripts/**` UNCHANGED" is read as "no distributable/install-set script changed"; the new modules are row 11's declared repository-internal surface (plan TP-Q1 pin). A reviewer who reads row 34 literally would reject the new module — the scope review must use the row 11 reading.
- Constraint namespaces: spec Appendix E C-6 is "exactly one template gains the field"; PDR C-6 is "enforcement never blocks delivery". Step 4 asserts the former; step 7 asserts the latter.

## 6. Environments and Test Data

- **Environment:** local development only (`pnpm` + Bun workspace, Bun 1.4.4 per `.bun-version`); no staging, no live tracker, no network. The gate convention is `TMPDIR=$PWD/tmp/tmpdir pnpm check`; suites isolate any temp output under that base or `mkdtemp` and never read `$HOME`. The pinned sweep artifact is `tmp/milestone-attachment-sweep.json` (gitignored by the repository's `tmp/` rule); suites substitute an isolated temp path and never write the repository copy during tests. TC-GUIDE-001 builds a throwaway git repository under the temp base and runs only local `git`/`bash` commands against it.
- **Test data — contract-v1 input drivers** (committed fixtures, never named `*.test.ts`), pinned home `tests/fixtures/milestone-attachment/events/` (plan phase 4). Each fixture supplies the event payload; the runner normalizes it together with the seeded tracker reads into the seven contract inputs (`action`, state, `change`, exemption, milestone, flag, `markerCommentPresent`):

  | Fixture | Action / state / labels / milestone | Contract case |
  |---|---|---|
  | `issue-opened--change--no-milestone.json` | opened, open, `change`, no milestone, no flag, no marker | rule 4a (flag + comment) |
  | `issue-opened--change--no-milestone--marker-present.json` | opened, flag absent, marker present | rule 4a (flag only, no second comment) |
  | `issue-opened--change--no-milestone--flag-present.json` | opened, flag present, marker present | rule 4b (zero writes) |
  | `issue-opened--change--with-milestone.json` | opened, milestone present, no flag | rule 3 (compliant, nothing to remove) |
  | `issue-opened--change--exempt.json` | opened, `backlog-capture`, no milestone | rule 2 (exempt) |
  | `issue-opened--change--exempt--milestone-flag.json` | opened, exempt + milestone + flag | rule 2 precedence over 3/4 |
  | `issue-edited--change--no-milestone.json` | edited, no flag, no marker (pre-existing unattached) | rule 4f (zero writes) |
  | `issue-edited--change--no-milestone--flag-present.json` | edited, flag present, marker present | rule 4d (zero writes) |
  | `issue-edited--change--no-milestone--flag-removed.json` | edited, flag absent, marker present (human removed flag) | rule 4e (zero writes; never re-applied) |
  | `issue-labeled--change--no-milestone.json` | labeled, no flag, no marker | rule 4f |
  | `issue-labeled--change--no-milestone--flag-present.json` | labeled, flag present, no marker | rule 4d |
  | `issue-unlabeled--change--no-milestone.json` | unlabeled, no flag, no marker | rule 4f |
  | `issue-reopened--change--no-milestone.json` | reopened, no flag, no marker | rule 4f |
  | `issue-milestoned--change.json` | milestoned, milestone present, flag present | rule 3 (remove flag) |
  | `issue-milestoned--change--no-flag.json` | milestoned, milestone present, flag absent | rule 3 (no spurious removal) |
  | `issue-demilestoned--change.json` | demilestoned, no milestone, flag absent, marker present | rule 4c (restored) |
  | `issue-demilestoned--change--flag-present.json` | demilestoned, flag already present, marker present | rule 4c (zero writes) |
  | `issue-demilestoned--change--no-marker.json` | demilestoned, flag absent, no marker | rule 4f (not restored) |
  | `issue-opened--change--closed.json` | closed, `change`, no milestone | rule 1 (out-of-scope) |
  | `issue-opened--non-change.json` | open, `bug`, no milestone | rule 1 (out-of-scope) |
  | `workflow-dispatch--sweep.json` | dispatch payload with `inputs.mode: sweep` | sweep entry |

- **Test data — tracker seeds and comments** (`tests/fixtures/milestone-attachment/tracker/`): `milestones-m0-m1-m2.json` (numbers, titles, states); `comments--with-marker.json` (prior check comment, so `markerCommentPresent` is true), `comments--without-marker.json`, `comments--unrelated.json` (a human comment that must never be treated as the marker). Flag presence is seeded through the issue labels in the event fixtures, so the port can construct every `flag × marker` pair without a separate flag fixture.
- **Test data — sweep populations** (`tests/fixtures/milestone-attachment/sweep/`): `issues-n250-page-{1,2,3}.json` (100/100/50) and `issues-n500-page-{1..5}.json` (100×5), each page a mixed population (unattached open `change`, exempt, milestoned, closed, non-`change`); `expected-summary-shape.json` (field names/types only — never values, so the fixture cannot rot into a tautology). The production artifact path `tmp/milestone-attachment-sweep.json` is asserted as the declared output, with tests writing to a substitution path.
- **Test data — adversarial inputs for NFR-7** (`tests/fixtures/milestone-attachment/adversarial/`): `issue-text-injection.json` (title/body/author login containing `${{ secrets.TOKEN }}`, `<!-- needs-milestone -->`, backticks, a body line starting `## `, `</script>`, ANSI escapes) and `issue-log-forging.json` (embedded newlines and `\r`, zero-width joiners, a bidi override, a 10 000-character body). The suite extracts a token list from each fixture and asserts none appears in the comment body or the run-summary projection (non-vacuous).
- **Test data — planning expectations** (`tests/fixtures/milestone-attachment/planning/section-headings.json`): the committed heading inventory per backlog section, regenerated deliberately when a story is authored; it is the tree-invariant substitute for asserting "no other story was reordered".
- **Test data — the planning corpus itself** is the system under test for TC-PLAN-*: the live `backlog.md`, `backlog-ranking.md`, `milestones/README.md`, `milestones/m2/README.md`, `milestones/m2/test-scenarios.md`, and `status.md` are parsed, never copied into fixtures (a copy would let the corpus drift while the fixture stays green).
- **Test data — live evidence (not fixtures, not in the gate):** the evidence record `chg-GH-313-milestone-evidence.md` and the sweep artifact `tmp/milestone-attachment-sweep.json` are produced by the read-only runs (TC-EVID-001/002, TC-SWEEP-001 note). They are recorded as evidence, never read by a `bun test` suite as a source of truth for a tracker claim.
- **Isolation:** every integration case builds its own port state in memory and its own `mkdtemp` output directory; no case depends on ordering; no real clock, no sleeps, no `$HOME`, no network (`fetch` is never stubbed because nothing calls it).
- **Goldens:** the plan reserves `tests/fixtures/milestone-attachment/golden/` for a committed static-comment fixture. The primary assertion is cross-case byte equality (a stronger, self-maintaining assertion); if a golden is committed at `golden/comment-body.md`, it is regenerated only by an explicit command with a reviewed diff.

## 7. Automation Plan and Implementation Mapping

Homes below are the plan-pinned paths (phases 1–6). The assertion contracts bind to those paths. Iterate with `bun test <path>`; finish with TC-QG-001.

### 7.1 Test artifacts and execution commands

| TC ID(s) | Test artifact (pinned) | Execution command | Mocking / fixtures | Status |
|----------|--------------------------|-------------------|--------------------|--------|
| TC-GUIDE-001, TC-GUIDE-002, TC-GUIDE-003, TC-GUIDE-004 | `tests/checks/milestone-guide.test.ts` | `bun test tests/checks/milestone-guide.test.ts` | File/table parsing (`yaml`, markdown slices); TC-GUIDE-001 builds a throwaway git repo and runs `scripts/add-header-location.sh` on the single file | To Implement |
| TC-GUIDE-005 | Guard scripts, repository root | `bash scripts/.tests/test-doc-distribution.sh && bash scripts/.tests/test-doc-distribution-modes.sh` | None; sandbox install run inside the guard | Existing — run, no new code |
| TC-TPL-001, TC-TPL-003, TC-TPL-004 | `tests/checks/milestone-artifacts.test.ts` | `bun test tests/checks/milestone-artifacts.test.ts` | `yaml` parse of template/spec/pm-notes front matter | To Implement (plan phase 2) |
| TC-PROMPT-001, TC-PROMPT-002, TC-PROMPT-003, TC-PROMPT-004, TC-TPL-002, TC-PLUGIN-001 | `tests/checks/milestone-prompts.test.ts` + `scripts/build-claude-plugin.sh` | `bun test tests/checks/milestone-prompts.test.ts`; `./scripts/build-claude-plugin.sh && git status --porcelain .ados-claude/`; `bun run scripts/checks/prompt-conformance.ts` | None; generated files read as data | To Implement + evidence run (plan phase 3) |
| TC-CHK-001, TC-CHK-006 | `tests/checks/milestone-attachment.test.ts` | `bun test tests/checks/milestone-attachment.test.ts` | Pure core; contract-v1 case table; adversarial fixtures; no port | To Implement |
| TC-CHK-002, TC-CHK-003, TC-CHK-004, TC-CHK-005 | `tests/checks/milestone-attachment-integration.test.ts` | `bun test tests/checks/milestone-attachment-integration.test.ts` | Injected in-memory tracker port; event fixtures | To Implement |
| TC-SWEEP-001, TC-SWEEP-002 | `tests/checks/milestone-sweep.test.ts` | `bun test tests/checks/milestone-sweep.test.ts` | Paged fixtures; temp output directory substituting `tmp/milestone-attachment-sweep.json`; call-count recorder | To Implement |
| TC-WF-001, TC-WF-002, TC-WF-003 | `tests/checks/milestone-workflow.test.ts` | `bun test tests/checks/milestone-workflow.test.ts` | `yaml` parse + mutated temp copies (pattern: `tests/checks/ci-checks.test.ts`) | To Implement |
| TC-GATE-001 | `tests/checks/milestone-gate.test.ts` | `bun test tests/checks/milestone-gate.test.ts` | Manifest parse + source import scan | To Implement |
| TC-PLAN-001, TC-PLAN-002, TC-PLAN-003, TC-PLAN-004, TC-PLAN-005 | `tests/checks/planning-truth.test.ts` | `bun test tests/checks/planning-truth.test.ts` | Live planning files parsed as data; heading expectation fixture | To Implement |
| TC-QG-001 | Repository root | `TMPDIR=$PWD/tmp/tmpdir pnpm check`; `./scripts/lint-commit-range.sh --base main-tools` | None | Existing gate — run, no new code |
| TC-EVID-001, TC-EVID-002 | `chg-GH-313-milestone-evidence.md` + pm-notes `notes:` | `gh api --paginate …` (GET only; exact commands recorded in the evidence note); optional local read-only sweep via `scripts/checks/milestone-attachment-github.ts` | Live tracker read-only; the pinned sweep artifact `tmp/milestone-attachment-sweep.json` | Evidence runs (PM lane, plan phase 6) |
| TC-SCOPE-001 | Review checklist | `git diff --name-only <base>...HEAD` at each delivery phase gate | None | Manual Only |

### 7.2 Gate battery per level and expected evidence

| Level | Command | Expected evidence |
|---|---|---|
| Unit | `bun test tests/checks/milestone-attachment.test.ts` | Green; contract-v1 ordered rules 1, 2, 3, 4a–4f and all four write verbs (`addFlag`, `removeFlag`, `postMarkerComment`, `writeJobSummary`) enumerated in the test output |
| Contract/static | `bun test tests/checks/milestone-guide.test.ts tests/checks/milestone-artifacts.test.ts tests/checks/milestone-prompts.test.ts tests/checks/milestone-workflow.test.ts tests/checks/milestone-gate.test.ts tests/checks/planning-truth.test.ts` | Green; each negative case fails on a mutated temporary copy (TC-WF-003 pattern) |
| Integration | `bun test tests/checks/milestone-attachment-integration.test.ts tests/checks/milestone-sweep.test.ts` | Green; recorded call lists prove zero unexpected writes and the read bound |
| Distribution | `bash scripts/.tests/test-doc-distribution.sh` + `…-modes.sh` | Exit 0 both; install set includes the guide; five failure modes still fire |
| Plugin freshness | `./scripts/build-claude-plugin.sh`; `git status --porcelain .ados-claude/` | No output from `git status`; CI `verify-claude-build` green |
| Prompt/help conformance | `bun run scripts/checks/prompt-conformance.ts`; `bun run scripts/checks/help-guide-coverage.ts` | Exit 0 both |
| Commit history | `./scripts/lint-commit-range.sh --base main-tools` | `PASS` |
| Aggregate | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Exit 0; the eight chained steps named |
| Read-only tracker evidence | Paged GET reads per TC-EVID-001/002; local read-only sweep run through `scripts/checks/milestone-attachment-github.ts`, **or** the first post-merge workflow sweep run cited once it occurs | `chg-GH-313-milestone-evidence.md` with per-milestone declared-and-attached counts, total attached (declared-and-attached + attached-but-undeclared), empty-or-reported gap list, attached-but-undeclared dispositions, unattached count, and a GET-only command list |

### 7.3 How the plan's phases consume this test plan

| Plan phase (`chg-GH-313-plan.yaml`) | Test groups consumed | Exit evidence for that phase |
|---|---|---|
| Phase 1 — guide, pack-conventions pointer, index row, PDR-0005 landing | TC-GUIDE-001…005 (+ TC-SCOPE-001 partial for the guide boundary) | `bun test tests/checks/milestone-guide.test.ts` green including the byte-identical header comparison; both distribution guard scripts; index-link and PDR-register assertions |
| Phase 2 — change-spec template | TC-TPL-001, TC-TPL-003, TC-TPL-004 (+ TC-SCOPE-001 for other-template absence) | `bun test tests/checks/milestone-artifacts.test.ts` green (the suite contains only phase-2 assertions) |
| Phase 3 — prompts, tracker instructions, regenerated plugin | TC-PROMPT-001…004, TC-TPL-002, TC-PLUGIN-001 | `bun test tests/checks/milestone-prompts.test.ts` green; `build-claude-plugin.sh` + clean `git status`; `check:prompt`/`check:help` |
| Phase 4 — core, runner, GitHub adapter, workflow, five check suites | TC-CHK-001…006, TC-SWEEP-001/002, TC-WF-001…003, TC-GATE-001 | The three check suites green; `ci-supply-chain`/`ci-bindingness`/`ci-topology` green unchanged; gate-chain assertion green; one recorded local read-only sweep run (§10) |
| Phase 5 — planning-truth repair (seven phase-5 files) | TC-PLAN-001…005 (+ TC-SCOPE-001 for reorder absence and the guide boundary) | `bun test tests/checks/planning-truth.test.ts` green |
| Phase 6 — PM-lane read-only M0/M1/M2 evidence | TC-EVID-001…002 | `chg-GH-313-milestone-evidence.md` with per-milestone counts, gap list, undeclared dispositions, debt count; pm-notes `notes:` entry |
| Lifecycle phase 7 (`system_spec_update`) | No TC — out of scope (§1.2) | Only Appendix B rows 25–31 may change, after delivery |
| Lifecycle phases 9–10 (`quality_gates`/`dod_check`) | TC-QG-001 + every suite re-run | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green, `lint-commit-range.sh --base main-tools` PASS, pm-notes entries |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **Fixture drift masquerading as coverage (RSK-4).** GitHub event payloads change shape; a hand-written fixture can encode a shape the workflow never receives. Mitigation: fixtures are copied from real event payloads at authoring, the core takes the normalized seven-field contract input (not the raw payload), and the adapter normalizes — so a payload-shape change fails loudly at the adapter, not silently in the core.
- **Contract drift across artifacts (RSK-4).** The canonical contract v1 is being written into the spec, PDR, plan, core, and this plan in parallel; a one-line divergence (an extra rule branch, a different precedence, a fifth write verb) would silently redefine the check. Mitigation: TC-CHK-001 pins the ordered table as the oracle and fails on any divergence, TC-WF-001 pins the action set and the summary write, and §1.2 requires a revision before the DoR gate if an artifact lands differently.
- **Tautological data assertions.** Deriving the expected ticket-line count from the same file it asserts would prove nothing. Mitigation: assertions compare two independent surfaces (blocks vs lines, backlog vs ranking, pack citations vs seed headings) and never hardcode the growing counts (19/77 are evidence metrics, not assertions).
- **Golden over-pinning of the comment body.** A committed golden could be "refreshed" into legitimizing an interpolated body. Mitigation: the primary assertion is cross-case byte equality plus a token-leakage list; the golden is optional and regenerated only with a reviewed diff.
- **Workflow security assertions live outside the scanners (TP-Q2, resolved).** `ci-supply-chain.ts`/`ci-bindingness.ts` read only `ci.yml`/`ts-` jobs and stay unchanged by plan pin. Mitigation: the dedicated suite owns the new file's permissions, pins, secret absence, and bypass absence; TC-WF-003's mutation matrix proves each assertion fires, and a meta-assertion pins the scanned-file set so a rename cannot drop coverage.
- **Evidence latency and human dependency (RSK-10).** TC-EVID-001 depends on live reads and, in principle, on a human-confirmed attachment write if a declared ticket is unattached. Mitigation: the evidence is produced at the end of delivery (plan phase 6), the declared-minus-attached gap list is a blocking DoD row, and the procedure is reproducible at M2 exit.
- **Network creep into the gate.** A future contributor may wire the sweep into `pnpm check` for convenience. Mitigation: TC-GATE-001 asserts the chain, the absence of milestone tokens, and the absence of network-capable imports; the assertion names the offending field.
- **Prompt edits weakening existing rules (spec C-8).** An edit that rewrites the no-autonomous-ticket or untrusted-comment rule while adding the milestone rule would pass a naive "milestone present" check. Mitigation: TC-PROMPT-001 step 6 asserts the preserved rules explicitly, and TC-PLUGIN-001 re-runs prompt conformance.
- **Undeclared attachment becomes invisible or is mistaken for failure.** The attached-but-undeclared population (M1 #219; M2 #268, #284, #286, #303 today) is real and grows when a ticket is attached without a backlog block. Mitigation: TC-EVID-001 reports it as a separate list with a `disposition` field and explicitly never fails the run; only declared-minus-attached blocks. A growing list with `unknown` dispositions is a signal for a follow-up planning-truth repair, not a gate failure.
- **Header test fragility.** TC-GUIDE-001 depends on the header script's repo-root resolution and the `GITHUB_BRANCH` default. Mitigation: the throwaway repository reproduces the production relative path and the script is invoked with the default branch; a script-contract change surfaces as a test failure in the same change that changes the script (the suite pins the composition lines explicitly in addition to the byte comparison).

### 8.2 Assumptions

- The delivered machinery named in §2 is stable through this change: the marker-derived install set, the header script's output shape, the plugin build script, the `NAMED_CHECKS` order, and the `tests/checks` + `bun test` discovery pattern.
- GitHub Issues supplies `issues` events including `milestoned`/`demilestoned`, and an `issues: write` token can add/remove a label and create a comment without broader scopes.
- The canonical contract v1 (§2) is the decision-table oracle for this revision. The spec's Appendix C table, the PDR's enforcement wording, and the plan's phase-4 obligations are being aligned to the same contract in parallel; TC-CHK-001 fails if any artifact diverges.
- The runner writes exactly one job summary per run to the inherited `$GITHUB_STEP_SUMMARY`; tests inject a summary sink and assert its content without touching the real file.
- The three pinned modules (`scripts/checks/milestone-attachment.ts`, `-runner.ts`, `-github.ts`) are implemented where `tests/checks/**` can import them directly, exactly as existing `scripts/checks/*.ts` are consumed today; no build step is needed for the core or runner.
- "Zero tracker calls inside the gate" is established by construction (no network-capable import on any chain-reachable path) plus the manifest and import assertions — the plan does not add packet-level interception, and the test states that limit honestly.
- The planning corpus is repaired before the data assertions run (phase order: planning truth before the final gate), so the assertions are green at the delivered HEAD and remain true afterwards.
- The evidence runs use a read-only token; no test, fixture, or suite performs a tracker write.

### 8.3 Questions and Resolutions (none open)

All six questions raised in revision 1.0 are resolved. The resolutions below are binding pins: the affected test steps assert them, and no "open" status remains.

| ID | Question | Resolution | Source |
|----|----------|------------|--------|
| TP-Q1 | Where does the evaluation core live, and how does that reconcile with the `scripts/**` row? | **Resolved.** The core is `scripts/checks/milestone-attachment.ts`, the orchestration is `scripts/checks/milestone-attachment-runner.ts`, and the sole network-capable adapter is `scripts/checks/milestone-attachment-github.ts`. Appendix B row 34's "`scripts/**` UNCHANGED" means "no distributable/install-set script changed"; the three modules are repository-internal, outside `ADOS_DELIVERY_SCRIPTS`, and outside the aggregate chain. TC-CHK-001/TC-GATE-001 assert these paths; TC-SCOPE-001 uses the row-11 reading. | Plan TP-Q1; spec Appendix B rows 11, 34 |
| TP-Q2 | Do the existing invariant scanners gain the new workflow file, or does the dedicated suite own it? | **Resolved.** The scanners (`ci-supply-chain.ts`, `ci-bindingness.ts`, `ci-topology.ts`) stay unchanged and scope to `ci.yml`/`ts-` jobs. The dedicated suite `tests/checks/milestone-workflow.test.ts` plus its mutation proof owns the new file's permissions, SHA pins, secret absence, and bypass-construct absence, and pins the scanned-file set. Asserted by TC-WF-002/TC-WF-003. | Plan TP-Q2; spec Appendix C "Workflow audit scope" |
| TP-Q3 | Does the header clause mean the header is absent, or script-generated? | **Resolved by the spec.** AC-F1-1, NFR-4, and AC-NFR4-1 now require exactly one header, generated by `scripts/add-header-location.sh` and byte-identical to that script's output. TC-GUIDE-001 asserts it unconditionally and byte-for-byte; a missing header fails. | Spec §17 AC-F1-1/NFR-4/AC-NFR4-1; plan 1.5 |
| TP-Q4 | Is "0 duplicate label applications" observable at the tracker or at the check? | **Resolved by the spec.** NFR-1 and AC-NFR1-1 now state the action-layer claim: 0 add-label actions on repeat evaluation, ≤1 comment in total, identical observable state. TC-CHK-003 asserts the recorded call list. | Spec §9 NFR-1; §17 AC-NFR1-1 |
| TP-Q5 | Where is the tracker evidence record stored? | **Resolved.** `chg-GH-313-milestone-evidence.md` in this change folder, mirrored as a pm-notes `notes:` entry of type `evidence`. TC-EVID-001/002 write and cite that home. | Plan TP-Q5, phase 6 |
| TP-Q6 | Is "each topic exactly once" mechanically decidable? | **Resolved as semi-automated.** Heading/keyword counts are asserted; substantive non-duplication is a recorded content review (TC-GUIDE-002 step 7). No spec change requested. | Test plan |

**Reconciliation rule:** a future divergence from any pinned value above (path, artifact, wording, or suite home) requires a new revision-log row and updates to the affected TCs before the DoR gate passes — never silent drift.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | test-plan-writer (DeepSeek V4.1 Flash) | Initial test plan: 35 TCs in 12 families covering all 30 §17 ACs (AC-F1-1…AC-NFR7-1), DoD-1…DoD-21 (DoD-19 roll-up, DoD-21 lifecycle evidence), EVT-1…4, DM-1…5, NFR-1…7, the five inherited seeds `SC-M2-S20-01…05` by name, Appendix E constraints C-1…C-12, a fixtures catalog (11 event payloads, tracker seeds, 250/500-issue sweep populations, two adversarial NFR-7 inputs, planning heading expectations), data assertions over backlog/ranking/pack/status, and the read-only M0/M1/M2 evidence procedure. Six test-plan questions raised (TP-Q1 core location vs the then-current scripts row; TP-Q2 workflow coverage by the invariant battery; TP-Q3 header wording; TP-Q4 duplicate-label observability; TP-Q5 evidence home; TP-Q6 "exactly once" decidability — the last resolved here) |
| 1.1 | 2026-11-14 | test-plan-writer (DeepSeek V4.1 Flash) | **DoR remediation; spec, plan, and PDR-0005 reconciliation.** (1) All six TP-Q items closed in §8.3 (TP-Q1/Q2/Q5 by plan pins; TP-Q3/Q4 by the remediated spec wording); §2 plan bullet rewritten with the phase-by-phase pins and the pending-plan placeholder removed; §9 row added. (2) **TC-EVID-001** remodelled on declared-vs-attached only: the gap list is declared-minus-attached; a separate attached-but-undeclared list with a `disposition` field (`declared-exception` / `backlog-gap` / `unknown`) reconciles the known members (M1 #219; M2 #268, #284, #286, #303) and never fails the run. (3) **TC-GUIDE-001** asserts the script-generated header unconditionally and byte-for-byte against `scripts/add-header-location.sh` output on the single file, with the corrected two-`#`-line + `source:` composition; a missing header fails. (4) Stale paths corrected: pack-index link `../../../guides/milestone-management.md`; engineering template `roadmap-engineering-template.md`. (5) **TC-TPL-002** moved from the artifacts suite to the prompts suite; §7.1/§7.3 phase mapping updated (phase 2 = TPL-001/003/004; phase 3 = prompts + TPL-002 + PLUGIN-001). (6) **TC-SCOPE-001** allowed set expanded (PDR + register, the seven phase-5 files, the new guide); the existing-guide assertion scoped to phase-7 rows 25–31; the "not a required check" assertion moved from TC-WF-002 into manual repository-setting evidence; constraint citations namespaced (`spec C-n` vs `PDR C-n`) with the C-4/C-6 mismatches corrected. (7) Every Appendix B reference updated to rows 1–34 / 25–31 / 34. (8) Live-evidence text updated to the accepted model (recorded local read-only adapter run with zero tracker writes, or the first post-merge workflow run). Also propagated: TC-CHK-001/GATE-001 pinned module paths; TC-SWEEP-001/002 pinned artifact `tmp/milestone-attachment-sweep.json`; TC-WF-003 scanner-unchanged pin; TC-QG-001/TC-PLAN-* citation and boundary fixes. Coverage unchanged at 30/30 ACs, 35 TCs, no orphans |
| 1.2 | 2026-11-14 | test-plan-writer (DeepSeek V4.1 Flash) | Canonical contract v1 implemented: ordered first-match table in TC-CHK-001 (rules 1/2/3/4a–4f, 20 rows, every write verb incl. `writeJobSummary`), manual-removal respect and marker-gated comment in TC-CHK-002/003, exemption precedence and marker-gated restore in TC-CHK-004/005, fixed marker text in TC-CHK-006, job-summary assertion in TC-WF-001, declared-and-attached metric in TC-EVID-001, baseline-set comparison in TC-PLAN-001, all-five-seed resolution in TC-PLAN-004, readiness-review allowance in TC-SCOPE-001, exact PDR link in TC-GUIDE-001, and backlog-source wording in TC-PROMPT-001; §4/§6/§7/§8 propagated. Coverage unchanged at 30/30 ACs, 35 TCs, no orphans |

**Reconciliation rule:** see §8.3.

## 10. Test Execution Log

Populated during delivery (phases 6/9/10). Evidence runs and review-time items are logged here and mirrored into phase pm-notes `notes:` entries per DoD conventions.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| Full suite (all 35 TCs) | 2026-11-15 | PASS (with one recorded environment race) | `bun test`: 8305 pass / 4 skip / 1 fail. The single failure is TC-EXIT-002 (`exit-code-literals`, live-tree clean) and TC-PRIVACY-020 in an earlier run of the same class: another suite in the same parallel run checks out branches and regenerates `.ados-claude`, so the worktree is transiently dirty. Both pass in isolation (`exit-code-literals` 15/15, `privacy-literals` 39/39). Pre-existing suite-wide race, not a GH-313 defect. |
| MILESTONE / PLANNING suites | 2026-11-15 | PASS | Ten suites — `milestone-guide`, `milestone-prompts`, `milestone-artifacts`, `milestone-workflow`, `milestone-gate`, `milestone-attachment`, `milestone-attachment-integration`, `milestone-sweep`, `planning-truth`, `ci-checks`: green at HEAD. |
| TC-QG-001 (forbidden literals) | 2026-11-15 | PASS | `bun run scripts/checks/forbidden-literals.ts`: 5/5 scope classes checked, 0 violations. |
| TC-GUIDE-005 (distribution guard) | 2026-11-15 | PASS | `bash scripts/.tests/test-doc-distribution.sh`: green. |
| TC-PROMPT-001…004 (prompt/help conformance) | 2026-11-15 | PASS | `prompt-conformance` and `help-guide-coverage` checks green. |
| TC-QG-001 (commit history) | 2026-11-15 | PASS | `./scripts/lint-commit-range.sh --base main-tools`: PASS. |
