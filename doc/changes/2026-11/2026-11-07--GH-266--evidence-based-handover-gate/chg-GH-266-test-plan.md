---
id: chg-GH-266-test-plan
status: Updated
version: 1.3
created: 2026-11-07T00:00:00Z
last_updated: 2026-11-08T00:00:00Z
owners: [engineering]
service: delivery-os-planning
labels: [change, docs]
version_impact: none
summary: "Docs-only verification of the M1-S9 handover-gate amendment, aligned to spec v1.3. Prove by direct inspection of the diff and the two amended planning files that `clean` is the conjunction of pilot-path truth, eleven-class TDR-0005 coverage on real tickets, the exposure floor, and corroboration; that the superseded rolling two-week window no longer defines the gate while every historical statement stays byte-exact under comparison with no whitespace normalisation (the 2026-11-03 bullets, the M0 exit-criteria lead-in, and the pilot, adoption and decision-acceptance bullets); that every `backlog.md` diff hunk lies inside the M1-S9 entry and every other story's `- AC:`/`- Depends on:` block is byte-identical, and that the five M1-S9 prose regions the spec freezes (Goal, Ticket, phase (a), handover-flips, covers-functions) are byte-identical with two mutants proving the oracle fires (TC-GATE-022); that the eleven enumerated classes are set-equal to `DELIVERY_RESULT_TOKENS` (including `pr-open-unverified`, DEC-3); that the corroboration rule names exactly pm-notes phases, tracker state, and CI on the pushed head in both files; that the amendment adjudicates the dated 2026-11-03 per-engine sentence as the same gate superseded not waived, says the gate is no longer defined by a calendar window alone with the floor-only `whichever comes first` retained, and cites `CEO-D-073 (GH-266, 2026-11-07)`; that the diff is exactly two product files outside `doc/changes/**` under `doc/planning/oss-tooling/` with unchanged `backlog.md` frontmatter, no `ados_distribution` marker, unchanged M1-S9 heading, and no source/test/spec change; and that the doc-distribution, forbidden-literals and link guards stay green, with a direct added-line seed-literal scan compensating for the guard's registered-doc-only scan set. No test code, suite, or runtime harness is added: 22 TCs are reproducible inspection procedures with recorded commands and observed expected values, plus three honestly declared gaps. Revision 1.1 closed readiness-review iteration 1 findings 2, 4 and 5; revision 1.2 closes iteration 2 findings N1 (hunk-boundary precision), N2 (byte identity of the two forward-looking status statements plus the pointer-shape rule), N4 (M1-S9 inside-entry preservation oracle) and N6 (wrap-proof lead-in negative control), and was aligned to the then-current spec v1.2 (AC-F1-3 five-region freeze, DEC-12) through TC-GATE-022. Revision 1.3 is a precision pass: the P15 boundary self-tests now derive their coordinates from the computed entry end (so the next-heading probe is correct at any amended length, readiness N8) and the far probe is `end+50` rather than a fixed line (N14), and the AC-F1-3 forward row now also traces TC-GATE-005 for the heading clause it names (N9). It also aligns the plan to spec v1.3: the narrowed editable-prose claim in AC-F1-3/F-5/DEC-12, the `calendar-only window` wording in F-2/AC-F2-4/DEC-10, and AC-F2-2's byte-retention clause, which TC-GATE-007 already verifies."
links:
  change_spec: ./chg-GH-266-spec.md
  implementation_plan: ./chg-GH-266-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Amend the M1-S9 handover gate to an evidence-based clean bar

## 1. Scope and Objectives

This change moves one sentence of planning truth: the M1-S9 per-repository handover gate stops being a rolling two-week calendar window and becomes a conjunction of four conditions — pilot-path truth, total TDR-0005 class coverage on real tickets, a minimum exposure floor, and corroboration against non-engine evidence. Nothing executes at runtime, so the risk this plan must control is *documentary*: the gate could be weakened in prose (floor read as an alternative to class coverage, or "success" accepted from the engine's own token), the enumeration could silently inherit the ticket's ten-token list, or the amendment could drift into another story's acceptance criteria or rewrite dated history that must stay as recorded. Each of those is a defect a reviewer must be able to see, not infer, which is why every acceptance criterion is bound here to an explicit command with an expected output rather than to a reading impression. Revision 1.1 made the two containment oracles executable rather than incidental: diff-hunk confinement to the M1-S9 entry plus byte-exact comparison of every other story's acceptance-criteria block, and history comparison byte for byte with no whitespace normalisation. It also stopped claiming a guard covers a file the guard never reads. Revision 1.2 closes the residual precision gaps: the hunk guard now excludes the next heading line from the entry, the two forward-looking status statements get their own byte oracle (a pointer may be appended, but the sentences' bytes may not move) and the pointer-shape rule is enforced, the rest of the M1-S9 entry that the plan freezes is compared byte for byte, and the lead-in negative control runs on the flattened form so a wrapped phrase cannot turn it into a no-op.

Three properties are load-bearing and are tested independently so that one cannot pass behind another: (i) the amended `clean` definition is a four-part conjunction with a floor-only "whichever comes first"; (ii) the eleven enumerated classes are set-equal to the typed contract, verified mechanically, not by prose inspection; (iii) history (the dated 2026-11-03 amendment bullets, the M0 exit-criteria list, the M0 pilot statements) and every unrelated story AC and dependency are byte-identical to the base revision.

### 1.1 In Scope

- The M1-S9 entry in `doc/planning/oss-tooling/backlog.md`: four-condition `clean` definition, floor-only scope statement, eleven-class enumeration, corroboration rule, and preservation of its heading, acceptance criteria, dependency line, and phase structure.
- The new dated CEO-D-073 amendment section in `doc/planning/oss-tooling/status.md`, its supersession pointers on the two forward-looking statements, its declared-residual naming, and preservation of dated history.
- Out-of-entry containment in `backlog.md`: every `-U0` hunk inside the M1-S9 entry, and every other story's `- AC:`/`- Depends on:` block byte-identical to the base revision (AC-F5-3).
- Product-file containment (two files outside `doc/changes/**`), frontmatter/marker invariants, and the repository doc guards (`test-doc-distribution.sh`, `forbidden-literals.ts`, intra-repository link integrity), with a direct added-line seed-literal scan covering the file the guard does not scan.
- The new status-amendment claims: the 2026-11-03 per-engine adjudication, the "calendar window alone" lead-in with the floor-only qualifier, and the `CEO-D-073 (GH-266, 2026-11-07)` citation.
- Cross-file semantic consistency between the two amended files on the four conditions, the floor-only scope, and the three corroboration sources.

### 1.2 Out of Scope & Known Gaps

- **Known gap G-1 — future operational enforcement is not testable here.** Nothing in this change evaluates a real handover. The amended bar becomes executable only when M1-S9 (GH-239) delivers the dispatch engine and a handover decision is actually taken. No TC claims to test that evaluation; the plan tests only that the *definition* is correct, complete, and consistent. See open question OQ-1.
- **Known gap G-2 — the declared residual is expected to stay inconsistent by design.** `backlog-ranking.md`, `roadmap.md`, `cli-command-registry.md`, `milestones/m1/commands/dispatch.md`, `milestones/m1/journeys.md`, `user-journeys.md`, `milestones/m1/test-scenarios.md`, and `operator-requirements-2026-11.md` still restate the superseded M1-S9 calendar phrasing (spec §7.2). A consistency check over those files **will FAIL by design** in this change. That failure is recorded as accepted residual, not as a test case, and the only thing verified about them is that this change does not edit them (TC-GATE-012) and that the status amendment names them (TC-GATE-006). See open question OQ-2.
- **Known gap G-3 — the GH-239 ticket body is stale by design.** It quotes the superseded definition verbatim; correcting it is reported to the owner at PR time and is outside this change (spec §7.2, §17.1). No TC tests ticket state.
- **Not applicable:** unit, integration, contract-execution, E2E, performance, migration, telemetry, and security-surface testing. There is no runtime code path, no schema, and no emitted artifact; the only "contract" tested is a static set comparison against `DELIVERY_RESULT_TOKENS`.
- **Not applicable:** M0 exit criterion "zero false-success incidents on pilot paths over two weeks". It is a different milestone gate and is verified only as *preserved* (TC-GATE-008), never as *amended*.
- **Compensated, not a gap: the forbidden-literals guard does not read `backlog.md`.** `scripts/checks/forbidden-literals.ts` scans `registry.registered` documents only; `status.md` is registered and `backlog.md` is not, so the guard is structurally silent on the amended backlog. This plan therefore adds a direct added-line seed-literal scan (P17, TC-GATE-014) instead of asserting a protection the guard does not provide. The AC-NFR5-1 wording still says "attributable to the two changed files"; the executable check, not the guard alone, is what makes that true. Recorded as open question OQ-5.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-266-spec.md`](./chg-GH-266-spec.md) v1.3 | Binding source for F-1..F-5, AC-F1-1..AC-NFR3-1 (17 ACs; AC-F5-3 and AC-F2-4/5/6 added in v1.1, AC-F1-3 extended in v1.2 to freeze five M1-S9 prose regions, v1.3 narrowed that editable-prose claim and added AC-F2-2 byte retention), NFR-1..NFR-6, DM-1..DM-3, DEC-1..DEC-12 |
| [`chg-GH-266-plan.yaml`](./chg-GH-266-plan.yaml) | Delivery plan: materialises these procedures as `p00.sh`…`p17.sh` under `/tmp/gh266-procedures/` and gates each phase on them |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Test layers: static/diff and content checks for `doc/**`; fallback rule for docs-only changes (automated tests **N/A**, manual verification + `git diff --check` required); invariant-test rule (branch-diff shape checks belong to review gates, not the permanent suite) |
| [`doc/planning/oss-tooling/backlog.md`](../../../planning/oss-tooling/backlog.md) | File under test (M1-S9 entry) |
| [`doc/planning/oss-tooling/status.md`](../../../planning/oss-tooling/status.md) | File under test (amendment, pointers, history) |
| [`packages/core/src/contracts/delivery-result.ts`](../../../../packages/core/src/contracts/delivery-result.ts) | Normative `DELIVERY_RESULT_TOKENS` set used by the set-equality check |
| [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) | Decision adopting the eleven-token vocabulary and token-level dual-run parity |
| [`scripts/.tests/test-doc-distribution.sh`](../../../../scripts/.tests/test-doc-distribution.sh) | Distribution-marker drift guard (AC-NFR5-1) |
| [`scripts/checks/forbidden-literals.ts`](../../../../scripts/checks/forbidden-literals.ts) | Forbidden-literal scan (AC-NFR5-1) |
| `CEO-D-073` (owner directive, recorded in GH-266, 2026-11-07; spec §13, DEC-11) | Source of the evidence-based bar and the corroboration rule; cited in the amendment as `CEO-D-073 (GH-266, 2026-11-07)` |
| GH-266 ticket | Ticket scope: two files; ten-token parenthetical resolved by DEC-3 |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

Forward traceability (every AC appears exactly once in this table):

| AC ID | Requirement (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | M1-S9 `clean` states all four conditions (truth, class coverage, floor, corroboration) | TC-GATE-001 | Covered |
| AC-F1-2 | "rolling two-week window" / "two clean weeks" no longer define the gate; "whichever comes first" applies only to the floor | TC-GATE-002, TC-GATE-003 | Covered |
| AC-F1-3 | M1-S9 heading, acceptance criteria and dependency line unchanged (incl. "clean window", refusal/offer, reversibility, bash fallback); the five frozen prose regions (Goal, Ticket, phase (a), handover-flips, covers-functions) also byte-identical | TC-GATE-004, TC-GATE-005, TC-GATE-022 | Covered |
| AC-F2-1 | One new dated CEO-D-073 amendment section: composite bar, corroboration rule, canonical pointer, declared residual | TC-GATE-006 | Covered |
| AC-F2-2 | Both forward-looking restatements of the two-clean-weeks rule carry a supersession pointer | TC-GATE-007 | Covered |
| AC-F2-3 | Byte for byte (no whitespace normalisation): the 2026-11-03 amendment bullets; the M0 exit-criteria lead-in sentence; and the pilot, adoption and decision-acceptance bullets | TC-GATE-008 | Covered |
| AC-F2-4 | Amendment adjudicates the dated 2026-11-03 per-engine sentence as the same M1-S9 gate, superseded not waived (stricter on coverage, elapsed time replaced by an exposure floor); the dated sentence stays byte-identical | TC-GATE-019 | Covered |
| AC-F2-5 | Amendment says the gate is no longer defined by a calendar window alone, avoids an elapsed-time-only formulation, and retains the floor-only "whichever comes first" | TC-GATE-020 | Covered |
| AC-F2-6 | Amendment cites `CEO-D-073 (GH-266, 2026-11-07)` | TC-GATE-021 | Covered |
| AC-F3-1 | Both files state engine-claimed success is never sufficient and name exactly pm-notes phases, tracker state, CI on the pushed head | TC-GATE-009 | Covered |
| AC-F4-1 | Enumeration set-equal to `DELIVERY_RESULT_TOKENS` (11/11, incl. `pr-open-unverified`, 0 extra); DEC-3 resolution disclosed | TC-GATE-010 | Covered |
| AC-F5-1 | M1-S9 heading text unchanged | TC-GATE-005 | Covered |
| AC-F5-2 | `backlog.md` frontmatter byte-identical; no frontmatter added to `status.md`; no `ados_distribution` marker added | TC-GATE-011 | Covered |
| AC-F5-3 | Every `backlog.md` `-U0` hunk lies inside the M1-S9 entry; every other story's `- AC:` and `- Depends on:` block byte-identical to the base revision | TC-GATE-018 | Covered |
| AC-NFR1-1 | Exactly two product files outside `doc/changes/**`, both under `doc/planning/oss-tooling/`; no product file under `packages/`, `scripts/`, `tests/`, `doc/spec/`, `.opencode/`, or build config | TC-GATE-012, TC-GATE-017 | Covered |
| AC-NFR5-1 | Doc-distribution guard exit 0; no new forbidden literal attributable to the two files (guard on its registered scan set, plus P17's added-line scan for the unregistered `backlog.md`); no broken intra-repo link | TC-GATE-013, TC-GATE-014, TC-GATE-015 | Covered |
| AC-NFR3-1 | No contradiction between the files on the four conditions, the floor-only scope, and the three corroboration sources | TC-GATE-016 | Covered |

Reverse traceability (no orphan test cases):

| TC ID | AC ID(s) |
|---|---|
| TC-GATE-001 | AC-F1-1 |
| TC-GATE-002 | AC-F1-2 |
| TC-GATE-003 | AC-F1-2 |
| TC-GATE-004 | AC-F1-3 |
| TC-GATE-005 | AC-F5-1, AC-F1-3 |
| TC-GATE-006 | AC-F2-1 |
| TC-GATE-007 | AC-F2-2 |
| TC-GATE-008 | AC-F2-3 |
| TC-GATE-009 | AC-F3-1 |
| TC-GATE-010 | AC-F4-1 |
| TC-GATE-011 | AC-F5-2 |
| TC-GATE-012 | AC-NFR1-1 |
| TC-GATE-013 | AC-NFR5-1 |
| TC-GATE-014 | AC-NFR5-1 |
| TC-GATE-015 | AC-NFR5-1 |
| TC-GATE-016 | AC-NFR3-1 |
| TC-GATE-017 | AC-NFR1-1 |
| TC-GATE-018 | AC-F5-3 |
| TC-GATE-019 | AC-F2-4 |
| TC-GATE-020 | AC-F2-5 |
| TC-GATE-021 | AC-F2-6 |
| TC-GATE-022 | AC-F1-3 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no API or event surface (spec §8.1, §8.2). The three data-model elements are documentation-level and are verified through the ACs that consume them:

| ID | Element | TC ID(s) | Notes |
|---|---|---|---|
| DM-1 | `clean` predicate (four-part conjunction; only the floor is either/or) | TC-GATE-001, TC-GATE-003 | Presence of all four conditions plus the floor-only scope statement |
| DM-2 | Result-class enumeration set-equal to `DELIVERY_RESULT_TOKENS` | TC-GATE-010 | Mechanical set comparison against the typed contract; the load-bearing check |
| DM-3 | Corroboration evidence set (pm-notes phases, tracker state, CI on pushed head) | TC-GATE-009, TC-GATE-016 | Exactly three sources, stated in both files, no fourth source |

API-# / EVT-#: none exist in the spec; nothing to cover.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Docs-only containment (2 product files outside `doc/changes/**`; 0 in code/spec/opencode/build roots) | TC-GATE-012, TC-GATE-017 | Covered |
| NFR-2 | Historical integrity, byte-exact without normalisation (2026-11-03 bullets, M0 exit-criteria lead-in and three statements, other stories' AC/dependency blocks, `backlog.md` frontmatter) | TC-GATE-008, TC-GATE-011, TC-GATE-004, TC-GATE-018, TC-GATE-019 | Covered |
| NFR-3 | Semantic consistency across the two files | TC-GATE-016 | Covered (semi-automated: presence script + contradiction read) |
| NFR-4 | Contract fidelity of the enumeration (11/11, 0 missing, 0 extra) | TC-GATE-010 | Covered (mechanical) |
| NFR-5 | Guard cleanliness (distribution guard, forbidden literals including a direct added-line scan of the unregistered `backlog.md`, links) | TC-GATE-013, TC-GATE-014, TC-GATE-015 | Covered |
| NFR-6 | Reversibility (one docs revert; no migration or downstream state) | TC-GATE-012 | Partially covered — containment proves nothing outside the two files must be unwound; the actual `git revert` is a release action, not a test step (assumption A-4) |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, a `doc/**` change is covered by **static/diff checks** and **content checks**, plus the repository doc guards. There is no applicable unit, integration, E2E, performance, or migration layer.

| Layer | What is executed | Where |
|---|---|---|
| Static/diff inspection | `git diff --name-only`, `git diff --check`, `git diff -U0`, region extraction with `awk` + `cmp` | Local worktree at branch HEAD vs `origin/main-tools` |
| Content inspection | Exact-literal presence/absence over the amended sections, supersession-marker discipline, history-region byte equality | Same |
| Mechanical contract check | Set equality of the enumerated classes against `DELIVERY_RESULT_TOKENS` via `bun -e` (imports the real typed module) | Same |
| Doc guards | `bash scripts/.tests/test-doc-distribution.sh`, `bun run scripts/checks/forbidden-literals.ts`, intra-repo link resolution | Same |
| Markdown rendering | Headings, bullet lists, tables, and inline code spans in the two amended sections render with intact structure (reviewed, not executed) | Reviewer |

**No test code, suite, or harness is added, and that is correct here, not a compromise.**

- The change has no runtime behaviour to assert; the only executable assertion available is a *set comparison against an existing typed constant*, which TC-GATE-010 performs inline and validates against the real module.
- Everything else is a property of **the diff against a moving base branch**. `.ai/rules/testing-strategy.md` states that branch-diff shape checks ("only these files changed", "coverage titles preserved") belong to review and PR-time gates, not to the permanent suite, because such an assertion only holds at the PR that introduced it and fails every later delivery. A committed `tests/**` case asserting "exactly two files changed since `origin/main-tools`" would be exactly that anti-pattern.
- NFR-1 forbids touching `tests/**`, `scripts/**`, and build config, so committing a helper script would violate the change's own containment criterion.
- One guard's coverage is narrower than AC-NFR5-1's wording implies: `scripts/checks/forbidden-literals.ts` scans only `registry.registered` documents (`status.md` is registered; `backlog.md` is not). This plan therefore runs a direct added-line seed-literal scan (P17) rather than restating a protection the guard does not provide.

The procedures below are therefore **uncommitted, reproducible inspection commands**. Each states its expected output, and each was validated against the base revision, where the relevant checks are expected to *fail* pre-change (see the falsifiability anchors in Section 5.2) — which is what makes them falsifiable rather than decorative.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Impact | Priority | AC Coverage | Layer |
|---|---|---|---|---|---|---|
| TC-GATE-001 | Four-condition composite `clean` predicate present in M1-S9 | Happy Path | Critical | High | AC-F1-1 | Content |
| TC-GATE-002 | Superseded calendar phrasing no longer defines the M1-S9 gate | Negative | Critical | High | AC-F1-2 | Content |
| TC-GATE-003 | "Whichever comes first" is scoped to the floor only | Corner Case | Critical | High | AC-F1-2 | Content |
| TC-GATE-004 | M1-S9 acceptance criteria and dependency line byte-identical | Regression | Critical | High | AC-F1-3 | Static/diff |
| TC-GATE-005 | M1-S9 heading text unchanged | Regression | Important | High | AC-F5-1, AC-F1-3 | Static/diff |
| TC-GATE-006 | Dated CEO-D-073 amendment section present with bar, corroboration, pointer, residual | Happy Path | Critical | High | AC-F2-1 | Content |
| TC-GATE-007 | Supersession pointers on the two forward-looking status statements | Happy Path | Important | High | AC-F2-2 | Content |
| TC-GATE-008 | status.md dated history and M0 exit/pilot statements byte-identical | Regression | Critical | High | AC-F2-3 | Static/diff |
| TC-GATE-009 | Corroboration insufficiency rule with exactly three sources in both files | Happy Path | Critical | High | AC-F3-1 | Content |
| TC-GATE-010 | Eleven enumerated classes set-equal to `DELIVERY_RESULT_TOKENS`; DEC-3 disclosed | Contract | Critical | High | AC-F4-1 | Contract (set equality) |
| TC-GATE-011 | Frontmatter and distribution-marker invariants | Negative | Important | Medium | AC-F5-2 | Static/diff |
| TC-GATE-012 | Diff containment: exactly two product files outside `doc/changes/`, no code/spec paths | Negative | Critical | High | AC-NFR1-1 | Static/diff |
| TC-GATE-013 | Doc-distribution guard exits 0 | Regression | Important | Medium | AC-NFR5-1 | Guard |
| TC-GATE-014 | Guard result plus direct added-line seed-literal scan (covers unregistered `backlog.md`) | Regression | Important | Medium | AC-NFR5-1 | Guard + diff |
| TC-GATE-015 | No broken intra-repository link introduced | Edge Case | Important | Medium | AC-NFR5-1 | Guard |
| TC-GATE-016 | Cross-file consistency of conditions, floor scope, and corroboration sources | Corner Case | Critical | High | AC-NFR3-1 | Content |
| TC-GATE-017 | Whitespace/conflict-marker clean and no incidental reformatting | Negative | Minor | Medium | AC-NFR1-1 | Static/diff |
| TC-GATE-018 | Out-of-entry containment: every backlog hunk inside M1-S9, other stories byte-identical | Negative | Critical | High | AC-F5-3 | Static/diff |
| TC-GATE-019 | 2026-11-03 per-engine sentence adjudicated as same gate, superseded not waived, bytes unchanged | Corner Case | Critical | High | AC-F2-4 | Content + byte compare |
| TC-GATE-020 | Amendment lead-in: calendar window alone, no elapsed-time-only phrasing, floor-only retained | Corner Case | Important | High | AC-F2-5 | Content |
| TC-GATE-021 | Directive citation reads `CEO-D-073 (GH-266, 2026-11-07)` | Happy Path | Important | Medium | AC-F2-6 | Content |
| TC-GATE-022 | M1-S9 frozen regions byte-identical (Goal, Ticket, phase (a), handover-flips, covers-functions) | Regression | Important | High | AC-F1-3 | Static/diff |

### 5.2 Scenario Details

#### TC-GATE-001 - Four-condition composite `clean` predicate present in M1-S9

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, DM-1, AC-F1-1
**Test Type(s)**: Manual (executable content inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, M1-S9 entry
**Tags**: @docs, @gate, @content

**Preconditions**:

- Worktree at branch `docs/GH-266/evidence-based-handover-gate` HEAD with the amendment applied.
- `bun` available (repository pin), run from the repository root.

**Steps**:

1. Run procedure **P3** (Section 7.1) against `doc/planning/oss-tooling/backlog.md`.
2. Confirm each of the four condition groups reports `OK`, and read the section once to confirm the conditions are stated as a conjunction (one definition), not as four unrelated notes.
3. Confirm the two phase markers `(a) **evidence accrual**` and `(b) **handover per repository**` are still present, i.e. the definition lives in the handover phase and the phase structure was not collapsed.

**Expected Outcome**:

- `a-truth: OK`, `b-classes: OK`, `c-floor: OK`, `d-corroboration: OK`, and the final line `conditions=4/4`; exit code 0.
- The four conditions are visibly joined as one `clean` definition, and both phase markers remain.

**Notes / Clarifications**:

- Falsifiability anchor: on `origin/main-tools` the same procedure prints `conditions=1/4` (`a-truth: OK`, other three `MISSING`). A run that still prints `1/4` means the amendment is absent or unscoped.

#### TC-GATE-002 - Superseded calendar phrasing no longer defines the M1-S9 gate

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DEC-1, AC-F1-2
**Test Type(s)**: Manual (executable content inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, M1-S9 entry
**Tags**: @docs, @gate, @negative

**Preconditions**:

- As TC-GATE-001.

**Steps**:

1. Run procedure **P2**, which scans the M1-S9 section for `rolling two-week window` and `two clean weeks` and flags every occurrence whose surrounding ±240-character window carries no supersession marker (`superseded` / `replaces` / `no longer defines`).
2. If occurrences remain, read them: each must be explicitly marked as the superseded rule, never presented as the current definition.
3. Run `grep -n "rolling two-week window" doc/planning/oss-tooling/backlog.md`. Expected: no output (the phrase is replaced); if there is a hit, it must be the explicitly marked supersession reference from step 2. The base-revision hit is line `541`.

**Expected Outcome**:

- `unmarked=0`, exit code 0 (the `occurrences=` prefix reports how many times the phrase still appears, and is `0` when it is gone). Zero occurrences is acceptable and preferred; a documented supersession mention is acceptable only if marked.
- No sentence in the M1-S9 entry still *defines* `clean` by elapsed time.

**Notes / Clarifications**:

- Falsifiability anchor: on `origin/main-tools` the same procedure prints `unmarked=1` (the definition sentence at line 541). The check is therefore proven to detect the exact defect it exists to prevent.

#### TC-GATE-003 - "Whichever comes first" is scoped to the floor only

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DEC-2, AC-F1-2
**Test Type(s)**: Manual (executable content inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, M1-S9 entry
**Tags**: @docs, @gate, @scope

**Preconditions**:

- As TC-GATE-001.

**Steps**:

1. Run procedure **P3** and read the `floor-scope=` line, which requires the text around `whichever comes first` (±240/300 characters) to also name the floor and to carry an explicit scope word (`only` / `binds` / `not an alternative` / `never substitutes`).
2. Read the sentence manually and confirm a reader cannot conclude that 20 dispatches substitutes for class coverage, incident truth, or corroboration.
3. Confirm the sentence does not offer a third reading such as "either the floor or full class coverage".

**Expected Outcome**:

- `floor-scope=OK`.
- The text binds "whichever comes first" to the exposure floor alone (RSK-2 mitigation realised in prose).

**Notes / Clarifications**:

- This is the highest-value prose check in the plan: the failure mode is a technically complete four-condition list whose floor quietly becomes an escape hatch.

#### TC-GATE-004 - M1-S9 acceptance criteria and dependency line byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, NFR-2, AC-F1-3
**Test Type(s)**: Manual (static/diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, M1-S9 `- AC:` .. `- Depends on:` block
**Tags**: @docs, @diff, @regression

**Preconditions**:

- Base snapshot materialised at `/tmp/gh266-base-backlog.md` (Section 7.1, step P0).

**Steps**:

1. Run procedure **P4a**: extract the slice from `- AC:` through `- Depends on:` inside the M1-S9 section from both the base snapshot and the worktree file, then `cmp` them.
2. Run the four phrase greps from **P4a** (`clean window`, `refused while`, `per repository and reversible`, `fallback with deprecation`) against the worktree file.
3. Confirm the two phase markers `(a) **evidence accrual**` and `(b) **handover per repository**` are still present and that the M1-S9 heading and ticket line were not rewritten by the slice comparison (step 1 covers the block from `- AC:` through `- Depends on:`).

**Expected Outcome**:

- `cmp` prints nothing and the wrapper echoes `M1-S9 AC+Depends byte-identical`.
- All four greps match once each inside the M1-S9 section.
- Both phase markers remain.

**Notes / Clarifications**:

- This TC verifies only the M1-S9 acceptance-criteria block and dependency line (AC-F1-3). It deliberately makes **no** claim about other stories: containment of the rest of `backlog.md` is a different requirement (AC-F5-3) and is verified by TC-GATE-018 through hunk confinement and a byte comparison of every other story's AC/dependency block. An earlier revision of this TC asserted the other-story property while its steps only inspected the M1-S9 block; that oracle/steps gap is closed by splitting the requirement.
- The amendment changes the *definition of* `clean`; it must not touch the sentence that *uses* the phrase "clean window". Both are true simultaneously and the slice comparison is what distinguishes them.

#### TC-GATE-005 - M1-S9 heading text unchanged

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, DEC-8, AC-F5-1, AC-F1-3
**Test Type(s)**: Manual (static/diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, heading line 529
**Tags**: @docs, @diff, @anchors

**Preconditions**:

- Base snapshot available (`/tmp/gh266-base-backlog.md`).

**Steps**:

1. Run procedure **P4b**: `git diff -U0 origin/main-tools...HEAD -- doc/planning/oss-tooling/backlog.md | grep -E '^[+-]#{3} M1-S9'`.
2. Compare the heading line itself: `grep -n '^### M1-S9 ' /tmp/gh266-base-backlog.md doc/planning/oss-tooling/backlog.md`; the two heading strings must be identical (`### M1-S9 Dispatch engine: dual-run evidence and per-repo handover`).

**Expected Outcome**:

- The `grep` on the diff prints nothing and the wrapper echoes `heading unchanged`.
- Identical heading text on both revisions, so no anchor moves.

**Notes / Clarifications**:

- Pre-existing stale `#m1-s9-dispatch-dual-run-pilot` references in `doc/inception` are out of scope and are neither fixed nor worsened (DEC-8).

#### TC-GATE-006 - Dated CEO-D-073 amendment section present with bar, corroboration, pointer, residual

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-1
**Test Type(s)**: Manual (executable content inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`, new amendment section
**Tags**: @docs, @status, @content

**Preconditions**:

- Worktree at branch HEAD with the amendment applied.

**Steps**:

1. Run procedure **P5**: it locates a `## ` section whose body contains `CEO-D-073` (there is none on the base revision), then asserts the required markers inside that section.
2. Confirm the section heading carries a date (`2026-11-…`), i.e. it reads as a dated snapshot entry rather than an undated rewrite.
3. Read the section and confirm it states the composite bar as the *same* four conditions, points to the M1-S9 entry in `backlog.md` as canonical, and names the declared residual without editing those documents.
4. Markdown rendering review: heading level is `##` (a sibling of the existing `## M0 exit amendment and M1 re-planning (2026-11-03)`), bullets are well-formed, links resolve as text, and no table or fence is left open.

**Expected Outcome**:

- An `amendment:` line echoing the new dated section heading (which contains `CEO-D-073`), `residual-named` of at least 2, `missing=0`, exit code 0. The marker set covers: `CEO-D-073`; false-success/incident truth; TDR-0005 result-class coverage; the `20 dispatches` / `7 consecutive days` floor; `pm-notes`; `tracker state`; `CI on the pushed head`; a `backlog.md` + `M1-S9` canonical pointer; the word residual plus at least two residual document filenames.
- The section renders as one coherent dated entry.

**Notes / Clarifications**:

- Falsifiability anchor: on `origin/main-tools` the procedure prints `amendment: not found` (`grep -c CEO-D-073` returns `0` for both planning files today).
- Naming fewer than two residual documents is a FAIL: the residual exists to be discoverable, not merely acknowledged (RSK-1).

#### TC-GATE-007 - Supersession pointers on the two forward-looking status statements

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-2
**Test Type(s)**: Manual (executable content inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`, the paragraph after "Milestone exit: pending" and item 3 of "Proposed next steps"
**Tags**: @docs, @status, @supersession

**Preconditions**:

- As TC-GATE-006.

**Steps**:

1. Run procedure **P6a**: units are blank-line paragraphs with ordered-list items split out, so a pointer in item 2 cannot satisfy item 3's requirement. Ignore units before `## Story delivery` (dated history). For every remaining unit containing `two-clean-weeks`, require a pointer marker (`supersed…` or an in-document link `](#…)`) **and** require the unit not to contain `CEO-D-073` (pointer-shape rule D-6: the forward pointers must not carry the directive id, or P5/P16 could select a pointer paragraph instead of the amendment section).
2. Confirm exactly two forward-looking units are found, matching the spec's named locations: the paragraph after "Milestone exit: pending" and item 3 of "Proposed next steps".
3. Confirm the 2026-11-03 bullet is *not* counted as forward-looking (it is history and must carry no pointer; TC-GATE-008 proves it is untouched).
4. Run procedure **P6b**: slice the two forward statements from the base snapshot and from HEAD as raw text and compare bytes — `milestone-exit-forward` (from `Per backlog-ranking.md reading notes` to `remains the critical path for M0 exit.`) and `next-steps-item-3` (from `3. **M1 delivery start**:` to `respecting the per-repo two-clean-weeks rule.`). The pointer is appended *after* those bytes, so both slices must be identical.

**Expected Outcome**:

- `forward=2 pointed=2 pointer-shape=2/2 bytes=2/2`, exit code 0.
- `forward bytes milestone-exit-forward: byte-identical (332 bytes)` and `forward bytes next-steps-item-3: byte-identical (247 bytes)` (observed at authoring time on the base tree; the counts change only if the pointer is placed inside the compared slice, which is a FAIL).
- Each of the two statements still says what it said, with a pointer beside it — not rewritten as if it had never said the calendar rule (DEC-6).

**Notes / Clarifications**:

- This is the oracle readiness finding N2 asked for: plan task 2.2 cites "byte-identical (P7c)", but P7c byte-compares the three numbered M0 exit-criteria statements. The forward statements are compared here instead, and the citation should point at P6b.
- Falsifiability anchor: on `origin/main-tools` the same procedure prints `history (no pointer required): ...`, `forward=2 pointed=0 pointer-shape=2/2 bytes=2/2`, exit 1, so a pass cannot be produced by the pre-existing word "amendment" elsewhere. The pointer must be specifically to the new section.
- The pointer may be appended on the same line or on a new line: the slices end at the sentence terminator, so either placement passes while any edit *inside* the sentences fails.

#### TC-GATE-008 - status.md historical regions byte-identical, no whitespace normalisation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-2, DEC-6, DEC-7, AC-F2-3
**Test Type(s)**: Manual (static/diff inspection, byte comparison)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`: the dated 2026-11-03 bullets; the M0 exit-criteria lead-in sentence; the pilot, adoption and decision-acceptance bullets
**Tags**: @docs, @diff, @history

**Preconditions**:

- Base snapshot `/tmp/gh266-base-status.md` (Section 7.1, step P0).

**Steps**:

1. Run **P7a**: extract the `## M0 exit amendment and M1 re-planning (2026-11-03)` region (heading through the line before the next `## `) from base and worktree, then `cmp`.
2. Run **P7b**: extract the lead-in sentence `The roadmap's M0 exit criteria (roadmap.md, Milestone 0 section) are:` from both revisions and `cmp`.
3. Run **P7c**: extract each of the three M0 exit-criteria statements separately from both revisions — (1) the pilot bullet (`1. Dual-run pilot:` … zero false-success incidents on pilot paths over two weeks), (2) the adoption bullet (`2. This repository adopts the scaffold`), (3) the decision-acceptance bullet (`3. Decision acceptance recorded:` … `as enumerated in the inception readiness report.`) — and `cmp` each pair.
4. Run the **P7d negative control**: reflow statement 1 in a `/tmp` copy by breaking one line at `…(shell stays authoritative), with zero`; the comparison for statement 1 must then report `FAIL statement 1` and show a diff, even though no word changed.
5. Inspect `git diff -U0 origin/main-tools...HEAD -- doc/planning/oss-tooling/status.md` and confirm no hunk covers a line inside those regions, i.e. the supersession pointer sits in the paragraph after the list, not inside it.

**Expected Outcome**:

- `2026-11-03 section byte-identical`; `lead-in byte-identical`; `statement 1/2/3 byte-identical` (213, 72 and 582 bytes respectively at authoring time, 3/1/8 lines).
- Negative control: `FAIL statement 1` plus a two-line diff, then `P7 verdict: OK` (the negative control is a self-test and does not enter the verdict). Proving agreement comes from bytes, not from wording.
- The only status.md hunks are the new amendment section and the two pointer additions.

**Notes / Clarifications**:

- Spec v1.1 renames the three statements explicitly, which is what makes this oracle unambiguous. The region end anchor is the last line of the decision-acceptance bullet, so the forward-looking paragraph that receives the pointer is outside the compared region.
- Replaces the previous whitespace-normalised `grep -F` check, under which a pure reflow passed while bytes changed (readiness finding 4).
- The M0 exit criterion mentioning "two weeks" stays as written and is verified here as *preserved*, never as amended (DEC-7, NG-4).

#### TC-GATE-009 - Corroboration insufficiency rule with exactly three sources in both files

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-3, DEC-4, AC-F3-1
**Test Type(s)**: Manual (executable content inspection + adjudication)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md` M1-S9 entry; `doc/planning/oss-tooling/status.md` amendment section
**Tags**: @docs, @gate, @safety

**Preconditions**:

- As TC-GATE-001 and TC-GATE-006.

**Steps**:

1. Run procedure **P8**: in each amended region, report presence of `pm-notes`, `tracker state`, and `CI on the pushed head`, plus an insufficiency marker (`never sufficient` / `not sufficient` / `insufficient` / `never counts`).
2. Read both corroboration sentences and confirm the rule is legible per outcome family: a success claim such as `merged` requires the pushed head, CI on that head, tracker state, and completed phases; a tracker-derived claim such as `pr-open`, `blocked`, or `pr-open-unverified` requires the tracker fact.
3. Confirm the evidence set is **exactly three** sources — no fourth source is offered as a substitute (for example a bare exit code, an engine log line, or a self-reported summary).
4. Confirm neither file states or implies that a result token alone can satisfy the gate.

**Expected Outcome**:

- `backlog: sources=3/3 insufficiency=OK`, `status: sources=3/3 insufficiency=OK`, exit code 0.
- Manual read confirms sufficiency maps to outcome family and that no fourth source dilutes the rule (RSK-4 mitigation realised).

**Notes / Clarifications**:

- Steps 2-4 are deliberately manual: "exactly three named sources" is a semantic property (a fourth source can be smuggled in with synonyms), and the spec does not require a per-token table (spec §5.1 F-3), only the insufficiency rule and the three sources.

#### TC-GATE-010 - Eleven enumerated classes set-equal to `DELIVERY_RESULT_TOKENS`; DEC-3 disclosed

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-2, NFR-4, DEC-3, AC-F4-1
**Test Type(s)**: Contract (static set comparison against the typed module)
**Automation Level**: Semi-automated (executable, uncommitted)
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md` M1-S9 enumeration paragraph vs `packages/core/src/contracts/delivery-result.ts`
**Tags**: @docs, @contract, @tdr-0005

**Preconditions**:

- `bun` available; run from the repository root so the TypeScript import resolves.
- The amendment enumerates the classes as backticked tokens in a single paragraph that contains `noop-lane-nothing-to-do` (the extraction anchor). This is a derived testability requirement of NFR-4/DM-2, which demand set comparison rather than prose inspection.

**Steps**:

1. Run procedure **P9**: it imports `DELIVERY_RESULT_TOKENS` from the real module, extracts the enumeration paragraph from the M1-S9 section, and compares sets.
2. Confirm the output line reports `tokens=11`, `missing=0`, `extra=0`, `duplicates=0` and exit code 0.
3. Confirm `pr-open-unverified` is among the enumerated tokens (the ticket's ten-token parenthetical is not inherited).
4. Confirm the DEC-3 resolution is disclosed in the change record (spec §15 DEC-3, §17.1 DoD, and the PR/ticket comment) — i.e. that the ten-token omission was resolved deliberately in favour of the normative clause, not silently.
5. Sanity-check the negative direction by temporarily removing `pr-open-unverified` from a *copy* of the paragraph in `/tmp` and re-running P9 against it; the check must report `missing=1` and exit 1.

**Expected Outcome**:

- `tokens=11 missing=0 extra=0 duplicates=0`, exit 0 on the amended file.
- `missing=1` naming `pr-open-unverified`, exit 1, on the negative copy — proving the check is not vacuous.
- DEC-3 disclosure present.

**Notes / Clarifications**:

- Falsifiability anchor: on `origin/main-tools` P9 reports `FAIL: enumeration paragraph not found in M1-S9 section` (exit 1), because the current entry enumerates no classes at all.
- This is the one TC backed by an executable assertion against production truth; it is the reason NFR-4 says "verified by set comparison against the typed contract" rather than by reading.

#### TC-GATE-011 - Frontmatter and distribution-marker invariants

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, NFR-2, DEC-9, AC-F5-2
**Test Type(s)**: Manual (static/diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: both planning files (front matter)
**Tags**: @docs, @diff, @frontmatter

**Preconditions**:

- Base snapshots from P0.

**Steps**:

1. Run procedure **P10a**: extract the leading `---` … `---` block from the base and worktree `backlog.md` and `cmp` them.
2. Run procedure **P10b**: confirm `status.md` still has no frontmatter — its first line is the H1 title, not `---`.
3. Run procedure **P10c**: `git diff origin/main-tools...HEAD -- doc/planning/oss-tooling/ | grep -c '^+ados_distribution'`; confirm the count is `0` and that the added-line set contains no `ados_distribution: ` string at all.

**Expected Outcome**:

- `backlog frontmatter byte-identical` (cmp silent, exit 0).
- `status has no frontmatter`.
- `0` added `ados_distribution` lines; both files still report `0` markers via `grep -c '^ados_distribution'` (note: that `grep` exits 1 when the count is 0 — the printed `0` is the assertion, not the exit code).

**Notes / Clarifications**:

- `doc/planning` is outside the closed distribution scope, and neither file carries the marker today; adding one would invent a distribution class (DEC-9).

#### TC-GATE-012 - Diff containment: exactly two planning files, no code/spec paths

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, NFR-6, DEC-5, AC-NFR1-1
**Test Type(s)**: Manual (static/diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: product-file diff vs `origin/main-tools`
**Tags**: @diff, @containment

**Preconditions**:

- Branch HEAD contains the change artifacts under `doc/changes/**` plus the two amended product files; `origin/main-tools` is fetched.

**Steps**:

1. Run procedure **P1a**: `git diff --name-only origin/main-tools...HEAD -- . ':(exclude)doc/changes/**' | sort` and read exactly two path lines. This is the measurement the AC defines: product files, i.e. all paths except `doc/changes/**`.
2. Run procedure **P1b**: `git diff --name-only origin/main-tools...HEAD | grep -E '^(packages|scripts|tests|doc/spec|\.opencode)/|(^|/)(package\.json|pnpm-lock\.yaml|tsconfig.*\.json|biome\.json|bunfig\.toml|\.dependency-cruiser\.cjs)$'` and confirm no output.
3. Confirm `doc/changes/` contains only this change folder's artifacts (spec, this test plan, and later the plan), which is expected and correct.

**Expected Outcome**:

```
doc/planning/oss-tooling/backlog.md
doc/planning/oss-tooling/status.md
```

- P1b prints `none` (no forbidden root, no build/config file).
- Therefore nothing outside the two declared files needs unwinding, which is also the containment half of NFR-6.

**Notes / Clarifications**:

- The `:(exclude)doc/changes/**` pathspec is not a loophole: change artifacts are uncommitted-to-review process output, not product change. Their presence is asserted in step 3 so they cannot hide an unexpected third product file.
- Falsifiability anchor: on a clean base this command prints nothing; after the change it must print exactly two lines. A third line is an automatic FAIL regardless of how harmless it looks.

#### TC-GATE-013 - Doc-distribution guard exits 0

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-5, AC-NFR5-1
**Test Type(s)**: Manual (guard execution)
**Automation Level**: Semi-automated
**Target Layer / Location**: repository guards
**Tags**: @guard, @docs

**Preconditions**:

- Bash available; run from repository root.

**Steps**:

1. Run procedure **P11**: `bash scripts/.tests/test-doc-distribution.sh; echo "exit=$?"`.
2. Read the summary lines and confirm the in-scope doc count is sane (81 today) and no drift is reported.

**Expected Outcome**:

- `exit=0` and the final summary line `(guard-doc-distribution)[OK] no drift — 81 in-scope docs; install set matches ados_distribution markers` (the count may differ only if another change in the same PR adds or removes an in-scope doc, which would itself be a containment failure per TC-GATE-012).
- Any `[FAIL]`/drift line is a FAIL of this TC.

**Notes / Clarifications**:

- `doc/planning` is not in the guard's scope, so this TC mainly proves the change did not *drag* a scoped doc into the diff and did not disturb the marker set (DEC-9).

#### TC-GATE-014 - Guard result plus a direct added-line seed-literal scan

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-5, AC-NFR5-1
**Test Type(s)**: Manual (guard execution + diff scan)
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/checks/forbidden-literals.ts` plus the added lines of `doc/planning/oss-tooling/` in the diff
**Tags**: @guard, @docs, @literals

**Preconditions**:

- `bun` available; repository root; run on the amended tree.

**Steps**:

1. Run procedure **P12**: `bun run scripts/checks/forbidden-literals.ts; echo "exit=$?"`; confirm `OK forbidden-literals: 5/5 scope classes scanned, 0 violations` and `exit=0`.
2. Confirm from the guard's own detail line that the scanned doc set is the registered list — i.e. that `status.md` is scanned and `backlog.md` is **not**. The guard is structurally silent on the amended backlog.
3. Run procedure **P17**: it imports the production `matchSeedLiteral` matcher, filters the diff to added lines (`^+`, excluding `+++`) under `doc/planning/oss-tooling/`, and applies the three registry seed literals (`ados`, `ADOS_`, `~/.ados`) with the guard's own delimiting semantics.
4. Confirm `seed-hits=0`, `added-lines>0` (a non-vacuous scan) and `exit=0`.
5. Run the P17 matcher self-tests: `vendored ados binary` → `ados`, `~/.ados/config` → `~/.ados`, `shadowados` → `none`.

**Expected Outcome**:

- Guard: `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`, `exit=0`, and a `registered docs` detail that does not include `backlog.md`.
- Diff scan: `added-lines=N seed-hits=0` with `N>=1`, `seed scan exit=0`, `P17 verdict: OK`.
- Self-tests: `positive: ados`, `positive2: ~/.ados`, `negative: none` — proving the scan would catch a real brand literal and does not fire on a substring.

**Notes / Clarifications**:

- **Why the guard alone is not enough (readiness finding 5):** `scanFile` is called only for documents in `registry.registered`. `doc/planning/oss-tooling/status.md` is registered; `doc/planning/oss-tooling/backlog.md` is present at `corpusBaseline` (`32784aff…`) and therefore must *not* be registered, so the amended backlog is never scanned. An earlier revision claimed "a regression can therefore only come from the two amended files", which was false for the backlog and is retracted.
- If a hit appears, reword the text. Never add an allowlist entry or register the backlog: either change touches `scripts/**` and violates AC-NFR1-1.
- Baseline observed on the unamended tree: `added-lines=0 seed-hits=0`, `exit=0`.

#### TC-GATE-015 - No broken intra-repository link introduced

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-5, AC-NFR5-1
**Test Type(s)**: Manual (static/diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: added lines in both amended files
**Tags**: @docs, @links

**Preconditions**:

- Base revision available for the diff.

**Steps**:

1. Run procedure **P13a**: extract added relative link targets from the diff of `doc/planning/oss-tooling/` (`grep '^+' | grep -oE '\]\([^)#]+' | sed 's/^](//' | sort -u`), excluding `#`-only anchors and absolute URLs.
2. Run procedure **P13b**: for each extracted target, resolve it relative to `doc/planning/oss-tooling/` and report any that do not exist.
3. Manually confirm any `](#…)` in-document anchor points at a heading that exists in the same file (in particular the pointer added by TC-GATE-007, if it is anchor-based).

**Expected Outcome**:

- `broken=0`, exit 0. The extracted link list may legitimately be empty when the amendment adds no relative links; an empty list is a pass, not a skipped check.
- No link in the two files points to a file or anchor that does not exist.

**Notes / Clarifications**:

- The amendment deliberately links to `backlog.md` and to its own new section; both must resolve, or the supersession pointers do not work as pointers.

#### TC-GATE-016 - Cross-file consistency of conditions, floor scope, and corroboration sources

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, F-1, F-2, F-3, AC-NFR3-1
**Test Type(s)**: Manual (executable presence check + contradiction read)
**Automation Level**: Semi-automated
**Target Layer / Location**: both amended files
**Tags**: @docs, @consistency

**Preconditions**:

- Both amendments applied; P3 and P5 already pass individually.

**Steps**:

1. Run procedure **P14**: for each amended region it reports presence of the three corroboration sources, the incident/divergence condition, the result-class condition, and — only where the floor numbers appear — the floor qualifier (`floor` in the same paragraph).
2. Place the two definitions side by side and read for contradiction: incident/divergence truth, class coverage, floor values (`20 dispatches`, `7 consecutive days`), floor-only scope, and the three evidence sources must agree in substance, wording, and quantity.
3. Confirm the status amendment does not present the bar as stricter or looser than the backlog (no extra condition, no dropped condition, no different threshold).
4. Confirm the status file defers to `backlog.md` as canonical rather than establishing a second definition.

**Expected Outcome**:

- `backlog.md: corroboration=3/3 incident=OK classes=OK floor=OK`, `status.md: corroboration=3/3 incident=OK classes=OK floor=OK|n/a`, exit code 0. (`floor=n/a` is correct when the status amendment restates no floor numbers; `floor=MISSING` means it restated them without the floor qualifier.) The script exits non-zero if any expected presence is missing, so a vacuous green is not possible.
- No contradiction found in the manual comparison; a divergence in any threshold or source count is a FAIL even if each file is internally coherent.

**Notes / Clarifications**:

- Two internally correct definitions can still contradict each other (for example 7 calendar days in one file and 7 consecutive days in the other). The script proves presence; only the side-by-side read proves agreement, which is why this TC is explicitly semi-automated.

#### TC-GATE-017 - Whitespace/conflict-marker clean and no incidental reformatting

**Scenario Type**: Negative
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: NFR-1, NFR-2, AC-NFR1-1
**Test Type(s)**: Manual (static/diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: whole diff
**Tags**: @diff, @whitespace

**Preconditions**:

- Branch HEAD with the amendment committed.

**Steps**:

1. Run procedure **P1c**: `git diff --check origin/main-tools...HEAD; echo "exit=$?"`.
2. Inspect `git diff --stat origin/main-tools...HEAD -- doc/planning/oss-tooling/` and confirm the added/removed line counts are consistent with two scoped edits (an amendment section plus definition/pointer edits), not a whole-file rewrap.
3. Confirm no `<<<<<<<` / `>>>>>>>` conflict markers and no trailing-whitespace-only hunks appear in the diff.

**Expected Outcome**:

- `exit=0` with no output from `git diff --check`.
- Line counts proportionate to the amendment; no whitespace-only hunk.

**Notes / Clarifications**:

- The `.ai/rules/testing-strategy.md` quality gate for docs-only changes is manual verification plus `git diff --check`; this TC is the mechanical half of that requirement.

#### TC-GATE-018 - Out-of-entry containment: every backlog hunk inside M1-S9, other stories byte-identical

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, G-4, NFR-2, AC-F5-3
**Test Type(s)**: Manual (static/diff inspection + extraction)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, every story outside M1-S9
**Tags**: @docs, @diff, @containment

**Preconditions**:

- Base snapshot `/tmp/gh266-base-backlog.md` (Section 7.1, step P0).
- Repository root; `BASE` set by P0 or defaulted inside the block.

**Steps**:

1. Run **P15a**: it derives the M1-S9 entry range in HEAD (the `### M1-S9 ` heading line through the line before the next `### ` heading), then classifies every added-side hunk range from `git diff -U0` against that range.
2. Confirm `hunks: inside=N outside=0` and `hunk confinement OK`.
3. Confirm non-vacuity: `backlog.md hunks: N` with `N>=1`. Zero hunks means the amendment is absent, not that containment holds.
4. Run the four **P15a matcher self-tests**, whose coordinates P15 derives from the computed entry end (`boundary=$((end+1))`, `probe_far=$((end+50))`): `end+50` (well outside) and `end+1` (a deletion of the next `###` heading line) must both report `OUTSIDE` / `hunk confinement FAILED`; `end` (a deletion of the entry's own last line) and `start` (a `3 → 9` addition inside the entry) must report `hunks: inside=1 outside=0` / `hunk confinement OK`. Never hardcode `560`: on the reference amended tree the entry ends at 578, so the next heading line is 579.
5. Run **P15b**: extract, for every story except M1-S9, the full block from its `- AC:` line through its `- Depends on:` line (multi-line blocks included) from the base snapshot and from HEAD, then `diff -u` the two extractions.
6. Run the **P15b negative control**: apply a one-line edit to M1-S8's acceptance criterion in a `/tmp` copy (`retro output survives a malformed entry without data loss` → `retro output survives a malformed entry`) and re-extract; the comparison must now differ at exactly that line.

**Expected Outcome**:

- `M1-S9 entry lines: 529..559` at authoring time (derived, not hardcoded; the heading line stays 529 because the amendment adds no line before it).
- `hunks: inside=N outside=0`, `hunk confinement OK`, `backlog.md hunks: N` with `N>=1`.
- `P15 verdict: OK`, exit 0.
- Self-tests, in order and with coordinates derived from the entry's own range: `end+50` prints an `OUTSIDE:` line for that line number, then `hunks: inside=0 outside=1` and `hunk confinement FAILED`; `end+1` prints `OUTSIDE:` for that line number, then the same two lines; `end` prints `hunks: inside=1 outside=0` and `hunk confinement OK`; `start` prints `hunks: inside=1 outside=0` and `hunk confinement OK`.
- Concrete values at the two lengths this plan documents: base tree (`529..559`) → `609` and `560` print `OUTSIDE`, `559` and `529` print inside; reference amended tree (`529..578`) → `628` and `579` print `OUTSIDE`, `578` and `529` print inside. v1.2 hardcoded `+560,0` as "the next heading", which is an inside line at the amended length (readiness N8); the derivation removes that class of error.
- `other-story AC/Depends byte-identical`, `stories compared: 66` (observed at authoring time).
- Negative control: `negative control detected the M1-S8 edit` with a one-line diff naming the M1-S8 `- AC:` line.

**Notes / Clarifications**:

- This is the requirement readiness finding 2 found claimed but unimplemented: every other story's `- AC:` and `- Depends on:` line, plus hunk confinement, is AC-F5-3 and lives here; TC-GATE-004 no longer asserts it.
- The entry range includes the blank separator line before the next `###` heading because AC-F5-3 defines the entry as "from its heading to the line before the next `###` heading".
- A pure deletion hunk (`+c,0`) has an empty added range and is accepted only when `c` is within the entry's own lines (`c <= e`), not on the next heading line. Revision 1.2 tightened the predicate from `c <= e+1` (readiness N1); revision 1.3 derives the self-test coordinates from `end`, because v1.2's hardcoded `+560,0` was the *base* next heading line and became an inside line once the amendment extended the entry to 578 (readiness N8). The `end+1` / `end` pair now pins both sides of the boundary at whatever length the tree has, and `end+50` keeps the far probe outside a growing amendment (readiness N14).
- Observed on the unamended tree: no `backlog.md` hunk (`backlog.md hunks: 0`), so step 3 fails by design — the containment check only becomes meaningful once the amendment exists.

#### TC-GATE-019 - 2026-11-03 per-engine sentence adjudicated as the same gate, superseded not waived, bytes unchanged

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DEC-10, NFR-2, AC-F2-4
**Test Type(s)**: Manual (content inspection + byte comparison)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`, new amendment section plus the dated 2026-11-03 section
**Tags**: @docs, @status, @history

**Preconditions**:

- Base snapshot `/tmp/gh266-base-status.md` (P0).

**Steps**:

1. Run **P16** and read the `adjudication:` line.
2. Run **P7a** and confirm the dated 2026-11-03 section — which contains the per-engine sentence `Per-engine handover still requires its own two-clean-weeks evidence; that constraint is never waived.` (wrapped across source lines; compare bytes, never a single-line grep) — is byte-identical to the base revision.
3. Read the adjudication and confirm each of its six elements: it names the date `2026-11-03`; it names the per-engine sentence; it says the sentence describes the **same** M1-S9 **gate**; it says **superseded**, explicitly **not waived**; it gives the coverage reason (**stricter/stronger on coverage**); and it gives the floor reason (**elapsed/calendar time** replaced or bounded by an **exposure floor**).
4. Read the built-in adjudication mutant: P16 removes every `coverage` from the flattened amendment and must report `mutant coverage: changed=true adjudication-missing=stricter-coverage`.

**Expected Outcome**:

- `adjudication: missing=0`, exit 0.
- `2026-11-03 section byte-identical`.
- Negative control: `mutant coverage: changed=true adjudication-missing=stricter-coverage` — proving the check tests the required substance, not the presence of the word "superseded" alone.

**Notes / Clarifications**:

- DEC-10 is the decision this TC makes executable. The point is that "never waived" and "no longer defined by a calendar window" are reconciled *in the amendment*, while the dated bullet keeps its bytes (NG-3). Without this TC, a reader meets a live-looking contradiction with no recorded adjudication — readiness finding 9.
- The six marker groups map one-to-one onto AC-F2-4's clauses; none is decorative.

#### TC-GATE-020 - Amendment lead-in: calendar window alone, no elapsed-time-only phrasing, floor-only retained

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, DEC-2, AC-F2-5
**Test Type(s)**: Manual (executable content inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`, new amendment section
**Tags**: @docs, @status, @wording

**Preconditions**:

- As TC-GATE-019.

**Steps**:

1. Run **P16** and read the `lead-in:` line.
2. Confirm the amendment states the gate is no longer defined by a **calendar window alone** (`calendar-window-alone=OK`).
3. Confirm it does **not** use the elapsed-time-only formulation `no longer defined by elapsed time` (`elapsed-only-phrase=ABSENT`). That phrasing contradicts the retained 7-consecutive-days floor and was readiness finding 10.
4. Confirm `whichever comes first` is retained and scoped to the floor inside its character window (`floor-scope=OK`).
5. Read the two built-in lead-in mutants, which run on the flattened amendment (not on the raw file): the first replaces `calendar window alone` with `a fixed window` and must report `mutant lead-in: changed=true raw-single-line-noop=true calendar-window-alone=MISSING`; the second rewrites the same clause to the forbidden `no longer defined by elapsed time` and must report `mutant elapsed-only-phrase: changed=true elapsed-only-phrase=PRESENT`.

**Expected Outcome**:

- `lead-in: calendar-window-alone=OK elapsed-only-phrase=ABSENT floor-scope=OK`, exit 0.
- Negative controls: `mutant lead-in: changed=true raw-single-line-noop=true calendar-window-alone=MISSING` and `mutant elapsed-only-phrase: changed=true elapsed-only-phrase=PRESENT`. `raw-single-line-noop=true` documents why the control must not be a raw `sed`: the reference text wraps the phrase, so a single-line replacement would be a no-op (readiness N6).

**Notes / Clarifications**:

- The positive and negative halves are both required: "calendar window alone" is the remedy, and the absence of the elapsed-only phrasing is what keeps the amendment consistent with its own floor.
- This is the status-side counterpart of TC-GATE-003, which checks the floor-only scope in the backlog.

#### TC-GATE-021 - Directive citation reads `CEO-D-073 (GH-266, 2026-11-07)`

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, DEC-11, AC-F2-6
**Test Type(s)**: Manual (executable content inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`, new amendment section
**Tags**: @docs, @status, @citation

**Preconditions**:

- As TC-GATE-019.

**Steps**:

1. Run **P16** and read the `citation:` line.
2. Confirm the amendment contains the exact literal `CEO-D-073 (GH-266, 2026-11-07)` — the identifier with its tracker home and directive date, not the bare identifier.
3. Read the built-in citation mutant: P16 reduces the citation to the bare `CEO-D-073` and must report `mutant citation: changed=true citation=MISSING`.

**Expected Outcome**:

- `citation: OK`, exit 0.
- Negative control: `mutant citation: changed=true citation=MISSING`.

**Notes / Clarifications**:

- DEC-11: `CEO-D-073` exists only in the GH-266 ticket, so a bare citation is unresolvable from inside the repository. The exact-literal check is appropriate because the requirement *is* the exact form.
- A future reader may resolve `GH-266` in the tracker; the date distinguishes the directive from the change.

#### TC-GATE-022 - M1-S9 frozen regions byte-identical (Goal, Ticket, phase (a), handover-flips, covers-functions)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-5, NFR-2, AC-F1-3
**Test Type(s)**: Manual (byte comparison)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, M1-S9 entry outside the amended anchor
**Tags**: @docs, @diff, @preservation

**Preconditions**:

- Base snapshot `/tmp/gh266-base-backlog.md` (Section 7.1, step P0).

**Steps**:

1. Run **P4c**: five literal-anchored regions are sliced from the base snapshot and from HEAD as raw text (wrapping preserved, no normalisation) and compared byte for byte — `goal` (the `- Goal:` line), `ticket` (the `- Ticket:` line), `phase-a` (the `(a) **evidence accrual**` clause through `divergences reported;`), `handover-flips` (the `Handover flips the repository to the engine` sentence through `as authoritative (recorded, reversible)`), and `covers-functions` (the `Covers` sentence through `loop-driving` / `function.`).
2. Confirm all five print `byte-identical`.
3. Run **P4d** and confirm the two negative controls fire: a one-word edit inside `phase-a` and a one-space reflow of the `handover-flips` sentence must both report `bytes changed` (not `marker not found`), while `P4` still ends `P4 verdict: OK` because the mutants are self-tests.

**Expected Outcome**:

- `region goal: byte-identical (244 bytes)`, `region ticket: byte-identical (32 bytes)`, `region phase-a: byte-identical (231 bytes)`, `region handover-flips: byte-identical (85 bytes)`, `region covers-functions: byte-identical (213 bytes)` (observed at authoring time on the base tree).
- `negative control frozen-region mutation: fired=yes named_phase_a_and_handover_flips=yes`.
- `P4 verdict: OK`, exit 0.

**Notes / Clarifications**:

- The five frozen regions are stated in plan v1.2 task 1.6 (containment and inside-entry preservation), with the replacement reference in task 1.5. Spec v1.2 extends AC-F1-3 to name the same five regions (DEC-12), so this TC is bound to AC-F1-3 with no oracle/AC gap; OQ-6, which raised that gap, is resolved by spec v1.2.
- Byte comparison, not grep: a reflow of `as authoritative (recorded, reversible)` (one extra space) fails, which is exactly the kind of drift a normalised check would miss.
- The negative controls deliberately keep both anchor literals intact, so the failure must be `bytes changed`. A `marker not found` outcome would mean the anchor itself moved and is also a FAIL.

## 6. Environments and Test Data

| Aspect | Detail |
|---|---|
| Environment | Local developer worktree of this repository on branch `docs/GH-266/evidence-based-handover-gate`; no server, container, service, credential, or network dependency |
| Toolchain | `git` (branch + base revision), `bash`, `awk`, `cmp`, `grep`, `bun` (used only for `bun -e` inspection and the forbidden-literals check); all already required by the repository |
| Base revision | `origin/main-tools` (the integration branch; `f87ec185` at authoring time). All diff checks use the three-dot form `origin/main-tools...HEAD` so an advanced base cannot silently widen the comparison |
| Test data | Base-revision snapshots written to `/tmp/gh266-base-backlog.md` and `/tmp/gh266-base-status.md`; the amended files are read from the worktree. No fixtures are fabricated and no synthetic planning text is committed |
| Negative fixtures | `/tmp`-only copies, never committed and never written into the repository: the enumeration paragraph with `pr-open-unverified` removed (TC-GATE-010); `backlog.md` with a one-line M1-S8 AC edit (TC-GATE-018); `backlog.md` with a one-word `phase-a` edit plus a one-space `handover-flips` reflow (TC-GATE-022); `status.md` with statement 1 reflowed (TC-GATE-008) |
| Built-in mutants | P16 derives its four negative controls from the amendment it just read, on the same flattened form the positive check uses (`calendar window alone` removed, the forbidden `no longer defined by elapsed time` constructed, `coverage` removed, the citation reduced to `CEO-D-073`). A wrapped phrase therefore cannot turn a control into a no-op (readiness N6); each mutant reports `changed=`. |
| Forward-statement fixtures | For TC-GATE-007 a `/tmp` status fixture appends pointers to the two forward statements (in three variants: correct, pointer containing `CEO-D-073`, and one word changed inside the sentence) to prove the byte oracle distinguishes all three. |
| Guard scope | `scripts/checks/forbidden-literals.ts` scans `registry.registered` documents only: `status.md` is registered, `backlog.md` is not (it is present at `corpusBaseline 32784aff…`, and the guard rejects registering such a file). P17 therefore scans added lines directly for the three seed literals |
| Isolation | Every procedure is read-only with respect to the repository: no writes outside `/tmp`, no branch, index, or file mutation. The two planning files are under test and are never edited by a tester to make a check pass |
| Cleanup | `rm -f /tmp/gh266-*` (base snapshots, flattened text, link list, split halves) |
| Evidence capture | Command output pasted into the PR description or review comment per `.ai/rules/testing-strategy.md` ("record evidence in change artifacts: commands run + result summary") and spec §17.1 DoD |

## 7. Automation Plan and Implementation Mapping

### 7.1 Procedure Pack — How to Run, in Order

Run from the repository root on the amended branch. Every procedure is uncommitted; nothing here may be added to `tests/**` or `scripts/**` (AC-NFR1-1).

**P0 — materialise the base snapshots (run once, first):**

```bash
cd "$(git rev-parse --show-toplevel)"
BASE=origin/main-tools
git show "$BASE:doc/planning/oss-tooling/backlog.md" > /tmp/gh266-base-backlog.md
git show "$BASE:doc/planning/oss-tooling/status.md"  > /tmp/gh266-base-status.md
echo "base snapshots ready"
```

**P1 — containment and whitespace (TC-GATE-012, TC-GATE-017):**

```bash
# P1a: product files changed (change artifacts excluded)
git diff --name-only "$BASE"...HEAD -- . ':(exclude)doc/changes/**' | sort

# P1b: forbidden roots and build config must be absent
git diff --name-only "$BASE"...HEAD \
  | grep -E '^(packages|scripts|tests|doc/spec|\.opencode)/|(^|/)(package\.json|pnpm-lock\.yaml|tsconfig.*\.json|biome\.json|bunfig\.toml|\.dependency-cruiser\.cjs)$' \
  || echo "none"

# P1c: whitespace / conflict markers / trailing whitespace
git diff --check "$BASE"...HEAD; echo "exit=$?"
```

Expected: two `doc/planning/oss-tooling/*.md` lines; `none`; `exit=0` with no output.

**P2 — superseded-phrase discipline in the M1-S9 entry (TC-GATE-002):**

A backlog story entry has no blank lines inside it, so paragraph scoping would treat the whole entry as one block. The procedure therefore scopes by a ±240-character window around each occurrence, which is tight enough to be meaningful and stable under line wrapping.

```bash
bun -e '
const text = require("node:fs").readFileSync(process.argv[1], "utf8");
const start = text.indexOf("### M1-S9 ");
if (start === -1) { console.log("FAIL: M1-S9 heading not found"); process.exit(1); }
const rest = text.slice(start + 1);
const next = rest.indexOf("\n### ", 1);
const section = (next === -1 ? rest : rest.slice(0, next)).replace(/\s+/g, " ");
const re = /rolling two-week window|two clean weeks/gi;
let m, occurrences = 0, unmarked = 0;
while ((m = re.exec(section))) {
  occurrences++;
  const win = section.slice(Math.max(0, m.index - 240), m.index + m[0].length + 240);
  if (!/supersed|replac|no longer defin/i.test(win)) {
    unmarked++;
    console.log("UNMARKED:", win.slice(Math.max(0, 240 - 80), 240 + 160).trim());
  }
}
console.log(`occurrences=${occurrences} unmarked=${unmarked}`);
process.exit(unmarked === 0 ? 0 : 1);
' doc/planning/oss-tooling/backlog.md
```

Expected: `unmarked=0`, exit 0. (Base revision prints `occurrences=1 unmarked=1`.)

**P3 — four conditions and floor-only scope in the M1-S9 entry (TC-GATE-001, TC-GATE-003):**

```bash
bun -e '
const text = require("node:fs").readFileSync(process.argv[1], "utf8");
const start = text.indexOf("### M1-S9 ");
if (start === -1) { console.log("FAIL: M1-S9 heading not found"); process.exit(1); }
const rest = text.slice(start + 1);
const next = rest.indexOf("\n### ", 1);
const section = next === -1 ? rest : rest.slice(0, next);
const checks = {
  "a-truth": [/false-success incident/i, /unresolved divergence/i, /pilot paths/i],
  "b-classes": [/TDR-0005 result class/i, /real tickets/i],
  "c-floor": [/20 dispatches/i, /7 consecutive days/i, /whichever comes first/i],
  "d-corroboration": [/pm-notes/i, /tracker/i, /CI on the pushed head/i],
};
let pass = 0;
for (const [name, pats] of Object.entries(checks)) {
  const ok = pats.every((p) => p.test(section));
  if (ok) pass++;
  console.log(`${name}: ${ok ? "OK" : "MISSING"}`);
}
const floorScoped = (() => {
  const flat = section.replace(/\s+/g, " ");
  const idx = flat.search(/whichever comes first/i);
  if (idx === -1) return false;
  const win = flat.slice(Math.max(0, idx - 240), idx + 300);
  return /floor/i.test(win) && /only|binds|not an alternative|never substitut/i.test(win);
})();
console.log(`floor-scope=${floorScoped ? "OK" : "MISSING"}`);
console.log(`conditions=${pass}/4`);
process.exit(pass === 4 && floorScoped ? 0 : 1);
' doc/planning/oss-tooling/backlog.md
```

Expected: four `OK` lines, `floor-scope=OK`, `conditions=4/4`, exit 0. (Base prints `MISSING` for b/c/d and `conditions=1/4`.)

**P4 — M1-S9 entry preservation: heading, AC/dependency block, frozen regions (TC-GATE-004, TC-GATE-005, TC-GATE-022):**

```bash
BASE=${BASE:-origin/main-tools}

# P4b: heading must not appear as a changed line
git diff -U0 "$BASE"...HEAD -- doc/planning/oss-tooling/backlog.md \
  | grep -E '^[+-]#{3} M1-S9' || echo "heading unchanged"
grep -n '^### M1-S9 ' /tmp/gh266-base-backlog.md doc/planning/oss-tooling/backlog.md

# P4a: AC + Depends block byte-identical
for f in /tmp/gh266-base-backlog.md doc/planning/oss-tooling/backlog.md; do
  awk '/^### M1-S9 /{s=1} s&&/^- AC:/{p=1} p{print} p&&/^- Depends on:/{exit}' "$f"
done > /tmp/gh266-ac-both.txt
split -n l/2 /tmp/gh266-ac-both.txt /tmp/gh266-ac-part-
cmp /tmp/gh266-ac-part-aa /tmp/gh266-ac-part-ab && echo "M1-S9 AC+Depends byte-identical"
for phrase in "clean window" "refused while" "per repository and reversible" "fallback with deprecation"; do
  grep -Fq "$phrase" doc/planning/oss-tooling/backlog.md || echo "MISSING: $phrase"
done

# P4c: the frozen M1-S9 regions, byte for byte (raw text slices, wrapping preserved)
frozen_regions() { bun -e '
const fs = require("node:fs");
const base = fs.readFileSync(process.argv[1], "utf8");
const head = fs.readFileSync(process.argv[2], "utf8");
const regions = [
  ["goal", "- Goal: The typed dispatch loop", "\n"],
  ["ticket", "- Ticket: GH-239 (milestone M1)", "\n"],
  ["phase-a", "(a) **evidence accrual**", "divergences reported;"],
  ["handover-flips", "Handover flips the repository to the engine", "as authoritative (recorded, reversible)"],
  ["covers-functions", "Covers", "loop-driving\n  function."],
];
let bad = 0;
for (const [name, startLit, endLit] of regions) {
  const slice = (text) => {
    const i = text.indexOf(startLit);
    if (i < 0) return null;
    const j = text.indexOf(endLit, i);
    if (j < 0) return null;
    return text.slice(i, j + endLit.length);
  };
  const b = slice(base), h = slice(head);
  if (b === null || h === null) { bad++; console.log(`FAIL ${name}: marker not found (base=${b === null ? "missing" : "ok"}, head=${h === null ? "missing" : "ok"})`); continue; }
  if (b === h) { console.log(`region ${name}: byte-identical (${h.length} bytes)`); continue; }
  bad++; console.log(`FAIL ${name}: bytes changed (base ${b.length} bytes, head ${h.length} bytes)`);
}
process.exit(bad === 0 ? 0 : 1);
' "$1" "$2"; }

frozen_ok=1
frozen_regions /tmp/gh266-base-backlog.md doc/planning/oss-tooling/backlog.md || frozen_ok=0

# P4d: negative controls — one text edit (phase-a) and one reflow (handover-flips).
# Both keep the region's start and end literals intact, so the failure must be
# "bytes changed", not "marker not found": the oracle is bytes, not presence.
sed 's/verify-change evidence recorded per ticket/verify-change evidence recorded per run/' \
  doc/planning/oss-tooling/backlog.md > /tmp/gh266-neg-backlog-entry.md
sed -i 's/^  as authoritative/   as authoritative/' /tmp/gh266-neg-backlog-entry.md
if frozen_regions /tmp/gh266-base-backlog.md /tmp/gh266-neg-backlog-entry.md > /tmp/gh266-p4d.txt 2>&1; then neg_ok=0; else neg_ok=1; fi
if grep -q 'FAIL phase-a: bytes changed' /tmp/gh266-p4d.txt && grep -q 'FAIL handover-flips: bytes changed' /tmp/gh266-p4d.txt; then neg_named=1; else neg_named=0; fi
echo "negative control frozen-region mutation: fired=$([ "$neg_ok" -eq 1 ] && echo yes || echo no) named_phase_a_and_handover_flips=$([ "$neg_named" -eq 1 ] && echo yes || echo no)"

if [ "$frozen_ok" -eq 1 ] && [ "$neg_ok" -eq 1 ] && [ "$neg_named" -eq 1 ]; then echo "P4 verdict: OK"; else echo "P4 verdict: FAILED"; fi
[ "$frozen_ok" -eq 1 ] && [ "$neg_ok" -eq 1 ] && [ "$neg_named" -eq 1 ]
```

Expected: `heading unchanged`; identical heading lines; `M1-S9 AC+Depends byte-identical`; no `MISSING:` lines; five `region …: byte-identical (N bytes)` lines; `negative control frozen-region mutation: fired=yes named_phase_a_and_handover_flips=yes`; `P4 verdict: OK`.
If `split -n l/2` is unavailable on the host `split`, run the `awk` twice and `cmp` the two files explicitly — the assertion is identical.

**P5 — status amendment content (TC-GATE-006):**

```bash
bun -e '
const text = require("node:fs").readFileSync(process.argv[1], "utf8");
const blocks = text.split(/^## /m).slice(1).map((b) => "## " + b);
const sec = blocks.find((b) => b.includes("CEO-D-073"));
if (!sec) { console.log("amendment: not found"); process.exit(1); }
const heading = sec.split("\n")[0];
const missing = [];
const need = [
  ["date", /20\d{2}-\d{2}-\d{2}/],
  ["incident-truth", /false-success incident/i],
  ["class-coverage", /result class/i],
  ["floor-20", /20 dispatches/i],
  ["floor-7-days", /7 consecutive days/i],
  ["pm-notes", /pm-notes/i],
  ["tracker-state", /tracker state/i],
  ["ci-pushed-head", /CI on the pushed head/i],
  ["canonical-backlog", /backlog\.md/],
  ["canonical-m1-s9", /M1-S9/],
  ["residual", /residual/i],
];
for (const [name, pat] of need) if (!pat.test(sec)) missing.push(name);
const residualDocs = ["backlog-ranking.md", "roadmap.md", "cli-command-registry.md",
  "milestones/m1/commands/dispatch.md", "milestones/m1/journeys.md", "user-journeys.md",
  "milestones/m1/test-scenarios.md", "operator-requirements-2026-11.md"];
const named = residualDocs.filter((d) => sec.includes(d.split("/").pop()));
if (named.length < 2) missing.push(`residual-docs(need>=2, got ${named.length})`);
console.log(`amendment: ${heading}`);
console.log(`residual-named=${named.length}`);
console.log(`missing=${missing.length}${missing.length ? " -> " + missing.join(",") : ""}`);
process.exit(missing.length === 0 ? 0 : 1);
' doc/planning/oss-tooling/status.md
```

Expected: an `amendment:` line echoing the new dated section heading, `residual-named` of at least `2`, `missing=0`, exit 0. (Base prints `amendment: not found`.)

**P6 — status supersession pointers and forward-statement bytes (TC-GATE-007):**

```bash
bun -e '
const fs = require("node:fs");
const head = fs.readFileSync(process.argv[1], "utf8");
const base = fs.readFileSync(process.argv[2], "utf8");
const cutoff = head.indexOf("## Story delivery");
const amendBlocks = head.split(/^## /m).slice(1).map((b) => "## " + b).filter((b) => b.includes("CEO-D-073"));
const amend = amendBlocks.length ? amendBlocks[amendBlocks.length - 1] : "";
const amendStart = amend ? head.indexOf(amend) : -1;
const amendEnd = amendStart + amend.length;

// P6a: pointer presence and pointer shape, per logical unit.
// Units are blank-line paragraphs, with ordered-list items split out, so a
// pointer in item 2 cannot satisfy item 3.
const units = (t) => {
  const out = [];
  for (const para of t.split(/\n\s*\n/)) {
    if (/^\d+\. \*\*/m.test(para)) out.push(...para.split(/^(?=\d+\. \*\*)/m).filter((p) => p.trim()));
    else if (para.trim()) out.push(para);
  }
  return out;
};
let forward = 0, pointed = 0, shaped = 0, bad = 0;
for (const p of units(head)) {
  if (!/two-clean-weeks/.test(p)) continue;
  const at = head.indexOf(p);
  if (amendStart >= 0 && at >= amendStart && at < amendEnd) {
    console.log("amendment (not a forward statement):", p.trim().split("\n")[0].slice(0, 60)); continue;
  }
  if (at < cutoff) { console.log("history (no pointer required):", p.trim().split("\n")[0]); continue; }
  forward++;
  if (/supersed|]\(#/i.test(p)) pointed++;
  else { bad++; console.log("MISSING POINTER:", p.trim().replace(/\s+/g, " ").slice(0, 120)); }
  if (!p.includes("CEO-D-073")) shaped++;
  else { bad++; console.log("FAIL pointer contains CEO-D-073:", p.trim().replace(/\s+/g, " ").slice(0, 120)); }
}

// P6b: the two forward statements, byte for byte. The pointer is appended
// AFTER these bytes, so the slices must be identical.
const block = (t, startLit, endLit) => {
  const i = t.indexOf(startLit);
  if (i < 0) return null;
  const j = t.indexOf(endLit, i);
  if (j < 0) return null;
  return t.slice(i, j + endLit.length);
};
const sentences = [
  ["milestone-exit-forward", "Per backlog-ranking.md reading notes", "remains the critical path for M0 exit."],
  ["next-steps-item-3", "3. **M1 delivery start**:", "respecting the per-repo two-clean-weeks rule."],
];
let bytes = 0;
for (const [name, s, e] of sentences) {
  const b = block(base, s, e), h = block(head, s, e);
  if (b === null || h === null) { bad++; console.log(`FAIL ${name}: marker not found`); continue; }
  if (b === h) { bytes++; console.log(`forward bytes ${name}: byte-identical (${h.length} bytes)`); }
  else { bad++; console.log(`FAIL ${name}: bytes changed`); }
}

console.log(`forward=${forward} pointed=${pointed} pointer-shape=${shaped}/${forward} bytes=${bytes}/${sentences.length}`);
process.exit(forward === 2 && pointed === 2 && shaped === 2 && bytes === 2 && bad === 0 ? 0 : 1);
' doc/planning/oss-tooling/status.md /tmp/gh266-base-status.md
```

Expected after the amendment: one `history (no pointer required)` line, `forward bytes milestone-exit-forward: byte-identical (332 bytes)`, `forward bytes next-steps-item-3: byte-identical (247 bytes)`, `forward=2 pointed=2 pointer-shape=2/2 bytes=2/2`, exit 0. An `amendment (not a forward statement): ...` line is printed only when the amendment itself uses the hyphenated token; the unit is then skipped rather than counted, so the amendment may quote the dated sentence without breaking the count.

Observed on the unamended tree (exit 1, by design), verbatim:
```
history (no pointer required): - The dual-run pilot starts now and runs concurrently with M1 planning and
MISSING POINTER: Per backlog-ranking.md reading notes and the recorded M0 exit amendment (above), M1 delivery starts now and runs beside
MISSING POINTER: 3. **M1 delivery start**: milestone and 23 tickets created (GH-221 through GH-243; map below); dispatch in ranking order
forward bytes milestone-exit-forward: byte-identical (332 bytes)
forward bytes next-steps-item-3: byte-identical (247 bytes)
forward=2 pointed=0 pointer-shape=2/2 bytes=2/2
```

Observed against a `/tmp` amended status fixture (exit 0): an extra `amendment (not a forward statement): ...` line, then `forward bytes milestone-exit-forward: byte-identical (332 bytes)`, `forward bytes next-steps-item-3: byte-identical (247 bytes)`, `forward=2 pointed=2 pointer-shape=2/2 bytes=2/2`.

**P7 — status history preservation, byte for byte, no normalisation (TC-GATE-008, TC-GATE-019):**

```bash
# P7a: dated 2026-11-03 section, byte for byte (contains the per-engine sentence)
for f in /tmp/gh266-base-status.md doc/planning/oss-tooling/status.md; do
  awk '/^## M0 exit amendment and M1 re-planning \(2026-11-03\)/{f=1;print;next} f&&/^## /{exit} f{print}' "$f"
done > /tmp/gh266-hist-both.txt
split -n l/2 /tmp/gh266-hist-both.txt /tmp/gh266-hist-part-
cmp /tmp/gh266-hist-part-aa /tmp/gh266-hist-part-ab && echo "2026-11-03 section byte-identical"

# P7b: the M0 exit-criteria lead-in sentence, byte for byte
lead() { awk '/^The roadmap.s M0 exit criteria \(roadmap\.md, Milestone 0 section\) are:$/{print; exit}' "$1"; }
stmts_ok=1
lead /tmp/gh266-base-status.md > /tmp/gh266-lead-base.txt
lead doc/planning/oss-tooling/status.md > /tmp/gh266-lead-head.txt
if cmp /tmp/gh266-lead-base.txt /tmp/gh266-lead-head.txt; then echo "lead-in byte-identical"; else stmts_ok=0; fi

# P7c: the three M0 exit-criteria statements, byte for byte (no normalisation)
stmt() { # $1=file $2=1|2|3
  case "$2" in
    1) awk '/^1\. Dual-run pilot:/{p=1} /^2\. This repository adopts/{p=0} p' "$1" ;;
    2) awk '/^2\. This repository adopts/{p=1} /^3\. Decision acceptance recorded:/{p=0} p' "$1" ;;
    3) awk '/^3\. Decision acceptance recorded:/{p=1} p{print} p&&/as enumerated in the inception readiness report\./{exit}' "$1" ;;
  esac
}
for n in 1 2 3; do
  stmt /tmp/gh266-base-status.md "$n" > "/tmp/gh266-stmt-base-$n.txt"
  stmt doc/planning/oss-tooling/status.md "$n" > "/tmp/gh266-stmt-head-$n.txt"
  if cmp -s "/tmp/gh266-stmt-base-$n.txt" "/tmp/gh266-stmt-head-$n.txt"; then
    echo "statement $n byte-identical ($(wc -c < "/tmp/gh266-stmt-head-$n.txt") bytes, $(wc -l < "/tmp/gh266-stmt-head-$n.txt") lines)"
  else
    echo "FAIL statement $n"; stmts_ok=0
    diff -u "/tmp/gh266-stmt-base-$n.txt" "/tmp/gh266-stmt-head-$n.txt"
  fi
done

# P7d: negative control — a pure reflow with identical words must be detected
sed 's/beside the bash stack (shell stays authoritative), with zero/beside the bash stack (shell stays authoritative),\n   with zero/' \
  doc/planning/oss-tooling/status.md > /tmp/gh266-neg-status.md
stmt /tmp/gh266-neg-status.md 1 > /tmp/gh266-stmt-neg-1.txt
if cmp -s /tmp/gh266-stmt-base-1.txt /tmp/gh266-stmt-neg-1.txt; then
  echo "NEGATIVE CONTROL FAILED: reflow not detected"
else
  echo "negative control: reflow detected"
  diff /tmp/gh266-stmt-base-1.txt /tmp/gh266-stmt-neg-1.txt | head -6
fi
if [ "$stmts_ok" -eq 1 ]; then echo "P7 verdict: OK"; else echo "P7 verdict: FAILED"; fi
[ "$stmts_ok" -eq 1 ]
```

Expected: `2026-11-03 section byte-identical`, `lead-in byte-identical`, three `statement N byte-identical (... bytes, ... lines)` lines, `negative control: reflow detected` followed by a two-line diff, and `P7 verdict: OK` (exit 0). Observed at authoring time on the unamended tree (exit 0): `statement 1 byte-identical (213 bytes, 3 lines)`, `statement 2 byte-identical (72 bytes, 1 lines)`, `statement 3 byte-identical (582 bytes, 8 lines)`, `P7 verdict: OK`.

**P8 — corroboration rule in both files (TC-GATE-009):**

```bash
bun -e '
const fs = require("node:fs");
const text = fs.readFileSync(process.argv[1], "utf8");
let region;
if (process.argv[1].endsWith("backlog.md")) {
  const start = text.indexOf("### M1-S9 ");
  const rest = text.slice(start + 1);
  const next = rest.indexOf("\n### ", 1);
  region = next === -1 ? rest : rest.slice(0, next);
} else {
  region = text.split(/^## /m).slice(1).map((b) => "## " + b).find((b) => b.includes("CEO-D-073")) ?? "";
}
const sources = ["pm-notes", "tracker state", "CI on the pushed head"].filter((s) => region.includes(s));
const insufficient = /never sufficient|not sufficient|insufficient|never counts/i.test(region);
console.log(`${process.argv[1].split("/").pop()}: sources=${sources.length}/3 insufficiency=${insufficient ? "OK" : "MISSING"}`);
process.exit(sources.length === 3 && insufficient ? 0 : 1);
' doc/planning/oss-tooling/backlog.md
bun -e '
const text = require("node:fs").readFileSync(process.argv[1], "utf8");
const region = text.split(/^## /m).slice(1).map((b) => "## " + b).find((b) => b.includes("CEO-D-073")) ?? "";
const sources = ["pm-notes", "tracker state", "CI on the pushed head"].filter((s) => region.includes(s));
const insufficient = /never sufficient|not sufficient|insufficient|never counts/i.test(region);
console.log(`status.md: sources=${sources.length}/3 insufficiency=${insufficient ? "OK" : "MISSING"}`);
process.exit(sources.length === 3 && insufficient ? 0 : 1);
' doc/planning/oss-tooling/status.md
```

Expected: `backlog.md: sources=3/3 insufficiency=OK` and `status.md: sources=3/3 insufficiency=OK`, both exit 0.

**P9 — eleven-class set equality (TC-GATE-010):**

```bash
bun -e '
const fs = require("node:fs");
const { DELIVERY_RESULT_TOKENS } = await import("./packages/core/src/contracts/delivery-result.ts");
const text = fs.readFileSync(process.argv[1], "utf8");
const start = text.indexOf("### M1-S9 ");
if (start === -1) { console.log("FAIL: M1-S9 heading not found"); process.exit(1); }
const rest = text.slice(start + 1);
const next = rest.indexOf("\n### ", 1);
const section = next === -1 ? rest : rest.slice(0, next);
const enumPara = section.split(/\n\s*\n/).find((p) => p.includes("noop-lane-nothing-to-do"));
if (!enumPara) { console.log("FAIL: enumeration paragraph not found in M1-S9 section"); process.exit(1); }
const contract = new Set(DELIVERY_RESULT_TOKENS);
const found = [...enumPara.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
const missing = [...contract].filter((t) => !found.includes(t));
const extra = found.filter((t) => !contract.has(t));
const dup = found.filter((t, i) => found.indexOf(t) !== i);
console.log(`tokens=${found.length} missing=${missing.length} extra=${extra.length} duplicates=${dup.length}`);
if (missing.length) console.log("missing:", missing.join(","));
if (extra.length) console.log("extra:", extra.join(","));
process.exit(missing.length || extra.length || dup.length ? 1 : 0);
' doc/planning/oss-tooling/backlog.md
```

Expected: `tokens=11 missing=0 extra=0 duplicates=0`, exit 0.
Negative control (must fail): `sed 's/`pr-open-unverified`, //' doc/planning/oss-tooling/backlog.md > /tmp/gh266-neg.md` then run the same script against `/tmp/gh266-neg.md` → `tokens=10 missing=1 ... missing: pr-open-unverified`, exit 1.
Base revision control: run against `/tmp/gh266-base-backlog.md` → `FAIL: enumeration paragraph not found in M1-S9 section`, exit 1.

**P10 — frontmatter and marker invariants (TC-GATE-011):**

```bash
extract_fm() { awk 'NR==1&&$0=="---"{f=1} f{print} f&&NR>1&&$0=="---"{exit}' "$1"; }
extract_fm /tmp/gh266-base-backlog.md           > /tmp/gh266-fm-base.txt
extract_fm doc/planning/oss-tooling/backlog.md  > /tmp/gh266-fm-head.txt
cmp /tmp/gh266-fm-base.txt /tmp/gh266-fm-head.txt && echo "backlog frontmatter byte-identical"

head -1 doc/planning/oss-tooling/status.md | grep -qx -- '---' \
  && echo "FAIL: status frontmatter added" || echo "status has no frontmatter"

git diff "$BASE"...HEAD -- doc/planning/oss-tooling/ | grep -c '^+ados_distribution' || true
```

Expected: `backlog frontmatter byte-identical`; `status has no frontmatter`; `0`. (`grep -c` prints `0` and exits 1 when there are no matches — the printed `0` is the assertion.)

**P11 — doc-distribution guard (TC-GATE-013):**

```bash
bash scripts/.tests/test-doc-distribution.sh; echo "exit=$?"
```

Expected: `exit=0` and `(guard-doc-distribution)[OK] no drift — 81 in-scope docs; install set matches ados_distribution markers`.

**P12 — forbidden-literals guard (TC-GATE-014):**

```bash
bun run scripts/checks/forbidden-literals.ts; echo "exit=$?"
```

Expected: `OK forbidden-literals: 5/5 scope classes scanned, 0 violations` and `exit=0`.

**P13 — intra-repository link integrity (TC-GATE-015):**

```bash
# P13a: relative link targets added by the change
git diff -U0 "$BASE"...HEAD -- doc/planning/oss-tooling/ \
  | grep '^+' | grep -oE '\]\([^)#]+' | sed 's/^](//' \
  | grep -vE '^(https?:|mailto:)' | sort -u > /tmp/gh266-links.txt
cat /tmp/gh266-links.txt

# P13b: resolve each target relative to the containing file's directory
broken=0
while read -r target; do
  [ -z "$target" ] && continue
  [ -e "doc/planning/oss-tooling/$target" ] || [ -e "$target" ] || { echo "BROKEN: $target"; broken=$((broken+1)); }
done < /tmp/gh266-links.txt
echo "broken=$broken"
```

Expected: `broken=0` (link list may be empty; that is a pass, since no link was introduced to break).

**P14 — cross-file consistency presence (TC-GATE-016):**

```bash
bun -e '
const fs = require("node:fs");
function region(path, text) {
  if (path.endsWith("backlog.md")) {
    const start = text.indexOf("### M1-S9 ");
    const rest = text.slice(start + 1);
    const next = rest.indexOf("\n### ", 1);
    return next === -1 ? rest : rest.slice(0, next);
  }
  return text.split(/^## /m).slice(1).map((b) => "## " + b).find((b) => b.includes("CEO-D-073")) ?? "";
}
let allOk = 1;
for (const path of ["doc/planning/oss-tooling/backlog.md", "doc/planning/oss-tooling/status.md"]) {
  const text = fs.readFileSync(path, "utf8");
  const r = region(path, text);
  const corroboration = ["pm-notes", "tracker state", "CI on the pushed head"].filter((s) => r.includes(s)).length;
  const incident = /false-success incident/i.test(r) && /unresolved divergence/i.test(r);
  const classes = /result class/i.test(r) && /real tickets/i.test(r);
  const floorParas = r.split(/\n\s*\n/).filter((p) => /20 dispatches|7 consecutive days/i.test(p));
  const floor = floorParas.length === 0 ? "n/a" : floorParas.every((p) => /floor/i.test(p)) ? "OK" : "MISSING";
  const ok = corroboration === 3 && incident && classes && (floor === "OK" || floor === "n/a");
  if (!ok) allOk = 0;
  console.log(`${path.split("/").pop()}: corroboration=${corroboration}/3 incident=${incident ? "OK" : "MISSING"} classes=${classes ? "OK" : "MISSING"} floor=${floor}`);
}
process.exit(allOk ? 0 : 1);
'
```

Expected after the amendment (exit 0): `backlog.md: corroboration=3/3 incident=OK classes=OK floor=OK` and `status.md: corroboration=3/3 incident=OK classes=OK floor=OK|n/a`. Observed on the unamended tree (exit 1, by design): `backlog.md: corroboration=0/3 incident=OK classes=MISSING floor=n/a`, `status.md: corroboration=0/3 incident=MISSING classes=MISSING floor=n/a`.
Then complete TC-GATE-016 steps 2-4 by reading the two definitions side by side; the script proves presence, the read proves agreement.

**P15 — out-of-entry containment in `backlog.md` (TC-GATE-018):**

```bash
BASE=${BASE:-origin/main-tools}
FILE=doc/planning/oss-tooling/backlog.md

# P15a: every added-side hunk must lie inside the M1-S9 entry
start=$(grep -n '^### M1-S9 ' "$FILE" | cut -d: -f1)
next=$(awk -v s="$start" 'NR>s && /^### /{print NR; exit}' "$FILE")
end=$(( ${next:-$((start+1))} - 1 ))
echo "M1-S9 entry lines: $start..$end"

hunk_guard() { # $1=entry start, $2=entry end; reads hunk headers on stdin
  s=$1; e=$2; inside=0; outside=0
  while IFS= read -r h; do
    case "$h" in '@@'*) ;; *) continue ;; esac
    range=$(printf '%s\n' "$h" | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2 \4/')
    c=${range%% *}; d=${range##* }
    [ -z "$d" ] && d=1
    if [ "$d" -eq 0 ]; then
      last=$c
      ok=$([ "$c" -ge "$s" ] && [ "$c" -le "$e" ] && echo 1 || echo 0)
    else
      last=$(( c + d - 1 ))
      ok=$([ "$c" -ge "$s" ] && [ "$last" -le "$e" ] && echo 1 || echo 0)
    fi
    if [ "$ok" -eq 1 ]; then inside=$((inside+1)); else outside=$((outside+1)); echo "OUTSIDE: $h (added $c..$last, entry $s..$e)"; fi
  done
  echo "hunks: inside=$inside outside=$outside"
  if [ "$outside" -eq 0 ]; then echo "hunk confinement OK"; else echo "hunk confinement FAILED"; fi
  [ "$outside" -eq 0 ]
}

hunk_count=$(git diff -U0 "$BASE"...HEAD -- "$FILE" | grep -cE '^@@' || true)
echo "backlog.md hunks: $hunk_count"
if [ "$hunk_count" -ge 1 ]; then
  echo "non-vacuous: backlog.md changed"; present=1
  if git diff -U0 "$BASE"...HEAD -- "$FILE" | grep -E '^@@' | hunk_guard "$start" "$end"; then confine_ok=1; else confine_ok=0; fi
else
  echo "FAIL: no backlog.md hunk (amendment missing)"; present=0; confine_ok=0
  echo "hunk confinement: SKIPPED (vacuous without a backlog.md hunk)"
fi

# P15a matcher self-tests. All coordinates are DERIVED from the computed entry end,
# so they stay correct at any amended length (readiness N8): the next heading line
# is end+1 and must be OUTSIDE, the entry's own last line is end and must be
# INSIDE. The "well outside" probe is end+50 rather than a fixed line, so a larger
# amendment cannot move it inside (readiness N14).
boundary=$((end + 1))
probe_far=$((end + 50))
printf '@@ -%d,1 +%d,1 @@\n' "$probe_far" "$probe_far" | hunk_guard "$start" "$end" || true   # OUTSIDE: far away
printf '@@ -%d,1 +%d,0 @@\n' "$boundary" "$boundary" | hunk_guard "$start" "$end" || true     # OUTSIDE: next heading line
printf '@@ -%d,1 +%d,0 @@\n' "$end" "$end" | hunk_guard "$start" "$end" || true               # inside: entry's last line
printf '@@ -%d,3 +%d,9 @@\n' "$start" "$start" | hunk_guard "$start" "$end"                   # inside: within the entry

# P15b: every other story's - AC: .. - Depends on: block, byte for byte
extract_other_story_ac() {
  awk -v skip="### M1-S9 " '
    /^### /{ story=$0; inblock=0; next }
    /^- AC:/{ inblock=1; if (index(story,skip)==0) print story }
    inblock {
      if (index(story,skip)==0) print
      if ($0 ~ /^- Depends on:/) { if (index(story,skip)==0) print "--"; inblock=0 }
    }
  ' "$1"
}
extract_other_story_ac /tmp/gh266-base-backlog.md > /tmp/gh266-otherac-base.txt
extract_other_story_ac "$FILE" > /tmp/gh266-otherac-head.txt
if diff -u /tmp/gh266-otherac-base.txt /tmp/gh266-otherac-head.txt; then
  echo "other-story AC/Depends byte-identical"; stories_ok=1
else
  stories_ok=0
fi
echo "stories compared: $(grep -c '^--$' /tmp/gh266-otherac-head.txt)"

# P15b negative control: a one-line edit to M1-S8 must be detected
sed 's/retro output survives a malformed entry without data loss/retro output survives a malformed entry/' \
  "$FILE" > /tmp/gh266-neg-backlog.md
extract_other_story_ac /tmp/gh266-neg-backlog.md > /tmp/gh266-otherac-neg.txt
if diff -q /tmp/gh266-otherac-base.txt /tmp/gh266-otherac-neg.txt > /dev/null; then
  echo "NEGATIVE CONTROL FAILED: M1-S8 edit not detected"
else
  echo "negative control detected the M1-S8 edit"
  diff /tmp/gh266-otherac-base.txt /tmp/gh266-otherac-neg.txt | head -6
fi
if [ "$confine_ok" -eq 1 ] && [ "$present" -eq 1 ] && [ "$stories_ok" -eq 1 ]; then
  echo "P15 verdict: OK"; [ "$confine_ok" -eq 1 ]
else
  echo "P15 verdict: FAILED"; false
fi
```

Expected after the amendment (exit 0): `backlog.md hunks: N` with `N>=1`, `non-vacuous: backlog.md changed`, `hunks: inside=N outside=0`, `hunk confinement OK`, then the four **derived** boundary self-tests — `end+50` (`OUTSIDE`) and `end+1` (the next heading line, `OUTSIDE`) each followed by `hunks: inside=0 outside=1` + `hunk confinement FAILED`, then `end` (the entry's own last line, `hunks: inside=1 outside=0` + `hunk confinement OK`) and `start` (an addition inside the entry, `hunks: inside=1 outside=0` + `hunk confinement OK`) — then `other-story AC/Depends byte-identical`, `stories compared: 66`, `negative control detected the M1-S8 edit` with a one-line diff, and `P15 verdict: OK`.

Observed on the unamended tree (exit 1, by design; entry `529..559`, so `end+1=560`, `end+50=609`), verbatim:
```
M1-S9 entry lines: 529..559
backlog.md hunks: 0
FAIL: no backlog.md hunk (amendment missing)
hunk confinement: SKIPPED (vacuous without a backlog.md hunk)
OUTSIDE: @@ -609,1 +609,1 @@ (added 609..609, entry 529..559)
hunks: inside=0 outside=1
hunk confinement FAILED
OUTSIDE: @@ -560,1 +560,0 @@ (added 560..560, entry 529..559)
hunks: inside=0 outside=1
hunk confinement FAILED
hunks: inside=1 outside=0
hunk confinement OK
hunks: inside=1 outside=0
hunk confinement OK
other-story AC/Depends byte-identical
stories compared: 66
negative control detected the M1-S8 edit
154c154
< - AC: retro output survives a malformed entry without data loss; evidence
---
> - AC: retro output survives a malformed entry; evidence
P15 verdict: FAILED
```

Observed against a reconstructed amended tree whose M1-S9 entry ends at line 578 (`_### M1-S10_` at 579), verbatim — this is the case the v1.2 self-test got wrong (readiness N8):
```
M1-S9 entry lines: 529..578
backlog.md hunks: 0
FAIL: no backlog.md hunk (amendment missing)
hunk confinement: SKIPPED (vacuous without a backlog.md hunk)
OUTSIDE: @@ -628,1 +628,1 @@ (added 628..628, entry 529..578)
hunks: inside=0 outside=1
hunk confinement FAILED
OUTSIDE: @@ -579,1 +579,0 @@ (added 579..579, entry 529..578)
hunks: inside=0 outside=1
hunk confinement FAILED
hunks: inside=1 outside=0
hunk confinement OK
hunks: inside=1 outside=0
hunk confinement OK
other-story AC/Depends byte-identical
stories compared: 66
negative control detected the M1-S8 edit
154c154
< - AC: retro output survives a malformed entry without data loss; evidence
---
> - AC: retro output survives a malformed entry; evidence
P15 verdict: FAILED
```
The `git diff` section is inapplicable in that reconstruction (the file is a `/tmp` copy outside the repository, so `backlog.md hunks: 0`), which is why the verdict is `FAILED`; the point of the run is the derived self-test coordinates: `+579,0` is `OUTSIDE` and `+578,0` is inside, at a length where the v1.1/v1.2 hardcoded `+560,0` would have been inside.

**P16 — status amendment adjudication, lead-in wording, citation (TC-GATE-019, TC-GATE-020, TC-GATE-021):**

```bash
bun -e '
const text = require("node:fs").readFileSync(process.argv[1], "utf8");
const sec = text.split(/^## /m).slice(1).map((b) => "## " + b).find((b) => b.includes("CEO-D-073"));
if (!sec) { console.log("amendment: not found"); process.exit(1); }
const flatSec = sec.replace(/\s+/g, " ");
const need = [
  ["dated-2026-11-03", /2026-11-03/],
  ["per-engine", /per-engine/i],
  ["same-gate", /\bsame\b/i, /\bgate\b/i],
  ["superseded-not-waived", /supersed/i, /not waived|never waived|not a waiver|rather than waived/i],
  ["stricter-coverage", /stricter|stronger|higher|more stringent/i, /coverage/i],
  ["elapsed-to-floor", /elapsed|calendar/i, /floor/i],
];
// Every predicate runs on the flattened amendment. The negative controls below
// use the same form, so a phrase wrapped across lines cannot make them a no-op.
const evaluate = (flatText) => {
  const missing = need.filter(([, ...pats]) => !pats.every((p) => p.test(flatText))).map(([name]) => name);
  const idx = flatText.search(/whichever comes first/i);
  const win = idx === -1 ? "" : flatText.slice(Math.max(0, idx - 240), idx + 300);
  return {
    missing,
    alone: /calendar window alone/i.test(flatText),
    elapsed: /no longer defined by elapsed time/i.test(flatText),
    floor: idx !== -1 && /floor/i.test(win) && /only|binds|not an alternative|never substitut/i.test(win),
    citation: flatText.includes("CEO-D-073 (GH-266, 2026-11-07)"),
  };
};
const r = evaluate(flatSec);
console.log(`adjudication: missing=${r.missing.length}${r.missing.length ? " -> " + r.missing.join(",") : ""}`);
console.log(`lead-in: calendar-window-alone=${r.alone ? "OK" : "MISSING"} elapsed-only-phrase=${r.elapsed ? "PRESENT" : "ABSENT"} floor-scope=${r.floor ? "OK" : "MISSING"}`);
console.log(`citation: ${r.citation ? "OK" : "MISSING"}`);

// Negative controls on the SAME flattened form the positive check uses (N6). A
// raw single-line replacement on the wrapped reference text would match nothing:
// the raw-single-line-noop flag below reports exactly that, and the mutant still
// fires because it runs on the flattened string.
let controls = 0;
const leadMut = flatSec.replace(/calendar window alone/i, "a fixed window");
const lr = evaluate(leadMut);
const rawNoop = sec.replace(/calendar window alone/i, "a fixed window") === sec;
console.log(`mutant lead-in: changed=${leadMut !== flatSec} raw-single-line-noop=${rawNoop} calendar-window-alone=${lr.alone ? "OK" : "MISSING"}`);
if (leadMut !== flatSec && !lr.alone) controls++;
const elapsedMut = flatSec.replace(/(no longer defined by\s+)(?:an?\s+)?calendar window alone/i, "$1elapsed time");
const er = evaluate(elapsedMut);
console.log(`mutant elapsed-only-phrase: changed=${elapsedMut !== flatSec} elapsed-only-phrase=${er.elapsed ? "PRESENT" : "ABSENT"}`);
if (elapsedMut !== flatSec && er.elapsed) controls++;
const covMut = flatSec.replace(/coverage/gi, "evidence");
const cr = evaluate(covMut);
console.log(`mutant coverage: changed=${covMut !== flatSec} adjudication-missing=${cr.missing.join(",") || "none"}`);
if (covMut !== flatSec && cr.missing.includes("stricter-coverage")) controls++;
const citMut = flatSec.replace("CEO-D-073 (GH-266, 2026-11-07)", "CEO-D-073");
const cir = evaluate(citMut);
console.log(`mutant citation: changed=${citMut !== flatSec} citation=${cir.citation ? "OK" : "MISSING"}`);
if (citMut !== flatSec && !cir.citation) controls++;

const ok = r.missing.length === 0 && r.alone && !r.elapsed && r.floor && r.citation && controls === 4;
console.log(`P16 verdict: ${ok ? "OK" : "FAILED"}`);
process.exit(ok ? 0 : 1);
' doc/planning/oss-tooling/status.md
```

Expected after the amendment (exit 0), verbatim:
```
adjudication: missing=0
lead-in: calendar-window-alone=OK elapsed-only-phrase=ABSENT floor-scope=OK
citation: OK
mutant lead-in: changed=true raw-single-line-noop=true calendar-window-alone=MISSING
mutant elapsed-only-phrase: changed=true elapsed-only-phrase=PRESENT
mutant coverage: changed=true adjudication-missing=stricter-coverage
mutant citation: changed=true citation=MISSING
P16 verdict: OK
```

Observed on the unamended tree (exit 1, by design): `amendment: not found` (no mutants are printed, because the amendment section does not exist yet).

Observed against a `/tmp` amended status fixture whose lead-in wraps the phrase as `no longer defined by a` / `calendar` / `window alone` across three lines (exit 0): the eight lines above, exactly. `raw-single-line-noop=true` is the direct closure of readiness N6: a single-line replacement on the wrapped raw text matches nothing, while `changed=true` on the flattened form shows the mutant fires. `mutant elapsed-only-phrase: ... elapsed-only-phrase=PRESENT` proves the forbidden-phrase predicate is live, not merely absent.

**P17 — added-line seed-literal scan for the unregistered `backlog.md` (TC-GATE-014):**

```bash
export BASE=${BASE:-origin/main-tools}
scan_status=0
bun -e '
const { matchSeedLiteral } = await import("./scripts/checks/forbidden-literals.ts");
const { spawnSync } = require("node:child_process");
const seeds = ["ados", "ADOS_", "~/.ados"];
const base = process.env.BASE ?? "origin/main-tools";
const diff = spawnSync("git", ["diff", "-U0", `${base}...HEAD`, "--", "doc/planning/oss-tooling/"], { encoding: "utf8" }).stdout ?? "";
const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
let hits = 0;
for (const line of added) {
  const token = matchSeedLiteral(line, seeds);
  if (token) { hits++; console.log(`HIT ${token}: ${line.slice(0, 120)}`); }
}
console.log(`added-lines=${added.length} seed-hits=${hits}`);
if (added.length === 0) { console.log("FAIL: no added lines under doc/planning/oss-tooling/ (amendment missing)"); process.exit(1); }
process.exit(hits === 0 ? 0 : 1);
' || scan_status=$?
echo "seed scan exit=$scan_status"
# matcher self-tests (must print ados, ~/.ados, none)
bun -e '
const { matchSeedLiteral } = await import("./scripts/checks/forbidden-literals.ts");
const seeds = ["ados", "ADOS_", "~/.ados"];
console.log("positive:", matchSeedLiteral("vendored ados binary", seeds));
console.log("positive2:", matchSeedLiteral("~/.ados/config", seeds));
console.log("negative:", matchSeedLiteral("shadowados", seeds) ?? "none");
'
if [ "$scan_status" -eq 0 ]; then echo "P17 verdict: OK"; else echo "P17 verdict: FAILED"; fi
[ "$scan_status" -eq 0 ]
```

Expected after the amendment (exit 0): `added-lines=N seed-hits=0` with `N>=1`, `seed scan exit=0`, self-tests `positive: ados`, `positive2: ~/.ados`, `negative: none`, and `P17 verdict: OK`.

Observed on the unamended tree (exit 1, by design): `added-lines=0 seed-hits=0`, `FAIL: no added lines under doc/planning/oss-tooling/ (amendment missing)`, `seed scan exit=1`, `positive: ados`, `positive2: ~/.ados`, `negative: none`, `P17 verdict: FAILED`.

**Recommended order:** P0 → P1 → P15 → P11 → P12 → P17 → P2 → P3 → P4 → P9 → P10 → P5 → P16 → P6 → P7 → P8 → P13 → P14 → then the two manual reads (TC-GATE-016 side-by-side contradiction read and the TC-GATE-006 markdown render review). Cheap containment and guards first (a product-file or out-of-entry change makes every downstream reading moot), then the executable assertions, then the content and history reads. P15 precedes P4 because containment of the whole file is broader than preservation of one block: if a hunk escapes the M1-S9 entry, the rest of the reading is wasted.

### 7.2 TC → Procedure → Implementation Mapping

| TC ID | Procedure(s) | Execution command | Implementation status | Recorded evidence |
|---|---|---|---|---|
| TC-GATE-001 | P3 | `bun -e '…' backlog.md` (Section 7.1) | Manual Only — uncommitted inspection | `conditions=4/4` line |
| TC-GATE-002 | P2 | `bun -e '…' backlog.md` | Manual Only — uncommitted inspection | `occurrences/unmarked` line |
| TC-GATE-003 | P3 (`floor-scope`) | same as TC-GATE-001 | Manual Only — uncommitted inspection | `floor-scope=OK` |
| TC-GATE-004 | P4a | `git diff -U0` + `awk` + `cmp` + 4 greps | Manual Only — uncommitted inspection | `M1-S9 AC+Depends byte-identical` + grep count (no other-story claim) |
| TC-GATE-022 | P4c + P4d | `bun -e` raw-text slicing + two mutants | Manual Only — uncommitted inspection | 5 × `region …: byte-identical (N bytes)`; `negative control frozen-region mutation: fired=yes named_phase_a_and_handover_flips=yes`; `P4 verdict: OK` |
| TC-GATE-005 | P4b | `git diff -U0 … \| grep -E '^[+-]#{3} M1-S9'` | Manual Only — uncommitted inspection | `heading unchanged` |
| TC-GATE-006 | P5 | `bun -e '…' status.md` + render review | Semi-automated (script) + Manual (render) | `missing=0` + rendered section |
| TC-GATE-007 | P6a + P6b | `bun -e '…' status.md base-status.md` | Manual Only — uncommitted inspection | `forward=2 pointed=2 pointer-shape=2/2 bytes=2/2`; `forward bytes milestone-exit-forward: byte-identical (332 bytes)`; `forward bytes next-steps-item-3: byte-identical (247 bytes)` |
| TC-GATE-008 | P7a/P7b/P7c/P7d | `awk` extraction + `cmp` (no normalisation) + reflow negative control | Manual Only — uncommitted inspection | `2026-11-03 section byte-identical`, `lead-in byte-identical`, 3 × `statement N byte-identical`, `negative control: reflow detected` |
| TC-GATE-009 | P8 | `bun -e '…'` on both files | Semi-automated (presence) + Manual (exactly-three, per-family legibility) | `sources=3/3 insufficiency=OK` ×2 + read note |
| TC-GATE-010 | P9 + negative control | `bun -e '…'` importing the typed module | Semi-automated (executable assertion) + Manual (DEC-3 disclosure) | `tokens=11 missing=0 extra=0 duplicates=0`; negative `missing=1` |
| TC-GATE-011 | P10 | `awk` + `cmp` + `head` + `git diff \| grep -c` | Manual Only — uncommitted inspection | three expected lines |
| TC-GATE-012 | P1a/P1b | `git diff --name-only … ':(exclude)doc/changes/**'` | Manual Only — uncommitted inspection | two-line product-file list, `none` |
| TC-GATE-013 | P11 | `bash scripts/.tests/test-doc-distribution.sh` | Existing guard — no change | guard summary + `exit=0` |
| TC-GATE-014 | P12 + P17 | `bun run scripts/checks/forbidden-literals.ts`; then the added-line scan importing `matchSeedLiteral` | Existing guard (covers `status.md` only) + Manual Only uncommitted scan (covers `backlog.md`) | `5/5 … 0 violations`, `exit=0`; `added-lines=N seed-hits=0`; matcher self-tests `ados` / `~/.ados` / `none` |
| TC-GATE-015 | P13a/P13b | `git diff \| grep -oE` + existence loop | Manual Only — uncommitted inspection | `broken=0` |
| TC-GATE-016 | P14 + read | `bun -e '…'` on both files | Semi-automated (presence) + Manual (contradiction read) | two summary lines + read note |
| TC-GATE-017 | P1c + `--stat` | `git diff --check` | Manual Only — uncommitted inspection | `exit=0`, stat review |
| TC-GATE-018 | P15a/P15b | hunk-header classifier + `awk` extraction + `diff -u`, with four length-derived boundary self-tests (`end+50`, `end+1`, `end`, `start`) and a one-line negative control | Manual Only — uncommitted inspection | `hunks: inside=N outside=0`, `hunk confinement OK`, derived boundary self-tests, `other-story AC/Depends byte-identical`, `stories compared: 66`, `negative control detected the M1-S8 edit` |
| TC-GATE-019 | P7a + P16 (`adjudication`) | `cmp` of the dated section + `bun -e` marker check with a built-in mutant | Semi-automated (byte compare + content markers) + Manual (substance read) | `2026-11-03 section byte-identical`, `adjudication: missing=0`, `mutant coverage: changed=true adjudication-missing=stricter-coverage` |
| TC-GATE-020 | P16 (`lead-in`) | `bun -e` marker check with two built-in mutants on the flattened form | Manual Only — uncommitted inspection | `calendar-window-alone=OK elapsed-only-phrase=ABSENT floor-scope=OK`; `mutant lead-in: changed=true raw-single-line-noop=true calendar-window-alone=MISSING`; `mutant elapsed-only-phrase: changed=true elapsed-only-phrase=PRESENT` |
| TC-GATE-021 | P16 (`citation`) | `bun -e` exact-literal check with a built-in mutant | Manual Only — uncommitted inspection | `citation: OK`; `mutant citation: changed=true citation=MISSING` |

No test file is created or updated: **no permanent suite change is permitted or needed** (NFR-1; `.ai/rules/testing-strategy.md` invariant-test rule).

### 7.3 Failure Triage

| Symptom | Meaning | Action |
|---|---|---|
| P1a prints more than two paths, or P1b prints anything but `none` | Containment broken (AC-NFR1-1) | Stop. Revert the out-of-scope file; do not rationalise it as incidental. Re-run P1. |
| P9 prints `FAIL: enumeration paragraph not found` | The class list is prose-only or split across paragraphs, so NFR-4 is unverifiable | Ask the coder to restate the eleven classes as backticked tokens inside the handover-phase paragraph (the extraction anchor is `noop-lane-nothing-to-do`). Re-run P9. |
| P9 prints `missing=1 → pr-open-unverified` | The ticket's ten-token parenthetical was inherited (RSK-3) | Restore the token; confirm DEC-3 disclosure still names the resolution. |
| P9 prints `extra=…` | The section enumerates a class the contract does not define | Remove the extra token or reconcile with TDR-0005; never widen the contract in this change (NG-2). |
| P2 prints `unmarked=1` | A superseded phrase still *defines* the gate | Mark the mention as superseded or delete it; the definition must be the four-condition bar. |
| P3 prints `floor-scope=MISSING` | "Whichever comes first" is unscoped and can be read as an alternative to class coverage (RSK-2) | Add the floor-only sentence in the same paragraph. HIGH priority — do not defer. |
| P5 prints `amendment: not found` or `missing=…` | The status amendment is absent or incomplete (AC-F2-1) | Add the missing markers; keep the section dated and sibling to the 2026-11-03 amendment. |
| P6 prints `forward=2 pointed=0` or `pointed=1` | A forward-looking statement still stands unqualified (AC-F2-2) | Add a pointer sentence to the affected paragraph; do not rewrite the original claim. |
| P6 prints `forward≠2` | A statement was reworded away or the history bullet was dragged into scope | Restore the original sentences verbatim; the pointer is additive only. |
| P7 `cmp` differs or prints `FAIL statement N` | A historical statement's bytes changed — edit or reflow (AC-F2-3 / AC-F2-4, NFR-2) | Revert that statement to the base bytes exactly. A reflow is a failure even when every word survives; the pointer belongs in the following paragraph. |
| P15a prints `OUTSIDE` or `hunk confinement FAILED` | A `backlog.md` hunk escaped the M1-S9 entry (AC-F5-3) | Revert the out-of-entry hunk; re-run P15a. Do not "tidy" a neighbouring story. |
| P15b `diff -u` is non-empty | Another story's `- AC:` or `- Depends on:` block changed (AC-F5-3) | Restore that block byte for byte; the diff names the story and line. |
| P15a prints `FAIL: no backlog.md hunk` | The backlog amendment is absent, so containment is vacuous | This is a missing deliverable, not a containment pass. |
| P15a's next-heading probe prints `inside`, or the printed boundary coordinate is not `end+1` | Hunk-boundary regression (readiness N1/N8). The probes are derived from the entry's end, so on the reference amended tree `end+1` is `+579,0` and must be `OUTSIDE`; `+560,0` is inside there by design and is not a failure | Confirm `M1-S9 entry lines` ends at the entry's last line and that the probe uses `boundary=$((end+1))`; restore the `d=0` predicate to `c <= e` (entry's last line), not `c <= e+1`. |
| P6 prints `FAIL pointer contains CEO-D-073` | A forward pointer carries the directive id, so P5/P16 could select the wrong section (D-6) | Reword the pointer to cite the amendment ("superseded by the evidence-based handover amendment"), never the id. |
| P6 prints `FAIL …: bytes changed` naming a forward statement | A forward statement was edited while gaining its pointer (AC-F2-2, N2) | Restore the statement's bytes and append the pointer after them; a reflow also fails. |
| P6 prints `forward≠2` or `pointer-shape≠2/2` | A unit lost its pointer, or a third forward unit appeared | Restore the pointer inside the named unit; confirm the amendment did not acquire the hyphenated token as a *forward* unit (it is skipped and labelled). |
| P4 prints `FAIL …: bytes changed` naming a frozen region | A frozen M1-S9 region moved (AC-F1-3, N4) | Restore that region byte for byte; the message names it. |
| P4 prints `FAIL …: marker not found` naming a frozen region | The region's start or end literal was reworded, so the anchor moved | Restore the original wording, or re-anchor deliberately — the plan freezes these five regions. |
| P4 prints `fired=no` or `named_...=no` | The frozen-region negative control stopped working, so a green run is unproven | Investigate the fixtures; do not treat a green P4 as evidence until the controls fire. |
| P16 `adjudication: missing=…` | The 2026-11-03 per-engine adjudication is absent or lacks a required element (AC-F2-4, DEC-10) | Add the missing element: date, per-engine subject, same-gate statement, superseded-not-waived, coverage reason, elapsed→floor reason. |
| P16 `calendar-window-alone=MISSING` or `elapsed-only-phrase=PRESENT` | The lead-in is missing the "alone" qualifier or uses the elapsed-time-only phrasing that contradicts the floor (AC-F2-5) | Reword to "no longer defined by a calendar window alone" and keep the floor-only qualifier. |
| P16 `citation: MISSING` | The directive is cited without its tracker home and date (AC-F2-6, DEC-11) | Use the exact form `CEO-D-073 (GH-266, 2026-11-07)`. |
| P16 prints `mutant … changed=false` | A negative control could not be applied to the amendment's wording, so that predicate is unproven | Reword the amendment so the control applies, or fix the pattern; do not accept a verdict whose controls did not fire. |
| P16 prints `P16 verdict: FAILED` while the three positive lines look right | One of the four mutants did not fire | Read the `changed=` and mutant lines; the verdict requires `controls === 4`. |
| P8 prints `sources<3` in either file | The corroboration rule is vague or incomplete (AC-F3-1, RSK-4) | Name the missing source explicitly; do not substitute a synonym. |
| P8 prints `insufficiency=MISSING` | The "engine token alone is not enough" rule is absent | State it explicitly; without it the gate can be satisfied by a self-claimed success. |
| P10 frontmatter differs, or `ados_distribution` count > 0 | Decoration or distribution class was invented (AC-F5-2, DEC-9) | Revert the frontmatter; `doc/planning` stays outside distribution scope. |
| P4b prints a changed heading line | Anchor drift (AC-F5-1, DEC-8) | Restore the heading text exactly. |
| P11 non-zero or drift line | A scoped doc was disturbed or a marker was removed | Usually indicates the diff escaped `doc/planning`; check P1a first. |
| P12 non-zero naming `status.md` | A forbidden literal was introduced in the registered doc | Reword the text; never add an allowlist entry (that touches `scripts/**`). |
| P17 prints `HIT …` or `seed-hits>0` | A seed literal was added to the diff under `doc/planning/oss-tooling/` — the case the guard cannot see for `backlog.md` | Reword the added line. Never register `backlog.md` or extend the allowlist: both violate AC-NFR1-1. |
| P17 prints `FAIL: no added lines` | The scanned diff is empty, so a green result would be vacuous | Confirm the amendment exists before treating the literal scan as evidence. |
| P13 `broken>0` | A pointer or reference does not resolve | Fix the path or anchor; a pointer that 404s is worse than none. |
| P14 shows a threshold or source-count difference between files | Cross-file contradiction (AC-NFR3-1) | Make the status amendment defer to `backlog.md` for the numbers instead of restating them divergently. |
| Any check fails only inside the *secondary* planning documents (`roadmap.md`, `backlog-ranking.md`, …) | This is the declared residual **G-2**, expected by design | Record as accepted residual; do **not** open a TC, do not edit those files (spec §7.2, NG-5). Escalate to the owner at PR time. |

**Scope note for triage:** a failure in the two amended files blocks the change; a failure in the secondary documents is the declared residual and blocks only the *follow-up* change, never this one. Confusing those two is the most likely way this plan gets misapplied.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation in this plan |
|---|---|---|
| TR-1 | Prose checks are judgment-shaped, so a reviewer can "pass" a weakened bar by reading generously | The three load-bearing properties (four conditions, floor-only scope, eleven-class set) each have an executable presence/extraction check with a stated base-revision failing value |
| TR-2 | The set-equality check depends on an extractable enumeration paragraph, so a stylistic rewrite could make it unverifiable rather than wrong | Stated as a derived testability requirement of NFR-4/DM-2; P9 fails loudly with an actionable message instead of passing vacuously |
| TR-3 | History-preservation checks compare against `origin/main-tools`, which may advance | Three-dot diff plus base snapshots taken at run time; if the base advances, P0 re-materialises snapshots and the comparison remains valid (the regions are stable history) |
| TR-4 | "No new forbidden literal attributable to the two files" could be read as "the guard is green", which it already was — and the guard never reads `backlog.md` at all | TC-GATE-014 combines the guard (which can only report on `status.md`) with P17's added-line scan of both files, so the attribution is made by the plan, not assumed from a green guard |
| TR-5 | A green run could be mistaken for evidence that the *future* handover gate works | G-1 and OQ-1 state explicitly that operational enforcement is out of testable scope for this change |
| TR-6 | A containment oracle that inspects only the M1-S9 block would pass while another story drifts — the exact gap readiness finding 2 found | AC-F5-3 is verified by TC-GATE-018 with two independent mechanisms (hunk confinement and a full out-of-entry byte comparison), each with a live self-test |
| TR-7 | The forbidden-literals guard is silent on `backlog.md`, so "guard green" could be read as full coverage | TC-GATE-014 records the scan-set limitation and covers the gap with P17's added-line scan, whose matcher is the production `matchSeedLiteral` |
| TR-8 | A byte-exact history check could be replaced by a normalised grep again, silently weakening the oracle | The plan states the oracle is bytes-not-words, ships a reflow negative control (P7d) with its expected `FAIL`, and records the retraction in TC-GATE-008 |
| TR-9 | A forward pointer containing `CEO-D-073` would make section selection ambiguous for P5/P16, which find the amendment by that literal | P6 enforces the pointer-shape rule (pointer units must not contain `CEO-D-073`) and selects the *last* `##` block containing the id, so a stray mention cannot quietly redirect the selection |
| TR-10 | A negative control can silently become a no-op when the phrase it targets is wrapped across lines (readiness N6) | P16's mutants run on the same flattened text the positive check uses and print `changed=` plus `raw-single-line-noop=`; a control that does not fire fails the verdict |
| TR-11 | A reader could mistake the frozen-region oracle (TC-GATE-022) for a plan-only or over-broad check | Spec v1.2 extends AC-F1-3 to name the same five regions (DEC-12) and plan v1.2 states the freeze in task 1.6, so AC, plan and TC agree; OQ-6 is resolved |

### 8.2 Assumptions

- **A-1**: `origin/main-tools` is the correct comparison base for this change (repository branch model; feature branches come from `main-tools`).
- **A-2**: `bun` executes the pinned version and can import `packages/core/src/contracts/delivery-result.ts` directly (verified at authoring time; the import resolves from the repository root).
- **A-3**: `DELIVERY_RESULT_TOKENS` remains the normative eleven-token set and is not modified by this change (spec §13, NG-2); the check reads it as ground truth, and a contract change would correctly surface as `extra`/`missing` here.
- **A-4**: NFR-6 (reversibility) is a release property verified by containment, not by executing a revert; a revert test would mutate the branch and is out of scope for a review-time procedure.
- **A-5**: The two planning files are internal planning documents with no installed consumer that parses them, so byte-preservation checks (rather than semantic-equivalence checks) are the correct bar for history and frontmatter.
- **A-6**: Markdown rendering review is human; the repository has no Markdown renderer gate, and the amended regions are plain prose, bullets, and links.
- **A-7**: `scripts/checks/forbidden-literals.ts` scans `registry.registered` documents only, and `backlog.md` cannot be registered because it exists at `corpusBaseline`; the guard's silence on the backlog is structural, not a defect this change may fix (fixing it would touch `scripts/**`). P17 is the compensating control.
- **A-8**: `matchSeedLiteral` is exported by the guard module and can be imported read-only from `bun -e`; this keeps the added-line scan on the production matching semantics instead of a re-implemented regex.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Disposition |
|---|---|---|---|---|
| OQ-1 | When M1-S9 delivers, what executable check proves the four-condition bar on a real repository (dispatch corpus completeness, class coverage, corroboration across pm-notes/tracker/CI)? | No — for this change | M1-S9 (GH-239) delivery | Declared gap G-1. Not a test case here; the predicate is prose planning truth (spec §7.3 defers machine encoding). |
| OQ-2 | Which secondary planning documents are refreshed in the follow-up, and does the owner accept the residual in the meantime? | No | Owner / PM | Declared gap G-2. Consistency checks over those files are expected to FAIL by design and are recorded as out-of-scope residual, never as TCs. |
| OQ-3 | Should the status amendment enumerate every residual document or a representative subset? | No | Owner | This plan requires naming at least two (P5) plus a manual comparison against spec §7.2. If the owner prefers a shorter note, the manual comparison is the binding read. |
| OQ-4 | Should the amended definition appear identically in both files, or should `status.md` summarise and defer? | No | Answered by spec F-2 | Summary plus pointer, backlog canonical. TC-GATE-016 accepts a deferring summary, provided no threshold or source count contradicts the backlog. |
| OQ-5 | AC-NFR5-1 says "the forbidden-literals check reports no new violation attributable to the two changed files", but that check only scans registered docs and `backlog.md` is not one. Should the AC name the compensating scan, narrow the attribution to the guard's actual scan set, or accept the combined evidence? | No — resolved for this change by combined evidence | Owner / spec-writer | Spec v1.1 left NFR-5/AC-NFR5-1 as written; this plan satisfies the intent by running the guard *and* P17, and records the mismatch. Recommend a one-line AC refinement in the follow-up: "the guard reports 0 violations on its scan set, and no seed literal appears in added lines of either changed file". |
| OQ-6 | Should the plan's five-region M1-S9 freeze (Goal, Ticket, phase (a), handover-flips, covers-functions) have an AC-level home? | Closed — resolved by spec v1.2 | Owner / spec-writer | AC-F1-3 now names the five regions (DEC-12) and plan v1.2 states the freeze in task 1.6; TC-GATE-022 is bound to AC-F1-3 with no oracle/AC gap. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-07 | @test-plan-writer | Initial test plan for spec v1.0: 13 ACs covered by 17 TCs (bidirectional traceability, no orphans), 14 uncommitted inspection procedures with validated base-revision failing values, 3 doc guards, run order, failure triage, and two declared gaps (G-1 future enforcement, G-2 declared residual). |
| 1.1 | 2026-11-07 | @test-plan-writer | Aligned to spec v1.1 and readiness-review iteration 1. **Finding 2 (critical, closed):** TC-GATE-004 no longer claims out-of-entry preservation it did not check; new TC-GATE-018 + P15 verify every `backlog.md` `-U0` hunk lies inside the M1-S9 entry and every other story's `- AC:`/`- Depends on:` block is byte-identical, with two matcher self-tests and a one-line negative control. **Finding 4 (major, closed):** P7c's whitespace-normalised `grep -F` replaced by byte-exact extraction of the lead-in and the three M0 exit-criteria statements (P7b/P7c) plus a reflow negative control (P7d); new TC-GATE-019/020/021 + P16 cover AC-F2-4 (2026-11-03 per-engine adjudication, superseded not waived), AC-F2-5 (calendar window alone, floor-only retained) and AC-F2-6 (`CEO-D-073 (GH-266, 2026-11-07)`). **Finding 5 (minor, closed):** TC-GATE-014 records that the guard scans registered docs only and never reads `backlog.md`; new P17 applies the production `matchSeedLiteral` to added lines with a non-vacuity guard and matcher self-tests. Traceability extended to 17 ACs / 21 TCs (AC-F5-3, AC-F2-4/5/6 added; AC-F2-3 and AC-NFR1-1 reworded). Every new or changed procedure was run on the unamended tree and its observed output recorded. Open question OQ-5 records the residual AC-NFR5-1 wording mismatch. |
| 1.2 | 2026-11-08 | @test-plan-writer | DoR iteration 2 remediation (final iteration). **N1 (closed):** P15a's pure-deletion branch tightened from `c <= e+1` to `c <= e`, and a `+560,0` boundary self-test added (a deletion of the next `###` heading line is now `outside`), with a `+559,0` counter-test proving the entry's own last line stays `inside`; observed `OUTSIDE: @@ -560,1 +560,0 @@ (added 560..560, entry 529..559)` + `hunk confinement FAILED`. **N2 (closed, test-plan side):** P6 extended with P6b, a byte-exact oracle for the two forward-looking status statements (`forward bytes milestone-exit-forward: byte-identical (332 bytes)`, `forward bytes next-steps-item-3: byte-identical (247 bytes)`), and with the pointer-shape rule enforced (`CEO-D-073` removed from the accepted pointer markers and its presence in a pointer unit made a FAIL); unit scoping now splits ordered-list items and skips the amendment section. **N4 (closed):** P4 extended with P4c/P4d — the five frozen M1-S9 regions compared byte for byte from raw text — and new TC-GATE-022 bound to AC-F1-3 (spec v1.2 extends AC-F1-3 to name the same five regions under DEC-12; OQ-6 is resolved). **N6 (closed):** TC-GATE-020's lead-in control replaced by P16 built-in mutants that run on the flattened amendment; the output now prints `raw-single-line-noop=true` next to `mutant lead-in: changed=true`, proving the wrapped phrase would have defeated a raw single-line replacement. Traceability 17 ACs / 22 TCs / 18 procedure blocks (P0-P17, with P4 and P6 extended in place so the plan's p00-p17 list stays valid). |
| 1.3 | 2026-11-08 | @test-plan-writer | DoR iteration 3 precision pass; no oracle strength or AC mapping changed. **N8 (blocking, closed):** P15's boundary self-test no longer hardcodes base-tree line 560. The guard now derives `boundary=$((end+1))` and `probe_far=$((end+50))`, so the next-heading probe is `+560,0` on the base tree and `+579,0` on the reference amended tree (entry `529..578`), where `+560,0` is an inside line. TC-GATE-018's step and expected strings, and P15's expected/observed blocks, now state the derived coordinates plus both observed runs (`+560,0` OUTSIDE at `529..559`; `+579,0` OUTSIDE and `+578,0` inside at `529..578`). **N14 (closed):** the "well outside" probe is `end+50` (`609` base, `628` amended) instead of a fixed `600`, so a larger amendment cannot pull it inside. **N9 (closed):** the AC-F1-3 forward row now lists TC-GATE-004, TC-GATE-005 and TC-GATE-022, the AC-F1-3 row text names the heading, TC-GATE-005's Related IDs add AC-F1-3, and the reverse table row reads `AC-F5-1, AC-F1-3`. Traceability unchanged at 17 ACs / 22 TCs / 18 procedure blocks (P0-P17). |

## 10. Test Execution Log

Populated during delivery and review (`.ai/rules/testing-strategy.md`: record commands run and result summary; spec §17.1 DoD).

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| — | — | Not run | Pending delivery of the amendment (phase 6) |
