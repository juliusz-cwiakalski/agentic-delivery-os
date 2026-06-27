---
id: chg-GH-71-test-plan
status: Updated
created: 2026-06-27
last_updated: 2026-06-27
owners: ["Juliusz Ćwiąkalski"]
service: bootstrapper-agent
labels: ["inception", "bootstrapper", "agent"]
version_impact: minor
summary: "Layered test plan for the @bootstrapper new-project inception mode (GH-71). Honest about the testing reality: the product is an LLM agent prompt, so behavioral AC are verified by a manual matrix + regression scenarios, while structural prompt invariants are enforced by static/CI checks."
links:
  change_spec: ./chg-GH-71-spec.md
  implementation_plan: ./chg-GH-71-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - [inception:2] Iterative phased inception workflow for @bootstrapper — new-project mode

## 1. Scope and Objectives

GH-71 extends `.opencode/agent/bootstrapper.md` with a new-project inception sub-mode
(`mode: new`) implementing the 8-phase workflow from `doc/guides/project-inception.md`,
plus repo-persistent committed state, per-phase human gates, conditional artifacts,
embedded anti-sycophancy, and Phase-5 generation of all four `.ai/agent/*-instructions.md`
files. The legacy existing-project 6-phase flow must remain behaviorally identical.

**Core behavior to protect:**

1. Legacy-mode parity — editing the agent MUST NOT regress the existing 6-phase flow,
   its git-ignored state schema, or its resume behavior (AC16, NFR-4, RSK-6).
2. Prompt structural invariants — the agent file is the product; the new sub-mode must
   add the right allowlist entries, reference (not duplicate) the guide, and keep
   well-formed XML-ish section tags (AC13 path, AC15, AC17, NFR-3, NFR-5).
3. Behavioral agent capabilities — the 8-phase flow, characteristics detection, gates,
   registers, and resume — verified manually because an LLM agent cannot be executed
   deterministically in CI (RSK-2).

**Testing reality (governs the whole plan):** the artifact under test is an agent
**prompt**, not runnable code. Per the repo testing strategy (`.ai/rules/testing-strategy.md`,
"Module-to-test mapping": `doc/**` and agent definitions → static/diff + content checks;
fallback rule: docs/prompt-only changes → automated tests N/A, require manual
verification + `git diff --check`). Therefore this plan uses **three explicit layers**:

- **Layer 1 — Static / structural checks** (CI-automatable): assert the prompt FILE has
  the required structure, not that the agent behaves.
- **Layer 2 — Manual verification matrix** (human-executed): the honest way to "test"
  behavioral agent-capability AC.
- **Layer 3 — Regression / integration** (human-executed end-to-end runs): legacy
  parity and cross-session resume.

### 1.1 In Scope

- Static structural assertions on `.opencode/agent/bootstrapper.md` (allowlist, four
  instruction files, legacy anchors, guide reference, well-formedness, anti-sycophancy
  placement).
- CI gate list: `git diff --check`, Claude-plugin staleness, doc-distribution guard,
  inception doc-consistency regression.
- Manual behavioral matrix for AC1–AC15 + AC17 (AC15 gains behavioral coverage via
  TC-INCEP-016).
- Legacy end-to-end regression (AC16, NFR-4) and 2-session resume regression (AC13, NFR-2).
- Proposed (flagged, not implemented here) test-infra: a bundled
  `scripts/.tests/test-bootstrapper-prompt-structure.sh`.

### 1.2 Out of Scope & Known Gaps

- Executing the LLM agent in CI — impossible; no behavioral AC is claimed as CI-testable.
- GH-72 (inception:3 legacy deepening), GH-68 (layered tech planning), GH-70 (capstone
  self-hosting) — out of scope per spec §4.2.
- Authoring or editing inception templates — all shipped in GH-69.
- Running user research / experiments — inception captures outputs, does not run them.
- Runtime telemetry — N/A (spec §10): agents have no runtime telemetry; observability
  is the committed `doc/inception/inception-state.yaml`.

## 2. References

| Ref | Path |
|-----|------|
| Change spec (primary traceability source) | `./chg-GH-71-spec.md` |
| Implementation plan | `./chg-GH-71-plan.md` (if present) |
| File under test (OpenCode source) | `.opencode/agent/bootstrapper.md` |
| Generated plugin counterpart | `.ados-claude/agents/bootstrapper.md` |
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

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (Given/When/Then) | TC ID(s) | Status |
|-------|-------------------------------|----------|--------|
| AC1 | Empty repo/greenfield → `mode: new` + 8-phase flow; existing → legacy | TC-STRUCT-005, TC-INCEP-001 | Covered |
| AC2 | Phase 0 detects 4 characteristics & activates exactly matching artifacts | TC-STRUCT-009, TC-INCEP-002 | Covered |
| AC3 | Phase 0 produces material inventory mapping inputs→phases+key elements | TC-STRUCT-010, TC-INCEP-003 | Covered |
| AC4 | North star carries strategic pyramid, measurable outcome, NSM, JTBD users | TC-INCEP-004 | Covered |
| AC5 | Conditional OST/PRD when discovery materials present; skipped otherwise | TC-INCEP-005 | Covered |
| AC6 | Each roadmap milestone has outcome-based metrics + validation approach | TC-INCEP-006 | Covered |
| AC7 | Assumption + risk registers tagged by four-risk framework | TC-STRUCT-011, TC-INCEP-007 | Covered |
| AC8 | UI-bearing → journeys + screen inventory; non-UI → skipped | TC-INCEP-008 | Covered |
| AC9 | Phase 3 → 10-attribute FSE audit + four-risk check on architecture | TC-INCEP-009 | Covered |
| AC10 | UI-bearing → Phase 4 UX guidance; non-UI → skipped | TC-INCEP-010 | Covered |
| AC11 | Code project → Phase 4 testing strategy + CI baseline + dev-env docs | TC-INCEP-011 | Covered |
| AC12 | No phase 0–7 advances without human approval; Phase 6 may reopen 1–4 | TC-INCEP-012 | Covered |
| AC13 | Fresh session reads `doc/inception/inception-state.yaml`, resumes at last incomplete phase | TC-STRUCT-001, TC-INCEP-013, TC-RESUME-001, TC-RESUME-002 | Covered |
| AC14 | Anti-sycophancy techniques in correct phases; none in 0/5/6/7 | TC-STRUCT-008, TC-INCEP-014 | Covered |
| AC15 | Phase 5 generates all four `.ai/agent/*-instructions.md` (pm, pr, decision, code-review) | TC-STRUCT-001, TC-STRUCT-002, TC-INCEP-016 | Covered |
| AC16 | Legacy 6-phase flow + git-ignored state behave exactly as before | TC-STRUCT-003, TC-LEGACY-001, TC-LEGACY-002 | Covered |
| AC17 | Inception sub-mode references the guide, does not recreate it | TC-STRUCT-004, TC-INCEP-015 | Covered |

| F ID | Capability | TC ID(s) |
|------|-----------|----------|
| F-1 | New-project mode selection | TC-INCEP-001, TC-STRUCT-005 |
| F-2 | Characteristics detection & conditional activation | TC-INCEP-002, TC-STRUCT-009 |
| F-3 | Material inventory from staged inputs | TC-INCEP-003, TC-STRUCT-010 |
| F-4 | Enriched north star | TC-INCEP-004 |
| F-5 | Conditional discovery artifacts | TC-INCEP-005 |
| F-6 | Enriched roadmap with validation | TC-INCEP-006 |
| F-7 | Assumption & risk registers (four-risk tagged) | TC-INCEP-007, TC-STRUCT-011 |
| F-8 | Conditional UX artifacts | TC-INCEP-008 |
| F-9 | FSE audit & four-risk check (Phase 3) | TC-INCEP-009 |
| F-10 | Conditional UX guidance (Phase 4) | TC-INCEP-010 |
| F-11 | Code-project quality baseline | TC-INCEP-011 |
| F-12 | Per-phase human gates | TC-INCEP-012 |
| F-13 | Repo-persistent state & resume | TC-INCEP-013, TC-RESUME-001, TC-RESUME-002 |
| F-14 | Embedded anti-sycophancy | TC-STRUCT-008, TC-INCEP-014 |
| F-15 | All-four instruction-file generation | TC-STRUCT-001, TC-STRUCT-002, TC-INCEP-016 |
| F-16 | Legacy-mode preservation | TC-STRUCT-003, TC-LEGACY-001, TC-LEGACY-002 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (spec §8.1 N/A), no events (spec §8.2 N/A), no new external integrations
(spec §8.4 N/A). Data-model coverage:

| DM ID | Element | TC ID(s) |
|-------|---------|----------|
| DM-1 | `doc/inception/inception-state.yaml` committed state schema | TC-STRUCT-011, TC-INCEP-013, TC-RESUME-001 |
| DM-2 | `project.flow` + four `characteristics` booleans drive conditional artifacts | TC-INCEP-002, TC-STRUCT-009 |
| DM-3 | `assumptions[]` carry `risk_type` + `validation_status` (four-risk tags) | TC-INCEP-007, TC-STRUCT-011 |
| DM-4 | Mode concept (`new` vs `legacy`); legacy uses unchanged git-ignored schema | TC-INCEP-001, TC-STRUCT-003 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Notes |
|--------|-------------|----------|-------|
| NFR-1 | Mode-selection determinism (0 silent guesses; ambiguous → asks) | TC-INCEP-001 | Behavioral; structural decision-tree anchor is a bonus in TC-STRUCT-009 |
| NFR-2 | Resume correctness — last incomplete phase from state file alone | TC-INCEP-013, TC-RESUME-001, TC-RESUME-002 | Single-file read, no in-memory reliance |
| NFR-3 | Prompt maintainability — references guide, no duplicate prose, well-formed tags | TC-STRUCT-004, TC-STRUCT-005, TC-STRUCT-007 | |
| NFR-4 | Legacy behavioral parity — byte-for-behavior equivalent | TC-STRUCT-003, TC-LEGACY-001, TC-LEGACY-002 | Legacy path + git-ignore status unchanged |
| NFR-5 | Guide/prompt consistency — 0 contradictions at delivery | TC-STRUCT-004, TC-INCEP-015 | |
| NFR-6 | State-file never contains secrets | TC-STRUCT-012, TC-INCEP-013 | Prohibition language preserved + behavioral scan |
| NFR-7 | Write-safety — writes confined to allowlist; outside → human confirm + warning | TC-STRUCT-001, TC-LEGACY-002, TC-INCEP-012 | |

Risk coverage (informational — risks are mitigated by the tests above):

| RSK ID | Risk | Covered by |
|--------|------|------------|
| RSK-1 | Prompt bloat degrades instruction-following | TC-STRUCT-004 (reference-not-duplicate), TC-INFRA-001 (prompt-size guardrail) |
| RSK-2 | Most AC behavioral, untestable in CI | Layered strategy itself (§4, §8.1) |
| RSK-3 | Mode-selection ambiguity → wrong routing | TC-INCEP-001 (ambiguous → asks) |
| RSK-4 | Two state files confuse the agent | TC-STRUCT-011, TC-INCEP-013 |
| RSK-5 | Guide/prompt drift | TC-STRUCT-004, TC-STRUCT-007, TC-INCEP-015 |
| RSK-6 | Editing agent regresses legacy flow | TC-STRUCT-003, TC-LEGACY-001, TC-LEGACY-002 |
| RSK-7 | Generated plugin goes stale | TC-STRUCT-006 |

## 4. Test Types and Layers

This is a prompt/doc-only change. Per `.ai/rules/testing-strategy.md`, applicable
layers are **static/diff checks** + **content checks** + **manual verification**;
automated shell tests apply only where a `scripts/.tests/test-*.sh` exists or is proposed.

- **Layer 1 — Static / structural checks** (CI-automatable): `grep`/diff assertions on
  `.opencode/agent/bootstrapper.md` and CI guard scripts. Target: CI. Most are one-shot
  `bash` snippets; TC-INFRA-001 proposes bundling them into a committed test.
- **Layer 2 — Manual verification matrix** (human-executed): one row per behavioral AC
  (AC1–AC15, AC17). Target: a human running `@bootstrapper` / `/bootstrap` in scratch
  repos. Framework: none (LLM agent); evidence = captured session transcript + observed
  artifacts + filled pass/fail.
- **Layer 3 — Regression / integration** (human-executed, end-to-end): legacy-flow
  parity run in an existing-repo scratch project, and a 2-session resume simulation.
  Target: human in scratch repos.

No unit/integration/E2E framework applies (no runnable application code).

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Layer | Priority | AC / NFR / DM Coverage |
|-------|-------|------|-------|----------|------------------------|
| TC-STRUCT-001 | Write-allowlist has inception + code-review paths | Static | 1 | High | AC13(path), AC15(path), F-13, F-15, NFR-7 |
| TC-STRUCT-002 | Phase 5 references all four instruction files | Static | 1 | High | AC15, F-15, DM-4 |
| TC-STRUCT-003 | Legacy section anchors intact (parity) | Regression (static) | 1 | High | AC16, F-16, NFR-4, DM-4, RSK-6 |
| TC-STRUCT-004 | Guide referenced, not recreated | Static | 1 | High | AC17, F-1, NFR-3, NFR-5, RSK-1, RSK-5 |
| TC-STRUCT-005 | Prompt XML-ish tags well-formed | Static | 1 | High | AC1, NFR-3 |
| TC-STRUCT-006 | Plugin regeneration staleness gate | Static | 1 | High | RSK-7 |
| TC-STRUCT-007 | Doc-distribution marker on amended guide | Static | 1 | Medium | NFR-3, NFR-5, RSK-5 |
| TC-STRUCT-008 | Anti-sycophancy placement (per-phase anchors) | Static | 1 | High | AC14, F-14 |
| TC-STRUCT-009 | Phase 0 characteristics detection section present | Static | 1 | Medium | AC2, F-2, DM-2, NFR-1 |
| TC-STRUCT-010 | Phase 0 material-inventory step present | Static | 1 | Medium | AC3, F-3 |
| TC-STRUCT-011 | Committed state + four-risk tags + per-mode state rule | Static | 1 | Medium | AC7, AC13, F-7, F-13, DM-1, DM-3, NFR-2, RSK-4 |
| TC-STRUCT-012 | Secrets-prohibition language preserved for inception state | Static | 1 | Medium | NFR-6 |
| TC-INCEP-001 | Mode selection: new vs legacy vs ambiguous | Manual | 2 | High | AC1, F-1, DM-4, NFR-1, RSK-3 |
| TC-INCEP-002 | Characteristics detection & conditional activation | Manual | 2 | High | AC2, F-2, DM-2 |
| TC-INCEP-003 | Material inventory from staged inputs | Manual | 2 | High | AC3, F-3 |
| TC-INCEP-004 | Enriched north star content | Manual | 2 | High | AC4, F-4 |
| TC-INCEP-005 | Conditional OST/PRD generation & skip | Manual | 2 | Medium | AC5, F-5 |
| TC-INCEP-006 | Roadmap milestones with validation | Manual | 2 | Medium | AC6, F-6 |
| TC-INCEP-007 | Four-risk-tagged registers | Manual | 2 | High | AC7, F-7, DM-3 |
| TC-INCEP-008 | Conditional UX artifacts (journeys + screens) | Manual | 2 | Medium | AC8, F-8 |
| TC-INCEP-009 | Phase 3 FSE audit + four-risk architecture check | Manual | 2 | High | AC9, F-9 |
| TC-INCEP-010 | Conditional Phase-4 UX guidance | Manual | 2 | Medium | AC10, F-10 |
| TC-INCEP-011 | Code-project quality baseline | Manual | 2 | Medium | AC11, F-11 |
| TC-INCEP-012 | Per-phase gates + Phase-6 reopen | Manual | 2 | High | AC12, F-12, NFR-7 |
| TC-INCEP-013 | Resume smoke (re-invoke → resumes at last phase) | Manual | 2 | High | AC13, F-13, DM-1, NFR-2, NFR-6 |
| TC-INCEP-014 | Anti-sycophancy behavioral run (per phase) | Manual | 2 | High | AC14, F-14 |
| TC-INCEP-015 | Guide referenced at runtime, not duplicated | Manual | 2 | Medium | AC17, F-1, NFR-5 |
| TC-INCEP-016 | Phase 5 writes all four instruction files (incl. code-review) | Manual | 2 | High | AC15, F-15, DM-4 |
| TC-LEGACY-001 | Legacy flow end-to-end in existing-repo scratch | Regression | 3 | High | AC16, F-16, NFR-4, RSK-6 |
| TC-LEGACY-002 | Legacy write-allowlist unchanged (no inception leak) | Regression | 3 | High | AC16, NFR-4, NFR-7 |
| TC-RESUME-001 | 2-session inception resume simulation | Regression | 3 | High | AC13, F-13, DM-1, NFR-2, RSK-4 |
| TC-RESUME-002 | Resume edge: partial/abandoned/malformed state (DEC-6) | Corner Case | 3 | Medium | AC13, NFR-2, DEC-6 |
| TC-INFRA-001 | (PROPOSED) Bundled prompt-structure test + prompt-size guardrail | Test-infra | — | Medium | TC-STRUCT-001…005, 008, 009, 010, 011, 012, RSK-1 (bundling + size guardrail) |

### 5.2 Scenario Details

---

#### TC-STRUCT-001 - Write-allowlist has inception + code-review paths

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC13 (path), AC15 (path allowlist), F-13, F-15, NFR-7
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md` → `<write_allowlist>`
**Tags**: @agent, @prompt, @ci

**Preconditions**:
- `.opencode/agent/bootstrapper.md` exists on the branch.

**Steps**:
1. Assert the `<write_allowlist>` block contains an entry matching `doc/inception/**`.
2. Assert it contains an entry for `.ai/agent/code-review-instructions.md`.
3. Assert it contains an entry covering `doc/inception/abandoned-*.yaml` (DEC-6 archive
   target — either via the `doc/inception/**` glob or an explicit entry).
4. Assert it contains an entry for `doc/documentation-profile.md` (set by Phase 5 —
   spec F-15 / DEC-3).

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
grep -Eq 'doc/inception/\*\*' "$f"                              # inception workspace
grep -Eq '\.ai/agent/code-review-instructions\.md' "$f"          # AC15 net-new file
grep -Eq 'doc/inception/abandoned-[A-Za-z0-9_*-]*\.ya?ml' "$f"   # DEC-6 archive target
grep -Eq 'doc/documentation-profile\.md' "$f"                    # Phase-5 profile write
```

**Expected Outcome**:
- All four patterns match; exit 0. The legacy allowlist entries are also still present
  (cross-checked by TC-STRUCT-003, which asserts each legacy `<write_allowlist>` entry is
  preserved verbatim).

---

#### TC-STRUCT-002 - Phase 5 references all four instruction files

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC15, F-15, DM-4
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md` → inception Phase 5 section
**Tags**: @agent, @prompt, @ci

**Preconditions**:
- The inception Phase 5 section exists in the agent file.

**Steps**:
1. In the inception Phase 5 region of the agent file, assert references to all four
   instruction files appear together:
   - `.ai/agent/pm-instructions.md`
   - `.ai/agent/pr-instructions.md`
   - `.ai/agent/decision-instructions.md`
   - `.ai/agent/code-review-instructions.md` (the GH-32 gap closure)

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
for name in pm pr decision code-review; do
  grep -Eq "\.ai/agent/${name}-instructions\.md" "$f" \
    || { echo "missing ${name}-instructions reference"; exit 1; }
done
```
(Refinement: scope the search to the inception/Phase-5 region once the section anchor
is known — see TC-INFRA-001.)

**Expected Outcome**:
- All four references present; `code-review-instructions` is NOT absent (the historical gap).

---

#### TC-STRUCT-003 - Legacy section anchors intact (parity)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC16, F-16, NFR-4, DM-4, RSK-6
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md` (legacy regions)
**Tags**: @agent, @prompt, @ci, @regression

**Preconditions**:
- The pre-change baseline of `.opencode/agent/bootstrapper.md` is reachable at commit
  `0a1a288` (the branch merge-base / last commit before this change; overridable via an
  env var in TC-INFRA-001).

**Parity method — two tiers (corrected by REM-2 / RT1-01):** inception legitimately
EXTENDS two shared blocks (`<resume_behavior>`, `<write_allowlist>`) with additive
inception branches/entries. A naive whole-block region-diff on those two would
false-fail a correct implementation. Therefore parity is split into two tiers:

- **Tier A — truly-frozen legacy blocks** (whole-block region-diff MUST be byte-identical
  vs baseline `0a1a288`): `<workflow_phases>`, `<persistent_state>`,
  `<phase_1_repo_scan>`, `<phase_2_confidence>`, `<phase_3_interview>`,
  `<phase_4_draft>`, `<phase_5_review>`, `<phase_6_write>`.
  - NOTE: `<phase_4_draft>` is truly-frozen because REM-1 dropped the legacy
    code-review-addition edit; the legacy Phase-4 recommended list is NOT modified.
- **Tier B — shared blocks inception extends** (`<resume_behavior>`,
  `<write_allowlist>`): additions are permitted, but EVERY baseline legacy entry/line
  MUST still be present verbatim. Method: extract the baseline block, tokenize its
  non-empty lines, and assert each baseline line is present in the new block (substring
  match). A missing/dropped baseline line is a parity violation.

All anchors must open and close. The literal `.ai/local/bootstrapper-context.yaml` and
`schema_version: 1` must appear inside `<persistent_state>`.

**Steps**:
1. Confirm every anchor tag (both tiers) opens and closes in the file.
2. Confirm the literal `.ai/local/bootstrapper-context.yaml` and `schema_version: 1`
   appear inside `<persistent_state>`.
3. **Tier A:** region-diff each frozen block on this branch vs baseline `0a1a288`; assert
   the diff is empty (byte-identical).
4. **Tier B:** for `<resume_behavior>` and `<write_allowlist>`, extract the baseline
   block's non-empty lines and assert each is still present in the new block
   (additions permitted, removals/modifications fail).

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
baseline=0a1a288        # overridable via BOOTSTRAPPER_BASELINE_SHA in TC-INFRA-001
baseline_file=$(mktemp); git show "${baseline}:.opencode/agent/bootstrapper.md" > "$baseline_file"

# 1) All legacy anchors open AND close (both tiers).
frozen="workflow_phases persistent_state phase_1_repo_scan phase_2_confidence \
        phase_3_interview phase_4_draft phase_5_review phase_6_write"
shared="resume_behavior write_allowlist"
for tag in $frozen $shared; do
  grep -Eq "<${tag}>" "$f" && grep -Eq "</${tag}>" "$f" \
    || { echo "legacy anchor ${tag} missing/unbalanced"; exit 1; }
done

# 2) Legacy state path + schema version inside <persistent_state>.
grep -Eq '\.ai/local/bootstrapper-context\.yaml' "$f"
grep -Eq 'schema_version: 1' "$f"

# Helper: extract a <tag>...</tag> block from a file (skips fenced code blocks).
extract_block() { awk '/^```/{c=!c;next} !c && /<'"$1"'>/{f=1} f{print} /<\/'"$1"'>/{f=0}' "$2"; }

# 3) Tier A — frozen blocks must be byte-identical vs baseline.
for tag in $frozen; do
  diff <(extract_block "$tag" "$f") <(extract_block "$tag" "$baseline_file") >/dev/null \
    || { echo "Tier A frozen block <${tag}> drifted vs ${baseline}"; exit 1; }
done

# 4) Tier B — shared blocks: every baseline non-empty line still present verbatim.
for tag in $shared; do
  new_block=$(extract_block "$tag" "$f")
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    printf '%s\n' "$new_block" | grep -qF -- "$line" \
      || { echo "Tier B shared block <${tag}> dropped baseline line: $line"; exit 1; }
  done < <(extract_block "$tag" "$baseline_file")
done
rm -f "$baseline_file"
echo "legacy parity OK (Tier A frozen + Tier B shared-line-preserved)"
```

**Expected Outcome**:
- All anchors present and balanced.
- Tier A frozen blocks byte-identical to baseline `0a1a288`.
- Tier B shared blocks (`<resume_behavior>`, `<write_allowlist>`) preserve every baseline
  line verbatim (inception additions allowed); no baseline entry dropped.
- Legacy state path + schema version unchanged.

**Notes**:
- This is the primary automated guard for NFR-4 / RSK-6. The behavioral complement is
  TC-LEGACY-001.
- The two-tier split is the REM-2/RT1-01 correction: whole-block parity on the eight
  frozen blocks + line-preservation on the two inception-extended blocks, so an additive
  (correct) implementation is not false-failed.

---

#### TC-STRUCT-004 - Guide referenced, not recreated

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC17, F-1, NFR-3, NFR-5, RSK-1, RSK-5
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md` (inception section)
**Tags**: @agent, @prompt, @ci

**Preconditions**:
- `doc/guides/project-inception.md` exists (GH-69).

**Steps**:
1. Assert the agent file references `doc/guides/project-inception.md`.
2. Assert the agent file does NOT recreate the guide's phase prose (i.e., it does not
   inline large verbatim copies of the guide's `### Phase 0 —` … `### Phase 7 —`
   headings or the full conditional-artifacts matrix). Acceptable: short pointers
   ("see Phase N of the guide") and the agent-specific decision points.

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
guide=doc/guides/project-inception.md
grep -Eq 'doc/guides/project-inception\.md' "$f"   # guide referenced

# Non-duplication heuristic (RT1-08, option a): line-overlap between each guide
# "### Phase N" block and the prompt's <phase_N_inception> block. The full-line
# heading-match in v1 was near-vacuous (the prompt must not repeat the guide's
# heading line). Instead, measure how many guide-block lines recur verbatim in the
# matching prompt section and fail if the overlap exceeds a threshold — a signal of
# guide prose being inlined rather than referenced.
max_overlap=0.30      # tunable: fraction of guide-block lines allowed to recur; default 30%
extract_phase() { awk -v n="$1" '$0 ~ "^### Phase "n" "(off=1) off{print} /^### Phase [0-7]/ && $0 !~ "^### Phase "n" "{off=0}' "$2"; }
extract_tag()   { awk '/^```/{c=!c;next} !c && /<'"$1"'>/{f=1} f{print} /<\/'"$1"'>/{f=0}' "$2"; }
for n in 1 2 3 4 5 6 7; do
  guide_block=$(extract_phase "$n" "$guide")
  [ -z "$guide_block" ] && continue
  prompt_block=$(extract_tag "phase_${n}_inception" "$f")
  total=$(printf '%s\n' "$guide_block" | grep -c .)
  hits=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    printf '%s\n' "$prompt_block" | grep -qF -- "$line" && hits=$((hits+1))
  done <<< "$guide_block"
  [ "$total" -gt 0 ] || continue
  ratio=$(awk -v h="$hits" -v t="$total" 'BEGIN{printf "%.3f", h/t}')
  awk -v r="$ratio" -v m="$max_overlap" -v n="$n" 'BEGIN{exit !(r>m)}' \
    && { echo "guide↔prompt overlap for Phase ${n} too high: ${ratio} > ${max_overlap} (duplication suspected)"; exit 1; }
done
```

**Expected Outcome**:
- Guide reference present; per-phase guide↔prompt line-overlap stays under the tunable
  threshold (default 30%), i.e., the prompt does not inline guide prose block-for-block.
- The threshold is a heuristic, not a hard guarantee; the authoritative "0 contradictions"
  judgment is the manual TC-INCEP-015.

**Notes**:
- v1's full-line heading-match (`grep -Fcx "$h"`) only caught an exact duplicated heading
  line — near-vacuous confidence. This overlap check (RT1-08 option a) is stronger and
  still CI-safe; if real-wording variance makes it noisy, fall back to manual TC-INCEP-015
  (RT1-08 option b) rather than silently weakening the claim.

---

#### TC-STRUCT-005 - Prompt XML-ish tags well-formed

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC1, NFR-3
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md`
**Tags**: @agent, @prompt, @ci

**Preconditions**:
- Agent file edited by this change.

**Steps**:
1. For every `<tag>` the agent file opens, confirm a matching `</tag>` closes (no
   unmatched tags introduced by the edit).
2. Confirm no stray `<` / `>` that would break the section structure (e.g., a `<`
   not part of a tag or inline code).

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
# Collect opening vs closing tags (ignore code spans naively):
opens=$(grep -oE '<[a-z_0-9]+>' "$f" | sort | uniq -c)
closes=$(grep -oE '</[a-z_0-9]+>' "$f" | sort | uniq -c)
# Every opening count must equal its closing count.
diff <(echo "$opens" | sed -E 's#<([a-z_0-9]+)>#\1#') \
     <(echo "$closes" | sed -E 's#</([a-z_0-9]+)>#\1#') \
  || { echo "unbalanced section tags"; exit 1; }
```

**Expected Outcome**:
- Opening and closing tag multiset balanced.

**Notes**:
- A stricter implementation should skip fenced code blocks and inline backticks;
  flagged for TC-INFRA-001 refinement.

---

#### TC-STRUCT-006 - Plugin regeneration staleness gate

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: RSK-7
**Test Type(s)**: Contract / Static
**Automation Level**: Automated
**Target Layer / Location**: `scripts/build-claude-plugin.sh`, `.ados-claude/agents/bootstrapper.md`
**Tags**: @ci, @plugin

**Preconditions**:
- Source agent edited and committed on the branch.

**Steps**:
1. Run `bash scripts/build-claude-plugin.sh`.
2. Assert no diff vs the committed generated counterpart.

**HOW (automation)**:
```bash
bash scripts/build-claude-plugin.sh
git diff --exit-code -- .ados-claude/agents/bootstrapper.md
# CI wrapper equivalent:
bash scripts/.tests/test-build-claude-plugin.sh
```

**Expected Outcome**:
- `git diff --exit-code` passes (no staleness); the test wrapper exits 0.

**Notes**:
- Per `AGENTS.md` "Multi-tool support": source + generated must be committed together;
  CI already enforces freshness. This gate is included here for explicit traceability.

---

#### TC-STRUCT-007 - Doc-distribution marker on amended guide

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: NFR-3, NFR-5, RSK-5
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `doc/guides/project-inception.md` (only if amended)
**Tags**: @ci, @docs

**Preconditions**:
- This change amends `doc/guides/project-inception.md` ONLY if a concrete gap is proven
  (spec NG-5, OQ-2). If the guide is untouched, this TC is N/A (skip).

**Steps**:
1. If the guide is amended, run the doc-distribution guard.

**HOW (automation)**:
```bash
if git diff --name-only "${baseline}..HEAD" -- doc/guides/project-inception.md | grep -q .; then
  bash scripts/.tests/test-doc-distribution.sh
  # Marker already present: ados_distribution: redistributable
  grep -Eq '^ados_distribution: redistributable$' doc/guides/project-inception.md
fi
```

**Expected Outcome**:
- Guard passes; `ados_distribution: redistributable` preserved on the guide.

---

#### TC-STRUCT-008 - Anti-sycophancy placement (per-phase anchors)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC14, F-14
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md` (per-phase sections)
**Tags**: @agent, @prompt, @ci

**Authoritative map (spec Appendix B):**
- Phase 1 → devil's advocate + four-risk awareness
- Phase 2 → pre-mortem + four-risk check
- Phase 3 → alternative comparison + pre-mortem
- Phase 4 → unknown-unknowns
- Phase 0 / 5 / 6 / 7 → none

**Steps**:
1. For each decision-dense phase (1–4), assert its `<phase_N_inception>` block contains
   an `<anti_sycophancy>` sub-tag naming the correct technique(s) per Appendix B.
2. Assert phases 0 / 5 / 6 / 7 contain NO `<anti_sycophancy>` sub-tag.

**DEPENDENCY (REM-3 / REM-8):** this check is **anchor-based**, not free-text keyword
scoping. It requires the prompt (authored by `@toolsmith`) to emit a well-defined
`<anti_sycophancy>` sub-tag (or a clearly-documented equivalent anchor) inside each
decision-dense `<phase_N_inception>` section. REM-3 / the implementation plan instructs
`@toolsmith` accordingly. If `@toolsmith` instead uses a different anchor, the snippet's
anchor name must be aligned to it — that wiring is TC-INFRA-001's job.

**HOW (automation)** — anchor-scoped, not global keyword search:
```bash
f=.opencode/agent/bootstrapper.md
extract_tag() { awk '/^```/{c=!c;next} !c && /<'"$1"'>/{f=1} f{print} /<\/'"$1"'>/{f=0}' "$2"; }
ANCHOR=anti_sycophancy   # align to @toolsmith's anchor name in TC-INFRA-001

# Decision-dense phases: <anti_sycophancy> present AND names the right technique(s).
declare -A want=( [1]='devil.?s advocate|four.?risk' [2]='pre.?mortem|four.?risk' \
                  [3]='alternative comparison|pre.?mortem' [4]='unknown.?unknowns' )
for n in 1 2 3 4; do
  block=$(extract_tag "phase_${n}_inception" "$f")
  [ -n "$block" ] || { echo "missing <phase_${n}_inception>"; exit 1; }
  printf '%s\n' "$block" | grep -Eq "<${ANCHOR}>" || { echo "P${n} missing <${ANCHOR}> tag"; exit 1; }
  printf '%s\n' "$block" | grep -Eqi "${want[$n]}" || { echo "P${n} <${ANCHOR}> missing technique (${want[$n]})"; exit 1; }
done

# Forbidden phases: NO <anti_sycophancy> tag.
for n in 0 5 6 7; do
  block=$(extract_tag "phase_${n}_inception" "$f")
  [ -z "$block" ] && continue
  printf '%s\n' "$block" | grep -Eq "<${ANCHOR}>" && { echo "P${n} must NOT contain <${ANCHOR}>"; exit 1; }
done
echo "anti-sycophancy placement OK (anchor-scoped)"
```

**Expected Outcome**:
- Phases 1–4 each carry an `<anti_sycophancy>` sub-tag naming the correct technique(s);
  phases 0/5/6/7 carry none. This is the authoritative AC14 structural check.

**Notes**:
- v1's free-text global keyword grep was brittle and false-positive-prone (a technique
  keyword could appear in a pointer/comment). The anchor-based method (REM-8/RT1-09) is
  robust once the prompt uses the `<anti_sycophancy>` anchor (REM-3 dependency above).
- The behavioral confirmation that the agent actually RUNS each technique at the right
  time is TC-INCEP-014.

---

#### TC-STRUCT-009 - Phase 0 characteristics detection section present

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC2, F-2, DM-2, NFR-1
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md` (Phase 0 / mode-selection)
**Tags**: @agent, @prompt, @ci

**Steps**:
1. Assert the four characteristic signal names appear: `ui_bearing`, `multi_user`,
   `complex_domain`, `code_project`.
2. Assert a mode-selection decision point references both `new` and `legacy` flows
   (mirrors guide Phase 0).

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
for c in ui_bearing multi_user complex_domain code_project; do
  grep -Eq "\b${c}\b" "$f" || { echo "missing characteristic ${c}"; exit 1; }
done
grep -Eqi 'mode:\s*new|flow.*new' "$f"
grep -Eqi 'mode:\s*legacy|flow.*legacy' "$f"
```

**Expected Outcome**:
- All four signals named; both modes referenced.

---

#### TC-STRUCT-010 - Phase 0 material-inventory step present

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC3, F-3
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md` (Phase 0)
**Tags**: @agent, @prompt, @ci

**Steps**:
1. Assert Phase 0 references scanning `doc/inception/inputs/` and producing a material
   inventory.

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
grep -Eq 'doc/inception/inputs/' "$f"
grep -Eqi 'material inventory' "$f"
```

**Expected Outcome**:
- Both references present.

---

#### TC-STRUCT-011 - Committed state + four-risk tags + per-mode state rule

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC7, AC13, F-7, F-13, DM-1, DM-3, NFR-2, RSK-4
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md`
**Tags**: @agent, @prompt, @ci

**Steps**:
1. Assert the agent references the committed state path `doc/inception/inception-state.yaml`.
2. Assert the four canonical risk tags appear (Value / Usability / Feasibility / Viability)
   and the wrong term `desirability` is NOT introduced.
3. Assert an explicit per-mode state rule distinguishing the committed inception state
   from the git-ignored legacy context (mitigates RSK-4).

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
grep -Eq 'doc/inception/inception-state\.yaml' "$f"
for t in Value Usability Feasibility Viability; do
  grep -Eq "\\b${t}\\b" "$f" || { echo "missing four-risk tag ${t}"; exit 1; }
done
# desirability-absent: SNIPPET-ONLY for bootstrapper.md (RT1-12). No existing script
# covers the bootstrapper four-risk vocabulary — test-inception-doc-consistency.sh
# covers templates/guide, NOT bootstrapper.md. Enforced in CI once TC-INFRA-001 ships.
! grep -Eqi 'desirability' "$f"
grep -Eq '\.ai/local/bootstrapper-context\.yaml' "$f"   # legacy path still named
```

**Expected Outcome**:
- Committed path present; all four canonical tags; no `desirability`; legacy path named.

**Notes (RT1-12)**:
- The `desirability`-absent assertion is a **runnable snippet only** until TC-INFRA-001
  ships — `scripts/.tests/test-inception-doc-consistency.sh` covers inception
  templates/`project-inception.md`, **not** `.opencode/agent/bootstrapper.md`. Do not
  credit the bootstrapper four-risk check to that script (see §7 correction).

---

#### TC-STRUCT-012 - Secrets-prohibition language preserved for inception state

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-6
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/agent/bootstrapper.md`
**Tags**: @agent, @prompt, @security, @ci

**Steps**:
1. Assert the inception state section carries a secrets-prohibition constraint
   (consistent with the existing legacy `<safety_rules>` / `<persistent_state>` language).

**HOW (automation)**:
```bash
f=.opencode/agent/bootstrapper.md
grep -Eqi 'NEVER (store|contain) secrets|must NEVER contain secrets' "$f"
```

**Expected Outcome**:
- Prohibition language present in/near the inception state section.

---

#### TC-INCEP-001 - Mode selection: new vs legacy vs ambiguous

**Scenario Type**: Happy Path / Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC1, F-1, DM-4, NFR-1, RSK-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch repos (empty + existing + ambiguous)
**Tags**: @agent, @manual

**Preconditions**:
- Three scratch repos prepared: (a) empty/git-init only; (b) greenfield with a 1-line
  idea README and no code; (c) an existing repo with source + git history.

**Steps**:
1. In (a) empty repo: invoke `/bootstrap`. Observe Phase 0 → `mode: new` → 8-phase flow.
2. In (c) existing repo: invoke `/bootstrap`. Observe `mode: legacy` → unchanged 6-phase flow.
3. In (b) ambiguous repo (idea only, no code/history): invoke `/bootstrap`. Observe the
   agent surfaces a clarifying question rather than silently guessing.

**Expected Outcome**:
- (a) routes to inception; (c) routes to legacy; (b) asks. 0 silent guesses (NFR-1).

**Pass/Fail**:
- Pass only if all three outcomes observed and no silent mis-route.

---

#### TC-INCEP-002 - Characteristics detection & conditional activation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC2, F-2, DM-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch inception repo
**Tags**: @agent, @manual

**Preconditions**:
- `mode: new` active; a UI-bearing, multi-user, complex-domain code project scenario
  described in staged inputs.

**Steps**:
1. Run Phase 0. Confirm the agent detects and records all four booleans
   (`ui_bearing`, `multi_user`, `complex_domain`, `code_project`) in state.
2. Confirm exactly the matching conditional artifacts are activated (UI →
   journeys/screens/UX guidance; multi-user → personas/JTBD; complex domain →
   ubiquitous language; code → testing/CI/dev-env).

**Expected Outcome**:
- Four signals recorded; artifact activation matches signals 1:1 (no over/under-activation).

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
  competitor note).

**Steps**:
1. Run Phase 0 to completion.
2. Inspect the produced material inventory.

**Expected Outcome**:
- Each staged input is listed, mapped to the phase it informs, with extracted key
  elements/concepts.

---

#### TC-INCEP-004 - Enriched north star content

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC4, F-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/overview/` north star artifact
**Tags**: @agent, @manual

**Preconditions**:
- Phase 0 gated; Phase 1 run.

**Steps**:
1. Complete Phase 1 (Socratic session over the inventory).
2. Inspect the drafted north star.

**Expected Outcome**:
- Contains strategic-pyramid context (mission→vision→strategy→outcome), a measurable
  outcome, the North Star Metric, and target users with JTBD.

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
- Conditional activation correct in both directions.

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
- Phase 2 reached.

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
  {Value, Usability, Feasibility, Viability} and a `validation_status`.
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
- UX artifacts present only when UI-bearing.

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
- Phase 3 reached.

**Steps**:
1. Complete Phase 3; inspect architecture + audit outputs.

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
- UX guidance present only when UI-bearing.

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
- `code_project=true`.

**Steps**:
1. Complete Phase 4; inspect quality-baseline outputs.

**Expected Outcome**:
- Testing strategy, CI baseline (lint + typecheck + test), and dev-environment docs
  (setup guide + `.env.example`) produced.

---

#### TC-INCEP-012 - Per-phase gates + Phase-6 reopen

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC12, F-12, NFR-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: full inception run
**Tags**: @agent, @manual

**Preconditions**:
- A full inception run in progress.

**Steps**:
1. At each phase boundary (0–7), attempt to advance WITHOUT giving explicit approval.
   Confirm the agent does not advance.
2. At Phase 6, engineer a gap (e.g., a missing register field) and observe FAIL → the
   agent reopens the relevant earlier phase (1–4).
3. Attempt a write outside the allowlist; confirm the agent requests explicit human
   confirmation with a warning (NFR-7).

**Expected Outcome**:
- No auto-advance; Phase 6 can reopen; out-of-allowlist writes are gated.

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
2. Confirm the agent reads ONLY `doc/inception/inception-state.yaml`, determines the
   last incomplete phase, and resumes there with prior artifacts as context.
3. Inspect the committed state for any accidental secret-like value (NFR-6).

**Expected Outcome**:
- Resume from state file alone (NFR-2); no secret-like content in state.

**Notes**:
- The rigorous cross-session + compaction variant is TC-RESUME-001 / TC-RESUME-002.

---

#### TC-INCEP-014 - Anti-sycophancy behavioral run (per phase)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC14, F-14
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: per-phase pre-gate step
**Tags**: @agent, @manual

**Preconditions**:
- A run reaching each decision-dense phase.

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
- Structural keyword placement is TC-STRUCT-008; this TC confirms the agent actually
  invokes them at runtime.

---

#### TC-INCEP-015 - Guide referenced at runtime, not duplicated

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC17, F-1, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: agent runtime + `doc/guides/project-inception.md`
**Tags**: @agent, @manual

**Preconditions**:
- Inception sub-mode active.

**Steps**:
1. When the agent needs human-readable phase detail, observe it pointing to
   `doc/guides/project-inception.md` rather than re-deriving the phase prose inline.
2. Spot-check the prompt's stated phase behavior against the guide for contradictions.

**Expected Outcome**:
- Guide is the cited authority; 0 contradictions observed (NFR-5).

---

#### TC-INCEP-016 - Phase 5 writes all four instruction files (incl. code-review)

**Scenario Type**: Happy Path / Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC15, F-15, DM-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: scratch repo `.ai/agent/*-instructions.md`
**Tags**: @agent, @manual

**Given/When/Then (AC15):** *Given* an inception run has reached Phase 5, *when* Phase 5
completes and its human gate is approved, *then* all four `.ai/agent/*-instructions.md`
files exist — pm, pr, decision, AND code-review-instructions.md.

**Preconditions**:
- A scratch inception repo with `mode: new`; phases 0–4 completed and gated.
- The GH-69 blueprint `doc/templates/blueprints/code-review-instructions--example.md`
  present (the source for the code-review file).
- (Static prerequisites already asserted by TC-STRUCT-001 allowlist +
  TC-STRUCT-002 Phase-5 references; this TC is the behavioral confirmation.)

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
- AC15 had only static coverage (TC-STRUCT-001/002) before this; TC-INCEP-016 (REM-6 /
  RT1-03) adds the Layer-2 behavioral evidence that the files are ACTUALLY written.

---

#### TC-LEGACY-001 - Legacy flow end-to-end in existing-repo scratch

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC16, F-16, NFR-4, RSK-6
**Test Type(s)**: Manual / E2E (agent)
**Automation Level**: Manual
**Target Layer / Location**: existing-repo scratch project
**Tags**: @agent, @regression, @manual

**Preconditions**:
- A scratch repo with source code + git history (simulates a pre-GH-71 adopter).

**Steps**:
1. Invoke `/bootstrap`; confirm `mode: legacy` selection.
2. Run the full legacy 6-phase flow to completion (repo scan → confidence → interview →
   draft → review → write).
3. Confirm outputs match the pre-change behavior: `AGENTS.md`, three legacy instruction
   files (pm/pr/decision), `doc/documentation-handbook.md`, optional overview/feature
   specs; state written to git-ignored `.ai/local/bootstrapper-context.yaml` with
   `schema_version: 1`.

**Parity assertions**:
- Legacy state path unchanged and still git-ignored.
- Legacy state schema unchanged (`schema_version: 1`).
- Legacy produces exactly the pre-change artifact set (no inception artifacts leak in).
- Resume from legacy state works as before.

**Expected Outcome**:
- Byte-for-behavior parity with pre-change (NFR-4).

---

#### TC-LEGACY-002 - Legacy write-allowlist unchanged (no inception leak)

**Scenario Type**: Negative / Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC16, NFR-4, NFR-7
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `<write_allowlist>` (legacy applicability)
**Tags**: @agent, @regression, @security

**Preconditions**:
- Legacy-mode run in progress.

**Steps**:
1. In legacy mode, confirm the agent only writes within the legacy allowlist entries.
2. Confirm inception-only paths (e.g., `doc/inception/**`) are not written in legacy
   mode (they are inception-mode additions).

**Expected Outcome**:
- Legacy writes confined to legacy allowlist; no inception-path writes in legacy mode.

---

#### TC-RESUME-001 - 2-session inception resume simulation

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC13, F-13, DM-1, NFR-2, RSK-4
**Test Type(s)**: Manual / Integration (agent)
**Automation Level**: Manual
**Target Layer / Location**: `doc/inception/inception-state.yaml` across 2 sessions
**Tags**: @agent, @regression, @manual

**Preconditions**:
- Fresh inception run started; Phase 0 + Gate 0 completed and committed.

**Steps**:
1. **Session 1:** complete Phase 0 + Gate 0; confirm state committed to
   `doc/inception/inception-state.yaml`.
2. **Drop the session** (simulate conversation compaction / new day): clear in-memory
   context entirely.
3. **Session 2:** re-invoke `/bootstrap`. Confirm the agent reads ONLY the committed
   state file, determines the last incomplete phase is Phase 1, restores state + prior
   artifacts as context, and resumes at Phase 1 — not at Phase 0.

**Expected Outcome**:
- Resume determinable from state alone (NFR-2); no reliance on in-memory state; correct
  phase resumed.

---

#### TC-RESUME-002 - Resume edge: partial/abandoned/malformed state (DEC-6)

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC13, NFR-2, DEC-6 (resolves OQ-3)
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/inception/inception-state.yaml`
**Tags**: @agent, @manual, @edge

**Preconditions**:
- Three scratch repos with edge-case inception state, per DEC-6:
  - (A) a **partial but valid** `doc/inception/inception-state.yaml` left by an
    interrupted run (mid-phase, `project.flow: new`, schema valid).
  - (B) a state file representing an **abandoned** run the human decides to discard.
  - (C) a **malformed / `schema_version`-mismatched** state file.

**Steps (per sub-case; pass/fail recorded for each):**
1. **(A) Partial valid state:** re-invoke `/bootstrap`. Observe the agent reads
   `project.flow` as the resume source of truth and resumes at the flow's last
   incomplete phase — **no repo-shape re-derivation**, no re-running Phase 0 mode
   detection.
2. **(B) Abandoned run:** re-invoke `/bootstrap`; choose the archive-and-restart path.
   Observe the prior state is **archived to `doc/inception/abandoned-<ISO>.yaml`** and
   NOT silently overwritten or deleted; a fresh inception run then begins.
3. **(C) Malformed / `schema_version` mismatch:** re-invoke `/bootstrap` against the
   malformed file. Observe the agent **warns** and **offers repair or
   archive-and-restart** (mirrors the legacy version-mismatch handling), rather than
   crashing or silently guessing.

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

**Notes**:
- **Unblocked (REM-7 / RT1-05).** Previously BLOCKED on OQ-3; OQ-3 is now **Resolved →
  DEC-6**, so the pass criteria above are concrete. See §8.3.

---

#### TC-INFRA-001 - (PROPOSED) Bundled prompt-structure test + prompt-size guardrail

**Scenario Type**: Test infrastructure
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: TC-STRUCT-001…005, 008, 009, 010, 011, 012 (bundling), RSK-1 (prompt-size guardrail)
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bootstrapper-prompt-structure.sh` (NEW)
**Tags**: @ci, @test-infra

**Status**: **PROPOSED — not implemented in this test plan.** Flagged for the
implementation plan (`chg-GH-71-plan.md`, Phase C) to action.

**Purpose**:
- Bundle the Layer-1 `grep`/diff assertions (TC-STRUCT-001…012) into a single
  deterministic, CI-safe (no network, no mutation) shell test, following the repo
  convention `scripts/.tests/test-*.sh` (testing-strategy "Conventions"). Mirror the
  structure of `scripts/.tests/test-inception-doc-consistency.sh` (read-only greps,
  `::error::` annotations, exit non-zero on drift).

**What it would assert (scope):**
- TC-STRUCT-001 allowlist entries (incl. `doc/documentation-profile.md` and
  `doc/inception/abandoned-*.yaml`).
- TC-STRUCT-002 four instruction files referenced.
- TC-STRUCT-003 legacy anchor presence + **two-tier parity** vs baseline (`0a1a288`,
  env-overridable): Tier A frozen blocks byte-identical; Tier B shared blocks
  (`<resume_behavior>`, `<write_allowlist>`) preserve every baseline line verbatim
  (additions allowed). Code-fence-aware awk extractor.
- TC-STRUCT-004 guide reference + **line-overlap** non-duplication heuristic (per phase).
- TC-STRUCT-005 balanced section tags (code-span-aware).
- TC-STRUCT-008 **anchor-based** anti-sycophancy: each decision-dense
  `<phase_N_inception>` carries an `<anti_sycophancy>` sub-tag naming the correct
  technique; phases 0/5/6/7 have none. **(Depends on REM-3 `@toolsmith` anchor; align the
  anchor name to the shipped prompt.)**
- TC-STRUCT-009 / 010 / 011 / 012 structural anchors (note: the TC-STRUCT-011
  `desirability`-absent check is bundled here — no existing script covers the
  bootstrapper four-risk vocabulary, RT1-12).
- **Prompt-size guardrail (NEW — REM-4 / RT1-07, traces RSK-1):** measure
  `.opencode/agent/bootstrapper.md` line count; **warn** (emit a `::warning::` annotation
  and treat as a soft failure, i.e., non-zero exit OR a printed WARN) if it exceeds
  **~650 lines**, and **hard-fail** (`::error::` + non-zero exit) if it exceeds
  **~800 lines**. Both thresholds are **tunable** via env vars (e.g.,
  `BOOTSTRAPPER_WARN_LINES` / `BOOTSTRAPPER_FAIL_LINES`). This makes RSK-1 a *measured*
  guardrail rather than a post-hoc trigger.

**Prompt-size snippet (REM-4):**
```bash
f=.opencode/agent/bootstrapper.md
warn=${BOOTSTRAPPER_WARN_LINES:-650}    # tunable
fail=${BOOTSTRAPPER_FAIL_LINES:-800}    # tunable
lines=$(wc -l < "$f")
if [ "$lines" -gt "$fail" ]; then
  echo "::error:: bootstrapper.md is ${lines} lines (>${fail}); RSK-1 prompt-bloat hard limit exceeded"
  exit 1
elif [ "$lines" -gt "$warn" ]; then
  echo "::warning:: bootstrapper.md is ${lines} lines (>${warn}); approaching RSK-1 bloat limit — consider trimming"
  # soft signal: escalate to hard fail by treating WARN as non-zero if desired
fi
```

**Notes / Clarifications**:
- This is a **test-infra** task, not a change-implementation task. It is proposed
  coverage; the plan decides whether to ship it in GH-71 or defer. If deferred, the
  Layer-1 checks remain runnable as one-shot snippets (each TC-STRUCT lists its `bash`).
- The size guardrail is deliberately a two-stage warn/fail so day-to-day growth is visible
  without blocking, while runaway bloat is blocked — consistent with RSK-1's "M/H"
  residual risk.

## 6. Environments and Test Data

- **Layer 1 (CI):** the repo CI runner; no special environment. Needs the pre-change
  baseline SHA for region-parity diffs (TC-STRUCT-003).
- **Layer 2 / 3 (manual):** local-dev only. Scratch repos:
  - empty/git-init repo (new mode);
  - greenfield "idea-only" repo (ambiguous mode);
  - existing-repo scratch with source + history (legacy mode);
  - `doc/inception/inputs/` populated with 2–3 sample materials.
- **Test data generation/cleanup:** scratch repos are disposable; the committed
  `doc/inception/inception-state.yaml` is instantiated per scratch project at runtime
  (this repo ships no live instance — spec §19). No fixtures committed.
- **Isolation:** manual runs use throwaway repos/directories; never run against the
  ADOS source repo itself (the source is not an incepted project).
- **No secrets:** per NFR-6, no credentials are staged in `doc/inception/inputs/`; the
  trust boundary (spec §21) treats all scanned input as untrusted.

## 7. Automation Plan and Implementation Mapping

| TC ID | Implementation status | Execution command | Mocking |
|-------|----------------------|-------------------|---------|
| TC-STRUCT-001 | To Implement (snippet / part of TC-INFRA-001) | `bash` grep snippet (see TC) | None |
| TC-STRUCT-002 | To Implement (snippet / part of TC-INFRA-001) | `bash` grep snippet | None |
| TC-STRUCT-003 | To Implement (snippet / part of TC-INFRA-001) | `bash` grep + region diff | Baseline SHA |
| TC-STRUCT-004 | To Implement (snippet / part of TC-INFRA-001) | `bash` grep snippet | None |
| TC-STRUCT-005 | To Implement (snippet / part of TC-INFRA-001) | `bash` tag-balance snippet | None |
| TC-STRUCT-006 | Existing – No Change (CI guard) | `bash scripts/build-claude-plugin.sh && git diff --exit-code -- .ados-claude/agents/bootstrapper.md` (wrapper: `bash scripts/.tests/test-build-claude-plugin.sh`) | None |
| TC-STRUCT-007 | Existing – No Change (CI guard, conditional) | `bash scripts/.tests/test-doc-distribution.sh` (only if guide amended) | None |
| TC-STRUCT-008 | To Implement (part of TC-INFRA-001) | `bash` grep snippet | None |
| TC-STRUCT-009 | To Implement (part of TC-INFRA-001) | `bash` grep snippet | None |
| TC-STRUCT-010 | To Implement (part of TC-INFRA-001) | `bash` grep snippet | None |
| TC-STRUCT-011 | To Implement (part of TC-INFRA-001) | `bash` grep snippet | None — **RT1-12:** the `desirability`-absent + four-risk check on `bootstrapper.md` is snippet-only until TC-INFRA-001 ships; `test-inception-doc-consistency.sh` covers templates/`project-inception.md`, NOT `bootstrapper.md` |
| TC-STRUCT-012 | To Implement (part of TC-INFRA-001) | `bash` grep snippet | None |
| TC-STRUCT-* (regression) | Existing – No Change | `bash scripts/.tests/test-inception-doc-consistency.sh` (run as regression) | None — **RT1-12:** this script covers inception **templates/`project-inception.md`** four-risk-term consistency, NOT `.opencode/agent/bootstrapper.md`; the bootstrapper four-risk/`desirability` check is TC-STRUCT-011 (snippet-only until TC-INFRA-001) |
| TC-INCEP-001…016 | Manual Only | human-run `/bootstrap` in scratch repos | None (live agent) |
| TC-LEGACY-001 | Manual Only | human-run legacy `/bootstrap` in existing-repo scratch | None |
| TC-LEGACY-002 | Semi-automated | grep on allowlist + manual legacy run | None |
| TC-RESUME-001 | Manual Only | 2-session `/bootstrap` simulation | Simulated compaction |
| TC-RESUME-002 | Manual Only (Unblocked — DEC-6) | partial / abandoned / malformed-state re-invoke | None |
| TC-INFRA-001 | To Implement (PROPOSED — plan decides; Phase C) | `bash scripts/.tests/test-bootstrapper-prompt-structure.sh` (+ prompt-size guardrail: warn >~650, fail >~800 lines; RSK-1) | None |

### CI gate list (run before merge)

1. `git diff --check` — whitespace/conflict-marker guard (testing-strategy "Static/diff checks").
2. `bash scripts/.tests/test-build-claude-plugin.sh` — plugin freshness (RSK-7); plus
   `git diff --exit-code -- .ados-claude/` after `scripts/build-claude-plugin.sh`.
3. `bash scripts/.tests/test-doc-distribution.sh` — doc-distribution marker (only if any
   redistributable doc — incl. `doc/guides/project-inception.md` — is amended).
4. `bash scripts/.tests/test-inception-doc-consistency.sh` — four-risk terminology +
   conditional-matrix consistency regression (directly relevant; this change co-maintains
   the inception surface).
5. `bash scripts/.tests/test-install.sh` and `bash scripts/.tests/test-uninstall.sh` —
   run as regression IF the install set/manifest changes (this change does not add
   `code-review-instructions.md` to `install.sh` — it is generated at runtime by the
   agent — so likely N/A; run only if the manifest is touched).
6. (Proposed) `bash scripts/.tests/test-bootstrapper-prompt-structure.sh` — TC-INFRA-001,
   if the plan chooses to ship it.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk (testing-side) | Mitigation |
|---------------------|------------|
| Behavioral AC cannot be asserted in CI (RSK-2) | Layered strategy: Layer-1 static guards for structure; Layer-2 manual matrix is the authoritative behavioral evidence; Layer-3 regression for parity/resume. This plan never claims a behavioral AC is CI-testable. |
| Static checks assert structure, not behavior — a well-structured prompt could still misbehave | Layer-2 manual matrix compensates; structural drift is the higher-probability regression (RSK-6), which Layer-1 catches well. |
| Region-parity diff (TC-STRUCT-003) — corrected by REM-2/RT1-01 | v1 region-diffed ALL ten legacy blocks whole-block and required empty diffs, which false-fails the two inception-EXTENDED shared blocks (`<resume_behavior>`, `<write_allowlist>`). Now **two-tier**: Tier A frozen blocks byte-identical; Tier B shared blocks preserve every baseline line (additions allowed). Renaming a legacy anchor is still itself a parity violation. |
| Anti-sycophancy placement (TC-STRUCT-008) — corrected by REM-8/RT1-09 | v1's free-text keyword grep was coarse and false-positive-prone. Now **anchor-based**: each decision-dense `<phase_N_inception>` must carry an `<anti_sycophancy>` sub-tag naming the correct technique; 0/5/6/7 none. Depends on REM-3 `@toolsmith` anchor. Behavioral confirmation in TC-INCEP-014. |
| Prompt bloat (RSK-1) — measured by REM-4/RT1-07 | TC-STRUCT-004 enforces reference-not-duplicate; TC-INFRA-001 adds a **prompt-size guardrail** (warn >~650, hard-fail >~800 lines, tunable) so RSK-1 is measured, not post-hoc. |
| Resume edge (OQ-3) — resolved | OQ-3 **Resolved → DEC-6**; TC-RESUME-002 is **unblocked** with concrete pass criteria (partial→`project.flow`-driven resume; abandoned→archived to `doc/inception/abandoned-<ISO>.yaml`; malformed→warn + offer repair/archive-and-restart). |

### 8.2 Assumptions

- GH-69 deliverables (guide, `doc/inception/` skeleton, `inception-state-template.yaml`,
  17 templates, `code-review-instructions--example.md` blueprint) are present and stable
  (spec §12, verified at authoring time).
- The pre-change baseline SHA of `.opencode/agent/bootstrapper.md` is available for
  TC-STRUCT-003 region-parity diffs.
- Manual verification is executed by a human who attends each gate (spec §12); the agent
  does not auto-advance.
- The four-risk values are fixed: Value, Usability, Feasibility, Viability (spec §12).
- Editing the agent prompt is delegated to `@toolsmith` (spec DEC-4; AGENTS.md
  "Extending the system") — test authoring assumes the final prompt shape, not a
  specific internal structure choice (OQ-1).

### 8.3 Open Questions

| OQ | Question | Blocking? | Owner |
|----|----------|-----------|-------|
| OQ-1 | Discrete `<phase_*>` sections vs a separate referenced structure for the inception sub-mode? | Non-blocking for tests (tests target anchors, not the structure choice) but affects TC-INFRA-001 section scoping. | `@decision-advisor` |
| OQ-2 | Bar for amending `doc/guides/project-inception.md` vs recording a deferred item? | Non-blocking; governs whether TC-STRUCT-007 runs. | `@decision-advisor` |
| OQ-3 | Mode selection/resume when a partial `doc/inception/inception-state.yaml` exists from an abandoned run? | **Resolved → DEC-6.** No longer blocking. TC-RESUME-002 has concrete pass criteria (§5.2): partial→`project.flow`-driven resume; abandoned→archived to `doc/inception/abandoned-<ISO>.yaml`; malformed→warn + offer repair/archive-and-restart. | `@decision-advisor` |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-27 | Juliusz Ćwiąkalski | Initial test plan. Layered strategy (static CI checks + manual behavioral matrix + regression); full AC1–AC17 + NFR1–7 + F1–16 + DM1–4 + RSK1–7 traceability; TC-INFRA-001 proposed. |
| 1.1 | 2026-06-27 | Juliusz Ćwiąkalski | Red-team pre-delivery remediation. REM-2/RT1-01: TC-STRUCT-003 → two-tier parity (Tier A frozen blocks byte-identical; Tier B `<resume_behavior>`/`<write_allowlist>` line-presence). REM-5/RT1-04: TC-STRUCT-001 adds `doc/documentation-profile.md` + `abandoned-*.yaml`. REM-6/RT1-03: +TC-INCEP-016 (behavioral AC15). REM-7/RT1-05: TC-RESUME-002 unblocked vs DEC-6; OQ-3 resolved. REM-4/RT1-07: TC-INFRA-001 prompt-size guardrail (warn ~650 / fail ~800). REM-8/RT1-09: TC-STRUCT-008 anchor-based anti-sycophancy (REM-3 dep). RT1-08: TC-STRUCT-004 line-overlap heuristic. RT1-12: TC-STRUCT-011/§7 desirability snippet-only correction. Traceability (AC15→016, RSK-1→INFRA-001, §4 manual matrix→AC15) and §8 risks updated. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(not yet executed — plan proposed)_ | | | |
