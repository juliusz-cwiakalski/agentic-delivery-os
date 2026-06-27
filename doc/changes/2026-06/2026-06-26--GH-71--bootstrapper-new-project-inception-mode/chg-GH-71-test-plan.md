---
id: chg-GH-71-test-plan
status: Updated
created: 2026-06-27
last_updated: 2026-06-27
owners: ["Juliusz Ćwiąkalski"]
service: bootstrapper-agent
labels: ["inception", "bootstrapper", "agent"]
version_impact: major
summary: "Test plan for the @bootstrapper unified 8-phase inception workflow (GH-71). Honest about the testing reality (DEC-9): the deliverable is an LLM agent prompt whose behavior CANNOT be CI'd, and there is NO CI-executable prompt-structure test for this change. The single automated-adjacent layer is the manual TC-INCEP-* behavioral matrix + PR review. CI only covers the mechanical bits: .ados-claude plugin freshness (build-claude-plugin), the doc-distribution marker, and the existing repo test suites. TDR-0001 is the prompt-structure authority."
links:
  change_spec: ./chg-GH-71-spec.md
  implementation_plan: ./chg-GH-71-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - [inception:2] Unified 8-phase inception workflow for @bootstrapper — single process with new|legacy front-half, product discovery, UX, and committed state

## 1. Scope and Objectives

GH-71 **rewrites** `.opencode/agent/bootstrapper.md` onto **one unified 8-phase
inception workflow** (phases 0–7). `project.flow ∈ {new, legacy}` selects **only the
front-half (phases 0–4) differences** within that one workflow: `new` (empty repo /
greenfield idea) **authors** artifacts from scratch; `legacy` (a pre-ADOS long-lived
project) **extracts/reconstructs** them from existing code and docs. Phases 5–7 are
shared. The change **eradicates** the old GH-32 6-phase flow and its git-ignored state
(`.ai/local/bootstrapper-context.yaml`); there is **no backward-compatibility and no
migration** (DEC-8). It **folds in** the legacy front-half behaviors (AC18–AC22: repo
ingestion, behavioral-spec extraction, next-milestone scope + tribal-knowledge
graduation, architecture reconstruction + uncertainty flagging, conventions audit).

**Core behavior to protect:**

1. **Unified-process invariant (AC23, NFR-4)** — exactly ONE 8-phase workflow and ONE
   state file (`doc/inception/inception-state.yaml`) exist; the legacy 6-phase flow and
   `.ai/local/bootstrapper-context.yaml` are **absent**. There is no separate legacy flow
   to "preserve" (the old AC16 legacy-parity requirement is superseded by DEC-8).
2. **Front-half branch correctness** — `project.flow` deterministically selects the
   front-half (phases 0–4) behavior: the `new` authoring path (AC1, AC4–AC11) and the
   `legacy` extract/reconstruct path (AC18–AC22). Phases 5–7 are identical for both.
3. **Shared back-half + cross-cutting invariants** — per-phase human gates + Phase-6
   reopen (AC12); committed state + resume (AC13); embedded anti-sycophancy in the
   correct phases (AC14); Phase-5 generation of **all four** `.ai/agent/*-instructions.md`
   incl. `code-review-instructions.md` (AC15); the guide is referenced, not recreated
   (AC17, NFR-5).

**Testing reality (governs the whole plan — read this first):**

The artifact under test is an agent **prompt**, not runnable code. Per the repo testing
strategy (`.ai/rules/testing-strategy.md`, "Module-to-test mapping": agent definitions
→ static/diff + content checks; "Fallback rules": docs/prompt-only changes → automated
tests **N/A**, require **manual verification** + `git diff --check`). An LLM agent's
behavior **cannot** be executed deterministically in CI.

**Per DEC-9, there is NO CI-executable prompt-structure test for this change.** The
`scripts/.tests/test-bootstrapper-prompt-structure.sh` is deleted (it hardcoded prompt
wording — grep-as-a-test — would have fossilized TDR-0001's chosen wording against future
evolution, and gave false confidence). Its only defensible piece (the two-tier
legacy-parity guard) dissolves under DEC-8: no frozen legacy blocks remain. Therefore:

- The **single automated-adjacent coverage layer** is the **manual `TC-INCEP-*` behavioral
  matrix + PR review**. This plan now leans entirely on manual verification — and says so
  plainly. It never claims CI coverage for behavioral AC.
- **TDR-0001** is the prompt-structure authority (not a test).
- CI only covers the **mechanical** bits: `.ados-claude` plugin freshness
  (`test-build-claude-plugin.sh`), the doc-distribution marker
  (`test-doc-distribution.sh`), and the existing repo test suites
  (`test-inception-doc-consistency.sh`, install/uninstall when the manifest changes).

### 1.1 In Scope

- **The manual `TC-INCEP-*` behavioral matrix** — the primary (and only
  automated-adjacent) coverage layer. One row per behavioral AC, covering BOTH front-halves:
  - `new`-flow authoring behaviors (AC1, AC4–AC11);
  - `legacy`-flow extract/reconstruct behaviors (AC18–AC22);
  - shared Phase-0 characteristics + material inventory (AC2, AC3);
  - shared back-half + cross-cutting invariants (AC12, AC13, AC14, AC15, AC17, AC23).
- **Resume regression** (manual): TC-RESUME-001 (2-session) and TC-RESUME-002
  (partial/abandoned/malformed state per DEC-6).
- **CI gate list (§7)**: `git diff --check`; Claude-plugin staleness
  (`test-build-claude-plugin.sh`); doc-distribution marker
  (`test-doc-distribution.sh`, only if a redistributable doc is amended);
  inception consistency regression (`test-inception-doc-consistency.sh`).

### 1.2 Out of Scope & Known Gaps

- **NO CI-executable prompt-structure test** — by design (DEC-9). Any structural prompt
  invariant (allowlist entries, four instruction-file references, well-formed tags,
  anti-sycophancy placement, secrets prohibition) is governed by **TDR-0001** and verified
  by **PR review**, NOT by a CI grep test. Do not re-introduce one without revisiting DEC-9.
- **NO behavioral AC is CI-testable** — an LLM agent cannot be executed deterministically
  in CI (RSK-2). All AC1–AC23 coverage is the manual matrix + PR review.
- **No `.ai/local/bootstrapper-context.yaml`** — eradicated (DEC-8); referenced in this
  plan only as superseded history (DM-4), never as a current/required artifact.
- GH-33 tribal-knowledge **extraction** machinery — out of scope (the workflow only
  consumes/graduates a present `tribal-knowledge` doc; spec NG-1).
- GH-68 (inception:4 layered tech planning), GH-70 (capstone self-hosting) — out of scope
  per spec §4.2.
- Authoring or editing inception templates — all shipped in GH-69.
- Running user research / experiments — inception captures outputs, does not run them.
- Runtime telemetry — N/A (spec §10): agents have no runtime telemetry; observability is
  the committed `doc/inception/inception-state.yaml`.

## 2. References

| Ref | Path |
|-----|------|
| Change spec (primary traceability source) | `./chg-GH-71-spec.md` |
| Implementation plan | `./chg-GH-71-plan.md` |
| File under test (OpenCode source) | `.opencode/agent/bootstrapper.md` |
| Generated plugin counterpart | `.ados-claude/agents/bootstrapper.md` |
| Prompt-structure authority (decision) | `doc/decisions/TDR-0001` (per DEC-7/DEC-9) |
| Human authority guide (GH-69) | `doc/guides/project-inception.md` |
| Inception state template | `doc/templates/inception-state-template.yaml` |
| Code-review instructions blueprint | `doc/templates/blueprints/code-review-instructions--example.md` |
| Testing strategy | `.ai/rules/testing-strategy.md` |
| Multi-tool / regeneration rule | `AGENTS.md` → "Multi-tool support" |
| Doc distribution marker rule | `AGENTS.md` → "Doc distribution marker (`ados_distribution`)" |
| CI guard — plugin freshness | `scripts/.tests/test-build-claude-plugin.sh` |
| CI guard — doc distribution | `scripts/.tests/test-doc-distribution.sh` |
| CI guard — inception consistency | `scripts/.tests/test-inception-doc-consistency.sh` |
| Regeneration script | `scripts/build-claude-plugin.sh` |

> **Note (DEC-9):** `scripts/.tests/test-bootstrapper-prompt-structure.sh` is **deleted**
> by this change and is intentionally NOT in the reference table or the CI gate list. Its
> role as a structural guard is retired; TDR-0001 + PR review govern structure.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

> **Coverage model post-amendment (DEC-8/DEC-9):** every active AC maps to ≥1 TC in the
> **manual** `TC-INCEP-*` matrix (with TC-RESUME-* for AC13 depth). There is no CI
> structural layer anymore. AC16 is SUPERSEDED.

| AC ID | Description (Given/When/Then) | TC ID(s) | Status |
|-------|-------------------------------|----------|--------|
| AC1 | `project.flow` selected once (new/legacy/ambiguous→ask); drives front-half (phases 0–4) within ONE 8-phase workflow — no separate legacy flow | TC-INCEP-001 | Covered (manual) |
| AC2 | Phase 0 detects 4 characteristics & activates exactly matching conditional artifacts | TC-INCEP-002 | Covered (manual) |
| AC3 | Phase 0 produces a material inventory mapping inputs→phases + key elements | TC-INCEP-003 | Covered (manual) |
| AC4 | North star carries strategic pyramid, measurable outcome, NSM, JTBD users | TC-INCEP-004 | Covered (manual) |
| AC5 | Conditional OST/PRD when discovery materials present; skipped otherwise | TC-INCEP-005 | Covered (manual) |
| AC6 | Each roadmap milestone has outcome-based metrics + validation approach | TC-INCEP-006 | Covered (manual) |
| AC7 | Assumption + risk registers tagged by the four-risk framework | TC-INCEP-007 | Covered (manual) |
| AC8 | UI-bearing → journeys + screen inventory; non-UI → skipped | TC-INCEP-008 | Covered (manual) |
| AC9 | Phase 3 → 10-attribute FSE audit + four-risk check on architecture | TC-INCEP-009, TC-INCEP-020 (legacy reconstruction) | Covered (manual) |
| AC10 | UI-bearing → Phase 4 UX guidance; non-UI → skipped | TC-INCEP-010 | Covered (manual) |
| AC11 | Code project → Phase 4 testing strategy + CI baseline + dev-env docs | TC-INCEP-011 | Covered (manual) |
| AC12 | No phase 0–7 advances without human approval; Phase 6 may reopen 1–4 | TC-INCEP-012 | Covered (manual) |
| AC13 | Fresh session reads `doc/inception/inception-state.yaml` (`project.flow` is source of truth), resumes at last incomplete phase | TC-INCEP-013, TC-RESUME-001, TC-RESUME-002 | Covered (manual) |
| AC14 | Anti-sycophancy techniques in correct phases; none in 0/5/6/7 | TC-INCEP-014 | Covered (manual) |
| AC15 | Phase 5 generates all four `.ai/agent/*-instructions.md` (pm, pr, decision, code-review) | TC-INCEP-016 | Covered (manual) |
| AC16 | *(Original: "legacy 6-phase flow + git-ignored state behave unchanged.")* | — | **SUPERSEDED by DEC-8** — the legacy 6-phase flow is eradicated; its intent is carried by AC23. |
| AC17 | Unified workflow references the guide, does not recreate it | TC-INCEP-015 | Covered (manual) |
| AC18 | `project.flow: legacy` → Phase 0 produces `repo-analysis` + consumes `tribal-knowledge` if present | TC-INCEP-017 | Covered (manual) |
| AC19 | `project.flow: legacy` → Phase 1 north star extracted/reconciled (vision/mission reconciled, not rewritten) + behavioral specs extracted from tests | TC-INCEP-018 | Covered (manual) |
| AC20 | `project.flow: legacy` → Phase 2 scope framed as next milestone (not "MVP") + consumed tribal knowledge graduated to permanent homes | TC-INCEP-019 | Covered (manual) |
| AC21 | `project.flow: legacy` → Phase 3 architecture reconstructed from code + low-confidence areas flagged | TC-INCEP-020 | Covered (manual) |
| AC22 | `project.flow: legacy` → Phase 4 conventions audited vs FSE (ACTUAL, not ideal) + gaps flagged | TC-INCEP-021 | Covered (manual) |
| AC23 | Exactly ONE 8-phase workflow + ONE state file; legacy 6-phase flow & `.ai/local/bootstrapper-context.yaml` absent | TC-INCEP-022 | Covered (manual) |

| F ID | Capability | TC ID(s) |
|------|-----------|----------|
| F-1 | Front-half selection via `project.flow` | TC-INCEP-001, TC-INCEP-022 |
| F-2 | Project-characteristics detection & conditional activation | TC-INCEP-002 |
| F-3 | Material inventory from staged inputs | TC-INCEP-003 |
| F-4 | Enriched north star (new author / legacy extract) | TC-INCEP-004, TC-INCEP-018 |
| F-5 | Conditional discovery artifacts | TC-INCEP-005 |
| F-6 | Enriched roadmap with validation | TC-INCEP-006 |
| F-7 | Assumption & risk registers (four-risk tagged) | TC-INCEP-007 |
| F-8 | Conditional UX artifacts | TC-INCEP-008 |
| F-9 | FSE audit & four-risk check (Phase 3; incl. legacy reconstruction) | TC-INCEP-009, TC-INCEP-020 |
| F-10 | Conditional UX guidance (Phase 4) | TC-INCEP-010 |
| F-11 | Code-project quality baseline (Phase 4; incl. legacy conventions audit) | TC-INCEP-011, TC-INCEP-021 |
| F-12 | Per-phase human gates | TC-INCEP-012 |
| F-13 | Repo-persistent state & resume | TC-INCEP-013, TC-RESUME-001, TC-RESUME-002 |
| F-14 | Embedded anti-sycophancy | TC-INCEP-014 |
| F-15 | All-four instruction-file generation | TC-INCEP-016 |
| F-17 | Legacy repo ingestion (Phase 0) | TC-INCEP-017 |
| F-18 | Legacy north-star & behavioral-spec extraction (Phase 1) | TC-INCEP-018 |
| F-19 | Legacy next-milestone scope & tribal-knowledge graduation (Phase 2) | TC-INCEP-019 |
| F-20 | Legacy architecture reconstruction & uncertainty flagging (Phase 3) | TC-INCEP-020 |
| F-21 | Legacy conventions audit (Phase 4) | TC-INCEP-021 |

> **F-16 (legacy parity) — DROPPED.** The prior capability "preserve the legacy 6-phase
> flow unchanged" no longer applies: the legacy flow is eradicated (DEC-8). There is no
> separate flow to preserve. The `F-16` → `F-17` numbering gap mirrors the spec (F-16
> retired; F-17–F-21 added for the legacy front-half fold-in).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (spec §8.1 N/A), no events (spec §8.2 N/A), no new external integrations
(spec §8.4 N/A). Data-model coverage:

| DM ID | Element | TC ID(s) |
|-------|---------|----------|
| DM-1 | `doc/inception/inception-state.yaml` — the **single** committed state file (both flows) | TC-INCEP-013, TC-RESUME-001, TC-RESUME-002, TC-INCEP-022 |
| DM-2 | `project.flow` (new\|legacy\|ambiguous) + four `characteristics` booleans drive front-half behavior + conditional artifacts | TC-INCEP-001, TC-INCEP-002, TC-INCEP-017–021 |
| DM-3 | `assumptions[]` carry `risk_type` + `validation_status` (four-risk tags) | TC-INCEP-007 |
| DM-4 | Eradicated state artifact: `.ai/local/bootstrapper-context.yaml` removed (no replacement; referenced as superseded history) | TC-INCEP-022 (asserts it is absent) |

### 3.3 Non-Functional Coverage (NFR-#)

> Structural prompt invariants (NFR-3 maintainability, NFR-6 secrets prohibition) are now
> governed by **TDR-0001 + PR review**, NOT a CI test (DEC-9). They are verified manually
> as part of the matrix and at PR review.

| NFR ID | Requirement | TC ID(s) | Notes |
|--------|-------------|----------|-------|
| NFR-1 | Front-half selection determinism (0 silent guesses; ambiguous → asks) | TC-INCEP-001 | Behavioral only. |
| NFR-2 | Resume correctness — last incomplete phase from state alone; `project.flow` is the resume source of truth | TC-INCEP-013, TC-RESUME-001, TC-RESUME-002 | Single-file read, no in-memory reliance. |
| NFR-3 | Prompt maintainability — references guide, no duplicate prose, well-formed sections (inline-vs-referenced boundary §5.2 of spec) | TC-INCEP-015 + PR review | Structure authority = TDR-0001 (not a CI test). |
| NFR-4 | Unified-process invariant — exactly ONE workflow + ONE state file; legacy flow & git-ignored state absent | TC-INCEP-022 | *(Supersedes the old "legacy behavioral parity" NFR-4; see DEC-8.)* |
| NFR-5 | Guide/prompt consistency — 0 contradictions at delivery | TC-INCEP-015 + PR review | |
| NFR-6 | State-file never contains secrets | TC-INCEP-013, TC-RESUME-002 + PR review | Prohibition language governed by TDR-0001. |
| NFR-7 | Write-safety — writes confined to allowlist; outside → human confirm + warning | TC-INCEP-012 + PR review | |

Risk coverage (informational — risks are mitigated by the tests / PR review above):

| RSK ID | Risk | Covered by |
|--------|------|------------|
| RSK-1 | Prompt bloat degrades instruction-following | PR review (manual); no CI size guardrail — DEC-9 retired the proposed guardrail with the structure test. Bloat is judged by a human at PR review against TDR-0001's inline-vs-referenced boundary. |
| RSK-2 | Most AC behavioral, untestable in CI | The manual `TC-INCEP-*` matrix + PR review are the ONLY coverage; this is stated honestly throughout (§1, §4, §8.1). |
| RSK-3 | Front-half selection ambiguity → wrong branch | TC-INCEP-001 (ambiguous → asks). |
| RSK-4 | *(Original: "two state files confuse the agent.")* | **SUPERSEDED by DEC-8** — there is now a single state file; the two-state-file premise no longer holds (spec §11). |
| RSK-5 | Guide/prompt drift | TC-INCEP-015 + PR review. |
| RSK-6 | Editing the agent regresses the **unified** flow (no CI structure guard) | Behavioral correctness verified by the manual `TC-INCEP-*` matrix + PR review; **TDR-0001 is the structure authority** (DEC-9). No frozen legacy blocks remain to guard. |
| RSK-7 | Generated plugin goes stale | CI `test-build-claude-plugin.sh`. |
| RSK-8 | Eradication breaks re-inception for projects previously bootstrapped via GH-32 | TC-INCEP-001 (existing repo → `project.flow: legacy` → unified flow) + TC-INCEP-022. |

## 4. Test Types and Layers

This is a **prompt/doc-only change**. Per `.ai/rules/testing-strategy.md`, applicable
layers are **static/diff checks** + **content checks** + **manual verification**.

**There is a single coverage layer for the behavioral deliverable, plus CI gates for the
mechanical bits:**

- **Layer A — Manual behavioral matrix (`TC-INCEP-*`) + PR review** (human-executed): the
  honest way to "test" behavioral agent-capability AC. One row per AC, covering BOTH
  front-halves. Target: a human running `@bootstrapper` / `/bootstrap` in scratch repos.
  Framework: none (LLM agent); evidence = captured session transcript + observed artifacts
  + filled pass/fail. **PR review** is the complementary structural check (TDR-0001 is the
  authority): the reviewer reads the diff and confirms allowlist entries, four
  instruction-file references, well-formed tags, anti-sycophancy placement, and secrets
  prohibition by inspection — not by a brittle CI grep.
- **Layer B — Resume regression** (human-executed, manual): TC-RESUME-001 (2-session) and
  TC-RESUME-002 (partial/abandoned/malformed state per DEC-6). Target: human in scratch
  repos.
- **CI gates (mechanical only — §7):** `git diff --check`; Claude-plugin freshness
  (`test-build-claude-plugin.sh`); doc-distribution marker
  (`test-doc-distribution.sh`, conditional); inception consistency regression
  (`test-inception-doc-consistency.sh`). **None of these assert bootstrapper behavior.**

> **What CI does NOT cover (be explicit):** no CI test executes the agent, asserts a phase
> advances on a gate, confirms `code-review-instructions.md` is written, checks four-risk
> tagging in the agent file, or guards prompt structure. All of that is Layer A (manual)
> + PR review. This is the DEC-9 trade-off: lose a brittle grep that gave false
> confidence, keep honesty.

No unit/integration/E2E framework applies (no runnable application code).

## 5. Test Scenarios

### 5.1 Scenario Index

**Active scenarios** (the manual matrix + resume regression):

| TC ID | Title | Type | Layer | Priority | AC / NFR / DM Coverage |
|-------|-------|------|-------|----------|------------------------|
| TC-INCEP-001 | Front-half selection: new vs legacy vs ambiguous | Happy Path / Corner Case | A (manual) | High | AC1, F-1, DM-2, NFR-1, RSK-3, RSK-8 |
| TC-INCEP-002 | Characteristics detection & conditional activation | Happy Path | A (manual) | High | AC2, F-2, DM-2 |
| TC-INCEP-003 | Material inventory from staged inputs | Happy Path | A (manual) | High | AC3, F-3 |
| TC-INCEP-004 | Enriched north star content (new author) | Happy Path | A (manual) | High | AC4, F-4 |
| TC-INCEP-005 | Conditional OST/PRD generation & skip | Happy Path / Edge Case | A (manual) | Medium | AC5, F-5 |
| TC-INCEP-006 | Roadmap milestones with validation | Happy Path | A (manual) | Medium | AC6, F-6 |
| TC-INCEP-007 | Four-risk-tagged registers | Happy Path | A (manual) | High | AC7, F-7, DM-3 |
| TC-INCEP-008 | Conditional UX artifacts (journeys + screens) | Happy Path / Edge Case | A (manual) | Medium | AC8, F-8, F-2 |
| TC-INCEP-009 | Phase 3 FSE audit + four-risk architecture check | Happy Path | A (manual) | High | AC9, F-9 |
| TC-INCEP-010 | Conditional Phase-4 UX guidance | Happy Path / Edge Case | A (manual) | Medium | AC10, F-10, F-2 |
| TC-INCEP-011 | Code-project quality baseline | Happy Path | A (manual) | Medium | AC11, F-11, F-2 |
| TC-INCEP-012 | Per-phase gates + Phase-6 reopen + write-safety | Corner Case | A (manual) | High | AC12, F-12, NFR-7 |
| TC-INCEP-013 | Resume smoke (re-invoke → resumes at last phase) | Happy Path | A (manual) | High | AC13, F-13, DM-1, NFR-2, NFR-6 |
| TC-INCEP-014 | Anti-sycophancy behavioral run (per phase) | Corner Case | A (manual) | High | AC14, F-14 |
| TC-INCEP-015 | Guide referenced at runtime, not duplicated | Happy Path | A (manual) | Medium | AC17, F-1, NFR-5, NFR-3 |
| TC-INCEP-016 | Phase 5 writes all four instruction files (incl. code-review) | Happy Path / Regression | A (manual) | High | AC15, F-15, DM-2 |
| TC-INCEP-017 | Legacy repo ingestion + tribal-knowledge consume (Phase 0) | Happy Path | A (manual) | High | AC18, F-17, DM-2 |
| TC-INCEP-018 | Legacy north-star reconciliation + behavioral-spec extraction from tests (Phase 1) | Happy Path | A (manual) | High | AC19, F-18, F-4 |
| TC-INCEP-019 | Legacy next-milestone scope + tribal-knowledge graduation (Phase 2) | Happy Path | A (manual) | Medium | AC20, F-19 |
| TC-INCEP-020 | Legacy architecture reconstruction + uncertainty flagging (Phase 3) | Happy Path | A (manual) | Medium | AC21, F-20, F-9 |
| TC-INCEP-021 | Legacy conventions audit vs FSE (Phase 4) | Happy Path | A (manual) | Medium | AC22, F-21, F-11 |
| TC-INCEP-022 | Unified-process invariant (one workflow, one state file, legacy absent) | Regression | A (manual) | High | AC23, F-1, NFR-4, DM-1, DM-4 |
| TC-RESUME-001 | 2-session inception resume simulation | Regression | B (manual) | High | AC13, F-13, DM-1, NFR-2 |
| TC-RESUME-002 | Resume edge: partial/abandoned/malformed state (DEC-6) | Corner Case | B (manual) | Medium | AC13, NFR-2, NFR-6, DEC-6 |

**Superseded scenarios** (registry — NOT run; kept for ID traceability; see §5.3):

| TC ID | Original Title | Superseded by | Reason |
|-------|----------------|---------------|--------|
| TC-STRUCT-001 | Write-allowlist has inception + code-review paths | DEC-9 | Part of the deleted structure test; the allowlist is now verified at PR review against TDR-0001. |
| TC-STRUCT-002 | Phase 5 references all four instruction files | DEC-9 | Behavioral assertion lives in TC-INCEP-016; the static grep is retired. |
| TC-STRUCT-003 | Legacy section anchors intact (two-tier parity) | DEC-8 / DEC-9 | No frozen legacy blocks remain (the 6-phase flow is eradicated); parity has no object. AC16 superseded. |
| TC-STRUCT-004 | Guide referenced, not recreated | DEC-9 | Behavioral confirmation = TC-INCEP-015; PR review confirms the reference. |
| TC-STRUCT-005 | Prompt XML-ish tags well-formed | DEC-9 | TDR-0001 is the structure authority; tag well-formedness is a PR-review check, not a CI grep. |
| TC-STRUCT-006 | Plugin regeneration staleness gate | DEC-9 | Folded into the §7 CI gate list (`test-build-claude-plugin.sh`); not a per-change TC scenario. |
| TC-STRUCT-007 | Doc-distribution marker on amended guide | DEC-9 | Folded into the §7 CI gate list (`test-doc-distribution.sh`, conditional); not a per-change TC scenario. |
| TC-STRUCT-008 | Anti-sycophancy placement (per-phase anchors) | DEC-9 | Behavioral confirmation = TC-INCEP-014; the anchor-based grep is retired. |
| TC-STRUCT-009 | Phase 0 characteristics detection section present | DEC-9 | Behavioral confirmation = TC-INCEP-002; keyword presence is brittle. |
| TC-STRUCT-010 | Phase 0 material-inventory step present | DEC-9 | Behavioral confirmation = TC-INCEP-003. |
| TC-STRUCT-011 | Committed state + four-risk tags + per-mode state rule | DEC-9 | Four-risk tagging in the agent file is a PR-review check; the behavioral registers = TC-INCEP-007. |
| TC-STRUCT-012 | Secrets-prohibition language preserved | DEC-9 | Governed by TDR-0001 + PR review; behavioral state-scan = TC-INCEP-013 / TC-RESUME-002. |
| TC-INFRA-001 | (PROPOSED) Bundled prompt-structure test + size guardrail | DEC-9 | The bundle target (`test-bootstrapper-prompt-structure.sh`) is deleted; the whole proposal is retired. |
| TC-LEGACY-001 | Legacy flow end-to-end in existing-repo scratch (6-phase parity) | DEC-8 / AC16 superseded | No legacy 6-phase flow remains; an existing repo now runs the **unified** flow with `project.flow: legacy` (covered by TC-INCEP-001 + TC-INCEP-017–021). |
| TC-LEGACY-002 | Legacy write-allowlist unchanged (no inception leak) | DEC-8 / AC16 superseded | No separate legacy allowlist exists; the unified flow has ONE allowlist. Write-safety for both flows is covered by TC-INCEP-012 + PR review. |

### 5.2 Scenario Details

---

#### TC-INCEP-001 - Front-half selection: new vs legacy vs ambiguous

**Scenario Type**: Happy Path / Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC1, F-1, DM-2, NFR-1, RSK-3, RSK-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch repos (empty + existing + ambiguous)
**Tags**: @agent, @manual

**Preconditions**:
- Three scratch repos prepared: (a) empty/git-init only; (b) greenfield with a 1-line
  idea README and no code; (c) an existing repo with source + non-trivial git history
  (a pre-ADOS long-lived project).

**Steps**:
1. In (a) empty repo: invoke `/bootstrap`. Observe Phase 0 selects `project.flow: new`
   and the **unified 8-phase workflow** begins, with the `new` authoring front-half
   (phases 0–4).
2. In (c) existing repo: invoke `/bootstrap`. Observe Phase 0 selects
   `project.flow: legacy` and the **same unified 8-phase workflow** begins, with the
   `legacy` extract/reconstruct front-half (phases 0–4). Confirm there is **no separate
   6-phase flow** — phases 5–7 are identical to the `new` run.
3. In (b) ambiguous repo (idea only, no code/history): invoke `/bootstrap`. Observe the
   agent surfaces one clarifying question rather than silently guessing.

**Expected Outcome**:
- (a) routes to the `new` front-half; (c) routes to the `legacy` front-half of the SAME
  workflow; (b) asks. 0 silent guesses (NFR-1). Both (a) and (c) run one 8-phase workflow
  — only the front-half differs.

**Pass/Fail**:
- Pass only if all three outcomes are observed, no silent mis-route, and NO separate
  6-phase flow is invoked in (c) (this is the AC23 invariant — cross-checked by
  TC-INCEP-022).

---

#### TC-INCEP-002 - Characteristics detection & conditional activation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC2, F-2, DM-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch inception repo (new or legacy)
**Tags**: @agent, @manual

**Preconditions**:
- A `project.flow` selected (either); a UI-bearing, multi-user, complex-domain code
  project scenario described in staged inputs.

**Steps**:
1. Run Phase 0. Confirm the agent detects and records all four booleans
   (`ui_bearing`, `multi_user`, `complex_domain`, `code_project`) in state.
2. Confirm exactly the matching conditional artifacts are activated (UI →
   journeys/screens/UX guidance; multi-user → personas/JTBD; complex domain →
   ubiquitous language; code → testing/CI/dev-env).

**Expected Outcome**:
- Four signals recorded; artifact activation matches signals 1:1 (no over/under-activation).
- Detection applies to BOTH flows (Phase 0 runs for `new` and `legacy`).

---

#### TC-INCEP-003 - Material inventory from staged inputs

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC3, F-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/inception/inputs/`
**Tags**: @agent, @manual

**Preconditions**:
- `doc/inception/inputs/` populated with 2–3 sample materials (e.g., a pitch doc, a
  competitor note). (For `legacy`, repo content is additional source material — see
  TC-INCEP-017.)

**Steps**:
1. Run Phase 0 to completion.
2. Inspect the produced material inventory.

**Expected Outcome**:
- Each staged input is listed, mapped to the phase it informs, with extracted key
  elements/concepts. Applies to both flows.

---

#### TC-INCEP-004 - Enriched north star content (new author)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC4, F-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/overview/` north star artifact
**Tags**: @agent, @manual

**Preconditions**:
- `project.flow: new`; Phase 0 gated; Phase 1 run. (The `legacy` north-star path —
  extract/reconcile rather than author — is TC-INCEP-018.)

**Steps**:
1. Complete Phase 1 (Socratic session over the inventory).
2. Inspect the drafted north star.

**Expected Outcome**:
- Contains strategic-pyramid context (mission→vision→strategy→outcome), a measurable
  outcome, the North Star Metric (with guardrails), and target users with JTBD.

---

#### TC-INCEP-005 - Conditional OST/PRD generation & skip

**Scenario Type**: Happy Path / Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC5, F-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: OST / project-PRD artifacts
**Tags**: @agent, @manual

**Preconditions**:
- Two scenarios staged: (A) discovery materials present; (B) none.

**Steps**:
1. In (A): complete Phase 1; confirm an OST and/or project PRD is produced.
2. In (B): complete Phase 1; confirm OST/PRD are skipped.

**Expected Outcome**:
- Conditional activation correct in both directions. Applies to both flows.

---

#### TC-INCEP-006 - Roadmap milestones with validation

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC6, F-6
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: engineering roadmap artifact
**Tags**: @agent, @manual

**Preconditions**:
- Phase 2 reached. (For `legacy`, milestone scope is the **next milestone**, not an "MVP" —
  cross-checked by TC-INCEP-019.)

**Steps**:
1. Complete Phase 2; inspect the drafted roadmap.

**Expected Outcome**:
- Each milestone carries deliverables, outcome-based success metrics, and a validation
  approach (not a feature list); OST linkage present where discovery exists.

---

#### TC-INCEP-007 - Four-risk-tagged registers

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC7, F-7, DM-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: assumption + risk registers
**Tags**: @agent, @manual

**Preconditions**:
- Phase 2 reached.

**Steps**:
1. Complete Phase 2; inspect both registers.

**Expected Outcome**:
- An assumption register exists; each assumption tagged with a `risk_type` ∈
  {Value, Usability, Feasibility, Viability} and a `validation_status`. The wrong term
  `desirability` does NOT appear.
- A risk register exists with a four-risk assessment for the current milestone.

---

#### TC-INCEP-008 - Conditional UX artifacts (journeys + screens)

**Scenario Type**: Happy Path / Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC8, F-8, F-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: user-journey + screen-inventory artifacts
**Tags**: @agent, @manual

**Preconditions**:
- `ui_bearing=true` scenario (A) and `ui_bearing=false` scenario (B).

**Steps**:
1. (A): complete Phase 2; confirm user journeys + screen inventory produced.
2. (B): confirm they are skipped.

**Expected Outcome**:
- UX artifacts present only when UI-bearing. Applies to both flows.

---

#### TC-INCEP-009 - Phase 3 FSE audit + four-risk architecture check

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC9, F-9
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: tech-stack, architecture, FSE audit, ADRs
**Tags**: @agent, @manual

**Preconditions**:
- Phase 3 reached. (For `legacy`, architecture is **reconstructed from code** with
  uncertainty flagging — TC-INCEP-020 — rather than authored greenfield.)

**Steps**:
1. Complete Phase 3 (`new` flow); inspect architecture + audit outputs.

**Expected Outcome**:
- 10-attribute Full-Stack Environment audit present; ADRs seeded; a four-risk check on
  architecture decisions present (NFRs optionally for non-trivial projects).

---

#### TC-INCEP-010 - Conditional Phase-4 UX guidance

**Scenario Type**: Happy Path / Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC10, F-10, F-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: UX-guidance artifact
**Tags**: @agent, @manual

**Preconditions**:
- UI-bearing (A) and non-UI (B) scenarios.

**Steps**:
1. (A): complete Phase 4; confirm UX design guidance (design system, WCAG level,
   interaction patterns, responsive breakpoints).
2. (B): confirm skipped.

**Expected Outcome**:
- UX guidance present only when UI-bearing. Applies to both flows.

---

#### TC-INCEP-011 - Code-project quality baseline

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC11, F-11, F-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: testing-strategy, CI baseline, dev-env docs
**Tags**: @agent, @manual

**Preconditions**:
- `code_project=true`. (For `legacy`, conventions are additionally **audited vs FSE** —
  TC-INCEP-021 — documenting ACTUAL, not ideal.)

**Steps**:
1. Complete Phase 4 (`new` flow); inspect quality-baseline outputs.

**Expected Outcome**:
- Testing strategy, CI baseline (lint + typecheck + test), and dev-environment docs
  (setup guide + `.env.example`) produced.

---

#### TC-INCEP-012 - Per-phase gates + Phase-6 reopen + write-safety

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC12, F-12, NFR-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: full inception run (both flows)
**Tags**: @agent, @manual

**Preconditions**:
- A full inception run in progress (`new` or `legacy`).

**Steps**:
1. At each phase boundary (0–7), attempt to advance WITHOUT giving explicit approval.
   Confirm the agent does not advance.
2. At Phase 6, engineer a gap (e.g., a missing register field) and observe FAIL → the
   agent reopens the relevant earlier phase (1–4).
3. Attempt a write outside the allowlist; confirm the agent requests explicit human
   confirmation with a warning (NFR-7). This is the **single unified** allowlist — there
   is no separate legacy allowlist.

**Expected Outcome**:
- No auto-advance; Phase 6 can reopen; out-of-allowlist writes are gated. Applies to both
  flows (one allowlist, one gating model).

---

#### TC-INCEP-013 - Resume smoke (re-invoke → resumes at last phase)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC13, F-13, DM-1, NFR-2, NFR-6
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/inception/inception-state.yaml`
**Tags**: @agent, @manual

**Preconditions**:
- An inception run paused after a Phase 2 gate; state committed.

**Steps**:
1. Re-invoke `/bootstrap` in a fresh session (no in-memory context).
2. Confirm the agent reads ONLY `doc/inception/inception-state.yaml`, treats `project.flow`
   as the resume source of truth (does NOT re-derive it from repo shape), determines the
   last incomplete phase, and resumes there with prior artifacts as context.
3. Inspect the committed state for any accidental secret-like value (NFR-6).

**Expected Outcome**:
- Resume from state file alone (NFR-2); `project.flow`-driven; no secret-like content in
  state.

**Notes**:
- The rigorous cross-session + compaction variant is TC-RESUME-001; the
  partial/abandoned/malformed variant is TC-RESUME-002.

---

#### TC-INCEP-014 - Anti-sycophancy behavioral run (per phase)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC14, F-14
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: per-phase pre-gate step (both flows)
**Tags**: @agent, @manual

**Preconditions**:
- A run reaching each decision-dense phase. (The map is identical for `new` and `legacy`
  — spec Appendix B.)

**Steps**:
1. At each phase's pre-gate step, observe the agent executing the correct technique:
   - P1: devil's advocate + four-risk awareness
   - P2: pre-mortem + four-risk check
   - P3: alternative comparison + pre-mortem
   - P4: unknown-unknowns
2. At P0 / P5 / P6 / P7, confirm NO anti-sycophancy step runs.

**Expected Outcome**:
- Each technique appears in its phase and only its phase; none in 0/5/6/7.

**Notes**:
- The anti-sycophancy **placement** in the prompt is a PR-review check governed by
  TDR-0001 (the old anchor-grep, TC-STRUCT-008, is retired by DEC-9). This TC confirms the
  agent actually invokes the techniques at runtime.

---

#### TC-INCEP-015 - Guide referenced at runtime, not duplicated

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC17, F-1, NFR-5, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: agent runtime + `doc/guides/project-inception.md`
**Tags**: @agent, @manual

**Preconditions**:
- The unified workflow active (`new` or `legacy`).

**Steps**:
1. When the agent needs human-readable phase detail, observe it pointing to
   `doc/guides/project-inception.md` rather than re-deriving the phase prose inline.
2. Spot-check the prompt's stated phase behavior against the guide for contradictions.

**Expected Outcome**:
- Guide is the cited authority; 0 contradictions observed (NFR-5). The prompt follows the
  inline-vs-referenced boundary (operational skeleton inline; substantive detail
  referenced) — also checked at PR review (NFR-3).

---

#### TC-INCEP-016 - Phase 5 writes all four instruction files (incl. code-review)

**Scenario Type**: Happy Path / Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC15, F-15, DM-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch repo `.ai/agent/*-instructions.md` (both flows)
**Tags**: @agent, @manual

**Given/When/Then (AC15):** *Given* an inception run has reached Phase 5, *when* Phase 5
completes and its human gate is approved, *then* all four `.ai/agent/*-instructions.md`
files exist — pm, pr, decision, AND code-review-instructions.md.

**Preconditions**:
- A scratch inception repo; phases 0–4 completed and gated. (Phase 5 is the SHARED
  back-half — identical for `new` and `legacy` — so this can run against either flow.)
- The GH-69 blueprint `doc/templates/blueprints/code-review-instructions--example.md`
  present (the source for the code-review file).

**Steps**:
1. Run inception Phase 5 to completion and pass Gate 5.
2. Inspect `.ai/agent/` and assert all FOUR files are written:
   - `pm-instructions.md`
   - `pr-instructions.md`
   - `decision-instructions.md`
   - `code-review-instructions.md` (the GH-32 gap closure)
3. Confirm `code-review-instructions.md` is non-empty, project-local, and consistent
   with the GH-69 blueprint (generated from it, not a verbatim untouched copy that
   ignores the project).
4. Confirm the other three files are also non-empty and project-tailored (not stale
   legacy templates).

**Expected Outcome**:
- Exactly four instruction files present, including `code-review-instructions.md`.
- The code-review file is derived from the blueprint and reflects the project.

**Pass/Fail**:
- Pass only if all four files exist post-Phase-5 (incl. `code-review-instructions.md`)
  and are project-consistent. Fail if any of the four is missing or if
  `code-review-instructions.md` is absent (the historical GH-32 gap).

**Notes**:
- This is the **one substantive behavioral assertion** for AC15 (the GH-32 gap closure).
  With the structure test retired (DEC-9), the static "four-file reference present" check
  is now a PR-review item; this TC is the behavioral confirmation that the files are
  ACTUALLY written.

---

#### TC-INCEP-017 - Legacy repo ingestion + tribal-knowledge consume (Phase 0)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High (legacy front-half P0)
**Related IDs**: AC18, F-17, DM-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch existing-repo; `repo-analysis` artifact
**Tags**: @agent, @manual, @legacy

**Given/When/Then (AC18):** *Given* `project.flow: legacy`, *when* Phase 0 completes,
*then* a `repo-analysis` is produced (component map, data flow, dependencies, external
integrations) and `tribal-knowledge` is consumed if present.

**Preconditions**:
- A scratch repo with real source code, components, dependencies, and ≥1 external
  integration (a pre-ADOS long-lived project). Optionally a staged `tribal-knowledge`
  doc for one sub-case.

**Steps**:
1. Invoke `/bootstrap`; confirm `project.flow: legacy` is selected.
2. Run Phase 0 to completion and pass Gate 0.
3. Inspect the `repo-analysis` artifact.

**Expected Outcome**:
- A `repo-analysis` exists covering: component map, data flow, dependencies, and external
  integrations.
- Repo content is treated as **untrusted source material** — facts extracted only, no
  embedded instructions followed.
- If a `tribal-knowledge` doc was staged, it is consumed (and later graduated in Phase 2 —
  TC-INCEP-019); if absent, the run proceeds without it.

**Pass/Fail**:
- Pass if the `repo-analysis` covers all four facets and (when staged) tribal-knowledge is
  consumed. Fail if repo content is treated as trusted/instructional.

---

#### TC-INCEP-018 - Legacy north-star reconciliation + behavioral-spec extraction from tests (Phase 1)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High (legacy front-half P1)
**Related IDs**: AC19, F-18, F-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: north star artifact + seeded feature specs
**Tags**: @agent, @manual, @legacy

**Given/When/Then (AC19):** *Given* `project.flow: legacy`, *when* Phase 1 completes,
*then* the north star is extracted/reconciled from existing docs (vision/mission
reconciled, not rewritten) AND behavioral specs are extracted from existing tests to seed
initial feature specs.

**Preconditions**:
- `project.flow: legacy`; Phase 0 + `repo-analysis` complete and gated. The repo has
  documented vision/mission (e.g., in a README/docs) and a non-trivial test suite.

**Steps**:
1. Complete Phase 1 (extract/reconstruct path, not greenfield authoring).
2. Inspect the north star.
3. Inspect any seeded feature specs derived from tests.

**Expected Outcome**:
- North star reflects the **documented** vision/mission — reconciled, not rewritten from
  scratch. Existing strategic framing is preserved.
- Behavioral specs are **extracted from existing tests** and seed initial feature specs
  (the tests encode the system's actual intended behavior).

**Pass/Fail**:
- Pass if the north star reconciles (not rewrites) the existing vision and behavioral
  specs are extracted from tests. Fail if the agent discards documented vision and authors
  from scratch, or ignores the test suite.

**Contrast:** the `new`-flow authoring path for the north star is TC-INCEP-004.

---

#### TC-INCEP-019 - Legacy next-milestone scope + tribal-knowledge graduation (Phase 2)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium (legacy front-half P2)
**Related IDs**: AC20, F-19
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: roadmap (next milestone) + graduated docs
**Tags**: @agent, @manual, @legacy

**Given/When/Then (AC20):** *Given* `project.flow: legacy`, *when* Phase 2 completes,
*then* scope is framed as the next milestone (not "MVP") AND consumed tribal knowledge is
graduated to permanent homes (decisions, feature specs, glossary, conventions).

**Preconditions**:
- `project.flow: legacy`; a `tribal-knowledge` doc was consumed in Phase 0 (TC-INCEP-017).
- Phase 1 gated.

**Steps**:
1. Complete Phase 2.
2. Inspect the roadmap's current-milestone framing.
3. Inspect the permanent homes for the consumed tribal-knowledge content.

**Expected Outcome**:
- Scope is framed as the **next milestone** (the Current Milestone), NOT as an "MVP" —
  the framing recognizes the project already exists.
- Consumed tribal knowledge is **graduated** to permanent homes: relevant items appear in
  decisions (decision records), feature specs, glossary, and conventions — not left
  orphaned in the consumed `tribal-knowledge` doc.

**Pass/Fail**:
- Pass if milestone framing is "next milestone" (not "MVP") and tribal-knowledge content
  is graduated to the four permanent homes. Fail if an MVP framing is used or tribal
  knowledge is consumed but not graduated.

---

#### TC-INCEP-020 - Legacy architecture reconstruction + uncertainty flagging (Phase 3)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium (legacy front-half P3)
**Related IDs**: AC21, F-20, F-9
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: architecture artifact + flagged uncertainties
**Tags**: @agent, @manual, @legacy

**Given/When/Then (AC21):** *Given* `project.flow: legacy`, *when* Phase 3 completes,
*then* architecture is reconstructed from code AND low-confidence architecture areas are
explicitly flagged for human confirmation.

**Preconditions**:
- `project.flow: legacy`; Phase 2 gated; `repo-analysis` available.

**Steps**:
1. Complete Phase 3 (reconstruct path).
2. Inspect the architecture artifact and the FSE audit.

**Expected Outcome**:
- Architecture is **reconstructed from code**: component map, data flow, dependency graph,
  and external integrations are derived from the actual codebase.
- Low-confidence architecture areas (things the agent cannot infer with certainty) are
  **explicitly flagged** for human confirmation — not silently guessed or glossed over.
- The 10-attribute FSE audit + four-risk check (AC9) still apply.

**Pass/Fail**:
- Pass if reconstruction is code-derived and uncertainties are flagged. Fail if
  architecture is invented rather than reconstructed, or if low-confidence areas are
  asserted without flagging.

**Contrast:** the `new`-flow greenfield architecture path is TC-INCEP-009.

---

#### TC-INCEP-021 - Legacy conventions audit vs FSE (Phase 4)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium (legacy front-half P4)
**Related IDs**: AC22, F-21, F-11
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: conventions audit artifact
**Tags**: @agent, @manual, @legacy

**Given/When/Then (AC22):** *Given* `project.flow: legacy`, *when* Phase 4 completes,
*then* existing conventions are audited against the Full-Stack Environment checklist
(documenting ACTUAL, not ideal, conventions) and gaps are flagged.

**Preconditions**:
- `project.flow: legacy`; Phase 3 gated.

**Steps**:
1. Complete Phase 4 (legacy conventions audit path).
2. Inspect the conventions audit.

**Expected Outcome**:
- Existing conventions are **audited against the FSE checklist** — the audit documents the
  project's **ACTUAL** conventions (what the code really does), not ideal/aspirational
  conventions.
- Gaps between actual conventions and a clean FSE baseline are **flagged**.

**Pass/Fail**:
- Pass if the audit documents ACTUAL conventions and flags gaps. Fail if the audit
  documents idealized conventions, or fails to flag real gaps.

**Contrast:** the `new`-flow quality-baseline authoring path is TC-INCEP-011.

---

#### TC-INCEP-022 - Unified-process invariant (one workflow, one state file, legacy absent)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC23, F-1, NFR-4, DM-1, DM-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: agent file (PR-review) + scratch repo runs (both flows)
**Tags**: @agent, @manual, @regression

**Given/When/Then (AC23):** *Given* the redesigned bootstrapper, *when* any project is
incepted, *then* exactly one 8-phase workflow runs and exactly one state file
(`doc/inception/inception-state.yaml`) is used; the legacy 6-phase flow and
`.ai/local/bootstrapper-context.yaml` are absent.

**Preconditions**:
- The GH-71 branch checked out. Scratch repos for both `new` and `legacy`.

**Steps**:
1. **PR review (structural):** read the `.opencode/agent/bootstrapper.md` diff. Confirm
   there is NO separate legacy 6-phase flow block (no `<workflow_phases>` /
   `<phase_1_repo_scan>`…`<phase_6_write>` legacy anchors as a parallel path), and that
   `.ai/local/bootstrapper-context.yaml` is NOT referenced as a current state artifact
   (only as superseded history, if at all). Confirm ONE inception workflow + ONE state file
   are defined.
2. **Runtime (`new`):** run `/bootstrap` in an empty repo; confirm one 8-phase workflow
   and one committed `doc/inception/inception-state.yaml`. Confirm NO
   `.ai/local/bootstrapper-context.yaml` is ever written.
3. **Runtime (`legacy`):** run `/bootstrap` in an existing repo; confirm the SAME 8-phase
   workflow (only front-half differs) and the SAME committed state file. Confirm NO
   `.ai/local/bootstrapper-context.yaml` is ever written and no 6-phase flow is invoked.

**Expected Outcome**:
- Exactly one workflow (8 phases, 0–7) and exactly one state file
  (`doc/inception/inception-state.yaml`) for both flows.
- The legacy 6-phase flow and `.ai/local/bootstrapper-context.yaml` are **absent** — not
  referenced as current, not written at runtime (DM-4).

**Pass/Fail**:
- Pass only if all three steps hold. Fail if any separate legacy flow, second state file,
  or `.ai/local/bootstrapper-context.yaml` reference/write is observed.

**Notes**:
- This TC is the successor to the superseded AC16 legacy-parity intent: where AC16 tried to
  preserve a legacy flow, AC23 asserts there is none to preserve — only the unified flow.

---

#### TC-RESUME-001 - 2-session inception resume simulation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC13, F-13, DM-1, NFR-2
**Test Type(s)**: Manual / Integration (agent)
**Automation Level**: Manual
**Target Layer / Location**: `doc/inception/inception-state.yaml` across 2 sessions
**Tags**: @agent, @regression, @manual

**Preconditions**:
- Fresh inception run started (`new` or `legacy`); Phase 0 + Gate 0 completed and
  committed.

**Steps**:
1. **Session 1:** complete Phase 0 + Gate 0; confirm state committed to
   `doc/inception/inception-state.yaml`.
2. **Drop the session** (simulate conversation compaction / new day): clear in-memory
   context entirely.
3. **Session 2:** re-invoke `/bootstrap`. Confirm the agent reads ONLY the committed
   state file, treats `project.flow` as the resume source of truth (does not re-derive it
   from repo shape), determines the last incomplete phase is Phase 1, restores state +
   prior artifacts as context, and resumes at Phase 1 — not at Phase 0.

**Expected Outcome**:
- Resume determinable from state alone (NFR-2); no reliance on in-memory state; correct
  phase resumed.

---

#### TC-RESUME-002 - Resume edge: partial/abandoned/malformed state (DEC-6)

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC13, NFR-2, NFR-6, DEC-6 (resolves OQ-3)
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/inception/inception-state.yaml`
**Tags**: @agent, @manual, @edge

**Preconditions**:
- Three scratch repos with edge-case inception state, per DEC-6:
  - (A) a **partial but valid** `doc/inception/inception-state.yaml` left by an
    interrupted run (mid-phase, `project.flow: new` or `legacy`, schema valid).
  - (B) a state file representing an **abandoned** run the human decides to discard.
  - (C) a **malformed / `schema_version`-mismatched** state file.

**Steps (per sub-case; pass/fail recorded for each):**
1. **(A) Partial valid state:** re-invoke `/bootstrap`. Observe the agent reads
   `project.flow` as the resume source of truth and resumes at the flow's last incomplete
   phase — **no repo-shape re-derivation**, no re-running Phase 0 selection.
2. **(B) Abandoned run:** re-invoke `/bootstrap`; choose the archive-and-restart path.
   Observe the prior state is **archived to `doc/inception/abandoned-<ISO>.yaml`** and
   NOT silently overwritten or deleted; a fresh inception run then begins.
3. **(C) Malformed / `schema_version` mismatch:** re-invoke `/bootstrap` against the
   malformed file. Observe the agent **warns** and **offers repair or
   archive-and-restart**, rather than crashing or silently guessing.

**Expected Outcome (DEC-6):**
- (A) `project.flow`-driven resume; no mode re-derivation; resumes at the correct phase.
- (B) prior state archived to `doc/inception/abandoned-<ISO>.yaml`; never silently
  overwritten.
- (C) explicit warn + offer to repair or archive-and-restart; no crash, no silent guess.
- All three deterministic; 0 silent overwrites (NFR-2, NFR-1).

**Pass/Fail**:
- Pass only if all three sub-cases behave per DEC-6. Fail if any sub-case silently
  overwrites prior state, crashes, re-derives mode from repo shape, or guesses without
  warning.

---

### 5.3 Superseded Test Cases (registry — NOT run)

The following TC IDs are **superseded** and are **not** run as part of this change. They
are retained for ID traceability only. Full one-line reasons are in the §5.1 superseded
table; the summary:

- **TC-STRUCT-001 … TC-STRUCT-012 + TC-INFRA-001 — SUPERSEDED by DEC-9.** These formed the
  Layer-1 structure-test layer bundled into `scripts/.tests/test-bootstrapper-prompt-structure.sh`,
  which is **deleted**. The structure test hardcoded prompt wording (grep-as-a-test),
  would fossilize TDR-0001's chosen wording against future evolution, and gave false
  confidence. Its defensible piece (two-tier legacy parity) dissolves under DEC-8 (no
  frozen legacy blocks remain). **TDR-0001 is the structure authority**; behavioral
  correctness is the manual `TC-INCEP-*` matrix + PR review, not CI. Do not re-introduce
  these as open/required tests without revisiting DEC-9.
- **TC-STRUCT-003 (two-tier legacy parity), TC-LEGACY-001, TC-LEGACY-002 — SUPERSEDED by
  DEC-8 / AC16.** The legacy 6-phase flow is eradicated; there is no separate unchanged
  legacy flow to preserve, no frozen legacy blocks to diff, and no separate legacy
  allowlist. AC16's intent is carried by AC23 (TC-INCEP-022).

Where a superseded TC's behavioral intent survives, it is covered by a manual `TC-INCEP-*`
scenario or by PR review (mapped in the §5.1 superseded table).

## 6. Environments and Test Data

- **CI (mechanical gates only):** the repo CI runner; no special environment. No baseline
  SHA is needed (the region-parity diff, former TC-STRUCT-003, is retired with the legacy
  flow — DEC-8/DEC-9).
- **Manual matrix + resume regression (local-dev only):** scratch repos:
  - empty/git-init repo (`project.flow: new`);
  - greenfield "idea-only" repo (ambiguous selection);
  - existing-repo scratch with real source + non-trivial git history
    (`project.flow: legacy` — used by TC-INCEP-017–021 and TC-INCEP-022);
  - `doc/inception/inputs/` populated with 2–3 sample materials; optionally a staged
    `tribal-knowledge` doc for the legacy graduation path (TC-INCEP-019).
- **Test data generation/cleanup:** scratch repos are disposable; the committed
  `doc/inception/inception-state.yaml` is instantiated per scratch project at runtime
  (this repo ships no live instance — spec §19). No fixtures committed.
- **Isolation:** manual runs use throwaway repos/directories; never run against the
  ADOS source repo itself (the source is not an incepted project).
- **No secrets:** per NFR-6, no credentials are staged in `doc/inception/inputs/` or the
  scratch repos; the trust boundary (spec §21) treats all scanned input (incl. legacy repo
  content) as untrusted.

## 7. Automation Plan and Implementation Mapping

> **Honest framing (DEC-9):** there is no CI test for the behavioral deliverable. Every
> active TC below is **Manual Only** (human-run `/bootstrap` in scratch repos + PR review).
> The CI column lists only the mechanical gates that actually exist and are unaffected by
> the deleted structure test.

| TC ID | Implementation status | Execution command | Mocking |
|-------|----------------------|-------------------|---------|
| TC-INCEP-001 | Manual Only | human-run `/bootstrap` in scratch repos (empty / existing / ambiguous) | None (live agent) |
| TC-INCEP-002 | Manual Only | human-run Phase 0 in scratch inception repo | None |
| TC-INCEP-003 | Manual Only | human-run Phase 0 over `doc/inception/inputs/` | None |
| TC-INCEP-004 | Manual Only | human-run Phase 1 (`new` flow) | None |
| TC-INCEP-005 | Manual Only | human-run Phase 1 (A: discovery present; B: none) | None |
| TC-INCEP-006 | Manual Only | human-run Phase 2 | None |
| TC-INCEP-007 | Manual Only | human-run Phase 2 → inspect registers | None |
| TC-INCEP-008 | Manual Only | human-run Phase 2 (UI / non-UI) | None |
| TC-INCEP-009 | Manual Only | human-run Phase 3 (`new` flow) | None |
| TC-INCEP-010 | Manual Only | human-run Phase 4 (UI / non-UI) | None |
| TC-INCEP-011 | Manual Only | human-run Phase 4 (`new` flow) | None |
| TC-INCEP-012 | Manual Only | human-run full inception (gates + reopen + out-of-allowlist write) | None |
| TC-INCEP-013 | Manual Only | human-run re-invoke → resume smoke | None |
| TC-INCEP-014 | Manual Only | human-run per-phase pre-gate observation | None |
| TC-INCEP-015 | Manual Only | human-run + spot-check vs `doc/guides/project-inception.md` | None |
| TC-INCEP-016 | Manual Only | human-run Phase 5 in scratch repo → inspect `.ai/agent/` | None |
| TC-INCEP-017 | Manual Only | human-run Phase 0 in existing-repo scratch (`legacy`) | None |
| TC-INCEP-018 | Manual Only | human-run Phase 1 (`legacy`) → north star + feature-spec seeds | None |
| TC-INCEP-019 | Manual Only | human-run Phase 2 (`legacy`) → milestone scope + graduation | None |
| TC-INCEP-020 | Manual Only | human-run Phase 3 (`legacy`) → reconstruction + flagged uncertainty | None |
| TC-INCEP-021 | Manual Only | human-run Phase 4 (`legacy`) → conventions audit | None |
| TC-INCEP-022 | Manual Only | PR-review (agent diff) + human-run both flows; assert no legacy flow/state file | None |
| TC-RESUME-001 | Manual Only | 2-session `/bootstrap` simulation | Simulated compaction |
| TC-RESUME-002 | Manual Only (Unblocked — DEC-6) | partial / abandoned / malformed-state re-invoke | None |
| TC-STRUCT-001…012 | **SUPERSEDED (DEC-9)** | — | — |
| TC-INFRA-001 | **SUPERSEDED (DEC-9)** | — | — |
| TC-LEGACY-001/002 | **SUPERSEDED (DEC-8 / AC16)** | — | — |

### CI gate list (run before merge)

> Only **mechanical** gates remain. None assert bootstrapper behavior; all behavioral AC
> are the manual matrix + PR review.

1. `git diff --check` — whitespace/conflict-marker guard (testing-strategy "Static/diff checks").
2. `bash scripts/.tests/test-build-claude-plugin.sh` — Claude-plugin freshness (RSK-7);
   plus `git diff --exit-code -- .ados-claude/` after `scripts/build-claude-plugin.sh`
   (source + generated committed together — `AGENTS.md` "Multi-tool support").
3. `bash scripts/.tests/test-doc-distribution.sh` — doc-distribution marker; **only if** a
   redistributable doc (incl. `doc/guides/project-inception.md`) is amended by this change.
   If no redistributable doc is touched, this gate is N/A.
4. `bash scripts/.tests/test-inception-doc-consistency.sh` — inception templates /
   `project-inception.md` four-risk-terminology + conditional-matrix consistency
   regression (this change co-maintains the inception surface; run as regression).
5. `bash scripts/.tests/test-install.sh` and `bash scripts/.tests/test-uninstall.sh` — run
   **only if** the install set/manifest changes. This change does not add
   `code-review-instructions.md` to `install.sh` (it is generated at runtime by the
   agent), so likely N/A; run only if the manifest is touched.

> **REMOVED from the CI gate list:** `scripts/.tests/test-bootstrapper-prompt-structure.sh`
> — **deleted per DEC-9**. It is no longer a deliverable and must not be referenced as a
> current/required gate.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk (testing-side) | Mitigation |
|---------------------|------------|
| Behavioral AC cannot be asserted in CI (RSK-2) | **Stated honestly:** the ONLY coverage is the manual `TC-INCEP-*` matrix + PR review. There is no CI structure test (DEC-9). This plan never claims a behavioral AC is CI-testable; §7's CI gates are purely mechanical. |
| No CI guard for prompt structure (RSK-6) | **TDR-0001 is the structure authority.** Structural correctness (allowlist, four instruction-file references, well-formed tags, anti-sycophancy placement, secrets prohibition) is verified by **PR review** against TDR-0001, not a brittle CI grep. Behavioral correctness is the manual matrix. The DEC-9 trade-off is accepted: lose false confidence, gain honesty. |
| Static-free prompt could still misbehave | The manual matrix is the authoritative behavioral evidence; PR review catches structural drift. With no frozen legacy blocks, the highest-probability regression (structural) is a human-judgment call at review. |
| Prompt bloat (RSK-1) — no CI size guardrail | DEC-9 retired the proposed size guardrail with the structure test. Bloat is judged by a human at PR review against TDR-0001's inline-vs-referenced boundary (operational skeleton inline; substantive detail referenced). Flag at review if the file grows without bound. |
| Resume edge (OQ-3) — resolved | OQ-3 **Resolved → DEC-6**; TC-RESUME-002 has concrete pass criteria (partial→`project.flow`-driven resume; abandoned→archived to `doc/inception/abandoned-<ISO>.yaml`; malformed→warn + offer repair/archive-and-restart). |
| Manual-only coverage is skipped at merge | The §10 Test Execution Log must be filled (at least the critical-priority TCs: 001, 007, 012, 013, 016, 022) before sign-off; PR review checklist explicitly includes the structural items the deleted test used to assert. |

### 8.2 Assumptions

- GH-69 deliverables (guide, `doc/inception/` skeleton, `inception-state-template.yaml`,
  17 templates, `code-review-instructions--example.md` blueprint) are present and stable
  (spec §12, verified at authoring time).
- The unified workflow is the SOLE bootstrapper process; no parallel legacy flow exists
  (DEC-8). Editing the agent prompt is delegated to `@toolsmith` (spec DEC-4; AGENTS.md
  "Extending the system").
- Manual verification is executed by a human who attends each gate (spec §12); the agent
  does not auto-advance.
- The four-risk values are fixed: Value, Usability, Feasibility, Viability (spec §12).
- TDR-0001 is the authoritative prompt-structure decision and is reviewed at PR time.

### 8.3 Open Questions

| OQ | Question | Blocking? | Owner |
|----|----------|-----------|-------|
| OQ-1 | Prompt section structure for the unified workflow (one `<inception_workflow>` with 8 phase sections)? | **Resolved → DEC-7 / TDR-0001**, superseded in framing by DEC-8. Non-blocking for tests: tests target behavior, not the internal structure choice. | `@decision-advisor` |
| OQ-2 | Bar for amending `doc/guides/project-inception.md` vs recording a deferred item? | **Resolved → DEC-5** (amend only on concrete AND blocking gaps). Non-blocking; governs whether CI gate #3 (`test-doc-distribution.sh`) runs. | `@decision-advisor` |
| OQ-3 | Mode selection/resume when a partial `doc/inception/inception-state.yaml` exists from an abandoned run? | **Resolved → DEC-6.** No longer blocking. TC-RESUME-002 has concrete pass criteria. | `@decision-advisor` |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-27 | Juliusz Ćwiąkalski | Initial test plan. Layered strategy (static CI checks + manual behavioral matrix + regression); full AC1–AC17 + NFR1–7 + F1–16 + DM1–4 + RSK1–7 traceability; TC-INFRA-001 proposed. |
| 1.1 | 2026-06-27 | Juliusz Ćwiąkalski | Red-team pre-delivery remediation. REM-2/RT1-01: TC-STRUCT-003 → two-tier parity. REM-5/RT1-04: TC-STRUCT-001 adds profile + abandoned paths. REM-6/RT1-03: +TC-INCEP-016 (behavioral AC15). REM-7/RT1-05: TC-RESUME-002 unblocked vs DEC-6. REM-4/RT1-07: TC-INFRA-001 prompt-size guardrail. REM-8/RT1-09: TC-STRUCT-008 anchor-based anti-sycophancy. RT1-08/RT1-12 corrections. |
| 1.2 | 2026-06-27 | Juliusz Ćwiąkalski | **Amendment (REM-9/REM-10; spec revised DEC-8/DEC-9).** Reflects the unified single-process redesign and the deletion of the structure test. (1) SUPERSEDED the entire Layer-1 structure-test layer — TC-STRUCT-001…012 + TC-INFRA-001 (DEC-9: structure test deleted; hardcoded prompt wording, false confidence; TDR-0001 is the structure authority). (2) SUPERSEDED the legacy-parity tests — TC-STRUCT-003 (two-tier parity), TC-LEGACY-001, TC-LEGACY-002 (DEC-8: no legacy 6-phase flow remains; AC16 superseded; its intent carried by AC23). (3) Made the manual TC-INCEP-* matrix the PRIMARY (and only automated-adjacent) coverage layer; added TC-INCEP-017…021 for the legacy front-half (AC18 repo ingestion P0; AC19 behavioral-spec extraction P1; AC20 next-milestone scope + graduation P2; AC21 architecture reconstruction + uncertainty flagging P3; AC22 conventions audit P4) and TC-INCEP-022 for AC23 (unified-process invariant). Updated TC-INCEP-001 so `legacy` = unified-flow front-half (not a separate 6-phase flow); kept TC-INCEP-016 as the substantive AC15 behavioral assertion. (4) Rewrote the testing-reality note (RSK-2): no CI-executable structure test (DEC-9); single automated-adjacent layer = manual matrix + PR review; CI only covers plugin freshness, doc-distribution marker, existing repo suites. (5) Updated §7 CI gate list — removed the deleted structure test; kept test-build-claude-plugin.sh, test-doc-distribution.sh (conditional), test-inception-doc-consistency.sh. (6) Retired RSK-4 (superseded — single state file). Full AC1, AC2, AC3, AC4–AC15, AC17, AC18–AC23 → ≥1 manual TC; AC16 → SUPERSEDED. version_impact → major. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(not yet executed — plan proposed; coverage is manual matrix + PR review per DEC-9)_ | | | |
