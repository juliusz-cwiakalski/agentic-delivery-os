---
id: chg-GH-185-interim-mitigations-docs-config
status: Proposed
created: 2026-10-31T00:50:06Z
last_updated: 2026-10-31T00:50:06Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os autonomous delivery loop (bash era)
labels: ["documentation", "autonomous-delivery", "M0", "interim-mitigations"]
links:
  change_spec: ./chg-GH-185-spec.md
  test_plan: ./chg-GH-185-test-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  feature_spec: ../../../spec/features/feature-autonomous-delivery.md
  related_changes:
    - ../2026-10-30--GH-173--config-layer/chg-GH-173-plan.md
summary: >
  Document four bash-era delivery-loop mitigations in existing surfaces with
  zero shell behavior changes: permission-denial recognition and recovery
  (noop-lane-permission), true stuck-minute knob names and tuning guidance
  (CEO_LOOP_STALL_MINUTES corrected to CEO_LOOP_STUCK_MINUTES with the
  pm-liveness probe variable explained), the in-flight JOIN warning operator
  contract, and the canonical pm-notes authoring rule — plus one factual
  system-spec configuration-row correction. The diff contains zero changes
  under scripts/** and tools/**.
version_impact: none
---

# IMPLEMENTATION PLAN — GH-185: M0-S16: Interim mitigations, docs and config only

## Context and Goals

Implement F-1–F-5 of the completed specification (11 ACs in §17, DEC-1–DEC-6 in §15) against the completed test plan (17 TCs, §5). Both artifacts are committed on `docs/GH-185/interim-mitigations-docs-config` (base `main-tools`; merge-base at plan time `f6c8d18`, matching test-plan §6); this plan derives every task, file target, and gate from them and adds no requirement.

This is a **documentation-only** change. Four known rough edges of the bash-era delivery loop (`deliver-ticket.sh`, `ceo-loop.sh`, `pm-liveness.sh` — unchanged documentation subjects) become discoverable and actionable from existing docs and existing configuration alone: (1) `noop-lane-permission` recognition/recovery, (2) true stuck-minute knob names + tuning, (3) the `JOIN:` in-flight warning operator contract, (4) the pm-notes authoring rule. The knob-name drift (`CEO_LOOP_STALL_MINUTES` documented where the loop actually reads `CEO_LOOP_STUCK_MINUTES`) is corrected in all four affected locations (spec Appendix B; DEC-4/DEC-5).

The spec's placement decisions are binding: DEC-1 (F-1–F-3 consolidated into `doc/guides/delivery-modes.md`; no new standalone guide), DEC-2 (pm-notes rule canonically in `doc/guides/change-lifecycle.md` §PM Notes Structure; one-line pointers elsewhere), DEC-3 (no new knobs — "config" means documenting the existing env/flag surface), DEC-4 (stale name corrected everywhere it is presented as the loop knob; probe variable explained separately; script-side usage-text misname documented as a known rough edge, not fixed), DEC-5 (system-spec row fixed in this change, not deferred to doc-sync), DEC-6 (current behavior only; future engine references explicitly framed as not yet landed).

**Grounding-first ordering**: the spec's line references are approximate. Every phase below re-verifies the exact current wording and line anchors in the target doc before editing (Phase 1 does the systematic pass; each writing task repeats its local check). Plan-time anchors recorded during authoring (line numbers drift; re-verify):

| Target | Anchor (plan-time) | Content |
|---|---|---|
| `doc/guides/delivery-modes.md` | `### INV-DM-5: Liveness means multi-signal progress…` ~L407–438, stale knob at ~L424 | Liveness prose |
| `doc/guides/delivery-modes.md` | `### Close-out contract (artifact-first classification)` ~L470–495 (`finished` ~L487, `partial` ~L488, `noop-lane-permission` ~L489) | Classification table |
| `doc/guides/delivery-modes.md` | `### Script subcommands` row ~L461 and `### INV-DM-1` enumeration ~L326 | Result-token enumerations — **guard-pinned, do not touch** |
| `doc/guides/delivery-modes.md` | `## Configuration` → `### ceo-loop.sh` table ~L683–690, stale row ~L688; `### deliver-ticket.sh` ~L692 (`DELIVER_STUCK_MINUTES` ~L696) | Config tables |
| `doc/guides/delivery-modes.md` | `## Troubleshooting` ~L726, stale row ~L730 | Troubleshooting table |
| `doc/spec/features/feature-autonomous-delivery.md` | `### Configuration` row ~L210 | Stale spec row |
| `doc/guides/change-lifecycle.md` | `## PM Notes Structure (chg-<workItemRef>-pm-notes.yaml)` ~L477–503 | Canonical pm-notes section |
| `doc/guides/opencode-agents-and-commands-guide.md` | `## 5. Best Practices` → "PM Notes are Mandatory" bullet ~L276 | Pointer target |

### Open questions

None blocking. Spec OQ-1 is closed ("no decision needed"); test-plan OQ-T1…OQ-T3 are non-blocking and resolved by their recorded answers (anchor choice verified by TC-MITIG-015; liveness automation out of scope; the system-spec config row is a permitted non-duplicate per DEC-5). If grounding in Phase 1 finds a script fact has moved since spec time, STOP the affected writing task and notify the PM (RSK-1) — do not document moved behavior silently.

## Scope

### In Scope

- **F-1**: `noop-lane-permission` recognition-and-recovery contract (trigger, outcome, recognition, practical recovery) plus the explicit contrast with the mid-run permission-prompt stall — consolidated interim-mitigations subsection in `doc/guides/delivery-modes.md`.
- **F-2**: true stuck-minute knob documentation — `CEO_LOOP_STALL_MINUTES` → `CEO_LOOP_STUCK_MINUTES` corrections in the modes-guide config table, liveness prose, and troubleshooting row; pm-liveness probe variable + wrapper alignment explained; tuning guidance folded into existing configuration content.
- **F-3**: `JOIN:` warning operator contract (meaning, action, expected outcome, `--is-delivering` probe, stale-state self-healing) in the same mitigation subsection.
- **F-4**: canonical pm-notes authoring rule (who / when / who-not / why) in `doc/guides/change-lifecycle.md` §PM Notes Structure; one-line pointer from the agents guide; cross-link from the modes-guide classification context.
- **F-5**: consolidation & accuracy pass — one canonical home per mitigation, cross-links elsewhere, system-spec configuration-row correction in `doc/spec/features/feature-autonomous-delivery.md` (DEC-5), all doc-derived guards stay green.

### Out of Scope

- Any change under `scripts/**` or `tools/**`, including the two known script-side naming inaccuracies (`ceo-loop.sh` usage text; seconds-seam comment) — spec NG-1, §7.3 deferral.
- New configuration knobs, a config file, or wiring the GH-173 config layer into the bash scripts (NG-2).
- Runtime behavior changes: classification ladder, liveness detection, JOIN/single-flight mechanics, pm-notes schema (NG-3).
- Engine work or documenting not-yet-landed engine behavior as current (NG-5); wholesale guide reorganization (NG-4); new standalone mitigation guides (DEC-1); re-editing already-correct tables (e.g., the Mode B operations guide's `DELIVER_STUCK_MINUTES` row); `.ai/local/**`.
- `.opencode/**` edits (no `@toolsmith` involvement; no `scripts/build-claude-plugin.sh` regeneration), license-header additions or edits, version/package changes.

### Constraints

- **Docs-only diff (NFR-1, hard)**: 0 changed paths under `scripts/**` and `tools/**`; 100% of changed files under `doc/**`; no `.ai/local/**`; no new files under `doc/guides/` (only the four target docs are modified, plus `doc/changes/**` artifacts).
- **Guard-safe wording (RSK-T2 / TC-MITIG-013)**: the result-tuple guard scans `delivery-modes.md` and `feature-autonomous-delivery.md`; any unit enumerating ≥4 distinct result tokens must include the full canonical set. Keep result-token mentions in new prose in plain prose form; never weaken a guard to pass — reword the doc instead.
- **Liveness-wording criterion (TC-MITIG-014)**: multi-signal description (recursive session-tree traffic primary, git/worktree secondary) with the 10-minute default; the retired 30-minute/file-mtime heuristic appears only as explicit history.
- **Canonical homes (NFR-4)**: F-1/F-2/F-3 rule bodies live only in `delivery-modes.md`; F-4 rule body only in `change-lifecycle.md` §PM Notes Structure; other surfaces get `[text](path#anchor)` cross-links or one-line pointers; the system-spec `CEO_LOOP_STUCK_MINUTES` row is a single factual config row (DEC-5), not duplicated guidance.
- **`ados_distribution` markers (NFR-3)**: all four target docs already carry markers; edits must not remove or alter them; `bash scripts/.tests/test-doc-distribution.sh` must pass.
- **License headers**: never hand-add or hand-edit headers. `doc/guides/**` headers are managed by `scripts/add-header-location.sh`; if a header is missing on an edited guide, note it in the PR — do not fix it. `doc/changes/**` artifacts are header-free.
- **Current truth only (NFR-5)**: future engine references (`verify-change` M0-S8, `ados lint`/`ados phase` M0-S10) explicitly framed as not yet landed.
- **Stable anchor**: Phase 4 must not rename the `## PM Notes Structure (chg-<workItemRef>-pm-notes.yaml)` heading — the Phase 3 cross-link targets its slug.
- **Commits**: one Conventional Commit per writing phase, scope `GH-185`, type `docs` (e.g., `docs(GH-185): …`); `@coder` delegates each commit to `@committer`; no direct pushes to `main-tools`.

### Risks

- **RSK-1 (docs drift from scripts)**: grounding re-verified in Phase 1 and re-checked per writing task; any moved script fact stops the task and escalates to the PM (never document from memory).
- **RSK-2 (consolidation becomes duplication)**: canonical-home table (test-plan TC-MITIG-009) enforced in Phase 6 audit; cross-link-only discipline in Phases 3–5.
- **RSK-3 (script usage text still misnames the knob)**: troubleshooting/mitigation content explicitly records `ceo-loop.sh --help` printing the stale name as a known bash-era rough edge (Phase 2); script fix deferred (§7.3).
- **RSK-4 (system-spec edit outside doc-sync)**: isolated to Phase 5 as a one-row factual correction (DEC-5); lifecycle phase 7 re-reconciles as usual.
- **RSK-5 (readers hand-manage runtime state)**: JOIN contract prescribes only CLI/log-level actions and repeats the "do not manage runtime state manually" guidance (Phase 3).
- **RSK-6 (quoted signatures trip privacy guards)**: quote only generic placeholders (result tokens, `<REF>`/`pid=…`, JOIN line shape); forbidden-literals scan stays green (Phase 6).
- **RSK-T2 (false result-token enumerations)**: run the result-tuple guard after Phases 2, 3, and 5 (cheap early signal), not only at Phase 6.

### Success Metrics

- 0 changed paths under `scripts/**`/`tools/**`; 100% of changed files under `doc/**` (AC-NFR1-1).
- 0 doc locations presenting `CEO_LOOP_STALL_MINUTES` as the ceo-loop knob; every remaining occurrence is a probe/alignment/known-misname explanation (AC-F2-1).
- 100% of mitigation behavioral claims matched to current script lines; 0 future-as-current statements (AC-NFR2-1).
- Exactly 1 canonical rule body per mitigation; all other mentions are cross-links/pointers (AC-F5-1).
- Doc-distribution, result-tuple (+ modes), inception-consistency guards green; liveness-wording grep criterion satisfied (AC-NFR3-1, AC-NFR6-1).
- 0 new configuration knobs (DEC-3).

## Phases

Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → (8 if findings) → 9**. Each phase ends in a verifiable state; writing phases (2–5) end in one Conventional Commit (`docs(GH-185): …`) created via `@committer`. Read-only phases (1, 6, 7) complete on recorded evidence, not a commit. Guards are re-run after every phase that edits `delivery-modes.md` or the system spec.

### Phase 1: Grounding re-verification and baseline guards

**Goal**: Re-verify every behavioral claim against the unchanged scripts and every edit anchor against the current docs before any edit, and capture green baselines for the guards the edits must not break.

**Tasks**:

- [ ] **1.1** Re-run the TC-MITIG-010 grounding battery against the unchanged scripts (exact commands in test-plan §5.2): `rg -n 'noop-lane-permission|re-dispatch with a corrected prompt' scripts/deliver-ticket.sh`; `rg -n 'STUCK_MINUTES|STALL_MINUTES' scripts/ceo-loop.sh scripts/deliver-ticket.sh scripts/pm-liveness.sh`; `rg -n -- '--stuck-minutes' scripts/deliver-ticket.sh`; `rg -n 'JOIN: live delivery|--is-delivering' scripts/deliver-ticket.sh`; `rg -n 'finished|partial|pm-notes|pm_notes' scripts/deliver-ticket.sh`; `rg -n 'DEFAULT_STALL_MINUTES' scripts/pm-liveness.sh`. Confirm each spec §2.1/§8.3 claim (result token/exit 1/guidance line; `DELIVER_STUCK_MINUTES` default 10 + flag; `CEO_LOOP_STUCK_MINUTES` default 10 + probe alignment; JOIN line shape + self-healing; finished/partial keyed on pm-notes). Record commands and one-line results as TC-MITIG-010 evidence in the test plan §10 log.
- [ ] **1.2** Re-verify the plan-time anchor inventory (Context table above) against the current docs: `rg -n 'CEO_LOOP_STALL_MINUTES' doc/guides/delivery-modes.md doc/spec/features/feature-autonomous-delivery.md` (expect exactly the 4 drift spots of spec Appendix B: guide L~424 prose, L~688 config row, L~730 troubleshooting row, spec L~210 row); locate the classification-table `finished`/`partial`/`noop-lane-permission` rows, §PM Notes Structure, and the "PM Notes are Mandatory" bullet. Report any drift from the spec's Appendix A/B facts to the PM before writing; do not proceed on a moved fact.
- [ ] **1.3** Capture green guard baselines: `bash scripts/.tests/test-doc-distribution.sh`; `bash scripts/.tests/test-deliver-ticket-result-tuples.sh`; `bash scripts/.tests/test-deliver-ticket-result-tuples-modes.sh`. Record exit codes as pre-edit evidence (TC-MITIG-012/013 baselines). A red baseline is a stop-condition — investigate before editing.
- [ ] **1.4** Diff-scope baseline: confirm branch `docs/GH-185/interim-mitigations-docs-config`, recompute `BASE="$(git merge-base origin/main-tools HEAD)"` (plan-time `f6c8d18`), and confirm `git status --porcelain` holds no stray non-`doc/**` files that could later leak into a commit (TC-MITIG-001 preconditions).

**Acceptance Criteria**:

- Must: every spec §2.1/§8.3 behavioral claim matched to a current script line; mismatches escalated to the PM instead of documented around (RSK-1, NFR-2).
- Must: all three baseline guards green and recorded.
- Should: anchor inventory recorded with exact current line numbers for Phases 2–5.

**Files and modules**:

- Code areas: none (read-only).
- System docs: none during this phase.

**Tests**:

- TC-MITIG-010 (grounding battery); TC-MITIG-012/013 baseline runs; TC-MITIG-001 preconditions.

**Completion signal**: state — grounding evidence and green baselines recorded in the test plan §10 log; no commit.

---

### Phase 2: Modes guide — stuck-knob corrections and configuration accuracy (F-2)

**Goal**: Make every stuck-minute presentation in `doc/guides/delivery-modes.md` name the knobs the scripts actually read, explain the probe variable, and carry the tuning guidance, without duplicating the INV-DM-5 liveness prose.

**Tasks**:

- [ ] **2.1** Re-extract the ceo-loop config block (`awk '/^### `ceo-loop.sh`/{f=1} f && /^### `deliver-ticket.sh`/{f=0} f' doc/guides/delivery-modes.md`, per TC-MITIG-005) and correct the table row: variable `CEO_LOOP_STUCK_MINUTES`, default `10`, description naming it as the loop stuck threshold (INV-DM-5 semantics kept). Add the probe clarification — `CEO_LOOP_STALL_MINUTES` (default 10) is the `pm-liveness.sh` probe threshold, and both wrappers align it to their own threshold when invoking the probe — as a table row or an adjacent sentence inside the existing `### ceo-loop.sh` block. Keep the table column shape intact (TC-MITIG-015).
- [ ] **2.2** Correct the liveness prose (INV-DM-5, sentence at plan-time ~L424 "no activity from either signal for ≥ `CEO_LOOP_STALL_MINUTES`") to `CEO_LOOP_STUCK_MINUTES`. Do not alter the multi-signal description, the `>=`/at-threshold note, or the retired-heuristic framing — the liveness-wording criterion (TC-MITIG-014) keys on exactly that wording.
- [ ] **2.3** Correct the troubleshooting row (~L730): symptom/cause columns name `CEO_LOOP_STUCK_MINUTES`; the fix column keeps "check the session traffic; raise the threshold if the step is legitimately long". Add the known-rough-edge note here (canonical spot for it): `ceo-loop.sh --help` still prints the stale name `CEO_LOOP_STALL_MINUTES` — a bash-era inaccuracy fixed only by a future shell-allowed change (spec §7.3, RSK-3); the correct knob is `CEO_LOOP_STUCK_MINUTES`. One sentence, no new section.
- [ ] **2.4** Fold the tuning guidance into the existing `## Configuration` content (no new top-level section, no repetition of INV-DM-5 prose): `DELIVER_STUCK_MINUTES` default 10 with the `--stuck-minutes` CLI override for `deliver-ticket.sh`; multi-signal semantics summarized with a cross-link to the INV-DM-5 subsection (link, not restatement — NFR-4); guidance to raise the threshold for legitimately long reasoning steps because too-low values kill and restart healthy sessions; seconds-level overrides (`DELIVER_STUCK_SECONDS`, ceo-loop's internal seconds seam) stated as test-only accelerators, not operator knobs (AC-F2-2).
- [ ] **2.5** Post-edit self-check: re-run `bash scripts/.tests/test-deliver-ticket-result-tuples.sh` (table edits must not create partial enumerations); enumerate `rg -n 'CEO_LOOP_STALL_MINUTES' doc/guides/delivery-modes.md` — every remaining hit must read as the probe variable, wrapper alignment, or known-misname explanation, never as the loop knob (TC-MITIG-005 step 4).

**Acceptance Criteria**:

- Must: AC-F2-1 (guide side) — ceo-loop config row and troubleshooting name `CEO_LOOP_STUCK_MINUTES` (default 10); zero remaining loop-knob presentations of `CEO_LOOP_STALL_MINUTES`; probe variable + wrapper alignment explained.
- Must: AC-F2-2 — `DELIVER_STUCK_MINUTES`/`--stuck-minutes`, defaults, multi-signal semantics, raise-for-long-reasoning guidance, and test-only seconds seams all documented in the guide.
- Should: no wording change beyond the correction targets (NG-4 minimal-edit discipline).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/delivery-modes.md` (updated — INV-DM-5 prose sentence, `### ceo-loop.sh` table, `## Troubleshooting` row, `## Configuration` tuning content).

**Tests**:

- TC-MITIG-005 (steps 1–5, guide assertions), TC-MITIG-006, TC-MITIG-014 (wording preserved), TC-MITIG-013 re-run, TC-MITIG-010 (claims grounded).

**Completion signal**: `docs(GH-185): correct ceo-loop stuck knob names and tuning guidance in delivery-modes guide`

---

### Phase 3: Modes guide — interim-mitigations subsection: permission denial and JOIN warning (F-1, F-3)

**Goal**: Give the two operator-facing rough edges their recognition-and-recovery contracts in one consolidated subsection beside the existing classification/recovery content, and cross-link the classification context to the pm-notes rule.

**Tasks**:

- [ ] **3.1** Re-verify the insertion anchor: a new `###` subsection under `## How the pieces fit`, immediately after `### Close-out contract (artifact-first classification)` and before `### Session resume optimization` (plan-time ~L495/496). Confirm the heading text and its GitHub slug at execution time; the classification table and the guard-pinned enumerations (~L326, ~L461) remain untouched.
- [ ] **3.2** Write the permission-denial mitigation (AC-F1-1), grounded per Phase 1: **trigger** — zero branch commits **and** a headless permission auto-reject signature in the per-ticket lane log; **outcome** — result `noop-lane-permission`, exit 1, script guidance "re-dispatch with a corrected prompt"; **recognition** — where to look (delivery-summary result token; per-ticket lane log) and what the signature means; **recovery in practice** — adjust the dispatch prompt/context so the work needs no interactive permission acceptance (re-scope the task, or grant the needed permission out-of-band per operator policy), then re-dispatch. The classification-table row stays as-is; the subsection may link to it.
- [ ] **3.3** Write the explicit contrast (AC-F1-2): the close-out path (clean PM exit → 0 commits + signature → `noop-lane-permission` → corrected-prompt re-dispatch) versus the mid-run permission-prompt stall (live session goes silent → multi-signal stuck detection → kill-and-restart) — different mechanisms with different remedies, cross-referencing the INV-DM-5 subsection rather than restating liveness details.
- [ ] **3.4** Write the JOIN warning operator contract (AC-F3-1): **meaning** — a live single-flight owner exists for the same ticket in this repo working tree; the second invocation joins and waits; **action** — wait for the owner, do not kill it, never start a parallel delivery of the same ticket in the same repo working tree (INV-DM-2); **expected outcome** — the joiner returns the same classified result as the owner; **supporting probes** — `--is-delivering [REF]`, and stale-PID state self-heals rather than blocking a legitimate new owner. Quote only the generic line shape (`JOIN: live delivery for <REF> (pid=…); waiting` — placeholder REF/PID, RSK-6); repeat the existing "do not manage the runtime state manually" guidance and cross-link INV-DM-2 for the mechanism (no restatement, NFR-4/RSK-5).
- [ ] **3.5** Add the pm-notes cross-link: one pointer sentence at the close-out classification context (adjacent to the `finished`/`partial` rows, ~L487–488) linking to `change-lifecycle.md#pm-notes-structure-chgworkitemref-pm-notesyaml` (verify the GitHub slug of the existing `## PM Notes Structure (chg-<workItemRef>-pm-notes.yaml)` heading at execution; TC-MITIG-015). Pointer only — the rule body lands in Phase 4 (AC-F4-1 cross-link half).
- [ ] **3.6** Wording guard (RSK-T2): re-read the new prose for result-token lists — keep every mention in plain prose; no bullet/line enumerating ≥4 distinct tokens; re-run `bash scripts/.tests/test-deliver-ticket-result-tuples.sh` and reword (never guard-weaken) on failure (TC-MITIG-013 step 3).

**Acceptance Criteria**:

- Must: AC-F1-1 — all four elements (trigger, outcome, recognition, practical recovery) present and matching `deliver-ticket.sh`.
- Must: AC-F1-2 — close-out vs mid-run stall explicitly distinguished as different mechanisms with different remedies.
- Must: AC-F3-1 — JOIN meaning, action, expected outcome, `--is-delivering`, and stale-state self-healing present; no instruction to inspect/delete runtime state files.
- Should: mitigation subsection reads beside (not duplicating) the classification table and INV-DM-2/5 content — links over restatement.

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/delivery-modes.md` (updated — new `###` interim-mitigations subsection; one cross-link sentence at the classification context).

**Tests**:

- TC-MITIG-003, TC-MITIG-004, TC-MITIG-007, TC-MITIG-013 re-run, TC-MITIG-015 (new heading/anchors), TC-MITIG-010 (grounding).

**Completion signal**: `docs(GH-185): document permission-denial recovery and JOIN warning operator contract in delivery-modes guide`

---

### Phase 4: pm-notes authoring rule — lifecycle canonical section and agents-guide pointer (F-4)

**Goal**: State the pm-notes authoring rule once, canonically, in `doc/guides/change-lifecycle.md`, and reduce the agents-guide bullet to a pointer — nothing else restates the rule.

**Tasks**:

- [ ] **4.1** Re-verify the current `## PM Notes Structure (chg-<workItemRef>-pm-notes.yaml)` section (plan-time ~L477–503: purpose bullets + YAML example). Keep the heading and existing content unchanged (Phase 3's cross-link targets the heading slug); insert the authoring rule as a compact block at the top of the section, before the existing purpose bullets.
- [ ] **4.2** Write the canonical rule (AC-F4-1) with all four statements: **who** — the PM (`@pm`) is the sole author; **when** — at phase transitions, validated and updated before each commit, including a retro note on every phase reopening; **who must not** — delivery agents (e.g., `@coder`) and other delegates never author or hand-edit pm-notes; they report outcomes to the PM, who records them; **why** — the file is the delivery ledger: completeness drives the artifact-first `finished` (exit 0) vs `partial` (exit 1, "resume the SAME branch") classification, the CEO's merge-not-yield verification reads PM finalization from it, and the future verify-change engine (M0-S8) will consume it as its ledger input. Future references explicitly framed as not-yet-landed; ledger integrity is process-enforced today (NFR-5, TC-MITIG-011).
- [ ] **4.3** Extend the "PM Notes are Mandatory" bullet in `doc/guides/opencode-agents-and-commands-guide.md` (plan-time ~L276) with a one-line pointer to the canonical rule (relative link to `change-lifecycle.md#pm-notes-structure-chgworkitemref-pm-notesyaml`, slug re-verified). Discoverability only — no restatement of who/when/who-not/why (DEC-2, NFR-4).
- [ ] **4.4** Cross-surface check: confirm the Phase 3 classification-context cross-link resolves to the same anchor; confirm no third surface restates the rule (`rg -n 'sole author|PM Notes are Mandatory' doc/guides` — expect one rule body in change-lifecycle, pointers elsewhere; TC-MITIG-008 step 3–4, TC-MITIG-009).

**Acceptance Criteria**:

- Must: AC-F4-1 — exactly one canonical rule body stating who/when/who-not/why; both other surfaces are pointers/cross-links with zero duplicated rule body.
- Must: future-engine references framed as not yet landed (AC-NFR2-1 future-half).
- Should: the YAML example and purpose bullets remain byte-identical (minimal edit).

**Files and modules**:

- Code areas: none.
- System docs: `doc/guides/change-lifecycle.md` (updated — authoring-rule block in §PM Notes Structure), `doc/guides/opencode-agents-and-commands-guide.md` (updated — one-line pointer).

**Tests**:

- TC-MITIG-008 (awk section extraction + pointer checks), TC-MITIG-011 (future framing), TC-MITIG-009 (no duplication), TC-MITIG-015 (anchor resolution).

**Completion signal**: `docs(GH-185): canonicalize pm-notes authoring rule in change-lifecycle guide`

---

### Phase 5: System-spec factual correction (F-5 / DEC-5)

**Goal**: Correct the ceo-loop stuck-knob row in the current-truth system spec and keep its doc-derived guards green — a one-row factual fix, not a guidance duplicate.

**Tasks**:

- [ ] **5.1** Re-verify the configuration table row in `doc/spec/features/feature-autonomous-delivery.md` `### Configuration` (plan-time ~L210) and correct it: variable `CEO_LOOP_STUCK_MINUTES`, default `10`, description keeping the INV-DM-3/5 reference. Add the probe-variable clarification (`CEO_LOOP_STALL_MINUTES` is the `pm-liveness.sh` probe threshold, aligned by both wrappers to their own threshold) inside the same row or one adjacent sentence — a single factual row, no tuning/semantics prose (DEC-5; TC-MITIG-009 step 4).
- [ ] **5.2** Confirm the liveness-wording QA criterion stays satisfied in this file (TC-MITIG-014): the INV-DM-5 row and the QA-strategy "Liveness wording" row (plan-time ~L194) remain accurate; the 10-minute default is still stated; no retired-heuristic-as-current phrasing introduced.
- [ ] **5.3** Post-edit self-check: re-run `bash scripts/.tests/test-deliver-ticket-result-tuples.sh` (this file is in the guard's scan set; the INV-DM-1 enumeration ~L109 stays untouched) and `rg -n 'CEO_LOOP_STALL_MINUTES|CEO_LOOP_STUCK_MINUTES' doc/spec/features/feature-autonomous-delivery.md` — exactly one loop-knob row naming `STUCK`, remaining `STALL` mentions only as probe/alignment/misname explanations (TC-MITIG-005 spec assertions).

**Acceptance Criteria**:

- Must: AC-F2-1 (spec side) — the configuration row names `CEO_LOOP_STUCK_MINUTES` (default 10); probe variable explained; zero loop-knob presentations of the stale name.
- Must: AC-NFR6-1 — result-tuple guard green; liveness-wording criterion intact.

**Files and modules**:

- Code areas: none.
- System docs: `doc/spec/features/feature-autonomous-delivery.md` (updated — one configuration row + probe clarification).

**Tests**:

- TC-MITIG-005 (spec assertions), TC-MITIG-013 re-run, TC-MITIG-014.

**Completion signal**: `docs(GH-185): correct ceo-loop stuck knob row in autonomous-delivery system spec`

---

### Phase 6: Verification battery — automated guards, greps, and content self-review

**Goal**: Run the full test-plan battery on the finished edits: diff-scope negative constraint, all doc-derived guards, knob-name greps, canonical-home audit, and the content self-review that prepares Phase 7 evidence.

**Tasks**:

- [ ] **6.1** Diff scope and hygiene (TC-MITIG-001/002): `BASE="$(git merge-base origin/main-tools HEAD)"`; `git diff --name-only "$BASE"...HEAD` (+ uncommitted `git diff --name-only "$BASE"` and `git status --porcelain`) — assert zero `^(scripts|tools)/` paths, zero `^\.ai/local/`, 100% `^doc/`; `git diff --check "$BASE"...HEAD` clean. Expect only `M` entries for the four target docs plus `A`/`M` under `doc/changes/**`.
- [ ] **6.2** Doc-distribution guard (TC-MITIG-012): `bash scripts/.tests/test-doc-distribution.sh`; confirm `rg -n 'ados_distribution' doc/guides/delivery-modes.md doc/guides/change-lifecycle.md doc/guides/opencode-agents-and-commands-guide.md` still shows the retained markers (`redistributable`).
- [ ] **6.3** Result-tuple guards (TC-MITIG-013): `bash scripts/.tests/test-deliver-ticket-result-tuples.sh` and `bash scripts/.tests/test-deliver-ticket-result-tuples-modes.sh` — both exit 0; on failure, reword the prose (never weaken the guard).
- [ ] **6.4** Knob-name greps (TC-MITIG-005): enumerate `rg -n 'CEO_LOOP_STALL_MINUTES' doc/guides/delivery-modes.md doc/spec/features/feature-autonomous-delivery.md` and confirm every hit is a probe/alignment/known-misname explanation; confirm `CEO_LOOP_STUCK_MINUTES` present in the guide config row, troubleshooting content, and the spec config row.
- [ ] **6.5** Liveness-wording criterion (TC-MITIG-014): multi-signal wording + 10-minute default present in both files; `rg -n '30-minute|file-mtime|file-based' …` hits only as explicit retired history.
- [ ] **6.6** Ancillary battery (TC-MITIG-016): `bash scripts/.tests/test-inception-doc-consistency.sh`; `bash scripts/.tests/test-doc-distribution-modes.sh`; `bun run scripts/checks/forbidden-literals.ts` (optional — record skip if bun unavailable; Should-priority).
- [ ] **6.7** Content self-review against the §5.2 checklists for TC-MITIG-003, TC-MITIG-004, TC-MITIG-006, TC-MITIG-007, TC-MITIG-008, TC-MITIG-010, TC-MITIG-011 — tick each required element, record commands and one-line results in the test plan §10 execution log (the Phase 7 reviewer re-verifies independently; this pass must not substitute for it).
- [ ] **6.8** Canonical-home audit (TC-MITIG-009): occurrence inventory `rg -n 'sole author|re-dispatch with a corrected prompt|do not kill|same classified result|CEO_LOOP_STUCK_MINUTES' doc/guides doc/spec/features/feature-autonomous-delivery.md`; each mitigation's full prescriptive body appears once in its canonical home; every other mention is a cross-link/pointer; `git diff --name-status "$BASE"...HEAD` shows no new `doc/guides/*mitigation*` file.
- [ ] **6.9** Structure/render review (TC-MITIG-015): render all four edited docs; headings/tables/fences intact around the new subsection and the pm-notes block; `rg -n '\]\([^)]*\.md#' …` — every changed link and anchor resolves (GitHub slug rules; backticks and punctuation stripped); frontmatter and distribution markers intact.
- [ ] **6.10** pm-notes YAML validation (TC-MITIG-017, Should): parse `chg-GH-185-pm-notes.yaml` with an available parser (python3/PyYAML, ruby, or yq); single-document mapping confirmed; record skip if no parser available.

**Acceptance Criteria**:

- Must: all Must-priority TCs green (001–015); evidence recorded in test-plan §10.
- Must: any failure is fixed by rewording docs (docs-only fixes; guard semantics untouched) and the failed check re-run.
- Should: TC-MITIG-016/017 green or skips recorded.

**Files and modules**:

- Code areas: none (guard scripts are read-only subjects; any mutation of tracked files by a guard is a defect to report).
- System docs: none unless a reword fix reopens a Phase 2–5 file (docs-only, re-committed via `@committer`).

**Tests**:

- The battery above is the test set (test-plan §§5–7, execution order per §7 recommendation: scope/hygiene → guards → content → ancillary).

**Completion signal**: state — full battery green, per-TC evidence rows recorded in test-plan §10; hand off to review.

---

### Phase 7: Code Review (Analysis)

**Goal**: Independent adversarial audit of the delivered docs against spec, test plan, and this plan, without modifying content during analysis.

**Tasks**:

- [ ] **7.1** PM delegates the independent review to `@reviewer` (lifecycle phase 8) after the coder's handoff: trace all 11 ACs and 17 TCs to delivered content and recorded evidence; re-run the grounding greps personally (NFR-2 re-verification at review is the spec's explicit requirement), the guards, and the canonical-home judgment.
- [ ] **7.2** Verify the review-dominant ACs per test-plan §3.1: AC-F1-1/F1-2/F2-2/F3-1/F4-1 semantic completeness against the TC checklists; AC-NFR2-1 grounding sign-off; AC-F5-1 rule-body-vs-cross-link judgment using the TC-MITIG-009 canonical-home table.
- [ ] **7.3** Record the verdict through the review artifact workflow; route content findings to Phase 8 and decision-class findings (e.g., a challenged DEC-1/DEC-2/DEC-5 placement) to the PM and `@decision-advisor` — never a silent alternative.

**Acceptance Criteria**:

- Must: reviewer produces a traceable PASS or actionable findings with no fabricated evidence; no severity downgrade to pass the gate.

**Files and modules**:

- Code areas: none (read-only analysis of Phases 2–6).
- System docs: none during analysis.

**Tests**:

- Evidence inspection for all 17 TCs; `@runner` reproduction of questionable evidence rather than assumed passes.

**Completion signal**: state — independent verdict recorded (review artifact); PASS advances to Phase 9, findings activate Phase 8.

---

### Phase 8: Post-Code Review Fixes (conditional)

**Goal**: Close accepted review findings with the smallest docs-only fixes, without duplication regression or guard weakening.

**Tasks**:

- [ ] **8.1** If findings exist: reproduce each via the corresponding TC checklist step, then apply the smallest rewording/structural fix in the affected target doc; preserve the canonical-home rule (a fix must not restate a rule body elsewhere).
- [ ] **8.2** Re-run the affected guards/greps (Phase 6 subset) and update the test-plan §10 evidence rows; commit fixes via `@committer` as `docs(GH-185): address review findings …`.
- [ ] **8.3** PM delegates independent re-review until PASS. If no findings, record the phase as not required with the Phase 7 PASS as evidence.

**Acceptance Criteria**:

- Must: all accepted findings closed; previously green controls stay green; no waived check, no scope expansion.

**Files and modules**:

- Code areas: none.
- System docs: only the affected Phase 2–5 target docs (docs-only fixes).

**Tests**:

- Re-run the failing TC steps; then the Phase 9 final battery.

**Completion signal**: reviewer PASS after fixes, or explicit not-required state backed by Phase 7 PASS.

---

### Phase 9: Finalize and Release

**Goal**: Version decision, spec reconciliation, release hygiene, and a coherent handoff as an open PR to `main-tools`; merge/publish stay outside this change.

**Tasks**:

- [ ] **9.1** Version bump per repo conventions: **none required** — docs-only change, `version_impact: none`, zero `packages/**` changes, so no `.changeset/` entry (the lockstep fixed group covers workspace packages only). Record the no-bump decision in the PR description; no version hand-bumps, no publishing.
- [ ] **9.2** Spec reconciliation: confirm the in-change system-spec edit is exactly the Phase 5 configuration row; verify no other `doc/spec/**` drift contradicts the delivered docs; hand the remaining reconciliation and the interim-mitigation retirement plan (engine replacement, spec §7.3) to the lifecycle doc-sync phase (`@doc-syncer`, lifecycle phase 7).
- [ ] **9.3** Release hygiene confirmation: no license headers hand-added or hand-edited anywhere (guide headers are script-managed; a missing header on an edited guide is noted in the PR, not fixed); `.opencode/**` untouched → no `scripts/build-claude-plugin.sh` regeneration and no `@toolsmith` involvement; no new files under `doc/guides/`; `ados_distribution` markers intact.
- [ ] **9.4** Final battery at the final SHA: re-run the Phase 6 guard set (`test-doc-distribution.sh`, `test-deliver-ticket-result-tuples.sh` + `-modes.sh`, `test-inception-doc-consistency.sh`) plus the TC-MITIG-001/002 diff checks; verify the DoD checklist below; PM confirms all 11 ACs have passing traceable evidence and records divergences for escalation rather than rewriting requirements.
- [ ] **9.5** PR handoff: single PR from `docs/GH-185/interim-mitigations-docs-config` targeting `main-tools` via `@pr-manager` (lifecycle phase 11), describing the four mitigations, the four corrected drift spots, and the no-bump decision; STOP at the open unmerged PR.

**Acceptance Criteria**:

- Must: no-bump decision recorded and consistent with `version_impact: none`; spec reconciliation handoff explicit.
- Must: every DoD checklist predicate has current passing evidence at the final SHA.
- Must: PR open, unmerged, base `main-tools`, CI green on the pushed HEAD.

**Files and modules**:

- Code areas: none.
- System docs: handoff notes only; further doc reconciliation belongs to the doc-sync phase.

**Tests**:

- The Phase 9.4 battery is the test set; no separate execution is claimed.

**Completion signal**: state — DoD verified and PR handed off (PR creation itself belongs to lifecycle phase 11).

### Definition of Done checklist (mirrors spec §17–§18)

- [ ] All 11 ACs (AC-F1-1, AC-F1-2, AC-F2-1, AC-F2-2, AC-F3-1, AC-F4-1, AC-F5-1, AC-NFR1-1, AC-NFR2-1, AC-NFR3-1, AC-NFR6-1) have passing, traceable evidence via the 17 TCs (test-plan §10).
- [ ] Diff contains zero `scripts/**`/`tools/**` paths; 100% of changed files under `doc/**` (AC-NFR1-1).
- [ ] Zero locations present `CEO_LOOP_STALL_MINUTES` as the ceo-loop knob across the edited docs; probe variable explained where described (AC-F2-1).
- [ ] Each mitigation has exactly one canonical rule body; all other mentions are cross-links/pointers (AC-F5-1).
- [ ] Doc-distribution, result-tuple (+ modes), inception-consistency guards green; liveness-wording grep criterion satisfied (AC-NFR3-1, AC-NFR6-1).
- [ ] Known bash-era debt documented, not fixed: `ceo-loop.sh` usage-text knob misname and seconds-seam comment named as deferred (§7.3).
- [ ] No new configuration knobs; no runtime behavior changes (DEC-3, NG-1–NG-3).
- [ ] Open unmerged PR targeting `main-tools` with CI green.

---

## Test Scenarios

All 17 TCs from the test plan map to phases below; TC IDs, AC traces, steps, and exact commands follow test-plan §5 (authoritative); §7 records the recommended execution order (scope/hygiene → guards → content → ancillary), reflected in Phases 1 and 6.

| TC ID | Scenario | AC | Phase(s) | Verification mode |
|---|---|---|---|---|
| TC-MITIG-001 | Diff is docs-only (no `scripts/**`/`tools/**`) | AC-NFR1-1 | 1 (baseline), 6, 9 | Automated (git) |
| TC-MITIG-002 | Diff hygiene (`git diff --check`) | AC-NFR1-1 | 6, 9 | Automated (git) |
| TC-MITIG-003 | Permission-denial recognition and recovery documented | AC-F1-1 | 3, 6, 7 | Manual review + grep |
| TC-MITIG-004 | Close-out denial vs mid-run stall distinguished | AC-F1-2 | 3, 6, 7 | Manual review + grep |
| TC-MITIG-005 | Ceo-loop knob corrected; stale knob nowhere presented as loop knob | AC-F2-1, AC-F5-1 | 1 (drift spots), 2, 5, 6 | Grep + manual context review |
| TC-MITIG-006 | Stuck-minute defaults, semantics, tuning, test-only seconds documented | AC-F2-2 | 2, 6, 7 | Manual review + grep |
| TC-MITIG-007 | JOIN warning operator contract documented | AC-F3-1 | 3, 6, 7 | Manual review + grep |
| TC-MITIG-008 | Canonical pm-notes authoring rule documented | AC-F4-1, AC-F5-1 | 3 (cross-link), 4, 6, 7 | Manual review + grep |
| TC-MITIG-009 | Exactly one canonical rule body per mitigation | AC-F5-1 | 4 (4.4), 6, 7 | Manual review + grep |
| TC-MITIG-010 | Behavioral claims grounded in current scripts | AC-NFR2-1 | 1 (battery), 2–5 (per-task), 6, 7 | Manual grounding + grep |
| TC-MITIG-011 | No future engine behavior written as current | AC-NFR2-1 | 4, 6, 7 | Manual review + grep |
| TC-MITIG-012 | Doc-distribution guard passes | AC-NFR3-1 | 1 (baseline), 6, 9 | Automated guard |
| TC-MITIG-013 | Result-tuple doc guard (and modes) stays green | AC-NFR6-1 | 1 (baseline), 2, 3, 5 (re-runs), 6, 9 | Automated guard |
| TC-MITIG-014 | Liveness-wording grep criterion satisfied | AC-NFR6-1 | 2, 5, 6 | Manual grep |
| TC-MITIG-015 | Markdown structure, rendering, cross-link integrity | AC-NFR6-1 | 3, 4 (anchors), 6 | Manual render review |
| TC-MITIG-016 | Ancillary doc-guard battery stays green | AC-NFR6-1 | 6, 9 | Automated guard (Should) |
| TC-MITIG-017 | Process-state YAML syntax (`chg-GH-185-pm-notes.yaml`) | NFR-1 (content check) | 6 | Semi-automated (Should) |

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Change specification | [chg-GH-185-spec.md](./chg-GH-185-spec.md) | Source of requirements: F-1–F-5, DM-1–DM-4, NFR-1–NFR-6, DEC-1–DEC-6, RSK-1–RSK-6, §17 ACs, Appendix A/B grounding evidence |
| Test plan | [chg-GH-185-test-plan.md](./chg-GH-185-test-plan.md) | Source of the 17 TC IDs, checklists, guard inventory, exact commands, §10 evidence log to populate |
| PM notes | `./chg-GH-185-pm-notes.yaml` | PM-maintained ledger (the file whose authoring rule this change documents); validated by TC-MITIG-017 |
| This plan | `./chg-GH-185-plan.md` | Only file written by this authoring pass |
| Modes guide (target) | `doc/guides/delivery-modes.md` | Phases 2–3: knob corrections, tuning content, mitigation subsection, pm-notes cross-link |
| Lifecycle guide (target) | `doc/guides/change-lifecycle.md` | Phase 4: canonical pm-notes authoring rule |
| Agents/commands guide (target) | `doc/guides/opencode-agents-and-commands-guide.md` | Phase 4: one-line pointer from the "PM Notes are Mandatory" bullet |
| System spec (target) | [feature-autonomous-delivery.md](../../../spec/features/feature-autonomous-delivery.md) | Phase 5: one factual configuration-row correction (DEC-5); also carries the liveness-wording QA criterion and INV-DM-1..5 |
| Documentation subjects (unchanged) | `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, `scripts/pm-liveness.sh` | Read-only grounding references; zero diffs permitted (NFR-1) |
| Guards (unchanged) | `scripts/.tests/test-doc-distribution.sh`, `test-deliver-ticket-result-tuples.sh` (+ `-modes.sh`), `test-inception-doc-consistency.sh`, `test-doc-distribution-modes.sh`, `scripts/checks/forbidden-literals.ts` | Read-only verification battery (Phases 1, 6, 9) |
| Testing strategy | [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | `doc/**` layer mapping: static/diff + content checks |
| Config-layer context | [chg-GH-173-plan.md](../2026-10-30--GH-173--config-layer/chg-GH-173-plan.md) | Delivered typed config foundation the bash era does not consume (NG-2 context) |

Protected paths untouched by every phase: `scripts/**`, `tools/**`, `.opencode/**`, `.ados-claude/**`, `packages/**`, `.ai/local/**`, `.changeset/`. No license headers added or edited; no `scripts/build-claude-plugin.sh` run.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31T00:50:06Z | Implementation Plan Writer | Initial nine-phase, 43-task plan derived from the completed spec (11 ACs) and test plan (17 TCs): grounding-first Phase 1 with plan-time anchor inventory; per-doc writing Phases 2–5 (modes-guide knobs/tuning, modes-guide mitigations subsection, lifecycle pm-notes rule + agents-guide pointer, system-spec row fix); Phase 6 verification battery (diff scope, doc-distribution, result-tuple + modes, knob greps, liveness wording, canonical-home audit, render/anchors, ancillary guards, pm-notes YAML); Phase 7 review analysis, conditional Phase 8 fixes, Phase 9 finalize/release with recorded no-bump decision and doc-sync handoff. Full AC↔TC↔phase mapping; guard-safe-wording and stable-anchor constraints encoded. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Authoring | Complete | 2026-10-31T00:50:06Z | 2026-10-31T00:50:06Z | none | Read the completed spec and test plan, the implementation-plan template, the GH-181 precedent plan, and the live target surfaces (all four docs' anchors re-verified; the four stale-knob spots confirmed at plan time: delivery-modes.md L424/L688/L730 and feature-autonomous-delivery.md L210). Only this plan file written; no git/build/test operations beyond read-only grounding. |
