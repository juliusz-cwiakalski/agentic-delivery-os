---
id: chg-GH-266-test-plan
status: Proposed
created: 2026-11-07T00:00:00Z
last_updated: 2026-11-07T00:00:00Z
owners: [engineering]
service: delivery-os-planning
labels: [change, docs]
version_impact: none
summary: "Docs-only verification of the M1-S9 handover-gate amendment. Prove by direct inspection of the diff and the two amended planning files that `clean` is now the conjunction of pilot-path truth, eleven-class TDR-0005 coverage on real tickets, the exposure floor, and corroboration; that the superseded rolling two-week window no longer defines the gate while the dated 2026-11-03 amendment and M0 exit criteria stay byte-identical; that the eleven enumerated classes are set-equal to `DELIVERY_RESULT_TOKENS` (including `pr-open-unverified`, DEC-3); that the corroboration rule names exactly pm-notes phases, tracker state, and CI on the pushed head in both files; that the diff is exactly two files under `doc/planning/oss-tooling/` with unchanged `backlog.md` frontmatter, no `ados_distribution` marker, unchanged M1-S9 heading, and no source/test/spec change; and that the doc-distribution, forbidden-literals, and link guards stay green. No test code, suite, or runtime harness is added: 17 TCs are reproducible inspection procedures with recorded commands and expected output, plus two honestly declared gaps."
links:
  change_spec: ./chg-GH-266-spec.md
  implementation_plan: null   # authored in delivery_planning (phase 4)
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Amend the M1-S9 handover gate to an evidence-based clean bar

## 1. Scope and Objectives

This change moves one sentence of planning truth: the M1-S9 per-repository handover gate stops being a rolling two-week calendar window and becomes a conjunction of four conditions — pilot-path truth, total TDR-0005 class coverage on real tickets, a minimum exposure floor, and corroboration against non-engine evidence. Nothing executes at runtime, so the risk this plan must control is *documentary*: the gate could be weakened in prose (floor read as an alternative to class coverage, or "success" accepted from the engine's own token), the enumeration could silently inherit the ticket's ten-token list, or the amendment could drift into another story's acceptance criteria or rewrite dated history that must stay as recorded. Each of those is a defect a reviewer must be able to see, not infer, which is why every acceptance criterion is bound here to an explicit command with an expected output rather than to a reading impression.

Three properties are load-bearing and are tested independently so that one cannot pass behind another: (i) the amended `clean` definition is a four-part conjunction with a floor-only "whichever comes first"; (ii) the eleven enumerated classes are set-equal to the typed contract, verified mechanically, not by prose inspection; (iii) history (the dated 2026-11-03 amendment bullets, the M0 exit-criteria list, the M0 pilot statements) and every unrelated story AC and dependency are byte-identical to the base revision.

### 1.1 In Scope

- The M1-S9 entry in `doc/planning/oss-tooling/backlog.md`: four-condition `clean` definition, floor-only scope statement, eleven-class enumeration, corroboration rule, and preservation of its heading, acceptance criteria, dependency line, and phase structure.
- The new dated CEO-D-073 amendment section in `doc/planning/oss-tooling/status.md`, its supersession pointers on the two forward-looking statements, its declared-residual naming, and preservation of dated history.
- Diff containment, frontmatter/marker invariants, and the repository doc guards (`test-doc-distribution.sh`, `forbidden-literals.ts`, intra-repository link integrity).
- Cross-file semantic consistency between the two amended files on the four conditions, the floor-only scope, and the three corroboration sources.

### 1.2 Out of Scope & Known Gaps

- **Known gap G-1 — future operational enforcement is not testable here.** Nothing in this change evaluates a real handover. The amended bar becomes executable only when M1-S9 (GH-239) delivers the dispatch engine and a handover decision is actually taken. No TC claims to test that evaluation; the plan tests only that the *definition* is correct, complete, and consistent. See open question OQ-1.
- **Known gap G-2 — the declared residual is expected to stay inconsistent by design.** `backlog-ranking.md`, `roadmap.md`, `cli-command-registry.md`, `milestones/m1/commands/dispatch.md`, `milestones/m1/journeys.md`, `user-journeys.md`, `milestones/m1/test-scenarios.md`, and `operator-requirements-2026-11.md` still restate the superseded M1-S9 calendar phrasing (spec §7.2). A consistency check over those files **will FAIL by design** in this change. That failure is recorded as accepted residual, not as a test case, and the only thing verified about them is that this change does not edit them (TC-GATE-012) and that the status amendment names them (TC-GATE-006). See open question OQ-2.
- **Known gap G-3 — the GH-239 ticket body is stale by design.** It quotes the superseded definition verbatim; correcting it is reported to the owner at PR time and is outside this change (spec §7.2, §17.1). No TC tests ticket state.
- **Not applicable:** unit, integration, contract-execution, E2E, performance, migration, telemetry, and security-surface testing. There is no runtime code path, no schema, and no emitted artifact; the only "contract" tested is a static set comparison against `DELIVERY_RESULT_TOKENS`.
- **Not applicable:** M0 exit criterion "zero false-success incidents on pilot paths over two weeks". It is a different milestone gate and is verified only as *preserved* (TC-GATE-008), never as *amended*.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-266-spec.md`](./chg-GH-266-spec.md) v1.0 | Binding source for F-1..F-5, AC-F1-1..AC-NFR3-1 (13 ACs), NFR-1..NFR-6, DM-1..DM-3, DEC-1..DEC-9 |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Test layers: static/diff and content checks for `doc/**`; fallback rule for docs-only changes (automated tests **N/A**, manual verification + `git diff --check` required); invariant-test rule (branch-diff shape checks belong to review gates, not the permanent suite) |
| [`doc/planning/oss-tooling/backlog.md`](../../../planning/oss-tooling/backlog.md) | File under test (M1-S9 entry) |
| [`doc/planning/oss-tooling/status.md`](../../../planning/oss-tooling/status.md) | File under test (amendment, pointers, history) |
| [`packages/core/src/contracts/delivery-result.ts`](../../../../packages/core/src/contracts/delivery-result.ts) | Normative `DELIVERY_RESULT_TOKENS` set used by the set-equality check |
| [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) | Decision adopting the eleven-token vocabulary and token-level dual-run parity |
| [`scripts/.tests/test-doc-distribution.sh`](../../../../scripts/.tests/test-doc-distribution.sh) | Distribution-marker drift guard (AC-NFR5-1) |
| [`scripts/checks/forbidden-literals.ts`](../../../../scripts/checks/forbidden-literals.ts) | Forbidden-literal scan (AC-NFR5-1) |
| `CEO-D-073` (owner directive, quoted in spec §13) | Source of the evidence-based bar and the corroboration rule |
| GH-266 ticket | Ticket scope: two files; ten-token parenthetical resolved by DEC-3 |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

Forward traceability (every AC appears exactly once in this table):

| AC ID | Requirement (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | M1-S9 `clean` states all four conditions (truth, class coverage, floor, corroboration) | TC-GATE-001 | Covered |
| AC-F1-2 | "rolling two-week window" / "two clean weeks" no longer define the gate; "whichever comes first" applies only to the floor | TC-GATE-002, TC-GATE-003 | Covered |
| AC-F1-3 | M1-S9 acceptance criteria and dependency line unchanged (incl. "clean window", refusal/offer, reversibility, bash fallback) | TC-GATE-004 | Covered |
| AC-F2-1 | One new dated CEO-D-073 amendment section: composite bar, corroboration rule, canonical pointer, declared residual | TC-GATE-006 | Covered |
| AC-F2-2 | Both forward-looking restatements of the two-clean-weeks rule carry a supersession pointer | TC-GATE-007 | Covered |
| AC-F2-3 | 2026-11-03 bullets, M0 exit-criteria list, M0 pilot statements byte-identical | TC-GATE-008 | Covered |
| AC-F3-1 | Both files state engine-claimed success is never sufficient and name exactly pm-notes phases, tracker state, CI on the pushed head | TC-GATE-009 | Covered |
| AC-F4-1 | Enumeration set-equal to `DELIVERY_RESULT_TOKENS` (11/11, incl. `pr-open-unverified`, 0 extra); DEC-3 resolution disclosed | TC-GATE-010 | Covered |
| AC-F5-1 | M1-S9 heading text unchanged | TC-GATE-005 | Covered |
| AC-F5-2 | `backlog.md` frontmatter byte-identical; no frontmatter added to `status.md`; no `ados_distribution` marker added | TC-GATE-011 | Covered |
| AC-NFR1-1 | Exactly two changed files, both under `doc/planning/oss-tooling/`; nothing under `packages/`, `scripts/`, `tests/`, `doc/spec/`, `.opencode/`, or build config | TC-GATE-012, TC-GATE-017 | Covered |
| AC-NFR5-1 | Doc-distribution guard exit 0; no new forbidden literal attributable to the two files; no broken intra-repo link | TC-GATE-013, TC-GATE-014, TC-GATE-015 | Covered |
| AC-NFR3-1 | No contradiction between the files on the four conditions, the floor-only scope, and the three corroboration sources | TC-GATE-016 | Covered |

Reverse traceability (no orphan test cases):

| TC ID | AC ID(s) |
|---|---|
| TC-GATE-001 | AC-F1-1 |
| TC-GATE-002 | AC-F1-2 |
| TC-GATE-003 | AC-F1-2 |
| TC-GATE-004 | AC-F1-3 |
| TC-GATE-005 | AC-F5-1 |
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
| NFR-1 | Docs-only containment (2 files; 0 in code/spec/opencode/build roots) | TC-GATE-012, TC-GATE-017 | Covered |
| NFR-2 | Historical integrity (2026-11-03 bullets, M0 exit criteria, M0 pilot statements, `backlog.md` frontmatter) | TC-GATE-008, TC-GATE-011, TC-GATE-004 | Covered |
| NFR-3 | Semantic consistency across the two files | TC-GATE-016 | Covered (semi-automated: presence script + contradiction read) |
| NFR-4 | Contract fidelity of the enumeration (11/11, 0 missing, 0 extra) | TC-GATE-010 | Covered (mechanical) |
| NFR-5 | Guard cleanliness (distribution guard, forbidden literals, links) | TC-GATE-013, TC-GATE-014, TC-GATE-015 | Covered |
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

The procedures below are therefore **uncommitted, reproducible inspection commands**. Each states its expected output, and each was validated against the base revision, where the relevant checks are expected to *fail* pre-change (see the falsifiability anchors in Section 5.2) — which is what makes them falsifiable rather than decorative.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Impact | Priority | AC Coverage | Layer |
|---|---|---|---|---|---|---|
| TC-GATE-001 | Four-condition composite `clean` predicate present in M1-S9 | Happy Path | Critical | High | AC-F1-1 | Content |
| TC-GATE-002 | Superseded calendar phrasing no longer defines the M1-S9 gate | Negative | Critical | High | AC-F1-2 | Content |
| TC-GATE-003 | "Whichever comes first" is scoped to the floor only | Corner Case | Critical | High | AC-F1-2 | Content |
| TC-GATE-004 | M1-S9 acceptance criteria and dependency line byte-identical | Regression | Critical | High | AC-F1-3 | Static/diff |
| TC-GATE-005 | M1-S9 heading text unchanged | Regression | Important | High | AC-F5-1 | Static/diff |
| TC-GATE-006 | Dated CEO-D-073 amendment section present with bar, corroboration, pointer, residual | Happy Path | Critical | High | AC-F2-1 | Content |
| TC-GATE-007 | Supersession pointers on the two forward-looking status statements | Happy Path | Important | High | AC-F2-2 | Content |
| TC-GATE-008 | status.md dated history and M0 exit/pilot statements byte-identical | Regression | Critical | High | AC-F2-3 | Static/diff |
| TC-GATE-009 | Corroboration insufficiency rule with exactly three sources in both files | Happy Path | Critical | High | AC-F3-1 | Content |
| TC-GATE-010 | Eleven enumerated classes set-equal to `DELIVERY_RESULT_TOKENS`; DEC-3 disclosed | Contract | Critical | High | AC-F4-1 | Contract (set equality) |
| TC-GATE-011 | Frontmatter and distribution-marker invariants | Negative | Important | Medium | AC-F5-2 | Static/diff |
| TC-GATE-012 | Diff containment: exactly two planning files, no code/spec paths | Negative | Critical | High | AC-NFR1-1 | Static/diff |
| TC-GATE-013 | Doc-distribution guard exits 0 | Regression | Important | Medium | AC-NFR5-1 | Guard |
| TC-GATE-014 | Forbidden-literals check reports no new violation | Regression | Important | Medium | AC-NFR5-1 | Guard |
| TC-GATE-015 | No broken intra-repository link introduced | Edge Case | Important | Medium | AC-NFR5-1 | Guard |
| TC-GATE-016 | Cross-file consistency of conditions, floor scope, and corroboration sources | Corner Case | Critical | High | AC-NFR3-1 | Content |
| TC-GATE-017 | Whitespace/conflict-marker clean and no incidental reformatting | Negative | Minor | Medium | AC-NFR1-1 | Static/diff |

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
3. Confirm no hunk of `git diff -U0` touches the `- Ticket: GH-239` line or the `- Depends on:` dependency list.

**Expected Outcome**:

- `cmp` prints nothing and the wrapper echoes `M1-S9 AC+Depends byte-identical`.
- All four greps match once each inside the M1-S9 section.
- No other story's `- AC:` or `- Depends on:` line appears in the diff.

**Notes / Clarifications**:

- The amendment changes the *definition of* `clean`; it must not touch the sentence that *uses* the phrase "clean window". Both are true simultaneously and this TC is what distinguishes them.

#### TC-GATE-005 - M1-S9 heading text unchanged

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, DEC-8, AC-F5-1
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

- `amendment: ## <dated heading containing CEO-D-073>`, `residual-named` of at least 2, `missing=0`, exit code 0. The marker set covers: `CEO-D-073`; false-success/incident truth; TDR-0005 result-class coverage; the `20 dispatches` / `7 consecutive days` floor; `pm-notes`; `tracker state`; `CI on the pushed head`; a `backlog.md` + `M1-S9` canonical pointer; the word residual plus at least two residual document filenames.
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

1. Run procedure **P6**: split the file into blank-line paragraphs, ignore paragraphs located before `## Story delivery` (dated history), and for every remaining paragraph containing `two-clean-weeks` require a pointer marker (`CEO-D-073`, `supersed…`, or an in-document link `](#…)`).
2. Confirm exactly two forward-looking occurrences are found, matching the spec's named locations: the paragraph after "Milestone exit: pending" and item 3 of "Proposed next steps".
3. Confirm the 2026-11-03 bullet is *not* counted as forward-looking (it is history and must carry no pointer; TC-GATE-008 proves it is untouched).

**Expected Outcome**:

- `forward=2 pointed=2`, exit code 0.
- Each of the two statements still says what it said, with a pointer beside it — not rewritten as if it had never said the calendar rule (DEC-6).

**Notes / Clarifications**:

- Falsifiability anchor: on `origin/main-tools` the same procedure prints `forward=2 pointed=0`, so a pass cannot be produced by the pre-existing word "amendment" elsewhere in those paragraphs. The pointer must be specifically to the new section.

#### TC-GATE-008 - status.md dated history and M0 exit/pilot statements byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-2, DEC-6, DEC-7, AC-F2-3
**Test Type(s)**: Manual (static/diff inspection)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/status.md` regions
**Tags**: @docs, @diff, @history

**Preconditions**:

- Base snapshot `/tmp/gh266-base-status.md` (Section 7.1, step P0).

**Steps**:

1. Run procedure **P7a**: extract the `## M0 exit amendment and M1 re-planning (2026-11-03)` region (heading through the line before the next `## `) from base and worktree, then `cmp`.
2. Run procedure **P7b**: extract the M0 exit-criteria list (from `The roadmap's M0 exit criteria` through the line ending `as enumerated in the inception readiness report.`), then `cmp`.
3. Run procedure **P7c**: normalise whitespace (`tr '\n' ' ' | tr -s ' '`) and `grep -F` for the three M0 pilot statements (`stories that do not touch dispatch are unconstrained`; `requires its per-repository two-clean-weeks evidence`; `remains the critical path for M0 exit.`). Normalisation is required because the source wraps mid-sentence.
4. Inspect `git diff -U0 origin/main-tools...HEAD -- doc/planning/oss-tooling/status.md` and confirm no hunk header covers a line inside those regions.

**Expected Outcome**:

- P7a and P7b print nothing from `cmp` and echo `identical`.
- P7c reports no `MISSING` line for any of the three statements.
- The only status.md hunks are the new amendment section and the two pointer additions.

**Notes / Clarifications**:

- This is the check that stops an over-eager contributor from "cleaning up" the superseded phrasing inside the dated record. The pointer is *additive*; the history is not rewritable (NG-3, DEC-6).
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
**Target Layer / Location**: change diff vs `origin/main-tools`
**Tags**: @diff, @containment

**Preconditions**:

- Branch HEAD contains the change artifacts plus the two amended files; `origin/main-tools` is fetched.

**Steps**:

1. Run procedure **P1a**: `git diff --name-only origin/main-tools...HEAD -- . ':(exclude)doc/changes/**' | sort` and read exactly two path lines.
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

#### TC-GATE-014 - Forbidden-literals check reports no new violation

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-5, AC-NFR5-1
**Test Type(s)**: Manual (guard execution)
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/checks/forbidden-literals.ts`
**Tags**: @guard, @docs, @literals

**Preconditions**:

- `bun` available; repository root; run on the amended tree.

**Steps**:

1. Run procedure **P12**: `bun run scripts/checks/forbidden-literals.ts; echo "exit=$?"`.
2. Confirm the summary reports 5/5 scope classes scanned with 0 violations.
3. Attribute the result: confirm no violation, if any, names `doc/planning/oss-tooling/backlog.md` or `doc/planning/oss-tooling/status.md`.

**Expected Outcome**:

- `exit=0` and the summary line `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`.
- A failure naming either amended file is a FAIL of this TC and must be fixed by rewording, never by adding an allowlist entry (which would touch `scripts/**` and violate AC-NFR1-1).

**Notes / Clarifications**:

- Baseline verified on the base revision: identical line, exit 0. A regression can therefore only come from the two amended files.

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

- `backlog.md: corroboration=3/3 incident=OK classes=OK floor=OK`, `status.md: corroboration=3/3 incident=OK classes=OK floor=OK|n/a`, exit code 0. (`floor=n/a` is correct when the status amendment restates no floor numbers; `floor=MISSING` means it restated them without the floor qualifier.)
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

## 6. Environments and Test Data

| Aspect | Detail |
|---|---|
| Environment | Local developer worktree of this repository on branch `docs/GH-266/evidence-based-handover-gate`; no server, container, service, credential, or network dependency |
| Toolchain | `git` (branch + base revision), `bash`, `awk`, `cmp`, `grep`, `bun` (used only for `bun -e` inspection and the forbidden-literals check); all already required by the repository |
| Base revision | `origin/main-tools` (the integration branch; `f87ec185` at authoring time). All diff checks use the three-dot form `origin/main-tools...HEAD` so an advanced base cannot silently widen the comparison |
| Test data | Base-revision snapshots written to `/tmp/gh266-base-backlog.md` and `/tmp/gh266-base-status.md`; the amended files are read from the worktree. No fixtures are fabricated and no synthetic planning text is committed |
| Negative fixture | A `/tmp`-only copy of the enumeration paragraph with `pr-open-unverified` removed (TC-GATE-010 step 5). Never committed, never written into the repository |
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

**P4 — heading and AC/dependency preservation (TC-GATE-004, TC-GATE-005):**

```bash
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
```

Expected: `heading unchanged`; identical heading lines; `M1-S9 AC+Depends byte-identical`; no `MISSING:` lines.
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

**P6 — status supersession pointers (TC-GATE-007):**

```bash
bun -e '
const text = require("node:fs").readFileSync(process.argv[1], "utf8");
const cutoff = text.indexOf("## Story delivery");
const paras = text.split(/\n\s*\n/);
let offset = 0, forward = 0, pointed = 0;
for (const p of paras) {
  const at = text.indexOf(p, offset); offset = at + p.length;
  if (!/two-clean-weeks/.test(p)) continue;
  if (at < cutoff) { console.log("history (no pointer required):", p.trim().split("\n")[0]); continue; }
  forward++;
  if (/CEO-D-073|supersed|]\(#/.test(p)) pointed++;
  else console.log("MISSING POINTER:", p.trim().replace(/\s+/g, " ").slice(0, 120));
}
console.log(`forward=${forward} pointed=${pointed}`);
process.exit(forward === 2 && pointed === 2 ? 0 : 1);
' doc/planning/oss-tooling/status.md
```

Expected: one `history (no pointer required)` line, `forward=2 pointed=2`, exit 0. (Base prints `forward=2 pointed=0`.)

**P7 — status history preservation (TC-GATE-008):**

```bash
# P7a: dated 2026-11-03 amendment section
for f in /tmp/gh266-base-status.md doc/planning/oss-tooling/status.md; do
  awk '/^## M0 exit amendment and M1 re-planning \(2026-11-03\)/{f=1;print;next} f&&/^## /{exit} f{print}' "$f"
done > /tmp/gh266-hist-both.txt
split -n l/2 /tmp/gh266-hist-both.txt /tmp/gh266-hist-part-
cmp /tmp/gh266-hist-part-aa /tmp/gh266-hist-part-ab && echo "2026-11-03 section identical"

# P7b: M0 exit-criteria list
for f in /tmp/gh266-base-status.md doc/planning/oss-tooling/status.md; do
  awk '/^The roadmap.s M0 exit criteria/{p=1} p{print} p&&/as enumerated in the inception readiness report/{exit}' "$f"
done > /tmp/gh266-exit-both.txt
split -n l/2 /tmp/gh266-exit-both.txt /tmp/gh266-exit-part-
cmp /tmp/gh266-exit-part-aa /tmp/gh266-exit-part-ab && echo "M0 exit criteria identical"

# P7c: M0 pilot statements still present verbatim (whitespace-normalised: the source wraps mid-sentence)
tr '\n' ' ' < doc/planning/oss-tooling/status.md | tr -s ' ' > /tmp/gh266-status-flat.txt
for s in "stories that do not touch dispatch are unconstrained" \
         "requires its per-repository two-clean-weeks evidence" \
         "remains the critical path for M0 exit."; do
  grep -Fq "$s" /tmp/gh266-status-flat.txt || echo "MISSING: $s"
done
echo "history check done"
```

Expected: `2026-11-03 section identical`, `M0 exit criteria identical`, no `MISSING:` lines, `history check done`.

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
for (const path of ["doc/planning/oss-tooling/backlog.md", "doc/planning/oss-tooling/status.md"]) {
  const text = fs.readFileSync(path, "utf8");
  const r = region(path, text);
  const corroboration = ["pm-notes", "tracker state", "CI on the pushed head"].filter((s) => r.includes(s)).length;
  const incident = /false-success incident/i.test(r) && /unresolved divergence/i.test(r);
  const classes = /result class/i.test(r) && /real tickets/i.test(r);
  const floorParas = r.split(/\n\s*\n/).filter((p) => /20 dispatches|7 consecutive days/i.test(p));
  const floor = floorParas.length === 0 ? "n/a" : floorParas.every((p) => /floor/i.test(p)) ? "OK" : "MISSING";
  console.log(`${path.split("/").pop()}: corroboration=${corroboration}/3 incident=${incident ? "OK" : "MISSING"} classes=${classes ? "OK" : "MISSING"} floor=${floor}`);
}
'
```

Expected: `backlog.md: corroboration=3/3 incident=OK classes=OK floor=OK` and `status.md: corroboration=3/3 incident=OK classes=OK floor=OK|n/a`.
Then complete TC-GATE-016 steps 2-4 by reading the two definitions side by side.

**Recommended order:** P0 → P1 → P11 → P12 → P2 → P3 → P4 → P9 → P10 → P5 → P6 → P7 → P8 → P13 → P14 → then the two manual reads (TC-GATE-016 side-by-side contradiction read and the TC-GATE-006 markdown render review). Cheap containment and guards first (a two-file violation makes every downstream reading moot), then the executable assertions, then the content and history reads.

### 7.2 TC → Procedure → Implementation Mapping

| TC ID | Procedure(s) | Execution command | Implementation status | Recorded evidence |
|---|---|---|---|---|
| TC-GATE-001 | P3 | `bun -e '…' backlog.md` (Section 7.1) | Manual Only — uncommitted inspection | `conditions=4/4` line |
| TC-GATE-002 | P2 | `bun -e '…' backlog.md` | Manual Only — uncommitted inspection | `occurrences/unmarked` line |
| TC-GATE-003 | P3 (`floor-scope`) | same as TC-GATE-001 | Manual Only — uncommitted inspection | `floor-scope=OK` |
| TC-GATE-004 | P4a | `git diff -U0` + `awk` + `cmp` + 4 greps | Manual Only — uncommitted inspection | `byte-identical` + grep count |
| TC-GATE-005 | P4b | `git diff -U0 … \| grep -E '^[+-]#{3} M1-S9'` | Manual Only — uncommitted inspection | `heading unchanged` |
| TC-GATE-006 | P5 | `bun -e '…' status.md` + render review | Semi-automated (script) + Manual (render) | `missing=0` + rendered section |
| TC-GATE-007 | P6 | `bun -e '…' status.md` | Manual Only — uncommitted inspection | `forward=2 pointed=2` |
| TC-GATE-008 | P7a/P7b/P7c | `awk` + `cmp` + `grep -F` | Manual Only — uncommitted inspection | two `identical` lines, no `MISSING` |
| TC-GATE-009 | P8 | `bun -e '…'` on both files | Semi-automated (presence) + Manual (exactly-three, per-family legibility) | `sources=3/3 insufficiency=OK` ×2 + read note |
| TC-GATE-010 | P9 + negative control | `bun -e '…'` importing the typed module | Semi-automated (executable assertion) + Manual (DEC-3 disclosure) | `tokens=11 missing=0 extra=0 duplicates=0`; negative `missing=1` |
| TC-GATE-011 | P10 | `awk` + `cmp` + `head` + `git diff \| grep -c` | Manual Only — uncommitted inspection | three expected lines |
| TC-GATE-012 | P1a/P1b | `git diff --name-only …` | Manual Only — uncommitted inspection | two-line path list, `none` |
| TC-GATE-013 | P11 | `bash scripts/.tests/test-doc-distribution.sh` | Existing guard — no change | guard summary + `exit=0` |
| TC-GATE-014 | P12 | `bun run scripts/checks/forbidden-literals.ts` | Existing guard — no change | `5/5 … 0 violations`, `exit=0` |
| TC-GATE-015 | P13a/P13b | `git diff \| grep -oE` + existence loop | Manual Only — uncommitted inspection | `broken=0` |
| TC-GATE-016 | P14 + read | `bun -e '…'` on both files | Semi-automated (presence) + Manual (contradiction read) | two summary lines + read note |
| TC-GATE-017 | P1c + `--stat` | `git diff --check` | Manual Only — uncommitted inspection | `exit=0`, stat review |

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
| P7 `cmp` differs | Dated history or M0 exit criteria were edited (AC-F2-3, NFR-2) | Revert that region to the base revision; the new section is the only permitted addition. |
| P8 prints `sources<3` in either file | The corroboration rule is vague or incomplete (AC-F3-1, RSK-4) | Name the missing source explicitly; do not substitute a synonym. |
| P8 prints `insufficiency=MISSING` | The "engine token alone is not enough" rule is absent | State it explicitly; without it the gate can be satisfied by a self-claimed success. |
| P10 frontmatter differs, or `ados_distribution` count > 0 | Decoration or distribution class was invented (AC-F5-2, DEC-9) | Revert the frontmatter; `doc/planning` stays outside distribution scope. |
| P4b prints a changed heading line | Anchor drift (AC-F5-1, DEC-8) | Restore the heading text exactly. |
| P11 non-zero or drift line | A scoped doc was disturbed or a marker was removed | Usually indicates the diff escaped `doc/planning`; check P1a first. |
| P12 non-zero naming an amended file | A forbidden literal was introduced | Reword the text; never add an allowlist entry (that touches `scripts/**`). |
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
| TR-4 | "No new forbidden literal attributable to the two files" could be read as "the guard is green", which it already was | TC-GATE-014 requires attribution: any violation naming either amended file is a FAIL, regardless of the guard's prior state |
| TR-5 | A green run could be mistaken for evidence that the *future* handover gate works | G-1 and OQ-1 state explicitly that operational enforcement is out of testable scope for this change |

### 8.2 Assumptions

- **A-1**: `origin/main-tools` is the correct comparison base for this change (repository branch model; feature branches come from `main-tools`).
- **A-2**: `bun` executes the pinned version and can import `packages/core/src/contracts/delivery-result.ts` directly (verified at authoring time; the import resolves from the repository root).
- **A-3**: `DELIVERY_RESULT_TOKENS` remains the normative eleven-token set and is not modified by this change (spec §13, NG-2); the check reads it as ground truth, and a contract change would correctly surface as `extra`/`missing` here.
- **A-4**: NFR-6 (reversibility) is a release property verified by containment, not by executing a revert; a revert test would mutate the branch and is out of scope for a review-time procedure.
- **A-5**: The two planning files are internal planning documents with no installed consumer that parses them, so byte-preservation checks (rather than semantic-equivalence checks) are the correct bar for history and frontmatter.
- **A-6**: Markdown rendering review is human; the repository has no Markdown renderer gate, and the amended regions are plain prose, bullets, and links.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Disposition |
|---|---|---|---|---|
| OQ-1 | When M1-S9 delivers, what executable check proves the four-condition bar on a real repository (dispatch corpus completeness, class coverage, corroboration across pm-notes/tracker/CI)? | No — for this change | M1-S9 (GH-239) delivery | Declared gap G-1. Not a test case here; the predicate is prose planning truth (spec §7.3 defers machine encoding). |
| OQ-2 | Which secondary planning documents are refreshed in the follow-up, and does the owner accept the residual in the meantime? | No | Owner / PM | Declared gap G-2. Consistency checks over those files are expected to FAIL by design and are recorded as out-of-scope residual, never as TCs. |
| OQ-3 | Should the status amendment enumerate every residual document or a representative subset? | No | Owner | This plan requires naming at least two (P5) plus a manual comparison against spec §7.2. If the owner prefers a shorter note, the manual comparison is the binding read. |
| OQ-4 | Should the amended definition appear identically in both files, or should `status.md` summarise and defer? | No | Answered by spec F-2 | Summary plus pointer, backlog canonical. TC-GATE-016 accepts a deferring summary, provided no threshold or source count contradicts the backlog. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-07 | @test-plan-writer | Initial test plan for spec v1.0: 13 ACs covered by 17 TCs (bidirectional traceability, no orphans), 14 uncommitted inspection procedures with validated base-revision failing values, 3 doc guards, run order, failure triage, and two declared gaps (G-1 future enforcement, G-2 declared residual). |

## 10. Test Execution Log

Populated during delivery and review (`.ai/rules/testing-strategy.md`: record commands run and result summary; spec §17.1 DoD).

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| — | — | Not run | Pending delivery of the amendment (phase 6) |
